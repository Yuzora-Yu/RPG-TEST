/* battle.js (ダメージ計算式修正版: %カット・属性強化・フォースブレイク対応) */

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
    
    getEl: (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return el;
    },
    
    init: () => {
        Battle.active = true;
        Battle.phase = 'init';
        Battle.commandQueue = [];
        Battle.currentActorIndex = 0;
        Battle.auto = false;
        Battle.updateAutoButton();
        
        const logEl = Battle.getEl('battle-log');
        if(logEl) logEl.innerHTML = '';

        // パーティ生成
        Battle.party = App.data.party.map(uid => {
            if(!uid) return null;
            const charData = App.getChar(uid);
            if(!charData) return null;
            
            const player = new Player(charData);
            const stats = App.calcStats(charData);
            player.baseMaxHp = stats.maxHp; 
            player.baseMaxMp = stats.maxMp;
            player.hp = Math.min(player.hp, stats.maxHp);
            player.mp = Math.min(player.mp, stats.maxMp);
            player.isDead = player.hp <= 0;
            return player;
        }).filter(p => p !== null);

        if (Battle.party.length === 0 || Battle.party.every(p => p.isDead)) {
            App.log("戦えるメンバーがいません！");
            Battle.endBattle(true);
            return;
        }

        // 敵生成・復帰
        if (App.data.battle && App.data.battle.active && Array.isArray(App.data.battle.enemies) && App.data.battle.enemies.length > 0) {
            Battle.log("戦闘に復帰した！");
            Battle.enemies = App.data.battle.enemies.map(e => {
                const base = DB.MONSTERS.find(m => m.id === e.baseId) || DB.MONSTERS[0];
                const m = new Monster(base, 1.0);
                m.hp = e.hp; m.baseMaxHp = e.maxHp; m.name = e.name; m.id = e.baseId; 
                m.isDead = m.hp <= 0;
                m.isFled = false; 
                if(base.actCount) m.actCount = base.actCount;
                return m;
            }).filter(e => e !== null);
        } else {
            const isBoss = App.data.battle && App.data.battle.isBossBattle;
            Battle.enemies = Battle.generateNewEnemies(isBoss); 
            
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
                if (Battle.phase === 'result') Battle.endBattle(false);
            };
        }
        Battle.startInputPhase();
    },

    generateNewEnemies: (isBoss) => {
        const newEnemies = [];
        const floor = App.data.progress.floor || 1; 

        if (isBoss) {
            let bossId = 1000; 
            let bossScale = 1.0;
            let extraBosses = []; 
            let msg = "強大な魔物が現れた！";

            if (floor === 10) {
                bossId = 1010; msg = "バトルレックスが現れた！";
            } else if (floor === 20) {
                bossId = 1020; msg = "魔王のつかいが現れた！";
            } else if (floor === 30) {
                bossId = 1030; msg = "魔戦士デュランが現れた！";
            } else if (floor === 40) {
                bossId = 1040; msg = "ジャミラスが現れた！";
            } else if (floor === 50) {
                bossId = 1050; msg = "グラコスが現れた！";
            } else if (floor === 60) {
                bossId = 1060; msg = "魔王ムドーが現れた！";
            } else if (floor === 70) {
                bossId = 1070; msg = "アクバーが現れた！";
            } else if (floor === 80) {
                bossId = 1080; 
                extraBosses = [1081, 1082]; 
                msg = "悪霊の神々が現れた！";
            } else if (floor === 90) {
                bossId = 1090; msg = "大神官ハーゴンが現れた！";
            } else if (floor === 100) {
                bossId = 1100; msg = "破壊神シドーが現れた！";
            } else {
                bossId = 1000; 
                bossScale = 1.0 + ((floor - 100) * 0.1);
                msg = "竜神レグナードが現れた！";
            }

            Battle.log(msg);

            const base = DB.MONSTERS.find(m => m.id === bossId) || DB.MONSTERS.find(m => m.id === 1000);
            const m = new Monster(base, bossScale);
            m.name = base.name; m.id = base.id;
            if(base.actCount) m.actCount = base.actCount;
            newEnemies.push(m);

            extraBosses.forEach(eid => {
                const eBase = DB.MONSTERS.find(m => m.id === eid);
                if(eBase) {
                    const em = new Monster(eBase, bossScale);
                    em.name = eBase.name; em.id = eBase.id;
                    if(eBase.actCount) em.actCount = eBase.actCount;
                    newEnemies.push(em);
                }
            });

        } else {
            Battle.log("モンスターが現れた！");
            const count = 1 + Math.floor(Math.random() * 3);
            
            if (Math.random() < 0.05) {
                let metalId = 201; 
                if (floor >= 20) metalId = 202; 
                if (floor >= 50) metalId = 203; 
                if (floor >= 100) metalId = 204; 
                
                const metalBase = DB.MONSTERS.find(m => m.id === metalId);
                if(metalBase && floor >= metalBase.minF) {
                    const m = new Monster(metalBase, 1.0);
                    m.name = metalBase.name; m.id = metalBase.id;
                    newEnemies.push(m);
                    return newEnemies; 
                }
            }

            const minRank = Math.max(1, floor - 5);
            const maxRank = floor + 2;
            let pool = DB.MONSTERS.filter(m => m.rank >= minRank && m.rank <= maxRank && m.id < 200);
            
            if(pool.length === 0) pool = DB.MONSTERS.filter(m => m.rank <= floor && m.id < 200);
            if(pool.length === 0) pool = [DB.MONSTERS[0]];
            
            for(let i=0; i<count; i++) {
                const base = pool[Math.floor(Math.random()*pool.length)];
                const m = new Monster(base, 1.0);
                m.name += String.fromCharCode(65+i); 
                m.id = base.id;
                newEnemies.push(m);
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
                Battle.commandQueue.push({ type:'dead', actor:actor, speed:0 });
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
            Battle.registerAction({ type: 'attack', actor: actor, target: target });
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
                if (App.data.battle.isBossBattle) newBtn.disabled = true;
                else newBtn.disabled = false;
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
                else if (type.includes('回復') || type === '強化') actualTargetType = 'ally';
                else if (type === '弱体') actualTargetType = 'enemy';
                else actualTargetType = 'enemy';
            } else if (range === '全体') {
                if (type.includes('回復') || ['蘇生','強化'].includes(type)) actualTargetType = 'all_ally';
                else actualTargetType = 'all_enemy';
            } else if (range === 'ランダム') {
                actualTargetType = 'random';
            }
        }

        if (actualTargetType === 'enemy') targets = Battle.enemies.filter(e => !e.isDead && !e.isFled);
        else if (actualTargetType === 'ally') targets = Battle.party.filter(p => p && !p.isDead);
        else if (actualTargetType === 'ally_dead') targets = Battle.party.filter(p => p && p.isDead);

        if (actualTargetType === 'all_enemy' || actualTargetType === 'all_ally' || actualTargetType === 'random') {
            const actor = Battle.party[Battle.currentActorIndex];
            Battle.registerAction({ 
                type: Battle.selectingAction, 
                actor: actor, 
                target: actualTargetType, 
                data: Battle.selectedItemOrSkill,
                targetScope: actionData ? actionData.target : null 
            });
            return;
        }

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
            content.innerHTML = '<div style="padding:10px">特技がありません</div>';
            return;
        }

        actor.skills.forEach(sk => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `<div>${sk.name} (${sk.target})</div><div style="color:#88f">MP:${sk.mp}</div>`;
            div.onclick = (e) => {
                e.stopPropagation();
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
        Object.keys(App.data.items).forEach(id => {
            const it = DB.ITEMS.find(i=>i.id==id);
            if(it && (it.type.includes('回復') || it.type.includes('蘇生')) && App.data.items[id] > 0) { 
                items.push({def:it, count:App.data.items[id]});
            }
        });

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
        const spd = actionObj.actor.getStat('spd');
        if (actionObj.type === 'defend') {
            actionObj.speed = 99999; 
        } else {
            actionObj.speed = spd * (0.9 + Math.random() * 0.2);
        }
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
                if(p && !p.isDead) Battle.commandQueue.push({ type:'defend', actor:p, speed: p.getStat('spd') });
            });
            Battle.executeTurn();
        }
    },

    executeTurn: async () => {
        Battle.phase = 'execution';
        const nameDiv = Battle.getEl('battle-actor-name');
        if(nameDiv) nameDiv.style.display = 'none';
        Battle.log("--- ターン開始 ---");

        Battle.enemies.forEach(e => {
            if (!e.isDead && !e.isFled) {
                const count = e.actCount || 1;
                for(let i=0; i<count; i++) {
                    const spd = e.getStat('spd');
                    const acts = e.acts && e.acts.length > 0 ? e.acts : [1];
                    const actId = acts[Math.floor(Math.random() * acts.length)];
                    
                    let actionType = 'enemy_attack'; 
                    let skillData = null;
                    let targetScope = 'single'; 

                    if (actId === 9) {
                        actionType = 'flee';
                    } else if (actId === 2) {
                        actionType = 'defend';
                    } else if (actId !== 1) {
                        const skill = DB.SKILLS.find(s => s.id === actId);
                        if (skill) {
                            actionType = 'skill';
                            skillData = skill;
                            targetScope = skill.target; 
                        }
                    }

                    Battle.commandQueue.push({
                        type: actionType,
                        actor: e,
                        speed: actionType === 'defend' ? 99999 : spd * (0.8 + Math.random() * 0.4), 
                        isEnemy: true,
                        data: skillData,
                        targetScope: targetScope,
                        target: null 
                    });
                }
            }
        });

        Battle.commandQueue.sort((a, b) => b.speed - a.speed);

        for (const cmd of Battle.commandQueue) {
            if (!Battle.active) break;
            if (!cmd.actor || cmd.actor.hp <= 0 || cmd.actor.isFled) continue; 

            if (cmd.type === 'flee') {
                 Battle.log(`【${cmd.actor.name}】は逃げ出した！`);
                 cmd.actor.isFled = true;
                 cmd.actor.hp = 0; 
                 Battle.renderEnemies();
                 if (Battle.checkFinish()) return;
                 await Battle.wait(500);
                 continue;
            }

            // 敵のターゲット選択
            if (cmd.isEnemy && !cmd.target && cmd.targetScope !== '全体' && cmd.targetScope !== 'ランダム') {
                let isSupport = false;
                if (cmd.data && (cmd.data.type.includes('回復') || cmd.data.type === '強化' || cmd.data.type === '蘇生')) {
                    isSupport = true;
                }

                if (isSupport) {
                    let pool = Battle.enemies.filter(e => !e.isDead && !e.isFled);
                    if (cmd.data && cmd.data.type.includes('蘇生')) {
                         pool = Battle.enemies.filter(e => e.isDead && !e.isFled);
                    }
                    if (pool.length > 0) {
                        cmd.target = pool[Math.floor(Math.random() * pool.length)];
                    } else {
                        cmd.target = cmd.actor; 
                    }
                } else {
                    const aliveParty = Battle.party.filter(p => p && !p.isDead);
                    if (aliveParty.length === 0) break;
                    cmd.target = aliveParty[Math.floor(Math.random() * aliveParty.length)];
                }
            }

            await Battle.processAction(cmd);
            Battle.updateDeadState();
            Battle.renderEnemies();
            Battle.renderPartyStatus();
            if (Battle.checkFinish()) return;
            await Battle.wait(500);
        }
        Battle.saveBattleState();
        Battle.startInputPhase();
    },

    processAction: async (cmd) => {
        const actor = cmd.actor;
        const data = cmd.data;
        const target = cmd.target;

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
            if (App.data.items[item.id] > 0) {
                if(item.type !== '貴重品') {
                    App.data.items[item.id]--;
                    if(App.data.items[item.id]<=0) delete App.data.items[item.id];
                }
                const targets = (cmd.target === 'all_ally') ? Battle.party : [target];
                for (let t of targets) {
                    if (!t) continue;
                    if (item.type === '蘇生') {
                        if (t.isDead) {
                            t.isDead = false; t.hp = Math.floor(t.baseMaxHp * 0.5);
                            Battle.log(`【${t.name}】は生き返った！`); Battle.renderPartyStatus();
                        } else Battle.log(`【${t.name}】には効果がなかった`);
                    } else if (item.type === 'HP回復') {
                        if(!t.isDead) {
                            const val = typeof item.val === 'number' ? item.val : 0;
                            const rec = Math.min(t.baseMaxHp - t.hp, val);
                            t.hp += rec; Battle.log(`【${t.name}】のHPが${rec}回復！`); Battle.renderPartyStatus();
                        }
                    } else if (item.type === 'MP回復') {
                         if(!t.isDead) {
                            const val = typeof item.val === 'number' ? item.val : 0;
                            const rec = Math.min(t.baseMaxMp - t.mp, val);
                            t.mp += rec; Battle.log(`【${t.name}】のMPが${rec}回復！`); Battle.renderPartyStatus();
                        }
                    }
                }
            }
            return;
        }

        let skillName = "攻撃";
        let isPhysical = true;
        let multiplier = 1.0;
        let baseDmg = 0;
        let mpCost = 0;
        let effectType = null;
        let element = null;
        let hitCount = 1;

        if (cmd.type === 'skill') {
            skillName = data.name;
            isPhysical = (data.type === '物理');
            multiplier = data.rate;
            baseDmg = data.base;
            mpCost = data.mp;
            effectType = data.type;
            element = data.elm;
            hitCount = (typeof data.count === 'number') ? data.count : 1;
            
            if (data.id === 500) { mpCost = actor.mp; }

            if (actor.mp < mpCost && data.id !== 500) {
                Battle.log(`【${actor.name}】は${skillName}を唱えたがMPが足りない！`);
                return;
            }
            actor.mp -= mpCost;
            Battle.renderPartyStatus();
        }

        Battle.log(`【${actor.name}】の${skillName}！`);

        if (data && data.id === 500) {
            const dmg = mpCost * 5;
            const targets = cmd.isEnemy ? Battle.party.filter(p=>p && !p.isDead) : Battle.enemies.filter(e=>!e.isDead && !e.isFled);
            for (let t of targets) {
                t.hp -= dmg;
                Battle.log(`【${t.name}】に<span style="color:#fa0">${dmg}</span>のダメージ！`);
                if (t.hp <= 0) { t.hp = 0; t.isDead = true; Battle.log(`【${t.name}】は倒れた！`); }
            }
            Battle.renderEnemies();
            Battle.renderPartyStatus();
            await Battle.wait(500);
            return;
        }

        let targets = [];
        let scope = cmd.targetScope;
        
        if (!scope && cmd.target === 'all_enemy') scope = '全体';
        if (!scope && cmd.target === 'all_ally') scope = '全体';
        if (!scope && cmd.target === 'random') scope = 'ランダム';

        if (scope === '全体') {
             if (cmd.isEnemy) {
                 if (['回復','蘇生','強化'].includes(effectType)) {
                     targets = Battle.enemies.filter(e => !e.isDead && !e.isFled);
                     if(effectType==='蘇生') targets = Battle.enemies.filter(e => e.isDead && !e.isFled);
                 } else {
                     targets = Battle.party.filter(p => p && !p.isDead);
                 }
             } else {
                 if (['回復','蘇生','強化'].includes(effectType)) targets = Battle.party.filter(p => p); 
                 else targets = Battle.enemies.filter(e => !e.isDead && !e.isFled);
             }
        } else if (scope === 'ランダム') {
             const pool = cmd.isEnemy ? Battle.party.filter(p => p && !p.isDead) : Battle.enemies.filter(e => !e.isDead && !e.isFled);
             if(pool.length > 0) targets = [pool[0]];
        } else {
             targets = [target];
        }

        for (let t of targets) {
            if (!t) continue;

            if (effectType && ['回復','蘇生','強化','弱体'].includes(effectType)) {
                if (effectType === '蘇生') {
                    if (t.isDead) {
                        t.isDead = false; t.hp = Math.floor(t.baseMaxHp * 0.5);
                        Battle.log(`【${t.name}】は生き返った！`);
                    } else { Battle.log(`【${t.name}】には効果がなかった`); }
                } else if (effectType === '強化') {
                    if (!t.isDead && data.buff) {
                        for(let key in data.buff) t.buffs[key] = data.buff[key];
                        Battle.log(`【${t.name}】の能力が上がった！`);
                    }
                } else if (effectType === '弱体') { 
                    if (!t.isDead && data.buff) {
                        for(let key in data.buff) t.buffs[key] = data.buff[key];
                        // ★修正: フォースブレイク(elmResDown)対応
                        if(data.buff.elmResDown) {
                            Battle.log(`【${t.name}】の属性耐性が大幅に下がった！`);
                        } else {
                            Battle.log(`【${t.name}】の能力が下がった！`);
                        }
                    }
                } else { 
                    if (!t.isDead) {
                        let base = (typeof data.base === 'number') ? data.base : 0;
                        let rate = (typeof data.rate === 'number') ? data.rate : 1.0;
                        let rec = 0;
                        if (typeof data.val === 'number' || data.fix) rec = base;
                        else {
                            const mag = actor.getStat('mag') || 0;
                            rec = (mag + base) * rate;
                        }
                        rec = Math.floor(rec);
                        t.hp = Math.min(t.baseMaxHp, t.hp + rec);
                        Battle.log(`【${t.name}】のHPが${rec}回復！`);
                    }
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

                if (targetToHit.isDead || targetToHit.isFled) {
                    if (scope !== 'ランダム') break;
                    continue; 
                }

                let atkVal = isPhysical ? actor.getStat('atk') : actor.getStat('mag');
                let defVal = isPhysical ? targetToHit.getStat('def') : targetToHit.getStat('mag');
                let resistance = isPhysical ? Math.floor(defVal / 2) : Math.floor(defVal / 3);

                let dmg = (atkVal - resistance + baseDmg) * multiplier;
                
                // ★修正: 属性攻撃アップを % 乗算に変更
                if (element) {
                    // 攻撃側: 属性攻撃力 (20 = 20%アップ)
                    const elmAtk = actor.getStat('elmAtk') || {};
                    const bonus = elmAtk[element] || 0;
                    if(bonus > 0) dmg = dmg * (1 + bonus / 100);

                    // 防御側: 属性耐性 & フォースブレイク計算
                    const elmRes = targetToHit.getStat('elmRes') || {};
                    let resVal = elmRes[element] || 0;
                    
                    // フォースブレイク(耐性ダウン)の適用
                    if (targetToHit.buffs && targetToHit.buffs.elmResDown) {
                        resVal -= targetToHit.buffs.elmResDown;
                    }

                    const cutRate = resVal / 100; 
                    dmg = dmg * (1.0 - cutRate);
                }

                dmg = dmg * (0.9 + Math.random() * 0.2);
                
                // ★修正: 最終ダメージアップを % 乗算に (元々そうだが明示)
                const finDmg = actor.getStat('finDmg') || 0;
                if(finDmg > 0) dmg = dmg * (1 + finDmg/100);

                // ★修正: 被ダメージ軽減を % カットに変更 (最大80%)
                let finRed = targetToHit.getStat('finRed') || 0;
                if (finRed > 80) finRed = 80; // キャップ
                if (finRed > 0) {
                    dmg = dmg * (1 - finRed / 100);
                }

                if (dmg < 1) dmg = 1;
                if (targetToHit.status && targetToHit.status.defend) dmg = Math.floor(dmg / 2);
                dmg = Math.floor(dmg);

                targetToHit.hp -= dmg;
                
                let dmgColor = '#fff';
                if(element === '火') dmgColor = '#f88';
                if(element === '水') dmgColor = '#88f';
                if(element === '雷') dmgColor = '#ff0';
                if(element === '風') dmgColor = '#8f8';
                if(element === '光') dmgColor = '#ffc';
                if(element === '闇') dmgColor = '#a8f';
                
                Battle.log(`【${targetToHit.name}】に<span style="color:${dmgColor}">${dmg}</span>のダメージ！`);
                
                if (data && data.drain) {
                    const drainAmt = Math.floor(dmg * 0.25);
                    if(drainAmt > 0) {
                         const oldHp = actor.hp;
                         actor.hp = Math.min(actor.baseMaxHp, actor.hp + drainAmt);
                         const healed = actor.hp - oldHp;
                         if(healed > 0) Battle.log(`【${actor.name}】はHPを${healed}回復した！`);
                    }
                }

                if(cmd.type === 'skill' && data.buff) {
                    for(let key in data.buff) {
                        targetToHit.buffs[key] = data.buff[key];
                        if(key !== 'elmResDown') {
                            if(data.buff[key] < 1) Battle.log(`【${targetToHit.name}】の能力が下がった！`);
                            else Battle.log(`【${targetToHit.name}】の能力が上がった！`);
                        }
                    }
                }

                if(actor.synergy && actor.synergy.effect === 'drain') {
                    const drain = Math.floor(dmg * 0.1);
                    if(drain > 0) actor.hp = Math.min(actor.baseMaxHp, actor.hp + drain);
                }

                Battle.renderEnemies();
                Battle.renderPartyStatus();

                if (targetToHit.hp <= 0) {
                    targetToHit.hp = 0; targetToHit.isDead = true;
                    Battle.log(`【${targetToHit.name}】は倒れた！`);
                    Battle.renderEnemies();
                    Battle.renderPartyStatus();
                }
                
                if (hitCount > 1) await Battle.wait(150);
            }
            await Battle.wait(100);
        }
    },

    updateDeadState: () => {
        [...Battle.party, ...Battle.enemies].forEach(e => {
            if (e && e.hp <= 0 && !e.isFled) { e.hp = 0; e.isDead = true; }
        });
    },

    checkFinish: () => {
        if (Battle.enemies.every(e => e.isDead || e.isFled)) {
            setTimeout(Battle.win, 800);
            return true;
        }
        if (Battle.party.every(p => p.isDead)) {
            setTimeout(Battle.lose, 800);
            return true;
        }
        return false;
    },

    getRandomAliveEnemy: () => {
        const alive = Battle.enemies.filter(e => !e.isDead && !e.isFled);
        if (alive.length === 0) return null;
        return alive[Math.floor(Math.random() * alive.length)];
    },

    saveBattleState: () => {
        const activeEnemies = Battle.enemies.filter(e => !e.isFled);
        App.data.battle.enemies = activeEnemies.map(e => ({
            baseId: e.id, hp: e.hp, maxHp: e.baseMaxHp, name: e.name
        }));
        Battle.party.forEach(p => {
            if(p && p.uid) {
                const d = App.data.characters.find(c => c.uid === p.uid);
                if(d) { d.currentHp = p.hp; d.currentMp = p.mp; }
            }
        });
        App.save();
    },

    renderEnemies: () => {
        const container = Battle.getEl('enemy-container');
        if(!container) return;
        container.innerHTML = '';
        Battle.enemies.forEach(e => {
            if(e.isFled) return; 
            const div = document.createElement('div');
            div.className = `enemy-sprite ${e.hp<=0?'dead':''}`;
            if(e.hp > 0) {
                const hpPer = (e.hp / e.baseMaxHp) * 100;
                div.innerHTML = `<div style="font-size:10px; text-shadow:1px 1px 0 #000;">${e.name}</div><div class="enemy-hp-bar"><div class="enemy-hp-val" style="width:${hpPer}%"></div></div>`;
                div.onclick = (event) => {
                    event.stopPropagation();
                    if(Battle.phase==='target_select' && (Battle.selectingAction==='attack'||Battle.selectingAction==='skill')) {
                        Battle.selectTarget(e);
                    }
                };
            } else {
                div.style.opacity = 0.5;
                div.innerHTML = `<div style="font-size:10px; color:#888;">${e.name}<br>DEAD</div>`;
            }
            container.appendChild(div);
        });
    },
    
    renderPartyStatus: () => {
        const container = Battle.getEl('battle-party-bar');
        if(!container) return;
        container.innerHTML = '';
        Battle.party.forEach((p, index) => {
            const div = document.createElement('div');
            div.className = 'p-box';
            div.style.justifyContent = 'flex-start'; 
            div.style.paddingTop = '2px';

            const hpPer = (p.baseMaxHp > 0) ? (p.hp / p.baseMaxHp) * 100 : 0;
            const mpPer = (p.baseMaxMp > 0) ? (p.mp / p.baseMaxMp) * 100 : 0;

            const isActor = (Battle.phase === 'input' && index === Battle.currentActorIndex);
            if(isActor) {
                div.style.border = "2px solid #ffd700";
                div.style.background = "#333";
            }
            
            let nameStyle = p.isDead ? 'color:red; text-decoration:line-through;' : 'color:white;';
            
            const imgHtml = p.img 
                ? `<img src="${p.img}" style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #666; margin-bottom:1px;">`
                : `<div style="width:32px; height:32px; background:#222; border-radius:4px; border:1px solid #444; display:flex; align-items:center; justify-content:center; color:#555; font-size:8px; margin-bottom:1px;">IMG</div>`;

            div.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; width:100%; overflow:hidden;">
                    ${imgHtml}
                    <div style="font-size:10px; font-weight:bold; ${nameStyle} overflow:hidden; white-space:nowrap; width:100%; text-align:center; line-height:1.2;">
                        ${p.name}
                    </div>
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
                Battle.log(`【${p.name}】 ${p.job}Lv${p.level} HP:${p.hp}/${p.baseMaxHp} MP:${p.mp}/${p.baseMaxMp}`);
            };

            container.appendChild(div);
        });
    },

    win: () => {
        Battle.phase = 'result';
        Battle.active = false;
        let totalExp = 0, totalGold = 0, maxEnemyRank = 1; 
        
        Battle.enemies.forEach(e => {
            if (e.isDead && !e.isFled) {
                const base = DB.MONSTERS.find(m => m.id === e.baseId);
                if(base) {
                    totalExp += base.exp; totalGold += base.gold;
                    if(base.rank > maxEnemyRank) maxEnemyRank = base.rank;
                }
            }
        });

        App.data.gold += totalGold;
        Battle.enemies.forEach(e => {
            if(e.isDead && !e.isFled) {
                if(!App.data.book) App.data.book = { monsters: [] };
                if(e.id && !App.data.book.monsters.includes(e.id)) App.data.book.monsters.push(e.id);
            }
        });

        const drops = [];
        let hasRareDrop = false;

        Battle.enemies.forEach(e => {
            if (e.isFled) return; 
            
            const base = DB.MONSTERS.find(m => m.id === e.baseId);
            const dropRank = base ? base.rank : 1;

            if (base && base.id >= 1000) {
                const newEquip = App.createRandomEquip('drop', dropRank, 3); 
                App.data.inventory.push(newEquip);
                hasRareDrop = true;
                drops.push({ name: newEquip.name, isRare: true });
            } 
            else if (Math.random() < 0.3) {
                if (Math.random() < 0.3) {
                    const item = DB.ITEMS[Math.floor(Math.random() * DB.ITEMS.length)];
                    if(item.type !== '貴重品') {
                        App.data.items[item.id] = (App.data.items[item.id]||0)+1;
                        drops.push({name: item.name, isRare: false});
                    }
                } else {
                    const newEquip = App.createRandomEquip('drop', dropRank); 
                    App.data.inventory.push(newEquip);
                    const isRare = (newEquip.plus === 3);
                    if(isRare) hasRareDrop = true;
                    drops.push({ name: newEquip.name, isRare: isRare });
                }
            }
        });

        Battle.log(`\n★勝利！\n獲得: ${totalGold}G`);
        if(drops.length > 0) {
            drops.forEach(d => {
                if(d.isRare) Battle.log(`<span class="log-rare-drop">レア！ ${d.name} を手に入れた！</span>`);
                else Battle.log(`ドロップ: ${d.name}`);
            });
        }

        if(hasRareDrop) {
            const flash = document.getElementById('drop-flash');
            if(flash) {
                flash.style.display = 'block'; flash.classList.remove('flash-active');
                void flash.offsetWidth; flash.classList.add('flash-active');
            }
        }

        const surviveMembers = Battle.party.filter(p => !p.isDead);
        if (surviveMembers.length > 0) {
            Battle.log(`経験値: ${totalExp}EXP を獲得`);
            surviveMembers.forEach(p => {
                const charData = App.data.characters.find(c => c.uid === p.uid);
                if (charData && typeof App.gainExp === 'function') {
                    const logs = App.gainExp(charData, totalExp);
                    if (logs.length > 0) {
                        logs.forEach(msg => Battle.log(msg));
                        p.hp = charData.currentHp; p.mp = charData.currentMp; p.baseMaxHp = App.calcStats(charData).maxHp; 
                    }
                }
            });
            Battle.renderPartyStatus();
        }

        Battle.log("\n▼ 画面タップで終了 ▼");
        if(App.data.battle.isBossBattle && typeof Dungeon !== 'undefined') Dungeon.onBossDefeated();
    },

    lose: () => {
        Battle.active = false;
        Battle.log("全滅した...");
        Battle.endBattle(true);
    },

    endBattle: (isGameOver = false) => {
        App.data.battle = { active: false };
        Battle.party.forEach(p => {
            if(p && p.uid) {
                const d = App.data.characters.find(c => c.uid === p.uid);
                if(d) { d.currentHp = p.hp; d.currentMp = p.mp; }
            }
        });
        App.save();

        if (isGameOver) {
            if (typeof Dungeon !== 'undefined' && Field.currentMapData && Field.currentMapData.isDungeon) {
                setTimeout(() => {
                    App.data.characters.forEach(c => { if(App.data.party.includes(c.uid)) c.currentHp = 1; });
                    Dungeon.exit(); 
                }, 2000);
            } else { setTimeout(() => App.returnToTitle(), 2000); }
        } else { setTimeout(() => App.changeScene('field'), 500); }
    },
    
    toggleAuto: () => {
        Battle.auto = !Battle.auto;
        Battle.updateAutoButton();
        if(Battle.phase === 'input') Battle.findNextActor();
    },
    updateAutoButton: () => {
        const btn = Battle.getEl('btn-auto');
        if(btn) {
            btn.innerText = `AUTO: ${Battle.auto?'ON':'OFF'}`;
            btn.style.background = Battle.auto ? '#d00' : '#333';
        }
    },
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};
