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
    mapTransferRecheckTokens: new Set(),

    // ==========================================
    // 目的表示の正本
    // ==========================================
    // 今後の「現在の目的」テキストは storyStep / subStep を基準にここで管理する。
    // UI側や main.js 側に目的文の switch 文を増やさないこと。
    // 現在のメインストーリー上限に到達した場合は、
    // 下の dungeonObjectiveMilestones に従ってダンジョン目標へ自動で切り替える。
    maxMainStoryProgress: (typeof STORY_MANAGER_DATA !== "undefined" && STORY_MANAGER_DATA.maxMainStoryProgress) ? STORY_MANAGER_DATA.maxMainStoryProgress : { storyStep: 10, subStep: 0 },

    storyObjectives: (typeof STORY_MANAGER_DATA !== "undefined" && STORY_MANAGER_DATA.storyObjectives) ? STORY_MANAGER_DATA.storyObjectives : {},

    storyDungeonObjectiveMilestones: (typeof STORY_MANAGER_DATA !== "undefined" && STORY_MANAGER_DATA.storyDungeonObjectiveMilestones) ? STORY_MANAGER_DATA.storyDungeonObjectiveMilestones : [],
    randomDungeonObjectiveMilestones: (typeof STORY_MANAGER_DATA !== "undefined" && STORY_MANAGER_DATA.randomDungeonObjectiveMilestones) ? STORY_MANAGER_DATA.randomDungeonObjectiveMilestones : [],

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
        const randomUnlocked = !!progress.flags?.abyssRandomUnlocked;
        const maxFloor = randomUnlocked
            ? Number(dungeon.maxFloor || 0)
            : Number(dungeon.storyMaxFloor || progress.maxFloor || 0);
        const tryCount = randomUnlocked
            ? Number(dungeon.randomTryCount || 0)
            : Number(dungeon.storyTryCount || dungeon.tryCount || 0);

        if (maxFloor <= 0 && tryCount <= 0) {
            return "メニューからダンジョンに挑戦しよう";
        }

        const milestones = randomUnlocked
            ? this.randomDungeonObjectiveMilestones
            : this.storyDungeonObjectiveMilestones;
        for (const milestone of milestones) {
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
        const flags = progress.flags || {};
        const currentArea = (typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function')
            ? Field.getCurrentAreaKey()
            : data?.location?.area;
        const abyssAreas = globalThis.ABYSS_REGION_MASTER?.areaKeys || [];
        // 追憶の魔境は既存ダンジョン基盤の都合で内部areaにABYSSを使うが、
        // 本編の深淵地域へ入ったことにはしない。既に本編深淵へ到達済みなら
        // abyssFirstEnteredを正本として従来どおり深淵側の目的を表示する。
        const activeAbyssMode = globalThis.ABYSS_FLOOR_RULES?.getMode?.(data)
            || data?.dungeon?.abyssMode
            || '';
        const isMemoryRealmActive = globalThis.ABYSS_FLOOR_RULES?.isMemoryMode?.(activeAbyssMode) === true;
        const isCurrentAbyssStoryArea = !isMemoryRealmActive && abyssAreas.includes(String(currentArea || ''));
        const hasEnteredAbyssRegion = !!flags.abyssFirstEntered
            || isCurrentAbyssStoryArea
            || !!flags.abyssCarmenaGateCleared;
        if (hasEnteredAbyssRegion) {
            if (!flags.abyssCarmenaGateCleared) return 'カルメナ北門を守る二将を倒そう';
            if (!flags.abyssLeonardDefeated || !flags.abyssEliciaDefeated) return '東西の楔を倒し、第一層の結界を解こう';
            if (!flags.abyssSyrisDefeated || !flags.abyssGradDefeated) return 'ビスタの先で二つの楔を倒そう';
            if (!flags.abyssLegacionNorthGateOpen) return 'レガシオンの謁見の間へ向かおう';
            if (!flags.abyssVeldDefeated) return '夢幻回廊リドパルムの最深部へ進もう';
            if (!flags.abyssJasperDefeated) return '災禍の根ジャゴレアでジャスパーを追おう';
            if (!flags.abyssIlluminaciaDefeated) {
                const insideChronoRoute = flags.abyssChronoGateOpened || ['CHRONO_ABYSS', 'FINAL_ALTAR'].includes(String(currentArea || ''));
                return insideChronoRoute
                    ? '次元牢獄クロノアビスの最深部へ進もう'
                    : '混沌の結晶片で地下神殿の封印門を開こう';
            }
            if (!flags.abyssVegnasisDefeated) return '終焉の祭壇で死幻の魔柱を倒そう';
            if (!flags.abyssAzelgaragDefeated) return '深淵王アゼルガラグを倒そう';
            if (!flags.abyssEpilogueSeen) return '深淵王との戦いを見届けよう';
            if (!flags.abyssRandomUnlocked) return '終焉の祭壇に残った亀裂を調べよう';
        }

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
                    if (!options.skipSave && typeof App.save === 'function') App.save();
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
                if (!options.skipSave && typeof App.save === 'function') App.save();
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
        if (cmd.monsterId !== undefined) {
            return (typeof MonsterData !== 'undefined' && typeof MonsterData.getImagePath === 'function')
                ? MonsterData.getImagePath(cmd.monsterId)
                : window.PRISMA_ASSETS?.getMonsterImagePath?.(cmd.monsterId);
        }
        if (cmd.effect === 'slash') return 'assets/effect/fx_phys_neutral_slash.png';
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
                    case 'MOVE_PLAYER': {
                        const x = Number(cmd.x);
                        const y = Number(cmd.y);
                        if (!Number.isFinite(x) || !Number.isFinite(y)) break;
                        const movePlayer = () => {
                            Field.x = x;
                            Field.y = y;
                            if (App?.data?.location) {
                                App.data.location.x = x;
                                App.data.location.y = y;
                            }
                            if (typeof App?.save === 'function') App.save();
                            if (typeof Field.refreshVisualState === 'function') Field.refreshVisualState();
                            else if (typeof Field.render === 'function') Field.render();
                            Field.refreshCurrentAction?.({ silent: true });
                        };
                        if (cmd.blackout === true) await this.fadeStoryFieldBlackoutWithAction(movePlayer, cmd);
                        else movePlayer();
                        break;
                    }
                    case 'PLAY_EFFECT': {
                        if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('event_effect');
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

    resolvePostBattleBossSpriteConfig: function(event) {
        const raw = event?.postBattleBossSprite;
        const explicitlyDisabled = raw === false || event?.skipAutoPostBattleBossSprite === true || event?.keepPostBattleBossSprite === false;
        if (explicitlyDisabled) return { enabled: false };
        if (raw && typeof raw === 'object') {
            return {
                enabled: raw.enabled !== false,
                monsterId: Number.isFinite(Number(raw.monsterId)) ? Number(raw.monsterId) : null,
                size: Math.max(0.5, Number(raw.size || raw.sizeTiles || 2) || 2),
                zIndex: Number.isFinite(Number(raw.zIndex ?? raw.z)) ? Number(raw.zIndex ?? raw.z) : 4
            };
        }
        return { enabled: true, monsterId: null, size: 2, zIndex: 4 };
    },

    selectPostBattleBossMonsterId: function(rawIds) {
        const ids = (Array.isArray(rawIds) ? rawIds : [rawIds])
            .map(id => Number(id))
            .filter(id => Number.isFinite(id) && id > 0);
        if (!ids.length) return null;
        // 3体編成はMAP描画と同じく中央の敵を代表ボスとして扱う。
        return ids.length === 3 ? ids[1] : ids[0];
    },

    capturePostBattleBossVisualContext: function(eventId, battle = null, phase = 'actions') {
        const source = battle || App?.data?.battle || null;
        const targetEventId = String(eventId || '');
        if (!source?.isBossBattle || !targetEventId) return false;

        const ids = (Array.isArray(source.fixedBossId) ? source.fixedBossId : [source.fixedBossId])
            .map(id => Number(id))
            .filter(id => Number.isFinite(id) && id > 0);
        if (!ids.length) return false;
        const pos = source.fixedBossPosition
            || App?.data?.progress?.activeFixedBossContext?.fixedBossPosition
            || (typeof Field !== 'undefined' ? { x: Field.x, y: Field.y } : null);
        if (!Number.isFinite(Number(pos?.x)) || !Number.isFinite(Number(pos?.y))) return false;

        const progress = App.data.progress || (App.data.progress = {});
        progress.pendingPostBattleBossVisual = {
            eventId: targetEventId,
            phase: phase === 'win' ? 'win' : 'actions',
            monsterIds: ids,
            monsterId: this.selectPostBattleBossMonsterId(ids),
            position: { x: Number(pos.x), y: Number(pos.y) },
            progressKey: source.fixedBossProgressKey || null
        };
        return true;
    },

    getPostBattleBossVisualContext: function(eventId, event = null, phase = 'actions') {
        const targetEventId = String(eventId || '');
        const spriteConfig = this.resolvePostBattleBossSpriteConfig(event);
        const pending = App?.data?.progress?.pendingPostBattleBossVisual || null;
        const pendingMatches = pending && String(pending.eventId || '') === targetEventId &&
            String(pending.phase || 'actions') === String(phase || 'actions');
        const currentProgressKey = typeof Field !== 'undefined' && typeof Field.getCurrentProgressMapKey === 'function'
            ? Field.getCurrentProgressMapKey()
            : null;
        const pendingMapMatches = !pending?.progressKey || !currentProgressKey || String(pending.progressKey) === String(currentProgressKey);
        if (pendingMatches && pendingMapMatches) {
            const monsterId = Number(spriteConfig.monsterId || pending.monsterId || pending.monsterIds?.[0] || 0);
            const pos = pending.position;
            if (Number.isFinite(monsterId) && monsterId > 0 && Number.isFinite(Number(pos?.x)) && Number.isFinite(Number(pos?.y))) {
                return { monsterId, x: Number(pos.x), y: Number(pos.y), config: spriteConfig };
            }
        }

        const battle = App?.data?.battle || null;
        const battleRelated = battle?.isBossBattle && (
            String(battle.eventId || '') === targetEventId ||
            String(battle.storyWinEventId || '') === targetEventId ||
            String(battle.fixedStoryEventId || '') === targetEventId
        );
        if (battleRelated) {
            const rawId = this.selectPostBattleBossMonsterId(battle.fixedBossId);
            const monsterId = Number(spriteConfig.monsterId || rawId || 0);
            const pos = battle.fixedBossPosition
                || App?.data?.progress?.activeFixedBossContext?.fixedBossPosition
                || (typeof Field !== 'undefined' ? { x: Field.x, y: Field.y } : null);
            if (Number.isFinite(monsterId) && monsterId > 0 && Number.isFinite(Number(pos?.x)) && Number.isFinite(Number(pos?.y))) {
                return { monsterId, x: Number(pos.x), y: Number(pos.y), config: spriteConfig };
            }
        }

        const last = App?.data?.progress?.lastFixedBossEvent || null;
        const lastRelated = last && (
            String(last.eventId || '') === targetEventId ||
            String(last.storyEventId || '') === targetEventId
        );
        if (lastRelated) {
            const rawId = this.selectPostBattleBossMonsterId(last.monsterId);
            const monsterId = Number(spriteConfig.monsterId || rawId || 0);
            const pos = last.position;
            if (Number.isFinite(monsterId) && monsterId > 0 && Number.isFinite(Number(pos?.x)) && Number.isFinite(Number(pos?.y))) {
                return { monsterId, x: Number(pos.x), y: Number(pos.y), config: spriteConfig };
            }
        }
        return null;
    },

    actionsContainConversation: function(actions) {
        if (!Array.isArray(actions)) return false;
        return actions.some(action => {
            if (!action) return false;
            if (action.type === 'CONV') return true;
            return ['then', 'else', 'otherwise', 'yes', 'no'].some(key => this.actionsContainConversation(action[key]));
        });
    },

    eventHasConversationAction: function(event, phase = 'actions') {
        const actions = phase === 'win' ? event?.winActions : event?.actions;
        return this.actionsContainConversation(actions);
    },

    showPostBattleBossSpriteForEvent: function(eventId, event, phase = 'actions') {
        const spriteConfig = this.resolvePostBattleBossSpriteConfig(event);
        if (!event || !spriteConfig.enabled) return false;
        if (!this.eventHasConversationAction(event, phase)) return false;
        // 明示的なフィールド演出を持つイベントは、そのスクリプト側の SHOW/CLEANUP に任せる。
        if (this.eventHasFieldVisualFlow(eventId, phase)) return false;
        if (typeof Field === 'undefined') return false;

        const ctx = this.getPostBattleBossVisualContext(eventId, event, phase);
        if (!ctx) return false;
        // 戦後ボスはカットシーン用DOM最前面レイヤーではなく、通常MAPオブジェクトと
        // 同じ行深度で描画する。Phaser/Canvas双方の通常描画が pending context を参照する。
        const legacyImg = typeof document !== 'undefined' ? document.getElementById('field-visual-post-battle-boss') : null;
        if (legacyImg) legacyImg.remove();
        if (typeof Field.refreshVisualState === 'function') Field.refreshVisualState();
        else if (typeof Field.render === 'function') Field.render();
        return true;
    },

    cleanupPostBattleBossSprite: function(eventId = null, phase = null) {
        const img = typeof document !== 'undefined' ? document.getElementById('field-visual-post-battle-boss') : null;
        const imageEventMatches = !eventId || String(img?.dataset?.postBattleEventId || '') === String(eventId);
        const imagePhaseMatches = !phase || String(img?.dataset?.postBattlePhase || 'actions') === String(phase);
        if (img && imageEventMatches && imagePhaseMatches) img.remove();
        const layer = typeof document !== 'undefined' ? document.getElementById('field-visual-cutscene-layer') : null;
        if (layer && layer.children.length === 0) layer.remove();
        const progress = App?.data?.progress;
        const pending = progress?.pendingPostBattleBossVisual;
        const eventMatches = !eventId || String(pending?.eventId || '') === String(eventId);
        const phaseMatches = !phase || String(pending?.phase || 'actions') === String(phase);
        if (pending && eventMatches && phaseMatches) {
            delete progress.pendingPostBattleBossVisual;
            if (typeof App !== 'undefined' && typeof App.save === 'function') App.save();
            if (typeof Field !== 'undefined' && typeof Field.refreshVisualState === 'function') Field.refreshVisualState();
            else if (typeof Field !== 'undefined' && typeof Field.render === 'function') Field.render();
        }
    },

    // ==========================================
    // 進行イベント・予約イベントの永続ジャーナル
    // ==========================================
    createEventToken: function(prefix = 'evt') {
        const random = Math.random().toString(36).slice(2, 10);
        return `${prefix}-${Date.now().toString(36)}-${random}`;
    },

    getEventPathKey: function(path = []) {
        return (Array.isArray(path) ? path : [path]).map(part => String(part)).join('/');
    },

    normalizeActiveEventJournal: function(active, fallback = {}) {
        if (!active || typeof active !== 'object') active = {};
        active.token = active.token || fallback.token || this.createEventToken('evt');
        active.eventId = active.eventId || fallback.eventId || null;
        active.phase = active.phase || fallback.phase || 'actions';
        active.status = active.status || 'running';
        active.currentPath = Array.isArray(active.currentPath)
            ? active.currentPath
            : (Number.isFinite(Number(active.actionIndex)) ? [Number(active.actionIndex)] : null);
        active.completedActions = active.completedActions && typeof active.completedActions === 'object'
            ? active.completedActions
            : {};
        active.selectedBranches = active.selectedBranches && typeof active.selectedBranches === 'object'
            ? active.selectedBranches
            : {};
        active.effectStates = active.effectStates && typeof active.effectStates === 'object'
            ? active.effectStates
            : {};
        active.meta = active.meta && typeof active.meta === 'object' ? active.meta : (fallback.meta || {});
        active.startedAt = Number(active.startedAt || Date.now());
        return active;
    },

    ensureEventJournal: function() {
        const progress = App?.data?.progress;
        if (!progress) return null;
        if (!progress.eventJournal || typeof progress.eventJournal !== 'object') {
            progress.eventJournal = { version: 2, queue: [], active: null };
        }
        const journal = progress.eventJournal;
        journal.version = 2;
        if (!Array.isArray(journal.queue)) journal.queue = [];
        let nextSequence = Math.max(1, Number(journal.nextSequence || 1));
        journal.queue.forEach(entry => {
            if (!entry || Number.isFinite(Number(entry.sequence))) return;
            entry.sequence = nextSequence++;
        });
        journal.nextSequence = Math.max(nextSequence, ...journal.queue.map(entry => Number(entry?.sequence || 0) + 1));

        const migrateLegacyQueue = (eventId, phase, legacyKey) => {
            if (!eventId) return;
            const exists = journal.queue.some(entry => entry && entry.eventId === eventId && entry.phase === phase && entry.status !== 'completed');
            if (!exists) {
                journal.queue.push({
                    token: this.createEventToken(phase === 'win' ? 'win' : 'evt'),
                    eventId,
                    phase,
                    status: 'queued',
                    sequence: journal.nextSequence++,
                    createdAt: Date.now(),
                    meta: { migratedFrom: legacyKey }
                });
            }
            delete progress[legacyKey];
        };
        migrateLegacyQueue(progress.pendingEventId, 'actions', 'pendingEventId');
        migrateLegacyQueue(progress.pendingBattleWinEventId, 'win', 'pendingBattleWinEventId');

        if (!journal.active && progress.activeEvent) {
            const legacy = progress.activeEvent;
            const active = this.normalizeActiveEventJournal({
                ...legacy,
                token: legacy.token || this.createEventToken('evt'),
                currentPath: Array.isArray(legacy.currentPath)
                    ? legacy.currentPath
                    : [Math.max(0, Number(legacy.actionIndex || 0))],
                completedActions: legacy.completedActions || {},
                selectedBranches: legacy.selectedBranches || {},
                effectStates: legacy.effectStates || {},
                meta: legacy.meta || { migratedFrom: 'activeEvent' }
            });
            const actionIndex = Math.max(0, Number(legacy.actionIndex || 0));
            for (let i = 0; i < actionIndex; i++) active.completedActions[String(i)] = true;

            // v1カーソルで世界樹の葉消費後に止まったレイラ加入セーブを救済する。
            // 回復会話まで到達している場合は選択済み分岐と消費済み命令を復元する。
            // 会話情報も残っていない曖昧な狭い窓では、葉を1枚だけ戻して再選択可能にする。
            if (legacy.eventId === 'light_palace_prison_leila' &&
                !progress.flags?.leilaJoined && progress.flags?.lightPalaceCleared) {
                const conversationKey = String(progress.activeConversation?.key || '');
                const branchPaths = {
                    outer: '0',
                    item: '0/then/1',
                    choice: '0/then/1/then/0',
                    consume: '0/then/1/then/0/yes/0'
                };
                if (conversationKey === 'LIGHT_PALACE_LEILA_RECOVERY_JOIN') {
                    active.selectedBranches[branchPaths.outer] = 'then';
                    active.selectedBranches[branchPaths.item] = 'then';
                    active.selectedBranches[branchPaths.choice] = 'yes';
                    active.completedActions[branchPaths.consume] = true;
                    active.meta.legacyRecovery = 'leila-consumed-leaf';
                } else if (!conversationKey && Number(App.data?.items?.[5] || 0) <= 0) {
                    if (!App.data.items) App.data.items = {};
                    App.data.items[5] = 1;
                    active.meta.legacyRecovery = 'leila-restored-leaf';
                }
            }
            journal.active = active;
        }

        if (journal.active) {
            journal.active = this.normalizeActiveEventJournal(journal.active);
            progress.activeEvent = journal.active;
        } else if (progress.activeEvent) {
            delete progress.activeEvent;
        }
        return journal;
    },

    queueEvent: function(eventId, phase = 'actions', options = {}) {
        if (!eventId) return null;
        const journal = this.ensureEventJournal();
        if (!journal) return null;
        const normalizedPhase = phase === 'win' ? 'win' : 'actions';
        const dedupeKey = options.dedupeKey || null;
        const existing = dedupeKey
            ? journal.queue.find(entry => entry && entry.status !== 'completed' && entry.dedupeKey === dedupeKey)
            : null;
        if (existing) {
            existing.meta = { ...(existing.meta || {}), ...(options.meta || {}) };
            if (options.save !== false) App.save();
            return existing;
        }
        const entry = {
            token: options.token || this.createEventToken(normalizedPhase === 'win' ? 'win' : 'evt'),
            eventId,
            phase: normalizedPhase,
            status: 'queued',
            dedupeKey,
            sequence: Number(journal.nextSequence || 1),
            createdAt: Date.now(),
            meta: options.meta && typeof options.meta === 'object' ? { ...options.meta } : {}
        };
        journal.nextSequence = entry.sequence + 1;
        journal.queue.push(entry);
        if (options.save !== false) App.save();
        return entry;
    },

    activateQueuedEvent: function(entry) {
        const progress = App?.data?.progress;
        const journal = this.ensureEventJournal();
        if (!progress || !journal || !entry) return null;
        entry.status = 'running';
        entry.startedAt = entry.startedAt || Date.now();
        const active = this.normalizeActiveEventJournal({
            token: entry.token,
            eventId: entry.eventId,
            phase: entry.phase,
            status: 'running',
            currentPath: null,
            completedActions: entry.completedActions || {},
            selectedBranches: entry.selectedBranches || {},
            effectStates: entry.effectStates || {},
            meta: entry.meta || {},
            startedAt: entry.startedAt
        });
        journal.active = active;
        progress.activeEvent = active;
        App.save();
        return active;
    },

    beginEventExecution: function(eventId, phase = 'actions', options = {}) {
        const progress = App?.data?.progress;
        const journal = this.ensureEventJournal();
        if (!progress || !journal) return null;
        let active = journal.active;
        if (!active || active.eventId !== eventId || active.phase !== phase || (options.token && active.token !== options.token)) {
            active = this.normalizeActiveEventJournal({
                token: options.token || this.createEventToken(phase === 'win' ? 'win' : 'evt'),
                eventId,
                phase,
                status: 'running',
                currentPath: null,
                completedActions: {},
                selectedBranches: {},
                effectStates: {},
                meta: options.meta || {}
            });
            const startActionIndex = Math.max(0, Number(options.startActionIndex || 0));
            for (let i = 0; i < startActionIndex; i++) active.completedActions[String(i)] = true;
            journal.active = active;
        }
        active.status = 'running';
        active.error = null;
        active.meta = { ...(active.meta || {}), ...(options.meta || {}) };
        progress.activeEvent = active;
        return active;
    },

    completeEventExecution: function(active) {
        const progress = App?.data?.progress;
        const journal = this.ensureEventJournal();
        if (!progress || !journal) return;
        const token = active?.token || journal.active?.token || null;
        if (token) journal.queue = journal.queue.filter(entry => entry?.token !== token);
        journal.active = null;
        delete progress.activeEvent;
        delete progress.activeConversation;
        this.isTyping = false;
        this.active = false;
        this.endConversation();
        App.save();
    },

    failEventExecution: function(active, error) {
        const progress = App?.data?.progress;
        const journal = this.ensureEventJournal();
        const message = String(error?.message || error || '不明なイベントエラー');
        if (active) {
            active.status = 'error';
            active.error = { message, at: Date.now(), path: active.currentPath || null };
            if (journal) journal.active = active;
            if (progress) progress.activeEvent = active;
        }
        this.isTyping = false;
        this.active = false;
        this.dismissChoiceUI({ hideOverlay: true });
        this.endConversation();
        App.save();
        console.error('[StoryManager] event execution failed:', error);
        App.log(`<span style="color:#ff8b8b;">イベント処理を中断しました。再読込すると同じ位置から再試行します。<br>${this.escapeHtml ? this.escapeHtml(message) : message}</span>`);
    },

    getMapTransferArrivalState: function(pending) {
        if (!pending) return { arrived: false };
        const location = App.data?.location || {};
        const area = String(location.area || '');
        const mapData = (typeof Field !== 'undefined') ? Field.currentMapData : null;
        let currentAreaKey = null;
        try {
            currentAreaKey = typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function'
                ? Field.getCurrentAreaKey()
                : null;
        } catch (error) {
            console.warn('[StoryManager] current area lookup during transfer recovery failed:', error);
        }
        const mapIds = [
            mapData?.id,
            mapData?.key,
            mapData?.mapId,
            mapData?.areaKey,
            mapData?.canonicalAreaKey,
            currentAreaKey,
            area
        ].filter(value => value !== undefined && value !== null).map(String);
        const currentFloor = Number(App.data?.progress?.floor || mapData?.floor || 0);
        const currentX = Number(typeof Field !== 'undefined' && Number.isFinite(Number(Field.x)) ? Field.x : location.x);
        const currentY = Number(typeof Field !== 'undefined' && Number.isFinite(Number(Field.y)) ? Field.y : location.y);

        let destinationMatches = false;
        if (pending.targetType === 'fixedMap' || pending.targetType === 'fixedDungeon') {
            destinationMatches = mapIds.includes(String(pending.targetId || ''));
        } else if (pending.targetType === 'abyss') {
            destinationMatches = area === 'ABYSS' || mapIds.includes('ABYSS');
            if (destinationMatches && pending.mode && App.data?.dungeon?.abyssMode) {
                destinationMatches = String(App.data.dungeon.abyssMode) === String(pending.mode);
            }
        }

        if (destinationMatches && Number.isFinite(Number(pending.floor)) && Number(pending.floor) > 0) {
            destinationMatches = currentFloor === Number(pending.floor);
        }
        if (destinationMatches && pending.targetX !== null && pending.targetX !== undefined &&
            Number.isFinite(Number(pending.targetX))) {
            destinationMatches = currentX === Number(pending.targetX);
        }
        if (destinationMatches && pending.targetY !== null && pending.targetY !== undefined &&
            Number.isFinite(Number(pending.targetY))) {
            destinationMatches = currentY === Number(pending.targetY);
        }
        return {
            arrived: destinationMatches,
            area,
            mapIds,
            floor: currentFloor,
            x: currentX,
            y: currentY
        };
    },

    recoverPendingMapTransfer: function() {
        const progress = App?.data?.progress;
        const pending = progress?.pendingMapTransfer;
        if (!pending) return false;
        const journal = this.ensureEventJournal();
        const active = journal?.active;
        const arrival = this.getMapTransferArrivalState(pending);

        // シーン切替直後はField.currentMapDataの構築がまだ終わっていない場合がある。
        // API受付から短時間は失敗判定せず、初期化完了後にもう一度照合する。
        if (!arrival.arrived && pending.status === 'dispatched' &&
            Date.now() - Number(pending.dispatchedAt || 0) < 1500) {
            // 再照合予約はメモリ上だけで管理する。セーブへ一時フラグを残すと、
            // タイマー発火前の再読込後に永久に再予約されないため。
            if (!(this.mapTransferRecheckTokens instanceof Set)) this.mapTransferRecheckTokens = new Set();
            if (!this.mapTransferRecheckTokens.has(pending.token)) {
                this.mapTransferRecheckTokens.add(pending.token);
                setTimeout(() => {
                    this.mapTransferRecheckTokens.delete(pending.token);
                    const current = App.data?.progress?.pendingMapTransfer;
                    if (current?.token === pending.token) StoryManager.resumeActiveConversation?.();
                }, 250);
            }
            return true;
        }

        if (arrival.arrived) {
            pending.status = 'arrived';
            pending.arrivedAt = Date.now();
            pending.arrival = arrival;
            if (active && pending.sourceEventToken === active.token) {
                const key = this.getEventPathKey(pending.actionPath || active.currentPath || []);
                if (key) active.completedActions[key] = true;
                delete progress.pendingMapTransfer;
                this.completeEventExecution(active);
            } else if (!active && pending.sourceEventSnapshot?.eventId) {
                // 遷移自体は成功したが、旧版の削除先行処理などでactiveだけ失われた場合も
                // 保存済みスナップショットから完了処理を復元する。
                const restored = this.normalizeActiveEventJournal(pending.sourceEventSnapshot);
                const key = this.getEventPathKey(pending.actionPath || restored.currentPath || []);
                if (key) restored.completedActions[key] = true;
                journal.active = restored;
                progress.activeEvent = restored;
                delete progress.pendingMapTransfer;
                this.completeEventExecution(restored);
            } else {
                delete progress.pendingMapTransfer;
                App.save();
            }
            return true;
        }

        // 遷移API受付後も目的地へ到着していない場合は、元命令を未完了のまま再試行する。
        // actionPathを完了扱いにしないため、MAP変更失敗でイベントだけ失われない。
        if (active && pending.sourceEventToken === active.token) {
            active.status = 'running';
            active.currentPath = Array.isArray(pending.actionPath) ? [...pending.actionPath] : active.currentPath;
            pending.status = 'retry';
            pending.lastMismatch = arrival;
            pending.retryCount = Math.max(0, Number(pending.retryCount || 0)) + 1;
            delete progress.pendingMapTransfer;
            journal.active = active;
            progress.activeEvent = active;
            App.save();
            return false;
        }

        // 旧版の削除先行セーブを救済できるよう、保存済みイベントスナップショットがあれば復元する。
        if (!active && pending.sourceEventSnapshot?.eventId) {
            const restored = this.normalizeActiveEventJournal(pending.sourceEventSnapshot);
            restored.status = 'running';
            restored.currentPath = Array.isArray(pending.actionPath) ? [...pending.actionPath] : restored.currentPath;
            const key = this.getEventPathKey(restored.currentPath || []);
            if (key) delete restored.completedActions[key];
            journal.active = restored;
            progress.activeEvent = restored;
            delete progress.pendingMapTransfer;
            App.save();
            return false;
        }

        pending.status = 'orphaned';
        pending.lastMismatch = arrival;
        App.save();
        return false;
    },

    persistEventCursor: function(active, path) {
        const progress = App?.data?.progress;
        const journal = this.ensureEventJournal();
        if (!active || !progress || !journal) return;
        active.currentPath = Array.isArray(path) ? [...path] : null;
        active.status = 'running';
        journal.active = active;
        progress.activeEvent = active;
        App.save();
    },

    runEventActionList: async function(actions, rootEventId, phase, active, options = {}) {
        if (!Array.isArray(actions)) return null;
        const prefix = Array.isArray(options.prefix) ? options.prefix : [];
        const runtimeEventId = options.runtimeEventId || rootEventId;
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            if (!action) continue;
            const path = [...prefix, i];
            const pathKey = this.getEventPathKey(path);
            if (active.completedActions[pathKey]) continue;

            this.persistEventCursor(active, path);
            let result = null;

            if (action.type === 'IF_FLAG' || action.type === 'IF' || action.type === 'IF_ITEM' || action.type === 'CHOICE') {
                let branchName = active.selectedBranches[pathKey];
                if (!branchName) {
                    if (action.type === 'IF_FLAG' || action.type === 'IF') {
                        const key = action.key || action.flag || action.value;
                        const expected = action.state !== undefined ? !!action.state : true;
                        const actual = key ? !!(App.data.progress.flags && App.data.progress.flags[key]) : false;
                        branchName = (actual === expected) ? 'then' : (Array.isArray(action.else) ? 'else' : 'otherwise');
                    } else if (action.type === 'IF_ITEM') {
                        const itemId = Number(action.id ?? action.itemId ?? action.value);
                        const requiredCount = Math.max(1, Math.floor(Number(action.count) || 1));
                        branchName = Number(App.data?.items?.[itemId] || 0) >= requiredCount
                            ? 'then'
                            : (Array.isArray(action.else) ? 'else' : 'otherwise');
                    } else {
                        const isYes = await this.showChoice(action.text);
                        branchName = isYes ? 'yes' : 'no';
                    }
                    active.selectedBranches[pathKey] = branchName;
                    App.save();
                }
                const branch = action[branchName] || (branchName === 'otherwise' ? action.else : null) || [];
                result = await this.runEventActionList(branch, rootEventId, phase, active, {
                    prefix: [...path, branchName],
                    runtimeEventId
                });
            } else if (action.type === 'EVENT') {
                const subEvent = this.events[action.value];
                if (!subEvent?.actions) throw new Error(`サブイベントが見つかりません: ${action.value}`);
                result = await this.runEventActionList(subEvent.actions, rootEventId, phase, active, {
                    prefix: [...path, `event:${action.value}`],
                    runtimeEventId: action.value
                });
            } else {
                const conversation = App.data?.progress?.activeConversation;
                const sameConversationAction = action.type === 'CONV' && conversation?.key === action.value;
                const lineIndex = sameConversationAction
                    ? Math.max(0, Number(conversation.index || 0))
                    : ((options.initialLineIndex && prefix.length === 0 && i === 0) ? options.initialLineIndex : 0);
                result = await this.processAction(action, runtimeEventId, lineIndex, {
                    managed: true,
                    deferSave: true,
                    activeEvent: active,
                    rootEventId,
                    phase,
                    path
                });
            }

            if (result === 'BREAK' || result === 'BREAK_COMPLETE' || result === 'BREAK_TRANSFER') {
                active.currentPath = path;
                if (result === 'BREAK_TRANSFER') {
                    // 到着確認が済むまで命令を完了扱いにしない。
                    active.status = 'waiting_transfer';
                    const pendingTransfer = App.data?.progress?.pendingMapTransfer;
                    if (pendingTransfer?.sourceEventToken === active.token) {
                        pendingTransfer.sourceEventSnapshot = JSON.parse(JSON.stringify(active));
                    }
                    App.save();
                } else {
                    active.completedActions[pathKey] = true;
                    active.status = result === 'BREAK_COMPLETE' ? 'completed' : 'suspended';
                    if (result === 'BREAK_COMPLETE') this.completeEventExecution(active);
                    else App.save();
                }
                return result === 'BREAK_TRANSFER' ? 'BREAK_TRANSFER' : 'BREAK';
            }

            active.completedActions[pathKey] = true;
            active.currentPath = null;
            delete App.data.progress.activeConversation;
            App.save();
        }
        return null;
    },

    /**
     * 中断されたイベントまたは会話があれば再開する
     */
    resumeActiveConversation: function() {
        const data = App.data ? App.data.progress : null;
        if (!data) return false;
        if (this.recoverPendingMapTransfer()) return true;
        const journal = this.ensureEventJournal();
        const active = journal?.active;
        if (!active && !data.activeConversation) return false;

        this.active = false;
        this.isTyping = false;
        (async () => {
            try {
                if (active?.eventId) {
                    // restartOnResume は副作用済み命令との整合が取れないため使用しない。
                    // eventJournal の分岐・完了済み命令・会話行を正確に再開する。
                    if (active.phase === 'win') {
                        await this.onBattleWin(active.eventId, 0, 0, { token: active.token, resume: true, meta: active.meta });
                    } else {
                        await this.executeEvent(active.eventId, false, 0, 0, { token: active.token, resume: true, meta: active.meta });
                    }
                } else if (data.activeConversation) {
                    const key = data.activeConversation.key;
                    const conversationResult = await this.waitForConversationCompletion(key, Number(data.activeConversation.index || 0));
                    const conversationStatus = conversationResult?.status
                        || (conversationResult === false ? 'error' : 'completed');
                    if (conversationStatus !== 'completed') {
                        throw new Error(`会話を再開できませんでした: ${key} (${conversationStatus})`);
                    }
                    this.endConversation();
                }
            } catch (error) {
                this.isTyping = false;
                this.active = false;
                console.error('[StoryManager] active conversation resume failed:', error);
                App.log('<span style="color:#ff8b8b;">会話の再開に失敗しました。再読込すると同じ位置から再試行します。</span>');
            }
        })();
        return true;
    },

    resumeQueuedEventByPhase: function(phase = null) {
        const journal = this.ensureEventJournal();
        if (!journal || journal.active) return false;
        const entry = journal.queue
            .filter(item => item && (!phase || item.phase === phase) && ['queued', 'running'].includes(item.status))
            .sort((a, b) => Number(a.sequence || a.createdAt || 0) - Number(b.sequence || b.createdAt || 0))[0];
        if (!entry) return false;
        const active = this.activateQueuedEvent(entry);
        if (!active) return false;
        this.active = false;
        this.isTyping = false;
        (async () => {
            if (phase === 'win') {
                await this.onBattleWin(entry.eventId, 0, 0, { token: entry.token, resume: true, meta: entry.meta });
            } else {
                await this.executeEvent(entry.eventId, false, 0, 0, { token: entry.token, resume: true, meta: entry.meta });
            }
        })();
        return true;
    },

    resumePendingStoryEvent: function() {
        return this.resumeQueuedEventByPhase(null);
    },

    resumePendingBattleWinEvent: function() {
        return this.resumeQueuedEventByPhase('win');
    },

    resumePendingEvent: function() {
        return this.resumeQueuedEventByPhase('actions');
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
    executeEvent: async function(eventId, isSubEvent = false, startActionIndex = 0, startLineIndex = 0, options = {}) {
        const event = this.events[eventId];
        if (!event || !Array.isArray(event.actions)) return false;

        // 旧EVENT命令の直接呼出し互換。新ランナーではサブイベントも同じジャーナルへ展開する。
        if (isSubEvent) {
            for (let i = Math.max(0, Number(startActionIndex || 0)); i < event.actions.length; i++) {
                const lineIdx = i === Number(startActionIndex || 0) ? startLineIndex : 0;
                const result = await this.processAction(event.actions[i], eventId, lineIdx);
                if (result === 'BREAK' || result === 'BREAK_COMPLETE' || result === 'BREAK_TRANSFER') return result;
            }
            return true;
        }

        const journal = this.ensureEventJournal();
        if (this.active && journal?.active && journal.active.eventId !== eventId) return false;
        const active = this.beginEventExecution(eventId, 'actions', {
            token: options.token,
            meta: options.meta,
            startActionIndex
        });
        if (!active) return false;
        this.active = true;
        this.showPostBattleBossSpriteForEvent(eventId, event, 'actions');

        try {
            const result = await this.runEventActionList(event.actions, eventId, 'actions', active, {
                initialLineIndex: startLineIndex
            });
            if (result === 'BREAK' || result === 'BREAK_TRANSFER') return true;
            this.completeEventExecution(active);
            this.refreshFieldAfterStoryStateChange();
            return true;
        } catch (error) {
            this.failEventExecution(active, error);
            return false;
        } finally {
            this.cleanupPostBattleBossSprite(eventId, 'actions');
        }
    },

    /**
     * 勝利後イベント実行
     */
    onBattleWin: async function(eventId, startActionIndex = 0, startLineIndex = 0, options = {}) {
        const event = this.events[eventId];
        if (!event || !Array.isArray(event.winActions)) return false;
        const active = this.beginEventExecution(eventId, 'win', {
            token: options.token,
            meta: options.meta,
            startActionIndex
        });
        if (!active) return false;

        this.active = true;
        this.showPostBattleBossSpriteForEvent(eventId, event, 'win');
        try {
            const result = await this.runEventActionList(event.winActions, eventId, 'win', active, {
                initialLineIndex: startLineIndex
            });
            if (result === 'BREAK' || result === 'BREAK_TRANSFER') return true;
            this.completeEventExecution(active);
            this.refreshFieldAfterStoryStateChange();
            return true;
        } catch (error) {
            this.failEventExecution(active, error);
            return false;
        } finally {
            this.cleanupPostBattleBossSprite(eventId, 'win');
        }
    },

    /**
     * 会話イベント中にMAP遷移する前のUI後始末。
     * activeEvent は遷移成功が確認できるまで残し、失敗時に同じ命令から再試行できるようにする。
     */
    prepareMapTransfer: function(options = {}) {
        const data = App?.data?.progress;
        if (data) delete data.activeConversation;
        this.isTyping = false;
        this.active = false;
        this.endConversation();
        if (options.save !== false && typeof App !== 'undefined' && typeof App.save === 'function') App.save();
    },

    performMapTransfer: function(targetType, targetId, transferOptions = {}, context = {}) {
        const progress = App?.data?.progress;
        const active = context.activeEvent || this.ensureEventJournal()?.active || null;
        if (!progress || !active) throw new Error('MAP遷移元イベントを特定できません。');
        const token = this.createEventToken('map');
        progress.pendingMapTransfer = {
            token,
            sourceEventToken: active.token,
            sourceEventId: active.eventId,
            sourceEventSnapshot: JSON.parse(JSON.stringify(active)),
            actionPath: Array.isArray(context.path) ? [...context.path] : active.currentPath,
            targetType,
            targetId: targetId || null,
            entryKey: transferOptions.entryKey || null,
            mode: transferOptions.mode || null,
            floor: transferOptions.floor || null,
            targetX: transferOptions.targetX !== null && transferOptions.targetX !== undefined && Number.isFinite(Number(transferOptions.targetX))
                ? Number(transferOptions.targetX)
                : null,
            targetY: transferOptions.targetY !== null && transferOptions.targetY !== undefined && Number.isFinite(Number(transferOptions.targetY))
                ? Number(transferOptions.targetY)
                : null,
            status: 'requested',
            requestedAt: Date.now()
        };
        App.save();
        this.prepareMapTransfer({ save: false });

        let result = false;
        if (targetType === 'fixedDungeon') {
            result = !!(typeof Dungeon !== 'undefined' && typeof Dungeon.startFixed === 'function' &&
                Dungeon.startFixed(targetId, transferOptions));
        } else if (targetType === 'fixedMap') {
            result = !!(typeof Field !== 'undefined' && typeof Field.enterFixedMap === 'function' &&
                Field.enterFixedMap(targetId, transferOptions));
        } else if (targetType === 'abyss') {
            if (typeof Dungeon === 'undefined') result = false;
            else if (transferOptions.direct === true && typeof Dungeon.start === 'function') {
                result = Dungeon.start(transferOptions.floor || 1, { mode: transferOptions.mode || 'story' }) !== false;
            } else if (typeof Dungeon.enter === 'function') {
                result = Dungeon.enter({ mode: transferOptions.mode || 'story' }) !== false;
            }
        }

        if (!result) {
            progress.pendingMapTransfer.status = 'error';
            progress.pendingMapTransfer.error = 'target_rejected';
            progress.pendingMapTransfer.failedAt = Date.now();
            App.save();
            throw new Error(`MAP遷移に失敗しました: ${targetType}:${targetId || ''}`);
        }
        // APIがtrueを返しただけでは到着完了とみなさない。次シーン初期化後に厳密照合する。
        progress.pendingMapTransfer.status = 'dispatched';
        progress.pendingMapTransfer.dispatchedAt = Date.now();
        App.save();
        return true;
    },

    /**
     * ストーリー用の敗北演出。
     * 通常のゲームオーバー処理は呼ばず、暗転・全滅ログ・HP0表示を挟んでから、
     * 指定割合で復帰させて次の会話へ進める。
     */
    playStoryDefeatEffect: async function(action = {}, context = {}) {
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
        const partyUids = Array.isArray(App.data?.party) ? App.data.party.filter(Boolean) : [];
        const targets = Array.isArray(App.data?.characters)
            ? App.data.characters.filter(c => c && partyUids.includes(c.uid))
            : [];
        const active = context.activeEvent || this.ensureEventJournal()?.active || null;
        const pathKey = this.getEventPathKey(context.path || active?.currentPath || []);
        if (active && !active.effectStates) active.effectStates = {};
        const effectState = active && pathKey
            ? (active.effectStates[pathKey] || (active.effectStates[pathKey] = { status: 'pending' }))
            : { status: 'pending' };
        const normalWipeout = action.normalWipeout || action.useNormalWipeout;

        // 副作用は演出より先に一度だけ確定する。演出中に再読込されても、
        // 全滅回数・HP・帰還先を二重適用せず同じアクションを安全に再表示できる。
        if (effectState.status !== 'committed') {
            if (App.data?.stats) App.data.stats.wipeoutCount = (App.data.stats.wipeoutCount || 0) + 1;
            effectState.normalWipeout = !!normalWipeout;
            effectState.targets = [];

            if (normalWipeout) {
                targets.forEach(c => {
                    c.currentHp = 1;
                    delete c.battleStatus;
                    effectState.targets.push({ uid: c.uid, hp: 1, mp: Math.max(0, Number(c.currentMp || 0)) });
                });
                if (App.data) App.data.battle = { active: false };
                if (typeof Dungeon !== 'undefined' && typeof Dungeon.exit === 'function') {
                    effectState.returnPoint = Dungeon.exit(true, null, {
                        save: false,
                        changeScene: false,
                        log: false,
                        clearAction: false
                    });
                } else if (typeof App !== 'undefined') {
                    App.data.location.area = 'WORLD';
                    App.data.location.worldKey = 'WORLD';
                    App.data.location.x = 58;
                    App.data.location.y = 65;
                    effectState.returnPoint = { area: 'WORLD', worldKey: 'WORLD', x: 58, y: 65 };
                }
            } else {
                const hpRate = Math.max(0.01, Math.min(1, Number(action.recoverRate ?? 0.35)));
                const mpRate = Math.max(0, Math.min(1, Number(action.recoverMpRate ?? 0.25)));
                targets.forEach(c => {
                    const stats = typeof App.calcStats === 'function' ? App.calcStats(c) : { maxHp: c.hp || 1, maxMp: c.mp || 0 };
                    const hp = Math.max(1, Math.floor((Number(stats.maxHp) || 1) * hpRate));
                    const mp = Math.max(Number(c.currentMp || 0), Math.floor((Number(stats.maxMp) || 0) * mpRate));
                    c.currentHp = hp;
                    c.currentMp = mp;
                    delete c.battleStatus;
                    effectState.targets.push({ uid: c.uid, hp, mp });
                });
            }
            effectState.status = 'committed';
            effectState.committedAt = Date.now();
            App.save();
        }

        const restoreCommittedTargets = () => {
            (effectState.targets || []).forEach(snapshot => {
                const c = App.getChar?.(snapshot.uid) || targets.find(target => target.uid === snapshot.uid);
                if (!c) return;
                c.currentHp = Math.max(0, Number(snapshot.hp || 0));
                c.currentMp = Math.max(0, Number(snapshot.mp || 0));
                delete c.battleStatus;
            });
        };

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

        if (normalWipeout) {
            restoreCommittedTargets();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
            await wait(Number(action.downWait || 900));
            if (typeof App.changeScene === 'function') App.changeScene('field');
            await wait(Number(action.fadeHold || 650));
        } else {
            // HP0は保存データへ書き戻さない。暗転中は敗北ログだけを表示し、
            // pagehide等の自動保存が入っても回復後の確定状態を壊さない。
            await wait(Number(action.downWait || 900));
            restoreCommittedTargets();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
            await wait(Number(action.fadeHold || 450));
        }

        fade.style.opacity = '0';
        await wait(460);
        fade.remove();
        if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
            Field.refreshCurrentAction({ silent: true });
        }
    },

    waitForConversationCompletion: async function(scriptKey, startFromIndex = 0, options = {}) {
        const pollMs = Math.max(20, Number(options.pollMs || 50));
        let result = await this.showConversation(scriptKey, startFromIndex);
        while (result?.status === 'busy') {
            await new Promise(resolve => setTimeout(resolve, pollMs));
            if (typeof options.abortWhen === 'function' && options.abortWhen()) {
                return { status: 'aborted', scriptKey };
            }
            result = await this.showConversation(scriptKey, startFromIndex);
        }
        const status = result?.status || (result === false ? 'error' : 'completed');
        return result && typeof result === 'object' ? result : { status, scriptKey };
    },

    /**
     * 各アクションの個別処理
     * @param {Object} action 
     * @param {string} eventId 
     * @param {number} lineIndex 再開時のセリフ番号
     */
    processAction: async function(action, eventId, lineIndex = 0, context = {}) {
        const data = App.data.progress;
        const deferSave = context.deferSave === true;
        
        // CONV命令時に lineIndex を渡す。未表示・競合を成功扱いしない。
        if (action.type === 'CONV') {
            const conversationResult = await this.waitForConversationCompletion(action.value, lineIndex, {
                abortWhen: () => context.activeEvent?.status === 'error'
            });
            const conversationStatus = conversationResult?.status
                || (conversationResult === false ? 'error' : 'completed');
            if (conversationStatus !== 'completed') {
                throw new Error(`会話を完了できませんでした: ${action.value} (${conversationStatus})`);
            }
        }
        
        if (action.type === 'ALLY') {
            App.addStoryAlly(action.value, { save: !deferSave });
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
                    reason: eventId || 'story_event',
                    skipSave: deferSave
                });
            }
        }

        if (action.type === 'TEMP_LB_CLEAR') {
            this.installTemporaryStoryPowerApi();
            if (typeof App.clearTemporaryStoryPower === 'function') {
                App.clearTemporaryStoryPower({ id: action.id || null, skipSave: deferSave });
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
            if (!deferSave && typeof App.save === 'function') App.save();
            if (typeof Menu !== 'undefined') Menu.renderPartyBar();
        }
        
        if (action.type === 'HEAL') {
            if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('heal');
            App.data.characters.forEach(c => {
                const stats = App.calcStats(c);
                c.currentHp = stats.maxHp;
                c.currentMp = stats.maxMp;
            });
            if (!deferSave) App.save();
            if (typeof Menu !== 'undefined') Menu.renderPartyBar();
            App.log("不思議な力で体力が回復した！");
        }
        
        if (action.type === 'SUB')  { data.subStep = action.value; }
        if (action.type === 'LOG')   App.log(action.value);
        if (action.type === 'CREDITS') {
            await this.showCredits(action);
        }

        if (action.type === 'QUEST_ACCEPT' && typeof App.acceptQuest === 'function') {
            App.acceptQuest(action.value || action.questId, { silent: true, save: !deferSave });
        }

        if (action.type === 'QUEST_COMPLETE' && typeof App.completeQuest === 'function') {
            App.completeQuest(action.value || action.questId, { silent: true, save: !deferSave });
            this.refreshFieldAfterStoryStateChange();
        }

        if (action.type === 'STORY_DEFEAT') {
            await this.playStoryDefeatEffect(action, context);
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
                if (!deferSave) App.save();
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
            App.reconcileDerivedProgressFlags?.();
            if (!deferSave) App.save();
            if (action.refreshField === true) this.refreshFieldAfterStoryStateChange();
        }

        if (action.type === 'UNLOCK') {
            const keys = Array.isArray(action.value) ? action.value : [action.value];
            keys.filter(Boolean).forEach(key => {
                if (typeof App.unlockFeature === 'function') App.unlockFeature(key, { save: !deferSave });
                else {
                    if (!data.unlocked || typeof data.unlocked !== 'object' || Array.isArray(data.unlocked)) data.unlocked = {};
                    data.unlocked[key] = true;
                }
            });
            if (!deferSave) App.save();
            App.reconcileDerivedProgressFlags?.();
        }

        if (action.type === 'ITEM') {
            const itemId = Number(action.id ?? action.value);
            const count = Math.max(1, Math.floor(Number(action.count) || 1));
            if (Number.isFinite(itemId)) {
                if (!App.data.items) App.data.items = {};
                App.data.items[itemId] = Number(App.data.items[itemId] || 0) + count;
                const item = (DB.ITEMS || []).find(i => Number(i.id) === itemId);
                App.log(`${item?.name || `アイテム${itemId}`}を手に入れた！`);
                if (!deferSave) App.save();
            }
        }

        if (action.type === 'CONSUME_ITEM') {
            const itemId = Number(action.id ?? action.value);
            const count = Math.max(1, Math.floor(Number(action.count) || 1));
            const owned = Number(App.data?.items?.[itemId] || 0);
            if (Number.isFinite(itemId) && owned >= count) {
                const remain = owned - count;
                if (remain > 0) App.data.items[itemId] = remain;
                else delete App.data.items[itemId];
                const item = (DB.ITEMS || []).find(i => Number(i.id) === itemId);
                if (action.silent !== true) App.log(`${item?.name || `アイテム${itemId}`}を渡した。`);
                if (!deferSave) App.save();
            }
        }
        
        if (action.type === 'EVENT' && !context.managed) await this.executeEvent(action.value, true);

        if (action.type === 'START_FIXED_DUNGEON') {
            if (!action.value) throw new Error('固定ダンジョンIDが指定されていません。');
            this.performMapTransfer('fixedDungeon', action.value, {
                entryKey: action.entryKey || null,
                floor: action.floor || null,
                nestedReturn: action.nestedReturn === true
            }, context);
            return 'BREAK_TRANSFER';
        }

        if (action.type === 'START_FIXED_MAP') {
            if (!action.value) throw new Error('固定MAP IDが指定されていません。');
            this.performMapTransfer('fixedMap', action.value, {
                entryKey: action.entryKey || null,
                targetX: action.targetX,
                targetY: action.targetY,
                replaceReturnPoint: action.replaceReturnPoint === true
            }, context);
            return 'BREAK_TRANSFER';
        }

        if (action.type === 'START_ABYSS_DUNGEON') {
            const mode = action.mode || 'story';
            const floor = Math.max(1, Number(action.floor || 1));
            this.performMapTransfer('abyss', 'ABYSS', {
                direct: action.direct === true,
                mode,
                floor
            }, context);
            return 'BREAK_TRANSFER';
        }

        if (!context.managed && (action.type === 'IF_FLAG' || action.type === 'IF')) {
            const key = action.key || action.flag || action.value;
            const expected = action.state !== undefined ? !!action.state : true;
            const actual = key ? !!(data.flags && data.flags[key]) : false;
            const branch = (actual === expected) ? action.then : (action.else || action.otherwise);
            if (Array.isArray(branch)) {
                for (const sub of branch) {
                    const res = await this.processAction(sub, eventId);
                    if (res === 'BREAK' || res === 'BREAK_TRANSFER') return res;
                }
            }
        }


        if (!context.managed && action.type === 'IF_ITEM') {
            const itemId = Number(action.id ?? action.itemId ?? action.value);
            const requiredCount = Math.max(1, Math.floor(Number(action.count) || 1));
            const ownedCount = Number(App.data?.items?.[itemId] || 0);
            const branch = ownedCount >= requiredCount ? action.then : (action.else || action.otherwise);
            if (Array.isArray(branch)) {
                for (const sub of branch) {
                    const res = await this.processAction(sub, eventId);
                    if (res === 'BREAK' || res === 'BREAK_TRANSFER') return res;
                }
            }
        }

        if (!context.managed && action.type === 'CHOICE') {
            const isYes = await this.showChoice(action.text);
            const branch = isYes ? action.yes : action.no;
            if (branch && branch.length > 0) {
                for (const sub of branch) {
                    const res = await this.processAction(sub, eventId);
                    if (res === 'BREAK' || res === 'BREAK_TRANSFER') return res;
                }
            }
        }
        
        if (action.type === 'MAP_CHANGE') {
            if (typeof MapRegistry !== 'undefined' && typeof MapRegistry.applyStoryMapMutation === 'function') {
                MapRegistry.applyStoryMapMutation(action.value || action.key, { save: !deferSave });
            }
        }

        if (action.type === 'BOSS') {
            const requestedBossId = action.value !== undefined ? action.value : null;
            const requestedIds = (Array.isArray(requestedBossId) ? requestedBossId : [requestedBossId])
                .map(id => Number(id))
                .filter(id => Number.isFinite(id));
            if (!requestedIds.length) throw new Error(`ボスIDが指定されていません: ${eventId || 'unknown'}`);

            let fixedBossId = requestedBossId;
            let abyssBossEncounter = null;
            if (App.data?.location?.area === 'ABYSS' && requestedIds.length === 1 &&
                typeof Dungeon !== 'undefined' && typeof Dungeon.getCurrentAbyssBossEncounter === 'function') {
                const currentEncounter = Dungeon.getCurrentAbyssBossEncounter();
                const encounterIds = (currentEncounter?.monsterIds || [])
                    .map(id => Number(id))
                    .filter(id => Number.isFinite(id));
                if (encounterIds.length > 1 && encounterIds.includes(requestedIds[0])) {
                    fixedBossId = encounterIds;
                    abyssBossEncounter = currentEncounter;
                }
            }

            const ids = (Array.isArray(fixedBossId) ? fixedBossId : [fixedBossId])
                .map(id => Number(id))
                .filter(id => Number.isFinite(id));
            const monsterApi = (typeof window !== 'undefined' ? window.MonsterData : globalThis.MonsterData);
            const missingIds = ids.filter(id => !monsterApi?.getMonsterById?.(id));
            if (missingIds.length) throw new Error(`ボスデータが見つかりません: ${missingIds.join(', ')}`);
            const isSpecialBoss = ids.some(id => {
                const base = monsterApi.getMonsterById(id);
                return base?.isSpecialBoss || base?.isEstark || id === 902000;
            });

            const progress = App.data.progress || (App.data.progress = {});
            const candidateContext = progress.activeFixedBossContext?.type === 'fixedBoss'
                ? progress.activeFixedBossContext
                : null;
            const currentAreaKey = (typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function')
                ? Field.getCurrentAreaKey()
                : App.data?.location?.area;
            const currentMapId = (typeof Field !== 'undefined' && Field.currentMapData)
                ? (Field.currentMapData.id || Field.currentMapData.key || Field.currentMapData.areaKey || currentAreaKey)
                : currentAreaKey;
            const inheritedChainId = context.activeEvent?.meta?.battleChainId || null;
            const eventMatches = candidateContext && (
                String(candidateContext.startEventId || '') === String(eventId || '') ||
                (inheritedChainId && String(candidateContext.battleChainId || '') === String(inheritedChainId))
            );
            const activeFixedBossContext = candidateContext &&
                String(candidateContext.areaKey || '') === String(currentAreaKey || '') &&
                String(candidateContext.mapId || candidateContext.areaKey || '') === String(currentMapId || currentAreaKey || '') &&
                eventMatches
                ? candidateContext
                : null;
            if (candidateContext && !activeFixedBossContext) delete progress.activeFixedBossContext;

            const actionFixedBossPosition = action.fixedBossPosition || action.position || null;
            const sourceFixedBossPosition = actionFixedBossPosition || activeFixedBossContext?.fixedBossPosition || null;
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
                color: keyRewardColors[0],
                x: fixedBossPosition?.x ?? ((typeof Field !== 'undefined') ? Field.x : null),
                y: fixedBossPosition?.y ?? ((typeof Field !== 'undefined') ? Field.y : null),
                scopeKey: (typeof Dungeon !== 'undefined' && typeof Dungeon.getKeyScopeKey === 'function')
                    ? Dungeon.getKeyScopeKey()
                    : null
            } : (contextKeyReward ? { ...contextKeyReward } : null);

            const battleChainId = action.battleChainId || activeFixedBossContext?.battleChainId || inheritedChainId ||
                `battle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
            App.data.battle = {
                active: false,
                isBossBattle: true,
                battleBg: action.battleBg || null,
                fixedBossId,
                abyssBossEncounter,
                fixedBossPosition,
                fixedBossProgressKey: action.fixedBossProgressKey || action.progressKey || activeFixedBossContext?.progressKey || null,
                fixedQuestId: action.fixedQuestId || activeFixedBossContext?.fixedQuestId || null,
                bossStatMultiplier: action.bossStatMultiplier || action.bossScale || activeFixedBossContext?.bossStatMultiplier || null,
                isSpecialBoss,
                isEstark: isSpecialBoss,
                suppressFixedBossDefeat: !!(action.suppressFixedBossDefeat || action.deferFixedBossDefeat || action.markFixedBossDefeated === false),
                eventId,
                fixedKeyReward: fixedKeyReward,
                isAmbushed: !!action.ambush,
                storyWinEventId: action.winEventId || null,
                storyLossEventId: action.lossEventId || null,
                battleChainId,
                battleChainPhase: Math.max(0, Number(action.battleChainPhase ?? activeFixedBossContext?.phase ?? 0)),
                fixedBossContextNonce: activeFixedBossContext?.nonce || null
            };
            if (!deferSave) App.save();
            this.isTyping = false;
            this.active = false;
            this.endConversation();
            const startBattleScene = () => App.changeScene('battle');
            if (typeof App.playEncounterTransition === 'function') {
                if (typeof App.lockFieldInput === 'function') App.lockFieldInput(1800);
                App.playEncounterTransition(startBattleScene, { eventBattle: true });
            } else {
                startBattleScene();
            }
            return 'BREAK_COMPLETE';
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
            // 選択肢はボタンを含むため、3行固定の会話ウィンドウとは分けて必要な高さまで広げる。
            if (choiceWindow) {
                choiceWindow.style.height = 'auto';
                choiceWindow.style.minHeight = '148px';
                choiceWindow.style.maxHeight = '300px';
                choiceWindow.style.overflowY = 'auto';
            }
			
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
     * ストーリー正本から呼び出す汎用エンドロール。
     */
    showCredits: async function(options = {}) {
        const existing = document.getElementById('story-credits-overlay');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'story-credits-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', options.title || 'エンドロール');
        overlay.style.cssText = [
            'position:fixed','inset:0','z-index:4200','background:radial-gradient(circle at 50% 35%, #22243d 0%, #080911 58%, #000 100%)',
            'color:#fff','display:flex','align-items:center','justify-content:center','overflow:hidden','font-family:serif'
        ].join(';');
        const roll = document.createElement('div');
        roll.style.cssText = 'width:min(88vw,720px);text-align:center;line-height:2.15;letter-spacing:.08em;transform:translateY(70vh);animation:storyCreditsRoll 16s linear forwards;';
        const title = document.createElement('h1');
        title.textContent = options.title || 'THE END';
        title.style.cssText = 'font-size:clamp(24px,5vw,46px);margin:0 0 10vh;color:#f1e7ba;text-shadow:0 0 18px rgba(255,255,255,.4);';
        roll.appendChild(title);
        (Array.isArray(options.lines) ? options.lines : []).forEach(line => {
            const p = document.createElement('p');
            p.textContent = String(line || '');
            p.style.cssText = 'margin:3.5vh 0;font-size:clamp(14px,2.8vw,22px);';
            roll.appendChild(p);
        });
        const end = document.createElement('p');
        end.textContent = '画面を押して戻る';
        end.style.cssText = 'margin:13vh 0 30vh;font-size:14px;opacity:.72;';
        roll.appendChild(end);
        overlay.appendChild(roll);
        if (!document.getElementById('story-credits-style')) {
            const style = document.createElement('style');
            style.id = 'story-credits-style';
            style.textContent = '@keyframes storyCreditsRoll{0%{transform:translateY(70vh)}100%{transform:translateY(-105%)}}';
            document.head.appendChild(style);
        }
        document.body.appendChild(overlay);
        if (typeof AudioManager !== 'undefined') AudioManager.stopBgm?.(600);
        await new Promise(resolve => {
            let closable = false;
            const timer = setTimeout(() => { closable = true; }, 1200);
            const finish = () => {
                if (!closable) return;
                clearTimeout(timer);
                overlay.removeEventListener('click', finish);
                overlay.remove();
                resolve();
            };
            overlay.addEventListener('click', finish);
            setTimeout(() => { closable = true; }, 16000);
        });
        if (typeof AudioManager !== 'undefined') AudioManager.syncForScene?.('field');
    },

    /**
     * 会話の表示
     */
    showConversation: async function(scriptKey, startFromIndex = 0) {
        const lines = this.scripts[scriptKey];
        if (!Array.isArray(lines)) {
            console.error(`[StoryManager] conversation not found: ${scriptKey}`);
            return { status: 'missing', scriptKey };
        }

        // 別会話の入力待ちを「完了」と誤認しない。呼出側はqueuedのまま再試行する。
        if (this.isTyping) return { status: 'busy', scriptKey };
        this.isTyping = true;
        let completed = false;
        let overlay = null;

        try {
            startFromIndex = Math.max(0, Math.floor(Number(startFromIndex) || 0));
            if (startFromIndex > 0 && this.scriptHasInlineFieldVisual(scriptKey)) {
                try {
                    await this.restoreInlineFieldVisualState(scriptKey, startFromIndex);
                } catch (e) {
                    console.warn('[StoryManager] inline field visual resume failed:', e);
                }
            }

            overlay = document.getElementById('story-ui-overlay') || this.createStoryDOM();
            if (!overlay) throw new Error('会話UIを生成できませんでした。');
            overlay.style.display = 'flex';

            const portraitImg = document.getElementById('story-portrait');
            const nameBox = document.getElementById('story-name');
            const textBox = document.getElementById('story-text');
            const nextIndicator = document.getElementById('story-next-indicator');
            if (!portraitImg || !nameBox || !textBox || !nextIndicator) {
                throw new Error('会話UIの必須要素が不足しています。');
            }
            const textWindow = textBox.parentElement;
            if (textWindow && !textWindow.dataset.defaultStyle) {
                textWindow.dataset.defaultStyle = textWindow.getAttribute('style') || '';
            }

            for (let i = startFromIndex; i < lines.length; i++) {
                const line = lines[i];

                if (App.data) {
                    App.data.progress.activeConversation = { key: scriptKey, index: i };
                    App.save();
                }

                if (this.isInlineStoryCommand(line)) {
                    await this.runInlineStoryCommand(line);
                    // 命令の副作用と次カーソルを同じ保存へ確定する。
                    if (App.data?.progress) {
                        App.data.progress.activeConversation = { key: scriptKey, index: i + 1 };
                        App.save();
                    }
                    continue;
                }
                if (!line || typeof line.text !== 'string') continue;
                if (typeof AudioManager !== 'undefined') AudioManager.playSe?.('dialogue');

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
                            padding: 12px 16px;
                            box-sizing: border-box;
                            height: 112px;
                            min-height: 112px;
                            max-height: 112px;
                            overflow: hidden;
                            box-shadow: none;
                            z-index: 10;
                        `;
                    } else if (textWindow.dataset.defaultStyle) {
                        textWindow.style.cssText = textWindow.dataset.defaultStyle;
                    }
                }
                nameBox.style.display = isSystemLine ? 'none' : 'block';

                const processedText = line.text.replace(/\[N:(\d+)\]/g, (match, id) => {
                    const targetId = parseInt(id);
                    const saved = App.data.characters.find(c => c.charId === targetId);
                    const master = DB.CHARACTERS.find(c => c.id === targetId);
                    return (saved ? saved.name : (master ? master.name : `ID:${id}`));
                }).replace(/\\n/g, '\n');

                this.backlog.push({ name: displayName, text: processedText.replace(/\n/g, ' ') });
                portraitImg.src = displayImg || '';
                portraitImg.style.display = displayImg ? 'block' : 'none';
                nameBox.innerText = displayName;
                nextIndicator.style.visibility = 'hidden';

                let isLineTyping = true;
                let skipTyping = false;
                overlay.onclick = (e) => {
                    if (!e.target.closest('.no-skip') && isLineTyping) skipTyping = true;
                };

                textBox.innerHTML = '';
                const chars = processedText.split('');
                for (let j = 0; j < chars.length; j++) {
                    if (skipTyping) {
                        textBox.innerHTML = processedText.replace(/\n/g, '<br>');
                        break;
                    }
                    const char = chars[j];
                    textBox.innerHTML += (char === '\n' ? '<br>' : char);
                    await new Promise(resolve => setTimeout(resolve, char === '\n' ? this.newlineWait : this.textSpeed));
                }
                isLineTyping = false;
                nextIndicator.style.visibility = 'visible';
                await new Promise(resolve => {
                    overlay.onclick = (e) => {
                        if (!e.target.closest('.no-skip')) resolve();
                    };
                });
                // 読了した行を再表示しないよう、次行カーソルを直ちに保存する。
                if (App.data?.progress) {
                    App.data.progress.activeConversation = { key: scriptKey, index: i + 1 };
                    App.save();
                }
            }

            completed = true;
            if (App.data?.progress) {
                delete App.data.progress.activeConversation;
                App.save();
            }
            return { status: 'completed', scriptKey };
        } catch (error) {
            console.error(`[StoryManager] conversation failed: ${scriptKey}`, error);
            // 会話DOMやインライン演出で例外が起きても、透明なオーバーレイや
            // 入力待ちを残さない。カーソルはfinallyで保持し、再読込後に再試行する。
            try { this.dismissChoiceUI({ hideOverlay: true }); } catch (_) {}
            try { this.clearStoryPortrait(); } catch (_) {}
            if (overlay) overlay.style.display = 'none';
            this.active = false;
            throw error;
        } finally {
            this.isTyping = false;
            if (overlay) overlay.onclick = null;
            // 失敗時はactiveConversationを残し、同じ行から再試行できるようにする。
            if (!completed && App.data?.progress?.activeConversation?.key !== scriptKey) {
                App.data.progress.activeConversation = { key: scriptKey, index: startFromIndex };
                try { App.save(); } catch (_) {}
            }
        }
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
					height: 148px;                /* 話者名 + 本文3行 + 送り表示を基準に固定 */
					min-height: 148px;            
					max-height: 148px;            
					overflow: hidden;             
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
						height: 4.8em;               /* 1.6em × 3行 */
						min-height: 4.8em;
						max-height: 4.8em;
						overflow-y: auto;
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
