/* blacksmith.js (修正版: 表示エラー解消・タイトル制御修正) */

const MenuBlacksmith = {
    mode: null, 
    
    // 選択状態保持
    state: {
        target: null, targetIsEquipped: false,
        material: null, materials: [],
        targetOptIdx: -1, requiredCount: 0
    },

    init: () => {
        document.getElementById('sub-screen-blacksmith').style.display = 'flex';
        MenuBlacksmith.resetState();
        MenuBlacksmith.changeScreen('main');
    },

    resetState: () => {
        MenuBlacksmith.mode = null;
        MenuBlacksmith.state = {
            target: null, targetIsEquipped: false,
            material: null, materials: [],
            targetOptIdx: -1, requiredCount: 0
        };
    },

    changeScreen: (screenId) => {
        ['main', 'select', 'option'].forEach(id => {
            const el = document.getElementById(`smith-screen-${id}`);
            if(el) el.style.display = (id === screenId) ? 'flex' : 'none';
        });

        if (screenId === 'main') {
            MenuBlacksmith.renderMain();
            MenuBlacksmith.updateTitle("鍛冶屋");
        }
    },

    // ヘッダータイトル更新用ヘルパー
    updateTitle: (text) => {
        const titleEl = document.querySelector('#sub-screen-blacksmith .header-bar span');
        if(titleEl) titleEl.innerText = text;
    },

    // --- メイン画面 ---
    renderMain: () => {
        const lv = App.data.blacksmith.level || 1;
        const exp = App.data.blacksmith.exp || 0;
        const next = lv * 100;

        const container = document.getElementById('smith-screen-main');
        if(!container) return;

        container.innerHTML = `
            <div id="smith-info" style="color:#ffd770; text-align:center;">
                <div style="font-size:18px; font-weight:bold;">鍛冶屋 Lv.${lv}</div>
                <div style="font-size:12px; color:#aaa;">熟練度: ${exp} / ${next}</div>
                <hr style="border-color:#444; margin:10px 0;">
                <div style="font-size:12px; text-align:left; padding:0 10px;">
                    <b>■ 能力継承 (+4作成)</b><br>
                    +3装備に、素材の<span style="color:#f88">指定したオプション</span>を移植します。<br>
                    レアリティは鍛冶屋Lvに応じて再抽選されます。<br><br>
                    <b>■ 能力強化</b><br>
                    指定したオプションを強化します。<br>
                    オプションのランクが高いほど、多くの素材が必要です。<br>
                    (EX:10個, N:1個など)
                </div>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:20px; margin-top:20px;">
                <button class="menu-btn" style="width:200px;" onclick="MenuBlacksmith.selectMode('transfer')">能力継承 (+4作成)</button>
                <button class="menu-btn" style="width:200px;" onclick="MenuBlacksmith.selectMode('enhance')">能力強化</button>
            </div>
        `;
        
        // オプション選択画面の動的生成 (なければ作る)
        if(!document.getElementById('smith-screen-option')) {
            const div = document.createElement('div');
            div.id = 'smith-screen-option';
            div.className = 'flex-col-container';
            div.style.display = 'none';
            // ヘッダーは共通のものを使うので、ここには戻るボタンだけ配置
            div.innerHTML = `
                <div id="smith-option-header" style="padding:10px; text-align:center; color:#ffd700; font-size:12px; background:#333;"></div>
                <div id="smith-option-list" class="scroll-area"></div>
                <button class="btn" style="margin:10px;" onclick="MenuBlacksmith.changeScreen('select')">戻る</button>
            `;
            container.parentElement.appendChild(div);
        }
    },

    selectMode: (mode) => {
        MenuBlacksmith.mode = mode;
        MenuBlacksmith.changeScreen('select');
        MenuBlacksmith.renderTargetList();
    },

    // --- 1. ベース選択 (装備中も含む) ---
    renderTargetList: () => {
        const list = document.getElementById('smith-list');
        const footer = document.getElementById('smith-footer');
        
        // タイトル更新 (ここがエラーの原因だったので修正)
        MenuBlacksmith.updateTitle(MenuBlacksmith.mode === 'transfer' ? '継承: ベース選択' : '強化: ベース選択');
        
        list.innerHTML = '';
        let prompt = "";
        if (MenuBlacksmith.mode === 'transfer') prompt = "ベースにする装備(+3)を選択してください";
        else prompt = "強化したい装備を選択してください";
        
        if(footer) footer.innerHTML = `<div style="text-align:center; color:#ffd700;">${prompt}</div>`;

        // 全候補取得 (インベントリ + 装備中)
        const candidates = MenuBlacksmith.getAllCandidates();
        
        // フィルタリング
        const items = candidates.filter(c => {
            if (MenuBlacksmith.mode === 'transfer') return c.item.plus === 3; // +3のみ
            else return c.item.opts && c.item.opts.length > 0; // オプション持ちのみ
        });

        if (items.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">対象となる装備がありません</div>';
            return;
        }

        items.forEach(c => {
            const item = c.item;
            const div = document.createElement('div');
            div.className = 'list-item';
            
            let ownerInfo = c.owner ? ` <span style="font-size:10px; color:#f88;">[${c.owner} 装備中]</span>` : '';

            div.innerHTML = `
                <div style="flex:1;">
                    <div>${item.name}${ownerInfo}</div>
                    ${Menu.getEquipDetailHTML(item)}
                </div>
            `;
            
            div.onclick = () => {
                MenuBlacksmith.state.target = item;
                MenuBlacksmith.state.targetIsEquipped = !!c.owner;

                if (MenuBlacksmith.mode === 'transfer') {
                    MenuBlacksmith.renderMaterialList_Transfer();
                } else {
                    MenuBlacksmith.renderOptionList_Enhance();
                }
            };
            list.appendChild(div);
        });
    },

    // --- 2-A. 素材選択 (継承用: 1つ選ぶ) ---
    renderMaterialList_Transfer: () => {
        const list = document.getElementById('smith-list');
        const footer = document.getElementById('smith-footer');
        
        MenuBlacksmith.updateTitle('継承: 素材選択');
        
        list.innerHTML = '';
        if(footer) footer.innerHTML = `<div style="text-align:center; color:#ffd700;">オプションを引き継ぐ素材を選択してください</div>`;

        const items = App.data.inventory.filter(i => 
            i.id !== MenuBlacksmith.state.target.id && 
            i.opts && i.opts.length > 0
        );

        if (items.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">素材にできる装備がありません</div>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `<div style="flex:1;"><div>${item.name}</div>${Menu.getEquipDetailHTML(item)}</div>`;
            div.onclick = () => {
                MenuBlacksmith.state.material = item;
                MenuBlacksmith.renderOptionList_Transfer();
            };
            list.appendChild(div);
        });
    },

    // --- 2-B. オプション選択 (継承用) ---
    renderOptionList_Transfer: () => {
        MenuBlacksmith.changeScreen('option');
        MenuBlacksmith.updateTitle('継承: オプション選択');
        
        const list = document.getElementById('smith-option-list');
        const header = document.getElementById('smith-option-header');
        list.innerHTML = '';
        header.innerText = `素材: ${MenuBlacksmith.state.material.name} から\n移植するオプションを選択してください`;

        MenuBlacksmith.state.material.opts.forEach((opt, idx) => {
            const div = document.createElement('div');
            div.className = 'list-item';
            const color = Menu.getRarityColor(opt.rarity);
            div.innerHTML = `<div style="color:${color}; font-weight:bold;">${opt.label} +${opt.val}${opt.unit==='%'?'%':''} (${opt.rarity})</div>`;
            div.onclick = () => {
                MenuBlacksmith.state.targetOptIdx = idx; // 素材側のインデックス
                MenuBlacksmith.confirmTransfer();
            };
            list.appendChild(div);
        });
    },

    // --- 3-A. オプション選択 (強化用) ---
    renderOptionList_Enhance: () => {
        MenuBlacksmith.changeScreen('option');
        MenuBlacksmith.updateTitle('強化: オプション選択');
        
        const list = document.getElementById('smith-option-list');
        const header = document.getElementById('smith-option-header');
        list.innerHTML = '';
        header.innerText = `強化するオプションを選択してください`;

        MenuBlacksmith.state.target.opts.forEach((opt, idx) => {
            const div = document.createElement('div');
            div.className = 'list-item';
            const color = Menu.getRarityColor(opt.rarity);
            
            // コスト計算
            const cost = MenuBlacksmith.getEnhanceCost(opt.rarity);

            div.innerHTML = `
                <div style="flex:1;">
                    <div style="color:${color}; font-weight:bold;">${opt.label} +${opt.val}${opt.unit==='%'?'%':''} (${opt.rarity})</div>
                    <div style="font-size:10px; color:#aaa;">必要素材数: ${cost}個</div>
                </div>
            `;
            div.onclick = () => {
                MenuBlacksmith.state.targetOptIdx = idx; // ターゲット側のインデックス
                MenuBlacksmith.state.requiredCount = cost;
                MenuBlacksmith.renderMaterialList_Enhance();
            };
            list.appendChild(div);
        });
    },

    // --- 3-B. 素材選択 (強化用: 複数選ぶ) ---
    renderMaterialList_Enhance: () => {
        MenuBlacksmith.changeScreen('select');
        MenuBlacksmith.updateTitle('強化: 素材選択');
        
        const list = document.getElementById('smith-list');
        const footer = document.getElementById('smith-footer');
        list.innerHTML = '';

        const req = MenuBlacksmith.state.requiredCount;
        MenuBlacksmith.state.materials = []; // リセット

        const updateFooter = () => {
            const current = MenuBlacksmith.state.materials.length;
            const color = current === req ? '#4f4' : '#fff';
            if(footer) {
                footer.innerHTML = `
                    <div style="text-align:center;">
                        必要数: <span style="color:${color}; font-weight:bold;">${current} / ${req}</span>
                    </div>
                    ${current === req ? '<button class="menu-btn" style="width:100%; margin-top:5px; background:#d00;" onclick="MenuBlacksmith.confirmEnhance()">決定</button>' : ''}
                `;
            }
        };
        updateFooter();

        // 素材候補 (インベントリのみ、ターゲット以外)
        const items = App.data.inventory.filter(i => i.id !== MenuBlacksmith.state.target.id);
        
        if (items.length < req) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#f44;">素材が足りません</div>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.cursor = 'pointer';

            const updateVisual = () => {
                const isSelected = MenuBlacksmith.state.materials.includes(item.id);
                div.style.background = isSelected ? '#442222' : 'transparent';
                div.style.borderLeft = isSelected ? '3px solid #f44' : 'none';
            };
            updateVisual();

            div.innerHTML = `<div style="pointer-events:none;">${item.name} <span style="font-size:10px; color:#888;">(Rank:${item.rank})</span></div>`;

            div.onclick = () => {
                const idx = MenuBlacksmith.state.materials.indexOf(item.id);
                if (idx > -1) {
                    MenuBlacksmith.state.materials.splice(idx, 1);
                } else {
                    if (MenuBlacksmith.state.materials.length < req) {
                        MenuBlacksmith.state.materials.push(item.id);
                    }
                }
                updateVisual();
                updateFooter();
            };
            list.appendChild(div);
        });
    },

    // --- 実行確認 ---
    confirmTransfer: () => {
        const target = MenuBlacksmith.state.target;
        const material = MenuBlacksmith.state.material;
        const opt = material.opts[MenuBlacksmith.state.targetOptIdx];
        const lv = App.data.blacksmith.level || 1;
        
        const rateObj = MenuBlacksmith.getRateObj(lv);
        let rateStr = "";
        for (let r in rateObj) if(rateObj[r]>0) rateStr += `${r}:${rateObj[r]}% `;

        Menu.confirm(
            `【能力継承】\n\nベース: ${target.name}\n移植: ${opt.label} (${opt.rarity})\n\nこのオプションを追加し、\n+4装備へ進化させます。\n\n※レアリティは再抽選されます\n確率: ${rateStr}`,
            () => MenuBlacksmith.executeTransfer()
        );
    },

    confirmEnhance: () => {
        const target = MenuBlacksmith.state.target;
        const opt = target.opts[MenuBlacksmith.state.targetOptIdx];
        const lv = App.data.blacksmith.level || 1;
        const successRate = Math.min(95, 50 + (lv * 5));

        Menu.confirm(
            `【能力強化】\n\n対象: ${opt.label} (${opt.rarity})\n消費素材: ${MenuBlacksmith.state.materials.length}個\n\n成功率: ${successRate}%\n成功すると数値が上昇します。\nよろしいですか？`,
            () => MenuBlacksmith.executeEnhance(successRate)
        );
    },

    // --- 実行処理 ---
    executeTransfer: () => {
        const target = MenuBlacksmith.state.target;
        const material = MenuBlacksmith.state.material;
        const optIdx = MenuBlacksmith.state.targetOptIdx;
        const lv = App.data.blacksmith.level || 1;

        // レアリティ抽選
        const rateObj = MenuBlacksmith.getRateObj(lv);
        const r = Math.random() * 100;
        let current = 0;
        let newRarity = 'R';
        for(let key in rateObj) {
            if(r < current + rateObj[key]) { newRarity = key; break; }
            current += rateObj[key];
        }

        const pickOpt = material.opts[optIdx];
        const newOpt = JSON.parse(JSON.stringify(pickOpt));
        
        target.plus = 4;
        target.rarity = newRarity;
        target.name = target.name.replace(/\+\d/, '') + '+4';
        target.opts.push(newOpt);
        
        const matIdx = App.data.inventory.findIndex(i => i.id === material.id);
        if(matIdx > -1) App.data.inventory.splice(matIdx, 1);

        MenuBlacksmith.gainExp(50);
        App.save();
        Menu.msg(`成功！\n${target.name} (Rank:${newRarity}) が完成しました！`, () => MenuBlacksmith.init());
    },

    executeEnhance: (rate) => {
        const target = MenuBlacksmith.state.target;
        const opt = target.opts[MenuBlacksmith.state.targetOptIdx];
        
        MenuBlacksmith.state.materials.forEach(mid => {
            const idx = App.data.inventory.findIndex(i => i.id === mid);
            if(idx > -1) App.data.inventory.splice(idx, 1);
        });

        if (Math.random() * 100 < rate) {
            // 成功: 数値上昇
            const rule = DB.OPT_RULES.find(r => r.key === opt.key && (r.elm === opt.elm || !r.elm));
            let increased = false;
            
            if (rule) {
                const maxVal = rule.max[opt.rarity] || 999;
                const isPct = (opt.unit === '%');
                const increase = isPct ? 1 : 2; 
                
                if (opt.val < maxVal) {
                    opt.val = Math.min(maxVal, opt.val + increase);
                    increased = true;
                }
            } else {
                opt.val += 1;
                increased = true;
            }

            MenuBlacksmith.gainExp(20);
            App.save();

            if (increased) Menu.msg(`強化成功！\n${opt.label} の値が上昇しました！`, () => MenuBlacksmith.init());
            else Menu.msg("強化成功！\n(これ以上数値は上がりません)", () => MenuBlacksmith.init());

        } else {
            MenuBlacksmith.gainExp(5);
            App.save();
            Menu.msg("失敗しました...\n素材は失われました。", () => MenuBlacksmith.init());
        }
    },

    // --- ヘルパー ---
    getAllCandidates: () => {
        let list = [];
        App.data.inventory.forEach(i => list.push({ item: i, owner: null }));
        App.data.characters.forEach(c => {
            CONST.PARTS.forEach(part => {
                const eq = c.equips[part];
                if (eq) list.push({ item: eq, owner: c.name });
            });
        });
        return list;
    },

    getEnhanceCost: (rarity) => {
        if(rarity === 'EX') return 10;
        if(rarity === 'UR') return 7;
        if(rarity === 'SSR') return 5;
        if(rarity === 'SR') return 3;
        if(rarity === 'R') return 2;
        return 1;
    },

    getRateObj: (lv) => {
        if (lv >= 10) return CONST.SMITH_RATES[10];
        return CONST.SMITH_RATES[1];
    },

    gainExp: (val) => {
        if(!App.data.blacksmith) App.data.blacksmith = { level:1, exp:0 };
        App.data.blacksmith.exp += val;
        const next = App.data.blacksmith.level * 100;
        if(App.data.blacksmith.exp >= next) {
            App.data.blacksmith.exp -= next;
            App.data.blacksmith.level++;
        }
    }
};
