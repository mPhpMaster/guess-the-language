# Learn lessons v2 — VISUAL FIRST, very little text

The owner's feedback on v1: "too much talking. I want more pictures, more
colour, more movement, and less text." Rewrite the LESSONS of your level in
this visual format. Keep the same level id, title, summary, lesson ids and the
same topics/facts (they were verified). The QUIZ stays as it is — only shorten
a question or explanation if it is longer than ~25 words (keep the meaning and
the correct answer exactly).

## Hard limits per lesson
- Start with exactly one `hero` block.
- 4–8 blocks total. At most ONE `p` block, max 18 words. No walls of text.
- At least 3 VISUAL blocks (hero, chat, flow, cards, anatomy, steps, compare, pills).
- Every label/title in a visual block: max 6 words. Card `text`: max 12 words.
- Code blocks: short (≤ 12 lines). Use `highlight` to light up the lines that matter.
- Arabic stays a faithful translation; tech terms in English.

## Block types (all text fields are {"en": "...", "ar": "..."} unless shown)

hero — big animated emoji + one line
  {"type":"hero","emoji":"🌐","en":"An API is a waiter between programs","ar":"..."}

chat — request/response as chat bubbles appearing one by one
  {"type":"chat","messages":[
    {"from":"client","text":"GET /users/42","note":{"en":"asks for user 42","ar":"..."}},
    {"from":"server","text":"200 OK  {\"id\": 42, \"name\": \"Sara\"}","note":{"en":"here it is","ar":"..."}}
  ]}
  `from` is client|server; `text` is code (language-neutral, not bilingual); `note` optional.

flow — icons joined by animated arrows (a dot travels along each arrow)
  {"type":"flow","nodes":[{"icon":"💻","label":{...}},{"icon":"🖥️","label":{...}}],
   "links":[{"label":{...},"back":false}]}
  links.length = nodes.length - 1. `back:true` animates the dot right-to-left
  (a response). For a round trip use 2 nodes and add `"returns":{"en":"response","ar":"..."}`
  on the flow to draw a second, returning arrow:
  {"type":"flow","nodes":[...2 nodes...],"links":[{"label":{"en":"request"...}}],"returns":{"en":"response","ar":"..."}}

cards — grid of coloured cards that pop in one after another
  {"type":"cards","items":[{"icon":"📗","color":"green","title":{...},"text":{...}}]}
  color: green | blue | yellow | red | purple | cyan. 2–6 items. `text` optional.

pills — a row of coloured chips (status codes, methods, types)
  {"type":"pills","items":[{"text":"200","color":"green","label":{"en":"OK","ar":"..."}}]}
  `text` is short code (not bilingual). 2–8 items.

anatomy — one code line/message split into coloured parts with a legend
  {"type":"anatomy","parts":[
    {"text":"GET","color":"blue","label":{"en":"method","ar":"..."}},
    {"text":" /users/42","color":"green","label":{"en":"path","ar":"..."}},
    {"text":"?full=true","color":"yellow","label":{"en":"query","ar":"..."}}
  ]}
  Parts are concatenated in order to form the code (spaces/newlines included in
  `text`). A part may have no `label`/`color` (plain glue text).

steps — numbered steps that slide in one by one
  {"type":"steps","items":[{"en":"Create a venv","ar":"..."},{"en":"...","ar":"..."}]}
  2–6 items, each max 8 words. Inline `code` allowed.

compare — two columns, good vs bad / A vs B
  {"type":"compare","left":{"title":{...},"tone":"good","items":[{...},{...}]},
                    "right":{"title":{...},"tone":"bad","items":[{...}]}}
  tone: good | bad | neutral. 1–4 items per side, max 8 words each.

code — as before, plus optional "highlight":[line numbers, 1-based]
  {"type":"code","lang":"python","code":"...","highlight":[3,4]}

p / tip / warn — as before, but short (max 18 words). Prefer tip over p.
(h and list are no longer used — replace them with steps/cards/pills.)

Inline code uses `backticks` in any text field.

## Process
1. Read your v1 file (path in your task). Keep ids/titles/summary/quiz.
2. Redesign each lesson visually under the limits above.
3. Write with Python json.dump(ensure_ascii=False, indent=1) to the SAME path
   (overwrite), then load it back and validate: limits above, every bilingual
   field has en+ar, links.length == nodes.length-1, highlight lines exist in
   the code, quiz untouched except allowed shortening (same answer index,
   same option count).
4. Do NOT touch anything else under E:\prog-game2, do not commit. If you add or
   change any FastAPI code, run it with D:\gtltools\fastapi-venv\Scripts\python.exe
   (TestClient) before writing it down.

Report: per lesson the block types used and word count of text, and any quiz
items you shortened.
