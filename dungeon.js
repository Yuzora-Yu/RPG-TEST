/* dungeon.js (完全統合版: 赤宝箱・出現ロジック・101階対応) */

const Dungeon = {
    floor: 0, width: 30, height: 30, map: [], pendingAction: null,
    

    // --- ダンジョン突入・進行 ---
enter: () => {
        if (typeof Menu !== 'undefined') Menu.closeAll();
        
        // ダンジョン内での脱出判定
        if (Field.currentMapData && Field.currentMapData.isDungeon) {
            const isBossFloor = Dungeon.floor > 0 && Dungeon.floor % 10 === 0;
            if (isBossFloor && Dungeon.map[Field.y][Field.x] === 'B') {
                App.log("今は逃げられない！ボスを倒すしかない！");
                return;
            }
            App.log("ダンジョンから脱出しますか？");
            App.setAction("脱出する", Dungeon.exit);
            return;
        }

        const maxF = App.data.dungeon.maxFloor || 0;
        const choices = [{ label: "1階から", callback: () => Dungeon.start(1) }];

        // 特定のチェックポイント (51, 101, 151)
        [51, 101, 151,201,251,301].forEach(checkpoint => {
            if (maxF >= checkpoint) {
                choices.push({ 
                    label: `${checkpoint}階から`, 
                    callback: () => Dungeon.start(checkpoint) 
                });
            }
        });

        // 10階ごとの最新チェックポイント（既にリストにある場合は除外）
        const latestCheckpoint = Math.floor((maxF - 1) / 10) * 10 + 1;
        if (latestCheckpoint > 1 && !choices.some(c => c.label.includes(`${latestCheckpoint}階`))) {
            choices.push({ 
                label: `${latestCheckpoint}階から (最新)`, 
                callback: () => Dungeon.start(latestCheckpoint) 
            });
        }

	// ★追加: 3. 最高到達階から直接開始する選択肢 (これで110階などが表示されます)
		if (maxF > 1 && !choices.some(c => c.label.includes(`${maxF}階`))) {
			choices.push({ 
				label: `${maxF}階から (最高到達)`, 
				callback: () => Dungeon.start(maxF) 
			});
		}

        // 選択肢が2つ以上ある場合はリストを表示、1つなら即開始
        if (choices.length > 1) {
            Menu.listChoice(
                `ダンジョンに入ります。\n(最高到達階層: ${maxF}階)`,
                choices
            );
        } else {
            Dungeon.start(1);
        }
    },
    start: (startFloor) => {
        App.data.progress.floor = startFloor;
        App.data.dungeon.tryCount++;
        App.data.dungeon.map = null;
        Dungeon.loadFloor();
    },

    nextFloor: () => {
        App.data.progress.floor++;
        App.data.dungeon.map = null; 
        Dungeon.loadFloor();
    },

    loadFloor: () => {
        Dungeon.floor = App.data.progress.floor;
        
        if (App.data.dungeon.map) {
            Dungeon.map = App.data.dungeon.map;
            Dungeon.width = App.data.dungeon.width;
            Dungeon.height = App.data.dungeon.height;
            App.log(`地下 ${Dungeon.floor} 階の冒険を再開します。`);
        } else {
            if(Dungeon.floor > App.data.dungeon.maxFloor) {
                App.data.dungeon.maxFloor = Dungeon.floor;
                const hero = App.getChar('p1');
                if(hero) {
                    hero.limitBreak = Math.max(0, Dungeon.floor - 1);
                }
            }
            
            Dungeon.generateFloor();
            Dungeon.saveMapData();
            App.log(`地下 ${Dungeon.floor} 階に到達した`);
        }
        
        Field.currentMapData = { 
            width: Dungeon.width, 
            height: Dungeon.height, 
            tiles: Dungeon.map, 
            isDungeon: true 
        };
        App.changeScene('field');
        
        if (App.data.battle) App.data.battle.isBossBattle = false;
        App.clearAction();
    },

    saveMapData: () => {
        App.data.dungeon.map = Dungeon.map;
        App.data.dungeon.width = Dungeon.width;
        App.data.dungeon.height = Dungeon.height;
        App.save();
    },

    exit: () => {
        // ダンジョン情報をクリア
        App.data.dungeon.map = null;
        App.data.dungeon.width = 30;
        App.data.dungeon.height = 30;

        Field.currentMapData = null;
        
        const targetX = 23;
        const targetY = 28; 
        
        App.data.location.x = targetX;
        App.data.location.y = targetY;
        App.data.progress.floor = 0;
        
        if(typeof Field !== 'undefined') {
            Field.x = targetX;
            Field.y = targetY;
        }
        
        App.save();
        App.changeScene('field');
        App.log("フィールドに戻った");
        App.clearAction();
    },
    
    // --- 移動・イベント処理 ---
    handleMove: (x, y) => {
        const tile = Dungeon.map[y][x];
        App.clearAction();

        if(tile === 'C') { 
            Dungeon.openChest(x, y, 'normal'); // 通常宝箱
            return; 
        }
        if(tile === 'R') { 
            Dungeon.openChest(x, y, 'rare');   // 赤宝箱(+3確定)
            return; 
        }

        if(tile === 'S') {
            App.log("階段がある。");
            App.setAction("次の階へ", Dungeon.nextFloor);
        } else if(tile === 'B') {
            App.log("ボスの気配がする…");
            App.setAction("ボスと戦う", () => {
                if (App.data.battle) App.data.battle.isBossBattle = true;
                // Boss戦はBattle.start内で Dungeon.getEnemy(floor) を呼び出してボスを取得する想定
                App.changeScene('battle');
            });
        } 
        
        if (tile === 'S' || tile === 'B') {
            return;
        }

        // ランダムエンカウント
        if(Math.random() < 0.08) { 
            App.log("魔物が襲いかかってきた！"); 
            setTimeout(() => App.changeScene('battle'), 300); 
        }
    },

    openChest: (x, y, type) => {
        Dungeon.map[y][x] = 'T'; 
        Field.render();
        
        let msg = "";

        if (type === 'rare') {
            // ★赤宝箱: +3装備確定
            const eq = App.createRandomEquip('chest', Dungeon.floor, 3);
            if(App.checkSynergy(eq)) eq.isSynergy = true;
            App.data.inventory.push(eq);
            msg = `なんと <span style="color:#ff4444; font-weight:bold;"> ${eq.name}</span>`;
            
            // レア演出用フラッシュ
            const flash = document.getElementById('drop-flash');
            if(flash) {
                flash.style.display = 'block'; 
                flash.classList.remove('flash-active');
                void flash.offsetWidth; 
                flash.classList.add('flash-active');
            }

        } else {
            // ★通常宝箱: 確率分岐
            // メダル20% | アイテム30% | GOLD20% | +1装備20% | +2装備10%
            const r = Math.random(); 
            
            if (r < 0.2) {
                // メダル (20%)
                const item = DB.ITEMS.find(i => i.id === 99);
                if(item) {
                    msg = item.name;
                    App.data.items[item.id] = (App.data.items[item.id]||0)+1;
                }
            } else if (r < 0.5) {
                // ★修正: 抽選時に「貴重品」を除外
                const candidates = DB.ITEMS.filter(i => i.id !== 99 && i.type !== '貴重品');
                if (candidates.length > 0) {
                    const item = candidates[Math.floor(Math.random() * candidates.length)];
                    msg = item.name;
                    App.data.items[item.id] = (App.data.items[item.id]||0)+1;
                } else {
                    msg = "空っぽ";
                }
            } else if (r < 0.7) {
                // GOLD (20%)
                const gold = Math.floor(Math.random() * (500 * Dungeon.floor)) + 100;
                App.data.gold += gold;
                msg = `${gold} G`;
            } else if (r < 0.9) {
                // +1装備 (20%)
                const eq = App.createRandomEquip('chest', Dungeon.floor, 1);
                App.data.inventory.push(eq);
                msg = `${eq.name}`;
            } else {
                // +2装備 (10%)
                const eq = App.createRandomEquip('chest', Dungeon.floor, 2);
                App.data.inventory.push(eq);
                msg = `${eq.name}`;
            }
        }
        
        App.log(`${msg} を手に入れた！`);
        App.save();
    },

    // --- マップ生成ロジック ---
    generateFloor: () => {
        Dungeon.map = [];
        
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) {
            Dungeon.generateBossRoom();
        } else {
            // ★追加: 2%の確率でレア宝物庫フロア
            if (Math.random() < 0.02) {
                Dungeon.generateTreasureRoom();
            } else {
				const r = Math.random();
				let type;
				if (r < 0.05) type = 2; // 迷路
				else if (r < 0.55) type = 0; // 部屋
				else type = 1; // 洞窟
				
				if (type === 0) Dungeon.generateRoomMap(); 
				else if (type === 1) Dungeon.generateCaveMap(); 
				else Dungeon.generateMazeMap(); 
				
				Dungeon.setPlayerRandomSpawn();
				// ★追加: 生成タイプを保存 (0,1は通常、2は迷路として扱うため記録)
				App.data.dungeon.genType = type;
			}
		}
        
        Field.currentMapData = { 
            width: Dungeon.width, 
            height: Dungeon.height, 
            tiles: Dungeon.map, 
            isDungeon: true 
        };
        App.data.location.x = Field.x;
        App.data.location.y = Field.y;
    },

    generateBossRoom: () => {
        const w = 11, h = 11; 
        Dungeon.width = w; Dungeon.height = h;
        for(let y=0; y<h; y++) {
            let row = [];
            for(let x=0; x<w; x++) { 
                if(x===0||x===w-1||y===0||y===h-1) row.push('W'); 
                else row.push('T'); 
            }
            Dungeon.map.push(row);
        }
        Dungeon.map[5][5] = 'B';
        Field.x = 5; Field.y = 8;
    },
	
	/**
     * レア宝箱が5つある特別な小部屋
     */
    generateTreasureRoom: () => {
        App.log(`<span style="color:#ffd700; font-weight:bold;">隠し部屋を見つけた！</span>`);
        const w = 11, h = 11; 
        Dungeon.width = w; Dungeon.height = h;
        for(let y=0; y<h; y++) {
            let row = [];
            for(let x=0; x<w; x++) { 
                if(x===0||x===w-1||y===0||y===h-1) row.push('W'); 
                else row.push('T'); 
            }
            Dungeon.map.push(row);
        }
        // 階段の配置
        Dungeon.map[2][5] = 'S'; 
        // レア宝箱5つの配置
        Dungeon.map[4][3] = 'R'; Dungeon.map[4][7] = 'R';
        Dungeon.map[5][5] = 'R';
        Dungeon.map[6][3] = 'R'; Dungeon.map[6][7] = 'R';

        Field.x = 5; Field.y = 8; // プレイヤーの開始位置
        App.data.dungeon.genType = 0; // 通常フロア扱い
    },

    generateRoomMap: () => {
        Dungeon.width = 30; Dungeon.height = 30;
        const w = Dungeon.width, h = Dungeon.height;
        let map = Array(h).fill(0).map(() => Array(w).fill('W'));
        const rooms = [];
        const roomCount = 5 + Math.min(5, Math.floor(Dungeon.floor/5));
        
        for (let i = 0; i < roomCount; i++) {
            const rw = Math.floor(Math.random() * 6) + 4;
            const rh = Math.floor(Math.random() * 6) + 4;
            const rx = Math.floor(Math.random() * (w - rw - 2)) + 1;
            const ry = Math.floor(Math.random() * (h - rh - 2)) + 1;
            
            let overlap = false;
            for(let r of rooms) {
                if(rx < r.x + r.w + 1 && rx + rw + 1 > r.x && ry < r.y + r.h + 1 && ry + rh + 1 > r.y) {
                    overlap = true; break;
                }
            }
            if(overlap) continue;

            for (let y = ry; y < ry + rh; y++) {
                for (let x = rx; x < rx + rw; x++) { map[y][x] = 'T'; }
            }
            rooms.push({x:rx, y:ry, w:rw, h:rh, cx:Math.floor(rx+rw/2), cy:Math.floor(ry+rh/2)});
        }
        
        for(let i=0; i<rooms.length-1; i++) { Dungeon.connectRooms(map, rooms[i], rooms[i+1]); }
        Dungeon.map = map;
        Dungeon.placeStairsAndChests();
    },

    generateCaveMap: () => {
        Dungeon.width = 30; Dungeon.height = 30;
        const w = Dungeon.width, h = Dungeon.height;
        let map = Array(h).fill(0).map(() => Array(w).fill('W'));
        
        let floorCount = 0; 
        const targetFloors = 250 + Math.random() * 100;
        let miners = [{x:Math.floor(w/2), y:Math.floor(h/2)}];
        map[Math.floor(h/2)][Math.floor(w/2)] = 'T';

        while(floorCount < targetFloors && miners.length > 0) {
            const mIdx = Math.floor(Math.random() * miners.length);
            const miner = miners[mIdx];
            
            const dir = Math.floor(Math.random() * 4);
            let dx=0, dy=0; 
            if(dir===0)dy=-1; if(dir===1)dy=1; if(dir===2)dx=-1; if(dir===3)dx=1;
            const nx = miner.x + dx, ny = miner.y + dy;
            
            if(nx>1 && nx<w-2 && ny>1 && ny<h-2) {
                miner.x = nx; miner.y = ny;
                if(map[ny][nx] === 'W') {
                    map[ny][nx] = 'T';
                    floorCount++;
                }
                if(Math.random() < 0.02) miners.push({x:nx, y:ny});
            }
        }
        Dungeon.map = map;
        Dungeon.placeStairsAndChests();
    },

    generateMazeMap: () => {
        Dungeon.width = 25; Dungeon.height = 25;
        const w = Dungeon.width, h = Dungeon.height;
        let map = Array(h).fill(0).map(() => Array(w).fill('W'));

        const startX = 1, startY = 1;
        const stack = [{x:startX, y:startY}];
        map[startY][startX] = 'T';

        while(stack.length > 0) {
            const current = stack[stack.length - 1];
            const dirs = [[0,-2], [0,2], [-2,0], [2,0]];
            for(let i=dirs.length-1; i>0; i--){
                const r = Math.floor(Math.random()*(i+1));
                [dirs[i], dirs[r]] = [dirs[r], dirs[i]];
            }
            
            let dug = false;
            for(let d of dirs) {
                const nx = current.x + d[0];
                const ny = current.y + d[1];
                if(nx>0 && nx<w && ny>0 && ny<h && map[ny][nx] === 'W') {
                    map[ny][nx] = 'T'; 
                    map[current.y + d[1]/2][current.x + d[0]/2] = 'T';
                    stack.push({x:nx, y:ny});
                    dug = true;
                    break;
                }
            }
            if(!dug) stack.pop();
        }
        
        for(let i=0; i<60; i++) { 
            const rx = Math.floor(Math.random()*(w-2))+1;
            const ry = Math.floor(Math.random()*(h-2))+1;
            if(map[ry][rx] === 'W') map[ry][rx] = 'T';
        }

        Dungeon.map = map;
        Dungeon.placeStairsAndChests();
    },

    connectRooms: (map, r1, r2) => {
        let x = r1.cx, y = r1.cy;
        while(x !== r2.cx) {
            if(map[y][x] === 'W') map[y][x] = 'T';
            x += (x < r2.cx) ? 1 : -1;
        }
        while(y !== r2.cy) {
            if(map[y][x] === 'W') map[y][x] = 'T';
            y += (y < r2.cy) ? 1 : -1;
        }
        map[y][x] = 'T';
    },

    placeStairsAndChests: () => {
        let floors = [];
        for(let y=0; y<Dungeon.height; y++) {
            for(let x=0; x<Dungeon.width; x++) {
                if(Dungeon.map[y][x] === 'T') floors.push({x,y});
            }
        }
        
        if(floors.length === 0) return;

        // 階段
        const sIdx = Math.floor(Math.random() * floors.length);
        const sPos = floors[sIdx];
        Dungeon.map[sPos.y][sPos.x] = 'S';
        floors.splice(sIdx, 1);

        // ★修正: 宝箱の数 (3〜8個)
        let chests = Math.floor(Math.random() * 6) + 3;

        for(let i=0; i<chests; i++) {
            if(floors.length === 0) break;
            const cIdx = Math.floor(Math.random() * floors.length);
            const cPos = floors[cIdx];
            Dungeon.map[cPos.y][cPos.x] = 'C'; // 通常宝箱
            floors.splice(cIdx, 1);
        }

        // ★追加: 1%の確率で赤宝箱(+3確定)を配置
        if (Math.random() < 0.01 && floors.length > 0) {
            const rIdx = Math.floor(Math.random() * floors.length);
            const rPos = floors[rIdx];
            Dungeon.map[rPos.y][rPos.x] = 'R'; // 赤宝箱
            floors.splice(rIdx, 1);
        }
    },
    
    setPlayerRandomSpawn: () => {
        for(let i=0; i<1000; i++) { 
            const rx = Math.floor(Math.random() * Dungeon.width);
            const ry = Math.floor(Math.random() * Dungeon.height);
            if(Dungeon.map[ry][rx] === 'T') { 
                Field.x = rx; Field.y = ry; return; 
            }
        }
    },

    onBossDefeated: () => {
        App.log(`地下 ${Dungeon.floor} 階ボス撃破！階段が出現した。`);
        Dungeon.map[Field.y][Field.x] = 'S'; 
        Field.render();
        App.setAction("次の階へ", Dungeon.nextFloor);
        if (App.data.battle) App.data.battle.isBossBattle = false;
    }
};
