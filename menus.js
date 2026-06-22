/* menus.js (common menu core)
 * Menu-specific implementations live in menus_*.js.
 * Keep shared helpers and cross-menu routing here.
 */

/* --- AdMob 広告管理（修正版） --- */
const AdManager = {
    ids: {
        banner: (navigator.userAgent.includes('Android')) 
            ? 'ca-app-pub-3940256099942544/6300978111' 
            : 'ca-app-pub-3940256099942544/2934735716',
        reward: (navigator.userAgent.includes('Android')) 
            ? 'ca-app-pub-3940256099942544/5224354917' 
            : 'ca-app-pub-3940256099942544/1712485313'
    },

    showBanner: () => {
        const adContainer = document.getElementById('ad-ui-container');
        if (adContainer) adContainer.style.display = 'flex';

        if (typeof admob !== 'undefined') {
            admob.banner.show({
                id: AdManager.ids.banner,
                position: 'bottom-center', 
            });
        } else {
            AdManager.showBrowserInlineDummy();
        }
    },

    hideBanner: () => {
        const adContainer = document.getElementById('ad-ui-container');
        if (adContainer) adContainer.style.display = 'none';
        if (typeof admob !== 'undefined') admob.banner.hide();
    },

    /* menus.js 内の該当箇所を書き換え */
	showBrowserInlineDummy: () => {
		const adContainer = document.getElementById('ad-ui-container');
		if (!adContainer) return;

		// 内容を書き込み（2行表示用にスタイルを調整）
		adContainer.innerHTML = `
			<div style="
				font-size: 9px; 
				color: #ffd700; 
				text-align: center; 
				width: 320px; 
				min-height: 50px; 
				display: flex; 
				flex-direction: column; 
				justify-content: center; 
				align-items: center; 
				line-height: 1.4; 
				box-sizing: border-box;
			">
				【 SAMPLE AD AREA 】<br>
				©Yuzora-Games CONTACT:@yuu_mintia
			</div>
		`;
	},

    prepareRewardAd: async (onSuccess) => {
        if (typeof admob === 'undefined') {
            Menu.confirm("（広告再生のテスト）動画を最後まで視聴したことにしますか？", onSuccess);
            return;
        }

        try {
            await admob.rewarded.load({ id: AdManager.ids.reward });
            // ★重要：これがないと広告が表示されません！
            await admob.rewarded.show(); 

            // 報酬獲得イベント（一度だけ実行されるように登録）
            document.addEventListener('admob.rewarded.reward', () => {
                onSuccess();
            }, { once: true });
        } catch (e) {
            Menu.msg("広告の読み込みに失敗しました。");
        }
    }
};

const Menu = {
    // ネイティブ<select>のタップを親要素のクリック処理に奪われないようにする共通処理
    stopEventBubble: (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        return true;
    },

    makeSelectTouchSafe: (root) => {
        if (!root) return;
        const selects = root.querySelectorAll ? root.querySelectorAll('select') : [];
        selects.forEach(sel => {
            sel.style.touchAction = 'auto';
            sel.style.userSelect = 'auto';
            sel.style.webkitUserSelect = 'auto';
            sel.style.pointerEvents = 'auto';
            if (sel.__menuSelectTouchSafe) return;
            ['touchstart', 'pointerdown', 'mousedown', 'click'].forEach(type => {
                sel.addEventListener(type, ev => ev.stopPropagation(), { passive: true });
            });
            sel.__menuSelectTouchSafe = true;
        });
    },

    selectTouchAttrs: () => 'ontouchstart="Menu.stopEventBubble(event)" onpointerdown="Menu.stopEventBubble(event)" onmousedown="Menu.stopEventBubble(event)" onclick="Menu.stopEventBubble(event)"',

    keyboardItemSelector: '.list-item',
    backGuardActive: false,

    refreshKeyboardNavigation: (root = document) => {
        if (!root || !root.querySelectorAll) return;
        const items = [];
        if (root.matches && root.matches(Menu.keyboardItemSelector)) items.push(root);
        root.querySelectorAll(Menu.keyboardItemSelector).forEach(el => items.push(el));
        items.forEach(el => {
            const clickable = typeof el.onclick === 'function' || el.hasAttribute('onclick') || el.dataset.keyboardSelectable === 'true';
            if (!clickable) return;
            if (el.dataset.keyboardDisabled === 'true' || el.getAttribute('aria-disabled') === 'true') return;
            if (el.tabIndex < 0) el.tabIndex = 0;
            if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        });
    },

    getKeyboardScope: (el) => {
        return el?.closest?.('.scroll-area, .menu-grid, #menu-dialog-buttons, .flex-col-container') || document;
    },

    getKeyboardItems: (scope) => {
        const root = scope || document;
        return Array.from(root.querySelectorAll(Menu.keyboardItemSelector))
            .filter(el =>
                el.tabIndex >= 0 &&
                (typeof el.onclick === 'function' || el.hasAttribute('onclick') || el.dataset.keyboardSelectable === 'true') &&
                !el.disabled &&
                el.dataset.keyboardDisabled !== 'true' &&
                el.getAttribute('aria-disabled') !== 'true' &&
                el.getClientRects().length > 0
            );
    },

    focusKeyboardItem: (current, delta) => {
        const scope = Menu.getKeyboardScope(current);
        const items = Menu.getKeyboardItems(scope);
        if (!items.length) return false;
        const index = Math.max(0, items.indexOf(current));
        const next = items[(index + delta + items.length) % items.length];
        if (!next) return false;
        next.focus({ preventScroll: true });
        next.scrollIntoView({ block: 'nearest' });
        return true;
    },

    handleKeyboardNavigation: (e) => {
        const item = e.target?.closest?.(Menu.keyboardItemSelector);
        if (!item) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            item.click();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            Menu.focusKeyboardItem(item, 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            Menu.focusKeyboardItem(item, -1);
        } else if (e.key === 'Home' || e.key === 'End') {
            const items = Menu.getKeyboardItems(Menu.getKeyboardScope(item));
            const next = e.key === 'Home' ? items[0] : items[items.length - 1];
            if (next) {
                e.preventDefault();
                next.focus({ preventScroll: true });
                next.scrollIntoView({ block: 'nearest' });
            }
        }
    },

    installKeyboardNavigation: () => {
        if (Menu.keyboardNavigationInstalled) return;
        document.addEventListener('keydown', Menu.handleKeyboardNavigation, true);
        const observer = new MutationObserver(mutations => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType === 1) Menu.refreshKeyboardNavigation(node);
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        Menu.keyboardNavigationInstalled = true;
        Menu.keyboardObserver = observer;
        Menu.refreshKeyboardNavigation(document);
    },

    ensureBackGuard: () => {
        if (!window.history || Menu.backGuardActive) return;
        try {
            history.pushState({ qoeMenuBackGuard: true }, '', location.href);
            Menu.backGuardActive = true;
        } catch (e) {}
    },

    isShown: (el) => !!el && window.getComputedStyle(el).display !== 'none',

    clickFirstVisible: (selectors) => {
        for (const selector of selectors) {
            const nodes = Array.from(document.querySelectorAll(selector));
            const node = nodes.find(el => Menu.isShown(el) && el.getClientRects().length > 0 && !el.disabled);
            if (node) {
                node.click();
                return true;
            }
        }
        return false;
    },

    handleBackAction: () => {
        const dialog = document.getElementById('menu-dialog-area');
        if (Menu.isShown(dialog)) {
            Menu.closeDialog();
            return true;
        }

        if (Menu.clickFirstVisible([
            '#ally-equip-modal button[onclick*="closeEquipModal"]',
            '#party-equipment-modal button[onclick*="closeEquipmentModal"]',
            '#party-strategy-modal button[onclick*="closeStrategyModal"]',
            '#alloc-modal button[onclick*="closeAllocModal"]',
            '#allies-tree-view .sub-screen-back-btn',
            '#field-map-modal button[onclick*="closeMapModal"]'
        ])) return true;

        const visibleSubs = Array.from(document.querySelectorAll('.sub-screen'))
            .filter(el => Menu.isShown(el) && el.getClientRects().length > 0);
        if (visibleSubs.length) {
            const top = visibleSubs[visibleSubs.length - 1];
            const back = top.querySelector('.sub-screen-bottom-panel .sub-screen-back-btn, .header-bar .btn');
            if (back && !back.disabled) {
                back.click();
                return true;
            }
        }

        const overlay = document.getElementById('menu-overlay');
        if (Menu.isShown(overlay)) {
            Menu.closeMainMenu();
            return true;
        }

        return false;
    },

    installBackGuard: () => {
        if (Menu.backGuardInstalled) return;
        window.addEventListener('popstate', () => {
            Menu.backGuardActive = false;
            if (Menu.handleBackAction()) {
                setTimeout(() => {
                    if (Menu.isMenuOpen()) Menu.ensureBackGuard();
                }, 0);
            }
        });
        Menu.backGuardInstalled = true;
    },

    getCharacterCardHTML: (c, options = {}) => {
        if (!c) return '';
        const stats = App.calcStats(c);
        const curHp = c.currentHp !== undefined ? c.currentHp : stats.maxHp;
        const curMp = c.currentMp !== undefined ? c.currentMp : stats.maxMp;
        const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(c) : c.img;
        const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(c) : '';
        const imgHtml = imgUrl
            ? `<img src="${imgUrl}"${imageFallbackAttr} class="menu-select-card-img">`
            : `<div class="menu-select-card-img menu-select-card-img-empty">IMG</div>`;
        const lbText = Number(c.limitBreak || 0) > 0 ? `<span class="menu-select-card-lb">+${c.limitBreak}</span>` : '';
        const jobText = options.showJob === false ? '' : `<span class="menu-select-card-job">${Menu.escapeHtml(c.job || '')}</span>`;
        const badge = options.badge ? `<span class="menu-select-card-badge">${Menu.escapeHtml(options.badge)}</span>` : '';
        const trailing = options.trailing || '<span class="menu-select-card-arrow">›</span>';

        return `
            <div class="menu-select-card">
                <div class="menu-select-card-face">${imgHtml}</div>
                <div class="menu-select-card-main">
                    <div class="menu-select-card-name-row">
                        <span class="menu-select-card-name">${Menu.escapeHtml(c.name || '')}</span>
                        ${lbText}
                        ${badge}
                    </div>
                    <div class="menu-select-card-level">Lv.${c.level || 1}${jobText}</div>
                    <div class="menu-select-card-vitals">
                        <span>HP:<b class="hp">${curHp}/${stats.maxHp}</b></span>
                        <span>MP:<b class="mp">${curMp}/${stats.maxMp}</b></span>
                    </div>
                    <div class="menu-select-card-stats">
                        <span>攻:${stats.atk}</span>
                        <span>魔:${stats.mag}</span>
                        <span>速:${stats.spd}</span>
                        <span>防:${stats.def}</span>
                        <span>魔防:${stats.mdef}</span>
                    </div>
                </div>
                ${trailing}
            </div>
        `;
    },

    getMenuIconPath: (kind, value) => {
        const key = String(value || '').toLowerCase();
        return `assets/ui/menu-icons/${kind}-${key}.svg`;
    },

    getSkillIconPath: (skill) => {
        const type = String(skill?.type || '');
        let key = 'skill';
        if (type.includes('回復')) key = 'heal';
        else if (type.includes('蘇生')) key = 'revive';
        else if (type.includes('補助') || type.includes('強化')) key = 'support';
        else if (type.includes('弱体') || type.includes('妨害')) key = 'debuff';
        else if (type.includes('魔法')) key = 'magic';
        else if (type.includes('物理') || type.includes('攻撃')) key = 'attack';
        return Menu.getMenuIconPath('skill', key);
    },

    getItemIconPath: (item) => {
        const type = String(item?.type || '');
        let key = 'item';
        if (type.includes('HP') || type.includes('回復')) key = 'heal';
        else if (type.includes('MP')) key = 'mp';
        else if (type.includes('蘇生')) key = 'revive';
        else if (type.includes('移動')) key = 'travel';
        else if (type.includes('乗り物')) key = 'vehicle';
        else if (type.includes('育成')) key = 'growth';
        else if (type.includes('貴重')) key = 'key';
        return Menu.getMenuIconPath('item', key);
    },

    getIconFallbackAttr: (fallbackPath) => ` onerror="this.onerror=null;this.src='${fallbackPath}'"`,

    subScreenFeatureMap: {
        blacksmith: 'smith',
        dungeon: 'dungeonMenu',
        gacha: 'gacha'
    },

    isDungeonEscapeContext: () => {
        const mapData = (typeof Field !== 'undefined') ? Field.currentMapData : null;
        const areaKey = (typeof App !== 'undefined') ? App.data?.location?.area : null;
        const isFixedDungeonArea = !!(areaKey && typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[areaKey]);
        return !!(mapData?.isDungeon || areaKey === 'ABYSS' || isFixedDungeonArea);
    },

    featureButton: (id, label, featureKey, style = '') => {
        const isDungeonEscape = id === 'dungeon' && Menu.isDungeonEscapeContext();
        const locked = !isDungeonEscape && typeof App !== 'undefined' && typeof App.isFeatureUnlocked === 'function' && !App.isFeatureUnlocked(featureKey);
        const click = locked ? `Menu.showLockedFeature('${featureKey}')` : `Menu.openSubScreen('${id}')`;
        const lockedStyle = locked ? 'flex-direction:column;' : '';
        const finalStyle = [style, lockedStyle].filter(Boolean).join('; ');
        const styleAttr = finalStyle ? ` style="${finalStyle}"` : '';
        const className = locked ? 'menu-btn is-feature-locked' : 'menu-btn';
        const body = locked
            ? `？？？？<span style="display:block; font-size:9px; color:#444; margin-top:2px;">未開放</span>`
            : (isDungeonEscape ? 'エスケープ' : label);
        return `<button class="${className}" onclick="${click}"${styleAttr}>${body}</button>`;
    },

    showLockedFeature: (featureKey) => {
        if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function') {
            App.requireFeatureUnlocked(featureKey);
        }
    },

    // --- メインメニュー制御 ---
    openMainMenu: () => {
        Menu.installKeyboardNavigation();
        Menu.installBackGuard();
        Menu.ensureBackGuard();
        // 開く直前に実績の達成判定を最新にする
        if (typeof MenuAchievements !== 'undefined' && MenuAchievements.checkProgress) {
            MenuAchievements.checkProgress();
        }

        document.getElementById('menu-overlay').style.display = 'flex';
        Menu.renderPartyBar();
		
		// バナー表示の呼び出し
		AdManager.showBanner();

		// 広告と被らないように grid の下に余白を作るためのスタイル調整
		const grid = document.querySelector('#menu-overlay .menu-grid');

        if(grid) {
            // 通知バッジ（赤丸）の判定
            // 1. 実績: 「達成済み」かつ「未受取」のものが1つでもあるか
            const hasUnclaimedAchievement = Object.values(App.data.achievements || {}).some(a => a.completed && !a.claimed);
            
            // 2. 取引所: 本日の日付と保存されている最後受取日が一致しない（＝未受取）か
            const today = (typeof MenuExchange !== 'undefined' && MenuExchange.getTodayStr) ? MenuExchange.getTodayStr() : new Date().toLocaleDateString('sv-SE');
            const hasUnclaimedDaily = (App.data.flags?.lastGemClaimDate !== today) || (App.data.flags?.lastGoldClaimDate !== today);
            
            // バッジ用HTMLパーツ
            const badge = '<span style="display:inline-block; width:10px; height:10px; background:#ff4444; border-radius:50%; margin-left:5px; vertical-align:middle; box-shadow:0 0 5px #f00; border:1px solid #fff;"></span>';

            grid.innerHTML = `
                <button class="menu-btn" onclick="Menu.openSubScreen('party')">パーティ編成</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('allies')">ステータス</button>

                <button class="menu-btn" onclick="Menu.openSubScreen('inventory')">所持装備</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('items')">所持道具</button>

                <button class="menu-btn" onclick="Menu.openSubScreen('exchange')">お知らせ${hasUnclaimedDaily ? badge : ''}</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('skills')">スキル</button>

                <button class="menu-btn" onclick="Menu.openSubScreen('achievements')">実績${hasUnclaimedAchievement ? badge : ''}</button>
                ${Menu.featureButton('blacksmith', '鍛冶屋', 'smith')}

                <button class="menu-btn" onclick="Menu.openSubScreen('status')">戦歴</button>
                ${Menu.featureButton('dungeon', 'ダンジョン', 'dungeonMenu', 'background:#400040;')}

                <button class="menu-btn" onclick="Menu.openSubScreen('book')">魔物図鑑</button>
                <button class="menu-btn" style="background:#004444;" onclick="Menu.openSubScreen('config')">設定</button>
                
                <button class="menu-btn" style="background:#500;" onclick="App.returnToTitle()">タイトルへ</button>
                <button class="menu-btn" style="background:#333;" onclick="Menu.closeMainMenu()">閉じる</button>
            `;
            Menu.refreshKeyboardNavigation(grid);
        }
    },
    
    //ガチャメニューは、のちに「設定」メニューに変更し、データ出力や読込もそちらに格納を予定。ガチャページは残すが、ガチャメニューボタンは削除。
    //戦歴メニューには、チュートリアル閲覧タブを新設予定。
    
    closeMainMenu: () => {
        document.getElementById('menu-overlay').style.display = 'none';
        Menu.backGuardActive = false;
		// hideBanner に統一（ダミーの処理も含まれるため）
		AdManager.hideBanner();
    },
    
    isMenuOpen: () => {
	  const mo = document.getElementById('menu-overlay');
	  if (mo && window.getComputedStyle(mo).display !== 'none') return true;

	  const subs = document.querySelectorAll('.sub-screen');
	  for (let i = 0; i < subs.length; i++) {
		if (window.getComputedStyle(subs[i]).display !== 'none') return true;
	  }
	  return false;
	},

    closeAll: () => {
        document.getElementById('menu-overlay').style.display = 'none';
        document.querySelectorAll('.sub-screen').forEach(e => e.style.display = 'none');
        const assignModal = document.getElementById('assign-modal');
        if(assignModal) assignModal.style.display = 'none';
        Menu.closeDialog();
        Menu.backGuardActive = false;
	},

    escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch])),

    renderMainMenuPartyPanel: (bar) => {
        bar.classList.add('menu-party-compact');
        App.data.party.forEach(uid => {
            const div = document.createElement('div');
            div.className = 'menu-party-member';

            if (!uid) {
                div.innerHTML = '<div style="margin:auto; color:#555;">-</div>';
                bar.appendChild(div);
                return;
            }

            const p = App.getChar(uid);
            if (!p) {
                div.innerHTML = '<div style="margin:auto; color:#555;">-</div>';
                bar.appendChild(div);
                return;
            }

            const stats = App.calcStats(p);
            const curHp = p.currentHp !== undefined ? p.currentHp : stats.maxHp;
            const curMp = p.currentMp !== undefined ? p.currentMp : stats.maxMp;
            const hpRate = Math.max(0, Math.min(100, (curHp / Math.max(1, stats.maxHp)) * 100));
            const mpRate = Math.max(0, Math.min(100, (curMp / Math.max(1, stats.maxMp)) * 100));
            const lbText = p.limitBreak > 0 ? `<span class="menu-party-lb">+${p.limitBreak}</span>` : '';
            const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(p) : p.img;
            const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(p) : '';
            const imgHtml = imgUrl
                ? `<img src="${imgUrl}"${imageFallbackAttr} class="menu-party-img">`
                : `<div class="menu-party-img menu-party-img-empty">IMG</div>`;
            const isBack = p.formation === 'back';
            const formationClass = isBack ? 'back' : 'front';
            const formationMark = isBack ? '▼' : '▲';
            const formationLabel = isBack ? '後衛' : '前衛';

            div.innerHTML = `
                <div class="menu-party-head">
                    <div class="menu-party-name">${Menu.escapeHtml(p.name)}${lbText}</div>
                    <div class="menu-party-level">Lv ${p.level || 1}</div>
                    <div class="menu-party-position ${formationClass}" title="${formationLabel}">${formationMark}</div>
                </div>
                <div class="menu-party-body">
                    <div class="menu-party-face">${imgHtml}</div>
                    <div class="menu-party-main">
                        <div class="menu-party-stat"><span class="hp-label">HP</span><span>${curHp}/${stats.maxHp}</span></div>
                        <div class="menu-party-barline"><div class="menu-party-hp" style="width:${hpRate}%"></div></div>
                        <div class="menu-party-stat"><span class="mp-label">MP</span><span>${curMp}/${stats.maxMp}</span></div>
                        <div class="menu-party-barline"><div class="menu-party-mp" style="width:${mpRate}%"></div></div>
                    </div>
                </div>
            `;
            bar.appendChild(div);
        });
    },

    renderPartyBar: () => {
        const bars = document.querySelectorAll('.party-bar'); 
        bars.forEach(bar => {
            bar.innerHTML = '';
            if (bar.id === 'menu-party-bar') {
                Menu.renderMainMenuPartyPanel(bar);
                return;
            }
            bar.classList.remove('menu-party-compact');
            App.data.party.forEach(uid => {
                const div = document.createElement('div');
                div.className = 'p-box';
                div.style.justifyContent = 'flex-start'; 
                div.style.paddingTop = '2px';

// --- Menu.renderPartyBar 内 ---
                if(uid) {
                    const p = App.getChar(uid);
                    const stats = App.calcStats(p);
                    const curHp = p.currentHp!==undefined ? p.currentHp : stats.maxHp;
                    const curMp = p.currentMp!==undefined ? p.currentMp : stats.maxMp;
                    const lbText = p.limitBreak > 0 ? `<span style="color:#ffd700; font-size:9px; margin-left:2px;">+${p.limitBreak}</span>` : '';

                    const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(p) : p.img;
                    const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(p) : '';

                    const imgHtml = imgUrl 
                        ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #666; margin-bottom:2px;">`
                        : `<div style="width:32px; height:32px; background:#333; border-radius:4px; border:1px solid #666; display:flex; align-items:center; justify-content:center; color:#555; font-size:8px; margin-bottom:2px;">IMG</div>`;

                    div.innerHTML = `
                        <div style="flex:1; display:flex; flex-direction:column; align-items:center; width:100%; overflow:hidden;">
                            ${imgHtml}
                            <div style="display:flex; align-items:center; width:100%; justify-content:center;">
                                <div style="font-weight:bold; color:#fff; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90%;">
                                    ${p.name}
                                </div>
                                ${lbText}
                            </div>
                            <div style="font-size:6px; color:#aaa; margin-bottom:2px;">${p.job} Lv.${p.level}</div>
                        </div>
                        <div style="width:100%;">
                            <div class="bar-container"><div class="bar-hp" style="width:${Math.min(100, (curHp/stats.maxHp)*100)}%"></div></div>
                            <div class="p-val">${curHp}/${stats.maxHp}</div>
                            <div class="bar-container"><div class="bar-mp" style="width:${Math.min(100, (curMp/stats.maxMp)*100)}%"></div></div>
                            <div class="p-val">${curMp}/${stats.maxMp}</div>
                        </div>
                    `;
                } else {
                    div.innerHTML = '<div style="margin:auto; color:#555;">-</div>';
                }
                bar.appendChild(div);
            });
        });
    },

    openSubScreen: (id) => {
        Menu.installKeyboardNavigation();
        Menu.installBackGuard();
        Menu.ensureBackGuard();
        const requiredFeature = Menu.subScreenFeatureMap[id];
        const bypassFeatureLock = id === 'dungeon' && Menu.isDungeonEscapeContext();
        if (!bypassFeatureLock && requiredFeature && typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked(requiredFeature)) {
            return;
        }

        document.getElementById('menu-overlay').style.display = 'none';
        document.querySelectorAll('.sub-screen').forEach(e => e.style.display = 'none');
        
        if (id === 'status' && !document.getElementById('sub-screen-status')) {
            MenuStatus.createDOM();
        }
        if (id === 'config' && typeof MenuConfig !== 'undefined' && !document.getElementById('sub-screen-config')) {
            MenuConfig.createDOM();
        }

        const target = document.getElementById('sub-screen-' + id);
        if(target) target.style.display = 'flex';
        
        if(id === 'party') MenuParty.init();
        if(id === 'items') MenuItems.init();
        if(id === 'inventory') MenuInventory.init();
        if(id === 'allies') MenuAllies.init();
        if(id === 'skills') MenuSkills.init();
        if(id === 'book') MenuBook.init();
        if(id === 'blacksmith') MenuBlacksmith.init();
        if(id === 'status') MenuStatus.init();
        if(id === 'config' && typeof MenuConfig !== 'undefined') MenuConfig.init();
			if(id === 'exchange') MenuExchange.init();
		if(id === 'achievements') MenuAchievements.init();
        if(id === 'gacha' && typeof Gacha !== 'undefined') Gacha.init();
		if(id === 'dungeon' && typeof Dungeon !== 'undefined') Dungeon.initMenu();
        const targetRoot = document.getElementById('sub-screen-' + id);
        if (targetRoot) Menu.refreshKeyboardNavigation(targetRoot);
    },

    closeSubScreen: (id) => {
        document.getElementById('sub-screen-' + id).style.display = 'none';
        // 単に表示するのではなく、バッジ判定を含む openMainMenu を呼び出してもどる
        Menu.openMainMenu();
    },

    getDialogEl: (id) => document.getElementById(id),
	
    getRarityColor: (rarity) => {
        if(rarity==='N') return '#a0a0a0';
        if(rarity==='R') return '#40e040';
        if(rarity==='SR') return '#40e0e0';
        if(rarity==='SSR') return '#ff4444';
        if(rarity==='UR') return '#e040e0';
        if(rarity==='EX') return '#ffff00';
        return '#fff';
    },

	getEquipDetailHTML: (equip, showName = true) => {
        let html = '';
        const rarity = equip.rarity || 'N';
        const rarityColor = Menu.getRarityColor(rarity);
        
        // ★ヘルパー関数: 負数時の +- 重複を防止しつつ符号を付与
        const fV = (v) => (v >= 0 ? `+${v}` : `${v}`);
        
        let baseStats = [];
        if (equip.data) {
            // 基礎ステータス (hp, mp, mdef, hit, cri, eva を追加)
            if (equip.data.atk)  baseStats.push(`攻${fV(equip.data.atk)}`);
            if (equip.data.def)  baseStats.push(`防${fV(equip.data.def)}`);
            if (equip.data.mag)  baseStats.push(`魔${fV(equip.data.mag)}`);
            if (equip.data.mdef) baseStats.push(`魔防${fV(equip.data.mdef)}`);
            if (equip.data.spd)  baseStats.push(`速${fV(equip.data.spd)}`);
            if (equip.data.hp)   baseStats.push(`HP${fV(equip.data.hp)}`);
            if (equip.data.mp)   baseStats.push(`MP${fV(equip.data.mp)}`);

            // 特殊ステータス
            if (equip.data.hit)    baseStats.push(`命中${fV(equip.data.hit)}%`);
            if (equip.data.cri)    baseStats.push(`会心${fV(equip.data.cri)}%`);
            if (equip.data.eva)    baseStats.push(`回避${fV(equip.data.eva)}%`);
            if (equip.data.finDmg) baseStats.push(`与ダメ${fV(equip.data.finDmg)}%`);
            if (equip.data.finRed) baseStats.push(`被ダメ${fV(-equip.data.finRed)}%`); // 軽減はマイナスで表現

            // 耐性・状態異常付与 (Battle.statNames がある前提)
            for (let key in equip.data) {
                if (key.startsWith('resists_')) {
                    const label = (typeof Battle !== 'undefined' && Battle.statNames) ? (Battle.statNames[key.replace('resists_', '')] || key) : key;
                    baseStats.push(`${label}耐${fV(equip.data[key])}%`);
                } else if (key.startsWith('attack_')) {
                    const label = (typeof Battle !== 'undefined' && Battle.statNames) ? (Battle.statNames[key.replace('attack_', '')] || key) : key;
                    baseStats.push(`攻撃時${equip.data[key]}%で${label}`);
                }
            }
            
            // 属性補正
            if(typeof CONST !== 'undefined' && CONST.ELEMENTS) {
                CONST.ELEMENTS.forEach(elm => {
                    if (equip.data.elmAtk && equip.data.elmAtk[elm]) baseStats.push(`${elm}攻${fV(equip.data.elmAtk[elm])}%`);
                    if (equip.data.elmRes && equip.data.elmRes[elm]) baseStats.push(`${elm}耐${fV(equip.data.elmRes[elm])}%`);
                });
            }
        }

        // ★習得スキル (grantSkills) の表示ロジック [] 形式の span にする (改行防止)
        let skillHTML = '';
        const gSkills = equip.grantSkills || (equip.data && equip.data.grantSkills);
        if (gSkills && Array.isArray(gSkills) && gSkills.length > 0) {
            const skillNames = gSkills.map(sid => {
                const sk = (typeof DB !== 'undefined' && DB.SKILLS) ? DB.SKILLS.find(s => s.id === sid) : null;
                return sk ? sk.name : `不明(${sid})`;
            });
            skillHTML = ` <span style="color:#ffff00;">[習得:${skillNames.join(', ')}]</span>`;
        }
        const baseEffect = baseStats.length > 0 ? baseStats.join(' ') : 'なし';
		
		// ★ベース名（杖、剣など）の表示用文字列を作成
        const baseNameHTML = equip.baseName ? `[${equip.baseName}] ` : '';

        // オプション表示 (ここも fV で符号修正)
        let optsHTML = '';
        if (equip.opts && equip.opts.length > 0) {
            const optsList = equip.opts.map(o => {
                const optRarity = o.rarity || 'N';
                const optColor = Menu.getRarityColor(optRarity);
                const unit = o.unit === 'val' ? '' : o.unit;
                return `<span style="color:${optColor};">${o.label}${fV(o.val)}${unit} [${optRarity}]</span>`;
            }).join(' ');
            optsHTML = `<div style="font-size:10px; color:#aaa; margin-top:2px;">${optsList}</div>`;
        }

        // シナジー表示 (既存維持)
        let synergyHTML = '';
        if (typeof App !== 'undefined' && typeof App.checkSynergy === 'function') {
             const syns = App.checkSynergy(equip);
             if(syns && syns.length > 0) {
                 synergyHTML = syns.map(syn => `
                    <div style="margin-top:4px; padding:2px 4px; background:rgba(255,255,255,0.1); border-radius:2px;">
                        <div style="font-size:11px; font-weight:bold; color:${syn.color||'#f88'};">${syn.name}</div>
                        <div style="font-size:10px; color:#ddd;">${syn.desc}</div>
                    </div>`).join('');
             }
        }

        if (showName) {
            html += `
                <div style="font-size:12px; font-weight:bold; color:${rarityColor}; margin-bottom:2px;">
                    ${equip.name} 
                </div>`;
        }

        html += `
            <div style="font-size:10px; color:#ccc;">
                ${baseNameHTML}${baseEffect}${skillHTML}
            </div>
            ${optsHTML}
            ${synergyHTML}
        `;
        return html;
    },
	
    msg: (text, callback) => {
        Menu.installBackGuard();
        Menu.ensureBackGuard();
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');
        
        if (!area) {
            if (typeof App !== 'undefined' && typeof App.log === 'function') {
                App.log(String(text).replace(/\n/g, '<br>'));
            }
            if (callback) callback();
            return;
        }
        
        textEl.innerHTML = text.replace(/\n/g, '<br>');
        btnEl.innerHTML = '';
        const okBtn = document.createElement('button');
        okBtn.className = 'btn';
        okBtn.style.width = '80px';
        okBtn.innerText = 'OK';
        okBtn.onclick = () => { Menu.closeDialog(); if (callback) callback(); };
        btnEl.appendChild(okBtn);
        area.style.display = 'flex';
    },

    confirm: (text, yesCallback, noCallback) => {
  Menu.installBackGuard();
  Menu.ensureBackGuard();
  const area  = Menu.getDialogEl('menu-dialog-area');

  // 暫定の処置で、既存のダイアログDOMを必ず body 直下へ移動（スタッキングコンテキストを回避）
  //if (area && area.parentElement !== document.body) {
  //  document.body.appendChild(area);
  //}
  const textEl = Menu.getDialogEl('menu-dialog-text');
  const btnEl  = Menu.getDialogEl('menu-dialog-buttons');

  // ★復旧ポイント：無いなら何もしない、ではなくフォールバック
  if (!area || !textEl || !btnEl) {
    if (typeof App !== 'undefined' && typeof App.log === 'function') {
      App.log(String(text).replace(/\n/g, '<br>'));
    }
    if (noCallback) noCallback();
    return;
  }

  // listChoice の影響が残っても崩れないように念のため戻す（副作用の除去）
  btnEl.style.flexDirection = 'row';
  btnEl.style.gap = '10px';

  textEl.innerHTML = String(text).replace(/\n/g, '<br>');
  btnEl.innerHTML = '';

  const yesBtn = document.createElement('button');
  yesBtn.className = 'btn';
  yesBtn.style.width = '80px';
  yesBtn.innerText = 'はい';
  yesBtn.onclick = () => { Menu.closeDialog(); if (yesCallback) yesCallback(); };

  const noBtn = document.createElement('button');
  noBtn.className = 'btn';
  noBtn.style.width = '80px';
  noBtn.style.background = '#555';
  noBtn.innerText = 'いいえ';
  noBtn.onclick = () => { Menu.closeDialog(); if (noCallback) noCallback(); };

  btnEl.appendChild(yesBtn);
  btnEl.appendChild(noBtn);
  area.style.position = 'fixed';
  area.style.zIndex = '1000000';
  area.style.inset = '0';      // top/left/right/bottom を一括で 0 に
  area.style.display = 'flex';
},

	
	choice: (text, label1, callback1, label2, callback2) => {
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');
        
        // ダイアログ要素がない場合の安全策
        if (!area) { 
            if (typeof App !== 'undefined' && typeof App.log === 'function') {
                App.log(String(text).replace(/\n/g, '<br>'));
            }
            if(callback2) callback2();
            return; 
        }

        textEl.innerHTML = text.replace(/\n/g, '<br>');
        btnEl.innerHTML = '';
        
        // ボタン1 (例: 1階から)
        const btn1 = document.createElement('button');
        btn1.className = 'btn';
        btn1.style.minWidth = '100px';
        btn1.style.padding = '0 10px';
        btn1.innerText = label1;
        btn1.onclick = () => { Menu.closeDialog(); if (callback1) callback1(); };
        
        // ボタン2 (例: xx階から)
        const btn2 = document.createElement('button');
        btn2.className = 'btn';
        btn2.style.minWidth = '100px';
        btn2.style.padding = '0 10px';
        btn2.style.background = '#555';
        btn2.innerText = label2;
        btn2.onclick = () => { Menu.closeDialog(); if (callback2) callback2(); };
        
        // キャンセル用（選択せずに閉じる）
        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn';
        btnCancel.style.marginLeft = '10px';
        btnCancel.style.background = '#333';
        btnCancel.innerText = 'やめる';
        btnCancel.onclick = () => { Menu.closeDialog(); };

        btnEl.appendChild(btn1);
        btnEl.appendChild(btn2);
        btnEl.appendChild(btnCancel); // やめるボタンもあると親切です
        
        area.style.display = 'flex';
    },
	
	// 複数の選択肢をリスト表示するダイアログ
    listChoice: (text, choices) => {
        Menu.installBackGuard();
        Menu.ensureBackGuard();
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');
        
        if (!area) return;

        textEl.innerHTML = text.replace(/\n/g, '<br>');
        // 縦並びに変更
        btnEl.style.flexDirection = 'column'; 
        btnEl.style.gap = '8px';
        btnEl.style.width = '100%';

        const pageSize = 6;
        const totalPages = Math.max(1, Math.ceil(choices.length / pageSize));
        let page = 0;

        const resetDialogButtons = () => {
            btnEl.style.flexDirection = 'row';
            btnEl.style.gap = '10px';
            btnEl.style.width = '';
        };

        const makeButton = (label, onClick, options = {}) => {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.style.width = options.width || '100%';
            btn.style.padding = options.padding || '10px';
            if (options.background) btn.style.background = options.background;
            if (options.disabled) {
                btn.disabled = true;
                btn.style.opacity = '0.45';
            }
            btn.innerText = label;
            btn.onclick = onClick;
            return btn;
        };

        const renderPage = () => {
            btnEl.innerHTML = '';
            const start = page * pageSize;

            choices.slice(start, start + pageSize).forEach(c => {
                btnEl.appendChild(makeButton(c.label, () => { 
                    resetDialogButtons();
                    Menu.closeDialog(); 
                    if (c.callback) c.callback(); 
                }, {
                    disabled: !!c.disabled,
                    background: c.background,
                    width: c.width,
                    padding: c.padding
                }));
            });

            if (totalPages > 1) {
                const nav = document.createElement('div');
                nav.style.display = 'grid';
                nav.style.gridTemplateColumns = '48px 1fr 48px';
                nav.style.gap = '8px';
                nav.style.alignItems = 'center';
                nav.style.width = '100%';

                nav.appendChild(makeButton('◀', () => {
                    page = Math.max(0, page - 1);
                    renderPage();
                }, { width: '48px', padding: '8px', disabled: page === 0 }));

                const indicator = document.createElement('div');
                indicator.style.fontSize = '12px';
                indicator.style.color = '#ccc';
                indicator.style.textAlign = 'center';
                indicator.innerText = `${page + 1}/${totalPages}`;
                nav.appendChild(indicator);

                nav.appendChild(makeButton('▶', () => {
                    page = Math.min(totalPages - 1, page + 1);
                    renderPage();
                }, { width: '48px', padding: '8px', disabled: page >= totalPages - 1 }));

                btnEl.appendChild(nav);
            }

            btnEl.appendChild(makeButton('やめる', () => { 
                resetDialogButtons();
                Menu.closeDialog(); 
            }, { background: '#444' }));
        };

        renderPage();
        
        area.style.display = 'flex';
    },
	
    closeDialog: () => {
        const area = document.getElementById('menu-dialog-area');
        if (area) area.style.display = 'none';
    }
};

if (typeof window !== 'undefined') {
    window.AdManager = AdManager;
    window.Menu = Menu;
    const installMenuInputHandlers = () => {
        if (window.Menu) {
            Menu.installKeyboardNavigation();
            Menu.installBackGuard();
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installMenuInputHandlers, { once: true });
    } else {
        installMenuInputHandlers();
    }
}
