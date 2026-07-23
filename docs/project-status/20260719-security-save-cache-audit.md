# 2026-07-19 オフライン・セーブ・入力安全性監査

この文書は、別途指摘された4件を「把握済み」で終わらせず、修正条件と検証条件を固定するための作業台帳である。

## 1. 必須JavaScriptのService Worker precache漏れ

状態: 対応済み。

- `maps_logic.js`
- `story_logic.js`
- `quests.js`
- `alchemy.js`

上記を `sw.js` の `PRECACHE_FILES` へ追加し、キャッシュ世代を `v3.123-offline-shell` へ更新した。
`tools/validation/validate-service-worker-shell.js` は `index.html` のローカルJavaScript読込一覧と `PRECACHE_FILES` を自動照合し、今後1本でも漏れれば失敗する。

## 2. セーブ容量超過が画面へ通知されない（一次修正済み）

状態: 2026-07-19一次修正済み。IndexedDB分離は未着手。

`App.save()` は保存成否をbooleanで返し、`localStorage.setItem()` 失敗を初回だけ画面通知する。同じData URLが `char.img` と `char.image` に重複している場合は、正本の `img` だけをシリアライズする。画像本体のIndexedDB移行は、旧セーブ移行・エクスポート・復旧経路を設計してから別工程で行う。

自動回帰検証: `node tools/validation/validate-save-safety.js`

現状は `localStorage.setItem()` 失敗時にコンソール出力だけで終わる経路があり、ユーザーが保存失敗を認識できない。また、カスタム仲間画像のData URLが `char.img` と `char.image` に重複格納される。

修正条件:

- 保存失敗をゲーム内モーダルで必ず通知し、成功扱いの表示を出さない。
- カスタム画像本体をIndexedDBへ分離し、セーブJSONには画像キーと編集情報だけを保存する。
- `char.img` / `char.image` の二重保持を解消し、旧セーブは一度だけ移行する。
- IndexedDB失敗、容量不足、画像欠損時の復旧表示を定義する。
- 容量上限を模擬した保存失敗テストと、旧セーブ移行テストを追加する。

## 3. インポートデータ経由のHTML注入

状態: 未着手・最優先。

`main.js` の続きから表示、`menus_allies.js` の仲間名表示、ログ表示などに動的値を含む `innerHTML` 経路がある。通常入力側の制限だけでは加工済みJSONのインポートを防げない。

修正条件:

- プレイヤー名・仲間名・動的数値は原則 `textContent` で設定する。
- HTMLテンプレートが必要な箇所は共通エスケープ関数を必須化する。
- インポート時に型、文字数、数値範囲、配列件数、Data URLのMIME・復号後サイズを検証する。
- `<img onerror=...>`、閉じタグ混入、巨大画像、異常数値を含む改変セーブの拒否テストを追加する。

## 4. キャッシュ更新処理が同一origin全体を削除する（修正済み）

状態: 2026-07-19修正済み。

`main.html` の更新処理は、実行中アプリと同じ `sw.js` を持つ登録だけを解除し、Cache Storageも `prisma-abyss-` 接頭辞のものだけを削除する。別アプリのService Worker登録・キャッシュは維持する。

自動回帰検証: `node tools/validation/validate-scoped-cache-reset.js`

修正条件:

- Service Worker解除は本ゲームのスクリプトURLまたはscopeに一致する登録だけを対象とする。
- Cache Storage削除は `prisma-abyss-` 接頭辞だけを対象とする。
- 対象外のダミーService Worker / Cacheが残ることを検証する。
- 更新失敗時は既存キャッシュを破壊したままにせず、再読込前に結果を通知する。
