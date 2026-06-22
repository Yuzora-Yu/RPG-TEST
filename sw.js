// sw.js: Prisma Abyss Service Worker
// ============================================================================
// 2026-06-22 方針変更: 全画像データは main.js の起動時確認/設定メニューでキャッシュ
// ----------------------------------------------------------------------------
// 初回起動時/キャッシュ削除後に未ダウンロード画像がある場合、main.js 側で
// 「全データをダウンロードしますか」を表示する。
// 「はい」は起動前に全画像を保存し、「いいえ」は起動後に裏側ウォームキャッシュを進める。
//
// 今後の方針:
// - App Shell と最低限の重要画像だけを初回install時にキャッシュする。
// - 全画像リストの正本は assets.js の PRISMA_ASSETS.cacheWarmup.installImages。
// - sw.js 側にモンスター/エフェクト/背景の巨大配列を手書きで復活させないこと。
// - 設定メニューの「全データダウンロード」も main.js の同じロジックを使う。
// - 起動後/設定実行後の補助再試行は main.js からの PRISMA_WARM_CACHE で行う。
// ============================================================================

try {
  // 画像キャッシュ対象の正本を assets.js に統一する。
  // Service Worker内では DOM/Image は使わず、PRISMA_ASSETS.cacheWarmup の配列だけ参照する。
  importScripts("assets.js");
} catch (error) {
  console.warn("[SW] assets.js の読み込みに失敗しました。画像初回キャッシュは最小限で続行します。", error);
}

const CACHE_NAME = "prisma-abyss-v3.44-full-data";
const RUNTIME_CACHE_NAME = "prisma-abyss-v3.44-full-data-runtime-assets";
const WARM_CACHE_META_KEY = "__prisma_abyss_warm_cache_complete__";

// 起動に必要な App Shell。
// 画像は下の INSTALL_IMAGE_PRECACHE で最低限の重要画像だけ取得する。
// ここへ画像ファイルを手書きで増やさないこと。
const PRECACHE_FILES = [
  "./",
  "main.html",
  "index.html",
  "manifest.json",
  "modern-polish.css",
  "assets.js",
  "vendor/phaser/phaser.min.js",
  "phaser-field.js",
  "polish.js",
  "main.js",
  "save_crypto.js",
  "menus.js",
  "menus_config.js",
  "menus_party.js",
  "menus_status.js",
  "menus_items.js",
  "menus_inventory.js",
  "menus_allies.js",
  "menus_skills.js",
  "menus_book.js",
  "menus_ally_detail.js",
  "menus_skill_detail.js",
  "menus_trait_detail.js",
  "menus_exchange.js",
  "menus_news_detail.js",
  "menus_achievements.js",
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

const ASSET_WARMUP = (self.PRISMA_ASSETS && self.PRISMA_ASSETS.cacheWarmup) || {};

// 初回表示で特に遅延が目立つ画像。assets.js から取得する。
const INITIAL_IMAGE_PRECACHE = ASSET_WARMUP.criticalImages || [
  ...Array.from({ length: 24 }, (_, i) => `assets/monsters/monster_${100001 + i}.png`),
  "assets/generated/battle-field-ai.png",
  "assets/generated/battle-dungeon-ai.png",
  "assets/generated/battle-fire.png",
  "assets/map/objects/magma.png",
  "assets/gacha/back_card.png",
  "assets/gacha/front_card.png",
  "assets/background/bg_inn.jpg",
  "assets/background/bg_casino.png",
];

// 初回install時は最低限の重要画像だけをキャッシュする。
// 全画像データは main.js の起動時モーダル、または設定メニューの「全データダウンロード」から実行する。
const INSTALL_IMAGE_PRECACHE = ASSET_WARMUP.criticalImages || INITIAL_IMAGE_PRECACHE;

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
  await warmCacheList(criticalImages, { batchSize: 10, delayMs: 40 });

  // install時に取りこぼした画像の再試行。起動処理では待たないが、以前より速めに温める。
  await warmCacheList(backgroundImages, { batchSize: 8, delayMs: 80 });

  await markWarmCacheComplete(version);
};

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        Array.from(new Set([...PRECACHE_FILES, ...INSTALL_IMAGE_PRECACHE])).map((file) =>
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
