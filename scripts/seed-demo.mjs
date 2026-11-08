import Database from "better-sqlite3";
import { resolve } from "node:path";

const dbPath = resolve(process.cwd(), "data/app.db");
const sqlite = new Database(dbPath);

console.log("🌱 开始播种专卖监管线索演示数据...");

// 获取或创建管理员用户
let user = sqlite.prepare("SELECT id FROM user WHERE email = 'admin@clue.local'").get();
if (!user) {
  const userId = "admin-demo-user";
  sqlite
    .prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(userId, "综合管理员", "admin@clue.local", 1, Date.now(), Date.now());
  user = { id: userId };
}

const userId = user.id;

// 清理旧的演示线索（保留非演示线索）
const demoClueNos = [
  "CLUE-2026-001",
  "CLUE-2026-002",
  "CLUE-2026-003",
  "CLUE-2026-004",
  "CLUE-2026-005",
  "CLUE-2026-006",
  "CLUE-2026-007",
  "CLUE-2026-008",
];

const existing = sqlite
  .prepare(
    `SELECT id FROM monopoly_clues WHERE clue_no IN (${demoClueNos.map(() => "?").join(",")})`
  )
  .all(...demoClueNos);

if (existing.length > 0) {
  const ids = existing.map((r) => r.id);
  sqlite
    .prepare(
      `DELETE FROM clue_timeline_logs WHERE clue_id IN (${ids.map(() => "?").join(",")})`
    )
    .run(...ids);
  sqlite
    .prepare(
      `DELETE FROM monopoly_clues WHERE id IN (${ids.map(() => "?").join(",")})`
    )
    .run(...ids);
}

const today = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0];
const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];

const seedClues = [
  {
    clueNo: "CLUE-2026-001",
    discoveryDate: today,
    region: "城东区",
    source: "日常巡查",
    type: "许可证异常",
    targetName: "诚信便民烟酒超市",
    riskLevel: "高",
    amount: 120000,
    department: null,
    handler: null,
    deadline: null,
    needReview: 0,
    status: "PENDING_ASSIGN",
    timeline: [
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "IMPORT",
        fromStatus: null,
        toStatus: "PENDING_ASSIGN",
        comment: "日常巡查台账批量导入建档",
      },
    ],
  },
  {
    clueNo: "CLUE-2026-002",
    discoveryDate: threeDaysAgo,
    region: "城东区",
    source: "群众举报",
    type: "经营异常",
    targetName: "诚信便民烟酒超市",
    riskLevel: "中",
    amount: 35000,
    department: "专卖稽查一队",
    handler: "李四",
    deadline: sevenDaysLater,
    needReview: 1,
    status: "IN_PROGRESS",
    timeline: [
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "IMPORT",
        fromStatus: null,
        toStatus: "PENDING_ASSIGN",
        comment: "群众信访举报录入",
      },
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "DISPATCH",
        fromStatus: "PENDING_ASSIGN",
        toStatus: "IN_PROGRESS",
        comment: "分派至【专卖稽查一队 - 李四】，办理期限至 " + sevenDaysLater,
      },
    ],
  },
  {
    clueNo: "CLUE-2026-003",
    discoveryDate: tenDaysAgo,
    region: "城东区",
    source: "系统预警",
    type: "假冒走私",
    targetName: "老张便利店",
    riskLevel: "高",
    amount: 210000,
    department: "专卖稽查一队",
    handler: "张三",
    deadline: yesterday,
    needReview: 1,
    status: "IN_PROGRESS",
    timeline: [
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "IMPORT",
        fromStatus: null,
        toStatus: "PENDING_ASSIGN",
        comment: "物流寄递情报系统预警导入",
      },
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "DISPATCH",
        fromStatus: "PENDING_ASSIGN",
        toStatus: "IN_PROGRESS",
        comment: "分派至【专卖稽查一队 - 张三】，期限至 " + yesterday,
      },
    ],
  },
  {
    clueNo: "CLUE-2026-004",
    discoveryDate: fiveDaysAgo,
    region: "城东区",
    source: "日常巡查",
    type: "经营异常",
    targetName: "万达广场名烟名酒行",
    riskLevel: "中",
    amount: 45000,
    department: "专卖稽查二队",
    handler: "赵六",
    deadline: today,
    needReview: 1,
    status: "PENDING_REVIEW",
    checkDate: today,
    checkResult: "现场检查发现擅自变更烟草专卖零售经营场所地址，未依法备案",
    measures: "依法责令 7 日内办理变更登记，现场给予警告",
    timeline: [
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "IMPORT",
        fromStatus: null,
        toStatus: "PENDING_ASSIGN",
        comment: "巡查录入",
      },
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "DISPATCH",
        fromStatus: "PENDING_ASSIGN",
        toStatus: "IN_PROGRESS",
        comment: "分派至【专卖稽查二队 - 赵六】",
      },
      {
        operatorRole: "线索核查人员",
        operatorName: "赵六",
        action: "SUBMIT",
        fromStatus: "IN_PROGRESS",
        toStatus: "PENDING_REVIEW",
        comment: "现场核查完毕，已责令整改，提请复核",
      },
    ],
  },
  {
    clueNo: "CLUE-2026-005",
    discoveryDate: tenDaysAgo,
    region: "城东区",
    source: "双随机抽查",
    type: "经营异常",
    targetName: "汇金百货超市",
    riskLevel: "低",
    amount: 12000,
    department: "专卖稽查一队",
    handler: "王五",
    deadline: fiveDaysAgo,
    needReview: 1,
    status: "COMPLETED",
    checkDate: threeDaysAgo,
    checkResult: "经抽查卷烟喷码与供货单位一致，亮证经营规范",
    measures: "日常规范指导，合格办结",
    reviewComment: "抽查程序规范，证据完备，复核通过准予结案",
    timeline: [
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "IMPORT",
        fromStatus: null,
        toStatus: "PENDING_ASSIGN",
        comment: "双随机导入",
      },
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "DISPATCH",
        fromStatus: "PENDING_ASSIGN",
        toStatus: "IN_PROGRESS",
        comment: "分派至王五",
      },
      {
        operatorRole: "线索核查人员",
        operatorName: "王五",
        action: "SUBMIT",
        fromStatus: "IN_PROGRESS",
        toStatus: "PENDING_REVIEW",
        comment: "核查规范，提请复核",
      },
      {
        operatorRole: "部门负责人",
        operatorName: "部门负责人",
        action: "APPROVE",
        fromStatus: "PENDING_REVIEW",
        toStatus: "COMPLETED",
        comment: "复核通过",
      },
    ],
  },
  {
    clueNo: "CLUE-2026-006",
    discoveryDate: tenDaysAgo,
    region: "城东区",
    source: "日常巡查",
    type: "经营异常",
    targetName: "鑫盛便利店",
    riskLevel: "低",
    amount: 8000,
    department: "专卖稽查二队",
    handler: "孙七",
    deadline: fiveDaysAgo,
    needReview: 0,
    status: "CLOSED",
    checkDate: fiveDaysAgo,
    checkResult: "查无违法事实，陈列与库存吻合",
    measures: "立案核销",
    closeReason: "经实地核查无涉烟违规行为，予以归档结案",
    timeline: [
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "IMPORT",
        fromStatus: null,
        toStatus: "PENDING_ASSIGN",
        comment: "建档",
      },
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "DISPATCH",
        fromStatus: "PENDING_ASSIGN",
        toStatus: "IN_PROGRESS",
        comment: "分派",
      },
      {
        operatorRole: "线索核查人员",
        operatorName: "孙七",
        action: "SUBMIT",
        fromStatus: "IN_PROGRESS",
        toStatus: "COMPLETED",
        comment: "无需复核直接完成",
      },
      {
        operatorRole: "部门负责人",
        operatorName: "部门负责人",
        action: "CLOSE",
        fromStatus: "COMPLETED",
        toStatus: "CLOSED",
        comment: "终审归档",
      },
    ],
  },
  {
    clueNo: "CLUE-2026-007",
    discoveryDate: threeDaysAgo,
    region: "城南区",
    source: "公安移送",
    type: "假冒走私",
    targetName: "聚源阁烟酒茶庄",
    riskLevel: "高",
    amount: 350000,
    department: "专卖稽查三队",
    handler: "吴九",
    deadline: sevenDaysLater,
    needReview: 1,
    status: "IN_PROGRESS",
    timeline: [
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "IMPORT",
        fromStatus: null,
        toStatus: "PENDING_ASSIGN",
        comment: "公安联合执法涉烟线索移交",
      },
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "DISPATCH",
        fromStatus: "PENDING_ASSIGN",
        toStatus: "IN_PROGRESS",
        comment: "重点大案，分派至专卖稽查三队吴九",
      },
    ],
  },
  {
    clueNo: "CLUE-2026-008",
    discoveryDate: yesterday,
    region: "城北区",
    source: "群众举报",
    type: "未成年人售烟",
    targetName: "佳客多便利店",
    riskLevel: "中",
    amount: 5000,
    department: null,
    handler: null,
    deadline: null,
    needReview: 0,
    status: "PENDING_ASSIGN",
    timeline: [
      {
        operatorRole: "综合管理人员",
        operatorName: "综合管理员",
        action: "IMPORT",
        fromStatus: null,
        toStatus: "PENDING_ASSIGN",
        comment: "12313 热线投诉转办录入",
      },
    ],
  },
];

const insertClue = sqlite.prepare(`
  INSERT INTO monopoly_clues (
    id, clue_no, discovery_date, region, source, type, target_name,
    risk_level, amount, department, handler, deadline, need_review,
    status, check_date, check_result, measures, review_comment, close_reason,
    user_id, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?
  )
`);

const insertTimeline = sqlite.prepare(`
  INSERT INTO clue_timeline_logs (
    id, clue_id, operator_role, operator_name, action,
    from_status, to_status, comment, created_at
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?
  )
`);

const now = Math.floor(Date.now() / 1000);

for (const c of seedClues) {
  const clueId = crypto.randomUUID();
  insertClue.run(
    clueId,
    c.clueNo,
    c.discoveryDate,
    c.region,
    c.source,
    c.type,
    c.targetName,
    c.riskLevel,
    c.amount,
    c.department,
    c.handler,
    c.deadline,
    c.needReview,
    c.status,
    c.checkDate || null,
    c.checkResult || null,
    c.measures || null,
    c.reviewComment || null,
    c.closeReason || null,
    userId,
    now,
    now
  );

  for (let i = 0; i < c.timeline.length; i++) {
    const t = c.timeline[i];
    insertTimeline.run(
      crypto.randomUUID(),
      clueId,
      t.operatorRole,
      t.operatorName,
      t.action,
      t.fromStatus,
      t.toStatus,
      t.comment,
      now + i * 60
    );
  }
}

console.log(`✅ 成功播种 ${seedClues.length} 条专卖监管演示线索与对应流转时间轴！`);
console.log(`🔑 演示登录账号: admin@clue.local / password123`);
