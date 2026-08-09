'use strict';
// Appends a batch of new questions to the languages bank (questions.json),
// preserving existing entries and the { en, ar } explanation shape.
// Run: node scripts/add-languages-questions.js
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'data', 'questions.json');

const NEW = [
  // Python
  { lang: "Python", d: "easy", code: "numbers = [1, 2, 3]\ntotal = sum(numbers)", en: "sum() on a list with no semicolons is Python.", ar: "sum() على قائمة بلا فواصل منقوطة من بايثون." },
  { lang: "Python", d: "medium", code: "import json\ndata = json.loads(raw)", en: "import json and json.loads() are from Python's standard library.", ar: "import json و json.loads() من مكتبة بايثون القياسية." },
  { lang: "Python", d: "medium", code: "print(f\"{value:.2f}\")", en: "An f-string with a :.2f format spec is Python.", ar: "سلسلة f-string مع منسّق ‎:.2f‎ من بايثون." },
  { lang: "Python", d: "medium", code: "from typing import Optional, List", en: "from typing import ... type hints are Python.", ar: "from typing import ... لتلميحات الأنواع من بايثون." },
  { lang: "Python", d: "hard", code: "match command:\n    case \"go\":\n        run()", en: "match/case structural pattern matching is Python 3.10+.", ar: "مطابقة الأنماط match/case من بايثون 3.10+." },
  { lang: "Python", d: "hard", code: "with contextlib.suppress(KeyError):\n    del d[key]", en: "contextlib.suppress with 'with' is Python.", ar: "contextlib.suppress مع with من بايثون." },

  // JavaScript
  { lang: "JavaScript", d: "easy", code: "const add = (a, b) => a + b;", en: "A const arrow function is modern JavaScript.", ar: "دالة سهمية const من جافاسكربت الحديثة." },
  { lang: "JavaScript", d: "medium", code: "const unique = new Set([1, 2, 2, 3]);", en: "new Set([...]) is JavaScript.", ar: "new Set([...]) من جافاسكربت." },
  { lang: "JavaScript", d: "medium", code: "nums.sort((a, b) => a - b);", en: "Array.sort with a (a, b) => comparator is JavaScript.", ar: "Array.sort مع مقارن (a, b) => من جافاسكربت." },
  { lang: "JavaScript", d: "medium", code: "if (Array.isArray(value)) {}", en: "Array.isArray is a JavaScript API.", ar: "Array.isArray واجهة جافاسكربت." },
  { lang: "JavaScript", d: "hard", code: "const { id, ...rest } = props;", en: "Rest in object destructuring (...rest) is JavaScript.", ar: "بقية التفكيك (...rest) من جافاسكربت." },
  { lang: "JavaScript", d: "hard", code: "el.classList.toggle('active');", en: "element.classList.toggle is a JavaScript DOM API.", ar: "element.classList.toggle من واجهات DOM في جافاسكربت." },

  // C++
  { lang: "C++", d: "easy", code: "#include <map>\nstd::map<int, int> m;", en: "#include <map> and std::map are C++.", ar: "‎#include <map> و std::map من ++C." },
  { lang: "C++", d: "medium", code: "std::cout << std::setw(5) << x;", en: "std::setw from <iomanip> with std::cout is C++.", ar: "std::setw من iomanip مع std::cout من ++C." },
  { lang: "C++", d: "medium", code: "auto it = std::find(v.begin(), v.end(), x);", en: "std::find with begin()/end() is C++.", ar: "std::find مع begin()/end() من ++C." },
  { lang: "C++", d: "hard", code: "std::thread t(worker);\nt.join();", en: "std::thread with join() is C++.", ar: "std::thread مع join() من ++C." },
  { lang: "C++", d: "hard", code: "std::lock_guard<std::mutex> lock(mtx);", en: "std::lock_guard<std::mutex> is C++.", ar: "std::lock_guard<std::mutex> من ++C." },

  // Java
  { lang: "Java", d: "easy", code: "int sum = a + b;\nSystem.out.println(sum);", en: "System.out.println with typed variables is Java.", ar: "System.out.println مع متغيرات موسومة من جافا." },
  { lang: "Java", d: "medium", code: "List<String> list = List.of(\"a\", \"b\");", en: "List.of(...) factory method is Java 9+.", ar: "التابع المصنع List.of(...) من جافا 9+." },
  { lang: "Java", d: "medium", code: "int n = Integer.parseInt(text);", en: "Integer.parseInt is Java.", ar: "Integer.parseInt من جافا." },
  { lang: "Java", d: "hard", code: "try (var in = open()) {\n}", en: "try-with-resources (try (...)) is Java.", ar: "try مع الموارد (try (...)) من جافا." },
  { lang: "Java", d: "hard", code: "IntStream.range(0, 10).forEach(System.out::println);", en: "IntStream.range with a method reference is Java.", ar: "IntStream.range مع مرجع تابع من جافا." },

  // Rust
  { lang: "Rust", d: "easy", code: "let v = vec![0; 5];", en: "vec![value; count] is a Rust macro.", ar: "ماكرو ![vec![0; 5 من رست." },
  { lang: "Rust", d: "medium", code: "let n = s.parse::<i32>().unwrap();", en: "Turbofish parse::<i32>() with unwrap() is Rust.", ar: "parse::<i32>() (turbofish) مع unwrap() من رست." },
  { lang: "Rust", d: "medium", code: "#[derive(Clone, Debug)]\nstruct User;", en: "The #[derive(...)] attribute is Rust.", ar: "السمة #[derive(...)] من رست." },
  { lang: "Rust", d: "hard", code: "let mut s = String::with_capacity(16);", en: "String::with_capacity and let mut are Rust.", ar: "String::with_capacity و let mut من رست." },
  { lang: "Rust", d: "hard", code: "let n = arr.iter().filter(|&&x| x > 0).count();", en: "iter().filter(|&&x| ...).count() is Rust.", ar: "iter().filter(|&&x| ...).count() من رست." },

  // Go
  { lang: "Go", d: "easy", code: "s := []string{\"a\", \"b\"}", en: "[]string{...} slice literal with := is Go.", ar: "شريحة []string{...} مع =: من Go." },
  { lang: "Go", d: "medium", code: "t := time.Now()", en: "time.Now() with := is Go.", ar: "time.Now() مع =: من Go." },
  { lang: "Go", d: "medium", code: "ch <- value", en: "Sending on a channel (ch <- value) is Go.", ar: "الإرسال عبر قناة (ch <- value) من Go." },
  { lang: "Go", d: "hard", code: "b, err := json.Marshal(data)", en: "json.Marshal with multiple return values is Go.", ar: "json.Marshal مع إرجاع متعدد من Go." }
];

const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
let nextId = data.reduce((m, q) => Math.max(m, q.id), 0) + 1;
let added = 0;
for (const q of NEW) {
  data.push({
    id: nextId++,
    correctLanguage: q.lang,
    difficulty: q.d,
    codeSnippet: q.code,
    explanation: { en: q.en, ar: q.ar }
  });
  added++;
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`Added ${added} languages questions; total now ${data.length}.`);
