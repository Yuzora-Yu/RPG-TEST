# 深淵三都市 住民会話正本 2026-07-29

> 状態: ユーザー承認済み・実装済み。

## 方針

- DQ6「はざまの世界」のように、希望が薄い土地で生活だけは続いている感触を優先する。
- 道案内だけを話すNPCにせず、食事、仕事、家族、税、牢、城の慣習を持たせる。
- プリズム崩壊で失われた王国は断定的な設定説明にせず、老人や記録官の証言として示す。
- 一つの会話を複数の住民へ流用しない。

## カルメナ

- `ABYSS_CARMENA_RESIDENT_SPRING`: 黒い泉に故郷の匂いを感じ、三度飛び込んだ男。
- `ABYSS_CARMENA_RESIDENT_RATIONS`: 北門へ連れていかれた者の皿を片づけられない宿の手伝い。
- `ABYSS_CARMENA_RESIDENT_OLD_KINGDOM`: 昼に七度鳴った王都の鐘と、地図にない国を記憶する老人。
- `ABYSS_CARMENA_RESIDENT_GATE_CHILD`: 将軍に見られた回数と失踪者を結びつけて数える子ども。

## ビスタ

- `ABYSS_VISTA_RECRUITMENT`: 深淵魔物の低確率仲間化を世界内の伝承として伝える魔物使い。
- `ABYSS_VISTA_SCAVENGER`: 墓地の風で一日の仕事を決める南区の拾い屋。
- `ABYSS_VISTA_WIDOW`: 地下道に夫の名を刻んだ女。
- `ABYSS_VISTA_TOLL_KEEPER`: 南北分断時代の通行税をやめた北区の門番。
- `ABYSS_VISTA_LAMPLIGHTER`: 誰の帰還を待つか分からない灯を継いだ灯守。
- `ABYSS_VISTA_UNDERPASS_WORKER`: 南北双方の崩落を直す補修工。
- `ABYSS_VISTA_UNDERPASS_CHILDREN`: 大人の対立を離れて地下道で遊ぶ子ども。

## レガシオン

- `ABYSS_LEGACION_SMITH_APPRENTICE`: 深淵の鉄の声を聞き分けようとする徒弟。
- `ABYSS_LEGACION_GUILD_CLERK`: 未帰還者の帳面を捨てない記録係。
- `ABYSS_LEGACION_CASTLE_SERVANT`: 滅びた皇帝家の食卓へ八枚の皿を置く城勤め。
- `ABYSS_LEGACION_WALL_VENDOR`: リドパルム帰還者の影を警戒する商人。
- `ABYSS_LEGACION_PRISON_MOTHER`: 空の檻の前で息子を待つ母。
- `ABYSS_LEGACION_PRISON_GUARD`: 開いた扉から出られない囚人を見た老牢番。
- `ABYSS_LEGACION_TEMPLE_ACOLYTE`: 下から返る祈りを恐れ、灯だけを供える侍祭。
- `ABYSS_LEGACION_GALLERY_PAGE`: 過去と未来を見る二塔の間で「今」を見張る小姓。
- `ABYSS_LEGACION_ARCHIVIST`: 王国が儀式の影へ落ちたという禁書を守る記録官。
- `ABYSS_LEGACION_WEST_SENTRY`: 帰らない相棒の毛布を使う西塔衛兵。
- `ABYSS_LEGACION_EAST_OBSERVER`: 火山を星の代わりに観測する東塔観測士。

## Review result

- Character voice separation: 5
- On-screen readability and dialogue rhythm: 5
- Spoiler discipline: 4
- Lived-in world detail: 5
- Exposition control: 5
- Foreshadowing subtlety: 4
- Flag and party awareness: 3
- Existing dialogue handling: 5
- Implementation readiness: 5

実装後は全イベント参照、NPC画像キー、各入口からの到達可能性を検証する。
