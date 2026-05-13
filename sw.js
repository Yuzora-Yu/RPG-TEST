// sw.js: Prisma Abyss Service Worker
// ============================================================================
// 2026-05-13 方針変更
// ----------------------------------------------------------------------------
// 以前はモンスター画像・マップ画像・エフェクト画像をすべて install 時に
// 事前キャッシュしていましたが、ファイル数/容量が大きく、初回起動や更新時の
// 読み込み遅延の主因になっていました。
//
// 今後の方針:
// - 事前キャッシュするのは「起動に最低限必要な App Shell」だけ。
// - モンスター/マップ/エフェクト/背景などの画像は、実際に使われた時点で
//   runtime cache に保存する。
// - Codex等で編集する際も、MONSTER_IMAGE_FILES / MAP_ASSET_FILES /
//   EFFECT_IMAGE_FILES のような全量リストをここへ復活させないこと。
//   画像の所在管理は assets.js に統一する。
// ============================================================================

const CACHE_NAME = "prisma-abyss-v2.73-light-app-shell";
const RUNTIME_CACHE_NAME = "prisma-abyss-v2.73-runtime-assets";

// 起動に必要な最小セットだけを事前キャッシュする。
// 画像や演出素材はここに列挙せず、fetch 時に runtime cache へ入れる。
const PRECACHE_FILES = [
  "./",
  "main.html",
  "index.html",
  "manifest.json",
  "modern-polish.css",
  "assets.js",
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
];

const isSameOrigin = (request) => {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
};

const isImageRequest = (request) => {
  const url = new URL(request.url);
  return request.destination === "image" || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(url.pathname);
};

const isFontRequest = (request) => {
  const url = new URL(request.url);
  return request.destination === "font" || /\.(woff2?|ttf|otf)$/i.test(url.pathname);
};

const isAppShellRequest = (request) => {
  const url = new URL(request.url);
  return /\.(html|css|js|json)$/i.test(url.pathname) || url.pathname.endsWith("/");
};

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(RUNTIME_CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
};

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
};

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE_FILES.map((file) => cache.add(new Request(file, { cache: "reload" })))
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET" || !isSameOrigin(request)) return;

  // 画像・フォントは cache-first。
  // 初回だけネットワーク取得し、以後は runtime cache から返す。
  if (isImageRequest(request) || isFontRequest(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML/JS/CSS/JSON は network-first。
  // 更新したJSが古いキャッシュに隠れにくいようにする。
  if (request.mode === "navigate" || isAppShellRequest(request)) {
    event.respondWith(networkFirst(request));
  }
});
