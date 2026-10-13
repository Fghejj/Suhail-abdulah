package com.starsat.sleepcompanion;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.SystemClock;

import org.json.JSONObject;

import java.lang.reflect.Method;

final class SleepExecutor {
    private final Context context;

    SleepExecutor(Context context) { this.context = context.getApplicationContext(); }

    JSONObject capability() {
        JSONObject result = new JSONObject();
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean devicePower = context.checkSelfPermission(Manifest.permission.DEVICE_POWER) == PackageManager.PERMISSION_GRANTED;
        boolean television = context.getPackageManager().hasSystemFeature("android.software.leanback");
        try {
            result.put("api", Build.VERSION.SDK_INT);
            result.put("model", Build.MANUFACTURER + " " + Build.MODEL);
            result.put("televisionFeature", television);
            result.put("devicePowerPermission", devicePower);
            result.put("interactive", power != null && power.isInteractive());
            result.put("sleepSupported", devicePower && power != null);
            result.put("status", devicePower ? "READY_TO_TEST" : "UNSUPPORTED_SYSTEM_PERMISSION");
            if (!devicePower) result.put("reason", "PowerManager.goToSleep requires the privileged DEVICE_POWER permission");
        } catch (Exception ignored) { }
        return result;
    }

    JSONObject sleep() {
        JSONObject result = capability();
        try {
            if (!result.optBoolean("sleepSupported", false)) return result.put("status", "UNSUPPORTED_SYSTEM_PERMISSION");
            PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            Method goToSleep = PowerManager.class.getMethod("goToSleep", long.class);
            goToSleep.invoke(power, SystemClock.uptimeMillis());
            SystemClock.sleep(1500L);
            boolean interactive = power != null && power.isInteractive();
            result.put("interactiveAfterRequest", interactive);
            result.put("status", interactive ? "SENT_UNVERIFIED" : "VERIFIED_SLEEP");
            if (interactive) result.put("reason", "The system accepted the call but the display is still interactive");
        } catch (SecurityException e) {
            putFailure(result, "UNSUPPORTED_SYSTEM_PERMISSION", e.getMessage());
        } catch (Exception e) {
            Throwable cause = e.getCause() == null ? e : e.getCause();
            putFailure(result, "EXECUTION_FAILED", cause.getMessage());
        }
        return result;
    }

    private void putFailure(JSONObject result, String status, String reason) {
        try { result.put("status", status); result.put("reason", reason == null ? "Unknown platform error" : reason); }
        catch (Exception ignored) { }
    }
}
