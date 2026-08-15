export type JobCategory = "泛体制" | "互联网大厂" | "出海企业" | "制造业" | "外企" | "其他";

export type Job = {
  id: number;
  company: string;
  role: string;
  category: JobCategory;
  tier: string;
  deadline: string;
  match: number;
  status: string;
  companyIntro: string;
  requirements: string;
  sourceUrl: string;
  createdAt: string;
  strategy?: string;
  strategyUpdatedAt?: string;
};

export type Todo = {
  id: number;
  date: string;
  title: string;
  detail: string;
  status: "todo" | "done";
  resumeRelevant: boolean;
  createdAt: string;
};

export type Analysis = {
  situation: string;
  task: string;
  action: string;
  result: string;
  abilities: string[];
  questions: string[];
  bullet: string;
  patterns?: string[];
  nextActions?: string[];
};

export type Log = {
  id: number;
  date: string;
  content: string;
  result: Analysis;
  createdAt: string;
};

export type Experience = {
  company: string;
  role: string;
  period: string;
  bullets: string[];
};

export type ResumeData = {
  contact: string;
  summary: string;
  education: string;
  skills: string[];
  experiences: Experience[];
};

export type Resume = {
  id: number;
  name: string;
  targetRole: string;
  content: ResumeData;
  updatedAt: string;
};

export type InterviewReview = {
  id: number;
  date: string;
  role: string;
  mode: string;
  question: string;
  answer: string;
  feedback: string;
};

export type CoachItem = {
  name: string;
  reason: string;
  action: string;
};

export type CoachResult = {
  title: string;
  summary: string;
  items: CoachItem[];
  tags: string[];
};

export type AiNote = {
  id: number;
  date: string;
  kind: "daily" | "job" | "resume" | "interview" | "log";
  title: string;
  summary: string;
  actions: string[];
  tags: string[];
  source: "deepseek" | "local";
};

export type AppSettings = {
  internshipReminder: boolean;
  deepseekApiKey: string;
  deepseekModel: "deepseek-v4-flash" | "deepseek-v4-pro";
  deepseekThinking: boolean;
  candidateProfile: string;
  targetRoles: string;
  aiPreference: string;
};

export type AppData = {
  jobs: Job[];
  todos: Todo[];
  logs: Log[];
  resume: Resume;
  interviewReviews: InterviewReview[];
  aiNotes: AiNote[];
  settings: AppSettings;
};
