/* save_slots.js - オート1枠 + 手動9枠の保存管理と共通スロットUI */
(function(global) {
    'use strict';

    const DB_NAME = 'PRISMA_ABYSS_SAVE_SLOTS';
    const DB_VERSION = 1;
    const STORE_NAME = 'slots';
    const MANUAL_SLOT_MIN = 1;
    const MANUAL_SLOT_MAX = 9;
    const RECORD_SCHEMA_VERSION = 1;

    const AREA_FALLBACK_NAMES = Object.freeze({
        WORLD: '地上世界',
        ABYSS_WORLD: '深淵世界',
        START_VILLAGE: '始まりの村',
        FIRE_VILLAGE: '火の村',
        WIND_VILLAGE: '風の集落',
        WATER_CITY: '水上都市',
        THUNDER_FORT: '雷の要塞',
        LIGHT_PALACE: '光の宮殿',
        DARK_CASTLE: '魔王城',
        ABYSS: '深淵の魔窟',
        ABYSS_FIELD: '深淵世界',
        MEMORY_REALM: '夢幻回廊'
    });

    const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    let dbPromise = null;
    const getApp = () => (typeof App !== 'undefined' ? App : global.App);
    const getConst = () => (typeof CONST !== 'undefined' ? CONST : global.CONST);
    const getField = () => (typeof Field !== 'undefined' ? Field : global.Field);
    const getFixedMaps = () => (typeof FIXED_MAPS !== 'undefined' ? FIXED_MAPS : global.FIXED_MAPS);
    const getFixedDungeonMaps = () => (typeof FIXED_DUNGEON_MAPS !== 'undefined' ? FIXED_DUNGEON_MAPS : global.FIXED_DUNGEON_MAPS);
    const getStoryData = () => (typeof STORY_DATA !== 'undefined' ? STORY_DATA : global.STORY_DATA);
    const getWorldMaps = () => (typeof WORLD_MAPS !== 'undefined' ? WORLD_MAPS : global.WORLD_MAPS);
    const getLocalStorage = () => {
        try { return global.localStorage || null; } catch (error) { return null; }
    };

    const SaveSlots = {
        DB_NAME,
        STORE_NAME,
        RECORD_SCHEMA_VERSION,
        MANUAL_SLOT_MIN,
        MANUAL_SLOT_MAX,

        isIndexedDBSupported: () => typeof global.indexedDB !== 'undefined' && global.indexedDB !== null,

        normalizeManualSlotId: (slotId) => {
            const normalized = Math.floor(Number(slotId));
            if (!Number.isFinite(normalized) || normalized < MANUAL_SLOT_MIN || normalized > MANUAL_SLOT_MAX) {
                throw new Error('手動セーブ番号が不正です。');
            }
            return normalized;
        },

        openDatabase: () => {
            if (!SaveSlots.isIndexedDBSupported()) {
                return Promise.reject(new Error('この環境では手動セーブ領域を利用できません。'));
            }
            if (dbPromise) return dbPromise;

            dbPromise = new Promise((resolve, reject) => {
                let request;
                try {
                    request = global.indexedDB.open(DB_NAME, DB_VERSION);
                } catch (error) {
                    reject(error);
                    return;
                }

                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
                    }
                };
                request.onsuccess = () => {
                    const db = request.result;
                    db.onversionchange = () => db.close();
                    resolve(db);
                };
                request.onerror = () => reject(request.error || new Error('手動セーブ領域を開けませんでした。'));
                request.onblocked = () => reject(new Error('別画面が手動セーブ領域を使用中です。'));
            }).catch(error => {
                dbPromise = null;
                throw error;
            });

            return dbPromise;
        },

        requestResult: (request) => new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('保存領域の処理に失敗しました。'));
        }),

        transactionDone: (transaction) => new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error || new Error('保存処理に失敗しました。'));
            transaction.onabort = () => reject(transaction.error || new Error('保存処理が中断されました。'));
        }),

        formatSavedAt: (value) => {
            if (!value) return '日時不明';
            const date = new Date(value);
            if (!Number.isFinite(date.getTime())) return '日時不明';
            const pad = number => String(number).padStart(2, '0');
            return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        },

        formatPlayTime: (milliseconds) => {
            const maxSeconds = 9999 * 3600 + 59 * 60 + 59;
            const totalSeconds = Math.min(maxSeconds, Math.max(0, Math.floor(Number(milliseconds) || 0) / 1000));
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${String(hours).padStart(4, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        },

        getPartyCharacters: (data) => {
            if (!data || !Array.isArray(data.party) || !Array.isArray(data.characters)) return [];
            return data.party.slice(0, 4).map(uid => uid ? data.characters.find(character => character && character.uid === uid) || null : null);
        },

        getHero: (data) => SaveSlots.getPartyCharacters(data).find(Boolean)
            || (Array.isArray(data?.characters) ? data.characters.find(character => character?.isHero) || data.characters[0] : null)
            || null,

        getCharacterFaceSource: (character) => {
            if (!character) return '';
            if (character.imageEdit && typeof character.imageEdit.src === 'string' && character.imageEdit.src) return character.imageEdit.src;
            if (character.isMonsterAlly === true && typeof character.img === 'string' && character.img) return character.img;
            if (typeof character.img === 'string' && character.img) {
                if (character.customImage === true || character.hasCustomImage === true || /^data:image\//i.test(character.img)) return character.img;
            }
            const charId = Number(character.charId || character.id || 0);
            if (charId > 0) return `assets/characters/face/${charId}.png`;
            return typeof character.img === 'string' ? character.img : '';
        },

        getCharacterFaceFallback: (character) => {
            if (!character) return '';
            if (typeof character.img === 'string' && character.img && !/^data:image\//i.test(character.img)) return character.img;
            const charId = Number(character.charId || character.id || 0);
            return charId > 0 ? `assets/characters/char_face_${String(charId).padStart(3, '0')}.gif` : '';
        },

        deriveLocationLabel: (data) => {
            if (!data || typeof data !== 'object') return '不明な場所';
            const areaKey = String(data.location?.area || data.location?.areaKey || 'WORLD');
            const floor = Math.max(0, Math.floor(Number(data.progress?.floor || 0)));
            const app = getApp();
            const runtimeField = app?.data === data ? getField() : null;
            const runtimeMap = runtimeField?.currentMapData || null;

            let label = '';
            if (runtimeMap) {
                label = String(runtimeMap.displayName || runtimeMap.name || runtimeMap.baseName || '');
                if (runtimeMap.isDungeon && runtimeMap.hideFloorLabel !== true && floor > 0) {
                    if (runtimeMap.isFixed) {
                        const baseName = runtimeMap.baseName || runtimeMap.name || label;
                        const floorLabel = runtimeMap.floorLabel || `${floor}階`;
                        label = runtimeMap.displayName || `${baseName} ${floorLabel}`;
                    } else if (!new RegExp(`${floor}\\s*階`).test(label)) {
                        label = `${label} ${floor}階`;
                    }
                }
            }

            const fixedMaps = getFixedMaps();
            const fixedDungeonMaps = getFixedDungeonMaps();
            const storyData = getStoryData();
            const worldMaps = getWorldMaps();
            if (!label && fixedMaps?.[areaKey]) label = fixedMaps[areaKey].displayName || fixedMaps[areaKey].name || '';
            if (!label && fixedDungeonMaps?.[areaKey]) label = fixedDungeonMaps[areaKey].displayName || fixedDungeonMaps[areaKey].name || '';
            if (!label && storyData?.areas?.[areaKey]) label = storyData.areas[areaKey].displayName || storyData.areas[areaKey].name || '';
            if (!label && worldMaps?.[areaKey]) label = worldMaps[areaKey].displayName || worldMaps[areaKey].name || '';
            if (!label) label = AREA_FALLBACK_NAMES[areaKey] || data.system?.saveMetadata?.locationLabel || areaKey || '不明な場所';

            if (floor > 0 && !new RegExp(`${floor}\\s*階`).test(label)) {
                const inDungeon = !!data.dungeon?.map || areaKey === 'ABYSS' || fixedDungeonMaps?.[areaKey];
                if (inDungeon) label = `${label} ${floor}階`;
            }
            return label;
        },

        buildMetadata: (data, options = {}) => {
            const hero = SaveSlots.getHero(data);
            const updatedAt = options.updatedAt || data?.system?.lastSavedAt || null;
            const playTimeMs = Math.max(0, Math.floor(Number(data?.stats?.playTimeMs || 0)));
            const payloadBytes = Math.max(0, Math.floor(Number(options.payloadBytes || 0)));
            return {
                heroName: String(hero?.name || '冒険者'),
                heroLevel: Math.max(1, Math.floor(Number(hero?.level || 1))),
                playTimeMs,
                locationLabel: SaveSlots.deriveLocationLabel(data),
                storyStep: Math.max(0, Math.floor(Number(data?.progress?.storyStep || 0))),
                abyssMaxFloor: Math.max(0, Math.floor(Number(data?.dungeon?.maxFloor || 0))),
                updatedAt,
                payloadBytes
            };
        },

        parsePayload: (payload) => {
            if (typeof payload !== 'string' || !payload.trim()) throw new Error('セーブ内容が空です。');
            const data = JSON.parse(payload);
            const app = getApp();
            if (!app?.isImportableSaveData?.(data)) {
                const fallbackValid = data && typeof data === 'object' && Array.isArray(data.party) && Array.isArray(data.characters);
                if (!fallbackValid) throw new Error('セーブデータ形式が不正です。');
            }
            return data;
        },

        bytesOf: (text) => {
            if (typeof Blob !== 'undefined') return new Blob([String(text || '')]).size;
            if (textEncoder) return textEncoder.encode(String(text || '')).byteLength;
            return String(text || '').length;
        },

        fnv1a: (text) => {
            let hash = 0x811c9dc5;
            const value = String(text || '');
            for (let index = 0; index < value.length; index++) {
                hash ^= value.charCodeAt(index);
                hash = Math.imul(hash, 0x01000193) >>> 0;
            }
            return hash.toString(16).padStart(8, '0');
        },

        computeChecksum: async (payload) => {
            const value = String(payload || '');
            if (global.crypto?.subtle && textEncoder) {
                try {
                    const digest = await global.crypto.subtle.digest('SHA-256', textEncoder.encode(value));
                    const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
                    return `sha256:${hex}`;
                } catch (error) {
                    console.warn('[SAVE SLOTS] SHA-256を利用できないため簡易検査へ切り替えます。', error);
                }
            }
            return `fnv1a:${SaveSlots.fnv1a(value)}`;
        },

        verifyChecksum: async (payload, checksum) => {
            if (!checksum) return false;
            const value = String(checksum);
            if (value.startsWith('fnv1a:')) return value === `fnv1a:${SaveSlots.fnv1a(payload)}`;
            if (value.startsWith('sha256:')) {
                if (!global.crypto?.subtle || !textEncoder) throw new Error('この環境ではセーブデータの完全性を確認できません。');
                const actual = await SaveSlots.computeChecksum(payload);
                return actual === value;
            }
            return false;
        },

        getManualSlot: async (slotId) => {
            const normalized = SaveSlots.normalizeManualSlotId(slotId);
            const db = await SaveSlots.openDatabase();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const done = SaveSlots.transactionDone(tx);
            const record = await SaveSlots.requestResult(tx.objectStore(STORE_NAME).get(normalized));
            await done;
            return record || null;
        },

        listManualSlots: async () => {
            const slots = new Map();
            if (!SaveSlots.isIndexedDBSupported()) return slots;
            const db = await SaveSlots.openDatabase();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const done = SaveSlots.transactionDone(tx);
            const store = tx.objectStore(STORE_NAME);
            const records = typeof store.getAll === 'function'
                ? await SaveSlots.requestResult(store.getAll())
                : await new Promise((resolve, reject) => {
                    const values = [];
                    const request = store.openCursor();
                    request.onsuccess = () => {
                        const cursor = request.result;
                        if (!cursor) { resolve(values); return; }
                        values.push(cursor.value);
                        cursor.continue();
                    };
                    request.onerror = () => reject(request.error || new Error('手動セーブ一覧を取得できませんでした。'));
                });
            await done;
            (records || []).forEach(record => {
                const id = Number(record?.slotId);
                if (id >= MANUAL_SLOT_MIN && id <= MANUAL_SLOT_MAX) slots.set(id, record);
            });
            return slots;
        },

        saveManualSlot: async (slotId, data) => {
            const normalized = SaveSlots.normalizeManualSlotId(slotId);
            if (!data || typeof data !== 'object') throw new Error('保存するゲームデータがありません。');

            const app = getApp();
            if (app?.commitPlayTime) app.commitPlayTime({ keepRunning: true });
            const payload = app?.serializeSaveData ? app.serializeSaveData(data) : JSON.stringify(data);
            SaveSlots.parsePayload(payload);
            const updatedAt = new Date().toISOString();
            const checksum = await SaveSlots.computeChecksum(payload);
            const record = {
                slotId: normalized,
                schemaVersion: RECORD_SCHEMA_VERSION,
                updatedAt,
                metadata: SaveSlots.buildMetadata(data, {
                    updatedAt,
                    payloadBytes: SaveSlots.bytesOf(payload)
                }),
                payload,
                checksum
            };

            const previousRecord = await SaveSlots.getManualSlot(normalized);
            const db = await SaveSlots.openDatabase();
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const done = SaveSlots.transactionDone(tx);
                tx.objectStore(STORE_NAME).put(record);
                await done;

                const verified = await SaveSlots.getManualSlot(normalized);
                if (!verified || verified.checksum !== checksum || !(await SaveSlots.verifyChecksum(verified.payload, verified.checksum))) {
                    throw new Error('手動セーブの保存確認に失敗しました。');
                }
                return verified;
            } catch (error) {
                try {
                    const rollbackTx = db.transaction(STORE_NAME, 'readwrite');
                    const rollbackDone = SaveSlots.transactionDone(rollbackTx);
                    const store = rollbackTx.objectStore(STORE_NAME);
                    if (previousRecord) store.put(previousRecord);
                    else store.delete(normalized);
                    await rollbackDone;
                } catch (rollbackError) {
                    console.error('[SAVE SLOTS] 手動セーブの退避復元にも失敗しました。', rollbackError);
                }
                throw error;
            }
        },

        deleteManualSlot: async (slotId) => {
            const normalized = SaveSlots.normalizeManualSlotId(slotId);
            const db = await SaveSlots.openDatabase();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const done = SaveSlots.transactionDone(tx);
            tx.objectStore(STORE_NAME).delete(normalized);
            await done;
            return true;
        },

        getAutoSlot: () => {
            try {
                const saveKey = getConst()?.SAVE_KEY;
                const storage = getLocalStorage();
                if (!saveKey || !storage) return null;
                const payload = storage.getItem(saveKey);
                if (!payload) return null;
                const data = SaveSlots.parsePayload(payload);
                const updatedAt = data.system?.lastSavedAt || data.system?.saveMetadata?.updatedAt || null;
                return {
                    slotId: 'auto',
                    schemaVersion: RECORD_SCHEMA_VERSION,
                    updatedAt,
                    metadata: {
                        ...SaveSlots.buildMetadata(data, { updatedAt, payloadBytes: SaveSlots.bytesOf(payload) }),
                        ...(data.system?.saveMetadata || {}),
                        updatedAt
                    },
                    payload,
                    data,
                    checksum: null
                };
            } catch (error) {
                console.error('[SAVE SLOTS] オートセーブを読み込めませんでした。', error);
                return { slotId: 'auto', corrupt: true, error };
            }
        },

        getSlotData: async (slotId) => {
            if (slotId === 'auto') {
                const auto = SaveSlots.getAutoSlot();
                if (!auto || auto.corrupt) return null;
                return auto;
            }
            const record = await SaveSlots.getManualSlot(slotId);
            if (!record) return null;
            if (!(await SaveSlots.verifyChecksum(record.payload, record.checksum))) {
                throw new Error(`セーブNo.${slotId}の内容が破損しています。`);
            }
            return { ...record, data: SaveSlots.parsePayload(record.payload) };
        },

        inspectManualRecord: async (record) => {
            if (!record) return null;
            try {
                if (!(await SaveSlots.verifyChecksum(record.payload, record.checksum))) {
                    throw new Error('完全性検査に失敗しました。');
                }
                return { ...record, data: SaveSlots.parsePayload(record.payload) };
            } catch (error) {
                return { ...record, data: null, corrupt: true, error };
            }
        },

        listAllSlots: async () => {
            let manualAvailable = SaveSlots.isIndexedDBSupported();
            const manual = manualAvailable
                ? await SaveSlots.listManualSlots().catch(error => {
                    manualAvailable = false;
                    console.warn('[SAVE SLOTS] 手動セーブ一覧を取得できませんでした。', error);
                    return new Map();
                })
                : new Map();
            const manualEntries = await Promise.all(
                Array.from({ length: MANUAL_SLOT_MAX - MANUAL_SLOT_MIN + 1 }, (_, index) => {
                    const slotId = MANUAL_SLOT_MIN + index;
                    const record = manual.get(slotId);
                    return record
                        ? SaveSlots.inspectManualRecord(record)
                        : Promise.resolve({ slotId, empty: true, unavailable: !manualAvailable });
                })
            );
            return [SaveSlots.getAutoSlot(), ...manualEntries];
        },

        prepareDataForAutoWrite: (rawData) => {
            const cloned = JSON.parse(JSON.stringify(rawData));
            const app = getApp();
            const migrated = app?.migrateImportedSaveData
                ? app.migrateImportedSaveData(cloned)
                : cloned;
            if (!migrated.system || typeof migrated.system !== 'object' || Array.isArray(migrated.system)) migrated.system = {};
            const updatedAt = new Date().toISOString();
            migrated.system.lastSavedAt = updatedAt;
            migrated.system.saveMetadata = SaveSlots.buildMetadata(migrated, { updatedAt });
            return migrated;
        },

        writeDataToAutoSlot: (rawData) => {
            const saveKey = getConst()?.SAVE_KEY;
            const storage = getLocalStorage();
            if (!saveKey || !storage) throw new Error('オートセーブ領域を利用できません。');
            let previousPayload = null;
            let previousRead = false;
            try {
                previousPayload = storage.getItem(saveKey);
                previousRead = true;
                const data = SaveSlots.prepareDataForAutoWrite(rawData);
                const app = getApp();
                const payload = app?.serializeSaveData ? app.serializeSaveData(data) : JSON.stringify(data);
                storage.setItem(saveKey, payload);
                const written = storage.getItem(saveKey);
                if (written !== payload) throw new Error('オートセーブの書込確認に失敗しました。');
                SaveSlots.parsePayload(written);
                return { data, payload, previousPayload };
            } catch (error) {
                if (previousRead) {
                    try {
                        if (previousPayload === null) storage.removeItem(saveKey);
                        else storage.setItem(saveKey, previousPayload);
                    } catch (restoreError) {
                        console.error('[SAVE SLOTS] オートセーブの退避復元にも失敗しました。', restoreError);
                    }
                }
                throw error;
            }
        },

        loadManualIntoAuto: async (slotId) => {
            const record = await SaveSlots.getSlotData(slotId);
            if (!record || record.empty || record.corrupt) throw new Error(`セーブNo.${slotId}に有効なデータがありません。`);
            return SaveSlots.writeDataToAutoSlot(record.data);
        },

        hasAnyManualSlot: async () => {
            try {
                const slots = await SaveSlots.listManualSlots();
                const inspected = await Promise.all(Array.from(slots.values(), record => SaveSlots.inspectManualRecord(record)));
                return inspected.some(record => record && !record.corrupt);
            } catch (error) {
                return false;
            }
        }
    };

    const SaveSlotUI = {
        mode: null,
        context: null,
        busy: false,
        overlay: null,

        escapeHtml: (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;'),

        showMessage: (message, callback) => {
            const app = getApp();
            if (app?.showMessage) app.showMessage(message, callback);
            else if (typeof global.showPageMessage === 'function') global.showPageMessage(message, callback);
            else { global.alert?.(message); callback?.(); }
        },

        showConfirm: async (message) => {
            const app = getApp();
            if (app?.showConfirm) return app.showConfirm(message);
            if (typeof global.showPageConfirm === 'function') {
                return new Promise(resolve => global.showPageConfirm(message, () => resolve(true), () => resolve(false)));
            }
            return !!global.confirm?.(message);
        },

        close: () => {
            if (SaveSlotUI.overlay) SaveSlotUI.overlay.remove();
            SaveSlotUI.overlay = null;
            SaveSlotUI.mode = null;
            SaveSlotUI.context = null;
            SaveSlotUI.busy = false;
        },

        open: async (mode = 'load', options = {}) => {
            SaveSlotUI.close();
            SaveSlotUI.mode = mode === 'save' ? 'save' : 'load';
            SaveSlotUI.context = options.context || (document.getElementById('game-container') ? 'game' : 'title');

            const host = SaveSlotUI.context === 'game'
                ? (document.getElementById('game-container') || document.body)
                : document.body;
            const overlay = document.createElement('div');
            overlay.id = 'save-slot-overlay';
            overlay.className = `save-slot-overlay ${SaveSlotUI.context === 'game' ? 'is-game' : 'is-title'}`;
            overlay.innerHTML = `
                <div class="save-slot-dialog" role="dialog" aria-modal="true" aria-labelledby="save-slot-title">
                    <div class="save-slot-header">
                        <div>
                            <div id="save-slot-title" class="save-slot-title">${SaveSlotUI.mode === 'save' ? 'セーブ' : 'ロード'}</div>
                            <div class="save-slot-subtitle">オートセーブ 1枠 / 手動セーブ 9枠</div>
                        </div>
                        <button type="button" class="btn save-slot-close" onclick="SaveSlotUI.close()">もどる</button>
                    </div>
                    <div id="save-slot-notice" class="save-slot-notice"></div>
                    <div id="save-slot-list" class="save-slot-list" aria-live="polite"></div>
                    <div class="save-slot-footer">
                        <button type="button" class="btn sub-screen-back-btn" onclick="SaveSlotUI.close()">もどる</button>
                    </div>
                </div>`;
            host.appendChild(overlay);
            SaveSlotUI.overlay = overlay;
            overlay.addEventListener('click', event => {
                if (event.target === overlay && !SaveSlotUI.busy) SaveSlotUI.close();
            });
            await SaveSlotUI.render();
        },

        getSlotLabel: (slotId) => slotId === 'auto' ? 'オート' : String(slotId),

        render: async () => {
            const list = document.getElementById('save-slot-list');
            const notice = document.getElementById('save-slot-notice');
            if (!list || !notice) return;

            list.innerHTML = '<div class="save-slot-loading">セーブデータを確認しています……</div>';
            notice.textContent = SaveSlotUI.mode === 'save'
                ? 'オートセーブは既存機能で自動更新されます。手動セーブはNo.1～9から選択してください。'
                : '手動セーブを読み込むと、現在のオートセーブは選択した内容で即時上書きされます。手動セーブ自体は残ります。';

            let slots;
            try {
                slots = await SaveSlots.listAllSlots();
            } catch (error) {
                console.error(error);
                slots = [SaveSlots.getAutoSlot()];
                for (let slotId = MANUAL_SLOT_MIN; slotId <= MANUAL_SLOT_MAX; slotId++) slots.push({ slotId, empty: true, unavailable: true });
                notice.textContent = '手動セーブ領域を利用できません。オートセーブと既存のデータ出力・読込は利用できます。';
            }

            if (slots.some(slot => slot?.unavailable === true)) {
                notice.textContent = 'この環境では手動セーブ領域を利用できません。オートセーブと既存のデータ出力・読込は利用できます。';
            }

            list.innerHTML = '';
            for (const slot of slots) list.appendChild(SaveSlotUI.createSlotCard(slot));
        },

        createSlotCard: (slot) => {
            const slotId = slot?.slotId;
            const isAuto = slotId === 'auto';
            const empty = !slot || slot.empty === true || (!slot.payload && !slot.corrupt);
            const corrupt = slot?.corrupt === true;
            const disabled = SaveSlotUI.busy
                || corrupt
                || (SaveSlotUI.mode === 'save' && isAuto)
                || (SaveSlotUI.mode === 'load' && empty)
                || slot?.unavailable === true;

            let data = slot?.data || null;
            if (!data && slot?.payload && !corrupt) {
                try { data = SaveSlots.parsePayload(slot.payload); } catch (error) { data = null; }
            }
            const metadata = {
                ...(data ? SaveSlots.buildMetadata(data, { updatedAt: slot?.updatedAt, payloadBytes: SaveSlots.bytesOf(slot.payload || '') }) : {}),
                ...(slot?.metadata || {})
            };
            const dateLabel = corrupt ? '破損データ' : empty ? '空きスロット' : SaveSlots.formatSavedAt(slot.updatedAt || metadata.updatedAt);
            const heroLabel = empty ? '―' : `${metadata.heroName || '冒険者'}  Lv.${Math.max(1, Number(metadata.heroLevel || 1))}`;
            const locationLabel = empty ? '―' : String(metadata.locationLabel || '不明な場所');
            const playTimeLabel = empty ? '----:--:--' : SaveSlots.formatPlayTime(metadata.playTimeMs || 0);

            const button = document.createElement('button');
            button.type = 'button';
            button.className = `save-slot-card${empty ? ' is-empty' : ''}${isAuto ? ' is-auto' : ''}${corrupt ? ' is-corrupt' : ''}`;
            button.disabled = disabled;
            button.setAttribute('aria-label', `${SaveSlotUI.getSlotLabel(slotId)} ${dateLabel} ${heroLabel} ${locationLabel} ${playTimeLabel}`);
            button.onclick = () => SaveSlotUI.selectSlot(slotId, slot);

            const info = document.createElement('span');
            info.className = 'save-slot-info';
            info.innerHTML = `
                <span class="save-slot-line save-slot-line-primary">
                    <span class="save-slot-number">${isAuto ? 'オート' : `No.${slotId}`}</span>
                    <span class="save-slot-date">${SaveSlotUI.escapeHtml(dateLabel)}</span>
                </span>
                <span class="save-slot-line save-slot-line-hero">${SaveSlotUI.escapeHtml(heroLabel)}</span>
                <span class="save-slot-line save-slot-line-location">
                    <span class="save-slot-area" title="${SaveSlotUI.escapeHtml(locationLabel)}">${SaveSlotUI.escapeHtml(locationLabel)}</span>
                    <span class="save-slot-playtime">${playTimeLabel}</span>
                </span>`;
            button.appendChild(info);

            const faces = document.createElement('span');
            faces.className = 'save-slot-party-faces';
            const party = data ? SaveSlots.getPartyCharacters(data) : [null, null, null, null];
            for (let index = 0; index < 4; index++) {
                const face = document.createElement('span');
                face.className = 'save-slot-face';
                const character = party[index] || null;
                const source = SaveSlots.getCharacterFaceSource(character);
                if (source) {
                    const image = document.createElement('img');
                    image.alt = character?.name || `パーティ${index + 1}`;
                    image.src = source;
                    const fallback = SaveSlots.getCharacterFaceFallback(character);
                    image.onerror = () => {
                        if (fallback && image.src !== fallback) {
                            image.onerror = () => { image.style.display = 'none'; face.classList.add('is-empty'); };
                            image.src = fallback;
                        } else {
                            image.style.display = 'none';
                            face.classList.add('is-empty');
                        }
                    };
                    face.appendChild(image);
                } else {
                    face.classList.add('is-empty');
                }
                faces.appendChild(face);
            }
            button.appendChild(faces);
            return button;
        },

        selectSlot: async (slotId, slot) => {
            if (SaveSlotUI.busy) return;
            if (SaveSlotUI.mode === 'save') {
                if (slotId === 'auto') return;
                const exists = slot && !slot.empty && !!slot.payload;
                const confirmed = await SaveSlotUI.showConfirm(exists
                    ? `セーブNo.${slotId}へ上書きしますか？`
                    : `セーブNo.${slotId}へ保存しますか？`);
                if (!confirmed) return;

                SaveSlotUI.busy = true;
                try {
                    const app = getApp();
                    if (!app?.data || !app?.save?.()) throw new Error('オートセーブを更新できなかったため、手動保存を中止しました。');
                    await SaveSlots.saveManualSlot(slotId, app.data);
                    SaveSlotUI.showMessage(`セーブNo.${slotId}へ保存しました。`);
                } catch (error) {
                    console.error(error);
                    SaveSlotUI.showMessage(error?.message || '手動セーブに失敗しました。');
                } finally {
                    SaveSlotUI.busy = false;
                    await SaveSlotUI.render();
                }
                return;
            }

            if (slotId === 'auto') {
                const confirmed = SaveSlotUI.context === 'game'
                    ? await SaveSlotUI.showConfirm('現在のオートセーブから再開しますか？')
                    : true;
                if (!confirmed) return;
                global.location.href = 'index.html';
                return;
            }

            const confirmed = await SaveSlotUI.showConfirm(
                `セーブNo.${slotId}を読み込むと、現在のオートセーブは即時上書きされます。\n` +
                `セーブNo.${slotId}の内容は残ります。\n\n読み込んで再開しますか？`
            );
            if (!confirmed) return;

            SaveSlotUI.busy = true;
            try {
                await SaveSlots.loadManualIntoAuto(slotId);
                global.location.href = 'index.html';
            } catch (error) {
                console.error(error);
                SaveSlotUI.busy = false;
                SaveSlotUI.showMessage(error?.message || 'セーブデータを読み込めませんでした。');
                await SaveSlotUI.render();
            }
        }
    };

    global.SaveSlots = SaveSlots;
    global.SaveSlotUI = SaveSlotUI;
})(globalThis);
