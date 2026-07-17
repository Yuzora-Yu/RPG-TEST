# 開発ツール管理

更新日: 2026-07-16

- `validation/`: 自動検証。標準の一括実行は `node tools/validation/run-all.js`。
- `art/`: 画像変換・生成補助。
- `visual-qa/`: 目視確認用の補助データ。
- `*.html`: ローカルの目視検証ページ。ゲーム本体から参照しない。
- ルートの `map_story_editor.html`: 現行マップ／ストーリー編集UI。操作手順は `../docs/map-story-editor-guide.md`。
- ルート直下の生成・変換スクリプトは既存互換のため保持する。新規スクリプトは用途に応じて上記サブフォルダへ置く。

標準出力・エラー出力は `../logs/`、生成したレポートとプレビューは `../docs/generated/` に保存する。ゲーム本体のJS・HTML・CSSと混在させない。
