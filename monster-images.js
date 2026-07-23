/*
 * Monster image compatibility bridge.
 *
 * Monster image paths are no longer maintained as a separate ID list.
 * The runtime derives every path from monsters.js using:
 *   assets/monsters/monster_<monsterId>.png
 *
 * This file remains only for compatibility with older cached HTML/service workers.
 */
(function registerMonsterImages(root) {
  const definitions = root.MonsterData?.allBases || root.MONSTERS_DATA || [];
  const assets = root.PRISMA_ASSETS;

  if (assets?.registerMonsterDefinitions) {
    assets.registerMonsterDefinitions(definitions);
    return;
  }

  const map = root.MonsterImageMap || {};
  definitions.forEach((monster) => {
    const id = Number(monster?.baseId ?? monster?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    map[id] = `assets/monsters/monster_${Math.floor(id)}.png`;
  });
  root.MonsterImageMap = map;
})(globalThis);
