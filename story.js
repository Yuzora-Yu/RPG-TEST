/* story.js - シナリオ・イベント・フラグ管理専用 */

const StoryManager = {
    // 進行度(storyStep)に応じたイベントスクリプト
    scripts: {
        'PROLOGUE': [
            { name: '長老', text: 'おお、勇者よ。ついに旅立ちの時が来たか。' },
            { name: '長老', text: '村の右上にある「試練の洞窟」へ向かい、勇者の証を得るのじゃ。' },
            { name: 'システム', text: '幼馴染のガイルとサラが仲間に加わった！' }
        ],
		'PROLOGUE2': [
            { name: '長老', text: '村の右上にある「試練の洞窟」へ向かい、勇者の証を得るのじゃ。' }
        ],
		'PROLOGUE3': [
            { name: '長老', text: 'うむ、おぬしこそ真の勇者と呼ぶにふさわしい。' },
            { name: '長老', text: 'もう何も言うまい。東の炎の里へ向かい、世界の真実を見るがよい。' },
        ],
        'START_DUNGEON_CLEAR': [
            { name: 'ガイル', text: 'やったぜ！これが勇者の証だな！' },
            { name: 'サラ', text: 'よかった…これで、旅立ちのお許しがもらえるね。勇者様。' }
        ],
        'FIRE_VILLAGE_ARRIVAL': [
            { name: '里の門番', text: '火の宝玉が奪われ、里の活気が失われてしまったのだ…' }
        ]
    },

    // 座標ベースのイベントトリガー定義 (area, x, y, 必要step, 実行イベント)
    triggers: [
        { area: 'START_VILLAGE', x: 6, y: 3, step: 0, eventId: 'start_adventure' }, // 長老(V)の座標
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
                
            case 'start_boss_battle':
                App.log("試練の守護者が立ちはだかる…！");
                
                // バトルデータのセットアップ
                const ak = Field.getCurrentAreaKey();
                const mapDef = FIXED_DUNGEON_MAPS[ak];
                const bossDef = mapDef ? (mapDef.bosses || []).find(b => b.x === Field.x && b.y === Field.y) : null;
                
                App.data.battle = {
                    active: false, // Battle.initで敵を生成させる
                    isBossBattle: true,
                    fixedBossId: bossDef ? bossDef.monsterId : 1010, // 指定ボスID
                    eventId: eventId // ★追加: 勝利後にどのイベントを実行するか記録
                };
                
                App.save();
                App.changeScene('battle');
                break;
        }
        App.save();
    },

    /**
     * ★バトル勝利後にストーリー側で実行する処理
     * battle.js の勝利確定タイミングから呼び出される
     */
    onBattleWin: async (eventId) => {
        const data = App.data.progress;
        
        switch(eventId) {
            case 'start_boss_battle':
                // 1. 勝利後の会話を表示
                await StoryManager.showConversation('START_DUNGEON_CLEAR');
                // 2. ストーリーフラグの更新
                data.storyStep = 2;
                App.log("勇者の証を手に入れた！長老に報告しよう。");
                App.save();
                break;
                
            // 今後、新しいボス戦後のストーリーはここに追加していく
        }
    },

    /**
     * 会話表示 (Menu.msgをPromise化して順次表示)
     */
    showConversation: async (scriptKey) => {
        const lines = StoryManager.scripts[scriptKey];
        if (!lines) return;
        
        for (const line of lines) {
            await new Promise(resolve => {
                Menu.msg(`<span style="color:#ffd700; font-weight:bold;">[${line.name}]</span><br>${line.text}`, resolve);
            });
        }
    }
};