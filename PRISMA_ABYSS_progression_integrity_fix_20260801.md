# PRISMA ABYSS 進行整合性修正

- 修正日: 2026-08-01
- 入力: `RPG.zip`（`assets/` 除外版）
- 基準: `PRISMA_ABYSS_progression_integrity_audit_20260801.md`
- シナリオ本文変更: なし
- 素材追加・変更: なし

## 対象版の確認

修正前の主要ファイルは監査記載の SHA-256 と一致した。

| ファイル | 修正前 SHA-256 |
|---|---|
| `battle.js` | `5faee5c33c09e2570e022bbff4052f99b80a9068c1c170994306ead9bc9843ac` |
| `story_logic.js` | `368127d2efbc0dc6bb9dc204335ada2ee638473104a651fc790d8480ac80bec0` |
| `story.js` | `014615b41ac1fe71fa508e6e8bc698a1c7305928eab3c6bbc61efc84f81a8c49` |
| `dungeon.js` | `3b5e59c960681f4a90797d058ff8160ea8cd23a5df54abd67fc7cbbdfee4f078` |
| `main.js` | `3e365d32e54b62d0986f805c62c9b689a2c503417b021493fdeef7473ef6f69d` |
| `map.js` | `0607ef2ba2cc74dc2285fc9ddc305f3897089170d6ee9f136159dd729ab3c7b5` |

## 実装した修正

### 1. 入れ子イベントを正確に再開する `StoryEventJournal`

`progress.eventJournal` version 2 を追加した。

- `queue` と `active` を分離し、`queued → running → completed/error` を保存する。
- `IF_FLAG`、`IF_ITEM`、`CHOICE` の選択結果を `selectedBranches` に保存する。
- 入れ子内の命令位置をパスで保存する。
- 実行済み命令を `completedActions`、特殊な一回処理を `effectStates` に記録する。
- アイテム消費、仲間加入、フラグ、クエスト、機能解放、MAP変更などは、実行済みカーソルと同じ保存へまとめる。
- 同一イベントを複数予約でき、戦闘単位の `dedupeKey` が指定された場合だけ二重予約を抑止する。
- 旧 `pendingEventId`、`pendingBattleWinEventId`、`activeEvent` を起動時に新形式へ移行する。

#### レイラ加入の旧セーブ救済

- 回復会話中の旧形式セーブは、「渡す」選択と世界樹の葉消費済み位置を復元して加入処理へ進める。
- 消費直後で会話情報も残っていない旧形式の曖昧な保存窓は、世界樹の葉を1枚だけ返して再選択可能にする。
- 新形式では、葉を消費した直後から再読込しても条件を再評価せず、保存済みの `yes` 分岐を継続する。

### 2. 勝利処理を表示前に一括確定

`App.beginSaveTransaction()` / `commitSaveTransaction()` と `battle.resultJournal` を追加した。

- ゴールド、ドロップ、討伐数、図鑑、クエスト、仲間化、経験値、レベルアップ、特性成長、戦後回復、MAP・ボス状態、戦後イベント予約を勝利演出前に適用する。
- 途中の `App.save()` はトランザクション内で保留し、最後に一回だけ永続化する。
- 報酬抽選後の画面は保存済み結果の表示層として扱う。
- モンスター仲間のスキル成長候補も確定結果へ保存し、リザルト中断後にフィールドで再開できる。
- 起動時に未完了の committed result をフィールド初期化前に回収する。

### 3. 全滅処理を表示前に確定

- 全滅回数、敗北後イベント予約、参加者HP/MP同期を敗北表示前に確定する。
- 通常全滅は、HP1化、ダンジョン情報清掃、帰還先決定と位置更新までを表示前に保存する。
- 全滅画面のタップは確定済み結果の表示終了だけを行う。
- タップ前の再読込でも、戦闘不能のままダンジョンへ戻らない。
- 固定ボスの一時コンテキストも、該当戦闘チェーンの敗北時に清掃する。

### 4. 戦後イベントの削除先行を廃止

- 予約は削除せず `queued` から `running` へ遷移し、初期カーソルと一緒に保存してから実行する。
- 完了後にだけキューから削除する。
- フィールド復帰時はイベント種別に関係なく登録順で1件ずつ再開する。
- 例外時は `error` 状態と位置を保存し、入力ロックを解除する。再読込で同位置から再試行できる。

### 5. 固定ボス文脈を戦闘チェーンへ拘束

`activeFixedBossContext` に以下を追加・照合する。

- `areaKey`
- `mapId`
- `startEventId`
- `fixedBossPosition`
- `battleChainId`
- `phase`
- `nonce`

継承はエリア・MAP・イベントまたは明示された戦闘チェーンが一致する場合だけ許可し、不一致の古い文脈は破棄する。

### 6. MAP移動をジャーナル化

- イベントカーソルを移動前に削除しない。
- `pendingMapTransfer` に対象、元イベントtoken、命令パス、状態を保存する。
- 移動APIを成功・失敗の戻り値で判定する。
- 失敗時はイベントを残して `error` とし、移動成功後にだけ命令・イベントを完了する。
- `MAP_CHANGE` の内部保存もイベント命令の完了保存へまとめられるようにした。

### 7. `restartOnResume` とボス開始安全性

- `restartOnResume` をイベント再開処理で参照する。
- 副作用の実行済み記録は維持し、表示カーソルだけを再構築する。
- BOSS命令はモンスターIDを検証してから戦闘データを生成し、元イベントを完了する。

### 8. アゼルガラグ形態移行の進行不能修正

- 第一形態死亡時に第二形態の敵データ、味方回復・加護、形態番号を先に保存する。
- 変身会話を `battle.cutsceneQueue` へ保存する。
- 会話待機Promiseの例外を捕捉し、コマンド進行全体を停止させない。
- 旧ターンの `commandQueue`、行動者番号、選択中コマンド、ターン処理済み状態を破棄する。
- 会話終了後は第二形態を先頭にした新しい入力フェーズを生成する。
- 会話中に再読込した場合も、保存済み第二形態から会話を再生して入力へ戻る。
- ヴェグナシス柱会話も同じ永続キューを使用する。

### 9. アゼルガラグ第二形態の描画サイズ

敵ID `302101` をギルガメッシュ等と同じ単体ショーケースボス判定へ追加した。

- 幅: `65%`
- 最大幅: `450px`
- スケール: `1.2`

## 変更ファイル

- `battle.js`
- `dungeon.js`
- `main.js`
- `maps_logic.js`
- `story_logic.js`
- `tools/validation/validate-progression-integrity.js`（新規）
- 本報告書

`story.js`、`map.js`、シナリオ本文、素材定義は変更していない。

## 自動検証

以下は成功した。

- 全変更JSの `node --check`
- `git diff --check`
- `validate-progression-integrity.js`
  - 実際の `light_palace_prison_leila` で葉消費直後から加入まで再開
  - 旧形式レイラ回復会話セーブの移行
  - 複数イベント予約と明示dedupe
  - MAP移動失敗時のイベント保持
  - 勝敗確定順、固定ボス拘束、形態移行、描画判定の静的確認
- `validate-abyss-battle.js`（20 checks）
- `validate-battle-logic.js`
- `validate-save-safety.js`
- `validate-audio-result-flow.js`
- `validate-story-item-conditions.js`
- `validate-story-dialogue-data.js`（252 scripts / 232 events）
- `validate-main-story-routing.js`
- `validate-fixed-encounter-rosters.js`
- `validate-fixed-exit-on-step.js`

`validate-map-safety.js` はこの環境で単独実行しても制限時間内に完了しなかったため、合否を確定していない。

次の既存テスト失敗は修正前アーカイブでも同じ結果だったため、今回の変更による回帰ではない。

- `validate-quest-runtime.js`: `Hunt progress counted unrelated monsters or missed targets.`
- `validate-key-door-runtime.js`: `random key was not stored in dungeon.randomKeys`

素材を除外したアーカイブのため、画像・音声の実ファイルを必要とする全検証、および実ブラウザでの描画確認は実施できない。

## フル素材版での最終確認項目

監査記載の中断ポイントに加え、特に次を実機で確認する。

1. レイラ加入で葉を消費した直後、回復会話中、加入直前に再読込する。
2. 勝利表示、経験値表示、レベルアップ表示、ドロップ表示の各地点で再読込する。
3. 全滅表示直後とタップ前に再読込する。
4. 戦後会話開始直前と途中で再読込する。
5. アゼルガラグ変身会話中に再読込し、手動入力とオートの両方で第二形態が進行することを確認する。
6. 第二形態がギルガメッシュと同等の単体巨大表示になることを確認する。
7. ヴェグナシス柱を複数同時撃破し、各会話中に再読込する。
8. 連戦第一戦終了後・第二戦開始前に再読込する。

