# アセット管理

更新日: 2026-07-16

## 正本

- 実行時の画像キーとパス: `../assets.js`
- マップ素材ライブラリのメタデータ: `map/library/manifest.json`
- モンスター素材ライブラリのメタデータ: `monsters/library/manifest.json`

## フォルダ用途

- `background/`: 戦闘・施設・演出背景
- `characters/`: 主人公、仲間、NPCの歩行・立ち絵
- `effect/`: 戦闘エフェクト
- `map/`: 地形、壁面、オーバーレイ、オブジェクト、素材ライブラリ
- `monsters/`: 実装済みモンスター画像と候補ライブラリ
- `managed/source/`: 再生成・再編集用の原本
- `generated/`: 生成工程の中間・派生画像
- `ui/`: UI画像

## 追加・変更時の規則

1. ランタイムで使用する画像は `assets.js` に登録する。
2. 初回全キャッシュの対象から外さない。「いいえ」は待たずに開始する選択であり、全キャッシュを中止する選択ではない。
3. ライブラリ素材は `manifest.json` に用途、衝突設定、原本を記録する。
4. ファイル名変更・移動・重複削除の前に、JS/HTML/CSS、マニフェスト、互換キーを検索する。
5. `managed/source` とランタイム用画像が同じ内容でも、再生成経路が確認できるまで片方を削除しない。

## 検証

- `node tools/validation/validate-asset-libraries.js`
- `node tools/validation/validate-visual-assets.js`
- `node tools/validation/validate-visual-polish.js`
- `node tools/validation/validate-field-render-lifecycle.js`

