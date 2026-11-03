#!/usr/bin/env node
'use strict';
/*
 * Assemble a Learn course from its staged level files.
 *   node scripts/build-course.js fastapi
 *
 * Levels are written one file each (scripts/new/learn-<course>-<n>.json, so they
 * can be authored in parallel) and joined here, in number order, into
 * src/data/courses/<course>.json — the one file the game loads. Course-level
 * metadata lives below. Run test/smoke-courses.js afterwards.
 */
const fs = require('fs');
const path = require('path');

const COURSES = {
  fastapi: {
    id: 'fastapi',
    title: { en: 'Build an API with FastAPI', ar: 'ابنِ API باستخدام FastAPI' },
    summary: {
      en: 'From what a request is, to a secure API with a database — deployed to production.',
      ar: 'من معنى الطلب، إلى API آمن بقاعدة بيانات — منشور على الإنتاج.'
    }
  }
};

const id = process.argv[2];
const meta = COURSES[id];
if (!meta) { console.error(`usage: build-course.js <${Object.keys(COURSES).join('|')}>`); process.exit(1); }

const dir = path.join(__dirname, 'new');
const files = fs.readdirSync(dir)
  .map((f) => ({ f, m: f.match(new RegExp(`^learn-${id}-(\\d+)\\.json$`)) }))
  .filter((x) => x.m)
  .sort((a, b) => Number(a.m[1]) - Number(b.m[1]));
if (!files.length) { console.error('no level files found'); process.exit(1); }

const levels = files.map(({ f }) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const course = { ...meta, levels };
const out = path.join(__dirname, '..', 'src', 'data', 'courses', `${id}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(course, null, 1) + '\n');
console.log(`${out}: ${levels.length} levels, ${levels.reduce((n, l) => n + l.lessons.length, 0)} lessons, ${levels.reduce((n, l) => n + l.quiz.length, 0)} questions`);
