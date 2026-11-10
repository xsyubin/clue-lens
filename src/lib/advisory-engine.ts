import type { MonopolyClue } from "../db/schema";

export interface AdvisoryResult {
  source: "EXPERT_RULE" | "AI_ENHANCED";
  direction: string;
  measures: string;
  legalBasis: string;
  focusPoints: string[];
  modelName?: string;
  fallbackReason?: string;
}

export interface GenerateAdvisoryOptions {
  useAi?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * 专卖监管内置专家处置知识库 (100% 离线可用)
 */
const EXPERT_KNOWLEDGE_BASE: Record<
  string,
  Record<
    string,
    { direction: string; measures: string; legalBasis: string; focusPoints: string[] }
  >
> = {
  许可证异常: {
    高: {
      direction: "停业查封与立案取缔",
      measures: "1. 立即派专卖执法人员现场下达《责令停业通知书》；2. 现场扣押涉案无证烟草专卖品并进行抽样取证；3. 移交法规审理股立案处理。",
      legalBasis: "《中华人民共和国烟草专卖法》第十六条、第三十一条",
      focusPoints: ["是否属于无证经营烟草制品零售业务", "现场存货条码与进货凭证比对", "是否存在二次转卖走私烟嫌疑"],
    },
    中: {
      direction: "限期补办与现场核查",
      measures: "1. 责令当事人在 15 个工作日内办理许可证延续或地址变更手续；2. 暂扣异常在售烟草专卖品由专卖局代管；3. 开展定期回访。",
      legalBasis: "《烟草专卖许可证管理办法》第四十四条",
      focusPoints: ["许可证有效期限", "经营主体与登记地址一致性", "实际经营人身份"],
    },
    低: {
      direction: "合规指导与警示谈话",
      measures: "1. 对经营者进行《烟草专卖法》法规警示宣讲；2. 协助指引在线申请证照年检或亮证经营指导；3. 纳入季度普查名录。",
      legalBasis: "《烟草专卖许可证管理办法实施细则》",
      focusPoints: ["亮证经营规范", "柜台标价牌张贴规范"],
    },
  },
  经营异常: {
    高: {
      direction: "联合执法与立案查处",
      measures: "1. 会同市场监管与公安部门开展突击现场检查；2. 查封异常仓储窝点并扣押涉假涉私卷烟；3. 深入倒查上线供货网络。",
      legalBasis: "《中华人民共和国烟草专卖法实施条例》第二十五条、第五十四条",
      focusPoints: ["私设仓储点与隐藏暗格", "大额进销存账本与银行流水", "涉案卷烟真伪鉴别"],
    },
    中: {
      direction: "重点监管与账册抽检",
      measures: "1. 调取近期订货数据与实际销售流水进行交叉比对；2. 开展每周两次不定时实地盘点；3. 对存在违规行为的经营户调减供货档位。",
      legalBasis: "《烟草行业卷烟销售网络建设与零售户管理办法》",
      focusPoints: ["订货量与实际销售异常波动", "异常集中订货", "是否存在大户套购"],
    },
    低: {
      direction: "日常核验与经营回访",
      measures: "1. 上门核实经营状态与营业时间；2. 检查店内商品陈列与规范经营台账；3. 提醒按章规范经营。",
      legalBasis: "日常专卖监督检查操作规程",
      focusPoints: ["实际营业情况", "明码标价执行"],
    },
  },
  配送异常: {
    高: {
      direction: "中途拦截与运输立案查处",
      measures: "1. 会同交通执法大队在关键交通道口设卡拦截涉案配送车辆；2. 查验烟草专卖品准运证及随车同行单；3. 对无准运证运输卷烟依法扣押立案。",
      legalBasis: "《中华人民共和国烟草专卖法》第二十一条、第三十条",
      focusPoints: ["随车准运证防伪标识与真伪", "实际装载数量与准运证是否相符", "车辆行驶轨迹"],
    },
    中: {
      direction: "到货交接核验与轨迹倒查",
      measures: "1. 执法人员到配送落地商户现场监督卷烟扫码交接；2. 核查落地条码与出库批次是否吻合；3. 排查是否存在中途换货或私自倒运。",
      legalBasis: "《烟草专卖品准运证管理办法》",
      focusPoints: ["条形码完整性与一打一码对应", "签收人真实身份", "是否存在落地不到户"],
    },
    低: {
      direction: "流程纠偏与时效督导",
      measures: "1. 督促物流配送部门优化配送路线与时效；2. 规范送货上门签收拍照流程；3. 消除配送交接盲区。",
      legalBasis: "专卖商业物流配送作业规范",
      focusPoints: ["签收单据规范", "送达时效延迟原因"],
    },
  },
  价格异常: {
    高: {
      direction: "低价倾销或高价暴利查处",
      measures: "1. 对涉嫌低于进货成本恶意倾销或违规加价加价炒作名优卷烟的行为进行取证；2. 约谈经营负责人并下发整改通知；3. 通报市监价格执法支队协同处罚。",
      legalBasis: "《中华人民共和国价格法》第十四条、《烟草专卖法实施条例》",
      focusPoints: ["进销差价与违规加价幅度", "是否存在囤积居奇", "是否扰乱区域卷烟市场流通秩序"],
    },
    中: {
      direction: "价格约谈与诚信降档",
      measures: "1. 约谈经营主体负责人，进行指导价合规宣导；2. 检查店内卷烟标价签与实际收银结账金额；3. 扣除零售户信用户积分并降档。",
      legalBasis: "卷烟零售户自律互助小组规约",
      focusPoints: ["标价签与实际售价一致性", "是否存在私下议价"],
    },
    低: {
      direction: "价格巡查与自律引导",
      measures: "1. 组织加入片区零售自律互助小组；2. 发放明码实价宣传指引彩页；3. 引导自觉维护零售指导价。",
      legalBasis: "行业卷烟明码标价管理规定",
      focusPoints: ["明码标价签张贴完备率"],
    },
  },
  非法收购: {
    高: {
      direction: "窝点端除与刑事线索移送",
      measures: "1. 突击检查地下非法倒买倒卖卷烟回收窝点；2. 现场扣押账本、现金与打包封装卷烟；3. 涉案金额达到追刑标准的依法移送公安机关经侦大队。",
      legalBasis: "《中华人民共和国刑法》第二百二十五条（非法经营罪）",
      focusPoints: ["回收倒卖网络层级", "涉案卷烟金额是否达到五万元立案追诉标准", "上线资金链"],
    },
    中: {
      direction: "现场检查与非法收购查扣",
      measures: "1. 对涉嫌二次回收礼品烟的门市进行现场检查；2. 依法先行登记保存非法收购的无合法来源卷烟；3. 处以非法收购金额的罚款。",
      legalBasis: "《中华人民共和国烟草专卖法实施条例》第五十八条",
      focusPoints: ["礼品烟回收告示与招牌", "回收卷烟来源登记"],
    },
    低: {
      direction: "法制宣传与重点盯防",
      measures: "1. 拆除非法回收烟酒违规户外招牌；2. 签订《严禁非法收购卷烟承诺书》；3. 部署暗访抽查。",
      legalBasis: "市容管理与烟草专卖联合规约",
      focusPoints: ["店外违规违禁回收广告"],
    },
  },
};

/**
 * 缺省兜底专家建议
 */
const DEFAULT_EXPERT_ADVISORY = {
  direction: "常规执法排查与证据固定",
  measures: "1. 安排 2 名执法人员佩戴执法仪实地走访核查；2. 核对经营执照与烟草专卖品进货单据；3. 制作现场检查笔录并拍照留存。",
  legalBasis: "《中华人民共和国行政处罚法》、《烟草专卖监督检查规定》",
  focusPoints: ["现场检查双人执法与亮证", "检查笔录经由当事人签字确认", "执法全过程音视频记录完整"],
};

/**
 * 清洗大模型输出中的冗余网络引文、追踪链接与 Markdown 脏链接，确保纯文本且无任何断行撑爆
 */
export function cleanAdvisoryText(text: string): string {
  if (!text) return "";
  let res = text;

  // 1. 匹配带外层括号的 Markdown 链接，如 ([samr.gov.cn](http...)) 或 （[samr.gov.cn]\n(http...)）
  res = res.replace(/[（(]\s*\[.*?\]\s*\(https?:\/\/[^)]+\)\s*[）)]/gis, "");

  // 2. 匹配普通的 Markdown 链接 [文字](http...)
  res = res.replace(/\[(.*?)\]\s*\(https?:\/\/[^)]+\)/gis, (match, anchor) => {
    const trimmed = anchor.trim();
    // 如果文字本身就是域名、无意义引用或纯数字，直接剔除；否则保留文字
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed) || /^\d+$/.test(trimmed)) {
      return "";
    }
    return trimmed;
  });

  // 3. 匹配带有括号的独立 URL：(https://...) 或 （https://...）
  res = res.replace(/[（(]\s*https?:\/\/[^\s）)]+\s*[）)]/gis, "");

  // 4. 匹配任何残余的裸 URL
  res = res.replace(/https?:\/\/[^\s，。；、\n)）\]]+/gi, "");

  // 5. 匹配残余的引文注脚，如 [samr.gov.cn]、[1]、([samr.gov.cn])
  res = res.replace(/[（(]\s*\[?[a-z0-9.-]+\.[a-z]{2,}\]?\s*[）)]/gis, "");
  res = res.replace(/\[\s*([a-z0-9.-]+\.[a-z]{2,}|\d+)\s*\]/gi, "");

  // 6. 清理空括号及无意义符号残余
  res = res.replace(/[（(]\s*[）)]/g, "");
  res = res.replace(/\[\s*\]/g, "");

  // 7. 清理中文标点前的多余空格和多重空格
  res = res.replace(/\s+([，。；：！？])/g, "$1");
  res = res.replace(/[ \t]{2,}/g, " ");

  return res.trim();
}

/**
 * 健壮的 JSON 结构提取器（支持 Markdown 代码块包裹与前后缀文本容错）
 */
function extractAdvisoryJson(rawText: string): Record<string, unknown> | null {
  if (!rawText) return null;
  let text = rawText.trim();
  // 剥离 ```json ... ``` 包裹
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z]*\r?\n?/, "").replace(/\r?\n?```$/, "").trim();
  }
  try {
    return JSON.parse(text);
  } catch {
    // 正则提取首个 { 到末尾 }
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * 双模处置建议生成引擎
 */
export async function generateAdvisory(
  clue: Pick<MonopolyClue, "type" | "riskLevel" | "targetName" | "region" | "amount">,
  options?: GenerateAdvisoryOptions
): Promise<AdvisoryResult> {
  const typeKey = clue.type || "经营异常";
  const riskKey = clue.riskLevel || "中";

  // 1. 匹配内置专家规则库作为基础/兜底模板
  const expertTemplate =
    EXPERT_KNOWLEDGE_BASE[typeKey]?.[riskKey] ||
    EXPERT_KNOWLEDGE_BASE[typeKey]?.["中"] ||
    DEFAULT_EXPERT_ADVISORY;

  // 2. 如果未开启 AI 研判，直接返回专家规则
  if (!options?.useAi) {
    return {
      source: "EXPERT_RULE",
      direction: expertTemplate.direction,
      measures: expertTemplate.measures,
      legalBasis: expertTemplate.legalBasis,
      focusPoints: expertTemplate.focusPoints,
    };
  }

  // 3. 校验 API Key，若未配置则明确降级并说明原因
  const apiKey = options.apiKey;
  if (!apiKey) {
    return {
      source: "EXPERT_RULE",
      direction: expertTemplate.direction,
      measures: expertTemplate.measures,
      legalBasis: expertTemplate.legalBasis,
      focusPoints: expertTemplate.focusPoints,
      fallbackReason: "系统未检测到大模型密钥（LLM_API_KEY），已自动启用内置专家建议",
    };
  }

  const rawBaseUrl = options.baseUrl || "http://token.ai.longjitech.com/v1";
  const cleanBase = rawBaseUrl.replace(/\/+$/, "");
  const targetUrl = cleanBase.endsWith("/chat/completions")
    ? cleanBase
    : `${cleanBase}/chat/completions`;
  const targetModel = options.model || "gpt-6-luna";
  const timeoutMs = options.timeoutMs ?? 60000;

  // 4. AI 深度研判（带完整超时守卫与容错降级）
  try {
    const prompt = `你是一名烟草专卖监管执法与案由审理专家，请针对以下案件线索出具结构化处置措施建议：
- 经营对象：${clue.targetName || "未标明商户"}
- 所属区域：${clue.region || "辖区"}
- 线索类型：${clue.type || "涉烟异常"}
- 风险等级：${clue.riskLevel || "中"}
- 涉案金额：￥${clue.amount ?? 0} 元

请根据涉案主体特征、涉案金额与追刑门槛（如涉案金额达到或接近5万元的非法经营追究刑事责任标准），给出专业、针对性强的排查步骤与处置方案。
排查步骤与格式硬性要求：
1. 请输出具体清晰的 2 至 4 项排查与处置举措，每项举措必须换行并以数字序号标识（例如 "1. "、"2. "、"3. "）；
2. 严禁包含任何外部 URL 网址链接、utm 追踪参数、网页检索注脚引用（例如 [samr.gov.cn](...)、(http...) 等），必须为纯文本表述。

请直接以 JSON 格式输出建议，严禁包裹多余闲聊，包含以下必填字段：
{
  "direction": "处置主攻方向（精炼说明当前首要处置策略与重心，纯文本无链接）",
  "measures": "1. 第一项排查措施\\n2. 第二项排查措施\\n3. 第三项处置举措",
  "legalBasis": "具体法律法规依据（法条全称与具体款项，纯文本无链接）",
  "focusPoints": ["排查重点1", "排查重点2"]
}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          {
            role: "system",
            content:
              "你是一名资深的烟草专卖执法专家。请直接以标准 JSON 对象输出处置方案，不要包含任何 markdown 代码块以外的解释。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        source: "EXPERT_RULE",
        direction: expertTemplate.direction,
        measures: expertTemplate.measures,
        legalBasis: expertTemplate.legalBasis,
        focusPoints: expertTemplate.focusPoints,
        fallbackReason: `大模型请求异常（HTTP ${response.status}），已自动降级为内置专家建议`,
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractAdvisoryJson(content);

    if (parsed && typeof parsed.direction === "string" && typeof parsed.measures === "string") {
      const focusPoints = Array.isArray(parsed.focusPoints)
        ? (parsed.focusPoints as unknown[]).map(String)
        : expertTemplate.focusPoints;

      return {
        source: "AI_ENHANCED",
        direction: cleanAdvisoryText(parsed.direction),
        measures: cleanAdvisoryText(parsed.measures),
        legalBasis: cleanAdvisoryText(
          typeof parsed.legalBasis === "string" ? parsed.legalBasis : expertTemplate.legalBasis
        ),
        focusPoints: focusPoints.map(cleanAdvisoryText).filter(Boolean),
        modelName: targetModel,
      };
    }

    // JSON 无法解析，降级并说明原因
    return {
      source: "EXPERT_RULE",
      direction: expertTemplate.direction,
      measures: expertTemplate.measures,
      legalBasis: expertTemplate.legalBasis,
      focusPoints: expertTemplate.focusPoints,
      fallbackReason: "大模型输出格式未匹配结构化规范，已降级为内置专家建议",
    };
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      source: "EXPERT_RULE",
      direction: expertTemplate.direction,
      measures: expertTemplate.measures,
      legalBasis: expertTemplate.legalBasis,
      focusPoints: expertTemplate.focusPoints,
      fallbackReason: isTimeout
        ? "大模型深度推理超时，已无缝降级为内置专家建议"
        : "大模型调用异常，已无缝降级为内置专家建议",
    };
  }
}
