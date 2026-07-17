const { runAudit } = require('../battle/battle-logic-audit');

runAudit().then(report => {
    if (report.errors.length) {
        throw new Error(`battle logic audit failed:\n${report.errors.join('\n')}`);
    }
    console.log(`Battle logic validation passed: ${report.metrics.executedSkills}/${report.metrics.skills} skills executed, ${report.metrics.monsterActionReferences} enemy action references, ${report.metrics.expandedBattleItems} battle items, 6 auto strategies, statuses, buffs/debuffs, and split skill settings.`);
}).catch(error => {
    console.error(error.stack || error);
    process.exit(1);
});
