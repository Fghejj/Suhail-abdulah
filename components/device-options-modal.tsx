import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { Device } from "@shared/ps-types";
import { ActionButton, palette } from "@/components/app-ui";

const colors = ["#6C2BD9", "#2563EB", "#DB2777", "#0891B2", "#16A34A", "#CA8A04"];

export function DeviceOptionsModal({ visible, device, onClose, onRename, onDelete, onColor }: { visible: boolean; device?: Device; onClose: () => void; onRename: (name: string) => void; onDelete: () => void; onColor: (color: string) => void }) {
  const [name, setName] = useState(device?.name ?? "");
  if (!device) return null;
  const canDelete = device.status === "available" || device.status === "finished";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.close}><Ionicons name="close" size={21} color={palette.muted} /></Pressable>
            <View style={{ flex: 1 }}><Text style={styles.kicker}>إدارة الجهاز</Text><Text style={styles.title}>{device.name}</Text></View>
          </View>
          <Text style={styles.label}>اسم الجهاز</Text>
          <View style={styles.renameRow}>
            <Pressable onPress={() => { onRename(name); onClose(); }} style={styles.saveName}><Ionicons name="checkmark" size={18} color={palette.text} /></Pressable>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={palette.muted} textAlign="right" />
          </View>
          <Text style={styles.label}>لون البطاقة</Text>
          <View style={styles.colors}>{colors.map((color) => <Pressable key={color} onPress={() => onColor(color)} style={[styles.color, { backgroundColor: color }, device.color === color && styles.selectedColor]}><Ionicons name="checkmark" size={17} color={palette.text} style={{ opacity: device.color === color ? 1 : 0 }} /></Pressable>)}</View>
          <ActionButton label={canDelete ? "حذف الجهاز" : "لا يمكن حذف جهاز مشغول"} icon="trash-outline" onPress={onDelete} tone="danger" disabled={!canDelete} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(4, 3, 12, 0.78)" },
  modal: { width: "100%", maxWidth: 520, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 12 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 3 },
  close: { width: 36, height: 36, borderRadius: 12, backgroundColor: palette.elevated, alignItems: "center", justifyContent: "center" },
  kicker: { color: palette.primarySoft, fontSize: 11, fontWeight: "800", textAlign: "right" },
  title: { color: palette.text, fontSize: 23, fontWeight: "900", textAlign: "right", marginTop: 3 },
  label: { color: palette.muted, fontSize: 12, fontWeight: "700", textAlign: "right" },
  renameRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  saveName: { width: 48, height: 48, borderRadius: 14, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, color: palette.text, paddingHorizontal: 14, fontSize: 16, fontWeight: "700" },
  colors: { flexDirection: "row", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" },
  color: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  selectedColor: { borderWidth: 3, borderColor: palette.text },
});
