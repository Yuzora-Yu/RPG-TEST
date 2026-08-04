/* ========================================================================== 
   +3装備取得カード
   - 新規取得した+3装備だけを、既存ログ・会話・購入結果の後に表示する。
   - 装備は先に所持品へ確定し、未処理UIDをセーブデータへ保存する。
   ========================================================================== */

(() => {
    'use strict';

    const STATE_KEY = 'equipAcquisitionCardsV1';
    const HANDLED_LIMIT = 300;
    const MIN_SHOW_DELAY_MS = 2050;
    const STEP_DELAY_MS = 150;

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));

    const Manager = {
        active: null,
        timer: null,
        revealTimers: [],
        keyHandler: null,
        achievementHookInstalled: false,

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
            const cleanName = String(equip?.name || '').replace(/^真・/, '').replace(/・改(?=\+?\d*$)/, '').replace(/\+\d+$/, '');
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
            const state = Manager.ensureState();
            if (!state) return false;
            const uid = Manager.ensureEquipIdentity(equip);
            if (!uid || state.handled[uid] || state.pending.some(entry => String(entry.uid) === uid)) return false;
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
            if (!state) return;
            state.pending = state.pending.filter(entry => String(entry.uid) !== String(uid));
            state.handled[String(uid)] = { status:String(status || 'kept'), at:Date.now() };
            const keys = Object.keys(state.handled).sort((a, b) => Number(state.handled[b]?.at || 0) - Number(state.handled[a]?.at || 0));
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
            if (openFacilityModal) return false;
            return true;
        },

        schedule(delay = 350) {
            if (Manager.timer) clearTimeout(Manager.timer);
            Manager.timer = setTimeout(() => {
                Manager.timer = null;
                Manager.pump();
            }, Math.max(0, Number(delay) || 0));
        },

        pump() {
            Manager.installAchievementHook();
            const state = Manager.ensureState();
            if (!state || Manager.active || state.pending.length === 0) return;
            const entry = state.pending[0];
            if (String(entry?.source || '') === 'shop') {
                if (typeof App.runAtomicSaveMutation === 'function') {
                    App.runAtomicSaveMutation(() => { Manager.removePending(entry.uid, 'shop-skipped'); return { ok:true }; });
                } else {
                    Manager.removePending(entry.uid, 'shop-skipped');
                    App.save?.();
                }
                Manager.schedule(100);
                return;
            }
            const owned = Manager.findOwnedEquip(entry.uid);
            if (!owned) {
                const committed = typeof App.runAtomicSaveMutation === 'function'
                    ? App.runAtomicSaveMutation(() => { Manager.removePending(entry.uid, 'missing'); return { ok:true }; })
                    : null;
                if (!committed && typeof App.save === 'function') {
                    Manager.removePending(entry.uid, 'missing');
                    App.save();
                }
                Manager.schedule(100);
                return;
            }
            const wait = Math.max(0, Number(entry.earliestAt || 0) - Date.now());
            if (wait > 0 || !Manager.isSafeToShow()) {
                Manager.schedule(Math.max(250, Math.min(900, wait || 500)));
                return;
            }
            Manager.show(entry, owned.equip);
        },

        getSellPrice(equip) {
            if (typeof Facilities !== 'undefined' && typeof Facilities.getEquipSellPrice === 'function') {
                return Math.max(1, Math.floor(Number(Facilities.getEquipSellPrice(equip)) || 1));
            }
            return Math.max(1, Math.floor(Number(equip?.val || 0) / 2));
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
            return ({ N:'#a0a0a0', R:'#40e040', SR:'#40e0e0', SSR:'#ff4444', UR:'#e040e0', EX:'#ffff00' })[String(rarity || 'N').toUpperCase()] || '#fff';
        },

        getOptionText(option) {
            const rule = (typeof DB !== 'undefined' && Array.isArray(DB.OPT_RULES))
                ? DB.OPT_RULES.find(entry => entry.key === option?.key && (!option?.elm || entry.elm === option.elm))
                : null;
            const label = option?.label || rule?.name || option?.key || '追加効果';
            const element = option?.elm && !String(label).includes(String(option.elm)) ? `${option.elm} ` : '';
            const value = Number(option?.val);
            const valueText = Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value}${option?.unit ?? rule?.unit ?? ''}` : '';
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

        buildStages(equip) {
            const stages = [];
            (equip?.opts || []).forEach((option) => {
                const rarity = String(option?.rarity || 'N').toUpperCase();
                stages.push({
                    kind:'option',
                    label:'',
                    html:`<span style="color:${Manager.getRarityColor(rarity)}">${escapeHtml(Manager.getOptionText(option))}</span>`
                });
            });
            const traits = Manager.splitTraits(equip).additionalTraits;
            if (traits.length) stages.push({
                kind:'trait', label:'',
                html:`<span class="equip-acquisition-trait-text">特性: ${traits.map(trait => escapeHtml(Manager.getTraitText(trait))).join('・')}</span>`
            });
            const synergies = Array.isArray(equip?.synergies) && equip.synergies.length
                ? equip.synergies
                : (typeof App.checkSynergy === 'function' ? App.checkSynergy(equip) : []);
            if (synergies.length) stages.push({
                kind:'synergy', label:'',
                html:synergies.map(syn => `<strong style="color:${escapeHtml(syn.color || '#fff3a5')}">${escapeHtml(syn.name || '共鳴')}</strong>${syn.desc ? `<span> ${escapeHtml(syn.desc)}</span>` : ''}`).join('　')
            });
            return stages;
        },

        createOverlay(entry, equip) {
            const overlay = document.createElement('div');
            overlay.id = 'equip-acquisition-card-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            const nameColor = Manager.getRarityColor(equip?.rarity || 'N');
            overlay.innerHTML = `
                <div class="equip-acquisition-card" aria-label="+3装備取得">
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
                        </div>
                    </div>
                    <div class="equip-acquisition-reveal-list"></div>
                    <div class="equip-acquisition-base-traits"></div>
                    <div class="equip-acquisition-actions" hidden>
                        <button type="button" data-action="keep">保管</button>
                        <button type="button" data-action="sell">売却 ${Manager.getSellPrice(equip).toLocaleString()}</button>
                    </div>
                </div>`;

            const card = overlay.querySelector('.equip-acquisition-card');
            const image = overlay.querySelector('img');
            const fallback = overlay.querySelector('.equip-acquisition-image-fallback');
            const eid = Number(equip.eid ?? equip.masterEid ?? entry.eid) || 0;
            if (eid > 0) {
                image.onload = () => { image.style.display = 'block'; fallback.style.display = 'none'; };
                image.onerror = () => { image.removeAttribute('src'); image.style.display = 'none'; fallback.style.display = 'flex'; };
                image.src = `assets/equips/${eid}.png`;
            }

            const baseTraits = Manager.splitTraits(equip).baseTraits;
            if (baseTraits.length) {
                overlay.querySelector('.equip-acquisition-base-traits').innerHTML =
                    `特性: ${baseTraits.map(trait => escapeHtml(Manager.getTraitText(trait))).join('・')}`;
            }

            overlay.addEventListener('click', event => {
                const action = event.target.closest('[data-action]')?.dataset.action;
                if (action === 'sell') { event.stopPropagation(); Manager.sellActive(); return; }
                if (action === 'keep') { event.stopPropagation(); Manager.keepActive(); return; }
                if (!Manager.active?.revealedAll) { Manager.revealAll(); return; }
                if (event.target === overlay) Manager.keepActive();
            });
            card.addEventListener('click', event => {
                if (!event.target.closest('button') && !Manager.active?.revealedAll) Manager.revealAll();
            });
            return overlay;
        },

        injectStyle() {
            if (document.getElementById('equip-acquisition-card-style')) return;
            const style = document.createElement('style');
            style.id = 'equip-acquisition-card-style';
            style.textContent = `
                #equip-acquisition-card-overlay{position:fixed;inset:0;z-index:2147483600;background:transparent;display:flex;align-items:center;justify-content:center;padding:max(6px,env(safe-area-inset-top)) max(6px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));box-sizing:border-box;font-family:'DotGothic16',sans-serif;color:#fff;touch-action:manipulation}
                .equip-acquisition-card{width:min(calc(100vw - 12px),320px);max-height:min(52svh,230px);overflow-y:auto;box-sizing:border-box;padding:8px 9px 9px;border:1px solid #d2b55f;border-radius:9px;background:rgba(7,7,9,.88);box-shadow:0 0 0 2px rgba(0,0,0,.88),0 5px 14px rgba(0,0,0,.65);position:relative}
                .equip-acquisition-main{display:grid;grid-template-columns:48px minmax(0,1fr);gap:7px;align-items:start}
                .equip-acquisition-image{width:48px;height:48px;background:#050505;border:1px solid #666;border-radius:5px;overflow:hidden;position:relative;box-sizing:border-box}
                .equip-acquisition-image img{display:none;width:100%;height:100%;object-fit:cover}
                .equip-acquisition-image-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:3px;color:#fff;font-weight:bold;font-size:9px;line-height:1.2;box-sizing:border-box}
                .equip-acquisition-summary{min-width:0;padding-top:1px}
                .equip-acquisition-name-line{display:flex;align-items:center;gap:5px;min-width:0}
                .equip-acquisition-name{font-size:14px;line-height:1.25;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
                .equip-acquisition-rank{font-size:9px;line-height:1;color:#aaa;white-space:nowrap;margin-left:auto;flex-shrink:0}
                .equip-acquisition-base-stats{margin-top:5px;font-size:9px;line-height:1.35;color:#ccc;white-space:normal;overflow-wrap:anywhere}
                .equip-acquisition-reveal-list{display:flex;flex-wrap:wrap;gap:2px 7px;margin-top:5px;min-height:1px;line-height:1.3}
                .equip-acquisition-reveal-row{opacity:0;transform:translateY(2px);font-size:9px;transition:opacity .09s ease,transform .09s ease;max-width:100%;overflow-wrap:anywhere}.equip-acquisition-reveal-row.is-visible{opacity:1;transform:none}
                .equip-acquisition-reveal-label{display:none}.equip-acquisition-reveal-value{font-size:9px;line-height:1.35}.equip-acquisition-reveal-row.synergy{width:100%}.equip-acquisition-reveal-row.synergy strong{margin-right:2px}.equip-acquisition-reveal-row.synergy span{color:#ddd}
                .equip-acquisition-base-traits,.equip-acquisition-trait-text{font-size:9px;color:#ffd27a;line-height:1.35}.equip-acquisition-base-traits{margin-top:3px}
                .equip-acquisition-card.is-synergy{animation:equipAcquisitionGlow .85s ease-in-out infinite alternate}
                @keyframes equipAcquisitionGlow{from{box-shadow:0 0 0 2px rgba(0,0,0,.88),0 5px 14px rgba(0,0,0,.65),0 0 3px rgba(255,233,138,.18)}to{box-shadow:0 0 0 2px rgba(0,0,0,.88),0 5px 14px rgba(0,0,0,.65),0 0 12px rgba(255,233,138,.68)}}
                .equip-acquisition-actions[hidden]{display:none}.equip-acquisition-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:7px}.equip-acquisition-actions button{height:38px;border:1px solid #c9b271;border-radius:6px;background:rgba(9,9,10,.82);color:#fff;font-family:inherit;font-size:13px;font-weight:bold}.equip-acquisition-actions button[data-action="sell"]{color:#ffd889}
                @media(max-width:340px){.equip-acquisition-card{width:calc(100vw - 10px);padding:7px}.equip-acquisition-main{grid-template-columns:44px minmax(0,1fr)}.equip-acquisition-image{width:44px;height:44px}.equip-acquisition-name{font-size:13px}.equip-acquisition-actions button{height:36px}}
            `;
            document.head.appendChild(style);
        },

        show(entry, equip) {
            Manager.injectStyle();
            if (typeof Field !== 'undefined' && typeof Field.stopMove === 'function') Field.stopMove();
            const overlay = Manager.createOverlay(entry, equip);
            document.body.appendChild(overlay);
            const stages = Manager.buildStages(equip);
            Manager.active = { entry, equip, overlay, stages, nextIndex:0, revealedAll:false };
            Manager.keyHandler = event => {
                if (!Manager.active) return;
                if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    if (!Manager.active.revealedAll) Manager.revealAll();
                    else if (event.key === 'Escape') Manager.keepActive();
                } else if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            };
            window.addEventListener('keydown', Manager.keyHandler, true);
            if (!stages.length) {
                Manager.revealAll();
            } else {
                Manager.revealTimers.push(setTimeout(() => Manager.revealNext(), 180));
            }
        },

        revealNext() {
            const active = Manager.active;
            if (!active || active.nextIndex >= active.stages.length) {
                Manager.finishReveal();
                return;
            }
            const stage = active.stages[active.nextIndex++];
            const row = document.createElement('div');
            row.className = `equip-acquisition-reveal-row ${stage.kind}`;
            row.innerHTML = `<span class="equip-acquisition-reveal-label">${escapeHtml(stage.label)}</span><div class="equip-acquisition-reveal-value">${stage.html}</div>`;
            active.overlay.querySelector('.equip-acquisition-reveal-list').appendChild(row);
            requestAnimationFrame(() => row.classList.add('is-visible'));
            if (stage.kind === 'synergy') active.overlay.querySelector('.equip-acquisition-card').classList.add('is-synergy');
            if (active.nextIndex >= active.stages.length) {
                Manager.revealTimers.push(setTimeout(() => Manager.finishReveal(), STEP_DELAY_MS));
            } else {
                Manager.revealTimers.push(setTimeout(() => Manager.revealNext(), STEP_DELAY_MS));
            }
        },

        revealAll() {
            const active = Manager.active;
            if (!active) return;
            Manager.revealTimers.forEach(clearTimeout);
            Manager.revealTimers = [];
            while (active.nextIndex < active.stages.length) {
                const stage = active.stages[active.nextIndex++];
                const row = document.createElement('div');
                row.className = `equip-acquisition-reveal-row ${stage.kind} is-visible`;
                row.innerHTML = `<span class="equip-acquisition-reveal-label">${escapeHtml(stage.label)}</span><div class="equip-acquisition-reveal-value">${stage.html}</div>`;
                active.overlay.querySelector('.equip-acquisition-reveal-list').appendChild(row);
                if (stage.kind === 'synergy') active.overlay.querySelector('.equip-acquisition-card').classList.add('is-synergy');
            }
            Manager.finishReveal();
        },

        finishReveal() {
            const active = Manager.active;
            if (!active || active.revealedAll) return;
            active.revealedAll = true;
            const actions = active.overlay.querySelector('.equip-acquisition-actions');
            if (actions) actions.hidden = false;
        },

        commitActive(status, mutation) {
            const active = Manager.active;
            if (!active) return false;
            let committed = null;
            if (typeof App.runAtomicSaveMutation === 'function') {
                committed = App.runAtomicSaveMutation(() => {
                    const result = mutation ? mutation() : { ok:true };
                    if (result && result.ok === false) return result;
                    Manager.removePending(active.entry.uid, status);
                    return { ok:true, result };
                });
                if (!committed?.ok) {
                    App.showMessage?.('保存できなかったため、処理を取り消しました。');
                    return false;
                }
            } else {
                const result = mutation ? mutation() : { ok:true };
                if (result && result.ok === false) return false;
                Manager.removePending(active.entry.uid, status);
                if (typeof App.save === 'function' && App.save() === false) return false;
            }
            Manager.closeActive();
            return true;
        },

        keepActive() {
            return Manager.commitActive('kept');
        },

        sellActive() {
            const active = Manager.active;
            if (!active) return false;
            const price = Manager.getSellPrice(active.equip);
            return Manager.commitActive('sold', () => {
                const owned = Manager.findOwnedEquip(active.entry.uid);
                if (!owned) return { ok:true, missing:true };
                if (owned.inventoryIndex >= 0) App.data.inventory.splice(owned.inventoryIndex, 1);
                else if (owned.owner && owned.part) owned.owner.equips[owned.part] = null;
                App.data.gold = Math.max(0, Number(App.data.gold) || 0) + price;
                return { ok:true, price };
            });
        },

        closeActive() {
            const active = Manager.active;
            if (!active) return;
            Manager.revealTimers.forEach(clearTimeout);
            Manager.revealTimers = [];
            if (Manager.keyHandler) window.removeEventListener('keydown', Manager.keyHandler, true);
            Manager.keyHandler = null;
            active.overlay?.remove();
            Manager.active = null;
            App.updateHUD?.();
            Manager.schedule(220);
        },

        init() {
            Manager.installAchievementHook();
            Manager.schedule(900);
            setInterval(() => {
                Manager.installAchievementHook();
                if (!Manager.active) Manager.pump();
            }, 900);
        }
    };

    window.EquipAcquisitionCard = Manager;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Manager.init(), { once:true });
    else Manager.init();
})();
