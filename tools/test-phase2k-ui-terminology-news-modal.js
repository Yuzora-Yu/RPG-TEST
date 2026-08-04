#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(process.argv[2] || process.env.PRISMA_ROOT || path.join(__dirname, '..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const playerFacingFiles = [
  'achievements.js',
  'guild.js',
  'guild_quests.js',
  'menus_status.js',
  'facilities.js',
  'tutorial.js',
  'news.js'
];

for (const rel of playerFacingFiles) {
  const source = read(rel);
  assert(!source.includes('ランダム深淵'), `${rel} に旧表示名「ランダム深淵」が残っています。`);
  assert(!source.includes('ランダムアビス'), `${rel} に旧表示名「ランダムアビス」が残っています。`);
}

const dungeon = read('dungeon.js');
const abyss = read('abyss_content.js');
const news = read('news.js');
const modalSource = read('menus_news_detail.js');
const css = read('modern-polish.css');
const sw = read('sw.js');

assert(dungeon.includes("renderMode('random', '深淵の亀裂'"), '深淵メニューの正式表示名が「深淵の亀裂」ではありません。');
assert(dungeon.includes("title:selected.title || '異変の階層'"), '異変階層の既定表示名が不正です。');
assert(!dungeon.includes("title:selected.title || '特殊階層'"), '異変階層に旧表示名が残っています。');
assert(abyss.includes("message:'強大な気配と、宝の輝きが入り混じっている……'"), '強敵の財宝階が世界観文言になっていません。');
assert(abyss.includes("message:'希少な魔物の気配が濃い……'"), '希少種の気配が世界観文言になっていません。');
assert(abyss.includes("message:'過去の戦いの残響が、この階層を満たしている……'"), '物語の残響が世界観文言になっていません。');
assert(!news.includes('ランダムダンジョン'), 'news.js に旧表示名「ランダムダンジョン」が残っています。');
assert(!news.includes('ランダム迷宮'), 'news.js に旧表示名「ランダム迷宮」が残っています。');
assert(news.includes('戦闘勝利時に敵が復活する不具合を修正しました'), 'Phase2Jの更新履歴が欠落しています。');
assert((news.match(/date:\s*["']2026\/08\/04["']/g) || []).length === 1, '2026/08/04のNEWS_DATAレコードが複数あります。');

assert(modalSource.includes("document.getElementById('game-container') || document.body"), 'お知らせモーダルがゲーム画面を親要素にしていません。');
assert(modalSource.includes('class="news-detail-body"'), 'お知らせ本文の専用スクロール領域がありません。');
assert(modalSource.includes('class="news-detail-footer"'), 'お知らせ操作部の固定領域がありません。');
assert(modalSource.includes('MenuNewsDetail.escapeHtml'), 'お知らせ本文のHTMLエスケープがありません。');
assert(!modalSource.includes('position:fixed'), 'お知らせモーダルがブラウザ画面全体へ固定されています。');

assert(/#news-detail-modal\s*\{[\s\S]*?position:\s*absolute;/m.test(css), 'お知らせモーダルが#game-container内の絶対配置になっていません。');
const dialogCss = css.match(/\.news-detail-dialog\s*\{([\s\S]*?)\n\}/m)?.[1] || '';
assert(dialogCss.includes('display: flex;') && dialogCss.includes('flex-direction: column;') && dialogCss.includes('min-height: 0;') && dialogCss.includes('overflow: hidden;'), 'お知らせダイアログの固定外枠構造が不完全です。');
assert(/\.news-detail-body\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/m.test(css), 'お知らせ本文だけを縦スクロールする設定がありません。');
assert(/\.news-detail-footer\s*\{[\s\S]*?flex:\s*0 0 auto;/m.test(css), 'お知らせ操作部が固定領域になっていません。');
assert(css.includes('env(safe-area-inset-top'), 'セーフエリア上端への配慮がありません。');
assert(css.includes('overflow-wrap: anywhere'), '長い英数字の折返し設定がありません。');
assert(/const CACHE_NAME = "prisma-abyss-v(?:4[1-9]|[5-9]\d|\d{3,})\.20260804";/.test(sw), 'App ShellキャッシュがPhase2K以降へ更新されていません。');

function createElement(tagName, registry) {
  return {
    tagName: String(tagName || '').toUpperCase(),
    id: '',
    className: '',
    parentNode: null,
    innerHTML: '',
    attributes: {},
    scrollTop: 0,
    setAttribute(name, value) { this.attributes[name] = String(value); },
    appendChild(child) {
      child.parentNode = this;
      if (child.id) registry.set(child.id, child);
      return child;
    },
    remove() {
      if (this.id) registry.delete(this.id);
      this.parentNode = null;
    },
    querySelector(selector) {
      if (selector === '.news-detail-body') return { scrollTop: 99 };
      return null;
    }
  };
}

const registry = new Map();
const gameContainer = createElement('div', registry);
gameContainer.id = 'game-container';
registry.set(gameContainer.id, gameContainer);
const body = createElement('body', registry);
const document = {
  body,
  getElementById(id) { return registry.get(id) || null; },
  createElement(tagName) { return createElement(tagName, registry); }
};
const context = { document, window:{}, console, Number, String, Array, Object };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${modalSource}\nglobalThis.MenuNewsDetail = MenuNewsDetail;`, context, { filename:'menus_news_detail.js' });
context.MenuNewsDetail.open(1, [{ id:1, date:'2026/08/04', title:'長文<確認>', body:'本文<&>\n'.repeat(120) }]);
const modal = registry.get('news-detail-modal');
assert(modal, 'お知らせモーダルを生成できません。');
assert(modal.parentNode === gameContainer, 'お知らせモーダルが#game-container外へ生成されました。');
assert(modal.innerHTML.includes('長文&lt;確認&gt;'), 'お知らせタイトルが安全にエスケープされていません。');
assert(modal.innerHTML.includes('本文&lt;&amp;&gt;'), 'お知らせ本文が安全にエスケープされていません。');
assert(modal.innerHTML.includes('news-detail-header') && modal.innerHTML.includes('news-detail-footer'), 'ヘッダー・本文・フッター構造を生成できません。');
context.MenuNewsDetail.close();
assert(!registry.has('news-detail-modal'), 'お知らせモーダルを閉じられません。');

console.log('[Phase2K] UI terminology and news modal tests: PASS');
