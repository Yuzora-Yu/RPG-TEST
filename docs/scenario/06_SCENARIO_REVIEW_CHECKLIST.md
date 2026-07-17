# 06_SCENARIO_REVIEW_CHECKLIST

シナリオ草稿・既存会話レビュー・実装前チェックに使う。

## Review score

各項目を 1〜5 で採点する。

| score | 意味 |
|---|---|
| 5 | とても良い |
| 4 | ほぼ問題なし |
| 3 | 許容範囲だが改善余地あり |
| 2 | 問題あり。修正推奨 |
| 1 | 重大問題。実装不可 |

2以下がある場合は、実装前に修正またはユーザー判断待ちにする。

## Checklist

### 1. Character voice separation

- 話者ごとに一人称・語尾・語彙・リズムが違うか。
- そのキャラでなくても言えるセリフになっていないか。
- 語尾だけで個性を作っていないか。

Score:
Notes:

### 2. On-screen readability and dialogue rhythm

- 固定文字数ではなく、実際の会話画面で無理なく読めるか。
- `\n` の位置が意味、間、人物の呼吸に合っているか。
- 情報を詰め込みすぎて人物の声や場面のテンポを損なっていないか。
- システム文が必要な情報を保ちつつ理解しやすい構成になっているか。

Score:
Notes:

### 3. Spoiler discipline

- その時点で知らない真相を言っていないか。
- 後半の真相を古文書やNPCが早出ししていないか。
- キャラの憶測と事実が混同されていないか。

Score:
Notes:

### 4. Lived-in world detail

- NPCが生活している人間に見えるか。
- 町の仕事、食べ物、道具、家族、天候、損得があるか。
- ヒント係だけのNPCが多すぎないか。

Score:
Notes:

### 5. Exposition control

- 説明しすぎていないか。
- 会話が設定資料になっていないか。
- 遺跡・本・碑文が答えを言いすぎていないか。

Score:
Notes:

### 6. Foreshadowing subtlety

- 伏線が露骨すぎないか。
- 数が多すぎないか。
- 後から気づく程度になっているか。
- ミスリードが感情や土地の噂から生まれているか。

Score:
Notes:

### 7. Flag and party awareness

- storyStep/subStep に合っているか。
- progress.flags による分岐が必要か。
- 仲間加入状況に応じた差分があるか。
- 未加入キャラが会話に参加していないか。

Score:
Notes:

### 8. Existing dialogue handling

- 現行文を自動正史扱いしていないか。
- 現行文を勝手に書き換えていないか。
- 気になる現行文は `07_DIALOGUE_REVIEW_QUEUE.md` に送ったか。
- ユーザー承認が必要な箇所を明示したか。

Score:
Notes:

### 9. Implementation readiness

- script key が明確か。
- map event が明確か。
- flags to set/check が明確か。
- 既存セーブ互換性を壊さないか。
- 実装後の検証方法があるか。

Score:
Notes:

## Final decision

```md
## Review result

Target:
Reviewer:
Date:

### Scores
- Character voice separation:
- On-screen readability and dialogue rhythm:
- Spoiler discipline:
- Lived-in world detail:
- Exposition control:
- Foreshadowing subtlety:
- Flag and party awareness:
- Existing dialogue handling:
- Implementation readiness:

### Required fixes before implementation
- 

### User approval required
- 

### Codex recommendation
- implement / revise first / wait for user decision / split into smaller tasks
```
