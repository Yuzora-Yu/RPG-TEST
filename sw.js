const CACHE_NAME = "rpg-test-v2";
const FILES_TO_CACHE = [
  "main.html",
  "index.html",
  "editor.html",

  "main.js",
  "menus.js",
  "database.js",
  "gacha.js",
  "monsters.js",
  "skills.js",
  "characters.js",
  "battle.js",
  "assets.js",
  "blacksmith.js",
  "dungeon.js",
  "facilities.js",
  "items.js",
  "job_data.js"
];

// インストール時に全部キャッシュ
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

// キャッシュ優先
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});

// 古いキャッシュ削除
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
    )
  );
});

