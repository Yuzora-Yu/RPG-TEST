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
    const REVEAL_START_DELAY_MS = 140;
    const OPTION_LINE_MS = 130;
    const OPTION_SETTLE_MS = 300;
    const TRAIT_NAME_MS = 150;
    const TRAIT_LEVEL_SETTLE_MS = 290;
    const SYNERGY_SETTLE_MS = 420;
    const STEP_GAP_MS = 80;
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

        getStatusEffectLabel(key) {
            if (typeof Menu !== 'undefined' && typeof Menu.getStatusEffectLabel === 'function') {
                return Menu.getStatusEffectLabel(key);
            }
            const labels = {
                Poison:'毒', ToxicPoison:'猛毒', Shock:'感電', Fear:'怯え', Debuff:'弱体',
                InstantDeath:'即死', Seal:'封印', SkillSeal:'特技封印', SpellSeal:'呪文封印', HealSeal:'回復封印'
            };
            return labels[key] || key;
        },

        getSkillName(skillId) {
            const skills = (typeof DB !== 'undefined' && Array.isArray(DB.SKILLS)) ? DB.SKILLS : [];
            return skills.find(skill => Number(skill?.id) === Number(skillId))?.name || `不明(${skillId})`;
        },

        getBaseStats(equip) {
            const labels = {
                hp:'HP', mp:'MP', atk:'攻撃', def:'防御', mag:'魔力', mdef:'魔防', spd:'素早さ',
                hit:'命中', eva:'回避', cri:'会心', finDmg:'与ダメ', finRed:'被ダメ軽減'
            };
            const percentKeys = new Set(['hit','eva','cri','finDmg','finRed']);
            const data = equip?.data && typeof equip.data === 'object' ? equip.data : {};
            const ordered = Object.keys(labels);
            const entries = [];
            const formatSigned = (value) => `${value > 0 ? '+' : ''}${value}`;

            ordered.forEach(key => {
                const value = Number(data[key]);
                if (!Number.isFinite(value) || value === 0) return;
                entries.push(`${labels[key]} ${formatSigned(value)}${percentKeys.has(key) ? '%' : ''}`);
            });

            Object.entries(data).forEach(([key, raw]) => {
                if (ordered.includes(key) || ['elmAtk','elmRes','grantSkills'].includes(key)) return;
                const value = Number(raw);
                if (!Number.isFinite(value) || value === 0) return;
                if (key.startsWith('resists_')) {
                    entries.push(`${Manager.getStatusEffectLabel(key.slice(8))}耐 ${formatSigned(value)}%`);
                    return;
                }
                if (key.startsWith('attack_')) {
                    entries.push(`攻撃時${value}%で${Manager.getStatusEffectLabel(key.slice(7))}`);
                    return;
                }
                entries.push(`${key} ${formatSigned(value)}`);
            });

            const elements = (typeof CONST !== 'undefined' && Array.isArray(CONST.ELEMENTS))
                ? CONST.ELEMENTS
                : Array.from(new Set([
                    ...Object.keys(data.elmAtk || {}),
                    ...Object.keys(data.elmRes || {})
                ]));
            elements.forEach(element => {
                const attack = Number(data.elmAtk?.[element]);
                const resist = Number(data.elmRes?.[element]);
                if (Number.isFinite(attack) && attack !== 0) entries.push(`${element}攻 ${formatSigned(attack)}%`);
                if (Number.isFinite(resist) && resist !== 0) entries.push(`${element}耐 ${formatSigned(resist)}%`);
            });

            const grantSkills = Array.isArray(equip?.grantSkills)
                ? equip.grantSkills
                : (Array.isArray(data.grantSkills) ? data.grantSkills : []);
            if (grantSkills.length) {
                entries.push(`[習得:${grantSkills.map(Manager.getSkillName).join('、')}]`);
            }
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
            const rawUnit = option?.unit ?? rule?.unit ?? '';
            const unit = rawUnit === 'val' ? '' : rawUnit;
            const valueText = Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value}${unit}` : '';
            const rarity = String(option?.rarity || '').toUpperCase();
            return `${element}${label}${valueText ? ` ${valueText}` : ''}${rarity ? ` [${rarity}]` : ''}`;
        },

        normalizeTrait(trait) {
            if (trait && typeof trait === 'object') return { ...trait };
            return { id:Number(trait) || 0, level:1 };
        },

        splitTraits(equip) {
            const all = Array.isArray(equip?.traits) ? equip.traits.map(Manager.normalizeTrait) : [];
            const master = Manager.resolveMaster(equip);
            const base = Array.isArray(master?.traits) ? master.traits.map(Manager.normalizeTrait) : [];
            const remaining = all.map(trait => ({ ...trait }));
            const baseTraits = [];
            base.forEach(masterTrait => {
                const index = remaining.findIndex(trait => Number(trait?.id) === Number(masterTrait?.id));
                if (index >= 0) baseTraits.push(remaining.splice(index, 1)[0]);
            });
            return { baseTraits, additionalTraits:remaining };
        },

        getTraitParts(trait) {
            const normalized = Manager.normalizeTrait(trait);
            const master = typeof PassiveSkill !== 'undefined' ? PassiveSkill.MASTER?.[Number(normalized.id)] : null;
            return {
                name:master?.name || `特性${normalized.id || ''}`,
                level:Math.max(1, Number(normalized.level ?? normalized.lv) || 1)
            };
        },

        getTraitText(trait) {
            const parts = Manager.getTraitParts(trait);
            return `${parts.name} Lv${parts.level}`;
        },

        buildRows(equip) {
            const rows = [];
            (equip?.opts || []).forEach((option, optionIndex) => {
                const rarity = String(option?.rarity || 'N').toUpperCase();
                const color = Manager.getRarityColor(rarity);
                rows.push({
                    kind:'option',
                    optionIndex,
                    color,
                    html:`<span class="equip-acquisition-option-text" style="color:${color}">${escapeHtml(Manager.getOptionText(option))}</span>`
                });
            });
            const optionCount = Array.isArray(equip?.opts) ? equip.opts.length : 0;
            Manager.splitTraits(equip).additionalTraits.forEach((trait, traitIndex) => {
                const parts = Manager.getTraitParts(trait);
                rows.push({
                    kind:'trait',
                    traitIndex,
                    sectionStart:optionCount >= 3 && traitIndex === 0,
                    html:`<span class="equip-acquisition-trait-name">${escapeHtml(parts.name)}</span><span class="equip-acquisition-trait-level"> Lv${parts.level}</span>`
                });
            });
            const calculatedSynergies = typeof App.checkSynergy === 'function' ? App.checkSynergy(equip) : [];
            const synergies = Array.isArray(equip?.synergies) && equip.synergies.length
                ? equip.synergies
                : (Array.isArray(calculatedSynergies) ? calculatedSynergies : []);
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
                #equip-acquisition-card-overlay{position:fixed;inset:0;z-index:2147483600;background:transparent;display:flex;align-items:center;justify-content:center;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));box-sizing:border-box;font-family:'DotGothic16',sans-serif;color:#fff;touch-action:none;overscroll-behavior:contain;-webkit-tap-highlight-color:transparent}
                .equip-acquisition-card-shell{width:min(calc(100vw - 20px),550px);position:relative;isolation:isolate;overflow:visible}
                .equip-acquisition-card-shell::before,.equip-acquisition-card-shell::after{content:"";position:absolute;pointer-events:none;opacity:0;z-index:-1}
                .equip-acquisition-card-shell::before{inset:-14px;border-radius:0;background:radial-gradient(ellipse at 18% 45%,rgba(102,246,255,.82),transparent 46%),radial-gradient(ellipse at 78% 38%,rgba(180,92,255,.76),transparent 49%),radial-gradient(ellipse at 52% 82%,rgba(72,255,176,.55),transparent 56%);background-size:180% 180%;filter:blur(13px);transform:scale(.88)}
                .equip-acquisition-card-shell::after{display:none;inset:-4px;border-radius:0;padding:2px;background:linear-gradient(120deg,rgba(102,246,255,.96),rgba(180,92,255,.94),rgba(72,255,176,.9),rgba(255,112,210,.86),rgba(102,246,255,.96));background-size:300% 300%;filter:blur(1.5px);transform:scale(.96);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
                .equip-acquisition-card-shell.is-synergy::before{animation:equipAcquisitionAuraBloom .42s cubic-bezier(.2,.9,.24,1) both,equipAcquisitionAuraDrift 2.6s ease-in-out .42s infinite alternate}
                .equip-acquisition-card-shell.is-synergy::after{animation:equipAcquisitionAuraRing .42s cubic-bezier(.2,.9,.24,1) both,equipAcquisitionAuraBorderShift 2.8s ease-in-out .42s infinite alternate}
                .equip-acquisition-card{width:100%;max-height:min(70svh,338px);overflow-y:auto;box-sizing:border-box;padding:10px 11px 10px;border:0;border-radius:0;background:rgba(7,7,9,.91);box-shadow:0 6px 18px rgba(0,0,0,.65);position:relative;z-index:1;transition:opacity .12s ease,transform .12s ease}
                #equip-acquisition-card-overlay.is-closing .equip-acquisition-card{opacity:.01;transform:scale(.985)}
                .equip-acquisition-main{display:grid;grid-template-columns:60px minmax(0,1fr);gap:9px;align-items:start}
                .equip-acquisition-image{width:60px;height:60px;background:#050505;border:0;border-radius:0;overflow:hidden;position:relative;box-sizing:border-box;align-self:center}
                .equip-acquisition-image img{display:none;width:100%;height:100%;object-fit:cover}
                .equip-acquisition-image-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px;color:#fff;font-weight:bold;font-size:11px;line-height:1.2;box-sizing:border-box}
                .equip-acquisition-summary{min-width:0;padding-top:1px}
                .equip-acquisition-name-line{display:flex;align-items:center;gap:6px;min-width:0}
                .equip-acquisition-name{font-size:18px;line-height:1.25;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
                .equip-acquisition-rank{font-size:11px;line-height:1;color:#aaa;white-space:nowrap;margin-left:auto;flex-shrink:0}
                .equip-acquisition-base-stats{margin-top:6px;font-size:11px;line-height:1.35;color:#ccc;white-space:normal;overflow-wrap:anywhere}
                .equip-acquisition-base-stats .equip-acquisition-grant-skill{color:#ffff00}
                .equip-acquisition-reveal-list{display:flex;flex-wrap:wrap;gap:3px 9px;margin-top:6px;min-height:1px;line-height:1.3}
                .equip-acquisition-reveal-row{display:none;position:relative;font-size:11px;max-width:100%;overflow:visible;overflow-wrap:anywhere;transform-origin:left center}
                .equip-acquisition-reveal-row.is-present{display:inline-flex;align-items:baseline}
                .equip-acquisition-section-break{flex-basis:100%;width:100%;height:0;margin:0;padding:0}.equip-acquisition-reveal-row.trait.section-start{margin-top:2px}
                .equip-acquisition-reveal-row.synergy{width:100%}.equip-acquisition-reveal-row.synergy strong{margin-right:3px}.equip-acquisition-reveal-row.synergy span{color:#ddd}
                .equip-acquisition-reveal-row.option::before{content:"";position:absolute;left:0;top:50%;width:0;height:1px;background:var(--reveal-color,#fff);box-shadow:0 0 4px var(--reveal-color,#fff),0 0 9px var(--reveal-color,#fff);opacity:0;transform:translateY(-50%);z-index:2}
                .equip-acquisition-reveal-row.option.is-line-active::before{animation:equipAcquisitionOptionLine ${OPTION_LINE_MS}ms ease-out both}
                .equip-acquisition-option-text{display:inline-block;opacity:0;transform:scale(1.34);transform-origin:left center;filter:brightness(1.7)}
                .equip-acquisition-reveal-row.option.is-text-visible .equip-acquisition-option-text{animation:equipAcquisitionOptionPop ${OPTION_SETTLE_MS}ms cubic-bezier(.12,.84,.22,1.18) both}
                .equip-acquisition-trait-name,.equip-acquisition-trait-level{display:inline-block;color:#ffd27a;opacity:0;transform-origin:left center}
                .equip-acquisition-reveal-row.trait.is-name-visible .equip-acquisition-trait-name{animation:equipAcquisitionTraitName .18s ease-out both}
                .equip-acquisition-trait-level{margin-left:2px;transform:scale(1.9)}
                .equip-acquisition-reveal-row.trait.is-level-visible .equip-acquisition-trait-level{animation:equipAcquisitionTraitLevel ${TRAIT_LEVEL_SETTLE_MS}ms cubic-bezier(.12,.88,.2,1.25) both}
                .equip-acquisition-reveal-row.synergy .equip-acquisition-reveal-value{opacity:0;transform:scale(1.2);transform-origin:left center}
                .equip-acquisition-reveal-row.synergy.is-text-visible .equip-acquisition-reveal-value{animation:equipAcquisitionSynergyPop ${SYNERGY_SETTLE_MS}ms cubic-bezier(.12,.82,.2,1.12) both}
                .equip-acquisition-base-traits{font-size:11px;color:#ffd27a;line-height:1.35;margin-top:4px}
                .equip-acquisition-tap-hint{margin-top:8px;padding-top:5px;border-top:1px solid rgba(210,181,95,.32);font-size:10px;line-height:1.25;color:#aaa;text-align:right}
                @keyframes equipAcquisitionOptionLine{0%{width:0;opacity:0}24%{opacity:1}72%{width:100%;opacity:1}100%{width:100%;opacity:0}}
                @keyframes equipAcquisitionOptionPop{0%{opacity:0;transform:scale(1.34);filter:brightness(2)}44%{opacity:1;transform:scale(1.16);filter:brightness(1.65)}100%{opacity:1;transform:scale(1);filter:brightness(1)}}
                @keyframes equipAcquisitionTraitName{0%{opacity:0;transform:translateX(-5px) scale(1.12)}100%{opacity:1;transform:translateX(0) scale(1)}}
                @keyframes equipAcquisitionTraitLevel{0%{opacity:0;transform:scale(1.9);text-shadow:0 0 12px #fff,0 0 18px #ffd27a}45%{opacity:1;transform:scale(1.28);text-shadow:0 0 8px #ffd27a}100%{opacity:1;transform:scale(1);text-shadow:none}}
                @keyframes equipAcquisitionSynergyPop{0%{opacity:0;transform:scale(1.2);filter:brightness(2)}100%{opacity:1;transform:scale(1);filter:brightness(1)}}
                @keyframes equipAcquisitionAuraBloom{0%{opacity:0;transform:scale(.86)}58%{opacity:1;transform:scale(1.05)}100%{opacity:.88;transform:scale(1)}}
                @keyframes equipAcquisitionAuraRing{0%{opacity:0;transform:scale(.9)}100%{opacity:.72;transform:scale(1)}}
                @keyframes equipAcquisitionAuraDrift{0%{background-position:0% 35%;filter:blur(13px) hue-rotate(0deg)}100%{background-position:100% 65%;filter:blur(16px) hue-rotate(38deg)}}
                @keyframes equipAcquisitionAuraBorderShift{0%{background-position:0% 50%;filter:blur(1.5px) hue-rotate(0deg)}100%{background-position:100% 50%;filter:blur(2.2px) hue-rotate(45deg)}}
                @media(max-width:340px){.equip-acquisition-card-shell{width:calc(100vw - 20px)}.equip-acquisition-card{padding:8px}.equip-acquisition-main{grid-template-columns:55px minmax(0,1fr);gap:7px}.equip-acquisition-image{width:55px;height:55px}.equip-acquisition-name{font-size:16px}.equip-acquisition-rank,.equip-acquisition-base-stats,.equip-acquisition-reveal-row,.equip-acquisition-base-traits{font-size:10px}}
                @media(prefers-reduced-motion:reduce){.equip-acquisition-card-shell::before,.equip-acquisition-card-shell::after,.equip-acquisition-reveal-row *{animation-duration:1ms!important;animation-iteration-count:1!important}}
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
            const baseStatsHtml = Manager.getBaseStats(equip).map(text => {
                const isSkill = String(text).startsWith('[習得:');
                return `<span${isSkill ? ' class="equip-acquisition-grant-skill"' : ''}>${escapeHtml(text)}</span>`;
            }).join(' ');
            const revealRowsHtml = rows.map((row, index) => {
                const sectionBreak = row.sectionStart
                    ? '<div class="equip-acquisition-section-break" aria-hidden="true"></div>'
                    : '';
                return `${sectionBreak}<div class="equip-acquisition-reveal-row ${row.kind}${row.sectionStart ? ' section-start' : ''}" data-reveal-index="${index}" data-reveal-kind="${row.kind}"${row.color ? ` style="--reveal-color:${row.color}"` : ''}><div class="equip-acquisition-reveal-value">${row.html}</div></div>`;
            }).join('');
            overlay.innerHTML = `
                <div class="equip-acquisition-card-shell">
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
                                <div class="equip-acquisition-base-stats">${baseStatsHtml}</div>
                                <div class="equip-acquisition-reveal-list">${revealRowsHtml}</div>
                                <div class="equip-acquisition-tap-hint">${rows.length ? '画面タップで演出をスキップ' : '画面タップで閉じる'}</div>
                            </div>
                        </div>
                    </div>
                </div>`;
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

        queueReveal(active, callback, delay) {
            if (!active || active.closing) return null;
            const timer = setTimeout(() => {
                active.revealTimers?.delete(timer);
                if (Manager.active !== active || active.closing || active.revealedAll) return;
                callback();
            }, Math.max(0, Number(delay) || 0));
            active.revealTimers?.add(timer);
            return timer;
        },

        clearRevealTimers(active) {
            if (!active?.revealTimers) return;
            active.revealTimers.forEach(timer => clearTimeout(timer));
            active.revealTimers.clear();
        },

        setRevealHint(active, text) {
            const hint = active?.overlay?.querySelector('.equip-acquisition-tap-hint');
            if (hint) hint.textContent = text;
        },

        finishRevealSequence(active) {
            if (!active || Manager.active !== active) return;
            Manager.clearRevealTimers(active);
            active.revealedAll = true;
            Manager.setRevealHint(active, '画面タップで閉じる');
        },

        revealNext(active) {
            if (!active || Manager.active !== active || active.revealedAll || active.closing) return;
            const row = active.revealRows[active.revealIndex];
            if (!row) {
                Manager.finishRevealSequence(active);
                return;
            }
            const kind = String(row.dataset.revealKind || '');
            row.classList.add('is-present');
            if (kind === 'option') {
                row.classList.add('is-line-active');
                Manager.queueReveal(active, () => row.classList.add('is-text-visible'), OPTION_LINE_MS + 10);
                Manager.queueReveal(active, () => {
                    row.classList.remove('is-line-active');
                    row.classList.add('is-settled');
                    active.revealIndex += 1;
                    Manager.queueReveal(active, () => Manager.revealNext(active), STEP_GAP_MS);
                }, OPTION_LINE_MS + OPTION_SETTLE_MS + 20);
                return;
            }
            if (kind === 'trait') {
                row.classList.add('is-name-visible');
                Manager.queueReveal(active, () => row.classList.add('is-level-visible'), TRAIT_NAME_MS);
                Manager.queueReveal(active, () => {
                    row.classList.add('is-settled');
                    active.revealIndex += 1;
                    Manager.queueReveal(active, () => Manager.revealNext(active), STEP_GAP_MS);
                }, TRAIT_NAME_MS + TRAIT_LEVEL_SETTLE_MS);
                return;
            }
            if (kind === 'synergy') {
                Manager.queueReveal(active, () => {
                    row.classList.add('is-text-visible');
                    active.overlay?.querySelector('.equip-acquisition-card-shell')?.classList.add('is-synergy');
                }, 25);
                Manager.queueReveal(active, () => {
                    row.classList.add('is-settled');
                    active.revealIndex += 1;
                    Manager.finishRevealSequence(active);
                }, SYNERGY_SETTLE_MS);
                return;
            }
            row.classList.add('is-text-visible','is-name-visible','is-level-visible','is-settled');
            active.revealIndex += 1;
            Manager.queueReveal(active, () => Manager.revealNext(active), STEP_GAP_MS);
        },

        startRevealSequence(active) {
            if (!active || Manager.active !== active) return;
            active.revealRows = Array.from(active.overlay.querySelectorAll('.equip-acquisition-reveal-row'));
            active.revealIndex = 0;
            if (!active.revealRows.length) {
                Manager.finishRevealSequence(active);
                return;
            }
            const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
            if (reduceMotion) {
                Manager.skipReveal(active);
                return;
            }
            Manager.queueReveal(active, () => Manager.revealNext(active), REVEAL_START_DELAY_MS);
        },

        skipReveal(active = Manager.active) {
            if (!active || Manager.active !== active || active.revealedAll) return false;
            Manager.clearRevealTimers(active);
            (active.revealRows || []).forEach(row => {
                row.classList.add('is-present','is-text-visible','is-name-visible','is-level-visible','is-settled');
                row.classList.remove('is-line-active');
                if (row.dataset.revealKind === 'synergy') {
                    active.overlay?.querySelector('.equip-acquisition-card-shell')?.classList.add('is-synergy');
                }
            });
            active.revealIndex = active.revealRows?.length || 0;
            active.revealedAll = true;
            active.nextActionAt = Date.now() + INPUT_RELEASE_DELAY_MS;
            Manager.setRevealHint(active, '画面タップで閉じる');
            return true;
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
                const current = Manager.active;
                if (current.closing) return;
                if (event.type === 'keydown') {
                    if (event.repeat || !['Escape', 'Enter', ' '].includes(event.key)) return;
                } else if (!['pointerup', 'touchend', 'mouseup', 'click'].includes(event.type)) {
                    return;
                }
                const now = Date.now();
                if (now < Number(current.nextActionAt || 0)) return;
                current.nextActionAt = now + INPUT_RELEASE_DELAY_MS;
                if (!current.revealedAll) {
                    Manager.skipReveal(current);
                    return;
                }
                Manager.closeActive();
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
                inputGuard:null,
                revealTimers:new Set(),
                revealRows:[],
                revealIndex:0,
                revealedAll:false,
                nextActionAt:0
            };
            document.body.appendChild(overlay);
            Manager.installInputGuard();
            Manager.startRevealSequence(Manager.active);
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
            Manager.clearRevealTimers(active);
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
