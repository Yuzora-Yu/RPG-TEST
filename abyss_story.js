/* abyss_story.js - canonical scenario data and event bindings for the Abyss world. */
(() => {
    'use strict';

    const data = globalThis.STORY_MANAGER_DATA;
    if (!data) return;
    data.scripts = data.scripts || {};
    data.events = data.events || {};

    const cloneScript = (sourceKey, replacements = {}) => {
        const source = data.scripts[sourceKey] || [];
        const replace = value => {
            let text = String(value ?? '');
            Object.entries(replacements).forEach(([from, to]) => { text = text.split(from).join(to); });
            return text;
        };
        return source.map(line => ({
            ...line,
            ...(typeof line?.name === 'string' ? { name: replace(line.name) } : {}),
            ...(typeof line?.text === 'string' ? { text: replace(line.text) } : {})
        }));
    };

    Object.assign(data.scripts, {
        ABYSS_CARMENA_GATE: [
            { name:'システム', text:'北門の前で、二人の将軍が同時に武器を構えた。\n黒い空気が鎧の隙間から流れ、町を覆う淀みと結びついている。' },
            { name:'グレン将軍', text:'ここより先は、深淵王の領域。\n地上の者を一歩たりとも通すわけにはいかぬ。' },
            { name:'レオン将軍', text:'退け。これは二将に下された最後の命令だ。\n我らの命が尽きぬ限り、北門は開かない。' },
            { name:'ジョセフ', text:'町の連中まで巻き込んで守る門に、何の意味がある。\nその命令ごと、ここで止める。', charId:101 },
            { name:'シャニー', text:'二人を縛る力が、カルメナの汚染を支えている。\nここで断てば、みんなの体も元に戻る。', charId:306 },
            { name:'魔王ゼノン', text:'ならば二将まとめて引導を渡す。\n門を開けろ。深淵の王へ至る道を、我らが切り拓く。', charId:402 }
        ],
        ABYSS_CARMENA_GATE_CLEAR: [
            { name:'システム', text:'二将の鎧から黒い霧が抜け、北門を塞いでいた力が砕けた。\n町を覆っていた息苦しさも、潮が引くように薄れていく。' },
            { name:'グレン将軍', text:'……守るべき巣は、とうに失われていたか。' },
            { name:'レオン将軍', text:'それでも門に立ち続けた。命令だけを、最後の名として。' },
            { name:'ジョセフ', text:'もう休め。門の先は、生きてる俺たちが引き受ける。', charId:101 },
            { name:'システム', text:'全身を蝕んでいた深淵の汚染が消え、仲間たちの属性耐性が元に戻った。\nカルメナの北門が開いた。' }
        ],
        ABYSS_LEONARD: cloneScript('ABYSS_FLOOR_030_LEONARD', { '雷楔のレナード':'黒雷のレナード' }),
        ABYSS_LEONARD_CLEAR: cloneScript('ABYSS_FLOOR_030_CLEAR', { '雷楔のレナード':'黒雷のレナード' }),
        ABYSS_ELICIA: cloneScript('ABYSS_FLOOR_040_ELICIA', { '風楔のエリシア':'死風のエリシア' }),
        ABYSS_ELICIA_CLEAR: cloneScript('ABYSS_FLOOR_040_CLEAR', { '風楔のエリシア':'死風のエリシア' }),
        ABYSS_FIRST_BARRIER_CLEAR: [
            { name:'システム', text:'雷と風、二つの結界核が失われた。\n深淵都市ビスタを覆っていた第一層の結界が砕け、南西門への道が開いた。' },
            { name:'シャニー', text:'ビスタの向こうへ進める。\nでも、さらに北には別の結界が残っている。', charId:306 }
        ],
        ABYSS_SYRIS: cloneScript('ABYSS_FLOOR_050_SYRIS', { '氷楔のシーリス':'極零のシーリス' }),
        ABYSS_SYRIS_CLEAR: cloneScript('ABYSS_FLOOR_050_CLEAR', { '氷楔のシーリス':'極零のシーリス' }),
        ABYSS_GRAD: cloneScript('ABYSS_FLOOR_060_GRAD', { '炎楔のグラド':'焦熱のグラド' }),
        ABYSS_GRAD_CLEAR: cloneScript('ABYSS_FLOOR_060_CLEAR', { '炎楔のグラド':'焦熱のグラド' }),
        ABYSS_SECOND_BARRIER_CLEAR: [
            { name:'システム', text:'水と火、残る二つの結界核が消滅した。\n混沌魔城レガシオンを閉ざしていた第二層の結界が崩れ去った。' },
            { name:'魔王ゼノン', text:'これで魔城までの道は繋がった。\n深淵王の喉元へ、ようやく刃が届く。', charId:402 }
        ],
        ABYSS_VELD: cloneScript('ABYSS_FLOOR_070_VELD', { '混沌の騎士ヴェルド':'昏迷の黒騎士ヴェルド' }),
        ABYSS_VELD_CLEAR: cloneScript('ABYSS_FLOOR_070_VELD_CLEAR', { '混沌の騎士ヴェルド':'昏迷の黒騎士ヴェルド' }),
        ABYSS_JASPER: cloneScript('ABYSS_FLOOR_090_JASPER', { '暗黒神官ジャスパー':'妄執の神官ジャスパー' }),
        ABYSS_JASPER_CLEAR: [
            ...cloneScript('ABYSS_FLOOR_090_JASPER_CLEAR', { '暗黒神官ジャスパー':'妄執の神官ジャスパー' }),
            { name:'システム', text:'ジャゴレアの根元に、濁った光を放つ結晶が残された。\n混沌の結晶片を手に入れた。' }
        ],
        ABYSS_ILLUMINACIA: [
            { name:'混沌姫イルミナシア', text:'ようやく来たのね。\nこの牢獄では、時間も祈りも、わたくしの指先で同じ色に溶ける。' },
            { name:'シャオ', text:'旧い深淵で人を弄んでいた影と同じ匂いだ。\nだが今度は、観察して笑うだけじゃ済ませない。', charId:105 },
            { name:'混沌姫イルミナシア', text:'地上の光も、魔族の闇も、最後には混沌へ還る。\n抗うほど美しく崩れるから、ここまで招いたのよ。' },
            { name:'レイラ', text:'人の誇りを、壊れ方で数えるな。\nこの牢獄ごと、あなたの傲慢を断ちます。', charId:204 },
            { name:'シャニー', text:'混ぜれば同じになると思っている。\nでも、違いを抱えたまま手を取り合えることを、この人は知らない。', charId:306 },
            { name:'混沌姫イルミナシア', text:'ならば見せて。\n混沌にほどけない絆が、本当に存在するのかを。' }
        ],
        ABYSS_ILLUMINACIA_CLEAR: [
            { name:'システム', text:'イルミナシアの影が崩れると、牢獄の奥で空間そのものが裂けた。' },
            { name:'混沌姫イルミナシア', text:'……まだ、ひとつの色にならないのね。\nならば王の前で、最後まで足掻いてみせなさい。' },
            { name:'シャニー', text:'亀裂の向こうに、深淵王の気配がある。\n終わらせよう。ここまで落ちた全部を。', charId:306 }
        ],
        ABYSS_VEGNASIS: [
            { name:'システム', text:'五つの声が、一本の異形の柱から重なって響く。\n雷、風、水、火、闇の魂が、深淵の肉へ縫い合わされていた。' },
            { name:'死幻の魔柱ヴェグナシス', text:'個は弱い。絆は脆い。\nゆえに王は、五つを一つへ混ぜ、死なぬ柱とした。' },
            { name:'ジョセフ', text:'一つにしたつもりか。\n声が五つ聞こえる時点で、誰一人消せちゃいねえ。', charId:101 },
            { name:'シャニー', text:'倒すたび、残った魂へ力が流れる。\nそれでも、一つずつ解き放つしかない。', charId:306 },
            { name:'魔王ゼノン', text:'五つの怨念ごと斬り伏せる。\n王の前座にしては、悪趣味が過ぎるぞ。', charId:402 }
        ],
        ABYSS_SPIRIT_FINAL_BLESSING: [
            { name:'システム', text:'認められた精霊のプリズムが呼応し、幾重もの光が一行を包んだ。' },
            { name:'シャニー', text:'精霊たちが、この戦いだけ力を重ねてくれている。\n五つの属性を恐れず、魂の結び目を断とう。', charId:306 }
        ],
        ABYSS_VEGNASIS_FALL_1: [{name:'黒雷のレナード',text:'……盾よ。雷は、もう私を縛らぬ。\n残る者を頼む。'}],
        ABYSS_VEGNASIS_FALL_2: [{name:'死風のエリシア',text:'風が……家々の灯りへ帰っていく。\n押し流すだけの風では、なかった。'}],
        ABYSS_VEGNASIS_FALL_3: [{name:'極零のシーリス',text:'水底にも……朝は届くのね。\n凍らせた声を、連れていって。'}],
        ABYSS_VEGNASIS_FALL_4: [{name:'焦熱のグラド',text:'小さな灯か……。\n灰より先に、守り抜いてみせろ。'}],
        ABYSS_VEGNASIS_FALL_5: [{name:'昏迷の黒騎士ヴェルド',text:'レイラ……顔を上げろ。\n最後の門は、お前たちの手で開け。'}],
        ABYSS_VEGNASIS_CLEAR: [
            { name:'システム', text:'最後の魂が解け、死幻の魔柱は音もなく崩れ落ちた。\n祭壇の最奥で、深淵王がゆっくりと立ち上がる。' },
            { name:'シャニー', text:'休ませてはくれない。\nでも、ここで止まれば、五人をまた深淵へ渡すことになる。', charId:306 }
        ],
        ABYSS_AZELGARAG: [
            { name:'深淵王アゼルガラグ', text:'よくぞ我が世界を歩いた。\n町を繋ぎ、楔を解き、捨てた魂へ名を返したか。' },
            { name:'魔王ゼノン', text:'世界を名乗るには狭量だな。\n貴様の深淵は、奪ったものを混ぜて腐らせる穴にすぎぬ。', charId:402 },
            { name:'深淵王アゼルガラグ', text:'違いこそ争いの種。\nすべてを混沌へ還せば、痛みも選別もない。' },
            { name:'シャニー', text:'痛みを消すために、痛みを感じる人まで消す。\nそんな静けさを、救いとは呼ばない。', charId:306 },
            { name:'深淵王アゼルガラグ', text:'ならば証明せよ。\n五柱を越え、なお残るその命で、深淵の終わりを語ってみせよ。' }
        ],
        ABYSS_AZELGARAG_TRANSFORM: [
            { name:'システム', text:'深淵王の肉体が崩れた。\nしかし黒い亀裂は閉じず、砕けた力を吸い上げて新たな姿を形作る。' },
            { name:'深淵王アゼルガラグ・終極', text:'我は王ではない。深淵そのもの。\n終わりを望む声がある限り、何度でも形を得る。' },
            { name:'光の神', text:'終わりを選ぶには、まだ早い。\n異なる光を携えた者たちよ、いま一度立ちなさい。' },
            { name:'システム', text:'柔らかな光が一行を包んだ。\nHPとMPが全回復し、全能力が高まった。' },
            { name:'シャニー', text:'これが最後。\n今度こそ、深淵の意思ごと断つ。', charId:306 }
        ],
        ABYSS_AZELGARAG_CLEAR: [
            { name:'システム', text:'終極の姿がほどけ、深淵を満たしていた圧力が消えていく。\n遠く離れた町々の空へ、初めて淡い光が差した。' },
            { name:'深淵王アゼルガラグ', text:'異なるまま……並び立つか。\nそれもまた、混沌とは違う一つの答え……。' },
            { name:'シャニー', text:'答えは一つじゃない。\nだから、誰かが全部を終わらせて決める必要もない。', charId:306 },
            { name:'ジョセフ', text:'帰ろうぜ。\n地上にも、ここにも、俺たちを待ってる奴がいる。', charId:101 },
            { name:'リュシオン', text:'その前に、これを託しましょう。\n空へ逃れるためではなく、自ら選んだ道を越えるための光です。', charId:501 },
            { name:'システム', text:'光の神リュシオンの加護が、静かに背へ宿った。\n光の翼を手に入れた！' },
            { name:'リュシオン', text:'異なる光を抱いたまま、進みなさい。\nあなたたちが帰る空も、これから選ぶ道も、その翼は拒みません。', charId:501 },
            { name:'システム', text:'一行は光の道を通り、地上へ帰還した。\n終焉の祭壇には、消え切らない小さな亀裂だけが残った。' }
        ],
        ABYSS_POSTGAME_CRACK: [
            { name:'システム', text:'終焉の祭壇を再び訪れると、最奥の亀裂が以前より深く口を開けていた。' },
            { name:'シャニー', text:'物語を縛っていた深淵とは違う。\nここから先は、入るたびに形を変える底なしの迷宮。', charId:306 },
            { name:'魔王ゼノン', text:'王を失ってなお力だけが残ったか。\nよかろう。腕試しの穴として、何度でも踏破してやる。', charId:402 },
            { name:'システム', text:'クリア後深淵、ダンジョンメニュー、宿屋の転送の扉が解放された。' }
        ],
        ABYSS_CARMENA_RESIDENT_SPRING: [
            { name:'泉辺の男', text:'その水面を、あまり長く見るな。\n帰りたい場所の匂いがする。' },
            { name:'泉辺の男', text:'俺には麦を焼く匂いだった。\n飛び込んだよ。三度もな。' },
            { name:'泉辺の男', text:'戻ってきた時には、靴の泥だけ増えていた。' }
        ],
        ABYSS_CARMENA_RESIDENT_RATIONS: [
            { name:'宿の手伝い', text:'四人分。……違う、三人分でいい。' },
            { name:'宿の手伝い', text:'北門へ連れていかれた人の皿まで並べると、\n宿の主人が怒るんだ。' },
            { name:'宿の手伝い', text:'片づけるのは、もう少し後にする。' }
        ],
        ABYSS_CARMENA_RESIDENT_OLD_KINGDOM: [
            { name:'古い外套の老人', text:'王都の鐘が、昼なのに七つ鳴った。\nそこから先は、ここだ。' },
            { name:'古い外套の老人', text:'国の名か。……お前さんの地図には無いだろうよ。' },
            { name:'古い外套の老人', text:'若い連中は、わしが作った昔話だと言う。\nあいつらの祖父より、わしのほうが後から来たのにな。' }
        ],
        ABYSS_CARMENA_RESIDENT_GATE_CHILD: [
            { name:'門を見張る子', text:'鎧の人が、今日は二回こっちを見た。' },
            { name:'門を見張る子', text:'三回見た日は、誰かいなくなる。\nだから、数えてる。' },
            { name:'門を見張る子', text:'……いま、二回だよ。' }
        ],
        ABYSS_VISTA_RECRUITMENT: [
            { name:'ビスタの魔物使い', text:'深淵の魔物でも、まれに地上から差す光へ触れて、憎しみを手放すことがある。' },
            { name:'ビスタの魔物使い', text:'そうなった魔物は、倒した者の強さではなく心を見て、旅へ加わることがある。\n期待しすぎるほど多くはないが、決して零ではない。' }
        ],
        ABYSS_VISTA_SCAVENGER: [
            { name:'南区の拾い屋', text:'墓地の風が止んだ朝は、鉄くずを拾いに行く。\n止まらない朝は、戸を板で塞ぐ。' },
            { name:'南区の拾い屋', text:'暦なんて要らない。\n生き残るには、それで十分だった。' }
        ],
        ABYSS_VISTA_WIDOW: [
            { name:'石段の女', text:'地下道の壁に、夫の名を刻んである。\n北へ働きに出たきり、戻らなかったから。' },
            { name:'石段の女', text:'道が繋がれば帰ってくるなんて、もう思ってない。\nでも、名前まで塞がれるのは嫌なの。' }
        ],
        ABYSS_VISTA_TOLL_KEEPER: [
            { name:'北区の門番', text:'昔は地下道を通るたび、パンを一切れ納めた。\n町を割った連中への通行税さ。' },
            { name:'北区の門番', text:'今は取らん。\n南の子どもが、痩せすぎた。' }
        ],
        ABYSS_VISTA_LAMPLIGHTER: [
            { name:'灯守', text:'この灯は消すなと言われて、親父から継いだ。\n誰が帰るための灯かは、親父も知らなかった。' },
            { name:'灯守', text:'最近、炎が北へ傾く。\nレガシオンの結界が弱っているのかもしれん。' }
        ],
        ABYSS_VISTA_UNDERPASS_WORKER: [
            { name:'地下道の補修工', text:'天井が鳴ったら、壁際へ寄れ。\n走ると、上の町ごと落ちてくる。' },
            { name:'地下道の補修工', text:'南と北が口を利かなくても、下水と崩落は待ってくれん。\nだから俺たちは、両方の壁を直す。' }
        ],
        ABYSS_VISTA_UNDERPASS_CHILDREN: [
            { name:'地下道の子ども', text:'ここなら南区の子とも遊べるんだ。\n大人は暗くて危ないって言うけど。' },
            { name:'地下道の子ども', text:'地上のほうが、みんな怖い顔してるよ。' }
        ],
        ABYSS_LEGACION_ARENA: [{name:'格闘場の係員',text:'ここはモンスター格闘場だ。\nいまは闘技場の整備中だが、門と観客席はいつでも使えるよう保っている。'}],
        ABYSS_LEGACION_SMITH_APPRENTICE: [
            { name:'鍛冶場の徒弟', text:'親方は、深淵の鉄は泣き声で硬さが分かると言う。\n俺には全部、同じ悲鳴に聞こえる。' },
            { name:'鍛冶場の徒弟', text:'だから毎朝、一本ずつ打つ。\nいつか違いが分かるまで。' }
        ],
        ABYSS_LEGACION_GUILD_CLERK: [
            { name:'ギルドの記録係', text:'依頼書は三冊ある。\n未帰還、捜索打切り、名前不明。' },
            { name:'ギルドの記録係', text:'達成済みの帳面は薄い。\nそれでも捨てない。戻った者が、自分の名を探すから。' }
        ],
        ABYSS_LEGACION_CASTLE_SERVANT: [
            { name:'城勤めの女', text:'皇帝家が滅びたあとも、食卓には八枚の皿を置く。\n城の決まりは、主より長生きするものよ。' },
            { name:'城勤めの女', text:'末裔様は一枚でよいと仰る。\nだから七枚は、空のまま磨いている。' }
        ],
        ABYSS_LEGACION_WALL_VENDOR: [
            { name:'城壁下の商人', text:'北門が開けば客が増える。\n増えるのが客だけなら、ありがたいんだがね。' },
            { name:'城壁下の商人', text:'夢幻回廊から戻る連中は、影の数が合わない。\n勘定は日が差す場所でやることにしてる。' }
        ],
        ABYSS_LEGACION_AUDIENCE: [
            { name:'深淵皇帝家の末裔', text:'二層の結界を越えた者よ。\n我らの都へ、失われた道を繋いでくれたことに礼を言う。' },
            { name:'深淵皇帝家の末裔', text:'北門の先に、夢幻回廊リドパルムがある。\n深淵王へ至る者だけが通れるよう、いま門を開こう。' },
            { name:'システム', text:'レガシオンの北門が開いた。' }
        ],
        ABYSS_LEGACION_PRIEST: [
            { name:'レガシオンの神官', text:'あなたたちには、強い属性の加護が幾重にも重なっているようですね。' },
            { name:'レガシオンの神官', text:'もしや、プリズムに宿る声も聞こえるのではありませんか。\n地上で救った六属性のプリズムを訪ねれば、それぞれの大精霊が応えるかもしれません。' }
        ],
        ABYSS_LEGACION_PRISON: [{name:'システム',text:'地下牢には壊れた鎖と空の檻だけが残っている。\n奥の壁から、地下神殿へ続く重い魔力が伝わってくる。'}],
        ABYSS_LEGACION_PRISON_MOTHER: [
            { name:'牢前に座る母', text:'息子は罪人じゃない。\n城壁の外に朝があると言っただけ。' },
            { name:'牢前に座る母', text:'檻は空なのに、あの子は帰らない。\nだから私だけでも、ここで待つ。' }
        ],
        ABYSS_LEGACION_PRISON_GUARD: [
            { name:'老いた牢番', text:'鍵はもう掛けていない。\nだが、開いた扉を怖がって出ない者もいた。' },
            { name:'老いた牢番', text:'牢は鉄で作るとは限らん。\n長く務めて、ようやく知った。' }
        ],
        ABYSS_LEGACION_TEMPLE_ACOLYTE: [
            { name:'地下神殿の侍祭', text:'祈りは上へ届くものだと思っていました。\nここでは、唱えるほど下から返事が来る。' },
            { name:'地下神殿の侍祭', text:'だから声にせず、灯だけを供えています。' }
        ],
        ABYSS_LEGACION_GALLERY_PAGE: [
            { name:'上層回廊の小姓', text:'西塔の鐘は過去を、東塔の鏡は未来を見るそうです。' },
            { name:'上層回廊の小姓', text:'今を見張る者がいないので、僕がここに立っています。' }
        ],
        ABYSS_LEGACION_ARCHIVIST: [
            { name:'城の記録官', text:'プリズム崩壊の夜、王国は消えたのではない。\n土地も人も、儀式の影へ落ちた。' },
            { name:'城の記録官', text:'その記録を禁書にした者たちも、いまは同じ影の中だ。' }
        ],
        ABYSS_LEGACION_WEST_SENTRY: [
            { name:'西塔の衛兵', text:'氷の森が青く光る夜は、城壁まで冷える。\n毛布を二枚、見張り台へ持ち込むんだ。' },
            { name:'西塔の衛兵', text:'規則では一枚だ。\n二枚目は、帰らない相棒の分ということにしている。' }
        ],
        ABYSS_LEGACION_EAST_OBSERVER: [
            { name:'東塔の観測士', text:'煉獄山脈の火は、星の代わりになる。\n揺れ方で、明日の風向きも分かる。' },
            { name:'東塔の観測士', text:'本物の星か。\n一度でいいから、動かない光を見てみたい。' }
        ]
    });

    const bossEvent = (conversation, boss, clearEvent, extraActions = []) => ({
        actions:[{type:'CONV',value:conversation}, ...extraActions, {type:'BOSS',value:boss,winEventId:clearEvent}], winActions:[]
    });
    const clearEvent = (conversation, flags = [], extraActions = []) => ({
        actions:[{type:'CONV',value:conversation}, ...flags.map(key=>({type:'FLAG',key})), ...extraActions], winActions:[]
    });

    Object.assign(data.events, {
        abyss_carmena_gate_battle: bossEvent('ABYSS_CARMENA_GATE',[302001,302000],'abyss_carmena_gate_clear'),
        abyss_carmena_gate_clear: clearEvent('ABYSS_CARMENA_GATE_CLEAR',['abyssCarmenaGateCleared']),
        abyss_leonard_battle: bossEvent('ABYSS_LEONARD',302010,'abyss_leonard_clear',[{type:'LB_ADD_PARTY',charId:101,amount:5,source:'story'}]),
        abyss_leonard_clear: clearEvent('ABYSS_LEONARD_CLEAR',['abyssLeonardDefeated'],[{type:'IF_FLAG',key:'abyssFirstBarrierCleared',then:[{type:'CONV',value:'ABYSS_FIRST_BARRIER_CLEAR'}]}]),
        abyss_elicia_battle: bossEvent('ABYSS_ELICIA',302020,'abyss_elicia_clear',[{type:'LB_ADD_PARTY',charId:106,amount:5,source:'story'}]),
        abyss_elicia_clear: clearEvent('ABYSS_ELICIA_CLEAR',['abyssEliciaDefeated'],[{type:'IF_FLAG',key:'abyssFirstBarrierCleared',then:[{type:'CONV',value:'ABYSS_FIRST_BARRIER_CLEAR'}]}]),
        abyss_syris_battle: bossEvent('ABYSS_SYRIS',302030,'abyss_syris_clear',[{type:'LB_ADD_PARTY',charId:104,amount:5,source:'story'}]),
        abyss_syris_clear: clearEvent('ABYSS_SYRIS_CLEAR',['abyssSyrisDefeated'],[{type:'IF_FLAG',key:'abyssSecondBarrierCleared',then:[{type:'CONV',value:'ABYSS_SECOND_BARRIER_CLEAR'}]}]),
        abyss_grad_battle: bossEvent('ABYSS_GRAD',302040,'abyss_grad_clear',[{type:'LB_ADD_PARTY',charIds:[109,110],amount:5,source:'story'}]),
        abyss_grad_clear: clearEvent('ABYSS_GRAD_CLEAR',['abyssGradDefeated'],[{type:'IF_FLAG',key:'abyssSecondBarrierCleared',then:[{type:'CONV',value:'ABYSS_SECOND_BARRIER_CLEAR'}]}]),
        abyss_veld_battle: bossEvent('ABYSS_VELD',302050,'abyss_veld_clear',[{type:'LB_ADD_PARTY',charId:204,amount:5,source:'story'}]),
        abyss_veld_clear: clearEvent('ABYSS_VELD_CLEAR',['abyssVeldDefeated']),
        abyss_jasper_battle: bossEvent('ABYSS_JASPER',302060,'abyss_jasper_clear'),
        abyss_jasper_clear: clearEvent('ABYSS_JASPER_CLEAR',['abyssJasperDefeated'],[{type:'ITEM',id:701007,count:1}]),
        abyss_illuminacia_battle: bossEvent('ABYSS_ILLUMINACIA',302070,'abyss_illuminacia_clear'),
        abyss_illuminacia_clear: clearEvent('ABYSS_ILLUMINACIA_CLEAR',['abyssIlluminaciaDefeated']),
        abyss_final_altar_encounter: {
            actions:[
                {
                    type:'IF_FLAG', key:'abyssVegnasisDefeated',
                    then:[
                        {type:'CONV',value:'ABYSS_AZELGARAG'},
                        {type:'BOSS',value:302100,winEventId:'abyss_azelgarag_clear',battleBg:'battle_bg_lastboss'}
                    ],
                    else:[
                        {type:'CONV',value:'ABYSS_VEGNASIS'},
                        {type:'BOSS',value:[302080,302081,302082,302083,302084],winEventId:'abyss_vegnasis_clear',battleBg:'battle_bg_lastboss',deferFixedBossDefeat:true}
                    ]
                }
            ],
            winActions:[]
        },
        abyss_vegnasis_battle: {
            actions:[
                {type:'CONV',value:'ABYSS_VEGNASIS'},
                {type:'BOSS',value:[302080,302081,302082,302083,302084],winEventId:'abyss_vegnasis_clear',battleBg:'battle_bg_lastboss',deferFixedBossDefeat:true}
            ],
            winActions:[]
        },
        abyss_vegnasis_clear: clearEvent('ABYSS_VEGNASIS_CLEAR',['abyssVegnasisDefeated'],[
            {type:'CONV',value:'ABYSS_AZELGARAG'},
            {type:'BOSS',value:302100,winEventId:'abyss_azelgarag_clear',battleBg:'battle_bg_lastboss'}
        ]),
        abyss_azelgarag_battle: bossEvent('ABYSS_AZELGARAG',302100,'abyss_azelgarag_clear'),
        abyss_azelgarag_clear: clearEvent('ABYSS_AZELGARAG_CLEAR',['abyssAzelgaragDefeated','abyssEpilogueSeen'],[
            {type:'IF_ITEM',id:109,count:1,then:[],else:[{type:'ITEM',id:109,count:1}]},
            {type:'UNLOCK',value:'wing'},
            {type:'CREDITS',title:'深淵世界編　完',lines:['企画・シナリオ　Yuzora-Yu','制作　RPG-TEST','最果ての地カルメナ','深淵都市ビスタ','混沌魔城レガシオン','そして、まだ見ぬ深淵へ']},
            {type:'STEP',value:10},{type:'SUB',value:2},{type:'LOG',value:'深淵王を倒し、リュシオンから光の翼を授かった。終焉の祭壇には、なお深い亀裂が残っている。'}
        ]),
        abyss_postgame_crack: clearEvent('ABYSS_POSTGAME_CRACK',['abyssRandomUnlocked','abyssDungeonMenuUnlocked'],[{type:'UNLOCK',value:['dungeonMenu','teleport']},{type:'START_ABYSS_DUNGEON',mode:'random',floor:1,direct:true}]),
        abyss_carmena_resident_spring: {actions:[{type:'CONV',value:'ABYSS_CARMENA_RESIDENT_SPRING'}],winActions:[]},
        abyss_carmena_resident_rations: {actions:[{type:'CONV',value:'ABYSS_CARMENA_RESIDENT_RATIONS'}],winActions:[]},
        abyss_carmena_resident_old_kingdom: {actions:[{type:'CONV',value:'ABYSS_CARMENA_RESIDENT_OLD_KINGDOM'}],winActions:[]},
        abyss_carmena_resident_gate_child: {actions:[{type:'CONV',value:'ABYSS_CARMENA_RESIDENT_GATE_CHILD'}],winActions:[]},
        abyss_vista_recruitment_guide: {actions:[{type:'CONV',value:'ABYSS_VISTA_RECRUITMENT'}],winActions:[]},
        abyss_vista_scavenger: {actions:[{type:'CONV',value:'ABYSS_VISTA_SCAVENGER'}],winActions:[]},
        abyss_vista_widow: {actions:[{type:'CONV',value:'ABYSS_VISTA_WIDOW'}],winActions:[]},
        abyss_vista_toll_keeper: {actions:[{type:'CONV',value:'ABYSS_VISTA_TOLL_KEEPER'}],winActions:[]},
        abyss_vista_lamplighter: {actions:[{type:'CONV',value:'ABYSS_VISTA_LAMPLIGHTER'}],winActions:[]},
        abyss_vista_underpass_worker: {actions:[{type:'CONV',value:'ABYSS_VISTA_UNDERPASS_WORKER'}],winActions:[]},
        abyss_vista_underpass_children: {actions:[{type:'CONV',value:'ABYSS_VISTA_UNDERPASS_CHILDREN'}],winActions:[]},
        abyss_legacion_arena_notice: {actions:[{type:'CONV',value:'ABYSS_LEGACION_ARENA'}],winActions:[]},
        abyss_legacion_smith_apprentice: {actions:[{type:'CONV',value:'ABYSS_LEGACION_SMITH_APPRENTICE'}],winActions:[]},
        abyss_legacion_guild_clerk: {actions:[{type:'CONV',value:'ABYSS_LEGACION_GUILD_CLERK'}],winActions:[]},
        abyss_legacion_castle_servant: {actions:[{type:'CONV',value:'ABYSS_LEGACION_CASTLE_SERVANT'}],winActions:[]},
        abyss_legacion_wall_vendor: {actions:[{type:'CONV',value:'ABYSS_LEGACION_WALL_VENDOR'}],winActions:[]},
        abyss_legacion_audience: {actions:[{type:'CONV',value:'ABYSS_LEGACION_AUDIENCE'},{type:'FLAG',key:'abyssLegacionNorthGateOpen'}],winActions:[]},
        abyss_legacion_priest: {actions:[{type:'CONV',value:'ABYSS_LEGACION_PRIEST'},{type:'FLAG',key:'abyssSpiritPrismKnown'}],winActions:[]},
        abyss_legacion_prison: {actions:[{type:'CONV',value:'ABYSS_LEGACION_PRISON'}],winActions:[]},
        abyss_legacion_prison_mother: {actions:[{type:'CONV',value:'ABYSS_LEGACION_PRISON_MOTHER'}],winActions:[]},
        abyss_legacion_prison_guard: {actions:[{type:'CONV',value:'ABYSS_LEGACION_PRISON_GUARD'}],winActions:[]},
        abyss_legacion_temple_acolyte: {actions:[{type:'CONV',value:'ABYSS_LEGACION_TEMPLE_ACOLYTE'}],winActions:[]},
        abyss_legacion_gallery_page: {actions:[{type:'CONV',value:'ABYSS_LEGACION_GALLERY_PAGE'}],winActions:[]},
        abyss_legacion_archivist: {actions:[{type:'CONV',value:'ABYSS_LEGACION_ARCHIVIST'}],winActions:[]},
        abyss_legacion_west_sentry: {actions:[{type:'CONV',value:'ABYSS_LEGACION_WEST_SENTRY'}],winActions:[]},
        abyss_legacion_east_observer: {actions:[{type:'CONV',value:'ABYSS_LEGACION_EAST_OBSERVER'}],winActions:[]}
    });

})();
