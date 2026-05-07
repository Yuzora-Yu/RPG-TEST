/* ==========================================================================
   facilities.js (バグ完全修正・ポーカーUI刷新・DQ風レイアウト)
   ========================================================================== */

const Facilities = {
    teleportFloor: 1,

    /**
     * DQ風ベースレイアウト構築
     * IDの重複によるバグを防ぐため、モーダルやメッセージエリアにシーン固有の接尾辞を付与します。
     */
    setupBaseLayout: (sceneId, title, bgKey, commandsHtml, exitFn, isLocked = false) => {
        const container = document.getElementById(sceneId);
        if (!container) return;

        // 背景画像取得 (assets.jsのGRAPHICS参照)
        const g = (typeof GRAPHICS !== 'undefined' && GRAPHICS.images) ? GRAPHICS.images : {};
        let bgUrl = "";
        if (g[bgKey] && g[bgKey].src) bgUrl = g[bgKey].src;

        // レイアウトのリセットと構築
        container.style.cssText = "display:flex; flex-direction:column; background:#000; height:100%; overflow:hidden; position:relative; font-family: 'DotGothic16', sans-serif;";
        
        container.innerHTML = `
            <div style="position:absolute; top:10px; right:10px; z-index:1000;">
                <button class="btn" style="padding:6px 15px; font-size:11px; border:2px solid #fff; background:${isLocked?'#333':'#000'}; color:${isLocked?'#666':'#fff'};" 
                    onclick="${isLocked ? '' : exitFn}" ${isLocked ? 'disabled' : ''}>
                    ${isLocked ? '勝負中' : '▶ 外へ出る'}
                </button>
            </div>

            <div style="width:100%; height:56.25vw; max-height:220px; background:#000 url('${bgUrl}') no-repeat center/cover; position:relative; flex-shrink:0; border-bottom:4px double #fff;">
                <div style="position:absolute; bottom:10px; left:10px; background:rgba(0,0,0,0.85); border:2px solid #fff; padding:3px 12px; color:#fff; font-size:14px;">
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
                        onclick="${isLocked ? '' : exitFn}" ${isLocked ? 'disabled' : ''}>▶ 出る</button>
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
        const cmds = `
            <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Facilities.stayInn(50)">▶ 泊まる (50Gold)</button>
            <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Facilities.openTeleport()">▶ 転送の扉</button>
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
            <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff; ${hasWedge ? '' : 'grid-column: span 2;'}" onclick="Facilities.openMedalMenu()">▶ メダルを交換する</button>
            ${hasWedge ? `<button class="menu-btn" style="background:#000; border:1px solid #f44; height:40px; color:#f44;" onclick="Facilities.challengeEstark()">▶ 災厄に挑む</button>` : ''}
        `;
        Facilities.setupBaseLayout('medal-scene', 'メダル交換所', 'facility_bg_medal', cmds, exitFn);
        const medals = App.data.items[99] || 0;
        document.getElementById('medal-scene-msg-content').innerHTML = `
            「よくぞ参った。メダルを褒美と交換しよう」<br><br>
            <span style="color:#ffd700; font-weight:bold;">所持メダル: ${medals} 枚</span>
        `;
    },

// ★追加: エスターク戦開始ロジック
    challengeEstark: () => {
        Menu.confirm("「災厄の楔」が<br>不気味に脈動している……<br>地獄の帝王を呼び覚ましますか？<br><span style='color:#f44; font-size:11px;'>※この戦いからは逃げられません</span>", () => {
            App.data.battle = {
                active: true,
                isBossBattle: true,
                isEstark: true, // エスターク戦専用フラグ
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
            const can = current >= r.medals;
            let detail = (r.type === 'item') ? (DB.ITEMS.find(it => it.id === r.id)?.desc || "不思議な道具") : `Rank.${r.base.rank} 指定部位の＋３確定装備`;
            html += `<div style="border: 1px solid #444; margin-bottom: 8px; padding: 10px; opacity:${can?1:0.5}; background:rgba(255,255,255,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">
                    <div style="font-weight:bold; font-size:14px; color:#fff;">${r.name}</div>
                    <button class="btn" style="min-width:75px; height:30px;" ${can?'':'disabled'} onclick="Facilities.execMedal(${JSON.stringify(r).replace(/"/g, '&quot;')})">${r.medals}枚</button>
                </div>
                <div style="font-size:10px; color:#aaa; line-height:1.4;">${detail}</div>
            </div>`;
        });
        Facilities.showModal('medal-scene', "メダル景品リスト", html);
    },

// --- メダル交換の実行処理 (特殊装備・レプリカ対応版) ---
    execMedal: (r) => {
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


    // --- 3. カジノ ---
    initCasino: () => {
        if (!App.data.casinoState) App.data.casinoState = { isPlaying: false, currentGame: null };
        
        // 勝負中であればUIを復元
        if (App.data.casinoState.isPlaying) {
             Casino.isPlaying = true;
             Casino.currentGame = App.data.casinoState.currentGame;
             Casino.betGold = App.data.casinoState.betGold;
             Casino.targetCurrency = App.data.casinoState.targetCurrency;
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
            <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Casino.startGame('poker')">▶ ポーカー</button>
            <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff;" onclick="Casino.startGame('bj')">▶ ブラックジャック</button>
            <button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; grid-column: span 2; color:#fff;" onclick="Facilities.openCasinoShop()">▶ 道具を買う</button>
        `;
        Facilities.setupBaseLayout('casino-scene', 'カジノ', 'facility_bg_casino', cmds, exitFn);
        document.getElementById('casino-scene-msg-content').innerHTML = `
            「夢の宮殿へようこそ！」<br><br>
            <span style="color:#ffd700;">Gold: ${App.data.gold.toLocaleString()} / GEM: ${App.data.gems.toLocaleString()}</span>
        `;
    },

    openCasinoShop: () => {
        const floor = (App.data.dungeon && App.data.dungeon.maxFloor) ? App.data.dungeon.maxFloor : 0;
        const items = DB.ITEMS.filter(i => i.rank <= floor && i.type !== '貴重品');
        let html = "";
        items.forEach(it => {
            const cost = it.price || 0;
            html += `<div style="border-bottom: 1px solid #333; padding: 10px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                    <div style="font-weight:bold; font-size:13px; color:#fff;">${it.name}</div>
                    <button class="btn" style="min-width:85px; height:30px; border:1px solid #fff; background:#000;" onclick="Facilities.buyCasItem(${it.id}, ${cost})">${cost.toLocaleString()} Gold</button>
                </div>
                <div style="font-size:10px; color:#888;">${it.desc}</div>
            </div>`;
        });
        Facilities.showModal('casino-scene', "道具屋", html);
    },

    buyCasItem: (id, cost) => {
        if(App.data.gold < cost) return Menu.msg("ゴールドが 足りません。");
        App.data.gold -= cost; App.data.items[id] = (App.data.items[id] || 0) + 1;
        App.save(); Menu.msg("購入しました！");
    }
};

/**
 * カジノコアロジック
 */
const Casino = {
    betGold: 0, currentPayout: 0, isPlaying: false, targetCurrency: 'gem', currentGame: null,
    deck: [], duDeck: [], hand: [], dealer: [],

    init: () => { Facilities.initCasino(); },

    startGame: (type) => {
        Casino.currentGame = type;
        const html = `
            <div style="text-align:center;">
                <div style="color:#aaa; font-size:11px; margin-bottom:15px;">受取通貨と賭け金を設定</div>
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <button class="btn" id="cas-tg-gem-btn" style="flex:1; height:40px; border:2px solid #fff; background:#000;" onclick="Casino.setTarget('gem')">GEM</button>
                    <button class="btn" id="cas-tg-gold-btn" style="flex:1; height:40px; border:1px solid #444; background:#000;" onclick="Casino.setTarget('gold')">Gold</button>
                </div>
                <button class="menu-btn" style="width:100%; height:45px; margin-bottom:10px; border:1px solid #fff; background:#000; color:#fff;" onclick="Casino.begin(100000)">100,000 Gold</button>
                <button class="menu-btn" style="width:100%; height:45px; border:1px solid #fff; background:#000; color:#fff;" onclick="Casino.begin(1000000)">1,000,000 Gold</button>
            </div>
        `;
        Facilities.showModal('casino-scene', "勝負の設定", html);
        Casino.targetCurrency = 'gem';
    },

    setTarget: (t) => {
        Casino.targetCurrency = t;
        document.getElementById('cas-tg-gem-btn').style.border = t==='gem' ? '2px solid #fff' : '1px solid #444';
        document.getElementById('cas-tg-gold-btn').style.border = t==='gold' ? '2px solid #fff' : '1px solid #444';
    },

    begin: (bet) => {
        if(App.data.gold < bet) return Menu.msg("ゴールドが足りません！");
        App.data.gold -= bet; Casino.betGold = bet; Casino.isPlaying = true;
        
        // 4デッキ管理 (208枚)
        Casino.deck = Casino.createDeck();
        Casino.duDeck = Casino.createDeck();

        if (Casino.currentGame === 'poker') {
            Casino.hand = []; for(let i=0; i<5; i++) Casino.hand.push({...Casino.getCard(), hold:false});
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

        msg.innerHTML = `BET: ${Casino.betGold.toLocaleString()} Gold / 残すカードを選択`;
        let h = '<div style="display:flex; margin-top:15px;">';
        Casino.hand.forEach((c, i) => {
            const up = c.hold ? 'transform:translateY(-15px);' : '';
            h += `<div onclick="Casino.toggleHold(${i})" style="transition:0.1s; ${up}">${Casino.getCardStr(c)}<div style="font-size:10px; text-align:center; color:${c.hold?'#0ff':'#444'}; font-weight:bold;">${c.hold?'HOLD':'－'}</div></div>`;
        });
        board.innerHTML = payTable + h + '</div>';
        if(canEx) actions.innerHTML = `<button class="btn" style="width:220px; height:50px; background:#000; border:2px solid #fff; color:#fff;" onclick="Casino.finishPoker()">▶ カード交換 / 勝負！</button>`;
    },

    toggleHold: (i) => { if(Casino.hand[i]) { Casino.hand[i].hold = !Casino.hand[i].hold; Casino.saveState(); Casino.drawUI_Poker(true); } },

    finishPoker: () => {
        Casino.hand.forEach(c => { if(!c.hold) { const n = Casino.getCard(); c.suit=n.suit; c.rank=n.rank; } c.done = true; });
        const res = Casino.checkPoker(Casino.hand);
        let payout = (Casino.targetCurrency==='gem') ? Math.floor((Casino.betGold/1000)*res.rate) : Math.floor(Casino.betGold*res.rate);
        Casino.currentPayout = payout;
        Casino.saveState();
        
        Casino.drawUI_Poker(false);
        const msg = document.getElementById('casino-msg-actual'), actions = document.getElementById('casino-actions-actual');
        if(res.rate > 0) {
            msg.innerHTML = `<span style="color:#f44; text-shadow: 0 0 5px #f00;">${res.name}!</span> 獲得: ${payout.toLocaleString()} ${Casino.targetCurrency.toUpperCase()}`;
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
            actions.innerHTML = `<button class="btn" style="width:140px; height:50px; background:#000; border:2px solid #fff; color:#fff;" onclick="Casino.hitBJ()">▶ HIT</button><button class="btn" style="width:140px; height:50px; background:#000; border:2px solid #fff; color:#fff;" onclick="Casino.finishBJ()">▶ STAND</button>`;
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
            let p = (Casino.targetCurrency==='gem') ? Math.floor((Casino.betGold/1000)*rate) : Math.floor(Casino.betGold*rate);
            Casino.currentPayout = p; Casino.saveState();
            msg.innerHTML += ` / 獲得: ${p.toLocaleString()} ${Casino.targetCurrency.toUpperCase()}`;
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
        msg.innerHTML = `<span style="color:#0ff;">現在の配当: ${Casino.currentPayout.toLocaleString()} ${Casino.targetCurrency.toUpperCase()}</span><br>次は High か Low か？`;
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
            document.getElementById('casino-msg-actual').innerHTML = win ? `<span style='color:#f44; font-size:18px;'>WIN!! 配当が ${Casino.currentPayout.toLocaleString()} に倍増！</span>` : "引き分け！ 継続します";
            document.getElementById('casino-actions-actual').innerHTML = `<button class="btn" style="width:160px; height:50px; background:#000; border:1px solid #fff; color:#fff;" onclick="Casino.drawUI_DU()">さらに勝負！</button><button class="btn" style="width:130px; height:50px; border:1px solid #fff; background:#000; color:#fff;" onclick="Casino.collect()">受け取る</button>`;
        } else {
            Casino.currentPayout = 0; Casino.isPlaying = false; App.data.casinoState.isPlaying = false; App.save();
            document.getElementById('casino-msg-actual').innerHTML = "LOSE... 全てを失った";
            document.getElementById('casino-actions-actual').innerHTML = `<button class="btn" style="width:130px; height:50px; background:#000; border:1px solid #fff; color:#fff;" onclick="Casino.begin(Casino.betGold)">もう一度</button><button class="btn" style="width:110px; background:#444;" onclick="Facilities.initCasino()">やめる</button>`;
        }
    },

    collect: () => {
        const unit = Casino.targetCurrency.toUpperCase();
        if(Casino.targetCurrency==='gem') App.data.gems += Casino.currentPayout; else App.data.gold += Casino.currentPayout;
        Casino.isPlaying = false; App.data.casinoState = { isPlaying: false }; App.save();
        Menu.msg(`${Casino.currentPayout.toLocaleString()} ${unit} を手に入れた！`, () => Facilities.initCasino());
    }
};
