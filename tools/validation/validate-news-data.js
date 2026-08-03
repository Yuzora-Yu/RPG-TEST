#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'news.js'), 'utf8');
const context = { console, globalThis:null };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.__NEWS_DATA = NEWS_DATA;`, context, { filename:'news.js' });
const rows = context.__NEWS_DATA;
assert(Array.isArray(rows) && rows.length > 0, 'NEWS_DATA must be a non-empty array.');

const ids = new Set();
const dates = new Set();
for (const row of rows) {
  assert(Number.isInteger(Number(row.id)), `Invalid news id: ${row.id}`);
  assert(!ids.has(Number(row.id)), `Duplicate news id: ${row.id}`);
  ids.add(Number(row.id));
  assert(/^\d{4}\/\d{2}\/\d{2}$/.test(String(row.date)), `Invalid news date: ${row.date}`);
  assert(!dates.has(row.date), `Multiple NEWS_DATA records exist for ${row.date}; merge same-day changes.`);
  dates.add(row.date);
  assert(String(row.title || '').trim(), `Missing news title for ${row.date}`);
  assert(String(row.body || '').trim(), `Missing news body for ${row.date}`);
}

console.log(`PASS: news data policy (${rows.length} dates)`);
