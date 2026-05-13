// sw.js: Prisma Abyss Service Worker
// ============================================================================
// 2026-05-13 方針変更 + 起動後ウォームキャッシュ
// ----------------------------------------------------------------------------
// 以前はモンスター画像・マップ画像・エフェクト画像をすべて install 時に
// 事前キャッシュしていましたが、ファイル数/容量が大きく、初回起動や更新時の
// 読み込み遅延の主因になっていました。
//
// 今後の方針:
// - install 時の事前キャッシュは「起動に最低限必要な App Shell」と
//   「ロード画面/初戦闘の体感に効く少数の画像」だけにする。
// - モンスター/戦闘背景/エフェクトなどの全量リストは assets.js に統一する。
// - main.js から受け取った assets.js の一覧を、起動後に裏側で順次キャッシュする。
// - Codex等で編集する際も、ここに全モンスター・全エフェクトの巨大配列を
//   直接復活させないこと。画像管理の正本は assets.js。
// ============================================================================

const CACHE_NAME = "prisma-abyss-v2.83-dungeon-adventurer";
const RUNTIME_CACHE_NAME = "prisma-abyss-v2.83-runtime-assets";
const WARM_CACHE_META_KEY = "__prisma_abyss_warm_cache_complete__";

// 起動に必要な最小セットだけを事前キャッシュする。
// 画像や演出素材の全量はここに列挙せず、assets.js -> main.js -> postMessage で
// runtime cache へ順次入れる。
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

// ロード画面と初戦闘の体感を守るための少数キャッシュ。
// ここに全モンスター画像を戻すと、以前と同じく起動が重くなるので増やしすぎないこと。
// 残りのモンスター/戦闘背景/エフェクトは assets.js の cacheWarmup.backgroundImages を使い、
// 起動後に裏側で温める。
const INITIAL_IMAGE_PRECACHE = [
  ...Array.from({ length: 12 }, (_, i) => `monster/img/monster_${100001 + i}.png`),
  "assets/generated/battle-field-ai.png",
  "assets/generated/battle-forest-ai.png",
  "assets/generated/battle-dungeon-ai.png",
  "assets/generated/battle-boss-ai.png",
];

const isSameOrigin = (request) => {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
};

const toSameOriginRequest = (url) => {
  try {
    const absolute = new URL(url, self.location.origin);
    if (absolute.origin !== self.location.origin) return null;
    return new Request(absolute.href, { cache: "default" });
  } catch (e) {
    return null;
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const markWarmCacheComplete = async (version) => {
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  await cache.put(
    new Request(WARM_CACHE_META_KEY),
    new Response(JSON.stringify({ version, completedAt: Date.now() }), {
      headers: { "Content-Type": "application/json" },
    })
  );
};

const isWarmCacheComplete = async (version) => {
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  const cached = await cache.match(new Request(WARM_CACHE_META_KEY));
  if (!cached) return false;
  try {
    const meta = await cached.json();
    return meta && meta.version === version;
  } catch (e) {
    return false;
  }
};

const warmCacheList = async (urls, options = {}) => {
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  const uniqueUrls = Array.from(new Set((urls || []).filter(Boolean)));
  const batchSize = options.batchSize || 6;
  const delayMs = options.delayMs || 120;

  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);

    await Promise.allSettled(batch.map(async (url) => {
      const request = toSameOriginRequest(url);
      if (!request) return;

      const cached = await cache.match(request);
      if (cached) return;

      const response = await fetch(request);
      if (response && response.ok) {
        await cache.put(request, response.clone());
      }
    }));

    // 一気に大量取得すると、プレイ中の通信や描画に影響するため少し間隔を空ける。
    if (i + batchSize < uniqueUrls.length) await sleep(delayMs);
  }
};

const warmCacheInBackground = async (payload = {}) => {
  const version = payload.version || "default";

  // 同じバージョンのウォームキャッシュが完了済みなら繰り返さない。
  // CACHE_NAME を変えた場合は runtime cache も切り替わるため、自然に再実行される。
  if (await isWarmCacheComplete(version)) return;

  const criticalImages = payload.criticalImages || [];
  const backgroundImages = payload.backgroundImages || [];

  // 先にロード画面/初戦闘向けを少数キャッシュ。
  await warmCacheList(criticalImages, { batchSize: 6, delayMs: 80 });

  // 残りはゆっくり温める。起動処理では待たない。
  await warmCacheList(backgroundImages, { batchSize: 4, delayMs: 180 });

  await markWarmCacheComplete(version);
};

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        [...PRECACHE_FILES, ...INITIAL_IMAGE_PRECACHE].map((file) =>
          cache.add(new Request(file, { cache: "reload" }))
        )
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

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "PRISMA_WARM_CACHE") return;

  // main.js から受け取った assets.js の一覧を裏側でキャッシュする。
  // event.waitUntil に渡すことで、画面表示はブロックせず、Service Worker は処理完了まで維持される。
  event.waitUntil(warmCacheInBackground(data.payload || {}));
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
