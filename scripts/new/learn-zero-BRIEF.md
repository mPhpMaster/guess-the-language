# Course "From Zero" (id: from-zero) — brief for level writers

Audience: someone who knows NOTHING — has used a phone and a browser, never
programmed, may not know what a file path, a terminal, a URL or a protocol is.
By the end of this course they can install Python, write small programs, and
run their first FastAPI app. The next course ("Build an API with FastAPI",
already written — see E:\prog-game2\scripts\new\learn-fastapi-1.json … -11.json)
starts from HTTP basics, so do not go deeper than needed into HTTP/FastAPI here.

Follow BOTH guides:
- E:\prog-game2\scripts\new\learn-GUIDE.md — file schema, quiz rules (exactly
  10 questions, en+ar everywhere, answers spread over 0-3, similar option
  lengths, ≥4 with codeSnippet when the level has code; for non-code levels use
  a URL, a command, a terminal output or a small diagram-as-text as the snippet),
  correctness rules.
- E:\prog-game2\scripts\new\learn-GUIDE-v2.md — lessons are VISUAL-FIRST,
  very little text (overrides v1 for lessons). The owner LOVED the visual style
  of the FastAPI course: animated chat, flow, coloured anatomy, cards, pills,
  steps, compare. Use them generously. Analogies from daily life work great for
  this audience (a URL is an address, a protocol is a shared language/etiquette,
  a server is a restaurant kitchen, a variable is a labelled box...).

Extra rules for this course:
- Every lesson must make a total beginner feel smart: one idea, a real-life
  analogy, a picture-like block, a tiny example.
- Explain every term the first time (with the English word kept in Arabic text,
  e.g. «الرابط (URL)»).
- Windows is the most common OS for this audience: show Windows commands first,
  and macOS/Linux alternatives in a compare or a tip when they differ
  (`python` vs `python3`, `.venv\Scripts\activate` vs `source .venv/bin/activate`,
  `dir` vs `ls`).
- Python examples: run EVERY snippet and every quiz answer that depends on
  output with `D:\gtltools\fastapi-venv\Scripts\python.exe` (Python 3.10) and
  confirm the exact output you state. Shell commands: run them in Git Bash /
  cmd where possible. Put scratch files under `D:\gtltools\learn-scratch\zero-<n>\`.
- Level JSON must include `"icon": "<emoji>"`.
- Write the file with Python json.dump(ensure_ascii=False, indent=1), load it
  back and validate (v1 + v2 limits). Do not touch anything else under
  E:\prog-game2, do not commit.

Report: lesson titles and block types, quiz mix and answer spread, what you ran.
