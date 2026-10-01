import { useCallback, useEffect, useRef, useState } from "react";

import {
  screenControlService,
  type ControlResult,
  type PowerStatus,
  type ScreenDevice,
} from "@/services/ScreenControlService";

export function useScreenControl() {
  const [screens, setScreens] = useState<ScreenDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screensRef = useRef<ScreenDevice[]>([]);

  useEffect(() => {
    screensRef.current = screens;
  }, [screens]);

  const loadScreens = useCallback((savedScreens: ScreenDevice[]) => {
    setScreens(savedScreens);
  }, []);

  const discover = useCallback(async () => {
    setDiscovering(true);
    try {
      const found = await screenControlService.discoverDevices();
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
      if (result.success) {
        setScreens((previous) => previous.map((screen) => screen.id === device.id ? { ...screen, status: successStatus, lastConnected: result.timestamp } : screen));
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const powerOn = useCallback((device: ScreenDevice) => runCommand(device, (screen) => screenControlService.powerOn(screen), "on"), [runCommand]);
  const powerOff = useCallback((device: ScreenDevice) => runCommand(device, (screen) => screenControlService.powerOff(screen), "off"), [runCommand]);
  const standby = useCallback((device: ScreenDevice) => runCommand(device, (screen) => screenControlService.standby(screen), "standby"), [runCommand]);

  const restart = useCallback(async (device: ScreenDevice) => {
    setLoading(true);
    setScreens((previous) => previous.map((screen) => screen.id === device.id ? { ...screen, status: "restarting" } : screen));
    try {
      const result = await screenControlService.restart(device);
      setScreens((previous) => previous.map((screen) => screen.id === device.id ? { ...screen, status: result.success ? "on" : "unknown", lastConnected: result.success ? result.timestamp : screen.lastConnected } : screen));
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
    loadScreens,
    discover,
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
