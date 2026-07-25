/* guild.js - Adventurer Guild rank, rotating requests, reports, trials and exchange */
(function(global) {
    'use strict';

    const RANKS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];
    const EXP_THRESHOLDS = { G: 0, F: 60, E: 170, D: 340, C: 600, B: 980, A: 1500, S: 2200 };
    const PROMOTION_BOSSES = {
        F: { monsterId: 301000, name: 'バトルリザード' },
        E: { monsterId: 301010, name: '炎楔のグラド' },
        D: { monsterId: 301020, name: '風楔のエリシア' },
        C: { monsterId: 301030, name: '氷楔のシーリス' },
        B: { monsterId: 301040, name: '雷楔のレナード' },
        A: { monsterId: 301050, name: '聖騎士ヴェルド' },
        S: { monsterId: 301070, name: '魔道神官ジャスパー' }
    };
    const EXCHANGE = [
        { id: 'seed_hp', itemId: 100, count: 1, cost: 30 },
        { id: 'seed_mp', itemId: 101, count: 1, cost: 30 },
        { id: 'seed_atk', itemId: 102, count: 1, cost: 35 },
        { id: 'seed_mag', itemId: 103, count: 1, cost: 35 },
        { id: 'seed_spd', itemId: 104, count: 1, cost: 35 },
        { id: 'seed_def', itemId: 105, count: 1, cost: 35 },
        { id: 'seed_sp', itemId: 106, count: 1, cost: 80 },
        { id: 'gem_100', gems: 100, cost: 50 },
        { id: 'gem_500', gems: 500, cost: 220 },
        { id: 'reincarnation', itemId: 107, count: 1, cost: 1200, requiredRank: 'A' }
    ];

    const Guild = {
        maxOffers: 5,
        ranks: RANKS,
        expThresholds: EXP_THRESHOLDS,
        promotionBosses: PROMOTION_BOSSES,
        exchangeEntries: EXCHANGE,

        getDefinitions() {
            return global.GUILD_QUEST_DATA || {};
        },

        rankIndex(rank) {
            const index = RANKS.indexOf(String(rank || 'G').toUpperCase());
            return index >= 0 ? index : 0;
        },

        nextRank(rank) {
            const index = Guild.rankIndex(rank);
            return index < RANKS.length - 1 ? RANKS[index + 1] : null;
        },

        ensureState() {
            if (typeof App === 'undefined' || !App.data) return null;
            if (!App.data.progress) App.data.progress = {};
            const current = App.data.progress.guild;
            if (!current || typeof current !== 'object' || Array.isArray(current)) {
                App.data.progress.guild = {};
            }
            const state = App.data.progress.guild;
            if (!RANKS.includes(state.rank)) state.rank = 'G';
            state.exp = Math.max(0, Math.floor(Number(state.exp) || 0));
            state.points = Math.max(0, Math.floor(Number(state.points) || 0));
            if (!Array.isArray(state.offers)) state.offers = [];
            if (!state.questStates || typeof state.questStates !== 'object' || Array.isArray(state.questStates)) state.questStates = {};
            if (!state.completionCounts || typeof state.completionCounts !== 'object' || Array.isArray(state.completionCounts)) state.completionCounts = {};
            state.refreshCount = Math.max(0, Math.floor(Number(state.refreshCount) || 0));

            if (!state.migrationV1) {
                const legacy = App.data.progress.quests || {};
                Object.keys(Guild.getDefinitions()).forEach(id => {
                    const old = legacy[id];
                    if (!old) return;
                    if (old.state === 'accepted') {
                        state.questStates[id] = JSON.parse(JSON.stringify(old));
                    } else if (old.state === 'completed') {
                        state.completionCounts[id] = Math.max(1, Number(state.completionCounts[id] || 0));
                    }
                    delete legacy[id];
                });
                state.migrationV1 = true;
            }

            return state;
        },

        getQuestState(id) {
            const state = Guild.ensureState();
            return state?.questStates?.[id] || { state: 'available', progress: {} };
        },

        isQuestUnlocked(id) {
            const def = Guild.getDefinitions()[id];
            const state = Guild.ensureState();
            if (!def || !state) return false;
            const flags = App.data?.progress?.flags || {};
            const required = def.requiredRank || 'G';
            const unlockFlags = Array.isArray(def.unlockFlags) ? def.unlockFlags : [];
            return Guild.rankIndex(state.rank) >= Guild.rankIndex(required)
                && unlockFlags.every(flag => !!flags[flag]);
        },

        availableCandidates(exclude = []) {
            const excluded = new Set(exclude);
            const state = Guild.ensureState();
            return Object.keys(Guild.getDefinitions()).filter(id => {
                if (excluded.has(id) || !Guild.isQuestUnlocked(id)) return false;
                return Guild.getQuestState(id).state !== 'accepted';
            }).sort((a, b) => {
                const ca = Number(state.completionCounts[a] || 0);
                const cb = Number(state.completionCounts[b] || 0);
                if (ca !== cb) return ca - cb;
                const da = Guild.getDefinitions()[a];
                const db = Guild.getDefinitions()[b];
                return Guild.rankIndex(da.requiredRank) - Guild.rankIndex(db.requiredRank) || a.localeCompare(b);
            });
        },

        pickCandidates(candidates, count, salt = 0) {
            const pool = [...candidates];
            const picked = [];
            let seed = (Date.now() + Number(salt || 0) * 1103515245) >>> 0;
            while (pool.length && picked.length < count) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                const index = seed % pool.length;
                picked.push(pool.splice(index, 1)[0]);
            }
            return picked;
        },

        ensureOffers(options = {}) {
            const state = Guild.ensureState();
            if (!state) return [];
            const defs = Guild.getDefinitions();
            const accepted = Object.keys(state.questStates).filter(id => state.questStates[id]?.state === 'accepted' && defs[id]);
            const keep = [];
            [...accepted, ...state.offers].forEach(id => {
                if (!defs[id] || keep.includes(id)) return;
                if (Guild.getQuestState(id).state === 'accepted' || Guild.isQuestUnlocked(id)) keep.push(id);
            });
            state.offers = keep.slice(0, Guild.maxOffers);
            const need = Guild.maxOffers - state.offers.length;
            if (need > 0) {
                const candidates = Guild.availableCandidates(state.offers);
                const additions = Guild.pickCandidates(candidates, need, state.refreshCount);
                additions.forEach(id => {
                    state.questStates[id] = { state: 'available', progress: {} };
                    state.offers.push(id);
                });
            }
            if (options.save !== false && typeof App.save === 'function') App.save();
            return state.offers;
        },

        refreshOffers() {
            const state = Guild.ensureState();
            if (!state) return [];
            const accepted = state.offers.filter(id => Guild.getQuestState(id).state === 'accepted');
            const previousAvailable = new Set(state.offers.filter(id => Guild.getQuestState(id).state !== 'accepted'));
            state.refreshCount += 1;
            state.offers = [...accepted];
            let candidates = Guild.availableCandidates(state.offers).filter(id => !previousAvailable.has(id));
            if (candidates.length < Guild.maxOffers - state.offers.length) {
                candidates = Guild.availableCandidates(state.offers);
            }
            Guild.pickCandidates(candidates, Guild.maxOffers - state.offers.length, state.refreshCount).forEach(id => {
                state.questStates[id] = { state: 'available', progress: {} };
                state.offers.push(id);
            });
            Guild.ensureOffers({ save: false });
            App.save();
            return state.offers;
        },

        acceptQuest(id) {
            const state = Guild.ensureState();
            if (!state || !state.offers.includes(id) || !Guild.isQuestUnlocked(id)) return false;
            if (Guild.getQuestState(id).state === 'accepted') return true;
            state.questStates[id] = { state: 'accepted', startedAt: Date.now(), progress: {} };
            App.save();
            return true;
        },

        noteQuestKills(monsterIds = []) {
            if (!Array.isArray(monsterIds) || !monsterIds.length) return [];
            const state = Guild.ensureState();
            if (!state) return [];
            const updated = [];
            Object.entries(state.questStates).forEach(([id, questState]) => {
                if (questState?.state !== 'accepted') return;
                const def = Guild.getDefinitions()[id];
                if (def?.kind !== 'hunt') return;
                const targets = (def.targetMonsterIds || []).map(Number);
                const gained = monsterIds.filter(monsterId => targets.includes(Number(monsterId))).length;
                if (!gained) return;
                if (!questState.progress || typeof questState.progress !== 'object') questState.progress = {};
                questState.progress.kills = Math.min(Number(def.targetCount || 1), Number(questState.progress.kills || 0) + gained);
                updated.push(id);
            });
            if (updated.length) App.save();
            return updated;
        },

        isObjectiveComplete(id) {
            const def = Guild.getDefinitions()[id];
            const state = Guild.getQuestState(id);
            if (!def || state.state !== 'accepted') return false;
            if (def.kind === 'hunt') return Number(state.progress?.kills || 0) >= Math.max(1, Number(def.targetCount || 1));
            if (Array.isArray(def.itemRequirements)) {
                return def.itemRequirements.every(req => Number(App.data?.items?.[Number(req.id ?? req.itemId)] || 0) >= Math.max(1, Number(req.count || 1)));
            }
            return false;
        },

        targetSummary(id) {
            const def = Guild.getDefinitions()[id];
            const state = Guild.getQuestState(id);
            if (!def) return '';
            if (def.kind === 'hunt') {
                const names = (def.targetMonsterIds || []).map(monsterId => App.getQuestMonsterName?.(monsterId) || `モンスター${monsterId}`).join(' / ');
                return `${names}\n${Math.min(Number(def.targetCount || 1), Number(state.progress?.kills || 0))}/${Math.max(1, Number(def.targetCount || 1))}`;
            }
            if (Array.isArray(def.itemRequirements)) {
                return def.itemRequirements.map(req => {
                    const itemId = Number(req.id ?? req.itemId);
                    const item = DB.ITEMS?.find(entry => Number(entry.id) === itemId);
                    const required = Math.max(1, Number(req.count || 1));
                    return `${item?.name || `アイテム${itemId}`}: ${Math.min(required, Number(App.data?.items?.[itemId] || 0))}/${required}`;
                }).join('\n');
            }
            return '';
        },

        rewardSummary(def) {
            const rows = [];
            (def.rewardItems || []).forEach(reward => {
                const itemId = Number(reward.id ?? reward.itemId);
                const item = DB.ITEMS?.find(entry => Number(entry.id) === itemId);
                rows.push(`${item?.name || `アイテム${itemId}`} x${Math.max(1, Number(reward.count || 1))}`);
            });
            rows.push(`ギルド経験値 +${Number(def.guildExp || 0)}`);
            rows.push(`ギルドポイント +${Number(def.guildPoints || 0)}`);
            return rows.join('\n');
        },

        consumeRequirements(def) {
            if (!Array.isArray(def.itemRequirements) || !def.consumeItemsOnComplete) return true;
            if (!def.itemRequirements.every(req => Number(App.data.items?.[Number(req.id ?? req.itemId)] || 0) >= Math.max(1, Number(req.count || 1)))) return false;
            def.itemRequirements.forEach(req => {
                const id = Number(req.id ?? req.itemId);
                const remain = Number(App.data.items[id] || 0) - Math.max(1, Number(req.count || 1));
                if (remain > 0) App.data.items[id] = remain;
                else delete App.data.items[id];
            });
            return true;
        },

        reportQuest(id) {
            const state = Guild.ensureState();
            const def = Guild.getDefinitions()[id];
            if (!state || !def || !Guild.isObjectiveComplete(id) || !Guild.consumeRequirements(def)) return null;
            if (!App.data.items) App.data.items = {};
            (def.rewardItems || []).forEach(reward => {
                const itemId = Number(reward.id ?? reward.itemId);
                App.data.items[itemId] = Number(App.data.items[itemId] || 0) + Math.max(1, Number(reward.count || 1));
            });
            state.exp += Math.max(0, Number(def.guildExp || 0));
            state.points += Math.max(0, Number(def.guildPoints || 0));
            state.completionCounts[id] = Number(state.completionCounts[id] || 0) + 1;
            state.questStates[id] = { state: 'completed', completedAt: Date.now(), progress: {} };
            state.offers = state.offers.filter(offerId => offerId !== id);
            Guild.ensureOffers({ save: false });
            App.save();
            if (typeof MenuStatus !== 'undefined' && typeof MenuStatus.render === 'function') MenuStatus.render();
            return { def, guildExp: Number(def.guildExp || 0), guildPoints: Number(def.guildPoints || 0) };
        },

        currentExpProgress() {
            const state = Guild.ensureState();
            const next = Guild.nextRank(state?.rank);
            if (!state || !next) return { current: state?.exp || 0, required: state?.exp || 0, remaining: 0, next: null };
            const required = EXP_THRESHOLDS[next];
            return { current: state.exp, required, remaining: Math.max(0, required - state.exp), next };
        },

        canTakePromotion() {
            const state = Guild.ensureState();
            const progress = Guild.currentExpProgress();
            return !!(state && progress.next && state.exp >= progress.required);
        },

        startPromotionTrial() {
            const state = Guild.ensureState();
            const next = Guild.nextRank(state?.rank);
            if (!next || !Guild.canTakePromotion()) return false;
            const boss = PROMOTION_BOSSES[next];
            App.data.battle = {
                active: false,
                isBossBattle: true,
                fixedBossId: boss.monsterId,
                preventEscape: true,
                guildPromotionTarget: next
            };
            state.pendingPromotion = next;
            App.save();
            if (typeof Facilities !== 'undefined' && typeof Facilities.closeModal === 'function') Facilities.closeModal('guild-scene');
            App.changeScene('battle');
            return true;
        },

        completePromotionTrial(targetRank) {
            const state = Guild.ensureState();
            const next = Guild.nextRank(state?.rank);
            if (!state || !targetRank || next !== targetRank || state.exp < EXP_THRESHOLDS[targetRank]) return null;
            state.rank = targetRank;
            state.pendingPromotion = null;
            Guild.ensureOffers({ save: false });
            App.save();
            return `${targetRank}ランク昇格試験に合格した！\n冒険者ランクが ${targetRank} になった。`;
        },

        exchange(entryId) {
            const state = Guild.ensureState();
            const entry = EXCHANGE.find(value => value.id === entryId);
            if (!state || !entry || state.points < entry.cost) return false;
            if (entry.requiredRank && Guild.rankIndex(state.rank) < Guild.rankIndex(entry.requiredRank)) return false;
            state.points -= entry.cost;
            if (entry.gems) App.data.gems = Number(App.data.gems || 0) + Number(entry.gems);
            if (entry.itemId) {
                if (!App.data.items) App.data.items = {};
                App.data.items[entry.itemId] = Number(App.data.items[entry.itemId] || 0) + Math.max(1, Number(entry.count || 1));
            }
            App.save();
            return true;
        },

        freeRest() {
            if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('heal_spring');
            (App.data.characters || []).forEach(character => {
                const stats = App.calcStats(character);
                character.currentHp = stats.maxHp;
                character.currentMp = stats.maxMp;
            });
            App.save();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
            Menu.msg('要塞の宿泊所で休んだ。\nＨＰ・ＭＰが全回復した！');
            return true;
        },

        questCard(id, options = {}) {
            const def = Guild.getDefinitions()[id];
            const state = Guild.getQuestState(id);
            if (!def) return '';
            const ready = Guild.isObjectiveComplete(id);
            const status = ready ? '報告可能' : state.state === 'accepted' ? '受注中' : '受注可能';
            const color = ready ? '#8cff9d' : state.state === 'accepted' ? '#ffd56b' : '#b9d9ff';
            return `<button class="btn guild-quest-entry" data-guild-quest-id="${App.escapeHtml(id)}" style="width:100%; text-align:left; margin-top:8px; padding:10px; background:#17191d; border:1px solid #655b43; color:#fff; border-radius:6px;">
                <span style="display:flex; justify-content:space-between; gap:8px;"><strong>${App.escapeHtml(def.name)}</strong><small style="color:${color};">${status}</small></span>
                <span style="display:block; color:#c8b998; font-size:10px; margin-top:4px;">必要ランク ${App.escapeHtml(def.requiredRank || 'G')} / ${App.escapeHtml(App.getQuestKindLabel?.(def.kind) || def.kind)}</span>
                <span style="display:block; color:#aaa; font-size:11px; line-height:1.5; margin-top:5px; white-space:pre-wrap;">${App.escapeHtml(def.objective || '')}</span>
            </button>`;
        },

        showQuestDetail(id) {
            const def = Guild.getDefinitions()[id];
            const state = Guild.getQuestState(id);
            if (!def) return;
            const ready = Guild.isObjectiveComplete(id);
            const offer = state.state !== 'accepted';
            const actionButton = offer ? `<button id="guild-detail-accept" class="menu-btn" style="width:100%; margin-top:12px;">受注する</button>` : '';
            Facilities.showModal('guild-scene', def.name, `
                <div style="font-size:11px; color:#d9bd7d;">必要ランク ${def.requiredRank || 'G'} / ${App.getQuestKindLabel?.(def.kind) || def.kind}</div>
                <div style="font-size:12px; line-height:1.65; margin-top:10px; white-space:pre-wrap;">${App.escapeHtml(state.state === 'accepted' ? (def.progressText || def.objective) : (def.startText || def.objective))}</div>
                <div style="margin-top:10px; padding:9px; border:1px solid #444; white-space:pre-wrap; font-size:11px;">${App.escapeHtml(Guild.targetSummary(id))}</div>
                <div style="margin-top:8px; padding:9px; border:1px solid #5e4d2e; color:#dff0c8; white-space:pre-wrap; font-size:11px;">${App.escapeHtml(Guild.rewardSummary(def))}</div>
                ${ready ? '<div style="color:#8cff9d; margin-top:8px; font-size:11px;">達成済みです。受付職員へ報告してください。</div>' : ''}
                ${actionButton}
            `);
            const accept = document.getElementById('guild-detail-accept');
            if (accept) accept.onclick = () => {
                Guild.acceptQuest(id);
                Facilities.closeModal('guild-scene');
                Guild.openBoard();
            };
        },

        openBoard() {
            const scene = document.getElementById('guild-scene');
            if (!scene || scene.style.display === 'none') App.changeScene('guild');
            const state = Guild.ensureState();
            Guild.ensureOffers({ save: false });
            const html = state.offers.map(id => Guild.questCard(id)).join('');
            Facilities.showModal('guild-scene', '依頼掲示板', `
                <div style="font-size:11px; color:#aaa;">依頼は最大5件。更新しても受注中の依頼は残ります。</div>
                ${html || '<div style="padding:16px; color:#888;">現在紹介できる依頼はありません。</div>'}
                <button id="guild-board-refresh" class="menu-btn" style="width:100%; margin-top:12px;">依頼を更新する</button>
            `);
            document.querySelectorAll('.guild-quest-entry').forEach(button => {
                button.onclick = () => Guild.showQuestDetail(button.dataset.guildQuestId);
            });
            const refresh = document.getElementById('guild-board-refresh');
            if (refresh) refresh.onclick = () => { Guild.refreshOffers(); Guild.openBoard(); };
        },

        openReportMenu() {
            const state = Guild.ensureState();
            const accepted = Object.keys(state.questStates).filter(id => state.questStates[id]?.state === 'accepted');
            const rows = accepted.map(id => {
                const def = Guild.getDefinitions()[id];
                const ready = Guild.isObjectiveComplete(id);
                return `<button class="btn guild-report-entry" data-guild-quest-id="${App.escapeHtml(id)}" ${ready ? '' : 'disabled'} style="width:100%; text-align:left; margin-top:8px; padding:10px; background:${ready ? '#263b25' : '#222'}; border:1px solid ${ready ? '#79c878' : '#444'}; color:${ready ? '#fff' : '#777'};">
                    <strong>${App.escapeHtml(def?.name || id)}</strong><span style="float:right; font-size:10px;">${ready ? '報告する' : '未達成'}</span>
                    <span style="display:block; clear:both; font-size:10px; margin-top:5px; white-space:pre-wrap;">${App.escapeHtml(Guild.targetSummary(id))}</span>
                </button>`;
            }).join('');
            Facilities.showModal('guild-scene', '依頼の報告', rows || '<div style="padding:18px; color:#888; text-align:center;">受注中の依頼はありません。</div>');
            document.querySelectorAll('.guild-report-entry:not([disabled])').forEach(button => {
                button.onclick = () => {
                    const result = Guild.reportQuest(button.dataset.guildQuestId);
                    if (!result) return;
                    Guild.initFacility();
                    Facilities.showModal('guild-scene', '報告完了', `<div style="line-height:1.7;">${App.escapeHtml(result.def.completeText || '依頼を達成した。')}<br><br><span style="color:#ffd56b;">ギルド経験値 +${result.guildExp}<br>ギルドポイント +${result.guildPoints}</span></div>`);
                };
            });
        },

        openTrialMenu() {
            const state = Guild.ensureState();
            const progress = Guild.currentExpProgress();
            if (!progress.next) {
                Facilities.showModal('guild-scene', '昇格試験', '<div style="padding:18px; text-align:center; color:#ffd56b;">すでに最高ランクです。</div>');
                return;
            }
            const boss = PROMOTION_BOSSES[progress.next];
            const ready = Guild.canTakePromotion();
            Facilities.showModal('guild-scene', '昇格試験', `
                <div style="line-height:1.7;">次のランク: <b style="color:#ffd56b;">${progress.next}</b><br>必要経験値: ${progress.required}<br>現在経験値: ${state.exp}</div>
                <div style="margin-top:10px; padding:10px; border:1px solid #555;">試験内容: ${App.escapeHtml(boss.name)}とのボス戦<br><small style="color:#f88;">この戦闘からは逃げられません。</small></div>
                <button id="guild-trial-start" class="menu-btn" ${ready ? '' : 'disabled'} style="width:100%; margin-top:12px;">${ready ? '試験を受ける' : `あと ${progress.remaining} 経験値必要`}</button>
            `);
            const start = document.getElementById('guild-trial-start');
            if (start && ready) start.onclick = () => Guild.startPromotionTrial();
        },

        exchangeName(entry) {
            if (entry.gems) return `${entry.gems} GEM`;
            const item = DB.ITEMS?.find(value => Number(value.id) === Number(entry.itemId));
            return `${item?.name || `アイテム${entry.itemId}`} x${entry.count || 1}`;
        },

        openExchangeMenu() {
            const state = Guild.ensureState();
            const rows = EXCHANGE.map(entry => {
                const locked = entry.requiredRank && Guild.rankIndex(state.rank) < Guild.rankIndex(entry.requiredRank);
                const affordable = state.points >= entry.cost && !locked;
                return `<button class="btn guild-exchange-entry" data-exchange-id="${entry.id}" ${affordable ? '' : 'disabled'} style="width:100%; display:flex; justify-content:space-between; padding:10px; margin-top:7px; background:#202020; border:1px solid #555; color:${affordable ? '#fff' : '#777'};">
                    <span>${App.escapeHtml(Guild.exchangeName(entry))}${locked ? ` <small>(${entry.requiredRank}ランク)</small>` : ''}</span><strong>${entry.cost} GP</strong>
                </button>`;
            }).join('');
            Facilities.showModal('guild-scene', 'ギルドポイント交換', `<div style="color:#ffd56b;">所持: ${state.points} GP</div>${rows}`);
            document.querySelectorAll('.guild-exchange-entry:not([disabled])').forEach(button => {
                button.onclick = () => {
                    const entry = EXCHANGE.find(value => value.id === button.dataset.exchangeId);
                    if (!Guild.exchange(button.dataset.exchangeId)) return;
                    Guild.initFacility();
                    Menu.msg(`${Guild.exchangeName(entry)}と交換した！`, () => Guild.openExchangeMenu());
                };
            });
        },

        initFacility() {
            const state = Guild.ensureState();
            if (!state || typeof Facilities === 'undefined') return;
            Guild.ensureOffers({ save: false });
            const progress = Guild.currentExpProgress();
            const commands = `
                <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Guild.openReportMenu()">報告する</button>
                <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Guild.openTrialMenu()">試験を受ける</button>
                <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff; grid-column:span 2;" onclick="Guild.openExchangeMenu()">交換する</button>`;
            Facilities.setupBaseLayout('guild-scene', 'ライザーク冒険者ギルド', 'facility_bg_guild', commands, "App.changeScene('field')");
            const body = document.getElementById('guild-scene-msg-content');
            if (body) body.innerHTML = `
                「依頼の受注は掲示板、達成報告はこちらで承ります」<br><br>
                <div style="border:1px solid #665438; padding:10px; background:rgba(20,12,4,.7);">
                    <div style="display:flex; justify-content:space-between;"><span>冒険者ランク</span><strong style="font-size:24px; color:#ffd56b;">${state.rank}</strong></div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px;"><span>ギルド経験値</span><strong>${state.exp}${progress.next ? ` / ${progress.required}` : ''}</strong></div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px;"><span>次のランクまで</span><strong>${progress.next ? `${progress.remaining} EXP` : '最高ランク'}</strong></div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px;"><span>ギルドポイント</span><strong style="color:#9cf;">${state.points} GP</strong></div>
                </div>`;
        }
    };

    global.Guild = Guild;

    if (typeof App !== 'undefined') {
        App.getGuildQuestDefinitions = () => Guild.getDefinitions();
        App.getGuildQuestState = id => Guild.getQuestState(id);
        App.isGuildQuestObjectiveComplete = id => Guild.isObjectiveComplete(id);
    }
})(typeof window !== 'undefined' ? window : globalThis);
