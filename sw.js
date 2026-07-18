// sw.js: Prisma Abyss Service Worker
// ============================================================================
// 2026-07-15 方針: 初回に全量取得の待機可否を確認し、どちらでも全画像をキャッシュ
// ----------------------------------------------------------------------------
// 「はい」は起動前に進捗表示付きで全量取得し、「いいえ」は即起動後、裏で全量取得する。
//
// 今後の方針:
// - App Shell と重要画像はService Worker install時にキャッシュする。
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

const CACHE_NAME = "prisma-abyss-v3.122-summit-clouds";
const RUNTIME_CACHE_NAME = "prisma-abyss-v3.122-summit-clouds-runtime";
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
  "opening.css",
  "assets.js",
  "vendor/phaser/phaser.min.js",
  "phaser-field.js",
  "map_render_shared.js",
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
  "item_runtime.js",
  "gacha.js",
  "monsters.js",
  "chest-mimics.js",
  "monster-drop-policy.js",
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
  "opening.js",
  "passiveSkill.js",
  "achievements.js",
  "news.js",
];

const ASSET_WARMUP = (self.PRISMA_ASSETS && self.PRISMA_ASSETS.cacheWarmup) || {};

// 初回表示で特に遅延が目立つ画像。assets.js から取得する。
const INITIAL_IMAGE_PRECACHE = ASSET_WARMUP.criticalImages || [
  "assets/monsters/monster_100001.png",
  "assets/monsters/monster_100002.png",
  "assets/monsters/monster_100003.png",
  "assets/monsters/monster_100004.png",
  "assets/monsters/monster_301000.png",
  "assets/generated/battle-field-ai.png",
  "assets/generated/battle-dungeon-ai.png",
  "assets/map/terrain/terrain_grass_field_v001.png",
  "assets/map/objects/object_field_forest_v003.png",
  "assets/map/overlays/overlay_npc_villager_v002.png",
];

// 初回install時は最低限の重要画像だけをキャッシュする。
// 全画像データは main.js の起動時モーダル、起動後の背景ウォーム、または設定メニューから取得する。
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

const fetchAndCacheWithRetry = async (cache, request, maxAttempts = 3) => {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const retryRequest = new Request(request, { cache: attempt === 1 ? "reload" : "no-cache" });
      const response = await fetch(retryRequest);
      if (!response || !response.ok) throw new Error(`HTTP ${response ? response.status : "ERR"}`);
      await cache.put(request, response.clone());
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await sleep(180 * attempt);
    }
  }
  console.warn(`[SW] キャッシュ取得を${maxAttempts}回試行しても失敗: ${request.url}`, lastError);
  return false;
};

const warmCacheList = async (urls, options = {}) => {
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  const uniqueUrls = Array.from(new Set((urls || []).filter(Boolean)));
  const batchSize = options.batchSize || 6;
  const delayMs = options.delayMs || 120;
  const failedUrls = [];

  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);

    const results = await Promise.all(batch.map(async (url) => {
      const request = toSameOriginRequest(url);
      if (!request) return true;

      const cached = await cache.match(request);
      if (cached) return true;

      return fetchAndCacheWithRetry(cache, request, 3);
    }));
    results.forEach((ok, index) => {
      if (!ok) failedUrls.push(batch[index]);
    });

    // 一気に大量取得すると、プレイ中の通信や描画に影響するため少し間隔を空ける。
    if (i + batchSize < uniqueUrls.length) await sleep(delayMs);
  }
  return failedUrls;
};

const warmCacheInBackground = async (payload = {}) => {
  const version = payload.version || "default";

  // 同じバージョンのウォームキャッシュが完了済みなら繰り返さない。
  // CACHE_NAME を変えた場合は runtime cache も切り替わるため、自然に再実行される。
  if (await isWarmCacheComplete(version)) return;

  const criticalImages = payload.criticalImages || [];
  const backgroundImages = payload.backgroundImages || [];

  // 先にロード画面/初戦闘向けを少数キャッシュ。
  const failedUrls = await warmCacheList(criticalImages, { batchSize: 8, delayMs: 40 });

  // install時に取りこぼした画像の再試行。起動処理では待たないが、以前より速めに温める。
  failedUrls.push(...await warmCacheList(backgroundImages, { batchSize: 6, delayMs: 80 }));

  // 1件でも不足した状態を「全件完了」と記録しない。次回の起動・設定操作で再試行する。
  if (failedUrls.length) {
    console.warn(`[SW] 全画像キャッシュ未完了: ${failedUrls.length}件を次回再試行します。`, failedUrls);
    return;
  }
  await markWarmCacheComplete(version);
};

const precacheRequiredList = async (cache, files, batchSize = 8) => {
  const uniqueFiles = Array.from(new Set(files || []));
  for (let i = 0; i < uniqueFiles.length; i += batchSize) {
    const batch = uniqueFiles.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async file => {
      const request = new Request(file, { cache: "reload" });
      return fetchAndCacheWithRetry(cache, request, 3);
    }));
    const failedIndex = results.findIndex(ok => !ok);
    if (failedIndex >= 0) throw new Error(`Required precache failed: ${batch[failedIndex]}`);
  }
};

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 新版の必須画像が一つでも取得できなければinstallを失敗させる。
      // 旧Service Workerと旧キャッシュを残し、更新直後の画像欠落を防ぐ。
      await precacheRequiredList(cache, INSTALL_IMAGE_PRECACHE, 8);

      // App Shellも同じ更新単位で確立する。必須ファイルが欠けた新版へ切り替えない。
      await precacheRequiredList(cache, PRECACHE_FILES, 8);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            // 同一オリジンを共有する別アプリのCache Storageは削除しない。
            .filter((key) => key.startsWith("prisma-abyss-") && key !== CACHE_NAME && key !== RUNTIME_CACHE_NAME)
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
