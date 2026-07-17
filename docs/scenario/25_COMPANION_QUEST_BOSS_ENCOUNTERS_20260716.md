# 仲間加入クエストボス・戦闘前会話

Status: implementation approved by direct user request
Date: 2026-07-16

## 目的

固定マップ上の仲間加入クエストボスが、受注済みであるにもかかわらず会話なしで戦闘へ入る欠落を解消する。既存の受注会話・勝利会話・ボス編成は変更せず、接触後のアクション実行から「短い遭遇会話→ボス戦→既存勝利イベント」へ統一する。

既存原稿をそのまま使用するもの:

- 禁忌の森: `QUEST_ARISA_HAINE_ENCOUNTER`
- 大灯台: `QUEST_ZELIED_TOWER_ECHO_ENCOUNTER`

## 追加する遭遇会話

### QUEST_KARIN_VOLCANO_ENCOUNTER

- カリン: 「炉の奥に、何かいる。\n灰がこちらへ流れてくる。」
- カリン: 「無理に踏み込まないで。\nあの角がこちらを向いたら、私が合わせる。」

### QUEST_SOPHIA_ALAN_ENCOUNTER

- ソフィア: 「祭壇の流れが逆向きだ。\n来るよ、足場から離れないで。」
- アラン: 「正面は私が受けます。\nソフィア、流れを読むのは任せた。」

### QUEST_FRIEDA_BARON_ENCOUNTER

- フリーダ: 「制御環が勝手に回ってる。\nまずい、あれ自身が核だ。」
- バロン: 「退路は確保した。\n放電が収まる前に叩くぞ。」

### QUEST_LICIA_ENCOUNTER

- リーシア: 「待って。あの結界、壁じゃない。\n中で何かを飼ってる。」
- リーシア: 「核を壊せば解ける。\n来るわ。」

### QUEST_CLAUDE_LEON_ENCOUNTER

- クロード: 「王冠の下にいるのは、一体じゃない。\n声が重なってる。」
- レオン: 「耳を貸すな。\n影が形を取る前に断つ。」

### QUEST_LUNA_ENCOUNTER

- ルーナ: 「月の光が、ここだけ届かない。\n影がこちらを見ています。」
- ルーナ: 「私は退きません。\n共に、あれを止めてください。」

### QUEST_RYU_MINERVA_ENCOUNTER

- ミネルバ: 「待って。この留め具、\n誰かが内側から削ってる。」
- リュウ: 「来る。\n話は生きて戻ってからだ。」

### QUEST_ZENON_ENCOUNTER

- ゼノン: 「封じたはずの最悪が、\nまだ底で息をしている。」
- ゼノン: 「私が縛る。\nお前は、その間に斬れ。」

## 実装条件

- クエスト未受注・完了済み・正規討伐済みでは、表示も会話も戦闘も発生させない。
- アクション表示後と会話終了直前の双方で受注状態を再確認する。
- 全固定加入ボスに `startEventId` を持たせる。
- `startEventId` のイベントは、必ず `CONV` が `BOSS` より前にある。
- `BOSS.winEventId` は既存の加入・勝利イベントへ接続する。
- 固定ボス座標、クエストID、能力倍率は会話イベント経由でも失わない。

## レビュー結果

- Character voice separation: 4
- On-screen readability and dialogue rhythm: 5
- Spoiler discipline: 5
- Exposition control: 5
- Flag and party awareness: 5
- Existing dialogue handling: 5
- Implementation readiness: 5

既存台詞の置換はない。遭遇時にその場で観測できる情報だけに絞り、各会話を2発言に限定する。
