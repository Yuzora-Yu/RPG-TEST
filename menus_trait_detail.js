/* MenuTraitDetail extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/**
 * 特性詳細モーダル
 */
const MenuTraitDetail = {
    traitList: [],
    currentIndex: -1,

    escape: (value) => (typeof Menu !== 'undefined' && typeof Menu.escapeHtml === 'function')
        ? Menu.escapeHtml(value)
        : String(value ?? ''),

    ensureModal: (id, className = '') => {
        if (typeof Menu !== 'undefined' && typeof Menu.ensureModalOverlay === 'function') {
            return Menu.ensureModalOverlay(id, className);
        }
        let modal = document.getElementById(id);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = id;
            document.body.appendChild(modal);
        }
        return modal;
    },

    open: (index, list) => {
        MenuTraitDetail.traitList = Array.isArray(list) ? list.filter(Boolean) : [];
        MenuTraitDetail.currentIndex = Math.max(0, Math.min(Number(index || 0), MenuTraitDetail.traitList.length - 1));
        MenuTraitDetail.render();
    },

    move: (dir) => {
        const len = MenuTraitDetail.traitList.length;
        if (len <= 1) return;
        MenuTraitDetail.currentIndex = (MenuTraitDetail.currentIndex + Number(dir || 0) + len) % len;
        MenuTraitDetail.render();
    },

    close: () => {
        document.getElementById('trait-detail-modal')?.remove();
        document.getElementById('trait-reroll-result-modal')?.remove();
    },

    reroll: () => {
        const t = MenuTraitDetail.traitList[MenuTraitDetail.currentIndex];
        const char = MenuAllies.getSelectedChar();
        if (!char || !t || t.isEquip) return;

        const masterId = char.charId || char.id;
        const masterData = (typeof window.CHARACTERS_DATA !== 'undefined') ? window.CHARACTERS_DATA : [];
        const charMaster = masterData.find(m => m.id == masterId);
        const isFixedSlot = charMaster && charMaster.fixedTraits &&
            charMaster.fixedTraits[t.slotIndex] !== undefined &&
            charMaster.fixedTraits[t.slotIndex] !== null;

        if (isFixedSlot) {
            Menu.msg('このスロットは固定枠のため変更できません。');
            const area = document.getElementById('menu-dialog-area');
            if (area) area.style.zIndex = '50000';
            return;
        }

        Menu.confirm('2000 GEM を使用して特性を再抽選しますか？', () => {
            const dialogArea = document.getElementById('menu-dialog-area');
            if ((App.data.gems || 0) < 2000) {
                Menu.msg('GEMが足りません');
                if (dialogArea) dialogArea.style.zIndex = '50000';
                return;
            }

            const currentIds = char.traits.map(x => x.id);
            const pool = Object.values(PassiveSkill.MASTER).filter(m => !currentIds.includes(m.id));
            const newMaster = pool[Math.floor(Math.random() * pool.length)];
            if (!newMaster) {
                Menu.msg('再抽選できる特性がありません。');
                if (dialogArea) dialogArea.style.zIndex = '50000';
                return;
            }

            App.data.gems -= 2000;
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
        if (dialogArea) dialogArea.style.zIndex = '50000';
    },

    finalizeReroll: (applyNew) => {
        const state = App.data.progress.rerollState;
        if (!state) return;

        const char = App.data.characters.find(c => c.uid === state.charUid);
        const selector = '#allies-detail-view .scroll-container-inner';
        const container = document.querySelector(selector);
        const scrollPos = container ? container.scrollTop : 0;

        if (applyNew && char) {
            char.traits[state.slotIndex] = { id: state.newTraitId, level: 1, battleCount: 0 };
            App.save();
            Menu.msg('新しい特性を習得しました！');
        } else {
            Menu.msg('既存の特性を維持しました。');
        }

        delete App.data.progress.rerollState;
        App.save();
        MenuTraitDetail.close();
        MenuAllies.renderDetail();

        const newContainer = document.querySelector(selector);
        if (newContainer) newContainer.scrollTop = scrollPos;
        Menu.renderPartyBar();
    },

    rerollAgain: () => {
        const state = App.data.progress.rerollState;
        if (!state) return;
        if ((App.data.gems || 0) < 2000) {
            Menu.msg('GEMが足りません');
            return;
        }

        const char = App.data.characters.find(c => c.uid === state.charUid);
        if (!char) return;

        const currentIds = char.traits.map(x => x.id);
        const pool = Object.values(PassiveSkill.MASTER).filter(m => !currentIds.includes(m.id));
        const newMaster = pool[Math.floor(Math.random() * pool.length)];
        if (!newMaster) {
            Menu.msg('再抽選できる特性がありません。');
            return;
        }

        App.data.gems -= 2000;
        state.newTraitId = newMaster.id;
        App.save();
        MenuTraitDetail.renderRerollResult();
    },

    renderRerollResult: () => {
        const state = App.data.progress.rerollState;
        if (!state) return;

        const oldM = PassiveSkill.MASTER[state.oldTraitId];
        const newM = PassiveSkill.MASTER[state.newTraitId];
        if (!oldM || !newM) return;

        const escape = MenuTraitDetail.escape;
        const modal = MenuTraitDetail.ensureModal('trait-reroll-result-modal', 'trait-reroll-result-modal game-modal-overlay--strong');
        modal.innerHTML = `
            <section class="game-modal-dialog game-modal-dialog--trait-reroll" role="dialog" aria-modal="true" aria-labelledby="trait-reroll-title" style="--modal-accent:#ffd700;">
                <header class="game-modal-header">
                    <div class="game-modal-heading">
                        <div id="trait-reroll-title" class="game-modal-title">特性再抽選</div>
                    </div>
                </header>
                <div class="game-modal-body" tabindex="0">
                    <div class="trait-reroll-card is-old">
                        <div class="trait-reroll-label">既存の特性</div>
                        <div class="trait-reroll-name">${escape(oldM.name)}</div>
                        <div class="trait-reroll-description">${escape(oldM.desc)}</div>
                    </div>
                    <div class="trait-reroll-arrow">▼</div>
                    <div class="trait-reroll-card is-new">
                        <div class="trait-reroll-label">再抽選の結果</div>
                        <div class="trait-reroll-name">${escape(newM.name)}</div>
                        <div class="trait-reroll-description">${escape(newM.desc)}</div>
                    </div>
                    <div class="game-modal-balance">所持: <b>${(App.data.gems || 0).toLocaleString()} GEM</b></div>
                </div>
                <footer class="game-modal-footer game-modal-footer--stacked">
                    <button class="btn trait-reroll-accept" type="button" onclick="MenuTraitDetail.finalizeReroll(true)">この特性に変更する</button>
                    <button class="btn" type="button" onclick="MenuTraitDetail.finalizeReroll(false)">既存を維持してもどる</button>
                    <button class="btn trait-reroll-again" type="button" onclick="MenuTraitDetail.rerollAgain()">もう一度抽選する (2000 GEM)</button>
                </footer>
            </section>
        `;
        modal.querySelector('.game-modal-body')?.scrollTo?.(0, 0);
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
        const accent = t.isEquip ? '#00ffff' : '#ffd700';
        const escape = MenuTraitDetail.escape;
        const modal = MenuTraitDetail.ensureModal('trait-detail-modal', 'trait-detail-modal');

        modal.innerHTML = `
            <section class="game-modal-dialog game-modal-dialog--trait" role="dialog" aria-modal="true" aria-labelledby="trait-detail-title" style="--modal-accent:${accent};">
                <header class="game-modal-header">
                    <div class="game-modal-heading">
                        <div id="trait-detail-title" class="game-modal-title">${escape(t.name)}</div>
                    </div>
                    <span class="game-modal-badge">${t.isEquip ? '装備品' : (isChangable ? '自由枠' : '固定枠')}</span>
                </header>
                <div class="game-modal-body" tabindex="0">
                    <div class="game-modal-meta-grid">
                        <div><span>現在のLv</span><b>${escape(t.lv)}</b></div>
                        <div><span>分類</span><b>${escape(t.type || '不明')}</b></div>
                    </div>
                    <div class="game-modal-description">${escape(t.desc || '効果なし')}</div>
                    ${!isChangable ? `<div class="game-modal-note">${t.isEquip ? '装備品による特性は変更できません' : 'このスロットは固定枠のため変更できません'}</div>` : ''}
                </div>
                <footer class="game-modal-footer game-modal-footer--stacked">
                    <div class="game-modal-footer-row">
                        <div class="game-modal-nav">
                            <button class="btn" type="button" onclick="MenuTraitDetail.move(-1)" aria-label="前の特性">▲</button>
                            <button class="btn" type="button" onclick="MenuTraitDetail.move(1)" aria-label="次の特性">▼</button>
                        </div>
                        <button class="btn game-modal-close" type="button" onclick="MenuTraitDetail.close()">閉じる</button>
                    </div>
                    ${isChangable ? '<button class="btn trait-reroll-open" type="button" onclick="MenuTraitDetail.reroll()">特性を再抽選する (2000 GEM)</button>' : ''}
                </footer>
            </section>
        `;
        modal.querySelector('.game-modal-body')?.scrollTo?.(0, 0);
    }
};

if (typeof window !== 'undefined') window.MenuTraitDetail = MenuTraitDetail;
