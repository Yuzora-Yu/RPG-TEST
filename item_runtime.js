/* item_runtime.js - shared battle/field behavior for consumable items */
(() => {
    'use strict';

    const ensureBattleStatus = target => {
        if (!target.battleStatus) target.battleStatus = { buffs: {}, debuffs: {}, ailments: {} };
        if (!target.battleStatus.buffs) target.battleStatus.buffs = {};
        if (!target.battleStatus.debuffs) target.battleStatus.debuffs = {};
        if (!target.battleStatus.ailments) target.battleStatus.ailments = {};
        return target.battleStatus;
    };
    const isAlive = target => !!target && !target.isFled && !target.isDead && Number(target.hp || 0) > 0;
    const isBattleUsable = item => {
        if (!item) return false;
        if (item.battleUsable !== undefined) return item.battleUsable === true;
        return ['HP回復', 'MP回復', '蘇生', '状態異常回復'].includes(item.type);
    };
    const isFieldUsable = item => {
        if (!item) return false;
        if (item.fieldUsable !== undefined) return item.fieldUsable === true;
        return ['HP回復', 'MP回復', '蘇生', '育成', '移動', '乗り物'].includes(item.type);
    };
    const getBattleTargetType = item => {
        if (!item) return 'ally';
        if (item.effectKind === 'damage' || item.effectKind === 'debuff') {
            if (item.target === '全体') return 'all_enemy';
            if (item.target === 'ランダム') return 'random';
            return 'enemy';
        }
        if (item.type === '蘇生') return item.target === '全体' ? 'all_ally' : 'ally_dead';
        if (item.target === '全体') return 'all_ally';
        return 'ally';
    };
    const getMaxHp = (Battle, target) => Math.max(1, Number(Battle.getBattleStat?.(target, 'maxHp') || target?.baseMaxHp || target?.maxHp || target?.hp || 1));
    const getMaxMp = (Battle, target) => Math.max(0, Number(Battle.getBattleStat?.(target, 'maxMp') || target?.baseMaxMp || target?.maxMp || target?.mp || 0));
    const livingEnemies = Battle => (Battle.enemies || []).filter(target => Battle.isBattleAlive ? Battle.isBattleAlive(target) : isAlive(target));
    const livingParty = Battle => (Battle.party || []).filter(target => Battle.isBattleAlive ? Battle.isBattleAlive(target) : isAlive(target));
    const commandTargets = (Battle, command, item) => {
        const targetType = getBattleTargetType(item);
        if (targetType === 'all_enemy') return livingEnemies(Battle);
        if (targetType === 'all_ally') {
            if (item.type === '蘇生') return (Battle.party || []).filter(Boolean);
            return livingParty(Battle);
        }
        if (targetType === 'random') return livingEnemies(Battle);
        return command.target && typeof command.target === 'object' ? [command.target] : [];
    };
    const consume = (App, item) => {
        if (item.consumable === false || item.type === '貴重品') return true;
        const count = Number(App.data?.items?.[item.id] || 0);
        if (count <= 0) return false;
        App.data.items[item.id] = count - 1;
        if (App.data.items[item.id] <= 0) delete App.data.items[item.id];
        return true;
    };
    const elementalDamage = (Battle, target, item) => {
        ensureBattleStatus(target);
        const baseRes = ((Battle.getBattleStat?.(target, 'elmRes') || target.elmRes || {})[item.element] || 0);
        const buffRes = Number(target.battleStatus.buffs.elmResUp?.val || 0);
        const debuffRes = Number(target.battleStatus.debuffs.elmResDown?.val || 0);
        const resistance = Math.max(-100, Math.min(100, Number(baseRes) + buffRes - debuffRes));
        if (resistance >= 100) return 0;
        const variance = 0.9 + Math.random() * 0.2;
        const damage = Math.floor(Number(item.power || 0) * variance * (1 - resistance / 100));
        return Math.max(1, damage);
    };
    const applyDamageItem = (Battle, item, command) => {
        const allTargets = commandTargets(Battle, command, item);
        const hitCount = Math.max(1, Number(item.hits || 1));
        let effected = 0;
        const attackOnce = target => {
            if (!target || !(Battle.isBattleAlive ? Battle.isBattleAlive(target) : isAlive(target))) return;
            const hpBefore = Number(target.hp || 0);
            const damage = elementalDamage(Battle, target, item);
            target.hp = Math.max(0, hpBefore - damage);
            const color = { 火:'#f88', 水:'#88f', 雷:'#ff0', 風:'#8f8', 光:'#ffc', 闇:'#a8f', 混沌:'#d4d' }[item.element] || '#fff';
            if (damage > 0) Battle.log(`${target.name}に<span style="color:${color}">${damage}</span>の${item.element}属性ダメージ！`);
            else Battle.log(`${target.name}は${item.element}属性を無効化した！`);
            if (target.hp <= 0) {
                const survived = typeof Battle.tryGutsSurvive === 'function' && Battle.tryGutsSurvive(target, hpBefore);
                if (!survived && typeof Battle.markDefeated === 'function') Battle.markDefeated(target);
            }
            effected += 1;
        };

        if (item.target === 'ランダム') {
            for (let hit = 0; hit < hitCount; hit += 1) {
                const pool = livingEnemies(Battle);
                if (pool.length === 0) break;
                attackOnce(pool[Math.floor(Math.random() * pool.length)]);
            }
        } else {
            allTargets.forEach(attackOnce);
        }
        return effected;
    };
    const applyBuffItem = (Battle, item, command) => {
        let effected = 0;
        commandTargets(Battle, command, item).forEach(target => {
            if (!isAlive(target)) return;
            const status = ensureBattleStatus(target);
            Object.entries(item.buff || {}).forEach(([key, value]) => {
                const turns = Math.max(1, Number(item.turn || 4));
                const current = status.buffs[key]?.val;
                if (key === 'elmResUp' || key.startsWith('resists_')) {
                    status.buffs[key] = {
                        val: Math.max(Number(current || 0), Number(value)),
                        turns: status.buffs[key]?.turns === null ? null : Math.max(Number(status.buffs[key]?.turns || 0), turns)
                    };
                } else {
                    status.buffs[key] = {
                        val: Math.max(Number(current || 1), Number(value)),
                        turns: status.buffs[key]?.turns === null ? null : Math.max(Number(status.buffs[key]?.turns || 0), turns)
                    };
                }
                Battle.log(`${target.name}の${Battle.statNames?.[key] || key}が上がった！`);
            });
            effected += 1;
        });
        return effected;
    };
    const applyDebuffItem = (Battle, item, command) => {
        let effected = 0;
        commandTargets(Battle, command, item).forEach(target => {
            if (!isAlive(target)) return;
            const status = ensureBattleStatus(target);
            const debuffResist = Number((Battle.getBattleStat?.(target, 'resists') || target.resists || {}).Debuff || 0);
            const successRate = Math.max(0, Number(item.successRate ?? 100) - debuffResist);
            if (Math.random() * 100 >= successRate) {
                Battle.log(`${target.name}には弱体効果が効かなかった！`);
                return;
            }
            Object.entries(item.debuff || {}).forEach(([key, value]) => {
                const turns = Math.max(1, Number(item.turn || 4));
                const current = status.debuffs[key]?.val;
                if (key === 'elmResDown') {
                    status.debuffs[key] = {
                        val: Math.max(Number(current || 0), Number(value)),
                        turns: status.debuffs[key]?.turns === null ? null : Math.max(Number(status.debuffs[key]?.turns || 0), turns)
                    };
                } else {
                    status.debuffs[key] = {
                        val: Math.min(Number(current || 1), Number(value)),
                        turns: status.debuffs[key]?.turns === null ? null : Math.max(Number(status.debuffs[key]?.turns || 0), turns)
                    };
                }
                Battle.log(`${target.name}の${Battle.statNames?.[key] || key}が下がった！`);
            });
            effected += 1;
        });
        return effected;
    };
    const applyRecoveryItem = (Battle, item, command) => {
        let effected = 0;
        commandTargets(Battle, command, item).forEach(target => {
            if (!target) return;
            ensureBattleStatus(target);
            if (item.type === '蘇生') {
                if (!target.isDead && Number(target.hp || 0) > 0) return;
                target.isDead = false;
                const rate = Number(item.rate ?? 1);
                target.hp = Math.max(1, Math.floor(getMaxHp(Battle, target) * rate));
                if (typeof Battle.applyPersistentBattlePassives === 'function') {
                    Battle.applyPersistentBattlePassives(target);
                }
                if (typeof Battle.refreshPartyFormationAuras === 'function' && (Battle.party || []).includes(target)) {
                    Battle.refreshPartyFormationAuras();
                }
                Battle.log(`${target.name}は生き返った！`);
                effected += 1;
                return;
            }
            if (!isAlive(target)) return;
            if (item.type === 'HP回復') {
                const before = Number(target.hp || 0);
                const amount = Number(item.val || 0) >= 9999 ? getMaxHp(Battle, target) : Number(item.val || 0);
                target.hp = Math.min(getMaxHp(Battle, target), before + amount);
                const recovered = target.hp - before;
                if (recovered > 0) Battle.log(`${target.name}のHPが${recovered}回復！`);
                effected += recovered > 0 ? 1 : 0;
            } else if (item.type === 'MP回復') {
                const before = Number(target.mp || 0);
                const amount = Number(item.val || 0) >= 9999 ? getMaxMp(Battle, target) : Number(item.val || 0);
                target.mp = Math.min(getMaxMp(Battle, target), before + amount);
                const recovered = target.mp - before;
                if (recovered > 0) Battle.log(`${target.name}のMPが${recovered}回復！`);
                effected += recovered > 0 ? 1 : 0;
            } else if (item.type === '状態異常回復') {
                let cured = 0;
                (item.cures || []).forEach(ailment => {
                    if (target.battleStatus.ailments[ailment]) {
                        delete target.battleStatus.ailments[ailment];
                        cured += 1;
                    }
                });
                if (item.CureAilments) {
                    cured += Object.keys(target.battleStatus.ailments).length;
                    target.battleStatus.ailments = {};
                }
                if (item.debuff_reset) {
                    cured += Object.keys(target.battleStatus.debuffs).length;
                    target.battleStatus.debuffs = {};
                }
                if (cured > 0) Battle.log(`${target.name}の悪い状態が治った！`);
                effected += cured > 0 ? 1 : 0;
            }
        });
        return effected;
    };
    const applyBattleItem = ({ Battle, App, item, command }) => {
        if (!isBattleUsable(item)) return { handled: false, consumed: false, effected: 0 };
        if (!consume(App, item)) {
            Battle.log(`${item.name}はもう残っていない！`);
            return { handled: true, consumed: false, effected: 0 };
        }
        Battle.log(`${command.actor.name}は${item.name}を使った！`);
        let effected = 0;
        if (item.effectKind === 'damage') effected = applyDamageItem(Battle, item, command);
        else if (item.effectKind === 'buff') effected = applyBuffItem(Battle, item, command);
        else if (item.effectKind === 'debuff') effected = applyDebuffItem(Battle, item, command);
        else effected = applyRecoveryItem(Battle, item, command);
        if (effected === 0) Battle.log('しかし、効果はなかった。');
        return { handled: true, consumed: true, effected };
    };

    const applyFieldGroupItem = ({ App, item, party }) => {
        const members = (party || []).filter(Boolean);
        let effected = 0;
        if (item.effectKind === 'camp') {
            members.forEach(target => {
                const stats = App.calcStats(target);
                target.currentHp = stats.maxHp;
                target.currentMp = stats.maxMp;
                effected += 1;
            });
            return { success: effected > 0, effected, message: '仲間全員が蘇生し、HPとMPが全回復した！' };
        }
        members.forEach(target => {
            const stats = App.calcStats(target);
            if (item.type === 'HP回復' && Number(target.currentHp || 0) > 0 && Number(target.currentHp || 0) < stats.maxHp) {
                target.currentHp = Math.min(stats.maxHp, Number(target.currentHp || 0) + Number(item.val || 0));
                effected += 1;
            } else if (item.type === 'MP回復' && Number(target.currentHp || 0) > 0 && Number(target.currentMp || 0) < stats.maxMp) {
                target.currentMp = Math.min(stats.maxMp, Number(target.currentMp || 0) + Number(item.val || 0));
                effected += 1;
            }
        });
        return {
            success: effected > 0,
            effected,
            message: effected > 0 ? `仲間全員に${item.name}を使った！` : '今は使う必要がない。'
        };
    };

    window.ItemRuntime = Object.freeze({
        isBattleUsable,
        isFieldUsable,
        getBattleTargetType,
        applyBattleItem,
        applyFieldGroupItem
    });
})();
