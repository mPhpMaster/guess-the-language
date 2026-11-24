# .NET / C# batch (v3.45.0) — brief for question writers

Owner asked: "add the .NET language to all sections". Every quiz bank gets C#/.NET
questions. Stage ONLY your own files: `E:\prog-game2\scripts\new\v3450-<bank>.json`
(a JSON array). Do NOT edit src/data, do NOT append, do NOT commit — the lead appends.

## Read first
- Memory notes on the banks: `C:\Users\Administrator\.claude\projects\E--prog-game2\memory\question-banks.md`
  (schemas, ids, length-bias + duplicate guards). Read it fully.
- Look at 10+ existing questions of your bank in `E:\prog-game2\src\data\questions-<bank>.json`
  to match tone, length and difficulty mix.

## Schemas (English only — never add `ar`)
- languages (`questions.json`): `{id, correctLanguage:"C#", difficulty, codeSnippet, explanation{en}}`.
  The snippet must be recognisably C# and NOT also valid Java/Kotlin/TypeScript etc.
- multiple-choice banks: `{id, category, difficulty, codeSnippet, question{en}, options[4], answer, explanation{en}}`.
  `answer` is the exact text of one option. `codeSnippet` is `""` when there's no code.
- fill-in (`algo`): `{id, category, difficulty, codeSnippet (must contain ____), question{en}, answer, accept[], explanation{en}}`.
- `category`: use `"csharp"` in algo/bug/output; `"dotnet"` in all other banks.
- ids continue from the bank's current max id (+1, +2, ...).
- difficulty mix roughly 35% easy / 40% medium / 25% hard.
- Spread the answer position across the 4 options; keep options close in length
  (the answer must not be the obviously longest).

## Correctness (non-negotiable)
- .NET 10 SDK is installed: `D:\dotnet\dotnet.exe` (set env `DOTNET_CLI_HOME=D:\DevCache\dotnet-home`,
  `DOTNET_CLI_TELEMETRY_OPTOUT=1`). File-based apps work: write `x.cs` with top-level statements and run
  `D:/dotnet/dotnet.exe run x.cs` (first run ~40s, later ~5-10s). Scratch dir: `D:\gtltools\cs-scratch\<bank>\`.
  Never write anything to C:.
- EVERY output question and every bug fix / fill-in answer whose correctness depends on behaviour
  must be RUN and the printed output confirmed exactly. Note: `Console.WriteLine(double)` formatting,
  integer division, string interpolation culture, `bool` prints `True`/`False`.
- Knowledge questions: modern, current facts (.NET 8/9/10, C# 12-14, ASP.NET Core minimal APIs,
  EF Core, Unity for gamedev). No outdated .NET Framework-only trivia unless labelled as such.

## Before reporting
Run `node E:\prog-game2\scripts\check-new-bias.js v3450-<bank>.json` (from E:\prog-game2) and fix every
duplicate / exploitable it reports, until clean. Also make sure the file parses.

Report: counts per difficulty, answer-position spread, what you ran with dotnet, check-new-bias output.
