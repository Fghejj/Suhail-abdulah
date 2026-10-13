import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, createContext, type ReactNode } from "react";

import type { AppSettings, AppSnapshot, CurrentSession, Device, DisplayConnectionMode, DisplayPowerState, ScreenType, SessionInput } from "@shared/ps-types";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY = "@ps-store-manager/snapshot:v1";
const DEVICE_COLORS = ["#6C2BD9", "#2563EB", "#DB2777", "#0891B2", "#16A34A", "#CA8A04"];

const defaultSettings: AppSettings = {
  pricePerMinute: 10,
  autoPricing: true,
  specialOfferAmount: 200,
  specialOfferMinutes: 30,
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  autoSleepConnectedDisplays: true,
};

const makeDevice = (index: number, now: number): Device => ({
  id: `device-${index + 1}`,
  name: `جهاز ${index + 1}`,
  color: DEVICE_COLORS[index % DEVICE_COLORS.length],
  status: "available",
  createdAt: now - (2 - index) * 60_000,
  lastAmount: 0,
  lastDurationMinutes: 0,
  displayPower: "on",
});

export const createEmptySnapshot = (): AppSnapshot => ({ devices: [], sessions: [], settings: { ...defaultSettings } });

const isLegacyDemoSnapshot = (value: AppSnapshot) => value.sessions.length > 0 && value.sessions.every((session) => session.id.startsWith("seed-session-"));
const persistenceSignature = (value: AppSnapshot) => JSON.stringify({
  ...value,
  devices: value.devices.map((device) => ({
    ...device,
    currentSession: device.currentSession ? { ...device.currentSession, remainingSeconds: 0 } : undefined,
  })),
});

interface StoreValue extends AppSnapshot {
  hydrated: boolean;
  syncStatus: "loading" | "synced" | "local" | "error";
  addDevice: (name?: string) => void;
  renameDevice: (id: string, name: string) => void;
  recolorDevice: (id: string, color: string) => void;
  deleteDevice: (id: string) => void;
  connectDisplay: (deviceId: string, mode: DisplayConnectionMode, details?: { id: string; name: string; type: ScreenType; ip: string; port?: number; mac?: string; autoStandby?: boolean }) => void;
  disconnectDisplay: (deviceId: string) => void;
  setDisplayPower: (deviceId: string, power: DisplayPowerState | "restart") => void;
  startSession: (deviceId: string, input: SessionInput) => void;
  endSession: (deviceId: string) => void;
  addTime: (deviceId: string, input: SessionInput) => void;
  pauseSession: (deviceId: string) => void;
  resumeSession: (deviceId: string) => void;
  restartSession: (deviceId: string) => void;
  tick: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetDailyRevenue: () => void;
  clearAllData: () => void;
  deleteHistory: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const authQuery = trpc.auth.me.useQuery();
  const remoteSnapshotQuery = trpc.store.getSnapshot.useQuery(undefined, { enabled: Boolean(authQuery.data), retry: false });
  const saveSnapshotMutation = trpc.store.saveSnapshot.useMutation();
  const clearSnapshotMutation = trpc.store.clearSnapshot.useMutation();
  const [snapshot, setSnapshot] = useState<AppSnapshot>(createEmptySnapshot);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<StoreValue["syncStatus"]>("loading");
  const saveQueue = useRef(Promise.resolve());
  const localSnapshotRef = useRef<AppSnapshot | null>(null);
  const lastPersistedSignature = useRef("");

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const saved = JSON.parse(raw) as AppSnapshot;
            setSnapshot({ ...createEmptySnapshot(), ...saved, devices: (saved.devices ?? []).map((device, index) => ({ ...makeDevice(index, Date.now()), ...device, displayPower: device.displayPower ?? "unknown" })), settings: { ...defaultSettings, ...saved.settings } });
            localSnapshotRef.current = saved;
          } catch {
            setSnapshot(createEmptySnapshot());
          }
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    if (!authQuery.data || syncStatus === "loading") return;
    const signature = persistenceSignature(snapshot);
    if (signature === lastPersistedSignature.current) return;
    lastPersistedSignature.current = signature;
    saveQueue.current = saveQueue.current
      .then(() => saveSnapshotMutation.mutateAsync({ snapshot }))
      .then(() => setSyncStatus("synced"))
      .catch(() => setSyncStatus("error"));
  }, [snapshot, hydrated, authQuery.data, saveSnapshotMutation]);

  useEffect(() => {
    if (!authQuery.isFetched) return;
    if (!authQuery.data) {
      setSyncStatus("local");
      return;
    }
    if (!remoteSnapshotQuery.isFetched) return;
    if (remoteSnapshotQuery.error) {
      setSyncStatus("error");
      return;
    }
    if (remoteSnapshotQuery.data?.snapshot) {
      lastPersistedSignature.current = persistenceSignature(remoteSnapshotQuery.data.snapshot as AppSnapshot);
      setSnapshot(remoteSnapshotQuery.data.snapshot as AppSnapshot);
    } else if (localSnapshotRef.current && !isLegacyDemoSnapshot(localSnapshotRef.current)) {
      saveQueue.current = saveQueue.current
        .then(() => saveSnapshotMutation.mutateAsync({ snapshot: localSnapshotRef.current as AppSnapshot }))
        .then(() => undefined)
        .catch(() => setSyncStatus("error"));
    }
    setSyncStatus("synced");
  }, [authQuery.data, authQuery.isFetched, remoteSnapshotQuery.data, remoteSnapshotQuery.error, remoteSnapshotQuery.isFetched, saveSnapshotMutation]);

  const addDevice = useCallback((name?: string) => {
    setSnapshot((current) => {
      const index = current.devices.length;
      const trimmed = name?.trim();
      const device: Device = {
        ...makeDevice(index, Date.now()),
        id: `device-${Date.now()}-${index}`,
        name: trimmed || `جهاز ${index + 1}`,
      };
      return { ...current, devices: [...current.devices, device] };
    });
  }, []);

  const renameDevice = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.map((device) => (device.id === id ? { ...device, name: trimmed } : device)),
    }));
  }, []);

  const recolorDevice = useCallback((id: string, color: string) => {
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.map((device) => (device.id === id ? { ...device, color } : device)),
    }));
  }, []);

  const deleteDevice = useCallback((id: string) => {
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.filter((device) => device.id !== id || device.status === "active" || device.status === "paused"),
    }));
  }, []);

  const connectDisplay = useCallback((deviceId: string, mode: DisplayConnectionMode, details?: { id: string; name: string; type: ScreenType; ip: string; port?: number; mac?: string; autoStandby?: boolean }) => {
    const labels: Record<DisplayConnectionMode, string> = { bluetooth: "بلوتوث", hotspot: "نقطة اتصال", lan: "LAN / IP", pairing_code: "رمز الاقتران" };
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.map((device) => device.id === deviceId ? { ...device, displayConnection: { screenId: details?.id, mode, label: details?.name ?? labels[mode], connectedAt: Date.now(), endpoint: details?.ip, screenType: details?.type, ip: details?.ip, port: details?.port, mac: details?.mac, autoStandby: details?.autoStandby ?? true }, displayPower: "unknown" } : device),
    }));
  }, []);

  const disconnectDisplay = useCallback((deviceId: string) => {
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.map((device) => device.id === deviceId ? { ...device, displayConnection: undefined } : device),
    }));
  }, []);

  const setDisplayPower = useCallback((deviceId: string, power: DisplayPowerState | "restart") => {
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.map((device) => {
        if (device.id !== deviceId || !device.displayConnection) return device;
        return { ...device, displayPower: power === "restart" ? "restarting" as const : power };
      }),
    }));
    if (power === "restart") {
      setTimeout(() => setSnapshot((current) => ({ ...current, devices: current.devices.map((device) => device.id === deviceId ? { ...device, displayPower: "on" as const } : device) })), 1200);
    }
  }, []);

  const startSession = useCallback((deviceId: string, input: SessionInput) => {
    if (input.minutes <= 0 || input.amount < 0) return;
    const now = Date.now();
    const session: CurrentSession = {
      id: `session-${now}-${deviceId}`,
      amountPaid: input.amount,
      durationMinutes: input.minutes,
      startedAt: now,
      endAt: now + input.minutes * 60_000,
      remainingSeconds: Math.max(1, Math.round(input.minutes * 60)),
    };
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.map((device) =>
        device.id === deviceId
          ? { ...device, status: "active", currentSession: session, lastAmount: input.amount, lastDurationMinutes: input.minutes, displayPower: device.displayConnection ? "unknown" : device.displayPower }
          : device,
      ),
    }));
  }, []);

  const endSession = useCallback((deviceId: string) => {
    const now = Date.now();
    setSnapshot((current) => {
      const device = current.devices.find((item) => item.id === deviceId);
      if (!device?.currentSession || !["active", "paused"].includes(device.status)) return current;
      const completed = device.currentSession;
      return {
        ...current,
        sessions: [...current.sessions, { id: completed.id, deviceId: device.id, deviceName: device.name, durationMinutes: completed.durationMinutes, amountPaid: completed.amountPaid, startTime: completed.startedAt, endTime: now, status: "completed" as const }],
        devices: current.devices.map((item) => item.id === deviceId ? { ...item, status: "finished" as const, currentSession: undefined, lastAmount: completed.amountPaid, lastDurationMinutes: completed.durationMinutes, displayPower: item.displayConnection ? "unknown" : item.displayPower } : item),
      };
    });
  }, []);

  const addTime = useCallback((deviceId: string, input: SessionInput) => {
    if (input.minutes <= 0 || input.amount < 0) return;
    const now = Date.now();
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.map((device) => {
        if (device.id !== deviceId || !device.currentSession || !["active", "paused"].includes(device.status)) return device;
        const remaining = device.status === "active"
          ? Math.max(0, Math.ceil((device.currentSession.endAt - now) / 1000))
          : device.currentSession.remainingSeconds;
        const newRemaining = remaining + Math.round(input.minutes * 60);
        return {
          ...device,
          status: device.status,
          lastAmount: device.lastAmount + input.amount,
          lastDurationMinutes: device.lastDurationMinutes + input.minutes,
          currentSession: {
            ...device.currentSession,
            amountPaid: device.currentSession.amountPaid + input.amount,
            durationMinutes: device.currentSession.durationMinutes + input.minutes,
            endAt: now + newRemaining * 1000,
            remainingSeconds: newRemaining,
          },
        };
      }),
    }));
  }, []);

  const pauseSession = useCallback((deviceId: string) => {
    const now = Date.now();
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.map((device) => {
        if (device.id !== deviceId || device.status !== "active" || !device.currentSession) return device;
        const remaining = Math.max(0, Math.ceil((device.currentSession.endAt - now) / 1000));
        return { ...device, status: "paused", currentSession: { ...device.currentSession, remainingSeconds: remaining } };
      }),
    }));
  }, []);

  const resumeSession = useCallback((deviceId: string) => {
    const now = Date.now();
    setSnapshot((current) => ({
      ...current,
      devices: current.devices.map((device) => {
        if (device.id !== deviceId || device.status !== "paused" || !device.currentSession) return device;
        return { ...device, status: "active", currentSession: { ...device.currentSession, endAt: now + device.currentSession.remainingSeconds * 1000 } };
      }),
    }));
  }, []);

  const restartSession = useCallback((deviceId: string) => {
    setSnapshot((current) => {
      const device = current.devices.find((item) => item.id === deviceId);
      if (!device) return current;
      const amount = device.lastAmount || 100;
      const minutes = device.lastDurationMinutes || Math.max(1, Math.round(amount / current.settings.pricePerMinute));
      const now = Date.now();
      const session: CurrentSession = {
        id: `session-${now}-${deviceId}`,
        amountPaid: amount,
        durationMinutes: minutes,
        startedAt: now,
        endAt: now + minutes * 60_000,
        remainingSeconds: minutes * 60,
      };
      return { ...current, devices: current.devices.map((item) => item.id === deviceId ? { ...item, status: "active", currentSession: session, displayPower: item.displayConnection ? "unknown" : item.displayPower } : item) };
    });
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    setSnapshot((current) => {
      let changed = false;
      let sessions = current.sessions;
      const devices = current.devices.map((device) => {
        if (device.status !== "active" || !device.currentSession) return device;
        const remaining = Math.max(0, Math.ceil((device.currentSession.endAt - now) / 1000));
        if (remaining <= 0) {
          changed = true;
          const completed = device.currentSession;
          sessions = [...sessions, {
            id: completed.id,
            deviceId: device.id,
            deviceName: device.name,
            durationMinutes: completed.durationMinutes,
            amountPaid: completed.amountPaid,
            startTime: completed.startedAt,
            endTime: now,
            status: "completed" as const,
          }];
          return { ...device, status: "finished" as const, lastAmount: completed.amountPaid, lastDurationMinutes: completed.durationMinutes, currentSession: undefined, displayPower: device.displayConnection ? "unknown" : device.displayPower };
        }
        if (remaining !== device.currentSession.remainingSeconds) {
          changed = true;
          return { ...device, currentSession: { ...device.currentSession, remainingSeconds: remaining } };
        }
        return device;
      });
      return changed ? { ...current, devices, sessions } : current;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSnapshot((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }, []);

  const resetDailyRevenue = useCallback(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    setSnapshot((current) => ({ ...current, sessions: current.sessions.filter((session) => session.endTime < start.getTime()) }));
  }, []);

  const clearAllData = useCallback(() => {
    setSnapshot(createEmptySnapshot());
    if (authQuery.data) {
      saveQueue.current = saveQueue.current
        .then(() => clearSnapshotMutation.mutateAsync())
        .then(() => undefined)
        .catch(() => setSyncStatus("error"));
    }
  }, [authQuery.data, clearSnapshotMutation]);

  const deleteHistory = useCallback(() => setSnapshot((current) => ({ ...current, sessions: [] })), []);

  const value = useMemo<StoreValue>(() => ({
    ...snapshot,
    hydrated,
    syncStatus,
    addDevice,
    renameDevice,
    recolorDevice,
    deleteDevice,
    connectDisplay,
    disconnectDisplay,
    setDisplayPower,
    startSession,
    endSession,
    addTime,
    pauseSession,
    resumeSession,
    restartSession,
    tick,
    updateSettings,
    resetDailyRevenue,
    clearAllData,
    deleteHistory,
  }), [snapshot, hydrated, syncStatus, addDevice, renameDevice, recolorDevice, deleteDevice, connectDisplay, disconnectDisplay, setDisplayPower, startSession, endSession, addTime, pauseSession, resumeSession, restartSession, tick, updateSettings, resetDailyRevenue, clearAllData, deleteHistory]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}

export function useSessionTicker() {
  const { tick } = useStore();
  useEffect(() => {
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tick]);
}
