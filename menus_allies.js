/* MenuAllies extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   5. 仲間一覧 & 詳細 (特性タブ・動的スロット・バグ修正完遂版)
   ========================================================================== */
const MenuAllies = {
    selectedChar: null,
	selectedUid: null, // 追加	
    currentTab: 1,
    targetPart: null,      
    selectedEquip: null,  
    tempAlloc: null,
    _tempCandidates: [], 
    equipModalOpen: false,
    candidateFilter: 'ALL',
    candidateSortMode: 'NEWEST',
	
	getSelectedChar: () => {
		if (MenuAllies.selectedUid != null) {
		  return App.data.characters.find(c => c.uid == MenuAllies.selectedUid) || null;
		}
		return MenuAllies.selectedChar || null;
	},

	escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	}[ch])),
	
    setHeaderButton: (label, handler) => {
        const btn = document.getElementById('allies-header-back-btn')
            || document.querySelector('#sub-screen-allies .header-bar button');
        if (!btn) return;

        btn.innerText = label;
        btn.onclick = handler;
    },

    setBottomButton: (label, handler) => {
        const btn = document.getElementById('allies-bottom-back-btn')
            || document.querySelector('#sub-screen-allies .sub-screen-bottom-panel .sub-screen-back-btn');
        if (!btn) return;

        btn.innerText = label;
        btn.onclick = handler;
    },

	ensureDetailContent: () => {
		const detailView = document.getElementById('allies-detail-view');
		if (!detailView) return null;

		let detailContent = document.getElementById('allies-detail-content');

		if (!detailContent) {
			detailView.innerHTML = `
				<div id="allies-detail-content" class="scroll-area" style="display:flex; flex-direction:column; min-height:0;"></div>
			`;
			detailContent = document.getElementById('allies-detail-content');
		}

		return detailContent;
	},

    showListView: () => {
        const listView = document.getElementById('allies-list-view');
        const detailView = document.getElementById('allies-detail-view');
        const treeView = document.getElementById('allies-tree-view');

        if (listView) listView.style.display = 'flex';
        if (detailView) detailView.style.display = 'none';
        if (treeView) treeView.style.display = 'none';

        MenuAllies.setHeaderButton('もどる', () => Menu.closeSubScreen('allies'));
        MenuAllies.setBottomButton('もどる', () => Menu.closeSubScreen('allies'));
    },

    showDetailView: () => {
        const listView = document.getElementById('allies-list-view');
        const detailView = document.getElementById('allies-detail-view');
        const treeView = document.getElementById('allies-tree-view');

        if (listView) listView.style.display = 'none';
        if (detailView) detailView.style.display = 'flex';
        if (treeView) treeView.style.display = 'none';

        MenuAllies.setHeaderButton('もどる', () => MenuAllies.renderList());
        MenuAllies.setBottomButton('もどる', () => MenuAllies.renderList());
    },

	showArchiveView: () => {
		const listView = document.getElementById('allies-list-view');
		const detailView = document.getElementById('allies-detail-view');

		if (listView) listView.style.display = 'none';
		if (detailView) detailView.style.display = 'flex';

		MenuAllies.setHeaderButton('もどる', () => {
			MenuAllies.returnFromArchiveToDetail();
		});

		MenuAllies.setBottomButton('もどる', () => {
			MenuAllies.returnFromArchiveToDetail();
		});
	},

	returnFromArchiveToDetail: () => {
		const c =
			(typeof MenuAllyDetail !== 'undefined' ? MenuAllyDetail.selectedChar : null) ||
			MenuAllies.getSelectedChar() ||
			MenuAllies.selectedChar;

		if (!c) {
			MenuAllies.renderList();
			return;
		}

		MenuAllies.selectedChar = c;
		MenuAllies.selectedUid = c.uid;
		MenuAllies.targetPart = null;
		MenuAllies.selectedEquip = null;

		MenuAllies.ensureDetailContent();
		MenuAllies.renderDetail();
	},
	
    init: () => {
        let container = document.getElementById('sub-screen-allies');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sub-screen-allies';
            container.className = 'sub-screen';
            container.style.display = 'none';
            container.style.flexDirection = 'column';
            const app = document.getElementById('app');
            if(app) app.appendChild(container);
            else document.body.appendChild(container);
        }

        MenuAllies.createAllocModalDOM(); 
        MenuAllies.createTreeViewDOM(); 

        if (!document.getElementById('allies-detail-view')) {
            const detailDiv = document.createElement('div');
            detailDiv.id = 'allies-detail-view';
            detailDiv.className = 'flex-col-container';
            detailDiv.style.display = 'none';
            detailDiv.style.background = '#222'; 
            detailDiv.style.height = '100%';
            container.appendChild(detailDiv);
        }
        
        if (!document.getElementById('allies-list-view')) {
             const listDiv = document.createElement('div');
             listDiv.id = 'allies-list-view';
             listDiv.className = 'flex-col-container';
             listDiv.innerHTML = `
                <div class="header-bar">
                    <span>🧑‍🤝‍🧑 仲間一覧</span>
                    <button class="btn" style="padding:4px 10px;" onclick="Menu.closeSubScreen('allies')">閉じる</button>
                </div>
                <div id="allies-list" class="scroll-area"></div>
             `;
             container.insertBefore(listDiv, container.firstChild);
        }

        document.getElementById('allies-list-view').style.display = 'flex';
        document.getElementById('allies-detail-view').style.display = 'none';
        
        const treeView = document.getElementById('allies-tree-view');
        if (treeView) treeView.style.display = 'none';
        
        MenuAllies.currentTab = 1;
        MenuAllies.targetPart = null;
        MenuAllies.selectedEquip = null;
        MenuAllies.candidateFilter = 'ALL';
        MenuAllies.candidateSortMode = 'NEWEST';
        
        MenuAllies.renderList();
		MenuAllies.showListView();
    },

    renderList: () => {
        MenuAllies.showListView();

        const list = document.getElementById('allies-list');
        if(!list) return;
        list.innerHTML = '';
        
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
            const imgHtml = MenuAllies.getCharacterSquareImageHtml
                ? MenuAllies.getCharacterSquareImageHtml(c, imgUrl, imageFallbackAttr, 'width:60px; height:60px;')
                : (imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:60px; height:60px; object-fit:cover; border-radius:4px; border:1px solid #555;">` : `<div style="width:60px; height:60px; background:#333; display:flex; align-items:center; justify-content:center; color:#555; font-size:9px; border-radius:4px; border:1px solid #555;">IMG</div>`);

            div.innerHTML = `
                <div style="display:flex; align-items:center; width:100%;">
                    <div style="margin-right:12px; flex:0 0 62px;">${imgHtml}</div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1px;">
                            <div style="font-size:13px; font-weight:bold; color:#fff;">${inParty}${c.name} ${lbText} <span style="font-size:10px; color:#aaa; font-weight:normal;">(${c.job})</span></div>
                            <div style="font-size:11px; font-weight:bold; color:${rarityColor};">${rarityLabel}</div>
                        </div>
                        <div style="font-size:11px; color:#ddd; display:flex; align-items:baseline; margin-bottom:0px;">
                            <span style="color:#ffd700; font-weight:bold; margin-right:8px;">Lv.${c.level}</span>
                        </div>
                        <div style="font-size:11px; color:#ddd; display:flex; align-items:baseline; margin-bottom:1px;">
                            <span style="margin-right:8px;">HP <span style="color:#8f8;">${curHp}/${s.maxHp}</span></span>
                            <span>MP <span style="color:#88f;">${curMp}/${s.maxMp}</span></span>
                        </div>
                        <div style="font-size:10px; color:#aaa; display:flex; gap:8px;">
                            <span>攻:${s.atk}</span> <span>魔:${s.mag}</span> <span>速:${s.spd}</span>
                        </div>
                        <div style="font-size:10px; color:#aaa; display:flex; gap:8px;">
                            <span>防:${s.def}</span><span>魔防:${s.mdef}</span>
                        </div>
                    </div>
                </div>`;
            }
            div.onclick = () => {
                MenuAllies.selectedChar = c;
				MenuAllies.selectedUid = c.uid; // 追加
                MenuAllies.currentTab = 1;
                MenuAllies.targetPart = null;
                MenuAllies.selectedEquip = null;
                MenuAllies.renderDetail();
            };
            list.appendChild(div);
        });
    },

    switchChar: (dir) => {
        if (!MenuAllies.selectedChar) return;

        // ★修正点1: キャラ切り替え時に「装備変更中」の選択状態をリセットする
        MenuAllies.targetPart = null;
        MenuAllies.selectedEquip = null;

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
        let idx = chars.findIndex(c => c.uid === MenuAllies.selectedChar.uid);
        if (idx === -1) idx = 0;
        let newIdx = (idx + dir + chars.length) % chars.length;
        
        const nextChar = chars[newIdx];
        
        // メインの状態同期
        MenuAllies.selectedChar = nextChar;
        MenuAllies.selectedUid = nextChar.uid;
        
        // ★修正点2: アーカイブ側（MenuAllyDetail）が存在する場合のみレンダリングを実行（堅牢化）
        if (window.MenuAllyDetail && typeof MenuAllyDetail.render === 'function') {
            MenuAllyDetail.selectedChar = nextChar;
            MenuAllyDetail.render();
        }
        
        const treeView = document.getElementById('allies-tree-view');
        if (treeView && treeView.style.display === 'flex') MenuAllies.renderTreeView();
        else MenuAllies.renderDetail();
    },
	
    getEquipFullDetailHTML: (eq) => {
		if (!eq) return '<span style="color:#555;">装備なし</span>';

		// ★数値の正負に応じて符号を1つだけ付与するヘルパー
		const fV = (v) => (v >= 0 ? `+${v}` : `${v}`);

		let stats = [];
		if (eq.data) {
			// 基礎ステータス (hp, mp, mdef, hit, cri, eva を含む)
			if (eq.data.atk)  stats.push(`攻${fV(eq.data.atk)}`);
			if (eq.data.def)  stats.push(`防${fV(eq.data.def)}`);
			if (eq.data.mag)  stats.push(`魔${fV(eq.data.mag)}`);
			if (eq.data.mdef) stats.push(`魔防${fV(eq.data.mdef)}`);
			if (eq.data.spd)  stats.push(`速${fV(eq.data.spd)}`);
			if (eq.data.hp)   stats.push(`HP${fV(eq.data.hp)}`);
			if (eq.data.mp)   stats.push(`MP${fV(eq.data.mp)}`);

			// 特殊ステータス
			if (eq.data.hit)    stats.push(`命中${fV(eq.data.hit)}%`);
			if (eq.data.cri)    stats.push(`会心${fV(eq.data.cri)}%`);
			if (eq.data.eva)    stats.push(`回避${fV(eq.data.eva)}%`);
			if (eq.data.finDmg) stats.push(`与ダメ${fV(eq.data.finDmg)}%`);
			if (eq.data.finRed) stats.push(`被ダメ${fV(-eq.data.finRed)}%`); // 被ダメージ軽減は負数で表現

			// 耐性・状態異常付与
			for (let key in eq.data) {
				if (key.startsWith('resists_')) {
					const label = (typeof Battle !== 'undefined' && Battle.statNames) ? (Battle.statNames[key.replace('resists_', '')] || key) : key;
					stats.push(`${label}耐${fV(eq.data[key])}%`);
				} else if (key.startsWith('attack_')) {
					const label = (typeof Battle !== 'undefined' && Battle.statNames) ? (Battle.statNames[key.replace('attack_', '')] || key) : key;
					stats.push(`攻撃時${eq.data[key]}%で${label}`);
				}
			}
		}

		// ★習得スキルを [] 形式の span にする (改行防止)
		let skillHTML = '';
		const gSkills = eq.grantSkills || (eq.data && eq.data.grantSkills);
		if (gSkills && Array.isArray(gSkills) && gSkills.length > 0) {
			const skillNames = gSkills.map(sid => {
				const sk = (typeof DB !== 'undefined' && DB.SKILLS) ? DB.SKILLS.find(s => s.id === sid) : null;
				return sk ? sk.name : `不明(${sid})`;
			});
			skillHTML = ` <span style="color:#ffff00; ">[習得:${skillNames.join(', ')}]</span>`;
		}
		
		// ★ベース名（杖、剣など）の表示用
		const baseNameHTML = eq.baseName ? `[${eq.baseName}] ` : '';

		// ステータスとスキルを同じ div に配置
		let baseHtml = `<div style="font-size:10px; color:#ccc; line-height:1.35;">${baseNameHTML}${stats.join(' ')}${skillHTML}</div>`;
		
		// オプション表示 (ここも fV を適用して符号重複を防止)
		let optsHtml = '';
		if (eq.opts && eq.opts.length > 0) {
			const optsList = eq.opts.map(o => {
				const color = Menu.getRarityColor(o.rarity || 'N');
				const unit = o.unit === 'val' ? '' : o.unit;
				return `<span style="color:${color}; font-size:10px; line-height:1.05; white-space:normal;">${o.label} ${fV(o.val)}${unit}</span>`;
			}).join('');
			optsHtml = `<div style="display:flex; flex-wrap:wrap; align-items:flex-start; gap:1px 8px; margin-top:3px; line-height:1.05;">${optsList}</div>`;
		}

		// 特性表示 (既存の青文字表示を維持)
		let traitHtml = '';
		if (eq.traits && eq.traits.length > 0) {
			const traitList = eq.traits.map(t => {
				const m = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.MASTER[t.id] : null;
				return m ? `<span style="display:inline-flex; align-items:center; color:#d9c4a1; background:rgba(24,14,8,0.72); border:1px solid rgba(232,178,91,0.30); border-radius:4px; padding:2px 6px; font-size:10px; line-height:1.2; white-space:nowrap;">${m.name} Lv${t.level}</span>` : '';
			}).join('');
			traitHtml = `<div style="display:flex; flex-wrap:wrap; gap:4px 6px; width:100%; box-sizing:border-box; margin-top:4px;">${traitList}</div>`;
		}

		// シナジー表示 (既存維持)
		let synHtml = '';
		if (typeof App !== 'undefined' && typeof App.checkSynergy === 'function') {
			const syns = App.checkSynergy(eq);
			if (syns && syns.length > 0) {
				synHtml = `<div style="display:flex; flex-wrap:wrap; gap:4px 6px; width:100%; box-sizing:border-box; margin-top:4px;">${syns.map(syn => 
					`<span style="display:inline-flex; align-items:center; color:${syn.color||'#f88'}; background:rgba(24,14,8,0.72); border:1px solid rgba(232,178,91,0.30); border-radius:4px; padding:2px 6px; font-size:10px; line-height:1.2; white-space:normal;">${syn.name}: ${syn.desc}</span>`
				).join('')}</div>`;
			}
		}
		
		return `<div>${baseHtml}${optsHtml}${traitHtml}${synHtml}</div>`;
	},

    buildEquipPreviewStats: (c, partLabel, item) => {
        if (!c || !partLabel || !item) return null;
        const dummy = JSON.parse(JSON.stringify(c));
        if (!dummy.equips) dummy.equips = {};
        const internalPart = MenuAllies.getEquipInternalPart(partLabel);
        dummy.equips[internalPart] = item.isRemove ? null : item;
        return {
            before: App.calcStats(c),
            after: App.calcStats(dummy)
        };
    },

    getEquipPreviewStatsHTML: (c, partLabel, item) => {
        const preview = MenuAllies.buildEquipPreviewStats(c, partLabel, item);
        if (!preview) return '';
        const rows = [
            [['攻', 'atk'], ['魔', 'mag'], ['防', 'def'], ['魔防', 'mdef'], ['速', 'spd']],
            [['会心', 'cri', '%'], ['命中', 'hit', '%'], ['回避', 'eva', '%'], ['与ダメ', 'finDmg', '%'], ['被ダメ', 'finRed', '%']]
        ];
        const chip = ([label, key, unit]) => {
            const before = Number(preview.before[key] || 0);
            const after = Number(preview.after[key] || 0);
            const diff = after - before;
            const color = diff > 0 ? '#62ff82' : (diff < 0 ? '#ff6464' : '#9a8a76');
            const sign = diff > 0 ? '+' : '';
            const value = Math.abs(diff) % 1 ? diff.toFixed(1) : String(diff);
            return `<span style="color:${color}; white-space:nowrap;">${label}${sign}${value}${unit || ''}</span>`;
        };
        return `
            <div style="display:flex; flex-direction:column; gap:2px; width:100%; box-sizing:border-box; margin-top:5px; padding-top:5px; border-top:1px dashed rgba(232,178,91,0.30); font-size:10px; line-height:1.35;">
                ${rows.map(row => `<div style="display:flex; flex-wrap:wrap; gap:4px 8px;">${row.map(chip).join('')}</div>`).join('')}
            </div>
        `;
    },
	
    renderDetail: () => {
        const c = MenuAllies.getSelectedChar();
        if (!c) {
            MenuAllies.renderList();
            return;
        }

        MenuAllies.selectedChar = c;
        MenuAllies.selectedUid = c.uid;

        MenuAllies.showDetailView();

        const s = App.calcStats(c);
        const PS = (typeof PassiveSkill !== 'undefined') ? PassiveSkill : null;

        if (!c.equips) c.equips = { '武器':null, '盾':null, '頭':null, '体':null, '足':null };
        if (typeof App !== 'undefined' && App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(c);
        else if (!c.config) c.config = { fullAuto: false, hiddenSkills: [], strategy: 'balanced' };
        if (!c.disabledTraits) c.disabledTraits = [];

        const imgUrl = App.getCharacterDisplayImage ? App.getCharacterDisplayImage(c) : c.img;
        const imageFallbackAttr = App.getCharacterImageOnErrorAttr ? App.getCharacterImageOnErrorAttr(c) : '';
        
        const hp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
        const mp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
        const lb = c.limitBreak || 0;
        const nextExp = App.getNextExp(c);
        const isMaxLevel = (c.level >= 100 || nextExp === Infinity);
        const remainingExp = isMaxLevel ? 0 : (nextExp - (c.exp || 0));
        const displayExp = isMaxLevel ? "MAX" : remainingExp.toLocaleString();

        window.toggleNameEdit = () => {
            const disp = document.getElementById('char-name-display');
            const edit = document.getElementById('char-name-edit');
            if(disp.style.display === 'none') { disp.style.display = 'flex'; edit.style.display = 'none'; }
            else { disp.style.display = 'none'; edit.style.display = 'flex'; }
        };
        window.saveName = () => {
            const input = document.getElementById('char-name-input');
            const newName = input.value.trim();
            if(newName.length > 0) {
                c.name = newName;
                App.save();
                Menu.renderPartyBar();
                MenuAllies.renderDetail();
            }
        };

        const imgHtml = MenuAllies.getCharacterSquareImageHtml
            ? MenuAllies.getCharacterSquareImageHtml(c, imgUrl, imageFallbackAttr, 'width:100%; height:100%;', 'border:0; border-radius:0;')
            : (imgUrl ? `<img src="${imgUrl}"${imageFallbackAttr} style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#888;">IMG</div>`);
        
        const tabs = ['基本', '装備', 'スキル', '特性'];
        const tabBtns = tabs.map((t, i) => {
            const idx = i + 1;
            const active = MenuAllies.currentTab === idx;
            const style = active
                ? 'background:#ffd700; color:#000; font-weight:bold;'
                : 'background:#111; color:#888;';
            return `<button onclick="MenuAllies.currentTab=${idx}; MenuAllies.targetPart=null; MenuAllies.selectedEquip=null; MenuAllies.renderDetail()" style="flex:1; border:none; padding:8px; font-size:12px; ${style}">${t}</button>`;
        }).join('');

        let contentHtml = '';
        
        if (MenuAllies.currentTab === 1) {
            let activeSynergies = [];
            if (c.equips) {
                Object.keys(c.equips).forEach(p => {
                    const eq = c.equips[p];
                    if (eq && eq.plus >= 3 && typeof App.checkSynergy === 'function') {
                        const syns = App.checkSynergy(eq);
                        if (syns && syns.length > 0) {
                            syns.forEach(syn => {
                                activeSynergies.push({ part: p, name: syn.name, desc: syn.desc, color: syn.color });
                            });
                        }
                    }
                });
            }

            let synergiesHtml = '';
            if (activeSynergies.length > 0) {
                synergiesHtml = `<div style="margin-top:5px; background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:4px; padding:5px;">
                    <div style="font-size:10px; color:#ffd700; margin-bottom:3px; text-align:center;">発動中のシナジー効果</div>
                    ${activeSynergies.map(syn => `<div style="font-size:10px; color:${syn.color||'#fff'}; margin-bottom:2px;">${syn.name}: ${syn.desc} </div>`).join('')}
                </div>`;
            }

            const totalAllocPt = Math.floor((lb || 0) / 10) * 10;
            const usedAllocPt = c.alloc ? Object.values(c.alloc).reduce((a, b) => a + b, 0) : 0;
            const freeAllocPt = Math.max(0, totalAllocPt - usedAllocPt);

            const allocBtn = (c.uid === 'p1') ? `<button class="btn" style="width:100%; margin-top:5px; background:#444400; font-size:11px;" onclick="MenuAllies.openAllocModal()">ボーナスPt振分 (残:${freeAllocPt})</button>` : '';
            const treeBtn = `<button class="btn" style="width:100%; margin-top:5px; background:#004444; font-size:11px;" onclick="MenuAllies.openTreeView()">スキル習得画面へ (SP:${c.sp||0})</button>`;
            const archiveBtn = `<button class="btn" style="width:100%; margin-top:5px; background:#602060; font-size:11px;" onclick="MenuAllyDetail.init(MenuAllies.getSelectedChar())">キャラクター詳細を見る</button>`;
            
            const ailmentLabels = { Poison:'毒', ToxicPoison:'猛毒', Shock:'感電', Fear:'怯え', Debuff:'弱体', InstantDeath:'即死', SkillSeal:'技封', SpellSeal:'魔封', HealSeal:'癒封' };

            contentHtml = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom:8px;">
                    <div style="background:#332222; border:1px solid #554444; border-radius:4px; padding:4px; text-align:center; font-size:11px;">
                        <div style="color:#aaa; font-size:9px;">与ダメージ</div><div style="color:#f88; font-weight:bold;">+${s.finDmg}%</div>
                    </div>
                    <div style="background:#222233; border:1px solid #444455; border-radius:4px; padding:4px; text-align:center; font-size:11px;">
                        <div style="color:#aaa; font-size:9px;">被ダメージ</div><div style="color:#88f; font-weight:bold;">-${s.finRed}%</div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px;">
                    <div style="background:#222; border:1px solid #444; border-radius:4px; padding:4px;">
                        <div style="font-size:9px; color:#f88; margin-bottom:3px; text-align:center; border-bottom:1px solid #333;">属性攻撃</div>
                        <div style="display:flex; flex-direction:column; gap:1px;">
                            ${CONST.ELEMENTS.map(e => `<div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:1px 3px; border-radius:2px; font-size:9px;"><span style="color:#aaa;">${e}</span><span>${s.elmAtk[e]||0}%</span></div>`).join('')}
                        </div>
                    </div>
                    <div style="background:#222; border:1px solid #444; border-radius:4px; padding:4px;">
                        <div style="font-size:9px; color:#88f; margin-bottom:3px; text-align:center; border-bottom:1px solid #333;">属性耐性</div>
                        <div style="display:flex; flex-direction:column; gap:1px;">
                            ${CONST.ELEMENTS.map(e => `<div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:1px 3px; border-radius:2px; font-size:9px;"><span style="color:#aaa;">${e}</span><span>${s.elmRes[e]||0}%</span></div>`).join('')}
                        </div>
                    </div>
                    <div style="background:#222; border:1px solid #444; border-radius:4px; padding:4px;">
                        <div style="font-size:9px; color:#f8f; margin-bottom:3px; text-align:center; border-bottom:1px solid #333;">異常耐性</div>
                        <div style="display:flex; flex-direction:column; gap:1px;">
                            ${Object.keys(ailmentLabels).map(key => `<div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:1px 3px; border-radius:2px; font-size:9px;"><span style="color:#aaa;">${ailmentLabels[key]}</span><span>${(s.resists && s.resists[key])||0}%</span></div>`).join('')}
                        </div>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; margin-top:0px;">
                    ${synergiesHtml}
                </div>
                <div style="display:flex; flex-direction:column; margin-top:5px;">
                    ${treeBtn}
                    ${allocBtn}
                    ${archiveBtn}
                </div>`;
        } else if (MenuAllies.currentTab === 2) {
			// --- 装備タブ (堅牢化 + 精度統一 + 属性比較完全版) ---
			const PS = (typeof PassiveSkill !== 'undefined') ? PassiveSkill : null;
			const hasDualWield = PS ? PS.getSumValue(c, 'dual_dmg_base') > 0 : false;
			const hasTwoHanded = PS ? PS.getSumValue(c, 'two_handed') > 0 : false;

			if (MenuAllies.targetPart) {
				if (MenuAllies.selectedEquip) {
					// --- 1) 変更確認画面 ---
					const newItem = MenuAllies.selectedEquip;
					const isRemove = newItem.isRemove;
					const dummy = JSON.parse(JSON.stringify(c));
					
					// 3) dummy.equips の存在を1行で保証
					if (!dummy.equips) dummy.equips = { '武器':null, '盾':null, '頭':null, '体':null, '足':null };
					
					const partToUse = (MenuAllies.targetPart === '武器2') ? '盾' : MenuAllies.targetPart;

					if (isRemove) dummy.equips[partToUse] = null;
					else dummy.equips[partToUse] = newItem;
					
					const sCur = App.calcStats(c);
					const sNew = App.calcStats(dummy);

					const statRow = (label, key, isPercent=false, isReduc=false) => {
						let v1, v2;
						// 1) 最小修正: elmAtk / elmRes のときだけネスト扱いにする
						const isNested = key.startsWith('elmAtk_') || key.startsWith('elmRes_');
						if (isNested) {
							const [prop, subKey] = key.split('_');
							v1 = (sCur[prop] && sCur[prop][subKey]) || 0;
							v2 = (sNew[prop] && sNew[prop][subKey]) || 0;
						} else {
							v1 = sCur[key] || 0;
							v2 = sNew[key] || 0;
						}

						const diff = v2 - v1;
						// 2) 最小修正: 表示精度を統一 (percentの時は全て丸める)
						const fmt = (val) => isPercent ? Number(val).toFixed(1) : val;
						
						let color = diff > 0 ? '#4f4' : (diff < 0 ? '#f44' : '#888');
						if (isReduc) color = diff < 0 ? '#4f4' : (diff > 0 ? '#f44' : '#888');
						const diffStr = (diff === 0) ? '±0' : (diff > 0 ? '+' : '') + fmt(diff);
						
						return `<div style="font-size:11px; background:#2c2c2c; padding:4px; border-radius:2px; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
							<div style="color:#aaa; font-size:10px; text-align:center; font-weight:bold;">${label}</div>
							<div style="text-align:center;">
								<span style="color:#888; font-size:10px;">${fmt(v1)}${isPercent?'%':''} →</span> 
								<span style="color:${color}; font-weight:bold;">${fmt(v2)}${isPercent?'%':''}</span> 
								<span style="font-size:9px; color:${color};">(${diffStr}${isPercent?'%':''})</span>
							</div>
						</div>`;
					};

					let statRows = '';
					const gridStart = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:8px;">';
					const gridEnd = '</div>';

					statRows += gridStart + statRow('HP', 'maxHp') + statRow('MP', 'maxMp') + gridEnd;
					statRows += gridStart + statRow('攻撃力', 'atk') + statRow('防御力', 'def') + gridEnd;
					statRows += gridStart + statRow('魔力', 'mag') + statRow('素早さ', 'spd') + gridEnd;
					statRows += gridStart + statRow('魔法防御', 'mdef') + statRow('命中率', 'hit', true) + gridEnd;
					statRows += gridStart + statRow('回避率', 'eva', true) + statRow('会心率', 'cri', true) + gridEnd;
					statRows += gridStart + statRow('与ダメージ', 'finDmg', true, false) + statRow('被ダメ軽減', 'finRed', true, false) + gridEnd;

					if (typeof CONST !== 'undefined' && CONST.ELEMENTS) {
						CONST.ELEMENTS.forEach(e => {
							statRows += gridStart + statRow(`${e}攻撃`, `elmAtk_${e}`, true, false) + statRow(`${e}耐性`, `elmRes_${e}`, true, false) + gridEnd;
						});
					}

					const buttonsHtml = `<div style="display:flex; gap:10px; margin: 10px 0;"><button class="btn" style="flex:1; background:#555;" onclick="MenuAllies.selectedEquip=null; MenuAllies.renderDetail()">やめる</button><button class="btn" style="flex:1; background:#d00;" onclick="MenuAllies.doEquip()">変更する</button></div>`;
					contentHtml = `<div style="padding:10px; text-align:center; color:#ffd700; font-weight:bold; border-bottom:1px solid #444;">装備変更の確認 (${MenuAllies.targetPart})</div>
						<div style="padding:5px; text-align:center; font-size:14px; color:${isRemove?'#aaa':Menu.getRarityColor(newItem.rarity)}; margin-bottom:3px;">${isRemove?'(装備を外す)':newItem.name} に変更しますか？</div>
						${buttonsHtml}<div style="background:#222; border:1px solid #444; border-radius:4px; margin-bottom:10px; padding:10px;">${statRows}</div>${buttonsHtml}`;

				} else {
					// --- 4) 候補抽出ロジック ---
				const p = MenuAllies.targetPart;

				// 「この画面で探す装備の種別」を決める
				// - 武器 / 武器2 はどちらも “武器候補” を出す
				// - それ以外は部位名そのまま
				const requiredType = (p === '武器' || p === '武器2') ? '武器' : p;

				const rules = (typeof DB !== 'undefined' && DB.OPT_RULES) ? DB.OPT_RULES : [];
				let candidates = [{ id: 'remove', name: '(装備を外す)', isRemove: true, _originalIdx: -999 }];

				// 1) インベントリから抽出（typeの表記ゆれ: weapon も武器扱い）
				App.data.inventory
				  .filter(i => i.type === requiredType || (requiredType === '武器' && i.type === 'weapon'))
				  .forEach((i, idx) => candidates.push({ ...i, _originalIdx: idx }));

				// 2) 他キャラ装備から抽出（不整合防止）
				//   - requiredType === '武器' のときだけ「武器スロット」「盾スロット武器(=武器2)」を拾う
				//   - 盾を探しているときは「盾(type==='盾')」だけ拾う（武器2を混ぜない）
				App.data.characters.forEach(other => {
				  if (other.uid === c.uid || !other.equips) return;

				  if (requiredType === '武器') {
					// 他キャラの武器スロット
					if (other.equips['武器']) {
					  candidates.push({ ...other.equips['武器'], owner: other.name, _originalIdx: -1 });
					}
					// 他キャラの盾スロットが武器なら「武器2」
					if (other.equips['盾'] && (other.equips['盾'].type === '武器' || other.equips['盾'].type === 'weapon')) {
					  candidates.push({ ...other.equips['盾'], owner: other.name + '(武器2)', _originalIdx: -1 });
					}
				  } else if (requiredType === '盾') {
					// “本物の盾” だけ（武器2は混ぜない）
					if (other.equips['盾'] && other.equips['盾'].type === '盾') {
					  candidates.push({ ...other.equips['盾'], owner: other.name, _originalIdx: -1 });
					}
				  } else {
					// その他部位はそのまま
					if (other.equips[requiredType]) {
					  candidates.push({ ...other.equips[requiredType], owner: other.name, _originalIdx: -1 });
					}
				  }
				});

				// 3) フィルタ（既存仕様維持）
				if (MenuAllies.candidateFilter !== 'ALL') {
				  candidates = candidates.filter(item => {
					if (item.isRemove) return true;
					if (!item.opts) return false;
					return item.opts.some(o => (o.key + (o.elm ? '_' + o.elm : '')) === MenuAllies.candidateFilter);
				  });
				}

				// 4) ソート（既存仕様維持）
				const rarityOrder = { EX: 6, UR: 5, SSR: 4, SR: 3, R: 2, N: 1 };
				candidates.sort((a, b) => {
				  if (a.isRemove) return -1;
				  if (b.isRemove) return 1;

				  if (MenuAllies.candidateSortMode === 'RANK') {
					if ((b.rank || 0) !== (a.rank || 0)) return (b.rank || 0) - (a.rank || 0);
					const rA = rarityOrder[a.rarity] || 0;
					const rB = rarityOrder[b.rarity] || 0;
					if (rB !== rA) return rB - rA;
					return (b.plus || 0) - (a.plus || 0);
				  }
				  return (b._originalIdx || 0) - (a._originalIdx || 0);
				});

				// 5) 描画用に保持
				MenuAllies._tempCandidates = candidates;

				// 6) HTML（ここはあなたの既存のままでOK）
					contentHtml = `<div style="margin-bottom:8px; display:flex; flex-direction:column; gap:4px;"><div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-weight:bold; color:#ffd700;">${p} の変更</span><button class="btn" style="background:#555; font-size:10px; padding:2px 8px;" onclick="MenuAllies.targetPart=null; MenuAllies.renderDetail()">もどる</button></div>
						<div style="display:flex; gap:4px; align-items:center;"><select style="background:#333; color:#fff; font-size:10px; flex:1; height:20px; touch-action:auto; user-select:auto; -webkit-user-select:auto;" ${Menu.selectTouchAttrs()} onchange="MenuAllies.candidateFilter=this.value; MenuAllies.renderDetail()"><option value="ALL">全ての効果</option>${rules.map(opt => `<option value="${opt.key}${opt.elm?'_'+opt.elm:''}" ${MenuAllies.candidateFilter===(opt.key+(opt.elm?'_'+opt.elm:''))?'selected':''}>${opt.name}</option>`).join('')}</select>
						<select style="background:#333; color:#fff; font-size:10px; flex:1; height:20px; touch-action:auto; user-select:auto; -webkit-user-select:auto;" ${Menu.selectTouchAttrs()} onchange="MenuAllies.candidateSortMode=this.value; MenuAllies.renderDetail()"><option value="RANK" ${MenuAllies.candidateSortMode==='RANK'?'selected':''}>Rank順</option><option value="NEWEST" ${MenuAllies.candidateSortMode==='NEWEST'?'selected':''}>取得順</option></select></div></div>
						<div style="display:flex; flex-direction:column; gap:2px;">${candidates.map((item, idx) => `<div class="list-item" style="flex-direction:column; align-items:flex-start;" onclick="MenuAllies.selectCandidate(${idx}, ${item.isRemove?'true':'false'})"><div style="font-weight:bold; color:${item.isRemove ? '#aaa' : Menu.getRarityColor(item.rarity)};">${item.name} ${item.owner ? `<span style="color:#f88; font-size:9px;">[${item.owner}装備中]</span>` : ''}</div>${!item.isRemove ? MenuAllies.getEquipFullDetailHTML(item) : ''}</div>`).join('')}</div>`;
				}
			} else {
                let listHtml = '';
                const parts = ['武器', '盾', '頭', '体', '足'];
                parts.forEach(p => {
                    let label = p;
                    let isLocked = false;
                    let eq = (c.equips || {})[p];
                    if (p === '盾') {
                        if (hasTwoHanded) { label = '盾(不可)'; isLocked = true; }
                        else if (hasDualWield) { label = '武器2'; }
                    }
                    const rarityColor = eq ? Menu.getRarityColor(eq.rarity) : '#888';
                    const onclick = isLocked ? '' : `onclick="MenuAllies.openEquipModal('${label}')"`;
                    listHtml += `<div class="list-item" style="align-items:center; opacity:${isLocked?0.5:1};" ${onclick}>
                        <div style="width:40px; font-size:10px; color:#aaa; font-weight:bold;">${label}</div>
                        <div style="flex:1;">
                            <div style="font-size:12px; font-weight:bold; color:${rarityColor};">${eq ? eq.name : (isLocked ? '両手持ち中' : 'なし')}</div>
                            ${eq ? MenuAllies.getEquipFullDetailHTML(eq) : ''}
                        </div>
                        <div style="font-size:10px; color:#aaa; margin-left:5px;">${isLocked ? '' : '変更 >'}</div>
                    </div>`;
                });

                // ★修正点3: 魔法防御、命中、回避、会心のステータスサマリーを復活
                const summaryHtml = `
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-bottom:10px; background:#1a1a1a; padding:5px; border-radius:4px; border:1px solid #333;">
                        <div style="font-size:10px; color:#aaa;">　　命中率: <span style="color:#fff;">${s.hit}%</span></div>
                        <div style="font-size:10px; color:#aaa;">　　回避率: <span style="color:#fff;">${s.eva}%</span></div>
                        <div style="font-size:10px; color:#aaa;">　　会心率: <span style="color:#fff;">${s.cri}%</span></div>
                    </div>`;

                contentHtml = summaryHtml + `<div style="display:flex; flex-direction:column; gap:2px;">${listHtml}</div>`;
            }
        } else if (MenuAllies.currentTab === 3) {
            const playerObj = new Player(c);
            let skillHtml = (!playerObj.skills || playerObj.skills.length === 0) 
                ? '<div style="padding:20px; text-align:center; color:#555;">習得スキルなし</div>'
                : playerObj.skills.map(sk => {
                    if (sk.id === 1) return '';
                    const isHidden = c.config.hiddenSkills.includes(Number(sk.id));
                    let elmHtml = sk.elm ? `<span style="color:${{'火':'#f88','水':'#88f','雷':'#ff0','風':'#8f8','光':'#ffc','闇':'#a8f','混沌':'#d4d'}[sk.elm]||'#ccc'}; margin-right:3px;">[${sk.elm}]</span>` : '';
                    return `
                        <div style="background:${isHidden ? 'rgba(0,0,0,0.2)' : '#252525'}; border:1px solid #444; border-radius:4px; padding:6px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                            <div style="flex:1; cursor:pointer;" onclick="MenuSkillDetail.open(${sk.id}, ${JSON.stringify(playerObj.skills).replace(/"/g, '&quot;')})">
                                <div style="font-size:12px; font-weight:bold; color:${isHidden ? '#666' : '#ddd'};">${sk.name} <span style="font-size:10px; color:#888;">(${sk.type})</span></div>
                                <div style="font-size:10px; color:#aaa;">${elmHtml}${sk.desc || ''}</div>
                            </div>
                            <div style="text-align:right; min-width:80px;">
                                <div style="font-size:11px; color:#88f; margin-bottom:4px;">MP:${sk.mp}</div>
                                <button class="btn" style="padding:2px 8px; font-size:10px; background:${isHidden ? '#555' : '#3a3'};" onclick="event.stopPropagation(); MenuAllies.toggleSkillVisibility(${sk.id})">${isHidden ? '封印中' : '使用許可'}</button>
                            </div>
                        </div>`;
                }).join('');
            contentHtml = `<div id="skill-list-container" style="display:flex; flex-direction:column;">${skillHtml}</div>`;
        } else if (MenuAllies.currentTab === 4) {
			// --- 特性タブ (取得順 -> 装備品の順) ---
			const PS = (typeof PassiveSkill !== 'undefined') ? PassiveSkill : null;
			const listData = [];

			// 1) 自力習得 (取得順を維持)
			if (c.traits) {
				c.traits.forEach((t, index) => { // indexを取得
					const m = PS ? PS.MASTER[t.id] : null;
					if (m) {
						listData.push({ 
							...m, 
							lv: t.level, 
							isEquip: false, 
							id: t.id,
							slotIndex: index // ★ここが詳細画面の判定に必須です
						});
					}
				});
			}

			// 2) 装備品由来 (同一特性はレベルを合算)
			if (c.equips) {
				// IDをキーにして合算用の一時オブジェクトを作成
				const equipTraitMap = {};

				Object.values(c.equips).forEach(eq => {
					if (eq && eq.traits) {
						eq.traits.forEach(t => {
							const m = PS ? PS.MASTER[t.id] : null;
							if (!m) return;

							if (equipTraitMap[t.id]) {
								// 既にマップにある場合はLvを加算し、装備名を追記
								equipTraitMap[t.id].lv += t.level;
								if (!equipTraitMap[t.id].sourceItems.includes(eq.name)) {
									equipTraitMap[t.id].sourceItems.push(eq.name);
								}
							} else {
								// 新規登録
								equipTraitMap[t.id] = {
									...m,
									lv: t.level,
									isEquip: true,
									id: t.id,
									sourceItems: [eq.name]
								};
							}
						});
					}
				});

				// 合算したオブジェクトを配列に変換して listData に追加
				Object.values(equipTraitMap).forEach(data => {
					// 複数の装備から来ている場合は名前をカンマ区切りにする
					data.eqName = data.sourceItems.join(', ');
					listData.push(data);
				});
			}

			MenuAllies.currentTraitListData = listData;

			const traitListHtml = listData.map((t, index) => {
				// 自力習得分のみ無効化判定
				const isDisabled = !t.isEquip && c.disabledTraits.includes(t.id);
				
				// 装備由来は常にON（固定）扱い。合算されている場合はシアン色
				const statusColor = t.isEquip ? '#00ffff' : (isDisabled ? '#666' : '#ffd700');
				
				// 操作ボタンの構築
				let buttonHtml = '';
				if (t.isEquip) {
					// 装備由来は「装備固定」として表示し、クリック不可
					buttonHtml = `<div style="padding:2px 10px; font-size:10px; background:#222; border:1px solid #00ffff; color:#00ffff; border-radius:3px; opacity:0.8;">装備固定</div>`;
				} else {
					// 自力習得はトグル可能
					buttonHtml = `
						<button class="btn" style="padding:2px 10px; font-size:10px; background:${isDisabled ? '#444' : '#060'}; color:#fff;" 
								onclick="event.stopPropagation(); MenuAllies.toggleTrait(${t.id}); return false;">
							${isDisabled ? 'OFF' : 'ON'}
						</button>`;
				}

				return `
				<div style="background:#252525; border:1px solid ${t.isEquip ? '#00ffff44' : '#444'}; border-radius:4px; padding:8px; margin-bottom:6px; cursor:pointer;" 
					 onclick="MenuTraitDetail.open(${index}, MenuAllies.currentTraitListData)">
					<div style="display:flex; justify-content:space-between; align-items:flex-start;">
						<div>
							<span style="font-weight:bold; color:${statusColor}; font-size:13px;">${t.name} Lv.${t.lv}</span>
							${t.isEquip ? `<span style="font-size:8px; color:#00ffff; margin-left:4px;">[${t.eqName}]</span>` : ''}
							<span style="font-size:9px; color:#888; margin-left:5px;">(${t.type})</span>
						</div>
						${buttonHtml}
					</div>
					<div style="font-size:11px; color:${isDisabled ? '#555' : '#ccc'}; margin-top:4px; line-height:1.3;">
						${t.effect || '効果情報なし'}
					</div>
				</div>`;
			}).join('');

			contentHtml = `<div style="display:flex; flex-direction:column;">${traitListHtml || '<div style="text-align:center; color:#555; padding:20px;">有効な特性がありません</div>'}</div>`;
		}
		
        const detailContent = MenuAllies.ensureDetailContent();
        if (!detailContent) return;

        detailContent.innerHTML = `
            <div class="scroll-container-inner" style="height:100%; overflow-y:auto; padding:10px; font-family:sans-serif; color:#ddd; box-sizing:border-box;">
                <div class="ally-detail-nav-wrap" style="background:#222; border-bottom:1px solid #444; margin:-10px -10px 10px -10px; padding:10px;">
                    <div class="ally-detail-nav-row" style="display:flex; justify-content:space-between; align-items:center; background:#333; padding:5px; border-radius:4px;">
                        <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuAllies.switchChar(-1)">＜ 前</button>
                        <span style="font-size:12px; color:#aaa;">仲間詳細</span>
                        <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuAllies.switchChar(1)">次 ＞</button>
                    </div>
                </div>

                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <div style="position:relative; width:80px; height:80px; background:#000; border:1px solid #555; display:flex; align-items:center; justify-content:center; flex-shrink:0; border-radius:4px;">
                        <div style="width:100%; height:100%; cursor:pointer;" onclick="MenuAllies.openImageActionModal('${c.uid}')">
                            ${imgHtml}
                            <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.6); color:#fff; font-size:8px; text-align:center; padding:2px 0;">画像操作</div>
                        </div>
                        ${(MenuAllies.hasResettableImage ? MenuAllies.hasResettableImage(c) : (App.hasCustomCharacterImage ? App.hasCustomCharacterImage(c) : !!c.img)) ? `<div onclick="event.stopPropagation(); MenuAllies.resetImage('${c.uid}')" style="position:absolute; top:-5px; right:-5px; width:20px; height:20px; background:#d00; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; border:1px solid #fff; cursor:pointer; z-index:10;">×</div>` : ''}
                    </div>

                    <input type="file" id="file-upload-${c.uid}" style="display:none" accept="image/*" onchange="MenuAllies.uploadImage(this, '${c.uid}')">

                    <div style="flex:1;">
                        <div id="char-name-display" style="display:flex; align-items:center; margin-bottom:2px;">
                            <div style="font-size:16px; font-weight:bold; color:#fff; margin-right:5px;">${c.name}</div>
                            <div style="font-size:12px; color:#f0f; font-weight:bold;">+${lb}</div>
                            <button class="btn" style="margin-left:auto; padding:0 6px; font-size:10px;" onclick="window.toggleNameEdit()">✎</button>
                        </div>

                        <div id="char-name-edit" style="display:none; align-items:center; margin-bottom:2px;">
                            <input type="text" id="char-name-input" value="${c.name}" maxlength="10" style="width:100px; background:#333; color:#fff; border:1px solid #888; padding:2px; font-size:12px;">
                            <button class="btn" style="margin-left:5px; padding:2px 6px; font-size:10px;" onclick="window.saveName()">OK</button>
                        </div>

                        <div style="font-size:11px; color:#aaa; margin-bottom:4px;">${c.job} Lv.${c.level} / ${c.rarity} Rank${c.reincarnationCount > 0 ? `  ★${c.reincarnationCount}` : ''}</div>

                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">
                            <div style="background:#333; padding:2px 4px; border-radius:3px; line-height:1.1;">
                                <div style="font-size:8px; color:#aaa;">HP</div>
                                <div style="color:#8f8; text-align:center; line-height:1"><span style="font-weight:bold; font-size:12px;">${hp}</span></div>
                                <div style="text-align:right; margin-top:-4px;"><span style="font-size:9px; color:#aaa; opacity:0.8;">/ ${s.maxHp}</span></div>
                            </div>

                            <div style="background:#333; padding:2px 4px; border-radius:3px; line-height:1.1;">
                                <div style="font-size:8px; color:#aaa;">MP</div>
                                <div style="color:#88f; text-align:center; line-height:1;"><span style="font-weight:bold; font-size:12px;">${mp}</span></div>
                                <div style="text-align:right; margin-top:-4px;"><span style="font-size:9px; color:#aaa; opacity:0.8;">/ ${s.maxMp}</span></div>
                            </div>

                            <div style="background:#333; padding:2px 4px; border-radius:3px; line-height:1.1;">
                                <div style="font-size:8px; color:#aaa;">NextExp</div>
                                <div style="text-align:center; padding-top:2px;"><span style="font-weight:bold; font-size:12px;">${displayExp}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:3px; margin-top:5px; margin-bottom:12px;">
                    <div style="background:#333; padding:5px 0; text-align:center; line-height:1;"><span style="font-size:9px; color:#aaa; display:block; margin-bottom:2px;">攻撃力</span><span style="font-weight:bold; font-size:11px; display:block;">${s.atk}</span></div>
                    <div style="background:#333; padding:5px 0; text-align:center; line-height:1;"><span style="font-size:9px; color:#aaa; display:block; margin-bottom:2px;">防御力</span><span style="font-weight:bold; font-size:11px; display:block;">${s.def}</span></div>
                    <div style="background:#333; padding:5px 0; text-align:center; line-height:1;"><span style="font-size:9px; color:#aaa; display:block; margin-bottom:2px;">魔力</span><span style="font-weight:bold; font-size:11px; display:block;">${s.mag}</span></div>
                    <div style="background:#333; padding:5px 0; text-align:center; line-height:1;"><span style="font-size:9px; color:#aaa; display:block; margin-bottom:2px;">魔防</span><span style="font-weight:bold; font-size:11px; display:block;">${s.mdef}</span></div>
                    <div style="background:#333; padding:5px 0; text-align:center; line-height:1;"><span style="font-size:9px; color:#aaa; display:block; margin-bottom:2px;">素早さ</span><span style="font-weight:bold; font-size:11px; display:block;">${s.spd}</span></div>
                </div>

                <div style="display:flex; margin-bottom:10px;">${tabBtns}</div>
                <div>${contentHtml}</div>
            </div>
        `;

        Menu.makeSelectTouchSafe(detailContent);
    },
	
    toggleTrait: (traitId) => {
        const c = MenuAllies.selectedChar;
        if (!c) return;

        // ★保存：スキルの実装と同じセレクタを使用
        const selector = '#allies-detail-view .scroll-container-inner';
        const container = document.querySelector(selector);
        const scrollPos = container ? container.scrollTop : 0;

        // 特性ON/OFFの切り替え
        if (!c.disabledTraits) c.disabledTraits = [];
        const idx = c.disabledTraits.indexOf(traitId);
        if (idx >= 0) c.disabledTraits.splice(idx, 1);
        else c.disabledTraits.push(traitId);

        // 特性変更に伴う装備の強制解除ロジック（最新の状態を反映）
        const PS = (typeof PassiveSkill !== 'undefined') ? PassiveSkill : null;
        if (PS) {
            const hasDualWield = PS.getSumValue(c, 'dual_dmg_base') > 0;
            const hasTwoHanded = PS.getSumValue(c, 'two_handed') > 0;

            const sub = c.equips['盾']; // 盾スロット（左手）
            if (sub) {
                const isSubWeapon = (sub.type === '武器' || sub.type === 'weapon');
                const isSubShield = (sub.type === '盾');
                
                let forceRemove = false;
                if (hasTwoHanded) {
                    forceRemove = true; // 両手持ち：一切不可
                } else if (hasDualWield) {
                    if (isSubShield) forceRemove = true; // 二刀流：盾は不可
                } else {
                    if (isSubWeapon) forceRemove = true; // 通常：武器は不可
                }

                if (forceRemove) {
                    App.data.inventory.push(sub);
                    c.equips['盾'] = null;
                }
            }
        }

        // データの保存
        App.save();

        // 画面の再描画
        MenuAllies.renderDetail();
        Menu.renderPartyBar();

        // ★復元：再描画によって生成された新しいコンテナに対して位置を適用
        const newContainer = document.querySelector(selector);
        if (newContainer) {
            newContainer.scrollTop = scrollPos;
        }
    },
	
    getEquipInternalPart: (label) => label === '武器2' ? '盾' : label,

    getEquipRequiredType: (label) => (label === '武器' || label === '武器2') ? '武器' : label,

    buildEquipCandidates: (partLabel) => {
        const c = MenuAllies.getSelectedChar();
        if (!c) return { candidates: [], rules: [] };
        if (!c.equips) c.equips = { '武器':null, '盾':null, '頭':null, '体':null, '足':null };

        const requiredType = MenuAllies.getEquipRequiredType(partLabel);
        const rules = (typeof DB !== 'undefined' && DB.OPT_RULES) ? DB.OPT_RULES : [];
        let candidates = [{ id: 'remove', name: '(装備を外す)', isRemove: true, _originalIdx: -999 }];

        App.data.inventory
            .filter(i => i.type === requiredType || (requiredType === '武器' && i.type === 'weapon'))
            .forEach((i, idx) => candidates.push({ ...i, _originalIdx: idx }));

        App.data.characters.forEach(other => {
            if (other.uid === c.uid || !other.equips) return;

            if (requiredType === '武器') {
                if (other.equips['武器']) {
                    candidates.push({ ...other.equips['武器'], owner: other.name, _originalIdx: -1 });
                }
                if (other.equips['盾'] && (other.equips['盾'].type === '武器' || other.equips['盾'].type === 'weapon')) {
                    candidates.push({ ...other.equips['盾'], owner: other.name + '(武器2)', _originalIdx: -1 });
                }
            } else if (requiredType === '盾') {
                if (other.equips['盾'] && other.equips['盾'].type === '盾') {
                    candidates.push({ ...other.equips['盾'], owner: other.name, _originalIdx: -1 });
                }
            } else if (other.equips[requiredType]) {
                candidates.push({ ...other.equips[requiredType], owner: other.name, _originalIdx: -1 });
            }
        });

        if (MenuAllies.candidateFilter !== 'ALL') {
            candidates = candidates.filter(item => {
                if (item.isRemove) return true;
                if (!item.opts) return false;
                return item.opts.some(o => (o.key + (o.elm ? '_' + o.elm : '')) === MenuAllies.candidateFilter);
            });
        }

        const rarityOrder = { EX: 6, UR: 5, SSR: 4, SR: 3, R: 2, N: 1 };
        candidates.sort((a, b) => {
            if (a.isRemove) return -1;
            if (b.isRemove) return 1;

            if (MenuAllies.candidateSortMode === 'RANK') {
                if ((b.rank || 0) !== (a.rank || 0)) return (b.rank || 0) - (a.rank || 0);
                const rA = rarityOrder[a.rarity] || 0;
                const rB = rarityOrder[b.rarity] || 0;
                if (rB !== rA) return rB - rA;
                return (b.plus || 0) - (a.plus || 0);
            }
            return (b._originalIdx || 0) - (a._originalIdx || 0);
        });

        MenuAllies._tempCandidates = candidates;
        return { candidates, rules };
    },

    ensureEquipModal: () => {
        let modal = document.getElementById('ally-equip-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'ally-equip-modal';
        const partyHost = MenuAllies.partyEquipContext && typeof MenuParty !== 'undefined' && MenuParty.getModalHost
            ? MenuParty.getModalHost()
            : (document.getElementById('sub-screen-allies') || document.body);
        if (partyHost !== document.body) {
            const position = window.getComputedStyle ? window.getComputedStyle(partyHost).position : partyHost.style.position;
            if (!position || position === 'static') partyHost.style.position = 'relative';
        }
        const modalPosition = partyHost === document.body ? 'fixed' : 'absolute';
        modal.style.cssText = `position:${modalPosition}; inset:0; z-index:3200; background:rgba(0,0,0,0.76); display:flex; align-items:stretch; justify-content:stretch; padding:0; box-sizing:border-box;`;
        modal.onclick = () => MenuAllies.closeEquipModal();
        modal.innerHTML = `
            <div onclick="event.stopPropagation()" style="width:100%; height:100%; max-height:100%; display:flex; flex-direction:column; background:#111; border:1px solid #777; border-radius:8px; box-shadow:0 18px 48px rgba(0,0,0,0.7); overflow:hidden; box-sizing:border-box;">
                <div id="ally-equip-modal-header" style="flex:0 0 auto; display:flex; justify-content:space-between; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid #333; background:#1b1b1b;"></div>
                <div id="ally-equip-modal-content" style="flex:1 1 auto; min-height:0; overflow:auto; padding:10px;"></div>
                <div id="ally-equip-modal-footer" style="flex:0 0 auto; padding:10px 12px; border-top:1px solid #333; background:#161616;">
                    <button class="btn" style="width:100%; background:#555;" onclick="MenuAllies.closeEquipModal()">閉じる</button>
                </div>
            </div>
        `;
        partyHost.appendChild(modal);
        return modal;
    },

    openEquipModal: (partLabel) => {
        MenuAllies.targetPart = partLabel;
        MenuAllies.selectedEquip = null;
        MenuAllies.equipModalOpen = true;
        MenuAllies.renderEquipModalList();
    },

    closeEquipModal: (rerender = true) => {
        const modal = document.getElementById('ally-equip-modal');
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
        MenuAllies.equipModalOpen = false;
        MenuAllies.targetPart = null;
        MenuAllies.selectedEquip = null;
        if (rerender && MenuAllies.partyEquipContext && typeof MenuParty !== 'undefined') {
            MenuParty.renderEquipmentModal();
            MenuParty.renderEquipmentList();
            return;
        }
        if (rerender) MenuAllies.renderDetail();
    },

    renderEquipModalList: () => {
        const c = MenuAllies.getSelectedChar();
        const partLabel = MenuAllies.targetPart;
        if (!c || !partLabel) return;

        const modal = MenuAllies.ensureEquipModal();
        const header = modal.querySelector('#ally-equip-modal-header');
        const content = modal.querySelector('#ally-equip-modal-content');
        const footer = modal.querySelector('#ally-equip-modal-footer');
        const { candidates, rules } = MenuAllies.buildEquipCandidates(partLabel);
        content.dataset.mode = 'list';

        header.innerHTML = `
            <div style="min-width:0;">
                <div style="font-weight:bold; color:#ffd700;">${MenuAllies.escapeHtml(partLabel)} の変更</div>
                <div style="font-size:11px; color:#aaa; margin-top:2px;">${MenuAllies.escapeHtml(c.name)} / ${MenuAllies.escapeHtml(c.job || '')}</div>
            </div>
            <button class="btn" style="flex:0 0 auto; padding:4px 10px; background:#555;" onclick="MenuAllies.closeEquipModal()">閉じる</button>
        `;

        content.innerHTML = `
            <div style="display:flex; gap:5px; align-items:center; margin-bottom:8px;">
                <select style="background:#333; color:#fff; font-size:11px; flex:1; height:28px; touch-action:auto; user-select:auto; -webkit-user-select:auto;" ${Menu.selectTouchAttrs()} onchange="MenuAllies.candidateFilter=this.value; MenuAllies.renderEquipModalList()">
                    <option value="ALL">全ての効果</option>
                    ${rules.map(opt => `<option value="${opt.key}${opt.elm?'_'+opt.elm:''}" ${MenuAllies.candidateFilter===(opt.key+(opt.elm?'_'+opt.elm:''))?'selected':''}>${MenuAllies.escapeHtml(opt.name)}</option>`).join('')}
                </select>
                <select style="background:#333; color:#fff; font-size:11px; flex:0 0 112px; height:28px; touch-action:auto; user-select:auto; -webkit-user-select:auto;" ${Menu.selectTouchAttrs()} onchange="MenuAllies.candidateSortMode=this.value; MenuAllies.renderEquipModalList()">
                    <option value="RANK" ${MenuAllies.candidateSortMode==='RANK'?'selected':''}>Rank順</option>
                    <option value="NEWEST" ${MenuAllies.candidateSortMode==='NEWEST'?'selected':''}>取得順</option>
                </select>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                ${candidates.map((item, idx) => `
                    <div class="list-item" style="flex-direction:column; align-items:flex-start; padding:9px;" onclick="MenuAllies.selectCandidate(${idx}, ${item.isRemove?'true':'false'})">
                        <div style="font-weight:bold; color:${item.isRemove ? '#aaa' : Menu.getRarityColor(item.rarity)};">
                            ${MenuAllies.escapeHtml(item.name)}
                            ${item.owner ? `<span style="color:#f88; font-size:9px;">[${MenuAllies.escapeHtml(item.owner)}装備中]</span>` : ''}
                        </div>
                        ${!item.isRemove ? MenuAllies.getEquipFullDetailHTML(item) : ''}
                        ${MenuAllies.getEquipPreviewStatsHTML(c, partLabel, item)}
                    </div>
                `).join('')}
            </div>
        `;
        if (footer) {
            footer.innerHTML = `<button class="btn" style="width:100%; background:#555;" onclick="MenuAllies.closeEquipModal()">閉じる</button>`;
        }
        if (typeof Menu.makeSelectTouchSafe === 'function') Menu.makeSelectTouchSafe(content);
    },

    renderEquipModalConfirm: () => {
        const c = MenuAllies.getSelectedChar();
        const partLabel = MenuAllies.targetPart;
        const newItem = MenuAllies.selectedEquip;
        if (!c || !partLabel || !newItem) return;

        const modal = MenuAllies.ensureEquipModal();
        const header = modal.querySelector('#ally-equip-modal-header');
        const content = modal.querySelector('#ally-equip-modal-content');
        const footer = modal.querySelector('#ally-equip-modal-footer');
        content.dataset.mode = 'confirm';
        const isRemove = !!newItem.isRemove;
        const dummy = JSON.parse(JSON.stringify(c));
        if (!dummy.equips) dummy.equips = { '武器':null, '盾':null, '頭':null, '体':null, '足':null };
        const internalPart = MenuAllies.getEquipInternalPart(partLabel);
        dummy.equips[internalPart] = isRemove ? null : newItem;

        const sCur = App.calcStats(c);
        const sNew = App.calcStats(dummy);
        const statRow = (label, key, isPercent = false, isReduc = false) => {
            const v1 = sCur[key] || 0;
            const v2 = sNew[key] || 0;
            const diff = v2 - v1;
            const fmt = val => isPercent ? Number(val).toFixed(1) : val;
            let color = diff > 0 ? '#4f4' : (diff < 0 ? '#f44' : '#888');
            if (isReduc) color = diff < 0 ? '#4f4' : (diff > 0 ? '#f44' : '#888');
            const diffStr = diff === 0 ? '±0' : `${diff > 0 ? '+' : ''}${fmt(diff)}`;
            return `<div style="background:#242424; border:1px solid #333; border-radius:4px; padding:6px;">
                <div style="font-size:10px; color:#aaa; margin-bottom:3px;">${label}</div>
                <div style="font-size:12px;"><span style="color:#888;">${fmt(v1)}${isPercent?'%':''}</span> → <span style="color:${color}; font-weight:bold;">${fmt(v2)}${isPercent?'%':''}</span> <span style="font-size:10px; color:${color};">(${diffStr}${isPercent?'%':''})</span></div>
            </div>`;
        };
        const stats = [
            ['HP', 'maxHp'], ['MP', 'maxMp'], ['攻撃', 'atk'], ['防御', 'def'],
            ['魔力', 'mag'], ['魔防', 'mdef'], ['速さ', 'spd'], ['命中', 'hit', true],
            ['回避', 'eva', true], ['会心', 'cri', true], ['与ダメ', 'finDmg', true], ['被ダメ軽減', 'finRed', true]
        ].map(args => statRow(...args)).join('');
        const compareChip = (label, before, after, unit = '%') => {
            const v1 = Number(before || 0);
            const v2 = Number(after || 0);
            const diff = v2 - v1;
            const color = diff > 0 ? '#4f4' : (diff < 0 ? '#f44' : '#888');
            const fmt = val => Math.abs(val) % 1 ? val.toFixed(1) : String(val);
            return `<span style="display:inline-flex; gap:3px; white-space:nowrap; color:${color};"><b style="color:#d9c4a1;">${label}</b>${fmt(v1)}${unit}→${fmt(v2)}${unit}<em style="font-style:normal;">(${diff > 0 ? '+' : ''}${fmt(diff)}${unit})</em></span>`;
        };
        const compareSection = (title, chips) => `
            <div style="background:#1d1712; border:1px solid #3a2a1e; border-radius:5px; padding:6px; margin-bottom:6px;">
                <div style="font-size:10px; color:#ffd700; margin-bottom:4px;">${title}</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px 9px; font-size:10px; line-height:1.4;">${chips.join('')}</div>
            </div>
        `;
        const elementNames = (typeof CONST !== 'undefined' && Array.isArray(CONST.ELEMENTS)) ? CONST.ELEMENTS : [];
        const ailmentLabels = { Poison:'毒', ToxicPoison:'猛毒', Shock:'感電', Fear:'怯え', Debuff:'弱体', InstantDeath:'即死', SkillSeal:'技封', SpellSeal:'魔封', HealSeal:'回復封' };
        const extraStats = [
            compareSection('属性攻撃', elementNames.map(e => compareChip(e, sCur.elmAtk?.[e], sNew.elmAtk?.[e]))),
            compareSection('属性耐性', elementNames.map(e => compareChip(e, sCur.elmRes?.[e], sNew.elmRes?.[e]))),
            compareSection('状態異常耐性', Object.keys(ailmentLabels).map(key => compareChip(ailmentLabels[key], sCur.resists?.[key], sNew.resists?.[key])))
        ].join('');

        header.innerHTML = `
            <div style="min-width:0;">
                <div style="font-weight:bold; color:#ffd700;">装備変更の確認</div>
                <div style="font-size:11px; color:#aaa; margin-top:2px;">${MenuAllies.escapeHtml(partLabel)}</div>
            </div>
            <button class="btn" style="flex:0 0 auto; padding:4px 10px; background:#555;" onclick="MenuAllies.selectedEquip=null; MenuAllies.renderEquipModalList()">戻る</button>
        `;
        content.innerHTML = `
            <div style="text-align:center; color:${isRemove ? '#aaa' : Menu.getRarityColor(newItem.rarity)}; font-weight:bold; margin-bottom:8px;">
                ${isRemove ? '(装備を外す)' : MenuAllies.escapeHtml(newItem.name)}
            </div>
            ${!isRemove ? `<div style="margin-bottom:10px;">${MenuAllies.getEquipFullDetailHTML(newItem)}</div>` : ''}
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-bottom:10px;">${stats}</div>
            ${extraStats}
        `;
        if (footer) {
            footer.innerHTML = `
                <div style="display:flex; gap:8px;">
                    <button class="btn" style="flex:1; background:#555;" onclick="MenuAllies.selectedEquip=null; MenuAllies.renderEquipModalList()">やめる</button>
                    <button class="btn" style="flex:1; background:#d00;" onclick="MenuAllies.doEquip()">変更する</button>
                </div>
            `;
        }
    },
	
    selectCandidate: (idx, isRemove) => {
        if (isRemove) MenuAllies.selectedEquip = { isRemove: true, name: '(装備を外す)' };
        else MenuAllies.selectedEquip = MenuAllies._tempCandidates[idx];
        if (MenuAllies.equipModalOpen || document.getElementById('ally-equip-modal')) {
            MenuAllies.renderEquipModalConfirm();
        } else {
            MenuAllies.renderDetail();
        }
    },

    doEquip: () => {
        const c = MenuAllies.selectedChar;
        const label = MenuAllies.targetPart; // '武器2' or '盾' etc.
        const internalPart = MenuAllies.getEquipInternalPart(label);
        const newItem = MenuAllies.selectedEquip;
        const PS = (typeof PassiveSkill !== 'undefined') ? PassiveSkill : null;

        // 新: doEquip の制約（該当箇所だけ）
		if (internalPart === '盾') {
		  const hasTwoHanded = PS ? PS.getSumValue(c, 'two_handed') > 0 : false;
		  const hasDualWield = PS ? PS.getSumValue(c, 'dual_dmg_base') > 0 : false;

		  if (hasTwoHanded) { Menu.msg("両手持ち中は装備できません"); return; }

		  const t = newItem && !newItem.isRemove ? newItem.type : null;

		  // 盾を盾スロットに入れる = 盾装備
		  if (t === '盾') {
			if (hasDualWield) { Menu.msg("二刀流中は盾を装備できません"); return; }
		  }

		  // 武器を盾スロットに入れる = 武器2
		  if (t === '武器' || t === 'weapon') {
			if (!hasDualWield) { Menu.msg("二刀流特性が必要です"); return; }
		  }
		}


        const oldItem = c.equips[internalPart];
        if(oldItem) App.data.inventory.push(oldItem);
        
        if(newItem && newItem.isRemove) {
            c.equips[internalPart] = null;
        } else if(newItem) {
            let itemIdx = App.data.inventory.findIndex(i => i.id === newItem.id);
            if(itemIdx > -1) {
                c.equips[internalPart] = App.data.inventory[itemIdx];
                App.data.inventory.splice(itemIdx, 1);
            } else { 
                const owner = App.data.characters.find(ch => ch.equips && Object.values(ch.equips).some(eq => eq && eq.id === newItem.id)); 
                if(owner) {
                    const partKey = Object.keys(owner.equips).find(key => owner.equips[key] && owner.equips[key].id === newItem.id);
                    c.equips[internalPart] = owner.equips[partKey];
                    owner.equips[partKey] = null;
                } 
            }
        }
        App.save();
        if (MenuAllies.equipModalOpen || document.getElementById('ally-equip-modal')) {
            MenuAllies.closeEquipModal(false);
        } else {
            MenuAllies.selectedEquip = null;
            MenuAllies.targetPart = null;
        }
        if (MenuAllies.partyEquipContext && typeof MenuParty !== 'undefined') {
            MenuParty.renderEquipmentModal();
            MenuParty.renderEquipmentList();
            Menu.renderPartyBar();
            return;
        }
        MenuAllies.renderDetail();
        Menu.renderPartyBar();
    },

    toggleFullAuto: () => {
        const c = MenuAllies.selectedChar;
        if (!c) return;
        const container = document.querySelector('#allies-detail-view .scroll-container-inner');
        const scrollPos = container ? container.scrollTop : 0;
        if (typeof App !== 'undefined' && App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(c);
        else if (!c.config) c.config = { fullAuto: false, hiddenSkills: [], strategy: 'balanced' };
        c.config.fullAuto = !c.config.fullAuto;
        MenuAllies.renderDetail();
        const newContainer = document.querySelector('#allies-detail-view .scroll-container-inner');
        if (newContainer) newContainer.scrollTop = scrollPos;
    },

    toggleSkillVisibility: (skillId) => {
        const c = MenuAllies.selectedChar;
        if (!c) return;
        const container = document.querySelector('#allies-detail-view .scroll-container-inner');
        const scrollPos = container ? container.scrollTop : 0;
        if (typeof App !== 'undefined' && App.ensureCharacterBattleConfig) App.ensureCharacterBattleConfig(c);
        else if (!c.config) c.config = { fullAuto: false, hiddenSkills: [], strategy: 'balanced' };
        const idx = c.config.hiddenSkills.indexOf(Number(skillId));
        if (idx >= 0) c.config.hiddenSkills.splice(idx, 1);
        else c.config.hiddenSkills.push(Number(skillId));
        MenuAllies.renderDetail();
        const newContainer = document.querySelector('#allies-detail-view .scroll-container-inner');
        if (newContainer) newContainer.scrollTop = scrollPos;
    },

    refreshDetailScroll: () => {
        const container = document.querySelector('#allies-detail-view .scroll-container-inner');
        const scrollPos = container ? container.scrollTop : 0;
        MenuAllies.renderDetail();
        const newContainer = document.querySelector('#allies-detail-view .scroll-container-inner');
        if (newContainer) newContainer.scrollTop = scrollPos;
    },

    escapeAttr: (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;'),

    getImageEditCss: (char) => {
        const edit = char && char.imageEdit;
        if (!edit) return '';
        const scale = Math.max(0.1, Math.min(4, Number(edit.scale || 1)));
        const x = Math.max(-100, Math.min(100, Number(edit.x || 0)));
        const y = Math.max(-100, Math.min(100, Number(edit.y || 0)));
        // canvas保存が使えない file:// 初期画像では、表示用の拡大・位置調整情報として保存する。
        // CSS側はobject-fit:coverを基準にし、スライダー値に応じて見た目を近似する。
        return `transform:translate(${x / 2}%, ${y / 2}%) scale(${scale}); transform-origin:center center;`;
    },

    getCharacterSquareImageHtml: (char, imgUrl, imageFallbackAttr, sizeCss = 'width:60px; height:60px;', extraImgCss = '') => {
        if (!imgUrl) {
            return `<div style="${sizeCss} background:#333; display:flex; align-items:center; justify-content:center; color:#555; font-size:9px; border-radius:4px; border:1px solid #555;">IMG</div>`;
        }
        const safeSrc = MenuAllies.escapeAttr ? MenuAllies.escapeAttr(imgUrl) : String(imgUrl).replace(/"/g, '&quot;');
        const editCss = MenuAllies.getImageEditCss(char);
        const wrapperBorder = extraImgCss.includes('border:') ? '' : 'border:1px solid #555;';
        const borderRadius = extraImgCss.includes('border-radius') ? '' : 'border-radius:4px;';
        return `<div style="${sizeCss} overflow:hidden; background:#000; ${wrapperBorder} ${borderRadius}"><img src="${safeSrc}"${imageFallbackAttr || ''} style="width:100%; height:100%; object-fit:cover; display:block; ${editCss} ${extraImgCss}"></div>`;
    },

    openImageActionModal: (uid) => {
        const char = App.getChar(uid);
        if (!char) return;
        MenuAllies.closeImageActionModal();
        const root = document.createElement('div');
        root.id = 'ally-image-action-modal';
        root.style.cssText = 'position:absolute; inset:0; background:rgba(0,0,0,0.72); z-index:1300; display:flex; align-items:center; justify-content:center; padding:18px; box-sizing:border-box;';
        root.onclick = () => MenuAllies.closeImageActionModal();
        root.innerHTML = `
            <div onclick="event.stopPropagation()" style="width:100%; max-width:310px; background:#18120d; border:2px solid #d8aa43; border-radius:12px; padding:14px; box-shadow:0 8px 24px rgba(0,0,0,0.65); color:#f5e8c8; box-sizing:border-box;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                    <div style="font-weight:bold; font-size:15px; color:#ffd700;">画像操作</div>
                    <button class="btn" style="padding:3px 10px; font-size:12px;" onclick="MenuAllies.closeImageActionModal()">閉じる</button>
                </div>
                <div style="font-size:12px; color:#d8c49a; line-height:1.5; margin-bottom:12px;">
                    ${MenuAllies.escapeHtml(char.name || '仲間')}の画像を変更・加工できます。
                </div>
                <button class="btn" style="width:100%; height:42px; margin-bottom:10px; background:#004444;" onclick="MenuAllies.startImageChange('${uid}')">画像変更</button>
                <button class="btn" style="width:100%; height:42px; background:#4a2d05;" onclick="MenuAllies.openImageEditor('${uid}')">画像加工</button>
            </div>
        `;
        const parent = document.getElementById('sub-screen-allies') || document.getElementById('game-container') || document.body;
        parent.appendChild(root);
    },

    closeImageActionModal: () => {
        const modal = document.getElementById('ally-image-action-modal');
        if (modal) modal.remove();
    },

    startImageChange: (uid) => {
        MenuAllies.closeImageActionModal();
        const input = document.getElementById(`file-upload-${uid}`);
        if (input) input.click();
    },

    getImageEditorSource: (char) => {
        if (!char) return null;
        if (typeof App !== 'undefined' && typeof App.getCharacterDisplayImage === 'function') {
            return App.getCharacterDisplayImage(char);
        }
        return char.img || char.image || null;
    },

    openImageEditor: (uid) => {
        MenuAllies.closeImageActionModal();
        const char = App.getChar(uid);
        if (!char) return;
        const src = MenuAllies.getImageEditorSource(char);
        if (!src) { Menu.msg('加工できる画像がありません'); return; }

        MenuAllies.closeImageEditor();
        const root = document.createElement('div');
        root.id = 'ally-image-editor-modal';
        root.style.cssText = 'position:absolute; inset:0; background:rgba(0,0,0,0.82); z-index:1400; display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box;';
        root.onclick = () => MenuAllies.closeImageEditor();
        root.innerHTML = `
            <div onclick="event.stopPropagation()" style="width:100%; max-width:360px; max-height:96%; background:#15100b; border:2px solid #d8aa43; border-radius:12px; padding:12px; color:#f5e8c8; box-sizing:border-box; display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="font-weight:bold; font-size:15px; color:#ffd700;">画像加工</div>
                    <button class="btn" style="padding:3px 10px; font-size:12px;" onclick="MenuAllies.closeImageEditor()">閉じる</button>
                </div>
                <div style="font-size:11px; color:#d8c49a; line-height:1.45;">正方形の範囲に合わせて、拡大率と位置を調整してください。</div>
                <div style="display:flex; justify-content:center;">
                    <canvas id="ally-image-editor-canvas" width="240" height="240" style="width:240px; height:240px; background:#000; border:1px solid #806020; border-radius:6px;"></canvas>
                </div>
                <div style="display:grid; gap:8px; font-size:12px;">
                    <label>拡大率 <input id="ally-image-editor-scale" type="range" min="60" max="300" value="100" style="width:100%;" oninput="MenuAllies.updateImageEditorPreview()"></label>
                    <label>横位置 <input id="ally-image-editor-x" type="range" min="-100" max="100" value="0" style="width:100%;" oninput="MenuAllies.updateImageEditorPreview()"></label>
                    <label>縦位置 <input id="ally-image-editor-y" type="range" min="-100" max="100" value="0" style="width:100%;" oninput="MenuAllies.updateImageEditorPreview()"></label>
                </div>
                <div style="display:flex; gap:8px; margin-top:2px;">
                    <button class="btn" style="flex:1; height:40px; background:#064;" onclick="MenuAllies.saveEditedImage('${uid}')">保存</button>
                    <button class="btn" style="flex:1; height:40px;" onclick="MenuAllies.closeImageEditor()">キャンセル</button>
                </div>
            </div>
        `;
        const parent = document.getElementById('sub-screen-allies') || document.getElementById('game-container') || document.body;
        parent.appendChild(root);

        MenuAllies.prepareImageEditorImage(src).then(({ img, safeSrc, exportable }) => {
            const edit = char.imageEdit || {};
            MenuAllies.imageEditorState = { uid, src, safeSrc, img, outputSize: 512, exportable };
            const scaleEl = document.getElementById('ally-image-editor-scale');
            const xEl = document.getElementById('ally-image-editor-x');
            const yEl = document.getElementById('ally-image-editor-y');
            if (scaleEl && edit.scale) scaleEl.value = Math.max(60, Math.min(300, Math.round(Number(edit.scale) * 100)));
            if (xEl && edit.x !== undefined) xEl.value = Math.max(-100, Math.min(100, Math.round(Number(edit.x))));
            if (yEl && edit.y !== undefined) yEl.value = Math.max(-100, Math.min(100, Math.round(Number(edit.y))));
            MenuAllies.updateImageEditorPreview();
        }).catch(() => {
            MenuAllies.closeImageEditor();
            Menu.msg('画像を読み込めませんでした');
        });
    },

    imageBlobToDataUrl: (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    }),

    loadImageElement: (src, useAnonymous = false) => new Promise((resolve, reject) => {
        const img = new Image();
        if (useAnonymous) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    }),

    prepareImageEditorImage: async (src) => {
        if (!src) throw new Error('no image src');
        const isData = /^data:image\//i.test(src);
        if (isData) {
            const img = await MenuAllies.loadImageElement(src, false);
            return { img, safeSrc: src, exportable: true };
        }

        // http/httpsでは、同一オリジン画像をBlob化してdataURLに変換してからcanvasへ描く。
        // これにより初期設定画像でもtoDataURL時のtainted canvasを避ける。
        if (location.protocol === 'http:' || location.protocol === 'https:') {
            try {
                const res = await fetch(src, { cache: 'force-cache' });
                if (res && res.ok) {
                    const blob = await res.blob();
                    if (blob && /^image\//i.test(blob.type || 'image/png')) {
                        const dataUrl = await MenuAllies.imageBlobToDataUrl(blob);
                        const img = await MenuAllies.loadImageElement(dataUrl, false);
                        return { img, safeSrc: dataUrl, exportable: true };
                    }
                }
            } catch (e) {
                console.warn('[ImageEditor] Blob conversion failed. Fallback to direct image.', e);
            }
        }

        // file://ではブラウザ制限でローカル初期画像をcanvas exportできないことがある。
        // プレビューできても保存時のBase64化が禁止される場合があるため、その場合は保存せず案内する。
        const img = await MenuAllies.loadImageElement(src, false);
        return { img, safeSrc: src, exportable: false };
    },

    closeImageEditor: () => {
        const modal = document.getElementById('ally-image-editor-modal');
        if (modal) modal.remove();
        MenuAllies.imageEditorState = null;
    },

    drawImageEditorCanvas: (canvas, outputSize) => {
        const state = MenuAllies.imageEditorState;
        if (!state || !state.img || !canvas) return false;
        const ctx = canvas.getContext('2d');
        const size = outputSize || canvas.width || 240;
        canvas.width = size;
        canvas.height = size;
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, size, size);

        const scaleEl = document.getElementById('ally-image-editor-scale');
        const xEl = document.getElementById('ally-image-editor-x');
        const yEl = document.getElementById('ally-image-editor-y');
        const zoom = Math.max(0.1, Number(scaleEl?.value || 100) / 100);
        const offsetXRate = Number(xEl?.value || 0) / 100;
        const offsetYRate = Number(yEl?.value || 0) / 100;
        const iw = state.img.naturalWidth || state.img.width;
        const ih = state.img.naturalHeight || state.img.height;
        if (!iw || !ih) return false;
        const baseScale = Math.max(size / iw, size / ih);
        const drawScale = baseScale * zoom;
        const dw = iw * drawScale;
        const dh = ih * drawScale;
        const movableX = Math.max(0, (dw - size) / 2);
        const movableY = Math.max(0, (dh - size) / 2);
        const dx = (size - dw) / 2 + offsetXRate * movableX;
        const dy = (size - dh) / 2 + offsetYRate * movableY;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(state.img, dx, dy, dw, dh);
        return true;
    },

    updateImageEditorPreview: () => {
        const canvas = document.getElementById('ally-image-editor-canvas');
        if (!canvas) return;
        MenuAllies.drawImageEditorCanvas(canvas, 240);
        canvas.style.width = '240px';
        canvas.style.height = '240px';
    },

    getCurrentImageEditorTransform: () => {
        const scaleEl = document.getElementById('ally-image-editor-scale');
        const xEl = document.getElementById('ally-image-editor-x');
        const yEl = document.getElementById('ally-image-editor-y');
        return {
            scale: Math.max(0.1, Number(scaleEl?.value || 100) / 100),
            x: Math.max(-100, Math.min(100, Number(xEl?.value || 0))),
            y: Math.max(-100, Math.min(100, Number(yEl?.value || 0)))
        };
    },

    saveImageEditorTransformFallback: (char, state) => {
        const transform = MenuAllies.getCurrentImageEditorTransform();
        char.imageEdit = {
            src: state.src,
            scale: transform.scale,
            x: transform.x,
            y: transform.y,
            updatedAt: Date.now()
        };
        char.hasCustomImage = true;
        App.save();
        MenuAllies.closeImageEditor();
        Menu.renderPartyBar();
        MenuAllies.renderDetail();
        Menu.msg('画像の表示位置を保存しました');
    },

    saveEditedImage: (uid) => {
        const char = App.getChar(uid);
        const state = MenuAllies.imageEditorState;
        if (!char || !state) return;
        const canvas = document.createElement('canvas');
        const outputSize = state.outputSize || 512;
        if (!MenuAllies.drawImageEditorCanvas(canvas, outputSize)) {
            Menu.msg('画像加工に失敗しました');
            return;
        }
        try {
            let dataUrl = canvas.toDataURL('image/webp', 0.9);
            if (!/^data:image\/webp/i.test(dataUrl)) dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            char.img = dataUrl;
            char.image = dataUrl;
            delete char.imageEdit;
            char.customImage = true;
            char.hasCustomImage = true;
            App.save();
            MenuAllies.closeImageEditor();
            Menu.renderPartyBar();
            MenuAllies.renderDetail();
            Menu.msg('画像を加工して保存しました');
        } catch (e) {
            console.warn('[ImageEditor] Canvas export failed.', e);
            Menu.msg('この画像はブラウザ制限により加工保存できません。画像変更から一度画像ファイルを選択してから加工してください');
        }
    },

    uploadImage: (input, uid) => {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (file.size > 500 * 1024) { Menu.msg("画像サイズが大きすぎます(500KB以下)"); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                const char = App.getChar(uid);
                if (char) {
                    char.img = e.target.result;
                    char.image = e.target.result;
                    delete char.imageEdit;
                    char.customImage = true;
                    char.hasCustomImage = true;
                    App.save();
                    Menu.renderPartyBar();
                    MenuAllies.renderDetail();
                }
            };
            reader.readAsDataURL(file);
        }
    },

    getMonsterDefaultImageByJob: (jobName) => {
        const name = String(jobName || '').trim();
        if (!name) return null;
        const monsters = (typeof DB !== 'undefined' && Array.isArray(DB.MONSTERS))
            ? DB.MONSTERS
            : ((typeof window !== 'undefined' && Array.isArray(window.MONSTERS_DATA)) ? window.MONSTERS_DATA : []);
        const monster = monsters.find(m => String(m?.name || '').trim() === name);
        if (!monster) return null;
        const map = (typeof window !== 'undefined' && window.MonsterImageMap) ? window.MonsterImageMap : {};
        return monster.image || monster.img || map[Number(monster.id)] || null;
    },

    getCharacterDefaultImageForReset: (char) => {
        if (!char) return null;
        if (App.isMonsterAlly && App.isMonsterAlly(char)) {
            // 仲間モンスターはユーザーが変更できる名前ではなく、職業欄のモンスター名だけを参照して戻す。
            return MenuAllies.getMonsterDefaultImageByJob(char.job);
        }
        if (typeof App !== 'undefined' && typeof App.getCharacterImageFallback === 'function') {
            return App.getCharacterImageFallback(char);
        }
        const master = (typeof App !== 'undefined' && typeof App.getCharacterMaster === 'function') ? App.getCharacterMaster(char) : null;
        return master?.img || null;
    },

    hasResettableImage: (char) => {
        if (!char) return false;
        if (char.imageEdit && char.imageEdit.src) return true;
        if (char.customImage === true || char.hasCustomImage === true) return true;
        if (!char.img) return false;
        const defaultImg = MenuAllies.getCharacterDefaultImageForReset(char);
        if (defaultImg && char.img === defaultImg) return false;
        return App.hasCustomCharacterImage ? App.hasCustomCharacterImage(char) : true;
    },

    resetImage: (uid) => {
        const char = App.getChar(uid);
        if (char && (MenuAllies.hasResettableImage ? MenuAllies.hasResettableImage(char) : (App.hasCustomCharacterImage ? App.hasCustomCharacterImage(char) : char.img))) {
            Menu.confirm("画像を初期状態に戻しますか？", () => {
                const defaultImg = MenuAllies.getCharacterDefaultImageForReset(char);
                delete char.imageEdit;
                delete char.customImage;
                delete char.hasCustomImage;
                if (defaultImg) {
                    char.img = defaultImg;
                    char.image = defaultImg;
                } else {
                    delete char.img;
                    delete char.image;
                }
                App.save();
                Menu.renderPartyBar();
                MenuAllies.renderDetail();
            });
        }
    },

    createTreeViewDOM: () => {
        if(document.getElementById('allies-tree-view')) return;
        const div = document.createElement('div');
        div.id = 'allies-tree-view';
        div.className = 'allies-tree-modal';
        div.style.display = 'none';
        div.innerHTML = `
            <div class="allies-tree-modal-window" onclick="event.stopPropagation()">
                <div class="header-bar" id="tree-header"></div>
                <div id="tree-content" class="scroll-area"></div>
                <div class="sub-screen-bottom-panel">
                    <button id="tree-bottom-back-btn" class="btn sub-screen-back-btn" onclick="MenuAllies.returnFromTreeToDetail()">もどる</button>
                </div>
            </div>
        `;
        div.onclick = () => MenuAllies.returnFromTreeToDetail();
        document.getElementById('sub-screen-allies').appendChild(div);
    },

    openTreeView: () => {
        const treeView = document.getElementById('allies-tree-view');
        if (!treeView) return;
        treeView.style.display = 'flex';
        MenuAllies.renderTreeView();
    },

    returnFromTreeToDetail: () => {
        const c = MenuAllies.getSelectedChar ? MenuAllies.getSelectedChar() : MenuAllies.selectedChar;
        if (!c) {
            MenuAllies.renderList();
            return;
        }

        MenuAllies.selectedChar = c;
        MenuAllies.selectedUid = c.uid;

        const treeView = document.getElementById('allies-tree-view');
        if (treeView) treeView.style.display = 'none';
        MenuAllies.renderDetail();
    },

    switchTreeChar: (dir) => {
        const current = MenuAllies.getSelectedChar ? MenuAllies.getSelectedChar() : MenuAllies.selectedChar;
        if (!current || !Array.isArray(App.data.characters) || App.data.characters.length === 0) return;

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

        let idx = chars.findIndex(c => c.uid === current.uid);
        if (idx === -1) idx = 0;
        const nextChar = chars[(idx + dir + chars.length) % chars.length];

        MenuAllies.selectedChar = nextChar;
        MenuAllies.selectedUid = nextChar.uid;
        MenuAllies.targetPart = null;
        MenuAllies.selectedEquip = null;

        // スキル習得画面内の移動では、アーカイブ詳細の描画処理を呼ばない。
        MenuAllies.renderTreeView();
    },

    renderTreeView: () => {
        const c = MenuAllies.selectedChar;
        const sp = c.sp || 0;
        const header = document.getElementById('tree-header');
        header.innerHTML = `<div class="allies-tree-header-main"><span>${c.name} (SP:${sp})</span><button class="btn" onclick="MenuAllies.resetTree()">RESET</button></div>`;
        const list = document.getElementById('tree-content');
        list.innerHTML = '';
        if (!c.tree) c.tree = { ATK:0, MAG:0, SPD:0, HP:0, MP:0 };

        for (let key in CONST.SKILL_TREES) {
            const treeDef = CONST.SKILL_TREES[key];
            if ((treeDef.reqReincarnation || 0) > (c.reincarnationCount || 0)) continue;
            const currentLevel = c.tree[key] || 0;
            const maxLevel = treeDef.steps.length;
            const div = document.createElement('div');
            div.style.cssText = "background:#222; border:1px solid #444; border-radius:4px; margin-bottom:10px; padding:5px;";
            let html = `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span style="font-weight:bold; color:#ffd700;">${treeDef.name} Lv.${currentLevel}</span><span style="font-size:11px; color:#aaa;">(${currentLevel}/${maxLevel})</span></div><div style="display:flex; gap:2px; margin-bottom:5px;">`;
            for(let i=0; i<maxLevel; i++) {
                const achieved = (i < currentLevel);
                const isNext = (i === currentLevel);
                html += `<div style="flex:1; background:${achieved ? '#008888' : (isNext ? '#444' : '#222')}; border:${isNext ? '1px solid #fff' : '1px solid #444'}; height:6px; border-radius:2px;"></div>`;
            }
            html += `</div>`;
            if (currentLevel < maxLevel) {
                const nextStep = treeDef.steps[currentLevel];
                const reqTotal = treeDef.costs[currentLevel];
                const cost = reqTotal - ((currentLevel > 0) ? treeDef.costs[currentLevel-1] : 0);
                const canAfford = (sp >= cost);
                html += `<div style="display:flex; justify-content:space-between; align-items:center;"><div style="font-size:12px;">次: <span style="color:#fff;">${nextStep.desc}</span></div><button class="btn" style="font-size:11px; padding:4px 8px; background:${canAfford?'#d00':'#333'};" onclick="MenuAllies.unlockTree('${key}', ${cost})" ${canAfford?'':'disabled'}>習得 SP:${cost}</button></div>`;
            } else { html += `<div style="font-size:12px; text-align:center; color:#4f4;">MASTER!</div>`; }
            div.innerHTML = html; list.appendChild(div);
        }
    },

    unlockTree: (key, cost) => {
        const c = MenuAllies.selectedChar;
        if (c.sp >= cost) { c.sp -= cost; c.tree[key] = (c.tree[key] || 0) + 1; App.save(); MenuAllies.renderTreeView(); Menu.renderPartyBar(); }
    },

    resetTree: () => {
        const c = MenuAllies.selectedChar;
        Menu.confirm("スキルポイントを初期化しますか？", () => {
            let totalReturned = 0;
            for (let key in c.tree) {
                const lv = c.tree[key];
                if (lv > 0) { const treeDef = CONST.SKILL_TREES[key]; if (treeDef && treeDef.costs[lv - 1]) totalReturned += treeDef.costs[lv - 1]; c.tree[key] = 0; }
            }
            c.sp = (c.sp || 0) + totalReturned; App.save(); MenuAllies.renderTreeView(); Menu.renderPartyBar(); Menu.msg(`スキルをリセットしました。\n(返還SP: ${totalReturned})`);
        });
    },

    createAllocModalDOM: () => {
        if(document.getElementById('alloc-modal')) return;
        const div = document.createElement('div');
        div.id = 'alloc-modal';
        div.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; display:none; flex-direction:column; justify-content:center; align-items:center;';
        div.innerHTML = `<div style="width:90%; max-width:320px; max-height:80%; background:#222; border:2px solid #fff; display:flex; flex-direction:column;"><div class="header-bar"><span>能力値振分</span></div><div style="padding:10px; text-align:center; border-bottom:1px solid #444;">残りポイント: <span id="alloc-free-pts" style="color:#ffd700; font-weight:bold; font-size:18px;">0</span></div><div id="alloc-list" class="scroll-area" style="flex:1; padding:10px;"></div><div style="padding:10px; display:flex; gap:10px; justify-content:center; border-top:1px solid #444;"><button class="menu-btn" style="width:100px; background:#400040;" onclick="MenuAllies.saveAlloc()">決定</button><button class="menu-btn" style="width:100px;" onclick="MenuAllies.closeAllocModal()">キャンセル</button></div></div>`;
        document.body.appendChild(div);
    },

    openAllocModal: () => {
        const c = MenuAllies.selectedChar;
        if(!c || c.uid !== 'p1') return;
        const lb = c.limitBreak || 0;
        const totalPt = Math.floor(lb / 10) * 10;
        MenuAllies.tempAlloc = JSON.parse(JSON.stringify(c.alloc || {}));
        MenuAllies.tempTotalPt = totalPt;
        MenuAllies.renderAllocModal();
        document.getElementById('alloc-modal').style.display = 'flex';
    },

    closeAllocModal: () => { document.getElementById('alloc-modal').style.display = 'none'; MenuAllies.tempAlloc = null; },

    renderAllocModal: () => {
        const alloc = MenuAllies.tempAlloc;
        let used = 0; for(let k in alloc) used += alloc[k];
        const free = MenuAllies.tempTotalPt - used;
        document.getElementById('alloc-free-pts').innerText = free;
        const list = document.getElementById('alloc-list'); list.innerHTML = '';
        const items = [];
        CONST.ELEMENTS.forEach(elm => { items.push({ key: `elmAtk_${elm}`, label: `${elm}属性攻撃` }); items.push({ key: `elmRes_${elm}`, label: `${elm}属性耐性` }); });
        items.push({ key: `finDmg`, label: `与ダメージ` }); items.push({ key: `finRed`, label: `被ダメージ軽減` });
        items.forEach(item => {
            const val = alloc[item.key] || 0;
            const unit = item.key.includes('fin') || item.key.includes('elm') ? '%' : '';
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; background:#333; padding:4px; border-radius:4px;';
            div.innerHTML = `<div style="font-size:11px;">${item.label}</div><div style="display:flex; align-items:center; gap:2px;"><button class="btn" style="padding:2px 6px; font-size:10px;" onclick="MenuAllies.adjustAlloc('${item.key}', -10)">-10</button><button class="btn" style="padding:2px 8px; font-size:12px;" onclick="MenuAllies.adjustAlloc('${item.key}', -1)">－</button><span style="width:30px; text-align:center; font-weight:bold; font-size:12px;">${val}${unit}</span><button class="btn" style="padding:2px 8px; font-size:12px;" onclick="MenuAllies.adjustAlloc('${item.key}', 1)">＋</button><button class="btn" style="padding:2px 6px; font-size:10px;" onclick="MenuAllies.adjustAlloc('${item.key}', 10)">+10</button></div>`;
            list.appendChild(div);
        });
    },

    adjustAlloc: (key, delta) => {
        const alloc = MenuAllies.tempAlloc;
        let used = 0; for(let k in alloc) used += alloc[k];
        const free = MenuAllies.tempTotalPt - used;
        const currentVal = alloc[key] || 0;
        let actualDelta = delta;
        if (delta < 0) { if (currentVal + delta < 0) actualDelta = -currentVal; }
        else { if (free < delta) actualDelta = free; }
        if (actualDelta === 0) return;
        alloc[key] = currentVal + actualDelta; if (alloc[key] <= 0) delete alloc[key];
        MenuAllies.renderAllocModal();
    },

    saveAlloc: () => {
        const c = MenuAllies.selectedChar;
        if(c && MenuAllies.tempAlloc) { c.alloc = MenuAllies.tempAlloc; App.save(); MenuAllies.renderDetail(); Menu.msg("振分を保存しました"); }
        MenuAllies.closeAllocModal();
    }
};

if (typeof window !== 'undefined') window.MenuAllies = MenuAllies;
