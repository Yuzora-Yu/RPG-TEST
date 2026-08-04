# Phase2J 戦闘結果ホットフィックス適用手順

## 対象

GitHub `Yuzora-Yu/RPG-TEST` のPhase2I反映済み作業ツリー。

## 推奨手順

このZIPの内容をプロジェクトルートへコピーし、プロジェクトルートで実行する。

```bash
node tools/apply-phase2j-battle-result-hotfix.js . --check
node tools/apply-phase2j-battle-result-hotfix.js .
node tools/test-phase2j-battle-result-hotfix.js .
node --check battle.js
node --check main.js
node --check news.js
node --check sw.js
```

その後、既存のPhase2J引継ぎに記載された全回帰テストを実行する。

## 手動適用

自動適用スクリプトを使わない場合は、`patches/PRISMA_ABYSS_phase2j_battle_result_hotfix_20260804.patch` を適用する。

```bash
git apply --check patches/PRISMA_ABYSS_phase2j_battle_result_hotfix_20260804.patch
git apply patches/PRISMA_ABYSS_phase2j_battle_result_hotfix_20260804.patch
```

## 適用後の確認

- 通常戦闘の勝利結果へ進む
- 敵が復活しない
- オート状態が勝利直前に不自然に解除されない
- 経験値・ドロップが一度だけ付与される
- ブラウザの開発者コンソールに `rareDropMultiplier is not defined` が出ない
