/* menus.js */

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

    // パーティステータスバー更新
    renderPartyBar: () => {
        const bars = document.querySelectorAll('.party-bar'); 
        bars.forEach(bar => {
            bar.innerHTML = '';
            App.data.party.forEach(uid => {
                const div = document.createElement('div');
                div.className = 'p-box';
                if(uid) {
                    const p = App.getChar(uid);
                    const stats = App.calcStats(p);
                    const curHp = p.currentHp!==undefined ? p.currentHp : stats.maxHp;
                    const curMp = p.currentMp!==undefined ? p.currentMp : stats.maxMp;
                    const lbText = p.limitBreak > 0 ? `<span style="color:#ffd700; font-size:9px; margin-left:2px;">+${p.limitBreak}</span>` : '';

                    div.innerHTML = `
                        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; width:100%; overflow:hidden;">
                            <div style="display:flex; align-items:center; width:100%;">
                                <div style="font-weight:bold; color:#fff; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; text-align:left;">
                                    ${p.name}
                                </div>
                                ${lbText}
                            </div>
                            <div style="font-size:9px; color:#aaa; text-align:left; white-space:nowrap; overflow:hidden;">${p.job} Lv.${p.level}</div>
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

    // 装備詳細HTML生成 (仲間詳細、装備部位表示、所持装備一覧など、縦長表示用)
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

        // 追加オプション (レアリティ表記あり)
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

        // シナジー
        let synergyHTML = '';
        if (equip.isSynergy) {
             const syn = App.checkSynergy(equip);
             if(syn) synergyHTML = `<div style="font-size:10px; color:${syn.color||'#f88'}; margin-top:2px;">★${syn.name}: ${syn.desc}</div>`;
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
    
    // ★新規追加: 装備選択リスト用のコンパクトHTML (2. 装備変更で使用)
    getEquipDetailHTML_for_EquipList: (equip) => {
        const rarity = equip.rarity || 'N';
        const rarityColor = Menu.getRarityColor(rarity);

        // 基礎効果をコンパクトにまとめる
        let baseStats = [];
        if (equip.data) {
            if (equip.data.atk) baseStats.push(`攻+${equip.data.atk}`);
            if (equip.data.def) baseStats.push(`防+${equip.data.def}`);
            if (equip.data.mag) baseStats.push(`魔+${equip.data.mag}`);
            if (equip.data.spd) baseStats.push(`速+${equip.data.spd}`);
            // HP/MPは表示が長くなるため省略
        }
        const baseEffect = baseStats.length > 0 ? baseStats.join(' / ') : '基本効果なし';
        
        // 追加オプションをコンパクトにまとめる (レアリティ表記あり)
        let optsHTML = '';
        if (equip.opts && equip.opts.length > 0) {
            optsHTML = equip.opts.map(o => {
                const optRarity = o.rarity || 'N';
                const optColor = Menu.getRarityColor(optRarity);
                const unit = o.unit === 'val' ? '' : o.unit;
                // [攻+5 R] の形式
                return `<span style="color:${optColor};">${o.label}+${o.val}${unit} (${optRarity})</span>`;
            }).join(', ');
        }
        
        let synergyHTML = '';
        if (equip.isSynergy) {
             const syn = App.checkSynergy(equip);
             if(syn) synergyHTML = `<span style="color:${syn.color||'#f88'};">★${syn.name}</span>`;
        }
        
        // レイアウト: 
        // <div style="flex:1;">
        //   <div style="名前 (色)">
        //   <div style="基礎効果">
        // </div>
        // <div style="追加効果">
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
        // 4枠固定ループ
        for(let i=0; i<4; i++) {
            const uid = App.data.party[i];
            const char = uid ? App.getChar(uid) : null;
            const div = document.createElement('div');
            div.className = 'list-item';
            
            let content = `<div><span style="color:#ffd700">${i+1}.</span> (空き)</div>`;
            if(char) {
                // 詳細表示
                content = `<div style="flex:1">${App.createCharHTML(char)}</div><div style="font-size:10px; color:#888; margin-left:5px;">変更&gt;</div>`;
            }
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
        // 最後の1人を外せないチェック
        if (uid === null) {
            const currentCount = App.data.party.filter(id => id !== null).length;
            // 対象スロットが埋まっていて、かつそれが最後の1人ならブロック
            if (App.data.party[MenuParty.targetSlot] !== null && currentCount <= 1) {
                alert("パーティメンバーを0人にはできません。");
                return;
            }
        }

        // 入れ替え処理
        const oldIdx = App.data.party.indexOf(uid);
        if(oldIdx > -1 && uid !== null) {
            App.data.party[oldIdx] = App.data.party[MenuParty.targetSlot];
        }
        
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
        // 初期化時に、パーティの先頭をターゲットにする
        const partyUids = App.data.party.filter(uid => uid);
        if(partyUids.length > 0) {
            MenuEquip.targetChar = App.getChar(partyUids[0]);
        } else {
             // メンバーがいない場合は処理しない
             return; 
        }
        
        // 装備部位画面に直接遷移
        MenuEquip.changeScreen('part');
        MenuEquip.renderPartList();
    },
    
    changeScreen: (id) => {
        // 'char'画面は廃止
        ['char','part','item'].forEach(s => {
            const el = document.getElementById(`equip-screen-${s}`);
            if(el) el.style.display = 'none';
        });
        const target = document.getElementById(`equip-screen-${id}`);
        if(target) target.style.display = 'flex';
    },

    // ★追加: キャラクター切り替え機能
    switchChar: (dir) => {
        if (!MenuEquip.targetChar) return;
        const partyUids = App.data.party.filter(uid => uid);
        let idx = partyUids.indexOf(MenuEquip.targetChar.uid);
        
        if (idx === -1) idx = 0; // 見つからない場合は先頭へ
        
        let newIdx = idx + dir;
        if (newIdx < 0) newIdx = partyUids.length - 1;
        if (newIdx >= partyUids.length) newIdx = 0;
        
        MenuEquip.targetChar = App.getChar(partyUids[newIdx]);
        
        // 装備部位リストを再描画
        MenuEquip.renderPartList();
        
        // アイテム選択画面から切り替えた場合、部位選択画面に戻す
        if (document.getElementById('equip-screen-item').style.display === 'flex') {
            MenuEquip.changeScreen('part'); 
        }
    },
    
    renderPartList: () => {
        const c = MenuEquip.targetChar;
        if (!c) { /* エラー処理 */ return; }

        const s = App.calcStats(c);
        
        // ステータス表示 (★修正: キャラ切り替えボタンを追加)
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
        
        // 正しいID 'equip-slot-list' を優先的に取得する
        let list = document.getElementById('equip-slot-list');
        if (!list) list = document.getElementById('list-part'); // フォールバック
        if (!list) return;

        list.innerHTML = '';
        CONST.PARTS.forEach(part => {
            const eq = c.equips[part];
            const div = document.createElement('div');
            div.className = 'list-item';
            
            // 装備の詳細HTMLを取得して表示
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
        // ID揺れ吸収
        let list = document.getElementById('equip-list');
        if(!list) list = document.getElementById('list-item-candidates');
        if(!list) return;

        list.innerHTML = '';
        const footer = document.getElementById('equip-footer');
        
        // ヘッダー表示
        const header = document.getElementById('equip-item-header');
        if(header) header.innerText = `${MenuEquip.targetChar.name} - ${MenuEquip.targetPart}を選択中`;

        if(footer) footer.innerHTML = "装備を選択すると能力変化を確認できます";
        MenuEquip.selectedEquipId = null;

        const part = MenuEquip.targetPart;
        const candidates = [];
        candidates.push({id:'remove', name:'(装備を外す)', isRemove:true});
        
        // インベントリから該当部位を抽出
        App.data.inventory.filter(i => i.type === part).forEach(i => candidates.push(i));
        
        // 他のキャラが装備しているものも候補に入れる
        App.data.characters.forEach(other => {
            if(other.uid !== MenuEquip.targetChar.uid && other.equips[part]) {
                candidates.push({...other.equips[part], owner:other.name});
            }
        });

        candidates.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            
            let html = '';
            if(item.isRemove) {
                html = `<div style="color:#aaa; font-weight:bold;">${item.name}</div>`;
            } else {
                html = Menu.getEquipDetailHTML_for_EquipList(item); 
                if(item.owner) {
                    html += `<div style="text-align:right; font-size:10px; color:#f88; margin-left:10px;">[${item.owner} 装備中]</div>`;
                }
            }
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.innerHTML = html;
            
            div.onclick = () => {
                if(MenuEquip.selectedEquipId === item.id) {
                    // 2回タップで決定
                    MenuEquip.doEquip(item.isRemove ? null : item);
                } else {
                    // 1回タップで選択＆比較表示
                    MenuEquip.selectedEquipId = item.id;
                    Array.from(list.children).forEach(c => c.classList.remove('selected'));
                    div.classList.add('selected');
                    
                    if(item.isRemove) {
                        MenuEquip.renderStatsComparison(null);
                    } else {
                        MenuEquip.renderStatsComparison(item);
                    }
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
        
        // ダミーキャラを作って装備変更後のステータスを計算
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
            if(owner) {
                owner.equips[p] = null;
            }
            
            const idx = App.data.inventory.findIndex(i => i.id === item.id);
            if(idx > -1) App.data.inventory.splice(idx, 1);
            
            c.equips[p] = item;
            // 装備完了時のダイアログは表示しない (ユーザー要望)
        } else {
            c.equips[p] = null;
            // 装備解除時のダイアログは表示しない (ユーザー要望)
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
            // ★修正: 道具名の下に備考欄を表示
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
   4. 所持装備一覧 (修正版: 売却確認をメニュー内で行う)
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

        // 新しい順に表示
        const items = [...App.data.inventory].reverse();

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'flex-start';

            // 装備中なら所有者名を表示
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
            
            div.onclick = () => {
                MenuInventory.sell(item.id, item.val, item.name);
            };
            list.appendChild(div);
        });
    },
    sell: (id, val, name) => {
        const idx = App.data.inventory.findIndex(i => i.id === id);
        if(idx === -1) return;
        
        const item = App.data.inventory[idx];
        const owner = App.data.characters.find(c => c.equips[item.type] && c.equips[item.type].id === item.id);
        
        if(owner) {
            Menu.msg(`${owner.name}が装備中のため売却できません。\n先に装備を外してください。`);
            return;
        }

        const price = Math.floor(val / 2);
        
        // 画面内ダイアログで確認
        Menu.confirm(`${name} を\n${price}G で売却しますか？`, () => {
            App.data.inventory.splice(idx, 1);
            App.data.gold += price;
            App.save();
            Menu.msg(`${price}G で売却しました`, () => {
                MenuInventory.render();
            });
        });
    }
};

/* ==========================================================================
   5. 仲間一覧 & 詳細 (3タブ + 主人公振分)
   ========================================================================== */
const MenuAllies = {
    selectedChar: null, 
    currentTab: 1,
    
    // 振り分け用一時データ
    tempAlloc: null,

    // 初期化
    init: () => {
        document.getElementById('allies-list-view').style.display = 'flex';
        document.getElementById('allies-detail-view').style.display = 'none';
        MenuAllies.renderList();
        
        // 振り分け用モーダルがHTMLにない場合、動的に生成しておく（初回のみ）
        MenuAllies.createAllocModalDOM();
    },

    // 一覧描画
    renderList: () => {
        const list = document.getElementById('allies-list');
        list.innerHTML = '';
        
        App.data.characters.forEach(c => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = App.createCharHTML(c);
            
            div.onclick = () => {
                MenuAllies.selectedChar = c;
                // タブはリセットせず、以前の状態を維持するか、1に戻す
                // MenuAllies.currentTab = 1; 
                MenuAllies.renderDetail();
            };
            list.appendChild(div);
        });
    },

    // キャラクター切り替え
    switchChar: (dir) => {
        if (!MenuAllies.selectedChar) return;
        
        const chars = App.data.characters;
        let idx = chars.findIndex(c => c.uid === MenuAllies.selectedChar.uid);
        
        if (idx === -1) idx = 0;
        
        // インデックス計算 (ループ)
        let newIdx = idx + dir;
        if (newIdx < 0) newIdx = chars.length - 1;
        if (newIdx >= chars.length) newIdx = 0;
        
        MenuAllies.selectedChar = chars[newIdx];
        MenuAllies.renderDetail();
    },

    // 詳細画面の描画
    renderDetail: () => {
        document.getElementById('allies-list-view').style.display = 'none';
        document.getElementById('allies-detail-view').style.display = 'flex';
        
        const c = MenuAllies.selectedChar;
        const playerObj = new Player(c); // スキル等取得用
        
        const s = App.calcStats(c);
        const hp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
        const mp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
        const lb = c.limitBreak || 0;
        
        const nextExp = App.getNextExp(c);
        const nextExpText = nextExp === Infinity ? "MAX" : nextExp;

        // --- ナビゲーションボタン (新規追加) ---
        // 仲間一覧に戻るボタンの代わりに、上部で切り替えを行えるようにする
        // ※「一覧へ戻る」はHTML側のフッターボタンで行う想定
        const navHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#333; padding:5px; margin-bottom:5px; border-radius:4px;">
                <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuAllies.switchChar(-1)">＜ 前</button>
                <span style="font-weight:bold; font-size:14px;">${c.name}</span>
                <button class="btn" style="padding:2px 10px; font-size:12px;" onclick="MenuAllies.switchChar(1)">次 ＞</button>
            </div>
        `;

        // 主人公用振分ボタン (モーダル起動)
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

        // タブ生成
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
        let html = navHtml; // ナビゲーションを最上部に追加
        
        if(MenuAllies.currentTab === 1) { 
            // --- 1タブ目: 基本 ---
            html += `
            <div style="padding:10px; display:flex; gap:10px; background:#222;">
                <div style="width:60px; height:60px; background:#444; display:flex; align-items:center; justify-content:center;">${c.img?'<img src="'+c.img+'" style="width:100%;height:100%;object-fit:cover;">':'IMG'}</div>
                <div style="flex:1;">
                    <div style="font-size:16px; font-weight:bold;">${c.name} <span style="color:#ff0">+${lb}</span></div>
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
                <hr style="border-color:#444">
                <b>特殊補正</b>
                <div style="color:#ccc; margin-top:4px;">
                    <div>魔法ダメ増: <span style="color:#fff">${s.magDmg}%</span></div>
                    <div>特技ダメ増: <span style="color:#fff">${s.sklDmg}%</span></div>
                    <div>与ダメ増: <span style="color:#fff">${s.finDmg}%</span></div>
                    <div>被ダメ減: <span style="color:#fff">${s.finRed}</span></div>
                    <div>MP消費減: <span style="color:#fff">${s.mpRed}%</span></div>
                </div>
            </div>`;
        } else if(MenuAllies.currentTab === 2) { 
            // --- 2タブ目: 装備 ---
            html += `<div style="padding:10px;">`;
            CONST.PARTS.forEach(p => {
                const eq = c.equips[p];
                let detail = '';
                let nameColor = '#fff';
                
                if (eq) {
                    // 基礎ステータス
                    let stats = [];
                    if(eq.data.atk) stats.push(`攻+${eq.data.atk}`);
                    if(eq.data.def) stats.push(`防+${eq.data.def}`);
                    if(eq.data.mag) stats.push(`魔+${eq.data.mag}`);
                    if(eq.data.spd) stats.push(`速+${eq.data.spd}`);
                    
                    // 追加オプション
                    if(eq.opts) {
                        eq.opts.forEach(o => {
                            let valStr = o.unit === '%' ? `${o.val}%` : `${o.val}`;
                            // レアリティ色
                            let rColor = '#aaa';
                            if(o.rarity === 'SR') rColor = '#40e0e0';
                            if(o.rarity === 'SSR') rColor = '#ff4444';
                            if(o.rarity === 'UR') rColor = '#ff00ff';
                            if(o.rarity === 'EX') rColor = '#ffff00';
                            stats.push(`<span style="color:${rColor};">[${o.label}+${valStr} ${o.rarity||''}]</span>`);
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
            // --- 3タブ目: 技能 ---
            html += `<div style="padding:10px;">`;
            if(!playerObj.skills || playerObj.skills.length===0) {
                html += '<div style="color:#888;">習得しているスキルはありません</div>';
            } else {
                playerObj.skills.forEach(sk => {
                    html += `<div class="list-item">
                        <div style="flex:1; min-width:0;">
                            <div>
                                <span style="font-weight:bold;">${sk.name}</span>
                                <span style="font-size:10px; color:#aaa;">(${sk.type})</span>
                            </div>
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

    // --- 能力値振り分け (モーダル版) ---

    // モーダルDOM生成 (存在しない場合のみ)
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

        // 計算用のデータを準備
        const lb = c.limitBreak || 0;
        const totalPt = Math.floor(lb / 10) * 10;
        
        // 現在の振分状況をコピー
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

        // 振分可能な項目リスト (属性攻撃・属性耐性)
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

        // 減らす場合: 0未満にしない
        if (delta < 0) {
            if (currentVal + delta < 0) return; // 0未満ガード
            alloc[key] = currentVal + delta;
            if (alloc[key] <= 0) delete alloc[key];
        } 
        // 増やす場合: 空きポイントが必要
        else {
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
            // ★修正: alert -> Menu.msg
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
