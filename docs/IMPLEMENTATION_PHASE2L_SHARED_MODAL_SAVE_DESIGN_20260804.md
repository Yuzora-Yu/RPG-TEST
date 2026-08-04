# PRISMA ABYSS Phase2L 共通可変長モーダル・10枠セーブ設計 実装報告

作成日: 2026-08-04  
対象基準: Phase2K納品適用済みソース  
状態: **共通モーダル改修は実装済み。10枠セーブは設計・監査のみで未実装。**

## 1. 今回の完成単位

今回も全課題を薄く広く実装せず、次の一単位を完成させた。

1. 可変長モーダル用の共通シェルを追加。
2. スキル詳細、特性詳細、図鑑特性詳細、汎用メッセージ／確認を共通構造へ移行。
3. 長文・低画面・横画面・safe-areaに対応。
4. 既存のボタン操作、選択肢、特性再抽選の処理を維持。
5. 10枠セーブの現行保存経路を監査。
6. 既存バックアップ／復元を残す10枠設計を作成。
7. 専用試験を追加し、全回帰試験を実行。

10枠セーブ本体は、ユーザーへ詳細説明と仕様確認を行う前に着手しない方針を守り、コード変更していない。

## 2. 共通可変長モーダル

### 2.1 共通構造

`menus.js` と `modern-polish.css` に、ゲームコンテナ基準の共通モーダルシェルを追加した。

```text
game-modal-overlay
└─ game-modal-dialog
   ├─ game-modal-header  固定
   ├─ game-modal-body    flex:1 / min-height:0 / overflow-y:auto
   └─ game-modal-footer  固定
```

共通処理:

- `Menu.escapeHtml()`
- `Menu.getModalHost()`
- `Menu.ensureModalOverlay()`
- `Menu.resetDialogLayout()`

オーバーレイは `#game-container` 内へ置き、ブラウザ画面全体ではなくゲーム表示領域を上限にする。

### 2.2 移行した画面

#### スキル詳細

`menus_skill_detail.js` を共通シェルへ移行した。

- スキル名を固定ヘッダーへ分離。
- 消費MP、説明、威力・効果情報を本文スクロール領域へ配置。
- 閉じる操作を固定フッターへ配置。
- 表示値をHTMLエスケープ。

#### 特性詳細・再抽選結果

`menus_trait_detail.js` を共通シェルへ移行した。

- 通常の特性詳細。
- 再抽選確認に至る詳細表示。
- 再抽選結果表示。
- 戻る／閉じる操作。

再抽選の所持数確認、対象選択、保存失敗時処理等の既存ロジックは変更していない。

#### 図鑑の特性詳細

`menus_book.js` の特性詳細を同じ共通シェルへ移行した。

#### 汎用メッセージ・確認・選択肢

`index.html` の既存 `#menu-dialog-area` を次の三層へ整理した。

- 本文スクロール領域。
- 選択肢・ボタン領域。
- bounded shell。

`Menu.msg()`、`Menu.confirm()`、選択肢、一覧選択で前回のインライン表示状態が残らないよう、表示開始・終了時にレイアウト状態をリセットする。

### 2.3 画面条件

- safe-area上下左右を考慮。
- 低い横画面では余白と最大高を縮小。
- 長い英数字は `overflow-wrap:anywhere` で折返し。
- フッターは本文と一緒にスクロールしない。
- フォント縮小だけで長文問題を隠さない。

## 3. 10枠セーブ監査

`tools/audit-save-storage.js` を追加し、現行ソースを監査した。

結果:

- `SAVE_KEY`: `QoE_SaveData_v39_DQScale_LB99`
- 初期セーブJSON: 1,252 bytes
- ルートJS/HTML内 `App.save()` 呼出: 234箇所
- `SAVE_KEY` 直接読込: 1箇所
- 直接書込: 3箇所
- 直接削除: 1箇所

現行 `App.save()` は同期的な `localStorage` 保存の成功・失敗を返し、装備・通貨・戦闘結果等の巻き戻し処理がその結果を使う。この契約を一度に非同期IndexedDBへ変えると、広範囲の進行安全性へ影響する。

また、実セーブにはカスタム画像のData URLが含まれ得るため、10件すべてを `localStorage` の別キーへ複製する方式は容量面で採用しない。

## 4. 10枠セーブの推奨設計

詳細は `docs/DESIGN_TEN_SLOT_SAVE_AND_BACKUP_20260804.md` を正本とする。

### 4.1 推奨構成

- オート1枠: 現行 `localStorage[CONST.SAVE_KEY]` を維持。
- 手動1〜9: IndexedDBへ現在セーブの完全スナップショットを保存。
- 既存 `.rpgsave` 出力／読込: 削除せず維持。
- 外部ファイル／フォルダ連携: 対応環境だけの任意追加機能。
- IndexedDB利用不可: 手動9枠を無効化し、現行オート＋出力／読込を継続。
- 外部アクセス拒否: 10枠の内部保存には影響させず、既存ダウンロード／読込へ戻す。

### 4.2 「認証」の整理

- ブラウザ内の10枠保存自体は、通常、端末の生体認証やファイル権限を必要としない。
- `navigator.storage.persist()` は保存データを自動整理されにくくする要求であり、ファイル権限や生体認証ではない。
- ユーザーが選んだ外部ファイル／フォルダへ直接書く場合だけ、ブラウザの選択・許可が関係する。
- 外部許可を拒否されても、ゲーム内10枠と既存バックアップ／復元は継続できる設計にする。

### 4.3 実装順

1. ユーザー仕様確認。
2. 保存能力診断。
3. 手動9枠ストレージ層。
4. 枠一覧・保存・ロード・削除UI。
5. 既存バックアップの枠選択対応。
6. 対応環境だけ外部バックアップ先連携。

## 5. 変更ファイル

### 実装

- `index.html`
- `menus.js`
- `menus_book.js`
- `menus_skill_detail.js`
- `menus_trait_detail.js`
- `modern-polish.css`
- `news.js`
- `sw.js`

### 試験・監査・資料

- `tools/audit-save-storage.js`
- `tools/test-phase2k-ui-terminology-news-modal.js`
- `tools/test-phase2l-modal-shell-save-design.js`
- `docs/DESIGN_TEN_SLOT_SAVE_AND_BACKUP_20260804.md`
- `docs/IMPLEMENTATION_PHASE2L_SHARED_MODAL_SAVE_DESIGN_20260804.md`
- `PRISMA_ABYSS_phase2l_handoff_prompt_20260804.txt`

Phase2K試験は、キャッシュ名を `v41` に固定していたため、正当な将来更新でも失敗する状態だった。Phase2K以降の同日シェルキャッシュを許容する検証へ修正した。

## 6. Service Worker・更新履歴

- シェルキャッシュを `prisma-abyss-v42.20260804` へ更新。
- ランタイム画像キャッシュは `prisma-abyss-v39.20260804-runtime` のまま、`main.js` と同期。
- `news.js` は2026/08/04の既存一件へ、長文詳細画面修正を簡潔に追記。

## 7. 試験結果

### 7.1 専用試験

```bash
node tools/test-phase2k-ui-terminology-news-modal.js
node tools/test-phase2l-modal-shell-save-design.js
node tools/audit-save-storage.js
```

結果: **全合格**

### 7.2 全回帰試験

合計 **26件合格 / 0件失敗**。

- Phase1
- Phase2D〜Phase2Lの各専用試験
- 特性・セーブ安全・Service Worker
- シナリオデータ・メイン進行
- 装備特性・施設／コイン・Rank120・ギルド
- 迷宮250階ストレス
- news・バランスマスター・生息地マスター

迷宮ストレス:

```text
seed 6001 / 250 floors / locked-door floors 26 /
fallback floors 3 / max unreachable 0
```

既存のシナリオ検証では、未参照スクリプト28件の警告が継続している。今回の変更による増加や新規失敗ではない。

### 7.3 静的検査

- 変更・新規JavaScriptの `node --check`: 合格。
- `git diff --check`: 合格。
- newsデータ検証: 合格。
- Service Workerシェル検証: 57スクリプトすべて存在。

## 8. 実機未確認

この環境では実スマートフォン・実ブラウザ操作を完了していない。

未確認:

- iPhone Safari／ホーム画面Webアプリ。
- Android Chrome／ホーム画面Webアプリ。
- PC Chrome、Edge、Safari。
- 実端末のsafe-area、画面回転、ソフトウェアキーボード表示中。
- 実プレイの各詳細画面と戻る操作。
- IndexedDB、永続ストレージ、外部ファイル権限の実端末診断。

10枠セーブは未実装なので、保存機能の実機試験は次段階で行う。

## 9. 次の完成単位

ユーザー回答を受けるまで10枠セーブ本体は実装しない。

並行して進められる次のUI候補:

1. クエスト詳細の固定ヘッダー／本文／フッター化。
2. 戦闘作戦選択の閉じる操作固定。
3. シナリオ二択の長文・低画面対応。
4. 共通モーダルの実機回帰。

セーブ実装開始時は、まず保存能力診断と手動9枠の独立ストレージ層だけを完成させ、タイトル・ゲーム内UIを同時に雑に作らない。
