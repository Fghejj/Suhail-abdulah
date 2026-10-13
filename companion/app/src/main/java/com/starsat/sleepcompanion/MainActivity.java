package com.starsat.sleepcompanion;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends android.app.Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(48, 48, 48, 48); root.setBackgroundColor(Color.rgb(17, 24, 39));
        TextView title = text("StarSat Sleep Companion", 26, Color.WHITE);
        TextView details = text("يعمل هذا التطبيق كمرافق محلي. لا يعلن نجاح السكون إلا إذا أكد نظام Android أن الشاشة أصبحت غير تفاعلية.", 18, Color.LTGRAY);
        TextView status = text("جارٍ تشغيل خادم TLS والاقتران عبر شبكة Wi‑Fi...", 20, Color.WHITE);
        root.addView(title); root.addView(details); root.addView(status);
        setContentView(root);
        Intent service = new Intent(this, CompanionService.class);
        if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(service); else startService(service);
        status.postDelayed(() -> {
            String pin = CompanionService.pairingPin();
            status.setText(pin == null ? "تعذر تشغيل خادم المرافق. راجع سجل النظام." : "رمز الاقتران:\n" + pin + "\n\nلا يُعتبر أمر السكون ناجحًا إلا بعد تأكيد حالة الشاشة.");
        }, 1200L);
    }
    private TextView text(String value, int size, int color) { TextView v = new TextView(this); v.setText(value); v.setTextSize(size); v.setTextColor(color); v.setPadding(0, 0, 0, 28); return v; }
}
