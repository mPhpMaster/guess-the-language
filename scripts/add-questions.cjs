'use strict';

/* One-off helper: appends new "guess the language" questions to
   src/data/questions.json, validating that each snippet is unique and
   that every language is part of the playable LANGUAGES set. */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'data', 'questions.json');
const VALID_LANGS = ['Python', 'JavaScript', 'C++', 'Java', 'Rust', 'Go'];

const NEW = [
  // ---------- Python ----------
  {
    correctLanguage: 'Python', difficulty: 'easy',
    codeSnippet: 'label = "even" if n % 2 == 0 else "odd"',
    explanation: {
      en: 'The "value if condition else value" ternary order is unique to Python.',
      ar: 'ترتيب الشرط "القيمة if الشرط else القيمة" خاص ببايثون.'
    }
  },
  {
    correctLanguage: 'Python', difficulty: 'medium',
    codeSnippet: 'print(", ".join(map(str, nums)))',
    explanation: {
      en: 'str.join with map() and the print() function are idiomatic Python.',
      ar: 'استخدام str.join مع map() ودالة print() نمط بايثوني أصيل.'
    }
  },
  {
    correctLanguage: 'Python', difficulty: 'medium',
    codeSnippet: 'pairs = {k: v for k, v in items}',
    explanation: {
      en: 'A dict comprehension with {key: value for ...} is a Python feature.',
      ar: 'إنشاء قاموس عبر {key: value for ...} من مميزات بايثون.'
    }
  },
  {
    correctLanguage: 'Python', difficulty: 'medium',
    codeSnippet: 'match status:\n    case 200 | 201:\n        ok()',
    explanation: {
      en: 'Structural pattern matching with match/case arrived in Python 3.10.',
      ar: 'مطابقة الأنماط match/case أُضيفت في بايثون 3.10.'
    }
  },
  {
    correctLanguage: 'Python', difficulty: 'hard',
    codeSnippet: '@dataclass(frozen=True)\nclass Point:\n    x: int\n    y: int',
    explanation: {
      en: 'The @dataclass decorator with type-annotated fields is Python.',
      ar: 'الديكوريتر @dataclass مع حقول موصوفة بالأنواع من بايثون.'
    }
  },

  // ---------- JavaScript ----------
  {
    correctLanguage: 'JavaScript', difficulty: 'easy',
    codeSnippet: 'const { x, y } = point;',
    explanation: {
      en: 'Object destructuring with const is everyday JavaScript syntax.',
      ar: 'تفكيك الكائن مع const من صيغ جافاسكربت اليومية.'
    }
  },
  {
    correctLanguage: 'JavaScript', difficulty: 'medium',
    codeSnippet: 'const value = arr?.[0] ?? "none";',
    explanation: {
      en: 'Optional chaining ?.[ ] combined with ?? is JavaScript.',
      ar: 'السلسلة الاختيارية ?.[ ] مع المعامل ?? من جافاسكربت.'
    }
  },
  {
    correctLanguage: 'JavaScript', difficulty: 'easy',
    codeSnippet: 'setTimeout(() => console.log("done"), 1000);',
    explanation: {
      en: 'setTimeout with an arrow callback is core JavaScript.',
      ar: 'setTimeout مع دالة سهمية من أساسيات جافاسكربت.'
    }
  },
  {
    correctLanguage: 'JavaScript', difficulty: 'medium',
    codeSnippet: 'for (const [k, v] of Object.entries(obj)) {\n  console.log(k, v);\n}',
    explanation: {
      en: 'Object.entries with for...of destructuring is JavaScript.',
      ar: 'Object.entries مع for...of وتفكيك القيم من جافاسكربت.'
    }
  },
  {
    correctLanguage: 'JavaScript', difficulty: 'hard',
    codeSnippet: 'function* range(n) {\n  for (let i = 0; i < n; i++) yield i;\n}',
    explanation: {
      en: 'function* with yield defines a generator in JavaScript.',
      ar: 'function* مع yield تُعرّف مولّداً (generator) في جافاسكربت.'
    }
  },

  // ---------- C++ ----------
  {
    correctLanguage: 'C++', difficulty: 'easy',
    codeSnippet: 'std::cout << "x = " << x << "\\n";',
    explanation: {
      en: 'Stream insertion with std::cout << is classic C++.',
      ar: 'الإخراج عبر std::cout << من سمات ++C الكلاسيكية.'
    }
  },
  {
    correctLanguage: 'C++', difficulty: 'medium',
    codeSnippet: 'auto ptr = std::make_unique<int>(42);',
    explanation: {
      en: 'std::make_unique returns a smart pointer, a modern C++ feature.',
      ar: 'std::make_unique تُرجع مؤشراً ذكياً، وهي ميزة في ++C الحديثة.'
    }
  },
  {
    correctLanguage: 'C++', difficulty: 'medium',
    codeSnippet: 'for (const auto& item : items) {\n    process(item);\n}',
    explanation: {
      en: 'A range-based for over const auto& is distinctive C++.',
      ar: 'حلقة for النطاقية على const auto& مميزة لـ ++C.'
    }
  },
  {
    correctLanguage: 'C++', difficulty: 'hard',
    codeSnippet: 'std::sort(v.begin(), v.end(),\n    [](int a, int b) { return a > b; });',
    explanation: {
      en: 'std::sort with begin()/end() iterators and a lambda is C++.',
      ar: 'std::sort مع مكرّرات begin()/end() ودالة لمدا من ++C.'
    }
  },
  {
    correctLanguage: 'C++', difficulty: 'medium',
    codeSnippet: 'std::unordered_map<std::string, int> freq;',
    explanation: {
      en: 'The std::unordered_map template with the std:: prefix is C++.',
      ar: 'القالب std::unordered_map مع البادئة std:: من ++C.'
    }
  },

  // ---------- Java ----------
  {
    correctLanguage: 'Java', difficulty: 'easy',
    codeSnippet: 'var sb = new StringBuilder();\nsb.append("hi");',
    explanation: {
      en: 'StringBuilder with append() and var is typical Java.',
      ar: 'StringBuilder مع append() والكلمة var من نمط جافا المعتاد.'
    }
  },
  {
    correctLanguage: 'Java', difficulty: 'medium',
    codeSnippet: 'List<String> names = new ArrayList<>();',
    explanation: {
      en: 'Generic List with the diamond operator new ArrayList<>() is Java.',
      ar: 'قائمة List عامة مع المعامل الماسي new ArrayList<>() من جافا.'
    }
  },
  {
    correctLanguage: 'Java', difficulty: 'medium',
    codeSnippet: 'int total = nums.stream().mapToInt(Integer::intValue).sum();',
    explanation: {
      en: 'Stream pipelines with method references Integer::intValue are Java.',
      ar: 'سلاسل Stream مع مراجع الدوال Integer::intValue من جافا.'
    }
  },
  {
    correctLanguage: 'Java', difficulty: 'hard',
    codeSnippet: 'public record Point(int x, int y) {}',
    explanation: {
      en: 'The record keyword for immutable data classes is modern Java.',
      ar: 'الكلمة record لأصناف البيانات الثابتة من جافا الحديثة.'
    }
  },
  {
    correctLanguage: 'Java', difficulty: 'medium',
    codeSnippet: 'Map<String, Integer> counts = new HashMap<>();',
    explanation: {
      en: 'A generic Map backed by new HashMap<>() is standard Java.',
      ar: 'خريطة Map عامة مدعومة بـ new HashMap<>() من جافا القياسية.'
    }
  },

  // ---------- Rust ----------
  {
    correctLanguage: 'Rust', difficulty: 'easy',
    codeSnippet: 'let mut total = 0;\ntotal += 1;',
    explanation: {
      en: 'Declaring a mutable binding with let mut is core Rust.',
      ar: 'تعريف متغير قابل للتعديل عبر let mut من أساسيات رست.'
    }
  },
  {
    correctLanguage: 'Rust', difficulty: 'medium',
    codeSnippet: 'let nums: Vec<i32> = (1..=5).collect();',
    explanation: {
      en: 'An inclusive range (1..=5) collected into Vec<i32> is Rust.',
      ar: 'نطاق شامل (1..=5) يُجمَع في Vec<i32> من رست.'
    }
  },
  {
    correctLanguage: 'Rust', difficulty: 'medium',
    codeSnippet: 'match result {\n    Ok(v) => v,\n    Err(_) => 0,\n}',
    explanation: {
      en: 'Matching on Ok/Err variants of Result is idiomatic Rust.',
      ar: 'المطابقة على المتغيّرين Ok/Err من نوع Result نمط رست أصيل.'
    }
  },
  {
    correctLanguage: 'Rust', difficulty: 'hard',
    codeSnippet: 'impl Iterator for Counter {\n    type Item = u32;\n    fn next(&mut self) -> Option<u32> { None }\n}',
    explanation: {
      en: 'impl Trait for Type with an associated type is Rust.',
      ar: 'impl Trait for Type مع نوع مرتبط (associated type) من رست.'
    }
  },
  {
    correctLanguage: 'Rust', difficulty: 'medium',
    codeSnippet: 'let name = String::from("rust");\nlet len = name.len();',
    explanation: {
      en: 'String::from and the let bindings without semicolon-free returns are Rust.',
      ar: 'استخدام String::from مع تعريفات let من سمات رست.'
    }
  },

  // ---------- Go ----------
  {
    correctLanguage: 'Go', difficulty: 'easy',
    codeSnippet: 'fmt.Printf("x = %d\\n", x)',
    explanation: {
      en: 'fmt.Printf with %d verbs and no trailing semicolon is Go.',
      ar: 'fmt.Printf مع الرموز %d وبدون فاصلة منقوطة من Go.'
    }
  },
  {
    correctLanguage: 'Go', difficulty: 'medium',
    codeSnippet: 'switch v := x.(type) {\ncase int:\n    fmt.Println(v)\n}',
    explanation: {
      en: 'A type switch using x.(type) is a Go-specific construct.',
      ar: 'مبدّل الأنواع عبر x.(type) تركيب خاص بلغة Go.'
    }
  },
  {
    correctLanguage: 'Go', difficulty: 'medium',
    codeSnippet: 'for i, v := range items {\n    fmt.Println(i, v)\n}',
    explanation: {
      en: 'The i, v := range form with := is distinctive Go.',
      ar: 'صيغة i, v := range مع := مميزة للغة Go.'
    }
  },
  {
    correctLanguage: 'Go', difficulty: 'hard',
    codeSnippet: 'func divide(a, b int) (int, error) {\n    return a / b, nil\n}',
    explanation: {
      en: 'Multiple return values including error and the nil zero value are Go.',
      ar: 'إرجاع قيم متعددة منها error مع القيمة nil من سمات Go.'
    }
  },
  {
    correctLanguage: 'Go', difficulty: 'medium',
    codeSnippet: 'm := map[string]int{"a": 1, "b": 2}',
    explanation: {
      en: 'Map literals written as map[string]int{...} are Go syntax.',
      ar: 'تعريف الخرائط بصيغة map[string]int{...} من Go.'
    }
  }
];

const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const existing = new Set(data.map((q) => norm(q.codeSnippet)));

const errors = [];
const seenNew = new Set();
for (const q of NEW) {
  if (!VALID_LANGS.includes(q.correctLanguage)) errors.push(`invalid language: ${q.correctLanguage}`);
  const key = norm(q.codeSnippet);
  if (existing.has(key)) errors.push(`duplicate of existing snippet: ${q.codeSnippet}`);
  if (seenNew.has(key)) errors.push(`duplicate within new batch: ${q.codeSnippet}`);
  seenNew.add(key);
}
if (errors.length) {
  console.error('VALIDATION FAILED:\n' + errors.join('\n'));
  process.exit(1);
}

let nextId = Math.max(...data.map((q) => q.id)) + 1;
const appended = NEW.map((q) => ({
  id: nextId++,
  correctLanguage: q.correctLanguage,
  difficulty: q.difficulty,
  codeSnippet: q.codeSnippet,
  explanation: q.explanation
}));

const merged = data.concat(appended);
fs.writeFileSync(FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

const byLang = {};
for (const q of appended) byLang[q.correctLanguage] = (byLang[q.correctLanguage] || 0) + 1;
console.log(`Added ${appended.length} questions (ids ${appended[0].id}-${appended[appended.length - 1].id}).`);
console.log('Per language:', JSON.stringify(byLang));
console.log('New total:', merged.length);
