(function (global) {
    'use strict';

    const TEXTILE_STYLES = Object.freeze({
        castle_carpet: Object.freeze({ keyPrefix: 'overlay_castle_carpet', edgeSize: 4 }),
        castle_carpet_blue_silver: Object.freeze({ keyPrefix: 'overlay_castle_carpet_blue_silver', edgeSize: 4 }),
        village_goza: Object.freeze({ keyPrefix: 'overlay_village_goza', edgeSize: 3 })
    });

    const stableHash = (...parts) => {
        const text = parts.join(':');
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    };

    const tileAt = (map, x, y) => String(map?.tiles?.[Number(y)] || '')[Number(x)] || '';

    const resolveTileVariant = (config, tileX, tileY) => {
        if (!Array.isArray(config?.variants) || !config.variants.length || tileX === null || tileY === null) return config;
        const x = Number(tileX) || 0;
        const y = Number(tileY) || 0;
        let hash = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
        hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
        const index = ((hash ^ (hash >>> 16)) >>> 0) % config.variants.length;
        return { ...config, img: config.variants[index] || config.img };
    };

    const fixedFloorDecorationsAt = (map, tileX, tileY) => {
        const definitions = map?.floorDecorations;
        if (!Array.isArray(definitions)) return [];
        return definitions.filter(definition => {
            const x = Number(definition?.x);
            const y = Number(definition?.y);
            const width = Math.max(1, Number(definition?.width || 1));
            const height = Math.max(1, Number(definition?.height || 1));
            return tileX >= x && tileX < x + width && tileY >= y && tileY < y + height;
        });
    };

    const textileCellPlan = (definition, tileX, tileY) => {
        const style = TEXTILE_STYLES[definition?.type];
        if (!style) return null;
        const startX = Number(definition.x);
        const startY = Number(definition.y);
        const endX = startX + Math.max(1, Number(definition.width || 1)) - 1;
        const endY = startY + Math.max(1, Number(definition.height || 1)) - 1;
        const open = {
            n: tileY === startY,
            s: tileY === endY,
            w: tileX === startX,
            e: tileX === endX
        };
        const keys = [`${style.keyPrefix}_fill`];
        if (open.n) keys.push(`${style.keyPrefix}_edge_n`);
        if (open.s) keys.push(`${style.keyPrefix}_edge_s`);
        if (open.w) keys.push(`${style.keyPrefix}_edge_w`);
        if (open.e) keys.push(`${style.keyPrefix}_edge_e`);
        if (open.n && open.w) keys.push(`${style.keyPrefix}_corner_nw`);
        if (open.n && open.e) keys.push(`${style.keyPrefix}_corner_ne`);
        if (open.s && open.w) keys.push(`${style.keyPrefix}_corner_sw`);
        if (open.s && open.e) keys.push(`${style.keyPrefix}_corner_se`);
        return { style, startX, startY, endX, endY, open, keys };
    };

    const elevatedEdgeCellPlan = ({ map, definition, x, y, tileSign, tileAtFn = null }) => {
        if (!definition) return null;
        const terrain = new Set((definition.terrainTiles || ['T']).map(value => String(value).toUpperCase()));
        const voids = new Set((definition.voidTiles || []).map(value => String(value).toUpperCase()));
        if (!terrain.has(String(tileSign || '').toUpperCase()) || !voids.size) return null;
        const readTile = (tileX, tileY) => String(tileAtFn
            ? tileAtFn(tileX, tileY)
            : tileAt(map, tileX, tileY)).toUpperCase();
        const open = {
            n: voids.has(readTile(Number(x), Number(y) - 1)),
            e: voids.has(readTile(Number(x) + 1, Number(y))),
            s: voids.has(readTile(Number(x), Number(y) + 1)),
            w: voids.has(readTile(Number(x) - 1, Number(y)))
        };
        if (!Object.values(open).some(Boolean)) return null;

        const thickness = Math.max(2, Math.min(16, Number(definition.thickness || 6)));
        const join = Math.max(0, Math.min(4, Number(definition.joinOverlap ?? 1)));
        const corner = Math.max(join, Math.min(16, Number(definition.cornerOverhang ?? thickness)));
        const edges = [];
        const horizontal = (id, offsetY) => {
            if (!open[id]) return;
            const before = open.w ? corner : join;
            const after = open.e ? corner : join;
            edges.push({ id, x: -before, y: offsetY, width: 32 + before + after, height: thickness });
        };
        const vertical = (id, offsetX) => {
            if (!open[id]) return;
            const before = open.n ? corner : join;
            const after = open.s ? corner : join;
            edges.push({ id, x: offsetX, y: -before, width: thickness, height: 32 + before + after });
        };
        horizontal('n', -thickness);
        horizontal('s', 32);
        vertical('w', -thickness);
        vertical('e', 32);
        edges.forEach(edge => { edge.key = definition.keys?.[edge.id] || ''; });
        return { open, thickness, join, corner, edges: edges.filter(edge => edge.key) };
    };

    const floorDecorationPlan = ({ themes, themeKey, areaKey, floor, x, y, tileSign = null }) => {
        const normalizedTheme = String(themeKey || 'DEFAULT').toUpperCase();
        const config = themes?.[normalizedTheme] || themes?.DEFAULT || null;
        const keys = (Array.isArray(config?.keys) ? config.keys : [config?.key]).filter(Boolean);
        if (!keys.length || config.disabled) return null;
        const allowedTiles = Array.isArray(config.allowedTiles)
            ? config.allowedTiles.map(sign => String(sign || '').toUpperCase())
            : null;
        if (allowedTiles && !allowedTiles.includes(String(tileSign || '').toUpperCase())) return null;
        if (Number.isFinite(Number(config.minY)) && Number(y) < Number(config.minY)) return null;
        if (Number.isFinite(Number(config.maxY)) && Number(y) > Number(config.maxY)) return null;
        const frequency = Math.max(1, Number(config.frequency || 40));
        const hash = stableHash(normalizedTheme, areaKey || normalizedTheme, floor || 0, x, y, keys.join('|'));
        if (hash % frequency !== 0) return null;
        return {
            key: keys[(hash >>> 11) % keys.length],
            alpha: Number(config.alpha ?? 1),
            animate: config.animate || null,
            flipX: ((hash >>> 4) & 1) === 1,
            angle: (((hash >>> 8) % 3) - 1) * 3,
            hash
        };
    };

    const worldDecorationPlan = ({ map, bridges, x, y, tileSign, tileAtFn = null }) => {
        const upper = String(tileSign || '').toUpperCase();
        const bridge = (bridges || []).find(item => Number(item?.x) === Number(x) && Number(item?.y) === Number(y));
        if (bridge) return { kind: 'bridge', key: 'overlay_world_bridge_wood', direction: bridge.direction || 'horizontal' };
        const hash = stableHash('WORLD-DECOR', x, y, upper);
        const variant = (keys, frequency, size, alpha, layer = 'over') => {
            if (hash % frequency !== 0) return null;
            const list = Array.isArray(keys) ? keys : [keys];
            return {
                kind: 'detail', key: list[(hash >>> 11) % list.length], size, alpha, layer,
                flipX: ((hash >>> 4) & 1) === 1,
                angle: (((hash >>> 8) % 3) - 1) * 3
            };
        };
        if (upper === 'G' || upper === 'T') return variant(['overlay_world_grass_detail', 'overlay_world_grass_weeds', 'overlay_world_grass_earth'], 24, 23 / 32, 0.78);
        if (upper === 'F') return variant(['overlay_world_forest_understory', 'overlay_world_forest_roots'], 10, 26 / 32, 0.75, 'under');
        if (upper === 'L') return variant('overlay_world_foothill_rocks', 10, 27 / 32, 0.72, 'under');
        if (upper !== 'W') return null;
        const edges = [
            { dx: 0, dy: -1, angle: 0, offsetX: 0, offsetY: -0.5 },
            { dx: 1, dy: 0, angle: 90, offsetX: 0.5, offsetY: 0 },
            { dx: 0, dy: 1, angle: 180, offsetX: 0, offsetY: 0.5 },
            { dx: -1, dy: 0, angle: 270, offsetX: -0.5, offsetY: 0 }
        ].filter(edge => {
            const neighbor = String(tileAtFn
                ? tileAtFn(Number(x) + edge.dx, Number(y) + edge.dy)
                : tileAt(map, Number(x) + edge.dx, Number(y) + edge.dy)).toUpperCase();
            return !!neighbor && neighbor !== 'W';
        });
        return edges.length ? { kind: 'shore', key: 'overlay_world_shore_foam', edges, alpha: 0.58 } : null;
    };

    const wallFacePlan = ({ map, theme, x, y, upper, entityType, tileAtFn = null }) => {
        if (entityType !== 'dungeon' || String(upper).toUpperCase() !== 'W') return null;
        const wallConfig = theme?.W || {};
        if (wallConfig.lowerLayer === true || wallConfig.animatedWater === true) return null;
        const wallTheme = map?.wallFaceTheme || {};
        if (wallTheme.disabled) return null;
        const below = String(tileAtFn ? tileAtFn(x, Number(y) + 1) : tileAt(map, x, Number(y) + 1)).toUpperCase();
        if (below === 'W') return null;
        const key = map?.wallFaceImg || wallTheme.img || '';
        if (!key) return null;
        const accentKey = map?.wallFaceTorchImg || wallTheme.accentImg || '';
        const accentEvery = Math.max(1, Number(wallTheme.accentEvery || 5));
        const useAccent = !!accentKey && (((Number(x) % accentEvery) + accentEvery) % accentEvery === 0);
        return { key: useAccent ? accentKey : key, mode: map?.wallFaceMode || wallTheme.mode || 'replace' };
    };

    global.MapRenderShared = Object.freeze({
        TEXTILE_STYLES,
        stableHash,
        tileAt,
        resolveTileVariant,
        fixedFloorDecorationsAt,
        textileCellPlan,
        elevatedEdgeCellPlan,
        floorDecorationPlan,
        worldDecorationPlan,
        wallFacePlan
    });
})(typeof window !== 'undefined' ? window : globalThis);
