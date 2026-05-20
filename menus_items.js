/* MenuItems extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   3. 道具 (MenuItems) - 無限使用バグ修正版
   ========================================================================== */
const MenuItems = {
    selectedItem: null,
    activeTab: 'tools',

    init: () => {
        document.getElementById('sub-screen-items').style.display = 'flex';
        MenuItems.activeTab = 'tools';
        MenuItems.changeScreen('list');
    },

    changeScreen: (mode) => {
        document.getElementById('item-screen-list').style.display = (mode==='list'?'flex':'none');
        document.getElementById('item-screen-target').style.display = (mode==='target'?'flex':'none');
        if(mode==='list') MenuItems.renderList();
    },

    setTab: (tab) => {
        MenuItems.activeTab = (tab === 'valuables') ? 'valuables' : 'tools';
        MenuItems.renderList();
    },

    isValuable: (def) => {
        return !!def && def.type === '貴重品';
    },

    getOwnedItems: () => {
        const items = [];
        Object.keys(App.data.items || {}).forEach(id => {
            const def = DB.ITEMS.find(i => i.id == id);
            const count = Number(App.data.items[id] || 0);
            if(def && count > 0) items.push({ def, count });
        });
        return items;
    },

    getToolSortRank: (def) => {
        if (!def) return 99;
        if (def.type === '乗り物') return 0;
        if (def.type === '移動' || def.id === 110 || def.name === 'スカイプリズム') return 1;
        return 2;
    },

    sortItemsForCurrentTab: (items) => {
        return items.slice().sort((a, b) => {
            if (MenuItems.activeTab === 'tools') {
                const rankDiff = MenuItems.getToolSortRank(a.def) - MenuItems.getToolSortRank(b.def);
                if (rankDiff !== 0) return rankDiff;
            }
            const itemRankDiff = Number(a.def.rank || 9999) - Number(b.def.rank || 9999);
            if (itemRankDiff !== 0) return itemRankDiff;
            return String(a.def.name || '').localeCompare(String(b.def.name || ''), 'ja');
        });
    },

    renderTabs: (list, counts) => {
        const tabWrap = document.createElement('div');
        tabWrap.style.cssText = 'display:flex; background:#222; margin:8px; border-radius:6px; overflow:hidden; border:1px solid #444; position:sticky; top:0; z-index:5; flex-shrink:0;';

        const makeTab = (key, label, count) => {
            const btn = document.createElement('button');
            const active = MenuItems.activeTab === key;
            btn.style.cssText = `flex:1; min-width:0; padding:10px 4px; border:none; background:${active ? '#ffd700' : '#111'}; color:${active ? '#000' : '#777'}; font-weight:bold; font-size:11px; white-space:nowrap; font-family:inherit;`;
            btn.innerText = `${label} (${count})`;
            btn.onclick = () => MenuItems.setTab(key);
            return btn;
        };

        tabWrap.appendChild(makeTab('tools', '道具', counts.tools));
        tabWrap.appendChild(makeTab('valuables', '貴重品', counts.valuables));
        list.appendChild(tabWrap);
    },

    renderList: () => {
        const list = document.getElementById('list-items');
        list.innerHTML = '';

        const allItems = MenuItems.getOwnedItems();
        const tools = allItems.filter(it => !MenuItems.isValuable(it.def));
        const valuables = allItems.filter(it => MenuItems.isValuable(it.def));
        const counts = { tools: tools.length, valuables: valuables.length };

        MenuItems.renderTabs(list, counts);

        const currentItems = MenuItems.sortItemsForCurrentTab(MenuItems.activeTab === 'valuables' ? valuables : tools);
        if (currentItems.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:24px 20px; text-align:center; color:#555;';
            empty.innerText = MenuItems.activeTab === 'valuables' ? '貴重品を持っていません' : '道具を持っていません';
            list.appendChild(empty);
            return;
        }

        currentItems.forEach(it => {
            const div = document.createElement('div');
            div.className = 'list-item menu-pick-card';

            const fallbackPath = Menu.getItemIconPath ? Menu.getItemIconPath(it.def) : 'assets/ui/menu-icons/item-item.svg';
            div.innerHTML = `
                <div class="menu-pick-icon" data-icon-id="item-${it.def.id}"><img src="${fallbackPath}" alt=""></div>
                <div class="menu-pick-main">
                    <div class="menu-pick-title">${Menu.escapeHtml(it.def.name)}</div>
                    <div class="menu-pick-meta">${Menu.escapeHtml(it.def.type || '')}</div>
                    <div class="menu-pick-desc">${Menu.escapeHtml(it.def.desc || '')}</div>
                </div>
                <div class="menu-pick-count">x${it.count}</div>
            `;
            div.onclick = () => MenuItems.handleItemClick(it.def);
            list.appendChild(div);
        });
    },

    handleItemClick: (item) => {
        if (!item) return;

        if (MenuItems.activeTab === 'valuables') {
            Menu.msg("貴重品は使用できません。");
            return;
        }

        // 回復・蘇生に加えて「育成」タイプもターゲット選択へ進む
        if(item.type === '乗り物') {
            MenuItems.selectedItem = item;
            MenuItems.useVehicleItem(item);
        } else if(item.type === '移動' || item.id === 110 || item.name === 'スカイプリズム') {
            MenuItems.selectedItem = item;
            MenuItems.useSkyPrismItem(item);
        } else if(item.type && (item.type.includes('回復') || item.type.includes('蘇生') || item.type.includes('育成'))) {
            MenuItems.selectedItem = item;
            MenuItems.renderTargetList();
        } else {
            Menu.msg("使用できないアイテムです。");
        }
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

    useSkyPrismItem: (item) => {
        if (!item) return;
        if (!App.data.items[item.id] || App.data.items[item.id] <= 0) {
            Menu.msg("アイテムを持っていません。");
            MenuItems.changeScreen('list');
            return;
        }
        if (typeof App.isInDungeonForSkyPrism === 'function' && App.isInDungeonForSkyPrism()) {
            Menu.msg("ダンジョン内ではスカイプリズムを使えない。");
            return;
        }
        if (typeof App.getAllFixedMapDiscoveryEntries !== 'function') {
            Menu.msg("移動先リストを作成できませんでした。");
            return;
        }

        const entries = App.getAllFixedMapDiscoveryEntries();
        if (!entries.length) {
            Menu.msg("移動できる固有MAPがありません。");
            return;
        }

        const discoveredCount = entries.filter(e => e.discovered).length;
        const choices = entries.map((entry) => {
            if (!entry.discovered) {
                return { label: '？？？', disabled: true, background: '#333' };
            }

            const kindLabel = entry.kind === 'dungeon' ? 'ダンジョン' : '固有MAP';
            const parentNote = entry.destination?.parentAreaKey ? ' 付近' : '';
            const label = `${entry.name}${parentNote} [${kindLabel}]`;
            return {
                label,
                callback: () => {
                    Menu.confirm(`${entry.name}${parentNote}へ移動しますか？
スカイプリズムを1個消費します。`, () => {
                        const result = (typeof App.useSkyPrismTo === 'function')
                            ? App.useSkyPrismTo(entry.areaKey)
                            : { ok: false, message: 'スカイプリズムを使用できませんでした。' };

                        if (result.ok) {
                            if (typeof Menu !== 'undefined' && typeof Menu.closeAll === 'function') Menu.closeAll();
                            if (typeof Field !== 'undefined' && typeof Field.render === 'function') Field.render();
                            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
                            // 成功時は App.useSkyPrismTo() 側の App.log のみ表示する。
                            // 追加の「〇〇へ移動した！」モーダルは出さない。
                        } else {
                            Menu.msg(result.message || '移動できません。');
                        }
                    });
                }
            };
        });

        Menu.listChoice(`スカイプリズム：移動先を選択
発見済み ${discoveredCount}/${entries.length}`, choices);
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
                    case 100: target.hp += 3; msg = `${target.name}の最大HPが上がった！`; break;
                    case 101: target.mp += 2; msg = `${target.name}の最大MPが上がった！`; break;
                    case 102: target.atk += 1; msg = `${target.name}の攻撃力が上がった！`; break;
                    case 103: target.mag += 1; msg = `${target.name}の魔力が上がった！`; break;
                    case 104: target.spd += 1; msg = `${target.name}の素早さが上がった！`; break;
                    case 105: target.def += 1; msg = `${target.name}の防御力が上がった！`; break;
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
