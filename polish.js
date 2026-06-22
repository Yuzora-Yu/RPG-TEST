(() => {
  "use strict";

  const garbledRe = /[�繧縺蜿謌荳鬲豺螟譁]/;
  const byId = (id) => document.getElementById(id);
  const setText = (id, text) => {
    const el = byId(id);
    if (el) el.textContent = text;
  };

  // 画像管理は assets.js に統一しました。
  // 以前は polish.js が canvas 生成画像や assets/map のパスを GRAPHICS.data へ
  // Object.assign していましたが、管理箇所が二重化して分かりにくくなるため廃止。
  // 今後、マップ/戦闘背景/主人公歩行画像を追加・変更する場合は assets.js の
  // PRISMA_ASSETS.graphics を編集してください。
  const installGraphics = () => {};

  const entry = (img, color) => ({ img, color });
  // マップ名・タイルテーマの正本は map.js に集約。
  // 以前は polish.js でも TILE_THEMES / STORY_DATA 名称を上書きしていたが、
  // 地域別マップチップ管理と座標正規化の妨げになるためここでは触らない。
  const installThemes = () => {};

  const installNames = () => {};

  const shouldReplace = (text) => !text || garbledRe.test(text);
  const fixTitleText = () => {
    document.title = document.body && byId("player-name") ? "PRISMA ABYSS" : document.title;
    const name = byId("player-name");
    if (name) {
      name.placeholder = "名前を入力";
      if (shouldReplace(name.value)) name.value = "アルス";
    }
    const iconLabel = document.querySelector(".file-input-wrapper label");
    if (iconLabel) iconLabel.textContent = "主人公アイコン（任意）";
    const newBtn = document.querySelector(".btn-new");
    if (newBtn) newBtn.textContent = "はじめから";
    const loadBtn = byId("btn-continue");
    if (loadBtn && !/Lv\./.test(loadBtn.textContent)) loadBtn.textContent = "つづきから";
    const manageBtn = document.querySelector(".btn-container > button:not(.btn-new):not(.btn-load)");
    if (manageBtn) manageBtn.textContent = "データ管理";
    const modalTitle = document.querySelector(".modal-title");
    if (modalTitle) modalTitle.textContent = "データ管理";
    const installBtn = byId("installBtn");
    if (installBtn) installBtn.textContent = "アプリをインストール";
    const updateBtn = byId("updateBtn");
    if (updateBtn) updateBtn.textContent = "アプリを更新";
    const deleteBtn = byId("deleteBtn");
    if (deleteBtn) deleteBtn.textContent = "セーブデータを削除";
    const closeBtn = document.querySelector(".btn-close");
    if (closeBtn) closeBtn.textContent = "戻る";
    const importBtn = document.querySelector("#modal-content .btn-modal:not(#installBtn):not(#updateBtn):not(#deleteBtn)");
    if (importBtn) importBtn.textContent = "バックアップから復元";
  };

  const fixGameText = () => {
    const loc = byId("loc-name");
    if (loc && shouldReplace(loc.textContent)) loc.textContent = "フィールド";
    const msg = byId("msg-text");
    if (msg && garbledRe.test(msg.textContent || "")) msg.textContent = "";
    const action = byId("action-indicator");
    if (action && shouldReplace(action.textContent)) action.textContent = "決定";
    setText("btn-up", "▲");
    setText("btn-left", "◀");
    setText("btn-right", "▶");
    setText("btn-down", "▼");
    setText("btn-menu", "MENU");
    setText("btn-ok", "OK");
    setText("btn-attack", "こうげき");
    setText("btn-skill", "スキル");
    setText("btn-item", "どうぐ");
    setText("btn-defend", "ぼうぎょ");
    setText("btn-run", "にげる");
    const targetTitle = document.querySelector("#battle-target-window > div");
    if (targetTitle && shouldReplace(targetTitle.textContent)) targetTitle.textContent = "対象を選択";
    const listTitle = byId("battle-list-title");
    if (listTitle && shouldReplace(listTitle.textContent)) listTitle.textContent = "選択";
    document.querySelectorAll('button[onclick*="Battle.cancelSubMenu"]').forEach((button) => {
      if (shouldReplace(button.textContent)) button.textContent = "戻る";
    });
    const menuClose = document.querySelector('#menu-overlay button[onclick*="Menu.closeMainMenu"]');
    if (menuClose && shouldReplace(menuClose.textContent)) menuClose.textContent = "閉じる";
    const skip = byId("btn-gacha-skip");
    if (skip && shouldReplace(skip.textContent)) skip.textContent = "スキップ";
    const rates = byId("modal-rates");
    if (rates) {
      const title = rates.querySelector(".header-bar span");
      const close = rates.querySelector(".header-bar button");
      if (title && shouldReplace(title.textContent)) title.textContent = "提供割合";
      if (close && shouldReplace(close.textContent)) close.textContent = "閉じる";
    }
  };

  const fixStaticText = () => {
    fixTitleText();
    fixGameText();
  };

  const enhanceControls = () => {
    if (document.documentElement.dataset.polishControls === "1") return;
    document.documentElement.dataset.polishControls = "1";

    [
      ["btn-up", "上へ移動"],
      ["btn-left", "左へ移動"],
      ["btn-right", "右へ移動"],
      ["btn-down", "下へ移動"],
      ["btn-menu", "メニュー"],
      ["btn-ok", "決定"]
    ].forEach(([id, label]) => {
      const el = byId(id);
      if (el) el.setAttribute("aria-label", label);
    });

    const target = byId("canvas-wrapper") || byId("field-canvas");
    if (target && typeof Field !== "undefined") {
      let startX = 0;
      let startY = 0;
      let active = false;
      target.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse") return;
        if (typeof Menu !== "undefined" && Menu.isMenuOpen && Menu.isMenuOpen()) return;
        startX = event.clientX;
        startY = event.clientY;
        active = true;
      }, { passive: true });
      target.addEventListener("pointerup", (event) => {
        if (!active) return;
        active = false;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
        if (Math.abs(dx) > Math.abs(dy)) Field.move(dx > 0 ? 1 : -1, 0);
        else Field.move(0, dy > 0 ? 1 : -1);
      }, { passive: true });
    }

    window.addEventListener("keydown", (event) => {
      const key = event.key;
      const moveKeys = { W: [0, -1], A: [-1, 0], S: [0, 1], D: [1, 0] };
      const upper = key.toUpperCase();
      if (moveKeys[upper] && typeof Field !== "undefined") {
        const scene = byId("field-scene");
        if (scene && scene.style.display !== "none" && !(typeof Menu !== "undefined" && Menu.isMenuOpen && Menu.isMenuOpen())) {
          event.preventDefault();
          Field.move(moveKeys[upper][0], moveKeys[upper][1]);
        }
      }
      if (key === "Escape" && typeof Menu !== "undefined" && Menu.closeMainMenu) {
        const overlay = byId("menu-overlay");
        if (overlay && overlay.style.display !== "none") {
          event.preventDefault();
          Menu.closeMainMenu();
        }
      }
    });
  };

  const BattleFX = {
    lastAt: 0,
    current: null,
    totalHitEvents: 0,
    pendingNeutralPhysicalKind: null,
    pendingNeutralPhysicalTimer: 0,
    pendingCriticalKind: null,
    pendingCriticalTimer: 0,
    // 戦闘エフェクト画像のパスは assets.js の PRISMA_ASSETS.battleFx に統一。
    // ここへ画像パス一覧を再追加しないこと。
    assets: (window.PRISMA_ASSETS && window.PRISMA_ASSETS.battleFx) || {},
    // 全体対象エフェクトの切替。
    // "screen" = 新方式: 命中先エリア(enemy-container / battle-party-bar)に面エフェクト → 左から順に揺れ/ダメージ表示
    // "legacy" = 従前方式: 対象ごとに既存エフェクトを出す
    // HTML側で先に window.PRISMA_BATTLE_FX_AREA_MODE = "legacy"; を置いても上書き可能。
    areaEffectMode: "screen",
    // screen方式: 面エフェクト発生後、最初の個別ダメージ演出まで待つ時間。
    areaHitInitialDelayMs: 400,
    // screen方式: 左から順に出す個別ダメージ演出の間隔。
    areaHitIntervalMs: 300,
    // HP0の敵が解放漏れで残り続けないようにする保険時間。通常の消失タイミングは各ダメージ表示直後に決める。
    defeatHoldExtraMs: 800,
    // 単体/ランダム/追撃などの着弾エフェクト後、数値表示まで待つ時間。
    hitEffectLeadMs: 200,
    // 個別ヒット同士の演出間隔。全体screen方式以外にも適用して、追撃や反撃と順序が崩れないようにする。
    hitSequenceIntervalMs: 300,
    visualReadyAt: 0,
    visualTail: Promise.resolve(),
    pendingDefeatHolds: new WeakMap(),
    defeatHoldTimers: new WeakMap(),
    releasedDefeatedUnits: new WeakSet(),
    lastDamageEventByUnit: new WeakMap(),
    enemyHpDisplayHolds: new WeakMap(),
    enemyHpHoldTimers: new WeakMap(),
    beforeSnapshot: null,
    now() {
      return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    },
    wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    },
    queueVisual(run, options = {}) {
      const beforeMs = Math.max(0, Number(options.beforeMs) || 0);
      const durationMs = Math.max(0, Number(options.durationMs) || 0);
      const estimatedRunMs = Math.max(0, Number(options.estimatedRunMs) || 0);
      const afterMs = Math.max(0, Number(options.afterMs) || 0);
      const now = this.now();
      const startAt = Math.max(now, this.visualReadyAt || 0) + beforeMs;
      const endAt = startAt + estimatedRunMs + durationMs + afterMs;
      this.visualReadyAt = endAt;

      const previous = this.visualTail || Promise.resolve();
      this.visualTail = previous
        .catch(() => {})
        .then(async () => {
          if (beforeMs > 0) await this.wait(beforeMs);
          await run();
          if (durationMs > 0) await this.wait(durationMs);
          if (afterMs > 0) await this.wait(afterMs);
        })
        .catch((error) => console.warn("[PolishFX] visual queue failed", error));

      return {
        startDelayMs: Math.max(0, startAt - now),
        endDelayMs: Math.max(0, endAt - now),
        promise: this.visualTail
      };
    },
    async waitForVisuals(extraMs = 0) {
      const tail = this.visualTail || Promise.resolve();
      await tail.catch(() => {});
      const remain = Math.max(0, (this.visualReadyAt || 0) - this.now(), Number(extraMs) || 0);
      if (remain > 0) await this.wait(remain);
    },
    stripHtml(value) {
      const div = document.createElement("div");
      div.innerHTML = String(value || "");
      return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
    },
    fxConfig(data) {
      // skills.js の各スキルへ battleFx / battleEffect / effectFx / fx / effect を書くと、
      // 既存の自動判定より優先して戦闘エフェクトを指定できる。
      // 例: "battleFx": "meteor"
      // 例: "battleFx": { "screen": "meteor", "hit": "spell-fire" }
      // 例: "battleFx": "assets/effect/fx-meteor-ai.png"
      const raw = data && (data.battleFx ?? data.battleEffect ?? data.effectFx ?? data.fx ?? data.effect);
      if (!raw) return null;
      if (typeof raw === "string") return { kind: raw };
      if (typeof raw === "object") return raw;
      return null;
    },
    isAssetPath(value) {
      const text = String(value || "").trim();
      return /\.(?:png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(text) || /^(?:assets\/|\.\/|\/)/.test(text);
    },
    cssKind(kind) {
      return String(kind || "custom")
        .replace(/^battle-fx-/, "")
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-+|-+$/g, "") || "custom";
    },
    fxValue(config, keys) {
      if (!config) return null;
      for (const key of keys) {
        if (config[key] !== undefined && config[key] !== null && config[key] !== "") return config[key];
      }
      return null;
    },
    normalizeFxKind(value) {
      if (!value) return null;
      if (typeof value === "string") return value.replace(/^battle-fx-/, "").trim();
      if (typeof value === "object") {
        return this.normalizeFxKind(value.kind ?? value.type ?? value.id ?? value.name ?? value.image ?? value.path ?? value.src);
      }
      return null;
    },
    customFxKind(cmd, perHit = false, slot = null) {
      const config = this.fxConfig(cmd?.data);
      if (!config) return null;
      const area = this.isArea(cmd);
      const keys = slot
        ? [slot]
        : perHit
          ? ["hit", "impact", "perHit", "kind", "type", "id", "name", "image", "path", "src"]
          : area
            ? ["screen", "fullScreen", "area", "cast", "kind", "type", "id", "name", "image", "path", "src"]
            : ["cast", "kind", "hit", "impact", "type", "id", "name", "image", "path", "src"];
      return this.normalizeFxKind(this.fxValue(config, keys));
    },
    assetFor(kind) {
      const raw = String(kind || "").trim();
      if (this.isAssetPath(raw)) return raw;
      const key = raw.replace(/^battle-fx-/, "");
      if (this.assets[key]) return this.assets[key];
      if (/^breath-/.test(key)) return this.assets.breath;
      if (/^phys-(fire|ice|thunder|wind|light|dark|chaos)$/.test(key)) return this.assets["neutral-slash"];
      return null;
    },
    isArea(cmd) {
      const scope = [cmd?.targetScope, cmd?.target, cmd?.data?.target].filter(Boolean).join(" ");
      return /全体|全敵|all|蜈ｨ菴|陷茨ｽｨ/i.test(scope);
    },
    areaEffectModeFor(cmd) {
      const config = this.fxConfig(cmd?.data);
      const skillMode = this.fxValue(config, ["areaMode", "allMode", "areaEffectMode", "allTargetEffectMode"]);
      const globalConfig = window.PRISMA_BATTLE_FX || window.PRISMA_BATTLE_EFFECTS || {};
      const globalMode = window.PRISMA_BATTLE_FX_AREA_MODE ||
        window.PRISMA_ALL_TARGET_FX_MODE ||
        globalConfig.areaEffectMode ||
        globalConfig.allTargetEffectMode ||
        globalConfig.areaMode ||
        this.areaEffectMode;
      const mode = String(skillMode || globalMode || "screen").toLowerCase();
      return /legacy|old|default|target|unit|per-target|perhit|hit|従前|旧/.test(mode) ? "legacy" : "screen";
    },
    useScreenAreaEffect(cmd) {
      return this.isArea(cmd) && this.areaEffectModeFor(cmd) === "screen";
    },
    isDefeatedEnemy(unit) {
      return !!(unit && this.isEnemy(unit) && !unit.isFled && Number(unit.hp || 0) <= 0);
    },
    previousSnapshotFor(unit) {
      return (unit && this.beforeSnapshot && typeof this.beforeSnapshot.get === "function") ? this.beforeSnapshot.get(unit) : null;
    },
    hpDisplayForEnemy(unit, actualHp = null) {
      if (!unit || !this.isEnemy(unit)) return actualHp;
      const hold = this.enemyHpDisplayHolds.get(unit);
      if (!hold) return actualHp;
      const until = Number(hold.until || 0);
      if (until && until <= this.now()) {
        this.enemyHpDisplayHolds.delete(unit);
        const timer = this.enemyHpHoldTimers.get(unit);
        if (timer) clearTimeout(timer);
        this.enemyHpHoldTimers.delete(unit);
        return actualHp;
      }
      return Number.isFinite(Number(hold.hp)) ? Number(hold.hp) : actualHp;
    },
    startEnemyHpDisplayHold(unit, fallbackDelayMs = 0, displayHp = null) {
      if (!unit || !this.isEnemy(unit) || unit.isFled) return;
      const prev = this.previousSnapshotFor(unit);
      const hp = displayHp !== null && displayHp !== undefined ? Number(displayHp) : Number(prev?.hp);
      if (!Number.isFinite(hp)) return;
      const actual = Number(unit.hp || 0);
      if (hp === actual) return;
      const fallbackMs = Math.max(360, Math.max(0, Number(fallbackDelayMs) || 0) + Math.max(0, Number(this.defeatHoldExtraMs) || 0));
      const until = this.now() + fallbackMs;
      const current = this.enemyHpDisplayHolds.get(unit);
      if (current && current.until >= until && current.hp === hp) return;
      this.enemyHpDisplayHolds.set(unit, { hp, until });

      const oldTimer = this.enemyHpHoldTimers.get(unit);
      if (oldTimer) clearTimeout(oldTimer);
      const timer = setTimeout(() => {
        const latest = this.enemyHpDisplayHolds.get(unit);
        if (!latest) return;
        if ((latest.until || 0) <= this.now() + 16) {
          this.enemyHpDisplayHolds.delete(unit);
          this.enemyHpHoldTimers.delete(unit);
          this.updateEnemyHpBar(unit);
        }
      }, fallbackMs + 24);
      this.enemyHpHoldTimers.set(unit, timer);
    },
    releaseEnemyHpDisplayHold(unit) {
      if (!unit || !this.isEnemy(unit)) return;
      this.enemyHpDisplayHolds.delete(unit);
      const timer = this.enemyHpHoldTimers.get(unit);
      if (timer) clearTimeout(timer);
      this.enemyHpHoldTimers.delete(unit);
      this.updateEnemyHpBar(unit);
    },
    updateEnemyHpBar(unit) {
      if (!unit || !this.isEnemy(unit) || typeof Battle === "undefined") return;
      const enemies = Battle.enemies || [];
      const index = enemies.indexOf(unit);
      if (index < 0) return;
      const el = this.nodeForUnit("enemy-container", unit, enemies);
      if (!el) return;
      const hp = Math.max(0, Number(unit.hp || 0));
      const maxHp = Math.max(1, Number(unit.baseMaxHp || unit.maxHp || hp || 1));
      const hpPer = Math.max(0, Math.min(100, (hp / maxHp) * 100));
      const hpRatio = maxHp > 0 ? hp / maxHp : 0;
      const bar = el.querySelector(".enemy-hp-val");
      if (bar) bar.style.width = `${hpPer}%`;
      const name = el.querySelector(".enemy-name");
      if (name) name.style.color = hpRatio < 0.5 ? "#ff4" : "#fff";
    },
    releaseHpAfterHit(unit, event) {
      if (event?.damageMatch || event?.healMatch) this.releaseEnemyHpDisplayHold(unit);
    },
    startDefeatedHold(unit, fallbackDelayMs = 0) {
      if (!this.isDefeatedEnemy(unit)) {
        if (unit) this.releasedDefeatedUnits.delete(unit);
        return;
      }
      // 一度ダメージ表示起点で消した敵は、後続の重複ログ・追撃ログで再表示しない。
      if (this.releasedDefeatedUnits.has(unit)) return;
      const now = this.now();
      const fallbackMs = Math.max(
        320,
        Math.max(0, Number(fallbackDelayMs) || 0) + Math.max(0, Number(this.defeatHoldExtraMs) || 0)
      );
      const until = now + fallbackMs;
      const current = this.pendingDefeatHolds.get(unit);
      if (current && current.until >= until) return;
      this.pendingDefeatHolds.set(unit, { until });

      const oldTimer = this.defeatHoldTimers.get(unit);
      if (oldTimer) clearTimeout(oldTimer);
      const timer = setTimeout(() => {
        const latest = this.pendingDefeatHolds.get(unit);
        if (!latest) return;
        if ((latest.until || 0) <= this.now() + 16) {
          this.pendingDefeatHolds.delete(unit);
          this.defeatHoldTimers.delete(unit);
          if (typeof Battle !== "undefined" && typeof Battle.renderEnemies === "function") Battle.renderEnemies();
        }
      }, fallbackMs + 24);
      this.defeatHoldTimers.set(unit, timer);
    },
    holdDefeatedVisible(unit, delayMs = 0) {
      // 旧呼び出し名との互換用。通常はダメージ表示直後に releaseDefeatedAfterHit() で解放する。
      this.startDefeatedHold(unit, delayMs);
    },
    releaseDefeatedHold(unit) {
      if (!unit || !this.isEnemy(unit)) return;
      const hadHold = this.pendingDefeatHolds.has(unit);
      if (this.isDefeatedEnemy(unit)) this.releasedDefeatedUnits.add(unit);
      this.pendingDefeatHolds.delete(unit);
      const timer = this.defeatHoldTimers.get(unit);
      if (timer) clearTimeout(timer);
      this.defeatHoldTimers.delete(unit);
      if (hadHold && typeof Battle !== "undefined" && typeof Battle.renderEnemies === "function") {
        Battle.renderEnemies();
      }
    },
    releaseDefeatedAfterHit(unit, event) {
      if (!event?.defeatAtLog || !this.isDefeatedEnemy(unit)) return;
      this.releaseDefeatedHold(unit);
    },
    shouldKeepDefeatedVisible(unit) {
      if (!this.isDefeatedEnemy(unit)) {
        if (unit) this.releasedDefeatedUnits.delete(unit);
        return false;
      }
      const hold = this.pendingDefeatHolds.get(unit);
      if (!hold) return false;
      const until = typeof hold === "number" ? hold : hold.until;
      if (!until || until <= this.now()) {
        this.pendingDefeatHolds.delete(unit);
        const timer = this.defeatHoldTimers.get(unit);
        if (timer) clearTimeout(timer);
        this.defeatHoldTimers.delete(unit);
        return false;
      }
      return true;
    },
    shouldPlayIntentEffects(cmd) {
      // 発動時エフェクトは全体対象だけに限定する。
      // 単体攻撃・複数ランダム攻撃はHP増減ログ側で命中エフェクト＋振動＋数値を出す。
      // これにより「発動時」と「HP増減時」の二重エフェクトを避ける。
      if (!cmd || cmd.type === "defend" || cmd.type === "skip" || cmd.type === "flee") return false;
      return this.isArea(cmd);
    },
    hitCount(cmd) {
      return Math.max(1, Number(cmd?.data?.count || cmd?.hitCount || 1) || 1);
    },
    ensureLayer() {
      const scene = byId("battle-scene");
      if (!scene) return null;
      let layer = byId("battle-fx-layer");
      if (!layer) {
        layer = document.createElement("div");
        layer.id = "battle-fx-layer";
        scene.appendChild(layer);
      }
      return layer;
    },
    isEnemy(unit) {
      return typeof Battle !== "undefined" && Battle.enemies && Battle.enemies.includes(unit);
    },
    isParty(unit) {
      return typeof Battle !== "undefined" && Battle.party && Battle.party.includes(unit);
    },
    nodeForUnit(containerId, unit, units) {
      const container = byId(containerId);
      if (!container || !unit || !units) return null;
      const index = units.indexOf(unit);
      const nodes = Array.from(container.children || []);
      const uid = unit.uid !== undefined && unit.uid !== null ? String(unit.uid) : null;
      if (uid) {
        const foundByUid = nodes.find((node) => node.dataset?.battleUid === uid);
        if (foundByUid) return foundByUid;
      }
      const foundByIndex = nodes.find((node) => node.dataset?.battleIndex === String(index));
      return foundByIndex || nodes[index] || null;
    },
    isBossTarget(unit) {
      return !!(
        this.isEnemy(unit) &&
        (unit?.isBoss || unit?.id >= 1000 || unit?.baseId >= 1000 || byId("battle-scene")?.dataset?.bossBattle === "true" ||
          (typeof App !== "undefined" && App.data?.battle?.isBossBattle))
      );
    },
    isSupport(data) {
      if (!data) return false;
      if (typeof Battle !== "undefined" && typeof Battle.isSupportSkill === "function" && Battle.isSupportSkill(data)) return true;
      const raw = [data.type, data.name, data.desc].filter(Boolean).join(" ");
      return /回復|蘇生|治療|癒|ヒール|強化|防御|耐性|アップ|蝗槫ｾｩ|陂・函|蠑ｷ蛹|豐ｻ|陟托ｽｷ/.test(raw);
    },
    rawData(data) {
      return [data?.elm, data?.type, data?.name, data?.desc].filter(Boolean).join(" ");
    },
    hasAny(raw, words) {
      return words.some((word) => word && String(raw || "").includes(word));
    },
    elementKind(data, cmd) {
      const raw = this.rawData(data);
      if (this.hasAny(raw, ["火", "メラ", "ギラ", "fire", "轣ｫ", "轤", "繝｡繝ｩ", "繧ｮ繝ｩ", "辯", "霓"])) return "fire";
      if (this.hasAny(raw, ["水", "氷", "ヒャ", "ice", "豌ｴ", "豌ｷ", "繝偵Ε", "雎", "蜃"])) return "ice";
      if (this.hasAny(raw, ["雷", "電", "ライ", "サンダ", "thunder", "髮ｷ", "髮ｻ", "繝ｩ繧､", "繧ｵ繝ｳ繝", "鬮ｮ"])) return "thunder";
      if (this.hasAny(raw, ["風", "バギ", "wind", "鬚ｨ", "繝舌ぐ", "鬯"])) return "wind";
      if (this.hasAny(raw, ["光", "聖", "ホーリ", "light", "蜈", "閨", "陷"])) return "light";
      if (this.hasAny(raw, ["闇", "影", "ドル", "dark", "髣", "繝峨Ν", "蠖ｱ", "證"])) return "dark";
      if (this.hasAny(raw, ["混沌", "カオス", "chaos", "豺ｷ豐", "繧ｫ繧ｪ繧ｹ", "雎ｺ", "髮趣"])) return "chaos";
      if (this.hasAny(raw, ["回復", "治療", "heal", "蝗槫ｾｩ", "豐ｻ", "陂"])) return "heal";
      if (this.hasAny(raw, ["強化", "防御", "buff", "蠑ｷ蛹", "髦ｲ", "閠"])) return "buff";
      if (this.hasAny(raw, ["弱体", "眠", "毒", "debuff", "蠑ｱ菴", "逵", "豈"])) return "debuff";
      if (cmd?.type === "enemy_attack") return "claw";
      return "neutral";
    },
    specialKind(data, cmd) {
      const raw = this.rawData(data);
      if (this.hasAny(raw, ["カラミティ", "終焉", "混沌災厄", "繧ｫ繝ｩ繝溘ユ繧｣", "邨らч", "螂郁誠"])) return "ultimate-chaos";
      if (this.hasAny(raw, ["メテオ", "隕石", "流星", "繝｡繝・が", "髫慕浹", "豬∵弌"])) return "meteor";
      if (this.hasAny(raw, ["ブリザード", "吹雪", "氷槍", "繝悶Μ繧ｶ", "蜷ｹ髮ｪ"])) return "ice-spear";
      if (this.isSpellData(data, cmd) && this.hasAny(raw, ["サンダー", "ライトニング", "雷柱", "繧ｵ繝ｳ繝", "繝ｩ繧､繝医ル"])) return "thunder-pillar";
      if (this.hasAny(raw, ["ポイズン", "毒", "豈", "迪帶ｯ"])) return "poison";
      if (this.hasAny(raw, ["ホーリー", "天罰", "聖光", "繝帙・繝ｪ", "螟ｩ鄂ｰ"])) return "holy-burst";
      if (this.hasAny(raw, ["アビス", "深淵", "闇影", "繧｢繝薙せ", "豺ｱ豺ｵ"])) return "abyss-vortex";
      return null;
    },
    isSpellData(data, cmd) {
      const raw = this.rawData(data);
      if (cmd?.isReaction) return false;
      if (this.hasAny(raw, ["魔法", "呪文", "spell", "鬲疲ｳ", "繝｡繝ｩ", "繝偵Ε", "繝舌ぐ", "繧､繧ｪ", "繝峨Ν"])) return true;
      if (this.isPhysicalData(data, cmd) || this.isSupport(data)) return false;
      return !!data?.elm && !cmd?.isEnemy;
    },
    isPhysicalData(data, cmd) {
      const raw = this.rawData(data);
      return !!(
        cmd?.type === "attack" ||
        cmd?.isReaction ||
        this.hasAny(raw, ["物理", "通常攻撃", "特技", "攻撃", "斬", "剣", "槍", "斧", "爪", "拳", "打撃", "迚ｩ逅", "騾壼ｸｸ謾ｻ", "迚ｹ谿", "謾ｻ謦"])
      );
    },
    isBreathData(data) {
      const raw = this.rawData(data);
      return this.hasAny(raw, ["ブレス", "息", "breath", "繝悶Ξ繧ｹ", "諱ｯ", "郢晄じ"]);
    },
    isDebuffOnlyData(data) {
      if (!data) return false;
      const raw = this.rawData(data);
      if (data.PercentDamage) return false;
      if (String(data.type || "") === "弱体" || this.hasAny(raw, ["弱体", "デバフ", "debuff"])) return true;
      const hasDebuff = !!(data.debuff || data.Poison || data.ToxicPoison || data.Shock || data.Fear || data.SpellSeal || data.SkillSeal || data.HealSeal || data.Debuff);
      return hasDebuff && Number(data.rate || 0) <= 0 && Number(data.base || 0) <= 0;
    },
    statusOnlyKind(data, cmd) {
      if (!data) return null;
      const noDirectDamage = Number(data.rate || 0) <= 0 && Number(data.base || 0) <= 0 && !data.fix && !data.ratio;
      if (!noDirectDamage) return null;
      if (data.Poison || data.ToxicPoison) return "poison";
      if (data.PercentDamage || data.InstantDeath) return "abyss-vortex";
      if (data.debuff || data.Debuff || data.Shock || data.Fear || data.SpellSeal || data.SkillSeal || data.HealSeal) return "debuff";
      return null;
    },
    isSpecialAttackData(data, cmd) {
      const raw = this.rawData(data);
      return !!(
        data &&
        !this.isSupport(data) &&
        !this.isBreathData(data) &&
        this.hasAny(raw, ["特殊", "special", "迚ｹ谿", "奥義", "秘技"])
      );
    },
    supportKind(data, cmd) {
      const type = String(data?.type || "");
      if (type.includes("強化") || data?.buff || data?.elmResUp || data?.HPRegen || data?.MPRegen) return "buff";
      if (type.includes("回復") || type.includes("蘇生") || type.includes("MP回復") || data?.CureAilments || data?.debuff_reset) return "heal-blossom";
      const base = this.elementKind(data, cmd);
      if (base === "buff") return "buff";
      if (base === "debuff") return "debuff";
      if (base === "heal") return "heal-blossom";
      return this.specialKind(data, cmd) || "heal-blossom";
    },
    ultimateSkillKind(data, cmd) {
      const id = Number(data?.id || 0);
      if ([245, 238, 244, 248].includes(id)) return "ultimate-chaos";
      if (id === 246) return "holy-burst";
      if ([247, 166, 242].includes(id)) return "abyss-vortex";
      if (id === 243) return "meteor";
      if ([245, 246, 247, 238, 166, 244, 168, 242, 243, 248].includes(id)) return this.specialKind(data, cmd) || "special-rupture";
      return null;
    },
    spellKind(data, cmd) {
      const base = this.elementKind(data, cmd);
      return ({
        fire: "spell-fire",
        ice: "spell-ice",
        thunder: "spell-thunder",
        wind: "spell-wind",
        light: "spell-light",
        dark: "spell-dark",
        chaos: "spell-chaos"
      })[base] || "spell-dark";
    },
    elementFxKind(prefix, data, cmd) {
      const base = this.elementKind(data, cmd);
      return ["fire", "ice", "thunder", "wind", "light", "dark", "chaos"].includes(base) ? `${prefix}-${base}` : null;
    },
    breathKind(data, cmd) {
      return this.elementFxKind("breath", data, cmd) || "breath";
    },
    physicalElementKind(cmd) {
      return this.elementFxKind("phys", cmd?.data, cmd);
    },
    physicalKind(cmd, perHit = false) {
      const raw = this.rawData(cmd?.data);
      if (cmd?.isReaction) return this.pendingNeutralPhysicalKind || "neutral-chain";
      if (this.hitCount(cmd) > 1) return perHit ? "neutral-slash" : "phys-sword";
      if (this.hasAny(raw, ["槍", "突", "pierce", "spear"])) return "neutral-pierce";
      if (this.hasAny(raw, ["斧", "打", "砕", "粉砕", "smash", "axe"])) return "neutral-smash";
      if (this.hasAny(raw, ["奥義", "渾身", "heavy", "finisher"])) return "neutral-heavy";
      return perHit ? "neutral-slash" : "phys-sword";
    },
    visualKind(cmd, perHit = false) {
      if (!cmd) return "neutral-slash";
      const custom = this.customFxKind(cmd, perHit);
      if (custom) return custom;
      const statusOnly = this.statusOnlyKind(cmd?.data, cmd);
      if (statusOnly) return statusOnly;
      if (this.isDebuffOnlyData(cmd?.data)) {
        if (cmd?.data?.Poison || cmd?.data?.ToxicPoison) return "poison";
        const base = this.elementKind(cmd?.data, cmd);
        return base === "poison" ? "poison" : "debuff";
      }
      if (this.isSupport(cmd?.data)) return this.supportKind(cmd?.data, cmd);
      if (this.isBreathData(cmd?.data)) return this.breathKind(cmd?.data, cmd);
      if (cmd?.isReaction) return this.physicalKind(cmd, perHit);
      const ultimate = this.ultimateSkillKind(cmd?.data, cmd);
      if (ultimate) return ultimate;
      const special = this.specialKind(cmd?.data, cmd);
      if (special) return special;
      if (this.isSpecialAttackData(cmd?.data, cmd)) {
        const base = this.elementKind(cmd?.data, cmd);
        if (["fire", "ice", "thunder", "wind", "light", "dark", "chaos"].includes(base)) return this.spellKind(cmd?.data, cmd);
        return "special-rupture";
      }
      if (this.isSpellData(cmd?.data, cmd)) return this.spellKind(cmd?.data, cmd);
      if (cmd?.isEnemy || cmd?.type === "enemy_attack") return perHit ? "party-hit" : "enemy-claw";
      if (this.isPhysicalData(cmd?.data, cmd)) return this.physicalElementKind(cmd) || (this.isArea(cmd) ? "all-slash" : this.physicalKind(cmd, perHit));
      return "neutral-slash";
    },
    logNeutralPhysicalKind(text) {
      if (this.hasAny(text, ["連携", "騾｣謳ｺ"])) return "neutral-chain";
      if (this.hasAny(text, ["追撃", "追い討ち", "霑ｽ", "霑ｽ縺・ｨ弱■"])) return "neutral-slash";
      if (this.hasAny(text, ["反撃", "蜿肴茶"])) return "neutral-smash";
      if (this.hasAny(text, ["先制", "蜈亥宛"])) return "neutral-pierce";
      return null;
    },
    queueNeutralPhysicalKind(kind) {
      if (!kind) return;
      this.pendingNeutralPhysicalKind = kind;
      if (this.pendingNeutralPhysicalTimer) clearTimeout(this.pendingNeutralPhysicalTimer);
      this.pendingNeutralPhysicalTimer = setTimeout(() => {
        if (this.pendingNeutralPhysicalKind === kind) this.pendingNeutralPhysicalKind = null;
      }, 1600);
      document.documentElement.dataset.polishLastFxCue = kind;
    },
    consumeNeutralPhysicalKind() {
      const kind = this.pendingNeutralPhysicalKind;
      if (kind) {
        this.pendingNeutralPhysicalKind = null;
        if (this.pendingNeutralPhysicalTimer) clearTimeout(this.pendingNeutralPhysicalTimer);
      }
      return kind;
    },
    criticalKindFromLog(text) {
      if (this.hasAny(text, ["かいしん", "会心", "痛恨", "魔力が暴走", "暴走", "防御を貫通", "貫通", "魔法ダメージ2倍", "魔法ダメージ２倍", "呪文ダメージ2倍", "呪文ダメージ２倍", "荳謦", "垓襍ｰ"])) return "critical-spark";
      return null;
    },
    queueCriticalKind(kind) {
      if (!kind) return;
      this.pendingCriticalKind = kind;
      if (this.pendingCriticalTimer) clearTimeout(this.pendingCriticalTimer);
      this.pendingCriticalTimer = setTimeout(() => {
        if (this.pendingCriticalKind === kind) this.pendingCriticalKind = null;
      }, 1400);
      document.documentElement.dataset.polishLastFxCue = kind;
    },
    consumeCriticalKind() {
      const kind = this.pendingCriticalKind;
      if (kind) {
        this.pendingCriticalKind = null;
        if (this.pendingCriticalTimer) clearTimeout(this.pendingCriticalTimer);
      }
      return kind;
    },
    enhancedDamageKind(cmd) {
      if (!cmd || cmd?.isReaction) return null;
      if (cmd?.data?.IgnoreDefense) return "critical-spark";
      const magBuff = Number(cmd?.actor?.battleStatus?.buffs?.mag?.val || 0);
      if (this.isSpellData(cmd?.data, cmd) && (cmd?.actor?.passive?.magDouble || magBuff >= 2)) return "critical-spark";
      return null;
    },
    snapshot() {
      if (typeof Battle === "undefined") return new Map();
      return new Map([...(Battle.party || []), ...(Battle.enemies || [])].filter(Boolean).map((unit) => [unit, {
        hp: Number(unit.hp || 0),
        mp: Number(unit.mp || 0)
      }]));
    },
    targetPool(cmd, support) {
      if (typeof Battle === "undefined") return [];
      if (cmd?.isEnemy) {
        return support
          ? (Battle.enemies || []).filter((e) => e && !e.isFled && !e.isDead)
          : (Battle.party || []).filter((p) => p && !p.isDead);
      }
      return support
        ? (Battle.party || []).filter((p) => p && !p.isDead)
        : (Battle.enemies || []).filter((e) => e && !e.isDead && !e.isFled);
    },
    getTargets(cmd) {
      const support = this.isSupport(cmd?.data);
      let scope = cmd?.targetScope;
      if (!scope && (cmd?.target === "all_enemy" || cmd?.target === "all_ally")) scope = "all";
      if (!scope && cmd?.target === "random") scope = "random";
      const target = cmd?.target;

      if (target && typeof target === "object") return [target].filter(Boolean);
      if (scope && /全体|蜈ｨ|all/i.test(scope)) return this.targetPool(cmd, support);
      if (scope && /ランダム|繝ｩ|random/i.test(scope)) return this.targetPool(cmd, support).slice(0, 1);
      if (scope && /自分|閾ｪ|self/i.test(scope)) return [cmd.actor].filter(Boolean);
      return this.targetPool(cmd, support).slice(0, 1);
    },
    anchor(unit) {
      const layer = this.ensureLayer();
      const scene = byId("battle-scene");
      if (!layer || !scene) return null;
      let el = null;
      if (this.isEnemy(unit)) {
        el = this.nodeForUnit("enemy-container", unit, Battle.enemies);
      } else if (this.isParty(unit)) {
        el = this.nodeForUnit("battle-party-bar", unit, Battle.party);
      }
      const base = scene.getBoundingClientRect();
      const rect = el ? el.getBoundingClientRect() : base;
      const x = rect.left - base.left + rect.width / 2;
      const y = rect.top - base.top + rect.height * (this.isEnemy(unit) ? 0.46 : 0.5);
      return { layer, el, x, y, w: Math.max(54, rect.width), h: Math.max(54, rect.height) };
    },
    effect(unit, kind, options = {}) {
      const pos = this.anchor(unit);
      if (!pos) return;
      const fxKind = this.normalizeFxKind(kind) || "neutral-slash";
      const classKind = this.cssKind(fxKind);
      document.documentElement.dataset.polishLastFxKind = String(fxKind || "");
      const node = document.createElement("div");
      node.className = `battle-fx battle-fx-${classKind}`;
      node.dataset.fxKind = fxKind;
      node.style.left = `${pos.x}px`;
      node.style.top = `${pos.y}px`;
      const imageAsset = options.image || this.assetFor(fxKind);
      const isWide = /all-|ultimate|meteor|pillar|vortex|burst|combo|breath|special|critical/.test(classKind);
      const size = Math.max(72, Math.min(isWide ? 190 : 148, Math.max(pos.w, pos.h) * (options.big || isWide ? 1.08 : 0.76)));
      node.style.width = `${size}px`;
      node.style.height = `${size}px`;
      if (imageAsset) {
        node.classList.add("battle-fx-image");
        node.style.backgroundImage = `url("${imageAsset}")`;
      }
      if (options.hitIndex) {
        const spread = ((options.hitIndex - 1) % 5 - 2) * 7;
        node.style.setProperty("--fx-offset-x", `${spread}px`);
        node.style.setProperty("--fx-rotate", `${spread * 0.7}deg`);
      }
      pos.layer.appendChild(node);
      this.particles(pos, fxKind, { ...options, quiet: !!imageAsset && !options.big });
      setTimeout(() => node.remove(), 760);
    },
    areaRegionForTargets(targets = []) {
      const layer = this.ensureLayer();
      const scene = byId("battle-scene");
      if (!layer || !scene) return null;

      const target = (targets || []).find(Boolean);
      const regionId = target && this.isParty(target) ? "battle-party-bar" : "enemy-container";
      const regionEl = byId(regionId) || scene;
      const base = scene.getBoundingClientRect();
      const rect = regionEl.getBoundingClientRect();
      const width = Math.max(180, rect.width || scene.clientWidth);
      const height = Math.max(86, rect.height || scene.clientHeight);
      return {
        layer,
        scene,
        regionId,
        left: rect.left - base.left,
        top: rect.top - base.top,
        width,
        height
      };
    },
    screenEffect(kind, options = {}) {
      const region = this.areaRegionForTargets(options.targets || []);
      if (!region) return;
      const fxKind = this.normalizeFxKind(kind) || "all-slash";
      const classKind = this.cssKind(fxKind);
      document.documentElement.dataset.polishLastFxKind = String(fxKind || "");

      const clip = document.createElement("div");
      clip.className = `battle-fx-area-clip battle-fx-area-${region.regionId}`;
      clip.style.left = `${region.left}px`;
      clip.style.top = `${region.top}px`;
      clip.style.width = `${region.width}px`;
      clip.style.height = `${region.height}px`;

      const node = document.createElement("div");
      node.className = `battle-fx battle-fx-${classKind} battle-fx-screen`;
      node.dataset.fxKind = fxKind;
      node.style.left = "50%";
      node.style.top = "50%";
      const width = Math.max(220, region.width * 1.04);
      const height = Math.max(96, region.height * 1.02);
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
      const imageAsset = options.image || this.assetFor(fxKind);
      if (imageAsset) {
        node.classList.add("battle-fx-image");
        node.style.backgroundImage = `url("${imageAsset}")`;
      }
      clip.appendChild(node);
      region.layer.appendChild(clip);
      this.particles({ layer: clip, x: region.width / 2, y: region.height / 2, w: width, h: height }, fxKind, {
        big: true,
        quiet: !!imageAsset && !options.particles
      });
      setTimeout(() => clip.remove(), 920);
    },
    particles(pos, kind, options = {}) {
      const colors = {
        fire: "#ffb15e",
        ice: "#dff",
        thunder: "#fff28a",
        wind: "#81e5ab",
        light: "#fff2a8",
        dark: "#b156ff",
        chaos: "#67d7c4",
        heal: "#8fffad",
        buff: "#67d7c4",
        debuff: "#c36bff",
        slash: "#ffe2a0",
        claw: "#ff6767",
        combo: "#ffe2a0",
        "all-slash": "#f4c95d",
        "enemy-claw": "#ff6767",
        "party-hit": "#ff7777",
        meteor: "#ff8a3d",
        "ice-spear": "#dff",
        "thunder-pillar": "#fff28a",
        "abyss-vortex": "#b156ff",
        "holy-burst": "#fff2a8",
        poison: "#c36bff",
        "ultimate-chaos": "#67d7c4",
        "heal-blossom": "#8fffad",
        "special-rupture": "#c36bff",
        "critical-spark": "#fff2a8",
        "neutral-slash": "#d6d1c2",
        "neutral-smash": "#aeb4b8",
        "neutral-pierce": "#e8edf0",
        "neutral-combo": "#cfd3d6",
        "neutral-chain": "#d9dde0",
        "neutral-heavy": "#9ea4a8",
        "phys-sword": "#d6d1c2",
        "phys-spear": "#e8edf0",
        "phys-axe": "#aeb4b8",
        "phys-combo": "#cfd3d6",
        "phys-fire": "#ff9b45",
        "phys-ice": "#dff",
        "phys-thunder": "#fff28a",
        "phys-wind": "#81e5ab",
        "phys-light": "#fff2a8",
        "phys-dark": "#b156ff",
        "phys-chaos": "#67d7c4",
        "spell-fire": "#ffb15e",
        "spell-ice": "#dff",
        "spell-thunder": "#fff28a",
        "spell-wind": "#81e5ab",
        "spell-light": "#fff2a8",
        "spell-dark": "#b156ff",
        "spell-chaos": "#67d7c4",
        breath: "#ff7777",
        "breath-fire": "#ff8a3d",
        "breath-ice": "#dff",
        "breath-thunder": "#fff28a",
        "breath-wind": "#81e5ab",
        "breath-light": "#fff2a8",
        "breath-dark": "#b156ff",
        "breath-chaos": "#67d7c4"
      };
      if (options.quiet) return;
      const count = options.big ? 10 : 6;
      for (let i = 0; i < count; i += 1) {
        const dot = document.createElement("span");
        dot.className = "battle-fx-particle";
        dot.style.left = `${pos.x}px`;
        dot.style.top = `${pos.y}px`;
        dot.style.color = colors[kind] || "#fff";
        const angle = (Math.PI * 2 * i / count) + (options.big ? 0.25 : 0);
        const distance = 28 + (i % 3) * 12;
        dot.style.setProperty("--fx-x", `${Math.cos(angle) * distance}px`);
        dot.style.setProperty("--fx-y", `${Math.sin(angle) * distance}px`);
        pos.layer.appendChild(dot);
        setTimeout(() => dot.remove(), 700);
      }
    },
    float(unit, text, color, options = {}) {
      const pos = this.anchor(unit);
      if (!pos) return;
      const node = document.createElement("div");
      node.className = "battle-fx-float";
      if (options.critical) node.classList.add("battle-fx-critical-float");
      node.textContent = text;
      const jitter = options.hitIndex ? ((options.hitIndex - 1) % 5 - 2) * 10 : 0;
      node.style.left = `${pos.x + jitter}px`;
      node.style.top = `${pos.y - 18 - Math.floor((options.hitIndex || 1) / 2) * 2}px`;
      node.style.color = color;
      pos.layer.appendChild(node);
      setTimeout(() => node.remove(), 820);
    },
    mark(unit, cls) {
      const pos = this.anchor(unit);
      if (!pos?.el) return;
      pos.el.classList.remove(cls);
      void pos.el.offsetWidth;
      pos.el.classList.add(cls);
      setTimeout(() => pos.el?.classList.remove(cls), 520);
    },
    unitFromText(text) {
      if (typeof Battle === "undefined") return null;
      const units = [...(Battle.party || []), ...(Battle.enemies || [])].filter(Boolean);
      return units
        .slice()
        .sort((a, b) => String(b.name || "").length - String(a.name || "").length)
        .find((unit) => unit?.name && text.includes(this.stripHtml(unit.name))) || null;
    },
    unitLeftOrderIndex(unit) {
      if (typeof Battle === "undefined" || !unit) return 0;
      const units = this.isParty(unit) ? (Battle.party || []) : (Battle.enemies || []);
      const withPos = units
        .filter(Boolean)
        .map((entry, index) => {
          const pos = this.anchor(entry);
          return { unit: entry, index, x: pos ? pos.x : index * 100 };
        })
        .sort((a, b) => (a.x - b.x) || (a.index - b.index));
      const orderIndex = withPos.findIndex((entry) => entry.unit === unit);
      return Math.max(0, orderIndex);
    },
    areaHitDelay(cmd, unit, hitIndex = 1) {
      if (!this.useScreenAreaEffect(cmd)) return Math.min(120, (hitIndex - 1) * 24);
      return this.areaHitInitialDelayMs + this.unitLeftOrderIndex(unit) * this.areaHitIntervalMs;
    },
    hitColorFromLog(message, fallback = "#ff7777") {
      const match = String(message || "").match(/color:\s*([^;"']+)/i);
      return match ? match[1].trim() : fallback;
    },
    isDualWieldCommand(cmd) {
      return !!(
        cmd &&
        !cmd.isReaction &&
        cmd.type !== "item" &&
        typeof PassiveSkill !== "undefined" &&
        typeof PassiveSkill.getSumValue === "function" &&
        PassiveSkill.getSumValue(cmd.actor, "dual_dmg_mult") > 0
      );
    },
    isDualWieldFollowUpLog(text) {
      const cmd = this.current?.cmd;
      const actorName = this.stripHtml(cmd?.actor?.name || "");
      const normalized = String(text || "").replace(/\s+/g, " ").trim();
      return !!(
        this.isDualWieldCommand(cmd) &&
        actorName &&
        (normalized === `${actorName}の 追撃！` ||
          normalized === `${actorName}の 追撃!` ||
          normalized === `${actorName}の 追撃`)
      );
    },
    enqueueHitEvent(event) {
      if (!event?.unit) return null;
      const { unit, cmd, hitIndex, area, screenArea, damageMatch, healMatch, kind, criticalKind, amount, hitColor } = event;
      const sequenceAfterMs = screenArea ? this.areaHitIntervalMs : this.hitSequenceIntervalMs;
      const shouldShowPointEffect = !area || !screenArea;
      const leadMs = shouldShowPointEffect ? this.hitEffectLeadMs : 0;
      const queued = this.queueVisual(async () => {
        if (damageMatch) {
          if (shouldShowPointEffect) {
            this.effect(unit, kind, { hitIndex });
            if (criticalKind) this.effect(unit, criticalKind, { hitIndex, big: true });
            await this.wait(leadMs);
          }
          this.mark(unit, "battle-hit-shake");
          if (this.isBossTarget(unit)) this.mark(unit, "battle-boss-flash");
          if (this.isParty(unit)) this.mark(unit, "battle-party-damaged");
          if (criticalKind) {
            this.float(unit, `-${amount}`, "#fff2a8", { hitIndex, critical: true });
          } else {
            this.float(unit, `-${amount}`, hitColor, { hitIndex });
          }
          this.releaseHpAfterHit(unit, event);
          this.releaseDefeatedAfterHit(unit, event);
          return;
        }
        if (healMatch) {
          if (shouldShowPointEffect) {
            this.effect(unit, kind, { hitIndex });
            await this.wait(leadMs);
          }
          this.mark(unit, "battle-heal-pulse");
          this.float(unit, `+${amount}`, "#8fffad", { hitIndex });
          this.releaseHpAfterHit(unit, event);
          return;
        }
        if (shouldShowPointEffect) {
          this.effect(unit, kind, { hitIndex, big: false });
          await this.wait(leadMs);
        }
        this.float(unit, "MISS", "#d6d1c2", { hitIndex });
      }, { estimatedRunMs: leadMs, afterMs: sequenceAfterMs });

      if ((damageMatch || healMatch) && this.isEnemy(unit)) this.startEnemyHpDisplayHold(unit, queued.endDelayMs);
      if (damageMatch && event.defeatAtLog) this.startDefeatedHold(unit, queued.endDelayMs);
      return queued;
    },
    flushAreaHits(context) {
      if (!context || !Array.isArray(context.areaHitEvents) || context.areaHitEvents.length === 0) return;
      const events = context.areaHitEvents.splice(0);
      events
        .sort((a, b) => {
          const order = this.unitLeftOrderIndex(a.unit) - this.unitLeftOrderIndex(b.unit);
          return order || ((a.hitIndex || 0) - (b.hitIndex || 0));
        })
        .forEach((event) => {
          const queued = this.enqueueHitEvent(event);
          if (context) context.maxHitDelay = Math.max(context.maxHitDelay || 0, queued?.endDelayMs || 0);
        });
    },
    playIntentEffects(cmd, options = {}) {
      if (!this.shouldPlayIntentEffects(cmd)) return 0;
      const targets = this.getTargets(cmd).filter(Boolean);
      if (targets.length === 0) return 0;
      const kind = options.kind || this.customFxKind(cmd, false, this.useScreenAreaEffect(cmd) ? "screen" : null) || this.visualKind(cmd, false);
      if (this.useScreenAreaEffect(cmd)) {
        this.queueVisual(() => {
          this.screenEffect(kind, { big: true, targets });
        }, { afterMs: this.areaHitInitialDelayMs });
        this.lastAt = this.now();
        return targets.length;
      }
      targets.forEach((target) => {
        this.queueVisual(() => {
          this.effect(target, kind, { big: targets.length > 1 });
        }, { afterMs: Math.min(90, this.hitSequenceIntervalMs) });
      });
      this.lastAt = this.now();
      return targets.length;
    },
    reactToLog(message) {
      if (!this.current) return;
      const text = this.stripHtml(message);
      if (this.isDualWieldFollowUpLog(text)) {
        this.current.dualWieldFollowUp = true;
        this.current.dualWieldKind = this.visualKind(this.current.cmd, false);
        this.playIntentEffects(this.current.cmd, { kind: this.current.dualWieldKind });
        return;
      }
      if (!text || text === "--- ターン開始 ---") return;
      const logCriticalKind = this.criticalKindFromLog(text);
      if (logCriticalKind) this.queueCriticalKind(logCriticalKind);
      if (this.current?.cmd?.isReaction) {
        this.queueNeutralPhysicalKind(this.logNeutralPhysicalKind(text));
      }
      const unit = this.unitFromText(text);
      if (!unit) return;

      const damageMatch = text.match(/に\s*([0-9,]+)\s*のダメージ/) || text.match(/ダメージを\s*([0-9,]+)\s*受けた/) || text.match(/に\s*([0-9,]+)\s*の?ダメージ/);
      const healMatch = text.match(/HP[をが]\s*([0-9,]+)\s*回復/) || text.match(/([0-9,]+)\s*回復/);
      const missMatch = /ミス|身をかわした|うけない|効かなかった|きかなかった/.test(text);
      const defeatMatch = /倒れた|息絶えた|戦闘不能/.test(text);

      if (!damageMatch && !healMatch && !missMatch) {
        if (defeatMatch) {
          const lastEvent = this.lastDamageEventByUnit.get(unit);
          if (lastEvent) lastEvent.defeatAtLog = true;
          const pending = Math.max(0, (this.visualReadyAt || 0) - this.now());
          this.startDefeatedHold(unit, pending);
        }
        return;
      }

      this.current.hits += 1;
      this.totalHitEvents += 1;
      document.documentElement.dataset.polishBattleFxHits = String(this.totalHitEvents);

      const hitIndex = this.current.hits;
      const cmd = this.current.cmd;
      const area = this.isArea(cmd);
      const screenArea = this.useScreenAreaEffect(cmd);

      let kind = null;
      let criticalKind = null;
      if (damageMatch) {
        kind = cmd?.isReaction
          ? (this.consumeNeutralPhysicalKind() || this.visualKind(cmd, true))
          : (this.current?.dualWieldKind || this.visualKind(cmd, true));
        criticalKind = this.consumeCriticalKind() || this.enhancedDamageKind(cmd);
      } else if (healMatch) {
        kind = this.visualKind(cmd, true) || "heal-blossom";
      } else {
        kind = cmd?.isReaction
          ? (this.consumeNeutralPhysicalKind() || "neutral-slash")
          : (this.current?.dualWieldKind || this.visualKind(cmd, true) || (this.isParty(unit) ? "party-hit" : "neutral-slash"));
      }

      const event = {
        unit,
        cmd,
        hitIndex,
        area,
        screenArea,
        damageMatch: !!damageMatch,
        healMatch: !!healMatch,
        missMatch: !!missMatch,
        kind,
        criticalKind,
        amount: (damageMatch || healMatch)?.[1]?.replace(/,/g, "") || "",
        hitColor: this.hitColorFromLog(message),
        defeatAtLog: !!damageMatch && this.isDefeatedEnemy(unit)
      };

      if (damageMatch) {
        this.lastDamageEventByUnit.set(unit, event);
        if (this.isEnemy(unit)) this.startEnemyHpDisplayHold(unit);
        if (event.defeatAtLog) this.startDefeatedHold(unit);
      } else if (healMatch && this.isEnemy(unit)) {
        this.startEnemyHpDisplayHold(unit);
      }

      if (screenArea) {
        if (!Array.isArray(this.current.areaHitEvents)) this.current.areaHitEvents = [];
        this.current.areaHitEvents.push(event);
        const pending = Math.max(0, (this.visualReadyAt || 0) - this.now());
        const estimatedOrderDelay = this.unitLeftOrderIndex(unit) * this.areaHitIntervalMs + this.areaHitIntervalMs;
        if (damageMatch && event.defeatAtLog) this.startDefeatedHold(unit, pending + estimatedOrderDelay);
        this.current.maxHitDelay = Math.max(this.current.maxHitDelay || 0, pending + estimatedOrderDelay);
        return;
      }

      const queued = this.enqueueHitEvent(event);
      if (this.current) {
        this.current.maxHitDelay = Math.max(this.current.maxHitDelay || 0, queued?.endDelayMs || 0);
      }
    },
    markEnemyIntent(cmd) {
      if (!cmd?.isEnemy || !cmd.actor) return false;
      this.mark(cmd.actor, "battle-enemy-action");
      return true;
    },
    async playIntent(cmd) {
      const movedEnemy = this.markEnemyIntent(cmd);
      const targetCount = this.playIntentEffects(cmd);
      if (targetCount === 0) {
        if (movedEnemy) await new Promise((resolve) => setTimeout(resolve, 110));
        return;
      }
      const waitMs = this.useScreenAreaEffect(cmd) ? 0 : (targetCount > 1 ? 310 : 240);
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    },
    async playResults(cmd, before, options = {}) {
      if (!before || typeof Battle === "undefined") return;
      const units = [...(Battle.party || []), ...(Battle.enemies || [])].filter(Boolean);
      const changes = units.map((unit) => {
        const prev = before.get(unit);
        if (!prev) return null;
        return { unit, hpDelta: Number(unit.hp || 0) - prev.hp, mpDelta: Number(unit.mp || 0) - prev.mp };
      }).filter(Boolean);

      const damaged = changes.filter((change) => change.hpDelta < 0).slice(0, 6);
      const healed = changes.filter((change) => change.hpDelta > 0).slice(0, 6);
      const area = this.isArea(cmd);

      if (options.skipNumbers) {
        // ログ側で演出をキュー化しているため、全体/単体/ランダム/追撃のいずれも
        // ここでは重ね描きせず、キューが消化されるまで待つ。
        this.flushAreaHits(options.actionContext);
        await this.waitForVisuals(120);
        return;
      }

      const sortByLeft = (items) => items
        .slice()
        .sort((a, b) => this.unitLeftOrderIndex(a.unit) - this.unitLeftOrderIndex(b.unit));
      const damagedOrdered = this.useScreenAreaEffect(cmd) ? sortByLeft(damaged) : damaged;
      const healedOrdered = this.useScreenAreaEffect(cmd) ? sortByLeft(healed) : healed;
      const resultInterval = this.useScreenAreaEffect(cmd) ? this.areaHitIntervalMs : 45;
      const resultStartDelay = this.useScreenAreaEffect(cmd) ? this.areaHitInitialDelayMs : 0;

      damagedOrdered.forEach(({ unit, hpDelta }, index) => {
        const beforeMs = index === 0 ? resultStartDelay : 0;
        const unitDefeated = this.isDefeatedEnemy(unit);
        const queued = this.queueVisual(async () => {
          if (!area) {
            this.effect(unit, this.visualKind(cmd, true));
            await this.wait(this.hitEffectLeadMs);
          }
          this.mark(unit, "battle-hit-shake");
          if (this.isBossTarget(unit)) this.mark(unit, "battle-boss-flash");
          if (this.isParty(unit)) this.mark(unit, "battle-party-damaged");
          this.float(unit, `${hpDelta}`, "#ff7777");
          this.releaseEnemyHpDisplayHold(unit);
          if (unitDefeated) this.releaseDefeatedHold(unit);
        }, { beforeMs, estimatedRunMs: area ? 0 : this.hitEffectLeadMs, afterMs: resultInterval });
        if (this.isEnemy(unit)) this.startEnemyHpDisplayHold(unit, queued.endDelayMs, before.get(unit)?.hp);
        if (unitDefeated) this.startDefeatedHold(unit, queued.endDelayMs);
      });

      healedOrdered.forEach(({ unit, hpDelta }, index) => {
        const beforeMs = damagedOrdered.length === 0 && index === 0 ? resultStartDelay : 0;
        this.queueVisual(async () => {
          if (!area) {
            this.effect(unit, "heal");
            await this.wait(this.hitEffectLeadMs);
          }
          this.mark(unit, "battle-heal-pulse");
          this.float(unit, `+${hpDelta}`, "#8fffad");
          this.releaseEnemyHpDisplayHold(unit);
        }, { beforeMs, estimatedRunMs: area ? 0 : this.hitEffectLeadMs, afterMs: resultInterval });
        if (this.isEnemy(unit)) this.startEnemyHpDisplayHold(unit, resultStartDelay + (index + 1) * resultInterval, before.get(unit)?.hp);
      });

      if (damaged.length || healed.length) {
        await this.waitForVisuals(120);
      }
    }
  };

  const installBattleEffects = () => {
    if (typeof Battle === "undefined" || typeof Battle.processAction !== "function" || Battle.processAction.__polishedEffects) return;
    window.PolishBattleFX = BattleFX;
    if (typeof Battle.log === "function" && !Battle.log.__polishedEffects) {
      const originalLog = Battle.log.bind(Battle);
      Battle.log = (message) => {
        const result = originalLog(message);
        try {
          BattleFX.reactToLog(message);
        } catch (error) {
          console.warn("[PolishFX] log reaction failed", error);
        }
        return result;
      };
      Battle.log.__polishedEffects = true;
    }
    const originalProcessAction = Battle.processAction.bind(Battle);
    Battle.processAction = async (cmd) => {
      const before = BattleFX.snapshot();
      const previous = BattleFX.current;
      const previousSnapshot = BattleFX.beforeSnapshot;
      if (previous) BattleFX.flushAreaHits(previous);
      BattleFX.beforeSnapshot = before;
      BattleFX.current = { cmd, hits: 0, maxHitDelay: 0, areaHitEvents: [] };
      const actionContext = BattleFX.current;
      let loggedHits = 0;
      try {
        await BattleFX.playIntent(cmd);
      } catch (error) {
        console.warn("[PolishFX] intent failed", error);
      }
      let result;
      let visualWaitMs = 0;
      try {
        result = await originalProcessAction(cmd);
        loggedHits = actionContext?.hits || 0;
        visualWaitMs = actionContext?.maxHitDelay || 0;
      } finally {
        BattleFX.current = previous;
      }
      try {
        await BattleFX.playResults(cmd, before, { skipNumbers: loggedHits > 0, visualWaitMs, actionContext });
      } catch (error) {
        console.warn("[PolishFX] result failed", error);
      } finally {
        BattleFX.beforeSnapshot = previousSnapshot;
      }
      return result;
    };
    Battle.processAction.__polishedEffects = true;
  };

  const patchRuntime = () => {
    if (typeof App !== "undefined" && typeof App.updateHUD === "function" && !App.updateHUD.__polished) {
      const originalUpdateHUD = App.updateHUD.bind(App);
      App.updateHUD = (...args) => {
        const result = originalUpdateHUD(...args);
        requestAnimationFrame(fixStaticText);
        return result;
      };
      App.updateHUD.__polished = true;
    }
    if (typeof Field !== "undefined" && typeof Field.render === "function" && !Field.render.__polished) {
      const originalRender = Field.render.bind(Field);
      Field.render = (...args) => {
        const result = originalRender(...args);
        requestAnimationFrame(fixStaticText);
        return result;
      };
      Field.render.__polished = true;
    }
  };

  const boot = () => {
    installGraphics();
    installThemes();
    installNames();
    patchRuntime();
    installBattleEffects();
    enhanceControls();
    fixStaticText();
    setTimeout(fixStaticText, 60);
    setTimeout(fixStaticText, 350);
  };

  boot();
  document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("load", () => {
    boot();
    setTimeout(boot, 120);
  });
})();
