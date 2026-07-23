'use strict';

const fs = require('fs');
const path = require('path');
const { loadMapRuntime } = require('./validation-helpers');

const root = path.resolve(__dirname, '..', '..');
const { context } = loadMapRuntime(root);
const assetsSource = fs.readFileSync(path.join(root, 'assets.js'), 'utf8');
const graphics = {};
for (const match of assetsSource.matchAll(/^\s*([A-Za-z0-9_]+):\s*"([^"]+)"/gm)) graphics[match[1]] = match[2];

const chooseCenter = (map) => {
    const width = Number(map.width);
    const height = Number(map.height);
    let best = { x: Math.floor(width / 2), y: Math.floor(height / 2), score: -Infinity };
    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            if (String(map.tiles[y] || '')[x] !== 'W') continue;
            const edges = [[0, -1], [1, 0], [0, 1], [-1, 0]]
                .filter(([dx, dy]) => String(map.tiles[y + dy] || '')[x + dx] !== 'W').length;
            if (!edges) continue;
            const centerPenalty = Math.abs(x - width / 2) + Math.abs(y - height / 2);
            const score = edges * 100 - centerPenalty;
            if (score > best.score) best = { x, y, score };
        }
    }
    return best;
};

const inheritFloor = (base, floor) => ({
    ...base,
    ...floor,
    themeKey: floor.themeKey || base.themeKey,
    width: floor.width,
    height: floor.height,
    tiles: floor.tiles
});
const crena = context.FIXED_DUNGEON_MAPS.CRENA_LIMESTONE_CAVE;
const seabed = context.FIXED_DUNGEON_MAPS.SEABED_TEMPLE;
const samples = [
    { label: '水上都市リヴァリア', map: context.FIXED_MAPS.WATER_CITY },
    {
        label: '水上都市・錬金所 3倍表示',
        map: context.FIXED_MAPS.WATER_CITY,
        center: { x: 31, y: 5 },
        building: { x: 31, y: 3, src: `/${graphics.overlay_building_water_alchemy}`, scale: 3 }
    },
    { label: 'クレナ鍾乳洞 1階', map: inheritFloor(crena, crena.floors[0]) },
    { label: '海底神殿 深部', map: inheritFloor(seabed, seabed.floors[3]) }
].map(sample => {
    const theme = context.TILE_THEMES[sample.map.themeKey];
    const center = sample.center || chooseCenter(sample.map);
    return {
        label: sample.label,
        themeKey: sample.map.themeKey,
        rows: sample.map.tiles,
        width: sample.map.width,
        height: sample.map.height,
        center,
        water: `/${graphics[theme.W.img]}`,
        floor: `/${graphics[theme.T.img]}`,
        foam: `/${graphics.overlay_world_shore_foam}`,
        building: sample.building || null
    };
});

const payload = JSON.stringify(samples).replace(/</g, '\\u003c');
const html = `<!doctype html><meta charset="utf-8"><title>Fixed Water Shore Preview</title>
<style>
body{margin:20px;background:#10151d;color:#eef;font-family:system-ui,sans-serif}.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(490px,1fr))}.card{background:#182232;border:1px solid #43516a;padding:10px}.card h2{font-size:15px;margin:0 0 8px}canvas{width:480px;max-width:100%;image-rendering:pixelated;border:1px solid #05080d;background:#000}
</style><h1>固定マップ水際・白波確認</h1><div class="grid" id="grid"></div>
<script>
const samples=${payload}; const tile=32, viewW=15, viewH=11;
const load=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src});
Promise.all(samples.map(async sample=>{
 const [water,floor,foam,building]=await Promise.all([load(sample.water),load(sample.floor),load(sample.foam),sample.building?load(sample.building.src):Promise.resolve(null)]);
 const card=document.createElement('article');card.className='card';card.innerHTML='<h2>'+sample.label+' / '+sample.themeKey+' / 中心 '+sample.center.x+','+sample.center.y+'</h2>';
 const canvas=document.createElement('canvas');canvas.width=viewW*tile;canvas.height=viewH*tile;card.appendChild(canvas);document.getElementById('grid').appendChild(card);const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 const sx=Math.max(0,Math.min(sample.width-viewW,sample.center.x-Math.floor(viewW/2))); const sy=Math.max(0,Math.min(sample.height-viewH,sample.center.y-Math.floor(viewH/2)));
 const at=(x,y)=>String(sample.rows[y]||'')[x]||'';
 for(let y=0;y<viewH;y++)for(let x=0;x<viewW;x++){const mx=sx+x,my=sy+y,sign=at(mx,my);ctx.drawImage(sign==='W'?water:floor,x*tile,y*tile,tile,tile);}
 const edgeDefs=[[0,-1,0,0,-.5],[1,0,90,.5,0],[0,1,180,0,.5],[-1,0,270,-.5,0]];
 ctx.globalAlpha=.58;
 for(let y=0;y<viewH;y++)for(let x=0;x<viewW;x++){const mx=sx+x,my=sy+y;if(at(mx,my)!=='W')continue;for(const [dx,dy,angle,ox,oy] of edgeDefs){const neighbor=at(mx+dx,my+dy);if(!neighbor||neighbor==='W')continue;ctx.save();ctx.translate(x*tile+tile/2+ox*tile,y*tile+tile/2+oy*tile);ctx.rotate(angle*Math.PI/180);ctx.drawImage(foam,-tile/2,-4,tile,8);ctx.restore();}}
 ctx.globalAlpha=1;
 if(building){const bx=(sample.building.x-sx)*tile,by=(sample.building.y-sy)*tile,size=tile*sample.building.scale;ctx.drawImage(building,bx+tile/2-size/2,by+tile-size,size,size);}
}));
</script>`;

const outputDir = path.join(__dirname, 'generated');
fs.mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, 'fixed-water-shore-preview.html');
fs.writeFileSync(output, html, 'utf8');
console.log(output);
