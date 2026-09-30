import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette } from "@/components/app-ui";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primarySoft,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: [styles.tabBar, { height: 62 + bottomPadding, paddingBottom: bottomPadding }],
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: "السجل", tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} /> }} />
      <Tabs.Screen name="stats" options={{ title: "الإحصائيات", tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: "الإعدادات", tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: palette.surface, borderTopColor: palette.border, borderTopWidth: 1, paddingTop: 7 },
  label: { fontSize: 10, fontWeight: "700" },
  item: { minHeight: 54 },
});
