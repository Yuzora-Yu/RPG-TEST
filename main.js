/* main.js */

// ==========================================================================
// クラス定義 (Battle.jsの要件を統合)
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
        this.status = {}; // 状態異常など
        this.isDead = this.hp <= 0;
        
        this.job = data.job || '冒険者';
        this.rarity = data.rarity || 'N';
        this.level = data.level || 1;
        this.img = data.img || null;
        this.limitBreak = data.limitBreak || 0;
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

    // --- Battle.js 用メソッド ---
    
    getStats() {
        // Battle.jsが期待するフォーマットでステータスを返す
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
        if (damage <= 0) {
            App.log(`ダメージを与えられない！`);
            return 0;
        }
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
    
    syncToAppData() {
        if(this instanceof Player) {
            this.originData.currentHp = this.hp;
            this.originData.currentMp = this.mp;
        }
    }
}

class Player extends Entity {
    constructor(data) {
        super(data);
        this.originData = data; 
        this.uid = data.uid;
        this.equips = data.equips || {};
        
        // 基本スキル
        this.skills = DB.SKILLS.filter(s => s.mp >= 0 && s.id < 100); 
        
        // マスタデータ参照 (固有スキル習得)
        if(data.charId) {
            const master = DB.CHARACTERS.find(c => c.id === data.charId);
            if(master && master.lbSkills) {
                // +50スキル
                if(this.limitBreak >= 50 && master.lbSkills[50]) {
                    const sk = DB.SKILLS.find(s => s.id === master.lbSkills[50]);
                    if(sk) this.skills.push(sk);
                }
                // +99スキル
                if(this.limitBreak >= 99 && master.lbSkills[99]) {
                    const sk = DB.SKILLS.find(s => s.id === master.lbSkills[99]);
                    if(sk) this.skills.push(sk);
                }
            }
        }
        
        // 主人公の特別スキル
        if(data.isHero) {
            if(this.limitBreak >= 10) this.skills.push(DB.SKILLS.find(s=>s.id===12)); // バギ
            if(this.limitBreak >= 50) this.skills.push(DB.SKILLS.find(s=>s.id===13)); // ライデイン
        }

        // シナジー確認
        this.synergy = App.checkSynergy(this.equips);
    }
}

class Monster extends Entity {
    constructor(data, scale=1.0) {
        super(data);
        this.id = data.id;
        this.data = data;
        // スケール反映
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

const App = {
    data: null,
    pendingAction: null, 

    // index.html用初期化
    initGameHub: () => {
        App.load();
        if(!App.data) { window.location.href = 'main.html'; return; }
        
        // 戦闘中なら復帰、そうでなければフィールドへ
        if (App.data.battle && App.data.battle.active) {
            App.log("戦闘に復帰します...");
            App.changeScene('battle');
        } else {
            App.log("冒険を開始します。");
            if(App.data.location) {
                // 正規化して読み込み (50x32範囲内へ)
                Field.x = App.data.location.x % 50;
                Field.y = App.data.location.y % 32;
            }
            App.changeScene('field');
        }
        
        // キー入力ハンドリング
        window.addEventListener('keydown', e => {
            if(document.getElementById('field-scene').style.display === 'flex') {
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

        // 画面ボタンハンドリング
        const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
        bind('btn-up', () => Field.move(0, -1));
        bind('btn-down', () => Field.move(0, 1));
        bind('btn-left', () => Field.move(-1, 0));
        bind('btn-right', () => Field.move(1, 0));
        bind('btn-menu', () => Menu.openMainMenu());
        bind('btn-ok', () => { if(App.pendingAction) App.executeAction(); else Menu.openMainMenu(); });
    },

    // アクションボタン制御
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
            App.clearAction(); // 実行前にクリア（重複防止）
            act();
        }
    },

    // main.html用初期化
    initTitleScreen: () => { 
        App.load(); 
        const btn = document.getElementById('btn-continue'); 
        if(App.data && btn) { 
            btn.disabled = false; 
            
            let name = '勇者';
            let lv = 1;
            if(App.data.party && App.data.party[0]) {
                const c = App.data.characters.find(ch => ch.uid === App.data.party[0]);
                if(c) { name = c.name; lv = c.level; }
            }
            btn.innerHTML = `続きから<br><span style="font-size:12px">(${name} Lv.${lv})</span>`;
        } 
    },

    // データIO
    load: () => { 
        try { 
            const j=localStorage.getItem(CONST.SAVE_KEY); 
            if(j){ 
                App.data=JSON.parse(j); 
                // データ補正
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
        } catch(e) {
            console.error(e);
            alert("セーブに失敗しました。容量不足の可能性があります。");
        }
    },
    
    // 新規ゲーム開始 (画像対応)
    startNewGame: () => {
        const fileInput = document.getElementById('player-icon');
        if(fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if(file.size > 500 * 1024) {
                alert("画像サイズが大きすぎます(500KB以下にしてください)");
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => { App.createGameData(e.target.result); };
            reader.onerror = () => { alert("画像の読み込みに失敗しました"); App.createGameData(null); };
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
        
        // 初期位置設定 (23, 60) -> 実質 (23, 28)
        App.data.location = { x: 23, y: 60 }; 
        App.data.walkCount = 0;

        // 初期アイテム配布
        for(let i=0;i<5;i++) App.data.inventory.push(App.createRandomEquip()); 
        
        try {
            localStorage.setItem(CONST.SAVE_KEY, JSON.stringify(App.data));
            window.location.href='index.html'; 
        } catch(e) {
            alert("データ作成に失敗しました。");
        }
    },
    
    continueGame: () => { window.location.href='index.html'; },
    returnToTitle: () => { App.save(); window.location.href='main.html'; },
    
    // シーン切り替え
    changeScene: (sceneId) => {
        document.querySelectorAll('.scene-layer').forEach(e => e.style.display = 'none');
        const target = document.getElementById(sceneId + '-scene');
        if(target) target.style.display = 'flex';
        
        if(typeof Menu !== 'undefined') Menu.closeAll();
        App.clearAction(); // シーン変わったらアクションリセット

        if(sceneId === 'field') Field.init();
        if(sceneId === 'battle') Battle.init();
        if(sceneId === 'inn') Facilities.initInn();
        if(sceneId === 'medal') Facilities.initMedal();
        if(sceneId === 'casino') Casino.init();
    },

    getChar: (uid) => App.data ? App.data.characters.find(c => c.uid === uid) : null,

    // ステータス計算 (基礎*倍率 -> 振分 -> 装備)
    calcStats: (char) => {
        const lb = char.limitBreak || 0;
        const multiplier = 1 + (lb * 0.05); // 限界突破補正 (+5%)
        
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

        // 主人公の振分ポイント
        if(char.uid === 'p1' && char.alloc) {
            for(let key in char.alloc) {
                const [type, elm] = key.split('_');
                if(type === 'elmAtk') s.elmAtk[elm] += char.alloc[key];
                if(type === 'elmRes') s.elmRes[elm] += char.alloc[key];
            }
        }

        // 装備補正
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

                if(eq.opts) eq.opts.forEach(o => {
                    if(o.unit === 'val') {
                        if(o.key === 'hp') s.maxHp += o.val;
                        else if(o.key === 'mp') s.maxMp += o.val;
                        else if(s[o.key] !== undefined) s[o.key] += o.val;
                        else if(o.key === 'elmAtk') s.elmAtk[o.elm] += o.val;
                    } else {
                        if(s[o.key] !== undefined) s[o.key] += o.val;
                    }
                });
            }
        });
        return s;
    },

    createRandomEquip: (source, floor) => {
        const candidates = DB.EQUIPS.filter(e => e.minF <= floor);
        const base = candidates.length > 0 ? candidates[Math.floor(Math.random()*candidates.length)] : DB.EQUIPS[0];
        const eq = { id:Date.now()+Math.random().toString(), name:base.name, type:base.type, val:base.val, data:JSON.parse(JSON.stringify(base.data)), opts:[] };
        
        let optNum = 0;
        if(source === 'shop') optNum = 0;
        else if(source === 'chest') optNum = Math.random()<0.5?0:(Math.random()<0.85?1:2);
        else optNum = Math.random()<0.6?1:(Math.random()<0.9?2:3); 

        for(let i=0; i<optNum; i++) {
            const rule = DB.OPT_RULES[Math.floor(Math.random()*DB.OPT_RULES.length)];
            let r='R'; const rv=Math.random()+(floor*0.005);
            if(rv>0.95 && rule.allowed.includes('EX')) r='EX';
            else if(rv>0.85 && rule.allowed.includes('UR')) r='UR';
            else if(rv>0.7 && rule.allowed.includes('SSR')) r='SSR';
            else if(rv>0.5 && rule.allowed.includes('SR')) r='SR';
            else if(!rule.allowed.includes('R')) r = rule.allowed[0];

            const min=rule.min[r]||1, max=rule.max[r]||10;
            eq.opts.push({
                key:rule.key, elm:rule.elm, label:rule.name, 
                val:Math.floor(Math.random()*(max-min+1))+min, unit:rule.unit, rarity:r
            });
        }
        if(optNum>0) eq.name+=`+${optNum}`;
        if(App.checkSynergy(eq)) eq.isSynergy=true;
        return eq;
    },
    checkSynergy: (eq) => { if(!eq.opts||eq.opts.length<3) return null; const fk=eq.opts[0].key; if(eq.opts.every(o=>o.key===fk)) return DB.SYNERGIES.find(s=>s.key===fk&&s.count<=eq.opts.length); return null; },
    log: (msg) => { const e=document.getElementById('msg-text'); if(e) e.innerText=msg; },
    // ★修正: 詳細なキャラ表示HTML生成 (Lv, HP, MP, ステータスを表示)
    createCharHTML: (c) => {
        const s = App.calcStats(c);
        const hp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
        const mp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
        const img = c.img ? `<img src="${c.img}" style="width:100%; height:100%; object-fit:cover;">` : 'IMG';
        
        return `
        <div class="char-row">
            <div class="char-thumb">${img}</div>
            <div class="char-info">
                <div class="char-name">
                    ${c.name} <span class="rarity-${c.rarity}">[${c.rarity}]</span> +${c.limitBreak||0}
                </div>
                <div class="char-meta">
                    ${c.job} Lv.${c.level}
                </div>
                <div class="char-stats">
                    <span style="color:#f88;">HP:${hp}/${s.maxHp}</span>
                    <span style="color:#88f;">MP:${mp}/${s.maxMp}</span>
                    <span>攻:${s.atk}</span> <span>防:${s.def}</span> <span>速:${s.spd}</span>
                </div>
            </div>
        </div>`;
    }
};

/* ==========================================================================
   フィールド処理
   ========================================================================== */

const Field = {
    x: 23, y: 60, ready: false, currentMapData: null,
    
    init: () => {
        if(App.data && !Field.currentMapData) {
            // 50x32の範囲内に正規化して読み込み
            Field.x = App.data.location.x % 50;
            Field.y = App.data.location.y % 32;
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
            // ダンジョン
            if(nx < 0 || nx >= Field.currentMapData.width || ny < 0 || ny >= Field.currentMapData.height) return;
            tile = Field.currentMapData.tiles[ny][nx];
            if (tile === 'W') return; 
            Field.x = nx; Field.y = ny;
            App.data.location.x = nx; App.data.location.y = ny;
            App.save();
            Field.render();
            Dungeon.handleMove(nx, ny);
        } else {
            // フィールド (50x32 ループ)
            const mapW = 50; 
            const mapH = 32;
            
            // ループ計算
            nx = (nx + mapW) % mapW;
            ny = (ny + mapH) % mapH;
            
            // マップデータ参照
            tile = MAP_DATA[ny][nx];

            if (tile === 'M') { App.log("山だ"); return; }
            if (tile === 'W') { App.log("海だ"); return; }

            Field.x = nx; Field.y = ny; 
            App.data.location.x = nx; App.data.location.y = ny; 
            
            if(App.data.walkCount === undefined) App.data.walkCount = 0;
            App.data.walkCount++;

            App.save(); 
            Field.render();

            // 施設判定 (I=宿, K=カジノ, E=交換所)
            if (tile === 'I') {
                App.log("宿屋がある");
                App.setAction("宿屋に入る", () => App.changeScene('inn'));
            }
            else if (tile === 'K') {
                App.log("カジノがある");
                App.setAction("カジノに入る", () => App.changeScene('casino'));
            }
            else if (tile === 'E') { 
                App.log("交換所がある");
                App.setAction("メダル交換", () => App.changeScene('medal'));
            }
            else {
                // 歩数連動エンカウント率
                let rate = 0.03;
                if (App.data.walkCount > 30) rate = 0.08;
                else if (App.data.walkCount > 15) rate = 0.05;

                if(Math.random() < rate) {
                    App.data.walkCount = 0;
                    App.log("敵だ！");
                    setTimeout(()=>App.changeScene('battle'),300);
                }
            }
        }
    },

    render: () => {
        const canvas = document.getElementById('field-canvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const ts = 32, w = canvas.width, h = canvas.height;
        ctx.fillStyle='#000'; ctx.fillRect(0,0,w,h);
        
        const cx = w / 2;
        const cy = h / 2;
        const rangeX = Math.ceil(w / (2 * ts)) + 1;
        const rangeY = Math.ceil(h / (2 * ts)) + 1;

        for (let dy = -rangeY; dy <= rangeY; dy++) {
            for (let dx = -rangeX; dx <= rangeX; dx++) {
                const drawX = Math.floor(cx + (dx * ts) - (ts / 2));
                const drawY = Math.floor(cy + (dy * ts) - (ts / 2));
                
                let tx = Field.x + dx;
                let ty = Field.y + dy;
                let tile = 'W';

                if (Field.currentMapData) {
                    if (tx >= 0 && tx < Field.currentMapData.width && ty >= 0 && ty < Field.currentMapData.height) {
                        tile = Field.currentMapData.tiles[ty][tx];
                    }
                } else {
                    const mapW = 50;
                    const mapH = 32;
                    const lx = ((tx % mapW) + mapW) % mapW;
                    const ly = ((ty % mapH) + mapH) % mapH;
                    tile = MAP_DATA[ly][lx];
                }

                if(tile==='G') ctx.fillStyle='#282';
                else if(tile==='W') ctx.fillStyle='#228';
                else if(tile==='M') ctx.fillStyle='#642';
                else if(tile==='T') ctx.fillStyle='#444'; 
                else if(tile==='S') ctx.fillStyle='#dd0'; 
                else if(tile==='C') ctx.fillStyle='#0dd'; 
                else if(tile==='B') ctx.fillStyle='#d00'; 
                else if(tile==='I') ctx.fillStyle='#fff';
                else if(tile==='K') ctx.fillStyle='#ff0';
                else if(tile==='E') ctx.fillStyle='#aaf'; 
                else ctx.fillStyle='#000'; 

                ctx.fillRect(drawX, drawY, ts, ts);
                
                if(['S','C','B','I','K','E'].includes(tile)) {
                    ctx.fillStyle = '#000';
                    ctx.font = '20px sans-serif';
                    let char = tile;
                    if(!Field.currentMapData) {
                        if(tile==='I') char='宿';
                        if(tile==='K') char='カ';
                        if(tile==='E') char='交';
                    }
                    ctx.fillText(char, drawX+6, drawY+24);
                }
            }
        }
        
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.stroke();
        
        let locName = Field.currentMapData ? `地下${Dungeon.floor}階` : `フィールド(${Field.x},${Field.y})`;
        document.getElementById('loc-name').innerText = locName;

        // --- ミニマップ ---
        const mmSize = 80;
        const mmX = w - mmSize - 10;
        const mmY = 10;
        const range = 10; 

        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#000';
        ctx.fillRect(mmX, mmY, mmSize, mmSize);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX, mmY, mmSize, mmSize);

        const dms = mmSize / (range*2); 

        for(let dy = -range; dy < range; dy++) {
            for(let dx = -range; dx < range; dx++) {
                let tx = Field.x + dx;
                let ty = Field.y + dy;
                let tile = 'W';

                if (Field.currentMapData) {
                    if(tx>=0 && tx<Field.currentMapData.width && ty>=0 && ty<Field.currentMapData.height) 
                        tile = Field.currentMapData.tiles[ty][tx];
                } else {
                    const mapW = 50;
                    const mapH = 32;
                    // ミニマップもループ
                    tile = MAP_DATA[((ty%mapH)+mapH)%mapH][((tx%mapW)+mapW)%mapW];
                }

                ctx.fillStyle = '#000';
                if(tile === 'W') ctx.fillStyle = '#228';
                else if(tile === 'G') ctx.fillStyle = '#282';
                else if(tile === 'M') ctx.fillStyle = '#642';
                else if(tile === 'T') ctx.fillStyle = '#666';
                else if(tile === 'S') ctx.fillStyle = '#ff0';
                else if(tile === 'C') ctx.fillStyle = '#0ff';
                else if(tile === 'B') ctx.fillStyle = '#f00';
                else if(tile === 'I') ctx.fillStyle = '#fff';
                else if(tile === 'K') ctx.fillStyle = '#ff0';
                else if(tile === 'E') ctx.fillStyle = '#aaf'; 
                
                if (dx===0 && dy===0) ctx.fillStyle = '#fff'; 

                if (ctx.fillStyle !== '#000') {
                    ctx.fillRect(mmX + (dx + range) * dms, mmY + (dy + range) * dms, dms, dms);
                }
            }
        }
        ctx.restore();
    }
};
