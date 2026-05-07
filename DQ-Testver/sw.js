const CACHE_NAME = "prisma-abyss-v2.45";
const FILES_TO_CACHE = [
  "./", // ルート
  "main.html",
  "index.html",
  "manifest.json",
  "main.js",
  "menus.js",
  "database.js",
  "gacha.js",
  "monsters.js",
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
  "passiveSkill.js"
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
    caches.match(e.target ? e.target : e.request).then((res) => {
      // キャッシュがあれば返し、なければネットワークへ（オフライン時はここでエラーになる）
      return res || fetch(e.request);
    })
  );
});




