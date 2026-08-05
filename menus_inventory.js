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

    escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch])),

    ensureCardStyle: () => {
        if (typeof EquipAcquisitionCard !== 'undefined' && typeof EquipAcquisitionCard.injectStyle === 'function') {
            EquipAcquisitionCard.injectStyle();
        }
        if (document.getElementById('inventory-equip-card-style')) return;
        const style = document.createElement('style');
        style.id = 'inventory-equip-card-style';
        style.textContent = `
            #inventory-list.inventory-equip-card-list{padding:8px 7px 26px;box-sizing:border-box}
            .inventory-equip-card-shell{position:relative;isolation:isolate;margin:0 0 8px;background:rgba(7,7,9,.9);color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.46);font-family:'DotGothic16',sans-serif;overflow:visible}
            .inventory-equip-card-shell.is-selected{background:rgba(55,18,18,.94)}
            .inventory-equip-card-shell.is-synergy::before{content:"";position:absolute;inset:-6px;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 18% 45%,rgba(102,246,255,.32),transparent 50%),radial-gradient(ellipse at 78% 38%,rgba(180,92,255,.3),transparent 52%),radial-gradient(ellipse at 52% 82%,rgba(72,255,176,.24),transparent 58%);filter:blur(8px);animation:inventoryEquipAuraDrift 3.2s ease-in-out infinite alternate}
            .inventory-equip-card{position:relative;z-index:1;padding:8px 9px 0;background:inherit}
            .inventory-equip-card .equip-acquisition-main{grid-template-columns:56px minmax(0,1fr);gap:8px}
            .inventory-equip-card .equip-acquisition-image{width:56px;height:56px;border:0;border-radius:0}
            .inventory-equip-card .equip-acquisition-name{font-size:15px}
            .inventory-equip-card .equip-acquisition-rank{font-size:9px}
            .inventory-equip-card .equip-acquisition-base-stats{margin-top:4px;font-size:10px;line-height:1.35}
            .inventory-equip-option-list{display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:4px;font-size:10px;line-height:1.35}
            .inventory-equip-trait-list{margin-top:4px;color:#ffd27a;font-size:10px;line-height:1.35;overflow-wrap:anywhere}
            .inventory-equip-synergy-list{margin-top:5px;font-size:10px;line-height:1.35}
            .inventory-equip-synergy{padding:3px 5px;background:rgba(255,255,255,.06)}
            .inventory-equip-synergy strong{margin-right:5px}
            .inventory-equip-footer{margin:7px -9px 0;padding:5px 8px;min-height:29px;box-sizing:border-box;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.045);font-size:10px;color:#aaa}
            .inventory-equip-select{display:flex;align-items:center;gap:5px;color:#ddd;cursor:pointer;white-space:nowrap}
            .inventory-equip-select input{margin:0;width:14px;height:14px;accent-color:#d6aa25}
            .inventory-equip-owner{min-width:0;flex:1;text-align:center;color:#f2a0a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .inventory-equip-lock{border:0;border-radius:0;background:#303843;color:#fff;font-family:inherit;font-size:10px;line-height:1;padding:6px 10px;min-width:58px;cursor:pointer}
            .inventory-equip-lock.is-locked{background:#694141;color:#ffe0a3}
            .inventory-equip-lock:active{filter:brightness(1.25)}
            @keyframes inventoryEquipAuraDrift{0%{opacity:.58;transform:scale(.985);filter:blur(8px) hue-rotate(0deg)}100%{opacity:.86;transform:scale(1.012);filter:blur(10px) hue-rotate(38deg)}}
            @media(max-width:340px){#inventory-list.inventory-equip-card-list{padding-left:5px;padding-right:5px}.inventory-equip-card{padding-left:7px;padding-right:7px}.inventory-equip-footer{margin-left:-7px;margin-right:-7px}.inventory-equip-card .equip-acquisition-main{grid-template-columns:50px minmax(0,1fr);gap:7px}.inventory-equip-card .equip-acquisition-image{width:50px;height:50px}.inventory-equip-card .equip-acquisition-name{font-size:14px}}
            @media(prefers-reduced-motion:reduce){.inventory-equip-card-shell.is-synergy::before{animation:none}}
        `;
        document.head.appendChild(style);
    },

    getCardManager: () => (typeof EquipAcquisitionCard !== 'undefined' ? EquipAcquisitionCard : null),

    getCardSynergies: (item) => {
        if (Array.isArray(item?.synergies) && item.synergies.length) return item.synergies;
        if (typeof App.checkSynergy === 'function') {
            const result = App.checkSynergy(item);
            return Array.isArray(result) ? result : [];
        }
        return [];
    },

    getCardHTML: (item, owner, selected) => {
        const card = MenuInventory.getCardManager();
        const rarityColor = card?.getRarityColor?.(item?.rarity || 'N') || Menu.getRarityColor(item?.rarity || 'N');
        const baseStats = card?.getBaseStats?.(item) || ['基礎能力なし'];
        const baseStatsHtml = baseStats.map(text => {
            const skill = String(text).startsWith('[習得:');
            return `<span${skill ? ' class="equip-acquisition-grant-skill"' : ''}>${MenuInventory.escapeHtml(text)}</span>`;
        }).join(' ');
        const options = Array.isArray(item?.opts) ? item.opts : [];
        const optionsHtml = options.map(option => {
            const color = card?.getRarityColor?.(option?.rarity || 'N') || Menu.getRarityColor(option?.rarity || 'N');
            const text = card?.getOptionText?.(option) || `${option?.label || option?.key || '追加効果'} ${Number(option?.val) >= 0 ? '+' : ''}${Number(option?.val) || 0}`;
            return `<span style="color:${color}">${MenuInventory.escapeHtml(text)}</span>`;
        }).join('');
        const traits = Array.isArray(item?.traits) ? item.traits : [];
        const traitsHtml = traits.map(trait => MenuInventory.escapeHtml(card?.getTraitText?.(trait) || `特性${Number(trait?.id ?? trait) || ''}`)).join('・');
        const synergies = MenuInventory.getCardSynergies(item);
        const synergiesHtml = synergies.map(syn => `
            <div class="inventory-equip-synergy">
                <strong style="color:${MenuInventory.escapeHtml(syn?.color || '#fff3a5')}">${MenuInventory.escapeHtml(syn?.name || '共鳴')}</strong>
                <span>${MenuInventory.escapeHtml(syn?.desc || '')}</span>
            </div>`).join('');
        const eid = Math.max(0, Number(item?.eid ?? item?.masterEid ?? item?.equipMasterId) || 0);
        const ownerName = owner?.name ? `装備中：${MenuInventory.escapeHtml(owner.name)}` : '';
        const disabled = item?.locked || owner;
        return `
            <div class="inventory-equip-card ${synergies.length ? 'has-synergy' : ''}">
                <div class="equip-acquisition-main">
                    <div class="equip-acquisition-image" data-eid="${eid}">
                        <div class="equip-acquisition-image-fallback">${MenuInventory.escapeHtml(item?.baseName || item?.type || '装備')}</div>
                        <img alt="" draggable="false">
                    </div>
                    <div class="equip-acquisition-summary">
                        <div class="equip-acquisition-name-line">
                            <div class="equip-acquisition-name" style="color:${rarityColor}">${MenuInventory.escapeHtml(item?.name || '装備')}</div>
                            <div class="equip-acquisition-rank">Rank ${Math.max(0, Number(item?.rank) || 0)}</div>
                        </div>
                        <div class="equip-acquisition-base-stats">${baseStatsHtml}</div>
                        ${optionsHtml ? `<div class="inventory-equip-option-list">${optionsHtml}</div>` : ''}
                        ${traitsHtml ? `<div class="inventory-equip-trait-list">${traitsHtml}</div>` : ''}
                        ${synergiesHtml ? `<div class="inventory-equip-synergy-list">${synergiesHtml}</div>` : ''}
                    </div>
                </div>
                <div class="inventory-equip-footer">
                    <label class="inventory-equip-select">
                        <input type="checkbox" ${selected ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                        <span>選択</span>
                    </label>
                    <div class="inventory-equip-owner">${ownerName}</div>
                    <button type="button" class="inventory-equip-lock ${item?.locked ? 'is-locked' : ''}">${item?.locked ? '解除' : 'ロック'}</button>
                </div>
            </div>`;
    },

    hydrateCardImage: (cardElement) => {
        const imageBox = cardElement?.querySelector?.('.equip-acquisition-image');
        const image = imageBox?.querySelector?.('img');
        const fallback = imageBox?.querySelector?.('.equip-acquisition-image-fallback');
        const eid = Number(imageBox?.dataset?.eid) || 0;
        if (!image || !fallback || eid <= 0) return;
        image.onload = () => { image.style.display = 'block'; fallback.style.display = 'none'; };
        image.onerror = () => { image.removeAttribute('src'); image.style.display = 'none'; fallback.style.display = 'flex'; };
        image.src = `assets/equips/${eid}.png`;
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
                const commonDiff = typeof Menu?.compareEquipmentByRank === 'function'
                    ? Menu.compareEquipmentByRank(a, b)
                    : (Number(b.rank || 0) - Number(a.rank || 0));
                return commonDiff !== 0 ? commonDiff : (Number(b.plus || 0) - Number(a.plus || 0));
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
            if (item.locked) MenuInventory.selectedIds = MenuInventory.selectedIds.filter(value => String(value) !== String(id));
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
        MenuInventory.ensureCardStyle();
        list.classList.add('inventory-equip-card-list');

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
            const key = String(item.id);
            const owner = ownerMap.get(key);
            const selected = selectedSet.has(key);
            const synergies = MenuInventory.getCardSynergies(item);
            const shell = document.createElement('div');
            shell.className = `inventory-equip-card-shell${selected ? ' is-selected' : ''}${synergies.length ? ' is-synergy' : ''}`;
            shell.dataset.equipId = key;
            shell.innerHTML = MenuInventory.getCardHTML(item, owner, selected);

            const footer = shell.querySelector('.inventory-equip-footer');
            footer?.addEventListener('click', event => event.stopPropagation());

            const checkbox = shell.querySelector('input[type="checkbox"]');
            checkbox?.addEventListener('click', event => event.stopPropagation());
            checkbox?.addEventListener('change', () => {
                if (!item.locked && !owner) MenuInventory.toggleSelect(item.id);
            });

            const lockButton = shell.querySelector('.inventory-equip-lock');
            lockButton?.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                MenuInventory.toggleLock(item.id);
            });

            shell.addEventListener('click', () => {
                if (item.locked || owner) return;
                MenuInventory.toggleSelect(item.id);
            });
            MenuInventory.hydrateCardImage(shell);
            list.appendChild(shell);
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
            if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('ui_shop_sell');
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
                if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('ui_shop_sell');
                Menu.msg(`${targets.length.toLocaleString()} 個の装備を売却し、${totalGold.toLocaleString()}G を獲得しました。`);
            }
        );
    }
};

if (typeof window !== 'undefined') window.MenuInventory = MenuInventory;
