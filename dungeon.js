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
	
    // --- ダンジョン突入・進行 ---
    start: (startFloor) => {
		if (!App.data.dungeon.returnPoint) {
			App.data.dungeon.returnPoint = {
				x: App.data.location.x,
				y: App.data.location.y,
				areaKey: typeof Field.getCurrentAreaKey === 'function' ? Field.getCurrentAreaKey() : 'WORLD',
                mapData: Field.currentMapData ? JSON.parse(JSON.stringify(Field.currentMapData)) : null
			};
		}

        App.data.location.area = 'ABYSS';
        App.data.progress.floor = startFloor;
        App.data.dungeon.tryCount++;
        App.data.dungeon.map = null;
        Dungeon.loadFloor();
    },
	
    // --- 固定ダンジョン（試練の洞窟など）への進入 ---
    startFixed: (mapKey) => {
        const areaDef = FIXED_DUNGEON_MAPS[mapKey];
        if (!areaDef) return;

        // 帰還地点の保存 (まだ保存されていない場合のみ)
        if (!App.data.dungeon.returnPoint) {
            App.data.dungeon.returnPoint = {
                x: App.data.location.x,
                y: App.data.location.y,
                areaKey: App.data.location.area || 'WORLD',
                mapData: Field.currentMapData ? JSON.parse(JSON.stringify(Field.currentMapData)) : null
            };
        }

        // 固定ダンジョンは1階として設定
        App.data.progress.floor = 1; 
        Dungeon.floor = 1;
        App.data.location.area = mapKey;

        // Fieldのマップデータを更新
        Field.currentMapData = { 
            ...areaDef,
            isDungeon: true,
            isFixed: true // 固定マップフラグ
        };

        // 初期座標のセット
        Field.x = areaDef.entryPoint ? areaDef.entryPoint.x : 1;
        Field.y = areaDef.entryPoint ? areaDef.entryPoint.y : 1;
        App.data.location.x = Field.x;
        App.data.location.y = Field.y;

        App.save();
        App.changeScene('field');
        App.log(`${areaDef.name}に入った。`);
    },

    nextFloor: () => {
        App.data.progress.floor++;
        App.data.dungeon.map = null; 
        Dungeon.loadFloor();
    },

    loadFloor: () => {
        const areaKey = App.data.location.area;
        // ★追加：固定ダンジョンの復元チェック
        if (typeof FIXED_DUNGEON_MAPS !== 'undefined' && FIXED_DUNGEON_MAPS[areaKey]) {
            Dungeon.floor = App.data.progress.floor || 1;
            Field.currentMapData = { 
                ...FIXED_DUNGEON_MAPS[areaKey],
                isDungeon: true,
                isFixed: true 
            };
            App.changeScene('field');
            return;
        }

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
                    // ★修正: ダンジョン進行によるリミットブレイク更新
                    // (現在の階層 - 1) + 現在のストーリー進行度
                    const storyStep = (App.data.progress && App.data.progress.storyStep) || 0;
                    hero.limitBreak = Math.max(0, Dungeon.floor - 1) + storyStep;
                }
			}
            
            Dungeon.generateFloor();
            Dungeon.saveMapData();
            App.log(`地下 ${Dungeon.floor} 階に到達した`);
        }
        
        Field.currentMapData = { 
            name: STORY_DATA.areas['ABYSS'].name,
			width: Dungeon.width, 
			height: Dungeon.height, 
			tiles: Dungeon.map, 
			isDungeon: true
        };

        App.data.location.x = Field.x;
        App.data.location.y = Field.y;

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

    // --- 脱出処理 (安全装置付き) ---
    // 引数 isWipedOut が true の場合は強制的にデフォルトへ
    exit: (isWipedOut = false) => {
        const returnPoint = App.data.dungeon.returnPoint;

        // ダンジョン一時情報のクリア
        App.data.dungeon.map = null;
        App.data.dungeon.width = 30;
        App.data.dungeon.height = 30;
        App.data.progress.floor = 0;
        
        // 保存していた帰還ポイントを一度抽出してからクリア
        App.data.dungeon.returnPoint = null;

        // デフォルトの帰還先 (ワールドマップの安全圏)
        let targetX = 58;
        let targetY = 65;
        let targetArea = 'WORLD';
        let targetMapData = null; 

        // 1. 全滅しておらず、かつ帰還データがある場合は一旦その場所を仮セット
        if (!isWipedOut && returnPoint) {
            targetX = returnPoint.x;
            targetY = returnPoint.y;
            targetArea = returnPoint.areaKey;
            targetMapData = returnPoint.mapData;
        }

        // 2. ★安全装置: 帰還先のタイルが「進行不可能」でないかチェック
        let isSafe = true;
        try {
            if (!targetMapData || targetArea === 'WORLD') {
                // ワールドマップの場合: W(海) または M(岩山) なら危険
                const tile = MAP_DATA[targetY][targetX].toUpperCase();
                if (tile === 'W' || tile === 'M') isSafe = false;
            } else {
                // 街や村（固定マップ）の場合: W(壁) なら危険
                const tile = targetMapData.tiles[targetY][targetX].toUpperCase();
                if (tile === 'W') isSafe = false;
            }
        } catch (e) {
            isSafe = false;
        }

        if (!isSafe) {
            App.log("<span style='color:#f88;'>帰還先が不安定だったため、安全な場所へ移動しました。</span>");
            targetX = 58;
            targetY = 65;
            targetArea = 'WORLD';
            targetMapData = null;
        }

        // アプリケーションデータへの反映
        App.data.location.area = targetArea;
        App.data.location.x = targetX;
        App.data.location.y = targetY;
        
        if(typeof Field !== 'undefined') {
            Field.x = targetX;
            Field.y = targetY;
            Field.currentMapData = targetMapData;
        }
        
        App.save();
        App.changeScene('field');
        
        if (isWipedOut) {
            App.log("命からがら逃げ出した……");
        } else {
            App.log("ダンジョンから脱出した");
        }
        App.clearAction();
    },
	
    // --- 移動・イベント処理 (全文) ---
    handleMove: (x, y) => {
        const tiles = (Field.currentMapData && Field.currentMapData.tiles) ? Field.currentMapData.tiles : Dungeon.map;
        const tile = tiles[y][x];
        
		//App.clearAction();

        // 宝箱判定
        if(tile === 'C') { 
            Dungeon.openChest(x, y, 'normal'); 
            return; 
        }
        if(tile === 'R') { 
            Dungeon.openChest(x, y, 'rare'); 
            return; 
        }

        // 階段・出口判定
        if(tile === 'S') {
            if (Field.currentMapData.isFixed) {
                App.log("外への出口がある。");
                App.setAction("外に出る", () => Dungeon.exit(false));
            } else {
                App.log("階段がある。");
                App.setAction("次の階へ", Dungeon.nextFloor);
            }
        } 
        
		// ★修正点: StoryManager によるアクション（イベントボス等）が既にある場合は処理を抜ける
        if (App.pendingAction) return;
		
		// ボス判定
        if(tile === 'B') {
            // ★修正: 固定ダンジョンの場合、既にボスを撃破済みなら判定をスキップする (不具合②対応)
            if (Field.currentMapData.isFixed) {
                const ak = Field.getCurrentAreaKey();
                const pk = `${x},${y}`;
                if (App.data.progress.defeatedBosses && App.data.progress.defeatedBosses[ak]?.includes(pk)) {
                    return; 
                }
            }

            App.log("ボスの気配が…");
            App.setAction("ボスと戦う", () => {
                if (App.data.battle) App.data.battle.isBossBattle = true;
                App.changeScene('battle');
            });
        } 

        // ランダムエンカウント (床タイルの場合のみ)
        if(tile === 'G' || tile === 'T') {
            if(Math.random() < 0.08) { 
                App.log("魔物が襲いかかってきた！"); 
                setTimeout(() => App.changeScene('battle'), 300); 
            }
        }
    },
	
    /* dungeon.js: Dungeon.openChest 関数 */
    openChest: async (x, y, type) => {
        const isFixed = Field.currentMapData && Field.currentMapData.isFixed;
        const areaKey = Field.getCurrentAreaKey();

        // --- 1. 固定マップ（試練の洞窟など）の処理 ---
        if (isFixed) {
            const posKey = `${x},${y}`;
            if (!App.data.progress.openedChests) App.data.progress.openedChests = {};
            if (!App.data.progress.openedChests[areaKey]) App.data.progress.openedChests[areaKey] = [];
            
            if (App.data.progress.openedChests[areaKey].includes(posKey)) return;

            const mapDef = FIXED_DUNGEON_MAPS[areaKey];
            const chestDef = mapDef.chests ? mapDef.chests.find(c => c.x === x && c.y === y) : null;

            if (chestDef) {
                App.data.progress.openedChests[areaKey].push(posKey);
                const item = DB.ITEMS.find(i => i.id === chestDef.itemId);
                if (item) {
                    App.data.items[item.id] = (App.data.items[item.id] || 0) + 1;
                    App.log(`宝箱を開けた！`);
                    App.log(`<span style="color:#ffd700;">${item.name}</span> を手に入れた！`);
                } else {
                    App.log("宝箱は空だった…");
                }
            } else {
                App.log("宝箱は空だった…");
            }
            App.save();
            Field.render(); 
            return;
        }

        // --- 2. ランダム生成ダンジョン（深淵の魔窟）の処理 ---
        Dungeon.map[y][x] = 'T'; 
        Field.render();
        
        let msg = "";
        let hasRareDrop = false, hasUltraRareDrop = false;
        const floor = Dungeon.floor;

        // ★追加: 特性「57:目利き」のパーティ合計値を算出
        let bonusNormal = 0, bonusRare = 0, bonusPlus3 = 0;
        const surviveMembers = (Battle.party || []).filter(p => !p.isDead);
        if (surviveMembers.length === 0) {
            // フィールド時などは全キャラから取得
            App.data.characters.forEach(c => {
                if (typeof PassiveSkill !== 'undefined') {
                    bonusNormal += PassiveSkill.getSumValue(c, 'drop_normal_pct');
                    bonusRare   += PassiveSkill.getSumValue(c, 'drop_rare_pct');
                    bonusPlus3  += PassiveSkill.getSumValue(c, 'equip_plus3_pct');
                }
            });
        } else {
            surviveMembers.forEach(p => {
                const charData = App.getChar(p.uid);
                if (charData && typeof PassiveSkill !== 'undefined') {
                    bonusNormal += PassiveSkill.getSumValue(charData, 'drop_normal_pct');
                    bonusRare   += PassiveSkill.getSumValue(charData, 'drop_rare_pct');
                    bonusPlus3  += PassiveSkill.getSumValue(charData, 'equip_plus3_pct');
                }
            });
        }

        if (type === 'rare') {
            // レア宝箱（赤）
            const ultraChance = 0.005 + (bonusRare / 1000);
            if (Math.random() < ultraChance) {
                const eq = Dungeon.createEquipWithMinRarity(floor, 3, ['SSR', 'UR', 'EX'], '武器');
                eq.name = eq.name.replace(/\+3$/, "") + "・改+3";
                for (let key in eq.data) {
                    if (typeof eq.data[key] === 'number') eq.data[key] *= 2;
                    else if (typeof eq.data[key] === 'object' && eq.data[key] !== null) {
                        for (let sub in eq.data[key]) eq.data[key][sub] *= 2;
                    }
                }
                eq.val *= 4; App.data.inventory.push(eq);
                msg = `なんと <span style="color:#ff00ff; font-weight:bold;">${eq.name}</span>`;
                hasUltraRareDrop = true;
            } else {
                const eq = Dungeon.createEquipWithMinRarity(floor, 3, ['SR', 'SSR', 'UR', 'EX']);
                App.data.inventory.push(eq);
                msg = `なんと <span class="log-rare-drop">${eq.name}</span>`;
                hasRareDrop = true;
            }
        } else {
            // 通常宝箱（茶）
            if (Dungeon.floor >= 100) {
                const r = Math.random() * 100;
                let sid = null;
                // 種・実のドロップ判定に補正を適用
                if (r < (0.1 + bonusRare / 10)) sid = 107; // 転生の実
                else if (r < (1.1 + bonusNormal)) sid = 106; // スキルのたね
                else if (r < (19.1 + bonusNormal)) sid = 100 + Math.floor(Math.random() * 6);
                
                if (sid) {
                    App.data.items[sid] = (App.data.items[sid] || 0) + 1;
                    const it = DB.ITEMS.find(i => i.id === sid);
                    App.log(`宝箱を開けた！`);
                    App.log(`なんと <span style="color:#ffff00;"> ${it.name} </span>を手に入れた！`);
                    if (sid === 107) {
                        const uFlash = document.getElementById('drop-flash-ultra');
                        if(uFlash) { uFlash.style.display = 'block'; uFlash.className = 'flash-ultra flash-ultra-active'; }
                    }
                    App.save(); return;
                }
            }
            
            const r = Math.random() * 100;
            if (r < (20 + bonusNormal)) {
                const item = DB.ITEMS.find(i => i.id === 99);
                if(item) { App.data.items[item.id] = (App.data.items[item.id]||0)+1; msg = `<span style="color:#ffd700;">${item.name}</span>`; }
            } else if (r < (50 + bonusNormal)) {
                const candidates = DB.ITEMS.filter(i => i.id !== 99 && i.type !== '貴重品' && i.rank <= floor);
                const item = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : DB.ITEMS[0];
                App.data.items[item.id] = (App.data.items[item.id]||0)+1; msg = `${item.name}`;
            } else if (r < (70 + bonusNormal)) {
                const gold = Math.floor(Math.random() * (500 * floor)) + 100;
                App.data.gold += gold; msg = `<span style="color:#ffff00;">${gold} Gold</span>`;
            } else {
                // 装備ドロップ判定
                let plusValue = (r < (90 + bonusNormal)) ? 1 : 2;
                
                // ★目利きの効果: 通常宝箱からでも低確率で +3 が出る
                if (Math.random() * 100 < bonusPlus3) {
                    plusValue = 3;
                    hasRareDrop = true;
                }
                
                const eq = App.createEquipByFloor('chest', floor, plusValue);
                App.data.inventory.push(eq); msg = `${eq.name}`;
            }
        }

        App.log(`宝箱を開けた！`);
        if (hasRareDrop || hasUltraRareDrop) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (hasUltraRareDrop) {
                const uFlash = document.getElementById('drop-flash-ultra') || document.getElementById('drop-flash');
                if(uFlash) { uFlash.style.display = 'block'; uFlash.className = 'flash-ultra flash-ultra-active'; }
            } else {
                const flash = document.getElementById('drop-flash');
                if(flash) { flash.style.display = 'block'; flash.classList.remove('flash-active'); void flash.offsetWidth; flash.classList.add('flash-active'); }
            }
        }
        App.log(`${msg} を手に入れた！`);
        App.save();
    },
	
    createEquipWithMinRarity: (floor, plus, minRarityList, forcePart = null) => {
        let eq = App.createEquipByFloor('drop', floor, plus);
        
        if (forcePart && eq.type !== forcePart) {
            let attempts = 0;
            while (eq.type !== forcePart && attempts < 50) {
                eq = App.createEquipByFloor('drop', floor, plus);
                attempts++;
            }
        }

        eq.opts = eq.opts.map(opt => {
            const rule = DB.OPT_RULES.find(r => r.key === opt.key);
            if (!rule) return opt;
            let r = opt.rarity;
            let att = 0;
            while (!minRarityList.includes(r) && att < 15) {
                const rarRnd = Math.random() + 0.3; 
                if(rarRnd > 0.95 && rule.allowed.includes('EX')) r='EX';
                else if(rarRnd > 0.80 && rule.allowed.includes('UR')) r='UR';
                else if(rarRnd > 0.65 && rule.allowed.includes('SSR')) r='SSR';
                else if(rarRnd > 0.45 && rule.allowed.includes('SR')) r='SR';
                else r='R';
                att++;
            }
            const min = rule.min[r]||1, max = rule.max[r]||10;
            return { ...opt, rarity: r, val: Math.floor(Math.random()*(max-min+1))+min };
        });
        return eq;
    },

    generateFloor: () => {
        Dungeon.map = [];
        
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) {
            Dungeon.generateBossRoom();
        } else {
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
				App.data.dungeon.genType = type;
			}
		}
        
        Field.currentMapData = { 
			name: STORY_DATA.areas['ABYSS'].name,
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
        Dungeon.map[2][5] = 'S'; 
        Dungeon.map[4][3] = 'R'; Dungeon.map[4][7] = 'R';
        Dungeon.map[5][5] = 'R';
        Dungeon.map[6][3] = 'R'; Dungeon.map[6][7] = 'R';

        Field.x = 5; Field.y = 8; 
        App.data.dungeon.genType = 0; 
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

        // 宝箱の数 (3〜8個)
        let chests = Math.floor(Math.random() * 6) + 3;

        for(let i=0; i<chests; i++) {
            if(floors.length === 0) break;
            const cIdx = Math.floor(Math.random() * floors.length);
            const cPos = floors[cIdx];
            Dungeon.map[cPos.y][cPos.x] = 'C'; // 通常宝箱
            floors.splice(cIdx, 1);
        }

        // 1%の確率で赤宝箱(+3確定)を配置
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
                Field.x = rx; Field.y = ry;
                App.data.location.x = rx; App.data.location.y = ry;
                return; 
            }
        }
    },

    /* dungeon.js 内の onBossDefeated 全文 */
    onBossDefeated: () => {
        App.log(`地下 ${Dungeon.floor} 階ボス撃破！ボスの気配が消えた...`);
        
        // ★修正: 固定マップの場合は撃破フラグ(座標ベース)を保存する
        if (Field.currentMapData && Field.currentMapData.isFixed) {
            const areaKey = Field.getCurrentAreaKey();
            const posKey = `${Field.x},${Field.y}`; // プレイヤーの現在座標（ボスと同じ）
            
            if (!App.data.progress.defeatedBosses) App.data.progress.defeatedBosses = {};
            if (!App.data.progress.defeatedBosses[areaKey]) App.data.progress.defeatedBosses[areaKey] = [];
            
            if (!App.data.progress.defeatedBosses[areaKey].includes(posKey)) {
                App.data.progress.defeatedBosses[areaKey].push(posKey);
            }
            
            // ★不具合①修正: 固定ダンジョンでは「次の階へ進む」ボタンを出さない
            App.clearAction();
        } else {
            // ランダムダンジョンの場合は、ボスのいた場所を階段(S)に変え、進行ボタンを出す
            Dungeon.map[Field.y][Field.x] = 'S'; 
            App.setAction("次の階へ", Dungeon.nextFloor);
        }
        
        Field.render();
        
        // 戦闘データのクリーンアップ
        if (App.data.battle) {
            App.data.battle.isBossBattle = false;
            App.data.battle.fixedBossId = null; 
        }
    }
};