import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { Device, DisplayConnectionMode } from "@shared/ps-types";
import type { ControlResult } from "@/services/ScreenControlService";
import { ActionButton, Pill, palette } from "@/components/app-ui";

const modes: { id: DisplayConnectionMode; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { id: "bluetooth", label: "بلوتوث", icon: "bluetooth", description: "اكتشاف GATT؛ التحكم يحتاج بروتوكول الشركة" },
  { id: "hotspot", label: "نقطة اتصال", icon: "wifi", description: "شبكة محلية بدون إنترنت" },
  { id: "lan", label: "LAN / IP", icon: "git-network", description: "عنوان شبكة أو API محلي" },
];

export function DisplayConnectionModal({
  visible,
  device,
  onClose,
  onConnect,
  onDisconnect,
  onPower,
  busy = false,
  controlResult,
}: {
  visible: boolean;
  device?: Device;
  onClose: () => void;
  onConnect: (mode: DisplayConnectionMode) => void;
  onDisconnect: () => void;
  onPower: (power: "on" | "sleep" | "off" | "restart") => void | Promise<void>;
  busy?: boolean;
  controlResult?: ControlResult | null;
}) {
  if (!device) return null;
  const connected = Boolean(device.displayConnection);
  const powerLabel = device.displayPower === "on" ? "الشاشة تعمل" : device.displayPower === "sleep" ? "في وضع السكون" : device.displayPower === "restarting" ? "جارٍ إعادة التشغيل" : device.displayPower === "unknown" ? "الحالة غير مؤكدة" : "الشاشة متوقفة";
  const resultColor = controlResult?.success ? (controlResult.verified === false ? palette.warning : palette.success) : palette.danger;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={21} color={palette.muted} /></Pressable>
            <View style={{ flex: 1 }}><Text style={styles.kicker}>تحكم شاشة الجهاز</Text><Text style={styles.title}>{device.name}</Text></View>
          </View>

          <View style={styles.connectionStatus}>
            <View style={[styles.statusIcon, { backgroundColor: connected ? `${palette.success}20` : `${palette.warning}20` }]}><Ionicons name={connected ? "link" : "unlink"} size={20} color={connected ? palette.success : palette.warning} /></View>
            <View style={styles.statusCopy}><Text style={styles.statusTitle}>{connected ? "الشاشة مرتبطة" : "لا توجد شاشة مرتبطة"}</Text><Text style={styles.statusText}>{connected ? `${device.displayConnection?.label} · ${powerLabel}` : "اختر طريقة الربط الحقيقي لبدء التحكم"}</Text></View>
            <Pill label={connected ? "متصل" : "غير متصل"} color={connected ? palette.success : palette.warning} />
          </View>

          {controlResult ? <View style={[styles.resultBanner, { borderColor: `${resultColor}66`, backgroundColor: `${resultColor}12` }]}><Ionicons name={controlResult.success ? "information-circle" : "alert-circle"} size={17} color={resultColor} /><Text style={[styles.resultText, { color: resultColor }]}>{controlResult.message}</Text></View> : null}

          {!connected ? <>
            <Text style={styles.sectionLabel}>اختر طريقة الربط الحقيقي</Text>
            {modes.map((mode) => <Pressable key={mode.id} onPress={() => onConnect(mode.id)} style={({ pressed }) => [styles.modeRow, pressed && styles.pressed]}><View style={styles.modeIcon}><Ionicons name={mode.icon} size={20} color={palette.primarySoft} /></View><View style={styles.modeCopy}><Text style={styles.modeTitle}>{mode.label}</Text><Text style={styles.modeText}>{mode.description}</Text></View><Ionicons name="chevron-back" size={18} color={palette.muted} /></Pressable>)}
            <Text style={styles.note}>للتحكم الفعلي في StarSat استخدم Android TV ثم أدخل IP ورمز الاقتران من نافذة الربط المتقدمة.</Text>
          </> : <>
            <Text style={styles.sectionLabel}>تحكم فعلي عبر Native / TLS</Text>
            <View style={styles.powerGrid}>
              <ActionButton disabled={busy} label="تشغيل / طاقة" icon="power" onPress={() => { void onPower("on"); }} tone="success" small />
              <ActionButton disabled={busy} label="سكون / طاقة" icon="moon" onPress={() => { void onPower("sleep"); }} tone="secondary" small />
              <ActionButton disabled={busy} label="إيقاف" icon="stop-circle" onPress={() => { void onPower("off"); }} tone="danger" small />
              <ActionButton disabled={busy} label="إعادة إرسال" icon="refresh" onPress={() => { void onPower("restart"); }} tone="secondary" small />
            </View>
            {busy ? <View style={styles.busyRow}><ActivityIndicator color={palette.primarySoft} /><Text style={styles.busyText}>جارٍ إرسال الأمر ومنع الضغط المتزامن...</Text></View> : null}
            <ActionButton disabled={busy} label="فصل الشاشة" icon="unlink" onPress={onDisconnect} tone="danger" />
          </>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(4, 3, 12, 0.8)" },
  modal: { width: "100%", maxWidth: 540, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  close: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.elevated, alignItems: "center", justifyContent: "center" },
  kicker: { color: palette.primarySoft, fontSize: 11, fontWeight: "800", textAlign: "right" },
  title: { color: palette.text, fontSize: 23, fontWeight: "900", textAlign: "right", marginTop: 3 },
  connectionStatus: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: palette.elevated, borderRadius: 16, padding: 12 },
  statusIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  statusCopy: { flex: 1 },
  statusTitle: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right" },
  statusText: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  resultBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  resultText: { flex: 1, fontSize: 11, lineHeight: 17, textAlign: "right", fontWeight: "700" },
  sectionLabel: { color: palette.muted, fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 3 },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 15, padding: 11 },
  pressed: { opacity: 0.72 },
  modeIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: `${palette.primary}22`, alignItems: "center", justifyContent: "center" },
  modeCopy: { flex: 1 },
  modeTitle: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right" },
  modeText: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  note: { color: palette.muted, fontSize: 10, lineHeight: 17, textAlign: "right", backgroundColor: `${palette.warning}0D`, borderRadius: 12, padding: 10 },
  powerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  busyRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  busyText: { color: palette.muted, fontSize: 10, textAlign: "right" },
});
