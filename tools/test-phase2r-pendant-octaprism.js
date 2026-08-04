#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(process.argv[2] || process.env.PRISMA_ROOT || path.join(__dirname, '..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const itemsSource = read('items.js');
const databaseSource = read('database.js');
const abyssSource = read('abyss_content.js');
const mainSource = read('main.js');
const storySource = read('story.js');
const storyLogicSource = read('story_logic.js');
const saveSlotsSource = read('save_slots.js');
const statusSource = read('menus_status.js');
const css = read('modern-polish.css');

const extract = (source, startToken, endToken) => {
    const start = source.indexOf(startToken);
    assert(start >= 0, `missing source token: ${startToken}`);
    const end = source.indexOf(endToken, start);
    assert(end >= 0, `missing end token: ${endToken}`);
    return source.slice(start, end).trim().replace(/,$/, '');
};

// Formal item and master records.
for (const [id, name] of [[701009, '焼け焦げたペンダント'], [701010, '光結晶のペンダント']]) {
    assert(itemsSource.includes(`"id": ${id}`), `item ${id} is missing`);
    assert(itemsSource.includes(`"name": "${name}"`), `${name} master record is missing`);
}
assert(databaseSource.includes('items: { 1: 5, 701009: 1 }'), 'new game does not start with the charred pendant');
assert(mainSource.includes('items: { "1": 3, "701009": 1 }'), 'fallback initial data does not include the charred pendant');
assert(abyssSource.includes('charredPendantItemId: 701009'), 'charred pendant ID is not exported by the formal content master');
assert(abyssSource.includes('lightCrystalPendantItemId: 701010'), 'crystal pendant ID is not exported by the formal content master');
assert(abyssSource.includes('701008,701009,701010'), 'pendant IDs are not included in the formal content item list');

// The grant event must use one atomic action rather than a separate ITEM mutation.
const grantEventStart = storySource.indexOf('data.events.abyss_spirit_trials_octaprism_grant');
assert(grantEventStart >= 0, 'Octaprism grant event is missing');
const grantEventEnd = storySource.indexOf('winActions:[]', grantEventStart);
const grantEventSource = storySource.slice(grantEventStart, grantEventEnd);
assert(grantEventSource.includes("{type:'ABYSS_SPIRIT_TRIAL_GRANT_OCTAPRISM'}"), 'atomic pendant grant action is missing');
assert(!grantEventSource.includes("type:'ITEM'"), 'Octaprism is still granted by a separate non-atomic ITEM action');
assert(storyLogicSource.includes('App.grantOctaprismFromPendant()'), 'story action is not connected to the atomic App operation');
assert(storySource.includes("{name:'リュシオン',text:'……ようやく、届きました。'}"), 'approved Lycion dialogue is not implemented');
assert(storySource.includes('六つの結晶片が一斉に震え、胸元の焼け焦げたペンダントが熱を帯びた。'), 'pendant resonance opening is missing');
assert(storySource.includes('光結晶のペンダントと、オクタプリズマを手に入れた！'), 'pendant transformation acquisition message is missing');
assert(!storySource.includes('六つの加護が呼応し、色の異なる光が一つの輪を描いた。'), 'legacy all-complete dialogue remains');
assert(storyLogicSource.includes('throw new Error'), 'failed pendant save does not suspend the story event');

// Execute the exact migration and grant functions extracted from main.js.
const migrationProp = extract(
    mainSource,
    'migratePendantOctaprismV1: (data = App.data) =>',
    '// ギルガメッシュ報酬の旧【EX】装備'
);
const grantProp = extract(
    mainSource,
    'grantOctaprismFromPendant: () =>',
    'resolveAbyssSpiritTrialEventId: (element) =>'
);

const context = {
    console,
    Date,
    JSON,
    globalThis: null,
    ABYSS_REGION_CONTENT: {
        octaprismItemId: 701008,
        charredPendantItemId: 701009,
        lightCrystalPendantItemId: 701010
    }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`
const ELEMENTS = ['火','水','風','雷','光','闇'];
const App = {
    data: null,
    saveShouldFail: false,
    save() { return this.saveShouldFail !== true; },
    serializeSaveData(data) { return JSON.stringify(data); },
    restoreSaveDataSnapshot(snapshot) {
        const restored = JSON.parse(snapshot);
        Object.keys(this.data).forEach(key => delete this.data[key]);
        Object.assign(this.data, restored);
        return true;
    },
    runAtomicSaveMutation(mutator) {
        const snapshot = this.serializeSaveData(this.data);
        try {
            const result = mutator();
            if (result && result.ok === false) {
                this.restoreSaveDataSnapshot(snapshot);
                return result;
            }
            if (this.save()) return { ok:true, result };
            this.restoreSaveDataSnapshot(snapshot);
            return { ok:false, reason:'save', saveFailed:true };
        } catch (error) {
            this.restoreSaveDataSnapshot(snapshot);
            return { ok:false, reason:'mutation', error };
        }
    },
    ensureCompatibilityMigrationLedger(data = this.data) {
        data.system = data.system && typeof data.system === 'object' ? data.system : {};
        data.system.oneTimeMigrations = data.system.oneTimeMigrations && typeof data.system.oneTimeMigrations === 'object'
            ? data.system.oneTimeMigrations : {};
        return data.system.oneTimeMigrations;
    },
    runOneTimeCompatibilityMigration(data, migrationId, worker) {
        const ledger = this.ensureCompatibilityMigrationLedger(data);
        if (ledger[migrationId]) return { applied:false, changed:false, count:0 };
        const result = worker() || {};
        const count = Math.max(0, Math.floor(Number(result.count ?? (result.changed ? 1 : 0)) || 0));
        ledger[migrationId] = { completedAt:Date.now(), changed:result.changed === true || count > 0, count };
        return { applied:true, changed:result.changed === true || count > 0, count };
    },
    getAbyssSpiritTrialMaster() {
        return Object.fromEntries(ELEMENTS.map((element, index) => [element, { key:String(index) }]));
    },
    ensureAbyssRegionProgress() {
        this.data.progress = this.data.progress || {};
        this.data.progress.flags = this.data.progress.flags || {};
        this.data.progress.abyssSpiritBlessings = this.data.progress.abyssSpiritBlessings || {};
        this.data.progress.abyssSpiritTrialEvents = this.data.progress.abyssSpiritTrialEvents || {};
        return this.data.progress;
    },
    ensureAbyssSpiritTrialEvents() { return this.ensureAbyssRegionProgress(); },
    ${migrationProp},
    ${grantProp}
};
globalThis.App = App;
`, context, { filename: 'phase2r-functions.js' });

const App = context.App;
const allBlessings = () => Object.fromEntries(['火','水','風','雷','光','闇'].map(element => [element, true]));
const allEvents = () => Object.fromEntries(['火','水','風','雷','光','闇'].map(element => [element, { state:'victory' }]));

// Legacy save without Octaprism receives the charred pendant once.
App.data = { items:{}, progress:{}, system:{} };
let result = App.migratePendantOctaprismV1(App.data);
assert.strictEqual(result.applied, true);
assert.strictEqual(App.data.items[701009], 1);
assert.strictEqual(Number(App.data.items[701010] || 0), 0);
result = App.migratePendantOctaprismV1(App.data);
assert.strictEqual(result.applied, false, 'pendant migration ran more than once');
assert.strictEqual(App.data.items[701009], 1, 'charred pendant duplicated on repeated migration');

// Legacy save with Octaprism receives only the transformed pendant.
App.data = { items:{ 701008:1, 701009:1 }, progress:{}, system:{} };
result = App.migratePendantOctaprismV1(App.data);
assert.strictEqual(result.applied, true);
assert.strictEqual(App.data.items[701010], 1);
assert.strictEqual(Number(App.data.items[701009] || 0), 0);
assert.strictEqual(App.data.items[701008], 1);

// Successful resonance transforms the pendant and grants Octaprism exactly once.
App.data = {
    items:{ 701009:1 },
    progress:{
        flags:{ abyssOctaprismGrantPending:true },
        abyssSpiritBlessings:allBlessings(),
        abyssSpiritTrialEvents:allEvents()
    },
    system:{}
};
App.saveShouldFail = false;
result = App.grantOctaprismFromPendant();
assert.strictEqual(result.ok, true, 'pendant resonance failed');
assert.strictEqual(Number(App.data.items[701009] || 0), 0, 'charred pendant remained after resonance');
assert.strictEqual(App.data.items[701010], 1, 'crystal pendant was not granted');
assert.strictEqual(App.data.items[701008], 1, 'Octaprism was not granted');
assert.strictEqual(App.data.progress.flags.abyssOctaprismGrantPending, false);
assert.strictEqual(App.data.progress.flags.abyssOctaprismGrantEventSeen, true);
assert(Object.values(App.data.progress.abyssSpiritTrialEvents).every(record => record.state === 'completed'));
result = App.grantOctaprismFromPendant();
assert.strictEqual(result.ok, true, 'idempotent resonance replay failed');
assert.strictEqual(App.data.items[701010], 1, 'crystal pendant duplicated on replay');
assert.strictEqual(App.data.items[701008], 1, 'Octaprism duplicated on replay');

// Save failure rolls back items and flags together.
App.data = {
    items:{ 701009:1 },
    progress:{
        flags:{ abyssOctaprismGrantPending:true },
        abyssSpiritBlessings:allBlessings(),
        abyssSpiritTrialEvents:allEvents()
    },
    system:{}
};
App.saveShouldFail = true;
result = App.grantOctaprismFromPendant();
assert.strictEqual(result.ok, false, 'save failure should reject resonance');
assert.strictEqual(App.data.items[701009], 1, 'charred pendant was not restored after save failure');
assert.strictEqual(Number(App.data.items[701010] || 0), 0, 'crystal pendant remained after save failure');
assert.strictEqual(Number(App.data.items[701008] || 0), 0, 'Octaprism remained after save failure');
assert.strictEqual(App.data.progress.flags.abyssOctaprismGrantPending, true, 'pending flag was not restored');
App.saveShouldFail = false;

// The action cannot be forced before all six blessings exist.
App.data = {
    items:{ 701009:1 },
    progress:{ flags:{ abyssOctaprismGrantPending:true }, abyssSpiritBlessings:{ 火:true }, abyssSpiritTrialEvents:{} },
    system:{}
};
result = App.grantOctaprismFromPendant();
assert.strictEqual(result.ok, false);
assert.strictEqual(result.reason, 'requirements');
assert.strictEqual(App.data.items[701009], 1);
assert.strictEqual(Number(App.data.items[701008] || 0), 0);

// Parallel save/play-time UI fixes.
assert(!saveSlotsSource.includes('オートセーブ 1枠 / 手動セーブ 9枠'), 'redundant slot-count subtitle remains');
assert(!saveSlotsSource.includes('オートセーブは既存機能で自動更新されます'), 'redundant save guidance remains');
assert(!saveSlotsSource.includes('手動セーブを読み込むと、現在のオートセーブは選択した内容で即時上書きされます'), 'redundant load guidance remains');
assert(saveSlotsSource.includes('Math.floor((Number(milliseconds) || 0) / 1000)'), 'save-slot play time still retains milliseconds');
assert(mainSource.includes('Math.floor((Number(milliseconds) || 0) / 1000)'), 'adventure-record play time still retains milliseconds');
assert(statusSource.includes('font-variant-numeric:tabular-nums'), 'adventure-record play time is not fixed-width');
const playTimeCss = (css.match(/\.save-slot-playtime\s*\{[^}]*\}/) || [''])[0];
assert(/min-width:\s*10ch;/.test(playTimeCss), 'save-slot play time does not reserve full width');
assert(!/overflow:\s*hidden;/.test(playTimeCss), 'save-slot play time can still be clipped');

console.log('[Phase2R] pendant, Octaprism and save/play-time UI checks: PASS');
