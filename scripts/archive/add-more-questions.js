'use strict';
// Appends a batch of new questions (ids 121-180) to questions.json,
// preserving the existing entries and the { en, ar } explanation shape.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'data', 'questions.json');

const NEW = [
  // ---------- Python ----------
  { id: 121, correctLanguage: "Python", difficulty: "easy", codeSnippet: "x = 5\nif x > 3:\n    print(\"big\")", explanation: { en: "Indentation-based blocks with print() and a colon are Python.", ar: "كتل بالإزاحة مع print() ونقطتان بعد if من بايثون." } },
  { id: 122, correctLanguage: "Python", difficulty: "easy", codeSnippet: "fruits = ['apple', 'banana']\nfor fruit in fruits:\n    print(fruit)", explanation: { en: "for x in list with no braces and print() is Python.", ar: "حلقة for x in list بلا أقواس مع print() من بايثون." } },
  { id: 123, correctLanguage: "Python", difficulty: "medium", codeSnippet: "def factorial(n):\n    return 1 if n == 0 else n * factorial(n - 1)", explanation: { en: "The 'x if cond else y' conditional expression is Python's ternary.", ar: "التعبير الشرطي x if cond else y هو ثلاثي بايثون." } },
  { id: 124, correctLanguage: "Python", difficulty: "medium", codeSnippet: "text = f\"{name} is {age} years old\"", explanation: { en: "An f-string with {} interpolation is Python.", ar: "سلسلة f-string مع {} من بايثون." } },
  { id: 125, correctLanguage: "Python", difficulty: "medium", codeSnippet: "import os\nfiles = os.listdir('.')", explanation: { en: "import os and os.listdir() are from Python's standard library.", ar: "import os و os.listdir() من مكتبة بايثون القياسية." } },
  { id: 126, correctLanguage: "Python", difficulty: "medium", codeSnippet: "squares = {n: n * n for n in range(5)}", explanation: { en: "A {key: value for ...} dict comprehension is Python.", ar: "صيغة {key: value for ...} من بايثون." } },
  { id: 127, correctLanguage: "Python", difficulty: "hard", codeSnippet: "@dataclass\nclass Point:\n    x: int\n    y: int", explanation: { en: "The @dataclass decorator with type-annotated fields is Python.", ar: "الموسوم @dataclass مع حقول موسومة بالأنواع من بايثون." } },
  { id: 128, correctLanguage: "Python", difficulty: "hard", codeSnippet: "with ThreadPoolExecutor() as ex:\n    results = ex.map(work, items)", explanation: { en: "concurrent.futures ThreadPoolExecutor with 'with' is Python.", ar: "ThreadPoolExecutor مع with من concurrent.futures في بايثون." } },
  { id: 129, correctLanguage: "Python", difficulty: "hard", codeSnippet: "class Meta(type):\n    def __new__(mcs, name, bases, ns):\n        return super().__new__(mcs, name, bases, ns)", explanation: { en: "A metaclass with __new__ and super() is Python.", ar: "ميتا-كلاس مع __new__ و super() من بايثون." } },
  { id: 130, correctLanguage: "Python", difficulty: "medium", codeSnippet: "assert x == 5, \"x must be 5\"", explanation: { en: "assert with a message is Python syntax.", ar: "assert مع رسالة من صيغة بايثون." } },

  // ---------- JavaScript ----------
  { id: 131, correctLanguage: "JavaScript", difficulty: "easy", codeSnippet: "var x = 10;\nvar y = \"hello\";", explanation: { en: "var declarations are JavaScript.", ar: "تصريحات var من جافاسكربت." } },
  { id: 132, correctLanguage: "JavaScript", difficulty: "easy", codeSnippet: "const obj = { name: \"JS\", year: 1995 };", explanation: { en: "A const object literal with {} is JavaScript.", ar: "كائن حرفي const مع {} من جافاسكربت." } },
  { id: 133, correctLanguage: "JavaScript", difficulty: "medium", codeSnippet: "const evens = arr.filter(n => n % 2 === 0);", explanation: { en: "filter with an arrow function and === is JavaScript.", ar: "filter مع دالة سهمية و === من جافاسكربت." } },
  { id: 134, correctLanguage: "JavaScript", difficulty: "medium", codeSnippet: "let str = `Hello ${name}, welcome`;", explanation: { en: "A template literal with backticks and ${} is JavaScript.", ar: "سلسلة قالبية بعلامات backtick و ${} من جافاسكربت." } },
  { id: 135, correctLanguage: "JavaScript", difficulty: "medium", codeSnippet: "Object.keys(obj).forEach(key => console.log(key));", explanation: { en: "Object.keys(...).forEach is JavaScript.", ar: "Object.keys(...).forEach من جافاسكربت." } },
  { id: 136, correctLanguage: "JavaScript", difficulty: "medium", codeSnippet: "const fn = function () { return this.value; };", explanation: { en: "A function expression using 'this' is JavaScript.", ar: "تعبير دالة يستخدم this من جافاسكربت." } },
  { id: 137, correctLanguage: "JavaScript", difficulty: "hard", codeSnippet: "module.exports = { add, subtract };", explanation: { en: "module.exports is CommonJS (Node.js / JavaScript).", ar: "module.exports من CommonJS (Node/جافاسكربت)." } },
  { id: 138, correctLanguage: "JavaScript", difficulty: "hard", codeSnippet: "const once = (fn) => { let done = false; return (...a) => done || (done = true, fn(...a)); };", explanation: { en: "Nested arrow functions with rest ...args are JavaScript.", ar: "دوال سهمية متداخلة مع ...args من جافاسكربت." } },
  { id: 139, correctLanguage: "JavaScript", difficulty: "medium", codeSnippet: "try {\n  JSON.parse(data);\n} catch (e) {\n  console.error(e);\n}", explanation: { en: "try/catch with console.error is JavaScript.", ar: "try/catch مع console.error من جافاسكربت." } },
  { id: 140, correctLanguage: "JavaScript", difficulty: "hard", codeSnippet: "const name = obj?.user?.name ?? \"default\";", explanation: { en: "Optional chaining ?. and nullish coalescing ?? are JavaScript.", ar: "السلسلة الاختيارية ?. والدمج العدمي ?? من جافاسكربت." } },

  // ---------- C++ ----------
  { id: 141, correctLanguage: "C++", difficulty: "easy", codeSnippet: "#include <string>\nstd::string s = \"hello\";", explanation: { en: "#include <string> and std::string are C++.", ar: "‎#include <string> و std::string من ++C." } },
  { id: 142, correctLanguage: "C++", difficulty: "easy", codeSnippet: "int arr[5] = {1, 2, 3, 4, 5};", explanation: { en: "A C-style array initializer int arr[5] = {...} is C++.", ar: "تهيئة مصفوفة بنمط C مثل int arr[5] = {...} من ++C." } },
  { id: 143, correctLanguage: "C++", difficulty: "medium", codeSnippet: "for (int i : {1, 2, 3}) std::cout << i;", explanation: { en: "A range-based for with std::cout is C++.", ar: "حلقة for مدى مع std::cout من ++C." } },
  { id: 144, correctLanguage: "C++", difficulty: "medium", codeSnippet: "std::cout << (x > 0 ? \"pos\" : \"neg\");", explanation: { en: "std::cout with the ?: ternary is C++.", ar: "std::cout مع الثلاثي ?: من ++C." } },
  { id: 145, correctLanguage: "C++", difficulty: "medium", codeSnippet: "enum class Color { Red, Green, Blue };", explanation: { en: "enum class (a scoped enum) is C++.", ar: "enum class (تعداد مُنطّق) من ++C." } },
  { id: 146, correctLanguage: "C++", difficulty: "medium", codeSnippet: "std::unordered_map<int, std::string> m;", explanation: { en: "std::unordered_map with the std namespace is C++.", ar: "std::unordered_map بمساحة std من ++C." } },
  { id: 147, correctLanguage: "C++", difficulty: "hard", codeSnippet: "auto sq = [](int x) { return x * x; };", explanation: { en: "A lambda with [ ] capture is C++.", ar: "تعبير لامبدا مع التقاط [ ] من ++C." } },
  { id: 148, correctLanguage: "C++", difficulty: "hard", codeSnippet: "std::cout << std::boolalpha << (a == b);", explanation: { en: "std::boolalpha is from C++ iostream.", ar: "std::boolalpha من iostream في ++C." } },
  { id: 149, correctLanguage: "C++", difficulty: "hard", codeSnippet: "constexpr int square(int x) { return x * x; }", explanation: { en: "constexpr is a C++ keyword.", ar: "constexpr كلمة مفتاحية في ++C." } },
  { id: 150, correctLanguage: "C++", difficulty: "medium", codeSnippet: "std::string& ref = name;", explanation: { en: "A reference type std::string& is C++.", ar: "نوع مرجعي std::string& من ++C." } },

  // ---------- Java ----------
  { id: 151, correctLanguage: "Java", difficulty: "easy", codeSnippet: "boolean flag = true;\nif (flag) System.out.println(\"yes\");", explanation: { en: "boolean with System.out.println is Java.", ar: "boolean مع System.out.println من جافا." } },
  { id: 152, correctLanguage: "Java", difficulty: "easy", codeSnippet: "System.out.print(\"Enter a number: \");", explanation: { en: "System.out.print is Java.", ar: "System.out.print من جافا." } },
  { id: 153, correctLanguage: "Java", difficulty: "medium", codeSnippet: "int sum = Arrays.stream(nums).sum();", explanation: { en: "Arrays.stream(...).sum() is Java.", ar: "Arrays.stream(...).sum() من جافا." } },
  { id: 154, correctLanguage: "Java", difficulty: "medium", codeSnippet: "public interface Comparable<T> {\n    int compareTo(T o);\n}", explanation: { en: "A public interface with generics <T> is Java.", ar: "واجهة interface مع أنواع مولّدة <T> من جافا." } },
  { id: 155, correctLanguage: "Java", difficulty: "medium", codeSnippet: "enum Day { MONDAY, TUESDAY, WEDNESDAY }", explanation: { en: "A Java enum declaration with constant members.", ar: "تعريف enum بثوابت في جافا." } },
  { id: 156, correctLanguage: "Java", difficulty: "medium", codeSnippet: "String[] parts = text.split(\",\");", explanation: { en: "String[] with String.split is Java.", ar: "String[] مع String.split من جافا." } },
  { id: 157, correctLanguage: "Java", difficulty: "hard", codeSnippet: "list.sort(Comparator.comparing(User::getName));", explanation: { en: "Comparator.comparing with a method reference is Java.", ar: "Comparator.comparing مع مرجع تابع من جافا." } },
  { id: 158, correctLanguage: "Java", difficulty: "hard", codeSnippet: "CompletableFuture.supplyAsync(() -> compute());", explanation: { en: "CompletableFuture.supplyAsync is Java.", ar: "CompletableFuture.supplyAsync من جافا." } },
  { id: 159, correctLanguage: "Java", difficulty: "hard", codeSnippet: "@FunctionalInterface\ninterface Calc { int apply(int a, int b); }", explanation: { en: "The @FunctionalInterface annotation is Java.", ar: "الموسوم @FunctionalInterface من جافا." } },
  { id: 160, correctLanguage: "Java", difficulty: "medium", codeSnippet: "final double PI = 3.14159;", explanation: { en: "final before a type (final double) is Java.", ar: "final قبل النوع (final double) من جافا." } },

  // ---------- Rust ----------
  { id: 161, correctLanguage: "Rust", difficulty: "easy", codeSnippet: "let name = \"Rust\";\nprintln!(\"Hello, {}\", name);", explanation: { en: "println! with a {} placeholder and a variable is Rust.", ar: "println! مع المنوب {} ومتغير من رست." } },
  { id: 162, correctLanguage: "Rust", difficulty: "easy", codeSnippet: "fn greet() {\n    println!(\"Hi there\");\n}", explanation: { en: "fn with the println! macro is Rust.", ar: "fn مع الماكرو println! من رست." } },
  { id: 163, correctLanguage: "Rust", difficulty: "medium", codeSnippet: "for n in &numbers {\n    println!(\"{}\", n);\n}", explanation: { en: "for n in &numbers (borrowing) is Rust.", ar: "for n in &numbers (استعارة) من رست." } },
  { id: 164, correctLanguage: "Rust", difficulty: "medium", codeSnippet: "let doubled: Vec<i32> = nums.iter().map(|x| x * 2).collect();", explanation: { en: "iter().map(|x| ...).collect() with a closure is Rust.", ar: "iter().map(|x| ...).collect() مع إغلاق من رست." } },
  { id: 165, correctLanguage: "Rust", difficulty: "medium", codeSnippet: "trait Animal {\n    fn sound(&self) -> String;\n}", explanation: { en: "A trait with fn ...(&self) -> is Rust.", ar: "trait مع fn ...(self&) <- من رست." } },
  { id: 166, correctLanguage: "Rust", difficulty: "hard", codeSnippet: "map.entry(key).or_insert(0);", explanation: { en: "HashMap entry().or_insert() is Rust.", ar: "HashMap entry().or_insert() من رست." } },
  { id: 167, correctLanguage: "Rust", difficulty: "hard", codeSnippet: "impl<T> Stack<T> {\n    fn new() -> Self { Stack { items: Vec::new() } }\n}", explanation: { en: "impl<T> with Self is Rust.", ar: "impl<T> مع Self من رست." } },
  { id: 168, correctLanguage: "Rust", difficulty: "hard", codeSnippet: "let level = match value {\n    1..=5 => \"low\",\n    _ => \"high\",\n};", explanation: { en: "match with a 1..=5 range arm and _ is Rust.", ar: "match مع نطاق 1..=5 و _ من رست." } },
  { id: 169, correctLanguage: "Rust", difficulty: "medium", codeSnippet: "let opt: Option<i32> = Some(42);", explanation: { en: "The Option<i32> type with Some is Rust.", ar: "النوع <Option<i32 مع Some من رست." } },
  { id: 170, correctLanguage: "Rust", difficulty: "hard", codeSnippet: "let boxed: Box<dyn Shape> = Box::new(circle);", explanation: { en: "Box<dyn Trait> with Box::new is Rust.", ar: "Box<dyn Trait> مع Box::new من رست." } },

  // ---------- Go ----------
  { id: 171, correctLanguage: "Go", difficulty: "easy", codeSnippet: "fmt.Println(\"Hello,\", name)", explanation: { en: "fmt.Println with multiple arguments is Go.", ar: "fmt.Println بوسائط متعددة من Go." } },
  { id: 172, correctLanguage: "Go", difficulty: "easy", codeSnippet: "var count int = 0\ncount++", explanation: { en: "var count int with ++ is Go.", ar: "var count int مع ++ من Go." } },
  { id: 173, correctLanguage: "Go", difficulty: "medium", codeSnippet: "numbers := make([]int, 0, 10)", explanation: { en: "make([]int, 0, 10) is Go.", ar: "make([]int, 0, 10) من Go." } },
  { id: 174, correctLanguage: "Go", difficulty: "medium", codeSnippet: "for i := range items {\n    fmt.Println(i)\n}", explanation: { en: "for i := range items is Go.", ar: "for i := range items من Go." } },
  { id: 175, correctLanguage: "Go", difficulty: "medium", codeSnippet: "if value, ok := m[key]; ok {\n    use(value)\n}", explanation: { en: "The 'value, ok := m[key]' comma-ok idiom is Go.", ar: "نمط value, ok := m[key] من Go." } },
  { id: 176, correctLanguage: "Go", difficulty: "medium", codeSnippet: "func divide(a, b float64) (float64, error) {\n    return a / b, nil\n}", explanation: { en: "Returning (float64, error) is a Go pattern.", ar: "إرجاع (float64, error) نمط Go." } },
  { id: 177, correctLanguage: "Go", difficulty: "hard", codeSnippet: "defer func() {\n    if r := recover(); r != nil {\n    }\n}()", explanation: { en: "recover() inside a deferred func is Go.", ar: "recover() داخل دالة مؤجّلة من Go." } },
  { id: 178, correctLanguage: "Go", difficulty: "hard", codeSnippet: "var mu sync.Mutex\nmu.Lock()\ndefer mu.Unlock()", explanation: { en: "sync.Mutex with Lock/Unlock is Go.", ar: "sync.Mutex مع Lock/Unlock من Go." } },
  { id: 179, correctLanguage: "Go", difficulty: "medium", codeSnippet: "type Celsius float64", explanation: { en: "type Celsius float64 (a defined type) is Go.", ar: "type Celsius float64 (نوع معرّف) من Go." } },
  { id: 180, correctLanguage: "Go", difficulty: "hard", codeSnippet: "ticker := time.NewTicker(time.Second)", explanation: { en: "time.NewTicker is from Go's time package.", ar: "time.NewTicker من حزمة time في Go." } }
];

const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
const existing = new Set(data.map((q) => q.id));
let added = 0;
for (const q of NEW) {
  if (existing.has(q.id)) { console.error('Duplicate id skipped:', q.id); continue; }
  data.push(q);
  existing.add(q.id);
  added++;
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`Added ${added} questions; total now ${data.length}.`);
