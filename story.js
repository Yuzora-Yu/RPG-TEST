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
    // 体験版などで現在のメインストーリー上限に到達した場合は、
    // 下の dungeonObjectiveMilestones に従ってダンジョン目標へ自動で切り替える。
    maxMainStoryProgress: { storyStep: 10, subStep: 0 },

    storyObjectives: {
        "0-0": "村に不穏な気配が漂っている…",
        "0-1": "まもののむれを討伐した！",
        "0-2": "村の奥の長老に話を聞こう！",
        "1-0": "村の奥の長老に話を聞こう！",
        "1-1": "北東の洞窟へ向かおう！",
        "1-2": "洞窟の奥へ進もう！",
        "2-0": "長老に報告しよう！！",
        "2-1": "東の果て「炎の里」へ向かおう！！",
        "3-0": "風の集落へ向かい、封鎖された祈りの場を調べよう。",
        "4-0": "水上都市へ向かい、海を渡る手段を探そう。",
        "5-0": "深淵の入口を調べ、探索機能を解放しよう。",
        "6-0": "大塔の頂を目指し、空を塞ぐ結界を破ろう。",
        "7-0": "雷の要塞を攻略し、メダル王への道を開こう。",
        "8-0": "光の宮殿を攻略し、魔王城へ向かう準備を整えよう。",
        "9-0": "魔王城の最奥へ進み、シャニーを救い出そう。",
        "10-0": "メインストーリークリア。深淵や育成をさらに進めよう。"
    },

    dungeonObjectiveMilestones: [
        { floor: 11, text: "ﾀﾞﾝｼﾞｮﾝ10階を目指そう！" },
        { floor: 51, text: "ﾀﾞﾝｼﾞｮﾝ50階を目指そう！" },
        { floor: 101, text: "ﾀﾞﾝｼﾞｮﾝ100階を目指そう！" },
        { floor: 151, text: "ﾀﾞﾝｼﾞｮﾝ150階を目指そう！" },
        { floor: 201, text: "ﾀﾞﾝｼﾞｮﾝ200階を目指そう！" }
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
            return "ﾒﾆｭｰからﾀﾞﾝｼﾞｮﾝに挑戦しよう";
        }

        for (const milestone of this.dungeonObjectiveMilestones) {
            if (maxFloor < milestone.floor) return milestone.text;
        }

        const killCounts = data?.book?.killCounts || {};
        const calamityKills = Number(killCounts[902000] || 0) + Number(killCounts[2000] || 0);
        if (calamityKills <= 0) {
            return "メダルを集めて災厄に挑もう";
        }

        return "ﾀﾞﾝｼﾞｮﾝで最強装備をそろえよう";
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
        { "charId": 1000, "name": "", "text": "……夜明け前。\n村には、不吉な気配が満ちていた。" },
        { "charId": 301,  "name": "アルス", "text": "嫌な予感がする……。急ごう。" },
        { "charId": 1003, "name": "村人", "text": "きゃあああっ！！" },
        { "charId": 1000, "name": "", "text": "子供が魔物に襲われている！" }
	],
    "BATTLE_RETRY_TALK": [
        { "charId": 9999, "name": "？？？？", "text": "[N:301]よ、まだ倒れてはなりません。\n私に残された最後の権能をもって、今一度、深淵を打ち倒す力を授けます…" },
        { "charId": 1000, "name": "", "text": "不思議なちからで体力が全回復し、秘められた力が開放された！！" }
    ],
	"GAME_START_2": [
        { "charId": 1001, "name": "長老", "text": "おお……！助かった……。\n子ども達を救ってくださり、本当にありがとうございます。" },
        { "charId": 1001, "name": "長老", "text": "……その腕前、ただ者ではありますまい。\nお願いがあるのです。村の奥の家まで来てくだされ。" },
        { "charId": 1000, "name": "", "text": "こうして、深淵との長い戦いが始まった——。" }
	],
    "PROLOGUE": [
        {
            "charId": 1001,
            "name": "長老",
            "text": "おお、[N:301]様。\n子ども達を救ってくださりありがとうございます。\nお噂はかねがね聞いております。"
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
        {
            "charId": 301,
            "name": "アルス",
            "text": "混沌から生まれし者かもしれません。\n必ずうち滅ぼします。"
        },
        {
            "charId": 1001,
            "name": "長老",
            "text": "化け物は村北東の大穴の奥に…\nよろしくお願い申し上げる。"
        },
        {
            "charId": 1000,
            "name": "システム",
            "text": "村のガイルとサラが仲間に加わった！"
        }
    ],
    "PROLOGUE2": [
        {
            "charId": 1001,
            "name": "長老",
            "text": "化け物は村北東の大穴の奥に…\nよろしくお願い申し上げる。"
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
            "text": "マジで、あの化け物と戦いにいくのか…？\nって、[N:109]と[N:110]までついてきたのか！？"
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
            "charId": 301,
            "name": "",
            "text": "お任せください。深淵から生まれし魔物たちは、一匹も通しません。"
        },
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
            "text": "なんと、もうあの化け物を討伐してくださったとは！\n噂に違わぬ力ですな、[N:301]様。"
        },
        {
            "charId": 1001,
            "name": "長老",
            "text": "世界の各地で、同じように異変が起きているとのこと。\n東の果て、炎の里では突如火が消えてしまい、鍛冶が出来なくなったと聞きましたぞ。"
        },
        {
            "charId": 109,
            "name": "",
            "text": "[N:301]さま！助けに行こう！！\n炎の里で鍛冶ができなくなったら、もう誰も武器が持てなくなっちまうよ。"
        },
        {
            "charId": 110,
            "name": "",
            "text": "まったくもう、[N:109]ったら…\nすみません、[N:301]様。村を救ってもらったばかりでこんなこと…"
        },
        {
            "charId": 109,
            "name": "",
            "text": "だって、放っておけねえよ！\nこの村だって、あと一歩でボロボロになるとこだったんだ。\n世界がおかしくなってんなら、俺は助けに行きたい。"
        },
        {
            "charId": 110,
            "name": "",
            "text": "それは…そうだけど…"
        },
        {
            "charId": 301,
            "name": "",
            "text": "そうだな。\n[N:109]、[N:110]。長い旅になるが、ついてきてくれるか？"
        },
        {
            "charId": 109,
            "name": "",
            "text": "もちろんだ！\n俺が道を切り開くから、頼りにしてくれよな。"
        },
        {
            "charId": 110,
            "name": "",
            "text": "簡単な治療しかできませんが…\nあの、よろしくお願いします。"
        },
        {
            "charId": 1000,
            "name": "",
            "text": "ガイルとサラが、正式に仲間に加わった！"
        },
        {
            "charId": 1000,
            "name": "",
            "text": "※体験版のストーリーはここまでです。\nここからは、メニューの「ダンジョン」から挑戦できる自動生成ダンジョンをお楽しみください。"
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
        { "charId": 105, "name": "シャオ", "text": "炎の里は、強さだけを信じて空回りしていた。けれど、あなたの戦い方は違った。守るために進む拳だった。" },
        { "charId": 105, "name": "シャオ", "text": "私も行く。奪われた熱を取り戻すために。そして、妹の影を追うために。" },
        { "charId": 1000, "name": "", "text": "シャオが仲間に加わった。炎の里の鍛冶場が再び火を入れ、鍛冶屋が利用可能になった。" }
    ],
    "STORY_WIND_CLEAR": [
        { "charId": 106, "name": "エリーゼ", "text": "この集落に残っていたのは、風の音ではなく、罪悪感でした。私はそれを歌でごまかしていたのかもしれません。" },
        { "charId": 106, "name": "エリーゼ", "text": "でも、もう逃げません。あなたが進むなら、私は風を道に変えます。" },
        { "charId": 1000, "name": "", "text": "エリーゼが仲間に加わった。風の集落の封鎖が解け、次の海路へ向かう手がかりを得た。" }
    ],
    "STORY_WATER_CLEAR": [
        { "charId": 104, "name": "ケイト", "text": "水上都市の潮は、ずっと迷っていました。生きるために閉じるのか、未来のために漕ぎ出すのか。" },
        { "charId": 104, "name": "ケイト", "text": "答えは出ました。小舟を用意します。私も同行します。海を渡り、雷の要塞へ。" },
        { "charId": 1000, "name": "", "text": "ケイトが仲間に加わった。魔法の小舟を入手し、カジノが利用可能になった。" }
    ],
    "STORY_ABYSS_UNSEALED": [
        { "charId": 110, "name": "サラ", "text": "深淵の入口から、祈りを拒むような冷たい気配が流れています。ここから先は、ただの冒険ではありません。" },
        { "charId": 109, "name": "ガイル", "text": "それでも行くんだろ。だったら俺たちも腹を決める。深淵の底に何があっても、背中は任せろ。" },
        { "charId": 1000, "name": "", "text": "深淵探索機能が解放された。固定ダンジョン攻略と並行して、深淵の調査を進められるようになった。" }
    ],
    "STORY_BIG_TOWER_CLEAR": [
        { "charId": 1000, "name": "", "text": "大塔の頂で、空を塞いでいた結界が砕けた。遠く雷鳴が響き、次の脅威が姿を見せる。" },
        { "charId": 106, "name": "エリーゼ", "text": "風が雷の要塞を指しています。怖いほどまっすぐに。" },
        { "charId": 1000, "name": "", "text": "雷の要塞への進行フラグが立った。" }
    ],
    "STORY_THUNDER_CLEAR": [
        { "charId": 101, "name": "ジョセフ", "text": "勝てば誇れると思っていた。だが、雷の檻に閉じこもっていたのは俺の方だったらしい。" },
        { "charId": 101, "name": "ジョセフ", "text": "借りは返す。メダル王の門は開けておく。俺も、この先を見届けさせてもらう。" },
        { "charId": 1000, "name": "", "text": "ジョセフが仲間に加わった。メダル王が利用可能になった。" }
    ],
    "STORY_LIGHT_CLEAR": [
        { "charId": 204, "name": "レイラ", "text": "光は、正しさを証明するためだけのものではありません。迷う人を見失わないための灯でもあります。" },
        { "charId": 204, "name": "レイラ", "text": "魔王城へ向かうなら、私も参ります。あなたの剣が、裁きではなく救いに届くように。" },
        { "charId": 1000, "name": "", "text": "レイラが仲間に加わった。魔王城への決戦準備が整った。" }
    ],
    "STORY_DARK_CLEAR": [
        { "charId": 306, "name": "シャニー", "text": "私は命令で立っていた。けれど、あなたたちは私を敵としてではなく、人として呼び戻した。" },
        { "charId": 105, "name": "シャオ", "text": "帰ろう、シャニー。今度は私たちの足で。" },
        { "charId": 306, "name": "シャニー", "text": "はい。罪は消えません。それでも、守るために歩くことを選びます。" },
        { "charId": 1000, "name": "", "text": "シャニーが仲間に加わった。魔王城攻略によりガチャ機能が解放され、メインストーリーは一つの区切りを迎えた。" }
    ]
	},

	// ==========================================
    // 2. 出現条件 (triggers) - 範囲指定対応
    // ==========================================
    triggers: [
    {
        "area": "START_VILLAGE",
        "x": 6,
        "y": 3,
        "stepMin": 0, "stepMax": 0,
        "subMin": 0, "subMax": 99,
        "eventId": "start_adventure"
    },
    {
        "area": "START_VILLAGE",
        "x": 6,
        "y": 3,
        "stepMin": 1, "stepMax": 1,
        "subMin": 0, "subMax": 0,
        "eventId": "start_adventure2"
    },
    {
        "area": "START_VILLAGE",
        "x": 6,
        "y": 3,
        "stepMin": 1, "stepMax": 1,
        "subMin": 1, "subMax": 99,
        "eventId": "start_adventure2"
    },
    {
        "area": "START_CAVE",
        "x": 10,
        "y": 11,
        "stepMin": 0, "stepMax": 0,
        "subMin": 0, "subMax": 99,
        "eventId": "start_cave1"
    },
    {
        "area": "START_CAVE",
        "x": 10,
        "y": 11,
        "stepMin": 1, "stepMax": 1,
        "subMin": 1, "subMax": 1,
        "eventId": "start_cave2"
    },
    {
        "area": "START_VILLAGE",
        "x": 6,
        "y": 3,
        "stepMin": 2, "stepMax": 2,
        "subMin": 0, "subMax": 1,
        "eventId": "start_adventure3"
    },
    {
        "area": "START_CAVE",
        "x": 1,
        "y": 1,
        "stepMin": 1, "stepMax": 1,
        "subMin": 0, "subMax": 99,
        "eventId": "start_boss_battle"
    },
    {
        "area": "FIRE_VILLAGE",
        "x": 14,
        "y": 17,
        "stepMin": 2, "stepMax": 2,
        "subMin": 0, "subMax": 99,
        "eventId": "fire_village_clear"
    },
    {
        "area": "WIND_VILLAGE",
        "x": 14,
        "y": 15,
        "stepMin": 3, "stepMax": 3,
        "subMin": 0, "subMax": 99,
        "eventId": "wind_village_clear"
    },
    {
        "area": "WATER_CITY",
        "x": 19,
        "y": 13,
        "stepMin": 4, "stepMax": 4,
        "subMin": 0, "subMax": 99,
        "eventId": "water_city_clear"
    },
    {
        "area": "ABYSS_FIELD",
        "x": 8,
        "y": 7,
        "stepMin": 5, "stepMax": 5,
        "subMin": 0, "subMax": 99,
        "eventId": "abyss_unsealed"
    }
],

    events: {
	"game_start": {
        "actions": [
		{ "type": "CONV", "value": "GAME_START_1" },

		// 戦闘呼び出し（ID1を2体）
		{ "type": "BOSS", "value": [100001, 100001] }
        ],
        "winActions": [
		// 戦闘終了後、次の会話
		{ "type": "STEP", "value": 0 },
        { "type": "SUB", "value": 1 },
		{ "type": "HEAL" },
		{ "type": "CONV", "value": "GAME_START_2" },
        { "type": "SUB", "value": 2 }

		// ※イベント終了（winActionsが終われば endConversation() される）
        ]
	},
	"game_start_retry": {
        "actions": [
            { "type": "CONV", "value": "BATTLE_RETRY_TALK" },
            { "type": "TEMP_LB_START", "value": 99, "id": "game_start_retry_lb99" },
            { "type": "HEAL" },
            { "type": "BOSS", "value": [100001, 100001] }
        ],
        "winActions": [
            { "type": "TEMP_LB_CLEAR", "id": "game_start_retry_lb99" },
            { "type": "STEP", "value": 0 },
            { "type": "SUB", "value": 1 },
            { "type": "HEAL" },
            { "type": "CONV", "value": "GAME_START_2" },
            { "type": "SUB", "value": 2 },
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
				"type": "SUB",
				"value": 1
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
                "text": "ボスを倒しにいきますか？",
                "yes": [
				{
					"type": "CONV",
					"value": "START_CAVE3"
				},
				{
					"type": "TILE",
					"area": "START_CAVE",
					"x": 10,
					"y": 11,
					"tile": "G"
				},
				{
					"type": "TILE",
					"area": "START_CAVE",
					"x": 11,
					"y": 11,
					"tile": "G"
				},
				{
					"type": "SUB",
					"value": 2
				}
                ],
                "no": [
                    { "type": "LOG", "value": "準備ができたらもう一度話しかけよう" }
                ]
            }
        ],
        "winActions": []
    },
    "start_boss_battle": {
        "actions": [
            {
                "type": "LOG",
                "value": "巨大な化け物が立ちはだかる…！"
            },
            {
                "type": "BOSS",
                "value": 301000
            }
        ],
        "winActions": [
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
        ]
    },
    "fire_village_clear": {
        "actions": [
            { "type": "CONV", "value": "STORY_FIRE_CLEAR" },
            { "type": "ALLY", "value": 105 },
            { "type": "UNLOCK", "value": "smith" },
            { "type": "FLAG", "key": "fireVillageCleared" },
            { "type": "STEP", "value": 3 },
            { "type": "SUB", "value": 0 },
            { "type": "LOG", "value": "炎の里を解放した。" }
        ],
        "winActions": []
    },
    "wind_village_clear": {
        "actions": [
            { "type": "CONV", "value": "STORY_WIND_CLEAR" },
            { "type": "ALLY", "value": 106 },
            { "type": "FLAG", "key": "windVillageCleared" },
            { "type": "STEP", "value": 4 },
            { "type": "SUB", "value": 0 },
            { "type": "LOG", "value": "風の集落を解放した。" }
        ],
        "winActions": []
    },
    "water_city_clear": {
        "actions": [
            { "type": "CONV", "value": "STORY_WATER_CLEAR" },
            { "type": "ALLY", "value": 104 },
            { "type": "ITEM", "id": 108, "count": 1 },
            { "type": "UNLOCK", "value": ["boat", "casino"] },
            { "type": "FLAG", "key": "hasShip" },
            { "type": "FLAG", "key": "waterCityCleared" },
            { "type": "STEP", "value": 5 },
            { "type": "SUB", "value": 0 },
            { "type": "LOG", "value": "魔法の小舟とカジノ利用権を得た。" }
        ],
        "winActions": []
    },
    "abyss_unsealed": {
        "actions": [
            { "type": "CONV", "value": "STORY_ABYSS_UNSEALED" },
            { "type": "UNLOCK", "value": "abyss" },
            { "type": "FLAG", "key": "abyssOuterReached" },
            { "type": "STEP", "value": 6 },
            { "type": "SUB", "value": 0 },
            { "type": "LOG", "value": "深淵探索が解放された。" }
        ],
        "winActions": []
    },
    "big_tower_clear": {
        "actions": [
            { "type": "CONV", "value": "STORY_BIG_TOWER_CLEAR" },
            { "type": "FLAG", "key": "bigTowerCleared" },
            { "type": "STEP", "value": 7 },
            { "type": "SUB", "value": 0 },
            { "type": "LOG", "value": "大塔の結界を破った。" }
        ],
        "winActions": []
    },
    "thunder_fort_clear": {
        "actions": [
            { "type": "CONV", "value": "STORY_THUNDER_CLEAR" },
            { "type": "ALLY", "value": 101 },
            { "type": "UNLOCK", "value": "medalKing" },
            { "type": "FLAG", "key": "thunderFortCleared" },
            { "type": "STEP", "value": 8 },
            { "type": "SUB", "value": 0 },
            { "type": "LOG", "value": "雷の要塞を攻略し、メダル王が解放された。" }
        ],
        "winActions": []
    },
    "light_palace_clear": {
        "actions": [
            { "type": "CONV", "value": "STORY_LIGHT_CLEAR" },
            { "type": "ALLY", "value": 204 },
            { "type": "FLAG", "key": "lightPalaceCleared" },
            { "type": "STEP", "value": 9 },
            { "type": "SUB", "value": 0 },
            { "type": "LOG", "value": "光の宮殿を攻略した。" }
        ],
        "winActions": []
    },
    "dark_castle_clear": {
        "actions": [
            { "type": "CONV", "value": "STORY_DARK_CLEAR" },
            { "type": "ALLY", "value": 306 },
            { "type": "UNLOCK", "value": "gacha" },
            { "type": "FLAG", "key": "darkCastleCleared" },
            { "type": "FLAG", "key": "mainStoryCleared" },
            { "type": "STEP", "value": 10 },
            { "type": "SUB", "value": 0 },
            { "type": "LOG", "value": "メインストーリーをクリアした。" }
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
        
        if (action.type === 'TILE') {
            const targetArea = action.area || App.data.location.area;
            if (!data.mapChanges) data.mapChanges = {};
            if (!data.mapChanges[targetArea]) data.mapChanges[targetArea] = {};
            data.mapChanges[targetArea][`${action.x},${action.y}`] = action.tile;
            if (typeof Field !== 'undefined' && Field.ready) Field.render();
        }

        if (action.type === 'BOSS') {
            delete data.activeEvent;
            delete data.activeConversation;
            this.endConversation();
            const fixedBossId = action.value !== undefined ? action.value : null;
            const ids = Array.isArray(fixedBossId) ? fixedBossId : [fixedBossId].filter(id => id !== null);
            const isSpecialBoss = ids.some(id => {
                const base = window.MonsterData?.getMonsterById?.(Number(id));
                return base?.isSpecialBoss || base?.isEstark || Number(id) === 902000;
            });
            App.data.battle = { active: false, isBossBattle: true, fixedBossId: fixedBossId, isSpecialBoss: isSpecialBoss, isEstark: isSpecialBoss, eventId: eventId };
            App.save(); 
            App.changeScene('battle');
            return 'BREAK'; 
        }
    },
	
	// ==========================================
    // 5. UI制御ロジック (選択肢対応版)
    // ==========================================
    
    /**
     * はい/いいえの選択肢を表示します
     */
    showChoice: function(text) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('story-ui-overlay') || this.createStoryDOM();
            overlay.style.display = 'flex';
            document.getElementById('story-name').innerText = "選択";
            document.getElementById('story-text').innerText = text;
			
			// ★修正: visibilityで制御することでshowConversationとの競合を回避
            document.getElementById('story-next-indicator').style.visibility = 'hidden';
			
            const box = document.getElementById('story-text').parentElement;
            const menu = document.createElement('div');
            menu.id = "story-choice-area";
            menu.style.cssText = "display:flex; gap:20px; margin-top:15px; justify-content:center;";
            
            const btnStyle = "padding:10px 30px; background:#000044; border:1px solid #ffd700; color:#ffd700; cursor:pointer; font-weight:bold; border-radius:4px;";
            menu.innerHTML = `<button style="${btnStyle}" class="no-skip">はい</button><button style="${btnStyle}" class="no-skip">いいえ</button>`;
            
            menu.children[0].onclick = (e) => { e.stopPropagation(); menu.remove(); resolve(true); };
            menu.children[1].onclick = (e) => { e.stopPropagation(); menu.remove(); resolve(false); };
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

        for (let i = startFromIndex; i < lines.length; i++) {
            const line = lines[i];

            // 現在のセリフ番号を保存
            if (App.data) {
                App.data.progress.activeConversation = { key: scriptKey, index: i };
                App.save();
            }

            const masterChar = DB.CHARACTERS.find(c => c.id === line.charId);
            const savedChar = App.data.characters.find(c => c.charId === line.charId);
            let displayName = savedChar ? savedChar.name : (masterChar ? masterChar.name : line.name);
            let displayImg = savedChar?.img || masterChar?.img;

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
						text-align: right;
						color: #ffd700;
						font-size: 10px;
						margin-top: 5px;
						animation: none;
					">▼ Click to Next</div>
				</div>
			</div>
`;

		(document.getElementById('game-container') || document.body).appendChild(div);
		return div;
	}
};
