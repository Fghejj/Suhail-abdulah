import type { HistoryFilter, Session } from "@shared/ps-types";

export const formatMoney = (value: number) =>
  `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Math.max(0, value))} ر.س`;

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Math.max(0, value));

export const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

export const formatMinutes = (minutes: number) => {
  const safe = Math.max(0, Math.round(minutes));
  if (safe >= 60) {
    const hours = Math.floor(safe / 60);
    const rest = safe % 60;
    return rest ? `${hours} س و ${rest} د` : `${hours} ساعة`;
  }
  return `${safe} دقيقة`;
};

export const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat("ar-SA", { hour: "2-digit", minute: "2-digit" }).format(timestamp);

export const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(timestamp);

export const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.getTime();
};

export const getFilterStart = (filter: HistoryFilter) => {
  const now = new Date();
  if (filter === "day") return startOfDay(now);
  if (filter === "week") {
    const day = now.getDay();
    const offset = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - offset);
    return startOfDay(monday);
  }
  if (filter === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  return 0;
};

export const filterSessions = (sessions: Session[], filter: HistoryFilter, deviceId?: string) => {
  const start = getFilterStart(filter);
  return sessions.filter((session) => session.endTime >= start && (!deviceId || session.deviceId === deviceId));
};

export const totalRevenue = (sessions: Session[]) => sessions.reduce((sum, session) => sum + session.amountPaid, 0);

export const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

export const statusLabel = {
  available: "متاح",
  active: "مشغول",
  paused: "متوقف مؤقتاً",
  finished: "منتهي",
} as const;

export const statusColor = {
  available: "#22C55E",
  active: "#F97316",
  paused: "#EAB308",
  finished: "#EF4444",
} as const;

export const statusIcon = {
  available: "checkmark-circle",
  active: "play-circle",
  paused: "pause-circle",
  finished: "alert-circle",
} as const;
