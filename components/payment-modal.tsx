import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { AppSettings, Device } from "@shared/ps-types";
import { formatMinutes, formatMoney } from "@/lib/formatters";
import { ActionButton, palette } from "@/components/app-ui";

interface PaymentModalProps {
  visible: boolean;
  device?: Device;
  settings: AppSettings;
  mode: "start" | "extend";
  onClose: () => void;
  onConfirm: (amount: number, minutes: number) => void;
}

export function PaymentModal({ visible, device, settings, mode, onClose, onConfirm }: PaymentModalProps) {
  const [amountText, setAmountText] = useState("");
  const [minutesText, setMinutesText] = useState("");
  const [manual, setManual] = useState(false);

  const amount = Number(amountText.replace(/[^0-9.]/g, "")) || 0;
  const calculatedMinutes = useMemo(() => {
    if (manual) return Number(minutesText.replace(/[^0-9.]/g, "")) || 0;
    if (amount === settings.specialOfferAmount && settings.specialOfferMinutes > 0) return settings.specialOfferMinutes;
    return settings.pricePerMinute > 0 ? amount / settings.pricePerMinute : 0;
  }, [amount, manual, minutesText, settings]);

  const submit = () => {
    if (amount <= 0 || calculatedMinutes <= 0) return;
    onConfirm(amount, Math.max(1, Math.round(calculatedMinutes)));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={22} color={palette.muted} /></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>{mode === "extend" ? "إضافة وقت للجلسة" : "جلسة جديدة"}</Text>
              <Text style={styles.modalTitle}>{device?.name ?? "الجهاز"}</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>المبلغ المدفوع (ريال)</Text>
          <TextInput value={amountText} onChangeText={setAmountText} placeholder="مثال: 100" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={styles.input} textAlign="right" autoFocus />

          <View style={styles.modeRow}>
            <Text style={styles.fieldLabel}>{manual ? "المدة اليدوية" : "الوقت المحسوب تلقائياً"}</Text>
            <Pressable onPress={() => setManual((value) => !value)} style={styles.manualToggle}>
              <Ionicons name={manual ? "calculator" : "hand-left"} size={14} color={palette.primarySoft} />
              <Text style={styles.manualText}>{manual ? "استخدام التسعير" : "تشغيل يدوي"}</Text>
            </Pressable>
          </View>
          {manual ? <TextInput value={minutesText} onChangeText={setMinutesText} placeholder="عدد الدقائق" placeholderTextColor={palette.muted} keyboardType="number-pad" style={styles.input} textAlign="right" /> : null}

          <View style={styles.calculation}>
            <View><Text style={styles.calcLabel}>الوقت المضاف</Text><Text style={styles.calcValue}>{formatMinutes(calculatedMinutes)}</Text></View>
            <View style={styles.calcIcon}><Ionicons name="time" size={24} color={palette.primarySoft} /></View>
          </View>
          <Text style={styles.helper}>التسعير الحالي: {formatMoney(settings.pricePerMinute)} لكل دقيقة{settings.specialOfferAmount ? ` · عرض ${formatMoney(settings.specialOfferAmount)} = ${settings.specialOfferMinutes} دقيقة` : ""}</Text>
          <ActionButton label={mode === "extend" ? "تأكيد إضافة الوقت" : "تأكيد التشغيل"} icon="checkmark-circle" onPress={submit} disabled={amount <= 0 || calculatedMinutes <= 0} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(4, 3, 12, 0.78)" },
  modal: { width: "100%", maxWidth: 520, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 10 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  closeButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.elevated, alignItems: "center", justifyContent: "center" },
  kicker: { color: palette.primarySoft, fontSize: 11, fontWeight: "800", textAlign: "right" },
  modalTitle: { color: palette.text, fontSize: 24, fontWeight: "900", textAlign: "right", marginTop: 3 },
  fieldLabel: { color: palette.muted, fontSize: 12, fontWeight: "700", textAlign: "right" },
  input: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, color: palette.text, paddingHorizontal: 15, fontSize: 17, fontWeight: "700" },
  modeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  manualToggle: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5 },
  manualText: { color: palette.primarySoft, fontSize: 11, fontWeight: "800" },
  calculation: { marginTop: 5, borderRadius: 16, backgroundColor: `${palette.primary}22`, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  calcLabel: { color: palette.muted, fontSize: 11, textAlign: "right" },
  calcValue: { color: palette.text, fontSize: 22, fontWeight: "900", textAlign: "right", marginTop: 3 },
  calcIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: `${palette.primarySoft}18`, alignItems: "center", justifyContent: "center" },
  helper: { color: palette.muted, fontSize: 11, lineHeight: 18, textAlign: "right", marginBottom: 2 },
});
