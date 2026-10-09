package space.manus.psstorepro.t075075339828613;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.hari.androidtvremote.androidLib.AndroidRemoteTv;
import com.hari.androidtvremote.androidLib.AndroidTvListener;
import com.hari.androidtvremote.androidLib.remote.Remotemessage;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * React Native bridge for the Android TV Remote v2 protocol.
 *
 * Pairing uses real TLS/Protobuf traffic on 6467 and the remote session uses
 * 6466. The client identity is kept in the app-private androidtv.keystore.
 * This module deliberately reports command delivery separately from TV power
 * confirmation: Android TV Remote v2 exposes a POWER key, not a universal
 * read-back power-state API.
 */
public final class AndroidTvRemoteModule extends ReactContextBaseJavaModule {
  private static final long OPERATION_TIMEOUT_MS = 25_000L;
  private static final int PROBE_TIMEOUT_MS = 350;

  private final ExecutorService executor = Executors.newCachedThreadPool();
  private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
  private final Map<String, AndroidRemoteTv> remotes = new ConcurrentHashMap<>();
  private final Map<String, Object> hostLocks = new ConcurrentHashMap<>();
  private final Set<String> inFlightHosts = ConcurrentHashMap.newKeySet();
  private final Map<String, String> connectionStates = new ConcurrentHashMap<>();

  public AndroidTvRemoteModule(ReactApplicationContext context) { super(context); }

  @Override public String getName() { return "AndroidTvRemote"; }

  private Object lockFor(String host) {
    return hostLocks.computeIfAbsent(host, ignored -> new Object());
  }

  private String cleanHost(String host) { return host == null ? "" : host.trim(); }

  private String safeMessage(String message) {
    if (message == null || message.trim().isEmpty()) return "خطأ غير معروف";
    // Never expose pairing codes or long digit sequences in diagnostic events.
    return message.replaceAll("\\b\\d{6,8}\\b", "[redacted]");
  }

  private void event(String type, String host, String message) {
    try {
      WritableMap map = Arguments.createMap();
      map.putString("type", type);
      map.putString("host", host);
      if (message != null) map.putString("message", safeMessage(message));
      getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit("AndroidTvRemote", map);
    } catch (Exception ignored) {
      // The JS runtime may already be tearing down; never crash the protocol thread.
    }
  }

  private AndroidRemoteTv createRemote(String host) {
    AndroidRemoteTv remote = new AndroidRemoteTv();
    remote.setKeyStoreFile(getReactApplicationContext().getFileStreamPath("androidtv.keystore"));
    remotes.put(host, remote);
    return remote;
  }

  private boolean validHost(String host) {
    return host != null && !host.trim().isEmpty() && host.length() <= 253;
  }

  @ReactMethod
  public void pairWithCode(final String rawHost, final String code, final Promise promise) {
    final String host = cleanHost(rawHost);
    if (!validHost(host)) { promise.reject("INVALID_HOST", "عنوان IP الشاشة غير صالح"); return; }
    if (code == null || !code.matches("\\d{8}")) {
      promise.reject("INVALID_CODE", "رمز الاقتران يجب أن يكون 8 أرقام");
      return;
    }
    if (!inFlightHosts.add(host)) {
      promise.reject("BUSY", "يوجد اتصال جارٍ مع هذه الشاشة");
      return;
    }

    final AndroidRemoteTv remote = createRemote(host);
    final AtomicBoolean finished = new AtomicBoolean(false);
    connectionStates.put(host, "pairing");
    event("pairingStarted", host, null);

    Runnable timeout = () -> {
      if (finished.compareAndSet(false, true)) {
        connectionStates.put(host, "failed");
        try { remote.abort(); } catch (Exception ignored) {}
        inFlightHosts.remove(host);
        event("error", host, "انتهت مهلة الاقتران");
        promise.reject("PAIRING_TIMEOUT", "انتهت مهلة الاقتران؛ تحقق من IP والرمز والشبكة");
      }
    };
    scheduler.schedule(timeout, OPERATION_TIMEOUT_MS, TimeUnit.MILLISECONDS);

    executor.execute(() -> {
      try {
        remote.connect(host, new AndroidTvListener() {
          @Override public void onSessionCreated() { event("sessionCreated", host, null); }
          @Override public void onSecretRequested() {
            event("secretRequested", host, null);
            // The code is passed only to the protocol library and is never logged or emitted.
            remote.sendSecret(code);
          }
          @Override public void onPaired() { event("paired", host, null); }
          @Override public void onConnectingToRemote() {
            connectionStates.put(host, "connecting");
            event("connecting", host, null);
          }
          @Override public void onConnected() {
            connectionStates.put(host, "connected");
            event("connected", host, null);
            if (finished.compareAndSet(false, true)) promise.resolve(true);
            inFlightHosts.remove(host);
          }
          @Override public void onDisconnect() {
            connectionStates.put(host, "disconnected");
            event("disconnected", host, null);
          }
          @Override public void onImeShow(String text, int fieldCounter) { }
          @Override public void onError(String error) {
            connectionStates.put(host, "failed");
            event("error", host, error);
            if (finished.compareAndSet(false, true)) promise.reject("REMOTE_ERROR", safeMessage(error));
            inFlightHosts.remove(host);
          }
        });
      } catch (Exception error) {
        connectionStates.put(host, "failed");
        event("error", host, error.getMessage());
        if (finished.compareAndSet(false, true)) promise.reject("PAIRING_FAILED", safeMessage(error.getMessage()), error);
        inFlightHosts.remove(host);
      }
    });
  }

  /** Reopens 6466 using the already persisted client identity; it does not re-pair. */
  @ReactMethod
  public void reconnect(final String rawHost, final Promise promise) {
    final String host = cleanHost(rawHost);
    if (!validHost(host)) { promise.reject("INVALID_HOST", "عنوان IP الشاشة غير صالح"); return; }
    if (!inFlightHosts.add(host)) {
      promise.reject("BUSY", "يوجد اتصال جارٍ مع هذه الشاشة");
      return;
    }

    final AndroidRemoteTv remote = createRemote(host);
    final AtomicBoolean finished = new AtomicBoolean(false);
    connectionStates.put(host, "connecting");
    event("reconnectStarted", host, null);

    scheduler.schedule(() -> {
      if (finished.compareAndSet(false, true)) {
        connectionStates.put(host, "failed");
        try { remote.abort(); } catch (Exception ignored) {}
        inFlightHosts.remove(host);
        event("error", host, "انتهت مهلة إعادة الاتصال");
        promise.reject("RECONNECT_TIMEOUT", "تعذر إعادة الاتصال بالشاشة ضمن المهلة");
      }
    }, OPERATION_TIMEOUT_MS, TimeUnit.MILLISECONDS);

    executor.execute(() -> {
      try {
        remote.reconnect(host, new AndroidTvListener() {
          @Override public void onSessionCreated() { }
          @Override public void onSecretRequested() { }
          @Override public void onPaired() { }
          @Override public void onConnectingToRemote() { connectionStates.put(host, "connecting"); }
          @Override public void onConnected() {
            connectionStates.put(host, "connected");
            event("connected", host, null);
            if (finished.compareAndSet(false, true)) promise.resolve(true);
            inFlightHosts.remove(host);
          }
          @Override public void onDisconnect() {
            connectionStates.put(host, "disconnected");
            event("disconnected", host, null);
          }
          @Override public void onImeShow(String text, int fieldCounter) { }
          @Override public void onError(String error) {
            connectionStates.put(host, "failed");
            event("error", host, error);
            if (finished.compareAndSet(false, true)) promise.reject("RECONNECT_FAILED", safeMessage(error));
            inFlightHosts.remove(host);
          }
        });
      } catch (Exception error) {
        connectionStates.put(host, "failed");
        event("error", host, error.getMessage());
        if (finished.compareAndSet(false, true)) promise.reject("RECONNECT_FAILED", safeMessage(error.getMessage()), error);
        inFlightHosts.remove(host);
      }
    });
  }

  @ReactMethod
  public void sendKey(final String rawHost, final String key, final String direction, final Promise promise) {
    final String host = cleanHost(rawHost);
    final AndroidRemoteTv remote = remotes.get(host);
    if (remote == null || !"connected".equals(connectionStates.get(host)) || !remote.isSocketAlive()) {
      promise.reject("NOT_CONNECTED", "الشاشة غير متصلة؛ أعد الاتصال أولاً");
      return;
    }

    final Remotemessage.RemoteKeyCode keyCode = mapKey(key);
    if (keyCode == null) { promise.reject("INVALID_KEY", "زر غير مدعوم"); return; }
    final Remotemessage.RemoteDirection remoteDirection = mapDirection(direction);
    if (remoteDirection == null) { promise.reject("INVALID_DIRECTION", "اتجاه الزر غير مدعوم"); return; }

    // Serialize writes per TV. The protobuf stream must not receive interleaved commands.
    executor.execute(() -> {
      synchronized (lockFor(host)) {
        try {
          remote.sendCommand(keyCode, remoteDirection);
          promise.resolve(true);
        } catch (Exception error) {
          connectionStates.put(host, "disconnected");
          event("error", host, error.getMessage());
          promise.reject("SEND_FAILED", safeMessage(error.getMessage()), error);
        }
      }
    });
  }

  private Remotemessage.RemoteDirection mapDirection(String direction) {
    if ("START_LONG".equals(direction)) return Remotemessage.RemoteDirection.START_LONG;
    if ("END_LONG".equals(direction)) return Remotemessage.RemoteDirection.END_LONG;
    if (direction == null || "SHORT".equals(direction)) return Remotemessage.RemoteDirection.SHORT;
    return null;
  }

  private Remotemessage.RemoteKeyCode mapKey(String key) {
    if ("UP".equals(key)) return Remotemessage.RemoteKeyCode.KEYCODE_DPAD_UP;
    if ("DOWN".equals(key)) return Remotemessage.RemoteKeyCode.KEYCODE_DPAD_DOWN;
    if ("LEFT".equals(key)) return Remotemessage.RemoteKeyCode.KEYCODE_DPAD_LEFT;
    if ("RIGHT".equals(key)) return Remotemessage.RemoteKeyCode.KEYCODE_DPAD_RIGHT;
    if ("BACK".equals(key)) return Remotemessage.RemoteKeyCode.KEYCODE_BACK;
    if ("HOME".equals(key)) return Remotemessage.RemoteKeyCode.KEYCODE_HOME;
    if ("POWER".equals(key)) return Remotemessage.RemoteKeyCode.KEYCODE_POWER;
    if ("ENTER".equals(key) || "OK".equals(key)) return Remotemessage.RemoteKeyCode.KEYCODE_DPAD_CENTER;
    if ("VOLUME_UP".equals(key)) return Remotemessage.RemoteKeyCode.KEYCODE_VOLUME_UP;
    if ("VOLUME_DOWN".equals(key)) return Remotemessage.RemoteKeyCode.KEYCODE_VOLUME_DOWN;
    return null;
  }

  @ReactMethod
  public void isConnected(final String rawHost, final Promise promise) {
    final String host = cleanHost(rawHost);
    final AndroidRemoteTv remote = remotes.get(host);
    promise.resolve(remote != null && remote.isSocketAlive() && "connected".equals(connectionStates.get(host)));
  }

  /** Lightweight native TCP probe used for LAN discovery; it does not log or trust the host. */
  @ReactMethod
  public void probe(final String rawHost, final Promise promise) {
    final String host = cleanHost(rawHost);
    if (!validHost(host)) { promise.resolve(false); return; }
    executor.execute(() -> {
      boolean open = canConnect(host, 6466) || canConnect(host, 6467);
      promise.resolve(open);
    });
  }

  private boolean canConnect(String host, int port) {
    try (Socket socket = new Socket()) {
      socket.connect(new InetSocketAddress(host, port), PROBE_TIMEOUT_MS);
      return true;
    } catch (IOException ignored) {
      return false;
    }
  }

  @ReactMethod
  public void disconnect(String rawHost, Promise promise) {
    final String host = cleanHost(rawHost);
    AndroidRemoteTv remote = remotes.remove(host);
    if (remote != null) remote.abort();
    connectionStates.put(host, "disconnected");
    inFlightHosts.remove(host);
    event("disconnected", host, null);
    promise.resolve(true);
  }

  @Override public void invalidate() {
    for (AndroidRemoteTv remote : remotes.values()) {
      try { remote.abort(); } catch (Exception ignored) {}
    }
    remotes.clear();
    connectionStates.clear();
    inFlightHosts.clear();
    executor.shutdownNow();
    scheduler.shutdownNow();
    super.invalidate();
  }
}
