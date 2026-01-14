/* ==========================================================================
   passiveSkill.js - 特性（パッシブスキル）システム基盤
   ========================================================================== */

const PassiveSkill = {
    /**
     * 特性マスターデータ
     * params: 計算に使用する係数や固定値
     */
    MASTER: {
        1:  { id: 1,  name: '剣', type: '武器', weaponType: '剣', params: { atk_pct: 2, hit_pct: 2 }, effect: '剣装備時にステータスが上昇する', desc: '剣装備時の攻撃力がスキル×2%上昇、命中率がスキル×2%上昇' },
        2:  { id: 2,  name: '槍', type: '武器', weaponType: '槍', params: { atk_pct: 3 }, effect: '槍装備時にステータスが上昇する', desc: '槍装備時の攻撃力がスキル×3%上昇' },
        3:  { id: 3,  name: '斧', type: '武器', weaponType: '斧', params: { atk_pct: 5, def_pct: -3 }, effect: '斧装備時にステータスが上昇する', desc: '斧装備時の攻撃力がスキル×5%上昇、防御力がスキル×3%減少' },
        4:  { id: 4,  name: '短剣', type: '武器', weaponType: '短剣', params: { cri_pct: 2, eva_pct: 2 }, effect: '短剣装備時にステータスが上昇する', desc: '短剣装備時のクリティカル率がスキル×2%上昇、回避率がスキル×2%上昇' },
        5:  { id: 5,  name: '弓', type: '武器', weaponType: '弓', params: { atk_pct: 2, cri_pct: 1, hit_pct: 1 }, effect: '弓装備時にステータスが上昇する', desc: '弓装備時の攻撃力が×2スキル%上昇、クリティカル率がスキル%上昇、命中率がスキル%上昇' },
        6:  { id: 6,  name: '鷹の目', type: '戦闘', weaponType: '弓', params: { dmg_pct: 1, hit_pct: 1 }, effect: '弓装備時にステータスが上昇する', desc: '弓装備時、与ダメージがスキル%上昇、命中率がスキル%上昇' },
        7:  { id: 7,  name: '杖', type: '武器', weaponType: '杖', params: { mag_pct: 3 }, effect: '杖装備時にステータスが上昇する', desc: '杖装備時の魔力がスキル×3%上昇' },
        //8:  { id: 8,  name: 'ニ刀流', type: '戦闘', params: { dual_dmg_base: 50, dual_hit_base: 50 }, effect: '盾装備不可になり、二刀流が可能になる', desc: '盾装備不可で武器を2本装備できるようになり、二刀流時は全ての攻撃スキルが2回発動する。2回目のダメージ・命中率は(スキル×2)+50%' },
		8:  { id: 8,  name: 'ニ刀流', type: '戦闘', params: { dual_dmg_mult: 5, dual_dmg_base: 50, dual_hit_mult: 2, dual_hit_base: 50 }, effect: '盾装備不可になり、二刀流が可能になる', desc: '盾装備不可で武器を2本装備できるようになり、二刀流時は全ての攻撃スキルが2回発動する。2回目のダメージは(スキル×5)+50%、命中率は(スキル×2)+50%' },
        9:  { id: 9,  name: '両手持ち', type: '武器', params: { physical_dmg_pct: 3, hit_pct: 2, cri_pct: 2, two_handed: 1 }, effect: '盾装備が不可になり、両手持ちボーナスを得る', desc: '盾装備不可となり、与ダメージがスキル×3％上昇、命中率がスキル×2%上昇、クリティカル率がスキル×2%上昇' },
        10: { id: 10, name: '武術', type: '戦闘', params: { physical_dmg_pct: 3 }, effect: '物理攻撃が強くなる', desc: '物理攻撃時の与ダメージがスキル×3%上昇' },
        11: { id: 11, name: '呪文', type: '戦闘', params: { magic_dmg_pct: 3 }, effect: '呪文攻撃が強くなる', desc: '呪文攻撃時の与ダメージがスキル×3%上昇' },
        12: { id: 12, name: '息吹', type: '戦闘', params: { breath_dmg_pct: 3 }, effect: 'ブレス攻撃が強くなる', desc: 'ブレス攻撃時の与ダメージがスキル×3%上昇' },
        13: { id: 13, name: '治癒', type: '補助', params: { heal_pct: 5 }, effect: '回復力が強くなる', desc: '回復スキル使用時の回復量がスキル×5%上昇' },
        14: { id: 14, name: '体さばき', type: '補助', params: { eva_pct: 2 }, effect: '敵の攻撃を回避する', desc: '攻撃回避率はスキル×2%' },
        15: { id: 15, name: '頑丈', type: '補助', params: { physical_reduce_pct: 2 }, effect: '敵からの物理ダメージを減らす', desc: '敵からの物理ダメージ減少率はスキル×2%' },
        16: { id: 16, name: '魔法壁', type: '補助', params: { magic_reduce_pct: 2 }, effect: '敵からの呪文ダメージを減らす', desc: '敵からの呪文ダメージ減少率はスキル×2%' },
        17: { id: 17, name: '心頭滅却', type: '補助', params: { breath_reduce_pct: 2, mag_amp_cost_mult: 1 }, effect: '敵からのブレスダメージを減らす', desc: '敵からのブレスダメージ減少率はスキル×2%。特性：魔力増幅（消費MP1.5倍）を伴う' },
        18: { id: 18, name: '根性', type: '補助', params: { guts_rate: 3, guts_base: 20 }, effect: '死亡時に、ギリギリで耐える', desc: '死亡時にギリギリで耐える。発動率は(スキル×3)+20%' },
        19: { id: 19, name: '底力', type: '戦闘', params: { low_hp_dmg_mult: 3, low_hp_dmg_base: 5 }, effect: 'HPが50%以下になると強くなる', desc: '自身のHPが50%以下の時、与ダメージが(スキル×3)+5%上昇' },
        20: { id: 20, name: '冷静', type: '補助', params: { resists_Fear: 2, resists_SkillSeal: 2, resists_SpellSeal: 2, resists_HealSeal: 2, resists_InstantDeath: 2, resists_base: 10 }, effect: '怯え、封印、即死耐性上昇', desc: '怯え、封印、即死耐性を(スキル×2)+10%上昇' },
        21: { id: 21, name: '強靭', type: '補助', params: { resists_Poison: 2, resists_ToxicPoison: 2, resists_Shock: 2, resists_Debuff: 2, resists_base: 10 }, effect: '毒、猛毒、感電、弱体耐性上昇', desc: '毒、猛毒、感電、弱体耐性を(スキル×2)+10%上昇' },
        22: { id: 22, name: '急所狙い', type: '戦闘', params: { cri_pct: 2 }, effect: 'クリティカル率が上昇する', desc: 'クリティカル率がスキル×2%上昇' },
        23: { id: 23, name: '火の扱い', type: '戦闘', params: { fire_pierce_pct: 2 }, effect: '攻撃時の火属性耐性無視', desc: '攻撃時、敵の火属性耐性をスキル×2%無視してダメージを与える' },
        24: { id: 24, name: '水の扱い', type: '戦闘', params: { water_pierce_pct: 2 }, effect: '攻撃時の水属性耐性無視', desc: '攻撃時、敵の水属性耐性をスキル×2%無視してダメージを与える' },
        25: { id: 25, name: '風の扱い', type: '戦闘', params: { wind_pierce_pct: 2 }, effect: '攻撃時の風属性耐性無視', desc: '攻撃時、敵の風属性耐性をスキル×2%無視してダメージを与える' },
        26: { id: 26, name: '雷の扱い', type: '戦闘', params: { thunder_pierce_pct: 2 }, effect: '攻撃時の雷属性耐性無視', desc: '攻撃時、敵の雷属性耐性をスキル×2%無視してダメージを与える' },
        27: { id: 27, name: '光の扱い', type: '戦闘', params: { light_pierce_pct: 2 }, effect: '攻撃時の光属性耐性無視', desc: '攻撃時、敵の光属性耐性をスキル×2%無視してダメージを与える' },
        28: { id: 28, name: '闇の扱い', type: '戦闘', params: { dark_pierce_pct: 2 }, effect: '攻撃時の闇属性耐性無視', desc: '攻撃時、敵の闇属性耐性をスキル×2%無視してダメージを与える' },
        29: { id: 29, name: '混沌の扱い', type: '戦闘', params: { chaos_pierce_pct: 3 }, effect: '攻撃時の混沌属性耐性無視', desc: '攻撃時、敵の混沌属性耐性をスキル×3%無視してダメージを与える' },
        30: { id: 30, name: '解析', type: '戦闘', params: { all_elm_pierce_pct: 2 }, effect: '攻撃時の全属性耐性無視', desc: '攻撃時、敵の全属性耐性をスキル×2%無視してダメージを与える' },
		31: { id: 31, name: '呪い体質', type: '戦闘', params: { proc_curse_add: 1, proc_curse_base: 10 }, effect: '怯え、封印、即死の成功率が上昇する', desc: '怯え、封印、即死の成功率をスキル+10%上昇' },
		32: { id: 32, name: '人体知識', type: '戦闘', params: { proc_body_add: 1, proc_body_base: 10 }, effect: '毒、猛毒、感電、弱体の成功率が上昇する', desc: '毒、猛毒、感電、弱体の成功率をスキル+10%上昇' },
        33: { id: 33, name: '悪魔ばらい', type: '戦闘', params: { anti_demon_pct: 5 }, effect: '不死・魔族へのダメージ上昇', desc: '不死者や魔族への与ダメージがスキル×5%上昇' },
        34: { id: 34, name: '獣狩り', type: '戦闘', params: { anti_beast_pct: 5 }, effect: '動物・獣人へのダメージ上昇', desc: '動物や獣人への与ダメージがスキル×5%上昇' },
        35: { id: 35, name: 'メカニック', type: '戦闘', params: { anti_machine_pct: 5 }, effect: '機械へのダメージ上昇', desc: '機械への与ダメージがスキル×5%上昇' },
        36: { id: 36, name: '竜殺し', type: '戦闘', params: { anti_dragon_pct: 5 }, effect: '竜へのダメージ上昇', desc: '竜への与ダメージがスキル×5%上昇' },
        37: { id: 37, name: '護衛', type: '戦闘', params: { aura_back_def_pct: 5 }, effect: '前列時、後列の防御力上昇', desc: '所持者が前列に配置されている場合、後列の防御力がスキル×5%上昇' },
        38: { id: 38, name: '勇猛', type: '戦闘', params: { aura_front_atk_pct: 2 }, effect: '前列時、前列の攻撃力上昇', desc: '所持者が前列に配置されている場合、前列の攻撃力がスキル×2%上昇' },
        39: { id: 39, name: '応援', type: '戦闘', params: { aura_front_atk_pct: 2 }, effect: '後列時、前列の攻撃力上昇', desc: '所持者が後列に配置されている場合、前列の攻撃力がスキル×2%上昇' },
        40: { id: 40, name: '司令塔', type: '戦闘', params: { aura_front_hit_pct: 2, aura_front_eva_pct: 1 }, effect: '後列時、前列の回避と命中上昇', desc: '所持者が後列に配置されている場合、前列の命中率がスキル×2%上昇、前列の回避率がスキル%上昇' },
        41: { id: 41, name: '警戒', type: '補助', params: { ambush_prevent_pct: 1 }, effect: '敵の不意打ち確率を下げる', desc: '敵の不意打ち確率をスキル%下げる' },
        42: { id: 42, name: '忍び足', type: '補助', params: { ambush_chance_pct: 1 }, effect: '味方の不意打ち確率を上げる', desc: '味方の不意打ち確率がスキル%上昇' },
        43: { id: 43, name: '挑発', type: '防御', params: { target_rate_mult: 3, target_rate_base: 10 }, effect: '敵に狙われやすくなる', desc: '攻撃対象に選ばれる確率が(スキル×3)+10%上昇' },
        44: { id: 44, name: '潜伏', type: '防御', params: { target_rate_mult: -3, target_rate_base: -10 }, effect: '敵に狙われる確率が低下する', desc: '攻撃対象に選ばれる確率を(スキル×3)+10%下げる' },
        45: { id: 45, name: '倍返し', type: '戦闘', params: { revenge_dmg_pct: 1 }, effect: '攻撃を受けた次の攻撃で与ダメージ上昇', desc: '敵から攻撃を受けると、次の攻撃ダメージがスキル%上昇（累積可能）' },
        46: { id: 46, name: '追い討ち', type: '戦闘', params: { chase_rate_mult: 2 }, effect: 'HPの少ない敵に追加攻撃', desc: '敵HPが50%以下の時にスキル×2%で追加攻撃が発動' },
        47: { id: 47, name: '連携', type: '戦闘', params: { chain_rate_mult: 2, chain_rate_base: 10 }, effect: '仲間の攻撃にあわせ追加攻撃する', desc: '仲間が敵へ攻撃した時に、(スキル×2)+10%で追加攻撃する' },
        48: { id: 48, name: '先制', type: '戦闘', weaponTypes: ['槍', '短剣', '弓'], params: { preempt_rate_mult: 1, preempt_rate_base: 5 }, effect: '敵の攻撃より先に追加攻撃する', desc: '槍、短剣、弓装備時、敵に攻撃されそうになった時にスキル+5%で先に攻撃する' },
        49: { id: 49, name: '反撃', type: '戦闘', weaponTypes: ['剣', '斧', '短剣'], params: { counter_rate_mult: 1, counter_rate_base: 5 }, effect: '敵の攻撃を受けた時に反撃する', desc: '剣、斧、短剣装備時、敵からダメージを受けた時にスキル+5%で反撃する' },
        //50: { id: 50, name: '理力の壁', type: '補助', weaponType: '杖', params: { reflect_dmg_mult: 2, reflect_dmg_base: 10, reflect_trigger_base: 5 }, effect: '受けたダメージの一部を反射する', desc: '杖装備時、敵からダメージを受けた時にスキル+5%で発動し、ダメージの(スキル×2)+10%を反射する' },
        50: { id: 50, name: '理力の壁', type: '補助', weaponType: '杖', params: { reflect_dmg_mult: 2, reflect_dmg_base: 10, reflect_trigger_mult: 1, reflect_trigger_base: 5 }, effect: '杖装備時、受けたダメージの一部を反射する', desc: '杖装備時、敵からダメージを受けた時にスキル+5%で発動し、ダメージの(スキル×2)+10%を反射する' },
		51: { id: 51, name: '献身', type: '補助', params: { cover_rate_mult: 5, cover_reduce_mult: 3 }, effect: 'HP50%以下の味方へのダメージを代わりに受ける', desc: 'HP50%以下の味方が狙われた時、スキル×5%でかばう。かばったダメージをスキル×3%減少する' },
        52: { id: 52, name: '再生', type: '補助', params: { turn_hp_regen_pct: 1 }, effect: '戦闘中自身のHPが回復する', desc: '毎ターン終了時に、自身のHPがスキル%回復する' },
        53: { id: 53, name: '魔力循環', type: '補助', params: { turn_mp_regen_pct: 1 }, effect: '戦闘中自身のMPが回復する', desc: '毎ターン終了時に、自身のMPがスキル%回復する' },
        54: { id: 54, name: '応急手当', type: '補助', params: { post_battle_hp_regen_pct: 1 }, effect: '戦闘後パーティのHPが少し回復する', desc: '戦闘終了時に、パーティのHPがスキル%回復する' },
        55: { id: 55, name: '魔力充填', type: '補助', params: { post_battle_mp_regen_pct: 1 }, effect: '戦闘後パーティのMPが少し回復する', desc: '戦闘終了時に、パーティのMPがスキル%回復する' },
        56: { id: 56, name: '解体', type: '補助', params: { drop_normal_pct: 1, drop_rare_pct: 0.5, equip_plus3_pct: 0.33 }, effect: '戦闘後のアイテムドロップ率上昇', desc: '通常ドロップ+スキル%、レアドロップ+スキル/2%、装備の+3確率+スキル/3%上昇' },
        57: { id: 57, name: '目利き', type: '補助', params: { drop_normal_pct: 1, drop_rare_pct: 0.5, equip_plus3_pct: 0.33 }, effect: '戦闘後のアイテムドロップ率上昇', desc: '通常・レアドロップ、および宝箱から+3装備が出る確率が上昇する' },
        58: { 
				id: 58, 
				name: '大器晩成', 
				type: '補助', 
				// params を修正: exp_bonus_pct(メリット) から exp_need_mult(デメリット) へ変更
				params: { exp_need_mult: 5, stat_bonus_mult: 0.1 }, 
				effect: 'レベルが上がりにくくなるが、成長率が大きく上昇する', 
				desc: 'レベルアップに必要な経験値がスキル×5%増加するが、レベルアップ時のステータス上昇量にスキル×10%のボーナスを得る' 
			},
        59: { id: 59, name: '武の極み', type: '戦闘', params: { atk_growth_bonus: 3, def_growth_bonus: 3 }, effect: '物理アタッカーの素質', desc: '攻撃力と防御力の成長率がスキル×5%上昇する' },
        60: { id: 60, name: '魔の極み', type: '戦闘', params: { mag_growth_bonus: 3, mdef_growth_bonus: 3 }, effect: '魔導師の素質', desc: '魔力と魔法防御の成長率がスキル×5%上昇する' }
    }
};

/**
 * キャラクターが新しい特性を習得できるかチェックし、習得させる
 * @param {Object} char - App.data.characters内のキャラデータ
 */
PassiveSkill.applyLevelUpTraits = function(char) {
    if (!char.traits) char.traits = [];

    // 現在の合計特性レベルを計算
    const totalTraitLv = char.traits.reduce((sum, t) => sum + (t.level || 0), 0);
    const traitCount = char.traits.length;

    // 指示書に基づく習得条件 [必要レベル, 必要合計特性Lv]
    const conditions = [
        { lv: 1,  total: 0 },  // 1つ目
        { lv: 5,  total: 1 },  // 2つ目
        { lv: 10, total: 2 },  // 3つ目
        { lv: 20, total: 8 },  // 4つ目
        { lv: 40, total: 15 }, // 5つ目
        { lv: 80, total: 22 }  // 6つ目
    ];

    let learnedSomething = false;

    // 現在のスロット数に対応する条件を確認
    if (traitCount < conditions.length) {
        const cond = conditions[traitCount];
        
        if (char.level >= cond.lv && totalTraitLv >= cond.total) {
            // キャラクター固定データの参照 (CHARACTERS_DATA)
            const masterChar = (window.CHARACTERS_DATA || []).find(c => c.id === char.charId);
            const fixedTraits = (masterChar && masterChar.fixedTraits) ? masterChar.fixedTraits : [];

            let newTraitId = null;

            if (fixedTraits[traitCount]) {
                // 固定特性がある場合はそれを取得
                newTraitId = fixedTraits[traitCount];
            } else {
                // 固定がない場合はランダム取得
                if (traitCount === 1) { // 2つ目(index 1)は武器特性
                    newTraitId = PassiveSkill.getRandomTraitId('武器');
                } else if (traitCount === 2) { // 3つ目(index 2)は戦闘特性
                    newTraitId = PassiveSkill.getRandomTraitId('戦闘');
                } else {
                    newTraitId = PassiveSkill.getRandomTraitId();
                }
            }
			
            if (newTraitId) {
                // 重複習得を避けるチェック（既存にあればレベルアップ扱いにするかスキップ）
                if (char.traits.find(t => t.id === newTraitId)) return null;

                char.traits.push({ id: newTraitId, level: 1, battleCount: 0 }); // battleCountを初期化
                const m = PassiveSkill.MASTER[newTraitId];
                // ★修正: ログにキャラ名を追加
                return `<span style="color:#00ffff;">【${char.name}】は 新たな特性【${m.name}】を習得した！</span>`;
            }
        }
    }
    return null;
};

/**
 * 指定されたカテゴリからランダムに特性IDを返す
 */
PassiveSkill.getRandomTraitId = function(category = null) {
    let ids = Object.keys(PassiveSkill.MASTER).map(Number);
    if (category) {
        ids = ids.filter(id => PassiveSkill.MASTER[id].type === category);
    }
    if (ids.length === 0) return 1; 
    return ids[Math.floor(Math.random() * ids.length)];
};

/**
 * 戦闘終了時の特性成長判定
 * 確率式: 1 + (蓄積戦闘回数 / (現在Lv * 2)) %
 */
PassiveSkill.checkTraitGrowth = function(char) {
    if (!char.traits || char.traits.length === 0 || char.isDead) return null;
    
    let growthLogs = [];

    char.traits.forEach(trait => {
        // 最大レベル(10)に達している場合はスキップ
        if (trait.level >= 10) return;

        // 特性ごとの戦闘回数を加算（未定義なら1で初期化）
        trait.battleCount = (trait.battleCount || 0) + 1;

        // 確率の計算: 1 + (戦闘回数 / (レベル * 2))
        const chance = 1 + (trait.battleCount / (trait.level * 2));

        // 判定実行
        if (Math.random() * 100 < chance) {
            trait.level++;
            trait.battleCount = 0; // レベルアップしたのでリセット

            const m = PassiveSkill.MASTER[trait.id];
            if (m) {
                growthLogs.push(`<span style="color:#ffd700;">${char.name}の特性【${m.name}】がLv${trait.level}に上がった！</span>`);
            }
        }
    });

    // 複数の特性が同時に上がる可能性を考慮し、改行で繋いで返す（1つも上がらなければnull）
    return growthLogs.length > 0 ? growthLogs.join('<br>') : null;
};

/**
 * 装備品（+3）に付与される特性をランダム生成する（キャラとは別計算用）
 * @returns {Array} 特性オブジェクトの配列 [{id, level}, ...]
 */
PassiveSkill.generateEquipmentTraits = function() {
    const traits = [];
    // 0〜2つ付与
    const count = Math.floor(Math.random() * 3);
    
    for (let i = 0; i < count; i++) {
        const id = PassiveSkill.getRandomTraitId();
        const lv = Math.floor(Math.random() * 3) + 1; // Lv 1〜3
        if (!traits.find(t => t.id === id)) {
            traits.push({ id: id, level: lv });
        }
    }
    return traits;
};

/**
 * 特定の補正項目の合計値を算出する
 * @param {Object} entity - 計算対象のキャラデータ
 * @param {string} key - 取得したいパラメータキー
 * @returns {number} 合算された補正値
 */
/* passiveSkill.js: PassiveSkill.getSumValue */
PassiveSkill.getSumValue = function(entity, key) {
    let total = 0;
    // 特性IDごとの合計レベルを算出するマップ
    const traitLvlMap = {};

    // 1. キャラクター自身の特性 (習得分：有効なもののみ)
    if (entity.traits) {
        entity.traits.forEach(t => {
            if (entity.disabledTraits && entity.disabledTraits.includes(t.id)) return;
            traitLvlMap[t.id] = (traitLvlMap[t.id] || 0) + (t.level || 0);
        });
    }

    // 2. 装備品の特性 (装備分：常に有効)
    if (entity.equips) {
        Object.values(entity.equips).forEach(eq => {
            if (eq && eq.traits) {
                eq.traits.forEach(t => {
                    traitLvlMap[t.id] = (traitLvlMap[t.id] || 0) + (t.level || 0);
                });
            }
        });
    }

    // 3. 各特性の値を集計 (加算されたLvを使用)
    for (let id in traitLvlMap) {
        const lv = traitLvlMap[id];
        const m = PassiveSkill.MASTER[id];
        if (!m || !m.params) continue;

        const p = m.params;

        // 武器条件チェック
        if (m.weaponType && entity.weaponType !== m.weaponType) continue;
        if (p.weaponTypes && !p.weaponTypes.includes(entity.weaponType)) continue;

        // --- A. 通常のキー合算（耐性・ステ補正など） ---
        if (p[key] !== undefined) {
            total += p[key] * lv;
            // _mult, _pct 等の場合に対応する _base を一度だけ加算
            if (!key.endsWith('_base')) {
                const baseKey = key.replace(/(_mult|_rate|_add|_pct)$/, '_base');
                if (p[baseKey] !== undefined) total += p[baseKey];
            }
        }

        // --- B. 特殊計算セクション ---
        // ID 18: 根性 (guts_rate)
        if (key === 'guts_rate' && Number(id) === 18) {
            total += (p.guts_rate * lv) + p.guts_base;
        }
        // ID 31: 呪い体質
        if (key === 'proc_curse_bonus' && Number(id) === 31) {
            total += (p.proc_curse_add * lv) + p.proc_curse_base;
        }
        // ID 32: 人体知識
        if (key === 'proc_body_bonus' && Number(id) === 32) {
            total += (p.proc_body_add * lv) + p.proc_body_base;
        }
    }
    return total;
};


PassiveSkill.getPartySumValue = function(key) {
    let total = 0;
    if (!App.data || !App.data.party) return 0;
    const partyMembers = App.data.party.map(uid => App.data.characters.find(c => c.uid === uid)).filter(c => c);

    partyMembers.forEach(c => {
        const traitLvlMap = {};
        if (c.traits) {
            c.traits.forEach(t => {
                if (c.disabledTraits && c.disabledTraits.includes(t.id)) return;
                traitLvlMap[t.id] = (traitLvlMap[t.id] || 0) + (t.level || 0);
            });
        }
        if (c.equips) {
            Object.values(c.equips).forEach(eq => {
                if (eq && eq.traits) {
                    eq.traits.forEach(t => {
                        traitLvlMap[t.id] = (traitLvlMap[t.id] || 0) + (t.level || 0);
                    });
                }
            });
        }
        for (let id in traitLvlMap) {
            const lv = traitLvlMap[id];
            const master = PassiveSkill.MASTER[id];
            if (master && master.params && master.params[key] !== undefined) {
                total += master.params[key] * lv;
            }
        }
    });
    return total;
};

/**
 * 編成中のパーティメンバーから、特定の特性キーの合計値を算出する
 * 集計対象は現在パーティに編成されている（App.data.partyに含まれる）キャラのみです。
 * @param {string} key - 集計する特性のキー（aura_atk, mekiki, kaitai, drop_rare_pct 等）
 * @returns {number} 合計値
 */
PassiveSkill.getPartySumValue = function(key) {
    let total = 0;
    
    // 1. App.data.party (UID配列) から現在編成中のキャラを抽出
    if (!App.data || !App.data.party) return 0;
    const partyMembers = App.data.party
        .map(uid => App.data.characters.find(c => c.uid === uid))
        .filter(c => c); // 存在するキャラのみ

    partyMembers.forEach(c => {
        // --- 習得済みの特性 ---
        if (c.traits) {
            c.traits.forEach(t => {
                // ★重要: OFFにされている特性は除外
                if (c.disabledTraits && c.disabledTraits.includes(t.id)) return;
                
                const master = PassiveSkill.MASTER[t.id];
                // マスタの params 内に指定されたキーが存在するかチェック
                if (master && master.params && master.params[key] !== undefined) {
                    total += master.params[key] * t.level;
                }
            });
        }

        // --- 装備品に付与されている特性 ---
        if (c.equips) {
            Object.values(c.equips).forEach(eq => {
                if (eq && eq.traits) {
                    eq.traits.forEach(t => {
                        const master = PassiveSkill.MASTER[t.id];
                        if (master && master.params && master.params[key] !== undefined) {
                            total += master.params[key] * t.level;
                        }
                    });
                }
            });
        }
    });

    return total;
};

/**
 * 表示用の全特性リストを取得 (習得済み -> 装備品の順)
 */
PassiveSkill.getFullTraitList = function(char) {
    let list = [];

    // 1. 本人が習得している特性 (習得順)
    if (char.traits) {
        char.traits.forEach(t => {
            list.push({ ...t, source: 'learned' });
        });
    }

    // 2. 装備品についている特性
    if (char.equips) {
        Object.values(char.equips).forEach(eq => {
            if (eq && eq.traits) {
                eq.traits.forEach(t => {
                    list.push({ ...t, source: 'equipment', fromName: eq.name });
                });
            }
        });
    }
    return list;
};