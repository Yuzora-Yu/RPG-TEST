/* menus_config.js - 設定メニュー */
const MenuConfig = {
    speedOptions: [
        { value: 'normal', label: '普通', desc: 'じっくり戦闘を見る' },
        { value: 'fast', label: '早い', desc: '戦闘中のウェイトを約50%に短縮' },
        { value: 'fastest', label: '最速', desc: '戦闘中のウェイトを約30%に短縮' }
    ],

    audioKinds: {
        fieldBgm: { settingKey: 'fieldBgmVolume', category: 'field', type: 'bgm', preview: null },
        battleBgm: { settingKey: 'battleBgmVolume', category: 'battle', type: 'bgm', preview: null },
        uiSe: { settingKey: 'uiSeVolume', category: 'ui', type: 'se', preview: 'menu_confirm' },
        battleSe: { settingKey: 'battleSeVolume', category: 'battle', type: 'se', preview: 'battle_attack' },
        fieldSe: { settingKey: 'fieldSeVolume', category: 'field', type: 'se', preview: 'event_effect' }
    },

    ensureSettings: () => {
        if (typeof App !== 'undefined' && typeof App.ensureSettings === 'function') return App.ensureSettings();
        if (typeof App === 'undefined' || !App.data) {
            return {
                battleSpeed: 'normal', battleAutoStart: false,
                fieldBgmVolume: 30, battleBgmVolume: 30,
                uiSeVolume: 5, battleSeVolume: 5, fieldSeVolume: 5
            };
        }
        if (!App.data.settings || typeof App.data.settings !== 'object' || Array.isArray(App.data.settings)) App.data.settings = {};
        const settings = App.data.settings;
        const clamp = (value, fallback) => Math.max(0, Math.min(100, Math.round(Number(value ?? fallback) || 0)));
        const legacyBgm = clamp(settings.bgmVolume, 30);
        const legacySe = clamp(settings.seVolume, 5);
        if (!['normal', 'fast', 'fastest'].includes(settings.battleSpeed)) settings.battleSpeed = 'normal';
        settings.battleAutoStart = settings.battleAutoStart === true;
        settings.fieldBgmVolume = clamp(settings.fieldBgmVolume, legacyBgm);
        settings.battleBgmVolume = clamp(settings.battleBgmVolume, legacyBgm);
        settings.uiSeVolume = clamp(settings.uiSeVolume, legacySe);
        settings.battleSeVolume = clamp(settings.battleSeVolume, legacySe);
        settings.fieldSeVolume = clamp(settings.fieldSeVolume, legacySe);
        settings.bgmVolume = settings.fieldBgmVolume;
        settings.seVolume = settings.uiSeVolume;
        return settings;
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

    setAudioVolume: (kind, value, render = false) => {
        const config = MenuConfig.audioKinds[kind];
        if (!config) return;
        const normalized = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
        const settings = MenuConfig.ensureSettings();
        settings[config.settingKey] = normalized;

        if (typeof App !== 'undefined' && typeof App.setAudioVolumeSetting === 'function') {
            App.setAudioVolumeSetting(kind, normalized);
        } else if (typeof AudioManager !== 'undefined') {
            if (config.type === 'bgm') AudioManager.setBgmCategoryVolume?.(config.category, normalized);
            else AudioManager.setSeCategoryVolume?.(config.category, normalized);
        } else if (typeof App !== 'undefined' && typeof App.save === 'function') {
            App.save();
        }

        const valueEl = document.getElementById(`config-${kind}-volume-value`);
        if (valueEl) valueEl.textContent = `${normalized}%`;
        if (config.type === 'se' && normalized > 0 && config.preview && typeof AudioManager !== 'undefined') {
            AudioManager.playSe?.(config.preview, { volume: 0.65, ignoreCooldown: true });
        }
        if (render) MenuConfig.render();
    },

    volumeRow: (kind, label, value, description) => `
        <label style="display:block; padding:10px; margin-bottom:8px; background:#181818; border:1px solid #333; border-radius:6px;">
            <span style="display:flex; justify-content:space-between; gap:12px; color:#fff; font-size:14px; font-weight:bold;">
                <span>${label}</span><span id="config-${kind}-volume-value" style="color:#ffd700;">${value}%</span>
            </span>
            <input type="range" min="0" max="100" step="1" value="${value}" aria-label="${label}" oninput="MenuConfig.setAudioVolume('${kind}', this.value)" style="width:100%; margin:10px 0 4px;">
            <span style="display:block; color:#aaa; font-size:11px;">${description}</span>
        </label>
    `,

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
        const getVolume = (key, fallback) => Math.max(0, Math.min(100, Number(settings[key] ?? fallback)));

        const speedRows = MenuConfig.speedOptions.map(opt => MenuConfig.radioRow(
            'battle-speed', opt.value, opt.label, opt.desc, speed === opt.value,
            `MenuConfig.setBattleSpeed('${opt.value}')`
        )).join('');

        content.innerHTML = `
            <div style="border:1px solid #333; border-radius:8px; padding:12px; margin-bottom:14px; background:#151515;">
                <div style="color:#ffd700; font-weight:bold; margin-bottom:10px;">戦闘速度</div>
                ${speedRows}
            </div>

            <div style="border:1px solid #333; border-radius:8px; padding:12px; margin-bottom:14px; background:#151515;">
                <div style="color:#ffd700; font-weight:bold; margin-bottom:10px;">オート戦闘</div>
                ${MenuConfig.radioRow('battle-auto-start', 'on', 'ON', '戦闘開始時にAUTOを有効化', autoStart, 'MenuConfig.setBattleAutoStart(true)')}
                ${MenuConfig.radioRow('battle-auto-start', 'off', 'OFF', '戦闘開始時は手動入力', !autoStart, 'MenuConfig.setBattleAutoStart(false)')}
            </div>

            <div style="border:1px solid #333; border-radius:8px; padding:12px; margin-bottom:14px; background:#151515;">
                <div style="color:#ffd700; font-weight:bold; margin-bottom:10px;">BGM音量</div>
                ${MenuConfig.volumeRow('fieldBgm', 'フィールドBGM', getVolume('fieldBgmVolume', 30), '町・施設・ダンジョン・船・翼を含む、戦闘以外のBGM')}
                ${MenuConfig.volumeRow('battleBgm', '戦闘BGM', getVolume('battleBgmVolume', 30), '通常戦・ボス戦・全滅時のBGM')}
            </div>

            <div style="border:1px solid #333; border-radius:8px; padding:12px; margin-bottom:14px; background:#151515;">
                <div style="color:#ffd700; font-weight:bold; margin-bottom:10px;">SE音量</div>
                ${MenuConfig.volumeRow('uiSe', 'UI・メニューSE', getVolume('uiSeVolume', 5), '決定・戻る・道具・スキル・鍛冶・錬金・購入・売却')}
                ${MenuConfig.volumeRow('battleSe', '戦闘SE', getVolume('battleSeVolume', 5), '攻撃・スキル・回復・ダメージ・勝利・レベルアップ')}
                ${MenuConfig.volumeRow('fieldSe', 'フィールド・イベントSE', getVolume('fieldSeVolume', 5), '宝箱・泉・階段・床・スイッチ・壁衝突・イベント演出')}
                <div style="font-size:10px; color:#777; line-height:1.5;">音源ファイルが無音プレースホルダーの項目は、処理だけ実行されます。</div>
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
