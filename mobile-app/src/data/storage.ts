import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppData, ResumeData } from "./types";

const STORAGE_KEY = "career-copilot-local-data-v1";

const defaultResumeContent: ResumeData = {
  contact: "手机｜邮箱｜所在城市",
  summary: "请填写个人优势，或从实习日志生成",
  education: "学校｜专业｜学历｜毕业时间",
  skills: [],
  experiences: []
};

export const defaultData: AppData = {
  jobs: [],
  todos: [],
  logs: [],
  resume: {
    id: 1,
    name: "姓名待填写",
    targetRole: "目标岗位待填写",
    content: defaultResumeContent,
    updatedAt: new Date(0).toISOString()
  },
  interviewReviews: [],
  aiNotes: [],
  settings: {
    internshipReminder: false,
    deepseekApiKey: "",
    deepseekModel: "deepseek-v4-flash",
    deepseekThinking: false,
    candidateProfile: "2027届求职者，正在准备秋招，希望兼顾互联网、出海企业和泛体制机会。",
    targetRoles: "产品经理、商业分析、战略管培生、海外运营",
    aiPreference: "建议要具体、可执行、保守不编造，优先提醒我补齐事实和量化结果。"
  }
};

export async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultData;
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      ...defaultData,
      ...parsed,
      resume: {
        ...defaultData.resume,
        ...parsed.resume,
        content: { ...defaultResumeContent, ...parsed.resume?.content }
      },
      settings: { ...defaultData.settings, ...parsed.settings }
    };
  } catch {
    return defaultData;
  }
}

export async function saveAppData(data: AppData) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function clearAppData() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function serializeData(data: AppData) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2);
}

export function parseImportedData(raw: string): AppData | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed.data || parsed;
  } catch {
    return null;
  }
}
