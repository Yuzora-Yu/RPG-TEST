# Art build tools

画像生成の原版から、ゲーム実行用の透過・減色済み素材と索引を再構築するスクリプトを置く。

## Rebuild

```powershell
python tools/art/build-map-chip-library.py
python tools/art/build-monster-library.py
node tools/validation/validate-asset-libraries.js
```

- `build-map-chip-library.py`: 3x3 原版アトラス10枚から、10テーマ・90点の32x32マップ素材、256x256マスター、テーマ別一覧、manifestを作る。
- `build-monster-library.py`: 透過済み原版24枚から、768x768の中ボス候補・属性雑魚候補、一覧、manifestを作る。
- 生成先と登録キーは各ライブラリの `manifest.json` を唯一の索引とする。
- 実行素材を直接手修正せず、原版またはビルド処理を直して再構築する。
- ビルド後は必ず `tools/validation/validate-asset-libraries.js` を実行し、全データキャッシュ収録まで確認する。
