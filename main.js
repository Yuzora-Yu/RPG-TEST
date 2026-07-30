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
        this.config = data.config || { fullAuto: false, hiddenSkills: [], autoDisabledSkills: [], skillUsageConfigVersion: 2, strategy: 'balanced' };
        
        // 万が一データ側にconfigがなければ、初期値をデータ側にもセットして参照を同期させる
        if (!data.config) data.config = this.config;

        this.tree = data.tree || { 
            ATK: 0, MAG: 0, SPD: 0, HP: 0, MP: 0,
            WARRIOR: 0, MAGE: 0, PRIEST: 0, M_KNIGHT: 0
        };
		
        this.skills = [DB.SKILLS.find(s => s.id === 1)].filter(Boolean);

        // モンスター仲間など、セーブデータ側に直接保持されたスキルを先に読み込む。
        // 通常行動(ID:1〜99)は保存時点で除外するが、念のためここでも不正値を無視する。
        if (Array.isArray(data.skills)) {
            data.skills.forEach(sid => {
                const id = Math.floor(Number(sid));
                if (Number.isFinite(id) && id > 0) this.learnSkill(id);
            });
        }

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
        this.mp = Math.floor((data.mp || 0) * scale);
        this.baseMaxMp = this.mp;
        
        // 攻撃力等は少し高くして、戦闘のテンポを上げる（受けるダメ増、敵すぐ死ぬ）
        this.baseStats.atk = Math.floor((data.atk || 10) * scale * statMod);
        this.baseStats.def = Math.floor((data.def || 10) * scale); 
        this.baseStats.spd = Math.floor((data.spd || 10) * scale);
        this.baseStats.mag = Math.floor((data.mag || 10) * scale * statMod);
        this.baseStats.mdef = Math.floor((data.mdef || 0) * scale);
        
        this.acts = data.acts || [1];
        this.baseId = data.id;
        // 表示用画像IDは昇格試験など、戦闘用IDと画像アセットIDが異なる敵で必須。
        this.imageId = data.imageId ?? data.baseImageId ?? null;
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
		if (!char) return false;
		if (char.imageEdit && char.imageEdit.src) return true;
		if (!char.img) return false;
		if (char.customImage === true || char.hasCustomImage === true) return true;
		const master = App.getCharacterMaster(char);
		if (master && char.img === master.img) return false;
		if (App.isDefaultCharacterImagePath(char.img)) return false;
		return /^data:image\//i.test(char.img) || !/^assets\/characters\//i.test(char.img);
	},

	getCharacterDisplayImage: (charOrId) => {
		const char = (charOrId && typeof charOrId === 'object') ? charOrId : null;
		if (char && char.imageEdit && char.imageEdit.src) return char.imageEdit.src;
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
        smith: false,
        craftingMenu: false,
        gacha: false,
        abyss: true,
        dungeonMenu: false,
        teleport: false,
        boat: false,
        wing: true,
        fixedDungeonEndless: true
    },

    unlockLabels: {
        smith: '鍛冶屋',
        craftingMenu: '魔道通信',
        gacha: 'ガチャ',
        abyss: '深淵の魔窟',
        dungeonMenu: 'ダンジョン',
        teleport: '宿屋の転送',
        boat: '魔法の小舟',
        wing: '光の翼',
        fixedDungeonEndless: '固定ダンジョンの探索'
    },

    // ストーリー加入キャラの初期レベル設定。
    // ここを変更すれば、加入時に指定Lvまで通常レベルアップ相当の成長を内部適用する。
    storyAllyInitialLevels: {
        //メインクエスト加入キャラクター
        110: 1,  // サラ
        109: 1,  // ガイル
        105: 6,  // シャオ
        106: 15, // エリーゼ
        104: 21, // ケイト
        101: 28, // ジョセフ
        204: 40, // レイラ（光の宮殿クリア後）
        306: 49,  // シャニー（魔王城クリア後）
        
        //サブクエスト加入キャラクター
        210: 20,  // カリン（禁忌の森クリア後⇒火山深部）
        
        102: 27,  // マリー（海底神殿クリア後）
        108: 20,  // アリサ（海底神殿クリア後⇒禁忌の森深部）
        207: 35,  // ハイネ（海底神殿クリア後⇒禁忌の森深部）
        209: 28,  // シルビア（ジョセフ加入後⇒水上都市）
        
        201: 38,  // アラン（雷の要塞クリア後⇒海底神殿深部）
        202: 35,  // ソフィア（雷の要塞クリア後⇒海底神殿深部）
        203: 40,  // ハヤテ（アラン加入後⇒水上都市）
        
        103: 35,  // ゼリード（大灯台クリア後）
        
        205: 43,  // バロン（光の宮殿クリア後⇒雷の要塞深部）
        302: 43,  // フリーダ（光の宮殿クリア後⇒雷の要塞深部）
        304: 47,  // クロード（光の宮殿クリア後⇒闇の神殿跡地）
        305: 46,  // レオン（光の宮殿クリア後⇒闇の神殿跡地）

        208: 45,  // リン（レイラ加入後⇒雷の要塞）

        107: 49,  // リュウ（魔王城クリア後⇒禁則地グレゼリア）
        206: 49,  // ミネルバ（魔王城クリア後⇒禁則地グレゼリア）

        303: 55,  // リーシア（魔王城クリア後⇒クレナ鍾乳洞深部）

        401: 70,  // ルーナ（隠し高難度クエスト）
        402: 70,  // ゼノン（隠し高難度クエスト）

        501: 99  // リュシオン（隠し高難度クエスト）
    },

    getStoryAllyInitialLevel: (charId) => {
        const raw = App.storyAllyInitialLevels ? App.storyAllyInitialLevels[Number(charId)] : undefined;
        const level = Math.floor(Number(raw));
        if (!Number.isFinite(level)) return 1;
        return Math.max(1, Math.min(100, level));
    },

    getDefaultUnlockState: () => {
        return { ...App.unlockDefaults };
    },

    ensureUnlockState: () => {
        if (!App.data) return {};
        if (!App.data.progress) App.data.progress = {};
        if (!App.data.progress.flags || typeof App.data.progress.flags !== 'object' || Array.isArray(App.data.progress.flags)) {
            App.data.progress.flags = {};
        }
        if (!App.data.progress.unlocked || typeof App.data.progress.unlocked !== 'object' || Array.isArray(App.data.progress.unlocked)) {
            App.data.progress.unlocked = {};
        }

        Object.keys(App.unlockDefaults).forEach(key => {
            if (App.data.progress.unlocked[key] === undefined || App.unlockDefaults[key] === true) {
                App.data.progress.unlocked[key] = App.unlockDefaults[key];
            }
        });

        // 段階開放導入前はsmith/abyssが常時trueだったため、一度だけ実進行から再構築する。
        if (!App.data.progress.flags.menuUnlockMigrationV1) {
            App.data.progress.unlocked.smith = !!App.data.progress.flags.fireVillageCleared;
            App.data.progress.unlocked.dungeonMenu = !!(
                App.data.progress.flags.abyssDungeonMenuUnlocked ||
                App.data.progress.flags.abyssRandomUnlocked
            );
            App.data.progress.flags.menuUnlockMigrationV1 = true;
        }

        // v3.23ではガチャを常時開放していたため、既存セーブも一度だけ未開放へ戻す。
        // 将来開放条件を追加した場合は、この移行完了後にunlockFeature('gacha')を呼べばよい。
        if (!App.data.progress.flags.menuUnlockMigrationV2) {
            App.data.progress.unlocked.gacha = false;
            App.data.progress.flags.menuUnlockMigrationV2 = true;
        }

        // 宿屋の転送扉は深淵へ一度でも実際に潜入した後だけ表示する。
        // 旧セーブはtryCount/maxFloor/現在地から初潜入済み状態を復元する。
        if (!App.data.progress.flags.menuUnlockMigrationV3) {
            const enteredAbyss = !!App.data.progress.flags.abyssFirstEntered ||
                Number(App.data.dungeon?.tryCount || 0) > 0 ||
                Number(App.data.dungeon?.maxFloor || 0) > 0 ||
                Number(App.data.dungeon?.storyMaxFloor || 0) > 0 ||
                App.data.location?.area === 'ABYSS';
            App.data.progress.flags.abyssFirstEntered = enteredAbyss;
            App.data.progress.unlocked.teleport = enteredAbyss;
            App.data.progress.flags.menuUnlockMigrationV3 = true;
        }

        // 鍛冶屋そのものの解放(smith)と、どこからでも施設へ接続できる魔道通信権限を分離する。
        // 魔道通信は貴重品「星詠みの触媒器」(ID:111)の所持状態から判定する。
        if (!App.data.progress.flags.menuUnlockMigrationV4) {
            App.data.progress.unlocked.craftingMenu = App.hasItem(111);
            App.data.progress.flags.menuUnlockMigrationV4 = true;
        }
        // 所持品を正本とし、ロード時にも表示用のunlock状態を同期する。
        App.data.progress.unlocked.craftingMenu = App.hasItem(111);

        return App.data.progress.unlocked;
    },

    defaultSettings: {
        battleSpeed: 'normal',
        battleAutoStart: false,
        fieldBgmVolume: 30,
        battleBgmVolume: 30,
        uiSeVolume: 5,
        battleSeVolume: 5,
        fieldSeVolume: 5,
        // 旧バージョンとの互換用。新規処理は上記5項目を参照する。
        bgmVolume: 30,
        seVolume: 5
    },

    battleSpeedLabels: {
        normal: '普通',
        fast: '早い',
        fastest: '最速'
    },

    getDefaultSettings: () => ({ ...App.defaultSettings }),

    ensureSettings: () => {
        if (!App.data) return App.getDefaultSettings();
        if (!App.data.settings || typeof App.data.settings !== 'object' || Array.isArray(App.data.settings)) {
            App.data.settings = {};
        }
        const defaults = App.getDefaultSettings();
        const clampSetting = (value, fallback) => Math.max(0, Math.min(100, Math.round(Number(value ?? fallback) || 0)));
        const legacyBgm = clampSetting(App.data.settings.bgmVolume, defaults.fieldBgmVolume);
        const legacySe = clampSetting(App.data.settings.seVolume, defaults.uiSeVolume);

        // 旧セーブのBGM/SE各1本設定を、初回ロード時に新しい5系統へ展開する。
        if (App.data.settings.fieldBgmVolume === undefined) App.data.settings.fieldBgmVolume = legacyBgm;
        if (App.data.settings.battleBgmVolume === undefined) App.data.settings.battleBgmVolume = legacyBgm;
        if (App.data.settings.uiSeVolume === undefined) App.data.settings.uiSeVolume = legacySe;
        if (App.data.settings.battleSeVolume === undefined) App.data.settings.battleSeVolume = legacySe;
        if (App.data.settings.fieldSeVolume === undefined) App.data.settings.fieldSeVolume = legacySe;

        Object.keys(defaults).forEach(key => {
            if (App.data.settings[key] === undefined) App.data.settings[key] = defaults[key];
        });
        if (!Object.prototype.hasOwnProperty.call(App.battleSpeedLabels, App.data.settings.battleSpeed)) {
            App.data.settings.battleSpeed = defaults.battleSpeed;
        }
        App.data.settings.battleAutoStart = App.data.settings.battleAutoStart === true;
        App.data.settings.fieldBgmVolume = clampSetting(App.data.settings.fieldBgmVolume, defaults.fieldBgmVolume);
        App.data.settings.battleBgmVolume = clampSetting(App.data.settings.battleBgmVolume, defaults.battleBgmVolume);
        App.data.settings.uiSeVolume = clampSetting(App.data.settings.uiSeVolume, defaults.uiSeVolume);
        App.data.settings.battleSeVolume = clampSetting(App.data.settings.battleSeVolume, defaults.battleSeVolume);
        App.data.settings.fieldSeVolume = clampSetting(App.data.settings.fieldSeVolume, defaults.fieldSeVolume);
        // 旧API参照用の代表値を維持する。
        App.data.settings.bgmVolume = App.data.settings.fieldBgmVolume;
        App.data.settings.seVolume = App.data.settings.uiSeVolume;
        return App.data.settings;
    },

    audioSettingKeys: {
        fieldBgm: 'fieldBgmVolume',
        battleBgm: 'battleBgmVolume',
        uiSe: 'uiSeVolume',
        battleSe: 'battleSeVolume',
        fieldSe: 'fieldSeVolume'
    },

    getAudioVolumeSetting: (kind) => {
        const key = App.audioSettingKeys[kind];
        const settings = App.ensureSettings();
        return key ? settings[key] : 0;
    },

    setAudioVolumeSetting: (kind, value) => {
        const key = App.audioSettingKeys[kind];
        if (!key) return 0;
        const normalized = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
        const settings = App.ensureSettings();
        settings[key] = normalized;
        if (kind === 'fieldBgm') settings.bgmVolume = normalized;
        if (kind === 'uiSe') settings.seVolume = normalized;

        if (typeof AudioManager !== 'undefined') {
            if (kind === 'fieldBgm') AudioManager.setBgmCategoryVolume?.('field', normalized);
            else if (kind === 'battleBgm') AudioManager.setBgmCategoryVolume?.('battle', normalized);
            else if (kind === 'uiSe') AudioManager.setSeCategoryVolume?.('ui', normalized);
            else if (kind === 'battleSe') AudioManager.setSeCategoryVolume?.('battle', normalized);
            else if (kind === 'fieldSe') AudioManager.setSeCategoryVolume?.('field', normalized);
        } else if (typeof App.save === 'function') {
            App.save();
        }
        return normalized;
    },

    getBgmVolumeSetting: () => App.ensureSettings().fieldBgmVolume,

    setBgmVolumeSetting: (value) => {
        const normalized = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
        const settings = App.ensureSettings();
        settings.fieldBgmVolume = normalized;
        settings.battleBgmVolume = normalized;
        settings.bgmVolume = normalized;
        if (typeof AudioManager !== 'undefined' && AudioManager.setBgmVolume) AudioManager.setBgmVolume(normalized);
        else if (typeof App.save === 'function') App.save();
        return normalized;
    },

    getSeVolumeSetting: () => App.ensureSettings().uiSeVolume,

    setSeVolumeSetting: (value) => {
        const normalized = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
        const settings = App.ensureSettings();
        settings.uiSeVolume = normalized;
        settings.battleSeVolume = normalized;
        settings.fieldSeVolume = normalized;
        settings.seVolume = normalized;
        if (typeof AudioManager !== 'undefined' && AudioManager.setSeVolume) AudioManager.setSeVolume(normalized);
        else if (typeof App.save === 'function') App.save();
        return normalized;
    },

    getBattleSpeedSetting: () => {
        const settings = App.ensureSettings ? App.ensureSettings() : (App.data?.settings || {});
        const speed = settings.battleSpeed || 'normal';
        return Object.prototype.hasOwnProperty.call(App.battleSpeedLabels, speed) ? speed : 'normal';
    },

    setBattleSpeedSetting: (speed) => {
        const settings = App.ensureSettings();
        settings.battleSpeed = Object.prototype.hasOwnProperty.call(App.battleSpeedLabels, speed) ? speed : 'normal';
        if (typeof App.save === 'function') App.save();
        return settings.battleSpeed;
    },

    getBattleAutoStartSetting: () => {
        const settings = App.ensureSettings ? App.ensureSettings() : (App.data?.settings || {});
        return settings.battleAutoStart === true;
    },

    setBattleAutoStartSetting: (enabled) => {
        const settings = App.ensureSettings();
        settings.battleAutoStart = enabled === true;
        if (typeof App.save === 'function') App.save();
        return settings.battleAutoStart;
    },

    ensureCharacterBattleConfig: (char) => {
        if (!char) return null;
        if (!char.config || typeof char.config !== 'object' || Array.isArray(char.config)) {
            char.config = {};
        }
        const normalizeSkillIds = (ids) => Array.from(new Set((Array.isArray(ids) ? ids : [])
            .map(id => Number(id))
            .filter(id => Number.isInteger(id) && id > 0)));
        char.config.hiddenSkills = normalizeSkillIds(char.config.hiddenSkills);
        // v1の「封印」は手動メニューとオート戦闘の両方を無効化していた。
        // 旧セーブでは同じ意味を維持したまま、v2の独立設定へ一度だけ移行する。
        if (!Array.isArray(char.config.autoDisabledSkills)) {
            char.config.autoDisabledSkills = [...char.config.hiddenSkills];
        } else {
            char.config.autoDisabledSkills = normalizeSkillIds(char.config.autoDisabledSkills);
        }
        char.config.skillUsageConfigVersion = 2;
        if (typeof char.config.fullAuto !== 'boolean') char.config.fullAuto = false;
        if (!App.battleStrategies[char.config.strategy]) {
            char.config.strategy = App.defaultBattleStrategy;
        }
        return char.config;
    },

    remapCharacterSkillConfig: (char, fromSkillId, toSkillId = null) => {
        const config = App.ensureCharacterBattleConfig(char);
        const fromId = Math.floor(Number(fromSkillId));
        const toId = toSkillId == null ? null : Math.floor(Number(toSkillId));
        if (!config || !Number.isInteger(fromId) || fromId <= 0) return config;

        const remap = values => Array.from(new Set((Array.isArray(values) ? values : [])
            .map(value => Math.floor(Number(value)))
            .filter(value => Number.isInteger(value) && value > 0)
            .map(value => value === fromId ? toId : value)
            .filter(value => Number.isInteger(value) && value > 0)));
        config.hiddenSkills = remap(config.hiddenSkills);
        config.autoDisabledSkills = remap(config.autoDisabledSkills);
        return config;
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
            location: { area: 'START_VILLAGE', x: 6, y: 5 },
            settings: App.getDefaultSettings(),
            system: { monsterIdSchemaVersion: 4, abyssFloorSchemaVersion: 2 },
            progress: { 
                floor: 0, 
                storyStep: 0, 
                flags: { hasShip: false, luminaVillageTopWallRowV1: true }, 
                unlocked: { ...App.getDefaultUnlockState(), boat: false },
                clearedDungeons: [],
                openedChests: {},  
                defeatedBosses: {},
                visitedFixedMaps: {},
                quests: {},
                guild: { rank: 'G', exp: 0, points: 0, offers: [], questStates: {}, completionCounts: {}, refreshCount: 0 }
            },
            inventory: [],
            items: { "1": 3 }, 
            characters: [
                { uid: 'p1', charId: 301, name: 'アルス', job: '勇者', level: 1, exp: 0, hp: 50, mp: 20, atk: 15, def: 10, mag: 10, spd: 10, equips: { '武器':null, '盾':null, '頭':null, '体':null, '足':null }, sp: 0, tree: {}, skillBookSkills: [], config: { fullAuto: false, hiddenSkills: [], autoDisabledSkills: [], skillUsageConfigVersion: 2, strategy: 'balanced' } }
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
                storyMaxFloor: 0,
                tryCount: 0,
                storyTryCount: 0,
                randomTryCount: 0,
                abyssMode: 'story', 
                returnPoint: null,
                map: null,
                width: 30,
                height: 30
            },
            stats: { 
                wipeoutCount: 0,
                totalSteps: 0, totalBattles: 0, totalChestsOpened: 0, totalMedals: 0,
                totalQuestCompletions: 0, totalGuildQuestCompletions: 0,
                totalAlchemyCrafts: 0, totalAlchemyItemsCrafted: 0,
                totalBlacksmithActions: 0, blacksmithSynthesisCount: 0,
                blacksmithRefineAttempts: 0, blacksmithRefineSuccesses: 0,
                blacksmithEnhanceAttempts: 0, blacksmithEnhanceSuccesses: 0,
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
        App.data = App.migrateImportedSaveData(App.data);

        const initial = App.getInitialData();
        if (typeof App.purgeInitialInventoryEquipment === 'function') {
            App.purgeInitialInventoryEquipment();
        }

        // --- 修正点2: エリアや座標の整合性チェック（安全な復帰） ---
        // 1. location の補完
        if (App.data.location) {
            const loc = App.data.location;
            const area = loc.area;
            
            // 現在のビルドに存在するエリアか判定
            const worldDef = (typeof WORLD_MAPS !== 'undefined' && WORLD_MAPS[area]) || null;
            const isWorld = !!worldDef;
            const isAbyss = (area === 'ABYSS');
            const isFixed = (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[area]);
            const isDungeonMap = (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[area]);

            if (!isWorld && !isAbyss && !isFixed && !isDungeonMap) {
                // エリア自体が存在しない（削除・改名された）場合は初期位置へ
                console.warn(`[Recovery] 非存在エリア '${area}' を検知。初期位置へ復旧します。`);
                App.data.location = JSON.parse(JSON.stringify(initial.location));
            } else if (isWorld) {
                const tiles = worldDef.tiles;
                const width = Array.isArray(tiles) && tiles[0] ? tiles[0].length : 0;
                const height = Array.isArray(tiles) ? tiles.length : 0;
                if (!Number.isFinite(Number(loc.x)) || !Number.isFinite(Number(loc.y)) ||
                    Number(loc.x) < 0 || Number(loc.y) < 0 || Number(loc.x) >= width || Number(loc.y) >= height) {
                    const destination = worldDef.skyPrismDestination || { x: 0, y: 0 };
                    loc.x = Number(destination.x);
                    loc.y = Number(destination.y);
                }
                loc.worldKey = worldDef.key || area;
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
            if (!App.data.progress.quests || typeof App.data.progress.quests !== 'object' || Array.isArray(App.data.progress.quests)) App.data.progress.quests = {};
            if (!App.data.progress.unlocked || typeof App.data.progress.unlocked !== 'object' || Array.isArray(App.data.progress.unlocked)) App.data.progress.unlocked = {};
            if (!App.data.progress.clearedDungeons) App.data.progress.clearedDungeons = [];
            if (!App.data.progress.openedChests) App.data.progress.openedChests = {};
            if (!App.data.progress.defeatedBosses) App.data.progress.defeatedBosses = {};
            if (!App.data.progress.visitedFixedMaps || typeof App.data.progress.visitedFixedMaps !== 'object' || Array.isArray(App.data.progress.visitedFixedMaps)) App.data.progress.visitedFixedMaps = {};
        }

        // リュミナ村の上端へ壁行を追加した版への座標移行。
        // 新規データは初期フラグ済み。旧セーブだけ、村内のY座標と保存済み座標キーを一度だけ+1する。
        if (!App.data.progress.flags.luminaVillageTopWallRowV1) {
            const shiftLuminaPoint = (point) => {
                if (!point || String(point.areaKey || point.area || '') !== 'START_VILLAGE') return;
                const y = Number(point.y);
                if (Number.isFinite(y)) point.y = y + 1;
                if (point.mapData && String(point.mapData.themeKey || point.mapData.areaKey || '') === 'START_VILLAGE'
                    && typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS.START_VILLAGE) {
                    point.mapData = {
                        ...JSON.parse(JSON.stringify(FIXED_MAPS.START_VILLAGE)),
                        isFixed: true,
                        isDungeon: FIXED_MAPS.START_VILLAGE.isDungeon === true,
                        areaKey: 'START_VILLAGE'
                    };
                }
            };

            if (App.data.location?.area === 'START_VILLAGE') {
                const y = Number(App.data.location.y);
                if (Number.isFinite(y)) App.data.location.y = y + 1;
            }
            shiftLuminaPoint(App.data.mapReturnPoint);
            shiftLuminaPoint(App.data.dungeon?.returnPoint);
            if (Array.isArray(App.data.dungeon?.returnStack)) {
                App.data.dungeon.returnStack.forEach(shiftLuminaPoint);
            }

            const oldChanges = App.data.progress.mapChanges?.START_VILLAGE;
            if (oldChanges && typeof oldChanges === 'object' && !Array.isArray(oldChanges)) {
                const shiftedChanges = {};
                Object.entries(oldChanges).forEach(([key, tile]) => {
                    const match = /^(\-?\d+),(\-?\d+)$/.exec(String(key));
                    if (!match) {
                        shiftedChanges[key] = tile;
                        return;
                    }
                    shiftedChanges[`${Number(match[1])},${Number(match[2]) + 1}`] = tile;
                });
                App.data.progress.mapChanges.START_VILLAGE = shiftedChanges;
            }

            App.data.progress.flags.luminaVillageTopWallRowV1 = true;
        }

        App.ensureUnlockState();
        if (typeof Guild !== 'undefined' && typeof Guild.ensureState === 'function') {
            Guild.ensureState();
            Guild.ensureOffers({ save: false });
        }

        // 既存セーブ救済: 固有MAP内で再開した場合は、そのMAPを発見済みにする。
        if (App.data.location && App.data.progress && typeof App.discoverFixedMap === 'function') {
            const currentArea = App.data.location.area;
            const isCurrentFixedMap = (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[currentArea]) ||
                (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[currentArea]);
            if (isCurrentFixedMap) App.discoverFixedMap(currentArea, { save: false, silent: true });
            const currentWorldKey = App.data.location.worldKey || STORY_DATA?.areas?.[currentArea]?.worldKey || currentArea;
            if (typeof WORLD_MAPS !== 'undefined' && WORLD_MAPS[currentWorldKey]?.skyPrismEligible && currentWorldKey !== 'WORLD') {
                App.discoverFixedMap(currentWorldKey, { save: false, silent: true });
            }
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
        const loadedWorldDef = (typeof WORLD_MAPS !== 'undefined' && WORLD_MAPS[App.data.location?.worldKey || App.data.location?.area]) || null;
        if (loadedWorldDef && loadedWorldDef.allowBoat === false && loadedWorldDef.allowFlight === false) {
            App.data.transportMode = null;
        }

        // 5.5. 設定の補完
        App.ensureSettings();

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


	// 全画像データの手動/初回ダウンロード用キャッシュ名。
	// sw.js の RUNTIME_CACHE_NAME と揃えること。
    fullDataCacheName: 'prisma-abyss-v16.20260729-runtime',


	// 初回起動時の「全データを今ダウンロードしますか？」で「いいえ」を選んだ記録。
	// 「いいえ」は前景ダウンロードを待たない選択であり、起動後の全量バックグラウンド
	// キャッシュを拒否するフラグではない。
	// アプリ更新時に main.html 側からこの接頭辞の localStorage を削除する。
	fullDataPromptDeclineKeyPrefix: 'prisma_abyss_full_data_prompt_declined_',

	getFullDataPromptDeclineKey: () => `${App.fullDataPromptDeclineKeyPrefix}${App.fullDataCacheName}`,

	hasDeclinedInitialFullDataPrompt: () => {
		try {
			return localStorage.getItem(App.getFullDataPromptDeclineKey()) === '1';
		} catch (e) {
			return false;
		}
	},

	setDeclinedInitialFullDataPrompt: (declined) => {
		try {
			const key = App.getFullDataPromptDeclineKey();
			if (declined) localStorage.setItem(key, '1');
			else localStorage.removeItem(key);
		} catch (e) {}
	},

	clearFullDataPromptDeclineFlags: () => {
		try {
			const prefix = App.fullDataPromptDeclineKeyPrefix;
			Object.keys(localStorage)
				.filter(key => key.indexOf(prefix) === 0)
				.forEach(key => localStorage.removeItem(key));
		} catch (e) {}
	},

	formatFullDataBytes: (bytes) => {
		const value = Number(bytes);
		if (!Number.isFinite(value) || value < 0) return '';
		if (value < 1024) return `${Math.ceil(value).toLocaleString()} B`;
		if (value < 1024 * 1024) return `${Math.ceil(value / 1024).toLocaleString()} KB`;
		const mb = value / 1024 / 1024;
		return `${mb >= 10 ? Math.round(mb).toLocaleString() : mb.toFixed(1)} MB`;
	},

	formatFullDataSizeInfo: (sizeInfo) => {
		// Content-Length が対象すべてで取れた場合だけ表示する。
		// 一部でも取れないサーバーでは、容量欄自体を非表示にする。
		if (!sizeInfo || !sizeInfo.allKnown) return '';
		const formatted = App.formatFullDataBytes(sizeInfo.totalBytes);
		return formatted ? `容量: 約 ${formatted}` : '';
	},

	getFullDataSizeInfo: async (urls = [], options = {}) => {
		if (!App.isFullDataCacheSupported()) return null;

		const targets = Array.from(new Set((urls || []).filter(Boolean)));
		if (!targets.length) return null;

		const concurrency = Math.max(1, Math.min(12, Number(options.concurrency) || 8));
		const perRequestTimeoutMs = Math.max(1000, Number(options.perRequestTimeoutMs) || 3000);
		let index = 0;
		let knownCount = 0;
		let unknownCount = 0;
		let totalBytes = 0;

		const readOne = async (url) => {
			let timeoutId = null;
			let controller = null;
			try {
				const absolute = new URL(url, window.location.href);
				if (absolute.origin !== window.location.origin) throw new Error('cross-origin');

				const fetchOptions = { method: 'HEAD', cache: 'no-store' };
				if (typeof AbortController !== 'undefined') {
					controller = new AbortController();
					fetchOptions.signal = controller.signal;
					timeoutId = setTimeout(() => controller.abort(), perRequestTimeoutMs);
				}

				const response = await fetch(absolute.href, fetchOptions);
				if (!response || !response.ok) throw new Error(`HTTP ${response ? response.status : 'ERR'}`);

				const contentLength = response.headers.get('content-length');
				if (contentLength == null || String(contentLength).trim() === '') {
					throw new Error('content-length-missing');
				}
				const bytes = Number(contentLength);
				if (!Number.isFinite(bytes) || bytes < 0) throw new Error('content-length-missing');

				totalBytes += bytes;
				knownCount++;
			} catch (e) {
				unknownCount++;
			} finally {
				if (timeoutId) clearTimeout(timeoutId);
			}
		};

		const worker = async () => {
			while (index < targets.length) {
				const url = targets[index++];
				await readOne(url);
			}
		};

		await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));

		return {
			totalBytes,
			knownCount,
			unknownCount,
			totalCount: targets.length,
			allKnown: knownCount === targets.length && unknownCount === 0
		};
	},

	// Cache API での全データ取得は http/https 配信時だけ実行する。
	// file:// 直開きでは fetch(file://...) がブラウザのCORS制限で必ず失敗するため、
	// 起動時モーダルや失敗ダイアログを出さずに通常起動へ進める。
	isFullDataCacheSupported: () => {
		if (typeof window === 'undefined' || typeof caches === 'undefined' || typeof Request === 'undefined') return false;
		return window.location.protocol === 'http:' || window.location.protocol === 'https:';
	},

	getFullDataCacheUnsupportedMessage: () => '全データダウンロードは http://localhost または https:// で起動した場合に利用できます。\nローカルファイルを直接開いている場合は、画像は通常読み込みのまま起動します。',

	getFullDataCacheUrls: () => {
		const urls = new Set();
		const add = (src) => {
			if (typeof src !== 'string') return;
			const value = src.trim();
			if (!value || /^data:/i.test(value)) return;

			try {
				const absolute = new URL(value, window.location.href);
				if (absolute.origin !== window.location.origin) return;
				if (!/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(absolute.pathname)) return;
				urls.add(value);
			} catch (e) {}
		};
		const addList = (list) => {
			if (!Array.isArray(list)) return;
			list.forEach(add);
		};
		const addObjectValues = (obj) => {
			if (!obj || typeof obj !== 'object') return;
			Object.values(obj).forEach(add);
		};

		const warmup = (typeof window !== 'undefined' && window.PRISMA_ASSETS && window.PRISMA_ASSETS.cacheWarmup)
			? window.PRISMA_ASSETS.cacheWarmup
			: null;
		const assets = (typeof window !== 'undefined' && window.PRISMA_ASSETS) ? window.PRISMA_ASSETS : null;

		if (warmup) {
			addList(warmup.installImages);
			addList(warmup.backgroundImages);
			addList(warmup.criticalImages);
			addList(warmup.startupImages);
		}
		if (assets) {
			addObjectValues(assets.graphics);
			addObjectValues(assets.battleFx);
		}

		// キャラクター顔画像は assets.js ではなく characters.js 側の定義を正本にしているため、
		// 起動後にDBが読める状態で追加する。
		const characterLists = [];
		if (typeof DB !== 'undefined' && Array.isArray(DB.CHARACTERS)) characterLists.push(DB.CHARACTERS);
		if (typeof window !== 'undefined' && Array.isArray(window.CHARACTERS_DATA)) characterLists.push(window.CHARACTERS_DATA);
		characterLists.forEach(list => {
			list.forEach(c => {
				if (!c) return;
				add(c.img);
				add(c.image);
			});
		});

		add('assets/background/PRISMA ABYSS.png');
		return Array.from(urls);
	},

	toFullDataCacheRequest: (url) => {
		try {
			const absolute = new URL(url, window.location.href);
			if (absolute.origin !== window.location.origin) return null;
			return new Request(absolute.href, { cache: 'reload' });
		} catch (e) {
			return null;
		}
	},

	getMissingFullDataCacheUrls: async (urls = null) => {
		if (!App.isFullDataCacheSupported()) return [];
		const targets = urls || App.getFullDataCacheUrls();
		const missing = [];

		for (const url of targets) {
			const request = App.toFullDataCacheRequest(url);
			if (!request) continue;
			const cached = await caches.match(request);
			if (!cached) missing.push(url);
		}
		return missing;
	},

	showFullDataDialog: (message, options = {}) => new Promise((resolve) => {
		const old = document.getElementById('full-data-cache-modal');
		if (old) old.remove();

		const overlay = document.createElement('div');
		overlay.id = 'full-data-cache-modal';
		overlay.style.cssText = [
			'position:fixed',
			'inset:0',
			'z-index:1000002',
			'background:rgba(0,0,0,0.82)',
			'display:flex',
			'align-items:center',
			'justify-content:center',
			'padding:18px',
			'box-sizing:border-box'
		].join(';');

		const box = document.createElement('div');
		box.style.cssText = [
			'width:min(360px, 100%)',
			'background:#111722',
			'border:2px solid #ffd700',
			'border-radius:12px',
			'box-shadow:0 18px 48px rgba(0,0,0,0.75)',
			'padding:18px',
			'color:#fff',
			'font-family:inherit',
			'text-align:left'
		].join(';');

		const text = document.createElement('div');
		text.style.cssText = 'white-space:pre-wrap; line-height:1.7; font-size:14px; margin-bottom:16px;';
		text.textContent = String(message || '');
		box.appendChild(text);

		const progress = document.createElement('div');
		progress.style.cssText = 'display:none; color:#ffd700; font-size:12px; line-height:1.6; margin-top:-6px; margin-bottom:12px; white-space:pre-wrap;';
		box.appendChild(progress);

		const buttons = document.createElement('div');
		buttons.style.cssText = 'display:flex; gap:10px; justify-content:flex-end;';

		const close = (value) => {
			const current = document.getElementById('full-data-cache-modal');
			if (current) current.remove();
			resolve(value);
		};

		if (options.progressOnly) {
			buttons.style.display = 'none';
		} else if (options.messageOnly) {
			const ok = document.createElement('button');
			ok.className = 'btn';
			ok.textContent = 'OK';
			ok.onclick = () => close(true);
			buttons.appendChild(ok);
		} else {
			const yes = document.createElement('button');
			yes.className = 'btn';
			yes.textContent = 'はい';
			yes.onclick = () => close(true);
			buttons.appendChild(yes);

			const no = document.createElement('button');
			no.className = 'btn';
			no.textContent = 'いいえ';
			no.onclick = () => close(false);
			buttons.appendChild(no);
		}

		box.appendChild(buttons);
		overlay.appendChild(box);
		document.body.appendChild(overlay);

		if (options.progressOnly) {
			resolve({
				update: (nextMessage, progressMessage = '') => {
					text.textContent = String(nextMessage || '');
					if (progressMessage) {
						progress.style.display = 'block';
						progress.textContent = String(progressMessage);
					} else {
						progress.style.display = 'none';
						progress.textContent = '';
					}
				},
				close: () => {
					const current = document.getElementById('full-data-cache-modal');
					if (current) current.remove();
				}
			});
		}
	}),

	fetchAndCacheFullDataAsset: async (cache, request, options = {}) => {
		const maxAttempts = Math.max(1, Number(options.maxAttempts || 3));
		let lastError = null;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				const retryRequest = new Request(request, { cache: attempt === 1 ? 'reload' : 'no-cache' });
				const response = await fetch(retryRequest);
				if (!response || !response.ok) throw new Error(`HTTP ${response ? response.status : 'ERR'}`);
				await cache.put(request, response.clone());
				return { ok: true, attempts: attempt };
			} catch (error) {
				lastError = error;
				if (attempt < maxAttempts) {
					await new Promise(resolve => setTimeout(resolve, 180 * attempt));
				}
			}
		}
		return { ok: false, attempts: maxAttempts, error: lastError };
	},

	downloadFullDataCache: async (options = {}) => {
		if (!App.isFullDataCacheSupported()) {
			throw new Error(App.getFullDataCacheUnsupportedMessage());
		}

		const allUrls = App.getFullDataCacheUrls();
		const urls = options.urls || allUrls;
		const targets = options.skipExisting === false ? urls : await App.getMissingFullDataCacheUrls(urls);
		const total = targets.length;
		let completed = 0;
		let failed = 0;
		const failedUrls = [];
		const sizeInfo = options.sizeInfo || await App.getFullDataSizeInfo(targets);
		const sizeLine = App.formatFullDataSizeInfo(sizeInfo);

		const dialog = await App.showFullDataDialog('全データをダウンロード中です。', { progressOnly: true });
		const updateProgress = () => {
			if (dialog && dialog.update) {
				const lines = [`完了: ${completed}/${total}`];
				if (sizeLine) lines.push(sizeLine);
				if (failed) lines.push(`失敗: ${failed}`);
				dialog.update(
					'全データをダウンロード中です。',
					lines.join('\n')
				);
			}
		};
		updateProgress();

		try {
			if (!total) return { total: 0, completed: 0, failed: 0, failedUrls: [] };

			const cache = await caches.open(App.fullDataCacheName);
			const concurrency = 6;
			let index = 0;

			const worker = async () => {
				while (index < targets.length) {
					const url = targets[index++];
					const request = App.toFullDataCacheRequest(url);
					if (!request) {
						completed++;
						updateProgress();
						continue;
					}

					const result = await App.fetchAndCacheFullDataAsset(cache, request, { maxAttempts: 3 });
					if (!result.ok) {
						failed++;
						failedUrls.push(url);
					}
					completed++;
					updateProgress();
				}
			};

			await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
			return { total, completed, failed, failedUrls };
		} finally {
			if (dialog && dialog.close) dialog.close();
		}
	},

	handleInitialFullDataDownload: async () => {
		if (!App.isFullDataCacheSupported()) return;

		const urls = App.getFullDataCacheUrls();
		if (!urls.length) return;

		const missing = await App.getMissingFullDataCacheUrls(urls);
		if (!missing.length) return;

		if (App.hasDeclinedInitialFullDataPrompt()) return;

		const sizeInfo = await App.getFullDataSizeInfo(missing);
		const sizeLine = App.formatFullDataSizeInfo(sizeInfo);
		const detailLines = [`未ダウンロード: ${missing.length}/${urls.length}`];
		if (sizeLine) detailLines.push(sizeLine);

		const yes = await App.showFullDataDialog(
			`画像データをすべて今ダウンロードしますか？\n\n「はい」：完了を待ってからゲームを開始します。\n「いいえ」：すぐにゲームを開始し、バックグラウンドで全データのキャッシュを進めます。\n\n${detailLines.join('\n')}`
		);

		if (yes) {
			App.setDeclinedInitialFullDataPrompt(false);
			const result = await App.downloadFullDataCache({ urls: missing, sizeInfo });
			if (result.failed > 0) {
				await App.showFullDataDialog(
					`一部データのダウンロードに失敗しました。\n通信環境を確認して、設定メニューから再実行してください。\n\n失敗: ${result.failed}/${result.total}`,
					{ messageOnly: true }
				);
			}
		} else {
			// 前景で待たない選択を記録する。全量バックグラウンドキャッシュは、
			// ゲーム開始後に warmImageCache() が必ず開始する。
			App.setDeclinedInitialFullDataPrompt(true);
		}
	},

	// 旧シナリオデータとの互換用。全量確認は初回起動時に済ませるため、
	// PROLOGUE3後にはモーダルを再表示せず、未取得分の裏キャッシュだけ再依頼する。
	handlePostPrologueFullDataDownload: async () => {
		App.warmImageCache();
	},

	downloadFullDataFromConfig: async () => {
		try {
			if (!App.isFullDataCacheSupported()) {
				await App.showFullDataDialog(App.getFullDataCacheUnsupportedMessage(), { messageOnly: true });
				return;
			}

			const urls = App.getFullDataCacheUrls();
			const missing = await App.getMissingFullDataCacheUrls(urls);

			if (!missing.length) {
				await App.showFullDataDialog('全データはすでにダウンロード済みです。', { messageOnly: true });
				return;
			}

			const sizeInfo = await App.getFullDataSizeInfo(missing);
			const result = await App.downloadFullDataCache({ urls: missing, sizeInfo });
			if (result.failed > 0) {
				await App.showFullDataDialog(
					`一部データのダウンロードに失敗しました。\n通信環境を確認してから再実行してください。\n\n失敗: ${result.failed}/${result.total}`,
					{ messageOnly: true }
				);
			} else {
				App.setDeclinedInitialFullDataPrompt(false);
				await App.showFullDataDialog('全データのダウンロードが完了しました。', { messageOnly: true });
			}
		} catch (e) {
			console.error(e);
			await App.showFullDataDialog(`全データダウンロードに失敗しました。\n${e.message || e}`, { messageOnly: true });
		}
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
	 * - 初回確認で「はい」なら、画像全量の取得完了を待ってゲームを開始する。
	 * - 「いいえ」でもゲーム開始後、Service Worker に全量の裏キャッシュを依頼する。
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
		const finishInitialLoading = async () => {
			if (typeof Field !== 'undefined' && Field.ready) {
				if (typeof Field.syncCanvasToWrapperSize === 'function') Field.syncCanvasToWrapperSize();
				if (typeof Field.render === 'function') Field.render();
				if (typeof PhaserFieldRenderer !== 'undefined' && typeof PhaserFieldRenderer.resize === 'function') {
					PhaserFieldRenderer.resize();
				}
			}

			if (window.InitialLoading) {
				await window.InitialLoading.finish();
			}

			// 初回確認でどちらを選んでも、未取得画像は全量を裏でキャッシュする。
			// 画像の遅延取得を基本方針にはしない。
			App.warmImageCache();
		};

		const start = () => {
			try {
				const result = App.startGameLogic();

				// startGameLogic が Promise を返す場合にも対応
				if (result && typeof result.then === 'function') {
					result.finally(finishInitialLoading);
				} else {
					finishInitialLoading();
				}
			} catch (e) {
				console.error(e);

				if (window.InitialLoading) {
					window.InitialLoading.hide();
				}

				App.showMessage("エラー: ゲーム開始処理に失敗しました。");
			}
		};

		const loadGraphicsAndStart = async () => {
			// 全量取得を今行うか、起動後のバックグラウンドで行うかを最初に確認する。
			// 「はい」はここで完了を待ち、「いいえ」は待たずに以降へ進む。
			if (typeof App.handleInitialFullDataDownload === 'function') {
				try {
					await App.handleInitialFullDataDownload();
				} catch (e) {
					// キャッシュ確認や容量取得だけが失敗しても、必須画像の先読みは省略しない。
					console.error(e);
				}
			}

			// どちらの選択でも、初期画面と開幕戦に必要な画像はメモリへ先読みする。
			if (typeof App.preloadStartupImages === 'function') {
				await App.preloadStartupImages();
			}
			if (typeof GRAPHICS !== 'undefined' && typeof GRAPHICS.load === 'function') {
				GRAPHICS.load(() => {
					start();
				});
			} else {
				// なければ即開始
				start();
			}
		};

		loadGraphicsAndStart().catch((e) => {
			console.error(e);
			start();
		});
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

				// 仲間モンスターの職業欄は、固定の「魔物」ではなくモンスター名を表示する。
				// 既に加入済みの旧データも、起動時に最低限補正する。
				if (App.isMonsterAlly && App.isMonsterAlly(c)) {
					const monsterJobName = c.monsterAllyMeta?.originalName || c.name || c.job || '仲間モンスター';
					if (!c.job || c.job === '魔物') c.job = monsterJobName;
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
                // 再開時も生成時と同じ復元経路を使い、外観テーマと戦闘背景を欠落させない。
                Field.currentMapData = Dungeon.createRandomFieldMapData();
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
            if ((e.key === 'Enter' || e.key === ' ') && typeof Battle !== 'undefined') {
                const battleScene = document.getElementById('battle-scene');
                if (battleScene && battleScene.style.display === 'flex' && Battle.phase === 'result' && typeof Battle.handleResultTap === 'function') {
                    e.preventDefault();
                    Battle.handleResultTap();
                    return;
                }
            }
            if(document.getElementById('field-scene') && document.getElementById('field-scene').style.display === 'flex') {
                if ((e.key === 'Enter' || e.key === ' ') && typeof StoryManager !== 'undefined') {
                    const storyOverlay = document.getElementById('story-ui-overlay');
                    if ((StoryManager.active || StoryManager.isTyping) && storyOverlay && storyOverlay.style.display !== 'none') {
                        e.preventDefault();
                        storyOverlay.click();
                        return;
                    }
                }
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
        const areaKey = data.location?.area;

        // 深淵は「画面に表示する階層」と「報酬・装備品質に使う階層」を分離する。
        // ランダム深淵1階は旧101階相当、ランダム深淵101階は旧201階相当。
        if (areaKey === 'ABYSS') {
            const displayFloor = Math.max(1, Math.floor(Number(data.progress?.floor) || 1));
            const abyssMode = globalThis.ABYSS_FLOOR_RULES?.getMode?.(data)
                || data.dungeon?.abyssMode
                || 'story';

            if (globalThis.ABYSS_FLOOR_RULES?.isRandomMode?.(abyssMode)) {
                return Math.max(1, Number(
                    globalThis.ABYSS_FLOOR_RULES.getBalanceFloor(displayFloor, abyssMode)
                ) || displayFloor + 100);
            }

            // 物語深淵は従来の成長帯を維持する。
            if (displayFloor >= 100) return displayFloor;
            if (displayFloor <= 20) return 70;
            if (displayFloor <= 40) return 80;
            if (displayFloor <= 75) return 90;
            return 100;
        }

        // STORY_DATA から設定を読み込む（朽ちた祠なら300が返る）。
        const areaDef = STORY_DATA.areas[areaKey];
        return areaDef ? areaDef.rank : 1;
    },

    purgeInitialInventoryEquipment: () => {
        if (!App.data || !Array.isArray(App.data.inventory)) return false;
        if (!App.data.progress) App.data.progress = {};
        if (App.data.progress.initialInventoryEquipmentPurged) return false;

        const isLegacyInitialEquip = (item) => {
            if (!item || item.locked) return false;
            if (item.source === 'init' || item.isInitialEquipment) return true;
            const hasOptions = Array.isArray(item.opts) && item.opts.length > 0;
            const hasTraits = Array.isArray(item.traits) && item.traits.length > 0;
            return Number(item.rank || 0) <= 1 && Number(item.plus || 0) === 0 && !hasOptions && !hasTraits;
        };

        const before = App.data.inventory.length;
        App.data.inventory = App.data.inventory.filter(item => !isLegacyInitialEquip(item));
        App.data.progress.initialInventoryEquipmentPurged = true;
        if (App.data.inventory.length !== before && typeof App.save === 'function') App.save();
        return App.data.inventory.length !== before;
    },

    hasItem: (itemId) => {
        return !!(App.data && App.data.items && Number(App.data.items[itemId] || 0) > 0);
    },

    getFeatureUnlockLabel: (key) => {
        return App.unlockLabels[key] || key || 'この機能';
    },

    getFeatureLockedMessage: (key) => {
        if (key === 'craftingMenu') {
            return `まだ解放されていません！\n光の宮殿クリア後、地下牢の国王の依頼を達成すると利用できます。`;
        }
        return `まだ解放されていません！\nストーリーを進めると利用できるようになります。`;
    },

    isFeatureUnlocked: (key) => {
        if (!key) return true;
        const unlocked = App.ensureUnlockState();
        if (key === 'boat') return !!unlocked.boat || App.hasItem(108) || !!App.data?.progress?.flags?.hasShip;
        if (key === 'wing') return !!unlocked.wing || App.hasItem(109);
        if (key === 'craftingMenu') return App.hasItem(111);
        return !!unlocked[key];
    },

    hasEnteredAbyss: () => {
        if (!App.data) return false;
        return !!App.data.progress?.flags?.abyssFirstEntered ||
            Number(App.data.dungeon?.tryCount || 0) > 0 ||
            Number(App.data.dungeon?.maxFloor || 0) > 0 ||
            Number(App.data.dungeon?.storyMaxFloor || 0) > 0 ||
            App.data.location?.area === 'ABYSS';
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
        const worldDef = (typeof MapRegistry !== 'undefined' && MapRegistry.getWorldDefinition)
            ? MapRegistry.getWorldDefinition()
            : null;
        if (worldDef?.allowBoat === false) return false;
        return App.isFeatureUnlocked('boat') || App.hasItem(108) || !!App.data?.progress?.flags?.hasShip;
    },

    isFlying: () => {
        const worldDef = (typeof MapRegistry !== 'undefined' && MapRegistry.getWorldDefinition)
            ? MapRegistry.getWorldDefinition()
            : null;
        return worldDef?.allowFlight !== false && App.data?.transportMode === 'flying';
    },
    isBoating: () => {
        const worldDef = (typeof MapRegistry !== 'undefined' && MapRegistry.getWorldDefinition)
            ? MapRegistry.getWorldDefinition()
            : null;
        return worldDef?.allowBoat !== false && App.data?.transportMode === 'boat';
    },

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
        if (typeof WORLD_MAPS !== 'undefined' && WORLD_MAPS[areaKey] && areaKey !== 'WORLD') {
            return { key: areaKey, def: WORLD_MAPS[areaKey], kind: 'world' };
        }
        if (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[areaKey]) {
            return { key: areaKey, def: FIXED_MAPS[areaKey], kind: 'field' };
        }
        if (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[areaKey]) {
            return { key: areaKey, def: FIXED_DUNGEON_MAPS[areaKey], kind: 'dungeon' };
        }
        return null;
    },

    getFixedMapLocalEntranceDestination: (areaKey, visited = new Set()) => {
        if (!areaKey || typeof MapRegistry === 'undefined' ||
            typeof MapRegistry.findFixedMapEntranceForDungeon !== 'function') return null;
        const entrance = MapRegistry.findFixedMapEntranceForDungeon(areaKey);
        if (!entrance) return null;
        const parentArea = (typeof STORY_DATA !== 'undefined' && STORY_DATA.areas)
            ? STORY_DATA.areas[entrance.parentAreaKey]
            : null;
        let worldX = Number.isFinite(Number(parentArea?.centerX)) ? Number(parentArea.centerX) : null;
        let worldY = Number.isFinite(Number(parentArea?.centerY)) ? Number(parentArea.centerY) : null;
        if ((!Number.isFinite(worldX) || !Number.isFinite(worldY)) && !visited.has(entrance.parentAreaKey)) {
            const nextVisited = new Set(visited);
            nextVisited.add(areaKey);
            const parentWorld = App.getFixedMapWorldDestination?.(entrance.parentAreaKey, nextVisited);
            if (parentWorld) {
                worldX = Number(parentWorld.x);
                worldY = Number(parentWorld.y);
            }
        }
        return {
            areaKey,
            parentAreaKey: entrance.parentAreaKey,
            parentDef: entrance.parentDef,
            parentMapDef: entrance.parentMapDef || entrance.parentDef,
            parentKind: entrance.parentKind || 'field',
            parentFloor: Math.max(0, Number(entrance.parentFloor || 0)),
            x: entrance.x,
            y: entrance.y,
            worldX: Number.isFinite(worldX) ? worldX : null,
            worldY: Number.isFinite(worldY) ? worldY : null
        };
    },

    getFixedMapWorldDestination: (areaKey, visited = new Set()) => {
        if (!areaKey || visited.has(areaKey) || typeof STORY_DATA === 'undefined' || !STORY_DATA.areas) return null;
        const nextVisited = new Set(visited);
        nextVisited.add(areaKey);

        const worldDef = (typeof WORLD_MAPS !== 'undefined' && WORLD_MAPS[areaKey]) || null;
        if (worldDef?.skyPrismDestination) {
            return {
                areaKey,
                worldKey: worldDef.key || areaKey,
                x: Number(worldDef.skyPrismDestination.x),
                y: Number(worldDef.skyPrismDestination.y),
                sourceAreaKey: areaKey
            };
        }

        const area = STORY_DATA.areas[areaKey];
        if (area && Number.isFinite(Number(area.centerX)) && Number.isFinite(Number(area.centerY))) {
            return { areaKey, x: Number(area.centerX), y: Number(area.centerY), sourceAreaKey: areaKey };
        }

        const localEntrance = App.getFixedMapLocalEntranceDestination?.(areaKey, nextVisited);
        if (localEntrance && Number.isFinite(localEntrance.worldX) && Number.isFinite(localEntrance.worldY)) {
            return {
                areaKey,
                x: localEntrance.worldX,
                y: localEntrance.worldY,
                sourceAreaKey: localEntrance.parentAreaKey,
                parentAreaKey: localEntrance.parentAreaKey
            };
        }
        return null;
    },

    getAllFixedMapDiscoveryEntries: () => {
        const entries = [];
        const seen = new Set();
        const visited = App.ensureFixedMapDiscoveryStore ? App.ensureFixedMapDiscoveryStore() : (App.data?.progress?.visitedFixedMaps || {});
        // スカイプリズムの移動先正本。
        // 町やダンジョンへ初めて到着した時点で発見済みになり、ここに記載した入口だけを記憶する。
        // 同一施設内の地下・塔・回廊などは、固定MAPとして存在しても移動先には登録しない。
        const skyPrismAreaOrder = Object.freeze([
            'START_VILLAGE',
            'START_CAVE',
            'FOREST_WIND_HOLE',
            'FIRE_VILLAGE',
            'IGNIS_VOLCANO',
            'WIND_VILLAGE',
            'FORBIDDEN_FOREST',
            'WIND_TEMPLE',
            'WATER_CITY',
            'CRENA_LIMESTONE_CAVE',
            'SEABED_TEMPLE',
            'THUNDER_FORT',
            'BIG_TOWER',
            'LIGHT_PALACE',
            'DARK_SHRINE_RUINS',
            'GALVANIA_CAVE',
            'DARK_CASTLE',
            'GREZELIA_FORBIDDEN',
            'ABYSS_FIELD',
            'TRIAL_ISLAND',
            'CARMENA',
            'THUNDER_DUNES',
            'BLACK_ROPE_PYRAMID',
            'SCREAMING_CEMETERY',
            'MAGIC_WIND_MAUSOLEUM',
            'VISTA',
            'FROZEN_FOREST',
            'ICE_PENANCE_ROAD',
            'PURGATORY_MOUNTAINS',
            'SCORCHING_OLD_CASTLE',
            'LEGACION',
            'RIDPALM_DREAM_CORRIDOR',
            'JAGOREA_ROOT',
            'CHRONO_ABYSS',
            'FINAL_ALTAR',
            'SUMMIT_TEMPLE',
            'RUINED_SHRINE'
        ]);

        const push = (areaKey) => {
            if (!areaKey || seen.has(areaKey)) return;
            const info = App.getFixedMapDef(areaKey);
            if (!info) return;
            seen.add(areaKey);

            // ワールドマップそのものの移動可否と、その世界に属する町・ダンジョンの移動可否は別契約。
            // 深淵世界は直接の移動先にしないが、発見済みのカルメナ等はスカイプリズムへ登録する。
            if (info.kind === 'world' && info.def?.skyPrismEligible === false) return;
            const dest = App.getFixedMapWorldDestination(areaKey);
            const record = visited[areaKey] || null;
            const discovered = !!record;
            const rank = skyPrismAreaOrder.indexOf(areaKey);

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

        skyPrismAreaOrder.forEach(push);

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
            worldKey: dest?.worldKey || STORY_DATA?.areas?.[areaKey]?.worldKey || (info.kind === 'world' ? areaKey : 'WORLD'),
            parentAreaKey: dest?.parentAreaKey || null,
            foundAt: current?.foundAt || Date.now()
        };

        const changed = !current ||
            current.name !== entry.name ||
            current.kind !== entry.kind ||
            Number(current.worldX) !== Number(entry.worldX) ||
            Number(current.worldY) !== Number(entry.worldY) ||
            (current.worldKey || 'WORLD') !== entry.worldKey ||
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

        const visited = App.ensureFixedMapDiscoveryStore();
        if (!visited[areaKey]) return { ok: false, message: 'まだ発見していない場所には移動できない。' };

        const info = App.getFixedMapDef(areaKey);
        if (!info) return { ok: false, message: 'この場所の定義が見つかりません。' };
        const targetWorldKey = info.kind === 'world'
            ? areaKey
            : ((typeof STORY_DATA !== 'undefined' && STORY_DATA.areas?.[areaKey]?.worldKey) || visited[areaKey]?.worldKey || 'WORLD');
        const targetWorld = (typeof MapRegistry !== 'undefined' && MapRegistry.getWorldDefinition)
            ? MapRegistry.getWorldDefinition(targetWorldKey)
            : null;
        if (info.kind === 'world' && targetWorld?.skyPrismEligible === false) {
            return { ok: false, message: '深淵世界はスカイプリズムの座標に定着しない。' };
        }
        const dest = App.getFixedMapWorldDestination(areaKey);
        if (!dest) return { ok: false, message: 'この場所のフィールド座標が見つかりません。' };
        const authoredEntry = info.kind === 'field' && info.def?.skyPrismEntryPoint
            ? info.def.skyPrismEntryPoint
            : null;
        const localDest = authoredEntry
            ? {
                areaKey,
                parentAreaKey: areaKey,
                parentDef: info.def,
                parentMapDef: info.def,
                parentKind: 'field',
                parentFloor: 0,
                x: Number(authoredEntry.x),
                y: Number(authoredEntry.y),
                worldX: Number(dest.x),
                worldY: Number(dest.y)
            }
            : (App.getFixedMapLocalEntranceDestination?.(areaKey) || null);

        App.data.items[110] = (Number(App.data.items[110]) || 0) - 1;
        if (App.data.items[110] <= 0) delete App.data.items[110];

        if (typeof Field !== 'undefined' && typeof Field.stopMove === 'function') Field.stopMove();
        if (typeof App.clearAction === 'function') App.clearAction();

        App.data.transportMode = null;
        if (localDest) {
            App.data.mapReturnPoint = Number.isFinite(localDest.worldX) && Number.isFinite(localDest.worldY)
                ? { areaKey: targetWorldKey, worldKey: targetWorldKey, x: localDest.worldX, y: localDest.worldY }
                : null;
            App.data.location.area = localDest.parentAreaKey;
            App.data.location.worldKey = targetWorldKey;
            App.data.location.x = localDest.x;
            App.data.location.y = localDest.y;
        } else {
            App.data.mapReturnPoint = null;
            App.data.location.area = targetWorldKey;
            App.data.location.worldKey = targetWorldKey;
            App.data.location.x = dest.x;
            App.data.location.y = dest.y;
        }
        if (App.data.dungeon) {
            App.data.dungeon.returnPoint = null;
            App.data.dungeon.returnStack = [];
            App.data.dungeon.map = null;
            App.data.dungeon.adventurer = null;
            App.data.dungeon.healSpring = null;
            App.data.dungeon.abyssRift = null;
            App.data.dungeon.pendingRiftReward = null;
            App.data.dungeon.visitedMap = null;
        }
        const localDungeon = !!(localDest && localDest.parentKind === 'dungeon');
        if (App.data.progress) App.data.progress.floor = localDungeon ? Math.max(1, Number(localDest.parentFloor || 1)) : 0;

        Field.currentMapData = localDest
            ? (localDungeon
                ? (MapRegistry.getFixedDungeonFloor(localDest.parentAreaKey, localDest.parentFloor || 1) || localDest.parentMapDef)
                : {
                    ...localDest.parentDef,
                    isFixed: true,
                    isDungeon: localDest.parentDef?.isDungeon === true,
                    areaKey: localDest.parentAreaKey
                })
            : null;
        if (localDungeon && typeof Dungeon !== 'undefined') Dungeon.floor = App.data.progress.floor;
        Field.x = localDest ? localDest.x : dest.x;
        Field.y = localDest ? localDest.y : dest.y;

        App.save();
        App.changeScene('field');
        if (typeof Field.render === 'function') Field.render();
        if (typeof Field.refreshCurrentAction === 'function') Field.refreshCurrentAction({ silent: true });
        if (typeof Field.startIdleStep === 'function') Field.startIdleStep();

        const targetName = info.def.name || areaKey;
        const suffix = localDest ? 'の入口' : (dest.parentAreaKey && dest.parentAreaKey !== areaKey ? 'の入口付近' : 'の入口');
        const message = `${targetName}${suffix}へ移動した！`;
        if (typeof App.log === 'function') App.log(message);

        // スカイプリズム成功時はログ表示のみ。
        // 使用確認の後に追加のOKモーダルを出さないため、呼び出し側へ通知する。
        return { ok: true, message, silentSuccess: true };
    },

    requestSkyPrismTravelTo: (areaKey, label = '') => {
        if (!areaKey) return false;
        const info = App.getFixedMapDef?.(areaKey);
        const name = label || info?.def?.name || areaKey;
        if (!App.hasItem(110)) {
            Menu.msg('スカイプリズムを持っていません。');
            return false;
        }
        const visited = App.ensureFixedMapDiscoveryStore?.() || {};
        if (!visited[areaKey]) {
            Menu.msg('まだ発見していない場所には移動できない。');
            return false;
        }
        Menu.confirm(`${name}の入口へ移動しますか？
スカイプリズムを1個消費します。`, () => {
            const result = App.useSkyPrismTo(areaKey);
            if (!result?.ok) {
                Menu.msg(result?.message || '移動できません。');
                return;
            }
            if (typeof Facilities !== 'undefined') Facilities.closeModal?.('guild-scene');
            Menu.closeAll?.();
        });
        return true;
    },

    canTravelToGuildReception: () => {
        if (!App.data) return false;
        const flags = App.data.progress?.flags || {};
        const visited = App.data.progress?.visitedFixedMaps || {};
        return App.data.location?.area === 'THUNDER_FORT'
            || flags.thunderFortCleared === true
            || !!visited.THUNDER_FORT;
    },

    travelToGuildReception: () => {
        if (!App.canTravelToGuildReception()) {
            return { ok: false, message: 'ライザーク要塞の冒険者ギルドはまだ利用できません。' };
        }
        const areaKey = 'THUNDER_FORT';
        const floorNo = 1;
        const floorData = (typeof MapRegistry !== 'undefined' && typeof MapRegistry.getFixedDungeonFloor === 'function')
            ? MapRegistry.getFixedDungeonFloor(areaKey, floorNo)
            : (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[areaKey]
                ? { ...FIXED_DUNGEON_MAPS[areaKey], isDungeon: true, isFixed: true, areaKey, floor: floorNo }
                : null);
        if (!floorData) return { ok: false, message: 'ギルド受付のマップ情報を読み込めませんでした。' };

        if (typeof Field !== 'undefined' && typeof Field.stopMove === 'function') Field.stopMove();
        if (typeof App.clearAction === 'function') App.clearAction();
        if (typeof Menu !== 'undefined' && typeof Menu.closeAll === 'function') Menu.closeAll();

        App.data.transportMode = null;
        const worldDest = App.getFixedMapWorldDestination?.(areaKey);
        App.data.mapReturnPoint = worldDest
            ? { areaKey: 'WORLD', x: Number(worldDest.x), y: Number(worldDest.y) }
            : null;
        App.data.location.area = areaKey;
        App.data.location.x = 5;
        App.data.location.y = 22;
        if (App.data.progress) App.data.progress.floor = floorNo;
        if (App.data.dungeon) {
            App.data.dungeon.returnPoint = null;
            App.data.dungeon.returnStack = [];
            App.data.dungeon.map = null;
            App.data.dungeon.adventurer = null;
            App.data.dungeon.healSpring = null;
            App.data.dungeon.abyssRift = null;
            App.data.dungeon.pendingRiftReward = null;
            App.data.dungeon.visitedMap = null;
        }

        Field.currentMapData = floorData;
        Field.x = 5;
        Field.y = 22;
        Field.dir = 3;
        if (typeof Dungeon !== 'undefined') Dungeon.floor = floorNo;

        App.save();
        App.changeScene('field');
        Field.render?.();
        Field.refreshCurrentAction?.({ silent: true });
        Field.startIdleStep?.();
        App.log?.('ライザーク要塞1階、冒険者ギルド受付前へ移動した！');
        return { ok: true };
    },

    requestGuildReceptionTravel: () => {
        if (!App.canTravelToGuildReception()) {
            Menu.msg('ライザーク要塞の冒険者ギルドはまだ利用できません。');
            return false;
        }
        Menu.confirm('ライザーク要塞1階のギルド受付前へ移動しますか？', () => {
            const result = App.travelToGuildReception();
            if (!result?.ok) Menu.msg(result?.message || 'ギルド受付へ移動できませんでした。');
        });
        return true;
    },

    resolveQuestTravelAreaKey: (quest) => {
        if (!quest) return null;
        const explicit = quest.travelTarget?.areaKey || quest.travelAreaKey;
        if (explicit) return String(explicit);
        const scopeAreas = Array.isArray(quest.huntScope?.areaKeys) ? quest.huntScope.areaKeys : [];
        const first = scopeAreas[0] ? String(scopeAreas[0]) : '';
        if (first === 'ABYSS') return 'ABYSS_FIELD';
        if (first && App.getFixedMapDef?.(first)) return first;
        const region = String(quest.regionKey || '');
        if (region === 'ABYSS') return 'ABYSS_FIELD';
        return region && App.getFixedMapDef?.(region) ? region : null;
    },

    getWorldTileAt: (x, y) => {
        const worldMap = (typeof MapRegistry !== 'undefined' && MapRegistry.getActiveWorldMap)
            ? MapRegistry.getActiveWorldMap()
            : (typeof SURFACE_WORLD_MAP_DATA !== 'undefined' ? SURFACE_WORLD_MAP_DATA : null);
        if (!worldMap?.[0]) return 'W';
        const mapW = worldMap[0].length;
        const mapH = worldMap.length;
        const tx = ((Number(x) % mapW) + mapW) % mapW;
        const ty = ((Number(y) % mapH) + mapH) % mapH;
        return String(worldMap[ty][tx] || 'W').toUpperCase();
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
        const worldDef = (typeof MapRegistry !== 'undefined' && MapRegistry.getWorldDefinition)
            ? MapRegistry.getWorldDefinition()
            : null;
        if (worldDef?.allowFlight === false) {
            Menu.msg("深淵の空間では、光の翼は力を失っている。");
            return false;
        }
        if (Field.currentMapData || (MapRegistry?.getActiveWorldKey?.() || App.data.location.area) !== 'WORLD') {
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

    reconcileDerivedProgressFlags: () => {
        const flags = App.data?.progress?.flags;
        const rules = (typeof DERIVED_PROGRESS_FLAGS !== 'undefined' && Array.isArray(DERIVED_PROGRESS_FLAGS))
            ? DERIVED_PROGRESS_FLAGS
            : [];
        if (!flags || typeof flags !== 'object') return false;
        let changed = false;
        rules.forEach(rule => {
            if (!rule?.flag || !Array.isArray(rule.requires)) return;
            if (rule.requires.every(required => !!flags[required]) && !flags[rule.flag]) {
                flags[rule.flag] = true;
                changed = true;
            }
        });
        return changed;
    },

    /**
     * ストーリー上の仲間を加入させる
     * ガチャ産キャラクターと同一のデータ構造で初期化する
     */
    addStoryAlly: (charId, options = {}) => {
        const master = window.CHARACTERS_DATA.find(c => c.id === charId);
        if (!master) return;
        const initialLevel = App.getStoryAllyInitialLevel(charId);
        const existing = App.data.characters.find(c => c.charId === charId);
        if (existing) {
            let changed = false;
            while ((existing.level || 1) < initialLevel) {
                App.applyLevelUpGrowth(existing, { silent: true });
                changed = true;
            }
            if (Array.isArray(App.data.party) && !App.data.party.includes(existing.uid)) {
                const emptyIndex = App.data.party.findIndex(uid => !uid);
                if (emptyIndex >= 0) {
                    App.data.party[emptyIndex] = existing.uid;
                    changed = true;
                    if (!options.silent) App.log(`【仲間加入】${existing.name}がパーティに加わった！`);
                }
            }
            if (changed) App.save();
            return;
        }


        // 1. 必要な情報だけを抽出した保存用オブジェクトを作成
        //    ステータスはLv1基準で作成し、下で共通レベルアップ処理を回して初期Lvまで成長させる。
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
            skillBookSkills: [],
            config: { fullAuto: false, hiddenSkills: [], autoDisabledSkills: [], skillUsageConfigVersion: 2, strategy: 'balanced' },
            limitBreak: 0,
            lbProgress: {
                counters: { battleWins: 0 },
                sources: { story: 0, battle: 0, dungeon: 0, quest: 0, boss: 0, prism: 0, random: 0, gacha: 0, monster: 0, trial: 0, item: 0, legacy: 0 },
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

        // 3. ストーリー加入時の初期レベルを反映する。
        //    経験値だけを入れるのではなく、通常レベルアップと同じ成長・SP・スキル・特性処理を内部適用する。
        for (let lv = 1; lv < initialLevel; lv++) {
            App.applyLevelUpGrowth(saveAlly, { silent: true });
        }
        saveAlly.exp = 0;

        App.data.characters.push(saveAlly);
        let joinedParty = false;
        if (Array.isArray(App.data.party)) {
            const emptyIndex = App.data.party.findIndex(uid => !uid);
            if (emptyIndex >= 0) {
                App.data.party[emptyIndex] = saveAlly.uid;
                joinedParty = true;
            }
        }
        App.save();
        if (!options.silent) {
            App.log(joinedParty
                ? `なんと ${saveAlly.name}が仲間に加わった！`
                : `なんと ${saveAlly.name}が仲間に加わった！`);
        }
    },

    monsterRecruitConfig: {
        chance: 0.01,
        minRate: 0.8,
        maxRate: 1.2
    },

    isMonsterAlly: (char) => !!(char && char.isMonsterAlly === true),

    getHeroCharacter: () => {
        if (!App.data || !Array.isArray(App.data.characters)) return null;
        return App.data.characters.find(c => c && (c.uid === 'p1' || c.isHero || Number(c.charId) === 301)) || App.data.characters[0] || null;
    },

    getMonsterAllyInPartyCount: (excludeUid = null) => {
        if (!App.data || !Array.isArray(App.data.party) || !Array.isArray(App.data.characters)) return 0;
        return App.data.party.filter(uid => {
            if (!uid || uid === excludeUid) return false;
            const c = App.getChar(uid);
            return App.isMonsterAlly(c);
        }).length;
    },

    getMonsterAllyPartyLimit: () => {
        const flags = App.data?.progress?.flags || {};
        return (flags.monsterArenaSRankFirstClear === true || flags.monsterArenaSFirstClear === true) ? 2 : 1;
    },

    completeMonsterArenaRank: (rank) => {
        const normalized = String(rank || '').toUpperCase();
        if (!normalized) return { ok: false, message: '格闘場ランクを確認できません。' };
        if (!App.data.progress) App.data.progress = {};
        if (!App.data.progress.flags) App.data.progress.flags = {};
        const flags = App.data.progress.flags;
        if (!flags.monsterArenaClearedRanks || typeof flags.monsterArenaClearedRanks !== 'object') flags.monsterArenaClearedRanks = {};
        const firstClear = flags.monsterArenaClearedRanks[normalized] !== true;
        flags.monsterArenaClearedRanks[normalized] = true;
        let potGranted = false;
        let partyLimitUnlocked = false;
        if (normalized === 'S' && firstClear) {
            flags.monsterArenaSRankFirstClear = true;
            partyLimitUnlocked = true;
            const potId = Number(window.PRISMA_SYNTHESIS_POT_ITEM_ID || 599999);
            if (!App.data.items || typeof App.data.items !== 'object') App.data.items = {};
            App.data.items[potId] = Number(App.data.items[potId] || 0) + 1;
            potGranted = true;
        }
        App.save();
        return { ok: true, rank: normalized, firstClear, potGranted, partyLimitUnlocked, monsterPartyLimit: App.getMonsterAllyPartyLimit() };
    },

    canAddMonsterAllyToParty: (uid = null) => {
        const target = uid ? App.getChar(uid) : null;
        if (target && !App.isMonsterAlly(target)) return true;
        return App.getMonsterAllyInPartyCount(uid) < App.getMonsterAllyPartyLimit();
    },

    getMonsterRecruitCurrentFloor: (enemy = null, baseMonster = null) => {
        const candidates = [
            enemy?.generatedFloor,
            baseMonster?.generatedFloor,
            App.data?.progress?.floor,
            (typeof Dungeon !== 'undefined' ? Dungeon.floor : null),
            (typeof Field !== 'undefined' ? Field.currentMapData?.floor : null)
        ];
        for (const raw of candidates) {
            const floor = Math.floor(Number(raw));
            if (Number.isFinite(floor) && floor > 0) return Math.min(100, floor);
        }
        return 1;
    },

    getMonsterRecruitJoinLevel: (enemy = null, baseMonster = null) => {
        const hero = App.getHeroCharacter();
        const reincarnationCount = Math.max(0, Math.floor(Number(hero?.reincarnationCount) || 0));
        if (reincarnationCount > 0) return 100;

        const heroLevel = Math.max(1, Math.min(100, Math.floor(Number(hero?.level) || 1)));
        const floor = App.getMonsterRecruitCurrentFloor(enemy, baseMonster);
        return Math.max(1, Math.min(100, heroLevel, floor));
    },

    createHeroReferenceDataAtLevel: (level) => {
        const hero = App.getHeroCharacter();
        const master = (window.CHARACTERS_DATA || []).find(c => c && c.id === (hero?.charId || 301))
            || (window.CHARACTERS_DATA || []).find(c => c && c.id === 301)
            || hero
            || { id: 301, name: '主人公', job: '勇者', hp: 50, mp: 20, atk: 15, def: 10, mag: 10, mdef: 10, spd: 10 };
        const ref = {
            uid: '__monster_recruit_hero_ref__',
            charId: master.id || hero?.charId || 301,
            name: master.name || hero?.name || '主人公',
            job: master.job || hero?.job || '勇者',
            rarity: master.rarity || hero?.rarity || 'SSR',
            level: 1,
            exp: 0,
            sp: 0,
            hp: Math.max(1, Math.floor(Number(master.hp ?? hero?.hp ?? 50) || 50)),
            mp: Math.max(0, Math.floor(Number(master.mp ?? hero?.mp ?? 20) || 20)),
            atk: Math.max(1, Math.floor(Number(master.atk ?? hero?.atk ?? 15) || 15)),
            def: Math.max(1, Math.floor(Number(master.def ?? hero?.def ?? 10) || 10)),
            mag: Math.max(1, Math.floor(Number(master.mag ?? hero?.mag ?? 10) || 10)),
            mdef: Math.max(1, Math.floor(Number(master.mdef ?? hero?.mdef ?? 10) || 10)),
            spd: Math.max(1, Math.floor(Number(master.spd ?? hero?.spd ?? 10) || 10)),
            hit: 100,
            cri: 0,
            eva: 0,
            equips: { '武器': null, '盾': null, '頭': null, '体': null, '足': null },
            traits: [],
            disabledTraits: [],
            tree: {},
            alloc: {},
            config: { fullAuto: false, hiddenSkills: [], autoDisabledSkills: [], skillUsageConfigVersion: 2, strategy: 'balanced' },
            limitBreak: 0,
            reincarnationCount: 0,
            skills: []
        };

        // レベル1主人公を、加入モンスターのレベル相当まで内部成長させて基準値にする。
        // 実データには追加せず、この一時オブジェクトだけを成長させる。
        if (typeof PassiveSkill !== 'undefined' && typeof PassiveSkill.applyLevelUpTraits === 'function') {
            PassiveSkill.applyLevelUpTraits(ref);
        }
        const targetLevel = Math.max(1, Math.min(100, Math.floor(Number(level) || 1)));
        for (let lv = 1; lv < targetLevel; lv++) {
            if (typeof App.applyLevelUpGrowth === 'function') {
                App.applyLevelUpGrowth(ref, { silent: true });
            } else {
                ref.level++;
            }
        }
        ref.exp = 0;
        return ref;
    },

    getHeroReferenceStatsAtLevel: (level) => {
        const ref = App.createHeroReferenceDataAtLevel(level);
        if (typeof App.calcStats === 'function') return App.calcStats(ref);
        return {
            maxHp: ref.hp || 1, maxMp: ref.mp || 0, atk: ref.atk || 1, def: ref.def || 1,
            mdef: ref.mdef || 1, mag: ref.mag || 1, spd: ref.spd || 1
        };
    },

    adjustMonsterAllyPairToHeroIfHigher: (values, heroValues, options = {}) => {
        const minRate = Number(options.minRate || App.monsterRecruitConfig.minRate || 0.8);
        const maxRate = Number(options.maxRate || App.monsterRecruitConfig.maxRate || 1.2);
        const keys = Object.keys(values || {});
        if (keys.length === 0) return {};

        const original = {};
        keys.forEach(key => { original[key] = Math.max(0, Math.floor(Number(values[key]) || 0)); });
        const currentTotal = keys.reduce((sum, key) => sum + original[key], 0);
        const heroTotal = Object.keys(heroValues || {}).reduce((sum, key) => sum + Math.max(0, Number(heroValues[key]) || 0), 0);

        // 元々、同レベル相当の主人公基準値以下なら補正しない。
        if (currentTotal <= Math.max(0, heroTotal)) return original;

        const safeHeroTotal = Math.max(1, heroTotal);
        const rate = minRate + Math.random() * (maxRate - minRate);
        const randomCapTotal = Math.max(keys.length, Math.floor(safeHeroTotal * rate));
        const targetTotal = Math.min(currentTotal, randomCapTotal);

        if (targetTotal >= currentTotal) return original;
        if (currentTotal <= 0) {
            const base = Math.max(1, Math.floor(targetTotal / keys.length));
            const result = {};
            keys.forEach(key => { result[key] = base; });
            return result;
        }

        const result = {};
        let allocated = 0;
        keys.forEach((key, index) => {
            const current = Math.max(0, Number(original[key]) || 0);
            const val = (index === keys.length - 1)
                ? Math.max(0, targetTotal - allocated)
                : Math.max(0, Math.floor(targetTotal * (current / currentTotal)));
            result[key] = val;
            allocated += val;
        });
        return result;
    },

    adjustMonsterAllySingleToHeroIfHigher: (value, heroValue, options = {}) => {
        const current = Math.max(1, Math.floor(Number(value) || 1));
        const heroBase = Math.max(1, Math.floor(Number(heroValue) || 1));
        if (current <= heroBase) return current;
        const minRate = Number(options.minRate || App.monsterRecruitConfig.minRate || 0.8);
        const maxRate = Number(options.maxRate || App.monsterRecruitConfig.maxRate || 1.2);
        const rate = minRate + Math.random() * (maxRate - minRate);
        return Math.max(1, Math.min(current, Math.floor(heroBase * rate)));
    },

    adjustMonsterAllyHpMpToHeroIfHigher: (values, heroValues, options = {}) => {
        const hp = Math.max(1, Math.floor(Number(values?.hp) || 1));
        const mp = Math.max(0, Math.floor(Number(values?.mp) || 0));
        const heroHp = Math.max(1, Math.floor(Number(heroValues?.hp) || 1));
        const heroMp = Math.max(0, Math.floor(Number(heroValues?.mp) || 0));

        // HPが極端に大きいボスは、HP+MP合計で比例圧縮するとMPまで巻き込まれて低くなりすぎる。
        // そのためHP/MPだけは個別に「主人公基準より高い場合のみ」補正する。
        return {
            hp: hp > heroHp ? App.adjustMonsterAllySingleToHeroIfHigher(hp, heroHp, options) : hp,
            mp: (heroMp > 0 && mp > heroMp) ? App.adjustMonsterAllySingleToHeroIfHigher(mp, heroMp, options) : mp
        };
    },

    getMonsterRecruitImagePath: (baseMonster = null, enemy = null) => {
        const source = baseMonster || enemy;
        const byId = (typeof MonsterData !== 'undefined' && typeof MonsterData.getImagePath === 'function')
            ? MonsterData.getImagePath(source)
            : window.PRISMA_ASSETS?.getMonsterImagePath?.(source);
        if (byId) return byId;
        const monsterId = Number(baseMonster?.id ?? enemy?.baseId ?? enemy?.id);
        const map = (typeof window !== 'undefined' && window.MonsterImageMap) ? window.MonsterImageMap : {};
        return map[monsterId] || baseMonster?.image || baseMonster?.img || enemy?.image || enemy?.img || null;
    },

    getMonsterRecruitRarity: (baseMonster = null, enemy = null) => {
        return (baseMonster?.isBoss || enemy?.isBoss || baseMonster?.isRare || enemy?.isRare ||
            baseMonster?.isSpecialBoss || enemy?.isSpecialBoss || baseMonster?.isEstark || enemy?.isEstark) ? 'UR' : 'SR';
    },

    getMonsterRecruitTraitCountForLevel: (level) => {
        const lv = Math.max(1, Math.min(100, Math.floor(Number(level) || 1)));
        if (lv >= 80) return 6;
        if (lv >= 40) return 5;
        if (lv >= 20) return 4;
        if (lv >= 10) return 3;
        if (lv >= 5) return 2;
        return 1;
    },

    generateMonsterRecruitTraitsForLevel: (level, baseMonster = null, enemy = null) => {
        const traits = [];
        const count = App.getMonsterRecruitTraitCountForLevel(level);
        const used = new Set();

        const addTrait = (raw) => {
            if (traits.length >= count) return;
            const id = Math.floor(Number(raw?.id ?? raw));
            if (!Number.isFinite(id) || id <= 0 || used.has(id)) return;
            if (typeof PassiveSkill !== 'undefined' && PassiveSkill.MASTER && !PassiveSkill.MASTER[id]) return;
            used.add(id);
            // モンスター側の特性Lvはそのまま持ち込むとボスで強くなりすぎるため、加入時はLv1で習得扱いにする。
            traits.push({ id, level: 1, battleCount: 0 });
        };

        // モンスター固有特性がある場合は、まずそれを優先して取得する。
        if (Array.isArray(baseMonster?.traits)) baseMonster.traits.forEach(addTrait);
        if (Array.isArray(enemy?.traits)) enemy.traits.forEach(addTrait);

        if (typeof PassiveSkill === 'undefined' || typeof PassiveSkill.getRandomTraitId !== 'function') return traits;

        while (traits.length < count) {
            let traitId = null;
            for (let attempt = 0; attempt < 40; attempt++) {
                const candidate = PassiveSkill.getRandomTraitId();
                if (candidate && !used.has(Number(candidate))) {
                    traitId = Number(candidate);
                    break;
                }
            }
            if (!traitId) break;
            addTrait(traitId);
        }
        return traits;
    },

    // 後方互換用：旧名で呼ばれても、新しい「高い時だけ補正」ロジックに委譲する。
    clampMonsterAllyPairToHero: (values, heroValues, options = {}) => App.adjustMonsterAllyPairToHeroIfHigher(values, heroValues, options),

    extractMonsterSkillIds: (monsterLike) => {
        const ids = new Set();
        const add = (raw) => {
            const id = Math.floor(Number(raw));
            if (!Number.isFinite(id) || id <= 99) return;
            if (typeof DB !== 'undefined' && Array.isArray(DB.SKILLS) && !DB.SKILLS.some(s => Number(s.id) === id)) return;
            ids.add(id);
        };
        const sources = [];
        if (Array.isArray(monsterLike?.acts)) sources.push(...monsterLike.acts);
        if (Array.isArray(monsterLike?.skills)) sources.push(...monsterLike.skills);
        sources.forEach(entry => {
            if (entry && typeof entry === 'object') add(entry.id ?? entry.skillId);
            else add(entry);
        });
        return Array.from(ids);
    },

    createMonsterAllyData: (enemy, baseMonster = null) => {
        if (!App.data || !enemy) return null;
        const base = baseMonster || (typeof Battle !== 'undefined' && Battle.getMonsterBaseById ? Battle.getMonsterBaseById(enemy.baseId || enemy.id) : null) || enemy;
        const cfg = App.monsterRecruitConfig;
        const joinLevel = App.getMonsterRecruitJoinLevel(enemy, base);

        // 補正基準は「現在の主人公」ではなく、レベル1主人公を加入レベルまで内部成長させた基礎値。
        // 主人公が転生済みの場合、加入レベルはLv100扱いなので、基準値もLv100時点で計算する。
        const heroStats = App.getHeroReferenceStatsAtLevel(joinLevel);

        const rawAtkMag = { atk: enemy.atk ?? enemy.baseStats?.atk ?? base.atk ?? 1, mag: enemy.mag ?? enemy.baseStats?.mag ?? base.mag ?? 1 };
        const rawDefMdef = { def: enemy.def ?? enemy.baseStats?.def ?? base.def ?? 1, mdef: enemy.mdef ?? enemy.baseStats?.mdef ?? base.mdef ?? 1 };
        const rawHpMp = { hp: enemy.baseMaxHp ?? enemy.maxHp ?? base.hp ?? 1, mp: enemy.baseMaxMp ?? enemy.maxMp ?? base.mp ?? 0 };

        const atkMag = App.adjustMonsterAllyPairToHeroIfHigher(rawAtkMag, { atk: heroStats.atk, mag: heroStats.mag }, cfg);
        const defMdef = App.adjustMonsterAllyPairToHeroIfHigher(rawDefMdef, { def: heroStats.def, mdef: heroStats.mdef }, cfg);
        const hpMp = App.adjustMonsterAllyHpMpToHeroIfHigher(rawHpMp, { hp: heroStats.maxHp, mp: heroStats.maxMp }, cfg);
        const spd = App.adjustMonsterAllySingleToHeroIfHigher(enemy.spd ?? enemy.baseStats?.spd ?? base.spd ?? 1, heroStats.spd, cfg);

        const monsterId = Number(base.id ?? enemy.baseId ?? enemy.id);
        const uid = `m${monsterId}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const skillIds = App.extractMonsterSkillIds(base).concat(App.extractMonsterSkillIds(enemy))
            .filter((id, index, arr) => arr.indexOf(id) === index);

        const traits = App.generateMonsterRecruitTraitsForLevel(joinLevel, base, enemy);
        const monsterImage = App.getMonsterRecruitImagePath(base, enemy);

        const saveAlly = {
            uid,
            charId: 900000000 + monsterId,
            isMonsterAlly: true,
            monsterId,
            sourceMonsterId: monsterId,
            name: base.name || enemy.name || '仲間モンスター',
            job: base.name || enemy.name || '仲間モンスター',
            rarity: App.getMonsterRecruitRarity(base, enemy),
            level: joinLevel,
            exp: 0,
            sp: 0,
            hp: hpMp.hp,
            mp: hpMp.mp,
            atk: atkMag.atk,
            def: defMdef.def,
            mag: atkMag.mag,
            mdef: defMdef.mdef,
            spd,
            hit: 100,
            cri: 0,
            eva: 0,
            actCount: 1,
            resists: {},
            elmRes: {},
            skills: skillIds.slice(0, 8),
            skillBookSkills: [],
            equips: { '武器': null, '盾': null, '頭': null, '体': null, '足': null },
            traits,
            disabledTraits: [],
            tree: { ATK: 0, MAG: 0, SPD: 0, HP: 0, MP: 0, WARRIOR: 0, MAGE: 0, PRIEST: 0, M_KNIGHT: 0 },
            config: { fullAuto: false, hiddenSkills: [], autoDisabledSkills: [], skillUsageConfigVersion: 2, strategy: 'balanced' },
            limitBreak: 0,
            lbProgress: {
                counters: { battleWins: 0 },
                sources: { story: 0, battle: 0, dungeon: 0, quest: 0, boss: 0, prism: 0, random: 0, gacha: 0, monster: 0, trial: 0, legacy: 0 },
                trials: { mid: false, final: false, midClearedAt: null, finalClearedAt: null }
            },
            reincarnationCount: 0,
            formation: 'front',
            img: monsterImage,
            image: monsterImage,
            race: base.race || enemy.race || '魔物',
            growthBase: {
                hp: hpMp.hp, mp: hpMp.mp, atk: atkMag.atk, def: defMdef.def,
                mag: atkMag.mag, mdef: defMdef.mdef, spd
            },
            monsterAllyMeta: {
                joinedAt: Date.now(),
                originalName: base.name || enemy.name || '',
                originalRank: base.rank || base.generatedFloor || base.minF || enemy.rank || null,
                originalIsBoss: !!(base.isBoss || enemy.isBoss),
                originalIsSpecialBoss: !!(base.isSpecialBoss || base.isEstark || enemy.isSpecialBoss || enemy.isEstark)
            }
        };

        saveAlly.currentHp = saveAlly.hp;
        saveAlly.currentMp = saveAlly.mp;
        return saveAlly;
    },

    addOrLimitBreakMonsterAlly: (enemy, baseMonster = null) => {
        if (!App.data || !enemy) return { ok: false, message: '' };
        if (!Array.isArray(App.data.characters)) App.data.characters = [];
        const base = baseMonster || (typeof Battle !== 'undefined' && Battle.getMonsterBaseById ? Battle.getMonsterBaseById(enemy.baseId || enemy.id) : null) || enemy;
        const monsterId = Number(base.id ?? enemy.baseId ?? enemy.id);
        if (!Number.isFinite(monsterId)) return { ok: false, message: '' };

        const existing = App.data.characters.find(c => App.isMonsterAlly(c) && Number(c.monsterId || c.sourceMonsterId) === monsterId);
        if (existing) {
            App.backfillLimitBreakLegacy?.(existing);
            App.applyLimitBreakCap?.(existing);
            const before = Math.max(0, Math.floor(Number(existing.limitBreak) || 0));
            const max = Math.max(1, Math.floor(Number(App.limitBreakConfig?.max) || 99));
            const trialCap = typeof App.getLimitBreakTrialCap === 'function'
                ? Math.max(0, Math.floor(Number(App.getLimitBreakTrialCap(existing)) || 0))
                : max;

            let message = `【仲間モンスター】${existing.name}との絆が深まった！`;
            let lbChanged = false;
            if (before >= max) {
                message = `【仲間モンスター】${existing.name}のLBはすでに最大だ。`;
            } else if (before >= trialCap) {
                const gateName = trialCap < 50 ? '中間試練' : '最終試練';
                message = `【仲間モンスター】${existing.name}は${gateName}を越えるまで、これ以上LBを増やせない。`;
            } else if (typeof App.addLimitBreak === 'function') {
                const result = App.addLimitBreak(existing, 1, 'monster');
                lbChanged = result.after > before;
                message = lbChanged
                    ? `【仲間モンスター】${existing.name}のLBが上がった！`
                    : `【仲間モンスター】${existing.name}との絆が深まった！`;
            } else {
                existing.limitBreak = Math.min(trialCap, max, before + 1);
                lbChanged = existing.limitBreak > before;
                if (lbChanged) message = `【仲間モンスター】${existing.name}のLBが上がった！`;
            }
            App.ensureCharacterBattleConfig(existing);
            return { ok: true, existing: true, char: existing, lbChanged, message };
        }

        const saveAlly = App.createMonsterAllyData(enemy, base);
        if (!saveAlly) return { ok: false, message: '' };
        App.data.characters.push(saveAlly);

        let joinedParty = false;
        if (Array.isArray(App.data.party) && App.getMonsterAllyInPartyCount() < App.getMonsterAllyPartyLimit()) {
            const emptyIndex = App.data.party.findIndex(uid => !uid);
            if (emptyIndex >= 0) {
                App.data.party[emptyIndex] = saveAlly.uid;
                joinedParty = true;
            }
        }

        return {
            ok: true,
            existing: false,
            joinedParty,
            char: saveAlly,
            message: joinedParty
                ? `なんと ${saveAlly.name}が改心し \n仲間に加わった！`
                : `なんと ${saveAlly.name}が改心し \n仲間に加わった！`
        };
    },

    isMonsterRecruitBattleAllowed: () => {
        if (!App.data) return false;
        const area = (typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function')
            ? Field.getCurrentAreaKey()
            : App.data.location?.area;
        if (String(area || '') === 'ABYSS') return true;
        const worldKey = (typeof MapRegistry !== 'undefined' && MapRegistry.getActiveWorldKey)
            ? MapRegistry.getActiveWorldKey()
            : App.data.location?.worldKey;
        return worldKey === 'ABYSS_WORLD';
    },

    tryRecruitMonsterAfterBattle: (enemies) => {
        if (!App.isMonsterRecruitBattleAllowed()) return null;
        if (!Array.isArray(enemies) || enemies.length === 0) return null;
        const candidates = enemies.filter(enemy => {
            if (!enemy || !enemy.isDead || enemy.isFled || !(enemy.baseId || enemy.id)) return false;
            const base = (typeof Battle !== 'undefined' && Battle.getMonsterBaseById)
                ? Battle.getMonsterBaseById(enemy.baseId || enemy.id)
                : null;
            if (!base || base.abyssRecruitable === false) return false;
            return !base.isBoss && !base.isRare && !base.isSpecialBoss && !base.isEstark
                && !enemy.isBoss && !enemy.isRare && !enemy.isSpecialBoss && !enemy.isEstark;
        });
        if (candidates.length === 0) return null;
        if (Math.random() >= App.monsterRecruitConfig.chance) return null;

        const enemy = candidates[Math.floor(Math.random() * candidates.length)];
        const base = (typeof Battle !== 'undefined' && Battle.getMonsterBaseById) ? Battle.getMonsterBaseById(enemy.baseId || enemy.id) : null;
        const result = App.addOrLimitBreakMonsterAlly(enemy, base);
        if (result && result.ok) {
            if (typeof App.save === 'function') App.save();
            return result;
        }
        return null;
    },

    ensureQuestState: () => {
        if (!App.data.progress) App.data.progress = {};
        if (!App.data.progress.quests || typeof App.data.progress.quests !== 'object' || Array.isArray(App.data.progress.quests)) {
            App.data.progress.quests = {};
        }
        return App.data.progress.quests;
    },

    getQuestDefinitions: () => {
        return (typeof window !== 'undefined' && window.QUEST_DATA) ? window.QUEST_DATA : {};
    },

    getQuestDefinition: (questId) => {
        const defs = App.getQuestDefinitions();
        return defs ? defs[questId] : null;
    },

    getQuestState: (questId) => {
        const quests = App.ensureQuestState();
        return quests[questId] || { state: 'available' };
    },

    isQuestCompleted: (questId) => {
        return App.getQuestState(questId).state === 'completed';
    },

    hasStoryAlly: (charId) => {
        const id = Number(charId);
        return Array.isArray(App.data.characters) && App.data.characters.some(c => Number(c.charId) === id);
    },

    isQuestUnlocked: (questId) => {
        const quest = App.getQuestDefinition(questId);
        if (!quest) return false;
        const flags = App.data?.progress?.flags || {};
        const unlockFlags = Array.isArray(quest.unlockFlags) ? quest.unlockFlags : [];
        const missingFlags = Array.isArray(quest.missingFlags) ? quest.missingFlags : [];
        const requiredAllies = Array.isArray(quest.requiredAllies) ? quest.requiredAllies : [];
        const requiredQuests = Array.isArray(quest.requiredQuests) ? quest.requiredQuests : [];
        const rewardAllies = Array.isArray(quest.rewardAllies) ? quest.rewardAllies : [];
        const alreadyRewarded = rewardAllies.length > 0 && rewardAllies.every(charId => App.hasStoryAlly(charId));
        return unlockFlags.every(flag => !!flags[flag])
            && missingFlags.every(flag => !flags[flag])
            && requiredAllies.every(charId => App.hasStoryAlly(charId))
            && requiredQuests.every(id => App.isQuestCompleted(id))
            && !alreadyRewarded;
    },

    escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch])),

    getQuestKindLabel: (kind) => ({
        hunt: '討伐依頼',
        boss: '強敵討伐',
        conversation: '相談',
        travel: '探索',
        collection: '収集依頼'
    }[kind] || '依頼'),

    getQuestMonsterName: (monsterId) => {
        const id = Number(monsterId);
        const monster = (typeof DB !== 'undefined' && Array.isArray(DB.MONSTERS))
            ? DB.MONSTERS.find(m => Number(m.id) === id)
            : null;
        return monster?.name || `モンスター${id}`;
    },

    getQuestTargetSummary: (questId) => {
        const quest = App.getQuestDefinition(questId);
        const state = App.getQuestState(questId);
        if (!quest) return '';
        if (quest.kind === 'hunt' && Array.isArray(quest.targetMonsterIds) && quest.targetMonsterIds.length > 0) {
            const names = quest.targetMonsterIds.map(App.getQuestMonsterName).join(' / ');
            const total = Math.max(1, Number(quest.targetCount || 1));
            const current = state.state === 'completed'
                ? total
                : Math.min(total, Number(state.progress?.kills || 0));
            return `討伐対象: ${names}\n討伐数: ${current}/${total}`;
        }
        if (Array.isArray(quest.itemRequirements) && quest.itemRequirements.length > 0) {
            const lines = quest.itemRequirements.map(requirement => {
                const itemId = Number(requirement.id ?? requirement.itemId);
                const required = Math.max(1, Math.floor(Number(requirement.count) || 1));
                const owned = state.state === 'completed'
                    ? required
                    : Math.min(required, Number(App.data?.items?.[itemId] || 0));
                const item = (typeof DB !== 'undefined' && Array.isArray(DB.ITEMS))
                    ? DB.ITEMS.find(i => Number(i.id) === itemId)
                    : null;
                return `${item?.name || `アイテム${itemId}`}: ${owned}/${required}`;
            });
            return lines.join('\n');
        }
        if (quest.kind === 'boss') {
            return state.state === 'accepted' && state.progress?.bossDefeated
                ? (quest.reportText || '依頼人へ報告しよう。')
                : '目的地の強敵を倒す。';
        }
        return '';
    },

    getQuestRewardSummary: (quest) => {
        if (!quest) return '';
        const lines = [];
        if (Array.isArray(quest.rewardItems)) {
            quest.rewardItems.forEach(reward => {
                const itemId = Number(reward.id || reward.itemId);
                const count = Math.max(1, Number(reward.count || 1));
                const item = (typeof DB !== 'undefined' && Array.isArray(DB.ITEMS))
                    ? DB.ITEMS.find(i => Number(i.id) === itemId)
                    : null;
                lines.push(`${item?.name || `アイテム${itemId}`} x${count}`);
            });
        }
        if (Array.isArray(quest.rewardAllies)) {
            quest.rewardAllies.forEach(charId => {
                const ally = (typeof window !== 'undefined' && Array.isArray(window.CHARACTERS_DATA))
                    ? window.CHARACTERS_DATA.find(c => Number(c.id) === Number(charId))
                    : null;
                lines.push(`${ally?.name || `仲間${charId}`} 加入`);
            });
        }
        if (Array.isArray(quest.rewardFlags) && quest.rewardFlags.length && lines.length === 0) lines.push('物語進行');
        return lines.join('\n') || 'なし';
    },

    buildQuestModalHtml: (questId, options = {}) => {
        const quest = App.getQuestDefinition(questId);
        const state = App.getQuestState(questId);
        if (!quest) return '';
        const esc = App.escapeHtml;
        const status = options.statusLabel || ({
            available: '紹介中',
            accepted: App.isQuestObjectiveComplete?.(questId) ? '報告できます' : '受注中',
            completed: 'クリア'
        }[state.state || 'available'] || '紹介中');
        const target = App.getQuestTargetSummary(questId);
        const reward = App.getQuestRewardSummary(quest);
        const bodyText = options.bodyText || quest.startText || quest.objective || '';
        const progressText = state.state === 'accepted'
            ? (App.getQuestProgressText ? App.getQuestProgressText(questId) : quest.progressText || quest.objective || '')
            : (quest.objective || quest.progressText || '');
        return `
            <div style="width:min(420px, calc(100vw - 24px)); max-height:calc(100vh - 30px); overflow:auto; color:#f6ead2; font-family:inherit; background:#2a1b11; border:2px solid #b88a4c; box-shadow:0 18px 60px rgba(0,0,0,.72), inset 0 0 0 2px rgba(255,230,170,.18); border-radius:8px;">
                <div style="padding:12px 14px 10px; background:linear-gradient(180deg,#6b4421,#3c2515); border-bottom:1px solid rgba(255,220,150,.35);">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <div style="font-size:12px; color:#ffe2a4;">クエスト</div>
                        <div style="font-size:11px; color:#2a1608; background:#f1d184; border:1px solid #fff0bc; border-radius:10px; padding:2px 8px; font-weight:bold;">${esc(status)}</div>
                    </div>
                    <div style="font-size:18px; color:#fff7dc; font-weight:bold; margin-top:3px; line-height:1.25;">${esc(quest.name)}</div>
                    <div style="font-size:11px; color:#d8b982; margin-top:4px;">${esc(quest.area || '-')} / ${esc(App.getQuestKindLabel(quest.kind))}</div>
                </div>
                <div style="padding:12px 14px;">
                    <div style="font-size:13px; color:#f7ead0; line-height:1.65; white-space:pre-wrap;">${esc(bodyText)}</div>
                    <div style="margin-top:12px; padding:10px; background:rgba(0,0,0,.22); border:1px solid rgba(255,225,160,.2); border-radius:6px;">
                        <div style="font-size:11px; color:#e6c27c; margin-bottom:4px;">目的</div>
                        <div style="font-size:12px; line-height:1.55; white-space:pre-wrap;">${esc(progressText)}</div>
                    </div>
                    ${target ? `<div style="margin-top:8px; padding:10px; background:rgba(0,0,0,.18); border:1px solid rgba(255,225,160,.16); border-radius:6px;"><div style="font-size:11px; color:#e6c27c; margin-bottom:4px;">対象</div><div style="font-size:12px; line-height:1.55; white-space:pre-wrap;">${esc(target)}</div></div>` : ''}
                    <div style="margin-top:8px; padding:10px; background:rgba(82,54,25,.38); border:1px solid rgba(255,225,160,.18); border-radius:6px;">
                        <div style="font-size:11px; color:#e6c27c; margin-bottom:4px;">報酬</div>
                        <div style="font-size:12px; line-height:1.55; white-space:pre-wrap;">${esc(reward)}</div>
                    </div>
                </div>
            </div>
        `;
    },

    showQuestModal: (questId, options = {}) => new Promise(resolve => {
        const quest = App.getQuestDefinition(questId);
        if (!quest || typeof document === 'undefined') {
            resolve(options.defaultValue ?? false);
            return;
        }
        const old = document.getElementById('quest-detail-modal');
        if (old) old.remove();
        const overlay = document.createElement('div');
        overlay.id = 'quest-detail-modal';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:7000; background:rgba(0,0,0,.72); display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box;';
        const travelButton = (!options.offer && options.travelAreaKey)
            ? `<button id="quest-modal-travel" class="btn" style="flex:1; border-color:#8fd7ff; color:#eaf8ff; background:#23485f;">入口へ移動</button>`
            : '';
        const buttons = options.offer ? `
            <div style="display:flex; gap:8px; padding:0 14px 14px;">
                <button id="quest-modal-accept" class="btn" style="flex:1; border-color:#ffd56b; color:#fff7dc; background:#6f4b1f;">受ける</button>
                <button id="quest-modal-decline" class="btn" style="flex:1; background:#2f2f2f;">やめる</button>
            </div>
        ` : `
            <div style="display:flex; gap:8px; padding:0 14px 14px;">
                ${travelButton}
                <button id="quest-modal-close" class="btn" style="flex:1; border-color:#ffd56b; color:#fff7dc; background:#6f4b1f;">閉じる</button>
            </div>
        `;
        overlay.innerHTML = `<div onclick="event.stopPropagation()">${App.buildQuestModalHtml(questId, options)}${buttons}</div>`;
        document.body.appendChild(overlay);
        const close = (value) => {
            overlay.remove();
            resolve(value);
        };
        overlay.onclick = () => {
            if (!options.offer) close(options.defaultValue ?? true);
        };
        const accept = document.getElementById('quest-modal-accept');
        const decline = document.getElementById('quest-modal-decline');
        const closeBtn = document.getElementById('quest-modal-close');
        const travelBtn = document.getElementById('quest-modal-travel');
        if (accept) accept.onclick = () => close(true);
        if (decline) decline.onclick = () => close(false);
        if (closeBtn) closeBtn.onclick = () => close(true);
        if (travelBtn) travelBtn.onclick = () => {
            const areaKey = String(options.travelAreaKey || '');
            const label = options.travelLabel || quest.area || quest.name || areaKey;
            close(true);
            setTimeout(() => App.requestSkyPrismTravelTo?.(areaKey, label), 0);
        };
    }),

    acceptQuest: (questId, options = {}) => {
        const quest = App.getQuestDefinition(questId);
        if (!quest) return false;
        const quests = App.ensureQuestState();
        const current = quests[questId];
        if (current && current.state === 'completed') {
            return true;
        }
        if (current && current.state === 'accepted') {
            return true;
        }
        if (!App.isQuestUnlocked(questId)) {
            return false;
        }
        quests[questId] = {
            ...(current && typeof current === 'object' ? current : {}),
            state: 'accepted',
            startedAt: Date.now(),
            completedAt: null,
            progress: {}
        };
        App.save();
        if (typeof MenuStatus !== 'undefined' && typeof MenuStatus.render === 'function') MenuStatus.render();
        return true;
    },

    completeQuest: (questId, options = {}) => {
        const quest = App.getQuestDefinition(questId);
        if (!quest) return false;
        const quests = App.ensureQuestState();
        const current = quests[questId];
        if (current && current.state === 'completed') {
            return true;
        }
        if (!App.isQuestUnlocked(questId)) {
            return false;
        }

        const itemRequirements = Array.isArray(quest.itemRequirements) ? quest.itemRequirements : [];
        if (quest.consumeItemsOnComplete === true && itemRequirements.length > 0) {
            const canConsume = itemRequirements.every(requirement => {
                const itemId = Number(requirement.id ?? requirement.itemId);
                const count = Math.max(1, Math.floor(Number(requirement.count) || 1));
                return Number(App.data?.items?.[itemId] || 0) >= count;
            });
            if (!canConsume) return false;
        }

        quests[questId] = {
            state: 'completed',
            startedAt: current?.startedAt || Date.now(),
            completedAt: Date.now()
        };
        App.incrementLifetimeStat('totalQuestCompletions', 1, { save: false });

        if (quest.consumeItemsOnComplete === true && itemRequirements.length > 0) {
            itemRequirements.forEach(requirement => {
                const itemId = Number(requirement.id ?? requirement.itemId);
                const count = Math.max(1, Math.floor(Number(requirement.count) || 1));
                const remain = Number(App.data.items?.[itemId] || 0) - count;
                if (remain > 0) App.data.items[itemId] = remain;
                else delete App.data.items[itemId];
            });
        }

        if (Array.isArray(quest.rewardFlags)) {
            if (!App.data.progress.flags) App.data.progress.flags = {};
            quest.rewardFlags.forEach(flag => { if (flag) App.data.progress.flags[flag] = true; });
        }
        if (Array.isArray(quest.rewardItems)) {
            if (!App.data.items) App.data.items = {};
            quest.rewardItems.forEach(reward => {
                const itemId = Number(reward.id || reward.itemId);
                const count = Math.max(1, Number(reward.count || 1));
                if (!Number.isFinite(itemId)) return;
                App.data.items[itemId] = Number(App.data.items[itemId] || 0) + count;
            });
        }
        if (Array.isArray(quest.rewardAllies)) {
            quest.rewardAllies.forEach(charId => App.addStoryAlly(charId, { silent: true }));
        }

        App.save();
        if (typeof MenuStatus !== 'undefined' && typeof MenuStatus.render === 'function') MenuStatus.render();
        return true;
    },

    noteQuestKills: (monsterIds = [], battleContext = {}) => {
        if (!Array.isArray(monsterIds) || monsterIds.length === 0) return [];
        const quests = App.ensureQuestState();
        const updated = [];
        Object.entries(quests).forEach(([questId, state]) => {
            if (state?.state !== 'accepted') return;
            const quest = App.getQuestDefinition(questId);
            const targets = Array.isArray(quest?.targetMonsterIds) ? quest.targetMonsterIds.map(Number) : [];
            if (quest?.kind !== 'hunt' || targets.length === 0) return;
            const gained = monsterIds.filter(id => targets.includes(Number(id))).length;
            if (gained <= 0) return;
            if (!state.progress || typeof state.progress !== 'object') state.progress = {};
            state.progress.kills = Math.min(Number(quest.targetCount || 1), Number(state.progress.kills || 0) + gained);
            updated.push(questId);
        });
        const guildUpdated = (typeof Guild !== 'undefined' && typeof Guild.noteQuestKills === 'function')
            ? Guild.noteQuestKills(monsterIds, battleContext, { save: false })
            : [];
        if (updated.length || guildUpdated.length) App.save();
        return [...updated, ...guildUpdated];
    },

    markQuestBossDefeated: (questId) => {
        const quest = App.getQuestDefinition(questId);
        const state = App.getQuestState(questId);
        if (!quest || quest.kind !== 'boss' || state.state !== 'accepted') return false;
        if (!state.progress || typeof state.progress !== 'object') state.progress = {};
        state.progress.bossDefeated = true;
        state.progress.bossDefeatedAt = Date.now();
        App.save();
        return true;
    },

    isQuestObjectiveComplete: (questId) => {
        const quest = App.getQuestDefinition(questId);
        const state = App.getQuestState(questId);
        if (!quest || state.state !== 'accepted') return false;
        if (quest.kind === 'hunt') {
            return Number(state.progress?.kills || 0) >= Math.max(1, Number(quest.targetCount || 1));
        }
        if (Array.isArray(quest.itemRequirements) && quest.itemRequirements.length > 0) {
            return quest.itemRequirements.every(requirement => {
                const itemId = Number(requirement.id ?? requirement.itemId);
                const required = Math.max(1, Math.floor(Number(requirement.count) || 1));
                return Number(App.data?.items?.[itemId] || 0) >= required;
            });
        }
        if (quest.kind === 'boss') return !!state.progress?.bossDefeated;
        return false;
    },

    getQuestProgressText: (questId) => {
        const quest = App.getQuestDefinition(questId);
        const state = App.getQuestState(questId);
        if (!quest) return '';
        if (quest.kind === 'hunt' && state.state === 'accepted') {
            const current = Math.min(Number(quest.targetCount || 1), Number(state.progress?.kills || 0));
            return `${quest.progressText || quest.objective || quest.name}\n討伐数 ${current}/${Math.max(1, Number(quest.targetCount || 1))}`;
        }
        if (Array.isArray(quest.itemRequirements) && quest.itemRequirements.length > 0 && state.state === 'accepted') {
            const summary = App.getQuestTargetSummary(questId);
            return `${quest.progressText || quest.objective || quest.name}${summary ? `\n${summary}` : ''}`;
        }
        if (quest.kind === 'boss' && state.state === 'accepted' && state.progress?.bossDefeated) {
            return quest.reportText || '依頼人のもとへ戻り、勝利を伝えよう。';
        }
        return quest.progressText || quest.objective || quest.name;
    },

    runQuestAction: async (questId, options = {}) => {
        const quest = App.getQuestDefinition(questId);
        if (!quest) {
            return false;
        }
        if (!App.isQuestUnlocked(questId)) {
            await App.showQuestModal(questId, {
                statusLabel: 'まだ受けられません',
                bodyText: options.lockedText || '今はまだ、この依頼を進める時ではないようだ。'
            });
            return false;
        }
        const state = App.getQuestState(questId).state;
        if (state === 'completed') {
            await App.showQuestModal(questId, {
                statusLabel: 'クリア',
                bodyText: quest.completeText || quest.objective || quest.name
            });
            return true;
        }
        if (state !== 'accepted') {
            const storedState = App.ensureQuestState()[questId] || {};
            // 仲間加入などの依頼は、依頼内容を機械的に先出しせず、まず当人との会話を見せる。
            if (quest.startEventId && !storedState.introSeen && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                await StoryManager.executeEvent(quest.startEventId);
                App.ensureQuestState()[questId] = {
                    ...storedState,
                    state: 'available',
                    introSeen: true,
                    introSeenAt: Date.now(),
                    progress: storedState.progress || {}
                };
                App.save();
            }
            const accepted = await App.showQuestModal(questId, {
                offer: true,
                statusLabel: '依頼を受けますか？',
                bodyText: quest.startText || quest.objective || quest.name,
                defaultValue: false
            });
            if (!accepted) return false;
            App.acceptQuest(questId, { silent: true });
            if (App.isQuestObjectiveComplete(questId) && Array.isArray(quest.itemRequirements) && quest.itemRequirements.length > 0) {
                if (quest.reportEventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                    await StoryManager.executeEvent(quest.reportEventId);
                }
                App.completeQuest(questId, { silent: true });
                await App.showQuestModal(questId, {
                    statusLabel: 'クリア',
                    bodyText: quest.completeText || quest.objective || quest.name
                });
                return true;
            }
            if (options.complete || quest.initialComplete || quest.kind === 'conversation') {
                App.completeQuest(questId, { silent: true });
                await App.showQuestModal(questId, {
                    statusLabel: 'クリア',
                    bodyText: quest.completeText || quest.objective || quest.name
                });
            }
            return true;
        }
        if (App.isQuestObjectiveComplete(questId)) {
            if (quest.reportEventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                await StoryManager.executeEvent(quest.reportEventId);
            }
            App.completeQuest(questId, { silent: true });
            await App.showQuestModal(questId, {
                statusLabel: 'クリア',
                bodyText: quest.completeText || quest.objective || quest.name
            });
            return true;
        }
        if (options.complete || quest.initialComplete || quest.kind === 'conversation') {
            App.completeQuest(questId, { silent: true });
            await App.showQuestModal(questId, {
                statusLabel: 'クリア',
                bodyText: quest.completeText || quest.objective || quest.name
            });
            return true;
        }
        await App.showQuestModal(questId, {
            statusLabel: App.isQuestObjectiveComplete?.(questId) ? '報告できます' : '受注中',
            bodyText: quest.progressText || quest.objective || quest.name
        });
        return true;
    },


    showQuestBoardModal: (action = {}) => new Promise(resolve => {
        const questIds = Array.isArray(action.questIds) ? action.questIds.filter(id => App.getQuestDefinition(id)) : [];
        if (!questIds.length || typeof document === 'undefined') {
            resolve(null);
            return;
        }
        document.getElementById('quest-board-modal')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'quest-board-modal';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:6990; background:rgba(0,0,0,.76); display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box;';
        const rows = questIds.map(id => {
            const quest = App.getQuestDefinition(id);
            const state = App.getQuestState(id);
            const unlocked = App.isQuestUnlocked(id);
            const objectiveReady = state.state === 'accepted' && App.isQuestObjectiveComplete(id);
            const status = !unlocked ? '未解放' : state.state === 'completed' ? '達成済み' : objectiveReady ? '報告可能' : state.state === 'accepted' ? '受注中' : '受注可能';
            const disabled = unlocked ? '' : 'disabled';
            return `<button class="quest-board-entry btn" data-quest-id="${App.escapeHtml(id)}" ${disabled} style="display:block; width:100%; text-align:left; padding:11px 12px; margin-top:8px; background:${objectiveReady ? '#5c4517' : '#241b16'}; border:1px solid ${objectiveReady ? '#ffd56b' : '#76593a'}; color:#fff3d1; border-radius:6px;">
                <span style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>${App.escapeHtml(quest.name)}</strong><small style="color:#e7c77d; white-space:nowrap;">${status}</small></span>
                <span style="display:block; color:#c9b99d; font-size:11px; line-height:1.45; margin-top:5px;">${App.escapeHtml(quest.objective || '')}</span>
                <span style="display:block; color:#98d9a8; font-size:11px; margin-top:5px; white-space:pre-wrap;">報酬: ${App.escapeHtml(App.getQuestRewardSummary(quest))}</span>
            </button>`;
        }).join('');
        overlay.innerHTML = `<div style="width:min(460px,calc(100vw - 24px)); max-height:calc(100vh - 30px); overflow:auto; background:#17110d; border:2px solid #b88a4c; border-radius:8px; box-shadow:0 18px 60px rgba(0,0,0,.75); padding:14px; box-sizing:border-box;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; border-bottom:1px solid #5c432a; padding-bottom:10px;">
                <div><div style="font-size:18px; color:#fff2c6; font-weight:bold;">依頼掲示板</div><div style="font-size:11px; color:#bfa77f; margin-top:3px;">討伐・素材交換依頼</div></div>
                <button id="quest-board-close" class="btn" style="min-width:72px;">閉じる</button>
            </div>${rows}
        </div>`;
        document.body.appendChild(overlay);
        const close = value => { overlay.remove(); resolve(value); };
        overlay.onclick = event => { if (event.target === overlay) close(null); };
        overlay.querySelector('#quest-board-close').onclick = () => close(null);
        overlay.querySelectorAll('.quest-board-entry:not([disabled])').forEach(button => {
            button.onclick = () => close(button.dataset.questId || null);
        });
        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('dialogue');
    }),

    runQuestBoard: async (action = {}) => {
        const questId = await App.showQuestBoardModal(action);
        if (!questId) return false;
        await App.runQuestAction(questId, { lockedText: action.lockedText });
        if (typeof Field !== 'undefined') {
            Field.refreshVisualState?.();
            Field.refreshCurrentAction?.({ silent: true });
        }
        return true;
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

        const sourceKeys = ['story', 'battle', 'dungeon', 'quest', 'boss', 'prism', 'random', 'gacha', 'monster', 'trial', 'item', 'legacy'];
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
                const maxFloor = App.getAbyssLegacyProgressFloor ? App.getAbyssLegacyProgressFloor() : (App.data.dungeon ? Number(App.data.dungeon.maxFloor || 0) : 0);
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
        const okBtn = document.getElementById('btn-ok');
        if (okBtn) {
            okBtn.textContent = 'OK';
            okBtn.classList.add('has-field-action');
        }
        App.pendingAction = callback;
    },

    setFeatureAction: (label, featureKey, callback, lockedLabel = '封印中') => {
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
        const okBtn = document.getElementById('btn-ok');
        if (okBtn) {
            okBtn.textContent = 'OK';
            okBtn.classList.remove('has-field-action');
        }
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
        if (typeof Field !== 'undefined' && Field._visualCutsceneActive) return true;
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
            btn.textContent = '続きから';
            const detail = document.createElement('span');
            detail.style.fontSize = '12px';
            detail.textContent = `(${name} Lv.${lv})`;
            btn.appendChild(document.createElement('br'));
            btn.appendChild(detail);
        } 
    },

    migrateAbyssRegionSave: () => {
        if (!App.data) return;
        App.data.location = App.data.location || { area: 'WORLD', x: 58, y: 65, worldKey: 'WORLD' };
        App.data.progress = App.data.progress || {};
        App.data.progress.flags = App.data.progress.flags || {};
        App.data.progress.unlocked = App.data.progress.unlocked || {};
        App.data.dungeon = App.data.dungeon || {};
        App.data.system = App.data.system || {};
        if (!App.data.progress.fixedProceduralFloors || typeof App.data.progress.fixedProceduralFloors !== 'object') {
            App.data.progress.fixedProceduralFloors = {};
        }
        if (!App.data.progress.fixedProceduralRunIds || typeof App.data.progress.fixedProceduralRunIds !== 'object') {
            App.data.progress.fixedProceduralRunIds = {};
        }
        if (!App.data.progress.abyssSpiritBlessings || typeof App.data.progress.abyssSpiritBlessings !== 'object') {
            App.data.progress.abyssSpiritBlessings = {};
        }

        const currentArea = String(App.data.location.area || 'WORLD');
        const master = globalThis.ABYSS_REGION_MASTER;
        const isAbyssArea = Array.isArray(master?.areaKeys) && master.areaKeys.includes(currentArea);
        // タイトル画面では map.js 読込前にもセーブ移行が走る。
        // 未宣言の STORY_DATA を直接参照せず、読込済みの場合だけ正本を参照する。
        const declaredWorld = globalThis.STORY_DATA?.areas?.[currentArea]?.worldKey;
        App.data.location.worldKey = currentArea === 'ABYSS_WORLD' || declaredWorld === 'ABYSS_WORLD' || isAbyssArea
            ? 'ABYSS_WORLD'
            : 'WORLD';

        Object.keys(App.data.progress.fixedProceduralFloors).forEach(key => {
            if (typeof Dungeon !== 'undefined' && !Dungeon.isValidFixedProceduralFloor(App.data.progress.fixedProceduralFloors[key])) {
                delete App.data.progress.fixedProceduralFloors[key];
            }
        });

        const version = Number(App.data.system.abyssRegionSchemaVersion || 0);
        if (version < 4) {
            const flags = App.data.progress.flags;
            const oldComplete = !!(flags.abyssAzelgaragDefeated || flags.abyssEpilogueSeen || flags.abyssCleared
                || flags.abyssStoryCleared || Number(App.data.dungeon.storyMaxFloor || 0) >= 100);
            if (oldComplete) {
                [
                    'abyssFirstEntered', 'abyssCarmenaGateCleared', 'abyssLeonardDefeated', 'abyssEliciaDefeated',
                    'abyssFirstBarrierCleared', 'abyssSyrisDefeated', 'abyssGradDefeated', 'abyssSecondBarrierCleared',
                    'abyssLegacionNorthGateOpen', 'abyssVeldDefeated', 'abyssJasperDefeated', 'abyssIlluminaciaDefeated',
                    'abyssVegnasisDefeated', 'abyssAzelgaragDefeated', 'abyssEpilogueSeen', 'abyssRandomUnlocked',
                    'abyssDungeonMenuUnlocked'
                ].forEach(flag => { flags[flag] = true; });
                App.data.progress.unlocked.dungeonMenu = true;
                App.data.dungeon.abyssMode = 'random';
            } else if (currentArea === 'ABYSS') {
                flags.abyssFirstEntered = true;
                App.data.location = { area: 'CARMENA', worldKey: 'ABYSS_WORLD', x: 19, y: 25 };
                App.data.progress.floor = 0;
                App.data.dungeon.map = null;
            }
            // 旧追加モジュールの可変階キャッシュは契約が異なるため、安全に再生成する。
            delete App.data.progress.abyssProceduralFloors;
            delete App.data.progress.abyssRegionRunIds;
            App.data.system.abyssRegionSchemaVersion = 4;
        }
        if (version < 5) {
            const flags = App.data.progress.flags;
            // 旧版は前半ダンジョンから後半へ直結していたため、後半ボス到達済みのセーブには
            // 新しい「横断済み」を補完し、世界地図へ戻っても進行を失わないようにする。
            if (flags.abyssLeonardDefeated) flags.abyssThunderDunesCrossed = true;
            if (flags.abyssEliciaDefeated) flags.abyssScreamingCemeteryCrossed = true;
            if (flags.abyssSyrisDefeated) flags.abyssFrozenForestCrossed = true;
            if (flags.abyssGradDefeated) flags.abyssPurgatoryMountainsCrossed = true;

            const safeAbyssWorldPoint = () => {
                if (flags.abyssLegacionNorthGateOpen) return { x: 40, y: 12 };
                if (flags.abyssSecondBarrierCleared || flags.abyssSyrisDefeated || flags.abyssGradDefeated) return { x: 38, y: 16 };
                if (flags.abyssFirstBarrierCleared || flags.abyssLeonardDefeated || flags.abyssEliciaDefeated) return { x: 40, y: 34 };
                return { x: 38, y: 58 };
            };
            const repairAbyssWorldPoint = point => {
                if (!point || String(point.areaKey || point.area || '') !== 'ABYSS_WORLD') return;
                const tiles = globalThis.WORLD_MAPS?.ABYSS_WORLD?.tiles;
                const tile = String(tiles?.[Number(point.y)]?.[Number(point.x)] || 'W').toUpperCase();
                if (!['W', 'M'].includes(tile)) return;
                Object.assign(point, safeAbyssWorldPoint(), { worldKey: 'ABYSS_WORLD' });
            };
            if (currentArea === 'ABYSS_WORLD') {
                const tile = String(globalThis.WORLD_MAPS?.ABYSS_WORLD?.tiles?.[Number(App.data.location.y)]?.[Number(App.data.location.x)] || 'W').toUpperCase();
                if (['W', 'M'].includes(tile)) Object.assign(App.data.location, safeAbyssWorldPoint());
            }
            repairAbyssWorldPoint(App.data.mapReturnPoint);
            repairAbyssWorldPoint(App.data.dungeon.returnPoint);
            if (Array.isArray(App.data.dungeon.returnStack)) App.data.dungeon.returnStack.forEach(repairAbyssWorldPoint);
            App.data.system.abyssRegionSchemaVersion = 5;
        }
        if (version < 6) {
            // v5の深淵世界は、誤った五層地形と旧座標を使用していた。
            // 既知の拠点座標は新しい主大陸・独立区画へ対応づけ、不明な世界座標はカルメナ前へ退避する。
            const abyssWorldPointMigration = new Map([
                ['38,58', { x: 24, y: 58 }],
                ['12,48', { x: 16, y: 51 }],
                ['64,49', { x: 54, y: 53 }],
                ['38,37', { x: 37, y: 40 }],
                ['40,34', { x: 40, y: 37 }],
                ['22,28', { x: 24, y: 31 }],
                ['56,28', { x: 58, y: 32 }],
                ['38,16', { x: 42, y: 21 }],
                ['40,12', { x: 43, y: 19 }],
                ['40,6', { x: 45, y: 12 }],
                ['8,41', { x: 6, y: 44 }],
                ['12,39', { x: 8, y: 40 }],
                ['70,41', { x: 72, y: 54 }],
                ['66,39', { x: 71, y: 48 }],
                ['8,18', { x: 6, y: 27 }],
                ['12,17', { x: 8, y: 24 }],
                ['70,18', { x: 71, y: 28 }],
                ['66,17', { x: 70, y: 24 }]
            ]);
            const migrateAbyssWorldPoint = point => {
                if (!point || String(point.areaKey || point.area || '') !== 'ABYSS_WORLD') return;
                const migrated = abyssWorldPointMigration.get(`${Number(point.x)},${Number(point.y)}`) || { x: 24, y: 58 };
                Object.assign(point, migrated, { worldKey: 'ABYSS_WORLD' });
            };
            if (currentArea === 'ABYSS_WORLD') {
                const migrated = abyssWorldPointMigration.get(`${Number(App.data.location.x)},${Number(App.data.location.y)}`) || { x: 24, y: 58 };
                Object.assign(App.data.location, migrated, { area: 'ABYSS_WORLD', worldKey: 'ABYSS_WORLD' });
            }
            migrateAbyssWorldPoint(App.data.mapReturnPoint);
            migrateAbyssWorldPoint(App.data.dungeon.returnPoint);
            if (Array.isArray(App.data.dungeon.returnStack)) App.data.dungeon.returnStack.forEach(migrateAbyssWorldPoint);
            App.data.system.abyssRegionSchemaVersion = 6;
        }
        if (version < 7) {
            // v6の楕円状地形から、ビスタ・レガシオンを正式な関門とする作図済み地形へ移行する。
            const v6AnchorMigration = new Map([
                ['6,46', { x: 6, y: 44 }],
                ['8,43', { x: 8, y: 40 }],
                ['71,53', { x: 72, y: 54 }],
                ['69,49', { x: 71, y: 48 }]
            ]);
            const repairConceptWorldPoint = point => {
                if (!point || String(point.areaKey || point.area || '') !== 'ABYSS_WORLD') return;
                const migrated = v6AnchorMigration.get(`${Number(point.x)},${Number(point.y)}`);
                if (migrated) Object.assign(point, migrated, { worldKey: 'ABYSS_WORLD' });
                const tile = String(globalThis.WORLD_MAPS?.ABYSS_WORLD?.tiles?.[Number(point.y)]?.[Number(point.x)] || 'W').toUpperCase();
                if (['W', 'M'].includes(tile)) Object.assign(point, { x: 24, y: 58, worldKey: 'ABYSS_WORLD' });
            };
            if (currentArea === 'ABYSS_WORLD') {
                const migrated = v6AnchorMigration.get(`${Number(App.data.location.x)},${Number(App.data.location.y)}`);
                if (migrated) Object.assign(App.data.location, migrated);
                const tile = String(globalThis.WORLD_MAPS?.ABYSS_WORLD?.tiles?.[Number(App.data.location.y)]?.[Number(App.data.location.x)] || 'W').toUpperCase();
                if (['W', 'M'].includes(tile)) Object.assign(App.data.location, { x: 24, y: 58 });
            }
            repairConceptWorldPoint(App.data.mapReturnPoint);
            repairConceptWorldPoint(App.data.dungeon.returnPoint);
            if (Array.isArray(App.data.dungeon.returnStack)) App.data.dungeon.returnStack.forEach(repairConceptWorldPoint);
            App.data.system.abyssRegionSchemaVersion = 7;
        }
        if (typeof App.reconcileDerivedProgressFlags === 'function') App.reconcileDerivedProgressFlags();
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
            if (typeof App.migrateMonsterIdReferences === 'function') App.migrateMonsterIdReferences();
            if (typeof App.ensureSettings === 'function') App.ensureSettings();
            
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
            App.migrateAbyssRegionSave();
        } 
    } catch(e) { console.error(e); } 
},

	
    saveJsonReplacer: function(key, value) {
        // Character画像の旧互換キーが同じData URLを指す場合、保存時だけ重複を除く。
        // 読込側は img/image のどちらにも対応しているため、既存セーブ互換性は維持される。
        if (key === 'image' && typeof value === 'string' && this && this.img === value) return undefined;
        return value;
    },

    serializeSaveData: (data) => JSON.stringify(data, App.saveJsonReplacer),

    save: () => {
        if (!App.data) return false;
        let saved = false;
        try {
            if (Field.ready) {
                App.data.location.x = Field.x;
                App.data.location.y = Field.y;
            }

            if (!App.data.stats) App.data.stats = { maxGold: 0, maxGems: 0 };
            if (App.data.gold > (App.data.stats.maxGold || 0)) App.data.stats.maxGold = App.data.gold;
            if (App.data.gems > (App.data.stats.maxGems || 0)) App.data.stats.maxGems = App.data.gems;

            localStorage.setItem(CONST.SAVE_KEY, App.serializeSaveData(App.data));
            App.saveFailureNotified = false;
            App.lastSaveError = null;
            saved = true;
        } catch (e) {
            App.lastSaveError = e;
            console.error('[SAVE] セーブデータを保存できませんでした。', e);
            if (!App.saveFailureNotified) {
                App.saveFailureNotified = true;
                App.showMessage(
                    'セーブデータを保存できませんでした。\nブラウザの保存領域が不足している可能性があります。ゲームを閉じる前に「セーブデータ出力」でバックアップしてください。'
                );
            }
        }

        if (typeof App.updateHUD === 'function') App.updateHUD();
        return saved;
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
        App.ensureSettings();
        if (!App.data.progress) App.data.progress = {};
        if (!App.data.progress.flags || typeof App.data.progress.flags !== 'object' || Array.isArray(App.data.progress.flags)) App.data.progress.flags = {};
        App.data.progress.flags.hasShip = false;
        if (!App.data.progress.unlocked || typeof App.data.progress.unlocked !== 'object' || Array.isArray(App.data.progress.unlocked)) App.data.progress.unlocked = {};
        App.data.progress.unlocked.boat = false;
        App.data.transportMode = null;
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

    ensureAbyssRegionProgress: () => {
        if (!App.data.progress) App.data.progress = {};
        if (!App.data.progress.abyssSpiritBlessings || typeof App.data.progress.abyssSpiritBlessings !== 'object') {
            App.data.progress.abyssSpiritBlessings = {};
        }
        return App.data.progress;
    },

    getEnvironmentalElementModifiers: (char) => {
        const master = globalThis.ABYSS_REGION_MASTER;
        const result = {};
        const elements = Array.isArray(master?.elements) ? master.elements : (CONST.ELEMENTS || []);
        elements.forEach(element => { result[element] = 0; });
        if (!master) return result;

        const currentArea = typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function'
            ? Field.getCurrentAreaKey()
            : App.data?.location?.area;
        const flags = App.data?.progress?.flags || {};
        if (currentArea === 'CARMENA' && !flags.abyssCarmenaGateCleared
            && !master.protectedCarmenaCharacterIds.includes(Number(char?.charId))) {
            elements.forEach(element => { result[element] -= 100; });
        }

        const mapPenalty = (typeof Field !== 'undefined' ? Field.currentMapData?.elementPenalty : null)
            || (typeof FIXED_DUNGEON_MAPS !== 'undefined' ? FIXED_DUNGEON_MAPS[currentArea]?.elementPenalty : null)
            || null;
        if (mapPenalty) Object.entries(mapPenalty).forEach(([element, value]) => {
            result[element] = (result[element] || 0) + Number(value || 0);
        });

        const battleActive = globalThis.Battle?.active === true;
        const spiritElement = battleActive ? App.data?.battle?.abyssSpiritElement : null;
        if (spiritElement) result[spiritElement] = (result[spiritElement] || 0) - 50;

        const blessings = App.ensureAbyssRegionProgress().abyssSpiritBlessings;
        Object.keys(blessings).filter(element => blessings[element]).forEach(element => {
            result[element] = (result[element] || 0) + 20;
        });
        if (battleActive && App.data?.battle?.abyssSpiritFinalBlessing) {
            Object.keys(blessings).filter(element => blessings[element]).forEach(element => {
                result[element] = (result[element] || 0) + 30;
            });
        }
        return result;
    },

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
	const seenEquipObjects = new WeakSet();
	// ★新規追加：集約用スキルSet
    const allSkillIds = new Set(char.skills || []);

	if (char.equips) {
		for (const [slotKey, eq] of Object.entries(char.equips)) {
			if (!eq || !eq.data) continue;
			// 旧互換キーが同じ装備オブジェクトを指す場合だけ確実に除外する。
			// 別オブジェクトとして所持する同型武器は、二刀流で両方加算するため除外しない。
			if (typeof eq === 'object') {
				if (seenEquipObjects.has(eq)) continue;
				seenEquipObjects.add(eq);
			}

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
		if (eq.data.hp)   s.maxHp += eq.data.hp;
		if (eq.data.mp)   s.maxMp += eq.data.mp;
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
		if (PassiveSkill && typeof PassiveSkill.normalizeDisabledTraits === 'function') {
			PassiveSkill.normalizeDisabledTraits(entity);
		}

		// 1. 本人が習得している特性 (disabledTraitsによるOFF設定を反映)
		const learned = entity.traits ? entity.traits.find(t => Number(t.id) === Number(traitId)) : null;
		if (learned && !(entity.disabledTraits && entity.disabledTraits.includes(traitId))) {
			totalLevel += (learned.level || 1);
		}

		// 2. 装備品に付いている特性 (常にON)
		if (entity.equips) {
			PassiveSkill.getUniqueEquips(entity).forEach(eq => {
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
				if (!other) return;
				const otherCurrentHp = Number(other.currentHp ?? other.hp ?? 0);
				if (otherCurrentHp <= 0) return; // 戦闘不能者の隊列オーラは無効

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

    // 地域・戦闘環境の補正は最終値へ一度だけ合成し、表示用の内訳も同じ計算結果から渡す。
    const environmentalModifiers = App.getEnvironmentalElementModifiers(char);
    s.environmentalElmRes = {};
    Object.entries(environmentalModifiers).forEach(([element, value]) => {
        if (!Number(value)) return;
        s.elmRes[element] = (s.elmRes[element] || 0) + Number(value);
        s.environmentalElmRes[element] = Number(value);
    });

    return s;
},

    /**
     * 1レベル分の成長を適用する共通処理。
     * 通常の経験値レベルアップと、ストーリー加入時の内部レベルアップで同じ成長式を使う。
     */
    applyLevelUpGrowth: (charData, options = {}) => {
        if (!charData) return [];
        if (!charData.level) charData.level = 1;
        if (charData.level >= 100) return [];

        const silent = options.silent === true;
        const logs = [];

        // 転生回数による補正倍率の計算
        const reincMult = 1 + (charData.reincarnationCount || 0);

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
        const applyGrowthBonus = (keys, mult, label, bonusOptions = {}) => {
            keys.forEach(key => {
                if (key === 'hp') incHp = Math.max(1, Math.floor(incHp * mult));
                if (key === 'mp') incMp = Math.max(1, Math.floor(incMp * mult));
                if (key === 'atk') incAtk = Math.max(1, Math.floor(incAtk * mult));
                if (key === 'def') incDef = Math.max(1, Math.floor(incDef * mult));
                if (key === 'mdef') incMdef = Math.max(1, Math.floor(incMdef * mult));
                if (key === 'spd') incSpd = Math.max(1, Math.floor(incSpd * mult));
                if (key === 'mag') incMag = Math.max(1, Math.floor(incMag * mult));
            });
            if (!silent && bonusOptions.log !== false && label) {
                growthBonusLogs.push(`${label} x${mult.toFixed(1)} (${keys.join(', ')})`);
            }
        };

        if (charData.level === 50 || charData.level === 100) {
            applyGrowthBonus(['hp', 'mp', 'atk', 'def', 'mdef', 'spd', 'mag'], 5 + Math.random(), '', { log: false }); //50レベル・100レベル成長ボーナス（倍率は非表示）
        } else if (Math.random() < 0.12) {
            const keys = ['hp', 'mp', 'atk', 'def', 'mdef', 'spd', 'mag'].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.25 ? 2 : 1);
            applyGrowthBonus(keys, 2 + Math.random(), '', { log: false }); //ひらめき成長
        }

        const bonusRand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
        incHp += bonusRand(2, 4);
        incMp += bonusRand(2, 4);
        incAtk += bonusRand(0, 2);
        incDef += bonusRand(0, 2);
        incMdef += bonusRand(0, 2);
        incSpd += bonusRand(0, 2);
        incMag += bonusRand(0, 2);

        // ステータス加算
        charData.hp = (charData.hp || 0) + incHp;
        charData.mp = (charData.mp || 0) + incMp;
        charData.atk = (charData.atk || 0) + incAtk;
        charData.def = (charData.def || 0) + incDef;
        charData.mdef = (charData.mdef || 0) + incMdef;
        charData.spd = (charData.spd || 0) + incSpd;
        charData.mag = (charData.mag || 0) + incMag;

        // SP加算
        if (charData.sp === undefined) charData.sp = 0;
        charData.sp++;

        // HP/MP全回復
        const stats = App.calcStats(charData);
        charData.currentHp = stats.maxHp;
        charData.currentMp = stats.maxMp;

        // --- ログの追加（順序を制御） ---
        if (!silent) {
            // 1. レベルアップ通知
            logs.push(`<span style="color:#00ff00; font-weight:bold;"><br>${charData.name}は レベル ${charData.level} に上がった！</span>`);

            // 2. ステータス上昇値（全項目）
            logs.push(`<span style="font-size:0.9em;">最大HP+${incHp} 最大MP+${incMp} <br>攻撃+${incAtk} 防御+${incDef} 魔力+${incMag} 魔防+${incMdef} 速さ+${incSpd} </span>`);
            if (growthBonusLogs.length > 0) {
                logs.push(`<span style="color:#ffdd66;">${growthBonusLogs.join(' / ')}</span>`);
            }
        }

        // 3. スキル習得
        const newSkill = App.isMonsterAlly(charData) ? null : App.checkNewSkill(charData);
        if (newSkill) {
            if(!charData.skills) charData.skills = [];
            if(!charData.skills.includes(newSkill.id)) {
                charData.skills.push(newSkill.id);
                if (!silent) logs.push(`<span style="color:#ffff00;">${newSkill.name} を覚えた！</span>`);
            }
        }

        // 4. 特性習得
        if (typeof PassiveSkill !== 'undefined' && PassiveSkill.applyLevelUpTraits) {
            const traitLog = PassiveSkill.applyLevelUpTraits(charData);
            if (traitLog && !silent) {
                logs.push(traitLog);
            }
        }

        return logs;
    },

    /**
     * レベルアップ処理
     */
    gainExp: (charData, expGain) => {
        if (!charData.exp) charData.exp = 0;
        charData.exp += expGain;
        let logs = [];

        // レベル上限100
        while (charData.level < 100) {
            // App.getNextExp 内で「大器晩成」の exp_need_mult が計算されている前提
            const nextExp = App.getNextExp(charData);
            if (charData.exp >= nextExp) {
                charData.exp -= nextExp;
                logs.push(...App.applyLevelUpGrowth(charData));
            } else { break; }
        }
        App.save();
        return logs;
    },

    getCurrentAbyssEquipOptionElements: () => {
        const mapData = (typeof Field !== 'undefined') ? Field.currentMapData : null;
        const mapId = String(mapData?.mapId || '');
        const abyssDungeonMapIds = new Set([
            'MAP000038', 'MAP000039', 'MAP000040', 'MAP000041',
            'MAP000043', 'MAP000044', 'MAP000045', 'MAP000046',
            'MAP000048', 'MAP000049', 'MAP000050'
        ]);
        if (!mapData?.isDungeon || !abyssDungeonMapIds.has(mapId)) return [];
        return Object.entries(mapData.elementPenalty || {})
            .filter(([, value]) => Number(value) < 0)
            .map(([element]) => String(element));
    },

    pickEquipOptionRule: (allowedKeys) => {
        let candidates = DB.OPT_RULES.filter(rule => allowedKeys.includes(rule.key));
        if (candidates.length === 0) candidates = DB.OPT_RULES.slice();

        // 深淵の属性ダンジョンでは、その攻略属性の攻撃・耐性オプションを3倍重みで抽選する。
        // 取得装備そのものへ通常オプションとして記録し、戦闘時の後付け補正にはしない。
        const preferredElements = new Set(App.getCurrentAbyssEquipOptionElements());
        const weighted = [];
        candidates.forEach(rule => {
            const isPreferredElement = preferredElements.has(String(rule.elm || ''))
                && (rule.key === 'elmAtk' || rule.key === 'elmRes');
            const weight = isPreferredElement ? 3 : 1;
            for (let i = 0; i < weight; i++) weighted.push(rule);
        });
        return weighted[Math.floor(Math.random() * weighted.length)];
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
            source: source || 'drop',
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
				const rule = App.pickEquipOptionRule(allowedKeys);
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
				const rule = App.pickEquipOptionRule(allowedKeys);
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
        if(e) {
            if (App._fieldToastTimer) clearTimeout(App._fieldToastTimer);
            e.innerHTML = msg;
            e.classList.remove('is-visible');
            void e.offsetWidth;
            e.classList.add('is-visible');
            App._fieldToastTimer = setTimeout(() => {
                e.classList.remove('is-visible');
            }, 2000);
        }
        console.log(`[App] ${msg}`);
    },

    resetFieldLog: () => {
        const e = document.getElementById('msg-text');
        if (e) {
            e.innerHTML = '';
            e.classList.remove('is-visible');
        }
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

    getSkillBookItemId: (skillId) => {
        const id = Math.floor(Number(skillId));
        if (!Number.isFinite(id) || id < 100) return null;
        return Number(window.PRISMA_SKILL_BOOK_ITEM_BASE || 600000) + id;
    },

    getSkillBookSkill: (itemOrId) => {
        const item = (itemOrId && typeof itemOrId === 'object')
            ? itemOrId
            : (typeof DB !== 'undefined' ? DB.ITEMS.find(entry => Number(entry.id) === Number(itemOrId)) : null);
        const skillId = Math.floor(Number(item?.skillId));
        if (!Number.isFinite(skillId) || skillId < 100) return null;
        return typeof DB !== 'undefined' ? DB.SKILLS.find(skill => Number(skill.id) === skillId) || null : null;
    },

    getSkillBookCapacity: (character) => App.isMonsterAlly(character) ? 8 : 2,

    getSkillBookReplacementIds: (character) => {
        if (!character) return [];
        const unique = values => Array.from(new Set((Array.isArray(values) ? values : [])
            .map(Number).filter(id => Number.isFinite(id) && id >= 100)));
        return App.isMonsterAlly(character)
            ? unique(character.skills)
            : unique(character.skillBookSkills).filter(id => Array.isArray(character.skills) && character.skills.map(Number).includes(id));
    },

    learnSkillFromBook: (characterOrUid, skillId, replaceSkillId = null, options = {}) => {
        const character = typeof characterOrUid === 'string' ? App.getChar(characterOrUid) : characterOrUid;
        const id = Math.floor(Number(skillId));
        const skill = typeof DB !== 'undefined' ? DB.SKILLS.find(entry => Number(entry.id) === id) : null;
        if (!character || !skill || id < 100) return { ok: false, reason: 'invalid', message: 'スキルデータを確認できません。' };

        const uniqueSkills = values => Array.from(new Set((Array.isArray(values) ? values : [])
            .map(Number).filter(value => Number.isFinite(value) && value > 0)));
        const uniqueBookSkills = values => uniqueSkills(values).filter(value => value >= 100);
        character.skills = uniqueSkills(character.skills);
        if (character.skills.includes(id)) {
            return { ok: false, reason: 'known', message: `${character.name}はすでに${skill.name}を覚えている。` };
        }

        const isMonster = App.isMonsterAlly(character);
        const capacity = App.getSkillBookCapacity(character);
        const tracked = isMonster ? character.skills.filter(value => value >= 100) : uniqueBookSkills(character.skillBookSkills);
        const replacement = replaceSkillId == null ? null : Math.floor(Number(replaceSkillId));
        if (tracked.length >= capacity) {
            if (!Number.isFinite(replacement) || !tracked.includes(replacement)) {
                return { ok: false, reason: 'needsReplacement', replacementIds: tracked.slice(), capacity };
            }
            character.skills = character.skills.filter(value => Number(value) !== replacement);
            if (!isMonster) character.skillBookSkills = tracked.filter(value => value !== replacement);
        }

        character.skills.push(id);
        character.skills = uniqueSkills(character.skills);
        if (Number.isFinite(replacement)) App.remapCharacterSkillConfig(character, replacement, id);
        if (isMonster) character.skills = character.skills.slice(0, 8);
        if (!isMonster) {
            character.skillBookSkills = uniqueBookSkills([...(character.skillBookSkills || []), id]).slice(-2);
        } else {
            character.skillBookSkills = [];
        }
        App.ensureCharacterBattleConfig?.(character);
        if (options.save !== false) App.save();
        return { ok: true, skill, replacedSkillId: replacement, character };
    },

    monsterSkillEvolutionChains: Object.freeze([
        // 物理系：名称・用途が明確に連続するものだけを成長対象にする。
        Object.freeze([102, 132]),                    // はやぶさ斬り → 超はやぶさ斬り
        Object.freeze([112, 151]),                    // 魔人斬り → 大魔人斬り
        Object.freeze([117, 144]),                    // やいばくだき → 真やいばくだき
        Object.freeze([125, 147]),                    // キラージャグリング → ゴッドジャグリング
        Object.freeze([131, 154]),                    // タイガークロー → ライガークラッシュ

        // 属性呪文系。
        Object.freeze([200, 207, 213, 224, 233]),     // メラ系
        Object.freeze([201, 210, 217, 221, 235]),     // ヒャド系
        Object.freeze([202, 211, 215, 222, 236]),     // バギ系
        Object.freeze([203, 208, 214, 225, 234]),     // ドルマ系
        Object.freeze([204, 209, 216, 223]),          // ギラ系
        Object.freeze([205, 212, 218, 227, 232]),     // イオ系
        Object.freeze([206, 226, 237]),               // デイン系
        Object.freeze([219, 231]),                    // メテオ系

        // ブレス・回復・状態異常系。
        Object.freeze([300, 302, 306, 310]),          // 炎ブレス系
        Object.freeze([301, 305, 307, 309]),          // 氷ブレス系
        Object.freeze([303, 313, 314]),               // 闇ブレス系
        Object.freeze([400, 401, 412, 417]),          // 単体回復系
        Object.freeze([404, 413, 418]),               // 全体回復系
        Object.freeze([407, 414, 419]),               // 蘇生系
        Object.freeze([600, 602]),                    // 守備低下系
        Object.freeze([700, 702]),                    // 毒息系
        Object.freeze([701, 711, 712, 714]),          // 咆哮系
        Object.freeze([706, 708, 709]),               // 即死呪文系
        Object.freeze([707, 710])                     // 死の踊り系
    ]),

    getMonsterSkillEvolution: (skillId) => {
        const currentId = Math.floor(Number(skillId));
        if (!Number.isFinite(currentId) || currentId < 100 || typeof DB === 'undefined') return null;
        const chain = App.monsterSkillEvolutionChains.find(ids => ids.includes(currentId));
        if (!chain) return null;
        const index = chain.indexOf(currentId);
        if (index < 0 || index >= chain.length - 1) return null;
        const current = DB.SKILLS.find(skill => Number(skill.id) === currentId);
        const next = DB.SKILLS.find(skill => Number(skill.id) === Number(chain[index + 1]));
        if (!current || !next) return null;
        // データ編集で系統が崩れた場合は誤変化させない。
        if (String(current.type || '') !== String(next.type || '')) return null;
        if (String(current.elm || '無') !== String(next.elm || '無')) return null;
        return next;
    },

    getMonsterFusionPreview: (primaryUid, materialUid, selectedSkillIds = null) => {
        const primary = App.getChar(primaryUid);
        const material = App.getChar(materialUid);
        if (!primary || !material || primary.uid === material.uid || !App.isMonsterAlly(primary) || !App.isMonsterAlly(material)) {
            return { ok: false, message: '合成する仲間モンスターを確認できません。' };
        }
        const allSkills = Array.from(new Set([...(primary.skills || []), ...(material.skills || [])]
            .map(Number).filter(id => Number.isFinite(id) && id >= 100)));
        let skills = allSkills.length <= 8
            ? allSkills.slice()
            : (Array.isArray(selectedSkillIds)
                ? Array.from(new Set(selectedSkillIds.map(Number).filter(id => allSkills.includes(id))))
                : []);
        if (skills.length > 8) skills = skills.slice(0, 8);
        const stats = {};
        ['hp', 'mp', 'atk', 'def', 'mag', 'mdef', 'spd'].forEach(key => {
            const minimum = key === 'mp' ? 0 : 1;
            stats[key] = Math.max(minimum, Math.floor((Number(primary[key] || 0) + Number(material[key] || 0)) / 4));
        });
        return { ok: true, primary, material, allSkills, skills, stats, requiresSkillSelection: allSkills.length > 8 };
    },

    fuseMonsterAllies: (primaryUid, materialUid, selectedSkillIds = null) => {
        const preview = App.getMonsterFusionPreview(primaryUid, materialUid, selectedSkillIds);
        if (!preview.ok) return preview;
        if (preview.requiresSkillSelection && (!Array.isArray(selectedSkillIds) || preview.skills.length !== 8)) {
            return { ...preview, ok: false, reason: 'needsSkillSelection', message: '引き継ぐスキルを8個選んでください。' };
        }
        const potId = Number(window.PRISMA_SYNTHESIS_POT_ITEM_ID || 599999);
        if (Number(App.data?.items?.[potId] || 0) <= 0) return { ok: false, reason: 'noPot', message: '合成の壺を持っていません。' };

        const { primary, material, skills, stats } = preview;
        const returnedEquipment = Array.from(new Set(Object.values(material.equips || {}).filter(Boolean)));
        if (!Array.isArray(App.data.inventory)) App.data.inventory = [];
        returnedEquipment.forEach(equip => App.data.inventory.push(equip));

        const retainedSkillSet = new Set(skills.map(Number));
        const oldConfig = (primary.config && typeof primary.config === 'object') ? primary.config : {};
        Object.assign(primary, stats, {
            level: 1,
            exp: 0,
            sp: 0,
            currentHp: stats.hp,
            currentMp: stats.mp,
            skills: skills.slice(0, 8),
            skillBookSkills: [],
            limitBreak: 0,
            lbProgress: {
                counters: { battleWins: 0 },
                sources: { story: 0, battle: 0, dungeon: 0, quest: 0, boss: 0, prism: 0, random: 0, gacha: 0, monster: 0, trial: 0, item: 0, legacy: 0 },
                trials: { mid: false, final: false, midClearedAt: null, finalClearedAt: null }
            },
            reincarnationCount: 0,
            growthBase: { ...stats },
            config: {
                ...oldConfig,
                hiddenSkills: (oldConfig.hiddenSkills || []).map(Number).filter(id => retainedSkillSet.has(id)),
                autoDisabledSkills: (oldConfig.autoDisabledSkills || []).map(Number).filter(id => retainedSkillSet.has(id))
            },
            monsterFusionCount: Math.max(0, Number(primary.monsterFusionCount || 0)) + 1
        });
        primary.monsterAllyMeta = {
            ...(primary.monsterAllyMeta || {}),
            fusedAt: Date.now(),
            absorbedMonsterId: material.monsterId || material.sourceMonsterId || null,
            absorbedName: material.name || ''
        };
        App.data.characters = (App.data.characters || []).filter(character => character && character.uid !== material.uid);
        if (Array.isArray(App.data.party)) {
            App.data.party = App.data.party.map(uid => uid === material.uid ? null : uid);
        }
        App.data.items[potId]--;
        if (App.data.items[potId] <= 0) delete App.data.items[potId];
        App.ensureCharacterBattleConfig?.(primary);
        App.save();
        return {
            ok: true,
            character: primary,
            consumedUid: material.uid,
            returnedEquipmentCount: returnedEquipment.length,
            message: `${primary.name}は新たな力を得てレベル1になった！`
        };
    },

    getLifetimeStatDefaults: () => ({
        totalSteps: 0, totalBattles: 0, totalChestsOpened: 0, totalMedals: 0,
        totalQuestCompletions: 0, totalGuildQuestCompletions: 0,
        totalAlchemyCrafts: 0, totalAlchemyItemsCrafted: 0,
        totalBlacksmithActions: 0, blacksmithSynthesisCount: 0,
        blacksmithRefineAttempts: 0, blacksmithRefineSuccesses: 0,
        blacksmithEnhanceAttempts: 0, blacksmithEnhanceSuccesses: 0
    }),

    ensureLifetimeStats: (data = App.data) => {
        if (!data) return null;
        if (!data.stats || typeof data.stats !== 'object' || Array.isArray(data.stats)) data.stats = {};
        Object.entries(App.getLifetimeStatDefaults()).forEach(([key, fallback]) => {
            const value = Number(data.stats[key]);
            data.stats[key] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
        });
        return data.stats;
    },

    incrementLifetimeStat: (key, amount = 1, options = {}) => {
        const stats = App.ensureLifetimeStats();
        if (!stats || !(key in App.getLifetimeStatDefaults())) return 0;
        stats[key] = Math.max(0, Number(stats[key] || 0) + Number(amount || 0));
        if (options.save !== false && typeof App.save === 'function') App.save();
        return stats[key];
    },

    getAbyssLegacyProgressFloor: (data = App.data) => {
        const dungeon = data?.dungeon || {};
        const storyFloor = Math.max(0, Number(dungeon.storyMaxFloor || 0));
        const randomFloor = Math.max(0, Number(dungeon.maxFloor || 0));
        return Math.max(storyFloor, randomFloor > 0 ? randomFloor + 100 : 0);
    },

    getNormalQuestCompletionCount: (data = App.data) => {
        const quests = data?.progress?.quests || {};
        const derived = Object.values(quests).filter(entry => entry?.state === 'completed').length;
        return Math.max(derived, Number(data?.stats?.totalQuestCompletions || 0));
    },

    getGuildQuestCompletionCount: (data = App.data) => {
        const guild = data?.progress?.guild || {};
        const staticTotal = Object.values(guild.completionCounts || {}).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
        const generated = Math.max(0, Number(guild.generatedCompletionTotal || 0));
        return Math.max(staticTotal + generated, Number(data?.stats?.totalGuildQuestCompletions || 0));
    },

    migrateAbyssFloorSchemaData: (data) => {
        if (!data || typeof data !== 'object') return data;
        data.system = data.system && typeof data.system === 'object' ? data.system : {};
        data.progress = data.progress && typeof data.progress === 'object' ? data.progress : {};
        data.progress.flags = data.progress.flags && typeof data.progress.flags === 'object' ? data.progress.flags : {};
        data.dungeon = data.dungeon && typeof data.dungeon === 'object' ? data.dungeon : {};
        const targetVersion = Number(globalThis.ABYSS_FLOOR_RULES?.SCHEMA_VERSION || 2);
        const fromVersion = Number(data.system.abyssFloorSchemaVersion || 1);
        if (fromVersion >= targetVersion) {
            data.dungeon.storyMaxFloor = Math.max(0, Number(data.dungeon.storyMaxFloor || 0));
            data.dungeon.maxFloor = Math.max(0, Number(data.dungeon.maxFloor || 0));
            data.dungeon.storyTryCount = Math.max(0, Number(data.dungeon.storyTryCount || 0));
            data.dungeon.randomTryCount = Math.max(0, Number(data.dungeon.randomTryCount || 0));
            data.dungeon.abyssMode = globalThis.ABYSS_FLOOR_RULES?.normalizeMode(data.dungeon.abyssMode, data.progress.flags.abyssRandomUnlocked ? 'random' : 'story') || 'story';
            return data;
        }

        const legacyMax = Math.max(0, Math.floor(Number(data.dungeon.maxFloor || 0)));
        const legacyTryCount = Math.max(0, Math.floor(Number(data.dungeon.tryCount || 0)));
        data.dungeon.storyMaxFloor = Math.min(100, legacyMax);
        data.dungeon.maxFloor = Math.max(0, legacyMax - 100);
        data.dungeon.storyTryCount = legacyMax <= 100 ? legacyTryCount : 0;
        data.dungeon.randomTryCount = 0;
        // 旧仕様では物語・ランダムの挑戦回数を分けていなかったため、101階以降へ到達済みの履歴は推測せず未分類として保持する。
        data.dungeon.legacyUnclassifiedAbyssTryCount = legacyMax > 100 ? legacyTryCount : 0;
        if (data.progress.flags.abyssFloor100EpilogueCleared || legacyMax > 100) data.progress.flags.abyssRandomUnlocked = true;

        const inAbyss = data.location?.area === 'ABYSS';
        const activeLegacyFloor = Math.max(1, Number(data.progress.floor || 1));
        const activeRandom = inAbyss && activeLegacyFloor >= 101;
        data.dungeon.abyssMode = activeRandom ? 'random' : 'story';
        const convertFloor = value => {
            const floor = Number(value);
            return Number.isFinite(floor) && floor >= 101 ? Math.max(1, Math.floor(floor) - 100) : value;
        };
        if (activeRandom) data.progress.floor = convertFloor(data.progress.floor);
        ['abyssBossEncounter','adventurer','healSpring','abyssRift','trialAngel','keyGuardian'].forEach(key => {
            const obj = data.dungeon[key];
            if (!obj || typeof obj !== 'object') return;
            if (activeRandom) {
                if ('floor' in obj) obj.floor = convertFloor(obj.floor);
                if ('targetFloor' in obj) obj.targetFloor = convertFloor(obj.targetFloor);
                if (key === 'abyssBossEncounter') {
                    obj.displayFloor = convertFloor(obj.displayFloor ?? obj.floor);
                    obj.floor = obj.displayFloor;
                    obj.mode = 'random';
                    obj.balanceFloor = Math.max(101, Number(obj.balanceFloor || (Number(obj.displayFloor || 1) + 100)));
                }
            }
        });
        ['keyChests','floorKeys'].forEach(key => {
            if (activeRandom && Array.isArray(data.dungeon[key])) data.dungeon[key].forEach(entry => { if (entry && 'floor' in entry) entry.floor = convertFloor(entry.floor); });
        });
        if (activeRandom && data.dungeon.visitedMap && typeof data.dungeon.visitedMap === 'object' && 'floor' in data.dungeon.visitedMap) {
            data.dungeon.visitedMap.floor = convertFloor(data.dungeon.visitedMap.floor);
        }
        if (activeRandom && data.dungeon.visualThemeAudit && typeof data.dungeon.visualThemeAudit === 'object' && 'floor' in data.dungeon.visualThemeAudit) {
            data.dungeon.visualThemeAudit.floor = convertFloor(data.dungeon.visualThemeAudit.floor);
        }

        // 旧形式の乱数状態キー（ABYSS:F101）を、モードを含む新形式
        // （ABYSS:random:F1 / ABYSS:story:F1）へ全件移行する。
        if (data.dungeon.randomKeys && typeof data.dungeon.randomKeys === 'object' && !Array.isArray(data.dungeon.randomKeys)) {
            const migratedRandomKeys = {};
            const mergeKeyState = (current, incoming) => {
                if (!current) return incoming;
                if (!incoming || typeof incoming !== 'object') return current;
                const merged = { ...current, ...incoming };
                const order = [
                    ...(Array.isArray(current._order) ? current._order : []),
                    ...(Array.isArray(incoming._order) ? incoming._order : [])
                ];
                if (order.length > 0) merged._order = Array.from(new Set(order));
                return merged;
            };
            Object.entries(data.dungeon.randomKeys).forEach(([scope, state]) => {
                const match = /^ABYSS:F(\d+)$/.exec(String(scope));
                let targetScope = scope;
                if (match) {
                    const legacyFloor = Math.max(1, Number(match[1]) || 1);
                    const mode = legacyFloor >= 101 ? 'random' : 'story';
                    const displayFloor = mode === 'random' ? legacyFloor - 100 : legacyFloor;
                    targetScope = `ABYSS:${mode}:F${displayFloor}`;
                }
                migratedRandomKeys[targetScope] = mergeKeyState(migratedRandomKeys[targetScope], state);
            });
            data.dungeon.randomKeys = migratedRandomKeys;
        }

        // 戦闘中セーブも、表示階層だけを新仕様へ移し、生成済み個体の能力・報酬階層は維持する。
        const battle = data.battle && typeof data.battle === 'object' ? data.battle : null;
        if (battle && inAbyss) {
            battle.abyssMode = activeRandom ? 'random' : 'story';
            const legacyBattleFloor = Math.max(1, Number(battle.abyssFloor || activeLegacyFloor || 1));
            battle.abyssFloor = activeRandom ? convertFloor(legacyBattleFloor) : legacyBattleFloor;
            battle.abyssBalanceFloor = activeRandom
                ? Math.max(101, Number(battle.abyssBalanceFloor || legacyBattleFloor))
                : Math.max(1, Number(battle.abyssBalanceFloor || battle.abyssFloor));
            if (battle.abyssBossEncounter && typeof battle.abyssBossEncounter === 'object') {
                const encounter = battle.abyssBossEncounter;
                const legacyEncounterFloor = Math.max(1, Number(encounter.displayFloor ?? encounter.floor ?? legacyBattleFloor));
                encounter.displayFloor = activeRandom ? convertFloor(legacyEncounterFloor) : legacyEncounterFloor;
                encounter.floor = encounter.displayFloor;
                encounter.mode = battle.abyssMode;
                encounter.balanceFloor = activeRandom
                    ? Math.max(101, Number(encounter.balanceFloor || legacyEncounterFloor))
                    : Math.max(1, Number(encounter.balanceFloor || encounter.displayFloor));
            }
            if (battle.abyssBossPosition && typeof battle.abyssBossPosition === 'object' && 'floor' in battle.abyssBossPosition) {
                battle.abyssBossPosition.floor = activeRandom ? convertFloor(battle.abyssBossPosition.floor) : battle.abyssBossPosition.floor;
            }
            if (activeRandom && 'riftDisplayFloor' in battle) battle.riftDisplayFloor = convertFloor(battle.riftDisplayFloor);
        }
        // 旧ランダム深淵で生成済みの地形・宝箱・特殊イベントは、旧表示階層がそのまま
        // 新しいバランス階層に相当するため保持する。表示用の階層値だけを上で移行する。
        data.system.abyssFloorSchemaVersion = targetVersion;
        return data;
    },

    migrateImportedSaveData: (loadedData) => {
        if (!loadedData || typeof loadedData !== 'object' || Array.isArray(loadedData)) return loadedData;

        const data = loadedData;

        if (data.characters && Array.isArray(data.characters)) {
            data.characters.forEach(char => {
                if (!char || typeof char !== 'object') return;
                if (char.mdef === undefined || char.mdef === null) {
                    char.mdef = Math.floor((char.mag || 0) * 0.8);
                }
                if (typeof App.ensureLimitBreakProgress === 'function') {
                    App.ensureLimitBreakProgress(char);
                }
                const uniqueCharacterSkills = values => Array.from(new Set((Array.isArray(values) ? values : [])
                    .map(Number).filter(id => Number.isFinite(id) && id > 0)));
                const uniqueBookSkills = values => uniqueCharacterSkills(values).filter(id => id >= 100);
                if (char.isMonsterAlly === true) {
                    char.skills = uniqueCharacterSkills(char.skills).filter(id => id >= 100).slice(0, 8);
                    char.skillBookSkills = [];
                    char.reincarnationCount = 0;
                } else {
                    char.skills = uniqueCharacterSkills(char.skills);
                    char.skillBookSkills = uniqueBookSkills(char.skillBookSkills)
                        .filter(id => char.skills.includes(id)).slice(0, 2);
                }
            });
        }

        if (!data.book || typeof data.book !== 'object' || Array.isArray(data.book)) data.book = { monsters: [] };
        if (!Array.isArray(data.book.monsters)) data.book.monsters = [];
        if (!data.book.killCounts || typeof data.book.killCounts !== 'object' || Array.isArray(data.book.killCounts)) data.book.killCounts = {};

        if (!data.battle || typeof data.battle !== 'object' || Array.isArray(data.battle)) data.battle = { active: false };

        if (!data.stats || typeof data.stats !== 'object' || Array.isArray(data.stats)) {
            data.stats = {
                maxGold: data.gold || 0,
                maxGems: data.gems || 0,
                wipeoutCount: 0,
                totalSteps: 0,
                totalBattles: 0,
                maxDamage: { val: 0, actor: '', actorLv: null, skill: '', time: null },
                startTime: Date.now()
            };
        }
        if (!data.stats.maxDamage || typeof data.stats.maxDamage !== 'object') {
            data.stats.maxDamage = { val: 0, actor: '', actorLv: null, skill: '', time: null };
        }
        if (typeof data.stats.maxGold !== 'number') data.stats.maxGold = data.gold || 0;
        if (typeof data.stats.maxGems !== 'number') data.stats.maxGems = data.gems || 0;
        if (typeof data.stats.wipeoutCount !== 'number') data.stats.wipeoutCount = 0;
        if (typeof data.stats.totalSteps !== 'number') data.stats.totalSteps = 0;
        if (typeof data.stats.totalBattles !== 'number') data.stats.totalBattles = 0;
        if (typeof data.stats.startTime !== 'number') data.stats.startTime = Date.now();
        App.ensureLifetimeStats(data);
        data.stats.totalQuestCompletions = Math.max(Number(data.stats.totalQuestCompletions || 0), Object.values(data.progress?.quests || {}).filter(entry => entry?.state === 'completed').length);
        data.stats.totalGuildQuestCompletions = Math.max(Number(data.stats.totalGuildQuestCompletions || 0), App.getGuildQuestCompletionCount(data));

        if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) data.settings = {};
        if (!['normal', 'fast', 'fastest'].includes(data.settings.battleSpeed)) data.settings.battleSpeed = 'normal';
        data.settings.battleAutoStart = data.settings.battleAutoStart === true;
        const clampAudioSetting = (value, fallback) => Math.max(0, Math.min(100, Math.round(Number(value ?? fallback) || 0)));
        const legacyBgmVolume = clampAudioSetting(data.settings.bgmVolume, 30);
        const legacySeVolume = clampAudioSetting(data.settings.seVolume, 5);
        data.settings.fieldBgmVolume = clampAudioSetting(data.settings.fieldBgmVolume, legacyBgmVolume);
        data.settings.battleBgmVolume = clampAudioSetting(data.settings.battleBgmVolume, legacyBgmVolume);
        data.settings.uiSeVolume = clampAudioSetting(data.settings.uiSeVolume, legacySeVolume);
        data.settings.battleSeVolume = clampAudioSetting(data.settings.battleSeVolume, legacySeVolume);
        data.settings.fieldSeVolume = clampAudioSetting(data.settings.fieldSeVolume, legacySeVolume);
        data.settings.bgmVolume = data.settings.fieldBgmVolume;
        data.settings.seVolume = data.settings.uiSeVolume;

        App.migrateAbyssFloorSchemaData(data);
        return data;
    },

    isImportableSaveData: (loadedData) => {
        return !!(
            loadedData &&
            typeof loadedData === 'object' &&
            !Array.isArray(loadedData) &&
            loadedData.gold !== undefined &&
            Array.isArray(loadedData.party) &&
            Array.isArray(loadedData.characters)
        );
    },

    downloadSave: async () => {
        if (!App.data) {
            if(typeof Menu !== 'undefined') Menu.msg("セーブデータがありません");
            else App.showMessage("セーブデータがありません");
            return;
        }
        if (typeof SaveCrypto === 'undefined' || typeof SaveCrypto.encodeSaveData !== 'function') {
            App.showMessage("暗号化セーブ機能を読み込めませんでした");
            return;
        }

        try {
            const encryptedText = await SaveCrypto.encodeSaveData(App.data);
            const blob = new Blob([encryptedText], {type: "application/octet-stream"});
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = (typeof SaveCrypto.buildFileName === 'function')
                ? SaveCrypto.buildFileName()
                : `rpg_save_${Date.now()}.rpgsave`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            App.showMessage(err && err.message ? err.message : "セーブデータの出力に失敗しました");
        }
    },

    importSave: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.rpgsave,.json,application/json,application/octet-stream';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    let loadedData;
                    let isLegacy = false;

                    if (typeof SaveCrypto !== 'undefined' && typeof SaveCrypto.decodeSaveText === 'function') {
                        const decoded = await SaveCrypto.decodeSaveText(event.target.result);
                        loadedData = decoded.data;
                        isLegacy = decoded.legacy === true;
                    } else {
                        // save_crypto.js が読めない場合でも、過去のJSONバックアップだけは復元できるようにする。
                        loadedData = JSON.parse(String(event.target.result || '').replace(/^\uFEFF/, '').trim());
                        isLegacy = true;
                    }

                    if (App.isImportableSaveData(loadedData)) {
                        const migratedData = App.migrateImportedSaveData(JSON.parse(JSON.stringify(loadedData)));
                        const suffix = isLegacy ? "\n\n旧形式のバックアップは、読み込み時に現在の形式へ補正されます。" : "";
                        if (await App.showConfirm(`現在のデータを上書きして復元しますか？\n(ページがリロードされます)${suffix}`)) {
                            localStorage.setItem(CONST.SAVE_KEY, JSON.stringify(migratedData));
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

	runAfterScenePaint: (callback) => {
		const run = () => {
			try { callback(); } catch (e) { console.error(e); }
		};
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => requestAnimationFrame(run));
		} else {
			setTimeout(run, 0);
		}
	},

	playEncounterTransition: (callback, options = {}) => {
        let layer = document.getElementById('encounter-transition');
        const isEventBattle = !!options.eventBattle;
        const patterns = isEventBattle ? ['shatter', 'shutter'] : ['shatter', 'spiral', 'shutter'];
        const pattern = options.pattern || patterns[Math.floor(Math.random() * patterns.length)];

        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'encounter-transition';
            layer.setAttribute('aria-hidden', 'true');
            (document.getElementById('game-container') || document.body).appendChild(layer);
        }
        layer.innerHTML = `
            <div class="encounter-backdrop"></div>
            <div class="encounter-vignette"></div>
            <div class="encounter-ring ring-a"></div>
            <div class="encounter-ring ring-b"></div>
            <div class="encounter-crack-network">
                ${Array.from({ length: isEventBattle ? 12 : 8 }, (_, i) => `<i class="encounter-crack-branch branch-${i + 1}"></i>`).join('')}
            </div>
            <div class="encounter-shutter shutter-top"></div>
            <div class="encounter-shutter shutter-bottom"></div>
            <div class="encounter-flash-core"></div>
            <div class="encounter-shards"></div>
        `;
        const shardLayer = layer.querySelector('.encounter-shards');
        const shardCount = isEventBattle ? 22 : 14;
        for (let i = 0; i < shardCount; i++) {
            const shard = document.createElement('i');
            shard.className = 'encounter-shard';
            shard.style.setProperty('--angle', `${(360 / shardCount) * i + (Math.random() * 18 - 9)}deg`);
            shard.style.setProperty('--distance', `${40 + Math.random() * 58}vmax`);
            shard.style.setProperty('--delay', `${Math.random() * 90}ms`);
            shard.style.setProperty('--size', `${22 + Math.random() * 56}px`);
            shardLayer.appendChild(shard);
        }

        layer.className = `encounter-pattern-${pattern}${isEventBattle ? ' is-event-battle' : ''}`;
        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('encounter_start');
        void layer.offsetWidth;
        layer.classList.add('is-active');

        const switchDelay = isEventBattle ? 760 : 610;
        const releaseDelay = isEventBattle ? 460 : 340;
        setTimeout(() => {
            callback();
            setTimeout(() => layer.classList.remove('is-active'), releaseDelay);
        }, switchDelay);
    },

    isWorldEncounterLandTile: (tile) => {
        const upper = String(tile || '').toUpperCase();
        return upper && upper !== 'W' && upper !== 'M';
    },

    isWorldEncounterConnected: (fromX, fromY, toX, toY, maxSteps = 80) => {
        const worldMap = (typeof MapRegistry !== 'undefined' && MapRegistry.getActiveWorldMap)
            ? MapRegistry.getActiveWorldMap()
            : (typeof SURFACE_WORLD_MAP_DATA !== 'undefined' ? SURFACE_WORLD_MAP_DATA : null);
        if (!Array.isArray(worldMap) || !worldMap[0]) return true;
        const mapH = worldMap.length;
        const mapW = worldMap[0].length;
        const sx = ((Number(fromX) % mapW) + mapW) % mapW;
        const sy = ((Number(fromY) % mapH) + mapH) % mapH;
        const tx = ((Number(toX) % mapW) + mapW) % mapW;
        const ty = ((Number(toY) % mapH) + mapH) % mapH;
        if (sx === tx && sy === ty) return true;
        if (!App.isWorldEncounterLandTile(worldMap[sy]?.[sx])) return false;
        if (!App.isWorldEncounterLandTile(worldMap[ty]?.[tx])) return false;

        const limit = Math.max(1, Number(maxSteps || 80));
        const queue = [{ x: sx, y: sy, d: 0 }];
        const seen = new Set([`${sx},${sy}`]);
        for (let qi = 0; qi < queue.length; qi++) {
            const p = queue[qi];
            if (p.d >= limit) continue;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = ((p.x + dx) % mapW + mapW) % mapW;
                const ny = ((p.y + dy) % mapH + mapH) % mapH;
                const key = `${nx},${ny}`;
                if (seen.has(key)) continue;
                if (!App.isWorldEncounterLandTile(worldMap[ny]?.[nx])) continue;
                if (nx === tx && ny === ty) return true;
                seen.add(key);
                queue.push({ x: nx, y: ny, d: p.d + 1 });
            }
        }
        return false;
    },


    migrateMonsterIdReferences: () => {
        if (!App.data || !globalThis.MonsterData?.migrateId) return false;
        const currentVersion = Number(globalThis.MonsterData.idSchemaVersion || 4);
        const fromVersion = Number(App.data.system?.monsterIdSchemaVersion || 2);
        const migrate = (value) => {
            const id = globalThis.MonsterData.migrateId(value, fromVersion);
            return id === null ? value : id;
        };
        const singularKeys = new Set([
            'monsterId', 'fixedBossId', 'chestTrapMonsterId', 'displayMonsterId',
            'targetMonsterId', 'bossMonsterId', 'guardianMonsterId', 'trialMonsterId',
            'trapMonsterId', 'mapSpriteMonsterId', 'sourceMonsterId', 'absorbedMonsterId'
        ]);
        const arrayKeys = new Set([
            'monsters', 'monsterIds', 'fixedEnemyIds', 'normalMonsterIds', 'rareMonsterIds',
            'bossMonsterIds', 'targetMonsterIds', 'candidateMonsterIds'
        ]);
        const keyedIdMaps = new Set(['killCounts', 'defeatedBosses']);
        let changed = fromVersion !== currentVersion;
        const walk = (value, parentKey = '') => {
            if (Array.isArray(value)) {
                if (arrayKeys.has(parentKey)) {
                    const mapped = value.map((entry) => {
                        if (Number.isFinite(Number(entry))) {
                            const next = migrate(entry);
                            if (Number(next) !== Number(entry)) changed = true;
                            return next;
                        }
                        return walk(entry, parentKey);
                    });
                    return Array.from(new Set(mapped));
                }
                return value.map((entry) => walk(entry, parentKey));
            }
            if (!value || typeof value !== 'object') return value;
            if (keyedIdMaps.has(parentKey)) {
                const remapped = {};
                Object.entries(value).forEach(([key, entryValue]) => {
                    const numeric = Number(key);
                    const nextKey = Number.isFinite(numeric) ? String(migrate(numeric)) : key;
                    if (nextKey !== key) changed = true;
                    if (parentKey === 'killCounts') {
                        remapped[nextKey] = Number(remapped[nextKey] || 0) + Number(entryValue || 0);
                    } else if (!(nextKey in remapped)) {
                        remapped[nextKey] = entryValue;
                    } else {
                        remapped[nextKey] = remapped[nextKey] || entryValue;
                    }
                });
                return remapped;
            }
            Object.keys(value).forEach((key) => {
                const current = value[key];
                if (singularKeys.has(key) && Number.isFinite(Number(current))) {
                    const next = migrate(current);
                    if (Number(next) !== Number(current)) changed = true;
                    value[key] = next;
                } else if (['enemies', 'monsters'].includes(parentKey) && ['id', 'baseId', 'imageId'].includes(key) && Number.isFinite(Number(current))) {
                    const next = migrate(current);
                    if (Number(next) !== Number(current)) changed = true;
                    value[key] = next;
                } else {
                    value[key] = walk(current, key);
                }
            });
            return value;
        };
        App.data = walk(App.data, 'root');
        App.data.system = (App.data.system && typeof App.data.system === 'object') ? App.data.system : {};
        App.data.system.monsterIdSchemaVersion = currentVersion;
        return changed;
    },

    getWorldEncounterProfile: () => {
        if (typeof Field === 'undefined' || Field.currentMapData) return null;
        if (typeof App.isFlying === 'function' && App.isFlying()) return null;
        const surface = typeof MapRegistry !== 'undefined' && MapRegistry.getWorldSurfaceAt
            ? MapRegistry.getWorldSurfaceAt(Field.x, Field.y)
            : null;
        if (surface?.isSea) return null;
        const activeWorldKey = (typeof MapRegistry !== 'undefined' && MapRegistry.getActiveWorldKey)
            ? MapRegistry.getActiveWorldKey()
            : 'WORLD';
        const zones = (typeof window !== 'undefined' && Array.isArray(window.FIELD_ENCOUNTER_ZONES))
            ? window.FIELD_ENCOUNTER_ZONES.filter(zone => String(zone.worldKey || 'WORLD') === activeWorldKey)
            : [];
        if (zones.length === 0) return null;
        const x = Number(Field.x || 0);
        const y = Number(Field.y || 0);
        const matches = zones.filter(zone => {
            if (zone.rect) {
                return x >= Number(zone.rect.x1) && x <= Number(zone.rect.x2) && y >= Number(zone.rect.y1) && y <= Number(zone.rect.y2);
            }
            const dx = x - Number(zone.centerX || 0);
            const dy = y - Number(zone.centerY || 0);
            const radius = Number(zone.radius || 0);
            if (!(radius > 0 && Math.sqrt(dx * dx + dy * dy) <= radius)) return false;
            return App.isWorldEncounterConnected(x, y, zone.centerX, zone.centerY, Math.ceil(radius * 4) + 20);
        });
        const candidates = matches.length > 0
            ? matches
            : zones.filter(zone => App.isWorldEncounterConnected(x, y, zone.centerX, zone.centerY, Math.ceil(Number(zone.radius || 0) * 4) + 20));
        let best = null;
        let bestScore = Infinity;
        candidates.forEach(zone => {
            const dx = x - Number(zone.centerX || 0);
            const dy = y - Number(zone.centerY || 0);
            const distance = Math.sqrt(dx * dx + dy * dy);
            const score = distance - (Number(zone.priority || 0) * 8);
            if (score < bestScore) {
                best = zone;
                bestScore = score;
            }
        });
        if (!best) return null;
        return {
            id: best.id || null,
            mapId: best.mapId || null,
            name: best.name || 'フィールド',
            rank: Math.max(1, Number(best.rank || best.encounterRank || 1) || 1),
            monsters: null
        };
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
        const worldSurface = !Field.currentMapData && typeof MapRegistry !== 'undefined' && MapRegistry.getWorldSurfaceAt
            ? MapRegistry.getWorldSurfaceAt(Field.x, Field.y)
            : null;
		const isSeaEncounter = !Field.currentMapData && (worldSurface
            ? worldSurface.isSea
            : (typeof App.getWorldTileAt === 'function' && App.getWorldTileAt(Field.x, Field.y) === 'W'));
        const worldEncounter = isSeaEncounter ? null : App.getWorldEncounterProfile();
        const mapEncounter = Field.currentMapData?.isDungeon ? Field.currentMapData : null;

		App.data.battle = {
			active: false,
			isBossBattle: false,
			isSpecialBoss: false,
			isEstark: false,
			fixedBossId: null,
			enemies: [],
			encounterType: isSeaEncounter ? 'sea' : (worldEncounter ? 'field' : null),
            encounterZoneId: worldEncounter ? worldEncounter.id : null,
            encounterZoneName: worldEncounter ? worldEncounter.name : null,
            encounterMapId: mapEncounter?.mapId || (isSeaEncounter ? window.MAP_IDS?.SEA : worldEncounter?.mapId) || null,
            encounterFloorId: mapEncounter?.floorId || null,
            encounterFloor: Math.max(0, Number(mapEncounter?.floor || 0) || 0),
            abyssFloor: mapEncounter?.mapId === window.MAP_IDS?.ABYSS && mapEncounter?.useHabitatEncounters ? Math.max(1, Number(App.data.progress?.floor || 1)) : null,
            abyssMode: mapEncounter?.abyssMode || null,
            abyssBalanceFloor: mapEncounter?.balanceFloor || null,
            useHabitatEncounters: !!(mapEncounter?.useHabitatEncounters || isSeaEncounter || worldEncounter?.mapId),
            encounterRank: mapEncounter?.encounterRank || (worldEncounter ? worldEncounter.rank : null),
			monsters: mapEncounter?.isGuildQuestDungeon && Array.isArray(mapEncounter.monsters) ? [...mapEncounter.monsters] : null,
            guildQuestChallengeId: mapEncounter?.guildQuestId || null,
            guildChallengeEnemyBoost: mapEncounter?.enemyBoost ? JSON.parse(JSON.stringify(mapEncounter.enemyBoost)) : null,
            guildChallengeAllyAilments: Array.isArray(mapEncounter?.allyAilments) ? [...mapEncounter.allyAilments] : [],
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
        if (sceneId === 'battle' && typeof Field !== 'undefined') {
            if (Field.minimapTapTimer) {
                clearTimeout(Field.minimapTapTimer);
                Field.minimapTapTimer = null;
            }
            if (typeof Field.closeMapModal === 'function') Field.closeMapModal();
        }
        if (sceneId === 'battle' && typeof StoryManager !== 'undefined' &&
            typeof StoryManager.prepareBattleTransitionUI === 'function') {
            StoryManager.prepareBattleTransitionUI();
        }

        // フィールド以外の画面へ移る時は、待機中の足踏みタイマーを止める。
        // 足踏みは描画だけの軽量演出だが、戦闘/施設/メニュー裏で動かし続ける必要はない。
        if (sceneId !== 'field' && typeof Field !== 'undefined' && typeof Field.stopIdleStep === 'function') {
            Field.stopIdleStep();
        }

        document.querySelectorAll('.scene-layer').forEach(e => {
            e.style.display = 'none';
            e.style.visibility = '';
        });
        const target = document.getElementById(sceneId + '-scene');
        // フィールドはレイアウト寸法を確保したまま不可視で構築する。
        // 表示後にPhaserを再構築すると、最短でも1フレームだけ空の静的層が露出するため。
        if(target) {
            target.style.display = 'flex';
            if (sceneId === 'field') target.style.visibility = 'hidden';
        }
        
        if(typeof Menu !== 'undefined') Menu.closeAll();
        App.clearAction();
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.syncForScene === 'function') {
            AudioManager.syncForScene(sceneId);
        }

        if(sceneId === 'field') {
            Field.init();

            if (typeof PhaserFieldRenderer !== 'undefined' && typeof PhaserFieldRenderer.setActive === 'function') {
                PhaserFieldRenderer.setActive(true);
            }
            if (typeof Field.refreshVisualState === 'function') Field.refreshVisualState();
            if (target) target.style.visibility = '';

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

		
        if(sceneId === 'battle' && typeof Battle !== 'undefined') {
            const sceneToken = (App.sceneChangeToken = (App.sceneChangeToken || 0) + 1);
            const startBattleAfterPaint = () => {
                const battleScene = document.getElementById('battle-scene');
                if (App.sceneChangeToken !== sceneToken) return;
                if (!battleScene || battleScene.style.display === 'none') return;
                Battle.init();
            };
            if (typeof App.runAfterScenePaint === 'function') App.runAfterScenePaint(startBattleAfterPaint);
            else setTimeout(startBattleAfterPaint, 0);
        } else {
            App.sceneChangeToken = (App.sceneChangeToken || 0) + 1;
        }
        if(sceneId === 'inn') Facilities.initInn();
        if(sceneId === 'medal') Facilities.initMedal();
        if(sceneId === 'casino') Casino.init();
        if(sceneId === 'shop') Facilities.initShop();
        if(sceneId === 'alchemy' && typeof Alchemy !== 'undefined') Alchemy.init();
        if(sceneId === 'blacksmith' && typeof MenuBlacksmith !== 'undefined' && typeof MenuBlacksmith.initFacility === 'function') MenuBlacksmith.initFacility();
        if(sceneId === 'guild' && typeof Guild !== 'undefined' && typeof Guild.initFacility === 'function') Guild.initFacility();
    }
};

/* main.js 内の Field オブジェクト全文 */

const Field = {
    x: 23, y: 28, 
    dir: 3, // 向き (0:下, 1:左, 2:右, 3:上)
    step: 1, // 歩行アニメ用 (1 または 2)
    ready: false, currentMapData: null,
    infoCollapsed: false,
    minimapMode: 'normal',
    minimapTapTimer: null,
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

    // Fixed and generated maps share one rectangular tile contract. Saved procedural
    // floors from older builds can contain sparse rows, so every renderer/movement
    // path reads through this accessor instead of indexing a row blindly.
    getMapTileAt: (mapData, x, y, fallback = 'W') => {
        const tx = Number(x);
        const ty = Number(y);
        if (!mapData || !Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || ty < 0) return fallback;
        const row = Array.isArray(mapData.tiles) ? mapData.tiles[ty] : null;
        let tile;
        if (typeof row === 'string') tile = row.charAt(tx);
        else if (Array.isArray(row)) tile = row[tx];
        return tile === undefined || tile === null || tile === '' ? fallback : tile;
    },

    // マップ遷移・会話完了・遅延画像読込後に、背景とオブジェクトを含む静的層を即時再構築する。
    // 通常の render() だけではPhaserが同一署名と判断し、主人公しか更新しない場合がある。
    refreshVisualState: () => {
        if (typeof PhaserFieldRenderer !== 'undefined' && typeof PhaserFieldRenderer.refresh === 'function') {
            PhaserFieldRenderer.refresh();
            return;
        } else if (typeof PhaserFieldRenderer !== 'undefined' && typeof PhaserFieldRenderer.setActive === 'function') {
            PhaserFieldRenderer.setActive(false);
        }
        if (typeof Field.render === 'function') Field.render();
    },

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

    syncCanvasToWrapperSize: () => {
        const canvas = document.getElementById('field-canvas');
        const wrapper = document.getElementById('canvas-wrapper');
        if (!canvas || !wrapper || !wrapper.getBoundingClientRect) return false;
        const rect = wrapper.getBoundingClientRect();
        const width = Math.max(320, Math.round(rect.width || wrapper.clientWidth || 0));
        const height = Math.max(320, Math.round(rect.height || wrapper.clientHeight || 0));
        if (!width || !height) return false;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            if (typeof Field.updateMinimapHotspotBounds === 'function') {
                window.requestAnimationFrame(() => Field.updateMinimapHotspotBounds());
            }
            return true;
        }
        return false;
    },

    bindViewportResizeObserver: () => {
        if (Field._viewportResizeObserverBound) return;
        const wrapper = document.getElementById('canvas-wrapper');
        if (!wrapper || !window.ResizeObserver) return;
        Field._viewportResizeObserverBound = true;
        let scheduled = false;
        Field._viewportResizeObserver = new ResizeObserver(() => {
            if (scheduled) return;
            scheduled = true;
            window.requestAnimationFrame(() => {
                scheduled = false;
                const resized = typeof Field.syncCanvasToWrapperSize === 'function'
                    ? Field.syncCanvasToWrapperSize()
                    : false;
                if (typeof PhaserFieldRenderer !== 'undefined' && typeof PhaserFieldRenderer.resize === 'function') {
                    PhaserFieldRenderer.resize();
                }
                if (resized && Field.ready && typeof Field.render === 'function') {
                    Field.render();
                }
            });
        });
        Field._viewportResizeObserver.observe(wrapper);
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
                Field.currentMapData = {
                    ...FIXED_MAPS[areaKey],
                    isFixed: true,
                    isDungeon: FIXED_MAPS[areaKey].isDungeon === true,
                    areaKey
                };
            }
            else if (areaKey === 'ABYSS') {
                if (App.data.dungeon && App.data.dungeon.map) {
                    // App.start()後にField.init()が再度走る経路でも、ランダムダンジョンの
                    // 外観テーマ・戦闘背景・検証フラグを欠落させない。ここで旧形式の
                    // mapDataを組み直すと、直前に復元したテーマを深淵表示で上書きしてしまう。
                    if (typeof Dungeon !== 'undefined') {
                        Dungeon.floor = App.data.progress.floor;
                        Dungeon.map = App.data.dungeon.map;
                        Dungeon.width = App.data.dungeon.width;
                        Dungeon.height = App.data.dungeon.height;
                        Field.currentMapData = Dungeon.createRandomFieldMapData();
                    }
                } else {
                    // 深淵セーブで生成済みマップが欠落していても、現在地をワールドへ
                    // 書き換えない。起動シーケンス側の Dungeon.loadFloor() に再生成を任せる。
                    if (typeof Dungeon !== 'undefined') Dungeon.floor = App.data.progress.floor || 1;
                    Field.currentMapData = null;
                }
            } else {
                Field.currentMapData = null; // ワールドマップ
            }

            // 座標の復元
            Field.x = App.data.location.x;
            Field.y = App.data.location.y;

            if (!Field.currentMapData) {
                const worldMap = Field.getActiveWorldMap();
                const mapW = worldMap?.[0]?.length || 100;
                const mapH = worldMap?.length || 100;
                Field.x = (Field.x % mapW + mapW) % mapW;
                Field.y = (Field.y % mapH + mapH) % mapH;
            }
        }

        Field.ready = true;
        if (typeof Field.bindViewportResizeObserver === 'function') Field.bindViewportResizeObserver();
        if (typeof Field.syncCanvasToWrapperSize === 'function') Field.syncCanvasToWrapperSize();
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

    enterFixedMap: (targetAreaKey, options = {}) => {
        if (!targetAreaKey || typeof FIXED_MAPS === 'undefined' || !FIXED_MAPS[targetAreaKey]) return;
        if (targetAreaKey === 'ABYSS_FIELD' && !App.data?.progress?.flags?.darkCastleCleared) {
            App.log('属性が不均質に混ざり合っている…');
            if (typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                StoryManager.executeEvent('locked_abyss_field');
            } else if (typeof App.showMessage === 'function') {
                App.showMessage('ケイト「魔力汚染がひどすぎます…入ったら、正気ではいられない。\n入る方法を探すしかなさそうです」');
            }
            return;
        }
        const areaDef = FIXED_MAPS[targetAreaKey];
        App.data.mapReturnPoint = options.returnPoint || {
            areaKey: App.data.location.area || 'WORLD',
            worldKey: App.data.location.worldKey || (MapRegistry?.getActiveWorldKey?.() || 'WORLD'),
            x: Field.x,
            y: Field.y,
            mapData: Field.currentMapData ? JSON.parse(JSON.stringify(Field.currentMapData)) : null
        };
        App.data.transportMode = null;
        App.data.location.area = targetAreaKey;
        App.data.location.worldKey = STORY_DATA?.areas?.[targetAreaKey]?.worldKey
            || (targetAreaKey === 'ABYSS_WORLD' ? 'ABYSS_WORLD' : (App.data.mapReturnPoint?.worldKey || 'WORLD'));
        Field.currentMapData = {
            ...areaDef,
            isFixed: true,
            isDungeon: areaDef.isDungeon === true,
            areaKey: targetAreaKey
        };
        const requestedEntry = options.entryKey && areaDef.entryPoints ? areaDef.entryPoints[options.entryKey] : null;
        const entryPoint = requestedEntry || areaDef.entryPoint || { x: Math.floor(areaDef.width / 2), y: areaDef.height - 3 };
        Field.x = Number(entryPoint.x);
        Field.y = Number(entryPoint.y);
        App.data.location.x = Field.x;
        App.data.location.y = Field.y;
        if (typeof App.discoverFixedMap === 'function') App.discoverFixedMap(targetAreaKey, { save: false });
        if (App.data.location.worldKey === 'ABYSS_WORLD' && typeof App.discoverFixedMap === 'function') {
            App.discoverFixedMap('ABYSS_WORLD', { save: false, silent: true });
        }
        App.log(`${areaDef.name}に入った`);
        App.save();
        App.changeScene('field');
    },

    getCurrentAreaKey: () => {
        if (!Field.currentMapData) return MapRegistry?.getActiveWorldKey?.() || App.data?.location?.worldKey || 'WORLD';
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

    getActiveWorldMap: () => {
        return (typeof MapRegistry !== 'undefined' && MapRegistry.getActiveWorldMap)
            ? MapRegistry.getActiveWorldMap()
            : (typeof SURFACE_WORLD_MAP_DATA !== 'undefined' ? SURFACE_WORLD_MAP_DATA : []);
    },

    getCurrentProgressMapKey: () => {
        const areaKey = Field.getCurrentAreaKey();
        if (Field.currentMapData?.isFixed && Field.currentMapData?.isDungeon && typeof MapRegistry !== 'undefined' && MapRegistry.getFixedDungeonProgressKey) {
            return MapRegistry.getFixedDungeonProgressKey(areaKey, App.data?.progress?.floor || Field.currentMapData.floor || 1);
        }
        return areaKey;
    },

    getCurrentMapChangeKey: (areaKey = null) => {
        const key = areaKey || Field.getCurrentAreaKey();
        if (Field.currentMapData?.isFixed && Field.getCurrentProgressMapKey) return Field.getCurrentProgressMapKey();
        return key;
    },

    toggleInfoPanel: (event = null) => {
        if (event && event.stopPropagation) event.stopPropagation();
        Field.infoCollapsed = !Field.infoCollapsed;
        Field.updateFieldHudState();
    },

    handleMinimapTap: (event = null) => {
        if (event && event.stopPropagation) event.stopPropagation();
        if (Field.minimapMode === 'minimized') return;

        if (Field.minimapTapTimer) {
            clearTimeout(Field.minimapTapTimer);
            Field.minimapTapTimer = null;
            Field.minimizeMap();
            return;
        }

        Field.minimapTapTimer = setTimeout(() => {
            Field.minimapTapTimer = null;
            Field.openMapModal();
        }, 260);
    },

    minimizeMap: () => {
        Field.minimapMode = 'minimized';
        Field.updateFieldHudState();
        Field.render();
    },

    restoreMinimap: (event = null) => {
        if (event && event.stopPropagation) event.stopPropagation();
        Field.minimapMode = 'normal';
        Field.updateFieldHudState();
        Field.render();
    },

    updateFieldHudState: () => {
        const info = document.getElementById('field-info-box');
        if (info) info.classList.toggle('is-collapsed', !!Field.infoCollapsed);
        const wrapper = document.getElementById('canvas-wrapper');
        if (wrapper) wrapper.classList.toggle('is-minimap-minimized', Field.minimapMode === 'minimized');
        if (typeof Field.updateMinimapHotspotBounds === 'function') Field.updateMinimapHotspotBounds();
    },

    updateMinimapHotspotBounds: () => {
        const canvas = document.getElementById('field-canvas');
        const phaserRoot = document.getElementById('phaser-field-root');
        const wrapper = document.getElementById('canvas-wrapper');
        const hotspot = document.getElementById('field-minimap-hotspot');
        const minimapCanvas = document.getElementById('field-minimap-canvas');
        const restore = document.getElementById('field-minimap-restore');
        if (!canvas || !wrapper || !hotspot) return;

        const wrapperRect = wrapper.getBoundingClientRect();
        const mmSize = 80;
        const margin = 10;
        const rootRect = phaserRoot?.getBoundingClientRect();
        const phaserActive = wrapper.classList.contains('phaser-field-active')
            && rootRect
            && rootRect.width > 0
            && rootRect.height > 0;

        let left;
        let top;
        let width;
        let height;
        let hudLeft;

        if (phaserActive) {
            const rootLeft = rootRect.left - wrapperRect.left;
            const rootTop = rootRect.top - wrapperRect.top;
            left = rootLeft + rootRect.width - mmSize - margin;
            top = rootTop + margin;
            width = mmSize;
            height = mmSize;
            hudLeft = rootLeft + margin;
        } else {
            const canvasRect = canvas.getBoundingClientRect();
            if (!canvasRect.width || !canvasRect.height || !canvas.width || !canvas.height) return;
            const mmX = canvas.width - mmSize - margin;
            const scaleX = canvasRect.width / canvas.width;
            const scaleY = canvasRect.height / canvas.height;
            const canvasLeft = canvasRect.left - wrapperRect.left;
            const canvasTop = canvasRect.top - wrapperRect.top;
            left = canvasLeft + (mmX * scaleX);
            top = canvasTop + (margin * scaleY);
            width = mmSize * scaleX;
            height = mmSize * scaleY;
            hudLeft = canvasLeft + (margin * scaleX);
        }

        const hudGap = 8;
        const infoMaxWidth = Math.max(120, left - hudLeft - hudGap);
        wrapper.style.setProperty('--field-hud-top', `${top}px`);
        wrapper.style.setProperty('--field-hud-left', `${hudLeft}px`);
        wrapper.style.setProperty('--field-hud-gap', `${hudGap}px`);
        wrapper.style.setProperty('--field-minimap-left', `${left}px`);
        wrapper.style.setProperty('--field-minimap-width', `${width}px`);
        wrapper.style.setProperty('--field-info-max-width', `${infoMaxWidth}px`);

        Object.assign(hotspot.style, {
            left: `${left}px`,
            top: `${top}px`,
            right: 'auto',
            width: `${width}px`,
            height: `${height}px`
        });

        if (minimapCanvas) {
            Object.assign(minimapCanvas.style, {
                left: `${left}px`,
                top: `${top}px`,
                right: 'auto',
                width: `${width}px`,
                height: `${height}px`
            });
        }

        if (restore) {
            Object.assign(restore.style, {
                left: `${left}px`,
                top: `${top}px`,
                right: 'auto'
            });
        }
    },

    openMapModal: () => {
        Field.closeMapModal();
        const overlay = document.createElement('div');
        overlay.id = 'field-map-modal';
        overlay.className = 'field-map-modal';
        overlay.onclick = () => Field.closeMapModal();
        overlay.innerHTML = `
            <div class="field-map-modal-window" onclick="event.stopPropagation()">
                <div class="field-map-modal-header">
                    <span>MAP</span>
                    <button class="btn" onclick="Field.closeMapModal()">閉じる</button>
                </div>
                <canvas id="field-map-modal-canvas" width="360" height="360"></canvas>
            </div>
        `;
        const container = document.getElementById('canvas-wrapper') || document.getElementById('game-container') || document.body;
        container.appendChild(overlay);
        Field.drawFullMap(document.getElementById('field-map-modal-canvas'));
    },

    closeMapModal: () => {
        const overlay = document.getElementById('field-map-modal');
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    },

    getFullMapLayout: (canvas, mapWidth, mapHeight, padding = 10) => {
        const canvasWidth = Math.max(1, Number(canvas?.width || 1));
        const canvasHeight = Math.max(1, Number(canvas?.height || 1));
        const mapW = Math.max(1, Number(mapWidth || 1));
        const mapH = Math.max(1, Number(mapHeight || 1));
        const safePadding = Math.max(0, Math.min(Number(padding || 0), Math.floor(Math.min(canvasWidth, canvasHeight) / 4)));
        const availableWidth = Math.max(1, canvasWidth - safePadding * 2);
        const availableHeight = Math.max(1, canvasHeight - safePadding * 2);
        // 横長・縦長のどちらでも全行全列が収まる小さい方の倍率を採用する。
        const size = Math.min(availableWidth / mapW, availableHeight / mapH);
        return {
            size,
            offsetX: (canvasWidth - mapW * size) / 2,
            offsetY: (canvasHeight - mapH * size) / 2,
            mapWidth: mapW,
            mapHeight: mapH
        };
    },

    drawFullMap: (canvas) => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const tileRows = Field.currentMapData?.tiles || Field.getActiveWorldMap();
        const actualMapHeight = Array.isArray(tileRows) ? tileRows.length : 0;
        const actualMapWidth = Array.isArray(tileRows)
            ? tileRows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : String(row || '').length), 0)
            : 0;
        // 実タイル配列を寸法の正本とする。保存メタデータは配列が未設定の場合だけの後方互換用。
        const mapW = Math.max(1, actualMapWidth || Number(Field.currentMapData?.width || 0));
        const mapH = Math.max(1, actualMapHeight || Number(Field.currentMapData?.height || 0));
        const layout = Field.getFullMapLayout(canvas, mapW, mapH, 10);
        const { size, offsetX, offsetY } = layout;
        const areaKey = Field.getCurrentAreaKey();

        ctx.fillStyle = '#090502';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const revealLimitedRandomMap = !!(Field.currentMapData?.isDungeon && !Field.currentMapData?.isFixed
            && typeof Dungeon !== 'undefined'
            && typeof Dungeon.isMazeFloor === 'function'
            && Dungeon.isMazeFloor());
        const revealLimitedFixedMap = !!(Field.currentMapData?.isDungeon && Field.currentMapData?.isFixed
            && typeof Dungeon !== 'undefined'
            && typeof Dungeon.isFixedRevealLimitedFloor === 'function'
            && Dungeon.isFixedRevealLimitedFloor(Field.currentMapData));

        for (let y = 0; y < mapH; y++) {
            for (let x = 0; x < mapW; x++) {
                let tile = Field.getRenderedTileForDraw(x, y, mapW, mapH, areaKey);
                if (revealLimitedRandomMap) {
                    if (typeof Dungeon.isVisited === 'function' && !Dungeon.isVisited(x, y) && !(Math.abs(x - Field.x) <= 4 && Math.abs(y - Field.y) <= 4)) {
                        tile = 'W';
                    }
                }
                if (revealLimitedFixedMap) {
                    const visibleNow = Math.abs(x - Field.x) <= Number(Field.currentMapData?.revealRadius || 3)
                        && Math.abs(y - Field.y) <= Number(Field.currentMapData?.revealRadius || 3);
                    if (typeof Dungeon.isFixedVisitedForMap === 'function' && !Dungeon.isFixedVisitedForMap(x, y) && !visibleNow) {
                        tile = 'W';
                    }
                }
                const parts = Field.getMapDrawParts ? Field.getMapDrawParts(tile, x, y) : { baseTile: tile, overlayConfig: null };
                const cfg = parts.worldOverlay
                    ? Field.getTileConfig(parts.baseTile)
                    : (Field.getTileConfigForDraw ? Field.getTileConfigForDraw(parts.baseTile, x, y) : Field.getTileConfig(parts.baseTile));
                const drawX = offsetX + x * size;
                const drawY = offsetY + y * size;
                ctx.fillStyle = Field.getMiniMapTileColor
                    ? Field.getMiniMapTileColor(tile, x, y)
                    : (cfg.color || '#000');
                ctx.fillRect(drawX, drawY, Math.ceil(size), Math.ceil(size));
                // 拡大マップでは壁そのものを丸いオーバーレイにしない。
                // 建物・入口・NPCなどはタイル内の四角い記号で示す。
                if (parts.overlayConfig && String(parts.upper || tile || '').toUpperCase() !== 'W' && Field.drawMapOverlayMarker) {
                    Field.drawMapOverlayMarker(ctx, parts.overlayConfig, drawX, drawY, size);
                }
                const effectColor = Field.getTileEffectMarkerColor ? Field.getTileEffectMarkerColor(x, y) : null;
                if (effectColor && Field.drawFullMapTileMarker) {
                    Field.drawFullMapTileMarker(ctx, effectColor, drawX, drawY, size);
                }
                const markerInfo = Field.getMiniMapMarkerInfo ? Field.getMiniMapMarkerInfo(tile, x, y) : null;
                if (markerInfo?.color && Field.drawFullMapTileMarker) {
                    Field.drawFullMapTileMarker(ctx, markerInfo.color, drawX, drawY, size, markerInfo.connections);
                }
            }
        }

        if (Field.currentMapData?.isFixed && Field.getFixedHealSpringsForCurrentFloor && Field.drawFullMapTileMarker) {
            Field.getFixedHealSpringsForCurrentFloor().forEach(s => {
                Field.drawFullMapTileMarker(ctx, '#80ffb0', offsetX + Number(s.x) * size, offsetY + Number(s.y) * size, size);
            });
        }

        // 拡大マップでは主人公だけを白い「●」で表示する。
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(
            offsetX + (Number(Field.x) + 0.5) * size,
            offsetY + (Number(Field.y) + 0.5) * size,
            Math.max(2.5, Math.min(6, size * 0.34)),
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.72)';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.floor(offsetX) + 0.5, Math.floor(offsetY) + 0.5, Math.floor(mapW * size) - 1, Math.floor(mapH * size) - 1);
    },

    getCurrentTileTheme: (areaKey = null) => {
        const key = areaKey || Field.getCurrentAreaKey();
        const mapDef = Field.currentMapData || null;
        const worldDef = !mapDef && typeof MapRegistry !== 'undefined' && MapRegistry.getWorldDefinition
            ? MapRegistry.getWorldDefinition()
            : null;
        const themeKey = mapDef?.themeKey || worldDef?.themeKey || key;

        // 優先順位:
        // 1. DEFAULT: 足りない記号の保険
        // 2. TILE_THEMES[themeKey]: MAPごとの基本見た目
        // 3. mapDef.tileOverrides: そのMAPだけの個別上書き
        return {
            ...(TILE_THEMES['DEFAULT'] || {}),
            ...(TILE_THEMES[themeKey] || TILE_THEMES[key] || {}),
            ...(worldDef?.tileOverrides || {}),
            ...(mapDef?.tileOverrides || {})
        };
    },

    getTileConfig: (tileSign) => {
        const upper = String(tileSign || 'W').toUpperCase();
        const theme = Field.getCurrentTileTheme();
        
        let config = theme[upper] || TILE_THEMES['DEFAULT'][upper] || { img: null, color: '#000' };
        if (Field.currentMapData && Field.currentMapData.isDungeon && !Field.currentMapData.isFixed && upper === 'B' && Field.getCurrentAreaKey?.() === 'ABYSS') {
            return theme.T || TILE_THEMES['DEFAULT'].T || { img: null, color: '#222' };
        }

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
        if (Array.isArray(base?.variants) && base.variants.length && tileX !== null && tileY !== null) {
            let variantX = Number(tileX);
            let variantY = Number(tileY);
            // Outside a fixed map, select the exact same image variant as the
            // nearest edge cell, then repeat that image on the ordinary 32px grid.
            if (Field.currentMapData?.isFixed) {
                const mapW = Math.max(1, Number(Field.currentMapData.width || Field.currentMapData.tiles?.[0]?.length || 1));
                const mapH = Math.max(1, Number(Field.currentMapData.height || Field.currentMapData.tiles?.length || 1));
                variantX = Math.max(0, Math.min(mapW - 1, variantX));
                variantY = Math.max(0, Math.min(mapH - 1, variantY));
            }
            return window.MapRenderShared.resolveTileVariant(base, variantX, variantY);
        }
        if (!Field.currentMapData && tileX !== null && tileY !== null && typeof MapRegistry !== 'undefined' && MapRegistry.getWorldTileConfig) {
            const point = MapRegistry.normalizeWorldPoint ? MapRegistry.normalizeWorldPoint(tileX, tileY) : { x: tileX, y: tileY };
            const special = MapRegistry.getWorldTileConfig(point.x, point.y);
            if (special) return { ...base, ...special };
        }
        return base;
    },

    getRuntimeTileEffectAt: (tileX = null, tileY = null) => {
        if (!Field.currentMapData?.isFixed || tileX === null || tileY === null) return null;
        const authored = (typeof MapRegistry !== 'undefined' && MapRegistry.findTileEffect)
            ? MapRegistry.findTileEffect(Field.currentMapData, tileX, tileY)
            : null;
        if (authored) return authored;

        // A switch gate may replace a wall with a floor effect. The tile mutation
        // is persisted in mapChanges; resolving the paired effect from the same
        // open definition keeps rendering, minimaps, movement, and save reloads in sync.
        const key = `${Number(tileX)},${Number(tileY)}`;
        const areaKey = Field.getCurrentAreaKey?.();
        const changeKey = Field.getCurrentMapChangeKey?.(areaKey) || areaKey;
        const changedTile = App.data?.progress?.mapChanges?.[changeKey]?.[key]
            || App.data?.progress?.mapChanges?.[areaKey]?.[key]
            || null;
        if (!changedTile) return null;
        const open = (Field.currentMapData.mapActions || [])
            .filter(action => action?.type === 'switchGate')
            .flatMap(action => Array.isArray(action.opens) ? action.opens : [])
            .find(definition => Number(definition?.x) === Number(tileX)
                && Number(definition?.y) === Number(tileY)
                && definition?.effectType);
        if (!open || String(changedTile).toUpperCase() !== String(open.tile || 'T').toUpperCase()) return null;
        return {
            type: String(open.effectType),
            x: Number(tileX),
            y: Number(tileY),
            maxSlide: Math.max(1, Number(open.maxSlide || 20)),
            message: open.effectMessage || open.message || null,
            switchGenerated: true
        };
    },

    getTileEffectMarkerColor: (tileX = null, tileY = null) => {
        if (!Field.currentMapData?.isFixed || tileX === null || tileY === null) return null;
        if (typeof Dungeon !== 'undefined' && typeof Dungeon.getFixedHunterAt === 'function' && Dungeon.getFixedHunterAt(tileX, tileY)) {
            return '#ff4d4d';
        }
        const effect = Field.getRuntimeTileEffectAt(tileX, tileY);
        if (!effect) return null;
        if (effect.type === 'hunter') return null;
        const colors = {
            poison: '#7bd14a',
            ice: '#93e7ff',
            warp: '#b68cff',
            hunter: '#ff4d4d',
            angel: '#fff3a6'
        };
        return colors[effect.type] || '#ffffff';
    },

    getMiniMapTileColor: (tileSign, tileX = null, tileY = null) => {
        const upper = String(tileSign || 'W').toUpperCase();
        if (!Field.currentMapData && tileX !== null && tileY !== null
            && typeof MapRegistry !== 'undefined' && typeof MapRegistry.getWorldSurfaceAt === 'function') {
            const surface = MapRegistry.getWorldSurfaceAt(tileX, tileY);
            if (surface?.isSea) return '#246f96';
        }
        if (upper === 'S' && Field.currentMapData?.autoExitOnPerimeter === true) {
            return Field.currentMapData.perimeterExitMiniMapColor || '#766746';
        }
        if (Field.currentMapData?.isFixed && Field.getMinimapExitCellState?.(tileX, tileY) === 'inner') {
            return '#000';
        }
        const cfg = Field.getTileConfigForDraw
            ? Field.getTileConfigForDraw(upper, tileX, tileY)
            : Field.getTileConfig(upper);
        let color = cfg?.color || '#000';
        if (upper === 'W') return '#000';
        if (upper === 'M' && (!color || color === '#000' || color === '#000000')) color = '#54515b';

        // Preserve the subdued field art while giving the schematic a clear floor/wall split.
        const themeKey = String(Field.currentMapData?.themeKey || Field.getCurrentAreaKey?.() || '').toUpperCase();
        if (themeKey === 'DARK_CASTLE' && (upper === 'T' || upper === 'G')) return '#465064';
        return color;
    },

    _minimapExitCellCache: new WeakMap(),

    getMinimapExitCells: () => {
        const map = Field.currentMapData;
        if (!map?.isFixed || !Array.isArray(map.tiles)) return { all: new Set(), edge: new Set() };
        const cached = Field._minimapExitCellCache.get(map);
        if (cached) return cached;

        const width = Number(map.width || map.tiles[0]?.length || 0);
        const height = Number(map.height || map.tiles.length || 0);
        const all = new Set();
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (String(map.tiles[y]?.[x] || '').toUpperCase() === 'S') all.add(`${x},${y}`);
            }
        }
        (map.floorLinks || []).forEach(link => {
            if (link?.to === 'EXIT') all.add(`${Number(link.x)},${Number(link.y)}`);
        });

        const edge = new Set();
        const visited = new Set();
        const distanceToBoundary = (x, y) => Math.min(x, y, width - 1 - x, height - 1 - y);
        all.forEach(startKey => {
            if (visited.has(startKey)) return;
            const queue = [startKey];
            const component = [];
            let minimum = Infinity;
            visited.add(startKey);
            while (queue.length) {
                const key = queue.shift();
                component.push(key);
                const [x, y] = key.split(',').map(Number);
                minimum = Math.min(minimum, distanceToBoundary(x, y));
                [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([nx, ny]) => {
                    const nextKey = `${nx},${ny}`;
                    if (all.has(nextKey) && !visited.has(nextKey)) {
                        visited.add(nextKey);
                        queue.push(nextKey);
                    }
                });
            }
            component.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                if (distanceToBoundary(x, y) === minimum) edge.add(key);
            });
        });
        const result = { all, edge };
        Field._minimapExitCellCache.set(map, result);
        return result;
    },

    getMinimapExitCellState: (tileX, tileY) => {
        const map = Field.currentMapData;
        const x = Number(tileX);
        const y = Number(tileY);
        if (!map?.isFixed || !Number.isInteger(x) || !Number.isInteger(y)
            || x < 0 || y < 0 || x >= Number(map.width) || y >= Number(map.height)) return null;
        const key = `${x},${y}`;
        const cells = Field.getMinimapExitCells();
        if (!cells.all.has(key)) return null;
        return cells.edge.has(key) ? 'edge' : 'inner';
    },

    getTileEffectGraphicKey: (tileX = null, tileY = null) => {
        if (!Field.currentMapData?.isFixed || tileX === null || tileY === null) return null;
        if (typeof Dungeon !== 'undefined' && typeof Dungeon.getFixedHunterAt === 'function') {
            const hunter = Dungeon.getFixedHunterAt(tileX, tileY);
            if (hunter) return hunter.imageKey || 'overlay_dungeon_hunter';
        }
        const effect = Field.getRuntimeTileEffectAt(tileX, tileY);
        if (!effect) return null;
        return {
            poison: 'tile_poison_bog',
            ice: 'tile_ice_slide',
            warp: 'overlay_dungeon_warp'
        }[effect.type] || null;
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

        if ((upper === 'C' || upper === 'R') && x !== null && y !== null) {
            const chestDef = Field.getFixedChestAt ? Field.getFixedChestAt(x, y) : null;
            const opened = typeof Dungeon !== 'undefined' && Dungeon.isFixedChestOpenedAt(x, y);
            const presentation = typeof Dungeon !== 'undefined' && Dungeon.getContainerPresentation
                ? Dungeon.getContainerPresentation(chestDef)
                : { kind: 'chest' };
            const isChest = presentation.kind === 'chest';

            // 固定マップ・固定ダンジョンの宝箱は、取得後も空箱として残す。
            // ランダム生成ダンジョンは currentMapData.isFixed === false のため、
            // この分岐へ入らず、開封時に従来どおり床タイルへ置換される。
            if (opened && isChest) {
                config = {
                    ...config,
                    img: chestDef?.openedImageKey
                        || (upper === 'R' ? 'overlay_dungeon_chest_rare_empty' : 'overlay_dungeon_chest_empty'),
                    color: chestDef?.color || '#665b52'
                };
            } else if (chestDef?.imageKey) {
                config = {
                    ...config,
                    img: opened ? (chestDef.openedImageKey || chestDef.imageKey) : chestDef.imageKey,
                    color: chestDef.color || config.color
                };
            }
        }

        // ボスマスは固定の汎用記号ではなく、配置されたモンスター原画由来のチップを使う。
        if (upper === 'B' && x !== null && y !== null && typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss) {
            const bossDef = MapRegistry.findFixedBoss(Field.currentMapData, x, y);
            if (!Field.isFixedBossAvailable(bossDef)) return null;
            if (bossDef?.imageKey && typeof GRAPHICS !== 'undefined' && GRAPHICS.data?.[bossDef.imageKey]) {
                config = { img: bossDef.imageKey, color: bossDef.color || config.color || '#db3b4d' };
            } else {
            const bossMonsterIds = (Array.isArray(bossDef?.monsterId) ? bossDef.monsterId : [bossDef?.monsterId])
                .map(id => Number(id))
                .filter(id => Number.isFinite(id) && id > 0);
            // 3体編成は配置順の中央（2番目）を代表スプライトとして描画する。
            const rawMonsterId = bossMonsterIds.length === 3 ? bossMonsterIds[1] : bossMonsterIds[0];
            const monsterId = Number(bossDef?.mapSpriteMonsterId || rawMonsterId);
            const graphicKey = Number.isFinite(monsterId) && Field.getMonsterMapSpriteKey
                ? Field.getMonsterMapSpriteKey(monsterId)
                : (Number.isFinite(monsterId) ? `monster_${monsterId}` : '');
            if (graphicKey && typeof GRAPHICS !== 'undefined' && GRAPHICS.data?.[graphicKey]) {
                config = { img: graphicKey, color: config.color || '#db3b4d' };
            }
            }
        }

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

    getFixedChestAt: (tileX = null, tileY = null) => {
        if (!Field.currentMapData?.isFixed || tileX === null || tileY === null) return null;
        if (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedChest) {
            return MapRegistry.findFixedChest(Field.currentMapData, tileX, tileY);
        }
        return Array.isArray(Field.currentMapData.chests)
            ? Field.currentMapData.chests.find(chest => Number(chest.x) === Number(tileX) && Number(chest.y) === Number(tileY)) || null
            : null;
    },

    getBlockingObjectAt: (tileX = null, tileY = null) => {
        if (!Field.currentMapData?.isFixed || tileX === null || tileY === null) return null;
        if (typeof MapRegistry !== 'undefined' && typeof MapRegistry.findBlockingObject === 'function') {
            return MapRegistry.findBlockingObject(Field.currentMapData, tileX, tileY);
        }
        return Array.isArray(Field.currentMapData.blockingObjects)
            ? Field.currentMapData.blockingObjects.find(object =>
                object?.active !== false &&
                Number(object.x) === Number(tileX) &&
                Number(object.y) === Number(tileY)
            ) || null
            : null;
    },

    getFixedChestTileSign: (chestDef = null) => {
        if (!chestDef) return null;
        const opened = typeof Dungeon !== 'undefined'
            && Dungeon.isFixedChestOpenedAt(Number(chestDef.x), Number(chestDef.y));
        const presentation = typeof Dungeon !== 'undefined' && Dungeon.getContainerPresentation
            ? Dungeon.getContainerPresentation(chestDef)
            : { kind: 'chest' };
        // 今回、開封後も残すのは宝箱だけ。ツボ・タルは既存の挙動を維持する。
        if (opened && presentation.kind !== 'chest') return null;
        const rare = chestDef.rare === true || chestDef.type === 'rare' || chestDef.chestType === 'rare';
        return rare ? 'R' : 'C';
    },

    getMapDrawParts: (tileSign, tileX = null, tileY = null) => {
        const upper = String(tileSign || 'W').toUpperCase();
        // 固定マップの開封済み宝箱も C/R の論理タイルを維持し、
        // getFixedTileOverlayConfig() で空箱オーバーレイへ差し替える。
        // A perimeter auto-exit cell is logically S, but visually it is authored
        // terrain. Rendering it as an S object would add lift/contact shadows to
        // every repeated cell and expose seams outside the map.
        if (upper === 'S' && Field.currentMapData?.autoExitOnPerimeter === true) {
            return {
                upper: 'G',
                baseTile: 'G',
                overlayConfig: null,
                worldOverlay: false,
                logicalUpper: 'S'
            };
        }
        if (upper === 'B' && Field.currentMapData?.isDungeon && !Field.currentMapData?.isFixed && Field.getCurrentAreaKey?.() === 'ABYSS') {
            return {
                upper: 'T',
                baseTile: 'T',
                overlayConfig: null,
                worldOverlay: false
            };
        }
        const fixedOverlayConfig = Field.getFixedTileOverlayConfig ? Field.getFixedTileOverlayConfig(upper, tileX, tileY) : null;
        const fixedContainerDef = (fixedOverlayConfig && (upper === 'C' || upper === 'R') && Field.getFixedChestAt)
            ? Field.getFixedChestAt(tileX, tileY)
            : null;
        const actionOverlayConfig = Field.getMapActionOverlayConfig ? Field.getMapActionOverlayConfig(tileX, tileY) : null;
        const blockingObject = Field.getBlockingObjectAt ? Field.getBlockingObjectAt(tileX, tileY) : null;
        // blocking:true の floorDecorations は装飾描画側が正本。
        // ここでも blockingObject として描くと、drawScale 適用済みの本体に加えて
        // 32px版が重なり、台座などが大小二重に見えるためオーバーレイ化しない。
        const blockingObjectIsFloorDecoration = !!blockingObject
            && Array.isArray(Field.currentMapData?.floorDecorations)
            && Field.currentMapData.floorDecorations.includes(blockingObject);
        const blockingObjectOverlayConfig = blockingObject?.imageKey && !blockingObjectIsFloorDecoration
            ? {
                img: blockingObject.imageKey,
                color: blockingObject.color || '#6f6252',
                blockingObject: true,
                drawWidth: Math.max(8, Number(blockingObject.drawWidth || 32)),
                drawHeight: Math.max(8, Number(blockingObject.drawHeight || 32))
            }
            : null;
        const randomDungeonChestOverlay = Field.currentMapData?.isDungeon && !Field.currentMapData?.isFixed && (upper === 'C' || upper === 'R')
            ? {
                img: upper === 'R' ? 'overlay_dungeon_chest_rare' : 'overlay_dungeon_chest',
                color: upper === 'R' ? '#d65353' : '#d7b45a'
            }
            : null;
        const randomDungeonStairsOverlay = Field.currentMapData?.isDungeon && !Field.currentMapData?.isFixed && upper === 'S'
            ? { img: 'overlay_dungeon_stairs', color: '#d7b45a' }
            : null;

        // ワールドマップ上の施設画像は、タイル記号が W でも G でも同じように上へ重ねる。
        // これにより、海底神殿の座標タイルを G にしても神殿チップを表示できる。
        const worldPoint = (!Field.currentMapData && tileX !== null && tileY !== null && typeof MapRegistry !== 'undefined' && MapRegistry.normalizeWorldPoint)
            ? MapRegistry.normalizeWorldPoint(tileX, tileY)
            : { x: tileX, y: tileY };
        const worldOverlayConfig = (!Field.currentMapData && tileX !== null && tileY !== null && typeof MapRegistry !== 'undefined' && MapRegistry.getWorldTileConfig)
            ? MapRegistry.getWorldTileConfig(worldPoint.x, worldPoint.y)
            : null;

        const resolvedOverlayConfig = blockingObjectOverlayConfig || actionOverlayConfig || fixedOverlayConfig || randomDungeonChestOverlay || randomDungeonStairsOverlay || worldOverlayConfig;
        // Chest/pot/barrel art already contains its own contact shading. Adding the
        // generic actor ellipse underneath produces a dark rectangular-looking patch
        // on bright facility floors, so containers explicitly suppress that pass.
        const isContainerOverlay = (upper === 'C' || upper === 'R')
            && !!(fixedContainerDef || randomDungeonChestOverlay);
        const overlayConfig = isContainerOverlay && resolvedOverlayConfig
            ? { ...resolvedOverlayConfig, suppressShadow: true }
            : resolvedOverlayConfig;
        const baseTile = blockingObjectOverlayConfig
            ? (blockingObject.baseTile || upper)
            : (actionOverlayConfig
            ? actionOverlayConfig.baseTile
            : (fixedContainerDef?.baseTile
                ? fixedContainerDef.baseTile
                : (randomDungeonChestOverlay || randomDungeonStairsOverlay
                ? 'T'
                : (fixedOverlayConfig && Field.getFixedTileOverlayBaseTile
                ? Field.getFixedTileOverlayBaseTile(upper)
                : upper))));
        return {
            upper,
            baseTile: baseTile || upper,
            overlayConfig,
            // ワールドマップ上の町・ダンジョン画像は透明素材のため、
            // 下地を fieldTile で再上書きせず、実際の地形タイルを描く。
            worldOverlay: !!worldOverlayConfig
        };
    },

    isBuildingOverlayConfig: (config) => {
        const key = String(config?.img || '');
        if (!key) return false;
        return [
            'overlay_building_',
            'overlay_field_castle',
            'overlay_field_fortress',
            'overlay_field_hall',
            'overlay_field_house',
            'overlay_field_inn',
            'overlay_field_lighthouse',
            'overlay_field_medal',
            'overlay_field_ruins',
            'overlay_field_settlement',
            'overlay_field_shop',
            'overlay_field_smith',
            'overlay_field_temple',
            'overlay_field_tower',
            'overlay_field_town',
            'overlay_field_village',
            'overlay_field_weapon'
        ].some(prefix => key.startsWith(prefix));
    },

    getBuildingAnchorsNear: (centerX, centerY, radiusX = 2, radiusY = 2) => {
        if (!Field.currentMapData?.isFixed || Field.currentMapData?.isDungeon) return [];
        const anchors = [];
        const width = Number(Field.currentMapData.width || 0);
        const height = Number(Field.currentMapData.height || 0);
        const areaKey = Field.getCurrentAreaKey();

        for (let y = Math.max(0, centerY - radiusY); y <= Math.min(height - 1, centerY + radiusY); y++) {
            for (let x = Math.max(0, centerX - radiusX); x <= Math.min(width - 1, centerX + radiusX); x++) {
                const tile = Field.getRenderedTileForDraw(x, y, width, height, areaKey);
                // A map action may replace a generic house with a dedicated facility
                // image at one coordinate.  Treat that visual anchor exactly like the
                // ordinary shop/inn anchors for roof-depth movement rules.
                const overlay = Field.getMapActionOverlayConfig?.(x, y)
                    || Field.getFixedTileOverlayConfig(tile, x, y);
                if (Field.isBuildingOverlayConfig(overlay)) anchors.push({ x, y, overlay });
            }
        }
        return anchors;
    },

    isBuildingMovementBlocked: (fromX, fromY, toX, toY) => {
        if (!Field.currentMapData?.isFixed || Field.currentMapData?.isDungeon) return false;
        const anchors = Field.getBuildingAnchorsNear(toX, toY, 2, 2);

        return anchors.some(building => {
            // 左後・右後から前へ抜ける移動は許可する。
            // 屋根の中央を貫通して見える、建物中央と真後ろの間だけを双方向で禁止する。
            const fromBuilding = fromX === building.x && fromY === building.y;
            const toBuilding = toX === building.x && toY === building.y;
            const fromDirectlyBehind = fromX === building.x && fromY === building.y - 1;
            const toDirectlyBehind = toX === building.x && toY === building.y - 1;
            return (fromDirectlyBehind && toBuilding) || (fromBuilding && toDirectlyBehind);
        });
    },

    // Raised stages remain walkable inside, while crossing their outline is restricted
    // to explicitly authored gateways. This avoids filling stage cells with invisible
    // blocking objects and keeps the rule reusable for future maps.
    isMovementRegionCrossingBlocked: (fromX, fromY, toX, toY) => {
        const regions = Field.currentMapData?.movementRegions;
        if (!Array.isArray(regions)) return false;
        return regions.some(region => {
            const left = Number(region.x);
            const top = Number(region.y);
            const width = Math.max(1, Number(region.width) || 1);
            const height = Math.max(1, Number(region.height) || 1);
            if (!Number.isFinite(left) || !Number.isFinite(top)) return false;
            const inside = (x, y) => x >= left && x < left + width && y >= top && y < top + height;
            const fromInside = inside(Number(fromX), Number(fromY));
            const toInside = inside(Number(toX), Number(toY));
            if (fromInside === toInside) return false;
            const gateways = Array.isArray(region.gateways) ? region.gateways : [];
            const permitted = gateways.some(gateway => {
                const a = gateway?.inside;
                const b = gateway?.outside;
                if (!a || !b) return false;
                return (Number(fromX) === Number(a.x) && Number(fromY) === Number(a.y)
                    && Number(toX) === Number(b.x) && Number(toY) === Number(b.y))
                    || (Number(fromX) === Number(b.x) && Number(fromY) === Number(b.y)
                        && Number(toX) === Number(a.x) && Number(toY) === Number(a.y));
            });
            return !permitted;
        });
    },

    // Maps may author additional non-walkable terrain without borrowing a door,
    // facility, or event sign. The Summit Temple uses this for open sky.
    isTileImpassableForCurrentMap: (tileSign) => {
        const upper = String(tileSign || '').toUpperCase();
        if (upper === 'W') return true;
        const authored = Array.isArray(Field.currentMapData?.impassableTiles)
            ? Field.currentMapData.impassableTiles
            : [];
        return authored.some(sign => String(sign || '').toUpperCase() === upper);
    },


    getMiniMapMarkerInfo: (tileSign, tileX = null, tileY = null) => {
        const upper = String(tileSign || '').toUpperCase();
        const emptyConnections = { left: false, right: false, up: false, down: false };
        if (upper === 'S' && Field.currentMapData?.autoExitOnPerimeter === true) return null;
        const exitState = Field.getMinimapExitCellState?.(tileX, tileY);
        if (exitState === 'edge') return { color: '#f6d46a', connections: emptyConnections };
        if (exitState === 'inner') return null;

        // Multi-cell facilities may expose only their player-facing edge as an event strip.
        // That strip is authored separately from the physical collision area and is rendered
        // as one connected schematic marker instead of unrelated dots.
        const minimapAction = tileX !== null && tileY !== null
            && typeof MapRegistry !== 'undefined'
            && typeof MapRegistry.findMapActionMinimapCell === 'function'
            ? MapRegistry.findMapActionMinimapCell(Field.currentMapData, tileX, tileY)
            : null;
        if (minimapAction && Field.isMapActionAvailable(minimapAction)) {
            const connections = typeof MapRegistry.getMapActionMinimapConnections === 'function'
                ? MapRegistry.getMapActionMinimapConnections(minimapAction, tileX, tileY)
                : emptyConnections;
            return {
                color: minimapAction.minimapAreaColor || minimapAction.minimapColor || '#3f245c',
                connections,
                action: minimapAction,
                connectedArea: true
            };
        }

        const actionOverlay = Field.getMapActionOverlayConfig ? Field.getMapActionOverlayConfig(tileX, tileY) : null;
        if (actionOverlay) {
            const imageKey = String(actionOverlay.img || '');
            const color = imageKey.startsWith('overlay_npc_')
                ? (actionOverlay.minimapColor || '#5bd6ff')
                : (actionOverlay.minimapColor || actionOverlay.color || '#8f7dff');
            return { color, connections: emptyConnections };
        }

        // Legacy maps without an explicit minimapArea retain their interaction-area markers.
        const areaAction = tileX !== null && tileY !== null && typeof MapRegistry !== 'undefined' && MapRegistry.findMapActionInteractionCell
            ? MapRegistry.findMapActionInteractionCell(Field.currentMapData, tileX, tileY)
            : null;
        if (areaAction?.interactionArea && Field.isMapActionAvailable(areaAction)) {
            return { color: areaAction.minimapAreaColor || areaAction.minimapColor || '#3f245c', connections: emptyConnections };
        }
        if (!upper || upper === 'W' || upper === 'T' || upper === 'G' || upper === 'L' || upper === 'M' || upper === '~' || upper === '^') return null;

        if (Field.currentMapData?.isFixed && upper === 'B' && tileX !== null && tileY !== null && typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss) {
            const bossDef = MapRegistry.findFixedBoss(Field.currentMapData, tileX, tileY);
            if (!Field.isFixedBossAvailable(bossDef)) return null;
        }

        const colors = {
            C: '#d99a55',
            R: '#ff4fa3',
            S: '#f6d46a',
            D: '#f6d46a',
            U: '#f6d46a',
            B: '#ff4d4d',
            X: '#d94a4a',
            Y: '#4aa0e6',
            Z: '#e0b84a',
            Q: '#d94a4a',
            N: '#4aa0e6',
            O: '#e0b84a'
        };
        const color = colors[upper] || null;
        return color ? { color, connections: emptyConnections } : null;
    },

    getMiniMapMarkerColor: (tileSign, tileX = null, tileY = null) => {
        return Field.getMiniMapMarkerInfo?.(tileSign, tileX, tileY)?.color || null;
    },

    drawFullMapTileMarker: (ctx, color, x, y, size, connections = null) => {
        if (!ctx || !color || size <= 0) return;
        const marker = Math.max(2, Math.floor(size * 0.58));
        const markerX = Math.floor(x + (size - marker) / 2);
        const markerY = Math.floor(y + (size - marker) / 2);
        const hasConnections = !!connections && Object.values(connections).some(Boolean);
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = color;
        ctx.fillRect(markerX, markerY, marker, marker);
        if (hasConnections) {
            const centerX = x + size / 2;
            const centerY = y + size / 2;
            if (connections.left) ctx.fillRect(x, markerY, Math.ceil(centerX - x), marker);
            if (connections.right) ctx.fillRect(Math.floor(centerX), markerY, Math.ceil(x + size - centerX), marker);
            if (connections.up) ctx.fillRect(markerX, y, marker, Math.ceil(centerY - y));
            if (connections.down) ctx.fillRect(markerX, Math.floor(centerY), marker, Math.ceil(y + size - centerY));
        }
        ctx.restore();
    },

    drawMiniMapTileMarker: (ctx, color, x, y, size, connections = null) => {
        if (!ctx || !color || size <= 0) return;
        const marker = Math.max(2, Math.ceil(size * 0.72));
        const markerX = Math.floor(x + (size - marker) / 2);
        const markerY = Math.floor(y + (size - marker) / 2);
        const hasConnections = !!connections && Object.values(connections).some(Boolean);
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = color;
        if (hasConnections) {
            const centerX = x + size / 2;
            const centerY = y + size / 2;
            ctx.fillRect(markerX, markerY, marker, marker);
            if (connections.left) ctx.fillRect(x, markerY, Math.ceil(centerX - x), marker);
            if (connections.right) ctx.fillRect(Math.floor(centerX), markerY, Math.ceil(x + size - centerX), marker);
            if (connections.up) ctx.fillRect(markerX, y, marker, Math.ceil(centerY - y));
            if (connections.down) ctx.fillRect(markerX, Math.floor(centerY), marker, Math.ceil(y + size - centerY));
        } else if (size <= 4) {
            ctx.fillRect(markerX, markerY, marker, marker);
        } else {
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, Math.max(1.5, marker / 2), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(markerX, markerY, Math.max(1, Math.floor(marker * 0.34)), Math.max(1, Math.floor(marker * 0.28)));
        }
        ctx.restore();
    },

    updateHeldKeyHud: () => {
        const hud = document.getElementById('field-key-hud');
        if (!hud) return;
        const canShow = Field.minimapMode !== 'minimized'
            && !!Field.currentMapData?.isDungeon
            && typeof Dungeon !== 'undefined'
            && typeof Dungeon.getHeldKeyOrder === 'function';
        const colors = canShow ? Dungeon.getHeldKeyOrder() : [];
        const keyDefs = {
            red: { key: 'item_key_red', label: '赤の鍵' },
            blue: { key: 'item_key_blue', label: '青の鍵' },
            gold: { key: 'item_key_gold', label: '金の鍵' }
        };
        const nodes = colors.map(color => {
            const def = keyDefs[color];
            const src = def ? window.GRAPHICS?.data?.[def.key] : null;
            if (!def || !src) return null;
            const image = document.createElement('img');
            image.src = src;
            image.alt = def.label;
            image.title = def.label;
            return image;
        }).filter(Boolean);
        hud.replaceChildren(...nodes);
        hud.classList.toggle('is-visible', nodes.length > 0);
    },

    drawHudMinimap: () => {
        const canvas = document.getElementById('field-minimap-canvas');
        if (!canvas) return;
        const size = 80;
        if (canvas.width !== size) canvas.width = size;
        if (canvas.height !== size) canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, size, size);
        Field.updateHeldKeyHud();
        if (Field.minimapMode === 'minimized') return;

        const range = 7;
        const cells = range * 2 + 1;
        const cell = size / cells;
        const tileRows = Field.currentMapData?.tiles;
        const actualMapH = Array.isArray(tileRows) ? tileRows.length : 0;
        const actualMapW = Array.isArray(tileRows)
            ? tileRows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : String(row || '').length), 0)
            : 0;
        const mapW = Field.currentMapData
            ? Math.max(1, actualMapW || Number(Field.currentMapData.width || 0))
            : (Field.getActiveWorldMap()?.[0]?.length || 50);
        const mapH = Field.currentMapData
            ? Math.max(1, actualMapH || Number(Field.currentMapData.height || 0))
            : (Field.getActiveWorldMap()?.length || 32);

        ctx.save();
        ctx.globalAlpha = 0.56;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;

        const miniTileColor = (tile, tx, ty) => Field.getMiniMapTileColor
            ? Field.getMiniMapTileColor(tile, tx, ty)
            : (Field.getTileConfig(tile)?.color || '#000');

        const isRandomDungeonHidden = (relX, relY, tileX, tileY) => {
            if (!Field.currentMapData?.isDungeon || Field.currentMapData?.isFixed) return false;
            if (typeof Dungeon === 'undefined' || typeof Dungeon.isVisited !== 'function') return false;
            const inCurrentSight = Math.abs(relX) <= 4 && Math.abs(relY) <= 4;
            return !inCurrentSight && !Dungeon.isVisited(tileX, tileY);
        };

        for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
                let tx = Number(Field.x) + dx;
                let ty = Number(Field.y) + dy;
                let tile = 'W';
                let visible = true;

                if (Field.currentMapData) {
                    const outOfBounds = tx < 0 || tx >= mapW || ty < 0 || ty >= mapH;
                    // ミニマップは実タイル配列の範囲だけを描画する。
                    // 固定MAPの端タイルを画面外へ延長すると、出口が連続して見えるため描かない。
                    if (outOfBounds || isRandomDungeonHidden(dx, dy, tx, ty)) {
                        visible = false;
                    } else {
                        const areaKey = Field.getCurrentAreaKey();
                        const progressKey = Field.currentMapData?.isFixed && Field.getCurrentProgressMapKey
                            ? Field.getCurrentProgressMapKey()
                            : areaKey;
                        const key = `${tx},${ty}`;
                        tile = App.data.progress.mapChanges?.[progressKey]?.[key]
                            || App.data.progress.mapChanges?.[areaKey]?.[key]
                            || Field.getMapTileAt(Field.currentMapData, tx, ty);
                        if (String(tile || '').toUpperCase() === 'B') {
                            const bossDef = (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss)
                                ? MapRegistry.findFixedBoss(Field.currentMapData, tx, ty)
                                : null;
                            if (Field.isFixedBossDefeatedAt(bossDef, tx, ty, progressKey)) tile = 'G';
                        }
                    }
                } else {
                    const worldMap = Field.getActiveWorldMap();
                    tile = worldMap[((ty % mapH) + mapH) % mapH][((tx % mapW) + mapW) % mapW];
                }

                if (!visible) continue;
                const x = (dx + range) * cell;
                const y = (dy + range) * cell;
                ctx.fillStyle = (dx === 0 && dy === 0) ? '#fff' : miniTileColor(tile, tx, ty);
                ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cell), Math.ceil(cell));

                if ((dx !== 0 || dy !== 0) && Field.getMiniMapMarkerInfo && Field.drawMiniMapTileMarker) {
                    const markerInfo = Field.getMiniMapMarkerInfo(tile, tx, ty);
                    if (markerInfo?.color) Field.drawMiniMapTileMarker(ctx, markerInfo.color, x, y, cell, markerInfo.connections);
                }
            }
        }

        const drawMarker = (relX, relY, color) => {
            if (!color || relX === 0 && relY === 0) return;
            if (relX < -range || relX > range || relY < -range || relY > range) return;
            if (Field.drawMiniMapTileMarker) {
                Field.drawMiniMapTileMarker(ctx, color, (relX + range) * cell, (relY + range) * cell, cell);
            } else {
                ctx.fillStyle = color;
                ctx.fillRect((relX + range) * cell, (relY + range) * cell, Math.max(2, cell), Math.max(2, cell));
            }
        };

        const drawDungeonObject = (obj, color) => {
            if (!Field.currentMapData?.isDungeon || !obj || !obj.active || typeof Dungeon === 'undefined') return;
            if (Number(obj.floor) !== Number(Dungeon.floor)) return;
            const relX = Number(obj.x) - Number(Field.x);
            const relY = Number(obj.y) - Number(Field.y);
            if (isRandomDungeonHidden(relX, relY, Number(obj.x), Number(obj.y))) return;
            drawMarker(relX, relY, color);
        };

        if (Field.currentMapData?.isFixed && Field.getFixedHealSpringsForCurrentFloor) {
            Field.getFixedHealSpringsForCurrentFloor().forEach(spring => {
                drawMarker(Number(spring.x) - Number(Field.x), Number(spring.y) - Number(Field.y), '#80ffb0');
            });
        }
        drawDungeonObject(App.data?.dungeon?.healSpring, '#80ffb0');
        drawDungeonObject(App.data?.dungeon?.abyssRift, '#a34cff');
        drawDungeonObject(App.data?.dungeon?.adventurer, '#5bd6ff');
        drawDungeonObject(App.data?.dungeon?.trialAngel, '#fff3a6');
        drawDungeonObject(App.data?.dungeon?.keyGuardian, '#ffd78a');

        ctx.strokeStyle = 'rgba(255,255,255,0.72)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
        ctx.restore();
    },

    getFixedHealSpringsForCurrentFloor: () => {
        if (!Field.currentMapData?.isFixed || !Array.isArray(Field.currentMapData.healSprings)) return [];
        return Field.currentMapData.healSprings.filter(s => s && Number.isFinite(Number(s.x)) && Number.isFinite(Number(s.y)));
    },

    drawMapOverlayMarker: (ctx, overlayConfig, x, y, size) => {
        if (!ctx || !overlayConfig || size <= 0) return;
        const marker = Math.max(1, Math.floor(size * 0.62));
        const markerX = Math.floor(x + (size - marker) / 2);
        const markerY = Math.floor(y + (size - marker) / 2);
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = overlayConfig.color || '#fff';
        ctx.fillRect(markerX, markerY, marker, marker);
        ctx.restore();
    },

    getRenderedTileForDraw: (tileX, tileY, mapW, mapH, areaKey) => {
        let nextTile = 'W';
        if (Field.currentMapData) {
            const inBounds = tileX >= 0 && tileX < mapW && tileY >= 0 && tileY < mapH;
            const sourceX = Math.max(0, Math.min(mapW - 1, Number(tileX)));
            const sourceY = Math.max(0, Math.min(mapH - 1, Number(tileY)));
            nextTile = Field.getMapTileAt(Field.currentMapData, sourceX, sourceY, 'W');
            if (inBounds) {
                const posKey = `${tileX},${tileY}`;
                const changeKey = Field.getCurrentMapChangeKey ? Field.getCurrentMapChangeKey(areaKey) : areaKey;
                nextTile = App.data.progress.mapChanges?.[changeKey]?.[posKey] || App.data.progress.mapChanges?.[areaKey]?.[posKey] || Field.getMapTileAt(Field.currentMapData, tileX, tileY);
                if (Field.currentMapData.isFixed) {
                    const progressKey = Field.getCurrentProgressMapKey();
                    if (nextTile === 'B' && typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss) {
                        const bossDef = MapRegistry.findFixedBoss(Field.currentMapData, tileX, tileY);
                        if (Field.isFixedBossDefeatedAt(bossDef, tileX, tileY, progressKey)) nextTile = 'G';
                        else if (!Field.isFixedBossAvailable(bossDef)) nextTile = bossDef?.inactiveTile || 'G';
                    }

                    // 固定MAP/固定ダンジョンの宝箱は、地形文字(C/R)だけでなく chests[] も正本として扱う。
                    // 町の中では床タイル(G/Tなど)の上に宝箱レイヤーを置くため、
                    // エディタが chests[] だけを出力してもゲーム内で表示・調査できるようにする。
                    if (nextTile !== 'B') {
                        const chestDef = Field.getFixedChestAt ? Field.getFixedChestAt(tileX, tileY) : null;
                        const chestTile = Field.getFixedChestTileSign ? Field.getFixedChestTileSign(chestDef) : null;
                        if (chestTile) nextTile = chestTile;
                    }
                }
            }
        } else {
            const worldMap = Field.getActiveWorldMap();
            nextTile = worldMap[((tileY % mapH) + mapH) % mapH][((tileX % mapW) + mapW) % mapW];
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
            const changeKey = Field.getCurrentMapChangeKey ? Field.getCurrentMapChangeKey(areaKey) : areaKey;
            let tile = App.data.progress.mapChanges?.[changeKey]?.[posKey] || App.data.progress.mapChanges?.[areaKey]?.[posKey] || Field.getMapTileAt(Field.currentMapData, x, y);
            tile = String(tile || 'W').toUpperCase();

            if (Field.currentMapData.isFixed) {
                const progressKey = Field.getCurrentProgressMapKey();
                if (tile === 'B' && typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss) {
                    const bossDef = MapRegistry.findFixedBoss(Field.currentMapData, x, y);
                    if (Field.isFixedBossDefeatedAt(bossDef, x, y, progressKey)) tile = 'G';
                    else if (!Field.isFixedBossAvailable(bossDef)) tile = bossDef?.inactiveTile || 'G';
                }
            }

            return { tile, x, y, areaKey, isWorld: false };
        }

        const worldMap = Field.getActiveWorldMap();
        if (!worldMap?.[0]) return null;
        const mapW = worldMap[0].length;
        const mapH = worldMap.length;
        const x = ((Number(Field.x) % mapW) + mapW) % mapW;
        const y = ((Number(Field.y) % mapH) + mapH) % mapH;
        const tile = String(worldMap[y][x] || 'W').toUpperCase();

        return { tile, x, y, areaKey: MapRegistry?.getActiveWorldKey?.() || 'WORLD', isWorld: true };
    },

    // 水没フロアでも船に切り替えるのは水面上だけ。床・足場・階段では通常の主人公を描く。
    isFloodedWaterAt: (x = Field.x, y = Field.y) => {
        if (!Field.currentMapData?.isDungeon || Field.currentMapData?.isFixed || !App.data?.dungeon?.isFloodedFloor) return false;
        const tile = String(Field.currentMapData.tiles?.[Number(y)]?.[Number(x)] || '').toUpperCase();
        const waterTile = typeof Dungeon !== 'undefined' ? Dungeon.floodedTile : '~';
        return tile === String(waterTile || '~').toUpperCase();
    },

    isPlayerOnFloodedWater: () => Field.isFloodedWaterAt(Field.x, Field.y),

    isFixedBossAvailable: (bossDef, options = {}) => {
        if (!bossDef) return false;
        const step = Number(App.data?.progress?.storyStep || 0);
        const sub = Number(App.data?.progress?.subStep || 0);
        const stepMin = bossDef.storyStepMin !== undefined ? Number(bossDef.storyStepMin) : -Infinity;
        const stepMax = bossDef.storyStepMax !== undefined ? Number(bossDef.storyStepMax) : Infinity;
        const subMin = bossDef.storySubMin !== undefined ? Number(bossDef.storySubMin) : -Infinity;
        const subMax = bossDef.storySubMax !== undefined ? Number(bossDef.storySubMax) : Infinity;
        if (step < stepMin || step > stepMax || sub < subMin || sub > subMax) return false;
        const flags = App.data?.progress?.flags || {};
        const requiredFlags = Array.isArray(bossDef.requiredFlags)
            ? bossDef.requiredFlags
            : (bossDef.requiredFlag ? [bossDef.requiredFlag] : []);
        if (!requiredFlags.every(flag => !!flags[flag])) return false;
        const clearedFlags = Array.isArray(bossDef.clearedFlags)
            ? bossDef.clearedFlags
            : (bossDef.clearedFlag ? [bossDef.clearedFlag] : []);
        if (clearedFlags.some(flag => !!flags[flag])) return false;
        if (!bossDef.questId) return true;
        if (!App.isQuestUnlocked(bossDef.questId)) return false;
        if (options.requireAccepted === false) return true;
        return App.getQuestState(bossDef.questId).state === 'accepted';
    },

    // 固定座標の討伐記録とクエスト進捗が食い違う旧セーブを補正する。
    // クエスト受注中かつクエスト側のボス討伐が未達なら、座標側だけに残った
    // defeatedBosses は古い記録とみなし、ボスを復帰させる。
    isFixedBossDefeatedAt: (bossDef, x, y, progressKey = null, options = {}) => {
        const flags = App.data?.progress?.flags || {};
        const clearedFlags = Array.isArray(bossDef?.clearedFlags)
            ? bossDef.clearedFlags
            : (bossDef?.clearedFlag ? [bossDef.clearedFlag] : []);
        if (clearedFlags.some(flag => !!flags[flag])) return true;
        const key = progressKey || Field.getCurrentProgressMapKey?.();
        const posKey = `${Number(x)},${Number(y)}`;
        const defeated = !!(key && App.data?.progress?.defeatedBosses?.[key]?.includes(posKey));
        if (!defeated) return false;

        if (bossDef?.questId) {
            const questState = App.getQuestState(bossDef.questId).state;
            const objectiveComplete = App.isQuestObjectiveComplete(bossDef.questId);
            if (questState === 'accepted' && !objectiveComplete) {
                if (options.repair !== false) {
                    App.data.progress.defeatedBosses[key] = App.data.progress.defeatedBosses[key]
                        .filter(entry => entry !== posKey);
                    App.save();
                }
                return false;
            }
        }
        return true;
    },

    resolveMapActionEventId: (action) => {
        const entries = action?.events;
        if (!Array.isArray(entries) || typeof StoryManager === 'undefined') return null;
        const step = Number(App.data?.progress?.storyStep || 0);
        const sub = Number(App.data?.progress?.subStep || 0);
        const flags = App.data?.progress?.flags || {};
        const match = entries.find(entry => {
            if (!entry || !entry.eventId || entry.default) return false;
            const stepMin = entry.stepMin !== undefined ? Number(entry.stepMin) : -Infinity;
            const stepMax = entry.stepMax !== undefined ? Number(entry.stepMax) : Infinity;
            const subMin = entry.subMin !== undefined ? Number(entry.subMin) : -Infinity;
            const subMax = entry.subMax !== undefined ? Number(entry.subMax) : Infinity;
            const requiredFlags = Array.isArray(entry.requiredFlags)
                ? entry.requiredFlags
                : (entry.requiredFlag ? [entry.requiredFlag] : []);
            const missingFlags = Array.isArray(entry.missingFlags)
                ? entry.missingFlags
                : (entry.missingFlag ? [entry.missingFlag] : []);
            return step >= stepMin && step <= stepMax &&
                sub >= subMin && sub <= subMax &&
                requiredFlags.every(flag => !!flags[flag]) &&
                missingFlags.every(flag => !flags[flag]);
        }) || entries.find(entry => entry?.default && entry.eventId) || null;
        return match?.eventId || null;
    },

    resolveCycledMapActionEventId: (action, advance = false) => {
        const eventIds = Array.isArray(action?.cycleEventIds) ? action.cycleEventIds.filter(Boolean) : [];
        if (!eventIds.length) return null;
        const progress = App.data?.progress;
        if (!progress) return eventIds[0];
        if (!progress.npcTalkCounts || typeof progress.npcTalkCounts !== 'object' || Array.isArray(progress.npcTalkCounts)) {
            progress.npcTalkCounts = {};
        }
        const areaKey = typeof Field.getCurrentAreaKey === 'function' ? Field.getCurrentAreaKey() : 'MAP';
        const key = action.conversationKey || `${areaKey}:${Number(action.x)},${Number(action.y)}`;
        const count = Math.max(0, Math.floor(Number(progress.npcTalkCounts[key]) || 0));
        if (advance) {
            progress.npcTalkCounts[key] = count + 1;
            App.save();
        }
        return eventIds[count % eventIds.length];
    },

    isMapActionAvailable: (action) => {
        if (!action) return false;
        const flags = App.data?.progress?.flags || {};
        const requiredFlags = Array.isArray(action.requiredFlags)
            ? action.requiredFlags
            : (action.requiredFlag ? [action.requiredFlag] : []);
        const missingFlags = Array.isArray(action.missingFlags)
            ? action.missingFlags
            : (action.missingFlag ? [action.missingFlag] : []);
        if (!requiredFlags.every(flag => !!flags[flag]) || !missingFlags.every(flag => !flags[flag])) return false;
        const normalizeItemRequirements = (value) => {
            if (!value) return [];
            const list = Array.isArray(value) ? value : [value];
            return list.map(entry => {
                if (typeof entry === 'number' || typeof entry === 'string') return { id: Number(entry), count: 1 };
                return { id: Number(entry?.id ?? entry?.itemId), count: Math.max(1, Math.floor(Number(entry?.count) || 1)) };
            }).filter(entry => Number.isFinite(entry.id));
        };
        const requiredItems = normalizeItemRequirements(action.requiredItems);
        const missingItems = normalizeItemRequirements(action.missingItems);
        if (!requiredItems.every(entry => Number(App.data?.items?.[entry.id] || 0) >= entry.count)) return false;
        if (!missingItems.every(entry => Number(App.data?.items?.[entry.id] || 0) < entry.count)) return false;
        if (action.requiredStoryStep !== undefined) {
            const step = Number(App.data?.progress?.storyStep || 0);
            const sub = Number(App.data?.progress?.subStep || 0);
            const requiredStep = Number(action.requiredStoryStep);
            const requiredSub = Number(action.requiredSubStep || 0);
            if (!(step > requiredStep || (step === requiredStep && sub >= requiredSub))) return false;
        }
        if (action.hideWhenNoEvent && !Field.resolveMapActionEventId(action)) return false;
        if (action.type === 'quest' && action.questId) {
            const questState = App.getQuestState(action.questId).state;
            if (questState === 'completed') return false;
            if (action.hideWhenQuestAccepted && questState === 'accepted') return false;
            return App.isQuestUnlocked(action.questId);
        }
        if (action.type === 'questBoard') {
            const questIds = Array.isArray(action.questIds) ? action.questIds : [];
            return questIds.some(id => App.getQuestDefinition(id) && App.isQuestUnlocked(id));
        }
        return true;
    },

    isMapActionImageAvailable: (action) => {
        if (!action || !Field.isMapActionAvailable(action)) return false;
        const flags = App.data?.progress?.flags || {};
        const requiredFlags = Array.isArray(action.imageRequiredFlags)
            ? action.imageRequiredFlags
            : (action.imageRequiredFlag ? [action.imageRequiredFlag] : []);
        const missingFlags = Array.isArray(action.imageMissingFlags)
            ? action.imageMissingFlags
            : (action.imageMissingFlag ? [action.imageMissingFlag] : []);
        return requiredFlags.every(flag => !!flags[flag])
            && missingFlags.every(flag => !flags[flag])
            && !!Field.resolveMapActionImageKey(action);
    },

    resolveMapActionImageKey: (action) => {
        if (!action) return null;
        const flags = App.data?.progress?.flags || {};
        const variants = Array.isArray(action.imageVariants) ? action.imageVariants : [];
        const variant = variants.find(entry => {
            if (!entry?.imageKey) return false;
            const required = Array.isArray(entry.requiredFlags)
                ? entry.requiredFlags
                : (entry.requiredFlag ? [entry.requiredFlag] : []);
            const missing = Array.isArray(entry.missingFlags)
                ? entry.missingFlags
                : (entry.missingFlag ? [entry.missingFlag] : []);
            return required.every(flag => !!flags[flag]) && missing.every(flag => !flags[flag]);
        });
        return variant?.imageKey || action.imageKey || null;
    },

    getMapActionOverlayConfig: (tileX = null, tileY = null) => {
        if (!Field.currentMapData || tileX === null || tileY === null || typeof MapRegistry === 'undefined') return null;
        const action = MapRegistry.findMapAction?.(Field.currentMapData, tileX, tileY);
        if (!action || !Field.isMapActionAvailable(action)) return null;
        const hasExplicitImage = !!action.imageKey || (Array.isArray(action.imageVariants) && action.imageVariants.length > 0);
        if (!hasExplicitImage) {
            if (action.suppressEventMarker === true) return null;
            const tileSign = String(Field.currentMapData.tiles?.[Number(tileY)] || '')[Number(tileX)] || 'T';
            const hasPhysicalObject = !!Field.getBlockingObjectAt?.(tileX, tileY)
                || !!Field.getFixedTileOverlayConfig?.(tileSign, tileX, tileY);
            if (hasPhysicalObject) return null;
            return {
                img: 'overlay_event_blue_glimmer',
                color: action.imageColor || '#62d7ff',
                minimapColor: action.minimapColor || '#62d7ff',
                baseTile: action.baseTile || 'T',
                blockingObject: false,
                eventMarker: true,
                drawWidth: Math.max(9, Number(action.markerDrawWidth || 12)),
                drawHeight: Math.max(9, Number(action.markerDrawHeight || 12)),
                suppressShadow: true
            };
        }
        // An explicitly configured image can have its own flag conditions. When
        // those conditions are unmet, keep it hidden instead of substituting a marker.
        if (!Field.isMapActionImageAvailable(action)) return null;
        const imageKey = Field.resolveMapActionImageKey(action);
        return {
            img: imageKey,
            color: action.imageColor || '#d6c8a7',
            minimapColor: action.minimapColor || null,
            baseTile: action.baseTile || 'T',
            blockingObject: action.renderAsBlockingObject === true,
            drawWidth: Math.max(8, Number(action.drawWidth || 32)),
            drawHeight: Math.max(8, Number(action.drawHeight || 32)),
            drawOffsetX: Number(action.drawOffsetX || 0),
            drawOffsetY: Number(action.drawOffsetY || 0),
            buildingScale: Math.max(1, Number(action.buildingScale || 2.4)),
            suppressShadow: action.suppressShadow === true
        };
    },

    isBlockingMapActor: (action) => {
        if (!action || action.blocksMovement === false) return false;
        return Field.isMapActionImageAvailable(action);
    },

    isAdjacentInteractableMapAction: (action) => {
        if (!action || !Field.isMapActionAvailable(action)) return false;
        // Devices such as gate switches are operated from a neighbouring tile.
        // Blocking map actors retain the same adjacent-interaction behaviour for compatibility.
        return action.interactFromAdjacent === true || Field.isBlockingMapActor(action);
    },

    getAdjacentMapActor: () => {
        if (!Field.currentMapData || typeof MapRegistry === 'undefined') return null;
        const directions = {
            0: [0, 1],
            1: [-1, 0],
            2: [1, 0],
            3: [0, -1]
        };
        const facing = directions[Number(Field.dir)] || [0, 1];
        const candidates = [facing, [0, -1], [1, 0], [0, 1], [-1, 0]];
        const seen = new Set();
        for (const [dx, dy] of candidates) {
            const x = Number(Field.x) + dx;
            const y = Number(Field.y) + dy;
            const posKey = `${x},${y}`;
            if (seen.has(posKey)) continue;
            seen.add(posKey);
            if (x < 0 || y < 0 || x >= Field.currentMapData.width || y >= Field.currentMapData.height) continue;
            const action = MapRegistry.findMapActionInteractionCell
                ? MapRegistry.findMapActionInteractionCell(Field.currentMapData, x, y)
                : MapRegistry.findMapAction?.(Field.currentMapData, x, y);
            if (!Field.isAdjacentInteractableMapAction(action)) continue;
            return { x, y, action };
        }
        return null;
    },

    prepareAdjacentMapActorAction: (options = {}) => {
        const actor = Field.getAdjacentMapActor();
        if (!actor) return false;
        App.setAction(actor.action.label || '話す', () => Field.executeMapAction(actor.action));
        return true;
    },

    getAdjacentDungeonAdventurer: () => {
        if (!Field.currentMapData?.isDungeon || typeof Dungeon === 'undefined' || typeof Dungeon.isAdventurerAt !== 'function') return null;
        const directions = { 0: [0, 1], 1: [-1, 0], 2: [1, 0], 3: [0, -1] };
        const facing = directions[Number(Field.dir)] || [0, 1];
        const candidates = [facing, [0, -1], [1, 0], [0, 1], [-1, 0]];
        const seen = new Set();
        for (const [dx, dy] of candidates) {
            const x = Number(Field.x) + dx;
            const y = Number(Field.y) + dy;
            const posKey = `${x},${y}`;
            if (seen.has(posKey)) continue;
            seen.add(posKey);
            if (x < 0 || y < 0 || x >= Field.currentMapData.width || y >= Field.currentMapData.height) continue;
            if (Dungeon.isAdventurerAt(x, y)) return { x, y };
        }
        return null;
    },

    prepareAdjacentDungeonAdventurerAction: (options = {}) => {
        const adventurer = Field.getAdjacentDungeonAdventurer();
        if (!adventurer || typeof Dungeon === 'undefined') return false;
        if (options.silent === false) App.log('冒険者がこちらに気づいた。');
        App.setAction('話す', () => Dungeon.encounterAdventurer({ auto: false }));
        return true;
    },

    getAdjacentChest: () => {
        if (!Field.currentMapData) return null;
        const directions = { 0: [0, 1], 1: [-1, 0], 2: [1, 0], 3: [0, -1] };
        const facing = directions[Number(Field.dir)] || [0, 1];
        const candidates = [facing, [0, -1], [1, 0], [0, 1], [-1, 0]];
        const seen = new Set();
        const mapW = Number(Field.currentMapData.width || 0);
        const mapH = Number(Field.currentMapData.height || 0);
        const areaKey = Field.getCurrentAreaKey();
        for (const [dx, dy] of candidates) {
            const x = Number(Field.x) + dx;
            const y = Number(Field.y) + dy;
            const posKey = `${x},${y}`;
            if (seen.has(posKey)) continue;
            seen.add(posKey);
            if (x < 0 || y < 0 || x >= mapW || y >= mapH) continue;
            const tile = Field.getRenderedTileForDraw(x, y, mapW, mapH, areaKey);
            if (tile === 'C' || tile === 'R') {
                return { x, y, tile, definition: Field.getFixedChestAt ? Field.getFixedChestAt(x, y) : null };
            }
        }
        return null;
    },

    prepareAdjacentChestAction: (options = {}) => {
        const chest = Field.getAdjacentChest();
        if (!chest || typeof Dungeon === 'undefined') return false;
        const opened = Field.currentMapData?.isFixed && Dungeon.isFixedChestOpenedAt(chest.x, chest.y);
        const container = Dungeon.getContainerPresentation
            ? Dungeon.getContainerPresentation(chest.definition)
            : { closed: '宝箱がある。', opened: '開いたままの空箱がある。', action: '調べる' };
        if (options.silent === false) {
            App.log(opened
                ? container.opened
                : (chest.tile === 'R' ? '赤い宝箱がある。' : container.closed));
        }
        App.setAction(container.action, () => Dungeon.openChest(chest.x, chest.y, chest.tile === 'R' ? 'rare' : 'normal'));
        return true;
    },

    getAdjacentFixedBoss: () => {
        if (!Field.currentMapData?.isFixed || typeof MapRegistry === 'undefined') return null;
        const directions = {
            0: [0, 1],
            1: [-1, 0],
            2: [1, 0],
            3: [0, -1]
        };
        const facing = directions[Number(Field.dir)] || [0, 1];
        const candidates = [
            facing,
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0]
        ];
        const seen = new Set();
        const progressKey = Field.getCurrentProgressMapKey();
        for (const [dx, dy] of candidates) {
            const x = Number(Field.x) + dx;
            const y = Number(Field.y) + dy;
            const posKey = `${x},${y}`;
            if (seen.has(posKey)) continue;
            seen.add(posKey);
            if (x < 0 || y < 0 || x >= Field.currentMapData.width || y >= Field.currentMapData.height) continue;
            const tile = String(Field.getMapTileAt(Field.currentMapData, x, y, '')).toUpperCase();
            if (tile !== 'B') continue;
            const bossDef = MapRegistry.findFixedBoss?.(Field.currentMapData, x, y);
            if (Field.isFixedBossDefeatedAt(bossDef, x, y, progressKey)) continue;
            if (!Field.isFixedBossAvailable(bossDef)) continue;
            return { x, y, bossDef };
        }
        return null;
    },

    getAdjacentAbyssBoss: () => {
        if (!Field.currentMapData?.isDungeon || Field.currentMapData?.isFixed) return null;
        if (Field.getCurrentAreaKey?.() !== 'ABYSS') return null;
        if (typeof Dungeon === 'undefined' || typeof Dungeon.isAbyssBossAt !== 'function') return null;
        const directions = {
            0: [0, 1],
            1: [-1, 0],
            2: [1, 0],
            3: [0, -1]
        };
        const [dx, dy] = directions[Number(Field.dir)] || [0, 1];
        const x = Number(Field.x) + dx;
        const y = Number(Field.y) + dy;
        if (x < 0 || y < 0 || x >= Field.currentMapData.width || y >= Field.currentMapData.height) return null;
        return Dungeon.isAbyssBossAt(x, y) ? { x, y } : null;
    },

    getSwitchGateActions: (gateId = null) => {
        if (!Field.currentMapData?.isFixed) return [];
        const actions = Array.isArray(Field.currentMapData.mapActions) ? Field.currentMapData.mapActions : [];
        return actions.filter(action => action?.type === 'switchGate'
            && (gateId === null || String(action.gateId || 'gate') === String(gateId)));
    },

    applyCompletedSwitchGateState: (gateId, gateState, options = {}) => {
        if (!Field.currentMapData?.isFixed || !gateState?.completed) return false;
        const progress = App.data.progress || (App.data.progress = {});
        const areaKey = Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area;
        const mapKey = Field.getCurrentProgressMapKey ? Field.getCurrentProgressMapKey() : areaKey;
        const changeKey = Field.getCurrentMapChangeKey ? Field.getCurrentMapChangeKey(areaKey) : mapKey;
        const actions = Field.getSwitchGateActions(gateId);
        if (!actions.length) return false;
        if (!progress.mapChanges) progress.mapChanges = {};
        if (!progress.mapChanges[changeKey]) progress.mapChanges[changeKey] = {};
        let changed = false;
        const applied = [];
        const seen = new Set();
        actions.flatMap(action => Array.isArray(action.opens) ? action.opens : []).forEach(open => {
            if (!open) return;
            const x = Number(open.x);
            const y = Number(open.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const key = `${x},${y}`;
            if (seen.has(key)) return;
            seen.add(key);
            const tile = open.tile || 'T';
            if (progress.mapChanges[changeKey][key] !== tile) {
                progress.mapChanges[changeKey][key] = tile;
                changed = true;
            }
            applied.push(key);
        });
        gateState.appliedMapChangeKey = changeKey;
        gateState.appliedOpenKeys = applied;
        gateState.lastRestoredAt = Date.now();
        if (changed && options.save === true && typeof App.save === 'function') App.save();
        return changed;
    },

    restoreCompletedSwitchGates: (options = {}) => {
        if (!Field.currentMapData?.isFixed) return false;
        const progress = App.data.progress || (App.data.progress = {});
        if (!progress.mapSwitches || typeof progress.mapSwitches !== 'object') return false;
        const areaKey = Field.getCurrentAreaKey ? Field.getCurrentAreaKey() : App.data?.location?.area;
        const mapKey = Field.getCurrentProgressMapKey ? Field.getCurrentProgressMapKey() : areaKey;
        const sourceKeys = [...new Set([mapKey, areaKey, Field.currentMapData?.areaKey, Field.currentMapData?.canonicalAreaKey].filter(Boolean))];
        let changed = false;
        let canonical = progress.mapSwitches[mapKey];
        if (!canonical || typeof canonical !== 'object' || Array.isArray(canonical)) {
            canonical = progress.mapSwitches[mapKey] = {};
        }
        sourceKeys.forEach(sourceKey => {
            const source = progress.mapSwitches[sourceKey];
            if (!source || typeof source !== 'object' || Array.isArray(source)) return;
            Object.entries(source).forEach(([gateId, gateState]) => {
                if (!gateState || typeof gateState !== 'object') return;
                if (!canonical[gateId]) canonical[gateId] = gateState;
                else if (canonical[gateId] !== gateState) {
                    canonical[gateId].pressed = { ...(gateState.pressed || {}), ...(canonical[gateId].pressed || {}) };
                    canonical[gateId].completed = !!(canonical[gateId].completed || gateState.completed);
                }
            });
        });
        Object.entries(canonical).forEach(([gateId, gateState]) => {
            if (gateState?.completed) changed = Field.applyCompletedSwitchGateState(gateId, gateState) || changed;
        });
        if (changed && options.save === true && typeof App.save === 'function') App.save();
        return changed;
    },

    activateSwitchGate: (action) => {
        if (!action || !Field.currentMapData?.isFixed) return false;
        const progress = App.data.progress || (App.data.progress = {});
        const mapKey = Field.getCurrentProgressMapKey ? Field.getCurrentProgressMapKey() : Field.getCurrentAreaKey();
        const gateId = action.gateId || 'gate';
        const switchId = action.switchId || `${Number(action.x)},${Number(action.y)}`;
        if (!progress.mapSwitches) progress.mapSwitches = {};
        if (!progress.mapSwitches[mapKey]) progress.mapSwitches[mapKey] = {};
        const gateState = progress.mapSwitches[mapKey][gateId] || (progress.mapSwitches[mapKey][gateId] = { pressed: {}, completed: false });
        if (gateState.completed) {
            Field.applyCompletedSwitchGateState(gateId, gateState, { save: true });
            Field.refreshVisualState?.();
            App.log(action.completedMessage || 'すでに仕掛けは作動している。');
            return true;
        }
        if (gateState.pressed[switchId]) {
            App.log(action.pressedMessage || 'このスイッチはすでに入っている。');
            return true;
        }

        gateState.pressed[switchId] = true;
        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('switch');
        const required = Array.isArray(action.requiredSwitches) && action.requiredSwitches.length
            ? action.requiredSwitches.map(String)
            : (Field.currentMapData.mapActions || [])
                .filter(a => a && a.type === 'switchGate' && (a.gateId || 'gate') === gateId)
                .map(a => String(a.switchId || `${Number(a.x)},${Number(a.y)}`));
        const allPressed = required.length === 0 || required.every(id => !!gateState.pressed[id]);
        if (!allPressed) {
            App.log(action.partialMessage || 'どこかで仕掛けが動く音がした。');
            App.save();
            Field.render?.();
            return true;
        }

        gateState.completed = true;
        Field.applyCompletedSwitchGateState(gateId, gateState);
        App.log(action.openMessage || '仕掛けが作動し、道が開いた。');
        App.save();
        Field.render?.();
        Field.refreshCurrentAction?.({ silent: true });
        return true;
    },

    getLastFixedBossEventPosition: () => {
        const last = App.data?.progress?.lastFixedBossEvent || null;
        const p = last?.position || null;
        if (Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y))) return { x: Number(p.x), y: Number(p.y) };
        return { x: Number(Field.x), y: Number(Field.y) - 1 };
    },

    getMonsterMapSpriteKey: (monsterId) => {
        const id = Number(monsterId);
        if (!Number.isFinite(id)) return null;
        const directKey = window.PRISMA_ASSETS?.ensureMonsterGraphic?.(id)
            || ((typeof MonsterData !== 'undefined' && typeof MonsterData.getImageKey === 'function')
                ? MonsterData.getImageKey(id)
                : (window.PRISMA_ASSETS?.getMonsterGraphicKey?.(id) || `monster_${id}`));
        if (directKey && typeof GRAPHICS !== 'undefined' && GRAPHICS.data?.[directKey]) return directKey;
        const compatKey = `overlay_boss_${id}`;
        if (typeof GRAPHICS !== 'undefined' && GRAPHICS.data?.[compatKey]) return compatKey;
        return directKey;
    },

    getMonsterMapSpriteSrc: (monsterId) => {
        const byId = (typeof MonsterData !== 'undefined' && typeof MonsterData.getImagePath === 'function')
            ? MonsterData.getImagePath(monsterId)
            : window.PRISMA_ASSETS?.getMonsterImagePath?.(monsterId);
        if (byId) return byId;
        const key = Field.getMonsterMapSpriteKey ? Field.getMonsterMapSpriteKey(monsterId) : null;
        return key && typeof GRAPHICS !== 'undefined' ? (GRAPHICS.data?.[key] || null) : null;
    },

    ensureFieldVisualLayer: () => {
        let layer = document.getElementById('field-visual-cutscene-layer');
        const wrapper = document.getElementById('canvas-wrapper') || document.getElementById('field-scene') || document.getElementById('game-container') || document.body;
        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'field-visual-cutscene-layer';
            // フィールド演出用の表示レイヤー。
            // 重要：レナード等の演出用スプライトは会話中も画面に残すが、
            // レイヤー自体がタップを奪うと会話送りができなくなる。
            // そのため通常時は pointer-events:none とし、実際に演出コマンドを
            // 実行している短時間だけ story.js 側の演出実行処理で auto に切り替える。
            layer.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:2500; overflow:hidden; display:block;';
            if (wrapper && wrapper.style && getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
            wrapper.appendChild(layer);
        } else {
            layer.style.pointerEvents = 'none';
        }
        return layer;
    },

    getFieldVisualTileStyle: (tile, sizeTiles = 2) => {
        const wrapper = document.getElementById('canvas-wrapper') || document.getElementById('field-scene') || document.body;
        const canvas = document.getElementById('field-canvas');
        const wrapperRect = wrapper.getBoundingClientRect ? wrapper.getBoundingClientRect() : { left: 0, top: 0, width: 320, height: 320 };
        const canvasRect = canvas?.getBoundingClientRect ? canvas.getBoundingClientRect() : wrapperRect;
        const scaleX = canvas ? (canvasRect.width / Math.max(1, canvas.width || 320)) : 1;
        const scaleY = canvas ? (canvasRect.height / Math.max(1, canvas.height || 320)) : 1;
        const dx = (Number(tile.x) - Number(Field.x)) * 32 * scaleX;
        const dy = (Number(tile.y) - Number(Field.y)) * 32 * scaleY;
        const left = (canvasRect.left - wrapperRect.left) + (canvasRect.width / 2) + dx;
        const top = (canvasRect.top - wrapperRect.top) + (canvasRect.height / 2) + dy;
        const w = Math.max(32, 32 * Number(sizeTiles || 2) * scaleX);
        const h = Math.max(32, 32 * Number(sizeTiles || 2) * scaleY);
        return `position:absolute; left:${left}px; top:${top}px; width:${w}px; height:${h}px; transform:translate(-50%, -50%); image-rendering:pixelated; object-fit:contain;`;
    },

    putFieldVisualSprite: (id, src, tile, sizeTiles = 2, extraCss = '') => {
        const layer = Field.ensureFieldVisualLayer();
        let img = document.getElementById(id);
        if (!img) {
            img = document.createElement('img');
            img.id = id;
            img.draggable = false;
            layer.appendChild(img);
        }
        img.src = src;
        img.dataset.tileX = String(Number(tile.x));
        img.dataset.tileY = String(Number(tile.y));
        img.dataset.sizeTiles = String(Number(sizeTiles || 2));
        img.style.cssText = Field.getFieldVisualTileStyle(tile, sizeTiles) + (extraCss || '');
        return img;
    },

    setStoryUiCutsceneHidden: (hidden) => {
        const overlay = document.getElementById('story-ui-overlay');
        if (!overlay) return;
        if (hidden) {
            overlay.dataset.cutsceneDisplay = overlay.style.display || '';
            overlay.style.display = 'none';
        } else if (overlay.dataset.cutsceneDisplay !== undefined) {
            overlay.style.display = overlay.dataset.cutsceneDisplay || 'flex';
            delete overlay.dataset.cutsceneDisplay;
        }
    },

    fadeFieldVisualBlackout: async (holdMs = 160) => {
        const layer = Field.ensureFieldVisualLayer();
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        let blackout = document.getElementById('field-visual-blackout');
        if (!blackout) {
            blackout = document.createElement('div');
            blackout.id = 'field-visual-blackout';
            blackout.style.cssText = 'position:absolute; inset:0; background:#000; opacity:0; transition:opacity 90ms ease; pointer-events:none; z-index:1;';
            layer.appendChild(blackout);
        }
        blackout.style.opacity = '1';
        await wait(holdMs);
        blackout.style.opacity = '0';
        await wait(110);
        blackout.remove();
    },

    resolveFieldCutsceneTile: (cmd, anchor) => {
        const base = cmd?.base === 'player' ? { x: Field.x, y: Field.y } : (anchor || Field.getLastFixedBossEventPosition());
        return {
            x: Number(cmd?.x ?? base.x) + Number(cmd?.dx || 0),
            y: Number(cmd?.y ?? base.y) + Number(cmd?.dy || 0)
        };
    },

    resolveFieldCutsceneSrc: (cmd) => {
        if (cmd?.src) return cmd.src;
        if (cmd?.monsterId !== undefined) return Field.getMonsterMapSpriteSrc(cmd.monsterId);
        if (cmd?.effect === 'slash') return 'assets/effect/fx_phys_neutral_slash.png';
        return '';
    },

    // フィールド演出の「何を表示し、どう動かすか」は story.js 側で管理する。
    // main.js には、表示レイヤー・画像配置・座標変換などの低レベル描画補助だけを残す。

    executeMapAction: (action) => {
        if (!action) return;

        // map.js の mapActions で requiredItemId を指定すると、所持時のみ実行する。
        // 例: 朽ちた祠の石碑は「災厄の楔」所持時だけ隠しボス戦へ進む。
        if (action.requiredItemId !== undefined && typeof App.hasItem === 'function' && !App.hasItem(action.requiredItemId)) {
            const msg = action.requiredItemMissingText || '今は何も起こらないようだ。';
            App.log(msg);
            return;
        }

        if (action.requiredStoryStep !== undefined) {
            const step = Number(App.data?.progress?.storyStep || 0);
            const sub = Number(App.data?.progress?.subStep || 0);
            const requiredStep = Number(action.requiredStoryStep);
            const requiredSub = Number(action.requiredSubStep || 0);
            const reached = step > requiredStep || (step === requiredStep && sub >= requiredSub);
            if (!reached) {
                App.log(action.requiredStoryMissingText || '今はまだ先へ進む理由が見つからない。');
                return;
            }
        }

        const requiredFlags = Array.isArray(action.requiredFlags)
            ? action.requiredFlags
            : (action.requiredFlag ? [action.requiredFlag] : []);
        const missingFlags = Array.isArray(action.missingFlags)
            ? action.missingFlags
            : (action.missingFlag ? [action.missingFlag] : []);
        if (requiredFlags.length || missingFlags.length) {
            const flags = App.data?.progress?.flags || {};
            const flagsOk = requiredFlags.every(flag => !!flags[flag]) && missingFlags.every(flag => !flags[flag]);
            if (!flagsOk) {
                App.log(action.lockedText || action.lockedLog || '今はまだ使えないようだ。');
                return;
            }
        }

        if (action.type === 'switchGate') {
            Field.activateSwitchGate(action);
            return;
        }

        if (action.type === 'elementalTrialPrism') {
            const progress = App.ensureAbyssRegionProgress();
            const elements = Array.isArray(action.elements) ? action.elements : [];
            const nextElement = elements.find(element => !progress.abyssSpiritBlessings[element]);
            if (!nextElement) {
                App.log(action.completedText || '六つのプリズムは、認めた者へ穏やかな光を返している。');
                return;
            }
            const bossId = Number(action.bossByElement?.[nextElement]);
            if (!bossId) {
                App.log('プリズムは沈黙している。');
                return;
            }
            App.data.battle = {
                active: false,
                isBossBattle: true,
                isSpecialBoss: false,
                isEstark: false,
                fixedBossId: bossId,
                abyssSpiritElement: nextElement,
                fixedTrialElement: nextElement,
                fixedTrialRewardItemId: Number(action.rewardItemByElement?.[nextElement] || 0),
                fixedTrialCompletionItemId: Number(action.completionItemId || 0),
                fixedTrialRequiredElements: (Array.isArray(action.requiredElements) ? action.requiredElements : elements).slice(),
                bossStatMultiplier: Number(action.bossStatMultiplier || 1),
                suppressFixedBossDefeat: true,
                enemies: []
            };
            App.save();
            App.changeScene('battle');
            return;
        }

        if (action.log && action.type !== 'quest' && action.type !== 'questBoard' && action.type !== 'guildBoard') App.log(action.log);

        const progressEventId = Field.resolveMapActionEventId(action);
        if (progressEventId && typeof StoryManager !== 'undefined') {
            StoryManager.executeEvent(progressEventId);
            return;
        }

        const cycledEventId = Field.resolveCycledMapActionEventId(action, true);
        if (cycledEventId && typeof StoryManager !== 'undefined') {
            StoryManager.executeEvent(cycledEventId);
            return;
        }

        if (action.type === 'fixedMap' && action.target && typeof Field.enterFixedMap === 'function') {
            Field.enterFixedMap(action.target, {
                entryKey: action.entryKey || null,
                returnPoint: action.returnPoint || {
                    areaKey: Field.getCurrentAreaKey?.() || App.data.location.area,
                    x: Number(action.returnX ?? Field.x),
                    y: Number(action.returnY ?? Field.y)
                }
            });
            return;
        }

        if (action.type === 'returnPortal') {
            const fallbackAreaKey = action.fallbackAreaKey || 'WORLD';
            const saved = action.useSavedReturnPoint === false ? null : App.data.mapReturnPoint;
            const target = saved?.areaKey
                ? saved
                : {
                    areaKey: fallbackAreaKey,
                    worldKey: action.fallbackWorldKey || STORY_DATA?.areas?.[fallbackAreaKey]?.worldKey || 'WORLD',
                    x: action.fallbackX,
                    y: action.fallbackY
                };
            const fixedDef = target.mapData || (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[target.areaKey]
                ? { ...FIXED_MAPS[target.areaKey], isFixed: true, isDungeon: FIXED_MAPS[target.areaKey].isDungeon === true, areaKey: target.areaKey }
                : null);
            App.data.mapReturnPoint = null;
            App.data.transportMode = null;
            App.data.location.area = target.areaKey || 'WORLD';
            App.data.location.worldKey = target.worldKey || STORY_DATA?.areas?.[target.areaKey]?.worldKey || 'WORLD';
            Field.currentMapData = fixedDef;
            const entryPoint = fixedDef?.entryPoint || { x: 0, y: 0 };
            Field.x = Number.isFinite(Number(target.x)) ? Number(target.x) : Number(entryPoint.x);
            Field.y = Number.isFinite(Number(target.y)) ? Number(target.y) : Number(entryPoint.y);
            App.data.location.x = Field.x;
            App.data.location.y = Field.y;
            App.save();
            App.changeScene('field');
            Field.render?.();
            Field.refreshCurrentAction?.({ silent: true });
            return;
        }

        if (action.type === 'fixedDungeon' && action.target && typeof Dungeon !== 'undefined' && Dungeon.startFixed) {
            if (action.setFlagOnUse) {
                App.data.progress = App.data.progress || {};
                App.data.progress.flags = App.data.progress.flags || {};
                App.data.progress.flags[action.setFlagOnUse] = true;
            }
            if (action.log) App.log(action.log);
            App.save();
            Dungeon.startFixed(action.target);
            return;
        }

        if (action.type === 'abyssDungeon' && typeof Dungeon !== 'undefined') {
            if (!App.requireFeatureUnlocked('abyss')) return;
            if (action.target && typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[action.target]) {
                Field.enterFixedMap(action.target);
            } else {
                Dungeon.enter();
            }
            return;
        }

        if (action.type === 'storyEvent' && action.eventId && typeof StoryManager !== 'undefined') {
            StoryManager.executeEvent(action.eventId);
            return;
        }

        if (action.type === 'questBoard' && typeof App.runQuestBoard === 'function') {
            if (action.log) App.log(action.log);
            Promise.resolve(App.runQuestBoard(action)).finally(() => {
                Field.refreshVisualState?.();
                Field.refreshCurrentAction?.({ silent: true });
            });
            return;
        }

        if (action.type === 'quest' && action.questId && typeof App.runQuestAction === 'function') {
            Promise.resolve(App.runQuestAction(action.questId, { complete: !!action.complete, lockedText: action.lockedText }))
                .finally(() => {
                    // 受注を境に立ち去る同行NPCは、会話終了と同じフレームで
                    // 画像・当たり判定・アクションをまとめて再評価する。
                    // render() だけではPhaserの静的署名が変わらず、NPC画像が次の一歩まで
                    // 残るため、静的オブジェクト層を明示的に再構築する。
                    if (typeof Field.refreshVisualState === 'function') Field.refreshVisualState();
                    else Field.render();
                    Field.refreshCurrentAction?.({ silent: true });
                });
            return;
        }

        if (action.type === 'shop' && typeof Facilities !== 'undefined' && typeof Facilities.openShopFromField === 'function') {
            Facilities.openShopFromField(action);
            return;
        }

        if (action.type === 'alchemy' && typeof Alchemy !== 'undefined' && typeof Alchemy.openFromField === 'function') {
            Alchemy.openFromField(action);
            return;
        }

        if (action.type === 'blacksmith' && typeof MenuBlacksmith !== 'undefined' && typeof MenuBlacksmith.openFromField === 'function') {
            MenuBlacksmith.openFromField(action);
            return;
        }

        if (action.type === 'guild' && typeof Guild !== 'undefined') {
            App.changeScene('guild');
            return;
        }

        if (action.type === 'guildBoard' && typeof Guild !== 'undefined') {
            if (action.log) App.log(action.log);
            Guild.openBoard();
            return;
        }

        if (action.type === 'freeRest' && typeof Guild !== 'undefined') {
            Guild.freeRest();
            return;
        }

        if (action.type === 'inn') {
            App.changeScene('inn');
            return;
        }

        if (action.type === 'limitBreakTrial' && typeof App.startLimitBreakTrial === 'function') {
            App.startLimitBreakTrial(action);
            return;
        }

        if (action.type === 'boss') {
            const startBossBattle = () => {
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
            };
            if (action.confirmText && typeof Menu !== 'undefined' && typeof Menu.confirm === 'function') {
                Menu.confirm(action.confirmText, startBossBattle);
                return;
            }
            startBossBattle();
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
            if (Field.isTileImpassableForCurrentMap(tile)) return false;

            const adjacentBoss = Field.getAdjacentFixedBoss();
            if (adjacentBoss && typeof Dungeon !== 'undefined' && typeof Dungeon.prepareFixedTileAction === 'function') {
                return Dungeon.prepareFixedTileAction('B', adjacentBoss.x, adjacentBoss.y, { silent });
            }
            const adjacentAbyssBoss = Field.getAdjacentAbyssBoss ? Field.getAdjacentAbyssBoss() : null;
            if (adjacentAbyssBoss && typeof Dungeon !== 'undefined' && typeof Dungeon.prepareAbyssBossTileAction === 'function') {
                return Dungeon.prepareAbyssBossTileAction(adjacentAbyssBoss.x, adjacentAbyssBoss.y, { silent });
            }
            if (Field.prepareAdjacentMapActorAction({ silent })) return true;
            if (Field.prepareAdjacentDungeonAdventurerAction({ silent })) return true;
            if (Field.prepareAdjacentChestAction({ silent })) return true;

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

            if (typeof Dungeon !== 'undefined' && typeof Dungeon.isTrialAngelAt === 'function' && Dungeon.isTrialAngelAt(x, y)) {
                const angel = App.data?.dungeon?.trialAngel;
                logIfNeeded(angel?.log || '試練の天使が静かに待っている。');
                App.setAction(angel?.label || '試練に挑む', () => Dungeon.startAngelTrial(angel));
                return true;
            }

            if (!Field.currentMapData.isDungeon) {
                const mapAction = (typeof MapRegistry !== 'undefined' && MapRegistry.findMapAction)
                    ? MapRegistry.findMapAction(Field.currentMapData, x, y)
                    : null;
                if (mapAction) {
                    if (!Field.isMapActionAvailable(mapAction)) return false;
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
                    App.setAction('カジノに入る', () => App.changeScene('casino'));
                } else if (tile === 'E') {
                    logIfNeeded('交換所のようだ。');
                    App.setAction('メダル交換', () => App.changeScene('medal'));
                }
            } else if (Field.currentMapData.isFixed && typeof Dungeon !== 'undefined' && typeof Dungeon.prepareFixedTileAction === 'function') {
                const fixedMapAction = (typeof MapRegistry !== 'undefined' && MapRegistry.findMapAction)
                    ? MapRegistry.findMapAction(Field.currentMapData, x, y)
                    : null;
                if (fixedMapAction) {
                    if (!Field.isMapActionAvailable(fixedMapAction)) return false;
                    if (fixedMapAction.log) logIfNeeded(fixedMapAction.log);
                    App.setAction(fixedMapAction.label || '調べる', () => Field.executeMapAction(fixedMapAction));
                    return true;
                }
                const effect = Field.getRuntimeTileEffectAt ? Field.getRuntimeTileEffectAt(x, y) : null;
                if (effect && effect.type === 'angel' && typeof Dungeon !== 'undefined' && typeof Dungeon.startAngelTrial === 'function') {
                    logIfNeeded(effect.log || '淡い光をまとった天使がいる。');
                    App.setAction(effect.label || '試練に挑む', () => Dungeon.startAngelTrial(effect));
                    return true;
                }
                if (Dungeon.prepareFixedTileAction(tile, x, y, { silent })) return true;
            }

            if (tile === 'V' || tile === 'H' || tile === 'A' || tile === 'J' || tile === 'R' || tile === 'B') {
                logIfNeeded('何か気になるものがある。');
            }

            if (tile === 'B' && Field.currentMapData.isFixed && Field.currentMapData.isDungeon && !App.pendingAction && typeof Dungeon !== 'undefined' && typeof Dungeon.prepareFixedTileAction === 'function') {
                Dungeon.prepareFixedTileAction(tile, x, y, { silent });
            }

            return !!App.pendingAction;
        }

        if (typeof App.isFlying === 'function' && App.isFlying()) return false;

        let targetAreaKey = null;
        let targetEntryKey = null;
        let targetEntryLabel = null;
        if (typeof MapRegistry !== 'undefined' && typeof MapRegistry.getWorldAreaAt === 'function') {
            const entry = MapRegistry.getWorldAreaAt(x, y);
            targetAreaKey = entry ? entry[0] : null;
            targetEntryKey = entry?.[1]?._entryKey || null;
            targetEntryLabel = entry?.[1]?._entryLabel || null;
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
            App.setAction(`${areaDef.name}に入る`, () => {
                const flags = App.data?.progress?.flags || {};
                const storyArea = (typeof STORY_DATA !== 'undefined' && STORY_DATA.areas) ? STORY_DATA.areas[targetAreaKey] : null;
                const entranceDef = Array.isArray(storyArea?.entrances)
                    ? storyArea.entrances.find(entry => (entry.entryKey || null) === (targetEntryKey || null))
                    : null;
                const requiredFlags = [storyArea?.entryRequiredFlag, entranceDef?.requiredFlag].filter(Boolean);
                if (requiredFlags.some(flag => !flags[flag])) {
                    App.log(entranceDef?.lockedText || storyArea?.entryLockedText || '結界に阻まれ、今は入れない。');
                    return;
                }
                Field.enterFixedMap(targetAreaKey, { entryKey: targetEntryKey || null });
            });
        } else if (targetAreaKey && typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[targetAreaKey]) {
            const areaDef = FIXED_DUNGEON_MAPS[targetAreaKey];
            const labelPrefix = targetEntryLabel ? `${areaDef.name}・${targetEntryLabel}` : areaDef.name;
            App.setAction(`${labelPrefix}に入る`, () => {
                const flags = App.data?.progress?.flags || {};
                const bypassFlags = Array.isArray(areaDef.entryBypassFlags) ? areaDef.entryBypassFlags : [];
                const bypassedEntryLock = bypassFlags.some(flag => !!flags[flag]);
                const entryLockEntrances = Array.isArray(areaDef.entryRequiredEntrances) ? areaDef.entryRequiredEntrances : null;
                const effectiveEntryKey = targetEntryKey || areaDef.defaultEntryKey || null;
                const entryLockApplies = !entryLockEntrances || entryLockEntrances.includes(effectiveEntryKey);
                const missingRequiredFlag = !!areaDef.entryRequiredFlag && !flags[areaDef.entryRequiredFlag];
                const missingRequiredAlly = areaDef.entryRequiredAllyId !== undefined
                    && !(typeof App.hasStoryAlly === 'function' && App.hasStoryAlly(areaDef.entryRequiredAllyId));
                if (entryLockApplies && (missingRequiredFlag || missingRequiredAlly) && !bypassedEntryLock) {
                    if (areaDef.entryLockedEventId && typeof StoryManager !== 'undefined' && typeof StoryManager.executeEvent === 'function') {
                        StoryManager.executeEvent(areaDef.entryLockedEventId);
                    } else {
                        App.log(areaDef.entryLockedText || '今はまだ、この場所へ入る理由がない。');
                    }
                    return;
                }
                if (targetAreaKey === 'THUNDER_FORT' && targetEntryKey === 'east' && !flags.thunderFortCleared) {
                    App.log('雷の要塞の東門は、内側から雷の結界で閉ざされている。西門側から制御炉を止めれば開きそうだ。');
                    return;
                }
                if (areaDef.entryEventId && typeof StoryManager !== 'undefined') {
                    const currentStoryStep = Number(App.data?.progress?.storyStep || 0);
                    const entryEventStageMatches = areaDef.entryEventStoryStep === undefined ||
                        currentStoryStep === Number(areaDef.entryEventStoryStep);
                    const enteredFlag = targetAreaKey === 'FOREST_WIND_HOLE'
                        ? 'forestWindHoleEntered'
                        : targetAreaKey === 'CRENA_LIMESTONE_CAVE'
                            ? 'crenaCaveEntered'
                            : null;
                    if (entryEventStageMatches && (!enteredFlag || !flags[enteredFlag])) {
                        StoryManager.executeEvent(areaDef.entryEventId);
                        return;
                    }
                }
                Dungeon.startFixed(targetAreaKey, { entryKey: targetEntryKey || null });
            });
        } else if (tile === 'I' || tile === 'B') {
                logIfNeeded('小さな休憩所がある。');
                App.setAction('休む', () => App.changeScene('inn'));
        } else if (tile === 'E') {
            App.setAction('メダル交換', () => App.changeScene('medal'));
        } else if (tile === 'K') {
            App.setAction('カジノに入る', () => App.changeScene('casino'));
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

    getDungeonWallFaceThemeForDraw: () => {
        const usesWallFaces = Field.currentMapData?.isDungeon || Field.currentMapData?.useDungeonWallFace === true;
        if (!usesWallFaces || typeof DUNGEON_WALL_FACE_THEMES === 'undefined') return null;
        const themeKey = String(Field.currentMapData.themeKey || 'DEFAULT').toUpperCase();
        return DUNGEON_WALL_FACE_THEMES[themeKey] || null;
    },

    getDungeonWallFaceModeForDraw: () => {
        const theme = Field.getDungeonWallFaceThemeForDraw();
        return Field.currentMapData?.wallFaceMode || theme?.mode || 'replace';
    },

    getDungeonWallGraphicForDraw: (tileX, tileY, upper, mapW, mapH, areaKey) => {
        const usesWallFaces = Field.currentMapData?.isDungeon || Field.currentMapData?.useDungeonWallFace === true;
        if (!usesWallFaces || upper !== 'W') return null;

        const sharedWallTile = Field.getTileConfigForDraw
            ? Field.getTileConfigForDraw('W', tileX, tileY)
            : Field.getTileConfig('W');
        const sharedWallFaceTheme = Field.getDungeonWallFaceThemeForDraw() || {};
        return window.MapRenderShared.wallFacePlan({
            map: { ...Field.currentMapData, wallFaceTheme: sharedWallFaceTheme },
            theme: { W: sharedWallTile },
            x: tileX,
            y: tileY,
            upper,
            entityType: 'dungeon',
            tileAtFn: (x, y) => Field.getRenderedTileForDraw(x, y, mapW, mapH, areaKey)
        })?.key || null;

        /* Legacy duplicated resolver retained only as migration context.

        // 水系ダンジョンの W は壁ではなく、下層に敷くアニメーション水面。
        const wallTile = Field.getTileConfigForDraw
            ? Field.getTileConfigForDraw('W', tileX, tileY)
            : Field.getTileConfig('W');
        if (wallTile?.lowerLayer === true || wallTile?.animatedWater === true) return null;

        const theme = Field.getDungeonWallFaceThemeForDraw();
        if (theme?.disabled) return null;

        const baseImg = Field.currentMapData.wallFaceImg || theme?.img || null;
        if (!baseImg) return null;

        // 通行面の直上にある W 列だけを露出壁面として描く。
        if (Field.getRenderedTileForDraw(tileX, tileY + 1, mapW, mapH, areaKey) === 'W') return null;

        const accentImg = Field.currentMapData.wallFaceTorchImg || theme?.accentImg || null;
        const accentEvery = Math.max(1, Number(theme?.accentEvery || 5) || 5);
        const useAccent = !!accentImg && (((tileX % accentEvery) + accentEvery) % accentEvery) === 0;
        return useAccent ? accentImg : baseImg;
        */
    },
    
    getBattleBg: () => {
        const battleData = App.data?.battle || {};
        if (battleData.battleBg) return battleData.battleBg;
        const currentFloor = Math.max(0, Number(App.data?.progress?.floor || 0));
        const isAbyssBoss = App.data?.location?.area === 'ABYSS' && battleData.isBossBattle && !battleData.isRiftBattle;
        if (isAbyssBoss && globalThis.ABYSS_FLOOR_RULES?.getBalanceFloor?.(currentFloor, App.data?.battle?.abyssMode || App.data?.dungeon?.abyssMode) === 200) return 'battle_bg_abyss_floor_200';
        if (isAbyssBoss) return 'battle_bg_abyss_boss';
        if (battleData.isSpecialBoss || battleData.isEstark) return 'battle_bg_lastboss';
        if (battleData.encounterType === 'sea') return 'battle_bg_sea';
        if (Field.currentMapData) {
            if (Field.currentMapData.isDungeon && App.data?.dungeon?.isLavaFloor &&
                !(typeof Dungeon !== 'undefined' && Dungeon.isRandomVisualThemeTestOverrideActive?.(Dungeon.floor))) return 'battle_bg_fire';
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
                const floor = App.data.progress.floor || 0;
                const genType = App.data.dungeon.genType;
                if (floor % 10 === 0) return 'battle_bg_boss'; 
                if (genType === 2) return 'battle_bg_maze';     
                return 'battle_bg_dungeon';
            }
            return 'battle_bg_field';
        }
        const worldMap = Field.getActiveWorldMap();
        const mapW = worldMap[0].length, mapH = worldMap.length;
        const tx = ((Field.x % mapW) + mapW) % mapW, ty = ((Field.y % mapH) + mapH) % mapH;
        const surface = typeof MapRegistry !== 'undefined' && MapRegistry.getWorldSurfaceAt
            ? MapRegistry.getWorldSurfaceAt(tx, ty)
            : { tile: worldMap[ty][tx].toUpperCase(), isBridge: false, isSea: false };
        const tile = surface.tile;
        if (surface.isBridge) return 'battle_bg_field';
        if (surface.isSea) return 'battle_bg_sea';
        // World-map forest encounters use their own field background. Keep the
        // fixed Forbidden Forest background isolated under battle_bg_forest.
        if (tile === 'F') return 'battle_bg_field_forest';
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

        if (dy > 0) Field.dir = 0; else if (dx < 0) Field.dir = 1; else if (dx > 0) Field.dir = 2; else if (dy < 0) Field.dir = 3;
        Field.step = (Field.step === 1) ? 2 : 1;
        let nx = Field.x + dx, ny = Field.y + dy;
        App.clearAction();

        // 移動失敗時も現在地タイルのアクションを復元する。
        // 以前はここで App.clearAction() した後、壁/マップ外/海などで return していたため、
        // イベント・宿屋・ボス等のタイル上で移動できない方向へ入力するとボタンが消えていました。
        // 今後、移動不可 return を追加する場合も、この helper を通して現在地を再評価してください。
        const keepCurrentTileAction = (options = {}) => {
            if (options.bump && typeof AudioManager !== 'undefined') AudioManager.playSe?.('wall_bump');
            if (typeof Field.refreshCurrentAction === 'function') {
                Field.refreshCurrentAction({ silent: true });
            }
            if (typeof Field.startIdleStep === 'function') Field.startIdleStep();
        };
		
		// ★修正点: エラー回避のため、現在のエリアキーを取得しておく
        const areaKey = Field.getCurrentAreaKey();

        if (Field.currentMapData) {
            if (nx < 0 || nx >= Field.currentMapData.width || ny < 0 || ny >= Field.currentMapData.height) { keepCurrentTileAction({ bump: true }); Field.render(); return; }
            if (Field.isMovementRegionCrossingBlocked(Field.x, Field.y, nx, ny)) {
                keepCurrentTileAction({ bump: true });
                Field.render();
                return;
            }
            
			//let tile = Field.currentMapData.tiles[ny][nx].toUpperCase();
			// ★修正: 書き換えられたタイルがあればそれを優先、なければ元のタイルを参照
            const changeKey = Field.getCurrentMapChangeKey ? Field.getCurrentMapChangeKey(areaKey) : areaKey;
			let tile = (App.data.progress.mapChanges?.[changeKey]?.[`${nx},${ny}`] || App.data.progress.mapChanges?.[areaKey]?.[`${nx},${ny}`] || Field.getMapTileAt(Field.currentMapData, nx, ny)).toUpperCase();
            let chestDef = null;

            // ★追加: 固定宝箱/ボスの判定を移動前に行う (撃破・取得済みなら通り抜け可能にする)
            if (Field.currentMapData.isFixed) {
                const ak = Field.getCurrentProgressMapKey();
                const posStr = `${nx},${ny}`;
                // ボスチェック
                if (tile === 'B') {
                    const bossDef = typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss
                        ? MapRegistry.findFixedBoss(Field.currentMapData, nx, ny)
                        : null;
                    if (Field.isFixedBossDefeatedAt(bossDef, nx, ny, ak)) {
                        tile = 'G';
                    } else if (!Field.isFixedBossAvailable(bossDef)) {
                        tile = bossDef?.inactiveTile || 'G';
                    } else {
                        if (bossDef?.inspectLog) App.log(bossDef.inspectLog);
                        keepCurrentTileAction({ bump: true });
                        Field.render();
                        return;
                    }
                }

                chestDef = Field.getFixedChestAt ? Field.getFixedChestAt(nx, ny) : null;
                const chestTile = Field.getFixedChestTileSign ? Field.getFixedChestTileSign(chestDef) : null;
                if (chestTile) tile = chestTile;
            } else if (tile === 'B' && areaKey === 'ABYSS' && typeof Dungeon !== 'undefined' && typeof Dungeon.prepareAbyssBossTileAction === 'function') {
                Dungeon.prepareAbyssBossTileAction(nx, ny, { silent: false });
                keepCurrentTileAction({ bump: true });
                Field.render();
                return;
            }

            const targetMapAction = typeof MapRegistry !== 'undefined' && MapRegistry.findMapAction
                ? MapRegistry.findMapAction(Field.currentMapData, nx, ny)
                : null;
            if (Field.currentMapData.isDungeon && typeof Dungeon !== 'undefined' && typeof Dungeon.isAdventurerAt === 'function' && Dungeon.isAdventurerAt(nx, ny)) {
                App.log('冒険者が立っている。');
                keepCurrentTileAction({ bump: true });
                Field.render();
                return;
            }
            if (Field.isBlockingMapActor(targetMapAction)) {
                if (targetMapAction.log) App.log(targetMapAction.log);
                keepCurrentTileAction({ bump: true });
                Field.render();
                return;
            }
            const targetBlockingObject = Field.getBlockingObjectAt ? Field.getBlockingObjectAt(nx, ny) : null;
            if (targetBlockingObject) {
                if (targetBlockingObject.log) App.log(targetBlockingObject.log);
                keepCurrentTileAction({ bump: true });
                Field.render();
                return;
            }
            if (tile === 'C' || tile === 'R') {
                const opened = Field.currentMapData.isFixed && typeof Dungeon !== 'undefined' &&
                    Dungeon.isFixedChestOpenedAt(nx, ny);
                const container = typeof Dungeon !== 'undefined' && Dungeon.getContainerPresentation
                    ? Dungeon.getContainerPresentation(chestDef)
                    : { opened: '開いたままの空箱がある。', blocked: '宝箱が道を塞いでいる。' };
                if (opened) {
                    // 固定マップの空箱は表示だけでなく障害物としても残す。
                    App.log(container.opened);
                } else {
                    App.log(tile === 'R' ? '赤い宝箱が道を塞いでいる。' : container.blocked);
                }
                keepCurrentTileAction({ bump: true });
                Field.render();
                return;
            }

            const isFloodedRandomFloor = !!(Field.currentMapData.isDungeon && !Field.currentMapData.isFixed && App.data?.dungeon?.isFloodedFloor);
            if (Field.isTileImpassableForCurrentMap(tile)) { keepCurrentTileAction({ bump: true }); Field.render(); return; }
            if (tile === '~' && !isFloodedRandomFloor) { keepCurrentTileAction({ bump: true }); Field.render(); return; }

            if (Field.isBuildingMovementBlocked(Field.x, Field.y, nx, ny)) {
                App.log('建物に遮られて進めない。');
                keepCurrentTileAction({ bump: true });
                Field.render();
                return;
            }

            if (typeof Dungeon !== 'undefined' && Dungeon.isLockedDoorTile && Dungeon.isLockedDoorTile(tile)) {
                if (!Dungeon.unlockDoorAt(nx, ny, tile)) {
                    keepCurrentTileAction({ bump: true });
                    Field.render();
                    return;
                }
                tile = 'T';
            }

            if (tile === 'S' && !Field.currentMapData.isDungeon) {
                const areaKey = App.data.location.area;
                if (typeof FIXED_MAPS !== 'undefined' && FIXED_MAPS[areaKey]) {
                    const mapDef = FIXED_MAPS[areaKey];
                    const flags = App.data?.progress?.flags || {};
                    const localExit = Array.isArray(mapDef.worldExits)
                        ? mapDef.worldExits.find(exitDef => Number(exitDef.x) === Number(nx) && Number(exitDef.y) === Number(ny))
                        : null;
                    if (localExit?.requiredFlag && !flags[localExit.requiredFlag]) {
                        App.log(localExit.lockedText || '門は固く閉ざされている。');
                        keepCurrentTileAction({ bump: true });
                        Field.render();
                        return;
                    }
                    const saved = App.data.mapReturnPoint;
                    const areaDef = (typeof STORY_DATA !== 'undefined' && STORY_DATA.areas) ? STORY_DATA.areas[areaKey] : null;
                    const fallback = localExit
                        ? { area: localExit.area || areaDef?.worldKey || 'WORLD', x: localExit.worldX, y: localExit.worldY }
                        : (mapDef.exitPoint || (areaDef
                            ? { area: areaDef.worldKey || 'WORLD', x: areaDef.centerX, y: areaDef.centerY }
                            : { area: 'WORLD', x: Field.x, y: Field.y }));
                    const savedWorld = saved && typeof WORLD_MAPS !== 'undefined' && WORLD_MAPS[saved.areaKey];
                    const exit = (!localExit && savedWorld)
                        ? { area: saved.areaKey, x: saved.x, y: saved.y }
                        : fallback;
                    App.data.mapReturnPoint = null;
                    App.data.location.area = exit.area || 'WORLD';
                    App.data.location.worldKey = (exit.worldKey || exit.area || 'WORLD') === 'ABYSS_WORLD' ? 'ABYSS_WORLD' : 'WORLD';
                    App.data.transportMode = null;
                    Field.x = Number(exit.x); Field.y = Number(exit.y);
                    App.data.location.x = Field.x; App.data.location.y = Field.y;
                    Field.currentMapData = null;
                    App.log("フィールドへ出た");
                    App.save(); Field.render();
                    if (typeof Field.startIdleStep === 'function') Field.startIdleStep();
                    return;
                }
            }

            Field.x = nx; Field.y = ny;
            App.data.location.x = nx; App.data.location.y = ny;
            if (Field.currentMapData?.isFixed && typeof Dungeon !== 'undefined' && typeof Dungeon.markFixedVisibleArea === 'function') {
                Dungeon.markFixedVisibleArea(Field.x, Field.y, Field.currentMapData.revealRadius || 3);
            }

            if (tile === 'M' && Field.currentMapData.isFixed && !Field.currentMapData.isDungeon && typeof Dungeon !== 'undefined' && typeof Dungeon.stepOnLava === 'function') {
                Dungeon.stepOnLava();
            }

            if (Field.currentMapData.isFixed && typeof Dungeon !== 'undefined' && typeof Dungeon.handleFixedTileEffect === 'function') {
                const effect = Field.getRuntimeTileEffectAt ? Field.getRuntimeTileEffectAt(nx, ny) : null;
                const activeHunter = typeof Dungeon.getFixedHunterAt === 'function' ? Dungeon.getFixedHunterAt(nx, ny) : null;
                const activeEffect = activeHunter || (effect?.type === 'hunter' ? null : effect);
                if (activeEffect && activeEffect.type !== 'angel') {
                    const handled = Dungeon.handleFixedTileEffect(activeEffect, dx, dy);
                    if (handled) {
                        App.save();
                        Field.render();
                        if (typeof Field.startIdleStep === 'function') Field.startIdleStep();
                        return;
                    }
                }
                if (typeof Dungeon.stepFixedHunters === 'function') {
                    const caught = Dungeon.stepFixedHunters();
                    if (caught) {
                        Field.render();
                        return;
                    }
                }
            }

            // 現在地タイルのアクション判定は refreshCurrentAction に統一。
            // move() 内だけに判定を書くと、戦闘/施設/イベント復帰時にボタンが復元されないため。
            Field.refreshCurrentAction({ silent: false });

            if (Field.currentMapData.isDungeon) Dungeon.handleMove(nx, ny);
            App.save(); Field.render();
            if (typeof Field.startIdleStep === 'function') Field.startIdleStep();
			
        } else {
            const activeWorldMap = Field.getActiveWorldMap();
            const mapW = activeWorldMap[0].length, mapH = activeWorldMap.length;
            nx = (nx + mapW) % mapW; ny = (ny + mapH) % mapH;
            const surface = typeof MapRegistry !== 'undefined' && MapRegistry.getWorldSurfaceAt
                ? MapRegistry.getWorldSurfaceAt(nx, ny)
                : { tile: activeWorldMap[ny][nx].toUpperCase(), isBridge: false, isSea: activeWorldMap[ny][nx].toUpperCase() === 'W', isImpassable: activeWorldMap[ny][nx].toUpperCase() === 'M' };
            const tile = surface.tile;
            const isBridge = surface.isBridge;
            const isFlying = typeof App.isFlying === 'function' && App.isFlying();
            if (!isFlying && surface.isImpassable) {
                App.log(tile === 'M' ? "険しい岩山だ" : "深淵の断崖に阻まれている");
                keepCurrentTileAction({ bump: true }); Field.render(); return;
            }
            if (!isFlying && surface.isSea) {
                if (!App.hasMagicBoat || !App.hasMagicBoat()) { App.log("海は船がないと渡れない…"); keepCurrentTileAction({ bump: true }); Field.render(); return; }
                if (App.data.transportMode !== 'boat') App.log("魔法の小舟で海へ漕ぎ出した。");
                App.data.transportMode = 'boat';
            }
            if (!isFlying && !surface.isSea && App.data.transportMode === 'boat') {
                App.data.transportMode = null;
                App.log("小舟を降りた。");
            }
            Field.x = nx; Field.y = ny; App.data.location.x = nx; App.data.location.y = ny; 
            const hasTileAction = isFlying ? false : Field.refreshCurrentAction({ silent: false });
            if (!isFlying && !hasTileAction) {
                // --- エンカウント判定ロジック ---
                const occurred = App.tryRandomEncounter(surface.isSea ? 0.04 : null);
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
        // 旧セーブで起動済みの仕掛けを、現在のマップ座標定義へ毎回冪等に再適用する。
        Field.restoreCompletedSwitchGates?.();
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.syncFieldBgm === 'function') AudioManager.syncFieldBgm();
        const canvas = document.getElementById('field-canvas'); if(!canvas) return;
        if (typeof Field.syncCanvasToWrapperSize === 'function') Field.syncCanvasToWrapperSize();
        if (typeof PhaserFieldRenderer !== 'undefined' && PhaserFieldRenderer.render(Field)) {
            let locName = Field.currentMapData ? Field.currentMapData.name : `世界地図 (${Field.x}, ${Field.y})`;
            if (!Field.currentMapData && App.data?.transportMode === 'flying') locName += ' - 飛行中';
            if (!Field.currentMapData && App.data?.transportMode === 'boat') locName += ' - 小舟';
            if (Field.currentMapData?.isDungeon && Field.currentMapData?.hideFloorLabel !== true) {
                if (Field.currentMapData.isFixed) {
                    const baseName = Field.currentMapData.baseName || Field.currentMapData.name;
                    const floorLabel = Field.currentMapData.floorLabel || `${Dungeon.floor}階`;
                    locName = Field.currentMapData.displayName || `${baseName} ${floorLabel}`;
                } else {
                    locName = `${locName} ${Dungeon.floor}階`;
                }
            }
            const locNameElement = document.getElementById('loc-name');
            if (locNameElement) locNameElement.innerText = locName;
            if (typeof App.updateObjectiveHUD === 'function') App.updateObjectiveHUD();
            if (typeof Field.updateFieldHudState === 'function') Field.updateFieldHudState();
            if (typeof Field.drawHudMinimap === 'function') Field.drawHudMinimap();
            const fullMapCanvas = document.getElementById('field-map-modal-canvas');
            if (fullMapCanvas && typeof Field.drawFullMap === 'function') Field.drawFullMap(fullMapCanvas);
            return;
        }
        const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
        const FIELD_VIEW_TILES = 15;
        const ts = Math.max(16, Math.floor(w / FIELD_VIEW_TILES));
        const cx = w/2, cy = h/2;
        const rangeX = Math.floor(FIELD_VIEW_TILES / 2) + 1;
        const rangeY = Math.ceil(h / (2 * ts)) + 1;
        const activeWorldMap = Field.getActiveWorldMap();
        const mapW = Field.currentMapData ? Field.currentMapData.width : (activeWorldMap?.[0]?.length || 50);
        const mapH = Field.currentMapData ? Field.currentMapData.height : (activeWorldMap?.length || 32);
        const g = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};
        
        const areaKey = Field.getCurrentAreaKey();
        const useDepthRendering = false;
        const isDungeonView = !!Field.currentMapData?.isDungeon;
        const ambient = isDungeonView
            ? { top: '#10131d', bottom: '#24202c', fog: 'rgba(121, 102, 170, 0.18)' }
            : (App.data?.transportMode === 'boat')
                ? { top: '#153c55', bottom: '#284f5c', fog: 'rgba(141, 215, 255, 0.14)' }
                : { top: '#20364d', bottom: '#446049', fog: 'rgba(255, 234, 184, 0.12)' };
        if (useDepthRendering) {
            const bg = ctx.createLinearGradient(0, 0, 0, h);
            bg.addColorStop(0, ambient.top);
            bg.addColorStop(1, ambient.bottom);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
        } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
        }

        // --- 内部ヘルパー: スプライトシート対応の描画関数 ---
        const drawGraphic = (imgName, dx, dy, targetSize, drawHeight = targetSize) => {
            if (!imgName) return false;
            
            // 1. GRAPHICS.spriteDefs に定義があるか確認
            const sprite = GRAPHICS.spriteDefs ? GRAPHICS.spriteDefs[imgName] : null;
            
            if (sprite && g[sprite.sheet]) {
                // スプライトシートから指定範囲を切り出して描画 (9引数版)
                ctx.drawImage(
                    g[sprite.sheet], 
                    sprite.x, sprite.y, sprite.w, sprite.h, 
                    dx, dy, targetSize, drawHeight
                );
                return true;
            } else if (g[imgName]) {
                // 従来通りの単体画像 (Base64等) として描画
                ctx.drawImage(g[imgName], dx, dy, targetSize, drawHeight);
                return true;
            }
            if (typeof GRAPHICS !== 'undefined' && typeof GRAPHICS.get === 'function') {
                GRAPHICS.get(imgName);
            }
            return false;
        };

        const drawWaterShore = (plan, drawX, drawY) => {
            if (!plan?.edges?.length) return;
            const image = g[plan.key];
            if (!image) {
                GRAPHICS?.get?.(plan.key);
                return;
            }
            const foamHeight = Math.max(2, ts * 8 / 32);
            plan.edges.forEach(edge => {
                ctx.save();
                ctx.globalAlpha = Number(plan.alpha ?? 0.58);
                ctx.translate(
                    drawX + ts / 2 + edge.offsetX * ts,
                    drawY + ts / 2 + edge.offsetY * ts
                );
                ctx.rotate(Number(edge.angle || 0) * Math.PI / 180);
                ctx.drawImage(image, -ts / 2, -foamHeight / 2, ts, foamHeight);
                ctx.restore();
            });
        };

        const tileTone = (tileSign) => {
            const upper = String(tileSign || '').toUpperCase();
            if (upper === 'W') return 'water';
            if (upper === 'M' || upper === 'L') return 'ridge';
            if (upper === 'F') return 'forest';
            if (upper === 'B' || upper === 'H' || upper === 'V' || upper === 'I' || upper === 'K' || upper === 'E' || upper === 'D') return 'object';
            if (upper === 'C' || upper === 'R' || upper === 'P' || upper === 'S' || upper === 'U') return 'marker';
            return isDungeonView ? 'stone' : 'ground';
        };

        const tileLift = (tileSign, hasOverlay, wallGraphic) => {
            const tone = tileTone(tileSign);
            if (hasOverlay) return 4;
            if (wallGraphic) return 8;
            if (tone === 'ridge') return 7;
            if (tone === 'forest' || tone === 'object') return 5;
            return 0;
        };

        const stableNoise = (x, y) => {
            const n = Math.sin((x * 127.1) + (y * 311.7)) * 43758.5453;
            return n - Math.floor(n);
        };

        const drawTileBase = (x, y, color, tone, noise) => {
            const inset = 1;
            ctx.fillStyle = color || '#2c7a4e';
            ctx.fillRect(x, y, ts, ts);

            const previousAlpha = ctx.globalAlpha;
            ctx.globalAlpha = tone === 'water' ? 0.16 : 0.10 + (noise * 0.06);
            ctx.fillStyle = tone === 'stone' ? '#ffffff' : (tone === 'water' ? '#9de7ff' : '#fff7cc');
            ctx.fillRect(x + inset, y + inset, ts - inset * 2, Math.max(3, ts * 0.18));
            ctx.globalAlpha = tone === 'water' ? 0.22 : 0.16;
            ctx.fillStyle = tone === 'water' ? '#08314d' : '#000';
            ctx.fillRect(x + inset, y + ts - 6, ts - inset * 2, 5);
            if (tone === 'water') {
                ctx.globalAlpha = 0.25;
                ctx.strokeStyle = '#8fdcff';
                ctx.beginPath();
                ctx.moveTo(x + 5 + noise * 8, y + 12);
                ctx.lineTo(x + 18 + noise * 8, y + 12);
                ctx.moveTo(x + 12 - noise * 7, y + 22);
                ctx.lineTo(x + 27 - noise * 7, y + 22);
                ctx.stroke();
            }
            ctx.globalAlpha = previousAlpha;

            ctx.strokeStyle = tone === 'water' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.10)';
            ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
        };

        const drawFootShadow = (x, y, lift = 0, alpha = 0.22, radiusX = ts * 0.34, radiusY = ts * 0.13) => {
            const previousAlpha = ctx.globalAlpha;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(x + ts / 2 + Math.min(5, lift), y + ts - 5, radiusX, radiusY, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = previousAlpha;
        };

        const isDungeonShadowTarget = (tileSign) => {
            if (!isDungeonView) return false;
            const upper = String(tileSign || '').toUpperCase();
            // 固定・ランダム双方のダンジョンで、壁以外の通行可能/床上オブジェクト全般に影を重ねる。
            // 溶岩、宝箱、階段、鍵、扉、ボス/イベント表示なども最終的な見た目の上から影をかける。
            return upper !== 'W';
        };

        const drawDungeonWallContactShadow = (drawX, drawY, tileX, tileY, tileSign) => {
            if (!isDungeonShadowTarget(tileSign)) return;
            const leftTile = Field.getRenderedTileForDraw(tileX - 1, tileY, mapW, mapH, areaKey);
            const belowTile = Field.getRenderedTileForDraw(tileX, tileY + 1, mapW, mapH, areaKey);
            const lowerLeftTile = Field.getRenderedTileForDraw(tileX - 1, tileY + 1, mapW, mapH, areaKey);
            const leftIsWall = String(leftTile || '').toUpperCase() === 'W';
            const belowIsWall = String(belowTile || '').toUpperCase() === 'W';
            const lowerLeftIsWall = String(lowerLeftTile || '').toUpperCase() === 'W';
            if (!leftIsWall && !belowIsWall && !lowerLeftIsWall) return;

            // 壁接触影の規定:
            // - 壁の右のタイル   : 左側 1/3 を影にする
            // - 壁の上のタイル   : 下側 1/3 を影にする
            // - 壁の右上のタイル : 左側 1/3 かつ下側 1/3、つまり左下だけを影にする
            // 1つのパスとしてまとめて塗ることで、条件が重なっても同じ場所が二重に濃くならないようにする。
            const shadowW = Math.ceil(ts / 3);
            const shadowH = Math.ceil(ts / 3);
            const bottomY = drawY + ts - shadowH;

            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.34)';
            ctx.beginPath();

            if (leftIsWall) {
                // このタイルは壁の右側にある。左 1/3 を縦方向に影にする。
                ctx.rect(drawX, drawY, shadowW, ts);
            }

            if (belowIsWall) {
                // このタイルは壁の上側にある。下 1/3 を横方向に影にする。
                ctx.rect(drawX, bottomY, ts, shadowH);
            }

            if (lowerLeftIsWall) {
                // このタイルは壁の右上にある。左下 1/3 x 1/3 だけを影にする。
                ctx.rect(drawX, bottomY, shadowW, shadowH);
            }

            ctx.fill();
            ctx.restore();
        };

        const drawVisibleDungeonWallContactShadows = () => {
            if (!isDungeonView) return;
            for (let dy = -rangeY; dy <= rangeY; dy++) {
                for (let dx = -rangeX; dx <= rangeX; dx++) {
                    const tileX = Field.x + dx;
                    const tileY = Field.y + dy;
                    const tileSign = Field.getRenderedTileForDraw(tileX, tileY, mapW, mapH, areaKey);
                    const drawX = Math.floor(cx + (dx * ts) - (ts / 2));
                    const drawY = Math.floor(cy + (dy * ts) - (ts / 2));
                    drawDungeonWallContactShadow(drawX, drawY, tileX, tileY, tileSign);
                }
            }
        };

        const elevatedEdgePlans = [];
        const elevatedEdgeDefinition = Field.currentMapData?.elevatedEdges;
        for (let dy = -rangeY; dy <= rangeY; dy++) {
            for (let dx = -rangeX; dx <= rangeX; dx++) {
                const drawX = Math.floor(cx + (dx * ts) - (ts / 2)), drawY = Math.floor(cy + (dy * ts) - (ts / 2));
                let tx = Field.x + dx, ty = Field.y + dy, tile = Field.getRenderedTileForDraw(tx, ty, mapW, mapH, areaKey);
                const parts = Field.getMapDrawParts ? Field.getMapDrawParts(tile, tx, ty) : { upper: tile.toUpperCase(), baseTile: tile, overlayConfig: null };
                const upper = parts.upper;
                const config = Field.getTileConfigForDraw ? Field.getTileConfigForDraw(upper, tx, ty) : Field.getTileConfig(upper);
                const wallGraphic = Field.getDungeonWallGraphicForDraw(tx, ty, upper, mapW, mapH, areaKey);
                const overlayConfig = parts.overlayConfig;
                const isBaseTerrainTile = upper === 'T' || upper === 'G' || config?.terrain === true;
                const groundTile = overlayConfig ? parts.baseTile : (isBaseTerrainTile ? upper : 'T');
                // 地面は座標依存のフィールド施設オーバーレイを混ぜず、純粋な床タイルとして描く。
                // これにより透過素材の下が黒くならず、G/Tなどの地面の上に施設画像が重なる。
                const floorConfig = parts.worldOverlay
                    ? Field.getTileConfig(groundTile)
                    : (Field.getTileConfigForDraw
                        ? Field.getTileConfigForDraw(groundTile, tx, ty)
                        : Field.getTileConfig(groundTile));
                const tone = tileTone(upper);
                const noise = stableNoise(tx, ty);
                const lift = useDepthRendering ? tileLift(upper, !!overlayConfig, wallGraphic) : 0;

                // 1. 地面の描画。
                // 固定MAP/固定ダンジョンの施設・宝箱・階段・ボス等は、ここで床を描いてからオーバーレイを重ねる。
                if (useDepthRendering) {
                    drawTileBase(drawX, drawY, floorConfig.color, tone, noise);
                } else if (!drawGraphic(floorConfig.img, drawX, drawY, ts)) {
                    ctx.fillStyle = floorConfig.color;
                    ctx.fillRect(drawX, drawY, ts, ts);
                }
                if (useDepthRendering && drawGraphic(floorConfig.img, drawX, drawY, ts)) {
                    ctx.save();
                    ctx.globalAlpha = 0.08 + (noise * 0.08);
                    ctx.fillStyle = tone === 'stone' ? '#dfe7ff' : '#ffe8a5';
                    ctx.fillRect(drawX, drawY, ts, ts);
                    ctx.restore();
                }

                // 2. 通常オブジェクトの描画。overlayConfig があるタイルはここでは描かない。
                if (!isBaseTerrainTile && !overlayConfig) {
                    if (lift > 0) drawFootShadow(drawX, drawY, lift, tone === 'ridge' ? 0.30 : 0.24);
                    const imageY = drawY - lift;
                    const wallFaceOverlay = !!(wallGraphic && Field.getDungeonWallFaceModeForDraw?.() === 'overlay');
                    const objectGraphic = wallFaceOverlay ? config.img : (wallGraphic || config.img);
                    if (!drawGraphic(objectGraphic, drawX, imageY, ts, ts + lift)) {
                        if (config.color && config.color !== floorConfig.color) {
                            ctx.fillStyle = config.color;
                            ctx.fillRect(drawX, imageY, ts, ts + lift);
                        }
                    }
                    if (wallFaceOverlay) {
                        drawGraphic(wallGraphic, drawX, imageY, ts, ts + lift);
                    }
                    if (lift > 0) {
                        ctx.save();
                        ctx.globalAlpha = 0.18;
                        ctx.fillStyle = '#000';
                        ctx.fillRect(drawX, drawY + ts - Math.min(6, lift), ts, Math.min(6, lift));
                        ctx.restore();
                    }
                }

                // 3. 固定MAP/固定ダンジョン専用オーバーレイ。
                const shorePlan = config?.animatedWater === true && config?.shoreFoam === true
                    ? window.MapRenderShared?.waterShorePlan?.({
                        map: Field.currentMapData,
                        x: tx,
                        y: ty,
                        tileSign: upper,
                        enabled: true,
                        alpha: Number(config.shoreFoamAlpha ?? 0.58),
                        tileAtFn: (x, y) => Field.getRenderedTileForDraw(x, y, mapW, mapH, areaKey)
                    })
                    : null;
                drawWaterShore(shorePlan, drawX, drawY);

                if (overlayConfig) {
                    const characterOverlay = /^(overlay_npc_|overlay_companion_)/.test(String(overlayConfig.img || ''));
                    const bossOverlay = /^(overlay_boss_|monster_)/.test(String(overlayConfig.img || ''));
                    const buildingOverlay = Field.isBuildingOverlayConfig?.(overlayConfig) === true;
                    const wallOverlay = overlayConfig.wallOverlay === true;
                    const blockingObjectOverlay = overlayConfig.blockingObject === true;
                    const eventMarkerOverlay = overlayConfig.eventMarker === true;
                    const eventMarkerPulse = eventMarkerOverlay && Field.step === 1 ? 0.75 : 1;
                    if (useDepthRendering && !parts.worldOverlay && !wallOverlay && overlayConfig.suppressShadow !== true && (blockingObjectOverlay || !isDungeonView || characterOverlay || bossOverlay)) {
                        drawFootShadow(drawX, drawY, lift, 0.24);
                    }
                    const overlayWidth = eventMarkerOverlay
                        ? Math.max(9, Math.round(ts * (Number(overlayConfig.drawWidth || 12) / 32) * eventMarkerPulse))
                        : buildingOverlay
                        ? Math.round(ts * Math.max(1, Number(overlayConfig.buildingScale || 2.4)))
                        : bossOverlay
                        ? Math.round(ts * 2)
                        : (blockingObjectOverlay ? Math.round(ts * (Number(overlayConfig.drawWidth || 32) / 32)) : ts);
                    const overlayHeight = eventMarkerOverlay
                        ? Math.max(9, Math.round(ts * (Number(overlayConfig.drawHeight || 12) / 32) * eventMarkerPulse))
                        : buildingOverlay
                        ? Math.round(ts * Math.max(1, Number(overlayConfig.buildingScale || 2.4)))
                        : bossOverlay
                        ? Math.round(ts * 2)
                        : blockingObjectOverlay
                        ? Math.round(ts * (Number(overlayConfig.drawHeight || 32) / 32))
                        : (wallOverlay ? Math.round(ts * 1.5) : ts + lift);
                    const overlayX = drawX + Math.round((ts - overlayWidth) / 2);
                    const overlayY = eventMarkerOverlay
                        ? drawY + Math.round((ts - overlayHeight) / 2) - lift
                        : ((buildingOverlay || wallOverlay || blockingObjectOverlay || bossOverlay) ? drawY + ts - overlayHeight : drawY - lift);
                    ctx.save();
                    if (eventMarkerOverlay) {
                        ctx.globalAlpha = Field.step === 1 ? 0.52 : 0.92;
                    }
                    if (!drawGraphic(overlayConfig.img, overlayX, overlayY, overlayWidth, overlayHeight)) {
                        ctx.fillStyle = overlayConfig.color || config.color || '#fff';
                        ctx.beginPath();
                        ctx.arc(drawX + ts / 2, overlayY + overlayHeight / 2, eventMarkerOverlay ? ts * 0.08 : ts * 0.34, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }

                const effectGraphicKey = Field.getTileEffectGraphicKey ? Field.getTileEffectGraphicKey(tx, ty) : null;
                const drewEffectGraphic = effectGraphicKey ? drawGraphic(effectGraphicKey, drawX, drawY, ts) : false;
                const effectColor = Field.getTileEffectMarkerColor ? Field.getTileEffectMarkerColor(tx, ty) : null;
                if (effectColor && !drewEffectGraphic) {
                    ctx.save();
                    ctx.globalAlpha = 0.78;
                    ctx.fillStyle = effectColor;
                    ctx.beginPath();
                    ctx.arc(drawX + ts / 2, drawY + ts / 2, ts * 0.18, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 0.25;
                    ctx.fillRect(drawX + 6, drawY + ts - 8, ts - 12, 3);
                    ctx.restore();
                }

                if (elevatedEdgeDefinition) {
                    const edgePlan = window.MapRenderShared?.elevatedEdgeCellPlan?.({
                        map: Field.currentMapData,
                        definition: elevatedEdgeDefinition,
                        x: tx,
                        y: ty,
                        tileSign: tile,
                        tileAtFn: (x, y) => Field.getRenderedTileForDraw(x, y, mapW, mapH, areaKey)
                    });
                    const edgeScale = ts / 32;
                    edgePlan?.edges?.forEach(edge => elevatedEdgePlans.push({
                        key: edge.key,
                        x: drawX + edge.x * edgeScale,
                        y: drawY + edge.y * edgeScale,
                        width: edge.width * edgeScale,
                        height: edge.height * edgeScale
                    }));
                }
            }
        }

        (Field.currentMapData?.skyOverlays || []).forEach(definition => {
            const drawX = cx + ((Number(definition.x || 0) - Number(Field.x)) * ts) - ts / 2;
            const drawY = cy + ((Number(definition.y || 0) - Number(Field.y)) * ts) - ts / 2;
            const drawWidth = Math.max(8, Number(definition.drawWidth || 32)) * ts / 32;
            const drawHeight = Math.max(8, Number(definition.drawHeight || 32)) * ts / 32;
            drawGraphic(definition.imageKey, drawX, drawY, drawWidth, drawHeight);
        });

        // Canvas is the error-recovery renderer.  Draw ledges in a second pass so
        // neighboring sky tiles cannot paint over the exposed platform sides.
        elevatedEdgePlans.forEach(edge => drawGraphic(edge.key, edge.x, edge.y, edge.width, edge.height));

        // Phaserと同じく、renderLayer:"object" の固定装飾はタイル描画後に一度だけ描く。
        // getMapDrawParts() の blockingObject オーバーレイからは除外しているため、
        // Canvasフォールバックでも2.7倍の本体だけが表示される。
        (Field.currentMapData?.floorDecorations || []).forEach(definition => {
            if (String(definition?.renderLayer || '').toLowerCase() !== 'object' || definition?.type !== 'image' || !definition.imageKey) return;
            const ox = Number(definition.x || 0) - Number(Field.x);
            const oy = Number(definition.y || 0) - Number(Field.y);
            if (Math.abs(ox) > rangeX + 3 || Math.abs(oy) > rangeY + 3) return;
            const drawScale = Math.max(0.1, Number(definition.drawScale || 1));
            const drawWidth = Math.max(8, Number(definition.drawWidth || (32 * drawScale))) * ts / 32;
            const drawHeight = Math.max(8, Number(definition.drawHeight || (32 * drawScale))) * ts / 32;
            const anchorX = cx + (ox * ts);
            const anchorY = cy + (oy * ts) + ts / 2;
            const offsetX = Number(definition.drawOffsetX || 0) * ts / 32;
            const offsetY = Number(definition.drawOffsetY || 0) * ts / 32;
            ctx.save();
            const baseAlpha = definition.alpha === undefined ? 1 : Number(definition.alpha);
            ctx.globalAlpha = definition.shimmer === true && Field.step === 1
                ? Math.max(0.68, baseAlpha - 0.18)
                : baseAlpha;
            drawGraphic(
                definition.imageKey,
                anchorX - drawWidth / 2 + offsetX,
                anchorY - drawHeight + offsetY,
                drawWidth,
                drawHeight
            );
            ctx.restore();
        });

        if (useDepthRendering) {
            ctx.save();
            const bloom = ctx.createRadialGradient(cx, cy, ts * 1.5, cx, cy, Math.max(w, h) * 0.72);
            bloom.addColorStop(0, 'rgba(255,255,255,0)');
            bloom.addColorStop(1, 'rgba(0,0,0,0.34)');
            ctx.fillStyle = bloom;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
            ctx.fillStyle = ambient.fog;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        // 3. ランダム生成ダンジョン内の特殊オブジェクト描画。
        // タイル文字を増やさず App.data.dungeon.* で管理するため、
        // 地形・宝箱・階段などの既存生成ロジックを壊さない。
        const drawOverlayImage = (obj, fallbackSrc, fallbackColor, options = {}) => {
            if ((!Field.currentMapData?.isDungeon && options.allowFixed !== true) || !obj || !obj.active || Number(obj.floor) !== Number(Dungeon.floor)) return;
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
                ctx.arc(px + ts / 2, py + ts / 2 - 4, ts * 0.34, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        };

        const drawAbyssBossSprite = () => {
            if (areaKey !== 'ABYSS' || !Field.currentMapData?.isDungeon || typeof Dungeon === 'undefined') return;
            const encounter = typeof Dungeon.getCurrentAbyssBossEncounter === 'function'
                ? Dungeon.getCurrentAbyssBossEncounter()
                : App.data?.dungeon?.abyssBossEncounter;
            if (!encounter || !encounter.active || Number(encounter.floor) !== Number(Dungeon.floor)) return;
            const monsterId = Number(encounter.displayMonsterId || encounter.monsterIds?.[0]);
            if (!Number.isFinite(monsterId)) return;

            const ox = Number(encounter.x ?? 5) - Number(Field.x);
            const oy = Number(encounter.y ?? 5) - Number(Field.y);
            if (Math.abs(ox) > rangeX + 1 || Math.abs(oy) > rangeY + 1) return;

            const size = ts * 2.6;
            const px = Math.floor(cx + (ox * ts) - (size / 2));
            const py = Math.floor(cy + (oy * ts) - (size / 2));
            const src = Field.getMonsterMapSpriteSrc ? Field.getMonsterMapSpriteSrc(monsterId) : `assets/monsters/monster_${String(monsterId).padStart(6, '0')}.png`;
            const img = Field.getDirectImage(src);
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.save();
                ctx.drawImage(img, px, py, size, size);
                ctx.restore();
            } else {
                ctx.save();
                ctx.fillStyle = '#c78cff';
                ctx.beginPath();
                ctx.arc(px + size / 2, py + size / 2, ts * 0.55, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        };

        drawOverlayImage(App.data?.dungeon?.healSpring, Dungeon.healSpringImagePath || 'assets/map/overlays/overlay_shrine_healing_spring.png', '#80ffb0');
        if (Field.currentMapData?.isFixed && Field.getFixedHealSpringsForCurrentFloor) {
            Field.getFixedHealSpringsForCurrentFloor().forEach(s => {
                const springSrc = window.GRAPHICS?.data?.[s.imageKey]
                    || Dungeon.healSpringImagePath
                    || 'assets/map/overlays/overlay_shrine_healing_spring.png';
                drawOverlayImage({ active: true, floor: Dungeon.floor, x: Number(s.x), y: Number(s.y), image: springSrc }, springSrc, '#80ffb0', { allowFixed: true });
            });
        }
        drawOverlayImage(App.data?.dungeon?.abyssRift, 'assets/effect/fx-abyss-vortex-ai.png', '#a34cff');
        drawOverlayImage(App.data?.dungeon?.adventurer, 'assets/monsters/monster_000105.png', '#5bd6ff');
        drawOverlayImage(App.data?.dungeon?.keyGuardian, 'assets/monsters/monster_000103.png', '#ffd78a');
        drawOverlayImage(App.data?.dungeon?.trialAngel, 'assets/map/overlays/overlay_dungeon_trial_angel.png', '#fff3a6');
        drawAbyssBossSprite();

        // 4. 壁際の影は、溶岩・宝箱・階段・常設泉などの上から最後に重ねる。
        // プレイヤーまで暗くしないよう、プレイヤー描画の直前で止める。
        drawVisibleDungeonWallContactShadows();

        // 5. プレイヤーの描画 (hero_... の画像もスプライトシート化していれば対応可能)
        const direction = ['down','left','right','up'][Field.dir];
        const isFloodedBoat = Field.isPlayerOnFloodedWater();
        const pKey = isFloodedBoat ? `overlay_magic_boat_${direction}` : `hero_${direction}_${Field.step}`;
        if (!isFloodedBoat) drawFootShadow(cx - ts / 2, cy - ts / 2, 0, 0.34, ts * 0.25, ts * 0.09);
        if (!drawGraphic(pKey, cx-ts/2, cy-ts/2, ts)) {
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();
        }

        // 特殊フロアの空気感をキャンバス上に重ねる。
        // ミニマップはこの後に描くため、もやでミニマップが読めなくなることはない。
        if (typeof Field.drawDungeonAtmosphere === 'function') Field.drawDungeonAtmosphere(ctx, w, h);

        let locName = Field.currentMapData ? Field.currentMapData.name : `世界地図 (${Field.x}, ${Field.y})`;
        if (!Field.currentMapData && App.data?.transportMode === 'flying') locName += ' - 飛行中';
        if (!Field.currentMapData && App.data?.transportMode === 'boat') locName += ' - 小舟';
        if (Field.currentMapData && Field.currentMapData.isDungeon && Field.currentMapData.hideFloorLabel !== true) {
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
        if (typeof Field.updateFieldHudState === 'function') Field.updateFieldHudState();
        if (typeof Field.drawHudMinimap === 'function') Field.drawHudMinimap();
        const fullMapCanvas = document.getElementById('field-map-modal-canvas');
        if (fullMapCanvas && typeof Field.drawFullMap === 'function') Field.drawFullMap(fullMapCanvas);

        return;

        if (Field.minimapMode === 'minimized') return;

        const mmSize = 80, mmX = w - mmSize - 14, mmY = 14, range = 7;
        const miniCells = range * 2 + 1;
        const dms = mmSize / miniCells;
        ctx.save();
        ctx.globalAlpha = 0.56;
        ctx.fillStyle = '#000';
        ctx.fillRect(mmX, mmY, mmSize, mmSize);
        ctx.strokeStyle = 'rgba(255,255,255,0.62)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX + 0.5, mmY + 0.5, mmSize - 1, mmSize - 1);

        const drawHeldKeyHud = () => {
            if (!Field.currentMapData?.isDungeon || typeof Dungeon === 'undefined' || typeof Dungeon.getHeldKeyOrder !== 'function') return;
            const keyDefs = [
                { color: 'red', img: 'item_key_red', tint: '#d94a4a' },
                { color: 'blue', img: 'item_key_blue', tint: '#4aa0e6' },
                { color: 'gold', img: 'item_key_gold', tint: '#e0b84a' }
            ];
            const heldKeys = Dungeon.getHeldKeyOrder()
                .map(color => keyDefs.find(def => def.color === color))
                .filter(Boolean);
            if (!heldKeys.length) return;

            const size = 18;
            const gap = 4;
            const hudW = heldKeys.length * size + (heldKeys.length - 1) * gap;
            const hudX = Math.max(6, mmX + mmSize - hudW);
            const hudY = mmY + mmSize + 6;
            ctx.save();
            ctx.globalAlpha = 1;
            heldKeys.forEach((def, i) => {
                const x = hudX + i * (size + gap);
                const y = hudY;
                const img = g[def.img];
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, x, y, size, size);
                } else {
                    ctx.fillStyle = def.tint;
                    ctx.beginPath();
                    ctx.arc(x + size / 2, y + size / 2, size * 0.32, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            ctx.restore();
        };

        const miniTileColor = (tile, tx, ty) => Field.getMiniMapTileColor
            ? Field.getMiniMapTileColor(tile, tx, ty)
            : (Field.getTileConfig(tile)?.color || '#000');

        const drawMiniMarkerAt = (relX, relY, color) => {
            if (!color) return;
            if (relX < -range || relX > range || relY < -range || relY > range) return;
            Field.drawMiniMapTileMarker(ctx, color, mmX + (relX + range) * dms, mmY + (relY + range) * dms, dms);
        };

        for (let mdy = -range; mdy <= range; mdy++) {
            for (let mdx = -range; mdx <= range; mdx++) {
                let mtx = Field.x + mdx;
                let mty = Field.y + mdy;
                let mtile = 'W';
                let minimapVisible = true;

                if (Field.currentMapData) {
                    const outOfBounds = mtx < 0 || mtx >= mapW || mty < 0 || mty >= mapH;
                    if (!outOfBounds) {
                        const ak = Field.getCurrentAreaKey();
                        const pk = `${mtx},${mty}`;

                        if (Field.currentMapData?.isDungeon && !Field.currentMapData?.isFixed && typeof Dungeon !== 'undefined' && typeof Dungeon.isVisited === 'function') {
                            const inCurrentSight = Math.abs(mdx) <= 4 && Math.abs(mdy) <= 4;
                            if (!inCurrentSight && !Dungeon.isVisited(mtx, mty)) {
                                minimapVisible = false;
                            }
                        }

                        const progressKey = Field.currentMapData?.isFixed && Field.getCurrentProgressMapKey
                            ? Field.getCurrentProgressMapKey()
                            : ak;
                        mtile = App.data.progress.mapChanges?.[progressKey]?.[pk]
                            || App.data.progress.mapChanges?.[ak]?.[pk]
                            || Field.getMapTileAt(Field.currentMapData, mtx, mty);
                        if (String(mtile || '').toUpperCase() === 'B') {
                            const bossDef = (typeof MapRegistry !== 'undefined' && MapRegistry.findFixedBoss)
                                ? MapRegistry.findFixedBoss(Field.currentMapData, mtx, mty)
                                : null;
                            if (Field.isFixedBossDefeatedAt(bossDef, mtx, mty, progressKey)) mtile = 'G';
                        }
                    } else if (Field.currentMapData.isFixed) {
                        mtile = Field.getRenderedTileForDraw(mtx, mty, mapW, mapH, Field.getCurrentAreaKey());
                    } else {
                        minimapVisible = false;
                    }
                } else {
                    const worldMap = Field.getActiveWorldMap();
                    mtile = worldMap[((mty % mapH) + mapH) % mapH][((mtx % mapW) + mapW) % mapW];
                }

                if (!minimapVisible) continue;
                const miniX = mmX + (mdx + range) * dms;
                const miniY = mmY + (mdy + range) * dms;
                ctx.fillStyle = (mdx === 0 && mdy === 0) ? '#fff' : miniTileColor(mtile, mtx, mty);
                ctx.fillRect(miniX, miniY, Math.ceil(dms), Math.ceil(dms));

                if (!(mdx === 0 && mdy === 0)) {
                    const markerInfo = Field.getMiniMapMarkerInfo ? Field.getMiniMapMarkerInfo(mtile, mtx, mty) : null;
                    if (markerInfo?.color && Field.drawMiniMapTileMarker) {
                        Field.drawMiniMapTileMarker(ctx, markerInfo.color, miniX, miniY, dms, markerInfo.connections);
                    }
                }
            }
        }

        // 固定ダンジョンの常設回復の泉も、通常ミニマップでは現在地周辺だけ表示する。
        if (Field.currentMapData?.isFixed && Field.getFixedHealSpringsForCurrentFloor && Field.drawMiniMapTileMarker) {
            Field.getFixedHealSpringsForCurrentFloor().forEach(s => {
                const relX = Number(s.x) - Number(Field.x);
                const relY = Number(s.y) - Number(Field.y);
                if (relX === 0 && relY === 0) return;
                drawMiniMarkerAt(relX, relY, '#80ffb0');
            });
        }

        // ミニマップ上にも、タイル文字で管理していない特殊オブジェクトを表示する。
        // プレイヤーと同じマスにいる場合は、現在地の白マーカーを優先する。
        const drawMiniObject = (obj, color) => {
            if (!Field.currentMapData?.isDungeon || !obj || !obj.active || Number(obj.floor) !== Number(Dungeon.floor)) return;
            const relX = Number(obj.x) - Number(Field.x);
            const relY = Number(obj.y) - Number(Field.y);
            if (relX === 0 && relY === 0) return;
            if (relX < -range || relX > range || relY < -range || relY > range) return;
            if (Field.currentMapData?.isDungeon && !Field.currentMapData?.isFixed && typeof Dungeon !== 'undefined' && typeof Dungeon.isVisited === 'function') {
                const inCurrentSight = Math.abs(relX) <= 4 && Math.abs(relY) <= 4;
                if (!inCurrentSight && !Dungeon.isVisited(Number(obj.x), Number(obj.y))) return;
            }
            ctx.fillStyle = color;
            ctx.fillRect(mmX + (relX + range) * dms, mmY + (relY + range) * dms, Math.max(2, dms), Math.max(2, dms));
        };
        drawMiniObject(App.data?.dungeon?.healSpring, '#80ffb0');
        drawMiniObject(App.data?.dungeon?.abyssRift, '#a34cff');
        drawMiniObject(App.data?.dungeon?.adventurer, '#5bd6ff');
        drawMiniObject(App.data?.dungeon?.trialAngel, '#fff3a6');
        drawMiniObject(App.data?.dungeon?.keyGuardian, '#ffd78a');

        drawHeldKeyHud();

        ctx.restore();
    }
};

if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
        window.requestAnimationFrame(() => {
            if (typeof Field.syncCanvasToWrapperSize === 'function') {
                Field.syncCanvasToWrapperSize();
            }
            if (typeof PhaserFieldRenderer !== 'undefined' && typeof PhaserFieldRenderer.resize === 'function') {
                PhaserFieldRenderer.resize();
            }
            if (typeof Field.updateMinimapHotspotBounds === 'function') {
                Field.updateMinimapHotspotBounds();
            }
            if (Field.ready && typeof Field.render === 'function') {
                Field.render();
            }
        });
    });
}
