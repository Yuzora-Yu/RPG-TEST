/* abyss_battle.js - battle mechanics for the Abyss world finale and elemental spirits. */
(() => {
    'use strict';
    if (!globalThis.Battle || !globalThis.App) return;

    const VAGNASIS_IDS = new Set([512001,512002,512003,512004,512005]);
    const AZELGARAG_IDS = new Set([512100,512101]);
    const OCTAPRISM_ID = 701008;
    const SEALED_SKILL_IDS = Object.freeze([166,245,700101]);
    const unitId = unit => Number(unit?.baseId || unit?.id || 0);
    const battleIds = () => {
        const raw = App.data?.battle?.fixedBossId;
        return (Array.isArray(raw) ? raw : [raw]).map(Number).filter(Number.isFinite);
    };
    const ensureStatus = unit => {
        unit.battleStatus = unit.battleStatus || {buffs:{},debuffs:{},ailments:{}};
        unit.battleStatus.buffs = unit.battleStatus.buffs || {};
        unit.battleStatus.debuffs = unit.battleStatus.debuffs || {};
        unit.battleStatus.ailments = unit.battleStatus.ailments || {};
        return unit.battleStatus;
    };
    const storyScripts = globalThis.STORY_MANAGER_DATA?.scripts;

    const queueConversation = scriptKey => {
        if (!scriptKey || !globalThis.StoryManager?.showConversation) return;
        if (Battle.abyssCutsceneAutoBefore === undefined) {
            Battle.abyssCutsceneAutoBefore = !!Battle.auto;
            Battle.auto = false;
            Battle.updateAutoButton?.();
        }
        const previous = Battle.abyssPendingBattleEvent || Promise.resolve();
        Battle.abyssPendingBattleEvent = previous.then(async () => {
            Battle.phase = 'battle_event';
            await StoryManager.showConversation(scriptKey);
            StoryManager.endConversation();
        });
    };

    Battle.awaitPendingBattleEvent = async () => {
        const pending = Battle.abyssPendingBattleEvent;
        if (!pending) return;
        try {
            await pending;
        } finally {
            Battle.abyssPendingBattleEvent = null;
            const restoreAuto = Battle.abyssCutsceneAutoBefore;
            Battle.abyssCutsceneAutoBefore = undefined;
            if (restoreAuto !== undefined) {
                Battle.auto = !!restoreAuto;
                Battle.updateAutoButton?.();
            }
        }
    };

    const originalStartInputPhase = Battle.startInputPhase.bind(Battle);
    Battle.startInputPhase = () => {
        const opening = Battle.abyssOpeningConversation;
        if (!opening) return originalStartInputPhase();
        Battle.abyssOpeningConversation = null;
        queueConversation(opening);
        Battle.awaitPendingBattleEvent().then(() => {
            if (Battle.active) originalStartInputPhase();
        });
    };

    const originalInit = Battle.init.bind(Battle);
    Battle.init = () => {
        const ids = battleIds();
        const isVagnasis = ids.some(id => VAGNASIS_IDS.has(id));
        const blessings = App.data?.progress?.abyssSpiritBlessings || {};
        const recognized = ['火','水','風','雷','光','闇'].filter(element => blessings[element]);
        if (App.data?.battle) {
            App.data.battle.abyssSpiritFinalBlessing = isVagnasis && recognized.length > 0;
            if (!isVagnasis) delete App.data.battle.abyssSpiritFinalBlessing;
        }
        if (isVagnasis && recognized.length > 0 && storyScripts) {
            storyScripts.ABYSS_SPIRIT_FINAL_BLESSING = [
                {name:'システム',text:`${recognized.join('・')}のプリズムが呼応し、認められた精霊の光が一行を包んだ。`},
                {name:'シャニー',text:'精霊たちが、この戦いだけ力を重ねてくれている。\n五つの属性を恐れず、魂の結び目を断とう。',charId:306}
            ];
            Battle.abyssOpeningConversation = 'ABYSS_SPIRIT_FINAL_BLESSING';
        }
        Battle.abyssPendingBattleEvent = null;
        Battle.abyssCutsceneAutoBefore = undefined;
        return originalInit();
    };

    const originalTryGuts = Battle.tryGutsSurvive.bind(Battle);
    Battle.tryGutsSurvive = (unit, hpBeforeDamage) => {
        if (originalTryGuts(unit, hpBeforeDamage)) return true;
        const level = Number(unit?.gutsLevel || Battle.getMonsterBaseById?.(unitId(unit))?.gutsLevel || 0);
        if (VAGNASIS_IDS.has(unitId(unit)) && Number(hpBeforeDamage) >= 2 && level > 0) {
            const chance = Math.min(78, 18 + level * 5);
            if (Math.random() * 100 < chance) {
                unit.hp = 1;
                Battle.log(`${unit.name}は深淵の根性で踏みとどまった！`);
                return true;
            }
        }
        return false;
    };

    const applyOctaprismToEnemy = enemy => {
        if (!enemy || !AZELGARAG_IDS.has(unitId(enemy))) return;
        const status = ensureStatus(enemy);
        ['atk','def','spd','mag','mdef'].forEach(key => {
            status.debuffs[key] = {val:0.7,turns:null,source:'octaprism'};
        });
        enemy.abyssSealedSkillIds = [...SEALED_SKILL_IDS];
    };

    const originalDecideEnemyAction = Battle.decideEnemyAction.bind(Battle);
    Battle.decideEnemyAction = enemy => {
        const sealed = new Set([
            ...(enemy?.abyssSealedSkillIds || []),
            ...(App.data?.battle?.abyssSealedSkillIds || [])
        ].map(Number));
        if (!sealed.size) return originalDecideEnemyAction(enemy);
        const acts = enemy.acts;
        enemy.acts = (acts || []).filter(action => !sealed.has(Number(typeof action === 'object' ? action.id : action)));
        const result = originalDecideEnemyAction(enemy);
        enemy.acts = acts;
        return result;
    };

    const originalUpdateDeadState = Battle.updateDeadState.bind(Battle);
    Battle.updateDeadState = () => {
        // First form never enters the normal death pipeline. It is replaced in-place by the final form.
        const phaseIndex = (Battle.enemies || []).findIndex(enemy => unitId(enemy) === 512100 && Number(enemy.hp || 0) <= 0 && !enemy.abyssPhaseTransitioned);
        if (phaseIndex >= 0) {
            const old = Battle.enemies[phaseIndex];
            old.abyssPhaseTransitioned = true;
            const base = Battle.getMonsterBaseById?.(512101) || globalThis.MonsterData?.getMonsterById?.(512101);
            const finalForm = base ? Battle.createMonsterFromBase(base, {isBossBattle:true,name:base.name}) : null;
            if (finalForm) {
                if (App.data?.battle?.abyssOctaprismUsed) applyOctaprismToEnemy(finalForm);
                Battle.enemies[phaseIndex] = finalForm;
                App.data.battle.fixedBossId = 512101;
                App.data.battle.abyssAzelgaragPhase = 2;
                Battle.party.forEach(member => {
                    if (!member) return;
                    member.isDead = false;
                    member.hp = Math.max(1, Number(member.baseMaxHp || member.hp || 1));
                    member.mp = Math.max(0, Number(member.baseMaxMp || member.mp || 0));
                    const status = ensureStatus(member);
                    ['atk','def','spd','mag','mdef'].forEach(key => {
                        status.buffs[key] = {val:1.3,turns:null,source:'light_god'};
                    });
                });
                queueConversation('ABYSS_AZELGARAG_TRANSFORM');
                Battle.log('光の神の加護が一行を満たした！');
            }
        }

        const aliveBefore = new Set((Battle.enemies || [])
            .filter(enemy => VAGNASIS_IDS.has(unitId(enemy)) && !enemy.isDead && !enemy.isFled)
            .map(enemy => enemy));
        originalUpdateDeadState();
        const newlyFallen = (Battle.enemies || []).filter(enemy =>
            VAGNASIS_IDS.has(unitId(enemy)) && aliveBefore.has(enemy) && enemy.isDead && !enemy.abyssFallHandled
        );
        newlyFallen.forEach(enemy => {
            enemy.abyssFallHandled = true;
            const remaining = Battle.enemies.filter(other => VAGNASIS_IDS.has(unitId(other)) && !other.isDead && !other.isFled && Number(other.hp || 0) > 0);
            remaining.forEach(other => {
                other.baseMaxHp = Math.max(1, Math.floor(Number(other.baseMaxHp || other.hp || 1) * 1.18));
                other.baseMaxMp = Math.max(0, Math.floor(Number(other.baseMaxMp || other.mp || 0) * 1.12));
                other.hp = other.baseMaxHp;
                other.mp = other.baseMaxMp;
                ['atk','def','spd','mag','mdef'].forEach(key => {
                    if (other.baseStats?.[key] !== undefined) other.baseStats[key] = Math.max(1, Math.floor(Number(other.baseStats[key]) * 1.18));
                    if (other[key] !== undefined) other[key] = Math.max(1, Math.floor(Number(other[key]) * 1.18));
                });
            });
            const order = Number(enemy.linkedDeathIndex ?? Battle.getMonsterBaseById?.(unitId(enemy))?.linkedDeathIndex ?? 0) + 1;
            queueConversation(`ABYSS_VEGNASIS_FALL_${Math.max(1,Math.min(5,order))}`);
            if (remaining.length) Battle.log('倒れた魔柱の力が残る柱へ流れ、傷が完全に塞がった！');
        });
    };

    const originalRenderEnemies = Battle.renderEnemies.bind(Battle);
    Battle.renderEnemies = () => {
        originalRenderEnemies();
        const enemies = Battle.enemies || [];
        if (!enemies.some(enemy => VAGNASIS_IDS.has(unitId(enemy)))) return;
        const container = Battle.getEl?.('enemy-container') || document.getElementById('enemy-container');
        if (!container) return;
        container.querySelectorAll('.enemy-sprite img').forEach(img => { img.style.opacity = '0'; });
        const sourceEnemy = enemies.find(enemy => VAGNASIS_IDS.has(unitId(enemy)) && !enemy.isDead) || enemies.find(enemy => VAGNASIS_IDS.has(unitId(enemy)));
        const imageInfo = Battle.resolveMonsterImage?.(sourceEnemy, globalThis.GRAPHICS?.images || {});
        if (!imageInfo?.src) return;
        const shared = document.createElement('img');
        shared.className = 'vegnasis-shared-visual';
        shared.alt = '死幻の魔柱ヴェグナシス';
        shared.src = imageInfo.src;
        shared.onerror = () => { if (imageInfo.fallback) shared.src = imageInfo.fallback; };
        shared.style.cssText = 'position:absolute;left:50%;bottom:58px;width:min(52%,310px);height:auto;aspect-ratio:1/1;object-fit:contain;object-position:center bottom;transform:translateX(-50%);filter:drop-shadow(0 8px 10px rgba(0,0,0,.75));z-index:30;pointer-events:none;';
        container.appendChild(shared);
    };

    const baseItemRuntime = globalThis.ItemRuntime;
    if (baseItemRuntime) {
        globalThis.ItemRuntime = Object.freeze({
            ...baseItemRuntime,
            isBattleUsable(item) {
                if (Number(item?.id) !== OCTAPRISM_ID) return baseItemRuntime.isBattleUsable(item);
                return !App.data?.battle?.abyssOctaprismUsed && (Battle.enemies || []).some(enemy => AZELGARAG_IDS.has(unitId(enemy)) && !enemy.isDead);
            },
            getBattleTargetType(item) {
                if (Number(item?.id) === OCTAPRISM_ID) return 'all_enemy';
                return baseItemRuntime.getBattleTargetType(item);
            },
            applyBattleItem(context) {
                const {item, command} = context || {};
                if (Number(item?.id) !== OCTAPRISM_ID) return baseItemRuntime.applyBattleItem(context);
                const targets = (Battle.enemies || []).filter(enemy => AZELGARAG_IDS.has(unitId(enemy)) && !enemy.isDead);
                if (!targets.length || App.data?.battle?.abyssOctaprismUsed) {
                    Battle.log('オクタプリズマは今は力を示さない。');
                    return {handled:true,consumed:false,effected:0};
                }
                Battle.log(`${command?.actor?.name || '一行'}はオクタプリズマを掲げた！`);
                targets.forEach(applyOctaprismToEnemy);
                App.data.battle.abyssOctaprismUsed = true;
                App.data.battle.abyssSealedSkillIds = [...SEALED_SKILL_IDS];
                Battle.log('八面の光が深淵王の全能力を弱め、ラグナロク・カオスショック・混沌の衣を封じた！');
                App.save?.();
                return {handled:true,consumed:false,effected:targets.length};
            }
        });
    }
})();
