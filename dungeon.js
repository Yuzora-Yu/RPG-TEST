/* dungeon.js (完全統合版: 赤宝箱・出現ロジック・101階対応) */

const Dungeon = {
    floor: 0, width: 30, height: 30, map: [], pendingAction: null,

    // ランダム生成ダンジョン内の特殊オブジェクト設定。
    // タイル文字を増やすと既存の宝箱/階段/エンカウント処理に影響しやすいため、
    // 冒険者・回復の泉・深淵の裂け目は App.data.dungeon.* で別管理する。
    // 迷路マップ(genType === 2)だけは検証・メリハリ用に全特殊オブジェクトを100%出現させる。
    adventurerSpawnRate: 0.10,
    adventurerImagePath: 'assets/monsters/monster_100009.png',
    adventurerPromptOpen: false,

    // 回復の泉: 通常フロアでは5%、迷路では100%。
    // 触れただけでは回復せず、アクションボタン押下で初めて回復する。
    healSpringSpawnRate: 0.05,
    healSpringImagePath: 'assets/effect/fx-buff-ai.png',

    // 深淵の裂け目: 通常フロアでは10%、迷路では100%。
    // 勝利後報酬のため、戦闘時の eventId はこの定数に統一する。
    abyssRiftSpawnRate: 0.10,
    abyssRiftImagePath: 'assets/effect/fx-abyss-vortex-ai.png',
    abyssRiftPromptOpen: false,
    riftBattleEventId: '__DUNGEON_ABYSS_RIFT__',

    // 溶岩フロア: 50階以降の通常マップで30%発生。
    // 発生時は通常宝箱を消し、床の25%を溶岩(M)にしてレア宝箱を2つだけ配置する。
    // Mは通行可能だが、踏むたびに最大HPの3%ダメージを受ける。
    lavaFloorMinFloor: 50,
    lavaFloorSpawnRate: 0.30,
    lavaTileImagePath: 'assets/map/objects/magma.png',
    lavaBattleBgKey: 'battle_bg_fire',
    
	getEntryChoices: () => {
		const maxF = App.data.dungeon.maxFloor || 0;

		const choices = [];
		const usedFloors = new Set();

		const addChoice = (floor, label, latest = false) => {
			if (!floor || usedFloors.has(floor)) return;
			choices.push({
				label,
				floor,
				latest
			});
			usedFloors.add(floor);
		};

		const latestCheckpoint = maxF > 1
			? Math.floor((maxF - 1) / 10) * 10 + 1
			: 1;

		// 1. 最新階層だけ最上部に表示
		if (latestCheckpoint > 1) {
			addChoice(
				latestCheckpoint,
				`${latestCheckpoint}階から (最新)`,
				true
			);
		}

		// 2. その下に1階から
		addChoice(1, "1階から", false);

		// 3. さらに下に主要チェックポイント
		for (let checkpoint = 51; checkpoint <= maxF; checkpoint += 50) {
			addChoice(
				checkpoint,
				`${checkpoint}階から`,
				false
			);
		}

		return choices;
	},

	initMenu: () => {
		const sub = document.getElementById('sub-screen-dungeon');
		if (!sub) return;

		sub.style.display = 'flex';
		sub.style.flexDirection = 'column';

		Dungeon.renderMenu();
	},

	renderMenu: () => {
		const content = document.getElementById('dungeon-menu-content');
		if (!content) return;

		const maxF = App.data.dungeon?.maxFloor || 0;
		const tryCount = App.data.dungeon?.tryCount || 0;
		const isInDungeon = Field.currentMapData && Field.currentMapData.isDungeon;
		const isBossFloor = isInDungeon && Dungeon.floor > 0 && Dungeon.floor % 10 === 0;
		const isOnBossTile = isInDungeon && Dungeon.map?.[Field.y]?.[Field.x] === 'B';
		const cannotExit = isBossFloor && isOnBossTile;

		if (isInDungeon) {
			content.innerHTML = `
				<div style="max-width:420px; margin:0 auto; display:flex; flex-direction:column; gap:14px;">
					<div style="font-size:22px; color:#ffd700; text-align:center; margin-bottom:4px;">探索中のダンジョン</div>

					<div style="border:1px solid rgba(244,201,93,0.48); border-radius:8px; padding:14px; background:rgba(255,255,255,0.04); line-height:1.6;">
						<div style="font-size:12px; color:#aaa;">現在地</div>
						<div style="font-size:20px; color:#fff; font-weight:bold;">地下 ${Dungeon.floor || App.data.progress.floor || 1} 階</div>
						<div style="font-size:11px; color:#aaa; margin-top:8px;">
							ダンジョン探索中です。脱出すると地上へ戻ります。
						</div>
					</div>

					<button class="menu-btn"
						style="width:100%; min-height:52px; ${cannotExit ? 'opacity:0.45;' : ''}"
						${cannotExit ? 'disabled' : ''}
						onclick="Dungeon.exitFromMenu()">
						${cannotExit ? '今は脱出できない' : 'ダンジョンから脱出する'}
					</button>

					${cannotExit ? `<div style="font-size:11px; color:#f88; text-align:center;">ボスを倒すまで脱出できません。</div>` : ''}
				</div>
			`;
			return;
		}

		const choices = Dungeon.getEntryChoices();

		const choiceHtml = choices.map(c => `
			<button class="menu-btn dungeon-entry-card"
				style="width:100%; min-height:58px; display:flex; flex-direction:column; align-items:flex-start; text-align:left;"
				onclick="Dungeon.startFromMenu(${c.floor})">
				<div style="font-size:16px; font-weight:bold; color:#fff;">${c.label}</div>
				<div style="font-size:10px; color:#aaa; margin-top:3px;">
					${c.floor === 1 ? '最初から挑戦します' : `地下 ${c.floor} 階から再開します`}
				</div>
			</button>
		`).join('');

		content.innerHTML = `
			<div style="max-width:420px; margin:0 auto; display:flex; flex-direction:column; gap:14px;">
				<div style="font-size:22px; color:#ffd700; text-align:center; margin-bottom:4px;">ダンジョンへ挑む</div>

				<div style="border:1px solid rgba(244,201,93,0.48); border-radius:8px; padding:14px; background:rgba(255,255,255,0.04);">
					<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
						<span style="font-size:12px; color:#aaa;">最高到達階層</span>
						<span style="font-size:16px; color:#ffd700; font-weight:bold;">${maxF} 階</span>
					</div>
					<div style="display:flex; justify-content:space-between; padding:6px 0;">
						<span style="font-size:12px; color:#aaa;">挑戦回数</span>
						<span style="font-size:14px; color:#fff;">${tryCount} 回</span>
					</div>
				</div>

				<div style="display:flex; flex-direction:column; gap:10px;">
					${choiceHtml}
				</div>
			</div>
		`;
	},

	startFromMenu: (startFloor) => {
		if (typeof Menu !== 'undefined') Menu.closeAll();
		Dungeon.start(startFloor);
	},

	exitFromMenu: () => {
		Menu.confirm("ダンジョンから脱出しますか？", () => {
			if (typeof Menu !== 'undefined') Menu.closeAll();
			Dungeon.exit(false);
		});
	},
	
	enter: () => {
		if (typeof Menu !== 'undefined' && typeof Menu.openSubScreen === 'function') {
			Menu.openSubScreen('dungeon');
			return;
		}

		Dungeon.start(1);
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
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;
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
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;

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
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;
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
            if (App.data.dungeon.adventurer && Number(App.data.dungeon.adventurer.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.adventurer = null;
            }
            if (App.data.dungeon.healSpring && Number(App.data.dungeon.healSpring.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.healSpring = null;
            }
            if (App.data.dungeon.abyssRift && Number(App.data.dungeon.abyssRift.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.abyssRift = null;
            }
            if (App.data.dungeon.visitedMap && Number(App.data.dungeon.visitedMap.floor) !== Number(Dungeon.floor)) {
                App.data.dungeon.visitedMap = null;
            }
            App.log(`地下 ${Dungeon.floor} 階の冒険を再開します。`);
        } else {
            if(Dungeon.floor > App.data.dungeon.maxFloor) {
				App.data.dungeon.maxFloor = Dungeon.floor;
				
				// 主人公の限界突破を新基準で再計算（story.jsの関数を呼び出すのが安全）
				if (typeof StoryManager !== 'undefined' && StoryManager.syncHeroLimitBreak) {
					StoryManager.syncHeroLimitBreak(); // story.jsの新ロジックを呼び出し
				} else {
					// フォールバック用
					const ss = (App.data.progress && App.data.progress.storyStep) || 0;
					const maxF = App.data.dungeon.maxFloor;
					const hero = App.data.characters?.find(c => c.charId === 301 || c.uid === 'p1');
					if (hero) {
						hero.limitBreak = Math.max(0, ss - 1) + Math.floor(Math.max(0, maxF - 1) / 10) * 5;
						if (typeof App.calcStats === 'function') App.calcStats(hero);
					}
				}
			}
            Dungeon.generateFloor();
            Dungeon.saveMapData();
            Dungeon.logFloorArrival();
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

        // 迷路フロアではミニマップを「歩いた場所だけ表示」にするため、
        // フロア復帰/新規生成時点の現在地を必ず記録する。
        Dungeon.markVisited(Field.x, Field.y);

        App.changeScene('field');
        
        if (App.data.battle) {
            App.data.battle.isBossBattle = false;
            App.data.battle.isSpecialBoss = false;
            App.data.battle.isEstark = false;
        }
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
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;
        App.data.dungeon.pendingRiftReward = null;
        App.data.dungeon.visitedMap = null;
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
		const areaKey = (typeof Field !== 'undefined' && typeof Field.getCurrentAreaKey === 'function') ? Field.getCurrentAreaKey() : 'ABYSS';
		const posKey = `${x},${y}`;
		let tile = (App.data.progress.mapChanges?.[areaKey]?.[posKey] || tiles[y][x] || 'W').toUpperCase();

        // 迷路フロアのミニマップは、歩いたマスだけ表示する。
        Dungeon.markVisited(x, y);
        
		//App.clearAction();

        // ランダム生成ダンジョン内の冒険者NPC。
        // 接触時はその場で会話選択を出す。移動・エンカウント・宝箱処理とは独立管理。
        if (Dungeon.isAdventurerAt(x, y)) {
            Dungeon.encounterAdventurer({ auto: true });
            return;
        }

        // 深淵の裂け目。接触時は会話選択を出し、承諾時のみ強敵戦へ入る。
        if (Dungeon.isAbyssRiftAt(x, y)) {
            Dungeon.encounterAbyssRift({ auto: true });
            return;
        }

        // 冒険者NPCは主人公が4マス移動するごとに1マス移動する。
        // Field.move()ではなく、移動完了後のDungeon.handleMove()側で処理することで、
        // 壁への移動失敗・足踏みアニメ・メニュー操作ではカウントされない。
        Dungeon.tickAdventurerMovement();

        // 回復の泉。触れただけでは回復せず、ボタン押下で初めて回復する。
        if (Dungeon.isHealSpringAt(x, y)) {
            App.log('<span style="color:#80ffb0;">清らかな泉が湧いている。</span>');
            App.setAction('泉で回復', () => Dungeon.useHealSpring());
            return;
        }

        // 溶岩マス。通行はできるが、乗るたびに最大HPの3%ダメージ。
        // その後の通常エンカウント判定は床と同様に行う。
        if (tile === 'M') {
            Dungeon.stepOnLava();
        }

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
                if (App.data.battle) {
                    App.data.battle.isBossBattle = true;
                    //App.data.battle.isSpecialBoss = Dungeon.floor >= 300;
                    //App.data.battle.isEstark = Dungeon.floor >= 300;
                    //App.data.battle.fixedBossId = Dungeon.floor >= 300 ? 902000 : null;
                }
                App.changeScene('battle');
            });
        } 
		
		// 10n階のボスフロアでは通常床でもランダムエンカウントを発生させない。
		// ボス撃破後の階段・泉・レア宝箱へ向かう余韻を邪魔しないため。
		if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) {
			return;
		}

		// 通常床ではランダムエンカウントを発生させる
		// 宝箱・階段・出口・ボス・イベントアクション中は除外
		if ((tile === 'T' || tile === 'G' || tile === 'M') && !App.pendingAction) {
			const occurred = App.tryRandomEncounter();

			if (!occurred) {
				if (App.data.walkCount === undefined) App.data.walkCount = 0;
				App.data.walkCount++;
			}

			return;
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
        // --- 特性計算対象を「現在のパーティメンバー」に限定 ---
        let bonusNormal = 0, bonusRare = 0, bonusPlus3 = 0;
        let checkMembers = [];
        if (typeof Battle !== 'undefined' && Battle.party && Battle.party.length > 0) {
            checkMembers = Battle.party.filter(p => !p.isDead);
        } else {
            checkMembers = (App.data.party || []).map(uid => App.getChar(uid)).filter(c => c && c.currentHp > 0);
        }

        checkMembers.forEach(char => {
            if (typeof PassiveSkill !== 'undefined') {
                bonusNormal += PassiveSkill.getSumValue(char, 'chest_drop_normal_pct');
                bonusRare   += PassiveSkill.getSumValue(char, 'chest_drop_rare_pct');
                bonusPlus3  += PassiveSkill.getSumValue(char, 'chest_equip_plus3_pct');
            }
        });

        if (type === 'rare') {
            // レア宝箱（赤）
            const ultraChance = 0.5 + (bonusRare / 10); // 0.5% + 特性
            if (Math.random() * 100 < ultraChance) {
                const eq = Dungeon.createEquipWithMinRarity(floor, 3, ['SSR', 'UR', 'EX'], '武器');
                // ... (改＋3の強化処理)
                App.data.inventory.push(eq);
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
            
            // --- 【優先度1】実・種の判定（出たら終了） ---
            if (Dungeon.floor >= 100) {
                // 基本 1% + bonusRare%
                if (Math.random() * 100 < (10 + bonusRare)) {
                    let sid = 100 + Math.floor(Math.random() * 6); // 基本は種
                    const rr = Math.random() * 100;
                    if (rr < 5) sid = 107; 
                    else if (rr < 20) sid = 106; 
                    
                    const it = DB.ITEMS.find(i => i.id === sid);
                    App.log(`宝箱を開けた！<br>なんと <span style="color:#ffff00;"> ${it.name} </span>を手に入れた！`);
                    if (sid === 107) {
                        if (typeof App.lockFieldInput === 'function') App.lockFieldInput(950);
                        const uFlash = document.getElementById('drop-flash-ultra') || document.getElementById('drop-flash');
                        if(uFlash) {
                            uFlash.style.display = 'block';
                            uFlash.className = 'flash-ultra flash-ultra-active';
                            setTimeout(() => { uFlash.style.display = 'none'; }, 950);
                        }
                    }
                    App.save(); return; // 判定終了
                }
            }

            // --- 【優先度2】装備品の判定（出たら終了） ---
            // 基本 30% 固定。ここには bonusNormal は干渉させない
            if (Math.random() * 100 < 30) {
                // bonusPlus3 は装備の品質（+3か）にのみ適用
                let plusValue = (Math.random() * 100 < 20) ? 2 : 1;
                if (Math.random() * 100 < bonusPlus3) {
                    plusValue = 3;
                    hasRareDrop = true;
                }
                const eq = App.createEquipByFloor('chest', floor, plusValue);
                App.data.inventory.push(eq); 
                msg = `${eq.name}`;
            } 
            // --- 【優先度3】ID99（メダル）の判定（出たら終了） ---
            // bonusNormal をここで使用
            else if (Math.random() * 100 < (15 + bonusNormal)) {
                const item = DB.ITEMS.find(i => i.id === 99);
                if(item) { 
                    App.data.items[item.id] = (App.data.items[item.id]||0)+1; 
					
					// ★累計獲得メダル（消費しても減らない）
					if (!App.data.stats) App.data.stats = {};
					App.data.stats.totalMedals = (App.data.stats.totalMedals || 0) + 1;
					
                    msg = `<span style="color:#ffd700;">${item.name}</span>`; 
                }
            }
            // --- 【優先度4】アイテム or GOLD（並列/最終候補） ---
            else {
                if (Math.random() < 0.5) {
                    // アイテム
                    const candidates = DB.ITEMS.filter(i => i.id !== 99 && i.type !== '貴重品' && i.rank <= floor);
                    const item = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : DB.ITEMS[0];
                    App.data.items[item.id] = (App.data.items[item.id]||0)+1; 
                    msg = `${item.name}`;
                } else {
                    // GOLD
                    const gold = Math.floor(Math.random() * (500 * floor)) + 100;
                    App.data.gold += gold; 
                    msg = `<span style="color:#ffff00;">${gold} Gold</span>`;
                }
            }
        }

        // 報酬ログは先に出す。
        // 以前はフラッシュ演出の待ち時間中に移動できるため、ログが出る前に消えることがあった。
        App.log(`宝箱を開けた！<br>${msg} を手に入れた！`);

        if (hasRareDrop || hasUltraRareDrop) {
            const lockMs = hasUltraRareDrop ? 950 : 650;
            if (typeof App.lockFieldInput === 'function') App.lockFieldInput(lockMs);

            // DOM固定レイヤーのフラッシュだけを短く走らせる。
            // Field.render() 依存にしないことで、演出がマップ再描画で消えるのを避ける。
            if (hasUltraRareDrop) {
                const uFlash = document.getElementById('drop-flash-ultra') || document.getElementById('drop-flash');
                if(uFlash) {
                    uFlash.style.display = 'block';
                    uFlash.className = 'flash-ultra flash-ultra-active';
                    setTimeout(() => { uFlash.style.display = 'none'; }, lockMs);
                }
            } else {
                const flash = document.getElementById('drop-flash');
                if(flash) {
                    flash.style.display = 'block';
                    flash.classList.remove('flash-active');
                    void flash.offsetWidth;
                    flash.classList.add('flash-active');
                    setTimeout(() => { flash.style.display = 'none'; }, lockMs);
                }
            }
        }
        App.save();
    },
	

    isAdventurerAt: (x, y) => {
        const adv = App.data?.dungeon?.adventurer;
        if (!adv || !adv.active) return false;
        if (Number(adv.floor) !== Number(Dungeon.floor)) return false;
        return Number(adv.x) === Number(x) && Number(adv.y) === Number(y);
    },

    isHealSpringAt: (x, y) => {
        const spring = App.data?.dungeon?.healSpring;
        if (!spring || !spring.active) return false;
        if (Number(spring.floor) !== Number(Dungeon.floor)) return false;
        return Number(spring.x) === Number(x) && Number(spring.y) === Number(y);
    },

    isAbyssRiftAt: (x, y) => {
        const rift = App.data?.dungeon?.abyssRift;
        if (!rift || !rift.active) return false;
        if (Number(rift.floor) !== Number(Dungeon.floor)) return false;
        return Number(rift.x) === Number(x) && Number(rift.y) === Number(y);
    },

    useHealSpring: () => {
        if (!App.data || !Array.isArray(App.data.characters)) return;
        App.data.characters.forEach(c => {
            const stats = (typeof App.calcStats === 'function') ? App.calcStats(c) : { maxHp: c.hp || 1, maxMp: c.mp || 0 };
            c.currentHp = stats.maxHp;
            c.currentMp = stats.maxMp;
        });
        App.log('<span style="color:#80ffb0;">清らかな泉の力で、HPとMPが全回復した！</span>');
        App.save();
        if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
        if (typeof Field !== 'undefined') {
            if (typeof Field.refreshCurrentAction === 'function') Field.refreshCurrentAction({ silent: true });
            if (typeof Field.render === 'function') Field.render();
        }
    },

    flashLavaDamage: () => {
        const old = document.getElementById('lava-damage-flash');
        if (old) old.remove();

        const layer = document.createElement('div');
        layer.id = 'lava-damage-flash';
        layer.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.72);
            z-index: 2600; pointer-events: none;
            opacity: 0; transition: opacity 90ms ease-out;
        `;
        document.body.appendChild(layer);
        requestAnimationFrame(() => {
            layer.style.opacity = '1';
            setTimeout(() => {
                layer.style.opacity = '0';
                setTimeout(() => layer.remove(), 160);
            }, 85);
        });
    },

    stepOnLava: () => {
        if (!App.data || !Array.isArray(App.data.party)) return;

        let damaged = false;
        const members = App.data.party
            .map(uid => App.getChar ? App.getChar(uid) : null)
            .filter(c => c);

        members.forEach(c => {
            const stats = (typeof App.calcStats === 'function') ? App.calcStats(c) : { maxHp: c.hp || c.currentHp || 1 };
            const maxHp = Math.max(1, Number(stats.maxHp || c.hp || c.currentHp || 1));
            const damage = Math.max(1, Math.floor(maxHp * 0.03));
            const current = Number(c.currentHp ?? c.hp ?? maxHp);
            c.currentHp = Math.max(1, current - damage);
            damaged = true;
        });

        if (damaged) {
            App.log('<span style="color:#ff8a5c;">溶岩の熱でダメージを受けた！</span>');
            Dungeon.flashLavaDamage();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
            App.save();
        }
    },

    canAdventurerMoveTo: (x, y) => {
        if (!Array.isArray(Dungeon.map) || y < 0 || y >= Dungeon.height || x < 0 || x >= Dungeon.width) return false;
        const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
        // NPCは床系だけを歩く。壁・宝箱・階段・ボス・泉位置には入れない。
        if (tile !== 'T' && tile !== 'G') return false;
        if (Dungeon.isHealSpringAt(x, y)) return false;
        if (Dungeon.isAbyssRiftAt(x, y)) return false;
        if (Number(x) === Number(Field.x) && Number(y) === Number(Field.y)) return false;
        return true;
    },

    tickAdventurerMovement: () => {
        const adv = App.data?.dungeon?.adventurer;
        if (!adv || !adv.active) return;
        if (Number(adv.floor) !== Number(Dungeon.floor)) return;

        adv.moveCounter = Number(adv.moveCounter || 0) + 1;
        if (adv.moveCounter < 4) return;
        adv.moveCounter = 0;

        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
        ].sort(() => Math.random() - 0.5);

        for (const d of dirs) {
            const nx = Number(adv.x) + d.dx;
            const ny = Number(adv.y) + d.dy;
            if (!Dungeon.canAdventurerMoveTo(nx, ny)) continue;
            adv.x = nx;
            adv.y = ny;
            App.save();
            return;
        }
    },

    isMazeFloor: () => Number(App.data?.dungeon?.genType) === 2,

    isBossFloor: () => Number(Dungeon.floor || App.data?.progress?.floor || 0) > 0 && Number(Dungeon.floor || App.data?.progress?.floor || 0) % 10 === 0,

    ensureVisitedMap: () => {
        if (!App.data?.dungeon) return null;
        if (!Dungeon.isMazeFloor()) return null;

        const floor = Number(Dungeon.floor || App.data.progress?.floor || 0);
        const vm = App.data.dungeon.visitedMap;
        if (!vm || Number(vm.floor) !== floor || !vm.cells) {
            App.data.dungeon.visitedMap = { floor, cells: {} };
        }
        return App.data.dungeon.visitedMap;
    },

    markVisited: (x = null, y = null) => {
        if (!Dungeon.isMazeFloor()) return;
        const vm = Dungeon.ensureVisitedMap();
        if (!vm) return;
        const px = x == null ? Field.x : x;
        const py = y == null ? Field.y : y;
        vm.cells[`${Number(px)},${Number(py)}`] = true;
    },

    isVisited: (x, y) => {
        if (!Dungeon.isMazeFloor()) return true;
        const vm = Dungeon.ensureVisitedMap();
        if (!vm) return true;
        return !!vm.cells[`${Number(x)},${Number(y)}`];
    },

    getFloorArrivalMessage: () => {
        const floor = Number(Dungeon.floor || App.data?.progress?.floor || 0);
        const lines = [`地下 ${floor} 階に到達した`];

        if (Dungeon.isBossFloor()) {
            lines.push('部屋の中央から強大な気配を感じる…');
        } else {
            if (App.data?.dungeon?.isTreasureRoom) {
                lines.push('なんと、宝物庫のようだ！');
            }
            if (Dungeon.isMazeFloor()) {
                lines.push('どうやら、迷路に入り込んでしまったようだ…！');
            }
            if (App.data?.dungeon?.isLavaFloor) {
                lines.push('灼熱の溶岩が湧き出ている…');
            }
        }

        return lines.join('<br>');
    },

    logFloorArrival: () => {
        App.log(Dungeon.getFloorArrivalMessage());
    },

    isSpecialObjectAt: (x, y, exceptKey = null) => {
        const dungeon = App.data?.dungeon || {};
        const objects = {
            adventurer: dungeon.adventurer,
            healSpring: dungeon.healSpring,
            abyssRift: dungeon.abyssRift,
        };
        return Object.entries(objects).some(([key, obj]) => {
            if (key === exceptKey) return false;
            if (!obj || !obj.active) return false;
            if (Number(obj.floor) !== Number(Dungeon.floor)) return false;
            return Number(obj.x) === Number(x) && Number(obj.y) === Number(y);
        });
    },

    getSpecialSpawnCandidates: () => {
        const candidates = [];
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length) return candidates;
        for (let y = 1; y < Dungeon.height - 1; y++) {
            for (let x = 1; x < Dungeon.width - 1; x++) {
                const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                if (tile !== 'T' && tile !== 'G') continue;
                if (Number(x) === Number(Field.x) && Number(y) === Number(Field.y)) continue;
                if (Dungeon.isSpecialObjectAt(x, y)) continue;

                // 階段・宝箱・ボスの近くに寄りすぎると見落としや進行阻害が起きやすい。
                // 迷路だけは狭いので距離条件をやや緩める。
                const distance = Math.abs(Number(x) - Number(Field.x)) + Math.abs(Number(y) - Number(Field.y));
                if (distance < (Dungeon.isMazeFloor() ? 2 : 3)) continue;
                if (!Dungeon.isAwayFromFeatures(Dungeon.map, { x, y }, Dungeon.isMazeFloor() ? 1 : 2)) continue;
                candidates.push({ x, y });
            }
        }
        return candidates;
    },

    pickSpecialSpawnPosition: () => {
        const candidates = Dungeon.getSpecialSpawnCandidates();
        if (!candidates.length) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    },

    rollAdventurerSpawn: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.adventurer = null;

        // 固定ダンジョンやボス階では出さない。通常のランダム生成フロア用。
        if (App.data.location.area !== 'ABYSS') return;
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) return;

        const force = Dungeon.isMazeFloor();
        if (!force && Math.random() >= Dungeon.adventurerSpawnRate) return;

        const pos = Dungeon.pickSpecialSpawnPosition();
        if (!pos) return;

        App.data.dungeon.adventurer = {
            active: true,
            floor: Dungeon.floor,
            x: pos.x,
            y: pos.y,
            moveCounter: 0,
            image: Dungeon.adventurerImagePath
        };
    },

    rollHealSpringSpawn: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.healSpring = null;
        if (App.data.location.area !== 'ABYSS') return;
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) return;

        const force = Dungeon.isMazeFloor();
        if (!force && Math.random() >= Dungeon.healSpringSpawnRate) return;

        const pos = Dungeon.pickSpecialSpawnPosition();
        if (!pos) return;

        App.data.dungeon.healSpring = {
            active: true,
            floor: Dungeon.floor,
            x: pos.x,
            y: pos.y,
            image: Dungeon.healSpringImagePath,
        };
    },

    rollAbyssRiftSpawn: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.abyssRift = null;
        if (App.data.location.area !== 'ABYSS') return;
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) return;

        const force = Dungeon.isMazeFloor();
        if (!force && Math.random() >= Dungeon.abyssRiftSpawnRate) return;

        const pos = Dungeon.pickSpecialSpawnPosition();
        if (!pos) return;

        App.data.dungeon.abyssRift = {
            active: true,
            floor: Dungeon.floor,
            x: pos.x,
            y: pos.y,
            image: Dungeon.abyssRiftImagePath,
        };
    },

    rollSpecialObjects: () => {
        if (!App.data?.dungeon) return;
        App.data.dungeon.adventurer = null;
        App.data.dungeon.healSpring = null;
        App.data.dungeon.abyssRift = null;

        // 宝物庫フロアは報酬部屋として独立させる。
        // 冒険者/泉/裂け目まで重なると、宝物庫の見せ場が散るため出さない。
        if (App.data.dungeon.isTreasureRoom) return;

        // 迷路フロアだけは、冒険者・泉・裂け目を例外的に100%出す。
        // 通常フロアは各SpawnRateに従う。
        Dungeon.rollAdventurerSpawn();
        Dungeon.rollHealSpringSpawn();
        Dungeon.rollAbyssRiftSpawn();
    },

    encounterAdventurer: async (options = {}) => {
        const adv = App.data?.dungeon?.adventurer;
        if (!adv || !adv.active) return;
        if (Dungeon.adventurerPromptOpen) return;
        Dungeon.adventurerPromptOpen = true;
        App.clearAction();

        try {
            let accepted = true;

            if (typeof StoryManager !== 'undefined' && typeof StoryManager.showChoice === 'function') {
                StoryManager.active = true;
                accepted = await StoryManager.showChoice('なんと、冒険者と遭遇した！\n話しかけてみますか？');
            } else {
                accepted = window.confirm('なんと、冒険者と遭遇した！\n話しかけてみますか？');
            }

            if (!accepted) {
                if (typeof StoryManager !== 'undefined' && typeof StoryManager.endConversation === 'function') {
                    StoryManager.endConversation();
                }
                Dungeon.adventurerPromptOpen = false;
                if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
                    Field.refreshCurrentAction({ silent: true });
                }
                return;
            }

            const rewardFloor = Math.max(1, Number(Dungeon.floor || App.data.progress.floor || 1) + 5);
            const eq = App.createEquipByFloor('adventurer', rewardFloor, 3);
            App.data.inventory.push(eq);

            // 受け取り後は冒険者を消す。同じ階で再取得できないよう必ず保存する。
            App.data.dungeon.adventurer = null;
            App.save();
            if (typeof Field !== 'undefined') Field.render();

            const rewardText = `${eq.name}を手に入れた！`;

            if (typeof StoryManager !== 'undefined' && typeof StoryManager.showConversation === 'function') {
                const key = '__DUNGEON_ADVENTURER_REWARD__';
                StoryManager.scripts[key] = [
                    {
                        charId: 9998,
                        name: '冒険者',
                        text: 'こんなところで会うなんて、これも何かの縁だ。\nさっき手に入れた装備だが俺には使えないみたいだから、あんたにやるよ'
                    },
                    {
                        charId: 1000,
                        name: 'システム',
                        text: rewardText
                    }
                ];
                StoryManager.active = true;
                await StoryManager.showConversation(key, 0);
                StoryManager.endConversation();
                delete StoryManager.scripts[key];
            } else {
                alert(`こんなところで会うなんて、これも何かの縁だ。\n${rewardText}`);
            }
            App.log(`<span style="color:#ffd700;">${rewardText}</span>`);
			
        } finally {
            Dungeon.adventurerPromptOpen = false;
            if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
                Field.refreshCurrentAction({ silent: true });
            }
        }
    },

    encounterAbyssRift: async (options = {}) => {
        const rift = App.data?.dungeon?.abyssRift;
        if (!rift || !rift.active) return;
        if (Dungeon.abyssRiftPromptOpen) return;
        Dungeon.abyssRiftPromptOpen = true;
        App.clearAction();

        try {
            let accepted = true;

            if (typeof StoryManager !== 'undefined' && typeof StoryManager.showConversation === 'function') {
                const talkKey = '__DUNGEON_ABYSS_RIFT_PROMPT__';
                StoryManager.scripts[talkKey] = [
                    { charId: 1000, name: 'システム', text: '闇がどこまでも続いているような亀裂を見つけた・・・' }
                ];
                StoryManager.active = true;
                await StoryManager.showConversation(talkKey, 0);
                delete StoryManager.scripts[talkKey];
            }

            if (typeof StoryManager !== 'undefined' && typeof StoryManager.showChoice === 'function') {
                StoryManager.active = true;
                accepted = await StoryManager.showChoice('このままだと危険かもしれない。\n亀裂の根源を断ちますか？\n（強敵との戦闘になります）');
            } else {
                accepted = window.confirm('闇がどこまでも続いているような亀裂を見つけた・・・\n亀裂の根源を断ちますか？\n（強敵との戦闘になります）');
            }

            if (!accepted) {
                if (typeof StoryManager !== 'undefined' && typeof StoryManager.endConversation === 'function') {
                    StoryManager.endConversation();
                }
                Dungeon.abyssRiftPromptOpen = false;
                if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
                    Field.refreshCurrentAction({ silent: true });
                }
                return;
            }

            if (typeof StoryManager !== 'undefined' && typeof StoryManager.endConversation === 'function') {
                StoryManager.endConversation();
            }

            const targetFloor = Math.max(1, Number(Dungeon.floor || App.data.progress.floor || 1) + 10);
            if (App.data?.dungeon?.abyssRift) App.data.dungeon.abyssRift.targetFloor = targetFloor;

            App.data.battle = {
                active: false,
                isBossBattle: true,
                isRiftBattle: true,
                isSpecialBoss: false,
                isEstark: false,
                fixedBossId: null,
                eventId: Dungeon.riftBattleEventId,
                riftFloor: targetFloor,
            };
            App.save();
            App.changeScene('battle');
        } finally {
            Dungeon.abyssRiftPromptOpen = false;
        }
    },

    pickRiftMonsterIds: (targetFloor, count = 3) => {
        // 互換用。現在の裂け目戦は battle.js 側で targetFloor を見て直接生成する。
        // ここで allowRare:true を使うと、201階以降で通常敵候補が null の時に
        // メタル系などのレアモンスターだけが選ばれる事故が起きるため、使用しないこと。
        const ids = [];
        let guard = count * 8;
        while (ids.length < count && guard-- > 0) {
            let base = null;
            if (window.MonsterData && typeof window.MonsterData.generateEnemyForFloor === 'function') {
                base = window.MonsterData.generateEnemyForFloor(targetFloor, { allowRare: false });
            }
            if (!base && Array.isArray(DB.MONSTERS) && DB.MONSTERS.length) {
                const candidates = DB.MONSTERS.filter(m => !m.isBoss && !m.isRare && !m.isSpecialBoss && !m.isEstark);
                base = candidates[Math.floor(Math.random() * candidates.length)] || null;
            }
            if (base && base.id) ids.push(Number(base.id));
        }
        return ids;
    },

    completeAbyssRift: () => {
        if (!App.data?.dungeon) return;
        const rift = App.data.dungeon.abyssRift;
        const rewardFloor = Math.max(1, Number(rift?.targetFloor || App.data.battle?.riftFloor || Dungeon.floor + 10 || 1));
        const eq = App.createEquipByFloor('rift', rewardFloor, 3);
        App.data.inventory.push(eq);

        App.data.dungeon.abyssRift = null;
        App.data.dungeon.pendingRiftReward = {
            active: true,
            itemName: eq.name,
        };
        if (App.data.progress) delete App.data.progress.pendingBattleWinEventId;
        App.log('<span style="color:#c78cff;">亀裂の根源を打ち破った！</span>');
        App.save();
    },

    resumePendingRiftReward: async () => {
        const pending = App.data?.dungeon?.pendingRiftReward;
        if (!pending || !pending.active) return false;

        const itemName = pending.itemName || '輝く装備+3';
        App.data.dungeon.pendingRiftReward = null;
        App.save();

        const lines = [
            { charId: 1000, name: 'システム', text: '亀裂の根源を打ち破った！' },
            { charId: 1000, name: 'システム', text: '根源が消滅し、その跡から輝く装備を見つけた！！' },
            { charId: 1000, name: 'システム', text: `${itemName}を手に入れた！` }
        ];

        if (typeof StoryManager !== 'undefined' && typeof StoryManager.showConversation === 'function') {
            const key = '__DUNGEON_ABYSS_RIFT_REWARD__';
            StoryManager.scripts[key] = lines;
            StoryManager.active = true;
            await StoryManager.showConversation(key, 0);
            StoryManager.endConversation();
            delete StoryManager.scripts[key];
        } else {
            alert(`亀裂の根源を打ち破った！\n根源が消滅し、その跡から輝く装備を見つけた！！\n${itemName}を手に入れた！`);
        }

        App.log(`<span style="color:#ffd700;">${itemName}を手に入れた！</span>`);

        if (typeof Field !== 'undefined') {
            if (typeof Field.refreshCurrentAction === 'function') Field.refreshCurrentAction({ silent: true });
            if (typeof Field.render === 'function') Field.render();
        }
        return true;
    },

    isLavaFloorCandidate: () => {
        if (!App.data?.dungeon) return false;
        if (App.data.location.area !== 'ABYSS') return false;
        if (Dungeon.floor < Dungeon.lavaFloorMinFloor) return false;
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) return false;
        if (App.data.dungeon.isTreasureRoom) return false;
        return true;
    },

    applyLavaFloorIfNeeded: (force = false) => {
        if (!App.data?.dungeon) return false;
        App.data.dungeon.isLavaFloor = false;
        App.data.dungeon.lava = null;

        if (!Dungeon.isLavaFloorCandidate()) return false;
        if (!force && Math.random() >= Dungeon.lavaFloorSpawnRate) return false;
        if (!Array.isArray(Dungeon.map) || !Dungeon.map.length) return false;

        // 通常宝箱/既存レア宝箱は一度床に戻し、溶岩フロアではレア宝箱2個だけにする。
        for (let y = 0; y < Dungeon.height; y++) {
            for (let x = 0; x < Dungeon.width; x++) {
                if (Dungeon.map[y][x] === 'C' || Dungeon.map[y][x] === 'R') Dungeon.map[y][x] = 'T';
            }
        }

        const shuffle = Dungeon.shuffle || ((items) => items.sort(() => Math.random() - 0.5));
        const playerKey = `${Field.x},${Field.y}`;
        const stairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0] || null;
        const protectedKeys = new Set([playerKey]);
        if (stairs) protectedKeys.add(`${stairs.x},${stairs.y}`);

        const floorCells = [];
        for (let y = 1; y < Dungeon.height - 1; y++) {
            for (let x = 1; x < Dungeon.width - 1; x++) {
                const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                if (tile !== 'T' && tile !== 'G') continue;
                if (protectedKeys.has(`${x},${y}`)) continue;
                floorCells.push({ x, y });
            }
        }

        if (floorCells.length < 8) return false;

        const lavaCount = Math.max(1, Math.floor(floorCells.length * 0.25));
        const lavaCells = shuffle(floorCells).slice(0, lavaCount);
        lavaCells.forEach(p => { Dungeon.map[p.y][p.x] = 'M'; });

        let chestCandidates = [];
        for (let y = 1; y < Dungeon.height - 1; y++) {
            for (let x = 1; x < Dungeon.width - 1; x++) {
                const tile = String(Dungeon.map[y]?.[x] || 'W').toUpperCase();
                if (tile !== 'T' && tile !== 'G') continue;
                if (protectedKeys.has(`${x},${y}`)) continue;
                const distFromPlayer = Math.abs(x - Field.x) + Math.abs(y - Field.y);
                if (distFromPlayer < 3) continue;
                chestCandidates.push({ x, y });
            }
        }
        if (chestCandidates.length < 2) {
            chestCandidates = floorCells.filter(p => Dungeon.map[p.y][p.x] !== 'M' && !protectedKeys.has(`${p.x},${p.y}`));
        }

        shuffle(chestCandidates).slice(0, 2).forEach(p => { Dungeon.map[p.y][p.x] = 'R'; });

        App.data.dungeon.isLavaFloor = true;
        App.data.dungeon.lava = { active: true, floor: Dungeon.floor, rate: 0.25 };
        return true;
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
        if (App.data?.dungeon) {
            App.data.dungeon.isTreasureRoom = false;
            App.data.dungeon.isLavaFloor = false;
            App.data.dungeon.lava = null;
            App.data.dungeon.visitedMap = null;
        }
        
        if (Dungeon.floor > 0 && Dungeon.floor % 10 === 0) {
            Dungeon.generateBossRoom();
        } else {
            if (Math.random() < 0.02) {
                Dungeon.generateTreasureRoom();
                if (App.data?.dungeon) App.data.dungeon.isTreasureRoom = true;
            } else {
				Dungeon.lastGenVariant = null;
				const r = Math.random();
				let type;
				if (r < 0.1) type = 2; // 迷路
				else if (r < 0.50) type = 0; // 部屋
				else type = 1; // 洞窟
				
				if (type === 0) Dungeon.generateRoomMap(); 
				else if (type === 1) Dungeon.generateCaveMap(); 
				else Dungeon.generateMazeMap(); 
				
				Dungeon.setPlayerRandomSpawn();
				App.data.dungeon.genType = type;
				App.data.dungeon.genVariant = Dungeon.lastGenVariant || null;
			}
		}

        
        // 50階以降の通常マップでは、30%で溶岩フロア化する。
        // 通常宝箱を消し、床の25%を溶岩にしてレア宝箱2個だけを配置する。
        // 迷路フロアでも通常どおり判定する。
        Dungeon.applyLavaFloorIfNeeded();

        // フロア生成完了後に特殊オブジェクトを配置する。
        // 冒険者・泉・裂け目はいずれも別管理にして、既存タイル文字を壊さない。
        // 特殊オブジェクト候補はT/Gのみなので、溶岩マス上には出現しない。
        Dungeon.rollSpecialObjects();
        
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
        // ボスフロアはひし形にする。外周を長方形床に戻すと、
        // ボス撃破後の「上に階段・左下に泉・右下に宝箱」という配置が崩れるため注意。
        const w = 11, h = 11;
        const cx = 5, cy = 5, radius = 4;
        Dungeon.width = w;
        Dungeon.height = h;
        for (let y = 0; y < h; y++) {
            const row = [];
            for (let x = 0; x < w; x++) {
                row.push((Math.abs(x - cx) + Math.abs(y - cy) <= radius) ? 'T' : 'W');
            }
            Dungeon.map.push(row);
        }

        // ひし形の中心にボス、下端にプレイヤーを置く。
        Dungeon.map[cy][cx] = 'B';
        Field.x = cx;
        Field.y = cy + radius;
    },
	
    generateTreasureRoom: () => {
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

    randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

    chance: (rate) => Math.random() < rate,

    makeMap: (w, h, tile = 'W') => Array.from({ length: h }, () => Array(w).fill(tile)),

    shuffle: (items) => {
        const arr = items.slice();
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    inBounds: (map, x, y, margin = 1) => {
        const h = map.length;
        const w = h ? map[0].length : 0;
        return x >= margin && x < w - margin && y >= margin && y < h - margin;
    },

    carveBrush: (map, cx, cy, rx = 1, ry = rx) => {
        let carved = 0;
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
            for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
                if (!Dungeon.inBounds(map, x, y, 1)) continue;
                const nx = (x - cx) / Math.max(1, rx);
                const ny = (y - cy) / Math.max(1, ry);
                if ((nx * nx) + (ny * ny) <= 1.15) {
                    if (map[y][x] === 'W') carved++;
                    map[y][x] = 'T';
                }
            }
        }
        return carved;
    },

    carveLine: (map, from, to, width = 1, wiggle = 0.18) => {
        let x = from.x;
        let y = from.y;
        Dungeon.carveBrush(map, x, y, width);
        let guard = map.length * map[0].length;
        while ((x !== to.x || y !== to.y) && guard-- > 0) {
            const horizontal = x !== to.x && (y === to.y || Math.random() < 0.5);
            if (horizontal) x += x < to.x ? 1 : -1;
            else if (y !== to.y) y += y < to.y ? 1 : -1;

            if (Math.random() < wiggle) {
                const dirs = Dungeon.shuffle([[1,0],[-1,0],[0,1],[0,-1]]);
                const d = dirs.find(([dx, dy]) => Dungeon.inBounds(map, x + dx, y + dy, 1));
                if (d) { x += d[0]; y += d[1]; }
            }
            Dungeon.carveBrush(map, x, y, width);
        }
    },

    collectTiles: (map, accepted = ['T']) => {
        const set = new Set(accepted);
        const cells = [];
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                if (set.has(map[y][x])) cells.push({ x, y });
            }
        }
        return cells;
    },

    floorNeighbors: (map, x, y, diagonal = false) => {
        const dirs = diagonal
            ? [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
            : [[1,0],[-1,0],[0,1],[0,-1]];
        let count = 0;
        dirs.forEach(([dx, dy]) => {
            const nx = x + dx, ny = y + dy;
            if (ny >= 0 && ny < map.length && nx >= 0 && nx < map[0].length && map[ny][nx] !== 'W') count++;
        });
        return count;
    },

    findRegions: (map) => {
        const h = map.length, w = map[0].length;
        const seen = Array.from({ length: h }, () => Array(w).fill(false));
        const regions = [];
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                if (seen[y][x] || map[y][x] === 'W') continue;
                const region = [];
                const queue = [{ x, y }];
                seen[y][x] = true;
                for (let qi = 0; qi < queue.length; qi++) {
                    const p = queue[qi];
                    region.push(p);
                    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
                        const nx = p.x + dx, ny = p.y + dy;
                        if (nx <= 0 || nx >= w - 1 || ny <= 0 || ny >= h - 1) return;
                        if (seen[ny][nx] || map[ny][nx] === 'W') return;
                        seen[ny][nx] = true;
                        queue.push({ x: nx, y: ny });
                    });
                }
                regions.push(region);
            }
        }
        return regions;
    },

    keepLargestRegion: (map) => {
        const regions = Dungeon.findRegions(map);
        if (!regions.length) return 0;
        regions.sort((a, b) => b.length - a.length);
        const keep = new Set(regions[0].map(p => `${p.x},${p.y}`));
        for (let y = 1; y < map.length - 1; y++) {
            for (let x = 1; x < map[0].length - 1; x++) {
                if (map[y][x] !== 'W' && !keep.has(`${x},${y}`)) map[y][x] = 'W';
            }
        }
        return regions[0].length;
    },

    distanceMap: (map, start) => {
        const h = map.length, w = map[0].length;
        const dist = Array.from({ length: h }, () => Array(w).fill(-1));
        if (!start || map[start.y]?.[start.x] === 'W') return dist;
        const queue = [start];
        dist[start.y][start.x] = 0;
        for (let qi = 0; qi < queue.length; qi++) {
            const p = queue[qi];
            [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
                const nx = p.x + dx, ny = p.y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
                if (dist[ny][nx] >= 0 || map[ny][nx] === 'W') return;
                dist[ny][nx] = dist[p.y][p.x] + 1;
                queue.push({ x: nx, y: ny });
            });
        }
        return dist;
    },

    weightedPick: (items, weightFn) => {
        if (!items.length) return null;
        const weights = items.map((item) => Math.max(0.01, weightFn(item)));
        const total = weights.reduce((sum, val) => sum + val, 0);
        let roll = Math.random() * total;
        for (let i = 0; i < items.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return items[i];
        }
        return items[items.length - 1];
    },

    isAwayFromFeatures: (map, cell, minDist = 3) => {
        for (let y = Math.max(0, cell.y - minDist); y <= Math.min(map.length - 1, cell.y + minDist); y++) {
            for (let x = Math.max(0, cell.x - minDist); x <= Math.min(map[0].length - 1, cell.x + minDist); x++) {
                if (Math.abs(x - cell.x) + Math.abs(y - cell.y) > minDist) continue;
                if (map[y][x] === 'S' || map[y][x] === 'C' || map[y][x] === 'R') return false;
            }
        }
        return true;
    },

    finishCaveMap: (map) => {
        const h = map.length, w = map[0].length;
        for (let i = 0; i < 2; i++) {
            const next = map.map(row => row.slice());
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const floors = Dungeon.floorNeighbors(map, x, y, true);
                    if (map[y][x] === 'W' && floors >= 6) next[y][x] = 'T';
                    if (map[y][x] !== 'W' && floors <= 1) next[y][x] = 'W';
                }
            }
            map = next;
        }
        const largest = Dungeon.keepLargestRegion(map);
        if (largest < 120) return null;
        return map;
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

    generateAdvancedCaveMap: () => {
        const variants = ['worms', 'cellular', 'chambers', 'ravine'];
        const variant = variants[Dungeon.randInt(0, variants.length - 1)];
        Dungeon.lastGenVariant = `cave-${variant}`;

        let map = null;
        if (variant === 'cellular') map = Dungeon.generateCellularCave();
        else if (variant === 'chambers') map = Dungeon.generateChamberCave();
        else if (variant === 'ravine') map = Dungeon.generateRavineCave();
        else map = Dungeon.generateWormCave();

        map = Dungeon.finishCaveMap(map) || Dungeon.generateChamberCave();
        Dungeon.width = map[0].length;
        Dungeon.height = map.length;
        Dungeon.map = map;
        Dungeon.placeStairsAndChests();
    },

    generateWormCave: () => {
        const w = Dungeon.randInt(30, 36), h = Dungeon.randInt(30, 36);
        const map = Dungeon.makeMap(w, h, 'W');
        const start = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
        let carved = Dungeon.carveBrush(map, start.x, start.y, 2);
        const target = Dungeon.randInt(280, 430);
        const miners = [{ x: start.x, y: start.y, dx: 1, dy: 0, life: target }];
        let guard = target * 12;

        while (carved < target && guard-- > 0 && miners.length) {
            const idx = Dungeon.randInt(0, miners.length - 1);
            const m = miners[idx];
            if (Math.random() > 0.62 || (m.dx === 0 && m.dy === 0)) {
                const d = Dungeon.shuffle([[1,0],[-1,0],[0,1],[0,-1]])[0];
                m.dx = d[0]; m.dy = d[1];
            }

            const steps = Dungeon.randInt(1, 3);
            for (let i = 0; i < steps; i++) {
                const nx = m.x + m.dx, ny = m.y + m.dy;
                if (!Dungeon.inBounds(map, nx, ny, 2)) {
                    m.dx *= -1; m.dy *= -1;
                    break;
                }

                m.x = nx; m.y = ny; m.life--;
                carved += Dungeon.carveBrush(map, m.x, m.y, Math.random() < 0.16 ? 2 : 1);
                if (Math.random() < 0.035 && miners.length < 10) {
                    miners.push({ x: m.x, y: m.y, dx: -m.dy, dy: m.dx, life: Dungeon.randInt(40, 120) });
                }
            }
            if (m.life <= 0 && miners.length > 1) miners.splice(idx, 1);
        }

        for (let i = 0; i < 10; i++) {
            const floors = Dungeon.collectTiles(map);
            if (!floors.length) break;
            const p = floors[Dungeon.randInt(0, floors.length - 1)];
            Dungeon.carveBrush(map, p.x, p.y, Dungeon.randInt(2, 4), Dungeon.randInt(2, 4));
        }
        return map;
    },

    generateCellularCave: () => {
        const w = Dungeon.randInt(32, 38), h = Dungeon.randInt(32, 38);
        let map = Dungeon.makeMap(w, h, 'W');
        const openRate = 0.46 + Math.random() * 0.08;
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                map[y][x] = Math.random() < openRate ? 'T' : 'W';
            }
        }

        const passes = Dungeon.randInt(4, 6);
        for (let i = 0; i < passes; i++) {
            const next = Dungeon.makeMap(w, h, 'W');
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const floors = Dungeon.floorNeighbors(map, x, y, true);
                    next[y][x] = floors >= 5 ? 'T' : 'W';
                }
            }
            map = next;
        }

        Dungeon.keepLargestRegion(map);
        const floors = Dungeon.collectTiles(map);
        for (let i = 0; i < 6 && floors.length; i++) {
            const p = floors[Dungeon.randInt(0, floors.length - 1)];
            Dungeon.carveBrush(map, p.x, p.y, Dungeon.randInt(1, 3));
        }
        return map;
    },

    generateChamberCave: () => {
        const w = Dungeon.randInt(30, 36), h = Dungeon.randInt(30, 36);
        const map = Dungeon.makeMap(w, h, 'W');
        const centers = [{ x: Math.floor(w / 2), y: Math.floor(h / 2) }];
        const chamberCount = Dungeon.randInt(9, 16);
        for (let i = 1; i < chamberCount; i++) {
            centers.push({ x: Dungeon.randInt(4, w - 5), y: Dungeon.randInt(4, h - 5) });
        }

        centers.forEach((c) => {
            Dungeon.carveBrush(map, c.x, c.y, Dungeon.randInt(2, 5), Dungeon.randInt(2, 4));
        });

        for (let i = 1; i < centers.length; i++) {
            const current = centers[i];
            const previous = centers.slice(0, i).sort((a, b) =>
                Math.abs(a.x - current.x) + Math.abs(a.y - current.y) -
                (Math.abs(b.x - current.x) + Math.abs(b.y - current.y))
            )[0];
            Dungeon.carveLine(map, previous, current, Math.random() < 0.25 ? 2 : 1, 0.10);
        }
        return map;
    },

    generateRavineCave: () => {
        const w = Dungeon.randInt(30, 36), h = Dungeon.randInt(30, 36);
        const map = Dungeon.makeMap(w, h, 'W');
        const horizontal = Math.random() < 0.5;
        let x = horizontal ? 2 : Dungeon.randInt(5, w - 6);
        let y = horizontal ? Dungeon.randInt(5, h - 6) : 2;
        const end = horizontal ? w - 3 : h - 3;
        let guard = w * h;

        while ((horizontal ? x < end : y < end) && guard-- > 0) {
            Dungeon.carveBrush(map, x, y, Dungeon.randInt(1, 3), Dungeon.randInt(1, 3));
            if (Math.random() < 0.18) {
                const branchEnd = {
                    x: Math.max(2, Math.min(w - 3, x + Dungeon.randInt(-8, 8))),
                    y: Math.max(2, Math.min(h - 3, y + Dungeon.randInt(-8, 8)))
                };
                Dungeon.carveLine(map, { x, y }, branchEnd, 1, 0.28);
                if (Math.random() < 0.45) Dungeon.carveBrush(map, branchEnd.x, branchEnd.y, Dungeon.randInt(2, 4), Dungeon.randInt(2, 4));
            }

            if (horizontal) {
                x++;
                y += Dungeon.randInt(-1, 1);
                y = Math.max(3, Math.min(h - 4, y));
            } else {
                y++;
                x += Dungeon.randInt(-1, 1);
                x = Math.max(3, Math.min(w - 4, x));
            }
        }
        return map;
    },

    generateCaveMap: () => {
        Dungeon.generateAdvancedCaveMap();
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

    placeAdvancedFeatures: () => {
        Dungeon.keepLargestRegion(Dungeon.map);
        let floors = Dungeon.collectTiles(Dungeon.map, ['T']);
        if (!floors.length) return;

        const center = floors.reduce((best, cell) => {
            const score = Math.abs(cell.x - Dungeon.width / 2) + Math.abs(cell.y - Dungeon.height / 2);
            return !best || score < best.score ? { ...cell, score } : best;
        }, null);
        const centerDist = Dungeon.distanceMap(Dungeon.map, center);
        const maxCenterDist = Math.max(...floors.map(p => centerDist[p.y][p.x]));
        const stairPool = floors.filter(p => centerDist[p.y][p.x] >= maxCenterDist * 0.55);
        const sPos = Dungeon.weightedPick(stairPool.length ? stairPool : floors, (p) => {
            const deadEnd = Dungeon.floorNeighbors(Dungeon.map, p.x, p.y, false) <= 1 ? 8 : 1;
            return (centerDist[p.y][p.x] + 1) * deadEnd;
        });
        Dungeon.map[sPos.y][sPos.x] = 'S';
        floors = floors.filter(p => p.x !== sPos.x || p.y !== sPos.y);

        let chests = Dungeon.randInt(3, 7) + Math.min(3, Math.floor(Dungeon.floor / 60));
        const stairDist = Dungeon.distanceMap(Dungeon.map, sPos);

        for(let i=0; i<chests; i++) {
            if(!floors.length) break;
            const candidates = floors.filter(p => Dungeon.isAwayFromFeatures(Dungeon.map, p, 3) && stairDist[p.y][p.x] >= 4);
            const pool = candidates.length ? candidates : floors;
            const cPos = Dungeon.weightedPick(pool, (p) => {
                const deadEnd = Dungeon.floorNeighbors(Dungeon.map, p.x, p.y, false) <= 1 ? 6 : 1;
                return (stairDist[p.y][p.x] + 2) * deadEnd;
            });
            Dungeon.map[cPos.y][cPos.x] = 'C';
            floors = floors.filter(p => p.x !== cPos.x || p.y !== cPos.y);
        }

        if (Math.random() < 0.01 && floors.length > 0) {
            const candidates = floors.filter(p => Dungeon.isAwayFromFeatures(Dungeon.map, p, 4));
            const pool = candidates.length ? candidates : floors;
            const rPos = Dungeon.weightedPick(pool, (p) => stairDist[p.y][p.x] + 1);
            Dungeon.map[rPos.y][rPos.x] = 'R';
        }
    },

    placeStairsAndChests: () => {
        Dungeon.placeAdvancedFeatures();
        return;
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
        const floors = Dungeon.collectTiles(Dungeon.map, ['T']);
        if (!floors.length) return;
        const stairs = Dungeon.collectTiles(Dungeon.map, ['S'])[0];
        let spawn = null;
        if (stairs) {
            const dist = Dungeon.distanceMap(Dungeon.map, stairs);
            const reachable = floors.filter(p => dist[p.y][p.x] >= 0);
            const poolBase = reachable.length ? reachable : floors;
            const maxDist = Math.max(...poolBase.map(p => dist[p.y][p.x]));
            const candidates = poolBase.filter(p => dist[p.y][p.x] >= maxDist * 0.65);
            spawn = Dungeon.weightedPick(candidates.length ? candidates : poolBase, (p) => dist[p.y][p.x] + 1);
        } else {
            spawn = floors[Math.floor(Math.random() * floors.length)];
        }
        Field.x = spawn.x; Field.y = spawn.y;
        App.data.location.x = spawn.x; App.data.location.y = spawn.y;
        return;

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

    /* dungeon.js 390行目付近 */
	onBossDefeated: () => {
		// ★修正: ログ出力を状況に合わせて変更
		const isAbyss = (App.data.location.area === 'ABYSS');
		const isFixed = (Field.currentMapData && Field.currentMapData.isFixed);
        const isRiftBattle = App.data.battle && App.data.battle.eventId === Dungeon.riftBattleEventId;

        if (isRiftBattle) {
            Dungeon.completeAbyssRift();
            App.clearAction();
            if (typeof Field !== 'undefined') Field.render();
            if (App.data.battle) {
                App.data.battle.isBossBattle = false;
                App.data.battle.isSpecialBoss = false;
                App.data.battle.isEstark = false;
                App.data.battle.fixedBossId = null;
                App.data.battle.eventId = null;
            }
            return;
        }

		if (isAbyss) {
			App.log(`地下 ${Dungeon.floor} 階ボス撃破！ボスの気配が消えた...`);
		}

		// 1. 固定マップ（試練の洞窟など）の場合
		if (isFixed) {
			const areaKey = Field.getCurrentAreaKey();
			const posKey = `${Field.x},${Field.y}`;
			
			if (!App.data.progress.defeatedBosses) App.data.progress.defeatedBosses = {};
			if (!App.data.progress.defeatedBosses[areaKey]) App.data.progress.defeatedBosses[areaKey] = [];
			
			if (!App.data.progress.defeatedBosses[areaKey].includes(posKey)) {
				App.data.progress.defeatedBosses[areaKey].push(posKey);
			}
			App.clearAction();
		} 
		// 2. ランダムダンジョン（ABYSS）の場合
		else if (isAbyss) {
			// ボス撃破後の報酬配置。足元を階段にする旧仕様ではなく、
			// ひし形ボス部屋の上端に階段、左下に全回復の泉、右下にレア宝箱を出す。
			// 配置座標は generateBossRoom() の 11x11 / 中心(5,5) / 半径4 と対応している。
			const stair = { x: 5, y: 1 };
			const spring = { x: 4, y: 2 };
			const rareChest = { x: 6, y: 2 };

			if (Dungeon.map?.[Field.y]?.[Field.x]) Dungeon.map[Field.y][Field.x] = 'T';
			if (Dungeon.map?.[stair.y]?.[stair.x]) Dungeon.map[stair.y][stair.x] = 'S';
			if (Dungeon.map?.[rareChest.y]?.[rareChest.x]) Dungeon.map[rareChest.y][rareChest.x] = 'R';

			App.data.dungeon.healSpring = {
				active: true,
				floor: Dungeon.floor,
				x: spring.x,
				y: spring.y,
				image: Dungeon.healSpringImagePath,
			};

			App.log('<span style="color:#80ffb0;">階段が現れた！</span>');
			Dungeon.saveMapData();

			// ボス撃破直後は足元にアクションを出さず、部屋上部の階段まで歩かせる。
			App.clearAction();
		}
		// 3. それ以外（村でのイベントボスなど）
		else {
			// マップタイルの変更は行わず、アクションボタンだけクリアする
			App.clearAction();
		}
		
		if (typeof Field !== 'undefined') Field.render();
		
		// 戦闘データのクリーンアップ
		if (App.data.battle) {
			App.data.battle.isBossBattle = false;
			App.data.battle.isSpecialBoss = false;
			App.data.battle.isEstark = false;
			App.data.battle.fixedBossId = null; 
		}
	}

};
