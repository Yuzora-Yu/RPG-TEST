/* menus.js (メインメニュー改修・プレイ状況追加・装備画面統合版) */

const Menu = {
    // --- メインメニュー制御 ---
    openMainMenu: () => {
        document.getElementById('menu-overlay').style.display = 'flex';
        Menu.renderPartyBar();
        
        const grid = document.querySelector('#menu-overlay .menu-grid');
        if(grid) {
            grid.innerHTML = `
                <button class="menu-btn" onclick="Menu.openSubScreen('party')">仲間編成</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('allies')">仲間一覧</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('inventory')">所持装備</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('items')">道具</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('blacksmith')">鍛冶屋</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('skills')">スキル</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('book')">魔物図鑑</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('status')">プレイ状況</button>
                <button class="menu-btn" style="background:#400040;" onclick="Dungeon.enter()">ダンジョン</button>
                <button class="menu-btn" style="background:#664400;" onclick="Menu.openSubScreen('gacha')">ガチャ</button>
                
                <button class="menu-btn" style="background:#004444;" onclick="App.downloadSave()">データ出力</button>
                <button class="menu-btn" style="background:#004444;" onclick="App.importSave()">データ読込</button>
                
                <button class="menu-btn" style="background:#500; grid-column:span 2;" onclick="App.returnToTitle()">タイトルへ</button>
            `;
        }
    },
    
    closeMainMenu: () => {
        document.getElementById('menu-overlay').style.display = 'none';
    },
    
    isMenuOpen: () => {
        // ★修正: 文字列検索(style*="flex")をやめ、各要素の display プロパティを直接チェックする
        // (これにより、flex-direction等のスタイル設定があっても誤判定しなくなる)
        
        if (document.getElementById('menu-overlay').style.display !== 'none') return true;
        
        const subs = document.querySelectorAll('.sub-screen');
        for (let i = 0; i < subs.length; i++) {
            if (subs[i].style.display !== 'none' && subs[i].style.display !== '') return true;
        }
        return false;
    },

    closeAll: () => {
        document.getElementById('menu-overlay').style.display = 'none';
        document.querySelectorAll('.sub-screen').forEach(e => e.style.display = 'none');
        const assignModal = document.getElementById('assign-modal');
        if(assignModal) assignModal.style.display = 'none';
        Menu.closeDialog();
    },

    renderPartyBar: () => {
        const bars = document.querySelectorAll('.party-bar'); 
        bars.forEach(bar => {
            bar.innerHTML = '';
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

                    // ★修正箇所: マスタデータから画像を取得
                    const master = DB.CHARACTERS.find(m => m.id === p.charId);
                    const imgUrl = p.img || (master ? master.img : null);

                    const imgHtml = imgUrl 
                        ? `<img src="${imgUrl}" style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #666; margin-bottom:2px;">`
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
        document.getElementById('menu-overlay').style.display = 'none';
        document.querySelectorAll('.sub-screen').forEach(e => e.style.display = 'none');
        
        if (id === 'status' && !document.getElementById('sub-screen-status')) {
            MenuStatus.createDOM();
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
        if(id === 'gacha' && typeof Gacha !== 'undefined') Gacha.init();
    },

    closeSubScreen: (id) => {
        document.getElementById('sub-screen-' + id).style.display = 'none';
        document.getElementById('menu-overlay').style.display = 'flex';
        Menu.renderPartyBar();
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

    /* menus.js 内の getEquipDetailHTML 関数全文 */

    getEquipDetailHTML: (equip, showName = true) => {
        let html = '';
        const rarity = equip.rarity || 'N';
        const rarityColor = Menu.getRarityColor(rarity);
        
        let baseStats = [];
        if (equip.data) {
            if (equip.data.atk) baseStats.push(`攻+${equip.data.atk}`);
            if (equip.data.def) baseStats.push(`防+${equip.data.def}`);
            if (equip.data.mag) baseStats.push(`魔+${equip.data.mag}`);
            if (equip.data.spd) baseStats.push(`速+${equip.data.spd}`);
            if (equip.data.finDmg) baseStats.push(`与ダメ+${equip.data.finDmg}%`);
            if (equip.data.finRed) baseStats.push(`被ダメ-${equip.data.finRed}`);
			
            for (let key in equip.data) {
                if (key.startsWith('resists_')) {
                    const label = Battle.statNames[key.replace('resists_', '')] || key;
                    baseStats.push(`${label}耐+${equip.data[key]}%`);
                } else if (key.startsWith('attack_')) {
                    const label = Battle.statNames[key.replace('attack_', '')] || key;
                    baseStats.push(`攻撃時${equip.data[key]}%で${label}`);
                }
            }
			
            if(typeof CONST !== 'undefined' && CONST.ELEMENTS) {
                CONST.ELEMENTS.forEach(elm => {
                    if (equip.data.elmAtk && equip.data.elmAtk[elm]) baseStats.push(`${elm}攻+${equip.data.elmAtk[elm]}`);
                    if (equip.data.elmRes && equip.data.elmRes[elm]) baseStats.push(`${elm}耐+${equip.data.elmRes[elm]}`);
                });
            }
        }
        const baseEffect = baseStats.length > 0 ? baseStats.join(' ') : 'なし';

        let optsHTML = '';
        if (equip.opts && equip.opts.length > 0) {
            const optsList = equip.opts.map(o => {
                const optRarity = o.rarity || 'N';
                const optColor = Menu.getRarityColor(optRarity);
                const unit = o.unit === 'val' ? '' : o.unit;
                return `<span style="color:${optColor};">[${o.label}+${o.val}${unit} ${optRarity}]</span>`;
            }).join(' ');
            optsHTML = `<div style="font-size:10px; color:#aaa; margin-top:2px;">${optsList}</div>`;
        }

        let synergyHTML = '';
        if (typeof App !== 'undefined' && typeof App.checkSynergy === 'function') {
             // ★修正: App.checkSynergy は配列を返すため、配列がある場合にループして全て表示する
             const syns = App.checkSynergy(equip);
             if(syns && syns.length > 0) {
                 synergyHTML = syns.map(syn => `
                    <div style="margin-top:4px; padding:2px 4px; background:rgba(255,255,255,0.1); border-radius:2px;">
                        <div style="font-size:11px; font-weight:bold; color:${syn.color||'#f88'};">★${syn.name}</div>
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
            <div style="font-size:10px; color:#ccc;">${baseEffect}</div>
            ${optsHTML}
            ${synergyHTML}
        `;
        return html;
    },
	
    msg: (text, callback) => {
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');
        
        if (!area) { alert(text); if (callback) callback(); return; }
        
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
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');

        if (!area) { if(confirm(text)) { if(yesCallback) yesCallback(); } else { if(noCallback) noCallback(); } return; }

        textEl.innerHTML = text.replace(/\n/g, '<br>');
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
        area.style.display = 'flex';
    },
    
	choice: (text, label1, callback1, label2, callback2) => {
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');
        
        // ダイアログ要素がない場合の安全策
        if (!area) { 
            if(confirm(text + "\n\n" + label1 + " -> OK\n" + label2 + " -> キャンセル")) {
                if(callback1) callback1(); 
            } else {
                if(callback2) callback2(); 
            }
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
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');
        
        if (!area) return;

        textEl.innerHTML = text.replace(/\n/g, '<br>');
        btnEl.innerHTML = '';
        // 縦並びに変更
        btnEl.style.flexDirection = 'column'; 
        btnEl.style.gap = '8px';

        choices.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.style.width = '100%';
            btn.style.padding = '10px';
            btn.innerText = c.label;
            btn.onclick = () => { 
                btnEl.style.flexDirection = 'row'; // 他のダイアログのために横並びに戻す
                Menu.closeDialog(); 
                if (c.callback) c.callback(); 
            };
            btnEl.appendChild(btn);
        });

        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn';
        btnCancel.style.width = '100%';
        btnCancel.style.background = '#444';
        btnCancel.innerText = 'やめる';
        btnCancel.onclick = () => { 
            btnEl.style.flexDirection = 'row'; 
            Menu.closeDialog(); 
        };
        btnEl.appendChild(btnCancel);
        
        area.style.display = 'flex';
    },
	
    closeDialog: () => {
        const area = document.getElementById('menu-dialog-area');
        if (area) area.style.display = 'none';
    }
};

/* ==========================================================================
   1. 仲間編成 (下部ボタン追加版)
   ========================================================================== */
const MenuParty = {
    targetSlot: 0,
    init: () => { 
        document.getElementById('party-screen-slots').style.display = 'flex';
        document.getElementById('party-screen-chars').style.display = 'none';
        MenuParty.renderSlots(); 
    },
    
    renderSlots: () => {
        const list = document.getElementById('party-slot-list');
        list.innerHTML = '';
        
        for(let i=0; i<4; i++) {
            // ... (中略: 既存のスロット生成ループ処理はそのまま) ...
            const uid = App.data.party[i];
            const div = document.createElement('div');
            div.className = 'list-item';
            
            if (uid) {
                const c = App.getChar(uid);
                const s = App.calcStats(c);
                const curHp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
                const curMp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
                const lbText = c.limitBreak > 0 ? `<span style="color:#f0f; font-weight:bold; font-size:11px;">+${c.limitBreak}</span>` : '';
                const rarityLabel = (c.uid === 'p1') ? 'Player' : `[${c.rarity}]`;
                const rarityColor = (c.uid === 'p1') ? '#ffd700' : Menu.getRarityColor(c.rarity);
				
				// ★修正箇所: マスタデータから画像を取得
                const master = DB.CHARACTERS.find(m => m.id === c.charId);
                const imgUrl = c.img || (master ? master.img : null);
                const imgHtml = imgUrl ? `<img src="${imgUrl}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #555;">` : `<div style="width:40px; height:40px; background:#333; display:flex; align-items:center; justify-content:center; color:#555; font-size:9px; border-radius:4px; border:1px solid #555;">IMG</div>`;
                //const imgHtml = c.img ? `<img src="${c.img}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #555;">` : `<div style="width:40px; height:40px; background:#333; display:flex; align-items:center; justify-content:center; color:#555; font-size:9px; border-radius:4px; border:1px solid #555;">IMG</div>`;

                div.innerHTML = `
                    <div style="display:flex; align-items:center; width:100%;">
                        <div style="margin-right:10px; font-size:14px; font-weight:bold; color:#aaa; width:15px;">${i+1}.</div>
                        <div style="margin-right:10px;">${imgHtml}</div>
                        <div style="flex:1;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                                <div style="font-size:13px; font-weight:bold; color:#fff;">${c.name} ${lbText} <span style="font-size:10px; color:#aaa; font-weight:normal;">(${c.job})</span></div>
                                <div style="font-size:11px; font-weight:bold; color:${rarityColor};">${rarityLabel}</div>
                            </div>
                            <div style="font-size:11px; color:#ddd; display:flex; align-items:baseline; margin-bottom:1px;">
                                <span style="color:#ffd700; font-weight:bold; margin-right:8px;">Lv.${c.level}</span>
                                <span style="margin-right:8px;">HP <span style="color:#8f8;">${curHp}/${s.maxHp}</span></span>
                                <span>MP <span style="color:#88f;">${curMp}/${s.maxMp}</span></span>
                            </div>
                            <div style="font-size:10px; color:#aaa; display:flex; gap:8px;">
                                <span>攻:${s.atk}</span> <span>防:${s.def}</span> <span>魔:${s.mag}</span> <span>速:${s.spd}</span>
                            </div>
                        </div>
                        <div style="font-size:10px; color:#888; margin-left:5px;">変更 &gt;</div>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div style="display:flex; align-items:center; width:100%; height:40px;">
                        <div style="margin-right:10px; font-size:14px; font-weight:bold; color:#aaa; width:15px;">${i+1}.</div>
                        <div style="flex:1; color:#555;">(空き)</div>
                        <div style="font-size:10px; color:#888;">変更 &gt;</div>
                    </div>
                `;
            }
            div.onclick = () => {
                MenuParty.targetSlot = i;
                document.getElementById('party-screen-slots').style.display = 'none';
                document.getElementById('party-screen-chars').style.display = 'flex';
                MenuParty.renderCharList();
            };
            list.appendChild(div);
        }
        
        // ★追加: 画面下部の閉じるボタン
        const closeBtnDiv = document.createElement('div');
        closeBtnDiv.style.marginTop = '20px';
        closeBtnDiv.innerHTML = `<button class="btn" style="width:100%; background:#444;" onclick="Menu.closeSubScreen('party')">閉じる</button>`;
        list.appendChild(closeBtnDiv);
    },
    
    renderCharList: () => {
        const list = document.getElementById('party-char-list');
        list.innerHTML = '<div class="list-item" style="justify-content:center; color:#f88;" onclick="MenuParty.setMember(null)">(この枠を空にする)</div>';
        
        // ... (中略: 既存のキャラリスト生成処理) ...
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
            const rarityLabel = (c.uid === 'p1') ? 'Player' : `[${c.rarity}]`;
            const rarityColor = (c.uid === 'p1') ? '#ffd700' : Menu.getRarityColor(c.rarity);
            
			// ★修正箇所: マスタデータから画像を取得
            const master = DB.CHARACTERS.find(m => m.id === c.charId);
            const imgUrl = c.img || (master ? master.img : null);
            const imgHtml = imgUrl ? `<img src="${imgUrl}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #555;">` : `<div style="width:40px; height:40px; background:#333; display:flex; align-items:center; justify-content:center; color:#555; font-size:9px; border-radius:4px; border:1px solid #555;">IMG</div>`;
			
			//const imgHtml = c.img ? `<img src="${c.img}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #555;">` : `<div style="width:40px; height:40px; background:#333; display:flex; align-items:center; justify-content:center; color:#555; font-size:9px; border-radius:4px; border:1px solid #555;">IMG</div>`;

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
                        <div style="font-size:10px; color:#aaa; display:flex; gap:8px;">
                            <span>攻:${s.atk}</span> <span>防:${s.def}</span> <span>魔:${s.mag}</span> <span>速:${s.spd}</span>
                        </div>
                    </div>
                </div>
            `;
            div.onclick = () => MenuParty.setMember(c.uid);
            list.appendChild(div);
        });

        // ★追加: 画面下部の戻るボタン (スロット選択へ)
        const backBtnDiv = document.createElement('div');
        backBtnDiv.style.marginTop = '20px';
        backBtnDiv.innerHTML = `<button class="btn" style="width:100%; background:#444;" onclick="document.getElementById('party-screen-chars').style.display='none'; document.getElementById('party-screen-slots').style.display='flex';">スロット選択に戻る</button>`;
        list.appendChild(backBtnDiv);
    },
    
    setMember: (uid) => {
        // ... (既存のsetMemberロジックは変更なし) ...
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
        MenuParty.renderSlots();
    }
};

/* ==========================================================================
   2.: プレイ状況画面 (クールな2列表示・文字サイズ調整版)
   ========================================================================== */

/* menus.js の MenuStatus オブジェクトを最新・高機能版に差し替え */

const MenuStatus = {
    createDOM: () => {
        if(document.getElementById('sub-screen-status')) return;
        const div = document.createElement('div');
        div.id = 'sub-screen-status';
        div.className = 'sub-screen';
        div.style.display = 'none';
        div.style.flexDirection = 'column';
        div.style.background = '#101010';
        div.innerHTML = `
            <div class="header-bar">
                <span style="color:#ffd700; font-weight:bold;">⚔️ 冒険の記録</span>
                <button class="btn" onclick="Menu.closeSubScreen('status')">戻る</button>
            </div>
            <div id="status-content" class="scroll-area" style="padding:15px; background:linear-gradient(180deg, #101010 0%, #1a1a1a 100%);"></div>
        `;
        document.getElementById('game-container').appendChild(div);
    },

    init: () => {
        MenuStatus.createDOM();
        MenuStatus.render();
    },

    render: () => {
        const content = document.getElementById('status-content');
        if(!content) return;
        
        const stats = App.data.stats || {};
        const dungeon = App.data.dungeon || { maxFloor: 0, tryCount: 0 };
        
        // モンスター図鑑の計算
        const bookCount = App.data.book ? App.data.book.monsters.length : 0;
        const totalMonsters = (typeof DB !== 'undefined' && DB.MONSTERS) ? DB.MONSTERS.length : 0;
        const bookRate = totalMonsters > 0 ? Math.floor((bookCount / totalMonsters) * 100) : 0;
        
        // 最高ダメージデータの取得
        const maxDmg = stats.maxDamage || { val: 0, actor: '未記録', skill: '-' };

        const row = (label, val, color='#fff', fontSize='14px') => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #333; align-items:center;">
                <span style="color:#aaa; font-size:11px;">${label}</span>
                <span style="color:${color}; font-weight:bold; font-size:${fontSize}; font-family:monospace;">${val}</span>
            </div>`;

        content.innerHTML = `
            <div style="background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:8px; padding:12px; margin-bottom:15px; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                <div style="font-size:10px; color:#ffd700; margin-bottom:8px; display:flex; align-items:center; gap:5px;">
                    <span style="background:#ffd700; width:3px; height:12px; display:inline-block;"></span> 冒険の足跡
                </div>
                ${row('ダンジョン最高到達', `${dungeon.maxFloor || 0} 階`, '#ffd700', '16px')}
                ${row('ダンジョン挑戦回数', `${dungeon.tryCount || 0} 回`)}
                ${row('モンスター図鑑進捗', `${bookCount} / ${totalMonsters} 種 (${bookRate}%)`, '#44ff44')}
                ${row('全滅回数', `${stats.wipeoutCount || 0} 回`, '#ff4444')}
            </div>

            <div style="background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:8px; padding:12px; margin-bottom:15px;">
                <div style="font-size:10px; color:#44ff44; margin-bottom:8px; display:flex; align-items:center; gap:5px;">
                    <span style="background:#44ff44; width:3px; height:12px; display:inline-block;"></span> 資産の記録
                </div>
                ${row('累計最高所持Gold', `${(stats.maxGold || 0).toLocaleString()} G`)}
                ${row('累計最高所持GEM', `${(stats.maxGems || 0).toLocaleString()} GEM`)}
            </div>

            <div style="background:rgba(255,255,255,0.05); border:1px solid #f44; border-radius:8px; padding:12px; margin-bottom:15px;">
                <div style="font-size:10px; color:#ff4444; margin-bottom:8px; display:flex; align-items:center; gap:5px;">
                    <span style="background:#ff4444; width:3px; height:12px; display:inline-block;"></span> 戦闘の極み
                </div>
                <div style="padding:5px 0;">
                    <div style="font-size:10px; color:#aaa; margin-bottom:5px;">歴代最高ダメージ</div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; border:1px dashed #555; padding:8px; border-radius:4px; background:rgba(0,0,0,0.3);">
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:12px; color:#fff; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                ${maxDmg.actor}
                            </div>
                            <div style="font-size:10px; color:#888; margin-top:2px;">
                                使用技: ${maxDmg.skill}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:24px; color:#ff4444; font-weight:bold; font-family:'Courier New', monospace; text-shadow:0 0 10px rgba(255,0,0,0.4);">
                                ${(maxDmg.val || 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn" style="width:100%; height:45px; background:#333; border:1px solid #666; margin-top:10px; font-weight:bold; letter-spacing:2px;" onclick="Menu.closeSubScreen('status')">メニューへ戻る</button>
        `;
    }
};

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
                if(it.def.type.includes('回復') || it.def.type.includes('蘇生') || it.def.type.includes('育成')) {
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
                target.currentHp = Math.floor(s.maxHp * 0.5);
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
                    case 107: target.level = 1;
                        target.exp = 0;
                        target.reincarnationCount = (target.reincarnationCount || 0) + 1;
                        msg = `${target.name}は 転生しレベル1に戻った！\n(転生回数: ${target.reincarnationCount}回目)`; 
                        break;
                }
            }

            if(success) {
                App.data.items[item.id]--;
                const currentCount = App.data.items[item.id];
                
                if(currentCount <= 0) delete App.data.items[item.id];
                
                App.save();
                Menu.msg(msg, () => {
                    // ★修正: 使い切った(個数がなくなった)場合はリスト画面に戻る
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

/* ==========================================================================
   4. 所持装備一覧 (フィルタ修正・純粋ソート版)
   ========================================================================== */
const MenuInventory = {
    selectedIds: [],
    filter: {
        category: 'ALL', 
        option: 'ALL'    
    },
    sortMode: 'NEWEST', // 'NEWEST': 取得順, 'RANK': Rank順

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
        MenuInventory.render();
    },

    // フィルタ・ソート更新
    updateState: (key, val) => {
        if (key === 'sortMode') MenuInventory.sortMode = val;
        else MenuInventory.filter[key] = val;
        MenuInventory.render();
    },

    // ロック切り替え
    toggleLock: (id) => {
        const item = App.data.inventory.find(i => i.id === id);
        if (item) {
            item.locked = !item.locked;
            App.save();
            MenuInventory.render();
        }
    },

    // メイン描画
    render: () => {
        document.getElementById('inventory-gold').innerText = App.data.gold;
        const ctrlDiv = document.getElementById('inventory-controls');
        if (!ctrlDiv) return;

        // データ参照の安全確保
        const rules = (typeof OPT_RULES !== 'undefined') ? OPT_RULES : (typeof DB !== 'undefined' && DB.OPT_RULES ? DB.OPT_RULES : []);

        // --- UI生成: 操作エリア ---
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
                    <select style="background:#333; color:#fff; font-size:10px; border:1px solid #555; flex:1; height:22px;" 
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
                    <select style="background:#333; color:#fff; font-size:10px; border:1px solid #555; flex:1; height:22px;" 
                        onchange="MenuInventory.updateState('sortMode', this.value)">
                        <option value="NEWEST" ${MenuInventory.sortMode === 'NEWEST' ? 'selected' : ''}>取得順</option>
                        <option value="RANK" ${MenuInventory.sortMode === 'RANK' ? 'selected' : ''}>Rank順</option>
                    </select>
                </div>
            </div>

            <div style="padding:8px 10px; display:flex; justify-content:space-between; align-items:center; background:#2a2a2a;">
                <span style="font-size:11px; color:#aaa;">選択: <span style="color:#fff;">${MenuInventory.selectedIds.length}</span> 個</span>
                <button class="btn" style="background:${MenuInventory.selectedIds.length > 0 ? '#800' : '#444'}; font-size:11px; padding:4px 12px;" 
                    onclick="MenuInventory.sellSelected()">選択した装備を売却</button>
            </div>
        `;

        const list = document.getElementById('inventory-list');
        list.innerHTML = '';

        // --- フィルタリング & ソート ---
        let items = App.data.inventory.map((item, idx) => ({ ...item, _originalIdx: idx }));

        // 抽出
        items = items.filter(item => {
            if (MenuInventory.filter.category !== 'ALL' && item.type !== MenuInventory.filter.category) return false;
            if (MenuInventory.filter.option !== 'ALL') {
                if (!item.opts) return false;
                const targetKey = MenuInventory.filter.option;
                if (!item.opts.some(o => (o.key + (o.elm ? '_' + o.elm : '')) === targetKey)) return false;
            }
            return true;
        });

        // --- 純粋なソート実行 (ロック優先を排除) ---
        const rarityOrder = { EX: 6, UR: 5, SSR: 4, SR: 3, R: 2, N: 1 };
        items.sort((a, b) => {
            if (MenuInventory.sortMode === 'RANK') {
                // Rank順 (降順)
                if (b.rank !== a.rank) return b.rank - a.rank;
                // 同Rankならレアリティ順
                const rA = rarityOrder[a.rarity] || 0;
                const rB = rarityOrder[b.rarity] || 0;
                if (rB !== rA) return rB - rA;
                // 同レアリティなら強化値順
                return (b.plus || 0) - (a.plus || 0);
            } else {
                // 取得順 (新しい順: 元のインデックスが大きい方が上)
                return b._originalIdx - a._originalIdx;
            }
        });

        if (items.length === 0) {
            list.innerHTML = `<div style="padding:40px; text-align:center; color:#555; font-size:12px;">装備がありません</div>`;
            return;
        }

        // --- リスト描画 ---
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.cssText = `flex-direction:column; align-items:flex-start; position:relative; ${MenuInventory.selectedIds.includes(item.id) ? 'background:#422; border-left:3px solid #f44;' : ''}`;

            // 装備中の判定
            const owner = App.data.characters.find(c => {
                if (!c.equips) return false;
                return Object.values(c.equips).some(e => e && e.id === item.id);
            });
            const rarityColor = Menu.getRarityColor(item.rarity || 'N');
            
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%; border-bottom:1px solid #333; padding-bottom:4px; margin-bottom:4px;">
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="checkbox" ${MenuInventory.selectedIds.includes(item.id) ? 'checked' : ''} ${item.locked || owner ? 'disabled' : ''}>
                        <span style="color:${rarityColor}; font-weight:bold;">${item.name}</span>
                        ${item.locked ? '<span style="color:#ffd700; font-size:10px;">🔒</span>' : ''}
                        ${owner ? `<span style="color:#f88; font-size:9px;">[${owner.name}]</span>` : ''}
                    </div>
                    <button class="btn" style="padding:2px 8px; font-size:9px; background:${item.locked ? '#644' : '#444'};" 
                        onclick="event.stopPropagation(); MenuInventory.toggleLock('${item.id}')">${item.locked ? '解除' : 'ロック'}</button>
                </div>
                ${Menu.getEquipDetailHTML(item, false)}
            `;
            
            div.onclick = () => {
                if (item.locked || owner) return;
                MenuInventory.toggleSelect(item.id);
            };
            list.appendChild(div);
        });
    },

    toggleSelect: (id) => {
        const idx = MenuInventory.selectedIds.indexOf(id);
        if (idx > -1) MenuInventory.selectedIds.splice(idx, 1);
        else MenuInventory.selectedIds.push(id);
        MenuInventory.render();
    },

    sellSelected: () => {
        const targets = App.data.inventory.filter(i => MenuInventory.selectedIds.includes(i.id));
        if (targets.length === 0) return Menu.msg("売却するアイテムを選択してください");
        
        const totalGold = targets.reduce((sum, i) => sum + Math.floor(i.val / 2), 0);
        Menu.confirm(`${targets.length} 個の装備を合計 ${totalGold}G で売却しますか？`, () => {
            MenuInventory.selectedIds.forEach(id => {
                const idx = App.data.inventory.findIndex(i => i.id === id);
                if (idx > -1) App.data.inventory.splice(idx, 1);
            });
            App.data.gold += totalGold;
            MenuInventory.selectedIds = [];
            App.save();
            Menu.msg(`${totalGold}G 獲得しました`);
            MenuInventory.render();
        });
    }
};

/* ==========================================================================
   5. 仲間一覧 & 詳細 (装備変更フィルタ・ソート・シナジー反映版)
   ========================================================================== */
/* ==========================================================================
   5. 仲間一覧 & 詳細 (装備変更フィルタ・ソート・シナジー反映・画像リセット対応版)
   ========================================================================== */
const MenuAllies = {
    selectedChar: null, 
    currentTab: 1,
    targetPart: null,     
    selectedEquip: null,  
    tempAlloc: null,
    _tempCandidates: [], 
    candidateFilter: 'ALL',
    candidateSortMode: 'RANK',

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
                    <span>仲間一覧</span>
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
        MenuAllies.candidateSortMode = 'RANK';
        
        MenuAllies.renderList();
    },

    renderList: () => {
        document.getElementById('allies-list-view').style.display = 'flex';
        document.getElementById('allies-detail-view').style.display = 'none';

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
            const curHp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
            const curMp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
            const inParty = App.data.party.includes(c.uid) ? '<span style="color:#4ff; font-weight:bold; font-size:10px; margin-right:4px;">[PT]</span>' : '';
            const lbText = c.limitBreak > 0 ? `<span style="color:#f0f; font-weight:bold; font-size:11px;">+${c.limitBreak}</span>` : '';
            const rarityLabel = (c.uid === 'p1') ? 'Player' : `[${c.rarity}]`;
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
                        <div style="font-size:10px; color:#aaa; display:flex; gap:8px;">
                            <span>攻:${s.atk}</span> <span>防:${s.def}</span> <span>魔:${s.mag}</span> <span>速:${s.spd}</span>
                        </div>
                    </div>
                </div>`;
            div.onclick = () => {
                MenuAllies.selectedChar = c;
                MenuAllies.currentTab = 1;
                MenuAllies.targetPart = null;
                MenuAllies.selectedEquip = null;
                MenuAllies.renderDetail();
            };
            list.appendChild(div);
        });
        const closeBtnDiv = document.createElement('div');
        closeBtnDiv.style.marginTop = '20px';
        closeBtnDiv.innerHTML = `<button class="btn" style="width:100%; background:#444;" onclick="Menu.closeSubScreen('allies')">閉じる</button>`;
        list.appendChild(closeBtnDiv);
    },

    switchChar: (dir) => {
        if (!MenuAllies.selectedChar) return;
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
        MenuAllies.selectedChar = chars[newIdx]; 
        MenuAllies.targetPart = null;
        MenuAllies.selectedEquip = null;
        const treeView = document.getElementById('allies-tree-view');
        if (treeView && treeView.style.display === 'flex') MenuAllies.renderTreeView();
        else MenuAllies.renderDetail();
    },

    getEquipFullDetailHTML: (eq) => {
        if (!eq) return '<span style="color:#555;">装備なし</span>';
        let stats = [];
        if(eq.data.atk) stats.push(`攻+${eq.data.atk}`);
        if(eq.data.def) stats.push(`防+${eq.data.def}`);
        if(eq.data.spd) stats.push(`速+${eq.data.spd}`);
        if(eq.data.mag) stats.push(`魔+${eq.data.mag}`);
        if(eq.data.finDmg) stats.push(`与ダメ+${eq.data.finDmg}%`);
        if(eq.data.finRed) stats.push(`被ダメ-${eq.data.finRed}%`);
		
        for (let key in eq.data) {
            if (key.startsWith('resists_')) {
                const label = Battle.statNames[key.replace('resists_', '')] || key;
                stats.push(`${label}耐+${eq.data[key]}%`);
            } else if (key.startsWith('attack_')) {
                const label = Battle.statNames[key.replace('attack_', '')] || key;
                stats.push(`攻撃時${eq.data[key]}%で${label}`);
            }
        }
		
        let baseHtml = `<div style="font-size:10px; color:#ccc;">${stats.join(' ')}</div>`;
        let optsHtml = '';
        if (eq.opts && eq.opts.length > 0) {
            const optsList = eq.opts.map(o => {
                const color = Menu.getRarityColor(o.rarity || 'N');
                const unit = o.unit === 'val' ? '' : o.unit;
                return `<div style="color:${color}; font-size:10px;">[${o.rarity}] ${o.label} +${o.val}${unit}</div>`;
            }).join('');
            optsHtml = `<div style="margin-top:2px;">${optsList}</div>`;
        }

        let synHtml = '';
        if (typeof App.checkSynergy === 'function') {
            const syns = App.checkSynergy(eq);
            if (syns && syns.length > 0) {
                synHtml = syns.map(syn => 
                    `<div style="margin-top:2px; font-size:10px; color:${syn.color||'#f88'};">★${syn.name}: ${syn.desc}</div>`
                ).join('');
            }
        }
        return `<div>${baseHtml}${optsHtml}${synHtml}</div>`;
    },

    renderDetail: () => {
        document.getElementById('allies-list-view').style.display = 'none'; 
        const treeView = document.getElementById('allies-tree-view');
        if (treeView) treeView.style.display = 'none';
        document.getElementById('allies-detail-view').style.display = 'flex';
        
        const c = MenuAllies.selectedChar;
        const s = App.calcStats(c);
        
        const master = DB.CHARACTERS.find(m => m.id === c.charId);
        const imgUrl = c.img || (master ? master.img : null);
        
        const hp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
        const mp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
        const lb = c.limitBreak || 0;
        const nextExp = App.getNextExp(c);
        const nextExpText = nextExp === Infinity ? "MAX" : nextExp;

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

        const imgHtml = imgUrl ? `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#888;">IMG</div>`;
        
        const tabs = ['基本', '装備', 'スキル'];
        const tabBtns = tabs.map((t, i) => {
            const idx = i + 1;
            const active = MenuAllies.currentTab === idx ? 'border-bottom:2px solid #ffd700; color:#ffd700;' : 'color:#888;';
            return `<button onclick="MenuAllies.currentTab=${idx}; MenuAllies.targetPart=null; MenuAllies.selectedEquip=null; MenuAllies.renderDetail()" style="flex:1; background:#333; border:none; padding:8px; font-size:12px; ${active}">${t}</button>`;
        }).join('');

        let contentHtml = '';
        
        if (MenuAllies.currentTab === 1) {
            let activeSynergies = [];
            if (c.equips) {
                CONST.PARTS.forEach(p => {
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
                synergiesHtml = `<div style="margin-top:10px; background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:4px; padding:5px;">
                    <div style="font-size:10px; color:#ffd700; margin-bottom:3px; text-align:center;">発動中のシナジー</div>
                    ${activeSynergies.map(syn => `<div style="font-size:10px; color:${syn.color||'#fff'}; margin-bottom:2px;">★${syn.name}: ${syn.desc} </div>`).join('')}
                </div>`;
            }

            const totalAllocPt = Math.floor((lb || 0) / 10) * 10;
            const usedAllocPt = c.alloc ? Object.values(c.alloc).reduce((a, b) => a + b, 0) : 0;
            const freeAllocPt = Math.max(0, totalAllocPt - usedAllocPt);

            const allocBtn = (c.uid === 'p1') ? `<button class="btn" style="width:100%; margin-top:5px; background:#444400; font-size:11px;" onclick="MenuAllies.openAllocModal()">ボーナスPt振分 (残:${freeAllocPt})</button>` : '';
            const treeBtn = `<button class="btn" style="width:100%; margin-top:5px; background:#004444; font-size:11px;" onclick="MenuAllies.openTreeView()">スキル習得画面へ (SP:${c.sp||0})</button>`;
            const archiveBtn = `<button class="btn" style="width:100%; margin-top:5px; background:#602060; font-size:11px;" onclick="MenuAllyDetail.init(MenuAllies.selectedChar)">キャラクター詳細・アーカイブを見る</button>`;
            
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
                <div style="display:flex; flex-direction:column; margin-top:10px;">
                    ${treeBtn}
                    ${allocBtn}
                    ${synergiesHtml}
                    ${archiveBtn}
                </div>`;
        } else if (MenuAllies.currentTab === 2) {
            if (MenuAllies.targetPart) {
                if (MenuAllies.selectedEquip) {
                    const newItem = MenuAllies.selectedEquip;
                    const isRemove = newItem.isRemove;
                    const dummy = JSON.parse(JSON.stringify(c));
                    if (isRemove) dummy.equips[MenuAllies.targetPart] = null;
                    else dummy.equips[MenuAllies.targetPart] = newItem;
                    const sCur = App.calcStats(c);
                    const sNew = App.calcStats(dummy);

                    const statRow = (label, key, isPercent=false, isReduc=false) => {
                        let v1, v2;
                        if (isPercent && key.includes('_')) { const [prop, subKey] = key.split('_'); v1 = sCur[prop][subKey] || 0; v2 = sNew[prop][subKey] || 0; }
                        else { v1 = sCur[key] || 0; v2 = sNew[key] || 0; }
                        let diff = v2 - v1;
                        let color = diff > 0 ? '#4f4' : (diff < 0 ? '#f44' : '#888');
                        if (isReduc) color = diff < 0 ? '#4f4' : (diff > 0 ? '#f44' : '#888');
                        let diffStr = (diff === 0) ? '±0' : (diff > 0 ? '+' : '') + diff;
                        return `<div style="font-size:11px; background:#2c2c2c; padding:4px; border-radius:2px; display:flex; flex-direction:column; justify-content:space-between; height:100%;"><div style="color:#aaa; font-size:10px; text-align:center; font-weight:bold;">${label}</div><div style="text-align:center;"><span style="color:#888; font-size:10px;">${v1}${isPercent?'%':''} →</span> <span style="color:${color}; font-weight:bold;">${v2}${isPercent?'%':''}</span> <span style="font-size:9px; color:${color};">(${diffStr}${isPercent?'%':''})</span></div></div>`;
                    };

                    let statRows = '';
                    const gridStart = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:8px;">';
                    const gridEnd = '</div>';

                    statRows += gridStart;
                    statRows += statRow('HP', 'maxHp');
                    statRows += statRow('MP', 'maxMp');
                    statRows += gridEnd;

                    statRows += gridStart;
                    statRows += statRow('攻撃力', 'atk');
                    statRows += statRow('防御力', 'def');
                    statRows += gridEnd;

                    statRows += gridStart;
                    statRows += statRow('魔力', 'mag');
                    statRows += statRow('素早さ', 'spd'); 
                    statRows += gridEnd;

                    statRows += gridStart;
                    statRows += statRow('与ダメージ', 'finDmg', true, false);
                    statRows += statRow('被ダメ軽減', 'finRed', true, true); 
                    statRows += gridEnd;

                    CONST.ELEMENTS.forEach(e => {
                        statRows += gridStart;
                        statRows += statRow(`${e}攻撃`, `elmAtk_${e}`, true, false);
                        statRows += statRow(`${e}耐性`, `elmRes_${e}`, true, false);
                        statRows += gridEnd;
                    });

                    const buttonsHtml = `<div style="display:flex; gap:10px; margin: 10px 0;"><button class="btn" style="flex:1; background:#555;" onclick="MenuAllies.selectedEquip=null; MenuAllies.renderDetail()">やめる</button><button class="btn" style="flex:1; background:#d00;" onclick="MenuAllies.doEquip()">変更する</button></div>`;
                    contentHtml = `<div style="padding:10px; text-align:center; color:#ffd700; font-weight:bold; border-bottom:1px solid #444;">装備変更の確認 (${MenuAllies.targetPart})</div><div style="padding:5px; text-align:center; font-size:14px; color:${isRemove?'#aaa':Menu.getRarityColor(newItem.rarity)}; margin-bottom:3px;">${isRemove?'(装備を外す)':newItem.name} に変更しますか？</div>${buttonsHtml}<div style="background:#222; border:1px solid #444; border-radius:4px; margin-bottom:10px; padding:10px;">${statRows}</div>${buttonsHtml}`;
                } else {
                    const p = MenuAllies.targetPart;
                    const rules = (typeof OPT_RULES !== 'undefined') ? OPT_RULES : (typeof DB !== 'undefined' && DB.OPT_RULES ? DB.OPT_RULES : []);

                    let candidates = [{id:'remove', name:'(装備を外す)', isRemove:true, _originalIdx:-999}]; 
                    App.data.inventory.filter(i => i.type === p).forEach((i, idx) => candidates.push({...i, _originalIdx: idx}));
                    App.data.characters.forEach(other => { if(other.uid !== c.uid && other.equips[p]) candidates.push({...other.equips[p], owner:other.name, _originalIdx: -1}); });

                    if (MenuAllies.candidateFilter !== 'ALL') {
                        candidates = candidates.filter(item => {
                            if (item.isRemove) return true;
                            if (!item.opts) return false;
                            return item.opts.some(o => (o.key + (o.elm ? '_' + o.elm : '')) === MenuAllies.candidateFilter);
                        });
                    }

                    const rarityOrder = { EX: 6, UR: 5, SSR: 4, SR: 3, R: 2, N: 1 };
                    candidates.sort((a, b) => {
                        if (a.isRemove) return -1; if (b.isRemove) return 1;
                        if (MenuAllies.candidateSortMode === 'RANK') {
                            if (b.rank !== a.rank) return b.rank - a.rank;
                            const rA = rarityOrder[a.rarity] || 0;
                            const rB = rarityOrder[b.rarity] || 0;
                            if (rB !== rA) return rB - rA;
                            return (b.plus || 0) - (a.plus || 0);
                        } else {
                            return b._originalIdx - a._originalIdx;
                        }
                    });

                    MenuAllies._tempCandidates = candidates;

                    contentHtml = `
                        <div style="margin-bottom:8px; display:flex; flex-direction:column; gap:4px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-weight:bold; color:#ffd700;">${p} の変更</span>
                                <button class="btn" style="background:#555; font-size:10px; padding:2px 8px;" onclick="MenuAllies.targetPart=null; MenuAllies.renderDetail()">戻る</button>
                            </div>
                            <div style="display:flex; gap:4px; align-items:center;">
                                <select style="background:#333; color:#fff; font-size:10px; flex:1; height:20px;" onchange="MenuAllies.candidateFilter=this.value; MenuAllies.renderDetail()">
                                    <option value="ALL">全ての効果</option>
                                    ${rules.map(opt => `<option value="${opt.key}${opt.elm?'_'+opt.elm:''}" ${MenuAllies.candidateFilter===(opt.key+(opt.elm?'_'+opt.elm:''))?'selected':''}>${opt.name}</option>`).join('')}
                                </select>
                                <select style="background:#333; color:#fff; font-size:10px; flex:1; height:20px;" onchange="MenuAllies.candidateSortMode=this.value; MenuAllies.renderDetail()">
                                    <option value="RANK" ${MenuAllies.candidateSortMode==='RANK'?'selected':''}>Rank順</option>
                                    <option value="NEWEST" ${MenuAllies.candidateSortMode==='NEWEST'?'selected':''}>取得順</option>
                                </select>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            ${candidates.map((item, idx) => `
                                <div class="list-item" style="flex-direction:column; align-items:flex-start;" onclick="MenuAllies.selectCandidate(${idx}, ${item.isRemove?'true':'false'})">
                                    <div style="font-weight:bold; color:${item.isRemove ? '#aaa' : Menu.getRarityColor(item.rarity)};">${item.name} ${item.owner ? `<span style="color:#f88; font-size:9px;">[${item.owner}装備中]</span>` : ''}</div>
                                    ${!item.isRemove ? MenuAllies.getEquipFullDetailHTML(item) : ''}
                                </div>`).join('')}
                        </div>`;
                }
            } else {
                let listHtml = '';
                CONST.PARTS.forEach(p => {
                    const eq = c.equips[p];
                    listHtml += `<div class="list-item" style="align-items:center;" onclick="MenuAllies.targetPart='${p}'; MenuAllies.selectedEquip=null; MenuAllies.renderDetail();"><div style="width:30px; font-size:10px; color:#aaa; font-weight:bold;">${p}</div><div style="flex:1;"><div style="font-size:12px; font-weight:bold; color:${eq ? Menu.getRarityColor(eq.rarity) : '#888'};">${eq ? eq.name : 'なし'}</div>${MenuAllies.getEquipFullDetailHTML(eq)}</div><div style="font-size:10px; color:#aaa; margin-left:5px;">変更 &gt;</div></div>`;
                });
                contentHtml = `<div style="display:flex; flex-direction:column; gap:2px;">${listHtml}</div>`;
            }
        } else if (MenuAllies.currentTab === 3) {
            const playerObj = new Player(c);
            if (!c.config) c.config = { fullAuto: false, hiddenSkills: [] };
            const autoStatus = c.config.fullAuto;
            let skillHtml = '';

            if(!playerObj.skills || playerObj.skills.length === 0) {
                skillHtml = '<div style="padding:20px; text-align:center; color:#555;">習得スキルなし</div>';
            } else {
                skillHtml = playerObj.skills.map(sk => {
                    if (sk.id === 1) return '';
                    const isHidden = c.config.hiddenSkills.includes(Number(sk.id));
                    let elmHtml = '';
                    if (sk.elm) {
                        const colors = { '火':'#f88', '水':'#88f', '雷':'#ff0', '風':'#8f8', '光':'#ffc', '闇':'#a8f', '混沌':'#d4d' };
                        let color = colors[sk.elm] || '#ccc';
                        elmHtml = `<span style="color:${color}; margin-right:3px;">[${sk.elm}]</span>`;
                    }
                    return `
                        <div style="background:${isHidden ? 'rgba(0,0,0,0.2)' : '#252525'}; border:1px solid #444; border-radius:4px; padding:6px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                            <div style="flex:1;">
                                <div style="font-size:12px; font-weight:bold; color:${isHidden ? '#666' : '#ddd'};">${elmHtml}${sk.name} <span style="font-size:10px; color:#888;">(${sk.type})</span></div>
                                <div style="font-size:10px; color:#aaa;">${sk.desc || ''}</div>
                            </div>
                            <div style="text-align:right; min-width:80px;">
                                <div style="font-size:11px; color:#88f; margin-bottom:4px;">MP:${sk.mp}</div>
                                <button class="btn" style="padding:2px 8px; font-size:10px; background:${isHidden ? '#555' : '#3a3'};" onclick="MenuAllies.toggleSkillVisibility(${sk.id})">
                                    ${isHidden ? '封印中' : '使用許可'}
                                </button>
                            </div>
                        </div>`;
                }).join('');
            }
            
            contentHtml = `
                <div style="margin-bottom:10px; padding:8px; background:#333; border-radius:4px; border:1px solid #444;">
                    <button class="btn" style="width:100%; background:${autoStatus ? '#d00' : '#444'}; font-weight:bold; font-size:11px;" onclick="MenuAllies.toggleFullAuto()">
                        フルオート(スキル使用): ${autoStatus ? 'ON' : 'OFF'}
                    </button>
                </div>
                <div style="display:flex; flex-direction:column;">${skillHtml}</div>`;
        }

        const view = document.getElementById('allies-detail-view');
        view.innerHTML = `
            <div style="padding:10px 10px 0 10px; background:#222;"><button class="btn" style="width:100%; background:#444;" onclick="MenuAllies.renderList()">一覧に戻る</button></div>
            <div style="padding:10px; background:#222; border-bottom:1px solid #444;"><div style="display:flex; justify-content:space-between; align-items:center; background:#333; padding:5px; border-radius:4px;"><button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuAllies.switchChar(-1)">＜ 前</button><span style="font-size:12px; color:#aaa;">仲間詳細</span><button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuAllies.switchChar(1)">次 ＞</button></div></div>
            <div class="scroll-container-inner" style="flex:1; overflow-y:auto; padding:10px; font-family:sans-serif; color:#ddd;">
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <div style="position:relative; width:80px; height:80px; background:#000; border:1px solid #555; display:flex; align-items:center; justify-content:center; flex-shrink:0; border-radius:4px;">
                        <div style="width:100%; height:100%; cursor:pointer;" onclick="document.getElementById('file-upload-${c.uid}').click()">
                            ${imgHtml}
                            <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.6); color:#fff; font-size:8px; text-align:center; padding:2px 0;">画像変更</div>
                        </div>
                        ${c.img ? `<div onclick="event.stopPropagation(); MenuAllies.resetImage('${c.uid}')" style="position:absolute; top:-5px; right:-5px; width:20px; height:20px; background:#d00; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; border:1px solid #fff; cursor:pointer; z-index:10;">×</div>` : ''}
                    </div>
                    <input type="file" id="file-upload-${c.uid}" style="display:none" accept="image/*" onchange="MenuAllies.uploadImage(this, '${c.uid}')">
                    <div style="flex:1;">
                        <div id="char-name-display" style="display:flex; align-items:center; margin-bottom:2px;"><div style="font-size:16px; font-weight:bold; color:#fff; margin-right:5px;">${c.name}</div><div style="font-size:12px; color:#f0f; font-weight:bold;">+${lb}</div><button class="btn" style="margin-left:auto; padding:0 6px; font-size:10px;" onclick="window.toggleNameEdit()">✎</button></div>
                        <div id="char-name-edit" style="display:none; align-items:center; margin-bottom:2px;"><input type="text" id="char-name-input" value="${c.name}" maxlength="10" style="width:100px; background:#333; color:#fff; border:1px solid #888; padding:2px; font-size:12px;"><button class="btn" style="margin-left:5px; padding:2px 6px; font-size:10px;" onclick="window.saveName()">OK</button></div>
                        <div style="font-size:11px; color:#aaa; margin-bottom:4px;">${c.job} Lv.${c.level} / ${c.rarity} Rank</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;"><div style="background:#333; padding:2px 4px; border-radius:3px;"><div style="font-size:8px; color:#aaa;">HP</div><div style="font-weight:bold; font-size:11px; color:#8f8;">${hp}/${s.maxHp}</div></div><div style="background:#333; padding:2px 4px; border-radius:3px;"><div style="font-size:8px; color:#aaa;">MP</div><div style="font-weight:bold; font-size:11px; color:#88f;">${mp}/${s.maxMp}</div></div><div style="background:#333; padding:2px 4px; border-radius:3px;"><div style="font-size:8px; color:#aaa;">Exp</div><div style="font-weight:bold; font-size:9px; color:#fff;">N:${nextExpText} / T:${c.exp}</div></div></div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:2px; margin-bottom:10px;">
                    <div style="background:#2a2a2a; padding:4px; text-align:center;"><span style="font-size:10px; color:#aaa;">攻撃力</span><br><span style="font-weight:bold; font-size:12px;">${s.atk}</span></div>
                    <div style="background:#2a2a2a; padding:4px; text-align:center;"><span style="font-size:10px; color:#aaa;">防御力</span><br><span style="font-weight:bold; font-size:12px;">${s.def}</span></div>
                    <div style="background:#2a2a2a; padding:4px; text-align:center;"><span style="font-size:10px; color:#aaa;">素早さ</span><br><span style="font-weight:bold; font-size:12px;">${s.spd}</span></div>
                    <div style="background:#2a2a2a; padding:4px; text-align:center;"><span style="font-size:10px; color:#aaa;">魔力</span><br><span style="font-weight:bold; font-size:12px;">${s.mag}</span></div>
                </div>
                <div style="display:flex; margin-bottom:10px;">${tabBtns}</div>
                <div>${contentHtml}</div>
                <div style="margin-top:20px; display:flex; gap:10px; padding-bottom:10px;"><button class="btn" style="flex:1; background:#444;" onclick="MenuAllies.renderList()">一覧に戻る</button><button class="btn" style="flex:1; background:#444;" onclick="Menu.closeSubScreen('allies')">メニューを閉じる</button></div>
            </div>
        `;
    },
	
    selectCandidate: (idx, isRemove) => {
        if (isRemove) MenuAllies.selectedEquip = { isRemove: true, name: '(装備を外す)' };
        else MenuAllies.selectedEquip = MenuAllies._tempCandidates[idx];
        MenuAllies.renderDetail();
    },

    doEquip: () => {
        const c = MenuAllies.selectedChar;
        const p = MenuAllies.targetPart;
        const newItem = MenuAllies.selectedEquip;
        const oldItem = c.equips[p];
        if(oldItem) App.data.inventory.push(oldItem);
        if(newItem && newItem.isRemove) c.equips[p] = null;
        else if(newItem) {
            let itemIdx = App.data.inventory.findIndex(i => i.id === newItem.id);
            if(itemIdx > -1) { c.equips[p] = App.data.inventory[itemIdx]; App.data.inventory.splice(itemIdx, 1); }
            else { const owner = App.data.characters.find(ch => ch.equips[p] && ch.equips[p].id === newItem.id); if(owner) { c.equips[p] = owner.equips[p]; owner.equips[p] = null; } }
        }
        App.save();
        MenuAllies.selectedEquip = null;
        MenuAllies.targetPart = null;
        MenuAllies.renderDetail();
    },

    toggleSkillVisibility: (sid) => {
        const c = MenuAllies.selectedChar;
        if (!c || !c.config) return;
        const numSid = Number(sid);
        const index = c.config.hiddenSkills.indexOf(numSid);
        if (index > -1) c.config.hiddenSkills.splice(index, 1);
        else c.config.hiddenSkills.push(numSid);
        App.save();
        MenuAllies.refreshDetailScroll();
    },

    toggleFullAuto: () => {
        const c = MenuAllies.selectedChar;
        if (!c || !c.config) return;
        c.config.fullAuto = !c.config.fullAuto;
        App.save();
        MenuAllies.refreshDetailScroll();
    },

    refreshDetailScroll: () => {
        const container = document.querySelector('#allies-detail-view .scroll-container-inner');
        const scrollPos = container ? container.scrollTop : 0;
        MenuAllies.renderDetail();
        const newContainer = document.querySelector('#allies-detail-view .scroll-container-inner');
        if (newContainer) newContainer.scrollTop = scrollPos;
    },

    uploadImage: (input, uid) => {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (file.size > 500 * 1024) { Menu.msg("画像サイズが大きすぎます(500KB以下)"); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                const char = App.getChar(uid);
                if (char) { char.img = e.target.result; App.save(); Menu.renderPartyBar(); MenuAllies.renderDetail(); }
            };
            reader.readAsDataURL(file);
        }
    },

    // ★追加: 画像を削除して初期状態（マスタ画像）に戻す
    resetImage: (uid) => {
        const char = App.getChar(uid);
        if (char && char.img) {
            Menu.confirm("画像を初期状態に戻しますか？", () => {
                delete char.img; // カスタム画像を削除
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
        div.className = 'flex-col-container';
        div.style.display = 'none';
        div.style.background = '#1a1a1a';
        div.innerHTML = `<div class="header-bar" id="tree-header"></div><div id="tree-content" class="scroll-area" style="padding:10px;"></div><button class="btn" style="margin:10px;" onclick="MenuAllies.renderDetail()">戻る</button>`;
        document.getElementById('sub-screen-allies').appendChild(div);
    },

    openTreeView: () => {
        document.getElementById('allies-detail-view').style.display = 'none';
        document.getElementById('allies-tree-view').style.display = 'flex';
        MenuAllies.renderTreeView();
    },

    renderTreeView: () => {
        const c = MenuAllies.selectedChar;
        const sp = c.sp || 0;
        const header = document.getElementById('tree-header');
        header.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"><div style="display:flex; align-items:center;"><button class="btn" style="padding:2px 10px;" onclick="MenuAllies.switchChar(-1)">＜</button><span style="margin:0 10px;">${c.name} (SP:${sp})</span><button class="btn" style="padding:2px 10px;" onclick="MenuAllies.switchChar(1)">＞</button></div><button class="btn" style="background:#500; font-size:10px; padding:2px 5px;" onclick="MenuAllies.resetTree()">RESET</button></div>`;
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

/* ==========================================================================
    6. スキル使用
    ========================================================================== */
const MenuSkills = {
    selectedCharUid: null,
    selectedSkill: null,

    init: () => {
        document.getElementById('sub-screen-skills').style.display = 'flex';
        MenuSkills.changeScreen('char');
    },

    changeScreen: (mode) => {
        document.getElementById('skill-screen-char').style.display = (mode === 'char' ? 'flex' : 'none');
        document.getElementById('skill-screen-skill').style.display = (mode === 'skill' ? 'flex' : 'none');
        document.getElementById('skill-screen-target').style.display = (mode === 'target' ? 'flex' : 'none');
        if (mode === 'char') MenuSkills.renderCharList();
    },

    renderCharList: () => {
        const list = document.getElementById('skill-char-list');
        list.innerHTML = '';
        App.data.party.forEach(uid => {
            if (!uid) return;
            const c = App.getChar(uid);
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = App.createCharHTML(c);
            div.onclick = () => {
                MenuSkills.selectedCharUid = uid;
                MenuSkills.renderSkillList();
            };
            list.appendChild(div);
        });
    },

    renderSkillList: () => {
        MenuSkills.changeScreen('skill');
        const list = document.getElementById('skill-list');
        list.innerHTML = '';
        const c = App.getChar(MenuSkills.selectedCharUid);
        const player = new Player(c);
        const skills = player.skills.filter(s => s.type.includes('回復') || s.type.includes('蘇生'));

        if (skills.length === 0) {
            list.innerHTML = '<div style="padding:10px; color:#888;">使用可能なスキルがありません</div>';
            return;
        }

        skills.forEach(sk => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:bold;">${sk.name}</div>
                    <div style="font-size:10px; color:#aaa;">${sk.desc || ''}</div>
                </div>
                <div style="font-size:12px; color:#88f;">MP:${sk.mp}</div>
            `;
            div.onclick = () => {
                if (c.currentMp < sk.mp) { Menu.msg("MPが足りません"); return; }
                MenuSkills.selectedSkill = sk;

                // ★全体スキルの場合はターゲット選択をスキップして直接実行へ
                if (sk.target === '全体') {
                    MenuSkills.useSkill(null);
                } else {
                    MenuSkills.renderTargetList();
                }
            };
            list.appendChild(div);
        });
    },

    renderTargetList: () => {
        MenuSkills.changeScreen('target');
        const list = document.getElementById('skill-target-list');
        list.innerHTML = '';
        App.data.party.forEach(uid => {
            if (!uid) return;
            const c = App.getChar(uid);
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = App.createCharHTML(c);
            div.onclick = () => MenuSkills.useSkill(c);
            list.appendChild(div);
        });
    },

    useSkill: (target) => {
        const actorData = App.getChar(MenuSkills.selectedCharUid);
        const sk = MenuSkills.selectedSkill;
        if (!actorData || !sk) return;

        const confirmMsg = (sk.target === '全体') ? `パーティ全体に ${sk.name} を使いますか？` : `${target.name} に ${sk.name} を使いますか？`;

        Menu.confirm(confirmMsg, () => {
            let targets = (sk.target === '全体') ? App.data.party.map(uid => App.getChar(uid)).filter(c => c) : [target];
            let effected = false;

            const actorStats = App.calcStats(actorData);
            const mag = actorStats.mag;
            
            // 成功率の取得 (バトルロジック準拠)
            const rawSuccessRate = sk.SuccessRate !== undefined ? sk.SuccessRate : 100;
            const successRate = (rawSuccessRate <= 1 && rawSuccessRate > 0) ? rawSuccessRate * 100 : rawSuccessRate;

            targets.forEach(t => {
                if (!t) return;
                const s = App.calcStats(t);
                const tMaxHp = s.maxHp;

                // ★成功判定 (バトルと同じ確率計算)
                if (Math.random() * 100 > successRate) return;

                if (sk.type.includes('回復')) {
                    // 生存者のみ回復
                    if (t.currentHp > 0 && t.currentHp < tMaxHp) {
                        let rec = 0;
                        if (sk.ratio) {
                            rec = Math.floor(tMaxHp * sk.ratio);
                        } else {
                            // ★修正：(魔力 * 倍率 + 基礎) * 乱数(0.85～1.15)
                            const baseVal = sk.fix ? (sk.base || 0) : (mag * (sk.rate || 1.0) + (sk.base || 0));
                            rec = Math.floor(baseVal * (0.85 + Math.random() * 0.3));
                        }
                        t.currentHp = Math.min(tMaxHp, (t.currentHp || 0) + rec);
                        effected = true;
                    }
                } else if (sk.type.includes('蘇生')) {
                    // 死者のみ蘇生
                    if (!t.currentHp || t.currentHp <= 0) {
                        // ★修正：蘇生HP量 (バトルと同じ)
                        const resRate = sk.rate !== undefined ? sk.rate : 0.5;
                        t.currentHp = Math.max(1, Math.floor(tMaxHp * resRate));
                        effected = true;
                    }
                }
            });

            if (effected) {
                actorData.currentMp -= sk.mp;
                App.save();
                Menu.msg(`${sk.name}を使用した！`, () => {
                    // 全体スキルの後はスキル一覧へ、単体はターゲット一覧を更新
                    if (sk.target === '全体') MenuSkills.renderSkillList();
                    else MenuSkills.renderTargetList();
                    Menu.renderPartyBar();
                });
            } else {
                Menu.msg("効果がありませんでした");
                if (sk.target === '全体') MenuSkills.renderSkillList();
            }
        });
    }
};

/* ==========================================================================
   7. 魔物図鑑 (詳細表示・行動確率非表示版)
   ========================================================================== */
const MenuBook = {
    // 状態管理
    currentMode: 'list',
    selectedMonster: null,

    init: () => {
        // コンテナの準備
        const container = document.getElementById('sub-screen-book');
        if (!document.getElementById('book-detail-view')) {
            const detailDiv = document.createElement('div');
            detailDiv.id = 'book-detail-view';
            detailDiv.className = 'flex-col-container';
            detailDiv.style.display = 'none';
            detailDiv.style.background = '#222'; 
            detailDiv.style.height = '100%'; // 高さ確保
            container.appendChild(detailDiv);
        }
        MenuBook.showList();
    },

    // 画像取得ヘルパー
    getMonsterImgSrc: (m) => {
        if (m.img) return m.img;
        if (typeof GRAPHICS === 'undefined' || !GRAPHICS.images) return null;
        let baseName = m.name
            .replace(/^(強・|真・|極・|神・)+/, '') 
            .replace(/ Lv\d+[A-Z]?$/, '')
            .replace(/[A-Z]$/, '')
            .trim();
        const imgKey = 'monster_' + baseName;
        if (GRAPHICS.images[imgKey]) return GRAPHICS.images[imgKey].src;
        return null;
    },

    // --- リスト画面 ---
    showList: () => {
        document.getElementById('book-list').style.display = 'block';
        document.getElementById('book-detail-view').style.display = 'none';
        
        const headerBtn = document.querySelector('#sub-screen-book .header-bar button');
        if(headerBtn) {
            headerBtn.innerText = '戻る';
            headerBtn.onclick = () => Menu.closeSubScreen('book');
        }
        MenuBook.renderList();
    },

    renderList: () => {
        const list = document.getElementById('book-list');
        list.innerHTML = '';
        const defeated = App.data.book.monsters || [];
        const killCounts = App.data.book.killCounts || {}; // 討伐データ取得
        
        DB.MONSTERS.forEach(m => {
            const isKnown = defeated.includes(m.id);
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.alignItems = 'flex-start';
            div.style.padding = '8px'; // 微調整: 余白の最適化

            if(isKnown) {
                const killCount = killCounts[m.id] || 0; // 討伐数取得
                
                // リスト表示用: 行動内容の概要
                const skillNames = (m.acts || []).map(act => {
                    const id = (typeof act === 'object') ? act.id : act;
                    const s = DB.SKILLS.find(k => k.id === id);
                    return s ? s.name : '通常攻撃';
                }).slice(0, 3).join(', ') + ((m.acts||[]).length > 3 ? '...' : '');

                const imgSrc = MenuBook.getMonsterImgSrc(m);
                const imgContent = imgSrc 
                    ? `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain;">`
                    : `<span style="color:#555;font-size:10px;">NO IMG</span>`;

                div.innerHTML = `
                    <div style="width:64px; height:64px; background:#1a1a1a; border:1px solid #444; margin-right:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:4px;">
                        ${imgContent}
                    </div>
                    <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; min-height:64px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:2px; margin-bottom:2px;">
                            <span style="font-size:15px; font-weight:bold; color:#f88;">${m.name}</span>
                            <span style="font-size:10px; color:#ffd700; background:rgba(255,215,0,0.1); padding:0 4px; border-radius:2px;">討伐数: ${killCount}</span>
                        </div>
                        <div style="font-size:10px; color:#ccc; display:flex; gap:6px;">
                            <span>HP:${m.hp}</span> <span>攻:${m.atk}</span> <span>防:${m.def}</span> <span>魔:${m.mag}</span> <span>速:${m.spd}</span>
                        </div>
                        <div style="font-size:10px; color:#aaa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">
                            行動: ${skillNames}
                        </div>
                    </div>
                `;
                div.onclick = () => MenuBook.showDetail(m);
            } else {
                div.innerHTML = `
                    <div style="width:64px; height:64px; background:#111; border:1px solid #333; margin-right:10px; flex-shrink:0; border-radius:4px;"></div>
                    <div style="flex:1; display:flex; align-items:center; height:64px;">
                        <span style="color:#444; font-size:20px; letter-spacing:4px; font-weight:bold;">？？？</span>
                    </div>
                `;
            }
            list.appendChild(div);
        });
    },

    // --- 前後のモンスターへ切り替え ---
    switchMonster: (dir) => {
        const defeatedIds = App.data.book.monsters || [];
        const validMonsters = DB.MONSTERS.filter(m => defeatedIds.includes(m.id));
        
        if (validMonsters.length === 0) return;

        let currentIndex = -1;
        if (MenuBook.selectedMonster) {
            currentIndex = validMonsters.findIndex(m => m.id === MenuBook.selectedMonster.id);
        }

        let newIndex = currentIndex + dir;
        if (newIndex < 0) newIndex = validMonsters.length - 1;
        if (newIndex >= validMonsters.length) newIndex = 0;

        MenuBook.showDetail(validMonsters[newIndex]);
    },

	// --- 詳細画面 (討伐数・ステータス枠の統一版) ---
    showDetail: (monster) => {
        MenuBook.selectedMonster = monster;
        // 討伐数データの取得
        const killCount = (App.data.book.killCounts && App.data.book.killCounts[monster.id]) || 0;

        const view = document.getElementById('book-detail-view');
        const list = document.getElementById('book-list');
        list.style.display = 'none';
        view.style.display = 'flex'; 
        view.style.flexDirection = 'column';
        view.style.overflow = 'hidden'; 

        const headerBtn = document.querySelector('#sub-screen-book .header-bar button');
        if(headerBtn) {
            headerBtn.innerText = '一覧へ';
            headerBtn.onclick = () => MenuBook.showList();
        }

        const imgSrc = MenuBook.getMonsterImgSrc(monster);
        const imgHtml = imgSrc 
            ? `<img src="${imgSrc}" style="max-height:100%; max-width:100%; object-fit:contain;">`
            : `<div style="color:#555;">NO IMAGE</div>`;

        const resistLabels = {
            Poison: '毒・猛毒', Shock: '感電', Fear: '怯え',
            Seal: '封印系', Debuff: '弱体化', InstantDeath: '即死/割合'
        };
        const elements = ['火','水','風','雷','光','闇','混沌'];

        const res = monster.resists || {};
        const elmRes = monster.elmRes || {};
        const acts = monster.acts || [1];
        
        const actListHtml = acts.map(act => {
            const actId = (typeof act === 'object') ? act.id : act;
            const cond = (typeof act === 'object') ? act.condition : 0;
            const s = DB.SKILLS.find(k => k.id === actId);
            const sName = s ? s.name : (actId===1?'通常攻撃':(actId===2?'防御':(actId===9?'逃げる':'不明')));
            const sIdText = s ? `(ID:${s.id})` : '';
            
            let condText = '';
            if (cond === 1) condText = '<span style="color:#f88;">(HP≧50%)</span>';
            else if (cond === 2) condText = '<span style="color:#88f;">(HP≦50%)</span>';
            else if (cond === 3) condText = '<span style="color:#f0f;">(状態異常)</span>';
            
            return `
                <div style="background:#333; padding:4px 8px; border-radius:3px; font-size:12px; margin-bottom:2px; display:flex; justify-content:space-between;">
                    <span>${sName} <span style="color:#666; font-size:10px;">${sIdText}</span></span>
                    <span style="font-size:10px; color:#ccc;">${condText}</span>
                </div>`;
        }).join('');

        let html = `
            <div style="padding:10px; background:#222; border-bottom:1px solid #444;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#333; padding:5px; border-radius:4px;">
                    <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuBook.switchMonster(-1)">＜ 前</button>
                    <span style="font-size:12px; color:#aaa;">図鑑ナビ</span>
                    <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuBook.switchMonster(1)">次 ＞</button>
                </div>
            </div>

            <div style="flex:1; overflow-y:auto; padding:10px; font-family:sans-serif; color:#ddd;">
                
                <div style="display:flex; justify-content:space-between; align-items:end; border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px;">
                    <div>
                        <div style="font-size:10px; color:#aaa; margin-bottom:2px;">ID:${monster.id}</div>
                        <div style="font-size:18px; font-weight:bold; color:#ffd700;">${monster.name}</div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:12px; background:#444; padding:2px 8px; border-radius:4px; border:1px solid #555;">Rank: ${monster.rank}</span>
                    </div>
                </div>

                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <div style="width:100px; height:120px; background:#000; border:1px solid #555; display:flex; align-items:center; justify-content:center; flex-shrink:0; border-radius:4px; box-shadow: inset 0 0 10px rgba(255,255,255,0.05);">
                        ${imgHtml}
                    </div>

                    <div style="flex:1;">
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px; margin-bottom:8px;">
                            <div style="background:#333; padding:4px; border-radius:3px; border:1px solid #444;">
                                <div style="font-size:9px; color:#aaa;">HP</div>
                                <div style="font-weight:bold; color:#8f8;">${monster.hp}</div>
                            </div>
                            <div style="background:#333; padding:4px; border-radius:3px; border:1px solid #444;">
                                <div style="font-size:9px; color:#aaa;">MP</div>
                                <div style="font-weight:bold; color:#88f;">${monster.mp}</div>
                            </div>
                            <div style="background:#333; padding:4px; border-radius:3px; border:1px solid #444;">
                                <div style="font-size:9px; color:#aaa;">討伐数</div>
                                <div style="font-weight:bold; color:#ffd700;">${killCount}</div>
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:2px; font-size:11px;">
                            <div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 6px; border-radius:2px;"><span>攻撃</span><span>${monster.atk}</span></div>
                            <div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 6px; border-radius:2px;"><span>防御</span><span>${monster.def}</span></div>
                            <div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 6px; border-radius:2px;"><span>素早</span><span>${monster.spd}</span></div>
                            <div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 6px; border-radius:2px;"><span>魔力</span><span>${monster.mag}</span></div>
                            <div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 6px; border-radius:2px;"><span>GOLD</span><span>${monster.gold}</span></div>
                            <div style="display:flex; justify-content:space-between; background:#2a2a2a; padding:2px 6px; border-radius:2px;"><span>EXP</span><span>${monster.exp}</span></div>
                        </div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div style="background:#252525; border:1px solid #444; border-radius:4px; padding:8px;">
                        <div style="display:flex; justify-content:space-between; font-size:12px; color:#aaa; margin-bottom:5px; border-bottom:1px solid #444; padding-bottom:2px;">
                            <span>行動パターン</span>
                            <span style="font-size:10px;">${monster.actCount||1}回行動</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            ${actListHtml}
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="background:#222; border:1px solid #444; border-radius:4px; padding:5px;">
                            <div style="font-size:10px; color:#88f; margin-bottom:3px; text-align:center; border-bottom:1px solid #333;">属性耐性 (%)</div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:2px;">
                                ${elements.map(e => `
                                    <div style="display:flex; justify-content:space-between; background:#333; padding:2px 4px; border-radius:2px;">
                                        <span style="font-size:10px; color:#aaa;">${e}</span>
                                        <span style="font-size:10px;">${elmRes[e]||0}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div style="background:#222; border:1px solid #444; border-radius:4px; padding:5px;">
                            <div style="font-size:10px; color:#f88; margin-bottom:3px; text-align:center; border-bottom:1px solid #333;">状態異常耐性</div>
                            <div style="display:flex; flex-direction:column; gap:2px;">
                                ${Object.keys(resistLabels).map(key => `
                                    <div style="display:flex; justify-content:space-between; background:#333; padding:2px 4px; border-radius:2px;">
                                        <span style="font-size:10px; color:#aaa;">${resistLabels[key]}</span>
                                        <span style="font-size:10px;">${res[key]||0}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top:20px; display:flex; gap:10px; padding-bottom:10px;">
                    <button class="btn" style="flex:1; background:#444;" onclick="MenuBook.showList()">一覧に戻る</button>
                    <button class="btn" style="flex:1; background:#444;" onclick="Menu.closeSubScreen('book')">メニューを閉じる</button>
                </div>
            </div>
        `;
        
        view.innerHTML = html;
    }
};
/* ==========================================================================
   仲間詳細・アーカイブ画面 (完全版: 同期・ソート・固定レイアウト修正)
   ========================================================================== */
const MenuAllyDetail = {
    selectedChar: null,
    currentMainTab: 'archive', 
    currentArchive: 'base',

    init: (char) => {
        MenuAllyDetail.selectedChar = char;
        MenuAllyDetail.currentMainTab = 'archive';
        MenuAllyDetail.currentArchive = 'base';
        MenuAllyDetail.render();
    },

    render: () => {
        const c = MenuAllyDetail.selectedChar;
        const view = document.getElementById('allies-detail-view');
        
        // メインタブ (固定エリア: flex-shrink: 0)
        const tabs = `
            <div style="display:flex; background:#222; margin-bottom:12px; border-radius:6px; overflow:hidden; border:1px solid #444; flex-shrink:0;">
                <button onclick="MenuAllyDetail.changeMainTab('archive')" style="flex:1; padding:10px; border:none; background:${MenuAllyDetail.currentMainTab==='archive'?'#ffd700':'#111'}; color:${MenuAllyDetail.currentMainTab==='archive'?'#000':'#666'}; font-weight:bold; font-size:12px;">アーカイブ</button>
                <button onclick="MenuAllyDetail.changeMainTab('progress')" style="flex:1; padding:10px; border:none; background:${MenuAllyDetail.currentMainTab==='progress'?'#ffd700':'#111'}; color:${MenuAllyDetail.currentMainTab==='progress'?'#000':'#666'}; font-weight:bold; font-size:12px;">成長の記録</button>
            </div>
        `;

        // 全体をflex-columnにし、ヘッダー・タブは固定。リスト部分だけをスクロール。
        view.style.display = 'flex';
        view.style.flexDirection = 'column';
        view.innerHTML = `
            <div class="header-bar" style="background:linear-gradient(#222, #000); border-bottom:1px solid #ffd700; flex-shrink:0;">
                <button class="btn" onclick="MenuAllies.renderDetail()">戻る</button>
                <span style="color:#ffd700; font-weight:bold; letter-spacing:2px;">UNIT ARCHIVE</span>
                <div style="width:50px;"></div>
            </div>
            <div style="padding:15px 15px 0 15px; background:#050505; flex-shrink:0;">
                ${tabs}
            </div>
            <div id="ally-detail-body" class="scroll-area" style="padding:0 15px 15px 15px; background:#050505; flex:1; overflow-y:auto;">
                ${MenuAllyDetail.currentMainTab === 'archive' ? MenuAllyDetail.renderArchive() : MenuAllyDetail.renderProgress()}
            </div>
        `;
    },

    renderArchive: () => {
        const c = MenuAllyDetail.selectedChar;
        const master = DB.CHARACTERS.find(m => m.id === c.charId) || {};
        const rarity = c.rarity || 'N';
        const stars = { 'N': 1, 'R': 2, 'SR': 3, 'SSR': 4, 'UR': 5, 'EX': 6 }[rarity] || 1;
        const imgUrl = c.img || master.img;

        let frontRareClass = "";
        if (rarity === "SSR") frontRareClass = "style-gold";
        else if (rarity === "UR") frontRareClass = "style-aurora";
        else if (rarity === "EX") frontRareClass = "style-majestic";

        // カードレイアウト：★ → レアリティ → 画像(枠なし) → 名前 → 職業
		const cardHtml = `
					<div style="display:flex; align-items:center; justify-content:center; gap:15px; margin-bottom:20px; user-select:none;">
						<div onclick="MenuAllyDetail.switchChar(-1)" style="color:#ffd700; font-size:28px; cursor:pointer; text-shadow:2px 2px 4px #000; padding:10px; transition:0.2s; filter:drop-shadow(0 0 5px rgba(255,215,0,0.3));">◀</div>
						
						<div style="width:220px; height:320px; position:relative; perspective: 1000px; flex-shrink:0;">
							<div class="card-face card-front ${frontRareClass}" style="transform:none; width:100%; height:100%; position:relative; border-radius:15px; overflow:hidden; display:flex; flex-direction:column; align-items:center; border: 2px solid rgba(255,255,255,0.8); box-shadow: 0 10px 20px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.4); background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.2) 100%);">
								
								<div style="position:absolute; top:10px; left:10px; z-index:2; background:rgba(0,0,0,0.6); padding:2px 8px; border-radius:5px; border:1px solid rgba(255,215,0,0.5); font-weight:bold; font-size:18px; color:#ffd700; text-shadow:0 0 5px #000;">
									${rarity}
								</div>

								<div style="position:absolute; top:12px; right:10px; z-index:2; color:#ffd700; font-size:11px; text-shadow:1px 1px 2px #000;">
									${'★'.repeat(stars)}
								</div>

								<div style="width:165px; height:165px; margin-top:40px; margin-bottom:10px; display:flex; align-items:center; justify-content:center; position:relative;">
									<div style="position:absolute; width:140px; height:140px; background:radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%); border-radius:50%;"></div>
									<img src="${imgUrl || ''}" style="max-width:100%; max-height:100%; object-fit:contain; position:relative; z-index:1; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.8));">
								</div>

								<div style="width:90%; background:rgba(0,0,0,0.5); border-radius:8px; padding:8px 5px; border-top:1px solid rgba(255,255,255,0.2); backdrop-filter:blur(2px); margin-top:auto; margin-bottom:15px; text-align:center;">
									<div class="card-name" style="font-size:17px; font-weight:bold; color:#fff; letter-spacing:1px; text-shadow:1px 1px 2px #000; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:2px;">
										${c.name}
									</div>
									<div class="card-job" style="font-size:11px; color:#ccc; letter-spacing:0.5px; text-transform:uppercase;">
										— ${c.job} —
									</div>
								</div>
								
								<div style="position:absolute; inset:5px; border:1px solid rgba(255,255,255,0.1); border-radius:12px; pointer-events:none;"></div>
							</div>
						</div>

						<div onclick="MenuAllyDetail.switchChar(1)" style="color:#ffd700; font-size:28px; cursor:pointer; text-shadow:2px 2px 4px #000; padding:10px; transition:0.2s; filter:drop-shadow(0 0 5px rgba(255,215,0,0.3));">▶</div>
					</div>
				`;
		
        const milestones = [
            { id: 'base',  label: '初期', cond: () => true },
            { id: 'lv50',  label: 'Lv50', cond: () => c.level >= 50 },
            { id: 'lb50',  label: '+50',  cond: () => c.limitBreak >= 50 },
            { id: 'lv100', label: 'Lv100',cond: () => c.level >= 100 },
            { id: 'lb99',  label: '+99',  cond: () => c.limitBreak >= 99 }
        ];

        const archiveBtns = milestones.map(m => {
            const unlocked = m.cond();
            const active = MenuAllyDetail.currentArchive === m.id;
            const style = active ? 'background:#ffd700; color:#000; font-weight:bold;' : 'background:#222; color:#555;';
            return `<div onclick="${unlocked ? `MenuAllyDetail.changeArchive('${m.id}')` : ''}" 
                         style="flex:1; text-align:center; font-size:10px; padding:6px 0; cursor:pointer; border-right:1px solid #000; ${style}">
                         ${unlocked ? m.label : '🔒'}
                    </div>`;
        }).join('');

        const archives = master.archives || {};
        const flavorText = milestones.find(m => m.id === MenuAllyDetail.currentArchive).cond() 
            ? (archives[MenuAllyDetail.currentArchive] || "記録がありません。")
            : `<div style="color:#444; text-align:center; padding:30px 10px; font-size:11px;">未解放の記録です<br><br>さらなる成長で紐解かれます</div>`;

        return `
            ${cardHtml}
            <div style="background:rgba(255,255,255,0.03); border:1px solid #444; border-radius:8px; overflow:hidden; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
                <div style="display:flex; border-bottom:1px solid #444;">${archiveBtns}</div>
                <div id="flavor-text-area" style="padding:15px; min-height:120px; font-size:13px; line-height:1.8; color:#bbb; white-space:pre-wrap;">${flavorText}</div>
            </div>
            <button class="btn" style="width:100%; margin-top:20px; background:#222; color:#888;" onclick="MenuAllies.renderDetail()">基本画面に戻る</button>
        `;
    },

    renderProgress: () => {
        const c = MenuAllyDetail.selectedChar;
        const master = DB.CHARACTERS.find(m => m.id === c.charId) || {};
        const jobData = window.JOB_SKILLS_DATA ? window.JOB_SKILLS_DATA[c.job] : null;
        if(!jobData) return `<div style="color:#666; text-align:center; padding:40px;">データが存在しません</div>`;

        let html = `<div style="font-size:11px; color:#aaa; margin-bottom:15px; text-align:center;">解放される可能性の断片</div>`;
        
        const allPossible = [];
        // 通常スキル (LV 1-100)
        Object.entries(jobData).forEach(([lv, skillId]) => {
            allPossible.push({ id: skillId, type: 'LV', req: parseInt(lv) });
        });
        // 限界突破スキル (+50, +99)
        if(master.lbSkills) {
            Object.entries(master.lbSkills).forEach(([lbReq, skillId]) => {
                allPossible.push({ id: skillId, type: 'LB', req: parseInt(lbReq) });
            });
        }

        // ★修正: LVスキル(1-100)を先に、その後ろにLBスキルを並べる
        allPossible.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'LV' ? -1 : 1;
            return a.req - b.req;
        });

        allPossible.forEach(entry => {
            const isLearned = entry.type === 'LV' ? c.level >= entry.req : c.limitBreak >= entry.req;
            const skill = DB.SKILLS.find(s => s.id === entry.id);
            const condText = entry.type === 'LV' ? `Lv.${entry.req}` : `突破+${entry.req}`;
            if(!skill) return;

            html += `
                <div style="background:rgba(255,255,255,0.02); border:1px solid #333; padding:12px; margin-bottom:8px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1; padding-right:10px;">
                        <div style="font-size:14px; font-weight:bold; color:${isLearned ? '#ffd700' : '#333'};">${isLearned ? skill.name : '？？？？？？'}</div>
                        <div style="font-size:10px; color:${isLearned ? '#888' : '#222'}; margin-top:2px;">${isLearned ? skill.desc : '未知の能力'}</div>
                    </div>
                    <div style="font-size:10px; font-weight:bold; color:${isLearned ? '#4f4' : '#ffd700'}; background:rgba(0,0,0,0.4); padding:4px 10px; border-radius:15px; border:1px solid ${isLearned?'#040':'#440'}; white-space:nowrap;">
                        ${isLearned ? '修得済' : condText}
                    </div>
                </div>`;
        });
        
        html += `<button class="btn" style="width:100%; margin-top:20px; background:#333; color:#888;" onclick="MenuAllies.renderDetail()">基本画面に戻る</button>`;
        return html;
    },

    // キャラ切り替え：MenuAllies.selectedChar も同期して「戻る」時のズレを解消
    switchChar: (dir) => {
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
        let idx = chars.findIndex(ch => ch.uid === MenuAllyDetail.selectedChar.uid);
        let newIdx = (idx + dir + chars.length) % chars.length;
        
        const nextChar = chars[newIdx];
        MenuAllyDetail.selectedChar = nextChar;
        // ★重要: 基本画面のターゲットも同期させる
        MenuAllies.selectedChar = nextChar;
        
        MenuAllyDetail.render();
    },

    changeMainTab: (tab) => {
        MenuAllyDetail.currentMainTab = tab;
        MenuAllyDetail.render();
    },

    // アーカイブのサブタブ切り替え：スクロール位置を保持
    changeArchive: (milestoneId) => {
        const body = document.getElementById('ally-detail-body');
        const scrollPos = body ? body.scrollTop : 0;
        
        MenuAllyDetail.currentArchive = milestoneId;
        MenuAllyDetail.render();
        
        // 再描画後にスクロールを戻す
        const newBody = document.getElementById('ally-detail-body');
        if (newBody) newBody.scrollTop = scrollPos;
    }
};