/* main.js (calcStats復活・完全版) */

/* main.js */

// ==========================================================================
// 設定：職業別習得スキルテーブル (全職対応・習得数増量版)
// ==========================================================================
const JOB_SKILLS = {
    // --- 基本職 ---
    '戦士':     { 2:40, 5:44, 10:50, 15:101, 20:41, 30:102, 40:402 },       // 火炎斬り, 兜割り, バイキルト, 強撃, はやぶさ, 渾身, ゴッドハンド
    '僧侶':     { 1:20, 4:12, 8:51, 12:21, 16:30, 22:22, 35:31 },           // ホイミ, バギ, スカラ, ベホイミ, ザオラル, ベホマラー, ザオリク
    '魔法使い': { 1:10, 4:11, 8:60, 12:301, 18:304, 25:305, 35:306 },       // メラ, ヒャド, ルカニ, メラミ, バギマ, メラゾーマ, イオナズン
    '武闘家':   { 3:52, 8:41, 12:101, 18:202, 25:43, 30:102, 40:402 },      // ピオリム, はやぶさ, 強撃, 爆裂拳, 雷鳴突き, 渾身, ゴッドハンド
    '盗賊':     { 2:11, 5:61, 10:52, 15:41, 20:201, 28:14, 35:104 },        // ヒャド, ボミオス, ピオリム, はやぶさ, 五月雨, ドルマ, 暗黒剣
    '踊り子':   { 2:10, 5:12, 10:52, 15:60, 20:61, 25:304, 30:22 },         // メラ, バギ, ピオリム, ルカニ, ボミオス, バギマ, ベホマラー
    '狩人':     { 3:11, 6:12, 10:41, 15:201, 20:61, 25:101, 35:202 },       // ヒャド, バギ, はやぶさ, 五月雨, ボミオス, 強撃, 爆裂拳
    '商人':     { 2:20, 5:50, 10:51, 15:60, 20:61, 25:44, 30:101 },         // ホイミ, バイキルト, スカラ, ルカニ, ボミオス, 兜割り, 強撃
    '傭兵':     { 3:40, 6:44, 10:101, 15:41, 20:50, 25:102, 35:202 },       // 火炎斬り, 兜割り, 強撃, はやぶさ, バイキルト, 渾身, 爆裂拳
    'シスター': { 1:20, 5:21, 10:30, 15:51, 20:12, 25:22, 35:31 },          // ホイミ, ベホイミ, ザオラル, スカラ, バギ, ベホマラー, ザオリク

    // --- 上級職 ---
    '魔法剣士': { 1:10, 5:40, 10:13, 15:42, 20:302, 25:43, 35:301 },        // メラ, 火炎, ライデイン, 氷結, ベギラマ, 雷鳴, メラミ
    '賢者':     { 1:20, 5:10, 10:21, 15:301, 20:11, 25:22, 30:306, 40:31 }, // ホイミ, メラ, ベホイミ, メラミ, ヒャド, ベホマラー, イオナズン, ザオリク
    '忍者':     { 3:14, 8:41, 15:104, 20:304, 25:201, 35:407, 45:103 },     // ドルマ, はやぶさ, 暗黒剣, バギマ, 五月雨, メラガイアー, ギガスラ
    'パラディン':{ 1:20, 5:51, 10:42, 15:21, 20:103, 30:23, 40:403 },       // ホイミ, スカラ, 氷結, ベホイミ, ギガスラ, ベホマ, フルケア
    'ダークナイト':{ 3:14, 8:40, 15:104, 20:60, 25:307, 35:102, 45:401 },   // ドルマ, 火炎, 暗黒剣, ルカニ, ドルモーア, 渾身, ギガブレ
    'ウィザード':{ 1:10, 5:11, 10:13, 15:301, 20:303, 30:305, 40:407 },     // メラ, ヒャド, ライデイン, メラミ, ヒャダルコ, メラゾーマ, メラガイアー
    '侍':       { 3:40, 8:42, 12:43, 18:41, 25:101, 35:102, 45:301 },       // 属性斬りx3, はやぶさ, 強撃, 渾身, ギガブレ
    '拳法家':   { 3:20, 8:50, 12:101, 18:202, 25:102, 35:402, 45:999 },     // ホイミ, バイキ, 強撃, 爆裂, 渾身, ゴッド, 激しい炎
    'スーパースター':{ 2:20, 5:52, 10:12, 15:304, 20:22, 30:306, 40:401 },  // ホイミ, ピオリム, バギ, バギマ, ベホマラー, イオナズン, ギガブレ
    '海賊':     { 3:11, 8:40, 12:43, 18:101, 25:201, 35:303, 45:406 },      // ヒャド, 火炎, 雷鳴, 強撃, 五月雨, ヒャダルコ, マヒャデドス
    '召喚士':   { 1:10, 5:11, 10:13, 15:305, 25:404, 35:405, 45:406 },      // 基本魔法, メラゾーマ, メテオ, ジゴスパーク, マヒャデドス
    'ソルジャー':{ 2:40, 5:42, 10:43, 15:44, 20:103, 30:102, 40:301 },      // 属性斬り全種, 兜割り, ギガスラ, 渾身, ギガブレ
    '聖騎士':   { 1:21, 5:51, 10:103, 15:22, 20:30, 30:402, 40:31 },        // ベホイミ, スカラ, ギガスラ, ベホマラー, ザオラル, ゴッドハンド, ザオリク
    '上忍':     { 3:14, 8:307, 15:201, 20:104, 30:405, 35:406, 45:306 },    // ドルマ, ドルモーア, 五月雨, 暗黒剣, ジゴスパ, マヒャデ, イオナズン

    // --- 超級職 ---
    '勇者':     { 1:20, 3:10, 8:40, 15:13, 25:103, 35:401, 50:407 },        // ホイミ, メラ, 火炎, ライデイン, ギガスラ, ギガブレ, メラガイアー
    '竜騎士':   { 1:40, 5:12, 10:43, 20:201, 30:999, 40:401, 50:405 },      // 火炎, バギ, 雷鳴, 五月雨, 激しい炎, ギガブレ, ジゴスパーク
    '聖女':     { 1:21, 5:22, 10:50, 20:51, 30:52, 40:23, 50:403 },         // ベホイミ, ベホマラー, バフ全部, ベホマ, フルケア
    '魔王':     { 1:10, 5:14, 10:13, 20:302, 30:404, 40:307, 50:306 },      // メラ, ドルマ, ライデイン, ベギラマ, メテオ, ドルモーア, イオナズン
    '神':       { 1:403, 10:901, 20:902, 30:903, 40:407, 50:405, 60:406 }   // フルケア, EX技全部, 最上級魔法全部
};

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
        
        this.job = data.job || '冒険者';
        this.rarity = data.rarity || 'N';
        this.level = data.level || 1;
        this.img = data.img || null;
        this.limitBreak = data.limitBreak || 0;
        this.exp = data.exp || 0;
    }

    getStat(key) {
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
        
        this.skills = [DB.SKILLS.find(s => s.id === 1)]; // 初期は「こうげき」のみ

        const table = JOB_SKILLS[data.job];
        if (table) {
            for (let lv = 1; lv <= data.level; lv++) {
                if (table[lv]) {
                    const skill = DB.SKILLS.find(s => s.id === table[lv]);
                    if (skill && !this.skills.find(s => s.id === skill.id)) {
                        this.skills.push(skill);
                    }
                }
            }
        }

        if(data.charId) {
            const master = DB.CHARACTERS.find(c => c.id === data.charId);
            if(master && master.lbSkills) {
                if(this.limitBreak >= 50 && master.lbSkills[50]) {
                    const sk = DB.SKILLS.find(s => s.id === master.lbSkills[50]);
                    if(sk) this.skills.push(sk);
                }
                if(this.limitBreak >= 99 && master.lbSkills[99]) {
                    const sk = DB.SKILLS.find(s => s.id === master.lbSkills[99]);
                    if(sk) this.skills.push(sk);
                }
            }
        }
        
        if(data.isHero) {
            if(this.limitBreak >= 10 && !this.skills.find(s=>s.id===12)) this.skills.push(DB.SKILLS.find(s=>s.id===12)); 
            if(this.limitBreak >= 50 && !this.skills.find(s=>s.id===13)) this.skills.push(DB.SKILLS.find(s=>s.id===13));
        }

        this.synergy = App.checkSynergy(this.equips);
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
    }
}

// ==========================================================================
// アプリケーションコア
// ==========================================================================

// ↓ ここから先(const App = ...)は変更なし


const App = {
    data: null,
    pendingAction: null, 

    initGameHub: () => {
        App.load();
        if(!App.data) { return; }

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
                    width: Dungeon.width, height: Dungeon.height, tiles: Dungeon.map, isDungeon: true
                };
            }
        }

        if (App.data.battle && App.data.battle.active) {
            App.log("戦闘に復帰します...");
            App.changeScene('battle');
        } else {
            App.log("冒険を開始します。");
            if (App.data.progress && App.data.progress.floor > 0) {
                if (Field.currentMapData) {
                    App.changeScene('field');
                    App.log(`地下 ${Dungeon.floor} 階の冒険を再開します。`);
                } else {
                    if(typeof Dungeon !== 'undefined') Dungeon.loadFloor();
                }
            } else {
                if(App.data.location) {
                    Field.x = Field.x % 50;
                    Field.y = Field.y % 32;
                }
                App.changeScene('field');
            }
        }
        
        window.addEventListener('keydown', e => {
            if(document.getElementById('field-scene') && document.getElementById('field-scene').style.display === 'flex') {
                if(Menu.isMenuOpen()) return;
                if(['ArrowUp', 'w'].includes(e.key)) Field.move(0, -1);
                if(['ArrowDown', 's'].includes(e.key)) Field.move(0, 1);
                if(['ArrowLeft', 'a'].includes(e.key)) Field.move(-1, 0);
                if(['ArrowRight', 'd'].includes(e.key)) Field.move(1, 0);
                if(e.key === 'Enter' || e.key === ' ') {
                    if(App.pendingAction) App.executeAction();
                    else Menu.openMainMenu();
                }
            }
        });

        let moveTimer = null;
        const startMove = (dx, dy) => {
            if(moveTimer) clearInterval(moveTimer);
            if(Menu.isMenuOpen()) return;
            Field.move(dx, dy); 
            moveTimer = setInterval(() => {
                if(Menu.isMenuOpen()) { stopMove(); return; }
                Field.move(dx, dy);
            }, 150); 
        };
        const stopMove = (e) => {
            if(e) e.preventDefault(); 
            if(moveTimer) clearInterval(moveTimer);
            moveTimer = null;
        };
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
        bindClick('btn-menu', () => Menu.openMainMenu());
        bindClick('btn-ok', () => { if(App.pendingAction) App.executeAction(); else Menu.openMainMenu(); });
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
            const reader = new FileReader();
            reader.onload = (e) => { App.createGameData(e.target.result); };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            App.createGameData(null);
        }
    },

    createGameData: (imgSrc) => {
        const name = document.getElementById('player-name').value || 'アルス';
        App.data = JSON.parse(JSON.stringify(INITIAL_DATA_TEMPLATE));
        App.data.characters[0].name = name;
        App.data.characters[0].img = imgSrc; 
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

    // ★追加: ステータス計算処理 (通常ステータス + 属性 + 装備補正)
    calcStats: (char) => {
        const lb = char.limitBreak || 0;
        const multiplier = 1 + (lb * 0.05); 
        
        let s = {
            maxHp: Math.floor(char.hp * multiplier),
            maxMp: Math.floor(char.mp * multiplier),
            atk: Math.floor(char.atk * multiplier),
            def: Math.floor(char.def * multiplier),
            spd: Math.floor(char.spd * multiplier),
            mag: Math.floor(char.mag * multiplier),
            elmAtk: {}, elmRes: {}, magDmg: 0, sklDmg: 0, finDmg: 0, finRed: 0, mpRed: 0
        };
        CONST.ELEMENTS.forEach(e => { s.elmAtk[e]=0; s.elmRes[e]=0; });

        if(char.uid === 'p1' && char.alloc) {
            for(let key in char.alloc) {
                if (key.includes('_')) {
                    const [type, elm] = key.split('_');
                    if(type === 'elmAtk' && s.elmAtk[elm] !== undefined) s.elmAtk[elm] += char.alloc[key];
                    if(type === 'elmRes' && s.elmRes[elm] !== undefined) s.elmRes[elm] += char.alloc[key];
                } else {
                    if (key === 'hp') s.maxHp += char.alloc[key];
                    else if (key === 'mp') s.maxMp += char.alloc[key];
                    else if (s[key] !== undefined) s[key] += char.alloc[key];
                }
            }
        }

        CONST.PARTS.forEach(part => {
            const eq = char.equips ? char.equips[part] : null;
            if(eq) {
                if(eq.data.atk) s.atk += eq.data.atk;
                if(eq.data.def) s.def += eq.data.def;
                if(eq.data.spd) s.spd += eq.data.spd;
                if(eq.data.mag) s.mag += eq.data.mag;
                if(eq.data.finDmg) s.finDmg += eq.data.finDmg;
                if(eq.data.finRed) s.finRed += eq.data.finRed;
                
                if(eq.data.elmAtk) for(let e in eq.data.elmAtk) s.elmAtk[e] += eq.data.elmAtk[e];
                if(eq.data.elmRes) for(let e in eq.data.elmRes) s.elmRes[e] += eq.data.elmRes[e];

                if(eq.opts) eq.opts.forEach(o => {
                    if(o.unit === 'val') {
                        if(o.key === 'hp') s.maxHp += o.val;
                        else if(o.key === 'mp') s.maxMp += o.val;
                        else if(s[o.key] !== undefined) s[o.key] += o.val; 
                        else if(o.key === 'elmAtk') s.elmAtk[o.elm] += o.val;
                        else if(o.key === 'elmRes') s.elmRes[o.elm] += o.val;
                    } else {
                        if(s[o.key] !== undefined) s[o.key] += o.val;
                    }
                });
            }
        });
        return s;
    },

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
        
        for(let i=0; i<plus; i++) {
            const tierRatio = Math.min(1, rank / 100);
            const rule = DB.OPT_RULES[Math.floor(Math.random()*DB.OPT_RULES.length)];
            
            let r = 'N';
            const rarRnd = Math.random() + (tierRatio * 0.3);
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
        if(plus === 3 && App.checkSynergy(eq)) eq.isSynergy = true;
        
        return eq;
    },
    
    checkSynergy: (eq) => { if(!eq.opts||eq.opts.length<3) return null; const fk=eq.opts[0].key; if(eq.opts.every(o=>o.key===fk)) return DB.SYNERGIES.find(s=>s.key===fk&&s.count<=eq.opts.length); return null; },

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
        return `<div class="char-row"><div class="char-thumb">${img}</div><div class="char-info"><div class="char-name">${c.name} <span class="rarity-${c.rarity}">[${c.rarity}]</span> +${c.limitBreak||0}</div><div class="char-meta">${c.job} Lv.${c.level}</div><div class="char-stats"><span style="color:#f88;">HP:${hp}/${s.maxHp}</span><span style="color:#88f;">MP:${mp}/${s.maxMp}</span><span>攻:${s.atk}</span> <span>防:${s.def}</span> <span>速:${s.spd}</span></div></div></div>`;
    },

    getNextExp: (char) => {
        if (char.level >= CONST.MAX_LEVEL) return Infinity;
        const base = CONST.EXP_BASE * Math.pow(CONST.EXP_GROWTH, char.level - 1);
        const rarityMult = CONST.RARITY_EXP_MULT[char.rarity] || 1.0;
        return Math.floor(base * rarityMult);
    },

    gainExp: (charData, expGain) => {
        if (!charData.exp) charData.exp = 0;
        charData.exp += expGain;
        let logs = [];
        
        while (charData.level < CONST.MAX_LEVEL) {
            const nextExp = App.getNextExp(charData);
            if (charData.exp >= nextExp) {
                charData.exp -= nextExp;
                charData.level++;
                
                const growRate = 0.02 + Math.random() * 0.03;
                const incHp = Math.max(1, Math.floor(charData.hp * growRate));
                const incMp = Math.max(1, Math.floor(charData.mp * growRate));
                const incAtk = Math.max(1, Math.floor(charData.atk * growRate));
                const incDef = Math.max(1, Math.floor(charData.def * growRate));
                const incSpd = Math.max(1, Math.floor(charData.spd * growRate));
                const incMag = Math.max(1, Math.floor(charData.mag * growRate));

                charData.hp += incHp; charData.mp += incMp;
                charData.atk += incAtk; charData.def += incDef;
                charData.spd += incSpd; charData.mag += incMag;
                
                const stats = App.calcStats(charData);
                charData.currentHp = stats.maxHp;
                charData.currentMp = stats.maxMp;

                let logMsg = `${charData.name}はLv${charData.level}になった！<br>HP+${incHp}, MP+${incMp}`;
                
                const newSkill = App.checkNewSkill(charData);
                if (newSkill) {
                    logMsg += `<br><span style="color:#ffff00;">${newSkill.name}を覚えた！</span>`;
                }
                logs.push(logMsg);
            } else { break; }
        }
        return logs;
    },

    checkNewSkill: (charData) => {
        const table = JOB_SKILLS[charData.job];
        if (table && table[charData.level]) return DB.SKILLS.find(s => s.id === table[charData.level]);
        return null;
    }
};

const Field = {
    x: 23, y: 28, ready: false, currentMapData: null,
    
    init: () => {
        if(App.data && !Field.currentMapData) {
            const mapW = MAP_DATA[0].length;
            const mapH = MAP_DATA.length;
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
        let nx = Field.x + dx;
        let ny = Field.y + dy;
        let tile = 'W';
        App.clearAction();

        if (Field.currentMapData) {
            if(nx < 0 || nx >= Field.currentMapData.width || ny < 0 || ny >= Field.currentMapData.height) return;
            tile = Field.currentMapData.tiles[ny][nx];
            if (tile === 'W') return; 
            Field.x = nx; Field.y = ny;
            App.data.location.x = nx; App.data.location.y = ny;
            App.save();
            Field.render();
            Dungeon.handleMove(nx, ny);
        } else {
            const mapW = MAP_DATA[0].length;
            const mapH = MAP_DATA.length;
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

    render: () => {
        const canvas = document.getElementById('field-canvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const ts = 32, w = canvas.width, h = canvas.height;
        ctx.fillStyle='#000'; ctx.fillRect(0,0,w,h);
        
        const cx = w / 2; const cy = h / 2;
        const rangeX = Math.ceil(w / (2 * ts)) + 1;
        const rangeY = Math.ceil(h / (2 * ts)) + 1;
        const mapW = Field.currentMapData ? Field.currentMapData.width : MAP_DATA[0].length;
        const mapH = Field.currentMapData ? Field.currentMapData.height : MAP_DATA.length;

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

                if(tile==='G') ctx.fillStyle='#282'; else if(tile==='W') ctx.fillStyle='#228'; else if(tile==='M') ctx.fillStyle='#642'; else if(tile==='T') ctx.fillStyle='#444'; else if(tile==='S') ctx.fillStyle='#dd0'; else if(tile==='C') ctx.fillStyle='#0dd'; else if(tile==='B') ctx.fillStyle='#d00'; else if(tile==='I') ctx.fillStyle='#fff'; else if(tile==='K') ctx.fillStyle='#ff0'; else if(tile==='E') ctx.fillStyle='#aaf'; else ctx.fillStyle='#000'; 
                ctx.fillRect(drawX, drawY, ts, ts);
                
                if(['S','C','B','I','K','E'].includes(tile)) {
                    ctx.fillStyle = '#000'; ctx.font = '20px sans-serif';
                    let char = tile;
                    if(!Field.currentMapData) { if(tile==='I') char='宿'; if(tile==='K') char='カ'; if(tile==='E') char='交'; }
                    ctx.fillText(char, drawX+6, drawY+24);
                }
            }
        }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke();
        let locName = Field.currentMapData ? `地下${Dungeon.floor}階` : `フィールド(${Field.x},${Field.y})`;
        document.getElementById('loc-name').innerText = locName;

        const mmSize = 80; const mmX = w - mmSize - 10; const mmY = 10; const range = 10; 
        ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(mmX, mmY, mmSize, mmSize); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(mmX, mmY, mmSize, mmSize);
        const dms = mmSize / (range*2); 
        for(let dy = -range; dy < range; dy++) {
            for(let dx = -range; dx < range; dx++) {
                let tx = Field.x + dx; let ty = Field.y + dy; let tile = 'W';
                if (Field.currentMapData) { if(tx>=0 && tx<mapW && ty>=0 && ty<mapH) tile = Field.currentMapData.tiles[ty][tx]; } 
                else { tile = MAP_DATA[((ty%mapH)+mapH)%mapH][((tx%mapW)+mapW)%mapW]; }
                ctx.fillStyle = '#000';
                if(tile === 'W') ctx.fillStyle = '#228'; else if(tile === 'G') ctx.fillStyle = '#282'; else if(tile === 'M') ctx.fillStyle = '#642'; else if(tile === 'T') ctx.fillStyle = '#666'; else if(tile === 'S') ctx.fillStyle = '#ff0'; else if(tile === 'C') ctx.fillStyle = '#0ff'; else if(tile === 'B') ctx.fillStyle = '#f00'; else if(tile === 'I') ctx.fillStyle = '#fff'; else if(tile === 'K') ctx.fillStyle = '#ff0'; else if(tile === 'E') ctx.fillStyle = '#aaf'; 
                if (dx===0 && dy===0) ctx.fillStyle = '#fff'; 
                if (ctx.fillStyle !== '#000') ctx.fillRect(mmX + (dx + range) * dms, mmY + (dy + range) * dms, dms, dms);
            }
        }
        ctx.restore();
    }

    /* main.js の Appオブジェクト内に追加 */

    // --- セーブデータ書き出し (ダウンロード) ---
    downloadSave: () => {
        if (!App.data) {
            Menu.msg("セーブデータがありません");
            return;
        }
        // データをJSON文字列化
        const json = JSON.stringify(App.data);
        const blob = new Blob([json], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        
        // ダウンロード用リンクを生成してクリック
        const a = document.createElement('a');
        a.href = url;
        a.download = `QoE_SaveData_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // --- セーブデータ読み込み (アップロード) ---
    importSave: () => {
        // ファイル選択ダイアログを動的に生成
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
                    
                    // 簡易チェック: 必須データが含まれているか
                    if (loadedData.gold !== undefined && loadedData.party && loadedData.characters) {
                        if (confirm("現在のデータを上書きして復元しますか？\n(ページがリロードされます)")) {
                            localStorage.setItem(CONST.SAVE_KEY, JSON.stringify(loadedData));
                            location.reload(); // 再読み込みして反映
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
        
        input.click(); // ダイアログを開く
    },
    
};
