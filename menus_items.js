/* MenuItems extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   3. 道具 (MenuItems) - 無限使用バグ修正版
   ========================================================================== */
const MenuItems = {
    selectedItem: null,
    init: () => {
        document.getElementById('sub-screen-items').style.display = 'flex';
        MenuItems.changeScreen('list');
    },
    changeScreen: (mode) => {
        document.getElementById('item-screen-list').style.display = (mode==='list'?'flex':'none');
        document.getElementById('item-screen-target').style.display = (mode==='target'?'flex':'none');
        if(mode==='list') MenuItems.renderList();
    },
    renderList: () => {
        const list = document.getElementById('list-items');
        list.innerHTML = '';
        const items = [];
        Object.keys(App.data.items).forEach(id => {
            const def = DB.ITEMS.find(i=>i.id == id);
            if(def && App.data.items[id] > 0) items.push({def:def, count:App.data.items[id]});
        });

        if (items.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#555;">道具を持っていません</div>';
        }

        items.forEach(it => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:bold;">${it.def.name}</div>
                    <div style="font-size:10px; color:#aaa;">${it.def.desc}</div>
                </div>
                <div style="font-weight:bold; color:#ffd700;">x${it.count}</div>
            `;
            div.onclick = () => {
                // 回復・蘇生に加えて「育成」タイプもターゲット選択へ進む
                if(it.def.type === '乗り物') {
                    MenuItems.selectedItem = it.def;
                    MenuItems.useVehicleItem(it.def);
                } else if(it.def.type.includes('回復') || it.def.type.includes('蘇生') || it.def.type.includes('育成')) {
                    MenuItems.selectedItem = it.def;
                    MenuItems.renderTargetList();
                } else {
                    const footer = document.getElementById('item-footer');
                    if(footer) footer.innerText = "使用できないアイテムです";
                }
            };
            list.appendChild(div);
        });
    },
    useVehicleItem: (item) => {
        if (!item) return;
        if (!App.data.items[item.id] || App.data.items[item.id] <= 0) {
            Menu.msg("アイテムを持っていません。");
            MenuItems.changeScreen('list');
            return;
        }

        // 乗り物タイプは使用しても消費しない。
        if (item.id === 109 || item.name === '光の翼') {
            const used = (typeof App.useLightWing === 'function') ? App.useLightWing() : false;
            if (used) {
                if (typeof Menu !== 'undefined' && typeof Menu.closeAll === 'function') Menu.closeAll();
                if (typeof Field !== 'undefined' && typeof Field.render === 'function') Field.render();
            }
            return;
        }

        Menu.msg("この乗り物はまだ使用できません。");
    },
    renderTargetList: () => {
        MenuItems.changeScreen('target');
        const list = document.getElementById('list-item-targets');
        list.innerHTML = '';
        
        // アイテム情報の表示
        const item = MenuItems.selectedItem;
        const count = App.data.items[item.id] || 0;
        const header = document.createElement('div');
        header.style.cssText = 'padding:10px; background:#333; color:#ffd700; font-size:12px; text-align:center; border-bottom:1px solid #444;';
        header.innerHTML = `使用中: <b>${item.name}</b> (残り: ${count}個)`;
        list.appendChild(header);

        App.data.party.forEach(uid => {
            if(!uid) return;
            const c = App.getChar(uid);
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = App.createCharHTML(c);
            div.onclick = () => MenuItems.useItem(c);
            list.appendChild(div);
        });
    },
    useItem: (target) => {
        const item = MenuItems.selectedItem;
        // ★修正: 所持チェックの厳格化 (undefined または 0 以下なら中止)
        if(!item || !App.data.items[item.id] || App.data.items[item.id] <= 0) {
            Menu.msg("アイテムを持っていません。");
            MenuItems.changeScreen('list');
            return;
        }

        Menu.confirm(`${target.name} に ${item.name} を使いますか？`, () => {
            let success = false;
            let msg = "";
            const s = App.calcStats(target);
            const master = DB.CHARACTERS.find(c => c.id === target.charId) || target;

            // --- A. 通常の回復アイテム処理 ---
            if(item.type === 'HP回復') {
                if(target.currentHp >= s.maxHp) { Menu.msg("HPは満タンです"); return; }
                target.currentHp = Math.min(s.maxHp, (target.currentHp || 0) + item.val);
                success = true; msg = `${target.name}は回復した！`;
            } else if(item.type === 'MP回復') {
                if(target.currentMp >= s.maxMp) { Menu.msg("MPは満タンです"); return; }
                target.currentMp = Math.min(s.maxMp, (target.currentMp || 0) + item.val);
                success = true; msg = `${target.name}は回復した！`;
            } else if(item.type === '蘇生') {
                if(target.currentHp > 0) { Menu.msg("生き返っています"); return; }
                target.currentHp = Math.floor(s.maxHp * 1);
                success = true; msg = `${target.name}は生き返った！`;
            }

            // --- B. 育成アイテム(100-107)の処理 ---
            else if (item.id >= 100 && item.id <= 107) {
                success = true;
                switch(item.id) {
                    case 100: target.hp += Math.floor(master.hp * 2.0); msg = `${target.name}の最大HPが上がった！`; break;
                    case 101: target.mp += Math.floor(master.mp * 2.0); msg = `${target.name}の最大MPが上がった！`; break;
                    case 102: target.atk += Math.floor(master.atk * 1.0); msg = `${target.name}の攻撃力が上がった！`; break;
                    case 103: target.mag += Math.floor(master.mag * 1.0); msg = `${target.name}の魔力が上がった！`; break;
                    case 104: target.spd += Math.floor(master.spd * 1.0); msg = `${target.name}の素早さが上がった！`; break;
                    case 105: target.def += Math.floor(master.def * 1.0); msg = `${target.name}の防御力が上がった！`; break;
                    case 106: target.sp = (target.sp || 0) + 1; msg = `${target.name}のSPが 1 増えた！`; break;
                    case 107: 
                        // ★修正: ターゲットのレベルが100の時だけ使用可能にする
                        if (target.level < 100) {
                            Menu.msg("レベルが不足しており使用できません");
                            success = false; // アイテム消費を防ぐ
                        } else {
                            target.level = 1;
                            target.exp = 0;
                            target.reincarnationCount = (target.reincarnationCount || 0) + 1;
                            msg = `${target.name}は 転生しレベル1に戻った！\n(転生回数: ${target.reincarnationCount}回目)`; 
                        }
                        break;
                }
            }

            if(success) {
                App.data.items[item.id]--;
                const currentCount = App.data.items[item.id];
                
                if(currentCount <= 0) delete App.data.items[item.id];
                
                App.save();
                Menu.msg(msg, () => {
                    // ★修正: 使い切った(個数がなくなった)場合はリスト画面にもどる
                    if(!App.data.items[item.id] || App.data.items[item.id] <= 0) {
                        MenuItems.changeScreen('list');
                    } else {
                        MenuItems.renderTargetList();
                    }
                    Menu.renderPartyBar();
                });
            }
        });
    }
};

if (typeof window !== 'undefined') window.MenuItems = MenuItems;
