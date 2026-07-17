/* item-expansion.js - battle consumables and ranked crafting materials */
(() => {
    'use strict';

    const items = Array.isArray(window.ITEMS_DATA) ? window.ITEMS_DATA : (window.ITEMS_DATA = []);
    const existingIds = new Set(items.map(item => Number(item.id)));
    const add = item => {
        const id = Number(item.id);
        if (!Number.isInteger(id) || existingIds.has(id)) return;
        items.push(Object.freeze({ consumable: item.type !== '素材', ...item }));
        existingIds.add(id);
    };

    const ICONS = Object.freeze({
        damage: 'assets/ui/menu-icons/item-attack-v001.png',
        buff: 'assets/ui/menu-icons/item-buff-v001.png',
        debuff: 'assets/ui/menu-icons/item-debuff-v001.png',
        material: 'assets/ui/menu-icons/item-material-v001.png'
    });
    const ELEMENTS = Object.freeze(['火', '水', '雷', '風', '光', '闇', '混沌']);
    const ELEMENT_NAMES = Object.freeze({
        火: ['火炎玉', '業火の壺', '爆炎球', '煉獄爆弾', '鳳凰の火筒'],
        水: ['水撃瓶', '激流の壺', '氷雨の珠', '大海嘯の器', '水龍の逆鱗'],
        雷: ['雷鳴石', '迅雷の壺', '雷雲珠', '天雷の器', '雷神の太鼓'],
        風: ['風刃羽', '暴風の壺', '旋風珠', '天嵐の器', '風神の扇'],
        光: ['閃光石', '聖光の壺', '光輪珠', '神光の器', '天使の聖印'],
        闇: ['闇弾石', '冥闇の壺', '黒月珠', '奈落の器', '魔王の瞳'],
        混沌: ['混沌片', '崩界の壺', '虹蝕珠', '終焉の器', 'プリズム残滓']
    });
    const DAMAGE_FORMS = Object.freeze([
        { target: '単体', power: 90, hits: 1, rank: 8, price: 300, label: '敵単体に弱い' },
        { target: '単体', power: 420, hits: 1, rank: 50, price: 8000, label: '敵単体に強い' },
        { target: '全体', power: 130, hits: 1, rank: 25, price: 1800, label: '敵全体に弱い' },
        { target: '全体', power: 520, hits: 1, rank: 75, price: 25000, label: '敵全体に強い' },
        { target: 'ランダム', power: 280, hits: 3, rank: 90, price: 0, label: '敵へランダムに3回強い', medalOnly: true }
    ]);

    ELEMENTS.forEach((element, elementIndex) => {
        DAMAGE_FORMS.forEach((form, formIndex) => add({
            id: 1000 + elementIndex * 5 + formIndex,
            rank: form.rank,
            name: ELEMENT_NAMES[element][formIndex],
            type: '攻撃道具',
            effectKind: 'damage',
            element,
            power: form.power,
            hits: form.hits,
            target: form.target,
            battleUsable: true,
            fieldUsable: false,
            medalOnly: !!form.medalOnly,
            shopAvailable: !form.medalOnly,
            price: form.price,
            icon: ICONS.damage,
            desc: `${form.label}${element}属性固定ダメージを与える${form.hits > 1 ? `（${form.hits}回）` : ''}`
        }));
    });

    [
        { id: 1040, rank: 20, name: '魔力の霧', type: 'MP回復', val: 30, target: '全体', price: 1200, desc: '味方全員のMPを30回復' },
        { id: 1041, rank: 45, name: '賢者の香', type: 'MP回復', val: 100, target: '全体', price: 6000, desc: '味方全員のMPを100回復' },
        { id: 1042, rank: 65, name: '星海の聖水', type: 'MP回復', val: 200, target: '全体', price: 18000, desc: '味方全員のMPを200回復' },
        { id: 1043, rank: 95, name: '神霊の雫', type: 'MP回復', val: 999, target: '全体', price: 0, medalOnly: true, shopAvailable: false, desc: '味方全員のMPを999回復' },
        { id: 1044, rank: 18, name: 'いやしの大粉', type: 'HP回復', val: 80, target: '全体', price: 700, desc: '味方全員のHPを80回復' },
        { id: 1045, rank: 55, name: '生命の大霊薬', type: 'HP回復', val: 350, target: '全体', price: 9000, desc: '味方全員のHPを350回復' }
    ].forEach(item => add({ battleUsable: true, fieldUsable: true, fieldGroup: true, ...item }));

    const BUFF_STATS = Object.freeze([
        ['atk', '攻撃', '剛力'],
        ['def', '防御', '堅守'],
        ['mag', '魔力', '叡智'],
        ['mdef', '魔法防御', '魔障'],
        ['elmResUp', '全属性耐性', '七彩']
    ]);
    BUFF_STATS.forEach(([stat, label, stem], index) => {
        const isResist = stat === 'elmResUp';
        add({
            id: 1050 + index * 2,
            rank: 35,
            name: `${stem}の霊薬`,
            type: '強化道具',
            effectKind: 'buff',
            buff: { [stat]: isResist ? 50 : 1.5 },
            turn: 4,
            target: '単体',
            battleUsable: true,
            fieldUsable: false,
            price: 2500,
            icon: ICONS.buff,
            desc: `味方単体の${label}を50%上げる（4ターン）`
        });
        add({
            id: 1051 + index * 2,
            rank: 65,
            name: `${stem}の戦香`,
            type: '強化道具',
            effectKind: 'buff',
            buff: { [stat]: isResist ? 30 : 1.3 },
            turn: 4,
            target: '全体',
            battleUsable: true,
            fieldUsable: false,
            price: 15000,
            icon: ICONS.buff,
            desc: `味方全体の${label}を30%上げる（4ターン）`
        });
    });

    add({
        id: 1060,
        rank: 40,
        name: '精霊の野営具',
        type: 'キャンプ',
        effectKind: 'camp',
        target: '全体',
        battleUsable: false,
        fieldUsable: true,
        fieldGroup: true,
        price: 6000,
        desc: '戦闘不能者を蘇生し、味方全員のHP・MPを全回復する。戦闘中は使用不可'
    });
    [
        { id: 1061, stat: 'cri', name: '鷹眼の秘薬', label: '会心率' },
        { id: 1062, stat: 'eva', name: '幻影の秘薬', label: '回避率' }
    ].forEach(def => add({
        id: def.id,
        rank: 85,
        name: def.name,
        type: '強化道具',
        effectKind: 'buff',
        buff: { [def.stat]: 1.3 },
        turn: 2,
        target: '単体',
        battleUsable: true,
        fieldUsable: false,
        medalOnly: true,
        shopAvailable: false,
        price: 0,
        icon: ICONS.buff,
        desc: `味方単体の${def.label}を30%上げる（2ターン）`
    }));

    const DEBUFF_STATS = Object.freeze([
        ['atk', '攻撃', '脱力'],
        ['def', '防御', '軟化'],
        ['mag', '魔力', '忘却'],
        ['mdef', '魔法防御', '破魔'],
        ['elmResDown', '全属性耐性', '無彩']
    ]);
    DEBUFF_STATS.forEach(([stat, label, stem], index) => {
        const isResist = stat === 'elmResDown';
        add({
            id: 1070 + index * 2,
            rank: 40,
            name: `${stem}の呪瓶`,
            type: '弱体道具',
            effectKind: 'debuff',
            debuff: { [stat]: isResist ? 50 : 0.5 },
            successRate: 100,
            turn: 4,
            target: '単体',
            battleUsable: true,
            fieldUsable: false,
            price: 3500,
            icon: ICONS.debuff,
            desc: `敵単体の${label}を50%下げる（4ターン）`
        });
        add({
            id: 1071 + index * 2,
            rank: 70,
            name: `${stem}の呪香`,
            type: '弱体道具',
            effectKind: 'debuff',
            debuff: { [stat]: isResist ? 30 : 0.7 },
            successRate: 100,
            turn: 4,
            target: '全体',
            battleUsable: true,
            fieldUsable: false,
            price: 18000,
            icon: ICONS.debuff,
            desc: `敵全体の${label}を30%下げる（4ターン）`
        });
    });

    const MATERIAL_GRADES = Object.freeze([
        { grade: 'G', rank: 5, sellPrice: 10 },
        { grade: 'F', rank: 15, sellPrice: 30 },
        { grade: 'E', rank: 30, sellPrice: 90 },
        { grade: 'D', rank: 45, sellPrice: 250 },
        { grade: 'C', rank: 60, sellPrice: 700 },
        { grade: 'B', rank: 80, sellPrice: 1800 },
        { grade: 'A', rank: 110, sellPrice: 5000 },
        { grade: 'S', rank: 150, sellPrice: 15000 }
    ]);
    const MATERIAL_CATEGORIES = Object.freeze([
        { key: 'metal', label: '金属', names: ['鉄くず', '青銅鉱', '黒鉄鉱', 'ミスリル鉱', 'オリハルコン片', '星銀鋼', '神鉄インゴット', 'アビスメタル'] },
        { key: 'wood', label: '木材', names: ['枯れ枝', '丈夫な木材', '霊木片', '古代樹材', '世界樹の枝', '天樹材', '神木の芯', '始原樹の心材'] },
        { key: 'magicStone', label: '魔石', names: ['魔石の粉', '小魔石', '精魔石', '輝魔晶', '属性結晶', '虹魔晶', '賢者石片', '混沌核晶'] },
        { key: 'feather', label: '羽', names: ['ぼろ羽', '獣鳥羽', '風切羽', '幻鳥羽', '霊鳥羽', '天馬の羽', '熾天使の羽', '始祖鳥の神羽'] },
        { key: 'claw', label: '爪', names: ['欠けた爪', '鋭い爪', '魔獣爪', '竜牙爪', '獄爪', '古竜爪', '神獣の爪', '深淵竜の剛爪'] },
        { key: 'fur', label: '毛皮', names: ['粗末な毛皮', '獣の毛皮', '魔獣の皮', '霊獣の毛皮', '竜鱗皮', '幻獣の毛皮', '神獣の聖皮', '混沌獣の黒皮'] },
        { key: 'liquid', label: '液体', names: ['濁った粘液', '薬草液', '魔獣の血', '精霊の雫', '竜血', '星露', '神水', '深淵原液'] },
        { key: 'unknown', label: '分類不能', names: ['謎の欠片', '古びた部品', '異形の骨', '呪紋片', '時空の砂', '世界の断片', '神代遺物', '分類不能の黒珠'] }
    ]);

    MATERIAL_CATEGORIES.forEach((category, categoryIndex) => {
        MATERIAL_GRADES.forEach((grade, gradeIndex) => add({
            id: 2000 + categoryIndex * 8 + gradeIndex,
            rank: grade.rank,
            materialRank: grade.grade,
            materialType: category.key,
            materialLabel: category.label,
            name: category.names[gradeIndex],
            type: '素材',
            consumable: false,
            target: 'なし',
            battleUsable: false,
            fieldUsable: false,
            shopAvailable: false,
            price: 0,
            sellPrice: grade.sellPrice,
            icon: ICONS.material,
            desc: `${category.label}系 Rank ${grade.grade} 素材`
        }));
    });

    const combatItems = items.filter(item => Number(item.id) >= 1000 && Number(item.id) < 2000);
    const pickAbyssChestItem = (floor, random = Math.random) => {
        const maxRank = Math.max(1, Number(floor) || 1);
        const eligible = items.filter(item =>
            Number(item.id) !== 99 &&
            item.type !== '貴重品' &&
            item.type !== '乗り物' &&
            item.type !== '移動' &&
            item.medalOnly !== true &&
            Number(item.rank || 1) <= maxRank
        );
        const materials = eligible.filter(item => item.type === '素材');
        const usable = eligible.filter(item => item.type !== '素材');
        const preferMaterials = materials.length > 0 && random() < 0.35;
        const pool = preferMaterials ? materials : (usable.length ? usable : materials);
        return pool.length ? pool[Math.floor(random() * pool.length)] : null;
    };
    window.PRISMA_ITEM_CATALOG = Object.freeze({
        icons: ICONS,
        elements: ELEMENTS,
        materialGrades: MATERIAL_GRADES,
        materialCategories: MATERIAL_CATEGORIES,
        combatItems,
        pickAbyssChestItem,
        getMaterialItemId: (categoryIndex, gradeIndex) => 2000 + categoryIndex * 8 + gradeIndex,
        getMaterialGradeIndexForRank: rank => {
            const value = Math.max(1, Number(rank) || 1);
            if (value <= 10) return 0;
            if (value <= 25) return 1;
            if (value <= 45) return 2;
            if (value <= 65) return 3;
            if (value <= 85) return 4;
            if (value <= 110) return 5;
            if (value <= 150) return 6;
            return 7;
        }
    });
})();
