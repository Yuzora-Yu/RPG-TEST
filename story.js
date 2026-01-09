/* story.js */
const StoryManager = {
	// ==========================================
    // 1. 設定項目
    // ==========================================
    textSpeed: 20,      // 通常の文字送り速度 (ミリ秒)
    newlineWait: 400,   // 改行した時の停止時間 (ミリ秒)
	backlog: [],        // 今回の起動中に発生した会話履歴の保存用
	
	// 会話データ
    scripts: {
    "PROLOGUE": [
        {
            "charId": 1001,
            "name": "長老",
            "text": "おお、[N:301]様。\n子どもらを救ってくださりありがとうございます。\nお噂はかねがね聞いております。"
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
            "text": "だって、放っておけねえよ！\nこの村だって、あと一歩でボロボロになるとこだったんだ。世界がおかしくなってんなら、俺は助けに行きたい。"
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
    triggers: [
    {
        "area": "START_VILLAGE",
        "x": 6,
        "y": 3,
        "step": 0,
        "eventId": "start_adventure"
    },
    {
        "area": "START_VILLAGE",
        "x": 6,
        "y": 3,
        "step": 1,
        "eventId": "start_adventure2"
    },
    {
        "area": "START_VILLAGE",
        "x": 6,
        "y": 3,
        "step": 2,
        "eventId": "start_adventure3"
    },
    {
        "area": "START_CAVE",
        "x": 1,
        "y": 1,
        "step": 1,
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
    "start_boss_battle": {
        "actions": [
            {
                "type": "LOG",
                "value": "巨大な化け物が立ちはだかる…！"
            },
            {
                "type": "BOSS",
                "value": 1010
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
                "type": "LOG",
                "value": "村を脅かす脅威を打ち払った！長老に報告しよう。"
            }
        ]
    }
},
    // ==========================================
    // 2. 実行コア・勝利後コア
    // ==========================================
    executeEvent: async function(eventId) {
        const data = App.data.progress;
        const event = this.events[eventId];
        if (!event || !event.actions) return;
        for (const action of event.actions) {
            if (action.type === 'CONV') await this.showConversation(action.value);
            if (action.type === 'ALLY') App.addStoryAlly(action.value);
            if (action.type === 'STEP') data.storyStep = action.value;
            if (action.type === 'LOG')  App.log(action.value);
            if (action.type === 'BOSS') {
                App.data.battle = { active: false, isBossBattle: true, fixedBossId: action.value || 1010, eventId: eventId };
                App.save(); App.changeScene('battle');
                return;
            }
        }
        App.save();
    },

    onBattleWin: async function(eventId) {
        const data = App.data.progress;
        const event = this.events[eventId];
        if (!event || !event.winActions) return;
        for (const action of event.winActions) {
            if (action.type === 'CONV') await this.showConversation(action.value);
            if (action.type === 'ALLY') App.addStoryAlly(action.value);
            if (action.type === 'STEP') data.storyStep = action.value;
            if (action.type === 'LOG')  App.log(action.value);
        }
        App.save();
    },

    // ==========================================
    // 3. 会話表示システム (タイピング・レジューム・バックログ対応)
    // ==========================================
    showConversation: async function(scriptKey, startFromIndex = 0) {
        const lines = this.scripts[scriptKey];
        if (!lines) return;
        
        let overlay = document.getElementById('story-ui-overlay');
        if (overlay && !document.getElementById('story-next-indicator')) {
            overlay.remove();
            overlay = null;
        }
        if (!overlay) overlay = this.createStoryDOM();
        overlay.style.display = 'flex';
        
        const portraitImg = document.getElementById('story-portrait');
        const nameBox = document.getElementById('story-name');
        const textBox = document.getElementById('story-text');
        const nextIndicator = document.getElementById('story-next-indicator');

        for (let i = startFromIndex; i < lines.length; i++) {
            const line = lines[i];

            // --- 進捗の保存 (更新時にここから再開するため) ---
            if (App.data) {
                App.data.progress.activeConversation = { key: scriptKey, index: i };
                App.save();
            }

            const savedChar = App.data.characters.find(c => c.charId === line.charId);
            const masterChar = DB.CHARACTERS.find(c => c.id === line.charId);
            
            let displayName = line.name;
            if (savedChar) displayName = savedChar.name;
            else if (masterChar) displayName = masterChar.name;
            
            let displayImg = null;
            if (savedChar && savedChar.img) displayImg = savedChar.img;
            else if (masterChar && masterChar.img) displayImg = masterChar.img;

            // 名前置換ロジック
            let processedText = line.text.replace(/\[N:(\d+)\]/g, (match, id) => {
                const targetId = parseInt(id);
                const saved = App.data.characters.find(c => c.charId === targetId);
                const master = DB.CHARACTERS.find(c => c.id === targetId);
                return (saved ? saved.name : (master ? master.name : `ID:${id}`));
            });

            processedText = processedText.replace(/\\n/g, '\n');

            // バックログに記録
            this.backlog.push({ name: displayName, text: processedText.replace(/\n/g, " ") });

            // 画像の反映
            if (displayImg) {
                portraitImg.src = displayImg;
                portraitImg.style.display = 'block';
            } else {
                portraitImg.style.display = 'none';
            }
            
            nameBox.innerText = displayName;
            nextIndicator.style.visibility = 'hidden';

            let isTyping = true;
            let skipTyping = false;
            
            overlay.onclick = (e) => {
                // バックログボタン等をクリックした時はスキップさせない
                if (e.target.closest('.no-skip')) return;
                e.stopPropagation();
                if (isTyping) skipTyping = true;
            };

            textBox.innerHTML = "";
            const chars = processedText.split("");

            for (let j = 0; j < chars.length; j++) {
                if (skipTyping) {
                    textBox.innerHTML = processedText.replace(/\n/g, "<br>");
                    break;
                }
                let char = chars[j];
                let currentDelay = this.textSpeed;
                if (char === "\n") {
                    textBox.innerHTML += "<br>";
                    currentDelay = this.newlineWait;
                } else {
                    textBox.innerHTML += char;
                }
                await new Promise(r => setTimeout(r, currentDelay));
            }
            
            isTyping = false;
            nextIndicator.style.visibility = 'visible';

            await new Promise(resolve => {
                overlay.onclick = (e) => {
                    if (e.target.closest('.no-skip')) return;
                    e.stopPropagation();
                    resolve();
                };
            });
        }

        // 会話終了時にフラグをクリア
        if (App.data) {
            delete App.data.progress.activeConversation;
            App.save();
        }
        overlay.style.display = 'none';
    },

    // ==========================================
    // 4. バックログ表示
    // ==========================================
    showBacklog: function() {
        let bg = document.getElementById('story-backlog-overlay');
        if (!bg) {
            bg = document.createElement('div');
            bg.id = 'story-backlog-overlay';
            bg.style.cssText = `
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); z-index: 3000; display: none;
                flex-direction: column; padding: 20px; box-sizing: border-box;
                color: #fff; font-family: sans-serif;
            `;
            bg.innerHTML = `
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #555; padding-bottom:10px; margin-bottom:10px;">
                    <span style="color:#ffd700; font-weight:bold;">BACKLOG</span>
                    <button class="no-skip" onclick="this.parentElement.parentElement.style.display='none'" style="background:#444; color:#fff; border:none; padding:5px 15px; border-radius:4px; cursor:pointer;">CLOSE</button>
                </div>
                <div id="backlog-content" style="flex:1; overflow-y:auto; line-height:1.6; font-size:14px;"></div>
            `;
            document.body.appendChild(bg);
        }

        const content = document.getElementById('backlog-content');
        content.innerHTML = this.backlog.map(log => `
            <div style="margin-bottom:15px;">
                <div style="color:#ffd700; font-weight:bold; font-size:12px;">${log.name}</div>
                <div style="margin-left:5px;">${log.text}</div>
            </div>
        `).join("");
        
        bg.style.display = 'flex';
        content.scrollTop = content.scrollHeight; // 最下部へスクロール
    },

    // ==========================================
    // 5. 起動時の復元チェック (main.jsから呼び出す用)
    // ==========================================
    resumeActiveConversation: function() {
        if (App.data && App.data.progress && App.data.progress.activeConversation) {
            const active = App.data.progress.activeConversation;
            console.log("会話を復元します:", active);
            this.showConversation(active.key, active.index);
        }
    },

    // ==========================================
    // 6. UI構造の生成
    // ==========================================
    /**
	 * ストーリー専用のUI構造（DOM）を生成します。
	 * 画面上の配置、サイズ、色などの外観をここで一括管理します。
	 */
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
			justify-content: flex-start;    /* 会話セットを画面上部に配置 */
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
				display: flex;
				flex-direction: column;
				padding: 205px 20px 20px 20px; /* 上・右・下・左の余白。一番最初の数値で全体の高さを調整 */
				box-sizing: border-box;
			">
				
				<div style="
					position: absolute;
					top: 105px;       /* コンテナ上端からの距離。全体のpadding-topと連動させて調整 */
					left: 40px;       /* 画面左端からの距離 */
					width: 150px;     /* キャラ画像の最大幅 */
					height: 200px;    /* キャラ画像の表示高さ */
					display: flex;
					align-items: flex-end; 
					z-index: 5;       /* メッセージボックス(z-index:10)の背後に配置 */
				">
					<img id="story-portrait" style="
						max-width: 100%;
						max-height: 100%;
						object-fit: contain;
						filter: drop-shadow(0 0 10px rgba(0,0,0,0.8)); /* キャラに影をつけて視認性アップ */
					">
				</div>
				
				<div style="
					width: 100%;
					margin-top: 80px;             /* 画像との重なり具合。数値が大きいほどボックスが下へ移動 */
					background: rgba(0,0,30,0.95); /* ボックスの色と透明度 */
					border: 2px solid #ffd700;    /* 豪華な装飾枠（金） */
					border-radius: 8px;           /* 角の丸み */
					padding: 15px;
					box-sizing: border-box;
					min-height: 110px;            /* 最低限確保する高さ */
					max-height: 300px;            /* 文章が長すぎる場合の最大高さ */
					overflow-y: auto;             /* 最大高さを超えた場合にスクロール可能にする */
					box-shadow: 0 4px 15px rgba(0,0,0,0.5); /* ボックスの下に影をつける */
					z-index: 10;                  /* 画像より手前に表示 */
					position: relative;
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
						margin-top: 15px;
						/* 点滅させたい場合は、none を blink 1s infinite に書き換えてください */
						animation: none;
					">▼ Click to Next</div>
				</div>
			</div>

			<style>
				/* 点滅アニメーション：animation プロパティで使用します */
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