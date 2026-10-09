import { describe, expect, it } from "vitest";
import { REMOTE_KEYS, canCommitPowerState, normalizeRemoteDirection, shouldRetryAfterDisconnect } from "../services/remote-control-logic";

describe("Android TV remote command contract", () => {
  it("includes navigation, OK, system, power and volume keys", () => {
    expect(REMOTE_KEYS).toEqual(expect.arrayContaining(["UP", "DOWN", "LEFT", "RIGHT", "ENTER", "BACK", "HOME", "POWER", "VOLUME_UP", "VOLUME_DOWN"]));
  });

  it("supports short and explicit press/release directions", () => {
    expect(normalizeRemoteDirection("SHORT")).toBe("SHORT");
    expect(normalizeRemoteDirection("START_LONG")).toBe("START_LONG");
    expect(normalizeRemoteDirection("END_LONG")).toBe("END_LONG");
    expect(normalizeRemoteDirection("unknown")).toBe("SHORT");
  });

  it("never commits a power state from transport delivery alone", () => {
    expect(canCommitPowerState({ success: true, verified: false })).toBe(false);
    expect(canCommitPowerState({ success: true })).toBe(false);
    expect(canCommitPowerState({ success: true, verified: true })).toBe(true);
    expect(canCommitPowerState({ success: false, verified: true })).toBe(false);
  });

  it("allows one controlled retry only for transport failures", () => {
    expect(shouldRetryAfterDisconnect("NOT_CONNECTED")).toBe(true);
    expect(shouldRetryAfterDisconnect("SEND_FAILED")).toBe(true);
    expect(shouldRetryAfterDisconnect("RECONNECT_FAILED")).toBe(true);
    expect(shouldRetryAfterDisconnect("INVALID_CODE")).toBe(false);
  });
});
