/* MenuTraitDetail extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/**
 * 特性詳細モーダル (確定版)
 */
const MenuTraitDetail = {
    traitList: [],
    currentIndex: -1,

    open: (index, list) => {
        MenuTraitDetail.traitList = list;
        MenuTraitDetail.currentIndex = index;
        MenuTraitDetail.render();
    },

    move: (dir) => {
        const len = MenuTraitDetail.traitList.length;
        if (len <= 1) return;
        MenuTraitDetail.currentIndex = (MenuTraitDetail.currentIndex + dir + len) % len;
        MenuTraitDetail.render();
    },

    close: () => {
        const el = document.getElementById('trait-detail-modal');
        if (el) el.remove();
        const resEl = document.getElementById('trait-reroll-result-modal');
        if (resEl) resEl.remove();
    },

    // --- 再抽選の実行（内部データの書き換えはまだ行わない） ---
    reroll: () => {
        const t = MenuTraitDetail.traitList[MenuTraitDetail.currentIndex];
        const char = MenuAllies.getSelectedChar();
        if (!char || t.isEquip) return;

        const masterId = char.charId || char.id;
        const masterData = (typeof window.CHARACTERS_DATA !== 'undefined') ? window.CHARACTERS_DATA : [];
        const charMaster = masterData.find(m => m.id == masterId);
        
        const isFixedSlot = charMaster && charMaster.fixedTraits && 
                            charMaster.fixedTraits[t.slotIndex] !== undefined && 
                            charMaster.fixedTraits[t.slotIndex] !== null;

        if (isFixedSlot) {
            const m = Menu.msg("このスロットは固定枠のため変更できません。");
            if(m) document.getElementById('menu-dialog-area').style.zIndex = "50000";
            return;
        }

        Menu.confirm(`2000 GEM を使用して特性を再抽選しますか？`, () => {
            const dialogArea = document.getElementById('menu-dialog-area');
            if ((App.data.gems || 0) < 2000) {
                Menu.msg("GEMが足りません");
                if(dialogArea) dialogArea.style.zIndex = "50000";
                return;
            }

            // 初回消費
            App.data.gems -= 2000;
            
            // 新しい特性を抽選（重複回避）
            const currentIds = char.traits.map(x => x.id);
            const pool = Object.values(PassiveSkill.MASTER).filter(m => !currentIds.includes(m.id));
            const newMaster = pool[Math.floor(Math.random() * pool.length)];

            // ★重要：セーブデータに状態を予約（リロード対策）
            // この時点では char.traits は書き換えない
            App.data.progress.rerollState = {
                charUid: char.uid,
                slotIndex: t.slotIndex,
                oldTraitId: char.traits[t.slotIndex].id,
                newTraitId: newMaster.id
            };

            App.save();
            MenuTraitDetail.renderRerollResult();
        });

        const dialogArea = document.getElementById('menu-dialog-area');
        if(dialogArea) dialogArea.style.zIndex = "50000";
    },

    // --- 再抽選の確定・維持処理 ---
    finalizeReroll: (applyNew) => {
        const state = App.data.progress.rerollState;
        if (!state) return;

        const char = App.data.characters.find(c => c.uid === state.charUid);
        
        // ★スクロール位置の保存（スキル設定と同じセレクタ）
        const selector = '#allies-detail-view .scroll-container-inner';
        const container = document.querySelector(selector);
        const scrollPos = container ? container.scrollTop : 0;

        if (applyNew && char) {
            // ここで初めて実際に書き換える
            char.traits[state.slotIndex] = { id: state.newTraitId, level: 1, battleCount: 0 };
            App.save(); // refreshAllStatsの代わりにsaveとrenderDetailで更新
            Menu.msg("新しい特性を習得しました！");
        } else {
            Menu.msg("既存の特性を維持しました。");
        }

        // 予約状態の解除
        delete App.data.progress.rerollState;
        App.save();
        
        MenuTraitDetail.close();
        MenuAllies.renderDetail();
        
        // ★スクロール位置の復元
        const newContainer = document.querySelector(selector);
        if (newContainer) {
            newContainer.scrollTop = scrollPos;
        }
        Menu.renderPartyBar();
    },

    // --- 比較画面からの追加抽選 ---
    rerollAgain: () => {
        const state = App.data.progress.rerollState;
        if ((App.data.gems || 0) < 2000) {
            Menu.msg("GEMが足りません");
            return;
        }

        const char = App.data.characters.find(c => c.uid === state.charUid);
        if (!char) return;

        App.data.gems -= 2000;

        // 再抽選（重複回避）
        const currentIds = char.traits.map(x => x.id);
        const pool = Object.values(PassiveSkill.MASTER).filter(m => !currentIds.includes(m.id));
        const newMaster = pool[Math.floor(Math.random() * pool.length)];

        // 状態を更新して保存
        state.newTraitId = newMaster.id;
        App.save();

        MenuTraitDetail.renderRerollResult();
    },

    // --- 新設：再抽選結果の比較・選択画面 ---
    renderRerollResult: () => {
        const state = App.data.progress.rerollState;
        if (!state) return;

        const oldM = PassiveSkill.MASTER[state.oldTraitId];
        const newM = PassiveSkill.MASTER[state.newTraitId];

        let modal = document.getElementById('trait-reroll-result-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'trait-reroll-result-modal';
            document.body.appendChild(modal);
        }

        modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,20,0.9); z-index:6000; display:flex; align-items:center; justify-content:center;`;

        modal.innerHTML = `
            <div style="width:320px; background:#111; border:2px solid #ffd700; border-radius:10px; padding:20px; color:#eee; font-family:sans-serif;">
                <div style="text-align:center; font-weight:bold; color:#ffd700; margin-bottom:15px; font-size:16px;">特性再抽選</div>
                
                <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
                    <div style="background:#222; border:1px solid #444; padding:10px; border-radius:5px; opacity:0.8;">
                        <div style="font-size:10px; color:#888; margin-bottom:3px;">[既存の特性]</div>
                        <div style="color:#aaa; font-weight:bold;">${oldM.name}</div>
                        <div style="font-size:11px; color:#777;">${oldM.desc}</div>
                    </div>
                    
                    <div style="text-align:center; color:#ffd700; font-size:18px; margin:-5px 0;">▼</div>

                    <div style="background:#1a2a1a; border:2px solid #4a4; padding:10px; border-radius:5px;">
                        <div style="font-size:10px; color:#8f8; margin-bottom:3px;">[再抽選の結果]</div>
                        <div style="color:#fff; font-weight:bold; font-size:14px;">${newM.name}</div>
                        <div style="font-size:11px; color:#ccc;">${newM.desc}</div>
                    </div>
                </div>

                <div style="background:#333; padding:8px; border-radius:4px; text-align:center; margin-bottom:15px; font-size:12px;">
                    所持: <span style="color:#ffd700; font-weight:bold;">${(App.data.gems || 0).toLocaleString()} GEM</span>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button class="btn" style="padding:12px; background:#3a3; font-weight:bold; color:white; border:none; border-radius:4px; cursor:pointer;" onclick="MenuTraitDetail.finalizeReroll(true)">この特性に変更する</button>
                    <button class="btn" style="padding:10px; background:#444; color:white; border:none; border-radius:4px; cursor:pointer;" onclick="MenuTraitDetail.finalizeReroll(false)">既存を維持してもどる</button>
                    <button class="btn" style="padding:10px; background:#a22; color:white; border:none; border-radius:4px; cursor:pointer; margin-top:5px; font-size:11px;" onclick="MenuTraitDetail.rerollAgain()">
                        もう一度抽選する (2000 GEM)
                    </button>
                </div>
            </div>
        `;
    },

    render: () => {
        const t = MenuTraitDetail.traitList[MenuTraitDetail.currentIndex];
        const char = MenuAllies.getSelectedChar();
        if (!t || !char) return;

        const masterId = char.charId || char.id;
        const masterData = (typeof window.CHARACTERS_DATA !== 'undefined') ? window.CHARACTERS_DATA : [];
        const charMaster = masterData.find(m => m.id == masterId);
        
        const isFixedSlot = charMaster && charMaster.fixedTraits && 
                            charMaster.fixedTraits[t.slotIndex] !== undefined && 
                            charMaster.fixedTraits[t.slotIndex] !== null;
        
        const isChangable = !t.isEquip && !isFixedSlot;

        let modal = document.getElementById('trait-detail-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'trait-detail-modal';
            document.body.appendChild(modal);
        }

        modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:5000; display:flex; align-items:center; justify-content:center;`;

        modal.innerHTML = `
            <div style="width:310px; background:#111; border:1px solid ${t.isEquip ? '#00ffff' : '#ffd700'}; border-radius:8px; padding:20px; color:#eee; box-shadow:0 10px 40px #000; font-family:sans-serif;">
                <div style="border-bottom:1px solid #333; padding-bottom:10px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:${t.isEquip ? '#00ffff' : '#ffd700'}; font-size:18px; font-weight:bold;">${t.name}</span>
                    <span style="font-size:10px; background:#333; padding:2px 8px; border-radius:4px; color:#aaa;">${t.isEquip ? '装備品' : (isChangable ? '自由枠' : '固定枠')}</span>
                </div>

                <div style="background:#222; padding:10px; border-radius:4px; font-size:12px; margin-bottom:15px; display:flex; justify-content:space-between;">
                    <span>現在のLv: <b style="color:#fff;">${t.lv}</b></span>
                    <span style="color:#888;">分類: ${t.type}</span>
                </div>

                <div style="font-size:13px; line-height:1.6; color:#ccc; min-height:60px; margin-bottom:20px; padding:0 5px;">
                    ${t.desc || '効果なし'}
                </div>

                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; justify-content:space-between; gap:10px;">
                        <div style="display:flex; gap:5px;">
                            <button class="btn" style="width:45px; height:35px; background:#333; color:white; border:1px solid #555; cursor:pointer;" onclick="MenuTraitDetail.move(-1)">▲</button>
                            <button class="btn" style="width:45px; height:35px; background:#333; color:white; border:1px solid #555; cursor:pointer;" onclick="MenuTraitDetail.move(1)">▼</button>
                        </div>
                        <button class="btn" style="flex:1; background:#444; color:white; border:1px solid #555; cursor:pointer;" onclick="MenuTraitDetail.close()">閉じる</button>
                    </div>

                    ${isChangable ? `
                        <button class="btn" style="width:100%; padding:12px; background:#1a1a1a; border:1px solid #555; color:#ffd700; font-size:12px; font-weight:bold; border-radius:4px; cursor:pointer;" 
                            onclick="MenuTraitDetail.reroll()">
                            特性を再抽選する (2000 GEM)
                        </button>
                    ` : `
                        <div style="text-align:center; font-size:10px; color:#555; padding:8px; border-top:1px solid #222; margin-top:5px;">
                            ${t.isEquip ? '装備品による特性は変更できません' : 'このスロットは固定枠のため変更できません'}
                        </div>
                    `}
                </div>
            </div>
        `;
    }
};

if (typeof window !== 'undefined') window.MenuTraitDetail = MenuTraitDetail;
