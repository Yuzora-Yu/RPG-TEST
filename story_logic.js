/* story_logic.js - generated split from original story.js. Keep editor output out of this file. */
const StoryManager = {
    // ==========================================
    // 0. プロパティ・初期化
    // ==========================================
    textSpeed: 20,
    newlineWait: 400,
    backlog: [],
    active: false,
    currentScript: null,
    index: 0,
    onComplete: null,

    // ==========================================
    // 目的表示の正本
    // ==========================================
    // 今後の「現在の目的」テキストは storyStep / subStep を基準にここで管理する。
    // UI側や main.js 側に目的文の switch 文を増やさないこと。
    // 現在のメインストーリー上限に到達した場合は、
    // 下の dungeonObjectiveMilestones に従ってダンジョン目標へ自動で切り替える。
    maxMainStoryProgress: (typeof STORY_MANAGER_DATA !== "undefined" && STORY_MANAGER_DATA.maxMainStoryProgress) ? STORY_MANAGER_DATA.maxMainStoryProgress : { storyStep: 10, subStep: 0 },

    storyObjectives: (typeof STORY_MANAGER_DATA !== "undefined" && STORY_MANAGER_DATA.storyObjectives) ? STORY_MANAGER_DATA.storyObjectives : {},

    dungeonObjectiveMilestones: (typeof STORY_MANAGER_DATA !== "undefined" && STORY_MANAGER_DATA.dungeonObjectiveMilestones) ? STORY_MANAGER_DATA.dungeonObjectiveMilestones : [],

    getProgressKey: function(progress) {
        const step = Number(progress?.storyStep || 0);
        const sub = Number(progress?.subStep || 0);
        return `${step}-${sub}`;
    },

    isMainStoryComplete: function(progress) {
        const step = Number(progress?.storyStep || 0);
        const sub = Number(progress?.subStep || 0);
        const max = this.maxMainStoryProgress;
        if (step > max.storyStep) return true;
        if (step < max.storyStep) return false;
        return sub >= max.subStep;
    },

    getDungeonObjectiveText: function(data) {
        const dungeon = data?.dungeon || {};
        const progress = data?.progress || {};
        const maxFloor = Number(dungeon.maxFloor || progress.maxFloor || 0);
        const tryCount = Number(dungeon.tryCount || 0);

        if (maxFloor <= 0 && tryCount <= 0) {
            return "メニューからダンジョンに挑戦しよう";
        }

        for (const milestone of this.dungeonObjectiveMilestones) {
            if (maxFloor < milestone.floor) return milestone.text;
        }

        const killCounts = data?.book?.killCounts || {};
        const calamityKills = Number(killCounts[902000] || 0) + Number(killCounts[2000] || 0);
        if (calamityKills <= 0) {
            return "メダルを集めて災厄に挑もう";
        }

        return "ダンジョンで最強装備をそろえよう";
    },

    getObjectiveText: function(data = null) {
        if (!data && typeof App !== 'undefined') data = App.data;
        const progress = data?.progress || {};

        if (this.isMainStoryComplete(progress)) {
            return this.getDungeonObjectiveText(data);
        }

        const key = this.getProgressKey(progress);
        if (this.storyObjectives[key]) return this.storyObjectives[key];

        // 未定義の進行度でも画面が空にならないようにする。
        // 新しい storyStep/subStep を追加したら、まず storyObjectives に目的文を足す。
        return "冒険を進めよう！";
    },
	

    /**
     * ストーリー演出用の一時強化APIを、story.js側で安全に補完する。
     *
     * もともと TEMP_LB_START / TEMP_LB_CLEAR は App.activateTemporaryStoryPower /
     * App.clearTemporaryStoryPower の存在を前提にしていたが、実装が無い環境では
     * 命令が無視され、開幕全滅後のLB99救済が発動しなかった。
     *
     * この補完は「現在の戦闘パーティだけ」を一時的にLB99扱いにし、
     * 戦闘終了または明示解除時に元のLBへ戻す。lbProgress は触らないため、
     * 通常の限界突破進行には影響しない。
     */
    installTemporaryStoryPowerApi: function() {
        if (typeof App === 'undefined' || !App) return false;

        const getPartyTargets = () => {
            if (!App.data || !Array.isArray(App.data.characters)) return [];
            const partyUids = Array.isArray(App.data.party)
                ? App.data.party.filter(uid => !!uid)
                : [];

            let targets = App.data.characters.filter(c => c && partyUids.includes(c.uid));

            // パーティ情報が壊れていても、開幕救済だけは主人公へ届くようにする。
            if (targets.length === 0) {
                const hero = App.data.characters.find(c => c && (c.charId === 301 || c.uid === 'p1' || c.isHero));
                if (hero) targets = [hero];
            }

            return targets;
        };

        const clampLb = (value) => {
            return Math.max(0, Math.min(99, Math.floor(Number(value) || 0)));
        };

        const recalcAndClampVitals = (char) => {
            if (!char || typeof App.calcStats !== 'function') return;
            const stats = App.calcStats(char);
            if (Number.isFinite(Number(stats?.maxHp)) && char.currentHp !== undefined) {
                char.currentHp = Math.max(0, Math.min(Number(char.currentHp) || 0, stats.maxHp));
            }
            if (Number.isFinite(Number(stats?.maxMp)) && char.currentMp !== undefined) {
                char.currentMp = Math.max(0, Math.min(Number(char.currentMp) || 0, stats.maxMp));
            }
        };

        const findCharByUid = (uid) => {
            if (!App.data || !Array.isArray(App.data.characters)) return null;
            return App.getChar
                ? App.getChar(uid)
                : App.data.characters.find(c => c && c.uid === uid);
        };

        // 重要：一時LB99のまま App.syncDerivedLimitBreaks() が走ると、
        // backfillLimitBreakLegacy が「正規のLB99」と誤認して恒久化してしまう。
        // そのため、同期時だけ元LBへ戻し、同期後に再び一時LBを適用する。
        if (typeof App.syncDerivedLimitBreaks === 'function' && !App.__storyTempPowerSyncWrapped) {
            const originalSyncDerivedLimitBreaks = App.syncDerivedLimitBreaks.bind(App);
            App.syncDerivedLimitBreaks = function(options = {}) {
                const temp = App.data?.progress?.tempStoryPower;
                if (!temp || !Array.isArray(temp.targets)) {
                    return originalSyncDerivedLimitBreaks(options);
                }

                temp.targets.forEach(snapshot => {
                    const char = findCharByUid(snapshot.uid);
                    if (char) char.limitBreak = clampLb(snapshot.limitBreak);
                });

                const result = originalSyncDerivedLimitBreaks(options);

                // 同期によって得た正規LBを、解除時の復元先として更新する。
                temp.targets.forEach(snapshot => {
                    const char = findCharByUid(snapshot.uid);
                    if (char) snapshot.limitBreak = clampLb(char.limitBreak);
                });

                const targetLb = clampLb(temp.limitBreak ?? 99);
                temp.targets.forEach(snapshot => {
                    const char = findCharByUid(snapshot.uid);
                    if (!char) return;
                    char.limitBreak = targetLb;
                    if (typeof App.calcStats === 'function') App.calcStats(char);
                });

                return result;
            };
            App.__storyTempPowerSyncWrapped = true;
        }

        if (typeof App.applyTemporaryStoryPower !== 'function') {
            App.applyTemporaryStoryPower = function() {
                const temp = App.data?.progress?.tempStoryPower;
                if (!temp || !Array.isArray(temp.targets)) return false;

                const targetLb = clampLb(temp.limitBreak ?? 99);
                temp.targets.forEach(snapshot => {
                    const char = App.getChar
                        ? App.getChar(snapshot.uid)
                        : App.data.characters.find(c => c && c.uid === snapshot.uid);
                    if (!char) return;
                    char.limitBreak = targetLb;
                    if (typeof App.calcStats === 'function') App.calcStats(char);
                });
                return true;
            };
        }

        if (typeof App.activateTemporaryStoryPower !== 'function') {
            App.activateTemporaryStoryPower = function(options = {}) {
                if (!App.data) return false;
                if (!App.data.progress) App.data.progress = {};

                const id = options.id || 'story_temp_power';
                const targetLb = clampLb(options.limitBreak ?? options.value ?? 99);

                // 別IDの一時強化が残っている場合は、先に元へ戻してから開始する。
                const current = App.data.progress.tempStoryPower;
                if (current && current.id && current.id !== id && typeof App.clearTemporaryStoryPower === 'function') {
                    App.clearTemporaryStoryPower({ id: current.id, force: true, skipSave: true });
                }

                const existing = App.data.progress.tempStoryPower;
                if (existing && existing.id === id && Array.isArray(existing.targets)) {
                    existing.limitBreak = targetLb;
                    existing.reason = options.reason || existing.reason || 'story_event';
                    App.applyTemporaryStoryPower();
                    if (typeof App.save === 'function') App.save();
                    return true;
                }

                const targets = getPartyTargets();
                if (targets.length === 0) return false;

                App.data.progress.tempStoryPower = {
                    id,
                    limitBreak: targetLb,
                    reason: options.reason || 'story_event',
                    startedAt: Date.now(),
                    targets: targets.map(c => ({
                        uid: c.uid,
                        limitBreak: clampLb(c.limitBreak)
                    }))
                };

                App.applyTemporaryStoryPower();
                if (typeof App.save === 'function') App.save();
                if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
                return true;
            };
        }

        if (typeof App.clearTemporaryStoryPower !== 'function') {
            App.clearTemporaryStoryPower = function(options = {}) {
                const temp = App.data?.progress?.tempStoryPower;
                if (!temp) return false;

                const requestedId = options.id || null;
                if (requestedId && temp.id !== requestedId && !options.force) return false;

                if (Array.isArray(temp.targets)) {
                    temp.targets.forEach(snapshot => {
                        const char = App.getChar
                            ? App.getChar(snapshot.uid)
                            : App.data.characters.find(c => c && c.uid === snapshot.uid);
                        if (!char) return;
                        char.limitBreak = clampLb(snapshot.limitBreak);
                        recalcAndClampVitals(char);
                    });
                }

                delete App.data.progress.tempStoryPower;

                // 戦闘勝利などで恒久的なLB進行が増えていた場合は、解除後に正規値へ再同期する。
                if (typeof App.syncDerivedLimitBreaks === 'function') {
                    App.syncDerivedLimitBreaks();
                    if (Array.isArray(temp.targets)) {
                        temp.targets.forEach(snapshot => {
                            const char = App.getChar
                                ? App.getChar(snapshot.uid)
                                : App.data.characters.find(c => c && c.uid === snapshot.uid);
                            recalcAndClampVitals(char);
                        });
                    }
                }

                if (!options.skipSave && typeof App.save === 'function') App.save();
                if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
                return true;
            };
        }

        return true;
    },

    /**
     * 主人公のリミットブレイクを同期
     */
    syncHeroLimitBreak: function() {
		if (!App.data || !App.data.characters) return;
		this.installTemporaryStoryPowerApi();
		const hero = App.data.characters.find(c => c.charId === 301 || c.uid === 'p1');
		if (hero && App.data.progress && App.data.dungeon) {
			if (typeof App.syncDerivedLimitBreaks === 'function') {
				App.syncDerivedLimitBreaks({ heroOnly: true });
			}
			// 一時強化中のロード復帰・STEP同期でLB99が消えないように再適用する。
			if (App.data.progress.tempStoryPower && typeof App.applyTemporaryStoryPower === 'function') {
				App.applyTemporaryStoryPower();
			}
			if (typeof App.calcStats === 'function') App.calcStats(hero);
		}
	},
	


    /**
     * フィールド演出は story.js の会話スクリプト内に直接書く。
     * main.js には「画像を指定タイルに置く」などの描画補助だけを残し、
     * シナリオ固有の座標・移動・暗転・エフェクトは各イベント本文の commands で管理する。
     * 旧来のプリセット参照は廃止し、ストーリーを書きながら座標や演出タイミングを調整できる構成に統一する。
     */

    cloneFieldVisualCommand: function(cmd) {
        if (!cmd || typeof cmd !== 'object') return cmd;
        const copy = { ...cmd };
        if (cmd.fallback && typeof cmd.fallback === 'object') copy.fallback = { ...cmd.fallback };
        return copy;
    },

    isInlineStoryCommand: function(line) {
        if (!line || typeof line !== 'object') return false;
        return line.type === 'FIELD_CUTSCENE'
            || line.type === 'MAP_VISUAL'
            || line.type === 'WAIT'
            || line.type === 'STORY_UI'
            || line.op !== undefined;
    },

    getInlineStoryCommandCommands: function(line) {
        if (!line || typeof line !== 'object') return null;
        if (Array.isArray(line.commands)) return line.commands.map(cmd => this.cloneFieldVisualCommand(cmd));
        if (Array.isArray(line.visual)) return line.visual.map(cmd => this.cloneFieldVisualCommand(cmd));
        if (line.op !== undefined) return [this.cloneFieldVisualCommand(line)];
        if (line.type === 'FIELD_CUTSCENE' || line.type === 'MAP_VISUAL') {
            // 演出内容はイベント本文の commands / visual に直接書く。
            // 旧来の value プリセット参照は廃止し、空指定なら実行しない。
            return null;
        }
        return null;
    },

    getFieldVisualAnchor: function(options = {}) {
        if (options.anchor && Number.isFinite(Number(options.anchor.x)) && Number.isFinite(Number(options.anchor.y))) {
            return { x: Number(options.anchor.x), y: Number(options.anchor.y) };
        }
        if (Number.isFinite(Number(options.x)) && Number.isFinite(Number(options.y))) {
            return { x: Number(options.x), y: Number(options.y) };
        }
        if (typeof Field !== 'undefined' && typeof Field.getLastFixedBossEventPosition === 'function') {
            return Field.getLastFixedBossEventPosition();
        }
        if (typeof Field !== 'undefined') return { x: Number(Field.x || 0), y: Number(Field.y || 0) };
        return { x: 0, y: 0 };
    },

    resolveStoryFieldVisualTile: function(cmd, anchor) {
        if (typeof Field !== 'undefined' && typeof Field.resolveFieldCutsceneTile === 'function') {
            return Field.resolveFieldCutsceneTile(cmd, anchor);
        }
        const base = cmd?.base === 'player' && typeof Field !== 'undefined'
            ? { x: Number(Field.x || 0), y: Number(Field.y || 0) }
            : (anchor || { x: 0, y: 0 });
        return {
            x: Number(cmd?.x ?? base.x) + Number(cmd?.dx || 0),
            y: Number(cmd?.y ?? base.y) + Number(cmd?.dy || 0)
        };
    },

    resolveStoryFieldVisualSrc: function(cmd) {
        if (!cmd) return '';
        if (cmd.src) return cmd.src;
        if (cmd.monsterId !== undefined && typeof Field !== 'undefined' && typeof Field.getMonsterMapSpriteSrc === 'function') {
            return Field.getMonsterMapSpriteSrc(cmd.monsterId);
        }
        if (cmd.monsterId !== undefined) return `assets/monsters/monster_${Number(cmd.monsterId)}.png`;
        if (cmd.effect === 'slash') return 'assets/effect/fx_phys_neutral_slash_v001.png';
        return '';
    },

    getStoryFieldVisualZIndex: function(cmd, tile, fallbackZ = 4) {
        const rawZ = Number(cmd?.z ?? fallbackZ);
        const localZ = Number.isFinite(rawZ) ? rawZ : fallbackZ;

        // キャラ・敵などの通常スプライトは、画面下側（Y座標が大きい）ほど前面に出す。
        // 既存の z は同じY座標内の微調整値として扱い、Y差がある場合はY順を優先する。
        // 斬撃などのエフェクトや明示指定したものは従来通り固定 z にできる。
        if (cmd?.autoDepth === false || cmd?.fixedZ === true || cmd?.effect) return localZ;

        const y = Number(tile?.y ?? 0);
        const depthY = Number.isFinite(y) ? y : 0;
        return Math.round(1000 + (depthY * 20) + localZ);
    },

    getStoryFieldVisualSpriteCss: function(cmd, tile, fallbackZ = 4) {
        const z = this.getStoryFieldVisualZIndex(cmd, tile, fallbackZ);
        const opacity = cmd?.opacity !== undefined ? Number(cmd.opacity) : 1;
        return `z-index:${z}; opacity:${Number.isFinite(opacity) ? opacity : 1};` + (cmd?.css || '');
    },

    putStoryFieldVisualSprite: function(cmd, anchor) {
        if (typeof Field === 'undefined' || typeof Field.putFieldVisualSprite !== 'function') return null;
        const src = this.resolveStoryFieldVisualSrc(cmd);
        if (!src) return null;
        const tile = this.resolveStoryFieldVisualTile(cmd, anchor);
        const css = this.getStoryFieldVisualSpriteCss(cmd, tile, 4);
        return Field.putFieldVisualSprite(cmd.id || `field-visual-story-${Date.now()}`, src, tile, cmd.size || 2, css);
    },

    setStoryUiCutsceneHidden: function(hidden) {
        if (typeof Field !== 'undefined' && typeof Field.setStoryUiCutsceneHidden === 'function') {
            Field.setStoryUiCutsceneHidden(!!hidden);
            return;
        }
        const overlay = document.getElementById('story-ui-overlay');
        if (!overlay) return;
        overlay.style.display = hidden ? 'none' : 'flex';
    },

    fadeStoryFieldBlackout: async function(holdMs = 160) {
        if (typeof Field !== 'undefined' && typeof Field.fadeFieldVisualBlackout === 'function') {
            await Field.fadeFieldVisualBlackout(holdMs);
            return;
        }
        await new Promise(resolve => setTimeout(resolve, Math.max(0, Number(holdMs) || 0)));
    },

    removeStoryFieldVisualTargets: function(cmd = {}) {
        if (typeof document === 'undefined') {
            if (cmd.cleanupLayer && typeof Field !== 'undefined') Field._visualCutsceneActive = false;
            return;
        }
        const removeIds = [];
        if (cmd.id) removeIds.push(cmd.id);
        if (cmd.removeId) removeIds.push(cmd.removeId);
        if (Array.isArray(cmd.removeIds)) removeIds.push(...cmd.removeIds.filter(Boolean));

        removeIds.forEach(id => {
            const img = document.getElementById(id);
            if (img) img.remove();
        });

        if (cmd.cleanupLayer) {
            const currentLayer = document.getElementById('field-visual-cutscene-layer');
            if (currentLayer) currentLayer.remove();
            if (typeof Field !== 'undefined') Field._visualCutsceneActive = false;
        }
    },

    fadeStoryFieldBlackoutWithAction: async function(action, options = {}) {
        const holdMs = Math.max(0, Number(options.holdMs ?? 160) || 0);
        const fadeInMs = Math.max(0, Number(options.fadeInMs ?? options.fadeMs ?? 220) || 0);
        const fadeOutMs = Math.max(0, Number(options.fadeOutMs ?? options.fadeMs ?? 220) || 0);
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        if (typeof document === 'undefined') {
            if (typeof action === 'function') await action();
            await wait(holdMs);
            return;
        }

        let overlay = document.getElementById('story-field-blackout-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'story-field-blackout-overlay';
            document.body.appendChild(overlay);
        }

        overlay.style.cssText = [
            'position:fixed',
            'left:0',
            'top:0',
            'width:100vw',
            'height:100vh',
            'background:#000',
            'opacity:0',
            'pointer-events:none',
            'z-index:999999',
            `transition:opacity ${fadeInMs}ms ease`
        ].join(';') + ';';

        // style反映後にフェードを開始し、完全に黒くなってから対象を消す。
        overlay.offsetHeight;
        overlay.style.opacity = '1';
        await wait(fadeInMs);

        if (typeof action === 'function') await action();
        await wait(holdMs);

        overlay.style.transition = `opacity ${fadeOutMs}ms ease`;
        overlay.style.opacity = '0';
        await wait(fadeOutMs);
        if (overlay.parentNode) overlay.remove();
    },

    runStoryFieldVisualCommands: async function(commands, options = {}) {
        if (!Array.isArray(commands) || commands.length === 0 || typeof Field === 'undefined') return false;
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
        const anchor = this.getFieldVisualAnchor(options);
        const layer = typeof Field.ensureFieldVisualLayer === 'function' ? Field.ensureFieldVisualLayer() : null;

        // 操作不可にするのは、台詞と台詞の間でこの関数が実行中の間だけ。
        // SHOW したスプライトを会話中に残しても、レイヤーはタップを奪わない。
        if (layer) layer.style.pointerEvents = 'auto';
        Field._visualCutsceneActive = true;
        if (typeof App !== 'undefined' && typeof App.lockFieldInput === 'function') App.lockFieldInput(Number(options.lockMs || 900));

        try {
            for (const raw of commands) {
                const cmd = this.cloneFieldVisualCommand(raw);
                if (!cmd || !cmd.op) continue;
                switch (cmd.op) {
                    case 'CLEAR_LAYER': {
                        const currentLayer = typeof Field.ensureFieldVisualLayer === 'function' ? Field.ensureFieldVisualLayer() : layer;
                        if (currentLayer) currentLayer.innerHTML = '';
                        break;
                    }
                    case 'BLACKOUT':
                        if (cmd.removeId || cmd.id || Array.isArray(cmd.removeIds) || cmd.cleanupLayer) {
                            await this.fadeStoryFieldBlackoutWithAction(() => this.removeStoryFieldVisualTargets(cmd), cmd);
                        } else {
                            await this.fadeStoryFieldBlackout(cmd.holdMs || 160);
                        }
                        break;
                    case 'WAIT':
                        await wait(cmd.ms || 0);
                        break;
                    case 'HIDE_STORY_UI':
                        this.setStoryUiCutsceneHidden(!!cmd.hidden);
                        break;
                    case 'SHOW_SPRITE':
                        this.putStoryFieldVisualSprite(cmd, anchor);
                        break;
                    case 'MOVE_SPRITE': {
                        let img = cmd.id ? document.getElementById(cmd.id) : null;
                        if (!img && (cmd.monsterId !== undefined || cmd.src)) {
                            img = this.putStoryFieldVisualSprite({ ...cmd, dx: cmd.fromDx ?? cmd.dx ?? 0, dy: cmd.fromDy ?? cmd.dy ?? 0 }, anchor);
                        }
                        if (!img || typeof Field.getFieldVisualTileStyle !== 'function') break;
                        const tile = this.resolveStoryFieldVisualTile(cmd, anchor);
                        const size = cmd.size || Number(img.dataset.sizeTiles || 2);
                        const duration = Math.max(0, Number(cmd.duration || 160));
                        img.style.cssText = Field.getFieldVisualTileStyle(tile, size) + this.getStoryFieldVisualSpriteCss(cmd, tile, 4) + `transition:left ${duration}ms linear, top ${duration}ms linear;`;
                        img.dataset.tileX = String(tile.x);
                        img.dataset.tileY = String(tile.y);
                        img.dataset.sizeTiles = String(size);
                        await wait(duration);
                        break;
                    }
                    case 'PLAY_EFFECT': {
                        const effect = this.putStoryFieldVisualSprite(cmd, anchor);
                        await wait(cmd.ms || 300);
                        if (effect && cmd.remove !== false) effect.remove();
                        break;
                    }
                    case 'BLINK_REMOVE': {
                        let img = cmd.id ? document.getElementById(cmd.id) : null;
                        if (!img && cmd.fallback) img = this.putStoryFieldVisualSprite({ id: cmd.id, ...cmd.fallback }, anchor);
                        if (!img) break;
                        const count = Math.max(1, Number(cmd.count || 3));
                        for (let i = 0; i < count; i++) {
                            img.style.opacity = String(cmd.offOpacity ?? 0.25);
                            await wait(cmd.offMs || 80);
                            img.style.opacity = String(cmd.onOpacity ?? 1);
                            await wait(cmd.onMs || 80);
                        }
                        if (cmd.remove !== false) img.remove();
                        break;
                    }
                    case 'REMOVE_SPRITE': {
                        const img = cmd.id ? document.getElementById(cmd.id) : null;
                        if (img) img.remove();
                        break;
                    }
                    case 'CLEANUP': {
                        this.setStoryUiCutsceneHidden(false);
                        const currentLayer = document.getElementById('field-visual-cutscene-layer');
                        if (currentLayer) currentLayer.remove();
                        Field._visualCutsceneActive = false;
                        break;
                    }
                    default:
                        break;
                }
            }
            return true;
        } finally {
            Field._visualCutsceneActive = false;
            const currentLayer = document.getElementById('field-visual-cutscene-layer');
            if (currentLayer) currentLayer.style.pointerEvents = 'none';
            this.setStoryUiCutsceneHidden(false);
        }
    },

    runStoryFieldVisual: async function(name, options = {}) {
        const commands = Array.isArray(options.commands)
            ? options.commands
            : (Array.isArray(options.visual) ? options.visual : null);
        if (!commands) return false;
        return this.runStoryFieldVisualCommands(commands, options);
    },

    runInlineStoryCommand: async function(line) {
        if (!line || typeof line !== 'object') return false;
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

        if (line.type === 'WAIT') {
            await wait(line.ms ?? line.value ?? 0);
            return true;
        }

        if (line.type === 'STORY_UI') {
            this.setStoryUiCutsceneHidden(!!line.hidden);
            return true;
        }

        if (line.type === 'FIELD_CUTSCENE' || line.type === 'MAP_VISUAL' || line.op !== undefined) {
            await this.runStoryFieldVisual(line.value || line.name || 'INLINE_STORY_VISUAL', line);
            return true;
        }

        return false;
    },

    getInlineFieldVisualReplayCommands: function(scriptKey, untilIndex) {
        const lines = this.scripts ? this.scripts[scriptKey] : null;
        if (!Array.isArray(lines)) return [];

        const end = Math.max(0, Math.min(Number(untilIndex) || 0, lines.length));
        const replay = [];

        for (let i = 0; i < end; i++) {
            const line = lines[i];
            if (!this.isInlineStoryCommand(line)) continue;
            const commands = this.getInlineStoryCommandCommands(line);
            if (!Array.isArray(commands)) continue;

            for (const raw of commands) {
                if (!raw || !raw.op) continue;
                const cmd = this.cloneFieldVisualCommand(raw);
                switch (cmd.op) {
                    case 'CLEAR_LAYER':
                    case 'SHOW_SPRITE':
                    case 'REMOVE_SPRITE':
                    case 'CLEANUP':
                        replay.push(cmd);
                        break;
                    case 'MOVE_SPRITE':
                        cmd.duration = 0;
                        replay.push(cmd);
                        break;
                    case 'BLINK_REMOVE':
                        if (cmd.remove !== false && cmd.id) replay.push({ op: 'REMOVE_SPRITE', id: cmd.id });
                        break;
                    case 'PLAY_EFFECT':
                        if (cmd.remove === false) replay.push({ ...cmd, op: 'SHOW_SPRITE' });
                        break;
                    case 'HIDE_STORY_UI':
                    case 'WAIT':
                        break;
                    case 'BLACKOUT':
                        if (cmd.cleanupLayer) {
                            replay.push({ op: 'CLEANUP' });
                        } else {
                            if (cmd.id) replay.push({ op: 'REMOVE_SPRITE', id: cmd.id });
                            if (cmd.removeId) replay.push({ op: 'REMOVE_SPRITE', id: cmd.removeId });
                            if (Array.isArray(cmd.removeIds)) {
                                cmd.removeIds.filter(Boolean).forEach(id => replay.push({ op: 'REMOVE_SPRITE', id }));
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
        }
        return replay;
    },

    applyInlineFieldVisualReplayCommands: function(commands, options = {}) {
        if (!Array.isArray(commands) || commands.length === 0 || typeof Field === 'undefined') return false;
        const anchor = this.getFieldVisualAnchor(options);
        let layer = typeof Field.ensureFieldVisualLayer === 'function' ? Field.ensureFieldVisualLayer() : null;

        for (const raw of commands) {
            const cmd = this.cloneFieldVisualCommand(raw);
            if (!cmd || !cmd.op) continue;
            switch (cmd.op) {
                case 'CLEAR_LAYER':
                    layer = typeof Field.ensureFieldVisualLayer === 'function' ? Field.ensureFieldVisualLayer() : layer;
                    if (layer) layer.innerHTML = '';
                    break;
                case 'SHOW_SPRITE':
                    this.putStoryFieldVisualSprite(cmd, anchor);
                    break;
                case 'MOVE_SPRITE': {
                    let img = cmd.id ? document.getElementById(cmd.id) : null;
                    if (!img) img = this.putStoryFieldVisualSprite(cmd, anchor);
                    if (!img || typeof Field.getFieldVisualTileStyle !== 'function') break;
                    const tile = this.resolveStoryFieldVisualTile(cmd, anchor);
                    const size = cmd.size || Number(img.dataset.sizeTiles || 2);
                    img.style.cssText = Field.getFieldVisualTileStyle(tile, size) + this.getStoryFieldVisualSpriteCss(cmd, tile, 4);
                    img.dataset.tileX = String(tile.x);
                    img.dataset.tileY = String(tile.y);
                    img.dataset.sizeTiles = String(size);
                    break;
                }
                case 'REMOVE_SPRITE': {
                    const img = cmd.id ? document.getElementById(cmd.id) : null;
                    if (img) img.remove();
                    break;
                }
                case 'CLEANUP': {
                    this.setStoryUiCutsceneHidden(false);
                    const currentLayer = document.getElementById('field-visual-cutscene-layer');
                    if (currentLayer) currentLayer.remove();
                    break;
                }
                default:
                    break;
            }
        }

        const currentLayer = document.getElementById('field-visual-cutscene-layer');
        if (currentLayer) currentLayer.style.pointerEvents = 'none';
        this.setStoryUiCutsceneHidden(false);
        if (typeof Field !== 'undefined') Field._visualCutsceneActive = false;
        return true;
    },

    restoreInlineFieldVisualState: async function(scriptKey, untilIndex) {
        const replay = this.getInlineFieldVisualReplayCommands(scriptKey, untilIndex);
        if (replay.length === 0) return false;
        return this.applyInlineFieldVisualReplayCommands(replay);
    },

    scriptHasInlineFieldVisual: function(scriptKey) {
        const lines = this.scripts ? this.scripts[scriptKey] : null;
        if (!Array.isArray(lines)) return false;
        return lines.some(line => this.isInlineStoryCommand(line));
    },

    eventHasFieldVisualFlow: function(eventId, phase = 'actions') {
        const event = this.events ? this.events[eventId] : null;
        if (!event) return false;
        const actions = phase === 'win' ? event.winActions : event.actions;
        if (!Array.isArray(actions)) return false;
        return actions.some(action => {
            if (!action) return false;
            if (action.type === 'FIELD_CUTSCENE' || action.type === 'MAP_VISUAL') return true;
            if (action.type === 'CONV' && this.scriptHasInlineFieldVisual(action.value)) return true;
            return false;
        });
    },

    shouldRestartEventFromStartOnResume: function(eventId, phase = 'actions') {
        // イベント再実行はフラグ・加入・アイテム付与の重複リスクがあるため行わない。
        // 会話番号までの常駐スプライトだけを復元し、一過性エフェクトは再生しない。
        return false;
    },

    refreshFieldAfterStoryStateChange: function() {
        if (typeof Field === 'undefined') return;
        if (typeof Field.refreshCurrentAction === 'function') Field.refreshCurrentAction({ silent: true });
        if (typeof Field.refreshVisualState === 'function') Field.refreshVisualState();
        else if (typeof Field.render === 'function') Field.render();
    },

    getPostBattleBossVisualContext: function(eventId) {
        const battle = App?.data?.battle || null;
        if (!battle || !battle.isBossBattle) return null;
        const related = battle.eventId === eventId || battle.storyWinEventId === eventId || App?.data?.progress?.pendingBattleWinEventId === eventId;
        if (!related) return null;

        const rawId = Array.isArray(battle.fixedBossId) ? battle.fixedBossId[0] : battle.fixedBossId;
        const monsterId = Number(rawId || 0);
        if (!monsterId || !Number.isFinite(monsterId)) return null;

        const pos = battle.fixedBossPosition
            || App?.data?.progress?.activeFixedBossContext?.fixedBossPosition
            || (typeof Field !== 'undefined' && typeof Field.getLastFixedBossEventPosition === 'function' ? Field.getLastFixedBossEventPosition() : null)
            || (typeof Field !== 'undefined' ? { x: Field.x, y: Field.y } : null);
        if (!pos) return null;

        return { monsterId, x: Number(pos.x), y: Number(pos.y) };
    },

    eventHasConversationAction: function(event, phase = 'actions') {
        const actions = phase === 'win' ? event?.winActions : event?.actions;
        return Array.isArray(actions) && actions.some(action => action && action.type === 'CONV');
    },

    showPostBattleBossSpriteForEvent: function(eventId, event, phase = 'actions') {
        if (!event || event.skipAutoPostBattleBossSprite || event.keepPostBattleBossSprite === false) return false;
        if (!this.eventHasConversationAction(event, phase)) return false;
        // 明示的なフィールド演出を持つイベントは、そのスクリプト側の SHOW/CLEANUP に任せる。
        if (this.eventHasFieldVisualFlow(eventId, phase)) return false;
        if (typeof Field === 'undefined' || typeof Field.putFieldVisualSprite !== 'function') return false;

        const ctx = this.getPostBattleBossVisualContext(eventId);
        if (!ctx) return false;
        const src = (typeof Field.getMonsterMapSpriteSrc === 'function')
            ? Field.getMonsterMapSpriteSrc(ctx.monsterId)
            : `assets/monsters/monster_${ctx.monsterId}.png`;
        Field.putFieldVisualSprite('field-visual-post-battle-boss', src, { x: ctx.x, y: ctx.y }, 2, 'z-index:4;');
        return true;
    },

    cleanupPostBattleBossSprite: function() {
        const img = document.getElementById('field-visual-post-battle-boss');
        if (img) img.remove();
        const layer = document.getElementById('field-visual-cutscene-layer');
        if (layer && layer.children.length === 0) layer.remove();
    },
	/**
     * 中断されたイベントまたは会話があれば再開する
     */
    resumeActiveConversation: function() {
        const data = App.data ? App.data.progress : null;
        if (!data || (!data.activeEvent && !data.activeConversation)) return false;

        // 実行責任を引き受けたことを即座に返し、main.js側の重複動作を止める
        (async () => {
            let { eventId, actionIndex, phase } = data.activeEvent || {};
            actionIndex = Number(actionIndex || 0);
            let lineIndex = data.activeConversation ? Number(data.activeConversation.index || 0) : 0;

            // フィールド演出を会話と会話の間に挟むイベントでも、イベント自体は
            // 冒頭から再実行しない。会話再開時に、その会話番号までの表示状態だけを
            // story.js 側で復元することで、他イベントにも流用できる形にする。

            if (phase === 'win') {
                await this.onBattleWin(eventId, actionIndex, lineIndex);
            } else if (eventId) {
                await this.executeEvent(eventId, false, actionIndex, lineIndex);
            } else if (data.activeConversation) {
                const key = data.activeConversation.key;
                await this.showConversation(key, lineIndex);
                this.endConversation();
            }
        })();
        return true;
    },

    /**
     * 勝利後イベントのレジューム（インデックス指定対応版）
     */
    resumePendingBattleWinEvent: function() {
        const data = App.data ? App.data.progress : null;
        if (!data || !data.pendingBattleWinEventId) return false;

        const eventId = data.pendingBattleWinEventId;
        delete data.pendingBattleWinEventId; // 二重起動防止のため即座に削除
        this.active = false;
        this.isTyping = false;
        App.save();

        (async () => {
            await this.onBattleWin(eventId, 0, 0);
        })();
        return true;
    },

    /**
     * 通常予約イベントのレジューム
     */
    resumePendingEvent: function() {
        const data = App.data ? App.data.progress : null;
        if (!data || !data.pendingEventId) return false;

        const eventId = data.pendingEventId;
        delete data.pendingEventId;
        this.active = false;
        this.isTyping = false;
        App.save();

        (async () => {
            await this.executeEvent(eventId, false, 0, 0);
        })();
        return true;
    },
	
	// ==========================================
    // 1. 会話スクリプト (scripts)
    // ==========================================
    scripts: (typeof STORY_MANAGER_DATA !== "undefined" && STORY_MANAGER_DATA.scripts) ? STORY_MANAGER_DATA.scripts : {},

    events: (typeof STORY_MANAGER_DATA !== "undefined" && STORY_MANAGER_DATA.events) ? STORY_MANAGER_DATA.events : {},

	// ==========================================
    // 4. イベント実行エンジン
    // ==========================================
    /**
     * 通常イベント実行
     * @param {string} eventId 
     * @param {boolean} isSubEvent 
     * @param {number} startActionIndex 命令の開始位置
     * @param {number} startLineIndex セリフの開始位置
     */
    executeEvent: async function(eventId, isSubEvent = false, startActionIndex = 0, startLineIndex = 0) {
        const data = App.data.progress;
        const event = this.events[eventId];
        if (!event || !event.actions) return;

        if (!isSubEvent && this.active) return;
        if (!isSubEvent) this.active = true;

        const autoPostBattleBossSprite = !isSubEvent
            ? this.showPostBattleBossSpriteForEvent(eventId, event, 'actions')
            : false;

        try {
            for (let i = startActionIndex; i < event.actions.length; i++) {
                if (!isSubEvent) {
                    data.activeEvent = { eventId: eventId, actionIndex: i, phase: 'actions' };
                    App.save();
                }
                // 初回ループ時のみ引数の startLineIndex を適用
                const lineIdx = (i === startActionIndex) ? startLineIndex : 0;
                const result = await this.processAction(event.actions[i], eventId, lineIdx);
                if (result === 'BREAK') return;
            }
            
            if (!isSubEvent) {
                delete data.activeEvent;
                this.active = false;
                this.endConversation();
            }
            App.save();

            // イベント完了後も同じタイル上にいる場合は、現在地アクションを再評価する。
            // main.js 側の Field.refreshCurrentAction() が正本。
            // ここで呼ぶことで、会話・選択肢・ストーリー進行後にボタンが消えっぱなしになるのを防ぐ。
            if (!isSubEvent) this.refreshFieldAfterStoryStateChange();
        } finally {
            if (autoPostBattleBossSprite) this.cleanupPostBattleBossSprite();
        }
    },

    /**
     * 勝利後イベント実行
     */
    onBattleWin: async function(eventId, startActionIndex = 0, startLineIndex = 0) {
        const data = App.data.progress;
        const event = this.events[eventId];
        if (!event || !event.winActions) return;

        this.active = true;
        const autoPostBattleBossSprite = this.showPostBattleBossSpriteForEvent(eventId, event, 'win');

        try {
            for (let i = startActionIndex; i < event.winActions.length; i++) {
                data.activeEvent = { eventId: eventId, actionIndex: i, phase: 'win' };
                App.save();

                const lineIdx = (i === startActionIndex) ? startLineIndex : 0;
                const result = await this.processAction(event.winActions[i], eventId, lineIdx);
                if (result === 'BREAK') return;
            }

            delete data.activeEvent;
            this.active = false;
            this.endConversation();
            App.save();

            // 戦闘勝利後イベントが終わってフィールドへ戻った際、現在地タイルのボタンを復元する。
            this.refreshFieldAfterStoryStateChange();
        } finally {
            if (autoPostBattleBossSprite) this.cleanupPostBattleBossSprite();
        }
    },

    /**
     * 会話イベント中にダンジョンへ遷移する前の後始末。
     * ここを通さないと StoryManager.active や activeConversation が保存に残り、
     * 遷移先で移動・メニュー操作が塞がれたままになる。
     */
    prepareMapTransfer: function() {
        const data = App?.data?.progress;
        if (data) {
            delete data.activeEvent;
            delete data.activeConversation;
        }
        this.isTyping = false;
        this.active = false;
        this.endConversation();
        if (typeof App !== 'undefined' && typeof App.save === 'function') App.save();
    },

    /**
     * ストーリー用の敗北演出。
     * 通常のゲームオーバー処理は呼ばず、暗転・全滅ログ・HP0表示を挟んでから、
     * 指定割合で復帰させて次の会話へ進める。
     */
    playStoryDefeatEffect: async function(action = {}) {
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const partyUids = Array.isArray(App.data?.party) ? App.data.party.filter(Boolean) : [];
        const targets = Array.isArray(App.data?.characters)
            ? App.data.characters.filter(c => c && partyUids.includes(c.uid))
            : [];

        let fade = document.getElementById('story-defeat-fade');
        if (!fade) {
            fade = document.createElement('div');
            fade.id = 'story-defeat-fade';
            fade.style.cssText = `
                position:absolute;
                inset:0;
                background:#000;
                opacity:0;
                pointer-events:none;
                z-index:2600;
                transition:opacity 420ms ease;
            `;
            (document.getElementById('game-container') || document.body).appendChild(fade);
        }

        await wait(30);
        fade.style.opacity = '1';
        await wait(480);

        if (action.cleanupFieldVisualOnBlackout || action.removeFieldVisualId || Array.isArray(action.removeFieldVisualIds)) {
            const removeIds = [];
            if (action.removeFieldVisualId) removeIds.push(action.removeFieldVisualId);
            if (Array.isArray(action.removeFieldVisualIds)) removeIds.push(...action.removeFieldVisualIds.filter(Boolean));
            this.removeStoryFieldVisualTargets({
                removeIds,
                cleanupLayer: !!action.cleanupFieldVisualOnBlackout
            });
        }

        if (action.log) App.log(action.log);
        else App.log('パーティは全滅した……。');
        if (App.data?.stats) App.data.stats.wipeoutCount = (App.data.stats.wipeoutCount || 0) + 1;

        // 通常全滅と同じ扱いにしたいイベント用。
        // HP1でダンジョンから強制脱出し、始まりの村前へ戻ってから後続会話を続ける。
        if (action.normalWipeout || action.useNormalWipeout) {
            targets.forEach(c => {
                c.currentHp = 1;
                delete c.battleStatus;
            });
            if (App.data) App.data.battle = { active: false };
            App.save();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();

            await wait(Number(action.downWait || 900));

            if (typeof Dungeon !== 'undefined' && typeof Dungeon.exit === 'function') {
                Dungeon.exit(true);
            } else if (typeof App !== 'undefined') {
                App.data.location.area = 'WORLD';
                App.data.location.x = 58;
                App.data.location.y = 65;
                if (typeof Field !== 'undefined') {
                    Field.currentMapData = null;
                    Field.x = 58;
                    Field.y = 65;
                }
                if (typeof App.changeScene === 'function') App.changeScene('field');
            }

            await wait(Number(action.fadeHold || 650));
            fade.style.opacity = '0';
            await wait(460);
            fade.remove();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
            if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
                Field.refreshCurrentAction({ silent: true });
            }
            return;
        }
		
        targets.forEach(c => {
            c.currentHp = 0;
            delete c.battleStatus;
        });
        App.save();
        if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();

        await wait(Number(action.downWait || 900));

        const hpRate = Math.max(0.01, Math.min(1, Number(action.recoverRate ?? 0.35)));
        const mpRate = Math.max(0, Math.min(1, Number(action.recoverMpRate ?? 0.25)));
        targets.forEach(c => {
            const stats = typeof App.calcStats === 'function' ? App.calcStats(c) : { maxHp: c.hp || 1, maxMp: c.mp || 0 };
            c.currentHp = Math.max(1, Math.floor((Number(stats.maxHp) || 1) * hpRate));
            c.currentMp = Math.max(Number(c.currentMp || 0), Math.floor((Number(stats.maxMp) || 0) * mpRate));
            delete c.battleStatus;
        });
        App.save();
        if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();

        await wait(Number(action.fadeHold || 450));
        fade.style.opacity = '0';
        await wait(460);
        fade.remove();
    },

    /**
     * 各アクションの個別処理
     * @param {Object} action 
     * @param {string} eventId 
     * @param {number} lineIndex 再開時のセリフ番号
     */
    processAction: async function(action, eventId, lineIndex = 0) {
        const data = App.data.progress;
        
        // CONV命令時に lineIndex を渡す
        if (action.type === 'CONV') await this.showConversation(action.value, lineIndex);
        
        if (action.type === 'ALLY') {
            App.addStoryAlly(action.value);
            this.refreshFieldAfterStoryStateChange();
        }
        
        if (action.type === 'STEP') { 
            data.storyStep = action.value; 
            this.syncHeroLimitBreak(); 
            if (typeof Menu !== 'undefined') Menu.renderPartyBar();
        }

        if (action.type === 'TEMP_LB_START') {
            this.installTemporaryStoryPowerApi();
            if (typeof App.activateTemporaryStoryPower === 'function') {
                App.activateTemporaryStoryPower({
                    id: action.id || 'story_temp_power',
                    limitBreak: action.value ?? 99,
                    reason: eventId || 'story_event'
                });
            }
        }

        if (action.type === 'TEMP_LB_CLEAR') {
            this.installTemporaryStoryPowerApi();
            if (typeof App.clearTemporaryStoryPower === 'function') {
                App.clearTemporaryStoryPower({ id: action.id || null });
            }
            this.syncHeroLimitBreak();
            if (typeof Menu !== 'undefined') Menu.renderPartyBar();
        }

        if (action.type === 'LB_ADD_PARTY') {
            const ids = Array.isArray(action.charIds)
                ? action.charIds
                : (action.charId != null ? [action.charId] : []);
            const partyUids = Array.isArray(App.data?.party) ? App.data.party.filter(Boolean) : [];
            const amount = Math.max(1, Math.floor(Number(action.amount) || 1));
            ids.forEach(id => {
                const char = Array.isArray(App.data?.characters)
                    ? App.data.characters.find(c => c && Number(c.charId) === Number(id) && partyUids.includes(c.uid))
                    : null;
                if (!char || typeof App.addLimitBreak !== 'function') return;
                const result = App.addLimitBreak(char, amount, action.source || 'story');
                if (result.changed || result.internalChanged) {
                    App.log(`${char.name || '仲間'}の絆が深まった。`);
                }
            });
            if (typeof App.save === 'function') App.save();
            if (typeof Menu !== 'undefined') Menu.renderPartyBar();
        }
        
        if (action.type === 'HEAL') {
            App.data.characters.forEach(c => {
                const stats = App.calcStats(c);
                c.currentHp = stats.maxHp;
                c.currentMp = stats.maxMp;
            });
            App.save();
            if (typeof Menu !== 'undefined') Menu.renderPartyBar();
            App.log("不思議な力で体力が回復した！");
        }
        
        if (action.type === 'SUB')  { data.subStep = action.value; }
        if (action.type === 'LOG')   App.log(action.value);

        if (action.type === 'QUEST_ACCEPT' && typeof App.acceptQuest === 'function') {
            App.acceptQuest(action.value || action.questId, { silent: true });
        }

        if (action.type === 'QUEST_COMPLETE' && typeof App.completeQuest === 'function') {
            App.completeQuest(action.value || action.questId, { silent: true });
            this.refreshFieldAfterStoryStateChange();
        }

        if (action.type === 'STORY_DEFEAT') {
            await this.playStoryDefeatEffect(action);
        }

        if (action.type === 'FIELD_CUTSCENE' || action.type === 'MAP_VISUAL') {
            await this.runStoryFieldVisual(action.value || action.name || 'ACTION_STORY_VISUAL', action);
        }

        if (action.type === 'OPENING_KAMISHIBAI') {
            if (!data.flags) data.flags = {};
            const flagKey = action.flag || 'openingKamishibaiViewed';
            if (!data.flags[flagKey] && typeof OpeningSequence !== 'undefined' && typeof OpeningSequence.play === 'function') {
                const storyOverlay = document.getElementById('story-ui-overlay');
                if (storyOverlay) storyOverlay.style.display = 'none';
                await OpeningSequence.play(action.options || {});
                data.flags[flagKey] = true;
                App.save();
            }
        }

        if (action.type === 'FULL_DATA_PROMPT') {
            try {
                if (typeof App.handlePostPrologueFullDataDownload === 'function') {
                    await App.handlePostPrologueFullDataDownload();
                }
            } catch (e) {
                console.error(e);
                if (typeof App.showFullDataDialog === 'function') {
                    await App.showFullDataDialog(
                        `全データダウンロード確認中にエラーが発生しました。\n設定メニューから再実行できます。\n\n${e.message || e}`,
                        { messageOnly: true }
                    );
                }
            }
        }

        if (action.type === 'FLAG') {
            if (!data.flags) data.flags = {};
            const key = action.key || action.value;
            if (key) data.flags[key] = action.state !== undefined ? !!action.state : true;
            App.save();
        }

        if (action.type === 'UNLOCK') {
            const keys = Array.isArray(action.value) ? action.value : [action.value];
            keys.filter(Boolean).forEach(key => {
                if (typeof App.unlockFeature === 'function') App.unlockFeature(key);
                else {
                    if (!data.unlocked || typeof data.unlocked !== 'object' || Array.isArray(data.unlocked)) data.unlocked = {};
                    data.unlocked[key] = true;
                }
            });
            App.save();
        }

        if (action.type === 'ITEM') {
            const itemId = Number(action.id ?? action.value);
            const count = Math.max(1, Math.floor(Number(action.count) || 1));
            if (Number.isFinite(itemId)) {
                if (!App.data.items) App.data.items = {};
                App.data.items[itemId] = Number(App.data.items[itemId] || 0) + count;
                const item = (DB.ITEMS || []).find(i => Number(i.id) === itemId);
                App.log(`${item?.name || `アイテム${itemId}`}を手に入れた！`);
                App.save();
            }
        }
        
        if (action.type === 'EVENT') await this.executeEvent(action.value, true);

        if (action.type === 'START_FIXED_DUNGEON') {
            if (typeof Dungeon !== 'undefined' && typeof Dungeon.startFixed === 'function' && action.value) {
                this.prepareMapTransfer();
                Dungeon.startFixed(action.value);
                return 'BREAK';
            }
        }

        if (action.type === 'START_ABYSS_DUNGEON') {
            if (typeof Dungeon !== 'undefined' && typeof Dungeon.enter === 'function') {
                this.prepareMapTransfer();
                Dungeon.enter();
                return 'BREAK';
            }
        }

        if (action.type === 'IF_FLAG' || action.type === 'IF') {
            const key = action.key || action.flag || action.value;
            const expected = action.state !== undefined ? !!action.state : true;
            const actual = key ? !!(data.flags && data.flags[key]) : false;
            const branch = (actual === expected) ? action.then : (action.else || action.otherwise);
            if (Array.isArray(branch)) {
                for (const sub of branch) {
                    const res = await this.processAction(sub, eventId);
                    if (res === 'BREAK') return 'BREAK';
                }
            }
        }

        if (action.type === 'CHOICE') {
            const isYes = await this.showChoice(action.text);
            const branch = isYes ? action.yes : action.no;
            if (branch && branch.length > 0) {
                for (const sub of branch) {
                    const res = await this.processAction(sub, eventId);
                    if (res === 'BREAK') return 'BREAK';
                }
            }
        }
        
        if (action.type === 'MAP_CHANGE') {
            if (typeof MapRegistry !== 'undefined' && typeof MapRegistry.applyStoryMapMutation === 'function') {
                MapRegistry.applyStoryMapMutation(action.value || action.key);
            }
        }

        if (action.type === 'BOSS') {
            delete data.activeEvent;
            delete data.activeConversation;
            this.endConversation();
            this.active = false;
            this.isTyping = false;
            const fixedBossId = action.value !== undefined ? action.value : null;
            const ids = Array.isArray(fixedBossId) ? fixedBossId : [fixedBossId].filter(id => id !== null);
            const isSpecialBoss = ids.some(id => {
                const base = window.MonsterData?.getMonsterById?.(Number(id));
                return base?.isSpecialBoss || base?.isEstark || Number(id) === 902000;
            });

		const activeFixedBossContext = (App.data.progress?.activeFixedBossContext?.type === 'fixedBoss' &&
			typeof Field !== 'undefined' && Field.currentMapData?.isFixed)
			? App.data.progress.activeFixedBossContext
			: null;
		const actionFixedBossPosition = action.fixedBossPosition || action.position || null;
		const contextFixedBossPosition = activeFixedBossContext?.fixedBossPosition || null;
		const sourceFixedBossPosition = actionFixedBossPosition || contextFixedBossPosition;
		const fixedBossPosition = Number.isFinite(Number(sourceFixedBossPosition?.x)) && Number.isFinite(Number(sourceFixedBossPosition?.y))
			? { x: Number(sourceFixedBossPosition.x), y: Number(sourceFixedBossPosition.y) }
			: null;
		const rawKeyRewardColors = Array.isArray(action.keyRewardColors)
			? action.keyRewardColors
			: action.keyRewardColor
				? [action.keyRewardColor]
				: action.keyColor
					? [action.keyColor]
					: [];

		const keyRewardColors = rawKeyRewardColors.filter(Boolean);
		const contextKeyReward = activeFixedBossContext?.fixedKeyReward || null;
		const fixedKeyReward = keyRewardColors.length > 0 ? {
			colors: keyRewardColors,
			color: keyRewardColors[0], // 既存処理互換用
			x: fixedBossPosition?.x ?? ((typeof Field !== 'undefined') ? Field.x : null),
			y: fixedBossPosition?.y ?? ((typeof Field !== 'undefined') ? Field.y : null),
			scopeKey: (typeof Dungeon !== 'undefined' && typeof Dungeon.getKeyScopeKey === 'function')
				? Dungeon.getKeyScopeKey()
				: null
		} : (contextKeyReward ? { ...contextKeyReward } : null);

		App.data.battle = {
			active: false,
			isBossBattle: true,
			battleBg: action.battleBg || null,
			fixedBossId: fixedBossId,
			fixedBossPosition: fixedBossPosition,
			fixedBossProgressKey: action.fixedBossProgressKey || action.progressKey || activeFixedBossContext?.progressKey || null,
			fixedQuestId: action.fixedQuestId || activeFixedBossContext?.fixedQuestId || null,
			bossStatMultiplier: action.bossStatMultiplier || action.bossScale || activeFixedBossContext?.bossStatMultiplier || null,
			isSpecialBoss: isSpecialBoss,
			isEstark: isSpecialBoss,
			suppressFixedBossDefeat: !!(action.suppressFixedBossDefeat || action.deferFixedBossDefeat || action.markFixedBossDefeated === false),
			eventId: eventId,
			fixedKeyReward: fixedKeyReward,
			isAmbushed: !!action.ambush,
			storyWinEventId: action.winEventId || null,
			storyLossEventId: action.lossEventId || null
		};
            App.save(); 
            const startBattleScene = () => App.changeScene('battle');
            if (typeof App.playEncounterTransition === 'function') {
                if (typeof App.lockFieldInput === 'function') App.lockFieldInput(1800);
                App.playEncounterTransition(startBattleScene, { eventBattle: true });
            } else {
                startBattleScene();
            }
            return 'BREAK'; 
        }
    },
	
	// ==========================================
    // 5. UI制御ロジック (選択肢対応版)
    // ==========================================
    
    /**
     * はい/いいえの選択肢を表示します
     */
    dismissChoiceUI: function(options = {}) {
        const menu = document.getElementById('story-choice-area');
        if (menu) menu.remove();
        const indicator = document.getElementById('story-next-indicator');
        if (indicator) indicator.style.visibility = 'visible';
        if (options.hideOverlay !== false) {
            const overlay = document.getElementById('story-ui-overlay');
            if (overlay) overlay.style.display = 'none';
        }
    },

    clearStoryPortrait: function() {
        const portrait = document.getElementById('story-portrait');
        if (!portrait) return;
        portrait.removeAttribute('src');
        portrait.style.display = 'none';
    },

    prepareBattleTransitionUI: function() {
        this.dismissChoiceUI({ hideOverlay: true });
        const backlog = document.getElementById('backlog-overlay');
        if (backlog) backlog.remove();
        this.isTyping = false;
    },

    showChoice: function(text) {
        return new Promise((resolve) => {
            this.dismissChoiceUI({ hideOverlay: false });
            const overlay = document.getElementById('story-ui-overlay') || this.createStoryDOM();
            overlay.style.display = 'flex';
            // 選択肢には話者が存在しない。直前のボス会話などの立ち絵を絶対に持ち越さない。
            this.clearStoryPortrait();
            const choiceName = document.getElementById('story-name');
            const choiceText = document.getElementById('story-text');
            choiceName.style.display = 'block';
            choiceName.innerText = "選択";
            choiceText.innerText = text;
            const choiceWindow = choiceText.parentElement;
            if (choiceWindow?.dataset?.defaultStyle) choiceWindow.style.cssText = choiceWindow.dataset.defaultStyle;
			
			// ★修正: visibilityで制御することでshowConversationとの競合を回避
            document.getElementById('story-next-indicator').style.visibility = 'hidden';
			
            const box = document.getElementById('story-text').parentElement;
            const menu = document.createElement('div');
            menu.id = "story-choice-area";
            menu.style.cssText = "display:flex; gap:20px; margin-top:15px; justify-content:center;";
            
            const btnStyle = "padding:10px 30px; background:#000044; border:1px solid #ffd700; color:#ffd700; cursor:pointer; font-weight:bold; border-radius:4px;";
            menu.innerHTML = `<button style="${btnStyle}" class="no-skip">はい</button><button style="${btnStyle}" class="no-skip">いいえ</button>`;
            
            menu.children[0].onclick = (e) => {
                e.stopPropagation();
                this.dismissChoiceUI({ hideOverlay: true });
                resolve(true);
            };
            menu.children[1].onclick = (e) => {
                e.stopPropagation();
                this.dismissChoiceUI({ hideOverlay: true });
                resolve(false);
            };
            box.appendChild(menu);
        });
    },

    /**
     * 会話の表示
     */
    showConversation: async function(scriptKey, startFromIndex = 0) {
        const lines = this.scripts[scriptKey];
        if (!lines) return;
        
        // すでに会話中の場合は重複して動かさない
        if (this.isTyping) return;
        this.isTyping = true;

        startFromIndex = Math.max(0, Math.floor(Number(startFromIndex) || 0));
        if (startFromIndex > 0 && this.scriptHasInlineFieldVisual(scriptKey)) {
            try {
                await this.restoreInlineFieldVisualState(scriptKey, startFromIndex);
            } catch (e) {
                console.warn('[StoryManager] inline field visual resume failed:', e);
            }
        }

        let overlay = document.getElementById('story-ui-overlay') || this.createStoryDOM();
        overlay.style.display = 'flex';
        
        const portraitImg = document.getElementById('story-portrait');
        const nameBox = document.getElementById('story-name');
        const textBox = document.getElementById('story-text');
        const nextIndicator = document.getElementById('story-next-indicator');
        const textWindow = textBox ? textBox.parentElement : null;
        if (textWindow && !textWindow.dataset.defaultStyle) {
            textWindow.dataset.defaultStyle = textWindow.getAttribute('style') || '';
        }

        for (let i = startFromIndex; i < lines.length; i++) {
            const line = lines[i];

            // 現在のセリフ番号を保存
            if (App.data) {
                App.data.progress.activeConversation = { key: scriptKey, index: i };
                App.save();
            }

            if (this.isInlineStoryCommand(line)) {
                await this.runInlineStoryCommand(line);
                continue;
            }
            if (!line || typeof line.text !== 'string') continue;

            const hasExplicitCharId = line.charId !== undefined && line.charId !== null;
            const isSystemLine = line.name === 'システム' && !hasExplicitCharId;
            const masterChar = hasExplicitCharId ? DB.CHARACTERS.find(c => c.id === line.charId) : null;
            const savedChar = hasExplicitCharId ? App.data.characters.find(c => c.charId === line.charId) : null;
            let displayName = isSystemLine ? '' : (savedChar ? savedChar.name : (masterChar ? masterChar.name : line.name));
            let displayImg = isSystemLine ? '' : (savedChar?.img || masterChar?.img);
            if (line.hidePortrait === true) displayImg = '';

            if (textWindow) {
                if (isSystemLine) {
                    textWindow.style.cssText = `
                        position: absolute;
                        top: 45%;
                        left: 20px;
                        right: 20px;
                        background: rgba(0,0,0,0.72);
                        border: none;
                        border-radius: 2px;
                        padding: 16px;
                        box-sizing: border-box;
                        min-height: 96px;
                        max-height: 280px;
                        overflow-y: auto;
                        box-shadow: none;
                        z-index: 10;
                    `;
                } else if (textWindow.dataset.defaultStyle) {
                    textWindow.style.cssText = textWindow.dataset.defaultStyle;
                }
            }
            nameBox.style.display = isSystemLine ? 'none' : 'block';

            let processedText = line.text.replace(/\[N:(\d+)\]/g, (match, id) => {
                const targetId = parseInt(id);
                const saved = App.data.characters.find(c => c.charId === targetId);
                const master = DB.CHARACTERS.find(c => c.id === targetId);
                return (saved ? saved.name : (master ? master.name : `ID:${id}`));
            }).replace(/\\n/g, '\n');

            this.backlog.push({ name: displayName, text: processedText.replace(/\n/g, " ") });

            portraitImg.src = displayImg || "";
            portraitImg.style.display = displayImg ? 'block' : 'none';
            nameBox.innerText = displayName;
            nextIndicator.style.visibility = 'hidden';

            let isTyping = true, skipTyping = false;
            overlay.onclick = (e) => { if (!e.target.closest('.no-skip') && isTyping) skipTyping = true; };

            textBox.innerHTML = "";
            const chars = processedText.split("");
            for (let j = 0; j < chars.length; j++) {
                if (skipTyping) { textBox.innerHTML = processedText.replace(/\n/g, "<br>"); break; }
                let char = chars[j];
                textBox.innerHTML += (char === "\n" ? "<br>" : char);
                await new Promise(r => setTimeout(r, char === "\n" ? this.newlineWait : this.textSpeed));
            }
            isTyping = false;
            nextIndicator.style.visibility = 'visible';
            await new Promise(resolve => { overlay.onclick = (e) => { if (!e.target.closest('.no-skip')) resolve(); }; });
        }
        
        if (App.data) { delete App.data.progress.activeConversation; App.save(); }
		this.isTyping = false;
        // showConversation 自体では閉じず、executeEvent 側の endConversation に任せる
    },

    /**
     * 会話UIを終了して隠す
     */
    endConversation: function() {
        this.dismissChoiceUI({ hideOverlay: false });
        this.clearStoryPortrait();
        const overlay = document.getElementById('story-ui-overlay');
        if (overlay) overlay.style.display = 'none';
        this.active = false;
        if (this.onComplete) {
            const cb = this.onComplete;
            this.onComplete = null;
            cb();
        }
    },

    /**
     * 会話ログ画面を表示する (復旧：オーバーレイ形式)
     */
    showBacklog: function() {
        // 既存のオーバーレイがあれば削除
        const old = document.getElementById('backlog-overlay');
        if (old) old.remove();

        const div = document.createElement('div');
        div.id = 'backlog-overlay';
        div.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,20,0.95); z-index: 3000;
            display: flex; flex-direction: column; color: #fff; font-family: sans-serif;
        `;

        const list = this.backlog.map(b => `
            <div style="padding: 10px; border-bottom: 1px solid #333;">
                <div style="color: #ffd700; font-weight: bold; font-size: 12px;">${b.name}</div>
                <div style="font-size: 14px; margin-top: 4px;">${b.text}</div>
            </div>
        `).join('');

        div.innerHTML = `
            <div style="padding: 15px; background: #111; border-bottom: 2px solid #ffd700; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; color:#ffd700;">会話ログ</span>
                <button onclick="document.getElementById('backlog-overlay').remove()" style="background:#444; color:#fff; border:none; padding:5px 15px; border-radius:4px; cursor:pointer;">閉じる</button>
            </div>
            <div style="flex:1; overflow-y:auto; padding: 10px;">
                ${list || '<div style="text-align:center; color:#555; margin-top:50px;">会話履歴はありません。</div>'}
            </div>
        `;
        document.body.appendChild(div);
    },
	
	// ==========================================
    // 6. UI構造の生成 (背面立ち絵・50%位置維持)
    // ==========================================
    createStoryDOM: function() {
        // 重複生成を完全に防止
        let div = document.getElementById('story-ui-overlay');
        if (div) return div;

		div = document.createElement('div');
		div.id = 'story-ui-overlay';
		
		// ==========================================
		// 1. 画面全体を覆うベースレイヤーの設定
		// ==========================================
		div.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.4); /* 背景の暗さ(0.0〜1.0) */
			z-index: 2000;                  /* 他のUIより手前に表示 */
			display: none;                  /* 初期状態は非表示 */
			flex-direction: column;
			justify-content: flex-start;    /* 配置の基準を上端にする */
			cursor: pointer;
			font-family: sans-serif;

			/* モバイル向け最適化 */
			-webkit-tap-highlight-color: transparent; /* タップ時の青い枠を消す */
			user-select: none;                         /* テキスト選択を禁止 */
			touch-action: manipulation;                /* ダブルタップズーム防止 */
		`;

		div.innerHTML = `
			<button class="no-skip" onclick="StoryManager.showBacklog()" style="
				position: absolute; 
				top: 20px; 
				right: 20px; 
				z-index: 2100;
				background: rgba(0,0,30,0.8); 
				border: 1px solid #ffd700; 
				color: #ffd700;
				padding: 8px 15px; 
				border-radius: 4px; 
				font-weight: bold; 
				cursor: pointer;
				font-size: 12px; 
				box-shadow: 0 2px 10px rgba(0,0,0,0.5);
			">LOG</button>

			<div class="story-ui-stage" style="
				position: relative;
				width: 100%;
				height: 100%;
				box-sizing: border-box;
			">
				
				<div class="story-portrait-frame" style="
					position: absolute;
					top: 45%;         /* 画面の中央（50%）を起点とする */
					left: 40px;       /* 画面左端からの距離 */
					width: 150px;     /* キャラ画像の最大幅 */
					height: 200px;    /* 画像エリアの高さ */
					display: flex;
					align-items: flex-end; 
					transform: translateY(-100%); /* 起点(50%)から「上」に向かって画像を表示 */
					z-index: 5;       /* 吹き出し(z-index:10)より背面に配置 */
				">
					<img id="story-portrait" style="
						max-width: 100%;
						max-height: 100%;
						object-fit: contain;
						filter: drop-shadow(0 0 10px rgba(0,0,0,0.8));
					">
				</div>
				
				<div class="story-text-window" style="
					position: absolute;
					top: 45%;                  /* 吹き出しの上端を画面の50%位置に設定 */
					left: 20px;
					right: 20px;
					background: rgba(0,0,30,0.95); 
					border: 2px solid #ffd700; 
					border-radius: 8px;           
					padding: 15px;
					box-sizing: border-box;
					min-height: 110px;            
					max-height: 300px;            
					overflow-y: auto;             
					box-shadow: 0 4px 15px rgba(0,0,0,0.5); 
					z-index: 10;               /* キャラ画像より前面に表示 */
				">
					<div id="story-name" style="
						color: #ffd700;
						font-weight: bold;
						font-size: 14px;
						margin-bottom: 8px;
						border-bottom: 1px solid #444;
						padding-bottom: 4px;
					"></div>

					<div id="story-text" style="
						color: #fff;
						font-size: 13px;
						line-height: 1.6;
						letter-spacing: 0.5px;
					"></div>

					<div id="story-next-indicator" style="
						text-align: center;
						color: #ffd700;
						font-size: 10px;
						margin-top: 5px;
						animation: none;
					">▼</div>
				</div>
			</div>
`;

		(document.getElementById('game-container') || document.body).appendChild(div);
		return div;
	}
};

if (typeof window !== "undefined") {
    window.StoryManager = StoryManager;
}
