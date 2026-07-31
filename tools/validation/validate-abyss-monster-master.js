const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const failures = [];
const checks = [];
const assert = (condition, message) => condition ? checks.push(message) : failures.push(message);

const context = { console, Math, setTimeout, clearTimeout, tileEntry: (img, color) => ({ img, color }) };
context.window = context;
context.globalThis = context;
vm.createContext(context);
const run = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });

['skills.js', 'items.js', 'assets.js', 'monsters.js', 'abyss_content.js', 'monster-drop-policy.js'].forEach(run);

const registry = context.ABYSS_REGION_CONTENT;
const regularIds = [...registry.regularMonsterIds].map(Number);
const bossIds = [...registry.bossMonsterIds].map(Number);
const regulars = context.MonsterData.normalBases.filter(monster => regularIds.includes(Number(monster.id)));
const bosses = context.MonsterData.bossMonsters.filter(monster => bossIds.includes(Number(monster.id)));
const itemsById = new Map(context.ITEMS_DATA.map(item => [Number(item.id), item]));
const skillsById = new Map(context.SKILLS_DATA.map(skill => [Number(skill.id), skill]));

assert(regularIds.length === 55 && new Set(regularIds).size === 55, '通常敵IDが55体・重複なし');
assert(bossIds.length === 22 && new Set(bossIds).size === 22, 'ボスIDが22体・重複なし');
assert(regulars.length === 55, '通常敵55体がMonsterData.normalBasesへ登録済み');
assert(bosses.length === 22 && bosses.every(monster => monster.isBoss === true), '専用ボス22体が固定ボス正本へ登録済み');
const masterIds = context.MonsterData.allBases.map(monster => Number(monster.id));
assert(masterIds.length === new Set(masterIds).size, '全モンスター正本にID重複なし');
const monstersSource = fs.readFileSync(path.join(root, 'monsters.js'), 'utf8');
assert(!/const\s+ABYSS_REGION_MONSTERS\b/.test(monstersSource), '深淵通常敵の独立配列を廃止');
assert(!/const\s+FIXED_ABYSS_REGION_BOSSES\b/.test(monstersSource), '深淵ボスの独立配列を廃止');
assert(/モンスターID定義（正本）/.test(monstersSource) && /ID:000851~000900/.test(monstersSource) && /ID:302000~302999/.test(monstersSource) && /ID:502000~503000/.test(monstersSource), 'monsters.jsにID定義を明記');
const expectedNormalRange = rank => {
  const startRank = Math.floor((Number(rank) - 1) / 5) * 5 + 1;
  const lower = ((startRank - 1) / 5) * 50 + 1;
  return [lower, lower + 49];
};
assert(regulars.every(monster => {
  const [low, high] = expectedNormalRange(monster.rank);
  return Number(monster.id) >= low && Number(monster.id) <= high;
}), '通常敵55体のIDが各Rank帯の正規範囲内');
const storyBosses = bosses.filter(monster => Number(monster.id) >= 302000 && Number(monster.id) <= 302999);
const trialBosses = bosses.filter(monster => Number(monster.id) >= 502000 && Number(monster.id) <= 503000);
assert(storyBosses.length === 16, '深淵ストーリーボス16体を302xxxへ分類');
assert(trialBosses.length === 6, '六属性精霊6体を502xxxへ分類');
assert(context.MonsterData.idSchemaVersion === 4, 'モンスターIDスキーマをv4へ更新');
assert(context.MonsterData.migrateId(510001, 3) === 856 && context.MonsterData.migrateId(511030, 3) === 302010 && context.MonsterData.migrateId(511101, 3) === 502001 && context.MonsterData.migrateId(512100, 3) === 302100, 'チェックポイント3旧IDをv4へ移行');

const dungeons = [
  ['MAP000038', '雷霆砂丘', 86, 90, ['雷']],
  ['MAP000040', '黒縄のピラミッド', 91, 95, ['雷']],
  ['MAP000039', '叫喚の墓地', 86, 90, ['風']],
  ['MAP000041', '魔風の霊廟', 91, 95, ['風']],
  ['MAP000043', '極寒樹林', 96, 100, ['水']],
  ['MAP000045', '氷刻の浄罪路', 101, 105, ['水']],
  ['MAP000044', '煉獄山脈', 96, 100, ['火']],
  ['MAP000046', '灼熱の古城', 101, 105, ['火']],
  ['MAP000048', '夢幻回廊リドパルム', 106, 110, ['光','闇']],
  ['MAP000049', '災禍の根ジャゴレア', 111, 115, ['光','闇','混沌']],
  ['MAP000050', '次元牢獄クロノアビス', 116, 120, ['混沌']],
];
const rows = [];
for (const [mapId, label, low, high, elements] of dungeons) {
  const found = regulars.filter(monster => (monster.habitats || []).some(habitat => habitat.mapId === mapId));
  assert(found.length === 5 && new Set(found.map(monster => Number(monster.id))).size === 5, `${label}: 新規通常敵5体`);
  assert(found.every(monster => Number(monster.rank) >= low && Number(monster.rank) <= high), `${label}: Rank ${low}～${high}`);
  assert(found.every(monster => elements.some(element => Number(monster.elmRes?.[element] || 0) > 0)), `${label}: 指定属性に適合する耐性設計`);
  rows.push(`${label}: ${found.map(monster => `${monster.name}(R${monster.rank})`).join(' / ')}`);
}

assert(regulars.every(monster => Number(monster.imageId) === Number(monster.id)), '通常敵55体は自身の新規画像IDを使用');
assert(regulars.every(monster => monster.abyssRecruitable === true), '通常敵55体は深淵仲間化対象');
assert(regulars.every(monster => Number.isFinite(Number(monster.dropSeed))), '通常敵55体に安定ドロップシードあり');
assert(regulars.every(monster => Array.isArray(monster.archives) && monster.archives.some(Boolean)), '通常敵55体に図鑑説明あり');
assert(regulars.every(monster => Array.isArray(monster.acts) && monster.acts.length >= 4), '通常敵55体に個別行動セットあり');
assert(regulars.every(monster => Number(monster.actCount) === 1), '深淵追加通常敵55体は全員1回行動');
assert([...regulars, ...bosses].every(monster => monster.acts.every(action => skillsById.has(Number(typeof action === 'object' ? action.id : action)))), '全新規敵の使用スキルがskills.js正本に存在');
assert(regulars.every(monster => ['normal','rare'].every(slot => itemsById.has(Number(monster.drops?.[slot]?.id)) && Number(monster.drops?.[slot]?.rate) > 0)), '通常敵55体の通常・レアドロップが有効');
assert(bosses.every(monster => ['normal','rare'].every(slot => {
  const drop = monster.drops?.[slot];
  return !drop?.id || itemsById.has(Number(drop.id));
})), 'ボスの明示ドロップ参照が有効');

const imageIds = new Set([...regulars, ...bosses].map(monster => Number(monster.imageId ?? monster.id)));
assert(imageIds.size === 73, '差し替え対象画像は73ファイル（通常55＋ボス専用18）');
const replacementListRelative = 'assets/monsters/今後画像変更予定のモンスターID一覧.md';
const replacementListPath = path.join(root, replacementListRelative);
assert(fs.existsSync(replacementListPath), '画像フォルダ内に今後画像変更予定のモンスターID一覧.mdが存在');
const replacementListSource = fs.existsSync(replacementListPath) ? fs.readFileSync(replacementListPath, 'utf8') : '';
assert([...regulars, ...bosses].every(monster => replacementListSource.includes(String(Number(monster.id)).padStart(6, '0'))), '画像差し替え一覧に全77モンスターIDを記載');
assert([...imageIds].every(imageId => replacementListSource.includes(`monster_${String(imageId).padStart(6, '0')}.png`)), '画像差し替え一覧に全73画像ファイル名を記載');
for (const imageId of imageIds) {
  const relative = `assets/monsters/monster_${String(imageId).padStart(6, '0')}.png`;
  assert(fs.existsSync(path.join(root, relative)), `${relative} が存在`);
  assert(context.PRISMA_ASSETS.monsters.files.includes(relative), `${relative} が自動キャッシュ対象`);
}

const pillars = [302080,302081,302082,302083,302084].map(id => bosses.find(monster => Number(monster.id) === id));
assert(pillars.every(Boolean), 'ヴェグナシス5攻撃対象が正本に存在');
assert(pillars.every((monster, index) => Number(monster.imageId) === 302080 && monster.linkedBattleGroup === 'vegnasis' && Number(monster.linkedDeathIndex) === index), 'ヴェグナシスは1グラフィック・5対象の連結定義');
assert(pillars.every(monster => Number(monster.actCount) === 1), 'ヴェグナシス5柱は各1回行動');
assert(pillars.find(monster => Number(monster.id) === 302082)?.acts.some(action => Number(action.id) === 413), '水柱シーリスが全体回復行動を持つ');
const veldPillar = pillars.find(monster => Number(monster.id) === 302084);
assert(['火','水','風','雷','光','闇','混沌'].every(element => Number(veldPillar?.elmRes?.[element] || 0) >= 45), '闇柱ヴェルドは全属性に高い耐性を持つ');
assert(pillars.every(monster => Number(monster.gutsLevel) >= 10), 'ヴェグナシス全対象に高い根性レベル');
assert(bosses.every(monster => Number(monster.exp) > 0), '深淵専用ボス22体に経験値報酬を設定');
assert(fs.existsSync(path.join(root, 'assets/monsters/monster_302080.png')), 'ヴェグナシス共通差し替え画像が存在');
const firstForm = bosses.find(monster => Number(monster.id) === 302100);
const finalForm = bosses.find(monster => Number(monster.id) === 302101);
assert(firstForm && finalForm && Number(firstForm.imageId) === 302100 && Number(finalForm.imageId) === 302101, 'アゼルガラグ2形態を別ID・別画像で正本化');
assert(Number(firstForm?.phaseTransitionMonsterId) === 302101 && firstForm?.phaseTransitionConversation === 'ABYSS_AZELGARAG_TRANSFORM' && finalForm?.isAzelgaragFinalForm === true, 'アゼルガラグ形態移行の正本参照が相互に整合');

const storySource = fs.readFileSync(path.join(root, 'abyss_story.js'), 'utf8');
const battleSource = fs.readFileSync(path.join(root, 'battle.js'), 'utf8');
const mapContext = { console, Math, setTimeout, clearTimeout, tileEntry: (img, color) => ({ img, color }) };
mapContext.window = mapContext;
mapContext.globalThis = mapContext;
vm.createContext(mapContext);
vm.runInContext(`${fs.readFileSync(path.join(root, 'map.js'), 'utf8')}\nglobalThis.FIXED_DUNGEON_MAPS = FIXED_DUNGEON_MAPS;`, mapContext, { filename: 'map.js' });
const altarBossIds = mapContext.FIXED_DUNGEON_MAPS?.FINAL_ALTAR?.bosses?.[0]?.monsterId;
assert(Array.isArray(altarBossIds) && altarBossIds.join(',') === '302080,302081,302082,302083,302084', '終焉の祭壇にヴェグナシス5対象を配置');
assert(/value:302100/.test(storySource) && /winEventId:'abyss_azelgarag_clear'/.test(storySource), 'ヴェグナシス勝利後にアゼルガラグへ連戦');
assert(/abyssVegnasisIds/.test(battleSource) && /vegnasis-shared-visual/.test(battleSource), 'ヴェグナシス専用戦闘・共有描画が戦闘正本に統合されている');
assert(/302100/.test(battleSource) && /302101/.test(battleSource) && /ABYSS_AZELGARAG_TRANSFORM/.test(battleSource), 'アゼルガラグ第二形態移行フックが有効');

const contentSource = fs.readFileSync(path.join(root, 'abyss_content.js'), 'utf8');
assert(!/\.push\s*\(/.test(contentSource), 'abyss_content.jsにマスターデータの実行時pushなし');
assert(skillsById.has(700101), '混沌の衣がskills.js正本に存在');
assert([701001,701002,701003,701004,701005,701006,701007,701008].every(id => itemsById.has(id)), '結晶片・オクタプリズマがitems.js正本に存在');

const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(/ABYSS_REGION_MASTER/.test(mainSource) && /worldKey\s*===\s*'ABYSS_WORLD'/.test(mainSource), '仲間化許可判定と地域処理が深淵エリア正本を参照');
assert(!/abyss_region\.js|abyss_runtime\.js|abyss_battle\.js/.test(indexSource), '旧深淵ランタイム上書きモジュールを読み込まない');

if (failures.length) {
  console.error(`Abyss monster master validation failed (${failures.length}):`);
  failures.forEach(message => console.error(` - ${message}`));
  process.exit(1);
}
console.log(`Abyss monster master validation passed (${checks.length} checks).`);
console.log(`Regular monsters: ${regulars.length}; bosses: ${bosses.length}; dedicated placeholder images: ${imageIds.size}.`);
rows.forEach(row => console.log(` - ${row}`));
