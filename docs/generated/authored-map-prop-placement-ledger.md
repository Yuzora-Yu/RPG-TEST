# 手動マップ素材配置台帳

更新日: 2026-07-16

この台帳は `map.js` の `AUTHORED_MAP_PROP_PLACEMENTS` と対応する。抽選・乱数・テーマからの自動配置は行わない。

## 現在有効な床装飾

| ID | マップ | 範囲 | 種類 | 通行 |
|---|---|---:|---|---|
| `carpet-thunder-final` | `THUNDER_FORT` F6 | `(13,4)` から `5×7` | 赤・金縁カーペット | 可 |
| `carpet-light-final` | `LIGHT_PALACE` F4 | `(15,6)` から `3×7` | 赤・金縁カーペット | 可 |
| `carpet-dark-final` | `DARK_CASTLE` F7 | `(13,2)` から `5×6` | 赤・金縁カーペット | 可 |

## 現在未配置の連結床素材

- 青カーペット（銀縁）
- ござ

どちらも画像と連結描画ロジックは保持する。配置はマップエディタまたはユーザーが指定した座標から行い、暫定配置はしない。

## スイッチ用テーマ画像

スイッチは `AUTHORED_MAP_PROP_PLACEMENTS` ではなく、各フロアの `mapActions` で管理する。

| マップ | 用途 | 画像キー | ミニマップ色 |
|---|---|---|---|
| `IGNIS_VOLCANO` F4 | 排熱弁 | `maplib_volcanic_fire_rune_stone` | `#ff8a47` |
| `SEABED_TEMPLE` F4 | 水門操作器 | `maplib_water_sunken_urn` | `#59dbe8` |
| `THUNDER_FORT` F5 | 雷導操作盤 | `maplib_thunder_control_terminal` | `#67d9ff` |
| `CRENA_LIMESTONE_CAVE` F3 | 封晶 | `maplib_cave_purple_crystals` | `#c88cff` |

すべて自分のタイルを通行不可とし、上下左右の隣接マスから操作する。

## 調査イベント用小物

| マップ | 座標 | 用途 | 画像キー | 操作 |
|---|---:|---|---|---|
| `FORBIDDEN_FOREST` F1 | `(42,15)` | 北を示す朽ちた立札 | `maplib_forest_decayed_roadside_sign` | 通行不可・隣接後のアクション実行で読む |

調査イベント画像は各フロアの `mapActions` が正本。画像だけを `blockingObjects` へ重複登録しない。

## 氷床停止点

- `SEABED_TEMPLE` F4: `(8,9)`
- `THUNDER_FORT` F6: `(15,14)`, `(21,14)`
- `CRENA_LIMESTONE_CAVE` F3: `(14,15)`, `(24,15)`

これらは交差点・分岐入口で方向転換するための非氷床停止点。削除すると閉じ込めまたは重要地点への到達不能が再発する。

## 検証

- `node tools/validation/validate-authored-map-props.js`
- `node tools/validation/validate-minimap-hazard-safety.js`
- `node tools/validation/validate-visual-polish.js`
