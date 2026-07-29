# モンスター出現正本

## 正本

通常戦闘の生息地は `monsters.js` の各モンスターにある `habitats` と `abyssFloors` だけを正本とする。

- `habitats[].mapId`: 固定マップの正式な `mapId`
- `habitats[].floors`: そのマップ内の階層範囲
- `abyssFloors`: クリア後の深淵ランダムダンジョンの階層範囲
- ワールドマップ、外縁、海域は floor 0 として扱う

`map.js` の町・ダンジョン・フィールド定義に `monsters` や `rareMonsters` を重複記載してはならない。二重管理を避けるため、通常戦闘は必ず `MonsterData.getEncounterCandidates()` から解決する。

生息地が未定義のマップでは、近いRankの別モンスターへ黙って代替しない。検証で不足を検出し、`monsters.js` の正本を修正する。

## レアモンスター

レア判定は敵1体ごとではなく、1戦闘につき1回だけ行う。出現率は対象Rank帯で一律2%とする。

| ダンジョンRank | モンスターID |
|---|---:|
| 31～70 | 200201 |
| 71～105 | 200202 |
| 106～150 | 200203 |
| 151以上 | 200204 |

Rank30以下にはレアモンスターを追加しない。地上・深淵地域・クリア後ランダムダンジョンのすべてで同じ表と同じ判定を使用する。

## 変更時の確認

1. モンスターの `habitats` または `abyssFloors` を更新する。
2. `map.js` に出現リストを追加しない。
3. `node tools/validation/validate-monster-habitat-master.js` を実行する。
4. 固定階、フィールド区域、海域、Rank境界の検証を通す。
