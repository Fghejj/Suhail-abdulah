import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import type { ConnectionType, ScreenDevice, ScreenType } from "@/services/ScreenControlService";
import { palette } from "@/components/app-ui";

interface ScreenLinkModalProps {
  visible: boolean;
  consoleId: string;
  consoleName: string;
  availableScreens: ScreenDevice[];
  discovering?: boolean;
  onDiscover?: () => void;
  onLink: (screen: ScreenDevice) => void;
  onClose: () => void;
}

const screenTypes: { value: ScreenType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "samsung", label: "Samsung Tizen", icon: "tv-outline" },
  { value: "lg", label: "LG WebOS", icon: "tv-outline" },
  { value: "android_tv", label: "Android TV", icon: "logo-android" },
  { value: "sony", label: "Sony Bravia", icon: "tv-outline" },
  { value: "philips", label: "Philips", icon: "tv-outline" },
  { value: "ps4", label: "PlayStation 4", icon: "game-controller-outline" },
  { value: "ps5", label: "PlayStation 5", icon: "game-controller-outline" },
];

const connectionTypes: { value: ConnectionType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "lan", label: "شبكة محلية IP", icon: "globe-outline" },
  { value: "bluetooth", label: "Bluetooth", icon: "bluetooth" },
  { value: "hotspot", label: "نقطة اتصال", icon: "wifi-outline" },
];

export function ScreenLinkModal({ visible, consoleId, consoleName, availableScreens, discovering = false, onDiscover, onLink, onClose }: ScreenLinkModalProps) {
  const [step, setStep] = useState<"select" | "manual">("select");
  const [selectedType, setSelectedType] = useState<ScreenType>("samsung");
  const [connection, setConnection] = useState<ConnectionType>("lan");
  const [ip, setIp] = useState("");
  const [mac, setMac] = useState("");
  const [name, setName] = useState("");
  const [autoStandby, setAutoStandby] = useState(true);
  const [error, setError] = useState("");

  const resetForm = () => {
    setIp("");
    setMac("");
    setName("");
    setAutoStandby(true);
    setError("");
    setStep("select");
  };

  const close = () => {
    resetForm();
    onClose();
  };

  const selectScreen = (screen: ScreenDevice) => {
    onLink({ ...screen, linkedConsoleId: consoleId, autoStandby });
    close();
  };

  const handleManualLink = () => {
    if (connection === "lan" && !ip.trim()) {
      setError("أدخل عنوان IP للشاشة قبل المتابعة.");
      return;
    }
    const newScreen: ScreenDevice = {
      id: `manual-${Date.now()}`,
      name: name.trim() || `${selectedType} (${ip.trim() || connection})`,
      type: selectedType,
      ip: ip.trim(),
      mac: mac.trim() || undefined,
      connectionType: connection,
      status: "unknown",
      linkedConsoleId: consoleId,
      autoStandby,
    };
    onLink(newScreen);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Pressable onPress={close} style={styles.closeButton}><Ionicons name="close" size={21} color={palette.muted} /></Pressable>
            <View style={styles.headerCopy}><Text style={styles.kicker}>ربط شاشة بالبلايستيشن</Text><Text style={styles.title}>{consoleName}</Text></View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {step === "select" ? <>
              <View style={styles.discoveryHeader}><Text style={styles.sectionTitle}>الشاشات المكتشفة</Text><Pressable disabled={discovering} onPress={onDiscover} style={styles.scanButton}><Ionicons name="scan" size={15} color={palette.primarySoft} /><Text style={styles.scanText}>{discovering ? "جارٍ البحث" : "بحث"}</Text></Pressable></View>
              {availableScreens.length > 0 ? availableScreens.map((screen) => <Pressable key={screen.id} onPress={() => selectScreen(screen)} style={({ pressed }) => [styles.discoveredItem, pressed && styles.pressed]}><View style={styles.deviceIcon}><Ionicons name="tv-outline" size={19} color={palette.success} /></View><View style={styles.discoveredCopy}><Text style={styles.discoveredName}>{screen.name}</Text><Text style={styles.discoveredMeta}>{screen.ip || "بدون IP"} · {screen.connectionType.toUpperCase()}</Text></View><Ionicons name="chevron-back" size={18} color={palette.muted} /></Pressable>) : <View style={styles.empty}><Ionicons name="search-outline" size={25} color={palette.muted} /><Text style={styles.emptyText}>لم يتم العثور على شاشات بعد</Text></View>}
              <Pressable style={styles.manualButton} onPress={() => { setError(""); setStep("manual"); }}><Ionicons name="add-circle-outline" size={19} color={palette.text} /><Text style={styles.manualText}>إضافة شاشة يدوياً</Text></Pressable>
            </> : <>
              <View style={styles.sectionHeader}><Pressable onPress={() => setStep("select")}><Ionicons name="arrow-forward" size={20} color={palette.primarySoft} /></Pressable><Text style={styles.sectionTitle}>بيانات الشاشة</Text></View>
              <Text style={styles.fieldLabel}>نوع الشاشة</Text>
              <View style={styles.chips}>{screenTypes.map((type) => <Pressable key={type.value} onPress={() => setSelectedType(type.value)} style={[styles.chip, selectedType === type.value && styles.chipActive]}><Ionicons name={type.icon} size={17} color={selectedType === type.value ? palette.text : palette.muted} /><Text style={[styles.chipText, selectedType === type.value && styles.chipTextActive]}>{type.label}</Text></Pressable>)}</View>
              <Text style={styles.fieldLabel}>طريقة الربط</Text>
              <View style={styles.chips}>{connectionTypes.map((type) => <Pressable key={type.value} onPress={() => setConnection(type.value)} style={[styles.chip, connection === type.value && styles.chipActive]}><Ionicons name={type.icon} size={17} color={connection === type.value ? palette.text : palette.muted} /><Text style={[styles.chipText, connection === type.value && styles.chipTextActive]}>{type.label}</Text></Pressable>)}</View>
              <Text style={styles.fieldLabel}>معلومات اختيارية</Text>
              <TextInput value={name} onChangeText={setName} placeholder="اسم الشاشة" placeholderTextColor={palette.muted} style={styles.input} textAlign="right" />
              {connection === "lan" ? <TextInput value={ip} onChangeText={setIp} placeholder="عنوان IP مثل 192.168.1.100" placeholderTextColor={palette.muted} keyboardType="numeric" autoCapitalize="none" style={styles.input} textAlign="right" /> : null}
              <TextInput value={mac} onChangeText={setMac} placeholder="عنوان MAC (اختياري)" placeholderTextColor={palette.muted} autoCapitalize="characters" style={styles.input} textAlign="right" />
              <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.switchTitle}>سكون تلقائي بعد الجلسة</Text><Text style={styles.switchDescription}>يتم طلب السكون عند انتهاء وقت الجهاز</Text></View><Switch value={autoStandby} onValueChange={setAutoStandby} trackColor={{ false: palette.border, true: `${palette.success}88` }} thumbColor={autoStandby ? palette.success : palette.muted} /></View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}><Pressable onPress={() => setStep("select")} style={styles.backButton}><Text style={styles.backText}>رجوع</Text></Pressable><Pressable onPress={handleManualLink} style={styles.linkButton}><Ionicons name="link" size={17} color={palette.text} /><Text style={styles.linkText}>ربط الشاشة</Text></Pressable></View>
            </>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(4, 3, 12, 0.8)" },
  modal: { width: "100%", maxWidth: 560, maxHeight: "88%", backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 },
  closeButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.elevated, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  kicker: { color: palette.primarySoft, fontSize: 11, fontWeight: "800", textAlign: "right" },
  title: { color: palette.text, fontSize: 22, fontWeight: "900", textAlign: "right", marginTop: 3 },
  content: { gap: 11, paddingBottom: 12 },
  discoveryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: "900", textAlign: "right" },
  scanButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: `${palette.primary}22`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  scanText: { color: palette.primarySoft, fontSize: 11, fontWeight: "800" },
  discoveredItem: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, borderRadius: 15, padding: 11 },
  pressed: { opacity: 0.72 },
  deviceIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: `${palette.success}18`, alignItems: "center", justifyContent: "center" },
  discoveredCopy: { flex: 1 },
  discoveredName: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right" },
  discoveredMeta: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  empty: { alignItems: "center", gap: 5, paddingVertical: 18 },
  emptyText: { color: palette.muted, fontSize: 11 },
  manualButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: palette.primary, borderRadius: 13, paddingVertical: 13 },
  manualText: { color: palette.text, fontSize: 13, fontWeight: "800" },
  fieldLabel: { color: palette.muted, fontSize: 11, fontWeight: "800", textAlign: "right", marginTop: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, justifyContent: "flex-end" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: palette.border, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 9, backgroundColor: palette.elevated },
  chipActive: { borderColor: palette.primarySoft, backgroundColor: palette.primary },
  chipText: { color: palette.muted, fontSize: 10, fontWeight: "700" },
  chipTextActive: { color: palette.text },
  input: { height: 47, borderRadius: 13, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, color: palette.text, paddingHorizontal: 13, fontSize: 13 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, borderRadius: 14, padding: 12 },
  switchCopy: { flex: 1 },
  switchTitle: { color: palette.text, fontSize: 12, fontWeight: "800", textAlign: "right" },
  switchDescription: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  error: { color: palette.danger, backgroundColor: `${palette.danger}16`, borderRadius: 10, padding: 9, fontSize: 11, textAlign: "right" },
  actions: { flexDirection: "row", gap: 8, marginTop: 2 },
  backButton: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: palette.elevated, alignItems: "center", justifyContent: "center" },
  backText: { color: palette.muted, fontSize: 12, fontWeight: "800" },
  linkButton: { flex: 2, minHeight: 44, borderRadius: 13, backgroundColor: palette.success, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  linkText: { color: palette.text, fontSize: 12, fontWeight: "900" },
});
