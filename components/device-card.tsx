import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Device } from "@shared/ps-types";
import { formatDuration, formatMoney, statusColor, statusIcon, statusLabel } from "@/lib/formatters";
import { ActionButton, IconButton, palette, Pill } from "@/components/app-ui";

interface DeviceCardProps {
  device: Device;
  onStart: () => void;
  onEnd: () => void;
  onExtend: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onOptions: () => void;
  onDisplay: () => void;
}

export function DeviceCard({ device, onStart, onEnd, onExtend, onPause, onResume, onRestart, onOptions, onDisplay }: DeviceCardProps) {
  const color = statusColor[device.status];
  const isRunning = device.status === "active" || device.status === "paused";
  const remaining = isRunning ? device.currentSession?.remainingSeconds ?? 0 : 0;

  return (
    <Pressable onLongPress={onOptions} delayLongPress={420} style={({ pressed }) => [styles.card, { borderTopColor: device.color, borderTopWidth: 3 }, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <IconButton icon="ellipsis-horizontal" label="خيارات الجهاز" onPress={onOptions} />
        <View style={styles.nameWrap}>
          <Text style={styles.deviceNumber}>{device.id.startsWith("device-") ? `#${device.id.split("-")[1] || "1"}` : "#"}</Text>
          <Text style={styles.deviceName}>{device.name}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <Pill label={statusLabel[device.status]} color={color} icon={statusIcon[device.status]} />
        <View style={[styles.statusDot, { backgroundColor: color }]} />
      </View>

      <Pressable onPress={onDisplay} style={({ pressed }) => [styles.displayLink, pressed && styles.pressed]}>
        <Ionicons name={device.displayConnection ? (device.displayPower === "sleep" ? "moon" : "tv") : "tv-outline"} size={14} color={device.displayConnection ? palette.success : palette.primarySoft} />
        <Text style={[styles.displayLinkText, { color: device.displayConnection ? palette.success : palette.primarySoft }]}>{device.displayConnection ? `الشاشة: ${device.displayPower === "sleep" ? "سكون" : device.displayPower === "off" ? "متوقفة" : device.displayPower === "restarting" ? "إعادة تشغيل" : "تعمل"}` : "ربط شاشة البلايستيشن"}</Text>
      </Pressable>

      <View style={styles.timerBlock}>
        <Text style={styles.timerLabel}>{device.status === "finished" ? "انتهت الجلسة" : isRunning ? "الوقت المتبقي" : "جاهز للتشغيل"}</Text>
        <Text style={[styles.timer, { color: device.status === "available" ? palette.text : color }]}>
          {isRunning ? formatDuration(remaining) : device.status === "finished" ? "00:00" : "--:--"}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>الجلسة</Text>
          <Text style={styles.metaValue}>{formatMoney(isRunning ? device.currentSession?.amountPaid ?? 0 : device.lastAmount)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>المدة</Text>
          <Text style={styles.metaValue}>{isRunning ? `${device.currentSession?.durationMinutes ?? 0} د` : device.lastDurationMinutes ? `${device.lastDurationMinutes} د` : "—"}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {device.status === "available" ? <ActionButton label="تشغيل الجهاز" icon="play" onPress={onStart} /> : null}
        {device.status === "finished" ? <ActionButton label="إعادة التشغيل" icon="refresh" onPress={onRestart} tone="danger" /> : null}
        {device.status === "active" ? (
          <>
            <ActionButton label="إنهاء" icon="stop-circle" onPress={onEnd} tone="danger" small />
            <ActionButton label="إضافة وقت" icon="add-circle" onPress={onExtend} small />
            <ActionButton label="إيقاف مؤقت" icon="pause" onPress={onPause} tone="secondary" small />
          </>
        ) : null}
        {device.status === "paused" ? (
          <>
            <ActionButton label="إنهاء" icon="stop-circle" onPress={onEnd} tone="danger" small />
            <ActionButton label="استئناف" icon="play" onPress={onResume} tone="success" small />
            <ActionButton label="إضافة وقت" icon="add-circle" onPress={onExtend} tone="secondary" small />
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 20, padding: 14, gap: 10, minHeight: 285 },
  pressed: { opacity: 0.86 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  nameWrap: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  deviceNumber: { color: palette.primarySoft, fontSize: 11, fontWeight: "800" },
  deviceName: { color: palette.text, fontSize: 18, fontWeight: "800", textAlign: "right" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  timerBlock: { backgroundColor: palette.elevated, borderRadius: 16, alignItems: "center", paddingVertical: 13 },
  timerLabel: { color: palette.muted, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  timer: { fontVariant: ["tabular-nums"], fontSize: 35, fontWeight: "900", letterSpacing: 1.5 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  metaItem: { flex: 1, gap: 3 },
  metaLabel: { color: palette.muted, fontSize: 11, textAlign: "right" },
  metaValue: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right" },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  displayLink: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5, paddingVertical: 3 },
  displayLinkText: { fontSize: 11, fontWeight: "800" },
});
