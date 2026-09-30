import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton, palette } from "@/components/app-ui";

export function InputModal({ visible, title, label, placeholder, initialValue = "", confirmLabel, onClose, onConfirm }: { visible: boolean; title: string; label: string; placeholder: string; initialValue?: string; confirmLabel: string; onClose: () => void; onConfirm: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}><Pressable style={styles.backdrop} onPress={onClose} /><View style={styles.modal}>
        <View style={styles.header}><Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={21} color={palette.muted} /></Pressable><Text style={styles.title}>{title}</Text></View>
        <Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={setValue} placeholder={placeholder} placeholderTextColor={palette.muted} style={styles.input} textAlign="right" autoFocus />
        <ActionButton label={confirmLabel} icon="checkmark-circle" onPress={() => { if (value.trim()) { onConfirm(value.trim()); onClose(); } }} disabled={!value.trim()} />
      </View></View>
    </Modal>
  );
}

export function ConfirmModal({ visible, title, message, confirmLabel = "تأكيد", onClose, onConfirm }: { visible: boolean; title: string; message: string; confirmLabel?: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}><Pressable style={styles.backdrop} onPress={onClose} /><View style={styles.confirmModal}>
        <View style={styles.warningIcon}><Ionicons name="warning" size={26} color={palette.warning} /></View><Text style={styles.confirmTitle}>{title}</Text><Text style={styles.message}>{message}</Text>
        <View style={styles.confirmActions}><ActionButton label="إلغاء" icon="close" onPress={onClose} tone="secondary" small /><ActionButton label={confirmLabel} icon="trash-outline" onPress={onConfirm} tone="danger" small /></View>
      </View></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 18 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(4, 3, 12, 0.78)" },
  modal: { width: "100%", maxWidth: 480, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 24, padding: 20, gap: 12 },
  confirmModal: { width: "100%", maxWidth: 420, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 24, padding: 22, gap: 11, alignItems: "center" },
  header: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  close: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.elevated, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: palette.text, fontSize: 22, fontWeight: "900", textAlign: "right" },
  label: { color: palette.muted, fontSize: 12, fontWeight: "700", textAlign: "right", alignSelf: "stretch" },
  input: { width: "100%", height: 50, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, color: palette.text, paddingHorizontal: 14, fontSize: 16, fontWeight: "700" },
  warningIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: `${palette.warning}20`, alignItems: "center", justifyContent: "center" },
  confirmTitle: { color: palette.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  message: { color: palette.muted, fontSize: 13, lineHeight: 21, textAlign: "center" },
  confirmActions: { width: "100%", flexDirection: "row", gap: 9 },
});
