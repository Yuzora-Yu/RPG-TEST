# マップビジュアル刷新メモ 2026-06-08

## 方針

- 既存の `map.js` / `assets.js` の管理構造へ統合し、後段の上書き処理ではなくテーマ・オーバーレイ定義で管理する。
- `story.js` の発火座標、既存の `mapActions` 座標、固定ダンジョンのボス・宝箱座標は維持する。
- 画面上のタイルは32px基準、オーバーレイは96pxキャンバス内に収め、描画時のはみ出し違和感を避ける。
- 既存タイトルの直接模倣ではなく、後期16bit JRPG風の密度、陰影、素材感を目標にしたオリジナル素材として作成する。

## 生成・追加した主な素材

- 地形タイル: `assets/map/terrain/*_v003.png`
- 街建物オーバーレイ: `assets/map/overlays/overlay_building_*_v001.png`
- NPC/兵士/魔物オーバーレイ: `assets/map/overlays/overlay_npc_*_v001.png`, `overlay_monster_guardian_v001.png`
- 鍵/扉: `assets/map/objects/item_key_*_v002.png`, `door_key_*_v002.png`
- 画像生成リファレンス: `docs/generated/jrpg-map-asset-reference-20260608.png`
- 素材確認シート: `docs/generated/jrpg-map-assets-contact-sheet.png`
- 固定街プレビュー: `docs/generated/fixed-town-visual-preview-20260608.png`
- 固定ダンジョンプレビュー: `docs/generated/fixed-dungeon-visual-preview-20260608.png`

## マップ記号の主な割り当て

- `A`: 長老、長役、または固定ダンジョン兵士
- `J`: 村人、子ども、または固定ダンジョン魔物
- `R`: 水上都市では暗黒兵士
- `B`: 固定ダンジョンでは通常は守護魔物、イグナ火山はブロンズ兵士、海底神殿は暗黒兵士
- `H` / `V`: 炎の里、風の集落、水上都市では新規建物チップへ置換
- `M`: 新規溶岩タイル `tile_magma_v003.png`

## 固定マップ更新

- 炎の里: 火山入口 `x14,y1` と里の長 `x14,y17` を維持し、中央広場、鍛冶施設、村人、溶岩流を再配置。
- 風の集落: エリーゼ `x14,y15` と禁忌の森入口 `x2,y10` を維持し、橋と子どもNPCを再配置。
- 水上都市: 兵士イベント `x19,y13` を暗黒兵士チップにし、街中の兵士・住民を追加。
- 固定ダンジョン: 最終フロアを中心に、ボス/階段/宝箱/鍵扉の座標を維持したまま、柱、隔壁、水路、溶岩溜まりを追加。

## 検証

- `node --check assets.js`
- `node --check map.js`
- `node --check main.js`
- `node tools/validate-key-door-runtime.js`
- `node tools/validate-map-safety.js`
- 固定マップ/固定ダンジョンの行幅・高さ検証
- `assets.js` の参照画像存在検証
