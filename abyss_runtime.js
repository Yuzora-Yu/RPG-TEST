/* abyss_runtime.js - runtime integration for the canonical Abyss region. */
(() => {
    'use strict';

    const RULES = globalThis.ABYSS_REGION_RULES;
    if (!RULES || !globalThis.App || !globalThis.Field || !globalThis.Dungeon) return;
    const clone = value => JSON.parse(JSON.stringify(value));
    const keyOf = (area, floor, run) => `${area}:R${run}:F${floor}`;
    const isAbyssArea = area => RULES.abyssAreaKeys.has(String(area || ''));
    const flags = () => (App.data?.progress?.flags || {});
    const ensureStores = () => {
        if (!App.data.progress) App.data.progress = {};
        if (!App.data.progress.flags || typeof App.data.progress.flags !== 'object' || Array.isArray(App.data.progress.flags)) App.data.progress.flags = {};
        if (!App.data.progress.unlocked || typeof App.data.progress.unlocked !== 'object' || Array.isArray(App.data.progress.unlocked)) App.data.progress.unlocked = {};
        if (!App.data.progress.abyssProceduralFloors || typeof App.data.progress.abyssProceduralFloors !== 'object') App.data.progress.abyssProceduralFloors = {};
        if (!App.data.progress.abyssRegionRunIds || typeof App.data.progress.abyssRegionRunIds !== 'object') App.data.progress.abyssRegionRunIds = {};
        if (!App.data.progress.abyssSpiritBlessings || typeof App.data.progress.abyssSpiritBlessings !== 'object') App.data.progress.abyssSpiritBlessings = {};
        return App.data.progress;
    };

    const itemForRank = rank => {
        const candidates = (globalThis.DB?.ITEMS || globalThis.ITEMS_DATA || []).filter(item => {
            const itemRank = Number(item?.rank || 1);
            return item && Number(item.id) > 0 && itemRank <= Number(rank || 1) && item.type !== '貴重品' && Number(item.price || 0) >= 0;
        });
        return candidates[Math.floor(Math.random() * candidates.length)]?.id || 1;
    };
    const neighbors = (map, x, y) => [[1,0],[-1,0],[0,1],[0,-1]]
        .map(([dx,dy]) => ({x:x+dx,y:y+dy}))
        .filter(p => p.y >= 0 && p.y < map.length && p.x >= 0 && p.x < map[0].length && map[p.y][p.x] !== 'W');
    const farthest = (map, start) => {
        const queue=[{...start,d:0}], seen=new Set([`${start.x},${start.y}`]);
        let best=queue[0];
        for(let i=0;i<queue.length;i++){
            const current=queue[i]; if(current.d>best.d) best=current;
            neighbors(map,current.x,current.y).forEach(next=>{const k=`${next.x},${next.y}`;if(seen.has(k))return;seen.add(k);queue.push({...next,d:current.d+1});});
        }
        return {x:best.x,y:best.y};
    };
    const widenMap = (source, targetWidth = 49, targetHeight = 35) => {
        const map=Array.from({length:targetHeight},()=>Array(targetWidth).fill('W'));
        const srcH=source.length,srcW=source[0]?.length||0;
        const ox=2,oy=Math.max(2,Math.floor((targetHeight-srcH)/2));
        for(let y=0;y<srcH&&y+oy<targetHeight-1;y++)for(let x=0;x<srcW&&x+ox<targetWidth-1;x++)map[y+oy][x+ox]=source[y][x];
        // Attach a second broad chamber network to the east without replacing the generated core.
        const x1=Math.max(4,Math.floor(targetWidth*0.58)),x2=targetWidth-3,y1=3,y2=targetHeight-4;
        for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){
            const border=x===x1||x===x2||y===y1||y===y2;
            map[y][x]=border?'W':'T';
        }
        const midY=Math.floor(targetHeight/2);
        for(let x=Math.max(2,ox+srcW-3);x<=x1+2;x++)map[midY][x]='T';
        for(let y=7;y<targetHeight-7;y+=7){
            for(let x=x1+4;x<x2-3;x++) if((x+y)%7!==0) map[y][x]='W';
            map[y][x1+5]='T'; map[y][x2-4]='T';
        }
        return map;
    };
    const normalizeGeneratedMap = raw => raw.map(row => row.map(tile => {
        const upper=String(tile||'W').toUpperCase();
        if(upper==='W')return 'W';
        if(upper==='C'||upper==='R')return upper;
        return 'T';
    }));

    const generateProcedural = (areaKey, floor, template, runId) => {
        const savedDungeonObject=clone(App.data.dungeon||{});
        const savedDungeonState={floor:Dungeon.floor,width:Dungeon.width,height:Dungeon.height,map:Dungeon.map,lastGenVariant:Dungeon.lastGenVariant};
        const savedField={x:Field.x,y:Field.y,currentMapData:Field.currentMapData};
        let generated=null;
        try{
            App.data.dungeon={...savedDungeonObject};
            Dungeon.floor=Math.max(1,Number(template.encounterRank||template.rank||floor));
            const plan=Object.freeze({floor:Dungeon.floor,category:template.forceMaze?'maze':'abyss',themeId:'abyss'});
            Dungeon.buildRandomFloorLayout(plan);
            generated=normalizeGeneratedMap(Dungeon.map||[]);
            if(template.wideProcedural) generated=widenMap(generated,51,37);
        }catch(error){
            console.warn('[AbyssRegion] Existing Abyss generator failed; using validated fallback.',error);
        }finally{
            App.data.dungeon=savedDungeonObject;
            Dungeon.floor=savedDungeonState.floor;Dungeon.width=savedDungeonState.width;Dungeon.height=savedDungeonState.height;Dungeon.map=savedDungeonState.map;Dungeon.lastGenVariant=savedDungeonState.lastGenVariant;
            Field.x=savedField.x;Field.y=savedField.y;Field.currentMapData=savedField.currentMapData;
        }
        if(!Array.isArray(generated)||!generated[0]){
            const w=template.wideProcedural?51:39,h=template.wideProcedural?37:29;
            generated=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>(x===0||y===0||x===w-1||y===h-1)?'W':'T'));
            for(let y=4;y<h-4;y+=5)for(let x=3;x<w-3;x++)if((x+y)%9!==0)generated[y][x]='W';
            for(let y=2;y<h-2;y++)generated[y][Math.floor(w/2)]='T';
        }
        // Remove pre-existing stairs, choose far-apart endpoints, then add bidirectional links.
        generated.forEach(row=>row.forEach((tile,index)=>{if(tile==='S'||tile==='D'||tile==='U'||tile==='B')row[index]='T';}));
        const walk=[];generated.forEach((row,y)=>row.forEach((tile,x)=>{if(tile!=='W'&&tile!=='C'&&tile!=='R')walk.push({x,y});}));
        const seed=walk[0]||{x:1,y:1};
        const entry=farthest(generated,seed),exit=farthest(generated,entry);
        generated[entry.y][entry.x]='U';generated[exit.y][exit.x]='D';
        const chests=[];
        generated.forEach((row,y)=>row.forEach((tile,x)=>{if(tile==='C'||tile==='R')chests.push({x,y,itemId:itemForRank(template.encounterRank),type:'item',rare:tile==='R'});}));
        const floorLinks=[
            {x:entry.x,y:entry.y,toFloor:floor-1,label:'前の階へ'},
            {x:exit.x,y:exit.y,toFloor:floor+1,label:'次の階へ'}
        ];
        return {
            ...template, areaKey, floor, floorLabel:template.label||`${floor}層`, displayName:`${template.baseName||template.name||areaKey} ${template.label||`${floor}層`}`,
            width:generated[0].length,height:generated.length,tiles:generated.map(row=>row.join('')),entryPoint:entry,chests,floorLinks,
            procedural:false,generatedFromAbyssLogic:true,proceduralRunId:runId,isDungeon:true,isFixed:true,useHabitatEncounters:true,
            mapId:template.mapId||MAP_IDS?.[areaKey],floorId:template.floorId||`${MAP_IDS?.[areaKey]}-${String(floor).padStart(2,'0')}`
        };
    };

    globalThis.AbyssRegionRuntime = {
        isAbyssArea,
        ensureStores,
        getWorldKey: () => (App.data?.location?.area === 'ABYSS_WORLD' ? 'ABYSS_WORLD' : 'WORLD'),
        getProceduralFloor(areaKey,floor,template){
            const progress=ensureStores();
            if(!Number(progress.abyssRegionRunIds[areaKey])) progress.abyssRegionRunIds[areaKey]=1;
            const runId=Math.max(1,Number(progress.abyssRegionRunIds[areaKey]));
            const key=keyOf(areaKey,floor,runId);
            if(!progress.abyssProceduralFloors[key]) progress.abyssProceduralFloors[key]=generateProcedural(areaKey,floor,template,runId);
            return clone(progress.abyssProceduralFloors[key]);
        },
        beginDungeonRun(areaKey){
            const base=FIXED_DUNGEON_MAPS?.[areaKey];
            if(!base?.floors?.some(f=>f.procedural))return;
            const progress=ensureStores();
            progress.abyssRegionRunIds[areaKey]=Math.max(0,Number(progress.abyssRegionRunIds[areaKey]||0))+1;
            const prefix=`${areaKey}:`;
            Object.keys(progress.abyssProceduralFloors).filter(key=>key.startsWith(prefix)).forEach(key=>delete progress.abyssProceduralFloors[key]);
        },
        getElementModifiers(char){
            const result={}; RULES.elements.forEach(element=>{result[element]=0;});
            const currentArea=Field.getCurrentAreaKey?.()||App.data?.location?.area;
            if(currentArea==='CARMENA'&&!flags().abyssCarmenaGateCleared&&!RULES.protectedCarmenaCharacterIds.includes(Number(char?.charId))){
                RULES.elements.forEach(element=>{result[element]-=100;});
            }
            const penalty=Field.currentMapData?.elementPenalty||FIXED_DUNGEON_MAPS?.[currentArea]?.elementPenalty||null;
            if(penalty)Object.entries(penalty).forEach(([element,value])=>{result[element]=(result[element]||0)+Number(value||0);});
            const battleActive=globalThis.Battle?.active===true;
            const spiritElement=battleActive?(App.data?.battle?.abyssSpiritElement||null):null;
            if(spiritElement)result[spiritElement]=(result[spiritElement]||0)-50;
            const blessings=ensureStores().abyssSpiritBlessings;
            Object.keys(blessings).filter(element=>blessings[element]).forEach(element=>{result[element]=(result[element]||0)+20;});
            if(battleActive&&App.data?.battle?.abyssSpiritFinalBlessing){
                Object.keys(blessings).filter(element=>blessings[element]).forEach(element=>{result[element]=(result[element]||0)+30;});
            }
            return result;
        },
        updateBarrierFlags(){
            const f=flags();
            if(f.abyssLeonardDefeated&&f.abyssEliciaDefeated)f.abyssFirstBarrierCleared=true;
            if(f.abyssSyrisDefeated&&f.abyssGradDefeated)f.abyssSecondBarrierCleared=true;
        },
        migrate(){
            if(!App.data)return;
            App.data.dungeon=App.data.dungeon||{};
            App.data.location=App.data.location||{area:'WORLD',x:58,y:65};
            App.data.items=App.data.items||{};
            const progress=ensureStores(),f=flags();
            App.data.system=App.data.system||{};
            const schemaVersion=Number(App.data.system.abyssRegionSchemaVersion||0);
            if(schemaVersion>=2)return;
            // Completed old story Abyss saves remain postgame-complete. Partial old runs restart at Carmena,
            // because the former story floors no longer exist in the new canonical route.
            const oldComplete=!!(
                f.abyssAzelgaragDefeated||f.abyssEpilogueSeen||f.abyssCleared||f.abyssStoryCleared||
                Number(App.data.dungeon?.storyMaxFloor||0)>=100
            );
            if(oldComplete){
                [
                    'abyssFirstEntered','abyssCarmenaGateCleared','abyssLeonardDefeated','abyssEliciaDefeated',
                    'abyssFirstBarrierCleared','abyssSyrisDefeated','abyssGradDefeated','abyssSecondBarrierCleared',
                    'abyssLegacionNorthGateOpen','abyssVeldDefeated','abyssJasperDefeated','abyssIlluminaciaDefeated',
                    'abyssVegnasisDefeated','abyssAzelgaragDefeated','abyssEpilogueSeen','abyssRandomUnlocked',
                    'abyssDungeonMenuUnlocked'
                ].forEach(key=>{f[key]=true;});
                delete f.abyssEpiloguePending;
                App.data.progress.unlocked.dungeonMenu=true;
                App.data.dungeon.abyssMode='random';
            } else if(schemaVersion<1) {
                delete f.abyssRandomUnlocked;
                delete f.abyssDungeonMenuUnlocked;
                App.data.progress.unlocked.dungeonMenu=false;
                App.data.dungeon.abyssMode='random';
                if(App.data.location?.area==='ABYSS'){
                    f.abyssFirstEntered=true;
                    App.data.location={area:'CARMENA',x:16,y:22};
                    App.data.progress.floor=0;
                    App.data.dungeon.map=null;
                }
            }
            AbyssRegionRuntime.updateBarrierFlags();
            App.data.system.abyssRegionSchemaVersion=2;
        }
    };

    // Core runtime wrappers.
    const originalCalcStats=App.calcStats.bind(App);
    App.calcStats=(char)=>{
        const stats=originalCalcStats(char);
        const modifiers=AbyssRegionRuntime.getElementModifiers(char);
        stats.environmentalElmRes={};
        Object.entries(modifiers).forEach(([element,value])=>{if(!value)return;stats.elmRes[element]=(stats.elmRes[element]||0)+value;stats.environmentalElmRes[element]=value;});
        return stats;
    };
    App.isMonsterRecruitBattleAllowed=()=>isAbyssArea(Field.getCurrentAreaKey?.()||App.data?.location?.area);

    const originalHasMagicBoat=App.hasMagicBoat.bind(App);
    App.hasMagicBoat=()=>App.data?.location?.area==='ABYSS_WORLD'?false:originalHasMagicBoat();
    const originalIsFlying=App.isFlying.bind(App);
    App.isFlying=()=>App.data?.location?.area==='ABYSS_WORLD'?false:originalIsFlying();
    const originalUseWing=App.useLightWing?.bind(App);
    if(originalUseWing)App.useLightWing=()=>{
        if(App.data?.location?.area==='ABYSS_WORLD'){Menu?.msg?.('深淵の空間では、光の翼は力を失っている。');return false;}
        return originalUseWing();
    };
    const originalSkyTravel=App.useSkyPrismTo?.bind(App);
    if(originalSkyTravel)App.useSkyPrismTo=(areaKey)=>{
        const area=STORY_DATA?.areas?.[areaKey];
        if(area?.worldKey==='ABYSS_WORLD'||isAbyssArea(areaKey))return{ok:false,message:'深淵世界はスカイプリズムの座標に定着しない。'};
        return originalSkyTravel(areaKey);
    };
    const originalDiscoveryEntries=App.getAllFixedMapDiscoveryEntries?.bind(App);
    if(originalDiscoveryEntries)App.getAllFixedMapDiscoveryEntries=()=>originalDiscoveryEntries().filter(entry=>!isAbyssArea(entry.areaKey)&&STORY_DATA?.areas?.[entry.areaKey]?.worldKey!=='ABYSS_WORLD');

    const originalWorldProfile=App.getWorldEncounterProfile.bind(App);
    App.getWorldEncounterProfile=()=>{
        const worldKey=MapRegistry.getActiveWorldKey?.()||'WORLD';
        if(worldKey==='WORLD')return originalWorldProfile();
        if(Field.currentMapData||App.isFlying())return null;
        const zones=(window.FIELD_ENCOUNTER_ZONES||[]).filter(zone=>(zone.worldKey||'WORLD')===worldKey);
        if(!zones.length)return null;
        const x=Number(Field.x),y=Number(Field.y);
        let best=null,bestScore=Infinity;
        zones.forEach(zone=>{const dx=x-Number(zone.centerX),dy=y-Number(zone.centerY),distance=Math.sqrt(dx*dx+dy*dy),score=distance-Number(zone.priority||0)*8;if(score<bestScore){best=zone;bestScore=score;}});
        return best?{id:best.id,mapId:best.mapId,name:best.name,rank:Number(best.rank||1),monsters:best.monsters||null,rareMonsters:best.rareMonsters||null}:null;
    };

    const originalFieldArea=Field.getCurrentAreaKey.bind(Field);
    Field.getCurrentAreaKey=()=>!Field.currentMapData?(App.data?.location?.area==='ABYSS_WORLD'?'ABYSS_WORLD':'WORLD'):originalFieldArea();
    Field.getActiveWorldMap=()=>MapRegistry.getActiveWorldMap?.()||MAP_DATA;

    const originalEnterFixed=Field.enterFixedMap.bind(Field);
    Field.enterFixedMap=(areaKey,options={})=>{
        if(App.data?.location?.area==='ABYSS_WORLD')App.data.transportMode=null;
        return originalEnterFixed(areaKey,options);
    };

    const originalStartFixed=Dungeon.startFixed.bind(Dungeon);
    Dungeon.startFixed=(areaKey,options={})=>{
        const sameArea=App.data?.location?.area===areaKey;
        if(!sameArea)AbyssRegionRuntime.beginDungeonRun(areaKey);
        return originalStartFixed(areaKey,options);
    };

    const originalExecuteMapAction=Field.executeMapAction.bind(Field);
    Field.executeMapAction=(action)=>{
        if(action?.type==='abyssBlackSpring'){
            App.data.party.map(uid=>App.getChar(uid)).filter(Boolean).forEach(char=>{const s=App.calcStats(char);char.currentHp=s.maxHp;char.currentMp=s.maxMp;});
            App.log('黒い泉の静かな力が、傷と魔力を満たした。');App.save();Menu?.renderPartyBar?.();return;
        }
        if(action?.type==='abyssSpiritPrism'){
            const elements=['火','水','風','雷','光','闇'];
            const blessings=ensureStores().abyssSpiritBlessings;
            const next=elements.find(element=>!blessings[element]);
            if(!next){App.log('六つのプリズムは、認めた者へ穏やかな光を返している。');return;}
            const bossId=ABYSS_REGION_CONTENT?.spiritBossByElement?.[next];
            App.data.battle={active:false,isBossBattle:true,isSpecialBoss:false,isEstark:false,fixedBossId:bossId,abyssSpiritElement:next,bossStatMultiplier:1,suppressFixedBossDefeat:true,enemies:[]};
            App.save();App.changeScene('battle');return;
        }
        if(action?.type==='abyssPostgameCrack'){
            if(!flags().abyssEpilogueSeen){App.log('亀裂はまだ固く閉ざされている。');return;}
            if(typeof StoryManager!=='undefined'&&typeof StoryManager.executeEvent==='function'){
                StoryManager.executeEvent('abyss_postgame_crack');
            }
            return;
        }
        return originalExecuteMapAction(action);
    };

    const originalBossDefeated=Dungeon.onBossDefeated.bind(Dungeon);
    Dungeon.onBossDefeated=()=>{
        const ids=Array.isArray(App.data?.battle?.fixedBossId)?App.data.battle.fixedBossId:[App.data?.battle?.fixedBossId];
        const spiritElement=App.data?.battle?.abyssSpiritElement||null;
        originalBossDefeated();
        const f=flags();
        ids.map(Number).filter(Boolean).forEach(id=>{const flag=RULES.bossFlags[id];if(flag)f[flag]=true;});
        if(ids.includes(511030))f.abyssLeonardDefeated=true;
        if(ids.includes(511040))f.abyssEliciaDefeated=true;
        if(ids.includes(511050))f.abyssSyrisDefeated=true;
        if(ids.includes(511060))f.abyssGradDefeated=true;
        if(ids.includes(511070))f.abyssVeldDefeated=true;
        if(ids.includes(511080)){f.abyssJasperDefeated=true;App.data.items[701007]=(App.data.items[701007]||0)+1;}
        if(ids.includes(511090))f.abyssIlluminaciaDefeated=true;
        if(ids.some(id=>id>=512001&&id<=512005))f.abyssVegnasisDefeated=true;
        if(ids.includes(512100)||ids.includes(512101)){f.abyssAzelgaragDefeated=true;f.abyssEpiloguePending=true;}
        if(spiritElement){
            ensureStores().abyssSpiritBlessings[spiritElement]=true;
            const itemId=ABYSS_REGION_CONTENT?.spiritItemByElement?.[spiritElement];if(itemId)App.data.items[itemId]=(App.data.items[itemId]||0)+1;
            const all=['火','水','風','雷','光','闇'].every(element=>ensureStores().abyssSpiritBlessings[element]);
            if(all&&!App.hasItem(701008))App.data.items[701008]=1;
        }
        AbyssRegionRuntime.updateBarrierFlags();
        App.save();
    };

    // Carmena dual boss uses two map tiles but one encounter. Mark both positions cleared.
    const originalIsDefeated=Field.isFixedBossDefeatedAt?.bind(Field);
    if(originalIsDefeated)Field.isFixedBossDefeatedAt=(bossDef,x,y,key)=>{
        if(Field.getCurrentAreaKey?.()==='CARMENA'&&flags().abyssCarmenaGateCleared)return true;
        return originalIsDefeated(bossDef,x,y,key);
    };

    if (globalThis.StoryManager?.getObjectiveText) {
        const originalObjectiveText = StoryManager.getObjectiveText.bind(StoryManager);
        StoryManager.getObjectiveText = data => {
            const f = data?.progress?.flags || {};
            const currentArea = Field.getCurrentAreaKey?.() || data?.location?.area;
            const hasEnteredAbyssRegion = f.abyssFirstEntered || isAbyssArea(currentArea) || f.abyssCarmenaGateCleared;
            if (!hasEnteredAbyssRegion) return originalObjectiveText(data);
            if (!f.abyssCarmenaGateCleared) return 'カルメナ北門を守る二将を倒そう';
            if (!f.abyssLeonardDefeated || !f.abyssEliciaDefeated) return '東西の楔を倒し、第一層の結界を解こう';
            if (!f.abyssSyrisDefeated || !f.abyssGradDefeated) return 'ビスタの先で二つの楔を倒そう';
            if (!f.abyssLegacionNorthGateOpen) return 'レガシオンの謁見の間へ向かおう';
            if (!f.abyssVeldDefeated) return '夢幻回廊リドパルムの最深部へ進もう';
            if (!f.abyssJasperDefeated) return '災禍の根ジャゴレアでジャスパーを追おう';
            if (!f.abyssIlluminaciaDefeated) return '混沌の結晶片で地下神殿の封印門を開こう';
            if (!f.abyssVegnasisDefeated) return '終焉の祭壇で死幻の魔柱を倒そう';
            if (!f.abyssAzelgaragDefeated) return '深淵王アゼルガラグを倒そう';
            if (!f.abyssEpilogueSeen) return '深淵王の戦いを見届けよう';
            if (!f.abyssRandomUnlocked) return '終焉の祭壇に残った亀裂を調べよう';
            return originalObjectiveText(data);
        };
    }

    const originalLoad=typeof App.load==='function'?App.load.bind(App):null;
    if(originalLoad){
        App.load=(...args)=>{
            const result=originalLoad(...args);
            AbyssRegionRuntime.migrate();
            return result;
        };
    }
    AbyssRegionRuntime.migrate();
})();
