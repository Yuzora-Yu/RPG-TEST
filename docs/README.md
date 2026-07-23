# PRISMA ABYSS 開発資料索引

更新日: 2026-07-16

このフォルダは、ゲーム仕様・シナリオ・実装状況・生成物台帳を分離して管理する。新規資料は内容に合うサブフォルダへ保存し、ルート直下へ一時メモを増やさない。

## 最優先で参照する正本

- `development-policy.md`: 開発・変更時の基本方針
- `CURRENT_PRODUCT_DIRECTIVES_20260714.md`: 現在有効な製品方針
- `main-story-plot-prism-arc-20260608.md`: メインストーリー構成
- `implemented-story-flow-20260608.md`: 実装済み進行
- `render-integrity-20260715.md`: 描画・キャッシュ保全方針

## サブフォルダ

- `scenario/`: シナリオ草稿、レビュー、実装前の会話案
- `story-bible/`: 世界設定・人物・地域設定
- `project-status/`: 現在の未着手、保留、継続確認事項
- `generated/`: スクリプト生成レポート、配置台帳、プレビュー
- `legacy-backup/`: 現行正本ではない旧資料

## マップ・ビジュアル資料

- `map-story-editor-guide.md`: 地形・敷物・小物・氷・毒の直接配置と出力手順
- `map-visual-renewal-20260608.md`
- `world-map-visual-polish-20260714.md`
- `visual-polish-pass-20260714.md`
- `generated/authored-map-prop-placement-ledger.md`
- `generated/VISUAL_LIBRARY_V001_20260716.md`

## 管理ルール

- 実行ログは `../logs/`、検証スクリプトは `../tools/validation/` に置く。
- 一般画像の登録正本は `../assets.js`。モンスター画像は `../monsters.js` のIDを正本とし、`assets/monsters/monster_<ID>.png` を自動解決する。資料や別JSへモンスターID表を複製しない。
- 一時的な検証結果は `generated/` に置き、現行仕様と誤認しやすいものは `legacy-backup/` へ移す候補として記録する。
- シナリオ本文を変更する場合は `AGENTS.md` のレビュー手順を優先する。
