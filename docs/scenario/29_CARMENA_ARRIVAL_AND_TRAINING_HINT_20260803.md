# カルメナ初到着警告・地上出身住民会話 2026-08-03

> 状態: ユーザー承認済み・実装対象。

## 目的

- カルメナ到着直後に、プリズムの加護が届かず全属性耐性が低下している危険を、システム会話で明示する。
- 北門の二将に勝てない場合の育成先として、地上の大灯台北側にある魔境を自然に案内する。
- 案内役を単なるヒント係にせず、地上から落ちてきて外出を恐れる住民として配置する。

## 初到着会話

- script key: `ABYSS_CARMENA_ARRIVAL_WARNING`
- event id: `abyss_carmena_arrival_warning`
- 初回フラグ: `abyssCarmenaArrivalWarningSeen`

```text
システム「プリズムの加護も届かない場所まで来てしまったようだ……。
今、攻撃を受ければ大きな傷を負うかもしれない……。」
```

## 地上から落ちた男

- script key: `ABYSS_CARMENA_RESIDENT_LIGHTHOUSE`
- event id: `abyss_carmena_resident_lighthouse`
- 配置: カルメナ東側、道具屋付近

```text
地上から落ちた男「……地上にいた頃、大灯台の北に流れ着いたことがあったんだ。」

地上から落ちた男「あそこには、人が入るべきじゃねえ魔境があった。
今思えば、ここと似た雰囲気だったな。」

地上から落ちた男「あんたらくらい強ければ、良い訓練になるのかね。
俺は無理だ、怖くてもうどこにもいけねえよ。」
```

## Review result

Target: カルメナ初到着警告・地上出身住民
Reviewer: Codex
Date: 2026-08-03

### Scores

- Character voice separation: 4
- On-screen readability and dialogue rhythm: 5
- Spoiler discipline: 5
- Lived-in world detail: 4
- Exposition control: 5
- Foreshadowing subtlety: 4
- Flag and party awareness: 5
- Existing dialogue handling: 5
- Implementation readiness: 5

### Required fixes before implementation

- なし。ユーザーが本文と目的を明示している。

### User approval required

- 承認済み。

### Codex recommendation

- implement
