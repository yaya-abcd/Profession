import type { AppData, AppSettings } from "../data/types";

type Message = { role: "system" | "user" | "assistant"; content: string };

export function hasDeepSeek(settings: AppSettings) {
  return Boolean(settings.deepseekApiKey?.trim());
}

export function careerContext(data: AppData) {
  const openTodos = data.todos.filter((todo) => todo.status === "todo").slice(0, 8);
  const recentLogs = data.logs.slice(0, 8).map((log) => ({
    date: log.date,
    bullet: log.result.bullet,
    abilities: log.result.abilities
  }));
  const jobs = data.jobs.slice(0, 12).map((job) => ({
    company: job.company,
    role: job.role,
    category: job.category,
    deadline: job.deadline,
    status: job.status,
    match: job.match
  }));
  return JSON.stringify({
    profile: data.settings.candidateProfile,
    targetRoles: data.settings.targetRoles,
    preference: data.settings.aiPreference,
    resumeTarget: data.resume.targetRole,
    resumeSkills: data.resume.content.skills,
    openTodos,
    jobs,
    recentLogs,
    interviewReviews: data.interviewReviews.slice(0, 5).map((review) => ({
      date: review.date,
      role: review.role,
      mode: review.mode,
      feedback: review.feedback
    }))
  });
}

export async function deepSeekJSON<T>(
  settings: AppSettings,
  system: string,
  user: string,
  fallback: () => T,
  schemaHint = ""
): Promise<{ data: T; provider: "deepseek" | "local"; error?: string }> {
  const apiKey = settings.deepseekApiKey?.trim();
  if (!apiKey) return { data: fallback(), provider: "local", error: "missing_api_key" };

  try {
    const messages: Message[] = [
      { role: "system", content: `${system}\n必须只返回有效 JSON，不要使用 Markdown 代码块。${schemaHint}` },
      { role: "user", content: user }
    ];
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        model: settings.deepseekModel || "deepseek-v4-flash",
        messages,
        temperature: 0.2,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        thinking: { type: settings.deepseekThinking ? "enabled" : "disabled" }
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || payload.error || `deepseek_${response.status}`);
    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new Error("empty_response");
    return { data: JSON.parse(text) as T, provider: "deepseek" };
  } catch (error) {
    return { data: fallback(), provider: "local", error: error instanceof Error ? error.message : "deepseek_error" };
  }
}
