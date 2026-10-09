export type RemoteDirection = "SHORT" | "START_LONG" | "END_LONG";
export type RemoteKey = "UP" | "DOWN" | "LEFT" | "RIGHT" | "ENTER" | "BACK" | "HOME" | "POWER" | "VOLUME_UP" | "VOLUME_DOWN";

export const REMOTE_KEYS: readonly RemoteKey[] = [
  "UP", "DOWN", "LEFT", "RIGHT", "ENTER", "BACK", "HOME", "POWER", "VOLUME_UP", "VOLUME_DOWN",
];

export function normalizeRemoteDirection(direction?: string): RemoteDirection {
  if (direction === "START_LONG" || direction === "END_LONG") return direction;
  return "SHORT";
}

export function canCommitPowerState(result: { success: boolean; verified?: boolean }): boolean {
  return result.success && result.verified === true;
}

export function shouldRetryAfterDisconnect(code?: string): boolean {
  return code === "NOT_CONNECTED" || code === "SEND_FAILED" || code === "RECONNECT_FAILED";
}
