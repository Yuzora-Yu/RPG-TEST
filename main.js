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
        this.baseStats = { atk:data.atk||0, def:data.def||0, spd:data.spd||0, mag:data.mag||0, mdef: data.mdef || 0 };
        this.buffs = { atk:1, def:1, spd:1, mag:1, mdef:1 };
        this.status = {}; 
        this.isDead = this.hp <= 0;
        
        // ★追加: 耐性データの読み込み
        this.resists = data.resists || {};
		
		// ★追加: 特性データの保持
        this.traits = data.traits || [];
		
		// 判定用のプロパティ（種族・隊列・フラグ等）
        this.race = data.race || '不明';
        this.formation = data.formation || 'front';
        this.isBoss = data.isBoss || false;
        this.isEstark = data.isEstark || false;

        this.job = data.job || '冒険者';
        this.rarity = data.rarity || 'N';
        this.level = data.level || 1;
		
		// ★画像読み込みロジックの修正
        // data.img（セーブデータ/個別データ）があればそれを、
        // なければマスタデータ（characters.js）からIDを元に探す
        const master = DB.CHARACTERS.find(c => c.id === (data.charId || data.id));
        this.img = data.img || (master ? master.img : null);
		
        this.limitBreak = data.limitBreak || 0;
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
        
        // 3. スキルツリー習得スキル
        if (this.tree) {
            for (let key in this.tree) {
                const level = this.tree[key];
                const treeDef = CONST.SKILL_TREES[key];
                if (treeDef) {
                    for (let i = 0; i < level; i++) {
                        const step = treeDef.steps[i];
                        if (step && step.skillId) this.learnSkill(step.skillId);
                        // ★複数スキルID対応
                        if (step && step.skillIds) {
                            (Array.isArray(step.skillIds) ? step.skillIds : [step.skillIds]).forEach(sid => this.learnSkill(sid));
                        }
                    }
                }
            }
        }
		
		// 4. 装備品そのもののスキル習得およびシナジーの適用
        this.synergy = []; 
        Object.values(this.equips).forEach(eq => {
            if (!eq) return;

            // ★追加：装備品自体が持つスキル (grantSkills: [421] など) を習得
            const gSkills = eq.grantSkills || (eq.data && eq.data.grantSkills);
            if (Array.isArray(gSkills)) {
                gSkills.forEach(sid => {
                    if (sid) this.learnSkill(sid);
                });
            }

            // シナジー効果の判定とスキル習得
            if (eq.isSynergy && eq.synergies) {
                eq.synergies.forEach(syn => {
                    this.synergy.push(syn);
                    if (syn.effect === 'grantSkill' && syn.value) {
                        this.learnSkill(syn.value);
                    }
                });
            }
        });
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
			// ★追加：鍛冶データの初期値
            blacksmith: { 
                level: 1, 
                exp: 0 
            },
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

        // --- 修正点1: 読み込み失敗時に自動でデータを作成しない ---
        // これにより startGameLogic 内の判定が機能し、セーブがない場合はタイトル(main.html)へ飛びます
        if (!App.data) return;

        const initial = App.getInitialData();

        // --- 修正点2: エリアや座標の整合性チェック（安全な復帰） ---
        // 1. location の補完
        if (App.data.location) {
            const loc = App.data.location;
            const area = loc.area;
            
            // 現在のビルドに存在するエリアか判定
            const isWorld = (area === 'WORLD');
            const isAbyss = (area === 'ABYSS');
            const isFixed = (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[area]);
            const isDungeonMap = (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[area]);

            if (!isWorld && !isAbyss && !isFixed && !isDungeonMap) {
                // エリア自体が存在しない（削除・改名された）場合は初期位置へ
                console.warn(`[Recovery] 非存在エリア '${area}' を検知。初期位置へ復旧します。`);
                App.data.location = JSON.parse(JSON.stringify(initial.location));
            } else if (isFixed || isDungeonMap) {
                // 固定マップの場合、座標が現在のマップの範囲内か判定
                const mapDef = isFixed ? FIXED_MAPS[area] : FIXED_DUNGEON_MAPS[area];
                if (mapDef && (loc.x < 0 || loc.x >= mapDef.width || loc.y < 0 || loc.y >= mapDef.height)) {
                    console.warn(`[Recovery] マップ外座標 (${loc.x}, ${loc.y}) を検知。初期位置へ復旧します。`);
                    App.data.location = JSON.parse(JSON.stringify(initial.location));
                }
            }
        }

        // 2. progress の補完
        if (!App.data.progress) {
            App.data.progress = JSON.parse(JSON.stringify(initial.progress));
        } else {
            if (App.data.progress.storyStep === undefined) App.data.progress.storyStep = 0;
			// ★追加: subStep の初期化
			if (App.data.progress.subStep === undefined) App.data.progress.subStep = 0;
			// ★追加: マップタイルの変更履歴（永続化用）
			if (!App.data.progress.mapChanges) App.data.progress.mapChanges = {};
			
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
				if (c.exp === undefined) c.exp = 0; // ★この行を追加
                if (!c.tree) c.tree = {};
            });
        }
		
		// ★追加: 7. blacksmith の補完
        if (!App.data.blacksmith) {
            App.data.blacksmith = { level: 1, exp: 0 };
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
			// ★新規追加: ゲーム開始時に主人公のリミットブレイクを同期
            if (typeof StoryManager !== 'undefined' && StoryManager.syncHeroLimitBreak) {
                StoryManager.syncHeroLimitBreak();
            }
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
		
		// main.js の startGameLogic 内に追加
		if (App.data && App.data.progress.rerollState) {
			const state = App.data.progress.rerollState;
			const char = App.data.characters.find(c => c.uid === state.charUid);
			if (char) {
				MenuAllies.selectedChar = char;
				MenuAllies.selectedUid = char.uid;
				// 画面を仲間詳細まで進めてから比較モーダルを開く
				Menu.openSubScreen('allies');
				MenuAllies.renderDetail();
				MenuTraitDetail.renderRerollResult();
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
		
        // ★ 会話とイベントのレジューム実行 (競合を避ける順序)
        if (typeof StoryManager !== 'undefined') {
            // 1. まず中断された会話の再開を試みる (あれば再開)
            const wasConversationResumed = StoryManager.resumeActiveConversation();
            
            // 2. 会話が再開されなかった（＝特定の行データがない）場合のみ、
            //    勝利イベント全体の予約をチェックして再開する
            if (!wasConversationResumed) {
                StoryManager.resumePendingBattleWinEvent();
            }
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
     * ガチャ産キャラクターと同一のデータ構造で初期化する
     */
    addStoryAlly: (charId) => {
        const master = window.CHARACTERS_DATA.find(c => c.id === charId);
        if (!master) return;
        if (App.data.characters.some(c => c.charId === charId)) return;

        // 1. 必要な情報だけを抽出した保存用オブジェクトを作成
        const saveAlly = {
            uid: 'u' + Date.now() + Math.floor(Math.random() * 1000),
            charId: charId,
            name: master.name, // 名前は表示用に保持
            job: master.job,
            rarity: master.rarity,
            level: 1,
            exp: 0,
            sp: master.sp,
            hp: master.hp,
            mp: master.mp,
            atk: master.atk,
            def: master.def,
            mag: master.mag,
            spd: master.spd,
			mdef: master.mdef,
            equips: { '武器': null, '盾': null, '頭': null, '体': null, '足': null },
			// ★1. 特性は一旦空で作成する
            traits: [], 
            disabledTraits: [],
            tree: { ATK: 0, MAG: 0, SPD: 0, HP: 0, MP: 0, WARRIOR: 0, MAGE: 0, PRIEST: 0, M_KNIGHT: 0 },
            config: { fullAuto: false, hiddenSkills: [] },
            limitBreak: 0,
            reincarnationCount: 0
            // ★ img, archives, lbSkills, resists 等の静的データはここには含めない
        };
		
		// ★2. レベルアップ習得ロジックを呼び出す
        // newCharはLv1なので、conditions[0] ({lv:1, total:0}) を満たし、
        // fixedTraits[0]（またはランダム）が1つだけ追加されます。
        if (typeof PassiveSkill !== 'undefined' && PassiveSkill.applyLevelUpTraits) {
            PassiveSkill.applyLevelUpTraits(saveAlly);
        }

        App.data.characters.push(saveAlly);
        App.save();
        App.log(`【仲間加入】${saveAlly.name}がパーティに加わった！`);
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
        const j = localStorage.getItem(CONST.SAVE_KEY); 
        if(j){ 
            App.data = JSON.parse(j); 
            
            // --- ここから mdef 補完ロジック ---
            if (App.data.characters) {
                App.data.characters.forEach(char => {
                    // mdef が未定義、または null の場合に mag * 0.8 で初期化
                    if (char.mdef === undefined || char.mdef === null) {
                        char.mdef = Math.floor((char.mag || 0) * 0.8);
                    }
                });
            }
            // ----------------------------------

            if(!App.data.book) App.data.book = { monsters: [] }; 
            if(!App.data.book.killCounts) App.data.book.killCounts = {}; 
            if(!App.data.battle) App.data.battle = { active: false }; 
            
            if(!App.data.stats) {
                App.data.stats = {
                    maxGold: 0, maxGems: 0, wipeoutCount: 0,
                    totalSteps: 0, totalBattles: 0,
                    maxDamage: { val: 0, actor: '', skill: '' },
                    startTime: Date.now()
                };
            }
        } 
    } catch(e) { console.error(e); } 
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
        
        // スキルツリー初期化
        App.data.characters[0].tree = { ATK:0, MAG:0, SPD:0, HP:0, MP:0 };

        // ★ 主人公の初期装備（武器）を Rank 1 / +3 の武器(eid 1-6)からランダム生成
        let startWeapon;
        while (true) {
            // sourceに'drop'を渡すことで +3 の抽選ロジックを有効化
            startWeapon = App.createEquipByFloor('drop', 1, 3);
            
            // 生成されたアイテムが eid 1〜6 (武器カテゴリ) かチェック
            // 武器名から「+3」を除去してマスタを検索
            const baseName = startWeapon.name.replace('+3', '');
            const master = window.EQUIP_MASTER.find(e => e.name === baseName);
            
            // 武器タイプであり、かつ指定された eid 範囲内であれば確定
            if (master && master.type === '武器' && master.eid >= 1 && master.eid <= 6) {
                break;
            }
        }
        
        // 主人公の武器スロットに装備
        App.data.characters[0].equips['武器'] = startWeapon;

        // 初期インベントリ（残りの5枠は通常通り Rank 1 / +0 で配布）
        for(let i=0; i<5; i++) {
            App.data.inventory.push(App.createEquipByFloor('init', 1)); 
        }

        try {
            localStorage.setItem(CONST.SAVE_KEY, JSON.stringify(App.data));
            window.location.href = 'index.html'; 
        } catch(e) { 
            alert("データ作成失敗"); 
        }
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

    /* ==========================================================================
    main.js - App.calcStats (オーラ系特性反映版)
    ========================================================================== */

    calcStats: (char) => {
    // DBのマスタデータを取得 (基礎ステータス参照用)
    const base = (window.CHARACTERS_DATA || []).find(c => c.id === char.charId) || char;

    /* main-1.js の App.calcStats 内、getEquip を以下に差し替えてください */

    // equips キー揺れ吸収用ヘルパ (全装備タイプ・スロット網羅版)
    const getEquip = (part) => {
        if (!char.equips) return null;

        // 英語の内部パーツ名から、セーブデータで使われうる「日本語キー」の候補リスト
        const mapping = {
            // 武器：BASE_OPTS_MAPの武器種を網羅
            'Weapon': ['武器', '剣', '斧', '槍', '短剣', '弓', '杖', 'weapon'],
            // 盾：腕輪は盾装備という仕様を反映
            'Shield': ['盾', '腕輪', 'shield'],
            // 頭
            'Head':   ['頭', '兜', '帽子', 'head'],
            // 体
            'Body':   ['体', '鎧', 'ローブ', 'body', 'Armor'],
            // 足
            'Legs':   ['足', 'ブーツ', 'くつ', 'legs', 'Feet']
        };

        // 1. まずは指定されたキーそのものでチェック (例: getEquip('武器'))
        if (char.equips[part]) return char.equips[part];

        // 2. マッピングリストから候補を順番にチェック
        const candidates = mapping[part] || [];
        for (const key of candidates) {
            if (char.equips[key]) return char.equips[key];
        }

        return null;
    };

    // --- 武器種判定：単数 weaponType を維持しつつ、複数 weaponTypes を追加 ---
	char.weaponTypes = [];

	// 1) まず「右手相当」を優先（既存getEquip('Weapon')の結果を先頭に）
	const mainW = getEquip('Weapon');
	if (mainW) {
	  const bn = mainW.baseName || (mainW.data && mainW.data.baseName) || '素手';
	  if (bn && bn !== '素手') char.weaponTypes.push(bn);
	}

	// 2) つぎに equips 全スロットから武器を拾う（左手武器など）
	if (char.equips) {
	  Object.values(char.equips).forEach(eq => {
		if (!eq) return;
		if (eq.type === '武器' || eq.type === 'weapon') {
		  const bn = eq.baseName || (eq.data && eq.data.baseName) || '素手';
		  if (bn && bn !== '素手' && !char.weaponTypes.includes(bn)) {
			char.weaponTypes.push(bn);
		  }
		}
	  });
	}

	// 互換性のため weaponType（単数）も維持：代表値＝先頭、なければ素手
	char.weaponType = char.weaponTypes[0] || '素手';


    // リミットブレイク回数の計算（主人公 ID301 は storyStep を加算）
    let lb = char.limitBreak || 0;
    if (char.charId === 301 && App.data && App.data.progress) {
        lb += (App.data.progress.storyStep || 0);
    }

    // レアリティ別加算率
    const LB_RATES = { 'N': 0.40, 'R': 0.30, 'SR': 0.28, 'SSR': 0.25, 'UR': 0.20, 'EX': 0.10 };
    const lbRate = (LB_RATES[base.rarity] !== undefined) ? LB_RATES[base.rarity] : 0.10;

    // ステータス初期化
    let s = {
        maxHp: char.hp + Math.floor((base.hp || 100) * lbRate * lb * 1.5),
        maxMp: char.mp + Math.floor((base.mp || 50) * lbRate * lb),
        atk:   char.atk + Math.floor((base.atk || 10) * lbRate * lb),
        def:   char.def + Math.floor((base.def || 10) * lbRate * lb),
        mdef:  char.mdef + Math.floor((base.mdef || 10) * lbRate * lb),
        spd:   char.spd + Math.floor((base.spd || 10) * lbRate * lb),
        mag:   char.mag + Math.floor((base.mag || 10) * lbRate * lb),

        // 命中・回避・会心（最終は加算方針）
        hit: char.hit || base.hit || 100,
        eva: char.eva || base.eva || 0,
        cri: char.cri || base.cri || 0,

        elmAtk: {}, elmRes: {},
        magDmg: 0, sklDmg: 0,
        finDmg: 0, finRed: 0,
        mpRed: 0,
        mpCostRate: 1.0,

        // 状態異常耐性
        resists: {
            Poison: 0, ToxicPoison: 0, Shock: 0, Fear: 0,
            Debuff: 0, InstantDeath: 0,
            SkillSeal: 0, SpellSeal: 0, HealSeal: 0
        }
    };

    // 属性初期化
    CONST.ELEMENTS.forEach(e => { s.elmAtk[e] = 0; s.elmRes[e] = 0; });

    // DB(マスタ)側の耐性を適用
    if (base.resists) {
        for (let key in base.resists) {
            s.resists[key] = (s.resists[key] || 0) + base.resists[key];
        }
    }

    // 1. ユーザー配分ポイント (主人公のみ)
    if (char.uid === 'p1' && char.alloc) {
        for (let key in char.alloc) {
            if (key.includes('_')) {
                const [type, elm] = key.split('_');
                if (type === 'elmAtk') s.elmAtk[elm] = (s.elmAtk[elm] || 0) + char.alloc[key];
                if (type === 'elmRes') s.elmRes[elm] = (s.elmRes[elm] || 0) + char.alloc[key];
            } else {
                if (key === 'hp') s.maxHp += char.alloc[key] * 10;
                else if (key === 'mp') s.maxMp += char.alloc[key] * 2;
                else if (s[key] !== undefined) s[key] += char.alloc[key];
            }
        }
    }

	// 2. 装備補正（%乗算用。ただし hit/eva/cri は最終加算）
	let pctMods = { maxHp: 0, maxMp: 0, atk: 0, def: 0, mdef: 0, spd: 0, mag: 0, hit: 0, eva: 0, cri: 0 };

	// --- 追加：装備を「全スロット」から集める（重複キー対策付き） ---
	const allEquips = [];
	const seen = new Set();
	// ★新規追加：集約用スキルSet
    const allSkillIds = new Set(char.skills || []);

	if (char.equips) {
		for (const [slotKey, eq] of Object.entries(char.equips)) {
			if (!eq || !eq.data) continue;

			// 「同一装備が複数キーに入ってる」ケースの二重加算を避けるための署名
			// ※プロジェクト側にユニークIDがあるならそれを最優先で使ってください
			const sig =
				eq.uid || eq.guid || eq.uniqueId ||
				`${eq.id || ''}|${eq.name || ''}|${eq.plus || eq.level || ''}|${eq.baseName || (eq.data && eq.data.baseName) || ''}|${slotKey}`;

			if (seen.has(sig)) continue;
			seen.add(sig);
			allEquips.push(eq);
		}
	}

	// --- 追加：二刀流用の武器種リスト（weaponTypes）を作る。互換のため weaponType も維持 ---
	char.weaponTypes = [];
	for (const eq of allEquips) {
		if (eq && (eq.type === '武器' || eq.type === 'weapon')) {
			const bn = eq.baseName || (eq.data && eq.data.baseName) || '素手';
			if (!char.weaponTypes.includes(bn)) char.weaponTypes.push(bn);
		}
	}
	char.weaponType = char.weaponTypes[0] || '素手';

	// --- ここから：装備加算本体（旧CONST.PARTSループの代わり） ---
	for (const eq of allEquips) {
		// 固定値・マスタ定義の加算
		if (eq.data.atk)  s.atk  += eq.data.atk;
		if (eq.data.def)  s.def  += eq.data.def;
		if (eq.data.mdef) s.mdef += eq.data.mdef;
		if (eq.data.spd)  s.spd  += eq.data.spd;
		if (eq.data.mag)  s.mag  += eq.data.mag;
		if (eq.data.hit)  s.hit  += eq.data.hit;
		if (eq.data.eva)  s.eva  += eq.data.eva;
		if (eq.data.cri)  s.cri  += eq.data.cri;
		
		// ★新規追加：装備によるスキル習得
        const gSkills = eq.grantSkills || (eq.data && eq.data.grantSkills);
        if (Array.isArray(gSkills)) {
            gSkills.forEach(id => { if(id) allSkillIds.add(id); });
        }

		// 装備マスタの耐性・追加効果
		for (let key in eq.data) {
			if (key.startsWith('resists_')) {
				const resKey = key.replace('resists_', '');
				s.resists[resKey] = (s.resists[resKey] || 0) + eq.data[key];
			} else if (key.startsWith('attack_')) {
				s[key] = (s[key] || 0) + eq.data[key];
			}
		}

		if (eq.data.finDmg) s.finDmg += eq.data.finDmg;
		if (eq.data.finRed) s.finRed += eq.data.finRed;
		if (eq.data.elmAtk) for (let e in eq.data.elmAtk) s.elmAtk[e] += eq.data.elmAtk[e];
		if (eq.data.elmRes) for (let e in eq.data.elmRes) s.elmRes[e] += eq.data.elmRes[e];

        // オプション補正（% / val）
        if (eq.opts) eq.opts.forEach(o => {
            if (!o || !o.key) return;

            if (o.unit === '%') {
                if (o.key === 'hp') pctMods.maxHp += o.val;
                else if (o.key === 'mp') pctMods.maxMp += o.val;

                else if (pctMods[o.key] !== undefined) pctMods[o.key] += o.val;

                else if (o.key === 'elmAtk') s.elmAtk[o.elm] = (s.elmAtk[o.elm] || 0) + o.val;
                else if (o.key === 'elmRes') s.elmRes[o.elm] = (s.elmRes[o.elm] || 0) + o.val;

                else if (o.key.startsWith('resists_')) {
                    const resKey = o.key.replace('resists_', '');
                    s.resists[resKey] = (s.resists[resKey] || 0) + o.val;
                } else if (o.key.startsWith('attack_')) {
                    s[o.key] = (s[o.key] || 0) + o.val;
                }

                else if (s[o.key] !== undefined) s[o.key] += o.val;

            } else if (o.unit === 'val') {
                if (o.key === 'hp') s.maxHp += o.val;
                else if (o.key === 'mp') s.maxMp += o.val;

                else if (o.key === 'elmAtk') s.elmAtk[o.elm] = (s.elmAtk[o.elm] || 0) + o.val;
                else if (o.key === 'elmRes') s.elmRes[o.elm] = (s.elmRes[o.elm] || 0) + o.val;

                else if (o.key.startsWith('resists_')) {
                    const resKey = o.key.replace('resists_', '');
                    s.resists[resKey] = (s.resists[resKey] || 0) + o.val;
                } else if (o.key.startsWith('attack_')) {
                    s[o.key] = (s[o.key] || 0) + o.val;
                }

                else if (s[o.key] !== undefined) s[o.key] += o.val;
            }
        });

        // シナジー効果補正
            // ここで ReferenceError を防ぐため App.checkSynergy を使用
            if (typeof App.checkSynergy === 'function') {
                const syns = App.checkSynergy(eq);
				if (syns) {
					syns.forEach(syn => {
						if (syn.effect === 'might') s.finDmg += 30;
						if (syn.effect === 'ironWall') s.finRed += 10;
						if (syn.effect === 'guardian') pctMods.def += 100;
						if (syn.effect === 'divineProtection') {
							for (let k in s.resists) s.resists[k] = (s.resists[k] || 0) + 20;
						}
						if (syn.effect === 'hpBoost100') pctMods.maxHp += 100;
						if (syn.effect === 'spdBoost100') pctMods.spd += 100;
						if (syn.effect === 'debuffImmune') s.resists.Debuff = 100;
						if (syn.effect === 'sealGuard50') {
							s.resists.SkillSeal = (s.resists.SkillSeal || 0) + 50;
							s.resists.SpellSeal = (s.resists.SpellSeal || 0) + 50;
							s.resists.HealSeal  = (s.resists.HealSeal  || 0) + 50;
						}
						
						// ★修正：極意系（elmAtk25）。syn.elm を直接参照して加算する
						if (syn.effect === 'elmAtk25' && syn.elm) {
							s.elmAtk[syn.elm] = (s.elmAtk[syn.elm] || 0) + 25;
						}

						// ★シナジーによるスキル習得 (深淵の刃など)
						if (syn.effect === 'grantSkill' && syn.value) {
							allSkillIds.add(syn.value);
						}
					});
				}
            }
        }

    // 3. スキルツリー補正
    const trees = char.unlockedTrees || char.tree;
    if (trees && CONST.SKILL_TREES) {
        for (let treeKey in trees) {
            const stepCount = trees[treeKey];
            const treeDef = CONST.SKILL_TREES[treeKey];
            if (!treeDef || !treeDef.steps) continue;

            for (let i = 0; i < stepCount; i++) {
                const step = treeDef.steps[i];
                if (!step) continue;

                if (step.stats) {
                    if (step.stats.hpMult)  pctMods.maxHp += step.stats.hpMult * 100;
                    if (step.stats.mpMult)  pctMods.maxMp += step.stats.mpMult * 100;
                    if (step.stats.atkMult) pctMods.atk   += step.stats.atkMult * 100;
                    if (step.stats.defMult) pctMods.def   += step.stats.defMult * 100;
					if (step.stats.defMult) pctMods.mdef   += step.stats.defMult * 100; //mdefもdefスキルツリー参照
                    if (step.stats.spdMult) pctMods.spd   += step.stats.spdMult * 100;
                    if (step.stats.magMult) pctMods.mag   += step.stats.magMult * 100;

                    if (step.stats.dmgMult) s.finDmg += step.stats.dmgMult * 100;

                    if (step.stats.allElmMult) {
                        CONST.ELEMENTS.forEach(e => {
                            s.elmAtk[e] = (s.elmAtk[e] || 0) + step.stats.allElmMult * 100;
                        });
                    }
                }
				
				// ★新規追加：ツリーによるスキル習得
                if (step.skillId) allSkillIds.add(step.skillId);
                if (step.skillIds) (Array.isArray(step.skillIds) ? step.skillIds : [step.skillIds]).forEach(id => allSkillIds.add(id));

                if (step.passive) {
                    if (step.passive === 'finRed10') s.finRed += 10;
                    else if (step.passive === 'hpRegen') s.hpRegen = true;
                    else if (step.passive === 'atkIgnoreDef') s.atkIgnoreDef = true;
                    else if (step.passive === 'magCrit') s.magCrit = true;
                    else if (step.passive === 'fastestAction') s.fastestAction = true;
                    else if (step.passive === 'doubleAction') s.doubleAction = true;
                }
            }

            // 旧形式ツリー救済（steps[0].stats が無いタイプ）
            if (treeDef.steps[0] && !treeDef.steps[0].stats) {
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

    // 4. 自己特性補正 (PassiveSkill.js)
    if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue) {
        pctMods.maxHp += PassiveSkill.getSumValue(char, 'hp_pct');
        pctMods.maxMp += PassiveSkill.getSumValue(char, 'mp_pct');
        pctMods.atk   += PassiveSkill.getSumValue(char, 'atk_pct');
        pctMods.def   += PassiveSkill.getSumValue(char, 'def_pct');
        pctMods.mdef  += PassiveSkill.getSumValue(char, 'mdef_pct');
        pctMods.spd   += PassiveSkill.getSumValue(char, 'spd_pct');
        pctMods.mag   += PassiveSkill.getSumValue(char, 'mag_pct');

        // hit/eva/cri は加算方針（％という名前でも“加算値”として運用）
        pctMods.hit   += PassiveSkill.getSumValue(char, 'hit_pct');
        pctMods.eva   += PassiveSkill.getSumValue(char, 'eva_pct');
        pctMods.cri   += PassiveSkill.getSumValue(char, 'cri_pct');
    }
	
	const resistKeys = [
	  'Fear','SkillSeal','SpellSeal','HealSeal','InstantDeath',
	  'Poison','ToxicPoison','Shock','Debuff'
	];

	resistKeys.forEach(rk => {
	  const v = PassiveSkill.getSumValue(char, 'resists_' + rk);
	  if (v) s.resists[rk] = (s.resists[rk] || 0) + v;
	});
	
	// --- calcStats の内部、オーラ判定の直前に配置 ---
	const getAuraVal = (entity, traitId, key) => {
		let totalLevel = 0;

		// 1. 本人が習得している特性 (disabledTraitsによるOFF設定を反映)
		const learned = entity.traits ? entity.traits.find(t => t.id === traitId) : null;
		if (learned && !(entity.disabledTraits && entity.disabledTraits.includes(traitId))) {
			totalLevel += (learned.level || 1);
		}

		// 2. 装備品に付いている特性 (常にON)
		if (entity.equips) {
			Object.values(entity.equips).forEach(eq => {
				if (eq && eq.traits) {
					eq.traits.forEach(t => {
						if (t.id === traitId) totalLevel += (t.level || 1);
					});
				}
			});
		}

		if (totalLevel === 0) return 0;
		const master = PassiveSkill.MASTER[traitId];
		return (master && master.params[key]) ? master.params[key] * totalLevel : 0;
	};

    // 5. オーラ系特性補正
		if (App.data && App.data.party && typeof PassiveSkill !== 'undefined') {
			const myPos = char.formation || 'front';

			App.data.party.forEach(uid => {
				const other = App.data.characters.find(c => c.uid === uid);
				if (!other || other.hp <= 0) return; // 生存チェック

				const otherPos = other.formation || 'front';

				// 37: 護衛 (発動:前列 -> 対象:後列)
				if (otherPos === 'front' && myPos === 'back') {
					pctMods.def += getAuraVal(other, 37, 'aura_back_def_pct');
				}
				
				// 38: 勇猛 (発動:前列 -> 対象:前列)
				if (otherPos === 'front' && myPos === 'front') {
					pctMods.atk += getAuraVal(other, 38, 'aura_front_atk_pct');
				}

				// 39: 応援 (発動:後列 -> 対象:前列)
				if (otherPos === 'back' && myPos === 'front') {
					pctMods.atk += getAuraVal(other, 39, 'aura_front_atk_pct');
				}

				// 40: 司令塔 (発動:後列 -> 対象:前列)
				if (otherPos === 'back' && myPos === 'front') {
					const hitVal = getAuraVal(other, 40, 'aura_front_hit_pct');
					const evaVal = getAuraVal(other, 40, 'aura_front_eva_pct');
					pctMods.hit += hitVal;
					pctMods.eva += evaVal;
				}
			});
		}

    // 最終計算（主要7ステは%乗算）
    s.maxHp = Math.floor(s.maxHp * (1 + pctMods.maxHp / 100));
    s.maxMp = Math.floor(s.maxMp * (1 + pctMods.maxMp / 100));
    s.atk   = Math.floor(s.atk   * (1 + pctMods.atk   / 100));
    s.def   = Math.floor(s.def   * (1 + pctMods.def   / 100));
    s.mdef  = Math.floor(s.mdef  * (1 + pctMods.mdef  / 100));
    s.spd   = Math.floor(s.spd   * (1 + pctMods.spd   / 100));
    s.mag   = Math.floor(s.mag   * (1 + pctMods.mag   / 100));

    // 命中・回避・会心は加算
    s.hit += pctMods.hit;
    s.eva += pctMods.eva;
    s.cri += pctMods.cri;
	
	// ★新規追加：習得スキルの書き戻し
    s.skills = Array.from(allSkillIds);

    return s;
},

    /**
     * レベルアップ処理
     */
    gainExp: (charData, expGain) => {
        if (!charData.exp) charData.exp = 0;
        charData.exp += expGain;
        let logs = [];
        
        // 転生回数による補正倍率の計算
        const reincMult = 1 + (charData.reincarnationCount || 0);
        
        // レベル上限100
        while (charData.level < 100) {
            // App.getNextExp 内で「大器晩成」の exp_need_mult が計算されている前提
            const nextExp = App.getNextExp(charData);
            if (charData.exp >= nextExp) {
                charData.exp -= nextExp;
                charData.level++;
				
                // DBの基礎値を取得
                const master = (window.CHARACTERS_DATA || []).find(c => c.id === charData.charId) || charData;

                // 成長率: 4% 〜 8%
                const minRate = 0.04;
                const maxRate = 0.08;
                const r = () => minRate + Math.random() * (maxRate - minRate);

                // --- 特性による成長補正値の取得 ---
                let statBonus = 0; // 全ステータス用 (大器晩成)
                let atkBonus = 0;  // 攻撃力用 (武の極み)
                let defBonus = 0;  // 防御力用 (武の極み)
                let magBonus = 0;  // 魔力用 (魔の極み)
                let mdefBonus = 0; // 魔法防御用 (魔の極み)

                if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue) {
                    // ID 58 大器晩成: stat_bonus_mult は 0.1(10%) 単位
                    statBonus = PassiveSkill.getSumValue(charData, 'stat_bonus_mult');
                    
                    // ID 59 武の極み: 1(1%) 単位
                    atkBonus = PassiveSkill.getSumValue(charData, 'atk_growth_bonus') / 100;
                    defBonus = PassiveSkill.getSumValue(charData, 'def_growth_bonus') / 100;
                    
                    // ID 60 魔の極み: 1(1%) 単位
                    magBonus = PassiveSkill.getSumValue(charData, 'mag_growth_bonus') / 100;
                    mdefBonus = PassiveSkill.getSumValue(charData, 'mdef_growth_bonus') / 100;
                }

                // 各倍率の決定 (1.0 + 全体ボーナス + 個別ボーナス)
                const hpMult   = 1.0 + statBonus;
                const mpMult   = 1.0 + statBonus;
                const atkMult  = 1.0 + statBonus + atkBonus;
                const defMult  = 1.0 + statBonus + defBonus;
                const magMult  = 1.0 + statBonus + magBonus;
                const mdefMult = 1.0 + statBonus + mdefBonus;
                const spdMult  = 1.0 + statBonus;

                // 各ステータス上昇量の計算
                const incHp   = Math.max(1, Math.floor(((master.hp || 100) * reincMult) * r() * 2 * hpMult));
                const incMp   = Math.max(1, Math.floor(((master.mp || 50)  * reincMult) * r() * mpMult));
                const incAtk  = Math.max(1, Math.floor(((master.atk || 10) * reincMult) * r() * atkMult));
                const incDef  = Math.max(1, Math.floor(((master.def || 10) * reincMult) * r() * defMult));
                const incMdef = Math.max(1, Math.floor(((master.mdef || 10)* reincMult) * r() * mdefMult));
                const incSpd  = Math.max(1, Math.floor(((master.spd || 10) * reincMult) * r() * spdMult));
                const incMag  = Math.max(1, Math.floor(((master.mag || 10) * reincMult) * r() * magMult));

                // ステータス加算
                charData.hp += incHp;
                charData.mp += incMp;
                charData.atk += incAtk;
                charData.def += incDef;
                charData.mdef += incMdef;
                charData.spd += incSpd;
                charData.mag += incMag;
                
                // SP加算
                if (charData.sp === undefined) charData.sp = 0;
                charData.sp++; 
                
                // HP/MP全回復
                const stats = App.calcStats(charData);
                charData.currentHp = stats.maxHp;
                charData.currentMp = stats.maxMp;

                let logMsg = `${charData.name}はLv${charData.level}になった！<br>HP+${incHp}, 攻+${incAtk}, 魔防+${incMdef}...`;
				
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
				
				// 特性習得チェックの呼び出し
				if (typeof PassiveSkill !== 'undefined' && PassiveSkill.applyLevelUpTraits) {
					const traitLog = PassiveSkill.applyLevelUpTraits(charData);
					if (traitLog) logs.push(traitLog); // 特性習得ログをリザルトに追加
				}
                
                logs.push(logMsg);
            } else { break; }
        }
        App.save();
        return logs;
    },

	/* main.js: App.createEquipByFloor 関数 */
	createEquipByFloor: (source, floor = null, fixedPlus = null) => {
		const targetFloor = (floor !== null) ? floor : App.getVirtualFloor();
		
		// 1. 参照するRankを決定
		const targetRank = Math.min(200, targetFloor);
		
		// 2. 候補を抽出（noRandom:true は除外。未指定は false 扱い）
		const pool = window.EQUIP_MASTER.filter(e => !e.noRandom);

		let candidates;

		// ★201階以降は Rank1〜200 をフルプール（偏り防止）
		if (targetFloor > 200) {
		  candidates = pool.filter(e => e.rank >= 1 && e.rank <= 200);
		} else {
		  // 従来ロジック（ただし noRandom 除外済み pool を使う）
		  candidates = pool.filter(e => e.rank <= targetRank && e.rank >= Math.max(1, targetRank - 15));
		  if (candidates.length === 0) candidates = pool.filter(e => e.rank <= targetRank);
		  if (candidates.length === 0) candidates = [pool[0]];
		}

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
			possibleOpts: base.possibleOpts || [],
			traits: [] // 特性格納用
		};
		
		eq.traits = (base.traits ? JSON.parse(JSON.stringify(base.traits)) : []);
		eq.grantSkills = (base.grantSkills ? JSON.parse(JSON.stringify(base.grantSkills)) : []);

		// ★基礎ステータス倍率（+1/+2/+3）は主要ステのみ対象
		const plusMults = { 0: 1.0, 1: 1.1, 2: 1.3, 3: 1.5 };
		const mult = plusMults[plus] || 1.0;

		// 真・装備化と同一基準
		const BASE_SCALE_KEYS = new Set([
		  'atk', 'def', 'mag', 'mdef', 'spd', 'hp', 'mp'
		]);

		if (mult > 1.0) {
		  for (let key of BASE_SCALE_KEYS) {
			if (typeof eq.data[key] === 'number') {
			  eq.data[key] = Math.floor(eq.data[key] * mult);
			}
		  }
		}

		// 5. 201階以降の「真・装備」化
		if (targetFloor > 200) {
			eq.name = "真・" + base.name;
			const scale = (targetFloor * 1.5) / base.rank;

			const TRUE_SCALE_KEYS = new Set(['atk','def','mag','mdef','spd','hp','mp']);

			for (let key in eq.data) {
				if (!TRUE_SCALE_KEYS.has(key)) continue;
				if (typeof eq.data[key] === 'number') {
					eq.data[key] = Math.floor(eq.data[key] * scale);
				}
			}
			eq.val = Math.floor(eq.val * scale);

			// ★真・装備：特性を 1〜3個、Lv1〜5 で付与（固定traitsは維持してマージ）
			if (typeof PassiveSkill !== 'undefined' && PassiveSkill.generateEquipmentTraits) {
				const randTraits = PassiveSkill.generateEquipmentTraits({ countMin: 1, countMax: 3, lvMin: 1, lvMax: 5 });
				eq.traits = [...(eq.traits || []), ...(randTraits || [])];
			}
		}

		// 6. オプション付与
		if (plus > 0) {
			const BASE_OPTS_MAP = {
				'剣': ['atk', 'hit', 'cri', 'finDmg', 'elmAtk'],
				'斧': ['atk', 'finDmg', 'elmAtk', 'attack_Fear'],
				'槍': ['atk', 'hit', 'finDmg'],
				'短剣': ['atk', 'mag', 'eva', 'cri', 'finDmg', 'elmAtk', 'attack_Poison'],
				'弓': ['atk', 'hit', 'cri', 'finDmg'],
				'杖': ['mag', 'finDmg', 'elmAtk'],
				'盾': ['def', 'mdef', 'eva', 'finRed', 'elmRes', 'resists_Debuff'],
				'腕輪': ['atk', 'mag', 'spd', 'def', 'mdef', 'hit', 'eva', 'cri', 'finDmg'],
				'兜': ['hp', 'mp', 'def', 'mdef', 'resists_Fear', 'resists_SkillSeal'],
				'帽子': ['hp', 'mp', 'mag', 'mdef', 'elmRes', 'resists_SpellSeal'],
				'鎧': ['hp', 'mp', 'def', 'mdef', 'finRed', 'resists_Poison'],
				'ローブ': ['hp', 'mp', 'def', 'mdef', 'mag', 'elmAtk', 'elmRes', 'resists_SpellSeal'],
				'ブーツ': ['spd', 'def', 'mdef', 'eva', 'resists_Shock'],
				'くつ': ['spd', 'hit', 'eva', 'finDmg', 'resists_Shock']
			};
			let baseDefaults = BASE_OPTS_MAP[eq.baseName] || [];
			let masterOpts = base.possibleOpts || [];
			let allowedKeys = [...new Set([...baseDefaults, ...masterOpts])];

			for(let i=0; i<plus; i++) {
				let optCandidates = DB.OPT_RULES.filter(rule => allowedKeys.includes(rule.key));
				if (optCandidates.length === 0) optCandidates = DB.OPT_RULES;
				const rule = optCandidates[Math.floor(Math.random() * optCandidates.length)];
				let rarity = 'N';
				const tierRatio = Math.min(1, targetFloor / 200);
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

		// 7. 特性およびシナジーの判定
		if (plus >= 3) {
		  if (typeof PassiveSkill !== 'undefined' && PassiveSkill.generateEquipmentTraits) {
			const randTraits = PassiveSkill.generateEquipmentTraits();
			// 固定 + ランダムを結合（同IDが被ったら加算するか、どちらか優先するかは好み）
			eq.traits = [...(eq.traits || []), ...(randTraits || [])];
		  }

			const syns = App.checkSynergy(eq);
			if (syns && syns.length > 0) {
				eq.isSynergy = true;
				eq.effects = syns.map(s => s.effect);
				eq.synergies = syns;
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
		
		// ★修正: 主人公(ID 301)の場合のみ storyStep を加算して表示
        let lbVal = c.limitBreak || 0;
        if (c.charId === 301 && App.data && App.data.progress) {
            lbVal += (App.data.progress.storyStep || 0);
        }
		
        return `
            <div class="char-row">
                <div class="char-thumb">${imgTag}</div>
                <div class="char-info">
                    <div class="char-name">${c.name} <span class="rarity-${c.rarity}">[${c.rarity}]</span> +${lbVal}</div>
                    <div class="char-meta">${c.job} Lv.${c.level}</div>
                    <div class="char-stats">
                        <span style="color:#f88;">HP:${hp}/${s.maxHp}</span>
                        <span style="color:#88f;">MP:${mp}/${s.maxMp}</span>
                        <span>攻:${s.atk}</span> <span>防:${s.def}</span> <span>魔:${s.mag}</span> <span>速:${s.spd}</span>
                    </div>
                </div>
            </div>`;
    },

	/**
	 * 次のレベルまでに必要な経験値を返す
	 *
	 * 設計方針：
	 * - Lv1〜10   ：超軽い（チュートリアル帯）
	 * - Lv11〜49  ：ゆるやかに重くなる（50スキル前の育成）
	 * - Lv50      ：壁（強スキル解放）
	 * - Lv51〜99  ：じわじわ重い（転生前のやり込み）
	 * - Lv100     ：大きな壁（転生条件）
	 * - Lv101〜   ：転生帯（後で調整前提）
	 *
	 * ※ 転生時は「表示Lv1に戻る」が、
	 *    内部的には effectiveLevel = level + 転生回数*100 で扱う
	 */
	getNextExp: (charData) => {

		/* =====================================================
		 * 基本情報
		 * ===================================================== */

		// 基本となる経験値（Lv1→2 が 100 になる）
		const BASE_EXP = CONST.EXP_BASE || 100;

		// 現在レベル（表示レベル）
		const level = charData.level || 1;

		// 転生回数
		const reincCount = charData.reincarnationCount || 0;

		// 実質レベル（転生を考慮した内部レベル）
		// 例：転生1回・表示Lv1 => eL=101
		const eL = level + reincCount * 100;

		// レアリティ倍率（N/R=1.0, SR=1.4, SSR=1.6, UR=2.0, EX=2.5）
		// ※ CONST 側にマップが無い場合は 1.0 扱い
		const rarityMult =
			(CONST.RARITY_EXP_MULT && CONST.RARITY_EXP_MULT[charData.rarity]) || 1.0;


		/* =====================================================
		 * 調整用パラメータ（ここを触れば体感が変わる）
		 * ===================================================== */


		// --- 序盤（1〜10）：超軽い ---
		// 小さいほど序盤がさらに軽くなる（1.00〜1.15くらいが調整しやすい）
		const P_EARLY = 0.8;

		// --- 11〜49：49直前をどう重くするか（ターゲット） ---
		// eL=49 の必要経験値（49→50の直前）
		const TARGET_49 = 30000;

		// --- 壁の強さ（段差はキツくてOK方針） ---
		// 49→50 の壁倍率（例：1.8なら 49の1.8倍）
		const WALL_50 = 5;

		// 99→100 の壁倍率（転生条件の壁）
		const WALL_100 = 5;

		// --- 50〜99：転生前の成長（ターゲット） ---
		// eL=99 の必要経験値（99→100の直前）
		const TARGET_99 = 150000;

		// 50以降の成長指数（大きいほど99付近が重くなる）
		const P_AFTER_50 = 1.3;

		// --- 101+（転生帯）：仮置き（後で調整前提） ---
		const P_REINC = 0.6;

		// 101の増加分（100の何％を足し幅の基準にするか）
		const REINC_STEP_RATE = 0.05; // 5.0%

		// ------------------------------------------------------------
		// 注意：このツールは「壁スパイク方式」です。
		// Lv50 と Lv100 だけ ×WALL を適用し、次レベルで壁を剥がした基準に戻ります。
		// （49→50はキツい / 50→51は一度下がってまた上昇）
		// ------------------------------------------------------------


		/* =====================================================
		 * 事前計算（境界の値を作る）
		 * ===================================================== */

		// --- eL=10 ---
		const xp10 = BASE_EXP * Math.pow(10, P_EARLY);

		// --- eL=11〜49（二次） ---
		const B = (TARGET_49 - xp10) / Math.pow(49 - 10, 2);
		const xp49 = xp10 + B * Math.pow(49 - 10, 2); // ≒ TARGET_49

		// ★壁は「そのレベルだけ」適用した表示用
		const xp50_wall = xp49 * WALL_50; // 50だけスパイク

		// ★50以降の基準（壁を剥がした起点）は xp49 のまま
		const base50 = xp49;

		// --- eL=51〜99（べき乗：基準base50からTARGET_99へ） ---
		const S = (TARGET_99 - base50) / Math.pow(99 - 50, P_AFTER_50);
		const xp99 = base50 + S * Math.pow(99 - 50, P_AFTER_50); // ≒ TARGET_99

		// ★100も「そのレベルだけ」壁
		const xp100_wall = xp99 * WALL_100;

		// ★100以降の基準（壁剥がし）は xp99
		const base100 = xp99;

		/* =====================================================
		 * 実際の必要経験値の計算
		 * ===================================================== */

		let needExp;

		if (eL <= 10) {
		  needExp = BASE_EXP * Math.pow(eL, P_EARLY);

		} else if (eL <= 49) {
		  needExp = xp10 + B * Math.pow(eL - 10, 2);

		} else if (eL === 50) {
		  // ★50はスパイクだけ
		  needExp = xp50_wall;

		} else if (eL <= 99) {
		  // ★51〜99は壁なし基準（base50）から上がっていく
		  needExp = base50 + S * Math.pow(eL - 50, P_AFTER_50);

		} else if (eL === 100) {
		  // ★100もスパイクだけ
		  needExp = xp100_wall;

		} else {
		  // ★101+ は壁を剥がした基準（base100）から成長
		  const step101 = base100 * REINC_STEP_RATE;
		  needExp = base100 + step101 * Math.pow(eL - 100, P_REINC);
		}

		/* =====================================================
		 * 特性補正：「58 大器晩成」の反映
		 * ===================================================== */
		// 特性による必要経験値の増加率を取得（スキルLv * 10%）
		if (typeof PassiveSkill !== 'undefined' && PassiveSkill.getSumValue) {
			// 修正後のキー 'exp_need_mult' を指定して合計値を取得
			const expAddPct = PassiveSkill.getSumValue(charData, 'exp_need_mult');
			if (expAddPct > 0) {
				// 例: スキルLv1(10%)なら、必要経験値を1.1倍にする
				needExp = needExp * (1 + expAddPct / 100); 
			}
}

		/* =====================================================
		 * 最終出力
		 * ===================================================== */
		// レアリティ倍率を反映して切り上げ
		return Math.ceil(needExp * rarityMult);
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
		
		// ★修正点: エラー回避のため、現在のエリアキーを取得しておく
        const areaKey = Field.getCurrentAreaKey();

        if (Field.currentMapData) {
            if (nx < 0 || nx >= Field.currentMapData.width || ny < 0 || ny >= Field.currentMapData.height) return;
            
			//let tile = Field.currentMapData.tiles[ny][nx].toUpperCase();
			// ★修正: 書き換えられたタイルがあればそれを優先、なければ元のタイルを参照
			let tile = (App.data.progress.mapChanges?.[areaKey]?.[`${nx},${ny}`] || Field.currentMapData.tiles[ny][nx]).toUpperCase();

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
                    App.log("洞窟の入口だ");
                    App.setAction("洞窟に入る", () => Dungeon.startFixed('START_CAVE'));
				}
            }
			
			
			// ★修正点: 判定ロジックを1つに統合し、ReferenceErrorを防止
            if (tile === 'V' || tile === 'H' || tile === 'B') {
                if (typeof StoryManager !== 'undefined') {
                    // 判定用の現在値を数値として取得
                    const currentStep = Number(App.data.progress.storyStep);
                    const currentSub = Number(App.data.progress.subStep || 0);

                    // トリガーを検索 (stepMin/Max, subMin/Max に完全対応)
                    const trigger = StoryManager.triggers.find(t => {
                        const areaMatch = t.area === App.data.location.area;
                        const posMatch = Number(t.x) === Number(nx) && Number(t.y) === Number(ny);
                        
                        // ★修正: (t.stepMax || 999) をやめて厳密に undefined チェックを行う
                        const stepMatch = (t.step !== undefined) 
                            ? (Number(t.step) === currentStep)
                            : (currentStep >= (t.stepMin !== undefined ? t.stepMin : 0) && 
                               currentStep <= (t.stepMax !== undefined ? t.stepMax : 999));
                        
                        const subMatch = (t.sub !== undefined)
                            ? (Number(t.sub) === currentSub)
                            : (currentSub >= (t.subMin !== undefined ? t.subMin : 0) && 
                               currentSub <= (t.subMax !== undefined ? t.subMax : 999));

                        return areaMatch && posMatch && stepMatch && subMatch;
                    });

                    if (trigger) {
                        // 条件に合うイベントが見つかれば「話す」または「調べる」アクションをセット
                        const actionLabel = (tile === 'B') ? "戦う" : "話す";
                        App.setAction(actionLabel, () => StoryManager.executeEvent(trigger.eventId));
                    } else {
                        // 座標は合っているが、Step/Sub条件が満たされていない場合
                        App.log("誰かいるようだ。");
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
                // --- エンカウント判定ロジック ---
                let rate = 0.03; if (App.data.walkCount > 15) rate = 0.06;
                
                let ambushPrevention = 0; // ID 41: 警戒 (敵の不意打ちを防ぐ)
                let preemptiveBonus = 0;  // ID 42: 忍び足 (こちらの先制率を上げる)
                
                if (typeof PassiveSkill !== 'undefined') {
                    // ★修正: 集計対象を編成メンバーのみに限定
                    App.data.party.forEach(uid => {
                        const c = App.data.characters.find(char => char.uid === uid);
                        if (c) {
                            // 習得済み特性(ON/OFF考慮)および装備品の特性を合算
                            ambushPrevention += PassiveSkill.getSumValue(c, 'ambush_prevent_pct');
                            preemptiveBonus += PassiveSkill.getSumValue(c, 'ambush_chance_pct');
                        }
                    });
                }
                
                // ★修正: 「忍び足」がエンカウント率（rate）を下げていた処理を削除
                // エンカウント率自体は 0.03 / 0.06 のまま進行します

                if(Math.random() < rate) { 
                    App.data.walkCount = 0; 
                    App.log("敵だ！"); 
                    
                    let isAmbushed = (Math.random() < 0.10); // 基礎10%で敵の不意打ち
                    let isPreemptive = (Math.random() < 0.10); // 基礎10%でこちらの先制攻撃

                    // 1) 警戒特性 (ID 41) による不意打ち防止判定
                    if (isAmbushed && Math.random() * 100 < ambushPrevention) {
                        isAmbushed = false;
                        App.log("<span style='color:#88f;'>「警戒」により不意打ちを防いだ！</span>");
                    }

                    // 2) 忍び足特性 (ID 42) による先制確率上昇判定
                    // まだ先制になっていない場合、特性の合計値(%)の確率で先制に書き換える
                    if (!isAmbushed && !isPreemptive && Math.random() * 100 < preemptiveBonus) {
                        isPreemptive = true;
                        App.log("<span style='color:#8f8;'>「忍び足」により先制攻撃のチャンス！</span>");
                    }
                    
                    // 両方同時に起きないように最終調整
                    if (isAmbushed) isPreemptive = false;

                    // バトルデータにフラグをセット
                    App.data.battle = { 
                        isAmbushed: isAmbushed, 
                        isPreemptive: isPreemptive 
                    };
                    
                    setTimeout(() => App.changeScene('battle'), 500); 
                }
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
		
		// ★修正点: エラー回避のため、現在のエリアキーを取得しておく
        const areaKey = Field.getCurrentAreaKey();

        for (let dy = -rangeY; dy <= rangeY; dy++) {
            for (let dx = -rangeX; dx <= rangeX; dx++) {
                const drawX = Math.floor(cx + (dx * ts) - (ts / 2)), drawY = Math.floor(cy + (dy * ts) - (ts / 2));
                let tx = Field.x + dx, ty = Field.y + dy, tile = 'W';
                if (Field.currentMapData) { 
                    if (tx >= 0 && tx < mapW && ty >= 0 && ty < mapH) {
						// ★修正点: エラーが出た行。定義した areaKey を使用し、動的なマップ変更を反映
                        const posKey = `${tx},${ty}`;
                        const changedTile = App.data.progress.mapChanges?.[areaKey]?.[posKey];
						
                        // ★修正: mapChanges を参照
						tile = App.data.progress.mapChanges?.[areaKey]?.[`${tx},${ty}`] || Field.currentMapData.tiles[ty][tx];
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
                        //mtile = Field.currentMapData.tiles[mty][mtx]; 
                        const ak = Field.getCurrentAreaKey(); 
						const pk = `${mtx},${mty}`;
                        
						// ★修正: ミニマップでも書き換え後のタイル(mapChanges)を最優先で参照する
                        mtile = App.data.progress.mapChanges?.[areaKey]?.[pk] || Field.currentMapData.tiles[mty][mtx];
						
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
