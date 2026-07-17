# 宝箱トラップ（ミミック）実装仕様

## データ正本

- モンスター、階層選定、出現率: `chest-mimics.js`
- 画像と生成元: `assets/monsters/chest-mimics/`
- 画像生成記録: `assets/monsters/chest-mimics/manifest.json`
- 画像正規化: `tools/assets/normalize-chest-mimics.py`

## 出現仕様

- 深淵40階以降の通常宝箱（茶）のみ、開封時に5%で戦闘へ移行する。
- 赤宝箱、鍵宝箱、40階未満は抽選対象外。
- 40～119階は貪欲箱グラット（Rank 50）。
- 120～169階は呪宝箱パンドラ（Rank 120）。
- 170階以降は深淵宝匣アケロン（Rank 170）。
- 201階以降もアケロンを基礎個体とし、通常深層雑魚と同じ `Battle.createDeepFloorMonster()` で現在階層へ強化する。

## 固定マップ／エディタ

固定マップの `chests` 要素に `trapMonsterId` を指定すると、アイテム取得の代わりにミミック戦となる。

```js
{ x: 10, y: 8, type: 'trap', trapMonsterId: 120302 }
```

マップエディタの宝箱欄では「通常アイテム／トラップモンスター」を選び、3体から設定できる。必要なら詳細JSONで `trapFloor` を指定できる。

## 報酬

- 3体とも2回行動のエリート相当。
- 通常ドロップは「ちいさなメダル」（ID 99）100%。
- レアドロップは育成アイテムID 102／104／106、各5%。
- 転生の実（ID 107）は使用しない。

## 検証

`tools/validation/validate-chest-mimics.js` が、データ、階層境界、5%経路、固定宝箱、201階補正、エディタ、ドロップ、画像、キャッシュ登録を一括確認する。
