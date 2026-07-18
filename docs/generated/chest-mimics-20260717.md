# 宝箱トラップ（ミミック）実装仕様

## データ正本

- モンスターデータ: `monsters.js` の `CHEST_TRAP_MONSTERS`
- 出現条件と階層選定: `chest-mimics.js`
- 画像: `assets/monsters/monster_120301.png` ～ `monster_120303.png`
- 画像正規化: `tools/assets/normalize-chest-mimics.py`

モンスター画像は他モンスターと同じ `assets/monsters/monster_モンスターID.png` 規約に統一する。専用サブフォルダや実行時のモンスターデータ追加は使用しない。

## 出現仕様

- 深淵40階以降の通常宝箱（銅）のみ、開封時に5%で戦闘へ移行する。
- 赤宝箱、鍵宝箱、10階刻みの報酬宝箱は抽選対象外。
- 40～119階: 貪欲箱グラット（Rank 50）
- 120～169階: 呪宝箱パンドラ（Rank 120）
- 170階以降: 深淵宝匣アケロン（Rank 170）
- 201階以降もアケロンを基礎個体として、通常深層雑魚と同じ強化処理を適用する。

## 固定マップでの指定

固定マップの `chests` 要素に `trapMonsterId` を指定すると、アイテム取得の代わりにミミック戦となる。

```js
{ x: 10, y: 8, type: "trap", trapMonsterId: 120302 }
```

必要なら戦闘時の階層補正を `trapFloor` で指定する。

## 報酬

- 3体とも2回行動のエリート相当。
- 通常ドロップは「ちいさなメダル」（ID 99）100%。
- レアドロップは育成アイテム ID 102 / 104 / 106、各5%。
- 転生の実（ID 107）は使用しない。

## 検証

- `tools/validation/validate-chest-mimics.js`
- `tools/validation/validate-trial-island-shrine.js`

データ正本、5%抽選、固定宝箱、201階補正、画像パス、キャッシュ登録を検証する。
