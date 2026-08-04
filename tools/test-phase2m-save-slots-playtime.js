#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');

const root = path.resolve(process.argv[2] || process.env.PRISMA_ROOT || path.join(__dirname, '..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const saveSlotsSource = read('save_slots.js');
const mainSource = read('main.js');
const titleSource = read('main.html');
const indexSource = read('index.html');
const configSource = read('menus_config.js');
const statusSource = read('menus_status.js');
const css = read('modern-polish.css');
const sw = read('sw.js');
const news = read('news.js');
const design = read('docs/DESIGN_TEN_SLOT_SAVE_AND_BACKUP_20260804.md');


function createFakeIndexedDB() {
    const databases = new Map();
    const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

    const makeRequest = (transaction, executor) => {
        const request = { result: undefined, error: null, onsuccess: null, onerror: null };
        transaction._pending += 1;
        setTimeout(() => {
            try {
                request.result = clone(executor());
                if (typeof request.onsuccess === 'function') request.onsuccess({ target: request });
            } catch (error) {
                request.error = error;
                transaction.error = error;
                if (typeof request.onerror === 'function') request.onerror({ target: request });
                if (typeof transaction.onerror === 'function') transaction.onerror({ target: transaction });
            } finally {
                transaction._pending -= 1;
                transaction._scheduleComplete();
            }
        }, 0);
        return request;
    };

    const createDatabaseHandle = state => ({
        objectStoreNames: { contains: name => state.stores.has(name) },
        createObjectStore(name, options = {}) {
            if (!state.stores.has(name)) state.stores.set(name, { keyPath: options.keyPath || null, records: new Map() });
            return {};
        },
        transaction(name) {
            const storeState = state.stores.get(name);
            if (!storeState) throw new Error(`Missing object store: ${name}`);
            const transaction = {
                error: null,
                oncomplete: null,
                onerror: null,
                onabort: null,
                _pending: 0,
                _completeScheduled: false,
                _scheduleComplete() {
                    if (this._pending !== 0 || this._completeScheduled) return;
                    this._completeScheduled = true;
                    setTimeout(() => {
                        this._completeScheduled = false;
                        if (this._pending === 0 && typeof this.oncomplete === 'function') this.oncomplete({ target: this });
                    }, 0);
                },
                objectStore() {
                    return {
                        get(key) { return makeRequest(transaction, () => storeState.records.get(key)); },
                        getAll() { return makeRequest(transaction, () => Array.from(storeState.records.values())); },
                        put(value) {
                            return makeRequest(transaction, () => {
                                const key = storeState.keyPath ? value[storeState.keyPath] : value.slotId;
                                storeState.records.set(key, clone(value));
                                return key;
                            });
                        },
                        delete(key) {
                            return makeRequest(transaction, () => storeState.records.delete(key));
                        }
                    };
                }
            };
            transaction._scheduleComplete();
            return transaction;
        },
        close() {},
        onversionchange: null
    });

    return {
        open(name, version) {
            const request = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
            setTimeout(() => {
                try {
                    let state = databases.get(name);
                    const isNew = !state;
                    if (!state) {
                        state = { version: version || 1, stores: new Map() };
                        databases.set(name, state);
                    }
                    request.result = createDatabaseHandle(state);
                    if (isNew && typeof request.onupgradeneeded === 'function') request.onupgradeneeded({ target: request });
                    if (typeof request.onsuccess === 'function') request.onsuccess({ target: request });
                } catch (error) {
                    request.error = error;
                    if (typeof request.onerror === 'function') request.onerror({ target: request });
                }
            }, 0);
            return request;
        }
    };
}

assert(titleSource.includes('id="btn-auto-continue"'), 'title direct auto-save button missing');
assert(titleSource.includes('id="btn-slot-continue"'), 'title ten-slot continue button missing');
assert(titleSource.includes('openTitleSaveSlots()'), 'title slot list route missing');
assert(titleSource.includes('現在のオートセーブは即時上書きされます'), 'new-game overwrite warning missing');
assert(titleSource.includes('バックアップ出力'), 'title auto backup output missing');
assert(titleSource.includes('バックアップ読込'), 'title backup import missing');
assert(titleSource.indexOf('save_slots.js') < titleSource.indexOf('main.js'), 'title must load save_slots.js before main.js');
assert(indexSource.indexOf('save_slots.js') < indexSource.indexOf('main.js'), 'game must load save_slots.js before main.js');

assert(configSource.includes("activeTab: 'settings'"), 'settings/save tab state missing');
assert(configSource.includes("MenuConfig.setTab('save')"), 'save tab button missing');
for (const label of ['セーブ', 'ロード', 'データ出力', 'データ読込', '一括ダウンロード']) {
    assert(configSource.includes(label), `settings save tab action missing: ${label}`);
}
assert(configSource.includes("SaveSlotUI.open(mode === 'save' ? 'save' : 'load'"), 'game save-slot UI route missing');

assert(saveSlotsSource.includes("DB_NAME = 'PRISMA_ABYSS_SAVE_SLOTS'"), 'IndexedDB database name missing');
assert(saveSlotsSource.includes('MANUAL_SLOT_MAX = 9'), 'manual slot range missing');
assert(saveSlotsSource.includes('loadManualIntoAuto'), 'manual-to-auto load route missing');
assert(saveSlotsSource.includes('previousPayload'), 'auto-slot rollback snapshot missing');
assert(saveSlotsSource.includes('previousRecord'), 'manual-slot rollback snapshot missing');
assert(saveSlotsSource.includes('rollbackTx'), 'manual-slot rollback transaction missing');
assert(saveSlotsSource.includes('inspectManualRecord'), 'slot-list integrity inspection missing');
assert(saveSlotsSource.includes('verifyChecksum'), 'manual save checksum verification missing');
assert(!saveSlotsSource.includes('オートセーブ 1枠 / 手動セーブ 9枠'), 'redundant slot-count subtitle remains');
assert(!saveSlotsSource.includes('オートセーブは既存機能で自動更新されます'), 'redundant auto-save guidance remains');
assert(!saveSlotsSource.includes('手動セーブを読み込むと、現在のオートセーブは選択した内容で即時上書きされます'), 'redundant load guidance remains');
assert(saveSlotsSource.includes('save-slot-party-faces'), 'four-party face layout missing');
assert(saveSlotsSource.includes('save-slot-playtime'), 'slot play-time field missing');

assert(mainSource.includes('playTimeRuntime'), 'runtime play-time state missing');
assert(mainSource.includes('startPlayTimeTracking'), 'play-time start function missing');
assert(mainSource.includes("document.addEventListener('visibilitychange'"), 'background pause handling missing');
assert(mainSource.includes('App.commitPlayTime({ keepRunning: true });'), 'play time is not committed by existing auto-save');
assert(mainSource.includes('App.updateSaveMetadata();'), 'auto-save metadata update missing');
assert(mainSource.includes('App.startPlayTimeTracking();'), 'game startup does not start play-time tracking');
assert(mainSource.includes('App.ensurePlayTimeData(data);'), 'old-save play-time migration missing');
assert(mainSource.includes('手動セーブNo.1～9は変更されません'), 'backup import manual-slot preservation warning missing');
assert(statusSource.includes('data-play-time'), 'adventure record play-time display missing');

assert(/\.save-slot-card\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/.test(css), 'save-slot left/right layout missing');
assert(/\.save-slot-info\s*\{[\s\S]*?grid-template-rows:\s*repeat\(3,/.test(css), 'save-slot three-line left layout missing');
assert(/\.save-slot-party-faces\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,/.test(css), 'four horizontal party faces missing');
assert(/\.save-slot-list\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/.test(css), 'slot list scroll contract missing');
assert(css.includes('env(safe-area-inset-top'), 'slot UI safe-area support missing');

assert(/const CACHE_NAME = \"prisma-abyss-v(?:4[3-9]|[5-9]\d|\d{3,})\.20260804\";/.test(sw), 'service worker cache version is older than Phase2M');
assert(sw.includes('"save_slots.js"'), 'save_slots.js is not app-shell cached');
assert(news.includes('オート1枠と手動9枠のセーブ機能を追加しました'), 'same-day ten-slot news entry missing');
assert(news.includes('プレイ時間表示とデータ管理画面を整理しました'), 'same-day play-time news entry missing');
assert((news.match(/date:\s*["']2026\/08\/04["']/g) || []).length === 1, 'same-day news record duplicated');

assert(design.includes('バックアップ出力は現在のオート枠だけ'), 'approved auto-only backup scope missing');
assert(design.includes('10枠一括バックアップは実装しない'), 'all-slot backup exclusion missing');
assert(design.includes('9999:59:59'), 'play-time display cap missing');
assert(design.includes('旧セーブの経過時間を `startTime` から推測しない'), 'legacy play-time migration policy missing');

const storageMap = new Map();
let failNextStorageWrite = false;
const localStorage = {
    getItem(key) { return storageMap.has(key) ? storageMap.get(key) : null; },
    setItem(key, value) {
        if (failNextStorageWrite) { failNextStorageWrite = false; throw new Error('forced localStorage failure'); }
        storageMap.set(key, String(value));
    },
    removeItem(key) { storageMap.delete(key); }
};
const context = {
    console,
    indexedDB: createFakeIndexedDB(),
    crypto: webcrypto,
    TextEncoder,
    Blob,
    localStorage,
    setTimeout,
    clearTimeout,
    location: { href: '' }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`
const CONST = { SAVE_KEY: 'test-auto' };
const App = {
    data: null,
    isImportableSaveData(data) { return !!(data && Array.isArray(data.party) && Array.isArray(data.characters)); },
    migrateImportedSaveData(data) {
        data.system = data.system || {};
        data.stats = data.stats || {};
        if (typeof data.stats.playTimeMs !== 'number') data.stats.playTimeMs = 0;
        return data;
    },
    serializeSaveData(data) { return JSON.stringify(data); }
};
${saveSlotsSource}
`, context, { filename: 'save_slots.js' });

const SaveSlots = context.SaveSlots;
assert.strictEqual(SaveSlots.formatPlayTime(0), '0000:00:00');
assert.strictEqual(SaveSlots.formatPlayTime(3723000), '0001:02:03');
assert.strictEqual(SaveSlots.formatPlayTime(3723470), '0001:02:03', 'milliseconds must be truncated from display');
assert.strictEqual(SaveSlots.formatPlayTime(Number.MAX_SAFE_INTEGER), '9999:59:59');

const sample = {
    party: ['hero', 'ally', null, null],
    characters: [
        { uid: 'hero', charId: 301, name: 'アルス', level: 12 },
        { uid: 'ally', charId: 110, name: 'サラ', level: 11 }
    ],
    location: { area: 'START_VILLAGE' },
    progress: { storyStep: 2, floor: 0 },
    dungeon: { maxFloor: 9 },
    stats: { playTimeMs: 3723000 },
    system: {}
};
const metadata = SaveSlots.buildMetadata(sample, { updatedAt: '2026-08-04T00:00:00.000Z' });
assert.strictEqual(metadata.heroName, 'アルス');
assert.strictEqual(metadata.heroLevel, 12);
assert.strictEqual(metadata.locationLabel, '始まりの村');
assert.strictEqual(metadata.playTimeMs, 3723000);
assert.strictEqual(SaveSlots.getPartyCharacters(sample).length, 4);
assert.strictEqual(SaveSlots.getCharacterFaceSource(sample.characters[0]), 'assets/characters/face/301.png');
assert.strictEqual(SaveSlots.getCharacterFaceSource({ isMonsterAlly: true, charId: 900000105, img: 'assets/monsters/monster_000105.png' }), 'assets/monsters/monster_000105.png');

(async () => {
    const checksum = await SaveSlots.computeChecksum(JSON.stringify(sample));
    assert(await SaveSlots.verifyChecksum(JSON.stringify(sample), checksum), 'checksum round trip failed');
    assert(!(await SaveSlots.verifyChecksum(JSON.stringify({ ...sample, gold: 1 }), checksum)), 'checksum did not detect modification');

    storageMap.set('test-auto', JSON.stringify({ ...sample, gold: 10 }));
    const written = SaveSlots.writeDataToAutoSlot({ ...sample, gold: 20 });
    assert.strictEqual(JSON.parse(storageMap.get('test-auto')).gold, 20, 'manual/import data not written to auto slot');
    assert(written.data.system.lastSavedAt, 'auto write timestamp missing');
    assert(written.data.system.saveMetadata, 'auto write metadata missing');

    const autoBeforeFailure = storageMap.get('test-auto');
    failNextStorageWrite = true;
    assert.throws(() => SaveSlots.writeDataToAutoSlot({ ...sample, gold: 30 }), /forced localStorage failure/);
    assert.strictEqual(storageMap.get('test-auto'), autoBeforeFailure, 'auto-slot rollback did not preserve the previous payload');

    await SaveSlots.saveManualSlot(1, { ...sample, gold: 100 });
    await SaveSlots.saveManualSlot(9, { ...sample, gold: 900 });
    const storedOne = await SaveSlots.getSlotData(1);
    assert.strictEqual(storedOne.data.gold, 100, 'manual slot round trip failed');
    assert.strictEqual((await SaveSlots.listManualSlots()).size, 2, 'manual slot list failed');

    storageMap.set('test-auto', JSON.stringify({ ...sample, gold: 1 }));
    await SaveSlots.loadManualIntoAuto(9);
    assert.strictEqual(JSON.parse(storageMap.get('test-auto')).gold, 900, 'manual slot was not copied into auto slot');

    const originalVerifyChecksum = SaveSlots.verifyChecksum;
    let forcedVerificationFailure = true;
    SaveSlots.verifyChecksum = async (payload, value) => {
        if (forcedVerificationFailure && String(payload).includes('\"gold\":200')) {
            forcedVerificationFailure = false;
            return false;
        }
        return originalVerifyChecksum(payload, value);
    };
    await assert.rejects(
        () => SaveSlots.saveManualSlot(1, { ...sample, gold: 200 }),
        /保存確認に失敗/,
        'manual overwrite verification failure was not propagated'
    );
    SaveSlots.verifyChecksum = originalVerifyChecksum;
    assert.strictEqual((await SaveSlots.getSlotData(1)).data.gold, 100, 'manual overwrite rollback did not restore the previous slot');

    const recordToCorrupt = await SaveSlots.getManualSlot(1);
    recordToCorrupt.payload = recordToCorrupt.payload.replace('\"gold\":100', '\"gold\":101');
    const db = await SaveSlots.openDatabase();
    const corruptTx = db.transaction(SaveSlots.STORE_NAME, 'readwrite');
    const corruptDone = SaveSlots.transactionDone(corruptTx);
    corruptTx.objectStore(SaveSlots.STORE_NAME).put(recordToCorrupt);
    await corruptDone;
    const inspected = await SaveSlots.listAllSlots();
    assert.strictEqual(inspected.find(slot => slot.slotId === 1).corrupt, true, 'manual slot corruption was not detected before selection');

    console.log('[Phase2M] save slots and play time checks: PASS');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
