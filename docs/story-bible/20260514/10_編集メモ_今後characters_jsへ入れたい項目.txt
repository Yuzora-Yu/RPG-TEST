# 10_編集メモ_今後characters_jsへ入れたい項目

## なぜ追加したいか

現行の `characters.js` は、アーカイブ文の中に関係性・隠し設定・感情の重さが大量に入っている。これは世界観としては良いが、今後ストーリーイベントやNPC会話、加入条件、ガチャ演出、図鑑表示を実装する時に、コードから参照しにくい。

そのため、本文は残しつつ、構造化されたメタ情報を追加すると扱いやすい。

## 追加案

```js
story: {
  originArea: "START_VILLAGE",
  associatedAreas: ["START_VILLAGE", "ABYSS"],
  joinTiming: "after_start_village_clear",
  storyRole: "story_join", // story_join, npc, postgame_gacha, boss, hidden
  elementTheme: "fire",     // fire, wind, water, thunder, light, dark, chaos, none
  spoilerLevel: 0,           // 0=序盤公開可, 1=中盤, 2=終盤, 3=クリア後
  relationshipTags: [
    { target: 301, type: "admiration", feeling: "hero_worship", spoilerLevel: 0 }
  ],
  hiddenFlags: [],
  tutorialRole: "battle_basic"
}
```

## キャラ別の初期案

### アルス

```js
story: {
  originArea: "LOST_VILLAGE",
  associatedAreas: ["START_VILLAGE", "LIGHT_PALACE", "ABYSS"],
  joinTiming: "initial",
  storyRole: "hero",
  elementTheme: "chaos",
  spoilerLevel: 0,
  relationshipTags: [
    { target: 501, type: "protected_by", feeling: "forgotten_grace", spoilerLevel: 2 }
  ],
  hiddenFlags: ["lost_hometown", "protected_by_lucion"],
  tutorialRole: "main_control"
}
```

### ガイル

```js
story: {
  originArea: "START_VILLAGE",
  joinTiming: "after_start_village_clear",
  storyRole: "story_join",
  elementTheme: "fire",
  relationshipTags: [
    { target: 110, type: "childhood_friend", feeling: "protected_by", spoilerLevel: 0 },
    { target: 301, type: "admiration", feeling: "hero_worship", spoilerLevel: 0 },
    { target: 205, type: "mentor_candidate", feeling: "respect", spoilerLevel: 1 }
  ],
  tutorialRole: "frontline_attacker"
}
```

### サラ

```js
story: {
  originArea: "START_VILLAGE",
  joinTiming: "after_start_village_clear",
  storyRole: "story_join",
  elementTheme: "light",
  relationshipTags: [
    { target: 109, type: "childhood_friend", feeling: "worry_and_affection", spoilerLevel: 0 },
    { target: 301, type: "hope", feeling: "respect_and_dependence", spoilerLevel: 0 },
    { target: 102, type: "student", feeling: "respect", spoilerLevel: 1 }
  ],
  tutorialRole: "healer"
}
```

### シャオ

```js
story: {
  originArea: "FIRE_VILLAGE",
  joinTiming: "after_fire_village_clear",
  storyRole: "story_join",
  elementTheme: "fire",
  relationshipTags: [
    { target: 306, type: "sister", feeling: "hatred_misunderstanding", spoilerLevel: 1 },
    { target: 402, type: "enemy", feeling: "distrust", spoilerLevel: 1 }
  ],
  hiddenFlags: ["shao_shanny_sisters"],
  tutorialRole: "smith_unlock"
}
```

### シャニー

```js
story: {
  originArea: "FIRE_VILLAGE",
  associatedAreas: ["DEMON_CASTLE"],
  joinTiming: "after_demon_castle_event_battle",
  storyRole: "story_join_late",
  elementTheme: "dark",
  relationshipTags: [
    { target: 105, type: "sister", feeling: "guilt_and_protection", spoilerLevel: 2 },
    { target: 402, type: "sworn_servant", feeling: "loyalty_and_debt", spoilerLevel: 2 }
  ],
  hiddenFlags: ["abyss_miasma_body", "contract_with_zenon"],
  tutorialRole: "dark_truth"
}
```

### ゼノン

```js
story: {
  originArea: "DEMON_CASTLE",
  joinTiming: "postgame_or_special",
  storyRole: "antagonist_then_ally",
  elementTheme: "dark",
  relationshipTags: [
    { target: 306, type: "savior_and_lord", feeling: "strict_protection", spoilerLevel: 2 },
    { target: 301, type: "rival", feeling: "respect", spoilerLevel: 2 }
  ],
  hiddenFlags: ["demon_king_as_wedge", "fighting_chaos"],
  tutorialRole: "gacha_unlock"
}
```


### ジョセフ

```js
story: {
  originArea: "THUNDER_FORTRESS",
  associatedAreas: ["THUNDER_FORTRESS", "LIGHT_PALACE", "WATER_CITY"],
  joinTiming: "after_thunder_fortress_clear",
  storyRole: "story_join",
  elementTheme: "thunder",
  spoilerLevel: 1,
  relationshipTags: [
    { target: 305, type: "father", feeling: "love_regret_silence", spoilerLevel: 2 },
    { target: 205, type: "comrade", feeling: "shared_battlefield", spoilerLevel: 1 },
    { target: 306, type: "shared_past", feeling: "unspoken_guilt", spoilerLevel: 2 }
  ],
  hiddenFlags: ["father_of_leon", "failed_to_protect_village", "shared_that_day_with_sylvia"],
  tutorialRole: "guard_and_responsibility"
}
```

### レオン

```js
story: {
  originArea: "LIGHT_PALACE",
  associatedAreas: ["LIGHT_PALACE", "THUNDER_FORTRESS"],
  joinTiming: "postgame_or_late_story",
  storyRole: "key_npc_or_postgame_gacha",
  elementTheme: "light",
  spoilerLevel: 2,
  relationshipTags: [
    { target: 101, type: "son", feeling: "awe_resentment_unresolved_gratitude", spoilerLevel: 2 },
    { target: 304, type: "rescuer_friend", feeling: "trust", spoilerLevel: 1 },
    { target: 204, type: "mentor", feeling: "protective_guidance", spoilerLevel: 1 }
  ],
  hiddenFlags: ["son_of_joseph", "warm_justice_as_reaction_to_father"],
  tutorialRole: "light_palace_theme"
}
```

## 優先して構造化したい関係

1. シャオ/シャニー/ゼノン
2. アルス/リュシオン/ルーナ
3. ジョセフ/レオン（父子関係・畏怖・恨み・未練）
4. レオン/クロード/レイラ/ルーナ
5. ジョセフ/バロン/シルビア
6. マリー/ミネルバ
7. ケイト/ソフィア/リーシア
8. アラン/ハヤテ/クロード
9. アリサ/ハイネ/カリン/シャニー

この順でメタ情報を追加すると、今後のストーリー作成がかなり楽になる。
