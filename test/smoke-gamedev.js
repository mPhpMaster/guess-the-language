const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'data', 'questions-gamedev.json');
if (!fs.existsSync(filePath)) {
  console.error('Missing gamedev question bank:', filePath);
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
if (!Array.isArray(questions) || questions.length < 8) {
  console.error('Gamedev question bank should contain at least 8 questions');
  process.exit(1);
}

const invalid = questions.find((q) => !q.id || !q.question || !q.options || !q.answer || !q.explanation);
if (invalid) {
  console.error('Invalid question entry:', invalid.id || 'unknown');
  process.exit(1);
}

console.log(`Gamedev bank loaded with ${questions.length} questions`);
