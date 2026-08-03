# PRISMA ABYSS 実装フェーズ2E報告

作成日: 2026-08-03  
適用元: Phase2D適用済みソース

## 1. 本フェーズの範囲

本フェーズでは、カルメナの初到着案内と北門二将の戦闘調整を行い、Phase2Dで再設計した深淵101階以降のボス強化を利用するストーリーボス訓練所をレガシオンへ新設した。

実装済み:

- カルメナ初到着時のシステム警告
- カルメナへの地上出身住民追加と大灯台北側の育成導線
- レオン将軍からガレオン将軍への名称変更
- グレン将軍・ガレオン将軍の属性物理技、単体技、弱体技の再構成
- レガシオンへのストーリーボス訓練所新設
- 訓練対象・難易度の正式マスター追加
- 深淵101階以降の強化ロジックを利用した訓練用ボス生成
- 訓練戦の報酬、進行、討伐記録、仲間加入を無効化
- 訓練戦前後のパーティHP・MP復元
- 訓練戦コンテキストの戦闘結果ジャーナル保存
- 正本シナリオMarkdownと全会話CSVの同期

未実装:

- ギルガメッシュ超強化・報酬・加入処理
- 各属性Rank120特殊装備と専用クエスト
- 特性書50クエスト
- 鍛冶+3素材強化、神鉄の鍛冶台
- 装備Rank共通表示・共通並べ替え
- レベルアップログのスキップボタン

---

## 2. カルメナ初到着警告

### 2.1 正本シナリオ

新規台詞は、実装前に次の正本Markdownへ記録した。

```text
docs/scenario/29_CARMENA_ARRIVAL_AND_TRAINING_HINT_20260803.md
```

ユーザー指示を承認済み本文として扱い、レビュー結果も同ファイルへ記録している。

### 2.2 初回イベント

カルメナの固定マップマスターへ次を追加した。

```text
entryEventId: abyss_carmena_arrival_warning
entryEventFlag: abyssCarmenaArrivalWarningSeen
```

表示内容:

```text
プリズムの加護も届かない場所まで来てしまったようだ……。
今、攻撃を受ければ大きな傷を負うかもしれない……。
```

会話・戦闘結果・イベント再開を優先し、フィールドへ復帰した際に何も再開しなかった場合だけ、現在の固定マップの初回到着イベントを確認する。

フラグは会話イベント内で設定し、1セーブにつき1回だけ表示する。

### 2.3 共通入口処理

`Field.runCurrentFixedMapEntryEvent()` を追加した。

固定マップ側の `entryEventId` と `entryEventFlag` を参照するため、カルメナ専用の座標条件や起動時上書きは使用していない。

---

## 3. カルメナ住民と育成導線

カルメナ東側の通行可能タイル `(34,20)` に、地上から落ちた住民を追加した。

会話では次を案内する。

- 地上にいた頃、大灯台の北へ流れ着いたこと
- そこに人が入るべきではない魔境があったこと
- カルメナと似た雰囲気だったこと
- 強い冒険者なら訓練に使える可能性
- 本人は恐怖から外出できないこと

北門の二将を倒せない場合に、直接的なメニュー説明ではなく世界内会話から育成先を知る導線としている。

住民会話は正本会話CSVへ出力済み。

---

## 4. カルメナ北門の二将

### 4.1 名称

表示名を次へ変更した。

```text
レオン将軍 → ガレオン将軍
```

対象:

- モンスターマスター
- 固定マップ表示・挑戦文
- 戦闘画像フォールバック
- ストーリー会話
- 深淵シナリオ・ボス配置資料

旧イベントキーに含まれる歴史的な識別子は、セーブ・参照互換が必要なものだけ維持している。プレイヤー向け表示名には使用しない。

### 4.2 グレン将軍

使用属性:

- 風
- 雷
- 光
- 混沌

すべて物理技を使用する。

HP50%以上では、単体攻撃の合計使用率を全体攻撃より高くし、攻撃・防御弱体技を合計30%で使用する。

HP50%未満では全体攻撃と強力技の割合を増やすが、単体攻撃と弱体技も維持する。

### 4.3 ガレオン将軍

使用属性:

- 水
- 火
- 闇
- 混沌

すべて物理技を使用する。

HP50%以上では、単体攻撃の合計使用率を全体攻撃より高くし、攻撃・防御弱体技を合計30%で使用する。

HP50%未満では各属性の強力技を増やしながら、単体攻撃と弱体技を残す。

### 4.4 調整意図

カルメナの特殊環境では全属性耐性が大きく下がるため、旧構成の全体攻撃偏重を緩和した。

能力値や特殊環境デバフ自体は変更せず、HP上半分の単体攻撃・弱体攻撃比率を上げることで、回復・立て直しが可能な難易度へ寄せている。

---

## 5. ストーリーボス訓練所

### 5.1 配置

レガシオンの施設タイル `(7,23)` に新規配置した。

次とは別施設である。

- モンスター育成所 `(15,25)`
- 格闘場予定地 `(38,33)`

施設背景は暫定で既存施設画像を使用する。

### 5.2 正式マスター

`abyss_content.js` に次を追加した。

- 訓練対象マスター: 18件
- 難易度マスター: 4段階

難易度:

| 表示 | 強化基準 |
|---|---:|
| 初級 | 深淵101階相当 |
| 中級 | 深淵151階相当 |
| 上級 | 深淵201階相当 |
| 極限 | 深淵301階相当 |

訓練対象と解放フラグの全一覧は次に出力した。

```text
docs/STORY_BOSS_TRAINING_MASTER_20260803.csv
```

### 5.3 解放条件

訓練対象ごとに正式な解放フラグを設定した。

フラグが存在しない旧セーブでも、対象モンスターの討伐数が1以上なら解放される。

### 5.4 UI

新規ファイル:

```text
boss_training.js
```

実装内容:

- 解放済みボス一覧
- 地上編・深淵編の分類
- 対戦相手選択
- 解放済み対象からのランダム選択
- 4段階の難易度選択
- 元Rank表示
- 訓練仕様の説明
- 最終確認

### 5.5 ボス生成

訓練用ボスは、Phase2Dの `createDeepFloorMonster()` を正式に利用する。

- 元の技を維持
- 同系統の上位技だけを追加
- 元の属性・状態異常耐性を維持して追加強化
- 元特性を強化し、役割別特性を追加
- 選択した深淵階層相当の能力へ強化

訓練対象マスター自体を起動時に書き換える処理はない。

### 5.6 非進行契約

訓練戦では次を発生させない。

- 経験値
- ゴールド
- 通常ドロップ
- 特別報酬
- 討伐数
- 図鑑撃破登録
- クエスト進行
- 固定ボス撃破記録
- 仲間加入
- LB勝利成長
- 特性成長
- モンスターの戦闘後スキル進化
- 最大ダメージ実績更新

勝敗にかかわらず、訓練開始前のパーティHP・MPへ復元する。

### 5.7 戦闘結果ジャーナル

訓練開始時に次を `battle.storyBossTraining` へ保存する。

- 訓練対象ID
- 対戦相手名
- モンスターID
- 強化階層
- 難易度ID・表示名
- パーティHP・MPスナップショット
- 開始時刻

勝利・敗北結果にも訓練コンテキストを記録する。

アプリ中断・再開時も通常戦闘結果と同じジャーナル経路を利用し、報酬や進行を後から誤適用しない。

---

## 6. 更新履歴・キャッシュ

`news.js` の2026年8月3日レコードへ、同日1レコード方針に従い次を簡潔に追記した。

- カルメナの案内と北門二将の調整
- ストーリーボス訓練所の追加

Service Worker:

```text
v34.20260803
```

`boss_training.js` をApp Shellへ追加し、`main.js` のフルデータ用ランタイムキャッシュ名も同期した。

---

## 7. 変更・新規ファイル

変更:

- `abyss_content.js`
- `battle.js`
- `index.html`
- `main.js`
- `map.js`
- `monsters.js`
- `news.js`
- `story.js`
- `sw.js`
- `docs/ABYSS_BOSS_PLACEMENT_20260729.md`
- `docs/scenario/10_ABYSS_STORYLINE_DRAFT_20260629.md`
- `docs/scenario/28_ABYSS_SETTLEMENT_RESIDENT_DIALOGUE_20260729.md`
- `docs/scenario/abyss-region.md`
- `docs/generated/PRISMA_ABYSS_ALL_DIALOGUE_AND_EVENT_LOGS_20260731.csv`

新規:

- `boss_training.js`
- `tools/test-phase2e-carmena-training.js`
- `docs/scenario/29_CARMENA_ARRIVAL_AND_TRAINING_HINT_20260803.md`
- `docs/STORY_BOSS_TRAINING_MASTER_20260803.csv`
- `docs/IMPLEMENTATION_PHASE2E_20260803.md`

---

## 8. 検証

実行して合格したもの:

```bash
node tools/test-phase1-growth-fusion.js
node tools/test-phase2d-compatibility.js
node tools/test-phase2d-deep-boss.js
node tools/test-phase2e-carmena-training.js
node tools/validation/validate-passive-skills.js
node tools/validation/validate-save-safety.js
node tools/validation/validate-service-worker-shell.js
node tools/validation/validate-story-dialogue-data.js
node tools/validation/validate-main-story-routing.js
node tools/test-equipment-trait-policy.js
node tools/test-phase2-facilities-coin.js
node tools/test-phase2b-rank120-balance.js
node tools/test-phase2c-guild-balance.js
RANDOM_DUNGEON_STRESS_SAMPLES=250 RANDOM_DUNGEON_STRESS_SEED=6001 node tools/test-phase2c-random-dungeon.js
node tools/validation/validate-news-data.js
node tools/validation/validate-balance-master-adjustments.js
node tools/validation/validate-monster-habitat-master.js
```

Phase2E専用試験では次を確認した。

- カルメナ初到着イベントと一回限りフラグ
- 住民の通行可能タイル配置と会話本文
- プレイヤー向け旧将軍名の残留なし
- 二将の指定属性・物理技構成
- HP50%以上で単体技が全体技より高い比率
- HP50%以上の弱体技使用率30%
- 訓練対象18件と難易度4段階
- 育成所・格闘場予定地との座標非重複
- 訓練用深層ボス生成
- 元スキル維持
- 経験値・ゴールド・ドロップ無効化
- 訓練戦開始時のパーティ状態保存
- 戦闘結果ジャーナルと進行抑止契約

全変更JavaScriptの構文検査と `git diff --check` も実施する。

### 検証上の制約

この実行環境では、管理ポリシーによりローカルURLをブラウザで開けない。そのため、実ブラウザ上での施設画面、タップ操作、カルメナ到着演出、二将戦の体感確認は実施できていない。

通常ブラウザ・実機では特に次を確認すること。

1. 初回カルメナ到着時だけ警告が表示されること
2. 会話中断・再開後に警告が二重表示されないこと
3. `(34,20)` の住民へ接触できること
4. 二将のHP上半分で単体攻撃と弱体技が体感できること
5. レガシオン `(7,23)` から訓練所へ入れること
6. 訓練戦勝敗後にHP・MPが開始前へ戻ること
7. 訓練戦後に討伐数・報酬・クエストが増えないこと
8. 戦闘中断・再開後も訓練戦として完了すること
