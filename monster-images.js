/*
 * Monster image compatibility bridge.
 *
 * Monster image paths are no longer maintained as a separate ID list.
 * The runtime derives paths from monsters.js. By default it uses:
 *   assets/monsters/monster_<monsterId>.png
 * A master record may set imageId to reuse another registered monster image.
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
    const imageId = Number(monster?.imageId ?? monster?.baseId ?? monster?.id);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(imageId) || imageId <= 0) return;
    map[Math.floor(id)] = `assets/monsters/monster_${Math.floor(imageId)}.png`;
  });
  root.MonsterImageMap = map;
})(globalThis);
