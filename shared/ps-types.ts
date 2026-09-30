export type DeviceStatus = "available" | "active" | "paused" | "finished";
export type SessionStatus = "completed" | "cancelled";
export type HistoryFilter = "day" | "week" | "month" | "all";
export type DisplayConnectionMode = "bluetooth" | "hotspot" | "lan";
export type DisplayPowerState = "on" | "sleep" | "off" | "restarting";

export interface DisplayConnection {
  mode: DisplayConnectionMode;
  label: string;
  connectedAt: number;
  endpoint?: string;
}

export interface CurrentSession {
  id: string;
  amountPaid: number;
  durationMinutes: number;
  startedAt: number;
  endAt: number;
  remainingSeconds: number;
}

export interface Device {
  id: string;
  name: string;
  color: string;
  status: DeviceStatus;
  createdAt: number;
  currentSession?: CurrentSession;
  lastAmount: number;
  lastDurationMinutes: number;
  displayConnection?: DisplayConnection;
  displayPower: DisplayPowerState;
}

export interface Session {
  id: string;
  deviceId: string;
  deviceName: string;
  durationMinutes: number;
  amountPaid: number;
  startTime: number;
  endTime: number;
  status: SessionStatus;
}

export interface AppSettings {
  pricePerMinute: number;
  autoPricing: boolean;
  specialOfferAmount: number;
  specialOfferMinutes: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoSleepConnectedDisplays: boolean;
}

export interface AppSnapshot {
  devices: Device[];
  sessions: Session[];
  settings: AppSettings;
}

export interface SessionInput {
  amount: number;
  minutes: number;
}
