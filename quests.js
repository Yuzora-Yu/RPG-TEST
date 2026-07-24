/* quests.js - story and ally quest registry */
(function() {
    const conversation = "conversation";
    const boss = "boss";
    const hunt = "hunt";
    const travel = "travel";
    const collection = "collection";

    const QUEST_DATA = {
        karin_volcano_depths: {
            name: "火山奥の鍛炎",
            area: "イグナ火山 深部",
            kind: boss,
            unlockFlags: ["windVillageCleared"],
            objective: "風の加護で開いた火山深部を調査し、カリンの試練を越える。",
            startText: "カリンは、風の加護で火山ガスが晴れた今こそ奥へ進めると話した。",
            startEventId: "quest_karin_start",
            progressText: "火山深部の強化された魔物を越え、最奥へ進もう。",
            completeText: "カリンは鍛えた炎を旅路に捧げ、仲間に加わった。",
            rewardAllies: [210]
        },
        arisa_haine_forest_depths: {
            name: "禁忌の森の双影",
            area: "風の集落 / 禁忌の森 深部",
            kind: boss,
            unlockFlags: ["waterCityCleared"],
            objective: "風の集落で、禁忌の森の奥へ消えたアリサとハイネの救援依頼を受ける。",
            startText: "風の集落の村人から、アリサとハイネの救援を頼まれた。",
            progressText: "禁忌の森深部へ向かい、アリサとハイネを救出しよう。",
            completeText: "アリサとハイネを救出し、二人が仲間に加わった。",
            startEventId: "quest_arisa_haine_start",
            rewardAllies: [108, 207]
        },
        sophia_alan_seabed_depths: {
            name: "水流の奥の誓い",
            area: "海底神殿 深部",
            kind: boss,
            unlockFlags: ["thunderFortCleared"],
            objective: "雷の加護で流れが弱まった海底神殿深部を攻略する。",
            startText: "ソフィアとアランは、神殿奥の水流が弱まった今なら真相へ届くと判断した。",
            progressText: "海底神殿深部の水流の先へ進もう。",
            completeText: "神殿の奥に残った脅威を退け、ソフィアとアランが仲間に加わった。",
            rewardAllies: [202, 201]
        },
        frieda_baron_thunder_depths: {
            name: "雷光の封鎖線",
            area: "雷の要塞 深部",
            kind: boss,
            unlockFlags: ["lightPalaceCleared"],
            objective: "光の加護で高圧電流が弱まった雷の要塞深部を攻略する。",
            startText: "フリーダとバロンは、要塞の奥に残る雷の制御核を止める決意を示した。",
            progressText: "雷の要塞深部へ進み、制御核を守る魔物を倒そう。",
            completeText: "雷の制御核は沈黙し、フリーダとバロンが仲間に加わった。",
            rewardAllies: [302, 205]
        },
        licia_crena_depths: {
            name: "結界の奥のリーシア",
            area: "クレナ鍾乳洞 深部",
            kind: boss,
            unlockFlags: ["darkCastleCleared"],
            objective: "闇の加護で見えるようになった結界の奥へ進み、リーシアを救う。",
            startText: "結界の前に立つリーシアは、奥に潜む魔力を断つため同行を求めている。",
            startEventId: "quest_licia_start",
            progressText: "クレナ鍾乳洞深部で結界の核を探そう。",
            completeText: "結界の核は砕け、リーシアが仲間に加わった。",
            rewardAllies: [303]
        },
        royal_star_catalyst: {
            name: "王の星詠みと触媒器",
            area: "光の宮殿 地下牢",
            kind: collection,
            unlockFlags: ["lightPalaceCleared"],
            objective: "国王が示した四種の素材を集め、光の宮殿の地下牢へ届ける。",
            startText: "国王は、失われた加工術式を再び動かすための素材を探している。素材をそろえて地下牢の国王へ届けよう。",
            startEventId: "light_palace_catalyst_quest_start",
            progressText: "業火の壺3つ、星銀鋼1つ、虹の結晶1つ、星の涙1つを集め、国王へ届けよう。",
            reportEventId: "light_palace_catalyst_quest_report",
            completeText: "素材を国王へ渡し、貴重品『星詠みの触媒器』を受け取った。メニューの『加工』が利用可能になった。",
            itemRequirements: [
                { id: 1001, count: 3 },
                { id: 2005, count: 1 },
                { id: 2021, count: 1 },
                { id: 2053, count: 1 }
            ],
            consumeItemsOnComplete: true,
            rewardItems: [{ id: 111, count: 1 }]
        },
        fire_water_attunement: {
            name: "火脈と水脈の調律",
            area: "水上都市",
            kind: conversation,
            unlockFlags: ["forestHolyWaterObtained", "blueCrystalObtained"],
            objective: "妖精の聖水と青の結晶の記録を合わせ、次の異変に備える。",
            startText: "水上都市の技師は、火山と神殿の異常が同じ脈動に連なる可能性を語った。",
            progressText: "水上都市の技師と、火脈と水脈の記録を照合しよう。",
            completeText: "火と水の流れを読む調律の羅針片を受け取った。",
            rewardFlags: ["attunementCompassObtained"],
            rewardItems: [{ id: 306, count: 1 }],
            initialComplete: true
        },
        marie_water_city: {
            name: "祈り手マリーの討伐依頼",
            area: "水上都市",
            kind: hunt,
            unlockFlags: ["waterCityCleared"],
            objective: "水上都市近海に現れるアクアウィスプとウィスプナイトを合計5体討伐する。",
            startText: "マリーは、水上都市近海で避難船を脅かすアクアウィスプとウィスプナイトの討伐を依頼した。",
            progressText: "水上都市近海でアクアウィスプとウィスプナイトを討伐し、マリーへ報告しよう。",
            startEventId: "quest_marie_start",
            reportEventId: "quest_marie_report",
            targetMonsterIds: [100033, 100036],
            targetCount: 5,
            completeText: "マリーは祈りだけでなく、杖を手にして旅に同行することを決めた。",
            rewardAllies: [102]
        },
        zelied_big_tower: {
            name: "大灯台のゼリード",
            area: "大灯台",
            kind: boss,
            unlockFlags: ["bigTowerCleared"],
            objective: "大灯台1階でゼリードと話し、再び頂上のボスを倒す。",
            startText: "ゼリードは、大灯台の頂に残る歪みを確かめたいと申し出た。",
            progressText: "大灯台の頂上へ向かい、再出現した強敵を倒そう。",
            reportText: "頂を覆っていた歪みは消えた。大灯台1階のゼリードへ知らせよう。",
            startEventId: "quest_zelied_start",
            reportEventId: "quest_zelied_report",
            completeText: "頂の歪みは消え、ゼリードが仲間に加わった。",
            rewardAllies: [103]
        },
        hayate_water_city: {
            name: "ハヤテの早駆け討伐",
            area: "水上都市",
            kind: hunt,
            requiredAllies: [201],
            objective: "アラン加入後、水上都市近海のアクアウィスプとバンパイアを合計6体討伐する。",
            startText: "ハヤテは、アランの名を聞くと水上都市近海のアクアウィスプとバンパイア討伐を持ちかけた。",
            progressText: "水上都市近海でアクアウィスプとバンパイアを討伐し、ハヤテへ報告しよう。",
            startEventId: "quest_hayate_start",
            reportEventId: "quest_hayate_report",
            targetMonsterIds: [100033, 100037],
            targetCount: 6,
            completeText: "ハヤテは速度だけでなく覚悟も認め、仲間に加わった。",
            rewardAllies: [203]
        },
        sylvia_water_city: {
            name: "シルビアの護衛依頼",
            area: "水上都市",
            kind: hunt,
            requiredAllies: [101],
            objective: "ジョセフ加入後、水上都市外縁のウィスプナイトとバンパイアを合計5体討伐する。",
            startText: "シルビアは、水上都市外縁で荷を止めているウィスプナイトとバンパイアの討伐を依頼した。",
            progressText: "水上都市外縁でウィスプナイトとバンパイアを討伐し、シルビアへ報告しよう。",
            startEventId: "quest_sylvia_start",
            reportEventId: "quest_sylvia_report",
            targetMonsterIds: [100036, 100037],
            targetCount: 5,
            completeText: "シルビアは旅の危うさを承知で、支援役として仲間に加わった。",
            rewardAllies: [209]
        },
        rin_thunder_fort: {
            name: "リンの雷鳴討伐",
            area: "雷の要塞",
            kind: hunt,
            requiredAllies: [204],
            objective: "レイラ加入後、雷の要塞に残るアイアンウルフとフレイムヴァインを合計6体討伐する。",
            startText: "リンは、雷の要塞に残るアイアンウルフとフレイムヴァインの討伐を願い出た。",
            progressText: "雷の要塞でアイアンウルフとフレイムヴァインを討伐し、リンへ報告しよう。",
            startEventId: "quest_rin_start",
            reportEventId: "quest_rin_report",
            targetMonsterIds: [100040, 100043],
            targetCount: 6,
            completeText: "リンは雷鳴に臆さぬ一行を認め、仲間に加わった。",
            rewardAllies: [208]
        },
        claude_leon_dark_shrine: {
            name: "闇の神殿跡地の双剣",
            area: "闇の神殿跡地",
            kind: boss,
            unlockFlags: ["lightPalaceCleared"],
            objective: "闇の神殿跡地でクロードとレオンの加入クエストを進める。",
            startText: "クロードとレオンは、光の宮殿の影に残った闇を断つため神殿跡地へ向かった。",
            progressText: "闇の神殿跡地の最奥へ進もう。",
            completeText: "闇の残滓は退けられ、クロードとレオンが仲間に加わった。",
            rewardAllies: [304, 305]
        },
        luna_hidden_dark_shrine: {
            name: "月影のルーナ",
            area: "闇の神殿跡地",
            kind: boss,
            unlockFlags: ["lightPalaceCleared"],
            requiredQuests: ["claude_leon_dark_shrine"],
            objective: "闇の神殿跡地の隠し超強ボスを討伐する。",
            startText: "ルーナは、月光すら飲み込む影を討てる者だけを待っている。",
            progressText: "闇の神殿跡地の隠し祭壇で超強ボスに挑もう。",
            completeText: "月影を縛る闇は砕け、ルーナが仲間に加わった。",
            rewardAllies: [401]
        },
        ryu_minerva_grezelia: {
            name: "禁則地の竜と智",
            area: "禁則地グレゼリア",
            kind: boss,
            unlockFlags: ["darkCastleCleared"],
            objective: "禁則地グレゼリアでリュウとミネルバの加入クエストを進める。",
            startText: "リュウとミネルバは、魔王城の奥に残った禁則の術式を追っている。",
            progressText: "禁則地グレゼリアの深部へ進もう。",
            completeText: "禁則の術式は破られ、リュウとミネルバが仲間に加わった。",
            rewardFlags: ["grezeliaOuterSealBroken"],
            rewardAllies: [107, 206]
        },
        zenon_hidden_grezelia: {
            name: "ゼノンの禁則試練",
            area: "禁則地グレゼリア",
            kind: boss,
            unlockFlags: ["darkCastleCleared"],
            requiredQuests: ["ryu_minerva_grezelia"],
            objective: "禁則地グレゼリアの隠し超強ボスを討伐する。",
            startText: "ゼノンは、禁則の底に残る最悪の魔力を封じられる者を探している。",
            progressText: "禁則地グレゼリアの最深部で超強ボスに挑もう。",
            completeText: "禁則の残響は沈黙し、ゼノンが仲間に加わった。",
            rewardAllies: [402]
        }
    };

    if (typeof window !== "undefined") window.QUEST_DATA = QUEST_DATA;
})();
