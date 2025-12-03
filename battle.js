/* battle.js */

const Battle = {
    active: false,
    auto: false,
    phase: 'init', // init, input, target_select, skill_select, item_select, execution, result, end
    party: [],
    enemies: [],
    
    // コマンド入力管理
    commandQueue: [], 
    currentActorIndex: 0, 
    
    // 一時データ
    selectingAction: null, 
    selectedItemOrSkill: null,
    
    // UI要素取得ヘルパー (安全装置付き)
    getEl: (id) => {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Battle.js: Element with id '${id}' not found.`);
            return null;
        }
        return el;
    },
    
    // --- 初期化 ---
    init: () => {
        Battle.active = true;
        Battle.phase = 'init';
        Battle.commandQueue = [];
        Battle.currentActorIndex = 0;
        Battle.auto = false;
        Battle.updateAutoButton();
        
        // ログ初期化
        const logEl = Battle.getEl('battle-log');
        if(logEl) logEl.innerHTML = '';

        // 1. 味方パーティ生成 (HP/MP復元と死亡判定)
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

            if (player.hp <= 0) { player.hp = 0; player.isDead = true; }
            else { player.isDead = false; }

            return player;
        }).filter(p => p !== null);

        // パーティが全員死亡またはいない場合は即終了（安全策）
        if (Battle.party.length === 0 || Battle.party.every(p => p.isDead)) {
            App.log("戦えるメンバーがいません！");
            Battle.endBattle(true);
            return;
        }

        // 2. 敵生成
        if (App.data.battle && App.data.battle.active && Array.isArray(App.data.battle.enemies) && App.data.battle.enemies.length > 0) {
            Battle.log("戦闘に復帰した！");
            Battle.enemies = App.data.battle.enemies.map(e => {
                const base = DB.MONSTERS.find(m => m.id === e.baseId) || DB.MONSTERS[0];
                const m = new Monster(base, 1.0);
                m.hp = e.hp; m.baseMaxHp = e.maxHp; m.name = e.name; m.id = e.baseId; 
                m.isDead = m.hp <= 0;
                return m;
            }).filter(e => e !== null);
        } else {
            // 新規エンカウント
            const isBoss = App.data.battle && App.data.battle.isBossBattle;
            Battle.enemies = Battle.generateNewEnemies(isBoss); 
            
            App.data.battle = {
                active: true,
                isBossBattle: isBoss,
                enemies: Battle.enemies.map(e => ({ baseId: e.id, hp: e.baseMaxHp, maxHp: e.baseMaxHp, name: e.name }))
            };
            App.save();
        }
        
        Battle.renderEnemies();
        Battle.renderPartyStatus();
        
        // リザルトタップ待ち用のイベント設定
        const scene = document.getElementById('battle-scene');
        if(scene) {
            scene.onclick = (e) => {
                if (Battle.phase === 'result') {
                    Battle.endBattle(false);
                }
            };
        }

        Battle.startInputPhase();
    },

    generateNewEnemies: (isBoss) => {
        const newEnemies = [];
        const floor = App.data.progress.floor || 1; 

        if (isBoss) {
            const base = DB.MONSTERS.find(m => m.id === 100) || DB.MONSTERS[0];
            const m = new Monster(base, 1.0 + (floor * 0.1));
            m.name = "ダンジョンボス"; m.id = base.id;
            newEnemies.push(m);
            Battle.log("ボスが現れた！");
        } else {
            Battle.log("モンスターが現れた！");
            const count = 1 + Math.floor(Math.random() * 3);
            const pool = DB.MONSTERS.filter(m => floor >= m.minF && m.id < 100);
            const basePool = pool.length > 0 ? pool : [DB.MONSTERS[0]];
            
            for(let i=0; i<count; i++) {
                const base = basePool[Math.floor(Math.random()*basePool.length)];
                const m = new Monster(base, 1.0 + floor*0.05);
                m.name += String.fromCharCode(65+i); m.id = base.id;
                newEnemies.push(m);
            }
        }
        return newEnemies;
    },

    // --- ログ表示 ---
    log: (msg) => {
        const el = Battle.getEl('battle-log');
        if (el) {
            const line = document.createElement('div');
            line.innerText = msg;
            el.appendChild(line);
            el.scrollTop = el.scrollHeight;
        }
        console.log(`[Battle] ${msg}`);
    },

    // --- 入力フェーズ ---
    startInputPhase: () => {
        if (!Battle.active) return;
        
        Battle.phase = 'input';
        Battle.commandQueue = [];
        Battle.currentActorIndex = 0;
        
        Battle.closeSubMenu();
        Battle.findNextActor();
    },

    findNextActor: () => {
        // ★修正: 生存している次のキャラを見つけるまでループ
        while (Battle.currentActorIndex < Battle.party.length) {
            const actor = Battle.party[Battle.currentActorIndex];
            
            // 死亡しているキャラはスキップし、ダミーアクションを登録
            if (!actor || actor.isDead) {
                Battle.commandQueue.push({ type:'dead', actor:actor, speed:0 });
                Battle.currentActorIndex++;
                continue; 
            }

            // 生存している次のキャラが見つかった
            // ★修正: 次のキャラの入力フェーズであることを明示する
            Battle.phase = 'input';
            break;
        }

        // 全員の入力完了 -> ターン実行へ
        if (Battle.currentActorIndex >= Battle.party.length) {
            Battle.executeTurn();
            return;
        }

        const actor = Battle.party[Battle.currentActorIndex];
        
        Battle.renderPartyStatus(); // カーソル更新
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
            // 直前の登録されたアクションを削除
            Battle.commandQueue.pop(); 
            
            // 削除したアクションのキャラのインデックスに戻す
            // 死亡スキップされたキャラはキューに含まれるが、ここでは現在のインデックスをデクリメントするだけで良い
            Battle.currentActorIndex--;
            
            // 死亡キャラをスキップして戻る (これは既にfindNextActorで処理されるため、ここでは不要だが安全のため)
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

    // --- コマンド選択 ---
    selectCommand: (type) => {
        if (Battle.phase !== 'input' || Battle.auto) return;
        
        Battle.selectingAction = type;
        Battle.selectedItemOrSkill = null;

        if (type === 'attack') {
            Battle.log("攻撃対象を選択してください");
            Battle.openTargetWindow('enemy');
        } 
        else if (type === 'skill') {
            Battle.openSkillList();
        } 
        else if (type === 'item') {
            Battle.openItemList();
        } 
        else if (type === 'defend') {
            const actor = Battle.party[Battle.currentActorIndex];
            Battle.registerAction({ type: 'defend', actor: actor });
        }
    },

    // --- サブウィンドウ ---
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
                else if (['回復','強化'].includes(type)) actualTargetType = 'ally';
                else actualTargetType = 'enemy';
            } else if (range === '全体') {
                if (['回復','蘇生','強化'].includes(type)) actualTargetType = 'all_ally';
                else actualTargetType = 'all_enemy';
            } else if (range === 'ランダム') {
                actualTargetType = 'enemy';
            }
        }

        if (actualTargetType === 'enemy') targets = Battle.enemies.filter(e => !e.isDead);
        else if (actualTargetType === 'ally') targets = Battle.party.filter(p => p && !p.isDead);
        else if (actualTargetType === 'ally_dead') targets = Battle.party.filter(p => p && p.isDead);

        if (actualTargetType === 'all_enemy' || actualTargetType === 'all_ally') {
            const actor = Battle.party[Battle.currentActorIndex];
            Battle.registerAction({ 
                type: Battle.selectingAction, 
                actor: actor, 
                target: actualTargetType, 
                data: Battle.selectedItemOrSkill 
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
            
            btn.onclick = (e) => {
                e.stopPropagation();
                Battle.selectTarget(t);
            };
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
                if (actor.mp < sk.mp) {
                    Battle.log("MPが足りません");
                    return;
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
        actionObj.speed = spd * (0.9 + Math.random() * 0.2);
        
        Battle.commandQueue.push(actionObj);
        Battle.closeSubMenu();
        
        // ★修正: アクション登録後、次のアクターへインデックスを進める
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

    // --- ターン実行フェーズ ---
    executeTurn: async () => {
        Battle.phase = 'execution';
        const nameDiv = Battle.getEl('battle-actor-name');
        if(nameDiv) nameDiv.style.display = 'none';
        Battle.log("--- ターン開始 ---");

        // 1. 敵アクション生成
        Battle.enemies.forEach(e => {
            if (!e.isDead) {
                const spd = e.getStat('spd');
                Battle.commandQueue.push({
                    type: 'enemy_attack',
                    actor: e,
                    speed: spd * (0.9 + Math.random() * 0.2),
                    isEnemy: true
                });
            }
        });

        // 2. 素早さソート
        Battle.commandQueue.sort((a, b) => b.speed - a.speed);

        // 3. 実行ループ
        for (const cmd of Battle.commandQueue) {
            if (!Battle.active) break;
            if (!cmd.actor || cmd.actor.hp <= 0) continue; 

            let target = cmd.target;
            
            if (cmd.isEnemy) {
                const aliveParty = Battle.party.filter(p => p && !p.isDead);
                if (aliveParty.length === 0) break;
                target = aliveParty[Math.floor(Math.random() * aliveParty.length)];
                cmd.target = target;
            } else {
                // 味方行動：ターゲット生存確認（ここでは省略、processAction内で処理を厳密化）
            }

            await Battle.processAction(cmd);
            
            // ★修正: processAction後、必ず描画更新と終了チェックを行う
            Battle.updateDeadState();
            Battle.renderEnemies();
            Battle.renderPartyStatus();

            if (Battle.checkFinish()) return;
            await Battle.wait(500);
        }

        // ターン終了
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

        // アイテム
        if (cmd.type === 'item') {
            const item = data;
            Battle.log(`【${actor.name}】は${item.name}を使った！`);
            
            if (App.data.items[item.id] > 0) {
                App.data.items[item.id]--;
                if(App.data.items[item.id]<=0) delete App.data.items[item.id];
                
                const targets = (cmd.target === 'all_ally') ? Battle.party : [target];
                for (let t of targets) {
                    if (!t) continue;
                    
                    if (item.type === '蘇生') {
                        if (t.isDead) {
                            t.isDead = false;
                            t.hp = Math.floor(t.baseMaxHp * 0.5);
                            Battle.log(`【${t.name}】は生き返った！`);
                            Battle.renderPartyStatus(); // 即座に反映
                        } else Battle.log(`【${t.name}】には効果がなかった`);
                    } else if (item.type === 'HP回復') {
                        if(!t.isDead) {
                            // ★NaN修正: valが数値であることを確認
                            const val = typeof item.val === 'number' ? item.val : 0;
                            const rec = Math.min(t.baseMaxHp - t.hp, val);
                            t.hp += rec;
                            Battle.log(`【${t.name}】のHPが${rec}回復！`);
                            Battle.renderPartyStatus(); // 即座に反映
                        }
                    } else if (item.type === 'MP回復') {
                         if(!t.isDead) {
                            const val = typeof item.val === 'number' ? item.val : 0;
                            const rec = Math.min(t.baseMaxMp - t.mp, val);
                            t.mp += rec;
                            Battle.log(`【${t.name}】のMPが${rec}回復！`);
                            Battle.renderPartyStatus(); // 即座に反映
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

        if (cmd.type === 'skill') {
            skillName = data.name;
            isPhysical = (data.type === '物理');
            multiplier = data.rate;
            baseDmg = data.base;
            mpCost = data.mp;
            effectType = data.type;
            
            if (actor.mp < mpCost) {
                Battle.log(`【${actor.name}】は${skillName}を唱えたがMPが足りない！`);
                return;
            }
            actor.mp -= mpCost;
            Battle.renderPartyStatus();
        }

        Battle.log(`【${actor.name}】の${skillName}！`);

        let targets = [];
        if (cmd.target === 'all_enemy') targets = Battle.enemies.filter(e => e && !e.isDead);
        else if (cmd.target === 'all_ally') targets = Battle.party.filter(p => p);
        else targets = [target];

        for (let t of targets) {
            if (!t) continue;

            // 回復・蘇生スキル
            if (effectType && ['回復','蘇生'].includes(effectType)) {
                if (effectType === '蘇生') {
                    if (t.isDead) {
                        t.isDead = false;
                        t.hp = Math.floor(t.baseMaxHp * 0.5);
                        Battle.log(`【${t.name}】は生き返った！`);
                    } else {
                         Battle.log(`【${t.name}】には効果がなかった`);
                         continue;
                    }
                } else { // 回復スキル
                    if (!t.isDead) {
                        // ★修正: 数値変換とデフォルト値の徹底
                        // data.base や rate が undefined/文字列 の場合に備えて安全に数値化
                        let base = (typeof data.base === 'number') ? data.base : 0;
                        let rate = (typeof data.rate === 'number') ? data.rate : 1.0;
                        
                        let rec = 0;
                        
                        // 固定値(val)がある場合は優先、なければ魔力依存計算
                        if (typeof data.val === 'number') {
                            rec = data.val;
                        } else {
                            // magがNaNの場合に備えて || 0 を追加
                            const mag = actor.getStat('mag') || 0;
                            rec = (mag + base) * rate;
                        }

                        // 最終的な計算結果がNaNにならないよう防衛
                        rec = Math.floor(rec);
                        if (isNaN(rec)) rec = 0;

                        t.hp = Math.min(t.baseMaxHp, t.hp + rec);
                        Battle.log(`【${t.name}】のHPが${rec}回復！`);
                        
                        // 即座に反映 (変更なし)
                        Battle.renderPartyStatus(); 
                    } else {
                        Battle.log(`【${t.name}】は死んでいる！`);
                        continue;
                    }
                }
                // 即座に反映 (executeTurnのループで全体更新もされるが、ここで即時性を高める)
                Battle.renderPartyStatus(); 
                continue;
            }

            // ダメージ処理
            // ターゲットが既に死亡している場合はスキップ (味方攻撃の場合)
            if (t.isDead && !cmd.isEnemy) {
                Battle.log(`【${t.name}】は既に倒れている`);
                continue;
            }
            // 攻撃が味方に向かっている場合（現状敵の攻撃のみ）
            if (!cmd.isEnemy && t instanceof Player) {
                 Battle.log("味方を攻撃することはできません");
                 continue;
            }


            let atkVal = isPhysical ? actor.getStat('atk') : actor.getStat('mag');
            let defVal = t.getStat('def');
            let dmg = Math.floor( (atkVal + baseDmg - defVal/2) * multiplier * (0.9 + Math.random()*0.2) );
            if (dmg < 1) dmg = 1;
            
            if (t.status && t.status.defend) dmg = Math.floor(dmg / 2);

            t.hp -= dmg;
            Battle.log(`【${t.name}】に${dmg}のダメージ！`);
            
            // ダメージ即時反映
            Battle.renderEnemies();
            Battle.renderPartyStatus();

            if (t.hp <= 0) {
                t.hp = 0; t.isDead = true;
                Battle.log(`【${t.name}】は倒れた！`);
                // 死亡即時反映
                Battle.renderEnemies();
                Battle.renderPartyStatus();
            }
            await Battle.wait(200);
        }
    },

    updateDeadState: () => {
        [...Battle.party, ...Battle.enemies].forEach(e => {
            if (e && e.hp <= 0) { e.hp = 0; e.isDead = true; }
        });
    },

    checkFinish: () => {
        if (Battle.enemies.every(e => e.isDead)) {
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
        const alive = Battle.enemies.filter(e => !e.isDead);
        if (alive.length === 0) return null;
        return alive[Math.floor(Math.random() * alive.length)];
    },

    saveBattleState: () => {
        App.data.battle.enemies = Battle.enemies.map(e => ({
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
        // ★修正: HTML側のID(party-status-container)と一致させる
        const container = Battle.getEl('party-status-container'); 
        if(!container) return;
        container.innerHTML = '';
        Battle.party.forEach((p, index) => {
            const div = document.createElement('div');
            div.className = 'p-box';

            // HPの割合計算
            const hpPer = (p.baseMaxHp > 0) ? (p.hp / p.baseMaxHp) * 100 : 0;
            // ★追加: MPの割合計算
            const mpPer = (p.baseMaxMp > 0) ? (p.mp / p.baseMaxMp) * 100 : 0;

            const isActor = (Battle.phase === 'input' && index === Battle.currentActorIndex);
            if(isActor) div.style.border = "2px solid yellow";
            
            let nameStyle = p.isDead ? 'color:red; text-decoration:line-through;' : 'color:white;';
            
            div.innerHTML = `
                <div style="font-size:10px; font-weight:bold; ${nameStyle} overflow:hidden; white-space:nowrap;">${p.name}</div>
                <div class="bar-container"><div class="bar-hp" style="width:${hpPer}%"></div></div>
                <div class="p-val">${p.hp}/${p.baseMaxHp}</div>
                <div class="bar-container"><div class="bar-mp" style="width:${mpPer}%"></div></div>
                <div class="p-val">${p.mp}/${p.baseMaxMp}</div>
            `;
            container.appendChild(div);
        });
    },

    win: () => {
        Battle.phase = 'result';
        Battle.active = false;
        
        const gold = 50 + Math.floor(Math.random()*50);
        const exp = 100;
        App.data.gold += gold;
        
        // 図鑑登録
        Battle.enemies.forEach(e => {
            if(!App.data.book) App.data.book = { monsters: [] };
            if(e.id && !App.data.book.monsters.includes(e.id)) {
                App.data.book.monsters.push(e.id);
            }
        });

        const drops = [];
        Battle.enemies.forEach(e => {
            if (e.drop && Math.random() < 0.3) {
                const item = DB.ITEMS.find(i=>i.id===e.drop) || DB.EQUIPS.find(eq=>eq.id===e.drop);
                if(item) {
                    drops.push(item.name);
                    if(item.type.includes('回復') || item.type.includes('素材')) App.data.items[item.id] = (App.data.items[item.id]||0)+1;
                }
            }
        });

        Battle.log(`\n★勝利！\n獲得: ${gold}G, ${exp}EXP`);
        if(drops.length > 0) Battle.log(`ドロップ: ${drops.join(', ')}`);
        Battle.log("\n▼ 画面タップで終了 ▼");
        
        if(App.data.battle.isBossBattle && typeof Dungeon !== 'undefined') {
            Dungeon.onBossDefeated();
        }
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
            } else {
                setTimeout(() => App.returnToTitle(), 2000);
            }
        } else {
            setTimeout(() => App.changeScene('field'), 500);
        }
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
