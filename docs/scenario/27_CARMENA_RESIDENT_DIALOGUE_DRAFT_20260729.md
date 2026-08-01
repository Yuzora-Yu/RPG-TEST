# カルメナ住民会話 草稿 2026-07-29

> 状態: 2026-07-29 ユーザー承認済み。四イベントへ分割して、現在の `story.js` と `map.js` へ実装。

## 狙い

- 地上と異なる絶望感を、設定説明ではなく生活の傷として見せる。
- 住民をヒント係にせず、食料・水・家族・門番・時間感覚を持つ人として書く。
- 「神隠し」「プリズム崩壊に巻き込まれた王国」は住民の記憶・推測として扱い、真相を確定しない。

## 配置案

### 南段・黒い泉の近く：帰る場所を失った男

- script key: `ABYSS_CARMENA_RESIDENT_SPRING`
- event id: `abyss_carmena_resident_spring`

```text
住人「その水面を、あまり長く見るな。
帰りたい場所の匂いがする。」

住人「俺には麦を焼く匂いだった。
飛び込んだよ。三度もな。」

住人「戻ってきた時には、靴の泥だけ増えていた。」
```

### 西段・宿の裏：配給を数える女

- script key: `ABYSS_CARMENA_RESIDENT_RATIONS`
- event id: `abyss_carmena_resident_rations`

```text
住人「四人分。……違う、三人分でいい。」

住人「北門へ連れていかれた人の皿まで並べると、
宿の主人が怒るんだ。」

住人「片づけるのは、もう少し後にする。」
```

### 中段・崩れた段丘：古い王国名を語る老人

- script key: `ABYSS_CARMENA_RESIDENT_OLD_KINGDOM`
- event id: `abyss_carmena_resident_old_kingdom`

```text
老人「王都の鐘が、昼なのに七つ鳴った。
そこから先は、ここだ。」

老人「国の名か。……お前さんの地図には無いだろうよ。」

老人「若い連中は、わしが作った昔話だと言う。
あいつらの祖父より、わしのほうが後から来たのにな。」
```

### 北段・門を見張る子ども

- script key: `ABYSS_CARMENA_RESIDENT_GATE_CHILD`
- event id: `abyss_carmena_resident_gate_child`

```text
子ども「鎧の人が、今日は二回こっちを見た。」

子ども「三回見た日は、誰かいなくなる。
だから、数えてる。」

子ども「……いま、二回だよ。」
```

## 進行差分案

二将撃破後は全員を長い感謝台詞へ変えず、小さな変化に留める。

- 配給の女：四人目の皿を片づけ始める。
- 老人：北から風が来ることだけを確かめる。
- 子ども：回数を数えるのをやめられず、門ではなく主人公を見る。
- 泉の男：地上へ帰るかどうか、まだ決められない。

## Review result

Target: カルメナ住民四名の新規会話
Reviewer: Codex
Date: 2026-07-29

### Scores

- Character voice separation: 4
- On-screen readability and dialogue rhythm: 5
- Spoiler discipline: 5
- Lived-in world detail: 5
- Exposition control: 5
- Foreshadowing subtlety: 4
- Flag and party awareness: 3
- Existing dialogue handling: 5
- Implementation readiness: 4

### Implementation resolution

- 今回は初回実装として、撃破前後で住民の記憶そのものを反転させず、共通会話とした。
- 子どもには既存の `overlay_npc_child`、老人には `overlay_npc_elder` を使用した。
- 現行 `abyss_carmena_resident` は廃止し、四イベントへ置換した。

### User approval

- 2026-07-29「深淵の会話は実装してOK。どんどん住人増やして」により承認。

### Implemented files

- `story.js`（旧 `abyss_story.js` の内容を統合）
- `map.js`
