# StarSat Sleep Companion

## ما تم بناؤه

أضيف تطبيق Android مستقل داخل `companion/` باسم `StarSat Sleep Companion`. يعمل على Android API 26 فأحدث، ويعلن خدمة NSD باسم `_starsat-sleep._tcp.` على شبكة Wi‑Fi المحلية. التطبيق الرئيسي يكتشف الخدمة، ثم يقترن بها عبر PIN ظاهر على شاشة StarSat.

بعد الاقتران، يستخدم الاتصال TLS مع بصمة شهادة مثبتة وtoken محفوظ في التطبيق الرئيسي. الأوامر الوحيدة في الإصدار الأول هي `CAPABILITY` و`SLEEP`. لا يوجد أمر إيقاف تشغيل أو إعادة تشغيل، ولا يعاد استخدام زر `POWER` القديم لهذا المسار.

## حالات التنفيذ

يعيد المرافق حالات منفصلة:

- `PAIRED`: تم الاقتران فقط.
- `VERIFIED_SLEEP`: نفذ النظام الطلب وأصبح الجهاز غير تفاعلي عند الفحص اللاحق.
- `SENT_UNVERIFIED`: قبلت المنصة استدعاء التنفيذ لكن الشاشة بقيت تفاعلية.
- `UNSUPPORTED_SYSTEM_PERMISSION`: لا يملك التطبيق صلاحية `DEVICE_POWER`.
- `EXECUTION_FAILED`: رفضت المنصة الطلب أو حدث خطأ آخر.
- `UNAUTHORIZED`: فشل token أو الاقتران.

لا يستخدم الكود `PowerManager.goToSleep()` كنجاح افتراضي. يفحص الصلاحية، يمسك `SecurityException`، ثم يتحقق من `PowerManager.isInteractive()` بعد الطلب.

## البناء

تطبيق الشاشة:

```bash
cd companion
./gradlew :app:assembleDebug
```

سيكون APK في:

```text
companion/app/build/outputs/apk/debug/app-debug.apk
```

التطبيق الرئيسي:

```bash
pnpm check
pnpm test
cd android
./gradlew :app:assembleDebug --no-daemon
```

## تحقق الجهاز المطلوب

لم يتم إعلان أي موديل StarSat مدعومًا. لا توجد شاشة StarSat فعلية أو ADB متصل في بيئة التنفيذ الحالية، ولذلك لم يمكن التحقق من:

- إصدار Android الفعلي.
- هل التطبيق يملك `DEVICE_POWER` بتوقيع OEM أو system UID.
- هل `goToSleep()` يؤدي إلى standby حقيقي على هذا النظام.
- هل خدمة NSD تبقى متاحة بعد إغلاق واجهة المرافق.
- هل firmware يفرض قيودًا على foreground service أو TLS.

على جهاز الاختبار، يجب تسجيل:

```bash
adb shell getprop ro.build.version.sdk
adb shell getprop ro.build.version.release
adb shell getprop ro.product.manufacturer
adb shell getprop ro.product.model
adb shell dumpsys package com.starsat.sleepcompanion | grep -i DEVICE_POWER
adb shell dumpsys power
```

ثم اختبار المسار بالترتيب: تثبيت APK المرافق، فتحه، قراءة PIN، اكتشافه من الهاتف، الاقتران، طلب `CAPABILITY`، إرسال `SLEEP`، وتصوير أو تسجيل تحول الشاشة إلى standby. إذا عادت `UNSUPPORTED_SYSTEM_PERMISSION` فهذا قيد النظام وليس نجاحًا جزئيًا.

## ملاحظة Android مهمة

توثيق Android يربط `PowerManager.goToSleep()` بصلاحية النظام `DEVICE_POWER`، لذلك لا يمكن ضمان التنفيذ لتطبيق APK عادي. بديل `AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN` ليس مستخدمًا هنا لأنه قفل شاشة يتطلب تفعيل خدمة وصول، ولا يثبت أنه standby خاص بتلفزيون StarSat. كما أن Android TV inattentive sleep يعتمد على إعدادات وبنية النظام.

## الملفات الرئيسية

- `companion/app/src/main/java/com/starsat/sleepcompanion/SleepCommandServer.java`
- `companion/app/src/main/java/com/starsat/sleepcompanion/SleepExecutor.java`
- `companion/app/src/main/java/com/starsat/sleepcompanion/CompanionService.java`
- `android/app/src/main/java/space/manus/psstorepro/t075075339828613/StarSatCompanionModule.java`
- `services/StarSatCompanionService.ts`
- `app/(tabs)/settings.tsx`

## المراجع

[1]: https://developer.android.com/reference/android/os/PowerManager "Android PowerManager API reference"
[2]: https://developer.android.com/reference/android/accessibilityservice/AccessibilityService "Android AccessibilityService API reference"
[3]: https://source.android.com/docs/core/power/tv-standby "Android TV standby documentation"
[4]: https://developer.android.com/develop/connectivity/wifi/use-nsd "Android Network Service Discovery"
[5]: https://developer.android.com/develop/background-work/services/fgs/service-types "Android foreground service types"
