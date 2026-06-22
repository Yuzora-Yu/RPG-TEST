/* MenuParty extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   1. 仲間編成 (隊列切り替え・オーラ反映版)
   ========================================================================== */
const MenuParty = {
    targetSlot: 0,
    currentTab: 'members',
	init: () => { 
		MenuParty.ensureWindow();
		MenuParty.ensureBottomPanel();
		MenuParty.ensureTabs();
		MenuParty.ensureStrategyPanel();
		MenuParty.ensureEquipmentPanel();

		MenuParty.setBottomButton('もどる', () => Menu.closeSubScreen('party'));
		MenuParty.switchTab('members');
	},

	getRoot: () => document.getElementById('party-screen-window') || document.getElementById('sub-screen-party'),

	getModalHost: () => {
		const host = MenuParty.getRoot();
		if (!host) return document.body;
		const position = window.getComputedStyle ? window.getComputedStyle(host).position : host.style.position;
		if (!position || position === 'static') host.style.position = 'relative';
		return host;
	},

	getFrameModalStyle: (zIndex, paddingPx) => {
		const host = MenuParty.getModalHost();
		const position = host === document.body ? 'fixed' : 'absolute';
		return {
			host,
			style: `position:${position}; inset:0; z-index:${zIndex}; background:rgba(0,0,0,0.72); display:flex; align-items:center; justify-content:center; padding:${paddingPx}px; box-sizing:border-box;`
		};
	},

	ensureWindow: () => {
		const screen = document.getElementById('sub-screen-party');
		if (!screen || document.getElementById('party-screen-window')) return;

		const windowEl = document.createElement('div');
		windowEl.id = 'party-screen-window';
		windowEl.className = 'sub-screen-window';
		while (screen.firstChild) {
			windowEl.appendChild(screen.firstChild);
		}
		screen.appendChild(windowEl);
	},
	
	ensureBottomPanel: () => {
		const screen = document.getElementById('sub-screen-party');
		if (!screen) return;
		const root = MenuParty.getRoot();

		let panel = document.getElementById('party-bottom-panel');
		if (panel) return;

		panel = document.createElement('div');
		panel.id = 'party-bottom-panel';
		panel.className = 'sub-screen-bottom-panel';
		panel.innerHTML = `
			<button id="party-bottom-back-btn" class="btn sub-screen-back-btn">もどる</button>
		`;

		root.appendChild(panel);
	},

	setBottomButton: (label, handler) => {
		const btn = document.getElementById('party-bottom-back-btn');
		if (!btn) return;

		btn.innerText = label;
		btn.onclick = handler;
	},

	escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	}[ch])),

	ensureTabs: () => {
		const screen = document.getElementById('sub-screen-party');
		const slots = document.getElementById('party-screen-slots');
		if (!screen || !slots) return;
		const existingTabs = document.getElementById('party-screen-tabs');
		if (existingTabs) {
			if (!document.getElementById('party-tab-equipment')) {
				existingTabs.insertAdjacentHTML('beforeend', `<button id="party-tab-equipment" onclick="MenuParty.switchTab('equipment')">そうび</button>`);
			}
			return;
		}
		const root = slots.parentNode || MenuParty.getRoot();
		const tabs = document.createElement('div');
		tabs.id = 'party-screen-tabs';
		tabs.style.cssText = 'display:flex; background:#222; margin:8px 8px 0; border-radius:6px; overflow:hidden; border:1px solid #444; flex-shrink:0;';
		tabs.innerHTML = `
			<button id="party-tab-members" onclick="MenuParty.switchTab('members')">仲間</button>
			<button id="party-tab-strategy" onclick="MenuParty.switchTab('strategy')">さくせん</button>
		`;
		root.insertBefore(tabs, slots);
		if (!document.getElementById('party-tab-equipment')) {
			tabs.insertAdjacentHTML('beforeend', `<button id="party-tab-equipment" onclick="MenuParty.switchTab('equipment')">そうび</button>`);
		}
	},

	applyTabButtonStyle: (button, active) => {
		if (!button) return;
		button.classList.toggle('active', !!active);
		button.classList.toggle('is-active', !!active);
		button.style.cssText = `flex:1; min-width:0; padding:10px 4px; border:none; background:${active ? '#ffd700' : '#111'}; color:${active ? '#000' : '#777'}; font-weight:bold; font-size:11px; white-space:nowrap; font-family:inherit;`;
	},

	ensureStrategyPanel: () => {
		const screen = document.getElementById('sub-screen-party');
		if (!screen || document.getElementById('party-screen-strategy')) return;
		const root = MenuParty.getRoot();
		const panel = document.createElement('div');
		panel.id = 'party-screen-strategy';
		panel.className = 'flex-col-container';
		panel.style.display = 'none';
		panel.innerHTML = `
			<div style="padding:5px; text-align:center; font-size:12px; color:#aaa;">作戦を選択</div>
			<div id="party-strategy-list" class="scroll-area"></div>
		`;
		const bottom = document.getElementById('party-bottom-panel');
		root.insertBefore(panel, bottom || null);
	},

	ensureEquipmentPanel: () => {
		const screen = document.getElementById('sub-screen-party');
		if (!screen || document.getElementById('party-screen-equipment')) return;
		const root = MenuParty.getRoot();
		const panel = document.createElement('div');
		panel.id = 'party-screen-equipment';
		panel.className = 'flex-col-container';
		panel.style.display = 'none';
		panel.innerHTML = `<div id="party-equipment-list" class="scroll-area"></div>`;
		const bottom = document.getElementById('party-bottom-panel');
		root.insertBefore(panel, bottom || null);
	},

	switchTab: (tab) => {
		MenuParty.currentTab = tab;
		const tabs = document.getElementById('party-screen-tabs');
		const slots = document.getElementById('party-screen-slots');
		const chars = document.getElementById('party-screen-chars');
		const strategy = document.getElementById('party-screen-strategy');
		const equipment = document.getElementById('party-screen-equipment');
		if (tabs) tabs.style.display = 'flex';
		if (chars) chars.style.display = 'none';
		if (slots) slots.style.display = tab === 'members' ? 'flex' : 'none';
		if (strategy) strategy.style.display = tab === 'strategy' ? 'flex' : 'none';
		if (equipment) equipment.style.display = tab === 'equipment' ? 'flex' : 'none';

		const memberTab = document.getElementById('party-tab-members');
		const strategyTab = document.getElementById('party-tab-strategy');
		const equipmentTab = document.getElementById('party-tab-equipment');
		MenuParty.applyTabButtonStyle(memberTab, tab === 'members');
		MenuParty.applyTabButtonStyle(strategyTab, tab === 'strategy');
		MenuParty.applyTabButtonStyle(equipmentTab, tab === 'equipment');

		MenuParty.setBottomButton('もどる', () => Menu.closeSubScreen('party'));
		if (tab === 'members') MenuParty.renderSlots();
		else if (tab === 'strategy') MenuParty.renderStrategies();
		else MenuParty.renderEquipmentList();
	},

	renderStrategies: () => {
		const list = document.getElementById('party-strategy-list');
		if (!list) return;
		list.innerHTML = '';
		const strategies = App.battleStrategies || {};

		for (let i = 0; i < 4; i++) {
			const uid = App.data.party[i];
			const div = document.createElement('div');
			div.className = 'list-item';
			div.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px; min-height:74px;';

			if (!uid) {
				div.innerHTML = `<div style="color:#777;">空き</div>`;
				list.appendChild(div);
				continue;
			}

			const c = App.getChar(uid);
			if (!c) continue;
			if (App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(c);
			const current = c.config?.strategy || 'balanced';
			const currentLabel = App.getBattleStrategyLabel ? App.getBattleStrategyLabel(current) : (strategies[current]?.label || current);
			const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(c) : c.img || '';
			const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(c) : '';
			div.innerHTML = `
				<div style="width:46px; height:46px; flex:0 0 auto; border:1px solid #555; border-radius:6px; overflow:hidden; background:#222; display:flex; align-items:center; justify-content:center;">
					${imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:10px; color:#555;">IMG</span>'}
				</div>
				<div style="flex:1; min-width:0;">
					<div style="display:flex; align-items:baseline; gap:6px; margin-bottom:3px;">
						<span style="font-size:13px; font-weight:bold; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${MenuParty.escapeHtml(c.name)}</span>
						<span style="font-size:10px; color:#aaa; white-space:nowrap;">${MenuParty.escapeHtml(c.job || '')}</span>
					</div>
					<div style="font-size:11px; color:#ccc; margin-bottom:4px;">Lv.${c.level || 1}</div>
					<div style="display:inline-flex; max-width:100%; padding:3px 8px; border:1px solid #68602f; border-radius:999px; background:#2a2410; color:#ffd; font-size:11px; white-space:nowrap;">${MenuParty.escapeHtml(currentLabel)}</div>
				</div>
				<div style="font-size:18px; color:#888; flex:0 0 auto;">›</div>
			`;
			div.onclick = () => MenuParty.openStrategyModal(uid);
			list.appendChild(div);
		}
	},

	openStrategyModal: (uid) => {
		const c = App.getChar(uid);
		if (!c) return;
		if (App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(c);
		MenuParty.closeStrategyModal();

		const strategies = App.battleStrategies || {};
		const current = c.config?.strategy || 'balanced';
		const currentLabel = App.getBattleStrategyLabel ? App.getBattleStrategyLabel(current) : (strategies[current]?.label || current);
		const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(c) : c.img || '';
		const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(c) : '';

		const modal = document.createElement('div');
		modal.id = 'party-strategy-modal';
		const frameModal = MenuParty.getFrameModalStyle(3000, 18);
		modal.style.cssText = frameModal.style;
		modal.onclick = () => MenuParty.closeStrategyModal();
		modal.innerHTML = `
			<div onclick="event.stopPropagation()" style="width:min(360px, 100%); max-height:100%; overflow:auto; background:#151515; border:1px solid #777; border-radius:8px; box-shadow:0 18px 48px rgba(0,0,0,0.65); box-sizing:border-box;">
				<div style="display:flex; align-items:center; gap:10px; padding:12px; border-bottom:1px solid #333;">
					<div style="width:52px; height:52px; flex:0 0 auto; border:1px solid #555; border-radius:6px; overflow:hidden; background:#222; display:flex; align-items:center; justify-content:center;">
						${imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:10px; color:#555;">IMG</span>'}
					</div>
					<div style="flex:1; min-width:0;">
						<div style="font-size:15px; font-weight:bold; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${MenuParty.escapeHtml(c.name)}</div>
						<div style="font-size:11px; color:#aaa;">${MenuParty.escapeHtml(c.job || '')} / Lv.${c.level || 1}</div>
						<div style="font-size:11px; color:#ffd; margin-top:4px;">現在: ${MenuParty.escapeHtml(currentLabel)}</div>
					</div>
				</div>
				<div style="display:flex; flex-direction:column; gap:6px; padding:12px;">
					${Object.keys(strategies).map(key => `
						<button class="btn" style="width:100%; text-align:left; padding:10px 12px; background:${key === current ? '#064' : '#333'};" onclick="MenuParty.setStrategy('${uid}', '${key}')">
							${MenuParty.escapeHtml(strategies[key].label || key)}
						</button>
					`).join('')}
				</div>
				<div style="padding:0 12px 12px;">
					<button class="btn" style="width:100%; background:#555;" onclick="MenuParty.closeStrategyModal()">閉じる</button>
				</div>
			</div>
		`;
		frameModal.host.appendChild(modal);
	},

	closeStrategyModal: () => {
		const modal = document.getElementById('party-strategy-modal');
		if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
	},

	setStrategy: (uid, strategy) => {
		if (App.setBattleStrategy) App.setBattleStrategy(uid, strategy);
		MenuParty.closeStrategyModal();
		MenuParty.renderStrategies();
	},

	renderEquipmentList: () => {
		const list = document.getElementById('party-equipment-list');
		if (!list) return;
		list.innerHTML = '';
		for (let i = 0; i < 4; i++) {
			const uid = App.data.party[i];
			const div = document.createElement('div');
			div.className = 'list-item';
			div.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px; min-height:76px;';
			if (!uid) {
				div.innerHTML = `<div style="color:#777;">空きスロット</div>`;
				list.appendChild(div);
				continue;
			}
			const c = App.getChar(uid);
			if (!c) continue;
			const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(c) : c.img || '';
			const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(c) : '';
			const equips = c.equips || {};
			const summary = ['武器', '盾', '頭', '体', '足'].map(part => equips[part] ? `${part}:${equips[part].name}` : `${part}:なし`).join(' / ');
			div.innerHTML = `
				<div style="width:46px; height:46px; flex:0 0 auto; border:1px solid #555; border-radius:6px; overflow:hidden; background:#222; display:flex; align-items:center; justify-content:center;">
					${imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:100%; height:100%; object-fit:cover;">` : '<span style="font-size:10px; color:#555;">IMG</span>'}
				</div>
				<div style="flex:1; min-width:0;">
					<div style="display:flex; align-items:baseline; gap:6px; margin-bottom:4px;">
						<span style="font-size:13px; font-weight:bold; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${MenuParty.escapeHtml(c.name)}</span>
						<span style="font-size:10px; color:#aaa; white-space:nowrap;">Lv.${c.level || 1}</span>
					</div>
					<div style="font-size:10px; color:#cbb99d; line-height:1.35; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${MenuParty.escapeHtml(summary)}</div>
				</div>
				<div style="font-size:18px; color:#b9a58a; flex:0 0 auto;">›</div>
			`;
			div.onclick = () => MenuParty.openEquipmentModal(uid);
			list.appendChild(div);
		}
	},

	openEquipmentModal: (uid) => {
		const c = App.getChar(uid);
		if (!c || typeof MenuAllies === 'undefined') return;
		MenuParty.closeEquipmentModal(false);
		MenuAllies.selectedChar = c;
		MenuAllies.selectedUid = c.uid;
		MenuAllies.partyEquipContext = { uid: c.uid };
		const modal = document.createElement('div');
		modal.id = 'party-equipment-modal';
		const frameModal = MenuParty.getFrameModalStyle(3180, 0);
		modal.style.cssText = frameModal.style;
		modal.onclick = () => MenuParty.closeEquipmentModal();
		modal.innerHTML = `
			<div onclick="event.stopPropagation()" style="width:100%; height:100%; max-height:100%; display:flex; flex-direction:column; background:#111; border:1px solid #777; border-radius:8px; box-shadow:0 18px 48px rgba(0,0,0,0.7); overflow:hidden; box-sizing:border-box;">
				<div id="party-equipment-modal-header" style="flex:0 0 auto; display:flex; justify-content:space-between; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid #333; background:#1b1b1b;"></div>
				<div id="party-equipment-modal-content" style="flex:1 1 auto; min-height:0; overflow:auto; padding:10px;"></div>
				<div style="flex:0 0 auto; padding:10px 12px; border-top:1px solid #333; background:#161616;">
					<button class="btn" style="width:100%; background:#555;" onclick="MenuParty.closeEquipmentModal()">閉じる</button>
				</div>
			</div>
		`;
		frameModal.host.appendChild(modal);
		MenuParty.renderEquipmentModal();
	},

	closeEquipmentModal: (clearContext = true) => {
		const modal = document.getElementById('party-equipment-modal');
		if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
		if (clearContext && typeof MenuAllies !== 'undefined') MenuAllies.partyEquipContext = null;
	},

	renderEquipmentModal: () => {
		const context = (typeof MenuAllies !== 'undefined') ? MenuAllies.partyEquipContext : null;
		const c = context ? App.getChar(context.uid) : null;
		const modal = document.getElementById('party-equipment-modal');
		if (!c || !modal) return;
		if (!c.equips) c.equips = { '武器': null, '盾': null, '頭': null, '体': null, '足': null };
		MenuAllies.selectedChar = c;
		MenuAllies.selectedUid = c.uid;
		const header = modal.querySelector('#party-equipment-modal-header');
		const content = modal.querySelector('#party-equipment-modal-content');
		const PS = (typeof PassiveSkill !== 'undefined') ? PassiveSkill : null;
		const hasDualWield = PS ? PS.getSumValue(c, 'dual_dmg_base') > 0 : false;
		const hasTwoHanded = PS ? PS.getSumValue(c, 'two_handed') > 0 : false;
		const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(c) : c.img || '';
		const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(c) : '';
		header.innerHTML = `
			<div style="display:flex; align-items:center; gap:9px; min-width:0;">
				<div style="width:42px; height:42px; flex:0 0 auto; border:1px solid #555; border-radius:6px; overflow:hidden; background:#222;">
					${imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:100%; height:100%; object-fit:cover;">` : ''}
				</div>
				<div style="min-width:0;">
					<div style="font-weight:bold; color:#ffd700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${MenuParty.escapeHtml(c.name)} の装備</div>
					<div style="font-size:11px; color:#aaa; margin-top:2px;">Lv.${c.level || 1} ${MenuParty.escapeHtml(c.job || '')}</div>
				</div>
			</div>
			<button class="btn" style="flex:0 0 auto; padding:4px 10px; background:#555;" onclick="MenuParty.closeEquipmentModal()">閉じる</button>
		`;
		const parts = ['武器', '盾', '頭', '体', '足'];
		content.innerHTML = `<div style="display:flex; flex-direction:column; gap:5px;">
			${parts.map(part => {
				let label = part;
				let isLocked = false;
				if (part === '盾') {
					if (hasTwoHanded) { label = '盾(不可)'; isLocked = true; }
					else if (hasDualWield) { label = '武器2'; }
				}
				const eq = c.equips[part];
				const rarityColor = eq ? Menu.getRarityColor(eq.rarity) : '#888';
				return `<div class="list-item" style="align-items:center; opacity:${isLocked ? 0.5 : 1}; padding:9px;" ${isLocked ? '' : `onclick="MenuParty.openEquipmentSlot('${label}')"`}>
					<div style="width:48px; flex:0 0 auto; font-size:11px; color:#ffd700; font-weight:bold;">${MenuParty.escapeHtml(label)}</div>
					<div style="flex:1; min-width:0;">
						<div style="font-size:12px; font-weight:bold; color:${rarityColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${eq ? MenuParty.escapeHtml(eq.name) : (isLocked ? '両手持ち中' : 'なし')}</div>
						${eq ? MenuAllies.getEquipFullDetailHTML(eq) : ''}
					</div>
					<div style="font-size:16px; color:#b9a58a; margin-left:5px;">${isLocked ? '' : '›'}</div>
				</div>`;
			}).join('')}
		</div>`;
	},

	openEquipmentSlot: (partLabel) => {
		if (typeof MenuAllies === 'undefined') return;
		const context = MenuAllies.partyEquipContext;
		const c = context ? App.getChar(context.uid) : null;
		if (!c) return;
		MenuAllies.selectedChar = c;
		MenuAllies.selectedUid = c.uid;
		MenuAllies.openEquipModal(partLabel);
	},
    
    // ★新規追加: 隊列（前衛・後衛）の切り替え処理
    toggleFormation: (uid) => {
        const c = App.getChar(uid);
        if (!c) return;
        // formation が未定義の場合は 'front' をデフォルトとする
        c.formation = (c.formation === 'back') ? 'front' : 'back';
        App.save();
        // 隊列が変わるとオーラ効果で全員のステータスが変わる可能性があるため、スロット全体を再描画
        MenuParty.renderSlots();
    },

    renderSlots: () => {
        const list = document.getElementById('party-slot-list');
        list.innerHTML = '';
        
        for(let i=0; i<4; i++) {
            const uid = App.data.party[i];
            const div = document.createElement('div');
            div.className = 'list-item';
            
            if (uid) {
                const c = App.getChar(uid);
                // 隊列変更が即座に反映されるよう、ここで最新ステータスを計算
                const s = App.calcStats(c);
                
                const curHp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
                const curMp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
                const lbText = c.limitBreak > 0 ? `<span style="color:#f0f; font-weight:bold; font-size:11px;">+${c.limitBreak}</span>` : '';
                const rarityLabel = (c.uid === 'p1') ? 'Player' : `[${c.rarity}]`;
                const rarityColor = (c.uid === 'p1') ? '#ffd700' : Menu.getRarityColor(c.rarity);
                
                const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(c) : c.img;
                const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(c) : '';
                const imgHtml = imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:58px; height:58px; object-fit:cover; border-radius:5px; border:1px solid rgba(232,184,94,0.38);">` : `<div style="width:58px; height:58px; background:#2b1a0e; display:flex; align-items:center; justify-content:center; color:#8d7456; font-size:9px; border-radius:5px; border:1px solid rgba(232,184,94,0.38);">IMG</div>`;

                // ★隊列表示用の設定
                const formationLabel = (c.formation === 'back') ? '後衛' : '前衛';
                const formationColor = (c.formation === 'back') ? '#44aaff' : '#ff4444';

				div.innerHTML = `
					<div style="display:flex; align-items:center; width:100%; gap:10px; min-height:92px;">
						<div style="width:68px; flex:0 0 68px; display:flex; flex-direction:column; align-items:center; align-self:stretch; justify-content:flex-start; gap:5px; padding-top:1px;">
							${imgHtml}
							<div style="background:#21130a; border-radius:4px; padding:2px; display:flex; border:1px solid rgba(232,184,94,0.26); cursor:pointer;" onclick="event.stopPropagation(); MenuParty.toggleFormation('${c.uid}')">
								<div style="font-size:9px; padding:2px 5px; border-radius:2px; background:${c.formation !== 'back' ? formationColor : 'transparent'}; color:${c.formation !== 'back' ? '#fff' : '#666'};">前衛</div>
								<div style="font-size:9px; padding:2px 5px; border-radius:2px; background:${c.formation === 'back' ? formationColor : 'transparent'}; color:${c.formation === 'back' ? '#fff' : '#666'};">後衛</div>
							</div>
						</div>

						<div style="flex:1 1 auto; min-width:0;">
							<div style="display:flex; align-items:baseline; gap:5px; margin-bottom:2px; min-width:0;">
								<div style="font-size:14px; font-weight:bold; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;">
									${MenuParty.escapeHtml(c.name)}
								</div>
								${lbText}
							</div>
							
							<div style="display:flex; align-items:center; gap:7px; font-size:11px; color:#f7e2b7; margin-bottom:2px; line-height:1.15;">
								<span style="color:#ffd700; font-weight:bold;">Lv.${c.level}</span>
								<span style="font-size:10px; color:#b9a58a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${MenuParty.escapeHtml(c.job || '')}</span>
							</div>

							<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:12px; color:#f7e2b7; margin-bottom:4px; line-height:1.15;">
								<span style="white-space:nowrap;">HP:<span style="color:#7dff8c;">${curHp}/${s.maxHp}</span></span>
								<span style="white-space:nowrap;">MP:<span style="color:#9da7ff;">${curMp}/${s.maxMp}</span></span>
							</div>
							<div style="display:grid; grid-template-columns: repeat(3, max-content); gap:2px 11px; font-size:9px; color:#b9a58a; line-height:1.18;">
								<span>攻:${s.atk}</span>
								<span>魔:${s.mag}</span>
								<span>速:${s.spd}</span>
								<span>防:${s.def}</span>
								<span>魔防:${s.mdef}</span>
							</div>
						</div>

						<div style="display:flex; align-items:center; justify-content:center; flex:0 0 18px; align-self:stretch;">
							<div style="font-size:18px; color:#b9a58a; cursor:pointer; line-height:1;" onclick="event.stopPropagation(); MenuParty.openChangeMember(${i})">›</div>
						</div>
					</div>
				`;

                // メイン領域クリックでキャラ変更画面へ
                div.onclick = () => MenuParty.openChangeMember(i);
            } else {
                div.innerHTML = `
                    <div style="display:flex; align-items:center; width:100%; min-height:48px;">
                        <div style="flex:1; color:#806b50;">(空き)</div>
                        <div style="font-size:10px; color:#b9a58a;">設定 &gt;</div>
                    </div>
                `;
                div.onclick = () => MenuParty.openChangeMember(i);
            }
            list.appendChild(div);
        }
        
    },

    // キャラクタ変更画面を開くためのヘルパー
    openChangeMember: (slotIndex) => {
		MenuParty.targetSlot = slotIndex;
		const tabs = document.getElementById('party-screen-tabs');
		if (tabs) tabs.style.display = 'none';
		document.getElementById('party-screen-slots').style.display = 'none';
		const strategy = document.getElementById('party-screen-strategy');
		if (strategy) strategy.style.display = 'none';
		const equipment = document.getElementById('party-screen-equipment');
		if (equipment) equipment.style.display = 'none';
		document.getElementById('party-screen-chars').style.display = 'flex';

		MenuParty.setBottomButton('スロット選択にもどる', () => {
			document.getElementById('party-screen-chars').style.display = 'none';
			if (tabs) tabs.style.display = 'flex';
			MenuParty.switchTab('members');
		});

		MenuParty.renderCharList();
	},
    
    renderCharList: () => {
        const list = document.getElementById('party-char-list');
        list.innerHTML = '<div class="list-item" style="justify-content:center; color:#f88;" onclick="MenuParty.setMember(null)">(この枠を空にする)</div>';
        
        const rarityVal = { N:1, R:2, SR:3, SSR:4, UR:5, EX:6 };
        const chars = [...App.data.characters].sort((a, b) => {
            const aInParty = App.data.party.includes(a.uid);
            const bInParty = App.data.party.includes(b.uid);
            if (aInParty !== bInParty) return bInParty - aInParty;
            if (a.uid === 'p1') return -1;
            if (b.uid === 'p1') return 1;
            const rA = rarityVal[a.rarity] || 0;
            const rB = rarityVal[b.rarity] || 0;
            if (rA !== rB) return rB - rA;
            if (b.level !== a.level) return b.level - a.level;
            return a.charId - b.charId;
        });

        chars.forEach(c => {
            const s = App.calcStats(c);
            const div = document.createElement('div');
            div.className = 'list-item';
            if (Menu.getCharacterCardHTML) {
                const rarityLabel = (c.uid === 'p1') ? 'Player' : `${c.rarity}`;
                const badge = `${App.data.party.includes(c.uid) ? 'PT ' : ''}${rarityLabel}`;
                div.innerHTML = Menu.getCharacterCardHTML(c, { badge });
            } else {
            
            const curHp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
            const curMp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
            const inParty = App.data.party.includes(c.uid) ? '<span style="color:#4ff; font-weight:bold; font-size:10px; margin-right:4px;">[PT]</span>' : '';
            const lbText = c.limitBreak > 0 ? `<span style="color:#f0f; font-weight:bold; font-size:11px;">+${c.limitBreak}</span>` : '';
            const rarityLabel = (c.uid === 'p1') ? 'Player' : `${c.rarity}`;
            const rarityColor = (c.uid === 'p1') ? '#ffd700' : Menu.getRarityColor(c.rarity);
            
            const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(c) : c.img;
            const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(c) : '';
            const imgHtml = imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #555;">` : `<div style="width:40px; height:40px; background:#333; display:flex; align-items:center; justify-content:center; color:#555; font-size:9px; border-radius:4px; border:1px solid #555;">IMG</div>`;

            div.innerHTML = `
                <div style="display:flex; align-items:center; width:100%;">
                    <div style="margin-right:10px;">${imgHtml}</div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                            <div style="font-size:13px; font-weight:bold; color:#fff;">${inParty}${c.name} ${lbText} <span style="font-size:10px; color:#aaa; font-weight:normal;">(${c.job})</span></div>
                            <div style="font-size:11px; font-weight:bold; color:${rarityColor};">${rarityLabel}</div>
                        </div>
                        <div style="font-size:11px; color:#ddd; display:flex; align-items:baseline; margin-bottom:1px;">
                            <span style="color:#ffd700; font-weight:bold; margin-right:8px;">Lv.${c.level}</span>
                            <span style="margin-right:8px;">HP <span style="color:#8f8;">${curHp}/${s.maxHp}</span></span>
                            <span>MP <span style="color:#88f;">${curMp}/${s.maxMp}</span></span>
                        </div>
                        <div style="font-size:10px; color:#aaa; display:flex; flex-wrap:wrap; gap:6px;">
                            <span>攻:${s.atk}</span> <span>防:${s.def}</span> <span>魔:${s.mag}</span> <span>魔防:${s.mdef}</span> <span>速:${s.spd}</span>
                        </div>
                    </div>
                </div>
            `;
            }
            div.onclick = () => MenuParty.setMember(c.uid);
            list.appendChild(div);
        });

    },
    
	setMember: (uid) => {
		if (uid === null) {
			const currentCount = App.data.party.filter(id => id !== null).length;
			if (App.data.party[MenuParty.targetSlot] !== null && currentCount <= 1) {
				Menu.msg("パーティメンバーを0人にはできません。");
				return;
			}
		}

		if (uid !== null && typeof App !== 'undefined' && typeof App.isMonsterAlly === 'function') {
			const futureParty = Array.isArray(App.data.party) ? [...App.data.party] : [];
			const oldIdxForCheck = futureParty.indexOf(uid);
			if (oldIdxForCheck > -1) futureParty[oldIdxForCheck] = futureParty[MenuParty.targetSlot];
			futureParty[MenuParty.targetSlot] = uid;
			const monsterCount = futureParty.filter(id => {
				const c = App.getChar ? App.getChar(id) : null;
				return App.isMonsterAlly(c);
			}).length;
			if (monsterCount > 1) {
				Menu.msg("パーティに編成できる仲間モンスターは1体だけです。");
				return;
			}
		}

		const oldIdx = App.data.party.indexOf(uid);
		if(oldIdx > -1 && uid !== null) App.data.party[oldIdx] = App.data.party[MenuParty.targetSlot];
		
		App.data.party[MenuParty.targetSlot] = uid;
		App.save();

		document.getElementById('party-screen-chars').style.display = 'none';
		const tabs = document.getElementById('party-screen-tabs');
		if (tabs) tabs.style.display = 'flex';
		MenuParty.switchTab('members');
	}
};

if (typeof window !== 'undefined') window.MenuParty = MenuParty;
