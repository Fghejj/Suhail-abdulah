import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import type { Device } from "@shared/ps-types";
import { DeviceCard } from "@/components/device-card";
import { DeviceOptionsModal } from "@/components/device-options-modal";
import { DisplayConnectionModal } from "@/components/display-connection-modal";
import { ScreenLinkModal } from "@/components/screen-link-modal";
import { ConfirmModal, InputModal } from "@/components/input-modal";
import { AppHeader, MetricCard, Page, SectionTitle, palette, Pill } from "@/components/app-ui";
import { PaymentModal } from "@/components/payment-modal";
import { filterSessions, formatMoney, totalRevenue } from "@/lib/formatters";
import { triggerSessionFeedback } from "@/lib/platform-feedback";
import { useSessionTicker, useStore } from "@/lib/store";
import { useScreenControl } from "@/hooks/useScreenControl";

export default function HomeScreen() {
  useSessionTicker();
  const { width } = useWindowDimensions();
  const { devices, sessions, settings, hydrated, addDevice, renameDevice, recolorDevice, deleteDevice, startSession, endSession, addTime, pauseSession, resumeSession, restartSession, connectDisplay, disconnectDisplay, setDisplayPower } = useStore();
  const { screens, discovering, discover, wakeOnSessionStart, autoStandbyAfterSession } = useScreenControl();
  const [selectedDevice, setSelectedDevice] = useState<Device>();
  const [paymentMode, setPaymentMode] = useState<"start" | "extend">("start");
  const [showPayment, setShowPayment] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showDisplayConnection, setShowDisplayConnection] = useState(false);
  const [showScreenLink, setShowScreenLink] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Device>();
  const [confirmDelete, setConfirmDelete] = useState<Device>();
  const seenSessions = useRef(new Set<string>());

  useEffect(() => {
    sessions.forEach((session) => {
      if (!seenSessions.current.has(session.id)) {
        seenSessions.current.add(session.id);
        if (hydrated) void autoStandbyAfterSession(session.deviceId);
        if (hydrated && Date.now() - session.endTime < 5000 && settings.notificationsEnabled) {
          void triggerSessionFeedback(settings, session.deviceName);
        }
      }
    });
  }, [sessions, settings, hydrated, autoStandbyAfterSession]);

  const available = devices.filter((device) => device.status === "available").length;
  const busy = devices.filter((device) => device.status === "active" || device.status === "paused").length;
  const todaySessions = filterSessions(sessions, "day");
  const todayRevenue = totalRevenue(todaySessions);
  const isFull = devices.length > 0 && available === 0;
  const columns = width >= 860 ? 3 : width >= 560 ? 2 : 1;

  const openPayment = (device: Device, mode: "start" | "extend") => {
    setSelectedDevice(device);
    setPaymentMode(mode);
    setShowPayment(true);
  };

  const openDisplayConnection = (device: Device) => {
    setSelectedDevice(device);
    setShowDisplayConnection(true);
  };

  const openScreenLink = (device?: Device) => {
    const target = device ?? selectedDevice ?? devices[0];
    if (!target) return;
    setLinkTarget(target);
    setShowScreenLink(true);
  };

  if (!hydrated) {
    return <Page scroll={false}><View style={styles.loading}><View style={styles.loadingMark}><Ionicons name="game-controller" size={34} color={palette.primarySoft} /></View><Text style={styles.loadingTitle}>جاري تجهيز المحل</Text><Text style={styles.loadingText}>نستعيد الأجهزة والجلسات المحفوظة...</Text></View></Page>;
  }

  return (
    <Page>
      <AppHeader title="لوحة المحل" subtitle="إدارة الجلسات والوقت في مكان واحد" action={<View style={styles.headerActions}><Pressable onPress={() => openScreenLink()} style={({ pressed }) => [styles.headerConnect, pressed && styles.pressed]}><Ionicons name="tv-outline" size={18} color={palette.primarySoft} /><Text style={styles.headerConnectText}>ربط شاشة</Text></Pressable><Pressable onPress={() => setShowAdd(true)} style={({ pressed }) => [styles.headerAdd, pressed && styles.pressed]}><Ionicons name="add" size={20} color={palette.text} /><Text style={styles.headerAddText}>جهاز جديد</Text></Pressable></View>} />

      <View style={styles.metricsRow}>
        <MetricCard label="أرباح اليوم" value={formatMoney(todayRevenue)} icon="wallet" accent={palette.primarySoft} />
        <MetricCard label="متاح الآن" value={`${available} / ${devices.length}`} icon="checkmark-circle" accent={palette.success} />
        <MetricCard label="قيد التشغيل" value={`${busy}`} icon="timer" accent={palette.orange} />
      </View>

      {isFull ? <View style={styles.fullNotice}><View style={styles.noticeIcon}><Ionicons name="flame" size={19} color={palette.orange} /></View><View style={{ flex: 1 }}><Text style={styles.noticeTitle}>المحل في أعلى طاقته</Text><Text style={styles.noticeText}>جميع الأجهزة مشغولة حالياً. يمكنك إضافة جهاز أو انتظار انتهاء إحدى الجلسات.</Text></View><Pill label="ممتلئ" color={palette.orange} /></View> : null}

      <SectionTitle title="الأجهزة" trailing={<Text style={styles.countText}>{devices.length} أجهزة</Text>} />
      <View style={styles.grid}>
        {devices.map((device) => <View key={device.id} style={columns === 1 ? styles.singleColumn : styles.multiColumn}><DeviceCard device={device} onStart={() => openPayment(device, "start")} onEnd={() => endSession(device.id)} onExtend={() => openPayment(device, "extend")} onPause={() => pauseSession(device.id)} onResume={() => resumeSession(device.id)} onRestart={async () => { await wakeOnSessionStart(device.id); restartSession(device.id); }} onOptions={() => { setSelectedDevice(device); setShowOptions(true); }} onDisplay={() => openDisplayConnection(device)} /></View>)}
      </View>

      <View style={styles.tip}><Ionicons name="bulb-outline" size={16} color={palette.primarySoft} /><Text style={styles.tipText}>اضغط مطولاً على أي بطاقة لإعادة التسمية أو تغيير لونها.</Text></View>
      <Pressable onPress={() => setShowAdd(true)} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}><Ionicons name="add" size={25} color={palette.text} /><Text style={styles.fabText}>إضافة جهاز</Text></Pressable>

      <PaymentModal key={`${selectedDevice?.id ?? "none"}-${paymentMode}-${showPayment}`} visible={showPayment} device={selectedDevice} settings={settings} mode={paymentMode} onClose={() => setShowPayment(false)} onConfirm={async (amount, minutes) => { if (selectedDevice) { if (paymentMode === "start") { await wakeOnSessionStart(selectedDevice.id); startSession(selectedDevice.id, { amount, minutes }); } else addTime(selectedDevice.id, { amount, minutes }); } setShowPayment(false); }} />
      <InputModal key={`add-${showAdd}`} visible={showAdd} title="إضافة جهاز جديد" label="اسم الجهاز" placeholder={`مثال: جهاز ${devices.length + 1}`} confirmLabel="إضافة الجهاز" onClose={() => setShowAdd(false)} onConfirm={(name) => addDevice(name)} />
      <DeviceOptionsModal key={`${selectedDevice?.id ?? "none"}-${showOptions}`} visible={showOptions} device={selectedDevice} onClose={() => setShowOptions(false)} onRename={(name) => { if (selectedDevice) renameDevice(selectedDevice.id, name); }} onColor={(color) => { if (selectedDevice) recolorDevice(selectedDevice.id, color); }} onDelete={() => { if (selectedDevice) setConfirmDelete(selectedDevice); setShowOptions(false); }} />
      <DisplayConnectionModal visible={showDisplayConnection} device={selectedDevice} onClose={() => setShowDisplayConnection(false)} onConnect={(mode) => { if (selectedDevice) connectDisplay(selectedDevice.id, mode); }} onDisconnect={() => { if (selectedDevice) disconnectDisplay(selectedDevice.id); }} onPower={(power) => { if (selectedDevice) setDisplayPower(selectedDevice.id, power); }} />
      <ScreenLinkModal visible={showScreenLink} consoleId={linkTarget?.id ?? ""} consoleName={linkTarget?.name ?? ""} availableScreens={screens} discovering={discovering} onDiscover={() => { void discover(); }} onLink={(screen) => { if (linkTarget) connectDisplay(linkTarget.id, screen.connectionType, screen); }} onClose={() => setShowScreenLink(false)} />
      <ConfirmModal visible={!!confirmDelete} title="حذف الجهاز؟" message={`سيتم حذف ${confirmDelete?.name ?? "الجهاز"} من الشبكة. السجل السابق سيبقى محفوظاً.`} onClose={() => setConfirmDelete(undefined)} onConfirm={() => { if (confirmDelete) deleteDevice(confirmDelete.id); setConfirmDelete(undefined); }} />
    </Page>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingMark: { width: 72, height: 72, borderRadius: 24, backgroundColor: `${palette.primary}30`, alignItems: "center", justifyContent: "center" },
  loadingTitle: { color: palette.text, fontSize: 20, fontWeight: "900" },
  loadingText: { color: palette.muted, fontSize: 13 },
  headerAdd: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: palette.primary },
  headerAddText: { color: palette.text, fontSize: 12, fontWeight: "800" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerConnect: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 10, paddingHorizontal: 11, borderRadius: 12, backgroundColor: `${palette.primary}22`, borderWidth: 1, borderColor: `${palette.primarySoft}55` },
  headerConnectText: { color: palette.primarySoft, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  metricsRow: { flexDirection: "row", gap: 9, marginBottom: 19, flexWrap: "wrap" },
  fullNotice: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 17, borderWidth: 1, borderColor: `${palette.orange}55`, backgroundColor: `${palette.orange}10`, padding: 12, marginBottom: 19 },
  noticeIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: `${palette.orange}22`, alignItems: "center", justifyContent: "center" },
  noticeTitle: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right" },
  noticeText: { color: palette.muted, fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 2 },
  countText: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, width: "100%" },
  singleColumn: { width: "100%" },
  multiColumn: { flex: 1, minWidth: 245 },
  tip: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6, paddingVertical: 19 },
  tipText: { color: palette.muted, fontSize: 11, textAlign: "right" },
  fab: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: palette.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, shadowColor: palette.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  fabText: { color: palette.text, fontSize: 12, fontWeight: "800" },
});
