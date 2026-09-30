import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { ActionButton, AppHeader, Page, Panel, SectionTitle, palette } from "@/components/app-ui";
import { ConfirmModal, InputModal } from "@/components/input-modal";
import { formatMoney } from "@/lib/formatters";
import { shareText } from "@/lib/platform-feedback";
import { useStore } from "@/lib/store";

function SettingRow({ icon, title, description, value, onValueChange }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return <View style={styles.settingRow}><Switch value={value} onValueChange={onValueChange} trackColor={{ false: palette.border, true: `${palette.primarySoft}88` }} thumbColor={value ? palette.primarySoft : palette.muted} /><View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View><View style={styles.settingIcon}><Ionicons name={icon} size={18} color={palette.primarySoft} /></View></View>;
}

export default function SettingsScreen() {
  const { devices, sessions, settings, addDevice, updateSettings, resetDailyRevenue, clearAllData } = useStore();
  const [price, setPrice] = useState(String(settings.pricePerMinute));
  const [offerAmount, setOfferAmount] = useState(String(settings.specialOfferAmount));
  const [offerMinutes, setOfferMinutes] = useState(String(settings.specialOfferMinutes));
  const [showAdd, setShowAdd] = useState(false);
  const [confirmType, setConfirmType] = useState<"daily" | "all">();

  const backup = () => void shareText("ps-store-backup.json", JSON.stringify({ devices, sessions, settings }, null, 2));
  const commitPrice = () => { const value = Number(price); if (value > 0) updateSettings({ pricePerMinute: value }); };
  const commitOffer = () => { const amount = Number(offerAmount); const minutes = Number(offerMinutes); if (amount > 0 && minutes > 0) updateSettings({ specialOfferAmount: amount, specialOfferMinutes: minutes }); };

  return (
    <Page>
      <AppHeader title="الإعدادات" subtitle="اضبط التسعير وسلوك التطبيق" action={<View style={styles.headerIcon}><Ionicons name="options" size={18} color={palette.primarySoft} /></View>} />
      <SectionTitle title="التسعير" />
      <Panel style={styles.panelGap}>
        <View style={styles.fieldRow}><View style={styles.fieldInfo}><Text style={styles.fieldTitle}>سعر الدقيقة</Text><Text style={styles.fieldHint}>التسعير الافتراضي للجلسات التلقائية</Text></View><View style={styles.inputWrap}><TextInput value={price} onChangeText={setPrice} onEndEditing={commitPrice} keyboardType="decimal-pad" style={styles.smallInput} textAlign="center" /><Text style={styles.inputSuffix}>ر.س</Text></View></View>
        <View style={styles.divider} />
        <View style={styles.fieldRow}><View style={styles.fieldInfo}><Text style={styles.fieldTitle}>العرض الخاص</Text><Text style={styles.fieldHint}>مثال: {formatMoney(settings.specialOfferAmount)} = {settings.specialOfferMinutes} دقيقة</Text></View><View style={styles.offerInputs}><TextInput value={offerMinutes} onChangeText={setOfferMinutes} onEndEditing={commitOffer} keyboardType="number-pad" style={styles.offerInput} textAlign="center" /><Text style={styles.inputSuffix}>د</Text><Text style={styles.equals}>=</Text><TextInput value={offerAmount} onChangeText={setOfferAmount} onEndEditing={commitOffer} keyboardType="decimal-pad" style={styles.offerInput} textAlign="center" /><Text style={styles.inputSuffix}>ر.س</Text></View></View>
        <View style={styles.divider} /><SettingRow icon="calculator" title="الحساب التلقائي" description="حوّل المبلغ إلى دقائق حسب السعر الحالي" value={settings.autoPricing} onValueChange={(value) => updateSettings({ autoPricing: value })} />
      </Panel>

      <SectionTitle title="التنبيهات" />
      <Panel style={styles.panelGap}><SettingRow icon="notifications" title="الإشعارات" description="أظهر تنبيهاً عند انتهاء الجلسة" value={settings.notificationsEnabled} onValueChange={(value) => updateSettings({ notificationsEnabled: value })} /><View style={styles.divider} /><SettingRow icon="volume-high" title="صوت التنبيه" description="نغمة قصيرة عند اكتمال الوقت" value={settings.soundEnabled} onValueChange={(value) => updateSettings({ soundEnabled: value })} /><View style={styles.divider} /><SettingRow icon="phone-portrait" title="الاهتزاز" description="اهتزاز الجهاز عند انتهاء الجلسة" value={settings.vibrationEnabled} onValueChange={(value) => updateSettings({ vibrationEnabled: value })} /><View style={styles.divider} /><SettingRow icon="moon" title="سكون الشاشة تلقائياً" description="ضع الشاشة المرتبطة في السكون عند انتهاء الجلسة" value={settings.autoSleepConnectedDisplays} onValueChange={(value) => updateSettings({ autoSleepConnectedDisplays: value })} /></Panel>

      <SectionTitle title="الأجهزة" trailing={<Pressable onPress={() => setShowAdd(true)}><Text style={styles.link}>إضافة جهاز</Text></Pressable>} />
      <Panel style={styles.panelGap}>{devices.map((device) => <View key={device.id} style={styles.deviceRow}><View style={[styles.deviceBar, { backgroundColor: device.color }]} /><View style={styles.deviceCopy}><Text style={styles.deviceName}>{device.name}</Text><Text style={styles.deviceStatus}>{device.status === "available" ? "متاح" : "لديه جلسة أو سجل سابق"}</Text></View><Ionicons name="ellipsis-horizontal" size={19} color={palette.muted} /></View>)}</Panel>

      <SectionTitle title="البيانات" />
      <Panel style={styles.panelGap}><ActionButton label="تصدير نسخة احتياطية" icon="cloud-download-outline" onPress={backup} tone="secondary" /><View style={styles.divider} /><Pressable onPress={() => setConfirmType("daily")} style={styles.dataAction}><View style={styles.dataIcon}><Ionicons name="refresh" size={17} color={palette.warning} /></View><View style={styles.dataCopy}><Text style={styles.dataTitle}>إعادة تعيين أرباح اليوم</Text><Text style={styles.dataHint}>يحذف جلسات اليوم من التقارير فقط</Text></View><Ionicons name="chevron-back" size={17} color={palette.muted} /></Pressable><View style={styles.divider} /><Pressable onPress={() => setConfirmType("all")} style={styles.dataAction}><View style={[styles.dataIcon, { backgroundColor: `${palette.danger}18` }]}><Ionicons name="trash" size={17} color={palette.danger} /></View><View style={styles.dataCopy}><Text style={styles.dataTitle}>حذف جميع البيانات</Text><Text style={styles.dataHint}>يعيد الأجهزة إلى جهازين ويمسح السجل</Text></View><Ionicons name="chevron-back" size={17} color={palette.muted} /></Pressable></Panel>
      <Text style={styles.version}>PS Store Manager Pro · الإصدار 1.0.0</Text>

      <InputModal key={`settings-add-${showAdd}`} visible={showAdd} title="إضافة جهاز" label="اسم الجهاز" placeholder={`جهاز ${devices.length + 1}`} confirmLabel="إضافة" onClose={() => setShowAdd(false)} onConfirm={(name) => addDevice(name)} />
      <ConfirmModal visible={!!confirmType} title={confirmType === "all" ? "حذف جميع البيانات؟" : "إعادة تعيين أرباح اليوم؟"} message={confirmType === "all" ? "سيتم حذف سجل الجلسات وإعادة الأجهزة والإعدادات إلى الوضع الأساسي." : "سيتم حذف الجلسات المنتهية اليوم من الأرباح المعروضة."} confirmLabel="متابعة" onClose={() => setConfirmType(undefined)} onConfirm={() => { if (confirmType === "all") clearAllData(); else resetDailyRevenue(); setConfirmType(undefined); }} />
    </Page>
  );
}

const styles = StyleSheet.create({
  headerIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: `${palette.primary}22`, alignItems: "center", justifyContent: "center" },
  panelGap: { gap: 2, marginBottom: 8 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11 },
  settingCopy: { flex: 1 },
  settingIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: `${palette.primary}20`, alignItems: "center", justifyContent: "center" },
  settingTitle: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right" },
  settingDescription: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  divider: { height: 1, backgroundColor: `${palette.border}88` },
  fieldRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 11 },
  fieldInfo: { flex: 1 },
  fieldTitle: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right" },
  fieldHint: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  smallInput: { width: 68, height: 38, borderRadius: 11, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, color: palette.text, fontWeight: "800" },
  inputSuffix: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  offerInputs: { flexDirection: "row", alignItems: "center", gap: 4 },
  offerInput: { width: 45, height: 36, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, color: palette.text, fontSize: 12, fontWeight: "800" },
  equals: { color: palette.muted, fontSize: 12, marginHorizontal: 1 },
  link: { color: palette.primarySoft, fontSize: 11, fontWeight: "800" },
  deviceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: `${palette.border}88` },
  deviceBar: { width: 6, height: 34, borderRadius: 4 },
  deviceCopy: { flex: 1 },
  deviceName: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right" },
  deviceStatus: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 2 },
  dataAction: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  dataIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: `${palette.warning}18`, alignItems: "center", justifyContent: "center" },
  dataCopy: { flex: 1 },
  dataTitle: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right" },
  dataHint: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 3 },
  version: { color: palette.muted, fontSize: 10, textAlign: "center", paddingVertical: 20 },
});
