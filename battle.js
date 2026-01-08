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
        atk: '攻撃力', def: '守備力', spd: '素早さ', mag: '魔力',
        elmResUp: '全属性耐性', elmResDown: '全属性耐性',
        Poison: '毒', ToxicPoison: '猛毒', Shock: '感電', Fear: '怯え',
        SpellSeal: '呪文封印', SkillSeal: '特技封印', HealSeal: '回復封印',HPRegen: 'HP回復' ,MPRegen: 'MP回復',
        // ★以下を追記・修正
        InstantDeath: '即死', 
        Debuff: '弱体',
        Seal: '封印'
    },
    
    // 状態異常と耐性IDの対応表 (拡張)
    RESIST_MAP: {
        Poison: 'Poison', ToxicPoison: 'Poison',
        Shock: 'Shock',
        Fear: 'Fear',
        SpellSeal: 'SpellSeal', // ★修正: 個別の封印耐性を参照するように変更
        SkillSeal: 'SkillSeal', 
        HealSeal: 'HealSeal',
        PercentDamage: 'InstantDeath', // 即死ガードで割合ダメも防ぐ
        InstantDeath: 'InstantDeath',
        Debuff: 'Debuff'
    },

    getEl: (id) => document.getElementById(id),
    
	// ★追加: モンスター名を赤字にするヘルパー関数
    getColoredName: (actor) => {
        if (actor instanceof Monster) {
            return `<span style="color:#ff4444; font-weight:bold;">${actor.name}</span>`;
        }
        return `【${actor.name}】`;
    },

    // ★追加: スキルが補助（回復・蘇生・強化等）かどうかを判定する
    isSupportSkill: (d) => {
        if (!d) return false;
        const type = d.type || '';
        if (['回復', '蘇生', '強化', 'MP回復'].includes(type)) return true;
        if (d.debuff_reset || d.CureAilments || d.HPRegen || d.MPRegen) return true;
        return false;
    },
	
    init: () => {
        Battle.active = true;
        Battle.phase = 'init';
        Battle.commandQueue = [];
        Battle.currentActorIndex = 0;
        Battle.auto = false;
		Battle.runAttemptCount = 0; // ★追加: カウントリセット
		Battle.skillScrollPositions = {};
        Battle.updateAutoButton();
        
        const logEl = Battle.getEl('battle-log');
        if(logEl) logEl.innerHTML = '';

		// ★修正: 背景画像の出し分けロジック
        const enemyArea = document.getElementById('enemy-container');
        if (enemyArea) {
            // デフォルトは草原(フィールド)
            let bgKey = 'battle_bg_field';

            // ■ ダンジョン内にいる場合
            // ★追加: エスターク戦専用背景
            if (App.data.battle && App.data.battle.isEstark) {
                bgKey = 'battle_bg_lastboss';
            } else if (typeof Field !== 'undefined' && Field.currentMapData && Field.currentMapData.isDungeon) {
                const floor = App.data.progress.floor;
                const type = App.data.dungeon.genType; 

                if (floor % 10 === 0) {
                    bgKey = 'battle_bg_boss';
                } else if (type === 2) {
                    bgKey = 'battle_bg_maze';
                } else {
                    bgKey = 'battle_bg_dungeon';
                }
            } 
            // ■ 通常フィールドにいる場合 (MAP_DATAを参照)
            else if (typeof Field !== 'undefined' && typeof MAP_DATA !== 'undefined') {
                // 現在の座標からタイル文字を取得（マップのループも考慮）
                const mapW = MAP_DATA[0].length;
                const mapH = MAP_DATA.length;
                const tx = ((Field.x % mapW) + mapW) % mapW;
                const ty = ((Field.y % mapH) + mapH) % mapH;
                const tile = MAP_DATA[ty][tx];

                // タイル文字に応じて背景を変更
                if (tile === 'F') {
                    bgKey = 'battle_bg_forest';   // 森
                } else if (tile === 'L') {
                    bgKey = 'battle_bg_mountain'; // 山 (L)
                } 
            }

            // 画像データの存在チェックと適用
            if (typeof GRAPHICS !== 'undefined' && GRAPHICS.images && GRAPHICS.images[bgKey]) {
                enemyArea.style.backgroundImage = `url('${GRAPHICS.images[bgKey].src}')`;
                enemyArea.style.backgroundSize = 'cover';
                enemyArea.style.backgroundPosition = 'center bottom';
                enemyArea.style.backgroundRepeat = 'no-repeat';
            } else {
                enemyArea.style.backgroundColor = '#222';
                enemyArea.style.backgroundImage = 'none';
            }
        }
		
		
        // --- パーティ生成 ---
        Battle.party = [];
        if (App.data && App.data.party) {
            Battle.party = App.data.party.map(uid => {
                if(!uid) return null;
                const charData = App.getChar(uid);
                if(!charData) return null;
                const player = new Player(charData);
                
                const stats = App.calcStats(charData);
                player.hp = Math.min(player.hp, stats.maxHp);
                player.mp = Math.min(player.mp, stats.maxMp);
                player.baseMaxHp = stats.maxHp;
                player.baseMaxMp = stats.maxMp;

                player.atk = stats.atk;
                player.def = stats.def;
                player.spd = stats.spd;
                player.mag = stats.mag;
                player.elmAtk = stats.elmAtk || {};
                player.elmRes = stats.elmRes || {};
                player.finDmg = stats.finDmg || 0;
                player.finRed = stats.finRed || 0;
                
				// パッシブ・シナジー取得
                player.passive = Battle.getPassives(player);
				
				// ★追加: 「スキル習得」シナジー (混沌の刃/壁)
                // 複数のシナジーが配列で入っていることを考慮してループ処理する
                if (player.equips) {
					Object.values(player.equips).forEach(eq => {
						if (eq && eq.isSynergy && eq.effects && eq.effects.includes('grantSkill')) {
							// 複数のシナジーの中から 'grantSkill' を持っているものを探す
                            const grantSyn = eq.synergies.find(s => s.effect === 'grantSkill');
							if (grantSyn && grantSyn.value) {
								if (!player.skills.find(s => s.id === grantSyn.value)) {
									const newSkill = DB.SKILLS.find(s => s.id === grantSyn.value);
									if (newSkill) player.skills.push(newSkill);
								}
							}
						}
					});
				}
				
				// 保存された状態があれば復元、なければ初期化
                if (charData.battleStatus) {
                    player.battleStatus = JSON.parse(JSON.stringify(charData.battleStatus));
                } else {
                    Battle.initBattleStatus(player);
                }
				
				// 「軍神」シナジー (開幕バフ)
                if (player.passive.warGod) {
                    player.battleStatus.buffs['atk'] = { val: 1.5, turns: null };
                    player.battleStatus.buffs['mag'] = { val: 1.5, turns: null };
                }
				
                if (player.passive.atkDouble) {
                    player.battleStatus.buffs['atk'] = { val: 2.0, turns: null };
                }
				
                if (player.passive.magDouble) {
                    player.battleStatus.buffs['mag'] = { val: 2.0, turns: null };
                }
				
                return player;
            }).filter(p => p !== null);
        }

        if (Battle.party.length === 0 || Battle.party.every(p => p.isDead)) {
            App.log("戦えるメンバーがいません！");
            Battle.endBattle(true);
            return;
        }

        // --- 敵生成・復帰 ---
        if (App.data.battle && App.data.battle.active && Array.isArray(App.data.battle.enemies) && App.data.battle.enemies.length > 0) {
            const isBoss = App.data.battle.isBossBattle || false;
            const isEstark = App.data.battle.isEstark || false;

            Battle.log("戦闘に復帰した！");
            Battle.enemies = App.data.battle.enemies.map(e => {
                let base = DB.MONSTERS.find(m => m.id === e.baseId);
                if (!base && window.generateEnemy) {
                    base = { name: e.name, hp: e.maxHp, atk: 10, def: 10, spd: 10, mag: 10, exp: 0, gold: 0 };
                }
                if (!base) return null;
                const m = new Monster(base, 1.0);
                m.hp = e.hp; m.baseMaxHp = e.maxHp; m.name = e.name; m.id = e.baseId; 
                m.isDead = m.hp <= 0;
                m.isFled = false;
                if(base.actCount) m.actCount = base.actCount;
                if(base.acts) m.acts = base.acts; 

                m.atk = m.baseStats.atk;
                m.def = m.baseStats.def;
                m.spd = m.baseStats.spd;
                m.mag = m.baseStats.mag;
                m.elmAtk = JSON.parse(JSON.stringify(base.elmAtk || {}));
                m.elmRes = JSON.parse(JSON.stringify(base.elmRes || {}));
                m.finDmg = 0; m.finRed = 0;
                m.passive = base.passive || {};
                
                if (e.battleStatus) {
                    m.battleStatus = e.battleStatus;
                } else {
                    Battle.initBattleStatus(m);
                }
                return m;
            }).filter(enemy => enemy !== null);

            App.data.battle.isBossBattle = isBoss;
            App.data.battle.isEstark = isEstark;

        } else {
            const isBoss = (App.data.battle && App.data.battle.isBossBattle) || false;
            const isEstark = (App.data.battle && App.data.battle.isEstark) || false;

            if (isEstark) {
                const base = DB.MONSTERS.find(m => m.id === 2000);
                if (base) {
                    const killCount = App.data.estarkKillCount || 0;
                    const scale = 1.0 + (killCount * 0.05);
                    const m = new Monster(base, scale);
                    m.id = 2000;
					m.isEstark = true; 
                    m.actCount = base.actCount || 3;
                    Battle.enemies = [m];
                    Battle.enemies.forEach(enemy => Battle.initBattleStatus(enemy));
                }
            } else {
                Battle.enemies = Battle.generateNewEnemies(isBoss);
                Battle.enemies.forEach(enemy => {
                    Battle.initBattleStatus(enemy);
                    const base = DB.MONSTERS.find(m => m.id === enemy.id);
                    enemy.passive = base ? (base.passive || {}) : {};
                });
            }

            App.data.battle = {
                active: true, 
                isBossBattle: isBoss,
                isEstark: isEstark,
                enemies: Battle.enemies.map(enemy => ({ 
                    baseId: enemy.id, 
                    hp: enemy.hp, 
                    maxHp: enemy.baseMaxHp, 
                    name: enemy.name,
                    battleStatus: enemy.battleStatus 
                }))
            };
            App.save();
        }

        Battle.renderEnemies();
        Battle.renderPartyStatus();

        const scene = document.getElementById('battle-scene');
        if(scene) {
            scene.onclick = (e) => {
                if (Battle.phase === 'result') Battle.endBattle(false);
            };
        }

        Battle.startInputPhase();
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
        let val = (actor[key] !== undefined) ? actor[key] : 0;
        if (val === 0 && typeof actor.getStat === 'function') val = actor.getStat(key);
        if (key === 'maxHp') val = actor.baseMaxHp;
        if (key === 'maxMp') val = actor.baseMaxMp;

        // ★修正: 耐性取得時、バフ(加算)とデバフ(減算)を計算
        if (key === 'resists') {
            const base = actor.resists || val || {};
            const res = { ...base }; 

            // バフ (加算)
            if (actor.battleStatus && actor.battleStatus.buffs) {
                for (let bKey in actor.battleStatus.buffs) {
                    if (bKey.startsWith('resists_')) {
                        const ailment = bKey.replace('resists_', '');
                        res[ailment] = (res[ailment] || 0) + actor.battleStatus.buffs[bKey].val;
                    }
                }
            }

            // ★追加: デバフ (減算)
            if (actor.battleStatus && actor.battleStatus.debuffs) {
                for (let dKey in actor.battleStatus.debuffs) {
                    if (dKey.startsWith('resists_')) {
                        const ailment = dKey.replace('resists_', '');
                        // デバフ値(例:30)を引く
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
     * 新規モンスターの生成 (出現数増加・レア複数・深層スケーリング修正版)
     */
    generateNewEnemies: (isBoss) => {
        const newEnemies = [];
        const floor = App.data.progress.floor || 1; 
        
        // ★修正: 出現数(1～4)を関数冒頭で定義し、全てのブロックで参照可能にする ※ボスなら3体まで
        const count = isBoss ? (1 + Math.floor(Math.random() * 3)) : (1 + Math.floor(Math.random() * 4));

        // --- 201階以降: 自動スケーリング・エンカウントシステム ---
        if (floor >= 201) {
            if (isBoss) {
                Battle.log(`<span style="color:#ff0000; font-size:1em; font-weight:bold;">深淵の守護者が現れた！！</span>`);
                // ボス候補: ID 1000～1200 (1160, 1162は除外)
                const candidates = DB.MONSTERS.filter(m => 
                    m.id >= 1000 && m.id <= 1200 && m.id !== 1160 && m.id !== 1162
                );
                
                for(let i=0; i<count; i++) {
                    const base = candidates[Math.floor(Math.random() * candidates.length)];
                    if(!base) continue;
                    const m = Battle.createDeepFloorMonster(base, floor, true);
                    if (count > 1) m.name += String.fromCharCode(65+i);
                    newEnemies.push(m);
                }
            } else {
                Battle.log("強力な魔物の気配がする…！");
                // 雑魚候補: ID 101～999
                const candidates = DB.MONSTERS.filter(m => m.id >= 101 && m.id <= 999);
                
                for(let i=0; i<count; i++) {
                    const base = candidates[Math.floor(Math.random() * candidates.length)];
                    if(!base) continue;
                    const m = Battle.createDeepFloorMonster(base, floor, false);
                    if (count > 1) m.name += String.fromCharCode(65+i);
                    newEnemies.push(m);
                }
            }
            return newEnemies;
        }

        // --- 200階まで: 既存ロジックを1～4体・レア複数対応へ拡張 ---
        const setupEnemyStats = (m) => {
			m.atk = m.baseStats.atk;
			m.def = m.baseStats.def;
			m.spd = m.baseStats.spd;
			m.mag = m.baseStats.mag;
			
			// ★修正: モンスターが元々持っている耐性データを尊重し、空オブジェクトで上書きしない
			m.elmAtk = JSON.parse(JSON.stringify(m.data.elmAtk || {}));
			m.elmRes = JSON.parse(JSON.stringify(m.data.elmRes || {}));
			
			m.finDmg = 0; m.finRed = 0;
			return m;
		};

        if (isBoss) {
            Battle.log("強大な魔物が現れた！");
            const bosses = DB.MONSTERS.filter(m => m.minF === floor && m.id >= 1000);
            if (bosses.length > 0) {
                bosses.forEach(base => {
                    const m = new Monster(base, 1.0);
                    m.name = base.name; m.id = base.id; m.actCount = base.actCount || 1;
                    newEnemies.push(setupEnemyStats(m));
                });
            } else {
                const base = DB.MONSTERS.find(m => m.id === 1000);
                if (base) newEnemies.push(setupEnemyStats(new Monster(base, 1.0)));
            }
        } else {
            Battle.log("魔物が現れた！");
            // ★修正: 枠(1～4)ごとに個別にレア抽選を行うことで、レアの複数出現を可能に
            for(let i=0; i<count; i++) {
                let monsterData = null;
                
                // レア抽選 
                if (Math.random() < 0.05) { 
                    const rares = DB.MONSTERS.filter(m => m.isRare && m.minF <= floor && floor <= (m.rank * 2));
                    if (rares.length > 0) {
                        monsterData = rares[Math.floor(Math.random() * rares.length)];
                    }
                }
                
                // レア抽選に漏れた場合は通常の敵生成
                if (!monsterData && window.generateEnemy) {
                    monsterData = window.generateEnemy(floor);
                }

                if (monsterData) {
                    const m = new Monster(monsterData, 1.0);
                    if (count > 1) m.name += String.fromCharCode(65+i);
                    newEnemies.push(setupEnemyStats(m));
                }
            }
        }
        return newEnemies;
    },
	
	
/**
     * 深層モンスターの個別生成・スケーリング
     */
    createDeepFloorMonster: (base, floor, isBoss) => {
        const m = new Monster(base, 1.0);
        const rank = Math.max(1, base.rank || 1);
        
        // ステータス倍率の決定
        // 雑魚: (DB値/Rank) * 階数 * (0.9～1.3)
        // ボス: (DB値/Rank) * 階数 * 2.0
        const randMult = isBoss ? 2.0 : (0.9 + Math.random() * 0.4);
        const baseScale = (floor / rank) * randMult;

        m.hp = Math.floor((base.hp / rank) * floor * randMult);
        m.baseMaxHp = m.hp;
        m.mp = Math.floor((base.mp / rank) * floor * randMult);
        m.baseMaxMp = m.mp;

        m.baseStats.atk = Math.floor((base.atk / rank) * floor * randMult);
        m.baseStats.def = Math.floor((base.def / rank) * floor * randMult);
        m.baseStats.spd = Math.floor((base.spd / rank) * floor * randMult);
        m.baseStats.mag = Math.floor((base.mag / rank) * floor * randMult);

        // 報酬計算
        m.exp = Math.floor(((base.exp || 10) / rank) * floor * randMult);
        m.gold = Math.floor(((base.gold || 10) / rank) * floor * randMult);

        // 耐性設定
		// ボス（isBoss）またはレア敵（isRare）でない雑魚のみ一律50%にする
		if (!isBoss && !base.isRare) {
			m.resists = { 
				Poison:50, ToxicPoison:50, Shock:50, Fear:50, Seal:50, 
				Debuff:50, InstantDeath:50, SkillSeal:50, SpellSeal:50, HealSeal:50 
			};
		} else {
			// ボスおよびレア敵（はぐれメタル等）はマスタデータの耐性をそのまま使用
			m.resists = JSON.parse(JSON.stringify(base.resists || {}));
		}

        // 属性耐性: 雑魚(-50～50) / ボス(-30～80)
        m.elmRes = {};
		CONST.ELEMENTS.forEach(el => {
			// ★修正: はぐれメタル等のレア敵(isRare)であれば、DBの耐性(1000%等)を優先する
			if (base.isRare && base.elmRes && base.elmRes[el] !== undefined) {
				m.elmRes[el] = base.elmRes[el];
			} else {
				const min = isBoss ? -30 : -50;
				const max = isBoss ? 80 : 50;
				m.elmRes[el] = min + Math.floor(Math.random() * (max - min + 1));
			}
		});

        // 名前のクリーニング (神・、 Lv○○を除去)
        m.name = base.name.replace(/^(神・|強・|真・|極・)+/, '').replace(/\s?Lv\d+[A-Z]?$/, '').trim();

        // スキルの追加 (MP500以上の物理・魔法・特殊)
        const skillCount = isBoss ? 4 : 2;
        const candidates = DB.SKILLS.filter(s => s.mp >= 500 && ['物理', '魔法', '特殊'].includes(s.type));
        
        m.acts = JSON.parse(JSON.stringify(base.acts || [{id:1, rate:100}]));
        for(let i=0; i<skillCount; i++) {
            const sk = candidates[Math.floor(Math.random() * candidates.length)];
            if (sk && !m.acts.some(a => a.id === sk.id)) {
                m.acts.push({ id: sk.id, rate: 20, condition: 0 }); // 重み20で追加
            }
        }
        
        // パッシブの初期化
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
            nameDiv.innerText = `【${actor.name}】の行動`;
        }
        Battle.updateCommandButtons(); 
        Battle.log(`${actor.name}はどうする？`);
    },

    // ★オート戦闘の思考ルーチン (優先順位と条件判定のコアロジック)
    decideAutoAction: (actor) => {
        const config = actor.config || { fullAuto: false, hiddenSkills: [] };
        const hiddenIds = config.hiddenSkills.map(id => Number(id));

        if (config.fullAuto) {
            // 1. 使用可能なスキルの抽出 (マダンテ禁止・封印設定・MP不足・状態異常制限をすべてチェック)
            const validSkills = (actor.skills || []).filter(s => {
                const sId = Number(s.id);
                if (sId === 1) return false; // 通常攻撃は除外
                if (sId >= 500 && sId <= 505) return false; // ★マダンテ系使用不可
                if (hiddenIds.includes(sId)) return false; // 封印設定スキルは除外
                if (actor.mp < s.mp) return false; // MP不足

                // 状態異常による封印デバフのチェック
                const ailments = actor.battleStatus.ailments;
                if (ailments['SpellSeal'] && ['魔法','強化','弱体'].includes(s.type)) return false;
                if (ailments['SkillSeal'] && ['物理','特殊'].includes(s.type)) return false;
                if (ailments['HealSeal'] && ['回復','蘇生'].includes(s.type)) return false;
                return true;
            });

            const aliveAllies = Battle.party.filter(p => p && !p.isDead);
            const deadAllies = Battle.party.filter(p => p && p.isDead);
            const aliveEnemies = Battle.enemies.filter(e => !e.isDead && !e.isFled);
            
            // 戦況の判定フラグ
            const lowHPAlly = aliveAllies.find(p => (p.hp / p.baseMaxHp) <= 0.50); // HP50%以下
            const ailedAlly = aliveAllies.find(p => Object.keys(p.battleStatus.ailments).length > 0); // 状態異常中
            const buffedEnemy = aliveEnemies.find(e => Object.keys(e.battleStatus.buffs).length > 0); // 敵にバフあり

            let selectedSkill = null;
            let target = null;

            // 【優先度1: 蘇生】
            if (deadAllies.length > 0) {
                selectedSkill = validSkills.find(s => s.type === '蘇生');
                if (selectedSkill) target = deadAllies[0];
            }

            // 【優先度2: 回復】 (HP50%以下がいる時)
            if (!selectedSkill && lowHPAlly) {
                selectedSkill = validSkills.find(s => s.type.includes('回復'));
                if (selectedSkill) target = lowHPAlly;
            }

            // 【優先度3: 状態異常治療】 (異常者がいる時のみ)
            if (!selectedSkill && ailedAlly) {
                selectedSkill = validSkills.find(s => s.type === '状態異常回復' || s.CureAilments || (s.cures && s.cures.length > 0));
                if (selectedSkill) target = ailedAlly;
            }
			
			// ★追加 【優先度3.5: デバフ（弱体）治療】 
            // 状態異常はないが、能力低下（elmResDown含む）がある味方をチェック
            const debuffedAlly = aliveAllies.find(p => Object.keys(p.battleStatus.debuffs).length > 0);
            if (!selectedSkill && debuffedAlly) {
                selectedSkill = validSkills.find(s => s.debuff_reset === true);
                if (selectedSkill) target = debuffedAlly;
            }

            // 【優先度4: 相手のバフ解除】 (敵にバフがある時のみ)
            if (!selectedSkill && buffedEnemy) {
                selectedSkill = validSkills.find(s => s.buff_reset === true);
                if (selectedSkill) target = buffedEnemy;
            }

            // 【優先度5: 攻撃 / バフ・デバフ】
            if (!selectedSkill) {
                let pool = [];
                // 10%の確率でバフ・デバフを選択肢に入れる
                if (Math.random() < 0.1) {
                    pool = validSkills.filter(s => ['強化', '弱体'].includes(s.type));
                }
                
                // 抽選に漏れた、または補助スキルがない場合は攻撃スキル (回復・蘇生・治療系は完全に除外)
                if (pool.length === 0) {
                    pool = validSkills.filter(s => 
                        ['物理', '魔法', 'ブレス', '特殊'].includes(s.type) && 
                        !s.type.includes('回復') && s.type !== '蘇生' && !s.CureAilments
                    );
                }

                if (pool.length > 0) {
                    // ★敵の数に応じて攻撃範囲を最適化
                    const isSingleEnemy = (aliveEnemies.length === 1);
                    let filteredPool = pool.filter(s => {
                        if (isSingleEnemy) return s.target === '単体' || s.target === 'ランダム';
                        return s.target === '全体' || s.target === 'ランダム';
                    });
                    
                    // 条件に合う範囲がなければプール全体からランダム
                    if (filteredPool.length === 0) filteredPool = pool;
                    selectedSkill = filteredPool[Math.floor(Math.random() * filteredPool.length)];
                }
            }

            // スキル使用を登録
            if (selectedSkill) {
                if (!target) {
                    if (selectedSkill.target === '全体') {
                        target = (['回復', '蘇生', '強化'].includes(selectedSkill.type) || selectedSkill.CureAilments) ? 'all_ally' : 'all_enemy';
                    } else if (selectedSkill.target === 'ランダム') {
                        target = 'random';
                    } else if (selectedSkill.target === '自分') {
                        target = actor;
                    } else {
                        // 単体スキルのデフォルトターゲット
                        target = (['回復', '蘇生', '強化'].includes(selectedSkill.type) || selectedSkill.CureAilments) ? aliveAllies[0] : Battle.getRandomAliveEnemy();
                    }
                }
                return { type: 'skill', actor: actor, target: target, data: selectedSkill, targetScope: selectedSkill.target, isAuto: true };
            }
        }
        
        // オート設定OFF、または出すスキルがない場合は通常攻撃
        const enemyTarget = Battle.getRandomAliveEnemy();
        if (enemyTarget) return { type: 'attack', actor: actor, target: enemyTarget, isAuto: true };
        return { type: 'defend', actor: actor, isAuto: true };
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
        const cmdRoot = Battle.getEl('command-root');
        if(cmdRoot && cmdRoot.children.length >= 5) {
            const btn = cmdRoot.children[4];
            const firstAlive = Battle.party.findIndex(p => p && !p.isDead);
            const newBtn = btn.cloneNode(true);
            if (Battle.currentActorIndex === firstAlive) {
                newBtn.innerText = "にげる";
                newBtn.onclick = Battle.run;
                newBtn.disabled = !!App.data.battle.isBossBattle;
            } else {
                newBtn.innerText = "もどる";
                newBtn.onclick = Battle.goBack;
                newBtn.disabled = false;
            }
            btn.parentNode.replaceChild(newBtn, btn);
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

        if (actualTargetType === 'enemy') targets = Battle.enemies.filter(e => !e.isDead && !e.isFled);
        else if (actualTargetType === 'ally') targets = Battle.party.filter(p => p && !p.isDead);
        else if (actualTargetType === 'ally_dead') targets = Battle.party.filter(p => p && p.isDead);

        if (targets.length === 0) {
            Battle.log("対象がいません");
            setTimeout(Battle.cancelSubMenu, 800);
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
                if (isDisabled) { Battle.log("封印されていて使えない！"); return; }
                // ★修正：マダンテ系(500-505)はMP1以上あれば選択可能、それ以外は消費MPチェック
                const requiredMp = (sk.id >= 500 && sk.id <= 505) ? 1 : sk.mp;
                if (actor.mp < requiredMp) { Battle.log("MPが足りません"); return; }
                
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
                const it = DB.ITEMS.find(i=>i.id==id);
                if(it && (it.type.includes('回復') || it.type.includes('蘇生') || it.type.includes('MP回復') || it.type === '状態異常回復') && App.data.items[id] > 0) { 
                    items.push({def:it, count:App.data.items[id]});
                }
            });
        }

        if (items.length === 0) {
            content.innerHTML = '<div style="padding:10px">使える道具がありません</div>';
            return;
        }

        items.forEach(obj => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `<div>${obj.def.name}</div><div>x${obj.count}</div>`;
            div.onclick = (e) => {
                e.stopPropagation();
                Battle.selectedItemOrSkill = obj.def;
                let tType = 'ally';
                if(obj.def.type === '蘇生') tType = 'ally_dead';
                else if(obj.def.target === '全体') tType = 'all_ally';
                Battle.openTargetWindow(tType, obj.def);
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
            if (s.id >= 500 && s.id <= 505) { if (e.mp <= 0) return false; } // ★500-505を対象に
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
                return (hasDeadAlly && s && s.type === '蘇生') ? w + 30 : w;
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

        // [準備]全員のターン経過フラグと「今ターンの死亡フラグ」をリセット
        [...Battle.party, ...Battle.enemies].forEach(a => { 
            if(a) {
                a.turnProcessed = false;
                a.hasDiedThisTurn = false; 
            }
        });

        // 1. 敵の行動決定
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
        
        // 2. プレイヤーコマンドの整理
        const playerCommands = Battle.commandQueue.filter(c => !c.isEnemy && c.type !== 'skip' && c.type !== 'defend');
        Battle.commandQueue = Battle.commandQueue.filter(c => c.isEnemy || c.type === 'skip' || c.type === 'defend'); 
        
        for(let cmd of playerCommands) {
            const actor = cmd.actor;
            const isDouble = actor.passive && actor.passive.doubleAction && Math.random() < 0.2;
            const isFast = actor.passive && actor.passive.fastestAction && Math.random() < 0.2;
            if (isFast) { cmd.speed = (Battle.getBattleStat(actor, 'spd') * 1.1) + (10 * 100000); Battle.log(`【${actor.name}】は最速で行動する！`); }
            Battle.commandQueue.push(cmd);
            if (isDouble) { let extra = { ...cmd }; extra.speed = cmd.speed - 1; Battle.commandQueue.push(extra); Battle.log(`【${actor.name}】は2回行動する！`); }
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

            // ★修正: ターゲット選定（敵の補助スキルがプレイヤーを狙わないように修正）
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
                            pool = Battle.enemies.filter(e => !e.isDead && !e.isFled);
                        }
                        // 候補がいなければ自分を対象にする
                        cmd.target = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : actor;
                    } else {
                        // 攻撃スキルの場合はプレイヤー側（パーティ陣営）を狙う
                        const aliveParty = Battle.party.filter(p => p && !p.isDead);
                        cmd.target = aliveParty.length > 0 ? aliveParty[Math.floor(Math.random() * aliveParty.length)] : null;
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
                    Battle.log(`【${actor.name}】は 怯えて動けない！`);
                    if (fearWoreOff) Battle.log(`【${actor.name}】の 怯え が解けた！`);
                    await Battle.onActionEnd(actor); // 行動直後のダメージ/リジェネ
                    continue;
                } else if (fearWoreOff) {
                    Battle.log(`【${actor.name}】の 怯え が解けた！`);
                }
            }

            // 敵の逃走
            if (cmd.type === 'flee') {
                Battle.log(`【${cmd.actor.name}】は逃げ出した！`);
                cmd.actor.isFled = true; cmd.actor.hp = 0; Battle.renderEnemies();
                if (Battle.checkFinish()) return; continue;
            }

            // ターゲット再チェック（死んでいる対象を避ける）
            if (cmd.target && typeof cmd.target === 'object' && (cmd.target.isDead || cmd.target.isFled)) {
                if (Battle.enemies.includes(cmd.target)) {
                    cmd.target = Battle.getRandomAliveEnemy();
                } else if (Battle.party.includes(cmd.target) && cmd.data?.type !== '蘇生') {
                    // プレイヤーが死んでいるなら別の生存者を狙う
                    const aliveParty = Battle.party.filter(p => p && !p.isDead);
                    cmd.target = aliveParty.length > 0 ? aliveParty[Math.floor(Math.random() * aliveParty.length)] : null;
                }
            }

            // 行動実行
            await Battle.processAction(cmd);
            
            // 行動直後のダメージ/リジェネ処理
            await Battle.onActionEnd(actor);
			
			// 死亡状態の更新（ここで hasDiedThisTurn フラグが立つ）
            Battle.updateDeadState();

            Battle.updateDeadState(); Battle.renderEnemies(); Battle.renderPartyStatus();
            if (Battle.checkFinish()) return;
            await Battle.wait(500);
        }
        
        // 全行動終了後に一括で持続時間を更新
        await Battle.processEndOfRound();

        // ボス自然回復など
        Battle.enemies.forEach(e => { if (!e.isDead && !e.isFled && e.id >= 1000) e.hp = Math.min(e.baseMaxHp, e.hp + Math.floor(e.baseMaxHp * 0.05)); });
        Battle.saveBattleState(); Battle.startInputPhase();
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
                            if (cat === 'buffs') Battle.log(`【${actor.name}】の ${dispName} アップの効果が切れた！`);
                            if (cat === 'debuffs') Battle.log(`【${actor.name}】の ${dispName} ダウンの効果が切れた！`);
                            if (cat === 'ailments') Battle.log(`【${actor.name}】の ${dispName} が解けた！`);
                            delete b[cat][key];
                        }
                    }
                }
            });

            // [2] パッシブスキルによる「ターン終了時」の回復
            if (actor.hp > 0 && actor.passive && actor.passive.hpRegen) {
                 const rec = Math.floor(actor.baseMaxHp * 0.05);
                 if (rec > 0 && actor.hp < actor.baseMaxHp) {
                     actor.hp = Math.min(actor.baseMaxHp, actor.hp + rec);
                     Battle.log(`【${actor.name}】のHPが ${rec} 自動回復`);
                 }
            }
        }
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
            Battle.log(`【${actor.name}】は ${msgType}のダメージを ${dmg} 受けた！`);
            if (actor.hp <= 0) { 
                actor.hp = 0; actor.isDead = true; 
                Battle.log(`【${actor.name}】は倒れた！`); 
                return;
            }
        }

        // [2] バフによるリジェネ処理 (行動ごとに発生)
        if (b.buffs['HPRegen']) {
            let rec = Math.floor(actor.baseMaxHp * b.buffs['HPRegen'].val);
            if (rec > 0) {
                actor.hp = Math.min(actor.baseMaxHp, actor.hp + rec);
                Battle.log(`【${actor.name}】のHPが ${rec} 回復した！`);
            }
        }
        if (b.buffs['MPRegen']) {
            let rec = Math.floor(actor.baseMaxMp * b.buffs['MPRegen'].val);
            if (rec > 0) {
                actor.mp = Math.min(actor.baseMaxMp, actor.mp + rec);
                Battle.log(`【${actor.name}】のMPが ${rec} 回復した！`);
            }
        }
    },
	
	// ターン経過（持続時間減少）を処理する共通関数
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
                        if (cat === 'buffs') Battle.log(`【${actor.name}】の ${dispName} アップの効果が切れた！`);
                        if (cat === 'debuffs') Battle.log(`【${actor.name}】の ${dispName} ダウンの効果が切れた！`);
                        if (cat === 'ailments') Battle.log(`【${actor.name}】の ${dispName} が解けた！`);
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
            Battle.log(`【${actor.name}】は身を守っている`);
            actor.status = actor.status || {};
            actor.status.defend = true;
            return;
        }
        if (actor.status) actor.status.defend = false;

        // --- [3] アイテムの処理 ---
        if (cmd.type === 'item') {
            const item = data;
            Battle.log(`【${actor.name}】は${item.name}を使った！`);
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
                            Battle.log(`【${t.name}】は生き返った！`); 
                        }
                        else Battle.log(`【${t.name}】には効果がなかった`);
                    } else if (item.type === 'HP回復') {
                        if (!t.isDead) {
                            let rec = item.val; if (item.val >= 9999) rec = t.baseMaxHp;
                            t.hp = Math.min(t.baseMaxHp, t.hp + rec);
                            Battle.log(`【${t.name}】のHPが${rec}回復！`);
                        }
                    } else if (item.type === 'MP回復') {
                        if (!t.isDead) {
                            let rec = item.val; if (item.val >= 9999) rec = t.baseMaxMp;
                            t.mp = Math.min(t.baseMaxMp, t.mp + Math.floor(rec));
                            Battle.log(`【${t.name}】のMPが${rec}回復！`);
                        }
                    } else if (item.type === '状態異常回復' && !t.isDead) {
                        let cured = false;
                        if (item.cures) {
                            item.cures.forEach(ailment => {
                                if (t.battleStatus.ailments[ailment]) {
                                    delete t.battleStatus.ailments[ailment];
                                    const name = Battle.statNames[ailment] || ailment;
                                    Battle.log(`【${t.name}】の ${name} が治った！`);
                                    cured = true;
                                }
                            });
                        }
                        if (item.CureAilments) {
                            if (Object.keys(t.battleStatus.ailments).length > 0) {
                                t.battleStatus.ailments = {};
                                Battle.log(`【${t.name}】の状態異常が 全て治った！`);
                                cured = true;
                            }
                        }
                        if (item.debuff_reset) {
                            if (Object.keys(t.battleStatus.debuffs).length > 0) {
                                t.battleStatus.debuffs = {}; 
                                Battle.log(`【${t.name}】の 能力低下が 元に戻った！`);
                                cured = true;
                            }
                        }
                        if (!cured) Battle.log(`【${t.name}】には効果がなかった`);
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
            if (data.id >= 500 && data.id <= 505) { mpCost = actor.mp; }
            if (actor.mp < mpCost && (data.id < 500 || data.id > 505)) {
                Battle.log(`【${actor.name}】は${skillName}を唱えたがMPが足りない！`);
                return;
            }
            actor.mp -= mpCost;
            Battle.renderPartyStatus();
        }

        Battle.log(`【${actor.name}】の${skillName}！`);
        let successRate = rawSuccessRate;
        if (successRate <= 1 && successRate > 0) successRate *= 100;

        if (data && data.id >= 500 && data.id <= 505) {
            let baseBaseDmg = mpCost * skillRate;
            const pool = cmd.isEnemy ? Battle.party.filter(p=>p && !p.isDead) : Battle.enemies.filter(e=>!e.isDead && !e.isFled);
            let loopTargets = [];
            if (cmd.targetScope === 'ランダム') {
                if (pool.length > 0) loopTargets = [pool[0]];
            } else if (cmd.targetScope === '単体' && cmd.target) {
                if (!cmd.target.isDead) loopTargets = [cmd.target];
            } else {
                loopTargets = pool;
            }
            for (let t of loopTargets) {
                if (!t) continue;
                for (let i = 0; i < hitCount; i++) {
                    let targetToHit = (cmd.targetScope === 'ランダム') ? pool[Math.floor(Math.random() * pool.length)] : t;
                    if (!targetToHit || targetToHit.isDead) continue;
                    let bonusRate = 0, cutRate = 0, isImmune = false; 
                    if (element) {
                        const elmAtkVal = (Battle.getBattleStat(actor, 'elmAtk') || {})[element] || 0;
                        bonusRate += elmAtkVal;
                        const baseRes = (targetToHit.getStat('elmRes') || {})[element] || 0;
                        const buffRes = (targetToHit.battleStatus.buffs['elmResUp'] || {}).val || 0;
                        const debuffRes = (targetToHit.battleStatus.debuffs['elmResDown'] || {}).val || 0;
                        let resVal = baseRes + buffRes - debuffRes;
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
                    if (!cmd.isEnemy && dmg > (App.data.stats.maxDamage?.val || 0)) {
                        App.data.stats.maxDamage = { val: dmg, actor: actor.name, skill: data ? data.name : "通常攻撃" };
                    }
                    let dmgColor = '#fff';
                    if(element === '火') dmgColor = '#f88'; else if(element === '水') dmgColor = '#88f'; else if(element === '雷') dmgColor = '#ff0';
                    else if(element === '風') dmgColor = '#8f8'; else if(element === '光') dmgColor = '#ffc'; else if(element === '闇') dmgColor = '#a8f'; else if(element === '混沌') dmgColor = '#d4d';
                    if (dmg === 0) Battle.log(`ミス！ 【${targetToHit.name}】は ダメージを うけない！`);
                    else Battle.log(`【${targetToHit.name}】に<span style="color:${dmgColor}">${dmg}</span>のダメージ！`);
                    if (targetToHit.hp <= 0) { targetToHit.hp = 0; targetToHit.isDead = true; Battle.log(`【${targetToHit.name}】は倒れた！`); }
                    Battle.renderEnemies(); Battle.renderPartyStatus();
                    if (hitCount > 1) await Battle.wait(150);
                }
            }
            await Battle.wait(500);
            return;
        }

        // --- [6] ターゲット特定（一般スキル） ---
        let targets = [];
        let skillScope = cmd.targetScope;
        if (!skillScope && cmd.target === 'all_enemy') skillScope = '全体';
        if (!skillScope && cmd.target === 'all_ally') skillScope = '全体';
        if (!skillScope && cmd.target === 'random') skillScope = 'ランダム';
        
        // ヘルパー関数の定義
        const isSupportSkill = (d) => {
            if (!d) return false;
            const type = d.type || '';
            if (['回復','蘇生','強化','MP回復'].includes(type)) return true;
            if (d.debuff_reset || d.CureAilments || d.HPRegen || d.MPRegen) return true;
            return false;
        };
        const isSupport = isSupportSkill(data);

        if (skillScope === '全体') {
             if (cmd.isEnemy) {
                 targets = isSupport ? Battle.enemies.filter(e => !e.isFled) : Battle.party.filter(p => p && !p.isDead);
             } else {
                 targets = isSupport ? Battle.party.filter(p => p) : Battle.enemies.filter(e => !e.isDead && !e.isFled);
             }
        } else if (skillScope === 'ランダム') {
             let pool = cmd.isEnemy ? (isSupport ? Battle.enemies.filter(e => !e.isDead && !e.isFled) : Battle.party.filter(p => p && !p.isDead)) : (isSupport ? Battle.party.filter(p => p && !p.isDead) : Battle.enemies.filter(e => !e.isDead && !e.isFled));
             if(pool.length > 0) targets = [pool[Math.floor(Math.random() * pool.length)]];
        } else {
            targets = [cmd.target];
        }

        // --- [7] 内部関数：効果適用ロジック ---
        const applyEffects = (t, d) => {
            const checkProc = (val) => {
                let rate = successRate;
                if (typeof val === 'number') rate = val;
                return Math.random() * 100 < rate;
            };
            const checkResist = (type) => {
                if (type === 'Debuff' && successRate >= 200) return false;
                const resistKey = Battle.RESIST_MAP[type] || type;
                const resistVal = (Battle.getBattleStat(t, 'resists') || {})[resistKey] || 0;
                if (Math.random() * 100 < resistVal) return true;
                return false;
            };
            if (d.buff) {
                let resistCount = 0; let lastResistName = "";
                for (let key in d.buff) {
                    const turn = d.turn || null; 
                    if (key === 'elmResUp') {
                        t.battleStatus.buffs[key] = { val: d.buff[key], turns: turn };
                        Battle.log(`【${t.name}】の 全属性耐性 が あがった！`);
                    } else if (key.startsWith('resists_')) {
                        t.battleStatus.buffs[key] = { val: d.buff[key], turns: turn };
                        resistCount++; lastResistName = Battle.statNames[key.replace('resists_', '')] || key.replace('resists_', '');
                    } else {
                        let cur = (t.battleStatus.buffs[key] && t.battleStatus.buffs[key].val) || 1.0;
                        t.battleStatus.buffs[key] = { val: Math.min(2.5, cur * d.buff[key]), turns: turn };
                        Battle.log(`【${t.name}】の ${Battle.statNames[key]||key} があがった！`);
                    }
                }
                if (resistCount > 0) {
                    if (resistCount === 1) Battle.log(`【${t.name}】の ${lastResistName}耐性 があがった！`);
                    else Battle.log(`【${t.name}】の 状態異常耐性 があがった！`);
                }
            }
            if (d.HPRegen) { t.battleStatus.buffs['HPRegen'] = { val: d.HPRegen, turns: d.turn }; Battle.log(`【${t.name}】の HPが徐々に回復する！`); }
            if (d.MPRegen) { t.battleStatus.buffs['MPRegen'] = { val: d.MPRegen, turns: d.turn }; Battle.log(`【${t.name}】の MPが徐々に回復する！`); }
            if (d.CureAilments) { t.battleStatus.ailments = {}; Battle.log(`【${t.name}】の 状態異常が 全て治った！`); }
            if (d.debuff_reset) { t.battleStatus.debuffs = {}; Battle.log(`【${t.name}】の 能力低下が 元に戻った！`); }
            if (d.debuff) {
                if (!checkResist('Debuff')) {
                    let rDownCount = 0; let lastRName = "";
                    for (let key in d.debuff) {
                        const turn = d.turn || null;
                        if (key === 'elmResDown') {
                            t.battleStatus.debuffs[key] = { val: d.debuff[key], turns: turn };
                            Battle.log(`【${t.name}】の 全属性耐性 が さがった！`);
                        } else if (key.startsWith('resists_')) {
                            t.battleStatus.debuffs[key] = { val: d.debuff[key], turns: turn };
                            rDownCount++; lastRName = Battle.statNames[key.replace('resists_', '')] || key.replace('resists_', '');
                        } else {
                            let cur = (t.battleStatus.debuffs[key] && t.battleStatus.debuffs[key].val) || 1.0;
                            t.battleStatus.debuffs[key] = { val: Math.max(0.1, cur * d.debuff[key]), turns: turn };
                            Battle.log(`【${t.name}】の ${Battle.statNames[key]||key} がさがった！`);
                        }
                    }
                    if (rDownCount > 0) {
                        if (rDownCount === 1) Battle.log(`【${t.name}】の ${lastRName}耐性 がさがった！`);
                        else Battle.log(`【${t.name}】の 状態異常耐性 がさがった！`);
                    }
                } else Battle.log(`【${t.name}】には きかなかった！`);
            }
            if (d.buff_reset) { t.battleStatus.buffs = {}; Battle.log(`【${t.name}】の良い効果がかき消された！`); }
            const addA = (k, msg, chance=null) => {
                if (!t.battleStatus.ailments[k]) {
                    if (checkResist(k)) { Battle.log(`【${t.name}】には ${Battle.statNames[k]||k} は きかなかった！`); return; }
                    t.battleStatus.ailments[k] = { turns: d.turn, chance: chance }; Battle.log(msg);
                }
            };
            if (d.Poison && checkProc(d.Poison)) addA('Poison', `【${t.name}】は どくにおかされた！`);
            if (d.ToxicPoison && checkProc(d.ToxicPoison)) addA('ToxicPoison', `【${t.name}】は もうどくにおかされた！`);
            if (d.Shock && checkProc(d.Shock)) addA('Shock', `【${t.name}】は 感電してしまった！`);
            if (d.Fear && checkProc(d.Fear)) addA('Fear', `【${t.name}】は 怯えてしまった！`, 0.5);
            if (d.SpellSeal && checkProc(d.SpellSeal)) addA('SpellSeal', `【${t.name}】の 呪文が封じられた！`);
            if (d.SkillSeal && checkProc(d.SkillSeal)) addA('SkillSeal', `【${t.name}】の 特技が封じられた！`);
            if (d.HealSeal && checkProc(d.HealSeal)) addA('HealSeal', `【${t.name}】の 回復が封じられた！`);
            if (d.PercentDamage) {
                if (checkProc() && !checkResist('PercentDamage')) {
                    let pdmg = Math.max(1, Math.floor(t.hp * d.PercentDamage));
                    t.hp -= pdmg; Battle.log(`【${t.name}】に ${pdmg} のダメージ！`);
                    if (t.hp <= 0) { t.hp = 0; t.isDead = true; Battle.log(`【${t.name}】は倒れた！`); }
                } else Battle.log(`【${t.name}】にはきかなかった！`);
            }
        };

        // --- [8] メイン実行ループ ---
        for (let t of targets) {
            if (!t) continue;
            if (effectType && ['回復','蘇生','強化','弱体','特殊','MP回復'].includes(effectType)) {
                if (successRate < 100 && Math.random() * 100 > successRate) {
                    Battle.log(`ミス！ 【${t.name}】には効かなかった！`);
                    continue;
                }
                if (effectType === '蘇生') {
                    if (t.isDead) { 
                        t.isDead = false; 
                        t.hp = Math.max(1, Math.floor(t.baseMaxHp * (skillRate !== undefined ? skillRate : 0.5)));
                        Battle.log(`【${t.name}】は生き返った！`); 
                    } else { Battle.log(`【${t.name}】には効果がなかった`); continue; }
                }
                if (effectType === '回復' && !t.isDead) {
                    let rec;
                    if (data.ratio) {
                        rec = Math.floor(t.baseMaxHp * data.ratio);
                    } else {
                        const baseValue = data.fix ? baseDmg : (Battle.getBattleStat(actor, 'mag') * skillRate + baseDmg);
                        rec = baseValue * (0.85 + Math.random() * 0.3);
                    }
                    t.hp = Math.min(t.baseMaxHp, t.hp + Math.floor(rec));
                    Battle.log(`【${t.name}】のHPが${Math.floor(rec)}回復！`);
                }
                if (effectType === 'MP回復' && !t.isDead) {
                    let rec = data.ratio ? Math.floor(t.baseMaxMp * data.ratio) : baseDmg;
                    t.mp = Math.min(t.baseMaxMp, t.mp + Math.floor(rec));
                    Battle.log(`【${t.name}】のMPが${Math.floor(rec)}回復！`);
                }
                if (!t.isDead) applyEffects(t, data);
                Battle.renderPartyStatus(); 
                continue;
            }

            for (let i = 0; i < hitCount; i++) {
                let targetToHit = t;
                if (skillScope === 'ランダム') {
                    const pool = cmd.isEnemy ? Battle.party.filter(p => p && !p.isDead) : Battle.enemies.filter(e => !e.isDead && !e.isFled);
                    if (pool.length === 0) break;
                    targetToHit = pool[Math.floor(Math.random() * pool.length)];
                }
                if (targetToHit.isDead || targetToHit.isFled) { if (skillScope !== 'ランダム') break; continue; }
                if (isPhysical && Math.random() * 100 > successRate) {
                    Battle.log(`ミス！ 【${targetToHit.name}】に攻撃が当たらない！`);
                    await Battle.wait(200); continue; 
                }
                let atkVal = 0, defVal = 0, ignoreDefense = false;
                if (data && data.IgnoreDefense) ignoreDefense = true;
                if (cmd.type === 'skill' && actor.passive?.atkIgnoreDef && Math.random() < 0.2) ignoreDefense = true;
                if (isPhysical && actor.passive?.pierce && Math.random() < 0.2) ignoreDefense = true;
                if (isPhysical) {
                    atkVal = Battle.getBattleStat(actor, 'atk'); defVal = Battle.getBattleStat(targetToHit, 'def');
                    if (ignoreDefense) Battle.log(`かいしんの一撃！`);
                } else { 
                    atkVal = Battle.getBattleStat(actor, 'mag'); defVal = Battle.getBattleStat(targetToHit, 'mag'); 
                }
                let baseDmgCalc = 0;
                if (data && data.fix) {
                    baseDmgCalc = baseDmg;
                } else if (effectType === 'ブレス') {
                    const atk = Battle.getBattleStat(actor, 'atk');
                    const mag = Battle.getBattleStat(actor, 'mag');
                    baseDmgCalc = Math.floor(((atk + mag) / 6 + baseDmg));
                } else if (isPhysical) {
                    baseDmgCalc = Math.floor(((atkVal / 2) + baseDmg) - (ignoreDefense ? 0 : defVal / 4));
                } else {
                    baseDmgCalc = Math.floor(((atkVal / 2) + baseDmg) - (defVal / 4));
                }
                if (baseDmgCalc < 1) baseDmgCalc = (Math.random() < 0.3) ? 1 : 0;
                let totalMult = skillRate;
                if (!isPhysical && cmd.type === 'skill' && actor.passive?.magCrit && Math.random() < 0.2) { totalMult *= 2.0; Battle.log(`魔力が暴走する！`); }
                let bonusRate = 0, cutRate = 0, isImmune = false;
                if (element) {
                    const eAtk = (Battle.getBattleStat(actor, 'elmAtk') || {})[element] || 0;
                    if(eAtk > 0) bonusRate += eAtk;
                    const eRes = (targetToHit.getStat('elmRes') || {})[element] || 0;
                    const bRes = (targetToHit.battleStatus.buffs['elmResUp']?.val || 0) - (targetToHit.battleStatus.debuffs['elmResDown']?.val || 0);
                    if (eRes + bRes >= 100) isImmune = true; else cutRate += (eRes + bRes);
                }
                const finDmgVal = Battle.getBattleStat(actor, 'finDmg') || 0; bonusRate += finDmgVal;
                let finRed = Battle.getBattleStat(targetToHit, 'finRed') || 0;
                if (targetToHit.passive && targetToHit.passive.finRed10) finRed += 10;
                if (finRed > 80) finRed = 80; cutRate += finRed;
                let dmg = baseDmgCalc;
                if (dmg > 0) {
                    dmg = dmg * totalMult * (1.0 + bonusRate / 100) * (1.0 - cutRate / 100) * (0.85 + Math.random() * 0.3);
                    if (targetToHit.status?.defend) dmg *= 0.5;
                    dmg = Math.floor(dmg);
                    if (!isImmune && dmg < 1) dmg = 1;
                }
                if (isImmune) dmg = 0;
                targetToHit.hp -= dmg;
                if (!cmd.isEnemy && dmg > (App.data.stats.maxDamage?.val || 0)) App.data.stats.maxDamage = { val: dmg, actor: actor.name, skill: data ? data.name : "通常攻撃" };
                let dColor = '#fff';
                const eColors = { 火: '#f88', 水: '#88f', 雷: '#ff0', 風: '#8f8', 光: '#ffc', 闇: '#a8f', 混沌: '#d4d' };
                if (element && eColors[element]) dColor = eColors[element];
                if (dmg === 0) Battle.log(`ミス！ 【${targetToHit.name}】は ダメージを うけない！`);
                else Battle.log(`【${targetToHit.name}】に<span style="color:${dColor}">${dmg}</span>のダメージ！`);
                if (dmg > 0) {
                    let dRate = (data && data.drain) ? 0.5 : (actor.passive?.drain ? 0.2 : 0);
                    if (dRate > 0) {
                        const dAmt = Math.floor(dmg * dRate);
                        const oldHp = actor.hp; actor.hp = Math.min(actor.baseMaxHp, actor.hp + dAmt);
                        if(actor.hp - oldHp > 0) Battle.log(`【${actor.name}】は吸収効果でHPを${actor.hp - oldHp}回復した！`);
                    }
                    if (actor.passive?.drainMp) {
                        const mpAmt = Math.max(1, Math.floor(dmg * 0.01));
                        actor.mp = Math.min(actor.baseMaxMp, actor.mp + mpAmt);
                    }
                }
                if (dmg > 0 && isPhysical) {
                    const tryS = (key, name, ailmentKey) => {
                        const ch = (actor.getStat(key) || 0);
                        if (ch > 0 && Math.random() * 100 < ch) {
                            const resK = Battle.RESIST_MAP[ailmentKey] || ailmentKey;
                            const resV = (Battle.getBattleStat(targetToHit, 'resists') || {})[resK] || 0;
                            if (Math.random() * 100 >= resV && !targetToHit.battleStatus.ailments[ailmentKey]) {
                                targetToHit.battleStatus.ailments[ailmentKey] = { turns: 3, chance: (ailmentKey==='Fear'?0.5:null) };
                                Battle.log(`【${targetToHit.name}】は ${name}！`);
                            }
                        }
                    };
                    tryS('attack_Poison', '毒におかされた', 'Poison');
                    tryS('attack_Fear', '怯えてしまった', 'Fear');
                    const dc = (actor.getStat('attack_InstantDeath') || 0);
                    if (dc > 0 && Math.random() * 100 < dc) {
                        const rv = (Battle.getBattleStat(targetToHit, 'resists') || {}).InstantDeath || 0;
                        if (Math.random() * 100 >= rv) {
                            targetToHit.hp = 0; targetToHit.isDead = true;
                            Battle.log(`<span style="color:#ff00ff; font-weight:bold;">急所を貫いた！ 【${targetToHit.name}】は 息絶えた！</span>`);
                        } 
                    }
                }
				
				// ★攻撃側のシナジーによる追加判定：複数をループで処理するように修正
				if (actor instanceof Player) {
					Object.values(actor.equips).forEach(eq => {
						if (eq && eq.isSynergy && eq.effects) {
                            // 保持している全てのシナジー効果を順番に判定
                            eq.effects.forEach(effect => {
                                if (Math.random() < 0.2) {
                                    // 四源の浸食: 全属性耐性ダウン
                                    if (effect === 'allResDown20' && !t.isDead) {
                                        t.battleStatus.debuffs['elmResDown'] = { val: 50, turns: 5 };
                                        Battle.log(`【${t.name}】の 全属性耐性が 少しさがった！`);
                                    }
                                    // 終焉の宣告: 即死
                                    if (effect === 'instantDeath20' && !t.isDead) {
                                        const res = (t.resists && t.resists.InstantDeath) || 0;
                                        if (Math.random() * 100 > res) {
                                            t.hp = 0; t.isDead = true;
                                            Battle.log(`<span style="color:#ff00ff; font-weight:bold;">急所を貫いた！ 【${targetToHit.name}】は 息絶えた！</span>`);
                                        }
                                    }
                                }
                            });
						}
					});
				}

                if (cmd.type === 'skill') applyEffects(targetToHit, data);

                if (targetToHit.hp <= 0) {
                    targetToHit.hp = 0; targetToHit.isDead = true; Battle.log(`【${targetToHit.name}】は倒れた！`);
                    Battle.renderEnemies(); Battle.renderPartyStatus();
                    if (skillScope !== 'ランダム') break;
                }
                Battle.renderEnemies(); Battle.renderPartyStatus();
                if (hitCount > 1) await Battle.wait(150);
            }
            await Battle.wait(100);
        }
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
        if (Battle.enemies.every(e => e.isDead || e.isFled)) { setTimeout(Battle.win, 800); return true; }
        if (Battle.party.every(p => p.isDead)) { setTimeout(Battle.lose, 800); return true; }
        return false;
    },
    getRandomAliveEnemy: () => {
        const alive = Battle.enemies.filter(e => !e.isDead && !e.isFled);
        if (alive.length === 0) return null;
        return alive[Math.floor(Math.random() * alive.length)];
    },
	saveBattleState: () => {
        // 現在のフラグを退避
        const isBoss = App.data.battle.isBossBattle;
        const isEstark = App.data.battle.isEstark;

        App.data.battle.enemies = Battle.enemies.filter(e => !e.isFled).map(e => ({ 
            baseId: e.id, hp: e.hp, maxHp: e.baseMaxHp, name: e.name, battleStatus: e.battleStatus 
        }));

        // フラグを再セット
        App.data.battle.isBossBattle = isBoss;
        App.data.battle.isEstark = isEstark;

        Battle.party.forEach(p => {
            const d = App.getChar(p.uid);
            if(d) { d.currentHp = p.hp; d.currentMp = p.mp; d.battleStatus = p.battleStatus; }
        });
        App.save();
    },

	renderEnemies: () => {
		const container = Battle.getEl('enemy-container');
		if(!container) return;
		container.innerHTML = ''; // 以前の描画をクリア
		const g = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};
		
		// 【判定準備】敵の総数とボスバトルフラグを取得
		const totalCount = Battle.enemies.length;
		const isBoss = App.data.battle ? App.data.battle.isBossBattle : false;

		// 【特殊判定】ID 2000（エスターク）が戦場に一人でもいるかチェック
		const hasEstark = Battle.enemies.some(enemy => enemy.id === 2000);

		// デフォルトのレイアウト変数（ここを以下のif文で上書きしていく）
		let widthPerEnemy = 20; 
		let scaleFactor = 1.0; 
		let maxPixelWidth = 100;
		let paddingBottomVal = "10px"; 
		let marginTopVal = "10px";

		/* --- レイアウト決定の優先順位ロジック --- */

		// 1位：エスタークがいる場合（最優先・巨大表示）
		if (hasEstark) {
			widthPerEnemy = 65;   // 1体あたりの占有幅を大きく
			maxPixelWidth = 450;  // 画像自体の最大サイズを大幅に引き上げ
			paddingBottomVal = "15px";
			marginTopVal = "-50px"; // 巨大なので少し上にずらしてメッセージ欄との重なりを回避
			scaleFactor = 1.2;    // 全体スケールも拡大
		} 
		// 2位：ボスが1体だけの場合
		else if (isBoss && totalCount === 1) {
			widthPerEnemy = 40;  
			scaleFactor = 1.0;   
			maxPixelWidth = 200;  // 通常のボスサイズ
			paddingBottomVal = "5px";
			marginTopVal = "-10px";
		} 
		// 3位：ボスが4体並ぶ場合（少し縮小して詰め込む）
		else if (isBoss && totalCount === 4) { 
			widthPerEnemy = 22;
			scaleFactor = 0.8;    // 4体だと窮屈なので少し小さく
			paddingBottomVal = "0px";
		}
		// 4位：ボスが3体の場合
		else if (isBoss && totalCount === 3) { 
			widthPerEnemy = 33;
			scaleFactor = 1.0; 
			maxPixelWidth = 170;  // 通常のボスサイズ
			paddingBottomVal = "5px";
			marginTopVal = "-10px";
		}
		// 5位：ボスが2体の場合
		else if (isBoss && totalCount === 2) { 
			widthPerEnemy = 37;
			scaleFactor = 1.0; 
			maxPixelWidth = 200;  // 通常のボスサイズ
			paddingBottomVal = "5px";
			marginTopVal = "-10px";
		}
		// 6位：通常の雑魚敵（4体以上）の場合
		else if (totalCount >= 4) { 
			widthPerEnemy = 22;
			scaleFactor = 0.8; 
		}
		// 例外：敵がいない（または全滅直後）などのデフォルト
		else { 
			widthPerEnemy = 30;
			scaleFactor = 1.0; 
		}

        // 実際の描画ループ
        Battle.enemies.forEach(e => {
            const div = document.createElement('div');
            div.className = `enemy-sprite`;
            
            div.style.cssText = `
                position: relative; 
                width: ${widthPerEnemy}%; 
                max-width: ${maxPixelWidth}px;
                margin: 0 1% -0px 1%;
                overflow: visible;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                align-items: center;
                padding-bottom: ${paddingBottomVal};
            `;

            // 死んでいる、または逃げた場合は表示を隠す
            if (e.isFled || e.hp <= 0) {
                div.style.visibility = 'hidden';
                container.appendChild(div);
                return;
            }
            
            let baseName = e.name.replace(/^(強・|真・|極・|神・)+/, '').replace(/ Lv\d+[A-Z]?$/, '').replace(/[A-Z]$/, '').trim();
            const imgKey = 'monster_' + baseName;
            const hasImage = g[imgKey] ? true : false;
            let imgHtml = '';
            
            if (hasImage) {
                div.style.border = 'none'; div.style.background = 'transparent';
                imgHtml = `<img src="${g[imgKey].src}" style="
                    width: 100%; 
                    aspect-ratio: 1/1; 
                    object-fit: contain; 
                    object-position: center bottom;
                    filter: drop-shadow(0 4px 4px rgba(0,0,0,0.5)); 
                    display: block;
                    transform: translateY(10px);
                ">`;
            } else {
                div.style.background = 'transparent';
                const dummyFontSize = (isBoss && totalCount === 1) ? '20px' : '10px';
                imgHtml = `<div style="width:100%; aspect-ratio:1/1; background:#444; border-radius:8px; border:2px solid #fff; display:flex; align-items:center; justify-content:center; color:#fff; font-size:${dummyFontSize};">${e.name.substring(0,2)}</div>`;
            }
            
            const hpPer = (e.hp / e.baseMaxHp) * 100;
            const hpRatio = e.hp / e.baseMaxHp;
            const nameColor = hpRatio < 0.5 ? '#ff4' : '#fff';
            
            div.innerHTML = `
                ${imgHtml}
                <div style="
                    width: 140%;
                    margin-top: ${marginTopVal};
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    z-index: 10; 
                    pointer-events: none; 
                    transform: scale(${scaleFactor}); 
                    transform-origin: top center;
                    text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;">
                    <div style="font-size: 10px; color: ${nameColor}; font-weight:bold; white-space: nowrap; margin-bottom: 2px;">${e.name}</div>
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
            const hpPer = (p.baseMaxHp > 0) ? (p.hp / p.baseMaxHp) * 100 : 0; const mpPer = (p.baseMaxMp > 0) ? (p.mp / p.baseMaxMp) * 100 : 0;
            const isActor = (Battle.phase === 'input' && index === Battle.currentActorIndex);
            if(isActor) { div.style.border = "2px solid #ffd700"; div.style.background = "#333"; }
            let nameStyle = p.isDead ? 'color:red; text-decoration:line-through;' : 'color:white;';
			
			// ★修正箇所: マスタデータから画像を取得して統合
            const master = DB.CHARACTERS.find(m => m.id === p.charId);
            const imgUrl = p.img || (master ? master.img : null);
            const imgHtml = imgUrl ? `<img src="${imgUrl}" style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #666; margin-bottom:1px;">` : `<div style="width:32px; height:32px; background:#222; border-radius:4px; border:1px solid #444; display:flex; align-items:center; justify-content:center; color:#555; font-size:8px; margin-bottom:1px;">IMG</div>`;
            
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
		
		// ★修正箇所: マスタデータから画像を取得
        const master = DB.CHARACTERS.find(m => m.id === char.charId);
        const imgUrl = char.img || (master ? master.img : null);

        // ★修正箇所: char.img ではなく imgUrl を使用
        let html = `
            <div style="display:flex; align-items:center; margin-bottom:10px;">
                <div style="width:48px; height:48px; border:1px solid #555; margin-right:10px; border-radius:4px; overflow:hidden; display:flex; justify-content:center; align-items:center; background:#333;">
                    ${imgUrl ? `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:10px; color:#888;">IMG</span>'}
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
	
	// --- 勝利処理：順序 [1]勝利ログ -> [2]経験値/LvUp -> [3]ドロップ判定&表示 ---
    win: async () => {
        Battle.phase = 'result'; Battle.active = false;
        const isEstark = App.data.battle && App.data.battle.isEstark;
        const isBossBattle = App.data.battle && App.data.battle.isBossBattle;
        const floor = App.data.progress.floor || 1;

        let totalExp = 0, totalGold = 0;
        const drops = []; 
        let hasRareDrop = false;      // 白フラッシュ用
        let hasUltraRareDrop = false; // 赤黒フラッシュ用

        // [1] 勝利宣言ログ
        Battle.log(`\n<span style="color:#ffff00; font-size:1em; font-weight:bold;">戦闘に勝利した！</span>`);

        // データ集計（討伐数・図鑑）
        Battle.enemies.forEach(e => {
            if (e.isDead && !e.isFled) {
                const id = e.baseId || e.id;
                if (id) {
                    if (!App.data.book.killCounts) App.data.book.killCounts = {};
                    App.data.book.killCounts[id] = (App.data.book.killCounts[id] || 0) + 1;
                    if (!App.data.book.monsters.includes(id)) App.data.book.monsters.push(id);
                }
                const base = DB.MONSTERS.find(m => m.id === id);
                if(base) { totalExp += base.exp; totalGold += base.gold; }
            }
        });

        // [2] 資源獲得・レベルアップ処理
        App.data.gold += totalGold;
        Battle.log(` ${totalGold} Goldを獲得！`);
        Battle.log(` ${totalExp}ポイントの経験値を 獲得した！`);

        const surviveMembers = Battle.party.filter(p => !p.isDead);
        surviveMembers.forEach(p => {
            const charData = App.getChar(p.uid);
            if (charData) {
                const oldLv = charData.level; // レベルアップ判定用
                App.gainExp(charData, totalExp).forEach(msg => Battle.log(msg));
                
                // レベルアップした場合のみ、最大ステータスを更新して全快させる
                if (charData.level > oldLv) {
                    const stats = App.calcStats(charData);
                    p.level = charData.level;
                    p.baseMaxHp = stats.maxHp;
                    p.baseMaxMp = stats.maxMp;
                    p.hp = p.baseMaxHp; // レベルアップ特典で全快
                    p.mp = p.baseMaxMp;
                }
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

        // --- ドロップ生成判定 ---
        if (isEstark) {
            const estarkEnemy = Battle.enemies.find(e => e.isEstark || e.id === 2000 || e.baseId === 2000);
            if (!estarkEnemy) {
                console.error("Estark object not found in win logic");
                return; 
            }

            const estarkId = estarkEnemy.baseId || estarkEnemy.id || 2000;
            const killCount = (App.data.book.killCounts && App.data.book.killCounts[estarkId]) 
                              ? App.data.book.killCounts[estarkId] : 1;

            const baseRank = estarkEnemy.rank || 300; 
            const rewardFloor = baseRank + (killCount * 5);

            const eq = createEquipWithMinRarity(rewardFloor, 3, ['UR', 'EX']);
            eq.val *= 3;
            eq.name = "【EX】" + eq.name;
            
            App.data.gems = (App.data.gems || 0) + 100000;
            App.data.inventory.push(eq);
            
            drops.push({ name: eq.name, isRare: true, isUltra: true, isEstark: true });
            hasUltraRareDrop = true; 

            // ★追加: エスターク討伐時 10% の確率で「転生の実」をゲット (ウルトラレア扱い)
            if (Math.random() < 0.10) {
                const fruitId = 107;
                App.data.items[fruitId] = (App.data.items[fruitId] || 0) + 1;
                const itemDef = DB.ITEMS.find(i => i.id === fruitId);
                if (itemDef) {
                    hasUltraRareDrop = true;
                    // type: 'kai' を指定することでログをピンク色にする
                    drops.push({ name: itemDef.name, isRare: true, type: 'kai' });
                }
            }

        } else {
            Battle.enemies.forEach(e => {
                if (e.isFled) return;
                const base = DB.MONSTERS.find(m => m.id === e.baseId);
                if (!base) return;

                if (base.id >= 1000) {
                    // --- ボスドロップ判定 ---
                    let eq;
                    if (Math.random() < 0.02) { 
                        eq = createEquipWithMinRarity(floor, 3, ['SSR', 'UR', 'EX'], '武器');
                        eq.name = eq.name.replace(/\+3$/, "") + "・改+3";
                        for (let key in eq.data) {
                            if (typeof eq.data[key] === 'number') eq.data[key] *= 2;
                            else if (typeof eq.data[key] === 'object' && eq.data[key] !== null) {
                                for (let sub in eq.data[key]) eq.data[key][sub] *= 2;
                            }
                        }
                        eq.val *= 4;
                        App.data.inventory.push(eq);
                        hasUltraRareDrop = true;
                        drops.push({ name: eq.name, isRare: true, type: 'kai' });
                    } else {
                        eq = App.createEquipByFloor('drop', floor, 3);
                        App.data.inventory.push(eq);
                        hasRareDrop = true;
                        drops.push({ name: eq.name, isRare: true, type: 'boss' });
                    }
                } else {
                    // --- 通常モンスタードロップ判定 ---
                    const r = Math.random();
                    
                    // 100階以降の育成アイテム（種・実）ドロップ判定
                    if (floor >= 100) {
                        const sr = Math.random();
                        let sid = null;
                        
                        // ★修正：レア敵(isRare)の場合は転生の実や種・きのみのドロップ率を増加
                        let probFruit = base.isRare ? 0.05 : 0.001; // 転生の実: 0.1% → 5%
                        let probSkill = base.isRare ? 0.15 : 0.011; // スキルのたね: 1.0% → 10% (累積しきい値)
                        let probSeeds = base.isRare ? 0.45 : 0.181; // 各種種: 17% → 30% (累積しきい値)

                        if (sr < probFruit) {
                            sid = 107;      // 転生の実
                        } else if (sr < probSkill) {
                            sid = 106;      // スキルのたね
                        } else if (sr < probSeeds) {
                            sid = 100 + Math.floor(Math.random() * 6); // 各種 種・きのみ
                        }

                        if (sid) {
                            App.data.items[sid] = (App.data.items[sid] || 0) + 1;
                            const itemDef = DB.ITEMS.find(i => i.id === sid);
                            if (itemDef) {
                                if (sid === 107) {
                                    // 転生の実：ウルトラレア扱い (赤黒フラッシュ + ピンク文字)
                                    hasUltraRareDrop = true;
                                    drops.push({ name: itemDef.name, isRare: true, type: 'kai' });
                                } else {
                                    // スキルのたね(106)および通常の種(100-105)：ノーマル扱い
                                    drops.push({ name: itemDef.name, isRare: false, type: 'item' });
                                }
                            }
                        }
                    }
                    
                    // 通常アイテム/装備判定
                    if (r < 0.2) {
                        const candidates = DB.ITEMS.filter(i => i.rank <= Math.min(200, floor) && i.type !== '貴重品' && i.id < 100);
                        if (candidates.length > 0) {
                            const item = candidates[Math.floor(Math.random() * candidates.length)];
                            App.data.items[item.id] = (App.data.items[item.id] || 0) + 1;
                            drops.push({ name: item.name, isRare: false, type: 'item' });
                        }
                    } else if (r < 0.35) {
                        const eq = App.createEquipByFloor('drop', floor);
                        App.data.inventory.push(eq);
                        const isPlus3 = (eq.plus === 3);
                        if(isPlus3) hasRareDrop = true;
                        drops.push({ name: eq.name, isRare: isPlus3, type: 'normal' });
                    }
                }
            });
        }

        // [3] ドロップありならウェイト ＆ 改行
        if (drops.length > 0) {
            App.save();
            Battle.log("<br>");
            await Battle.wait(800);
            
            // [4] 演出実行（優先順位：ウルトラ ＞ レア）
            if (hasUltraRareDrop || hasRareDrop) {
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

            // ドロップ内容のログ表示
            drops.forEach(d => {
                if (d.isEstark) {
                    Battle.log(`<span style="color:#ffd700; font-weight:bold;">100,000 GEM</span> を獲得！`);
                    Battle.log(`なんと <span style="color:#ffd700; font-weight:bold;">${d.name}</span> を手に入れた！`);
                } else if (d.type === 'kai') {
                    // 転生の実や「改」装備はここでピンク色に強調
                    Battle.log(`なんと <span style="color:#ff00ff; font-weight:bold;">${d.name}</span> を手に入れた！`);
                } else if (d.isRare) {
                    Battle.log(`なんと <span class="log-rare-drop">${d.name}</span> を手に入れた！`);
                } else {
                    Battle.log(`${d.name} を手に入れた！`);
                }
            });
        }
        
        App.save(); 
        Battle.log("\n▼ 画面タップで終了 ▼");
        if (isBossBattle && !isEstark && typeof Dungeon !== 'undefined') Dungeon.onBossDefeated();
    },

    lose: () => { 
		Battle.active = false; 
		Battle.log("全滅した..."); 
		// ★追加: 全滅回数のカウントアップ
		if(App.data.stats) App.data.stats.wipeoutCount = (App.data.stats.wipeoutCount || 0) + 1;
		Battle.endBattle(true); 
	},
	
    endBattle: (isGameOver = false) => {
        const isDungeon = (typeof Dungeon !== 'undefined' && Field.currentMapData && Field.currentMapData.isDungeon);
        
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

        App.save();
		
        if (isGameOver) {
            // ★全滅時: HPを1にしてフィールドに戻る (全ての戦闘で共通)
            App.data.characters.forEach(c => {
                if(App.data.party.includes(c.uid)) c.currentHp = 1;
            });
            App.save();

            // Battle.log("\n意識が遠のいていく……");
            setTimeout(() => {
                // ダンジョン内の全滅なら引数 true を渡して脱出
                if (isDungeon) {
                    Dungeon.exit(true); 
                } else {
                    // 通常フィールドでの全滅時はそのままフィールドシーンへ
                    App.changeScene('field');
                }
            }, 2000);
        } else {
            // 通常の勝利・逃走
            setTimeout(() => App.changeScene('field'), 500);
        }
    },
    toggleAuto: () => { Battle.auto = !Battle.auto; Battle.updateAutoButton(); if(Battle.phase === 'input') Battle.findNextActor(); },
    updateAutoButton: () => { const btn = Battle.getEl('btn-auto'); if(btn) { btn.innerText = `AUTO: ${Battle.auto?'ON':'OFF'}`; btn.style.background = Battle.auto ? '#d00' : '#333'; } },
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};