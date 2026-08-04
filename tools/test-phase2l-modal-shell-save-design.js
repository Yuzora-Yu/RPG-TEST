#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const index = read('index.html');
const menu = read('menus.js');
const skill = read('menus_skill_detail.js');
const trait = read('menus_trait_detail.js');
const book = read('menus_book.js');
const css = read('modern-polish.css');
const news = read('news.js');
const sw = read('sw.js');
const design = read('docs/DESIGN_TEN_SLOT_SAVE_AND_BACKUP_20260804.md');

assert(index.includes('id="menu-dialog-area" class="menu-dialog-overlay"'), 'generic dialog overlay class missing');
assert(index.includes('class="menu-dialog-shell"'), 'generic dialog shell missing');
assert(index.includes('class="menu-dialog-body"'), 'generic dialog scroll body missing');
assert(index.includes('class="menu-dialog-footer"'), 'generic dialog fixed footer missing');

assert(menu.includes('ensureModalOverlay'), 'shared modal mount helper missing');
assert(menu.includes("document.getElementById('game-container') || document.body"), 'shared modal host is not game-container first');
assert(menu.includes('resetDialogLayout'), 'generic dialog reset helper missing');

for (const [name, source] of [['skill', skill], ['trait', trait], ['book trait', book]]) {
    assert(source.includes('game-modal-dialog'), `${name} modal does not use shared dialog shell`);
    assert(source.includes('game-modal-body'), `${name} modal does not have scroll body`);
    assert(source.includes('game-modal-footer'), `${name} modal does not have fixed footer`);
}
assert(!skill.includes('position:fixed; top:0; left:0; width:100%; height:100%'), 'skill modal still uses unbounded fixed inline layout');

assert(/\.game-modal-body[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/.test(css), 'shared modal body scrolling contract missing');
assert(/\.game-modal-footer[\s\S]*?flex:\s*0 0 auto;/.test(css), 'shared modal footer fixed contract missing');
assert(/\.menu-dialog-shell[\s\S]*?max-height:\s*100%;/.test(css), 'generic dialog height bound missing');

assert(design.includes('オートセーブ1枠'), 'save design does not define auto slot');
assert(design.includes('手動セーブ9枠'), 'save design does not define nine manual slots');
assert(design.includes('既存のデータ出力・データ読込'), 'existing backup/restore retention missing');
assert(design.includes('ユーザー承認済み'), 'save design approval status missing');
assert(design.includes('App.save()` 呼出: 235箇所'), 'save call-site audit result missing');

assert(news.includes('スキル・特性・確認画面の長文表示を修正しました'), 'same-day news entry missing');
assert(/const CACHE_NAME = "prisma-abyss-v(?:4[2-9]|[5-9]\d|\d{3,})\.20260804";/.test(sw), 'service worker cache was not advanced');

console.log('Phase2L modal shell and save design checks passed.');
