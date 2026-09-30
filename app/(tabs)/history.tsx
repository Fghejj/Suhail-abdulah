import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { HistoryFilter } from "@shared/ps-types";
import { ActionButton, AppHeader, IconButton, Page, Panel, Pill, SectionTitle, SegmentedControl, palette } from "@/components/app-ui";
import { ConfirmModal } from "@/components/input-modal";
import { filterSessions, formatDate, formatMinutes, formatMoney, totalRevenue } from "@/lib/formatters";
import { shareText } from "@/lib/platform-feedback";
import { useStore } from "@/lib/store";

const filters: HistoryFilter[] = ["day", "week", "month", "all"];
const labels: Record<HistoryFilter, string> = { day: "اليوم", week: "الأسبوع", month: "الشهر", all: "الكل" };

export default function HistoryScreen() {
  const { sessions, devices, deleteHistory } = useStore();
  const [filter, setFilter] = useState<HistoryFilter>("day");
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);
  const filtered = useMemo(() => filterSessions(sessions, filter, deviceId).sort((a, b) => b.endTime - a.endTime), [sessions, filter, deviceId]);
  const revenue = totalRevenue(filtered);

  const exportReport = () => {
    const rows = ["الجهاز,المدة,المبلغ,التاريخ,الحالة", ...filtered.map((session) => `${session.deviceName},${session.durationMinutes} دقيقة,${session.amountPaid},${formatDate(session.endTime)},${session.status === "completed" ? "مكتملة" : "ملغاة"}`)];
    void shareText(`ps-store-report-${filter}.csv`, rows.join("\n"));
  };

  return (
    <Page>
      <AppHeader title="السجل" subtitle="راجع الجلسات والأرباح السابقة" action={<IconButton icon="download-outline" label="تصدير التقرير" onPress={exportReport} tone="primary" />} />
      <Panel style={styles.summary}><View><Text style={styles.summaryLabel}>إجمالي الفترة</Text><Text style={styles.summaryValue}>{formatMoney(revenue)}</Text></View><View style={styles.summaryIcon}><Ionicons name="trending-up" size={24} color={palette.success} /></View></Panel>
      <SegmentedControl options={filters} value={filter} onChange={setFilter} labels={labels} />
      <SectionTitle title="تصفية حسب الجهاز" trailing={<Pressable onPress={() => setDeviceId(undefined)}><Text style={styles.clear}>مسح</Text></Pressable>} />
      <View style={styles.deviceFilters}>
        <Pressable onPress={() => setDeviceId(undefined)} style={[styles.deviceChip, !deviceId && styles.deviceChipActive]}><Text style={[styles.deviceChipText, !deviceId && styles.deviceChipTextActive]}>كل الأجهزة</Text></Pressable>
        {devices.map((device) => <Pressable key={device.id} onPress={() => setDeviceId(device.id)} style={[styles.deviceChip, deviceId === device.id && styles.deviceChipActive]}><View style={[styles.chipDot, { backgroundColor: device.color }]} /><Text style={[styles.deviceChipText, deviceId === device.id && styles.deviceChipTextActive]}>{device.name}</Text></Pressable>)}
      </View>
      <SectionTitle title="الجلسات" trailing={<Text style={styles.count}>{filtered.length} جلسة</Text>} />
      {filtered.length ? filtered.map((session) => <View key={session.id} style={styles.sessionRow}><View style={styles.sessionAmount}><Text style={styles.amount}>{formatMoney(session.amountPaid)}</Text><Text style={styles.date}>{formatDate(session.endTime)}</Text></View><View style={styles.sessionMain}><View style={styles.sessionTitleRow}><Pill label="مكتملة" color={palette.success} icon="checkmark-circle" /><Text style={styles.sessionName}>{session.deviceName}</Text></View><Text style={styles.sessionMeta}>{formatMinutes(session.durationMinutes)} · بدأ {formatDate(session.startTime)}</Text></View><View style={styles.sessionIcon}><Ionicons name="game-controller-outline" size={19} color={palette.primarySoft} /></View></View>) : <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={28} color={palette.primarySoft} /></View><Text style={styles.emptyTitle}>لا توجد جلسات هنا</Text><Text style={styles.emptyText}>ابدأ جلسة جديدة وستظهر تفاصيلها في هذا السجل.</Text></View>}
      <View style={styles.footerActions}><ActionButton label="تصدير CSV" icon="download-outline" onPress={exportReport} tone="secondary" small /><ActionButton label="حذف السجل" icon="trash-outline" onPress={() => setConfirm(true)} tone="danger" small /></View>
      <ConfirmModal visible={confirm} title="حذف السجل بالكامل؟" message="سيتم حذف كل الجلسات المحفوظة من هذا الجهاز. لا يمكن التراجع عن هذه العملية." onClose={() => setConfirm(false)} onConfirm={() => { deleteHistory(); setConfirm(false); }} />
    </Page>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  summaryLabel: { color: palette.muted, fontSize: 12, textAlign: "right" },
  summaryValue: { color: palette.text, fontSize: 26, fontWeight: "900", textAlign: "right", marginTop: 3 },
  summaryIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: `${palette.success}20`, alignItems: "center", justifyContent: "center" },
  clear: { color: palette.primarySoft, fontSize: 11, fontWeight: "800" },
  deviceFilters: { flexDirection: "row", gap: 7, flexWrap: "wrap", justifyContent: "flex-end", marginBottom: 10 },
  deviceChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999 },
  deviceChipActive: { backgroundColor: `${palette.primary}33`, borderColor: palette.primarySoft },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  deviceChipText: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  deviceChipTextActive: { color: palette.text },
  count: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  sessionRow: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 17, padding: 13, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  sessionIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: `${palette.primary}20`, alignItems: "center", justifyContent: "center" },
  sessionMain: { flex: 1, gap: 5 },
  sessionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 7 },
  sessionName: { color: palette.text, fontSize: 14, fontWeight: "800", textAlign: "right" },
  sessionMeta: { color: palette.muted, fontSize: 11, textAlign: "right" },
  sessionAmount: { alignItems: "flex-start", gap: 3 },
  amount: { color: palette.success, fontSize: 14, fontWeight: "900" },
  date: { color: palette.muted, fontSize: 10 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 55, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: `${palette.primary}20`, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  emptyTitle: { color: palette.text, fontSize: 17, fontWeight: "900" },
  emptyText: { color: palette.muted, fontSize: 12, textAlign: "center" },
  footerActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, paddingTop: 10, paddingBottom: 20 },
});
