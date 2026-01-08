/* story.js - シナリオ・イベント・フラグ管理専用 */

const StoryManager = {
    // 進行度(storyStep)に応じたイベントスクリプト
    scripts: {
        'PROLOGUE': [
            { name: '長老', text: 'おお、アルスよ。ついに旅立ちの時が来たか。' },
            { name: '長老', text: '村の北にある「試練の洞窟」へ向かい、勇者の証を得るのじゃ。' },
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
        { area: 'START_VILLAGE', x: 7, y: 4, step: 0, eventId: 'start_adventure' },
        { area: 'START_CAVE', x: 2, y: 2,  step: 1, eventId: 'start_boss_battle' }
    ],

    // イベント実行コア
    executeEvent: async (eventId) => {
        const data = App.data.progress;
        
        switch(eventId) {
            case 'start_adventure':
                await StoryManager.showConversation('PROLOGUE');
                App.addStoryAlly(101); // ガイル加入 (仮ID)
                App.addStoryAlly(102); // サラ加入 (仮ID)
                data.storyStep = 1;
                break;
                
            case 'start_boss_battle':
                App.log("強大な魔物の気配を感じる…！");
                // ここで固定ボスとの戦闘シーンへ
                break;
        }
        App.save();
    },

    // 会話表示 (Menu.msgなどを活用)
    showConversation: async (scriptKey) => {
        const lines = StoryManager.scripts[scriptKey];
        if (!lines) return;
        
        for (const line of lines) {
            // 既存のMenu.msgが非同期対応していない場合は、
            // 簡易的にalertやカスタムダイアログで繋ぐか、App.logに流します
            App.log(`<span style="color:#ffd700;">[${line.name}]</span> ${line.text}`);
            // await を入れる場合は、ここでタップ待機ロジックを挟みます
        }
    }
};