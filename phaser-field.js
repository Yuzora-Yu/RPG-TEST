(function () {
    'use strict';

    const TILE_SIZE = 32;
    const FIELD_VIEW_TILES = 15;
    // 静的タイルは4マス単位で再利用し、歩くたびの全破棄・全生成を避ける。
    // その間にカメラが移動しても画面端が欠けないよう、同じ幅だけ余白を描く。
    const RENDER_BUCKET_SIZE = 4;
    const VIEW_PADDING = RENDER_BUCKET_SIZE;
    const BUILDING_PREFIXES = [
        'overlay_building_',
        'overlay_field_castle',
        'overlay_field_fortress',
        'overlay_field_hall',
        'overlay_field_house',
        'overlay_field_inn',
        'overlay_field_lighthouse',
        'overlay_field_medal',
        'overlay_field_ruins',
        'overlay_field_settlement',
        'overlay_field_shop',
        'overlay_field_smith',
        'overlay_field_temple',
        'overlay_field_tower',
        'overlay_field_town',
        'overlay_field_village',
        'overlay_field_weapon'
    ];

    const state = {
        game: null,
        scene: null,
        ready: false,
        failed: false,
        pendingField: null,
        worldObjects: [],
        actorObjects: [],
        waterObjects: [],
        uiObjects: [],
        atmosphereObjects: [],
        atmosphereLight: null,
        atmosphereSignature: null,
        textureKeys: new Set(),
        lastPlayerTextureKey: null,
        resizeObserver: null,
        lastStaticSignature: null,
        lastParentWidth: 0,
        lastParentHeight: 0
    };

    const getApp = () => (typeof App !== 'undefined' ? App : null);
    const getDungeon = () => (typeof Dungeon !== 'undefined' ? Dungeon : null);
    const getWorldMap = () => (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);
    const renderShared = window.MapRenderShared;

    const isBuildingTexture = (key) => BUILDING_PREFIXES.some(prefix => String(key || '').startsWith(prefix));

    const destroyObjects = (objects) => {
        while (objects.length) {
            const object = objects.pop();
            object?.__prismaTween?.remove?.();
            if (object && object.destroy) object.destroy();
        }
    };

    const activateLegacyFallback = (error) => {
        state.failed = true;
        state.ready = false;
        state.lastStaticSignature = null;
        document.getElementById('canvas-wrapper')?.classList.remove('phaser-field-active');
        const parent = document.getElementById('phaser-field-root');
        if (parent) parent.classList.remove('is-ready');
        if (error) {
            console.error('[PhaserField] 描画同期に失敗したためCanvas描画へ戻します。', error);
        }
        if (state.game) {
            try {
                state.game.destroy(true);
            } catch (destroyError) {
                console.warn('[PhaserField] Phaser終了処理を継続できませんでした。', destroyError);
            }
            state.game = null;
            state.scene = null;
        }
    };

    const colorToInt = (value, fallback = 0x000000) => {
        if (typeof value !== 'string') return fallback;
        const normalized = value.trim().replace('#', '');
        if (/^[0-9a-f]{3}$/i.test(normalized)) {
            return parseInt(normalized.split('').map(char => char + char).join(''), 16);
        }
        if (/^[0-9a-f]{6}$/i.test(normalized)) return parseInt(normalized, 16);
        return fallback;
    };

    const addKnownTextures = (scene) => {
        const graphics = window.GRAPHICS;
        if (!graphics || !graphics.images) return;

        Object.entries(graphics.images).forEach(([key, image]) => {
            if (!image || !image.complete || !image.naturalWidth || state.textureKeys.has(key)) return;
            if (!scene.textures.exists(key)) scene.textures.addImage(key, image);
            // High-resolution companion masters are reduced once at render time.
            // Per-texture linear filtering avoids the aliasing caused by forcing a
            // 1200px source through the global nearest-neighbour tile filter.
            if (String(key).startsWith('overlay_companion_') && typeof Phaser !== 'undefined') {
                scene.textures.get(key)?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
            }
            state.textureKeys.add(key);
        });
    };

    const resolveTextureKey = (keyOrPath) => {
        if (!keyOrPath) return null;
        if (state.textureKeys.has(keyOrPath)) return keyOrPath;
        const graphics = window.GRAPHICS?.data || {};
        return Object.keys(graphics).find(key => graphics[key] === keyOrPath) || keyOrPath;
    };

    const addImage = (scene, key, x, y, options = {}, target = state.worldObjects) => {
        key = resolveTextureKey(key);
        if (!key) return null;
        if (!scene.textures.exists(key)) {
            window.GRAPHICS?.get?.(key);
            return null;
        }
        const image = scene.add.image(x, y, key);
        image.setOrigin(options.originX ?? 0.5, options.originY ?? 1);
        const bleed = options.bleed || 0;
        image.setDisplaySize((options.width || TILE_SIZE) + bleed, (options.height || TILE_SIZE) + bleed);
        image.setDepth(options.depth || 0);
        if (options.alpha !== undefined) image.setAlpha(options.alpha);
        if (options.tint !== undefined) image.setTint(options.tint);
        target.push(image);
        return image;
    };

    const addTileFallback = (scene, x, y, color, depth) => {
        const rect = scene.add.rectangle(
            x + TILE_SIZE / 2,
            y + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
            colorToInt(color, 0x171b1d)
        );
        rect.setDepth(depth);
        state.worldObjects.push(rect);
        return rect;
    };

    const addShadow = (scene, x, y, width, alpha, depth, target = state.worldObjects) => {
        const shadow = scene.add.ellipse(x, y, width, Math.max(5, width * 0.24), 0x000000, alpha);
        shadow.setDepth(depth);
        target.push(shadow);
        return shadow;
    };

    const destroyAtmosphere = (scene) => {
        state.atmosphereObjects.forEach(object => scene?.tweens?.killTweensOf?.(object));
        destroyObjects(state.atmosphereObjects);
        state.atmosphereLight = null;
        state.atmosphereSignature = null;
    };

    const stableHash = (...parts) => renderShared.stableHash(...parts);

    // Each map theme owns its floor detail. This prevents a generic stone crack
    // from leaking into forests, palaces, machinery, and underwater ruins.
    // A frequency of 40 is 2.5%, less than half the former 1/17 dungeon rate.
    const FLOOR_DECOR_THEME_CONFIG = window.MAP_FLOOR_DECOR_THEMES || Object.freeze({
        DEFAULT: { key: 'overlay_decor_default_cave_dust', frequency: 40, alpha: 0.64 },
        START_VILLAGE: { key: 'overlay_decor_start_village_herbs', frequency: 40, alpha: 0.78 },
        START_CAVE: { key: 'overlay_decor_start_cave_damp', frequency: 40, alpha: 0.72 },
        FIRE_VILLAGE: { key: 'overlay_decor_fire_ember_fissure', frequency: 40, alpha: 0.84 },
        WIND_VILLAGE: { key: 'overlay_decor_wind_village_feather', frequency: 40, alpha: 0.74 },
        WIND_HOLE: { key: 'overlay_decor_wind_hole_root', frequency: 40, alpha: 0.76 },
        FORBIDDEN_FOREST: { key: 'overlay_decor_forbidden_forest_moss', frequency: 40, alpha: 0.78 },
        WATER_CITY: { key: null, disabled: true, reason: 'authored-clear-floor' },
        BIG_TOWER: { key: 'overlay_decor_big_tower_gear_oil', frequency: 40, alpha: 0.72 },
        THUNDER_FORT: { key: 'overlay_decor_thunder_fort_wiring', frequency: 40, alpha: 0.88, animate: 'electric' },
        LIGHT_PALACE: { key: 'overlay_decor_light_palace_prism', frequency: 40, alpha: 0.66 },
        GALVANIA_CAVE: { key: 'overlay_decor_galvania_crystal', frequency: 40, alpha: 0.72 },
        DARK_CASTLE: { key: 'overlay_decor_dark_castle_chain', frequency: 40, alpha: 0.70 },
        CRENA_CAVE: { key: null, disabled: true, reason: 'authored-clear-floor' },
        SEABED_TEMPLE: { key: 'overlay_decor_seabed_temple_ripple', frequency: 40, alpha: 0.70 },
        DARK_SHRINE_RUINS: { key: 'overlay_decor_dark_shrine_sigil', frequency: 40, alpha: 0.66 },
        GREZELIA_CAVE: { key: 'overlay_decor_grezelia_fossil', frequency: 40, alpha: 0.72 },
        ABYSS: { key: 'overlay_decor_abyss_void_dust', frequency: 40, alpha: 0.62 },
        ABYSS_FIELD: { key: null, disabled: true, reason: 'authored-ritual-ruin' },
        RUINED_SHRINE: { key: 'overlay_decor_ruined_shrine_glyph', frequency: 40, alpha: 0.68 }
    });

    const getFixedFloorDecorationsAt = (field, tileX, tileY) => renderShared.fixedFloorDecorationsAt(field.currentMapData, tileX, tileY);

    const drawConnectedFloorTextile = (scene, field, tileX, tileY, definition, baseDepth) => {
        const plan = renderShared.textileCellPlan(definition, tileX, tileY);
        if (!plan) return false;
        const style = plan.style;
        const px = tileX * TILE_SIZE;
        const py = tileY * TILE_SIZE;
        const edge = style.edgeSize;
        const key = suffix => `${style.keyPrefix}_${suffix}`;
        const open = plan.open;

        // Every tile keeps its own row depth so later floor rows cannot cover a tall carpet.
        // A two-pixel overlap hides the source texture boundary without exposing a seam.
        addImage(scene, key('fill'), px + TILE_SIZE / 2, py + TILE_SIZE, {
            width: TILE_SIZE,
            height: TILE_SIZE,
            bleed: 2,
            depth: baseDepth + 6
        });
        if (open.n) addImage(scene, key('edge_n'), px + TILE_SIZE / 2, py + edge, { width: TILE_SIZE, height: edge, depth: baseDepth + 7 });
        if (open.s) addImage(scene, key('edge_s'), px + TILE_SIZE / 2, py + TILE_SIZE, { width: TILE_SIZE, height: edge, depth: baseDepth + 7 });
        // The next row has a larger depth and its fill overlaps two pixels upward.
        // Extend each side segment by the same amount so that fill cannot notch the trim.
        if (open.w) addImage(scene, key('edge_w'), px + edge / 2, py + TILE_SIZE, { width: edge, height: TILE_SIZE + 2, depth: baseDepth + 7 });
        if (open.e) addImage(scene, key('edge_e'), px + TILE_SIZE - edge / 2, py + TILE_SIZE, { width: edge, height: TILE_SIZE + 2, depth: baseDepth + 7 });

        if (open.n && open.w) addImage(scene, key('corner_nw'), px + edge / 2, py + edge, { width: edge, height: edge, depth: baseDepth + 8 });
        if (open.n && open.e) addImage(scene, key('corner_ne'), px + TILE_SIZE - edge / 2, py + edge, { width: edge, height: edge, depth: baseDepth + 8 });
        if (open.s && open.w) addImage(scene, key('corner_sw'), px + edge / 2, py + TILE_SIZE, { width: edge, height: edge, depth: baseDepth + 8 });
        if (open.s && open.e) addImage(scene, key('corner_se'), px + TILE_SIZE - edge / 2, py + TILE_SIZE, { width: edge, height: edge, depth: baseDepth + 8 });
        return true;
    };

    const drawFixedFloorDecoration = (scene, field, tileX, tileY, definition, baseDepth) => {
        if (drawConnectedFloorTextile(scene, field, tileX, tileY, definition, baseDepth)) return true;
        if (definition?.type !== 'image' || !definition.imageKey) return false;
        const px = tileX * TILE_SIZE;
        const py = tileY * TILE_SIZE;
        return !!addImage(scene, definition.imageKey, px + TILE_SIZE / 2, py + TILE_SIZE, {
            width: Math.max(8, Number(definition.drawWidth || TILE_SIZE)),
            height: Math.max(8, Number(definition.drawHeight || TILE_SIZE)),
            depth: baseDepth + 7,
            alpha: definition.alpha === undefined ? 1 : Number(definition.alpha)
        });
    };

    const drawGroundDecoration = (scene, field, areaKey, tileX, tileY, rawUpper, floorConfig, overlay, baseDepth) => {
        if (!field.currentMapData) {
            if (overlay || field.getTileEffectGraphicKey?.(tileX, tileY)) return;
            const point = window.MapRegistry?.normalizeWorldPoint?.(tileX, tileY) || { x: tileX, y: tileY };
            const hash = stableHash('WORLD-DECOR', point.x, point.y, rawUpper);
            const worldDepth = -99900;
            const map = getWorldMap();
            const worldTileAt = (x, y) => {
                const normalized = window.MapRegistry?.normalizeWorldPoint?.(x, y) || { x, y };
                return String(map?.[normalized.y]?.[normalized.x] || '').toUpperCase();
            };

            // Bridges are explicit water-tile overlays. Never infer crossings from
            // neighboring terrain: only authored coordinates may become passable.
            const bridgeDef = window.MapRegistry?.getWorldBridgeAt?.(point.x, point.y);
            if (bridgeDef) {
                const bridge = addImage(scene, 'overlay_world_bridge_wood', tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE / 2, {
                    width: 38,
                    height: 19,
                    originY: 0.5,
                    depth: worldDepth + 4,
                    alpha: 0.98
                });
                if (bridge && bridgeDef.direction === 'vertical') bridge.setAngle(90);
                return;
            }
            const addWorldDecor = (keys, size, alpha, frequency) => {
                if (hash % frequency !== 0) return;
                const variants = Array.isArray(keys) ? keys : [keys];
                const key = variants[(hash >>> 11) % variants.length];
                const image = addImage(scene, key, tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE, {
                    width: size,
                    height: size,
                    depth: worldDepth,
                    alpha
                });
                if (!image) return;
                image.setFlipX(((hash >>> 4) & 1) === 1);
                image.setAngle((((hash >>> 8) % 3) - 1) * 3);
            };

            if (rawUpper === 'G' || rawUpper === 'T') {
                addWorldDecor([
                    'overlay_world_grass_detail',
                    'overlay_world_grass_weeds',
                    'overlay_world_grass_earth'
                ], 23, 0.78, 24);
            } else if (rawUpper === 'F') {
                addWorldDecor([
                    'overlay_world_forest_understory',
                    'overlay_world_forest_roots'
                ], 26, 0.75, 10);
            } else if (rawUpper === 'L') {
                addWorldDecor('overlay_world_foothill_rocks', 27, 0.72, 10);
            } else if (rawUpper === 'W') {
                const neighbors = [
                    [0, -1, 0, 0, -TILE_SIZE / 2],
                    [1, 0, 90, TILE_SIZE / 2, 0],
                    [0, 1, 180, 0, TILE_SIZE / 2],
                    [-1, 0, 270, -TILE_SIZE / 2, 0]
                ];
                // 水タイル中央へ波線を置かず、水と陸が接する境界線へ各辺を密着させる。
                // 角では二辺を描き、海の内部に縦縞が走る見え方を防ぐ。
                neighbors.forEach(([dx, dy, angle, offsetX, offsetY]) => {
                    const neighbor = worldTileAt(tileX + dx, tileY + dy);
                    if (!neighbor || neighbor === 'W') return;
                    const foam = addImage(scene, 'overlay_world_shore_foam', tileX * TILE_SIZE + TILE_SIZE / 2 + offsetX, tileY * TILE_SIZE + TILE_SIZE / 2 + offsetY, {
                        width: 32,
                        height: 8,
                        originY: 0.5,
                        depth: worldDepth + 2,
                        alpha: 0.58
                    });
                    if (foam) foam.setAngle(angle);
                });
            }
            return;
        }

        // Connected carpets/mats are ground layers. Draw them before checking actor,
        // boss, event, or floor-effect overlays so an object placed on top cannot cut
        // a square hole out of the textile.
        if (field.currentMapData) {
            const fixedDecorations = getFixedFloorDecorationsAt(field, tileX, tileY);
            let drewFixedDecoration = false;
            fixedDecorations.forEach(definition => {
                drewFixedDecoration = drawFixedFloorDecoration(scene, field, tileX, tileY, definition, baseDepth) || drewFixedDecoration;
            });
            if (drewFixedDecoration) return;
        }

        if (rawUpper !== 'T' && rawUpper !== 'G') return;
        if (overlay || field.getTileEffectGraphicKey?.(tileX, tileY)) return;
        if (!field.currentMapData) return; // ワールドマップは1マスが広域地形なので小物を置かない。

        const themeKey = String(field.currentMapData?.themeKey || areaKey || 'DEFAULT').toUpperCase();
        const decor = renderShared.floorDecorationPlan({
            themes: FLOOR_DECOR_THEME_CONFIG,
            themeKey,
            areaKey,
            floor: field.currentMapData?.floor || 0,
            x: tileX,
            y: tileY,
            tileSign: rawUpper
        });
        if (!decor) return;

        const image = addImage(scene, decor.key, tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE, {
            width: 32,
            height: 32,
            depth: baseDepth + 7,
            alpha: decor.alpha
        });
        if (!image) return;
        image.setFlipX(decor.flipX);
        image.setAngle(decor.angle);
        if (decor.animate === 'electric') {
            scene.tweens.add({
                targets: image,
                alpha: Math.max(0.42, decor.alpha - 0.28),
                duration: 420 + (decor.hash % 240),
                ease: 'Stepped',
                yoyo: true,
                repeat: -1,
                repeatDelay: 1800 + ((decor.hash >>> 10) % 1300)
            });
        }
    };

    const getMapSize = (field) => ({
        width: field.currentMapData
            ? Number(field.currentMapData.width || field.currentMapData.tiles?.[0]?.length || 1)
            : Number(getWorldMap()?.[0]?.length || 50),
        height: field.currentMapData
            ? Number(field.currentMapData.height || field.currentMapData.tiles?.length || 1)
            : Number(getWorldMap()?.length || 32)
    });

    const drawElevatedTerrainEdges = (scene, field, mapSize, areaKey, tileX, tileY, rawUpper, baseDepth) => {
        const definition = field.currentMapData?.elevatedEdges;
        if (!definition) return;
        const px = tileX * TILE_SIZE;
        const py = tileY * TILE_SIZE;
        const plan = renderShared.elevatedEdgeCellPlan({
            map: field.currentMapData,
            definition,
            x: tileX,
            y: tileY,
            tileSign: rawUpper,
            tileAtFn: (x, y) => field.getRenderedTileForDraw(
                x,
                y,
                mapSize.width,
                mapSize.height,
                areaKey
            )
        });
        if (!plan) return;
        plan.edges.forEach(edge => {
            addImage(scene, edge.key, px + edge.x, py + edge.y, {
                width: edge.width,
                height: edge.height,
                originX: 0,
                originY: 0,
                depth: baseDepth + 12
            });
        });
    };

    const drawMapSkyOverlays = (scene, field) => {
        const overlays = field.currentMapData?.skyOverlays;
        if (!Array.isArray(overlays)) return;
        overlays.forEach(definition => {
            const width = Math.max(8, Number(definition.drawWidth || TILE_SIZE));
            const height = Math.max(8, Number(definition.drawHeight || TILE_SIZE));
            const x = Number(definition.x || 0) * TILE_SIZE;
            const y = Number(definition.y || 0) * TILE_SIZE;
            // Sit above every covered sky row but below the next authored terrain row.
            const depth = Math.floor((Number(definition.y || 0) + height / TILE_SIZE) * 100) - 10;
            addImage(scene, definition.imageKey, x, y, {
                width,
                height,
                originX: 0,
                originY: 0,
                depth,
                alpha: definition.alpha === undefined ? 1 : Number(definition.alpha)
            });
        });
    };

    const applyFieldCamera = (scene, field) => {
        const camera = scene?.cameras?.main;
        if (!camera) return;
        const width = Math.max(1, scene.scale.width || 1);
        const height = Math.max(1, scene.scale.height || 1);
        camera.setViewport(0, 0, width, height);
        camera.setZoom(width / (FIELD_VIEW_TILES * TILE_SIZE));
        const px = Number(field.x) * TILE_SIZE + TILE_SIZE / 2;
        const py = Number(field.y) * TILE_SIZE + TILE_SIZE / 2;
        camera.centerOn(px, py);
    };

    const getVisibleRange = (scene) => ({
        x: Math.floor(FIELD_VIEW_TILES / 2) + VIEW_PADDING,
        y: Math.ceil((scene.scale.height || FIELD_VIEW_TILES * TILE_SIZE) / (2 * TILE_SIZE * Math.max(0.1, scene.cameras.main.zoom || 1))) + VIEW_PADDING
    });

    const drawTile = (scene, field, mapSize, areaKey, tileX, tileY) => {
        const tile = field.getRenderedTileForDraw(tileX, tileY, mapSize.width, mapSize.height, areaKey);
        const parts = field.getMapDrawParts
            ? field.getMapDrawParts(tile, tileX, tileY)
            : { upper: String(tile).toUpperCase(), baseTile: tile, overlayConfig: null };
        const rawUpper = String(tile || '').toUpperCase();
        const isRandomAbyssBossTile = rawUpper === 'B' && field.currentMapData?.isDungeon && !field.currentMapData?.isFixed && areaKey === 'ABYSS';
        const upper = isRandomAbyssBossTile ? 'T' : parts.upper;
        const overlay = parts.overlayConfig;
        const objectConfig = field.getTileConfigForDraw
            ? field.getTileConfigForDraw(upper, tileX, tileY)
            : field.getTileConfig(upper);
        const isBaseTerrainTile = upper === 'T' || upper === 'G' || objectConfig?.terrain === true;
        const groundTile = overlay ? parts.baseTile : (isBaseTerrainTile ? upper : 'T');
        const floorConfig = parts.worldOverlay
            ? field.getTileConfig(groundTile)
            : (field.getTileConfigForDraw
                ? field.getTileConfigForDraw(groundTile, tileX, tileY)
                : field.getTileConfig(groundTile));
        const wallGraphic = field.getDungeonWallGraphicForDraw
            ? field.getDungeonWallGraphicForDraw(tileX, tileY, upper, mapSize.width, mapSize.height, areaKey)
            : null;
        const px = tileX * TILE_SIZE;
        const py = tileY * TILE_SIZE;
        const baseDepth = tileY * 100;
        const isWorldMap = !field.currentMapData;
        // Wの意味はマップごとに異なる。水路画像を割り当てたWだけを低い水面として扱う。
        // これにより水上都市・海底神殿・クレナ鍾乳洞へ適用し、通常の石壁には影響しない。
        const isAnimatedWaterTile = objectConfig.animatedWater === true;
        const isLowerWaterTile = objectConfig.lowerLayer === true;
        // ワールドマップは海・山・森・草地をすべて同一の地形層として描く。
        // Y深度を与えると下段の海が上段の山へ乗り、地形が欠けて見える。
        const groundDepth = isWorldMap ? -100000 : baseDepth;
        const terrainDepth = isWorldMap ? -99950 : baseDepth + 42;

        if (isAnimatedWaterTile) {
            // 海・水路は画像そのものを1マス内へ固定する。
            // 草地などを下敷きにすると波アニメの隙間から別地形が見えるため、
            // 水面画像を地形の正本として直接描く。
            const waterDepth = isLowerWaterTile ? -50000 : groundDepth;
            const water = addImage(scene, objectConfig.img, px + TILE_SIZE / 2, py + TILE_SIZE, {
                depth: waterDepth,
                width: TILE_SIZE,
                height: TILE_SIZE,
                bleed: 0.6
            });
            if (water) {
                const waveA = scene.add.rectangle(px + 9, py + 11, 11, 1, 0xa8e8ff, 0.18);
                const waveB = scene.add.rectangle(px + 21, py + 22, 13, 1, 0x061f35, 0.16);
                waveA.setDepth(waterDepth + 1);
                waveB.setDepth(waterDepth + 1);
                state.worldObjects.push(waveA, waveB);
                state.waterObjects.push({
                    image: water,
                    waveA,
                    waveB,
                    baseAX: px + 9,
                    baseBX: px + 21,
                    phase: (tileX + tileY) & 1
                });
            } else {
                addTileFallback(scene, px, py, objectConfig.color, waterDepth);
            }
        } else {
            if (!addImage(scene, floorConfig.img, px + TILE_SIZE / 2, py + TILE_SIZE, {
                depth: groundDepth,
                originY: 1,
                bleed: 0.6
            })) {
                addTileFallback(scene, px, py, floorConfig.color, groundDepth);
            }
        }

        drawGroundDecoration(scene, field, areaKey, tileX, tileY, rawUpper, floorConfig, overlay, baseDepth);
        drawElevatedTerrainEdges(scene, field, mapSize, areaKey, tileX, tileY, rawUpper, baseDepth);

        if (!isLowerWaterTile && !isBaseTerrainTile && !overlay) {
            const wallFaceOverlay = !!(wallGraphic && field.getDungeonWallFaceModeForDraw?.() === 'overlay');
            const key = wallFaceOverlay ? objectConfig.img : (wallGraphic || objectConfig.img);
            const isWall = upper === 'W';
            const height = isWall && !isWorldMap ? 48 : TILE_SIZE;
            if (key && !isWorldMap) addShadow(scene, px + TILE_SIZE / 2 + 3, py + TILE_SIZE - 3, 24, 0.24, baseDepth + 10);
            const objectImage = addImage(scene, key, px + TILE_SIZE / 2, py + TILE_SIZE, {
                width: TILE_SIZE,
                height,
                depth: isWorldMap ? terrainDepth : baseDepth + (isWall ? 48 : 42)
            });
            if (!objectImage && objectConfig.color && objectConfig.color !== floorConfig.color) {
                addTileFallback(scene, px, py, objectConfig.color, isWorldMap ? terrainDepth : baseDepth + 40);
            }
            if (wallFaceOverlay) {
                addImage(scene, wallGraphic, px + TILE_SIZE / 2, py + TILE_SIZE, {
                    width: TILE_SIZE,
                    height,
                    depth: baseDepth + 49
                });
            }
        }

		if (overlay) {
			const key = overlay.img;
			const building = isBuildingTexture(key);
			const characterOverlay = /^(overlay_npc_|overlay_companion_)/.test(String(key || ''));
			const wallOverlay = overlay.wallOverlay === true;
			const blockingObjectOverlay = overlay.blockingObject === true;
			const eventMarkerOverlay = overlay.eventMarker === true;
			const bossOverlay =
				String(key || '').startsWith('overlay_boss_') ||
				String(key || '').startsWith('monster_');

			// ワールドマップ上の町・神殿等は地図記号として1マス表示にする。
			// 固定マップの建物は高さを残すが、手前の楕円影は不自然なので描かない。
			const raisedBuilding = building && !isWorldMap;

			// ボスマス画像だけ一括で2倍表示する。
			// addImage() は originY=1 なので、足元は元マス下端に揃ったまま拡大される。
			const overlayScale = bossOverlay ? 2 : 1;
			const width = eventMarkerOverlay
				? Math.max(9, Number(overlay.drawWidth || 12))
				: blockingObjectOverlay
				? Math.max(8, Number(overlay.drawWidth || TILE_SIZE))
				: (raisedBuilding ? TILE_SIZE * 2.4 : TILE_SIZE * overlayScale);
			const height = eventMarkerOverlay
				? Math.max(9, Number(overlay.drawHeight || 12))
				: blockingObjectOverlay
				? Math.max(8, Number(overlay.drawHeight || TILE_SIZE))
				: (wallOverlay ? TILE_SIZE * 1.5 : (raisedBuilding ? TILE_SIZE * 2.4 : TILE_SIZE * overlayScale));

			// ダンジョンの宝箱・階段・扉は影なし。
			// NPCとボスは位置を読みやすくするため影を残す。
            if (overlay.suppressShadow !== true && !parts.worldOverlay && !wallOverlay && !building && (blockingObjectOverlay || !field.currentMapData?.isDungeon || characterOverlay || bossOverlay)) {
				addShadow(
					scene,
					px + TILE_SIZE / 2 + 4,
					py + TILE_SIZE - 2,
					bossOverlay ? 34 : 24,
					bossOverlay ? 0.28 : 0.22,
					baseDepth + 50
				);
			}

			const overlayImage = addImage(scene, key, px + TILE_SIZE / 2, eventMarkerOverlay ? py + TILE_SIZE / 2 : py + TILE_SIZE, {
				width,
				height,
				originY: eventMarkerOverlay ? 0.5 : 1,
				alpha: eventMarkerOverlay ? 0.92 : 1,
				depth: isWorldMap ? -99880 : baseDepth + (wallOverlay ? 48 : (bossOverlay ? 84 : 72))
			});
			if (overlayImage && eventMarkerOverlay) {
				overlayImage.__prismaTween = scene.tweens.add({
					targets: overlayImage,
					displayWidth: { from: Math.max(9, width * 0.75), to: width },
					displayHeight: { from: Math.max(9, height * 0.75), to: height },
					alpha: { from: 0.52, to: 0.92 },
					duration: 520,
					ease: 'Sine.easeInOut',
					yoyo: true,
					repeat: -1
				});
			} else if (!overlayImage) {
				const marker = scene.add.circle(
					px + TILE_SIZE / 2,
					py + TILE_SIZE / 2,
					bossOverlay ? 14 : (eventMarkerOverlay ? 6 : 10),
					colorToInt(overlay.color, 0xffffff)
				);
				marker.setDepth(isWorldMap ? -99880 : baseDepth + (wallOverlay ? 48 : (bossOverlay ? 84 : 72)));
				state.worldObjects.push(marker);
				if (eventMarkerOverlay) {
					marker.__prismaTween = scene.tweens.add({
						targets: marker,
						scaleX: { from: 0.75, to: 1 },
						scaleY: { from: 0.75, to: 1 },
						alpha: { from: 0.52, to: 0.92 },
						duration: 520,
						ease: 'Sine.easeInOut',
						yoyo: true,
						repeat: -1
					});
				}
			}
		}

        const effectKey = field.getTileEffectGraphicKey ? field.getTileEffectGraphicKey(tileX, tileY) : null;
        if (effectKey) {
            addImage(scene, effectKey, px + TILE_SIZE / 2, py + TILE_SIZE, {
                depth: baseDepth + 36,
                alpha: 0.92
            });
        } else {
            const effectColor = field.getTileEffectMarkerColor ? field.getTileEffectMarkerColor(tileX, tileY) : null;
            if (effectColor) {
                const marker = scene.add.circle(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 6, colorToInt(effectColor, 0xffffff), 0.8);
                marker.setDepth(baseDepth + 38);
                state.worldObjects.push(marker);
            }
        }
    };

    const drawSpecialObject = (scene, field, object, key, color, mapFloor) => {
        if (!object || !object.active || Number(object.floor) !== Number(mapFloor)) return;
        const x = Number(object.x);
        const y = Number(object.y);
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE;
        const depth = y * 100 + 78;
        if (object.suppressShadow !== true) addShadow(scene, px + 3, py - 3, 23, 0.25, depth - 2);
        let glow = null;
        if (object.shimmer === true) {
            glow = scene.add.circle(px, py - 15, 18, color, 0.20);
            glow.setDepth(depth - 1);
            state.worldObjects.push(glow);
        }
        const image = addImage(scene, object.image || key, px, py, {
            depth,
            width: Math.max(16, Number(object.drawWidth) || TILE_SIZE),
            height: Math.max(16, Number(object.drawHeight) || TILE_SIZE)
        });
        if (image && object.shimmer === true) {
            // 水面そのものは固定する。建造物のように泉全体が伸縮して見えないよう、
            // 本体はごく弱い明滅だけに留め、周囲光だけを呼吸させる。
            image.__prismaTween = scene.tweens.add({
                targets: image,
                alpha: { from: 0.72, to: 1 },
                duration: 760,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
            const aura = addImage(scene, object.auraKey || 'heal-blossom', px, py + 4, {
                depth: depth + 1,
                width: 48,
                height: 72,
                alpha: 0.38
            });
            if (aura) {
                if (typeof Phaser !== 'undefined' && Phaser.BlendModes) aura.setBlendMode(Phaser.BlendModes.ADD);
                aura.__prismaTween = scene.tweens.add({
                    targets: aura,
                    y: { from: py + 8, to: py - 10 },
                    alpha: { from: 0.20, to: 0.78 },
                    duration: 920,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1
                });
            }
            const upperAura = addImage(scene, object.auraKey || 'heal-blossom', px, py + 8, {
                depth: depth + 2,
                width: 34,
                height: 62,
                alpha: 0.18,
                tint: 0xc8ffff
            });
            if (upperAura) {
                if (typeof Phaser !== 'undefined' && Phaser.BlendModes) upperAura.setBlendMode(Phaser.BlendModes.ADD);
                upperAura.__prismaTween = scene.tweens.add({
                    targets: upperAura,
                    y: { from: py + 12, to: py - 19 },
                    alpha: { from: 0.10, to: 0.58 },
                    duration: 1320,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: 260
                });
            }
            [-12, -5, 5, 12].forEach((offsetX, index) => {
                const startY = py - 7 + (index % 2) * 4;
                const mote = scene.add.circle(px + offsetX, startY, index % 2 ? 1.3 : 1.7, 0xe6ffff, 0.88);
                mote.setDepth(depth + 3);
                if (typeof Phaser !== 'undefined' && Phaser.BlendModes) mote.setBlendMode(Phaser.BlendModes.ADD);
                state.worldObjects.push(mote);
                mote.__prismaTween = scene.tweens.add({
                    targets: mote,
                    y: { from: startY, to: py - 38 - index * 3 },
                    x: { from: px + offsetX, to: px + offsetX + (index % 2 ? 3 : -3) },
                    alpha: { from: 0.88, to: 0.04 },
                    scale: { from: 0.72, to: 1.45 },
                    duration: 1080 + index * 140,
                    ease: 'Sine.easeOut',
                    repeat: -1,
                    delay: index * 210
                });
            });
            if (glow) {
                glow.__prismaTween = scene.tweens.add({
                    targets: glow,
                    alpha: { from: 0.12, to: 0.46 },
                    scaleX: { from: 0.78, to: 1.28 },
                    scaleY: { from: 0.78, to: 1.28 },
                    duration: 760,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1
                });
            }
        } else if (!image) {
            const marker = scene.add.circle(px, py - TILE_SIZE / 2, 10, color, 0.95);
            marker.setDepth(depth);
            state.worldObjects.push(marker);
        }
    };

    const drawAbyssBossObject = (scene, field, mapFloor) => {
        const dungeon = getDungeon();
        const app = getApp();
        if (!field.currentMapData?.isDungeon || field.currentMapData?.isFixed) return;
        if (app?.data?.location?.area !== 'ABYSS') return;
        if (!dungeon || typeof dungeon.getCurrentAbyssBossEncounter !== 'function') return;

        const encounter = dungeon.getCurrentAbyssBossEncounter();
        if (!encounter || !encounter.active || Number(encounter.floor) !== Number(mapFloor)) return;

        const monsterId = Number(encounter.displayMonsterId || encounter.monsterIds?.[0]);
        if (!Number.isFinite(monsterId)) return;

        const x = Number(encounter.x ?? 5);
        const y = Number(encounter.y ?? 5);
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE;
        const key = field.getMonsterMapSpriteKey
            ? field.getMonsterMapSpriteKey(monsterId)
            : `monster_${monsterId}`;
        const depth = y * 100 + 90;

        const abyssBossScale = 2.6;
        addShadow(scene, px + 4, py - 2, 44, 0.30, depth - 3);
        if (!addImage(scene, key, px, py, {
            width: TILE_SIZE * abyssBossScale,
            height: TILE_SIZE * abyssBossScale,
            depth
        })) {
            const marker = scene.add.circle(px, py - TILE_SIZE / 2, 17, 0xc78cff, 0.95);
            marker.setDepth(depth);
            state.worldObjects.push(marker);
        }
    };

    const miniTileColor = (field, tile, x, y) => {
        const upper = String(tile || '').toUpperCase();
        if (upper === 'W') return 0x08090b;
        const config = field.getTileConfigForDraw ? field.getTileConfigForDraw(tile, x, y) : field.getTileConfig(tile);
        return colorToInt(config?.color, upper === 'M' ? 0x54515b : 0x333333);
    };

    const drawMinimap = (scene, field, mapSize, areaKey) => {
        const size = Math.max(80, Math.round(
            typeof field.getFieldMinimapDisplaySize === 'function'
                ? field.getFieldMinimapDisplaySize()
                : 80
        ));
        const margin = 14;
        const range = 7;
        const cells = range * 2 + 1;
        const camera = scene.cameras.main;
        const zoom = Math.max(0.1, camera.zoom || 1);
        const screenLeft = Math.max(margin, scene.scale.width - size - margin);
        const screenTop = margin;
        const worldTopLeft = camera.getWorldPoint(screenLeft, screenTop);
        const left = worldTopLeft.x;
        const top = worldTopLeft.y;
        const drawSize = size / zoom;
        const cell = drawSize / cells;
        const graphics = scene.add.graphics();
        graphics.setDepth(1000000);
        graphics.fillStyle(0x000000, 0.56);
        graphics.fillRect(left, top, drawSize, drawSize);
        graphics.lineStyle(Math.max(1 / zoom, 0.5), 0xffffff, 0.62);
        graphics.strokeRect(left, top, drawSize, drawSize);

        for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
                const tx = Number(field.x) + dx;
                const ty = Number(field.y) + dy;
                let visible = true;
                if (field.currentMapData && (tx < 0 || ty < 0 || tx >= mapSize.width || ty >= mapSize.height)) visible = false;
                if (visible && field.currentMapData?.isDungeon && !field.currentMapData?.isFixed &&
                    getDungeon() && typeof getDungeon().isVisited === 'function') {
                    const inSight = Math.abs(dx) <= 4 && Math.abs(dy) <= 4;
                    if (!inSight && !getDungeon().isVisited(tx, ty)) visible = false;
                }
                if (!visible) continue;
                const tile = field.getRenderedTileForDraw(tx, ty, mapSize.width, mapSize.height, areaKey);
                const cellX = left + (dx + range) * cell;
                const cellY = top + (dy + range) * cell;
                graphics.fillStyle(dx === 0 && dy === 0 ? 0xffffff : miniTileColor(field, tile, tx, ty), 1);
                graphics.fillRect(cellX, cellY, cell + (1 / zoom), cell + (1 / zoom));
                if ((dx !== 0 || dy !== 0) && typeof field.getMiniMapMarkerColor === 'function') {
                    const markerColor = field.getMiniMapMarkerColor(tile, tx, ty);
                    if (markerColor) {
                        const markerSize = Math.max(2 / zoom, cell * 0.46);
                        graphics.fillStyle(colorToInt(markerColor, 0xffffff), 1);
                        graphics.fillRect(
                            cellX + (cell - markerSize) / 2,
                            cellY + (cell - markerSize) / 2,
                            markerSize,
                            markerSize
                        );
                    }
                }
            }
        }

        const drawObjectMarker = (object, color) => {
            if (!object || !object.active || Number(object.floor) !== Number(getDungeon()?.floor)) return;
            const dx = Number(object.x) - Number(field.x);
            const dy = Number(object.y) - Number(field.y);
            if ((dx === 0 && dy === 0) || Math.abs(dx) > range || Math.abs(dy) > range) return;
            graphics.fillStyle(color, 1);
            graphics.fillRect(
                left + (dx + range) * cell + (1 / zoom),
                top + (dy + range) * cell + (1 / zoom),
                Math.max(2 / zoom, cell - (2 / zoom)),
                Math.max(2 / zoom, cell - (2 / zoom))
            );
        };

        const dungeonData = getApp()?.data?.dungeon;
        drawObjectMarker(dungeonData?.healSpring, 0x80ffb0);
        drawObjectMarker(dungeonData?.abyssRift, 0xa34cff);
        drawObjectMarker(dungeonData?.adventurer, 0x5bd6ff);
        drawObjectMarker(dungeonData?.trialAngel, 0xfff3a6);
        drawObjectMarker(dungeonData?.keyGuardian, 0xffd78a);
        drawObjectMarker(dungeonData?.abyssBossEncounter, 0xc78cff);
        if (field.currentMapData?.isFixed && typeof field.getFixedHealSpringsForCurrentFloor === 'function') {
            field.getFixedHealSpringsForCurrentFloor().forEach(spring => {
                drawObjectMarker({
                    active: true,
                    floor: getDungeon()?.floor,
                    x: Number(spring.x),
                    y: Number(spring.y)
                }, 0x80ffb0);
            });
        }

        // タイル描画で枠線が上書きされないよう、ミニマップの枠は最後に描く。
        graphics.lineStyle(2, 0xffffff, 0.78);
        graphics.strokeRect(Math.round(left) + 1, Math.round(top) + 1, Math.round(size) - 2, Math.round(size) - 2);

        state.uiObjects.push(graphics);

        // 所持鍵はHTMLミニマップ直下の専用HUDに描画する。
        // Phaserキャンバス内へ置くと画面サイズによって下端がクリップされるため重複描画しない。
    };

    const drawAtmosphere = (scene, field) => {
        const dungeon = !!field.currentMapData?.isDungeon;
        if (!dungeon || field.getCurrentAreaKey?.() === 'WORLD') {
            if (state.atmosphereObjects.length) destroyAtmosphere(scene);
            return;
        }

        const areaKey = String(field.getCurrentAreaKey?.() || 'DUNGEON');
        const floor = Number(getDungeon()?.floor || field.currentMapData?.floor || 0);
        const zoom = Math.max(0.1, Number(scene.cameras?.main?.zoom || 1));
        const logicalWidth = scene.scale.width / zoom;
        const logicalHeight = scene.scale.height / zoom;
        const signature = `${areaKey}:${floor}:${scene.scale.width}x${scene.scale.height}:${zoom.toFixed(4)}`;
        if (state.atmosphereSignature === signature && state.atmosphereObjects.length) return;
        destroyAtmosphere(scene);

        // Preserve the authored darkness and player-centered light, but remove the four
        // black edge rectangles that looked like a square frame. All atmosphere objects
        // persist across steps; only motes animate on a three-second drift cycle.
        let atmosphereColor = 0x1a1028;
        let atmosphereAlpha = 0.10;
        let moteColor = 0xc9b6ff;
        if (/FIRE|IGNIS|VOLCANO/i.test(areaKey)) {
            atmosphereColor = 0x4a160d;
            moteColor = 0xff9a45;
        } else if (/WATER|SEA|CRENA|ICE/i.test(areaKey)) {
            atmosphereColor = 0x0b3150;
            atmosphereAlpha = 0.085;
            moteColor = 0xa8ecff;
        } else if (/WIND|FOREST/i.test(areaKey)) {
            atmosphereColor = 0x143d2b;
            atmosphereAlpha = 0.055;
            moteColor = 0xb6f7a5;
        } else if (/LIGHT|PALACE|SHRINE/i.test(areaKey)) {
            atmosphereColor = 0x4a4218;
            atmosphereAlpha = 0.045;
            moteColor = 0xfff4b8;
        } else if (/DARK|ABYSS/i.test(areaKey)) {
            atmosphereColor = 0x180b2d;
            atmosphereAlpha = 0.13;
            moteColor = 0xc084fc;
        }

        const atmosphereMargin = TILE_SIZE;
        const overlay = scene.add.rectangle(
            -atmosphereMargin,
            -atmosphereMargin,
            logicalWidth + atmosphereMargin * 2,
            logicalHeight + atmosphereMargin * 2,
            atmosphereColor,
            atmosphereAlpha
        );
        overlay.setOrigin(0, 0);
        overlay.setScrollFactor(0);
        overlay.setDepth(900000);
        state.atmosphereObjects.push(overlay);

        const playerLightX = Number(field.x) * TILE_SIZE + TILE_SIZE / 2;
        const playerLightY = Number(field.y) * TILE_SIZE + TILE_SIZE / 2;
        const light = scene.add.circle(playerLightX, playerLightY, 95 / zoom, 0xffedbd, 0.055);
        // Use world coordinates. A screen-center light drifts away from the hero whenever
        // viewport sizing or camera transforms differ; this point is updated on every step.
        light.setScrollFactor(1);
        light.setDepth(900001);
        state.atmosphereObjects.push(light);
        state.atmosphereLight = light;

        const width = Math.max(72, logicalWidth - 36);
        const height = Math.max(72, logicalHeight - 36);
        for (let index = 0; index < 9; index += 1) {
            const hash = stableHash(areaKey, floor, index);
            const driftHash = stableHash('DRIFT', areaKey, floor, index);
            const x = 18 + (hash % width);
            const y = 18 + ((hash >>> 9) % height);
            const radius = (1 + ((hash >>> 17) % 2)) / zoom;
            const mote = scene.add.circle(x, y, radius, moteColor, 0.18 + (index % 3) * 0.04);
            mote.setScrollFactor(0);
            mote.setDepth(900003);
            state.atmosphereObjects.push(mote);
            scene.tweens.add({
                targets: mote,
                x: Math.max(18, Math.min(logicalWidth - 18, x + ((driftHash % 31) - 15))),
                y: Math.max(18, Math.min(logicalHeight - 18, y + (((driftHash >>> 8) % 25) - 12))),
                alpha: 0.10 + ((driftHash >>> 16) % 10) / 100,
                duration: 3000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: (index % 3) * 180
            });
        }
        state.atmosphereSignature = signature;
    };

    const getStaticSignature = (field) => {
        const dungeon = getApp()?.data?.dungeon || {};
        const progress = getApp()?.data?.progress || {};
        const progressKey = typeof field.getCurrentProgressMapKey === 'function'
            ? field.getCurrentProgressMapKey()
            : field.getCurrentAreaKey();
        const special = [
            dungeon.healSpring,
            dungeon.abyssRift,
            dungeon.adventurer,
            dungeon.keyGuardian,
            dungeon.trialAngel,
            dungeon.abyssBossEncounter
        ].map(object => object
            ? `${object.active}:${object.floor}:${object.x}:${object.y}:${object.direction || ''}:${object.step || ''}:${object.displayMonsterId || ''}:${Array.isArray(object.monsterIds) ? object.monsterIds.join(',') : ''}`
            : '-'
        ).join('|');
		const randomDungeonMapSignature = (
			field.currentMapData?.isDungeon &&
			!field.currentMapData?.isFixed &&
			Array.isArray(getDungeon()?.map)
		)
			? getDungeon().map
				.map(row => Array.isArray(row) ? row.join('') : String(row || ''))
				.join('/')
			: '';
        return [
            field.getCurrentAreaKey(),
            getDungeon()?.floor || 0,
            Math.floor(Number(field.x || 0) / RENDER_BUCKET_SIZE),
            Math.floor(Number(field.y || 0) / RENDER_BUCKET_SIZE),
            field.minimapMode,
            typeof field.getFieldMinimapDisplaySize === 'function' ? field.getFieldMinimapDisplaySize() : 80,
            field.currentMapData?.name || 'WORLD',
            field.currentMapData?.themeKey || 'DEFAULT',
            field.currentMapData?.battleBg || '',
            dungeon.floorPlanType || '',
            dungeon.visualThemeId || '',
            progress.storyStep || 0,
            progress.subStep || 0,
            JSON.stringify(progress.flags || {}),
            special,
            randomDungeonMapSignature,
            JSON.stringify(progress.mapChanges?.[progressKey] || {}),
            JSON.stringify(progress.openedChests?.[progressKey] || []),
            JSON.stringify(progress.defeatedBosses?.[progressKey] || []),
            JSON.stringify(progress.fixedHunters?.[progressKey] || {})
        ].join('::');
    };

    const drawPlayer = (scene, field) => {
        destroyObjects(state.actorObjects);
        const px = Number(field.x) * TILE_SIZE + TILE_SIZE / 2;
        const py = Number(field.y) * TILE_SIZE + TILE_SIZE;
        const direction = ['down', 'left', 'right', 'up'][field.dir];
        const transport = getApp()?.data?.transportMode;
        const floodedBoat = typeof field.isPlayerOnFloodedWater === 'function' && field.isPlayerOnFloodedWater();
        const isBoat = transport === 'boat' || floodedBoat;
        const heroKey = isBoat
            ? `overlay_magic_boat_${direction}`
            : transport === 'flying'
                ? `hero_wing_${direction}_${field.step}`
                : `hero_${direction}_${field.step}`;
        if (!isBoat) {
            // 主人公の左右へはみ出さず、両足の接地だけが分かる幅にする。
            addShadow(scene, px, py - 2, 16, 0.34, Number(field.y) * 100 + 82, state.actorObjects);
        }
        // Request the desired frame, but never replace the actor with a white circle while
        // a newly cached wing frame is being promoted into Phaser's texture manager.
        window.GRAPHICS?.get?.(heroKey);
        const normalKey = `hero_${direction}_${field.step}`;
        const fallbackKeys = [state.lastPlayerTextureKey, normalKey, 'hero_down_1'];
        const drawKey = scene.textures.exists(heroKey)
            ? heroKey
            : fallbackKeys.find(key => key && scene.textures.exists(key));
        const playerImage = drawKey ? addImage(scene, drawKey, px, py, {
            depth: Number(field.y) * 100 + 88
        }, state.actorObjects) : null;
        if (playerImage) state.lastPlayerTextureKey = drawKey;
        applyFieldCamera(scene, field);
        scene.cameras.main.setRoundPixels(true);
        if (state.atmosphereLight?.active) {
            state.atmosphereLight.setPosition(px, py - TILE_SIZE / 2);
        }
        state.waterObjects.forEach((water) => {
            const shifted = ((field.step + water.phase) & 1) === 0;
            // タイル画像と描画矩形は動かさず、1マス内の波紋だけを左右へ揺らす。
            water.waveA.x = water.baseAX + (shifted ? 2 : -1);
            water.waveB.x = water.baseBX + (shifted ? -2 : 1);
            water.waveA.setAlpha(shifted ? 0.24 : 0.12);
            water.waveB.setAlpha(shifted ? 0.11 : 0.20);
            water.image.setAlpha(1);
        });
    };

    const sync = (field) => {
        const scene = state.scene;
        if (!scene || !field || !field.ready) return;
        addKnownTextures(scene);
        const parent = document.getElementById('phaser-field-root');
        if (parent && state.game && parent.clientWidth > 0 && parent.clientHeight > 0) {
            const parentWidth = parent.clientWidth;
            const parentHeight = parent.clientHeight;
            if (state.lastParentWidth !== parentWidth || state.lastParentHeight !== parentHeight) {
                state.lastParentWidth = parentWidth;
                state.lastParentHeight = parentHeight;
                state.game.scale.resize(parentWidth, parentHeight);
                state.lastStaticSignature = null;
            }
        }

        const staticSignature = getStaticSignature(field);
        if (state.lastStaticSignature === staticSignature) {
            drawPlayer(scene, field);
            if (typeof field.drawHudMinimap === 'function') field.drawHudMinimap();
            return;
        }

        destroyObjects(state.worldObjects);
        destroyObjects(state.actorObjects);
        destroyObjects(state.uiObjects);
        state.waterObjects = [];

        const mapSize = getMapSize(field);
        const areaKey = field.getCurrentAreaKey();
        applyFieldCamera(scene, field);
        const range = getVisibleRange(scene);

        for (let dy = -range.y; dy <= range.y; dy++) {
            for (let dx = -range.x; dx <= range.x; dx++) {
                drawTile(scene, field, mapSize, areaKey, Number(field.x) + dx, Number(field.y) + dy);
            }
        }
        drawMapSkyOverlays(scene, field);

        const dungeonData = getApp()?.data?.dungeon;
        const floor = getDungeon()?.floor;
        if (field.currentMapData?.isDungeon && dungeonData) {
            drawSpecialObject(scene, field, dungeonData.healSpring
                ? { ...dungeonData.healSpring, image: getDungeon()?.healSpringImagePath, drawWidth: 44, drawHeight: 44, shimmer: true, auraKey: 'heal-blossom', suppressShadow: true }
                : null, 'overlay_shrine_healing_spring', 0x80ffb0, floor);
            drawSpecialObject(scene, field, dungeonData.abyssRift, 'abyss-vortex', 0xa34cff, floor);
            const adventurer = dungeonData.adventurer;
            const adventurerKey = getDungeon()?.getAdventurerGraphicKey?.(adventurer) || 'overlay_dungeon_adventurer';
            drawSpecialObject(scene, field, adventurer ? { ...adventurer, image: null } : null, adventurerKey, 0x5bd6ff, floor);
            drawSpecialObject(scene, field, dungeonData.keyGuardian, null, 0xffd78a, floor);
            drawSpecialObject(scene, field, dungeonData.trialAngel, 'overlay_dungeon_trial_angel', 0xfff3a6, floor);
            drawAbyssBossObject(scene, field, floor);
        }
        if (field.currentMapData?.isFixed && typeof field.getFixedHealSpringsForCurrentFloor === 'function') {
            field.getFixedHealSpringsForCurrentFloor().forEach(spring => {
                drawSpecialObject(scene, field, {
                    active: true,
                    floor,
                    x: Number(spring.x),
                    y: Number(spring.y),
                    image: spring.imageKey || getDungeon()?.healSpringImagePath || 'assets/map/overlays/overlay_shrine_healing_spring_v001.png',
                    drawWidth: Number(spring.drawWidth) || 44,
                    drawHeight: Number(spring.drawHeight) || 44,
                    shimmer: spring.shimmer !== false,
                    auraKey: spring.auraKey || 'heal-blossom',
                    suppressShadow: true
                }, 'overlay_shrine_healing_spring', 0x80ffb0, floor);
            });
        }

        drawPlayer(scene, field);
        drawAtmosphere(scene, field);
        if (typeof field.drawHudMinimap === 'function') field.drawHudMinimap();
        state.lastStaticSignature = staticSignature;
    };

    const createGame = () => {
        if (state.game || state.failed || !window.Phaser) return;
        const parent = document.getElementById('phaser-field-root');
        if (!parent) return;

        try {
            state.game = new window.Phaser.Game({
                // 既存画像はブラウザのImageキャッシュから受け渡す。
                // WebGLのtexImage2Dは、ブラウザや配信キャッシュの条件によって
                // 同一オリジン画像でもCORS汚染として拒否することがあるためCanvas固定にする。
                type: window.Phaser.CANVAS,
                parent,
                width: Math.max(320, parent.clientWidth || 320),
                height: Math.max(320, parent.clientHeight || 320),
                transparent: false,
                backgroundColor: '#07090b',
                pixelArt: true,
                antialias: false,
                roundPixels: true,
                render: {
                    antialias: false,
                    pixelArt: true,
                    roundPixels: true,
                    powerPreference: 'high-performance'
                },
                // 音声は既存ゲーム側が管理する。描画専用PhaserでAudioContextを作らない。
                audio: {
                    noAudio: true
                },
                scale: {
                    mode: window.Phaser.Scale.RESIZE,
                    autoCenter: window.Phaser.Scale.CENTER_BOTH
                },
                scene: {
                    create: function () {
                        state.scene = this;
                        state.ready = true;
                        addKnownTextures(this);
                        parent.classList.add('is-ready');
                        document.getElementById('canvas-wrapper')?.classList.add('phaser-field-active');
                        if (state.pendingField) sync(state.pendingField);
                        window.requestAnimationFrame(() => {
                            refreshVisibleField();
                            window.requestAnimationFrame(refreshVisibleField);
                        });
                    }
                }
            });

            if (window.ResizeObserver) {
                state.resizeObserver = new ResizeObserver(() => {
                    if (!state.game || !parent.clientWidth || !parent.clientHeight) return;
                    state.game.scale.resize(parent.clientWidth, parent.clientHeight);
                    state.lastParentWidth = parent.clientWidth;
                    state.lastParentHeight = parent.clientHeight;
                    if (state.pendingField) sync(state.pendingField);
                });
                state.resizeObserver.observe(parent);
            }
        } catch (error) {
            activateLegacyFallback(error);
        }
    };

    const refreshVisibleField = () => {
        if (state.failed || !state.game || !state.scene || !state.pendingField) return;
        const parent = document.getElementById('phaser-field-root');
        if (!parent || parent.clientWidth <= 0 || parent.clientHeight <= 0) return;
        try {
            state.game.loop.wake();
            state.scene.scene.wake();
            state.scene.scene.setVisible(true);
            state.game.scale.resize(parent.clientWidth, parent.clientHeight);
            state.lastStaticSignature = null;
            sync(state.pendingField);
        } catch (error) {
            activateLegacyFallback(error);
        }
    };

    window.PRISMA_USE_PHASER_FIELD = window.PRISMA_USE_PHASER_FIELD !== false;
    window.PhaserFieldRenderer = {
        render(field) {
            if (!window.PRISMA_USE_PHASER_FIELD || state.failed || !window.Phaser) return false;
            state.pendingField = field;
            createGame();
            if (!state.ready) return false;
            try {
                sync(field);
                return true;
            } catch (error) {
                // 描画エラーでField.move()やエリア遷移の後処理まで止めない。
                activateLegacyFallback(error);
                return false;
            }
        },
        resize() {
            const parent = document.getElementById('phaser-field-root');
            if (!state.game || !parent) return;
            state.game.scale.resize(parent.clientWidth || 320, parent.clientHeight || 320);
            state.lastStaticSignature = null;
            if (state.pendingField) sync(state.pendingField);
        },
        refresh() {
            if (!state.ready || !state.pendingField) return;
            state.lastStaticSignature = null;
            sync(state.pendingField);
        },
        setActive(active) {
            if (state.failed) return;
            if (!active) {
                if (state.scene) state.scene.scene.setVisible(false);
                return;
            }

            // 戦闘中は親要素がdisplay:noneになるため、復帰直後のPhaserサイズが
            // 旧値または0のままになるブラウザがある。レイアウト確定後に二段階で再同期する。
            if (state.scene) state.scene.scene.setVisible(true);
            window.requestAnimationFrame(() => {
                refreshVisibleField();
                window.requestAnimationFrame(refreshVisibleField);
            });
        },
        isReady() {
            return state.ready && !state.failed;
        }
    };
})();
