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
        this.img = data.img || null;
        this.limitBreak = data.limitBreak || 0;
        this.exp = data.exp || 0;
		this.sp = data.sp || 0;
    }

    getStat(key) {
        // ★修正: モンスターの「耐性」データも正しく参照できるようにする
        if (key === 'resists' && !(this instanceof Player)) {
            return this.resists || {};
        }

        let val = this.baseStats[key] || 0;
        if(this instanceof Player) {
            const stats = App.calcStats(this.originData);
            val = stats[key] || 0;
        }
        if(this.buffs[key]) val = Math.floor(val * this.buffs[key]);
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
        
		// ★修正: Entityで設定されたspをそのまま使う (再定義しない)
        //this.sp = data.sp !== undefined ? data.sp : 0;
        this.tree = data.tree || { ATK:0, MAG:0, SPD:0, HP:0, MP:0 };

        this.skills = [DB.SKILLS.find(s => s.id === 1)]; 

        const table = JOB_SKILLS[data.job];
        if (table) {
            for (let lv = 1; lv <= data.level; lv++) {
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
        this.hp = Math.floor((data.hp || 100) * scale);
        this.baseMaxHp = this.hp;
        this.baseStats.atk = Math.floor((data.atk || 10) * scale);
        this.baseStats.def = Math.floor((data.def || 10) * scale);
        this.baseStats.spd = Math.floor((data.spd || 10) * scale);
        this.baseStats.mag = Math.floor((data.mag || 10) * scale);
        this.acts = data.acts || [1];
        this.baseId = data.id;
        this.actCount = data.actCount || 1;
    }
}

// ==========================================================================
// アプリケーションコア
// ==========================================================================

const App = {
    data: null,
    pendingAction: null, 

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
        App.load();
        if(!App.data) { 
            if(window.location.href.indexOf('main.html') === -1) {
                // window.location.href = 'main.html'; 
            }
            return; 
        }

        // シナジー情報の更新
        if (App.data) {
            App.refreshAllSynergies();
        }

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
            if (App.data.progress && App.data.progress.floor > 0) {
                if (typeof Dungeon !== 'undefined') {
                    if (Field.currentMapData) {
                        App.changeScene('field');
                        App.log(`地下 ${Dungeon.floor} 階の冒険を再開します。`);
                    } else {
                        Dungeon.loadFloor();
                    }
                } else {
                    App.changeScene('field');
                }
            } else {
                const mapW = typeof MAP_DATA !== 'undefined' ? MAP_DATA[0].length : 50;
                const mapH = typeof MAP_DATA !== 'undefined' ? MAP_DATA.length : 32;
                if(App.data.location) {
                    Field.x = App.data.location.x % mapW;
                    Field.y = App.data.location.y % mapH;
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

        const bindPad = (id, dx, dy) => {
            const el = document.getElementById(id);
            if(!el) return;
            el.onmousedown = (e) => { e.preventDefault(); startMove(dx, dy); };
            el.onmouseup = stopMove;
            el.onmouseleave = stopMove;
            el.ontouchstart = (e) => { e.preventDefault(); startMove(dx, dy); };
            el.ontouchend = stopMove;
        };
        bindPad('btn-up', 0, -1);
        bindPad('btn-down', 0, 1);
        bindPad('btn-left', -1, 0);
        bindPad('btn-right', 1, 0);

        const bindClick = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
        bindClick('btn-menu', () => { if(typeof Menu !== 'undefined') Menu.openMainMenu(); });
        bindClick('btn-ok', () => { if(App.pendingAction) App.executeAction(); else if(typeof Menu !== 'undefined') Menu.openMainMenu(); });
    },
    
    // シナジー情報の更新
    refreshAllSynergies: () => {
        const check = (item) => {
            if (!item) return;
            const syn = App.checkSynergy(item);
            if (syn) {
                item.isSynergy = true;
                item.effect = syn.effect; 
            } else {
                item.isSynergy = false;
                delete item.effect;
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
                if(!App.data.battle) App.data.battle = { active: false }; 
            } 
        }catch(e){ console.error(e); } 
    },
    save: () => { 
        if(App.data && Field.ready) { 
            App.data.location.x=Field.x; 
            App.data.location.y=Field.y; 
        } 
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

        for(let i=0;i<5;i++) App.data.inventory.push(App.createRandomEquip('init', 1)); 
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

/* main.js の App.calcStats を以下のように修正してください */

    // ★修正: ステータス計算 (耐性対応・攻撃時付与対応版)
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
            
            elmAtk: {}, elmRes: {}, magDmg: 0, sklDmg: 0, finDmg: 0, finRed: 0, mpRed: 0,
            
            // ★修正: 状態異常耐性の初期化 (キーが増えたため動的に対応できるよう空で用意しても良いが、主要なものは定義)
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

        // 1. ユーザー配分ポイント
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
                        
                        // ★修正: 耐性OP (resists_XX)
                        else if(o.key.startsWith('resists_')) {
                            const resKey = o.key.replace('resists_', '');
                            // 未定義のキーが来ても動的に追加して加算する
                            s.resists[resKey] = (s.resists[resKey] || 0) + o.val;
                        }
                        // ★追加: 攻撃時付与OP (attack_XX)
                        else if(o.key.startsWith('attack_')) {
                            // s直下にプロパティとして保持 (例: s.attack_Poison = 5)
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
				
				// ★追加: シナジー効果のステータス反映
                // (App.refreshAllSynergiesにより eq.isSynergy / eq.effect が付与されている前提)
                if (eq.isSynergy && eq.effect) {
                    if (eq.effect === 'might') s.finDmg += 30;         // 剛力: 与ダメ+30%
                    if (eq.effect === 'ironWall') s.finRed += 10;      // 鉄壁: 被ダメ軽減+10%
                    if (eq.effect === 'guardian') pctMods.def += 100;  // 守護: 防御+100%
                    if (eq.effect === 'divineProtection') {            // 加護: 全耐性+20%
                        for (let k in s.resists) {
                            s.resists[k] = (s.resists[k] || 0) + 20;
                        }
                    }
                }
				
            }
        });

        // 3. スキルツリー補正
        if (char.tree) {
            const t = char.tree;
            if (t.ATK) pctMods.atk += t.ATK * 5; 
            if (t.MAG) pctMods.mag += t.MAG * 5;
            if (t.SPD) pctMods.spd += t.SPD * 5;
            if (t.HP)  pctMods.maxHp += t.HP * 5;
            if (t.MP) {
                pctMods.def += t.MP * 5;
                pctMods.maxMp += t.MP * 5;
                if (t.MP >= 5) s.finRed += 10;
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


// ★修正: レベルアップ処理 (DB基礎値の4〜8%を加算 + SP加算)
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

                // 成長率: 4% 〜 8%
                const minRate = 0.04;
                const maxRate = 0.08;
                const rate1 = minRate + Math.random() * (maxRate - minRate);
                const rate2 = minRate + Math.random() * (maxRate - minRate);
                const rate3 = minRate + Math.random() * (maxRate - minRate);
                const rate4 = minRate + Math.random() * (maxRate - minRate);
                const rate5 = minRate + Math.random() * (maxRate - minRate);
                const rate6 = minRate + Math.random() * (maxRate - minRate);

                const incHp = Math.max(1, Math.floor((master.hp || 100) * rate1 * 2));
                const incMp = Math.max(1, Math.floor((master.mp || 50) * rate2));
                const incAtk = Math.max(1, Math.floor((master.atk || 10) * rate3));
                const incDef = Math.max(1, Math.floor((master.def || 10) * rate4));
                const incSpd = Math.max(1, Math.floor((master.spd || 10) * rate5));
                const incMag = Math.max(1, Math.floor((master.mag || 10) * rate6));

                charData.hp += incHp; charData.mp += incMp;
                charData.atk += incAtk; charData.def += incDef;
                charData.spd += incSpd; charData.mag += incMag;
                
                // ★追加: SP加算処理
                if (charData.sp === undefined) charData.sp = 0;
                charData.sp++; 
                
                // HP/MP全回復
                const stats = App.calcStats(charData);
                charData.currentHp = stats.maxHp;
                charData.currentMp = stats.maxMp;

                let logMsg = `${charData.name}はLv${charData.level}になった！<br>HP+${incHp}, 攻+${incAtk}...`;
                const newSkill = App.checkNewSkill(charData);
                if (newSkill) {
                    if(!charData.skills) charData.skills = [];
                    const hasSkill = charData.skills.some(s => s.id === newSkill.id);
                    // 本来はインスタンス側で管理するが、ログ用にチェック
                    logMsg += `<br><span style="color:#ffff00;">${newSkill.name}を覚えた！</span>`;
                }
                logs.push(logMsg);
            } else { break; }
        }
        return logs;
    },

/* main.js の App.createRandomEquip を以下のように修正してください */

    // ★修正: 装備タイプごとのオプションフィルタリング対応版
    createRandomEquip: (source, rank = 1, fixedPlus = null) => {
        let candidates = DB.EQUIPS.filter(e => e.rank <= rank && e.rank >= Math.max(1, rank - 15));
        if (candidates.length === 0) candidates = DB.EQUIPS.filter(e => e.rank <= rank);
        if (candidates.length === 0) candidates = [DB.EQUIPS[0]];

        const base = candidates[Math.floor(Math.random() * candidates.length)];
        
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
        
        const eq = { 
            id: Date.now() + Math.random().toString(), 
            rank: base.rank, name: base.name, type: base.type, 
            val: base.val * (1 + plus * 0.5), 
            data: JSON.parse(JSON.stringify(base.data)), 
            opts: [], plus: plus 
        };
        
        // ★追加: この装備で付与可能なオプションキーのリストを取得
        const allowedKeys = base.possibleOpts || null;

        for(let i=0; i<plus; i++) {
            const tierRatio = Math.min(1, rank / 100);
            
            // ★追加: オプション候補のフィルタリング
            let optCandidates = DB.OPT_RULES;
            if (allowedKeys) {
                optCandidates = DB.OPT_RULES.filter(rule => allowedKeys.includes(rule.key));
                // 設定ミス等で候補がない場合は全ルールから抽選 (フォールバック)
                if (optCandidates.length === 0) optCandidates = DB.OPT_RULES;
            }

            const rule = optCandidates[Math.floor(Math.random() * optCandidates.length)];
            
            let r = 'N';
            const rarRnd = Math.random() + (tierRatio * 0.1);
            if(rarRnd > 0.98 && rule.allowed.includes('EX')) r='EX';
            else if(rarRnd > 0.90 && rule.allowed.includes('UR')) r='UR';
            else if(rarRnd > 0.75 && rule.allowed.includes('SSR')) r='SSR';
            else if(rarRnd > 0.55 && rule.allowed.includes('SR')) r='SR';
            else if(rarRnd > 0.30 && rule.allowed.includes('R')) r='R';
            else r = rule.allowed[0];

            const min = rule.min[r]||1, max = rule.max[r]||10;
            eq.opts.push({
                key:rule.key, elm:rule.elm, label:rule.name, 
                val:Math.floor(Math.random()*(max-min+1))+min, unit:rule.unit, rarity:r
            });
        }

        if(plus > 0) eq.name += `+${plus}`;
        // 生成時にもシナジー効果を付与
        if(plus === 3) {
             const syn = App.checkSynergy(eq);
             if(syn) {
                 eq.isSynergy = true;
                 eq.effect = syn.effect;
             }
        }
        
        return eq;
    },

/* main.js の App.checkSynergy を以下のように修正してください */

    // ★修正: 複合条件・属性条件対応版
    checkSynergy: (eq) => { 
        if (!eq || !eq.opts) return null;

        for (const syn of DB.SYNERGIES) {
            let match = false;

            // パターンA: 複合条件 (req配列がある場合)
            if (syn.req) {
                // req内のすべての条件を満たしているかチェック
                const allMet = syn.req.every(req => {
                    const count = eq.opts.filter(o => o.key === req.key).length;
                    return count >= req.count;
                });
                if (allMet) match = true;
            }
            // パターンB: 属性指定条件 (key と elm がある場合)
            else if (syn.key && syn.elm) {
                const count = eq.opts.filter(o => o.key === syn.key && o.elm === syn.elm).length;
                if (count >= syn.count) match = true;
            }
            // パターンC: 単一キー条件 (既存ロジック)
            else if (syn.key) {
                const count = eq.opts.filter(o => o.key === syn.key).length;
                if (count >= syn.count) match = true;
            }

            if (match) return syn;
        }
        return null; 
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
        const img = c.img ? `<img src="${c.img}" style="width:100%; height:100%; object-fit:cover;">` : 'IMG';
        return `<div class="char-row"><div class="char-thumb">${img}</div><div class="char-info"><div class="char-name">${c.name} <span class="rarity-${c.rarity}">[${c.rarity}]</span> +${c.limitBreak||0}</div><div class="char-meta">${c.job} Lv.${c.level}</div><div class="char-stats"><span style="color:#f88;">HP:${hp}/${s.maxHp}</span><span style="color:#88f;">MP:${mp}/${s.maxMp}</span><span>攻:${s.atk}</span> <span>防:${s.def}</span> <span>魔:${s.mag}</span> <span>速:${s.spd}</span></div></div></div>`;
    },

    getNextExp: (char) => {
        if (char.level >= CONST.MAX_LEVEL) return Infinity;
        const base = CONST.EXP_BASE * Math.pow(CONST.EXP_GROWTH, char.level - 1);
        const rarityMult = CONST.RARITY_EXP_MULT[char.rarity] || 1.0;
        return Math.floor(base * rarityMult);
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
    }
};

/* main.js (Fieldオブジェクト: グラフィック描画対応) */

const Field = {
    x: 23, y: 28, 
    dir: 0, // ★追加: 向き (0:下, 1:左, 2:右, 3:上)
	step: 1, // ★追加: 歩行アニメ用 (1 または 2)
    ready: false, currentMapData: null,
    
    init: () => {
        if(App.data && !Field.currentMapData) {
            const mapW = typeof MAP_DATA !== 'undefined' ? MAP_DATA[0].length : 50;
            const mapH = typeof MAP_DATA !== 'undefined' ? MAP_DATA.length : 32;
            Field.x = App.data.location.x % mapW;
            Field.y = App.data.location.y % mapH;
        }
        Field.ready = true;
        Field.render();
        if(document.getElementById('disp-gold')) document.getElementById('disp-gold').innerText = App.data.gold;
        if(document.getElementById('disp-gem')) document.getElementById('disp-gem').innerText = App.data.gems;
        if(typeof Menu !== 'undefined') Menu.renderPartyBar();
    },

    move: (dx, dy) => {
        // ★追加: 移動方向に応じて向きを更新
        if (dy > 0) Field.dir = 0; // 下
        else if (dx < 0) Field.dir = 1; // 左
        else if (dx > 0) Field.dir = 2; // 右
        else if (dy < 0) Field.dir = 3; // 上
	
		// ★追加: 1歩ごとに step を 1 ⇔ 2 で切り替える
        Field.step = (Field.step === 1) ? 2 : 1;

        let nx = Field.x + dx;
        let ny = Field.y + dy;
        let tile = 'W';
        App.clearAction();

        if (Field.currentMapData) {
            if(nx < 0 || nx >= Field.currentMapData.width || ny < 0 || ny >= Field.currentMapData.height) return;
            tile = Field.currentMapData.tiles[ny][nx];
            // ダンジョン内では 'W' は壁として移動不可
            if (tile === 'W') return; 
            Field.x = nx; Field.y = ny;
            App.data.location.x = nx; App.data.location.y = ny;
            App.save();
            Field.render();
            Dungeon.handleMove(nx, ny);
        } else {
            const mapW = typeof MAP_DATA !== 'undefined' ? MAP_DATA[0].length : 50;
            const mapH = typeof MAP_DATA !== 'undefined' ? MAP_DATA.length : 32;
            nx = (nx + mapW) % mapW; ny = (ny + mapH) % mapH;
            
            tile = MAP_DATA[ny][nx];
            if (tile === 'M') { App.log("山だ"); return; }
            if (tile === 'W') { App.log("海だ"); return; }

            Field.x = nx; Field.y = ny; 
            App.data.location.x = nx; App.data.location.y = ny; 
            if(App.data.walkCount === undefined) App.data.walkCount = 0;
            App.data.walkCount++;
            App.save(); 
            Field.render();

            if (tile === 'I') { App.log("宿屋がある"); App.setAction("宿屋に入る", () => App.changeScene('inn')); }
            else if (tile === 'K') { App.log("カジノがある"); App.setAction("カジノに入る", () => App.changeScene('casino')); }
            else if (tile === 'E') { App.log("交換所がある"); App.setAction("メダル交換", () => App.changeScene('medal')); }
            else {
                let rate = 0.03;
                if (App.data.walkCount > 30) rate = 0.08;
                else if (App.data.walkCount > 15) rate = 0.05;
                if(Math.random() < rate) { App.data.walkCount = 0; App.log("敵だ！"); setTimeout(()=>App.changeScene('battle'),300); }
            }
        }
    },

/* main.js の Field.render 部分のみ抜粋・修正 */

    render: () => {
        const canvas = document.getElementById('field-canvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const ts = 32, w = canvas.width, h = canvas.height;
        ctx.fillStyle='#000'; ctx.fillRect(0,0,w,h);
        
        const cx = w / 2; const cy = h / 2;
        const rangeX = Math.ceil(w / (2 * ts)) + 1;
        const rangeY = Math.ceil(h / (2 * ts)) + 1;
        const mapW = Field.currentMapData ? Field.currentMapData.width : (typeof MAP_DATA!=='undefined'?MAP_DATA[0].length:50);
        const mapH = Field.currentMapData ? Field.currentMapData.height : (typeof MAP_DATA!=='undefined'?MAP_DATA.length:32);

        // GRAPHICSオブジェクトが存在するか安全確認
        const g = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};

        for (let dy = -rangeY; dy <= rangeY; dy++) {
            for (let dx = -rangeX; dx <= rangeX; dx++) {
                const drawX = Math.floor(cx + (dx * ts) - (ts / 2));
                const drawY = Math.floor(cy + (dy * ts) - (ts / 2));
                let tx = Field.x + dx; let ty = Field.y + dy; let tile = 'W';

                if (Field.currentMapData) {
                    if (tx >= 0 && tx < mapW && ty >= 0 && ty < mapH) tile = Field.currentMapData.tiles[ty][tx];
                } else {
                    const lx = ((tx % mapW) + mapW) % mapW;
                    const ly = ((ty % mapH) + mapH) % mapH;
                    tile = MAP_DATA[ly][lx];
                }

                // -------------------------------------------------
                // 1. 背景（床）の描画
                // -------------------------------------------------
                let drawnFloor = false;
                if (tile !== 'W') { // 壁以外は床を描く
                    // ダンジョンかフィールドかで床画像を切り替え
                    const floorKey = Field.currentMapData ? 'dungeon_floor' : 'floor';
                    
                    if (g[floorKey]) {
                        // 画像があれば描画
                        ctx.drawImage(g[floorKey], drawX, drawY, ts, ts);
                        drawnFloor = true;
                    } else {
                        // 画像がなければデフォルト色（濃いグレー）
                        ctx.fillStyle = '#222'; 
                        ctx.fillRect(drawX, drawY, ts, ts);
                    }
                }

                // -------------------------------------------------
                // 2. オブジェクト/タイルの描画
                // -------------------------------------------------
                let imgKey = null;
                
                // タイル文字から画像キーへのマッピング
                if (tile === 'W') imgKey = Field.currentMapData ? 'wall' : 'sea'; // ダンジョンは壁、フィールドは海
                else if (tile === 'M') imgKey = 'mountain';
                else if (tile === 'S') imgKey = 'stairs';
                else if (tile === 'C') imgKey = 'chest';
                else if (tile === 'R') imgKey = 'chest_rare';
                else if (tile === 'B') imgKey = 'boss';
                else if (tile === 'I') imgKey = 'inn';
                else if (tile === 'K') imgKey = 'casino';
                else if (tile === 'E') imgKey = 'medal';
                else if (tile === 'F') imgKey = 'forest';
                else if (tile === 'L') imgKey = 'Low_mountain';

                // 画像表示 or 元の色表示 の分岐
                if (imgKey && g[imgKey]) {
                    // ★アセットがある場合：画像を描画
                    ctx.drawImage(g[imgKey], drawX, drawY, ts, ts);
                } else {
                    // ★アセットがない場合：元の色塗りロジック (フォールバック)
                    let color = null;
                    
                    if(tile === 'G') color = '#282'; 
                    else if(tile === 'W') color = '#228'; 
                    else if(tile === 'M') color = '#333'; 
                    else if(tile === 'T') color = '#444'; 
                    else if(tile === 'S') color = '#dd0'; 
                    else if(tile === 'C') color = '#0dd'; 
                    else if(tile === 'R') color = '#f00'; 
                    else if(tile === 'B') color = '#d00'; 
                    else if(tile === 'I') color = '#fff'; 
                    else if(tile === 'K') color = '#ff0'; 
                    else if(tile === 'E') color = '#aaf'; 
                    else if(tile === 'F') color = '#040'; 
                    else if(tile === 'L') color = '#642'; 
                    
                    // 色設定があり、かつ「床画像の上に描画する必要がある」または「床ではない」場合
                    // ※ 'G'などは床画像がある場合、上で描画済みなのでスキップしてもよいが、
                    //   画像がない場合はここで色を塗る必要がある。
                    if (color) {
                        // 床画像を描画済みで、かつタイルが床系(G, T)の場合は重ね塗りを避ける（半透明なら別だが）
                        // ここではシンプルに「画像がないなら塗る」とする
                        if (!drawnFloor || (tile !== 'G' && tile !== 'T')) {
                            ctx.fillStyle = color;
                            ctx.fillRect(drawX, drawY, ts, ts);
                        }
                    }
                }

                // 文字の重ね表示 (画像があっても分かりやすくするため残す、不要なら削除可)
                //if(['C','R','B','I','K','E'].includes(tile)) {
                //    ctx.fillStyle = (imgKey && g[imgKey]) ? '#fff' : '#000'; // 画像上なら白文字、色塗り上なら黒文字
                //    ctx.font = '20px sans-serif';
                //    let char = tile;
                //    if(!Field.currentMapData) { if(tile==='I') char='宿'; if(tile==='K') char='カ'; if(tile==='E') char='交'; }
                //    ctx.fillText(char, drawX+6, drawY+24);
                //}
            }
        }
        
        // -------------------------------------------------
        // ★プレイヤー描画 (アニメーション対応)
        // -------------------------------------------------
        const pBaseKeys = ['hero_down', 'hero_left', 'hero_right', 'hero_up'];
        const pBase = pBaseKeys[Field.dir] || 'hero_down';
        
        // キーを合成する: "hero_down" + "_" + "1" -> "hero_down_1"
        const pKey = `${pBase}_${Field.step}`; 
        
        if (g[pKey]) {
            // 画像があれば描画
            ctx.drawImage(g[pKey], cx - ts/2, cy - ts/2, ts, ts);
        } else {
            // 画像がない、またはキーが見つからない場合のフォールバック（白丸）
            // 開発中はキー間違いに気づけるように、ここに来たらログを出すのもあり
            // console.warn('Missing image:', pKey);
            ctx.fillStyle = '#fff'; 
            ctx.beginPath(); 
            ctx.arc(cx, cy, 10, 0, Math.PI*2); 
            ctx.fill(); 
            ctx.strokeStyle = '#000'; 
            ctx.stroke();
        }

        // ロケーション名表示などはそのまま
        let locName = Field.currentMapData ? `地下${Dungeon.floor}階` : `フィールド(${Field.x},${Field.y})`;
        document.getElementById('loc-name').innerText = locName;

        // ミニマップ描画 (簡略化のため従来通りの色塗りで維持)
        const mmSize = 80; const mmX = w - mmSize - 10; const mmY = 10; const range = 10; 
        ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(mmX, mmY, mmSize, mmSize); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(mmX, mmY, mmSize, mmSize);
        const dms = mmSize / (range*2); 
        for(let dy = -range; dy < range; dy++) {
            for(let dx = -range; dx < range; dx++) {
                let tx = Field.x + dx; let ty = Field.y + dy; let tile = 'W';
                if (Field.currentMapData) { if(tx>=0 && tx<mapW && ty>=0 && ty<mapH) tile = Field.currentMapData.tiles[ty][tx]; } 
                else { tile = MAP_DATA[((ty%mapH)+mapH)%mapH][((tx%mapW)+mapW)%mapW]; }
                
                ctx.fillStyle = '#000';
                if(tile === 'W') ctx.fillStyle = '#228'; 
                else if(tile === 'G') ctx.fillStyle = '#282'; 
                else if(tile === 'M') ctx.fillStyle = '#333'; 
                else if(tile === 'T') ctx.fillStyle = '#666'; 
                else if(tile === 'S') ctx.fillStyle = '#ff0'; 
                else if(tile === 'C') ctx.fillStyle = '#0ff'; 
                else if(tile === 'R') ctx.fillStyle = '#f00'; 
                else if(tile === 'B') ctx.fillStyle = '#d00'; 
                else if(tile === 'I') ctx.fillStyle = '#fff'; 
                else if(tile === 'K') ctx.fillStyle = '#ff0'; 
                else if(tile === 'E') ctx.fillStyle = '#aaf'; 
                else if(tile === 'F') ctx.fillStyle = '#040'; 
                else if(tile === 'L') ctx.fillStyle = '#642'; 
                
                if (dx===0 && dy===0) ctx.fillStyle = '#fff'; 
                if (ctx.fillStyle !== '#000') ctx.fillRect(mmX + (dx + range) * dms, mmY + (dy + range) * dms, dms, dms);
            }
        }
        ctx.restore();
    }
};
