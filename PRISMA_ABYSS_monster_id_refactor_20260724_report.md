# モンスター画像ID一元化・実行環境確認レポート

更新日: 2026-07-24

## 1. ZIP内のゲーム実行環境

### 実行方式

- ビルド工程を持たない、ブラウザ直接実行型のJavaScript RPG。
- `package.json`、バンドラ、トランスパイラはなく、HTMLから複数のクラシックJSを順番に読み込むグローバル名前空間方式。
- `serve-local.js` はNode.js製の静的HTTPサーバー。既定では `127.0.0.1:4172` で配信し、ルートアクセスは `main.html` を返す。
- `main.html` はタイトル・セーブ選択・新規開始/再開の入口。
- `index.html` はゲーム本編。`assets.js`、Phaser、各種マスターデータ、マップ、ストーリー、戦闘、分割メニュー群を順番に読み込む。
- `sw.js` と `manifest.json` によりPWA/オフライン実行を構成。画像キャッシュ一覧は `PRISMA_ASSETS.cacheWarmup` を参照する。

### 主な構成

| 領域 | 主なファイル | 役割 |
|---|---|---|
| タイトル/起動 | `main.html`, `main.js`, `save_crypto.js` | 新規開始、再開、セーブ管理、起動処理 |
| 本編画面 | `index.html` | 本編用JS/CSSの読み込み順とDOM |
| 画像管理 | `assets.js` | 画像パス、`GRAPHICS`、先読み、PWAキャッシュ一覧 |
| モンスターマスター | `monsters.js` | 通常敵、レア、ボス、特殊ボス、宝箱敵、生成ロジック |
| 戦闘 | `battle.js` | 敵生成、行動、ダメージ、戦闘描画、報酬 |
| フィールド/進行 | `main.js`, `map.js`, `dungeon.js`, `story_logic.js` | マップ描画、移動、ダンジョン、イベント |
| 図鑑/仲間 | `menus_book.js`, `menus_allies.js` | モンスター画像表示、仲間画像表示 |
| 描画 | `phaser-field.js`, `map_render_shared.js` | Phaserフィールド描画と共通描画補助 |
| オフライン | `sw.js` | App Shell、画像、実行時キャッシュ |

### モンスターデータの流れ

1. `monsters.js` がモンスターマスターを構築する。
2. `globalThis.MONSTERS_DATA` と `globalThis.MonsterData` に公開する。
3. `database.js`、`battle.js`、`main.js`、メニュー群がこのデータを参照する。
4. フロア補正などで生成された敵は `baseId` を保持するため、表示画像は元モンスターIDへ戻して解決できる。

## 2. 修正前に確認した問題

モンスター画像の登録情報が複数箇所へ分散していた。

- `monsters.js`: 一部の通常敵・ボス・宝箱敵だけ `img` / `image` を個別指定。
- `monster-images.js`: 通常敵、追加通常敵、ボス、宝箱敵のID配列を別管理。
- `assets.js`: 通常モンスターID配列、ボスID配列、`overlay_boss_<ID>` を別管理。
- `battle.js`: IDよりもモンスター名から作る旧画像パスを優先する経路が残っていた。
- `menus_book.js`、`menus_allies.js`、`main.js`、`story_logic.js`: それぞれ異なるフォールバック順で画像を決定していた。
- `sw.js`: キャッシュ一覧は `assets.js` 側の手動ID一覧に依存していた。

特に、`monsters.js` には264体が存在する一方、修正前の `assets.js` の通常モンスター画像一覧には高層通常敵 `100091`〜`100180` が含まれておらず、`monster-images.js` とPWAキャッシュ一覧の内容が一致していなかった。

## 3. 実施したロジック変更

### IDから画像パスを一意に決定

画像パス規約を以下へ統一した。

```text
assets/monsters/monster_<monsterId>.png
```

`baseId` がある生成敵は `baseId`、それ以外は `id` を使用する。

```js
MonsterData.getImagePath(monsterOrId)
PRISMA_ASSETS.getMonsterImagePath(monsterOrId)
```

### `monsters.js`をモンスターIDの正本に変更

`monsters.js` 読み込み後、全モンスター定義を `assets.js` の汎用登録関数へ渡す。

登録時に以下を自動生成する。

- 全モンスターの画像パス
- `MonsterImageMap` 互換マップ
- Service Workerの全画像キャッシュ対象
- ボス・レア・特殊ボス・フィールド表示対象の `GRAPHICS` キー
- 起動直後に必要なモンスター画像と初期描画キー

### 個別画像指定を削除

`monsters.js` から、50件存在した `img` / `image` フィールドをすべて削除した。ボスも通常敵も同じID規約を使う。

### 重複ID表を廃止

- `monster-images.js` の手書きID配列を廃止。旧キャッシュとの互換ブリッジだけを残した。
- `assets.js` の通常敵ID配列・ボスID配列を廃止。
- `overlay_boss_<ID>` の個別登録を廃止し、`monster_<ID>` に統一。
- `sw.js` のモンスター固定IDフォールバックを廃止。

### 利用側の解決順を統一

以下はID解決を最優先するよう変更した。

- `battle.js`
- `main.js`
- `menus_book.js`
- `menus_allies.js`
- `story_logic.js`

名前ベースや旧 `img` / `image` は、古い保存データ等を壊さないための最終フォールバックとしてのみ残している。

## 4. 今後のモンスター追加手順

通常敵・レア・ボス・特殊ボス・宝箱敵のいずれも、基本手順は2つだけ。

1. `assets/monsters/monster_<ID>.png` を配置する。
2. `monsters.js` に同じIDのモンスター定義を追加する。

`img`、`image`、`MonsterImageMap`、`assets.js`、`monster-images.js`、`sw.js` への追記は不要。

### `monsters.js`内だけで使える任意フラグ

- `mapSprite: true`: 通常敵を固定マップ上の敵シンボルとして事前登録したい場合。
- `preloadAtStartup: true`: タイトル直後・オープニング前など、起動直後に画像を確実に先読みしたい場合。

`isBoss: true` のモンスターは自動的にフィールド描画用キーへ登録されるため、ボス画像パスの追加指定は不要。

## 5. 変更ファイル

- `assets.js`
- `monsters.js`
- `monster-images.js`
- `battle.js`
- `main.js`
- `menus_book.js`
- `menus_allies.js`
- `story_logic.js`
- `sw.js`
- `tools/validation/validate-field-render-lifecycle.js`（旧キー名だけ更新。ツール自体は未実行）
- `tools/validation/validate-opening-flow.js`（旧キー名だけ更新。ツール自体は未実行）
- `docs/asset-code-map.md`
- `docs/js-module-map.md`
- `docs/README.md`

## 6. 実施した静的確認

依頼どおり、プロジェクト付属の検証ツールは実行していない。

代わりに、変更箇所の破損を避けるため以下だけを実施した。

- 変更したJavaScriptの `node --check` による構文確認。
- DOMや`Image`が存在しないService Worker相当のVMで `assets.js` → `monsters.js` → `monster-images.js` を読み込み。
- 264体のIDがすべて自動登録されることを確認。
- 全モンスター定義から `img` / `image` がなくなったことを確認。
- `100180` を含む全画像パスがPWA全量キャッシュ一覧へ入ることを確認。
- 仮の新ID `777777` を追加した場合に、画像パス、互換マップ、キャッシュ一覧が自動生成されることを確認。

## 7. 注意点

- 画像ファイルの実在確認やゲーム画面上の目視確認は、ZIPから `assets` が除外されているため行っていない。
- `dungeon.js` と旧Canvasフォールバック部には、特定イベントの表示デフォルトとして `100009` / `100010` の直接パスが残る。これはモンスター登録表ではなく固定イベント用フォールバックで、新モンスター追加時の追記先にはならない。
- Service Workerのキャッシュ名を `v3.124` へ更新したため、配布後は旧キャッシュから新キャッシュへ切り替わる。
