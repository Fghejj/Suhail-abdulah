import { Platform, Share, Vibration } from "react-native";
import * as Haptics from "expo-haptics";

import type { AppSettings } from "@shared/ps-types";

export async function triggerSessionFeedback(settings: AppSettings, deviceName: string) {
  if (settings.vibrationEnabled) {
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([180, 100, 180]);
    } else {
      Vibration.vibrate([0, 180, 100, 180]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }
  if (settings.soundEnabled && Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const context = new AudioContextCtor();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 740;
        gain.gain.setValueAtTime(0.05, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.4);
      }
    } catch {
      // بعض المتصفحات تمنع الصوت دون تفاعل مباشر، لذا يكفي التنبيه المرئي.
    }
  }
  return deviceName;
}

export async function shareText(filename: string, content: string) {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: content });
}
