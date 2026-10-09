import * as Network from "expo-network";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import { BleManager, State as BleState, type Device as BleDevice } from "react-native-ble-plx";

export type ScreenType = "samsung" | "lg" | "android_tv" | "sony" | "philips" | "ps4" | "ps5";
export type ConnectionType = "bluetooth" | "hotspot" | "lan" | "pairing_code";
export type PowerStatus = "on" | "standby" | "off" | "restarting" | "unknown";
export type RemoteKey = "UP" | "DOWN" | "LEFT" | "RIGHT" | "ENTER" | "BACK" | "HOME" | "POWER" | "VOLUME_UP" | "VOLUME_DOWN";
export type RemoteDirection = "SHORT" | "START_LONG" | "END_LONG";

export interface ScreenDevice {
  id: string;
  name: string;
  type: ScreenType;
  ip: string;
  port?: number;
  mac?: string;
  connectionType: ConnectionType;
  status: PowerStatus;
  linkedConsoleId?: string;
  autoStandby?: boolean;
  lastConnected?: string;
  /** Kept for migration compatibility; pairing codes are never emitted in diagnostics. */
  pairingCode?: string;
  bleId?: string;
  bleServiceUuid?: string;
  bleCharacteristicUuid?: string;
}

export interface ControlResult {
  success: boolean;
  /** False means transport delivered the command but the TV did not confirm its power state. */
  verified?: boolean;
  code?: string;
  message: string;
  timestamp: string;
}

type AndroidTvRemoteBridge = {
  pairWithCode: (host: string, pairingCode: string) => Promise<boolean>;
  reconnect: (host: string) => Promise<boolean>;
  sendKey: (host: string, key: RemoteKey, direction: RemoteDirection) => Promise<boolean>;
  isConnected: (host: string) => Promise<boolean>;
  probe: (host: string) => Promise<boolean>;
  disconnect: (host: string) => Promise<boolean>;
};

/**
 * Native adapter for display discovery and supported display protocols.
 * Web Preview never claims a real Bluetooth/TLS command was sent.
 */
export class ScreenControlService {
  private bleManager: BleManager | null = null;
  private bleConnections = new Map<string, BleDevice>();
  private hostQueues = new Map<string, Promise<unknown>>();

  private getBleManager(): BleManager | null {
    if (Platform.OS === "web") return null;
    this.bleManager ??= new BleManager();
    return this.bleManager;
  }

  private getRemoteBridge(): AndroidTvRemoteBridge | null {
    if (Platform.OS !== "android") return null;
    return NativeModules.AndroidTvRemote as AndroidTvRemoteBridge | undefined ?? null;
  }

  private async ensureBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    const permissions = Platform.Version >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const result = await PermissionsAndroid.requestMultiple(permissions);
    return permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
  }

  /** Serialize all operations for one TV so TLS protobuf frames cannot interleave. */
  private enqueue<T>(host: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.hostQueues.get(host) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    this.hostQueues.set(host, next);
    void next.finally(() => {
      if (this.hostQueues.get(host) === next) this.hostQueues.delete(host);
    });
    return next;
  }

  async discoverBluetoothDevices(scanSeconds = 8): Promise<ScreenDevice[]> {
    const manager = this.getBleManager();
    if (!(await this.ensureBluetoothPermissions())) throw new Error("اسمح للتطبيق بالوصول إلى الأجهزة القريبة من إعدادات الهاتف");
    if (!manager) return [];
    const state = await manager.state();
    if (state !== BleState.PoweredOn) throw new Error("فعّل Bluetooth ومنح التطبيق صلاحية الأجهزة القريبة");
    const found = new Map<string, BleDevice>();
    return await new Promise<ScreenDevice[]>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        manager.stopDeviceScan();
        resolve([...found.values()].map((device) => ({
          id: `bluetooth-${device.id}`,
          name: device.name || device.localName || `Bluetooth (${device.id})`,
          type: "android_tv",
          ip: "",
          mac: device.id,
          bleId: device.id,
          connectionType: "bluetooth",
          status: "unknown",
          lastConnected: new Date().toISOString(),
        })));
      };
      const timer = setTimeout(finish, scanSeconds * 1000);
      manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          clearTimeout(timer);
          manager.stopDeviceScan();
          if (!settled) { settled = true; reject(error); }
          return;
        }
        if (device?.id) found.set(device.id, device);
      });
    });
  }

  async connectBluetoothDevice(device: ScreenDevice): Promise<ControlResult> {
    const manager = this.getBleManager();
    if (!manager || !device.bleId) return this.fail("Bluetooth Native متاح داخل نسخة Android فقط");
    try {
      const connected = await manager.connectToDevice(device.bleId, { timeout: 10_000 });
      const discovered = await connected.discoverAllServicesAndCharacteristics();
      this.bleConnections.set(device.bleId, discovered);
      const services = await discovered.services();
      const characteristics = (await Promise.all(services.map((service) => discovered.characteristicsForService(service.uuid)))).flat();
      const writable = characteristics.find((characteristic) => characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse);
      if (!writable) return this.fail("تم الاقتران، لكن الجهاز لا يعلن قناة Bluetooth قابلة لإرسال أوامر التحكم");
      return this.ok(`تم اتصال Bluetooth GATT؛ قناة الكتابة المكتشفة ${writable.uuid}، لكن بروتوكول طاقة StarSat عبر GATT غير معروف`);
    } catch (error) {
      return this.fail(`فشل اقتران Bluetooth: ${error instanceof Error ? error.message : "تحقق من قبول الاقتران على الشاشة"}`);
    }
  }

  async disconnectBluetoothDevice(device: ScreenDevice): Promise<ControlResult> {
    const manager = this.getBleManager();
    if (!manager || !device.bleId) return this.ok("لا يوجد اتصال Bluetooth Native نشط");
    try {
      await manager.cancelDeviceConnection(device.bleId);
      this.bleConnections.delete(device.bleId);
      return this.ok("تم فصل اتصال Bluetooth");
    } catch (error) {
      return this.fail(`تعذر فصل Bluetooth: ${error instanceof Error ? error.message : "خطأ غير معروف"}`);
    }
  }

  async connectViaPairingCode(code: string, type: ScreenType, ip?: string): Promise<ControlResult> {
    if (!/^\d{8}$/.test(code)) return this.fail("رمز الاقتران يجب أن يتكون من 8 أرقام", "INVALID_CODE");
    if (Platform.OS !== "android") return this.fail("التحكم الحقيقي متاح في APK Android فقط؛ معاينة الويب لا تستطيع فتح TLS مع التلفاز", "NATIVE_REQUIRED");
    if (type !== "android_tv") return this.fail("رمز الاقتران مدعوم حالياً لشاشات Android TV فقط", "UNSUPPORTED_TYPE");
    if (!ip?.trim()) return this.fail("أدخل عنوان IP للشاشة المتصلة بنفس شبكة Wi‑Fi", "INVALID_HOST");
    const remote = this.getRemoteBridge();
    if (!remote?.pairWithCode) return this.fail("لم يتم تضمين Native Android TV Remote في هذه النسخة", "NATIVE_MODULE_MISSING");
    return this.enqueue(ip.trim(), async () => {
      try {
        await remote.pairWithCode(ip.trim(), code);
        return this.confirmed(`تم الاقتران مع Android TV على ${ip.trim()} عبر TLS/Protobuf`);
      } catch (error) {
        return this.fail(`فشل الاقتران الحقيقي: ${error instanceof Error ? error.message : "تحقق من الرمز وIP وقبول الطلب على الشاشة"}`, "PAIRING_FAILED");
      }
    });
  }

  async reconnectAndroidTv(device: ScreenDevice): Promise<ControlResult> {
    if (Platform.OS !== "android") return this.fail("إعادة الاتصال الحقيقي تحتاج APK Android", "NATIVE_REQUIRED");
    if (!device.ip) return this.fail("لا يوجد IP محفوظ للشاشة", "INVALID_HOST");
    const remote = this.getRemoteBridge();
    if (!remote?.reconnect) return this.fail("إعادة الاتصال Native غير متاحة في هذه النسخة", "NATIVE_MODULE_MISSING");
    return this.enqueue(device.ip, async () => {
      try {
        await remote.reconnect(device.ip);
        return this.confirmed("تمت إعادة جلسة Android TV باستخدام هوية العميل المحفوظة دون إعادة الاقتران");
      } catch (error) {
        return this.fail(`تعذرت إعادة جلسة Android TV: ${error instanceof Error ? error.message : "تحقق من الشبكة والثقة المحفوظة"}`, "RECONNECT_FAILED");
      }
    });
  }

  async getLocalIP(): Promise<string | null> {
    try {
      return await Network.getIpAddressAsync();
    } catch {
      return null;
    }
  }

  async discoverDevices(): Promise<ScreenDevice[]> {
    const ip = await this.getLocalIP();
    if (!ip || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return [];

    const subnet = ip.split(".").slice(0, 3).join(".");
    const found: ScreenDevice[] = [];
    const remote = this.getRemoteBridge();

    // Android TV Remote has no HTTP discovery endpoint. Probe the actual TCP ports natively.
    if (remote?.probe) {
      for (let start = 1; start <= 254; start += 32) {
        const batch = Array.from({ length: Math.min(32, 255 - start) }, (_, offset) => `${subnet}.${start + offset}`);
        const results = await Promise.all(batch.map(async (candidate) => ({ candidate, open: await remote.probe(candidate) })));
        results.filter((result) => result.open).forEach(({ candidate }) => found.push({
          id: `${candidate}-6466`,
          name: `Android TV (${candidate})`,
          type: "android_tv",
          ip: candidate,
          port: 6466,
          connectionType: "pairing_code",
          status: "unknown",
          lastConnected: new Date().toISOString(),
        }));
      }
    }

    // Keep compatibility discovery for HTTP-based Samsung/LG/Sony devices.
    const promises: Promise<void>[] = [];
    for (let i = 1; i <= 30; i += 1) promises.push(this.checkIP(`${subnet}.${i}`, found));
    await Promise.allSettled(promises);
    return found.filter((device, index, all) => all.findIndex((other) => other.ip === device.ip && other.type === device.type) === index);
  }

  private async checkIP(ip: string, found: ScreenDevice[]): Promise<void> {
    const ports: { port: number; type: ScreenType }[] = [
      { port: 8001, type: "samsung" },
      { port: 3000, type: "lg" },
      { port: 8080, type: "android_tv" },
      { port: 8008, type: "android_tv" },
      { port: 8009, type: "android_tv" },
    ];
    for (const { port, type } of ports) {
      if (await this.ping(ip, port)) {
        found.push({ id: `${ip}-${port}`, name: `${type} (${ip})`, type, ip, port, connectionType: "lan", status: "unknown", lastConnected: new Date().toISOString() });
        return;
      }
    }
  }

  private async ping(ip: string, port: number, timeout = 1200): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`http://${ip}:${port}/`, { method: "HEAD", signal: controller.signal });
      return response.ok || response.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async sendRemoteKey(device: ScreenDevice, key: RemoteKey, direction: RemoteDirection = "SHORT"): Promise<ControlResult> {
    if (device.type !== "android_tv") return this.fail("أوامر الريموت الموحدة مدعومة حالياً لـ Android TV فقط", "UNSUPPORTED_TYPE");
    if (Platform.OS !== "android") return this.fail("التحكم الحقيقي يحتاج APK Android وليس Web Preview", "NATIVE_REQUIRED");
    if (!device.ip) return this.fail("لا يوجد IP محفوظ للشاشة", "INVALID_HOST");
    const remote = this.getRemoteBridge();
    if (!remote?.sendKey) return this.fail("Native Android TV Remote غير متاح في النسخة الحالية", "NATIVE_MODULE_MISSING");

    return this.enqueue(device.ip, async () => {
      try {
        await remote.sendKey(device.ip, key, direction);
        return this.unconfirmed(`تم إرسال ${this.keyLabel(key)} عبر TLS؛ لم يؤكد التلفزيون حالته بعد`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "انقطع اتصال TLS";
        // One controlled reconnect/retry; never start parallel reconnect loops.
        if (/NOT_CONNECTED|SEND_FAILED|disconnected|غير متصلة/i.test(message) && remote.reconnect) {
          try {
            await remote.reconnect(device.ip);
            await remote.sendKey(device.ip, key, direction);
            return this.unconfirmed(`تمت إعادة الاتصال وإرسال ${this.keyLabel(key)}؛ تأكيد حالة التلفزيون غير متاح من البروتوكول`);
          } catch (retryError) {
            return this.fail(`فشل إرسال ${this.keyLabel(key)} بعد إعادة الاتصال: ${retryError instanceof Error ? retryError.message : "خطأ TLS"}`, "SEND_FAILED");
          }
        }
        return this.fail(`فشل إرسال ${this.keyLabel(key)}: ${message}`, "SEND_FAILED");
      }
    });
  }

  async powerOn(device: ScreenDevice): Promise<ControlResult> {
    if (device.connectionType === "bluetooth") return this.bluetoothControlUnavailable(device);
    switch (device.type) {
      case "android_tv": return this.sendRemoteKey(device, "POWER");
      case "samsung": return this.samsungControl(device, "on");
      case "lg": return this.lgControl(device, "on");
      case "sony": return this.sonyControl(device, "on");
      case "ps4":
      case "ps5": return this.playStationWake(device);
      default: return this.fail("نوع غير مدعوم", "UNSUPPORTED_TYPE");
    }
  }

  async powerOff(device: ScreenDevice): Promise<ControlResult> {
    if (device.connectionType === "bluetooth") return this.bluetoothControlUnavailable(device);
    switch (device.type) {
      case "android_tv": return this.sendRemoteKey(device, "POWER");
      case "samsung": return this.samsungControl(device, "off");
      case "lg": return this.lgControl(device, "off");
      case "sony": return this.sonyControl(device, "off");
      default: return this.fail("الإطفاء غير مدعوم لهذا الجهاز", "UNSUPPORTED_TYPE");
    }
  }

  async standby(device: ScreenDevice): Promise<ControlResult> {
    if (device.type === "android_tv") {
      return this.sendRemoteKey(device, "POWER");
    }
    return this.powerOff(device);
  }

  async restart(device: ScreenDevice): Promise<ControlResult> {
    const first = await this.powerOff(device);
    if (!first.success) return first;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const second = await this.powerOn(device);
    return second.success
      ? this.unconfirmed("تم إرسال تبديلَي الطاقة لإعادة التشغيل؛ لم يؤكد التلفزيون اكتمال الإقلاع")
      : second;
  }

  private async samsungControl(device: ScreenDevice, action: "on" | "off"): Promise<ControlResult> {
    const port = device.port || 8001;
    try {
      const keyCode = action === "on" ? "KEY_POWERON" : "KEY_POWEROFF";
      const response = await fetch(`http://${device.ip}:${port}/api/v2/keypads/${keyCode}`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: this.timeoutSignal(5000) });
      return response.ok ? this.unconfirmed(`أُرسل أمر ${action === "on" ? "تشغيل" : "إيقاف"} إلى Samsung؛ لم تُقرأ الحالة من التلفزيون`) : this.fail("فشل الاتصال بشاشة Samsung", "REMOTE_REJECTED");
    } catch { return this.fail("تعذر الاتصال بشاشة Samsung", "SEND_FAILED"); }
  }

  private async lgControl(device: ScreenDevice, action: "on" | "off"): Promise<ControlResult> {
    if (action === "on") return this.fail("تشغيل LG يحتاج Wake-on-LAN Native مع MAC صالح وبعد التحقق من دعم الجهاز", "UNSUPPORTED_WAKE");
    try {
      const response = await fetch(`http://${device.ip}:${device.port || 3000}/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "request", uri: "ssap://system/turnOff" }), signal: this.timeoutSignal(5000) });
      return response.ok || response.status < 500 ? this.unconfirmed("أُرسل أمر سكون LG؛ يلزم تأكيد الجهاز عبر جلسة WebSocket") : this.fail("تعذر إيقاف شاشة LG", "REMOTE_REJECTED");
    } catch { return this.fail("تعذر إطفاء شاشة LG", "SEND_FAILED"); }
  }

  private bluetoothControlUnavailable(_device: ScreenDevice): ControlResult {
    if (Platform.OS === "web") return this.fail("التحكم Bluetooth الحقيقي يحتاج Android Native Build وليس Web Preview", "NATIVE_REQUIRED");
    return this.fail("تم اتصال Bluetooth GATT، لكن لا يوجد بروتوكول تحكم طاقة موحد لشاشة Android TV عبر GATT", "UNSUPPORTED_BLUETOOTH_PROTOCOL");
  }

  private async sonyControl(device: ScreenDevice, action: "on" | "off"): Promise<ControlResult> {
    const code = action === "on" ? "AAAAAQAAAAEAAAAuAw==" : "AAAAAQAAAAEAAAAvAw==";
    try {
      const response = await fetch(`http://${device.ip}:${device.port || 80}/sony/IRCC`, { method: "POST", headers: { "Content-Type": "text/xml; charset=UTF-8", SOAPACTION: '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"' }, body: `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1"><IRCCCode>${code}</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>`, signal: this.timeoutSignal(5000) });
      return response.ok || response.status < 500 ? this.unconfirmed(`أُرسل أمر Sony (${action})؛ لم تُقرأ الحالة من التلفزيون`) : this.fail("تعذر تنفيذ أمر Sony", "REMOTE_REJECTED");
    } catch { return this.fail("تعذر الاتصال بشاشة Sony", "SEND_FAILED"); }
  }

  private playStationWake(_device: ScreenDevice): ControlResult {
    return this.fail("Wake-on-LAN للبلايستيشن يحتاج Native Module وبعد التحقق من دعم الجهاز", "UNSUPPORTED_WAKE");
  }

  async getStatus(device: ScreenDevice): Promise<PowerStatus> {
    if (device.type === "android_tv" && Platform.OS === "android") {
      const remote = this.getRemoteBridge();
      try {
        if (remote?.isConnected && await remote.isConnected(device.ip)) return "unknown";
      } catch { /* keep unknown */ }
      return "unknown";
    }
    try {
      const response = await fetch(`http://${device.ip}:${device.port || 8001}/`, { method: "HEAD", signal: this.timeoutSignal(3000) });
      return response.ok || response.status < 500 ? "on" : "standby";
    } catch { return "unknown"; }
  }

  private keyLabel(key: RemoteKey): string {
    const labels: Record<RemoteKey, string> = { UP: "السهم للأعلى", DOWN: "السهم للأسفل", LEFT: "السهم لليسار", RIGHT: "السهم لليمين", ENTER: "OK", BACK: "رجوع", HOME: "الرئيسية", POWER: "زر الطاقة", VOLUME_UP: "رفع الصوت", VOLUME_DOWN: "خفض الصوت" };
    return labels[key];
  }

  private timeoutSignal(timeout: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  }

  private confirmed(message: string): ControlResult { return { success: true, verified: true, message, timestamp: new Date().toISOString() }; }
  private unconfirmed(message: string): ControlResult { return { success: true, verified: false, code: "UNCONFIRMED", message, timestamp: new Date().toISOString() }; }
  private ok(message: string): ControlResult { return this.confirmed(message); }
  private fail(message: string, code?: string): ControlResult { return { success: false, verified: false, code, message, timestamp: new Date().toISOString() }; }
}

export const screenControlService = new ScreenControlService();
