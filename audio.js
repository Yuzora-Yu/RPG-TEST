/* audio.js - resumable BGM and category-volume SE runtime */
(function() {
    const clampVolume = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

    const AudioManager = {
        bgm: null,
        bgmKey: null,
        pendingBgmKey: null,
        positions: {},
        sePools: {},
        lastSeAt: {},
        unlocked: false,
        sceneId: null,

        getManifest: () => window.AUDIO_MANIFEST || { BGM: {}, SE: {}, AREA_BGM: {}, BASE_FLOOR_BGM: {} },
        getSettings: () => {
            if (typeof App !== 'undefined' && typeof App.ensureSettings === 'function') return App.ensureSettings();
            return {
                fieldBgmVolume: 30,
                battleBgmVolume: 30,
                uiSeVolume: 5,
                battleSeVolume: 5,
                fieldSeVolume: 5
            };
        },
        getBgmCategoryForKey: key => AudioManager.getManifest().BGM?.[key]?.group === 'battle' ? 'battle' : 'field',
        getSeCategoryForKey: key => {
            const group = String(AudioManager.getManifest().SE?.[key]?.group || 'ui');
            if (group === 'battle') return 'battle';
            if (group === 'field' || group === 'event') return 'field';
            return 'ui';
        },
        getBgmVolume: key => {
            const settings = AudioManager.getSettings();
            return AudioManager.getBgmCategoryForKey(key || AudioManager.bgmKey || AudioManager.pendingBgmKey) === 'battle'
                ? clampVolume(settings.battleBgmVolume ?? settings.bgmVolume ?? 30)
                : clampVolume(settings.fieldBgmVolume ?? settings.bgmVolume ?? 30);
        },
        getSeVolume: key => {
            const settings = AudioManager.getSettings();
            const category = AudioManager.getSeCategoryForKey(key);
            if (category === 'battle') return clampVolume(settings.battleSeVolume ?? settings.seVolume ?? 5);
            if (category === 'field') return clampVolume(settings.fieldSeVolume ?? settings.seVolume ?? 5);
            return clampVolume(settings.uiSeVolume ?? settings.seVolume ?? 5);
        },
        setBgmCategoryVolume: (category, value) => {
            const normalized = clampVolume(value);
            const settingKey = category === 'battle' ? 'battleBgmVolume' : 'fieldBgmVolume';
            if (typeof App !== 'undefined' && App.data) {
                const settings = App.ensureSettings ? App.ensureSettings() : (App.data.settings ||= {});
                settings[settingKey] = normalized;
                if (category === 'field') settings.bgmVolume = normalized;
                App.save?.();
            }
            const currentCategory = AudioManager.getBgmCategoryForKey(AudioManager.bgmKey || AudioManager.pendingBgmKey);
            if (currentCategory === category && AudioManager.bgm) {
                AudioManager.bgm.volume = normalized / 100;
                if (normalized <= 0) AudioManager.bgm.pause();
            }
            if (normalized > 0 && AudioManager.pendingBgmKey && AudioManager.getBgmCategoryForKey(AudioManager.pendingBgmKey) === category) {
                AudioManager.playBgm(AudioManager.pendingBgmKey, { resume: true });
            }
            return normalized;
        },
        setSeCategoryVolume: (category, value) => {
            const normalized = clampVolume(value);
            const settingKey = category === 'battle' ? 'battleSeVolume' : (category === 'field' ? 'fieldSeVolume' : 'uiSeVolume');
            if (typeof App !== 'undefined' && App.data) {
                const settings = App.ensureSettings ? App.ensureSettings() : (App.data.settings ||= {});
                settings[settingKey] = normalized;
                if (category === 'ui') settings.seVolume = normalized;
                App.save?.();
            }
            return normalized;
        },
        // Legacy setters keep older call sites and save data compatible.
        setBgmVolume: value => {
            const normalized = clampVolume(value);
            AudioManager.setBgmCategoryVolume('field', normalized);
            AudioManager.setBgmCategoryVolume('battle', normalized);
            return normalized;
        },
        setSeVolume: value => {
            const normalized = clampVolume(value);
            AudioManager.setSeCategoryVolume('ui', normalized);
            AudioManager.setSeCategoryVolume('battle', normalized);
            AudioManager.setSeCategoryVolume('field', normalized);
            return normalized;
        },
        unlock: () => {
            AudioManager.unlocked = true;
            if (AudioManager.pendingBgmKey) AudioManager.playBgm(AudioManager.pendingBgmKey, { resume: true });
        },
        saveCurrentPosition: () => {
            if (!AudioManager.bgm || !AudioManager.bgmKey) return;
            const current = Number(AudioManager.bgm.currentTime);
            if (Number.isFinite(current) && current >= 0) AudioManager.positions[AudioManager.bgmKey] = current;
        },
        stopBgm: ({ preservePosition = true } = {}) => {
            if (!AudioManager.bgm) return;
            if (preservePosition) AudioManager.saveCurrentPosition();
            AudioManager.bgm.pause();
            AudioManager.bgm.removeAttribute('src');
            AudioManager.bgm.load?.();
            AudioManager.bgm = null;
            AudioManager.bgmKey = null;
        },
        playBgm: (key, options = {}) => {
            const entry = AudioManager.getManifest().BGM?.[key];
            AudioManager.pendingBgmKey = key || null;
            if (!key || !entry || entry.enabled !== true || !entry.src) {
                if (AudioManager.bgmKey && AudioManager.bgmKey !== key) AudioManager.stopBgm({ preservePosition: true });
                return false;
            }
            const volume = AudioManager.getBgmVolume(key);
            if (!AudioManager.unlocked || typeof Audio === 'undefined') return false;
            if (volume <= 0) {
                if (AudioManager.bgmKey && AudioManager.bgmKey !== key) AudioManager.stopBgm({ preservePosition: true });
                else if (AudioManager.bgm) AudioManager.bgm.pause();
                return false;
            }
            if (AudioManager.bgm && AudioManager.bgmKey === key) {
                AudioManager.bgm.volume = volume / 100;
                if (AudioManager.bgm.paused) AudioManager.bgm.play().catch(() => {});
                return true;
            }

            AudioManager.saveCurrentPosition();
            if (AudioManager.bgm) AudioManager.bgm.pause();
            const track = new Audio(entry.src);
            track.preload = 'auto';
            track.loop = entry.loop !== false;
            track.volume = volume / 100;
            AudioManager.bgm = track;
            AudioManager.bgmKey = key;
            if (options.resume === false) AudioManager.positions[key] = 0;
            const resumeAt = options.resume === false ? 0 : Number(AudioManager.positions[key] || 0);
            const seekAndPlay = () => {
                if (AudioManager.bgm !== track) return;
                if (Number.isFinite(resumeAt) && resumeAt > 0) {
                    const duration = Number(track.duration);
                    track.currentTime = Number.isFinite(duration) && duration > 0 ? resumeAt % duration : resumeAt;
                }
                track.play().catch(() => {});
            };
            if (track.readyState >= 1) seekAndPlay();
            else track.addEventListener('loadedmetadata', seekAndPlay, { once: true });
            track.addEventListener('error', () => {
                console.warn(`[AudioManager] BGMを読み込めませんでした: ${entry.src}`);
                if (AudioManager.bgm === track) AudioManager.stopBgm({ preservePosition: false });
            }, { once: true });
            return true;
        },
        canPlaySe: (key, options = {}) => {
            const entry = AudioManager.getManifest().SE?.[key];
            if (!entry || entry.enabled !== true || !entry.src || !AudioManager.unlocked || typeof Audio === 'undefined') return null;
            const volume = AudioManager.getSeVolume(key);
            if (volume <= 0) return null;
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const cooldown = Math.max(0, Number(options.cooldownMs ?? entry.cooldownMs ?? 0));
            if (!options.ignoreCooldown && cooldown && now - Number(AudioManager.lastSeAt[key] || 0) < cooldown) return null;
            AudioManager.lastSeAt[key] = now;
            return { entry, volume };
        },
        playSe: (key, options = {}) => {
            const playable = AudioManager.canPlaySe(key, options);
            if (!playable) return false;
            const { entry, volume } = playable;
            const pool = AudioManager.sePools[key] || (AudioManager.sePools[key] = []);
            let sound = pool.find(candidate => candidate.paused || candidate.ended);
            if (!sound) {
                sound = new Audio(entry.src);
                sound.preload = 'auto';
                pool.push(sound);
                if (pool.length > 5) pool.shift();
            }
            try { sound.currentTime = 0; } catch (e) {}
            sound.volume = Math.max(0, Math.min(1, (volume / 100) * Number(options.volume ?? 1)));
            sound.play().catch(() => {});
            return true;
        },
        playSeAndWait: (key, options = {}) => {
            const playable = AudioManager.canPlaySe(key, { ...options, ignoreCooldown: options.ignoreCooldown !== false });
            if (!playable) return Promise.resolve(false);
            const { entry, volume } = playable;
            const sound = new Audio(entry.src);
            sound.preload = 'auto';
            sound.loop = false;
            sound.volume = Math.max(0, Math.min(1, (volume / 100) * Number(options.volume ?? 1)));
            return new Promise(resolve => {
                let done = false;
                const finish = result => {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    sound.removeEventListener('ended', onEnded);
                    sound.removeEventListener('error', onError);
                    resolve(result);
                };
                const onEnded = () => finish(true);
                const onError = () => finish(false);
                const timer = setTimeout(() => finish(false), Math.max(500, Number(options.maxWaitMs || 12000)));
                sound.addEventListener('ended', onEnded, { once: true });
                sound.addEventListener('error', onError, { once: true });
                sound.play().catch(() => finish(false));
            });
        },
        resolveAreaKey: () => {
            if (typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function') return Field.getCurrentAreaKey();
            return typeof App !== 'undefined' ? App.data?.location?.area : null;
        },
        resolveFieldBgmKey: () => {
            const manifest = AudioManager.getManifest();
            const onWorldMap = typeof Field === 'undefined' || !Field.currentMapData;
            const transportMode = typeof App !== 'undefined' ? App.data?.transportMode : null;
            if (onWorldMap && transportMode === 'flying') return 'field_wing';
            if (onWorldMap && transportMode === 'boat') return 'field_ship';

            const areaKey = AudioManager.resolveAreaKey();
            const currentMapFloor = (typeof Field !== 'undefined' && Field.currentMapData?.floor !== undefined)
                ? Field.currentMapData.floor
                : null;
            const floor = Number(currentMapFloor ?? (typeof App !== 'undefined' ? App.data?.progress?.floor : null) ?? (typeof Dungeon !== 'undefined' ? Dungeon.floor : null) ?? 1);
            if (floor === 1 && manifest.BASE_FLOOR_BGM?.[areaKey]) return manifest.BASE_FLOOR_BGM[areaKey];
            return manifest.AREA_BGM?.[areaKey] || 'field_world';
        },
        resolveBattleBgmKey: () => {
            const battle = (typeof App !== 'undefined' && App.data?.battle) || {};
            if (battle.battleBgmKey) return battle.battleBgmKey;
            const type = String(battle.battleBgmType || '').toLowerCase();
            if (type === 'secret') return 'battle_secretboss';
            if (type === 'final') return 'battle_finalboss';
            if (type === 'big') return 'battle_bigboss';
            if (type === 'mid') return 'battle_midboss';
            const eventId = String(battle.eventId || '').toLowerCase();
            const fixedId = Number(battle.fixedBossId || 0);
            if (battle.isEstark || battle.isSpecialBoss || [902000, 401200].includes(fixedId)) return 'battle_secretboss';
            if (eventId.includes('final') || eventId.includes('dark_castle_zenon') || fixedId === 1055) return 'battle_finalboss';
            if (battle.isBossBattle && (battle.isBigBoss || battle.bossTier === 'big')) return 'battle_bigboss';
            if (battle.isBossBattle) return 'battle_midboss';
            return 'battle_normal';
        },
        resolveSceneBgmKey: sceneId => {
            const facility = {
                inn: 'facility_inn', shop: 'facility_shop', alchemy: 'facility_alchemy',
                blacksmith: 'facility_blacksmith', casino: 'facility_casino', medal: 'facility_medal'
            };
            if (sceneId === 'battle') return AudioManager.resolveBattleBgmKey();
            if (sceneId === 'field') return AudioManager.resolveFieldBgmKey();
            return facility[sceneId] || AudioManager.bgmKey || AudioManager.resolveFieldBgmKey();
        },
        syncForScene: sceneId => {
            AudioManager.sceneId = sceneId;
            const key = AudioManager.resolveSceneBgmKey(sceneId);
            if (key) AudioManager.playBgm(key, { resume: true });
            return key;
        },
        syncFieldBgm: () => AudioManager.syncForScene('field')
    };

    const unlock = () => AudioManager.unlock();

    const installMenuSeHooks = () => {
        if (typeof document === 'undefined') return;

        const interactiveSelector = 'button, [role="button"], input[type="button"], input[type="submit"], .menu-btn, .cmd-btn';
        const excludedIds = new Set([
            'btn-up', 'btn-down', 'btn-left', 'btn-right',
            'btn-ok', 'field-minimap-hotspot', 'field-minimap-restore'
        ]);
        const silentLabels = new Set(['はい', 'いいえ']);
        const cancelLabels = new Set([
            'もどる', '戻る', '閉じる', 'とじる', 'キャンセル', 'cancel',
            'やめる', '出る', '外へ出る', '×', '✕', '❌'
        ]);
        const normalizeLabel = element => String(
            element?.getAttribute?.('aria-label') ||
            element?.getAttribute?.('title') ||
            element?.value ||
            element?.textContent || ''
        ).replace(/\s+/g, '').trim().toLowerCase();
        const isDisabled = element => Boolean(
            element?.disabled ||
            element?.getAttribute?.('aria-disabled') === 'true' ||
            element?.classList?.contains('disabled')
        );
        const classifyMenuSe = element => {
            const explicit = element?.dataset?.audioSe;
            if (explicit === 'none') return null;
            if (explicit === 'confirm' || explicit === 'menu_confirm') return 'menu_confirm';
            if (explicit === 'cancel' || explicit === 'menu_cancel') return 'menu_cancel';
            if (excludedIds.has(element?.id) || element?.classList?.contains('btn-d')) return null;

            const label = normalizeLabel(element);
            // はい／いいえ確認ダイアログは選択自体を静かにし、
            // 実行結果側の購入・鍛冶・戦闘などの専用SEだけを聞かせる。
            if (silentLabels.has(label)) return null;
            const handler = String(element?.getAttribute?.('onclick') || '').toLowerCase();
            const isCancelAction = cancelLabels.has(label) ||
                /(^|\W)(cancel|close)(\W|$)/.test(handler) ||
                handler.includes('closesubscreen') ||
                handler.includes('exittoworkspace') ||
                handler.includes('exitworkspace');
            return isCancelAction ? 'menu_cancel' : 'menu_confirm';
        };

        document.addEventListener('click', event => {
            if (event.isTrusted === false) return;
            const element = event.target?.closest?.(interactiveSelector);
            if (!element || isDisabled(element)) return;
            const key = classifyMenuSe(element);
            if (key) AudioManager.playSe(key);
        }, true);

        document.addEventListener('keydown', event => {
            if (event.isTrusted === false || event.repeat || event.defaultPrevented) return;
            if (event.key !== 'Escape') return;
            const active = document.activeElement;
            if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
            AudioManager.playSe('menu_cancel');
        }, true);
    };

    if (typeof document !== 'undefined') {
        ['pointerdown', 'keydown', 'touchstart'].forEach(type => document.addEventListener(type, unlock, { once: true, passive: true }));
        installMenuSeHooks();
    }
    window.AudioManager = AudioManager;
})();
