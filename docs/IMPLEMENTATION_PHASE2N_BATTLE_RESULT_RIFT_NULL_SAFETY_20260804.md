# PRISMA ABYSS Phase2N 戦闘勝利結果・亀裂報酬null安全化

作成日: 2026-08-04

## 1. 対象症状

通常雑魚戦を含む戦闘で敵を全滅させると、勝利確定中に次の例外が発生する。

```text
TypeError: Cannot read properties of null (reading 'itemName')
    at Object.win (battle.js)
```

結果トランザクションがcommit前に失敗するため、安全ロールバックが作動し、保存済みの戦闘開始状態へ戻る。
画面上は次の症状として見える。

1. 敵が全員復活する。
2. ターン開始へ戻る。
3. オート戦闘が解除される。
4. 再度全滅させても同じ処理を繰り返す。

## 2. 根本原因

勝利結果ジャーナルの `abyssRiftOutcome` 構築条件が次の比較だけで判定されていた。

```js
pendingRiftReward?.rewardId === battle?.riftRewardId
```

通常戦では両方とも未設定であるため、実際には `undefined === undefined` が成立する。
その直後に `pendingRiftReward.itemName` を直接参照し、存在しない報酬オブジェクトからプロパティを読んで例外になっていた。

また、正規の亀裂戦では `Dungeon.onBossDefeated()` が報酬を確定した後、戦闘側の `riftRewardId` を初期化する。
そのため、例外を回避するだけのnullガードでは、亀裂戦の結果ジャーナルへ報酬情報を正しく残せない接続漏れもあった。

## 3. 修正内容

### 3.1 勝利前コンテキストの退避

`Battle.captureAbyssRiftResultContext()` を追加した。

- 亀裂戦として明示された戦闘だけを対象にする。
- 空文字、null、undefinedを有効な報酬IDとして扱わない。
- `Dungeon.onBossDefeated()` が戦闘データを初期化する前に報酬IDを退避する。
- 通常戦中に同じ階層の亀裂オブジェクトが存在しても、通常戦へ誤接続しない。

### 3.2 報酬結果の安全な構築

`Battle.buildAbyssRiftResultOutcome()` を追加した。

結果へ記録する条件を次のすべてが成立した場合だけに限定した。

- 勝利前に退避した空でない報酬IDがある。
- `pendingRiftReward` が実在する。
- `pendingRiftReward.active === true`。
- 退避IDと受取待ち報酬IDが一致する。

報酬名が欠落した旧データでは、表示と同じ `輝く装備+3` を代替名にする。

### 3.3 結果ジャーナル

危険な三項演算子と直接プロパティ参照を削除し、安全に構築済みの `abyssRiftOutcome` だけを保存する。

- 通常戦: `abyssRiftOutcome: null`
- 通常ボス戦: `abyssRiftOutcome: null`
- 古い亀裂報酬が残る通常戦: `abyssRiftOutcome: null`
- 正規の亀裂戦: 報酬IDと装備名を保存

戦闘結果ジャーナル、commit前ロールバック、commit後の演出復旧は削除・無効化していない。

## 4. 追加試験

`tools/test-phase2n-battle-result-rift-null-safety.js` を追加した。

次を実際の `Battle.win()` を通して検証する。

- 通常雑魚戦が結果commitまで完了する。
- 通常戦で亀裂報酬結果が混入しない。
- 古い受取待ち報酬が残っても現在の通常戦へ混入しない。
- 亀裂戦で戦闘側IDが初期化された後も、退避IDで結果を記録する。
- 報酬名欠落時に安全な代替名を使う。
- 異なる報酬IDを接続しない。
- 勝利処理に `pendingRiftReward.itemName` の危険な直接参照が残っていない。

## 5. 更新ファイル

- `battle.js`
- `news.js`
- `sw.js`
- `tools/test-phase2m-save-slots-playtime.js`
- `tools/test-phase2n-battle-result-rift-null-safety.js`
- `docs/BATTLE_RESULT_RIFT_NULL_SAFETY_AUDIT_20260804.csv`
- `docs/FUTURE_IDEA_TIME_REWIND_TRAIT_20260804.md`
- 本書
- Phase2N引継ぎ書

## 6. Service Worker

App Shellキャッシュを `prisma-abyss-v44.20260804` へ更新した。
画像全量用runtime cacheは既存の `prisma-abyss-v39.20260804-runtime` を維持する。

Phase2M試験がApp Shellのバージョンを `v43` に固定していたため、Phase2M以降の正当な更新を許容する範囲判定へ変更した。

## 7. 実機確認項目

1. 通常雑魚3体を手動戦闘で全滅させる。
2. 同じ戦闘をオートで全滅させる。
3. 通常ボスを撃破する。
4. 形態移行ボスの最終形態を撃破する。
5. 深淵の亀裂戦を撃破し、+3装備の受取会話まで完了する。
6. 勝利確定中・結果表示中に再読込し、報酬が二重にならないことを確認する。
7. コンソールに `win transaction failed` と `itemName` 例外が出ないことを確認する。

## 8. 今回実装しない企画案

ユーザー提案の時属性魔族・特性「死に戻り」は、将来案として別資料へ記録した。
現在の例外復旧ロールバックをゲーム仕様として直接転用せず、将来実装時はターン開始時の明示的スナップショットを別に設計する。
