# ダンジョン壁面生成記録（2026-07-15）

## 生成方式

Codex組み込み画像生成を使用。汎用壁面 `terrain_dungeon_wall_face_v002.png` を構造参照、各テーマの既存32px壁チップを色・材質参照として、正面投影・左右反復可能な壁面原版を生成した。生成結果は実行時の伸長表示を安定させるため256×256 PNGへ正規化し、描画時に32×48へ縮小する。

共通制約は以下。

- SFC後期～PS2初期の手描きJRPGピクセルアート
- 硬いピクセルクラスタ、限定色、意図的な不均一さ
- 正面投影、床面・遠近法なし、左右反復可能
- 上端の縁と下端の基礎帯を明確化
- キャラクター、扉、松明、文字、ロゴ、透かしなし
- 写実、3Dレンダー、ネオン過多、ぼかし、AI的な滑らかさを避ける

## テーマ別指示と実行時ファイル

| テーマ | 追加指示 | 実行時ファイル |
|---|---|---|
| イグニス火山 | 黒い玄武岩、煤、控えめな赤熱鉱脈 | `assets/map/terrain/tile_fire_wall_face.png` |
| 禁忌の森 | 単一壁面案は不採用。既存の固有Wチップ4種類によるランダム配置を正とし、生成壁面は実行時・全量キャッシュで使用しない | ― |
| 風の神殿 | 風化した淡灰石灰岩、控えめな風の渦刻印、苔 | `assets/map/terrain/tile_wind_temple_wall_face.png` |
| 森の風穴 | 緑黒色の岩と根、細い青緑鉱脈、湿った欠け | `assets/map/terrain/tile_wind_hole_wall_face.png` |
| 大灯台 | 黄土・砂色の古い煉瓦、縦の石柱、塩害 | `assets/map/terrain/tile_tower_wall_face.png` |
| 雷の要塞 | 青黒い石と鉄板、鋲、控えめな紫電亀裂 | `assets/map/terrain/tile_thunder_wall_face.png` |
| 魔王城 | 黒石、鉄の補強、わずかな深紅目地、重い上縁 | `assets/map/terrain/tile_dark_castle_wall_face.png` |
| ガルヴァニア洞窟 | 紫黒い割岩、細い紫水晶層、鈍い鉱物塊 | `assets/map/terrain/tile_galvania_wall_face.png` |
| グレゼリア禁足地 | 粘板岩状の層、暗い赤紫鉱脈、化石状縞 | `assets/map/terrain/tile_grezelia_wall_face.png` |

開始洞窟／深淵、光の宮殿、闇の神殿跡は既存壁面を維持する。クレナ洞窟と海底神殿の `W` は水面であり、壁面生成・置換の対象外とする。
