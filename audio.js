/* audio.js - resumable BGM and pooled SE runtime */
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
            return { bgmVolume: 30, seVolume: 5 };
        },
        getBgmVolume: () => clampVolume(AudioManager.getSettings().bgmVolume ?? 30),
        getSeVolume: () => clampVolume(AudioManager.getSettings().seVolume ?? 5),
        setBgmVolume: value => {
            const normalized = clampVolume(value);
            if (typeof App !== 'undefined' && App.data) {
                const settings = App.ensureSettings ? App.ensureSettings() : (App.data.settings ||= {});
                settings.bgmVolume = normalized;
                App.save?.();
            }
            if (AudioManager.bgm) AudioManager.bgm.volume = normalized / 100;
            if (normalized > 0 && AudioManager.pendingBgmKey) AudioManager.playBgm(AudioManager.pendingBgmKey, { resume: true });
            return normalized;
        },
        setSeVolume: value => {
            const normalized = clampVolume(value);
            if (typeof App !== 'undefined' && App.data) {
                const settings = App.ensureSettings ? App.ensureSettings() : (App.data.settings ||= {});
                settings.seVolume = normalized;
                App.save?.();
            }
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
            if (!AudioManager.unlocked || AudioManager.getBgmVolume() <= 0 || typeof Audio === 'undefined') return false;
            if (AudioManager.bgm && AudioManager.bgmKey === key) {
                AudioManager.bgm.volume = AudioManager.getBgmVolume() / 100;
                if (AudioManager.bgm.paused) AudioManager.bgm.play().catch(() => {});
                return true;
            }

            AudioManager.saveCurrentPosition();
            if (AudioManager.bgm) AudioManager.bgm.pause();
            const track = new Audio(entry.src);
            track.preload = 'auto';
            track.loop = entry.loop !== false;
            track.volume = AudioManager.getBgmVolume() / 100;
            AudioManager.bgm = track;
            AudioManager.bgmKey = key;
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
        playSe: (key, options = {}) => {
            const entry = AudioManager.getManifest().SE?.[key];
            if (!entry || entry.enabled !== true || !entry.src || !AudioManager.unlocked || typeof Audio === 'undefined') return false;
            const volume = AudioManager.getSeVolume();
            if (volume <= 0) return false;
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const cooldown = Math.max(0, Number(options.cooldownMs ?? entry.cooldownMs ?? 0));
            if (cooldown && now - Number(AudioManager.lastSeAt[key] || 0) < cooldown) return false;
            AudioManager.lastSeAt[key] = now;

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
        resolveAreaKey: () => {
            if (typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function') return Field.getCurrentAreaKey();
            return typeof App !== 'undefined' ? App.data?.location?.area : null;
        },
        resolveFieldBgmKey: () => {
            const manifest = AudioManager.getManifest();
            const areaKey = AudioManager.resolveAreaKey();
            const currentMapFloor = (typeof Field !== 'undefined' && Field.currentMapData?.floor !== undefined)
                ? Field.currentMapData.floor
                : null;
            const floor = Number(currentMapFloor ?? (typeof App !== 'undefined' ? App.data?.progress?.floor : null) ?? (typeof Dungeon !== 'undefined' ? Dungeon.floor : null) ?? 1);
            if (floor === 1 && manifest.BASE_FLOOR_BGM?.[areaKey]) return manifest.BASE_FLOOR_BGM[areaKey];
            return manifest.AREA_BGM?.[areaKey] || (areaKey ? 'field_world' : 'field_world');
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
            if (battle.isEstark || battle.isSpecialBoss || [902000, 401100, 401200].includes(fixedId)) return 'battle_secretboss';
            if (eventId.includes('final') || eventId.includes('dark_castle_zenon') || fixedId === 100099) return 'battle_finalboss';
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
        const cancelLabels = new Set([
            'もどる', '戻る', '閉じる', 'とじる', 'キャンセル', 'cancel',
            'やめる', 'いいえ', '出る', '外へ出る', '×', '✕', '❌'
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
