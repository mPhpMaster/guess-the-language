# Archived question scripts — do not run

These are historical one-off batches, kept only so the provenance of the question
banks stays readable. **Every one of them is unsafe to run today.** They sat in
`scripts/` next to the live tooling until v3.14.1, which is an easy mistake to make
at a glance.

Two independent reasons:

**They overwrite or re-add.** `build-cyber-questions.js`, `build-devops-questions.js`
and `build-network-questions.js` are regenerators, not appenders: each ends in
`writeFileSync(bank, ...)` over the whole file, assigning ids by array index. Running
`build-cyber-questions.js` today would replace 180 questions with the ~79 baked into
it. The `add-*.js` scripts carry their batch hardcoded inline; those batches were
merged years of releases ago, so re-running them duplicates content or clobbers a
bank the same way.

**They still require Arabic.** Most check for `question.ar` / `explanation.ar` and
reject anything without it. Arabic was removed from every bank in v3.13.3–v3.13.4, so
these would reject all 1,605 current questions and every new one.

## What to use instead

- **Add questions** — `node scripts/append-questions.js <bankFile> <newFile>`, with the
  new questions staged under `scripts/new/` carrying their own ids. It appends and
  guards id collisions; it never rewrites what is already there.
- **Check the banks** — `node scripts/validate-questions.js --strict`. Schema, duplicate
  content across all eight banks, and the answer-length-bias guard. It runs as the first
  step of `pnpm run build:web`.
- **Rebalance distractors** — `node scripts/apply-rebalance.js <bankFile> <mapFile>`.
