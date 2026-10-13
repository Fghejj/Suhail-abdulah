# دليل التشغيل والنشر

## المتطلبات

- Node.js 22 وpnpm 9+
- MySQL 8 أو خدمة MySQL متوافقة
- إعداد OAuth صالح للتطبيق
- APK Android مبني لاختبار Android TV/Bluetooth

## إعداد البيئة

1. انسخ `.env.example` إلى `.env` على الخادم فقط.
2. املأ `DATABASE_URL` و`MANUS_PROJECT_ID` و`MANUS_JWT_SECRET` وبيانات OAuth.
3. لا تضع `MANUS_JWT_SECRET` أو مفاتيح Forge أو كلمة مرور MySQL في تطبيق Expo أو المستودع.
4. اضبط `EXPO_PUBLIC_API_BASE_URL` على عنوان API العام، وليس عنوان Metro.

## قاعدة البيانات

```bash
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
```

سيطبق ذلك `drizzle/0000_elite_eternals.sql` و`drizzle/0001_real_store.sql` على MySQL. لا تشغّل `db:push` على بيئة الإنتاج دون مراجعة migration.

> لم يتم تنفيذ migration فعليًا في بيئة التدقيق الحالية لأن `DATABASE_URL` غير متوفر. نجاح TypeScript والاختبارات لا يثبت اتصال MySQL.

## التشغيل المحلي

```bash
pnpm dev
```

- API: المنفذ 3000
- Expo/Metro: المنفذ 8081

للتحقق الأساسي:

```bash
curl http://localhost:3000/api/health
pnpm check
pnpm test
```

## النسخ الاحتياطي

استخدم نسخ MySQL الأصلية، وليس نسخة AsyncStorage فقط:

```bash
mysqldump --single-transaction --routines --triggers DATABASE_NAME > backup-$(date +%F).sql
```

واسترجاعها:

```bash
mysql DATABASE_NAME < backup-YYYY-MM-DD.sql
```

يمكن للمستخدم أيضًا تصدير JSON من الإعدادات كنسخة تشغيلية، لكنها ليست بديلًا عن نسخة قاعدة البيانات ولا تتضمن سجل تغييرات أو تحققًا من الاسترجاع.

## اختبار الإصدار الحقيقي

1. طبّق migration على نسخة staging.
2. سجّل الدخول بحسابين وتحقق أن كل حساب يرى snapshot الخاص به فقط.
3. أنشئ جهازًا وجلسة، أعد تحميل الصفحة، سجّل الخروج والدخول، وتحقق من بقاء البيانات.
4. اختبر فشل MySQL والشبكة وتأكد من ظهور حالة `تعذر حفظ آخر تغيير على الخادم`.
5. ابنِ APK Android وثبته على هاتف حقيقي.
6. اختبر Android TV على نفس الشبكة وسجل نتيجة التلفزيون الفعلية؛ `verified: false` تعني إرسال الأمر فقط.
7. لا تطلق Bluetooth StarSat أو تشغيل LG/PlayStation كميزات مكتملة قبل اختبار البروتوكول الفعلي.
