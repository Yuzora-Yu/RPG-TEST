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
            ...cloneScript('ABYSS_FLOOR_020_GLEN_GUARDIAN'),
            ...cloneScript('ABYSS_FLOOR_010_LEON_GUARDIAN'),
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
        ABYSS_SYRIS: cloneScript('ABYSS_FLOOR_050_SYRIS', { '氷楔のシーリス':'極零のシーリス' }),
        ABYSS_SYRIS_CLEAR: cloneScript('ABYSS_FLOOR_050_CLEAR', { '氷楔のシーリス':'極零のシーリス' }),
        ABYSS_GRAD: cloneScript('ABYSS_FLOOR_060_GRAD', { '炎楔のグラド':'焦熱のグラド' }),
        ABYSS_GRAD_CLEAR: cloneScript('ABYSS_FLOOR_060_CLEAR', { '炎楔のグラド':'焦熱のグラド' }),
        ABYSS_VELD: cloneScript('ABYSS_FLOOR_070_VELD', { '混沌の騎士ヴェルド':'昏迷の黒騎士ヴェルド' }),
        ABYSS_VELD_CLEAR: cloneScript('ABYSS_FLOOR_070_VELD_CLEAR', { '混沌の騎士ヴェルド':'昏迷の黒騎士ヴェルド' }),
        ABYSS_JASPER: cloneScript('ABYSS_FLOOR_090_JASPER'),
        ABYSS_JASPER_CLEAR: [
            ...cloneScript('ABYSS_FLOOR_090_JASPER_CLEAR'),
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
            { name:'システム', text:'一行は光の道を通り、地上へ帰還した。\n終焉の祭壇には、消え切らない小さな亀裂だけが残った。' }
        ],
        ABYSS_POSTGAME_CRACK: [
            { name:'システム', text:'終焉の祭壇を再び訪れると、最奥の亀裂が以前より深く口を開けていた。' },
            { name:'シャニー', text:'物語を縛っていた深淵とは違う。\nここから先は、入るたびに形を変える底なしの迷宮。', charId:306 },
            { name:'魔王ゼノン', text:'王を失ってなお力だけが残ったか。\nよかろう。腕試しの穴として、何度でも踏破してやる。', charId:402 },
            { name:'システム', text:'クリア後深淵とダンジョンメニューが解放された。' }
        ],
        ABYSS_CARMENA_RESIDENT: [
            { name:'カルメナの住人', text:'黒い泉は見た目ほど禍々しくない。\n深淵の瘴気を沈め、傷ついた者の力を戻してくれる。' },
            { name:'カルメナの住人', text:'ただ、北門の二将が町の淀みを強めている。\nあれを退けない限り、外へ出ても体がもたないだろう。' }
        ],
        ABYSS_VISTA_RECRUITMENT: [
            { name:'ビスタの魔物使い', text:'深淵の魔物でも、まれに地上から差す光へ触れて、憎しみを手放すことがある。' },
            { name:'ビスタの魔物使い', text:'そうなった魔物は、倒した者の強さではなく心を見て、旅へ加わることがある。\n期待しすぎるほど多くはないが、決して零ではない。' }
        ],
        ABYSS_LEGACION_ARENA: [{name:'格闘場の係員',text:'ここはモンスター格闘場だ。\nいまは闘技場の整備中だが、門と観客席はいつでも使えるよう保っている。'}],
        ABYSS_LEGACION_AUDIENCE: [
            { name:'深淵皇帝家の末裔', text:'二層の結界を越えた者よ。\n我らの都へ、失われた道を繋いでくれたことに礼を言う。' },
            { name:'深淵皇帝家の末裔', text:'北門の先に、夢幻回廊リドパルムがある。\n深淵王へ至る者だけが通れるよう、いま門を開こう。' },
            { name:'システム', text:'レガシオンの北門が開いた。' }
        ],
        ABYSS_LEGACION_PRIEST: [
            { name:'レガシオンの神官', text:'あなたたちには、強い属性の加護が幾重にも重なっているようですね。' },
            { name:'レガシオンの神官', text:'もしや、古いプリズムに宿る声も聞こえるのではありませんか。\n城内の六色のプリズムへ触れれば、大精霊が応えるかもしれません。' }
        ],
        ABYSS_LEGACION_PRISON: [{name:'システム',text:'地下牢には壊れた鎖と空の檻だけが残っている。\n奥の壁から、地下神殿へ続く重い魔力が伝わってくる。'}]
    });

    const bossEvent = (conversation, boss, clearEvent, extraActions = []) => ({
        actions:[{type:'CONV',value:conversation}, ...extraActions, {type:'BOSS',value:boss,winEventId:clearEvent}], winActions:[]
    });
    const clearEvent = (conversation, flags = [], extraActions = []) => ({
        actions:[{type:'CONV',value:conversation}, ...flags.map(key=>({type:'FLAG',key})), ...extraActions], winActions:[]
    });

    Object.assign(data.events, {
        abyss_carmena_gate_battle: bossEvent('ABYSS_CARMENA_GATE',[511010,511020],'abyss_carmena_gate_clear'),
        abyss_carmena_gate_clear: clearEvent('ABYSS_CARMENA_GATE_CLEAR',['abyssCarmenaGateCleared']),
        abyss_leonard_battle: bossEvent('ABYSS_LEONARD',511030,'abyss_leonard_clear',[{type:'LB_ADD_PARTY',charId:101,amount:5,source:'story'}]),
        abyss_leonard_clear: clearEvent('ABYSS_LEONARD_CLEAR',['abyssLeonardDefeated']),
        abyss_elicia_battle: bossEvent('ABYSS_ELICIA',511040,'abyss_elicia_clear',[{type:'LB_ADD_PARTY',charId:106,amount:5,source:'story'}]),
        abyss_elicia_clear: clearEvent('ABYSS_ELICIA_CLEAR',['abyssEliciaDefeated']),
        abyss_syris_battle: bossEvent('ABYSS_SYRIS',511050,'abyss_syris_clear',[{type:'LB_ADD_PARTY',charId:104,amount:5,source:'story'}]),
        abyss_syris_clear: clearEvent('ABYSS_SYRIS_CLEAR',['abyssSyrisDefeated']),
        abyss_grad_battle: bossEvent('ABYSS_GRAD',511060,'abyss_grad_clear',[{type:'LB_ADD_PARTY',charIds:[109,110],amount:5,source:'story'}]),
        abyss_grad_clear: clearEvent('ABYSS_GRAD_CLEAR',['abyssGradDefeated']),
        abyss_veld_battle: bossEvent('ABYSS_VELD',511070,'abyss_veld_clear',[{type:'LB_ADD_PARTY',charId:204,amount:5,source:'story'}]),
        abyss_veld_clear: clearEvent('ABYSS_VELD_CLEAR',['abyssVeldDefeated']),
        abyss_jasper_battle: bossEvent('ABYSS_JASPER',511080,'abyss_jasper_clear'),
        abyss_jasper_clear: clearEvent('ABYSS_JASPER_CLEAR',['abyssJasperDefeated']),
        abyss_illuminacia_battle: bossEvent('ABYSS_ILLUMINACIA',511090,'abyss_illuminacia_clear'),
        abyss_illuminacia_clear: clearEvent('ABYSS_ILLUMINACIA_CLEAR',['abyssIlluminaciaDefeated']),
        abyss_vegnasis_battle: bossEvent('ABYSS_VEGNASIS',[512001,512002,512003,512004,512005],'abyss_vegnasis_clear'),
        abyss_vegnasis_clear: clearEvent('ABYSS_VEGNASIS_CLEAR',['abyssVegnasisDefeated'],[
            {type:'BOSS',value:512100,winEventId:'abyss_azelgarag_clear',battleBg:'battle_bg_lastboss'}
        ]),
        abyss_azelgarag_battle: bossEvent('ABYSS_AZELGARAG',512100,'abyss_azelgarag_clear'),
        abyss_azelgarag_clear: clearEvent('ABYSS_AZELGARAG_CLEAR',['abyssAzelgaragDefeated','abyssEpilogueSeen'],[
            {type:'CREDITS',title:'深淵世界編　完',lines:['企画・シナリオ　Yuzora-Yu','制作　RPG-TEST','最果ての地カルメナ','深淵都市ビスタ','混沌魔城レガシオン','そして、まだ見ぬ深淵へ']},
            {type:'STEP',value:10},{type:'SUB',value:2},{type:'LOG',value:'深淵王を倒した。終焉の祭壇には、なお深い亀裂が残っている。'}
        ]),
        abyss_postgame_crack: clearEvent('ABYSS_POSTGAME_CRACK',['abyssRandomUnlocked','abyssDungeonMenuUnlocked'],[{type:'START_ABYSS_DUNGEON',mode:'random',floor:1,direct:true}]),
        abyss_carmena_resident: {actions:[{type:'CONV',value:'ABYSS_CARMENA_RESIDENT'}],winActions:[]},
        abyss_vista_recruitment_guide: {actions:[{type:'CONV',value:'ABYSS_VISTA_RECRUITMENT'}],winActions:[]},
        abyss_legacion_arena_notice: {actions:[{type:'CONV',value:'ABYSS_LEGACION_ARENA'}],winActions:[]},
        abyss_legacion_audience: {actions:[{type:'CONV',value:'ABYSS_LEGACION_AUDIENCE'},{type:'FLAG',key:'abyssLegacionNorthGateOpen'}],winActions:[]},
        abyss_legacion_priest: {actions:[{type:'CONV',value:'ABYSS_LEGACION_PRIEST'},{type:'FLAG',key:'abyssSpiritPrismKnown'}],winActions:[]},
        abyss_legacion_prison: {actions:[{type:'CONV',value:'ABYSS_LEGACION_PRISON'}],winActions:[]}
    });

    const bindBossStart = (monsterId, eventId) => {
        const ids = Array.isArray(monsterId) ? monsterId.map(Number) : [Number(monsterId)];
        Object.values(globalThis.FIXED_MAPS || {}).forEach(map => (map?.bosses || []).forEach(boss => {
            const bossIds = (Array.isArray(boss.monsterId) ? boss.monsterId : [boss.monsterId]).map(Number);
            if (ids.every(id => bossIds.includes(id))) boss.startEventId = eventId;
        }));
        Object.values(globalThis.FIXED_DUNGEON_MAPS || {}).forEach(base => {
            const floors = base?.floors || [base];
            floors.forEach(floor => (floor?.bosses || []).forEach(boss => {
                const bossIds = (Array.isArray(boss.monsterId) ? boss.monsterId : [boss.monsterId]).map(Number);
                if (ids.every(id => bossIds.includes(id))) boss.startEventId = eventId;
            }));
        });
    };

    bindBossStart([511010,511020],'abyss_carmena_gate_battle');
    bindBossStart(511030,'abyss_leonard_battle');
    bindBossStart(511040,'abyss_elicia_battle');
    bindBossStart(511050,'abyss_syris_battle');
    bindBossStart(511060,'abyss_grad_battle');
    bindBossStart(511070,'abyss_veld_battle');
    bindBossStart(511080,'abyss_jasper_battle');
    bindBossStart(511090,'abyss_illuminacia_battle');
    bindBossStart([512001,512002,512003,512004,512005],'abyss_vegnasis_battle');
    bindBossStart(512100,'abyss_azelgarag_battle');

    const prism = globalThis.FIXED_MAPS?.LEGACION?.mapActions?.find(action => action.type === 'abyssSpiritPrism');
    if (prism) {
        prism.requiredFlag = 'abyssSpiritPrismKnown';
        prism.lockedText = '六色のプリズムは沈黙している。城の神官なら、何か知っているかもしれない。';
    }
    const crack = globalThis.FIXED_DUNGEON_MAPS?.FINAL_ALTAR?.mapActions?.find(action => action.type === 'abyssPostgameCrack');
    if (crack) crack.requiredFlag = 'abyssEpilogueSeen';
})();
