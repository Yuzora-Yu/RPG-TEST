/* guild_quests.js - Adventurer Guild rotating request master (source of truth) */
(function(root) {
    'use strict';

    const GUILD_QUEST_SCHEMA_VERSION = 4;

    // 旧町別掲示板時代のセーブIDを、新しいギルド依頼IDへ一度だけ移行するための対応表。
    // 依頼内容そのものは下記 GUILD_QUEST_DATA のみを正本とする。
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
        "objective": "光の宮殿グランプリズマ内でダークバトラーとヒールフェアリーを合計7体討伐する。",
        "startText": "巡礼路を再開するため、白光回廊に残る魔物の討伐を頼まれた。",
        "progressText": "光の宮殿でダークバトラーとヒールフェアリーを討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetMonsterIds": [
            100060,
            100062
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
        }
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
        "objective": "魔王城ガルヴァニア内でデーモンソルジャーとアークバットを合計8体討伐する。",
        "startText": "城内の修復路を確保するため、魔王城に残る魔物の討伐を依頼された。",
        "progressText": "魔王城ガルヴァニア内でデーモンソルジャーとアークバットを討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetMonsterIds": [
            100068,
            100069
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
        }
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
            "abyssFirstEntered"
        ],
        "objective": "深淵の魔窟内でアクアリリィ、ジェリーキング、バトルリザードを合計10体討伐する。",
        "startText": "深淵の観測路を維持するため、魔窟内に群れる指定魔物の鎮圧を頼まれた。",
        "progressText": "深淵の魔窟内で指定された魔物を討伐し、ライザーク要塞のギルド受付へ報告しよう。",
        "targetMonsterIds": [
            100064,
            100066,
            100067
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
        "guildExp": 190,
        "guildPoints": 68,
        "guildQuest": true,
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
            "label": "深淵の魔窟"
        }
    },
    "guild_abyss_stabilization": {
        "name": "深淵素材の定着",
        "area": "深淵の魔窟 外縁",
        "kind": "collection",
        "unlockFlags": [
            "abyssFirstEntered"
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
        "repeatable": true,
        "id": "guild_abyss_stabilization",
        "regionKey": "ABYSS_FIELD",
        "requestType": "delivery",
        "reportAt": "guildReception",
        "sortOrder": 160
    }
};

    root.GUILD_QUEST_SCHEMA_VERSION = GUILD_QUEST_SCHEMA_VERSION;
    root.GUILD_QUEST_LEGACY_ID_MAP = GUILD_QUEST_LEGACY_ID_MAP;
    root.GUILD_QUEST_DATA = GUILD_QUEST_DATA;
})(globalThis);
