/* main.js (長押し移動復活・シナジーeffect付与・Base64画像描画対応版) */

// ==========================================================================
// 設定：職業別習得スキルテーブル
// ==========================================================================

const JOB_SKILLS = window.JOB_SKILLS || {};

// ==========================================================================
// クラス定義
// ==========================================================================

class Entity {
    constructor(data) {
        this.name = data.name;
        this.baseMaxHp = data.hp || 100;
        this.baseMaxMp = data.mp || 0;
        this.hp = data.currentHp !== undefined ? data.currentHp : this.baseMaxHp;
        this.mp = data.currentMp !== undefined ? data.currentMp : this.baseMaxMp;
        this.baseStats = { atk:data.atk||0, def:data.def||0, spd:data.spd||0, mag:data.mag||0 };
        this.buffs = { atk:1, def:1, spd:1, mag:1 };
        this.status = {}; 
        this.isDead = this.hp <= 0;
        
        // ★追加: 耐性データの読み込み
        this.resists = data.resists || {};

        this.job = data.job || '冒険者';
        this.rarity = data.rarity || 'N';
        this.level = data.level || 1;
		
		// ★画像読み込みロジックの修正
        // data.img（セーブデータ/個別データ）があればそれを、
        // なければマスタデータ（characters.js）からIDを元に探す
        const master = DB.CHARACTERS.find(c => c.id === (data.charId || data.id));
        this.img = data.img || (master ? master.img : null);
        //this.img = data.img || null;
		
        this.limitBreak = data.limitBreak || 0;
		// ★追加：データから転生回数を読み込む
        this.reincarnationCount = data.reincarnationCount || 0;
        this.exp = data.exp || 0;
		this.sp = data.sp || 0;
    }

    getStat(key) {
        // 耐性系の特別な処理 (Player/Monster 両対応)
        if (key === 'resists' || key === 'elmRes') {
            const currentVal = this[key] || {};
            // インスタンスに値がある(201階層等の動的付与)場合はそれを優先
            if (Object.keys(currentVal).length > 0) return currentVal;

            // なければ元データから取得
            if (this instanceof Player) {
                const stats = App.calcStats(this.originData);
                return stats[key] || {};
            } else {
                return (this.data ? this.data[key] : {}) || {};
            }
        }

        // 通常ステータス
        let val = (this.baseStats && this.baseStats[key] !== undefined) ? this.baseStats[key] : 0;
        
        if (this instanceof Player) {
            const stats = App.calcStats(this.originData);
            val = stats[key] || 0;
        } else {
            // モンスターの場合はインスタンスの値を優先 (scale適用済みの数値)
            if (this[key] !== undefined) val = this[key];
        }

        // バフ・デバフの乗算処理
        if (this.buffs && this.buffs[key]) val = Math.floor(val * this.buffs[key]);
        return val;
    }
		
    getStats() {
        if(this instanceof Player) {
            return App.calcStats(this.originData);
        } else {
            return {
                maxHp: this.baseMaxHp,
                maxMp: this.baseMaxMp,
                atk: this.baseStats.atk,
                def: this.baseStats.def,
                spd: this.baseStats.spd,
                mag: this.baseStats.mag,
                elmAtk: {}, elmRes: this.data.elmRes || {}, 
                magDmg: 0, sklDmg: 0, finDmg: 0, finRed: 0, mpRed: 0
            };
        }
    }

    takeDamage(damage) {
        if (damage <= 0) return 0;
        this.hp -= damage;
        if (this.hp < 0) this.hp = 0;
        if (this.hp <= 0) {
            this.isDead = true;
            App.log(`${this.name}は力尽きた！`);
        }
        return damage;
    }

    heal(amount) {
        const stats = this.getStats();
        const healed = Math.min(amount, stats.maxHp - this.hp);
        this.hp += healed;
        return healed;
    }

    consumeMp(amount) {
        this.mp -= amount;
        if (this.mp < 0) this.mp = 0;
    }
}

class Player extends Entity {
    constructor(data) {
        super(data);
        this.originData = data; 
        this.uid = data.uid;
        this.equips = data.equips || {};
        
        // ★最重要修正: コンフィグの参照をインスタンスに引き継ぐ
        // これにより、MenuAlliesで書き換えた内容が戦闘中のactorからも見えるようになります
        this.config = data.config || { fullAuto: false, hiddenSkills: [] };
        
        // 万が一データ側にconfigがなければ、初期値をデータ側にもセットして参照を同期させる
        if (!data.config) data.config = this.config;

        this.tree = data.tree || { 
            ATK: 0, MAG: 0, SPD: 0, HP: 0, MP: 0,
            WARRIOR: 0, MAGE: 0, PRIEST: 0, M_KNIGHT: 0
        };
		
        this.skills = [DB.SKILLS.find(s => s.id === 1)];

        // ★修正: 転生回数を考慮した「実効レベル」を計算してスキル習得判定に使用
        const effectiveLevel = data.level + (100 * (data.reincarnationCount || 0));
        const table = JOB_SKILLS[data.job];
        if (table) {
            for (let lv = 1; lv <= effectiveLevel; lv++) {
                if (table[lv]) this.learnSkill(table[lv]);
            }
        }

        if(data.charId) {
            const master = DB.CHARACTERS.find(c => c.id === data.charId);
            if(master && master.lbSkills) {
                if(this.limitBreak >= 50 && master.lbSkills[50]) this.learnSkill(master.lbSkills[50]);
                if(this.limitBreak >= 99 && master.lbSkills[99]) this.learnSkill(master.lbSkills[99]);
            }
        }
        
        // スキルツリー習得スキル
        if (this.tree) {
            for (let key in this.tree) {
                const level = this.tree[key];
                const treeDef = CONST.SKILL_TREES[key];
                if (treeDef) {
                    for (let i = 0; i < level; i++) {
                        const step = treeDef.steps[i];
                        if (step && step.skillId) {
                            this.learnSkill(step.skillId);
                        }
                    }
                }
            }
        }

        this.synergy = App.checkSynergy(this.equips);
    }

    learnSkill(sid) {
        const sk = DB.SKILLS.find(s => s.id === sid);
        if(sk && !this.skills.find(s => s.id === sk.id)) {
            this.skills.push(sk);
        }
    }
}

class Monster extends Entity {
    constructor(data, scale=1.0) {
        super(data);
        this.id = data.id;
        this.data = data;
        
        // ★修正: 30階以下の敵調整ロジック (確認済)
        let hpMod = 1.0;
        let statMod = 1.0;
        
        // data.rank が存在する場合のみ適用 (ボス等は対象外にしたい場合は条件追加)
        if (data.rank && data.rank <= 30) {
            hpMod = 0.8; // HP 20%ダウン
            statMod = 1.1; // 攻撃・魔力 10%アップ
        }

        this.hp = Math.floor((data.hp || 100) * scale * hpMod);
        this.baseMaxHp = this.hp;
        
        // 攻撃力等は少し高くして、戦闘のテンポを上げる（受けるダメ増、敵すぐ死ぬ）
        this.baseStats.atk = Math.floor((data.atk || 10) * scale * statMod);
        this.baseStats.def = Math.floor((data.def || 10) * scale); 
        this.baseStats.spd = Math.floor((data.spd || 10) * scale);
        this.baseStats.mag = Math.floor((data.mag || 10) * scale * statMod);
        
        this.acts = data.acts || [1];
        this.baseId = data.id;
        this.actCount = data.actCount || 1;
        
        // ★追加: ブレス耐性などの初期化（あれば）
        this.resists = data.resists || {};
		this.elmRes = data.elmRes || {};
    }
}

// ==========================================================================
// アプリケーションコア
// ==========================================================================

const App = {
    data: null,
    pendingAction: null, 

    // --- 初期データ構造の定義 ---
    // セーブデータが全くない場合や、マイグレーション時のデフォルト参照用
    getInitialData: () => {
        return {
            location: { area: 'START_VILLAGE', x: 6, y: 4 },
            progress: { 
                floor: 0, 
                storyStep: 0, 
                flags: {}, 
                unlocked: { smith: false, gacha: false },
                clearedDungeons: [],
                openedChests: {},  
                defeatedBosses: {} 
            },
            inventory: [],
            items: { "1": 3 }, 
            characters: [
                { uid: 'p1', charId: 1, name: 'アルス', job: '勇者', level: 1, exp: 0, hp: 50, mp: 20, atk: 15, def: 10, mag: 10, spd: 10, equips: { '武器':null, '盾':null, '頭':null, '体':null, '足':null }, sp: 0, tree: {}, config: { fullAuto: false, hiddenSkills: [] } }
            ],
            party: ['p1', null, null, null],
            gold: 500,
            gems: 0,
            dungeon: { 
                maxFloor: 0, 
                tryCount: 0, 
                returnPoint: null,
                map: null,
                width: 30,
                height: 30
            },
            stats: { 
                wipeoutCount: 0, 
                maxGold: 0, 
                maxGems: 0, 
                maxDamage: { val: 0, actor: '未記録', skill: '-' } 
            },
            book: { 
                monsters: [], 
                killCounts: {} 
            }
        };
    },

    // --- データ補完ロジック (マイグレーション) ---
    init: () => {
        // セーブデータの読み込み
        App.load();

        // 読み込み失敗、または新規プレイの場合
        if (!App.data) {
            App.data = App.getInitialData();
        }

        const initial = App.getInitialData();

        // 1. location の補完
        if (!App.data.location) {
            App.data.location = JSON.parse(JSON.stringify(initial.location));
        } else {
            if (!App.data.location.area) App.data.location.area = 'START_VILLAGE';
            if (App.data.location.x === undefined) App.data.location.x = 6;
            if (App.data.location.y === undefined) App.data.location.y = 4;
        }

        // 2. progress の補完
        if (!App.data.progress) {
            App.data.progress = JSON.parse(JSON.stringify(initial.progress));
        } else {
            if (App.data.progress.storyStep === undefined) App.data.progress.storyStep = 0;
            if (!App.data.progress.flags) App.data.progress.flags = {};
            if (!App.data.progress.unlocked) App.data.progress.unlocked = { smith: false, gacha: false };
            if (!App.data.progress.clearedDungeons) App.data.progress.clearedDungeons = [];
            if (!App.data.progress.openedChests) App.data.progress.openedChests = {};
            if (!App.data.progress.defeatedBosses) App.data.progress.defeatedBosses = {};
        }

        // 3. stats の補完
        if (!App.data.stats) {
            App.data.stats = JSON.parse(JSON.stringify(initial.stats));
        } else {
            if (App.data.stats.wipeoutCount === undefined) App.data.stats.wipeoutCount = 0;
            if (!App.data.stats.maxDamage) App.data.stats.maxDamage = { val: 0, actor: '未記録', skill: '-' };
        }

        // 4. book の補完
        if (!App.data.book) App.data.book = { monsters: [], killCounts: {} };

        // 5. dungeon の補完
        if (!App.data.dungeon) App.data.dungeon = JSON.parse(JSON.stringify(initial.dungeon));

        // 6. キャラクターの個別補完
        if (App.data.characters) {
            App.data.characters.forEach(c => {
                if (!c.config) c.config = { fullAuto: false, hiddenSkills: [] };
                if (c.sp === undefined) c.sp = 0;
                if (!c.tree) c.tree = {};
            });
        }

        // 修正結果を一度保存
        App.save();
    },

    initGameHub: () => {
        // ★修正: 画像読み込み待機処理を追加
        // assets.js があり、GRAPHICSが定義されていればロードしてからゲーム開始
        if(typeof GRAPHICS !== 'undefined') {
            GRAPHICS.load(() => {
                App.startGameLogic();
            });
        } else {
            // なければ即開始 (フォールバック)
            App.startGameLogic();
        }
    },

    startGameLogic: () => {
        // ★App.load() の代わりに、補完ロジックを含む App.init() を実行
        App.init();

        if(!App.data) { 
            if(window.location.href.indexOf('main.html') === -1) {
                 window.location.href = 'main.html'; 
            }
            return; 
        }
		
		// ★追加: 既存セーブデータの拡張（コンフィグ初期化）
        if (App.data.characters) {
            App.data.characters.forEach(c => {
                if (!c.config) c.config = { fullAuto: false, hiddenSkills: [] };
                
                // charId修正ロジック（既存）
                if (c.charId) {
                    const master = DB.CHARACTERS.find(m => m.id === c.charId);
                    if (master && master.job && c.job !== master.job) {
                        c.job = master.job;
                    }
                }
            });
            App.save();
        }
		
		// ★追加: 既存セーブデータの職業情報をDBマスタに合わせて強制上書き
        if (App.data.characters) {
            App.data.characters.forEach(c => {
                // charId（マスタID）を持っているキャラのみ対象
                if (c.charId) {
                    const master = DB.CHARACTERS.find(m => m.id === c.charId);
                    if (master && master.job) {
                        // 職業が変更されていれば上書き更新
                        if (c.job !== master.job) {
                            console.log(`[DataFix] ${c.name}の職業を修正: ${c.job} -> ${master.job}`);
                            c.job = master.job;
                            
                            // ※必要であればレアリティもここで同期可能
                            // c.rarity = master.rarity; 
                        }
                    }
                }
            });
            // 修正結果を即座に保存（次回以降のため）
            App.save();
        }

        // シナジー情報の更新
        if (App.data) {
            App.refreshAllSynergies();
        }
		
		// ★最重要修正: 戦闘復帰前にFieldを初期化してマップデータを復元する
        // これにより FIXED_DUNGEON_MAPS 等の背景設定が Battle.init 前に読み込まれます
        Field.init();

        if(App.data.location) {
            Field.x = App.data.location.x;
            Field.y = App.data.location.y;
        }

        if (App.data.progress && App.data.progress.floor > 0 && typeof Dungeon !== 'undefined') {
            Dungeon.floor = App.data.progress.floor;
            if (App.data.dungeon && App.data.dungeon.map) {
                Dungeon.map = App.data.dungeon.map;
                Dungeon.width = App.data.dungeon.width;
                Dungeon.height = App.data.dungeon.height;
                Field.currentMapData = {
                    width: Dungeon.width,
                    height: Dungeon.height,
                    tiles: Dungeon.map,
                    isDungeon: true
                };
            }
        }

        if (App.data.battle && App.data.battle.active) {
            App.log("戦闘に復帰します...");
            App.changeScene('battle');
        } else {
            App.log("冒険を開始します。");
            // --- ダンジョン（深淵の魔窟）の階層復帰ロジックを維持 ---
            if (App.data.progress && App.data.progress.floor > 0) {
                if (typeof Dungeon !== 'undefined') {
                    if (Field.currentMapData) {
                        App.changeScene('field');
                        App.log(`地下 ${Dungeon.floor} 階の冒険を再開します。`);
                    } else {
                        Dungeon.loadFloor(); // これにより魔窟のマップが自動生成・復元される
                    }
                } else {
                    App.changeScene('field');
                }
            } else {
                // --- ストーリー拠点またはワールドマップからの開始 ---
                // 座標はセーブデータのものをそのままFieldに渡し、マップの決定はField.initに任せる
                if(App.data.location) {
                    Field.x = App.data.location.x;
                    Field.y = App.data.location.y;
                }
                App.changeScene('field');
            }
        }
        
        let moveTimer = null;
        const startMove = (dx, dy) => {
            if(moveTimer) clearInterval(moveTimer);
            if(typeof Menu !== 'undefined' && Menu.isMenuOpen()) return;
            Field.move(dx, dy); 
            moveTimer = setInterval(() => {
                if(typeof Menu !== 'undefined' && Menu.isMenuOpen()) { stopMove(); return; }
                Field.move(dx, dy);
            }, 150); 
        };
        const stopMove = (e) => {
            if(e) e.preventDefault(); 
            if(moveTimer) clearInterval(moveTimer);
            moveTimer = null;
        };

        window.addEventListener('keydown', e => {
            if(document.getElementById('field-scene') && document.getElementById('field-scene').style.display === 'flex') {
                if(typeof Menu !== 'undefined' && Menu.isMenuOpen()) return;
                if(['ArrowUp', 'w'].includes(e.key)) Field.move(0, -1);
                if(['ArrowDown', 's'].includes(e.key)) Field.move(0, 1);
                if(['ArrowLeft', 'a'].includes(e.key)) Field.move(-1, 0);
                if(['ArrowRight', 'd'].includes(e.key)) Field.move(1, 0);
                if(e.key === 'Enter' || e.key === ' ') {
                    if(App.pendingAction) App.executeAction();
                    else if(typeof Menu !== 'undefined') Menu.openMainMenu();
                }
            }
        });

        /* main.js の bindPad 部分を以下のロジックに差し替えてください */
		const bindPad = (id, dx, dy) => {
			const el = document.getElementById(id);
			if(!el) return;

			// マウス操作
			el.onmousedown = (e) => { e.preventDefault(); startMove(dx, dy); };
			el.onmouseup = stopMove;
			el.onmouseleave = stopMove;

			// タッチ操作（エラー対策版）
			el.ontouchstart = (e) => { 
				// ブラウザ側で「キャンセル可能(cancelable)」な場合のみ preventDefault を呼ぶ
				// これにより Intervention エラーを回避し、かつボタンの誤作動（意図しないスクロール）を防ぎます
				if (e.cancelable) e.preventDefault(); 
				startMove(dx, dy); 
			};
			el.ontouchend = stopMove;
		};
        bindPad('btn-up', 0, -1);
        bindPad('btn-down', 0, 1);
        bindPad('btn-left', -1, 0);
        bindPad('btn-right', 1, 0);

        const bindClick = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
        bindClick('btn-menu', () => { if(typeof Menu !== 'undefined') Menu.openMainMenu(); });
        bindClick('btn-ok', () => { if(App.pendingAction) App.executeAction(); else if(typeof Menu !== 'undefined') Menu.openMainMenu(); });
		
        // ★ 会話のレジューム実行
        if (typeof StoryManager !== 'undefined') {
            StoryManager.resumeActiveConversation();
        }
		
    },

    /**
     * 現在の場所と進行度に基づき、適切な「階層ランク」を返す
     */
    getVirtualFloor: () => {
        const data = App.data;
        if (!data) return 1;
        const areaKey = data.location.area;
        
        // 深淵の魔窟 100階以上の特別処理
        if (areaKey === 'ABYSS' && data.progress.floor >= 100) {
            return data.progress.floor;
        }

        // STORY_DATA から設定を読み込む (朽ちた祠なら 300 が返る)
        const areaDef = STORY_DATA.areas[areaKey];
        if (areaDef) {
            // 深淵の魔窟（100階未満）の段階的ランクアップ
            if (areaKey === 'ABYSS') {
                const f = data.progress.floor;
                if (f <= 20) return 70;
                if (f <= 40) return 80;
                if (f <= 75) return 90;
                return 100;
            }
            return areaDef.rank;
        }

        return 1;
    },

    /**
     * 機能を解放する (鍛冶屋・ガチャ等)
     */
    unlockFeature: (key) => {
        if (!App.data.progress.unlocked) App.data.progress.unlocked = {};
        App.data.progress.unlocked[key] = true;
        App.save();
        App.log(`【システム解放】${key === 'smith' ? '鍛冶屋' : 'ガチャ'}が利用可能になった！`);
    },

    /**
     * ストーリー上の仲間を加入させる
     */
    addStoryAlly: (charId) => {
        const master = window.CHARACTERS_DATA.find(c => c.id === charId);
        if (!master) return;
        if (App.data.characters.some(c => c.charId === charId)) return;

        const newAlly = JSON.parse(JSON.stringify(master));
        newAlly.uid = 'u' + Date.now() + Math.floor(Math.random()*1000);
        newAlly.sp = 0;
        newAlly.tree = { ATK:0, MAG:0, SPD:0, HP:0, MP:0, WARRIOR:0, MAGE:0, PRIEST:0, M_KNIGHT:0 };
        // 初期スキルセット (こうげき)
        if (!newAlly.skills) newAlly.skills = [1];
        
        App.data.characters.push(newAlly);
        App.save();
        App.log(`【仲間加入】${newAlly.name}がパーティに加わった！`);
    },
	
    
    // シナジー情報の全更新
    refreshAllSynergies: () => {
        const check = (item) => {
            if (!item) return;

            // ★修正: +3以上（+4等も含む）のみを対象とする。それ未満はシナジーを削除。
            if (item.plus >= 3) {
                const syns = App.checkSynergy(item); // 配列で取得
                if (syns && syns.length > 0) {
                    item.isSynergy = true;
                    item.effects = syns.map(s => s.effect); // 複数の効果IDを配列で保持
                    item.synergies = syns; // 表示・計算用
                } else {
                    item.isSynergy = false;
                    delete item.effects;
                    delete item.synergies;
                }
            } else {
                // +3未満はシナジーを持たせない
                item.isSynergy = false;
                delete item.effects;
                delete item.synergies;
            }
        };
        if (App.data.inventory) { App.data.inventory.forEach(check); }
        if (App.data.characters) {
            App.data.characters.forEach(c => {
                if (c.equips) { Object.values(c.equips).forEach(check); }
            });
        }
    },
	
    setAction: (label, callback) => {
        const btn = document.getElementById('action-indicator');
        if(!btn) return;
        btn.innerText = label;
        btn.style.display = 'block';
        App.pendingAction = callback;
    },
    clearAction: () => {
        const btn = document.getElementById('action-indicator');
        if(btn) btn.style.display = 'none';
        App.pendingAction = null;
    },
    executeAction: () => {
        if(App.pendingAction) {
            const act = App.pendingAction;
            App.clearAction();
            act();
        }
    },

    initTitleScreen: () => { 
        App.load(); 
        const btn = document.getElementById('btn-continue'); 
        if(App.data && btn) { 
            btn.disabled = false; 
            let name = '勇者'; let lv = 1;
            if(App.data.party && App.data.party[0]) {
                const c = App.data.characters.find(ch => ch.uid === App.data.party[0]);
                if(c) { name = c.name; lv = c.level; }
            }
            btn.innerHTML = `続きから<br><span style="font-size:12px">(${name} Lv.${lv})</span>`;
        } 
    },

    load: () => { 
        try { 
            const j=localStorage.getItem(CONST.SAVE_KEY); 
            if(j){ 
                App.data=JSON.parse(j); 
                if(!App.data.book) App.data.book = { monsters: [] }; 
				
				if (!App.data.book.killCounts) {
					App.data.book.killCounts = {}; 
				}
				
                if(!App.data.battle) App.data.battle = { active: false }; 
				
				// ★追加: 統計データオブジェクトがない場合の初期化
				if(!App.data.stats) {
					App.data.stats = {
						maxGold: 0,
						maxGems: 0,
						wipeoutCount: 0,
						totalSteps: 0,
						totalBattles: 0,
						maxDamage: { val: 0, actor: '', skill: '' },
						startTime: Date.now()
					};
				}
            } 
        }catch(e){ console.error(e); } 
    },
	
    save: () => { 
        if(App.data && Field.ready) { 
            App.data.location.x=Field.x; 
            App.data.location.y=Field.y; 
        } 
		
		// ★追加: 最大所持記録の更新
		if(!App.data.stats) App.data.stats = { maxGold: 0, maxGems: 0 };
		if(App.data.gold > (App.data.stats.maxGold || 0)) App.data.stats.maxGold = App.data.gold;
		if(App.data.gems > (App.data.stats.maxGems || 0)) App.data.stats.maxGems = App.data.gems;
		
        try {
            localStorage.setItem(CONST.SAVE_KEY, JSON.stringify(App.data));
        } catch(e) { console.error(e); }
    },
    
    startNewGame: () => {
        const fileInput = document.getElementById('player-icon');
        if(fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if(file.size > 500 * 1024) {
                alert("画像サイズが大きすぎます(500KB以下)");
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => { App.createGameData(e.target.result); };
            reader.readAsDataURL(file);
        } else {
            App.createGameData(null);
        }
    },

    createGameData: (imgSrc) => {
        const name = document.getElementById('player-name').value || 'アルス';
        App.data = JSON.parse(JSON.stringify(INITIAL_DATA_TEMPLATE));
        App.data.characters[0].name = name;
        App.data.characters[0].img = imgSrc; 
        
        //App.data.characters[0].sp = 0;
        App.data.characters[0].tree = { ATK:0, MAG:0, SPD:0, HP:0, MP:0 };

        for(let i=0;i<5;i++) App.data.inventory.push(App.createEquipByFloor('init', 1)); 
        try {
            localStorage.setItem(CONST.SAVE_KEY, JSON.stringify(App.data));
            window.location.href='index.html'; 
        } catch(e) { alert("データ作成失敗"); }
    },
    
    continueGame: () => { window.location.href='index.html'; },
    returnToTitle: () => { App.save(); window.location.href='main.html'; },
    
    changeScene: (sceneId) => {
        document.querySelectorAll('.scene-layer').forEach(e => e.style.display = 'none');
        const target = document.getElementById(sceneId + '-scene');
        if(target) target.style.display = 'flex';
        
        if(typeof Menu !== 'undefined') Menu.closeAll();
        App.clearAction();

        if(sceneId === 'field') Field.init();
        if(sceneId === 'battle') Battle.init();
        if(sceneId === 'inn') Facilities.initInn();
        if(sceneId === 'medal') Facilities.initMedal();
        if(sceneId === 'casino') Casino.init();
    },

    getChar: (uid) => App.data ? App.data.characters.find(c => c.uid === uid) : null,

    calcStats: (char) => {
        // DBのマスタデータを取得 (基礎ステータス参照用)
        const base = DB.CHARACTERS.find(c => c.id === char.charId) || char;
        
        // リミットブレイク回数 (なければ0)
        const lb = char.limitBreak || 0;
        
        // レアリティ別加算率の設定
        const LB_RATES = { 
            'N': 0.40, 'R': 0.30, 'SR': 0.28, 'SSR': 0.25, 'UR': 0.20, 'EX': 0.10 
        };
        const lbRate = LB_RATES[base.rarity] !== undefined ? LB_RATES[base.rarity] : 0.10;

        let s = {
            maxHp: char.hp + Math.floor((base.hp || 100) * lbRate * lb * 1.5),
            maxMp: char.mp + Math.floor((base.mp || 50) * lbRate * lb),
            atk: char.atk + Math.floor((base.atk || 10) * lbRate * lb),
            def: char.def + Math.floor((base.def || 10) * lbRate * lb),
            spd: char.spd + Math.floor((base.spd || 10) * lbRate * lb),
            mag: char.mag + Math.floor((base.mag || 10) * lbRate * lb),
            
            elmAtk: {}, elmRes: {}, magDmg: 0, sklDmg: 0, finDmg: 0, finRed: 0, mpRed: 0, mpCostRate: 1.0,
            
            // 状態異常耐性の初期化
            resists: {
                Poison: 0, ToxicPoison: 0, Shock: 0, Fear: 0, 
                Debuff: 0, InstantDeath: 0,
                SkillSeal: 0, SpellSeal: 0, HealSeal: 0
            }
        };
        
        CONST.ELEMENTS.forEach(e => { s.elmAtk[e]=0; s.elmRes[e]=0; });

        // DB(マスタ)に耐性設定があれば適用
        if(base.resists) {
            for(let key in base.resists) s.resists[key] = (s.resists[key] || 0) + base.resists[key];
        }

        // 1. ユーザー配分ポイント (主人公のみ)
        if(char.uid === 'p1' && char.alloc) {
            for(let key in char.alloc) {
                if (key.includes('_')) {
                    const [type, elm] = key.split('_');
                    if(type === 'elmAtk') s.elmAtk[elm] = (s.elmAtk[elm] || 0) + char.alloc[key];
                    if(type === 'elmRes') s.elmRes[elm] = (s.elmRes[elm] || 0) + char.alloc[key];
                } else {
                    if (key === 'hp') s.maxHp += char.alloc[key] * 10; 
                    else if (key === 'mp') s.maxMp += char.alloc[key] * 2;
                    else if (s[key] !== undefined) s[key] += char.alloc[key];
                }
            }
        }

        // 2. 装備補正
        let pctMods = { maxHp:0, maxMp:0, atk:0, def:0, spd:0, mag:0 }; 

        CONST.PARTS.forEach(part => {
            const eq = char.equips ? char.equips[part] : null;
            if(eq) {
                // 固定値加算
                if(eq.data.atk) s.atk += eq.data.atk;
                if(eq.data.def) s.def += eq.data.def;
                if(eq.data.spd) s.spd += eq.data.spd;
                if(eq.data.mag) s.mag += eq.data.mag;
                
                // 装備マスタの基礎効果を合算
                for (let key in eq.data) {
                    if (key.startsWith('resists_')) {
                        const resKey = key.replace('resists_', '');
                        s.resists[resKey] = (s.resists[resKey] || 0) + eq.data[key];
                    } else if (key.startsWith('attack_')) {
                        s[key] = (s[key] || 0) + eq.data[key];
                    }
                }

                if(eq.data.finDmg) s.finDmg += eq.data.finDmg;
                if(eq.data.finRed) s.finRed += eq.data.finRed;
                if(eq.data.elmAtk) for(let e in eq.data.elmAtk) s.elmAtk[e] += eq.data.elmAtk[e];
                if(eq.data.elmRes) for(let e in eq.data.elmRes) s.elmRes[e] += eq.data.elmRes[e];

                // オプション補正
                if(eq.opts) eq.opts.forEach(o => {
                    if(o.unit === '%') {
                        if(o.key === 'hp') pctMods.maxHp += o.val;
                        else if(o.key === 'mp') pctMods.maxMp += o.val;
                        else if(o.key === 'atk') pctMods.atk += o.val;
                        else if(o.key === 'def') pctMods.def += o.val;
                        else if(o.key === 'spd') pctMods.spd += o.val;
                        else if(o.key === 'mag') pctMods.mag += o.val;
                        else if(o.key === 'elmAtk') s.elmAtk[o.elm] = (s.elmAtk[o.elm]||0) + o.val;
                        else if(o.key === 'elmRes') s.elmRes[o.elm] = (s.elmRes[o.elm]||0) + o.val;
                        else if(o.key.startsWith('resists_')) {
                            const resKey = o.key.replace('resists_', '');
                            s.resists[resKey] = (s.resists[resKey] || 0) + o.val;
                        }
                        else if(o.key.startsWith('attack_')) {
                            s[o.key] = (s[o.key] || 0) + o.val;
                        }
                        else if(s[o.key] !== undefined) s[o.key] += o.val; 
                    } else if(o.unit === 'val') {
                        if(o.key === 'hp') s.maxHp += o.val;
                        else if(o.key === 'mp') s.maxMp += o.val;
                        else if(o.key === 'elmAtk') s.elmAtk[o.elm] = (s.elmAtk[o.elm]||0) + o.val;
                        else if(o.key === 'elmRes') s.elmRes[o.elm] = (s.elmRes[o.elm]||0) + o.val;
                        else if(s[o.key] !== undefined) s[o.key] += o.val;
                    } 
                });
                
                // ★シナジー効果の反映：複数の効果をループで適用するように修正
                if (eq.isSynergy && eq.effects) {
                    eq.effects.forEach(effect => {
                        if (effect === 'might') s.finDmg += 30;
                        if (effect === 'ironWall') s.finRed += 10;
                        if (effect === 'guardian') pctMods.def += 100;
                        if (effect === 'divineProtection') {
                            for (let k in s.resists) s.resists[k] = (s.resists[k] || 0) + 20;
                        }
                        if (effect === 'hpBoost100') pctMods.maxHp += 100;
                        if (effect === 'spdBoost100') pctMods.spd += 100;
                        if (effect === 'debuffImmune') s.resists.Debuff = 100;
                        if (effect === 'sealGuard50') {
                            s.resists.SkillSeal = (s.resists.SkillSeal || 0) + 50;
                            s.resists.SpellSeal = (s.resists.SpellSeal || 0) + 50;
                            s.resists.HealSeal = (s.resists.HealSeal || 0) + 50;
                        }
                        if (effect === 'elmAtk25') {
                            const elmOpt = eq.opts.find(o => o.key === 'elmAtk');
                            if (elmOpt) s.elmAtk[elmOpt.elm] = (s.elmAtk[elmOpt.elm] || 0) + 25;
                        }
                    });
                }
            }
        });

        // 3. スキルツリー補正 (拡張版: unlockedTreesとCONST.SKILL_TREESを参照)
        const trees = char.unlockedTrees || char.tree;
        if (trees) {
            for (let treeKey in trees) {
                const stepCount = trees[treeKey]; 
                const treeDef = CONST.SKILL_TREES[treeKey];
                if (!treeDef) continue;

                for (let i = 0; i < stepCount; i++) {
                    const step = treeDef.steps[i];
                    if (!step) continue;

                    if (step.stats) {
                        if (step.stats.hpMult) pctMods.maxHp += step.stats.hpMult * 100;
                        if (step.stats.mpMult) pctMods.maxMp += step.stats.mpMult * 100;
                        if (step.stats.atkMult) pctMods.atk += step.stats.atkMult * 100;
                        if (step.stats.defMult) pctMods.def += step.stats.defMult * 100;
                        if (step.stats.spdMult) pctMods.spd += step.stats.spdMult * 100;
                        if (step.stats.magMult) pctMods.mag += step.stats.magMult * 100;
                        if (step.stats.dmgMult) s.finDmg += step.stats.dmgMult * 100;
                        if (step.stats.allElmMult) {
                            CONST.ELEMENTS.forEach(e => { s.elmAtk[e] = (s.elmAtk[e] || 0) + step.stats.allElmMult * 100; });
                        }
                    }

                    if (step.passive) {
                        if (step.passive === 'finRed10') s.finRed += 10;
                        else if (step.passive === 'hpRegen') s.hpRegen = true;
                        else if (step.passive === 'atkIgnoreDef') s.atkIgnoreDef = true;
                        else if (step.passive === 'magCrit') s.magCrit = true;
                        else if (step.passive === 'fastestAction') s.fastestAction = true;
                        else if (step.passive === 'doubleAction') s.doubleAction = true;
                    }
                }
                
                if (!treeDef.steps[0].stats) {
                    if (treeKey === 'ATK') pctMods.atk += stepCount * 5;
                    if (treeKey === 'MAG') pctMods.mag += stepCount * 5;
                    if (treeKey === 'SPD') pctMods.spd += stepCount * 5;
                    if (treeKey === 'HP')  pctMods.maxHp += stepCount * 5;
                    if (treeKey === 'MP') {
                        pctMods.def += stepCount * 5;
                        pctMods.maxMp += stepCount * 5;
                        if (stepCount >= 5) s.finRed += 10;
                    }
                }
            }
        }

        // 最終計算
        s.maxHp = Math.floor(s.maxHp * (1 + pctMods.maxHp / 100));
        s.maxMp = Math.floor(s.maxMp * (1 + pctMods.maxMp / 100));
        s.atk = Math.floor(s.atk * (1 + pctMods.atk / 100));
        s.def = Math.floor(s.def * (1 + pctMods.def / 100));
        s.spd = Math.floor(s.spd * (1 + pctMods.spd / 100));
        s.mag = Math.floor(s.mag * (1 + pctMods.mag / 100));

        return s;
    },

	/**
     * レベルアップ処理 (ご提示のロジックを維持・経験値のみ修正)
     */
    gainExp: (charData, expGain) => {
        if (!charData.exp) charData.exp = 0;
        charData.exp += expGain;
        let logs = [];
        
        // レベル上限100
        while (charData.level < 100) {
            const nextExp = App.getNextExp(charData);
            if (charData.exp >= nextExp) {
                charData.exp -= nextExp;
                charData.level++;
                
                // DBの基礎値を取得
                const master = DB.CHARACTERS.find(c => c.id === charData.charId) || charData;

                // 成長率: 4% 〜 8% (既存ロジック維持)
                const minRate = 0.04;
                const maxRate = 0.08;
                const r = () => minRate + Math.random() * (maxRate - minRate);

                const incHp = Math.max(1, Math.floor((master.hp || 100) * r() * 2));
                const incMp = Math.max(1, Math.floor((master.mp || 50) * r()));
                const incAtk = Math.max(1, Math.floor((master.atk || 10) * r()));
                const incDef = Math.max(1, Math.floor((master.def || 10) * r()));
                const incSpd = Math.max(1, Math.floor((master.spd || 10) * r()));
                const incMag = Math.max(1, Math.floor((master.mag || 10) * r()));

                charData.hp += incHp; charData.mp += incMp;
                charData.atk += incAtk; charData.def += incDef;
                charData.spd += incSpd; charData.mag += incMag;
                
                // SP加算
                if (charData.sp === undefined) charData.sp = 0;
                charData.sp++; 
                
                // HP/MP全回復
                const stats = App.calcStats(charData);
                charData.currentHp = stats.maxHp;
                charData.currentMp = stats.maxMp;

                let logMsg = `${charData.name}はLv${charData.level}になった！<br>HP+${incHp}, 攻+${incAtk}...`;
                
                // 既存のスキル習得チェック
                const newSkill = App.checkNewSkill(charData);
                if (newSkill) {
                    if(!charData.skills) charData.skills = [];
                    const hasSkill = charData.skills.includes(newSkill.id);
                    if(!hasSkill) {
                        charData.skills.push(newSkill.id);
                        logMsg += `<br><span style="color:#ffff00;">${newSkill.name}を覚えた！</span>`;
                    }
                }
                logs.push(logMsg);
            } else { break; }
        }
        App.save();
        return logs;
    },


	// 装備生成ロジック
    createEquipByFloor: (source, floor = null, fixedPlus = null) => {
        const targetFloor = (floor !== null) ? floor : App.getVirtualFloor();
		
        // 1. 参照するRankを決定
        const targetRank = Math.min(200, floor);
        
        // 2. 候補を抽出
        let candidates = window.EQUIP_MASTER.filter(e => e.rank <= targetRank && e.rank >= Math.max(1, targetRank - 15));
        if (candidates.length === 0) candidates = window.EQUIP_MASTER.filter(e => e.rank <= targetRank);
        if (candidates.length === 0) candidates = [window.EQUIP_MASTER[0]];

        const base = candidates[Math.floor(Math.random() * candidates.length)];
        
        // 3. プラス値の決定
        let plus = 0;
        if (fixedPlus !== null) {
            plus = fixedPlus;
        } else {
            const r = Math.random();
            if (r < CONST.PLUS_RATES[3]) plus = 3;
            else if (r < CONST.PLUS_RATES[3] + CONST.PLUS_RATES[2]) plus = 2;
            else if (r < CONST.PLUS_RATES[3] + CONST.PLUS_RATES[2] + CONST.PLUS_RATES[1]) plus = 1;
            if (source === 'init') plus = 0;
        }
        
        // 4. ベース作成
        const eq = { 
            id: Date.now() + Math.random().toString(36).substring(2), 
            rank: base.rank, 
            name: base.name, 
            type: base.type, 
            baseName: base.baseName,
            val: base.rank * 150 * (1 + plus * 0.5), 
            data: JSON.parse(JSON.stringify(base.data)), 
            opts: [], 
            plus: plus,
            possibleOpts: base.possibleOpts || []
        };

        // 5. 201階以降の「真・装備」化
        if (floor > 200) {
            eq.name = "真・" + base.name;
            const scale = (floor * 1.5) / base.rank;
            
            for (let key in eq.data) {
                if (typeof eq.data[key] === 'number') {
                    eq.data[key] = Math.floor(eq.data[key] * scale);
                } else if (typeof eq.data[key] === 'object' && eq.data[key] !== null) {
                    for (let subKey in eq.data[key]) {
                        eq.data[key][subKey] = Math.floor(eq.data[key][subKey] * scale);
                    }
                }
            }
            eq.val = Math.floor(eq.val * scale);
        }

        // 6. オプション付与
        if (plus > 0) {
            const BASE_OPTS_MAP = {
                '剣': ['atk', 'finDmg', 'elmAtk'],
                '斧': ['atk', 'finDmg', 'elmAtk', 'attack_Fear'],
                '短剣': ['atk', 'mag', 'finDmg', 'elmAtk', 'attack_Poison'],
                '杖': ['mag', 'finDmg', 'elmAtk'],
                '盾': ['def', 'finRed', 'elmRes', 'resists_Debuff', 'resists_InstantDeath'],
                '腕輪': ['atk', 'mag', 'spd', 'def', 'finDmg', 'elmAtk', 'resists_Debuff', 'resists_InstantDeath'],
                '兜': ['hp', 'mp', 'def', 'finRed', 'elmRes', 'resists_Fear', 'resists_SkillSeal'],
                '帽子': ['hp', 'mp', 'mag', 'elmRes', 'resists_SpellSeal', 'resists_HealSeal'],
                '鎧': ['hp', 'mp', 'def', 'finRed', 'elmRes', 'resists_Poison', 'resists_SkillSeal'],
                'ローブ': ['hp', 'mp', 'def', 'mag', 'elmAtk', 'elmRes', 'resists_SpellSeal', 'resists_HealSeal'],
                'ブーツ': ['spd', 'def', 'finRed', 'elmRes', 'resists_Shock'],
                'くつ': ['spd', 'finDmg', 'elmAtk', 'resists_Shock']
            };
            let baseDefaults = BASE_OPTS_MAP[eq.baseName] || [];
            let masterOpts = base.possibleOpts || [];
            let allowedKeys = [...new Set([...baseDefaults, ...masterOpts])];

            for(let i=0; i<plus; i++) {
                let optCandidates = DB.OPT_RULES.filter(rule => allowedKeys.includes(rule.key));
                if (optCandidates.length === 0) optCandidates = DB.OPT_RULES;
                const rule = optCandidates[Math.floor(Math.random() * optCandidates.length)];
                let rarity = 'N';
                const tierRatio = Math.min(1, floor / 200);
                const rarRnd = Math.random() + (tierRatio * 0.15);
                if(rarRnd > 0.98 && rule.allowed.includes('EX')) rarity='EX';
                else if(rarRnd > 0.90 && rule.allowed.includes('UR')) rarity='UR';
                else if(rarRnd > 0.75 && rule.allowed.includes('SSR')) rarity='SSR';
                else if(rarRnd > 0.55 && rule.allowed.includes('SR')) rarity='SR';
                else if(rarRnd > 0.30 && rule.allowed.includes('R')) rarity='R';
                else rarity = rule.allowed[0];
                const min = rule.min[rarity]||1, max = rule.max[rarity]||10;
                eq.opts.push({
                    key: rule.key, elm: rule.elm, label: rule.name, 
                    val: Math.floor(Math.random()*(max-min+1))+min, unit: rule.unit, rarity: rarity
                });
            }
            eq.name += `+${plus}`;
        }

        // 7. ★修正: +3以上（+4等も含む）をシナジー判定の対象にする
        if (plus >= 3) {
            const syns = App.checkSynergy(eq); // 配列を受け取る
            if (syns && syns.length > 0) {
                eq.isSynergy = true;
                eq.effects = syns.map(s => s.effect); // 全ての効果IDを配列に格納
                eq.synergies = syns; // シナジーオブジェクト自体も保持
            }
        }
        return eq;
    },
	
    // 互換性維持のためのラッパー（既存の他ファイルからの参照用）
    createRandomEquip: (source, rank = 1, fixedPlus = null) => {
        return App.createEquipByFloor(source, rank, fixedPlus);
    },


	// --- シナジー判定：複合条件・属性条件に完全対応 ---
    checkSynergy: (eq) => { 
        if (!eq || !eq.opts || eq.opts.length === 0) return []; // nullではなく空配列を返すように変更

        let matches = []; // 一致したシナジーをすべて格納する配列
        for (const syn of DB.SYNERGIES) {
            let isMatch = false;

            // 1. 複合条件（req配列がある場合：四源の浸食・軍神など）
            if (syn.req) {
                isMatch = syn.req.every(r => {
                    // key だけでなく、属性(elm)の指定がある場合はそれも一致するかチェックする
                    const count = eq.opts.filter(o => {
                        const keyMatch = (o.key === r.key);
                        const elmMatch = (!r.elm || o.elm === r.elm); // 条件にelmがない、または一致する場合
                        return keyMatch && elmMatch;
                    }).length;
                    return count >= r.count;
                });
            }
            // 2. 属性指定条件（elmがある場合：混沌の刃など）
            else if (syn.key && syn.elm) {
                const count = eq.opts.filter(o => o.key === syn.key && o.elm === syn.elm).length;
                isMatch = count >= syn.count;
            }
            // 3. 単一条件（count個以上同じキーがある場合：疾風怒濤など）
            else if (syn.key) {
                const count = eq.opts.filter(o => o.key === syn.key).length;
                isMatch = count >= syn.count;
            }

            if (isMatch) matches.push(syn); // returnせず、一致したものをすべて配列に追加する
        }
        return matches; 
    },

    log: (msg) => {
        const e = document.getElementById('msg-text');
        if(e) e.innerHTML = msg; 
        console.log(`[App] ${msg}`);
    },
    
    createCharHTML: (c) => {
        const s = App.calcStats(c);
        const hp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
        const mp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
		
		// ★ここを修正：c.imgが空ならマスタから取得
        const master = DB.CHARACTERS.find(m => m.id === c.charId);
        const displayImg = c.img || (master ? master.img : null);
        
        const imgTag = displayImg ? `<img src="${displayImg}" style="width:100%; height:100%; object-fit:cover;">` : 'IMG';
        
		// ★追加：転生マークの生成
        const reincarnated = c.reincarnationCount ? `<span style="color:#00ff00; margin-left:4px;">★${c.reincarnationCount}</span>` : '';
		
        return `
            <div class="char-row">
                <div class="char-thumb">${imgTag}</div>
                <div class="char-info">
                    <div class="char-name">${c.name} <span class="rarity-${c.rarity}">[${c.rarity}]</span> +${c.limitBreak||0}</div>
                    <div class="char-meta">${c.job} Lv.${c.level}</div>
                    <div class="char-stats">
                        <span style="color:#f88;">HP:${hp}/${s.maxHp}</span>
                        <span style="color:#88f;">MP:${mp}/${s.maxMp}</span>
                        <span>攻:${s.atk}</span> <span>防:${s.def}</span> <span>魔:${s.mag}</span> <span>速:${s.spd}</span>
                    </div>
                </div>
            </div>`;
    },

    //getNextExp: (char) => {
    //    if (char.level >= CONST.MAX_LEVEL) return Infinity;
    //    const base = CONST.EXP_BASE * Math.pow(CONST.EXP_GROWTH, char.level - 1);
    //    const rarityMult = CONST.RARITY_EXP_MULT[char.rarity] || 1.0;
    //    return Math.floor(base * rarityMult);
    //},
	
	getNextExp: (charData) => {
        const rCount = charData.reincarnationCount || 0;
        
        // 指示1：実効レベル = 現在レベル + (転生回数 * 100)
        const effectiveLevel = charData.level + (rCount * 100);

        // 指示2：成長率をdatabase.jsから参照し、転生者(r>=1)は -0.03 する
        let growth = CONST.EXP_GROWTH || 1.08;
        if (rCount >= 1) growth -= 0.03; // 例：1.08 -> 1.05

        const baseExp = CONST.EXP_BASE || 100;
        const rarityMult = (CONST.RARITY_EXP_MULT && CONST.RARITY_EXP_MULT[charData.rarity]) || 1.0;

        // 指数関数による計算 (実効レベルを使用)
        return Math.floor(baseExp * Math.pow(growth, effectiveLevel - 1) * rarityMult);
    },

    checkNewSkill: (charData) => {
        const table = JOB_SKILLS[charData.job];
        if (table && table[charData.level]) return DB.SKILLS.find(s => s.id === table[charData.level]);
        return null;
    },

    downloadSave: () => {
        if (!App.data) {
            if(typeof Menu !== 'undefined') Menu.msg("セーブデータがありません");
            else alert("セーブデータがありません");
            return;
        }
        const json = JSON.stringify(App.data);
        const blob = new Blob([json], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `QoE_SaveData_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importSave: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const loadedData = JSON.parse(event.target.result);
                    if (loadedData.gold !== undefined && loadedData.party && loadedData.characters) {
                        if (confirm("現在のデータを上書きして復元しますか？\n(ページがリロードされます)")) {
                            localStorage.setItem(CONST.SAVE_KEY, JSON.stringify(loadedData));
                            location.reload(); 
                        }
                    } else {
                        alert("不正なセーブデータ形式です");
                    }
                } catch (err) {
                    alert("ファイルの読み込みに失敗しました");
                    console.error(err);
                }
            };
            reader.readAsText(file);
        };
        input.click(); 
    },

    changeScene: (sceneId) => {
        document.querySelectorAll('.scene-layer').forEach(e => e.style.display = 'none');
        const target = document.getElementById(sceneId + '-scene');
        if(target) target.style.display = 'flex';
        
        if(typeof Menu !== 'undefined') Menu.closeAll();
        App.clearAction();

        if(sceneId === 'field') Field.init();
        if(sceneId === 'battle') Battle.init();
        if(sceneId === 'inn') Facilities.initInn();
        if(sceneId === 'medal') Facilities.initMedal();
        if(sceneId === 'casino') Casino.init();
    }
};

/* main.js 内の Field オブジェクト全文 */

const Field = {
    x: 23, y: 28, 
    dir: 0, // 向き (0:下, 1:左, 2:右, 3:上)
    step: 1, // 歩行アニメ用 (1 または 2)
    ready: false, currentMapData: null,
    
    init: () => {
        if(App.data) {
            const areaKey = App.data.location.area || 'WORLD';
            
            // --- マップデータの復元ロジック ---
            if (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[areaKey]) {
                Field.currentMapData = { 
                    ...FIXED_DUNGEON_MAPS[areaKey],
                    isDungeon: true,
                    isFixed: true 
                };
                if(typeof Dungeon !== 'undefined') Dungeon.floor = App.data.progress.floor || 1;
            }
            else if (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[areaKey]) {
                Field.currentMapData = FIXED_MAPS[areaKey];
            }
            else if (areaKey === 'ABYSS') {
                if (App.data.dungeon && App.data.dungeon.map) {
                    Field.currentMapData = {
                        name: STORY_DATA.areas['ABYSS'].name,
                        width: App.data.dungeon.width,
                        height: App.data.dungeon.height,
                        tiles: App.data.dungeon.map,
                        isDungeon: true
                    };
                    if(typeof Dungeon !== 'undefined') Dungeon.floor = App.data.progress.floor;
                } else {
                    App.data.location.area = 'WORLD';
                    Field.currentMapData = null;
                }
            } else {
                Field.currentMapData = null; // ワールドマップ
            }

            // 座標の復元
            Field.x = App.data.location.x;
            Field.y = App.data.location.y;

            if (!Field.currentMapData) {
                const mapW = (typeof MAP_DATA !== 'undefined' && MAP_DATA[0]) ? MAP_DATA[0].length : 100;
                const mapH = (typeof MAP_DATA !== 'undefined') ? MAP_DATA.length : 100;
                Field.x = (Field.x % mapW + mapW) % mapW;
                Field.y = (Field.y % mapH + mapH) % mapH;
            }
        }

        Field.ready = true;
        Field.render();
        
        if(document.getElementById('disp-gold')) document.getElementById('disp-gold').innerText = App.data.gold;
        if(document.getElementById('disp-gem')) document.getElementById('disp-gem').innerText = App.data.gems;
        if(typeof Menu !== 'undefined') Menu.renderPartyBar();
    },

    getCurrentAreaKey: () => {
        if (!Field.currentMapData) return 'WORLD';
        const locArea = App.data.location.area;
        if (locArea && (STORY_DATA.areas[locArea] || (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[locArea]))) {
            return locArea;
        }
        const entry = Object.entries(STORY_DATA.areas).find(([key, area]) => area.name === Field.currentMapData.name);
        if (entry) return entry[0];
        if (typeof FIXED_DUNGEON_MAPS !== 'undefined') {
            const dungeonEntry = Object.entries(FIXED_DUNGEON_MAPS).find(([key, area]) => area.name === Field.currentMapData.name);
            if (dungeonEntry) return dungeonEntry[0];
        }
        return Field.currentMapData.isDungeon ? 'DEFAULT' : 'WORLD';
    },

    getTileConfig: (tileSign) => {
        const upper = tileSign.toUpperCase();
        const areaKey = Field.getCurrentAreaKey();
        const theme = TILE_THEMES[areaKey] || TILE_THEMES['DEFAULT'];
        
        let config = theme[upper] || TILE_THEMES['DEFAULT'][upper] || { img: null, color: '#000' };
        if (upper === 'T' && Field.currentMapData && !Field.currentMapData.isDungeon && !config.img) {
            return { img: 'inn', color: '#444' };
        }
        return config;
    },

    getBattleBg: () => {
        if (App.data.battle && App.data.battle.isEstark) return 'battle_bg_lastboss';
        if (Field.currentMapData) {
            if (Field.currentMapData.battleBg) return Field.currentMapData.battleBg;
            if (Field.currentMapData.isDungeon) {
                const floor = App.data.progress.floor || 0;
                const genType = App.data.dungeon.genType;
                if (floor % 10 === 0) return 'battle_bg_boss'; 
                if (genType === 2) return 'battle_bg_maze';     
                return 'battle_bg_dungeon';
            }
            return 'battle_bg_field';
        }
        const mapW = MAP_DATA[0].length, mapH = MAP_DATA.length;
        const tx = ((Field.x % mapW) + mapW) % mapW, ty = ((Field.y % mapH) + mapH) % mapH;
        const tile = MAP_DATA[ty][tx].toUpperCase();
        if (tile === 'F') return 'battle_bg_forest';
        if (tile === 'L') return 'battle_bg_mountain';
        return 'battle_bg_field';
    },
	
	move: (dx, dy) => {
		// ★追加: 一歩歩くごとにログを空欄にする処理
        const logEl = document.getElementById('msg-text');
        if (logEl) logEl.innerHTML = '';
		
        if (dy > 0) Field.dir = 0; else if (dx < 0) Field.dir = 1; else if (dx > 0) Field.dir = 2; else if (dy < 0) Field.dir = 3;
        Field.step = (Field.step === 1) ? 2 : 1;
        let nx = Field.x + dx, ny = Field.y + dy;
        App.clearAction();

        if (Field.currentMapData) {
            if (nx < 0 || nx >= Field.currentMapData.width || ny < 0 || ny >= Field.currentMapData.height) return;
            let tile = Field.currentMapData.tiles[ny][nx].toUpperCase();

            // ★追加: 固定宝箱/ボスの判定を移動前に行う (撃破・取得済みなら通り抜け可能にする)
            if (Field.currentMapData.isFixed) {
                const ak = Field.getCurrentAreaKey();
                const posStr = `${nx},${ny}`;
                // 宝箱チェック
                if ((tile === 'C' || tile === 'R') && App.data.progress.openedChests && App.data.progress.openedChests[ak]?.includes(posStr)) {
                    tile = 'G';
                }
                // ボスチェック
                if (tile === 'B' && App.data.progress.defeatedBosses && App.data.progress.defeatedBosses[ak]?.includes(posStr)) {
                    tile = 'G';
                }
            }

            if (tile === 'W') return; 

            if (tile === 'S' && !Field.currentMapData.isDungeon) {
                const areaKey = App.data.location.area;
                if (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[areaKey]?.exitPoint) {
                    const exit = FIXED_MAPS[areaKey].exitPoint;
                    App.data.location.area = 'WORLD';
                    Field.x = exit.x; Field.y = exit.y;
                    App.data.location.x = exit.x; App.data.location.y = exit.y;
                    Field.currentMapData = null; 
                    App.log("フィールドへ出た");
                    App.save(); Field.render(); return;
                }
            }

            Field.x = nx; Field.y = ny;
            App.data.location.x = nx; App.data.location.y = ny;

            if (!Field.currentMapData.isDungeon) {
                if (tile === 'I') { App.log("宿屋のようだ。"); App.setAction("泊まる", () => App.changeScene('inn')); }
                else if (tile === 'K') { App.log("カジノの看板だ。"); App.setAction("カジノに入る", () => App.changeScene('casino')); }
                else if (tile === 'E') { App.log("交換所のようだ。"); App.setAction("メダル交換", () => App.changeScene('medal')); }
                else if (tile === 'D' && App.data.location.area === 'START_VILLAGE') {
                    App.log("「試練の洞窟」の入口だ。");
                    App.setAction("洞窟に入る", () => Dungeon.startFixed('START_CAVE'));
                } else if (tile === 'V' || tile === 'T' || tile === 'H') {
                    if (typeof StoryManager !== 'undefined') {
                        const trigger = StoryManager.triggers.find(t => t.area === App.data.location.area && t.x === nx && t.y === ny && t.step === App.data.progress.storyStep);
                        if (trigger) App.setAction("話す", () => StoryManager.executeEvent(trigger.eventId));
                        else App.log("誰かいるようだ。");
                    }
                }
            }
            if (Field.currentMapData.isDungeon) Dungeon.handleMove(nx, ny);
            App.save(); Field.render();
        } else {
            const mapW = MAP_DATA[0].length, mapH = MAP_DATA.length;
            nx = (nx + mapW) % mapW; ny = (ny + mapH) % mapH;
            const tile = MAP_DATA[ny][nx].toUpperCase();
            if (tile === 'M') { App.log("険しい岩山だ"); return; }
            if (tile === 'W') { if (!App.data.progress?.flags?.hasShip) { App.log("海は船がないと渡れない…"); return; } }
            Field.x = nx; Field.y = ny; App.data.location.x = nx; App.data.location.y = ny; 
            if (tile === 'I' || tile === 'B') {
                let targetAreaKey = null;
                for (let key in STORY_DATA.areas) { if (STORY_DATA.areas[key].centerX === nx && STORY_DATA.areas[key].centerY === ny) { targetAreaKey = key; break; } }
                if (targetAreaKey && typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[targetAreaKey]) {
                    const areaDef = FIXED_MAPS[targetAreaKey];
                    App.setAction(`${areaDef.name}に入る`, () => {
                        App.data.location.area = targetAreaKey; Field.currentMapData = areaDef;
                        Field.x = areaDef.entryPoint ? areaDef.entryPoint.x : Math.floor(areaDef.width/2);
                        Field.y = areaDef.entryPoint ? areaDef.entryPoint.y : areaDef.height - 3;
                        App.data.location.x = Field.x; App.data.location.y = Field.y;
                        App.log(`${areaDef.name}に入った`); App.save(); App.changeScene('field');
                    });
                } else { App.log("小さな休憩所がある。"); App.setAction("休む", () => App.changeScene('inn')); }
            } 
            else if (tile === 'E') App.setAction("メダル交換", () => App.changeScene('medal'));
            else if (tile === 'K') App.setAction("カジノに入る", () => App.changeScene('casino'));
            else if (tile === 'D') {
                App.log("不気味な穴が開いている…「深淵の魔窟」だ"); 
                App.setAction("魔窟に入る", () => { App.data.location.area = 'ABYSS'; Dungeon.enter(); });
            }
            else {
                let rate = 0.03; if (App.data.walkCount > 15) rate = 0.06;
                if(Math.random() < rate) { App.data.walkCount = 0; App.log("敵だ！"); setTimeout(()=>App.changeScene('battle'), 300); }
            }
            if(App.data.walkCount === undefined) App.data.walkCount = 0;
            App.data.walkCount++; App.save(); Field.render();
        }
    },

    render: () => {
        const canvas = document.getElementById('field-canvas'); if(!canvas) return;
        const ctx = canvas.getContext('2d'), ts = 32, w = canvas.width, h = canvas.height;
        ctx.fillStyle='#000'; ctx.fillRect(0,0,w,h);
        const cx = w/2, cy = h/2, rangeX = Math.ceil(w/(2*ts))+1, rangeY = Math.ceil(h/(2*ts))+1;
        const mapW = Field.currentMapData ? Field.currentMapData.width : (typeof MAP_DATA !== 'undefined' ? MAP_DATA[0].length : 50);
        const mapH = Field.currentMapData ? Field.currentMapData.height : (typeof MAP_DATA !== 'undefined' ? MAP_DATA.length : 32);
        const g = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};

        for (let dy = -rangeY; dy <= rangeY; dy++) {
            for (let dx = -rangeX; dx <= rangeX; dx++) {
                const drawX = Math.floor(cx + (dx * ts) - (ts / 2)), drawY = Math.floor(cy + (dy * ts) - (ts / 2));
                let tx = Field.x + dx, ty = Field.y + dy, tile = 'W';
                if (Field.currentMapData) { 
                    if (tx >= 0 && tx < mapW && ty >= 0 && ty < mapH) {
                        tile = Field.currentMapData.tiles[ty][tx];
                        const ak = Field.getCurrentAreaKey(); const pk = `${tx},${ty}`;
                        if (Field.currentMapData.isFixed) {
                            if ((tile === 'C' || tile === 'R') && App.data.progress.openedChests?.[ak]?.includes(pk)) tile = 'G';
                            if (tile === 'B' && App.data.progress.defeatedBosses?.[ak]?.includes(pk)) tile = 'G';
                        }
                    }
                }
                else { tile = MAP_DATA[((ty % mapH) + mapH) % mapH][((tx % mapW) + mapW) % mapW]; }
                const config = Field.getTileConfig(tile), upper = tile.toUpperCase(), floorConfig = Field.getTileConfig('T');
                if (g[floorConfig.img]) ctx.drawImage(g[floorConfig.img], drawX, drawY, ts, ts);
                else { ctx.fillStyle = floorConfig.color; ctx.fillRect(drawX, drawY, ts, ts); }
                if (upper !== 'T' && upper !== 'G') {
                    if (config.img && g[config.img]) ctx.drawImage(g[config.img], drawX, drawY, ts, ts);
                    else if (config.color && config.color !== floorConfig.color) { ctx.fillStyle = config.color; ctx.fillRect(drawX, drawY, ts, ts); }
                }
            }
        }
        const pKey = `hero_${['down','left','right','up'][Field.dir]}_${Field.step}`; 
        if (g[pKey]) ctx.drawImage(g[pKey], cx-ts/2, cy-ts/2, ts, ts);
        else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill(); }

        let locName = Field.currentMapData ? Field.currentMapData.name : `世界地図 (${Field.x}, ${Field.y})`;
        if (Field.currentMapData && Field.currentMapData.isDungeon) locName += ` ${Dungeon.floor}階`;
        document.getElementById('loc-name').innerText = locName;

        const mmSize = 80, mmX = w-mmSize-10, mmY = 10, range = 10; 
        ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(mmX, mmY, mmSize, mmSize);
        
        // ★追加: ミニマップの白い極細枠線
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX, mmY, mmSize, mmSize);

        const dms = mmSize / (range*2); 
        for(let mdy = -range; mdy < range; mdy++) {
            for(let mdx = -range; mdx < range; mdx++) {
                let mtx = Field.x + mdx; let mty = Field.y + mdy; let mtile = 'W';
                if (Field.currentMapData) { 
                    if(mtx>=0 && mtx<mapW && mty>=0 && mty<mapH) {
                        mtile = Field.currentMapData.tiles[mty][mtx]; 
                        const ak = Field.getCurrentAreaKey(); const pk = `${mtx},${mty}`;
                        if (App.data.progress.openedChests?.[ak]?.includes(pk)) mtile = 'G';
                        if (App.data.progress.defeatedBosses?.[ak]?.includes(pk)) mtile = 'G';
                    }
                } else { mtile = MAP_DATA[((mty%mapH)+mapH)%mapH][((mtx%mapW)+mapW)%mapW]; }
                if (mdx===0 && mdy===0) ctx.fillStyle = '#fff'; else ctx.fillStyle = Field.getTileConfig(mtile).color;
                if (ctx.fillStyle !== '#000') ctx.fillRect(mmX + (mdx + range) * dms, mmY + (mdy + range) * dms, dms, dms);
            }
        }
        ctx.restore();
    }
};