import type { Analysis } from "../data/types";

const abilityRules: Array<[RegExp, string]> = [
  [/协调|沟通|对接|跨部门|推动|共识/, "跨团队协作"],
  [/分析|数据|指标|报表|转化|漏斗/, "数据分析"],
  [/用户|调研|反馈|需求|访谈/, "用户洞察"],
  [/方案|产品|功能|原型|体验/, "产品思维"],
  [/提前|上线|交付|进度|排期|里程碑/, "项目推进"],
  [/复盘|优化|改进|迭代|沉淀/, "持续优化"],
  [/海外|国际|英文|本地化|出海/, "国际化视野"],
  [/主动|独立|负责|牵头|主导/, "主人翁意识"]
];

export function analyzeExperience(raw: string): Analysis {
  const lines = raw.split(/\n|；|。/).map((x) => x.trim()).filter(Boolean);
  const evidence = raw.match(/\d+(?:\.\d+)?%?|[一二三四五六七八九十]+(?:个|次|天|周|方|条|项)/g)?.join("、") || "";
  const abilities = abilityRules.filter(([rule]) => rule.test(raw)).map(([, label]) => label).slice(0, 4);
  if (!abilities.length) abilities.push("执行与交付");

  const situation = lines[0] || "待补充业务背景";
  const task = lines.find((x) => /负责|目标|需要|任务|希望|要求/.test(x)) || "待明确你的目标与职责边界";
  const action =
    lines.filter((x) => /协调|分析|制定|推动|搭建|优化|完成|跟进|输出|整理|确认/.test(x)).slice(0, 3).join("；") ||
    lines.slice(1, 3).join("；") ||
    "待补充关键行动";
  const result =
    lines.find((x) => /提升|增长|降低|完成|上线|结果|提前|转化|节省|沉淀/.test(x)) ||
    (evidence ? `取得了可量化结果：${evidence}` : "待补充可量化结果");

  const questions = [
    !/背景|因为|当时|面临/.test(raw) && "这件事发生在什么业务背景下？当时最关键的限制是什么？",
    !/负责|目标|需要|任务/.test(raw) && "你的个人目标和职责边界是什么？哪些部分是你主导的？",
    !/协调|分析|制定|推动|优化|输出/.test(raw) && "你具体做了哪些关键动作？为什么选择这种做法？",
    !evidence && "结果可以用什么数字衡量？例如效率、时间、用户量、转化率或成本。",
    "如果重做一次，你会保留什么、改变什么？这反映了你的哪项判断？"
  ].filter(Boolean) as string[];

  return {
    situation,
    task,
    action,
    result,
    abilities,
    questions: questions.slice(0, 4),
    bullet: `${action}，${result}${evidence && !result.includes(evidence) ? `（${evidence}）` : ""}。`,
    patterns: inferPatterns(raw),
    nextActions: inferNextActions(raw, evidence)
  };
}

function inferPatterns(raw: string) {
  const patterns = [];
  if (/协调|推动|对接/.test(raw)) patterns.push("你更适合把复杂事项拆成明确对象、节奏和交付物来推进。");
  if (/数据|分析|指标/.test(raw)) patterns.push("这段经历可以强化为“用证据做判断”的能力表达。");
  if (/用户|反馈|需求/.test(raw)) patterns.push("可以继续补充用户来源、样本数量和洞察如何影响方案。");
  return patterns.slice(0, 3);
}

function inferNextActions(raw: string, evidence: string) {
  return [
    !evidence && "补充一个可核实数字，让经历从“做过”变成“做成”。",
    !/我|本人|负责|主导|牵头/.test(raw) && "明确你本人负责的部分，避免简历描述像团队成果。",
    "把这段经历分别改写成产品、运营、分析三个版本，观察哪个最贴近目标岗位。"
  ].filter(Boolean) as string[];
}
