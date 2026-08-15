export function todayLabel(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function weekdayLabel(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
}

export function nowIso() {
  return new Date().toISOString();
}

export function nextId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}
