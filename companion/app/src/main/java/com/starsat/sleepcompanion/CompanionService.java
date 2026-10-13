package com.starsat.sleepcompanion;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

public final class CompanionService extends Service {
    private static volatile CompanionService instance;
    private SleepCommandServer server;
    private static final String CHANNEL = "starsat-companion";

    @Override public void onCreate() {
        super.onCreate();
        instance = this;
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "StarSat Sleep Companion", NotificationManager.IMPORTANCE_LOW));
        Notification notification = new Notification.Builder(this, CHANNEL)
                .setContentTitle("StarSat Sleep Companion")
                .setContentText("Listening for authenticated sleep commands")
                .setSmallIcon(android.R.drawable.ic_lock_idle_lock).build();
        startForeground(1001, notification);
        server = new SleepCommandServer(this);
        try { server.start(); } catch (Exception e) { stopSelf(); }
    }

    @Override public void onDestroy() { if (server != null) server.stop(); super.onDestroy(); }
    @Override public int onStartCommand(Intent intent, int flags, int startId) { return START_STICKY; }
    static String pairingPin() { return instance == null || instance.server == null ? null : instance.server.getPin(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
