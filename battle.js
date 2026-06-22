/* battle.js (AI行動ロジック刷新版: 条件・制約・確率抽選対応) */

const Battle = {
    active: false,
    auto: false,
    phase: 'init',
    party: [],
    enemies: [],
    commandQueue: [], 
    currentActorIndex: 0, 
    selectingAction: null, 
    selectedItemOrSkill: null,
	runAttemptCount: 0, // ★追加: 逃走試行回数
    
    // ステータス表示名マッピング
    statNames: {
        atk: '攻撃力', def: '守備力', spd: '素早さ', mag: '魔力', mdef: '魔法防御',
        elmResUp: '全属性耐性', elmResDown: '全属性耐性',
        Poison: '毒', ToxicPoison: '猛毒', Shock: '感電', Fear: '怯え',
        SpellSeal: '呪文封印', SkillSeal: '特技封印', HealSeal: '回復封印',HPRegen: 'HP回復' ,MPRegen: 'MP回復',
        InstantDeath: '即死', 
        Debuff: '弱体',
        Seal: '封印',
		resists_Poison: '毒耐性',
		resists_Shock: '感電耐性',
		resists_Fear: '怯え耐性',
		resists_Seal: '封印耐性',
		resists_InstantDeath: '即死耐性',
		resists_Debuff: '弱体耐性'
    },
    
    // 状態異常と耐性IDの対応表 (拡張)
    RESIST_MAP: {
        Poison: 'Poison', ToxicPoison: 'Poison',
        Shock: 'Shock',
        Fear: 'Fear',
        SpellSeal: 'SpellSeal', 
        SkillSeal: 'SkillSeal', 
        HealSeal: 'HealSeal',
        PercentDamage: 'InstantDeath', // 指示通り即死ガードで割合ダメも防ぐ
        InstantDeath: 'InstantDeath',
        Debuff: 'Debuff',
        elmResDown: 'Debuff'          // 全属性耐性低下も弱体耐性を参照
    },


    // マダンテ系はID再編後も専用MP処理が必要。範囲判定ではなく明示IDで扱う。
    MADANTE_SKILL_IDS: new Set([245, 246, 247]),
    isMadanteSkillId: (id) => Battle.MADANTE_SKILL_IDS.has(Number(id)),
    isMadanteSkill: (data) => data && Battle.isMadanteSkillId(data.id),

    getEl: (id) => document.getElementById(id),
    
	// ★追加: モンスター名を赤字にするヘルパー関数
    getColoredName: (actor) => {
        if (actor instanceof Monster) {
            return `<span style="color:#ff4444; font-weight:bold;">${actor.name}</span>`;
        }
        return `${actor.name}`;
    },

    // ★追加: スキルが補助（回復・蘇生・強化等）かどうかを判定する
    isSupportSkill: (d) => {
        if (!d) return false;
        const type = d.type || '';
        if (['回復', '蘇生', '強化', 'MP回復'].includes(type)) return true;
        if (d.debuff_reset || d.CureAilments || d.HPRegen || d.MPRegen) return true;
        return false;
    },

    // 最大ダメージ記録の共通処理。
    // ストーリー演出用の一時LB99中も、裏技的な達成として記録対象にする。
    recordMaxDamage: (actor, skillData, dmg, cmd = {}) => {
        if (cmd && cmd.isEnemy) return;
        if (!Number.isFinite(Number(dmg)) || Number(dmg) <= 0) return;
        if (Number(dmg) > (App.data.stats.maxDamage?.val || 0)) {
            App.data.stats.maxDamage = {
                val: Number(dmg),
                actor: actor?.name || '不明',
                actorLv: actor?.level || null,
                skill: skillData ? skillData.name : '通常攻撃',
                time: Date.now()
            };
        }
    },

    getBattleSpeedSetting: () => {
        if (typeof App !== 'undefined' && typeof App.getBattleSpeedSetting === 'function') {
            return App.getBattleSpeedSetting();
        }
        const speed = App?.data?.settings?.battleSpeed || 'normal';
        return ['normal', 'fast', 'fastest'].includes(speed) ? speed : 'normal';
    },

    getBattleWaitMs: (ms) => {
        const base = Math.max(0, Math.floor(Number(ms) || 0));
        const speed = Battle.getBattleSpeedSetting();
        if (speed === 'fastest') return 0;
        if (speed === 'fast') return Math.floor(base * 0.35);
        return base;
    },

    schedule: (fn, ms) => setTimeout(fn, Battle.getBattleWaitMs(ms)),

    getAutoStartSetting: () => {
        if (typeof App !== 'undefined' && typeof App.getBattleAutoStartSetting === 'function') {
            return App.getBattleAutoStartSetting();
        }
        return App?.data?.settings?.battleAutoStart === true;
    },

    init: () => {
        Battle.active = true;
        Battle.phase = 'init';
        Battle.commandQueue = [];
        Battle.currentActorIndex = 0;
        Battle.auto = Battle.getAutoStartSetting();
        Battle.runAttemptCount = 0; 
        Battle.skillScrollPositions = {};
        Battle.updateAutoButton();
        Battle.resultProcessing = false;
        Battle.resultReadyToEnd = false;
        Battle.resultSkipRequested = false;
        Battle.resultWaiters = [];
        
        const logEl = Battle.getEl('battle-log');
        if(logEl) logEl.innerHTML = '';

        // 背景管理
        const enemyArea = document.getElementById('enemy-container');
        if (enemyArea) {
            const bgKey = Field.getBattleBg();
            const g = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};

            if (g[bgKey]) {
                enemyArea.style.backgroundImage = `url('${g[bgKey].src}')`;
                enemyArea.style.backgroundSize = 'cover';
                enemyArea.style.backgroundPosition = 'center bottom';
                enemyArea.style.backgroundRepeat = 'no-repeat';
            } else {
                enemyArea.style.backgroundColor = '#222';
                enemyArea.style.backgroundImage = 'none';
            }
        }
        
        // パーティ生成
        Battle.party = [];
        if (App.data && App.data.party) {
            Battle.party = App.data.party.map(uid => {
                if(!uid) return null;
                const charData = App.getChar(uid);
                if(!charData) return null;
                const player = new Player(charData);
                const stats = App.calcStats(charData);
				
				// ★追加：calcStats が作った weaponTypes / weaponType を battle用インスタンスへ引き継ぐ
				player.weaponTypes = charData.weaponTypes || [];
				player.weaponType  = charData.weaponType  || '素手';
				
                player.hp = Math.min(player.hp, stats.maxHp);
                player.mp = Math.min(player.mp, stats.maxMp);
                player.baseMaxHp = stats.maxHp; player.baseMaxMp = stats.maxMp;
                player.atk = stats.atk; player.def = stats.def; player.spd = stats.spd; player.mag = stats.mag;
                player.elmAtk = stats.elmAtk || {}; player.elmRes = stats.elmRes || {};
                player.finDmg = stats.finDmg || 0; player.finRed = stats.finRed || 0;
                player.passive = Battle.getPassives(player);
                
                // シナジー付与スキル習得
                if (player.equips) {
                    Object.values(player.equips).forEach(eq => {
                        if (eq && eq.isSynergy && eq.effects) {
                            const grantSyn = eq.synergies?.find(s => s.effect === 'grantSkill');
                            if (grantSyn && grantSyn.value) {
                                if (!player.skills.find(s => s.id === grantSyn.value)) {
                                    const newSkill = DB.SKILLS.find(s => s.id === grantSyn.value);
                                    if (newSkill) player.skills.push(newSkill);
                                }
                            }
                        }
                    });
                }
				
				// ★追加：装備固有スキル付与
				if (player.equips) {
				  Object.values(player.equips).forEach(eq => {
					if (!eq || !eq.grantSkills) return;
					eq.grantSkills.forEach(skillId => {
					  if (!player.skills.find(s => s.id === skillId)) {
						const sk = DB.SKILLS.find(s => s.id === skillId);
						if (sk) player.skills.push(sk);
					  }
					});
				  });
				}
				
                if (charData.battleStatus) player.battleStatus = JSON.parse(JSON.stringify(charData.battleStatus));
                else Battle.initBattleStatus(player);

                if (player.passive.warGod) { player.battleStatus.buffs['atk'] = { val: 1.5, turns: null }; player.battleStatus.buffs['mag'] = { val: 1.5, turns: null }; }
                if (player.passive.atkDouble) player.battleStatus.buffs['atk'] = { val: 2.0, turns: null };
                if (player.passive.magDouble) player.battleStatus.buffs['mag'] = { val: 2.0, turns: null };
                return player;
            }).filter(p => p !== null);
        }

        if (Battle.party.length === 0 || Battle.party.every(p => p.isDead)) {
            App.log("戦えるメンバーがいません！");
            Battle.endBattle(true); return;
        }

        // 敵の生成フラグ取得
        const isBoss = (App.data.battle && App.data.battle.isBossBattle) || false;
        const isEstark = (App.data.battle && App.data.battle.isEstark) || false;
        const isSpecialBoss = (App.data.battle && (App.data.battle.isSpecialBoss || App.data.battle.isEstark)) || false;
        const fixedId = (App.data.battle && App.data.battle.fixedBossId) ? App.data.battle.fixedBossId : null;
        // ★追加: StoryManager由来のeventIdを保持
        const eventId = (App.data.battle && App.data.battle.eventId) ? App.data.battle.eventId : null;
        const keyReward = App.data.battle?.keyReward || App.data.battle?.fixedKeyReward || null;

        if (App.data.battle && App.data.battle.active && App.data.battle.enemies?.length > 0) {
            //Battle.log("戦闘に復帰した！");
            Battle.enemies = App.data.battle.enemies.map(e => {
                let base = Battle.getMonsterBaseById(e.baseId);
                if (!base) return null;
                const m = new Monster(base, 1.0);
                m.hp = e.hp; m.baseMaxHp = e.maxHp; m.name = e.name; m.id = e.baseId; m.isDead = m.hp <= 0;
                m.baseId = e.baseId;
                m.rank = e.rank || e.generatedFloor || base.generatedFloor || base.rank || base.minF || 1;
                m.generatedFloor = e.generatedFloor || base.generatedFloor || null;
                m.isBoss = e.isBoss || base.isBoss || false;
                m.isRare = e.isRare || base.isRare || false;
                m.isEstark = e.isEstark || base.isEstark || false;
                m.isSpecialBoss = e.isSpecialBoss || base.isSpecialBoss || base.isEstark || Number(e.baseId) === 902000;
                m.isStoryBoss = Battle.isStoryBossBase(base);
                // ステータス適用の安全策
                m.atk = m.baseStats?.atk || base.atk; m.def = m.baseStats?.def || base.def; 
                m.spd = m.baseStats?.spd || base.spd; m.mag = m.baseStats?.mag || base.mag;
                m.elmAtk = JSON.parse(JSON.stringify(base.elmAtk || {})); m.elmRes = JSON.parse(JSON.stringify(base.elmRes || {}));
                m.passive = base.passive || {};
                m.battleStatus = e.battleStatus || { buffs:{}, debuffs:{}, ailments:{} };
                return m;
            }).filter(enemy => enemy !== null);
        } else {
            Battle.enemies = Battle.generateNewEnemies(isBoss || isSpecialBoss, fixedId);
            Battle.enemies.forEach(e => Battle.initBattleStatus(e));
            
            // 生成された敵データと共に eventId も保存
            // ★不意打ち・先制フラグを App.data.battle から Battle オブジェクトへ継承
            Battle.isAmbushed = App.data.battle?.isAmbushed || false;
            Battle.isPreemptive = App.data.battle?.isPreemptive || false;

            App.data.battle = { 
                // StoryManager / Dungeon が戦闘開始前に積んだ勝敗後イベント情報を落とさない
                ...(App.data.battle || {}),

                active: true, 
                isBossBattle: isBoss || isSpecialBoss, 
                isSpecialBoss: isSpecialBoss, 
                isEstark: isEstark || isSpecialBoss, 
                fixedBossId: fixedId, 
                eventId: eventId, 
                keyReward: keyReward,
                isAmbushed: Battle.isAmbushed, // フラグ維持用
                isPreemptive: Battle.isPreemptive,
                enemies: Battle.enemies.map(e => ({ baseId: e.baseId || e.id, hp: e.hp, maxHp: e.baseMaxHp, name: e.name, rank: e.rank, generatedFloor: e.generatedFloor, isBoss: e.isBoss, isRare: e.isRare, isSpecialBoss: e.isSpecialBoss, isEstark: e.isEstark, battleStatus: e.battleStatus })) 
            };
            App.save();
        }

        // ★追加: 戦闘開始時の特殊状況ログ表示
        if (Battle.isAmbushed) {
            Battle.log(`<span style="color:#ff4444; font-weight:bold;">まものの むれに ふいうちを うけた！</span>`);
        } else if (Battle.isPreemptive) {
            Battle.log(`<span style="color:#44ff44; font-weight:bold;">まものの むれを さきに みつけた！</span>`);
        }

        Battle.renderEnemies(); Battle.renderPartyStatus();
        const scene = document.getElementById('battle-scene');
        if(scene) scene.onclick = () => { if (Battle.phase === 'result') Battle.handleResultTap(); };

        // ★修正: 不意打ちの場合は入力フェーズを飛ばして即ターン実行へ
        // それ以外（通常・先制攻撃）は入力を受け付ける
        if (Battle.isAmbushed) {
            Battle.schedule(() => {
                if (Battle.active) Battle.executeTurn();
            }, 1000);
        } else {
            Battle.startInputPhase();
        }
    },
	
    getPassives: (actor) => {
        let passives = {};
        if (actor.tree) {
            for (let key in actor.tree) {
                const level = actor.tree[key];
                const treeDef = CONST.SKILL_TREES[key];
                if (treeDef) {
                    for (let i = 0; i < level; i++) {
                        const step = treeDef.steps[i];
                        if (step.passive) passives[step.passive] = true;
                    }
                }
            }
        }
        if (actor.equips) {
            Object.values(actor.equips).forEach(eq => {
                if (eq && typeof App.checkSynergy === 'function') {
                    const syns = App.checkSynergy(eq); // 配列で取得
                    syns.forEach(syn => {
                        if (syn && syn.effect) passives[syn.effect] = true;
                    });
                }
            });
        }
        return passives;
    },
	
    initBattleStatus: (actor) => {
        actor.battleStatus = { buffs: {}, debuffs: {}, ailments: {} };
    },

    // ★修正: ステータス取得時にシナジー補正を適用
    getBattleStat: (actor, key) => {
        // 基礎値の取得。mdefが未定義または0なら、magの0.8倍を代用（主にモンスター用）
		let val = (actor[key] !== undefined && actor[key] !== 0) ? actor[key] : 
				  (key === 'mdef' && actor['mag']) ? Math.floor(actor['mag'] * 0.8) : (actor[key] || 0);
        
        // ★修正点: オブジェクト（resistsやelmRes）が空の場合、または数値が0の場合に getStat を呼び出す
        // これにより、装備やシナジーによる耐性補正が val に格納されます
        const isEmptyObject = (typeof val === 'object' && val !== null && Object.keys(val).length === 0);
        if ((val === 0 || isEmptyObject) && typeof actor.getStat === 'function') {
            val = actor.getStat(key);
        }

        // ★修正点: maxHp / maxMp も計算済みステータス (getStat) を参照するように変更
        // これにより、限界突破や装備によるHP/MP上昇が戦闘に反映されます
        if (key === 'maxHp' || key === 'maxMp') {
            if (typeof actor.getStat === 'function') {
                val = actor.getStat(key);
            } else {
                val = (key === 'maxHp') ? actor.baseMaxHp : actor.baseMaxMp;
            }
        }

        // ★修正: 耐性取得時、戦闘中のバフ・デバフ（resists_XXX）を合算する
        if (key === 'resists') {
            // val には既に装備込みの耐性が取得されているため、それをベースにする
            const base = val || {};
            const res = { ...base }; 

            if (actor.battleStatus && actor.battleStatus.buffs) {
                for (let bKey in actor.battleStatus.buffs) {
                    if (bKey.startsWith('resists_')) {
                        const ailment = bKey.replace('resists_', '');
                        res[ailment] = (res[ailment] || 0) + actor.battleStatus.buffs[bKey].val;
                    }
                }
            }

            if (actor.battleStatus && actor.battleStatus.debuffs) {
                for (let dKey in actor.battleStatus.debuffs) {
                    if (dKey.startsWith('resists_')) {
                        const ailment = dKey.replace('resists_', '');
                        res[ailment] = (res[ailment] || 0) - actor.battleStatus.debuffs[dKey].val;
                    }
                }
            }
            return res;
        }

        const b = actor.battleStatus;
        if (!b) return val;
        
        if (b.buffs[key]) val = Math.floor(val * b.buffs[key].val);
        if (b.debuffs[key]) val = Math.floor(val * b.debuffs[key].val);
        return val;
    },
	
	/**
     * 新規モンスターの生成 (特性・新ステータス・ドロップ・フラグ対応版)
     **/
    cloneMonsterBase: (base) => {
        if (!base) return null;
        if (window.MonsterData && typeof window.MonsterData.cloneMonsterData === 'function') {
            return window.MonsterData.cloneMonsterData(base);
        }
        return JSON.parse(JSON.stringify(base));
    },

    getMonsterBaseById: (id) => {
        const numericId = Number(id);
        if (!Number.isFinite(numericId)) return null;
        const base = (window.MonsterData && typeof window.MonsterData.getMonsterById === 'function')
            ? window.MonsterData.getMonsterById(numericId)
            : (DB.MONSTERS || []).find(m => Number(m.id) === numericId);
        return Battle.cloneMonsterBase(base);
    },

    getMonsterBasesByIds: (ids) => {
        const idList = Array.isArray(ids) ? ids : [ids];
        if (window.MonsterData && typeof window.MonsterData.getBossesByIds === 'function') {
            const bosses = window.MonsterData.getBossesByIds(idList);
            if (bosses && bosses.length > 0) return bosses;
        }
        return idList.map(id => Battle.getMonsterBaseById(id)).filter(Boolean);
    },

    isSpecialBossBase: (base) => !!(base && (base.isSpecialBoss || base.isEstark || Number(base.id) === 902000)),
    isNormalEncounterBase: (base) => !!(base && !base.isBoss && !base.isRare && !Battle.isSpecialBossBase(base)),
    isStoryBossBase: (base) => {
        if (!base) return false;
        const id = Number(base.id ?? base.baseId);
        return !!(base.isStoryBoss || base.storyOnly || (id >= 301000 && id < 400000));
    },

    getEquipmentRewardFloor: (enemy, fallbackFloor = 1) => {
        const base = Battle.getMonsterBaseById(enemy?.baseId || enemy?.id) || {};
        const raw = enemy?.generatedFloor ?? enemy?.rewardRank ?? enemy?.rank ?? base.generatedFloor ?? base.rewardRank ?? base.rank ?? base.minF ?? fallbackFloor;
        return Math.max(1, Math.floor(Number(raw) || Number(fallbackFloor) || 1));
    },

    setupEnemyStats: (m, base, isBossBattle = false) => {
        if (!m || !base) return m;
        m.atk = m.baseStats?.atk || base.atk || m.atk;
        m.def = m.baseStats?.def || base.def || m.def;
        m.spd = m.baseStats?.spd || base.spd || m.spd;
        m.mag = m.baseStats?.mag || base.mag || m.mag;
        m.mdef = base.mdef || m.mdef || 0;
        m.hit = base.hit || 100;
        m.eva = base.eva || 0;
        m.cri = base.cri || 0;
        m.id = base.id;
        m.baseId = base.id;
        m.rank = base.rank || base.generatedFloor || base.minF || m.rank || 1;
        m.minF = base.minF || m.minF || m.rank;
        m.generatedFloor = base.generatedFloor || m.generatedFloor || null;
        m.isBoss = base.isBoss || isBossBattle || false;
        m.isRare = base.isRare || false;
        m.isEstark = base.isEstark || false;
        m.isSpecialBoss = base.isSpecialBoss || base.isEstark || Number(base.id) === 902000;
        m.isStoryBoss = Battle.isStoryBossBase(base);
        m.race = base.race || '\u4e0d\u660e';
        m.drops = JSON.parse(JSON.stringify(base.drops || null));
        m.traits = JSON.parse(JSON.stringify(base.traits || []));
        m.elmAtk = JSON.parse(JSON.stringify(base.elmAtk || {}));
        m.elmRes = JSON.parse(JSON.stringify(base.elmRes || {}));
        m.image = base.image || base.img || m.image || null;
        m.finDmg = 0;
        m.finRed = 0;

        if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue) {
            const atkPct  = PassiveSkill.getSumValue(m, 'atk_pct');
            const defPct  = PassiveSkill.getSumValue(m, 'def_pct');
            const magPct  = PassiveSkill.getSumValue(m, 'mag_pct');
            const mdefPct = PassiveSkill.getSumValue(m, 'mdef_pct');
            const spdPct  = PassiveSkill.getSumValue(m, 'spd_pct');

            if (atkPct !== 0)  m.atk  = Math.floor(m.atk  * (1 + atkPct / 100));
            if (defPct !== 0)  m.def  = Math.floor(m.def  * (1 + defPct / 100));
            if (magPct !== 0)  m.mag  = Math.floor(m.mag  * (1 + magPct / 100));
            if (mdefPct !== 0) m.mdef = Math.floor(m.mdef * (1 + mdefPct / 100));
            if (spdPct !== 0)  m.spd  = Math.floor(m.spd  * (1 + spdPct / 100));

            m.hit += PassiveSkill.getSumValue(m, 'hit_pct');
            m.eva += PassiveSkill.getSumValue(m, 'eva_pct');
            m.cri += PassiveSkill.getSumValue(m, 'cri_pct');
        }

        return m;
    },

    createMonsterFromBase: (base, options = {}) => {
        const clone = Battle.cloneMonsterBase(base);
        if (!clone) return null;
        const m = new Monster(clone, options.scale || 1.0);
        m.name = options.name || clone.name || m.name;
        m.id = clone.id;
        m.baseId = clone.id;
        m.actCount = clone.actCount || 1;
        Battle.setupEnemyStats(m, clone, !!options.isBossBattle);
        if (options.forceSpecialBoss) {
            m.isSpecialBoss = true;
            m.isEstark = clone.isEstark || true;
        }
        return m;
    },

    applyRiftEnemyBoost: (enemy) => {
        if (!enemy) return enemy;
        const scaleNumber = (value, rate, min = 0) => {
            const n = Number(value || 0);
            if (!Number.isFinite(n)) return value;
            const scaled = Math.floor(n * rate);
            return Math.max(min, scaled);
        };

        enemy.isRiftEnemy = true;
        enemy.hp = scaleNumber(enemy.hp, 1.5, 1);
        enemy.baseMaxHp = scaleNumber(enemy.baseMaxHp || enemy.hp, 1.5, enemy.hp);
        enemy.mp = scaleNumber(enemy.mp, 1.1, 0);
        enemy.baseMaxMp = scaleNumber(enemy.baseMaxMp || enemy.mp, 1.1, enemy.mp);

        if (enemy.baseStats) {
            ['atk', 'def', 'spd', 'mag'].forEach(key => {
                enemy.baseStats[key] = scaleNumber(enemy.baseStats[key], 1.1, 0);
            });
        }
        ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
            if (enemy[key] !== undefined) enemy[key] = scaleNumber(enemy[key], 1.1, 0);
        });

        return enemy;
    },

    applyMapEnemyBoost: (enemy, boost) => {
        if (!enemy || !boost || enemy.isRare) return enemy;
        const scale = Math.max(0.1, Number(boost.statMultiplier || boost.scale || 1) || 1);
        const scaleNumber = (value, rate, min = 0) => {
            const n = Number(value || 0);
            if (!Number.isFinite(n)) return value;
            return Math.max(min, Math.floor(n * rate));
        };

        if (boost.nameSuffix && !String(enemy.name || '').endsWith(boost.nameSuffix)) {
            enemy.name = `${enemy.name || '魔物'}${boost.nameSuffix}`;
        }
        enemy.hp = scaleNumber(enemy.hp, scale, 1);
        enemy.baseMaxHp = scaleNumber(enemy.baseMaxHp || enemy.hp, scale, enemy.hp);
        enemy.mp = scaleNumber(enemy.mp, scale, 0);
        enemy.baseMaxMp = scaleNumber(enemy.baseMaxMp || enemy.mp, scale, enemy.mp);

        if (enemy.baseStats) {
            ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
                if (enemy.baseStats[key] !== undefined) enemy.baseStats[key] = scaleNumber(enemy.baseStats[key], scale, 0);
            });
        }
        ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
            if (enemy[key] !== undefined) enemy[key] = scaleNumber(enemy[key], scale, 0);
        });

        enemy.elmRes = JSON.parse(JSON.stringify(enemy.elmRes || {}));
        Object.entries(boost.elmRes || {}).forEach(([elm, value]) => {
            enemy.elmRes[elm] = Number(enemy.elmRes[elm] || 0) + Number(value || 0);
        });

        enemy.elmAtk = JSON.parse(JSON.stringify(enemy.elmAtk || {}));
        Object.entries(boost.elmAtk || {}).forEach(([elm, value]) => {
            enemy.elmAtk[elm] = Number(enemy.elmAtk[elm] || 0) + Number(value || 0);
        });

        enemy.resists = JSON.parse(JSON.stringify(enemy.resists || {}));
        Object.entries(boost.resists || {}).forEach(([key, value]) => {
            enemy.resists[key] = Number(enemy.resists[key] || 0) + Number(value || 0);
        });

        enemy.mapEnemyBoost = JSON.parse(JSON.stringify(boost));
        return enemy;
    },

    generateNewEnemies: (isBoss, fixedBossId = null) => {
        const newEnemies = [];
        let floor = Math.max(1, Number(App.data.progress.floor) || 1);
        if (!isBoss && typeof Field !== 'undefined' && Field.currentMapData?.isFixed) {
            // 固定ダンジョンは progress.floor（1F/2F...）では弱すぎるため、
            // map.js の encounterRank を優先して「何階相当の敵を出すか」を指定する。
            // encounterRank未指定の場合はrankを使う。
            const fixedRank = Field.currentMapData.encounterRank || Field.currentMapData.rank;
            if (fixedRank) floor = Math.max(1, Number(fixedRank) || floor);
        }
        const battleData = App.data.battle || {};
        if (!isBoss && battleData.encounterRank) {
            floor = Math.max(1, Number(battleData.encounterRank) || floor);
        }
        const targetId = fixedBossId !== null && fixedBossId !== undefined ? fixedBossId : battleData.fixedBossId;
        const isSpecialBossBattle = !!(battleData.isSpecialBoss || battleData.isEstark);
        const normalCount = 1 + Math.floor(Math.random() * 4);
        const deepBossCount = 1 + Math.floor(Math.random() * 3);
        const suffix = (index, total) => total > 1 ? String.fromCharCode(65 + index) : '';
        const bossStatMultiplier = Math.max(1, Number(battleData.bossStatMultiplier || battleData.bossScale || 1) || 1);
        const pushBase = (base, index, total, options = {}) => {
            const name = (base.name || '\u4e0d\u660e\u306a\u9b54\u7269') + suffix(index, total);
            const m = Battle.createMonsterFromBase(base, { ...options, name });
            if (m && Number(options.storyBossStatMultiplier || 1) > 1) {
                const mult = Number(options.storyBossStatMultiplier || 1);
                m.hp = Math.max(1, Math.floor(Number(m.hp || 1) * mult));
                m.baseMaxHp = Math.max(1, Math.floor(Number(m.baseMaxHp || m.hp || 1) * mult));
                m.mp = Math.max(0, Math.floor(Number(m.mp || 0) * mult));
                m.baseMaxMp = Math.max(0, Math.floor(Number(m.baseMaxMp || m.mp || 0) * mult));
                if (m.baseStats) {
                    ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
                        if (m.baseStats[key] !== undefined) m.baseStats[key] = Math.max(0, Math.floor(Number(m.baseStats[key] || 0) * mult));
                    });
                }
                ['atk', 'def', 'spd', 'mag', 'mdef'].forEach(key => {
                    if (m[key] !== undefined) m[key] = Math.max(0, Math.floor(Number(m[key] || 0) * mult));
                });
                m.storyBossStatMultiplier = mult;
            }
            if (m && options.trialEnemyBoost) {
                Battle.applyMapEnemyBoost(m, options.trialEnemyBoost);
            }
            if (m) newEnemies.push(m);
        };

        // 深淵の裂け目戦は「10フロア先相当の通常強敵3体」を出す。
        // fixedBossId にIDを詰める方式だと、201階以降で generateEnemyForFloor() が null になり、
        // allowRare:true 経由でメタル系などのレアモンスターだけが選ばれる事故が起きる。
        // そのため、ここで battleData.riftFloor を正として、201階以降は通常深層敵生成ロジックを使う。
        const riftEventId = (typeof Dungeon !== 'undefined' && Dungeon.riftBattleEventId) ? Dungeon.riftBattleEventId : '__DUNGEON_ABYSS_RIFT__';
        const isRiftBattle = !!(battleData.isRiftBattle || battleData.eventId === riftEventId);
        if (isRiftBattle) {
            const riftFloor = Math.max(1, Number(battleData.riftFloor) || (floor + 10));
            Battle.log('<span style="color:#c78cff; font-weight:bold;">亀裂の根源から強敵が現れた！</span>');
            const total = 5;

            if (riftFloor >= 201) {
                let candidates = [];
                if (window.MonsterData && typeof window.MonsterData.getDeepFloorNormalBaseCandidates === 'function') {
                    candidates = window.MonsterData.getDeepFloorNormalBaseCandidates() || [];
                }
                if (candidates.length === 0 && window.MonsterData && typeof window.MonsterData.generateBandMonster === 'function') {
                    const fallback = window.MonsterData.generateBandMonster(200);
                    if (fallback) candidates = [fallback];
                }

                for (let i = 0; i < total; i++) {
                    const base = candidates[Math.floor(Math.random() * candidates.length)];
                    if (!base) continue;
                    const m = Battle.applyRiftEnemyBoost(Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), riftFloor, false));
                    if (m && total > 1) m.name += String.fromCharCode(65 + i);
                    if (m) newEnemies.push(m);
                }
                return newEnemies;
            }

            for (let i = 0; i < total; i++) {
                let base = null;
                if (window.MonsterData && typeof window.MonsterData.generateEnemyForFloor === 'function') {
                    base = window.MonsterData.generateEnemyForFloor(riftFloor, { allowRare: false });
                }
                if (!base && window.MonsterData && typeof window.MonsterData.generateBandMonster === 'function') {
                    base = window.MonsterData.generateBandMonster(Math.min(200, riftFloor));
                }
                if (!base && Array.isArray(DB.MONSTERS) && DB.MONSTERS.length) {
                    const candidates = DB.MONSTERS.filter(m => !m.isBoss && !m.isRare && !Battle.isSpecialBossBase(m));
                    base = candidates[Math.floor(Math.random() * candidates.length)] || null;
                }
                if (base) {
                    const name = (base.name || '\u4e0d\u660e\u306a\u9b54\u7269') + suffix(i, total);
                    const m = Battle.applyRiftEnemyBoost(Battle.createMonsterFromBase(base, { isBossBattle: false, name }));
                    if (m) newEnemies.push(m);
                }
            }
            return newEnemies;
        }

        if (isBoss && targetId) {
            const bases = Battle.getMonsterBasesByIds(targetId);
            if (bases.length > 0) {
                bases.forEach((base, i) => pushBase(base, i, bases.length, {
                    isBossBattle: true,
                    forceSpecialBoss: Battle.isSpecialBossBase(base),
                    storyBossStatMultiplier: bossStatMultiplier,
                    trialEnemyBoost: battleData.trialEnemyBoost || null,
                }));
                return newEnemies;
            }
        }

        if (isBoss && isSpecialBossBattle) {
            let bases = [];
            if (window.MonsterData && typeof window.MonsterData.getSpecialBossesForFloor === 'function') {
                bases = window.MonsterData.getSpecialBossesForFloor(floor) || [];
            }
            if (bases.length === 0) {
                const gilgamesh = Battle.getMonsterBaseById(902000);
                if (gilgamesh) bases = [gilgamesh];
            }
            const specialId = bases[0]?.id || 902000;
            const kills = (App.data.book && App.data.book.killCounts) ? (App.data.book.killCounts[specialId] || 0) : 0;
            const scale = 1.0 + (kills * 0.05);
            bases.forEach((base, i) => pushBase(base, i, bases.length, { isBossBattle: true, forceSpecialBoss: true, scale }));
            return newEnemies;
        }

        // イベント用の明示編成。通常エンカウントは最大4体だが、イベント/亀裂では5体まで許可する。
        // 使い方例: App.data.battle.fixedEnemyIds = [100001,100002,100003,100004,100005]
        // または App.data.battle.exactMonsters = true; App.data.battle.monsters = [...]
        const exactEventMonsterIds = Array.isArray(battleData.fixedEnemyIds)
            ? battleData.fixedEnemyIds
            : (battleData.exactMonsters && Array.isArray(battleData.monsters) ? battleData.monsters : null);
        if (!isBoss && exactEventMonsterIds && exactEventMonsterIds.length > 0) {
            const ids = exactEventMonsterIds.slice(0, 5);
            ids.forEach((mid, i) => {
                const base = Battle.getMonsterBaseById(mid);
                if (!base || Battle.isSpecialBossBase(base)) return;
                const m = Battle.createMonsterFromBase(base, {
                    name: (base.name || '\u4e0d\u660e\u306a\u9b54\u7269') + suffix(i, ids.length),
                    isBossBattle: !!base.isBoss,
                });
                if (m) newEnemies.push(m);
            });
            if (newEnemies.length > 0) return newEnemies;
        }

        if (floor >= 201) {
            if (isBoss) {
                Battle.log('<span style="color:#ff0000; font-size:1em; font-weight:bold;">\u6df1\u6df5\u306e\u5b88\u8b77\u8005\u304c\u73fe\u308c\u305f\uff01</span>');
                const candidates = (window.MonsterData?.bossMonsters || DB.MONSTERS || [])
                    .filter(base => base.isBoss && !base.isRare && !Battle.isSpecialBossBase(base) && !Battle.isStoryBossBase(base));
                for (let i = 0; i < deepBossCount; i++) {
                    const base = candidates[Math.floor(Math.random() * candidates.length)];
                    if (!base) continue;
                    const m = Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), floor, true);
                    if (deepBossCount > 1) m.name += String.fromCharCode(65 + i);
                    newEnemies.push(m);
                }
            } else {
                Battle.log('\u5f37\u529b\u306a\u9b54\u7269\u306e\u6c17\u914d\u304c\u3059\u308b\u2026\uff01');
                let candidates = [];
                if (window.MonsterData && typeof window.MonsterData.getDeepFloorNormalBaseCandidates === 'function') {
                    candidates = window.MonsterData.getDeepFloorNormalBaseCandidates() || [];
                }
                if (candidates.length === 0 && window.MonsterData && typeof window.MonsterData.generateBandMonster === 'function') {
                    const fallback = window.MonsterData.generateBandMonster(200);
                    if (fallback) candidates = [fallback];
                }
                for (let i = 0; i < normalCount; i++) {
                    const base = candidates[Math.floor(Math.random() * candidates.length)];
                    if (!base) continue;
                    const m = Battle.createDeepFloorMonster(Battle.cloneMonsterBase(base), floor, false);
                    if (normalCount > 1) m.name += String.fromCharCode(65 + i);
                    newEnemies.push(m);
                }
            }
            return newEnemies;
        }

        if (isBoss) {
            Battle.log('\u5f37\u5927\u306a\u9b54\u7269\u304c\u73fe\u308c\u305f\uff01');
            let bosses = [];
            if (window.MonsterData && typeof window.MonsterData.getBossesForFloor === 'function') {
                bosses = window.MonsterData.getBossesForFloor(floor) || [];
            }
            if (bosses.length === 0 && window.MonsterData && typeof window.MonsterData.getBossesForFloor === 'function') {
                bosses = window.MonsterData.getBossesForFloor(200) || [];
            }
            bosses.forEach((base, i) => pushBase(base, i, bosses.length, { isBossBattle: true }));
            return newEnemies;
        }

        Battle.log('\u9b54\u7269\u304c\u73fe\u308c\u305f\uff01');
        const pickRareEncounterMonster = () => {
            const rareDefs = Array.isArray(battleData.rareMonsters)
                ? battleData.rareMonsters
                : (typeof Field !== 'undefined' && Field.currentMapData && Array.isArray(Field.currentMapData.rareMonsters) ? Field.currentMapData.rareMonsters : null);
            if (!rareDefs || rareDefs.length === 0) return null;

            for (const def of rareDefs) {
                const rate = Math.max(0, Math.min(1, Number(def.rate ?? def.chance ?? 0)));
                if (rate <= 0 || Math.random() >= rate) continue;
                const base = Battle.getMonsterBaseById(def.id || def.monsterId);
                if (Battle.isNormalEncounterBase(base)) return base;
            }
            return null;
        };

        for (let i = 0; i < normalCount; i++) {
            let monsterData = null;
            const isFixedMap = typeof Field !== 'undefined' && Field.currentMapData && Field.currentMapData.isFixed;
            const battleMonsterIds = Array.isArray(battleData.monsters) ? battleData.monsters : null;
            const seaMonsterIds = battleData.encounterType === 'sea' && Array.isArray(window.SEA_ENCOUNTER_MONSTERS) ? window.SEA_ENCOUNTER_MONSTERS : null;
            const fixedMonsterIds = battleMonsterIds || seaMonsterIds || (isFixedMap && Array.isArray(Field.currentMapData.monsters) ? Field.currentMapData.monsters : null);
            const hasRareMonsterPool = Array.isArray(battleData.rareMonsters)
                || (isFixedMap && Array.isArray(Field.currentMapData.rareMonsters));

            monsterData = pickRareEncounterMonster();

            if (!monsterData && fixedMonsterIds && fixedMonsterIds.length > 0) {
                const mid = fixedMonsterIds[Math.floor(Math.random() * fixedMonsterIds.length)];
                const fixedBase = Battle.getMonsterBaseById(mid);
                if (Battle.isNormalEncounterBase(fixedBase)) monsterData = fixedBase;
            }

            if (!monsterData && window.MonsterData && typeof window.MonsterData.generateEnemyForFloor === 'function') {
                monsterData = window.MonsterData.generateEnemyForFloor(floor, { allowRare: !fixedMonsterIds && !hasRareMonsterPool });
            }

            if (!monsterData && typeof window.generateEnemy === 'function') {
                monsterData = window.generateEnemy(floor);
            }

            if (monsterData && !Battle.isSpecialBossBase(monsterData) && (!monsterData.isBoss || monsterData.isRare)) {
                const m = Battle.createMonsterFromBase(monsterData, { name: (monsterData.name || '\u4e0d\u660e\u306a\u9b54\u7269') + suffix(i, normalCount) });
                const boost = (typeof Field !== 'undefined' && Field.currentMapData?.enemyBoost) ? Field.currentMapData.enemyBoost : null;
                if (m) newEnemies.push(Battle.applyMapEnemyBoost(m, boost));
            }
        }
        return newEnemies;
    },

/**
     * 深層モンスターの個別生成・スケーリング (命中・回避・会心抑制 & ランダム特性付与版)
     */
    createDeepFloorMonster: (base, floor, isBoss) => {
        const m = new Monster(base, 1.0);
        const rank = Math.max(1, base.rank || 1);
        
        // ステータス倍率の決定
        const randMult = isBoss ? 2.0 : (0.9 + Math.random() * 0.4);
        
        // 基本ステータスのスケーリング（HP, MP, ATK, DEF, SPD, MAG, MDEF）
        m.hp = Math.floor((base.hp / rank) * floor * randMult);
        m.baseMaxHp = m.hp;
        m.mp = Math.floor((base.mp / rank) * floor * randMult);
        m.baseMaxMp = m.mp;

        m.baseStats.atk = Math.floor((base.atk / rank) * floor * randMult);
        m.baseStats.def = Math.floor((base.def / rank) * floor * randMult);
        m.baseStats.spd = Math.floor((base.spd / rank) * floor * randMult);
        m.baseStats.mag = Math.floor((base.mag / rank) * floor * randMult);
        m.mdef           = Math.floor(((base.mdef || base.mag) / rank) * floor * randMult);

        // ★修正: 命中・回避・会心は階層倍率を適用せず、0〜20のランダム加算に留める
        m.hit = (base.hit || 100) + Math.floor(Math.random() * 21);
        m.eva = (base.eva || 0)   + Math.floor(Math.random() * 21);
        m.cri = (base.cri || 0)   + Math.floor(Math.random() * 21);

        // 各種フラグ・データの継承
        m.id = base.id;
        m.baseId = base.id;
        m.rank = base.rank || rank;
        m.generatedFloor = floor;
        m.race = base.race || '不明';
        m.isBoss = base.isBoss || isBoss || false;
        m.isEstark = base.isEstark || false;
        m.isRare = base.isRare || false;
        m.isSpecialBoss = base.isSpecialBoss || base.isEstark || Number(base.id) === 902000;
        m.image = base.image || base.img || m.image || null;
        m.drops = JSON.parse(JSON.stringify(base.drops || null));
        
        // マスタ側の特性を継承
        m.traits = JSON.parse(JSON.stringify(base.traits || []));

        // ★新規追加: 武器以外の特性をランダムで 1〜3 つ付与 (Lv 1〜5)
        if (typeof PassiveSkill !== 'undefined' && PassiveSkill.MASTER) {
            const traitCount = 1 + Math.floor(Math.random() * 3); // 1〜3個
            // 「武器」タイプ以外の特性IDを抽出
            const availableTraitIds = Object.keys(PassiveSkill.MASTER).filter(tid => {
                return PassiveSkill.MASTER[tid].type !== '武器';
            });

            for (let i = 0; i < traitCount; i++) {
                const randomId = availableTraitIds[Math.floor(Math.random() * availableTraitIds.length)];
                const randomLv = 1 + Math.floor(Math.random() * 5); // Lv 1〜5
                
                // 重複習得を避けるチェック
                if (!m.traits.some(t => t.id === parseInt(randomId))) {
                    m.traits.push({ id: parseInt(randomId), level: randomLv });
                }
            }
        }

        // 報酬計算
        m.exp = Math.floor(((base.exp || 10) / rank) * floor * randMult);
        m.gold = Math.floor(((base.gold || 10) / rank) * floor * randMult);

        // 耐性設定
        if (!isBoss && !base.isRare) {
            m.resists = { 
                Poison:50, ToxicPoison:50, Shock:50, Fear:50, Seal:50, 
                Debuff:50, InstantDeath:50, SkillSeal:50, SpellSeal:50, HealSeal:50 
            };
        } else {
            m.resists = JSON.parse(JSON.stringify(base.resists || {}));
        }

        // 属性耐性
        m.elmRes = {};
        CONST.ELEMENTS.forEach(el => {
            if (base.isRare && base.elmRes && base.elmRes[el] !== undefined) {
                m.elmRes[el] = base.elmRes[el];
            } else {
                const min = isBoss ? -30 : -50;
                const max = isBoss ? 80 : 50;
                m.elmRes[el] = min + Math.floor(Math.random() * (max - min + 1));
            }
        });

        // 名前のクリーニング
        m.name = base.name.replace(/^(神・|強・|真・|極・)+/, '').replace(/\s?Lv\d+[A-Z]?$/, '').trim();

        // スキルの追加
        const skillCount = isBoss ? 4 : 2;
        const candidates = DB.SKILLS.filter(s => s.mp >= 150 && ['物理', '魔法', '特殊'].includes(s.type));
        
        m.acts = JSON.parse(JSON.stringify(base.acts || [{id:1, rate:100}]));
        for(let i=0; i<skillCount; i++) {
            const sk = candidates[Math.floor(Math.random() * candidates.length)];
            if (sk && !m.acts.some(a => a.id === sk.id)) {
                m.acts.push({ id: sk.id, rate: 20, condition: 0 });
            }
        }
        
        // ★特性による最終ステータス補正の適用 (ランダム付与分も含む)
        if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue) {
            m.baseStats.atk  = Math.floor(m.baseStats.atk  * (1 + PassiveSkill.getSumValue(m, 'atk_pct') / 100));
            m.baseStats.def  = Math.floor(m.baseStats.def  * (1 + PassiveSkill.getSumValue(m, 'def_pct') / 100));
            m.baseStats.mag  = Math.floor(m.baseStats.mag  * (1 + PassiveSkill.getSumValue(m, 'mag_pct') / 100));
            m.mdef           = Math.floor(m.mdef           * (1 + PassiveSkill.getSumValue(m, 'mdef_pct') / 100));
            m.baseStats.spd  = Math.floor(m.baseStats.spd  * (1 + PassiveSkill.getSumValue(m, 'spd_pct') / 100));
            
            // 命中・回避・会心の特性補正を加算
            m.hit += PassiveSkill.getSumValue(m, 'hit_pct');
            m.eva += PassiveSkill.getSumValue(m, 'eva_pct');
            m.cri += PassiveSkill.getSumValue(m, 'cri_pct');
        }

        m.passive = base.passive || {};
        Battle.initBattleStatus(m);
        
        return m;
    },

    log: (msg) => {
        const el = Battle.getEl('battle-log');
        if (el) {
            const line = document.createElement('div');
            line.innerHTML = msg; 
            el.appendChild(line);
            el.scrollTop = el.scrollHeight;
        }
        console.log(`[Battle] ${msg}`);
    },

    startInputPhase: () => {
        if (!Battle.active) return;
        Battle.phase = 'input';
        Battle.commandQueue = [];
        Battle.currentActorIndex = 0;
        Battle.closeSubMenu();
        Battle.findNextActor();
    },

	/* battle.js: オート設定とスキル非表示の完全反映版 */
findNextActor: () => {
        while (Battle.currentActorIndex < Battle.party.length) {
            const actor = Battle.party[Battle.currentActorIndex];
            if (!actor || actor.isDead) {
                Battle.commandQueue.push({ type:'skip', actor:actor, speed:0 });
                Battle.currentActorIndex++;
                continue; 
            }
            Battle.phase = 'input';
            break;
        }

        if (Battle.currentActorIndex >= Battle.party.length) {
            Battle.executeTurn();
            return;
        }

        const actor = Battle.party[Battle.currentActorIndex];
        Battle.renderPartyStatus();
        
        // --- オート戦闘処理 ---
        if (Battle.auto) {
            // 現在の戦況に最適な行動を思考ルーチンで決定
            const action = Battle.decideAutoAction(actor);
            Battle.registerAction(action);
            return;
        }
        
        // --- 手動入力 ---
        const nameDiv = Battle.getEl('battle-actor-name');
        if(nameDiv) {
            nameDiv.style.display = 'block';
            nameDiv.innerText = `${actor.name}の行動`;
        }
        Battle.updateCommandButtons(); 
        Battle.log(`${actor.name}はどうする？`);
    },

    getAutoStrategyKey: (actor) => {
        const source = (typeof App !== 'undefined' && App.getChar && actor?.uid) ? App.getChar(actor.uid) : null;
        if (source && App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(source);
        const key = source?.config?.strategy || actor?.config?.strategy || 'balanced';
        return (App.battleStrategies && App.battleStrategies[key]) ? key : 'balanced';
    },

    getValidAutoSkills: (actor, allowSkills = true) => {
        if (!allowSkills) return [];
        const source = (typeof App !== 'undefined' && App.getChar && actor?.uid) ? App.getChar(actor.uid) : null;
        const config = source?.config || actor?.config || {};
        const hiddenIds = Array.isArray(config.hiddenSkills) ? config.hiddenSkills.map(id => Number(id)) : [];
        return (actor.skills || []).filter(s => {
            const sId = Number(s.id);
            if (sId === 1) return false;
            if (Battle.isMadanteSkillId(sId)) return false;
            if (hiddenIds.includes(sId)) return false;
            if (actor.mp < (s.mp || 0)) return false;

            const ailments = actor.battleStatus?.ailments || {};
            if (ailments['SpellSeal'] && ['魔法','強化','弱体'].includes(s.type)) return false;
            if (ailments['SkillSeal'] && ['物理','特殊'].includes(s.type)) return false;
            if (ailments['HealSeal'] && ['回復','蘇生'].includes(s.type)) return false;
            return true;
        });
    },

    makeAutoAttackAction: (actor, target = null) => {
        const enemyTarget = target || Battle.getWeakWeightedAliveEnemy();
        if (enemyTarget) return { type: 'attack', actor, target: enemyTarget, isAuto: true };
        return { type: 'defend', actor, isAuto: true };
    },

    autoSkillCanTargetAlly: (skill, actor, ally) => {
        if (!skill || !ally) return false;
        if (skill.target === '自分') return ally === actor;
        return true;
    },

    isAllySupportSkill: (skill) => {
        if (!skill) return false;
        const type = String(skill.type || '');
        return type.includes('回復') || type === '蘇生' || type === '強化' || skill.CureAilments ||
            skill.debuff_reset || skill.HPRegen || skill.MPRegen;
    },

    getAutoSkillTarget: (actor, skill, preferredTarget = null) => {
        if (!skill) return null;
        const support = Battle.isAllySupportSkill(skill);
        if (skill.target === '全体') return support ? 'all_ally' : 'all_enemy';
        if (skill.target === 'ランダム') return 'random';
        if (skill.target === '自分') return actor;
        if (support) return preferredTarget || actor;
        return preferredTarget || Battle.getWeakWeightedAliveEnemy();
    },

    makeAutoSkillAction: (actor, skill, target = null) => {
        if (!skill) return null;
        const chosenTarget = Battle.getAutoSkillTarget(actor, skill, target);
        if (!chosenTarget) return null;
        return { type: 'skill', actor, target: chosenTarget, data: skill, targetScope: skill.target, isAuto: true };
    },

    findLowHpAlly: (allies, threshold) => {
        return allies
            .filter(p => p && !p.isDead && p.baseMaxHp > 0 && (p.hp / p.baseMaxHp) <= threshold)
            .sort((a, b) => (a.hp / a.baseMaxHp) - (b.hp / b.baseMaxHp))[0] || null;
    },

    chooseAutoAllyAction: (actor, skills, predicate, preferredAlly = null) => {
        const skill = skills.find(s => predicate(s) && Battle.autoSkillCanTargetAlly(s, actor, preferredAlly || actor));
        if (!skill) return null;
        return Battle.makeAutoSkillAction(actor, skill, preferredAlly || actor);
    },

    chooseAutoBuffAction: (actor, skills) => {
        const aliveAllies = Battle.party.filter(p => Battle.isBattleAlive(p));
        const skill = skills.find(s => s.type === '強化' || s.buff || s.HPRegen || s.MPRegen);
        if (!skill) return null;
        const target = skill.target === '自分' ? actor : (aliveAllies[0] || actor);
        return Battle.makeAutoSkillAction(actor, skill, target);
    },

    chooseAutoOffensiveAction: (actor, skills, aliveEnemies, mode = 'balanced') => {
        if (!aliveEnemies || aliveEnemies.length === 0) return { type: 'defend', actor, isAuto: true };
        const offensive = skills.filter(s => Battle.isAutoOffensiveSkill(s));
        if (mode === 'conserve') {
            const choice = Battle.pickConservativeAutoAction(actor, offensive, aliveEnemies);
            if (choice && choice.type === 'attack') return Battle.makeAutoAttackAction(actor, choice.target);
            if (choice && choice.skill) return Battle.makeAutoSkillAction(actor, choice.skill, choice.target || null);
            return Battle.makeAutoAttackAction(actor);
        }
        if (offensive.length === 0) return Battle.makeAutoAttackAction(actor);

        const target = aliveEnemies.slice().sort((a, b) => a.hp - b.hp)[0];
        const scored = offensive.map(skill => {
            let score = Battle.estimateAutoDamage(actor, skill, target);
            if (skill.target === '全体') score *= Math.min(3, aliveEnemies.length);
            if (mode === 'balanced') score -= (skill.mp || 0) * 0.35;
            if (mode === 'tricky' && (skill.type === '弱体' || skill.debuff)) score *= 1.35;
            return { skill, score };
        }).sort((a, b) => b.score - a.score);

        const top = scored.slice(0, mode === 'allout' ? 3 : 5).filter(x => x.score > 0);
        const picked = (top.length ? top : scored)[Math.floor(Math.random() * Math.max(1, (top.length || scored.length)))];
        return Battle.makeAutoSkillAction(actor, picked?.skill, null) || Battle.makeAutoAttackAction(actor);
    },

    decideTacticalAutoAction: (actor) => {
        const tactic = Battle.getAutoStrategyKey(actor);
        const validSkills = Battle.getValidAutoSkills(actor, tactic !== 'no_mp');
        const aliveAllies = Battle.party.filter(p => Battle.isBattleAlive(p));
        const deadAllies = Battle.party.filter(p => p && p.isDead);
        const aliveEnemies = Battle.enemies.filter(e => Battle.isBattleAlive(e));
        const ailedAlly = aliveAllies.find(p => Object.keys(p.battleStatus?.ailments || {}).length > 0);
        const debuffedAlly = aliveAllies.find(p => Object.keys(p.battleStatus?.debuffs || {}).length > 0);
        const buffedEnemy = aliveEnemies.find(e => Object.keys(e.battleStatus?.buffs || {}).length > 0);

        if (tactic === 'no_mp') return Battle.makeAutoAttackAction(actor);

        const revive = () => deadAllies.length
            ? Battle.chooseAutoAllyAction(actor, validSkills, s => s.type === '蘇生', deadAllies[0])
            : null;
        const heal = (threshold) => {
            const target = Battle.findLowHpAlly(aliveAllies, threshold);
            return target ? Battle.chooseAutoAllyAction(actor, validSkills, s => String(s.type || '').includes('回復'), target) : null;
        };
        const cure = () => ailedAlly
            ? Battle.chooseAutoAllyAction(actor, validSkills, s => s.type === '状態異常回復' || s.CureAilments || (s.cures && s.cures.length > 0), ailedAlly)
            : null;
        const resetDebuff = () => debuffedAlly
            ? Battle.chooseAutoAllyAction(actor, validSkills, s => s.debuff_reset === true, debuffedAlly)
            : null;
        const resetEnemyBuff = () => {
            const skill = buffedEnemy ? validSkills.find(s => s.buff_reset === true) : null;
            return skill ? Battle.makeAutoSkillAction(actor, skill, buffedEnemy) : null;
        };

        let action = null;
        if (tactic === 'allout') {
            action = (deadAllies.length >= 2 ? revive() : null) || heal(0.25) || Battle.chooseAutoOffensiveAction(actor, validSkills, aliveEnemies, 'allout');
        } else if (tactic === 'conserve') {
            action = revive() || heal(0.35) || cure() || Battle.chooseAutoOffensiveAction(actor, validSkills, aliveEnemies, 'conserve');
        } else if (tactic === 'tricky') {
            const debuffPool = validSkills.filter(s => s.type === '弱体' || s.debuff || (Battle.isAutoOffensiveSkill(s) && s.debuff));
            if (Math.random() < 0.65 && debuffPool.length) {
                action = Battle.makeAutoSkillAction(actor, debuffPool[Math.floor(Math.random() * debuffPool.length)], null);
            }
            action = action || (Math.random() < 0.25 ? Battle.chooseAutoBuffAction(actor, validSkills) : null) ||
                Battle.chooseAutoOffensiveAction(actor, validSkills, aliveEnemies, 'tricky');
        } else if (tactic === 'defensive') {
            action = revive() || heal(0.70) || cure() || resetDebuff() || Battle.chooseAutoBuffAction(actor, validSkills) ||
                Battle.chooseAutoOffensiveAction(actor, validSkills, aliveEnemies, 'balanced');
        } else {
            action = revive() || heal(0.45) || cure() || resetDebuff() || resetEnemyBuff() ||
                Battle.chooseAutoOffensiveAction(actor, validSkills, aliveEnemies, 'balanced');
        }

        return action || Battle.makeAutoAttackAction(actor);
    },

    // Auto battle strategy dispatcher
    decideAutoAction: (actor) => {
        return Battle.decideTacticalAutoAction(actor);
    },
    isAutoOffensiveSkill: (s) => {
        if (!s || s.id === 1) return false;
        return ['物理', '魔法', 'ブレス', '特殊'].includes(s.type) && 
            !String(s.type || '').includes('回復') && s.type !== '蘇生' && !s.CureAilments;
    },

    estimateAutoDamage: (actor, skill, target) => {
        if (!actor || !target) return 0;
        const data = skill || null;
        const effectType = data ? data.type : '通常攻撃';
        const isPhysical = (!data || effectType === '物理' || effectType === '通常攻撃');
        const baseDmg = data ? (data.base || 0) : 0;
        let baseDmgCalc = 0;

        if (data && data.fix) {
            baseDmgCalc = baseDmg;
        } else if (effectType === 'ブレス') {
            baseDmgCalc = Math.floor(((Battle.getBattleStat(actor, 'atk') + Battle.getBattleStat(actor, 'mag')) / 6) + baseDmg);
        } else {
            const atkVal = isPhysical ? Battle.getBattleStat(actor, 'atk') : Battle.getBattleStat(actor, 'mag');
            const defVal = isPhysical ? Battle.getBattleStat(target, 'def') : Battle.getBattleStat(target, 'mdef');
            const ignoreDefense = !!(data && data.IgnoreDefense);
            baseDmgCalc = Math.floor((atkVal / 2 + baseDmg) - (ignoreDefense ? 0 : defVal / 4));
        }

        if (baseDmgCalc < 1) baseDmgCalc = 1;

        let rate = data && data.rate !== undefined ? data.rate : 1.0;
        let count = data && typeof data.count === 'number' ? data.count : 1;
        let cutRate = 0;
        let bonusRate = 0;

        if (data && data.elm) {
            bonusRate += (Battle.getBattleStat(actor, 'elmAtk') || {})[data.elm] || 0;
            const res = (target.getStat ? target.getStat('elmRes') : (target.elmRes || {})) || {};
            cutRate += res[data.elm] || 0;
        }

        bonusRate += Battle.getBattleStat(actor, 'finDmg') || 0;
        cutRate += Battle.getBattleStat(target, 'finRed') || 0;
        if (cutRate > 80) cutRate = 80;

        let dmg = Math.floor(baseDmgCalc * rate * count * (1 + bonusRate / 100) * (1 - cutRate / 100));
        if (dmg < 1) dmg = 1;
        return dmg;
    },

    pickConservativeAutoAction: (actor, pool, aliveEnemies) => {
        if (!aliveEnemies || aliveEnemies.length === 0) return null;

        const attackTargets = [...aliveEnemies].sort((a, b) => a.hp - b.hp);
        const normalAttack = Math.max(1, Battle.estimateAutoDamage(actor, null, attackTargets[0]));
        const weakEnemy = attackTargets.find(e => e.hp <= Math.ceil(normalAttack * 1.15));
        const mpMax = Math.max(1, actor.baseMaxMp || 1);
        const mpRatio = (actor.mp || 0) / mpMax;

        // 通常攻撃でほぼ落とせる敵がいる場合はMPを使わない
        if (weakEnemy) {
            return { type: 'attack', target: weakEnemy };
        }

        const offensive = pool.filter(s => Battle.isAutoOffensiveSkill(s));
        const support = pool.filter(s => !Battle.isAutoOffensiveSkill(s));
        if (offensive.length === 0) {
            const s = support[Math.floor(Math.random() * support.length)];
            return s ? { type: 'skill', skill: s } : { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };
        }

        const totalEnemyHp = aliveEnemies.reduce((sum, e) => sum + Math.max(0, e.hp || 0), 0);
        const hasBossLike = aliveEnemies.some(e => e.isBoss || (e.baseMaxHp && e.baseMaxHp >= normalAttack * 8) || (e.hp && e.hp >= normalAttack * 5));

        const candidates = offensive.map(skill => {
            const cost = Math.max(0, skill.mp || 0);
            let target = null;
            let value = 0;

            if (skill.target === '全体') {
                aliveEnemies.forEach(e => {
                    value += Math.min(e.hp, Battle.estimateAutoDamage(actor, skill, e));
                });
            } else {
                target = [...aliveEnemies].sort((a, b) => {
                    const da = Math.min(a.hp, Battle.estimateAutoDamage(actor, skill, a));
                    const db = Math.min(b.hp, Battle.estimateAutoDamage(actor, skill, b));
                    return db - da;
                })[0];
                value = Math.min(target.hp, Battle.estimateAutoDamage(actor, skill, target));
            }

            const efficiency = value / Math.max(1, cost || 1);
            const overkill = target ? Math.max(0, Battle.estimateAutoDamage(actor, skill, target) - target.hp) : Math.max(0, value - totalEnemyHp);
            return { skill, target, cost, value, efficiency, overkill };
        }).filter(c => c.cost <= (actor.mp || 0));

        if (candidates.length === 0) return { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };

        candidates.sort((a, b) => {
            if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
            return b.value - a.value;
        });

        let best = candidates[0];

        // MPが少ないときは、ボス級/高HPでない限り攻撃スキルを温存
        if (mpRatio <= 0.25 && !hasBossLike) {
            return { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };
        }

        // 節約ONでは、通常攻撃と大差ない攻撃スキルは使わない
        const normalValue = aliveEnemies.length >= 2 ? normalAttack * Math.min(2, aliveEnemies.length) : normalAttack;
        if (best.value <= normalValue * 1.35 && !hasBossLike) {
            return { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };
        }

        // 残MPに対して重すぎる技は、明確に強い場面以外では温存
        if (best.cost > mpMax * 0.30 && best.value < normalValue * 2.2 && !hasBossLike) {
            return { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };
        }

        // 過剰オーバーキル気味なら通常攻撃へ寄せる
        if (best.overkill > normalAttack * 2 && best.value < normalValue * 2.0 && !hasBossLike) {
            return { type: 'attack', target: Battle.getWeakWeightedAliveEnemy() };
        }

        return { type: 'skill', skill: best.skill, target: best.skill.target === '単体' ? best.target : null };
    },

    goBack: () => {
        if (Battle.currentActorIndex > 0) {
            Battle.commandQueue.pop(); 
            Battle.currentActorIndex--;
            while (Battle.currentActorIndex >= 0 && (!Battle.party[Battle.currentActorIndex] || Battle.party[Battle.currentActorIndex].isDead)) {
                Battle.currentActorIndex--;
            }
            if(Battle.currentActorIndex < 0) Battle.currentActorIndex = 0;
            Battle.closeSubMenu();
            Battle.phase = 'input'; 
            Battle.findNextActor();
        }
    },

    updateCommandButtons: () => {
        const btn = Battle.getEl('btn-run');
        const strategyBtn = Battle.getEl('btn-strategy');
        if(btn) {
            const firstAlive = Battle.party.findIndex(p => p && !p.isDead);
            if (Battle.currentActorIndex === firstAlive) {
                if (strategyBtn) strategyBtn.style.display = '';
                btn.innerText = "にげる";
                btn.onclick = Battle.run;
                btn.disabled = !!App.data.battle.isBossBattle;
                btn.style.gridColumn = '';
            } else {
                if (strategyBtn) strategyBtn.style.display = 'none';
                btn.innerText = "もどる";
                btn.onclick = Battle.goBack;
                btn.disabled = false;
                btn.style.gridColumn = 'span 2';
            }
        }
    },

    escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch])),

    openStrategyWindow: () => {
        if (Battle.phase !== 'input' || Battle.auto) return;
        Battle.closeSubMenu();
        const win = Battle.getEl('battle-list-window');
        const title = Battle.getEl('battle-list-title');
        const content = Battle.getEl('battle-list-content');
        if (!win || !content) return;
        if (title) title.innerText = 'さくせん';
        content.innerHTML = '';
        Battle.renderStrategyList(content);
        win.style.display = 'flex';
    },

    renderStrategyList: (content) => {
        const strategies = (typeof App !== 'undefined' && App.battleStrategies) ? App.battleStrategies : {};
        Battle.party.forEach((actor) => {
            if (!actor) return;
            const charData = App.getChar ? App.getChar(actor.uid) : null;
            if (charData && App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(charData);
            const current = charData?.config?.strategy || actor.config?.strategy || 'balanced';
            const row = document.createElement('div');
            row.className = 'list-item';
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px;';
            row.innerHTML = `
                <div style="min-width:0;">
                    <div style="font-weight:bold; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Battle.escapeHtml(actor.name)}</div>
                    <div style="font-size:11px; color:#ffd; margin-top:3px;">${Battle.escapeHtml(App.getBattleStrategyLabel ? App.getBattleStrategyLabel(current) : (strategies[current]?.label || current))}</div>
                </div>
                <div style="font-size:18px; color:#888; flex:0 0 auto;">›</div>
            `;
            row.onclick = () => Battle.openStrategyModal(actor.uid);
            content.appendChild(row);
        });
    },

    openStrategyModal: (uid) => {
        const charData = App.getChar ? App.getChar(uid) : null;
        if (!charData) return;
        if (App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(charData);
        Battle.closeStrategyModal();

        const strategies = (typeof App !== 'undefined' && App.battleStrategies) ? App.battleStrategies : {};
        const current = charData.config?.strategy || 'balanced';
        const currentLabel = App.getBattleStrategyLabel ? App.getBattleStrategyLabel(current) : (strategies[current]?.label || current);
        const modal = document.createElement('div');
        modal.id = 'battle-strategy-modal';
        modal.style.cssText = 'position:fixed; inset:0; z-index:3300; background:rgba(0,0,0,0.74); display:flex; align-items:center; justify-content:center; padding:16px;';
        modal.onclick = () => Battle.closeStrategyModal();
        modal.innerHTML = `
            <div onclick="event.stopPropagation()" style="width:min(360px, 100%); max-height:86vh; overflow:auto; background:#151515; border:1px solid #777; border-radius:8px; box-shadow:0 18px 48px rgba(0,0,0,0.7);">
                <div style="padding:12px; border-bottom:1px solid #333;">
                    <div style="font-size:15px; font-weight:bold; color:#fff;">${Battle.escapeHtml(charData.name)}</div>
                    <div style="font-size:11px; color:#aaa; margin-top:2px;">現在: ${Battle.escapeHtml(currentLabel)}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; padding:12px;">
                    ${Object.keys(strategies).map(key => `<button class="btn" style="width:100%; text-align:left; padding:10px 12px; background:${key === current ? '#064' : '#333'};" onclick="Battle.setPartyStrategy('${uid}', '${key}')">${Battle.escapeHtml(strategies[key].label || key)}</button>`).join('')}
                </div>
                <div style="padding:0 12px 12px;">
                    <button class="btn" style="width:100%; background:#555;" onclick="Battle.closeStrategyModal()">閉じる</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    closeStrategyModal: () => {
        const modal = document.getElementById('battle-strategy-modal');
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
    },

    setPartyStrategy: (uid, strategy) => {
        if (App.setBattleStrategy) App.setBattleStrategy(uid, strategy);
        Battle.closeStrategyModal();
        const content = Battle.getEl('battle-list-content');
        if (content) {
            content.innerHTML = '';
            Battle.renderStrategyList(content);
        }
    },

    selectCommand: (type) => {
        if (Battle.phase !== 'input' || Battle.auto) return;
        Battle.selectingAction = type;
        Battle.selectedItemOrSkill = null;

        if (type === 'attack') {
            Battle.log("攻撃対象を選択してください");
            Battle.openTargetWindow('enemy');
        } 
        else if (type === 'skill') Battle.openSkillList();
        else if (type === 'item') Battle.openItemList();
        else if (type === 'defend') {
            const actor = Battle.party[Battle.currentActorIndex];
            Battle.registerAction({ type: 'defend', actor: actor });
        }
    },

    openTargetWindow: (targetType, actionData = null) => { 
        const win = Battle.getEl('battle-target-window');
        const list = Battle.getEl('battle-target-list');
        const listWin = Battle.getEl('battle-list-window');
        if (!win || !list) return;
        if (listWin) listWin.style.display = 'none'; 

        win.style.display = 'flex';
        list.innerHTML = '';
        Battle.phase = 'target_select';

        let targets = [];
        let actualTargetType = targetType;
        
        if(actionData) {
            const type = actionData.type || '';
            const range = actionData.target || '単体';
            if (range === '単体') {
                if (type === '蘇生') actualTargetType = 'ally_dead';
                else if (type.includes('回復') || type === '強化' || type === 'MP回復') actualTargetType = 'ally';
                else if (actionData.debuff_reset || actionData.CureAilments) actualTargetType = 'ally'; 
                else actualTargetType = 'enemy';
            } else if (range === '全体') {
                if (type.includes('回復') || ['蘇生','強化'].includes(type) || 
                    actionData.debuff_reset || actionData.CureAilments || 
                    actionData.HPRegen || actionData.MPRegen) {
                    actualTargetType = 'all_ally';
                } else {
                    actualTargetType = 'all_enemy';
                }
            } else if (range === 'ランダム') {
                actualTargetType = 'random';
            } else if (range === '自分') {
                actualTargetType = 'self';
            }
        }

        if (['all_enemy', 'all_ally', 'random', 'self'].includes(actualTargetType)) {
            const actor = Battle.party[Battle.currentActorIndex];
            let targetObj = actualTargetType;
            if (actualTargetType === 'self') targetObj = actor;

            Battle.registerAction({ 
                type: Battle.selectingAction, 
                actor: actor, 
                target: targetObj, 
                data: Battle.selectedItemOrSkill,
                targetScope: actionData ? actionData.target : null 
            });
            return;
        }

        if (actualTargetType === 'enemy') targets = Battle.enemies.filter(e => Battle.isBattleAlive(e));
        else if (actualTargetType === 'ally') targets = Battle.party.filter(p => Battle.isBattleAlive(p));
        else if (actualTargetType === 'ally_dead') targets = Battle.party.filter(p => p && p.isDead);

        if (targets.length === 0) {
            Battle.log("対象がいません");
            Battle.schedule(Battle.cancelSubMenu, 800);
            return;
        }

        targets.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'battle-target-btn';
            btn.innerText = t.name;
            if(t.isDead && actualTargetType !== 'ally_dead') btn.disabled = true;
            btn.onclick = (e) => { e.stopPropagation(); Battle.selectTarget(t); };
            list.appendChild(btn);
        });
    },

    selectTarget: (target) => {
        if (Battle.phase !== 'target_select') return;
        const actor = Battle.party[Battle.currentActorIndex];
        Battle.registerAction({
            type: Battle.selectingAction,
            actor: actor,
            target: target,
            data: Battle.selectedItemOrSkill
        });
    },

	openSkillList: () => {
        const actor = Battle.party[Battle.currentActorIndex];
        const win = Battle.getEl('battle-list-window');
        const title = Battle.getEl('battle-list-title');
        const content = Battle.getEl('battle-list-content');
        const targetWin = Battle.getEl('battle-target-window');
        if (!win || !title || !content) return;
        if (targetWin) targetWin.style.display = 'none';

        win.style.display = 'flex';
        title.innerText = "特技・魔法";
        content.innerHTML = '';
        Battle.phase = 'skill_select';

        if (!actor.skills || actor.skills.length === 0) {
            content.innerHTML = '<div style="padding:10px; font-size:12px;">特技がありません</div>';
            return;
        }
        
        // 個別設定（非表示スキル）の読み込み
        const config = actor.config || { fullAuto: false, hiddenSkills: [] };
        const hiddenIds = config.hiddenSkills.map(id => Number(id));
        
        actor.skills.forEach(sk => {
            // 通常攻撃(ID:1)および、メニューで「非表示」設定されたスキルは出さない
            if (sk.id === 1) return;
            if (hiddenIds.includes(Number(sk.id))) return;
            
            const div = document.createElement('div');
            div.className = 'list-item';
            
            let isDisabled = false;
            let note = "";
            const ailments = actor.battleStatus.ailments;
            
            // 状態異常による封印判定
            if (ailments['SpellSeal'] && ['魔法','強化','弱体'].includes(sk.type)) { isDisabled = true; note = "(封印)"; }
            if (ailments['SkillSeal'] && ['物理','特殊'].includes(sk.type)) { isDisabled = true; note = "(封印)"; }
            if (ailments['HealSeal'] && ['回復','蘇生'].includes(sk.type)) { isDisabled = true; note = "(封印)"; }

            let elmHtml = '';
            if (sk.elm) {
                const colors = { '火':'#f88', '水':'#88f', '雷':'#ff0', '風':'#8f8', '光':'#ffc', '闇':'#a8f', '混沌':'#d4d' };
                let color = colors[sk.elm] || '#ccc';
                elmHtml = `<span style="color:${color}; margin-right:3px;">[${sk.elm}]</span>`;
            }

            // ★フォントサイズを全体的に縮小調整したレイアウト
            div.innerHTML = `
                <div style="flex:1; min-width:0; ${isDisabled?'color:#888':''}">
                    <div style="display:flex; align-items:center;">
                        <span style="font-size:12px; font-weight:bold; margin-right:5px;">${sk.name}</span>
                        <span style="font-size:9px; color:#f44;">${note}</span>
                        <span style="font-size:9px; color:#aaa; margin-left:auto; margin-right:5px;">(${sk.target})</span>
                    </div>
                    <div style="font-size:9px; color:#ccc; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${elmHtml}${sk.desc || ''}
                    </div>
                </div>
                <div style="font-size:11px; color:#88f; text-align:right; min-width:40px;">MP:${sk.mp}</div>
            `;

            div.onclick = (e) => {
                e.stopPropagation();
                if (isDisabled) { 
                    Battle.showNoticeOverlay('', '封印されていて使えない！', 'ＯＫ');
					//Battle.log("封印されていて使えない！");
					return;
				}
					
                // マダンテ系はMP1以上あれば選択可能、それ以外は消費MPチェック
                const requiredMp = Battle.isMadanteSkill(sk) ? 1 : sk.mp;
                if (actor.mp < requiredMp) {
                    Battle.showNoticeOverlay('', 'この特技を使うにはMPが足りない！', 'ＯＫ');
                    //Battle.log("MPが足りません");
                    return;
                }
                
                Battle.selectedItemOrSkill = sk;
                Battle.openTargetWindow(sk.target, sk);
            };
            content.appendChild(div);
        });

        // ★スクロール位置の復元
        const uid = actor.uid || ('temp_' + Battle.currentActorIndex);
        if (Battle.skillScrollPositions && Battle.skillScrollPositions[uid] !== undefined) {
            content.scrollTop = Battle.skillScrollPositions[uid];
        } else {
            content.scrollTop = 0;
        }

        // ★スクロール位置の保存
        content.onscroll = function() {
            if (Battle.phase === 'skill_select') {
                if (!Battle.skillScrollPositions) Battle.skillScrollPositions = {};
                Battle.skillScrollPositions[uid] = content.scrollTop;
            }
        };
    },


    openItemList: () => {
		const win = Battle.getEl('battle-list-window');
		const title = Battle.getEl('battle-list-title');
		const content = Battle.getEl('battle-list-content');
		const targetWin = Battle.getEl('battle-target-window');
		if (!win || !title || !content) return;
		if (targetWin) targetWin.style.display = 'none';
		
		win.style.display = 'flex';
		title.innerText = "道具";
		content.innerHTML = '';
		Battle.phase = 'item_select';

		const items = [];
		if (App.data.items) {
			Object.keys(App.data.items).forEach(id => {
				const it = DB.ITEMS.find(i => i.id == id);
				if (
					it &&
					(
						it.type.includes('回復') ||
						it.type.includes('蘇生') ||
						it.type.includes('MP回復') ||
						it.type === '状態異常回復'
					) &&
					App.data.items[id] > 0
				) { 
					items.push({ def: it, count: App.data.items[id] });
				}
			});
		}

		if (items.length === 0) {
			content.innerHTML = '<div style="padding:10px; font-size:12px;">使える道具がありません</div>';
			return;
		}

		items.forEach(obj => {
			const it = obj.def;

			const div = document.createElement('div');
			div.className = 'list-item';

			const desc = it.desc || '説明なし';
			const targetLabel = it.target || it.type || '';

			div.innerHTML = `
				<div style="flex:1; min-width:0;">
					<div style="display:flex; align-items:center;">
						<span style="font-size:12px; font-weight:bold; margin-right:5px;">${it.name}</span>
						<span style="font-size:9px; color:#aaa; margin-left:auto; margin-right:5px;">(${targetLabel})</span>
					</div>
					<div style="font-size:9px; color:#ccc; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
						${desc}
					</div>
				</div>
				<div style="font-size:11px; color:#ffd700; text-align:right; min-width:40px;">x${obj.count}</div>
			`;

			div.onclick = (e) => {
				e.stopPropagation();

				Battle.selectedItemOrSkill = it;

				let tType = 'ally';

				if (it.type === '蘇生') {
					tType = 'ally_dead';
				} else if (it.target === '全体') {
					tType = 'all_ally';
				}

				Battle.openTargetWindow(tType, it);
			};

			content.appendChild(div);
		});
	},
	
    cancelSubMenu: () => {
        Battle.closeSubMenu();
        Battle.phase = 'input';
        Battle.selectingAction = null;
        Battle.selectedItemOrSkill = null;
        Battle.log("コマンドを選択してください");
    },
    
    closeSubMenu: () => {
        const winT = Battle.getEl('battle-target-window');
        const winL = Battle.getEl('battle-list-window');
        if(winT) winT.style.display = 'none';
        if(winL) winL.style.display = 'none';
        Battle.closeNoticeOverlay();
    },

    showNoticeOverlay: (title, message, buttonText = 'ＯＫ') => {
        Battle.closeNoticeOverlay();

        const scene = Battle.getEl('battle-scene') || document.body;
        const layer = document.createElement('div');
        layer.id = 'battle-notice-overlay';
        layer.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.45);
            padding: 16px;
            box-sizing: border-box;
            font-family: 'DotGothic16', sans-serif;
        `;

        layer.innerHTML = `
            <div style="
                width: min(320px, 92vw);
                background: #000;
                color: #fff;
                border: 3px double #fff;
                box-sizing: border-box;
                padding: 16px;
                text-align: center;
                box-shadow: 0 0 18px rgba(0,0,0,0.8);
            ">
                <div style="color:#ffd700; font-size:14px; font-weight:bold; margin-bottom:10px;">${title}</div>
                <div style="font-size:13px; line-height:1.6; margin-bottom:14px;">${message}</div>
                <button class="btn" style="width:30%; height:30px; background:#000; color:#fff; border:2px solid #fff;" onclick="Battle.closeNoticeOverlay()">${buttonText}</button>
            </div>
        `;

        scene.appendChild(layer);
    },

    closeNoticeOverlay: () => {
        const layer = document.getElementById('battle-notice-overlay');
        if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    },

    registerAction: (actionObj) => {
        const actor = actionObj.actor;
        const spd = Battle.getBattleStat(actor, 'spd');
        
        let finalSpeed = spd * (0.9 + Math.random() * 0.2);
        let priority = 0;
        
        if (actionObj.type === 'defend') priority = 1; 
        else if (actionObj.data && actionObj.data.priority) priority = actionObj.data.priority;

        actionObj.speed = finalSpeed + (priority * 100000);

        Battle.commandQueue.push(actionObj);
        Battle.closeSubMenu();
        Battle.currentActorIndex++;
        Battle.findNextActor();
    },

    run: () => {
        if (Battle.phase !== 'input') return;
        if (App.data.battle.isBossBattle) {
            Battle.log("ボスからは逃げられない！");
            return;
        }
        // ★逃走試行回数を加算
        Battle.runAttemptCount = (Battle.runAttemptCount || 0) + 1;

        // ★試行回数に応じた成功率の決定
        let rate = 0.5;
        if (Battle.runAttemptCount === 2) rate = 0.7;
        else if (Battle.runAttemptCount === 3) rate = 0.9;
        else if (Battle.runAttemptCount >= 4) rate = 1.0;

        if(Math.random() < rate) {
            Battle.log("逃げ出した！");
            Battle.endBattle(false);
        } else {
            Battle.log(`しかし、回り込まれてしまった！`);
            Battle.commandQueue = [];
            Battle.party.forEach(p => {
                if(p && !p.isDead) Battle.commandQueue.push({ type:'defend', actor:p, speed: Battle.getBattleStat(p, 'spd') });
            });
            Battle.executeTurn();
        }
    },

// ★追加: 敵の行動を決定する関数 (再評価用)
    decideEnemyAction: (e) => {
        // 生の行動データを取得
        let rawActs = e.acts || [];
        if (rawActs.length === 0) rawActs = [{ id: 1, rate: 100, condition: 0 }];
		
		// ★追加: 蘇生対象（死んでいる味方）の有無を事前に判定
        const hasDeadAlly = Battle.enemies.some(ally => ally.isDead && !ally.isFled);
		
        // ① 行動フラグと制約によるフィルタリング
        const validActions = rawActs.filter(actObj => {
            const actId = (typeof actObj === 'object') ? actObj.id : actObj;
            const condition = (typeof actObj === 'object') ? (actObj.condition || 0) : 0;
            
            // Condition Check
            if (condition === 1) { // HP>=50%
                if ((e.hp / e.baseMaxHp) < 0.5) return false;
            } else if (condition === 2) { // HP<=50%
                if ((e.hp / e.baseMaxHp) > 0.5) return false;
            } else if (condition === 3) { // 状態異常時
                const hasAilment = Object.keys(e.battleStatus.ailments).length > 0;
                const hasDebuff = Object.keys(e.battleStatus.debuffs).length > 0;
                if (!hasAilment && !hasDebuff) return false;
            }

            // スキル情報の取得
            if ([1, 2, 9].includes(actId)) return true;
            const s = DB.SKILLS.find(k => k.id === actId);
            if (!s) return false;

            // MP Check
            if (Battle.isMadanteSkill(s)) { if (e.mp <= 0) return false; } // マダンテ系を対象に
            else if (e.mp < s.mp) return false;

            // Seal Check (現在の状態を参照)
            if (e.battleStatus.ailments['SpellSeal'] && (['魔法','強化','弱体'].includes(s.type))) return false;
            if (e.battleStatus.ailments['SkillSeal'] && (['物理','特殊'].includes(s.type))) return false;
            if (e.battleStatus.ailments['HealSeal'] && (['回復','蘇生','MP回復'].includes(s.type))) return false;
			// ※通常攻撃(ID:1)は除外済

            // 蘇生対象がいなければ使わない（既存ロジックの hasDeadAlly を再利用）
            if (s.type === '蘇生' && !hasDeadAlly) return false;

            return true;
        });

        // ② 行動抽選
        let selectedActId = 1; // Default
        if (validActions.length > 0) {
			// ★追加: 重みを計算するヘルパー（蘇生スキルのレートを30底上げする）
            const getWeight = (a) => {
                let w = (typeof a === 'object') ? (a.rate || 10) : 10;
                const s = DB.SKILLS.find(k => k.id === (a.id || a));
                if (!s) return w;
                if (Number(s.id) === 1) {
                    w *= 1.45;
                } else if (Battle.isAutoOffensiveSkill(s)) {
                    w *= 1.25;
                } else if (s.type === '強化' || s.type === '弱体' || s.buff || s.debuff || s.buff_reset || s.debuff_reset) {
                    w *= 0.45;
                }
                if (hasDeadAlly && s.type === '蘇生') w += 30;
                return Math.max(1, Math.floor(w));
            };
			
            // ★修正: totalWeight の計算とループ内の減算に getWeight を使用
            let totalWeight = validActions.reduce((sum, a) => sum + getWeight(a), 0);

            if (totalWeight <= 0) {
                const rndObj = validActions[Math.floor(Math.random() * validActions.length)];
                selectedActId = (typeof rndObj === 'object') ? rndObj.id : rndObj;
            } else {
                let r = Math.random() * totalWeight;
                for (const act of validActions) {
                    r -= getWeight(act); // ★修正
                    if (r < 0) {
                        selectedActId = (typeof act === 'object') ? act.id : act;
                        break;
                    }
                }
            }
        }

        // ③ 結果データの構築
        let actionType = 'enemy_attack'; 
        let skillData = null;
        let targetScope = 'single'; 

        if (selectedActId === 9) { actionType = 'flee'; }
        else if (selectedActId === 2) { actionType = 'defend'; }
        else if (selectedActId !== 1) {
            const skill = DB.SKILLS.find(s => s.id === selectedActId);
            if (skill) {
                actionType = 'skill';
                skillData = skill;
                targetScope = skill.target; 
            }
        }
        
        // 優先度の取得(速度計算用には使わないがデータとして返す)
        let priority = 0;
        if (actionType === 'defend') priority = 1;
        else if (skillData && skillData.priority) priority = skillData.priority;

        return { type: actionType, data: skillData, targetScope: targetScope, priority: priority };
    },

	executeTurn: async () => {
        Battle.phase = 'execution';
        const nameDiv = Battle.getEl('battle-actor-name');
        if(nameDiv) nameDiv.style.display = 'none';
        Battle.log("--- ターン開始 ---");
		
		// ★追加: 先制攻撃時のメッセージ
        if (Battle.isPreemptive) {
            Battle.log("<span style='color:#44ff44; font-weight:bold;'>まものたちは おどろき とまどっている！</span>");
        }

        // [準備]全員のターン経過フラグと「今ターンの死亡フラグ」をリセット
        [...Battle.party, ...Battle.enemies].forEach(a => { 
            if(a) {
                a.turnProcessed = false;
                a.hasDiedThisTurn = false; 
            }
        });

        // 1. 敵の行動決定 (★先制攻撃フラグが立っている場合は、敵の行動をキューに入れない)
        if (!Battle.isPreemptive) {
            Battle.enemies.forEach(e => {
                if (!e.isDead && !e.isFled) {
                    const count = e.actCount || 1;
                    for(let i=0; i<count; i++) {
                        const decision = Battle.decideEnemyAction(e);
                        let spd = Battle.getBattleStat(e, 'spd');
                        const finalSpeed = (spd * (0.8 + Math.random() * 0.4)) + (decision.priority * 100000);
                        Battle.commandQueue.push({
                            type: decision.type, actor: e, speed: finalSpeed, isEnemy: true,
                            data: decision.data, targetScope: decision.targetScope, target: null 
                        });
                    }
                }
            });
        }
        
        // 2. プレイヤーコマンドの整理
        const playerCommands = Battle.commandQueue.filter(c => !c.isEnemy && c.type !== 'skip' && c.type !== 'defend');
        Battle.commandQueue = Battle.commandQueue.filter(c => c.isEnemy || c.type === 'skip' || c.type === 'defend'); 
        
        for(let cmd of playerCommands) {
            const actor = cmd.actor;
            // ★特性 8, 47, 48 等の追加行動系は別途フラグ管理されるが、ここでは既存の doubleAction/fastestAction を維持
            // 確率（ここでは20%）を判定に加える
			const isDouble = (actor.passive && actor.passive.doubleAction && Math.random() < 0.2); 
			const isFast = (actor.passive && actor.passive.fastestAction && Math.random() < 0.2);
			
            if (isFast) { 
                cmd.speed = (Battle.getBattleStat(actor, 'spd') * 1.1) + (10 * 100000); 
                Battle.log(`${actor.name}は最速で行動する！`); 
            }
            Battle.commandQueue.push(cmd);
            if (isDouble) { 
                let extra = { ...cmd }; 
                extra.speed = cmd.speed - 1; 
                Battle.commandQueue.push(extra); 
                Battle.log(`${actor.name}は2回行動する！`); 
            }
        }

        // 3. 行動順の確定
        Battle.commandQueue.sort((a, b) => b.speed - a.speed);

        // 4. 行動実行ループ
        for (const cmd of Battle.commandQueue) {
            if (!Battle.active) break;
            const actor = cmd.actor;
            
            // ★修正：死亡中、逃走済み、または「このターン中に一度でも死んだ」場合はスキップ
            if (cmd.type === 'skip' || !actor || actor.hp <= 0 || actor.isFled || actor.hasDiedThisTurn) continue;

            // --- AI再評価ロジック等は既存維持 ---
            if (Battle.auto && cmd.isAuto && !cmd.isEnemy && cmd.type === 'skill') {
                const sk = cmd.data; const t = cmd.target; let isRedundant = false;
                const isAll = (cmd.targetScope === '全体' || t === 'all_ally');
                if (sk.type === '蘇生') isRedundant = isAll ? !Battle.party.some(p => p.isDead) : (t && typeof t === 'object' && !t.isDead);
                else if (sk.type.includes('回復')) isRedundant = isAll ? !Battle.party.some(p => !p.isDead && (p.hp / p.baseMaxHp) < 0.9) : (t && typeof t === 'object' && (t.hp / t.baseMaxHp) >= 0.9);
                else if (sk.CureAilments) isRedundant = isAll ? !Battle.party.some(p => !p.isDead && Object.keys(p.battleStatus.ailments).length > 0) : (t && Object.keys(t.battleStatus.ailments).length === 0);
                if (isRedundant) {
                    const reAction = Battle.decideAutoAction(actor);
                    cmd.type = reAction.type; cmd.target = reAction.target; cmd.data = reAction.data; cmd.targetScope = reAction.targetScope;
                    Battle.log(`<span style="color:#aaa; font-size:0.9em;">(状況の変化により ${actor.name} は行動を変更)</span>`);
                }
            }
            
            // ★修正: 敵の行動とターゲットの再評価
            if (cmd.isEnemy) { 
                const reD = Battle.decideEnemyAction(actor); 
                cmd.type = reD.type; 
                cmd.data = reD.data; 
                cmd.targetScope = reD.targetScope; 
                // 行動が再決定されたらターゲットも再設定する必要があるため一旦クリア
                cmd.target = null; 
            }

            // ★修正: ターゲット選定（特性 43:挑発 / 44:潜伏 を考慮）
            if (cmd.isEnemy && !cmd.target) {
                const isSupport = Battle.isSupportSkill(cmd.data);
                if (cmd.targetScope === '自分') {
                    cmd.target = actor;
                } else if (cmd.targetScope === '全体') {
                    cmd.target = isSupport ? 'all_enemy' : 'all_party';
                } else if (cmd.targetScope === 'ランダム') {
                    cmd.target = 'random';
                } else {
                    // 単体スキルの場合
                    if (isSupport) {
                        // 補助スキルの場合は敵側（モンスター陣営）を狙う
                        let pool = [];
                        if (cmd.data && cmd.data.type === '蘇生') {
                            pool = Battle.enemies.filter(e => e.isDead && !e.isFled);
                        } else {
                            pool = Battle.enemies.filter(e => Battle.isBattleAlive(e));
                        }
                        cmd.target = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : actor;
                    } else {
                        // 攻撃スキルの場合はプレイヤー側（パーティ陣営）を狙う
                        const aliveParty = Battle.party.filter(p => Battle.isBattleAlive(p));
                        if (aliveParty.length > 0) {
                            // --- ヘイト（狙われやすさ）計算 ---
                            const weights = aliveParty.map(p => {
                                let w = 100; // 基礎値
                                if (typeof PassiveSkill !== 'undefined') {
                                    // 特性 43:挑発 (+) と 特性 44:潜伏 (-) を加算
                                    w += PassiveSkill.getSumValue(p, 'target_rate_base');
                                }
                                return Math.max(1, w); // 最低値を1に設定
                            });

                            const totalWeight = weights.reduce((a, b) => a + b, 0);
                            let random = Math.random() * totalWeight;
                            let selectedIndex = 0;
                            for (let i = 0; i < weights.length; i++) {
                                random -= weights[i];
                                if (random <= 0) {
                                    selectedIndex = i;
                                    break;
                                }
                            }
                            cmd.target = aliveParty[selectedIndex];
                        } else {
                            cmd.target = null;
                        }
                    }
                }
            }

            // ★修正：怯え判定（特例：行動時にのみ消費）
            if (actor.battleStatus.ailments['Fear']) {
                const f = actor.battleStatus.ailments['Fear'];
                f.turns--; // 行動を試みた時点で1消費
                
                let fearWoreOff = false;
                if (f.turns <= 0) {
                    delete actor.battleStatus.ailments['Fear'];
                    fearWoreOff = true;
                }

                if (Math.random() < 0.7) {
                    Battle.log(`${actor.name}は 怯えて動けない！`);
                    if (fearWoreOff) Battle.log(`${actor.name}の 怯え が解けた！`);
                    await Battle.onActionEnd(actor); // 行動直後のダメージ/リジェネ
                    continue;
                } else if (fearWoreOff) {
                    Battle.log(`${actor.name}の 怯え が解けた！`);
                }
            }

            // 敵の逃走
            if (cmd.type === 'flee') {
                Battle.log(`${cmd.actor.name}は逃げ出した！`);
                cmd.actor.isFled = true; cmd.actor.hp = 0; Battle.renderEnemies();
                if (Battle.checkFinish()) return; continue;
            }

            // ターゲット再チェック（死んでいる対象を避ける）
            if (cmd.target && typeof cmd.target === 'object' && (cmd.target.isDead || cmd.target.isFled)) {
                if (Battle.enemies.includes(cmd.target)) {
                    cmd.target = Battle.getRandomAliveEnemy();
                } else if (Battle.party.includes(cmd.target) && cmd.data?.type !== '蘇生') {
                    const aliveParty = Battle.party.filter(p => Battle.isBattleAlive(p));
                    cmd.target = aliveParty.length > 0 ? aliveParty[Math.floor(Math.random() * aliveParty.length)] : null;
                }
            }

            // 行動実行
            await Battle.processAction(cmd);
            
            // 行動直後のダメージ/リジェネ処理
            await Battle.onActionEnd(actor);
            
            // 死亡状態の更新
            Battle.updateDeadState();

            Battle.renderEnemies(); Battle.renderPartyStatus();
            if (Battle.checkFinish()) return;
            await Battle.resultWait(500);
			Battle.log("<br>"); 
            await Battle.resultWait(50);
        }
        
        // 全行動終了後に一括で持続時間および再生特性を更新
        await Battle.processEndOfRound();

        // ★修正: ボス自然回復（重複）を削除 (processEndOfRound 内に統合済みのため)
		
        // ★追加: ターン終了時に先制・不意打ちフラグをリセットして次ターンから通常通りにする
        Battle.isPreemptive = false;
        Battle.isAmbushed = false;
		
        Battle.saveBattleState();
		Battle.startInputPhase();
    },
	
    // ターン終了時に全員の状態異常・バフの持続時間を更新する
    processEndOfRound: async () => {
        const allParticipants = [...Battle.party, ...Battle.enemies];

        for (const actor of allParticipants) {
            if (!actor || actor.isDead || actor.isFled) continue;
            const b = actor.battleStatus;
            if (!b) continue;

            // [1] 持続時間の更新 (怯え以外を一括カウントダウン)
            ['buffs', 'debuffs', 'ailments'].forEach(cat => {
                for (let key in b[cat]) {
                    if (key === 'Fear') continue; // ★怯えはここでは判定しない

                    const eff = b[cat][key];
                    if (eff.turns !== undefined && eff.turns !== null) {
                        eff.turns--;
                        if (eff.turns <= 0) {
                            const getDisplayName = (k) => {
                                if (k.startsWith('resists_')) return (Battle.statNames[k.replace('resists_', '')] || k) + "耐性";
                                return Battle.statNames[k] || k;
                            };
                            const dispName = getDisplayName(key);
                            if (cat === 'buffs') Battle.log(`${actor.name}の ${dispName} アップの効果が切れた！`);
                            if (cat === 'debuffs') Battle.log(`${actor.name}の ${dispName} ダウンの効果が切れた！`);
                            if (cat === 'ailments') Battle.log(`${actor.name}の ${dispName} が解けた！`);
                            delete b[cat][key];
                        }
                    }
                }
            });

            // [2] 回復処理（パッシブ特性：再生・魔力循環・ボス自動回復）
            if (actor.hp > 0) {
                let totalHpRegenPct = 0;
                let totalMpRegenPct = 0;

                // --- 特性による計算 (PassiveSkill.js 参照) ---
                if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue) {
                    // 特性 52: 再生 (Skill %)
                    totalHpRegenPct += PassiveSkill.getSumValue(actor, 'turn_hp_regen_pct');
                    // 特性 53: 魔力循環 (Skill %)
                    totalMpRegenPct += PassiveSkill.getSumValue(actor, 'turn_mp_regen_pct');
                }

                // --- 既存のレガシーパッシブおよびボスの自動回復 ---
                // 既存の hpRegen (一律 5% 扱い)
                if (actor.passive && actor.passive.hpRegen) {
                    totalHpRegenPct += 5;
                }
                
                // ボス等の個別データに設定された自動回復 (autoRegen プロパティがある場合)
                //if (actor.autoRegen) {
                //    totalHpRegenPct += actor.autoRegen;
                //}

                // --- HP回復実行 ---
                if (totalHpRegenPct > 0 && actor.hp < actor.baseMaxHp) {
                    const recHp = Math.floor(actor.baseMaxHp * (totalHpRegenPct / 100));
                    if (recHp > 0) {
                        actor.hp = Math.min(actor.baseMaxHp, actor.hp + recHp);
                        // ボスか味方かでログを少し変えるなど、演出の統合
                        if (actor.isBoss) {
                            //Battle.log(`${actor.name}のHPが ${recHp} 回復`);
                        } else {
                            //Battle.log(`${actor.name}のHPが ${recHp} 回復`);
                        }
                    }
                }

                // --- MP回復実行 ---
                if (totalMpRegenPct > 0 && actor.mp < actor.baseMaxMp) {
                    const recMp = Math.floor(actor.baseMaxMp * (totalMpRegenPct / 100));
                    if (recMp > 0) {
                        actor.mp = Math.min(actor.baseMaxMp, actor.mp + recMp);
                        //Battle.log(`${actor.name}は魔力循環により MPが ${recMp} 回復した`);
                    }
                }
            }
        }
        
        // 画面表示の更新
        Battle.renderEnemies();
        Battle.renderPartyStatus();
    },
	
	onActionEnd: async (actor) => {
        if (!actor || actor.hp <= 0) return;
        const b = actor.battleStatus;
        if (!b) return;

        // [1] 状態異常ダメージ (行動ごとに発生)
        let dmgRate = 0;
        let msgType = '';
        if (b.ailments['Shock']) { dmgRate = 0.15; msgType = '感電'; }
        else if (b.ailments['ToxicPoison']) { dmgRate = 0.10; msgType = '猛毒'; }
        else if (b.ailments['Poison']) { dmgRate = 0.05; msgType = '毒'; }

        if (dmgRate > 0) {
            let dmg = Math.floor(actor.baseMaxHp * dmgRate);
            if (dmg < 1) dmg = 1;
            actor.hp -= dmg;
            Battle.log(`${actor.name}は ${msgType}のダメージを ${dmg} 受けた！`);
            if (actor.hp <= 0) { 
                Battle.markDefeated(actor); 
                return;
            }
        }

        // [2] バフによるリジェネ処理 (行動ごとに発生)
        if (b.buffs['HPRegen']) {
            let rec = Math.floor(actor.baseMaxHp * b.buffs['HPRegen'].val);
            if (rec > 0) {
                actor.hp = Math.min(actor.baseMaxHp, actor.hp + rec);
                Battle.log(`${actor.name}のHPが ${rec} 回復した！`);
            }
        }
        if (b.buffs['MPRegen']) {
            let rec = Math.floor(actor.baseMaxMp * b.buffs['MPRegen'].val);
            if (rec > 0) {
                actor.mp = Math.min(actor.baseMaxMp, actor.mp + rec);
                Battle.log(`${actor.name}のMPが ${rec} 回復した！`);
            }
        }
    },
	
	// ターン経過（持続時間減少）を処理する共通関数
    isBattleAlive: (unit) => {
        return !!(unit && !unit.isFled && !unit.isDead && Number(unit.hp || 0) > 0);
    },

    markDefeated: (unit, message) => {
        if (!unit || unit.isFled || Number(unit.hp || 0) > 0) return false;
        const alreadyDead = !!unit.isDead;
        unit.hp = 0;
        unit.isDead = true;
        unit.hasDiedThisTurn = true;
        if (!alreadyDead && message !== false) Battle.log(message || `${unit.name}は倒れた！`);
        return !alreadyDead;
    },

    advanceActorTurn: (actor) => {
        const b = actor.battleStatus;
        if (!b) return;
        ['buffs', 'debuffs', 'ailments'].forEach(cat => {
            for (let key in b[cat]) {
                const eff = b[cat][key];
                if (eff.turns !== undefined && eff.turns !== null) {
                    eff.turns--;
                    if (eff.turns <= 0) {
                        const getDisplayName = (k) => {
                            if (k.startsWith('resists_')) return (Battle.statNames[k.replace('resists_', '')] || k) + "耐性";
                            return Battle.statNames[k] || k;
                        };
                        const dispName = getDisplayName(key);
                        if (cat === 'buffs') Battle.log(`${actor.name}の ${dispName} アップの効果が切れた！`);
                        if (cat === 'debuffs') Battle.log(`${actor.name}の ${dispName} ダウンの効果が切れた！`);
                        if (cat === 'ailments') Battle.log(`${actor.name}の ${dispName} が解けた！`);
                        delete b[cat][key];
                    }
                }
            }
        });
        actor.turnProcessed = true; // 処理済みフラグを立てる
    },
	
	processAction: async (cmd) => {
        const actor = cmd.actor;
        const data = cmd.data;
        if (!actor || (cmd.type !== 'item' && !Battle.isBattleAlive(actor))) return;
        const actorName = Battle.getColoredName(actor);

        // --- [1] 実行時の封印チェック ---
        if (cmd.type !== 'item' && cmd.type !== 'defend') {
            const type = data ? data.type : '通常攻撃';
            const ailments = actor.battleStatus.ailments;

            if (ailments['SpellSeal']) {
                if (['魔法', '強化', '弱体'].includes(type)) {
                    Battle.log(`${actorName}は 呪文が封じられていて動けない！`);
                    return;
                }
            }

            if (ailments['SkillSeal']) {
                if (['物理', '特殊'].includes(type) && type !== '通常攻撃') {
                    Battle.log(`${actorName}は 特技が封じられていて動けない！`);
                    return;
                }
            }

            if (ailments['HealSeal']) {
                if (type.includes('回復') || type === '蘇生') {
                    Battle.log(`${actorName}は 回復が封じられていて動けない！`);
                    return;
                }
            }
        }

        // --- [2] 防御の処理 ---
        if (cmd.type === 'defend') {
            Battle.log(`${actor.name}は身を守っている`);
            actor.status = actor.status || {};
            actor.status.defend = true;
            return;
        }
        if (actor.status) actor.status.defend = false;

        // --- [3] アイテムの処理 ---
        if (cmd.type === 'item') {
            const item = data;
            Battle.log(`${actor.name}は${item.name}を使った！`);
            if (App.data.items && App.data.items[item.id] > 0) {
                if (item.type !== '貴重品') {
                    App.data.items[item.id]--;
                    if (App.data.items[item.id] <= 0) delete App.data.items[item.id];
                }
                const targets = (cmd.target === 'all_ally') ? Battle.party : [cmd.target];
                for (let t of targets) {
                    if (!t) continue;
                    if (item.type === '蘇生') {
                        if (t.isDead) { 
                            t.isDead = false; 
                            let rate = (item.rate !== undefined) ? item.rate : 1;
                            t.hp = Math.floor(t.baseMaxHp * rate); 
                            if(t.hp < 1) t.hp = 1;
                            Battle.log(`${t.name}は生き返った！`); 
                        }
                        else Battle.log(`${t.name}には効果がなかった`);
                    } else if (item.type === 'HP回復') {
                        if (!t.isDead) {
                            let rec = item.val; if (item.val >= 9999) rec = t.baseMaxHp;
                            t.hp = Math.min(t.baseMaxHp, t.hp + rec);
                            Battle.log(`${t.name}のHPが${rec}回復！`);
                        }
                    } else if (item.type === 'MP回復') {
                        if (!t.isDead) {
                            let rec = item.val; if (item.val >= 9999) rec = t.baseMaxMp;
                            t.mp = Math.min(t.baseMaxMp, t.mp + Math.floor(rec));
                            Battle.log(`${t.name}のMPが${rec}回復！`);
                        }
                    } else if (item.type === '状態異常回復' && !t.isDead) {
                        let cured = false;
                        if (item.cures) {
                            item.cures.forEach(ailment => {
                                if (t.battleStatus.ailments[ailment]) {
                                    delete t.battleStatus.ailments[ailment];
                                    const name = Battle.statNames[ailment] || ailment;
                                    Battle.log(`${t.name}の ${name} が治った！`);
                                    cured = true;
                                }
                            });
                        }
                        if (item.CureAilments) {
                            if (Object.keys(t.battleStatus.ailments).length > 0) {
                                t.battleStatus.ailments = {};
                                Battle.log(`${t.name}の状態異常が 全て治った！`);
                                cured = true;
                            }
                        }
                        if (item.debuff_reset) {
                            if (Object.keys(t.battleStatus.debuffs).length > 0) {
                                t.battleStatus.debuffs = {}; 
                                Battle.log(`${t.name}の 能力低下が 元に戻った！`);
                                cured = true;
                            }
                        }
                        if (!cured) Battle.log(`${t.name}には効果がなかった`);
                    }
                }
            }
            Battle.renderPartyStatus();
            return;
        }

        // --- [4] 攻撃/スキル準備 ---
        let skillName = "攻撃";
        let isPhysical = true;
        let skillRate = 1.0; 
        let baseDmg = 0;
        let mpCost = 0;
        let effectType = null;
        let element = null;
        let hitCount = 1;
        let rawSuccessRate = 100;

        if (cmd.type === 'skill') {
            skillName = data.name;
            effectType = data.type;
            isPhysical = (effectType === '物理' || effectType === '通常攻撃');
            if (data.rate !== undefined) skillRate = data.rate;
            baseDmg = data.base || 0;
            mpCost = data.mp || 0;
            element = data.elm;
            hitCount = (typeof data.count === 'number') ? data.count : 1;
            if (data.SuccessRate !== undefined) rawSuccessRate = data.SuccessRate;

            // 特性 17: 魔力増幅 (消費MP 1.5倍)
            if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue(actor, 'mag_amp_cost_mult') > 0) {
                mpCost = Math.floor(mpCost * 1.5);
            }

            if (Battle.isMadanteSkill(data)) { mpCost = actor.mp; }
            if (actor.mp < mpCost && !Battle.isMadanteSkill(data)) {
                Battle.log(`${actor.name}は${skillName}を唱えたがMPが足りない！`);
                return;
            }
            actor.mp -= mpCost;
            Battle.renderPartyStatus();
        }

        // 特性 8: 二刀流 (特殊、強化、弱体、回復、攻撃、魔法、ブレス、物理の全てに対応)
        let totalActionLoops = 1;
        
        // アイテム使用以外で、かつ actor が「二刀流」の特性を持っている場合を判定
        const canDualWield =
		  cmd.type !== 'item' &&
		  typeof PassiveSkill !== 'undefined' &&
		  typeof PassiveSkill.getSumValue === 'function' &&
		  PassiveSkill.getSumValue(actor, 'dual_dmg_mult') > 0;

        if (canDualWield) {
            // 対象となるタイプを網羅 (物理・通常・魔法・ブレス・特殊・強化・弱体・回復)
            const isApplicableType = isPhysical || ['魔法', 'ブレス', '特殊', '強化', '弱体', '回復'].includes(effectType);
            
            if (isApplicableType) {
                totalActionLoops = 2;
            }
        }

        // ループの前に元のレートを保持
        const baseSkillRate = skillRate;
		
		for (let loop = 0; loop < totalActionLoops; loop++) {
			// ループごとに現在の倍率を決定
            let currentSkillRate = baseSkillRate;
			
            if (loop === 1) {
                // ★修正: 追撃前に有効なターゲット（生存者）がいるかチェック
                let hasValidTarget = false;
                // 全体・ランダム攻撃・範囲指定文字の場合
                if (cmd.targetScope === '全体' || cmd.targetScope === 'ランダム' || ['all_enemy', 'all_ally'].includes(cmd.target)) {
                    const pool = cmd.isEnemy ? Battle.party.filter(p => Battle.isBattleAlive(p)) : Battle.enemies.filter(e => Battle.isBattleAlive(e));
                    if (pool.length > 0) hasValidTarget = true;
                } 
                // 単体攻撃の場合
                else if (cmd.target && Battle.isBattleAlive(cmd.target)) {
                    hasValidTarget = true;
                }

                // ターゲットが全滅、または指定ターゲットが死亡している場合はループを終了（追撃しない）
                if (!hasValidTarget) break;

				Battle.log(`${actor.name}の 追撃！`);
				const dualBonus = PassiveSkill.getSumValue(actor, 'dual_dmg_mult');
                // ★元の倍率に対して二刀流補正を乗算する
                currentSkillRate = baseSkillRate * (dualBonus / 100);
            } else {
                Battle.log(`${actor.name}の${skillName}！`);
            }

            let successRate = rawSuccessRate;
            if (successRate <= 1 && successRate > 0) successRate *= 100;

            // --- [5] マダンテ系特殊処理 ---
            if (Battle.isMadanteSkill(data)) {
                let baseBaseDmg = mpCost * skillRate;
                const pool = cmd.isEnemy ? Battle.party.filter(p => Battle.isBattleAlive(p)) : Battle.enemies.filter(e => Battle.isBattleAlive(e));
                let loopTargets = [];
                if (cmd.targetScope === 'ランダム') {
                    if (pool.length > 0) loopTargets = [pool[0]];
                } else if (cmd.targetScope === '単体' && cmd.target) {
                    if (Battle.isBattleAlive(cmd.target)) loopTargets = [cmd.target];
                } else {
                    loopTargets = pool;
                }
                for (let t of loopTargets) {
                    if (!Battle.isBattleAlive(actor)) break;
                    if (!t) continue;
                    for (let i = 0; i < hitCount; i++) {
                        if (!Battle.isBattleAlive(actor)) break;
                        let targetToHit = (cmd.targetScope === 'ランダム') ? pool[Math.floor(Math.random() * pool.length)] : t;
                        if (!Battle.isBattleAlive(targetToHit)) continue;
                        
                        let bonusRate = 0, cutRate = 0, isImmune = false; 
                        
                        if (element) {
                            const elmAtkVal = (Battle.getBattleStat(actor, 'elmAtk') || {})[element] || 0;
                            bonusRate += elmAtkVal;
                            
                            // ★属性貫通計算の修正
							let pierce = 0;
							if (typeof PassiveSkill !== 'undefined') {
								// 全属性耐性無視 (ID 30: 解析)
								pierce += PassiveSkill.getSumValue(actor, 'all_elm_pierce_pct');
								// 個別属性耐性無視 (ID 23-29: 火の扱いなど)
								const spKey = {火:'fire',水:'water',風:'wind',雷:'thunder',光:'light',闇:'dark',混沌:'chaos'}[element];
								if(spKey) pierce += PassiveSkill.getSumValue(actor, spKey + '_pierce_pct');
							}

                            const baseRes = (targetToHit.getStat('elmRes') || {})[element] || 0;
                            const buffRes = (targetToHit.battleStatus.buffs['elmResUp'] || {}).val || 0;
                            const debuffRes = (targetToHit.battleStatus.debuffs['elmResDown'] || {}).val || 0; 
                            
                            let resVal = baseRes + buffRes - debuffRes - pierce;
                            if (resVal >= 100) isImmune = true; else cutRate += resVal;             
                        }
                        
                        const finDmgVal = Battle.getBattleStat(actor, 'finDmg') || 0; bonusRate += finDmgVal;
                        let finRed = Battle.getBattleStat(targetToHit, 'finRed') || 0;
                        if (targetToHit.passive && targetToHit.passive.finRed10) finRed += 10;
                        if (finRed > 80) finRed = 80; cutRate += finRed;
                        
                        let dmg = baseBaseDmg;
                        if (dmg > 0) {
                            dmg = dmg * (1.0 + bonusRate / 100) * (1.0 - cutRate / 100) * (0.85 + Math.random() * 0.3); 
                            if (targetToHit.status && targetToHit.status.defend) dmg *= 0.5;
                            dmg = Math.floor(dmg); 
                            if (!isImmune && dmg < 1) dmg = 1; 
                        }
                        if (isImmune) dmg = 0;
                        targetToHit.hp -= dmg;

                        Battle.recordMaxDamage(actor, data, dmg, cmd);

                        if (dmg > 0) {
                            let dRate = (data && data.drain) ? 0.5 : (actor.passive?.drain ? 0.2 : 0);
                            if (dRate > 0) {
                                const dAmt = Math.floor(dmg * dRate);
                                const oldHp = actor.hp; actor.hp = Math.min(actor.baseMaxHp, actor.hp + dAmt);
                                if(actor.hp - oldHp > 0) Battle.log(`${actor.name}は吸収効果でHPを${actor.hp - oldHp}回復した！`);
                            }
                            if (actor.passive?.drainMp) { 
                                const mpAmt = Math.max(1, Math.floor(dmg * 0.01));
                                actor.mp = Math.min(actor.baseMaxMp, actor.mp + mpAmt);
                            }
                        }

                        let dmgColor = element ? ({火:'#f88',水:'#88f',雷:'#ff0',風:'#8f8',光:'#ffc',闇:'#a8f',混沌:'#d4d'}[element] || '#fff') : '#fff';
                        if (dmg === 0) Battle.log(`ミス！ ${targetToHit.name}は ダメージを うけない！`);
                        else Battle.log(`${targetToHit.name}に<span style="color:${dmgColor}">${dmg}</span>のダメージ！`);
                        // [修正] マダンテ系ダメージでも根性判定を行う
						if (targetToHit.hp <= 0) {
							const gutsChance = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(targetToHit, 'guts_mult') : 0;
							if (gutsChance > 0 && Math.random() * 100 < gutsChance) {
								targetToHit.hp = 1;
								Battle.log(`${targetToHit.name}は 根性で 踏みとどまった！`);
							} else {
								Battle.markDefeated(targetToHit);
							}
						}
                        Battle.renderEnemies(); Battle.renderPartyStatus();
                        if (hitCount > 1) await Battle.resultWait(150);
                    }
                }
                if (loop === 0 && totalActionLoops > 1) continue; 
                await Battle.resultWait(500);
                return;
            }

            // --- [6] ターゲット特定 ---
            let targets = [];
            let skillScope = cmd.targetScope;
            if (!skillScope && cmd.target === 'all_enemy') skillScope = '全体';
            if (!skillScope && cmd.target === 'all_ally') skillScope = '全体';
            if (!skillScope && cmd.target === 'random') skillScope = 'ランダム';
            
            const isSupport = Battle.isSupportSkill(data);

            if (skillScope === '全体') {
                 if (cmd.isEnemy) {
                     targets = isSupport ? Battle.enemies.filter(e => !e.isFled) : Battle.party.filter(p => Battle.isBattleAlive(p));
                 } else {
                     targets = isSupport ? Battle.party.filter(p => p) : Battle.enemies.filter(e => Battle.isBattleAlive(e));
                 }
            } else if (skillScope === 'ランダム') {
                 let pool = cmd.isEnemy ? (isSupport ? Battle.enemies.filter(e => Battle.isBattleAlive(e)) : Battle.party.filter(p => Battle.isBattleAlive(p))) : (isSupport ? Battle.party.filter(p => Battle.isBattleAlive(p)) : Battle.enemies.filter(e => Battle.isBattleAlive(e)));
                 if(pool.length > 0) targets = [pool[Math.floor(Math.random() * pool.length)]];
            } else {
                targets = [cmd.target];
            }

            // --- [7] 内部関数：効果適用ロジック (★特性ID31, 32の組み込み) ---
            const applyEffects = (t, d, ailmentMult = 1.0) => {
                // HP0・戦闘不能の対象には、追加状態異常・弱体・割合ダメージなどを発生させない。
                if (!t || t.isFled || !Battle.isBattleAlive(t)) return;
                // 特性による成功率ボーナスの算出
				const assaBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_instantdeath_bonus') : 0;
                const bodyBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_body_bonus') : 0;
                const curseBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_curse_bonus') : 0; // ★追加

                let currentCheckRate = successRate;
                
                // ボーナスを加味した確率判定関数
                const checkProc = (val, bonus = 0) => {
                    let rate = (typeof val === 'number') ? val : successRate;
                    rate = (rate + bonus) * ailmentMult;
                    currentCheckRate = rate; 
                    return Math.random() * 100 < rate;
                };

                const checkResist = (type) => {
                    const resistKey = Battle.RESIST_MAP[type] || type;
                    const resistVal = (Battle.getBattleStat(t, 'resists') || {})[resistKey] || 0;
                    const finalChance = Math.max(0, currentCheckRate - resistVal);
                    if (Math.random() * 100 < finalChance) return false; 
                    return true; 
                };

                const ailmentMessages = {
                    Poison: "どくにかかった",
                    ToxicPoison: "もうどくにかかった",
                    Shock: "感電した",
                    Debuff: "ステータスが低下した",
                    Fear: "おびえている",
                    SpellSeal: "呪文を封じられた",
                    SkillSeal: "特技を封じられた",
                    HealSeal: "回復を封じられた"
                };
                const addA = (k, msg, chance=null) => {
                    const text = ailmentMessages[k] || msg || `${Battle.statNames[k]||k}にかかった`;
                    if (t.battleStatus.ailments[k]) {
                        const current = t.battleStatus.ailments[k];
                        current.turns = Math.max(Number(current.turns || 0), d.turn || 3);
                        if (chance !== null) current.chance = chance;
                        Battle.log(`${t.name}は ${text}！`);
                        return;
                    }
                    if (checkResist(k)) { 
                        Battle.log(`${t.name}には ${Battle.statNames[k]||k} は きかなかった！`); 
                        return; 
                    }
                    t.battleStatus.ailments[k] = { turns: d.turn || 3, chance: chance }; 
                    Battle.log(`${t.name}は ${text}！`);
                };

                if (d.buff) {
                    for (let key in d.buff) {
                        const turn = d.turn || null; 
                        if (key === 'elmResUp') {
                            t.battleStatus.buffs[key] = { val: d.buff[key], turns: turn };
                            Battle.log(`${t.name}の 全属性耐性 が あがった！`);
                        } else {
                            let cur = (t.battleStatus.buffs[key] && t.battleStatus.buffs[key].val) || 1.0;
                            t.battleStatus.buffs[key] = { val: Math.min(2.5, cur * d.buff[key]), turns: turn };
                            Battle.log(`${t.name}の ${Battle.statNames[key]||key} があがった！`);
                        }
                    }
                }
                if (d.HPRegen) { t.battleStatus.buffs['HPRegen'] = { val: d.HPRegen, turns: d.turn }; Battle.log(`${t.name}の HPが徐々に回復する！`); }
                if (d.MPRegen) { t.battleStatus.buffs['MPRegen'] = { val: d.MPRegen, turns: d.turn }; Battle.log(`${t.name}の MPが徐々に回復する！`); }
                if (d.CureAilments) { t.battleStatus.ailments = {}; Battle.log(`${t.name}の状態異常が 全て治った！`); }
                if (d.debuff_reset) { t.battleStatus.debuffs = {}; Battle.log(`${t.name}の 能力低下が 元に戻った！`); }
                
                if (d.debuff) {
                    for (let key in d.debuff) {
                        // 弱体(debuff)は「人体知識」の対象
                        if (!checkProc(successRate, bodyBonus)) continue; 
                        
                        if (checkResist(key)) {
                            Battle.log(`${t.name}には ${Battle.statNames[key] || key}低下 は きかなかった！`);
                            continue;
                        }
                        const turn = d.turn || null;
                        if (key === 'elmResDown') {
                            t.battleStatus.debuffs[key] = { val: d.debuff[key], turns: turn };
                            Battle.log(`${t.name}の 全属性耐性 が さがった！`);
                        } else {
                            let cur = (t.battleStatus.debuffs[key] && t.battleStatus.debuffs[key].val) || 1.0;
                            t.battleStatus.debuffs[key] = { val: Math.max(0.1, cur * d.debuff[key]), turns: turn };
                            Battle.log(`${t.name}の ${Battle.statNames[key]||key} がさがった！`);
                        }
                    }
                }
                if (d.buff_reset) { t.battleStatus.buffs = {}; Battle.log(`${t.name}の良い効果がかき消された！`); }
                
				// 1. 毒系・感電・弱体は「人体知識」の対象
				// 元のデータ(d.Poison等)が 0 より大きい場合のみ、ボーナスを乗せて判定する
				if ((d.Poison > 0) && checkProc(d.Poison, bodyBonus)) addA('Poison', `${t.name}は どくにおかされた！`);
				if ((d.ToxicPoison > 0) && checkProc(d.ToxicPoison, bodyBonus)) addA('ToxicPoison', `${t.name}は もうどくにおかされた！`);
				if ((d.Shock > 0) && checkProc(d.Shock, bodyBonus)) addA('Shock', `${t.name}は 感電してしまった！`);
				if ((d.Debuff > 0) && checkProc(d.Debuff, bodyBonus)) addA('Debuff', `${t.name}の ステータスが低下した！`);

				// 2. 怯え・封印系は「呪い体質」の対象
				if ((d.Fear > 0) && checkProc(d.Fear, curseBonus)) addA('Fear', `${t.name}は 怯えてしまった！`, 0.5);
				if ((d.SpellSeal > 0) && checkProc(d.SpellSeal, curseBonus)) addA('SpellSeal', `${t.name}の 呪文が封じられた！`);
				if ((d.SkillSeal > 0) && checkProc(d.SkillSeal, curseBonus)) addA('SkillSeal', `${t.name}の 特技が封じられた！`);
				if ((d.HealSeal > 0) && checkProc(d.HealSeal, curseBonus)) addA('HealSeal', `${t.name}の 回復が封じられた！`);
                
                // [修正] 割合ダメージにも「呪い体質(curseBonus)」を適用し、死亡時の根性判定も追加
				if (d.PercentDamage) {
					const assaBonus = (typeof PassiveSkill !== 'undefined')
						? PassiveSkill.getSumValue(actor, 'proc_instantdeath_bonus')
						: 0;
					
					// 成功率 = (スキルの成功率 + 暗殺術ボーナス) × 会心等の倍率
					let finalCheckRate = (successRate + assaBonus) * ailmentMult;
					
					const resV = (Battle.getBattleStat(t, 'resists') || {}).InstantDeath || 0; // 割合ダメ耐性は即死耐性を参照
					
					if (Math.random() * 100 < finalCheckRate && Math.random() * 100 < (100 - resV)) {
						let pdmg = Math.max(1, Math.floor(t.hp * d.PercentDamage));
						t.hp -= pdmg; 
						Battle.log(`${t.name}に ${pdmg} のダメージ！`);
						
						if (t.hp <= 0) {
							const gutsChance = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(t, 'guts_mult') : 0;
							if (gutsChance > 0 && Math.random() * 100 < gutsChance) {
								t.hp = 1;
								Battle.log(`${t.name}は 根性で 踏みとどまった！`);
							} else {
									Battle.markDefeated(t);
							}
						}
					} else {
						Battle.log(`${t.name}にはきかなかった！`);
					}
				}
            };

            // --- [8] メイン実行ループ ---
            for (let t of targets) {
                if (!Battle.isBattleAlive(actor)) break;
                if (!t) continue;
                if (effectType && ['回復','蘇生','強化','弱体','特殊','MP回復'].includes(effectType)) {
                    if (successRate < 100 && Math.random() * 100 > successRate) {
                        Battle.log(`ミス！ ${t.name}には効かなかった！`);
                        continue;
                    }
                    if (effectType === '蘇生') {
                        if (t.isDead) { 
                            t.isDead = false; 
                            t.hp = Math.max(1, Math.floor(t.baseMaxHp * (skillRate !== undefined ? skillRate : 0.5)));
                            Battle.log(`${t.name}は生き返った！`); 
                        } else { 
                            Battle.log(`${t.name}には効果がなかった`); 
                            continue; 
                        }
                    }
                    if (effectType === '回復' && Battle.isBattleAlive(t)) {
						const healBonus = 1 + (PassiveSkill.getSumValue(actor, 'heal_pct') / 100);
						let rec;
						if (data.ratio) {
							rec = Math.floor(t.baseMaxHp * data.ratio);
						} else {
							const baseValue = data.fix ? baseDmg : (Battle.getBattleStat(actor, 'mag') * skillRate + baseDmg);
							rec = baseValue * healBonus * (0.85 + Math.random() * 0.3);
						}
						t.hp = Math.min(t.baseMaxHp, t.hp + Math.floor(rec));
						Battle.log(`${t.name}のHPが${Math.floor(rec)}回復！`);
					}
                    if (effectType === 'MP回復' && Battle.isBattleAlive(t)) {
                        let rec = data.ratio ? Math.floor(t.baseMaxMp * data.ratio) : baseDmg;
                        t.mp = Math.min(t.baseMaxMp, t.mp + Math.floor(rec));
                        Battle.log(`${t.name}のMPが${Math.floor(rec)}回復！`);
                    }
                    if (Battle.isBattleAlive(t)) applyEffects(t, data);
                    Battle.renderEnemies(); Battle.renderPartyStatus(); 
                    continue;
                }

                for (let i = 0; i < hitCount; i++) {
                    if (!Battle.isBattleAlive(actor)) break;
                    let targetToHit = t;
                    if (skillScope === 'ランダム') {
                        const pool = cmd.isEnemy ? Battle.party.filter(p => Battle.isBattleAlive(p)) : Battle.enemies.filter(e => Battle.isBattleAlive(e));
                        if (pool.length === 0) break;
                        targetToHit = pool[Math.floor(Math.random() * pool.length)];
                    }
                    if (!Battle.isBattleAlive(targetToHit)) { if (skillScope !== 'ランダム') break; continue; }

                    // --- 特性 19:献身 (かばう) ---
                    if (!isSupport) {
                        // 攻撃者が敵(cmd.isEnemy)なら「味方(party)」を、
                        // 攻撃者が味方なら「敵(enemies)」を、かばう候補として取得
                        const friends = cmd.isEnemy ? Battle.party : Battle.enemies;

                        // 同じ陣営の中から、瀕死(50%以下)の仲間を助けに来る者を探す
                        const coverTarget = friends.find(p => 
                            p && p !== targetToHit && Battle.isBattleAlive(p) &&
                            targetToHit.hp <= targetToHit.baseMaxHp * 0.5
                        );

                        if (coverTarget) {
                            const coverChance = PassiveSkill.getSumValue(coverTarget, 'cover_rate_mult');
                            if (coverChance > 0 && Math.random() * 100 < coverChance) {
                                Battle.log(`${coverTarget.name}が ${targetToHit.name}を かばった！`);
                                // 攻撃対象を「かばった者」に差し替え
                                targetToHit = coverTarget; 
                                targetToHit.isCovering = true;
                            }
                        }
                    }

                    // 1. dataが未定義（通常攻撃等）でもエラーが出ないよう data?.isPerfect を使用
                    if (!data || !data.isPerfect) {
                        let baseHit;
						
					// 二刀流(特性ID=8)の合計Lvを拾う（本人traits + 装備traits）
					const getTraitTotalLv = (entity, traitId) => {
						let lv = 0;

						if (entity.traits) {
							entity.traits.forEach(t => { if (t && t.id === traitId) lv += (t.level || 0); });
						}
						if (entity.equips) {
							Object.values(entity.equips).forEach(eq => {
								if (!eq || !eq.traits) return;
								eq.traits.forEach(t => { if (t && t.id === traitId) lv += (t.level || 0); });
							});
						}
						return lv;
					};

					// スキル本来の命中率を取得（未定義なら100）
					const baseHitRate =
					  (data && data.hitRate !== undefined) ? data.hitRate :
					  (data && data.HitRate !== undefined) ? data.HitRate :
					  100;

					// 1回目も2回目も「まずスキル命中 + hit_pct」を作る（共通）
					const hitBonus = PassiveSkill.getSumValue(actor, 'hit_pct');
					const firstHitBase = baseHitRate + hitBonus;

					if (loop === 1) {
						// --- 2回目：半減(=dual_hit_base%) + 二刀流Lv×dual_hit_mult ---
						const dualLv = getTraitTotalLv(actor, 8);

						// パッシブ(特性8)から調整可能にする
						const dualParams = (PassiveSkill.MASTER && PassiveSkill.MASTER[8] && PassiveSkill.MASTER[8].params) ? PassiveSkill.MASTER[8].params : {};
						const halfRatePct = (dualParams.dual_hit_base !== undefined) ? dualParams.dual_hit_base : 50; // 50%の部分
						const perLvPct    = (dualParams.dual_hit_mult !== undefined) ? dualParams.dual_hit_mult : 2;   // Lvあたり+2%の部分

						baseHit = (firstHitBase * (halfRatePct / 100)) + (dualLv * perLvPct);
					} else {
						// 1回目：従来通り（スキル命中 + hit_pct）
						baseHit = firstHitBase;
					}

                        // 3. targetToHit（モンスター等）の回避率が未定義の場合は 0(%) 扱いとする
                        const targetEvaBase = (targetToHit.eva !== undefined) ? targetToHit.eva : 0;
                        const targetEva = targetEvaBase + PassiveSkill.getSumValue(targetToHit, 'eva_pct');
                        
                        const finalHitChance = (baseHit * ((actor.hit || 100) / 100)) - targetEva;
                        
                        if (Math.random() * 100 > finalHitChance) {
                            Battle.log(`ミス！ ${targetToHit.name}は身をかわした！`);
                            await Battle.resultWait(200); continue; 
                        }
                    }

                    // [修正] 攻撃者が誰であっても、受ける側(targetToHit)が先制特性を持っていれば判定を行う
					if (isPhysical && !cmd.isReaction) {
						const isMonster = (targetToHit instanceof Monster);
						// モンスターなら武器制限を無視(ignoreWeapon=true)、プレイヤーなら制限あり
						const preemptRate = (typeof PassiveSkill !== 'undefined') 
							? PassiveSkill.getSumValue(targetToHit, 'preempt_rate_base', isMonster) 
							: 0;

						if (preemptRate > 0 && Math.random() * 100 < preemptRate) {
							Battle.log(`${targetToHit.name}の 先制攻撃！`);
							await Battle.executeReactionAttack(targetToHit, actor);
							if (!Battle.isBattleAlive(actor)) {
							    Battle.renderEnemies(); Battle.renderPartyStatus();
							    break;
							}
						}
					}
					
                    // --- [1] 会心・暴走判定フェーズ ---
					let isCrit = false;
					let ailmentChanceMult = 1.0;

					if (effectType !== 'ブレス') {
						// 基礎会心率 = スキル値 + 装備特性(cri_pct) + キャラステータス(actor.cri)
						const totalCritRate = (data?.critRate ?? 0) + 
											  PassiveSkill.getSumValue(actor, 'cri_pct') + 
											  (actor.cri ?? 0);

						// A. 通常の会心判定
						if (Math.random() * 100 < totalCritRate) {
							isCrit = true;
						} 
						// B. 魔法の場合のみ：スキルツリー等の magCrit パッシブによる独立 20% 判定
						else if (!isPhysical && actor.passive?.magCrit && Math.random() < 0.2) {
							isCrit = true;
						}
					}

					// --- [2] ステータス取得と防御無視判定フェーズ ---
					let atkVal = isPhysical ? Battle.getBattleStat(actor, 'atk') : Battle.getBattleStat(actor, 'mag');
					let defVal = isPhysical ? Battle.getBattleStat(targetToHit, 'def') : Battle.getBattleStat(targetToHit, 'mdef');

					let ignoreDefense = (data?.IgnoreDefense ?? false);

					// 会心・暴走が発生した場合は、物理・魔法問わず防御無視を適用
					if (isCrit) {
						ignoreDefense = true;
					} 
					// 会心でない場合のみ、各種パッシブによる確率防御無視（貫通）を判定
					else if (typeof PassiveSkill !== 'undefined') {
						// 物理：スキルツリー(atkIgnoreDef) or シナジー(pierce)
						if (isPhysical) {
							if (actor.passive?.atkIgnoreDef && Math.random() < 0.2) {
								ignoreDefense = true;
								Battle.log(`<span style="color:#ff4444; font-weight:bold;">防御を貫通！</span>`);
								}
							//if (actor.passive?.pierce && Math.random() < 0.2) ignoreDefense = true;
						}
						// ※魔法側の貫通パッシブを実装する場合はここに追加可能
					}

					// --- [3] 基礎ダメージ計算フェーズ ---
					let baseDmgCalc = 0;
					if (data?.fix) {
						baseDmgCalc = baseDmg;
					} else if (effectType === 'ブレス') {
						// ブレスは攻+魔の合計を参照
						baseDmgCalc = Math.floor(((Battle.getBattleStat(actor, 'atk') + Battle.getBattleStat(actor, 'mag')) / 6 + baseDmg));
					} else {
						// 物理・魔法：防御無視フラグにより、引き算の defVal/4 を 0 にする
						baseDmgCalc = Math.floor(((atkVal / 2) + baseDmg) - (ignoreDefense ? 0 : defVal / 4));
					}

					// 最低ダメージ保証（30%で1ダメージ）
					if (baseDmgCalc < 1) baseDmgCalc = (Math.random() < 0.3) ? 1 : 0;

					// --- [4] 特性・シナジーによる最終倍率計算フェーズ ---
					let totalMult = currentSkillRate; // 二刀流等の補正済み倍率

					// 隊列補正（物理のみ）
					if (isPhysical) {
						if (actor.formation === 'back' && !['弓', '短剣', '杖'].includes(actor.weaponType)) totalMult *= 0.5;
						if (targetToHit.formation === 'back') totalMult *= 0.5;
					}

					// 特性(PassiveSkill)による種族特効・属性強化
					if (typeof PassiveSkill !== 'undefined') {
						if (targetToHit.race === '死霊' || targetToHit.race === '魔族') totalMult *= (1 + PassiveSkill.getSumValue(actor, 'anti_demon_pct') / 100);
						if (targetToHit.race === '獣' || targetToHit.race === '獣人') totalMult *= (1 + PassiveSkill.getSumValue(actor, 'anti_beast_pct') / 100);
						if (targetToHit.race === '機械' || targetToHit.race === '無生物') totalMult *= (1 + PassiveSkill.getSumValue(actor, 'anti_machine_pct') / 100);
						if (targetToHit.race === '竜' || targetToHit.race === '竜人') totalMult *= (1 + PassiveSkill.getSumValue(actor, 'anti_dragon_pct') / 100);

						if (actor.hp <= actor.baseMaxHp * 0.5) totalMult *= (1 + PassiveSkill.getSumValue(actor, 'low_hp_dmg_mult') / 100);
						
						if (actor.revengeStack && actor.revengeStack > 0) {
							const isMonster = (actor instanceof Monster);
							const revPct = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'revenge_dmg_pct', isMonster) : 0;
							totalMult *= (1 + (actor.revengeStack * revPct) / 100);
						}
					}

					// --- [5] 会心・暴走による最終倍率適用とログ出力 ---
					if (isCrit) {
						// 防御無視に加え、ダメージを1.5倍にする（ご要望どおり魔法も1.5倍で統一）
						totalMult *= 1.5;
						
						// 会心時は状態異常付与率を1.5倍にする
						ailmentChanceMult = 1.5;
						
						if (isPhysical) {
							Battle.log(`<span style="color:#ff4444; font-weight:bold;">かいしんの一撃！</span>`);
						} else {
							Battle.log(`<span style="color:#4444ff; font-weight:bold;">魔力が暴走！</span>`);
						}
					}
					

                    let bonusRate = 0, cutRate = 0, isImmune = false;
                    if (element) {
                        bonusRate += (Battle.getBattleStat(actor, 'elmAtk') || {})[element] || 0;
                        let pierce = 0;
                        if (typeof PassiveSkill !== 'undefined') {
                            pierce = PassiveSkill.getSumValue(actor, 'all_elm_pierce_pct');
                            const spKey = {火:'fire',水:'water',風:'wind',雷:'thunder',光:'light',闇:'dark',混沌:'chaos'}[element];
                            if(spKey) pierce += PassiveSkill.getSumValue(actor, spKey + '_pierce_pct');
                        }
                        const finalRes = ((targetToHit.getStat('elmRes') || {})[element] || 0) + (targetToHit.battleStatus.buffs['elmResUp']?.val || 0) - (targetToHit.battleStatus.debuffs['elmResDown']?.val || 0) - pierce;
                        if (finalRes >= 100) isImmune = true; else cutRate += finalRes;
                    }
                    bonusRate += Battle.getBattleStat(actor, 'finDmg') || 0;
                    let finRed = (Battle.getBattleStat(targetToHit, 'finRed') || 0) + (targetToHit.passive?.finRed10 ? 10 : 0);
                    
					if (targetToHit.isCovering) finRed += PassiveSkill.getSumValue(targetToHit, 'cover_reduce_mult');
                    if (finRed > 80) finRed = 80; cutRate += finRed;

                    let dmg = Math.floor(baseDmgCalc * totalMult * (1.0 + bonusRate / 100) * (1.0 - cutRate / 100) * (0.85 + Math.random() * 0.3));
                    
					// ★設計思想の反映: ダメージ計算の最後にタイプ別特性を計算
					if (typeof PassiveSkill !== 'undefined') {
						let typeDmgPct = 0;
						let typeRedPct = 0;

						if (isPhysical) {
							typeDmgPct = PassiveSkill.getSumValue(actor, 'physical_dmg_pct'); // ID 10
							typeRedPct = PassiveSkill.getSumValue(targetToHit, 'physical_reduce_pct'); // ID 15
						} else if (effectType === '魔法') {
							typeDmgPct = PassiveSkill.getSumValue(actor, 'magic_dmg_pct'); // ID 11
							typeRedPct = PassiveSkill.getSumValue(targetToHit, 'magic_reduce_pct'); // ID 16
						} else if (effectType === 'ブレス') {
							typeDmgPct = PassiveSkill.getSumValue(actor, 'breath_dmg_pct'); // ID 12
							typeRedPct = PassiveSkill.getSumValue(targetToHit, 'breath_reduce_pct'); // ID 17
						}

						// 最終乗算 (1.0 + 補正/100)
						dmg = Math.floor(dmg * (1 + typeDmgPct / 100));
						dmg = Math.floor(dmg * (1 - typeRedPct / 100));
					}
					
					if (targetToHit.status?.defend) dmg = Math.floor(dmg * 0.5);
                    if (isImmune) dmg = 0; else if (dmg < 1 && baseDmgCalc > 0) dmg = 1;

                    targetToHit.hp -= dmg;
                    targetToHit.revengeStack = (targetToHit.revengeStack || 0) + 1;
                    actor.revengeStack = 0;

                    Battle.recordMaxDamage(actor, data, dmg, cmd);
                    
                    let dColor = element ? ({火:'#f88',水:'#88f',雷:'#ff0',風:'#8f8',光:'#ffc',闇:'#a8f',混沌:'#d4d'}[element] || '#fff') : '#fff';
                    if (dmg === 0) Battle.log(`ミス！ ${targetToHit.name}は ダメージを うけない！`);
                    else Battle.log(`${targetToHit.name}に<span style="color:${dColor}">${dmg}</span>のダメージ！`);

                    if (targetToHit.hp <= 0) {
                        // MASTERの定義に合わせ guts_mult を呼び出すことで (スキル*3 + 20) を取得
						const gutsChance = PassiveSkill.getSumValue(targetToHit, 'guts_mult');
						if (gutsChance > 0 && Math.random() * 100 < gutsChance) {
                            targetToHit.hp = 1;
                            Battle.log(`${targetToHit.name}は 根性で 踏みとどまった！`);
                        } else {
                            Battle.markDefeated(targetToHit);
                        }
                    }
                    
                    // --- 反射（理力の壁）判定箇所 ---
					if (dmg > 0 && Battle.isBattleAlive(targetToHit)) {
						const reflectRate = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(targetToHit, 'reflect_dmg_mult') : 0;
						const reflectTrigger = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(targetToHit, 'reflect_trigger_mult') : 0;

						// [修正] モンスターなら特性のみ、プレイヤーなら「杖装備 ＆ 特性所持」を条件にする
						const isMonster = (targetToHit instanceof Monster);
						const hasTrait = reflectRate > 0;

						// ★追加：weaponType(単数) だけでなく weaponTypes(複数) でも判定
						const types = targetToHit.weaponTypes || [targetToHit.weaponType || '素手'];
						const hasStaff = types.includes('杖');

						const canReflect = isMonster ? hasTrait : (hasStaff && hasTrait);

						if (canReflect && Math.random() * 100 < (reflectTrigger > 0 ? reflectTrigger : 10)) { 
							const refDmg = Math.floor(dmg * (reflectRate / 100 + 0.1)); 
							actor.hp -= refDmg; 
							Battle.log(`${targetToHit.name}の理力の壁が 反射！ ${actor.name}に ${refDmg} のダメージ！`);

							// 反射による自爆死の判定と根性処理
							if (actor.hp <= 0) {
								const gutsChance = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'guts_mult') : 0;
								if (gutsChance > 0 && Math.random() * 100 < gutsChance) {
									actor.hp = 1;
									Battle.log(`${actor.name}は 根性で 踏みとどまった！`);
								} else {
									Battle.markDefeated(actor);
								}
							}
						}
					}
					
					if (dmg > 0 && ((data?.drain ?? false) || actor.passive?.drain)) {
						const dAmt = Math.floor(dmg * ((data?.drain ?? false) ? 0.5 : 0.2));
						actor.hp = Math.min(actor.baseMaxHp, actor.hp + dAmt);
					}


                    // --- 通常攻撃時の追加状態異常判定 (★特性ID31, 32の組み込み) ---
                    if (dmg > 0 && isPhysical && Battle.isBattleAlive(targetToHit)) {
						const curseBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_curse_bonus') : 0;
						const assaBonus  = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_instantdeath_bonus') : 0;
						const bodyBonus = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'proc_body_bonus') : 0;

						const tryS = (key, name, ailmentKey, bonus = 0) => {
							// [修正] 基礎付与率を取得
							const baseChance = (actor.getStat(key) || 0);
							
							// [修正] 基礎付与率が0より大きい場合のみ、ボーナスを加算する。0なら0のまま。
							const ch = (baseChance > 0 ? (baseChance + bonus) : 0) * ailmentChanceMult;
							
							if (ch > 0 && Math.random() * 100 < ch) {
								const resV = (Battle.getBattleStat(targetToHit, 'resists') || {})[Battle.RESIST_MAP[ailmentKey] || ailmentKey] || 0;
								if (Math.random() * 100 < (100 - resV)) {
									targetToHit.battleStatus.ailments[ailmentKey] = { turns: 3, chance: (ailmentKey==='Fear'?0.5:null) };
									Battle.log(`${targetToHit.name}は ${name}！`);
								}
							}
						};
						tryS('attack_Poison', 'どくにおかされた', 'Poison', bodyBonus);
						tryS('attack_Fear', '怯えてしまった', 'Fear', curseBonus);
                        
                        // [1] まず、装備やスキルに元々設定されている「基礎即死率」を出す
						const baseID = (actor.getStat('attack_InstantDeath') || 0) + (data?.InstantDeath || 0);

						// [2] 基礎即死率が 0 より大きい場合のみ、特性ボーナスを上乗せする
						// 基礎が 0 なら、いくら暗殺術があっても 0 のまま
						const finalID = (baseID > 0 ? (baseID + assaBonus) : 0) * ailmentChanceMult;

						if (finalID > 0 && Math.random() * 100 < finalID) {
							const rv = (Battle.getBattleStat(targetToHit, 'resists') || {}).InstantDeath || 0;
							if (Math.random() * 100 < (100 - rv)) { 
								targetToHit.hp = 0; 
								Battle.markDefeated(targetToHit, `<span style="color:#ff00ff; font-weight:bold;">急所を貫いた！ ${targetToHit.name}は 息絶えた！</span>`); 
							}
						}
                    }

                    if (actor instanceof Player && Battle.isBattleAlive(targetToHit)) {
                        Object.values(actor.equips).forEach(eq => {
                            if (eq && eq.isSynergy && eq.effects) {
                                eq.effects.forEach(effect => {
                                    if (Math.random() < 0.2) {
                                        if (effect === 'allResDown20' && Battle.isBattleAlive(targetToHit)) {
                                            const dRes = (Battle.getBattleStat(targetToHit, 'resists') || {}).Debuff || 0;
                                            if (Math.random() * 100 < (100 - dRes)) { targetToHit.battleStatus.debuffs['elmResDown'] = { val: 50, turns: 5 }; Battle.log(`${targetToHit.name}の 全属性耐性が 少しさがった！`); }
                                        }
                                        if (effect === 'instantDeath20' && Battle.isBattleAlive(targetToHit)) {
                                            const res = (targetToHit.resists?.InstantDeath) || 0;
                                            if (Math.random() * 100 < (100 - res)) { targetToHit.hp = 0; Battle.markDefeated(targetToHit, `<span style="color:#ff00ff; font-weight:bold;">急所を貫いた！ ${targetToHit.name}は 息絶えた！</span>`); }
                                        }
                                    }
                                });
                            }
                        });
                    }

                    // [修正] モンスターなら武器制限を無視、プレイヤーなら制限ありで反撃率を取得
					if (isPhysical && dmg > 0 && Battle.isBattleAlive(targetToHit) && !cmd.isReaction) {
						const isMonster = (targetToHit instanceof Monster);
						const counterRate = (typeof PassiveSkill !== 'undefined') 
							? PassiveSkill.getSumValue(targetToHit, 'counter_rate_base', isMonster) 
							: 0;

						if (counterRate > 0 && Math.random() * 100 < counterRate) {
							Battle.log(`${targetToHit.name}の 反撃！`);
							await Battle.executeReactionAttack(targetToHit, actor);
							if (!Battle.isBattleAlive(actor)) {
							    Battle.renderEnemies(); Battle.renderPartyStatus();
							    break;
							}
						}
					}

                    if (cmd.type === 'skill' && Battle.isBattleAlive(targetToHit)) applyEffects(targetToHit, data, ailmentChanceMult);

					const isOpposingTarget = cmd.isEnemy
						? Battle.party.includes(targetToHit)
						: Battle.enemies.includes(targetToHit);
					const canTriggerAttackFollowups = () => (
						dmg > 0 &&
						!cmd.isReaction &&
						Battle.isBattleAlive(actor) &&
						Battle.isBattleAlive(targetToHit) &&
						!isSupport &&
						isOpposingTarget
					);

					// --- 連携部分：同陣営の仲間による追撃 ---
					// 回復・補助では発火させず、敵対対象へ実ダメージが出た攻撃だけ判定する。
					if (canTriggerAttackFollowups()) {
						const allies = cmd.isEnemy ? Battle.enemies : Battle.party;
						const partners = allies.filter(p => p && p !== actor && Battle.isBattleAlive(p));

						for (const p of partners) {
							// 仲間の攻撃によってターゲットが死亡した場合は、即座に連携ループを中断
							if (!Battle.isBattleAlive(targetToHit)) break;

							const isMonsterPartner = (p instanceof Monster);
							const chainChance = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(p, 'chain_rate_base', isMonsterPartner) : 0;
							
							if (chainChance > 0 && Math.random() * 100 < chainChance) {
								// 実行直前にも生存確認を行う
								if (Battle.isBattleAlive(targetToHit)) {
									Battle.log(`${p.name}が 連携した！`);
									await Battle.executeReactionAttack(p, targetToHit);
								}
							}
						}
					}
					
					// --- 追い討ち部分：自分自身による追撃 ---
					// 連携の発生有無に関わらず、現時点でターゲットが生存・HP50%以下なら判定
					if (canTriggerAttackFollowups()) {
						if (targetToHit.hp <= targetToHit.baseMaxHp * 0.5) {
							const isMonster = (actor instanceof Monster);
							const chaseChance = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getSumValue(actor, 'chase_rate_mult', isMonster) : 0;
							
							if (chaseChance > 0 && Math.random() * 100 < chaseChance) {
								// 最終的な生存確認
								if (Battle.isBattleAlive(targetToHit)) {
									Battle.log(`${actor.name}の 追い討ち！`);
									await Battle.executeReactionAttack(actor, targetToHit);
								}
							}
						}
					}

                    if (!Battle.isBattleAlive(targetToHit)) {
                        Battle.markDefeated(targetToHit, false);
                        targetToHit.isCovering = false;
                        Battle.renderEnemies(); Battle.renderPartyStatus();
                        break;
                    }
                    targetToHit.isCovering = false; 
                    Battle.renderEnemies(); Battle.renderPartyStatus();
                    if (hitCount > 1) await Battle.resultWait(150);
                }
            }
            await Battle.resultWait(100);
        }
    },
	
	/**
     * リアクション系特性（反撃、先制、連携、追い討ち）用の簡易攻撃実行
     */
    executeReactionAttack: async (actor, target) => {
        // 通常攻撃 (ID: 1) のデータを取得
        const attackSkill = DB.SKILLS.find(s => s.id === 1);
        if (!attackSkill || !Battle.isBattleAlive(target) || !Battle.isBattleAlive(actor)) return;

        // 再帰呼び出しを防ぐため、isReaction フラグを立てて processAction を実行
        await Battle.processAction({
            type: 'skill',
            actor: actor,
            target: target,
            data: attackSkill,
            isReaction: true, // 重要：再帰（反撃の反撃など）を防止
            targetScope: '単体',
            isEnemy: !Battle.party.includes(actor)
        });
    },
	
    updateDeadState: () => {
        [...Battle.party, ...Battle.enemies].forEach(e => {
            if (e && e.hp <= 0 && !e.isFled) {
                e.hp = 0;
                e.isDead = true;
				// ★追加：このターン中に死んだことを記録する
                e.hasDiedThisTurn = true;
                e.battleStatus = { buffs: {}, debuffs: {}, ailments: {} };
            }
        });
    },

    checkFinish: () => {
		if (Battle.party.every(p => p.isDead)) { Battle.schedule(Battle.lose, 800); return true; }
        if (Battle.enemies.every(e => e.isDead || e.isFled)) { Battle.schedule(Battle.win, 800); return true; }
        return false;
    },

    getRandomAliveEnemy: () => {
        const alive = Battle.enemies.filter(e => Battle.isBattleAlive(e));
        if (alive.length === 0) return null;
        return alive[Math.floor(Math.random() * alive.length)];
    },

    getWeakWeightedAliveEnemy: () => {
        const alive = Battle.enemies.filter(e => Battle.isBattleAlive(e));
        if (alive.length === 0) return null;
        if (alive.length === 1) return alive[0];

        // 味方オート用。HP割合が低い敵ほど重くしつつ、完全固定にはしない。
        const weighted = alive.map(e => {
            const maxHp = Math.max(1, Number(e.baseMaxHp || e.maxHp || e.hp || 1));
            const ratio = Math.max(0.01, Math.min(1, Number(e.hp || 0) / maxHp));
            const hpRankBias = Math.max(0, maxHp - Number(e.hp || 0)) / maxHp;
            const weight = 1 + Math.pow(1 - ratio, 2) * 8 + hpRankBias * 3;
            return { enemy: e, weight };
        });

        const total = weighted.reduce((sum, item) => sum + item.weight, 0);
        let roll = Math.random() * total;
        for (const item of weighted) {
            roll -= item.weight;
            if (roll <= 0) return item.enemy;
        }
        return weighted[weighted.length - 1].enemy;
    },
	
	saveBattleState: () => { 
        const isB = App.data.battle.isBossBattle; 
        const isE = App.data.battle.isEstark; 
        const isS = App.data.battle.isSpecialBoss; 
        const fId = App.data.battle.fixedBossId; 
        const eId = App.data.battle.eventId; // ★eventIdを退避
        const storyWinEventId = App.data.battle.storyWinEventId || null;
        const storyLossEventId = App.data.battle.storyLossEventId || null;
        const fixedStoryEventId = App.data.battle.fixedStoryEventId || null;
        const fixedBossPosition = App.data.battle.fixedBossPosition || null;
        const fixedBossProgressKey = App.data.battle.fixedBossProgressKey || null;
        const fixedQuestId = App.data.battle.fixedQuestId || null;
        const keyReward = App.data.battle.keyReward || App.data.battle.fixedKeyReward || null;
        const bossStatMultiplier = App.data.battle.bossStatMultiplier || App.data.battle.bossScale || null;
        const suppressFixedBossDefeat = !!App.data.battle.suppressFixedBossDefeat;
        const trialEnemyBoost = App.data.battle.trialEnemyBoost || null;
        const angelTrial = App.data.battle.angelTrial || null;
        const fixedHunter = App.data.battle.fixedHunter || null;
        
        App.data.battle.enemies = Battle.enemies.filter(e => !e.isFled).map(e => ({ 
            baseId: e.baseId || e.id, hp: e.hp, maxHp: e.baseMaxHp, name: e.name, rank: e.rank, generatedFloor: e.generatedFloor, isBoss: e.isBoss, isRare: e.isRare, isSpecialBoss: e.isSpecialBoss, isEstark: e.isEstark, battleStatus: e.battleStatus 
        })); 
        
        App.data.battle.isBossBattle = isB; 
        App.data.battle.isEstark = isE; 
        App.data.battle.isSpecialBoss = isS; 
        App.data.battle.fixedBossId = fId; 
        App.data.battle.eventId = eId; // ★eventIdを復元
        App.data.battle.keyReward = keyReward;
        if (keyReward) App.data.battle.fixedKeyReward = keyReward;
        if (storyWinEventId) App.data.battle.storyWinEventId = storyWinEventId;
        if (storyLossEventId) App.data.battle.storyLossEventId = storyLossEventId;
        if (fixedStoryEventId) App.data.battle.fixedStoryEventId = fixedStoryEventId;
        if (fixedBossPosition) App.data.battle.fixedBossPosition = fixedBossPosition;
        if (fixedBossProgressKey) App.data.battle.fixedBossProgressKey = fixedBossProgressKey;
        if (fixedQuestId) App.data.battle.fixedQuestId = fixedQuestId;
        if (bossStatMultiplier) App.data.battle.bossStatMultiplier = bossStatMultiplier;
        if (suppressFixedBossDefeat) App.data.battle.suppressFixedBossDefeat = true;
        if (trialEnemyBoost) App.data.battle.trialEnemyBoost = trialEnemyBoost;
        if (angelTrial) App.data.battle.angelTrial = angelTrial;
        if (fixedHunter) App.data.battle.fixedHunter = fixedHunter;
        
        Battle.party.forEach(p => { 
            const d = App.getChar(p.uid); 
            if(d) { d.currentHp = p.hp; d.currentMp = p.mp; d.battleStatus = p.battleStatus; } 
        }); 
        App.save(); 
    },

    escapeAttr: (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),

    cleanMonsterDisplayName: (name) => String(name || '')
        .replace(/^(強・|真・|極・|神・)+/, '')
        .replace(/\s?Lv\d+[A-Z]?$/, '')
        .replace(/[A-Z]$/, '')
        .trim(),

    monsterImagePath: (name) => `assets/monsters/${encodeURIComponent(name)}.png`,

    monsterImageSourceByName: (name, graphicsImages = {}) => {
        const key = 'monster_' + name;
        if (graphicsImages[key]?.src) return graphicsImages[key].src;
        return Battle.monsterImagePath(name);
    },

    resolveMonsterImage: (monster, graphicsImages = {}) => {
        const baseName = Battle.cleanMonsterDisplayName(monster.name);
        const map = window.MonsterImageMap || {};
        const mapped = map[monster.id] || map[monster.baseId] || map[baseName];
        const mapSrc = mapped
            ? (graphicsImages[mapped]?.src || mapped)
            : null;
        const exactKey = 'monster_' + baseName;
        const exactSrc = monster.image || monster.img || mapSrc || graphicsImages[exactKey]?.src || Battle.monsterImagePath(baseName);

        let fallbackName = 'ジェリー';
        if (monster.isSpecialBoss || monster.isEstark || Number(monster.id) === 902000 || Number(monster.baseId) === 902000) {
            const legacySpecialImageName = '\u30a8\u30b9\u30bf\u30fc\u30af';
            fallbackName = graphicsImages['monster_' + legacySpecialImageName] ? legacySpecialImageName : '魔王ゼノン';
        }
        else if (monster.isBoss) fallbackName = '魔王ゼノン';
        else if (monster.isRare) fallbackName = 'メタルジェリー';
        else {
            const raceFallbacks = {
                '粘体': 'ジェリー',
                '獣': 'ホーンラビット',
                '獣人': 'レオン将軍',
                '精霊': 'ライトウィスプ',
                '植物': 'アビスヴァイン',
                '死霊': 'ゴースト',
                '魔族': 'ベビーデビル',
                '無生物': 'アーマーナイト',
                '機械': '機械兵士',
                '竜': 'レッドドラゴン',
                '竜人': 'りゅうじん',
            };
            fallbackName = raceFallbacks[monster.race] || fallbackName;
        }

        return {
            src: exactSrc,
            fallback: Battle.monsterImageSourceByName(fallbackName, graphicsImages),
        };
    },
	
	renderEnemies: () => {
		const container = Battle.getEl('enemy-container');
		if(!container) return;
		container.innerHTML = ''; // 以前の描画をクリア
		const g = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};
		
		// 【判定準備】敵の総数とボスバトルフラグを取得
		const totalCount = Battle.enemies.length;
		const isBoss = App.data.battle ? App.data.battle.isBossBattle : false;
        // 1〜4体は既存の横並びを維持。
        // 5体だけ、亀裂・イベント・一部ボス用の特別隊形にする。
        const useFiveEnemyFormation = totalCount === 5;

        container.classList.toggle('enemy-five-formation', useFiveEnemyFormation);
        container.classList.toggle('enemy-two-row-layout', false);
        container.style.position = 'relative';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'flex-end';
        container.style.display = useFiveEnemyFormation ? 'block' : 'flex';

		// Special boss layout: ギルガメッシュは単体の巨大表示を維持。
		const hasShowcaseBoss = Battle.enemies.some(enemy => {
            const id = Number(enemy.id);
            const baseId = Number(enemy.baseId);
            return enemy.isSpecialBoss || enemy.isEstark || id === 902000 || baseId === 902000 || id === 401200 || baseId === 401200 || id === 401100 || baseId === 401100;
        });
        const hasSpecialBoss = hasShowcaseBoss && totalCount === 1;

		// デフォルトのレイアウト変数（ここを以下のif文で上書きしていく）
		let widthPerEnemy = 20; 
		let scaleFactor = 1.0; 
		let maxPixelWidth = 100;
		let paddingBottomVal = "30px"; 
		let marginTopVal = "5px";

		/* --- レイアウト決定の優先順位ロジック --- */

		// 1位：特殊ボスがいる場合（最優先・巨大表示）
		if (hasSpecialBoss) {
			widthPerEnemy = 65;
			maxPixelWidth = 450;
			paddingBottomVal = "15px";
			marginTopVal = "-30px";
			scaleFactor = 1.2;
		} 
		// 2位：ボスが1体だけの場合
		else if (isBoss && totalCount === 1) {
			widthPerEnemy = 40;  
			scaleFactor = 1.0;   
			maxPixelWidth = 200;
			paddingBottomVal = "5px";
			marginTopVal = "-10px";
		} 
		// 3位：ボスが4体並ぶ場合（現行維持）
		else if (isBoss && totalCount === 4) { 
			widthPerEnemy = 22;
			scaleFactor = 0.8;
			paddingBottomVal = "0px";
		}
		// 4位：ボスが3体の場合
		else if (isBoss && totalCount === 3) { 
			widthPerEnemy = 29;
			scaleFactor = 0.95; 
			maxPixelWidth = 155;
			paddingBottomVal = "5px";
			marginTopVal = "-10px";
		}
		// 5位：ボスが2体の場合
		else if (isBoss && totalCount === 2) { 
			widthPerEnemy = 37;
			scaleFactor = 1.0; 
			maxPixelWidth = 200;
			paddingBottomVal = "5px";
			marginTopVal = "10px";
		}
		// 5体編成だけ、前3＋後2の特別隊形。1〜4体は既存と同じ。
		else if (useFiveEnemyFormation) { 
			widthPerEnemy = 24;
			scaleFactor = 0.86;
            maxPixelWidth = 118;
            paddingBottomVal = "0px";
            marginTopVal = "-4px";
		}
		else { 
			widthPerEnemy = 30;
			scaleFactor = 1.0; 
		}

        const fiveEnemyPosition = (index) => {
            // 5体編成: 前列中央を主役として少し大きく、左右と後列はやや小さくする。
            const positions = [
                { left: 24, bottom: 4,  z: 42, width: 22, maxWidth: 108, scale: 0.80, labelTop: '-7px', imgY: '8px' },
                { left: 50, bottom: 0,  z: 52, width: 28, maxWidth: 138, scale: 0.94, labelTop: '-5px', imgY: '9px' },
                { left: 76, bottom: 4,  z: 42, width: 22, maxWidth: 108, scale: 0.80, labelTop: '-7px', imgY: '8px' },
                { left: 39, bottom: 90, z: 18, width: 20, maxWidth: 98,  scale: 0.72, labelTop: '-9px', imgY: '6px' },
                { left: 61, bottom: 90, z: 18, width: 20, maxWidth: 98,  scale: 0.72, labelTop: '-9px', imgY: '6px' },
            ];
            return positions[index] || positions[1];
        };

        // 実際の描画ループ
        Battle.enemies.forEach((e, index) => {
            const div = document.createElement('div');
            div.className = `enemy-sprite`;
            div.dataset.battleIndex = String(index);
            if (e.id !== undefined) div.dataset.enemyId = String(e.id);
            
            let perEnemyWidth = widthPerEnemy;
            let perEnemyMaxPixelWidth = maxPixelWidth;
            let perEnemyScaleFactor = scaleFactor;
            let perEnemyMarginTopVal = marginTopVal;
            let imgTranslateY = '10px';

            if (isBoss && totalCount === 3 && index === 1) {
                perEnemyWidth = 36;
                perEnemyMaxPixelWidth = 215;
                perEnemyScaleFactor = 1.05;
                perEnemyMarginTopVal = "-18px";
            }

            if (useFiveEnemyFormation) {
                const pos = fiveEnemyPosition(index);
                perEnemyWidth = pos.width;
                perEnemyMaxPixelWidth = pos.maxWidth;
                perEnemyScaleFactor = pos.scale;
                perEnemyMarginTopVal = pos.labelTop;
                imgTranslateY = pos.imgY;
                div.style.cssText = `
                    position: absolute;
                    left: ${pos.left}%;
                    bottom: ${pos.bottom}px;
                    width: ${perEnemyWidth}%;
                    max-width: ${perEnemyMaxPixelWidth}px;
                    margin: 0;
                    overflow: visible;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    align-items: center;
                    padding-bottom: ${paddingBottomVal};
                    transform: translateX(-50%);
                    z-index: ${pos.z};
                `;
            } else {
                div.style.cssText = `
                    position: relative; 
                    width: ${perEnemyWidth}%; 
                    max-width: ${perEnemyMaxPixelWidth}px;
                    margin: 0 1% -0px 1%;
                    overflow: visible;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    align-items: center;
                    padding-bottom: ${paddingBottomVal};
                `;
            }

            // 死んでいる、または逃げた場合は表示を隠す。
            // ただし、screen方式の全体エフェクトで遅延ダメージ演出を待っている敵は、
            // 演出より先に消えないよう一時的に表示を保持する。
            const keepDefeatedVisible = !e.isFled && window.PolishBattleFX &&
                typeof window.PolishBattleFX.shouldKeepDefeatedVisible === 'function' &&
                window.PolishBattleFX.shouldKeepDefeatedVisible(e);
            if (e.isFled || (e.hp <= 0 && !keepDefeatedVisible)) {
                div.style.visibility = 'hidden';
                container.appendChild(div);
                return;
            }
            if (keepDefeatedVisible) div.classList.add('enemy-defeat-hold');
            
            const imageInfo = Battle.resolveMonsterImage(e, g);
            const src = Battle.escapeAttr(imageInfo.src);
            const fallback = Battle.escapeAttr(imageInfo.fallback);
            div.style.border = 'none';
            div.style.background = 'transparent';
            const imgHtml = `<img src="${src}" onerror="this.onerror=null;this.src='${fallback}';" style="
                width: 100%; 
                aspect-ratio: 1/1; 
                object-fit: contain; 
                object-position: center bottom;
                filter: drop-shadow(0 4px 4px rgba(0,0,0,0.5)); 
                display: block;
                --enemy-img-y: ${imgTranslateY};
                transform: translateY(var(--enemy-img-y));
            ">`;
            const displayHp = (window.PolishBattleFX && typeof window.PolishBattleFX.hpDisplayForEnemy === 'function')
                ? window.PolishBattleFX.hpDisplayForEnemy(e, e.hp)
                : e.hp;
            const hpPer = (e.baseMaxHp > 0) ? Math.max(0, Math.min(100, (displayHp / e.baseMaxHp) * 100)) : 0;
            const hpRatio = e.baseMaxHp > 0 ? displayHp / e.baseMaxHp : 0;
            const nameColor = hpRatio < 0.5 ? '#ff4' : '#fff';
            
            div.innerHTML = `
                ${imgHtml}
                <div style="
                    width: 140%;
                    margin-top: ${perEnemyMarginTopVal};
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    z-index: 10; 
                    pointer-events: none; 
                    transform: scale(${perEnemyScaleFactor}); 
                    transform-origin: top center;
                    text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;">
                    <div class="enemy-name" style="font-size: 10px; color: ${nameColor}; font-weight:bold; white-space: nowrap; margin-bottom: 2px;">${e.name}</div>
                    <div class="enemy-hp-bar" style="width: 60%; height: 4px; border: 1px solid #000; background: #333; border-radius: 2px;">
                        <div class="enemy-hp-val" style="width:${hpPer}%; height:100%; background:#ff4444; transition:width 0.2s; border-radius: 1px;"></div>
                    </div>
                </div>`;
                
            div.onclick = (event) => { 
                event.stopPropagation(); 
                if(Battle.phase==='target_select' && (Battle.selectingAction==='attack'||Battle.selectingAction==='skill')) { 
                    Battle.selectTarget(e); 
                } 
            };
            container.appendChild(div);
        });
    },

    renderPartyStatus: () => {
        const container = Battle.getEl('battle-party-bar'); if(!container) return;
        container.innerHTML = '';
        Battle.party.forEach((p, index) => {
            const div = document.createElement('div'); div.className = 'p-box'; div.style.justifyContent = 'flex-start'; div.style.paddingTop = '2px';
            div.dataset.battleIndex = String(index);
            if (p.uid) div.dataset.battleUid = String(p.uid);
            const hpPer = (p.baseMaxHp > 0) ? (p.hp / p.baseMaxHp) * 100 : 0; const mpPer = (p.baseMaxMp > 0) ? (p.mp / p.baseMaxMp) * 100 : 0;
            const isActor = (Battle.phase === 'input' && index === Battle.currentActorIndex);
            if(isActor) { div.style.border = "2px solid #ffd700"; div.style.background = "#333"; }
            let nameStyle = p.isDead ? 'color:red; text-decoration:line-through;' : 'color:white;';
			
            const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(p) : p.img;
            const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(p) : '';
            const imgHtml = imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #666; margin-bottom:1px;">` : `<div style="width:32px; height:32px; background:#222; border-radius:4px; border:1px solid #444; display:flex; align-items:center; justify-content:center; color:#555; font-size:8px; margin-bottom:1px;">IMG</div>`;
            
            // --- 消えていた部分を復活 ---
            div.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; width:100%; overflow:hidden;">
                    ${imgHtml}
                    <div style="font-size:10px; font-weight:bold; ${nameStyle} overflow:hidden; white-space:nowrap; width:100%; text-align:center; line-height:1.2;">${p.name}</div>
                    <div style="font-size:8px; color:#aaa; margin-bottom:2px; line-height:1;">${p.job} Lv.${p.level}</div>
                </div>
                <div style="width:100%;">
                    <div class="bar-container"><div class="bar-hp" style="width:${hpPer}%"></div></div>
                    <div class="p-val">${p.hp}/${p.baseMaxHp}</div>
                    <div class="bar-container"><div class="bar-mp" style="width:${mpPer}%"></div></div>
                    <div class="p-val">${p.mp}/${p.baseMaxMp}</div>
                </div>
            `;
			
            div.onclick = () => { 
                if(Battle.phase !== 'input') return;
                Battle.openStatusModal(index);
            };
            
            container.appendChild(div);
        });
    },
	

    // --- ステータスモーダル制御 ---
    statusModalTargetIndex: 0,

    openStatusModal: (index) => {
        const modal = document.getElementById('battle-status-modal');
        if (modal) {
            Battle.statusModalTargetIndex = index;
            modal.style.display = 'flex';
            Battle.renderStatusModalContent();
        }
    },

    closeStatusModal: () => {
        const modal = document.getElementById('battle-status-modal');
        if (modal) modal.style.display = 'none';
    },

    switchStatusChar: (dir) => {
        const partySize = Battle.party.length;
        if (partySize === 0) return;

        Battle.statusModalTargetIndex += dir;
        if (Battle.statusModalTargetIndex >= partySize) Battle.statusModalTargetIndex = 0;
        if (Battle.statusModalTargetIndex < 0) Battle.statusModalTargetIndex = partySize - 1;

        Battle.renderStatusModalContent();
    },

    renderStatusModalContent: () => {
        const char = Battle.party[Battle.statusModalTargetIndex];
        if (!char) return;

        // 名前更新
        const nameEl = document.getElementById('modal-char-name');
        if (nameEl) nameEl.innerText = char.name;

        // コンテンツ生成
        const contentEl = document.getElementById('modal-char-content');
        if (!contentEl) return;

        const maxHp = char.baseMaxHp;
        const maxMp = char.baseMaxMp;
        const hpPer = Math.floor((char.hp / maxHp) * 100);
        const mpPer = Math.floor((char.mp / maxMp) * 100);
		
        const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(char) : char.img;
        const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(char) : '';

        // ★修正箇所: char.img ではなく imgUrl を使用
        let html = `
            <div style="display:flex; align-items:center; margin-bottom:10px;">
                <div style="width:48px; height:48px; border:1px solid #555; margin-right:10px; border-radius:4px; overflow:hidden; display:flex; justify-content:center; align-items:center; background:#333;">
                    ${imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:10px; color:#888;">IMG</span>'}
                </div>
                <div style="flex:1;">
                    <div style="font-size:12px; color:#aaa; margin-bottom:2px;">${char.job} Lv.${char.level}</div>
                    
                    <div style="display:flex; align-items:center; font-size:10px; margin-bottom:2px;">
                        <span style="width:20px; color:#f88; font-weight:bold;">HP</span>
                        <div style="flex:1; height:4px; background:#333; margin:0 5px; border-radius:2px;"><div style="width:${hpPer}%; height:100%; background:#f44; border-radius:2px;"></div></div>
                        <span style="width:85px; text-align:right; letter-spacing:-0.5px;">${char.hp}/${maxHp}</span>
                    </div>

                    <div style="display:flex; align-items:center; font-size:10px;">
                        <span style="width:20px; color:#88f; font-weight:bold;">MP</span>
                        <div style="flex:1; height:4px; background:#333; margin:0 5px; border-radius:2px;"><div style="width:${mpPer}%; height:100%; background:#48f; border-radius:2px;"></div></div>
                        <span style="width:85px; text-align:right; letter-spacing:-0.5px;">${char.mp}/${maxMp}</span>
                    </div>
                </div>
            </div>
            <div style="border-top:1px solid #444; padding-top:8px;">
                <div style="font-size:11px; color:#aaa; margin-bottom:4px;">状態変化</div>
        `;

        // バフ・デバフ一覧作成
        const statusList = [];
        const b = char.battleStatus;
        if (b) {
            // 状態異常 (Ailments) - 変更なし
            for (let key in b.ailments) {
                const turns = b.ailments[key].turns;
                const name = Battle.statNames[key] || key;
                statusList.push(`<div style="color:#f88;">● ${name} <span style="font-size:10px; color:#aaa;">(${turns}T)</span></div>`);
            }

            // バフ (Buffs) - ★修正: 耐性系の表示対応
            for (let key in b.buffs) {
                const turns = b.buffs[key].turns;
                const val = b.buffs[key].val;
                const tStr = (turns !== null && turns !== undefined) ? `${turns}T` : '∞';
                
                let name = Battle.statNames[key] || key;
                let valStr = '';

                // 全属性耐性
                if(key === 'elmResUp') {
                    name = '全属性耐性';
                    valStr = `(+${val}%)`;
                }
                // ★追加: 状態異常耐性 (resists_XX)
                else if (key.startsWith('resists_')) {
                    const baseKey = key.replace('resists_', '');
                    const label = Battle.statNames[baseKey] || baseKey;
                    name = `${label}耐性`; // 例: 毒耐性
                    valStr = `(+${val}%)`;
                }
                // HP/MPリジェネ
                else if(key === 'HPRegen' || key === 'MPRegen') {
                    valStr = ''; // リジェネは数値表示なし
                }
                // 通常ステータス (倍率表示)
                else {
                    valStr = `(x${val.toFixed(2)})`;
                }
                
                statusList.push(`<div style="color:#8f8;">▲ ${name}${valStr} <span style="font-size:10px; color:#aaa;">(${tStr})</span></div>`);
            }

            // デバフ (Debuffs) - ★修正: 耐性系の表示対応
            for (let key in b.debuffs) {
                const turns = b.debuffs[key].turns;
                const val = b.debuffs[key].val;
                const tStr = (turns !== null && turns !== undefined) ? `${turns}T` : '∞';
                
                let name = Battle.statNames[key] || key;
                let valStr = '';

                // 全属性耐性ダウン
                if(key === 'elmResDown') {
                    name = '全属性耐性';
                    valStr = `(${val}%)`; // マイナス表記は▼で表現されるので数値はそのまま
                }
                // ★追加: 状態異常耐性ダウン (resists_XX)
                else if (key.startsWith('resists_')) {
                    const baseKey = key.replace('resists_', '');
                    const label = Battle.statNames[baseKey] || baseKey;
                    name = `${label}耐性`;
                    valStr = `(-${val}%)`;
                }
                // 通常ステータス (倍率表示)
                else {
                    valStr = `(x${val.toFixed(2)})`;
                }

                statusList.push(`<div style="color:#88f;">▼ ${name}${valStr} <span style="font-size:10px; color:#aaa;">(${tStr})</span></div>`);
            }
        }

        if (statusList.length === 0) {
            html += `<div style="color:#666; font-size:12px; text-align:center; padding:10px;">なし</div>`;
        } else {
            html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">${statusList.join('')}</div>`;
        }

        html += `</div>`;
        contentEl.innerHTML = html;
    },
	
	win: async () => {
		// --- [修正の要点] 演出前に戦闘を「非アクティブ」にし、内部処理を完結させる ---
		// これにより、演出中のリロード時に戦闘シーンに戻る（＝再度報酬が貰える）のを防ぎます
		Battle.phase = 'result'; 
		Battle.active = false;
		Battle.resultProcessing = true;
		Battle.resultReadyToEnd = false;
		Battle.resultSkipRequested = false;
		Battle.resultWaiters = [];
		if (App.data.battle) App.data.battle.active = false; 

        const isEstark = App.data.battle && (App.data.battle.isSpecialBoss || App.data.battle.isEstark);
        const isBossBattle = App.data.battle && App.data.battle.isBossBattle;
        const eventId = (App.data.battle && App.data.battle.eventId) ? App.data.battle.eventId : null;
        const storyWinEventId = App.data.battle?.storyWinEventId || null;
        const keyReward = App.data.battle?.keyReward || App.data.battle?.fixedKeyReward || null;
        const fixedHunter = App.data.battle?.fixedHunter || null;
		
		// --- [追加] 演出前にイベントを予約し、セーブデータに含める ---
		if (isBossBattle && eventId) {
			if (!App.data.progress) App.data.progress = {};
			if (storyWinEventId) {
				App.data.progress.pendingEventId = storyWinEventId;
			} else {
				App.data.progress.pendingBattleWinEventId = eventId;
			}
		}
		
		// ★ドロップ品質を決定する基準階層(floor)の計算
		let floor = App.data.progress.floor || 1;

		if (Field.currentMapData && Field.currentMapData.isFixed) {
			// 1. 固定ダンジョンの場合: マップデータの rank を使用
			floor = Field.currentMapData.rank || 1;
		} else if (!Field.currentMapData || Field.currentMapData.id === 'WORLD') {
			// 2. フィールド（ワールドマップ）の場合: storystep * 5 を使用
			const step = App.data.progress.storyStep || 0;
			floor = Math.max(1, step * 5); // 0にならないよう最低1を担保
		}
		// 3. それ以外（アビス等のランダムダンジョン）: そのまま progress.floor を使用

			let totalExp = 0, totalGold = 0;
			const drops = []; 
			const defeatedMonsterIds = [];
		let hasRareDrop = false;      // 白フラッシュ用
		let hasUltraRareDrop = false; // 赤黒フラッシュ用

		// --- [1] 内部データ集計（討伐数・図鑑・経験値・ゴールドの計算） ---
		Battle.enemies.forEach(e => {
			if (e.isDead && !e.isFled) {
				const id = e.baseId || e.id;
					if (id) {
						defeatedMonsterIds.push(Number(id));
						if (!App.data.book.killCounts) App.data.book.killCounts = {};
					App.data.book.killCounts[id] = (App.data.book.killCounts[id] || 0) + 1;
					if (!App.data.book.monsters.includes(id)) App.data.book.monsters.push(id);
				}
				const base = Battle.getMonsterBaseById(id);
				if(base) { 
					totalExp += base.exp; 
					totalGold += base.gold; 
				}
			}
		});

		// 仲間加入クエスト等の討伐数を更新
		// 以前は装備再抽選用ヘルパー内で呼ばれていたため、
		// 装備ドロップ生成が発生しない通常戦闘では討伐系クエストが進まなかった。
		if (typeof App.noteQuestKills === 'function') App.noteQuestKills(defeatedMonsterIds);

		// 報酬の内部加算処理（ログを出す前に実行）
		App.data.gold += totalGold;

		const surviveMembers = Battle.party.filter(p => !p.isDead);
		const lbGrowthLogs = (typeof App.noteBattleVictory === 'function')
			? App.noteBattleVictory(Battle.party.filter(p => p))
			: [];
        if (typeof Dungeon !== 'undefined' && typeof Dungeon.completeAngelTrialIfNeeded === 'function') {
            lbGrowthLogs.push(...Dungeon.completeAngelTrialIfNeeded());
        }
		
		// 特性「56:解体」のパーティ合計値算出
		let bonusNormal = 0, bonusRare = 0, bonusPlus3 = 0;
		surviveMembers.forEach(p => {
			const charData = App.getChar(p.uid);
			if (charData && typeof PassiveSkill !== 'undefined') {
				bonusNormal += PassiveSkill.getSumValue(charData, 'drop_normal_pct');
				bonusRare   += PassiveSkill.getSumValue(charData, 'drop_rare_pct');
				bonusPlus3  += PassiveSkill.getSumValue(charData, 'equip_plus3_pct');
			}
		});

		// オプション再抽選サブ関数 (内部用)
		const createEquipWithMinRarity = (floor, plus, minRarityList, forcePart = null) => {
			let eq = App.createEquipByFloor('drop', floor, plus);
			if (forcePart && eq.type !== forcePart) {
				let attempts = 0;
				while (eq.type !== forcePart && attempts < 50) {
					eq = App.createEquipByFloor('drop', floor, plus);
					attempts++;
				}
			}
			eq.opts = eq.opts.map(opt => {
				const rule = DB.OPT_RULES.find(r => r.key === opt.key);
				if (!rule) return opt;
				let r = opt.rarity;
				let att = 0;
				while (!minRarityList.includes(r) && att < 15) {
					const rarRnd = Math.random() + 0.3; 
					if(rarRnd > 0.95 && rule.allowed.includes('EX')) r='EX';
					else if(rarRnd > 0.80 && rule.allowed.includes('UR')) r='UR';
					else if(rarRnd > 0.65 && rule.allowed.includes('SSR')) r='SSR';
					else if(rarRnd > 0.45 && rule.allowed.includes('SR')) r='SR';
					else r='R';
					att++;
				}
				const min = rule.min[r]||1, max = rule.max[r]||10;
				return { ...opt, rarity: r, val: Math.floor(Math.random()*(max-min+1))+min };
			});
			return eq;
		};

		// --- [2] 報酬アイテムの生成と確定 ---
		if (isEstark) {
			const specialEnemy = Battle.enemies.find(e => e.isSpecialBoss || e.isEstark || Number(e.id) === 902000 || Number(e.baseId) === 902000);
			if (specialEnemy) {
				const specialId = specialEnemy.baseId || specialEnemy.id || 902000;
				const killCount = (App.data.book.killCounts && App.data.book.killCounts[specialId]) ? App.data.book.killCounts[specialId] : 1;
				const baseRank = specialEnemy.rank || 999; 
				const rewardFloor = baseRank + (killCount * 5);
				const eq = createEquipWithMinRarity(rewardFloor, 3, ['UR', 'EX']);
				eq.val *= 3;
				eq.name = "【EX】" + eq.name;
				App.data.gems = (App.data.gems || 0) + 10000;
				App.data.inventory.push(eq);
				drops.push({ name: eq.name, isRare: true, isUltra: true, isSpecialBoss: true, isEstark: true, kind: 'equip' });
				hasUltraRareDrop = true;

				// 特殊ボス（ギルガメッシュ等）専用報酬だけで終わらせず、
				// monsters.js 側に個別設定された drops も同じ勝利で判定する。
				// 以前は isEstark 分岐に入ると通常ボス用の drops 処理へ進まなかったため、
				// ギルガメッシュの drops.normal / drops.rare が実質無視されていた。
				// 今後、特殊ボスを追加する場合も固有ドロップは monsters.js の drops に統一すること。
				const specialBase = Battle.getMonsterBaseById(specialId) || specialEnemy;
				const monsterDrops = specialBase.drops || specialEnemy.drops;

				if (monsterDrops && monsterDrops.rare && monsterDrops.rare.id != null) {
					const rareRate = (monsterDrops.rare.rate || 0) + bonusRare;
					if (Math.random() * 100 < rareRate) {
						const itemDef = DB.ITEMS.find(i => i.id === monsterDrops.rare.id);
						if (itemDef) {
							App.data.items[itemDef.id] = (App.data.items[itemDef.id] || 0) + 1;
							hasRareDrop = true;
							const type = (itemDef.id === 107) ? 'kai' : 'boss';
							drops.push({ name: itemDef.name, isRare: true, type: type, kind: 'item' });
						}
					}
				}

				if (monsterDrops && monsterDrops.normal && monsterDrops.normal.id != null) {
					const normRate = (monsterDrops.normal.rate || 0) + bonusNormal;
					if (Math.random() * 100 < normRate) {
						const itemDef = DB.ITEMS.find(i => i.id === monsterDrops.normal.id);
						if (itemDef) {
							App.data.items[itemDef.id] = (App.data.items[itemDef.id] || 0) + 1;
							drops.push({ name: itemDef.name, isRare: false, type: 'item', kind: 'item' });
						}
					}
				}
			}
		} else {
			Battle.enemies.forEach(e => {
				if (e.isFled) return;
				const base = Battle.getMonsterBaseById(e.baseId || e.id) || e;
				const monsterDrops = base.drops;
				const rewardFloor = Battle.getEquipmentRewardFloor(e, floor);

				// 1. レアドロップ判定 (独立)
				if (monsterDrops && monsterDrops.rare) {
					const rareRate = (monsterDrops.rare.rate || 0) + bonusRare;
					if (Math.random() * 100 < rareRate) {
						const itemDef = DB.ITEMS.find(i => i.id === monsterDrops.rare.id);
						if (itemDef) {
							App.data.items[itemDef.id] = (App.data.items[itemDef.id] || 0) + 1;
							hasRareDrop = true;
							const type = (itemDef.id === 107) ? 'kai' : 'boss';
							drops.push({ name: itemDef.name, isRare: true, type: type, kind: 'item' });
						}
					}
				} else if (floor >= 100) {
					if (Math.random() * 100 < (0.5 + bonusRare)) {
						let sid = 100 + Math.floor(Math.random() * 6);
						if (Math.random() < 0.1) sid = 106;
						if (Math.random() < 0.05) sid = 107;
						const itemDef = DB.ITEMS.find(i => i.id === sid);
						if (itemDef) {
							App.data.items[sid] = (App.data.items[sid] || 0) + 1;
							const isRare = (sid === 107);
							if (isRare) hasRareDrop = true;
							drops.push({ name: itemDef.name, isRare: isRare, type: isRare ? 'kai' : 'item', kind: 'item' });
						}
					}
				}
				
				// 2. 装備ドロップ判定 (独立)
				const isBoss = !!(base.isBoss || e.isBoss);
				const equipChance = isBoss ? 100 : 8; 
				if (Math.random() * 100 < equipChance) {
					let eq;
					if (isBoss && Math.random() < 0.02) {
						// 2%の確率で発生する超強力な「改」装備
						eq = createEquipWithMinRarity(rewardFloor, 3, ['SSR', 'UR', 'EX'], '武器');
						eq.name = eq.name.replace(/\+3$/, "") + "・改+3";
						
						// ★追加修正：能力増加は基礎値（主要7ステータス）のみとする
						const BASE_SCALE_KEYS = new Set(['atk', 'def', 'mag', 'mdef', 'spd', 'hp', 'mp']);
						for (let key in eq.data) {
							if (!BASE_SCALE_KEYS.has(key)) continue;
							if (typeof eq.data[key] === 'number') {
								eq.data[key] *= 2; // 基礎ステータスを2倍
							}
						}
						
						eq.val *= 4;
						hasUltraRareDrop = true;
						// 超レア演出用の type: 'kai'
						drops.push({ name: eq.name, isRare: true, type: 'kai', kind: 'equip' });
					} else {
						let fixedPlus = isBoss ? 3 : (Math.random() * 100 < (10 + bonusPlus3) ? 3 : 2);
						eq = App.createEquipByFloor('drop', rewardFloor, fixedPlus);
						const isPlus3 = (eq.plus === 3);
						if (isPlus3 || isBoss) hasRareDrop = true;
						drops.push({ name: eq.name, isRare: (isPlus3 || isBoss), type: isBoss ? 'boss' : 'normal', kind: 'equip' });
					}
					App.data.inventory.push(eq);
				}
				
				// 3. 通常ドロップ判定 (独立)
				if (monsterDrops && monsterDrops.normal) {
					const normRate = (monsterDrops.normal.rate || 0) + bonusNormal;
					if (Math.random() * 100 < normRate) {
						const itemDef = DB.ITEMS.find(i => i.id === monsterDrops.normal.id);
						if (itemDef) {
							App.data.items[itemDef.id] = (App.data.items[itemDef.id] || 0) + 1;
							drops.push({ name: itemDef.name, isRare: false, type: 'item', kind: 'item' });
						}
					}
				} else {
					if (Math.random() * 100 < (10 + bonusNormal)) {
						const candidates = DB.ITEMS.filter(i => i.rank <= Math.min(200, floor) && i.type !== '貴重品' && i.id < 100);
						if (candidates.length > 0) {
							const item = candidates[Math.floor(Math.random() * candidates.length)];
							App.data.items[item.id] = (App.data.items[item.id] || 0) + 1;
							drops.push({ name: item.name, isRare: false, type: 'item', kind: 'item' });
						}
					}
				}
			});
		}

		// --- [3] 深淵の魔窟限定：勝利時1%の仲間モンスター加入判定 ---
		const monsterRecruitResult = (typeof App.tryRecruitMonsterAfterBattle === 'function')
			? App.tryRecruitMonsterAfterBattle(Battle.enemies)
			: null;

		// --- [4] 世界状態・フラグの先行確定 ---
		// 演出中のリロード対策として、ボスマスを階段にする等の処理をログ表示前に完結させます
		if ((isBossBattle && !isEstark) || fixedHunter) {
			if (typeof Dungeon !== 'undefined' && typeof Dungeon.onBossDefeated === 'function') {
				Dungeon.onBossDefeated(); // ここで mapChanges 等が更新される
			}
			// 注：StoryManager.onBattleWin は会話を伴うため演出の最後に行いますが、
			// 討伐フラグ自体はこの上の App.save() で確実に永続化されます。
		}
		const keyRewards = keyReward
			? (Array.isArray(keyReward.colors)
				? keyReward.colors.filter(Boolean).map(color => ({
					...keyReward,
					color: color
				}))
				: [keyReward])
			: [];

		if (keyRewards.length > 0 && typeof Dungeon !== 'undefined' && typeof Dungeon.completeKeyGuardianReward === 'function') {
			keyRewards.forEach(reward => {
				Dungeon.completeKeyGuardianReward(reward);
			});

			if (App.data.battle) {
				App.data.battle.keyReward = null;
				App.data.battle.fixedKeyReward = null;
			}
		}

		// --- [5] セーブの実行（ここで報酬と世界状態を確定・永続化） ---
		App.save(); 

		// --- [6] ここから勝利演出（ログ表示、レベルアップ、待機など） ---
		Battle.log(`<br><span style="color:#ffff00; font-size:1em; font-weight:bold;">戦闘に勝利した！</span>`);
		Battle.log(`${totalGold} Goldを獲得！`);
		Battle.log(`${totalExp} ポイントの経験値を 獲得した！`);
		if (monsterRecruitResult && monsterRecruitResult.message) {
			Battle.log(`<span style="color:#7fffd4; font-weight:bold;">${monsterRecruitResult.message}</span>`);
		}

		const resultLevelLogs = [];
		const resultTraitAcquireLogs = [];
		const resultTraitGrowthLogs = [];

		const partyHpRegen = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getPartySumValue('post_battle_hp_regen_pct') : 0;
		const partyMpRegen = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.getPartySumValue('post_battle_mp_regen_pct') : 0;
		
		let hpRecovered = false; 
		let mpRecovered = false;

		// 勝利リザルトのループ処理
		for (const p of surviveMembers) {
			const charData = App.getChar(p.uid);
			if (!charData) continue;

			const oldLv = charData.level;

			// App.gainExp が [Lv通知, ステ上昇, スキル習得, 特性習得] の順で配列を返す
			const lvLogs = App.gainExp(charData, totalExp);

			// レベルアップ/スキル・特性習得ログはいったん集約し、
			// リザルト全体で見やすい順序に並べて表示する。
			for (const msg of lvLogs) {
				if (!msg) continue;
				if (String(msg).includes('新たな特性')) resultTraitAcquireLogs.push(msg);
				else resultLevelLogs.push(msg);
			}

			// 特性の成長判定
			let traitGrowthLog = null;
			if (typeof PassiveSkill !== 'undefined' && PassiveSkill.checkTraitGrowth) {
				traitGrowthLog = PassiveSkill.checkTraitGrowth(charData);
			}

			if (traitGrowthLog) {
				const logs = traitGrowthLog.split('<br>');
				for (const log of logs) {
					if (log) resultTraitGrowthLogs.push(log);
				}
			}

			// ステータス更新および回復処理
			if (charData.level > oldLv) {
				const stats = App.calcStats(charData);
				p.level = charData.level;
				p.baseMaxHp = stats.maxHp;
				p.baseMaxMp = stats.maxMp;
				p.hp = p.baseMaxHp;
				p.mp = p.baseMaxMp;
			} else {
				if (partyHpRegen > 0 && p.hp < p.baseMaxHp) {
					const amt = Math.floor(p.baseMaxHp * (partyHpRegen / 100));
					if (amt > 0) {
						p.hp = Math.min(p.baseMaxHp, p.hp + amt);
						hpRecovered = true;
					}
				}
				if (partyMpRegen > 0 && p.mp < p.baseMaxMp) {
					const amt = Math.floor(p.baseMaxMp * (partyMpRegen / 100));
					if (amt > 0) {
						p.mp = Math.min(p.baseMaxMp, p.mp + amt);
						mpRecovered = true;
					}
				}
			}
		}

		for (const msg of resultLevelLogs) {
			Battle.log(msg);
			await Battle.resultWait(500);
		}

		for (const msg of resultTraitAcquireLogs) {
			Battle.log(msg);
			await Battle.resultWait(350);
		}

		for (const msg of resultTraitGrowthLogs) {
			Battle.log(msg);
			await Battle.resultWait(250);
		}

		const uniqueLbGrowthLogs = [];
		const seenLbGrowthLogs = new Set();
		for (const msg of lbGrowthLogs) {
			if (!msg || seenLbGrowthLogs.has(msg)) continue;
			seenLbGrowthLogs.add(msg);
			uniqueLbGrowthLogs.push(msg);
		}
		for (const msg of uniqueLbGrowthLogs) {
			Battle.log(msg);
			await Battle.resultWait(350);
		}

		if (hpRecovered) {
			Battle.log(`<span style="color:#8f8;">特性：応急手当でパーティのHPが回復した！</span>`);
		}
		if (mpRecovered) {
			Battle.log(`<span style="color:#88f;">特性：魔力充填でパーティのMPが回復した！</span>`);
		}
		
		// ドロップ演出（アイテム → 装備の順に表示）
		const itemDrops = drops.filter(d => (d.kind || (d.type === 'item' ? 'item' : 'equip')) === 'item');
		const equipDrops = drops.filter(d => (d.kind || (d.type === 'item' ? 'item' : 'equip')) !== 'item');
		const showDropLog = (d) => {
			if (d.isSpecialBoss || d.isEstark) {
				Battle.log(`<span style="color:#ffd700; font-weight:bold;">10,000 GEM</span> を獲得！`);
				Battle.log(`なんと <span style="color:#ffd700; font-weight:bold;">${d.name}</span> を手に入れた！`);
			} else if (d.type === 'kai') {
				Battle.log(`なんと <span style="color:#ff00ff; font-weight:bold;">${d.name}</span> を手に入れた！`);
			} else if (d.isRare) {
				Battle.log(`なんと <span class="log-rare-drop">${d.name}</span> を手に入れた！`);
			} else {
				Battle.log(`${d.name} を手に入れた！`);
			}
		};

		if (drops.length > 0) {
			Battle.log("<br>");
			await Battle.resultWait(500);
			
			if ((hasUltraRareDrop || hasRareDrop) && !Battle.resultSkipRequested) {
				const ultraFlash = document.getElementById('drop-flash-ultra');
				const rareFlash = document.getElementById('drop-flash');
				let targetEl = null;
				let activeClass = "";

				if (hasUltraRareDrop && ultraFlash) {
					targetEl = ultraFlash; activeClass = 'flash-ultra-active';
				} else if (hasRareDrop && rareFlash) {
					targetEl = rareFlash; activeClass = 'flash-active';
				}

				if (targetEl) {
					[ultraFlash, rareFlash].forEach(el => {
						if (el) { el.style.display = 'none'; el.classList.remove('flash-active', 'flash-ultra-active'); }
					});
					void targetEl.offsetWidth; 
					targetEl.style.display = 'block';
					targetEl.classList.add(activeClass);
					targetEl.onanimationend = () => {
						targetEl.style.display = 'none';
						targetEl.classList.remove(activeClass);
						targetEl.onanimationend = null;
					};
				}
			}

			for (const d of itemDrops) {
				showDropLog(d);
				await Battle.resultWait(150);
			}
			for (const d of equipDrops) {
				showDropLog(d);
				await Battle.resultWait(150);
			}
		}

		App.save(); 
		Battle.resultProcessing = false;
		Battle.resultReadyToEnd = true;
		Battle.log("\n▼ 画面タップで終了 ▼");

		// ★削除：戦闘画面中にストーリーを実行しない
		
		// ストーリー後処理（会話イベント等の実行）
		// --- [修正] 演出の最後で予約を消化する ---
		//if (isBossBattle && !isEstark) {
		//	if (typeof Dungeon !== 'undefined' && typeof Dungeon.onBossDefeated === 'function') {
		//		Dungeon.onBossDefeated();
		//	}
		//	if (eventId && typeof StoryManager !== 'undefined' && typeof StoryManager.onBattleWin === 'function') {
		//		// 予約情報を消してから実行
		//		if (App.data.progress.pendingBattleWinEventId === eventId) {
		//			delete App.data.progress.pendingBattleWinEventId;
		//			App.save();
		//		}
		//		await StoryManager.onBattleWin(eventId);
		//	}
		//}
	},
	
    lose: () => { 
		Battle.active = false; 
		Battle.log("全滅した..."); 
		if (typeof App.clearPendingLimitBreakTrial === 'function') App.clearPendingLimitBreakTrial();
		// ★追加: 全滅回数のカウントアップ
		if(App.data.stats) App.data.stats.wipeoutCount = (App.data.stats.wipeoutCount || 0) + 1;
		
		// ★追加: 最初の戦闘での特別救済判定
        const eventId = (App.data.battle && App.data.battle.eventId) ? App.data.battle.eventId : null;
        const storyLossEventId = App.data.battle?.storyLossEventId || null;
        if (eventId === 'game_start' || eventId === 'game_start_retry') {
            // 一時LBが残っていた場合はいったん必ず解除し、再試行イベント側で再付与する。
            if (typeof App.clearTemporaryStoryPower === 'function') {
                App.clearTemporaryStoryPower({ id: 'game_start_retry_lb99' });
            }

            // フィールドに戻った後に「game_start_retry」イベントが走るように予約
            App.data.progress.pendingEventId = 'game_start_retry';

			// 最初の救済敗北は通常の全滅回数に含めない
			if(App.data.stats) App.data.stats.wipeoutCount = Math.max(0, (App.data.stats.wipeoutCount || 1) - 1);

            App.save();
            Battle.endBattle(false); // 全滅扱いにせず、フィールドに戻す
            return;
        }

        if (storyLossEventId) {
            if (!App.data.progress) App.data.progress = {};
            App.data.progress.pendingEventId = storyLossEventId;
            App.save();
            Battle.endBattle(false);
            return;
        }
		
		Battle.endBattle(true); 
	},
	
    endBattle: (isGameOver = false) => {
        if (Battle.phase === 'result' && Battle.resultProcessing && !Battle.resultReadyToEnd && !isGameOver) {
            Battle.handleResultTap();
            return;
        }
        Battle.resultProcessing = false;
        Battle.resultReadyToEnd = false;
        Battle.resultSkipRequested = false;
        if (Array.isArray(Battle.resultWaiters)) {
            const waiters = Battle.resultWaiters.splice(0);
            waiters.forEach(fn => { try { fn(); } catch(e) {} });
        }
        ['drop-flash-ultra', 'drop-flash'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.classList.remove('flash-active', 'flash-ultra-active');
                el.onanimationend = null;
            }
        });
        const isDungeon = (typeof Dungeon !== 'undefined' && Field.currentMapData && Field.currentMapData.isDungeon);
        
		// ★追加：戦闘データを消去する前に、必要な情報を退避
        const isBossBattle = App.data.battle?.isBossBattle || false;
        const isEstark = App.data.battle?.isEstark || false;
        const eventId = App.data.battle?.eventId || null;
		
        // 戦闘データの初期化
        App.data.battle = { active: false };

        // パーティの状態を同期
        Battle.party.forEach(p => { 
            const d = App.getChar(p.uid); 
            if(d) { 
                d.currentHp = p.hp; 
                d.currentMp = p.mp; 
                delete d.battleStatus; // 状態異常はリセット
            } 
        });

        // ストーリー専用の一時強化は戦闘終了時点で必ず解除する。
        // これにより、勝利後イベントが中断・リロードされてもLB99がフィールドへ漏れない。
        if (App.data?.progress?.tempStoryPower && typeof App.clearTemporaryStoryPower === 'function') {
            App.clearTemporaryStoryPower({ id: App.data.progress.tempStoryPower.id });
        }

        App.save();
		
        if (isGameOver) {
            // ★全滅時: HPを1にしてフィールドに戻る (全ての戦闘で共通)
            App.data.characters.forEach(c => {
                if(App.data.party.includes(c.uid)) c.currentHp = 1;
            });
            App.save();

            // Battle.log("\n意識が遠のいていく……");
            Battle.schedule(() => {
                // ダンジョン内の全滅なら引数 true を渡して脱出
                if (isDungeon) {
                    Dungeon.exit(true); 
                } else {
                    // 通常フィールドでの全滅時はそのままフィールドシーンへ
					Dungeon.exit(true); 
                    App.changeScene('field');
                }
                if (typeof App.resetFieldLog === 'function') App.resetFieldLog();
            }, 2000);
        } else {
            // ★修正：setTimeoutをasync化し、画面切り替え後にmain.jsのinit処理でストーリーを実行（復帰と同対応）
            Battle.schedule(async () => {
                App.changeScene('field');
                if (typeof App.resetFieldLog === 'function') App.resetFieldLog();
            }, 500);
        }
    },
    toggleAuto: () => {
        const shouldStartAuto = !Battle.auto;
        Battle.auto = shouldStartAuto;
        Battle.updateAutoButton();

        if (shouldStartAuto) {
            const canResumeInput = ['input', 'skill_select', 'item_select', 'target_select'].includes(Battle.phase);
            if (canResumeInput) {
                Battle.closeSubMenu();
                Battle.closeStrategyModal();
                Battle.selectingAction = null;
                Battle.selectedItemOrSkill = null;
                Battle.phase = 'input';
                Battle.findNextActor();
            }
        }
    },
    updateAutoButton: () => {
        ['btn-auto', 'btn-auto-bottom'].forEach(id => {
            const btn = Battle.getEl(id);
            if(btn) {
                btn.innerText = `AUTO: ${Battle.auto?'ON':'OFF'}`;
                btn.style.background = Battle.auto ? '#d00' : '#333';
            }
        });
    },

    handleResultTap: () => {
        if (Battle.phase !== 'result') return;
        if (Battle.resultReadyToEnd) {
            Battle.endBattle(false);
            return;
        }
        Battle.resultSkipRequested = true;
        if (Array.isArray(Battle.resultWaiters)) {
            const waiters = Battle.resultWaiters.splice(0);
            waiters.forEach(fn => { try { fn(); } catch(e) {} });
        }
    },

    resultWait: (ms) => {
        const waitMs = Battle.getBattleWaitMs(ms);
        if (waitMs <= 0 || Battle.resultSkipRequested) return Promise.resolve();
        if (Battle.phase !== 'result') return Battle.wait(ms);
        return new Promise(resolve => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve();
            };
            const timer = setTimeout(finish, waitMs);
            if (!Array.isArray(Battle.resultWaiters)) Battle.resultWaiters = [];
            Battle.resultWaiters.push(() => {
                clearTimeout(timer);
                finish();
            });
        });
    },

    wait: (ms) => {
        const waitMs = Battle.getBattleWaitMs(ms);
        return waitMs <= 0 ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, waitMs));
    }
};
