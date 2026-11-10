#!/usr/bin/env node
// ==============================================================================
// scripts/agent/worktree.mjs
// 跨平台智能体 Worktree 生命周期管理 (Node.js ESM)
// 语法：node scripts/agent/worktree.mjs new|merge|drop <slug>
// ==============================================================================
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function showUsage() {
  console.error(`用法：
  node scripts/agent/worktree.mjs new <slug>     创建隔离 worktree 并初始化依赖沙盒
  node scripts/agent/worktree.mjs merge <slug>   验证通过后快进合并到 main 并清理
  node scripts/agent/worktree.mjs drop <slug>    放弃改动：清理 worktree 与分支`);
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  showUsage();
}

const [cmd, slug] = args;

// 校验 slug 格式
if (!slug || !/^[A-Za-z0-9._-]+$/.test(slug)) {
  console.error(`❌ [WORKTREE] slug 只能包含字母、数字、点、下划线、短横线：${slug}`);
  process.exit(2);
}

// 辅助运行 git 命令
function runGit(args, cwd, allowFail = false) {
  const result = spawnSync("git", args, {
    cwd,
    stdio: allowFail ? "pipe" : "inherit",
    encoding: "utf8",
  });
  if (!allowFail && result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
}

function getGitOutput(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  return (result.stdout || "").trim();
}

// 寻找主工作区根目录
let mainRoot;
try {
  const commonDir = getGitOutput(["rev-parse", "--path-format=absolute", "--git-common-dir"], process.cwd());
  mainRoot = commonDir ? path.resolve(commonDir, "..") : path.resolve(getGitOutput(["rev-parse", "--show-toplevel"], process.cwd()));
} catch {
  mainRoot = path.resolve(__dirname, "../..");
}

const parentDir = process.env.WORKTREE_PARENT
  ? path.resolve(process.env.WORKTREE_PARENT)
  : path.resolve(mainRoot, ".worktrees");

const wtDir = path.join(parentDir, `clue-lens-${slug}`);
const branch = `agent/${slug}`;

switch (cmd) {
  case "new": {
    if (fs.existsSync(wtDir)) {
      console.error(`❌ [WORKTREE] 目标目录已存在：${wtDir}`);
      process.exit(1);
    }

    const checkBranch = spawnSync("git", ["-C", mainRoot, "show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    if (checkBranch.status === 0) {
      console.error(`❌ [WORKTREE] 分支已存在：${branch}，请更换 slug 或先执行 drop。`);
      process.exit(1);
    }

    console.log(`🌱 [WORKTREE] 正在从 main 创建隔离工作树: ${branch} -> ${wtDir} ...`);
    fs.mkdirSync(parentDir, { recursive: true });

    runGit(["-C", mainRoot, "worktree", "add", "-b", branch, wtDir, "main"], mainRoot);

    // 1. 软链共享 node_modules（Windows 使用 junction，macOS/Linux 使用 dir）
    const nmSrc = path.join(mainRoot, "node_modules");
    const nmDest = path.join(wtDir, "node_modules");
    if (fs.existsSync(nmSrc)) {
      try {
        const symlinkType = process.platform === "win32" ? "junction" : "dir";
        fs.symlinkSync(nmSrc, nmDest, symlinkType);
        console.log(`🔗 [WORKTREE] 已软链共享 node_modules (${symlinkType})`);
      } catch (err) {
        console.warn(`⚠️ [WORKTREE] 软链 node_modules 提示: ${err.message}`);
      }
    }

    // 2. 复制环境配置
    const envSrc = path.join(mainRoot, ".env");
    const envDest = path.join(wtDir, ".env");
    const envExample = path.join(mainRoot, ".env.example");
    if (fs.existsSync(envSrc)) {
      fs.copyFileSync(envSrc, envDest);
      console.log("📋 [WORKTREE] 已复制 .env 配置");
    } else if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envDest);
      console.log("📋 [WORKTREE] 已从 .env.example 生成 .env");
    }

    // 3. 克隆 SQLite 数据库沙盒（隔离读写，杜绝并发 lock）
    const dbDir = path.join(wtDir, "data");
    fs.mkdirSync(dbDir, { recursive: true });
    const dbSrc = path.join(mainRoot, "data", "app.db");
    const dbDest = path.join(dbDir, "app.db");
    if (fs.existsSync(dbSrc)) {
      fs.copyFileSync(dbSrc, dbDest);
      console.log("📦 [WORKTREE] 已克隆私有沙盒数据库 data/app.db");
    }

    console.log("\n==================================================================");
    console.log("✅ [WORKTREE] 隔离沙盒创建就绪！");
    console.log(`  - 工作目录: ${wtDir}`);
    console.log(`  - 隔离分支: ${branch}`);
    console.log("==================================================================");
    console.log("👉 关键提示：");
    console.log(`  1. 之后的代码读写、修改与测试验证，必须全部在 ${wtDir} 路径下进行；`);
    console.log(`  2. 严禁改动 ${mainRoot} 主工作区文件；`);
    console.log(`  3. 测试全绿后，执行: node scripts/agent/worktree.mjs merge ${slug}`);
    break;
  }

  case "merge": {
    if (!fs.existsSync(wtDir)) {
      console.error(`❌ [WORKTREE] 不存在该 worktree 目录：${wtDir}`);
      process.exit(1);
    }

    // 1. 检查未提交变动
    const statusOut = getGitOutput(["-C", wtDir, "status", "--porcelain"], wtDir);
    if (statusOut.length > 0) {
      console.error("❌ [WORKTREE] worktree 里还有未提交的改动，必须先在 worktree 提交：");
      runGit(["-C", wtDir, "status", "--short"], wtDir);
      process.exit(1);
    }

    // 2. 检查主工作区是否在 main
    let currentMainBranch = "";
    try {
      currentMainBranch = getGitOutput(["-C", mainRoot, "symbolic-ref", "--short", "HEAD"], mainRoot);
    } catch {
      currentMainBranch = "";
    }
    if (currentMainBranch !== "main") {
      console.error(`❌ [WORKTREE] 主工作区当前不在 main 分支（当前为: ${currentMainBranch || "detached"}），拒绝合并`);
      process.exit(1);
    }

    // 3. 检查 main 分支在此期间是否前进过
    const ancestorCheck = spawnSync("git", ["-C", wtDir, "merge-base", "--is-ancestor", "main", "HEAD"]);
    if (ancestorCheck.status !== 0) {
      console.log(`⚠️ [WORKTREE] main 分支在此期间已前进，正在自动将 ${branch} 变基到最新 main ...`);
      const rebaseRes = spawnSync("git", ["-C", wtDir, "rebase", "main"], { stdio: "inherit" });
      if (rebaseRes.status !== 0) {
        console.error("❌ [WORKTREE] 变基发生冲突，请在 worktree 中手动解决！");
        process.exit(1);
      }
      console.error(`🛑 [WORKTREE] 分支已变基成功！因代码基线发生变化，请在 ${wtDir} 中重新运行测试和审查门禁，全部通过后再执行 merge。`);
      process.exit(3);
    }

    // 4. 执行确定性前置审查
    console.log("🔍 [WORKTREE] 正在执行合并前确定性审查门禁...");
    const reviewScript = path.join(wtDir, "scripts", "review.mjs");
    if (!fs.existsSync(reviewScript)) {
      console.error(`❌ [WORKTREE] 未找到确定性审查入口: ${reviewScript}`);
      process.exit(1);
    }
    const reviewRes = spawnSync(process.execPath, [reviewScript], {
      cwd: wtDir,
      stdio: "inherit",
      env: process.env,
    });

    if (reviewRes.status !== 0) {
      console.error(`❌ [WORKTREE] 审查门禁未通过，已阻断合并！请在 ${wtDir} 中排查修复。`);
      process.exit(1);
    }

    // 5. 校验 Manifest 声明的合并策略 (merge_policy 门禁)
    console.log("📋 [WORKTREE] 正在校验 Agent Manifest 声明的合并策略 (merge_policy)...");
    const manifestPath = path.join(mainRoot, ".agents", "agent-manifest.yml");
    let requiresEvidence = false;
    if (fs.existsSync(manifestPath)) {
      const manifestContent = fs.readFileSync(manifestPath, "utf8");
      if (/merge_policy:.*evidence\/agent-runs\/<run-id>/i.test(manifestContent)) {
        requiresEvidence = true;
      }
    }

    if (requiresEvidence) {
      const isManualOverride = process.env.ALLOW_MANUAL_MERGE === "1" || process.env.SKIP_AGENT_EVIDENCE === "1";
      if (isManualOverride) {
        console.warn("⚠️ [WORKTREE] 已启用 ALLOW_MANUAL_MERGE=1 人工终审放行，跳过 Agent 审计凭据检查。");
      } else {
        const wtEvidenceDir = path.join(wtDir, "evidence", "agent-runs", slug);
        const mainEvidenceDir = path.join(mainRoot, "evidence", "agent-runs", slug);
        const evidenceDir = fs.existsSync(wtEvidenceDir) ? wtEvidenceDir : (fs.existsSync(mainEvidenceDir) ? mainEvidenceDir : null);

        if (!evidenceDir) {
          console.error(`\n❌ [WORKTREE] 合并策略阻断（Manifest 门禁拦截）：`);
          console.error(`   根据 .agents/agent-manifest.yml 的 merge_policy 要求：`);
          console.error(`   "只合并通过质量审查且具备 evidence/agent-runs/<run-id> 记录的分支"`);
          console.error(`   当前未找到针对任务 '${slug}' 的审计凭据目录：`);
          console.error(`   - 预期路径: evidence/agent-runs/${slug}/<role>.md`);
          console.error(`\n👉 修复指引：`);
          console.error(`   1. 规范智能体执行：运行 ./scripts/agent/agent-run.sh 生成角色执行凭据；`);
          console.error(`   2. 人工终审放行（Code Owner 授权）：指定 ALLOW_MANUAL_MERGE=1 ./scripts/agent/worktree.sh merge ${slug}\n`);
          process.exit(1);
        }

        const evidenceFiles = fs.readdirSync(evidenceDir).filter((f) => f.endsWith(".md"));
        if (evidenceFiles.length === 0) {
          console.error(`\n❌ [WORKTREE] 合并策略阻断：审计目录 ${evidenceDir} 为空，缺少角色审计记录文件（如 fullstack-implementer.md）！`);
          process.exit(1);
        }

        let hasPassed = false;
        const failedFiles = [];
        for (const file of evidenceFiles) {
          const content = fs.readFileSync(path.join(evidenceDir, file), "utf8");
          if (content.includes("🔴 违规拦截") || content.includes("🔴 FAIL")) {
            failedFiles.push(file);
          }
          if (content.includes("🟢 合规通过") || content.includes("PASS") || content.includes("门禁判定: 🟢")) {
            hasPassed = true;
          }
        }

        if (failedFiles.length > 0 && !hasPassed) {
          console.error(`\n❌ [WORKTREE] 合并策略阻断：审计凭据中包含未解决的违规拦截记录: ${failedFiles.join(", ")}`);
          process.exit(1);
        }

        console.log(`✅ [WORKTREE] Manifest 合并策略验证通过（发现合规审计凭据: ${evidenceFiles.join(", ")}）`);
      }
    }

    // 6. 快进合并并清理
    console.log("🚀 [WORKTREE] 正在快进合并到 main ...");
    runGit(["-C", mainRoot, "merge", "--ff-only", branch], mainRoot);
    spawnSync("git", ["-C", mainRoot, "worktree", "remove", "--force", wtDir], { stdio: "ignore" });
    if (fs.existsSync(wtDir)) {
      fs.rmSync(wtDir, { recursive: true, force: true });
    }
    spawnSync("git", ["-C", mainRoot, "branch", "-d", branch], { stdio: "ignore" });
    console.log(`✅ [WORKTREE] 已成功快进合并到 main，并清理了工作树与分支 ${branch}！`);
    break;
  }

  case "drop": {
    console.log("🗑️ [WORKTREE] 正在清理丢弃 worktree 与分支...");
    spawnSync("git", ["-C", mainRoot, "worktree", "remove", "--force", wtDir], { stdio: "ignore" });
    if (fs.existsSync(wtDir)) {
      fs.rmSync(wtDir, { recursive: true, force: true });
    }
    spawnSync("git", ["-C", mainRoot, "branch", "-D", branch], { stdio: "ignore" });
    console.log(`✅ [WORKTREE] 已丢弃 ${wtDir} 与分支 ${branch}。`);
    break;
  }

  default:
    showUsage();
}
