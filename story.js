/* story.js - シナリオ・イベント・フラグ管理専用 */

const StoryManager = {
    // 進行度(storyStep)に応じたイベントスクリプト
    scripts: {
        'PROLOGUE': [
            { name: '長老', text: 'おお、アルスよ。ついに旅立ちの時が来たか。' },
            { name: '長老', text: '村の右上にある「試練の洞窟」へ向かい、勇者の証を得るのじゃ。' },
            { name: 'システム', text: '幼馴染のガイルとサラが仲間に加わった！' }
        ],
        'START_DUNGEON_CLEAR': [
            { name: 'ガイル', text: 'やったぜ！これが勇者の証だな！' },
            { name: 'サラ', text: 'アルス、これで西の「炎の里」へ進めるわね。' }
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
                App.addStoryAlly(101); // ガイル
                App.addStoryAlly(102); // サラ
                data.storyStep = 1;
                App.log("長老から「勇者の証」を求められた。");
                break;
                
            case 'start_boss_battle':
                App.log("試練の守護者が立ちはだかる…！");
                if (!App.data.battle) App.data.battle = {};
                // 固定ボス戦フラグを立ててバトル開始
                App.data.battle.isBossBattle = true;
                App.changeScene('battle');
                break;
        }
        App.save();
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