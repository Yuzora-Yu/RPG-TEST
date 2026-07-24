/* maps_logic.js - generated split from original map.js. Keep editor output out of this file. */

const normalizeCoordinateActorTiles = (mapDefs) => {
    Object.values(mapDefs || {}).forEach(mapDef => {
        const targets = Array.isArray(mapDef.floors) ? mapDef.floors : [mapDef];
        targets.forEach(target => {
            if (!Array.isArray(target?.tiles) || !Array.isArray(target?.mapActions)) return;
            const rows = target.tiles.map(row => String(row).split(""));
            target.mapActions.forEach(action => {
                if (!action?.imageKey) return;
                const x = Number(action.x);
                const y = Number(action.y);
                if (!Number.isInteger(x) || !Number.isInteger(y) || !rows[y]?.[x]) return;
                rows[y][x] = action.baseTile || (rows[y][x] === "G" ? "G" : "T");
            });
            target.tiles = rows.map(row => row.join(""));
        });
    });
};

// 住人やクエスト人物はmapActionsの座標・画像を正本とし、地形文字へNPC記号を残さない。
normalizeCoordinateActorTiles(FIXED_MAPS);
normalizeCoordinateActorTiles(FIXED_DUNGEON_MAPS);

const MapRegistry = {
    normalizeWorldPoint(x, y) {
        const width = (typeof MAP_DATA !== "undefined" && MAP_DATA[0]) ? MAP_DATA[0].length : 1;
        const height = (typeof MAP_DATA !== "undefined" && MAP_DATA.length) ? MAP_DATA.length : 1;
        return {
            x: ((Number(x) % width) + width) % width,
            y: ((Number(y) % height) + height) % height
        };
    },

    getWorldBridgeAt(x, y) {
        if (typeof WORLD_BRIDGES === "undefined") return null;
        const point = MapRegistry.normalizeWorldPoint(x, y);
        return WORLD_BRIDGES.find(bridge => Number(bridge.x) === point.x && Number(bridge.y) === point.y) || null;
    },

    isWorldBridgeAt(x, y) {
        return !!MapRegistry.getWorldBridgeAt(x, y);
    },

    // ワールド地形の意味を、移動・描画・エンカウントで共有する。
    // 橋の基礎タイルは W だが、ゲーム上は海ではなく陸上として扱う。
    getWorldSurfaceAt(x, y) {
        const point = MapRegistry.normalizeWorldPoint(x, y);
        const tile = String((typeof MAP_DATA !== "undefined" ? MAP_DATA[point.y]?.[point.x] : '') || '').toUpperCase();
        const bridge = MapRegistry.getWorldBridgeAt(point.x, point.y);
        return {
            x: point.x,
            y: point.y,
            tile,
            bridge,
            isBridge: !!bridge,
            isSea: tile === 'W' && !bridge
        };
    },

    applyStoryMapMutation(mutationKey) {
        const mutation = STORY_MAP_MUTATIONS[mutationKey];
        if (!mutation || typeof App === "undefined" || !App.data?.progress) return false;
        if (!App.data.progress.mapChanges) App.data.progress.mapChanges = {};
        if (!App.data.progress.mapChanges[mutation.area]) App.data.progress.mapChanges[mutation.area] = {};
        mutation.changes.forEach(change => {
            App.data.progress.mapChanges[mutation.area][`${change.x},${change.y}`] = change.tile;
        });
        if (typeof App.save === "function") App.save();
        if (typeof Field !== "undefined" && Field.ready) Field.render();
        return true;
    },

    getFixedDungeonBase(areaKey) {
        return (typeof FIXED_DUNGEON_MAPS !== "undefined") ? FIXED_DUNGEON_MAPS[areaKey] : null;
    },

    getFixedDungeonFloor(areaKey, floorNo = 1) {
        const base = MapRegistry.getFixedDungeonBase(areaKey);
        if (!base) return null;
        const floor = Math.max(1, Number(floorNo || 1));

        if (!Array.isArray(base.floors) || base.floors.length === 0) {
            const floorLabel = base.floorLabel || "";
            return {
                ...base,
                areaKey,
                baseName: base.name,
                name: base.name,
                displayName: floorLabel ? `${base.name} ${floorLabel}` : base.name,
                floor: 1,
                floorLabel,
                themeKey: base.themeKey || areaKey,
                tileOverrides: { ...(base.tileOverrides || {}) },
            encounterRank: base.encounterRank || base.rank || 1,
            rareMonsters: Array.isArray(base.rareMonsters) ? base.rareMonsters : undefined,
            enemyBoost: base.enemyBoost,
            isDungeon: true,
            isFixed: true
            };
        }

        const index = Math.min(base.floors.length - 1, floor - 1);
        const def = base.floors[index];
        const floorLabel = def.label || `${index + 1}階`;
        return {
            ...base,
            ...def,
            areaKey,
            baseName: base.name,
            name: base.name,
            displayName: `${base.name} ${floorLabel}`,
            floor: index + 1,
            floorLabel,
            totalFloors: base.floors.length,
            themeKey: def.themeKey || base.themeKey || areaKey,
            tileOverrides: { ...(base.tileOverrides || {}), ...(def.tileOverrides || {}) },
            encounterRank: def.encounterRank || base.encounterRank || base.rank || 1,
            monsters: Array.isArray(def.monsters) ? def.monsters : base.monsters,
            rareMonsters: Array.isArray(def.rareMonsters) ? def.rareMonsters : base.rareMonsters,
            enemyBoost: def.enemyBoost || base.enemyBoost,
            isDungeon: true,
            isFixed: true
        };
    },

    // 固有ダンジョンの入口が街・集落など別の固定MAP内にある場合、その実座標を返す。
    // スカイプリズム、検証ツール、将来の移動UIで同じ解決規則を共有する。
    findFixedMapEntranceForDungeon(areaKey) {
        if (!areaKey || typeof FIXED_MAPS === "undefined") return null;
        const candidates = [];
        Object.entries(FIXED_MAPS).forEach(([parentAreaKey, parentDef]) => {
            const actions = Array.isArray(parentDef?.mapActions) ? parentDef.mapActions : [];
            actions.forEach(action => {
                if (!action || (action.target !== areaKey && action.targetAreaKey !== areaKey)) return;
                const x = Number(action.x);
                const y = Number(action.y);
                if (!Number.isInteger(x) || !Number.isInteger(y)) return;
                if (x < 0 || y < 0 || x >= Number(parentDef.width) || y >= Number(parentDef.height)) return;
                candidates.push({ parentAreaKey, parentDef, action, x, y });
            });
        });
        if (!candidates.length) return null;

        // 複数マス幅の入口は中央マスへ着地する。座標順を固定して結果を決定論的にする。
        candidates.sort((a, b) =>
            a.parentAreaKey.localeCompare(b.parentAreaKey) ||
            (a.x - b.x) ||
            (a.y - b.y)
        );
        const sameParent = candidates.filter(entry => entry.parentAreaKey === candidates[0].parentAreaKey);
        return sameParent[Math.floor(sameParent.length / 2)];
    },

    getFixedDungeonProgressKey(areaKey, floorNo = 1) {
        const base = MapRegistry.getFixedDungeonBase(areaKey);
        const progressAreaKey = base?.canonicalAreaKey || areaKey;
        if (base && Array.isArray(base.floors) && base.floors.length > 0) {
            return `${progressAreaKey}:F${Math.max(1, Number(floorNo || 1))}`;
        }
        return progressAreaKey;
    },

    isMapActionRuntimeAvailable(action) {
        if (!action) return false;
        // 同一座標に進行状態別のmapActionが複数ある場合は、現在利用可能なものを選ぶ。
        // Field側の完全な判定（クエスト状態・所持品条件を含む）が使える実行時はそれを優先し、
        // エディタ等でFieldが未初期化の場合のみフラグ条件へフォールバックする。
        if (typeof Field !== 'undefined' && typeof Field.isMapActionAvailable === 'function') {
            return Field.isMapActionAvailable(action);
        }
        return MapRegistry.isProgressEntryActive(action);
    },

    findMapAction(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.mapActions)) return null;
        const matches = mapDef.mapActions.filter(action =>
            Number(action.x) === Number(x) && Number(action.y) === Number(y)
        );
        return matches.find(action => MapRegistry.isMapActionRuntimeAvailable(action)) || null;
    },

    isPointInMapActionArea(action, x, y) {
        const area = action?.interactionArea;
        if (!area) return false;
        const left = Number(area.x);
        const top = Number(area.y);
        const width = Math.max(1, Number(area.width || 1));
        const height = Math.max(1, Number(area.height || 1));
        const tx = Number(x);
        const ty = Number(y);
        return Number.isFinite(left) && Number.isFinite(top)
            && tx >= left && tx < left + width
            && ty >= top && ty < top + height;
    },

    findMapActionInteractionCell(mapDef, x, y) {
        const exact = MapRegistry.findMapAction(mapDef, x, y);
        if (exact) return exact;
        if (!mapDef || !Array.isArray(mapDef.mapActions)) return null;
        return mapDef.mapActions.find(action =>
            MapRegistry.isPointInMapActionArea(action, x, y) &&
            MapRegistry.isMapActionRuntimeAvailable(action)
        ) || null;
    },

    isProgressEntryActive(entry) {
        if (!entry || entry.active === false) return false;
        const flags = (typeof App !== 'undefined' && App.data?.progress?.flags) || {};
        const requiredFlags = Array.isArray(entry.requiredFlags)
            ? entry.requiredFlags
            : (entry.requiredFlag ? [entry.requiredFlag] : []);
        const missingFlags = Array.isArray(entry.missingFlags)
            ? entry.missingFlags
            : (entry.missingFlag ? [entry.missingFlag] : []);
        return requiredFlags.every(flag => !!flags[flag])
            && missingFlags.every(flag => !flags[flag]);
    },

    findBlockingObject(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.blockingObjects)) return null;
        return mapDef.blockingObjects.find(object =>
            MapRegistry.isProgressEntryActive(object) &&
            Number(object.x) === Number(x) &&
            Number(object.y) === Number(y)
        ) || null;
    },

    isPointInEffect(effect, x, y) {
        if (!effect) return false;
        const tx = Number(x);
        const ty = Number(y);
        if (Number.isFinite(Number(effect.x)) && Number.isFinite(Number(effect.y)) && Number(effect.x) === tx && Number(effect.y) === ty) return true;
        const inRect = (rect) => {
            if (!rect) return false;
            const x1 = Math.min(Number(rect.x1 ?? rect.x ?? 0), Number(rect.x2 ?? rect.x ?? 0));
            const x2 = Math.max(Number(rect.x1 ?? rect.x ?? 0), Number(rect.x2 ?? rect.x ?? 0));
            const y1 = Math.min(Number(rect.y1 ?? rect.y ?? 0), Number(rect.y2 ?? rect.y ?? 0));
            const y2 = Math.max(Number(rect.y1 ?? rect.y ?? 0), Number(rect.y2 ?? rect.y ?? 0));
            return tx >= x1 && tx <= x2 && ty >= y1 && ty <= y2;
        };
        if (inRect(effect.rect)) return true;
        if (Array.isArray(effect.rects) && effect.rects.some(inRect)) return true;
        if (Array.isArray(effect.points) && effect.points.some(p => Number(p?.x) === tx && Number(p?.y) === ty)) return true;
        return false;
    },

    getMapTileSign(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.tiles)) return 'W';
        const row = mapDef.tiles[Number(y)];
        return String(row?.[Number(x)] || 'W').toUpperCase();
    },

    isProtectedTileEffectCell(mapDef, x, y) {
        if (!mapDef) return true;
        const tx = Number(x);
        const ty = Number(y);
        const tile = MapRegistry.getMapTileSign(mapDef, tx, ty);

        // Rectangular effect definitions may cross geometry. Walls never become effects.
        if (tile === 'W') return true;

        // Interactive cells retain their identity when a surface-effect range crosses them.
        // Stairs in particular must remain reliable stopping points for sliding movement.
        if (['C', 'R', 'B', 'S', 'D', 'U', 'X', 'Y', 'Z', 'Q', 'N', 'O'].includes(tile)) return true;
        const occupies = (list, conditional = false) => Array.isArray(list) && list.some(entry =>
            (!conditional || MapRegistry.isProgressEntryActive(entry)) &&
            Number(entry?.x) === tx && Number(entry?.y) === ty
        );
        return occupies(mapDef.floorLinks)
            || occupies(mapDef.chests)
            || occupies(mapDef.bosses)
            || occupies(mapDef.mapActions)
            || occupies(mapDef.blockingObjects, true)
            || occupies(mapDef.healSprings);
    },

    isTileEffectApplicableAt(mapDef, effect, x, y) {
        if (!MapRegistry.isPointInEffect(effect, x, y)) return false;
        if (Array.isArray(effect?.excludePoints) && effect.excludePoints.some(point =>
            Number(point?.x) === Number(x) && Number(point?.y) === Number(y)
        )) return false;
        const tile = MapRegistry.getMapTileSign(mapDef, x, y);
        if (tile === 'W') return false;
        if (effect?.type === 'ice' || effect?.type === 'poison') {
            return !MapRegistry.isProtectedTileEffectCell(mapDef, x, y);
        }
        return true;
    },

    findTileEffect(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.tileEffects)) return null;
        const effect = mapDef.tileEffects.find(effect => MapRegistry.isTileEffectApplicableAt(mapDef, effect, x, y)) || null;
        return effect ? { ...effect, x: Number(x), y: Number(y) } : null;
    },

    findFloorLink(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.floorLinks)) return null;
        return mapDef.floorLinks.find(link => Number(link.x) === Number(x) && Number(link.y) === Number(y)) || null;
    },

    findFixedBoss(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.bosses)) return null;
        return mapDef.bosses.find(boss => Number(boss.x) === Number(x) && Number(boss.y) === Number(y)) || null;
    },

    findFixedChest(mapDef, x, y) {
        if (!mapDef || !Array.isArray(mapDef.chests)) return null;
        return mapDef.chests.find(chest => Number(chest.x) === Number(x) && Number(chest.y) === Number(y)) || null;
    },

    getWorldAreaAt(x, y) {
        if (typeof STORY_DATA === "undefined" || !STORY_DATA.areas) return null;
        const point = MapRegistry.normalizeWorldPoint(x, y);
        const wx = point.x;
        const wy = point.y;
        for (const [key, area] of Object.entries(STORY_DATA.areas)) {
            if (Array.isArray(area.entrances)) {
                const entrance = area.entrances.find(pos => Number(pos.x) === wx && Number(pos.y) === wy);
                if (entrance) return [key, { ...area, centerX: wx, centerY: wy, _entryKey: entrance.entryKey || null, _entryLabel: entrance.label || null }];
            }
            if (Number(area.centerX) === wx && Number(area.centerY) === wy) {
                return [key, { ...area, _entryKey: area.defaultEntryKey || null }];
            }
        }
        return null;
    },

    getWorldTileConfig(x, y) {
        const entry = MapRegistry.getWorldAreaAt(x, y);
        const area = entry ? entry[1] : null;
        return area?.fieldTile || null;
    },

    getFixedFloorDirection(mapDef, link, currentFloorNo = null, areaKey = null) {
        if (!mapDef || !link || link.toFloor === undefined || link.toFloor === null) return null;
        const key = areaKey || mapDef.areaKey || null;
        const currentNo = Math.max(1, Number(currentFloorNo || mapDef.floor || 1));
        const targetNo = Math.max(1, Number(link.toFloor || 1));

        const currentLabel = String(mapDef.floorLabel || mapDef.label || `${currentNo}階`);
        let targetLabel = '';
        if (key && typeof MapRegistry.getFixedDungeonFloor === 'function') {
            const targetDef = MapRegistry.getFixedDungeonFloor(key, targetNo);
            targetLabel = String(targetDef?.floorLabel || targetDef?.label || '');
        }
        if (!targetLabel) targetLabel = `${targetNo}階`;

        const parseFloorLabel = (label, fallbackNo) => {
            const text = String(label || '');
            const basement = text.includes('地下');
            const numMatch = text.match(/(\d+)/);
            const num = numMatch ? Number(numMatch[1]) : Number(fallbackNo || 1);
            return { basement, num };
        };

        const current = parseFloorLabel(currentLabel, currentNo);
        const target = parseFloorLabel(targetLabel, targetNo);

        // 地下表記を含むMAPは「地下へ進む」時を下り、「地上へ戻る」時を上りとして扱う。
        if (current.basement || target.basement) {
            if (current.basement && target.basement) {
                if (target.num > current.num) return 'down';
                if (target.num < current.num) return 'up';
            }
            if (!current.basement && target.basement) return 'down';
            if (current.basement && !target.basement) return 'up';
        }

        // 地上階/塔は階数が大きくなる方向を上りとして扱う。
        if (targetNo > currentNo) return 'up';
        if (targetNo < currentNo) return 'down';
        return null;
    },

    getFixedFloorActionLabel(mapDef, link, currentFloorNo = null, areaKey = null) {
        if (link?.to === 'EXIT') return link?.label || '外に出る';
        const direction = MapRegistry.getFixedFloorDirection(mapDef, link, currentFloorNo, areaKey);
        if (direction === 'up') return '上の階へ';
        if (direction === 'down') return '下の階へ';
        return link?.label || '階段を使う';
    },

    getFixedOverlayConfig(mapDef, tileSign, x = null, y = null) {
        if (!mapDef) return null;
        const upper = String(tileSign || '').toUpperCase();
        const isDungeon = !!mapDef.isDungeon;
        const themeKey = mapDef.themeKey || mapDef.areaKey || mapDef.baseName;
        const defaults = isDungeon ? (FIXED_TILE_OVERLAYS.DEFAULT_DUNGEON || {}) : (FIXED_TILE_OVERLAYS.DEFAULT_FIELD || {});
        const themed = (themeKey && FIXED_TILE_OVERLAYS[themeKey]) ? FIXED_TILE_OVERLAYS[themeKey] : {};
        const local = mapDef.fixedTileOverlays || mapDef.overlayOverrides || {};
        const merged = { ...defaults, ...themed, ...local };
        if (!Object.prototype.hasOwnProperty.call(merged, upper)) return null;
        return merged[upper];
    },

    getFixedOverlayBaseTile(mapDef, tileSign) {
        if (!mapDef) return 'T';
        const upper = String(tileSign || '').toUpperCase();
        const isDungeon = !!mapDef.isDungeon;
        const themeKey = mapDef.themeKey || mapDef.areaKey || mapDef.baseName;
        const defaults = isDungeon ? (FIXED_OVERLAY_BASE_TILES.DEFAULT_DUNGEON || {}) : (FIXED_OVERLAY_BASE_TILES.DEFAULT_FIELD || {});
        const themed = (themeKey && FIXED_OVERLAY_BASE_TILES[themeKey]) ? FIXED_OVERLAY_BASE_TILES[themeKey] : {};
        const local = mapDef.fixedOverlayBaseTiles || {};
        const merged = { ...defaults, ...themed, ...local };
        return merged[upper] || 'T';
    }
};

if (typeof window !== "undefined") {
    window.MapRegistry = MapRegistry;
    window.FIXED_TILE_OVERLAYS = FIXED_TILE_OVERLAYS;
    window.FIXED_OVERLAY_BASE_TILES = FIXED_OVERLAY_BASE_TILES;
    window.SEA_ENCOUNTER_MONSTERS = SEA_ENCOUNTER_MONSTERS;
    window.FIELD_ENCOUNTER_ZONES = FIELD_ENCOUNTER_ZONES;
}
