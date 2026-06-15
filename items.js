/* items.js - DQ-scale balance rework generated 2026-05-15 */
window.ITEMS_DATA = [
    {
        "id": 1,
        "rank": 1,
        "name": "やくそう",
        "type": "HP回復",
        "val": 25,
        "desc": "HPを25回復",
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
        "val": 12,
        "desc": "MPを12回復",
        "target": "単体",
        "price": 100
    },
    {
        "id": 2,
        "rank": 5,
        "name": "上やくそう",
        "type": "HP回復",
        "val": 60,
        "desc": "HPを60回復",
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
        "val": 40,
        "desc": "MPを40回復",
        "target": "単体",
        "price": 500
    },
    {
        "id": 5,
        "rank": 30,
        "name": "世界樹の葉",
        "type": "蘇生",
        "val": 100,
        "desc": "死んだ仲間をHP全快で生き返らせる",
        "target": "単体",
        "price": 20000
    },
    {
        "id": 13,
        "rank": 40,
        "name": "超やくそう",
        "type": "HP回復",
        "val": 180,
        "desc": "HPを180回復",
        "target": "単体",
        "price": 20000
    },
    {
        "id": 12,
        "rank": 50,
        "name": "世界樹の木の実",
        "type": "状態異常回復",
        "CureAilments": true,
        "debuff_reset": true,
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
        "val": 90,
        "desc": "MPを90回復",
        "target": "単体",
        "price": 50000
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
        "id": 98,
        "rank": 99,
        "name": "災厄の楔",
        "type": "貴重品",
        "val": 0,
        "desc": "メダル交換所で災厄の王と戦えるようになる呪物",
        "target": "なし",
        "price": 0
    },
    {
        "id": 99,
        "rank": 99,
        "name": "ちいさなメダル",
        "type": "貴重品",
        "val": 0,
        "desc": "世界各地に散らばるなぞのメダル",
        "target": "なし",
        "price": 0
    },
    {
        "id": 108,
        "rank": 99,
        "name": "魔法の小舟",
        "type": "貴重品",
        "val": 0,
        "desc": "持っていると、海を小舟に乗って移動できる。",
        "target": "なし",
        "price": 0
    },
    {
        "id": 109,
        "rank": 99,
        "name": "光の翼",
        "type": "乗り物",
        "val": 0,
        "desc": "使用すると空を飛ぶことができる。OKボタンで着地する。",
        "target": "なし",
        "price": 0
    },
    {
        "id": 110,
        "rank": 1,
        "name": "スカイプリズム",
        "type": "移動",
        "val": 0,
        "desc": "訪れたことのある場所へ移動する。ダンジョン内では使用できない。",
        "target": "なし",
        "price": 3000
    },
    {
        "id": 100,
        "name": "いのちのきのみ",
        "type": "育成",
        "desc": "最大HPを3増加",
        "target": "単体",
        "price": 0
    },
    {
        "id": 101,
        "name": "ふしぎのきのみ",
        "type": "育成",
        "desc": "最大MPを2増加",
        "target": "単体",
        "price": 0
    },
    {
        "id": 102,
        "name": "ちからのたね",
        "type": "育成",
        "desc": "攻撃力を1増加",
        "target": "単体",
        "price": 0
    },
    {
        "id": 103,
        "name": "まりょくのたね",
        "type": "育成",
        "desc": "魔力を1増加",
        "target": "単体",
        "price": 0
    },
    {
        "id": 104,
        "name": "すばやさのたね",
        "type": "育成",
        "desc": "素早さを1増加",
        "target": "単体",
        "price": 0
    },
    {
        "id": 105,
        "name": "まもりのたね",
        "type": "育成",
        "desc": "防御力を1増加",
        "target": "単体",
        "price": 0
    },
    {
        "id": 106,
        "name": "スキルのたね",
        "type": "育成",
        "desc": "スキルポイント(SP)を1加算",
        "target": "単体",
        "price": 0
    },
    {
        "id": 107,
        "name": "転生の実",
        "type": "育成",
        "desc": "能力を維持したままLv1に戻る禁断の果実",
        "target": "単体",
        "price": 0
    },
    {
        "id": 301,
        "rank": 8,
        "name": "妖精の聖水",
        "type": "貴重品",
        "desc": "火山の炎を鎮めるための聖水",
        "target": "なし",
        "price": 0
    },
    {
        "id": 302,
        "rank": 23,
        "name": "青の結晶",
        "type": "貴重品",
        "desc": "海底神殿への道を示す結晶",
        "target": "なし",
        "price": 0
    },
    {
        "id": 303,
        "rank": 75,
        "name": "闇祓いの欠片",
        "type": "素材",
        "desc": "闇の神殿跡地で見つかる素材",
        "target": "なし",
        "price": 1200
    },
    {
        "id": 304,
        "rank": 85,
        "name": "禁則の残滓",
        "type": "素材",
        "desc": "禁則地に漂う魔力の結晶",
        "target": "なし",
        "price": 1800
    },
    {
        "id": 305,
        "rank": 90,
        "name": "天使の羽片",
        "type": "素材",
        "desc": "試練の天使が落とす淡い羽片",
        "target": "なし",
        "price": 3000
    },
    {
        "id": 306,
        "rank": 30,
        "name": "調律の羅針片",
        "type": "貴重品",
        "desc": "火と水の流れを読む小さな羅針片",
        "target": "なし",
        "price": 0
    }
];
