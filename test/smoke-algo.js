const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'data', 'questions-algo.json');
if (!fs.existsSync(filePath)) {
  console.error('Missing problem-solving question bank:', filePath);
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
if (!Array.isArray(questions) || questions.length < 8) {
  console.error('Problem-solving bank should contain at least 8 questions');
  process.exit(1);
}

const invalid = questions.find(
  (q) => !q.id || !q.question || !q.question.en || !q.question.ar ||
    !Array.isArray(q.options) || q.options.length < 2 || !q.answer ||
    !q.options.includes(q.answer) || !q.explanation || !q.explanation.en || !q.explanation.ar
);
if (invalid) {
  console.error('Invalid question entry:', invalid.id || 'unknown');
  process.exit(1);
}

const ids = questions.map((q) => q.id);
if (new Set(ids).size !== ids.length) {
  console.error('Duplicate ids in problem-solving bank');
  process.exit(1);
}

console.log(`Problem-solving bank loaded with ${questions.length} questions`);
