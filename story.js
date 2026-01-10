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
	
	/**
     * 中断された会話があれば再開する (起動時用)
     */
    resumeActiveConversation: function() {
        if (App.data && App.data.progress.activeConversation) {
            const { key, index } = App.data.progress.activeConversation;
            // 少し待機してから再開（シーン切り替え等の完了を待つため）
            setTimeout(() => {
                this.showConversation(key, index);
            }, 500);
        }
    },

    /**
     * 主人公のリミットブレイクを同期
     */
    syncHeroLimitBreak: function() {
        if (!App.data || !App.data.characters) return;
        const hero = App.data.characters.find(c => c.charId === 301 || c.uid === 'p1');
        if (hero && App.data.progress && App.data.dungeon) {
            const dungeonLB = Math.max(0, (App.data.dungeon.maxFloor || 1) - 1);
            const storyLB = App.data.progress.storyStep || 0;
            hero.limitBreak = dungeonLB + storyLB;
            if (typeof App.calcStats === 'function') App.calcStats(hero);
        }
    },
	
	// ==========================================
    // 1. 会話スクリプト (scripts)
    // ==========================================
	scripts: {
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
            "name": "システム",
            "text": "ガイルとサラが、正式に仲間に加わった！"
        }
    ],
    "START_DUNGEON_CLEAR": [
        {
            "charId": 109,
            "name": "ガイル",
            "text": "やったぜ！さっすが勇者様だな！！"
        },
        {
            "charId": 110,
            "name": "サラ",
            "text": "よかった…これで、この村も救われます。ありがとう、勇者様。"
        },
        {
            "charId": 109,
            "name": "ガイル",
            "text": "さっそく長老さまに報告だ！いそごうぜ！！"
        }
    ],
    "FIRE_VILLAGE_ARRIVAL": [
        {
            "charId": 1002,
            "name": "里の門番",
            "text": "火の宝玉が奪われ、里の活気が失われてしまったのだ…"
        }
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
        "subMin": 0, "subMax": 0,
        "eventId": "start_adventure3"
    },
    {
        "area": "START_CAVE",
        "x": 1,
        "y": 1,
        "stepMin": 1, "stepMax": 1,
        "subMin": 0, "subMax": 99,
        "eventId": "start_boss_battle"
    }
],

    events: {
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
                "value": "北東の洞窟に潜む魔物を討伐しましょう！"
            }
        ],
        "winActions": []
    },
    "start_adventure2": {
        "actions": [
            {
                "type": "CONV",
                "value": "PROLOGUE2"
            },
            {
                "type": "LOG",
                "value": "北東の洞窟に潜む魔物を討伐しましょう！"
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
                "type": "LOG",
                "value": "東の果て「炎の里」へ向かおう！"
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
					"type": "LOG",
					"value": "洞窟の奥へ進もう！"
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
                "value": 1000
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
                "value": "村を脅かす脅威を打ち払った！長老に報告しよう。"
			}
        ]
    }
},

	// ==========================================
    // 4. イベント実行エンジン
    // ==========================================
    /**
     * イベントを実行
     * @param {string} eventId 
     * @param {boolean} isSubEvent 入れ子実行フラグ (ReferenceError修正)
     */
    executeEvent: async function(eventId, isSubEvent = false) { // ★修正: 引数を追加
        const data = App.data.progress;
        const event = this.events[eventId];
        if (!event || !event.actions) return;

        for (const action of event.actions) {
            // BOSSアクション等でループを中断する必要がある場合は 'BREAK' を受け取る
            const result = await this.processAction(action, eventId);
            if (result === 'BREAK') return; 
        }
		
		// 全てのアクションが終了し、かつトップレベルの呼び出しならUIを閉じる
        if (!isSubEvent) {
            this.endConversation();
        }
        App.save();
    },

    onBattleWin: async function(eventId) {
        const event = this.events[eventId];
        if (!event || !event.winActions) return;

        for (const action of event.winActions) {
            const result = await this.processAction(action, eventId);
            if (result === 'BREAK') return;
        }

        // 勝利後アクション終了時にUIを閉じる
        this.endConversation();
        App.save();
    },

    /**
     * 各アクションの個別処理
     */
    processAction: async function(action, eventId) {
        const data = App.data.progress;
        
        if (action.type === 'CONV') await this.showConversation(action.value);
        if (action.type === 'ALLY') App.addStoryAlly(action.value);
        if (action.type === 'STEP') { data.storyStep = action.value; this.syncHeroLimitBreak(); }
        if (action.type === 'SUB')  { data.subStep = action.value; }
        if (action.type === 'LOG')   App.log(action.value);
        
        // 入れ子イベントの呼び出し（isSubEvent=trueを渡す）
        if (action.type === 'EVENT') await this.executeEvent(action.value, true);

        // 同一イベント内での選択肢分岐
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
            App.data.battle = { active: false, isBossBattle: true, fixedBossId: action.value || 1, eventId: eventId };
            App.save(); App.changeScene('battle');
            return 'BREAK'; // バトル画面へ遷移するため、現在のイベントループを即時中断
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
        
        let overlay = document.getElementById('story-ui-overlay') || this.createStoryDOM();
        overlay.style.display = 'flex';
        
        const portraitImg = document.getElementById('story-portrait');
        const nameBox = document.getElementById('story-name');
        const textBox = document.getElementById('story-text');
        const nextIndicator = document.getElementById('story-next-indicator');

        for (let i = startFromIndex; i < lines.length; i++) {
            const line = lines[i];

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

    showBacklog: function() {
        const msg = this.backlog.map(b => `${b.name}: ${b.text}`).join('\n');
        alert(msg || "会話履歴はありません。");
    },
	
	// ==========================================
    // 6. UI構造の生成 (背面立ち絵・50%位置維持)
    // ==========================================
    createStoryDOM: function() {
		const div = document.createElement('div');
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

			<div style="
				position: relative;
				width: 100%;
				height: 100%;
				box-sizing: border-box;
			">
				
				<div style="
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
				
				<div style="
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

			<style>
				@keyframes blink {
					0% { opacity: 1; }
					50% { opacity: 0; }
					100% { opacity: 1; }
				}
			</style>
		`;

		document.body.appendChild(div);
		return div;
	}
};