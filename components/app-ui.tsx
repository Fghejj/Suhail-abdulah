import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const palette = {
  background: "#0F0F1A",
  surface: "#17172A",
  elevated: "#20203A",
  border: "#302B49",
  primary: "#6C2BD9",
  primarySoft: "#9B6CFF",
  text: "#F8F7FF",
  muted: "#A9A6BC",
  success: "#22C55E",
  warning: "#EAB308",
  danger: "#EF4444",
  orange: "#F97316",
};

export function Page({ children, scroll = true, contentContainerStyle }: PropsWithChildren<{ scroll?: boolean; contentContainerStyle?: StyleProp<ViewStyle> }>) {
  const inner = <View style={[styles.pageContent, contentContainerStyle]}>{children}</View>;
  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        {scroll ? <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>{inner}</ScrollView> : inner}
      </SafeAreaView>
    </View>
  );
}

export function AppHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>PS STORE MANAGER PRO</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Panel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function MetricCard({ label, value, icon, accent = palette.primarySoft, compact = false }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; accent?: string; compact?: boolean }) {
  return (
    <View style={[styles.metricCard, compact && styles.metricCardCompact]}>
      <View style={[styles.metricIcon, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={compact ? 16 : 18} color={accent} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, compact && styles.metricValueCompact]}>{value}</Text>
    </View>
  );
}

export function Pill({ label, color = palette.primarySoft, icon }: { label: string; color?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1C` }]}>
      {icon ? <Ionicons name={icon} size={13} color={color} /> : null}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function ActionButton({ label, icon, onPress, tone = "primary", disabled = false, small = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; tone?: "primary" | "secondary" | "danger" | "success"; disabled?: boolean; small?: boolean }) {
  const toneStyle = tone === "secondary" ? styles.secondaryButton : tone === "danger" ? styles.dangerButton : tone === "success" ? styles.successButton : styles.primaryButton;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, toneStyle, small && styles.smallButton, disabled && styles.disabledButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={small ? 15 : 17} color={tone === "secondary" ? palette.text : palette.text} />
      <Text style={[styles.actionButtonText, small && styles.smallButtonText]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, tone = "secondary" }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; tone?: "secondary" | "primary" | "danger" }) {
  const color = tone === "danger" ? palette.danger : tone === "primary" ? palette.primarySoft : palette.muted;
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, { backgroundColor: `${color}18` }, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

export function SectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{trailing}</View>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, labels }: { options: T[]; value: T; onChange: (value: T) => void; labels: Record<T, string> }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable key={option} onPress={() => onChange(option)} style={[styles.segment, value === option && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === option && styles.segmentTextActive]}>{labels[option]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 34 },
  pageContent: { width: "100%", maxWidth: 980, alignSelf: "center", paddingHorizontal: 18, paddingTop: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 20 },
  headerCopy: { flex: 1 },
  eyebrow: { color: palette.primarySoft, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, textAlign: "right", marginBottom: 5 },
  title: { color: palette.text, fontSize: 29, fontWeight: "800", textAlign: "right" },
  subtitle: { color: palette.muted, fontSize: 13, lineHeight: 20, textAlign: "right", marginTop: 4 },
  panel: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 20, padding: 14 },
  metricCard: { flex: 1, minWidth: 140, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 18, padding: 13, gap: 7 },
  metricCardCompact: { minWidth: 100, padding: 11 },
  metricIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  metricLabel: { color: palette.muted, fontSize: 12, fontWeight: "600", textAlign: "right" },
  metricValue: { color: palette.text, fontSize: 22, fontWeight: "800", textAlign: "right" },
  metricValueCompact: { fontSize: 18 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  pillText: { fontSize: 11, fontWeight: "800" },
  actionButton: { minHeight: 42, borderRadius: 13, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButton: { backgroundColor: palette.primary },
  secondaryButton: { backgroundColor: palette.elevated, borderWidth: 1, borderColor: palette.border },
  dangerButton: { backgroundColor: `${palette.danger}22`, borderWidth: 1, borderColor: `${palette.danger}55` },
  successButton: { backgroundColor: `${palette.success}22`, borderWidth: 1, borderColor: `${palette.success}55` },
  disabledButton: { opacity: 0.45 },
  actionButtonText: { color: palette.text, fontSize: 13, fontWeight: "800" },
  smallButton: { minHeight: 34, borderRadius: 10, paddingHorizontal: 10 },
  smallButtonText: { fontSize: 11 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 11, marginTop: 6 },
  sectionTitle: { color: palette.text, fontSize: 17, fontWeight: "800", textAlign: "right" },
  segmented: { flexDirection: "row", backgroundColor: palette.surface, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: palette.border },
  segment: { flex: 1, minHeight: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  segmentActive: { backgroundColor: palette.primary },
  segmentText: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  segmentTextActive: { color: palette.text },
});

export const sharedStyles = styles;
