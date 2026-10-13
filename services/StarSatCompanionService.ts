import { NativeModules, Platform } from "react-native";

export type CompanionResult = {
  status: "PAIRED" | "VERIFIED_SLEEP" | "SENT_UNVERIFIED" | "UNSUPPORTED_SYSTEM_PERMISSION" | "EXECUTION_FAILED" | "NOT_CAPABLE" | "UNAUTHORIZED" | string;
  reason?: string;
  fingerprint?: string;
  token?: string;
  model?: string;
  api?: number;
  interactive?: boolean;
  interactiveAfterRequest?: boolean;
  sleepSupported?: boolean;
};

const native = NativeModules.StarSatCompanion as {
  discover(): Promise<{ host: string; port: number; name: string }>;
  pair(host: string, port: number, pin: string): Promise<CompanionResult>;
  capability(host: string, port: number, token: string, fingerprint: string): Promise<CompanionResult>;
  sleep(host: string, port: number, token: string, fingerprint: string): Promise<CompanionResult>;
} | undefined;

function ensureNative() {
  if (Platform.OS !== "android" || !native) throw new Error("StarSat Sleep Companion يحتاج نسخة Android أصلية من التطبيق");
  return native;
}

export function pairStarSatCompanion(host: string, port: number, pin: string) {
  return ensureNative().pair(host.trim(), port, pin.trim());
}

export function discoverStarSatCompanion() {
  return ensureNative().discover();
}

export function probeStarSatCompanion(host: string, port: number, token: string, fingerprint: string) {
  return ensureNative().capability(host.trim(), port, token.trim(), fingerprint.trim());
}

export function sleepWithStarSatCompanion(host: string, port: number, token: string, fingerprint: string) {
  return ensureNative().sleep(host.trim(), port, token.trim(), fingerprint.trim());
}
