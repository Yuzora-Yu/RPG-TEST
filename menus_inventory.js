/* MenuInventory extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   4. 所持装備一覧 (ページング・一括売却対応版)
   ========================================================================== */
const MenuInventory = {
    selectedIds: [],
    filter: {
        category: 'ALL',
        option: 'ALL'
    },
    sortMode: 'NEWEST', // 'NEWEST': 取得順, 'RANK': Rank順
    page: 0,
    pageSize: 80,

    rarityOrder: { EX: 6, UR: 5, SSR: 4, SR: 3, R: 2, N: 1 },
    bulkRarityThresholds: { R: 2, SR: 3, SSR: 4, UR: 5 },

    init: () => {
        const subScreen = document.getElementById('sub-screen-inventory');
        if (subScreen) {
            subScreen.style.display = 'flex';

            let ctrlDiv = document.getElementById('inventory-controls');
            if (!ctrlDiv) {
                ctrlDiv = document.createElement('div');
                ctrlDiv.id = 'inventory-controls';
                ctrlDiv.style.cssText = 'flex-shrink:0; background:#1a1a1a; border-bottom:1px solid #444;';
                const header = subScreen.querySelector('.header-bar');
                if (header) {
                    subScreen.insertBefore(ctrlDiv, header.nextSibling);
                } else {
                    subScreen.appendChild(ctrlDiv);
                }
            }
        }
        MenuInventory.selectedIds = [];
        MenuInventory.page = 0;
        MenuInventory.render();
    },

    // フィルタ・ソート更新
    updateState: (key, val) => {
        if (key === 'sortMode') MenuInventory.sortMode = val;
        else MenuInventory.filter[key] = val;
        MenuInventory.page = 0;
        MenuInventory.render();
    },

    updatePage: (delta) => {
        MenuInventory.page = Math.max(0, MenuInventory.page + delta);
        MenuInventory.render();
    },

    getOwnerMap: () => {
        const ownerMap = new Map();
        (App.data.characters || []).forEach(char => {
            if (!char || !char.equips) return;
            Object.values(char.equips).forEach(eq => {
                const id = eq && (typeof eq === 'object' ? eq.id : eq);
                if (id !== undefined && id !== null) ownerMap.set(String(id), char);
            });
        });
        return ownerMap;
    },

    getRules: () => {
        return (typeof OPT_RULES !== 'undefined')
            ? OPT_RULES
            : (typeof DB !== 'undefined' && DB.OPT_RULES ? DB.OPT_RULES : []);
    },

    getFilteredItems: () => {
        let items = (App.data.inventory || []).map((item, idx) => ({ ...item, _originalIdx: idx }));

        items = items.filter(item => {
            if (MenuInventory.filter.category !== 'ALL' && item.type !== MenuInventory.filter.category) return false;
            if (MenuInventory.filter.option !== 'ALL') {
                if (!item.opts) return false;
                const targetKey = MenuInventory.filter.option;
                if (!item.opts.some(o => (o.key + (o.elm ? '_' + o.elm : '')) === targetKey)) return false;
            }
            return true;
        });

        items.sort((a, b) => {
            if (MenuInventory.sortMode === 'RANK') {
                if (b.rank !== a.rank) return b.rank - a.rank;
                const rA = MenuInventory.rarityOrder[a.rarity] || 0;
                const rB = MenuInventory.rarityOrder[b.rarity] || 0;
                if (rB !== rA) return rB - rA;
                return (b.plus || 0) - (a.plus || 0);
            }
            return b._originalIdx - a._originalIdx;
        });

        return items;
    },

    // ロック切り替え
    toggleLock: (id) => {
        const item = App.data.inventory.find(i => String(i.id) === String(id));
        if (item) {
            item.locked = !item.locked;
            App.save();
            MenuInventory.render();
        }
    },

    renderControls: (items, totalPages) => {
        const ctrlDiv = document.getElementById('inventory-controls');
        if (!ctrlDiv) return;

        const rules = MenuInventory.getRules();
        const start = items.length === 0 ? 0 : (MenuInventory.page * MenuInventory.pageSize) + 1;
        const end = Math.min(items.length, (MenuInventory.page + 1) * MenuInventory.pageSize);

        ctrlDiv.innerHTML = `
            <div style="padding:5px; display:flex; gap:4px; overflow-x:auto; background:#222; border-bottom:1px solid #333;">
                ${['ALL', '武器', '盾', '頭', '体', '足'].map(c => `
                    <button class="btn" style="padding:2px 10px; font-size:10px; flex-shrink:0; background:${MenuInventory.filter.category === c ? '#008888' : '#444'};"
                        onclick="MenuInventory.updateState('category', '${c}')">${c === 'ALL' ? '全て' : c}</button>
                `).join('')}
            </div>

            <div style="padding:5px; background:#1a1a1a; display:flex; align-items:center; gap:8px; border-bottom:1px solid #333;">
                <div style="flex:1; display:flex; align-items:center; gap:4px;">
                    <span style="font-size:9px; color:#aaa;">効果:</span>
                    <select style="background:#333; color:#fff; font-size:10px; border:1px solid #555; flex:1; height:22px; touch-action:auto; user-select:auto; -webkit-user-select:auto;" ${Menu.selectTouchAttrs()}
                        onchange="MenuInventory.updateState('option', this.value)">
                        <option value="ALL">全て</option>
                        ${rules.map(opt => {
                            const val = opt.key + (opt.elm ? '_' + opt.elm : '');
                            return `<option value="${val}" ${MenuInventory.filter.option === val ? 'selected' : ''}>${opt.name}</option>`;
                        }).join('')}
                    </select>
                </div>
                <div style="flex:1; display:flex; align-items:center; gap:4px;">
                    <span style="font-size:9px; color:#aaa;">並替:</span>
                    <select style="background:#333; color:#fff; font-size:10px; border:1px solid #555; flex:1; height:22px; touch-action:auto; user-select:auto; -webkit-user-select:auto;" ${Menu.selectTouchAttrs()}
                        onchange="MenuInventory.updateState('sortMode', this.value)">
                        <option value="NEWEST" ${MenuInventory.sortMode === 'NEWEST' ? 'selected' : ''}>取得順</option>
                        <option value="RANK" ${MenuInventory.sortMode === 'RANK' ? 'selected' : ''}>Rank順</option>
                    </select>
                </div>
            </div>

            <div style="padding:6px 8px; display:grid; grid-template-columns:70px 1fr 70px; gap:6px; align-items:center; background:#202020; border-bottom:1px solid #333;">
                <button class="btn" style="font-size:11px; padding:4px;" ${MenuInventory.page <= 0 ? 'disabled' : ''} onclick="MenuInventory.updatePage(-1)">前へ</button>
                <div style="font-size:11px; color:#ccc; text-align:center;">
                    ${items.length === 0 ? '0件' : `${start}-${end} / ${items.length}件`}　
                    ${totalPages > 1 ? `${MenuInventory.page + 1}/${totalPages}` : '1/1'}
                </div>
                <button class="btn" style="font-size:11px; padding:4px;" ${MenuInventory.page >= totalPages - 1 ? 'disabled' : ''} onclick="MenuInventory.updatePage(1)">次へ</button>
            </div>

            <div style="padding:8px 10px; display:flex; gap:8px; justify-content:space-between; align-items:center; background:#2a2a2a;">
                <span style="font-size:11px; color:#aaa;">選択: <span style="color:#fff;">${MenuInventory.selectedIds.length}</span> 個</span>
                <div style="display:flex; gap:6px;">
                    <button class="btn" style="background:#553300; font-size:11px; padding:4px 10px;" onclick="MenuInventory.openBulkSellModal()">一括売却</button>
                    <button class="btn" style="background:${MenuInventory.selectedIds.length > 0 ? '#800' : '#444'}; font-size:11px; padding:4px 10px;"
                        onclick="MenuInventory.sellSelected()">選択売却</button>
                </div>
            </div>
        `;
        Menu.makeSelectTouchSafe(ctrlDiv);
    },

    // メイン描画
    render: () => {
        document.getElementById('inventory-gold').innerText = App.data.gold;
        const ctrlDiv = document.getElementById('inventory-controls');
        if (!ctrlDiv) return;

        const list = document.getElementById('inventory-list');
        if (!list) return;

        const ownerMap = MenuInventory.getOwnerMap();
        const selectedSet = new Set(MenuInventory.selectedIds.map(id => String(id)));
        const items = MenuInventory.getFilteredItems();
        const totalPages = Math.max(1, Math.ceil(items.length / MenuInventory.pageSize));
        MenuInventory.page = Math.min(Math.max(0, MenuInventory.page), totalPages - 1);

        MenuInventory.renderControls(items, totalPages);
        list.innerHTML = '';

        if (items.length === 0) {
            list.innerHTML = `<div style="padding:40px; text-align:center; color:#555; font-size:12px;">装備がありません</div>`;
            return;
        }

        const pageStart = MenuInventory.page * MenuInventory.pageSize;
        const pageItems = items.slice(pageStart, pageStart + MenuInventory.pageSize);

        pageItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.cssText = `flex-direction:column; align-items:flex-start; position:relative; ${selectedSet.has(String(item.id)) ? 'background:#422; border-left:3px solid #f44;' : ''}`;

            const owner = ownerMap.get(String(item.id));
            const rarityColor = Menu.getRarityColor(item.rarity || 'N');

            let traitHtml = '';
            if (item.traits && item.traits.length > 0) {
                traitHtml = `<div style="display:flex; flex-wrap:wrap; gap:2px 6px; margin-top:2px; border-top:1px dashed #444; padding-top:2px; width:100%;">` +
                    item.traits.map(t => {
                        const m = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.MASTER[t.id] : null;
                        return m ? `<span style="color:#00ffff; font-size:9px;">${m.name} Lv${t.level}</span>` : '';
                    }).join('') +
                `</div>`;
            }

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%; border-bottom:1px solid #333; padding-bottom:4px; margin-bottom:4px;">
                    <div style="display:flex; align-items:center; gap:5px; min-width:0;">
                        <input type="checkbox" ${selectedSet.has(String(item.id)) ? 'checked' : ''} ${item.locked || owner ? 'disabled' : ''}>
                        <span style="color:${rarityColor}; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</span>
                        ${item.locked ? '<span style="color:#ffd700; font-size:10px;">🔒</span>' : ''}
                        ${owner ? `<span style="color:#f88; font-size:9px; flex-shrink:0;">[${owner.name}]</span>` : ''}
                    </div>
                    <button class="btn" style="padding:2px 8px; font-size:9px; background:${item.locked ? '#644' : '#444'}; flex-shrink:0;"
                        onclick="event.stopPropagation(); MenuInventory.toggleLock('${item.id}')">${item.locked ? '解除' : 'ロック'}</button>
                </div>
                ${Menu.getEquipDetailHTML(item, false)}
                ${traitHtml}
            `;

            div.onclick = () => {
                if (item.locked || owner) return;
                MenuInventory.toggleSelect(item.id);
            };
            list.appendChild(div);
        });
    },

    toggleSelect: (id) => {
        const key = String(id);
        const selected = MenuInventory.selectedIds.map(v => String(v));
        const idx = selected.indexOf(key);
        if (idx > -1) MenuInventory.selectedIds.splice(idx, 1);
        else MenuInventory.selectedIds.push(id);
        MenuInventory.render();
    },

    sellSelected: () => {
        const selectedSet = new Set(MenuInventory.selectedIds.map(id => String(id)));
        const ownerMap = MenuInventory.getOwnerMap();
        const targets = App.data.inventory.filter(i => selectedSet.has(String(i.id)) && !i.locked && !ownerMap.has(String(i.id)));
        if (targets.length === 0) return Menu.msg("売却するアイテムを選択してください");

        const totalGold = MenuInventory.calcSellGold(targets);
        Menu.confirm(`${targets.length} 個の装備を合計 ${totalGold.toLocaleString()}G で売却しますか？`, () => {
            MenuInventory.removeTargets(targets);
            App.data.gold += totalGold;
            MenuInventory.selectedIds = [];
            App.save();
            Menu.msg(`${totalGold.toLocaleString()}G 獲得しました`);
            MenuInventory.render();
        });
    },

    calcSellGold: (items) => items.reduce((sum, i) => sum + Math.floor(Number(i.val || 0) / 2), 0),

    removeTargets: (targets) => {
        const targetIds = new Set(targets.map(i => String(i.id)));
        App.data.inventory = (App.data.inventory || []).filter(i => !targetIds.has(String(i.id)));
        MenuInventory.selectedIds = MenuInventory.selectedIds.filter(id => !targetIds.has(String(id)));
    },

    getMaxOptionRarityRank: (item) => {
        const opts = Array.isArray(item.opts) ? item.opts : [];
        if (opts.length === 0) return 0;
        return opts.reduce((max, opt) => Math.max(max, MenuInventory.rarityOrder[opt.rarity || 'N'] || 0), 0);
    },

    getBulkSellCriteriaFromModal: () => {
        const getVal = (id, fallback) => {
            const el = document.getElementById(id);
            return el ? el.value : fallback;
        };
        return {
            plusLimit: getVal('bulk-sell-plus', '1'),
            optionRarityLimit: getVal('bulk-sell-option-rarity', 'R'),
            traitMode: getVal('bulk-sell-traits', 'NONE')
        };
    },

    isBulkSellTarget: (item, criteria, ownerMap) => {
        if (!item || item.locked) return false;
        if (ownerMap && ownerMap.has(String(item.id))) return false;

        if (criteria.plusLimit !== 'ALL') {
            const plusLimit = Number(criteria.plusLimit);
            if (Number(item.plus || 0) > plusLimit) return false;
        }

        if (criteria.optionRarityLimit !== 'ALL') {
            const threshold = MenuInventory.bulkRarityThresholds[criteria.optionRarityLimit] || 0;
            if (MenuInventory.getMaxOptionRarityRank(item) > threshold) return false;
        }

        if (criteria.traitMode === 'NONE' && Array.isArray(item.traits) && item.traits.length > 0) return false;

        return true;
    },

    getBulkSellTargets: (criteria, ownerMap = MenuInventory.getOwnerMap()) => {
        return (App.data.inventory || []).filter(item => MenuInventory.isBulkSellTarget(item, criteria, ownerMap));
    },

    openBulkSellModal: () => {
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');
        if (!area || !textEl || !btnEl) return;

        textEl.innerHTML = `
            <div style="text-align:left; display:flex; flex-direction:column; gap:10px;">
                <div style="text-align:center; color:#ffd700; font-weight:bold;">一括売却 条件設定</div>
                <div style="font-size:11px; color:#f88; line-height:1.5;">ロック中・装備中の装備は常に対象外です。条件はANDで判定します。</div>
                ${MenuInventory.renderBulkSelect('装備強化状況', 'bulk-sell-plus', [
                    ['1', '+1以下'],
                    ['2', '+2以下'],
                    ['ALL', 'すべて']
                ])}
                ${MenuInventory.renderBulkSelect('付加効果レアリティ', 'bulk-sell-option-rarity', [
                    ['R', 'R以下'],
                    ['SR', 'SR以下'],
                    ['SSR', 'SSR以下'],
                    ['UR', 'UR以下'],
                    ['ALL', 'すべて']
                ])}
                ${MenuInventory.renderBulkSelect('装備特性', 'bulk-sell-traits', [
                    ['NONE', 'なし'],
                    ['ALL', 'すべて']
                ])}
                <div id="bulk-sell-preview" style="padding:8px; background:#111; border:1px solid #444; color:#ccc; font-size:12px; line-height:1.5; text-align:center;"></div>
            </div>
        `;

        btnEl.innerHTML = '';
        btnEl.style.flexDirection = 'row';
        btnEl.style.gap = '10px';

        const executeBtn = document.createElement('button');
        executeBtn.className = 'btn';
        executeBtn.style.minWidth = '100px';
        executeBtn.style.background = '#800';
        executeBtn.innerText = '売却実行';
        executeBtn.onclick = () => MenuInventory.executeBulkSellFromModal();

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn';
        cancelBtn.style.minWidth = '100px';
        cancelBtn.style.background = '#444';
        cancelBtn.innerText = 'やめる';
        cancelBtn.onclick = () => Menu.closeDialog();

        btnEl.appendChild(executeBtn);
        btnEl.appendChild(cancelBtn);
        area.style.position = 'fixed';
        area.style.zIndex = '1000000';
        area.style.inset = '0';
        area.style.display = 'flex';

        Menu.makeSelectTouchSafe(textEl);
        MenuInventory.updateBulkSellPreview();
    },

    renderBulkSelect: (label, id, options) => {
        return `
            <label style="display:flex; flex-direction:column; gap:4px; font-size:12px; color:#ddd;">
                <span>${label}</span>
                <select id="${id}" style="background:#333; color:#fff; border:1px solid #555; padding:6px; font-family:inherit; touch-action:auto; user-select:auto; -webkit-user-select:auto;" ${Menu.selectTouchAttrs()}
                    onchange="MenuInventory.updateBulkSellPreview()">
                    ${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}
                </select>
            </label>
        `;
    },

    updateBulkSellPreview: () => {
        const preview = document.getElementById('bulk-sell-preview');
        if (!preview) return;
        const criteria = MenuInventory.getBulkSellCriteriaFromModal();
        const targets = MenuInventory.getBulkSellTargets(criteria);
        const totalGold = MenuInventory.calcSellGold(targets);
        preview.innerHTML = `
            対象装備: <span style="color:#fff; font-weight:bold;">${targets.length.toLocaleString()}</span> 個<br>
            売却額: <span style="color:#ffd700; font-weight:bold;">${totalGold.toLocaleString()}G</span>
        `;
    },

    executeBulkSellFromModal: () => {
        const criteria = MenuInventory.getBulkSellCriteriaFromModal();
        const targets = MenuInventory.getBulkSellTargets(criteria);
        if (targets.length === 0) {
            Menu.msg("条件に一致する売却対象はありません。");
            return;
        }

        const totalGold = MenuInventory.calcSellGold(targets);
        Menu.confirm(
            `${targets.length.toLocaleString()} 個の装備を一括売却します。\n合計 ${totalGold.toLocaleString()}G を獲得します。\n本当に実行しますか？`,
            () => {
                MenuInventory.removeTargets(targets);
                App.data.gold += totalGold;
                MenuInventory.page = 0;
                App.save();
                MenuInventory.render();
                Menu.msg(`${targets.length.toLocaleString()} 個の装備を売却し、${totalGold.toLocaleString()}G を獲得しました。`);
            }
        );
    }
};

if (typeof window !== 'undefined') window.MenuInventory = MenuInventory;
