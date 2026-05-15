/* achievements.js
 * ============================================================================
 * 実績データ + 実績判定ロジック
 * ----------------------------------------------------------------------------
 * 【今後の方針】
 * - 実績の追加・判定タイプの追加・報酬付与処理は、このファイルに統一する。
 * - menus.js は「実績画面の表示」だけを担当し、判定条件や報酬付与ロジックを
 *   menus.js 側へ再追加しない。
 * - Codex等で修正する場合も、MenuAchievements.checkProgress に switch 文を
 *   増やすのではなく、AchievementManager.getValueByType() に追加すること。
 *
 * 理由:
 * 以前は achievements.js に実績データだけがあり、menus.js 側に判定処理が
 * 置かれていたため、「実績一覧」と「達成条件」が別々に増殖しやすい状態でした。
 * ここに集約することで、実績を追加するときに見る場所を1か所に固定します。
 * ============================================================================ */

const ACHIEVEMENTS_DATA = [
    // --- 1. 主人公レベル ---
    { id: 101, type: "LV", goal: 5, category: "育成", title: "駆け出し冒険者", desc: "主人公のレベルが5に到達", rewards: [
        { type: 'EQUIP', eid: 21, plus: 3,
            opts: [
                { key: 'atk', val: 10, rarity: 'UR' },
                { key: 'atk', val: 10, rarity: 'UR' },
                { key: 'elmAtk', elm: '雷', val: 10, rarity: 'UR' }
            ],
            traits: [{ id: 1, level: 3 }, { id: 11, level: 3 }]
        }
    ] },
    { id: 102, type: "LV", goal: 20, category: "育成", title: "熟練の剣筋", desc: "主人公のレベルが20に到達", rewards: [
        { type: 'GEM', val: 500 },
        { type: 'GOLD', val: 5000 }
    ] },
    { id: 103, type: "LV", goal: 50, category: "育成", title: "伝説の胎動", desc: "主人公のレベルが50に到達", rewards: [
        { type: 'GEM', val: 1000 },
        { type: 'ITEM', id: 6, val: 5 }
    ] },
    { id: 104, type: "LV", goal: 100, category: "育成", title: "深淵の到達者", desc: "主人公のレベルが100に到達", rewards: [
        { type: 'GEM', val: 3000 },
        { type: 'GOLD', val: 10000 }
    ] },

    // --- 2. 最大ダメージ ---
    // DQスケール化後の「単発最大ダメージ」実績。
    // battle.jsの記録は多段攻撃の合計ではなく1ヒットごとの最大値なので、
    // 序盤〜終盤〜やり込みの単発火力に合わせた段階にする。
    { id: 201, type: "DMG", goal: 30, category: "戦闘", title: "重い一撃", desc: "最大ダメージ 30突破", rewards: [{ type: 'GEM', val: 100 }] },
    { id: 202, type: "DMG", goal: 100, category: "戦闘", title: "必殺の手応え", desc: "最大ダメージ 100突破", rewards: [{ type: 'GEM', val: 300 }] },
    { id: 203, type: "DMG", goal: 300, category: "戦闘", title: "必殺の極意", desc: "最大ダメージ 300突破", rewards: [{ type: 'GEM', val: 700 }] },
    { id: 204, type: "DMG", goal: 1000, category: "戦闘", title: "魔神の一撃", desc: "最大ダメージ 1,000突破", rewards: [{ type: 'GEM', val: 1500 }] },
    { id: 205, type: "DMG", goal: 3000, category: "戦闘", title: "天を砕く一撃", desc: "最大ダメージ 3,000突破", rewards: [{ type: 'GEM', val: 3000 }] },

    // --- 3. 到達階層 ---
    { id: 301, type: "FLOOR", goal: 11, category: "探索", title: "深淵の入り口", desc: "ダンジョン 11階に到達", rewards: [{ type: 'GEM', val: 100 }] },
    { id: 302, type: "FLOOR", goal: 31, category: "探索", title: "中層の覇者", desc: "ダンジョン 31階に到達", rewards: [{ type: 'GEM', val: 500 }] },
    { id: 303, type: "FLOOR", goal: 51, category: "探索", title: "奈落を識る者", desc: "ダンジョン 51階に到達", rewards: [{ type: 'GEM', val: 1000 }] },
    { id: 304, type: "FLOOR", goal: 101, category: "探索", title: "深淵を越えし者", desc: "ダンジョン 101階に到達", rewards: [
        { type: 'GEM', val: 3000 },
        { type: 'ITEM', id: 107, val: 1 }
    ] },
    { id: 305, type: "FLOOR", goal: 201, category: "探索", title: "真装備の探索者", desc: "ダンジョン 201階に到達", rewards: [
        { type: 'GEM', val: 5000 },
        { type: 'ITEM', id: 106, val: 10 }
    ] },

    // --- 4. ストーリー進行度 ---
    { id: 401, type: "STORY", goal: 2, category: "物語", title: "旅立ちの決意", desc: "ストーリー進行度 2に到達", rewards: [
        { type: 'GEM', val: 3000 },
        { type: 'GOLD', val: 10000 }
    ] },
    { id: 402, type: "STORY", goal: 5, category: "物語", title: "世界の真実", desc: "ストーリー進行度 5に到達", rewards: [
        { type: 'GEM', val: 3000 },
        { type: 'GOLD', val: 10000 }
    ] },

    // --- 5. 鍛冶屋レベル ---
    { id: 501, type: "SMITH", goal: 2, category: "鍛冶", title: "見習い職人", desc: "鍛冶屋レベル 2に到達", rewards: [{ type: 'GEM', val: 200 }] },
    { id: 502, type: "SMITH", goal: 5, category: "鍛冶", title: "名匠の称号", desc: "鍛冶屋レベル 5に到達", rewards: [{ type: 'GEM', val: 500 }] },
    { id: 503, type: "SMITH", goal: 10, category: "鍛冶", title: "神工の槌音", desc: "鍛冶屋レベル 10に到達", rewards: [
        { type: 'GEM', val: 1500 },
        { type: 'GOLD', val: 50000 }
    ] },

    // --- 6. 魔物図鑑 ---
    { id: 601, type: "BOOK", goal: 10, category: "図鑑", title: "魔物学者", desc: "魔物図鑑を10種類埋める", rewards: [{ type: 'GEM', val: 100 }] },
    { id: 602, type: "BOOK", goal: 50, category: "図鑑", title: "モンスターハンター", desc: "魔物図鑑を50種類埋める", rewards: [{ type: 'GEM', val: 500 }] },
    { id: 603, type: "BOOK", goal: 100, category: "図鑑", title: "深淵生態系の記録者", desc: "魔物図鑑を100種類埋める", rewards: [{ type: 'GEM', val: 1000 }] },

    // --- 7. 累計獲得ゴールド / GEM ---
    { id: 701, type: "GOLD", goal: 100000, category: "収集", title: "貯金家", desc: "累計獲得ゴールド 100,000突破", rewards: [{ type: 'GEM', val: 100 }] },
    { id: 702, type: "GOLD", goal: 1000000, category: "収集", title: "大富豪", desc: "累計獲得ゴールド 1,000,000突破", rewards: [{ type: 'GEM', val: 1000 }] },
    { id: 703, type: "GEM", goal: 10000, category: "収集", title: "輝石を集めし者", desc: "累計獲得GEM 10,000突破", rewards: [{ type: 'GOLD', val: 100000 }] },

    // --- 8. 特殊ボス討伐 ---
    { id: 801, type: "BOSS", targetIds: [902000, 2000], goal: 1, category: "戦闘", title: "災厄への挑戦", desc: "災厄の王????を1体討伐", rewards: [{ type: 'GEM', val: 3000 }] },
    { id: 802, type: "BOSS", targetIds: [902000, 2000], goal: 10, category: "戦闘", title: "災厄を撃ち払う者", desc: "災厄の王????を10体討伐", rewards: [{ type: 'GEM', val: 3000 }] },
    { id: 803, type: "BOSS", targetIds: [902000, 2000], goal: 50, category: "戦闘", title: "災厄の征服者", desc: "災厄の王????を50体討伐", rewards: [{ type: 'EQUIP', eid: 801, plus: 3 }] },

    // --- 9. 仲間・パーティ ---
    { id: 901, type: "ALLY", goal: 5, category: "仲間", title: "小さな仲間たち", desc: "主人公以外の仲間を5人集める", rewards: [{ type: 'GEM', val: 300 }] },
    { id: 902, type: "ALLY", goal: 10, category: "仲間", title: "冒険者ギルド", desc: "主人公以外の仲間を10人集める", rewards: [{ type: 'GEM', val: 900 }] },
    { id: 903, type: "ALLY", goal: 25, category: "仲間", title: "英雄団", desc: "主人公以外の仲間を25人集める", rewards: [
        { type: 'GEM', val: 1500 },
        { type: 'ITEM', id: 6, val: 5 }
    ] },
    { id: 904, type: "PARTY", goal: 4, category: "仲間", title: "四人の誓い", desc: "4人パーティを編成する", rewards: [{ type: 'GEM', val: 500 }] },
    { id: 905, type: "RARITY_ALLY", rarity: "EX", goal: 1, category: "仲間", title: "神話との邂逅", desc: "EXレアリティの仲間を1人以上所持", rewards: [{ type: 'GEM', val: 1000 }] },

    // --- 10. ダンジョン挑戦・宝箱・メダル ---
    { id: 1001, type: "RUN", goal: 50, category: "探索", title: "探索者", desc: "ダンジョンに50回挑戦", rewards: [{ type: 'GEM', val: 1000 }] },
    { id: 1002, type: "RUN", goal: 200, category: "探索", title: "深層常連", desc: "ダンジョンに200回挑戦", rewards: [{ type: 'GEM', val: 1000 }] },
    { id: 1003, type: "CHEST", goal: 50, category: "探索", title: "宝箱ハンター", desc: "宝箱を50個開ける", rewards: [{ type: 'GEM', val: 500 }] },
    { id: 1004, type: "CHEST", goal: 200, category: "探索", title: "開封の達人", desc: "宝箱を200個開ける", rewards: [{ type: 'ITEM', id: 106, val: 5 }] },

    { id: 1101, type: "MEDAL", goal: 10, category: "収集", title: "収集癖", desc: "ちいさなメダルを累計10枚集める", rewards: [
        { type: 'GEM', val: 500 },
        { type: 'ITEM', id: 5, val: 5 }
    ] },
    { id: 1102, type: "MEDAL", goal: 50, category: "収集", title: "蒐集家", desc: "ちいさなメダルを累計50枚集める", rewards: [
        { type: 'GEM', val: 500 },
        { type: 'ITEM', id: 14, val: 5 }
    ] },
    { id: 1103, type: "MEDAL", goal: 100, category: "収集", title: "伝説の蒐集家", desc: "ちいさなメダルを累計100枚集める", rewards: [
        { type: 'GEM', val: 1000 },
        { type: 'ITEM', id: 100, val: 5 }
    ] },

    // --- 11. 装備厳選 ---
    { id: 1201, type: "EQUIP_EX", goal: 1, category: "装備", title: "極意の発現", desc: "EXオプション付き装備を1個入手", rewards: [{ type: 'GEM', val: 500 }] },
    { id: 1202, type: "EQUIP_SYNERGY", goal: 3, category: "装備", title: "共鳴", desc: "シナジー装備を3個所持", rewards: [{ type: 'GEM', val: 1000 }] },
    { id: 1203, type: "EQUIP_PLUS", goal: 3, category: "装備", title: "鍛え抜かれた逸品", desc: "+3装備を1個所持", rewards: [{ type: 'GEM', val: 300 }] },
    { id: 1204, type: "EQUIP_TRUE", goal: 1, category: "装備", title: "真なる武具", desc: "真・装備を1個入手", rewards: [{ type: 'GEM', val: 1000 }] },

    // --- 12. 転生・リミットブレイク・スキルツリー ---
    { id: 1301, type: "REBIRTH", goal: 1, category: "育成", title: "新たなる始まり", desc: "主人公が転生を1回行う", rewards: [{ type: 'GEM', val: 1000 }] },
    { id: 1302, type: "REBIRTH", goal: 5, category: "育成", title: "輪廻の探究者", desc: "主人公が転生を5回行う", rewards: [{ type: 'GEM', val: 2000 }] },
    { id: 1303, type: "REBIRTH", goal: 20, category: "育成", title: "永劫回帰", desc: "主人公が転生を20回行う", rewards: [
        { type: 'GEM', val: 3000 },
        { type: 'ITEM', id: 107, val: 1 }
    ] },
    { id: 1304, type: "LIMIT_BREAK", goal: 50, category: "育成", title: "限界を越える者", desc: "いずれかの仲間の限界突破が50に到達", rewards: [{ type: 'GEM', val: 1000 }] },
    { id: 1305, type: "LIMIT_BREAK", goal: 99, category: "育成", title: "極限覚醒", desc: "いずれかの仲間の限界突破が99に到達", rewards: [{ type: 'GEM', val: 3000 }] },
    { id: 1306, type: "SKILL_TREE", goal: 20, category: "育成", title: "熟達の証", desc: "1人のスキルツリー合計を20以上にする", rewards: [{ type: 'ITEM', id: 106, val: 3 }] },

    // --- 13. 討伐・敗北からの復帰 ---
    { id: 1401, type: "KILL_TOTAL", goal: 100, category: "戦闘", title: "百戦錬磨", desc: "モンスターを累計100体討伐", rewards: [{ type: 'GEM', val: 500 }] },
    { id: 1402, type: "KILL_TOTAL", goal: 1000, category: "戦闘", title: "千の屍を越えて", desc: "モンスターを累計1,000体討伐", rewards: [{ type: 'GEM', val: 1500 }] },
    { id: 1403, type: "WIPEOUT", goal: 1, category: "戦闘", title: "敗北からの再起", desc: "全滅を1回経験する", rewards: [{ type: 'ITEM', id: 5, val: 3 }] },
    { id: 1404, type: "WIPEOUT", goal: 10, category: "戦闘", title: "不屈の冒険者", desc: "全滅を10回経験する", rewards: [{ type: 'GEM', val: 1000 }] },

    // --- 14. 固有MAP発見 ---
    { id: 1501, type: "MAP_DISCOVER", goal: 2, category: "探索", title: "旅の道標", desc: "固有MAPを2か所発見する", rewards: [{ type: 'ITEM', id: 110, val: 1 }] },
    { id: 1502, type: "MAP_DISCOVER", goal: 4, category: "探索", title: "空路の開拓者", desc: "固有MAPを4か所発見する", rewards: [{ type: 'ITEM', id: 110, val: 2 }] },
    { id: 1503, type: "MAP_DISCOVER", goal: 7, category: "探索", title: "世界を巡る者", desc: "固有MAPを7か所発見する", rewards: [{ type: 'ITEM', id: 110, val: 3 }] },
    { id: 1504, type: "MAP_DISCOVER", goal: 10, category: "探索", title: "地平の記録者", desc: "固有MAPを10か所発見する", rewards: [{ type: 'ITEM', id: 110, val: 5 }] }
];

const AchievementManager = {
    normalize: () => {
        if (typeof App === 'undefined' || !App.data) return false;
        let changed = false;
        if (!App.data.achievements || typeof App.data.achievements !== 'object') {
            App.data.achievements = {};
            changed = true;
        }
        ACHIEVEMENTS_DATA.forEach((ach) => {
            const key = String(ach.id);
            const current = App.data.achievements[key];
            if (!current || typeof current !== 'object') {
                App.data.achievements[key] = { completed: false, claimed: false, progress: 0 };
                changed = true;
            } else {
                if (current.completed == null) { current.completed = false; changed = true; }
                if (current.claimed == null) { current.claimed = false; changed = true; }
                if (current.progress == null) { current.progress = 0; changed = true; }
            }
        });
        return changed;
    },

    getHero: () => {
        const chars = (App.data && App.data.characters) || [];
        return chars.find(c => c.uid === 'p1' || c.isHero || c.charId === 301) || chars[0] || {};
    },

    getAllEquips: () => {
        const equips = [];
        const addEquip = (eq) => { if (eq && typeof eq === 'object') equips.push(eq); };

        ((App.data && App.data.inventory) || []).forEach(addEquip);
        ((App.data && App.data.characters) || []).forEach((char) => {
            Object.values(char.equips || {}).forEach(addEquip);
        });

        // 同じ装備が inventory と装備欄の両方に残っている可能性への保険。
        const seen = new Set();
        return equips.filter((eq) => {
            const key = eq.id || `${eq.name}_${eq.type}_${eq.plus}_${JSON.stringify(eq.opts || [])}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    },

    countOpenedChests: () => {
        const progress = App.data.progress || {};
        if (App.data.stats && App.data.stats.totalChestsOpened != null) return App.data.stats.totalChestsOpened || 0;
        const opened = progress.openedChests || {};
        if (Array.isArray(opened)) return opened.length;
        if (typeof opened !== 'object') return 0;
        // openedChests は { areaKey: ["x,y", ...] } 形式で保存される。
        // 単純な Object.keys(opened).length だと「エリア数」だけになるため、
        // 配列の中身まで合算する。
        return Object.values(opened).reduce((sum, value) => {
            if (Array.isArray(value)) return sum + value.length;
            if (value && typeof value === 'object') return sum + Object.keys(value).length;
            return sum + (value ? 1 : 0);
        }, 0);
    },

    sumKillCounts: () => {
        const killCounts = (App.data.book && App.data.book.killCounts) || {};
        return Object.values(killCounts).reduce((sum, n) => sum + (Number(n) || 0), 0);
    },

    countBossKills: (ach) => {
        const killCounts = (App.data.book && App.data.book.killCounts) || {};
        const ids = (ach.targetIds && ach.targetIds.length) ? ach.targetIds : [902000, 2000];
        return ids.reduce((sum, id) => sum + (Number(killCounts[id]) || Number(killCounts[String(id)]) || 0), 0);
    },

    getValueByType: (ach) => {
        if (typeof App === 'undefined' || !App.data) return 0;

        const stats = App.data.stats || {};
        const dungeon = App.data.dungeon || {};
        const progress = App.data.progress || {};
        const smith = App.data.blacksmith || {};
        const book = (App.data.book && App.data.book.monsters) || [];
        const hero = AchievementManager.getHero();
        const chars = App.data.characters || [];
        const equips = AchievementManager.getAllEquips();

        switch (ach.type) {
            case "LV": return Number(hero.level) || 0;
            case "DMG": return Number(stats.maxDamage && stats.maxDamage.val) || 0;
            case "FLOOR": return Math.max(Number(dungeon.maxFloor) || 0, Number(progress.floor) || 0);
            case "STORY": return Number(progress.storyStep) || 0;
            case "SMITH": return Number(smith.level) || 0;
            case "BOOK": return Array.isArray(book) ? new Set(book).size : 0;
            case "GOLD": return Number(stats.totalGoldEarned) || Number(stats.maxGold) || Number(App.data.gold) || 0;
            case "GEM": return Number(stats.totalGemsEarned) || Number(stats.maxGems) || Number(App.data.gems) || 0;
            case "REBIRTH": return Number(hero.reincarnationCount) || 0;
            case "BOSS": return AchievementManager.countBossKills(ach);
            case "ALLY": return chars.filter(c => c && c.uid !== 'p1' && !c.isHero).length;
            case "PARTY": return (App.data.party || []).filter(Boolean).length;
            case "RARITY_ALLY": return chars.filter(c => c && String(c.rarity || '').toUpperCase() === String(ach.rarity || '').toUpperCase()).length;
            case "RUN": return Number(dungeon.tryCount) || 0;
            case "CHEST": return AchievementManager.countOpenedChests();
            case "MAP_DISCOVER": return (typeof App.getVisitedFixedMapCount === 'function')
                ? App.getVisitedFixedMapCount()
                : Object.keys(progress.visitedFixedMaps || {}).length;
            case "MEDAL": return Number(stats.totalMedals) || Number((App.data.items || {})[99]) || 0;
            case "KILL_TOTAL": return AchievementManager.sumKillCounts();
            case "WIPEOUT": return Number(stats.wipeoutCount) || 0;
            case "LIMIT_BREAK": return Math.max(0, ...chars.map(c => Number(c.limitBreak) || 0));
            case "SKILL_TREE": return Math.max(0, ...chars.map(c => Object.values(c.tree || {}).reduce((sum, v) => sum + (Number(v) || 0), 0)));
            case "EQUIP_EX": return equips.filter(eq => (eq.opts || []).some(o => String(o.rarity || '').toUpperCase() === 'EX')).length;
            case "EQUIP_SYNERGY": return equips.filter(eq => eq.isSynergy || (eq.synergies && eq.synergies.length)).length;
            case "EQUIP_PLUS": return Math.max(0, ...equips.map(eq => Number(eq.plus) || 0));
            case "EQUIP_TRUE": return equips.filter(eq => typeof eq.name === 'string' && eq.name.indexOf('真・') !== -1).length;

            // 互換用。旧データで type:"EQUIP" が残っていた場合は、
            // EXオプション or シナジー装備のどちらかを持っていれば達成扱いにする。
            case "EQUIP":
                return equips.filter(eq =>
                    eq.isSynergy ||
                    (eq.synergies && eq.synergies.length) ||
                    (eq.opts || []).some(o => String(o.rarity || '').toUpperCase() === 'EX')
                ).length;
            default:
                return 0;
        }
    },

    getProgress: (ach) => {
        const value = AchievementManager.getValueByType(ach);
        const goal = Number(ach.goal) || 1;
        return {
            value,
            goal,
            percent: Math.max(0, Math.min(100, Math.floor((value / goal) * 100))),
            completed: value >= goal
        };
    },

    checkProgress: (options = {}) => {
        if (typeof App === 'undefined' || !App.data || typeof ACHIEVEMENTS_DATA === 'undefined') return 0;

        let changed = AchievementManager.normalize();
        let newlyCompleted = 0;

        ACHIEVEMENTS_DATA.forEach((ach) => {
            const key = String(ach.id);
            const state = App.data.achievements[key];
            const progress = AchievementManager.getProgress(ach);

            if (state.progress !== progress.value) {
                state.progress = progress.value;
                changed = true;
            }
            if (progress.completed && !state.completed) {
                state.completed = true;
                newlyCompleted += 1;
                changed = true;
            }
        });

        if (changed && options.save !== false && typeof App.save === 'function') App.save();
        return newlyCompleted;
    },

    hasUnclaimed: () => {
        if (typeof App === 'undefined' || !App.data) return false;
        AchievementManager.normalize();
        return Object.values(App.data.achievements || {}).some(a => a.completed && !a.claimed);
    },

    getState: (id) => {
        if (typeof App === 'undefined' || !App.data) return { completed: false, claimed: false, progress: 0 };
        AchievementManager.normalize();
        return App.data.achievements[String(id)] || { completed: false, claimed: false, progress: 0 };
    },

    getItemName: (id) => {
        const items = window.ITEMS_DATA || ((typeof DB !== 'undefined' && DB.ITEMS) ? DB.ITEMS : []);
        const item = items.find(i => Number(i.id) === Number(id));
        return item ? item.name : `アイテムID:${id}`;
    },

    getEquipName: (eid) => {
        const eq = (window.EQUIP_MASTER || []).find(e => Number(e.eid) === Number(eid));
        return eq ? eq.name : `装備ID:${eid}`;
    },

    getRewardText: (rewards = []) => {
        return rewards.map((r) => {
            if (r.type === 'GEM') return `${r.val || 0} GEM`;
            if (r.type === 'GOLD') return `${r.val || 0} GOLD`;
            if (r.type === 'ITEM') return `${AchievementManager.getItemName(r.id)} x${r.val || 1}`;
            if (r.type === 'EQUIP') return `${AchievementManager.getEquipName(r.eid)}${r.plus ? `+${r.plus}` : ''}`;
            return r.type;
        }).join('、');
    },

    processRewards: (rewards = []) => {
        if (typeof App === 'undefined' || !App.data) return '';
        if (!App.data.items) App.data.items = {};
        if (!App.data.inventory) App.data.inventory = [];

        const msgParts = [];

        rewards.forEach((r) => {
            switch (r.type) {
                case 'GEM':
                    App.data.gems = (Number(App.data.gems) || 0) + (Number(r.val) || 0);
                    msgParts.push(`${r.val || 0} GEM`);
                    break;
                case 'GOLD':
                    App.data.gold = (Number(App.data.gold) || 0) + (Number(r.val) || 0);
                    msgParts.push(`${r.val || 0} GOLD`);
                    break;
                case 'ITEM': {
                    const count = Number(r.val) || 1;
                    App.data.items[r.id] = (Number(App.data.items[r.id]) || 0) + count;
                    msgParts.push(`${AchievementManager.getItemName(r.id)} x${count}`);
                    break;
                }
                case 'EQUIP': {
                    if (typeof App.createEquipById !== 'function') break;
                    const newEq = App.createEquipById(r.eid, r.plus || 0, r.opts || null, r.traits || null);
                    if (newEq) {
                        App.data.inventory.push(newEq);
                        msgParts.push(newEq.name);
                    }
                    break;
                }
                default:
                    break;
            }
        });

        return msgParts.join('、');
    },

    claim: (id) => {
        AchievementManager.checkProgress({ save: false });
        const ach = ACHIEVEMENTS_DATA.find(a => Number(a.id) === Number(id));
        if (!ach) return { ok: false, message: '実績データが見つかりません。' };

        const key = String(ach.id);
        const state = App.data.achievements[key];
        if (!state || !state.completed) return { ok: false, message: 'まだ達成していません。' };
        if (state.claimed) return { ok: false, message: 'すでに受け取り済みです。' };

        const rewardText = AchievementManager.processRewards(ach.rewards || []);
        state.claimed = true;
        if (typeof App.save === 'function') App.save();

        return { ok: true, count: 1, rewardText };
    },

    claimAll: () => {
        AchievementManager.checkProgress({ save: false });
        let count = 0;
        const rewardTexts = [];

        ACHIEVEMENTS_DATA.forEach((ach) => {
            const state = App.data.achievements[String(ach.id)];
            if (state && state.completed && !state.claimed) {
                const text = AchievementManager.processRewards(ach.rewards || []);
                if (text) rewardTexts.push(text);
                state.claimed = true;
                count += 1;
            }
        });

        if (count > 0 && typeof App.save === 'function') App.save();
        return { ok: count > 0, count, rewardText: rewardTexts.join('、') };
    }
};

// 他ファイルから参照しやすいように window にも明示的に公開する。
window.ACHIEVEMENTS_DATA = ACHIEVEMENTS_DATA;
window.AchievementManager = AchievementManager;
