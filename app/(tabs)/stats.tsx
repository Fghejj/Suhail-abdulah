import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppHeader, MetricCard, Page, Panel, SectionTitle, palette } from "@/components/app-ui";
import { filterSessions, formatMoney, formatMinutes, totalRevenue, average } from "@/lib/formatters";
import { useStore } from "@/lib/store";

const getDayBuckets = (sessions: ReturnType<typeof useStore>["sessions"]) => {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - (6 - index));
    const next = date.getTime() + 86_400_000;
    const value = sessions.filter((session) => session.endTime >= date.getTime() && session.endTime < next).reduce((sum, session) => sum + session.amountPaid, 0);
    return { label: new Intl.DateTimeFormat("ar-SA", { weekday: "short" }).format(date), value };
  });
};

export default function StatsScreen() {
  const { sessions, devices } = useStore();
  const today = filterSessions(sessions, "day");
  const week = filterSessions(sessions, "week");
  const month = filterSessions(sessions, "month");
  const buckets = useMemo(() => getDayBuckets(sessions), [sessions]);
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1);
  const mostUsed = devices.map((device) => ({ ...device, count: sessions.filter((session) => session.deviceId === device.id).length })).sort((a, b) => b.count - a.count).slice(0, 3);
  const averageMinutes = average(month.map((session) => session.durationMinutes));
  const averageAmount = average(month.map((session) => session.amountPaid));

  return (
    <Page>
      <AppHeader title="الإحصائيات" subtitle="نبض المحل بالأرقام" action={<View style={styles.headerBadge}><Ionicons name="analytics" size={17} color={palette.primarySoft} /><Text style={styles.headerBadgeText}>مباشر</Text></View>} />
      <View style={styles.metricsGrid}><MetricCard label="اليوم" value={formatMoney(totalRevenue(today))} icon="sunny" accent={palette.primarySoft} /><MetricCard label="هذا الأسبوع" value={formatMoney(totalRevenue(week))} icon="calendar" accent={palette.success} /><MetricCard label="هذا الشهر" value={formatMoney(totalRevenue(month))} icon="trending-up" accent={palette.orange} /><MetricCard label="الإجمالي" value={formatMoney(totalRevenue(sessions))} icon="wallet" accent={palette.warning} /></View>
      <Panel style={styles.chartPanel}><SectionTitle title="الأرباح اليومية" trailing={<Text style={styles.chartHint}>آخر ٧ أيام</Text>} /><View style={styles.chart}>{buckets.map((bucket) => <View key={bucket.label} style={styles.barColumn}><Text style={styles.barValue}>{bucket.value ? Math.round(bucket.value) : ""}</Text><View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(5, (bucket.value / max) * 100)}%` }]} /></View><Text style={styles.barLabel}>{bucket.label}</Text></View>)}</View></Panel>
      <View style={styles.splitRow}><Panel style={styles.halfPanel}><Text style={styles.panelKicker}>متوسط مدة الجلسة</Text><Text style={styles.bigValue}>{formatMinutes(averageMinutes)}</Text><Text style={styles.panelFoot}>خلال الشهر الحالي</Text></Panel><Panel style={styles.halfPanel}><Text style={styles.panelKicker}>متوسط قيمة الجلسة</Text><Text style={styles.bigValue}>{formatMoney(averageAmount)}</Text><Text style={styles.panelFoot}>{month.length} جلسة مسجلة</Text></Panel></View>
      <SectionTitle title="الأجهزة الأكثر استخداماً" />
      <Panel>{mostUsed.length ? mostUsed.map((device, index) => <View key={device.id} style={styles.rankRow}><View style={styles.rankNumber}><Text style={styles.rankText}>{index + 1}</Text></View><View style={[styles.deviceColor, { backgroundColor: device.color }]} /><View style={styles.rankMain}><Text style={styles.rankName}>{device.name}</Text><Text style={styles.rankMeta}>{device.count} جلسة · {formatMoney(totalRevenue(sessions.filter((session) => session.deviceId === device.id)))}</Text></View><Ionicons name="chevron-back" size={17} color={palette.muted} /></View>) : <Text style={styles.noData}>ستظهر المقارنة بعد إنهاء أول جلسة.</Text>}</Panel>
    </Page>
  );
}

const styles = StyleSheet.create({
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: `${palette.primary}22`, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  headerBadgeText: { color: palette.primarySoft, fontSize: 11, fontWeight: "800" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 15 },
  chartPanel: { marginBottom: 14 },
  chartHint: { color: palette.muted, fontSize: 11 },
  chart: { height: 190, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 6, paddingTop: 18 },
  barColumn: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  barValue: { color: palette.muted, fontSize: 9, height: 13 },
  barTrack: { height: 125, width: "70%", maxWidth: 32, borderRadius: 10, backgroundColor: palette.elevated, justifyContent: "flex-end", overflow: "hidden" },
  bar: { width: "100%", backgroundColor: palette.primarySoft, borderRadius: 10, minHeight: 6 },
  barLabel: { color: palette.muted, fontSize: 10 },
  splitRow: { flexDirection: "row", gap: 9, marginBottom: 12 },
  halfPanel: { flex: 1, minHeight: 110 },
  panelKicker: { color: palette.muted, fontSize: 11, textAlign: "right" },
  bigValue: { color: palette.text, fontSize: 22, fontWeight: "900", textAlign: "right", marginTop: 10 },
  panelFoot: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 4 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: `${palette.border}88` },
  rankNumber: { width: 27, height: 27, borderRadius: 10, backgroundColor: `${palette.primary}28`, alignItems: "center", justifyContent: "center" },
  rankText: { color: palette.primarySoft, fontSize: 12, fontWeight: "900" },
  deviceColor: { width: 8, height: 28, borderRadius: 5 },
  rankMain: { flex: 1 },
  rankName: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right" },
  rankMeta: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 2 },
  noData: { color: palette.muted, fontSize: 12, textAlign: "center", paddingVertical: 20 },
});
