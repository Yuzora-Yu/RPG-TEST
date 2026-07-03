(function () {
    'use strict';

    const TILE_SIZE = 32;
    const VIEW_PADDING = 2;
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
        textureKeys: new Set(),
        resizeObserver: null,
        lastStaticSignature: null
    };

    const getApp = () => (typeof App !== 'undefined' ? App : null);
    const getDungeon = () => (typeof Dungeon !== 'undefined' ? Dungeon : null);
    const getWorldMap = () => (typeof MAP_DATA !== 'undefined' ? MAP_DATA : null);

    const isBuildingTexture = (key) => BUILDING_PREFIXES.some(prefix => String(key || '').startsWith(prefix));

    const destroyObjects = (objects) => {
        while (objects.length) {
            const object = objects.pop();
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
        if (!key || !scene.textures.exists(key)) return null;
        const image = scene.add.image(x, y, key);
        image.setOrigin(options.originX ?? 0.5, options.originY ?? 1);
        image.setDisplaySize(options.width || TILE_SIZE, options.height || TILE_SIZE);
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
        rect.setStrokeStyle(1, 0xffffff, 0.055);
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

    const getMapSize = (field) => ({
        width: field.currentMapData
            ? Number(field.currentMapData.width || field.currentMapData.tiles?.[0]?.length || 1)
            : Number(getWorldMap()?.[0]?.length || 50),
        height: field.currentMapData
            ? Number(field.currentMapData.height || field.currentMapData.tiles?.length || 1)
            : Number(getWorldMap()?.length || 32)
    });

    const getVisibleRange = (scene) => ({
        x: Math.ceil(scene.scale.width / (2 * TILE_SIZE)) + VIEW_PADDING,
        y: Math.ceil(scene.scale.height / (2 * TILE_SIZE)) + VIEW_PADDING
    });

    const drawTile = (scene, field, mapSize, areaKey, tileX, tileY) => {
        const tile = field.getRenderedTileForDraw(tileX, tileY, mapSize.width, mapSize.height, areaKey);
        const parts = field.getMapDrawParts
            ? field.getMapDrawParts(tile, tileX, tileY)
            : { upper: String(tile).toUpperCase(), baseTile: tile, overlayConfig: null };
        const upper = parts.upper;
        const overlay = parts.overlayConfig;
        const groundTile = overlay ? parts.baseTile : (upper === 'G' ? 'G' : 'T');
        const floorConfig = parts.worldOverlay
            ? field.getTileConfig(groundTile)
            : (field.getTileConfigForDraw
                ? field.getTileConfigForDraw(groundTile, tileX, tileY)
                : field.getTileConfig(groundTile));
        const objectConfig = field.getTileConfigForDraw
            ? field.getTileConfigForDraw(upper, tileX, tileY)
            : field.getTileConfig(upper);
        const wallGraphic = field.getDungeonWallGraphicForDraw
            ? field.getDungeonWallGraphicForDraw(tileX, tileY, upper, mapSize.width, mapSize.height, areaKey)
            : null;
        const px = tileX * TILE_SIZE;
        const py = tileY * TILE_SIZE;
        const baseDepth = tileY * 100;
        const isWorldMap = !field.currentMapData;
        // Wの意味はマップごとに異なる。水路画像を割り当てたWだけを低い水面として扱う。
        // これにより水上都市・海底神殿・クレナ鍾乳洞へ適用し、通常の石壁には影響しない。
        const isAnimatedWaterTile = upper === 'W' && objectConfig.animatedWater === true;
        const isLowerWaterTile = upper === 'W' && objectConfig.lowerLayer === true;
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
                height: TILE_SIZE
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
                originY: 1
            })) {
                addTileFallback(scene, px, py, floorConfig.color, groundDepth);
            }
        }

        if (!isLowerWaterTile && upper !== 'T' && upper !== 'G' && !overlay) {
            const key = wallGraphic || objectConfig.img;
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
        }

		if (overlay) {
			const key = overlay.img;
			const building = isBuildingTexture(key);
			const characterOverlay = String(key || '').startsWith('overlay_npc_');
			const wallOverlay = overlay.wallOverlay === true;
			const bossOverlay =
				String(key || '').startsWith('overlay_boss_') ||
				String(key || '').startsWith('monster_');

			// ワールドマップ上の町・神殿等は地図記号として1マス表示にする。
			// 固定マップの建物は高さを残すが、手前の楕円影は不自然なので描かない。
			const raisedBuilding = building && !isWorldMap;

			// ボスマス画像だけ一括で2倍表示する。
			// addImage() は originY=1 なので、足元は元マス下端に揃ったまま拡大される。
			const overlayScale = bossOverlay ? 2 : 1;
			const width = raisedBuilding ? TILE_SIZE * 2.4 : TILE_SIZE * overlayScale;
			const height = wallOverlay ? TILE_SIZE * 1.5 : (raisedBuilding ? TILE_SIZE * 2.4 : TILE_SIZE * overlayScale);

			// ダンジョンの宝箱・階段・扉は影なし。
			// NPCとボスは位置を読みやすくするため影を残す。
			if (!wallOverlay && !building && (!field.currentMapData?.isDungeon || characterOverlay || bossOverlay)) {
				addShadow(
					scene,
					px + TILE_SIZE / 2 + 4,
					py + TILE_SIZE - 2,
					bossOverlay ? 34 : 24,
					bossOverlay ? 0.28 : 0.22,
					baseDepth + 50
				);
			}

			if (!addImage(scene, key, px + TILE_SIZE / 2, py + TILE_SIZE, {
				width,
				height,
				depth: isWorldMap ? -99880 : baseDepth + (wallOverlay ? 48 : (bossOverlay ? 84 : 72))
			})) {
				const marker = scene.add.circle(
					px + TILE_SIZE / 2,
					py + TILE_SIZE / 2,
					bossOverlay ? 14 : 10,
					colorToInt(overlay.color, 0xffffff)
				);
				marker.setDepth(isWorldMap ? -99880 : baseDepth + (wallOverlay ? 48 : (bossOverlay ? 84 : 72)));
				state.worldObjects.push(marker);
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
        addShadow(scene, px + 3, py - 3, 23, 0.25, depth - 2);
        if (!addImage(scene, object.image || key, px, py, { depth })) {
            const marker = scene.add.circle(px, py - TILE_SIZE / 2, 10, color, 0.95);
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
        const margin = 10;
        const range = 7;
        const cells = range * 2 + 1;
        const cell = size / cells;
        const left = Math.max(margin, scene.scale.width - size - margin);
        const top = margin;
        const graphics = scene.add.graphics();
        graphics.setScrollFactor(0);
        graphics.setDepth(1000000);
        graphics.fillStyle(0x000000, 0.72);
        graphics.fillRect(left, top, size, size);

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
                graphics.fillRect(cellX, cellY, Math.ceil(cell), Math.ceil(cell));
                if ((dx !== 0 || dy !== 0) && typeof field.getMiniMapMarkerColor === 'function') {
                    const markerColor = field.getMiniMapMarkerColor(tile, tx, ty);
                    if (markerColor) {
                        const markerSize = Math.max(2, Math.ceil(cell * 0.46));
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
                left + (dx + range) * cell + 1,
                top + (dy + range) * cell + 1,
                Math.max(2, cell - 2),
                Math.max(2, cell - 2)
            );
        };

        const dungeonData = getApp()?.data?.dungeon;
        drawObjectMarker(dungeonData?.healSpring, 0x80ffb0);
        drawObjectMarker(dungeonData?.abyssRift, 0xa34cff);
        drawObjectMarker(dungeonData?.adventurer, 0x5bd6ff);
        drawObjectMarker(dungeonData?.trialAngel, 0xfff3a6);
        drawObjectMarker(dungeonData?.keyGuardian, 0xffd78a);
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

        if (field.currentMapData?.isDungeon && getDungeon() && typeof getDungeon().getHeldKeyOrder === 'function') {
            const keyTexture = {
                red: 'item_key_red',
                blue: 'item_key_blue',
                gold: 'item_key_gold'
            };
            getDungeon().getHeldKeyOrder().forEach((color, index) => {
                const key = keyTexture[color];
                if (!key || !scene.textures.exists(key)) return;
                const image = scene.add.image(left + size - 9 - index * 22, top + size + 15, key);
                image.setDisplaySize(18, 18);
                image.setScrollFactor(0);
                image.setDepth(1000001);
                state.uiObjects.push(image);
            });
        }
    };

    const drawAtmosphere = (scene, field) => {
        const dungeon = !!field.currentMapData?.isDungeon;
        if (!dungeon) return;

        const overlay = scene.add.rectangle(
            0,
            0,
            scene.scale.width,
            scene.scale.height,
            0x1a1028,
            0.10
        );
        overlay.setOrigin(0, 0);
        overlay.setScrollFactor(0);
        overlay.setDepth(900000);
        state.uiObjects.push(overlay);

        const light = scene.add.circle(scene.scale.width / 2, scene.scale.height / 2, 95, 0xffedbd, 0.055);
        light.setScrollFactor(0);
        light.setBlendMode(window.Phaser.BlendModes.ADD);
        light.setDepth(900001);
        state.uiObjects.push(light);
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
            dungeon.trialAngel
        ].map(object => object ? `${object.active}:${object.floor}:${object.x}:${object.y}` : '-').join('|');
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
            field.x,
            field.y,
            field.minimapMode,
            typeof field.getFieldMinimapDisplaySize === 'function' ? field.getFieldMinimapDisplaySize() : 80,
            field.currentMapData?.name || 'WORLD',
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
        const heroKey = transport === 'boat'
            ? `overlay_magic_boat_${direction}`
            : transport === 'flying'
                ? `hero_wing_${direction}_${field.step}`
                : `hero_${direction}_${field.step}`;
        if (transport !== 'boat') {
            addShadow(scene, px + 3, py - 3, 22, 0.30, Number(field.y) * 100 + 82, state.actorObjects);
        }
        if (!addImage(scene, heroKey, px, py, {
            depth: Number(field.y) * 100 + 88
        }, state.actorObjects)) {
            const hero = scene.add.circle(px, py - TILE_SIZE / 2, 10, 0xffffff);
            hero.setDepth(Number(field.y) * 100 + 88);
            state.actorObjects.push(hero);
        }
        scene.cameras.main.centerOn(px, py - TILE_SIZE / 2);
        scene.cameras.main.setRoundPixels(true);
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

        const staticSignature = getStaticSignature(field);
        if (state.lastStaticSignature === staticSignature) {
            drawPlayer(scene, field);
            return;
        }

        destroyObjects(state.worldObjects);
        destroyObjects(state.actorObjects);
        destroyObjects(state.uiObjects);
        state.waterObjects = [];

        const mapSize = getMapSize(field);
        const areaKey = field.getCurrentAreaKey();
        const range = getVisibleRange(scene);

        for (let dy = -range.y; dy <= range.y; dy++) {
            for (let dx = -range.x; dx <= range.x; dx++) {
                drawTile(scene, field, mapSize, areaKey, Number(field.x) + dx, Number(field.y) + dy);
            }
        }

        const dungeonData = getApp()?.data?.dungeon;
        const floor = getDungeon()?.floor;
        if (field.currentMapData?.isDungeon && dungeonData) {
            drawSpecialObject(scene, field, dungeonData.healSpring, 'buff-ai', 0x80ffb0, floor);
            drawSpecialObject(scene, field, dungeonData.abyssRift, 'abyss-vortex', 0xa34cff, floor);
            drawSpecialObject(scene, field, dungeonData.adventurer, null, 0x5bd6ff, floor);
            drawSpecialObject(scene, field, dungeonData.keyGuardian, null, 0xffd78a, floor);
            drawSpecialObject(scene, field, dungeonData.trialAngel, 'overlay_dungeon_trial_angel', 0xfff3a6, floor);
        }
        if (field.currentMapData?.isFixed && typeof field.getFixedHealSpringsForCurrentFloor === 'function') {
            field.getFixedHealSpringsForCurrentFloor().forEach(spring => {
                drawSpecialObject(scene, field, {
                    active: true,
                    floor,
                    x: Number(spring.x),
                    y: Number(spring.y),
                    image: getDungeon()?.healSpringImagePath || 'assets/effect/fx-buff-ai.png'
                }, 'buff-ai', 0x80ffb0, floor);
            });
        }

        drawPlayer(scene, field);
        drawAtmosphere(scene, field);
        if (field.minimapMode !== 'minimized') drawMinimap(scene, field, mapSize, areaKey);
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
                    }
                }
            });

            if (window.ResizeObserver) {
                state.resizeObserver = new ResizeObserver(() => {
                    if (!state.game || !parent.clientWidth || !parent.clientHeight) return;
                    state.game.scale.resize(parent.clientWidth, parent.clientHeight);
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
