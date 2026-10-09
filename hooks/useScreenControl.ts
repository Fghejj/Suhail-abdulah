import { useCallback, useEffect, useRef, useState } from "react";

import {
  screenControlService,
  type ControlResult,
  type PowerStatus,
  type RemoteDirection,
  type RemoteKey,
  type ScreenDevice,
} from "@/services/ScreenControlService";

export function useScreenControl(initialScreens: ScreenDevice[] = []) {
  const [screens, setScreens] = useState<ScreenDevice[]>(initialScreens);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [lastResult, setLastResult] = useState<ControlResult | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screensRef = useRef<ScreenDevice[]>(initialScreens);

  useEffect(() => { screensRef.current = screens; }, [screens]);

  useEffect(() => {
    if (!initialScreens.length) return;
    setScreens((previous) => {
      const byId = new Map(previous.map((screen) => [screen.id, screen]));
      initialScreens.forEach((screen) => byId.set(screen.id, { ...byId.get(screen.id), ...screen }));
      return [...byId.values()];
    });
  }, [initialScreens]);

  const loadScreens = useCallback((savedScreens: ScreenDevice[]) => {
    setScreens(savedScreens);
  }, []);

  const registerScreen = useCallback((screen: ScreenDevice) => {
    setScreens((previous) => {
      const existing = previous.find((item) => item.id === screen.id);
      if (existing) return previous.map((item) => item.id === screen.id ? { ...item, ...screen } : item);
      return [...previous, screen];
    });
  }, []);

  const discover = useCallback(async () => {
    setDiscovering(true);
    try {
      const results = await Promise.allSettled([
        screenControlService.discoverDevices(),
        screenControlService.discoverBluetoothDevices(),
      ]);
      const found = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      setScreens((previous) => {
        const existingIds = new Set(previous.map((screen) => screen.id));
        return [...previous, ...found.filter((screen) => !existingIds.has(screen.id))];
      });
      return found;
    } finally {
      setDiscovering(false);
    }
  }, []);

  const runCommand = useCallback(async (device: ScreenDevice, command: (screen: ScreenDevice) => Promise<ControlResult>, successStatus: PowerStatus) => {
    setLoading(true);
    try {
      const result = await command(device);
      setLastResult(result);
      setScreens((previous) => previous.map((screen) => {
        if (screen.id !== device.id) return screen;
        if (result.success && result.verified !== false) return { ...screen, status: successStatus, lastConnected: result.timestamp };
        if (result.success && result.verified === false) return { ...screen, status: "unknown", lastConnected: result.timestamp };
        return screen;
      }));
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendRemoteKey = useCallback((device: ScreenDevice, key: RemoteKey, direction: RemoteDirection = "SHORT") => runCommand(device, (screen) => screenControlService.sendRemoteKey(screen, key, direction), "unknown"), [runCommand]);
  const powerOn = useCallback((device: ScreenDevice) => runCommand(device, (screen) => screenControlService.powerOn(screen), "on"), [runCommand]);
  const powerOff = useCallback((device: ScreenDevice) => runCommand(device, (screen) => screenControlService.powerOff(screen), "off"), [runCommand]);
  const standby = useCallback((device: ScreenDevice) => runCommand(device, (screen) => screenControlService.standby(screen), "standby"), [runCommand]);

  const reconnect = useCallback(async (device: ScreenDevice) => {
    setLoading(true);
    try {
      const result = await screenControlService.reconnectAndroidTv(device);
      setLastResult(result);
      if (result.success) registerScreen({ ...device, status: "unknown", lastConnected: result.timestamp });
      return result;
    } finally {
      setLoading(false);
    }
  }, [registerScreen]);

  const reconnectSavedScreens = useCallback(async () => {
    const saved = screensRef.current.filter((screen) => screen.type === "android_tv" && screen.ip);
    const results: ControlResult[] = [];
    for (const screen of saved) {
      const result = await reconnect(screen);
      results.push(result);
    }
    return results;
  }, [reconnect]);

  const restart = useCallback(async (device: ScreenDevice) => {
    setLoading(true);
    setScreens((previous) => previous.map((screen) => screen.id === device.id ? { ...screen, status: "restarting" } : screen));
    try {
      const result = await screenControlService.restart(device);
      setLastResult(result);
      setScreens((previous) => previous.map((screen) => screen.id === device.id ? { ...screen, status: result.success && result.verified !== false ? "on" : "unknown", lastConnected: result.success ? result.timestamp : screen.lastConnected } : screen));
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const linkScreen = useCallback((screenId: string, consoleId: string, autoStandby: boolean) => {
    setScreens((previous) => previous.map((screen) => screen.id === screenId ? { ...screen, linkedConsoleId: consoleId, autoStandby } : screen));
  }, []);

  const unlinkScreen = useCallback((screenId: string) => {
    setScreens((previous) => previous.map((screen) => screen.id === screenId ? { ...screen, linkedConsoleId: undefined } : screen));
  }, []);

  const autoStandbyAfterSession = useCallback(async (consoleId: string) => {
    const linked = screensRef.current.find((screen) => screen.linkedConsoleId === consoleId && screen.autoStandby);
    return linked ? standby(linked) : null;
  }, [standby]);

  const wakeOnSessionStart = useCallback(async (consoleId: string) => {
    const linked = screensRef.current.find((screen) => screen.linkedConsoleId === consoleId);
    if (!linked || linked.status === "on") return null;
    return powerOn(linked);
  }, [powerOn]);

  const refreshStatuses = useCallback(async () => {
    const current = screensRef.current;
    const results = await Promise.all(current.map(async (device) => ({ id: device.id, status: await screenControlService.getStatus(device) })));
    const statusById = new Map(results.map((result) => [result.id, result.status]));
    setScreens((previous) => previous.map((screen) => ({ ...screen, status: statusById.get(screen.id) ?? screen.status })));
  }, []);

  const startStatusPolling = useCallback((intervalMs = 30_000) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => { void refreshStatuses(); }, intervalMs);
    void refreshStatuses();
  }, [refreshStatuses]);

  const stopStatusPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopStatusPolling(), [stopStatusPolling]);

  return {
    screens,
    loading,
    discovering,
    lastResult,
    loadScreens,
    registerScreen,
    discover,
    reconnect,
    reconnectSavedScreens,
    sendRemoteKey,
    powerOn,
    powerOff,
    standby,
    restart,
    linkScreen,
    unlinkScreen,
    autoStandbyAfterSession,
    wakeOnSessionStart,
    startStatusPolling,
    stopStatusPolling,
    refreshStatuses,
  };
}
