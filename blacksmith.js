/* blacksmith.js (修正版: ボタン描画対応・分割管理用) */

const MenuBlacksmith = {
    mode: null, // 'transfer' | 'enhance'
    targetItem: null,
    materialItem: null,
    selectedMaterialId: null,

    init: () => {
        document.getElementById('sub-screen-blacksmith').style.display = 'flex';
        MenuBlacksmith.resetSelection();
        MenuBlacksmith.changeScreen('main');
    },

    resetSelection: () => {
        MenuBlacksmith.mode = null;
        MenuBlacksmith.targetItem = null;
        MenuBlacksmith.materialItem = null;
        MenuBlacksmith.selectedMaterialId = null;
    },

    changeScreen: (screenId) => {
        // 表示切り替え
        ['main', 'select'].forEach(id => {
            const el = document.getElementById(`smith-screen-${id}`);
            if(el) el.style.display = (id === screenId) ? 'flex' : 'none';
        });

        if (screenId === 'main') MenuBlacksmith.renderMain();
    },

    // --- メイン画面 ---
    renderMain: () => {
        const lv = App.data.blacksmith.level || 1;
        const exp = App.data.blacksmith.exp || 0;
        const next = lv * 100;

        // ★修正: 親コンテナの中身を丸ごと書き換えて、ボタンもJS側で制御する
        const container = document.getElementById('smith-screen-main');
        if(!container) return;

        container.innerHTML = `
            <div id="smith-info" style="color:#ffd770; text-align:center;">
                <div style="font-size:18px; font-weight:bold;">鍛冶屋 Lv.${lv}</div>
                <div style="font-size:12px; color:#aaa;">熟練度: ${exp} / ${next}</div>
                <hr style="border-color:#444; margin:10px 0;">
                <div style="font-size:12px; text-align:left; padding:0 10px;">
                    <b>■ 能力継承 (+4作成)</b><br>
                    +3装備にオプションを追加し、+4へ進化させます。<br>
                    レアリティは鍛冶屋Lvに応じて再抽選されます。<br><br>
                    <b>■ 能力強化</b><br>
                    不要な装備を消費して、オプション数値を強化します。<br>
                    成功率は鍛冶屋Lvに依存します。
                </div>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:20px; margin-top:20px;">
                <button class="menu-btn" style="width:200px;" onclick="MenuBlacksmith.selectMode('transfer')">能力継承 (+4作成)</button>
                <button class="menu-btn" style="width:200px;" onclick="MenuBlacksmith.selectMode('enhance')">能力強化</button>
            </div>
        `;
    },

    selectMode: (mode) => {
        MenuBlacksmith.mode = mode;
        MenuBlacksmith.targetItem = null;
        MenuBlacksmith.changeScreen('select');
        MenuBlacksmith.renderList('target');
    },

    // --- リスト表示 (Target / Material) ---
    renderList: (step) => {
        const list = document.getElementById('smith-list');
        const footer = document.getElementById('smith-footer');
        list.innerHTML = '';
        
        let items = [];
        let prompt = "";

        // ステップごとのフィルタリング
        if (step === 'target') {
            if (MenuBlacksmith.mode === 'transfer') {
                // 継承: +3の装備のみ
                items = App.data.inventory.filter(i => i.plus === 3);
                prompt = "ベースにする装備(+3)を選択してください";
            } else {
                // 強化: オプションを持っている装備
                items = App.data.inventory.filter(i => i.opts && i.opts.length > 0);
                prompt = "強化したい装備を選択してください";
            }
        } else if (step === 'material') {
            // 素材: ターゲット以外
            items = App.data.inventory.filter(i => i.id !== MenuBlacksmith.targetItem.id);
            
            if (MenuBlacksmith.mode === 'transfer') {
                // 継承素材: オプションを1つ以上持っていること
                items = items.filter(i => i.opts && i.opts.length > 0);
                prompt = "オプションを引き継ぐ素材を選択してください";
            } else {
                prompt = "消費する素材を選択してください";
            }
        }

        // ヘッダー書き換え
        const headerTitle = document.querySelector('#sub-screen-blacksmith .header-bar span');
        if(headerTitle) headerTitle.innerText = step === 'target' ? 'ベース選択' : '素材選択';
        
        // select画面のヘッダータイトルがある場合(index.htmlの構造による)
        const selectHeader = document.querySelector('#smith-screen-select .header-bar span');
        if(selectHeader) selectHeader.innerText = step === 'target' ? 'ベース選択' : '素材選択';


        footer.innerHTML = `<div style="text-align:center; color:#ffd700;">${prompt}</div>`;

        if (items.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">対象となる装備がありません</div>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            
            // 装備中チェック
            let ownerName = "";
            const owner = App.data.characters.find(c => c.equips[item.type] && c.equips[item.type].id === item.id);
            if(owner) ownerName = ` <span style="font-size:10px; color:#f88;">[${owner.name}]</span>`;

            div.innerHTML = `
                <div style="flex:1;">
                    <div>${item.name}${ownerName}</div>
                    ${Menu.getEquipDetailHTML(item)}
                </div>
            `;
            
            div.onclick = () => {
                if (owner) {
                    Menu.msg(`${owner.name}が装備中のため選択できません`);
                    return;
                }

                if (step === 'target') {
                    MenuBlacksmith.targetItem = item;
                    MenuBlacksmith.renderList('material');
                } else {
                    MenuBlacksmith.materialItem = item;
                    MenuBlacksmith.confirmExecution();
                }
            };
            list.appendChild(div);
        });
    },

    // --- 実行確認 ---
    confirmExecution: () => {
        const target = MenuBlacksmith.targetItem;
        const material = MenuBlacksmith.materialItem;
        const lv = App.data.blacksmith.level || 1;

        if (MenuBlacksmith.mode === 'transfer') {
            // 継承 (+4化)
            const rateObj = MenuBlacksmith.getRateObj(lv);
            let rateStr = "";
            for (let r in rateObj) if(rateObj[r]>0) rateStr += `${r}:${rateObj[r]}% `;

            Menu.confirm(
                `【能力継承】\n\nベース: ${target.name}\n素材: ${material.name}\n\n素材からオプションを1つ引き継ぎ、\n+4装備へ進化させます。\n\n※レアリティは再抽選されます\n確率: ${rateStr}`,
                () => MenuBlacksmith.executeTransfer()
            );

        } else {
            // 強化
            const successRate = Math.min(95, 50 + (lv * 5));
            
            Menu.confirm(
                `【能力強化】\n\nベース: ${target.name}\n素材: ${material.name}\n\n素材を消費してオプション値を強化します。\n成功率: ${successRate}%\n\nよろしいですか？`,
                () => MenuBlacksmith.executeEnhance(successRate)
            );
        }
    },

    // --- 処理実行: 継承 ---
    executeTransfer: () => {
        const target = MenuBlacksmith.targetItem;
        const material = MenuBlacksmith.materialItem;
        const lv = App.data.blacksmith.level || 1;

        // 1. レアリティ抽選
        const rateObj = MenuBlacksmith.getRateObj(lv);
        const r = Math.random() * 100;
        let current = 0;
        let newRarity = 'R';
        for(let key in rateObj) {
            if(r < current + rateObj[key]) { newRarity = key; break; }
            current += rateObj[key];
        }

        // 2. オプション移植 (素材からランダム1つ)
        if (!material.opts || material.opts.length === 0) {
            Menu.msg("素材にオプションがありません"); return;
        }
        const pickOpt = material.opts[Math.floor(Math.random() * material.opts.length)];
        // コピーを作成して追加
        const newOpt = JSON.parse(JSON.stringify(pickOpt));
        
        // 3. データ更新
        target.plus = 4;
        target.rarity = newRarity;
        target.name = target.name.replace(/\+\d/, '') + '+4'; // 名前更新
        target.opts.push(newOpt);
        
        // 素材削除
        const matIdx = App.data.inventory.findIndex(i => i.id === material.id);
        if(matIdx > -1) App.data.inventory.splice(matIdx, 1);

        // 経験値
        MenuBlacksmith.gainExp(50);

        App.save();
        Menu.msg(`成功！\n${target.name} (Rank:${newRarity}) が完成しました！`, () => {
            MenuBlacksmith.init();
        });
    },

    // --- 処理実行: 強化 ---
    executeEnhance: (rate) => {
        const target = MenuBlacksmith.targetItem;
        const material = MenuBlacksmith.materialItem;

        // 素材削除
        const matIdx = App.data.inventory.findIndex(i => i.id === material.id);
        if(matIdx > -1) App.data.inventory.splice(matIdx, 1);

        // 判定
        if (Math.random() * 100 < rate) {
            let log = [];
            target.opts.forEach(opt => {
                // ルール参照
                const rule = DB.OPT_RULES.find(r => r.key === opt.key && (r.elm === opt.elm || !r.elm));
                if (rule) {
                    const maxVal = rule.max[opt.rarity] || 999;
                    const isPct = (opt.unit === '%');
                    
                    // 強化値: %なら+1、固定値なら+2 (ただし上限まで)
                    const increase = isPct ? 1 : 2; 
                    
                    if (opt.val < maxVal) {
                        opt.val = Math.min(maxVal, opt.val + increase);
                        log.push(`${opt.label}↑`);
                    }
                }
            });

            MenuBlacksmith.gainExp(10);
            App.save();
            
            if (log.length > 0) Menu.msg(`強化成功！\n${log.join(', ')}`, () => MenuBlacksmith.init());
            else Menu.msg("強化成功！\n(これ以上数値は上がりません)", () => MenuBlacksmith.init());

        } else {
            MenuBlacksmith.gainExp(5);
            App.save();
            Menu.msg("失敗しました...\n素材は失われました。", () => MenuBlacksmith.init());
        }
    },

    // --- ユーティリティ ---
    getRateObj: (lv) => {
        // レベルに応じてテーブルを切り替える
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
