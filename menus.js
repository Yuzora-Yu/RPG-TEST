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
    },

    // パーティステータスバー更新（HP/MPバーなど）
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

                    // 名前と+値を1行に収めるフレックスレイアウト
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
        document.getElementById('menu-overlay').style.display = 'none'; // メインを隠す
        document.querySelectorAll('.sub-screen').forEach(e => e.style.display = 'none');
        document.getElementById('sub-screen-' + id).style.display = 'flex';
        
        // 初期化処理呼び出し
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
        document.getElementById('menu-overlay').style.display = 'flex'; // メインに戻る
        Menu.renderPartyBar();
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
        MenuEquip.changeScreen('char');
        MenuEquip.renderCharList();
    },
    
    changeScreen: (id) => {
        ['char','part','item'].forEach(s => document.getElementById(`equip-screen-${s}`).style.display = 'none');
        document.getElementById(`equip-screen-${id}`).style.display = 'flex';
    },
    
    renderCharList: () => {
        const list = document.getElementById('equip-char-list');
        list.innerHTML = '';
        
        // パーティメンバーのみ表示
        App.data.party.forEach(uid => {
            if(!uid) return;
            const c = App.getChar(uid);
            if(!c) return;

            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = App.createCharHTML(c);
            div.onclick = () => {
                MenuEquip.targetChar = c;
                MenuEquip.changeScreen('part');
                MenuEquip.renderPartList();
            };
            list.appendChild(div);
        });
    },
    
    renderPartList: () => {
        const c = MenuEquip.targetChar;
        const s = App.calcStats(c);
        document.getElementById('char-status').innerHTML = `
            <b>${c.name}</b> (Lv.${c.level})<br>
            <div style="display:grid; grid-template-columns:1fr 1fr; font-size:11px;">
                <span>HP: ${s.maxHp}</span> <span>MP: ${s.maxMp}</span>
                <span>攻: ${s.atk}</span> <span>魔: ${s.mag}</span>
                <span>防: ${s.def}</span> <span>速: ${s.spd}</span>
            </div>
        `;
        
        const list = document.getElementById('list-part');
        list.innerHTML = '';
        CONST.PARTS.forEach(part => {
            const eq = c.equips[part];
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `<div style="width:40px; color:#aaa;">${part}</div><div style="flex:1">${eq ? eq.name : '----'}</div>`;
            div.onclick = () => {
                MenuEquip.targetPart = part;
                MenuEquip.changeScreen('item');
                MenuEquip.renderItemList();
            };
            list.appendChild(div);
        });
    },
    
    renderItemList: () => {
        const list = document.getElementById('list-item-candidates');
        list.innerHTML = '';
        const footer = document.getElementById('equip-footer');
        footer.innerHTML = "タップで詳細<br>もう一度タップで装備";
        MenuEquip.selectedEquipId = null;

        const part = MenuEquip.targetPart;
        const candidates = [];
        candidates.push({id:'remove', name:'(外す)', isRemove:true});
        App.data.inventory.filter(i => i.type === part).forEach(i => candidates.push(i));
        App.data.characters.forEach(other => {
            if(other.uid !== MenuEquip.targetChar.uid && other.equips[part]) {
                candidates.push({...other.equips[part], owner:other.name});
            }
        });

        candidates.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            
            let txt = item.name;
            let style = "";
            if(item.isSynergy) style = "color:#ff4444; font-weight:bold;";
            
            if(item.owner) txt += ` <span style="color:#f88; font-size:10px;">[${item.owner}]</span>`;
            if(item.isRemove) txt = `<span style="color:#aaa;">${item.name}</span>`;
            
            div.innerHTML = `<div style="${style}">${txt}</div>`;
            
            div.onclick = () => {
                if(MenuEquip.selectedEquipId === item.id) {
                    MenuEquip.doEquip(item.isRemove ? null : item);
                } else {
                    MenuEquip.selectedEquipId = item.id;
                    Array.from(list.children).forEach(c => c.classList.remove('selected'));
                    div.classList.add('selected');
                    
                    if(item.isRemove) {
                        footer.innerText = "装備を外します。もう一度タップで実行。";
                    } else {
                        let desc = `<b>${item.name}</b>\n攻:${item.data.atk||0} 防:${item.data.def||0} 魔:${item.data.mag||0} 速:${item.data.spd||0}`;
                        if(item.opts) item.opts.forEach(o => desc += ` [${o.label}+${o.val}]`);
                        const syn = App.checkSynergy(item);
                        if(syn) desc += `<br><span style="color:#f88">★${syn.name}: ${syn.desc}</span>`;
                        footer.innerHTML = desc;
                    }
                }
            };
            list.appendChild(div);
        });
    },
    
    doEquip: (item) => {
        const c = MenuEquip.targetChar;
        const p = MenuEquip.targetPart;
        
        if(c.equips[p]) App.data.inventory.push(c.equips[p]);
        
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
   3. 道具使用
   ========================================================================== */
const MenuItems = {
    selectedItem: null, selectedId: null, targetId: null,
    init: () => { MenuItems.changeScreen('list'); MenuItems.renderList(); },
    
    changeScreen: (id) => {
        ['list','target'].forEach(s => document.getElementById(`item-screen-${s}`).style.display = (s===id?'flex':'none'));
    },
    
    renderList: () => {
        const list = document.getElementById('list-items');
        const footer = document.getElementById('item-footer');
        list.innerHTML = '';
        footer.innerHTML = "タップで詳細<br>もう一度タップで使用";
        MenuItems.selectedId = null;

        Object.keys(App.data.items).forEach(idStr => {
            const id = parseInt(idStr);
            const count = App.data.items[id];
            const item = DB.ITEMS.find(i => i.id === id);
            if(item) {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.innerHTML = `<div>${item.name}</div><div>x${count}</div>`;
                div.onclick = () => {
                    if(count <= 0) return;
                    if(MenuItems.selectedId === item.id) {
                        MenuItems.selectedItem = item;
                        MenuItems.changeScreen('target');
                        MenuItems.renderTargets();
                    } else {
                        MenuItems.selectedId = item.id;
                        Array.from(list.children).forEach(c => c.classList.remove('selected'));
                        div.classList.add('selected');
                        footer.innerText = `${item.desc}\nもう一度タップで対象選択`;
                    }
                };
                list.appendChild(div);
            }
        });
    },
    
    renderTargets: () => {
        const list = document.getElementById('list-item-targets');
        list.innerHTML = '';
        MenuItems.targetId = null;
        
        App.data.characters.forEach(c => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = App.createCharHTML(c);
            div.onclick = () => {
                if(MenuItems.targetId === c.uid) {
                    MenuItems.useItem(c);
                } else {
                    MenuItems.targetId = c.uid;
                    Array.from(list.children).forEach(ch => ch.classList.remove('selected'));
                    div.classList.add('selected');
                }
            };
            list.appendChild(div);
        });
    },

    useItem: (c) => {
        const item = MenuItems.selectedItem;
        const stats = App.calcStats(c);
        let used = false;
        
        if(item.type === 'HP回復') {
            const old = c.currentHp !== undefined ? c.currentHp : stats.maxHp;
            const recover = Math.min(item.val, stats.maxHp - old);
            if(recover > 0) {
                c.currentHp = old + recover;
                used = true;
                const footer = document.getElementById('item-footer');
                if(footer) footer.innerText = `${c.name}のHPが${recover}回復した！`;
                App.log(`${c.name}のHPが${recover}回復した`);
            } else {
                const footer = document.getElementById('item-footer');
                if(footer) footer.innerText = "効果がなかった...";
            }
        } else if(item.type === 'MP回復') {
            const old = c.currentMp !== undefined ? c.currentMp : stats.maxMp;
            const recover = Math.min(item.val, stats.maxMp - old);
            if(recover > 0) {
                c.currentMp = old + recover;
                used = true;
                const footer = document.getElementById('item-footer');
                if(footer) footer.innerText = `${c.name}のMPが${recover}回復した！`;
                App.log(`${c.name}のMPが${recover}回復した`);
            }
        }

        if(used) {
            App.data.items[item.id]--;
            if(App.data.items[item.id] <= 0) delete App.data.items[item.id];
            App.save();
            Menu.renderPartyBar();
            
            setTimeout(() => {
                if(App.data.items[item.id]) {
                    MenuItems.changeScreen('list');
                    MenuItems.renderList();
                } else {
                    MenuItems.init();
                }
            }, 1000);
        } else {
            setTimeout(() => MenuItems.changeScreen('list'), 500);
        }
    }
};

/* ==========================================================================
   4. 所持装備一覧 (売却)
   ========================================================================== */
const MenuInventory = {
    selectedId: null,
    init: () => { MenuInventory.render(); },
    
    render: () => {
        const list = document.getElementById('inventory-list');
        const footer = document.getElementById('inventory-footer');
        list.innerHTML = '';
        footer.innerHTML = "タップで詳細<br>もう一度タップで売却";
        document.getElementById('inventory-gold').innerText = App.data.gold;
        MenuInventory.selectedId = null;

        if(App.data.inventory.length === 0) {
            list.innerHTML = '<div style="padding:10px; color:#888;">装備を持っていません</div>';
            return;
        }

        App.data.inventory.forEach(eq => {
            const div = document.createElement('div');
            div.className = 'list-item';
            
            let effects = [];
            if(eq.data.atk) effects.push(`攻${eq.data.atk}`);
            if(eq.data.def) effects.push(`防${eq.data.def}`);
            if(eq.opts.length) effects.push(`★${eq.opts.length}`);
            
            div.innerHTML = `
                <div>
                    <div style="font-weight:bold">${eq.name}</div>
                    <div style="font-size:10px; color:#aaa;">${eq.type}|${effects.join(' ')}</div>
                </div>
                <div style="font-size:12px; color:#ffd700;">${Math.floor(eq.val/2)}G</div>
            `;
            
            div.onclick = () => {
                if(MenuInventory.selectedId === eq.id) {
                    const price = Math.floor(eq.val / 2);
                    App.data.gold += price;
                    const idx = App.data.inventory.findIndex(i => i.id === eq.id);
                    App.data.inventory.splice(idx, 1);
                    App.save();
                    
                    footer.innerText = `${eq.name}を売却しました。`;
                    setTimeout(() => MenuInventory.render(), 500);
                } else {
                    MenuInventory.selectedId = eq.id;
                    Array.from(list.children).forEach(c => c.classList.remove('selected'));
                    div.classList.add('selected');
                    
                    let desc = `<b>${eq.name}</b> 売値:${Math.floor(eq.val/2)}G`;
                    if(eq.opts) eq.opts.forEach(o => desc += ` [${o.label}+${o.val}]`);
                    desc += "\n<span style='color:#f88'>もう一度タップで売却</span>";
                    footer.innerHTML = desc;
                }
            };
            list.appendChild(div);
        });
    }
};

/* ==========================================================================
   5. 仲間一覧 & 詳細 (3タブ + 主人公振分)
   ========================================================================== */
const MenuAllies = {
    selectedChar: null, currentTab: 1,
    
    // 初期化：一覧表示モードにする
    init: () => {
        document.getElementById('allies-list-view').style.display = 'flex';
        document.getElementById('allies-detail-view').style.display = 'none';
        MenuAllies.renderList();
    },

    // ★スクロールのポイント：全員分をループで追加するだけで、CSS側が自動でスクロールしてくれます
    renderList: () => {
        const list = document.getElementById('allies-list');
        list.innerHTML = '';
        
        App.data.characters.forEach(c => {
            const div = document.createElement('div');
            div.className = 'list-item'; // CSSでクリック時の見た目などが定義済み
            div.innerHTML = App.createCharHTML(c); // main.jsの共通関数で見た目を作成
            
            // クリックしたら詳細画面へ
            div.onclick = () => {
                MenuAllies.selectedChar = c;
                MenuAllies.currentTab = 1;
                MenuAllies.renderDetail();
            };
            list.appendChild(div);
        });
    },

    // 詳細画面の描画
    renderDetail: () => {
        document.getElementById('allies-list-view').style.display = 'none';
        document.getElementById('allies-detail-view').style.display = 'flex';
        
        const c = MenuAllies.selectedChar;
        const s = App.calcStats(c);
        const hp = c.currentHp !== undefined ? c.currentHp : s.maxHp;
        const mp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
        const lb = c.limitBreak || 0;
        
        // 主人公(p1)のみ、ステータス振分ボタンを表示
        let allocHtml = '';
        if(c.uid === 'p1') {
            const totalPt = Math.floor(lb / 10) * 10;
            let used = 0;
            if(c.alloc) for(let k in c.alloc) used += c.alloc[k];
            const free = totalPt - used;
            
            allocHtml = `<div style="background:#440; padding:5px; margin-top:5px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                <span>振分Pt 残り: <b>${free}</b></span> <button class="btn" onclick="MenuAllies.openAlloc()">振分</button>
            </div>`;
        }

        // タブボタンの生成
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

        // 内容の表示
        const content = document.getElementById('allies-detail-content');
        let html = '';
        
        if(MenuAllies.currentTab === 1) { 
            // 基本ステータス
            html += `
            <div style="padding:10px; display:flex; gap:10px; background:#222;">
                <div style="width:60px; height:60px; background:#444; display:flex; align-items:center; justify-content:center;">${c.img?'<img src="'+c.img+'" style="width:100%;height:100%;object-fit:cover;">':'IMG'}</div>
                <div>
                    <div style="font-size:16px; font-weight:bold;">${c.name} <span style="color:#ff0">+${lb}</span></div>
                    <div style="font-size:12px; color:#aaa;">${c.job} / ${c.rarity}</div>
                    <div>Lv.${c.level}</div>
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
                <b>特殊補正</b><br>
                <div>魔法ダメ増:${s.magDmg}% 特技ダメ増:${s.sklDmg}%</div>
                <div>最終与ダメ増:${s.finDmg}% 最終被ダメ減:${s.finRed}</div>
                <div>MP消費減:${s.mpRed}%</div>
            </div>`;
        } else if(MenuAllies.currentTab === 2) { 
            // 装備リスト
            html += `<div style="padding:10px;">`;
            CONST.PARTS.forEach(p => {
                const eq = c.equips[p];
                html += `<div class="list-item" style="cursor:default;">
                    <div style="width:40px; color:#aaa;">${p}</div>
                    <div>${eq ? eq.name : 'なし'}</div>
                </div>`;
            });
            html += `</div>`;
        } else if(MenuAllies.currentTab === 3) { 
            // スキルリスト
            html += `<div style="padding:10px;">`;
            if(c.skills.length===0) html += 'なし';
            c.skills.forEach(sk => {
                html += `<div class="list-item">
                    <div>${sk.name}</div>
                    <div style="font-size:10px; color:#aaa;">${sk.type} MP:${sk.mp}<br>${sk.desc}</div>
                </div>`;
            });
            html += `</div>`;
        }
        
        content.innerHTML = html;
    },
    
    // 振分機能
    openAlloc: () => {
        const c = MenuAllies.selectedChar;
        const lb = c.limitBreak || 0;
        const totalPt = Math.floor(lb / 10) * 10;
        let used = 0;
        if(!c.alloc) c.alloc = {};
        for(let k in c.alloc) used += c.alloc[k];
        const free = totalPt - used;
        
        if(free <= 0) { alert("振分ポイントがありません (ランク+10ごとに獲得)"); return; }
        
        const type = prompt("強化する項目を入力してください\n(火攻, 水攻... 火耐, 水耐...)\n残り: "+free);
        if(!type) return;
        
        let key = null;
        if(type.includes('攻')) {
            const elm = type.replace('攻','');
            if(CONST.ELEMENTS.includes(elm)) key = `elmAtk_${elm}`;
        } else if(type.includes('耐')) {
            const elm = type.replace('耐','');
            if(CONST.ELEMENTS.includes(elm)) key = `elmRes_${elm}`;
        }
        
        if(key) {
            const valStr = prompt("振るポイント数を入力", "10");
            const val = parseInt(valStr);
            if(val > 0 && val <= free) {
                c.alloc[key] = (c.alloc[key]||0) + val;
                App.save();
                MenuAllies.renderDetail();
            } else {
                alert("数値が不正です");
            }
        } else {
            alert("項目名が正しくありません。\n例: 「火攻」「闇耐」");
        }
    }
};

/* ==========================================================================
   6. スキル使用 (回復魔法)
   ========================================================================== */
const MenuSkills = {
    targetChar: null, selectedSkill: null, targetId: null,
    
    init: () => { MenuSkills.changeScreen('char'); MenuSkills.renderCharList(); },
    
    changeScreen: (id) => {
        ['char','skill','target'].forEach(s => document.getElementById(`skill-screen-${s}`).style.display = (s===id?'flex':'none'));
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
                MenuSkills.targetChar = c;
                MenuSkills.changeScreen('skill');
                MenuSkills.renderSkillList();
            };
            list.appendChild(div);
        });
    },
    
    renderSkillList: () => {
        const list = document.getElementById('skill-list');
        list.innerHTML = '';
        const c = MenuSkills.targetChar;
        const skills = c.skills.filter(s => ['回復','蘇生'].includes(s.type));
        
        if(skills.length === 0) {
            list.innerHTML = '<div style="padding:10px; color:#888">使用可能なスキルがありません</div>';
            return;
        }
        
        skills.forEach(sk => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `<div>${sk.name}</div><div style="color:#88f">MP:${sk.mp}</div>`;
            div.onclick = () => {
                const s = App.calcStats(c);
                const curMp = c.currentMp !== undefined ? c.currentMp : s.maxMp;
                if(curMp < sk.mp) {
                    document.getElementById('skill-footer').innerText = "MPが足りません";
                    return;
                }
                
                MenuSkills.selectedSkill = sk;
                MenuSkills.changeScreen('target');
                MenuSkills.renderTargetList();
            };
            list.appendChild(div);
        });
    },
    
    renderTargetList: () => {
        const list = document.getElementById('skill-target-list');
        list.innerHTML = '';
        MenuSkills.targetId = null;
        
        App.data.characters.forEach(t => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = App.createCharHTML(t);
            div.onclick = () => {
                if(MenuSkills.targetId === t.uid) {
                    MenuSkills.executeSkill(t);
                } else {
                    MenuSkills.targetId = t.uid;
                    Array.from(list.children).forEach(ch => ch.classList.remove('selected'));
                    div.classList.add('selected');
                }
            };
            list.appendChild(div);
        });
    },
    
    executeSkill: (target) => {
        const caster = MenuSkills.targetChar;
        const skill = MenuSkills.selectedSkill;
        const sCaster = App.calcStats(caster);
        const sTarget = App.calcStats(target);
        
        const cMp = caster.currentMp !== undefined ? caster.currentMp : sCaster.maxMp;
        caster.currentMp = cMp - skill.mp;
        
        let val = skill.val || (sCaster.mag + skill.base) * skill.rate;
        val = Math.floor(val);
        const tHp = target.currentHp !== undefined ? target.currentHp : sTarget.maxHp;
        
        if(skill.type === '蘇生') {
            if(target.isDead) {
                target.currentHp = Math.floor(sTarget.maxHp * 0.5);
                App.log(`${target.name}は生き返った！`);
            } else {
                App.log("効果がなかった");
            }
        } else {
            target.currentHp = Math.min(tHp + val, sTarget.maxHp);
            App.log(`${target.name}のHPが${val}回復！`);
        }
        
        App.save();
        Menu.renderPartyBar();
        setTimeout(() => MenuSkills.init(), 800);
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
