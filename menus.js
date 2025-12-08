/* menus.js (JobLv表示・セーブボタン削除版) */

const Menu = {
    // --- メインメニュー制御 ---
    openMainMenu: () => {
        document.getElementById('menu-overlay').style.display = 'flex';
        Menu.renderPartyBar();
        
        // メニューボタン生成 (毎回再生成しないと状態が古いままになる場合があるため)
        // ボタンの並び順を変更したい場合はここを編集
        const grid = document.querySelector('#menu-overlay .menu-grid');
        if(grid) {
            grid.innerHTML = `
                <button class="menu-btn" onclick="Menu.openSubScreen('party')">仲間編成</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('equip')">装備変更</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('inventory')">所持装備</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('items')">道具</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('allies')">仲間一覧</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('skills')">スキル</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('book')">魔物図鑑</button>
                <button class="menu-btn" onclick="Menu.openSubScreen('blacksmith')">鍛冶屋</button>
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
        return document.getElementById('menu-overlay').style.display !== 'none' ||
               document.querySelectorAll('.sub-screen[style*="flex"]').length > 0;
    },

    closeAll: () => {
        document.getElementById('menu-overlay').style.display = 'none';
        document.querySelectorAll('.sub-screen').forEach(e => e.style.display = 'none');
        const assignModal = document.getElementById('assign-modal');
        if(assignModal) assignModal.style.display = 'none';
        Menu.closeDialog();
    },

    // パーティステータスバー更新
    renderPartyBar: () => {
        const bars = document.querySelectorAll('.party-bar'); 
        bars.forEach(bar => {
            bar.innerHTML = '';
            App.data.party.forEach(uid => {
                const div = document.createElement('div');
                div.className = 'p-box';
                // 画像が入るためレイアウト調整
                div.style.justifyContent = 'flex-start'; 
                div.style.paddingTop = '2px';

                if(uid) {
                    const p = App.getChar(uid);
                    const stats = App.calcStats(p);
                    const curHp = p.currentHp!==undefined ? p.currentHp : stats.maxHp;
                    const curMp = p.currentMp!==undefined ? p.currentMp : stats.maxMp;
                    const lbText = p.limitBreak > 0 ? `<span style="color:#ffd700; font-size:9px; margin-left:2px;">+${p.limitBreak}</span>` : '';

                    // 画像HTML生成
                    const imgHtml = p.img 
                        ? `<img src="${p.img}" style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #666; margin-bottom:2px;">`
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
                            <div style="font-size:9px; color:#aaa; margin-bottom:2px;">${p.job} Lv.${p.level}</div>
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

    // --- サブ画面遷移 ---
    openSubScreen: (id) => {
        document.getElementById('menu-overlay').style.display = 'none';
        document.querySelectorAll('.sub-screen').forEach(e => e.style.display = 'none');
        const target = document.getElementById('sub-screen-' + id);
        if(target) target.style.display = 'flex';
        
        if(id === 'party') MenuParty.init();
        if(id === 'equip') MenuEquip.init();
        if(id === 'items') MenuItems.init();
        if(id === 'inventory') MenuInventory.init();
        if(id === 'allies') MenuAllies.init();
        if(id === 'skills') MenuSkills.init();
        if(id === 'book') MenuBook.init();
        if(id === 'blacksmith') MenuBlacksmith.init();
        if(id === 'gacha' && typeof Gacha !== 'undefined') Gacha.init();
    },

    closeSubScreen: (id) => {
        document.getElementById('sub-screen-' + id).style.display = 'none';
        document.getElementById('menu-overlay').style.display = 'flex';
        Menu.renderPartyBar();
    },

    // --- 画面内ログ/確認ダイアログ制御 ---
    getDialogEl: (id) => document.getElementById(id),

    // レアリティごとのカラーコード取得
    getRarityColor: (rarity) => {
        if(rarity==='N') return '#a0a0a0';
        if(rarity==='R') return '#40e040';
        if(rarity==='SR') return '#40e0e0';
        if(rarity==='SSR') return '#ff4444';
        if(rarity==='UR') return '#e040e0';
        if(rarity==='EX') return '#ffff00';
        return '#fff';
    },

/* menus.js (Menuオブジェクト部分: 装備詳細にシナジー表示を追加) */
    // 装備詳細HTML生成
    getEquipDetailHTML: (equip) => {
        let html = '';
        const rarity = equip.rarity || 'N';
        const rarityColor = Menu.getRarityColor(rarity);
        
        // 基礎効果
        let baseStats = [];
        if (equip.data) {
            if (equip.data.atk) baseStats.push(`攻+${equip.data.atk}`);
            if (equip.data.def) baseStats.push(`防+${equip.data.def}`);
            if (equip.data.mag) baseStats.push(`魔+${equip.data.mag}`);
            if (equip.data.spd) baseStats.push(`速+${equip.data.spd}`);
            if (equip.data.finDmg) baseStats.push(`与ダメ+${equip.data.finDmg}%`);
            if (equip.data.finRed) baseStats.push(`被ダメ-${equip.data.finRed}`);
            
            if(typeof CONST !== 'undefined' && CONST.ELEMENTS) {
                CONST.ELEMENTS.forEach(elm => {
                    if (equip.data.elmAtk && equip.data.elmAtk[elm]) baseStats.push(`${elm}攻+${equip.data.elmAtk[elm]}`);
                    if (equip.data.elmRes && equip.data.elmRes[elm]) baseStats.push(`${elm}耐+${equip.data.elmRes[elm]}`);
                });
            }
        }
        const baseEffect = baseStats.length > 0 ? baseStats.join(' ') : 'なし';

        // 追加オプション
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

        // ★修正: シナジー (常時チェックして表示)
        let synergyHTML = '';
        if (typeof App !== 'undefined' && typeof App.checkSynergy === 'function') {
             const syn = App.checkSynergy(equip);
             if(syn) {
                 synergyHTML = `
                    <div style="margin-top:4px; padding:2px 4px; background:rgba(255,255,255,0.1); border-radius:2px;">
                        <div style="font-size:11px; font-weight:bold; color:${syn.color||'#f88'};">★シナジー: ${syn.name}</div>
                        <div style="font-size:10px; color:#ddd;">${syn.desc}</div>
                    </div>`;
             }
        }

        html += `
            <div style="font-size:12px; font-weight:bold; color:${rarityColor}; margin-bottom:2px;">
                ${equip.name}
            </div>
            <div style="font-size:10px; color:#ccc;">${baseEffect}</div>
            ${optsHTML}
            ${synergyHTML}
        `;
        return html;
    },
    
    // 簡易リスト用詳細HTML
    getEquipDetailHTML_for_EquipList: (equip) => {
        const rarity = equip.rarity || 'N';
        const rarityColor = Menu.getRarityColor(rarity);

        let baseStats = [];
        if (equip.data) {
            if (equip.data.atk) baseStats.push(`攻+${equip.data.atk}`);
            if (equip.data.def) baseStats.push(`防+${equip.data.def}`);
            if (equip.data.mag) baseStats.push(`魔+${equip.data.mag}`);
            if (equip.data.spd) baseStats.push(`速+${equip.data.spd}`);
        }
        const baseEffect = baseStats.length > 0 ? baseStats.join(' / ') : '基本効果なし';
        
        let optsHTML = '';
        if (equip.opts && equip.opts.length > 0) {
            optsHTML = equip.opts.map(o => {
                const optRarity = o.rarity || 'N';
                const optColor = Menu.getRarityColor(optRarity);
                const unit = o.unit === 'val' ? '' : o.unit;
                return `<span style="color:${optColor};">${o.label}+${o.val}${unit} (${optRarity})</span>`;
            }).join(', ');
        }
        
        // ★修正: シナジー (常時チェック)
        let synergyHTML = '';
        if (typeof App !== 'undefined' && typeof App.checkSynergy === 'function') {
             const syn = App.checkSynergy(equip);
             if(syn) synergyHTML = `<span style="color:${syn.color||'#f88'}; margin-left:5px; font-size:10px;">★${syn.name}</span>`;
        }
        
        return `
            <div style="flex:1; min-width:0;">
                <div style="font-weight:bold; color:${rarityColor};">${equip.name} ${synergyHTML}</div>
                <div style="font-size:10px; color:#aaa; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${baseEffect}
                </div>
            </div>
            ${optsHTML ? `<div style="font-size:10px; color:#ccc; text-align:right; margin-left:10px; max-width:40%; overflow:hidden; white-space:nowrap;">${optsHTML}</div>` : ''}
        `;
    },
    
    getEquipDetailHTML_for_EquipList: (equip) => {
        const rarity = equip.rarity || 'N';
        const rarityColor = Menu.getRarityColor(rarity);

        let baseStats = [];
        if (equip.data) {
            if (equip.data.atk) baseStats.push(`攻+${equip.data.atk}`);
            if (equip.data.def) baseStats.push(`防+${equip.data.def}`);
            if (equip.data.mag) baseStats.push(`魔+${equip.data.mag}`);
            if (equip.data.spd) baseStats.push(`速+${equip.data.spd}`);
        }
        const baseEffect = baseStats.length > 0 ? baseStats.join(' / ') : '基本効果なし';
        
        let optsHTML = '';
        if (equip.opts && equip.opts.length > 0) {
            optsHTML = equip.opts.map(o => {
                const optRarity = o.rarity || 'N';
                const optColor = Menu.getRarityColor(optRarity);
                const unit = o.unit === 'val' ? '' : o.unit;
                return `<span style="color:${optColor};">${o.label}+${o.val}${unit} (${optRarity})</span>`;
            }).join(', ');
        }
        
        let synergyHTML = '';
        if (equip.isSynergy) {
             const syn = App.checkSynergy(equip);
             if(syn) synergyHTML = `<span style="color:${syn.color||'#f88'};">★${syn.name}</span>`;
        }
        
        return `
            <div style="flex:1; min-width:0;">
                <div style="font-weight:bold; color:${rarityColor};">${equip.name} ${synergyHTML}</div>
                <div style="font-size:10px; color:#aaa; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${baseEffect}
                </div>
            </div>
            ${optsHTML ? `<div style="font-size:10px; color:#ccc; text-align:right; margin-left:10px;">${optsHTML}</div>` : ''}
        `;
    },

    msg: (text, callback) => {
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');
        
        if (!area) { 
            console.warn("Dialog area missing. Using alert."); 
            alert(text); 
            if (callback) callback(); 
            return; 
        }
        
        textEl.innerHTML = text.replace(/\n/g, '<br>');
        btnEl.innerHTML = '';

        const okBtn = document.createElement('button');
        okBtn.className = 'btn';
        okBtn.style.width = '80px';
        okBtn.innerText = 'OK';
        okBtn.onclick = () => {
            Menu.closeDialog();
            if (callback) callback();
        };
        btnEl.appendChild(okBtn);
        area.style.display = 'flex';
    },

    confirm: (text, yesCallback, noCallback) => {
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');

        if (!area) {
            if(confirm(text)) { if(yesCallback) yesCallback(); }
            else { if(noCallback) noCallback(); }
            return;
        }

        textEl.innerHTML = text.replace(/\n/g, '<br>');
        btnEl.innerHTML = '';

        const yesBtn = document.createElement('button');
        yesBtn.className = 'btn';
        yesBtn.style.width = '80px';
        yesBtn.innerText = 'はい';
        yesBtn.onclick = () => {
            Menu.closeDialog();
            if (yesCallback) yesCallback();
        };
        
        const noBtn = document.createElement('button');
        noBtn.className = 'btn';
        noBtn.style.width = '80px';
        noBtn.style.background = '#555';
        noBtn.innerText = 'いいえ';
        noBtn.onclick = () => {
            Menu.closeDialog();
            if (noCallback) noCallback();
        };
        
        btnEl.appendChild(yesBtn);
        btnEl.appendChild(noBtn);
        area.style.display = 'flex';
    },
    
    choice: (text, label1, func1, label2, func2) => {
        const area = Menu.getDialogEl('menu-dialog-area');
        const textEl = Menu.getDialogEl('menu-dialog-text');
        const btnEl = Menu.getDialogEl('menu-dialog-buttons');

        if (!area) return;

        textEl.innerHTML = text.replace(/\n/g, '<br>');
        btnEl.innerHTML = '';

        const btn1 = document.createElement('button');
        btn1.className = 'btn';
        btn1.style.minWidth = '80px';
        btn1.innerText = label1;
        btn1.onclick = () => { Menu.closeDialog(); if (func1) func1(); };
        
        const btn2 = document.createElement('button');
        btn2.className = 'btn';
        btn2.style.minWidth = '80px';
        btn2.style.background = '#555';
        btn2.innerText = label2;
        btn2.onclick = () => { Menu.closeDialog(); if (func2) func2(); };
        
        btnEl.appendChild(btn1);
        btnEl.appendChild(btn2);
        area.style.display = 'flex';
    },

    closeDialog: () => {
        const area = document.getElementById('menu-dialog-area');
        if (area) area.style.display = 'none';
    }
};

/* ==========================================================================
   1. 仲間編成
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
            const uid = App.data.party[i];
            const char = uid ? App.getChar(uid) : null;
            const div = document.createElement('div');
            div.className = 'list-item';
            
            let content = `<div><span style="color:#ffd700">${i+1}.</span> (空き)</div>`;
            if(char) content = `<div style="flex:1">${App.createCharHTML(char)}</div><div style="font-size:10px; color:#888; margin-left:5px;">変更&gt;</div>`;
            div.innerHTML = content;
            
            div.onclick = () => {
                MenuParty.targetSlot = i;
                document.getElementById('party-screen-slots').style.display = 'none';
                document.getElementById('party-screen-chars').style.display = 'flex';
                MenuParty.renderCharList();
            };
            list.appendChild(div);
        }
    },
    
    renderCharList: () => {
        const list = document.getElementById('party-char-list');
        list.innerHTML = '<div class="list-item" onclick="MenuParty.setMember(null)">(この枠を空にする)</div>';
        
        App.data.characters.forEach(c => {
            const div = document.createElement('div');
            div.className = 'list-item';
            const inP = App.data.party.includes(c.uid) ? '<span class="tag-party">PT</span> ' : '';
            div.innerHTML = `<div style="flex:1">${inP}${App.createCharHTML(c)}</div>`;
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
        MenuParty.renderSlots();
    }
};

/* ==========================================================================
   2. 装備変更
   ========================================================================== */
/* 2. 装備変更 (戻るボタン修正 & 並び順修正版) */
const MenuEquip = {
    targetChar: null, targetPart: null, selectedEquipId: null,
    
    init: () => { 
        const partyUids = App.data.party.filter(uid => uid);
        if(partyUids.length > 0) MenuEquip.targetChar = App.getChar(partyUids[0]);
        else return; 
        
        MenuEquip.changeScreen('part');
        MenuEquip.renderPartList();
    },
    
    changeScreen: (id) => {
        ['char','part','item'].forEach(s => {
            const el = document.getElementById(`equip-screen-${s}`);
            if(el) el.style.display = 'none';
        });
        const target = document.getElementById(`equip-screen-${id}`);
        if(target) target.style.display = 'flex';
    },

    switchChar: (dir) => {
        if (!MenuEquip.targetChar) return;
        const partyUids = App.data.party.filter(uid => uid);
        let idx = partyUids.indexOf(MenuEquip.targetChar.uid);
        if (idx === -1) idx = 0;
        
        let newIdx = idx + dir;
        if (newIdx < 0) newIdx = partyUids.length - 1;
        if (newIdx >= partyUids.length) newIdx = 0;
        
        MenuEquip.targetChar = App.getChar(partyUids[newIdx]);
        MenuEquip.renderPartList();
        
        if (document.getElementById('equip-screen-item').style.display === 'flex') {
            MenuEquip.changeScreen('part'); 
        }
    },
    
    renderPartList: () => {
        const c = MenuEquip.targetChar;
        if (!c) return;
        const s = App.calcStats(c);
        
        // ★修正: 戻るボタンの挙動を強制的に「メニューを閉じる」に変更
        const screenPart = document.getElementById('equip-screen-part');
        if(screenPart) {
            const backBtn = screenPart.querySelector('button.btn'); // 最後のボタン(戻る)を取得
            if(backBtn) backBtn.onclick = () => Menu.closeSubScreen('equip');
        }
        
        const statEl = document.getElementById('char-status');
        if(statEl) {
            statEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#444; padding:5px; border-radius:4px;">
                    <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuEquip.switchChar(-1)">＜</button>
                    <span style="font-weight:bold; font-size:14px;">${c.name}</span>
                    <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuEquip.switchChar(1)">＞</button>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:5px; font-size:11px; margin-top:5px; background:#222; padding:5px; border-radius:4px;">
                    <span>攻: ${s.atk}</span> <span>防: ${s.def}</span>
                    <span>魔: ${s.mag}</span> <span>速: ${s.spd}</span>
                </div>
            `;
        }
        
        let list = document.getElementById('equip-slot-list');
        if (!list) return;

        list.innerHTML = '';
        CONST.PARTS.forEach(part => {
            const eq = c.equips[part];
            const div = document.createElement('div');
            div.className = 'list-item';
            let detail = '<span style="color:#555;">装備なし</span>';
            if(eq) detail = Menu.getEquipDetailHTML(eq);

            div.innerHTML = `
                <div style="display:flex; align-items:flex-start;">
                    <div style="width:40px; color:#aaa; font-weight:bold; margin-top:2px;">${part}</div>
                    <div style="flex:1;">${detail}</div>
                </div>
            `;
            div.onclick = () => {
                MenuEquip.targetPart = part;
                MenuEquip.changeScreen('item');
                MenuEquip.renderItemList();
            };
            list.appendChild(div);
        });
    },
    
    renderItemList: () => {
        let list = document.getElementById('equip-list');
        if(!list) return;

        list.innerHTML = '';
        const footer = document.getElementById('equip-footer');
        const header = document.getElementById('equip-item-header');
        if(header) header.innerText = `${MenuEquip.targetChar.name} - ${MenuEquip.targetPart}を選択中`;
        if(footer) footer.innerHTML = "装備を選択すると能力変化を確認できます";
        
        MenuEquip.selectedEquipId = null;
        const part = MenuEquip.targetPart;
        let candidates = [];
        candidates.push({id:'remove', name:'(装備を外す)', isRemove:true, rank:999, plus:999}); // ソート用ダミー値
        
        // インベントリから抽出
        App.data.inventory.filter(i => i.type === part).forEach(i => candidates.push(i));
        // 他キャラ装備中から抽出
        App.data.characters.forEach(other => {
            if(other.uid !== MenuEquip.targetChar.uid && other.equips[part]) {
                candidates.push({...other.equips[part], owner:other.name});
            }
        });

        // ★修正: ソート (ランク降順 > +値降順)
        candidates.sort((a, b) => {
            if (a.isRemove) return -1;
            if (b.isRemove) return 1;
            if (b.rank !== a.rank) return b.rank - a.rank;
            return (b.plus || 0) - (a.plus || 0);
        });

        candidates.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            
            let html = '';
            if(item.isRemove) html = `<div style="color:#aaa; font-weight:bold;">${item.name}</div>`;
            else {
                html = Menu.getEquipDetailHTML_for_EquipList(item); 
                if(item.owner) html += `<div style="text-align:right; font-size:10px; color:#f88; margin-left:10px;">[${item.owner} 装備中]</div>`;
            }
            div.style.display = 'flex'; div.style.alignItems = 'center'; div.innerHTML = html;
            
            div.onclick = () => {
                if(MenuEquip.selectedEquipId === item.id) MenuEquip.doEquip(item.isRemove ? null : item);
                else {
                    MenuEquip.selectedEquipId = item.id;
                    Array.from(list.children).forEach(c => c.classList.remove('selected'));
                    div.classList.add('selected');
                    if(item.isRemove) MenuEquip.renderStatsComparison(null);
                    else MenuEquip.renderStatsComparison(item);
                }
            };
            list.appendChild(div);
        });
    },
    
    renderStatsComparison: (newItem) => {
        const c = MenuEquip.targetChar;
        const part = MenuEquip.targetPart;
        const footer = document.getElementById('equip-footer');
        if(!footer) return;
        
        const currentStats = App.calcStats(c);
        const dummy = JSON.parse(JSON.stringify(c));
        dummy.equips[part] = newItem; 
        const newStats = App.calcStats(dummy);
        
        const diff = (key) => {
            const d = newStats[key] - currentStats[key];
            if(d > 0) return `<span style="color:#4f4;">+${d}</span>`;
            if(d < 0) return `<span style="color:#f44;">${d}</span>`;
            return `<span style="color:#888;">±0</span>`;
        };

        const itemName = newItem ? newItem.name : '装備なし';
        footer.innerHTML = `
            <div style="font-size:10px; color:#aaa; margin-bottom:2px;">変更後の変化: ${itemName}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; font-size:11px;">
                <div>攻: ${newStats.atk} (${diff('atk')})</div>
                <div>防: ${newStats.def} (${diff('def')})</div>
                <div>魔: ${newStats.mag} (${diff('mag')})</div>
                <div>速: ${newStats.spd} (${diff('spd')})</div>
            </div>
            <div style="text-align:right; color:#ffd700; font-size:10px; margin-top:2px;">もう一度タップで決定</div>
        `;
    },
    
    doEquip: (item) => {
        const c = MenuEquip.targetChar;
        const p = MenuEquip.targetPart;
        const oldItem = c.equips[p];
        
        if(oldItem) App.data.inventory.push(oldItem);
        if(item) {
            const owner = App.data.characters.find(ch => ch.equips[p] && ch.equips[p].id === item.id);
            if(owner) owner.equips[p] = null;
            const idx = App.data.inventory.findIndex(i => i.id === item.id);
            if(idx > -1) App.data.inventory.splice(idx, 1);
            c.equips[p] = item;
        } else {
            c.equips[p] = null;
        }
        App.save();
        MenuEquip.changeScreen('part');
        MenuEquip.renderPartList();
    }
};

/* ==========================================================================
   3. 道具
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

        items.forEach(it => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:bold;">${it.def.name}</div>
                    <div style="font-size:10px; color:#aaa;">${it.def.desc}</div>
                </div>
                <div>x${it.count}</div>
            `;
            div.onclick = () => {
                if(it.def.type.includes('回復') || it.def.type.includes('蘇生')) {
                    MenuItems.selectedItem = it.def;
                    MenuItems.renderTargetList();
                } else {
                    document.getElementById('item-footer').innerText = "使用できないアイテムです";
                }
            };
            list.appendChild(div);
        });
    },
    renderTargetList: () => {
        MenuItems.changeScreen('target');
        const list = document.getElementById('list-item-targets');
        list.innerHTML = '';
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
        if(App.data.items[item.id] <= 0) return;

        Menu.confirm(`${target.name} に ${item.name} を使いますか？`, () => {
            let success = false;
            const s = App.calcStats(target);
            
            if(item.type === 'HP回復') {
                if(target.currentHp >= s.maxHp) { Menu.msg("HPは満タンです"); return; }
                const healVal = item.val;
                target.currentHp = Math.min(s.maxHp, (target.currentHp||s.maxHp) + healVal);
                success = true;
            } else if(item.type === 'MP回復') {
                if(target.currentMp >= s.maxMp) { Menu.msg("MPは満タンです"); return; }
                const healVal = item.val;
                target.currentMp = Math.min(s.maxMp, (target.currentMp||s.maxMp) + healVal);
                success = true;
            } else if(item.type === '蘇生') {
                if(target.currentHp > 0) { Menu.msg("生き返っています"); return; }
                target.currentHp = Math.floor(s.maxHp * 0.5);
                success = true;
            }

            if(success) {
                App.data.items[item.id]--;
                if(App.data.items[item.id]<=0) delete App.data.items[item.id];
                App.save();
                Menu.msg(`${target.name}は回復した！`, () => {
                    MenuItems.renderTargetList();
                    Menu.renderPartyBar();
                });
            }
        });
    }
};

/* ==========================================================================
   4. 所持装備一覧
   ========================================================================== */
/* 4. 所持装備一覧 (並び順修正 & まとめて売却機能版) */
const MenuInventory = {
    selectedIds: [],

    init: () => {
        document.getElementById('sub-screen-inventory').style.display = 'flex';
        MenuInventory.selectedIds = [];
        MenuInventory.render();
    },

    render: () => {
        document.getElementById('inventory-gold').innerText = App.data.gold;
        const list = document.getElementById('inventory-list');
        list.innerHTML = '';
        const footer = document.getElementById('inventory-footer');
        footer.innerHTML = ""; // フッターはボタンエリアとして使うのでクリア

        // ★追加: まとめて売却用の操作パネル
        const ctrlPanel = document.createElement('div');
        ctrlPanel.style.padding = '10px';
        ctrlPanel.style.background = '#222';
        ctrlPanel.style.borderBottom = '1px solid #444';
        ctrlPanel.style.display = 'flex';
        ctrlPanel.style.justifyContent = 'space-between';
        ctrlPanel.style.alignItems = 'center';
        
        const countSpan = document.createElement('span');
        countSpan.id = 'inv-select-count';
        countSpan.style.fontSize = '12px';
        countSpan.style.color = '#aaa';
        countSpan.innerText = '選択: 0個';
        
        const sellBtn = document.createElement('button');
        sellBtn.className = 'btn';
        sellBtn.style.background = '#500';
        sellBtn.innerText = '選択を売却';
        sellBtn.onclick = () => MenuInventory.sellSelected();
        
        ctrlPanel.appendChild(countSpan);
        ctrlPanel.appendChild(sellBtn);
        list.appendChild(ctrlPanel);

        if(App.data.inventory.length === 0) {
            const msg = document.createElement('div');
            msg.style.padding = '10px';
            msg.style.color = '#888';
            msg.innerText = '装備品を持っていません';
            list.appendChild(msg);
            return;
        }

        // ★修正: ソート (ランク降順 > +値降順)
        const items = [...App.data.inventory].sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            return (b.plus || 0) - (a.plus || 0);
        });

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'flex-start';
            div.style.position = 'relative';

            // 選択状態のスタイル
            if(MenuInventory.selectedIds.includes(item.id)) {
                div.style.background = '#442222';
                div.style.borderLeft = '3px solid #f44';
            }

            let ownerName = '';
            const owner = App.data.characters.find(c => c.equips[item.type] && c.equips[item.type].id === item.id);
            if(owner) ownerName = ` <span style="font-size:10px; color:#f88;">[装備中:${owner.name}]</span>`;

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <div style="display:flex; align-items:center;">
                        <input type="checkbox" ${MenuInventory.selectedIds.includes(item.id) ? 'checked' : ''} style="pointer-events:none; margin-right:5px;">
                        <span>${item.name}${ownerName}</span>
                    </div>
                    <div style="font-size:11px; color:#ffd700;">${Math.floor(item.val/2)}G</div>
                </div>
                ${Menu.getEquipDetailHTML(item)}
            `;
            
            // タップで選択トグル
            div.onclick = () => {
                if(owner) {
                    Menu.msg(`${owner.name}が装備中のため選択できません`);
                    return;
                }
                MenuInventory.toggleSelect(item.id);
            };
            list.appendChild(div);
        });
    },

    toggleSelect: (id) => {
        const idx = MenuInventory.selectedIds.indexOf(id);
        if(idx > -1) MenuInventory.selectedIds.splice(idx, 1);
        else MenuInventory.selectedIds.push(id);
        
        MenuInventory.render();
        // 選択数更新
        const span = document.getElementById('inv-select-count');
        if(span) span.innerText = `選択: ${MenuInventory.selectedIds.length}個`;
    },

    sellSelected: () => {
        if(MenuInventory.selectedIds.length === 0) {
            Menu.msg("売却する装備を選択してください");
            return;
        }

        let totalVal = 0;
        const targets = [];
        MenuInventory.selectedIds.forEach(id => {
            const item = App.data.inventory.find(i => i.id === id);
            if(item) {
                targets.push(item);
                totalVal += Math.floor(item.val / 2);
            }
        });

        Menu.confirm(`${targets.length}個の装備を\n合計 ${totalVal}G で売却しますか？`, () => {
            // 売却処理
            MenuInventory.selectedIds.forEach(id => {
                const idx = App.data.inventory.findIndex(i => i.id === id);
                if(idx > -1) App.data.inventory.splice(idx, 1);
            });
            App.data.gold += totalVal;
            MenuInventory.selectedIds = []; // リセット
            App.save();
            Menu.msg(`${totalVal}G で売却しました`, () => MenuInventory.render());
        });
    }
};

/* ==========================================================================
   5. 仲間一覧 & 詳細
   ========================================================================== */

const MenuAllies = {
    selectedChar: null, 
    currentTab: 1,
    tempAlloc: null,
    
    init: () => {
        // 必要なDOM要素を先に生成
        MenuAllies.createAllocModalDOM(); 
        MenuAllies.createTreeViewDOM(); 

        document.getElementById('allies-list-view').style.display = 'flex';
        document.getElementById('allies-detail-view').style.display = 'none';
        
        const treeView = document.getElementById('allies-tree-view');
        if (treeView) treeView.style.display = 'none';
        
        MenuAllies.renderList();
    },

    renderList: () => {
        const list = document.getElementById('allies-list');
        list.innerHTML = '';
        const rarityVal = { N:1, R:2, SR:3, SSR:4, UR:5, EX:6 };
        const chars = [...App.data.characters].sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            const rA = rarityVal[a.rarity] || 0;
            const rB = rarityVal[b.rarity] || 0;
            return rB - rA;
        });

        chars.forEach(c => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = App.createCharHTML(c);
            div.onclick = () => {
                MenuAllies.selectedChar = c;
                MenuAllies.renderDetail();
            };
            list.appendChild(div);
        });
    },

    switchChar: (dir) => {
        if (!MenuAllies.selectedChar) return;
        const rarityVal = { N:1, R:2, SR:3, SSR:4, UR:5, EX:6 };
        const chars = [...App.data.characters].sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            const rA = rarityVal[a.rarity] || 0;
            const rB = rarityVal[b.rarity] || 0;
            return rB - rA;
        });

        let idx = chars.findIndex(c => c.uid === MenuAllies.selectedChar.uid);
        if (idx === -1) idx = 0;
        let newIdx = idx + dir;
        if (newIdx < 0) newIdx = chars.length - 1;
        if (newIdx >= chars.length) newIdx = 0;
        MenuAllies.selectedChar = chars[newIdx]; 
        
        // 現在開いている画面に合わせて更新
        const treeView = document.getElementById('allies-tree-view');
        if (treeView && treeView.style.display === 'flex') {
            MenuAllies.renderTreeView();
        } else {
            MenuAllies.renderDetail();
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
                    App.save();
                    Menu.renderPartyBar();
                    MenuAllies.renderDetail();
                }
            };
            reader.readAsDataURL(file);
        }
    },

    toggleNameEdit: () => {
        const disp = document.getElementById('char-name-display');
        const edit = document.getElementById('char-name-edit');
        if(disp.style.display === 'none') {
            disp.style.display = 'flex'; edit.style.display = 'none';
        } else {
            disp.style.display = 'none'; edit.style.display = 'flex';
        }
    },

    saveName: (uid) => {
        const input = document.getElementById('char-name-input');
        const newName = input.value.trim();
        if(newName.length > 0) {
            const char = App.getChar(uid);
            if(char) {
                char.name = newName;
                App.save();
                Menu.renderPartyBar();
                MenuAllies.renderDetail();
            }
        }
    },

    renderDetail: () => {
        document.getElementById('allies-list-view').style.display = 'none'; 
        
        const treeView = document.getElementById('allies-tree-view');
        if (treeView) treeView.style.display = 'none';
        
        document.getElementById('allies-detail-view').style.display = 'flex';
        
        const c = MenuAllies.selectedChar;
        const playerObj = new Player(c);
        const s = App.calcStats(c);
        const hp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
        const mp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
        const lb = c.limitBreak || 0;
        const sp = c.sp || 0;
        const nextExp = App.getNextExp(c);
        const nextExpText = nextExp === Infinity ? "MAX" : nextExp;

        const navHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#333; padding:5px; margin-bottom:5px; border-radius:4px;">
                <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuAllies.switchChar(-1)">＜ 前</button>
                <span style="font-weight:bold; font-size:14px;">詳細設定</span>
                <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuAllies.switchChar(1)">次 ＞</button>
            </div>
        `;

        const treeBtnHtml = `
            <div style="background:#004444; padding:5px; margin-top:5px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                <span>所持SP: <b style="color:#ffd700; font-size:14px;">${sp}</b></span> 
                <button class="menu-btn" style="padding:5px 15px; font-size:12px;" onclick="MenuAllies.openTreeView()">スキル習得</button>
            </div>
        `;

        let allocHtml = '';
        if(c.uid === 'p1') {
            const totalPt = Math.floor(lb / 10) * 10;
            let used = 0;
            if(c.alloc) for(let k in c.alloc) used += c.alloc[k];
            const free = totalPt - used;
            allocHtml = `<div style="background:#444400; padding:5px; margin-top:2px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                <span>ボーナスPt: <b>${free}</b></span> <button class="btn" style="padding:2px 5px;" onclick="MenuAllies.openAllocModal()">振分</button>
            </div>`;
        }

        const tabContainer = document.getElementById('allies-tabs');
        tabContainer.innerHTML = '';
        const tabs = ['基本', '装備', '技能'];
        for(let i=1; i<=3; i++) {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${MenuAllies.currentTab===i?'active':''}`;
            btn.innerText = tabs[i-1];
            btn.onclick = () => { MenuAllies.currentTab = i; MenuAllies.renderDetail(); };
            tabContainer.appendChild(btn);
        }

        const content = document.getElementById('allies-detail-content');
        let html = navHtml;
        
        if(MenuAllies.currentTab === 1) { 
            let activeSynergies = [];
            if (c.equips) {
                CONST.PARTS.forEach(p => {
                    const eq = c.equips[p];
                    if (eq && typeof App.checkSynergy === 'function') {
                        const syn = App.checkSynergy(eq);
                        if (syn) activeSynergies.push({ part: p, name: syn.name, desc: syn.desc, color: syn.color });
                    }
                });
            }
            let synergiesHtml = '';
            if (activeSynergies.length > 0) {
                synergiesHtml += `<hr style="border-color:#444"><div style="font-size:12px; font-weight:bold; margin-bottom:5px;">発動中のシナジー</div>`;
                activeSynergies.forEach(syn => {
                    synergiesHtml += `<div style="font-size:11px; color:${syn.color||'#fff'}; margin-bottom:2px;">[${syn.part}] ★${syn.name}: ${syn.desc}</div>`;
                });
            }

            html += `
            <div style="padding:10px; display:flex; gap:10px; background:#222;">
                <div style="position:relative; width:60px; height:60px; background:#444; border:1px solid #666; border-radius:4px; cursor:pointer; overflow:hidden;"
                     onclick="document.getElementById('file-upload-${c.uid}').click()">
                    ${c.img ? `<img src="${c.img}" style="width:100%;height:100%;object-fit:cover;">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#888;">IMG</div>'}
                    <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.6); color:#fff; font-size:8px; text-align:center;">変更</div>
                </div>
                <input type="file" id="file-upload-${c.uid}" style="display:none" accept="image/*" onchange="MenuAllies.uploadImage(this, '${c.uid}')">

                <div style="flex:1;">
                    <div id="char-name-display" style="display:flex; align-items:center;">
                        <div style="font-size:16px; font-weight:bold; margin-right:5px;">${c.name} <span style="color:#ff0">+${lb}</span></div>
                        <button class="btn" style="padding:0 5px; font-size:10px;" onclick="MenuAllies.toggleNameEdit()">✐</button>
                    </div>
                    <div id="char-name-edit" style="display:none; align-items:center;">
                        <input type="text" id="char-name-input" value="${c.name}" maxlength="6" style="width:100px; background:#333; color:#fff; border:1px solid #888; padding:2px;">
                        <button class="btn" style="margin-left:5px; padding:2px 5px;" onclick="MenuAllies.saveName('${c.uid}')">OK</button>
                    </div>

                    <div style="font-size:12px; color:#aaa;">${c.job} / ${c.rarity}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                        <span>Lv.${c.level}</span>
                        <span style="font-size:10px; color:#ffd700;">Exp: ${c.exp} / Next: ${nextExpText}</span>
                    </div>
                </div>
            </div>
            ${treeBtnHtml}
            ${allocHtml}
            <div style="padding:10px; line-height:1.6; font-size:12px;">
                <div>HP: ${hp}/${s.maxHp}  MP: ${mp}/${s.maxMp}</div>
                <hr style="border-color:#444">
                <div style="display:grid; grid-template-columns:1fr 1fr;">
                    <span>攻: ${s.atk}</span> <span>防: ${s.def}</span>
                    <span>魔: ${s.mag}</span> <span>速: ${s.spd}</span>
                </div>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; margin-top:5px; color:#ffd700;">
                    <span>与ダメ:+${s.finDmg}%</span> <span>被ダメ:-${s.finRed}%</span>
                </div>

                <hr style="border-color:#444">
                <b>属性攻撃</b><br>
                ${CONST.ELEMENTS.map(e => `<span>${e}:${s.elmAtk[e]||0}</span>`).join(' ')}
                <br><b>属性耐性</b><br>
                ${CONST.ELEMENTS.map(e => `<span>${e}:${s.elmRes[e]||0}</span>`).join(' ')}
                
                ${synergiesHtml}
            </div>`;
        } else if(MenuAllies.currentTab === 2) { 
            html += `<div style="padding:10px;">`;
            CONST.PARTS.forEach(p => {
                const eq = c.equips[p];
                if (eq) {
                    html += `<div class="list-item" style="cursor:default; flex-direction:column; align-items:flex-start;">
                        <div style="width:100%; display:flex; justify-content:space-between;">
                            <span style="color:#aaa;">${p}</span>
                        </div>
                        <div style="width:100%; margin-top:2px;">
                            ${Menu.getEquipDetailHTML(eq)}
                        </div>
                    </div>`;
                } else {
                    html += `<div class="list-item" style="cursor:default;"><span style="color:#aaa;">${p}</span> <span style="color:#555;">なし</span></div>`;
                }
            });
            html += `</div>`;
        } else if(MenuAllies.currentTab === 3) { 
            html += `<div style="padding:10px;">`;
            if(!playerObj.skills || playerObj.skills.length===0) {
                html += '<div style="color:#888;">習得しているスキルはありません</div>';
            } else {
                playerObj.skills.forEach(sk => {
                    html += `<div class="list-item">
                        <div style="flex:1; min-width:0;">
                            <div><span style="font-weight:bold;">${sk.name}</span><span style="font-size:10px; color:#aaa;">(${sk.type})</span></div>
                            <div style="font-size:10px; color:#ccc; margin-top:2px;">${sk.desc || ''}</div>
                        </div>
                        <div style="font-size:12px; color:#88f; text-align:right; min-width:60px;">MP:${sk.mp}</div>
                    </div>`;
                });
            }
            html += `</div>`;
        }
        content.innerHTML = html;
    },

    createTreeViewDOM: () => {
        if(document.getElementById('allies-tree-view')) return;
        const div = document.createElement('div');
        div.id = 'allies-tree-view';
        div.className = 'flex-col-container';
        div.style.display = 'none';
        div.style.background = '#1a1a1a';
        div.innerHTML = `
            <div class="header-bar" id="tree-header"></div>
            <div id="tree-content" class="scroll-area" style="padding:10px;"></div>
            <button class="btn" style="margin:10px;" onclick="MenuAllies.renderDetail()">戻る</button>
        `;
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
        header.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <div style="display:flex; align-items:center;">
                    <button class="btn" style="padding:2px 10px;" onclick="MenuAllies.switchChar(-1)">＜</button>
                    <span style="margin:0 10px;">${c.name} (SP:${sp})</span>
                    <button class="btn" style="padding:2px 10px;" onclick="MenuAllies.switchChar(1)">＞</button>
                </div>
                <button class="btn" style="background:#500; font-size:10px; padding:2px 5px;" onclick="MenuAllies.resetTree()">RESET</button>
            </div>
        `;

        const list = document.getElementById('tree-content');
        list.innerHTML = '';
        
        if (!c.tree) c.tree = { ATK:0, MAG:0, SPD:0, HP:0, MP:0 };
        
        for (let key in CONST.SKILL_TREES) {
            const treeDef = CONST.SKILL_TREES[key];
            const currentLevel = c.tree[key] || 0;
            const maxLevel = treeDef.steps.length;
            
            const div = document.createElement('div');
            div.style.cssText = "background:#222; border:1px solid #444; border-radius:4px; margin-bottom:10px; padding:5px;";
            
            let html = `<div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <span style="font-weight:bold; color:#ffd700;">${treeDef.name} Lv.${currentLevel}</span>
                <span style="font-size:11px; color:#aaa;">(${currentLevel}/${maxLevel})</span>
            </div>`;
            
            html += `<div style="display:flex; gap:2px; margin-bottom:5px;">`;
            for(let i=0; i<maxLevel; i++) {
                const step = treeDef.steps[i];
                const achieved = (i < currentLevel);
                const isNext = (i === currentLevel);
                const bg = achieved ? '#008888' : (isNext ? '#444' : '#222');
                const border = isNext ? '1px solid #fff' : '1px solid #444';
                
                html += `<div style="flex:1; background:${bg}; border:${border}; height:6px; border-radius:2px;"></div>`;
            }
            html += `</div>`;
            
            if (currentLevel < maxLevel) {
                const nextStep = treeDef.steps[currentLevel];
                const reqTotal = treeDef.costs[currentLevel];
                const prevReq = (currentLevel > 0) ? treeDef.costs[currentLevel-1] : 0;
                const cost = reqTotal - prevReq;
                const canAfford = (sp >= cost);
                
                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size:12px;">次: <span style="color:#fff;">${nextStep.desc}</span></div>
                        <button class="btn" style="font-size:11px; padding:4px 8px; background:${canAfford?'#d00':'#333'};" 
                            onclick="MenuAllies.unlockTree('${key}', ${cost})" ${canAfford?'':'disabled'}>
                            習得 SP:${cost}
                        </button>
                    </div>
                `;
            } else {
                html += `<div style="font-size:12px; text-align:center; color:#4f4;">MASTER!</div>`;
            }
            div.innerHTML = html;
            list.appendChild(div);
        }
    },

    unlockTree: (key, cost) => {
        const c = MenuAllies.selectedChar;
        if (c.sp >= cost) {
            c.sp -= cost;
            c.tree[key] = (c.tree[key] || 0) + 1;
            App.save();
            MenuAllies.renderTreeView();
            Menu.renderPartyBar(); 
        }
    },

    resetTree: () => {
        const c = MenuAllies.selectedChar;
        Menu.confirm("スキルポイントを初期化しますか？", () => {
            let totalReturned = 0;
            for (let key in c.tree) {
                const lv = c.tree[key];
                if (lv > 0) {
                    const treeDef = CONST.SKILL_TREES[key];
                    if (treeDef && treeDef.costs[lv - 1]) {
                        totalReturned += treeDef.costs[lv - 1];
                    }
                    c.tree[key] = 0;
                }
            }
            c.sp = (c.sp || 0) + totalReturned;
            
            App.save();
            MenuAllies.renderTreeView();
            Menu.renderPartyBar();
            Menu.msg(`スキルをリセットしました。\n(返還SP: ${totalReturned})`);
        });
    },

    createAllocModalDOM: () => {
        if(document.getElementById('alloc-modal')) return;
        const div = document.createElement('div');
        div.id = 'alloc-modal';
        div.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; display:none; flex-direction:column; justify-content:center; align-items:center;';
        div.innerHTML = `
            <div style="width:90%; max-width:320px; max-height:80%; background:#222; border:2px solid #fff; display:flex; flex-direction:column;">
                <div class="header-bar"><span>能力値振分</span></div>
                <div style="padding:10px; text-align:center; border-bottom:1px solid #444;">
                    残りポイント: <span id="alloc-free-pts" style="color:#ffd700; font-weight:bold; font-size:18px;">0</span>
                </div>
                <div id="alloc-list" class="scroll-area" style="flex:1; padding:10px;"></div>
                <div style="padding:10px; display:flex; gap:10px; justify-content:center; border-top:1px solid #444;">
                    <button class="menu-btn" style="width:100px; background:#400040;" onclick="MenuAllies.saveAlloc()">決定</button>
                    <button class="menu-btn" style="width:100px;" onclick="MenuAllies.closeAllocModal()">キャンセル</button>
                </div>
            </div>
        `;
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

    closeAllocModal: () => {
        document.getElementById('alloc-modal').style.display = 'none';
        MenuAllies.tempAlloc = null;
    },

    renderAllocModal: () => {
        const alloc = MenuAllies.tempAlloc;
        let used = 0;
        for(let k in alloc) used += alloc[k];
        const free = MenuAllies.tempTotalPt - used;
        document.getElementById('alloc-free-pts').innerText = free;
        const list = document.getElementById('alloc-list');
        list.innerHTML = '';

        const items = [];
        CONST.ELEMENTS.forEach(elm => {
            items.push({ key: `elmAtk_${elm}`, label: `${elm}属性攻撃` });
            items.push({ key: `elmRes_${elm}`, label: `${elm}属性耐性` });
        });

        items.forEach(item => {
            const val = alloc[item.key] || 0;
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; background:#333; padding:5px; border-radius:4px;';
            div.innerHTML = `
                <div style="font-size:12px;">${item.label}</div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="btn" style="padding:2px 8px;" onclick="MenuAllies.adjustAlloc('${item.key}', -1)">－</button>
                    <span style="width:30px; text-align:center; font-weight:bold;">${val}</span>
                    <button class="btn" style="padding:2px 8px;" onclick="MenuAllies.adjustAlloc('${item.key}', 1)">＋</button>
                </div>
            `;
            list.appendChild(div);
        });
    },

    adjustAlloc: (key, delta) => {
        const alloc = MenuAllies.tempAlloc;
        let used = 0;
        for(let k in alloc) used += alloc[k];
        const free = MenuAllies.tempTotalPt - used;
        const currentVal = alloc[key] || 0;

        if (delta < 0) {
            if (currentVal + delta < 0) return;
            alloc[key] = currentVal + delta;
            if (alloc[key] <= 0) delete alloc[key];
        } else {
            if (free < delta) return;
            alloc[key] = currentVal + delta;
        }
        MenuAllies.renderAllocModal();
    },

    saveAlloc: () => {
        const c = MenuAllies.selectedChar;
        if(c && MenuAllies.tempAlloc) {
            c.alloc = MenuAllies.tempAlloc;
            App.save();
            MenuAllies.renderDetail();
            Menu.msg("振分を保存しました");
        }
        MenuAllies.closeAllocModal();
    }
};

/* ==========================================================================
   6. スキル使用 ～ 8. 鍛冶屋 (変更なし)
   ========================================================================== */
const MenuSkills = {
    selectedCharUid: null,
    selectedSkill: null,
    init: () => {
        document.getElementById('sub-screen-skills').style.display = 'flex';
        MenuSkills.changeScreen('char');
    },
    changeScreen: (mode) => {
        document.getElementById('skill-screen-char').style.display = (mode==='char'?'flex':'none');
        document.getElementById('skill-screen-skill').style.display = (mode==='skill'?'flex':'none');
        document.getElementById('skill-screen-target').style.display = (mode==='target'?'flex':'none');
        if(mode==='char') MenuSkills.renderCharList();
    },
    renderCharList: () => {
        const list = document.getElementById('skill-char-list');
        list.innerHTML = '';
        App.data.party.forEach(uid => {
            if(!uid) return;
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
        
        if(skills.length === 0) {
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
                if(c.currentMp < sk.mp) { Menu.msg("MPが足りません"); return; }
                MenuSkills.selectedSkill = sk;
                MenuSkills.renderTargetList();
            };
            list.appendChild(div);
        });
    },
    renderTargetList: () => {
        MenuSkills.changeScreen('target');
        const list = document.getElementById('skill-target-list');
        list.innerHTML = '';
        App.data.party.forEach(uid => {
            if(!uid) return;
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
        if(actorData.currentMp < sk.mp) { Menu.msg("MPが足りません"); return; }
        Menu.confirm(`${target.name} に ${sk.name} を使いますか？`, () => {
            let targets = [target];
            if(sk.target === '全体') targets = App.data.party.map(uid => App.getChar(uid)).filter(c=>c);
            let effected = false;
            const actorStats = App.calcStats(actorData); 
            const mag = actorStats.mag; 
            targets.forEach(t => {
                const s = App.calcStats(t);
                const tMaxHp = s.maxHp;
                if(sk.type.includes('回復')) {
                    if(t.currentHp < tMaxHp && (!t.currentHp || t.currentHp > 0)) { 
                        let base = sk.base || 0;
                        let rec = 0;
                        if(sk.fix) rec = sk.base;
                        else rec = Math.floor((mag + base) * (sk.rate || 1.0));
                        t.currentHp = Math.min(tMaxHp, (t.currentHp||0) + rec);
                        effected = true;
                    }
                } else if(sk.type.includes('蘇生')) {
                    if(!t.currentHp || t.currentHp <= 0) {
                        t.currentHp = Math.floor(tMaxHp * 0.5);
                        effected = true;
                    }
                }
            });
            if(effected) {
                actorData.currentMp -= sk.mp;
                App.save();
                Menu.msg(`${sk.name}を使用した！`, () => {
                    MenuSkills.renderTargetList(); 
                    Menu.renderPartyBar();
                });
            } else {
                Menu.msg("効果がありませんでした");
            }
        });
    }
};

/* ==========================================================================
   7. 魔物図鑑 (レイアウト刷新版)
   ========================================================================== */
const MenuBook = {
    init: () => {
        const list = document.getElementById('book-list');
        list.innerHTML = '';
        const defeated = App.data.book.monsters || [];
        
        // 登録順（ID順）またはランク順にソートしたい場合はここでsortしても良い
        // 今回はデータベースの並び順（強さ順に近い）で表示
        
        DB.MONSTERS.forEach(m => {
            const isKnown = defeated.includes(m.id);
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.alignItems = 'flex-start'; // 上揃えにする

            if(isKnown) {
                // ドロップ品名の解決
                let dropName = 'なし';
                if(m.drop) {
                    const dropItem = DB.EQUIPS.find(e=>e.id===m.drop) || DB.ITEMS.find(i=>i.id===m.drop);
                    if(dropItem) dropName = dropItem.name;
                }

                // スキル名の解決
                const skillNames = m.acts.map(id => {
                    const s = DB.SKILLS.find(k => k.id === id);
                    return s ? s.name : '通常攻撃';
                }).join(', ');

                // 画像枠 + 4行情報のレイアウト
                div.innerHTML = `
                    <div style="width:64px; height:64px; background:#222; border:1px solid #444; margin-right:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#555; font-size:10px;">
                        NO IMAGE
                    </div>
                    
                    <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; min-height:64px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:2px; margin-bottom:2px;">
                            <span style="font-size:15px; font-weight:bold; color:#f88;">${m.name}</span>
                            <span style="font-size:11px; color:#aaa;">Rank:${m.rank}</span>
                        </div>
                        
                        <div style="font-size:10px; color:#ccc; display:flex; gap:6px;">
                            <span>HP:${m.hp}</span>
                            <span>攻:${m.atk}</span>
                            <span>防:${m.def}</span>
                            <span>魔:${m.mag}</span>
                            <span>速:${m.spd}</span>
                        </div>
                        
                        <div style="font-size:10px; color:#aaa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">
                            行動: ${skillNames}
                        </div>
                        
                        <div style="font-size:10px; color:#ffd700;">
                            EXP:${m.exp} / GOLD:${m.gold}
                        </div>
                    </div>
                `;
            } else {
                // 未発見時の表示
                div.innerHTML = `
                    <div style="width:64px; height:64px; background:#111; border:1px solid #333; margin-right:10px; flex-shrink:0;"></div>
                    <div style="flex:1; display:flex; align-items:center; height:64px;">
                        <span style="color:#444; font-size:20px; letter-spacing:2px;">？？？</span>
                    </div>
                `;
            }
            list.appendChild(div);
        });
    }
};
