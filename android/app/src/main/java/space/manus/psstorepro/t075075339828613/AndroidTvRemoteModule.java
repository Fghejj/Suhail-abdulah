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

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * React Native bridge for the Android TV Remote v2 protocol.
 * Pairing is real TLS/Protobuf traffic on ports 6467 (pairing) and 6466 (remote).
 */
public final class AndroidTvRemoteModule extends ReactContextBaseJavaModule {
  private final ExecutorService executor = Executors.newCachedThreadPool();
  private final Map<String, AndroidRemoteTv> remotes = new ConcurrentHashMap<>();

  public AndroidTvRemoteModule(ReactApplicationContext context) { super(context); }

  @Override public String getName() { return "AndroidTvRemote"; }

  private void event(String type, String host, String message) {
    WritableMap map = Arguments.createMap();
    map.putString("type", type);
    map.putString("host", host);
    if (message != null) map.putString("message", message);
    getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit("AndroidTvRemote", map);
  }

  @ReactMethod
  public void pairWithCode(final String host, final String code, final Promise promise) {
    if (host == null || host.trim().isEmpty()) { promise.reject("INVALID_HOST", "عنوان IP الشاشة غير صالح"); return; }
    if (code == null || !code.matches("\\d{8}")) { promise.reject("INVALID_CODE", "رمز الاقتران يجب أن يكون 8 أرقام"); return; }
    executor.execute(() -> {
      final AndroidRemoteTv remote = new AndroidRemoteTv();
      remote.setKeyStoreFile(getReactApplicationContext().getFileStreamPath("androidtv.keystore"));
      remotes.put(host, remote);
      try {
        remote.connect(host, new AndroidTvListener() {
          @Override public void onSessionCreated() { event("sessionCreated", host, null); }
          @Override public void onSecretRequested() {
            event("secretRequested", host, null);
            remote.sendSecret(code);
          }
          @Override public void onPaired() { event("paired", host, null); }
          @Override public void onConnectingToRemote() { event("connecting", host, null); }
          @Override public void onConnected() { event("connected", host, null); promise.resolve(true); }
          @Override public void onDisconnect() { event("disconnected", host, null); }
          @Override public void onImeShow(String text, int fieldCounter) { }
          @Override public void onError(String error) { event("error", host, error); promise.reject("REMOTE_ERROR", error); }
        });
      } catch (Exception e) {
        event("error", host, e.getMessage());
        promise.reject("PAIRING_FAILED", e.getMessage(), e);
      }
    });
  }

  @ReactMethod
  public void sendKey(final String host, final String key, final Promise promise) {
    AndroidRemoteTv remote = remotes.get(host);
    if (remote == null) { promise.reject("NOT_CONNECTED", "الشاشة غير مرتبطة"); return; }
    Remotemessage.RemoteKeyCode keyCode;
    if ("UP".equals(key)) keyCode = Remotemessage.RemoteKeyCode.KEYCODE_DPAD_UP;
    else if ("DOWN".equals(key)) keyCode = Remotemessage.RemoteKeyCode.KEYCODE_DPAD_DOWN;
    else if ("LEFT".equals(key)) keyCode = Remotemessage.RemoteKeyCode.KEYCODE_DPAD_LEFT;
    else if ("RIGHT".equals(key)) keyCode = Remotemessage.RemoteKeyCode.KEYCODE_DPAD_RIGHT;
    else if ("BACK".equals(key)) keyCode = Remotemessage.RemoteKeyCode.KEYCODE_BACK;
    else if ("HOME".equals(key)) keyCode = Remotemessage.RemoteKeyCode.KEYCODE_HOME;
    else if ("POWER".equals(key)) keyCode = Remotemessage.RemoteKeyCode.KEYCODE_POWER;
    else if ("ENTER".equals(key)) keyCode = Remotemessage.RemoteKeyCode.KEYCODE_DPAD_CENTER;
    else { promise.reject("INVALID_KEY", "زر غير مدعوم: " + key); return; }
    try {
      remote.sendCommand(keyCode, Remotemessage.RemoteDirection.SHORT);
      promise.resolve(true);
    } catch (Exception e) { promise.reject("SEND_FAILED", e.getMessage(), e); }
  }

  @ReactMethod
  public void disconnect(String host, Promise promise) {
    AndroidRemoteTv remote = remotes.remove(host);
    if (remote != null) remote.abort();
    promise.resolve(true);
  }

  @Override public void invalidate() {
    for (AndroidRemoteTv remote : remotes.values()) remote.abort();
    remotes.clear();
    executor.shutdownNow();
    super.invalidate();
  }
}
