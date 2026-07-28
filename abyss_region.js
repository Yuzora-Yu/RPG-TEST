/* abyss_region.js - canonical second-world, towns, dungeons, and environmental rules. */
(() => {
    'use strict';

    const MAP = globalThis.MAP_IDS || {};
    const ELEMENTS = ['火', '水', '風', '雷', '光', '闇', '混沌'];
    const ABYSS_WORLD_KEY = 'ABYSS_WORLD';

    const clone = value => JSON.parse(JSON.stringify(value));
    const grid = (width, height, fill = 'W') => Array.from({ length: height }, () => Array(width).fill(fill));
    const rows = board => board.map(row => row.join(''));
    const fillRect = (board, x1, y1, x2, y2, tile = 'T') => {
        for (let y = Math.max(0, y1); y <= Math.min(board.length - 1, y2); y++) {
            for (let x = Math.max(0, x1); x <= Math.min(board[0].length - 1, x2); x++) board[y][x] = tile;
        }
    };
    const line = (board, x1, y1, x2, y2, tile = 'T') => {
        let x = x1, y = y1;
        const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
        while (x !== x2 || y !== y2) {
            if (board[y]?.[x] !== undefined) board[y][x] = tile;
            if (x !== x2) x += dx;
            if (y !== y2) y += dy;
        }
        if (board[y]?.[x] !== undefined) board[y][x] = tile;
    };
    const room = (board, x1, y1, x2, y2, floor = 'T') => {
        fillRect(board, x1, y1, x2, y2, 'W');
        fillRect(board, x1 + 1, y1 + 1, x2 - 1, y2 - 1, floor);
    };
    const stamp = (board, x, y, tile) => { if (board[y]?.[x] !== undefined) board[y][x] = tile; };

    const buildAbyssWorld = () => {
        const width = 78, height = 64;
        const b = grid(width, height, 'W');
        const cx = 38.5, cy = 33;
        for (let y = 3; y < height - 2; y++) {
            for (let x = 3; x < width - 3; x++) {
                const nx = (x - cx) / 35;
                const ny = (y - cy) / 29;
                if (nx * nx + ny * ny <= 1) b[y][x] = 'G';
            }
        }
        // Coast irregularity and inland biomes.
        for (let y = 8; y < 58; y++) {
            for (let x = 7; x < 71; x++) {
                if (b[y][x] === 'W') continue;
                if (x < 24 && y > 35) b[y][x] = ((x + y) % 5 === 0 ? 'M' : 'L');
                else if (x > 54 && y > 35) b[y][x] = ((x * 3 + y) % 5 === 0 ? 'M' : 'F');
                else if (x < 28 && y < 31) b[y][x] = ((x + y * 2) % 4 === 0 ? 'M' : 'F');
                else if (x > 50 && y < 31) b[y][x] = ((x + y) % 3 === 0 ? 'M' : 'L');
                else if (y < 18) b[y][x] = ((x + y) % 4 === 0 ? 'M' : 'G');
            }
        }
        // Traversable roads connect every required destination.
        const road = (...points) => {
            for (let i = 1; i < points.length; i++) line(b, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], 'T');
        };
        road([39, 57], [39, 47], [18, 47], [13, 49]);
        road([39, 47], [60, 47], [66, 49]);
        road([39, 47], [39, 37], [36, 37]);
        road([42, 33], [42, 28], [20, 23], [14, 22]);
        road([42, 28], [58, 24], [64, 22]);
        road([39, 34], [39, 19]);
        road([39, 17], [39, 8]);
        road([13, 49], [9, 32]);
        road([66, 49], [70, 32]);
        road([14, 22], [9, 13]);
        road([64, 22], [69, 13]);
        // Vista is a required pass-through: a mountain wall has only the city gates.
        for (let y = 34; y <= 36; y++) {
            for (let x = 0; x < width; x++) if (b[y][x] !== 'W') b[y][x] = 'M';
        }
        stamp(b, 36, 37, 'T');
        stamp(b, 42, 33, 'T');
        // The gates are separate world-map endpoints. Crossing the wall requires entering Vista.
        // Legacion likewise blocks the entire northern land route until the castle is traversed.
        for (let x = 0; x < width; x++) if (b[18][x] !== 'W') b[18][x] = 'M';
        stamp(b, 39, 19, 'T');
        stamp(b, 39, 17, 'T');
        stamp(b, 39, 18, 'M');
        // Area anchors use walkable base tiles; overlays come from STORY_DATA.
        [[39,57],[13,49],[9,32],[66,49],[70,32],[36,37],[42,33],[14,22],[9,13],[64,22],[69,13],[39,19],[39,17],[39,8]].forEach(([x,y]) => stamp(b,x,y,'T'));
        return rows(b);
    };

    const abyssWorldTiles = buildAbyssWorld();
    globalThis.WORLD_MAPS = globalThis.WORLD_MAPS || {};
    globalThis.WORLD_MAPS.WORLD = Object.freeze({
        key: 'WORLD', name: '地上世界', mapId: MAP.WORLD || 'MAP000052', tiles: globalThis.SURFACE_WORLD_MAP_DATA || globalThis.MAP_DATA,
        bridges: globalThis.WORLD_BRIDGES || [], allowBoat: true, allowFlight: true, skyPrismEligible: true
    });
    globalThis.WORLD_MAPS.ABYSS_WORLD = Object.freeze({
        key: ABYSS_WORLD_KEY, name: '深淵世界', mapId: MAP.ABYSS_WORLD || 'MAP000053', tiles: abyssWorldTiles,
        bridges: [], allowBoat: false, allowFlight: false, skyPrismEligible: false
    });

    const areaDefs = {
        ABYSS_WORLD: { name: '深淵世界', rank: 86, worldKey: ABYSS_WORLD_KEY, mapId: MAP.ABYSS_WORLD },
        CARMENA: { name: '最果ての地カルメナ', rank: 86, worldKey: ABYSS_WORLD_KEY, centerX: 39, centerY: 57, fieldTile: { img: 'overlay_field_town', color: '#45364f' } },
        THUNDER_DUNES: { name: '雷霆砂丘', rank: 86, worldKey: ABYSS_WORLD_KEY, centerX: 13, centerY: 49, fieldTile: { img: 'overlay_field_cave', color: '#d8b44d' }, entryRequiredFlag: 'abyssCarmenaGateCleared', entryLockedText: 'カルメナの門を守る二将が、外への道を封じている。' },
        SCREAMING_CEMETERY: { name: '叫喚の墓地', rank: 86, worldKey: ABYSS_WORLD_KEY, centerX: 66, centerY: 49, fieldTile: { img: 'overlay_field_ruins', color: '#7a8d78' }, entryRequiredFlag: 'abyssCarmenaGateCleared', entryLockedText: 'カルメナの門を守る二将が、外への道を封じている。' },
        VISTA: { name: '深淵都市ビスタ', rank: 96, worldKey: ABYSS_WORLD_KEY, centerX: 36, centerY: 37, entrances: [{ x:36,y:37,entryKey:'southwest',label:'南西門' },{ x:42,y:33,entryKey:'northeast',label:'北東門' }], fieldTile: { img:'overlay_field_town', color:'#6f5c88' }, entryRequiredFlag:'abyssFirstBarrierCleared', entryLockedText:'二つの結界が都市を包み、門に触れることすらできない。' },
        FROZEN_FOREST: { name:'極寒樹林', rank:96, worldKey:ABYSS_WORLD_KEY, centerX:14,centerY:22, fieldTile:{img:'overlay_field_cave',color:'#80bfe3'}, entryRequiredFlag:'abyssFirstBarrierCleared' },
        PURGATORY_MOUNTAINS: { name:'煉獄山脈', rank:96, worldKey:ABYSS_WORLD_KEY, centerX:64,centerY:22, fieldTile:{img:'overlay_field_cave',color:'#d85b3a'}, entryRequiredFlag:'abyssFirstBarrierCleared' },
        LEGACION: { name:'混沌魔城レガシオン', rank:106, worldKey:ABYSS_WORLD_KEY, centerX:39,centerY:19, entrances:[{x:39,y:19,entryKey:'south',label:'南門'},{x:39,y:17,entryKey:'north',label:'北門',requiredFlag:'abyssLegacionNorthGateOpen',lockedText:'北門は城内から閉ざされている。皇帝家の末裔との謁見が必要だ。'}], fieldTile:{img:'overlay_field_darkcastle',color:'#54315f'}, entryRequiredFlag:'abyssSecondBarrierCleared', entryLockedText:'第二層の結界が魔城への道を閉ざしている。' },
        RIDPALM_DREAM_CORRIDOR: { name:'夢幻回廊リドパルム', rank:106, worldKey:ABYSS_WORLD_KEY, centerX:39,centerY:8, fieldTile:{img:'overlay_field_temple',color:'#8f7dff'}, entryRequiredFlag:'abyssLegacionNorthGateOpen', entryLockedText:'レガシオンの北門は閉ざされている。皇帝家の末裔に謁見する必要がある。' }
    };
    Object.assign(globalThis.STORY_DATA.areas, areaDefs);
    Object.entries(areaDefs).forEach(([key, def]) => {
        if (!def.mapId) def.mapId = MAP[key] || null;
    });

    const worldZones = [
        { id:'ABYSS_CARMENA_FIELD', worldKey:ABYSS_WORLD_KEY, mapId:MAP.CARMENA_OUTSKIRTS, name:'カルメナ周辺', rank:88, centerX:39,centerY:53,radius:20, priority:1 },
        { id:'ABYSS_VISTA_FIELD', worldKey:ABYSS_WORLD_KEY, mapId:MAP.VISTA_OUTSKIRTS, name:'ビスタ周辺', rank:98, centerX:39,centerY:32,radius:22, priority:2 },
        { id:'ABYSS_LEGACION_FIELD', worldKey:ABYSS_WORLD_KEY, mapId:MAP.LEGACION_OUTSKIRTS, name:'レガシオン周辺', rank:103, centerX:39,centerY:17,radius:20, priority:3 }
    ];
    globalThis.FIELD_ENCOUNTER_ZONES.push(...worldZones);

    const decorate = (areaKey, def, floorNo = 0) => {
        const mapId = MAP[areaKey] || def.mapId;
        def.mapId = mapId;
        def.floorId = `${mapId}-${String(floorNo).padStart(2,'0')}`;
        def.useHabitatEncounters = def.useHabitatEncounters !== false;
        return def;
    };

    const makeTown = (kind) => {
        const width = kind === 'LEGACION' ? 41 : 33;
        const height = kind === 'LEGACION' ? 33 : 25;
        const b = grid(width, height, 'W');
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        fillRect(b, 1, 1, width - 2, height - 2, 'G');

        // Main streets are the accessibility spine. Every authored building receives
        // an actual doorway connected to one of these roads; facilities are never
        // placed inside a sealed decorative room.
        line(b, centerX, 2, centerX, height - 2, 'T');
        line(b, 2, centerY, width - 3, centerY, 'T');
        room(b, 2, 2, 9, 8);
        room(b, width - 10, 2, width - 3, 8);
        room(b, 3, height - 10, 11, height - 3);
        room(b, width - 12, height - 10, width - 3, height - 3);

        const connectDoor = (doorX, doorY, roadX, roadY) => {
            stamp(b, doorX, doorY, 'T');
            line(b, doorX, doorY, roadX, roadY, 'T');
        };
        connectDoor(5, 8, 5, centerY);
        connectDoor(width - 6, 8, width - 6, centerY);
        connectDoor(7, height - 10, 7, centerY);
        connectDoor(width - 7, height - 10, width - 7, centerY);

        if (kind !== 'CARMENA') {
            room(b, 12, 4, 20, 10);
            room(b, 12, height - 11, 20, height - 4);
            connectDoor(16, 10, 16, centerY);
            connectDoor(16, height - 11, 16, centerY);
        }
        if (kind === 'LEGACION') {
            fillRect(b, 9, 2, width - 10, 14, 'W');
            room(b, 12, 3, width - 13, 13, 'T');
            stamp(b, centerX, 13, 'T');
            line(b, centerX, 13, centerX, height - 2, 'T');
        }

        stamp(b, centerX, height - 1, 'S');
        stamp(b, centerX, 1, 'S');
        if (kind === 'VISTA') {
            stamp(b, 1, height - 5, 'S');
            stamp(b, width - 2, 4, 'S');
            line(b, 1, height - 5, centerX, centerY, 'T');
            line(b, width - 2, 4, centerX, centerY, 'T');
        }
        return { width, height, tiles: rows(b) };
    };

    const carmenaLayout = makeTown('CARMENA');
    const carmenaGateY = 2;
    const carmenaCenter = Math.floor(carmenaLayout.width / 2);
    const carmenaTiles = carmenaLayout.tiles.map(row => row.split(''));
    // The southern black spring is the permanent route back to the surface. It is
    // independent of the northern gate battle.
    carmenaTiles[carmenaLayout.height - 1][carmenaCenter] = 'W';
    carmenaTiles[carmenaLayout.height - 2][carmenaCenter] = 'T';
    // A continuous gate wall prevents walking around the two visible generals.
    for (let x = 1; x <= carmenaLayout.width - 2; x++) carmenaTiles[carmenaGateY][x] = 'W';
    carmenaTiles[carmenaGateY][carmenaCenter - 1] = 'B';
    carmenaTiles[carmenaGateY][carmenaCenter + 1] = 'B';
    carmenaLayout.tiles = carmenaTiles.map(row => row.join(''));
    const carmenaBossTiles = [`${carmenaCenter - 1},${carmenaGateY}`, `${carmenaCenter + 1},${carmenaGateY}`];

    globalThis.FIXED_MAPS.CARMENA = decorate('CARMENA', {
        name:'最果ての地カルメナ', themeKey:'ABYSS_FIELD', ...carmenaLayout, entryPoint:{x:carmenaCenter,y:carmenaLayout.height-3}, battleBg:'battle_bg_abyss_boss', exitPoint:{area:ABYSS_WORLD_KEY,x:39,y:57}, worldExits:[{x:carmenaCenter,y:1,area:ABYSS_WORLD_KEY,worldX:39,worldY:57,requiredFlag:'abyssCarmenaGateCleared',lockedText:'二将が門を守っている。'}],
        mapActions:[
            {x:5,y:6,type:'inn',label:'宿に泊まる',log:'黒曜石の壁に、淡い灯がともっている。'},
            {x:carmenaLayout.width-6,y:6,type:'shop',shopType:'item',title:'カルメナ 道具屋',shopRank:90,label:'道具を買う'},
            {x:carmenaCenter,y:carmenaLayout.height-2,type:'abyssReturnSpring',label:'黒い泉から地上へ戻る',log:'黒い水面の奥に、地上へ続く光が揺れている。',imageKey:'overlay_abyss_black_spring',baseTile:'T'},
            {x:7,y:18,type:'storyEvent',eventId:'abyss_carmena_resident',label:'住人と話す',imageKey:'overlay_npc_villager',baseTile:'G'}
        ],
        bosses:[
            {x:carmenaCenter-1,y:carmenaGateY,monsterId:[302001,302000],mapSpriteMonsterId:302001,actionLabel:'二将に挑む',challengeText:'グレン将軍とレオン将軍が同時に武器を構えた。\n二人を相手に戦いますか？',storyEventId:'abyss_carmena_gate_clear',sharedEncounterTiles:carmenaBossTiles},
            {x:carmenaCenter+1,y:carmenaGateY,monsterId:[302001,302000],mapSpriteMonsterId:302000,actionLabel:'二将に挑む',challengeText:'レオン将軍とグレン将軍が同時に武器を構えた。\n二人を相手に戦いますか？',storyEventId:'abyss_carmena_gate_clear',sharedEncounterTiles:carmenaBossTiles}
        ]
    });

    const vistaLayout = makeTown('VISTA');
    const vistaTiles = vistaLayout.tiles.map(row => row.split(''));
    const vistaCenter = Math.floor(vistaLayout.width / 2);
    vistaTiles[1][vistaCenter] = 'W';
    vistaTiles[vistaLayout.height - 1][vistaCenter] = 'W';
    vistaLayout.tiles = vistaTiles.map(row => row.join(''));
    globalThis.FIXED_MAPS.VISTA = decorate('VISTA', {
        name:'深淵都市ビスタ', themeKey:'DARK_CASTLE', ...vistaLayout, entryPoint:{x:2,y:vistaLayout.height-5}, entryPoints:{southwest:{x:2,y:vistaLayout.height-5},northeast:{x:vistaLayout.width-3,y:4}}, battleBg:'battle_bg_field', exitPoint:{area:ABYSS_WORLD_KEY,x:36,y:37}, worldExits:[{x:1,y:vistaLayout.height-5,area:ABYSS_WORLD_KEY,worldX:36,worldY:37},{x:vistaLayout.width-2,y:4,area:ABYSS_WORLD_KEY,worldX:42,worldY:33}],
        mapActions:[
            {x:5,y:6,type:'storyEvent',eventId:'abyss_vista_recruitment_guide',label:'住人と話す',imageKey:'overlay_npc_villager',baseTile:'T'},
            {x:vistaLayout.width-6,y:6,type:'shop',shopType:'item',title:'ビスタ 初級技法書店',shopRank:35,itemIds:[600101,600119,600200,600202,600300,600400],label:'技法書を見る'},
            {x:6,y:vistaLayout.height-6,type:'inn',label:'宿に泊まる'},
            {x:vistaLayout.width-7,y:vistaLayout.height-6,type:'shop',shopType:'item',title:'ビスタ 道具屋',shopRank:100,label:'道具を買う'}
        ]
    });

    const legacionLayout = makeTown('LEGACION');
    const lc = Math.floor(legacionLayout.width/2);
    globalThis.FIXED_MAPS.LEGACION = decorate('LEGACION', {
        name:'混沌魔城レガシオン', themeKey:'DARK_CASTLE', ...legacionLayout, entryPoint:{x:lc,y:legacionLayout.height-3}, entryPoints:{south:{x:lc,y:legacionLayout.height-3},north:{x:lc,y:2}}, battleBg:'battle_bg_lastboss', exitPoint:{area:ABYSS_WORLD_KEY,x:39,y:19}, worldExits:[{x:lc,y:legacionLayout.height-1,area:ABYSS_WORLD_KEY,worldX:39,worldY:19},{x:lc,y:1,area:ABYSS_WORLD_KEY,worldX:39,worldY:17,requiredFlag:'abyssLegacionNorthGateOpen',lockedText:'北門はまだ閉ざされている。'}],
        mapActions:[
            {x:5,y:legacionLayout.height-7,type:'blacksmith',label:'鍛冶を頼む'},
            {x:legacionLayout.width-6,y:legacionLayout.height-7,type:'alchemy',label:'錬金を行う'},
            {x:7,y:18,type:'guild',label:'冒険者ギルドへ'},
            {x:legacionLayout.width-8,y:18,type:'storyEvent',eventId:'abyss_legacion_arena_notice',label:'格闘場を見る',imageKey:'overlay_npc_villager',baseTile:'T'},
            {x:lc,y:8,type:'fixedMap',target:'LEGACION_THRONE',returnX:lc,returnY:9,label:'二階へ上がる'},
            {x:lc-7,y:11,type:'fixedMap',target:'LEGACION_PRISON',returnX:lc-7,returnY:12,label:'地下牢へ下りる'},
            {x:lc+7,y:11,type:'fixedMap',target:'LEGACION_TEMPLE',returnX:lc+7,returnY:12,label:'地下神殿へ下りる'}
        ]
    });


    const makeLegacionInterior = (width, height, chamber = 'hall') => {
        const b = grid(width,height,'W');
        room(b,1,1,width-2,height-2,'T');
        if(chamber==='prison'){
            for(let x=4;x<width-4;x+=6){room(b,x,3,Math.min(width-3,x+4),8,'G');room(b,x,height-9,Math.min(width-3,x+4),height-4,'G');}
            line(b,Math.floor(width/2),2,Math.floor(width/2),height-2,'T');
        }else if(chamber==='temple'){
            room(b,5,3,width-6,height-5,'T');
            for(let y=6;y<height-6;y+=4){stamp(b,7,y,'M');stamp(b,width-8,y,'M');}
            line(b,Math.floor(width/2),height-2,Math.floor(width/2),4,'T');
        }else{
            room(b,4,3,width-5,height-5,'T');
            fillRect(b,Math.floor(width/2)-4,4,Math.floor(width/2)+4,7,'G');
            line(b,Math.floor(width/2),height-2,Math.floor(width/2),7,'T');
        }
        stamp(b,Math.floor(width/2),height-1,'S');
        return {width,height,tiles:rows(b),entryPoint:{x:Math.floor(width/2),y:height-3}};
    };

    const prisonLayout=makeLegacionInterior(31,21,'prison');
    globalThis.FIXED_MAPS.LEGACION_PRISON=decorate('LEGACION_PRISON',{
        name:'混沌魔城レガシオン 地下牢',themeKey:'DARK_CASTLE',...prisonLayout,battleBg:'battle_bg_lastboss',exitPoint:{area:'LEGACION',x:lc-7,y:12},
        mapActions:[
            {x:8,y:6,type:'storyEvent',eventId:'abyss_legacion_prison',label:'牢内を調べる',baseTile:'G'},
            {x:22,y:14,type:'storyEvent',eventId:'abyss_legacion_prison',label:'囚人と話す',imageKey:'overlay_npc_villager',baseTile:'G'}
        ]
    });

    const templeLayout=makeLegacionInterior(33,23,'temple');
    globalThis.FIXED_MAPS.LEGACION_TEMPLE=decorate('LEGACION_TEMPLE',{
        name:'混沌魔城レガシオン 地下神殿',themeKey:'DARK_CASTLE',...templeLayout,battleBg:'battle_bg_lastboss',exitPoint:{area:'LEGACION',x:lc+7,y:12},
        mapActions:[
            {x:Math.floor(templeLayout.width/2),y:5,type:'fixedDungeon',target:'CHRONO_ABYSS',requiredItemId:701007,requiredItemMissingText:'封印門は、混沌の核を求めている。',label:'封印門を開く'}
        ]
    });

    const throneLayout=makeLegacionInterior(35,23,'throne');
    const throneCenter=Math.floor(throneLayout.width/2);
    globalThis.FIXED_MAPS.LEGACION_THRONE=decorate('LEGACION_THRONE',{
        name:'混沌魔城レガシオン 二階謁見の間',themeKey:'DARK_CASTLE',...throneLayout,battleBg:'battle_bg_lastboss',exitPoint:{area:'LEGACION',x:lc,y:9},
        mapActions:[
            {x:throneCenter,y:6,type:'storyEvent',eventId:'abyss_legacion_audience',label:'皇帝家の末裔と話す',imageKey:'overlay_npc_villager',baseTile:'G'},
            {x:throneCenter-7,y:11,type:'storyEvent',eventId:'abyss_legacion_priest',label:'神官と話す',imageKey:'overlay_npc_villager',baseTile:'T'},
            {x:throneCenter+7,y:11,type:'abyssSpiritPrism',label:'プリズムに触れる',log:'六つの色が、こちらの意志を測るように明滅している。'}
        ]
    });

    const staticDungeon = ({name, areaKey, rank, width=39, height=27, direction='vertical', nextDungeon=null, element=null, battleBg='battle_bg_dungeon'}) => {
        const b = grid(width,height,'W');
        // Multiple rooms, loops and alternate paths; fixed maps are authored, not simple corridors.
        room(b,2,2,12,10); room(b,width-13,2,width-3,10); room(b,2,height-11,14,height-3); room(b,width-15,height-12,width-3,height-3);
        room(b,Math.floor(width/2)-5,Math.floor(height/2)-4,Math.floor(width/2)+5,Math.floor(height/2)+4);
        line(b,7,9,Math.floor(width/2),Math.floor(height/2),'T');
        line(b,width-8,9,Math.floor(width/2),Math.floor(height/2),'T');
        line(b,8,height-10,Math.floor(width/2),Math.floor(height/2),'T');
        line(b,width-9,height-11,Math.floor(width/2),Math.floor(height/2),'T');
        const entry = direction==='eastwest' ? {x:width-4,y:Math.floor(height/2)} : direction==='southwest-ne' ? {x:4,y:height-4} : {x:Math.floor(width/2),y:height-4};
        const goal = direction==='eastwest' ? {x:3,y:Math.floor(height/2)} : direction==='southwest-ne' ? {x:width-4,y:3} : {x:Math.floor(width/2),y:3};
        line(b,entry.x,entry.y,Math.floor(width/2),Math.floor(height/2),'T');
        line(b,goal.x,goal.y,Math.floor(width/2),Math.floor(height/2),'T');
        stamp(b,entry.x,entry.y,'S'); stamp(b,goal.x,goal.y,'D');
        const def = {name,themeKey:areaKey,useDungeonWallFace:true,rank,encounterRank:rank,width,height,tiles:rows(b),entryPoint:entry,battleBg,isDungeon:true,isFixed:true,elementPenalty:element ? {[element]:-50}:null,
            floorLinks:[{x:entry.x,y:entry.y,to:'EXIT',label:'外へ戻る'},{x:goal.x,y:goal.y,toDungeon:nextDungeon,label:'奥へ進む'}].filter(link=>link.to==='EXIT'||link.toDungeon)};
        return decorate(areaKey,def,1);
    };

    globalThis.FIXED_DUNGEON_MAPS.THUNDER_DUNES = staticDungeon({name:'雷霆砂丘',areaKey:'THUNDER_DUNES',rank:88,nextDungeon:'BLACK_ROPE_PYRAMID',element:'雷'});
    globalThis.FIXED_DUNGEON_MAPS.SCREAMING_CEMETERY = staticDungeon({name:'叫喚の墓地',areaKey:'SCREAMING_CEMETERY',rank:88,nextDungeon:'MAGIC_WIND_MAUSOLEUM',element:'風'});

    const makeHorizontalPair = ({name,areaKey,rank,nextDungeon,element,direction}) => {
        const first = staticDungeon({name,areaKey,rank,nextDungeon:null,element,direction});
        const second = clone(first);
        second.floorLabel='西域'; second.entryPoint = direction==='eastwest'?{x:first.width-4,y:Math.floor(first.height/2)}:{x:4,y:first.height-4};
        // Floor 1 links to floor2, floor2 links back and then to next dungeon.
        first.floorLabel='東域';
        first.floorLinks[1] = {...first.floorLinks[1],toDungeon:null,toFloor:2,label:'さらに奥へ'};
        second.floorLinks = [
            {x:second.entryPoint.x,y:second.entryPoint.y,toFloor:1,targetX:first.floorLinks[1].x,targetY:first.floorLinks[1].y,label:'前の区域へ'},
            {x:direction==='eastwest'?3:first.width-4,y:direction==='eastwest'?Math.floor(first.height/2):3,toDungeon:nextDungeon,label:'最深部へ'}
        ];
        return decorate(areaKey,{name,themeKey:areaKey,useDungeonWallFace:true,rank,encounterRank:rank,battleBg:first.battleBg,isDungeon:true,isFixed:true,elementPenalty:{[element]:-50},floors:[first,second]},1);
    };
    globalThis.FIXED_DUNGEON_MAPS.FROZEN_FOREST = makeHorizontalPair({name:'極寒樹林',areaKey:'FROZEN_FOREST',rank:98,nextDungeon:'ICE_PENANCE_ROAD',element:'水',direction:'eastwest'});
    globalThis.FIXED_DUNGEON_MAPS.PURGATORY_MOUNTAINS = makeHorizontalPair({name:'煉獄山脈',areaKey:'PURGATORY_MOUNTAINS',rank:98,nextDungeon:'SCORCHING_OLD_CASTLE',element:'火',direction:'southwest-ne'});

    const makeFixedFloor = ({areaKey,name,floor,total,rank,entrySide='south',goalSide='north',boss=null,nextDungeon=null,elementPenalty=null,battleBg='battle_bg_dungeon'}) => {
        const width=37,height=27,b=grid(width,height,'W');
        room(b,2,2,13,11); room(b,width-14,2,width-3,11); room(b,3,height-12,15,height-3); room(b,width-16,height-12,width-3,height-3);
        fillRect(b,15,9,21,18,'T');
        line(b,7,10,18,13,'T'); line(b,width-8,10,18,13,'T'); line(b,9,height-11,18,15,'T'); line(b,width-10,height-11,18,15,'T');
        const sidePoint = side => side==='south'?{x:18,y:height-4}:side==='north'?{x:18,y:3}:side==='west'?{x:3,y:13}:{x:width-4,y:13};
        const entry=sidePoint(entrySide),goal=sidePoint(goalSide);
        line(b,entry.x,entry.y,18,13,'T'); line(b,goal.x,goal.y,18,13,'T');
        stamp(b,entry.x,entry.y,floor===1?'S':'U');
        stamp(b,goal.x,goal.y,boss?'B':'D');
        const links=[];
        if(floor===1) links.push({x:entry.x,y:entry.y,to:'EXIT',label:'外へ戻る'}); else links.push({x:entry.x,y:entry.y,toFloor:floor-1,label:'前の階へ'});
        if(!boss) {
            links.push(nextDungeon?{x:goal.x,y:goal.y,toDungeon:nextDungeon,label:'奥へ進む'}:{x:goal.x,y:goal.y,toFloor:floor+1,label:'次の階へ'});
        } else if(nextDungeon) {
            const dx = goalSide === 'west' ? -1 : (goalSide === 'east' ? 1 : 0);
            const dy = goalSide === 'north' ? -1 : (goalSide === 'south' ? 1 : 0);
            const linkPoint = { x: goal.x + dx, y: goal.y + dy };
            stamp(b, linkPoint.x, linkPoint.y, 'D');
            links.push({x:linkPoint.x,y:linkPoint.y,toDungeon:nextDungeon,label:'さらに奥へ進む',requiredFlag:boss.unlockFlag||null,lockedLog:'倒したはずの魔力が道を閉ざしている。'});
        }
        return {label:`${floor}層`,floor,rank,encounterRank:rank,width,height,tiles:rows(b),entryPoint:entry,battleBg,themeKey:areaKey,useDungeonWallFace:true,isDungeon:true,isFixed:true,elementPenalty,
            floorLinks:links,bosses:boss?[{x:goal.x,y:goal.y,monsterId:boss.id,actionLabel:boss.label||'対峙する',challengeText:boss.challengeText||`${boss.name}に挑みますか？`,storyEventId:boss.storyEventId||null}]:[]};
    };

    const makeHybridDungeon = ({areaKey,name,total,rankLow,rankHigh,elementPenalty,boss,nextDungeon=null,procStart=2,procEnd=total-1,mazeFloors=[],battleBg='battle_bg_dungeon',descending=false}) => {
        const floors=[];
        for(let floor=1;floor<=total;floor++){
            const rank=floor<=3?rankLow:rankHigh;
            if(floor>=procStart && floor<=procEnd){
                floors.push({label:`${floor}層`,floor,procedural:true,forceMaze:mazeFloors.includes(floor),wideProcedural:total<=6&&rankLow>=106,rank,encounterRank:rank,themeKey:areaKey,battleBg,useDungeonWallFace:true,isDungeon:true,isFixed:true,elementPenalty});
            }else{
                floors.push(makeFixedFloor({areaKey,name,floor,total,rank,entrySide:descending?'north':'south',goalSide:descending?'south':'north',boss:floor===total?boss:null,nextDungeon:floor===total?nextDungeon:null,elementPenalty,battleBg}));
            }
        }
        return decorate(areaKey,{name,themeKey:areaKey,rank:rankLow,encounterRank:rankLow,battleBg,useDungeonWallFace:true,isDungeon:true,isFixed:true,elementPenalty,floors},1);
    };

    Object.assign(globalThis.FIXED_DUNGEON_MAPS, {
        BLACK_ROPE_PYRAMID: makeHybridDungeon({areaKey:'BLACK_ROPE_PYRAMID',name:'黒縄のピラミッド',total:6,rankLow:91,rankHigh:95,elementPenalty:{雷:-50},boss:{id:302010,name:'黒雷のレナード',storyEventId:'abyss_leonard_clear'}}),
        MAGIC_WIND_MAUSOLEUM: makeHybridDungeon({areaKey:'MAGIC_WIND_MAUSOLEUM',name:'魔風の霊廟',total:6,rankLow:91,rankHigh:95,elementPenalty:{風:-50},boss:{id:302020,name:'死風のエリシア',storyEventId:'abyss_elicia_clear'},descending:true}),
        ICE_PENANCE_ROAD: makeHybridDungeon({areaKey:'ICE_PENANCE_ROAD',name:'氷刻の浄罪路',total:6,rankLow:101,rankHigh:105,elementPenalty:{水:-50},boss:{id:302030,name:'極零のシーリス',storyEventId:'abyss_syris_clear'},descending:true}),
        SCORCHING_OLD_CASTLE: makeHybridDungeon({areaKey:'SCORCHING_OLD_CASTLE',name:'灼熱の古城',total:6,rankLow:101,rankHigh:105,elementPenalty:{火:-50},boss:{id:302040,name:'焦熱のグラド',storyEventId:'abyss_grad_clear'}}),
        RIDPALM_DREAM_CORRIDOR: makeHybridDungeon({areaKey:'RIDPALM_DREAM_CORRIDOR',name:'夢幻回廊リドパルム',total:6,rankLow:106,rankHigh:110,elementPenalty:{光:-50,闇:-50},boss:{id:302050,name:'昏迷の黒騎士ヴェルド',storyEventId:'abyss_veld_clear',unlockFlag:'abyssVeldDefeated'},nextDungeon:'JAGOREA_ROOT',procStart:2,procEnd:5,mazeFloors:[3],descending:true}),
        JAGOREA_ROOT: makeHybridDungeon({areaKey:'JAGOREA_ROOT',name:'災禍の根ジャゴレア',total:5,rankLow:111,rankHigh:115,elementPenalty:{光:-50,闇:-50},boss:{id:302060,name:'妄執の神官ジャスパー',storyEventId:'abyss_jasper_clear'},procStart:2,procEnd:4,descending:true}),
        CHRONO_ABYSS: makeHybridDungeon({areaKey:'CHRONO_ABYSS',name:'次元牢獄クロノアビス',total:7,rankLow:116,rankHigh:120,elementPenalty:{混沌:-50},boss:{id:302070,name:'混沌姫イルミナシア',storyEventId:'abyss_illuminacia_clear',unlockFlag:'abyssIlluminaciaDefeated'},nextDungeon:'FINAL_ALTAR',procStart:2,procEnd:6,descending:true})
    });

    // Final Altar: large authored map, two consecutive boss encounters.
    const altar = grid(49,35,'W');
    room(altar,2,23,46,33,'T'); room(altar,7,12,41,24,'T'); room(altar,13,2,35,13,'T');
    line(altar,24,32,24,5,'T');
    fillRect(altar,18,14,30,21,'T');
    stamp(altar,24,33,'S'); stamp(altar,24,17,'B'); stamp(altar,24,6,'B');
    globalThis.FIXED_DUNGEON_MAPS.FINAL_ALTAR = decorate('FINAL_ALTAR', {
        name:'終焉の祭壇',themeKey:'SUMMIT_TEMPLE',rank:125,encounterRank:125,width:49,height:35,tiles:rows(altar),entryPoint:{x:24,y:32},battleBg:'battle_bg_lastboss',useDungeonWallFace:true,isDungeon:true,isFixed:true,disableRandomEncounters:true,
        floorLinks:[{x:24,y:33,to:'EXIT',label:'クロノアビスへ戻る'}],
        bosses:[
            {x:24,y:17,monsterId:[302080,302081,302082,302083,302084],clearedFlag:'abyssVegnasisDefeated',actionLabel:'魔柱に挑む',challengeText:'五つの魂が絡み合う死幻の魔柱に挑みますか？',storyEventId:'abyss_vegnasis_clear'},
            {x:24,y:6,monsterId:302100,requiredFlag:'abyssVegnasisDefeated',clearedFlag:'abyssAzelgaragDefeated',actionLabel:'深淵王に挑む',challengeText:'深淵王アゼルガラグが祭壇の最奥で待っている。\n連戦を覚悟して挑みますか？',storyEventId:'abyss_azelgarag_clear'}
        ],
        mapActions:[{x:24,y:4,type:'abyssPostgameCrack',requiredFlag:'abyssAzelgaragDefeated',label:'さらに深い亀裂を調べる',log:'祭壇の奥に、底の知れない亀裂が広がっている。'}]
    },1);

    // Ensure every newly registered floor receives stable map/floor IDs.
    Object.entries(globalThis.FIXED_MAPS).forEach(([key,def]) => {
        if (!['CARMENA','VISTA','LEGACION'].includes(key)) return;
        decorate(key,def,0);
    });
    Object.entries(globalThis.FIXED_DUNGEON_MAPS).forEach(([key,base]) => {
        if (!MAP[key] || !base) return;
        base.mapId=MAP[key]; base.floorId=`${MAP[key]}-01`; base.useHabitatEncounters=true;
        (base.floors||[]).forEach((floor,index)=>{floor.mapId=MAP[key];floor.floorId=`${MAP[key]}-${String(index+1).padStart(2,'0')}`;floor.useHabitatEncounters=true;});
    });

    const buildProceduralFallbackFloor = (areaKey, floorNo, template) => {
        const width = template?.wideProcedural ? 51 : 39;
        const height = template?.wideProcedural ? 37 : 29;
        const board = grid(width, height, 'W');
        fillRect(board, 1, 1, width - 2, height - 2, 'T');
        for (let y = 5; y < height - 4; y += 6) {
            for (let x = 3; x < width - 3; x++) if ((x + y) % 8 !== 0) board[y][x] = 'W';
            stamp(board, Math.floor(width / 2), y, 'T');
        }
        const entry = { x: Math.floor(width / 2), y: height - 3 };
        const exit = { x: Math.floor(width / 2), y: 2 };
        stamp(board, entry.x, entry.y, 'U');
        stamp(board, exit.x, exit.y, 'D');
        return {
            ...template,
            areaKey,
            floor:Number(floorNo),
            width,
            height,
            tiles:rows(board),
            entryPoint:entry,
            floorLinks:[
                {x:entry.x,y:entry.y,toFloor:Number(floorNo)-1,label:'前の階へ'},
                {x:exit.x,y:exit.y,toFloor:Number(floorNo)+1,label:'次の階へ'}
            ],
            procedural:false,
            generatedFromAbyssLogic:true,
            isDungeon:true,
            isFixed:true
        };
    };

    const originalGetFixedFloor = globalThis.MapRegistry.getFixedDungeonFloor.bind(globalThis.MapRegistry);
    const originalNormalizeWorldPoint = globalThis.MapRegistry.normalizeWorldPoint.bind(globalThis.MapRegistry);
    const originalGetWorldAreaAt = globalThis.MapRegistry.getWorldAreaAt.bind(globalThis.MapRegistry);
    const originalGetWorldBridgeAt = globalThis.MapRegistry.getWorldBridgeAt.bind(globalThis.MapRegistry);

    Object.assign(globalThis.MapRegistry, {
        getActiveWorldKey() {
            const location = globalThis.App?.data?.location || {};
            const areaKey = String(location.area || 'WORLD');
            const explicit = String(location.worldKey || '').toUpperCase();
            const areaWorld = String(globalThis.STORY_DATA?.areas?.[areaKey]?.worldKey || '').toUpperCase();
            if (explicit === ABYSS_WORLD_KEY || areaKey === ABYSS_WORLD_KEY || areaWorld === ABYSS_WORLD_KEY) return ABYSS_WORLD_KEY;
            return 'WORLD';
        },
        getWorldDefinition(worldKey = null) {
            return globalThis.WORLD_MAPS?.[worldKey || this.getActiveWorldKey()] || globalThis.WORLD_MAPS?.WORLD || null;
        },
        getActiveWorldMap() { return this.getWorldDefinition()?.tiles || globalThis.SURFACE_WORLD_MAP_DATA || globalThis.MAP_DATA; },
        normalizeWorldPoint(x,y) {
            const active=this.getActiveWorldMap();
            if(!Array.isArray(active)||!active[0]) return originalNormalizeWorldPoint(x,y);
            const width=active[0].length,height=active.length;
            return {x:((Number(x)%width)+width)%width,y:((Number(y)%height)+height)%height};
        },
        getWorldBridgeAt(x,y) {
            const point=this.normalizeWorldPoint(x,y);
            const bridges=this.getWorldDefinition()?.bridges || [];
            return bridges.find(bridge=>Number(bridge.x)===point.x&&Number(bridge.y)===point.y)||null;
        },
        getWorldSurfaceAt(x,y) {
            const point=this.normalizeWorldPoint(x,y),map=this.getActiveWorldMap();
            const tile=String(map?.[point.y]?.[point.x]||'W').toUpperCase();
            const bridge=this.getWorldBridgeAt(point.x,point.y);
            return {x:point.x,y:point.y,tile,bridge,isBridge:!!bridge,isSea:tile==='W'&&!bridge};
        },
        getWorldAreaAt(x,y) {
            const activeKey=this.getActiveWorldKey();
            const point=this.normalizeWorldPoint(x,y);
            for(const [key,area] of Object.entries(globalThis.STORY_DATA?.areas||{})){
                const worldKey=area.worldKey||'WORLD';
                if(worldKey!==activeKey) continue;
                if(Array.isArray(area.entrances)){
                    const entrance=area.entrances.find(pos=>Number(pos.x)===point.x&&Number(pos.y)===point.y);
                    if(entrance) return [key,{...area,centerX:point.x,centerY:point.y,_entryKey:entrance.entryKey||null,_entryLabel:entrance.label||null}];
                }
                if(Number(area.centerX)===point.x&&Number(area.centerY)===point.y) return [key,{...area,_entryKey:area.defaultEntryKey||null}];
            }
            return activeKey==='WORLD'?originalGetWorldAreaAt(x,y):null;
        },
        getFixedDungeonFloor(areaKey,floorNo=1){
            const baseResult=originalGetFixedFloor(areaKey,floorNo);
            if(!baseResult?.procedural) return baseResult;
            if(globalThis.AbyssRegionRuntime?.getProceduralFloor) return globalThis.AbyssRegionRuntime.getProceduralFloor(areaKey,Number(floorNo),baseResult);
            return buildProceduralFallbackFloor(areaKey, Number(floorNo), baseResult);
        }
    });

    globalThis.ABYSS_REGION_RULES = Object.freeze({
        worldKey:ABYSS_WORLD_KEY,
        elements:Object.freeze(ELEMENTS),
        protectedCarmenaCharacterIds:Object.freeze([306,402,401]),
        abyssAreaKeys:Object.freeze(new Set(['ABYSS_WORLD','CARMENA','VISTA','LEGACION','LEGACION_PRISON','LEGACION_TEMPLE','LEGACION_THRONE','THUNDER_DUNES','SCREAMING_CEMETERY','BLACK_ROPE_PYRAMID','MAGIC_WIND_MAUSOLEUM','FROZEN_FOREST','PURGATORY_MOUNTAINS','ICE_PENANCE_ROAD','SCORCHING_OLD_CASTLE','RIDPALM_DREAM_CORRIDOR','JAGOREA_ROOT','CHRONO_ABYSS','FINAL_ALTAR','ABYSS'])),
        bossFlags:Object.freeze({302001:'abyssCarmenaGateCleared',302000:'abyssCarmenaGateCleared',302010:'abyssLeonardDefeated',302020:'abyssEliciaDefeated',302030:'abyssSyrisDefeated',302040:'abyssGradDefeated',302050:'abyssVeldDefeated',302060:'abyssJasperDefeated',302070:'abyssIlluminaciaDefeated',302080:'abyssVegnasisDefeated',302100:'abyssAzelgaragDefeated',302101:'abyssAzelgaragDefeated'})
    });
})();
