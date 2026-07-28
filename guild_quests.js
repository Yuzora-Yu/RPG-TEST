/* guild_quests.js - Adventurer Guild rotating request master (source of truth) */
(function(root) {
    'use strict';

    const GUILD_QUEST_SCHEMA_VERSION = 9;

    // 旧町別掲示板時代のセーブIDを、新しいギルド依頼IDへ一度だけ移行するための対応表。
    // 固定依頼は GUILD_QUEST_DATA、自動生成依頼の条件は GUILD_QUEST_GENERATOR_MASTER を正本とする。
    const GUILD_QUEST_LEGACY_ID_MAP = {
    "fire_board_hunt": "guild_ignis_patrol",
    "fire_board_exchange": "guild_ignis_refining",
    "wind_board_hunt": "guild_kazaria_patrol",
    "wind_board_exchange": "guild_kazaria_materials",
    "water_board_hunt": "guild_rivaria_patrol",
    "water_board_exchange": "guild_rivaria_alchemy",
    "tower_board_hunt": "guild_lighthouse_patrol",
    "tower_board_exchange": "guild_lighthouse_materials",
    "thunder_board_hunt": "guild_raizark_patrol",
    "thunder_board_exchange": "guild_raizark_refining",
    "light_board_hunt": "guild_prisma_patrol",
    "light_board_exchange": "guild_prisma_sublimation",
    "dark_board_hunt": "guild_galvania_patrol",
    "dark_board_exchange": "guild_galvania_refining",
    "abyss_board_hunt": "guild_abyss_suppression",
    "abyss_board_exchange": "guild_abyss_stabilization"
};

    const GUILD_QUEST_DATA = {
    "guild_ignis_patrol": {
        "name": "炉辺の小討伐",
        "area": "イグナ火山",
        "kind": "hunt",
        "unlockFlags": [
            "fireVillageCleared"
        ],
        "objective": "イグナ火山内で魔物を合計5体討伐する。",
        "startText": "炭運びたちの安全確保のため、イグナ火山に残る魔物の間引きを頼まれた。種類は問わない。",
        "progressText": "イグナ火山内で魔物を5体討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetCount": 5,
        "completeText": "火山道の安全が確保され、里の備蓄品を受け取った。",
        "rewardItems": [
            {
                "id": 2,
                "count": 2
            },
            {
                "id": 2001,
                "count": 1
            }
        ],
        "requiredRank": "G",
        "guildExp": 18,
        "guildPoints": 6,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_ignis_patrol",
        "regionKey": "FIRE_VILLAGE",
        "requestType": "dungeonHunt",
        "reportAt": "guildReception",
        "sortOrder": 10,
        "huntScope": {
            "mode": "dungeon",
            "areaKeys": [
                "IGNIS_VOLCANO"
            ],
            "label": "イグナ火山"
        }
    },
    "guild_ignis_refining": {
        "name": "炉材の仕立て直し",
        "area": "炎の里イグニシア",
        "kind": "collection",
        "unlockFlags": [
            "fireVillageCleared"
        ],
        "objective": "鉄くず4個と劣化した魔石2個を納品し、上位素材に交換する。",
        "startText": "鍛冶場では、低位素材をまとめて精錬するための材料を募っている。",
        "progressText": "鉄くず4個と劣化した魔石2個を集め、ライザーク要塞のギルド受付へ報告しよう。",
        "itemRequirements": [
            {
                "id": 2000,
                "count": 4
            },
            {
                "id": 2016,
                "count": 2
            }
        ],
        "consumeItemsOnComplete": true,
        "completeText": "集めた素材が精錬され、扱いやすい上位素材になった。",
        "rewardItems": [
            {
                "id": 2001,
                "count": 1
            },
            {
                "id": 2017,
                "count": 1
            }
        ],
        "requiredRank": "G",
        "guildExp": 16,
        "guildPoints": 7,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_ignis_refining",
        "regionKey": "FIRE_VILLAGE",
        "requestType": "delivery",
        "reportAt": "guildReception",
        "sortOrder": 20
    },
    "guild_kazaria_patrol": {
        "name": "枝道の魔物払い",
        "area": "禁忌の森",
        "kind": "hunt",
        "unlockFlags": [
            "windVillageCleared"
        ],
        "objective": "禁忌の森内で魔物を合計6体討伐する。",
        "startText": "薬草採りが森へ戻れるよう、禁忌の森に居着いた魔物の討伐を頼まれた。種類は問わない。",
        "progressText": "禁忌の森内で魔物を6体討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetCount": 6,
        "completeText": "枝道に風が戻り、薬草採りから礼の品を受け取った。",
        "rewardItems": [
            {
                "id": 8,
                "count": 3
            },
            {
                "id": 2025,
                "count": 1
            }
        ],
        "requiredRank": "G",
        "guildExp": 22,
        "guildPoints": 8,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_kazaria_patrol",
        "regionKey": "WIND_VILLAGE",
        "requestType": "dungeonHunt",
        "reportAt": "guildReception",
        "sortOrder": 30,
        "huntScope": {
            "mode": "dungeon",
            "areaKeys": [
                "FORBIDDEN_FOREST"
            ],
            "label": "禁忌の森"
        }
    },
    "guild_kazaria_materials": {
        "name": "風織りの素材束",
        "area": "風の集落カザリア",
        "kind": "collection",
        "unlockFlags": [
            "windVillageCleared"
        ],
        "objective": "枯れ枝4個とくたびれた羽3個を納品し、上位素材に交換する。",
        "startText": "風織り職人が、傷んだ素材を選別して新しい加工材へ仕立てるという。",
        "progressText": "枯れ枝4個とくたびれた羽3個を集め、ライザーク要塞のギルド受付へ報告しよう。",
        "itemRequirements": [
            {
                "id": 2008,
                "count": 4
            },
            {
                "id": 2024,
                "count": 3
            }
        ],
        "consumeItemsOnComplete": true,
        "completeText": "素材は乾燥と選別を施され、丈夫な加工材へ仕立て直された。",
        "rewardItems": [
            {
                "id": 2009,
                "count": 1
            },
            {
                "id": 2025,
                "count": 1
            }
        ],
        "requiredRank": "F",
        "guildExp": 28,
        "guildPoints": 10,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_kazaria_materials",
        "regionKey": "WIND_VILLAGE",
        "requestType": "delivery",
        "reportAt": "guildReception",
        "sortOrder": 40
    },
    "guild_rivaria_patrol": {
        "name": "水路灯の警備",
        "area": "海底神殿",
        "kind": "hunt",
        "unlockFlags": [
            "waterCityCleared"
        ],
        "objective": "海底神殿内で魔物を合計6体討伐する。",
        "startText": "水路の安全を保つため、海底神殿に残る魔物の掃討を頼まれた。種類は問わない。",
        "progressText": "海底神殿内で魔物を6体討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetCount": 6,
        "completeText": "海底神殿へ続く水路の安全が確認され、船大工から補給品を受け取った。",
        "rewardItems": [
            {
                "id": 3,
                "count": 2
            },
            {
                "id": 2050,
                "count": 1
            }
        ],
        "requiredRank": "F",
        "guildExp": 32,
        "guildPoints": 12,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_rivaria_patrol",
        "regionKey": "WATER_CITY",
        "requestType": "dungeonHunt",
        "reportAt": "guildReception",
        "sortOrder": 50,
        "huntScope": {
            "mode": "dungeon",
            "areaKeys": [
                "SEABED_TEMPLE"
            ],
            "label": "海底神殿"
        }
    },
    "guild_rivaria_alchemy": {
        "name": "水薬の濃縮交換",
        "area": "水上都市リヴァリア",
        "kind": "collection",
        "unlockFlags": [
            "waterCityCleared"
        ],
        "objective": "青い薬4個と小さな魔石2個を納品し、上位素材に交換する。",
        "startText": "錬金所が低濃度の水薬と魔石を集め、濃縮素材へ加工している。",
        "progressText": "青い薬4個と小さな魔石2個を集め、ライザーク要塞のギルド受付へ報告しよう。",
        "itemRequirements": [
            {
                "id": 2049,
                "count": 4
            },
            {
                "id": 2017,
                "count": 2
            }
        ],
        "consumeItemsOnComplete": true,
        "completeText": "水薬と魔石は濃縮され、より高位の素材へ変わった。",
        "rewardItems": [
            {
                "id": 2050,
                "count": 1
            },
            {
                "id": 2018,
                "count": 1
            }
        ],
        "requiredRank": "E",
        "guildExp": 42,
        "guildPoints": 15,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_rivaria_alchemy",
        "regionKey": "WATER_CITY",
        "requestType": "delivery",
        "reportAt": "guildReception",
        "sortOrder": 60
    },
    "guild_lighthouse_patrol": {
        "name": "灯台下層の掃討",
        "area": "大灯台",
        "kind": "hunt",
        "unlockFlags": [
            "bigTowerCleared"
        ],
        "objective": "大灯台内で魔物を合計6体討伐する。",
        "startText": "灯台守から、補修隊を妨げる大灯台内の魔物を掃討してほしいと頼まれた。種類は問わない。",
        "progressText": "大灯台内で魔物を6体討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetCount": 6,
        "completeText": "補修隊の通路が確保され、灯台の備蓄品を受け取った。",
        "rewardItems": [
            {
                "id": 4,
                "count": 1
            },
            {
                "id": 2026,
                "count": 1
            }
        ],
        "requiredRank": "E",
        "guildExp": 46,
        "guildPoints": 17,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_lighthouse_patrol",
        "regionKey": "BIG_TOWER",
        "requestType": "dungeonHunt",
        "reportAt": "guildReception",
        "sortOrder": 70,
        "huntScope": {
            "mode": "dungeon",
            "areaKeys": [
                "BIG_TOWER"
            ],
            "label": "大灯台"
        }
    },
    "guild_lighthouse_materials": {
        "name": "高所補修材の調達",
        "area": "大灯台",
        "kind": "collection",
        "unlockFlags": [
            "bigTowerCleared"
        ],
        "objective": "鷹の羽3個と小さな魔石2個を納品し、上位素材に交換する。",
        "startText": "強風に耐える補修材を作るため、軽い羽と魔石を集めている。",
        "progressText": "鷹の羽3個と小さな魔石2個を集め、ライザーク要塞のギルド受付へ報告しよう。",
        "itemRequirements": [
            {
                "id": 2025,
                "count": 3
            },
            {
                "id": 2017,
                "count": 2
            }
        ],
        "consumeItemsOnComplete": true,
        "completeText": "素材は塔の風で鍛えられ、より強い補修材へ加工された。",
        "rewardItems": [
            {
                "id": 2026,
                "count": 1
            },
            {
                "id": 2018,
                "count": 1
            }
        ],
        "requiredRank": "D",
        "guildExp": 58,
        "guildPoints": 21,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_lighthouse_materials",
        "regionKey": "BIG_TOWER",
        "requestType": "delivery",
        "reportAt": "guildReception",
        "sortOrder": 80
    },
    "guild_raizark_patrol": {
        "name": "残雷区画の巡回",
        "area": "ライザーク要塞",
        "kind": "hunt",
        "unlockFlags": [
            "thunderFortCleared"
        ],
        "objective": "ライザーク要塞の戦闘区画で魔物を合計7体討伐する。",
        "startText": "要塞の再利用に向け、戦闘区画に残る魔物の討伐を依頼された。種類は問わない。",
        "progressText": "ライザーク要塞内の通常戦闘で魔物を7体討伐し、1階のギルド受付へ報告しよう。",
        "targetCount": 7,
        "completeText": "巡回路が開通し、補給隊から整備用の素材を受け取った。",
        "rewardItems": [
            {
                "id": 13,
                "count": 1
            },
            {
                "id": 2003,
                "count": 1
            }
        ],
        "requiredRank": "D",
        "guildExp": 64,
        "guildPoints": 24,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_raizark_patrol",
        "regionKey": "THUNDER_FORT",
        "requestType": "dungeonHunt",
        "reportAt": "guildReception",
        "sortOrder": 90,
        "huntScope": {
            "mode": "dungeon",
            "areaKeys": [
                "THUNDER_FORT"
            ],
            "label": "ライザーク要塞"
        }
    },
    "guild_raizark_refining": {
        "name": "要塞部材の再精製",
        "area": "ライザーク要塞",
        "kind": "collection",
        "unlockFlags": [
            "thunderFortCleared"
        ],
        "objective": "黒鉄3個と歪な骨2個を納品し、上位素材に交換する。",
        "startText": "壊れた機構を直すため、強度の異なる部材をまとめて再精製するという。",
        "progressText": "黒鉄3個と歪な骨2個を集め、ライザーク要塞のギルド受付へ報告しよう。",
        "itemRequirements": [
            {
                "id": 2002,
                "count": 3
            },
            {
                "id": 2058,
                "count": 2
            }
        ],
        "consumeItemsOnComplete": true,
        "completeText": "部材は要塞炉で再精製され、高位の素材へ変わった。",
        "rewardItems": [
            {
                "id": 2003,
                "count": 1
            },
            {
                "id": 2059,
                "count": 1
            }
        ],
        "requiredRank": "C",
        "guildExp": 82,
        "guildPoints": 30,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_raizark_refining",
        "regionKey": "THUNDER_FORT",
        "requestType": "delivery",
        "reportAt": "guildReception",
        "sortOrder": 100
    },
    "guild_prisma_patrol": {
        "name": "白光回廊の浄掃",
        "area": "光の宮殿グランプリズマ",
        "kind": "hunt",
        "unlockFlags": [
            "lightPalaceCleared"
        ],
        "objective": "光の宮殿グランプリズマ内でプリズムウィスプと聖域のセンチネルを合計7体討伐する。",
        "startText": "巡礼路を再開するため、白光回廊に残る魔物の討伐を頼まれた。",
        "progressText": "光の宮殿でプリズムウィスプと聖域のセンチネルを討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetMonsterIds": [
            603,
            605
        ],
        "targetCount": 7,
        "completeText": "巡礼路の安全が確認され、聖薬所から謝礼を受け取った。",
        "rewardItems": [
            {
                "id": 14,
                "count": 1
            },
            {
                "id": 2021,
                "count": 1
            }
        ],
        "requiredRank": "C",
        "guildExp": 90,
        "guildPoints": 34,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_prisma_patrol",
        "regionKey": "LIGHT_PALACE",
        "requestType": "hunt",
        "reportAt": "guildReception",
        "sortOrder": 110,
        "huntScope": {
            "mode": "monster",
            "areaKeys": [
                "LIGHT_PALACE"
            ],
            "label": "光の宮殿グランプリズマ"
        },
        "spawnAreaLabel": "光の宮殿グランプリズマ"
    },
    "guild_prisma_sublimation": {
        "name": "聖光素材の昇華",
        "area": "光の宮殿グランプリズマ",
        "kind": "collection",
        "unlockFlags": [
            "lightPalaceCleared"
        ],
        "objective": "魔力結晶3個と精霊鳥の羽2個を納品し、上位素材に交換する。",
        "startText": "宮殿の工房が、光を通す素材を選別して昇華加工を行っている。",
        "progressText": "魔力結晶3個と精霊鳥の羽2個を集め、ライザーク要塞のギルド受付へ報告しよう。",
        "itemRequirements": [
            {
                "id": 2020,
                "count": 3
            },
            {
                "id": 2028,
                "count": 2
            }
        ],
        "consumeItemsOnComplete": true,
        "completeText": "素材は白光の炉で昇華され、希少な上位素材になった。",
        "rewardItems": [
            {
                "id": 2021,
                "count": 1
            },
            {
                "id": 2029,
                "count": 1
            }
        ],
        "requiredRank": "B",
        "guildExp": 118,
        "guildPoints": 42,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_prisma_sublimation",
        "regionKey": "LIGHT_PALACE",
        "requestType": "delivery",
        "reportAt": "guildReception",
        "sortOrder": 120
    },
    "guild_galvania_patrol": {
        "name": "魔城回廊の魔掃戦",
        "area": "魔王城ガルヴァニア",
        "kind": "hunt",
        "unlockFlags": [
            "darkCastleCleared"
        ],
        "objective": "魔王城ガルヴァニア内でダークバトラー強とアークバットを合計8体討伐する。",
        "startText": "城内の修復路を確保するため、魔王城に残る魔物の討伐を依頼された。",
        "progressText": "魔王城ガルヴァニア内でダークバトラー強とアークバットを討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetMonsterIds": [
            753,
            751
        ],
        "targetCount": 8,
        "completeText": "城門周辺の安全が戻り、闇市の商人から謝礼を受け取った。",
        "rewardItems": [
            {
                "id": 1040,
                "count": 1
            },
            {
                "id": 2005,
                "count": 1
            }
        ],
        "requiredRank": "B",
        "guildExp": 130,
        "guildPoints": 48,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_galvania_patrol",
        "regionKey": "DARK_CASTLE",
        "requestType": "hunt",
        "reportAt": "guildReception",
        "sortOrder": 130,
        "huntScope": {
            "mode": "monster",
            "areaKeys": [
                "DARK_CASTLE"
            ],
            "label": "魔王城ガルヴァニア"
        },
        "spawnAreaLabel": "魔王城ガルヴァニア"
    },
    "guild_galvania_refining": {
        "name": "魔城炉の高位精錬",
        "area": "魔王城ガルヴァニア",
        "kind": "collection",
        "unlockFlags": [
            "darkCastleCleared"
        ],
        "objective": "オリハルコンの欠片3個と水竜の血2個を納品し、上位素材に交換する。",
        "startText": "魔城炉の再点火に伴い、希少素材をさらに高位へ精錬する試みが始まった。",
        "progressText": "オリハルコンの欠片3個と水竜の血2個を集め、ライザーク要塞のギルド受付へ報告しよう。",
        "itemRequirements": [
            {
                "id": 2004,
                "count": 3
            },
            {
                "id": 2052,
                "count": 2
            }
        ],
        "consumeItemsOnComplete": true,
        "completeText": "希少素材は魔城炉の熱に耐え、さらに純度の高い素材へ変わった。",
        "rewardItems": [
            {
                "id": 2005,
                "count": 1
            },
            {
                "id": 2053,
                "count": 1
            }
        ],
        "requiredRank": "A",
        "guildExp": 172,
        "guildPoints": 60,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_galvania_refining",
        "regionKey": "DARK_CASTLE",
        "requestType": "delivery",
        "reportAt": "guildReception",
        "sortOrder": 140
    },
    "guild_abyss_suppression": {
        "name": "魔窟裂界の鎮圧",
        "area": "深淵の魔窟",
        "kind": "hunt",
        "unlockFlags": [
            "abyssRandomUnlocked"
        ],
        "objective": "深淵の魔窟 地下71～75階に出現する終焔執事スルト、凍獄執事コキュートス、轟雷執事バアルを合計10体討伐する。",
        "startText": "深淵の観測路を維持するため、魔窟内に群れる指定魔物の鎮圧を頼まれた。",
        "progressText": "深淵の魔窟 地下71～75階で指定された魔物を討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetMonsterIds": [
            1702,
            1703,
            1701
        ],
        "targetCount": 10,
        "completeText": "外縁の揺らぎが弱まり、観測隊の貴重な備蓄品を受け取った。",
        "rewardItems": [
            {
                "id": 1042,
                "count": 1
            },
            {
                "id": 2061,
                "count": 1
            }
        ],
        "requiredRank": "A",
        "guildExp": 280,
        "guildPoints": 110,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_abyss_suppression",
        "regionKey": "ABYSS_FIELD",
        "requestType": "hunt",
        "reportAt": "guildReception",
        "sortOrder": 150,
        "huntScope": {
            "mode": "monster",
            "areaKeys": [
                "ABYSS"
            ],
            "label": "ランダム深淵",
            "abyssMode": "random"
        },
        "spawnAreaLabel": "ランダム深淵 地下71～75階",
        "requiredMaxAbyssFloor": 71
    },
    "guild_abyss_patrol_051_060": {
        "name": "深淵巡回・水炎の境界",
        "area": "極寒樹林・煉獄山脈周辺",
        "kind": "hunt",
        "unlockFlags": ["abyssFirstBarrierCleared"],
        "objective": "極寒樹林、氷刻の浄罪路、煉獄山脈、灼熱の古城で通常戦闘の魔物を合計8体討伐する。",
        "startText": "ビスタの北に広がる水と炎の領域で、街道を脅かす魔物の間引きを頼みたい。種類は問わない。",
        "progressText": "水と炎の領域で通常戦闘の魔物を8体討伐し、冒険者ギルドへ報告しよう。",
        "targetCount": 8,
        "completeText": "二つの街道の安全が確保され、深淵由来の補給品を受け取った。",
        "rewardItems": [{"id":1041,"count":1},{"id":2019,"count":1}],
        "requiredRank": "D",
        "guildExp": 216,
        "guildPoints": 85,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_abyss_patrol_051_060",
        "regionKey": "ABYSS_WORLD",
        "requestType": "hunt",
        "reportAt": "guildReception",
        "sortOrder": 151,
        "huntScope": {
            "mode": "monster",
            "areaKeys": ["FROZEN_FOREST","ICE_PENANCE_ROAD","PURGATORY_MOUNTAINS","SCORCHING_OLD_CASTLE"],
            "label": "水と炎の領域",
            "normalBattlesOnly": true
        }
    },
    "guild_abyss_patrol_081_090": {
        "name": "深淵巡回・光闇の深層",
        "area": "夢幻回廊リドパルム・災禍の根ジャゴレア",
        "kind": "hunt",
        "unlockFlags": ["abyssLegacionNorthGateOpen"],
        "objective": "夢幻回廊リドパルムと災禍の根ジャゴレアで通常戦闘の魔物を合計9体討伐する。",
        "startText": "レガシオン北方の光と闇が交わる領域で、調査路を確保するための討伐依頼が出ている。",
        "progressText": "リドパルムかジャゴレアで通常戦闘の魔物を9体討伐し、冒険者ギルドへ報告しよう。",
        "targetCount": 9,
        "completeText": "北方調査路が安定し、希少な深淵素材が支給された。",
        "rewardItems": [{"id":1042,"count":1},{"id":2021,"count":1}],
        "requiredRank": "C",
        "guildExp": 308,
        "guildPoints": 122,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_abyss_patrol_081_090",
        "regionKey": "ABYSS_WORLD",
        "requestType": "hunt",
        "reportAt": "guildReception",
        "sortOrder": 152,
        "huntScope": {
            "mode": "monster",
            "areaKeys": ["RIDPALM_DREAM_CORRIDOR","JAGOREA_ROOT"],
            "label": "光と闇の深層",
            "normalBattlesOnly": true
        }
    },
    "guild_abyss_patrol_111_120": {
        "name": "ランダム深淵巡回・第十一～二十階",
        "area": "ランダム深淵 地下11～20階",
        "kind": "hunt",
        "unlockFlags": [
            "abyssRandomUnlocked"
        ],
        "requiredMaxAbyssFloor": 20,
        "objective": "ランダム深淵 地下11～20階で、通常戦闘の魔物を合計10体討伐する。",
        "startText": "ランダム深淵、第十一階から二十階の観測路を守る掃討依頼が発行された。",
        "progressText": "ランダム深淵 地下11～20階で通常戦闘の魔物を10体討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetCount": 10,
        "completeText": "観測器の搬入路が開かれ、深層由来の素材を受け取った。",
        "rewardItems": [
            {
                "id": 1043,
                "count": 1
            },
            {
                "id": 2022,
                "count": 1
            }
        ],
        "requiredRank": "B",
        "guildExp": 400,
        "guildPoints": 159,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_abyss_patrol_111_120",
        "regionKey": "ABYSS",
        "requestType": "hunt",
        "reportAt": "guildReception",
        "sortOrder": 153,
        "huntScope": {
            "mode": "floorRange",
            "areaKeys": [
                "ABYSS"
            ],
            "label": "ランダム深淵",
            "floorMin": 11,
            "floorMax": 20,
            "abyssMode": "random",
            "normalBattlesOnly": true
        }
    },
    "guild_abyss_patrol_151_160": {
        "name": "ランダム深淵巡回・第五十一～六十階",
        "area": "ランダム深淵 地下51～60階",
        "kind": "hunt",
        "unlockFlags": [
            "abyssRandomUnlocked"
        ],
        "requiredMaxAbyssFloor": 60,
        "objective": "ランダム深淵 地下51～60階で、通常戦闘の魔物を合計12体討伐する。",
        "startText": "ランダム深淵の第五十一階以降について、精鋭向けの掃討依頼が届いた。",
        "progressText": "ランダム深淵 地下51～60階で通常戦闘の魔物を12体討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetCount": 12,
        "completeText": "深層の魔物が減り、観測隊から最上級の育成資源を受け取った。",
        "rewardItems": [
            {
                "id": 106,
                "count": 1
            },
            {
                "id": 2007,
                "count": 1
            }
        ],
        "requiredRank": "A",
        "guildExp": 524,
        "guildPoints": 209,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_abyss_patrol_151_160",
        "regionKey": "ABYSS",
        "requestType": "hunt",
        "reportAt": "guildReception",
        "sortOrder": 154,
        "huntScope": {
            "mode": "floorRange",
            "areaKeys": [
                "ABYSS"
            ],
            "label": "ランダム深淵",
            "floorMin": 51,
            "floorMax": 60,
            "abyssMode": "random",
            "normalBattlesOnly": true
        }
    },
    "guild_abyss_patrol_191_200": {
        "name": "ランダム深淵巡回・第九十一～百階",
        "area": "ランダム深淵 地下91～100階",
        "kind": "hunt",
        "unlockFlags": [
            "abyssRandomUnlocked"
        ],
        "requiredMaxAbyssFloor": 100,
        "objective": "ランダム深淵 地下91～100階で、通常戦闘の魔物を合計15体討伐する。",
        "startText": "ランダム深淵の第九十一階から百階について、最高位冒険者向けの掃討依頼が発行された。",
        "progressText": "ランダム深淵 地下91～100階で通常戦闘の魔物を15体討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetCount": 15,
        "completeText": "最深層の観測路が確保され、ギルド最高位の報奨を受け取った。",
        "rewardItems": [
            {
                "id": 107,
                "count": 1
            },
            {
                "id": 2063,
                "count": 1
            }
        ],
        "requiredRank": "S",
        "guildExp": 650,
        "guildPoints": 260,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_abyss_patrol_191_200",
        "regionKey": "ABYSS",
        "requestType": "hunt",
        "reportAt": "guildReception",
        "sortOrder": 155,
        "huntScope": {
            "mode": "floorRange",
            "areaKeys": [
                "ABYSS"
            ],
            "label": "ランダム深淵",
            "floorMin": 91,
            "floorMax": 100,
            "abyssMode": "random",
            "normalBattlesOnly": true
        }
    },
    "guild_abyss_stabilization": {
        "name": "深淵素材の定着",
        "area": "深淵の魔窟 外縁",
        "kind": "collection",
        "unlockFlags": [
            "abyssRandomUnlocked"
        ],
        "objective": "世界の欠片2個と幻獣の毛皮2個を納品し、最上位素材に交換する。",
        "startText": "観測隊が、深淵で変質する素材を安定化させる実験を行っている。",
        "progressText": "世界の欠片2個と幻獣の毛皮2個を集め、ライザーク要塞のギルド受付へ報告しよう。",
        "itemRequirements": [
            {
                "id": 2061,
                "count": 2
            },
            {
                "id": 2045,
                "count": 2
            }
        ],
        "consumeItemsOnComplete": true,
        "completeText": "素材は裂界の圧力に定着し、最上位の加工素材へ変わった。",
        "rewardItems": [
            {
                "id": 2062,
                "count": 1
            },
            {
                "id": 2046,
                "count": 1
            }
        ],
        "requiredRank": "S",
        "guildExp": 250,
        "guildPoints": 90,
        "guildQuest": true,
        "rarity": "R",
        "repeatable": true,
        "id": "guild_abyss_stabilization",
        "regionKey": "ABYSS_FIELD",
        "requestType": "delivery",
        "reportAt": "guildReception",
        "sortOrder": 160
    }
};


    // 自動生成依頼の正本。実際に掲示される依頼は guild.js 側でこのテンプレートから生成し、
    // 生成結果そのものをセーブへ保存する。受注後に再読込しても討伐数・報酬・対象範囲は変化しない。
    const GUILD_QUEST_GENERATOR_MASTER = {
        schemaVersion: 6,
        generatedOfferRatio: 0.75,
        normalHunts: [
            {
                key: 'ignis',
                baseQuestId: 'guild_ignis_patrol',
                countMin: 4,
                countMax: 9,
                expPerExtraKill: 4,
                pointsPerExtraKill: 2,
                names: ['火山道の臨時掃討', '炉辺の安全確保', '煤煙路の魔物払い']
            },
            {
                key: 'kazaria',
                baseQuestId: 'guild_kazaria_patrol',
                countMin: 5,
                countMax: 10,
                expPerExtraKill: 5,
                pointsPerExtraKill: 2,
                names: ['迷い路の臨時掃討', '森道の安全確保', '禁忌の森・巡回任務']
            },
            {
                key: 'rivaria',
                baseQuestId: 'guild_rivaria_patrol',
                countMin: 5,
                countMax: 11,
                expPerExtraKill: 6,
                pointsPerExtraKill: 2,
                names: ['沈水回廊の掃討', '海底神殿・巡回任務', '水路保全の討伐依頼']
            },
            {
                key: 'lighthouse',
                baseQuestId: 'guild_lighthouse_patrol',
                countMin: 6,
                countMax: 12,
                expPerExtraKill: 7,
                pointsPerExtraKill: 3,
                names: ['大灯台の巡回掃討', '機関区画の安全確保', '灯台守の討伐依頼']
            },
            {
                key: 'raizark',
                baseQuestId: 'guild_raizark_patrol',
                countMin: 7,
                countMax: 13,
                expPerExtraKill: 8,
                pointsPerExtraKill: 3,
                names: ['要塞区画の臨時掃討', '雷路の安全確保', 'ライザーク巡回任務']
            },
            {
                key: 'prisma',
                baseQuestId: 'guild_prisma_patrol',
                countMin: 7,
                countMax: 14,
                expPerExtraKill: 10,
                pointsPerExtraKill: 4,
                forceDungeonHunt: true,
                names: ['光廊の臨時掃討', '宮殿区画の安全確保', 'グランプリズマ巡回任務']
            },
            {
                key: 'galvania',
                baseQuestId: 'guild_galvania_patrol',
                countMin: 8,
                countMax: 15,
                expPerExtraKill: 12,
                pointsPerExtraKill: 5,
                forceDungeonHunt: true,
                names: ['魔王城外郭の掃討', '暗黒回廊の安全確保', 'ガルヴァニア巡回任務']
            }
        ],
        challengeDungeons: {
            enabled: true,
            minGuildRank: 'C',
            minRarity: 'SSR',
            maxOffersOnBoard: 2,
            offerWeight: 0.48,
            floorRanges: {
                SSR: [3, 5],
                UR: [4, 7],
                EX: [5, 9]
            },
            bossOnlyChance: { SSR: 0, UR: 0.30, EX: 0.50 },
            themes: [
                { id: 'fire', label: '灼熱', element: '火', visualThemeIds: ['ignis-volcano'], names: ['灼熱迷宮の鎮圧', '炎獄の最深部調査'] },
                { id: 'water', label: '氷水', element: '水', visualThemeIds: ['seabed-temple', 'crena-cave'], names: ['氷水回廊の鎮圧', '蒼海迷宮の最深部調査'] },
                { id: 'wind', label: '暴風', element: '風', visualThemeIds: ['forbidden-forest', 'forest-wind-hole'], names: ['暴風迷宮の踏破', '風穴深部の討伐任務'] },
                { id: 'thunder', label: '雷霆', element: '雷', visualThemeIds: ['thunder-fort'], names: ['雷霆要塞の制圧', '帯電回廊の最深部調査'] },
                { id: 'light', label: '聖光', element: '光', visualThemeIds: ['light-palace', 'great-lighthouse'], names: ['聖光迷宮の踏破', '光廊最深部の討伐任務'] },
                { id: 'dark', label: '暗黒', element: '闇', visualThemeIds: ['dark-castle', 'dark-shrine', 'galvania-cave'], names: ['暗黒迷宮の鎮圧', '魔城深部の討伐任務'] }
            ],
            gimmicks: [
                { id: 'element50', label: '敵のテーマ属性攻撃+50%', minRarity: 'SSR' },
                { id: 'regen10', label: '敵全員が再生Lv10', minRarity: 'SSR' },
                { id: 'guts10', label: '敵全員が根性Lv10', minRarity: 'UR' },
                { id: 'rare50_toxic', label: 'レアモンスター率50%／味方は常に猛毒', minRarity: 'EX' },
                { id: 'rare50_elite', label: 'レアモンスター率50%／レア以外は超強敵', minRarity: 'EX' }
            ]
        },
        abyss: {
            enabled: true,
            maxOffersOnBoard: 2,
            offerWeight: 0.35,
            bandSize: 10,
            minFloor: 1,
            maxFloor: 200,
            countBaseMin: 5,
            countBaseMax: 8,
            countStepEveryBands: 4,
            expBase: 20,
            expPerBand: 30,
            expPerKill: 2,
            pointsBase: 5,
            pointsPerBand: 12,
            pointsPerKill: 1,
            names: ['深淵巡回', '観測路掃討', '裂界警戒'],
            rankBands: [
                { maxFloor: 20, rank: 'G' },
                { maxFloor: 40, rank: 'F' },
                { maxFloor: 50, rank: 'E' },
                { maxFloor: 70, rank: 'D' },
                { maxFloor: 100, rank: 'C' },
                { maxFloor: 140, rank: 'B' },
                { maxFloor: 180, rank: 'A' },
                { maxFloor: 999, rank: 'S' }
            ]
        }
    };

    root.GUILD_QUEST_SCHEMA_VERSION = GUILD_QUEST_SCHEMA_VERSION;
    root.GUILD_QUEST_LEGACY_ID_MAP = GUILD_QUEST_LEGACY_ID_MAP;
    root.GUILD_QUEST_DATA = GUILD_QUEST_DATA;
    root.GUILD_QUEST_GENERATOR_MASTER = GUILD_QUEST_GENERATOR_MASTER;
})(globalThis);
