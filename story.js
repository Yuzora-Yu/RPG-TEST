/* story.js */
const StoryManager = {
    // ==========================================
    // 0. プロパティ・初期化
    // ==========================================
    textSpeed: 20,
    newlineWait: 400,
    backlog: [],
    active: false,
    currentScript: null,
    index: 0,
    onComplete: null,

    // ==========================================
    // 目的表示の正本
    // ==========================================
    // 今後の「現在の目的」テキストは storyStep / subStep を基準にここで管理する。
    // UI側や main.js 側に目的文の switch 文を増やさないこと。
    // 現在のメインストーリー上限に到達した場合は、
    // 下の dungeonObjectiveMilestones に従ってダンジョン目標へ自動で切り替える。
    maxMainStoryProgress: { storyStep: 10, subStep: 0 },

    storyObjectives: {
        "0-0": "夜明け前の異変を確かめよう",
        "0-1": "戦いのあと、村の様子を確認しよう",
        "0-2": "始まりの村で旅立ちの準備をしよう",
        "1-0": "始まりの村の奥で話を聞こう",
        "1-1": "洞窟の奥で魔物の気配を追おう",
        "1-2": "洞窟のボスを倒そう",
        "2-0": "始まりの村の長老へ討伐を報告しよう",
        "2-1": "炎の里の長に相談を聞こう",
        "2-2": "火山入口でシャオと合流しよう",
        "2-3": "炎の里の長に異常な炎を報告しよう",
        "2-4": "森の風穴で妖精の泉を探そう",
        "2-5": "妖精の聖水を火山入口で使おう",
        "2-6": "イグナ火山の奥で火のプリズムを救おう",
        "2-7": "炎の里の長へ火山の異変を報告しよう",
        "3-0": "北の風の集落で消えた大人たちの手がかりを探そう",
        "3-1": "集落の西から禁忌の森へ向かおう",
        "3-2": "風の神殿で風のプリズムを救おう",
        "4-0": "西の水上都市で船の手がかりを探そう",
        "4-1": "クレナ鍾乳洞で青の結晶を探そう",
        "4-2": "水上都市のソフィアへ青の結晶を届けよう",
        "4-3": "海底神殿へ向かい、水のプリズムを救おう",
        "5-0": "船で川を進み、雷の要塞へ向かおう",
        "6-0": "大灯台へ向かい、光の神殿の結界を壊そう",
        "7-0": "光の神殿へ入り、儀式の真相を追おう",
        "8-0": "魔王城へ向かい、闇のプリズムの真実を確かめよう",
        "9-0": "世界の中心に開いた深淵への亀裂を調べよう",
        "10-0": "深淵の魔窟に挑み、混沌の根源を断とう"
},

    dungeonObjectiveMilestones: [
        { floor: 11, text: "ダンジョン10階を目指そう！" },
        { floor: 51, text: "ダンジョン50階を目指そう！" },
        { floor: 101, text: "ダンジョン100階を目指そう！" },
        { floor: 151, text: "ダンジョン150階を目指そう！" },
        { floor: 201, text: "ダンジョン200階を目指そう！" }
    ],

    getProgressKey: function(progress) {
        const step = Number(progress?.storyStep || 0);
        const sub = Number(progress?.subStep || 0);
        return `${step}-${sub}`;
    },

    isMainStoryComplete: function(progress) {
        const step = Number(progress?.storyStep || 0);
        const sub = Number(progress?.subStep || 0);
        const max = this.maxMainStoryProgress;
        if (step > max.storyStep) return true;
        if (step < max.storyStep) return false;
        return sub >= max.subStep;
    },

    getDungeonObjectiveText: function(data) {
        const dungeon = data?.dungeon || {};
        const progress = data?.progress || {};
        const maxFloor = Number(dungeon.maxFloor || progress.maxFloor || 0);
        const tryCount = Number(dungeon.tryCount || 0);

        if (maxFloor <= 0 && tryCount <= 0) {
            return "メニューからダンジョンに挑戦しよう";
        }

        for (const milestone of this.dungeonObjectiveMilestones) {
            if (maxFloor < milestone.floor) return milestone.text;
        }

        const killCounts = data?.book?.killCounts || {};
        const calamityKills = Number(killCounts[902000] || 0) + Number(killCounts[2000] || 0);
        if (calamityKills <= 0) {
            return "メダルを集めて災厄に挑もう";
        }

        return "ダンジョンで最強装備をそろえよう";
    },

    getObjectiveText: function(data = null) {
        if (!data && typeof App !== 'undefined') data = App.data;
        const progress = data?.progress || {};

        if (this.isMainStoryComplete(progress)) {
            return this.getDungeonObjectiveText(data);
        }

        const key = this.getProgressKey(progress);
        if (this.storyObjectives[key]) return this.storyObjectives[key];

        // 未定義の進行度でも画面が空にならないようにする。
        // 新しい storyStep/subStep を追加したら、まず storyObjectives に目的文を足す。
        return "冒険を進めよう！";
    },
	

    /**
     * ストーリー演出用の一時強化APIを、story.js側で安全に補完する。
     *
     * もともと TEMP_LB_START / TEMP_LB_CLEAR は App.activateTemporaryStoryPower /
     * App.clearTemporaryStoryPower の存在を前提にしていたが、実装が無い環境では
     * 命令が無視され、開幕全滅後のLB99救済が発動しなかった。
     *
     * この補完は「現在の戦闘パーティだけ」を一時的にLB99扱いにし、
     * 戦闘終了または明示解除時に元のLBへ戻す。lbProgress は触らないため、
     * 通常の限界突破進行には影響しない。
     */
    installTemporaryStoryPowerApi: function() {
        if (typeof App === 'undefined' || !App) return false;

        const getPartyTargets = () => {
            if (!App.data || !Array.isArray(App.data.characters)) return [];
            const partyUids = Array.isArray(App.data.party)
                ? App.data.party.filter(uid => !!uid)
                : [];

            let targets = App.data.characters.filter(c => c && partyUids.includes(c.uid));

            // パーティ情報が壊れていても、開幕救済だけは主人公へ届くようにする。
            if (targets.length === 0) {
                const hero = App.data.characters.find(c => c && (c.charId === 301 || c.uid === 'p1' || c.isHero));
                if (hero) targets = [hero];
            }

            return targets;
        };

        const clampLb = (value) => {
            return Math.max(0, Math.min(99, Math.floor(Number(value) || 0)));
        };

        const recalcAndClampVitals = (char) => {
            if (!char || typeof App.calcStats !== 'function') return;
            const stats = App.calcStats(char);
            if (Number.isFinite(Number(stats?.maxHp)) && char.currentHp !== undefined) {
                char.currentHp = Math.max(0, Math.min(Number(char.currentHp) || 0, stats.maxHp));
            }
            if (Number.isFinite(Number(stats?.maxMp)) && char.currentMp !== undefined) {
                char.currentMp = Math.max(0, Math.min(Number(char.currentMp) || 0, stats.maxMp));
            }
        };

        const findCharByUid = (uid) => {
            if (!App.data || !Array.isArray(App.data.characters)) return null;
            return App.getChar
                ? App.getChar(uid)
                : App.data.characters.find(c => c && c.uid === uid);
        };

        // 重要：一時LB99のまま App.syncDerivedLimitBreaks() が走ると、
        // backfillLimitBreakLegacy が「正規のLB99」と誤認して恒久化してしまう。
        // そのため、同期時だけ元LBへ戻し、同期後に再び一時LBを適用する。
        if (typeof App.syncDerivedLimitBreaks === 'function' && !App.__storyTempPowerSyncWrapped) {
            const originalSyncDerivedLimitBreaks = App.syncDerivedLimitBreaks.bind(App);
            App.syncDerivedLimitBreaks = function(options = {}) {
                const temp = App.data?.progress?.tempStoryPower;
                if (!temp || !Array.isArray(temp.targets)) {
                    return originalSyncDerivedLimitBreaks(options);
                }

                temp.targets.forEach(snapshot => {
                    const char = findCharByUid(snapshot.uid);
                    if (char) char.limitBreak = clampLb(snapshot.limitBreak);
                });

                const result = originalSyncDerivedLimitBreaks(options);

                // 同期によって得た正規LBを、解除時の復元先として更新する。
                temp.targets.forEach(snapshot => {
                    const char = findCharByUid(snapshot.uid);
                    if (char) snapshot.limitBreak = clampLb(char.limitBreak);
                });

                const targetLb = clampLb(temp.limitBreak ?? 99);
                temp.targets.forEach(snapshot => {
                    const char = findCharByUid(snapshot.uid);
                    if (!char) return;
                    char.limitBreak = targetLb;
                    if (typeof App.calcStats === 'function') App.calcStats(char);
                });

                return result;
            };
            App.__storyTempPowerSyncWrapped = true;
        }

        if (typeof App.applyTemporaryStoryPower !== 'function') {
            App.applyTemporaryStoryPower = function() {
                const temp = App.data?.progress?.tempStoryPower;
                if (!temp || !Array.isArray(temp.targets)) return false;

                const targetLb = clampLb(temp.limitBreak ?? 99);
                temp.targets.forEach(snapshot => {
                    const char = App.getChar
                        ? App.getChar(snapshot.uid)
                        : App.data.characters.find(c => c && c.uid === snapshot.uid);
                    if (!char) return;
                    char.limitBreak = targetLb;
                    if (typeof App.calcStats === 'function') App.calcStats(char);
                });
                return true;
            };
        }

        if (typeof App.activateTemporaryStoryPower !== 'function') {
            App.activateTemporaryStoryPower = function(options = {}) {
                if (!App.data) return false;
                if (!App.data.progress) App.data.progress = {};

                const id = options.id || 'story_temp_power';
                const targetLb = clampLb(options.limitBreak ?? options.value ?? 99);

                // 別IDの一時強化が残っている場合は、先に元へ戻してから開始する。
                const current = App.data.progress.tempStoryPower;
                if (current && current.id && current.id !== id && typeof App.clearTemporaryStoryPower === 'function') {
                    App.clearTemporaryStoryPower({ id: current.id, force: true, skipSave: true });
                }

                const existing = App.data.progress.tempStoryPower;
                if (existing && existing.id === id && Array.isArray(existing.targets)) {
                    existing.limitBreak = targetLb;
                    existing.reason = options.reason || existing.reason || 'story_event';
                    App.applyTemporaryStoryPower();
                    if (typeof App.save === 'function') App.save();
                    return true;
                }

                const targets = getPartyTargets();
                if (targets.length === 0) return false;

                App.data.progress.tempStoryPower = {
                    id,
                    limitBreak: targetLb,
                    reason: options.reason || 'story_event',
                    startedAt: Date.now(),
                    targets: targets.map(c => ({
                        uid: c.uid,
                        limitBreak: clampLb(c.limitBreak)
                    }))
                };

                App.applyTemporaryStoryPower();
                if (typeof App.save === 'function') App.save();
                if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
                return true;
            };
        }

        if (typeof App.clearTemporaryStoryPower !== 'function') {
            App.clearTemporaryStoryPower = function(options = {}) {
                const temp = App.data?.progress?.tempStoryPower;
                if (!temp) return false;

                const requestedId = options.id || null;
                if (requestedId && temp.id !== requestedId && !options.force) return false;

                if (Array.isArray(temp.targets)) {
                    temp.targets.forEach(snapshot => {
                        const char = App.getChar
                            ? App.getChar(snapshot.uid)
                            : App.data.characters.find(c => c && c.uid === snapshot.uid);
                        if (!char) return;
                        char.limitBreak = clampLb(snapshot.limitBreak);
                        recalcAndClampVitals(char);
                    });
                }

                delete App.data.progress.tempStoryPower;

                // 戦闘勝利などで恒久的なLB進行が増えていた場合は、解除後に正規値へ再同期する。
                if (typeof App.syncDerivedLimitBreaks === 'function') {
                    App.syncDerivedLimitBreaks();
                    if (Array.isArray(temp.targets)) {
                        temp.targets.forEach(snapshot => {
                            const char = App.getChar
                                ? App.getChar(snapshot.uid)
                                : App.data.characters.find(c => c && c.uid === snapshot.uid);
                            recalcAndClampVitals(char);
                        });
                    }
                }

                if (!options.skipSave && typeof App.save === 'function') App.save();
                if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
                return true;
            };
        }

        return true;
    },

    /**
     * 主人公のリミットブレイクを同期
     */
    syncHeroLimitBreak: function() {
		if (!App.data || !App.data.characters) return;
		this.installTemporaryStoryPowerApi();
		const hero = App.data.characters.find(c => c.charId === 301 || c.uid === 'p1');
		if (hero && App.data.progress && App.data.dungeon) {
			if (typeof App.syncDerivedLimitBreaks === 'function') {
				App.syncDerivedLimitBreaks({ heroOnly: true });
			}
			// 一時強化中のロード復帰・STEP同期でLB99が消えないように再適用する。
			if (App.data.progress.tempStoryPower && typeof App.applyTemporaryStoryPower === 'function') {
				App.applyTemporaryStoryPower();
			}
			if (typeof App.calcStats === 'function') App.calcStats(hero);
		}
	},
	
	/**
     * 中断されたイベントまたは会話があれば再開する
     */
    resumeActiveConversation: function() {
        const data = App.data ? App.data.progress : null;
        if (!data || (!data.activeEvent && !data.activeConversation)) return false;

        // 実行責任を引き受けたことを即座に返し、main.js側の重複動作を止める
        (async () => {
            const { eventId, actionIndex, phase } = data.activeEvent || {};
            // セリフの途中ならそのインデックスを取得
            const lineIndex = data.activeConversation ? data.activeConversation.index : 0;

            if (phase === 'win') {
                await this.onBattleWin(eventId, actionIndex, lineIndex);
            } else if (eventId) {
                await this.executeEvent(eventId, false, actionIndex, lineIndex);
            } else if (data.activeConversation) {
                await this.showConversation(data.activeConversation.key, lineIndex);
                this.endConversation();
            }
        })();
        return true;
    },

    /**
     * 勝利後イベントのレジューム（インデックス指定対応版）
     */
    resumePendingBattleWinEvent: function() {
        const data = App.data ? App.data.progress : null;
        if (!data || !data.pendingBattleWinEventId) return false;

        const eventId = data.pendingBattleWinEventId;
        delete data.pendingBattleWinEventId; // 二重起動防止のため即座に削除
        this.active = false;
        this.isTyping = false;
        App.save();

        (async () => {
            await this.onBattleWin(eventId, 0, 0);
        })();
        return true;
    },

    /**
     * 通常予約イベントのレジューム
     */
    resumePendingEvent: function() {
        const data = App.data ? App.data.progress : null;
        if (!data || !data.pendingEventId) return false;

        const eventId = data.pendingEventId;
        delete data.pendingEventId;
        this.active = false;
        this.isTyping = false;
        App.save();

        (async () => {
            await this.executeEvent(eventId, false, 0, 0);
        })();
        return true;
    },
	
	// ==========================================
    // 1. 会話スクリプト (scripts)
    // ==========================================
	scripts: {
        "GAME_START_1": [
                {
                        "name": "システム",
                        "text": "……夜明け前。\n村には、不吉な気配が満ちていた。"
                },
                {
                        "name": "システム",
                        "text": "（嫌な予感がする……）"
                },
                {
                        "charId": 1003,
                        "name": "村人",
                        "text": "きゃあああっ！！"
                },
                {
                        "name": "システム",
                        "text": "子供が魔物に襲われている！"
                }
        ],
        "BATTLE_RETRY_TALK": [
                {
                        "charId": 9999,
                        "name": "？？？？",
                        "text": "[N:301]よ、まだ倒れてはなりません。\n私に残された最後の権能をもって、今一度、深淵を打ち倒す力を授けます…"
                },
                {
                        "name": "システム",
                        "text": "不思議なちからで体力が全回復し、秘められた力が開放された！！"
                }
        ],
        "GAME_START_2": [
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "おお……！助かった……。\n子ども達を救ってくださり、本当にありがとうございます。"
                },
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "……その腕前、ただ者ではありますまい。\nお願いがあるのです。村の奥の家まで来てくだされ。"
                },
                {
                        "name": "システム",
                        "text": "こうして、深淵との長い戦いが始まった——。"
                }
        ],
        "PROLOGUE": [
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "おお、[N:301]様。\n子ども達を救ってくださりありがとうございます。"
                },
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "実は、村の北東に突如大穴が開き、魔物が襲ってくるようになったのです…"
                },
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "村の若い衆で塞ごうとしたんですが、奥に巨大な化け物がいてどうにも手が出せず…"
                },
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "勝手なお願いとは思うのですが、どうか、化け物を討伐してくれないじゃろうか。"
                },
//                {
//                        "charId": 301,
//                        "name": "アルス",
//                        "text": "混沌から生まれし者かもしれません。\n必ずうち滅ぼします。"
//                },
                {
                        "name": "システム",
                        "text": "[N:301]は静かに頷いた"
                },
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "おお…ありがとうございます。"
                },
                {
                        "charId": 109,
                        "name": "",
                        "text": "頼む、俺たちも連れて行ってくれ！\nあんたみたいに戦いたいんだ。"
                },
                {
                        "charId": 110,
                        "name": "",
                        "text": "[N:109]がすみません…ただ、私からもお願いします。簡単な回復しかできませんが…"
                },
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "お、お前たち…\nしかし、道案内は必要かもしれん。連れて行ってもらえるじゃろうか。"
                },
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "化け物は村北東の大穴の奥に…\nよろしくお願い申し上げる。"
                },
                {
                        "name": "システム",
                        "text": "村の[N:109]と[N:110]が仲間に加わった！"
                }
        ],
        "PROLOGUE2": [
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "化け物は村北東の大穴の奥に…\nよろしくお願い申し上げる。"
                }
        ],
        "START_VILLAGE_ELDER_AFTER": [
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "旅支度は整いましたかな。\n東の街道は火山へ続いております。"
                },
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "戻る場所なら、ここにあります。\nどうか命まで急がせぬように。"
                }
        ],
        "START_CAVE1": [
                {
                        "charId": 1002,
                        "name": "",
                        "text": "この奥には化け物がいるんだ。\n今はどうにか塞いでいるが、いつまでもつか…"
                },
                {
                        "charId": 1002,
                        "name": "",
                        "text": "あんた、冒険者か？\n頼む、村の中央に住んでる長老の話を聞いてくれ。"
                }
        ],
        "START_CAVE2": [
                {
                        "charId": 1002,
                        "name": "",
                        "text": "あんた、マジであの化け物と戦いにいくのか？\nっておい、[N:109]と[N:110]までついてきたのか！？"
                },
                {
                        "charId": 109,
                        "name": "",
                        "text": "この兄ちゃんが、俺たちを助けてくれたんだ。\n俺だってこの村のために戦いたい！"
                },
                {
                        "charId": 110,
                        "name": "",
                        "text": "…化け物は、怖いですが…この人なら…\nお願いします、奥へ通してください。"
                },
                {
                        "charId": 1002,
                        "name": "",
                        "text": "…わかったよ。今この岩をどける。\n俺は一旦長老のとこへ戻るが…"
                },
                {
                        "charId": 1002,
                        "name": "",
                        "text": "…もう一度聞くが、本当に行くんだな？"
                }
        ],
        "START_CAVE3": [
                {
                        "charId": 1002,
                        "name": "",
                        "text": "…ありがとう。あんたの無事を祈るよ。\n[N:109]と[N:110]も、気を付けるんだぞ。"
                }
        ],
        "PROLOGUE3": [
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "なんと、もうあの化け物を討伐してくださったとは！\n[N:301]様、ありがとうございます。"
                },
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "…どうやら世界の各地で、同じように異変が起きているとのこと。"
                },
                {
                        "charId": 1001,
                        "name": "長老",
                        "text": "東の果て、炎の里では突如火が消えてしまい、鍛冶が出来なくなったと聞きましたぞ。"
                },
                {
                        "charId": 109,
                        "name": "",
                        "text": "[N:301]さま！助けに行こう！！\n炎の里で鍛冶ができなくなったら、もう誰も武器が持てなくなっちまう。"
                },
                {
                        "charId": 110,
                        "name": "",
                        "text": "まったくもう、[N:109]ったら…\nすみません、[N:301]様。村を救ってもらったばかりでこんなこと…"
                },
                {
                        "charId": 109,
                        "name": "",
                        "text": "だって、放っておけねえよ！\nこの村だって、あと一歩でボロボロになるとこだったんだ…"
                },
                {
                        "charId": 109,
                        "name": "",
                        "text": "世界がおかしくなってんなら、俺は助けに行きたい！！"
                },
                {
                        "charId": 110,
                        "name": "",
                        "text": "それは…そうだけど…"
                },
                {
                        "name": "システム",
                        "text": "[N:301]は静かに頷いた"
                },
//                {
//                        "charId": 301,
//                        "name": "",
//                        "text": "そうだな。\n[N:109]、[N:110]。長い旅になるが、ついてきてくれるか？"
//                },
                {
                        "charId": 109,
                        "name": "",
                        "text": "やったぜ！\n俺が道を切り開くから、頼りにしてくれよな。"
                },
                {
                        "charId": 110,
                        "name": "",
                        "text": "ありがとうございます…\nあの、これからよろしくお願いしますね！"
                },
                {
                        "name": "システム",
                        "text": "ガイルとサラが、正式に仲間に加わった！"
                },
                {
                        "name": "システム",
                        "text": "世界を蝕む異変とは？[N:301]達の冒険が、今幕を開けた。"
                }
        ],
        "START_DUNGEON_CLEAR": [
                {
                        "charId": 109,
                        "name": "",
                        "text": "やったぜ！さっすが勇者様だな！！"
                },
                {
                        "charId": 110,
                        "name": "",
                        "text": "よかった…これで、この村も救われます。ありがとう、勇者様。"
                },
                {
                        "charId": 109,
                        "name": "",
                        "text": "さっそく長老さまに報告だ！いそごうぜ！！"
                }
        ],
        "FIRE_VILLAGE_ARRIVAL": [
                {
                        "charId": 1002,
                        "name": "里の門番",
                        "text": "火の宝玉が奪われ、里の活気が失われてしまったのだ…"
                }
        ],
        "STORY_FIRE_CLEAR": [
                {
                        "name": "シャオ",
                        "text": "火が戻った……炉の音まで変わったみたい。里が息を吹き返していく。",
                        "charId": 105
                },
                {
                        "name": "里の長",
                        "text": "礼を言う、旅の者よ。王国軍がプリズムに手をかけていたとは、信じたくない話だが……目を逸らしてはならんな。"
                },
                {
                        "name": "主人公",
                        "text": "この国で何かが進んでいます。次の手がかりを追います。",
                        "charId": 301
                },
                {
                        "name": "里の長",
                        "text": "北の風の集落へ向かうがよい。あの地の風は、世界の流れに敏い。道を示してくれるはずだ。"
                }
        ],
        "STORY_WIND_CLEAR": [
                {
                        "name": "エリーゼ",
                        "text": "風が、泣いていない……みんなも少しずつ目を覚ましてます！",
                        "charId": 106
                },
                {
                        "name": "集落の長",
                        "text": "森と神殿を救ってくれたこと、深く感謝する。王国へ向かう船なら、西の水上都市に伝手があるかもしれん。"
                },
                {
                        "name": "エリーゼ",
                        "text": "ここで待っているだけでは、また悲しみが生まれてしまう…",
                        "charId": 106
                },
                {
                        "name": "エリーゼ",
                        "text": "私も行きます。風の行き先を、あなたと一緒に最後まで見届けたい。",
                        "charId": 106
                }
        ],
        "STORY_WATER_CLEAR": [
                {
                        "name": "都市の長",
                        "text": "濁っていた水路に光が戻った。兵士たちも潮が引くように消えていったよ。"
                },
                {
                        "name": "都市の長",
                        "text": "約束どおり船を渡そう。川を進めば、雷の要塞へ向かえるはずだ。"
                },
                {
                        "name": "ソフィア",
                        "text": "プリズムを狙う連中の言葉、こちらでも洗っておく。[N:104]は連れていきな。あの子に足りなかったのは、机の上じゃなく実戦だ。",
                "charId": 202
                },
                {
                        "name": "ケイト",
                        "text": "怖くないと言えば嘘になります。でも、足手まといのままでは終わりたくありません。どうか、同行させてください。",
                        "charId": 104
                }
        ],
        "STORY_ABYSS_UNSEALED": [
                {
                        "name": "システム",
                        "text": "六つの加護が、世界の中心に開いた亀裂へ共鳴している。"
                },
                {
                        "name": "主人公",
                        "text": "ここが、混沌の入口……。",
                "charId": 301
                },
                {
                        "name": "システム",
                        "text": "深淵への道が開いた。"
                }
        ],
        "STORY_BIG_TOWER_CLEAR": [
                {
                        "name": "常闇のリリス",
                        "text": "結界の光がほどける……ふふ、これで神殿の扉は眠りから覚める。"
                },
                {
                        "name": "シャオ",
                        "text": "光の神殿へ進める。けれど、この先は今まで以上に王国の中枢に近いはず。気を引き締めよう。",
                        "charId": 105
                }
        ],
        "STORY_THUNDER_CLEAR": [
                {
                        "name": "ジョセフ",
                        "text": "あのヴェルドって聖騎士、まともな理屈で剣を振ってる顔じゃなかった。だが、レナードの言葉は本物だ。",
                        "charId": 101
                },
                {
                        "name": "ジョセフ",
                        "text": "大灯台の結界装置を壊す。そうすりゃ光の神殿へ踏み込める。ここからは俺も同行するぜ。子供だけに背負わせるには、重すぎる。",
                        "charId": 101
                }
        ],
        "STORY_LIGHT_CLEAR": [
                {
                        "name": "レイラ",
                        "text": "リュシオンの加護が、光のプリズムを呼び戻した……。あの二人の加護が消えた今なら、先へ進めます。",
                        "charId": 204
                },
                {
                        "name": "レイラ",
                        "text": "残るプリズムは闇。西の果て、魔王城にあります。闇をただ恐れるだけでは、真実には届きません。私も同行します。",
                        "charId": 204
                }
        ],
        "STORY_DARK_CLEAR": [
                {
                        "name": "魔王ゼノン",
                        "text": "闇のプリズムは、余が守っていた。王国を攻めるためではない。混沌に喰われぬためだ。",
                        "charId": 402
                },
                {
                        "name": "魔王ゼノン",
                        "text": "六つのプリズムが応えた今なら、深淵の入口も開くだろう。だが、あの闇は人の心を容易く呑む。",
                        "charId": 402
                },
                {
                        "name": "魔王ゼノン",
                        "text": "混沌への案内は、こいつに任せる。ひよっこ達が混沌に魅入られないように、助けてやれ。",
                        "charId": 402
                },
                {
                        "name": "シャニー",
                        "text": "……わかった。",
                        "charId": 306
                },
                {
                        "name": "シャニー",
                        "text": "……道は、知ってる。ついてきて。",
                        "charId": 306
                },
                {
                        "name": "システム",
                        "text": "[N:306]が仲間に加わった！"
                }
        ],
        "TOWN_START_VILLAGER_1": [
                {
                        "name": "村人",
                        "text": "北東の穴は、昨日まで\nただの草地だったんだ。",
                        "charId": 1003
                },
                {
                        "name": "村人",
                        "text": "世界が裂ける音なんて、\n本当にあるんだな……。",
                        "charId": 1003
                }
        ],
        "TOWN_START_VILLAGER_2": [
                {
                        "name": "村の若者",
                        "text": "俺も戦えたらと思った。\nでも足が震えちまってさ。",
                        "charId": 1002
                },
                {
                        "name": "村の若者",
                        "text": "あんた達が進むなら、\nせめて道具は運ばせてくれ。",
                        "charId": 1002
                }
        ],
        "TOWN_START_VILLAGER_3": [
                {
                        "name": "薬草摘み",
                        "text": "今朝の薬草、苦い匂いがする。\n土が怯えてる時の匂いだよ。",
                        "charId": 1003
                },
                {
                        "name": "薬草摘み",
                        "text": "傷薬にはできる。\nでも、飲む時は鼻をつまみな。",
                        "charId": 1003
                }
        ],
        "TOWN_FIRE_VILLAGER_1": [
                {
                        "name": "鍛冶師",
                        "text": "火は戻った。\nけど、前の火じゃねえ。",
                        "charId": 1002
                },
                {
                        "name": "鍛冶師",
                        "text": "鉄が、槌を嫌がるんだ。\n火山で何かが暴れてる。",
                        "charId": 1002
                },
                {
                        "name": "鍛冶師",
                        "text": "行くなら水を持て。\n根性じゃ、火傷は冷めねえぞ。",
                        "charId": 1002
                }
        ],
        "TOWN_FIRE_VILLAGER_1_BEFORE": [
                {
                        "name": "鍛冶師",
                        "text": "聞こえるか。\n槌の音が、ひとつもねえ。",
                        "charId": 1002
                },
                {
                        "name": "鍛冶師",
                        "text": "火のない炉は墓と同じだ。\n触ると、ぞっとするほど冷たい。",
                        "charId": 1002
                }
        ],
        "TOWN_FIRE_VILLAGER_2": [
                {
                        "name": "里人",
                        "text": "昔は森の風穴の聖水で、\n火山の怒りを鎮めたそうだ。",
                        "charId": 1003
                },
                {
                        "name": "里人",
                        "text": "妖精の泉は迷い道の奥。\n風を恐れた者は辿り着けん。",
                        "charId": 1003
                }
        ],
        "TOWN_FIRE_VILLAGER_3": [
                {
                        "name": "炭運び",
                        "text": "火が死んでから、\n籠だけが軽くなっちまった。",
                        "charId": 1002
                },
                {
                        "name": "炭運び",
                        "text": "楽になったはずなのにな。\n背中の方が、ずっと重い。",
                        "charId": 1002
                }
        ],
        "TOWN_FIRE_VILLAGER_3_AFTER": [
                {
                        "name": "炭運び",
                        "text": "今日は籠が重い。\nやっと、いつもの重さだ。",
                        "charId": 1002
                },
                {
                        "name": "炭運び",
                        "text": "炉の連中が待ってる。\n今夜は肩が抜けても運ぶさ。",
                        "charId": 1002
                }
        ],
        "TOWN_WIND_VILLAGER_1": [
                {
                        "name": "見張り",
                        "text": "黒い風は消えた。\n鳥は、まだ戻ってこない。",
                        "charId": 1002
                },
                {
                        "name": "見張り",
                        "text": "森は助かった。\n怯えた森が、元に戻るのは先だ。",
                        "charId": 1002
                }
        ],
        "TOWN_WIND_VILLAGER_1_BEFORE": [
                {
                        "name": "見張り",
                        "text": "枝が揺れてるのに、\n頬には何も当たらない。",
                        "charId": 1002
                },
                {
                        "name": "見張り",
                        "text": "あれは風じゃない。\n森の中を、何かが歩いてる。",
                        "charId": 1002
                }
        ],
        "TOWN_WIND_VILLAGER_2": [
                {
                        "name": "集落の子",
                        "text": "風鈴が鳴らない日は、\n森が怒ってる日なんだって。",
                        "charId": 1003
                },
                {
                        "name": "集落の子",
                        "text": "でも今日は少し鳴ったよ。\nきっと、良くなるよね。",
                        "charId": 1003
                }
        ],
        "TOWN_WIND_VILLAGER_2_AFTER": [
                {
                        "name": "集落の子",
                        "text": "聞いて。風鈴が三つとも\n違う声で鳴るんだよ。",
                        "charId": 1003
                },
                {
                        "name": "集落の子",
                        "text": "森が歌を思い出したって、\nお母さんが泣いてた。",
                        "charId": 1003
                }
        ],
        "TOWN_WIND_VILLAGER_3": [
                {
                        "name": "風織り職人",
                        "text": "いい布は、風を閉じ込めない。\n通り道だけ覚えさせるんだ。",
                        "charId": 1003
                },
                {
                        "name": "風織り職人",
                        "text": "今の森風は糸を噛む。\nこんな機嫌、初めてだよ。",
                        "charId": 1003
                }
        ],
        "TOWN_WATER_VILLAGER_1": [
                {
                        "name": "老人",
                        "text": "要塞から雷が消えた夜、\n久しぶりに眠れたよ。",
                        "charId": 1003
                },
                {
                        "name": "老人",
                        "text": "あの二人も、少しは\n昔みたいに話せたかね。",
                        "charId": 1003
                }
        ],
        "TOWN_WATER_VILLAGER_1_BEFORE": [
                {
                        "name": "老人",
                        "text": "昔の要塞にはな、\n喧嘩ばかりの騎士が二人いた。",
                        "charId": 1003
                },
                {
                        "name": "老人",
                        "text": "レナードは先に斬る。\nジョセフは最後まで立つ。",
                        "charId": 1003
                },
                {
                        "name": "老人",
                        "text": "刃と盾が並んだ日だけ、\n負ける気がしなかったよ。",
                        "charId": 1003
                }
        ],
        "TOWN_WATER_VILLAGER_2": [
                {
                        "name": "船大工",
                        "text": "水路は嘘をつかねえ。\n濁りは必ず上流から来る。",
                        "charId": 1002
                },
                {
                        "name": "船大工",
                        "text": "海底神殿の奥には、\nまだ変な流れが残ってるぜ。",
                        "charId": 1002
                }
        ],
        "TOWN_WATER_VILLAGER_2_AFTER": [
                {
                        "name": "船大工",
                        "text": "澄んだ水は厄介だ。\n船底の傷まで丸見えになる。",
                        "charId": 1002
                },
                {
                        "name": "船大工",
                        "text": "だが、直す場所が見えるのはいい。\n街も船も同じだな。",
                        "charId": 1002
                }
        ],
        "TOWN_WATER_VILLAGER_3": [
                {
                        "name": "元兵士",
                        "text": "ジョセフ様は、よく怒鳴った。\n下がれ。俺の後ろにいろ、って。",
                        "charId": 1002
                },
                {
                        "name": "元兵士",
                        "text": "あの背中があったから、\n俺たちは前を向けたんだ。",
                        "charId": 1002
                }
        ],
        "TOWN_WATER_VILLAGER_4": [
                {
                        "name": "渡し守",
                        "text": "水は戻ったが、流れが若い。\n昔の川筋を忘れてやがる。",
                        "charId": 1002
                },
                {
                        "name": "渡し守",
                        "text": "急ぐ客ほど船を揺らす。\nあんたは、足を静かに置けるな。",
                        "charId": 1002
                }
        ],
        "TOWN_WATER_VILLAGER_4_AFTER": [
                {
                        "name": "渡し守",
                        "text": "川が昔の道を思い出した。\n櫂を入れる音でわかる。",
                        "charId": 1002
                },
                {
                        "name": "渡し守",
                        "text": "次に戻る時は客で来な。\n戦支度の顔は、もう十分だ。",
                        "charId": 1002
                }
        ],
        "QUEST_MARIE_START": [
                {
                        "name": "マリー",
                        "text": "祈るだけでは、あの子たちの\n眠る場所まで守れません。"
                },
                {
                        "name": "マリー",
                        "text": "街道の魔物を減らしてほしい。\n私は、逃げ道を照らします。"
                },
                {
                        "name": "主人公",
                        "text": "道を空けたら、ここへ戻る。",
                        "charId": 301
                },
                {
                        "name": "マリー",
                        "text": "はい。あなたの足音を、\n祈りの中で待っています。"
                }
        ],
        "QUEST_MARIE_REPORT": [
                {
                        "name": "マリー",
                        "text": "子どもたちが、久しぶりに\n外の風を嗅いで笑いました。"
                },
                {
                        "name": "マリー",
                        "text": "次は私が、あなたの道を\n照らす番ですね。"
                }
        ],
        "QUEST_ZELIED_START": [
                {
                        "name": "ゼリード",
                        "text": "灯台の火は戻った。\nだが、影が二つ残っている。"
                },
                {
                        "name": "ゼリード",
                        "text": "上で待つのは魔物じゃない。\n砕けた結界の執念だ。"
                },
                {
                        "name": "ゼリード",
                        "text": "俺は一階を守る。\nお前は頂で、息の根を止めろ。"
                }
        ],
        "QUEST_ZELIED_REPORT": [
                {
                        "name": "ゼリード",
                        "text": "……潮の匂いが戻ったな。\n頂の影は消えたようだ。"
                },
                {
                        "name": "ゼリード",
                        "text": "借りは背中で返す。\n次の戦いには、俺も行く。"
                }
        ],
        "QUEST_HAYATE_START": [
                {
                        "name": "ハヤテ",
                        "text": "アランが認めた旅人ってのは、\nあんたか。"
                },
                {
                        "name": "ハヤテ",
                        "text": "速さは逃げるためじゃない。\n誰かより先に着くためだ。"
                },
                {
                        "name": "ハヤテ",
                        "text": "北の街道を荒らす奴ら、\nどちらが先に片づける？"
                }
        ],
        "QUEST_HAYATE_REPORT": [
                {
                        "name": "ハヤテ",
                        "text": "俺が着いた時には、\n最後の一匹が倒れてた。"
                },
                {
                        "name": "ハヤテ",
                        "text": "負けたままじゃ眠れない。\n旅の先で、もう一度勝負だ。"
                }
        ],
        "QUEST_SYLVIA_START": [
                {
                        "name": "シルビア",
                        "text": "ジョセフ様の盾は、\n退く者まで守ったと聞きます。"
                },
                {
                        "name": "シルビア",
                        "text": "けれど街道には今も、\n帰れない荷車が残っている。"
                },
                {
                        "name": "シルビア",
                        "text": "護衛を手伝ってください。\n私も槍を置く気はありません。"
                }
        ],
        "QUEST_SYLVIA_REPORT": [
                {
                        "name": "シルビア",
                        "text": "荷車が三台、門を越えました。\n泣いていた御者まで笑って。"
                },
                {
                        "name": "シルビア",
                        "text": "守るだけでは届かない場所へ、\n今度は私も進みます。"
                }
        ],
        "QUEST_RIN_START": [
                {
                        "name": "リン",
                        "text": "レイラの雷は、迷わない。\nだから私は追いつけなかった。"
                },
                {
                        "name": "リン",
                        "text": "要塞の残党を狩る。\n私の刃が鈍いか、見てほしい。"
                }
        ],
        "QUEST_RIN_REPORT": [
                {
                        "name": "リン",
                        "text": "刃は鈍っていなかった。\n迷っていたのは、私の方だ。"
                },
                {
                        "name": "リン",
                        "text": "次は同じ敵を斬る。\nそれなら背中を預けられる。"
                }
        ],
        "QUEST_KARIN_CLEAR": [
                {
                        "name": "カリン",
                        "text": "斬らずに止める。\nその誓いを、甘さと笑われた。"
                },
                {
                        "name": "カリン",
                        "text": "だが君は、守るために\n刃を抜く者の目をしている。"
                },
                {
                        "name": "カリン",
                        "text": "この剣を預けよう。\n次は、君の隣で道を守る。"
                }
        ],
        "QUEST_ARISA_HAINE_START": [
                {
                        "name": "風の集落の村人",
                        "text": "旅の方、頼む。\n禁忌の森へ行ってくれないか。"
                },
                {
                        "name": "風の集落の村人",
                        "text": "アリサが森の奥へ入ったきり、戻らない。\nハイネ殿が後を追ったが……あの森は、まだ危ない。"
                },
                {
                        "name": "風の集落の村人",
                        "text": "二人だけでは手に負えないかもしれない。\nどうか、力を貸してくれ。"
                },
                {
                        "name": "エリーゼ",
                        "charId": 106,
                        "text": "森の奥から、乱れた風が届いています。\n急ぎましょう。"
                },
                {
                        "name": "システム",
                        "text": "[N:301]は静かに頷いた。"
                }
        ],
        "QUEST_ARISA_HAINE_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "禁忌の森深部。\n折れた枝の向こうで、刀の音が響いた。"
                },
                {
                        "name": "アリサ",
                        "charId": 108,
                        "text": "くっ……まだ、やれるっての……！\nこのくらいで倒れるアタシじゃないわよ！"
                },
                {
                        "name": "ハイネ",
                        "charId": 207,
                        "text": "アリサ、下がれ。\n息を整えろ。"
                },
                {
                        "name": "システム",
                        "text": "ハイネはアリサを背にかばい、迫る魔物へ刃を向ける。"
                },
                {
                        "name": "ハイネ",
                        "charId": 207,
                        "text": "旅の者か。助太刀、願えるか。\nこのままでは、アリサを守り切れぬ。"
                },
                {
                        "name": "アリサ",
                        "charId": 108,
                        "text": "な、何よ……助けに来るなら、もっと早く来なさいよ！\n……来てくれて、少しは助かったけど。"
                }
        ],
        "QUEST_ARISA_HAINE_CLEAR": [
                {
                        "name": "システム",
                        "text": "魔物が崩れ、森を満たしていた黒い風が薄れていく。"
                },
                {
                        "name": "アリサ",
                        "charId": 108,
                        "text": "……助かったわ。\nちょっとだけね。"
                },
                {
                        "name": "ハイネ",
                        "charId": 207,
                        "text": "強がるな、アリサ。\n命が残ったことを、まず喜べ。"
                },
                {
                        "name": "アリサ",
                        "charId": 108,
                        "text": "うっさい、師匠。\n……わかってるわよ。ありがとう。"
                },
                {
                        "name": "ハイネ",
                        "charId": 207,
                        "text": "俺からも礼を言う。\n見事な助太刀だった。"
                },
                {
                        "name": "アリサ",
                        "charId": 108,
                        "text": "アタシも行く。\n借りを作ったままなんて、気持ち悪いし。"
                },
                {
                        "name": "ハイネ",
                        "charId": 207,
                        "text": "ならば、俺も同行しよう。\nこの恩、刃で返す。"
                },
                {
                        "name": "システム",
                        "text": "[N:108]と[N:207]が仲間に加わった！"
                }
        ],
        "QUEST_SOPHIA_ALAN_CLEAR": [
                {
                        "name": "ソフィア",
                        "text": "禁じられた水路ほど、\n先を覗きたくなるものさ。"
                },
                {
                        "name": "アラン",
                        "text": "あなたは覗くだけでは済まない。\n私が止め役になります。"
                },
                {
                        "name": "ソフィア",
                        "text": "決まりだね。\n未知の続きは、この一行で見る。"
                }
        ],
        "QUEST_FRIEDA_BARON_CLEAR": [
                {
                        "name": "フリーダ",
                        "text": "雷雲が割れた。\n久しぶりに、星が見えるね。"
                },
                {
                        "name": "バロン",
                        "text": "眺めるのは後だ。\n戦場は、この先にも続く。"
                },
                {
                        "name": "フリーダ",
                        "text": "相変わらず固いなあ。\nじゃあ二人とも、連れていって。"
                }
        ],
        "QUEST_LICIA_CLEAR": [
                {
                        "name": "リーシア",
                        "text": "結界の式は解けた。\nだが、答えは一つ減っただけ。"
                },
                {
                        "name": "リーシア",
                        "text": "君の旅には、まだ\n観測できない揺らぎがある。"
                },
                {
                        "name": "リーシア",
                        "text": "同行する。\n真理が逃げる前に追わなくては。"
                }
        ],
        "QUEST_CLAUDE_LEON_CLEAR": [
                {
                        "name": "クロード",
                        "text": "また救えなかったらと思うと、\n拳が動かなかった。"
                },
                {
                        "name": "レオン",
                        "text": "恐れたまま立てたなら十分だ。\n私も隣で盾を持つ。"
                },
                {
                        "name": "クロード",
                        "text": "借りが増えたな。\n旅の中で、二人分返させてくれ。"
                }
        ],
        "QUEST_LUNA_CLEAR": [
                {
                        "name": "ルーナ",
                        "text": "誰かの祈りに守られるだけでは、\nまた同じ場所で震えてしまう。"
                },
                {
                        "name": "ルーナ",
                        "text": "今度は私が立ちます。\nこの光は、私が選んだものです。"
                }
        ],
        "QUEST_RYU_MINERVA_CLEAR": [
                {
                        "name": "ミネルバ",
                        "text": "禁則は消えた。でも術式の癖が、\n王国の古い工房と同じなの。"
                },
                {
                        "name": "リュウ",
                        "text": "ならば追う。\n言葉が要る時は、お前に任せる。"
                },
                {
                        "name": "ミネルバ",
                        "text": "交渉成立ね。\n拳が要る時は、あなたに任せるわ。"
                }
        ],
        "QUEST_ZENON_CLEAR": [
                {
                        "name": "ゼノン",
                        "text": "恐怖で魔を縛れば、\n人は私を魔王と呼ぶ。"
                },
                {
                        "name": "ゼノン",
                        "text": "それで世界が保つなら、\n名など好きに呼ばせてきた。"
                },
                {
                        "name": "主人公",
                        "text": "名ではなく、何を守るかを見る。",
                        "charId": 301
                },
                {
                        "name": "ゼノン",
                        "text": "ならば見届けよう。\nお前の剣が選ぶ、世界の続きを。"
                }
        ],
        "POST_THUNDER_FORT_BASE_1": [
                {
                        "name": "解放兵",
                        "text": "要塞に人の声が戻った。\nまだ信じられないよ。",
                        "charId": 1002
                },
                {
                        "name": "解放兵",
                        "text": "レナード様の刃も、\nジョセフ様の盾も本物だった。",
                        "charId": 1002
                }
        ],
        "POST_LIGHT_PALACE_BASE_1": [
                {
                        "name": "巡礼者",
                        "text": "割れた光を拾っているの。\nまた祈れる場所にしたくて。",
                        "charId": 1003
                },
                {
                        "name": "巡礼者",
                        "text": "闇を見た人ほど、\n光を雑には扱えないから。",
                        "charId": 1003
                }
        ],
        "POST_DARK_CASTLE_BASE_1": [
                {
                        "name": "魔族兵",
                        "text": "城を開く日が来るとはな。\nゼノン様も無茶をなさる。",
                        "charId": 1002
                },
                {
                        "name": "魔族兵",
                        "text": "だが混沌を止めるなら、\n人も魔族も関係あるまい。",
                        "charId": 1002
                }
        ],
        "FIRE_VILLAGE_CONSULT": [
                {
                        "name": "里の長",
                        "text": "……来てくれたか。\n炉の火が、日に日に痩せておる。"
                },
                {
                        "name": "里の長",
                        "text": "里の火は、火山のプリズムから届く。\nその脈が、数日前から細い。"
                },
                {
                        "name": "里の長",
                        "text": "若者を火山へ送った。\n戻った者は、王国兵を見たと言う。"
                },
                {
                        "name": "里の長",
                        "text": "プリズムを確かめてくれ。\n火を失えば、この里は誰も守れぬ。"
                }
        ],
        "FIRE_VOLCANO_SHAO_JOIN": [
                {
                        "name": "シャオ",
                        "text": "待って。\n火山へ行くなら、私も連れていって。",
                        "charId": 105
                },
                {
                        "name": "シャオ",
                        "text": "一人で入って、押し返された。\n魔物だけじゃない。兵士もいた。",
                        "charId": 105
                },
                {
                        "name": "シャオ",
                        "text": "ここは、私が立ち方を覚えた里。\n今度は私が守りたい。",
                        "charId": 105
                },
                {
                        "name": "システム",
                        "text": "[N:105]が同行を申し出ている。"
                }
        ],
        "FIRE_VOLCANO_SHAO_JOINED": [
                {
                        "name": "システム",
                        "text": "[N:105]が仲間に加わった！"
                }
        ],
        "FIRE_VOLCANO_CURSED_FLAMES": [
                {
                        "name": "システム",
                        "text": "火山道へ踏み込んだ瞬間、\n黒ずんだ炎が道を塞いだ。"
                },
                {
                        "name": "シャオ",
                        "text": "前に来た時よりひどい。\n火が、生き物みたいに怒ってる。",
                        "charId": 105
                },
                {
                        "name": "シャオ",
                        "text": "このままじゃ鎧ごと焼かれる。\n長なら昔の鎮め方を知ってるかも。",
                        "charId": 105
                }
        ],
        "FIRE_VILLAGE_HOLY_WATER_BRIEFING": [
                {
                        "name": "里の長",
                        "text": "黒い炎が道を選んだ、か。\n火山そのものの熱ではないな。"
                },
                {
                        "name": "里の長",
                        "text": "森の風穴に妖精の泉がある。\nあの聖水だけが火の穢れを洗える。"
                },
                {
                        "name": "シャオ",
                        "text": "風穴なら東の森です。\n子どもの頃、入口だけ見ました。",
                        "charId": 105
                },
                {
                        "name": "里の長",
                        "text": "泉の主に礼を尽くせ。\n水は奪わず、分けてもらうのだ。"
                }
        ],
        "FOREST_WIND_HOLE_ENTRY": [
                {
                        "name": "シャオ",
                        "text": "風が奥へ吸い込まれてる。\n泉は、この風の帰る場所にある。",
                        "charId": 105
                },
                {
                        "name": "システム",
                        "text": "岩肌の隙間から、\n小さな泣き声が聞こえた。"
                }
        ],
        "FOREST_HOLY_WATER_CLEAR": [
                {
                        "name": "システム",
                        "text": "魔物が崩れると、\n泉を覆う黒い膜がほどけた。"
                },
                {
                        "name": "泉の妖精",
                        "text": "熱い心のひと。\nあなたの火は、誰かを守る火なのね。"
                },
                {
                        "name": "シャオ",
                        "text": "里を助けたいんです。\n泉の水を少し分けてください。",
                        "charId": 105
                },
                {
                        "name": "泉の妖精",
                        "text": "なら、この雫を。\n怒る炎へ、名を呼ぶように注いで。"
                }
        ],
        "FIRE_VOLCANO_HOLY_WATER_USED": [
                {
                        "name": "システム",
                        "text": "聖水を振りまくと、\n黒い炎が白い蒸気へ変わった。"
                },
                {
                        "name": "シャオ",
                        "text": "道が見える……。\n今なら、火山の心臓まで行ける。",
                        "charId": 105
                }
        ],
        "FIRE_VOLCANO_WAITING_FOR_HOLY_WATER": [
                {
                        "name": "シャオ",
                        "text": "黒い炎は消えてない。\n先に、風穴の妖精の泉へ行こう。",
                        "charId": 105
                }
        ],
        "FIRE_VOLCANO_SOLDIERS": [
                {
                        "name": "システム",
                        "text": "火のプリズムの間。弱々しい赤光の前に、王国軍の兵士たちが立ちふさがる。"
                },
                {
                        "name": "ブロンズリーダー",
                        "text": "侵入者だ！　プリズム調整の邪魔をさせるな。ここで斬り捨てろ！"
                },
                {
                        "name": "シャオ",
                        "text": "調整？　火を奪っておいて、よくそんな言葉が出る……！",
                        "charId": 105
                }
        ],
        "FIRE_VOLCANO_GLAD": [
                {
                        "name": "炎楔のグラド",
                        "text": "少し遅かったようだな。火の理は、すでに我が内へ流れ込んでいる。"
                },
                {
                        "name": "システム",
                        "text": "プリズムの光がさらに細り、グラドの周囲に黒ずんだ炎のオーラがあふれ出す。"
                },
                {
                        "name": "炎楔のグラド",
                        "text": "我、炎獄の秘奥を得たり。この国の未来のため、灰となれ、冒険者よ。"
                }
        ],
        "FIRE_VOLCANO_GLAD_RETRY": [
                {
                        "name": "炎楔のグラド",
                        "text": "何度来ても無駄なこと……炎の力を吸い尽くすまで、邪魔はさせぬぞ！"
                },
                {
                        "name": "システム",
                        "text": "火のプリズムの間に、再び黒ずんだ炎が渦巻いている。"
                }
        ],
        "FIRE_VOLCANO_CLEAR": [
                {
                        "name": "システム",
                        "text": "グラドを退けると、奪われていた炎がプリズムへ流れ戻った。"
                },
                {
                        "name": "炎楔のグラド",
                        "text": "……ここまで押し返すか。だが、必要な火はすでに移した。次に会う時を楽しみにしている。"
                },
                {
                        "name": "システム",
                        "text": "グラドは黒い火の幕に包まれ、火山の奥へ消えた。"
                },
                {
                        "name": "シャオ",
                        "text": "王国軍が、闇の力を使っていた。そんなの、絶対におかしい。里へ戻って長に伝えよう。",
                        "charId": 105
                }
        ],
        "FIRE_VILLAGE_REPORT": [
                {
                        "name": "里の長",
                        "text": "炉の火が戻った……。火のプリズムも息を吹き返したのだな。"
                },
                {
                        "name": "主人公",
                        "text": "火を弱めていたのは王国軍でした。プリズムの力を奪い、闇のような力に変えていた。",
                "charId": 301
                },
                {
                        "name": "里の長",
                        "text": "王国が、そこまで歪んでおるとは。\n目を背ければ、次の里も焼かれる。"
                },
                {
                        "name": "シャオ",
                        "text": "王国軍が闇を使った。\n私も、この目で理由を確かめたい。",
                        "charId": 105
                },
                {
                        "name": "システム",
                        "text": "鍛冶機能が解放された。素材とゴールドを使い、装備を強化できる。"
                }
        ],
        "FIRE_VILLAGE_ELDER_BEFORE_STORY": [
                {
                        "name": "里の長",
                        "text": "旅の者か。すまぬが、今の里は客人をもてなす余裕がない。炉の火が日に日に弱っておる。"
                },
                {
                        "name": "里の長",
                        "text": "東の村で何かを成し、力を貸せると思ったなら、改めて声をかけてくれ。頼みたいことがある。"
                }
        ],
        "FIRE_VILLAGE_ELDER_IDLE": [
                {
                        "name": "里の長",
                        "text": "火はまだ細い。イグナ火山に納めた火のプリズムで、何かが起きているのだろう。"
                }
        ],
        "FIRE_VILLAGE_ELDER_DURING_VOLCANO": [
                {
                        "name": "里の長",
                        "text": "火山へ向かうなら、北の火山道を使うがよい。戻れぬ者も出ている。決して無理はするな。"
                },
                {
                        "name": "里の長",
                        "text": "王国軍の影を見たという者もいる。もし本当なら、この異変はただの魔物騒ぎでは済まぬ。"
                }
        ],
        "FIRE_VILLAGE_ELDER_AFTER_CLEAR": [
                {
                        "name": "里の長",
                        "text": "炉の音が戻った。だが王国軍がプリズムに手をかけた事実は、消えぬ火種として残る。"
                },
                {
                        "name": "里の長",
                        "text": "北の風の集落へ行くがよい。風は噂より早く、世界の歪みを運ぶ。"
                }
        ],
        "WIND_VILLAGE_INTRO": [
                {
                        "name": "システム",
                        "text": "風の集落は静まり返っていた。家々に生活の気配はあるのに、広場にいるのは子どもたちだけだ。"
                },
                {
                        "name": "エリーゼ",
                        "text": "あなたたち、旅の人？　大人の人たちは……朝になったら、みんないなくなっていました。",
                        "charId": 106
                },
                {
                        "name": "子ども",
                        "text": "夜にね、森が歩いてきたんだ。大人たちを飲み込んで、西の方へ連れていった。"
                },
                {
                        "name": "エリーゼ",
                        "text": "西の森は、昔は聖域でした。でもプリズム崩壊の日から魔物があふれて、封じるしかなくなった。",
                        "charId": 106
                },
                {
                        "name": "エリーゼ",
                        "text": "もし森へ行くなら、案内が必要です。私を連れて行ってください。",
                        "charId": 106
                },
                {
                        "name": "システム",
                        "text": "[N:106]が同行することになった！"
                }
        ],
        "WIND_VILLAGE_BEFORE_STORY": [
                {
                        "name": "子ども",
                        "text": "大人たち？　いるよ。……たぶん。森の方を見ていると、胸がざわざわするんだ。"
                },
                {
                        "name": "エリーゼ",
                        "text": "旅の方、風の向きが変です。今はまだ、私にも何が起きているのか分かりません。",
                        "charId": 106
                }
        ],
        "WIND_VILLAGE_ELISE_DURING": [
                {
                        "name": "エリーゼ",
                        "text": "禁忌の森は西です。大人たちは、森に呼ばれるように消えました。急ぎましょう。",
                        "charId": 106
                }
        ],
        "WIND_VILLAGE_AFTER_CLEAR": [
                {
                        "name": "集落の長",
                        "text": "風が戻り、集落にも声が戻った。西の水上都市へ向かうなら、風の流れが背を押すだろう。"
                },
                {
                        "name": "エリーゼ",
                        "text": "私はまだ旅を続けます。この風の先で、誰かが同じように助けを待っている気がするから。",
                        "charId": 106
                }
        ],
        "WIND_FOREST_ENTRY": [
                {
                        "name": "エリーゼ",
                        "text": "ここから先が禁忌の森です。風が、誰かの泣き声みたいに渦を巻いている。",
                        "charId": 106
                },
                {
                        "name": "主人公",
                        "text": "火の里と同じことが起きているなら、放ってはおけない。",
                "charId": 301
                },
                {
                        "name": "エリーゼ",
                        "text": "この森は東から入ると道が大きく曲がります。北西の奥へ抜ければ、祈りの広場へ続くはずです。",
                        "charId": 106
                }
        ],
        "WIND_FOREST_GUARDIANS_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "祈りの広場の石碑に触れると、風が一瞬だけ止まった。"
                },
                {
                        "name": "エリーゼ",
                        "text": "……静かすぎる。森が息を潜めています。",
                        "charId": 106
                },
                {
                        "name": "システム",
                        "text": "黒い風が渦を巻き、シルフウルフとヒールフェアリーの瞳が暗く染まる。"
                },
                {
                        "name": "シルフウルフ",
                        "text": "近づくな……守らねば……この森を、誰にも渡してはならぬ……！"
                }
        ],
        "WIND_FOREST_GUARDIANS_CLEAR": [
                {
                        "name": "システム",
                        "text": "狼と妖精の体から、黒い風がほどけていく。火のプリズムの加護が、黒き呪いを焼き払った。"
                },
                {
                        "name": "シルフウルフ",
                        "text": "我らは風のプリズムを守ってきた……意識はあった。だが呪いに縛られ、森を傷つけ、人を連れ去った。"
                },
                {
                        "name": "ヒールフェアリー",
                        "text": "風のプリズムの力がさらに弱っているようです…集落の人間たちも奥へ…どうか、風の祭壇へ急いで。"
                },
                {
                        "name": "エリーゼ",
                        "text": "大人たちを助ける。風のプリズムも、必ず。",
                        "charId": 106
                },
                {
                        "name": "システム",
                        "text": "ヒールフェアリーが仲間たちのHPとMPを全回復した。"
                }
        ],
        "WIND_TEMPLE_ELICIA_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "風の祭壇。弱まった風のプリズムの周囲で、うつろな瞳の大人たちが祈りを続けている。"
                },
                {
                        "name": "風楔のエリシア",
                        "text": "ようやく来たのね。風の嘆きに導かれた、小さな反抗者たち。"
                },
                {
                        "name": "エリーゼ",
                        "text": "その人たちを解放して。風のプリズムは、誰かを縛るためのものじゃない。",
                        "charId": 106
                },
                {
                        "name": "風楔のエリシア",
                        "text": "風は国の未来を運ぶもの。あなたたちの感傷で、儀式を止めさせはしないわ。"
                }
        ],
        "WIND_TEMPLE_CLEAR": [
                {
                        "name": "システム",
                        "text": "風の祭壇に聖なる風が戻り、うつろだった大人たちの瞳に光が差す。"
                },
                {
                        "name": "風楔のエリシア",
                        "text": "ここまで澄ませるなんて……でも、儀式は止まらない。王国はもう、後戻りできないの。"
                },
                {
                        "name": "システム",
                        "text": "エリシアは黒い風に身を包み、神殿の天井へ溶けるように消えた。"
                },
                {
                        "name": "集落の長",
                        "text": "船を探すなら、西の水上都市へ。水路と港の街なら、王国へ至る道を知る者がいるはずだ。"
                },
                {
                        "name": "エリーゼ",
                        "text": "このままでは、世界に同じ悲しみが増えてしまう。私も一緒に行きます。",
                        "charId": 106
                }
        ],
        "WATER_CITY_INTRO": [
                {
                        "name": "システム",
                        "text": "水路は濁り、橋に歌はない。\n黒鎧の兵士だけが街を歩いていた。"
                },
                {
                        "name": "ダークソルジャー",
                        "text": "抵抗するな。王国軍への協力は、市民の義務だ。"
                },
                {
                        "name": "少女",
                        "text": "やめて、宿の人たちは何もしていません！"
                },
                {
                        "name": "主人公",
                        "text": "その手を離せ。",
                        "charId": 301
                }
        ],
        "WATER_CITY_SOPHIA": [
                {
                        "name": "少女",
                        "text": "助けてくれて、ありがとう。\n酒場へ。あそこなら兵士の目が届かない。"
                },
                {
                        "name": "ソフィア",
                        "text": "いい腕だね。私は[N:202]。\n神殿を調べに来て、足止めされた。",
                "charId": 202
                },
                {
                        "name": "ソフィア",
                        "text": "火と風の話が本当なら、\n次に狙われるのは水のプリズムだ。",
                "charId": 202
                },
                {
                        "name": "ソフィア",
                        "text": "私は動けない。代わりに弟子を連れていって。[N:104]、前へ。",
                "charId": 202
                },
                {
                        "name": "ケイト",
                        "text": "は、はい……。足手まといにならないよう、精いっぱい頑張ります。",
                        "charId": 104
                },
                {
                        "name": "ソフィア",
                        "text": "神殿の入口は水圧で閉じている。\n力任せじゃ、街まで壊しかねない。",
                "charId": 202
                },
                {
                        "name": "ソフィア",
                        "text": "北東のクレナ鍾乳洞へ行きな。\n奥の青い結晶なら、水の道を開ける。",
                        "charId": 202
                },
                {
                        "name": "シャオ",
                        "text": "兵士より先に結晶を取らないと。\nあの連中も、神殿を狙ってる。",
                        "charId": 105
                },
                {
                        "name": "システム",
                        "text": "[N:104]が同行することになった！"
                }
        ],
        "WATER_CITY_CAVE_REMINDER": [
                {
                        "name": "ソフィア",
                        "text": "クレナ鍾乳洞は街の北東。\n青い鉱脈が夜でも道を照らす。",
                        "charId": 202
                },
                {
                        "name": "ケイト",
                        "text": "先に向かった兵士もいるそうです。\n入口から気を抜けませんね。",
                        "charId": 104
                }
        ],
        "CRENA_CAVE_ENTRY": [
                {
                        "name": "システム",
                        "text": "洞口の岩陰に、\n王国兵が何人も倒れていた。"
                },
                {
                        "name": "ケイト",
                        "text": "息がありません……。\n鎧に、大きな爪痕が残っています。",
                        "charId": 104
                },
                {
                        "name": "シャオ",
                        "text": "魔物の匂いに闇が混じってる。\n偶然ここへ来た魔物じゃない。",
                        "charId": 105
                }
        ],
        "CRENA_BLUE_CRYSTAL_CLEAR": [
                {
                        "name": "システム",
                        "text": "魔物の影が砕け、\n青の結晶が静かな光を取り戻した。"
                },
                {
                        "name": "シャオ",
                        "text": "やっぱり魔王軍の闇です。\n結晶を奪うため、魔物を放ったんだ。",
                        "charId": 105
                },
                {
                        "name": "ケイト",
                        "text": "結晶は無事です。\nソフィアさんへ届けましょう。",
                        "charId": 104
                }
        ],
        "WATER_CITY_BLUE_CRYSTAL_REPORT": [
                {
                        "name": "ソフィア",
                        "text": "よく持ち帰った。\n傷ひとつない、見事な青だ。",
                        "charId": 202
                },
                {
                        "name": "ソフィア",
                        "text": "これを水門へ掲げれば、\n海が君たちを神殿まで運んでくれる。",
                        "charId": 202
                },
                {
                        "name": "ケイト",
                        "text": "今度こそ、水のプリズムへ。\n街の水を取り戻しましょう。",
                        "charId": 104
                }
        ],
        "WATER_CITY_BEFORE_STORY": [
                {
                        "name": "システム",
                        "text": "水上都市の水路は濁り、港には黒鎧の兵士が目を光らせている。"
                },
                {
                        "name": "町人",
                        "text": "昔は橋に歌が流れていた。\n今は兵士の靴音ばかりだ。"
                }
        ],
        "WATER_CITY_BLOCKADE_GUARD": [
                {
                        "name": "ダークソルジャー",
                        "text": "この橋は封鎖した。\n荷車も巡礼者も通さん。"
                },
                {
                        "name": "ダークソルジャー",
                        "text": "水底の命令が解かれるまで、\nここから先は王国軍の区画だ。"
                }
        ],
        "WATER_CITY_SOPHIA_AFTER_MEETING": [
                {
                        "name": "ソフィア",
                        "text": "青の結晶が水路を開いた。\n海底神殿は、この街の北だ。",
                "charId": 202
                },
                {
                        "name": "ケイト",
                        "text": "私も行きます。\n怖くても、見ているだけには戻りません。",
                        "charId": 104
                }
        ],
        "WATER_CITY_AFTER_CLEAR": [
                {
                        "name": "都市の長",
                        "text": "水路に光が戻った。兵士たちも潮が引くように消え、ようやくこの街は息をつける。"
                },
                {
                        "name": "ソフィア",
                        "text": "船は君たちに預ける。\n川の先、雷の要塞が次の関門だ。",
                "charId": 202
                }
        ],
        "SEABED_TEMPLE_GATE_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "沈水回廊の水門前。青く錆びた扉を背に、黒鎧の兵士たちが進路を塞いでいる。"
                },
                {
                        "name": "ダークナイト",
                        "text": "ここから先は祈祷の間へ続く。民間人はもちろん、王国の命なき兵すら通さぬ。"
                },
                {
                        "name": "ケイト",
                        "text": "あの騎士がこの神殿の鍵を持っているかもしれません。倒すしかない、です…！",
                        "charId": 104
                }
        ],
        "SEABED_TEMPLE_GATE_CLEAR": [
                {
                        "name": "ダークナイト",
                        "text": "ぐっ……シーリス様、お許しを…"
                },
                {
                        "name": "システム",
                        "text": "鍵束を手に入れた！"
                },
                {
                        "name": "ケイト",
                        "text": "鍵の色が同じ扉なら開くようです…！神殿内には兵士がたくさん…慎重に進みましょう。",
                        "charId": 104
                }
        ],
        "SEABED_SYRIS_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "祈祷の間は凍てつき、侵入者を拒んでいるようだ。"
                },
                {
                        "name": "システム",
                        "text": "水のプリズムの光は薄れ、床一面に霜が広がっている。"
                },
                {
                        "name": "氷楔のシーリス",
                        "text": "ずいぶん遅かったのね。奇跡と呼ばれた水の力は、既に凍てつく刃として王国へ捧げられた。"
                },
                {
                        "name": "ケイト",
                        "text": "息が……凍る……。でも、ここで退くわけにはいきません…！！",
                        "charId": 104
                },
                {
                        "name": "氷楔のシーリス",
                        "text": "ならば眠りなさい。この水底で、永遠に。"
                },
                {
                        "name": "システム",
                        "text": "シーリスから巨大な冷気が迸り、[N:301]達の体を突き刺した…！！"
                }
        ],
        "SEABED_TEMPLE_CLEAR": [
                {
                        "name": "システム",
                        "text": "凍りついた祈祷の間に水音が戻り、プリズムから青い光が広がっていく…！"
                },
                {
                        "name": "氷楔のシーリス",
                        "text": "ここまで届く…か…でも、儀式はまだ終わらない。全てはこの国のため…"
                },
                {
                        "name": "システム",
                        "text": "シーリスは砕ける氷の向こう、闇の中へ消えていった。"
                },
                {
                        "name": "都市の長",
                        "text": "兵士たちも撤退していった。街の水も戻り、これでまた海運も再開できる。"
                },
                {
                        "name": "都市の長",
                        "text": "君たちには感謝してもしきれない。王国を目指すのであれば、この船を託そう。"
                },
                {
                        "name": "ソフィア",
                        "text": "[N:104]、いい顔になったね。\nもう私の後ろへ隠れる目じゃない。",
                        "charId": 202
                },
                {
                        "name": "ソフィア",
                        "text": "[N:301]、この子を連れていって。\n旅の中でしか学べないことがある。",
                        "charId": 202
                },
                {
                        "name": "ケイト",
                        "text": "もっと役に立てるようになります。\n正式に、同行させてください。",
                        "charId": 104
                },
                {
                        "name": "システム",
                        "text": "[N:104]が正式に仲間に加わった！"
                },
                {
                        "name": "システム",
                        "text": "魔法の小舟を手に入れた。川を進み、雷の要塞へ向かえる。"
                }
        ],
        "THUNDER_MACHINE_GATE_ENCOUNTER": [
                {
                        "name": "ジョセフ",
                        "text": "こいつが鍵を持ってるはずだ。止めねえと、次の隔壁は開かねえぞ。",
                        "charId": 101
                },
                {
                        "name": "バトルマシーン",
                        "text": "侵入者ヲ確認。雷門ヲ防衛スル。排除開始。"
                }
        ],
        "THUNDER_MACHINE_GATE_CLEAR": [
                {
                        "name": "ジョセフ",
                        "text": "赤い鍵を落としたな。こいつで地下の隔壁を一つ越えられるはずだ。急ぐぞ、機械の唸りが強くなってる。",
                        "charId": 101
                }
        ],
        "THUNDER_ARMOR_GATE_ENCOUNTER": [
                {
                        "name": "ジョセフ",
                        "text": "こっちは雷のプリズムに直結した動く鎧だ。力任せに通ろうとすりゃ、丸焦げだぜ。",
                        "charId": 101
                },
                {
                        "name": "サンダーアーマー",
                        "text": "隔壁ノ防衛命令ヲ継続。雷装、最大出力。"
                }
        ],
        "THUNDER_ARMOR_GATE_CLEAR": [
                {
                        "name": "ジョセフ",
                        "text": "よし、青い鍵だ。これで中枢まで行ける。……レナード、頼むからまだ話が通じる男でいてくれよ。",
                        "charId": 101
                }
        ],
        "LIGHTHOUSE_MIDBOSS_ENCOUNTER": [
                {
                        "name": "ヘルクラッシャー",
                        "text": "灯ヲ消ス侵入者ドモ。ココデ散レ。"
                },
                {
                        "name": "デモンキャット",
                        "text": "魔界ノ呪イデノタウチ回レ。"
                }
        ],
        "LIGHTHOUSE_MIDBOSS_CLEAR": [
                {
                        "name": "エリーゼ",
                        "text": "金色の鍵……これで上層の扉が開くはずです。",
                        "charId": 106
                }
        ],
        "DARK_CASTLE_ZELDRAS_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "西館二階、結界の間。黒い剣を携えた騎士が、青い封印石の前に立っている。"
                },
                {
                        "name": "常闇のゼルドラス",
                        "text": "ここは西の結界。闇の王へ至る資格なき者は、青き鍵に触れることも許されぬ。"
                },
                {
                        "name": "シャオ",
                        "text": "魔王の部下なら、どいて。こっちは確かめたいことがある。",
                        "charId": 105
                },
                {
                        "name": "常闇のゼルドラス",
                        "text": "ならば刃で示せ。怒りだけでこの城を進めると思うな。"
                }
        ],
        "DARK_CASTLE_ZELDRAS_CLEAR": [
                {
                        "name": "常闇のゼルドラス",
                        "text": "よかろう。青き鍵を持って進め。だが玉座の前で、己の憎しみまで正義と呼ぶな。"
                },
                {
                        "name": "シャオ",
                        "text": "……わかってる。わかってるけど、簡単に割り切れないんだ。",
                        "charId": 105
                }
        ],
        "DARK_CASTLE_ELMENAS_CLEAR": [
                {
                        "name": "風詠のエルメナス",
                        "text": "赤き鍵はあなたたちへ。……風が告げている。玉座で待つ者は、ただの敵ではないわ。"
                },
                {
                        "name": "シャオ",
                        "text": "……だったら、なおさら行く。",
                        "charId": 105
                }
        ],
        "DARK_CASTLE_ELMENAS_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "東館二階、結界の間。風のない部屋に、鈴のような声だけが響いている。"
                },
                {
                        "name": "風詠のエルメナス",
                        "text": "東の結界へようこそ。赤き鍵は、急ぐ者ほど遠ざかるわ。"
                },
                {
                        "name": "シャオ",
                        "text": "回りくどい言い方はやめて。こっちは、魔王にも……あの人にも、聞きたいことがある。",
                        "charId": 105
                },
                {
                        "name": "風詠のエルメナス",
                        "text": "風は答えを運ぶだけ。受け止めるかどうかは、あなた次第よ。"
                }
        ],
        "DARK_CASTLE_BELET_ELM_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "本館二階、夢幻回廊。床も天井も歪み、進んだはずの道が背後へ戻っていく。"
                },
                {
                        "name": "冥騎士ベレト",
                        "text": "赤と青の結界を越えたか。ならば最後は、己の影と戦う覚悟を見せろ。"
                },
                {
                        "name": "レイラ",
                        "text": "この回廊そのものが試練になっています。迷いを突かれないでください。",
                        "charId": 204
                },
                {
                        "name": "冥騎士ベレト",
                        "text": "金の鍵は玉座への最後の鎖。欲しければ、夢ごと斬り払ってみせよ。"
                }
        ],
        "DARK_CASTLE_BELET_ELM_CLEAR": [
                {
                        "name": "冥騎士ベレト",
                        "text": "見事。金の鍵を持て。玉座の扉は、三つの鍵をそろえた者だけを通す。"
                },
                {
                        "name": "レイラ",
                        "text": "青、赤、金……これで謁見の間へ進めるはずです。",
                        "charId": 204
                }
        ],
        "THUNDER_LEONARD_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "雷の制御炉。暴走した機械の火花が、壁を青白く照らしている。"
                },
                {
                        "name": "雷楔のレナード",
                        "text": "ここまで来たか、[N:101]。相変わらず、危険な道を子どもたちに歩かせるのだな。"
                },
                {
                        "name": "ジョセフ",
                        "text": "危険にしてるのはお前らだろうが。プリズムを軍の道具にするなんざ、騎士のすることじゃねえ。",
                        "charId": 101
                },
                {
                        "name": "雷楔のレナード",
                        "text": "それでも国を守るためならば、私は剣を抜く。友であったお前にもだ。"
                }
        ],
        "THUNDER_LEONARD_CLEAR": [
                {
                        "name": "雷楔のレナード",
                        "text": "…[N:101]、まだ旧い理想にしがみつくのか。国を存続させるには、痛みを引き受ける者が必要だ。"
                },
                {
                        "name": "ジョセフ",
                        "text": "痛みを引き受けるのと、誰かから奪うのは違うだろうが！プリズムは国王の財布じゃねえ！",
                        "charId": 101
                },
                {
                        "name": "雷楔のレナード",
                        "text": "プリズムの力は必要な分、すでに光の神殿に集まっている。儀式の日は近い。"
                },
                {
                        "name": "雷楔のレナード",
                        "text": "……止めたいのなら、まずは大灯台で発動している魔術結界を壊すことだ。"
                },
                {
                        "name": "雷楔のレナード",
                        "text": "それから……"
                },
                {
                        "name": "システム",
                        "text": "突然、闇の裂け目から、白銀の鎧をまとった騎士が現れた。"
                },
                {
                        "name": "？？？？",
                        "text": "…喋りすぎ…だ。"
                },
                {
                        "name": "システム",
                        "text": "騎士の剣が閃き、レナードは闇の中へ倒れ込んだ…"
                },
                {
                        "name": "ジョセフ",
                        "text": "レナード！！！",
                        "charId": 101
                },
                {
                        "name": "？？？？",
                        "text": "お前達が例の反逆者か。騎士崩れと世間知らずの子供達。救世主ごっこは、ここまでだ。"
                }
        ],
        "THUNDER_VELD_OVERPOWER": [
                {
                        "name": "聖騎士ヴェルド",
                        "text": "お前達は救世の障害だ。大いなる祝福には犠牲が伴い、犠牲無しに世界を変えることなどできない。"
                },
                {
                        "name": "聖騎士ヴェルド",
                        "text": "お前達は世界を救っている気になっているようだが、ゆるやかな死に向かっているだけよ。"
                },
                {
                        "name": "聖騎士ヴェルド",
                        "text": "死ぬのなら、お前達だけで死ね。跡形もなく消え去るがよい。"
                },
                {
                        "name": "システム",
                        "text": "ヴェルドから強大な光の魔力が放たれる…！"
                },
                {
                        "name": "システム",
                        "text": "圧倒的な光の奔流につつまれ、意識が途切れた…"
                }
        ],
        "THUNDER_VELD_LOSS": [
                {
                        "name": "ジョセフ",
                        "text": "……生きてるな。ヴェルドは追ってこなかった。どうにか助かったな",
                        "charId": 101
                },
                {
                        "name": "サラ",
                        "text": "どうして私たち、助かったのでしょうか…ここは…？私たちの村の前？",
                        "charId": 110
                },
                {
                        "name": "ガイル",
                        "text": "何が何だかサッパリだけど、負けたんだな、俺たち。守るとか言って、口ばっかりだ、俺。",
                        "charId": 109
                },
                {
                        "name": "サラ",
                        "text": "[N:109]…",
                        "charId": 110
                },
                {
                        "name": "ジョセフ",
                        "text": "…レナードのやつは…最期、大灯台へ行けって言ってたな。結界、か。",
                        "charId": 101
                },
                {
                        "name": "ジョセフ",
                        "text": "よし、善は急げだ。ヴェルドのやろうの力は底が知れないが…ひとまずは大灯台へ向かおうぜ。",
                        "charId": 101
                },
                {
                        "name": "ジョセフ",
                        "text": "おっと、最後にチラッと見えたが…雷の要塞の東門も開いてるはずだ。",
                        "charId": 101
                },
                {
                        "name": "ジョセフ",
                        "text": "結界を破ったら、そこから神殿へ向かうことにしようぜ。",
                        "charId": 101
                }
        ],
        "LIGHTHOUSE_LILITH_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "大灯台の最上階。灯火の代わりに、黒い魔術結界が空へ伸びている。"
                },
                {
                        "name": "常闇のリリス",
                        "text": "ここまで登ってくるなんて。はぁ、ヴェルドもやきがまわったわね。"
                },
                {
                        "name": "エリーゼ",
                        "text": "なんて恐ろしい魔力…風が苦しく泣いています。",
                        "charId": 106
                },
                {
                        "name": "ジョセフ",
                        "text": "誰だか知らねーが、サクッとその結界、壊させてもらうぜ。",
                        "charId": 101
                },
                {
                        "name": "常闇のリリス",
                        "text": "…身の程をわきまえなさい。そして思い知りなさい。"
                },
                {
                        "name": "常闇のリリス",
                        "text": "お前たちが相対しているのは、魔術の深淵に座す者であることを。"
                }
        ],
        "LIGHTHOUSE_CLEAR": [
                {
                        "name": "常闇のリリス",
                        "text": "ああ、私の結界が…混沌の光が空に溶けていく…"
                },
                {
                        "name": "常闇のリリス",
                        "text": "身の程知らずとは、私のこと。ヴェルド、ジャスパー、気をつけなさい。"
                },
                {
                        "name": "常闇のリリス",
                        "text": "……小さな反逆者じゃない。失われたはずの…光の神の加護が、まだここに…"
                },
                {
                        "name": "システム",
                        "text": "リリスの消滅と同時に、大灯台の頂、黒き光の波動が鈍い音をたてて砕け散った。"
                },
                {
                        "name": "ケイト",
                        "text": "やった、魔力の濁りが消えました！これで神殿の結界も解かれたはずです。",
                        "charId": 104
                },
                {
                        "name": "サラ",
                        "text": "あの人最期に…光の神様…まだ私たちを見守ってくれているのでしょうか…？",
                        "charId": 110
                },
                {
                        "name": "ジョセフ",
                        "text": "確かにそんなこと言ってやがったな。だが、ただの負け惜しみじゃねえか？",
                        "charId": 101
                },
                {
                        "name": "ジョセフ",
                        "text": "ともあれ、俺たちの勝ちだ！まだ間に合うはずだ、雷の要塞を越えて、光の神殿へ向かおうぜ。",
                        "charId": 101
                }
        ],
        "LIGHT_PALACE_FINAL_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "光の神殿最奥。光のプリズムは黒く濁り、不吉な光を周囲に放っている。"
                },
                {
                        "name": "ジョセフ",
                        "text": "間に合ったか！？",
                        "charId": 101
                },
                {
                        "name": "ケイト",
                        "text": "こんな…こんな魔力の歪みは見たことも聞いたこともありません…",
                        "charId": 104
                },
                {
                        "name": "ケイト",
                        "text": "…それこそ、元素崩壊が起きたあの日よりも…！",
                        "charId": 104
                },
                {
                        "name": "聖騎士ヴェルド",
                        "text": "…お前たちはあの時消し飛んだはず…跡形もなく、だ。"
                },
                {
                        "name": "魔道神官ジャスパー",
                        "text": "よもや、結界まで破るとは。失態じゃな、ヴェルド。だが祝福の儀はすでに臨界点よ。止めることはできぬ。"
                },
                {
                        "name": "聖騎士ヴェルド",
                        "text": "……まぁいい。ここが旅の終着点だ。"
                },
                {
                        "name": "聖騎士ヴェルド",
                        "text": "混沌の光はすでに我らへ降りた。小さき反逆者どもに、触れられる領域ではない。"
                },
                {
                        "name": "聖騎士ヴェルド",
                        "text": "光の消えた瞳で、この世界の再誕を見届けるがよい。"
                },
                {
                        "name": "レイラ",
                        "text": "あれは……光ではありません。プリズムに混ざった、別の何かです。皆さん、気をつけてください。",
                        "charId": 204
                },
                {
                        "name": "システム",
                        "text": "ジャスパーとヴェルドの全身から、濁った白光が噴き上がる…！"
                }
        ],
        "LIGHT_PALACE_CLEAR": [
                {
                        "name": "システム",
                        "text": "光の神の加護と同調したプリズムが、宮殿の闇を白く洗い流していく。"
                },
                {
                        "name": "魔道神官ジャスパー",
                        "text": "馬鹿な……混沌の光が、剥がされる……？"
                },
                {
                        "name": "聖騎士ヴェルド",
                        "text": "力が…戻らぬ……これが、本来の光だとでもいうのか。"
                },
                {
                        "name": "システム",
                        "text": "加護を失ったジャスパーとヴェルドは、音もなく光の奔流の中へ消えていった。"
                },
                {
                        "name": "レイラ",
                        "text": "光のプリズムは応えてくれました。残るプリズムは闇……魔王城へ向かいましょう。",
                        "charId": 204
                },
                {
                        "name": "システム",
                        "text": "[N:204]が仲間に加わった！"
                }
        ],
        "LIGHT_PALACE_OVERPOWER_CLEAR": [
                {
                        "name": "システム",
                        "text": "混沌の光をまとったジャスパーとヴェルドを、ついに押し返した。"
                },
                {
                        "name": "魔道神官ジャスパー",
                        "text": "まだだ……最後の祝福を、プリズムへ……！"
                },
                {
                        "name": "システム",
                        "text": "二人が最後の力を注ぎ込むと、光のプリズムが激しく暴走し、宮殿全体が白く染まった。"
                },
                {
                        "name": "システム",
                        "text": "その奔流の中心で、[N:301]の胸の奥に宿るリュシオンの加護が目覚める。"
                },
                {
                        "name": "レイラ",
                        "text": "プリズムが……本来の光を取り戻していく……！",
                        "charId": 204
                },
                {
                        "name": "聖騎士ヴェルド",
                        "text": "バカな！混沌の光が……我らから……"
                },
                {
                        "name": "システム",
                        "text": "力を失ったジャスパーとヴェルドは、光の奔流の中へ音もなく消えていった。"
                },
                {
                        "name": "レイラ",
                        "text": "光のプリズムは救われました。残るは闇……魔王城へ向かいましょう。",
                        "charId": 204
                },
                {
                        "name": "システム",
                        "text": "[N:204]が仲間に加わった！"
                }
        ],
        "LIGHT_PALACE_BLESSING_RETRY": [
                {
                        "name": "システム",
                        "text": "膝をついた仲間たちを、濁った光が押し潰そうとする。"
                },
                {
                        "name": "魔道神官ジャスパー",
                        "text": "これで終わりだ。祝福に逆らう器など、欠片も残す必要はない。"
                },
                {
                        "name": "システム",
                        "text": "その瞬間、[N:301]の胸の奥で、リュシオンの加護が強く輝いた。"
                },
                {
                        "name": "レイラ",
                        "text": "光のプリズムが……同調している……！",
                        "charId": 204
                },
                {
                        "name": "聖騎士ヴェルド",
                        "text": "バカな！混沌の光が……我らから消えた……？"
                },
                {
                        "name": "システム",
                        "text": "清らかな光が宮殿を満たし、ジャスパーとヴェルドを包んでいた混沌の光を消し去った。"
                },
                {
                        "name": "システム",
                        "text": "仲間たちのHPとMPが全回復した！"
                }
        ],
        "DARK_CASTLE_ZENON_ENCOUNTER": [
                {
                        "name": "システム",
                        "text": "魔王城三階、謁見の間。闇のプリズムは静かに脈打ち、玉座の前に魔王[N:402]が立っている。"
                },
                {
                        "name": "魔王ゼノン",
                        "text": "三つの結界を越えたか。ならば問おう。お前たちは、闇を滅ぼしに来たのか。あるいは、闇の意味を知りに来たのか。",
                        "charId": 402
                },
                {
                        "name": "シャオ",
                        "text": "私は……魔王より先に、聞きたい相手がいる。シャニー姉さんは、ここにいるんでしょ。",
                        "charId": 105
                },
                {
                        "name": "シャニー",
                        "text": "……いる。",
                        "charId": 306
                },
                {
                        "name": "シャオ",
                        "text": "なんで……里を捨てたの。みんな、ずっと待ってたのに。",
                        "charId": 105
                },
                {
                        "name": "シャニー",
                        "text": "……今は、話さない。",
                        "charId": 306
                },
                {
                        "name": "魔王ゼノン",
                        "text": "言葉で届かぬものもある。闇を恐れるだけの者か、奥を見据える者か……余に示せ。",
                        "charId": 402
                }
        ],
        "DARK_CASTLE_CLEAR": [
                {
                        "name": "魔王ゼノン",
                        "text": "……見事だ。闇を前にしても、呑まれず、逃げず、刃を止めなかった。",
                        "charId": 402
                },
                {
                        "name": "シャオ",
                        "text": "魔王……あなたは、本当に世界を壊そうとしていたわけじゃないの？",
                        "charId": 105
                },
                {
                        "name": "魔王ゼノン",
                        "text": "余が守っていたのは闇のプリズムだ。王国の手にも、混沌の手にも渡せぬからな。",
                        "charId": 402
                },
                {
                        "name": "魔王ゼノン",
                        "text": "六つのプリズムが応えた今、世界の中心に開いた亀裂へ進める。だが、混沌は力だけで越えられる場所ではない。",
                        "charId": 402
                },
                {
                        "name": "魔王ゼノン",
                        "text": "混沌への案内は、こいつに任せる。ひよっこ達が混沌に魅入られないように、助けてやれ。",
                        "charId": 402
                },
                {
                        "name": "シャニー",
                        "text": "……わかった。",
                        "charId": 306
                },
                {
                        "name": "シャオ",
                        "text": "姉さん……。",
                        "charId": 105
                },
                {
                        "name": "シャニー",
                        "text": "……今は、行く。話は……終わってから。",
                        "charId": 306
                },
                {
                        "name": "システム",
                        "text": "[N:306]が仲間に加わった！"
                }
        ],
        "ABYSS_UNSEALED_FINAL": [
                {
                        "name": "システム",
                        "text": "世界の中心。大地に走る黒い亀裂が、六つの加護に呼応して脈打つ。"
                },
                {
                        "name": "主人公",
                        "text": "火、風、水、雷、光、闇……全部がこの先を示している。",
                "charId": 301
                },
                {
                        "name": "レイラ",
                        "text": "混沌は、理の外から世界を侵食しています。ここから先は、誰かに命じられて進む道ではありません。",
                        "charId": 204
                },
                {
                        "name": "シャオ",
                        "text": "それでも行こう。私たちが見てきた里や街を、もう一度誰かに奪わせないために。",
                        "charId": 105
                },
                {
                        "name": "システム",
                        "text": "深淵への道が開いた。"
                }
        ],
        "FIRE_VOLCANO_SHAO_REFUSE": [
                {
                        "name": "シャオ",
                        "text": "そんなこと言わないで、頼む。火のプリズムを見捨てたら、この里は二度と剣を打てなくなる。",
                        "charId": 105
                },
                {
                        "name": "シャオ",
                        "text": "私は自分の足で進む。だから、あなたの背中を追わせて。",
                        "charId": 105
                }
        ],
        "THUNDER_FORT_ENTRY": [
                {
                        "name": "ジョセフ",
                        "text": "止まれ。……いや、敵じゃないな。魔王軍や王国兵なら、こんな無防備にここまで来ねえ。",
                        "charId": 101
                },
                {
                        "name": "ジョセフ",
                        "text": "雷のプリズムが暴走してな。機械が命令を聞かず暴れまわるもんで、要塞に入れなくなっちまった。",
                        "charId": 101
                },
                {
                        "name": "ジョセフ",
                        "text": "王国軍のやつらも最近妙なことばかりやってやがる。誰も信用できねえってのが現状だ。",
                        "charId": 101
                },
                {
                        "name": "主人公",
                        "text": "王国軍に火、風、水のプリズムが狙われた。ここも危険だ、放っておくことはできない。",
                        "charId": 301
                },
                {
                        "name": "ジョセフ",
                        "text": "強行突入か。仕方ねえ、俺も行く。子供らだけにやらせちゃ、騎士の名がすたるぜ。",
                        "charId": 101
                },
                {
                        "name": "システム",
                        "text": "[N:101]が同行することになった！"
                }
        ],
        "LOCKED_WIND_TEMPLE": [
                {
                        "name": "エリーゼ",
                        "text": "森の奥から、風が逆巻いています。神殿は近いはずなのに、道そのものが私たちを拒んでいるみたい。",
                        "charId": 106
                },
                {
                        "name": "エリーゼ",
                        "text": "まず祈りの広場へ行きましょう。あそこの石碑なら、この風の乱れを鎮める手がかりになるはずです。",
                        "charId": 106
                }
        ],
        "LOCKED_SEABED_TEMPLE": [
                {
                        "name": "システム",
                        "text": "海の底に沈む神殿が見える。だが、水流は荒く、入口らしき場所も兵の影に塞がれている。"
                },
                {
                        "name": "主人公",
                        "text": "このままでは入れない。水上都市なら、入り方を知っている人がいるかもしれない。",
                "charId": 301
                }
        ],
        "LOCKED_THUNDER_FORT": [
                {
                        "name": "システム",
                        "text": "門は固く閉ざされており、電気が迸っている。今は触らない方がよさそうだ…"
                },
                {
                        "name": "エリーゼ",
                        "text": "純水は雷を通さないと聞いたことがあります。水の加護があれば、入ることができるかもしれません",
                        "charId": 106
                }
        ],
        "LOCKED_BIG_TOWER": [
                {
                        "name": "ジョセフ",
                        "text": "灯台の上から、嫌な術式の匂いがする。だが、今はまだ何を壊せばいいか分からねえ。",
                        "charId": 101
                },
                {
                        "name": "ジョセフ",
                        "text": "先に雷の要塞だ。あそこで何が起きているか掴めば、大灯台の意味も見えてくるはずだ。",
                        "charId": 101
                }
        ],
        "LOCKED_LIGHT_PALACE": [
                {
                        "name": "システム",
                        "text": "神殿の入口を覆う光の膜が、触れる前から肌を刺す。清らかな光ではない。術式で閉じられた結界だ。"
                },
                {
                        "name": "ジョセフ",
                        "text": "レナードが言っていた大灯台。あそこの装置を止めなきゃ、この膜は破れそうにねえ。",
                        "charId": 101
                }
        ],
        "LOCKED_DARK_CASTLE": [
                {
                        "name": "システム",
                        "text": "西の果てに黒い城が沈むように建っている。近づくほどに、闇の気配よりも深い沈黙が胸に落ちる。"
                },
                {
                        "name": "シャオ",
                        "text": "まだここへ踏み込む理由が足りない気がする。光の神殿で、残るプリズムのことを確かめよう。",
                        "charId": 105
                }
        ]
},

    events: {
        "game_start": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "GAME_START_1"
                        },
                        {
                                "type": "BOSS",
                                "value": [
                                        100001,
                                        100001
                                ]
                        }
                ],
                "winActions": [
                        {
                                "type": "STEP",
                                "value": 0
                        },
                        {
                                "type": "SUB",
                                "value": 1
                        },
                        {
                                "type": "HEAL"
                        },
                        {
                                "type": "CONV",
                                "value": "GAME_START_2"
                        },
                        {
                                "type": "SUB",
                                "value": 2
                        }
                ]
        },
        "game_start_retry": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "BATTLE_RETRY_TALK"
                        },
                        {
                                "type": "TEMP_LB_START",
                                "value": 99,
                                "id": "game_start_retry_lb99"
                        },
                        {
                                "type": "HEAL"
                        },
                        {
                                "type": "BOSS",
                                "value": [
                                        100001,
                                        100001
                                ]
                        }
                ],
                "winActions": [
                        {
                                "type": "TEMP_LB_CLEAR",
                                "id": "game_start_retry_lb99"
                        },
                        {
                                "type": "STEP",
                                "value": 0
                        },
                        {
                                "type": "SUB",
                                "value": 1
                        },
                        {
                                "type": "HEAL"
                        },
                        {
                                "type": "CONV",
                                "value": "GAME_START_2"
                        },
                        {
                                "type": "SUB",
                                "value": 2
                        },
                        {
                                "type": "LOG",
                                "value": ""
                        }
                ]
        },
        "start_adventure": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "PROLOGUE"
                        },
                        {
                                "type": "ALLY",
                                "value": 109
                        },
                        {
                                "type": "ALLY",
                                "value": 110
                        },
                        {
                                "type": "STEP",
                                "value": 1
                        },
                        {
                                "type": "SUB",
                                "value": 1
                        },
                        {
                                "type": "LOG",
                                "value": ""
                        }
                ],
                "winActions": []
        },
        "start_adventure2": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "PROLOGUE2"
                        }
                ],
                "winActions": []
        },
        "start_adventure3": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "PROLOGUE3"
                        },
                        {
                                "type": "ALLY",
                                "value": 109
                        },
                        {
                                "type": "ALLY",
                                "value": 110
                        },
                        {
                                "type": "SUB",
                                "value": 1
                        }
                ],
                "winActions": []
        },
        "start_village_elder_after": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "START_VILLAGE_ELDER_AFTER"
                        }
                ],
                "winActions": []
        },
        "start_cave1": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "START_CAVE1"
                        }
                ],
                "winActions": []
        },
        "start_cave2": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "START_CAVE2"
                        },
                        {
                                "type": "CHOICE",
                                "text": "封鎖を解いて、洞穴の奥へ進みますか？",
                                "yes": [
                                        {
                                                "type": "CONV",
                                                "value": "START_CAVE3"
                                        },
                                        {
                                                "type": "MAP_CHANGE",
                                                "value": "START_CAVE_GATE_OPEN"
                                        },
                                        {
                                                "type": "SUB",
                                                "value": 2
                                        }
                                ],
                                "no": [
                                        {
                                                "type": "LOG",
                                                "value": "準備ができたらもう一度話しかけよう"
                                        }
                                ]
                        }
                ],
                "winActions": []
        },
        "start_boss_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "START_DUNGEON_CLEAR"
                        },
                        {
                                "type": "STEP",
                                "value": 2
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "巨大な化け物を打ち倒した…！"
                        }
                ],
                "winActions": []
        },
        // legacy compatibility only: current route uses prism-specific clear events.
        "fire_village_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "STORY_FIRE_CLEAR"
                        },
                        {
                                "type": "ALLY",
                                "value": 105
                        },
                        {
                                "type": "UNLOCK",
                                "value": "smith"
                        },
                        {
                                "type": "FLAG",
                                "key": "fireVillageCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 3
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "炎の里を解放した。北の風の集落へ向かおう。"
                        }
                ],
                "winActions": []
        },
        // legacy compatibility only: current route uses prism-specific clear events.
        "wind_village_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "STORY_WIND_CLEAR"
                        },
                        {
                                "type": "ALLY",
                                "value": 106
                        },
                        {
                                "type": "FLAG",
                                "key": "windVillageCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 4
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "風の集落を解放した。西の水上都市へ向かおう。"
                        }
                ],
                "winActions": []
        },
        // legacy compatibility only: current route uses prism-specific clear events.
        "water_city_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "STORY_WATER_CLEAR"
                        },
                        {
                                "type": "ALLY",
                                "value": 104
                        },
                        {
                                "type": "ITEM",
                                "id": 108,
                                "count": 1
                        },
                        {
                                "type": "UNLOCK",
                                "value": "boat"
                        },
                        {
                                "type": "FLAG",
                                "key": "hasShip"
                        },
                        {
                                "type": "FLAG",
                                "key": "waterCityCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 5
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "魔法の小舟を手に入れた。雷の要塞へ向かおう。"
                        }
                ],
                "winActions": []
        },
        "abyss_unsealed": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "ABYSS_UNSEALED_FINAL"
                        },
                        {
                                "type": "UNLOCK",
                                "value": "abyss"
                        },
                        {
                                "type": "FLAG",
                                "key": "abyssOuterReached"
                        },
                        {
                                "type": "STEP",
                                "value": 10
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "START_ABYSS_DUNGEON"
                        }
                ],
                "winActions": []
        },
        "big_tower_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LIGHTHOUSE_CLEAR"
                        },
                        {
                                "type": "FLAG",
                                "key": "lighthouseCleared"
                        },
                        {
                                "type": "FLAG",
                                "key": "bigTowerCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 7
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "光の神殿を覆う結界が消えた。"
                        }
                ],
                "winActions": []
        },
        "thunder_fort_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "THUNDER_LEONARD_CLEAR"
                        },
                        {
                                "type": "BOSS",
                                "value": 301050,
                                "bossStatMultiplier": 3,
                                "winEventId": "thunder_veld_forced_loss",
                                "lossEventId": "thunder_veld_loss"
                        }
                ],
                "winActions": []
        },
        "thunder_machine_gate_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "THUNDER_MACHINE_GATE_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": 301031,
                                "keyRewardColor": "red",
                                "winEventId": "thunder_machine_gate_clear"
                        }
                ],
                "winActions": []
        },
        "thunder_machine_gate_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "THUNDER_MACHINE_GATE_CLEAR"
                        }
                ],
                "winActions": []
        },
        "thunder_armor_gate_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "THUNDER_ARMOR_GATE_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": 301032,
                                "keyRewardColor": "blue",
                                "winEventId": "thunder_armor_gate_clear"
                        }
                ],
                "winActions": []
        },
        "thunder_armor_gate_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "THUNDER_ARMOR_GATE_CLEAR"
                        }
                ],
                "winActions": []
        },
        "big_tower_midboss_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LIGHTHOUSE_MIDBOSS_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": [
                                        301060,
                                        301062
                                ],
                                "keyRewardColor": "gold",
                                "winEventId": "big_tower_midboss_clear"
                        }
                ],
                "winActions": []
        },
        "big_tower_midboss_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LIGHTHOUSE_MIDBOSS_CLEAR"
                        }
                ],
                "winActions": []
        },
        "dark_castle_zeldras_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "DARK_CASTLE_ZELDRAS_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": 301080,
                                "keyRewardColor": "blue",
                                "winEventId": "dark_castle_zeldras_clear"
                        }
                ],
                "winActions": []
        },
        "dark_castle_zeldras_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "DARK_CASTLE_ZELDRAS_CLEAR"
                        }
                ],
                "winActions": []
        },
        "dark_castle_elmenas_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "DARK_CASTLE_ELMENAS_CLEAR"
                        }
                ],
                "winActions": []
        },
        "dark_castle_elmenas_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "DARK_CASTLE_ELMENAS_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": 301082,
                                "keyRewardColor": "red",
                                "winEventId": "dark_castle_elmenas_clear"
                        }
                ],
                "winActions": []
        },
        "dark_castle_belet_elm_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "DARK_CASTLE_BELET_ELM_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": 301081,
                                "keyRewardColor": "gold",
                                "winEventId": "dark_castle_belet_elm_clear"
                        }
                ],
                "winActions": []
        },
        "dark_castle_belet_elm_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "DARK_CASTLE_BELET_ELM_CLEAR"
                        }
                ],
                "winActions": []
        },
        "thunder_leonard_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "THUNDER_LEONARD_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": 301040,
                                "winEventId": "thunder_fort_clear"
                        }
                ],
                "winActions": []
        },
        "big_tower_lilith_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LIGHTHOUSE_LILITH_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": 301061,
                                "winEventId": "big_tower_clear"
                        }
                ],
                "winActions": []
        },
        "light_palace_final_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LIGHT_PALACE_FINAL_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": [
                                        301070,
                                        301050
                                ],
                                "bossStatMultiplier": 3,
                                "winEventId": "light_palace_overpower_clear",
                                "lossEventId": "light_palace_blessing_retry"
                        }
                ],
                "winActions": []
        },
        "light_palace_overpower_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LIGHT_PALACE_OVERPOWER_CLEAR"
                        },
                        {
                                "type": "ALLY",
                                "value": 204
                        },
                        {
                                "type": "FLAG",
                                "key": "lightPalaceCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 8
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "レイラが仲間に加わった。魔王城へ向かおう。"
                        }
                ],
                "winActions": []
        },
        "light_palace_blessing_retry": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LIGHT_PALACE_BLESSING_RETRY"
                        },
                        {
                                "type": "HEAL"
                        },
                        {
                                "type": "BOSS",
                                "value": [
                                        301070,
                                        301050
                                ],
                                "winEventId": "light_palace_clear"
                        }
                ],
                "winActions": []
        },
        "dark_castle_zenon_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "DARK_CASTLE_ZENON_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": 301100,
                                "winEventId": "dark_castle_clear"
                        }
                ],
                "winActions": []
        },
        "light_palace_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LIGHT_PALACE_CLEAR"
                        },
                        {
                                "type": "ALLY",
                                "value": 204
                        },
                        {
                                "type": "FLAG",
                                "key": "lightPalaceCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 8
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "レイラが仲間に加わった。魔王城へ向かおう。"
                        }
                ],
                "winActions": []
        },
        "dark_castle_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "DARK_CASTLE_CLEAR"
                        },
                        {
                                "type": "ALLY",
                                "value": 306
                        },
                        {
                                "type": "FLAG",
                                "key": "darkCastleCleared"
                        },
                        {
                                "type": "FLAG",
                                "key": "prismBlessingsComplete"
                        },
                        {
                                "type": "STEP",
                                "value": 9
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "闇の加護を得た。世界の中心の亀裂へ向かおう。"
                        }
                ],
                "winActions": []
        },
        "quest_fire_holy_water_clear": {
                "actions": [
                        { "type": "CONV", "value": "FOREST_HOLY_WATER_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "fire_holy_water" },
                        { "type": "SUB", "value": 5 },
                        { "type": "LOG", "value": "妖精の聖水を得た。イグナ火山へ戻ろう。" }
                ],
                "winActions": []
        },
        "quest_water_blue_crystal_clear": {
                "actions": [
                        { "type": "CONV", "value": "CRENA_BLUE_CRYSTAL_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "water_blue_crystal" },
                        { "type": "SUB", "value": 2 },
                        { "type": "LOG", "value": "青の結晶を得た。水上都市のソフィアへ届けよう。" }
                ],
                "winActions": []
        },
        "quest_claude_leon_clear": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_CLAUDE_LEON_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "claude_leon_dark_shrine" }
                ],
                "winActions": []
        },
        "quest_luna_hidden_clear": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_LUNA_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "luna_hidden_dark_shrine" }
                ],
                "winActions": []
        },
        "quest_ryu_minerva_clear": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_RYU_MINERVA_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "ryu_minerva_grezelia" }
                ],
                "winActions": []
        },
        "quest_zenon_hidden_clear": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_ZENON_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "zenon_hidden_grezelia" }
                ],
                "winActions": []
        },
        "quest_karin_volcano_clear": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_KARIN_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "karin_volcano_depths" }
                ],
                "winActions": []
        },
        "quest_arisa_haine_start": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_ARISA_HAINE_START" }
                ],
                "winActions": []
        },
        "quest_arisa_haine_encounter": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_ARISA_HAINE_ENCOUNTER" },
                        { "type": "BOSS", "value": [301011, 301012], "winEventId": "quest_arisa_haine_clear" }
                ],
                "winActions": []
        },
        "quest_arisa_haine_clear": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_ARISA_HAINE_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "arisa_haine_forest_depths" }
                ],
                "winActions": []
        },
        "quest_sophia_alan_clear": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_SOPHIA_ALAN_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "sophia_alan_seabed_depths" }
                ],
                "winActions": []
        },
        "quest_frieda_baron_clear": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_FRIEDA_BARON_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "frieda_baron_thunder_depths" }
                ],
                "winActions": []
        },
        "quest_licia_clear": {
                "actions": [
                        { "type": "CONV", "value": "QUEST_LICIA_CLEAR" },
                        { "type": "QUEST_COMPLETE", "value": "licia_crena_depths" }
                ],
                "winActions": []
        },
        "fire_village_consult": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "FIRE_VILLAGE_CONSULT"
                        },
                        {
                                "type": "FLAG",
                                "key": "fireVillageConsulted"
                        },
                        {
                                "type": "STEP",
                                "value": 2
                        },
                        {
                                "type": "SUB",
                                "value": 2
                        },
                        {
                                "type": "LOG",
                                "value": "イグナ火山の異変を調査することになった。"
                        }
                ],
                "winActions": []
        },
        "fire_volcano_entrance": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "FIRE_VOLCANO_SHAO_JOIN"
                        },
                        {
                                "type": "CHOICE",
                                "text": "同行を許可しますか？",
                                "yes": [
                                        {
                                                "type": "ALLY",
                                                "value": 105
                                        },
                                        {
                                                "type": "CONV",
                                                "value": "FIRE_VOLCANO_SHAO_JOINED"
                                        },
                                        {
                                                "type": "FLAG",
                                                "key": "shaoJoinedAtVolcano"
                                        },
                                        {
                                                "type": "STEP",
                                                "value": 2
                                        },
                                        {
                                                "type": "SUB",
                                                "value": 3
                                        },
                                        {
                                                "type": "CONV",
                                                "value": "FIRE_VOLCANO_CURSED_FLAMES"
                                        }
                                ],
                                "no": [
                                        {
                                                "type": "CONV",
                                                "value": "FIRE_VOLCANO_SHAO_REFUSE"
                                        },
                                        {
                                                "type": "ALLY",
                                                "value": 105
                                        },
                                        {
                                                "type": "CONV",
                                                "value": "FIRE_VOLCANO_SHAO_JOINED"
                                        },
                                        {
                                                "type": "FLAG",
                                                "key": "shaoJoinedAtVolcano"
                                        },
                                        {
                                                "type": "STEP",
                                                "value": 2
                                        },
                                        {
                                                "type": "SUB",
                                                "value": 3
                                        },
                                        {
                                                "type": "CONV",
                                                "value": "FIRE_VOLCANO_CURSED_FLAMES"
                                        }
                                ]
                        }
                ],
                "winActions": []
        },
        "fire_village_holy_water_briefing": {
                "actions": [
                        { "type": "CONV", "value": "FIRE_VILLAGE_HOLY_WATER_BRIEFING" },
                        { "type": "QUEST_ACCEPT", "value": "fire_holy_water" },
                        { "type": "FLAG", "key": "windHoleRouteKnown" },
                        { "type": "SUB", "value": 4 },
                        { "type": "LOG", "value": "森の風穴で、妖精の泉を探そう。" }
                ],
                "winActions": []
        },
        "forest_wind_hole_entry": {
                "actions": [
                        { "type": "CONV", "value": "FOREST_WIND_HOLE_ENTRY" },
                        { "type": "FLAG", "key": "forestWindHoleEntered" },
                        { "type": "START_FIXED_DUNGEON", "value": "FOREST_WIND_HOLE" }
                ],
                "winActions": []
        },
        "fire_volcano_holy_water_used": {
                "actions": [
                        { "type": "CONV", "value": "FIRE_VOLCANO_HOLY_WATER_USED" },
                        { "type": "FLAG", "key": "volcanoCursedFlamesPurified" },
                        { "type": "SUB", "value": 6 },
                        { "type": "START_FIXED_DUNGEON", "value": "IGNIS_VOLCANO" }
                ],
                "winActions": []
        },
        "fire_volcano_waiting_for_holy_water": {
                "actions": [
                        { "type": "CONV", "value": "FIRE_VOLCANO_WAITING_FOR_HOLY_WATER" }
                ],
                "winActions": []
        },
        "fire_volcano_soldiers_encounter": {
                "actions": [
                        {
                                "type": "IF_FLAG",
                                "key": "fireVolcanoSoldiersCleared",
                                "then": [
                                        {
                                                "type": "CONV",
                                                "value": "FIRE_VOLCANO_GLAD_RETRY"
                                        },
                                        {
                                                "type": "BOSS",
                                                "value": 301010,
                                                "winEventId": "fire_volcano_glad_clear"
                                        }
                                ],
                                "else": [
                                        {
                                                "type": "CONV",
                                                "value": "FIRE_VOLCANO_SOLDIERS"
                                        },
                                        {
                                                "type": "BOSS",
                                                "value": [
                                                        301002,
                                                        301001,
                                                        301001,
                                                        301001
                                                ],
                                                "winEventId": "fire_volcano_soldiers_clear",
                                                "deferFixedBossDefeat": true
                                        }
                                ]
                        }
                ],
                "winActions": []
        },
        "fire_volcano_soldiers_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "FIRE_VOLCANO_GLAD"
                        },
                        {
                                "type": "FLAG",
                                "key": "fireVolcanoSoldiersCleared"
                        },
                        {
                                "type": "BOSS",
                                "value": 301010,
                                "winEventId": "fire_volcano_glad_clear"
                        }
                ],
                "winActions": []
        },
        "fire_volcano_glad_retry": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "FIRE_VOLCANO_GLAD_RETRY"
                        },
                        {
                                "type": "BOSS",
                                "value": 301010,
                                "winEventId": "fire_volcano_glad_clear"
                        }
                ],
                "winActions": []
        },
        "fire_volcano_glad_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "FIRE_VOLCANO_CLEAR"
                        },
                        {
                                "type": "FLAG",
                                "key": "firePrismRestored"
                        },
                        {
                                "type": "STEP",
                                "value": 2
                        },
                        {
                                "type": "SUB",
                                "value": 7
                        },
                        {
                                "type": "LOG",
                                "value": "火のプリズムに炎の力が戻った。炎の里へ報告しよう。"
                        }
                ],
                "winActions": []
        },
        "fire_village_report": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "FIRE_VILLAGE_REPORT"
                        },
                        {
                                "type": "ALLY",
                                "value": 105
                        },
                        {
                                "type": "UNLOCK",
                                "value": "smith"
                        },
                        {
                                "type": "FLAG",
                                "key": "fireVillageCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 3
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "鍛冶機能が解放された。北の風の集落へ向かおう。"
                        }
                ],
                "winActions": []
        },
        "fire_village_elder_before_story": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "FIRE_VILLAGE_ELDER_BEFORE_STORY"
                        }
                ],
                "winActions": []
        },
        "fire_village_elder_idle": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "FIRE_VILLAGE_ELDER_IDLE"
                        }
                ],
                "winActions": []
        },
        "fire_village_elder_during_volcano": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "FIRE_VILLAGE_ELDER_DURING_VOLCANO"
                        }
                ],
                "winActions": []
        },
        "fire_village_elder_after_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "FIRE_VILLAGE_ELDER_AFTER_CLEAR"
                        }
                ],
                "winActions": []
        },
        "wind_village_intro": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WIND_VILLAGE_INTRO"
                        },
                        {
                                "type": "ALLY",
                                "value": 106
                        },
                        {
                                "type": "FLAG",
                                "key": "eliseJoinedAtWindVillage"
                        },
                        {
                                "type": "STEP",
                                "value": 3
                        },
                        {
                                "type": "SUB",
                                "value": 1
                        },
                        {
                                "type": "LOG",
                                "value": "エリーゼが同行した。禁忌の森へ向かおう。"
                        }
                ],
                "winActions": []
        },
        "wind_village_before_story": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WIND_VILLAGE_BEFORE_STORY"
                        }
                ],
                "winActions": []
        },
        "wind_village_elise_during": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WIND_VILLAGE_ELISE_DURING"
                        }
                ],
                "winActions": []
        },
        "wind_village_after_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WIND_VILLAGE_AFTER_CLEAR"
                        }
                ],
                "winActions": []
        },
        "wind_forest_entry": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WIND_FOREST_ENTRY"
                        },
                        {
                                "type": "FLAG",
                                "key": "windForestEntryIntroduced"
                        },
                        {
                                "type": "START_FIXED_DUNGEON",
                                "value": "FORBIDDEN_FOREST"
                        }
                ],
                "winActions": []
        },
		"wind_forest_guardians_clear": {
				"actions": [
						{
								"type": "CONV",
								"value": "WIND_FOREST_GUARDIANS_CLEAR"
						},
						{
								"type": "HEAL"
						},
						{
								"type": "FLAG",
								"key": "windForestCleansed"
						},
						{
								"type": "STEP",
								"value": 3
						},
						{
								"type": "SUB",
								"value": 2
						},
						{
								"type": "LOG",
								"value": "森の守護者が金の鍵を託した。森の奥にある風の神殿の石門へ向かおう。"
						}
				],
				"winActions": []
		},
		"wind_forest_guardians_encounter": {
				"actions": [
						{
								"type": "CONV",
								"value": "WIND_FOREST_GUARDIANS_ENCOUNTER"
						},
						{
								"type": "BOSS",
								"value": [
										301011,
										301012
								],
								"keyRewardColor": "gold",
								"winEventId": "wind_forest_guardians_clear"
						}
				],
				"winActions": []
		},
        "wind_temple_elicia_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WIND_TEMPLE_ELICIA_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": 301020,
                                "winEventId": "wind_temple_clear"
                        }
                ],
                "winActions": []
        },
        "wind_temple_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WIND_TEMPLE_CLEAR"
                        },
                        {
                                "type": "ALLY",
                                "value": 106
                        },
                        {
                                "type": "FLAG",
                                "key": "windVillageCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 4
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "風のプリズムに聖なる風が戻った。西の水上都市へ向かおう。"
                        }
                ],
                "winActions": []
        },
        "water_city_before_story": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WATER_CITY_BEFORE_STORY"
                        }
                ],
                "winActions": []
        },
        "water_city_blockade_guard": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WATER_CITY_BLOCKADE_GUARD"
                        }
                ],
                "winActions": []
        },
        "water_city_sophia_after_meeting": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WATER_CITY_SOPHIA_AFTER_MEETING"
                        }
                ],
                "winActions": []
        },
        "water_city_after_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WATER_CITY_AFTER_CLEAR"
                        }
                ],
                "winActions": []
        },
        "town_start_villager_1": {
                "actions": [{ "type": "CONV", "value": "TOWN_START_VILLAGER_1" }],
                "winActions": []
        },
        "town_start_villager_2": {
                "actions": [{ "type": "CONV", "value": "TOWN_START_VILLAGER_2" }],
                "winActions": []
        },
        "town_start_villager_3": {
                "actions": [{ "type": "CONV", "value": "TOWN_START_VILLAGER_3" }],
                "winActions": []
        },
        "town_fire_villager_1": {
                "actions": [{ "type": "CONV", "value": "TOWN_FIRE_VILLAGER_1" }],
                "winActions": []
        },
        "town_fire_villager_1_before": {
                "actions": [{ "type": "CONV", "value": "TOWN_FIRE_VILLAGER_1_BEFORE" }],
                "winActions": []
        },
        "town_fire_villager_2": {
                "actions": [{ "type": "CONV", "value": "TOWN_FIRE_VILLAGER_2" }],
                "winActions": []
        },
        "town_fire_villager_3": {
                "actions": [{ "type": "CONV", "value": "TOWN_FIRE_VILLAGER_3" }],
                "winActions": []
        },
        "town_fire_villager_3_after": {
                "actions": [{ "type": "CONV", "value": "TOWN_FIRE_VILLAGER_3_AFTER" }],
                "winActions": []
        },
        "town_wind_villager_1": {
                "actions": [{ "type": "CONV", "value": "TOWN_WIND_VILLAGER_1" }],
                "winActions": []
        },
        "town_wind_villager_1_before": {
                "actions": [{ "type": "CONV", "value": "TOWN_WIND_VILLAGER_1_BEFORE" }],
                "winActions": []
        },
        "town_wind_villager_2": {
                "actions": [{ "type": "CONV", "value": "TOWN_WIND_VILLAGER_2" }],
                "winActions": []
        },
        "town_wind_villager_2_after": {
                "actions": [{ "type": "CONV", "value": "TOWN_WIND_VILLAGER_2_AFTER" }],
                "winActions": []
        },
        "town_wind_villager_3": {
                "actions": [{ "type": "CONV", "value": "TOWN_WIND_VILLAGER_3" }],
                "winActions": []
        },
        "town_water_villager_1": {
                "actions": [{ "type": "CONV", "value": "TOWN_WATER_VILLAGER_1" }],
                "winActions": []
        },
        "town_water_villager_1_before": {
                "actions": [{ "type": "CONV", "value": "TOWN_WATER_VILLAGER_1_BEFORE" }],
                "winActions": []
        },
        "town_water_villager_2": {
                "actions": [{ "type": "CONV", "value": "TOWN_WATER_VILLAGER_2" }],
                "winActions": []
        },
        "town_water_villager_2_after": {
                "actions": [{ "type": "CONV", "value": "TOWN_WATER_VILLAGER_2_AFTER" }],
                "winActions": []
        },
        "town_water_villager_3": {
                "actions": [{ "type": "CONV", "value": "TOWN_WATER_VILLAGER_3" }],
                "winActions": []
        },
        "town_water_villager_4": {
                "actions": [{ "type": "CONV", "value": "TOWN_WATER_VILLAGER_4" }],
                "winActions": []
        },
        "town_water_villager_4_after": {
                "actions": [{ "type": "CONV", "value": "TOWN_WATER_VILLAGER_4_AFTER" }],
                "winActions": []
        },
        "quest_marie_start": {
                "actions": [{ "type": "CONV", "value": "QUEST_MARIE_START" }],
                "winActions": []
        },
        "quest_marie_report": {
                "actions": [{ "type": "CONV", "value": "QUEST_MARIE_REPORT" }],
                "winActions": []
        },
        "quest_zelied_start": {
                "actions": [{ "type": "CONV", "value": "QUEST_ZELIED_START" }],
                "winActions": []
        },
        "quest_zelied_report": {
                "actions": [{ "type": "CONV", "value": "QUEST_ZELIED_REPORT" }],
                "winActions": []
        },
        "quest_hayate_start": {
                "actions": [{ "type": "CONV", "value": "QUEST_HAYATE_START" }],
                "winActions": []
        },
        "quest_hayate_report": {
                "actions": [{ "type": "CONV", "value": "QUEST_HAYATE_REPORT" }],
                "winActions": []
        },
        "quest_sylvia_start": {
                "actions": [{ "type": "CONV", "value": "QUEST_SYLVIA_START" }],
                "winActions": []
        },
        "quest_sylvia_report": {
                "actions": [{ "type": "CONV", "value": "QUEST_SYLVIA_REPORT" }],
                "winActions": []
        },
        "quest_rin_start": {
                "actions": [{ "type": "CONV", "value": "QUEST_RIN_START" }],
                "winActions": []
        },
        "quest_rin_report": {
                "actions": [{ "type": "CONV", "value": "QUEST_RIN_REPORT" }],
                "winActions": []
        },
        "post_thunder_fort_base_1": {
                "actions": [{ "type": "CONV", "value": "POST_THUNDER_FORT_BASE_1" }],
                "winActions": []
        },
        "post_light_palace_base_1": {
                "actions": [{ "type": "CONV", "value": "POST_LIGHT_PALACE_BASE_1" }],
                "winActions": []
        },
        "post_dark_castle_base_1": {
                "actions": [{ "type": "CONV", "value": "POST_DARK_CASTLE_BASE_1" }],
                "winActions": []
        },
        "water_city_intro": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WATER_CITY_INTRO"
                        },
                        {
                                "type": "BOSS",
                                "value": [
                                        301021,
                                        301021
                                ],
                                "winEventId": "water_city_sophia"
                        }
                ],
                "winActions": []
        },
        "water_city_sophia": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "WATER_CITY_SOPHIA"
                        },
                        {
                                "type": "ALLY",
                                "value": 104
                        },
                        {
                                "type": "FLAG",
                                "key": "kateJoinedAtWaterCity"
                        },
                        {
                                "type": "STEP",
                                "value": 4
                        },
                        {
                                "type": "SUB",
                                "value": 1
                        },
                        {
                                "type": "QUEST_ACCEPT",
                                "value": "water_blue_crystal"
                        },
                        {
                                "type": "FLAG",
                                "key": "crenaRouteKnown"
                        },
                        {
                                "type": "LOG",
                                "value": "クレナ鍾乳洞で青の結晶を探そう。"
                        }
                ],
                "winActions": []
        },
        "water_city_cave_reminder": {
                "actions": [
                        { "type": "CONV", "value": "WATER_CITY_CAVE_REMINDER" }
                ],
                "winActions": []
        },
        "crena_cave_entry": {
                "actions": [
                        { "type": "CONV", "value": "CRENA_CAVE_ENTRY" },
                        { "type": "FLAG", "key": "crenaCaveEntered" },
                        { "type": "START_FIXED_DUNGEON", "value": "CRENA_LIMESTONE_CAVE" }
                ],
                "winActions": []
        },
        "water_city_blue_crystal_report": {
                "actions": [
                        { "type": "CONV", "value": "WATER_CITY_BLUE_CRYSTAL_REPORT" },
                        { "type": "FLAG", "key": "seabedTempleRouteOpened" },
                        { "type": "SUB", "value": 3 },
                        { "type": "LOG", "value": "青の結晶が水の道を開いた。海底神殿へ向かおう。" }
                ],
                "winActions": []
        },
        "sea_temple_gate_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "SEABED_TEMPLE_GATE_CLEAR"
                        },
                        {
                                "type": "FLAG",
                                "key": "seabedTempleGateCleared"
                        },
                        {
                                "type": "LOG",
                                "value": "鍵束を入手した。海底神殿の水門へ進もう。"
                        }
                ],
                "winActions": []
        },
        "sea_temple_gate_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "SEABED_TEMPLE_GATE_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": [
                                        301021,
                                        301022,
                                        301021
                                ],
                                "keyRewardColors": ["red", "blue"],
                                "winEventId": "sea_temple_gate_clear"
                        }
                ],
                "winActions": []
        },
        "water_temple_syris_encounter": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "SEABED_SYRIS_ENCOUNTER"
                        },
                        {
                                "type": "BOSS",
                                "value": [
                                        301022,
                                        301030,
                                        301022
                                ],
                                "ambush": true,
                                "winEventId": "water_temple_clear"
                        }
                ],
                "winActions": []
        },
        "water_temple_clear": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "SEABED_TEMPLE_CLEAR"
                        },
                        {
                                "type": "ALLY",
                                "value": 104
                        },
                        {
                                "type": "ITEM",
                                "id": 108,
                                "count": 1
                        },
                        {
                                "type": "UNLOCK",
                                "value": "boat"
                        },
                        {
                                "type": "FLAG",
                                "key": "hasShip"
                        },
                        {
                                "type": "FLAG",
                                "key": "waterCityCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 5
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "魔法の小舟を手に入れた。雷の要塞へ向かおう。"
                        }
                ],
                "winActions": []
        },
        "thunder_veld_forced_loss": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "THUNDER_VELD_OVERPOWER"
                        },
                        {
                                "type": "STORY_DEFEAT",
                                "log": "圧倒的な光の奔流に呑まれ、パーティは全滅した……。",
                                "normalWipeout": true
                        },
                        {
                                "type": "CONV",
                                "value": "THUNDER_VELD_LOSS"
                        },
                        {
                                "type": "ALLY",
                                "value": 101
                        },
                        {
                                "type": "FLAG",
                                "key": "thunderFortCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 6
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "結界を解くため、大灯台へ向かおう。"
                        }
                ],
                "winActions": []
        },
        "thunder_veld_loss": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "THUNDER_VELD_OVERPOWER"
                        },
                        {
                                "type": "STORY_DEFEAT",
                                "log": "圧倒的な光の奔流に呑まれ、パーティは全滅した……。",
                                "normalWipeout": true
                        },
                        {
                                "type": "CONV",
                                "value": "THUNDER_VELD_LOSS"
                        },
                        {
                                "type": "ALLY",
                                "value": 101
                        },
                        {
                                "type": "FLAG",
                                "key": "thunderFortCleared"
                        },
                        {
                                "type": "STEP",
                                "value": 6
                        },
                        {
                                "type": "SUB",
                                "value": 0
                        },
                        {
                                "type": "LOG",
                                "value": "ジョセフが同行した。大灯台へ向かおう。"
                        }
                ],
                "winActions": []
        },
        "thunder_fort_entry": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "THUNDER_FORT_ENTRY"
                        },
                        {
                                "type": "ALLY",
                                "value": 101
                        },
                        {
                                "type": "FLAG",
                                "key": "josephJoinedAtThunderFort"
                        },
                        {
                                "type": "START_FIXED_DUNGEON",
                                "value": "THUNDER_FORT"
                        }
                ],
                "winActions": []
        },
        "locked_wind_temple": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LOCKED_WIND_TEMPLE"
                        }
                ],
                "winActions": []
        },
        "locked_seabed_temple": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LOCKED_SEABED_TEMPLE"
                        }
                ],
                "winActions": []
        },
        "locked_thunder_fort": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LOCKED_THUNDER_FORT"
                        }
                ],
                "winActions": []
        },
        "locked_big_tower": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LOCKED_BIG_TOWER"
                        }
                ],
                "winActions": []
        },
        "locked_light_palace": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LOCKED_LIGHT_PALACE"
                        }
                ],
                "winActions": []
        },
        "locked_dark_castle": {
                "actions": [
                        {
                                "type": "CONV",
                                "value": "LOCKED_DARK_CASTLE"
                        }
                ],
                "winActions": []
        }
},

	// ==========================================
    // 4. イベント実行エンジン
    // ==========================================
    /**
     * 通常イベント実行
     * @param {string} eventId 
     * @param {boolean} isSubEvent 
     * @param {number} startActionIndex 命令の開始位置
     * @param {number} startLineIndex セリフの開始位置
     */
    executeEvent: async function(eventId, isSubEvent = false, startActionIndex = 0, startLineIndex = 0) {
        const data = App.data.progress;
        const event = this.events[eventId];
        if (!event || !event.actions) return;

        if (!isSubEvent && this.active) return;
        if (!isSubEvent) this.active = true;

        for (let i = startActionIndex; i < event.actions.length; i++) {
            if (!isSubEvent) {
                data.activeEvent = { eventId: eventId, actionIndex: i, phase: 'actions' };
                App.save();
            }
            // 初回ループ時のみ引数の startLineIndex を適用
            const lineIdx = (i === startActionIndex) ? startLineIndex : 0;
            const result = await this.processAction(event.actions[i], eventId, lineIdx);
            if (result === 'BREAK') return; 
        }
        
        if (!isSubEvent) {
            delete data.activeEvent;
            this.active = false;
            this.endConversation();
        }
        App.save();

        // イベント完了後も同じタイル上にいる場合は、現在地アクションを再評価する。
        // main.js 側の Field.refreshCurrentAction() が正本。
        // ここで呼ぶことで、会話・選択肢・ストーリー進行後にボタンが消えっぱなしになるのを防ぐ。
        if (!isSubEvent && typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
            Field.refreshCurrentAction({ silent: true });
        }
    },

    /**
     * 勝利後イベント実行
     */
    onBattleWin: async function(eventId, startActionIndex = 0, startLineIndex = 0) {
        const data = App.data.progress;
        const event = this.events[eventId];
        if (!event || !event.winActions) return;

        this.active = true;

        for (let i = startActionIndex; i < event.winActions.length; i++) {
            data.activeEvent = { eventId: eventId, actionIndex: i, phase: 'win' };
            App.save();

            const lineIdx = (i === startActionIndex) ? startLineIndex : 0;
            const result = await this.processAction(event.winActions[i], eventId, lineIdx);
            if (result === 'BREAK') return;
        }

        delete data.activeEvent;
        this.active = false;
        this.endConversation();
        App.save();

        // 戦闘勝利後イベントが終わってフィールドへ戻った際、現在地タイルのボタンを復元する。
        if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
            Field.refreshCurrentAction({ silent: true });
        }
    },

    /**
     * 会話イベント中にダンジョンへ遷移する前の後始末。
     * ここを通さないと StoryManager.active や activeConversation が保存に残り、
     * 遷移先で移動・メニュー操作が塞がれたままになる。
     */
    prepareMapTransfer: function() {
        const data = App?.data?.progress;
        if (data) {
            delete data.activeEvent;
            delete data.activeConversation;
        }
        this.isTyping = false;
        this.active = false;
        this.endConversation();
        if (typeof App !== 'undefined' && typeof App.save === 'function') App.save();
    },

    /**
     * ストーリー用の敗北演出。
     * 通常のゲームオーバー処理は呼ばず、暗転・全滅ログ・HP0表示を挟んでから、
     * 指定割合で復帰させて次の会話へ進める。
     */
    playStoryDefeatEffect: async function(action = {}) {
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const partyUids = Array.isArray(App.data?.party) ? App.data.party.filter(Boolean) : [];
        const targets = Array.isArray(App.data?.characters)
            ? App.data.characters.filter(c => c && partyUids.includes(c.uid))
            : [];

        let fade = document.getElementById('story-defeat-fade');
        if (!fade) {
            fade = document.createElement('div');
            fade.id = 'story-defeat-fade';
            fade.style.cssText = `
                position:absolute;
                inset:0;
                background:#000;
                opacity:0;
                pointer-events:none;
                z-index:2600;
                transition:opacity 420ms ease;
            `;
            (document.getElementById('game-container') || document.body).appendChild(fade);
        }

        await wait(30);
        fade.style.opacity = '1';
        await wait(480);

        if (action.log) App.log(action.log);
        else App.log('パーティは全滅した……。');
        if (App.data?.stats) App.data.stats.wipeoutCount = (App.data.stats.wipeoutCount || 0) + 1;

        // 通常全滅と同じ扱いにしたいイベント用。
        // HP1でダンジョンから強制脱出し、始まりの村前へ戻ってから後続会話を続ける。
        if (action.normalWipeout || action.useNormalWipeout) {
            targets.forEach(c => {
                c.currentHp = 1;
                delete c.battleStatus;
            });
            if (App.data) App.data.battle = { active: false };
            App.save();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();

            await wait(Number(action.downWait || 900));

            if (typeof Dungeon !== 'undefined' && typeof Dungeon.exit === 'function') {
                Dungeon.exit(true);
            } else if (typeof App !== 'undefined') {
                App.data.location.area = 'WORLD';
                App.data.location.x = 58;
                App.data.location.y = 65;
                if (typeof Field !== 'undefined') {
                    Field.currentMapData = null;
                    Field.x = 58;
                    Field.y = 65;
                }
                if (typeof App.changeScene === 'function') App.changeScene('field');
            }

            await wait(Number(action.fadeHold || 650));
            fade.style.opacity = '0';
            await wait(460);
            fade.remove();
            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
            if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') {
                Field.refreshCurrentAction({ silent: true });
            }
            return;
        }
		
        targets.forEach(c => {
            c.currentHp = 0;
            delete c.battleStatus;
        });
        App.save();
        if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();

        await wait(Number(action.downWait || 900));

        const hpRate = Math.max(0.01, Math.min(1, Number(action.recoverRate ?? 0.35)));
        const mpRate = Math.max(0, Math.min(1, Number(action.recoverMpRate ?? 0.25)));
        targets.forEach(c => {
            const stats = typeof App.calcStats === 'function' ? App.calcStats(c) : { maxHp: c.hp || 1, maxMp: c.mp || 0 };
            c.currentHp = Math.max(1, Math.floor((Number(stats.maxHp) || 1) * hpRate));
            c.currentMp = Math.max(Number(c.currentMp || 0), Math.floor((Number(stats.maxMp) || 0) * mpRate));
            delete c.battleStatus;
        });
        App.save();
        if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();

        await wait(Number(action.fadeHold || 450));
        fade.style.opacity = '0';
        await wait(460);
        fade.remove();
    },

    /**
     * 各アクションの個別処理
     * @param {Object} action 
     * @param {string} eventId 
     * @param {number} lineIndex 再開時のセリフ番号
     */
    processAction: async function(action, eventId, lineIndex = 0) {
        const data = App.data.progress;
        
        // CONV命令時に lineIndex を渡す
        if (action.type === 'CONV') await this.showConversation(action.value, lineIndex);
        
        if (action.type === 'ALLY') App.addStoryAlly(action.value);
        
        if (action.type === 'STEP') { 
            data.storyStep = action.value; 
            this.syncHeroLimitBreak(); 
            if (typeof Menu !== 'undefined') Menu.renderPartyBar();
        }

        if (action.type === 'TEMP_LB_START') {
            this.installTemporaryStoryPowerApi();
            if (typeof App.activateTemporaryStoryPower === 'function') {
                App.activateTemporaryStoryPower({
                    id: action.id || 'story_temp_power',
                    limitBreak: action.value ?? 99,
                    reason: eventId || 'story_event'
                });
            }
        }

        if (action.type === 'TEMP_LB_CLEAR') {
            this.installTemporaryStoryPowerApi();
            if (typeof App.clearTemporaryStoryPower === 'function') {
                App.clearTemporaryStoryPower({ id: action.id || null });
            }
            this.syncHeroLimitBreak();
            if (typeof Menu !== 'undefined') Menu.renderPartyBar();
        }
        
        if (action.type === 'HEAL') {
            App.data.characters.forEach(c => {
                const stats = App.calcStats(c);
                c.currentHp = stats.maxHp;
                c.currentMp = stats.maxMp;
            });
            App.save();
            if (typeof Menu !== 'undefined') Menu.renderPartyBar();
            App.log("不思議な力で体力が回復した！");
        }
        
        if (action.type === 'SUB')  { data.subStep = action.value; }
        if (action.type === 'LOG')   App.log(action.value);

        if (action.type === 'QUEST_ACCEPT' && typeof App.acceptQuest === 'function') {
            App.acceptQuest(action.value || action.questId);
        }

        if (action.type === 'QUEST_COMPLETE' && typeof App.completeQuest === 'function') {
            App.completeQuest(action.value || action.questId);
        }

        if (action.type === 'STORY_DEFEAT') {
            await this.playStoryDefeatEffect(action);
        }

        if (action.type === 'FLAG') {
            if (!data.flags) data.flags = {};
            const key = action.key || action.value;
            if (key) data.flags[key] = action.state !== undefined ? !!action.state : true;
            App.save();
        }

        if (action.type === 'UNLOCK') {
            const keys = Array.isArray(action.value) ? action.value : [action.value];
            keys.filter(Boolean).forEach(key => {
                if (typeof App.unlockFeature === 'function') App.unlockFeature(key);
                else {
                    if (!data.unlocked || typeof data.unlocked !== 'object' || Array.isArray(data.unlocked)) data.unlocked = {};
                    data.unlocked[key] = true;
                }
            });
            App.save();
        }

        if (action.type === 'ITEM') {
            const itemId = Number(action.id ?? action.value);
            const count = Math.max(1, Math.floor(Number(action.count) || 1));
            if (Number.isFinite(itemId)) {
                if (!App.data.items) App.data.items = {};
                App.data.items[itemId] = Number(App.data.items[itemId] || 0) + count;
                const item = (DB.ITEMS || []).find(i => Number(i.id) === itemId);
                App.log(`${item?.name || `アイテム${itemId}`}を手に入れた！`);
                App.save();
            }
        }
        
        if (action.type === 'EVENT') await this.executeEvent(action.value, true);

        if (action.type === 'START_FIXED_DUNGEON') {
            if (typeof Dungeon !== 'undefined' && typeof Dungeon.startFixed === 'function' && action.value) {
                this.prepareMapTransfer();
                Dungeon.startFixed(action.value);
                return 'BREAK';
            }
        }

        if (action.type === 'START_ABYSS_DUNGEON') {
            if (typeof Dungeon !== 'undefined' && typeof Dungeon.enter === 'function') {
                this.prepareMapTransfer();
                Dungeon.enter();
                return 'BREAK';
            }
        }

        if (action.type === 'IF_FLAG' || action.type === 'IF') {
            const key = action.key || action.flag || action.value;
            const expected = action.state !== undefined ? !!action.state : true;
            const actual = key ? !!(data.flags && data.flags[key]) : false;
            const branch = (actual === expected) ? action.then : (action.else || action.otherwise);
            if (Array.isArray(branch)) {
                for (const sub of branch) {
                    const res = await this.processAction(sub, eventId);
                    if (res === 'BREAK') return 'BREAK';
                }
            }
        }

        if (action.type === 'CHOICE') {
            const isYes = await this.showChoice(action.text);
            const branch = isYes ? action.yes : action.no;
            if (branch && branch.length > 0) {
                for (const sub of branch) {
                    const res = await this.processAction(sub, eventId);
                    if (res === 'BREAK') return 'BREAK';
                }
            }
        }
        
        if (action.type === 'MAP_CHANGE') {
            if (typeof MapRegistry !== 'undefined' && typeof MapRegistry.applyStoryMapMutation === 'function') {
                MapRegistry.applyStoryMapMutation(action.value || action.key);
            }
        }

        if (action.type === 'BOSS') {
            delete data.activeEvent;
            delete data.activeConversation;
            this.endConversation();
            this.active = false;
            this.isTyping = false;
            const fixedBossId = action.value !== undefined ? action.value : null;
            const ids = Array.isArray(fixedBossId) ? fixedBossId : [fixedBossId].filter(id => id !== null);
            const isSpecialBoss = ids.some(id => {
                const base = window.MonsterData?.getMonsterById?.(Number(id));
                return base?.isSpecialBoss || base?.isEstark || Number(id) === 902000;
            });

		const activeFixedBossContext = (App.data.progress?.activeFixedBossContext?.type === 'fixedBoss' &&
			typeof Field !== 'undefined' && Field.currentMapData?.isFixed)
			? App.data.progress.activeFixedBossContext
			: null;
		const actionFixedBossPosition = action.fixedBossPosition || action.position || null;
		const contextFixedBossPosition = activeFixedBossContext?.fixedBossPosition || null;
		const sourceFixedBossPosition = actionFixedBossPosition || contextFixedBossPosition;
		const fixedBossPosition = Number.isFinite(Number(sourceFixedBossPosition?.x)) && Number.isFinite(Number(sourceFixedBossPosition?.y))
			? { x: Number(sourceFixedBossPosition.x), y: Number(sourceFixedBossPosition.y) }
			: null;
		const rawKeyRewardColors = Array.isArray(action.keyRewardColors)
			? action.keyRewardColors
			: action.keyRewardColor
				? [action.keyRewardColor]
				: action.keyColor
					? [action.keyColor]
					: [];

		const keyRewardColors = rawKeyRewardColors.filter(Boolean);
		const contextKeyReward = activeFixedBossContext?.fixedKeyReward || null;
		const fixedKeyReward = keyRewardColors.length > 0 ? {
			colors: keyRewardColors,
			color: keyRewardColors[0], // 既存処理互換用
			x: fixedBossPosition?.x ?? ((typeof Field !== 'undefined') ? Field.x : null),
			y: fixedBossPosition?.y ?? ((typeof Field !== 'undefined') ? Field.y : null),
			scopeKey: (typeof Dungeon !== 'undefined' && typeof Dungeon.getKeyScopeKey === 'function')
				? Dungeon.getKeyScopeKey()
				: null
		} : (contextKeyReward ? { ...contextKeyReward } : null);

		App.data.battle = {
			active: false,
			isBossBattle: true,
			fixedBossId: fixedBossId,
			fixedBossPosition: fixedBossPosition,
			fixedBossProgressKey: action.fixedBossProgressKey || action.progressKey || activeFixedBossContext?.progressKey || null,
			fixedQuestId: action.fixedQuestId || activeFixedBossContext?.fixedQuestId || null,
			bossStatMultiplier: action.bossStatMultiplier || action.bossScale || activeFixedBossContext?.bossStatMultiplier || null,
			isSpecialBoss: isSpecialBoss,
			isEstark: isSpecialBoss,
			suppressFixedBossDefeat: !!(action.suppressFixedBossDefeat || action.deferFixedBossDefeat || action.markFixedBossDefeated === false),
			eventId: eventId,
			fixedKeyReward: fixedKeyReward,
			isAmbushed: !!action.ambush,
			storyWinEventId: action.winEventId || null,
			storyLossEventId: action.lossEventId || null
		};
            App.save(); 
            const startBattleScene = () => App.changeScene('battle');
            if (typeof App.playEncounterTransition === 'function') {
                if (typeof App.lockFieldInput === 'function') App.lockFieldInput(1800);
                App.playEncounterTransition(startBattleScene, { eventBattle: true });
            } else {
                startBattleScene();
            }
            return 'BREAK'; 
        }
    },
	
	// ==========================================
    // 5. UI制御ロジック (選択肢対応版)
    // ==========================================
    
    /**
     * はい/いいえの選択肢を表示します
     */
    dismissChoiceUI: function(options = {}) {
        const menu = document.getElementById('story-choice-area');
        if (menu) menu.remove();
        const indicator = document.getElementById('story-next-indicator');
        if (indicator) indicator.style.visibility = 'visible';
        if (options.hideOverlay !== false) {
            const overlay = document.getElementById('story-ui-overlay');
            if (overlay) overlay.style.display = 'none';
        }
    },

    prepareBattleTransitionUI: function() {
        this.dismissChoiceUI({ hideOverlay: true });
        const backlog = document.getElementById('backlog-overlay');
        if (backlog) backlog.remove();
        this.isTyping = false;
    },

    showChoice: function(text) {
        return new Promise((resolve) => {
            this.dismissChoiceUI({ hideOverlay: false });
            const overlay = document.getElementById('story-ui-overlay') || this.createStoryDOM();
            overlay.style.display = 'flex';
            const choiceName = document.getElementById('story-name');
            const choiceText = document.getElementById('story-text');
            choiceName.style.display = 'block';
            choiceName.innerText = "選択";
            choiceText.innerText = text;
            const choiceWindow = choiceText.parentElement;
            if (choiceWindow?.dataset?.defaultStyle) choiceWindow.style.cssText = choiceWindow.dataset.defaultStyle;
			
			// ★修正: visibilityで制御することでshowConversationとの競合を回避
            document.getElementById('story-next-indicator').style.visibility = 'hidden';
			
            const box = document.getElementById('story-text').parentElement;
            const menu = document.createElement('div');
            menu.id = "story-choice-area";
            menu.style.cssText = "display:flex; gap:20px; margin-top:15px; justify-content:center;";
            
            const btnStyle = "padding:10px 30px; background:#000044; border:1px solid #ffd700; color:#ffd700; cursor:pointer; font-weight:bold; border-radius:4px;";
            menu.innerHTML = `<button style="${btnStyle}" class="no-skip">はい</button><button style="${btnStyle}" class="no-skip">いいえ</button>`;
            
            menu.children[0].onclick = (e) => {
                e.stopPropagation();
                this.dismissChoiceUI({ hideOverlay: true });
                resolve(true);
            };
            menu.children[1].onclick = (e) => {
                e.stopPropagation();
                this.dismissChoiceUI({ hideOverlay: true });
                resolve(false);
            };
            box.appendChild(menu);
        });
    },

    /**
     * 会話の表示
     */
    showConversation: async function(scriptKey, startFromIndex = 0) {
        const lines = this.scripts[scriptKey];
        if (!lines) return;
        
        // すでに会話中の場合は重複して動かさない
        if (this.isTyping) return;
        this.isTyping = true;

        let overlay = document.getElementById('story-ui-overlay') || this.createStoryDOM();
        overlay.style.display = 'flex';
        
        const portraitImg = document.getElementById('story-portrait');
        const nameBox = document.getElementById('story-name');
        const textBox = document.getElementById('story-text');
        const nextIndicator = document.getElementById('story-next-indicator');
        const textWindow = textBox ? textBox.parentElement : null;
        if (textWindow && !textWindow.dataset.defaultStyle) {
            textWindow.dataset.defaultStyle = textWindow.getAttribute('style') || '';
        }

        for (let i = startFromIndex; i < lines.length; i++) {
            const line = lines[i];

            // 現在のセリフ番号を保存
            if (App.data) {
                App.data.progress.activeConversation = { key: scriptKey, index: i };
                App.save();
            }

            const isSystemLine = line.name === 'システム' && !line.charId;
            const masterChar = DB.CHARACTERS.find(c => c.id === line.charId);
            const savedChar = App.data.characters.find(c => c.charId === line.charId);
            let displayName = isSystemLine ? '' : (savedChar ? savedChar.name : (masterChar ? masterChar.name : line.name));
            let displayImg = isSystemLine ? '' : (savedChar?.img || masterChar?.img);

            if (textWindow) {
                if (isSystemLine) {
                    textWindow.style.cssText = `
                        position: absolute;
                        top: 45%;
                        left: 20px;
                        right: 20px;
                        background: rgba(0,0,0,0.72);
                        border: none;
                        border-radius: 2px;
                        padding: 16px;
                        box-sizing: border-box;
                        min-height: 96px;
                        max-height: 280px;
                        overflow-y: auto;
                        box-shadow: none;
                        z-index: 10;
                    `;
                } else if (textWindow.dataset.defaultStyle) {
                    textWindow.style.cssText = textWindow.dataset.defaultStyle;
                }
            }
            nameBox.style.display = isSystemLine ? 'none' : 'block';

            let processedText = line.text.replace(/\[N:(\d+)\]/g, (match, id) => {
                const targetId = parseInt(id);
                const saved = App.data.characters.find(c => c.charId === targetId);
                const master = DB.CHARACTERS.find(c => c.id === targetId);
                return (saved ? saved.name : (master ? master.name : `ID:${id}`));
            }).replace(/\\n/g, '\n');

            this.backlog.push({ name: displayName, text: processedText.replace(/\n/g, " ") });

            portraitImg.src = displayImg || "";
            portraitImg.style.display = displayImg ? 'block' : 'none';
            nameBox.innerText = displayName;
            nextIndicator.style.visibility = 'hidden';

            let isTyping = true, skipTyping = false;
            overlay.onclick = (e) => { if (!e.target.closest('.no-skip') && isTyping) skipTyping = true; };

            textBox.innerHTML = "";
            const chars = processedText.split("");
            for (let j = 0; j < chars.length; j++) {
                if (skipTyping) { textBox.innerHTML = processedText.replace(/\n/g, "<br>"); break; }
                let char = chars[j];
                textBox.innerHTML += (char === "\n" ? "<br>" : char);
                await new Promise(r => setTimeout(r, char === "\n" ? this.newlineWait : this.textSpeed));
            }
            isTyping = false;
            nextIndicator.style.visibility = 'visible';
            await new Promise(resolve => { overlay.onclick = (e) => { if (!e.target.closest('.no-skip')) resolve(); }; });
        }
        
        if (App.data) { delete App.data.progress.activeConversation; App.save(); }
		this.isTyping = false;
        // showConversation 自体では閉じず、executeEvent 側の endConversation に任せる
    },

    /**
     * 会話UIを終了して隠す
     */
    endConversation: function() {
        this.dismissChoiceUI({ hideOverlay: false });
        const overlay = document.getElementById('story-ui-overlay');
        if (overlay) overlay.style.display = 'none';
        this.active = false;
        if (this.onComplete) {
            const cb = this.onComplete;
            this.onComplete = null;
            cb();
        }
    },

    /**
     * 会話ログ画面を表示する (復旧：オーバーレイ形式)
     */
    showBacklog: function() {
        // 既存のオーバーレイがあれば削除
        const old = document.getElementById('backlog-overlay');
        if (old) old.remove();

        const div = document.createElement('div');
        div.id = 'backlog-overlay';
        div.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,20,0.95); z-index: 3000;
            display: flex; flex-direction: column; color: #fff; font-family: sans-serif;
        `;

        const list = this.backlog.map(b => `
            <div style="padding: 10px; border-bottom: 1px solid #333;">
                <div style="color: #ffd700; font-weight: bold; font-size: 12px;">${b.name}</div>
                <div style="font-size: 14px; margin-top: 4px;">${b.text}</div>
            </div>
        `).join('');

        div.innerHTML = `
            <div style="padding: 15px; background: #111; border-bottom: 2px solid #ffd700; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; color:#ffd700;">会話ログ</span>
                <button onclick="document.getElementById('backlog-overlay').remove()" style="background:#444; color:#fff; border:none; padding:5px 15px; border-radius:4px; cursor:pointer;">閉じる</button>
            </div>
            <div style="flex:1; overflow-y:auto; padding: 10px;">
                ${list || '<div style="text-align:center; color:#555; margin-top:50px;">会話履歴はありません。</div>'}
            </div>
        `;
        document.body.appendChild(div);
    },
	
	// ==========================================
    // 6. UI構造の生成 (背面立ち絵・50%位置維持)
    // ==========================================
    createStoryDOM: function() {
        // 重複生成を完全に防止
        let div = document.getElementById('story-ui-overlay');
        if (div) return div;

		div = document.createElement('div');
		div.id = 'story-ui-overlay';
		
		// ==========================================
		// 1. 画面全体を覆うベースレイヤーの設定
		// ==========================================
		div.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.4); /* 背景の暗さ(0.0〜1.0) */
			z-index: 2000;                  /* 他のUIより手前に表示 */
			display: none;                  /* 初期状態は非表示 */
			flex-direction: column;
			justify-content: flex-start;    /* 配置の基準を上端にする */
			cursor: pointer;
			font-family: sans-serif;

			/* モバイル向け最適化 */
			-webkit-tap-highlight-color: transparent; /* タップ時の青い枠を消す */
			user-select: none;                         /* テキスト選択を禁止 */
			touch-action: manipulation;                /* ダブルタップズーム防止 */
		`;

		div.innerHTML = `
			<button class="no-skip" onclick="StoryManager.showBacklog()" style="
				position: absolute; 
				top: 20px; 
				right: 20px; 
				z-index: 2100;
				background: rgba(0,0,30,0.8); 
				border: 1px solid #ffd700; 
				color: #ffd700;
				padding: 8px 15px; 
				border-radius: 4px; 
				font-weight: bold; 
				cursor: pointer;
				font-size: 12px; 
				box-shadow: 0 2px 10px rgba(0,0,0,0.5);
			">LOG</button>

			<div class="story-ui-stage" style="
				position: relative;
				width: 100%;
				height: 100%;
				box-sizing: border-box;
			">
				
				<div class="story-portrait-frame" style="
					position: absolute;
					top: 45%;         /* 画面の中央（50%）を起点とする */
					left: 40px;       /* 画面左端からの距離 */
					width: 150px;     /* キャラ画像の最大幅 */
					height: 200px;    /* 画像エリアの高さ */
					display: flex;
					align-items: flex-end; 
					transform: translateY(-100%); /* 起点(50%)から「上」に向かって画像を表示 */
					z-index: 5;       /* 吹き出し(z-index:10)より背面に配置 */
				">
					<img id="story-portrait" style="
						max-width: 100%;
						max-height: 100%;
						object-fit: contain;
						filter: drop-shadow(0 0 10px rgba(0,0,0,0.8));
					">
				</div>
				
				<div class="story-text-window" style="
					position: absolute;
					top: 45%;                  /* 吹き出しの上端を画面の50%位置に設定 */
					left: 20px;
					right: 20px;
					background: rgba(0,0,30,0.95); 
					border: 2px solid #ffd700; 
					border-radius: 8px;           
					padding: 15px;
					box-sizing: border-box;
					min-height: 110px;            
					max-height: 300px;            
					overflow-y: auto;             
					box-shadow: 0 4px 15px rgba(0,0,0,0.5); 
					z-index: 10;               /* キャラ画像より前面に表示 */
				">
					<div id="story-name" style="
						color: #ffd700;
						font-weight: bold;
						font-size: 14px;
						margin-bottom: 8px;
						border-bottom: 1px solid #444;
						padding-bottom: 4px;
					"></div>

					<div id="story-text" style="
						color: #fff;
						font-size: 13px;
						line-height: 1.6;
						letter-spacing: 0.5px;
					"></div>

					<div id="story-next-indicator" style="
						text-align: center;
						color: #ffd700;
						font-size: 10px;
						margin-top: 5px;
						animation: none;
					">▼</div>
				</div>
			</div>
`;

		(document.getElementById('game-container') || document.body).appendChild(div);
		return div;
	}
};
