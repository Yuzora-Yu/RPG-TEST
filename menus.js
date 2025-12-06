/* menus.js (パーティバー画像表示対応版) */

const Menu = {
    // --- メインメニュー制御 ---
    openMainMenu: () => {
        document.getElementById('menu-overlay').style.display = 'flex';
        Menu.renderPartyBar();
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

    // ★修正: パーティステータスバー更新 (画像表示対応)
    renderPartyBar: () => {
        const bars = document.querySelectorAll('.party-bar'); 
        bars.forEach(bar => {
            bar.innerHTML = '';
            App.data.party.forEach(uid => {
                const div = document.createElement('div');
                div.className = 'p-box';
                // 少し高さを確保するためにCSSクラスに依存せずスタイル調整
                div.style.justifyContent = 'flex-start'; 
                
                if(uid) {
                    const p = App.getChar(uid);
                    const stats = App.calcStats(p);
                    const curHp = p.currentHp!==undefined ? p.currentHp : stats.maxHp;
                    const curMp = p.currentMp!==undefined ? p.currentMp : stats.maxMp;
                    const lbText = p.limitBreak > 0 ? `<span style="color:#ffd700; font-size:9px; margin-left:2px;">+${p.limitBreak}</span>` : '';

                    // ★追加: 画像HTML生成
                    const imgHtml = p.img 
                        ? `<img src="${p.img}" style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #666; margin-bottom:2px;">`
                        : `<div style="width:32px; height:32px; background:#333; border-radius:4px; border:1px solid #666; display:flex; align-items:center; justify-content:center; color:#555; font-size:8px; margin-bottom:2px;">IMG</div>`;

                    div.innerHTML = `
                        <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; overflow:hidden; padding-top:2px;">
                            ${imgHtml}
                            <div style="display:flex; align-items:center; width:100%; justify-content:center;">
                                <div style="font-weight:bold; color:#fff; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90%;">
                                    ${p.name}
                                </div>
                                ${lbText}
                            </div>
                            </div>
                        <div style="width:100%; margin-top:2px;">
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

    getEquipDetailHTML: (equip) => {
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
        if (equip.isSynergy) {
             const syn = App.checkSynergy(equip);
             if(syn) synergyHTML = `<div style="font-size:10px; color:${syn.color||'#f88'}; margin-top:2px;">★${syn.name}: ${syn.desc}</div>`;
        }

        html += `
            <div style="font-size:12px; font-weight:bold; color:${rarityColor}; margin-bottom:2px;">${equip.name}</div>
            <div style="font-size:10px; color:#ccc;">${baseEffect}</div>
            ${optsHTML}
            ${synergyHTML}
        `;
        return html;
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
                <div style="font-size:10px; color:#aaa; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${baseEffect}</div>
            </div>
            ${optsHTML ? `<div style="font-size:10px; color:#ccc; text-align:right; margin-left:10px;">${optsHTML}</div>` : ''}
        `;
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
        if (!list) list = document.getElementById('list-part');
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
        if(!list) list = document.getElementById('list-item-candidates');
        if(!list) return;

        list.innerHTML = '';
        const footer = document.getElementById('equip-footer');
        const header = document.getElementById('equip-item-header');
        if(header) header.innerText = `${MenuEquip.targetChar.name} - ${MenuEquip.targetPart}を選択中`;
        if(footer) footer.innerHTML = "装備を選択すると能力変化を確認できます";
        
        MenuEquip.selectedEquipId = null;
        const part = MenuEquip.targetPart;
        const candidates = [];
        candidates.push({id:'remove', name:'(装備を外す)', isRemove:true});
        
        App.data.inventory.filter(i => i.type === part).forEach(i => candidates.push(i));
        App.data.characters.forEach(other => {
            if(other.uid !== MenuEquip.targetChar.uid && other.equips[part]) {
                candidates.push({...other.equips[part], owner:other.name});
            }
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
const MenuInventory = {
    init: () => {
        document.getElementById('sub-screen-inventory').style.display = 'flex';
        MenuInventory.render();
    },
    render: () => {
        document.getElementById('inventory-gold').innerText = App.data.gold;
        const list = document.getElementById('inventory-list');
        list.innerHTML = '';
        const footer = document.getElementById('inventory-footer');
        footer.innerHTML = "アイテムをタップすると売却メニューが開きます";

        if(App.data.inventory.length === 0) {
            list.innerHTML = '<div style="padding:10px; color:#888;">装備品を持っていません</div>';
            return;
        }
        const items = [...App.data.inventory].reverse();

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'flex-start';

            let ownerName = '';
            const owner = App.data.characters.find(c => c.equips[item.type] && c.equips[item.type].id === item.id);
            if(owner) ownerName = ` <span style="font-size:10px; color:#f88;">[装備中:${owner.name}]</span>`;

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <div>${item.name}${ownerName}</div>
                    <div style="font-size:11px; color:#ffd700;">${Math.floor(item.val/2)}G</div>
                </div>
                ${Menu.getEquipDetailHTML(item)}
            `;
            div.onclick = () => MenuInventory.sell(item.id, item.val, item.name);
            list.appendChild(div);
        });
    },
    sell: (id, val, name) => {
        const idx = App.data.inventory.findIndex(i => i.id === id);
        if(idx === -1) return;
        const item = App.data.inventory[idx];
        const owner = App.data.characters.find(c => c.equips[item.type] && c.equips[item.type].id === item.id);
        
        if(owner) { Menu.msg(`${owner.name}が装備中のため売却できません。\n先に装備を外してください。`); return; }

        const price = Math.floor(val / 2);
        Menu.confirm(`${name} を\n${price}G で売却しますか？`, () => {
            App.data.inventory.splice(idx, 1);
            App.data.gold += price;
            App.save();
            Menu.msg(`${price}G で売却しました`, () => MenuInventory.render());
        });
    }
};

/* ==========================================================================
   5. 仲間一覧 & 詳細 (画像・名前変更機能追加)
   ========================================================================== */
const MenuAllies = {
    selectedChar: null, 
    currentTab: 1,
    tempAlloc: null,

    init: () => {
        document.getElementById('allies-list-view').style.display = 'flex';
        document.getElementById('allies-detail-view').style.display = 'none';
        MenuAllies.renderList();
        MenuAllies.createAllocModalDOM();
    },

    renderList: () => {
        const list = document.getElementById('allies-list');
        list.innerHTML = '';
        App.data.characters.forEach(c => {
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
        const chars = App.data.characters;
        let idx = chars.findIndex(c => c.uid === MenuAllies.selectedChar.uid);
        if (idx === -1) idx = 0;
        let newIdx = idx + dir;
        if (newIdx < 0) newIdx = chars.length - 1;
        if (newIdx >= chars.length) newIdx = 0;
        MenuAllies.selectedChar = chars[newIdx];
        MenuAllies.renderDetail();
    },

    // ★追加: 画像アップロード
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

    // ★追加: 名前編集モード切替
    toggleNameEdit: () => {
        const disp = document.getElementById('char-name-display');
        const edit = document.getElementById('char-name-edit');
        if(disp.style.display === 'none') {
            disp.style.display = 'flex'; edit.style.display = 'none';
        } else {
            disp.style.display = 'none'; edit.style.display = 'flex';
        }
    },

    // ★追加: 名前保存
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
        document.getElementById('allies-detail-view').style.display = 'flex';
        
        const c = MenuAllies.selectedChar;
        const playerObj = new Player(c);
        const s = App.calcStats(c);
        const hp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
        const mp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
        const lb = c.limitBreak || 0;
        const nextExp = App.getNextExp(c);
        const nextExpText = nextExp === Infinity ? "MAX" : nextExp;

        const navHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#333; padding:5px; margin-bottom:5px; border-radius:4px;">
                <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuAllies.switchChar(-1)">＜ 前</button>
                <span style="font-weight:bold; font-size:14px;">詳細設定</span>
                <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuAllies.switchChar(1)">次 ＞</button>
            </div>
        `;

        let allocHtml = '';
        if(c.uid === 'p1') {
            const totalPt = Math.floor(lb / 10) * 10;
            let used = 0;
            if(c.alloc) for(let k in c.alloc) used += c.alloc[k];
            const free = totalPt - used;
            allocHtml = `<div style="background:#440; padding:5px; margin-top:5px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                <span>振分Pt 残り: <b>${free}</b></span> <button class="btn" onclick="MenuAllies.openAllocModal()">振分変更</button>
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
            ${allocHtml}
            <div style="padding:10px; line-height:1.6; font-size:12px;">
                <div>HP: ${hp}/${s.maxHp}  MP: ${mp}/${s.maxMp}</div>
                <hr style="border-color:#444">
                <div style="display:grid; grid-template-columns:1fr 1fr;">
                    <span>攻: ${s.atk}</span> <span>防: ${s.def}</span>
                    <span>魔: ${s.mag}</span> <span>速: ${s.spd}</span>
                </div>
                <hr style="border-color:#444">
                <b>属性攻撃</b><br>
                ${CONST.ELEMENTS.map(e => `<span>${e}:${s.elmAtk[e]||0}</span>`).join(' ')}
                <br><b>属性耐性</b><br>
                ${CONST.ELEMENTS.map(e => `<span>${e}:${s.elmRes[e]||0}</span>`).join(' ')}
            </div>`;
        } else if(MenuAllies.currentTab === 2) { 
            html += `<div style="padding:10px;">`;
            CONST.PARTS.forEach(p => {
                const eq = c.equips[p];
                let detail = '';
                let nameColor = '#fff';
                if (eq) {
                    let stats = [];
                    if(eq.data.atk) stats.push(`攻+${eq.data.atk}`);
                    if(eq.data.def) stats.push(`防+${eq.data.def}`);
                    if(eq.data.mag) stats.push(`魔+${eq.data.mag}`);
                    if(eq.data.spd) stats.push(`速+${eq.data.spd}`);
                    if(eq.opts) {
                        eq.opts.forEach(o => {
                            let valStr = o.unit === '%' ? `${o.val}%` : `${o.val}`;
                            let rColor = Menu.getRarityColor(o.rarity||'N');
                            stats.push(`<span style="color:${rColor};">[${o.label}+${valStr}]</span>`);
                        });
                    }
                    if(eq.isSynergy) nameColor = '#ff4444';
                    detail = stats.join(' ');
                }
                html += `<div class="list-item" style="cursor:default; flex-direction:column; align-items:flex-start;">
                    <div style="display:flex; width:100%;">
                        <div style="width:40px; color:#aaa;">${p}</div>
                        <div style="font-weight:bold; color:${nameColor};">${eq ? eq.name : 'なし'}</div>
                    </div>
                    ${eq ? `<div style="font-size:10px; margin-left:40px; line-height:1.2; margin-top:2px;">${detail}</div>` : ''}
                </div>`;
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
        
        // 移動中に使えるスキル (回復・蘇生)
        const skills = player.skills.filter(s => s.type.includes('回復') || s.type.includes('蘇生'));
        
        if(skills.length === 0) {
            list.innerHTML = '<div style="padding:10px; color:#888;">使用可能なスキルがありません</div>';
            return;
        }

        skills.forEach(sk => {
            const div = document.createElement('div');
            div.className = 'list-item';
            // ★要望: スキル名の下に備考欄を小さく表示
            div.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:bold;">${sk.name}</div>
                    <div style="font-size:10px; color:#aaa;">${sk.desc || ''}</div>
                </div>
                <div style="font-size:12px; color:#88f;">MP:${sk.mp}</div>
            `;
            div.onclick = () => {
                if(c.currentMp < sk.mp) {
                    Menu.msg("MPが足りません");
                    return;
                }
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
        
        if(actorData.currentMp < sk.mp) {
            Menu.msg("MPが足りません");
            return;
        }

        // ★修正: 確認ダイアログを使用
        Menu.confirm(`${target.name} に ${sk.name} を使いますか？`, () => {
            let targets = [target];
            if(sk.target === '全体') {
                targets = App.data.party.map(uid => App.getChar(uid)).filter(c=>c);
            }

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
                
                // ★完了メッセージ
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
   7. 魔物図鑑
   ========================================================================== */
const MenuBook = {
    init: () => {
        const list = document.getElementById('book-list');
        list.innerHTML = '';
        const defeated = App.data.book.monsters || [];
        
        DB.MONSTERS.forEach(m => {
            const isKnown = defeated.includes(m.id);
            const div = document.createElement('div');
            div.className = 'list-item';
            
            if(isKnown) {
                const dropItem = DB.EQUIPS.find(e=>e.id===m.drop) || DB.ITEMS.find(i=>i.id===m.drop);
                const dropName = dropItem ? dropItem.name : '-';
                
                div.innerHTML = `
                    <div style="font-weight:bold; color:#f88;">${m.name}</div>
                    <div style="font-size:10px; line-height:1.4;">
                        HP:${m.hp} EXP:${m.exp} G:${m.gold}<br>
                        ドロップ: ${dropName}<br>
                        スキル: ${m.acts.map(id=>DB.SKILLS.find(s=>s.id===id)?.name).join(', ')}
                    </div>
                `;
            } else {
                div.innerHTML = `<div style="color:#888;">？？？</div>`;
            }
            list.appendChild(div);
        });
    }
};

/* ==========================================================================
   8. 鍛冶屋
   ========================================================================== */
const MenuBlacksmith = {
    mode: null,
    init: () => {
        document.getElementById('smith-screen-main').style.display = 'flex';
        document.getElementById('smith-screen-select').style.display = 'none';
        
        const lv = App.data.blacksmith.level;
        const exp = App.data.blacksmith.exp;
        document.getElementById('smith-info').innerText = `鍛冶屋Lv: ${lv} (Exp: ${exp})`;
    },
    selectMode: (mode) => {
        MenuBlacksmith.mode = mode;
        MenuBlacksmith.changeScreen('select');
        MenuBlacksmith.renderBaseList();
    },
    changeScreen: (id) => {
        document.getElementById('smith-screen-main').style.display = (id==='main'?'flex':'none');
        document.getElementById('smith-screen-select').style.display = (id==='select'?'flex':'none');
    },
    renderBaseList: () => {
        const list = document.getElementById('smith-list');
        list.innerHTML = '';
        const footer = document.getElementById('smith-footer');
        footer.innerText = MenuBlacksmith.mode === 'enhance' ? "強化する装備を選択" : "拡張する装備(+3)を選択";
        
        App.data.inventory.forEach(eq => {
            if(MenuBlacksmith.mode === 'expand' && (!eq.opts || eq.opts.length < 3)) return;
            
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `<div>${eq.name}</div>`;
            div.onclick = () => {
                if(MenuBlacksmith.mode === 'enhance') {
                    alert("強化機能: 今回の実装範囲外です（素材選択UIが必要）");
                } else {
                    if(App.data.gems < 500) { footer.innerText = "ジェム不足(500)"; return; }
                    
                    if(confirm("500ジェム消費してスロットを追加しますか？")) {
                        App.data.gems -= 500;
                        const keys = ['atk','def','hp'];
                        const key = keys[Math.floor(Math.random()*3)];
                        const newOpt = Blacksmith.expandSlot(eq.id, key);
                        if(newOpt) {
                            alert(`追加: ${newOpt.label} +${newOpt.val} (${newOpt.rarity})`);
                            App.save();
                            MenuBlacksmith.init();
                        }
                    }
                }
            };
            list.appendChild(div);
        });
    }
};
