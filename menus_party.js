/* MenuParty extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   1. 仲間編成 (隊列切り替え・オーラ反映版)
   ========================================================================== */
const MenuParty = {
    targetSlot: 0,
	init: () => { 
		MenuParty.ensureBottomPanel();

		document.getElementById('party-screen-slots').style.display = 'flex';
		document.getElementById('party-screen-chars').style.display = 'none';

		MenuParty.setBottomButton('もどる', () => Menu.closeSubScreen('party'));

		MenuParty.renderSlots(); 
	},
	
	ensureBottomPanel: () => {
		const screen = document.getElementById('sub-screen-party');
		if (!screen) return;

		let panel = document.getElementById('party-bottom-panel');
		if (panel) return;

		panel = document.createElement('div');
		panel.id = 'party-bottom-panel';
		panel.className = 'sub-screen-bottom-panel';
		panel.innerHTML = `
			<button id="party-bottom-back-btn" class="btn sub-screen-back-btn">もどる</button>
		`;

		screen.appendChild(panel);
	},

	setBottomButton: (label, handler) => {
		const btn = document.getElementById('party-bottom-back-btn');
		if (!btn) return;

		btn.innerText = label;
		btn.onclick = handler;
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
                
                // 画像取得ロジック（マスタデータ参照）
                const master = DB.CHARACTERS.find(m => m.id === c.charId);
                const imgUrl = c.img || (master ? master.img : null);
                const imgHtml = imgUrl ? `<img src="${imgUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; border:1px solid #555;">` : `<div style="width:40px; height:40px; background:#333; display:flex; align-items:center; justify-content:center; color:#555; font-size:9px; border-radius:4px; border:1px solid #555;">IMG</div>`;

                // ★隊列表示用の設定
                const formationLabel = (c.formation === 'back') ? '後衛' : '前衛';
                const formationColor = (c.formation === 'back') ? '#44aaff' : '#ff4444';

				div.innerHTML = `
					<div style="display:flex; align-items:center; width:100%; padding:6px 0;">
						<div style="display:flex; align-items:center; flex-shrink:0; margin-right:10px;">
							<div style="font-size:14px; font-weight:bold; color:#aaa; width:15px;">${i+1}.</div>
							<div style="width:50px;">${imgHtml}</div>
						</div>

						<div style="flex:1; min-width:0; margin-right:8px;">
							<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
								<div style="font-size:13px; font-weight:bold; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
									${c.name} ${lbText} <span style="font-size:10px; color:#aaa; font-weight:normal;">(${c.job})</span>
								</div>
							</div>

							<div style="display:grid; grid-template-columns: 40px 1fr 1fr; gap:4px; font-size:11px; color:#ddd; align-items:baseline; margin-bottom:1px;">
								<span style="color:#ffd700; font-weight:bold;">Lv.${c.level}</span>
							</div>
							
							<div style="display:grid; grid-template-columns: 40px 1fr 1fr; gap:4px; font-size:11px; color:#ddd; align-items:baseline; margin-bottom:0px;">
								<span style="white-space:nowrap;">HP:<span style="color:#8f8;">${curHp}/${s.maxHp}</span>
							</div>
							
							<div style="display:grid; grid-template-columns: 40px 1fr 1fr; gap:4px; font-size:11px; color:#ddd; align-items:baseline; margin-bottom:3px;">
								<span style="white-space:nowrap;"> MP:<span style="color:#88f;">${curMp}/${s.maxMp}</span></span>
							</div>

							<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:2px 6px; font-size:9px; color:#aaa; line-height:1.2;">
								<span>攻:${s.atk}</span>
								<span>防:${s.def}</span>
								<span>速:${s.spd}</span>
								<span>魔:${s.mag}</span>
								<span>魔防:${s.mdef}</span>
							</div>
						</div>

						<div style="display:flex; flex-direction:column; align-items:flex-end; flex-shrink:0; align-self:stretch; margin-left:10px;">
							
							<div style="flex:1;"></div>

							<div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; position:relative; bottom:-6px;">
								
								<div style="font-size:10px; color:#888; cursor:pointer;" onclick="event.stopPropagation(); MenuParty.openChangeMember(${i})">
									変更 &gt;
								</div>

								<div style="background:#222; border-radius:4px; padding:2px; display:flex; border:1px solid #444; cursor:pointer;" onclick="event.stopPropagation(); MenuParty.toggleFormation('${c.uid}')">
									<div style="font-size:9px; padding:2px 6px; border-radius:2px; background:${c.formation !== 'back' ? formationColor : 'transparent'}; color:${c.formation !== 'back' ? '#fff' : '#666'};">前衛</div>
									<div style="font-size:9px; padding:2px 6px; border-radius:2px; background:${c.formation === 'back' ? formationColor : 'transparent'}; color:${c.formation === 'back' ? '#fff' : '#666'};">後衛</div>
								</div>
							</div>
						</div>
					</div>
				`;

                // メイン領域クリックでキャラ変更画面へ
                div.onclick = () => MenuParty.openChangeMember(i);
            } else {
                div.innerHTML = `
                    <div style="display:flex; align-items:center; width:100%; height:45px;">
                        <div style="margin-right:10px; font-size:14px; font-weight:bold; color:#aaa; width:15px;">${i+1}.</div>
                        <div style="flex:1; color:#555;">(空き)</div>
                        <div style="font-size:10px; color:#888;">設定 &gt;</div>
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
		document.getElementById('party-screen-slots').style.display = 'none';
		document.getElementById('party-screen-chars').style.display = 'flex';

		MenuParty.setBottomButton('スロット選択にもどる', () => {
			document.getElementById('party-screen-chars').style.display = 'none';
			document.getElementById('party-screen-slots').style.display = 'flex';
			MenuParty.setBottomButton('もどる', () => Menu.closeSubScreen('party'));
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
            
            const curHp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
            const curMp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
            const inParty = App.data.party.includes(c.uid) ? '<span style="color:#4ff; font-weight:bold; font-size:10px; margin-right:4px;">[PT]</span>' : '';
            const lbText = c.limitBreak > 0 ? `<span style="color:#f0f; font-weight:bold; font-size:11px;">+${c.limitBreak}</span>` : '';
            const rarityLabel = (c.uid === 'p1') ? 'Player' : `${c.rarity}`;
            const rarityColor = (c.uid === 'p1') ? '#ffd700' : Menu.getRarityColor(c.rarity);
            
            const master = DB.CHARACTERS.find(m => m.id === c.charId);
            const imgUrl = c.img || (master ? master.img : null);
            const imgHtml = imgUrl ? `<img src="${imgUrl}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #555;">` : `<div style="width:40px; height:40px; background:#333; display:flex; align-items:center; justify-content:center; color:#555; font-size:9px; border-radius:4px; border:1px solid #555;">IMG</div>`;

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

		const oldIdx = App.data.party.indexOf(uid);
		if(oldIdx > -1 && uid !== null) App.data.party[oldIdx] = App.data.party[MenuParty.targetSlot];
		
		App.data.party[MenuParty.targetSlot] = uid;
		App.save();

		document.getElementById('party-screen-chars').style.display = 'none';
		document.getElementById('party-screen-slots').style.display = 'flex';

		MenuParty.setBottomButton('もどる', () => Menu.closeSubScreen('party'));

		MenuParty.renderSlots();
	}
};

if (typeof window !== 'undefined') window.MenuParty = MenuParty;
