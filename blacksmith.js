/* ==========================================================================
   鍛冶屋システム (新装備システム・改・真 完全対応版)
   ========================================================================== */

const MenuBlacksmith = {
    mode: null,   
    step: 'target', 
    filter: { category: 'ALL', option: 'ALL' },
    sortMode: 'NEWEST',
    
    state: {
        target: null, material: null, materials: [], targetOptIdx: -1, requiredCount: 0
    },

    init: () => {
        const sub = document.getElementById('sub-screen-blacksmith');
        if(!sub) return;
        sub.style.display = 'flex';
        
        if(!document.getElementById('smith-ctrls')) {
            const ctrlDiv = document.createElement('div');
            ctrlDiv.id = 'smith-ctrls';
            ctrlDiv.style.cssText = 'flex-shrink:0; background:#1a1a1a; border-bottom:1px solid #444; display:none;';
            const header = sub.querySelector('.header-bar');
            sub.insertBefore(ctrlDiv, header.nextSibling);
        }

        MenuBlacksmith.setupContainers(sub);
        MenuBlacksmith.resetState();
        MenuBlacksmith.changeScreen('main');
    },

    setupContainers: (parent) => {
        const screens = ['main', 'select', 'option'];
        screens.forEach(id => {
            let el = document.getElementById(`smith-screen-${id}`);
            if(!el) {
                el = document.createElement('div');
                el.id = `smith-screen-${id}`;
                el.className = 'flex-col-container';
                el.style.cssText = 'display:none; flex:1; overflow:hidden; height:100%;';
                parent.appendChild(el);
            }
        });

        const selectScreen = document.getElementById('smith-screen-select');
        selectScreen.innerHTML = `
            <div style="padding:8px; background:#222; display:flex; gap:8px; border-bottom:1px solid #333; flex-shrink:0;">
                <button class="btn" style="flex:1; font-size:11px; background:linear-gradient(#555, #333);" onclick="MenuBlacksmith.changeScreen('main')">鍛冶メニュー</button>
                <button class="btn" style="flex:1; font-size:11px; background:linear-gradient(#444, #222);" onclick="Menu.closeSubScreen('blacksmith')">閉じる</button>
            </div>
            <div id="smith-list" class="scroll-area" style="flex:1;"></div>
            <div id="smith-footer" style="padding:10px; background:rgba(0,0,0,0.4); border-top:1px solid #444; flex-shrink:0; min-height:40px;"></div>
        `;

        const optScreen = document.getElementById('smith-screen-option');
        optScreen.innerHTML = `
            <div style="padding:8px; background:#222; display:flex; gap:8px; border-bottom:1px solid #333; flex-shrink:0;">
                <button class="btn" style="flex:1; font-size:11px; background:linear-gradient(#555, #333);" onclick="MenuBlacksmith.changeScreen('main')">鍛冶メニュー</button>
                <button class="btn" style="flex:1; font-size:11px; background:linear-gradient(#444, #222);" onclick="MenuBlacksmith.goBackStep()">戻る</button>
            </div>
            <div id="smith-option-header" style="padding:10px; text-align:center; color:#ffd700; font-size:12px; background:rgba(255,215,0,0.1); border-bottom:1px solid #444; flex-shrink:0;"></div>
            <div id="smith-option-list" class="scroll-area" style="flex:1;"></div>
        `;
    },

    resetState: () => {
        MenuBlacksmith.mode = null;
        MenuBlacksmith.step = 'target';
        MenuBlacksmith.state = { target: null, material: null, materials: [], targetOptIdx: -1, requiredCount: 0 };
        MenuBlacksmith.filter = { category: 'ALL', option: 'ALL' };
        MenuBlacksmith.sortMode = 'NEWEST';
    },

    changeScreen: (screenId) => {
        ['main', 'select', 'option'].forEach(id => {
            const el = document.getElementById(`smith-screen-${id}`);
            if(el) el.style.display = (id === screenId) ? 'flex' : 'none';
        });
        const ctrl = document.getElementById('smith-ctrls');
        if(ctrl) ctrl.style.display = (screenId === 'select') ? 'block' : 'none';
        if (screenId === 'main') {
            MenuBlacksmith.renderMain();
            MenuBlacksmith.updateTitle("鍛冶屋");
        }
    },

    goBackStep: () => {
        if (MenuBlacksmith.step === 'material') {
            MenuBlacksmith.step = 'target';
            MenuBlacksmith.changeScreen('select');
            MenuBlacksmith.renderTargetList();
        } else {
            MenuBlacksmith.changeScreen('main');
        }
    },

    updateTitle: (text) => {
        const titleEl = document.querySelector('#sub-screen-blacksmith .header-bar span');
        if(titleEl) titleEl.innerText = text;
    },

    renderMain: () => {
        const smith = App.data.blacksmith || { level:1, exp:0 };
        const nextExp = smith.level * 100;
        const progress = Math.min(100, (smith.exp / nextExp) * 100);
        const container = document.getElementById('smith-screen-main');

        container.innerHTML = `
            <div style="flex:1; overflow-y:auto; display:flex; flex-direction:column; justify-content:center; padding:20px 5px;">
                <div style="margin-bottom:20px; text-align:center;">
                    <div style="font-size:10px; color:#888; letter-spacing:2px; margin-bottom:2px;">MASTER BLACKSMITH</div>
                    <div style="display:flex; align-items:center; justify-content:center; gap:12px;">
                        <span style="font-size:26px; font-weight:bold; color:#ffd700; text-shadow:0 0 10px rgba(255,215,0,0.4);">Lv.${smith.level}</span>
                        <button class="btn" style="font-size:10px; padding:4px 12px; background:#333; border:1px solid #555; border-radius:15px; height:24px;" onclick="MenuBlacksmith.showLevelInfo()">上昇効果を確認</button>
                    </div>
                </div>
                <div style="margin: 0 auto 30px auto; width: 100%; max-width:280px; text-align:center;">
                    <div style="font-size:10px; color:#aaa; margin-bottom:5px; display:flex; justify-content:space-between; padding:0 2px;">
                        <span>熟練度 (NEXT: ${nextExp})</span><span>${smith.exp} EXP</span>
                    </div>
                    <div style="width:100%; height:6px; background:#000; border-radius:3px; overflow:hidden; border:1px solid #333;">
                        <div style="width:${progress}%; height:100%; background:linear-gradient(90deg, #ffd700, #ffaa00); box-shadow:0 0 5px #ffd700;"></div>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px; width: 100%; max-width:320px; margin:0 auto;">
                    ${MenuBlacksmith.renderMenuBtn('synthesis', '装備合成', '＋３装備を＋４へ進化させ、新たな能力を継承します', 'linear-gradient(135deg, #411, #200)', '#f44')}
                    ${MenuBlacksmith.renderMenuBtn('refine', '装備精錬', 'オプションのレアリティを上昇させます (GEM消費)', 'linear-gradient(135deg, #114, #002)', '#44f')}
                    ${MenuBlacksmith.renderMenuBtn('enhance', '装備強化', 'オプションの数値を素材を使って上昇させます', 'linear-gradient(135deg, #131, #020)', '#4f4')}
                </div>
            </div>
            <div style="flex-shrink:0; padding:15px 20px; background:rgba(0,0,0,0.4); border-top:1px solid #333;">
                <button class="btn" style="width:100%; height:45px; background:linear-gradient(#444, #222); border:1px solid #555; border-radius:4px; color:#fff; font-weight:bold; letter-spacing:2px;" onclick="Menu.closeSubScreen('blacksmith')">メニューを閉じる</button>
            </div>
        `;
    },

    renderMenuBtn: (mode, title, desc, bg, border) => `
        <button class="menu-btn" style="display:flex; flex-direction:column; align-items:flex-start; text-align:left; padding:10px 15px; height:auto; background:${bg}; border-left:4px solid ${border}; border-right:none; border-top:none; border-bottom:none;" onclick="MenuBlacksmith.selectMode('${mode}')">
            <div style="font-size:14px; font-weight:bold; color:#fff; margin-bottom:2px;">${title}</div>
            <div style="font-size:9px; color:rgba(255,255,255,0.5); line-height:1.2;">${desc}</div>
        </button>
    `,

    showLevelInfo: () => {
        const smith = App.data.blacksmith || { level:1, exp:0 };
        const lv = smith.level;
        const getP = (l) => {
            const r = l >= 10 ? 'EX' : (l >= 5 ? 'UR' : 'SSR');
            const s = Math.min(95, 50 + (l * 5));
            return { rarity: r, success: s, refine: Math.floor(s/2) };
        };
        const cur = getP(lv); const nxt = getP(lv + 1);
        const row = (label, curVal, nxtVal, color) => `<div style="background:rgba(0,0,0,0.3); border:1px solid #444; border-radius:4px; padding:5px 10px; display:flex; align-items:center; height:36px; margin-bottom:4px;"><div style="width:45px; font-size:10px; color:${color}; font-weight:bold; line-height:1;">${label}</div><div style="flex:1; display:flex; align-items:center; justify-content:center; gap:10px;"><span style="color:#fff; font-size:18px; font-weight:bold; width:40px; text-align:right;">${curVal}</span><span style="color:#ffd700; font-size:10px; opacity:0.8;">▶</span><span style="color:#fff; font-size:18px; font-weight:bold; width:40px; text-align:left;">${nxtVal}</span></div></div>`;

        let h = `<div style="text-align:left; color:#ddd; line-height:1.0; max-width:300px; margin:5px auto -5px auto; display:flex; flex-direction:column;">`;
        h += `<div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #ffd700; padding-bottom:3px; margin-bottom:8px;"><span style="color:#ffd700; font-weight:bold; font-size:14px;">鍛冶レベル特典</span><span style="color:#aaa; font-size:10px;">Lv.${lv} <span style="color:#ffd700; font-size:8px;">▶</span> Lv.${lv+1}</span></div>`;
        h += `<div style="display:flex; flex-direction:column;">${row('合成上限', cur.rarity, nxt.rarity, '#f88')}${row('精錬確率', cur.refine+'%', nxt.refine+'%', '#88f')}${row('強化確率', cur.success+'%', nxt.success+'%', '#8f8')}</div>`;
        h += `<div style="margin-top:8px; padding:6px; background:rgba(255,255,255,0.03); border:1px solid #333; border-radius:4px;"><div style="color:#ffd700; font-size:10px; font-weight:bold; margin-bottom:2px;">鍛冶ガイド</div><div style="color:#bbb; font-size:9px; line-height:1.2;">・合成：＋４進化時のレアリティ再抽選上限<br>・精錬：GEM消費でOP昇格(失敗時も消失なし)<br>・強化：素材消費でOP値上昇(Lvで成功率UP)</div></div>`;
        h += `</div>`;
        Menu.msg(h);
    },

    selectMode: (mode) => {
        MenuBlacksmith.mode = mode;
        MenuBlacksmith.step = 'target';
        MenuBlacksmith.changeScreen('select');
        MenuBlacksmith.renderFilterArea();
        MenuBlacksmith.renderTargetList();
    },

    renderFilterArea: () => {
        const ctrl = document.getElementById('smith-ctrls');
        const rules = DB.OPT_RULES;
        ctrl.innerHTML = `
            <div style="padding:6px; display:flex; gap:5px; overflow-x:auto; background:#111; border-bottom:1px solid #333;">
                ${['ALL', '武器', '盾', '頭', '体', '足'].map(c => {
                    const isActive = MenuBlacksmith.filter.category === c;
                    return `<button class="btn" style="padding:4px 10px; font-size:10px; flex-shrink:0; border-radius:12px; background:${isActive ? 'linear-gradient(#088, #044)' : '#333'}; border:${isActive ? '1px solid #0ff' : '1px solid #444'}; color:${isActive ? '#fff' : '#aaa'};" onclick="MenuBlacksmith.updateFilter('category', '${c}')">${c === 'ALL' ? '全て' : c}</button>`
                }).join('')}
            </div>
            <div style="padding:6px; background:#1a1a1a; display:flex; align-items:center; gap:8px;">
                <div style="flex:1; display:flex; align-items:center; gap:4px;"><span style="font-size:9px; color:#888;">効果:</span><select style="background:#222; color:#fff; font-size:10px; border:1px solid #444; flex:1; height:24px; border-radius:4px;" onchange="MenuBlacksmith.updateFilter('option', this.value)"><option value="ALL">全ての効果</option>${rules.map(opt => `<option value="${opt.key}${opt.elm ? '_' + opt.elm : ''}" ${MenuBlacksmith.filter.option === (opt.key + (opt.elm ? '_' + opt.elm : '')) ? 'selected' : ''}>${opt.name}</option>`).join('')}</select></div>
                <div style="flex:1; display:flex; align-items:center; gap:4px;"><span style="font-size:9px; color:#888;">並替:</span><select style="background:#222; color:#fff; font-size:10px; border:1px solid #444; flex:1; height:24px; border-radius:4px;" onchange="MenuBlacksmith.updateFilter('sortMode', this.value)"><option value="NEWEST" ${MenuBlacksmith.sortMode === 'NEWEST' ? 'selected' : ''}>取得順</option><option value="RANK" ${MenuBlacksmith.sortMode === 'RANK' ? 'selected' : ''}>Rank順</option></select></div>
            </div>
        `;
    },

    updateFilter: (key, val) => {
        if (key === 'sortMode') MenuBlacksmith.sortMode = val;
        else MenuBlacksmith.filter[key] = val;
        MenuBlacksmith.renderFilterArea();
        if (MenuBlacksmith.step === 'target') MenuBlacksmith.renderTargetList();
        else {
            if (MenuBlacksmith.mode === 'synthesis') MenuBlacksmith.renderMaterialList_Synthesis(false);
            if (MenuBlacksmith.mode === 'enhance') MenuBlacksmith.renderMaterialList_Enhance(false);
        }
    },

    applySortAndFilter: (list) => {
        const rOrder = { EX:6, UR:5, SSR:4, SR:3, R:2, N:1 };
        let filtered = list.filter(c => {
            const item = c.item || c; 
            if (MenuBlacksmith.filter.category !== 'ALL' && item.type !== MenuBlacksmith.filter.category) return false;
            if (MenuBlacksmith.filter.option !== 'ALL') {
                if (!item.opts) return false;
                const optKey = MenuBlacksmith.filter.option;
                if (!item.opts.some(o => (o.key + (o.elm ? '_' + o.elm : '')) === optKey)) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            const itemA = a.item || a;
            const itemB = b.item || b;
            if (MenuBlacksmith.sortMode === 'RANK') {
                if (itemB.rank !== itemA.rank) return itemB.rank - itemA.rank;
                return (rOrder[itemB.rarity]||0) - (rOrder[itemA.rarity]||0);
            }
            return (b._originalIdx ?? 0) - (a._originalIdx ?? 0);
        });
        return filtered;
    },

    renderTargetList: () => {
        const list = document.getElementById('smith-list');
        const footer = document.getElementById('smith-footer');
        MenuBlacksmith.step = 'target';
        let candidates = [];
        App.data.inventory.forEach((i, idx) => candidates.push({ item: i, owner: null, _originalIdx: idx }));
        App.data.characters.forEach(c => {
            CONST.PARTS.forEach(part => {
                const eq = c.equips ? c.equips[part] : null;
                if (eq) candidates.push({ item: eq, owner: c.name, _originalIdx: -1 });
            });
        });
        candidates = candidates.filter(c => {
            if (MenuBlacksmith.mode === 'synthesis' && c.item.plus !== 3) return false;
            if ((MenuBlacksmith.mode === 'refine' || MenuBlacksmith.mode === 'enhance') && (!c.item.opts || c.item.opts.length === 0)) return false;
            return true;
        });
        const sorted = MenuBlacksmith.applySortAndFilter(candidates);
        list.innerHTML = '';
        sorted.forEach(c => {
            const div = document.createElement('div'); div.className = 'list-item'; div.style.cssText = 'flex-direction:column; align-items:flex-start; background:rgba(255,255,255,0.02); margin-bottom:4px; border:1px solid #333;';
            div.innerHTML = `<div style="font-weight:bold; color:${Menu.getRarityColor(c.item.rarity)}; border-bottom:1px solid #333; width:100%; padding-bottom:4px; margin-bottom:4px; display:flex; justify-content:space-between;"><span>${c.item.name} ${c.item.locked?'🔒':''}</span>${c.owner ? `<span style="color:#f88; font-size:10px;">[${c.owner}]</span>` : ''}</div>${Menu.getEquipDetailHTML(c.item, false)}`;
            div.onclick = () => { MenuBlacksmith.state.target = c.item; if (MenuBlacksmith.mode === 'synthesis') MenuBlacksmith.renderMaterialList_Synthesis(true); else if (MenuBlacksmith.mode === 'refine') MenuBlacksmith.renderOptionList_Refine(); else MenuBlacksmith.renderOptionList_Enhance(); };
            list.appendChild(div);
        });
        footer.innerHTML = `<div style="text-align:center; color:#ffd700; font-size:11px; font-weight:bold;">${MenuBlacksmith.mode === 'synthesis' ? 'ベースにする＋３装備を選んでください' : '対象の装備を選んでください'}</div>`;
    },

    renderMaterialList_Synthesis: (resetFilter = true) => {
        const list = document.getElementById('smith-list');
        const footer = document.getElementById('smith-footer');
        MenuBlacksmith.step = 'material';
        if(resetFilter) { MenuBlacksmith.filter = { category: 'ALL', option: 'ALL' }; MenuBlacksmith.renderFilterArea(); }
        let materials = App.data.inventory.map((i, idx) => ({ ...i, _originalIdx: idx })).filter(i => !i.locked && i.id !== MenuBlacksmith.state.target.id && i.opts && i.opts.length > 0);
        const sorted = MenuBlacksmith.applySortAndFilter(materials);
        list.innerHTML = '';
        if (sorted.length === 0) list.innerHTML = '<div style="padding:40px; text-align:center; color:#888;">素材にできる装備がありません</div>';
        else {
            sorted.forEach(item => {
                const div = document.createElement('div'); div.className = 'list-item'; div.style.cssText = 'flex-direction:column; align-items:flex-start;';
                div.innerHTML = `<div style="font-weight:bold; color:${Menu.getRarityColor(item.rarity)}; border-bottom:1px solid #333; width:100%; margin-bottom:4px;">${item.name}</div>${Menu.getEquipDetailHTML(item, false)}`;
                div.onclick = () => { MenuBlacksmith.state.material = item; MenuBlacksmith.renderOptionList_Synthesis(); };
                list.appendChild(div);
            });
        }
        footer.innerHTML = '<div style="color:#f88; font-size:11px; text-align:center; font-weight:bold;">継承させたい能力を持つ「素材装備」を選択</div>';
    },

    renderOptionList_Synthesis: () => {
        MenuBlacksmith.changeScreen('option');
        const list = document.getElementById('smith-option-list');
        const header = document.getElementById('smith-option-header');
        header.innerText = "継承させるオプションを選択";
        list.innerHTML = '';

        const rarities = ['N', 'R', 'SR', 'SSR', 'UR', 'EX'];
        const smithLevel = App.data.blacksmith?.level || 1;

        // ★修正：現在のレベルで「最高」どこまで届くか
        let maxPossibleRarityIdx = 3; // Lv1-4: SSR(3)まで
        if (smithLevel >= 10) maxPossibleRarityIdx = 5; // Lv10-: EX(5)まで
        else if (smithLevel >= 5) maxPossibleRarityIdx = 4; // Lv5-9: UR(4)まで

        MenuBlacksmith.state.material.opts.forEach((opt, idx) => {
            const rule = DB.OPT_RULES.find(r => r.key === opt.key && (r.elm === opt.elm || !r.elm));
            let isLevelInsufficient = false;
            let minRequiredRarity = 'N';

            if (rule && rule.allowed) {
                // オプションが要求する最低ランクのインデックス
                const minAllowedIdx = Math.min(...rule.allowed.map(r => rarities.indexOf(r)));
                minRequiredRarity = rarities[minAllowedIdx];
                
                // ★修正：最高到達ランクが、要求最低ランクに届いていない場合のみロック
                if (maxPossibleRarityIdx < minAllowedIdx) isLevelInsufficient = true;
            }

            const div = document.createElement('div'); div.className = 'list-item';
            div.style.cssText = 'flex-direction:column; align-items:flex-start;';
            if (isLevelInsufficient) { div.style.opacity = '0.5'; div.style.background = '#222'; }

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <span style="color:${Menu.getRarityColor(opt.rarity)}; font-weight:bold;">${opt.label} +${opt.val} (${opt.rarity})</span>
                </div>
                ${isLevelInsufficient ? `<div style="color:#f44; font-size:10px; font-weight:bold; margin-top:2px;">⚠️ 熟練度不足 (最低:${minRequiredRarity}が必要)</div>` : ''}
            `;

            div.onclick = () => {
                if (isLevelInsufficient) {
                    Menu.msg(`鍛冶屋の熟練度が足りません。最低でも ${minRequiredRarity} ランクが確定するレベルが必要です。`);
                    return;
                }
                MenuBlacksmith.state.targetOptIdx = idx; 
                MenuBlacksmith.confirmSynthesis(); 
            };
            list.appendChild(div);
        });
    },

/* blacksmith.js */

    confirmSynthesis: () => {
        const target = MenuBlacksmith.state.target;
        const materialOpt = MenuBlacksmith.state.material.opts[MenuBlacksmith.state.targetOptIdx];
        const lv = App.data.blacksmith.level;
        const rateObj = MenuBlacksmith.getRateObj(lv);
        const rarities = ['N', 'R', 'SR', 'SSR', 'UR', 'EX'];

        Menu.confirm(`【装備合成】＋４へ進化させ、新たな能力を継承します。`, () => {
            // 1. 合成品質の抽選 (newR)
            let r = Math.random()*100, current = 0, newR = 'R';
            for(let k in rateObj){ if(r < current+rateObj[k]){ newR=k; break; } current+=rateObj[k]; }
            
            // 2. 継承オプションの作成
            const rule = DB.OPT_RULES.find(r => r.key === materialOpt.key && (r.elm === materialOpt.elm || !r.elm));
            const newInheritOpt = JSON.parse(JSON.stringify(materialOpt));

            // ★修正：継承オプションのランクのみを個別にクランプ
            if (rule && rule.allowed) {
                const allowedIndices = rule.allowed.map(r => rarities.indexOf(r));
                const minIdx = Math.min(...allowedIndices);
                const maxIdx = Math.max(...allowedIndices);
                let resultIdx = rarities.indexOf(newR);

                // ルール1: 合成での継承上限は UR とする
                if (resultIdx > 4) resultIdx = 4; // 4 = UR
                // ルール2: オプション固有の最大ランクを超えない
                if (resultIdx > maxIdx) resultIdx = maxIdx;
                // ルール3: オプション固有の最低ランクを下回らない
                if (resultIdx < minIdx) resultIdx = minIdx;

                newInheritOpt.rarity = rarities[resultIdx];
                
                // ランクに応じた数値の再抽選
                const min = rule.min[newInheritOpt.rarity] || 0;
                const max = rule.max[newInheritOpt.rarity] || 0;
                newInheritOpt.val = Math.floor(Math.random() * (max - min + 1)) + min;
            }

            // 3. ベース装備の更新 (レアリティは維持、または上位へのみ変化)
            target.plus = 4;
            // 装備自体のレアリティは、抽選結果が元より高い場合のみ上書き（格下げを防ぐ）
            const oldRIdx = rarities.indexOf(target.rarity);
            const newRIdx = rarities.indexOf(newR);
            if (newRIdx > oldRIdx) target.rarity = newR;

            target.name = target.name.replace(/\+\d+$/, "") + "+4";
            target.opts.push(newInheritOpt);
            target.val = Math.floor(target.val * 1.5);

            // 4. 後処理
            const matIdx = App.data.inventory.findIndex(i => i.id === MenuBlacksmith.state.material.id);
            if (matIdx > -1) App.data.inventory.splice(matIdx, 1);
            
            App.refreshAllSynergies(); 
            MenuBlacksmith.gainExp(50); 
            App.save();
            
            Menu.msg(`合成成功！\n${target.name} が完成しました。\n継承: ${newInheritOpt.label} (${newInheritOpt.rarity})`, () => MenuBlacksmith.init());
        });
    },
	
    renderOptionList_Refine: () => {
        MenuBlacksmith.changeScreen('option');
        const list = document.getElementById('smith-option-list');
        const header = document.getElementById('smith-option-header');
        header.innerHTML = `レアリティを昇格させるオプションを選択`;
        list.innerHTML = '';
        MenuBlacksmith.state.target.opts.forEach((opt, idx) => {
            if (opt.rarity === 'EX') return;
            const rule = DB.OPT_RULES.find(r => r.key === opt.key && (r.elm === opt.elm || !r.elm));
            const isMax = rule ? (opt.val >= rule.max[opt.rarity]) : true;
            const nextR = MenuBlacksmith.getNextRarity(opt.rarity);
            const gemCost = MenuBlacksmith.getRefineGemCost(opt.rarity);
            const successRate = Math.max(5, Math.min(95, MenuBlacksmith.getRefineBaseRate(opt.rarity) + (App.data.blacksmith.level * 2)));
            const div = document.createElement('div'); div.className = 'list-item'; div.style.opacity = isMax ? '1' : '0.5';
            div.innerHTML = `<div style="flex:1;"><div style="font-weight:bold; color:${Menu.getRarityColor(opt.rarity)};">${opt.label} (${opt.rarity}: ${opt.val}${opt.unit==='%'?'%':''})</div><div style="font-size:10px; color:#aaa;">${isMax ? `昇格先: <span style="color:#fff;">${nextR}</span> (成功率:${successRate}%)` : `<span style="color:#f88;">数値を最大まで上げると精錬可能</span>`}</div></div><div style="font-size:11px; color:#0ff;">${gemCost} GEM</div>`;
            div.onclick = () => { if(!isMax) return Menu.msg("オプション値が上限に達していません。"); MenuBlacksmith.state.targetOptIdx = idx; MenuBlacksmith.confirmRefine(gemCost, successRate, nextR, rule); };
            list.appendChild(div);
        });
    },

    confirmRefine: (gem, rate, nextR, rule) => {
        if ((App.data.gems || 0) < gem) return Menu.msg("GEMが足りません");
        Menu.confirm(`【精錬】費用: ${gem} GEM / 成功率: ${rate}%\n成功するとランクアップし数値が${nextR}の下限値へリセットされます。`, () => {
            App.data.gems -= gem;
            if (Math.random()*100 < rate) {
                const opt = MenuBlacksmith.state.target.opts[MenuBlacksmith.state.targetOptIdx];
                opt.rarity = nextR; opt.val = rule ? rule.min[nextR] : opt.val;
                MenuBlacksmith.gainExp(60); App.save(); Menu.msg("精錬成功！", () => MenuBlacksmith.renderOptionList_Refine());
            } else { MenuBlacksmith.gainExp(15); App.save(); Menu.msg("精錬失敗...", () => MenuBlacksmith.renderOptionList_Refine()); }
        });
    },

    renderOptionList_Enhance: () => {
        MenuBlacksmith.changeScreen('option');
        const list = document.getElementById('smith-option-list');
        const header = document.getElementById('smith-option-header');
        header.innerText = "強化したい能力を選択";
        list.innerHTML = '';
        MenuBlacksmith.state.target.opts.forEach((opt, idx) => {
            const rule = DB.OPT_RULES.find(r => r.key === opt.key && (r.elm === opt.elm || !r.elm));
            const maxVal = rule ? rule.max[opt.rarity] : 999;
            const isFull = opt.val >= maxVal;
            const cost = MenuBlacksmith.getEnhanceCost(opt.rarity);
            const div = document.createElement('div'); div.className = 'list-item'; div.style.opacity = isFull ? '0.5' : '1';
            div.innerHTML = `<div style="flex:1;"><div style="font-weight:bold; color:${Menu.getRarityColor(opt.rarity)};">${opt.label} +${opt.val}${opt.unit==='%'?'%':''}</div><div style="font-size:10px; color:#aaa;">${isFull ? '最大値です' : `素材: 同部位の未ロック装備 ${cost}個`}</div></div>`;
            div.onclick = () => { if(isFull) return Menu.msg("最大値です。精錬してください。"); MenuBlacksmith.state.targetOptIdx = idx; MenuBlacksmith.state.requiredCount = cost; MenuBlacksmith.renderMaterialList_Enhance(true); };
            list.appendChild(div);
        });
    },

    renderMaterialList_Enhance: (resetFilter = true) => {
        const list = document.getElementById('smith-list');
        const footer = document.getElementById('smith-footer');
        MenuBlacksmith.changeScreen('select');
        MenuBlacksmith.step = 'material';
        
        // ★追加：素材選択リストをリセット
        MenuBlacksmith.state.materials = []; 

        if(resetFilter) { 
            MenuBlacksmith.filter = { category: 'ALL', option: 'ALL' }; 
            MenuBlacksmith.renderFilterArea(); 
        }
        const req = MenuBlacksmith.state.requiredCount;
        let materials = App.data.inventory.map((i, idx) => ({ ...i, _originalIdx: idx })).filter(i => !i.locked && i.type === MenuBlacksmith.state.target.type && i.id !== MenuBlacksmith.state.target.id);
        const sorted = MenuBlacksmith.applySortAndFilter(materials);
        const updateFooter = () => {
            const cur = MenuBlacksmith.state.materials.length;
            footer.innerHTML = `<div style="text-align:center; font-size:12px; font-weight:bold; margin-bottom:5px;">選択素材: <span style="color:${cur===req?'#0ff':'#fff'}">${cur} / ${req}</span></div>${cur === req ? `<button class="btn" style="width:100%; background:linear-gradient(#088, #044); border:1px solid #0ff;" onclick="MenuBlacksmith.confirmEnhance()">強化実行</button>` : ''}`;
        };
        updateFooter();
        list.innerHTML = '';
        if (sorted.length < req) list.innerHTML = `<div style="padding:40px; text-align:center; color:#f44;">素材が不足しています</div>`; 
        else {
            sorted.forEach(item => {
                const div = document.createElement('div'); div.className = 'list-item'; div.style.cssText = 'flex-direction:column; align-items:flex-start;';
                const refresh = () => { div.style.background = MenuBlacksmith.state.materials.includes(item.id) ? 'rgba(0,255,255,0.1)' : 'transparent'; div.style.border = MenuBlacksmith.state.materials.includes(item.id) ? '1px solid #0ff' : '1px solid #333'; };
                refresh();
                div.innerHTML = `<div style="font-weight:bold; color:${Menu.getRarityColor(item.rarity)};">${item.name}</div>${Menu.getEquipDetailHTML(item, false)}`;
                div.onclick = () => { const idx = MenuBlacksmith.state.materials.indexOf(item.id); if(idx > -1) MenuBlacksmith.state.materials.splice(idx,1); else if(MenuBlacksmith.state.materials.length < req) MenuBlacksmith.state.materials.push(item.id); refresh(); updateFooter(); };
                list.appendChild(div);
            });
        }
    },

    confirmEnhance: () => {
        const opt = MenuBlacksmith.state.target.opts[MenuBlacksmith.state.targetOptIdx];
        const rule = DB.OPT_RULES.find(r => r.key === opt.key && (r.elm === opt.elm || !r.elm));
        const successRate = Math.min(95, 50 + (App.data.blacksmith.level * 5));
        let inc = rule ? Math.max(1, Math.floor((rule.max[opt.rarity] - rule.min[opt.rarity]) * 0.1)) : 1;

        Menu.confirm(`【能力強化】成功率: ${successRate}% / 成功すると数値が ${inc} 上昇します。`, () => {
            // ★修正：素材消費の安全化と事後処理
            MenuBlacksmith.state.materials.forEach(mid => {
                const invIdx = App.data.inventory.findIndex(i => i.id === mid);
                if (invIdx > -1) {
                    App.data.inventory.splice(invIdx, 1);
                }
            });
            // ★重要：使用した素材リストを完全に空にする
            MenuBlacksmith.state.materials = []; 

            if (Math.random() * 100 < successRate) {
                opt.val += inc; 
                if (rule && opt.val > rule.max[opt.rarity]) opt.val = rule.max[opt.rarity];
                MenuBlacksmith.gainExp(25); 
                App.save(); 
                Menu.msg("強化成功！", () => MenuBlacksmith.renderOptionList_Enhance());
            } else { 
                MenuBlacksmith.gainExp(5); 
                App.save(); 
                Menu.msg("強化失敗...", () => MenuBlacksmith.renderOptionList_Enhance()); 
            }
        });
    },

    getNextRarity: (r) => { const o = ['N','R','SR','SSR','UR','EX']; return o[Math.min(o.indexOf(r)+1, 5)]; },
    getRefineGemCost: (r) => ({ N:100, R:200, SR:400, SSR:800, UR:1500 }[r] || 3000),
    getRefineBaseRate: (r) => ({ N:80, R:60, SR:40, SSR:20, UR:10 }[r] || 5),
    getEnhanceCost: (r) => ({ N:1, R:1, SR:2, SSR:2, UR:3, EX:4 }[r] || 1),
    getRateObj: (v) => v>=10 ? {SSR:30,UR:50,EX:20} : (v>=5 ? {SR:20,SSR:50,UR:30} : {R:30,SR:50,SSR:20}),
    gainExp: (v) => { if(!App.data.blacksmith) App.data.blacksmith = { level:1, exp:0 }; const s = App.data.blacksmith; s.exp += v; while(s.exp >= s.level*100){ s.exp -= s.level*100; s.level++; Menu.msg(`鍛冶レベルが ${s.level} に上がりました！`); } }
};