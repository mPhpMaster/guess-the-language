# خمّن لغة البرمجة — Guess the Programming Language

لعبة سطح مكتب تفاعلية لنظام Windows: يُعرض مقتطف كود غامض، وعلى اللاعب تحديد لغة
البرمجة قبل انتهاء المؤقت. تتضمّن نظام نقاط، سلاسل إجابات (streak)، وشاشة مقارنة
نتائج مع الأصدقاء.

An interactive Windows desktop game built with **Electron**. A mystery code snippet
is shown and the player must guess the programming language before the timer runs
out. Includes scoring, streaks, and a friends-comparison results screen.

---

## المتطلبات / Requirements

- [Node.js](https://nodejs.org/) 18+ (تم التطوير على v22)
- npm (يأتي مع Node.js)
- Windows 10/11

## التشغيل / Run (development)

```powershell
npm install      # تثبيت الاعتماديات (Electron)
npm start        # تشغيل اللعبة
```

## بناء ملف تنفيذي / Build a Windows installer (.exe)

```powershell
npm run dist     # ينتج مثبّت NSIS داخل مجلد dist/
# أو نسخة محمولة غير مثبّتة:
npm run pack
```

الناتج يوضع في مجلد `dist/`.

---

## آلية اللعب / How to play

1. اضغط **ابدأ اللعب**.
2. يُعرض مقتطف كود مع مؤقت دائري (12–15 ثانية حسب الصعوبة).
3. اختر اللغة الصحيحة من الأزرار الستة (أو اضغط مفاتيح الأرقام **1–6**).
4. في النهاية تظهر شاشة النتيجة مع مقارنة الأصدقاء.

### نظام النقاط / Scoring
- إجابة صحيحة: **+100** نقطة.
- مكافأة السرعة: **+10** لكل ثانية متبقية.
- سلسلة: مضاعف **×1.5** بعد 3 إجابات صحيحة متتالية.
- إجابة خاطئة أو انتهاء الوقت: 0 نقطة وتُصفّر السلسلة.

---

## البنية / Project structure

```
prog-game2/
├─ package.json                 # سكربتات + إعداد electron-builder
├─ pnpm-workspace.yaml          # السماح ببناء سكربت Electron
├─ supabase/
│  └─ schema.sql                # جدول لوحة الصدارة + سياسات RLS
├─ src/
│  ├─ main.js                   # عملية Electron الرئيسية (نافذة + IPC)
│  ├─ preload.js                # جسر آمن (window controls + تحميل الأسئلة)
│  ├─ index.html                # الشاشات الثلاث (قائمة / لعب / نتائج)
│  ├─ styles.css                # التصميم الداكن + النيون
│  ├─ renderer.js               # منطق اللعبة، المؤقت، النقاط، الصدارة
│  ├─ supabase-config.js         # بيانات Supabase (محلي، غير مُتتبَّع بـ git)
│  ├─ supabase-config.example.js # قالب الإعداد
│  └─ data/
│     └─ questions.json          # قاعدة بيانات الأسئلة (120 سؤالاً)
└─ test/
   ├─ smoke-main.js             # اختبار آلي بدون واجهة (13 فحصاً)
   ├─ capture.js                # التقاط صور للشاشات
   └─ reset-state.js            # تفريغ الحالة المحفوظة
```

## قاعدة بيانات الأسئلة / Questions database

ملف `src/data/questions.json` يحوي **120 سؤالاً** موزّعة على 6 لغات
(Python, JavaScript, C++, Java, Rust, Go) وثلاث مستويات صعوبة. كل سؤال:

```json
{
  "id": 1,
  "correctLanguage": "Python",
  "difficulty": "easy",
  "codeSnippet": "print('Hello, World!')",
  "explanation": "دالة print() مميزة في بايثون."
}
```

لإضافة أسئلة: أضِف عناصر جديدة إلى المصفوفة بنفس الشكل. تُقرأ تلقائياً عند التشغيل.

---

## لوحة الصدارة عبر Supabase / Cloud leaderboard (Supabase)

اللعبة تعمل محلياً بالكامل بدون إعداد. لتفعيل لوحة صدارة عالمية حقيقية:

1. أنشئ مشروعاً مجانياً على [supabase.com](https://supabase.com).
2. في **SQL Editor**، نفّذ محتوى الملف [`supabase/schema.sql`](supabase/schema.sql)
   (ينشئ جدول `scores` مع سياسات RLS للقراءة والإضافة العامة).
3. انسخ `src/supabase-config.example.js` إلى `src/supabase-config.js`.
4. من **Project Settings → API** انسخ `Project URL` و`anon public key` والصقهما
   في `src/supabase-config.js`.
5. أعد تشغيل اللعبة. ستظهر شاشة النتائج الآن أعلى 10 لاعبين عالمياً مع تمييز صفّك.

> المفتاح `anon` مُصمَّم ليكون عاماً في تطبيقات العميل؛ التحكم بالوصول يتم عبر
> سياسات RLS. إذا تُرك الإعداد فارغاً تعود اللعبة تلقائياً للوحة المحلية التجريبية.
> ملاحظة أمنية: الإضافة عبر `anon` قابلة للتزوير من العميل؛ لمنع الغش فعلياً انقل
> إرسال النتيجة إلى Edge Function تتحقق من الجولة (انظر التعليق في `schema.sql`).

اسمك في اللوحة يُضبط من شاشة **الإعدادات**.

## ملاحظات على التصميم / Implementation notes

- **محلي أولاً:** اللعبة تعمل كاملة دون إنترنت أو خادم. عند إعداد Supabase تتحول شاشة
  المقارنة إلى لوحة صدارة عالمية حقيقية؛ وبدون إعداد تعود إلى بيانات تجريبية محلية.
- **التظليل اللوني (Syntax highlighting):** مُنفّذ بمحرّك خفيف داخلي بلا اعتماديات
  خارجية ليعمل دون اتصال.
- **الصوت:** نغمات بسيطة مولّدة عبر WebAudio (لا حاجة لملفات صوتية).
- **الأمان:** `contextIsolation` مفعّل، `nodeIntegration` معطّل، و`sandbox` مفعّل،
  مع سياسة CSP صارمة. النتيجة الأعلى تُحفظ محلياً عبر `localStorage`.

## خارطة طريق / Roadmap

- ✅ لوحة متصدرين عامة عبر Supabase.
- ⏳ تسجيل دخول (Email / Google / Guest).
- ⏳ نظام أصدقاء حقيقي (إضافة/متابعة) بدل اللوحة العامة فقط.
- ⏳ إرسال النتيجة عبر Edge Function للتحقق منها (منع الغش).
