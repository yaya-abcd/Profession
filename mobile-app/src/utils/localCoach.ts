import type { CoachResult, InterviewReview, Job, Log, ResumeData, Todo } from "../data/types";
import { analyzeExperience } from "./star";

const priorityWords = [/截止|今天|今晚|明天|ddl|deadline|必须|提交|投递/, /简历|面试|笔试|复盘|汇报|上线/];

export function planTodos(todos: Todo[]): CoachResult {
  const sorted = [...todos].sort((a, b) => scoreTodo(b) - scoreTodo(a));
  return {
    title: "本地行动规划",
    summary: "已按紧急度、求职价值和经历沉淀价值排序。缺少截止时间的任务会提示你补充。",
    tags: ["本地规则", "今日优先级", "简历价值"],
    items: sorted.slice(0, 6).map((todo, index) => ({
      name: `${index + 1}. ${todo.title}`,
      reason: scoreTodo(todo) >= 3 ? "和投递、面试或交付强相关，建议优先处理。" : "任务价值明确，但还需要补充截止时间或结果指标。",
      action: todo.detail ? `先完成：${todo.detail}` : "补充背景、截止时间和预期结果，再开始执行。"
    }))
  };
}

function scoreTodo(todo: Todo) {
  return priorityWords.reduce((sum, rule) => sum + (rule.test(`${todo.title}${todo.detail}`) ? 2 : 0), 0) + (todo.status === "todo" ? 1 : 0);
}

export function generateInterview(role: string, mode: string): CoachResult {
  const questionMap: Record<string, string[]> = {
    "业务面": [
      `如果你负责${role}的新用户增长，你会先看哪些指标？`,
      "讲一个你从用户反馈中发现问题并推动方案调整的经历。",
      "面对目标不清晰的需求，你会如何拆解和对齐？"
    ],
    "行为面": [
      "讲一个你在资源有限时推动跨团队项目落地的经历。",
      "讲一次你和他人意见冲突时的处理方式。",
      "讲一个你主动承担责任并最终交付结果的例子。"
    ],
    "压力面": [
      "如果面试官认为你的经历不够匹配，你会如何回应？",
      "如果项目结果没有达到预期，你如何复盘自己的问题？",
      "如果同一时间有多个高优任务，你如何取舍？"
    ]
  };
  const questions = questionMap[mode] || questionMap["业务面"];
  return {
    title: `${role}｜${mode}模拟题`,
    summary: "本地题库已生成一组问题，回答时优先使用真实经历和 STAR 结构。",
    tags: [role, mode, "本地题库"],
    items: questions.map((name) => ({
      name,
      reason: "这类问题能同时考察岗位理解、行动方法和结果意识。",
      action: "用“背景、目标、行动、结果、复盘”五步回答，不要虚构经历。"
    }))
  };
}

export function reviewAnswer(answer: string): string {
  const analysis = analyzeExperience(answer);
  const missing = analysis.questions.slice(0, 2).join(" ");
  return `建议突出：${analysis.abilities.join("、")}。当前回答可沉淀为：${analysis.bullet} ${missing}`;
}

export function parseJobsFromText(text: string): Job[] {
  const chunks = text.split(/\n{2,}|-{3,}|={3,}/).map((x) => x.trim()).filter(Boolean);
  return chunks.map((chunk, index) => {
    const lines = chunk.split(/\n/).map((x) => x.trim()).filter(Boolean);
    const first = lines[0] || chunk;
    const parts = first.split(/[｜|,，:：]/).map((x) => x.trim()).filter(Boolean);
    const company = parts[0] || "待确认公司";
    const role = parts[1] || lines.find((x) => /岗|实习|管培|经理|分析|运营/.test(x)) || "待确认岗位";
    const deadline = chunk.match(/(截止|ddl|Deadline|deadline)[：:\s]*(\S+)/)?.[2] || "待确认";
    const url = chunk.match(/https?:\/\/\S+/)?.[0] || "";
    return {
      id: Date.now() + index,
      company,
      role,
      category: inferCategory(chunk),
      tier: "待评估",
      deadline,
      match: 0,
      status: "待核实",
      companyIntro: /公司|业务|平台|品牌/.test(chunk) ? chunk.slice(0, 80) : "待补充（原信息未提供）",
      requirements: lines.slice(1).join("\n") || chunk,
      sourceUrl: url,
      createdAt: new Date().toISOString()
    };
  });
}

function inferCategory(text: string) {
  if (/国企|央企|事业|银行|证券|体制/.test(text)) return "泛体制";
  if (/出海|海外|国际|跨境|SHEIN|TikTok/.test(text)) return "出海企业";
  if (/制造|供应链|工厂|汽车|新能源/.test(text)) return "制造业";
  if (/外企|英文|全球|consulting|FMCG/.test(text)) return "外企";
  if (/互联网|产品|运营|增长|平台|腾讯|阿里|字节|美团/.test(text)) return "互联网大厂";
  return "其他";
}

export function resumeFromLogs(logs: Log[], targetRole: string): Pick<ResumeData, "summary" | "skills" | "experiences"> {
  const recent = logs.slice(0, 12);
  const skills = Array.from(new Set(recent.flatMap((log) => log.result.abilities))).slice(0, 8);
  return {
    summary: recent.length
      ? `面向${targetRole}，已沉淀${recent.length}段实习/项目经历，优势集中在${skills.join("、") || "执行与交付"}。请继续补充可量化结果后再投递。`
      : "请先记录实习日志，再生成更可信的个人优势。",
    skills,
    experiences: recent.length
      ? [
          {
            company: "实习/项目经历",
            role: targetRole,
            period: "待补充时间",
            bullets: recent.map((log) => log.result.bullet).slice(0, 6)
          }
        ]
      : []
  };
}

export function dashboardInsight(jobs: Job[], todos: Todo[], logs: Log[], reviews: InterviewReview[]) {
  const openTodos = todos.filter((todo) => todo.status === "todo").length;
  const submitted = jobs.filter((job) => /已投递|笔试|面试|offer/i.test(job.status)).length;
  const avgMatch = jobs.length ? Math.round(jobs.reduce((sum, job) => sum + Number(job.match || 0), 0) / jobs.length) : 0;
  return { openTodos, submitted, avgMatch, logCount: logs.length, reviewCount: reviews.length };
}
