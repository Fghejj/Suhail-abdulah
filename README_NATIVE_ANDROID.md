# PS Store Manager Pro — Android Native وBluetooth

أضيفت طبقة Native لاكتشاف أجهزة Bluetooth والاقتران بها داخل Android Development Build.

## ما تم تفعيله

- مكتبة `react-native-ble-plx`.
- صلاحيات Android 12+: `BLUETOOTH_SCAN` و`BLUETOOTH_CONNECT`.
- صلاحيات Android الأقدم: الموقع المطلوب لمسح Bluetooth.
- طلب الصلاحيات وقت التشغيل.
- مسح أجهزة Bluetooth لمدة 8 ثوانٍ من زر «بحث».
- الاقتران الفعلي واكتشاف الخدمات والخصائص GATT.
- رفض حفظ الجهاز إذا لم يعلن قناة قابلة للكتابة.
- إبقاء Web Preview آمناً: لا يدّعي اتصال Bluetooth حقيقياً من المتصفح.

## البناء والتجربة

يتطلب ذلك جهاز Android أو بيئة Android Development Build؛ لا يعمل Bluetooth Native داخل Expo Web أو Expo Go العادي.

```bash
pnpm install
pnpm native:prebuild
pnpm native:run
```

لبناء APK Debug:

```bash
pnpm native:apk
```

سيظهر الملف عادةً في:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## خطوات الاختبار

1. ثبّت APK على هاتف Android.
2. فعّل Bluetooth و«الأجهزة القريبة».
3. افتح التطبيق واختر جهاز البلايستيشن.
4. افتح «ربط الشاشة» ثم اضغط «بحث».
5. اختر جهاز StarSat إن ظهر في قائمة Bluetooth.
6. وافق على الاقتران من الشاشة أو الهاتف إن ظهر طلب.
7. راقب رسالة نتيجة الاقتران واكتشاف قناة GATT.

## ملاحظة بروتوكول مهمة

هذه الطبقة تنفذ Bluetooth GATT حقيقياً، لكنها لا تفترض وجود بروتوكول تحكم موحد لشاشات Android TV. كثير من الشاشات تستخدم Bluetooth لجهاز التحكم HID أو للصوت فقط، بينما يستخدم Android TV Remote Protocol شبكة Wi‑Fi/TLS وليس GATT. إذا ظهرت الشاشة لكن لم توجد خاصية GATT قابلة للكتابة، فذلك يعني أن التحكم عبر Bluetooth ليس البروتوكول الذي تعرضه الشاشة؛ عندها يلزم تنفيذ Android TV Remote Protocol عبر Wi‑Fi أو SDK خاص بـ StarSat.
