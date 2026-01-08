/* story.js - シナリオ・イベント・フラグ管理専用 */

const StoryManager = {
    // 進行度(storyStep)に応じたイベントスクリプト
    // charId: characters.js(DB.CHARACTERS)のIDを指定
    scripts: {
        'PROLOGUE': [
            { charId: 1001, name: '長老', text: 'おお、勇者よ。ついに旅立ちの時が来たか。' },
            { charId: 1001, name: '長老', text: '村の右上にある「試練の洞窟」へ向かい、勇者の証を得るのじゃ。' },
            { charId: 301,  name: 'アルス', text: '分かりました。必ずや証を持ち帰ります。' },
            { charId: 1000, name: 'システム', text: '幼馴染のガイルとサラが仲間に加わった！' }
        ],
        'PROLOGUE2': [
            { charId: 1001, name: '長老', text: '村の右上にある「試練の洞窟」へ向かい、勇者の証を得るのじゃ。' }
        ],
        'PROLOGUE3': [
            { charId: 1001, name: '長老', text: 'うむ、おぬしこそ真の勇者と呼ぶにふさわしい。' },
            { charId: 1001, name: '長老', text: 'もう何も言うまい。東の炎の里へ向かい、世界の真実を見るがよい。' },
        ],
        'START_DUNGEON_CLEAR': [
            { charId: 109, name: 'ガイル', text: 'やったぜ！これが勇者の証だな！' },
            { charId: 110, name: 'サラ', text: 'よかった…これで、旅立ちのお許しがもらえるね。勇者様。' }
        ],
        'FIRE_VILLAGE_ARRIVAL': [
            { charId: 1002, name: '里の門番', text: '火の宝玉が奪われ、里の活気が失われてしまったのだ…' }
        ]
    },

    // 座標ベースのイベントトリガー定義 (area, x, y, 必要step, 実行イベント)
    triggers: [
        { area: 'START_VILLAGE', x: 6, y: 3, step: 0, eventId: 'start_adventure' }, // 長老(V)の座標
        { area: 'START_VILLAGE', x: 6, y: 3, step: 1, eventId: 'start_adventure2' }, // 長老(V)の座標
        { area: 'START_VILLAGE', x: 6, y: 3, step: 2, eventId: 'start_adventure3' }, // 長老(V)の座標
        { area: 'START_CAVE', x: 1, y: 1,  step: 1, eventId: 'start_boss_battle' }  // 洞窟ボス(B)の座標
    ],

    // イベント実行コア
    executeEvent: async (eventId) => {
        const data = App.data.progress;
        
        switch(eventId) {
            case 'start_adventure':
                // プロローグ会話を開始
                await StoryManager.showConversation('PROLOGUE');
                // 仲間加入
                App.addStoryAlly(109); // ガイル
                App.addStoryAlly(110); // サラ
                data.storyStep = 1;
                App.log("長老から「勇者の証」を求められた。");
                break;
			
			case 'start_adventure2':
                await StoryManager.showConversation('PROLOGUE2');
                App.log("長老から「勇者の証」を求められた。");
                break;
			
			case 'start_adventure3':
                await StoryManager.showConversation('PROLOGUE3');
                App.log("東の果て「炎の里」へ向かおう！");
                break;
                
            case 'start_boss_battle':
                App.log("試練の守護者が立ちはだかる…！");
                
                // バトルデータのセットアップ
                const ak = Field.getCurrentAreaKey();
                const mapDef = FIXED_DUNGEON_MAPS[ak];
                const bossDef = mapDef ? (mapDef.bosses || []).find(b => b.x === Field.x && b.y === Field.y) : null;
                
                App.data.battle = {
                    active: false, 
                    isBossBattle: true,
                    fixedBossId: bossDef ? bossDef.monsterId : 1010, 
                    eventId: eventId // 勝利後にどのイベントを実行するか記録
                };
                
                App.save();
                App.changeScene('battle');
                break;
        }
        App.save();
    },

    /**
     * バトル勝利後にストーリー側で実行する処理
     */
    onBattleWin: async (eventId) => {
        const data = App.data.progress;
        
        switch(eventId) {
            case 'start_boss_battle':
                // 戦闘画面終了後に会話を表示
                await StoryManager.showConversation('START_DUNGEON_CLEAR');
                data.storyStep = 2;
                App.log("勇者の証を手に入れた！長老に報告しよう。");
                App.save();
                break;
        }
    },

    /**
     * 会話表示システム (ポートレート付きVNスタイル)
     */
    showConversation: async (scriptKey) => {
        const lines = StoryManager.scripts[scriptKey];
        if (!lines) return;

        // UI要素の取得または作成
        let overlay = document.getElementById('story-ui-overlay');
        if (!overlay) {
            overlay = StoryManager.createStoryDOM();
        }

        overlay.style.display = 'flex';
        const portraitImg = document.getElementById('story-portrait');
        const nameBox = document.getElementById('story-name');
        const textBox = document.getElementById('story-text');

        for (const line of lines) {
            // --- 1. データの逆引き (セーブデータ優先 -> マスタ参照) ---
            // セーブデータ内のキャラクターを検索 (charIdが一致するもの)
            const savedChar = App.data.characters.find(c => c.charId === line.charId);
            // マスタデータ(DB)を検索
            const masterChar = DB.CHARACTERS.find(c => c.id === line.charId);

            // 表示名の決定: セーブデータ > マスタ > スクリプト直書き
            let displayName = line.name;
            if (savedChar) displayName = savedChar.name;
            else if (masterChar) displayName = masterChar.name;

            // 表示画像の決定: セーブデータ > マスタ
            let displayImg = null;
            if (savedChar && savedChar.img) displayImg = savedChar.img;
            else if (masterChar && masterChar.img) displayImg = masterChar.img;

            // --- 2. UIへの反映 ---
            if (displayImg) {
                portraitImg.src = displayImg;
                portraitImg.style.background = 'transparent';
                portraitImg.style.display = 'block';
            } else if (line.charId === 0 || line.charId === 1000) {
                // システムメッセージ等の場合は画像を隠す
                portraitImg.style.display = 'none';
            } else {
                // 画像がないNPCなどの場合は黒塗り
                portraitImg.src = "";
                portraitImg.style.background = '#000';
                portraitImg.style.display = 'block';
            }

            nameBox.innerText = displayName;
            textBox.innerHTML = line.text;

            // --- 3. クリック待機 ---
            await new Promise(resolve => {
                overlay.onclick = (e) => {
                    e.stopPropagation();
                    resolve();
                };
            });
        }

        overlay.style.display = 'none';
    },

    /**
     * ストーリー専用のUI構造を動的に生成
     */
    createStoryDOM: () => {
        const div = document.createElement('div');
        div.id = 'story-ui-overlay';
        div.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.4); z-index: 2000;
            display: none; flex-direction: column; justify-content: flex-end;
            cursor: pointer; font-family: sans-serif;
        `;

        div.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; 
				padding: 20px 20px 200px 20px; box-sizing: border-box;">
                <div style="position: absolute; bottom: 300px; left: 40px; width: 150px; height: 200px; display: flex; align-items: flex-end; z-index: 5;">
                    <img id="story-portrait" style="max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 0 10px rgba(0,0,0,0.8));">
                </div>
                
                <div style="width: 100%; background: rgba(0,0,30,0.95); border: 2px solid #ffd700; border-radius: 8px; padding: 15px; box-sizing: border-box; min-height: 110px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); z-index: 10; position: relative;">
                    <div id="story-name" style="color: #ffd700; font-weight: bold; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px;"></div>
                    <div id="story-text" style="color: #fff; font-size: 13px; line-height: 1.6; letter-spacing: 0.5px;"></div>
                    <div style="text-align: right; color: #ffd700; font-size: 10px; margin-top: 5px; animation: blink 1s infinite;">▼ Click to Next</div>
                </div>
            </div>
            <style>
                @keyframes blink { 0% { opacity:1; } 50% { opacity:0; } 100% { opacity:1; } }
            </style>
        `;

        document.body.appendChild(div);
        return div;
    }
};