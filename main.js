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
        this.isSpecialBoss = data.isSpecialBoss || false;
        this.isRare = data.isRare || false;

        this.job = data.job || '冒険者';
        this.rarity = data.rarity || 'N';
        this.level = data.level || 1;
		
		// ★画像読み込みロジックの修正
        // data.img（セーブデータ/個別データ）があればそれを、
        // なければマスタデータ（characters.js）からIDを元に探す
        const master = DB.CHARACTERS.find(c => c.id === (data.charId || data.id));
        this.img = data.img || data.image || (master ? master.img : null);
        this.image = data.image || this.img || null;
		
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
        this.config = data.config || { fullAuto: false, hiddenSkills: [], strategy: 'balanced' };
        
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
        
        // Legacy monster tables used to need an early-floor tune. New MonsterData is already balanced.
        let hpMod = 1.0;
        let statMod = 1.0;
        
        if (data.legacyLowFloorTune && data.rank && data.rank <= 30) {
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
        this.isBoss = data.isBoss || false;
        this.isRare = data.isRare || false;
        this.isEstark = data.isEstark || false;
        this.isSpecialBoss = data.isSpecialBoss || data.isEstark || false;
        this.image = data.image || data.img || null;
        
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
	encounterTransitioning: false,

    defaultBattleStrategy: 'balanced',
    battleStrategies: {
        allout: { label: 'ガンガンいこうぜ' },
        balanced: { label: 'バッチリがんばれ' },
        conserve: { label: 'せつやくしようぜ' },
        tricky: { label: 'いろいろやろうぜ' },
        defensive: { label: 'いのちだいじに' },
        no_mp: { label: 'ＭＰつかうな' }
    },

    getCharacterMaster: (charOrId) => {
        const id = (charOrId && typeof charOrId === 'object')
            ? (charOrId.charId || charOrId.id)
            : charOrId;
        if (!id) return null;
        const list = (typeof DB !== 'undefined' && DB.CHARACTERS) ? DB.CHARACTERS : (window.CHARACTERS_DATA || []);
        return list.find(c => c.id === id) || null;
    },

    getDefaultFaceIconPath: (charOrId) => {
        const id = (charOrId && typeof charOrId === 'object')
            ? (charOrId.charId || charOrId.id)
            : charOrId;
        return id ? `assets/characters/face/${id}.png` : null;
    },

    isDefaultCharacterImagePath: (src) => {
        if (!src || typeof src !== 'string') return false;
        return /(^|\/)assets\/characters\/(char_face_[^/]+\.gif|face\/[^/]+\.png)$/i.test(src);
    },

    hasCustomCharacterImage: (char) => {
        if (!char || !char.img) return false;
        if (char.customImage === true || char.hasCustomImage === true) return true;
        const master = App.getCharacterMaster(char);
        if (master && char.img === master.img) return false;
        if (App.isDefaultCharacterImagePath(char.img)) return false;
        return /^data:image\//i.test(char.img) || !/^assets\/characters\//i.test(char.img);
    },

    getCharacterDisplayImage: (charOrId) => {
        const char = (charOrId && typeof charOrId === 'object') ? charOrId : null;
        if (char && App.hasCustomCharacterImage(char)) return char.img;
        return App.getDefaultFaceIconPath(charOrId) || App.getCharacterImageFallback(charOrId);
    },

    getCharacterImageFallback: (charOrId) => {
        const char = (charOrId && typeof charOrId === 'object') ? charOrId : null;
        const master = App.getCharacterMaster(charOrId);
        return (master && master.img) || (char && char.img) || '';
    },

    getCharacterImageOnErrorAttr: (charOrId) => {
        const fallback = App.getCharacterImageFallback(charOrId);
        const current = App.getCharacterDisplayImage(charOrId);
        if (!fallback || fallback === current) return '';
        const safeFallback = String(fallback).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
        return ` onerror="this.onerror=null;this.src='${safeFallback}';"`;
    },

    unlockDefaults: {
        smith: true,
        gacha: true,
        abyss: true,
        teleport: true,
        casino: true,
        medalKing: true,
        boat: true,
        wing: true,
        fixedDungeonEndless: true
    },

    unlockLabels: {
        smith: '鍛冶屋',
        gacha: 'ガチャ',
        abyss: '深淵の魔窟',
        teleport: '宿屋の転送',
        casino: 'カジノ',
        medalKing: 'メダル交換',
        boat: '魔法の小舟',
        wing: '光の翼',
        fixedDungeonEndless: '固定ダンジョンの探索'
    },

    getDefaultUnlockState: () => {
        return { ...App.unlockDefaults };
    },

    ensureUnlockState: () => {
        if (!App.data) return {};
        if (!App.data.progress) App.data.progress = {};
        if (!App.data.progress.unlocked || typeof App.data.progress.unlocked !== 'object' || Array.isArray(App.data.progress.unlocked)) {
            App.data.progress.unlocked = {};
        }

        Object.keys(App.unlockDefaults).forEach(key => {
            if (App.data.progress.unlocked[key] === undefined || App.unlockDefaults[key] === true) {
                App.data.progress.unlocked[key] = App.unlockDefaults[key];
            }
        });

        return App.data.progress.unlocked;
    },

    ensureCharacterBattleConfig: (char) => {
        if (!char) return null;
        if (!char.config || typeof char.config !== 'object' || Array.isArray(char.config)) {
            char.config = {};
        }
        if (!Array.isArray(char.config.hiddenSkills)) char.config.hiddenSkills = [];
        if (typeof char.config.fullAuto !== 'boolean') char.config.fullAuto = false;
        if (!App.battleStrategies[char.config.strategy]) {
            char.config.strategy = App.defaultBattleStrategy;
        }
        return char.config;
    },

    getBattleStrategy: (char) => {
        const config = App.ensureCharacterBattleConfig(char);
        return config ? config.strategy : App.defaultBattleStrategy;
    },

    getBattleStrategyLabel: (key) => {
        return App.battleStrategies[key]?.label || App.battleStrategies[App.defaultBattleStrategy].label;
    },

    setBattleStrategy: (uid, strategy) => {
        if (!App.battleStrategies[strategy]) strategy = App.defaultBattleStrategy;
        const char = App.getChar ? App.getChar(uid) : null;
        if (!char) return false;
        App.ensureCharacterBattleConfig(char);
        char.config.strategy = strategy;
        if (typeof App.save === 'function') App.save();
        return true;
    },

    // --- 初期データ構造の定義 ---
    // セーブデータが全くない場合や、マイグレーション時のデフォルト参照用
    getInitialData: () => {
        return {
            location: { area: 'START_VILLAGE', x: 6, y: 4 },
            progress: { 
                floor: 0, 
                storyStep: 0, 
                flags: {}, 
                unlocked: App.getDefaultUnlockState(),
                clearedDungeons: [],
                openedChests: {},  
                defeatedBosses: {},
                visitedFixedMaps: {} 
            },
            inventory: [],
            items: { "1": 3 }, 
            characters: [
                { uid: 'p1', charId: 301, name: 'アルス', job: '勇者', level: 1, exp: 0, hp: 50, mp: 20, atk: 15, def: 10, mag: 10, spd: 10, equips: { '武器':null, '盾':null, '頭':null, '体':null, '足':null }, sp: 0, tree: {}, config: { fullAuto: false, hiddenSkills: [], strategy: 'balanced' } }
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
                // 固定マップの場合、座標が現在のマップの範囲内か判定。
                // 複数階固定ダンジョンは MapRegistry から現在階の実体を取得する。
                const mapDef = isFixed
                    ? FIXED_MAPS[area]
                    : (typeof MapRegistry !== 'undefined' && MapRegistry.getFixedDungeonFloor
                        ? MapRegistry.getFixedDungeonFloor(area, App.data.progress?.floor || 1)
                        : FIXED_DUNGEON_MAPS[area]);
                if (mapDef && mapDef.width !== undefined && mapDef.height !== undefined &&
                    (loc.x < 0 || loc.x >= mapDef.width || loc.y < 0 || loc.y >= mapDef.height)) {
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
            if (!App.data.progress.unlocked || typeof App.data.progress.unlocked !== 'object' || Array.isArray(App.data.progress.unlocked)) App.data.progress.unlocked = {};
            if (!App.data.progress.clearedDungeons) App.data.progress.clearedDungeons = [];
            if (!App.data.progress.openedChests) App.data.progress.openedChests = {};
            if (!App.data.progress.defeatedBosses) App.data.progress.defeatedBosses = {};
            if (!App.data.progress.visitedFixedMaps || typeof App.data.progress.visitedFixedMaps !== 'object' || Array.isArray(App.data.progress.visitedFixedMaps)) App.data.progress.visitedFixedMaps = {};
        }

        App.ensureUnlockState();

        // 既存セーブ救済: 固有MAP内で再開した場合は、そのMAPを発見済みにする。
        if (App.data.location && App.data.progress && typeof App.discoverFixedMap === 'function') {
            const currentArea = App.data.location.area;
            const isCurrentFixedMap = (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[currentArea]) ||
                (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[currentArea]);
            if (isCurrentFixedMap) App.discoverFixedMap(currentArea, { save: false, silent: true });
        }

        // 3. stats の補完
        if (!App.data.stats) {
            App.data.stats = JSON.parse(JSON.stringify(initial.stats));
        } else {
            if (App.data.stats.wipeoutCount === undefined) App.data.stats.wipeoutCount = 0;
            if (!App.data.stats.maxDamage) {
			  App.data.stats.maxDamage = { val: 0, actor: '未記録', actorLv: null, skill: '-', time: null };
			} else {
			  if (App.data.stats.maxDamage.actorLv === undefined) App.data.stats.maxDamage.actorLv = null;
			  if (App.data.stats.maxDamage.time === undefined) App.data.stats.maxDamage.time = null;
			}
        }

        // 4. book の補完
        if (!App.data.book) App.data.book = { monsters: [], killCounts: {} };

        // 5. dungeon の補完
        if (!App.data.dungeon) App.data.dungeon = JSON.parse(JSON.stringify(initial.dungeon));
        if (App.data.transportMode === undefined) App.data.transportMode = null;
        if (App.data.mapReturnPoint === undefined) App.data.mapReturnPoint = null;

        // 6. キャラクターの個別補完
        if (App.data.characters) {
            App.data.characters.forEach(c => {
                App.ensureCharacterBattleConfig(c);
                if (c.sp === undefined) c.sp = 0;
				if (c.exp === undefined) c.exp = 0; // ★この行を追加
                if (!c.tree) c.tree = {};
            });
        }
		
		// ★追加: 7. blacksmith の補完
        if (!App.data.blacksmith) {
            App.data.blacksmith = { level: 1, exp: 0 };
        }
		
		if (App.data) {
			if (!App.data.stats) App.data.stats = {};
			if (App.data.stats.totalMedals == null) App.data.stats.totalMedals = 0;
		}
		
        // 修正結果を一度保存
        App.save();
    },
	
	totalGoldGem: () => {
	// --- DataFix: stats項目の補完 ---
	if (!App.data.stats) App.data.stats = {};
	if (App.data.stats.totalGoldEarned == null) App.data.stats.totalGoldEarned = 0;
	if (App.data.stats.totalGemsEarned == null) App.data.stats.totalGemsEarned = 0;

	// --- gold/gems を "増分だけ累計に加算する" アクセサにする ---
	const hookCurrency = (key, statKey) => {
	  const internalKey = "_" + key;

	  // ★すでにフック済みなら何もしない
	  if (Object.getOwnPropertyDescriptor(App.data, key)?.get) return;

	  if (App.data[internalKey] == null) App.data[internalKey] = App.data[key] || 0;

	  Object.defineProperty(App.data, key, {
		enumerable: true,
		configurable: true,
		get() { return App.data[internalKey] || 0; },
		set(v) {
		  const prev = App.data[internalKey] || 0;
		  const next = Math.max(0, Math.floor(Number(v) || 0));
		  const diff = next - prev;
		  if (diff > 0) App.data.stats[statKey] = (App.data.stats[statKey] || 0) + diff;
		  App.data[internalKey] = next;
		}
	  });
	};

	hookCurrency("gold", "totalGoldEarned");
	hookCurrency("gems", "totalGemsEarned");
    },

	/*
	 * ローディング中の重要画像先読み。
	 * 目的: Service Worker が初回install中でも、現在のページ側でガチャカード/施設背景/
	 *       序盤モンスター/戦闘背景を先に取りに行き、初回描画の空白を減らす。
	 *
	 * 注意:
	 * - ここでは座標・セーブ・ゲーム進行は一切触らない。
	 * - 画像リストの正本は assets.js の PRISMA_ASSETS.cacheWarmup.startupImages。
	 * - 長時間待ちすぎると起動体験が悪くなるため、短いタイムアウト付きで実行する。
	 */
	preloadStartupImages: async () => {
		if (typeof window === 'undefined' || !window.PRISMA_ASSETS || !window.PRISMA_ASSETS.cacheWarmup) return;

		const urls = Array.from(new Set((window.PRISMA_ASSETS.cacheWarmup.startupImages || []).filter(Boolean)));
		if (!urls.length) return;

		const timeoutMs = 2400;
		const concurrency = 6;
		let index = 0;

		const loadOne = (src) => new Promise((resolve) => {
			const img = new Image();
			img.onload = () => resolve(true);
			img.onerror = () => resolve(false);
			img.src = src;
		});

		const worker = async () => {
			while (index < urls.length) {
				const src = urls[index++];
				await loadOne(src);
			}
		};

		const preloadTask = Promise.allSettled(
			Array.from({ length: Math.min(concurrency, urls.length) }, worker)
		);

		const timeoutTask = new Promise((resolve) => setTimeout(resolve, timeoutMs));
		await Promise.race([preloadTask, timeoutTask]);
	},

	/*
	 * 起動後の画像ウォームキャッシュ。
	 * 画像パス一覧は assets.js の PRISMA_ASSETS.cacheWarmup に統一する。
	 * main.js / sw.js 側にモンスター画像や戦闘背景の全量リストを増やさないこと。
	 *
	 * 目的:
	 * - 起動時は画像全量を待たずにゲームを開始する。
	 * - ゲーム開始後、Service Worker に裏側キャッシュを依頼する。
	 * - 初戦闘や次回起動時に画像読み込み待ちが出にくくなる。
	 */
	warmImageCache: () => {
		if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
		if (typeof window === 'undefined' || !window.PRISMA_ASSETS || !window.PRISMA_ASSETS.cacheWarmup) return;

		const payload = window.PRISMA_ASSETS.cacheWarmup;
		const send = (registration) => {
			const target = (registration && registration.active) || navigator.serviceWorker.controller;
			if (!target || !target.postMessage) return;
			target.postMessage({
				type: 'PRISMA_WARM_CACHE',
				payload
			});
		};

		// 初回installで取りこぼした画像を早めに再試行する。
		// 実際のキャッシュ速度制御は sw.js の batchSize / delayMs で行う。
		navigator.serviceWorker.ready
			.then((registration) => {
				setTimeout(() => send(registration), 100);
			})
			.catch(() => {});
	},

	initGameHub: () => {
		const finishLoadingAndWarmCache = async () => {
			// 初回描画で目立つ画像だけは、ローディング中に短時間先読みする。
			// 画像全体の初回キャッシュは sw.js、リストの正本は assets.js。
			if (typeof App.preloadStartupImages === 'function') {
				await App.preloadStartupImages();
			}

			if (window.InitialLoading) {
				await window.InitialLoading.finish();
			}
			if (typeof App.warmImageCache === 'function') {
				App.warmImageCache();
			}
		};

		const start = () => {
			try {
				const result = App.startGameLogic();

				// startGameLogic が Promise を返す場合にも対応
				if (result && typeof result.then === 'function') {
					result.finally(finishLoadingAndWarmCache);
				} else {
					finishLoadingAndWarmCache();
				}
			} catch (e) {
				console.error(e);

				if (window.InitialLoading) {
					window.InitialLoading.hide();
				}

				App.showMessage("エラー: ゲーム開始処理に失敗しました。");
			}
		};

		// assets.js があり、GRAPHICSが定義されていればロードしてからゲーム開始
		// GRAPHICS.data は assets.js に統一済み。polish.js から画像一覧を注入しない。
		if (typeof GRAPHICS !== 'undefined' && typeof GRAPHICS.load === 'function') {
			GRAPHICS.load(() => {
				start();
			});
		} else {
			// なければ即開始
			start();
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
		
		// ★追加：累計獲得Gold/GEM フックを起動時に1回だけ有効化
		if (typeof App.totalGoldGem === 'function') App.totalGoldGem();

		
		// ★追加: 既存セーブデータの拡張（コンフィグ初期化）
        if (App.data.characters) {
            App.data.characters.forEach(c => {
                App.ensureCharacterBattleConfig(c);
                
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
            //App.log("戦闘に復帰します...");
            App.changeScene('battle');
        } else {
            App.log("冒険を開始します。");
            // --- ダンジョン（深淵の魔窟）の階層復帰ロジックを維持 ---
            if (App.data.progress && App.data.progress.floor > 0) {
                if (typeof Dungeon !== 'undefined') {
                    if (Field.currentMapData) {
                        App.changeScene('field');
                        //App.log(`地下 ${Dungeon.floor} 階の冒険を再開します。`);
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
		
		
        
        //let moveTimer = null;
        const startMove = (dx, dy) => {
            Field.stopMove(); // 二重起動防止
            if (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) return;
            if(typeof Menu !== 'undefined' && Menu.isMenuOpen()) return;
            Field.move(dx, dy);
            if (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) return;
            Field.moveTimer = setInterval(() => {
                // メニュー/会話/エンカウント演出/フィールド以外では長押し移動を残さない
                if((typeof Menu !== 'undefined' && Menu.isMenuOpen()) ||
                   (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) ||
                   document.getElementById('field-scene').style.display === 'none') {
                    Field.stopMove();
                    return;
                }
                Field.move(dx, dy);
            }, 150);
        };
        const stopMove = (e) => {
            if(e) e.preventDefault(); 
            Field.stopMove(); // ★共通メソッドを呼ぶ
        };

        window.addEventListener('keydown', e => {
            if(document.getElementById('field-scene') && document.getElementById('field-scene').style.display === 'flex') {
                if (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) {
                    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','Enter',' '].includes(e.key)) {
                        e.preventDefault();
                    }
                    return;
                }
                if(typeof Menu !== 'undefined' && Menu.isMenuOpen()) return;
                if(['ArrowUp', 'w'].includes(e.key)) Field.move(0, -1);
                if(['ArrowDown', 's'].includes(e.key)) Field.move(0, 1);
                if(['ArrowLeft', 'a'].includes(e.key)) Field.move(-1, 0);
                if(['ArrowRight', 'd'].includes(e.key)) Field.move(1, 0);
                if(e.key === 'Enter' || e.key === ' ') {
                    App.inspectCurrentTile();
                }
            }
        });

		const bindPad = (id, dx, dy) => {
			const el = document.getElementById(id);
			if (!el) return;

			el.style.touchAction = 'none';

			const start = (e) => {
				if (e && e.cancelable) e.preventDefault();

				if (e && e.pointerId !== undefined && el.setPointerCapture) {
					try {
						el.setPointerCapture(e.pointerId);
					} catch (err) {}
				}

				startMove(dx, dy);
			};

			const stop = (e) => {
				if (e && e.cancelable) e.preventDefault();
				Field.stopMove();
			};

			if (window.PointerEvent) {
				el.onpointerdown = start;
				el.onpointerup = stop;
				el.onpointercancel = stop;
				el.onlostpointercapture = stop;

				// 指が少しボタン外へズレても pointer capture が効くので、
				// onpointerleave では止めない
				el.onpointerleave = null;
			} else {
				// 古いブラウザ向けフォールバック
				el.onmousedown = start;
				el.onmouseup = stop;
				el.onmouseleave = stop;

				el.ontouchstart = start;
				el.ontouchend = stop;
				el.ontouchcancel = stop;
			}
		};

		bindPad('btn-up', 0, -1);
		bindPad('btn-down', 0, 1);
		bindPad('btn-left', -1, 0);
		bindPad('btn-right', 1, 0);

		const bindClick = (id, fn) => {
			const el = document.getElementById(id);
			if (!el) return;

			el.onclick = (e) => {
				if (e && e.cancelable) e.preventDefault();
				fn(e);
			};
		};

		bindClick('btn-menu', () => {
			Field.stopMove();
			if (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) return;
			if (typeof Menu !== 'undefined' && typeof Menu.openMainMenu === 'function') {
				Menu.openMainMenu();
			}
		});

		bindClick('btn-ok', () => {
			Field.stopMove();
			if (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) return;
			App.inspectCurrentTile();
		});

		window.addEventListener('blur', () => {
            Field.stopMove();
            if (typeof Field.stopIdleStep === 'function') Field.stopIdleStep();
        });
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
                Field.stopMove();
                if (typeof Field.stopIdleStep === 'function') Field.stopIdleStep();
            } else if (typeof Field.startIdleStep === 'function') {
                Field.startIdleStep();
            }
		});
        window.addEventListener('focus', () => {
            if (typeof Field.startIdleStep === 'function') Field.startIdleStep();
        });

		if (!App._objectiveHudResizeBound) {
			App._objectiveHudResizeBound = true;
			window.addEventListener('resize', () => {
				if (typeof App.fitObjectiveHUD === 'function') App.fitObjectiveHUD();
			});
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

    hasItem: (itemId) => {
        return !!(App.data && App.data.items && Number(App.data.items[itemId] || 0) > 0);
    },

    getFeatureUnlockLabel: (key) => {
        return App.unlockLabels[key] || key || 'この機能';
    },

    getFeatureLockedMessage: (key) => {
        return `${App.getFeatureUnlockLabel(key)}はまだ解放されていません。\nストーリーを進めると利用できるようになります。`;
    },

    isFeatureUnlocked: (key) => {
        if (!key) return true;
        const unlocked = App.ensureUnlockState();
        if (key === 'boat') return !!unlocked.boat || App.hasItem(108) || !!App.data?.progress?.flags?.hasShip;
        if (key === 'wing') return !!unlocked.wing || App.hasItem(109);
        return !!unlocked[key];
    },

    requireFeatureUnlocked: (key) => {
        if (App.isFeatureUnlocked(key)) return true;
        const message = App.getFeatureLockedMessage(key);
        if (typeof Menu !== 'undefined' && typeof Menu.msg === 'function') {
            Menu.msg(message);
        } else if (typeof App.log === 'function') {
            App.log(message);
        }
        return false;
    },

    hasMagicBoat: () => {
        return App.isFeatureUnlocked('boat') || App.hasItem(108) || !!App.data?.progress?.flags?.hasShip;
    },

    isFlying: () => App.data?.transportMode === 'flying',
    isBoating: () => App.data?.transportMode === 'boat',

    ensureFixedMapDiscoveryStore: () => {
        if (!App.data) return {};
        if (!App.data.progress) App.data.progress = {};
        if (!App.data.progress.visitedFixedMaps || typeof App.data.progress.visitedFixedMaps !== 'object' || Array.isArray(App.data.progress.visitedFixedMaps)) {
            App.data.progress.visitedFixedMaps = {};
        }
        return App.data.progress.visitedFixedMaps;
    },

    getFixedMapDef: (areaKey) => {
        if (!areaKey) return null;
        if (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[areaKey]) {
            return { key: areaKey, def: FIXED_MAPS[areaKey], kind: 'field' };
        }
        if (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[areaKey]) {
            return { key: areaKey, def: FIXED_DUNGEON_MAPS[areaKey], kind: 'dungeon' };
        }
        return null;
    },

    getFixedMapWorldDestination: (areaKey) => {
        if (!areaKey || typeof STORY_DATA === 'undefined' || !STORY_DATA.areas) return null;

        // 基本: 固有MAPキーと同名のワールドマップ座標へ移動する。
        const area = STORY_DATA.areas[areaKey];
        if (area && Number.isFinite(Number(area.centerX)) && Number.isFinite(Number(area.centerY))) {
            return {
                areaKey,
                x: Number(area.centerX),
                y: Number(area.centerY),
                sourceAreaKey: areaKey
            };
        }

        // 例外: START_CAVE のように固定街の中に入口がある固定ダンジョン。
        // その場合は、親となる固定街のワールド座標へ移動する。
        if (typeof FIXED_MAPS !== 'undefined') {
            for (const [parentKey, parentDef] of Object.entries(FIXED_MAPS)) {
                const actions = Array.isArray(parentDef.mapActions) ? parentDef.mapActions : [];
                const found = actions.some(a => a && (a.target === areaKey || a.targetAreaKey === areaKey));
                const parentArea = STORY_DATA.areas[parentKey];
                if (found && parentArea && Number.isFinite(Number(parentArea.centerX)) && Number.isFinite(Number(parentArea.centerY))) {
                    return {
                        areaKey,
                        x: Number(parentArea.centerX),
                        y: Number(parentArea.centerY),
                        sourceAreaKey: parentKey,
                        parentAreaKey: parentKey
                    };
                }
            }
        }

        return null;
    },

    getAllFixedMapDiscoveryEntries: () => {
        const entries = [];
        const seen = new Set();
        const visited = App.ensureFixedMapDiscoveryStore ? App.ensureFixedMapDiscoveryStore() : (App.data?.progress?.visitedFixedMaps || {});

        const push = (areaKey) => {
            if (!areaKey || seen.has(areaKey)) return;
            const info = App.getFixedMapDef(areaKey);
            if (!info) return;
            seen.add(areaKey);

            const storyArea = (typeof STORY_DATA !== 'undefined' && STORY_DATA.areas) ? STORY_DATA.areas[areaKey] : null;
            const dest = App.getFixedMapWorldDestination(areaKey);
            const record = visited[areaKey] || null;
            const discovered = !!record;
            const rank = Number(storyArea?.rank ?? info.def.rank ?? info.def.encounterRank ?? 9999);

            entries.push({
                areaKey,
                name: info.def.name || storyArea?.name || areaKey,
                kind: info.kind,
                rank,
                discovered,
                destination: dest,
                record
            });
        };

        if (typeof STORY_DATA !== 'undefined' && STORY_DATA.areas) {
            Object.keys(STORY_DATA.areas).forEach(push);
        }
        if (typeof FIXED_MAPS !== 'undefined') Object.keys(FIXED_MAPS).forEach(push);
        if (typeof FIXED_DUNGEON_MAPS !== 'undefined') Object.keys(FIXED_DUNGEON_MAPS).forEach(push);

        return entries.sort((a, b) => (a.rank - b.rank) || a.name.localeCompare(b.name, 'ja'));
    },

    discoverFixedMap: (areaKey, options = {}) => {
        const info = App.getFixedMapDef ? App.getFixedMapDef(areaKey) : null;
        if (!info || !App.data) return false;

        const visited = App.ensureFixedMapDiscoveryStore();
        const dest = App.getFixedMapWorldDestination ? App.getFixedMapWorldDestination(areaKey) : null;
        const current = visited[areaKey] || null;
        const entry = {
            areaKey,
            name: info.def.name || areaKey,
            kind: info.kind,
            worldX: dest ? dest.x : null,
            worldY: dest ? dest.y : null,
            parentAreaKey: dest?.parentAreaKey || null,
            foundAt: current?.foundAt || Date.now()
        };

        const changed = !current ||
            current.name !== entry.name ||
            current.kind !== entry.kind ||
            Number(current.worldX) !== Number(entry.worldX) ||
            Number(current.worldY) !== Number(entry.worldY) ||
            (current.parentAreaKey || null) !== entry.parentAreaKey;

        if (!changed) return false;
        visited[areaKey] = entry;

        if (!options.silent && typeof App.log === 'function') {
            App.log(`${entry.name}を発見した！`);
        }
        if (typeof AchievementManager !== 'undefined' && AchievementManager.checkProgress) {
            AchievementManager.checkProgress({ save: false });
        }
        if (options.save === true && typeof App.save === 'function') App.save();
        return true;
    },

    getVisitedFixedMapCount: () => {
        const visited = App.data?.progress?.visitedFixedMaps || {};
        if (!visited || typeof visited !== 'object') return 0;
        return Object.keys(visited).length;
    },

    isInDungeonForSkyPrism: () => {
        const area = App.data?.location?.area;
        if (area === 'ABYSS') return true;
        if (Field.currentMapData && Field.currentMapData.isDungeon) return true;
        if (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[area]) return true;
        return false;
    },

    useSkyPrismTo: (areaKey) => {
        if (!App.hasItem(110)) return { ok: false, message: 'スカイプリズムを持っていません。' };
        if (App.isInDungeonForSkyPrism()) return { ok: false, message: 'ダンジョン内ではスカイプリズムを使えない。' };

        const visited = App.ensureFixedMapDiscoveryStore();
        if (!visited[areaKey]) return { ok: false, message: 'まだ発見していない場所には移動できない。' };

        const info = App.getFixedMapDef(areaKey);
        const dest = App.getFixedMapWorldDestination(areaKey);
        if (!info || !dest) return { ok: false, message: 'この場所のフィールド座標が見つかりません。' };

        App.data.items[110] = (Number(App.data.items[110]) || 0) - 1;
        if (App.data.items[110] <= 0) delete App.data.items[110];

        if (typeof Field !== 'undefined' && typeof Field.stopMove === 'function') Field.stopMove();
        if (typeof App.clearAction === 'function') App.clearAction();

        App.data.transportMode = null;
        App.data.mapReturnPoint = null;
        App.data.location.area = 'WORLD';
        App.data.location.x = dest.x;
        App.data.location.y = dest.y;
        if (App.data.dungeon) {
            App.data.dungeon.returnPoint = null;
            App.data.dungeon.map = null;
            App.data.dungeon.adventurer = null;
            App.data.dungeon.healSpring = null;
            App.data.dungeon.abyssRift = null;
            App.data.dungeon.pendingRiftReward = null;
            App.data.dungeon.visitedMap = null;
        }
        if (App.data.progress) App.data.progress.floor = 0;

        Field.currentMapData = null;
        Field.x = dest.x;
        Field.y = dest.y;

        App.save();
        App.changeScene('field');
        if (typeof Field.render === 'function') Field.render();
        if (typeof Field.refreshCurrentAction === 'function') Field.refreshCurrentAction({ silent: true });
        if (typeof Field.startIdleStep === 'function') Field.startIdleStep();

        const targetName = info.def.name || areaKey;
        const suffix = dest.parentAreaKey && dest.parentAreaKey !== areaKey ? 'の入口付近' : 'の入口';
        const message = `${targetName}${suffix}へ移動した！`;
        if (typeof App.log === 'function') App.log(message);

        // スカイプリズム成功時はログ表示のみ。
        // 使用確認の後に追加のOKモーダルを出さないため、呼び出し側へ通知する。
        return { ok: true, message, silentSuccess: true };
    },

    getWorldTileAt: (x, y) => {
        if (typeof MAP_DATA === 'undefined' || !MAP_DATA[0]) return 'W';
        const mapW = MAP_DATA[0].length;
        const mapH = MAP_DATA.length;
        const tx = ((Number(x) % mapW) + mapW) % mapW;
        const ty = ((Number(y) % mapH) + mapH) % mapH;
        return String(MAP_DATA[ty][tx] || 'W').toUpperCase();
    },

    isWorldLandingTile: (tile) => {
        const upper = String(tile || 'W').toUpperCase();
        return upper !== 'W' && upper !== 'M';
    },

    useLightWing: () => {
        if (!App.isFeatureUnlocked('wing') && !App.hasItem(109)) {
            Menu.msg("光の翼を持っていません。");
            return false;
        }
        if (Field.currentMapData || App.data.location.area !== 'WORLD') {
            Menu.msg("光の翼はフィールドで使おう。");
            return false;
        }
        App.data.transportMode = 'flying';
        App.save();
        App.log("光の翼で空へ舞い上がった！");
        return true;
    },

    tryLandFromFlight: () => {
        if (!App.isFlying()) return false;
        const tile = App.getWorldTileAt(Field.x, Field.y);
        if (!App.isWorldLandingTile(tile)) {
            App.log("そこには降りることができない！");
            return true;
        }
        App.data.transportMode = null;
        App.save();
        App.log("地面に降り立った。");
        if (typeof Field.refreshCurrentAction === 'function') Field.refreshCurrentAction({ silent: true });
        if (typeof Field.render === 'function') Field.render();
        return true;
    },

    /**
     * 機能を解放する (鍛冶屋・ガチャ等)
     */
    unlockFeature: (key) => {
        const unlocked = App.ensureUnlockState();
        const already = !!unlocked[key];
        unlocked[key] = true;
        App.save();
        if (!already) App.log(`【システム解放】${App.getFeatureUnlockLabel(key)}が利用可能になった！`);
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
            config: { fullAuto: false, hiddenSkills: [], strategy: 'balanced' },
            limitBreak: 0,
            lbProgress: {
                counters: { battleWins: 0 },
                sources: { story: 0, battle: 0, dungeon: 0, quest: 0, boss: 0, prism: 0, random: 0, gacha: 0, trial: 0, legacy: 0 },
                trials: { mid: false, final: false, midClearedAt: null, finalClearedAt: null }
            },
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

    limitBreakConfig: {
        max: 99,
        midGate: 49,
        finalGate: 98,
        heroStoryMax: 20,
        heroBattleMax: 20,
        allyBattleMax: 20,
        randomBattleChance: 0.002,
        midTrialBossId: 401120,
        finalTrialBossId: 401130
    },

    clampLimitBreakPart: (value, max) => {
        return Math.max(0, Math.min(Number(max) || 0, Math.floor(Number(value) || 0)));
    },

    getBattleLimitBreakSteps: (battleWins) => {
        const wins = Math.max(0, Math.floor(Number(battleWins) || 0));
        const max = App.limitBreakConfig.heroBattleMax || 20;
        if (wins < 20) return 0;

        let steps = 1;
        let remaining = wins - 20;
        const tiers = [
            { count: 4, interval: 50 },   // +2〜+5
            { count: 5, interval: 100 },  // +6〜+10
            { count: 10, interval: 200 }, // +11〜+20
        ];

        for (const tier of tiers) {
            for (let i = 0; i < tier.count; i++) {
                if (remaining < tier.interval) return Math.min(max, steps);
                remaining -= tier.interval;
                steps += 1;
                if (steps >= max) return max;
            }
        }

        return Math.min(max, steps);
    },

    ensureLimitBreakProgress: (char) => {
        if (!char) return null;
        if (!char.lbProgress || typeof char.lbProgress !== 'object' || Array.isArray(char.lbProgress)) {
            char.lbProgress = {};
        }
        const p = char.lbProgress;
        if (!p.counters || typeof p.counters !== 'object' || Array.isArray(p.counters)) p.counters = {};
        if (!p.sources || typeof p.sources !== 'object' || Array.isArray(p.sources)) p.sources = {};
        if (!p.trials || typeof p.trials !== 'object' || Array.isArray(p.trials)) p.trials = {};

        const sourceKeys = ['story', 'battle', 'dungeon', 'quest', 'boss', 'prism', 'random', 'gacha', 'trial', 'legacy'];
        sourceKeys.forEach(key => {
            p.sources[key] = Math.max(0, Math.floor(Number(p.sources[key]) || 0));
        });
        p.counters.battleWins = Math.max(0, Math.floor(Number(p.counters.battleWins) || 0));
        const midClearedAt = Math.max(0, Math.floor(Number(p.trials.midClearedAt) || 0));
        const finalClearedAt = Math.max(0, Math.floor(Number(p.trials.finalClearedAt) || 0));
        p.trials.midClearedAt = midClearedAt || null;
        p.trials.finalClearedAt = finalClearedAt || null;
        p.trials.mid = !!midClearedAt;
        p.trials.final = !!finalClearedAt;
        if (p.trials.final) {
            p.trials.mid = true;
            if (!p.trials.midClearedAt) p.trials.midClearedAt = finalClearedAt;
        }
        return p;
    },

    getLimitBreakTrialCap: (char) => {
        const p = App.ensureLimitBreakProgress(char);
        if (!p) return 0;
        if (p.trials.final) return App.limitBreakConfig.max;
        if (p.trials.mid) return App.limitBreakConfig.finalGate;
        return App.limitBreakConfig.midGate;
    },

    getLimitBreakSourceTotal: (char) => {
        const p = App.ensureLimitBreakProgress(char);
        if (!p) return 0;
        return Object.values(p.sources).reduce((sum, value) => sum + (Number(value) || 0), 0);
    },

    backfillLimitBreakLegacy: (char) => {
        if (!char) return;
        const p = App.ensureLimitBreakProgress(char);
        const current = Math.max(0, Math.min(App.limitBreakConfig.max, Math.floor(Number(char.limitBreak) || 0)));
        const recorded = Math.min(App.limitBreakConfig.max, App.getLimitBreakSourceTotal(char));
        if (current > recorded) {
            p.sources.legacy += current - recorded;
        }
    },

    applyLimitBreakCap: (char) => {
        if (!char) return { changed: false, blocked: false, before: 0, after: 0 };
        App.ensureLimitBreakProgress(char);
        const current = Math.max(0, Math.min(App.limitBreakConfig.max, Math.floor(Number(char.limitBreak) || 0)));
        const earned = Math.min(App.limitBreakConfig.max, App.getLimitBreakSourceTotal(char));
        const cap = App.getLimitBreakTrialCap(char);
        const next = Math.min(earned, cap);
        const diff = next - current;

        if (diff !== 0) {
            char.limitBreak = next;
        }

        return { changed: diff !== 0, blocked: earned > next, before: current, after: next, diff };
    },

    addLimitBreak: (char, amount = 1, source = 'quest') => {
        if (!char) return { changed: false, blocked: false, before: 0, after: 0, internalChanged: false };
        const p = App.ensureLimitBreakProgress(char);
        App.backfillLimitBreakLegacy(char);
        const key = p.sources[source] !== undefined ? source : 'quest';
        const currentSourceValue = Math.max(0, Math.floor(Number(p.sources[key]) || 0));
        const sourceRoom = Math.max(0, App.limitBreakConfig.max - currentSourceValue);
        const internalDiff = Math.min(sourceRoom, Math.max(0, Math.floor(Number(amount) || 0)));

        if (internalDiff > 0) {
            p.sources[key] = (Number(p.sources[key]) || 0) + internalDiff;
        }

        const result = App.applyLimitBreakCap(char);
        result.internalChanged = internalDiff > 0;
        return result;
    },

    syncDerivedLimitBreaks: (options = {}) => {
        if (!App.data || !Array.isArray(App.data.characters)) return [];
        const logs = [];
        const cfg = App.limitBreakConfig;
        const chars = options.heroOnly
            ? App.data.characters.filter(c => c && (c.charId === 301 || c.isHero || c.uid === 'p1'))
            : App.data.characters;

        chars.forEach(char => {
            if (!char) return;
            const p = App.ensureLimitBreakProgress(char);
            const isHero = char.charId === 301 || char.isHero || char.uid === 'p1';
            const battleSteps = App.getBattleLimitBreakSteps(Number(p.counters.battleWins) || 0);

            if (isHero) {
                const storyStep = App.data.progress ? Number(App.data.progress.storyStep || 0) : 0;
                const maxFloor = App.data.dungeon ? Number(App.data.dungeon.maxFloor || 0) : 0;
                p.sources.story = App.clampLimitBreakPart(storyStep, cfg.heroStoryMax);
                p.sources.battle = App.clampLimitBreakPart(battleSteps, cfg.heroBattleMax);
                p.sources.dungeon = Math.max(0, Math.floor(Math.max(0, maxFloor - 1) / 10) * 5);
            } else {
                p.sources.battle = App.clampLimitBreakPart(battleSteps, cfg.allyBattleMax);
            }

            App.backfillLimitBreakLegacy(char);
            const result = App.applyLimitBreakCap(char);

            if (result.diff > 0) {
                logs.push(`<span style="color:#ffd700;">${char.name}は戦いの中で成長した！</span>`);
            }
        });

        return logs;
    },

    noteBattleVictory: (participants = []) => {
        if (!App.data || !Array.isArray(App.data.characters)) return [];
        if (!App.data.stats) App.data.stats = {};
        App.data.stats.totalBattles = (Number(App.data.stats.totalBattles) || 0) + 1;

        const logs = [];
        const seen = new Set();
        const partyUids = Array.isArray(participants) && participants.length > 0
            ? participants.map(p => p && p.uid).filter(Boolean)
            : (App.data.party || []).filter(Boolean);

        partyUids.forEach(uid => {
            if (seen.has(uid)) return;
            seen.add(uid);
            const char = App.getChar ? App.getChar(uid) : App.data.characters.find(c => c.uid === uid);
            if (!char) return;
            const p = App.ensureLimitBreakProgress(char);
            p.counters.battleWins += 1;
        });

        logs.push(...App.syncDerivedLimitBreaks());

        seen.forEach(uid => {
            const char = App.getChar ? App.getChar(uid) : App.data.characters.find(c => c.uid === uid);
            if (!char) return;
            if (Math.random() >= App.limitBreakConfig.randomBattleChance) return;
            const result = App.addLimitBreak(char, 1, 'random');
            if (result.changed) {
                logs.push(`<span style="color:#ffdf7a;">${char.name}は戦いの中で成長した！</span>`);
            }
        });

        logs.push(...App.completeLimitBreakTrialIfNeeded());
        return logs;
    },

    getLimitBreakTrialCandidates: () => {
        if (!App.data || !Array.isArray(App.data.party)) return { mid: [], final: [] };
        const members = App.data.party
            .map(uid => uid ? (App.getChar ? App.getChar(uid) : App.data.characters.find(c => c.uid === uid)) : null)
            .filter(Boolean);

        const mid = [];
        const final = [];
        members.forEach(char => {
            const p = App.ensureLimitBreakProgress(char);
            const lb = Math.floor(Number(char.limitBreak) || 0);
            if (lb >= App.limitBreakConfig.finalGate && lb < App.limitBreakConfig.max && !p.trials.final) {
                final.push(char);
            } else if (lb >= App.limitBreakConfig.midGate && lb < 50 && !p.trials.mid) {
                mid.push(char);
            }
        });
        return { mid, final };
    },

    limitBreakTrialPromptOpen: false,

    showLimitBreakTrialChoice: async (text) => {
        if (typeof StoryManager !== 'undefined' && typeof StoryManager.showChoice === 'function') {
            StoryManager.active = true;
            try {
                return !!(await StoryManager.showChoice(text));
            } finally {
                if (typeof StoryManager.endConversation === 'function') {
                    StoryManager.endConversation();
                }
            }
        }

        if (typeof Menu !== 'undefined' && typeof Menu.confirm === 'function') {
            return await new Promise(resolve => {
                Menu.confirm(text, () => resolve(true), () => resolve(false));
            });
        }

        App.log(String(text).replace(/\n/g, '<br>'));
        return false;
    },

    startLimitBreakTrial: async (options = {}) => {
        if (!App.data || App.limitBreakTrialPromptOpen) return;
        App.limitBreakTrialPromptOpen = true;

        try {
            App.syncDerivedLimitBreaks();
            const candidates = App.getLimitBreakTrialCandidates();
            const requestedType = options && (options.trialType === 'mid' || options.trialType === 'final') ? options.trialType : null;
            const isFinal = requestedType ? requestedType === 'final' : candidates.final.length > 0;
            const targetCandidates = isFinal ? candidates.final : candidates.mid;

            if (targetCandidates.length === 0) {
                const requiredText = requestedType === 'mid' ? '+49' : (requestedType === 'final' ? '+98' : '+49、または+98');
                App.log(`試練の気配は静まっている。${requiredText}に到達した仲間をパーティに入れる必要がありそうだ。`);
                return;
            }

            const trialType = isFinal ? 'final' : 'mid';
            const trialName = isFinal ? '最終試練' : '中間試練';
            const bossId = isFinal ? App.limitBreakConfig.finalTrialBossId : App.limitBreakConfig.midTrialBossId;
            const names = targetCandidates.map(c => c.name).join('、');
            const ok = await App.showLimitBreakTrialChoice(`${names}が${trialName}に挑める。\n試練を開始しますか？`);
            if (!ok) {
                App.log('試練への挑戦を見送った。');
                if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
                    Field.refreshCurrentAction({ silent: true });
                }
                return;
            }

            App.log(`${names}の前に、${trialName}の門が開いた！`);
            if (!App.data.progress) App.data.progress = {};
            App.data.progress.pendingLimitBreakTrial = {
                type: trialType,
                monsterId: bossId,
                candidateUids: targetCandidates.map(c => c.uid),
                startedAt: Date.now()
            };
            App.data.battle = {
                active: false,
                isBossBattle: true,
                isSpecialBoss: false,
                isEstark: false,
                fixedBossId: bossId,
                enemies: []
            };
            App.save();
            App.changeScene('battle');
        } finally {
            App.limitBreakTrialPromptOpen = false;
        }
    },

    completeLimitBreakTrialIfNeeded: () => {
        const trial = App.data?.progress?.pendingLimitBreakTrial;
        if (!trial) return [];
        const battleBossId = Number(App.data?.battle?.fixedBossId || 0);
        const trialBossId = Number(trial.monsterId || 0);
        if (!trialBossId || battleBossId !== trialBossId) return [];

        const isFinal = trial.type === 'final';
        const targetLb = isFinal ? App.limitBreakConfig.max : 50;
        const requiredLb = isFinal ? App.limitBreakConfig.finalGate : App.limitBreakConfig.midGate;
        const trialKey = isFinal ? 'final' : 'mid';
        const partySet = new Set((App.data.party || []).filter(Boolean));
        const logs = [];

        (trial.candidateUids || []).forEach(uid => {
            if (!partySet.has(uid)) return;
            const char = App.getChar ? App.getChar(uid) : App.data.characters.find(c => c.uid === uid);
            if (!char) return;
            const p = App.ensureLimitBreakProgress(char);
            const current = Math.floor(Number(char.limitBreak) || 0);
            if (current < requiredLb) return;

            p.trials[trialKey] = true;
            if (isFinal) p.trials.mid = true;
            const clearedAt = Date.now();
            p.trials[`${trialKey}ClearedAt`] = clearedAt;
            if (isFinal && !p.trials.midClearedAt) p.trials.midClearedAt = clearedAt;
            const earnedBeforeTrialBonus = Math.min(App.limitBreakConfig.max, App.getLimitBreakSourceTotal(char));
            if (earnedBeforeTrialBonus < targetLb) {
                p.sources.trial += targetLb - earnedBeforeTrialBonus;
            }

            const result = App.applyLimitBreakCap(char);
            if (result.after > current) {
                logs.push(`<span style="color:#ffd700;">${char.name}は戦いの中で成長した！</span>`);
            }
        });

        delete App.data.progress.pendingLimitBreakTrial;
        return logs;
    },

    clearPendingLimitBreakTrial: () => {
        if (App.data?.progress?.pendingLimitBreakTrial) {
            delete App.data.progress.pendingLimitBreakTrial;
        }
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

    setFeatureAction: (label, featureKey, callback, lockedLabel = '???') => {
        if (App.isFeatureUnlocked(featureKey)) {
            App.setAction(label, callback);
        } else {
            App.setAction(lockedLabel, () => App.requireFeatureUnlocked(featureKey));
        }
    },

    showMessage: (text, callback) => {
        if (typeof Menu !== 'undefined' && typeof Menu.msg === 'function') {
            Menu.msg(text, callback);
            return;
        }
        if (typeof window !== 'undefined' && typeof window.showPageMessage === 'function') {
            window.showPageMessage(text, callback);
            return;
        }
        if (typeof App.log === 'function') {
            App.log(String(text).replace(/\n/g, '<br>'));
        }
        if (callback) callback();
    },
    showConfirm: async (text) => {
        if (typeof Menu !== 'undefined' && typeof Menu.confirm === 'function') {
            return await new Promise(resolve => {
                Menu.confirm(text, () => resolve(true), () => resolve(false));
            });
        }
        if (typeof window !== 'undefined' && typeof window.showPageConfirm === 'function') {
            return await new Promise(resolve => {
                window.showPageConfirm(text, () => resolve(true), () => resolve(false));
            });
        }
        if (typeof App.log === 'function') {
            App.log(String(text).replace(/\n/g, '<br>'));
        }
        return false;
    },
    clearAction: () => {
        const btn = document.getElementById('action-indicator');
        if(btn) btn.style.display = 'none';
        App.pendingAction = null;
    },

    // 報酬フラッシュなど、短い演出中だけフィールド入力を止める。
    // 長時間止めるとテンポが悪くなるため、通常レアは0.6秒前後、超レアは1秒未満を目安にする。
    fieldInputLockedUntil: 0,
    lockFieldInput: (ms = 500) => {
        App.fieldInputLockedUntil = Math.max(App.fieldInputLockedUntil || 0, Date.now() + Number(ms || 0));
    },
    isFieldInputLocked: () => Date.now() < Number(App.fieldInputLockedUntil || 0),

    /**
     * フィールド操作を止めるべき状態を一元判定する。
     *
     * 重要:
     * - エンカウント演出中に十字キー入力が残ると、戦闘へ移るまでの間にさらに移動できてしまう。
     * - Story会話/選択肢/会話ログ中に移動・メニュー操作ができると、戦闘画面上に会話UIが残るなどの事故が起きる。
     * - 今後、十字キー/OK/メニュー/長押し移動を追加・修正する場合は、この関数を必ず通す。
     */
    isFieldControlBlocked: () => {
        if (typeof App.isFieldInputLocked === 'function' && App.isFieldInputLocked()) return true;
        if (App.encounterTransitioning) return true;
        if (App.limitBreakTrialPromptOpen) return true;
        if (App.data?.battle?.active) return true;
        if (document.hidden) return true;

        if (typeof StoryManager !== 'undefined') {
            if (StoryManager.active || StoryManager.isTyping) return true;
        }

        const storyOverlay = document.getElementById('story-ui-overlay');
        if (storyOverlay && storyOverlay.style.display !== 'none') return true;

        const backlogOverlay = document.getElementById('backlog-overlay');
        if (backlogOverlay) return true;

        if (typeof Dungeon !== 'undefined') {
            if (Dungeon.adventurerPromptOpen || Dungeon.abyssRiftPromptOpen) return true;
        }

        return false;
    },

    executeAction: () => {
        if (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) return;
        if(App.pendingAction) {
            const act = App.pendingAction;
            App.clearAction();
            act();
        }
    },
    inspectCurrentTile: () => {
        if (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) return;
        if (typeof App.tryLandFromFlight === 'function' && App.tryLandFromFlight()) return;
        if(App.pendingAction) {
            App.executeAction();
            return;
        }
        App.log("足元を調べた。しかし、何も見つからなかった");
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
                    if (typeof App.ensureLimitBreakProgress === 'function') {
                        App.ensureLimitBreakProgress(char);
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
                    maxDamage: { val: 0, actor: '', actorLv: null, skill: '', time: null },
                    startTime: Date.now()
                };
            }
            if (typeof App.syncDerivedLimitBreaks === 'function') {
                App.syncDerivedLimitBreaks();
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
		
		// ★追加
		if (typeof App.updateHUD === 'function') App.updateHUD();
    },

	updateHUD: () => {
		// 画面上のGold/GEM/現在の目的を更新する。
		// 目的文の正本は story.js の StoryManager.getObjectiveText()。
		// ここに storyStep/subStep の分岐を増やさないこと。
		if (!App.data) return;

		const goldDisp = document.getElementById('disp-gold');
		const gemDisp = document.getElementById('disp-gem');
		if (goldDisp) goldDisp.innerText = (App.data.gold || 0).toLocaleString();
		if (gemDisp) gemDisp.innerText = (App.data.gems || 0).toLocaleString();

		if (typeof App.updateObjectiveHUD === 'function') App.updateObjectiveHUD();
	},

	updateObjectiveHUD: () => {
		const objectiveText = document.getElementById('objective-text');
		const objectiveBox = document.getElementById('objective-box');
		if (!objectiveText || !App.data) return;

		let text = '冒険を開始しよう';
		if (typeof StoryManager !== 'undefined' && typeof StoryManager.getObjectiveText === 'function') {
			text = StoryManager.getObjectiveText(App.data);
		}

		objectiveText.innerText = text;
		objectiveText.title = text;
		if (objectiveBox) objectiveBox.style.display = text ? 'flex' : 'none';

		// 長文時は改行せず、左上HUD内で横スクロールさせる。
		// ここを単純な折り返し表示へ変えると、操作エリアが狭くなるため注意。
		if (typeof App.fitObjectiveHUD === 'function') {
			App.fitObjectiveHUD();
		}
	},

	fitObjectiveHUD: () => {
		const objectiveBox = document.getElementById('objective-box');
		const objectiveText = document.getElementById('objective-text');
		const objectiveClip = objectiveText ? objectiveText.parentElement : null;
		if (!objectiveBox || !objectiveText || !objectiveClip) return;

		requestAnimationFrame(() => {
			const clipWidth = objectiveClip.clientWidth || 0;
			const textWidth = objectiveText.scrollWidth || 0;
			const overflow = Math.max(0, textWidth - clipWidth);

			if (overflow > 2) {
				const distance = overflow + 24;
				const duration = Math.max(8, Math.min(18, distance / 18 + 6));
				objectiveBox.classList.add('is-overflow');
				objectiveBox.style.setProperty('--objective-scroll-distance', `${distance}px`);
				objectiveBox.style.setProperty('--objective-scroll-duration', `${duration}s`);
			} else {
				objectiveBox.classList.remove('is-overflow');
				objectiveBox.style.removeProperty('--objective-scroll-distance');
				objectiveBox.style.removeProperty('--objective-scroll-duration');
			}
		});
	},
    
    startNewGame: () => {
        const fileInput = document.getElementById('player-icon');
        if(fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if(file.size > 500 * 1024) {
                App.showMessage("画像サイズが大きすぎます(500KB以下)");
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
        const heroMaster = (window.CHARACTERS_DATA || []).find(c => c.id === 301);
        if (imgSrc) {
            App.data.characters[0].img = imgSrc;
            App.data.characters[0].customImage = true;
        } else {
            App.data.characters[0].img = heroMaster?.img || null;
            delete App.data.characters[0].customImage;
        }
        if (heroMaster) {
            ['job','rarity','hp','mp','atk','def','spd','mag','mdef','hit','eva','cri','sp'].forEach(k => {
                if (heroMaster[k] !== undefined) App.data.characters[0][k] = heroMaster[k];
            });
        }
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
			// ★追加: 新規開始時の開幕イベントを予約（イベント全体を actions から実行する）
			if (!App.data.progress) App.data.progress = {};
			delete App.data.progress.activeConversation; // 念のため

			// ★ここが重要：勝利後レジューム用ではなく、通常イベント予約として持つ
			App.data.progress.pendingEventId = 'game_start';

			localStorage.setItem(CONST.SAVE_KEY, JSON.stringify(App.data));
			window.location.href = 'index.html';
		} catch(e) {
			App.showMessage("データ作成失敗");
		}
    },
    
    continueGame: () => { window.location.href='index.html'; },
    returnToTitle: () => { App.save(); window.location.href='main.html'; },
    
	
    getChar: (uid) => App.data ? App.data.characters.find(c => c.uid === uid) : null,

    getLimitBreakStatRate: (limitBreak) => {
        const lb = Math.max(0, Math.min(99, Math.floor(Number(limitBreak) || 0)));
        if (lb >= 99) return 0.20;
        if (lb >= 50) return 0.15;
        return 0.10;
    },

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


    // --- 限界突破回数の計算 ---
    // 現在値は App.syncDerivedLimitBreaks / App.addLimitBreak が管理する。
    if (typeof App.ensureLimitBreakProgress === 'function') App.ensureLimitBreakProgress(char);
    let lb = Math.max(0, Math.min(99, Math.floor(Number(char.limitBreak) || 0)));

    // 限界突破による基礎値換算率
    // LB49: 基礎値x490%、LB50: 基礎値x750%、LB98: 基礎値x1470%、LB99: 基礎値x1980%
    const lbRate = App.getLimitBreakStatRate ? App.getLimitBreakStatRate(lb) : 0.10;
    const lbBase = base.lbBase || base;

    // ステータス初期化
    let s = {
        maxHp: char.hp + Math.floor((lbBase.hp || base.hp || 30) * lbRate * lb),
        maxMp: char.mp + Math.floor((lbBase.mp || base.mp || 8) * lbRate * lb),
        atk:   char.atk + Math.floor((lbBase.atk || base.atk || 8) * lbRate * lb),
        def:   char.def + Math.floor((lbBase.def || base.def || 6) * lbRate * lb),
        mdef:  char.mdef + Math.floor((lbBase.mdef || base.mdef || 6) * lbRate * lb),
        spd:   char.spd + Math.floor((lbBase.spd || base.spd || 6) * lbRate * lb),
        mag:   char.mag + Math.floor((lbBase.mag || base.mag || 6) * lbRate * lb),

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
                const growthRef = master.growthBase || master;

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
                const hpMult   = 2.0 + statBonus;
                const mpMult   = 2.0 + statBonus;
                const atkMult  = 1.0 + statBonus + atkBonus;
                const defMult  = 1.0 + statBonus + defBonus;
                const magMult  = 1.0 + statBonus + magBonus;
                const mdefMult = 1.0 + statBonus + mdefBonus;
                const spdMult  = 1.0 + statBonus;

                // 各ステータス上昇量の計算
                let incHp   = Math.max(1, Math.floor(((growthRef.hp || master.hp || 100) * reincMult) * r() * hpMult));
                let incMp   = Math.max(1, Math.floor(((growthRef.mp || master.mp || 50) * reincMult) * r() * mpMult));
                let incAtk  = Math.max(1, Math.floor(((growthRef.atk || master.atk || 10) * reincMult) * r() * atkMult));
                let incDef  = Math.max(1, Math.floor(((growthRef.def || master.def || 10) * reincMult) * r() * defMult));
                let incMdef = Math.max(1, Math.floor(((growthRef.mdef || master.mdef || 10)* reincMult) * r() * mdefMult));
                let incSpd  = Math.max(1, Math.floor(((growthRef.spd || master.spd || 10) * reincMult) * r() * spdMult));
                let incMag  = Math.max(1, Math.floor(((growthRef.mag || master.mag || 10) * reincMult) * r() * magMult));

                const growthBonusLogs = [];
                const applyGrowthBonus = (keys, mult, label) => {
                    keys.forEach(key => {
                        if (key === 'hp') incHp = Math.max(1, Math.floor(incHp * mult));
                        if (key === 'mp') incMp = Math.max(1, Math.floor(incMp * mult));
                        if (key === 'atk') incAtk = Math.max(1, Math.floor(incAtk * mult));
                        if (key === 'def') incDef = Math.max(1, Math.floor(incDef * mult));
                        if (key === 'mdef') incMdef = Math.max(1, Math.floor(incMdef * mult));
                        if (key === 'spd') incSpd = Math.max(1, Math.floor(incSpd * mult));
                        if (key === 'mag') incMag = Math.max(1, Math.floor(incMag * mult));
                    });
                    growthBonusLogs.push(`${label} x${mult.toFixed(1)} (${keys.join(', ')})`);
                };

                if (charData.level === 50 || charData.level === 100) {
                    applyGrowthBonus(['hp', 'mp', 'atk', 'def', 'mdef', 'spd', 'mag'], 2 + Math.random(), `Lv${charData.level}成長ボーナス`);
                } else if (Math.random() < 0.12) {
                    const keys = ['hp', 'mp', 'atk', 'def', 'mdef', 'spd', 'mag'].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.25 ? 2 : 1);
                    applyGrowthBonus(keys, 2 + Math.random(), 'ひらめき成長');
                }

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

                // --- ログの追加（順序を制御） ---
				// 1. レベルアップ通知
				logs.push(`<span style="color:#00ff00; font-weight:bold;"><br>${charData.name}は レベル ${charData.level} に上がった！</span>`);
				
				// 2. ステータス上昇値（全項目）
				logs.push(`<span style="font-size:0.9em;">最大HP+${incHp} 最大MP+${incMp} <br>攻撃+${incAtk} 防御+${incDef} 魔力+${incMag} 魔防+${incMdef} 速さ+${incSpd} </span>`);
				if (growthBonusLogs.length > 0) {
					logs.push(`<span style="color:#ffdd66;">${growthBonusLogs.join(' / ')}</span>`);
				}

				// 3. スキル習得ログ
				const newSkill = App.checkNewSkill(charData);
				if (newSkill) {
					if(!charData.skills) charData.skills = [];
					if(!charData.skills.includes(newSkill.id)) {
						charData.skills.push(newSkill.id);
						logs.push(`<span style="color:#ffff00;">${newSkill.name} を覚えた！</span>`);
					}
				}
				
				// 4. 特性習得ログ
				if (typeof PassiveSkill !== 'undefined' && PassiveSkill.applyLevelUpTraits) {
					const traitLog = PassiveSkill.applyLevelUpTraits(charData);
					if (traitLog) {
						logs.push(traitLog);
					}
				}
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
				'斧': ['atk', 'cri', 'finDmg', 'elmAtk', 'attack_Fear'],
				'槍': ['atk', 'hit', 'cri', 'finDmg', 'elmAtk'],
				'短剣': ['atk', 'mag', 'eva', 'cri', 'finDmg', 'elmAtk', 'attack_Poison'],
				'弓': ['atk', 'mag', 'cri', 'finDmg', 'elmAtk'],
				'杖': ['mag', 'eva', 'finDmg', 'elmAtk'],
				'盾': ['def', 'mdef', 'eva', 'finRed', 'elmRes', 'resists_Debuff'],
				'腕輪': ['atk', 'mag', 'spd', 'def', 'mdef', 'hit', 'eva', 'cri', 'elmAtk', 'finDmg'],
				'兜': ['hp', 'mp', 'def', 'mdef', 'elmRes', 'resists_Fear', 'resists_SkillSeal'],
				'帽子': ['hp', 'mp', 'def', 'mag', 'mdef', 'elmRes', 'resists_HealSeal'],
				'鎧': ['hp', 'mp', 'def', 'mdef', 'finRed', 'elmRes', 'resists_Poison'],
				'ローブ': ['hp', 'mp', 'mdef', 'mag', 'elmAtk', 'elmRes', 'resists_SpellSeal'],
				'ブーツ': ['spd', 'def', 'mdef', 'finRed', 'elmAtk', 'elmRes', 'resists_Shock'],
				'くつ': ['spd', 'hit', 'eva', 'finDmg', 'elmAtk', 'elmRes', 'resists_Shock']
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


	/**
	 * 指定したEIDの装備を生成する（報酬・固定配布用）
	 * @param {number} eid - 装備ID
	 * @param {number} plus - プラス値（ステータス倍率に影響）
	 * @param {Array} fixedOpts - [任意] 指定するオプション配列
	 * @param {Array} fixedTraits - [任意] 指定する特性配列
	 */
	createEquipById: (eid, plus = 0, fixedOpts = null, fixedTraits = null) => {
		const base = window.EQUIP_MASTER.find(e => e.eid === eid);
		if (!base) return null;

		const targetFloor = App.getVirtualFloor();

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
			traits: (base.traits ? JSON.parse(JSON.stringify(base.traits)) : []),
			grantSkills: (base.grantSkills ? JSON.parse(JSON.stringify(base.grantSkills)) : [])
		};

		// 基礎ステータス倍率の適用
		const plusMults = { 0: 1.0, 1: 1.1, 2: 1.3, 3: 1.5 };
		const mult = plusMults[plus] || 1.0;
		const BASE_SCALE_KEYS = new Set(['atk', 'def', 'mag', 'mdef', 'spd', 'hp', 'mp']);

		if (mult > 1.0) {
			for (let key of BASE_SCALE_KEYS) {
				if (typeof eq.data[key] === 'number') eq.data[key] = Math.floor(eq.data[key] * mult);
			}
		}

		// オプション設定
		if (fixedOpts && Array.isArray(fixedOpts)) {
			// ★修正点：指定された key を元に DB.OPT_RULES から情報を自動補完する
			eq.opts = fixedOpts.map(o => {
				const rule = DB.OPT_RULES.find(r => r.key === o.key && (!o.elm || r.elm === o.elm));
				return {
					key: o.key,
					elm: o.elm || (rule ? rule.elm : undefined),
					label: rule ? rule.name : o.key, // マスターにあればその名前、なければkeyをそのまま使う
					val: o.val,
					unit: rule ? rule.unit : '',    // マスターから単位（%やval）を取得
					rarity: o.rarity || 'N'
				};
			});
			eq.name += `+${plus}`;
		} else if (plus > 0) {
			// 指定がない場合は従来通りのランダム生成
			const BASE_OPTS_MAP = {
				'剣': ['atk', 'hit', 'cri', 'finDmg', 'elmAtk'], '斧': ['atk', 'cri', 'finDmg', 'elmAtk', 'attack_Fear'],
				'槍': ['atk', 'hit', 'cri', 'finDmg', 'elmAtk'], '短剣': ['atk', 'mag', 'eva', 'cri', 'finDmg', 'elmAtk', 'attack_Poison'],
				'弓': ['atk', 'mag', 'cri', 'finDmg', 'elmAtk'], '杖': ['mag', 'eva', 'finDmg', 'elmAtk'],
				'盾': ['def', 'mdef', 'eva', 'finRed', 'elmRes', 'resists_Debuff'], '腕輪': ['atk', 'mag', 'spd', 'def', 'mdef', 'hit', 'eva', 'cri', 'elmAtk', 'finDmg'],
				'兜': ['hp', 'mp', 'def', 'mdef', 'elmRes', 'resists_Fear', 'resists_SkillSeal'], '帽子': ['hp', 'mp', 'def', 'mag', 'mdef', 'elmRes', 'resists_HealSeal'],
				'鎧': ['hp', 'mp', 'def', 'mdef', 'finRed', 'elmRes', 'resists_Poison'], 'ローブ': ['hp', 'mp', 'mdef', 'mag', 'elmAtk', 'elmRes', 'resists_SpellSeal'],
				'ブーツ': ['spd', 'def', 'mdef', 'finRed', 'elmAtk', 'elmRes', 'resists_Shock'], 'くつ': ['spd', 'hit', 'eva', 'finDmg', 'elmAtk', 'elmRes', 'resists_Shock']
			};
			let allowedKeys = [...new Set([...(BASE_OPTS_MAP[eq.baseName] || []), ...(base.possibleOpts || [])])];
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
				eq.opts.push({ key: rule.key, elm: rule.elm, label: rule.name, val: Math.floor(Math.random()*(max-min+1))+min, unit: rule.unit, rarity: rarity });
			}
			eq.name += `+${plus}`;
		}

		// 特性設定
		if (fixedTraits && Array.isArray(fixedTraits)) {
			// 固定特性が指定されている場合（ベースの特性に上書き/追加）
			eq.traits = JSON.parse(JSON.stringify(fixedTraits));
		} else if (plus >= 3) {
			// 指定がなくプラス3以上の場合は従来通りランダム付与
			if (typeof PassiveSkill !== 'undefined' && PassiveSkill.generateEquipmentTraits) {
				const randTraits = PassiveSkill.generateEquipmentTraits();
				eq.traits = [...(eq.traits || []), ...(randTraits || [])];
			}
		}

		// シナジーの再判定（固定指定の場合でもシナジー条件を満たせば発動させる）
		const syns = App.checkSynergy(eq);
		if (syns && syns.length > 0) {
			eq.isSynergy = true;
			eq.effects = syns.map(s => s.effect);
			eq.synergies = syns;
		}

		return eq;
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
		
        const displayImg = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(c) : c.img;
        const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(c) : '';
        
        const imgTag = displayImg ? `<img src="${displayImg}"${imageFallbackAttr} style="width:100%; height:100%; object-fit:cover;">` : 'IMG';
        
		// ★追加：転生マークの生成
        const reincarnated = c.reincarnationCount ? `<span style="color:#00ff00; margin-left:4px;">★${c.reincarnationCount}</span>` : '';
		
        const lbVal = Math.max(0, Math.min(99, Math.floor(Number(c.limitBreak) || 0)));
		
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
	 * - Lv11〜48  ：ゆるやかに重くなる（50スキル前の育成）
	 * - Lv49→50  ：壁（強スキル解放）
	 * - Lv50〜98  ：じわじわ重い（転生前のやり込み）
	 * - Lv99→100 ：大きな壁（転生条件）
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

		// --- 11〜48：49直前をどう重くするか（ターゲット） ---
		// eL=49 の必要経験値（49→50の直前）
		const TARGET_49 = 30000;

		// --- 壁の強さ（段差はキツくてOK方針） ---
		// 49→50 の壁倍率（例：1.8なら 49の1.8倍）
		const WALL_50 = 5;

		// 99→100 の壁倍率（転生条件の壁）
		const WALL_100 = 5;

		// --- 50〜98：転生前の成長（ターゲット） ---
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
		// 49→50 と 99→100 だけ ×WALL を適用し、次レベルで壁を剥がした基準に戻ります。
		// （50→51 / 100→101 は一度下がってまた上昇）
		// ------------------------------------------------------------


		/* =====================================================
		 * 事前計算（境界の値を作る）
		 * ===================================================== */

		// --- eL=10 ---
		const xp10 = BASE_EXP * Math.pow(10, P_EARLY);

		// --- eL=11〜48（二次） ---
		const B = (TARGET_49 - xp10) / Math.pow(49 - 10, 2);
		const xp49 = xp10 + B * Math.pow(49 - 10, 2); // ≒ TARGET_49

		// ★壁は「そのレベルだけ」適用した表示用
		const xp49_wall = xp49 * WALL_50; // 49→50だけスパイク

		// ★50以降の基準（壁を剥がした起点）は xp49 のまま
		const base50 = xp49;

		// --- eL=50〜98（べき乗：基準base50からTARGET_99へ） ---
		const S = (TARGET_99 - base50) / Math.pow(99 - 50, P_AFTER_50);
		const xp99 = base50 + S * Math.pow(99 - 50, P_AFTER_50); // ≒ TARGET_99

		// ★99→100も「そのレベルだけ」壁
		const xp99_wall = xp99 * WALL_100;

		// ★100以降の基準（壁剥がし）は xp99
		const base100 = xp99;

		/* =====================================================
		 * 実際の必要経験値の計算
		 * ===================================================== */

		let needExp;

		if (eL <= 10) {
		  needExp = BASE_EXP * Math.pow(eL, P_EARLY);

		} else if (eL <= 48) {
		  needExp = xp10 + B * Math.pow(eL - 10, 2);

		} else if (eL === 49) {
		  // ★49→50はスパイクだけ
		  needExp = xp49_wall;

		} else if (eL <= 98) {
		  // ★50〜98は壁なし基準（base50）から上がっていく
		  needExp = base50 + S * Math.pow(eL - 50, P_AFTER_50);

		} else if (eL === 99) {
		  // ★99→100もスパイクだけ
		  needExp = xp99_wall;

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
            else App.showMessage("セーブデータがありません");
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
            reader.onload = async (event) => {
                try {
                    const loadedData = JSON.parse(event.target.result);
                    if (loadedData.gold !== undefined && loadedData.party && loadedData.characters) {
                        if (await App.showConfirm("現在のデータを上書きして復元しますか？\n(ページがリロードされます)")) {
                            localStorage.setItem(CONST.SAVE_KEY, JSON.stringify(loadedData));
                            location.reload(); 
                        }
                    } else {
                        App.showMessage("不正なセーブデータ形式です");
                    }
                } catch (err) {
                    App.showMessage("ファイルの読み込みに失敗しました");
                    console.error(err);
                }
            };
            reader.readAsText(file);
        };
        input.click(); 
    },
	
	getEncounterFlags: () => {
		let ambushPrevention = 0; // ID 41: 警戒
		let preemptiveBonus = 0;  // ID 42: 忍び足

		if (typeof PassiveSkill !== 'undefined' && App.data && App.data.party) {
			App.data.party.forEach(uid => {
				if (!uid) return;
				const c = App.data.characters.find(char => char.uid === uid);
				if (!c) return;

				ambushPrevention += PassiveSkill.getSumValue(c, 'ambush_prevent_pct');
				preemptiveBonus += PassiveSkill.getSumValue(c, 'ambush_chance_pct');
			});
		}

		let isAmbushed = Math.random() < 0.10;
		let isPreemptive = Math.random() < 0.10;

		if (isAmbushed && Math.random() * 100 < ambushPrevention) {
			isAmbushed = false;
			App.log("<span style='color:#88f;'>「警戒」により不意打ちを防いだ！</span>");
		}

		if (!isAmbushed && !isPreemptive && Math.random() * 100 < preemptiveBonus) {
			isPreemptive = true;
			App.log("<span style='color:#8f8;'>「忍び足」により先制攻撃のチャンス！</span>");
		}

		if (isAmbushed) isPreemptive = false;

		return { isAmbushed, isPreemptive };
	},

	playEncounterTransition: (callback) => {
		const layer = document.getElementById('encounter-transition');

		if (!layer) {
			setTimeout(callback, 500);
			return;
		}

		layer.classList.remove('is-active');
		void layer.offsetWidth;
		layer.classList.add('is-active');

		setTimeout(() => {
			callback();

			setTimeout(() => {
				layer.classList.remove('is-active');
			}, 300);
		}, 680);
	},

	tryRandomEncounter: (rate = null) => {
		if (!App.data) return false;
		if (App.encounterTransitioning) return true;
		if (App.data.battle && App.data.battle.active) return true;

		const encounterRate = rate !== null
			? rate
			: ((App.data.walkCount || 0) > 15 ? 0.06 : 0.03);

		if (Math.random() >= encounterRate) {
			return false;
		}

		App.encounterTransitioning = true;
		Field.stopMove();
		if (typeof Field.stopIdleStep === 'function') Field.stopIdleStep();
		App.clearAction();
		// エンカウント演出中にキー/長押し入力が残っても、戦闘画面へ移るまで一切進ませない。
		if (typeof App.lockFieldInput === 'function') App.lockFieldInput(1500);

		App.data.walkCount = 0;
		App.log("敵だ！");

		const flags = App.getEncounterFlags();
		const isSeaEncounter = !Field.currentMapData && (
			(typeof App.isBoating === 'function' && App.isBoating()) ||
			(typeof App.getWorldTileAt === 'function' && App.getWorldTileAt(Field.x, Field.y) === 'W')
		);

		App.data.battle = {
			active: false,
			isBossBattle: false,
			isSpecialBoss: false,
			isEstark: false,
			fixedBossId: null,
			enemies: [],
			encounterType: isSeaEncounter ? 'sea' : null,
			monsters: isSeaEncounter && Array.isArray(window.SEA_ENCOUNTER_MONSTERS) ? [...window.SEA_ENCOUNTER_MONSTERS] : null,
			isAmbushed: flags.isAmbushed,
			isPreemptive: flags.isPreemptive
		};

		App.save();

		App.playEncounterTransition(() => {
			App.changeScene('battle');
			App.encounterTransitioning = false;
		});

		return true;
	},
		
    changeScene: (sceneId) => {
        const sceneFeatureMap = {
            medal: 'medalKing',
            casino: 'casino'
        };
        const requiredFeature = sceneFeatureMap[sceneId];
        if (requiredFeature && !App.requireFeatureUnlocked(requiredFeature)) return;

        // フィールド以外の画面へ移る時は、待機中の足踏みタイマーを止める。
        // 足踏みは描画だけの軽量演出だが、戦闘/施設/メニュー裏で動かし続ける必要はない。
        if (sceneId !== 'field' && typeof Field !== 'undefined' && typeof Field.stopIdleStep === 'function') {
            Field.stopIdleStep();
        }

        document.querySelectorAll('.scene-layer').forEach(e => e.style.display = 'none');
        const target = document.getElementById(sceneId + '-scene');
        if(target) target.style.display = 'flex';
        
        if(typeof Menu !== 'undefined') Menu.closeAll();
        App.clearAction();

        if(sceneId === 'field') {
            Field.init();

            if (typeof StoryManager !== 'undefined') {
                // 画面描画（Field.init）との競合を避けるため、一瞬待ってから実行
                setTimeout(() => {
                    let resumed = false;

                    // 1. 中断された実行中イベント（会話含む）の復元
                    if (typeof StoryManager.resumeActiveConversation === 'function') {
                        resumed = StoryManager.resumeActiveConversation();
                    }

                    // 2. 新規予約されている通常イベント
                    if (!resumed && typeof StoryManager.resumePendingEvent === 'function') {
                        resumed = StoryManager.resumePendingEvent();
                    }

                    // 3. バトル勝利後の報酬・後日談イベント
                    if (!resumed && typeof StoryManager.resumePendingBattleWinEvent === 'function') {
                        resumed = StoryManager.resumePendingBattleWinEvent();
                    }

                    // 深淵の裂け目戦の勝利後報酬。
                    // Battle.win() 中に報酬付与だけ確定し、フィールド復帰後に会話表示する。
                    if (!resumed && App.data?.dungeon?.pendingRiftReward?.active &&
                        typeof Dungeon !== 'undefined' && typeof Dungeon.resumePendingRiftReward === 'function') {
                        resumed = Dungeon.resumePendingRiftReward();
                    }

                    // 現在地タイルのアクション再評価。
                    // 以前は「移動した瞬間」だけアクションボタンを出していたため、
                    // 戦闘・宿屋・メニューなどを挟んでフィールドへ戻ると、同じタイル上でも
                    // App.clearAction() 済みのままボタンが消えることがありました。
                    // 今後は「現在地に対してアクションがあるか」をField側で再評価します。
                    // 進行中イベントが復元された場合は、会話/演出の邪魔をしないよう一旦消します。
                    if (resumed) {
                        App.clearAction();
                    } else if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
                        Field.refreshCurrentAction({ silent: true });
                    }
                }, 100);
            }
        }

		
        if(sceneId === 'battle') Battle.init();
        if(sceneId === 'inn') Facilities.initInn();
        if(sceneId === 'medal') Facilities.initMedal();
        if(sceneId === 'casino') Casino.init();
    }
};

/* main.js 内の Field オブジェクト全文 */

const Field = {
    x: 23, y: 28, 
    dir: 3, // 向き (0:下, 1:左, 2:右, 3:上)
    step: 1, // 歩行アニメ用 (1 または 2)
    ready: false, currentMapData: null,
	moveTimer: null, // ★追加：タイマー保持用

    // 待機中の足踏みアニメ用タイマー。
    // 重要: これは演出専用。Field.move() は呼ばず、座標/歩数/エンカウント/セーブには一切触れない。
    // requestAnimationFrameで常時描画すると負荷が増えるため、低頻度のsetIntervalでstepだけ切り替える。
    idleTimer: null,
    idleStepIntervalMs: 520,

    // ランダム生成ダンジョン内の特殊オブジェクト画像キャッシュ。
    // 冒険者NPC・全回復の泉・深淵の裂け目はタイル文字ではなく別データで管理し、
    // Field側で床の上に重ねる。既存の宝箱/階段/壁判定に影響させないため。
    directImageCache: {},

    getDirectImage: (src) => {
        if (!src) return null;
        if (!Field.directImageCache[src]) {
            const img = new Image();
            img.onload = () => {
                if (typeof Field !== 'undefined' && Field.ready) Field.render();
            };
            img.src = src;
            Field.directImageCache[src] = img;
        }
        return Field.directImageCache[src];
    },
	
	// ★追加：移動を強制停止するメソッド
    stopMove: () => {
        if (Field.moveTimer) {
            clearInterval(Field.moveTimer);
            Field.moveTimer = null;
        }
        // 長押し移動を離した後、フィールド上なら足踏みを再開する。
        // ただし会話/エンカウント遷移/報酬演出中は再開しない。
        if (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) return;
        if (typeof Field.startIdleStep === 'function') Field.startIdleStep();
    },

    shouldIdleStep: () => {
        const fieldScene = document.getElementById('field-scene');
        if (!fieldScene || fieldScene.style.display === 'none') return false;
        if (!Field.ready || !App.data) return false;
        if (Field.moveTimer) return false;
        if (document.hidden) return false;
        if (typeof Menu !== 'undefined' && typeof Menu.isMenuOpen === 'function' && Menu.isMenuOpen()) return false;
        if (typeof StoryManager !== 'undefined') {
            if (StoryManager.active || StoryManager.isTyping) return false;
        }
        const storyOverlay = document.getElementById('story-ui-overlay');
        if (storyOverlay && storyOverlay.style.display !== 'none') return false;
        if (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) return false;
        return true;
    },

    startIdleStep: () => {
        if (Field.idleTimer) return;
        if (typeof Field.shouldIdleStep === 'function' && !Field.shouldIdleStep()) return;

        Field.idleTimer = setInterval(() => {
            if (!Field.shouldIdleStep()) return;
            Field.step = (Field.step === 1) ? 2 : 1;
            Field.render();
        }, Field.idleStepIntervalMs);
    },

    stopIdleStep: () => {
        if (Field.idleTimer) {
            clearInterval(Field.idleTimer);
            Field.idleTimer = null;
        }
    },
    
    init: () => {
        if(App.data) {
            const areaKey = App.data.location.area || 'WORLD';
            
            // --- マップデータの復元ロジック ---
            if (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[areaKey]) {
                const fixedFloor = (typeof MapRegistry !== 'undefined' && MapRegistry.getFixedDungeonFloor)
                    ? MapRegistry.getFixedDungeonFloor(areaKey, App.data.progress.floor || 1)
                    : { ...FIXED_DUNGEON_MAPS[areaKey], isDungeon: true, isFixed: true };
                Field.currentMapData = fixedFloor;
                if(typeof Dungeon !== 'undefined') Dungeon.floor = App.data.progress.floor || fixedFloor.floor || 1;
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
        
        // ★修正：直接代入を App.updateHUD() の呼び出しに変更
        if (typeof App.updateHUD === 'function') {
            App.updateHUD();
        } else {
            // updateHUDがない場合のフォールバック（カンマ付き）
            if(document.getElementById('disp-gold')) document.getElementById('disp-gold').innerText = (App.data.gold || 0).toLocaleString();
            if(document.getElementById('disp-gem')) document.getElementById('disp-gem').innerText = (App.data.gems || 0).toLocaleString();
        }

        if(typeof Menu !== 'undefined') Menu.renderPartyBar();

        if (typeof Field.refreshCurrentAction === 'function') {
            Field.refreshCurrentAction({ silent: true });
        }

        if (typeof Field.startIdleStep === 'function') {
            Field.startIdleStep();
        }
    },

    enterFixedMap: (targetAreaKey) => {
        if (!targetAreaKey || typeof FIXED_MAPS === 'undefined' || !FIXED_MAPS[targetAreaKey]) return;
        const areaDef = FIXED_MAPS[targetAreaKey];
        App.data.mapReturnPoint = {
            areaKey: App.data.location.area || 'WORLD',
            x: Field.x,
            y: Field.y
        };
        App.data.transportMode = null;
        App.data.location.area = targetAreaKey;
        Field.currentMapData = areaDef;
        Field.x = areaDef.entryPoint ? areaDef.entryPoint.x : Math.floor(areaDef.width / 2);
        Field.y = areaDef.entryPoint ? areaDef.entryPoint.y : areaDef.height - 3;
        App.data.location.x = Field.x;
        App.data.location.y = Field.y;
        if (typeof App.discoverFixedMap === 'function') App.discoverFixedMap(targetAreaKey, { save: false });
        App.log(`${areaDef.name}に入った`);
        App.save();
        App.changeScene('field');
    },

    getCurrentAreaKey: () => {
        if (!Field.currentMapData) return 'WORLD';
        const locArea = App.data.location.area;
        if (locArea && (
            STORY_DATA.areas[locArea] ||
            (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[locArea]) ||
            (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[locArea])
        )) {
            return locArea;
        }
        const entry = Object.entries(STORY_DATA.areas).find(([key, area]) => area.name === Field.currentMapData.name);
        if (entry) return entry[0];
        if (typeof FIXED_DUNGEON_MAPS !== 'undefined') {
            const dungeonEntry = Object.entries(FIXED_DUNGEON_MAPS).find(([key, area]) => area.name === Field.currentMapData.baseName || area.name === Field.currentMapData.name);
            if (dungeonEntry) return dungeonEntry[0];
        }
        return Field.currentMapData.isDungeon ? 'DEFAULT' : 'WORLD';
    },

    getCurrentProgressMapKey: () => {
        const areaKey = Field.getCurrentAreaKey();
        if (Field.currentMapData?.isFixed && Field.currentMapData?.isDungeon && typeof MapRegistry !== 'undefined' && MapRegistry.getFixedDungeonProgressKey) {
            return MapRegistry.getFixedDungeonProgressKey(areaKey, App.data?.progress?.floor || Field.currentMapData.floor || 1);
        }
        return areaKey;
    },

    getCurrentTileTheme: (areaKey = null) => {
        const key = areaKey || Field.getCurrentAreaKey();
        const mapDef = Field.currentMapData || null;
        const themeKey = mapDef?.themeKey || key;

        // 優先順位:
        // 1. DEFAULT: 足りない記号の保険
        // 2. TILE_THEMES[themeKey]: MAPごとの基本見た目
        // 3. mapDef.tileOverrides: そのMAPだけの個別上書き
        return {
            ...(TILE_THEMES['DEFAULT'] || {}),
            ...(TILE_THEMES[themeKey] || TILE_THEMES[key] || {}),
            ...(mapDef?.tileOverrides || {})
        };
    },

    getTileConfig: (tileSign) => {
        const upper = String(tileSign || 'W').toUpperCase();
        const theme = Field.getCurrentTileTheme();
        
        let config = theme[upper] || TILE_THEMES['DEFAULT'][upper] || { img: null, color: '#000' };

        // ランダム生成ダンジョン専用: 溶岩マス(M)。
        // WORLDのM(山)とは意味が違うため、map.jsではなくここでダンジョン時だけ上書きする。
        if (Field.currentMapData && Field.currentMapData.isDungeon && upper === 'M') {
            return { img: 'magma', color: '#e4511e' };
        }

        if (upper === 'T' && Field.currentMapData && !Field.currentMapData.isDungeon && !config.img) {
            return { img: 'inn', color: '#444' };
        }
        return config;
    },

    getTileConfigForDraw: (tileSign, tileX = null, tileY = null) => {
        const base = Field.getTileConfig(tileSign);
        if (!Field.currentMapData && tileX !== null && tileY !== null && typeof MapRegistry !== 'undefined' && MapRegistry.getWorldTileConfig) {
            const special = MapRegistry.getWorldTileConfig(tileX, tileY);
            if (special) return { ...base, ...special };
        }
        return base;
    },

    isFixedDungeonOverlayTile: (tileSign) => {
        return !!Field.getFixedTileOverlayConfig(tileSign);
    },

    getFixedTileOverlayConfig: (tileSign, x = null, y = null) => {
        if (!Field.currentMapData?.isFixed) return null;
        const upper = String(tileSign || '').toUpperCase();

        // 固定ダンジョンのSは「外へ出る床タイル」として扱う。
        // 階段アイコンはD/Uだけに出す。将来Sにoverlayを誤設定しても出口なら床のままにする。
        let link = null;
        if (Field.currentMapData.isDungeon && ['S', 'D', 'U'].includes(upper)) {
            link = (typeof MapRegistry !== 'undefined' && MapRegistry.findFloorLink && x !== null && y !== null)
                ? MapRegistry.findFloorLink(Field.currentMapData, x, y)
                : null;
            if (upper === 'S' && (!link || link.to === 'EXIT')) return null;
        }

        let config = (typeof MapRegistry !== 'undefined' && MapRegistry.getFixedOverlayConfig)
            ? MapRegistry.getFixedOverlayConfig(Field.currentMapData, upper, x, y)
            : null;
        if (!config) return null;

        // 固定ダンジョンのD/Uは、リンク先に合わせて上り/下りアイコンを自動切替。
        // 塔は「階数が大きい＝上り」、地下MAPは「地下が深い＝下り」として扱う。
        if (Field.currentMapData.isDungeon && ['D', 'U'].includes(upper)) {
            const currentFloor = Number(App.data?.progress?.floor || Field.currentMapData.floor || 1);
            const direction = (typeof MapRegistry !== 'undefined' && MapRegistry.getFixedFloorDirection)
                ? MapRegistry.getFixedFloorDirection(Field.currentMapData, link, currentFloor, Field.getCurrentAreaKey())
                : null;
            let stairImg = config.img;
            if (direction === 'down') stairImg = 'overlay_named_dungeon_stairs_down';
            else if (direction === 'up') stairImg = 'overlay_named_dungeon_stairs_up';
            else if (upper === 'D') stairImg = 'overlay_named_dungeon_stairs_down';
            else if (upper === 'U') stairImg = 'overlay_named_dungeon_stairs_up';
            config = { img: stairImg, color: config.color || '#d7b45a' };
        }
        return config;
    },

    getFixedTileOverlayBaseTile: (tileSign) => {
        if (!Field.currentMapData?.isFixed) return 'T';
        if (typeof MapRegistry !== 'undefined' && MapRegistry.getFixedOverlayBaseTile) {
            return MapRegistry.getFixedOverlayBaseTile(Field.currentMapData, tileSign);
        }
        return 'T';
    },

    getRenderedTileForDraw: (tileX, tileY, mapW, mapH, areaKey) => {
        let nextTile = 'W';
        if (Field.currentMapData) {
            if (tileX >= 0 && tileX < mapW && tileY >= 0 && tileY < mapH) {
                const posKey = `${tileX},${tileY}`;
                nextTile = App.data.progress.mapChanges?.[areaKey]?.[posKey] || Field.currentMapData.tiles[tileY][tileX];
                if (Field.currentMapData.isFixed) {
                    const progressKey = Field.getCurrentProgressMapKey();
                    if ((nextTile === 'C' || nextTile === 'R') && App.data.progress.openedChests?.[progressKey]?.includes(posKey)) nextTile = 'G';
                    if (nextTile === 'B' && App.data.progress.defeatedBosses?.[progressKey]?.includes(posKey)) nextTile = 'G';
                }
            }
        } else {
            nextTile = MAP_DATA[((tileY % mapH) + mapH) % mapH][((tileX % mapW) + mapW) % mapW];
        }
        return String(nextTile || 'W').toUpperCase();
    },

    /**
     * 現在地タイルの情報を、表示/アクション判定用に取得する。
     *
     * 重要:
     * - アクションボタンは「移動時だけ」ではなく、フィールド復帰時にも再評価する。
     * - そのため、現在地タイル判定は move() の中へ閉じ込めず、この関数へ集約する。
     * - Codex等で修正する際も、宿屋/村/ボス等のアクション判定を move() だけに戻さないこと。
     */
    getCurrentTileInfo: () => {
        if (!App.data) return null;

        if (Field.currentMapData) {
            const areaKey = Field.getCurrentAreaKey();
            const x = Number(Field.x);
            const y = Number(Field.y);
            if (x < 0 || y < 0 || x >= Field.currentMapData.width || y >= Field.currentMapData.height) return null;

            const posKey = `${x},${y}`;
            let tile = App.data.progress.mapChanges?.[areaKey]?.[posKey] || Field.currentMapData.tiles[y][x];
            tile = String(tile || 'W').toUpperCase();

            if (Field.currentMapData.isFixed) {
                const progressKey = Field.getCurrentProgressMapKey();
                if ((tile === 'C' || tile === 'R') && App.data.progress.openedChests?.[progressKey]?.includes(posKey)) tile = 'G';
                if (tile === 'B' && App.data.progress.defeatedBosses?.[progressKey]?.includes(posKey)) tile = 'G';
            }

            return { tile, x, y, areaKey, isWorld: false };
        }

        if (typeof MAP_DATA === 'undefined' || !MAP_DATA[0]) return null;
        const mapW = MAP_DATA[0].length;
        const mapH = MAP_DATA.length;
        const x = ((Number(Field.x) % mapW) + mapW) % mapW;
        const y = ((Number(Field.y) % mapH) + mapH) % mapH;
        const tile = String(MAP_DATA[y][x] || 'W').toUpperCase();

        return { tile, x, y, areaKey: 'WORLD', isWorld: true };
    },

    executeMapAction: (action) => {
        if (!action) return;

        // map.js の mapActions で requiredItemId を指定すると、所持時のみ実行する。
        // 例: 朽ちた祠の石碑は「災厄の楔」所持時だけ隠しボス戦へ進む。
        if (action.requiredItemId !== undefined && typeof App.hasItem === 'function' && !App.hasItem(action.requiredItemId)) {
            const msg = action.requiredItemMissingText || '今は何も起こらないようだ。';
            App.log(msg);
            return;
        }

        if (action.log) App.log(action.log);

        if (action.type === 'fixedDungeon' && action.target && typeof Dungeon !== 'undefined' && Dungeon.startFixed) {
            Dungeon.startFixed(action.target);
            return;
        }

        if (action.type === 'abyssDungeon' && typeof Dungeon !== 'undefined') {
            if (!App.requireFeatureUnlocked('abyss')) return;
            Dungeon.enter();
            return;
        }

        if (action.type === 'storyEvent' && action.eventId && typeof StoryManager !== 'undefined') {
            StoryManager.executeEvent(action.eventId);
            return;
        }

        if (action.type === 'limitBreakTrial' && typeof App.startLimitBreakTrial === 'function') {
            App.startLimitBreakTrial(action);
            return;
        }

        if (action.type === 'boss') {
            const fixedBossId = action.monsterId !== undefined ? action.monsterId : null;
            let isSpecialBoss = !!action.special;
            if (!isSpecialBoss && fixedBossId !== null) {
                const base = window.MonsterData?.getMonsterById?.(Number(fixedBossId));
                isSpecialBoss = !!(base?.isSpecialBoss || base?.isEstark || Number(fixedBossId) === 902000);
            }
            App.data.battle = {
                active: false,
                isBossBattle: true,
                fixedBossId,
                isSpecialBoss,
                isEstark: isSpecialBoss
            };
            App.save();
            App.changeScene('battle');
            return;
        }
    },

    /**
     * 現在地タイルに応じてアクションボタンを再構築する。
     *
     * これが今回の主修正。
     * 以前は移動時に App.setAction() した後、戦闘/施設/イベント復帰時の
     * App.clearAction() によりボタンが失われていた。
     * 今後はフィールドへ戻った時点でもこの関数を呼び、
     * 「同じタイル上にいる限りアクションボタンを維持する」挙動に統一する。
     */
    refreshCurrentAction: (options = {}) => {
        const silent = options.silent !== false;
        const fieldScene = document.getElementById('field-scene');
        if (fieldScene && fieldScene.style.display === 'none') return false;

        App.clearAction();

        const info = Field.getCurrentTileInfo();
        if (!info) return false;

        const { tile, x, y } = info;
        const logIfNeeded = (message) => {
            if (!silent && message) App.log(message);
        };

        if (Field.currentMapData) {
            if (tile === 'W') return false;

            // 回復の泉。触れただけでは回復せず、ボタン押下で初めて回復する。
            // 床の上に重ねて表示しているため、通常タイルとは別に現在地座標で判定する。
            if (typeof Dungeon !== 'undefined' && typeof Dungeon.isHealSpringAt === 'function' && Dungeon.isHealSpringAt(x, y)) {
                logIfNeeded('清らかな泉が湧いている。');
                App.setAction('泉で回復', () => Dungeon.useHealSpring());
                return true;
            }

            // ランダム生成ダンジョン内の冒険者NPC。
            // 通常タイルとは別管理なので、タイル文字を増やさず現在地座標で判定する。
            // 接触後に「いいえ」を選んでも同じ場所で話しかけ直せるよう、
            // アクションボタンの再評価対象にも含める。
            if (typeof Dungeon !== 'undefined' && typeof Dungeon.isAdventurerAt === 'function' && Dungeon.isAdventurerAt(x, y)) {
                App.setAction('話す', () => Dungeon.encounterAdventurer({ auto: false }));
                return true;
            }

            // 深淵の裂け目。いいえを選んだ後も同じ場所で再調査できるよう、
            // アクションボタンの再評価対象に含める。
            if (typeof Dungeon !== 'undefined' && typeof Dungeon.isAbyssRiftAt === 'function' && Dungeon.isAbyssRiftAt(x, y)) {
                logIfNeeded('闇がどこまでも続いているような亀裂がある。');
                App.setAction('亀裂を調べる', () => Dungeon.encounterAbyssRift({ auto: false }));
                return true;
            }

            if (!Field.currentMapData.isDungeon) {
                const mapAction = (typeof MapRegistry !== 'undefined' && MapRegistry.findMapAction)
                    ? MapRegistry.findMapAction(Field.currentMapData, x, y)
                    : null;
                if (mapAction) {
                    if (mapAction.log) logIfNeeded(mapAction.log);
                    if (mapAction.type === 'abyssDungeon') {
                        App.setFeatureAction(mapAction.label || '魔窟に入る', 'abyss', () => Field.executeMapAction(mapAction));
                    } else {
                        App.setAction(mapAction.label || '調べる', () => Field.executeMapAction(mapAction));
                    }
                    return true;
                }

                if (tile === 'I') {
                    logIfNeeded('宿屋のようだ。');
                    App.setAction('泊まる', () => App.changeScene('inn'));
                } else if (tile === 'K') {
                    logIfNeeded('カジノの看板だ。');
                    App.setFeatureAction('カジノに入る', 'casino', () => App.changeScene('casino'));
                } else if (tile === 'E') {
                    logIfNeeded('交換所のようだ。');
                    App.setFeatureAction('メダル交換', 'medalKing', () => App.changeScene('medal'));
                }
            } else if (Field.currentMapData.isFixed && typeof Dungeon !== 'undefined' && typeof Dungeon.prepareFixedTileAction === 'function') {
                if (Dungeon.prepareFixedTileAction(tile, x, y, { silent })) return true;
            }

            if (tile === 'V' || tile === 'H' || tile === 'B') {
                if (typeof StoryManager !== 'undefined' && Array.isArray(StoryManager.triggers)) {
                    const currentStep = Number(App.data.progress.storyStep);
                    const currentSub = Number(App.data.progress.subStep || 0);

                    const trigger = StoryManager.triggers.find(t => {
                        const areaMatch = t.area === App.data.location.area;
                        const posMatch = Number(t.x) === Number(x) && Number(t.y) === Number(y);

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
                        const actionLabel = (tile === 'B') ? '戦う' : '話す';
                        App.setAction(actionLabel, () => StoryManager.executeEvent(trigger.eventId));
                    } else {
                        logIfNeeded('誰かいるようだ。');
                    }
                }
            }

            if (tile === 'B' && Field.currentMapData.isFixed && Field.currentMapData.isDungeon && !App.pendingAction && typeof Dungeon !== 'undefined' && typeof Dungeon.startFixedBoss === 'function') {
                App.setAction('ボスと戦う', () => Dungeon.startFixedBoss(x, y));
            }

            return !!App.pendingAction;
        }

        if (typeof App.isFlying === 'function' && App.isFlying()) return false;

        let targetAreaKey = null;
        if (typeof MapRegistry !== 'undefined' && typeof MapRegistry.getWorldAreaAt === 'function') {
            const entry = MapRegistry.getWorldAreaAt(x, y);
            targetAreaKey = entry ? entry[0] : null;
        } else {
            for (let key in STORY_DATA.areas) {
                if (STORY_DATA.areas[key].centerX === x && STORY_DATA.areas[key].centerY === y) {
                    targetAreaKey = key;
                    break;
                }
            }
        }

        if (targetAreaKey && typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[targetAreaKey]) {
            const areaDef = FIXED_MAPS[targetAreaKey];
            App.setAction(`${areaDef.name}に入る`, () => Field.enterFixedMap(targetAreaKey));
        } else if (targetAreaKey && typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[targetAreaKey]) {
            const areaDef = FIXED_DUNGEON_MAPS[targetAreaKey];
            App.setAction(`${areaDef.name}に入る`, () => Dungeon.startFixed(targetAreaKey));
        } else if (tile === 'I' || tile === 'B') {
                logIfNeeded('小さな休憩所がある。');
                App.setAction('休む', () => App.changeScene('inn'));
        } else if (tile === 'E') {
            App.setFeatureAction('メダル交換', 'medalKing', () => App.changeScene('medal'));
        } else if (tile === 'K') {
            App.setFeatureAction('カジノに入る', 'casino', () => App.changeScene('casino'));
        } else if (tile === 'D') {
            logIfNeeded('不気味な穴が開いている…「深淵の魔窟」だ');
            if (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS.ABYSS_FIELD) {
                App.setFeatureAction('魔窟の外縁へ', 'abyss', () => {
                    Field.enterFixedMap('ABYSS_FIELD');
                });
            } else {
                App.setFeatureAction('魔窟に入る', 'abyss', () => {
                    App.data.location.area = 'ABYSS';
                    Dungeon.enter();
                });
            }
        }

        return !!App.pendingAction;
    },

    getDungeonWallGraphicForDraw: (tileX, tileY, upper, mapW, mapH, areaKey) => {
        if (!Field.currentMapData?.isDungeon || upper !== 'W') return null;

        // 固定ダンジョンはMAPごとのW画像を優先する。
        // 汎用の wall_face に差し替えると、大灯台/雷の要塞/光の宮殿/魔王城が同じ壁に見えるため。
        // 例外的に汎用壁面を使いたいMAPだけ、map.js側で useDungeonWallFace: true を設定する。
        if (Field.currentMapData.isFixed && !Field.currentMapData.useDungeonWallFace) return null;

        if (Field.getRenderedTileForDraw(tileX, tileY + 1, mapW, mapH, areaKey) === 'W') return null;
        return (((tileX % 5) + 5) % 5) === 0 ? 'wall_face_torch' : 'wall_face';
    },
    
    getBattleBg: () => {
        if (App.data.battle && (App.data.battle.isSpecialBoss || App.data.battle.isEstark)) return 'battle_bg_lastboss';
        if (App.data.battle?.encounterType === 'sea') return 'battle_bg_sea';
        if (Field.currentMapData) {
            if (Field.currentMapData.battleBg) return Field.currentMapData.battleBg;
            if (Field.currentMapData.isDungeon) {
                const mapW = Field.currentMapData.width || 1;
                const mapH = Field.currentMapData.height || 1;
                const areaKey = Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : 'ABYSS';
                const currentTile = Field.getRenderedTileForDraw
                    ? Field.getRenderedTileForDraw(Field.x, Field.y, mapW, mapH, areaKey)
                    : String(Field.currentMapData.tiles?.[Field.y]?.[Field.x] || '').toUpperCase();

                // 溶岩フロアでは、溶岩マス上に限らず階層全体を炎背景にする。
                // 「溶岩地帯に入った」というフロア体験を優先するため、現在地タイル判定には戻さないこと。
                if (App.data?.dungeon?.isLavaFloor) return 'battle_bg_fire';

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
        if (tile === 'W') return 'battle_bg_sea';
        if (tile === 'F') return 'battle_bg_forest';
        if (tile === 'L') return 'battle_bg_mountain';
        return 'battle_bg_field';
    },
	
    drawDungeonAtmosphere: (ctx, w, h) => {
        if (!Field.currentMapData?.isDungeon || typeof Dungeon === 'undefined') return;
        const dungeon = App.data?.dungeon || {};

        ctx.save();

        // 溶岩フロア: 画面全体にごく薄いオレンジの熱気をかける。
        // 濃くしすぎると操作性が落ちるため、視認できる程度に抑える。
        if (dungeon.isLavaFloor) {
            // 以前の濃度では端末や背景によってほぼ見えなかったため、
            // 操作性を損なわない範囲で明確に「熱気」と分かる濃度へ引き上げる。
            const pulse = 0.075 + (Math.sin(Date.now() / 700) + 1) * 0.025;
            const grad = ctx.createRadialGradient(w * 0.5, h * 0.58, 12, w * 0.5, h * 0.55, Math.max(w, h) * 0.78);
            grad.addColorStop(0, `rgba(255, 176, 48, ${pulse})`);
            grad.addColorStop(0.52, 'rgba(255, 102, 20, 0.125)');
            grad.addColorStop(1, 'rgba(255, 48, 0, 0.22)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = 'rgba(255, 120, 24, 0.055)';
            for (let y = 0; y < h; y += 34) {
                const offset = Math.sin((Date.now() / 520) + y * 0.03) * 12;
                ctx.fillRect(offset - 18, y, w + 36, 3);
            }
        }

        // 迷路フロア: 揺らぎなしの静的ビネット。
        // 前回の黒い縦もやは画面全体にかかって見えたため廃止。
        // 中央は完全に透明に近く保ち、画面端だけを暗くする。
        if (typeof Dungeon.isMazeFloor === 'function' && Dungeon.isMazeFloor()) {
            const vignette = ctx.createRadialGradient(
                w * 0.5, h * 0.52, Math.min(w, h) * 0.34,
                w * 0.5, h * 0.52, Math.max(w, h) * 0.76
            );
            vignette.addColorStop(0.00, 'rgba(0, 0, 0, 0.00)');
            vignette.addColorStop(0.52, 'rgba(0, 0, 0, 0.00)');
            vignette.addColorStop(0.78, 'rgba(0, 0, 0, 0.28)');
            vignette.addColorStop(1.00, 'rgba(0, 0, 0, 0.68)');
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, w, h);

            // 端だけを少し締める。中央視界や操作ボタン側へ濃いもやを出さない。
            const edge = Math.max(20, Math.floor(Math.min(w, h) * 0.055));
            ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
            ctx.fillRect(0, 0, w, edge);
            ctx.fillRect(0, h - edge, w, edge);
            ctx.fillRect(0, 0, edge, h);
            ctx.fillRect(w - edge, 0, edge, h);
        }

        ctx.restore();
    },

	move: (dx, dy) => {
        // レア報酬演出・エンカウント遷移・会話/選択肢/会話ログ中は移動入力を無視する。
        // ここで止めないと、戦闘開始待ちの間にさらに進んでNPC/裂け目会話が戦闘画面へ重なる。
        if (typeof App.isFieldControlBlocked === 'function' && App.isFieldControlBlocked()) {
            Field.stopMove();
            return;
        }

        // 待機中の足踏みは、実移動入力が入ったら一旦止める。
        // ここでField.move()を疑似的に呼ぶ実装にはしないこと。足踏みはstep切替のみ。
        if (typeof Field.stopIdleStep === 'function') Field.stopIdleStep();

		// ★追加: 一歩歩くごとにログを空欄にする処理
        const logEl = document.getElementById('msg-text');
        if (logEl) logEl.innerHTML = '';
		
        if (dy > 0) Field.dir = 0; else if (dx < 0) Field.dir = 1; else if (dx > 0) Field.dir = 2; else if (dy < 0) Field.dir = 3;
        Field.step = (Field.step === 1) ? 2 : 1;
        let nx = Field.x + dx, ny = Field.y + dy;
        App.clearAction();

        // 移動失敗時も現在地タイルのアクションを復元する。
        // 以前はここで App.clearAction() した後、壁/マップ外/海などで return していたため、
        // イベント・宿屋・ボス等のタイル上で移動できない方向へ入力するとボタンが消えていました。
        // 今後、移動不可 return を追加する場合も、この helper を通して現在地を再評価してください。
        const keepCurrentTileAction = () => {
            if (typeof Field.refreshCurrentAction === 'function') {
                Field.refreshCurrentAction({ silent: true });
            }
            if (typeof Field.startIdleStep === 'function') Field.startIdleStep();
        };
		
		// ★修正点: エラー回避のため、現在のエリアキーを取得しておく
        const areaKey = Field.getCurrentAreaKey();

        if (Field.currentMapData) {
            if (nx < 0 || nx >= Field.currentMapData.width || ny < 0 || ny >= Field.currentMapData.height) { keepCurrentTileAction(); return; }
            
			//let tile = Field.currentMapData.tiles[ny][nx].toUpperCase();
			// ★修正: 書き換えられたタイルがあればそれを優先、なければ元のタイルを参照
			let tile = (App.data.progress.mapChanges?.[areaKey]?.[`${nx},${ny}`] || Field.currentMapData.tiles[ny][nx]).toUpperCase();

            // ★追加: 固定宝箱/ボスの判定を移動前に行う (撃破・取得済みなら通り抜け可能にする)
            if (Field.currentMapData.isFixed) {
                const ak = Field.getCurrentProgressMapKey();
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

            if (tile === 'W') { keepCurrentTileAction(); return; } 

            if (tile === 'S' && !Field.currentMapData.isDungeon) {
                const areaKey = App.data.location.area;
                if (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[areaKey]) {
                    const saved = App.data.mapReturnPoint;
                    const areaDef = (typeof STORY_DATA !== 'undefined' && STORY_DATA.areas) ? STORY_DATA.areas[areaKey] : null;
                    const fallback = areaDef
                        ? { area: 'WORLD', x: areaDef.centerX, y: areaDef.centerY }
                        : (FIXED_MAPS[areaKey].exitPoint || { area: 'WORLD', x: Field.x, y: Field.y });
                    const exit = (saved && saved.areaKey === 'WORLD')
                        ? { area: 'WORLD', x: saved.x, y: saved.y }
                        : fallback;
                    App.data.mapReturnPoint = null;
                    App.data.location.area = 'WORLD';
                    App.data.transportMode = null;
                    Field.x = exit.x; Field.y = exit.y;
                    App.data.location.x = exit.x; App.data.location.y = exit.y;
                    Field.currentMapData = null; 
                    App.log("フィールドへ出た");
                    App.save(); Field.render();
                    if (typeof Field.startIdleStep === 'function') Field.startIdleStep();
                    return;
                }
            }

            Field.x = nx; Field.y = ny;
            App.data.location.x = nx; App.data.location.y = ny;

            // 現在地タイルのアクション判定は refreshCurrentAction に統一。
            // move() 内だけに判定を書くと、戦闘/施設/イベント復帰時にボタンが復元されないため。
            Field.refreshCurrentAction({ silent: false });

            if (Field.currentMapData.isDungeon) Dungeon.handleMove(nx, ny);
            App.save(); Field.render();
            if (typeof Field.startIdleStep === 'function') Field.startIdleStep();
			
        } else {
            const mapW = MAP_DATA[0].length, mapH = MAP_DATA.length;
            nx = (nx + mapW) % mapW; ny = (ny + mapH) % mapH;
            const tile = MAP_DATA[ny][nx].toUpperCase();
            const isFlying = typeof App.isFlying === 'function' && App.isFlying();
            if (!isFlying && tile === 'M') { App.log("険しい岩山だ"); keepCurrentTileAction(); return; }
            if (!isFlying && tile === 'W') {
                if (!App.hasMagicBoat || !App.hasMagicBoat()) { App.log("海は船がないと渡れない…"); keepCurrentTileAction(); return; }
                if (App.data.transportMode !== 'boat') App.log("魔法の小舟で海へ漕ぎ出した。");
                App.data.transportMode = 'boat';
            }
            if (!isFlying && tile !== 'W' && App.data.transportMode === 'boat') {
                App.data.transportMode = null;
                App.log("小舟を降りた。");
            }
            Field.x = nx; Field.y = ny; App.data.location.x = nx; App.data.location.y = ny; 
            const hasTileAction = isFlying ? false : Field.refreshCurrentAction({ silent: false });
            if (!isFlying && !hasTileAction) {
                // --- エンカウント判定ロジック ---
                const occurred = App.tryRandomEncounter(tile === 'W' ? 0.04 : null);
                if (occurred) {
                    App.save();
                    Field.render();
                    return;
                }
            }
			
            if(App.data.walkCount === undefined) App.data.walkCount = 0;
            App.data.walkCount++; App.save(); Field.render();
            if (typeof Field.startIdleStep === 'function') Field.startIdleStep();
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
        
        const areaKey = Field.getCurrentAreaKey();

        // --- 内部ヘルパー: スプライトシート対応の描画関数 ---
        const drawGraphic = (imgName, dx, dy, targetSize) => {
            if (!imgName) return false;
            
            // 1. GRAPHICS.spriteDefs に定義があるか確認
            const sprite = GRAPHICS.spriteDefs ? GRAPHICS.spriteDefs[imgName] : null;
            
            if (sprite && g[sprite.sheet]) {
                // スプライトシートから指定範囲を切り出して描画 (9引数版)
                ctx.drawImage(
                    g[sprite.sheet], 
                    sprite.x, sprite.y, sprite.w, sprite.h, 
                    dx, dy, targetSize, targetSize
                );
                return true;
            } else if (g[imgName]) {
                // 従来通りの単体画像 (Base64等) として描画
                ctx.drawImage(g[imgName], dx, dy, targetSize, targetSize);
                return true;
            }
            return false;
        };

        for (let dy = -rangeY; dy <= rangeY; dy++) {
            for (let dx = -rangeX; dx <= rangeX; dx++) {
                const drawX = Math.floor(cx + (dx * ts) - (ts / 2)), drawY = Math.floor(cy + (dy * ts) - (ts / 2));
                let tx = Field.x + dx, ty = Field.y + dy, tile = Field.getRenderedTileForDraw(tx, ty, mapW, mapH, areaKey);
                const config = Field.getTileConfigForDraw ? Field.getTileConfigForDraw(tile, tx, ty) : Field.getTileConfig(tile);
                const upper = tile.toUpperCase();
                const wallGraphic = Field.getDungeonWallGraphicForDraw(tx, ty, upper, mapW, mapH, areaKey);
                const overlayConfig = Field.getFixedTileOverlayConfig ? Field.getFixedTileOverlayConfig(upper, tx, ty) : null;
                const overlayBaseTile = overlayConfig && Field.getFixedTileOverlayBaseTile ? Field.getFixedTileOverlayBaseTile(upper) : null;
                const groundTile = overlayBaseTile || (upper === 'G' ? 'G' : 'T');
                // 地面は座標依存のフィールド施設オーバーレイを混ぜず、純粋な床タイルとして描く。
                // これにより透過素材の下が黒くならず、G/Tなどの地面の上に施設画像が重なる。
                const floorConfig = Field.getTileConfig(groundTile);

                // 1. 地面の描画。
                // 固定MAP/固定ダンジョンの施設・宝箱・階段・ボス等は、ここで床を描いてからオーバーレイを重ねる。
                if (!drawGraphic(floorConfig.img, drawX, drawY, ts)) {
                    ctx.fillStyle = floorConfig.color;
                    ctx.fillRect(drawX, drawY, ts, ts);
                }

                // 2. 通常オブジェクトの描画。overlayConfig があるタイルはここでは描かない。
                if (upper !== 'T' && upper !== 'G' && !overlayConfig) {
                    if (!drawGraphic(wallGraphic || config.img, drawX, drawY, ts)) {
                        if (config.color && config.color !== floorConfig.color) {
                            ctx.fillStyle = config.color;
                            ctx.fillRect(drawX, drawY, ts, ts);
                        }
                    }
                }

                // 3. 固定MAP/固定ダンジョン専用オーバーレイ。
                if (overlayConfig) {
                    if (!drawGraphic(overlayConfig.img, drawX, drawY, ts)) {
                        ctx.save();
                        ctx.fillStyle = overlayConfig.color || config.color || '#fff';
                        ctx.beginPath();
                        ctx.arc(drawX + ts / 2, drawY + ts / 2, ts * 0.34, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }
        }

        // 3. ランダム生成ダンジョン内の特殊オブジェクト描画。
        // タイル文字を増やさず App.data.dungeon.* で管理するため、
        // 地形・宝箱・階段などの既存生成ロジックを壊さない。
        const drawOverlayImage = (obj, fallbackSrc, fallbackColor) => {
            if (!Field.currentMapData?.isDungeon || !obj || !obj.active || Number(obj.floor) !== Number(Dungeon.floor)) return;
            const ox = Number(obj.x) - Number(Field.x);
            const oy = Number(obj.y) - Number(Field.y);
            if (Math.abs(ox) > rangeX || Math.abs(oy) > rangeY) return;

            const px = Math.floor(cx + (ox * ts) - (ts / 2));
            const py = Math.floor(cy + (oy * ts) - (ts / 2));
            const img = Field.getDirectImage(obj.image || fallbackSrc);
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.save();
                ctx.drawImage(img, px, py, ts, ts);
                ctx.restore();
            } else {
                ctx.save();
                ctx.fillStyle = fallbackColor;
                ctx.beginPath();
                ctx.arc(px + ts / 2, py + ts / 2, ts * 0.34, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        };

        drawOverlayImage(App.data?.dungeon?.healSpring, 'assets/effect/fx-buff-ai.png', '#80ffb0');
        drawOverlayImage(App.data?.dungeon?.abyssRift, 'assets/effect/fx-abyss-vortex-ai.png', '#a34cff');
        drawOverlayImage(App.data?.dungeon?.adventurer, 'assets/monsters/monster_100009.png', '#5bd6ff');

        // 4. プレイヤーの描画 (hero_... の画像もスプライトシート化していれば対応可能)
        const pKey = `hero_${['down','left','right','up'][Field.dir]}_${Field.step}`; 
        if (!drawGraphic(pKey, cx-ts/2, cy-ts/2, ts)) {
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();
        }

        // 特殊フロアの空気感をキャンバス上に重ねる。
        // ミニマップはこの後に描くため、もやでミニマップが読めなくなることはない。
        if (typeof Field.drawDungeonAtmosphere === 'function') Field.drawDungeonAtmosphere(ctx, w, h);

        let locName = Field.currentMapData ? Field.currentMapData.name : `世界地図 (${Field.x}, ${Field.y})`;
        if (!Field.currentMapData && App.data?.transportMode === 'flying') locName += ' - 飛行中';
        if (!Field.currentMapData && App.data?.transportMode === 'boat') locName += ' - 小舟';
        if (Field.currentMapData && Field.currentMapData.isDungeon) {
            if (Field.currentMapData.isFixed) {
                const baseName = Field.currentMapData.baseName || Field.currentMapData.name;
                const floorLabel = Field.currentMapData.floorLabel || `${Dungeon.floor}階`;
                locName = Field.currentMapData.displayName || `${baseName} ${floorLabel}`;
            } else {
                locName = `${locName} ${Dungeon.floor}階`;
            }
        }
        document.getElementById('loc-name').innerText = locName;
        if (typeof App.updateObjectiveHUD === 'function') App.updateObjectiveHUD();

        const mmSize = 80, mmX = w-mmSize-10, mmY = 10, range = 10; 
        ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(mmX, mmY, mmSize, mmSize);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(mmX, mmY, mmSize, mmSize);

        const dms = mmSize / (range*2); 
        for(let mdy = -range; mdy < range; mdy++) {
            for(let mdx = -range; mdx < range; mdx++) {
                let mtx = Field.x + mdx; let mty = Field.y + mdy; let mtile = 'W';
                let minimapVisible = true;
                if (Field.currentMapData) { 
                    if(mtx>=0 && mtx<mapW && mty>=0 && mty<mapH) {
                        const ak = Field.getCurrentAreaKey(); const pk = `${mtx},${mty}`;

                        // 迷路フロアでは、未踏破マスをミニマップに表示しない。
                        // 現在地だけは常に表示し、歩くたび Dungeon.markVisited() で記録される。
                        if (typeof Dungeon !== 'undefined' && typeof Dungeon.isMazeFloor === 'function' && Dungeon.isMazeFloor()) {
                            // 迷路フロアは「踏破済み」に加えて、現在地を中心とした周囲4マスを表示する。
                            // 完全な踏破表示だけだと視界が狭すぎるため、現在の探索視界として9x9相当を保証する。
                            const inCurrentSight = Math.abs(mdx) <= 4 && Math.abs(mdy) <= 4;
                            if (!inCurrentSight && typeof Dungeon.isVisited === 'function' && !Dungeon.isVisited(mtx, mty)) {
                                minimapVisible = false;
                            }
                        }

                        mtile = App.data.progress.mapChanges?.[areaKey]?.[pk] || Field.currentMapData.tiles[mty][mtx];
                        const progressKey = Field.currentMapData?.isFixed && Field.getCurrentProgressMapKey
                            ? Field.getCurrentProgressMapKey()
                            : ak;
                        if (App.data.progress.openedChests?.[progressKey]?.includes(pk)) mtile = 'G';
                        if (App.data.progress.defeatedBosses?.[progressKey]?.includes(pk)) mtile = 'G';
                    } else {
                        minimapVisible = false;
                    }
                } else { mtile = MAP_DATA[((mty%mapH)+mapH)%mapH][((mtx%mapW)+mapW)%mapW]; }
                if (!minimapVisible) continue;
                if (mdx===0 && mdy===0) ctx.fillStyle = '#fff'; else ctx.fillStyle = (Field.getTileConfigForDraw ? Field.getTileConfigForDraw(mtile, mtx, mty) : Field.getTileConfig(mtile)).color;
                if (ctx.fillStyle !== '#000') ctx.fillRect(mmX + (mdx + range) * dms, mmY + (mdy + range) * dms, dms, dms);
            }
        }

        // ミニマップ上にも、タイル文字で管理していない特殊オブジェクトを表示する。
        // プレイヤーと同じマスにいる場合は、現在地の白マーカーを優先する。
        const drawMiniObject = (obj, color) => {
            if (!Field.currentMapData?.isDungeon || !obj || !obj.active || Number(obj.floor) !== Number(Dungeon.floor)) return;
            const relX = Number(obj.x) - Number(Field.x);
            const relY = Number(obj.y) - Number(Field.y);
            if (relX === 0 && relY === 0) return;
            if (relX < -range || relX >= range || relY < -range || relY >= range) return;
            if (typeof Dungeon !== 'undefined' && typeof Dungeon.isMazeFloor === 'function' && Dungeon.isMazeFloor()) {
                const inCurrentSight = Math.abs(relX) <= 4 && Math.abs(relY) <= 4;
                if (!inCurrentSight && typeof Dungeon.isVisited === 'function' && !Dungeon.isVisited(Number(obj.x), Number(obj.y))) return;
            }
            ctx.fillStyle = color;
            ctx.fillRect(mmX + (relX + range) * dms, mmY + (relY + range) * dms, Math.max(2, dms), Math.max(2, dms));
        };
        drawMiniObject(App.data?.dungeon?.healSpring, '#80ffb0');
        drawMiniObject(App.data?.dungeon?.abyssRift, '#a34cff');
        drawMiniObject(App.data?.dungeon?.adventurer, '#5bd6ff');

        ctx.restore();
    }
};
