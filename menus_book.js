/* MenuBook extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   7. 魔物図鑑 (詳細表示・タブ形式・特性表示追加版)
   ========================================================================== */
const MenuBook = {
    // 状態管理
    currentMode: 'list',
    selectedMonster: null,
    detailTab: 1, // 詳細画面のタブ状態
    traitDetailList: [], // 図鑑用：特性詳細モーダルの表示対象
    currentTraitIndex: -1,
	
    setBottomButton: (label, handler) => {
        const btn = document.querySelector('#sub-screen-book .sub-screen-bottom-panel .sub-screen-back-btn');
        if (!btn) return;

        btn.innerText = label;
        btn.onclick = handler;
    },

	init: () => {
		MenuBook.ensureBottomPanel();
		MenuBook.showList();
	},
	
    getMonsterImgSrc: (m) => {
        if (m.img) return m.img;
        const imageMap = window.MonsterImageMap || {};
        const mappedById = imageMap[m.id] || imageMap[m.baseId];
        if (mappedById) return mappedById;
        if (typeof GRAPHICS === 'undefined' || !GRAPHICS.images) return null;
        let baseName = m.name.replace(/^(強・|真・|極・|神・)+/, '').replace(/ Lv\d+[A-Z]?$/, '').replace(/[A-Z]$/, '').trim();
        const imgKey = 'monster_' + baseName;
        if (GRAPHICS.images[imgKey]) return GRAPHICS.images[imgKey].src;
        return null;
    },

	showList: () => {
		MenuBook.currentMode = 'list';
		MenuBook.closeTraitDetail();

		const list = document.getElementById('book-list');
		const detail = document.getElementById('book-detail');

		if (list) list.style.display = 'block';
		if (detail) detail.style.display = 'none';

		const headerBtn = document.querySelector('#sub-screen-book .header-bar button');
		if (headerBtn) {
			headerBtn.innerText = 'もどる';
			headerBtn.onclick = () => Menu.closeSubScreen('book');
		}

		MenuBook.setBottomButton('もどる', () => {
			Menu.closeSubScreen('book');
		});

		MenuBook.renderList();
	},
	
    renderList: () => {
        const list = document.getElementById('book-list');
        list.innerHTML = '';
        const defeated = App.data.book.monsters || [];
        const killCounts = App.data.book.killCounts || {};
        
        DB.MONSTERS.forEach(m => {
            const isKnown = defeated.includes(m.id);
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.alignItems = 'flex-start';
            div.style.padding = '8px';

            if(isKnown) {
                const killCount = killCounts[m.id] || 0;
                const skillNames = (m.acts || []).map(act => {
                    const id = (typeof act === 'object') ? act.id : act;
                    const s = DB.SKILLS.find(k => k.id === id);
                    return s ? s.name : '通常攻撃';
                }).slice(0, 3).join(', ') + ((m.acts||[]).length > 3 ? '...' : '');

                const imgSrc = MenuBook.getMonsterImgSrc(m);
                const imgContent = imgSrc ? `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain;">` : `<span style="color:#555;font-size:10px;">NO IMG</span>`;

                let tagHtml = '';
                if(m.isBoss) tagHtml += `<span style="font-size:8px; color:#ff4444; border:1px solid #ff4444; padding:0 2px; border-radius:2px; margin-right:4px; vertical-align:middle;">BOSS</span>`;
                if(m.isRare) tagHtml += `<span style="font-size:8px; color:#ffd700; border:1px solid #ffd700; padding:0 2px; border-radius:2px; margin-right:4px; vertical-align:middle;">RARE</span>`;

                div.innerHTML = `
                    <div style="width:64px; height:64px; background:#1a1a1a; border:1px solid #444; margin-right:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:4px;">
                        ${imgContent}
                    </div>
                    <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; min-height:64px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:2px; margin-bottom:2px;">
                            <span style="font-size:14px; font-weight:bold; color:#f88;">${tagHtml}${m.name}</span>
                            <span style="font-size:10px; color:#ffd700; background:rgba(255,215,0,0.1); padding:0 4px; border-radius:2px;">討伐数: ${killCount}</span>
                        </div>
                        <div style="font-size:10px; color:#ddd; display:flex; gap:8px; margin-bottom:1px;">
                            <span>HP <span style="color:#8f8;">${m.hp}</span></span>
                            <span>MP <span style="color:#88f;">${m.mp}</span></span>
                        </div>
                        <div style="font-size:10px; color:#ccc; display:flex; flex-wrap:wrap; gap:6px;">
                            <span>攻:${m.atk}</span> <span>防:${m.def}</span> <span>魔:${m.mag}</span> <span>魔防:${m.mdef || 0}</span> <span>速:${m.spd}</span>
                        </div>
                    </div>
                `;
                div.onclick = () => { MenuBook.detailTab = 1; MenuBook.showDetail(m); };
            } else {
                div.innerHTML = `<div style="width:64px; height:64px; background:#111; border:1px solid #333; margin-right:10px; flex-shrink:0; border-radius:4px;"></div><div style="flex:1; display:flex; align-items:center; height:64px;"><span style="color:#444; font-size:20px; letter-spacing:4px; font-weight:bold;">？？？</span></div>`;
            }
            list.appendChild(div);
        });
    },

    switchMonster: (dir) => {
        const defeatedIds = App.data.book.monsters || [];
        const validMonsters = DB.MONSTERS.filter(m => defeatedIds.includes(m.id));
        if (validMonsters.length === 0) return;
        let currentIndex = MenuBook.selectedMonster ? validMonsters.findIndex(m => m.id === MenuBook.selectedMonster.id) : -1;
        let newIndex = (currentIndex + dir + validMonsters.length) % validMonsters.length;
        MenuBook.closeTraitDetail();
        MenuBook.showDetail(validMonsters[newIndex]);
    },

    buildTraitDetailList: (monster) => {
        const PS = (typeof PassiveSkill !== 'undefined') ? PassiveSkill : null;
        if (!PS || !PS.MASTER || !monster || !Array.isArray(monster.traits)) return [];
        return monster.traits.map((trait, index) => {
            const master = PS.MASTER[trait.id];
            if (!master) return null;
            return {
                ...master,
                id: trait.id,
                lv: trait.level || trait.lv || 1,
                slotIndex: index,
                isEquip: false,
                isBook: true,
                sourceLabel: '魔物図鑑'
            };
        }).filter(Boolean);
    },

	ensureBottomPanel: () => {
		const screen = document.getElementById('sub-screen-book');
		if (!screen) return;

		let panel = document.getElementById('book-bottom-panel');
		if (panel) return;

		panel = document.createElement('div');
		panel.id = 'book-bottom-panel';
		panel.className = 'sub-screen-bottom-panel';
		panel.innerHTML = `
			<button id="book-bottom-back-btn" class="btn sub-screen-back-btn">もどる</button>
		`;

		screen.appendChild(panel);
	},

	setBottomButton: (label, handler) => {
		const btn = document.getElementById('book-bottom-back-btn');
		if (!btn) return;

		btn.innerText = label;
		btn.onclick = handler;
	},

	showListView: () => {
		const list = document.getElementById('book-list');
		const detail = document.getElementById('book-detail');

		if (list) list.style.display = 'block';
		if (detail) detail.style.display = 'none';

		MenuBook.setBottomButton('もどる', () => {
			Menu.closeSubScreen('book');
		});
	},

	showDetailView: () => {
		const list = document.getElementById('book-list');
		const detail = document.getElementById('book-detail');

		if (list) list.style.display = 'none';
		if (detail) detail.style.display = 'block';

		MenuBook.setBottomButton('もどる', () => {
			MenuBook.showListView();
		});
	},

    openTraitDetail: (index) => {
        if (!MenuBook.traitDetailList || MenuBook.traitDetailList.length === 0) {
            MenuBook.traitDetailList = MenuBook.buildTraitDetailList(MenuBook.selectedMonster);
        }
        if (!MenuBook.traitDetailList[index]) return;
        MenuBook.currentTraitIndex = index;
        MenuBook.renderTraitDetail();
    },

    moveTraitDetail: (dir) => {
        const list = MenuBook.traitDetailList || [];
        if (list.length <= 1) return;
        MenuBook.currentTraitIndex = (MenuBook.currentTraitIndex + dir + list.length) % list.length;
        MenuBook.renderTraitDetail();
    },

    closeTraitDetail: () => {
        const modal = document.getElementById('book-trait-detail-modal');
        if (modal) modal.remove();
    },

    renderTraitDetail: () => {
        const list = MenuBook.traitDetailList || [];
        const t = list[MenuBook.currentTraitIndex];
        if (!t) return;

        let modal = document.getElementById('book-trait-detail-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'book-trait-detail-modal';
            document.body.appendChild(modal);
        }

        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:5000; display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box;';
        modal.innerHTML = `
            <div onclick="event.stopPropagation()" style="width:310px; max-width:calc(100vw - 24px); background:#111; border:1px solid #00ffff; border-radius:8px; padding:20px; color:#eee; box-shadow:0 10px 40px #000; font-family:sans-serif;">
                <div style="border-bottom:1px solid #333; padding-bottom:10px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="color:#00ffff; font-size:18px; font-weight:bold; line-height:1.2;">${t.name}</span>
                    <span style="font-size:10px; background:#333; padding:2px 8px; border-radius:4px; color:#aaa; flex-shrink:0;">${t.sourceLabel || '魔物特性'}</span>
                </div>

                <div style="background:#222; padding:10px; border-radius:4px; font-size:12px; margin-bottom:15px; display:flex; justify-content:space-between; gap:8px;">
                    <span>Lv: <b style="color:#fff;">${t.lv}</b></span>
                    <span style="color:#888;">分類: ${t.type || '不明'}</span>
                </div>

                ${t.effect ? `<div style="font-size:12px; color:#00ffff; line-height:1.5; background:rgba(0,255,255,0.06); border:1px solid rgba(0,255,255,0.2); border-radius:4px; padding:8px; margin-bottom:10px;">${t.effect}</div>` : ''}

                <div style="font-size:13px; line-height:1.6; color:#ccc; min-height:60px; margin-bottom:20px; padding:0 5px;">
                    ${t.desc || '効果なし'}
                </div>

                <div style="display:flex; justify-content:space-between; gap:10px;">
                    <div style="display:flex; gap:5px;">
                        <button class="btn" style="width:45px; height:35px; background:#333; color:white; border:1px solid #555; cursor:pointer;" onclick="MenuBook.moveTraitDetail(-1)">▲</button>
                        <button class="btn" style="width:45px; height:35px; background:#333; color:white; border:1px solid #555; cursor:pointer;" onclick="MenuBook.moveTraitDetail(1)">▼</button>
                    </div>
                    <button class="btn" style="flex:1; background:#444; color:white; border:1px solid #555; cursor:pointer;" onclick="MenuBook.closeTraitDetail()">閉じる</button>
                </div>
            </div>
        `;
        modal.onclick = () => MenuBook.closeTraitDetail();
    },

    // --- 詳細画面 ---
    showDetail: (monster) => {
        MenuBook.selectedMonster = monster;
        const killCount = (App.data.book.killCounts && App.data.book.killCounts[monster.id]) || 0;
		const monsterExp = Number(monster.exp || 0);
		const monsterGold = Number(monster.gold || 0);

		MenuBook.currentMode = 'detail';

		const view = document.getElementById('book-detail');
		const list = document.getElementById('book-list');

		if (list) list.style.display = 'none';

		if (view) {
			view.style.display = 'block';
			view.style.flex = '1 1 auto';
			view.style.minHeight = '0';
			view.style.overflowY = 'auto';
		}

		const headerBtn = document.querySelector('#sub-screen-book .header-bar button');
		if (headerBtn) {
			headerBtn.innerText = 'もどる';
			headerBtn.onclick = () => Menu.closeSubScreen('book');
		}

		MenuBook.setBottomButton('もどる', () => {
			MenuBook.showList();
		});

        const imgHtml = MenuBook.getMonsterImgSrc(monster) ? `<img src="${MenuBook.getMonsterImgSrc(monster)}" style="max-height:100%; max-width:100%; object-fit:contain;">` : `<div style="color:#555;">NO IMAGE</div>`;
        const elements = ['火','水','風','雷','光','闇','混沌'];
        const resistLabels = { Poison:'毒・猛毒', Shock:'感電', Fear:'怯え', Seal:'封印系', Debuff:'弱体化', InstantDeath:'即死/割合' };

        // 共通パーツ：行動リスト
        const actListHtml = (monster.acts || [1]).map(act => {
            const actId = (typeof act === 'object') ? act.id : act;
            const cond = (typeof act === 'object') ? act.condition : 0;
            const s = DB.SKILLS.find(k => k.id === actId);
            const sName = s ? s.name : (actId===1?'通常攻撃':(actId===2?'防御':'不明'));
            let condText = cond === 1 ? '(HP≧50%)' : cond === 2 ? '(HP≦50%)' : cond === 3 ? '(異常)' : '';
            return `<div style="background:#333; padding:4px 8px; border-radius:3px; font-size:11px; margin-bottom:2px; display:flex; justify-content:space-between;"><span>${sName}</span><span style="color:#aaa;">${condText}</span></div>`;
        }).join('');

        // 共通パーツ：ドロップ
        const getDropText = (type) => {
            const drop = monster.drops && monster.drops[type] ? DB.ITEMS.find(i=>i.id == monster.drops[type].id) : null;
            return drop ? `${drop.name} (${monster.drops[type].rate}%)` : 'なし';
        };

        // 共通パーツ：特性リスト（タップで詳細確認）
        MenuBook.traitDetailList = MenuBook.buildTraitDetailList(monster);
        const traitListHtml = MenuBook.traitDetailList.map((t, index) => `
            <button type="button"
                onclick="event.stopPropagation(); MenuBook.openTraitDetail(${index}); return false;"
                style="background:#111; border:1px solid #00ffff; color:#00ffff; padding:3px 7px; border-radius:4px; font-size:10px; margin-right:4px; margin-bottom:4px; display:inline-block; cursor:pointer; touch-action:manipulation; font-family:inherit;">
                ${t.name} Lv.${t.lv}
            </button>
        `).join('') || '<span style="color:#555; font-size:11px;">特性なし</span>';

        // タブ切り替えボタン
        const tabBtns = `
            <div style="display:flex; gap:2px; margin-bottom:10px; background:#111; padding:2px; border-radius:4px;">
                <button onclick="MenuBook.detailTab=1; MenuBook.showDetail(MenuBook.selectedMonster)" style="flex:1; padding:8px; border:none; font-size:11px; font-weight:bold; border-radius:3px; background:${MenuBook.detailTab===1?'#ffd700':'#222'}; color:${MenuBook.detailTab===1?'#000':'#888'};">行動・耐性</button>
                <button onclick="MenuBook.detailTab=2; MenuBook.showDetail(MenuBook.selectedMonster)" style="flex:1; padding:8px; border:none; font-size:11px; font-weight:bold; border-radius:3px; background:${MenuBook.detailTab===2?'#ffd700':'#222'}; color:${MenuBook.detailTab===2?'#000':'#888'};">情報・報酬</button>
            </div>`;

        // タブ1：行動(左) + 耐性(右)
        const tab1Content = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div style="background:#252525; border:1px solid #444; border-radius:4px; padding:8px;">
                    <div style="font-size:11px; color:#aaa; margin-bottom:5px; border-bottom:1px solid #444;">行動パターン (${monster.actCount||1}回)</div>
                    ${actListHtml}
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <div style="background:#222; border:1px solid #444; border-radius:4px; padding:5px;">
                        <div style="font-size:10px; color:#88f; text-align:center; border-bottom:1px solid #333; margin-bottom:3px;">属性耐性 (%)</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:2px;">
                            ${elements.map(e => `<div style="display:flex; justify-content:space-between; font-size:10px; background:#333; padding:1px 4px; border-radius:2px;"><span style="color:#aaa;">${e}</span><span>${monster.elmRes?.[e]||0}</span></div>`).join('')}
                        </div>
                    </div>
                    <div style="background:#222; border:1px solid #444; border-radius:4px; padding:5px;">
                        <div style="font-size:10px; color:#f88; text-align:center; border-bottom:1px solid #333; margin-bottom:3px;">異常耐性</div>
                        ${Object.keys(resistLabels).map(k => `<div style="display:flex; justify-content:space-between; font-size:10px; background:#333; padding:1px 4px; border-radius:2px; margin-bottom:1px;"><span style="color:#aaa;">${resistLabels[k]}</span><span>${monster.resists?.[k]||0}</span></div>`).join('')}
                    </div>
                </div>
            </div>`;

        // タブ2：特性(上) + アーカイブ(中) + ドロップ(下)
        const tab2Content = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div style="background:#222; border:1px solid #444; border-radius:4px; padding:10px;">
                    <div style="font-size:11px; color:#ffd700; border-bottom:1px solid #444; margin-bottom:8px;">保有特性</div>
                    <div style="display:flex; flex-wrap:wrap;">${traitListHtml}</div>
                </div>
                <div style="background:#252525; border:1px solid #444; border-radius:4px; padding:10px; min-height:80px;">
                    <div style="font-size:11px; color:#ffd700; border-bottom:1px solid #444; margin-bottom:8px;">モンスター情報</div>
                    <div style="font-size:12px; color:#ccc; line-height:1.6; white-space:pre-wrap;">${monster.archives || '（記録なし）'}</div>
                </div>
                <div style="background:#2a2a3a; border:1px solid #448; border-radius:4px; padding:10px;">
                    <div style="font-size:11px; color:#88f; border-bottom:1px solid #448; margin-bottom:8px;">ドロップ情報</div>
                    <div style="font-size:12px; color:#ddd; margin-bottom:4px;">通常ドロップ：${getDropText('normal')}</div>
                    <div style="font-size:12px; color:#ffd700;">レアドロップ：${getDropText('rare')}</div>
                </div>
            </div>`;

        view.innerHTML = `
            <div style="padding:10px; background:#222; border-bottom:1px solid #444;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#333; padding:5px; border-radius:4px;">
                    <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuBook.switchMonster(-1)">＜ 前</button>
                    <span style="font-size:12px; color:#aaa;">図鑑ナビ</span>
                    <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuBook.switchMonster(1)">次 ＞</button>
                </div>
            </div>
            <div style="flex:1; overflow-y:auto; padding:10px; color:#ddd;">
                <div style="display:flex; justify-content:space-between; align-items:end; border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px;">
                    <div><div style="font-size:10px; color:#aaa;">ID:${monster.id} / 種族:${monster.race||'不明'}</div><div style="font-size:18px; font-weight:bold; color:#ffd700;">${monster.isBoss?'<span style="color:#f44; border:1px solid #f44; font-size:10px; padding:0 4px; border-radius:3px; margin-right:5px; vertical-align:middle;">BOSS</span>':''}${monster.name}</div></div>
                    <div style="font-size:12px; background:#444; padding:2px 8px; border-radius:4px;">Rank: ${monster.rank}</div>
                </div>
				<div style="display:flex; gap:9px; margin-bottom:14px; align-items:stretch;">
					<div style="
						flex:0 0 48%;
						max-width:50%;
						min-height:145px;
						max-height:190px;
						aspect-ratio:1 / 1;
						background:#000;
						border:1px solid #555;
						display:flex;
						align-items:center;
						justify-content:center;
						border-radius:4px;
						overflow:hidden;
					">
						${imgHtml}
					</div>

					<div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:5px;">
						<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
							<div style="background:#333; padding:3px 5px; border-radius:3px; border:1px solid #444;">
								<div style="font-size:8px; color:#aaa; line-height:1;">HP</div>
								<div style="font-weight:bold; color:#8f8; font-size:11px; line-height:1.2; text-align:right;">${monster.hp.toLocaleString()}</div>
							</div>

							<div style="background:#333; padding:3px 5px; border-radius:3px; border:1px solid #444;">
								<div style="font-size:8px; color:#aaa; line-height:1;">MP</div>
								<div style="font-weight:bold; color:#88f; font-size:11px; line-height:1.2; text-align:right;">${monster.mp.toLocaleString()}</div>
							</div>

							<div style="background:#333; padding:3px 5px; border-radius:3px; border:1px solid #444;">
								<div style="font-size:8px; color:#aaa; line-height:1;">EXP</div>
								<div style="font-weight:bold; color:#ffd700; font-size:11px; line-height:1.2; text-align:right;">${monsterExp.toLocaleString()}</div>
							</div>

							<div style="background:#333; padding:3px 5px; border-radius:3px; border:1px solid #444;">
								<div style="font-size:8px; color:#aaa; line-height:1;">GOLD</div>
								<div style="font-weight:bold; color:#ffd700; font-size:11px; line-height:1.2; text-align:right;">${monsterGold.toLocaleString()}</div>
							</div>

							<div style="grid-column:span 2; background:#333; padding:3px 5px; border-radius:3px; border:1px solid #444;">
								<div style="font-size:8px; color:#aaa; line-height:1;">討伐数</div>
								<div style="font-weight:bold; color:#ffd700; font-size:11px; line-height:1.2; text-align:right;">${killCount.toLocaleString()}</div>
							</div>
						</div>

						<div style="display:grid; grid-template-columns:1fr 1fr; gap:2px; font-size:10px;">
							<div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 5px;"><span>攻撃</span><span>${monster.atk}</span></div>
							<div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 5px;"><span>防御</span><span>${monster.def}</span></div>
							<div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 5px;"><span>魔力</span><span>${monster.mag}</span></div>
							<div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 5px;"><span>魔防</span><span>${monster.mdef || 0}</span></div>
							<div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 5px;"><span>素早</span><span>${monster.spd}</span></div>
						</div>

						<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:2px; text-align:center;">
							<div style="background:#111; padding:2px; border:1px solid #444; border-radius:3px;">
								<div style="font-size:7px; color:#aaa; line-height:1;">命中</div>
								<div style="font-size:9px; line-height:1.2;">${monster.hit || 100}%</div>
							</div>
							<div style="background:#111; padding:2px; border:1px solid #444; border-radius:3px;">
								<div style="font-size:7px; color:#aaa; line-height:1;">会心</div>
								<div style="font-size:9px; line-height:1.2;">${monster.cri || 0}%</div>
							</div>
							<div style="background:#111; padding:2px; border:1px solid #444; border-radius:3px;">
								<div style="font-size:7px; color:#aaa; line-height:1;">回避</div>
								<div style="font-size:9px; line-height:1.2;">${monster.eva || 0}%</div>
							</div>
						</div>
					</div>
				</div>
                ${tabBtns}
                <div id="book-tab-content">${MenuBook.detailTab === 1 ? tab1Content : tab2Content}</div>
            </div>`;
    }
};

if (typeof window !== 'undefined') window.MenuBook = MenuBook;
