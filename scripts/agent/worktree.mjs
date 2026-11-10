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
    let reviewPass = false;
    if (fs.existsSync(reviewScript)) {
      const reviewRes = spawnSync(process.execPath, [reviewScript], {
        cwd: wtDir,
        stdio: "inherit",
        env: process.env,
      });
      reviewPass = reviewRes.status === 0;
    } else {
      const shReview = path.join(wtDir, "scripts", "review.sh");
      const reviewRes = spawnSync(shReview, [], {
        cwd: wtDir,
        stdio: "inherit",
        env: process.env,
      });
      reviewPass = reviewRes.status === 0;
    }

    if (!reviewPass) {
      console.error(`❌ [WORKTREE] 审查门禁未通过，已阻断合并！请在 ${wtDir} 中排查修复。`);
      process.exit(1);
    }

    // 5. 快进合并并清理
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
