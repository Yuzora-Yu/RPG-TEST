/* ==========================================================================
   Phase2G 鍛冶正式マスター
   - 起動時生成や装備Rankからの場当たり計算を行わず、この静的レコードを正本とする。
   - 既存素材マスター（8カテゴリ×8グレード、ID 2000-2063）を参照する。
   ========================================================================== */
(() => {
    'use strict';

    const MATERIAL_UPGRADE_RECIPES = [
    {
        "id": "武器-G",
        "part": "武器",
        "grade": "G",
        "minRank": 1,
        "maxRank": 10,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2000,
                    "count": 2
                },
                {
                    "itemId": 2032,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2000,
                    "count": 3
                },
                {
                    "itemId": 2032,
                    "count": 1
                }
            ]
        }
    },
    {
        "id": "武器-F",
        "part": "武器",
        "grade": "F",
        "minRank": 11,
        "maxRank": 25,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2001,
                    "count": 2
                },
                {
                    "itemId": 2033,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2001,
                    "count": 3
                },
                {
                    "itemId": 2033,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "武器-E",
        "part": "武器",
        "grade": "E",
        "minRank": 26,
        "maxRank": 45,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2002,
                    "count": 3
                },
                {
                    "itemId": 2034,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2002,
                    "count": 4
                },
                {
                    "itemId": 2034,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "武器-D",
        "part": "武器",
        "grade": "D",
        "minRank": 46,
        "maxRank": 65,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2003,
                    "count": 3
                },
                {
                    "itemId": 2035,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2003,
                    "count": 4
                },
                {
                    "itemId": 2035,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "武器-C",
        "part": "武器",
        "grade": "C",
        "minRank": 66,
        "maxRank": 85,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2004,
                    "count": 4
                },
                {
                    "itemId": 2036,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2004,
                    "count": 5
                },
                {
                    "itemId": 2036,
                    "count": 3
                }
            ]
        }
    },
    {
        "id": "武器-B",
        "part": "武器",
        "grade": "B",
        "minRank": 86,
        "maxRank": 110,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2005,
                    "count": 4
                },
                {
                    "itemId": 2037,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2005,
                    "count": 6
                },
                {
                    "itemId": 2037,
                    "count": 3
                }
            ]
        }
    },
    {
        "id": "武器-A",
        "part": "武器",
        "grade": "A",
        "minRank": 111,
        "maxRank": 150,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2006,
                    "count": 5
                },
                {
                    "itemId": 2038,
                    "count": 3
                },
                {
                    "itemId": 2062,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2006,
                    "count": 7
                },
                {
                    "itemId": 2038,
                    "count": 4
                },
                {
                    "itemId": 2062,
                    "count": 1
                }
            ]
        }
    },
    {
        "id": "武器-S",
        "part": "武器",
        "grade": "S",
        "minRank": 151,
        "maxRank": 9999,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2007,
                    "count": 6
                },
                {
                    "itemId": 2039,
                    "count": 3
                },
                {
                    "itemId": 2063,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2007,
                    "count": 8
                },
                {
                    "itemId": 2039,
                    "count": 5
                },
                {
                    "itemId": 2063,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "盾-G",
        "part": "盾",
        "grade": "G",
        "minRank": 1,
        "maxRank": 10,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2000,
                    "count": 2
                },
                {
                    "itemId": 2008,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2000,
                    "count": 3
                },
                {
                    "itemId": 2008,
                    "count": 1
                }
            ]
        }
    },
    {
        "id": "盾-F",
        "part": "盾",
        "grade": "F",
        "minRank": 11,
        "maxRank": 25,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2001,
                    "count": 2
                },
                {
                    "itemId": 2009,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2001,
                    "count": 3
                },
                {
                    "itemId": 2009,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "盾-E",
        "part": "盾",
        "grade": "E",
        "minRank": 26,
        "maxRank": 45,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2002,
                    "count": 3
                },
                {
                    "itemId": 2010,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2002,
                    "count": 4
                },
                {
                    "itemId": 2010,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "盾-D",
        "part": "盾",
        "grade": "D",
        "minRank": 46,
        "maxRank": 65,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2003,
                    "count": 3
                },
                {
                    "itemId": 2011,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2003,
                    "count": 4
                },
                {
                    "itemId": 2011,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "盾-C",
        "part": "盾",
        "grade": "C",
        "minRank": 66,
        "maxRank": 85,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2004,
                    "count": 4
                },
                {
                    "itemId": 2012,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2004,
                    "count": 5
                },
                {
                    "itemId": 2012,
                    "count": 3
                }
            ]
        }
    },
    {
        "id": "盾-B",
        "part": "盾",
        "grade": "B",
        "minRank": 86,
        "maxRank": 110,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2005,
                    "count": 4
                },
                {
                    "itemId": 2013,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2005,
                    "count": 6
                },
                {
                    "itemId": 2013,
                    "count": 3
                }
            ]
        }
    },
    {
        "id": "盾-A",
        "part": "盾",
        "grade": "A",
        "minRank": 111,
        "maxRank": 150,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2006,
                    "count": 5
                },
                {
                    "itemId": 2014,
                    "count": 3
                },
                {
                    "itemId": 2062,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2006,
                    "count": 7
                },
                {
                    "itemId": 2014,
                    "count": 4
                },
                {
                    "itemId": 2062,
                    "count": 1
                }
            ]
        }
    },
    {
        "id": "盾-S",
        "part": "盾",
        "grade": "S",
        "minRank": 151,
        "maxRank": 9999,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2007,
                    "count": 6
                },
                {
                    "itemId": 2015,
                    "count": 3
                },
                {
                    "itemId": 2063,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2007,
                    "count": 8
                },
                {
                    "itemId": 2015,
                    "count": 5
                },
                {
                    "itemId": 2063,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "頭-G",
        "part": "頭",
        "grade": "G",
        "minRank": 1,
        "maxRank": 10,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2024,
                    "count": 2
                },
                {
                    "itemId": 2016,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2024,
                    "count": 3
                },
                {
                    "itemId": 2016,
                    "count": 1
                }
            ]
        }
    },
    {
        "id": "頭-F",
        "part": "頭",
        "grade": "F",
        "minRank": 11,
        "maxRank": 25,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2025,
                    "count": 2
                },
                {
                    "itemId": 2017,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2025,
                    "count": 3
                },
                {
                    "itemId": 2017,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "頭-E",
        "part": "頭",
        "grade": "E",
        "minRank": 26,
        "maxRank": 45,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2026,
                    "count": 3
                },
                {
                    "itemId": 2018,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2026,
                    "count": 4
                },
                {
                    "itemId": 2018,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "頭-D",
        "part": "頭",
        "grade": "D",
        "minRank": 46,
        "maxRank": 65,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2027,
                    "count": 3
                },
                {
                    "itemId": 2019,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2027,
                    "count": 4
                },
                {
                    "itemId": 2019,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "頭-C",
        "part": "頭",
        "grade": "C",
        "minRank": 66,
        "maxRank": 85,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2028,
                    "count": 4
                },
                {
                    "itemId": 2020,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2028,
                    "count": 5
                },
                {
                    "itemId": 2020,
                    "count": 3
                }
            ]
        }
    },
    {
        "id": "頭-B",
        "part": "頭",
        "grade": "B",
        "minRank": 86,
        "maxRank": 110,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2029,
                    "count": 4
                },
                {
                    "itemId": 2021,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2029,
                    "count": 6
                },
                {
                    "itemId": 2021,
                    "count": 3
                }
            ]
        }
    },
    {
        "id": "頭-A",
        "part": "頭",
        "grade": "A",
        "minRank": 111,
        "maxRank": 150,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2030,
                    "count": 5
                },
                {
                    "itemId": 2022,
                    "count": 3
                },
                {
                    "itemId": 2062,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2030,
                    "count": 7
                },
                {
                    "itemId": 2022,
                    "count": 4
                },
                {
                    "itemId": 2062,
                    "count": 1
                }
            ]
        }
    },
    {
        "id": "頭-S",
        "part": "頭",
        "grade": "S",
        "minRank": 151,
        "maxRank": 9999,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2031,
                    "count": 6
                },
                {
                    "itemId": 2023,
                    "count": 3
                },
                {
                    "itemId": 2063,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2031,
                    "count": 8
                },
                {
                    "itemId": 2023,
                    "count": 5
                },
                {
                    "itemId": 2063,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "体-G",
        "part": "体",
        "grade": "G",
        "minRank": 1,
        "maxRank": 10,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2040,
                    "count": 2
                },
                {
                    "itemId": 2048,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2040,
                    "count": 3
                },
                {
                    "itemId": 2048,
                    "count": 1
                }
            ]
        }
    },
    {
        "id": "体-F",
        "part": "体",
        "grade": "F",
        "minRank": 11,
        "maxRank": 25,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2041,
                    "count": 2
                },
                {
                    "itemId": 2049,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2041,
                    "count": 3
                },
                {
                    "itemId": 2049,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "体-E",
        "part": "体",
        "grade": "E",
        "minRank": 26,
        "maxRank": 45,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2042,
                    "count": 3
                },
                {
                    "itemId": 2050,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2042,
                    "count": 4
                },
                {
                    "itemId": 2050,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "体-D",
        "part": "体",
        "grade": "D",
        "minRank": 46,
        "maxRank": 65,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2043,
                    "count": 3
                },
                {
                    "itemId": 2051,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2043,
                    "count": 4
                },
                {
                    "itemId": 2051,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "体-C",
        "part": "体",
        "grade": "C",
        "minRank": 66,
        "maxRank": 85,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2044,
                    "count": 4
                },
                {
                    "itemId": 2052,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2044,
                    "count": 5
                },
                {
                    "itemId": 2052,
                    "count": 3
                }
            ]
        }
    },
    {
        "id": "体-B",
        "part": "体",
        "grade": "B",
        "minRank": 86,
        "maxRank": 110,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2045,
                    "count": 4
                },
                {
                    "itemId": 2053,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2045,
                    "count": 6
                },
                {
                    "itemId": 2053,
                    "count": 3
                }
            ]
        }
    },
    {
        "id": "体-A",
        "part": "体",
        "grade": "A",
        "minRank": 111,
        "maxRank": 150,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2046,
                    "count": 5
                },
                {
                    "itemId": 2054,
                    "count": 3
                },
                {
                    "itemId": 2062,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2046,
                    "count": 7
                },
                {
                    "itemId": 2054,
                    "count": 4
                },
                {
                    "itemId": 2062,
                    "count": 1
                }
            ]
        }
    },
    {
        "id": "体-S",
        "part": "体",
        "grade": "S",
        "minRank": 151,
        "maxRank": 9999,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2047,
                    "count": 6
                },
                {
                    "itemId": 2055,
                    "count": 3
                },
                {
                    "itemId": 2063,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2047,
                    "count": 8
                },
                {
                    "itemId": 2055,
                    "count": 5
                },
                {
                    "itemId": 2063,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "足-G",
        "part": "足",
        "grade": "G",
        "minRank": 1,
        "maxRank": 10,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2032,
                    "count": 2
                },
                {
                    "itemId": 2024,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2032,
                    "count": 3
                },
                {
                    "itemId": 2024,
                    "count": 1
                }
            ]
        }
    },
    {
        "id": "足-F",
        "part": "足",
        "grade": "F",
        "minRank": 11,
        "maxRank": 25,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2033,
                    "count": 2
                },
                {
                    "itemId": 2025,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2033,
                    "count": 3
                },
                {
                    "itemId": 2025,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "足-E",
        "part": "足",
        "grade": "E",
        "minRank": 26,
        "maxRank": 45,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2034,
                    "count": 3
                },
                {
                    "itemId": 2026,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2034,
                    "count": 4
                },
                {
                    "itemId": 2026,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "足-D",
        "part": "足",
        "grade": "D",
        "minRank": 46,
        "maxRank": 65,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2035,
                    "count": 3
                },
                {
                    "itemId": 2027,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2035,
                    "count": 4
                },
                {
                    "itemId": 2027,
                    "count": 2
                }
            ]
        }
    },
    {
        "id": "足-C",
        "part": "足",
        "grade": "C",
        "minRank": 66,
        "maxRank": 85,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2036,
                    "count": 4
                },
                {
                    "itemId": 2028,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2036,
                    "count": 5
                },
                {
                    "itemId": 2028,
                    "count": 3
                }
            ]
        }
    },
    {
        "id": "足-B",
        "part": "足",
        "grade": "B",
        "minRank": 86,
        "maxRank": 110,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2037,
                    "count": 4
                },
                {
                    "itemId": 2029,
                    "count": 2
                }
            ],
            "3": [
                {
                    "itemId": 2037,
                    "count": 6
                },
                {
                    "itemId": 2029,
                    "count": 3
                }
            ]
        }
    },
    {
        "id": "足-A",
        "part": "足",
        "grade": "A",
        "minRank": 111,
        "maxRank": 150,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2038,
                    "count": 5
                },
                {
                    "itemId": 2030,
                    "count": 3
                },
                {
                    "itemId": 2062,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2038,
                    "count": 7
                },
                {
                    "itemId": 2030,
                    "count": 4
                },
                {
                    "itemId": 2062,
                    "count": 1
                }
            ]
        }
    },
    {
        "id": "足-S",
        "part": "足",
        "grade": "S",
        "minRank": 151,
        "maxRank": 9999,
        "requirementsByTargetPlus": {
            "2": [
                {
                    "itemId": 2039,
                    "count": 6
                },
                {
                    "itemId": 2031,
                    "count": 3
                },
                {
                    "itemId": 2063,
                    "count": 1
                }
            ],
            "3": [
                {
                    "itemId": 2039,
                    "count": 8
                },
                {
                    "itemId": 2031,
                    "count": 5
                },
                {
                    "itemId": 2063,
                    "count": 2
                }
            ]
        }
    }
];

    const MASTER = {
        schemaVersion: 1,
        plusMultipliers: Object.freeze({ 0: 1.0, 1: 1.1, 2: 1.3, 3: 1.5 }),
        scalableStatKeys: Object.freeze(['atk', 'def', 'mag', 'mdef', 'spd', 'hp', 'mp']),
        materialUpgradeRecipes: Object.freeze(MATERIAL_UPGRADE_RECIPES.map(record => Object.freeze(record))),
        divineAnvilItemId: 599998,
        divineAnvilTargetRankDelta: 10
    };

    window.PRISMA_BLACKSMITH_MASTER = Object.freeze(MASTER);
})();
