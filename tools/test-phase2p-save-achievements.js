#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(process.argv[2] || process.env.PRISMA_ROOT || path.join(__dirname, '..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const configSource = read('menus_config.js');
const saveSlotsSource = read('save_slots.js');
const css = read('modern-polish.css');
const achievementsSource = read('achievements.js');
const achievementsMenuSource = read('menus_achievements.js');
const agentsSource = read('AGENTS.md');
const policySource = read('docs/development-policy.md');
const newsSource = read('news.js');
const swSource = read('sw.js');

// Phase2P: settings save tab cleanup.
assert(!configSource.includes('config-save-guide-title">セーブデータ管理'), 'developer save-management guide still appears');
assert(!configSource.includes('手動セーブNo.1～9へ保存</span>'), 'save button explanation was not removed');
assert(!configSource.includes('オート／手動セーブから再開</span>'), 'load button explanation was not removed');
assert(configSource.includes('現在のオートセーブをバックアップ</span>'), 'data-output explanation should remain');
assert(configSource.includes('バックアップをオートセーブへ復元</span>'), 'data-import explanation should remain');
assert(configSource.includes('ゲーム画像などの全データを端末へ保存</span>'), 'bulk-download explanation should remain');

// Phase2P: slot-local prompt must sit above the slot overlay and be awaited.
assert(saveSlotsSource.includes("layer.className = 'save-slot-prompt-layer'"), 'slot-local prompt layer missing');
assert(saveSlotsSource.includes('SaveSlotUI.overlay.appendChild(layer)'), 'prompt is not mounted inside the save overlay');
assert(!saveSlotsSource.includes('if (app?.showConfirm) return app.showConfirm(message);'), 'save UI still delegates confirmation behind the overlay');
assert(saveSlotsSource.includes('await SaveSlotUI.showMessage(`セーブNo.${slotId}へ保存しました。`)'), 'save completion message is not awaited');
assert(/\.save-slot-prompt-layer\s*\{[\s\S]*?z-index:\s*2;/.test(css), 'save prompt z-index contract missing');
assert(/\.save-slot-area\s*\{[\s\S]*?flex:\s*1 1 auto;/.test(css), 'area label does not retain available width');
const playTimeCss = (css.match(/\.save-slot-playtime\s*\{[^}]*\}/) || [''])[0];
assert(/min-width:\s*10ch;/.test(playTimeCss) && /white-space:\s*nowrap;/.test(playTimeCss), 'play time field does not reserve the full hhhh:mm:ss width');
assert(!/overflow:\s*hidden;/.test(playTimeCss), 'play time can still be clipped at the right edge');

// Phase2Q: master data and reward migration.
const context = {
    console,
    window: null,
    globalThis: null,
    ITEMS_DATA: [
        { id: 599998, name: '神鉄の鍛冶台' }
    ],
    EQUIP_MASTER: [],
    App: {
        data: {
            blacksmith: { level: 10 },
            achievements: {
                // Phase2P以前に旧報酬を受取済み。rewardVersionは未導入。
                '503': { completed: true, claimed: true, progress: 10 }
            },
            items: {},
            inventory: [],
            characters: [{ uid: 'p1', level: 1, equips: {} }],
            party: ['p1'],
            stats: {},
            dungeon: {},
            progress: { flags: {}, storyStep: 0 },
            book: { monsters: [], killCounts: {} },
            gold: 0,
            gems: 0
        },
        save() { return true; },
        runAtomicSaveMutation(mutator) {
            const snapshot = JSON.stringify(this.data);
            try {
                const result = mutator();
                if (result?.ok === false || this.save() === false) {
                    this.data = JSON.parse(snapshot);
                    return { ok: false };
                }
                return { ok: true, result };
            } catch (error) {
                this.data = JSON.parse(snapshot);
                return { ok: false, error };
            }
        }
    }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(achievementsSource, context, { filename: 'achievements.js' });

const data = context.ACHIEVEMENTS_DATA;
const manager = context.AchievementManager;
const smith10 = data.find(a => a.id === 503);
assert(smith10, 'smith level 10 achievement missing');
assert.strictEqual(smith10.rewardVersion, 2, 'smith reward version missing');
assert.deepStrictEqual(JSON.parse(JSON.stringify(smith10.rewards)), [{ type: 'ITEM', id: 599998, val: 1 }], 'smith reward was not replaced with Divine Anvil');

manager.normalize();
let oldSmithState = context.App.data.achievements['503'];
assert.strictEqual(oldSmithState.claimedRewardVersion, 1, 'legacy claimed reward should migrate to version 1');
assert.strictEqual(oldSmithState.claimed, false, 'legacy claimant should be able to claim reward version 2 once');

const claim = manager.claim(503);
assert.strictEqual(claim.ok, true, 'legacy smith reward re-claim failed');
assert.strictEqual(context.App.data.items[599998], 1, 'Divine Anvil was not granted');
oldSmithState = context.App.data.achievements['503'];
assert.strictEqual(oldSmithState.claimedRewardVersion, 2, 'current reward version was not recorded');
assert.strictEqual(oldSmithState.claimed, true, 'current reward was not marked claimed');
assert.strictEqual(manager.claim(503).ok, false, 'Divine Anvil reward could be claimed more than once');
assert.strictEqual(context.App.data.items[599998], 1, 'duplicate Divine Anvil was granted');
assert.strictEqual(manager.getRewardText(smith10.rewards), '神鉄の鍛冶台 x1', 'reward display text is incorrect');

// 保存失敗時は、神鉄付与と報酬version更新を同時に取り消す。
context.App.data.achievements['503'] = { completed: true, claimed: false, claimedRewardVersion: 1, progress: 10 };
context.App.data.items = {};
context.App.save = () => false;
const failedClaim = manager.claim(503);
assert.strictEqual(failedClaim.ok, false, 'save failure should reject the achievement claim');
assert.strictEqual(Number(context.App.data.items[599998] || 0), 0, 'Divine Anvil remained after save failure');
assert.strictEqual(context.App.data.achievements['503'].claimedRewardVersion, 1, 'reward version advanced after save failure');
assert.strictEqual(context.App.data.achievements['503'].claimed, false, 'reward was marked claimed after save failure');
context.App.save = () => true;

const hiddenStory = data.find(a => a.id === 402);
const hiddenBoss = data.find(a => a.id === 2201);
assert.strictEqual(hiddenStory.secret, true, 'story spoiler achievement is not secret');
assert.strictEqual(hiddenBoss.secret, true, 'last-boss achievement is not secret');
manager.normalize();
assert.strictEqual(manager.isVisible(hiddenStory), false, 'incomplete secret achievement is visible');
context.App.data.achievements['402'].completed = true;
assert.strictEqual(manager.isVisible(hiddenStory), true, 'completed secret achievement did not become visible');
assert(achievementsMenuSource.includes('allData.filter(a => AchievementManager.isVisible(a))'), 'achievement menu does not filter secret entries before counts/categories');

assert(agentsSource.includes('tutorial-impact review'), 'shared agent policy lacks tutorial impact review');
assert(policySource.includes('## Tutorial Impact Review'), 'development policy lacks tutorial impact review');
assert(newsSource.includes('セーブ・ロード画面の操作と表示を修正しました'), 'Phase2P news missing');
assert(newsSource.includes('秘密の実績と鍛冶レベル10報酬を追加しました'), 'Phase2Q news missing');
assert((newsSource.match(/date:\s*["']2026\/08\/04["']/g) || []).length === 1, 'same-day news entry duplicated');
assert(/const CACHE_NAME = "prisma-abyss-v(?:46|4[7-9]|[5-9]\d|\d{3,})\.20260804";/.test(swSource), 'service worker cache was not advanced');

console.log('[Phase2P/Q] save UI, secret achievements and reward migration checks: PASS');
