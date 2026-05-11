const CACHE_NAME = "prisma-abyss-v2.62-monster-img";
const NORMAL_MONSTER_IMAGE_IDS = Array.from({ length: 90 }, (_, i) => 100001 + i);
const BOSS_MONSTER_IMAGE_IDS = [
  200201, 200202, 200203, 200204,
  301000,
  401010, 401020, 401030, 401040, 401050, 401060, 401070,
  401080, 401081, 401082, 401090, 401100,
  401110, 401120, 401130, 401140, 401150, 401151, 401152, 401153,
  401160, 401161, 401162, 401170, 401180, 401190, 401200,
  902000,
];
const MONSTER_IMAGE_FILES = NORMAL_MONSTER_IMAGE_IDS
  .concat(BOSS_MONSTER_IMAGE_IDS)
  .map((id) => `monster/img/monster_${id}.png`);
const FILES_TO_CACHE = [
  "./", // ルート
  "main.html",
  "index.html",
  "manifest.json",
  "modern-polish.css",
  "polish.js",
  "main.js",
  "menus.js",
  "database.js",
  "gacha.js",
  "monsters.js",
  "monster-images.js",
  "skills.js",
  "characters.js",
  "battle.js",
  "equips.js",
  "assets.js",
  "blacksmith.js",
  "dungeon.js",
  "facilities.js",
  "items.js",
  "job_data.js",
  "map.js",
  "story.js",
  "passiveSkill.js",
  "achievements.js",
  "news.js",
  ...MONSTER_IMAGE_FILES,
];

// インストール時にキャッシュ
self.addEventListener("install", (e) => {
  // ★追加: 新しいService Workerを即座に待機状態から有効化する
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

// 有効化時に古いキャッシュを削除
self.addEventListener("activate", (e) => {
  // ★追加: 制御下のページをすぐに現在のService Workerで支配する
  e.waitUntil(clients.claim());
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
    )
  );
});

// フェッチ（通信）発生時の処理
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      // キャッシュがあれば返し、なければネットワークへ（オフライン時はここでエラーになる）
      return res || fetch(e.request);
    })
  );
});




