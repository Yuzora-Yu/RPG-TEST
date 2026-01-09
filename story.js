/* story.js */
const StoryManager = {
    scripts: {
    "PROLOGUE": [
        {
            "charId": 1001,
            "name": "長老",
            "text": "おお、[N:301]様。子どもらを救ってくださりありがとうございます。お噂はかねがね聞いております。"
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
            "text": "勝手なお願いとは思うのだが、どうか、化け物を討伐してくれないじゃろうか。"
        },
        {
            "charId": 301,
            "name": "アルス",
            "text": "混沌から生まれし者かもしれません。必ずうち滅ぼします。"
        },
		{
            "charId": 1001,
            "name": "長老",
            "text": "化け物は村北東の大穴の奥に…よろしくお願い申し上げる。"
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
            "text": "化け物は村北東の大穴の奥に…よろしくお願い申し上げる。"
        }
    ],
    "PROLOGUE3": [
        {
            "charId": 1001,
            "name": "長老",
            "text": "うむ、おぬしこそ真の勇者と呼ぶにふさわしい。"
        },
        {
            "charId": 1001,
            "name": "長老",
            "text": "もう何も言うまい。東の炎の里へ向かい、世界の真実を見るがよい。"
        },
        {
            "charId": 109,
            "name": "",
            "text": "へへ、やったな[N:301]さま！早速向かおうぜ！！"
        },
        {
            "charId": 110,
            "name": "",
            "text": "まったくもう…すみません、[N:301]様。今後ともよろしくお願いします。"
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
    executeEvent: async function(eventId) {
        const data = App.data.progress; const event = this.events[eventId]; if (!event || !event.actions) return; for (const action of event.actions) { if (action.type === 'CONV') await this.showConversation(action.value); if (action.type === 'ALLY') App.addStoryAlly(action.value); if (action.type === 'STEP') data.storyStep = action.value; if (action.type === 'LOG') App.log(action.value); if (action.type === 'BOSS') { App.data.battle = { active: false, isBossBattle: true, fixedBossId: action.value || 1010, eventId: eventId }; App.save(); App.changeScene('battle'); return; } }
        App.save();
    },
    onBattleWin: async function(eventId) {
        const data = App.data.progress; const event = this.events[eventId]; if (!event || !event.winActions) return; for (const action of event.winActions) { if (action.type === 'CONV') await this.showConversation(action.value); if (action.type === 'ALLY') App.addStoryAlly(action.value); if (action.type === 'STEP') data.storyStep = action.value; if (action.type === 'LOG') App.log(action.value); if (action.type === 'BOSS') { App.data.battle = { active: false, isBossBattle: true, fixedBossId: action.value || 1010, eventId: eventId }; App.save(); App.changeScene('battle'); return; } }
        App.save();
    },
	
	/* story.js 内の showConversation 関数 全文 (省略なし) */
    showConversation: async function(scriptKey) {
        const lines = this.scripts[scriptKey];
        if (!lines) return;

        // UI要素の取得または作成
        let overlay = document.getElementById('story-ui-overlay') || this.createStoryDOM();
        overlay.style.display = 'flex';
        const portraitImg = document.getElementById('story-portrait');
        const nameBox = document.getElementById('story-name');
        const textBox = document.getElementById('story-text');

        for (const line of lines) {
            // --- 1. データの逆引き (セーブデータ優先 -> マスタ参照) ---
            const savedChar = App.data.characters.find(c => c.charId === line.charId);
            const masterChar = DB.CHARACTERS.find(c => c.id === line.charId);

            let displayName = line.name;
            if (savedChar) displayName = savedChar.name;
            else if (masterChar) displayName = masterChar.name;

            let displayImg = null;
            if (savedChar && savedChar.img) displayImg = savedChar.img;
            else if (masterChar && masterChar.img) displayImg = masterChar.img;

            // --- 2. 名前置換ロジックの追加 ---
            // [N:ID] という形式を、セーブデータまたはマスタの名前で置換する
            let processedText = line.text.replace(/\[N:(\d+)\]/g, (match, id) => {
                const targetId = parseInt(id);
                const saved = App.data.characters.find(c => c.charId === targetId);
                const master = DB.CHARACTERS.find(c => c.id === targetId);
                return (saved ? saved.name : (master ? master.name : `ID:${id}`));
            });

            // --- 3. UIへの反映 ---
            if (displayImg) {
                portraitImg.src = displayImg;
                portraitImg.style.background = 'transparent';
                portraitImg.style.display = 'block';
            } else if (line.charId === 0 || line.charId === 1000) {
                portraitImg.style.display = 'none';
            } else {
                portraitImg.src = ""; 
                portraitImg.style.background = '#000'; 
                portraitImg.style.display = 'block';
            }

            nameBox.innerText = displayName;
            textBox.innerHTML = processedText; // 置換後のテキストを表示

            // クリック待機
            await new Promise(resolve => { 
                overlay.onclick = (e) => { 
                    e.stopPropagation(); 
                    resolve(); 
                }; 
            });
        }
        overlay.style.display = 'none';
    },

    createStoryDOM: function() {
        const div = document.createElement('div');
        div.id = 'story-ui-overlay';
        div.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:2000;display:none;flex-direction:column;justify-content:flex-end;cursor:pointer;font-family:sans-serif;`;
        div.innerHTML = `<div style="position:relative;width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:20px 20px 200px 20px;box-sizing:border-box;"><div style="position:absolute;bottom:300px;left:40px;width:150px;height:200px;display:flex;align-items:flex-end;z-index:5;"><img id="story-portrait" style="max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 0 10px rgba(0,0,0,0.8));"></div><div style="width:100%;background:rgba(0,0,30,0.95);border:2px solid #ffd700;border-radius:8px;padding:15px;box-sizing:border-box;min-height:110px;box-shadow:0 4px 15px rgba(0,0,0,0.5);z-index:10;position:relative;"><div id="story-name" style="color:#ffd700;font-weight:bold;font-size:14px;margin-bottom:8px;border-bottom:1px solid #444;padding-bottom:4px;"></div><div id="story-text" style="color:#fff;font-size:13px;line-height:1.6;letter-spacing:0.5px;"></div><div style="text-align:right;color:#ffd700;font-size:10px;margin-top:5px;animation:blink 1s infinite;">▼ Click to Next</div></div></div><style>@keyframes blink { 0% { opacity:1; } 50% { opacity:0; } 100% { opacity:1; } }</style>`;
        document.body.appendChild(div);
        return div;
    }
};