# PS Store Manager Pro — Android Native وAndroid TV Remote v2

تمت إضافة طبقة Native فعلية للتطبيق، مع إبقاء Web Preview آمناً وعدم الادعاء بأن المتصفح يتحكم بالتلفزيون.

## ما تم تنفيذه في الكود

- `react-native-ble-plx` لمسح Bluetooth والاتصال واكتشاف خدمات GATT.
- Android TV Remote v2 عبر TLS/Protobuf:
  - الاقتران على TCP 6467.
  - جلسة التحكم على TCP 6466.
  - حفظ هوية العميل داخل ملف التطبيق الخاص `androidtv.keystore`.
  - إعادة فتح جلسة 6466 باستخدام الهوية المحفوظة دون إعادة الاقتران.
- Native Module موحد باسم `AndroidTvRemote`:
  - `pairWithCode(host, code)`
  - `reconnect(host)`
  - `sendKey(host, key, direction)`
  - `isConnected(host)`
  - `probe(host)`
  - `disconnect(host)`
- الأسهم، OK، Back، Home، Power، رفع الصوت وخفضه.
- اتجاهات Protobuf: `SHORT` و`START_LONG` و`END_LONG`.
- قفل لكل عنوان IP لمنع تداخل إطارات TLS/Protobuf.
- مهلة 25 ثانية للاقتران وإعادة الاتصال، مع إعادة محاولة واحدة عند انقطاع جلسة التحكم.
- سجلات أحداث تشخيصية لا تعرض رمز الاقتران أو المفاتيح الخاصة.
- اكتشاف TCP Native لمنافذ Android TV Remote عند توفر APK Android.
- ربط أزرار الطاقة في واجهة التطبيق بطبقة التحكم الفعلية، مع عرض صريح بأن إرسال POWER لا يثبت حالة الشاشة.
- السكون التلقائي عند انتهاء الجلسة يستدعي الأمر الحقيقي إذا كانت الشاشة المرتبطة مستعادة داخل Hook التحكم.

## ما لا يمكن اعتباره مؤكداً دون التلفزيون الحقيقي

Android TV Remote v2 يرسل زر `KEYCODE_POWER`، ولا يوفر واجهة موحدة لقراءة حالة الطاقة. لذلك يعرض التطبيق نتيجة `تم الإرسال، لم تؤكد الحالة` ولا يغيّر الحالة المحلية إلى تشغيل/سكون مؤكداً إلا إذا وصلت نتيجة تحقق فعلية.

- `POWER` في أجهزة كثيرة هو Toggle وليس Power On وPower Off منفصلين.
- لا يوجد أمر `SLEEP` قياسي مستقل في Remote v2؛ خيار السكون يستخدم Power Toggle ويظل غير مؤكد.
- تشغيل LG وWake-on-LAN للبلايستيشن غير مدعومين قبل التحقق من بروتوكول الجهاز وMAC.
- Bluetooth GATT فعلي، لكن لا يوجد بروتوكول StarSat GATT معروف داخل المشروع لإرسال الطاقة.
- لا يمكن لـ Sandbox اختبار StarSat SV-K43ST2S2 أو تأكيد إطفاء الشاشة فعلياً.

## البناء المحلي للاختبارات

```bash
pnpm install --prefer-offline
pnpm check
pnpm test --run
cd android && ./gradlew :app:compileDebugJavaWithJavac :app:compileDebugKotlin --no-daemon
cd .. && pnpm native:apk
```

لإنشاء Release للاختبار اليدوي:

```bash
cd android
./gradlew :app:assembleRelease --no-daemon
```

الملف الناتج عادةً:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## الاختبار على هاتف وتلفزيون حقيقيين

1. ثبّت APK Android على الهاتف، وليس Expo Go أو Web Preview.
2. أوصل الهاتف وStarSat إلى نفس شبكة Wi‑Fi المحلية؛ لا يشترط وجود إنترنت أو رصيد.
3. عطّل Guest Network وAP/Client Isolation وVPN مؤقتاً.
4. من التطبيق افتح «ربط شاشة» ثم اختر Android TV ورمز الاقتران.
5. أدخل IP الشاشة ورمز الاقتران الظاهر عليها.
6. انتظر رسالة «تم الاقتران» ثم افتح شاشة الجهاز واضغط أمر Power مرة واحدة.
7. سجّل النتيجة الفعلية على التلفزيون، ولا تعتمد على تغيير اللون أو الحالة داخل التطبيق.
8. أغلق التطبيق وافتحه، ثم راقب نتيجة إعادة الاتصال من الهوية المحفوظة.
9. اختبر بدء جلسة وانتهائها مع تفعيل السكون التلقائي.
10. أعد الاختبار بعد تغيير الشبكة أو عنوان IP؛ إعادة اكتشاف IP تلقائياً عبر mDNS/NSD ليست مضمّنة بعد.

## نتائج التحقق داخل Sandbox

- TypeScript diagnostics: مسجلة للمشروع.
- اختبارات الوحدة: تشمل خريطة الأزرار، اتجاهات الضغط، وعدم اعتماد حالة الطاقة على إرسال الحزمة فقط.
- Java/Kotlin compilation: يجب تشغيلها بعد أي تغيير Native.
- APK: يبنى محلياً، لكن Sandbox لا يملك تلفزيون StarSat حقيقياً؛ لا يتم ادعاء نجاح POWER/SLEEP/الاستيقاظ قبل الاختبار الميداني.
