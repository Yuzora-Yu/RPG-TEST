/* ==========================================================================
   +3装備取得カード
   - 戦闘報酬ではドロップログ直後に戦闘画面上へ表示し、ログ進行を待機する。
   - カード表示中の入力は最前面で消費し、閉じたタップを戦闘結果へ伝播させない。
   - 戦闘イベント終了後は勝敗判定を必ず再確認し、battle_event停止を復旧する。
   ========================================================================== */

(() => {
    'use strict';

    const STATE_KEY = 'equipAcquisitionCardsV1';
    const HANDLED_LIMIT = 300;
    const MIN_SHOW_DELAY_MS = 2050;
    const INPUT_RELEASE_DELAY_MS = 280;
    const BATTLE_SOURCES = new Set(['battleDrop', 'specialBoss']);
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
    const stripHtml = (value) => String(value ?? '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    const Manager = {
        active: null,
        timer: null,
        achievementHookInstalled: false,
        battleHooksInstalled: false,
        battleCandidates: [],
        battleReadyCards: [],
        battleInventorySnapshot: new Set(),
        battleCaptureActive: false,
        battleConversationPending: 0,
        battleRecoveryTimer: null,

        ensureState() {
            if (typeof App === 'undefined' || !App.data) return null;
            if (!App.data.system || typeof App.data.system !== 'object' || Array.isArray(App.data.system)) App.data.system = {};
            let state = App.data.system[STATE_KEY];
            if (!state || typeof state !== 'object' || Array.isArray(state)) {
                state = { pending: [], handled: {} };
                App.data.system[STATE_KEY] = state;
            }
            if (!Array.isArray(state.pending)) state.pending = [];
            if (!state.handled || typeof state.handled !== 'object' || Array.isArray(state.handled)) state.handled = {};
            state.pending = state.pending.filter(entry => entry && String(entry.uid || '').trim());
            return state;
        },

        resolveMaster(equip) {
            const masters = Array.isArray(window.EQUIP_MASTER) ? window.EQUIP_MASTER : [];
            const explicit = Number(equip?.eid ?? equip?.masterEid ?? equip?.equipMasterId);
            if (Number.isFinite(explicit)) {
                const found = masters.find(entry => Number(entry?.eid) === explicit);
                if (found) return found;
            }
            const cleanName = String(equip?.name || '')
                .replace(/^真・/, '')
                .replace(/・改(?=\+?\d*$)/, '')
                .replace(/\+\d+$/, '');
            return masters.find(entry => String(entry?.name || '') === cleanName && String(entry?.type || '') === String(equip?.type || ''))
                || masters.find(entry => Number(entry?.rank) === Number(equip?.rank)
                    && String(entry?.type || '') === String(equip?.type || '')
                    && String(entry?.baseName || '') === String(equip?.baseName || ''))
                || null;
        },

        ensureEquipIdentity(equip) {
            if (!equip || typeof equip !== 'object') return null;
            if (equip.id == null || String(equip.id).trim() === '') {
                equip.id = `equip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            }
            const master = Manager.resolveMaster(equip);
            if (master) {
                if (!Number.isFinite(Number(equip.eid))) equip.eid = Number(master.eid);
                if (!Number.isFinite(Number(equip.masterEid))) equip.masterEid = Number(master.eid);
            }
            return String(equip.id);
        },

        enqueue(equip, options = {}) {
            const source = String(options.source || equip?.source || 'reward');
            if (!equip || Number(equip.plus) !== 3 || options.skip === true || options.initial === true || source === 'shop') return false;
            const uid = Manager.ensureEquipIdentity(equip);
            if (!uid) return false;

            // battle.js からの登録はフィールド用待機列へ入れず、勝利ログと同期させる。
            if (BATTLE_SOURCES.has(source)) {
                Manager.registerBattleCandidate(equip, source);
                return true;
            }

            const state = Manager.ensureState();
            if (!state || state.handled[uid] || state.pending.some(entry => String(entry.uid) === uid)) return false;
            state.pending.push({
                uid,
                eid: Number(equip.eid ?? equip.masterEid) || 0,
                source,
                queuedAt: Date.now(),
                earliestAt: Date.now() + Math.max(0, Number(options.delayMs ?? MIN_SHOW_DELAY_MS) || 0)
            });
            Manager.schedule(250);
            return true;
        },

        installAchievementHook() {
            if (Manager.achievementHookInstalled || typeof AchievementManager === 'undefined') return false;
            if (typeof AchievementManager.processRewards !== 'function') return false;
            const original = AchievementManager.processRewards;
            if (original.__equipAcquisitionCardWrapped) {
                Manager.achievementHookInstalled = true;
                return true;
            }
            const wrapped = function(rewards = []) {
                const before = new Set((App.data?.inventory || []).map(equip => String(equip?.id || '')));
                const result = original.apply(this, arguments);
                (App.data?.inventory || []).forEach(equip => {
                    const uid = String(equip?.id || '');
                    if (uid && !before.has(uid)) Manager.enqueue(equip, { source:'achievement' });
                });
                return result;
            };
            wrapped.__equipAcquisitionCardWrapped = true;
            AchievementManager.processRewards = wrapped;
            Manager.achievementHookInstalled = true;
            return true;
        },

        findOwnedEquip(uid) {
            const inventory = Array.isArray(App.data?.inventory) ? App.data.inventory : [];
            const inventoryIndex = inventory.findIndex(equip => String(equip?.id) === String(uid));
            if (inventoryIndex >= 0) return { equip:inventory[inventoryIndex], inventoryIndex, owner:null, part:null };
            for (const owner of (App.data?.characters || [])) {
                for (const [part, equip] of Object.entries(owner?.equips || {})) {
                    if (String(equip?.id) === String(uid)) return { equip, inventoryIndex:-1, owner, part };
                }
            }
            return null;
        },

        removePending(uid, status) {
            const state = Manager.ensureState();
            if (!state || !uid) return;
            state.pending = state.pending.filter(entry => String(entry.uid) !== String(uid));
            state.handled[String(uid)] = { status:String(status || 'kept'), at:Date.now() };
            const keys = Object.keys(state.handled)
                .sort((a, b) => Number(state.handled[b]?.at || 0) - Number(state.handled[a]?.at || 0));
            keys.slice(HANDLED_LIMIT).forEach(key => delete state.handled[key]);
        },

        isVisibleElement(element) {
            if (!element) return false;
            const style = window.getComputedStyle ? window.getComputedStyle(element) : element.style;
            return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity ?? 1) !== 0;
        },

        isSafeToShow() {
            if (!document.body || Manager.active || typeof App === 'undefined' || !App.data) return false;
            if (typeof StoryManager !== 'undefined' && (StoryManager.active || StoryManager.isTyping)) return false;
            const battleScene = document.getElementById('battle-scene');
            if (Manager.isVisibleElement(battleScene)) return false;
            const dialog = document.getElementById('menu-dialog-area');
            if (Manager.isVisibleElement(dialog)) return false;
            const openFacilityModal = Array.from(document.querySelectorAll('[id$="-modal-layer"]'))
                .some(layer => Manager.isVisibleElement(layer));
            return !openFacilityModal;
        },

        schedule(delay = 350) {
            if (Manager.timer) clearTimeout(Manager.timer);
            Manager.timer = setTimeout(() => {
                Manager.timer = null;
                Manager.pump();
            }, Math.max(0, Number(delay) || 0));
        },

        discardLegacyBattlePending(entry) {
            const commit = () => {
                Manager.removePending(entry.uid, 'legacy-battle-deferred-skipped');
                return { ok:true };
            };
            if (typeof App.runAtomicSaveMutation === 'function') App.runAtomicSaveMutation(commit);
            else {
                commit();
                App.save?.();
            }
        },

        pump() {
            Manager.installAchievementHook();
            Manager.installBattleHooks();
            const state = Manager.ensureState();
            if (!state || Manager.active || state.pending.length === 0) return;
            const entry = state.pending[0];
            const source = String(entry?.source || '');
            if (source === 'shop' || BATTLE_SOURCES.has(source)) {
                Manager.discardLegacyBattlePending(entry);
                Manager.schedule(100);
                return;
            }
            const owned = Manager.findOwnedEquip(entry.uid);
            if (!owned) {
                const commit = () => {
                    Manager.removePending(entry.uid, 'missing');
                    return { ok:true };
                };
                if (typeof App.runAtomicSaveMutation === 'function') App.runAtomicSaveMutation(commit);
                else {
                    commit();
                    App.save?.();
                }
                Manager.schedule(100);
                return;
            }
            const wait = Math.max(0, Number(entry.earliestAt || 0) - Date.now());
            if (wait > 0 || !Manager.isSafeToShow()) {
                Manager.schedule(Math.max(250, Math.min(900, wait || 500)));
                return;
            }
            Manager.show(entry, owned.equip, { battleResult:false });
        },

        getBaseStats(equip) {
            const labels = {
                hp:'HP', mp:'MP', atk:'攻撃', def:'防御', mag:'魔力', mdef:'魔防', spd:'素早さ',
                hit:'命中', eva:'回避', cri:'会心', finDmg:'与ダメ', finRed:'被ダメ軽減'
            };
            const ordered = Object.keys(labels);
            const entries = [];
            ordered.forEach(key => {
                const value = Number(equip?.data?.[key]);
                if (!Number.isFinite(value) || value === 0) return;
                const unit = ['hit','eva','cri','finDmg','finRed'].includes(key) ? '%' : '';
                entries.push(`${labels[key]} ${value > 0 ? '+' : ''}${value}${unit}`);
            });
            Object.entries(equip?.data || {}).forEach(([key, raw]) => {
                if (ordered.includes(key)) return;
                const value = Number(raw);
                if (!Number.isFinite(value) || value === 0) return;
                entries.push(`${key} ${value > 0 ? '+' : ''}${value}`);
            });
            return entries.length ? entries : ['基礎能力なし'];
        },

        getRarityColor(rarity) {
            if (typeof Menu !== 'undefined' && typeof Menu.getRarityColor === 'function') {
                return Menu.getRarityColor(String(rarity || 'N').toUpperCase());
            }
            return ({ N:'#a0a0a0', R:'#40e040', SR:'#40e0e0', SSR:'#ff4444', UR:'#e040e0', EX:'#ffff00' })
                [String(rarity || 'N').toUpperCase()] || '#fff';
        },

        getOptionText(option) {
            const rule = (typeof DB !== 'undefined' && Array.isArray(DB.OPT_RULES))
                ? DB.OPT_RULES.find(entry => entry.key === option?.key && (!option?.elm || entry.elm === option.elm))
                : null;
            const label = option?.label || rule?.name || option?.key || '追加効果';
            const element = option?.elm && !String(label).includes(String(option.elm)) ? `${option.elm} ` : '';
            const value = Number(option?.val);
            const valueText = Number.isFinite(value)
                ? `${value >= 0 ? '+' : ''}${value}${option?.unit ?? rule?.unit ?? ''}`
                : '';
            const rarity = String(option?.rarity || '').toUpperCase();
            return `${element}${label}${valueText ? ` ${valueText}` : ''}${rarity ? ` [${rarity}]` : ''}`;
        },

        splitTraits(equip) {
            const all = Array.isArray(equip?.traits) ? equip.traits : [];
            const master = Manager.resolveMaster(equip);
            const base = Array.isArray(master?.traits) ? master.traits : [];
            const remaining = all.map(trait => ({ ...trait }));
            const baseTraits = [];
            base.forEach(masterTrait => {
                const index = remaining.findIndex(trait => Number(trait?.id) === Number(masterTrait?.id));
                if (index >= 0) baseTraits.push(remaining.splice(index, 1)[0]);
            });
            return { baseTraits, additionalTraits:remaining };
        },

        getTraitText(trait) {
            const master = typeof PassiveSkill !== 'undefined' ? PassiveSkill.MASTER?.[Number(trait?.id)] : null;
            const level = Math.max(1, Number(trait?.level) || 1);
            return `${master?.name || `特性${trait?.id ?? ''}`} Lv${level}`;
        },

        buildRows(equip) {
            const rows = [];
            (equip?.opts || []).forEach(option => {
                const rarity = String(option?.rarity || 'N').toUpperCase();
                rows.push({
                    kind:'option',
                    html:`<span style="color:${Manager.getRarityColor(rarity)}">${escapeHtml(Manager.getOptionText(option))}</span>`
                });
            });
            const traits = Manager.splitTraits(equip).additionalTraits;
            if (traits.length) {
                rows.push({
                    kind:'trait',
                    html:`<span class="equip-acquisition-trait-text">${traits.map(trait => escapeHtml(Manager.getTraitText(trait))).join('・')}</span>`
                });
            }
            const synergies = Array.isArray(equip?.synergies) && equip.synergies.length
                ? equip.synergies
                : (typeof App.checkSynergy === 'function' ? App.checkSynergy(equip) : []);
            if (synergies.length) {
                rows.push({
                    kind:'synergy',
                    html:synergies.map(syn =>
                        `<strong style="color:${escapeHtml(syn.color || '#fff3a5')}">${escapeHtml(syn.name || '共鳴')}</strong>` +
                        `${syn.desc ? `<span> ${escapeHtml(syn.desc)}</span>` : ''}`
                    ).join('　')
                });
            }
            return rows;
        },

        injectStyle() {
            if (document.getElementById('equip-acquisition-card-style')) return;
            const style = document.createElement('style');
            style.id = 'equip-acquisition-card-style';
            style.textContent = `
                #equip-acquisition-card-overlay{position:fixed;inset:0;z-index:2147483600;background:transparent;display:flex;align-items:center;justify-content:center;padding:max(6px,env(safe-area-inset-top)) max(6px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));box-sizing:border-box;font-family:'DotGothic16',sans-serif;color:#fff;touch-action:none;overscroll-behavior:contain;-webkit-tap-highlight-color:transparent}
                .equip-acquisition-card{width:min(calc(100vw - 12px),550px);max-height:min(70svh,338px);overflow-y:auto;box-sizing:border-box;padding:10px 11px 10px;border:1px solid #d2b55f;border-radius:11px;background:rgba(7,7,9,.91);box-shadow:0 0 0 2px rgba(0,0,0,.88),0 6px 18px rgba(0,0,0,.65);position:relative;transition:opacity .12s ease,transform .12s ease}
                #equip-acquisition-card-overlay.is-closing .equip-acquisition-card{opacity:.01;transform:scale(.985)}
                .equip-acquisition-main{display:grid;grid-template-columns:60px minmax(0,1fr);gap:9px;align-items:start}
                .equip-acquisition-image{width:60px;height:60px;background:#050505;border:none;border-radius:6px;overflow:hidden;position:relative;box-sizing:border-box;align-self:center}
                .equip-acquisition-image img{display:none;width:100%;height:100%;object-fit:cover}
                .equip-acquisition-image-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px;color:#fff;font-weight:bold;font-size:11px;line-height:1.2;box-sizing:border-box}
                .equip-acquisition-summary{min-width:0;padding-top:1px}
                .equip-acquisition-name-line{display:flex;align-items:center;gap:6px;min-width:0}
                .equip-acquisition-name{font-size:18px;line-height:1.25;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
                .equip-acquisition-rank{font-size:11px;line-height:1;color:#aaa;white-space:nowrap;margin-left:auto;flex-shrink:0}
                .equip-acquisition-base-stats{margin-top:6px;font-size:11px;line-height:1.35;color:#ccc;white-space:normal;overflow-wrap:anywhere}
                .equip-acquisition-reveal-list{display:flex;flex-wrap:wrap;gap:3px 9px;margin-top:6px;min-height:1px;line-height:1.3}
                .equip-acquisition-reveal-row{font-size:11px;max-width:100%;overflow-wrap:anywhere}.equip-acquisition-reveal-row.synergy{width:100%}.equip-acquisition-reveal-row.synergy strong{margin-right:3px}.equip-acquisition-reveal-row.synergy span{color:#ddd}
                .equip-acquisition-base-traits,.equip-acquisition-trait-text{font-size:11px;color:#ffd27a;line-height:1.35}.equip-acquisition-base-traits{margin-top:4px}
                .equip-acquisition-tap-hint{margin-top:8px;padding-top:5px;border-top:1px solid rgba(210,181,95,.32);font-size:10px;line-height:1.25;color:#aaa;text-align:right}
                .equip-acquisition-card.is-synergy{animation:equipAcquisitionGlow .85s ease-in-out infinite alternate}
                @keyframes equipAcquisitionGlow{from{box-shadow:0 0 0 2px rgba(0,0,0,.88),0 5px 14px rgba(0,0,0,.65),0 0 3px rgba(255,233,138,.18)}to{box-shadow:0 0 0 2px rgba(0,0,0,.88),0 5px 14px rgba(0,0,0,.65),0 0 12px rgba(255,233,138,.68)}}
                @media(max-width:340px){.equip-acquisition-card{width:calc(100vw - 10px);padding:8px}.equip-acquisition-main{grid-template-columns:55px minmax(0,1fr);gap:7px}.equip-acquisition-image{width:55px;height:55px}.equip-acquisition-name{font-size:16px}.equip-acquisition-rank,.equip-acquisition-base-stats,.equip-acquisition-reveal-row,.equip-acquisition-base-traits,.equip-acquisition-trait-text{font-size:10px}}
            `;
            document.head.appendChild(style);
        },

        createOverlay(entry, equip) {
            const overlay = document.createElement('div');
            overlay.id = 'equip-acquisition-card-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', '+3装備取得');
            const nameColor = Manager.getRarityColor(equip?.rarity || 'N');
            const rows = Manager.buildRows(equip);
            const split = Manager.splitTraits(equip);
            overlay.innerHTML = `
                <div class="equip-acquisition-card">
                    <div class="equip-acquisition-main">
                        <div class="equip-acquisition-image">
                            <div class="equip-acquisition-image-fallback">${escapeHtml(equip.baseName || equip.type || '装備')}</div>
                            <img alt="" draggable="false">
                        </div>
                        <div class="equip-acquisition-summary">
                            <div class="equip-acquisition-name-line">
                                <div class="equip-acquisition-name" style="color:${nameColor}">${escapeHtml(equip.name || '装備+3')}</div>
                                <div class="equip-acquisition-rank">Rank ${Math.max(1, Number(equip.rank) || 1)}</div>
                            </div>
                            <div class="equip-acquisition-base-stats">${Manager.getBaseStats(equip).map(text => `<span>${escapeHtml(text)}</span>`).join(' ')}</div>
                            <div class="equip-acquisition-reveal-list">${rows.map(row => `<div class="equip-acquisition-reveal-row ${row.kind}"><div class="equip-acquisition-reveal-value">${row.html}</div></div>`).join('')}</div>
                            <div class="equip-acquisition-base-traits">${split.baseTraits.length ? split.baseTraits.map(trait => escapeHtml(Manager.getTraitText(trait))).join('・') : ''}</div>
                            <div class="equip-acquisition-tap-hint">画面タップで閉じる</div>
                        </div>
                    </div>
                </div>`;
            const card = overlay.querySelector('.equip-acquisition-card');
            if (rows.some(row => row.kind === 'synergy')) card?.classList.add('is-synergy');
            const image = overlay.querySelector('img');
            const fallback = overlay.querySelector('.equip-acquisition-image-fallback');
            const eid = Number(equip.eid ?? equip.masterEid ?? entry.eid) || 0;
            if (image && fallback && eid > 0) {
                image.onload = () => {
                    image.style.display = 'block';
                    fallback.style.display = 'none';
                };
                image.onerror = () => {
                    image.removeAttribute('src');
                    image.style.display = 'none';
                    fallback.style.display = 'flex';
                };
                image.src = `assets/equips/${eid}.png`;
            }
            return overlay;
        },

        consumeInput(event) {
            if (!Manager.active) return;
            if (event?.cancelable) event.preventDefault();
            event?.stopPropagation?.();
            event?.stopImmediatePropagation?.();
        },

        installInputGuard() {
            const active = Manager.active;
            if (!active || active.inputGuard) return;
            active.inputGuard = event => {
                if (!Manager.active) return;
                Manager.consumeInput(event);
                if (Manager.active.closing) return;
                if (event.type === 'keydown') {
                    if (!['Escape', 'Enter', ' '].includes(event.key)) return;
                    Manager.closeActive();
                    return;
                }
                if (['pointerup', 'touchend', 'mouseup', 'click'].includes(event.type)) Manager.closeActive();
            };
            const options = { capture:true, passive:false };
            ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','click','keydown']
                .forEach(type => window.addEventListener(type, active.inputGuard, options));
        },

        removeInputGuard(active) {
            if (!active?.inputGuard) return;
            const options = { capture:true };
            ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','click','keydown']
                .forEach(type => window.removeEventListener(type, active.inputGuard, options));
            active.inputGuard = null;
        },

        show(entry, equip, options = {}) {
            if (!entry || !equip || Manager.active) return false;
            Manager.injectStyle();
            if (typeof Field !== 'undefined' && typeof Field.stopMove === 'function') Field.stopMove();
            const overlay = Manager.createOverlay(entry, equip);
            const battleResult = options.battleResult === true;
            const previousResultInputLocked = battleResult && typeof Battle !== 'undefined'
                ? Battle.resultInputLocked === true
                : false;
            if (battleResult && typeof Battle !== 'undefined') Battle.resultInputLocked = true;
            Manager.active = {
                entry,
                equip,
                overlay,
                battleResult,
                previousResultInputLocked,
                closing:false,
                resolve:typeof options.resolve === 'function' ? options.resolve : null,
                inputGuard:null
            };
            document.body.appendChild(overlay);
            Manager.installInputGuard();
            return true;
        },

        showAndWait(equip, options = {}) {
            if (!equip || Number(equip.plus) !== 3) return Promise.resolve(false);
            const uid = Manager.ensureEquipIdentity(equip);
            if (!uid) return Promise.resolve(false);
            const entry = {
                uid,
                eid:Number(equip.eid ?? equip.masterEid) || 0,
                source:String(options.source || 'battleDrop'),
                queuedAt:Date.now(),
                earliestAt:Date.now()
            };
            return new Promise(resolve => {
                const shown = Manager.show(entry, equip, { ...options, battleResult:true, resolve });
                if (!shown) resolve(false);
            });
        },

        commitKeep(active) {
            const mutation = () => {
                Manager.removePending(active.entry.uid, 'kept');
                return { ok:true };
            };
            // 戦闘結果トランザクション中は追加saveを行わず、直後の勝利結果saveへ含める。
            if (active.battleResult) {
                mutation();
                return true;
            }
            if (typeof App.runAtomicSaveMutation === 'function') {
                const committed = App.runAtomicSaveMutation(mutation);
                if (!committed?.ok) {
                    App.showMessage?.('保存できなかったため、カードを閉じられませんでした。');
                    return false;
                }
                return true;
            }
            mutation();
            if (typeof App.save === 'function' && App.save() === false) return false;
            return true;
        },

        closeActive() {
            const active = Manager.active;
            if (!active || active.closing) return false;
            if (!Manager.commitKeep(active)) return false;
            active.closing = true;
            active.overlay?.classList.add('is-closing');

            // pointerup/touchendの後に生成されるclickまで同じガードで吸収してから再開する。
            setTimeout(() => {
                if (Manager.active !== active) return;
                Manager.removeInputGuard(active);
                active.overlay?.remove();
                if (active.battleResult && typeof Battle !== 'undefined') {
                    Battle.resultInputLocked = active.previousResultInputLocked;
                }
                Manager.active = null;
                App.updateHUD?.();
                const resolve = active.resolve;
                if (resolve) resolve(true);
                Manager.schedule(220);
            }, INPUT_RELEASE_DELAY_MS);
            return true;
        },

        registerBattleCandidate(equip, source = 'battleDrop') {
            if (!equip || Number(equip.plus) !== 3) return false;
            const uid = Manager.ensureEquipIdentity(equip);
            if (!uid) return false;
            if (Manager.battleCandidates.some(entry => entry.uid === uid) ||
                Manager.battleReadyCards.some(entry => entry.uid === uid) ||
                String(Manager.active?.entry?.uid || '') === uid) return false;
            Manager.battleCandidates.push({ uid, equip, source:String(source || 'battleDrop') });
            return true;
        },

        beginBattleCapture() {
            Manager.battleCaptureActive = true;
            Manager.battleCandidates = [];
            Manager.battleReadyCards = [];
            Manager.battleInventorySnapshot = new Set((App.data?.inventory || []).map(equip => String(equip?.id || '')));
        },

        refreshBattleCandidatesFromInventory() {
            if (!Manager.battleCaptureActive) return;
            (App.data?.inventory || []).forEach(equip => {
                const uid = String(equip?.id || '');
                if (!uid || Manager.battleInventorySnapshot.has(uid) || Number(equip?.plus) !== 3) return;
                Manager.registerBattleCandidate(equip, 'battleDrop');
            });
        },

        observeBattleLog(message) {
            if (typeof Battle === 'undefined' || Battle.phase !== 'result') return;
            const plain = stripHtml(message);
            if (!plain.includes('手に入れた')) return;
            Manager.refreshBattleCandidatesFromInventory();
            const index = Manager.battleCandidates.findIndex(entry => {
                const name = String(entry.equip?.name || '');
                return name && plain.includes(name);
            });
            if (index < 0) return;
            const [entry] = Manager.battleCandidates.splice(index, 1);
            entry.previousResultInputLocked = Battle.resultInputLocked === true;
            Manager.battleReadyCards.push(entry);
            // ログを描画した同じフレームから結果送りを止める。
            Battle.resultInputLocked = true;
        },

        takeReadyBattleCard() {
            if (typeof Battle === 'undefined' || Battle.phase !== 'result') return null;
            return Manager.battleReadyCards.shift() || null;
        },

        async showReadyBattleCardAfter(waitPromise, entry) {
            try {
                await waitPromise;
                if (!entry || typeof Battle === 'undefined' || Battle.phase !== 'result' || Battle.resultProcessing === false) return false;
                return await Manager.showAndWait(entry.equip, { source:entry.source, battleResult:true });
            } finally {
                if (typeof Battle !== 'undefined' && !Manager.active) {
                    Battle.resultInputLocked = entry?.previousResultInputLocked === true;
                }
            }
        },

        finishBattleCapture() {
            Manager.battleCaptureActive = false;
            Manager.battleCandidates = [];
            Manager.battleReadyCards = [];
            Manager.battleInventorySnapshot = new Set();
            if (typeof Battle !== 'undefined' && !Manager.active) Battle.resultInputLocked = false;
        },

        scheduleBattleEventRecovery() {
            if (Manager.battleRecoveryTimer) clearTimeout(Manager.battleRecoveryTimer);
            Manager.battleRecoveryTimer = setTimeout(() => {
                Manager.battleRecoveryTimer = null;
                Manager.recoverBattleAfterEvent();
            }, 0);
        },

        recoverBattleAfterEvent() {
            if (typeof Battle === 'undefined' || Manager.battleConversationPending > 0) return false;
            if (!Battle.active || Battle.phase === 'result' || Battle.phase !== 'battle_event') return false;
            if (Battle.hasPendingPhaseTransition?.() || Battle.phaseTransitionRunnerActive) return false;

            Battle.updateDeadState?.();
            // 会話の最後で敵が全滅していた場合、元のターン継続可否に依存せず勝利へ進める。
            if (Battle.checkFinish?.()) return true;

            if (Battle.turnExecutionActive) {
                Battle.phase = 'execution';
                return true;
            }

            // 呼出元がstartInputPhase()を続ける場合は、そのmicrotaskを先に通す。
            Battle.phase = 'input_recovery';
            setTimeout(() => {
                if (!Battle.active || Battle.phase !== 'input_recovery' || Battle.phase === 'result') return;
                if (Battle.hasPendingPhaseTransition?.() || Battle.phaseTransitionRunnerActive || Battle.turnExecutionActive) return;
                Battle.updateDeadState?.();
                if (!Battle.checkFinish?.()) Battle.scheduleInputRecovery?.('戦闘イベント終了後の入力復帰');
            }, 0);
            return true;
        },

        installBattleHooks() {
            if (typeof Battle === 'undefined') return false;

            if (typeof Battle.win === 'function' && !Battle.win.__equipAcquisitionCardWrapped) {
                const originalWin = Battle.win;
                const wrappedWin = async function() {
                    Manager.beginBattleCapture();
                    try {
                        return await originalWin.apply(this, arguments);
                    } finally {
                        Manager.finishBattleCapture();
                    }
                };
                wrappedWin.__equipAcquisitionCardWrapped = true;
                wrappedWin.__original = originalWin;
                Battle.win = wrappedWin;
            }

            if (typeof Battle.log === 'function' && !Battle.log.__equipAcquisitionCardWrapped) {
                const originalLog = Battle.log;
                const wrappedLog = function(message) {
                    const result = originalLog.apply(this, arguments);
                    try { Manager.observeBattleLog(message); } catch (error) {
                        console.error('[EquipAcquisitionCard] battle drop log hook failed:', error);
                    }
                    return result;
                };
                wrappedLog.__equipAcquisitionCardWrapped = true;
                wrappedLog.__original = originalLog;
                Battle.log = wrappedLog;
            }

            if (typeof Battle.resultWait === 'function' && !Battle.resultWait.__equipAcquisitionCardWrapped) {
                const originalResultWait = Battle.resultWait;
                const wrappedResultWait = function() {
                    const waitPromise = originalResultWait.apply(this, arguments);
                    const entry = Manager.takeReadyBattleCard();
                    return entry ? Manager.showReadyBattleCardAfter(waitPromise, entry) : waitPromise;
                };
                wrappedResultWait.__equipAcquisitionCardWrapped = true;
                wrappedResultWait.__original = originalResultWait;
                Battle.resultWait = wrappedResultWait;
            }

            if (typeof Battle.queueBattleConversation === 'function' && !Battle.queueBattleConversation.__equipAcquisitionCardWrapped) {
                const originalQueue = Battle.queueBattleConversation;
                const wrappedQueue = function() {
                    const promise = originalQueue.apply(this, arguments);
                    Manager.battleConversationPending += 1;
                    let settled = false;
                    const complete = () => {
                        if (settled) return;
                        settled = true;
                        Manager.battleConversationPending = Math.max(0, Manager.battleConversationPending - 1);
                        if (Manager.battleConversationPending === 0) Manager.scheduleBattleEventRecovery();
                    };
                    Promise.resolve(promise).then(complete, complete);
                    return promise;
                };
                wrappedQueue.__equipAcquisitionCardWrapped = true;
                wrappedQueue.__original = originalQueue;
                Battle.queueBattleConversation = wrappedQueue;
            }

            if (typeof Battle.awaitPendingBattleEvent === 'function' && !Battle.awaitPendingBattleEvent.__equipAcquisitionCardWrapped) {
                const originalAwait = Battle.awaitPendingBattleEvent;
                const wrappedAwait = async function() {
                    const result = await originalAwait.apply(this, arguments);
                    // 実行中ターンからawaitされた会話は、この場でphaseを戻して呼出元の残処理を継続する。
                    // ターン外（開始会話など）は既存の.then(startInputPhase)を先に通せるよう遅延復旧する。
                    if (Manager.battleConversationPending === 0 && Battle.active && Battle.phase === 'battle_event' &&
                        !Battle.hasPendingPhaseTransition?.() && !Battle.phaseTransitionRunnerActive) {
                        if (Manager.battleRecoveryTimer) {
                            clearTimeout(Manager.battleRecoveryTimer);
                            Manager.battleRecoveryTimer = null;
                        }
                        Battle.updateDeadState?.();
                        const finished = Battle.checkFinish?.() === true;
                        if (!finished && Battle.turnExecutionActive) Battle.phase = 'execution';
                        else if (!finished && Battle.phase === 'battle_event') Manager.scheduleBattleEventRecovery();
                    } else {
                        Manager.scheduleBattleEventRecovery();
                    }
                    return result;
                };
                wrappedAwait.__equipAcquisitionCardWrapped = true;
                wrappedAwait.__original = originalAwait;
                Battle.awaitPendingBattleEvent = wrappedAwait;
            }

            Manager.battleHooksInstalled = true;
            return true;
        },

        init() {
            Manager.installAchievementHook();
            Manager.installBattleHooks();
            Manager.schedule(900);
            setInterval(() => {
                Manager.installAchievementHook();
                Manager.installBattleHooks();
                if (!Manager.active) Manager.pump();
            }, 900);
        }
    };

    window.EquipAcquisitionCard = Manager;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Manager.init(), { once:true });
    else Manager.init();
})();
