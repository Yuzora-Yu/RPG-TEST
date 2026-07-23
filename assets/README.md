# アセット管理

更新日: 2026-07-23

## 正本

- 実行時の画像キーとパス: `../assets.js`
- マップ素材ライブラリのメタデータ: `map/library/manifest.json`
- モンスター画像: `monsters/monster_<モンスターID>.png`

## 命名と更新

1. ゲームで使う画像名は固定名とし、`_v001` などの版番号を付けない。
2. 同じ用途の画像を更新するときは、同じ固定名へ差し替える。
3. 同時に使う差分は `variant_a` など用途の分かる別名で登録する。
4. 旧版を `assets/` 内へ残さない。必要な退避物は `archive/` 以下へ移す。
5. 新規画像は `assets.js` へ登録し、初回全データキャッシュの対象に含める。
6. ファイル移動や削除の前に、JS・HTML・CSS・マニフェスト・検証コードの参照を確認する。

## フォルダ

- `background/`: 戦闘・施設・演出背景
- `characters/`: 主人公、仲間、NPCの画像
- `effect/`: 戦闘エフェクト
- `map/`: 地形、壁面、オーバーレイ、オブジェクト、素材ライブラリ
- `monsters/`: 実装済みモンスター画像
- `managed/source/`: 再生成・再編集用の制作情報
- `generated/`: 生成工程中の採用画像
- `ui/`: UI画像

## 検証

```powershell
node tools/validation/validate-asset-fixed-names.js
node tools/validation/validate-asset-libraries.js
node tools/validation/validate-visual-assets.js
node tools/validation/validate-field-render-lifecycle.js
```
