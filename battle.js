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
    
    // ステータス表示名マッピング
    statNames: {
        atk: '攻撃力', def: '守備力', spd: '素早さ', mag: '魔力',
        elmResUp: '全属性耐性', elmResDown: '全属性耐性',
        Poison: '毒', ToxicPoison: '猛毒', Shock: '感電', Fear: '怯え',
        SpellSeal: '呪文封印', SkillSeal: '特技封印', HealSeal: '回復封印',HPRegen: 'HP回復' ,MPRegen: 'MP回復'
    },
    
    // 状態異常と耐性IDの対応表
    RESIST_MAP: {
        Poison: 'Poison', ToxicPoison: 'Poison',
        Shock: 'Shock',
        Fear: 'Fear',
        SpellSeal: 'Seal', SkillSeal: 'Seal', HealSeal: 'Seal',
        PercentDamage: 'InstantDeath',
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
	
    init: () => {
        Battle.active = true;
        Battle.phase = 'init';
        Battle.commandQueue = [];
        Battle.currentActorIndex = 0;
        Battle.auto = false;
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
            if (typeof Field !== 'undefined' && Field.currentMapData && Field.currentMapData.isDungeon) {
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
                // 必要であれば 'M' (通常の山) もここに追加
                // else if (tile === 'M') bgKey = 'battle_bg_mountain';
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
                
                player.passive = Battle.getPassives(player);
				
                //Battle.initBattleStatus(player);
				// ★修正: 保存された状態があれば復元、なければ初期化
                if (charData.battleStatus) {
                    player.battleStatus = JSON.parse(JSON.stringify(charData.battleStatus));
                } else {
                    Battle.initBattleStatus(player);
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
                if(base.acts) m.acts = base.acts; // 復帰時もactsを継承

                m.atk = m.baseStats.atk;
                m.def = m.baseStats.def;
                m.spd = m.baseStats.spd;
                m.mag = m.baseStats.mag;
                m.elmAtk = {}; 
                m.elmRes = {};
                m.finDmg = 0;
                m.finRed = 0;

                m.passive = base.passive || {};
                //Battle.initBattleStatus(m);
				// ★修正: 保存された状態があれば復元、なければ初期化
                if (e.battleStatus) {
                    m.battleStatus = e.battleStatus;
                } else {
                    Battle.initBattleStatus(m);
                }
				
                return m;
            }).filter(e => e !== null);
        } else {
            const isBoss = App.data.battle && App.data.battle.isBossBattle;
            Battle.enemies = Battle.generateNewEnemies(isBoss);
            Battle.enemies.forEach(e => {
                Battle.initBattleStatus(e);
                const base = DB.MONSTERS.find(m => m.id === e.id);
                e.passive = base ? (base.passive || {}) : {};
            });
            
            App.data.battle = {
                active: true, isBossBattle: isBoss,
                enemies: Battle.enemies.map(e => ({ baseId: e.id, hp: e.baseMaxHp, maxHp: e.baseMaxHp, name: e.name }))
            };
            App.save();
        }
        
        Battle.renderEnemies();
        Battle.renderPartyStatus();

        const scene = document.getElementById('battle-scene');
        if(scene) {
            scene.onclick = (e) => {
                // 戦闘結果画面(result)のときだけ、クリックで終了処理へ進む
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
                    const syn = App.checkSynergy(eq);
                    if (syn && syn.effect) passives[syn.effect] = true;
                }
            });
        }
        return passives;
    },

    initBattleStatus: (actor) => {
        actor.battleStatus = { buffs: {}, debuffs: {}, ailments: {} };
    },

    getBattleStat: (actor, key) => {
        let val = (actor[key] !== undefined) ? actor[key] : 0;
        if (val === 0 && typeof actor.getStat === 'function') val = actor.getStat(key);
        if (key === 'maxHp') val = actor.baseMaxHp;
        if (key === 'maxMp') val = actor.baseMaxMp;
        if (key === 'resists') return actor.resists || val || {};

        const b = actor.battleStatus;
        if (!b) return val;
        if (b.buffs[key]) val = Math.floor(val * b.buffs[key].val);
        if (b.debuffs[key]) val = Math.floor(val * b.debuffs[key].val);
        return val;
    },

    generateNewEnemies: (isBoss) => {
        const newEnemies = [];
        const floor = App.data.progress.floor || 1; 
        const setupEnemyStats = (m) => {
            m.atk = m.baseStats.atk;
            m.def = m.baseStats.def;
            m.spd = m.baseStats.spd;
            m.mag = m.baseStats.mag;
            m.elmAtk = {}; m.elmRes = {};
            m.finDmg = 0; m.finRed = 0;
            return m;
        };

        if (isBoss) {
            Battle.log("強大な魔物が現れた！");
            const bosses = DB.MONSTERS.filter(m => m.minF === floor && m.actCount && m.id >= 1000);
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
            Battle.log("モンスターが現れた！");
            if (Math.random() < 0.05) {
                const rares = DB.MONSTERS.filter(m => !m.actCount && m.minF <= floor && m.id < 1000);
                if (rares.length > 0) {
                    const m = new Monster(rares[Math.floor(Math.random() * rares.length)], 1.0);
                    newEnemies.push(setupEnemyStats(m));
                    return newEnemies;
                }
            }
            const count = 1 + Math.floor(Math.random() * 3);
            for(let i=0; i<count; i++) {
                if (window.generateEnemy) {
                    const enemyData = window.generateEnemy(floor);
                    const m = new Monster(enemyData, 1.0);
                    if (count > 1) m.name += String.fromCharCode(65+i);
                    newEnemies.push(setupEnemyStats(m));
                }
            }
        }
        return newEnemies;
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
        const nameDiv = Battle.getEl('battle-actor-name');
        if(nameDiv) {
            nameDiv.style.display = 'block';
            nameDiv.innerText = `【${actor.name}】の行動`;
        }
        
        Battle.updateCommandButtons(); 
        Battle.log(`${actor.name}はどうする？`);

        if (Battle.auto) {
            const target = Battle.getRandomAliveEnemy();
            if (target) {
                Battle.registerAction({ type: 'attack', actor: actor, target: target });
            } else {
                Battle.registerAction({ type: 'defend', actor: actor });
            }
        }
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
            //const actor = Battle.party[Battle.currentActorIndex];
            //if (actor.battleStatus.ailments['SkillSeal']) {
            //    Battle.log("攻撃特技が封印されていて動けない！");
            //    return;
            //}
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

        actor.skills.forEach(sk => {
            if (sk.id === 1) return;

            const div = document.createElement('div');
            div.className = 'list-item';
            
            let isDisabled = false;
            let note = "";
            if (actor.battleStatus.ailments['SpellSeal'] && (sk.type === '魔法' || sk.type === '強化' || sk.type === '弱体')) { isDisabled = true; note = "(封印)"; }
            if (actor.battleStatus.ailments['SkillSeal'] && (sk.type === '物理' || sk.type === '特殊')) { isDisabled = true; note = "(封印)"; }
            if (actor.battleStatus.ailments['HealSeal'] && (sk.type === '回復' || sk.type === '蘇生')) { isDisabled = true; note = "(封印)"; }

            let elmHtml = '';
            if (sk.elm) {
                let color = '#ccc';
                if(sk.elm === '火') color = '#f88';
                else if(sk.elm === '水') color = '#88f';
                else if(sk.elm === '雷') color = '#ff0';
                else if(sk.elm === '風') color = '#8f8';
                else if(sk.elm === '光') color = '#ffc';
                else if(sk.elm === '闇') color = '#a8f';
                else if(sk.elm === '混沌') color = '#d4d';
                elmHtml = `<span style="color:${color}; margin-right:3px;">[${sk.elm}]</span>`;
            }

            // ★修正: フォントサイズを全体的に縮小調整
            // 名前: bold削除, 14px相当→12px
            // 注釈/ターゲット: 10px→9px
            // 説明文: 10px→9px
            // MP: 12px→11px
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
                if (sk.id === 500) { 
                     if (actor.mp <= 0) { Battle.log("MPが足りません"); return; }
                } else {
                     if (actor.mp < sk.mp) { Battle.log("MPが足りません"); return; }
                }
                Battle.selectedItemOrSkill = sk;
                Battle.openTargetWindow(sk.target, sk);
            };
            content.appendChild(div);
        });

        // ★追加: スクロール位置の復元と保存イベントの設定
        // actor.uid をキーにして位置を管理します
        const uid = actor.uid || ('temp_' + Battle.currentActorIndex); // uidがない場合のフォールバック
        
        // 保存された位置があれば復元
        if (Battle.skillScrollPositions && Battle.skillScrollPositions[uid] !== undefined) {
            content.scrollTop = Battle.skillScrollPositions[uid];
        } else {
            content.scrollTop = 0;
        }

        // スクロール時に現在位置を保存
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
        if(Math.random() < 0.5) {
            Battle.log("逃げ出した！");
            Battle.endBattle(false);
        } else {
            Battle.log("回り込まれてしまった！");
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
            if (s.id === 500) { if (e.mp <= 0) return false; }
            else if (e.mp < s.mp) return false;

            // Seal Check (現在の状態を参照)
            if (e.battleStatus.ailments['SpellSeal'] && (['魔法','強化','弱体'].includes(s.type))) return false;
            if (e.battleStatus.ailments['SkillSeal'] && (['物理','特殊'].includes(s.type))) return false;
            if (e.battleStatus.ailments['HealSeal'] && (['回復','蘇生','MP回復'].includes(s.type))) return false;
			// ※通常攻撃(ID:1)は除外済

            // Logic: 蘇生対象がいなければ使わない
            if (s.type === '蘇生') {
                const hasDeadAlly = Battle.enemies.some(ally => ally.isDead && !ally.isFled);
                if (!hasDeadAlly) return false;
            }

            return true;
        });

        // ② 行動抽選
        let selectedActId = 1; // Default
        if (validActions.length > 0) {
            let totalWeight = validActions.reduce((sum, a) => sum + ((typeof a === 'object') ? (a.rate || 0) : 10), 0);
            if (totalWeight <= 0) {
                const rndObj = validActions[Math.floor(Math.random() * validActions.length)];
                selectedActId = (typeof rndObj === 'object') ? rndObj.id : rndObj;
            } else {
                let r = Math.random() * totalWeight;
                for (const act of validActions) {
                    const rate = (typeof act === 'object') ? (act.rate || 0) : 10;
                    r -= rate;
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

    // ★修正: 敵AIロジック刷新
    executeTurn: async () => {
        Battle.phase = 'execution';
        const nameDiv = Battle.getEl('battle-actor-name');
        if(nameDiv) nameDiv.style.display = 'none';
        Battle.log("--- ターン開始 ---");

        // 敵AI行動決定プロセス (ターン開始時の仮決定: 素早さ計算のため)
        Battle.enemies.forEach(e => {
            if (!e.isDead && !e.isFled) {
                const count = e.actCount || 1;
                for(let i=0; i<count; i++) {
                    // ★修正: 新しい関数で行動を決定
                    const decision = Battle.decideEnemyAction(e);
                    
                    // 素早さ計算 (仮決定の内容に基づく)
                    let spd = Battle.getBattleStat(e, 'spd');
                    let baseSpeed = spd * (0.8 + Math.random() * 0.4);
                    const finalSpeed = baseSpeed + (decision.priority * 100000);

                    Battle.commandQueue.push({
                        type: decision.type,
                        actor: e,
                        speed: finalSpeed,
                        isEnemy: true,
                        data: decision.data,
                        targetScope: decision.targetScope,
                        target: null 
                    });
                }
            }
        });
        
        // プレイヤーの行動キュー処理
        const playerCommands = Battle.commandQueue.filter(c => !c.isEnemy && c.type !== 'skip' && c.type !== 'defend');
        Battle.commandQueue = Battle.commandQueue.filter(c => c.isEnemy || c.type === 'skip' || c.type === 'defend'); 
        
        for(let cmd of playerCommands) {
            const actor = cmd.actor;
            const isDoubleAction = actor.passive && actor.passive.doubleAction && Math.random() < 0.2;
            const isFastestAction = actor.passive && actor.passive.fastestAction && Math.random() < 0.2;
            
            if (isFastestAction) {
                const spd = Battle.getBattleStat(actor, 'spd');
                cmd.speed = (spd * (0.9 + Math.random() * 0.2)) + (10 * 100000);
                Battle.log(`【${actor.name}】は最速で行動する！`);
            }

            Battle.commandQueue.push(cmd);
            
            if (isDoubleAction) {
                const extraCmd = { ...cmd };
                extraCmd.speed = cmd.speed - 1; 
                Battle.commandQueue.push(extraCmd);
                Battle.log(`【${actor.name}】は2回行動する！`);
            }
        }

        Battle.commandQueue.sort((a, b) => b.speed - a.speed);

        // --- 行動実行ループ ---
        for (const cmd of Battle.commandQueue) {
            if (!Battle.active) break;
            const actor = cmd.actor;

            if (cmd.type === 'skip') {
                await Battle.onActionEnd(actor);
                continue;
            }
            if (!actor || actor.hp <= 0 || actor.isFled) continue;

            // ★追加: 敵の場合、行動直前に再思考する
            if (cmd.isEnemy) {
                const reDecision = Battle.decideEnemyAction(actor);
                cmd.type = reDecision.type;
                cmd.data = reDecision.data;
                cmd.targetScope = reDecision.targetScope;
                // ※ speed(行動順)は変更しない（ターン開始時のまま）
            }


            if (actor.battleStatus.ailments['Fear']) {
                if (Math.random() < (actor.battleStatus.ailments['Fear'].chance || 0.7)) {
                    Battle.log(`【${actor.name}】は 怯えて動けない！`);
                    await Battle.onActionEnd(actor);
                    await Battle.wait(500);
                    continue;
                }
            }

            if (cmd.type === 'flee') {
                 Battle.log(`【${cmd.actor.name}】は逃げ出した！`);
                 cmd.actor.isFled = true;
                 cmd.actor.hp = 0; 
                 Battle.renderEnemies();
                 if (Battle.checkFinish()) return;
                 await Battle.wait(500);
                 continue;
            }

            // ターゲット自動選択 (敵AI)
            if (cmd.isEnemy && !cmd.target && cmd.targetScope !== '全体' && cmd.targetScope !== 'ランダム') {
                let isSupport = false;
                const type = cmd.data ? cmd.data.type : '';
                if (cmd.data && (
                    type.includes('回復') || type === '強化' || type === '蘇生' || type === 'MP回復' || 
                    cmd.data.debuff_reset || cmd.data.HPRegen || cmd.data.MPRegen || cmd.data.CureAilments
                )) {
                    isSupport = true;
                }

                if (isSupport) {
                    let pool = [];
                    if (cmd.data && cmd.data.type === '蘇生') pool = Battle.enemies.filter(e => e.isDead && !e.isFled);
                    else pool = Battle.enemies.filter(e => !e.isDead && !e.isFled);

                    if (pool.length > 0) cmd.target = pool[Math.floor(Math.random() * pool.length)];
                    else {
                        if (cmd.data.type === '蘇生') {
                             // 蘇生対象がいない場合は通常攻撃に切り替え
                             cmd.type = 'enemy_attack'; cmd.data = null; 
                             const aliveParty = Battle.party.filter(p => p && !p.isDead);
                             if(aliveParty.length > 0) cmd.target = aliveParty[Math.floor(Math.random() * aliveParty.length)];
                        } else cmd.target = cmd.actor; 
                    }
                } else {
                    const aliveParty = Battle.party.filter(p => p && !p.isDead);
                    if (aliveParty.length === 0) break;
                    cmd.target = aliveParty[Math.floor(Math.random() * aliveParty.length)];
                }
            }

            // ★追加: プレイヤーのターゲットが死んでいる場合のリターゲット処理
            // (ターゲット指定があり、かつその対象が死んでいる/逃げている場合)
            if (cmd.target && (cmd.target.isDead || cmd.target.isFled)) {
                
                // 対象が「モンスター」の場合のみ、別の生存モンスターを探す
                if (Battle.enemies.includes(cmd.target)) {
                    const aliveEnemies = Battle.enemies.filter(e => !e.isDead && !e.isFled);
                    if (aliveEnemies.length > 0) {
                        // ランダムに別の敵を選ぶ
                        const newTarget = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
                        cmd.target = newTarget;
                    }
                }
            }

            await Battle.processAction(cmd);
            await Battle.onActionEnd(actor); 

            Battle.updateDeadState();
            Battle.renderEnemies();
            Battle.renderPartyStatus();
            if (Battle.checkFinish()) return;
            await Battle.wait(500);
        }

        // ★追加: ターン終了時のボス自動回復処理
        // 生存している敵の中にボス(ID>=1000)がいれば回復
        Battle.enemies.forEach(e => {
            if (!e.isDead && !e.isFled && e.id >= 1000) {
                const rec = Math.floor(e.baseMaxHp * 0.05); // 5%回復
                if (rec > 0 && e.hp < e.baseMaxHp) {
                    e.hp = Math.min(e.baseMaxHp, e.hp + rec);
                    //Battle.log(`【${e.name}】の傷が再生していく... (HP+${rec})`);
                    Battle.renderEnemies(); // HPバー更新
                }
            }
        });

        Battle.saveBattleState();
        Battle.startInputPhase();
    },

    onActionEnd: async (actor) => {
        if (!actor) return;
        const b = actor.battleStatus;

        ['buffs', 'debuffs', 'ailments'].forEach(cat => {
            for (let key in b[cat]) {
                const eff = b[cat][key];
                if (eff.turns !== undefined && eff.turns !== null) {
                    eff.turns--;
                    if (eff.turns <= 0) {
                        delete b[cat][key];
                        if (cat === 'buffs') Battle.log(`【${actor.name}】の ${Battle.statNames[key]||key} アップの効果が切れた！`);
                        if (cat === 'debuffs') Battle.log(`【${actor.name}】の ${Battle.statNames[key]||key} ダウンの効果が切れた！`);
                        if (cat === 'ailments') Battle.log(`【${actor.name}】の ${Battle.statNames[key]||key} が解けた！`);
                    }
                }
            }
        });

        if (actor.hp > 0) {
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
                if (actor.hp <= 0) { actor.hp = 0; actor.isDead = true; Battle.log(`【${actor.name}】は倒れた！`); }
            }
        }

        if (actor.hp > 0 && b.buffs['HPRegen']) {
            let rec = Math.floor(actor.baseMaxHp * b.buffs['HPRegen'].val);
            if (rec > 0) {
                actor.hp = Math.min(actor.baseMaxHp, actor.hp + rec);
                Battle.log(`【${actor.name}】のHPが ${rec} 回復した！`);
            }
        }
        if (actor.hp > 0 && b.buffs['MPRegen']) {
            let rec = Math.floor(actor.baseMaxMp * b.buffs['MPRegen'].val);
            if (rec > 0) {
                actor.mp = Math.min(actor.baseMaxMp, actor.mp + rec);
                Battle.log(`【${actor.name}】のMPが ${rec} 回復した！`);
            }
        }

        if (actor.hp > 0 && actor.passive && actor.passive.hpRegen) {
             const rec = Math.floor(actor.baseMaxHp * 0.05);
             if (rec > 0 && actor.hp < actor.baseMaxHp) {
                 actor.hp = Math.min(actor.baseMaxHp, actor.hp + rec);
                 Battle.log(`【${actor.name}】のHPが ${rec} 自動回復`);
             }
        }

    },

    processAction: async (cmd) => {
        const actor = cmd.actor;
        const data = cmd.data;
        const actorName = Battle.getColoredName(actor);

        // --- ★追加: 実行時の封印チェック ---
        const type = data ? data.type : '通常攻撃';
        const ailments = actor.battleStatus.ailments;

        // 1. 呪文封印 (魔法・強化・弱体)
        if (ailments['SpellSeal']) {
            if (['魔法', '強化', '弱体'].includes(type)) {
                Battle.log(`${actorName}は 呪文が封じられていて動けない！`);
                return;
            }
        }

        // 2. 特技封印 (物理・特殊) ※通常攻撃は除く
        if (ailments['SkillSeal']) {
            if (['物理', '特殊'].includes(type) && type !== '通常攻撃') {
                Battle.log(`${actorName}は 特技が封じられていて動けない！`);
                return;
            }
        }

        // 3. 回復封印 (回復・蘇生)
        if (ailments['HealSeal']) {
            if (type.includes('回復') || type === '蘇生') {
                Battle.log(`${actorName}は 回復が封じられていて動けない！`);
                return;
            }
        }
        // ------------------------------------
		
        if (cmd.type === 'defend') {
            Battle.log(`【${actor.name}】は身を守っている`);
            actor.status = actor.status || {};
            actor.status.defend = true;
            return;
        }
        if(actor.status) actor.status.defend = false;

        if (cmd.type === 'item') {
            const item = data;
            Battle.log(`【${actor.name}】は${item.name}を使った！`);
            if (App.data.items && App.data.items[item.id] > 0) {
                if(item.type !== '貴重品') {
                    App.data.items[item.id]--;
                    if(App.data.items[item.id]<=0) delete App.data.items[item.id];
                }
                const targets = (cmd.target === 'all_ally') ? Battle.party : [cmd.target];
                for (let t of targets) {
                    if (!t) continue;
                    if (item.type === '蘇生') {
                        if (t.isDead) { t.isDead = false; t.hp = Math.floor(t.baseMaxHp * 0.5); Battle.log(`【${t.name}】は生き返った！`); }
                        else Battle.log(`【${t.name}】には効果がなかった`);
                    } else if (item.type === 'HP回復') {
                        if(!t.isDead) {
                            let rec = item.val; if (item.val >= 9999) rec = t.baseMaxHp;
                            t.hp = Math.min(t.baseMaxHp, t.hp + rec); Battle.log(`【${t.name}】のHPが${rec}回復！`);
                        }
                    } else if (item.type === 'MP回復') {
                         if(!t.isDead) {
                            let rec = item.val; if (item.val >= 9999) rec = t.baseMaxMp;
                            t.mp = Math.min(t.baseMaxMp, t.mp + rec); Battle.log(`【${t.name}】のMPが${rec}回復！`);
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
                        if (!cured) Battle.log(`【${t.name}】には効果がなかった`);
                    }
                }
            }
            Battle.renderPartyStatus();
            return;
        }

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
            isPhysical = (data.type === '物理' || data.type === '通常攻撃');
            skillRate = data.rate;
            baseDmg = data.base;
            mpCost = data.mp;
            effectType = data.type;
            element = data.elm;
            hitCount = (typeof data.count === 'number') ? data.count : 1;
            if (data.SuccessRate !== undefined) rawSuccessRate = data.SuccessRate;
            
            if (data.id === 500) { mpCost = actor.mp; }

            if (actor.mp < mpCost && data.id !== 500) {
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
            let baseBaseDmg = mpCost * 5;
            let hitCount = (typeof data.count === 'number') ? data.count : 1;
            const pool = cmd.isEnemy ? Battle.party.filter(p=>p && !p.isDead) : Battle.enemies.filter(e=>!e.isDead && !e.isFled);
            let loopTargets = [];
            
            if (cmd.targetScope === 'ランダム') {
                if (pool.length > 0) loopTargets = [pool[0]];
            } else if (cmd.targetScope === '単体' && cmd.target) {
                if (!cmd.target.isDead) loopTargets = [cmd.target];
            } else {
                loopTargets = pool;
            }

            Battle.renderEnemies();
            Battle.renderPartyStatus();

            for (let t of loopTargets) {
                if (!t) continue;
                if (cmd.targetScope !== 'ランダム' && t.isDead) continue;

                for (let i = 0; i < hitCount; i++) {
                    let targetToHit = t;
                    if (cmd.targetScope === 'ランダム') {
                        const currentPool = cmd.isEnemy ? Battle.party.filter(p=>p && !p.isDead) : Battle.enemies.filter(e=>!e.isDead && !e.isFled);
                        if (currentPool.length === 0) break;
                        targetToHit = currentPool[Math.floor(Math.random() * currentPool.length)];
                    }

                    if (!targetToHit || targetToHit.isDead) continue;

                    let bonusRate = 0; 
                    let cutRate = 0;   
                    let isImmune = false; 

                    if (element) {
                        const elmAtkVal = (Battle.getBattleStat(actor, 'elmAtk') || {})[element] || 0;
                        if (elmAtkVal > 0) bonusRate += elmAtkVal;

                        const baseRes = (targetToHit.getStat('elmRes') || {})[element] || 0;
                        const buffRes = (targetToHit.battleStatus.buffs['elmResUp'] || {}).val || 0;
                        const debuffRes = (targetToHit.battleStatus.debuffs['elmResDown'] || {}).val || 0;
                        let resVal = baseRes + buffRes - debuffRes;

                        if (resVal >= 100) isImmune = true; 
                        else cutRate += resVal;             
                    }

                    const finDmgVal = Battle.getBattleStat(actor, 'finDmg') || 0; 
                    if (finDmgVal > 0) bonusRate += finDmgVal;

                    let finRed = Battle.getBattleStat(targetToHit, 'finRed') || 0;
                    if (targetToHit.passive && targetToHit.passive.finRed10) finRed += 10;
                    if (finRed > 80) finRed = 80;
                    if (finRed > 0) cutRate += finRed;

                    let dmg = baseBaseDmg;

                    if (!isImmune) {
                        if (bonusRate > 0) dmg = dmg * (1.0 + bonusRate / 100);
                        dmg = dmg * (1.0 - cutRate / 100);
                        dmg = dmg * (0.9 + Math.random() * 0.2);
                        if (targetToHit.status && targetToHit.status.defend) dmg = dmg * 0.5;
                        dmg = Math.floor(dmg);
                        if (dmg < 1) dmg = 1;
                    } else {
                        dmg = 0;
                    }

                    targetToHit.hp -= dmg;
                    
                    let dmgColor = '#fff';
                    if(element === '火') dmgColor = '#f88'; 
                    else if(element === '水') dmgColor = '#88f'; 
                    else if(element === '雷') dmgColor = '#ff0';
                    else if(element === '風') dmgColor = '#8f8'; 
                    else if(element === '光') dmgColor = '#ffc'; 
                    else if(element === '闇') dmgColor = '#a8f'; 
                    else if(element === '混沌') dmgColor = '#d4d';

                    if (dmg === 0) {
                        Battle.log(`ミス！ 【${targetToHit.name}】は ダメージを うけない！`);
                    } else {
                        Battle.log(`【${targetToHit.name}】に<span style="color:${dmgColor}">${dmg}</span>のダメージ！`);
                    }

                    if (targetToHit.hp <= 0) { 
                        targetToHit.hp = 0; 
                        targetToHit.isDead = true; 
                        Battle.log(`【${targetToHit.name}】は倒れた！`); 
                    }

                    Battle.renderEnemies();
                    Battle.renderPartyStatus();
                    if (hitCount > 1) await Battle.wait(150);
                }
            }
            
            await Battle.wait(500);
            return;
        }

        let targets = [];
        let scope = cmd.targetScope;
        if (!scope && cmd.target === 'all_enemy') scope = '全体';
        if (!scope && cmd.target === 'all_ally') scope = '全体';
        if (!scope && cmd.target === 'random') scope = 'ランダム';

        const isSupportSkill = (d) => {
            if (!d) return false;
            const type = d.type || '';
            if (['回復','蘇生','強化','MP回復'].includes(type)) return true;
            if (d.debuff_reset || d.CureAilments || d.HPRegen || d.MPRegen) return true;
            return false;
        };

        const isSupport = isSupportSkill(data);

        if (scope === '全体') {
             if (cmd.isEnemy) {
                 if (isSupport) {
                     targets = Battle.enemies.filter(e => !e.isDead && !e.isFled);
                     if(effectType==='蘇生') targets = Battle.enemies.filter(e => e.isDead && !e.isFled);
                 } else {
                     targets = Battle.party.filter(p => p && !p.isDead);
                 }
             } else {
                 if (isSupport) {
                     targets = Battle.party.filter(p => p); 
                 } else {
                     targets = Battle.enemies.filter(e => !e.isDead && !e.isFled);
                 }
             }
        } else if (scope === 'ランダム') {
             let pool = [];
             if (cmd.isEnemy) {
                 pool = isSupport ? Battle.enemies.filter(e => !e.isDead && !e.isFled) : Battle.party.filter(p => p && !p.isDead);
             } else {
                 pool = isSupport ? Battle.party.filter(p => p && !p.isDead) : Battle.enemies.filter(e => !e.isDead && !e.isFled);
             }
             if(pool.length > 0) targets = [pool[Math.floor(Math.random() * pool.length)]];
        } else {
            targets = [cmd.target];
        }

        // --- 内部関数: 効果適用ロジック (改修版) ---
        const applyEffects = (t, d) => {
			// ★追加: 個別の発動確率をチェックする関数
            const checkProc = (val) => {
                let rate = successRate; // デフォルトはスキルのSuccessRate(50)を使う
                if (typeof val === 'number') rate = val; // データ側で "Poison": 30 とか書いてあればそっち優先
                return Math.random() * 100 < rate;
            };
			
            const checkResist = (type) => {
                // ★修正: デバフ成功率(successRate)が200%以上なら、耐性100%でも貫通する
                if (type === 'Debuff' && successRate >= 200) return false;

                const resistKey = Battle.RESIST_MAP[type] || type;
                const resistVal = (t.getStat('resists') || {})[resistKey] || 0;
                if (Math.random() * 100 < resistVal) return true;
                return false;
            };

            // ★修正: バフ (強化) 処理
            if (d.buff) {
                for (let key in d.buff) {
                    const val = d.buff[key]; // 新しい倍率 (例: 1.5)
                    const turn = d.turn || null; 
                    const name = Battle.statNames[key] || key.toUpperCase();

                    // 全属性耐性アップ (累積なし、上限100)
                    if (key === 'elmResUp') {
                        let newVal = val;
                        if (newVal > 100) newVal = 100; // 上限100%
                        if (newVal < -100) newVal = -100; // 下限-100%
                        
                        // 累積せず上書き (ターンも更新)
                        t.battleStatus.buffs[key] = { val: newVal, turns: turn };
                        Battle.log(`【${t.name}】の ${name} が あがった！`);
                    }
                    // ステータスアップ (累積あり、最大2.5倍)
                    else {
                        // 現在の倍率を取得 (なければ1.0)
                        let currentVal = (t.battleStatus.buffs[key] && t.battleStatus.buffs[key].val) || 1.0;
                        
                        // 累積計算 (乗算)
                        let newVal = currentVal * val;
                        
                        // 上限キャップ (最大2.5倍)
                        if (newVal > 2.5) newVal = 2.5;

                        // 適用 (ターン数は上書きリセット)
                        t.battleStatus.buffs[key] = { val: newVal, turns: turn };
                        
                        // ログに現在の倍率を表示
                        Battle.log(`【${t.name}】の ${name} があがった！`);
                    }
                }
            }

            // リジェネ系 (累積なし、上書き)
            if (d.HPRegen) { 
                t.battleStatus.buffs['HPRegen'] = { val: d.HPRegen, turns: d.turn }; 
                Battle.log(`【${t.name}】の HPが徐々に回復する！`);
            }
            if (d.MPRegen) { 
                t.battleStatus.buffs['MPRegen'] = { val: d.MPRegen, turns: d.turn }; 
                Battle.log(`【${t.name}】の MPが徐々に回復する！`);
            }
            if (d.CureAilments) {
                t.battleStatus.ailments = {}; 
                Battle.log(`【${t.name}】の 状態異常が 全て治った！`);
            }
            if (d.debuff_reset) {
                t.battleStatus.debuffs = {};
                Battle.log(`【${t.name}】の 能力低下が 元に戻った！`);
            }
            
            // ★修正: デバフ (弱体) 処理
            if (d.debuff) {
                // 耐性チェック (200%貫通ロジックは checkResist 内に記述済)
                if (!checkResist('Debuff')) {
                    for (let key in d.debuff) {
                        const val = d.debuff[key]; // 新しい倍率 (例: 0.8)
                        const turn = d.turn || null;
                        const name = Battle.statNames[key] || key.toUpperCase();

                        // 全属性耐性ダウン (累積なし)
                        if (key === 'elmResDown') {
                            let newVal = val;
                            if (newVal > 100) newVal = 100;
                            if (newVal < -100) newVal = -100;

                            // 累積せず上書き
                            t.battleStatus.debuffs[key] = { val: newVal, turns: turn };
                            Battle.log(`【${t.name}】の ${name} が さがった！`);
                        }
                        // ステータスダウン (累積あり、最小0.1倍)
                        else {
                            // 現在の倍率を取得 (なければ1.0)
                            let currentVal = (t.battleStatus.debuffs[key] && t.battleStatus.debuffs[key].val) || 1.0;

                            // 累積計算 (乗算)
                            let newVal = currentVal * val;

                            // 下限キャップ (最小0.1倍)
                            if (newVal < 0.1) newVal = 0.1;

                            // 適用 (ターン数は上書きリセット)
                            t.battleStatus.debuffs[key] = { val: newVal, turns: turn };

                            // ログに現在の倍率を表示
                            Battle.log(`【${t.name}】の ${name} がさがった！`);
                        }
                    }
                } else {
                    Battle.log(`【${t.name}】には きかなかった！`);
                }
            }
			
            if (d.buff_reset) {
                t.battleStatus.buffs = {};
                Battle.log(`【${t.name}】の良い効果がかき消された！`);
            }
            
            const addAilment = (key, msg, chance=null) => {
                if (!t.battleStatus.ailments[key]) {
                    if (checkResist(key)) {
                        Battle.log(`【${t.name}】には ${Battle.statNames[key]||key} は きかなかった！`);
                        return;
                    }
                    t.battleStatus.ailments[key] = { turns: d.turn, chance: chance };
                    Battle.log(msg);
                }
            };
			
			if (d.PercentDamage) {
                if ((Math.random() * 100 <= successRate) && !checkResist('PercentDamage')) {
                    let pdmg = Math.floor(t.hp * d.PercentDamage);
                    if(pdmg < 1) pdmg = 1;
                    t.hp -= pdmg;
                    Battle.log(`【${t.name}】に ${pdmg} のダメージ！`);
                    if (t.hp <= 0) { t.hp = 0; t.isDead = true; Battle.log(`【${t.name}】は倒れた！`); }
                } else {
                    Battle.log(`【${t.name}】にはきかなかった！`);
                }
            }
			
            // ★修正: 各 addAilment の呼び出し前に checkProc を挟む
            // (確率判定に受かったら → 耐性判定(addAilment) へ進む)

            if (d.Poison && checkProc(d.Poison)) addAilment('Poison', `【${t.name}】は どくにおかされた！`);
            if (d.ToxicPoison && checkProc(d.ToxicPoison)) addAilment('ToxicPoison', `【${t.name}】は もうどくにおかされた！`);
            if (d.Shock && checkProc(d.Shock)) addAilment('Shock', `【${t.name}】は 感電してしまった！`);
            if (d.Fear && checkProc(d.Fear)) addAilment('Fear', `【${t.name}】は 怯えてしまった！`, 0.5);
            
            if (d.SpellSeal && checkProc(d.SpellSeal)) addAilment('SpellSeal', `【${t.name}】の 呪文が封じられた！`);
            if (d.SkillSeal && checkProc(d.SkillSeal)) addAilment('SkillSeal', `【${t.name}】の 特技が封じられた！`);
            if (d.HealSeal && checkProc(d.HealSeal)) addAilment('HealSeal', `【${t.name}】の 回復が封じられた！`);
			
                    };

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
                        t.hp = Math.floor(t.baseMaxHp * (data.rate || 0.5)); 
                        Battle.log(`【${t.name}】は生き返った！`); 
                    } else {
                        Battle.log(`【${t.name}】には効果がなかった`);
                        continue;
                    }
                } 
                
                if (effectType === '回復') {
                    if (!t.isDead) {
                        let rec = 0;
                        if (data.fix) rec = baseDmg; 
                        else { const mag = Battle.getBattleStat(actor, 'mag'); rec = (mag + baseDmg) * skillRate; }
                        rec = Math.floor(rec);
                        t.hp = Math.min(t.baseMaxHp, t.hp + rec);
                        Battle.log(`【${t.name}】のHPが${rec}回復！`);
                    }
                } 
                
                if (effectType === 'MP回復') {
                    if (!t.isDead) {
                        let rec = baseDmg;
                        if (data.ratio) rec = Math.floor(t.baseMaxMp * data.ratio);
                        t.mp = Math.min(t.baseMaxMp, t.mp + rec);
                        Battle.log(`【${t.name}】のMPが${rec}回復！`);
                    }
                }

                if (!t.isDead) {
                    applyEffects(t, data);
                }
                
                Battle.renderPartyStatus(); 
                continue;
            }

            for (let i = 0; i < hitCount; i++) {
                let targetToHit = t;
                if (scope === 'ランダム') {
                    const pool = cmd.isEnemy ? Battle.party.filter(p => p && !p.isDead) : Battle.enemies.filter(e => !e.isDead && !e.isFled);
                    if (pool.length === 0) break;
                    targetToHit = pool[Math.floor(Math.random() * pool.length)];
                }

                if (targetToHit.isDead || targetToHit.isFled) { if (scope !== 'ランダム') break; continue; }

                if (isPhysical && Math.random() * 100 > successRate) {
                    Battle.log(`ミス！ 【${targetToHit.name}】に攻撃が当たらない！`);
                    await Battle.wait(200);
                    continue; 
                }

                let atkVal = 0, defVal = 0, ignoreDefense = false;
                if (data && data.IgnoreDefense) ignoreDefense = true;
                if (cmd.type === 'skill' && actor.passive && actor.passive.atkIgnoreDef && Math.random() < 0.2) ignoreDefense = true;

                if (isPhysical) {
                    atkVal = Battle.getBattleStat(actor, 'atk'); 
                    defVal = Battle.getBattleStat(targetToHit, 'def');
                    if (ignoreDefense) Battle.log(`【${actor.name}】の${skillName}は防御を無視！`);
                } else { 
                    atkVal = Battle.getBattleStat(actor, 'mag'); 
                    defVal = Battle.getBattleStat(targetToHit, 'mag'); 
                }

                let baseDmgCalc = 0;
                if (data && data.fix) {
                    baseDmgCalc = baseDmg;
                } else if (isPhysical) {
                    let attackPart = Math.floor(atkVal / 2);
                    let defensePart = ignoreDefense ? 0 : Math.floor(defVal / 4);
                    baseDmgCalc = Math.floor((attackPart - defensePart) * skillRate) + baseDmg;
                } else {
                    let magicPart = Math.floor(atkVal / 2); 
                    let resistPart = Math.floor(defVal / 4);
                    baseDmgCalc = Math.floor((magicPart - resistPart) * skillRate) + baseDmg;
                }
                
                if (baseDmgCalc < 1) baseDmgCalc = (Math.random() < 0.3) ? 1 : 0;

                if (!isPhysical && cmd.type === 'skill' && actor.passive && actor.passive.magCrit && Math.random() < 0.2) { 
                    baseDmgCalc *= 2; 
                    Battle.log(`【${actor.name}】の${skillName}が魔力暴走！`); 
                }

                let bonusRate = 0, cutRate = 0, isImmune = false;
                if (element) {
                    const elmAtkVal = (Battle.getBattleStat(actor, 'elmAtk') || {})[element] || 0;
                    if(elmAtkVal > 0) bonusRate += elmAtkVal;
                    const baseRes = (targetToHit.getStat('elmRes') || {})[element] || 0;
                    const buffRes = (targetToHit.battleStatus.buffs['elmResUp'] || {}).val || 0;
                    const debuffRes = (targetToHit.battleStatus.debuffs['elmResDown'] || {}).val || 0;
                    let resVal = baseRes + buffRes - debuffRes;
                    if (resVal >= 100) isImmune = true; else cutRate += resVal;
                }

                const finDmgVal = Battle.getBattleStat(actor, 'finDmg') || 0; 
                if(finDmgVal > 0) bonusRate += finDmgVal;
                let finRed = Battle.getBattleStat(targetToHit, 'finRed') || 0;
                if (targetToHit.passive && targetToHit.passive.finRed10) finRed += 10;
                if (finRed > 80) finRed = 80; if (finRed > 0) cutRate += finRed;

                let dmg = baseDmgCalc;
                if (dmg > 0) {
                    dmg = dmg * (1.0 + bonusRate / 100);
                    dmg = dmg * (1.0 - cutRate / 100);
                    dmg = dmg * (0.9 + Math.random() * 0.2);
                    if (targetToHit.status && targetToHit.status.defend) dmg = dmg * 0.5;
                    dmg = Math.floor(dmg);
                    if (!isImmune && dmg < 1) dmg = 1;
                }
                if (isImmune) dmg = 0;

                targetToHit.hp -= dmg;
                let dmgColor = '#fff';
                if(element === '火') dmgColor = '#f88'; if(element === '水') dmgColor = '#88f'; if(element === '雷') dmgColor = '#ff0';
                if(element === '風') dmgColor = '#8f8'; if(element === '光') dmgColor = '#ffc'; if(element === '闇') dmgColor = '#a8f'; if(element === '混沌') dmgColor = '#d4d';
                
                if (dmg === 0) {
                    Battle.log(`ミス！ 【${targetToHit.name}】は ダメージを うけない！`);
                } else {
                    Battle.log(`【${targetToHit.name}】に<span style="color:${dmgColor}">${dmg}</span>のダメージ！`);
                }
                
                let drainRate = 0;
                if (data && data.drain) drainRate = 0.5; else if (actor.passive && actor.passive.drain) drainRate = 0.2;
                if (drainRate > 0 && dmg > 0) {
                    const drainAmt = Math.floor(dmg * drainRate);
                    if(drainAmt > 0) {
                         const oldHp = actor.hp; actor.hp = Math.min(actor.baseMaxHp, actor.hp + drainAmt);
                         const healed = actor.hp - oldHp; if(healed > 0) Battle.log(`【${actor.name}】は吸収効果でHPを${healed}回復した！`);
                    }
                }

                if (cmd.type === 'skill') {
                    //if (Math.random() * 100 <= successRate) {
                    //    applyEffects(targetToHit, data);
                    //}
					applyEffects(targetToHit, data);
                }

                Battle.renderEnemies(); Battle.renderPartyStatus();
                if (targetToHit.hp <= 0) { targetToHit.hp = 0; targetToHit.isDead = true; Battle.log(`【${targetToHit.name}】は倒れた！`); Battle.renderEnemies(); Battle.renderPartyStatus(); }
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
        const activeEnemies = Battle.enemies.filter(e => !e.isFled);
        
        // ★修正: 敵データに battleStatus を含める
        App.data.battle.enemies = activeEnemies.map(e => ({ 
            baseId: e.id, 
            hp: e.hp, 
            maxHp: e.baseMaxHp, 
            name: e.name,
            actCount: e.actCount, // 行動回数も保存推奨
            acts: e.acts,         // 行動パターンも保存推奨
            battleStatus: e.battleStatus // ★これが必要
        }));

        Battle.party.forEach(p => { 
            if(p && p.uid) { 
                const d = App.data.characters.find(c => c.uid === p.uid); 
                if(d) { 
                    d.currentHp = p.hp; 
                    d.currentMp = p.mp; 
                    d.battleStatus = p.battleStatus; // ★修正: 味方データにも battleStatus を保存
                } 
            } 
        });
        App.save();
    },





    renderEnemies: () => {
        const container = Battle.getEl('enemy-container');
        if(!container) return;
        container.innerHTML = '';
        const g = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};
        
        // ★修正1: 配置計算のために「全ての敵の数」を使います
        const totalCount = Battle.enemies.length;
        const isBoss = App.data.battle ? App.data.battle.isBossBattle : false;

        // 敵の数に応じた幅とスケール計算 (全員分で計算)
        let widthPerEnemy = 24; 
        let scaleFactor = 1.0; 
        let maxPixelWidth = 120;

        if (isBoss && totalCount === 1) {
            widthPerEnemy = 40;  
            scaleFactor = 1.0;   
            maxPixelWidth = 200; 
        } 
        else if (totalCount === 3) { 
            widthPerEnemy = 30; scaleFactor = 1.0; 
        }
        else if (totalCount === 2) { 
            widthPerEnemy = 30; scaleFactor = 1.0; 
        }
        else if (totalCount === 1) { 
            widthPerEnemy = 30; scaleFactor = 1.0; 
        }
        else { 
            scaleFactor = 0.8; 
        }

        // ★修正2: 全ての敵を描画ループにかける (死体もスキップしない)
        Battle.enemies.forEach(e => {
            const div = document.createElement('div');
            div.className = `enemy-sprite`; // deadクラスはつけない(見えなくなるので)
            
            // 共通スタイル (幅やマージンで場所を確保)
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
                padding-bottom: 0;
            `;

            // ★修正3: 死んでいる(または逃げた)場合は「見えなくする」だけ
            if (e.isFled || e.hp <= 0) {
                div.style.visibility = 'hidden'; // 場所は確保するが見えなくなる
                container.appendChild(div);
                return; // 中身(画像やHPバー)は作らなくていいのでここで終了
            }
            
            let baseName = e.name.replace(/^(強・|真・|極・|神・)+/, '').replace(/ Lv\d+[A-Z]?$/, '').replace(/[A-Z]$/, '').trim();
            const imgKey = 'monster_' + baseName;
            const hasImage = g[imgKey] ? true : false;
            let imgHtml = '';
            
            if (hasImage) {
                div.style.border = 'none'; div.style.background = 'transparent';
                // ★修正2: 画像自体を下寄せ(object-position)にし、さらに transform で少し下げる
                imgHtml = `<img src="${g[imgKey].src}" style="
                    width: 100%; 
                    aspect-ratio: 1/1; 
                    object-fit: contain; 
                    object-position: center bottom; /* 画像を下辺に合わせる */
                    filter: drop-shadow(0 4px 4px rgba(0,0,0,0.5)); 
                    display: block;
                    transform: translateY(10px); /* ★重要: 画像を10px下にずらす */
                ">`;
            } else {
                div.style.background = 'transparent';
                // ダミー画像の場合もサイズに合わせてフォント調整
                const dummyFontSize = (isBoss && count === 1) ? '20px' : '10px';
                imgHtml = `<div style="width:100%; aspect-ratio:1/1; background:#444; border-radius:8px; border:2px solid #fff; display:flex; align-items:center; justify-content:center; color:#fff; font-size:${dummyFontSize};">${e.name.substring(0,2)}</div>`;
            }
            
            if(e.hp > 0) {
                const hpPer = (e.hp / e.baseMaxHp) * 100;
                const hpRatio = e.hp / e.baseMaxHp;
                const nameColor = hpRatio < 0.5 ? '#ff4' : '#fff';
                
                div.innerHTML = `
                    ${imgHtml}
                    <div style="
                        width: 140%;
                        /* margin-top: -5px; ← これを調整 */
                        margin-top: 5px; /* 画像を下げた分、テキストとの隙間を調整 */
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
            } else { 
                div.style.opacity = 0.5; 
                div.style.filter = 'grayscale(100%)';
                div.innerHTML = `
                    <div style="position:relative; width:100%;">
                        ${imgHtml}
                        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:12px; color:#f88; font-weight:bold; text-shadow:1px 1px 0 #000; z-index:10; white-space:nowrap;">DEAD</div>
                    </div>`;
            }
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
            const imgHtml = p.img ? `<img src="${p.img}" style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #666; margin-bottom:1px;">` : `<div style="width:32px; height:32px; background:#222; border-radius:4px; border:1px solid #444; display:flex; align-items:center; justify-content:center; color:#555; font-size:8px; margin-bottom:1px;">IMG</div>`;
            div.innerHTML = `<div style="flex:1; display:flex; flex-direction:column; align-items:center; width:100%; overflow:hidden;">${imgHtml}<div style="font-size:10px; font-weight:bold; ${nameStyle} overflow:hidden; white-space:nowrap; width:100%; text-align:center; line-height:1.2;">${p.name}</div><div style="font-size:8px; color:#aaa; margin-bottom:2px; line-height:1;">${p.job} Lv.${p.level}</div></div><div style="width:100%;"><div class="bar-container"><div class="bar-hp" style="width:${hpPer}%"></div></div><div class="p-val">${p.hp}/${p.baseMaxHp}</div><div class="bar-container"><div class="bar-mp" style="width:${mpPer}%"></div></div><div class="p-val">${p.mp}/${p.baseMaxMp}</div></div>`;
            
			// ★修正: クリック時の処理をモーダルオープンに変更
            div.onclick = () => { 
                if(Battle.phase !== 'input') return;
                // モーダルを開く (引数に現在のメンバーのインデックスを渡す)
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

        // ★修正: レイアウト調整 (バーを細く、文字を小さく、数値エリアを確保)
        let html = `
            <div style="display:flex; align-items:center; margin-bottom:10px;">
                <div style="width:48px; height:48px; border:1px solid #555; margin-right:10px; border-radius:4px; overflow:hidden; display:flex; justify-content:center; align-items:center; background:#333;">
                    ${char.img ? `<img src="${char.img}" style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:10px; color:#888;">IMG</span>'}
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

        // バフ・デバフ一覧作成 (ここは変更なし)
        const statusList = [];
        const b = char.battleStatus;
        if (b) {
            for (let key in b.ailments) {
                const turns = b.ailments[key].turns;
                const name = Battle.statNames[key] || key;
                statusList.push(`<div style="color:#f88;">● ${name} <span style="font-size:10px; color:#aaa;">(${turns}T)</span></div>`);
            }
            for (let key in b.buffs) {
                const turns = b.buffs[key].turns;
                const val = b.buffs[key].val;
                const name = Battle.statNames[key] || key;
                const tStr = (turns !== null && turns !== undefined) ? `${turns}T` : '∞';
                let valStr = '';
                if(key==='elmResUp') valStr = `(${val}%)`;
                else if(key!=='HPRegen' && key!=='MPRegen') valStr = `(x${val.toFixed(2)})`;
                
                statusList.push(`<div style="color:#8f8;">▲ ${name}${valStr} <span style="font-size:10px; color:#aaa;">(${tStr})</span></div>`);
            }
            for (let key in b.debuffs) {
                const turns = b.debuffs[key].turns;
                const val = b.debuffs[key].val;
                const name = Battle.statNames[key] || key;
                const tStr = (turns !== null && turns !== undefined) ? `${turns}T` : '∞';
                let valStr = '';
                if(key==='elmResDown') valStr = `(${val}%)`;
                else valStr = `(x${val.toFixed(2)})`;

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
	
	
    win: () => {
        Battle.phase = 'result'; Battle.active = false;
        let totalExp = 0, totalGold = 0, maxEnemyRank = 1; 
        Battle.enemies.forEach(e => { if (e.isDead && !e.isFled) { const base = DB.MONSTERS.find(m => m.id === e.baseId); if(base) { totalExp += base.exp; totalGold += base.gold; if(base.rank > maxEnemyRank) maxEnemyRank = base.rank; } } });
        App.data.gold += totalGold;
        Battle.enemies.forEach(e => { if(e.isDead && !e.isFled) { if(!App.data.book) App.data.book = { monsters: [] }; if(e.id && !App.data.book.monsters.includes(e.id)) App.data.book.monsters.push(e.id); } });
        const drops = []; let hasRareDrop = false;
		
		
		Battle.enemies.forEach(e => {
            if (e.isFled) return; 
            const base = DB.MONSTERS.find(m => m.id === e.baseId);
            const dropRank = base ? base.rank : 1;

            if (base && base.id >= 1000) {
                // ★ボス: 確定ドロップ (変更なし)
                const newEquip = App.createRandomEquip('drop', dropRank, 3); 
                App.data.inventory.push(newEquip); 
                hasRareDrop = true; 
                drops.push({ name: newEquip.name, isRare: true });

            } else {
                // ★修正: 通常モンスターのドロップ判定
                // 0.0 ～ 1.0 の乱数を生成
                const r = Math.random();

                if (r < 0.2) { 
                    // ■ 20% : アイテム
                    // (モンスターのランク以下のアイテムのみ)
                    const candidates = DB.ITEMS.filter(i => i.rank <= dropRank && i.type !== '貴重品');
                    
                    if (candidates.length > 0) {
                        const item = candidates[Math.floor(Math.random() * candidates.length)]; 
                        App.data.items[item.id] = (App.data.items[item.id]||0)+1; 
                        drops.push({name: item.name, isRare: false}); 
                    } else {
                        // 該当アイテムがない場合は何も落ちない（あるいは下位ランクの装備にフォールバックさせてもOK）
                    }

                } else if (r < 0.5) { 
                    // ■ 30% : 装備 (0.2以上 0.5未満 の範囲なので30%)
                    const newEquip = App.createRandomEquip('drop', dropRank); 
                    App.data.inventory.push(newEquip); 
                    const isRare = (newEquip.plus === 3); 
                    if(isRare) hasRareDrop = true; 
                    drops.push({ name: newEquip.name, isRare: isRare });
                }
                
                // ■ 残り50% : 何もなし (r >= 0.5)
            }
        });
		
		
        Battle.log(`\n★勝利！\n獲得: ${totalGold}G`);
        if(drops.length > 0) { drops.forEach(d => { if(d.isRare) Battle.log(`<span class="log-rare-drop">レア！ ${d.name} を手に入れた！</span>`); else Battle.log(`ドロップ: ${d.name}`); }); }
        if(hasRareDrop) { const flash = document.getElementById('drop-flash'); if(flash) { flash.style.display = 'block'; flash.classList.remove('flash-active'); void flash.offsetWidth; flash.classList.add('flash-active'); } }
        const surviveMembers = Battle.party.filter(p => !p.isDead);
        if (surviveMembers.length > 0) {
            Battle.log(`経験値: ${totalExp}EXP を獲得`);
            surviveMembers.forEach(p => { const charData = App.data.characters.find(c => c.uid === p.uid); if (charData && typeof App.gainExp === 'function') { const logs = App.gainExp(charData, totalExp); if (logs.length > 0) { logs.forEach(msg => Battle.log(msg)); p.hp = charData.currentHp; p.mp = charData.currentMp; p.baseMaxHp = App.calcStats(charData).maxHp; } } });
            Battle.renderPartyStatus();
        }
        Battle.log("\n▼ 画面タップで終了 ▼");
        if(App.data.battle.isBossBattle && typeof Dungeon !== 'undefined') Dungeon.onBossDefeated();
    },
    lose: () => { Battle.active = false; Battle.log("全滅した..."); Battle.endBattle(true); },
    endBattle: (isGameOver = false) => {
        App.data.battle = { active: false };
        Battle.party.forEach(p => { 
            if(p && p.uid) { 
                const d = App.data.characters.find(c => c.uid === p.uid); 
                if(d) { 
                    d.currentHp = p.hp; 
                    d.currentMp = p.mp; 
                    delete d.battleStatus; // ★追加: 戦闘終了時は状態異常などをクリーンアップ
                } 
            } 
        });
        App.save();
        if (isGameOver) { if (typeof Dungeon !== 'undefined' && Field.currentMapData && Field.currentMapData.isDungeon) { setTimeout(() => { App.data.characters.forEach(c => { if(App.data.party.includes(c.uid)) c.currentHp = 1; }); Dungeon.exit(); }, 2000); } else { setTimeout(() => App.returnToTitle(), 2000); } } else { setTimeout(() => App.changeScene('field'), 500); }
    },
    toggleAuto: () => { Battle.auto = !Battle.auto; Battle.updateAutoButton(); if(Battle.phase === 'input') Battle.findNextActor(); },
    updateAutoButton: () => { const btn = Battle.getEl('btn-auto'); if(btn) { btn.innerText = `AUTO: ${Battle.auto?'ON':'OFF'}`; btn.style.background = Battle.auto ? '#d00' : '#333'; } },
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};
