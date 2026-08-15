import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { clearAppData, defaultData, loadAppData, parseImportedData, saveAppData, serializeData } from "./src/data/storage";
import type { AiNote, Analysis, AppData, Experience, InterviewReview, Job, JobCategory, Log, ResumeData, Todo } from "./src/data/types";
import { colors, radius } from "./src/theme";
import { nowIso, nextId, todayLabel, weekdayLabel } from "./src/utils/date";
import { dashboardInsight, generateInterview, parseJobsFromText, planTodos, resumeFromLogs, reviewAnswer } from "./src/utils/localCoach";
import { careerContext, deepSeekJSON, hasDeepSeek } from "./src/utils/deepseek";
import { analyzeExperience } from "./src/utils/star";

const coverImage = require("./assets/cover.png");

type TabKey = "home" | "todos" | "jobs" | "resumes" | "interviews" | "timeline" | "logs" | "settings";

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "home", label: "总览", icon: "⌂" },
  { key: "todos", label: "To Do", icon: "✓" },
  { key: "jobs", label: "岗位", icon: "◎" },
  { key: "resumes", label: "简历", icon: "▤" },
  { key: "interviews", label: "面试", icon: "◉" },
  { key: "logs", label: "日志", icon: "✦" }
];

const jobCategories: Array<"全部" | JobCategory> = ["全部", "泛体制", "互联网大厂", "出海企业", "制造业", "外企", "其他"];
const jobStatuses = ["待核实", "待投递", "已投递", "笔试", "面试", "Offer", "放弃"];

const timeline = [
  ["现在至8月", "定位与素材", "完成母版简历、3类岗位画像，盘点实习成果"],
  ["8至10月", "秋招主战场", "提前批/正式批集中投递；每周复盘转化率"],
  ["11至12月", "补录与复盘", "跟进补录，补齐案例、项目和面试短板"],
  ["2027年2至4月", "春招主战场", "春招、国央企补录与事业单位机会"],
  ["2027年5至6月", "毕业前收口", "比较 Offer、背调签约、入职准备"]
];

export default function App() {
  const [data, setData] = useState<AppData>(defaultData);
  const [active, setActive] = useState<TabKey>("home");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("");
  const [remindedOn, setRemindedOn] = useState("");

  useEffect(() => {
    loadAppData().then((saved) => {
      setData(saved);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded || !data.settings.internshipReminder) return;
    const now = new Date();
    const weekday = now.getDay() >= 1 && now.getDay() <= 5;
    const today = todayLabel(now);
    if (weekday && now.getHours() >= 18 && remindedOn !== today) {
      setRemindedOn(today);
      Alert.alert("该记录今天的实习日志了", "花 5 分钟写下零散事项，App 会帮你整理成 STAR 经历。");
    }
  }, [loaded, data.settings.internshipReminder, remindedOn]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 2200);
  }

  function commit(updater: (current: AppData) => AppData) {
    setData((current) => {
      const next = updater(current);
      saveAppData(next).catch(() => flash("本地保存失败，请稍后重试"));
      return next;
    });
  }

  function resetData() {
    Alert.alert("清空本地数据", "这会删除本机保存的岗位、任务、日志、简历和面试记录。", [
      { text: "取消", style: "cancel" },
      {
        text: "清空",
        style: "destructive",
        onPress: () => {
          clearAppData().then(() => {
            setData(defaultData);
            flash("本地数据已清空");
          });
        }
      }
    ]);
  }

  const screen = {
    home: <HomeScreen data={data} jump={setActive} commit={commit} flash={flash} />,
    todos: <TodosScreen data={data} commit={commit} flash={flash} />,
    jobs: <JobsScreen data={data} commit={commit} flash={flash} />,
    resumes: <ResumeScreen data={data} commit={commit} flash={flash} />,
    interviews: <InterviewsScreen data={data} commit={commit} flash={flash} />,
    timeline: <TimelineScreen flash={flash} />,
    logs: <LogsScreen data={data} commit={commit} flash={flash} />,
    settings: <SettingsScreen data={data} commit={commit} flash={flash} resetData={resetData} />
  }[active];

  if (!loaded) {
    return (
      <ImageBackground source={coverImage} style={styles.loadingCover}>
        <View style={styles.loadingMask}>
          <Text style={styles.loadingTitle}>生涯舵手</Text>
          <Text style={styles.loadingSubtitle}>本地求职工作台正在启动</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.app}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.dateText}>{todayLabel()} · {weekdayLabel()}</Text>
            <Text style={styles.appTitle}>生涯舵手</Text>
          </View>
          <Pressable style={styles.settingsButton} onPress={() => setActive("settings")}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>
        <View style={styles.screen}>{screen}</View>
        <BottomNav active={active} onChange={setActive} />
      </KeyboardAvoidingView>
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>✓ {toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function HomeScreen({ data, jump, commit, flash }: { data: AppData; jump: (key: TabKey) => void; commit: ScreenProps["commit"]; flash: (message: string) => void }) {
  const insight = dashboardInsight(data.jobs, data.todos, data.logs, data.interviewReviews);
  const doneToday = data.todos.filter((todo) => todo.date === todayLabel() && todo.status === "done").length;
  const todayTodos = data.todos.filter((todo) => todo.date === todayLabel()).length;
  const readiness = Math.min(98, 28 + data.jobs.length * 5 + data.logs.length * 4 + data.interviewReviews.length * 3 + doneToday * 4);
  const latestNote = data.aiNotes[0];

  function generateLocalBrief() {
    const local = localDailyBrief(data);
    const note: AiNote = {
      id: nextId(),
      date: todayLabel(),
      kind: "daily",
      source: "local",
      ...local
    };
    commit((current) => ({ ...current, aiNotes: [note, ...current.aiNotes].slice(0, 50) }));
    flash("已生成本地作战简报");
  }

  async function generateDailyBrief() {
    if (!hasDeepSeek(data.settings)) return flash("请先在设置里配置 DeepSeek API Key");
    const fallback = () => localDailyBrief(data);
    const result = await deepSeekJSON<Omit<AiNote, "id" | "date" | "kind" | "source">>(
      data.settings,
      "你是一个严谨的个人求职 Copilot。请综合用户画像、岗位、To Do、日志、简历和面试复盘，生成今天最应该做的作战简报。建议必须具体、可执行，不编造用户经历或外部事实。",
      careerContext(data),
      fallback,
      "返回 JSON：{title:string,summary:string,actions:string[],tags:string[]}"
    );
    const note: AiNote = {
      id: nextId(),
      date: todayLabel(),
      kind: "daily",
      source: result.provider,
      title: result.data.title || "今日作战简报",
      summary: result.data.summary || "已生成今日建议。",
      actions: result.data.actions || [],
      tags: result.data.tags || []
    };
    commit((current) => ({ ...current, aiNotes: [note, ...current.aiNotes].slice(0, 50) }));
    flash(result.provider === "deepseek" ? "DeepSeek 已生成今日作战简报" : "DeepSeek 失败，已本地兜底");
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <ImageBackground source={coverImage} imageStyle={styles.heroImage} style={styles.hero}>
        <View style={styles.heroShade}>
          <Text style={styles.eyebrow}>2027 届秋招 · 本地工作台</Text>
          <Text style={styles.heroTitle}>晚上好，今天也离理想 Offer 更近一步。</Text>
          <Text style={styles.heroCopy}>岗位、任务、日志、简历和面试记录全部保存在这台手机上。</Text>
          <Pressable style={styles.heroButton} onPress={() => jump("timeline")}>
            <Text style={styles.heroButtonText}>查看招聘时间线</Text>
          </Pressable>
        </View>
      </ImageBackground>

      <View style={styles.statsGrid}>
        <Stat label="准备度" value={`${readiness}%`} tone="teal" />
        <Stat label="岗位池" value={String(data.jobs.length)} tone="violet" />
        <Stat label="已投递" value={String(insight.submitted)} tone="coral" />
        <Stat label="今日完成" value={`${doneToday}/${todayTodos}`} tone="green" />
      </View>

      <Card>
        <SectionTitle title="今日聚焦" caption="综合紧急度与简历价值给你排序" />
        {data.todos.filter((todo) => todo.status === "todo").slice(0, 3).map((todo) => (
          <ListRow key={todo.id} title={todo.title} detail={todo.detail || "尚未补充背景"} tag="待完成" />
        ))}
        {!data.todos.some((todo) => todo.status === "todo") ? <Empty text="今天还没有待办。先写下一件最重要的事。" /> : null}
        <Pressable style={styles.primaryButton} onPress={() => jump("todos")}>
          <Text style={styles.primaryButtonText}>打开今日 To Do</Text>
        </Pressable>
      </Card>

      <Card>
        <SectionTitle title="AI 作战简报" caption={hasDeepSeek(data.settings) ? "DeepSeek 已配置，可综合全部本地数据" : "DeepSeek 未配置，可先用本地简报"} />
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryButton} onPress={generateLocalBrief}>
            <Text style={styles.secondaryButtonText}>本地简报</Text>
          </Pressable>
          <Pressable style={styles.primaryButtonSmall} onPress={generateDailyBrief}>
            <Text style={styles.primaryButtonText}>DeepSeek 简报</Text>
          </Pressable>
        </View>
        {latestNote ? <AiNoteCard note={latestNote} /> : <Empty text="生成后，这里会沉淀每天的 AI 建议，方便回看。" />}
      </Card>

      <Card>
        <SectionTitle title="AI 建议库" caption={`${data.aiNotes.length} 条历史建议，全部保存在本机`} />
        {data.aiNotes.slice(0, 4).map((note) => <AiNoteCard key={note.id} note={note} />)}
        {!data.aiNotes.length ? <Empty text="还没有建议记录。先生成一次作战简报或岗位策略。" /> : null}
      </Card>

      <View style={styles.quickGrid}>
        <Quick title="岗位情报" detail="导入、筛选、跟进投递" icon="◎" onPress={() => jump("jobs")} />
        <Quick title="简历工坊" detail="从日志生成一页简历" icon="▤" onPress={() => jump("resumes")} />
        <Quick title="面试训练" detail="模拟题与回答复盘" icon="◉" onPress={() => jump("interviews")} />
        <Quick title="实习日志" detail="STAR 经历沉淀" icon="✦" onPress={() => jump("logs")} />
      </View>

      <Card>
        <SectionTitle title="你的招聘时间线" caption="以秋招为主线，兼顾春招和毕业前收口" />
        {timeline.slice(0, 3).map(([date, title, desc], index) => (
          <TimelineRow key={title} index={index} date={date} title={title} desc={desc} active={index === 1} />
        ))}
      </Card>
    </ScrollView>
  );
}

function TodosScreen({ data, commit, flash }: ScreenProps) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [coach, setCoach] = useState<ReturnType<typeof planTodos> | null>(null);
  const todayTodos = data.todos.filter((todo) => todo.date === todayLabel());

  function addTodo() {
    if (!title.trim()) return flash("先写下今天要完成的事项");
    const todo: Todo = {
      id: nextId(),
      date: todayLabel(),
      title: title.trim(),
      detail: detail.trim(),
      status: "todo",
      resumeRelevant: false,
      createdAt: nowIso()
    };
    commit((current) => ({ ...current, todos: [todo, ...current.todos] }));
    setTitle("");
    setDetail("");
    flash("已加入今天的清单");
  }

  function updateTodo(todo: Todo, patch: Partial<Todo>) {
    commit((current) => ({ ...current, todos: current.todos.map((item) => (item.id === todo.id ? { ...item, ...patch } : item)) }));
  }

  function turnIntoExperience(todo: Todo) {
    const source = `今天完成了：${todo.title}\n具体过程：${todo.detail || "待补充"}`;
    const result = analyzeExperience(source);
    const log: Log = { id: nextId(), date: todayLabel(), content: source, result, createdAt: nowIso() };
    commit((current) => ({
      ...current,
      logs: [log, ...current.logs],
      todos: current.todos.map((item) => (item.id === todo.id ? { ...item, resumeRelevant: true } : item))
    }));
    flash("已转为经历素材，并完成 STAR 提炼");
  }

  async function planWithDeepSeek() {
    if (!todayTodos.length) return flash("先加入至少一项 To Do");
    if (!hasDeepSeek(data.settings)) return flash("请先在设置里配置 DeepSeek API Key");
    const result = await deepSeekJSON<ReturnType<typeof planTodos>>(
      data.settings,
      "你是求职与实习效率教练。根据任务的紧急度、重要度、依赖关系和简历价值排序。缺少截止时间时明确提示待确认。",
      JSON.stringify(todayTodos),
      () => planTodos(todayTodos),
      "返回 JSON：{title:string,summary:string,items:[{name:string,reason:string,action:string}],tags:string[]}"
    );
    setCoach(result.data);
    flash(result.provider === "deepseek" ? "DeepSeek 已排好今日优先级" : "已使用本地规则排优先级");
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <PageHeading title="今日 To Do" caption="先完成真实工作，再把有价值的行动沉淀成简历证据。" />
      <Card>
        <Field label="今天要完成什么？" value={title} onChangeText={setTitle} placeholder="例如：完成用户反馈分析并向产品经理汇报" />
        <Field label="补充背景或预期结果" value={detail} onChangeText={setDetail} placeholder="为什么要做、影响谁、希望产生什么结果" multiline />
        <Pressable style={styles.primaryButton} onPress={addTodo}>
          <Text style={styles.primaryButtonText}>＋ 加入今日清单</Text>
        </Pressable>
      </Card>

      <Card>
        <SectionTitle title="今日规划" caption="优先使用 DeepSeek；未配置或失败时自动使用本地规则" />
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryButton} onPress={() => setCoach(planTodos(todayTodos))}>
            <Text style={styles.secondaryButtonText}>本地排序</Text>
          </Pressable>
          <Pressable style={styles.primaryButtonSmall} onPress={planWithDeepSeek}>
            <Text style={styles.primaryButtonText}>DeepSeek 排序</Text>
          </Pressable>
        </View>
        {coach?.items.map((item) => <Advice key={item.name} item={item} />)}
      </Card>

      <Card>
        <SectionTitle title="今天的行动" caption={`${todayTodos.filter((x) => x.status === "done").length}/${todayTodos.length} 已完成`} />
        {todayTodos.map((todo) => (
          <View key={todo.id} style={[styles.todoItem, todo.status === "done" && styles.doneItem]}>
            <Pressable style={styles.check} onPress={() => updateTodo(todo, { status: todo.status === "done" ? "todo" : "done" })}>
              <Text style={styles.checkText}>{todo.status === "done" ? "✓" : ""}</Text>
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{todo.title}</Text>
              <Text style={styles.rowDetail}>{todo.detail || "尚未补充背景"}</Text>
              <Text style={styles.smallMuted}>{todo.date}</Text>
              {todo.status === "done" ? (
                <Pressable style={styles.linkButton} onPress={() => turnIntoExperience(todo)}>
                  <Text style={styles.linkButtonText}>{todo.resumeRelevant ? "✓ 已进入经历库" : "✦ 转为简历素材"}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
        {!todayTodos.length ? <Empty text="今天还没有任务。先写下一件最重要的事。" /> : null}
      </Card>

      <Card>
        <SectionTitle title="经历价值识别" caption="什么样的 To Do 值得写进简历？" />
        {[
          ["产生结果", "带来增长、提效、降本或按期交付"],
          ["体现判断", "你分析信息并做出了选择"],
          ["影响他人", "协调了团队、客户或跨部门资源"],
          ["可以量化", "有数量、比例、时间或范围证据"]
        ].map(([name, desc]) => <ListRow key={name} title={name} detail={desc} tag="✓" />)}
      </Card>
    </ScrollView>
  );
}

function JobsScreen({ data, commit, flash }: ScreenProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"全部" | JobCategory>("全部");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [paste, setPaste] = useState("");
  const [parsed, setParsed] = useState<Job[]>([]);
  const [draft, setDraft] = useState<Job>({
    id: 0,
    company: "",
    role: "",
    category: "其他",
    tier: "待评估",
    deadline: "待确认",
    match: 0,
    status: "待核实",
    companyIntro: "",
    requirements: "",
    sourceUrl: "",
    createdAt: ""
  });

  const shown = data.jobs.filter((job) => {
    const text = `${job.company}${job.role}${job.requirements}`.toLowerCase();
    return (filter === "全部" || job.category === filter) && text.includes(query.toLowerCase());
  });

  function saveJobs(rows: Job[]) {
    const normalized = rows.map((row) => ({ ...row, id: row.id || nextId(), createdAt: row.createdAt || nowIso() }));
    commit((current) => ({ ...current, jobs: [...normalized, ...current.jobs] }));
    setShowAdd(false);
    setShowImport(false);
    setParsed([]);
    setPaste("");
    setDraft({ ...draft, id: 0, company: "", role: "", companyIntro: "", requirements: "", sourceUrl: "" });
    flash(`已保存 ${normalized.length} 个岗位`);
  }

  function parsePaste() {
    if (!paste.trim()) return flash("请先粘贴招聘消息");
    const rows = parseJobsFromText(paste);
    setParsed(rows);
    flash("已按本地规则拆分，请核对后保存");
  }

  function updateJob(job: Job, patch: Partial<Job>) {
    commit((current) => ({ ...current, jobs: current.jobs.map((item) => item.id === job.id ? { ...item, ...patch } : item) }));
  }

  function applyJobStrategy(job: Job, dataSource: "deepseek" | "local", payload: { strategy: string; match?: number; actions?: string[]; risks?: string[] }) {
    const strategy = [
      payload.strategy,
      payload.actions?.length ? `下一步：${payload.actions.join("；")}` : "",
      payload.risks?.length ? `风险：${payload.risks.join("；")}` : ""
    ].filter(Boolean).join("\n");
    const note: AiNote = {
      id: nextId(),
      date: todayLabel(),
      kind: "job",
      source: dataSource,
      title: `${job.company} · ${job.role}`,
      summary: strategy,
      actions: payload.actions || [],
      tags: [job.category, dataSource === "deepseek" ? "DeepSeek" : "本地规则"]
    };
    commit((current) => ({
      ...current,
      jobs: current.jobs.map((item) => item.id === job.id ? { ...item, strategy, match: Number(payload.match ?? item.match ?? 0), strategyUpdatedAt: nowIso() } : item),
      aiNotes: [note, ...current.aiNotes].slice(0, 50)
    }));
  }

  function generateLocalJobStrategy(job: Job) {
    applyJobStrategy(job, "local", localJobStrategy(data, job));
    flash("已生成本地岗位策略");
  }

  async function generateJobStrategy(job: Job) {
    if (!hasDeepSeek(data.settings)) return flash("请先在设置里配置 DeepSeek API Key");
    const result = await deepSeekJSON<{ strategy: string; match?: number; actions?: string[]; risks?: string[] }>(
      data.settings,
      "你是校招岗位策略顾问。请基于用户画像、简历、日志、待办和这个岗位，给出投递策略。不得虚构经历；缺口要明确写待补充。",
      JSON.stringify({ context: careerContext(data), job }),
      () => localJobStrategy(data, job),
      "返回 JSON：{strategy:string,match:number,actions:string[],risks:string[]}"
    );
    applyJobStrategy(job, result.provider, result.data);
    flash(result.provider === "deepseek" ? "DeepSeek 已生成岗位策略" : "DeepSeek 失败，已本地兜底");
  }

  async function parsePasteWithDeepSeek() {
    if (!paste.trim()) return flash("请先粘贴招聘消息");
    if (!hasDeepSeek(data.settings)) return flash("请先在设置里配置 DeepSeek API Key");
    const result = await deepSeekJSON<{ jobs: Array<Partial<Job>> }>(
      data.settings,
      "你是校招岗位情报整理员。只从用户提供的群聊文字中提取事实，绝不虚构公司、截止日期、链接或要求。缺失字段写待确认。",
      paste,
      () => ({ jobs: parseJobsFromText(paste) }),
      "返回 JSON：{jobs:[{company,role,category,tier,deadline,match,status,companyIntro,requirements,sourceUrl}]}"
    );
    const rows = (result.data.jobs || []).map((job, index) => ({
      id: nextId() + index,
      company: String(job.company || "待确认公司"),
      role: String(job.role || "待确认岗位"),
      category: jobCategories.slice(1).includes(job.category as JobCategory) ? job.category as JobCategory : "其他",
      tier: String(job.tier || "待评估"),
      deadline: String(job.deadline || "待确认"),
      match: Number(job.match || 0),
      status: String(job.status || "待核实"),
      companyIntro: String(job.companyIntro || "待补充（原信息未提供）"),
      requirements: String(job.requirements || ""),
      sourceUrl: String(job.sourceUrl || ""),
      createdAt: nowIso()
    }));
    setParsed(rows);
    flash(result.provider === "deepseek" ? "DeepSeek 已拆分岗位，请核对" : "已使用本地规则拆分");
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <PageHeading title="岗位情报工作坊" caption="粘贴招聘消息或手动添加，缺失信息会标记为待确认。" />
      <View style={styles.inlineActions}>
        <Pressable style={styles.secondaryButton} onPress={() => setShowImport(true)}>
          <Text style={styles.secondaryButtonText}>粘贴群消息</Text>
        </Pressable>
        <Pressable style={styles.primaryButtonSmall} onPress={() => setShowAdd(true)}>
          <Text style={styles.primaryButtonText}>＋ 手动添加</Text>
        </Pressable>
      </View>

      <Card>
        <Field label="搜索公司或岗位" value={query} onChangeText={setQuery} placeholder="例如：产品经理、SHEIN、管培生" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {jobCategories.map((item) => (
            <Pressable key={item} style={[styles.chip, filter === item && styles.chipActive]} onPress={() => setFilter(item)}>
              <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Card>

      {shown.map((job) => (
        <Card key={job.id}>
          <View style={styles.jobTop}>
            <View style={styles.companyLogo}><Text style={styles.companyLogoText}>{job.company.slice(0, 1) || "职"}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{job.company}</Text>
              <Text style={styles.rowDetail}>{job.role}</Text>
            </View>
            <Pill label={job.category} tone="teal" />
          </View>
          <Text style={styles.paragraph}>{job.companyIntro || "待补充公司介绍"}</Text>
          <View style={styles.metaGrid}>
            <Meta label="截止时间" value={job.deadline} />
            <Meta label="状态" value={job.status} />
            <Meta label="层级" value={job.tier} />
            <Meta label="匹配度" value={`${job.match || 0}%`} />
          </View>
          {job.requirements ? <Text style={styles.noteBox}>{job.requirements}</Text> : null}
          {job.strategy ? <Text style={styles.strategyBox}>{job.strategy}</Text> : null}
          <Text style={styles.fieldLabel}>投递状态</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {jobStatuses.map((status) => (
              <Pressable key={status} style={[styles.chip, job.status === status && styles.chipActive]} onPress={() => updateJob(job, { status })}>
                <Text style={[styles.chipText, job.status === status && styles.chipTextActive]}>{status}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inlineActions}>
            <Pressable style={styles.secondaryButton} onPress={() => generateLocalJobStrategy(job)}>
              <Text style={styles.secondaryButtonText}>本地策略</Text>
            </Pressable>
            <Pressable style={styles.primaryButtonSmall} onPress={() => generateJobStrategy(job)}>
              <Text style={styles.primaryButtonText}>DeepSeek 策略</Text>
            </Pressable>
          </View>
          {job.sourceUrl ? (
            <Pressable style={styles.linkButton} onPress={() => Linking.openURL(job.sourceUrl)}>
              <Text style={styles.linkButtonText}>打开信息来源 →</Text>
            </Pressable>
          ) : <Text style={styles.smallMuted}>来源链接待补充，请投递前核实</Text>}
        </Card>
      ))}
      {!shown.length ? <Empty text="岗位库还是空的。粘贴招聘消息或手动添加后，这里会出现真实岗位。" /> : null}

      <Modal visible={showAdd || showImport} animationType="slide" onRequestClose={() => { setShowAdd(false); setShowImport(false); }}>
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.scrollPad}>
            <Pressable style={styles.closeButton} onPress={() => { setShowAdd(false); setShowImport(false); }}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
            {showImport ? (
              <>
                <PageHeading title="批量导入岗位" caption="把群聊招聘消息完整粘贴进来；DeepSeek 会结构化提取，未配置 Key 时使用本地规则。" />
                <Field label="招聘消息" value={paste} onChangeText={setPaste} placeholder="公司｜岗位｜截止时间｜要求｜链接" multiline />
                <View style={styles.inlineActions}>
                  <Pressable style={styles.secondaryButton} onPress={parsePaste}>
                    <Text style={styles.secondaryButtonText}>本地拆分</Text>
                  </Pressable>
                  <Pressable style={styles.primaryButtonSmall} onPress={parsePasteWithDeepSeek}>
                    <Text style={styles.primaryButtonText}>DeepSeek 拆分</Text>
                  </Pressable>
                </View>
                {parsed.map((job) => <ListRow key={job.id} title={`${job.company} · ${job.role}`} detail={`${job.category}｜${job.deadline}`} tag="待核实" />)}
                {parsed.length ? (
                  <Pressable style={styles.primaryButton} onPress={() => saveJobs(parsed)}>
                    <Text style={styles.primaryButtonText}>确认并全部存入岗位库</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                <PageHeading title="手动添加岗位" caption="公司和岗位为必填，其余信息可之后补齐。" />
                <Field label="公司名称" value={draft.company} onChangeText={(company) => setDraft({ ...draft, company })} />
                <Field label="岗位名称" value={draft.role} onChangeText={(role) => setDraft({ ...draft, role })} />
                <Text style={styles.fieldLabel}>岗位分类</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {jobCategories.slice(1).map((item) => (
                    <Pressable key={item} style={[styles.chip, draft.category === item && styles.chipActive]} onPress={() => setDraft({ ...draft, category: item as JobCategory })}>
                      <Text style={[styles.chipText, draft.category === item && styles.chipTextActive]}>{item}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Field label="截止时间" value={draft.deadline} onChangeText={(deadline) => setDraft({ ...draft, deadline })} />
                <Field label="匹配度" value={String(draft.match || "")} onChangeText={(match) => setDraft({ ...draft, match: Number(match.replace(/[^\d]/g, "")) || 0 })} keyboardType="numeric" />
                <Field label="公司介绍" value={draft.companyIntro} onChangeText={(companyIntro) => setDraft({ ...draft, companyIntro })} multiline />
                <Field label="岗位要求" value={draft.requirements} onChangeText={(requirements) => setDraft({ ...draft, requirements })} multiline />
                <Field label="原始链接" value={draft.sourceUrl} onChangeText={(sourceUrl) => setDraft({ ...draft, sourceUrl })} />
                <Pressable style={styles.primaryButton} onPress={() => draft.company && draft.role ? saveJobs([{ ...draft, id: nextId(), createdAt: nowIso() }]) : flash("请填写公司和岗位")}>
                  <Text style={styles.primaryButtonText}>保存岗位</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

function ResumeScreen({ data, commit, flash }: ScreenProps) {
  const resume = data.resume;

  function updateContent(patch: Partial<ResumeData>) {
    commit((current) => ({ ...current, resume: { ...current.resume, content: { ...current.resume.content, ...patch }, updatedAt: nowIso() } }));
  }

  function updateExperience(index: number, patch: Partial<Experience>) {
    const experiences = resume.content.experiences.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item));
    updateContent({ experiences });
  }

  function generateDraft() {
    const generated = resumeFromLogs(data.logs, resume.targetRole);
    updateContent(generated);
    flash(data.logs.length ? "已从实习日志生成简历初稿" : "还没有日志，已保留空模板");
  }

  async function generateDraftWithDeepSeek() {
    if (!data.logs.length) return flash("还没有实习日志，请先记录经历再生成");
    if (!hasDeepSeek(data.settings)) return flash("请先在设置里配置 DeepSeek API Key");
    const result = await deepSeekJSON<Pick<ResumeData, "summary" | "skills" | "experiences">>(
      data.settings,
      "你是中文校招简历专家。把实习日志整理为一页简历素材，严格基于事实；不得虚构数字、公司、职责或结果；缺失信息写待补充。",
      JSON.stringify({ targetRole: resume.targetRole, logs: data.logs }),
      () => resumeFromLogs(data.logs, resume.targetRole),
      "返回 JSON：{summary:string,skills:string[],experiences:[{company:string,role:string,period:string,bullets:string[]}]}"
    );
    updateContent(result.data);
    flash(result.provider === "deepseek" ? "DeepSeek 已生成简历初稿" : "已使用本地规则生成简历");
  }

  async function exportPdf() {
    const html = resumeHtml(resume.name, resume.targetRole, resume.content);
    try {
      const file = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
      else Alert.alert("PDF 已生成", file.uri);
    } catch {
      flash("PDF 生成失败，请稍后重试");
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <PageHeading title="简历工坊" caption="一份经历母库，生成不同岗位的定制简历。所有内容可编辑。" />
      <View style={styles.inlineActions}>
        <Pressable style={styles.secondaryButton} onPress={generateDraft}>
          <Text style={styles.secondaryButtonText}>本地生成</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={generateDraftWithDeepSeek}>
          <Text style={styles.secondaryButtonText}>DeepSeek 生成</Text>
        </Pressable>
        <Pressable style={styles.primaryButtonSmall} onPress={exportPdf}>
          <Text style={styles.primaryButtonText}>导出 PDF</Text>
        </Pressable>
      </View>

      <Card>
        <Field label="姓名" value={resume.name} onChangeText={(name) => commit((current) => ({ ...current, resume: { ...current.resume, name, updatedAt: nowIso() } }))} />
        <Field label="联系方式" value={resume.content.contact} onChangeText={(contact) => updateContent({ contact })} />
        <Field label="目标岗位" value={resume.targetRole} onChangeText={(targetRole) => commit((current) => ({ ...current, resume: { ...current.resume, targetRole, updatedAt: nowIso() } }))} />
        <Field label="个人优势" value={resume.content.summary} onChangeText={(summary) => updateContent({ summary })} multiline />
        <Field label="教育经历" value={resume.content.education} onChangeText={(education) => updateContent({ education })} multiline />
        <Field label="技能关键词" value={resume.content.skills.join("、")} onChangeText={(text) => updateContent({ skills: text.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) })} />
      </Card>

      <Card>
        <SectionTitle title="实习经历" caption="每行一条简历描述，标记待补充的内容投递前要核实" />
        {resume.content.experiences.map((exp, index) => (
          <View key={`${exp.company}-${index}`} style={styles.experienceEditor}>
            <Field label="公司" value={exp.company} onChangeText={(company) => updateExperience(index, { company })} />
            <Field label="岗位" value={exp.role} onChangeText={(role) => updateExperience(index, { role })} />
            <Field label="时间" value={exp.period} onChangeText={(period) => updateExperience(index, { period })} />
            <Field label="经历描述" value={exp.bullets.join("\n")} onChangeText={(text) => updateExperience(index, { bullets: text.split("\n") })} multiline />
            <Pressable style={styles.dangerButton} onPress={() => updateContent({ experiences: resume.content.experiences.filter((_, currentIndex) => currentIndex !== index) })}>
              <Text style={styles.dangerText}>删除这段经历</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.secondaryButton} onPress={() => updateContent({ experiences: [...resume.content.experiences, { company: "待补充公司", role: "待补充岗位", period: "待补充时间", bullets: ["待补充具体行动与结果"] }] })}>
          <Text style={styles.secondaryButtonText}>＋ 添加经历</Text>
        </Pressable>
      </Card>

      <Card>
        <SectionTitle title="一页简历预览" caption="导出 PDF 使用这份内容" />
        <View style={styles.paper}>
          <Text style={styles.paperName}>{resume.name}</Text>
          <Text style={styles.paperMuted}>{resume.content.contact}</Text>
          <Text style={styles.paperStrong}>求职意向：{resume.targetRole}</Text>
          <PaperBlock title="个人优势" content={resume.content.summary} />
          <PaperBlock title="教育经历" content={resume.content.education} />
          {resume.content.experiences.map((exp, index) => (
            <View key={`${exp.company}-preview-${index}`} style={styles.paperBlock}>
              <Text style={styles.paperHeading}>{exp.company} · {exp.role}</Text>
              <Text style={styles.paperMuted}>{exp.period}</Text>
              {exp.bullets.filter(Boolean).map((bullet, bulletIndex) => <Text key={bulletIndex} style={styles.paperLine}>• {bullet}</Text>)}
            </View>
          ))}
          <PaperBlock title="专业技能" content={resume.content.skills.length ? resume.content.skills.join(" · ") : "待补充"} />
        </View>
      </Card>
    </ScrollView>
  );
}

function InterviewsScreen({ data, commit, flash }: ScreenProps) {
  const [role, setRole] = useState("国际化产品经理");
  const [mode, setMode] = useState("业务面");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [coach, setCoach] = useState<ReturnType<typeof generateInterview> | null>(null);

  function generateLocal() {
    const result = generateInterview(role, mode);
    setCoach(result);
    setQuestion(result.items[0]?.name || "");
    flash("已生成本地模拟题");
  }

  async function generateWithDeepSeek() {
    if (!hasDeepSeek(data.settings)) return flash("请先在设置里配置 DeepSeek API Key");
    const result = await deepSeekJSON<ReturnType<typeof generateInterview>>(
      data.settings,
      "你是校招面试官。根据目标岗位和面试类型预测高频问题并给出回答框架。问题具体且适合校招，不虚构候选人经历。",
      JSON.stringify({ role, mode }),
      () => generateInterview(role, mode),
      "返回 JSON：{title:string,summary:string,items:[{name:string,reason:string,action:string}],tags:string[]}"
    );
    setCoach(result.data);
    setQuestion(result.data.items[0]?.name || "");
    flash(result.provider === "deepseek" ? "DeepSeek 已生成模拟题" : "已生成本地模拟题");
  }

  function saveReviewLocal() {
    if (!answer.trim()) return flash("请先输入回答");
    const review: InterviewReview = {
      id: nextId(),
      date: todayLabel(),
      role,
      mode,
      question,
      answer,
      feedback: reviewAnswer(answer)
    };
    commit((current) => ({ ...current, interviewReviews: [review, ...current.interviewReviews] }));
    setAnswer("");
    flash("面试复盘已保存");
  }

  async function saveReviewWithDeepSeek() {
    if (!answer.trim()) return flash("请先输入回答");
    if (!hasDeepSeek(data.settings)) return flash("请先在设置里配置 DeepSeek API Key");
    const result = await deepSeekJSON<{ feedback: string }>(
      data.settings,
      "你是校招面试复盘教练。只基于用户回答给出反馈，指出亮点、缺口和下一版表达建议。",
      JSON.stringify({ role, mode, question, answer }),
      () => ({ feedback: reviewAnswer(answer) }),
      "返回 JSON：{feedback:string}"
    );
    const review: InterviewReview = {
      id: nextId(),
      date: todayLabel(),
      role,
      mode,
      question,
      answer,
      feedback: result.data.feedback || reviewAnswer(answer)
    };
    commit((current) => ({ ...current, interviewReviews: [review, ...current.interviewReviews] }));
    setAnswer("");
    flash(result.provider === "deepseek" ? "DeepSeek 反馈已保存" : "本地反馈已保存");
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <PageHeading title="面试训练室" caption="预测问题、模拟回答、记录反馈与改进。" />
      <Card>
        <Text style={styles.fieldLabel}>目标岗位</Text>
        <Segment values={["国际化产品经理", "商业分析", "战略管培生"]} active={role} onChange={setRole} />
        <Text style={styles.fieldLabel}>训练模式</Text>
        <Segment values={["业务面", "行为面", "压力面"]} active={mode} onChange={setMode} />
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryButton} onPress={generateLocal}>
            <Text style={styles.secondaryButtonText}>本地题库</Text>
          </Pressable>
          <Pressable style={styles.primaryButtonSmall} onPress={generateWithDeepSeek}>
            <Text style={styles.primaryButtonText}>DeepSeek 出题</Text>
          </Pressable>
        </View>
      </Card>

      {coach ? (
        <Card>
          <SectionTitle title={coach.title} caption={coach.summary} />
          {coach.items.map((item) => (
            <Pressable key={item.name} style={[styles.advice, question === item.name && styles.adviceSelected]} onPress={() => setQuestion(item.name)}>
              <Text style={styles.adviceTitle}>{item.name}</Text>
              <Text style={styles.adviceText}>{item.action}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="回答复盘" caption={question || "先生成一道题，再输入你的回答"} />
        <Field label="你的回答" value={answer} onChangeText={setAnswer} placeholder="输入你的回答思路" multiline />
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryButton} onPress={saveReviewLocal}>
            <Text style={styles.secondaryButtonText}>本地保存</Text>
          </Pressable>
          <Pressable style={styles.primaryButtonSmall} onPress={saveReviewWithDeepSeek}>
            <Text style={styles.primaryButtonText}>DeepSeek 反馈</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <SectionTitle title="历史复盘" caption={`${data.interviewReviews.length} 条记录`} />
        {data.interviewReviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <Text style={styles.cardTitle}>{review.role}｜{review.mode}</Text>
            <Text style={styles.rowDetail}>{review.question}</Text>
            <Text style={styles.noteBox}>{review.feedback}</Text>
          </View>
        ))}
        {!data.interviewReviews.length ? <Empty text="还没有面试复盘。生成一道题并保存回答后会出现在这里。" /> : null}
      </Card>
    </ScrollView>
  );
}

function TimelineScreen({ flash }: { flash: (message: string) => void }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <PageHeading title="2027 届招聘时间线" caption="关键窗口、每阶段目标与提醒。" />
      <Card>
        {timeline.map(([date, title, desc], index) => (
          <View key={title} style={styles.timelineCard}>
            <TimelineRow index={index} date={date} title={title} desc={desc} active={index === 1} />
            <Pressable style={styles.linkButton} onPress={() => flash(`已记录“${title}”阶段提醒`)}>
              <Text style={styles.linkButtonText}>设置提醒</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function LogsScreen({ data, commit, flash }: ScreenProps) {
  const [raw, setRaw] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

  const selectedLog = data.logs.find((log) => log.id === selectedLogId);
  const reusable = selectedLog && targetRole
    ? `面向${targetCompany || "目标公司"}的${targetRole}岗位，重点突出“${selectedLog.result.abilities.join("、")}”：${selectedLog.result.bullet}（经历仍归属于原实习公司，仅调整表达重点）`
    : "";

  function runAnalysisLocal() {
    if (!raw.trim()) return flash("请先写下今天做过的零散事项");
    const result = analyzeExperience(`${raw}\n${answers.filter(Boolean).join("\n")}`);
    setAnalysis(result);
    flash("已完成本地 STAR 复盘");
  }

  async function runAnalysis() {
    if (!raw.trim()) return flash("请先写下今天做过的零散事项");
    if (!hasDeepSeek(data.settings)) return flash("请先在设置里配置 DeepSeek API Key");
    const input = `${raw}\n${answers.filter(Boolean).join("\n")}`;
    const result = await deepSeekJSON<Analysis>(
      data.settings,
      "你是一名严谨的中文职业复盘教练。只基于用户提供的事实分析，绝不虚构数字、职责、公司或结果。缺失信息明确写待补充并追问。",
      input,
      () => analyzeExperience(input),
      "返回 JSON：{situation:string,task:string,action:string,result:string,abilities:string[],questions:string[],bullet:string,patterns:string[],nextActions:string[]}"
    );
    setAnalysis(result.data);
    flash(result.provider === "deepseek" ? "DeepSeek 已完成深度复盘" : "已完成本地 STAR 复盘");
  }

  function saveLog() {
    if (!raw.trim()) return flash("请先写下今天做过的零散事项");
    const result = analysis || analyzeExperience(raw);
    const nextLog: Log = { id: editingId || nextId(), date: todayLabel(), content: raw, result, createdAt: nowIso() };
    commit((current) => ({
      ...current,
      logs: editingId ? current.logs.map((log) => (log.id === editingId ? nextLog : log)) : [nextLog, ...current.logs]
    }));
    setRaw("");
    setAnalysis(null);
    setAnswers([]);
    setEditingId(null);
    flash(editingId ? "经历已更新" : "已保存到经历库");
  }

  function edit(log: Log) {
    setRaw(log.content);
    setAnalysis(log.result);
    setEditingId(log.id);
    setAnswers([]);
    flash("已打开旧经历，可继续补充");
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <PageHeading title="实习日志与经历引擎" caption="从零散事实到 STAR 经历，再复用于不同岗位。" />
      <Card>
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryButton} onPress={() => setRaw("今天完成了：\n当时遇到的问题：\n我采取的行动：\n产生的结果：")}>
            <Text style={styles.secondaryButtonText}>使用记录模板</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => commit((current) => ({ ...current, settings: { ...current.settings, internshipReminder: !current.settings.internshipReminder } }))}
          >
            <Text style={styles.secondaryButtonText}>{data.settings.internshipReminder ? "关闭18点提醒" : "开启18点提醒"}</Text>
          </Pressable>
        </View>
        <Field label={editingId ? "补充你的新思考" : "今天发生了什么？"} value={raw} onChangeText={setRaw} placeholder="例如：整理了 80 条用户反馈，并推动方案提前 2 天游线" multiline />
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryButton} onPress={runAnalysisLocal}>
            <Text style={styles.secondaryButtonText}>本地复盘</Text>
          </Pressable>
          <Pressable style={styles.primaryButtonSmall} onPress={runAnalysis}>
            <Text style={styles.primaryButtonText}>DeepSeek 复盘</Text>
          </Pressable>
        </View>
        <Pressable style={styles.secondaryButton} onPress={saveLog}>
          <Text style={styles.secondaryButtonText}>{editingId ? "保存更新" : "保存经历"}</Text>
        </Pressable>
      </Card>

      {analysis ? (
        <Card>
          <SectionTitle title="STAR 经历草稿" caption="先还原事实，再包装表达" />
          <View style={styles.starGrid}>
            <Star label="S" title="情境" text={analysis.situation} />
            <Star label="T" title="任务" text={analysis.task} />
            <Star label="A" title="行动" text={analysis.action} />
            <Star label="R" title="结果" text={analysis.result} />
          </View>
          <Text style={styles.quote}>{analysis.bullet}</Text>
          <Text style={styles.fieldLabel}>继续回答这些问题，再复盘一轮</Text>
          {analysis.questions.map((question, index) => (
            <Field key={question} label={`${index + 1}. ${question}`} value={answers[index] || ""} onChangeText={(text) => setAnswers((old) => { const next = [...old]; next[index] = text; return next; })} multiline />
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="经历复用工作台" caption="一段真实经历，多种岗位表达" />
        <Text style={styles.fieldLabel}>选择经历</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {data.logs.map((log) => (
            <Pressable key={log.id} style={[styles.chip, selectedLogId === log.id && styles.chipActive]} onPress={() => setSelectedLogId(log.id)}>
              <Text style={[styles.chipText, selectedLogId === log.id && styles.chipTextActive]}>{log.date}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Field label="目标公司" value={targetCompany} onChangeText={setTargetCompany} placeholder="如 SHEIN" />
        <Field label="目标岗位" value={targetRole} onChangeText={setTargetRole} placeholder="如 海外运营" />
        {reusable ? <Text style={styles.noteBox}>{reusable}</Text> : <Empty text="选择经历并填写目标岗位后，会生成适配表达。" />}
      </Card>

      <Card>
        <SectionTitle title="经历素材库" caption={`${data.logs.length} 条，可反复补充和重新复盘`} />
        {data.logs.map((log) => (
          <View key={log.id} style={styles.logCard}>
            <Text style={styles.smallMuted}>{log.date}</Text>
            <Text style={styles.rowTitle}>{log.result.bullet}</Text>
            <View style={styles.tagWrap}>{log.result.abilities.map((item) => <Pill key={item} label={item} tone="violet" />)}</View>
            <Pressable style={styles.linkButton} onPress={() => edit(log)}>
              <Text style={styles.linkButtonText}>继续编辑</Text>
            </Pressable>
          </View>
        ))}
        {!data.logs.length ? <Empty text="还没有经历素材。今天先记录一件真实完成的事。" /> : null}
      </Card>
    </ScrollView>
  );
}

function SettingsScreen({ data, commit, flash, resetData }: ScreenProps & { resetData: () => void }) {
  const [importText, setImportText] = useState("");
  const [deepseekApiKey, setDeepseekApiKey] = useState(data.settings.deepseekApiKey || "");
  const [deepseekModel, setDeepseekModel] = useState<string>(data.settings.deepseekModel || "deepseek-v4-flash");
  const [candidateProfile, setCandidateProfile] = useState(data.settings.candidateProfile || "");
  const [targetRoles, setTargetRoles] = useState(data.settings.targetRoles || "");
  const [aiPreference, setAiPreference] = useState(data.settings.aiPreference || "");

  async function exportData() {
    await Share.share({ message: serializeData(data), title: "生涯舵手本地数据备份" });
  }

  function importData() {
    const parsed = parseImportedData(importText);
    if (!parsed) return flash("导入失败，请粘贴完整 JSON 备份");
    commit(() => parsed);
    setImportText("");
    flash("本地数据已导入");
  }

  function saveDeepSeekSettings() {
    commit((current) => ({
      ...current,
      settings: {
        ...current.settings,
        deepseekApiKey: deepseekApiKey.trim(),
        deepseekModel: deepseekModel as "deepseek-v4-flash" | "deepseek-v4-pro",
        candidateProfile: candidateProfile.trim(),
        targetRoles: targetRoles.trim(),
        aiPreference: aiPreference.trim()
      }
    }));
    flash("AI 设置已保存");
  }

  async function testDeepSeek() {
    const settings = { ...data.settings, deepseekApiKey: deepseekApiKey.trim(), deepseekModel: deepseekModel as "deepseek-v4-flash" | "deepseek-v4-pro" };
    if (!hasDeepSeek(settings)) return flash("请先填写 DeepSeek API Key");
    const result = await deepSeekJSON<{ ok: boolean; message: string }>(
      settings,
      "你是连接测试助手。",
      "返回 JSON：{\"ok\":true,\"message\":\"连接正常\"}",
      () => ({ ok: false, message: "本地规则可用，DeepSeek 未连通" }),
      "返回 JSON：{ok:boolean,message:string}"
    );
    flash(result.provider === "deepseek" && result.data.ok ? "DeepSeek 连接正常" : result.data.message || "DeepSeek 未连通");
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <PageHeading title="设置与数据" caption="所有数据只保存在当前手机。换机前请先导出备份。" />
      <Card>
        <ListRow title="本地数据" detail="岗位、任务、日志、简历和面试复盘均存储在手机本地。" tag="离线" />
        <ListRow title="AI 当前模式" detail={hasDeepSeek(data.settings) ? "DeepSeek 已配置。点击 DeepSeek 按钮会联网生成；本地按钮仍可离线使用。" : "DeepSeek 未配置。DeepSeek 按钮会提示配置，本地按钮可继续使用。"} tag={hasDeepSeek(data.settings) ? "DeepSeek" : "本地"} />
        <ListRow title="DeepSeek API" detail="Key 只保存在手机本地，不写入源码；换机前请导出本地数据备份。" tag={hasDeepSeek(data.settings) ? "已配置" : "未配置"} />
        <Field label="我的求职画像" value={candidateProfile} onChangeText={setCandidateProfile} placeholder="例如：2027届，本科/硕士，目标城市、行业、优势和限制" multiline />
        <Field label="目标岗位" value={targetRoles} onChangeText={setTargetRoles} placeholder="例如：产品经理、商业分析、海外运营" />
        <Field label="AI 输出偏好" value={aiPreference} onChangeText={setAiPreference} placeholder="例如：建议要具体，不编造经历，多提醒我补充证据" multiline />
        <Field label="DeepSeek API Key" value={deepseekApiKey} onChangeText={setDeepseekApiKey} placeholder="sk-..." secureTextEntry />
        <Text style={styles.fieldLabel}>DeepSeek 模型</Text>
        <Segment values={["deepseek-v4-flash", "deepseek-v4-pro"]} active={deepseekModel} onChange={setDeepseekModel} />
        <View style={styles.inlineActions}>
          <Pressable style={styles.secondaryButton} onPress={saveDeepSeekSettings}>
            <Text style={styles.secondaryButtonText}>保存 DeepSeek</Text>
          </Pressable>
          <Pressable style={styles.primaryButtonSmall} onPress={testDeepSeek}>
            <Text style={styles.primaryButtonText}>测试连接</Text>
          </Pressable>
        </View>
        <ListRow title="18点实习日志提醒" detail="工作日 18:00 后打开 App 会提醒记录实习日志。" tag={data.settings.internshipReminder ? "已开" : "关闭"} />
        <Pressable style={styles.secondaryButton} onPress={() => commit((current) => ({ ...current, settings: { ...current.settings, internshipReminder: !current.settings.internshipReminder } }))}>
          <Text style={styles.secondaryButtonText}>{data.settings.internshipReminder ? "关闭提醒" : "开启提醒"}</Text>
        </Pressable>
      </Card>
      <Card>
        <SectionTitle title="备份与迁移" caption="免费方案不使用服务器，建议定期导出 JSON 备份。" />
        <Pressable style={styles.primaryButton} onPress={exportData}>
          <Text style={styles.primaryButtonText}>导出本地数据</Text>
        </Pressable>
        <Field label="导入 JSON 备份" value={importText} onChangeText={setImportText} placeholder="粘贴导出的 JSON 内容" multiline />
        <Pressable style={styles.secondaryButton} onPress={importData}>
          <Text style={styles.secondaryButtonText}>导入备份</Text>
        </Pressable>
      </Card>
      <Card>
        <SectionTitle title="危险操作" caption="清空后无法恢复，除非你已经导出备份。" />
        <Pressable style={styles.dangerButton} onPress={resetData}>
          <Text style={styles.dangerText}>清空本机数据</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

type ScreenProps = {
  data: AppData;
  commit: (updater: (current: AppData) => AppData) => void;
  flash: (message: string) => void;
};

function BottomNav({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  return (
    <View style={styles.nav}>
      {tabs.map((tab) => (
        <Pressable key={tab.key} style={[styles.navItem, active === tab.key && styles.navActive]} onPress={() => onChange(tab.key)}>
          <Text style={[styles.navIcon, active === tab.key && styles.navTextActive]}>{tab.icon}</Text>
          <Text style={[styles.navLabel, active === tab.key && styles.navTextActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PageHeading({ title, caption }: { title: string; caption: string }) {
  return (
    <View style={styles.pageHeading}>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageCaption}>{caption}</Text>
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function SectionTitle({ title, caption }: { title: string; caption?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.cardTitle}>{title}</Text>
      {caption ? <Text style={styles.rowDetail}>{caption}</Text> : null}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry }: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#9aa3ac"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

function Segment({ values, active, onChange }: { values: string[]; active: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.segment}>
      {values.map((value) => (
        <Pressable key={value} style={[styles.segmentItem, active === value && styles.segmentActive]} onPress={() => onChange(value)}>
          <Text style={[styles.segmentText, active === value && styles.segmentTextActive]}>{value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Pill({ label, tone = "teal" }: { label: string; tone?: "teal" | "violet" | "coral" | "green" | "amber" }) {
  return (
    <View style={[styles.pill, { backgroundColor: toneColor(tone, 0.12) }]}>
      <Text style={[styles.pillText, { color: toneColor(tone, 1) }]}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "teal" | "violet" | "coral" | "green" }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: toneColor(tone, 1) }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Quick({ title, detail, icon, onPress }: { title: string; detail: string; icon: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickCard} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickDetail}>{detail}</Text>
    </Pressable>
  );
}

function ListRow({ title, detail, tag }: { title: string; detail: string; tag?: string }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      {tag ? <Pill label={tag} tone="amber" /> : null}
    </View>
  );
}

function Advice({ item }: { item: { name: string; reason: string; action: string } }) {
  return (
    <View style={styles.advice}>
      <Text style={styles.adviceTitle}>{item.name}</Text>
      <Text style={styles.adviceText}>{item.reason}</Text>
      <Text style={styles.smallMuted}>{item.action}</Text>
    </View>
  );
}

function AiNoteCard({ note }: { note: AiNote }) {
  return (
    <View style={styles.aiNoteCard}>
      <View style={styles.sectionTitle}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{note.title}</Text>
          <Text style={styles.rowDetail}>{note.summary}</Text>
        </View>
        <Pill label={note.source === "deepseek" ? "DeepSeek" : "本地"} tone={note.source === "deepseek" ? "teal" : "amber"} />
      </View>
      {note.actions.map((action, index) => (
        <ListRow key={`${note.id}-${index}`} title={`行动 ${index + 1}`} detail={action} tag="next" />
      ))}
      <View style={styles.tagWrap}>{note.tags.map((tag) => <Pill key={tag} label={tag} tone="violet" />)}</View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value || "待补充"}</Text>
    </View>
  );
}

function TimelineRow({ index, date, title, desc, active }: { index: number; date: string; title: string; desc: string; active?: boolean }) {
  return (
    <View style={[styles.timelineRow, active && styles.timelineActive]}>
      <View style={styles.timelineIndex}><Text style={styles.timelineIndexText}>0{index + 1}</Text></View>
      <View style={styles.flex}>
        <Text style={styles.smallMuted}>{date}</Text>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{desc}</Text>
      </View>
    </View>
  );
}

function Star({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <View style={styles.starCard}>
      <Text style={styles.starLabel}>{label}</Text>
      <Text style={styles.starTitle}>{title}</Text>
      <Text style={styles.starText}>{text}</Text>
    </View>
  );
}

function PaperBlock({ title, content }: { title: string; content: string }) {
  return (
    <View style={styles.paperBlock}>
      <Text style={styles.paperHeading}>{title}</Text>
      <Text style={styles.paperLine}>{content}</Text>
    </View>
  );
}

function toneColor(tone: "teal" | "violet" | "coral" | "green" | "amber", alpha: number) {
  const map = { teal: colors.teal, violet: colors.violet, coral: colors.coral, green: colors.green, amber: colors.amber };
  if (alpha === 1) return map[tone];
  const hex = map[tone].replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resumeHtml(name: string, targetRole: string, data: ResumeData) {
  const experiences = data.experiences.map((exp) => `
    <section>
      <h2>${escapeHtml(exp.company)} · ${escapeHtml(exp.role)}</h2>
      <p class="muted">${escapeHtml(exp.period)}</p>
      <ul>${exp.bullets.filter(Boolean).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `).join("");
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 36px; color: #17212b; }
          h1 { margin: 0 0 6px; font-size: 28px; }
          h2 { margin: 22px 0 8px; font-size: 16px; border-bottom: 1px solid #d9d4ca; padding-bottom: 6px; }
          p, li { font-size: 12px; line-height: 1.7; }
          .muted { color: #65717d; }
          .target { margin-top: 8px; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(name)}</h1>
        <p class="muted">${escapeHtml(data.contact)}</p>
        <p class="target">求职意向：${escapeHtml(targetRole)}</p>
        <h2>个人优势</h2><p>${escapeHtml(data.summary)}</p>
        <h2>教育经历</h2><p>${escapeHtml(data.education)}</p>
        ${experiences}
        <h2>专业技能</h2><p>${escapeHtml(data.skills.join(" · ") || "待补充")}</p>
      </body>
    </html>
  `;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
}

function localDailyBrief(data: AppData): Omit<AiNote, "id" | "date" | "kind" | "source"> {
  const openTodos = data.todos.filter((todo) => todo.status === "todo");
  const latestLog = data.logs[0];
  const weakJobs = data.jobs.filter((job) => !job.deadline || job.deadline === "待确认").length;
  return {
    title: "今日本地作战简报",
    summary: `当前有 ${data.jobs.length} 个岗位、${openTodos.length} 个待办、${data.logs.length} 条经历素材。今天优先推进最接近投递和面试转化的事项。`,
    actions: [
      openTodos[0] ? `先完成「${openTodos[0].title}」，并补充可量化结果。` : "新增一项今天最重要的求职行动。",
      weakJobs ? `有 ${weakJobs} 个岗位缺少截止时间，投递前先核实。` : "岗位信息相对完整，可以开始筛选高优机会。",
      latestLog ? `把最近经历「${latestLog.result.bullet}」改写进目标岗位简历。` : "记录一条真实实习日志，作为简历素材源。"
    ],
    tags: ["本地规则", "今日行动", "求职节奏"]
  };
}

function localJobStrategy(data: AppData, job: Job) {
  const abilities = Array.from(new Set(data.logs.flatMap((log) => log.result.abilities)));
  const overlap = abilities.filter((ability) => new RegExp(ability.slice(0, 2)).test(`${job.requirements}${job.role}${job.companyIntro}`));
  const match = Math.min(92, Math.max(job.match || 0, 58 + overlap.length * 8 + (job.requirements ? 8 : 0)));
  return {
    strategy: `建议把这个岗位作为${match >= 78 ? "高优先级" : "可观察"}机会。简历表达重点放在${(overlap.length ? overlap : abilities.slice(0, 3)).join("、") || "执行与交付"}，投递前补齐岗位要求中的硬性条件。`,
    match,
    actions: [
      "核实截止时间和投递渠道，避免错过窗口。",
      "从经历库挑选 2 条最贴近岗位要求的 STAR 素材。",
      "把简历标题、个人优势和第一段经历改成该岗位关键词。"
    ],
    risks: [
      job.deadline === "待确认" ? "截止时间待确认" : "",
      !job.requirements ? "岗位要求缺失，匹配判断不稳定" : ""
    ].filter(Boolean)
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  app: { flex: 1 },
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateText: { color: colors.muted, fontSize: 12 },
  appTitle: { color: colors.ink, fontSize: 24, fontWeight: "800", marginTop: 2 },
  settingsButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  settingsIcon: { fontSize: 18 },
  scrollPad: { padding: 18, paddingBottom: 112 },
  loadingCover: { flex: 1, justifyContent: "flex-end" },
  loadingMask: { padding: 28, backgroundColor: "rgba(23,33,43,0.62)" },
  loadingTitle: { color: "#fff", fontSize: 34, fontWeight: "900" },
  loadingSubtitle: { color: "rgba(255,255,255,0.82)", marginTop: 8, fontSize: 15 },
  hero: { minHeight: 340, borderRadius: radius.xl, overflow: "hidden", marginBottom: 14 },
  heroImage: { borderRadius: radius.xl },
  heroShade: { flex: 1, padding: 22, justifyContent: "flex-end", backgroundColor: "rgba(23,33,43,0.32)" },
  eyebrow: { color: "#fff", fontSize: 12, fontWeight: "700", opacity: 0.9 },
  heroTitle: { color: "#fff", fontSize: 28, lineHeight: 35, fontWeight: "900", marginTop: 8 },
  heroCopy: { color: "rgba(255,255,255,0.86)", fontSize: 14, lineHeight: 21, marginTop: 8 },
  heroButton: { marginTop: 18, backgroundColor: "#fff", paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.md, alignSelf: "flex-start" },
  heroButtonText: { color: colors.ink, fontWeight: "800" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  statCard: { width: "48.5%", backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.line },
  statValue: { fontSize: 25, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.line, shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 16, elevation: 1 },
  pageHeading: { marginBottom: 14 },
  pageTitle: { color: colors.ink, fontSize: 26, fontWeight: "900" },
  pageCaption: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  sectionTitle: { marginBottom: 12 },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  paragraph: { color: colors.ink, fontSize: 14, lineHeight: 22, marginTop: 12 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  rowDetail: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  smallMuted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  flex: { flex: 1 },
  inlineActions: { flexDirection: "row", gap: 10, marginBottom: 12 },
  primaryButton: { backgroundColor: colors.ink, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.md, alignItems: "center", marginTop: 10 },
  primaryButtonSmall: { backgroundColor: colors.ink, paddingVertical: 12, paddingHorizontal: 15, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flex: 1 },
  primaryButtonText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  secondaryButton: { backgroundColor: "#f1ece4", paddingVertical: 13, paddingHorizontal: 15, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: 10, flex: 1 },
  secondaryButtonText: { color: colors.ink, fontWeight: "800" },
  dangerButton: { backgroundColor: "rgba(231, 119, 89, 0.12)", paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md, alignItems: "center", marginTop: 10 },
  dangerText: { color: colors.coral, fontWeight: "900" },
  linkButton: { marginTop: 10, alignSelf: "flex-start" },
  linkButtonText: { color: colors.teal, fontWeight: "900" },
  field: { marginBottom: 12 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "800", marginBottom: 7 },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fbfaf8", paddingHorizontal: 13, color: colors.ink, fontSize: 14 },
  textarea: { minHeight: 116, paddingTop: 12, lineHeight: 20 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, backgroundColor: "#f2eee8", borderWidth: 1, borderColor: "transparent" },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  segment: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  segmentItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: "#f2eee8" },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: { color: colors.muted, fontWeight: "800" },
  segmentTextActive: { color: "#fff" },
  pill: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 9, alignSelf: "flex-start" },
  pillText: { fontSize: 11, fontWeight: "900" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  quickCard: { width: "48.5%", backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, minHeight: 122, borderWidth: 1, borderColor: colors.line },
  quickIcon: { fontSize: 24, color: colors.teal },
  quickTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: 12 },
  quickDetail: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0ece5" },
  empty: { backgroundColor: "#fbfaf8", borderRadius: radius.md, padding: 18, alignItems: "center", marginTop: 8 },
  emptyText: { color: colors.muted, lineHeight: 20, textAlign: "center" },
  todoItem: { flexDirection: "row", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#f0ece5" },
  doneItem: { opacity: 0.68 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.teal, alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkText: { color: colors.teal, fontWeight: "900" },
  jobTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  companyLogo: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  companyLogoText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 13 },
  meta: { width: "48.5%", backgroundColor: "#fbfaf8", borderRadius: radius.md, padding: 11, borderWidth: 1, borderColor: "#eee8df" },
  metaLabel: { color: colors.muted, fontSize: 11 },
  metaValue: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 4 },
  noteBox: { backgroundColor: "#fbfaf8", color: colors.ink, lineHeight: 21, padding: 12, borderRadius: radius.md, marginTop: 12, borderWidth: 1, borderColor: "#eee8df" },
  strategyBox: { backgroundColor: "rgba(47, 127, 122, 0.09)", color: colors.ink, lineHeight: 21, padding: 12, borderRadius: radius.md, marginTop: 12, borderWidth: 1, borderColor: "rgba(47, 127, 122, 0.22)" },
  modalSafe: { flex: 1, backgroundColor: colors.bg },
  closeButton: { alignSelf: "flex-end", width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 24, color: colors.ink, lineHeight: 28 },
  experienceEditor: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14, marginTop: 10 },
  paper: { backgroundColor: "#fffdf9", borderRadius: radius.md, borderWidth: 1, borderColor: "#e7dfd4", padding: 16 },
  paperName: { fontSize: 24, fontWeight: "900", color: colors.ink },
  paperStrong: { color: colors.ink, fontWeight: "900", marginTop: 8 },
  paperMuted: { color: colors.muted, marginTop: 4 },
  paperBlock: { marginTop: 16 },
  paperHeading: { color: colors.ink, fontWeight: "900", borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 5, marginBottom: 6 },
  paperLine: { color: colors.ink, lineHeight: 21, marginTop: 4 },
  advice: { backgroundColor: "#fbfaf8", borderRadius: radius.md, padding: 13, borderWidth: 1, borderColor: "#eee8df", marginBottom: 10 },
  aiNoteCard: { backgroundColor: "#fbfaf8", borderRadius: radius.md, padding: 13, borderWidth: 1, borderColor: "#eee8df", marginTop: 12 },
  adviceSelected: { borderColor: colors.teal, backgroundColor: "rgba(47, 127, 122, 0.08)" },
  adviceTitle: { color: colors.ink, fontWeight: "900", fontSize: 14 },
  adviceText: { color: colors.muted, lineHeight: 20, marginTop: 6 },
  reviewCard: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 12 },
  timelineCard: { borderBottomWidth: 1, borderBottomColor: "#f0ece5", paddingBottom: 12, marginBottom: 12 },
  timelineRow: { flexDirection: "row", gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: "#fbfaf8", borderWidth: 1, borderColor: "#eee8df" },
  timelineActive: { backgroundColor: "rgba(47, 127, 122, 0.1)", borderColor: "rgba(47, 127, 122, 0.28)" },
  timelineIndex: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  timelineIndexText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  starGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  starCard: { width: "48.5%", backgroundColor: "#fbfaf8", borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: "#eee8df", minHeight: 150 },
  starLabel: { color: colors.coral, fontSize: 20, fontWeight: "900" },
  starTitle: { color: colors.ink, fontWeight: "900", marginTop: 4 },
  starText: { color: colors.muted, lineHeight: 19, marginTop: 7, fontSize: 12 },
  quote: { backgroundColor: "rgba(47, 127, 122, 0.09)", color: colors.ink, lineHeight: 22, padding: 13, borderRadius: radius.md, marginTop: 12, fontWeight: "700" },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  logCard: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 12 },
  nav: { position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: colors.surface, borderRadius: 24, flexDirection: "row", justifyContent: "space-around", padding: 8, borderWidth: 1, borderColor: colors.line, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 18, elevation: 8 },
  navItem: { alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 8, borderRadius: 18, minWidth: 48 },
  navActive: { backgroundColor: colors.ink },
  navIcon: { color: colors.muted, fontWeight: "900", fontSize: 15 },
  navLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", marginTop: 2 },
  navTextActive: { color: "#fff" },
  toast: { position: "absolute", left: 22, right: 22, bottom: 92, backgroundColor: colors.ink, borderRadius: 16, padding: 14, alignItems: "center" },
  toastText: { color: "#fff", fontWeight: "900" }
});
