import * as Network from "expo-network";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import { BleManager, State as BleState, type Device as BleDevice } from "react-native-ble-plx";

export type ScreenType = "samsung" | "lg" | "android_tv" | "sony" | "philips" | "ps4" | "ps5";
export type ConnectionType = "bluetooth" | "hotspot" | "lan" | "pairing_code";
export type PowerStatus = "on" | "standby" | "off" | "restarting" | "unknown";

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
  pairingCode?: string;
  bleId?: string;
  bleServiceUuid?: string;
  bleCharacteristicUuid?: string;
}

export interface ControlResult {
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Native-network adapter for discovery and supported display protocols.
 *
 * Discovery and LAN commands are intended for the native Expo build. Expo Web
 * may be blocked by browser CORS/mixed-content rules when contacting private IPs.
 * Bluetooth and Wake-on-LAN require a native implementation/permission layer;
 * this service reports that limitation instead of claiming a command was sent.
 */
export class ScreenControlService {
  private bleManager: BleManager | null = null;
  private bleConnections = new Map<string, BleDevice>();

  private getBleManager(): BleManager | null {
    if (Platform.OS === "web") return null;
    this.bleManager ??= new BleManager();
    return this.bleManager;
  }

  private async ensureBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    const permissions = Platform.Version >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const result = await PermissionsAndroid.requestMultiple(permissions);
    return permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
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
      return this.ok(`تم الاقتران فعلياً عبر Bluetooth؛ قناة التحكم: ${writable.uuid}`);
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
    if (!/^\d{8}$/.test(code)) return this.fail("رمز الاقتران يجب أن يتكون من 8 أرقام");
    if (Platform.OS !== "android") return this.fail("التحكم الحقيقي متاح في APK Android فقط؛ معاينة الويب لا تستطيع فتح TLS مع التلفاز");
    if (type !== "android_tv") return this.fail("رمز الاقتران مدعوم حالياً لشاشات Android TV فقط");
    if (!ip) return this.fail("أدخل عنوان IP للشاشة المتصلة بنفس شبكة Wi‑Fi");
    const remote = NativeModules.AndroidTvRemote as {
      pairWithCode: (host: string, pairingCode: string) => Promise<boolean>;
    } | undefined;
    if (!remote?.pairWithCode) return this.fail("لم يتم تضمين Native Android TV Remote في هذه النسخة");
    try {
      await remote.pairWithCode(ip, code);
      return this.ok(`تم الاقتران فعلياً مع Android TV على ${ip} عبر TLS/Protobuf`);
    } catch (error) {
      return this.fail(`فشل الاقتران الحقيقي: ${error instanceof Error ? error.message : "تحقق من الرمز وIP وقبول الطلب على الشاشة"}`);
    }
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
    const promises: Promise<void>[] = [];
    for (let i = 1; i <= 30; i += 1) {
      promises.push(this.checkIP(`${subnet}.${i}`, found));
    }
    await Promise.allSettled(promises);
    return found;
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
        found.push({
          id: `${ip}-${port}`,
          name: `${type} (${ip})`,
          type,
          ip,
          port,
          connectionType: "lan",
          status: "unknown",
          lastConnected: new Date().toISOString(),
        });
        return;
      }
    }
  }

  private async ping(ip: string, port: number, timeout = 2000): Promise<boolean> {
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

  async powerOn(device: ScreenDevice): Promise<ControlResult> {
    try {
      if (device.connectionType === "bluetooth") return this.bluetoothControlUnavailable(device);
      switch (device.type) {
        case "samsung": return await this.samsungControl(device, "on");
        case "lg": return await this.lgControl(device, "on");
        case "android_tv": return await this.androidTVControl(device, "on");
        case "sony": return await this.sonyControl(device, "on");
        case "ps4":
        case "ps5": return this.playStationWake(device);
        default: return this.fail("نوع غير مدعوم");
      }
    } catch (error) {
      return this.fail(`خطأ: ${error instanceof Error ? error.message : "غير معروف"}`);
    }
  }

  async powerOff(device: ScreenDevice): Promise<ControlResult> {
    try {
      if (device.connectionType === "bluetooth") return this.bluetoothControlUnavailable(device);
      switch (device.type) {
        case "samsung": return await this.samsungControl(device, "off");
        case "lg": return await this.lgControl(device, "off");
        case "android_tv": return await this.androidTVControl(device, "off");
        case "sony": return await this.sonyControl(device, "off");
        default: return this.fail("الإطفاء غير مدعوم لهذا الجهاز");
      }
    } catch (error) {
      return this.fail(`خطأ: ${error instanceof Error ? error.message : "غير معروف"}`);
    }
  }

  async standby(device: ScreenDevice): Promise<ControlResult> {
    return this.powerOff(device);
  }

  async restart(device: ScreenDevice): Promise<ControlResult> {
    const off = await this.powerOff(device);
    if (!off.success) return off;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return this.powerOn(device);
  }

  private async samsungControl(device: ScreenDevice, action: "on" | "off"): Promise<ControlResult> {
    const port = device.port || 8001;
    try {
      const keyCode = action === "on" ? "KEY_POWERON" : "KEY_POWEROFF";
      const response = await fetch(`http://${device.ip}:${port}/api/v2/keypads/${keyCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: this.timeoutSignal(5000),
      });
      return response.ok ? this.ok(action === "on" ? "تم إرسال تشغيل شاشة Samsung" : "تم إرسال إيقاف شاشة Samsung") : this.fail("فشل الاتصال بشاشة Samsung");
    } catch {
      return this.fail("تعذر الاتصال بشاشة Samsung");
    }
  }

  private async lgControl(device: ScreenDevice, action: "on" | "off"): Promise<ControlResult> {
    if (action === "on") return this.fail("تشغيل LG يحتاج Wake-on-LAN native مع MAC صالح");
    try {
      const response = await fetch(`http://${device.ip}:${device.port || 3000}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "request", uri: "ssap://system/turnOff" }),
        signal: this.timeoutSignal(5000),
      });
      return response.ok || response.status < 500 ? this.ok("تم إرسال إيقاف شاشة LG") : this.fail("تعذر إيقاف شاشة LG");
    } catch {
      return this.fail("تعذر إطفاء شاشة LG");
    }
  }

  private async androidTVControl(device: ScreenDevice, action: "on" | "off"): Promise<ControlResult> {
    if (Platform.OS !== "android") return this.fail("التحكم الحقيقي يحتاج APK Android وليس Web Preview");
    if (!device.ip) return this.fail("لا يوجد IP محفوظ للشاشة");
    const remote = NativeModules.AndroidTvRemote as {
      sendKey: (host: string, key: string) => Promise<boolean>;
    } | undefined;
    if (!remote?.sendKey) return this.fail("Native Android TV Remote غير متاح في النسخة الحالية");
    try {
      await remote.sendKey(device.ip, "POWER");
      return this.ok(`تم إرسال أمر ${action === "on" ? "التشغيل/الإيقاظ" : "السكون"} فعلياً عبر Android TV Remote v2`);
    } catch (error) {
      return this.fail(`تعذر إرسال الأمر عبر TLS: ${error instanceof Error ? error.message : "تحقق من الاقتران"}`);
    }
  }

  private bluetoothControlUnavailable(device: ScreenDevice): ControlResult {
    if (Platform.OS === "web") return this.fail("التحكم Bluetooth الحقيقي يحتاج Android Native Build وليس Web Preview");
    if (!device.bleId) return this.fail("لم يتم حفظ معرّف جهاز Bluetooth؛ أعد البحث والاقتران");
    return this.fail("تم دعم اكتشاف واقتران Bluetooth، لكن شاشة Android TV لا تعرض بروتوكول طاقة قياسياً عبر GATT؛ يلزم Android TV Remote Protocol عبر Wi‑Fi أو SDK الشركة");
  }

  private async sonyControl(device: ScreenDevice, action: "on" | "off"): Promise<ControlResult> {
    const code = action === "on" ? "AAAAAQAAAAEAAAAuAw==" : "AAAAAQAAAAEAAAAvAw==";
    try {
      const response = await fetch(`http://${device.ip}:${device.port || 80}/sony/IRCC`, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=UTF-8", SOAPACTION: '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"' },
        body: `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1"><IRCCCode>${code}</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>`,
        signal: this.timeoutSignal(5000),
      });
      return response.ok || response.status < 500 ? this.ok(`تم إرسال ${action === "on" ? "تشغيل" : "إيقاف"} شاشة Sony`) : this.fail("تعذر تنفيذ أمر Sony");
    } catch {
      return this.fail("تعذر الاتصال بشاشة Sony");
    }
  }

  private playStationWake(_device: ScreenDevice): ControlResult {
    return this.fail("Wake-on-LAN للبلايستيشن يحتاج native module وصلاحية شبكة محلية");
  }

  async getStatus(device: ScreenDevice): Promise<PowerStatus> {
    try {
      const response = await fetch(`http://${device.ip}:${device.port || 8001}/`, { method: "HEAD", signal: this.timeoutSignal(3000) });
      return response.ok || response.status < 500 ? "on" : "standby";
    } catch {
      return "off";
    }
  }

  private timeoutSignal(timeout: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  }

  private ok(message: string): ControlResult {
    return { success: true, message, timestamp: new Date().toISOString() };
  }

  private fail(message: string): ControlResult {
    return { success: false, message, timestamp: new Date().toISOString() };
  }
}

export const screenControlService = new ScreenControlService();
