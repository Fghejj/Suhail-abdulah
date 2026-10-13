# نتائج التحقق التقني

## النتيجة

`PowerManager.goToSleep()` ليس مسارًا متاحًا لتطبيق Android عادي؛ مرجع Android يربطه بصلاحية نظام `DEVICE_POWER`. لذلك يجب أن يفحص المرافق الصلاحية والقدرة على التنفيذ، ويعيد فشلًا صريحًا عند غيابها.

يمكن لـ `AccessibilityService` تنفيذ `GLOBAL_ACTION_LOCK_SCREEN`، لكن ذلك يتطلب أن يفعّل المستخدم خدمة وصول خاصة، وهو إجراء مختلف عن إثبات وضع Standby الخاص بتلفزيون StarSat. لن نعتبره نجاحًا تلقائيًا للسكون.

Android TV لديه مسار inattentive sleep يعتمد على إعدادات وبنية النظام، وقد يكون معطلًا أو مخصصًا من OEM. لا يوجد في هذه المراجع ضمان أن تطبيق APK عادي يستطيع تفعيل standby الفوري.

## بروتوكول الاتصال المقترح

- اكتشاف المرافق عبر Android NSD/DNS-SD على نوع خدمة محلي مخصص.
- اتصال TCP/TLS مع شهادة مثبتة بعد الاقتران.
- الاقتران الأول يتطلب PIN ظاهرًا على الشاشة.
- بعد الاقتران يستخدم المرافق token محفوظًا ومصادقة TLS.
- الأوامر الوحيدة في النسخة الأولى: `CAPABILITY` و`SLEEP`.
- نتيجة `SLEEP` تفرق بين: `UNSUPPORTED_SYSTEM_PERMISSION`, `NOT_CAPABLE`, `EXECUTION_FAILED`, `SENT_UNVERIFIED`, و`VERIFIED_SLEEP`.

## مراجع رسمية

[1]: https://developer.android.com/reference/android/os/PowerManager "Android PowerManager API reference"
[2]: https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/os/PowerManager.java?format=TEXT "AOSP PowerManager source"
[3]: https://developer.android.com/reference/android/accessibilityservice/AccessibilityService "Android AccessibilityService API reference"
[4]: https://source.android.com/docs/core/power/tv-standby "Android TV standby documentation"
[5]: https://developer.android.com/develop/connectivity/wifi/use-nsd "Android Network Service Discovery"
[6]: https://developer.android.com/develop/background-work/services/fgs/service-types "Android foreground service types"
