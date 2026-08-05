# PRISMA ABYSS

個人制作のブラウザ型RPGです。フィールド描画は Phaser を正本とし、PC・スマートフォンの双方を対象にしています。

## ローカル起動

```powershell
node serve-local.js
```

起動後、`http://127.0.0.1:4172/main.html` を開きます。`file://` で直接開くと Service Worker、画像キャッシュ、画面遷移を正しく検証できません。

## 主要ファイル

- `main.html`: タイトル、新規／継続、データ管理
- `index.html`: ゲーム本体とスクリプト読込順
- `phaser-field.js`: 本番フィールド描画
- `main.js`: アプリ進行、セーブ、フィールド制御、旧Canvas安全フォールバック
- `assets.js`: 実行画像と全量キャッシュの正本
- `story.js`: 実装済みストーリーデータの正本
- `docs/development-policy.md`: 長期開発方針
- `docs/CURRENT_PRODUCT_DIRECTIVES_20260714.md`: 現在の優先指示
- `docs/project-status/CLEANUP_AUDIT_20260805.md`: 最新の監査結果と次回優先事項

詳細な責務は `docs/js-module-map.md` を参照してください。

## 基本検証

```powershell
node tools/validation/run-core.js
```

`node tools/validation/run-all.js` は広範囲の開発監査です。2026-08-05時点では、実装変更に追随していない検証を含むため、失敗をそのまま製品不具合と断定しないでください。分類状況は最新のcleanup auditに記録します。

## 変更時の必須事項

- 現在の機能と既存セーブを最優先で守る。
- プレイヤー向け変更は同日の `news.js` レコードへ簡潔に統合する。
- 画像追加・移動・削除時は `assets.js`、Service Worker、関連manifest、検証コードを同時に確認する。
- シナリオや既存会話を変更する場合は `AGENTS.md` の承認手順に従う。
- 実機確認ではPC幅とスマートフォン幅の両方で、新規開始・継続・Phaser描画・入力を確認する。
