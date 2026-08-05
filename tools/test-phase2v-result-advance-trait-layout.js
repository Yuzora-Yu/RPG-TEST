const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const card = read('equip_acquisition_card.js');
const battle = read('battle.js');
const index = read('index.html');
const css = read('modern-polish.css');

assert(card.includes('equip-acquisition-section-break'), 'Trait section break element is missing.');
assert(!card.includes('.equip-acquisition-reveal-row.trait.section-start{flex-basis:100%'), 'First additional trait still occupies a full row.');
assert(card.includes('const revealRowsHtml = rows.map'), 'Reveal row markup is not using the independent section break.');
assert(index.includes('id="battle-log-layer"') && index.includes('id="battle-result-advance-indicator"'), 'Independent result advance indicator layer is missing.');
assert(css.includes('#battle-result-advance-indicator.is-visible') && css.includes('battleResultAdvanceBlink'), 'Result advance indicator animation is missing.');
assert(battle.includes('setResultAdvanceIndicatorVisible: (visible)'), 'Result advance indicator controller is missing.');
assert(battle.includes('Battle.setResultAdvanceIndicatorVisible(true);'), 'Result wait does not show the indicator.');
assert(battle.includes('Battle.setResultAdvanceIndicatorVisible(false);'), 'Result wait does not hide the indicator.');
assert(!battle.includes('Battle.log(`<span style="color:#aaa; font-size:0.85em;">▼</span>`)'), 'Legacy level-up arrow is still written into the battle log.');
console.log('Phase2V focused checks passed.');
