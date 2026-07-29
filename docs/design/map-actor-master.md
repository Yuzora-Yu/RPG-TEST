# 配置キャラ正本（mapActors）設計

## 目的

町や固定ダンジョンにいる人物を、座標ごとの会話イベントではなく「同じ人物」として管理する。
進行により会話、画像、立ち位置、表示条件が変わっても、人物の識別子は変えない。

## mapActors と mapActions の使い分け

- `mapActors`: 住人、兵士、王、神官、ボス前会話役など、人格を持つ配置キャラ
- `mapActions`: 扉、階段、店の入口、泉、スイッチ、転移装置など、場所や設備に属する操作

人を `mapActions` に状態ごとに複数登録しない。同一人物の変化は、必ず一つの `mapActors` 要素の `states` にまとめる。

## 識別子

各MAP・各階層で次を定義する。

- `placementId`: 1～1000の整数。そのMAP／階層内で一意にする
- `actorId`: 英小文字・数字・アンダースコアによる、人が読める安定名
- `actorKey`: 実行時に `MAPまたは階層の安定ID + placementId` から生成される永続キー
- `stateId`: 同じ人物内で一意の状態名
- `nextActorPlacementId`: エディタが次に発行する番号。人物を削除しても減らさない

`placementId` は座標番号ではない。人物を移動しても変更しない。公開済みのIDは、人物を削除した後も別人へ再利用しない。欠番を許容し、セーブデータとの同一性を守る。エディタは `nextActorPlacementId` を増加させて再利用を防ぐ。

`name` は画面表示用なので変更可能。永続的な判定に名前や座標を使わない。

## 正本の例

```js
mapActors: [
    {
        placementId: 1,
        actorId: "captive_king",
        name: "幽閉された国王",
        x: 7,
        y: 3,
        imageKey: "overlay_light_captive_king",
        states: [
            {
                stateId: "after_catalyst",
                priority: 300,
                when: {
                    requiredFlag: "lightPalaceCleared",
                    requiredItems: [{ id: 111, count: 1 }]
                },
                action: {
                    label: "国王と話す",
                    type: "storyEvent",
                    eventId: "light_palace_prison_king_after_catalyst"
                }
            },
            {
                stateId: "before_palace_clear",
                priority: 100,
                when: { missingFlag: "lightPalaceCleared" },
                action: {
                    label: "国王と話す",
                    type: "storyEvent",
                    eventId: "light_palace_prison_king"
                }
            }
        ]
    }
]
```

## 状態の決定

1. `priority` の大きい状態から評価する
2. `when` を満たす最初の一件だけを、現在の表示・会話状態として採用する
3. 同じ人物内で `priority` を重複させない
4. 条件はできる限り相互排他的に書く
5. 将来条件が重なっても、高優先度側が選ばれるため配列順には依存しない

共通条件として以下を利用できる。

- `requiredFlag` / `requiredFlags`
- `missingFlag` / `missingFlags`
- `requiredItems` / `missingItems`
- `requiredStoryStep` / `requiredSubStep`
- クエスト型 action の解放・受注・完了条件

人物が移動または変装する場合だけ、状態に `placement` を追加する。

```js
{
    stateId: "moved_to_gate",
    priority: 200,
    when: { requiredFlag: "gateOpened" },
    placement: { x: 18, y: 6, imageKey: "overlay_npc_guard_armor" },
    action: { label: "兵士と話す", type: "storyEvent", eventId: "guard_after_gate" }
}
```

未指定の座標・画像・描画設定は人物本体から継承される。移動しても `actorKey` は変わらない。

## 会話履歴とセーブ互換

会話巡回回数など人物単位の履歴は、座標ではなく `actorKey` を保存先にする。状態ごとに履歴を分ける必要がある場合のみ、actionへ明示的な `conversationKey` を指定する。

既存の `mapActions` は設備や未移行NPCのため当面互換維持する。移行時は以下を守る。

1. 同じ座標の人物用 `mapActions` を全て抽出する
2. 一つの `mapActors` と複数の `states` へまとめる
3. 条件と優先度を明記する
4. 旧 `mapActions` を削除して二重発火を防ぐ
5. 配置キャラ検証と対象MAPの固有検証を実行する

## 編集と検証

`map_story_editor.html` では `mapActors` を追加・編集できる。新規追加時は `nextActorPlacementId` と現在の最大IDの大きい方から次の番号を発行し、発行後にカウンターを進める。人物を削除してもカウンターは戻らない。

主な検証:

- `tools/validation/validate-map-actors.js`: 全MAPのID、座標、状態、参照イベントを検査
- `tools/validation/validate-map-actor-master.js`: 状態優先度、フラグ・所持品遷移、座標非依存の人物同一性を検査
- 各MAP固有の検証: 物語上の期待状態と導線を検査

## 移行状況

2026-07-29に既存NPC 84配置を `mapActors` へ移行した。人物画像を持つ定義を `mapActions` へ新規追加してはならない。`mapActions` は施設、入口、泉、スイッチなど人格を持たない設備専用とする。

移行確認には `node tools/migrations/migrate-map-npcs-to-actors.js` を書き込み指定なしで実行する。移行候補が0件であることと、`validate-map-actors.js` が全件通過することを確認する。設備まで人物正本へ混ぜず、配置キャラの一覧がそのまま登場人物台帳として読める状態を保つ。
