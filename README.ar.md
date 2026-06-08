<div dir="rtl">

# خمّن لغة البرمجة

[English](README.md) · **العربية**

لعبة سطح مكتب تفاعلية لنظام **Windows** مبنية بـ **Electron**. عند التشغيل تختار أحد
نمطين، ثم تتسابق مع المؤقّت — مع نظام نقاط وسلاسل إجابات ولوحة صدارة لكل نمط.
**الواجهة كاملة بالعربية والإنجليزية** (مع تخطيط RTL)، ويمكن التبديل بينهما من القائمة.

### نمطان للعب
- **💻 لغات البرمجة** — يظهر مقتطف كود؛ خمّن اللغة (Python, JavaScript, C++, Java, Rust, Go).
- **🛡️ الأمن السيبراني** — أسئلة اختيار من متعدد عن الأدوات والبرمجيات الخبيثة وNmap
  وأعلامه وMetasploit وأدوات الاختبار (Wireshark, Burp, sqlmap, John, Hydra…) ومفاهيم الأمن.

![اختيار النمط](screenshots/11-modeselect-ar.png)

| نمط اللغات | نمط الأمن السيبراني |
| --- | --- |
| ![اللعب](screenshots/6-game-ar.png) | ![سيبراني](screenshots/10-cyber-game-ar.png) |

| شاشة النتائج | القائمة |
| --- | --- |
| ![النتائج](screenshots/7-results-ar.png) | ![القائمة](screenshots/5-menu-ar.png) |

---

## المتطلبات

- [Node.js](https://nodejs.org/) إصدار 18+ (طُوِّرت على v22)
- مدير حِزم — يُفضَّل **pnpm** (npm جيد عادةً، لكنه كان معطّلاً على جهاز التطوير
  فاستُخدم pnpm في كل مكان)
- Windows 10/11

## التشغيل (وضع التطوير)

```powershell
pnpm install      # تثبيت الاعتماديات (Electron)
pnpm start        # تشغيل اللعبة
```

## بناء ملف تنفيذي (.exe)

```powershell
pnpm run dist     # ينتج مُثبّت NSIS داخل مجلد dist/
# أو نسخة محمولة غير مثبّتة:
pnpm run pack
```

الناتج يوضع في مجلد `dist/` (مثل `Guess The Language Setup 2.1.0.exe`).

---

## آلية اللعب

1. عند التشغيل اختر **لغات البرمجة** أو **الأمن السيبراني** (يمكن التبديل لاحقاً عبر زر
   **الأنماط** في القائمة).
2. اضغط **ابدأ اللعب**.
3. يظهر مقتطف/سؤال مع مؤقّت دائري (12–15 ثانية حسب الصعوبة).
4. اختر الإجابة الصحيحة من الأزرار — أو اضغط مفاتيح الأرقام.
5. في النهاية تظهر شاشة النتيجة مع لوحة الصدارة.

بدّل بين **الإنجليزية والعربية** في أي وقت عبر زر EN / ع في القائمة (أو من الإعدادات).
يُحفظ الاختيار، وتقلب العربية الواجهة إلى RTL.

### نظام النقاط
- إجابة صحيحة: **+100**
- مكافأة السرعة: **+10** لكل ثانية متبقية
- سلسلة: مضاعف **×1.5** بعد 3 إجابات صحيحة متتالية
- إجابة خاطئة أو انتهاء الوقت: 0 نقطة وتُصفّر السلسلة

---

## بنية المشروع

```
prog-game2/
├─ package.json                 # السكربتات + إعداد electron-builder
├─ pnpm-workspace.yaml          # السماح ببناء سكربت Electron تحت pnpm
├─ supabase/
│  └─ schema.sql                # جدول لوحة الصدارة + سياسات RLS
├─ src/
│  ├─ main.js                   # عملية Electron الرئيسية (نافذة + IPC)
│  ├─ preload.js                # جسر آمن (window controls + تحميل الأسئلة)
│  ├─ index.html                # الشاشات الثلاث (قائمة / لعب / نتائج)
│  ├─ styles.css                # التصميم الداكن + النيون
│  ├─ renderer.js               # منطق اللعبة، المؤقّت، النقاط، الصدارة
│  ├─ supabase-config.js         # بيانات Supabase (محلي، غير مُتتبَّع بـ git)
│  ├─ supabase-config.example.js # قالب الإعداد
│  └─ data/
│     ├─ questions.json          # بنك اللغات (180 سؤالاً)
│     └─ questions-cyber.json    # بنك الأمن السيبراني (40 سؤالاً)
└─ test/
   ├─ smoke-main.js             # نمط اللغات (14 فحصاً)
   ├─ smoke-cyber.js            # نمط الأمن السيبراني (12 فحصاً)
   ├─ smoke-i18n.js             # تبديل اللغة / RTL (9 فحوصات)
   ├─ smoke-online.js           # مسار Supabase (8 فحوصات)
   ├─ capture.js                # التقاط صور للشاشات
   └─ reset-state.js            # تفريغ الحالة المحفوظة محلياً
```

## قواعد بيانات الأسئلة

**اللغات** — يحوي `src/data/questions.json` **180 سؤالاً** على 6 لغات وثلاث مستويات صعوبة:

```json
{
  "id": 1,
  "correctLanguage": "Python",
  "difficulty": "easy",
  "codeSnippet": "print('Hello, World!')",
  "explanation": { "en": "...", "ar": "..." }
}
```

**الأمن السيبراني** — يحوي `src/data/questions-cyber.json` **40 سؤالاً** (تصنيفات:
nmap، malware، metasploit، tools، concepts)، ولكل سؤال خياراته الخاصة:

```json
{
  "id": 1,
  "category": "nmap",
  "difficulty": "easy",
  "codeSnippet": "nmap -sS 10.0.0.5",
  "question": { "en": "What scan does -sS perform?", "ar": "..." },
  "options": ["TCP SYN (stealth) scan", "UDP scan", "TCP connect scan", "Ping sweep"],
  "answer": "TCP SYN (stealth) scan",
  "explanation": { "en": "...", "ar": "..." }
}
```

البنكان يُولَّدان عبر سكربتات في `scripts/` وتُحمَّل تلقائياً عند التشغيل.

---

## لوحة الصدارة عبر Supabase

اللعبة تعمل محلياً بالكامل بدون إعداد. لتفعيل لوحة صدارة عالمية حقيقية:

1. أنشئ مشروعاً مجانياً على [supabase.com](https://supabase.com).
2. في **SQL Editor**، نفّذ محتوى [`supabase/schema.sql`](supabase/schema.sql)
   (ينشئ جدول `scores` مع سياسات RLS للقراءة والإضافة العامة).
3. انسخ `src/supabase-config.example.js` إلى `src/supabase-config.js`.
4. من **Project Settings → API** انسخ `Project URL` و`anon public key` والصقهما
   في `src/supabase-config.js`.
5. أعد تشغيل اللعبة. ستظهر شاشة النتائج أعلى 10 لاعبين عالمياً مع تمييز صفّك.

> المفتاح `anon` مُصمَّم ليكون عاماً في تطبيقات العميل؛ التحكم بالوصول عبر سياسات
> RLS. إذا تُرك الإعداد فارغاً تعود اللعبة للوحة محلية تجريبية.
> **ملاحظة أمنية:** الإضافة عبر `anon` قابلة للتزوير من العميل؛ لمنع الغش انقل
> إرسال النتيجة إلى Edge Function تتحقق من الجولة (انظر تعليق `schema.sql`).

يُضبط اسمك في اللوحة من شاشة **الإعدادات**.

---

## ملاحظات على التصميم

- **محلي أولاً:** اللعبة تعمل كاملة دون إنترنت أو خادم. عند إعداد Supabase تتحوّل
  شاشة المقارنة إلى لوحة صدارة عالمية؛ وبدون إعداد تعود إلى بيانات تجريبية محلية.
- **التظليل اللوني:** محرّك خفيف داخلي بلا اعتماديات خارجية يعمل دون اتصال.
- **الصوت:** نغمات بسيطة عبر WebAudio (لا ملفات صوتية).
- **الأمان:** `contextIsolation` مفعّل و`nodeIntegration` معطّل و`sandbox` مفعّل،
  وسياسة CSP صارمة، وبناء DOM عبر `textContent` (أسماء اللوحة لا تستطيع حقن HTML).
  وتُحفظ النتيجة الأعلى محلياً عبر `localStorage`.

## الاختبارات

```powershell
pnpm exec electron test/smoke-main.js      # اختبار شامل بلا اتصال (13 فحصاً)
pnpm exec electron test/smoke-online.js    # مسار Supabase المتصل (8 فحوصات)
```

## خارطة الطريق

- ✅ لوحة متصدرين عالمية عبر Supabase
- ⏳ تسجيل دخول (Email / Google / Guest)
- ⏳ نظام أصدقاء حقيقي (إضافة/متابعة) بدل اللوحة العامة فقط
- ⏳ إرسال النتيجة عبر Edge Function للتحقق منها (منع الغش)

## الرخصة

رخصة MIT — انظر ملف [LICENSE](LICENSE).

</div>
