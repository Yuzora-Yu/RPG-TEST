#!/usr/bin/env node
/**
 * check-dialogue-lines.mjs
 *
 * Simple long-line checker for PRISMA ABYSS dialogue data.
 *
 * Usage:
 *   node tools/check-dialogue-lines.mjs story.js
 *   node tools/check-dialogue-lines.mjs story.js 30
 *
 * This is intentionally conservative. It scans quoted string values that look
 * like text fields and reports each \n-separated line whose approximate length
 * exceeds the limit.
 */

import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2] || 'story.js';
const limit = Number(process.argv[3] || 30);

if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const source = fs.readFileSync(file, 'utf8');
const rel = path.relative(process.cwd(), file) || file;

// Matches patterns like "text": "..." and 'text': '...'.
// It is not a full JavaScript parser, but works for ordinary generated story data.
const textFieldPattern = /["']text["']\s*:\s*(["'`])([\s\S]*?)(?<!\\)\1/g;
const results = [];

function unescapeBasic(str) {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\`/g, '`');
}

function visibleLength(line) {
  // Remove common inline control tags such as [N:301] before counting.
  const normalized = line.replace(/\[[A-Z]+:[^\]]+\]/g, '');
  return Array.from(normalized).length;
}

let match;
while ((match = textFieldPattern.exec(source)) !== null) {
  const raw = match[2];
  const startIndex = match.index;
  const lineNumber = source.slice(0, startIndex).split('\n').length;
  const text = unescapeBasic(raw);
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const length = visibleLength(line);
    if (length > limit) {
      results.push({
        file: rel,
        lineNumber,
        textLine: i + 1,
        length,
        line
      });
    }
  });
}

if (results.length === 0) {
  console.log(`OK: no dialogue text lines over ${limit} chars in ${rel}.`);
  process.exit(0);
}

console.log(`Found ${results.length} dialogue text line(s) over ${limit} chars in ${rel}.`);
console.log('');

for (const r of results) {
  console.log(`${r.file}:${r.lineNumber} text-line ${r.textLine} length=${r.length}`);
  console.log(`  ${r.line}`);
}

process.exit(2);
