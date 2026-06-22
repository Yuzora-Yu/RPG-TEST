/* menus_config.js - 設定メニュー */
const MenuConfig = {
    speedOptions: [
        { value: 'normal', label: '普通', desc: 'じっくり戦闘を見る' },
        { value: 'fast', label: '早い', desc: '戦闘中のウェイトを短縮' },
        { value: 'fastest', label: '最速', desc: '戦闘中のウェイトなし' }
    ],

    ensureSettings: () => {
        if (typeof App !== 'undefined' && typeof App.ensureSettings === 'function') {
            return App.ensureSettings();
        }
        if (!App.data) return { battleSpeed: 'normal', battleAutoStart: false };
        if (!App.data.settings || typeof App.data.settings !== 'object' || Array.isArray(App.data.settings)) {
            App.data.settings = {};
        }
        if (!['normal', 'fast', 'fastest'].includes(App.data.settings.battleSpeed)) App.data.settings.battleSpeed = 'normal';
        App.data.settings.battleAutoStart = App.data.settings.battleAutoStart === true;
        return App.data.settings;
    },

    createDOM: () => {
        if (document.getElementById('sub-screen-config')) return;
        const div = document.createElement('div');
        div.id = 'sub-screen-config';
        div.className = 'sub-screen';
        div.innerHTML = `
            <div class="header-bar">
                <span>⚙️ 設定</span>
                <button class="btn" onclick="Menu.closeSubScreen('config')">もどる</button>
            </div>
            <div id="config-content" class="scroll-area" style="flex:1; padding:14px; background:#111; overflow-y:auto;"></div>
            <div class="sub-screen-bottom-panel">
                <button class="btn sub-screen-back-btn" onclick="Menu.closeSubScreen('config')">もどる</button>
            </div>
        `;
        document.getElementById('game-container').appendChild(div);
    },

    init: () => {
        MenuConfig.createDOM();
        const screen = document.getElementById('sub-screen-config');
        if (screen) screen.style.display = 'flex';
        MenuConfig.render();
    },

    setBattleSpeed: (speed) => {
        const settings = MenuConfig.ensureSettings();
        settings.battleSpeed = ['normal', 'fast', 'fastest'].includes(speed) ? speed : 'normal';
        if (typeof App.setBattleSpeedSetting === 'function') App.setBattleSpeedSetting(settings.battleSpeed);
        else if (typeof App.save === 'function') App.save();
        MenuConfig.render();
    },

    setBattleAutoStart: (enabled) => {
        const settings = MenuConfig.ensureSettings();
        settings.battleAutoStart = enabled === true;
        if (typeof App.setBattleAutoStartSetting === 'function') App.setBattleAutoStartSetting(settings.battleAutoStart);
        else if (typeof App.save === 'function') App.save();
        MenuConfig.render();
    },

    downloadAllData: async () => {
        if (typeof App !== 'undefined' && typeof App.downloadFullDataFromConfig === 'function') {
            await App.downloadFullDataFromConfig();
            return;
        }
        alert('全データダウンロード機能を利用できません。');
    },

    radioRow: (group, value, label, desc, checked, onChange) => `
        <label class="list-item" style="display:flex; align-items:center; gap:10px; padding:10px; margin-bottom:8px; cursor:pointer; background:${checked ? '#203040' : '#181818'}; border:1px solid ${checked ? '#ffd700' : '#333'}; border-radius:6px;">
            <input type="radio" name="${group}" value="${value}" ${checked ? 'checked' : ''} onchange="${onChange}" style="width:18px; height:18px; flex:0 0 auto;">
            <span style="flex:1; min-width:0;">
                <span style="display:block; color:#fff; font-size:14px; font-weight:bold;">${label}</span>
                <span style="display:block; color:#aaa; font-size:11px; margin-top:2px;">${desc}</span>
            </span>
        </label>
    `,

    render: () => {
        const content = document.getElementById('config-content');
        if (!content) return;
        const settings = MenuConfig.ensureSettings();
        const speed = settings.battleSpeed || 'normal';
        const autoStart = settings.battleAutoStart === true;

        const speedRows = MenuConfig.speedOptions.map(opt => MenuConfig.radioRow(
            'battle-speed',
            opt.value,
            opt.label,
            opt.desc,
            speed === opt.value,
            `MenuConfig.setBattleSpeed('${opt.value}')`
        )).join('');

        content.innerHTML = `
            <div style="font-size:12px; color:#aaa; line-height:1.6; margin-bottom:14px;">
                
            </div>

            <div style="border:1px solid #333; border-radius:8px; padding:12px; margin-bottom:14px; background:#151515;">
                <div style="color:#ffd700; font-weight:bold; margin-bottom:10px;">戦闘速度</div>
                ${speedRows}
            </div>

            <div style="border:1px solid #333; border-radius:8px; padding:12px; margin-bottom:14px; background:#151515;">
                <div style="color:#ffd700; font-weight:bold; margin-bottom:10px;">② オート戦闘</div>
                ${MenuConfig.radioRow('battle-auto-start', 'on', 'ON', '戦闘開始時にAUTOを有効化', autoStart, 'MenuConfig.setBattleAutoStart(true)')}
                ${MenuConfig.radioRow('battle-auto-start', 'off', 'OFF', '戦闘開始時は手動入力', !autoStart, 'MenuConfig.setBattleAutoStart(false)')}
            </div>

            <div style="border:1px solid #333; border-radius:8px; padding:12px; background:#151515;">
                <div style="color:#ffd700; font-weight:bold; margin-bottom:10px;">データ管理</div>
                <button class="btn" style="width:100%; height:42px; margin-bottom:10px; background:#004444;" onclick="MenuConfig.downloadAllData()">全データダウンロード</button>
                <button class="btn" style="width:100%; height:42px; margin-bottom:10px; background:#004444;" onclick="App.downloadSave()">データ出力</button>
                <button class="btn" style="width:100%; height:42px; background:#004444;" onclick="App.importSave()">データ読込</button>
            </div>
        `;
        Menu.refreshKeyboardNavigation(content);
    }
};
