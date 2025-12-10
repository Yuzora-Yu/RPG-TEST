/* items.js */
window.ITEMS_DATA = [
    {
        "id": 1,
        "rank": 1,
        "name": "やくそう",
        "type": "HP回復",
        "val": 200,
        "desc": "HPを200回復",
        "target": "単体",
        "price": 10
    },
    {
        "id": 8,
        "rank": 1,
        "name": "毒消し草",
        "type": "状態異常回復",
        "cures": [
            "Poison",
            "ToxicPoison"
        ],
        "desc": "毒・猛毒を解毒する",
        "target": "単体",
        "price": 20
    },
    {
        "id": 3,
        "rank": 5,
        "name": "魔法の小瓶",
        "type": "MP回復",
        "val": 50,
        "desc": "MPを50回復",
        "target": "単体",
        "price": 100
    },
    {
        "id": 2,
        "rank": 5,
        "name": "上やくそう",
        "type": "HP回復",
        "val": 1000,
        "desc": "HPを1000回復",
        "target": "単体",
        "price": 50
    },
    {
        "id": 9,
        "rank": 10,
        "name": "やまびこ草",
        "type": "状態異常回復",
        "cures": [
            "SpellSeal"
        ],
        "desc": "呪文封印を解除する",
        "target": "単体",
        "price": 150
    },
    {
        "id": 10,
        "rank": 10,
        "name": "記憶の実",
        "type": "状態異常回復",
        "cures": [
            "SkillSeal"
        ],
        "desc": "特技封印を解除する",
        "target": "単体",
        "price": 150
    },
    {
        "id": 11,
        "rank": 10,
        "name": "妖精の涙",
        "type": "状態異常回復",
        "cures": [
            "HealSeal"
        ],
        "desc": "回復封印を解除する",
        "target": "単体",
        "price": 150
    },
    {
        "id": 4,
        "rank": 20,
        "name": "魔法の聖水",
        "type": "MP回復",
        "val": 500,
        "desc": "MPを500回復",
        "target": "単体",
        "price": 500
    },
    {
        "id": 5,
        "rank": 30,
        "name": "世界樹の葉",
        "type": "蘇生",
        "val": 100,
        "desc": "死んだ仲間を生き返らせる",
        "target": "単体",
        "price": 10000
    },
    {
        "id": 13,
        "rank": 40,
        "name": "超やくそう",
        "type": "HP回復",
        "val": 9999,
        "desc": "HPを9999回復",
        "target": "単体",
        "price": 2000
    },
    {
        "id": 12,
        "rank": 50,
        "name": "世界樹の木の実",
        "type": "状態異常回復",
        "CureAilments": true,
        "desc": "味方ひとりの全状態異常を治す",
        "target": "単体",
        "price": 20000,
        "cures": [
            "Poison",
            "ToxicPoison",
            "SpellSeal",
            "SkillSeal",
            "HealSeal",
            "Shock"
        ]
    },
    {
        "id": 14,
        "rank": 60,
        "name": "賢者の聖水",
        "type": "MP回復",
        "val": 9999,
        "desc": "MPを9999回復",
        "target": "単体",
        "price": 10000
    },
    {
        "id": 7,
        "rank": 70,
        "name": "エルフの飲み薬",
        "type": "MP回復",
        "val": 999999,
        "desc": "MPを全回復",
        "target": "単体",
        "price": 300000
    },
    {
        "id": 6,
        "rank": 80,
        "name": "世界樹の雫",
        "type": "HP回復",
        "val": 999999,
        "desc": "味方全員のHPを全回復",
        "target": "全体",
        "price": 500000
    },
    {
        "id": 99,
        "rank": 99,
        "name": "ちいさなメダル",
        "type": "貴重品",
        "val": 0,
        "desc": "世界各地に散らばるメダル",
        "target": "なし",
        "price": 0
    }
];
