/* ==========================================================================
   facilities.js (バグ完全修正・ポーカーUI刷新・DQ風レイアウト)
   ========================================================================== */

const Facilities = {
    teleportFloor: 1,

    // 施設背景は assets.js / GRAPHICS を使わず、このファイルから直接参照する
    backgroundPaths: {
        facility_bg_inn: 'assets/background/bg_inn.jpg',
        facility_bg_medal: 'assets/background/bg_medal.png',
        facility_bg_casino: 'assets/background/bg_casino.png'
    },

    escapeAttr: (value) => String(value).replace(/[&<>"]/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    }[ch])),

    /**
     * DQ風ベースレイアウト構築
     * IDの重複によるバグを防ぐため、モーダルやメッセージエリアにシーン固有の接尾辞を付与します。
     */
    setupBaseLayout: (sceneId, title, bgKey, commandsHtml, exitFn, isLocked = false) => {
        const container = document.getElementById(sceneId);
        if (!container) return;

        const bgUrl = Facilities.backgroundPaths[bgKey] || '';
        const bgImageHtml = bgUrl ? `
                <img src="${Facilities.escapeAttr(bgUrl)}" alt="" aria-hidden="true"
                    style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center; display:block;"
                    onerror="this.remove();">
            ` : '';

        // レイアウトのリセットと構築
        container.style.cssText = "display:flex; flex-direction:column; background:#000; height:100%; overflow:hidden; position:relative; font-family: 'DotGothic16', sans-serif;";
        
        container.innerHTML = `
            <div style="position:absolute; top:10px; right:10px; z-index:1000;">
                <button class="btn" style="padding:6px 15px; font-size:11px; border:2px solid #fff; background:${isLocked?'#333':'#000'}; color:${isLocked?'#666':'#fff'};" 
                    onclick="${isLocked ? '' : exitFn}" ${isLocked ? 'disabled' : ''}>
                    ${isLocked ? '勝負中' : '外へ出る'}
                </button>
            </div>

            <div style="width:100%; height:56.25vw; max-height:220px; background:#000; position:relative; flex-shrink:0; border-bottom:4px double #fff; overflow:hidden;">
                ${bgImageHtml}
                <div style="position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,0.85); border:2px solid #fff; padding:3px 12px; color:#fff; font-size:14px; z-index:1;">
                    ${title}
                </div>
            </div>

            <div id="${sceneId}-main-display" style="flex:1; background:#000; padding:10px; color:#fff; font-size:14px; line-height:1.6; overflow-y:auto; position:relative; display:flex; flex-direction:column;">
                <div id="${sceneId}-msg-content" style="max-width:400px; margin:0 auto; width:100%;"></div>
            </div>

            <div style="background:#000; border-top:4px double #fff; padding:12px; flex-shrink:0; z-index:100;">
                <div id="${sceneId}-cmd-row" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; max-width:400px; margin:0 auto;">
                    ${commandsHtml}
                    <button class="menu-btn" style="background:#000; border:1px solid #777; height:40px; font-size:13px; color:#aaa;" 
                        onclick="${isLocked ? '' : exitFn}" ${isLocked ? 'disabled' : ''}>出る</button>
                </div>
            </div>

            <div id="${sceneId}-modal-layer" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:2000; justify-content:center; align-items:center; padding:10px;">
                <div style="background:#000; border:3px double #fff; width:100%; max-width:320px; padding:15px; box-sizing:border-box;">
                    <div id="${sceneId}-modal-title" style="color:#ffd700; font-size:14px; margin-bottom:10px; border-bottom:1px solid #444; padding-bottom:5px; font-weight:bold;"></div>
                    <div id="${sceneId}-modal-body" class="scroll-area" style="max-height:50vh; overflow-y:auto; color:#fff;"></div>
                    <button class="btn" style="width:100%; margin-top:15px; background:#444; border:1px solid #fff; height:40px;" onclick="Facilities.closeModal('${sceneId}')">とじる</button>
                </div>
            </div>
        `;
    },

    /**
     * モーダルを表示
     * sceneIdを指定することで、隠れている別シーンのモーダルを誤操作するのを防ぎます。
     */
    showModal: (sceneId, title, html) => {
        const layer = document.getElementById(`${sceneId}-modal-layer`);
        if(!layer) return;
        document.getElementById(`${sceneId}-modal-title`).innerText = title;
        document.getElementById(`${sceneId}-modal-body`).innerHTML = html;
        layer.style.display = 'flex';
    },

    closeModal: (sceneId) => {
        const layer = document.getElementById(`${sceneId}-modal-layer`);
        if(layer) layer.style.display = 'none';
    },

    // --- 1. 宿屋 ---
    initInn: () => {
        const exitFn = "App.changeScene('field')";
        const teleportOpen = typeof App === 'undefined' || typeof App.isFeatureUnlocked !== 'function' || App.isFeatureUnlocked('teleport');
        const teleportButton = teleportOpen
            ? `<button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Facilities.openTeleport()">転送の扉</button>`
            : `<button class="menu-btn" style="background:#111; border:1px solid #555; height:40px; color:#777;" onclick="App.requireFeatureUnlocked('teleport')">???</button>`;
        const cmds = `
            <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Facilities.stayInn(50)">泊まる (50Gold)</button>
            ${teleportButton}
        `;
        Facilities.setupBaseLayout('inn-scene', '宿屋', 'facility_bg_inn', cmds, exitFn);
        
        const gold = App.data.gold || 0;
        document.getElementById('inn-scene-msg-content').innerHTML = `
            「旅の方、ゆっくり休んでいかれよ」<br><br>
            <span style="color:#ffd700; font-weight:bold;">所持金: ${gold.toLocaleString()} Gold</span>
        `;
    },

    stayInn: (cost) => {
        if(App.data.gold < cost) return Menu.msg("ゴールドが 足りないようです。");
        Menu.confirm("一泊して ＨＰ・ＭＰを 回復しますか？", () => {
            App.data.gold -= cost;
            App.data.characters.forEach(c => { const s = App.calcStats(c); c.currentHp = s.maxHp; c.currentMp = s.maxMp; });
            App.save(); Facilities.initInn();
            Menu.msg("体力が 全回復した！");
        });
    },

    openTeleport: () => {
        if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('teleport')) return;
        const maxF = (App.data.dungeon && App.data.dungeon.maxFloor) ? App.data.dungeon.maxFloor : 0;
        if(maxF === 0) return Menu.msg("まだ 行ける階層が ないようです。");
        
        Facilities.showModal('inn-scene', "行き先を選択", `
            <div style="text-align:center;">
                <div style="font-size:11px; color:#aaa; margin-bottom:15px;">(1階につき 10,000 Gold 必要)</div>
                <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-bottom:20px;">
                    <button class="btn" style="width:40px;height:35px;" onclick="Facilities.updateTele(-10)">-10</button>
                    <button class="btn" style="width:40px;height:35px;" onclick="Facilities.updateTele(-1)">-1</button>
                    <span id="inn-tele-disp-val" style="font-size:28px; font-weight:bold; min-width:70px; color:#fff;">${Facilities.teleportFloor}F</span>
                    <button class="btn" style="width:40px;height:35px;" onclick="Facilities.updateTele(1)">+1</button>
                    <button class="btn" style="width:40px;height:35px;" onclick="Facilities.updateTele(10)">+10</button>
                </div>
                <button class="menu-btn" style="width:100%; height:50px; background:#440; border:2px solid #ff0; color:#fff;" onclick="Facilities.execTele()">転送を実行する</button>
            </div>
        `);
    },

    updateTele: (val) => {
        const maxF = (App.data.dungeon && App.data.dungeon.maxFloor) ? App.data.dungeon.maxFloor : 0;
        Facilities.teleportFloor = Math.max(1, Math.min(maxF, Facilities.teleportFloor + val));
        const el = document.getElementById('inn-tele-disp-val');
        if(el) el.innerText = Facilities.teleportFloor + "F";
    },

    execTele: () => {
        if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('teleport')) return;
        const cost = Facilities.teleportFloor * 10000;
        if(App.data.gold < cost) return Menu.msg("ゴールドが 足りません。");
        Menu.confirm(`${cost.toLocaleString()} Gold 必要ですが よろしいですか？`, () => {
            App.data.gold -= cost; App.save();
            Facilities.closeModal('inn-scene');
            if (typeof Dungeon !== 'undefined') Dungeon.start(Facilities.teleportFloor);
        });
    },

    // --- 2. メダル交換所 ---
    initMedal: () => {
        const exitFn = "App.changeScene('field')";
		const hasWedge = App.data.items && App.data.items[98] > 0;
        // コマンドボタンの構成
        const cmds = `
            <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff; ${hasWedge ? '' : 'grid-column: span 2;'}" onclick="Facilities.openMedalMenu()">メダルを交換する</button>
            ${hasWedge ? `<button class="menu-btn" style="background:#000; border:1px solid #f44; height:40px; color:#f44;" onclick="Facilities.challengeSpecialBoss()">災厄に挑む</button>` : ''}
        `;
        Facilities.setupBaseLayout('medal-scene', 'メダル交換所', 'facility_bg_medal', cmds, exitFn);
        const medals = App.data.items[99] || 0;
        document.getElementById('medal-scene-msg-content').innerHTML = `
            「よくぞ参った。メダルを褒美と交換しよう」<br><br>
            <span style="color:#ffd700; font-weight:bold;">所持メダル: ${medals} 枚</span>
        `;
    },

// 特殊ボス戦開始ロジック
    challengeSpecialBoss: () => {
        Menu.confirm("「災厄の楔」が<br>不気味に脈動している……<br>ギルガメッシュを呼び覚ましますか？<br><span style='color:#f44; font-size:11px;'>※この戦いからは逃げられません</span>", () => {
            App.data.battle = {
                active: true,
                isBossBattle: true,
                isSpecialBoss: true,
                isEstark: true,
                fixedBossId: 902000,
                enemies: []     // Battle.init で生成
            };
            App.save();
            App.changeScene('battle');
        });
    },

    openMedalMenu: () => {
        const current = App.data.items[99] || 0;
        let html = "";
        DB.MEDAL_REWARDS.forEach(r => {
            const owned = !!(r.unique && r.type === 'item' && App.data.items && App.data.items[r.id] > 0);
            const can = current >= r.medals && !owned;
            let detail = (r.type === 'item') ? (DB.ITEMS.find(it => it.id === r.id)?.desc || "不思議な道具") : `Rank.${r.base.rank} 指定部位の＋３確定装備`;
            html += `<div style="border: 1px solid #444; margin-bottom: 8px; padding: 10px; opacity:${can?1:0.5}; background:rgba(255,255,255,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">
                    <div style="font-weight:bold; font-size:14px; color:#fff;">${r.name}</div>
                    <button class="btn" style="min-width:75px; height:30px;" ${can?'':'disabled'} onclick="Facilities.execMedal(${JSON.stringify(r).replace(/"/g, '&quot;')})">${owned ? '入手済み' : `${r.medals}枚`}</button>
                </div>
                <div style="font-size:10px; color:#aaa; line-height:1.4;">${detail}</div>
            </div>`;
        });
        Facilities.showModal('medal-scene', "メダル景品リスト", html);
    },

// --- メダル交換の実行処理 (特殊装備・レプリカ対応版) ---
    execMedal: (r) => {
        if (r.unique && r.type === 'item' && App.data.items && App.data.items[r.id] > 0) {
            Menu.msg("すでに持っています。");
            return;
        }
        if ((App.data.items[99] || 0) < r.medals) {
            Menu.msg("メダルが足りません。");
            return;
        }
        // メダルを消費
        App.data.items[99] -= r.medals;
        
        if(r.type === 'item') { 
            // アイテムの場合
            App.data.items[r.id] = (App.data.items[r.id] || 0) + r.count; 
        }
        else { 
            // 装備の場合 (マスタにない特殊装備・レプリカに対応)
            // 1. 部位マスタ(EQUIP_MASTER)から、この部位(武器/盾等)に適したテンプレートを1つ探す
            //    これにより「剣」や「鎧」としての抽選ルール(possibleOpts)を取得できる
            const template = window.EQUIP_MASTER.find(e => e.type === r.base.type) || window.EQUIP_MASTER[0];

            // 2. 景品設定(r.base)の数値をベースに、装備オブジェクトを構築
            const eq = { 
                id: Date.now() + Math.random().toString(36).substring(2), 
                rank: r.base.rank, 
                name: r.base.name + "+3", // 景品は常に+3
                type: r.base.type,
                baseName: template.baseName, // テンプレートから引き継ぎ（UI表示用）
                val: r.base.val * 2.5, 
                data: JSON.parse(JSON.stringify(r.base.data)), // 景品リスト(Replica等)の固有ステータス
                opts: [], 
                plus: 3,
                possibleOpts: template.possibleOpts // 部位に合ったオプション候補をセット
            };
            
            // 3. 3つのオプションを抽選（厳選の楽しさを残すためランクに応じたレアリティで）
            for(let i=0; i<3; i++) {
                // 部位ごとのルールでフィルタリング
                let optCandidates = DB.OPT_RULES;
                if (eq.possibleOpts && eq.possibleOpts.length > 0) {
                    optCandidates = DB.OPT_RULES.filter(rule => eq.possibleOpts.includes(rule.key));
                }
                const rule = optCandidates.length > 0 ? optCandidates[Math.floor(Math.random() * optCandidates.length)] : DB.OPT_RULES[0];
                
                // レアリティ抽選 (景品なのでNは出にくく調整: +0.15)
                let rarity = 'N';
                const rarRnd = Math.random() + 0.15; 
                if(rarRnd > 0.98 && rule.allowed.includes('EX')) rarity='EX';
                else if(rarRnd > 0.90 && rule.allowed.includes('UR')) rarity='UR';
                else if(rarRnd > 0.75 && rule.allowed.includes('SSR')) rarity='SSR';
                else if(rarRnd > 0.55 && rule.allowed.includes('SR')) rarity='SR';
                else if(rarRnd > 0.30 && rule.allowed.includes('R')) rarity='R';
                else rarity = rule.allowed[0];

                const min = rule.min[rarity]||1, max = rule.max[rarity]||10;
                eq.opts.push({
                    key:rule.key, elm:rule.elm, label:rule.name, 
                    val:Math.floor(Math.random()*(max-min+1))+min, unit:rule.unit, rarity:rarity
                });
            }

            // 4. シナジー判定 (main.jsの機能を利用)
            if (typeof App.checkSynergy === 'function') {
                const syn = App.checkSynergy(eq);
                if(syn) {
                    eq.isSynergy = true;
                    eq.effect = syn.effect;
                }
            }
            
            App.data.inventory.push(eq); 
        }
        
        App.save(); 
        Facilities.closeModal('medal-scene'); 
        Facilities.initMedal(); // 画面更新
        Menu.msg(r.name + "を 受け取った！");
    },



    // --- 3. 店舗共通（道具屋・武器屋・防具屋） ---
    shopTypeLabels: {
        item: '道具屋',
        weapon: '武器屋',
        armor: '防具屋'
    },

    armorTypes: ['盾', '頭', '体', '足'],
    shopSelectedKey: null,
    shopPendingTrade: null,

    jsArg: (value) => JSON.stringify(String(value)).replace(/</g, '\\u003c'),

    ensureShopStyles: () => {
        if (document.getElementById('shop-ui-redesign-style')) return;
        const style = document.createElement('style');
        style.id = 'shop-ui-redesign-style';
        style.textContent = `
            body.game-page #shop-scene.shop-scene-eo {
                display: flex;
                flex-direction: column;
                height: 100%;
                overflow: hidden;
                position: relative;
                background: #000;
                color: #eefcff;
                font-family: 'DotGothic16', sans-serif;
            }
            body.game-page #shop-scene.shop-scene-eo * { box-sizing: border-box; }
            body.game-page .shop-bg-stage {
                width: 100%;
                height: 56.25vw;
                max-height: 220px;
                min-height: 150px;
                background: #000;
                position: relative;
                flex-shrink: 0;
                border-bottom: 4px double #fff;
                overflow: hidden;
            }
            body.game-page .shop-bg-stage img {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center;
                display: block;
            }
            body.game-page .shop-bg-stage:after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.34));
                pointer-events: none;
            }
            body.game-page .shop-facility-name {
                position: absolute;
                left: 10px;
                bottom: 10px;
                z-index: 1;
                background: rgba(0,0,0,0.86);
                border: 2px solid #fff;
                padding: 3px 12px;
                color: #fff;
                font-size: 14px;
                letter-spacing: 0.08em;
            }
            body.game-page .shop-exit-top {
                position: absolute;
                top: 10px;
                right: 10px;
                z-index: 1000;
                padding: 6px 15px;
                min-height: 32px;
                border: 2px solid #fff;
                background: rgba(0,0,0,0.82);
                color: #fff;
                font-family: inherit;
                font-size: 11px;
                cursor: pointer;
            }
            body.game-page .shop-main-display {
                flex: 1;
                min-height: 0;
                background: #000;
                padding: 10px;
                color: #fff;
                font-size: 14px;
                line-height: 1.6;
                overflow-y: auto;
                position: relative;
                display: flex;
                flex-direction: column;
            }
            body.game-page .shop-main-inner {
                max-width: 400px;
                margin: 0 auto;
                width: 100%;
            }
            body.game-page .shop-main-message {
                background: rgba(0,0,0,0.68);
                border: 2px solid rgba(232,254,255,0.86);
                padding: 12px;
                min-height: 76px;
                color: #fff;
            }
            body.game-page .shop-main-gold {
                margin-top: 10px;
                color: #ffd86a;
                font-weight: bold;
                text-align: right;
                letter-spacing: 0.03em;
            }
            body.game-page .shop-command-area {
                background: #000;
                border-top: 4px double #fff;
                padding: 12px;
                flex-shrink: 0;
                z-index: 100;
            }
            body.game-page .shop-command-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                max-width: 400px;
                margin: 0 auto;
            }
            body.game-page .shop-cmd-btn,
            body.game-page .shop-primary-btn,
            body.game-page .shop-secondary-btn,
            body.game-page .shop-qty-btn,
            body.game-page .shop-lineup-close,
            body.game-page .shop-modal-close {
                font-family: inherit;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }
            body.game-page .shop-cmd-btn {
                height: 40px;
                border: 1px solid #fff;
                background: #000;
                color: #fff;
                font-size: 13px;
            }
            body.game-page .shop-cmd-btn.is-active {
                background: #e7d656 !important;
                border-color: #fff59c;
                color: #111 !important;
                font-weight: bold;
            }
            body.game-page .shop-lineup-layer {
                display: none;
                position: absolute;
                inset: 0;
                z-index: 1500;
                justify-content: center;
                align-items: center;
                padding: 10px;
                background: rgba(0, 7, 12, 0.64);
            }
            body.game-page .shop-lineup-window {
                width: min(720px, 100%);
                height: min(88vh, 650px);
                max-height: calc(100% - 20px);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border: 3px double #fff;
                background: #000;
                box-shadow: 0 20px 40px rgba(0,0,0,0.78);
            }
            body.game-page .shop-lineup-titlebar {
                height: 34px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                padding: 0 10px;
                border-bottom: 1px solid #555;
                background: #000;
            }
            body.game-page .shop-lineup-mode {
                display: inline-flex;
                align-items: center;
                height: 24px;
                padding: 0 10px;
                border: 1px solid #fff;
                background: #000;
                color: #fff;
                font-size: 13px;
                font-weight: bold;
                letter-spacing: 0.08em;
                white-space: nowrap;
            }
            body.game-page .shop-lineup-title {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: #eaffff;
                font-size: 13px;
            }
            body.game-page .shop-gold-card {
                display: inline-flex;
                align-items: baseline;
                gap: 8px;
                justify-content: flex-end;
                min-width: 126px;
                color: #ffd86a;
                font-weight: bold;
                white-space: nowrap;
            }
            body.game-page .shop-gold-label { font-size: 10px; color: #ffe9a6; font-weight: normal; }
            body.game-page .shop-gold-value { font-size: 14px; color: #ffe27a; }
            body.game-page .shop-lineup-body {
                flex: 1;
                min-height: 0;
                display: grid;
                grid-template-rows: minmax(0, 1fr) 126px;
                background: #000;
            }
            body.game-page .shop-list-panel {
                min-height: 0;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border-bottom: 2px solid #fff;
            }
            body.game-page .shop-table-head {
                position: sticky;
                top: 0;
                z-index: 3;
                flex-shrink: 0;
                display: grid;
                gap: 6px;
                align-items: center;
                min-height: 28px;
                padding: 5px 10px;
                border-bottom: 1px solid #555;
                background: #111;
                color: #cfffff;
                font-size: 11px;
                letter-spacing: 0.08em;
            }
            body.game-page .shop-table-head.equip,
            body.game-page .shop-row.equip,
            body.game-page .shop-table-head.sell,
            body.game-page .shop-row.sell { grid-template-columns: 48px minmax(0, 1fr) 94px; }
            body.game-page .shop-table-head.item,
            body.game-page .shop-row.item { grid-template-columns: minmax(0, 1fr) 58px 94px; }
            body.game-page .shop-table-head span:last-child { text-align: right; }
            body.game-page .shop-list {
                flex: 1;
                min-height: 0;
                overflow-y: auto;
                scrollbar-width: thin;
                padding: 0;
            }
            body.game-page .shop-row {
                width: 100%;
                min-height: 42px;
                border: 0;
                border-bottom: 1px solid #333;
                background: #050505;
                color: #f5ffff;
                padding: 0 10px;
                display: grid;
                gap: 6px;
                align-items: center;
                text-align: left;
                font-family: inherit;
                cursor: pointer;
            }
            body.game-page .shop-row:nth-child(even) { background: #101010; }
            body.game-page .shop-row:hover,
            body.game-page .shop-row:focus { outline: none; background: #1d1d1d; }
            body.game-page .shop-row.is-selected {
                background: linear-gradient(180deg, #fff38f, #d6c744) !important;
                color: #101010;
                font-weight: bold;
            }
            body.game-page .shop-type-pill {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 22px;
                padding: 0 4px;
                border: 1px solid #777;
                background: #000;
                color: #f5ffff;
                font-size: 10px;
                line-height: 1.1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            body.game-page .shop-row.is-selected .shop-type-pill {
                background: transparent;
                border-color: #101010;
                color: #101010;
            }
            body.game-page .shop-row-name {
                display: block;
                min-width: 0;
                white-space: normal;
                overflow: visible;
                text-overflow: clip;
                overflow-wrap: anywhere;
                word-break: keep-all;
                line-height: 1.25;
                font-size: 13px;
            }
            body.game-page .shop-owned,
            body.game-page .shop-price {
                font-size: 12px;
                white-space: nowrap;
                color: inherit;
            }
            body.game-page .shop-price { text-align: right; }
            body.game-page .shop-detail-panel {
                min-height: 0;
                overflow: hidden;
                background: #000;
                padding: 9px 10px;
                color: #eefcff;
            }
            body.game-page .shop-detail-empty {
                height: 100%;
                display: flex;
                align-items: center;
                color: #bdeaf2;
                font-size: 13px;
            }
            body.game-page .shop-detail-titlebar {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 10px;
                align-items: start;
                margin-bottom: 5px;
            }
            body.game-page .shop-detail-name {
                color: #fff;
                font-size: 14px;
                font-weight: bold;
                line-height: 1.25;
                overflow-wrap: anywhere;
                word-break: keep-all;
            }
            body.game-page .shop-detail-price {
                color: #ffe27a;
                font-size: 13px;
                font-weight: bold;
                white-space: nowrap;
            }
            body.game-page .shop-detail-meta {
                color: #aef6ff;
                font-size: 11px;
                margin-bottom: 4px;
            }
            body.game-page .shop-detail-box {
                color: #ffffff;
                font-size: 12px;
                line-height: 1.45;
                max-height: 56px;
                overflow-y: auto;
            }
            body.game-page .shop-empty-list {
                padding: 44px 10px;
                text-align: center;
                color: #d8fbff;
                font-size: 13px;
            }
            body.game-page .shop-lineup-footer {
                height: 44px;
                flex-shrink: 0;
                display: flex;
                justify-content: flex-end;
                align-items: center;
                padding: 6px 10px;
                border-top: 1px solid #555;
                background: #000;
            }
            body.game-page .shop-lineup-close {
                min-width: 110px;
                height: 30px;
                border: 1px solid #fff;
                background: #000;
                color: #fff;
                font-size: 12px;
            }
            body.game-page .shop-modal-layer {
                display: none;
                position: absolute;
                inset: 0;
                z-index: 2000;
                justify-content: center;
                align-items: center;
                padding: 10px;
                background: rgba(0,0,0,0.78);
            }
            body.game-page .shop-modal-window {
                width: min(420px, 100%);
                max-height: calc(100% - 20px);
                display: flex;
                flex-direction: column;
                padding: 12px;
                border: 3px double #e8feff;
                background: #000;
                color: #fff;
                box-shadow: 0 18px 38px rgba(0,0,0,0.85);
            }
            body.game-page .shop-modal-title {
                color: #ffd86a;
                font-size: 14px;
                margin-bottom: 10px;
                border-bottom: 1px solid #444;
                padding-bottom: 5px;
                font-weight: bold;
            }
            body.game-page .shop-modal-body {
                min-height: 0;
                max-height: 58vh;
                overflow-y: auto;
                color: #fff;
            }
            body.game-page .shop-modal-close {
                width: 100%;
                margin-top: 12px;
                background: #333;
                border: 1px solid #fff;
                min-height: 38px;
                color: #fff;
                font-size: 12px;
            }
            body.game-page .shop-confirm-card,
            body.game-page .shop-result-card { color: #fff; }
            body.game-page .shop-confirm-title {
                font-size: 15px;
                line-height: 1.35;
                font-weight: bold;
                color: #fff;
                margin-bottom: 5px;
                overflow-wrap: anywhere;
                word-break: keep-all;
            }
            body.game-page .shop-confirm-meta {
                color: #aef6ff;
                font-size: 11px;
                line-height: 1.45;
                margin-bottom: 8px;
            }
            body.game-page .shop-confirm-box {
                border: 1px solid #555;
                background: #050505;
                padding: 8px;
                margin-bottom: 10px;
                font-size: 12px;
                line-height: 1.5;
            }
            body.game-page .shop-qty-grid {
                display: grid;
                grid-template-columns: 48px 44px 1fr 44px 48px;
                gap: 6px;
                align-items: center;
                margin: 8px 0;
            }
            body.game-page .shop-qty-btn {
                min-height: 34px;
                border: 1px solid #fff;
                background: #000;
                color: #fff;
                font-size: 12px;
            }
            body.game-page .shop-qty-value {
                min-height: 34px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid #fff;
                color: #fff;
                background: #000;
                font-weight: bold;
            }
            body.game-page .shop-total-line {
                color: #ffd86a;
                font-size: 12px;
                text-align: right;
                margin: 8px 0 10px;
                font-weight: bold;
            }
            body.game-page .shop-primary-btn,
            body.game-page .shop-secondary-btn {
                width: 100%;
                min-height: 40px;
                border: 1px solid #fff59c;
                background: #d6c744;
                color: #111;
                font-size: 13px;
                font-weight: bold;
            }
            body.game-page .shop-secondary-btn {
                border-color: #fff;
                background: #111;
                color: #fff;
            }
            body.game-page .shop-result-banner {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                padding: 6px 8px;
                margin-bottom: 8px;
                border: 1px solid #fff59c;
                background: #1b1600;
                color: #ffe27a;
                font-weight: bold;
            }
            @media (max-width: 430px) {
                body.game-page .shop-bg-stage { min-height: 132px; }
                body.game-page .shop-lineup-layer { padding: 6px; }
                body.game-page .shop-lineup-window { height: calc(100% - 12px); }
                body.game-page .shop-lineup-titlebar { height: 32px; min-height: 32px; padding: 0 8px; }
                body.game-page .shop-gold-card { justify-content: flex-end; width: 100%; }
                body.game-page .shop-lineup-body { grid-template-rows: minmax(0, 1fr) 120px; }
                body.game-page .shop-table-head.equip,
                body.game-page .shop-row.equip,
                body.game-page .shop-table-head.sell,
                body.game-page .shop-row.sell { grid-template-columns: 42px minmax(0, 1fr) 74px; }
                body.game-page .shop-table-head.item,
                body.game-page .shop-row.item { grid-template-columns: minmax(0, 1fr) 46px 74px; }
                body.game-page .shop-table-head { padding: 5px 7px; }
                body.game-page .shop-row { min-height: 42px; padding: 0 7px; }
                body.game-page .shop-row-name { font-size: 12px; }
                body.game-page .shop-owned, body.game-page .shop-price { font-size: 11px; }
                body.game-page .shop-qty-grid { grid-template-columns: 42px 38px 1fr 38px 42px; gap: 5px; }
            }
        `;
        document.head.appendChild(style);
    },

    getShopIcon: (type) => {
        if (type === 'weapon') return '⚔';
        if (type === 'armor') return '🛡';
        return '✦';
    },

    setupShopLayout: (cfg = {}) => {
        Facilities.ensureShopStyles();
        const title = cfg.title || Facilities.shopTypeLabels[cfg.type] || '店';
        const exitFn = "App.changeScene('field')";
        const cmds = `
            <button class="menu-btn shop-cmd-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Facilities.openShopBuy()">買いにきた</button>
            <button class="menu-btn shop-cmd-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Facilities.openShopSell()">売りにきた</button>
        `;

        // 宿屋・カジノと同じベースレイアウトを使い、入店直後の枠線・余白・背景比率を完全に揃える。
        Facilities.setupBaseLayout('shop-scene', title, 'facility_bg_inn', cmds, exitFn);

        const container = document.getElementById('shop-scene');
        if (!container) return;
        container.classList.add('shop-scene-eo');
        container.insertAdjacentHTML('beforeend', `
            <div id="shop-lineup-layer" class="shop-lineup-layer">
                <div class="shop-lineup-window" role="dialog" aria-modal="true">
                    <div class="shop-lineup-titlebar">
                        <div class="shop-gold-card"><span class="shop-gold-label">所持金</span><span id="shop-gold-display" class="shop-gold-value">${(App.data.gold || 0).toLocaleString()} G</span></div>
                    </div>
                    <div class="shop-lineup-body">
                        <section class="shop-list-panel">
                            <div id="shop-list" class="shop-list"></div>
                        </section>
                        <aside id="shop-help" class="shop-detail-panel">
                            <div class="shop-detail-empty">品物を選んでください。</div>
                        </aside>
                    </div>
                    <div class="shop-lineup-footer">
                        <button class="shop-lineup-close" onclick="Facilities.closeShopLineup()">もどる</button>
                    </div>
                </div>
            </div>
        `);
    },

    openShopLineup: (mode) => {
        const layer = document.getElementById('shop-lineup-layer');
        Facilities.updateShopGoldDisplay();
        if (layer) layer.style.display = 'flex';
    },

    closeShopLineup: () => {
        const layer = document.getElementById('shop-lineup-layer');
        if (layer) layer.style.display = 'none';
        if (App?.data?.currentShop) App.data.currentShop.mode = 'home';
        Facilities.shopSelectedKey = null;
        Facilities.shopPendingTrade = null;
        Facilities.closeModal('shop-scene');
        Facilities.renderShopFrame();
    },

    openShopFromField: (config = {}) => {
        const type = config.shopType || config.type || 'item';
        const title = config.title || Facilities.shopTypeLabels[type] || '店';
        const rank = Math.max(1, Number(config.shopRank || config.rank || Facilities.getCurrentAreaShopRank()) || 1);
        const area = App?.data?.location?.area || 'WORLD';
        App.data.currentShop = { type, title, rank, area, mode: 'home', openedAt: Date.now() };
        Facilities.shopSelectedKey = null;
        Facilities.shopPendingTrade = null;
        App.changeScene('shop');
    },

    getCurrentAreaShopRank: () => {
        const areaKey = App?.data?.location?.area;
        const fixed = (typeof FIXED_MAPS !== 'undefined' && areaKey && FIXED_MAPS[areaKey]) ? FIXED_MAPS[areaKey] : null;
        const storyArea = (typeof STORY_DATA !== 'undefined' && areaKey && STORY_DATA.areas) ? STORY_DATA.areas[areaKey] : null;
        const mapRank = Number(fixed?.shopRank || fixed?.encounterRank || fixed?.rank || storyArea?.rank || 1);
        return Math.max(1, mapRank || 1);
    },

    initShop: () => {
        const cfg = App?.data?.currentShop || { type: 'item', title: '道具屋', rank: Facilities.getCurrentAreaShopRank(), mode: 'home' };
        cfg.type = cfg.type || 'item';
        cfg.title = cfg.title || Facilities.shopTypeLabels[cfg.type] || '店';
        cfg.rank = Math.max(1, Number(cfg.rank || Facilities.getCurrentAreaShopRank()) || 1);
        cfg.mode = cfg.mode || 'home';
        App.data.currentShop = cfg;

        Facilities.setupShopLayout(cfg);
        Facilities.renderShopFrame();
        if (cfg.mode === 'buy') {
            Facilities.openShopLineup('buy');
            Facilities.renderShopBuyList();
        } else if (cfg.mode === 'sell') {
            Facilities.openShopLineup('sell');
            Facilities.renderShopSellList();
        } else Facilities.renderShopHome();
    },

    getShopTalk: (type) => {
        if (type === 'weapon') return '「武器を見ていくかい？」';
        if (type === 'armor') return '「防具ならこちらです。」';
        return '「いらっしゃいませ。」';
    },

    getShopModeLabel: (mode) => {
        if (mode === 'buy') return '買いにきた';
        if (mode === 'sell') return '売りにきた';
        return '用件を選ぶ';
    },

    getEquipShopCategory: (base) => {
        if (!base) return '装備';
        return base.baseName || base.subType || base.category || base.kind || base.type || '装備';
    },

    getEquipShopCategoryOrder: (category, shopType = 'weapon') => {
        const weaponOrder = ['剣', '槍', '斧', '短剣', '弓', '杖'];
        const armorOrder = ['盾', '鎧', '兜', '帽子', 'ローブ', '腕輪', 'ブーツ', 'くつ', '頭', '体', '足'];
        const order = shopType === 'weapon' ? weaponOrder : armorOrder;
        const index = order.indexOf(category);
        return index >= 0 ? index : 999;
    },

    compareShopEquipLineup: (shopType) => (a, b) => {
        const ac = Facilities.getEquipShopCategory(a);
        const bc = Facilities.getEquipShopCategory(b);
        const ai = Facilities.getEquipShopCategoryOrder(ac, shopType);
        const bi = Facilities.getEquipShopCategoryOrder(bc, shopType);
        if (ai !== bi) return ai - bi;
        const catDiff = String(ac || '').localeCompare(String(bc || ''), 'ja');
        if (catDiff !== 0) return catDiff;
        const priceDiff = Facilities.getEquipShopPrice(a) - Facilities.getEquipShopPrice(b);
        if (priceDiff !== 0) return priceDiff;
        const rankDiff = Number(a.rank || 0) - Number(b.rank || 0);
        if (rankDiff !== 0) return rankDiff;
        return Number(a.eid || 0) - Number(b.eid || 0);
    },

    renderShopFrame: () => {
        const cfg = App?.data?.currentShop || { type: 'item', title: '道具屋', mode: 'home' };
        const msg = document.getElementById('shop-scene-msg-content');
        if (msg) {
            msg.innerHTML = `
                ${Facilities.getShopTalk(cfg.type)}<br><br>
                <span id="shop-main-gold" style="color:#ffd700; font-weight:bold;">所持金: ${(App.data.gold || 0).toLocaleString()} Gold</span>
            `;
        }
        const cmd = document.getElementById('shop-scene-cmd-row');
        if (cmd) {
            cmd.innerHTML = `
                <button class="menu-btn shop-cmd-btn ${cfg.mode === 'buy' ? 'is-active' : ''}" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Facilities.openShopBuy()">買いにきた</button>
                <button class="menu-btn shop-cmd-btn ${cfg.mode === 'sell' ? 'is-active' : ''}" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Facilities.openShopSell()">売りにきた</button>
                <button class="menu-btn" style="background:#000; border:1px solid #777; height:40px; font-size:13px; color:#aaa;" onclick="App.changeScene('field')">出る</button>
            `;
        }
        Facilities.updateShopGoldDisplay();
    },

    updateShopGoldDisplay: () => {
        const text = `${(App.data.gold || 0).toLocaleString()} G`;
        const gold = document.getElementById('shop-gold-display');
        if (gold) gold.textContent = text;
        const mainGold = document.getElementById('shop-main-gold');
        if (mainGold) mainGold.textContent = `所持金: ${(App.data.gold || 0).toLocaleString()} Gold`;
    },

    setShopHelp: (htmlOrText, asHtml = false) => {
        const help = document.getElementById('shop-help');
        if (!help) return;
        help.innerHTML = asHtml ? (htmlOrText || '') : `<div class="shop-detail-empty">${Facilities.escapeAttr(htmlOrText || '')}</div>`;
    },

    openShopBuy: () => {
        const cfg = App?.data?.currentShop;
        if (!cfg) return;
        cfg.mode = 'buy';
        Facilities.shopSelectedKey = null;
        Facilities.shopPendingTrade = null;
        Facilities.renderShopFrame();
        Facilities.openShopLineup('buy');
        Facilities.renderShopBuyList();
    },

    openShopSell: () => {
        const cfg = App?.data?.currentShop;
        if (!cfg) return;
        cfg.mode = 'sell';
        Facilities.shopSelectedKey = null;
        Facilities.shopPendingTrade = null;
        Facilities.renderShopFrame();
        Facilities.openShopLineup('sell');
        Facilities.renderShopSellList();
    },

    renderShopHome: () => {
        const layer = document.getElementById('shop-lineup-layer');
        if (layer) layer.style.display = 'none';
        Facilities.renderShopFrame();
    },

    renderShopBuyList: () => {
        const cfg = App?.data?.currentShop || { type: 'item', rank: Facilities.getCurrentAreaShopRank() };
        if (cfg.type === 'item') Facilities.renderShopItems();
        else Facilities.renderShopEquip();
    },

    markShopSelectedRow: (selectedKey) => {
        document.querySelectorAll('#shop-list [data-shop-key]').forEach(row => {
            row.classList.toggle('is-selected', row.getAttribute('data-shop-key') === selectedKey);
        });
    },

    renderShopColumnHeader: (left = '種別', center = '名前', right = '金額', variant = 'equip') => {
        if (variant === 'item') {
            return `<div class="shop-table-head item" aria-hidden="true"><span>${Facilities.escapeAttr(center)}</span><span>所持</span><span>${Facilities.escapeAttr(right)}</span></div>`;
        }
        return `<div class="shop-table-head ${Facilities.escapeAttr(variant)}" aria-hidden="true"><span>${Facilities.escapeAttr(left)}</span><span>${Facilities.escapeAttr(center)}</span><span>${Facilities.escapeAttr(right)}</span></div>`;
    },

    showShopItemHelp: (itemId) => {
        const item = (DB.ITEMS || []).find(i => Number(i.id) === Number(itemId));
        if (!item) return;
        const cost = Number(item.price || 0);
        const owned = Number(App.data.items?.[item.id] || 0);
        Facilities.setShopHelp(`
            <div class="shop-detail-titlebar">
                <div class="shop-detail-name">${Facilities.escapeAttr(item.name)}</div>
                <div class="shop-detail-price">${cost.toLocaleString()} G</div>
            </div>
            <div class="shop-detail-meta">所持 ${owned.toLocaleString()}</div>
            <div class="shop-detail-box">${Facilities.escapeAttr(item.desc || '')}</div>
        `, true);
    },

    showShopEquipHelp: (eid) => {
        const cfg = App?.data?.currentShop || { type: 'weapon', rank: Facilities.getCurrentAreaShopRank() };
        const base = Facilities.getEquipShopLineup(cfg.type, cfg.rank).find(eq => Number(eq.eid) === Number(eid));
        if (!base) return;
        const price = Facilities.getEquipShopPrice(base);
        Facilities.setShopHelp(`
            <div class="shop-detail-titlebar">
                <div class="shop-detail-name">${Facilities.escapeAttr(base.name)}</div>
                <div class="shop-detail-price">${price.toLocaleString()} G</div>
            </div>
            <div class="shop-detail-meta">${Facilities.escapeAttr(Facilities.getEquipShopCategory(base))}</div>
            <div class="shop-detail-box">${Facilities.escapeAttr(Facilities.getEquipBaseSummary(base, 0))}</div>
        `, true);
    },

    getItemShopLineup: (rank = 1) => {
        const allowedTypes = new Set(['HP回復', 'MP回復', '状態異常回復', '蘇生', '移動']);
        const typeOrder = ['HP回復', 'MP回復', '状態異常回復', '蘇生', '移動', '換金'];
        const maxRank = Math.max(1, Number(rank) || 1);
        const items = (DB.ITEMS || [])
            .filter(item => allowedTypes.has(item.type))
            .filter(item => Number(item.price || 0) > 0)
            .filter(item => Number(item.rank || 1) <= maxRank);

        const travelItems = (DB.ITEMS || []).filter(item => item.type === '移動' && Number(item.price || 0) > 0);
        travelItems.forEach(item => {
            if (!items.some(existing => Number(existing.id) === Number(item.id))) items.push(item);
        });

        return items.sort((a, b) => {
            const ai = typeOrder.includes(a.type) ? typeOrder.indexOf(a.type) : 99;
            const bi = typeOrder.includes(b.type) ? typeOrder.indexOf(b.type) : 99;
            if (ai !== bi) return ai - bi;
            const priceDiff = Number(a.price || 0) - Number(b.price || 0);
            if (priceDiff !== 0) return priceDiff;
            return String(a.name || '').localeCompare(String(b.name || ''), 'ja') || Number(a.id || 0) - Number(b.id || 0);
        });
    },

    renderShopItems: () => {
        const cfg = App?.data?.currentShop || { rank: Facilities.getCurrentAreaShopRank() };
        const list = document.getElementById('shop-list') || document.getElementById('shop-scene-msg-content');
        if (!list) return;
        const items = Facilities.getItemShopLineup(cfg.rank);
        if (items.length === 0) {
            list.innerHTML = `<div class="shop-empty-list">品切れです。</div>`;
            Facilities.setShopHelp('品物がありません。');
            return;
        }
        list.innerHTML = Facilities.renderShopColumnHeader('', '名前', '買値', 'item') + items.map(item => {
            const cost = Number(item.price || 0);
            const owned = Number(App.data.items?.[item.id] || 0);
            const key = `buy-item-${Number(item.id)}`;
            return `<button class="shop-row item" data-shop-key="${Facilities.escapeAttr(key)}" onclick="Facilities.selectShopBuyItem(${Number(item.id)})" onmouseenter="Facilities.showShopItemHelp(${Number(item.id)})" onfocus="Facilities.showShopItemHelp(${Number(item.id)})">
                <span class="shop-row-name">${Facilities.escapeAttr(item.name)}</span>
                <span class="shop-owned">${owned.toLocaleString()}</span>
                <span class="shop-price">${cost.toLocaleString()} G</span>
            </button>`;
        }).join('');
        Facilities.setShopHelp('品物を選んでください。');
    },

    selectShopBuyItem: (itemId) => {
        const item = (DB.ITEMS || []).find(i => Number(i.id) === Number(itemId));
        if (!item) return Menu.msg('その品物は見つかりません。');
        const key = `buy-item-${Number(item.id)}`;
        if (Facilities.shopSelectedKey === key) {
            Facilities.openShopItemBuyModal(item.id);
            return;
        }
        Facilities.shopSelectedKey = key;
        Facilities.markShopSelectedRow(key);
        Facilities.showShopItemHelp(item.id);
    },

    openShopItemBuyModal: (itemId) => {
        const item = (DB.ITEMS || []).find(i => Number(i.id) === Number(itemId));
        if (!item) return Menu.msg('その品物は見つかりません。');
        const price = Math.max(0, Number(item.price || 0));
        if (price <= 0) return Menu.msg('その品物は購入できません。');
        const affordable = Math.floor((App.data.gold || 0) / price);
        if (affordable <= 0) return Menu.msg('ゴールドが 足りません。');
        Facilities.shopPendingTrade = { kind: 'buyItem', itemId: Number(item.id), qty: 1, max: Math.max(1, affordable), price };
        Facilities.showModal('shop-scene', '購入確認', Facilities.renderShopItemBuyModalHtml(item));
        Facilities.updateShopItemBuyQtyDisplay();
    },

    renderShopItemBuyModalHtml: (item) => {
        const price = Math.max(0, Number(item.price || 0));
        return `
            <div class="shop-confirm-card">
                <div class="shop-confirm-title">${Facilities.escapeAttr(item.name)}</div>
                <div class="shop-confirm-meta">${Facilities.escapeAttr(item.desc || '')}</div>
                <div class="shop-confirm-box">単価 ${price.toLocaleString()} G</div>
                <div class="shop-qty-grid">
                    <button class="shop-qty-btn" onclick="Facilities.changeShopItemBuyQty(-10)">-10</button>
                    <button class="shop-qty-btn" onclick="Facilities.changeShopItemBuyQty(-1)">-</button>
                    <div id="shop-item-qty-display" class="shop-qty-value">1</div>
                    <button class="shop-qty-btn" onclick="Facilities.changeShopItemBuyQty(1)">+</button>
                    <button class="shop-qty-btn" onclick="Facilities.changeShopItemBuyQty(10)">+10</button>
                </div>
                <div id="shop-item-total-display" class="shop-total-line"></div>
                <button class="shop-primary-btn" onclick="Facilities.confirmBuyShopItem()">はい</button>
            </div>
        `;
    },

    changeShopItemBuyQty: (delta) => {
        const trade = Facilities.shopPendingTrade;
        if (!trade || trade.kind !== 'buyItem') return;
        trade.qty = Math.max(1, Math.min(Number(trade.max || 1), Number(trade.qty || 1) + Number(delta || 0)));
        Facilities.updateShopItemBuyQtyDisplay();
    },

    updateShopItemBuyQtyDisplay: () => {
        const trade = Facilities.shopPendingTrade;
        if (!trade || trade.kind !== 'buyItem') return;
        const qtyEl = document.getElementById('shop-item-qty-display');
        const totalEl = document.getElementById('shop-item-total-display');
        const total = Number(trade.qty || 1) * Number(trade.price || 0);
        if (qtyEl) qtyEl.textContent = `${Number(trade.qty || 1).toLocaleString()} 個`;
        if (totalEl) totalEl.textContent = `合計 ${total.toLocaleString()} G / 所持金 ${(App.data.gold || 0).toLocaleString()} G`;
    },

    confirmBuyShopItem: () => {
        const trade = Facilities.shopPendingTrade;
        if (!trade || trade.kind !== 'buyItem') return;
        const item = (DB.ITEMS || []).find(i => Number(i.id) === Number(trade.itemId));
        if (!item) return Menu.msg('その品物は見つかりません。');
        const qty = Math.max(1, Number(trade.qty || 1));
        const total = qty * Math.max(0, Number(trade.price || item.price || 0));
        if ((App.data.gold || 0) < total) return Menu.msg('ゴールドが 足りません。');
        if (!App.data.items) App.data.items = {};
        App.data.gold -= total;
        App.data.items[item.id] = Number(App.data.items[item.id] || 0) + qty;
        App.save();
        Facilities.shopPendingTrade = null;
        Facilities.closeModal('shop-scene');
        Facilities.updateShopGoldDisplay();
        Facilities.renderShopItems();
        const key = `buy-item-${Number(item.id)}`;
        Facilities.shopSelectedKey = key;
        Facilities.markShopSelectedRow(key);
        Facilities.showShopItemHelp(item.id);
        Menu.msg(`${item.name}を ${qty.toLocaleString()}個 購入しました。`);
    },

    getEquipShopPrice: (eqOrBase) => {
        const rank = Math.max(1, Number(eqOrBase?.rank || 1));
        const plus = 2;
        // 売却額は装備価値の半額。販売額は売却額の2倍相当なので、装備価値そのものを採用する。
        return Math.max(1, Math.floor(rank * 150 * (1 + plus * 0.5)));
    },

    getEquipRankBand: (rank = 1) => {
        const upper = Math.max(1, Number(rank) || 1);
        const lower = Math.max(1, upper - 15);
        return { lower, upper };
    },

    getEquipShopLineup: (type, rank = 1) => {
        const targetType = type === 'weapon' ? '武器' : 'armor';
        const band = Facilities.getEquipRankBand(rank);
        const isTarget = (base) => targetType === '武器' ? base?.type === '武器' : Facilities.armorTypes.includes(base?.type);
        let pool = (window.EQUIP_MASTER || [])
            .filter(base => base && !base.noRandom && isTarget(base))
            .filter(base => Number(base.rank || 1) >= band.lower && Number(base.rank || 1) <= band.upper)
            .sort(Facilities.compareShopEquipLineup(type));

        if (pool.length === 0) {
            pool = (window.EQUIP_MASTER || [])
                .filter(base => base && !base.noRandom && isTarget(base))
                .filter(base => Number(base.rank || 1) <= band.upper)
                .sort(Facilities.compareShopEquipLineup(type));
        }
        return pool;
    },

    getBaseEquipDataForPlus: (base, plus = 2) => {
        const data = JSON.parse(JSON.stringify(base?.data || {}));
        const plusMults = { 0: 1.0, 1: 1.1, 2: 1.3, 3: 1.5 };
        const mult = plusMults[plus] || 1.0;
        const scaleKeys = new Set(['atk', 'def', 'mag', 'mdef', 'spd', 'hp', 'mp']);
        if (mult > 1.0) {
            for (const key of Object.keys(data)) {
                if (scaleKeys.has(key) && typeof data[key] === 'number') data[key] = Math.floor(data[key] * mult);
            }
        }
        return data;
    },

    getEquipBaseSummary: (base, plus = 2) => {
        const labels = { hp: 'HP', mp: 'MP', atk: '攻', def: '守', mag: '魔', mdef: '魔防', spd: '速', hit: '命中', eva: '回避', cri: '会心' };
        const data = Facilities.getBaseEquipDataForPlus(base, plus);
        const parts = Object.entries(data || {})
            .filter(([, v]) => typeof v === 'number' && Number(v) !== 0)
            .map(([k, v]) => `${labels[k] || k}${v > 0 ? '+' : ''}${v}`);
        return parts.length ? parts.join('　') : '特殊効果なし';
    },

    renderShopEquip: () => {
        const cfg = App?.data?.currentShop || { type: 'weapon', rank: Facilities.getCurrentAreaShopRank() };
        const list = document.getElementById('shop-list') || document.getElementById('shop-scene-msg-content');
        if (!list) return;
        const lineup = Facilities.getEquipShopLineup(cfg.type, cfg.rank);
        if (lineup.length === 0) {
            list.innerHTML = `<div class="shop-empty-list">品切れです。</div>`;
            Facilities.setShopHelp('装備がありません。');
            return;
        }
        list.innerHTML = Facilities.renderShopColumnHeader('種別', '名前', '買値', 'equip') + lineup.map((base) => {
            const cost = Facilities.getEquipShopPrice(base);
            const key = `buy-equip-${Number(base.eid)}`;
            return `<button class="shop-row equip" data-shop-key="${Facilities.escapeAttr(key)}" onclick="Facilities.selectShopBuyEquip(${Number(base.eid)})" onmouseenter="Facilities.showShopEquipHelp(${Number(base.eid)})" onfocus="Facilities.showShopEquipHelp(${Number(base.eid)})">
                <span class="shop-type-pill">${Facilities.escapeAttr(Facilities.getEquipShopCategory(base))}</span>
                <span class="shop-row-name">${Facilities.escapeAttr(base.name)}</span>
                <span class="shop-price">${cost.toLocaleString()} G</span>
            </button>`;
        }).join('');
        Facilities.setShopHelp('装備を選んでください。');
    },

    selectShopBuyEquip: (eid) => {
        const cfg = App?.data?.currentShop || { type: 'weapon', rank: Facilities.getCurrentAreaShopRank() };
        const base = Facilities.getEquipShopLineup(cfg.type, cfg.rank).find(eq => Number(eq.eid) === Number(eid));
        if (!base) return Menu.msg('その装備は見つかりません。');
        const key = `buy-equip-${Number(base.eid)}`;
        if (Facilities.shopSelectedKey === key) {
            Facilities.openShopEquipBuyConfirm(base.eid);
            return;
        }
        Facilities.shopSelectedKey = key;
        Facilities.markShopSelectedRow(key);
        Facilities.showShopEquipHelp(base.eid);
    },

    openShopEquipBuyConfirm: (eid) => {
        const cfg = App?.data?.currentShop || { type: 'weapon', rank: Facilities.getCurrentAreaShopRank() };
        const base = Facilities.getEquipShopLineup(cfg.type, cfg.rank).find(eq => Number(eq.eid) === Number(eid));
        if (!base) return Menu.msg('その装備は見つかりません。');
        const price = Facilities.getEquipShopPrice(base);
        if ((App.data.gold || 0) < price) return Menu.msg('ゴールドが 足りません。');
        Facilities.showModal('shop-scene', '購入確認', `
            <div class="shop-confirm-card">
                <div class="shop-confirm-title">${Facilities.escapeAttr(base.name)}</div>
                <div class="shop-confirm-meta">${Facilities.escapeAttr(Facilities.getEquipShopCategory(base))}</div>
                <div class="shop-confirm-box">${Facilities.escapeAttr(Facilities.getEquipBaseSummary(base, 0))}</div>
                <div class="shop-total-line">${price.toLocaleString()} G</div>
                <button class="shop-primary-btn" onclick="Facilities.confirmBuyShopEquip(${Number(base.eid)})">はい</button>
            </div>
        `);
    },

    rollShopEquipPlus: () => (Math.random() < 0.05 ? 3 : 2),

    createShopEquipFromBase: (base, shopRank, plus) => {
        if (!base) return null;
        const targetFloor = Math.max(1, Number(shopRank || base.rank || 1));
        const eq = {
            id: Date.now() + Math.random().toString(36).substring(2),
            source: 'shop',
            rank: base.rank,
            name: base.name,
            type: base.type,
            baseName: base.baseName,
            val: base.rank * 150 * (1 + plus * 0.5),
            data: JSON.parse(JSON.stringify(base.data || {})),
            opts: [],
            plus,
            possibleOpts: base.possibleOpts || [],
            traits: (base.traits ? JSON.parse(JSON.stringify(base.traits)) : []),
            grantSkills: (base.grantSkills ? JSON.parse(JSON.stringify(base.grantSkills)) : [])
        };

        const plusMults = { 0: 1.0, 1: 1.1, 2: 1.3, 3: 1.5 };
        const mult = plusMults[plus] || 1.0;
        const scaleKeys = new Set(['atk', 'def', 'mag', 'mdef', 'spd', 'hp', 'mp']);
        if (mult > 1.0) {
            for (const key of scaleKeys) {
                if (typeof eq.data[key] === 'number') eq.data[key] = Math.floor(eq.data[key] * mult);
            }
        }

        if (plus > 0) {
            const baseOptsMap = {
                '剣': ['atk', 'hit', 'cri', 'finDmg', 'elmAtk'],
                '斧': ['atk', 'cri', 'finDmg', 'elmAtk', 'attack_Fear'],
                '槍': ['atk', 'hit', 'cri', 'finDmg', 'elmAtk'],
                '短剣': ['atk', 'mag', 'eva', 'cri', 'finDmg', 'elmAtk', 'attack_Poison'],
                '弓': ['atk', 'mag', 'cri', 'finDmg', 'elmAtk'],
                '杖': ['mag', 'eva', 'finDmg', 'elmAtk'],
                '盾': ['def', 'mdef', 'eva', 'finRed', 'elmRes', 'resists_Debuff'],
                '腕輪': ['atk', 'mag', 'spd', 'def', 'mdef', 'hit', 'eva', 'cri', 'elmAtk', 'finDmg'],
                '兜': ['hp', 'mp', 'def', 'mdef', 'elmRes', 'resists_Fear', 'resists_SkillSeal'],
                '帽子': ['hp', 'mp', 'def', 'mag', 'mdef', 'elmRes', 'resists_HealSeal'],
                '鎧': ['hp', 'mp', 'def', 'mdef', 'finRed', 'elmRes', 'resists_Poison'],
                'ローブ': ['hp', 'mp', 'mdef', 'mag', 'elmAtk', 'elmRes', 'resists_SpellSeal'],
                'ブーツ': ['spd', 'def', 'mdef', 'finRed', 'elmAtk', 'elmRes', 'resists_Shock'],
                'くつ': ['spd', 'hit', 'eva', 'finDmg', 'elmAtk', 'elmRes', 'resists_Shock']
            };
            const allowedKeys = [...new Set([...(baseOptsMap[eq.baseName] || []), ...(base.possibleOpts || [])])];
            for (let i = 0; i < plus; i++) {
                let optCandidates = (DB.OPT_RULES || []).filter(rule => allowedKeys.includes(rule.key));
                if (optCandidates.length === 0) optCandidates = DB.OPT_RULES || [];
                if (optCandidates.length === 0) break;
                const rule = optCandidates[Math.floor(Math.random() * optCandidates.length)];
                let rarity = 'N';
                const tierRatio = Math.min(1, targetFloor / 200);
                const rarRnd = Math.random() + (tierRatio * 0.15);
                if (rarRnd > 0.98 && rule.allowed.includes('EX')) rarity = 'EX';
                else if (rarRnd > 0.90 && rule.allowed.includes('UR')) rarity = 'UR';
                else if (rarRnd > 0.75 && rule.allowed.includes('SSR')) rarity = 'SSR';
                else if (rarRnd > 0.55 && rule.allowed.includes('SR')) rarity = 'SR';
                else if (rarRnd > 0.30 && rule.allowed.includes('R')) rarity = 'R';
                else rarity = rule.allowed[0];
                const min = rule.min[rarity] || 1;
                const max = rule.max[rarity] || 10;
                eq.opts.push({
                    key: rule.key,
                    elm: rule.elm,
                    label: rule.name,
                    val: Math.floor(Math.random() * (max - min + 1)) + min,
                    unit: rule.unit,
                    rarity
                });
            }
            eq.name += `+${plus}`;
        }

        if (plus >= 3 && typeof PassiveSkill !== 'undefined' && PassiveSkill.generateEquipmentTraits) {
            const randTraits = PassiveSkill.generateEquipmentTraits();
            eq.traits = [...(eq.traits || []), ...(randTraits || [])];
        }

        if (typeof App !== 'undefined' && typeof App.checkSynergy === 'function') {
            const syns = App.checkSynergy(eq);
            if (syns && syns.length > 0) {
                eq.isSynergy = true;
                eq.effects = syns.map(s => s.effect);
                eq.synergies = syns;
            }
        }
        return eq;
    },

    confirmBuyShopEquip: (eid) => {
        const cfg = App?.data?.currentShop || { type: 'weapon', rank: Facilities.getCurrentAreaShopRank() };
        const base = Facilities.getEquipShopLineup(cfg.type, cfg.rank).find(eq => Number(eq.eid) === Number(eid));
        if (!base) return Menu.msg('その装備は見つかりません。');
        const price = Facilities.getEquipShopPrice(base);
        if ((App.data.gold || 0) < price) return Menu.msg('ゴールドが 足りません。');

        const plus = Facilities.rollShopEquipPlus();
        const purchased = Facilities.createShopEquipFromBase(base, cfg.rank, plus);
        if (!purchased) return Menu.msg('その装備は準備できませんでした。');

        if (!App.data.inventory) App.data.inventory = [];
        App.data.gold -= price;
        App.data.inventory.push(purchased);
        App.save();
        Facilities.updateShopGoldDisplay();
        Facilities.renderShopEquip();
        const key = `buy-equip-${Number(base.eid)}`;
        Facilities.shopSelectedKey = key;
        Facilities.markShopSelectedRow(key);
        Facilities.showShopEquipHelp(base.eid);

        const detailHtml = (typeof Menu !== 'undefined' && typeof Menu.getEquipDetailHTML === 'function')
            ? Menu.getEquipDetailHTML(purchased, true)
            : Facilities.escapeAttr(purchased.name);
        Facilities.showModal('shop-scene', '購入結果', `
            <div class="shop-result-card">
                <div class="shop-result-banner">
                    <span>購入品</span><span>+${plus}</span>
                </div>
                <div class="shop-confirm-box">${detailHtml}</div>
                <div class="shop-total-line">支払い ${price.toLocaleString()} G / 残金 ${(App.data.gold || 0).toLocaleString()} G</div>
            </div>
        `);
    },

    buyShopEquip: (eid) => {
        // 旧onclick互換。既存セーブや古いHTML断片から呼ばれても、即購入せず確認へ進ませる。
        Facilities.selectShopBuyEquip(eid);
    },

    buyShopItem: (itemId) => {
        // 旧onclick互換。既存セーブや古いHTML断片から呼ばれても、即購入せず数量確認へ進ませる。
        Facilities.selectShopBuyItem(itemId);
    },

    getEquippedIdSet: () => {
        const ids = new Set();
        (App.data.characters || []).forEach(char => {
            if (!char || !char.equips) return;
            Object.values(char.equips).forEach(eq => {
                const id = eq && (typeof eq === 'object' ? eq.id : eq);
                if (id !== undefined && id !== null) ids.add(String(id));
            });
        });
        return ids;
    },

    isSellableItemDef: (item) => {
        if (!item) return false;
        if (item.noSell || item.unsellable) return false;
        if (item.type === '貴重品' || item.type === '乗り物') return false;
        return Facilities.getItemSellPrice(item) > 0;
    },

    getItemSellPrice: (item) => {
        if (!item) return 0;
        if (Number(item.sellPrice || 0) > 0) return Math.floor(Number(item.sellPrice));
        if (Number(item.sell || 0) > 0) return Math.floor(Number(item.sell));
        if (Number(item.sellGold || 0) > 0) return Math.floor(Number(item.sellGold));
        if (Number(item.gold || 0) > 0) return Math.floor(Number(item.gold));
        if (Number(item.value || 0) > 0) return Math.floor(Number(item.value));
        if (item.type === '換金' && Number(item.val || 0) > 0) return Math.floor(Number(item.val));
        if (Number(item.price || 0) > 0) return Math.max(1, Math.floor(Number(item.price) / 2));
        return 0;
    },

    getEquipSellPrice: (equip) => Math.max(1, Math.floor(Number(equip?.val || 0) / 2)),

    getShopSellEntries: () => {
        const entries = [];
        Object.keys(App.data.items || {}).forEach(id => {
            const count = Number(App.data.items[id] || 0);
            if (count <= 0) return;
            const item = (DB.ITEMS || []).find(i => Number(i.id) === Number(id));
            if (!Facilities.isSellableItemDef(item)) return;
            entries.push({
                kind: 'item',
                key: `sell-item-${Number(item.id)}`,
                type: item.type || '道具',
                name: item.name,
                price: Facilities.getItemSellPrice(item),
                count,
                item
            });
        });

        const itemTypeOrder = ['HP回復', 'MP回復', '状態異常回復', '蘇生', '移動', '換金'];
        return entries.sort((a, b) => {
            const ai = itemTypeOrder.includes(a.type) ? itemTypeOrder.indexOf(a.type) : 99;
            const bi = itemTypeOrder.includes(b.type) ? itemTypeOrder.indexOf(b.type) : 99;
            if (ai !== bi) return ai - bi;
            const priceDiff = Number(a.price || 0) - Number(b.price || 0);
            if (priceDiff !== 0) return priceDiff;
            return String(a.name || '').localeCompare(String(b.name || ''), 'ja') || Number(a.item?.id || 0) - Number(b.item?.id || 0);
        });
    },

    renderShopSellList: () => {
        const list = document.getElementById('shop-list') || document.getElementById('shop-scene-msg-content');
        if (!list) return;
        const entries = Facilities.getShopSellEntries();
        if (entries.length === 0) {
            list.innerHTML = `<div class="shop-empty-list">売れる道具がありません。</div>`;
            Facilities.setShopHelp('売れる道具がありません。');
            return;
        }
        list.innerHTML = Facilities.renderShopColumnHeader('', '名前', '売値', 'item') + entries.map(entry => {
            return `<button class="shop-row item" data-shop-key="${Facilities.escapeAttr(entry.key)}" onclick="Facilities.selectShopSellItem(${Number(entry.item.id)})" onmouseenter="Facilities.showShopSellItemHelp(${Number(entry.item.id)})" onfocus="Facilities.showShopSellItemHelp(${Number(entry.item.id)})">
                <span class="shop-row-name">${Facilities.escapeAttr(entry.name)}</span>
                <span class="shop-owned">${Number(entry.count || 0).toLocaleString()}</span>
                <span class="shop-price">${entry.price.toLocaleString()} G</span>
            </button>`;
        }).join('');
        Facilities.setShopHelp('売る道具を選んでください。');
    },

    selectShopSellItem: (itemId) => {
        const item = (DB.ITEMS || []).find(i => Number(i.id) === Number(itemId));
        const count = Number(App.data.items?.[itemId] || 0);
        if (!item || count <= 0 || !Facilities.isSellableItemDef(item)) return Menu.msg('その品物は売却できません。');
        const key = `sell-item-${Number(item.id)}`;
        if (Facilities.shopSelectedKey === key) {
            Facilities.openShopItemSellModal(item.id);
            return;
        }
        Facilities.shopSelectedKey = key;
        Facilities.markShopSelectedRow(key);
        Facilities.showShopSellItemHelp(item.id);
    },

    showShopSellItemHelp: (itemId) => {
        const item = (DB.ITEMS || []).find(i => Number(i.id) === Number(itemId));
        if (!item) return;
        const count = Number(App.data.items?.[item.id] || 0);
        const price = Facilities.getItemSellPrice(item);
        Facilities.setShopHelp(`
            <div class="shop-detail-titlebar">
                <div class="shop-detail-name">${Facilities.escapeAttr(item.name)}</div>
                <div class="shop-detail-price">${price.toLocaleString()} G</div>
            </div>
            <div class="shop-detail-meta">所持 ${count.toLocaleString()}</div>
            <div class="shop-detail-box">${Facilities.escapeAttr(item.desc || '')}</div>
        `, true);
    },

    openShopItemSellModal: (itemId) => {
        const item = (DB.ITEMS || []).find(i => Number(i.id) === Number(itemId));
        const count = Number(App.data.items?.[itemId] || 0);
        if (!item || count <= 0 || !Facilities.isSellableItemDef(item)) return Menu.msg('その品物は売却できません。');
        Facilities.shopPendingTrade = { kind: 'sellItem', itemId: Number(item.id), qty: 1, max: count, price: Facilities.getItemSellPrice(item) };
        Facilities.showModal('shop-scene', '売却確認', Facilities.renderShopItemSellModalHtml(item));
        Facilities.updateShopItemSellQtyDisplay();
    },

    renderShopItemSellModalHtml: (item) => `
        <div class="shop-confirm-card">
            <div class="shop-confirm-title">${Facilities.escapeAttr(item.name)}</div>
            <div class="shop-confirm-meta">${Facilities.escapeAttr(item.desc || '')}</div>
            <div class="shop-confirm-box">単価 ${Facilities.getItemSellPrice(item).toLocaleString()} G</div>
            <div class="shop-qty-grid">
                <button class="shop-qty-btn" onclick="Facilities.changeShopItemSellQty(-10)">-10</button>
                <button class="shop-qty-btn" onclick="Facilities.changeShopItemSellQty(-1)">-</button>
                <div id="shop-sell-qty-display" class="shop-qty-value">1</div>
                <button class="shop-qty-btn" onclick="Facilities.changeShopItemSellQty(1)">+</button>
                <button class="shop-qty-btn" onclick="Facilities.changeShopItemSellQty(10)">+10</button>
            </div>
            <div id="shop-sell-total-display" class="shop-total-line"></div>
            <button class="shop-secondary-btn" onclick="Facilities.confirmSellShopItem()">はい</button>
        </div>
    `,

    changeShopItemSellQty: (delta) => {
        const trade = Facilities.shopPendingTrade;
        if (!trade || trade.kind !== 'sellItem') return;
        trade.qty = Math.max(1, Math.min(Number(trade.max || 1), Number(trade.qty || 1) + Number(delta || 0)));
        Facilities.updateShopItemSellQtyDisplay();
    },

    updateShopItemSellQtyDisplay: () => {
        const trade = Facilities.shopPendingTrade;
        if (!trade || trade.kind !== 'sellItem') return;
        const qtyEl = document.getElementById('shop-sell-qty-display');
        const totalEl = document.getElementById('shop-sell-total-display');
        const total = Number(trade.qty || 1) * Number(trade.price || 0);
        if (qtyEl) qtyEl.textContent = `${Number(trade.qty || 1).toLocaleString()} 個`;
        if (totalEl) totalEl.textContent = `合計 ${total.toLocaleString()} G`;
    },

    confirmSellShopItem: () => {
        const trade = Facilities.shopPendingTrade;
        if (!trade || trade.kind !== 'sellItem') return;
        const item = (DB.ITEMS || []).find(i => Number(i.id) === Number(trade.itemId));
        const owned = Number(App.data.items?.[trade.itemId] || 0);
        if (!item || owned <= 0 || !Facilities.isSellableItemDef(item)) return Menu.msg('その品物は売却できません。');
        const qty = Math.max(1, Math.min(owned, Number(trade.qty || 1)));
        const total = qty * Facilities.getItemSellPrice(item);
        App.data.items[item.id] = owned - qty;
        if (App.data.items[item.id] <= 0) delete App.data.items[item.id];
        App.data.gold = Number(App.data.gold || 0) + total;
        App.save();
        Facilities.shopPendingTrade = null;
        Facilities.closeModal('shop-scene');
        Facilities.updateShopGoldDisplay();
        Facilities.renderShopSellList();
        Facilities.setShopHelp('売却しました。');
        Menu.msg(`${total.toLocaleString()}G 獲得しました。`);
    },

    selectShopSellEquip: (equipId) => {
        const equip = (App.data.inventory || []).find(eq => String(eq.id) === String(equipId));
        if (!equip || equip.locked || Facilities.getEquippedIdSet().has(String(equip.id))) return Menu.msg('その装備は売却できません。');
        const key = `sell-equip-${String(equip.id)}`;
        if (Facilities.shopSelectedKey === key) {
            Facilities.openShopEquipSellModal(equip.id);
            return;
        }
        Facilities.shopSelectedKey = key;
        Facilities.markShopSelectedRow(key);
        Facilities.showShopSellEquipHelp(equip.id);
    },

    showShopSellEquipHelp: (equipId) => {
        const equip = (App.data.inventory || []).find(eq => String(eq.id) === String(equipId));
        if (!equip) return;
        const price = Facilities.getEquipSellPrice(equip);
        const detailHtml = (typeof Menu !== 'undefined' && typeof Menu.getEquipDetailHTML === 'function')
            ? Menu.getEquipDetailHTML(equip, true)
            : Facilities.escapeAttr(equip.name || '装備');
        Facilities.setShopHelp(`
            <div class="shop-detail-titlebar">
                <div class="shop-detail-name">${Facilities.escapeAttr(equip.name || '装備')}</div>
                <div class="shop-detail-price">${price.toLocaleString()} G</div>
            </div>
            <div class="shop-detail-meta">${Facilities.escapeAttr(equip.type || '装備')}</div>
            <div class="shop-detail-box">${detailHtml}</div>
        `, true);
    },

    openShopEquipSellModal: (equipId) => {
        const equip = (App.data.inventory || []).find(eq => String(eq.id) === String(equipId));
        if (!equip || equip.locked || Facilities.getEquippedIdSet().has(String(equip.id))) return Menu.msg('その装備は売却できません。');
        const price = Facilities.getEquipSellPrice(equip);
        const detailHtml = (typeof Menu !== 'undefined' && typeof Menu.getEquipDetailHTML === 'function')
            ? Menu.getEquipDetailHTML(equip, true)
            : Facilities.escapeAttr(equip.name || '装備');
        Facilities.showModal('shop-scene', '売却確認', `
            <div class="shop-confirm-card">
                <div class="shop-confirm-title">${Facilities.escapeAttr(equip.name || '装備')}</div>
                <div class="shop-confirm-meta">${Facilities.escapeAttr(equip.type || '装備')}</div>
                <div class="shop-confirm-box">${detailHtml}</div>
                <div class="shop-total-line">${price.toLocaleString()} G</div>
                <button class="shop-secondary-btn" onclick='Facilities.confirmSellShopEquip(${Facilities.jsArg(equip.id)})'>はい</button>
            </div>
        `);
    },

    confirmSellShopEquip: (equipId) => {
        const equippedIds = Facilities.getEquippedIdSet();
        const index = (App.data.inventory || []).findIndex(eq => String(eq.id) === String(equipId));
        if (index < 0) return Menu.msg('その装備は見つかりません。');
        const equip = App.data.inventory[index];
        if (!equip || equip.locked || equippedIds.has(String(equip.id))) return Menu.msg('その装備は売却できません。');
        const price = Facilities.getEquipSellPrice(equip);
        App.data.inventory.splice(index, 1);
        App.data.gold = Number(App.data.gold || 0) + price;
        App.save();
        Facilities.closeModal('shop-scene');
        Facilities.updateShopGoldDisplay();
        Facilities.renderShopSellList();
        Facilities.setShopHelp('売却しました。');
        Menu.msg(`${price.toLocaleString()}G 獲得しました。`);
    },

    // --- 3. カジノ ---
    initCasino: () => {
        if (!App.data.casinoState) App.data.casinoState = { isPlaying: false, currentGame: null };
        
        // 勝負中であればUIを復元
        if (App.data.casinoState.isPlaying) {
             Casino.isPlaying = true;
             Casino.currentGame = App.data.casinoState.currentGame;
             Casino.betGold = App.data.casinoState.betGold;
             Casino.targetCurrency = App.data.casinoState.betCurrency || App.data.casinoState.targetCurrency || 'gold';
             Casino.hand = App.data.casinoState.hand || [];
             Casino.dealer = App.data.casinoState.dealer || [];
             Casino.deck = App.data.casinoState.deck || [];
             Casino.duDeck = App.data.casinoState.duDeck || [];
             Casino.currentPayout = App.data.casinoState.payout || 0;
             Casino.renderGameUI();
             return;
        }

        const exitFn = "App.changeScene('field')";
        const cmds = `
            <button class="menu-btn" style="background:#000; border:1px solid #4af; height:40px; color:#fff;" onclick="Casino.openGameSelect('gem')">GEMを賭ける</button>
            <button class="menu-btn" style="background:#000; border:1px solid #ffd700; height:40px; color:#fff;" onclick="Casino.openGameSelect('gold')">GOLDを賭ける</button>
            <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Facilities.openCasinoExchange()">ジェム交換所</button>
        `;
        Facilities.setupBaseLayout('casino-scene', 'カジノ', 'facility_bg_casino', cmds, exitFn);
        document.getElementById('casino-scene-msg-content').innerHTML = `
            「夢の宮殿へようこそ！」<br><br>
            まずは賭ける通貨をお選びください。<br><br>
            <span style="color:#ffd700;">Gold: ${(App.data.gold || 0).toLocaleString()} / GEM: ${(App.data.gems || 0).toLocaleString()}</span>
        `;
    },

    casinoExchangeLineup: [
        { kind: 'item', itemId: 106, qty: 1, cost: 500, label: 'スキルのたね', desc: 'SPを1増やす希少な種' },
        { kind: 'item', itemId: 107, qty: 1, cost: 5000, label: '転生の実', desc: '能力を維持してLv1に戻る禁断の実' },
        { kind: 'item', itemId: 6, qty: 1, cost: 2500, label: '世界樹の雫', desc: '味方全員のHPを全回復する高級回復品' },
        { kind: 'item', itemId: 7, qty: 1, cost: 1500, label: 'エルフの飲み薬', desc: 'MPを全回復する高級回復品' },
        { kind: 'equip', category: 'weapon', rank: 70, plus: 3, cost: 8000, label: '希少武器+3', desc: 'Rank70相当のランダム武器+3' },
        { kind: 'equip', category: 'armor', rank: 70, plus: 3, cost: 8000, label: '希少防具+3', desc: 'Rank70相当のランダム防具+3' },
        { kind: 'equip', category: 'weapon', rank: 100, plus: 3, cost: 20000, label: '英雄武器+3', desc: 'Rank100相当のランダム武器+3' },
        { kind: 'equip', category: 'armor', rank: 100, plus: 3, cost: 20000, label: '英雄防具+3', desc: 'Rank100相当のランダム防具+3' }
    ],

    openCasinoExchange: () => {
        const gems = App.data.gems || 0;
        const html = `
            <div style="font-size:11px; color:#aaa; margin-bottom:10px; line-height:1.5;">
                カジノで得たGEMを、希少品と交換できます。<br>
                <span style="color:#4af; font-weight:bold;">所持GEM: ${gems.toLocaleString()}</span>
            </div>
            ${Facilities.casinoExchangeLineup.map((reward, index) => {
                const disabled = gems < reward.cost ? 'disabled' : '';
                const color = gems < reward.cost ? '#666' : '#fff';
                return `<div style="border-bottom:1px solid #333; padding:10px 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <div>
                            <div style="font-weight:bold; color:#fff;">${Facilities.escapeAttr(reward.label)}</div>
                            <div style="font-size:10px; color:#aaa;">${Facilities.escapeAttr(reward.desc || '')}</div>
                        </div>
                        <button class="btn" style="min-width:92px; height:32px; border:1px solid #4af; background:#000; color:${color};" ${disabled} onclick="Facilities.exchangeCasinoReward(${index})">${reward.cost.toLocaleString()}GEM</button>
                    </div>
                </div>`;
            }).join('')}
        `;
        Facilities.showModal('casino-scene', 'ジェム交換所', html);
    },

    createCasinoExchangeEquip: (reward) => {
        const category = reward.category === 'weapon' ? 'weapon' : 'armor';
        const targetType = category === 'weapon' ? '武器' : 'armor';
        const isTarget = (eq) => targetType === '武器' ? eq?.type === '武器' : Facilities.armorTypes.includes(eq?.type);
        let eq = null;
        let attempts = 0;
        while ((!eq || !isTarget(eq)) && attempts < 80) {
            eq = App.createEquipByFloor('casinoExchange', reward.rank || 70, reward.plus || 3);
            attempts++;
        }
        if (!eq || !isTarget(eq)) {
            const pool = (window.EQUIP_MASTER || []).filter(base => !base.noRandom)
                .filter(base => targetType === '武器' ? base.type === '武器' : Facilities.armorTypes.includes(base.type))
                .filter(base => Number(base.rank || 1) <= Math.max(1, Number(reward.rank || 70)));
            const base = pool[Math.floor(Math.random() * pool.length)] || null;
            eq = base ? App.createEquipById(base.eid, reward.plus || 3) : null;
        }
        if (eq) eq.source = 'casinoExchange';
        return eq;
    },

    exchangeCasinoReward: (index) => {
        const reward = Facilities.casinoExchangeLineup[index];
        if (!reward) return Menu.msg('その景品は見つかりません。');
        if ((App.data.gems || 0) < reward.cost) return Menu.msg('GEMが 足りません。');

        let name = reward.label;
        let itemToAdd = null;
        let equipToAdd = null;
        if (reward.kind === 'item') {
            itemToAdd = (DB.ITEMS || []).find(i => Number(i.id) === Number(reward.itemId));
            if (!itemToAdd) return Menu.msg('その景品は準備できませんでした。');
            name = itemToAdd.name;
        } else if (reward.kind === 'equip') {
            equipToAdd = Facilities.createCasinoExchangeEquip(reward);
            if (!equipToAdd) return Menu.msg('その景品は準備できませんでした。');
            name = equipToAdd.name;
        }

        App.data.gems -= reward.cost;
        if (itemToAdd) App.data.items[itemToAdd.id] = (App.data.items[itemToAdd.id] || 0) + (reward.qty || 1);
        if (equipToAdd) App.data.inventory.push(equipToAdd);

        App.save();
        Facilities.openCasinoExchange();
        Menu.msg(`${name}を 交換しました！`);
    }
};

/**
 * カジノコアロジック
 */
const Casino = {
    betGold: 0, currentPayout: 0, isPlaying: false, targetCurrency: 'gold', currentGame: null,
    betOptions: [1000, 10000, 100000, 1000000, 10000000],
    deck: [], duDeck: [], hand: [], dealer: [],

    init: () => { Facilities.initCasino(); },

    getCurrencyLabel: (currency = Casino.targetCurrency) => currency === 'gem' ? 'GEM' : 'Gold',

    getCurrencyAmount: (currency = Casino.targetCurrency) => currency === 'gem' ? (App.data.gems || 0) : (App.data.gold || 0),

    spendCurrency: (currency, amount) => {
        if (currency === 'gem') App.data.gems = (App.data.gems || 0) - amount;
        else App.data.gold = (App.data.gold || 0) - amount;
    },

    addCurrency: (currency, amount) => {
        if (currency === 'gem') App.data.gems = (App.data.gems || 0) + amount;
        else App.data.gold = (App.data.gold || 0) + amount;
    },

    openGameSelect: (currency) => {
        Casino.targetCurrency = currency === 'gem' ? 'gem' : 'gold';
        Casino.currentGame = null;
        const unit = Casino.getCurrencyLabel();
        const html = `
            <div style="text-align:center;">
                <div style="color:#aaa; font-size:11px; margin-bottom:8px;">${unit} を賭けて遊びます</div>
                <div style="color:#ffd700; font-size:12px; margin-bottom:18px;">所持 ${unit}: ${Casino.getCurrencyAmount().toLocaleString()}</div>
                <button class="menu-btn" style="width:100%; height:45px; margin-bottom:10px; border:1px solid #fff; background:#000; color:#fff;" onclick="Casino.startGame('bj')">ブラックジャック</button>
                <button class="menu-btn" style="width:100%; height:45px; margin-bottom:0; border:1px solid #fff; background:#000; color:#fff;" onclick="Casino.startGame('poker')">ポーカー</button>
            </div>
        `;
        Facilities.showModal('casino-scene', `${unit}を賭ける`, html);
    },

    startGame: (type) => {
        Casino.currentGame = type;
        Casino.openBetSelect();
    },

    openBetSelect: () => {
        const unit = Casino.getCurrencyLabel();
        const gameName = Casino.currentGame === 'bj' ? 'ブラックジャック' : 'ポーカー';
        const current = Casino.getCurrencyAmount();
        const betButtons = Casino.betOptions.map(bet => {
            const can = current >= bet;
            return `<button class="menu-btn" style="width:100%; height:42px; margin-bottom:8px; border:1px solid ${can ? '#fff' : '#555'}; background:#000; color:${can ? '#fff' : '#666'};" ${can ? '' : 'disabled'} onclick="Casino.begin(${bet})">${bet.toLocaleString()} ${unit}</button>`;
        }).join('');
        const html = `
            <div style="text-align:center;">
                <div style="color:#aaa; font-size:11px; margin-bottom:6px;">${gameName} の掛け金を選択</div>
                <div style="color:#ffd700; font-size:12px; margin-bottom:15px;">所持 ${unit}: ${current.toLocaleString()}</div>
                ${betButtons}
                <button class="btn" style="width:100%; height:36px; margin-top:5px; background:#222; border:1px solid #777; color:#aaa;" onclick="Casino.openGameSelect('${Casino.targetCurrency}')">ゲーム選択へ戻る</button>
            </div>
        `;
        Facilities.showModal('casino-scene', "掛け金を選択", html);
    },

    setTarget: (t) => {
        Casino.targetCurrency = t === 'gem' ? 'gem' : 'gold';
    },

    begin: (bet) => {
        const currency = Casino.targetCurrency === 'gem' ? 'gem' : 'gold';
        const unit = Casino.getCurrencyLabel(currency);
        if(Casino.getCurrencyAmount(currency) < bet) return Menu.msg(`${unit}が 足りません！`);
        Casino.spendCurrency(currency, bet);
        Casino.targetCurrency = currency;
        Casino.betGold = bet;
        Casino.currentPayout = 0;
        Casino.isPlaying = true;
        
        // 4デッキ管理 (208枚)
        Casino.deck = Casino.createDeck();
        Casino.duDeck = Casino.createDeck();

        if (Casino.currentGame === 'poker') {
            Casino.hand = []; for(let i=0; i<5; i++) Casino.hand.push({...Casino.getCard(), hold:false});
            Casino.dealer = [];
        } else {
            Casino.hand = [Casino.getCard(), Casino.getCard()];
            Casino.dealer = [Casino.getCard(), Casino.getCard()];
        }
        
        Casino.saveState();
        Facilities.closeModal('casino-scene');
        Casino.renderGameUI();
    },

    saveState: () => {
        App.data.casinoState = {
            isPlaying: Casino.isPlaying,
            currentGame: Casino.currentGame,
            betGold: Casino.betGold,
            targetCurrency: Casino.targetCurrency,
            betCurrency: Casino.targetCurrency,
            hand: Casino.hand,
            dealer: Casino.dealer,
            deck: Casino.deck,
            duDeck: Casino.duDeck,
            payout: Casino.currentPayout
        };
        App.save();
    },

    renderGameUI: () => {
        const exitFn = "App.changeScene('field')";
        Facilities.setupBaseLayout('casino-scene', '勝負中', 'facility_bg_casino', '', exitFn, true);
        
        const mainDisp = document.getElementById('casino-scene-main-display');
        if (mainDisp) {
            mainDisp.innerHTML = `
                <div id="casino-board-actual" style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; padding-bottom:10px;"></div>
                <div id="casino-msg-actual" style="height:50px; color:#fff; text-align:center; font-size:14px; font-weight:bold; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; border-top:1px solid #444;"></div>
            `;
        }

        const cmdRow = document.getElementById('casino-scene-cmd-row');
        if (cmdRow) {
            cmdRow.innerHTML = `<div id="casino-actions-actual" style="display:flex; justify-content:center; gap:10px; width:100%; grid-column: span 2;"></div>`;
        }

        if (Casino.currentGame === 'poker') Casino.drawUI_Poker(Casino.hand.some(c => !c.done));
        else Casino.drawUI_BJ(false);
    },

    createDeck: () => {
        const s = ['♠','♣','♥','♦'], r = [1,2,3,4,5,6,7,8,9,10,11,12,13];
        let d = [];
        for(let i=0; i<4; i++) s.forEach(suit => r.forEach(rank => d.push({suit, rank})));
        for(let i=d.length-1; i>0; i--){ const j = Math.floor(Math.random()*(i+1)); [d[i], d[j]] = [d[j], d[i]]; }
        return d;
    },

    getCard: (isDU = false) => {
        let t = isDU ? Casino.duDeck : Casino.deck;
        if(t.length <= 5) { const n = Casino.createDeck(); if(isDU) Casino.duDeck = n; else Casino.deck = n; t = n; }
        const card = t.pop();
        Casino.saveState();
        return card;
    },

    getCardStr: (c) => {
        const r = c.rank===1?'A':c.rank===11?'J':c.rank===12?'Q':c.rank===13?'K':c.rank;
        const color = (c.suit==='♥'||c.suit==='♦') ? '#f33' : '#000';
        return `<div style="width:48px; height:68px; background:#fff; color:#000; border:1px solid #999; border-radius:4px; position:relative; display:inline-block; margin:0 3px; box-shadow:2px 2px 5px #000;">
            <div style="font-size:12px; color:${color}; position:absolute; top:2px; left:4px; font-weight:bold;">${c.suit}</div>
            <div style="font-size:24px; color:${color}; position:absolute; top:50%; left:50%; transform:translate(-50%,-40%); font-weight:bold;">${r}</div>
        </div>`;
    },

    // --- ポーカー ---
    drawUI_Poker: (canEx) => {
        const board = document.getElementById('casino-board-actual'), msg = document.getElementById('casino-msg-actual'), actions = document.getElementById('casino-actions-actual');
        if(!board || !msg || !actions) return;

        // ★配当表 (倍率順に並べ替え & 白枠)
        const payTable = `
            <div style="width:100%; font-size:9px; display:grid; grid-template-columns: 1fr 1fr; gap:2px 10px; padding:6px; border: 1px solid #fff; background:rgba(255,255,255,0.05); border-radius:4px; margin-bottom:auto;">
                <div style="display:flex; justify-content:space-between;"><span>ロイヤルフラッシュ</span><span>×500</span></div>
                <div style="display:flex; justify-content:space-between;"><span>フラッシュ</span><span>×8</span></div>
                <div style="display:flex; justify-content:space-between;"><span>ストレートフラッシュ</span><span>×100</span></div>
                <div style="display:flex; justify-content:space-between;"><span>ストレート</span><span>×5</span></div>
                <div style="display:flex; justify-content:space-between;"><span>ファイブカード</span><span>×50</span></div>
                <div style="display:flex; justify-content:space-between;"><span>スリーカード</span><span>×3</span></div>
                <div style="display:flex; justify-content:space-between;"><span>フォーカード</span><span>×20</span></div>
                <div style="display:flex; justify-content:space-between;"><span>ツーペア</span><span>×1</span></div>
                <div style="display:flex; justify-content:space-between;"><span>フルハウス</span><span>×10</span></div>
                <div style="display:flex; justify-content:space-between;"><span>J or Better</span><span>×1</span></div>
            </div>
        `;

        msg.innerHTML = `BET: ${Casino.betGold.toLocaleString()} ${Casino.getCurrencyLabel()} / 残すカードを選択`;
        let h = '<div style="display:flex; margin-top:15px;">';
        Casino.hand.forEach((c, i) => {
            const up = c.hold ? 'transform:translateY(-15px);' : '';
            h += `<div onclick="Casino.toggleHold(${i})" style="transition:0.1s; ${up}">${Casino.getCardStr(c)}<div style="font-size:10px; text-align:center; color:${c.hold?'#0ff':'#444'}; font-weight:bold;">${c.hold?'HOLD':'－'}</div></div>`;
        });
        board.innerHTML = payTable + h + '</div>';
        if(canEx) actions.innerHTML = `<button class="btn" style="width:220px; height:50px; background:#000; border:2px solid #fff; color:#fff;" onclick="Casino.finishPoker()">カード交換 / 勝負！</button>`;
    },

    toggleHold: (i) => { if(Casino.hand[i]) { Casino.hand[i].hold = !Casino.hand[i].hold; Casino.saveState(); Casino.drawUI_Poker(true); } },

    finishPoker: () => {
        Casino.hand.forEach(c => { if(!c.hold) { const n = Casino.getCard(); c.suit=n.suit; c.rank=n.rank; } c.done = true; });
        const res = Casino.checkPoker(Casino.hand);
        let payout = Math.floor(Casino.betGold * res.rate);
        Casino.currentPayout = payout;
        Casino.saveState();
        
        Casino.drawUI_Poker(false);
        const msg = document.getElementById('casino-msg-actual'), actions = document.getElementById('casino-actions-actual');
        if(res.rate > 0) {
            msg.innerHTML = `<span style="color:#f44; text-shadow: 0 0 5px #f00;">${res.name}!</span> 獲得: ${payout.toLocaleString()} ${Casino.getCurrencyLabel()}`;
            actions.innerHTML = `<button class="btn" style="width:130px; height:50px; background:#000; border:2px solid #fff; color:#fff;" onclick="Casino.startDU()">ダブルアップ</button><button class="btn" style="width:130px; height:50px; border:1px solid #fff; background:#000; color:#fff;" onclick="Casino.collect()">受け取る</button>`;
        } else {
            Casino.isPlaying = false; Casino.saveState();
            msg.innerHTML = "役なし… 残念！";
            actions.innerHTML = `<button class="btn" style="width:130px; height:50px; background:#000; border:1px solid #fff; color:#fff;" onclick="Casino.begin(Casino.betGold)">もう一度</button><button class="btn" style="width:110px; background:#444;" onclick="Facilities.initCasino()">やめる</button>`;
        }
    },

    checkPoker: (h) => {
        const r = h.map(c=>c.rank).sort((a,b)=>a-b);
        const s = h.map(c=>c.suit);
        const flush = s.every(x => x === s[0]);
        let straight = (r[4]-r[0]===4 && new Set(r).size===5);
        if(!straight && r[0]===1 && r[1]===10 && r[2]===11 && r[3]===12 && r[4]===13) straight = true;
        const cnt = {}; r.forEach(x => cnt[x] = (cnt[x]||0)+1);
        const v = Object.values(cnt).sort((a,b)=>b-a);
        if(flush && straight && r[0]===1 && r[4]===13) return {name:'ロイヤルフラッシュ', rate:500};
        if(flush && straight) return {name:'ストレートフラッシュ', rate:100};
        if(v[0]===5) return {name:'ファイブカード', rate:50};
        if(v[0]===4) return {name:'フォーカード', rate:20};
        if(v[0]===3 && v[1]===2) return {name:'フルハウス', rate:10};
        if(flush) return {name:'フラッシュ', rate:8};
        if(straight) return {name:'ストレート', rate:5};
        if(v[0]===3) return {name:'スリーカード', rate:3};
        if(v[0]===2 && v[1]===2) return {name:'ツーペア', rate:1};
        if(v[0]===2) { const pair = parseInt(Object.keys(cnt).find(k => cnt[k] === 2)); if(pair===1 || pair>=11) return {name:'Jacks or Better', rate:1}; }
        return {name:'役なし', rate:0};
    },

    // --- ブラックジャック ---
    getBJS: (h) => {
        let s = 0, a = 0;
        h.forEach(c => { let v = c.rank>10?10:c.rank; if(v===1){ a++; v=11; } s+=v; });
        while(s>21 && a>0){ s-=10; a--; }
        return s;
    },

    drawUI_BJ: (done) => {
        const board = document.getElementById('casino-board-actual'), msg = document.getElementById('casino-msg-actual'), actions = document.getElementById('casino-actions-actual');
        if(!board || !msg || !actions) return;
        const ps = Casino.getBJS(Casino.hand);
        const ds = Casino.getBJS(Casino.dealer);
        const dealerLabel = done ? `DEALER (${ds})` : "DEALER";

        const dH = done ? Casino.dealer.map(c=>Casino.getCardStr(c)).join('') : Casino.getCardStr(Casino.dealer[0]) + '<div style="width:48px; height:68px; background:#333; border:1px solid #555; display:inline-block; border-radius:5px; vertical-align:top; font-size:24px; color:#555; text-align:center; line-height:68px;">?</div>';
        board.innerHTML = `<div style="font-size:10px; color:#aaa; margin-bottom:5px;">${dealerLabel}</div><div style="height:70px;">${dH}</div><div style="height:30px; display:flex; align-items:center; justify-content:center;"><div style="width:120px; height:1px; background:#333;"></div></div><div style="font-size:10px; color:#0ff; margin-bottom:5px;">YOU (Score: ${ps})</div><div style="height:70px;">${Casino.hand.map(c=>Casino.getCardStr(c)).join('')}</div>`;
        if(done) return;
        if(ps>=21) Casino.finishBJ();
        else {
            msg.innerHTML = `HIT か STAND かを選択してください`;
            actions.innerHTML = `<button class="btn" style="width:140px; height:50px; background:#000; border:2px solid #fff; color:#fff;" onclick="Casino.hitBJ()">HIT</button><button class="btn" style="width:140px; height:50px; background:#000; border:2px solid #fff; color:#fff;" onclick="Casino.finishBJ()">STAND</button>`;
        }
    },

    hitBJ: () => { Casino.hand.push(Casino.getCard()); Casino.saveState(); Casino.drawUI_BJ(false); },

    finishBJ: () => {
        const ps = Casino.getBJS(Casino.hand);
        if(ps <= 21) while(Casino.getBJS(Casino.dealer) < 17) Casino.dealer.push(Casino.getCard());
        const ds = Casino.getBJS(Casino.dealer);
        Casino.saveState(); Casino.drawUI_BJ(true);
        const msg = document.getElementById('casino-msg-actual'), actions = document.getElementById('casino-actions-actual');
        let rate = 0;
        const isPBJ = (ps===21 && Casino.hand.length===2), isDBJ = (ds===21 && Casino.dealer.length===2);

        if(ps > 21) msg.innerHTML = "バースト！ あなたの負けです";
        else if(isPBJ) { msg.innerHTML = "<span style='color:#f44; font-size:18px; text-shadow:0 0 5px #f00;'>BLACKJACK!! (2.5倍配当)</span>"; rate = 2.5; }
        else if(ds > 21) { msg.innerHTML = "<span style='color:#f44; font-size:16px; text-shadow: 0 0 5px #f00;'>ディーラーバースト！ 勝ち！</span>"; rate = 2.0; }
        else if(ps > ds) { msg.innerHTML = "<span style='color:#f44; font-size:16px; text-shadow: 0 0 5px #f00;'>あなたの勝ちです！</span>"; rate = 2.0; }
        else if(ps === ds) { if(isDBJ) msg.innerHTML = "ディーラーBJ... 負けです"; else { msg.innerHTML = "引き分け (払い戻し)"; rate = 1.0; } }
        else msg.innerHTML = "あなたの負けです...";

        if(rate > 0) {
            let p = Math.floor(Casino.betGold * rate);
            Casino.currentPayout = p; Casino.saveState();
            msg.innerHTML += ` / 獲得: ${p.toLocaleString()} ${Casino.getCurrencyLabel()}`;
            actions.innerHTML = `<button class="btn" style="width:130px; height:50px; background:#000; border:2px solid #fff; color:#fff;" onclick="Casino.startDU()">ダブルアップ</button><button class="btn" style="width:130px; height:50px; border:1px solid #fff; background:#000; color:#fff;" onclick="Casino.collect()">受け取る</button>`;
        } else {
            Casino.isPlaying = false; Casino.saveState();
            actions.innerHTML = `<button class="btn" style="width:130px; height:50px; background:#000; border:2px solid #fff; color:#fff;" onclick="Casino.begin(Casino.betGold)">もう一度</button><button class="btn" style="width:110px; background:#444;" onclick="Facilities.initCasino()">やめる</button>`;
        }
    },

    // --- ダブルアップ ---
    startDU: () => { if(Casino.duDeck.length < 5) Casino.duDeck = Casino.createDeck(); Casino.duCard = Casino.getCard(true); Casino.saveState(); Casino.drawUI_DU(); },
    drawUI_DU: () => {
        const board = document.getElementById('casino-board-actual'), msg = document.getElementById('casino-msg-actual'), actions = document.getElementById('casino-actions-actual');
        if(!board || !msg || !actions) return;
        msg.innerHTML = `<span style="color:#0ff;">現在の配当: ${Casino.currentPayout.toLocaleString()} ${Casino.getCurrencyLabel()}</span><br>次は High か Low か？`;
        board.innerHTML = `<div style="display:flex; align-items:center; gap:25px;">${Casino.getCardStr(Casino.duCard)}<div style="font-size:24px; font-weight:bold; color:#ffd700;">VS</div><div style="width:48px; height:68px; background:#000; border:2px solid #ffd700; border-radius:4px; font-size:28px; color:#ffd700; text-align:center; line-height:68px;">?</div></div>`;
        actions.innerHTML = `<button class="btn" style="width:110px; height:50px; background:#000; border:1px solid #fff; color:#fff;" onclick="Casino.checkDU('high')">HIGH ↑</button><button class="btn" style="width:110px; height:50px; background:#000; border:1px solid #fff; color:#fff;" onclick="Casino.checkDU('low')">LOW ↓</button><button class="btn" style="width:80px; height:50px; background:#444;" onclick="Casino.collect()">降りる</button>`;
    },
    checkDU: (choice) => {
        const next = Casino.getCard(true), getV = (r) => (r===1?14:r);
        const curV = getV(Casino.duCard.rank), nxtV = getV(next.rank);
        let win = (choice==='high' && nxtV > curV) || (choice==='low' && nxtV < curV), draw = (nxtV === curV);
        document.getElementById('casino-board-actual').innerHTML = `<div style="display:flex; justify-content:center; align-items:center; gap:25px;">${Casino.getCardStr(Casino.duCard)}<div style="font-size:24px; font-weight:bold; color:#ffd700;">VS</div>${Casino.getCardStr(next)}</div>`;
        if (win || draw) {
            if(win) Casino.currentPayout *= 2; Casino.duCard = next; Casino.saveState();
            document.getElementById('casino-msg-actual').innerHTML = win ? `<span style='color:#f44; font-size:18px;'>WIN!! 配当が ${Casino.currentPayout.toLocaleString()} ${Casino.getCurrencyLabel()} に倍増！</span>` : "引き分け！ 継続します";
            document.getElementById('casino-actions-actual').innerHTML = `<button class="btn" style="width:160px; height:50px; background:#000; border:1px solid #fff; color:#fff;" onclick="Casino.drawUI_DU()">さらに勝負！</button><button class="btn" style="width:130px; height:50px; border:1px solid #fff; background:#000; color:#fff;" onclick="Casino.collect()">受け取る</button>`;
        } else {
            Casino.currentPayout = 0; Casino.isPlaying = false; App.data.casinoState.isPlaying = false; App.save();
            document.getElementById('casino-msg-actual').innerHTML = "LOSE... 全てを失った";
            document.getElementById('casino-actions-actual').innerHTML = `<button class="btn" style="width:130px; height:50px; background:#000; border:1px solid #fff; color:#fff;" onclick="Casino.begin(Casino.betGold)">もう一度</button><button class="btn" style="width:110px; background:#444;" onclick="Facilities.initCasino()">やめる</button>`;
        }
    },

    collect: () => {
        const unit = Casino.getCurrencyLabel();
        Casino.addCurrency(Casino.targetCurrency, Casino.currentPayout);
        Casino.isPlaying = false; App.data.casinoState = { isPlaying: false }; App.save();
        Menu.msg(`${Casino.currentPayout.toLocaleString()} ${unit} を手に入れた！`, () => Facilities.initCasino());
    }
};
