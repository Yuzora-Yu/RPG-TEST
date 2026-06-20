const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const questSource = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
const start = mainSource.indexOf('    ensureQuestState:');
const end = mainSource.indexOf('    limitBreakConfig:', start);
if (start < 0 || end < 0) throw new Error('Unable to extract quest runtime methods.');

const context = {
    console,
    window: {},
    DB: { ITEMS: [] },
    MenuStatus: {},
    App: {
        data: null,
        save() {},
        log() {},
        addStoryAlly(charId) {
            this.data.characters.push({ charId: Number(charId) });
        }
    }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(questSource, context, { filename: 'quests.js' });
vm.runInContext(`App = { ...App,\n${mainSource.slice(start, end)}\n};`, context);

function reset({ flags = {}, allies = [] } = {}) {
    context.App.data = {
        progress: { flags, quests: {} },
        characters: allies.map(charId => ({ charId })),
        items: {}
    };
}

reset();
if (context.App.acceptQuest('marie_water_city', { silent: true })) {
    throw new Error('Marie quest must not start before Water City is cleared.');
}

reset({ flags: { waterCityCleared: true } });
if (!context.App.acceptQuest('marie_water_city', { silent: true })) {
    throw new Error('Marie quest did not start after Water City clear.');
}
context.App.noteQuestKills([100030, 100033, 100020]);
if (context.App.getQuestState('marie_water_city').progress.kills !== 2) {
    throw new Error('Hunt progress counted unrelated monsters or missed targets.');
}
context.App.noteQuestKills([100030, 100030, 100033]);
if (!context.App.isQuestObjectiveComplete('marie_water_city')) {
    throw new Error('Hunt quest did not become reportable at the target count.');
}
context.App.runQuestAction('marie_water_city', { silent: true });
if (!context.App.isQuestCompleted('marie_water_city') || !context.App.hasStoryAlly(102)) {
    throw new Error('Reporting a completed hunt did not finish the quest and grant its reward.');
}

reset({ flags: { lightPalaceCleared: true } });
if (context.App.isQuestUnlocked('luna_hidden_dark_shrine')) {
    throw new Error('Luna hidden quest unlocked before the preceding shrine quest.');
}
context.App.data.progress.quests.claude_leon_dark_shrine = { state: 'completed' };
if (!context.App.isQuestUnlocked('luna_hidden_dark_shrine')) {
    throw new Error('Luna hidden quest did not unlock after the preceding shrine quest.');
}

console.log('Quest runtime validation passed.');
console.log('Prerequisites, hunt progress, report completion, and hidden quest sequencing are valid.');
