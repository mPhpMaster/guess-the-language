# Writing a level for the "Learn" section — FastAPI course

You are writing ONE level of a bilingual (English + Arabic) course that teaches
people to build web APIs with FastAPI, starting from zero. The game shows a
level as a series of short lessons, then a 10-question test. A player may skip
the lessons and go straight to the test. Passing (7/10) unlocks the next level.

## Output file
Write exactly one JSON file (UTF-8, 1-space indent, trailing newline) at the
path your task names. Do NOT touch anything else under E:\prog-game2 and do NOT
git commit.

```json
{
 "id": "kebab-case-level-id",
 "title": {"en": "...", "ar": "..."},
 "summary": {"en": "one sentence", "ar": "جملة واحدة"},
 "lessons": [
  {
   "id": "kebab-case-lesson-id",
   "title": {"en": "...", "ar": "..."},
   "blocks": [
    {"type": "p", "en": "paragraph", "ar": "فقرة"},
    {"type": "h", "en": "sub-heading", "ar": "عنوان فرعي"},
    {"type": "list", "en": ["item", "item"], "ar": ["بند", "بند"]},
    {"type": "code", "lang": "python", "code": "print('hi')"},
    {"type": "tip", "en": "...", "ar": "..."},
    {"type": "warn", "en": "...", "ar": "..."}
   ]
  }
 ],
 "quiz": [
  {
   "id": 1,
   "difficulty": "easy",
   "question": {"en": "...", "ar": "..."},
   "codeSnippet": "",
   "options": [{"en": "...", "ar": "..."}, {"en": "...", "ar": "..."}, {"en": "...", "ar": "..."}, {"en": "...", "ar": "..."}],
   "answer": 0,
   "explanation": {"en": "...", "ar": "..."}
  }
 ]
}
```

- `code.lang` is one of: `python`, `http`, `json`, `bash`, `text`. Code is
  language-neutral (no Arabic inside code). Comments in code: English, short.
- `list.en` and `list.ar` must have the same number of items.
- Inline code in any text uses markdown backticks: `@app.get("/")`. The game
  renders them as code chips. Use them in Arabic text too.
- `answer` is the 0-based index of the correct option. Spread correct answers
  across positions 0-3 (not always the same index).
- An option that is code (e.g. `@app.post("/items")`) has identical `en` and `ar`.

## Content rules
- 3-5 lessons per level, each lesson 4-10 blocks. Short paragraphs (1-3
  sentences). Teach one idea per lesson, with at least one code or
  request/response example per lesson. Build on the previous levels; do not
  re-teach them.
- Audience: beginners who know a little Python (variables, functions, dicts).
- Exactly 10 quiz questions: ~3 easy, ~4 medium, ~3 hard. At least 4 should be
  scenario questions with a `codeSnippet` (code, an HTTP request/response, a
  JSON body, an error) and ask what happens / what is returned / what is wrong.
  Every question must be answerable from THIS level's lessons.
- Options: 4 distinct, plausible, SIMILAR LENGTH (the correct one must not be
  noticeably the longest). No "all of the above".
- Arabic: clear Modern Standard Arabic, friendly, suitable for learners. Keep
  technical terms in English where developers use them (API, endpoint, JSON,
  FastAPI, Pydantic, HTTP, GET/POST, status code) — you may give the Arabic word
  once with the English in parentheses, e.g. «الطلب (request)». Arabic must be a
  faithful translation of the English, not a different text.

## Correctness — REQUIRED
- Target the CURRENT FastAPI (0.162) and Pydantic v2 (2.14). Use modern style:
  `fastapi dev main.py` to run, `pip install "fastapi[standard]"`, Pydantic v2
  APIs (`model_dump()`, not `.dict()`), `str | None = None` for optional
  (Python 3.10+).
- A ready venv with fastapi, httpx and pytest is at
  `D:\gtltools\fastapi-venv\Scripts\python.exe`. Do NOT install anything else
  and do NOT create another venv. Use it to RUN every FastAPI code example and
  every quiz snippet whose answer depends on behaviour (status codes, JSON
  shapes, validation errors) with `fastapi.testclient.TestClient`, and confirm
  the exact output you state. Put your scratch test scripts under
  `D:\gtltools\learn-scratch\<your-level-id>\` (create it), never under E:\ or C:\.
- Write the JSON with a script (Python `json.dump(..., ensure_ascii=False,
  indent=1)`) so escaping is correct, then load it back and validate: every
  lesson/quiz field present, `answer` in 0..3, 4 distinct options per
  language, list lengths equal, exactly 10 questions.

## Report back
Lesson titles, the quiz difficulty mix and answer-position spread, and which
examples/questions you verified by running them (and anything you could not).
