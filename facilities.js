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
        if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('medalKing')) return;
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
    shopStock: [],
    shopStockKey: null,

    shopTypeLabels: {
        item: '道具屋',
        weapon: '武器屋',
        armor: '防具屋'
    },

    armorTypes: ['盾', '頭', '体', '足'],

    openShopFromField: (config = {}) => {
        const type = config.shopType || config.type || 'item';
        const title = config.title || Facilities.shopTypeLabels[type] || '店';
        const rank = Math.max(1, Number(config.shopRank || config.rank || Facilities.getCurrentAreaShopRank()) || 1);
        const area = App?.data?.location?.area || 'WORLD';
        App.data.currentShop = { type, title, rank, area, openedAt: Date.now() };
        Facilities.shopStock = [];
        Facilities.shopStockKey = null;
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
        const cfg = App?.data?.currentShop || { type: 'item', title: '道具屋', rank: Facilities.getCurrentAreaShopRank() };
        cfg.type = cfg.type || 'item';
        cfg.title = cfg.title || Facilities.shopTypeLabels[cfg.type] || '店';
        cfg.rank = Math.max(1, Number(cfg.rank || Facilities.getCurrentAreaShopRank()) || 1);

        const exitFn = "App.changeScene('field')";
        const isItemShop = cfg.type === 'item';
        const cmds = isItemShop
            ? `<button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff; grid-column:span 2;" onclick="Facilities.renderShopItems()">品物を見る</button>`
            : `<button class="menu-btn" style="background:#000; border:1px solid #fff; height:40px; color:#fff; grid-column:span 2;" onclick="Facilities.refreshShopEquipStock(true)">品揃えを見直す</button>`;

        Facilities.setupBaseLayout('shop-scene', cfg.title, '', cmds, exitFn);
        const msg = document.getElementById('shop-scene-msg-content');
        if (msg) {
            msg.innerHTML = `
                「いらっしゃいませ。近くの魔物に合わせた品を揃えています」<br><br>
                <span style="color:#ffd700; font-weight:bold;">所持金: ${(App.data.gold || 0).toLocaleString()} Gold</span><br>
                <span style="color:#aaa; font-size:11px;">取扱目安: Rank ${cfg.rank}</span>
                <div id="shop-list" style="margin-top:12px;"></div>
            `;
        }

        if (isItemShop) Facilities.renderShopItems();
        else Facilities.renderShopEquip();
    },

    getItemShopLineup: (rank = 1) => {
        const allowedTypes = new Set(['HP回復', 'MP回復', '状態異常回復', '蘇生', '移動']);
        const maxRank = Math.max(1, Number(rank) || 1);
        const items = (DB.ITEMS || [])
            .filter(item => allowedTypes.has(item.type))
            .filter(item => Number(item.price || 0) > 0)
            .filter(item => Number(item.rank || 1) <= maxRank)
            .sort((a, b) => (Number(a.rank || 0) - Number(b.rank || 0)) || (Number(a.id) - Number(b.id)));

        // 移動アイテムは「道具屋」の明確な役割なので、低ランク店でも必ず扱えるようにする。
        const travelItems = (DB.ITEMS || []).filter(item => item.type === '移動' && Number(item.price || 0) > 0);
        travelItems.forEach(item => {
            if (!items.some(existing => Number(existing.id) === Number(item.id))) items.push(item);
        });
        return items;
    },

    renderShopItems: () => {
        const cfg = App?.data?.currentShop || { rank: Facilities.getCurrentAreaShopRank() };
        const list = document.getElementById('shop-list') || document.getElementById('shop-scene-msg-content');
        if (!list) return;
        const items = Facilities.getItemShopLineup(cfg.rank);
        if (items.length === 0) {
            list.innerHTML = `<div style="padding:20px; color:#888; text-align:center;">今は売れる品がありません。</div>`;
            return;
        }
        list.innerHTML = items.map(item => {
            const cost = Number(item.price || 0);
            return `<div style="border-bottom:1px solid #333; padding:10px 0;">
                <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
                    <div>
                        <div style="font-weight:bold; color:#fff;">${Facilities.escapeAttr(item.name)}</div>
                        <div style="font-size:10px; color:#aaa;">${Facilities.escapeAttr(item.type)} / Rank ${Number(item.rank || 1)}</div>
                    </div>
                    <button class="btn" style="min-width:92px; height:32px; background:#000; border:1px solid #fff; color:#fff;" onclick="Facilities.buyShopItem(${Number(item.id)}, ${cost})">${cost.toLocaleString()}G</button>
                </div>
                <div style="font-size:11px; color:#888; margin-top:4px;">${Facilities.escapeAttr(item.desc || '')}</div>
            </div>`;
        }).join('');
    },

    buyShopItem: (itemId, cost) => {
        const item = (DB.ITEMS || []).find(i => Number(i.id) === Number(itemId));
        if (!item) return Menu.msg('その品物は見つかりません。');
        const price = Math.max(0, Number(cost || item.price || 0));
        if ((App.data.gold || 0) < price) return Menu.msg('ゴールドが 足りません。');
        App.data.gold -= price;
        App.data.items[item.id] = (App.data.items[item.id] || 0) + 1;
        App.save();
        Facilities.initShop();
        Menu.msg(`${item.name}を 購入しました！`);
    },

    getEquipShopPrice: (eq) => {
        // 装備売却額は inventory 側で val/2。販売額はその2倍なので val をそのまま採用する。
        return Math.max(1, Math.floor(Number(eq?.val || 0)));
    },

    getEquipSummary: (eq) => {
        if (!eq) return '';
        const labels = { hp: 'HP', mp: 'MP', atk: '攻', def: '守', mag: '魔', mdef: '魔防', spd: '速', hit: '命中', eva: '回避', cri: '会心' };
        const base = Object.entries(eq.data || {})
            .filter(([, v]) => typeof v === 'number' && Number(v) !== 0)
            .map(([k, v]) => `${labels[k] || k}${v > 0 ? '+' : ''}${v}`)
            .slice(0, 7);
        const opts = (eq.opts || []).map(o => `${o.label || o.key}${o.val > 0 ? '+' : ''}${o.val}${o.unit || ''}${o.rarity ? `(${o.rarity})` : ''}`);
        const traits = (eq.traits || []).length > 0 ? [`特性${eq.traits.length}個`] : [];
        return [...base, ...opts, ...traits].join(' / ');
    },

    refreshShopEquipStock: (force = false) => {
        Facilities.shopStock = [];
        Facilities.shopStockKey = null;
        Facilities.renderShopEquip(force);
    },

    generateShopEquipmentStock: (type, rank, count = 6) => {
        const stock = [];
        const targetType = type === 'weapon' ? '武器' : 'armor';
        const isTarget = (eq) => targetType === '武器' ? eq?.type === '武器' : Facilities.armorTypes.includes(eq?.type);
        let attempts = 0;
        while (stock.length < count && attempts < count * 80) {
            attempts++;
            const eq = App.createEquipByFloor('shop', rank, 2);
            if (!isTarget(eq)) continue;
            eq.shopPrice = Facilities.getEquipShopPrice(eq);
            stock.push(eq);
        }
        // ランダム抽選の偏りで埋まらなかった場合の保険。
        while (stock.length < count) {
            const pool = (window.EQUIP_MASTER || []).filter(base => !base.noRandom)
                .filter(base => targetType === '武器' ? base.type === '武器' : Facilities.armorTypes.includes(base.type))
                .filter(base => Number(base.rank || 1) <= Math.max(1, Number(rank) || 1));
            const base = pool[Math.floor(Math.random() * pool.length)] || (window.EQUIP_MASTER || [])[0];
            const eq = base ? App.createEquipById(base.eid, 2) : App.createEquipByFloor('shop', rank, 2);
            if (eq) {
                eq.source = 'shop';
                eq.shopPrice = Facilities.getEquipShopPrice(eq);
                stock.push(eq);
            } else break;
        }
        return stock;
    },

    renderShopEquip: () => {
        const cfg = App?.data?.currentShop || { type: 'weapon', rank: Facilities.getCurrentAreaShopRank() };
        const list = document.getElementById('shop-list') || document.getElementById('shop-scene-msg-content');
        if (!list) return;
        const stockKey = `${cfg.type}:${cfg.rank}:${cfg.openedAt || 0}`;
        if (Facilities.shopStockKey !== stockKey || !Array.isArray(Facilities.shopStock)) {
            Facilities.shopStock = Facilities.generateShopEquipmentStock(cfg.type, cfg.rank, 6);
            Facilities.shopStockKey = stockKey;
        }
        if (Facilities.shopStock.length === 0) {
            list.innerHTML = `<div style="padding:20px; color:#888; text-align:center;">今は売れる装備がありません。</div>`;
            return;
        }
        list.innerHTML = `
            <div style="font-size:11px; color:#aaa; margin-bottom:8px; line-height:1.5;">
                すべて +2 / 効果ランダム。販売額は売却額の2倍相当です。<br>
                品揃えは入店ごとに変わります。
            </div>
            ${Facilities.shopStock.map((eq, index) => {
                const cost = Facilities.getEquipShopPrice(eq);
                return `<div style="border-bottom:1px solid #333; padding:10px 0;">
                    <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
                        <div>
                            <div style="font-weight:bold; color:#fff;">${Facilities.escapeAttr(eq.name)}</div>
                            <div style="font-size:10px; color:#aaa;">${Facilities.escapeAttr(eq.type)} / Rank ${Number(eq.rank || 1)} / 売却目安 ${Math.floor(cost / 2).toLocaleString()}G</div>
                        </div>
                        <button class="btn" style="min-width:92px; height:32px; background:#000; border:1px solid #fff; color:#fff;" onclick="Facilities.buyShopEquip(${index})">${cost.toLocaleString()}G</button>
                    </div>
                    <div style="font-size:11px; color:#888; margin-top:4px;">${Facilities.escapeAttr(Facilities.getEquipSummary(eq))}</div>
                </div>`;
            }).join('')}
        `;
    },

    buyShopEquip: (index) => {
        const eq = Facilities.shopStock && Facilities.shopStock[index];
        if (!eq) return Menu.msg('その装備は見つかりません。');
        const price = Facilities.getEquipShopPrice(eq);
        if ((App.data.gold || 0) < price) return Menu.msg('ゴールドが 足りません。');
        App.data.gold -= price;
        const purchased = JSON.parse(JSON.stringify(eq));
        purchased.id = Date.now() + Math.random().toString(36).substring(2);
        purchased.source = 'shop';
        delete purchased.shopPrice;
        App.data.inventory.push(purchased);
        Facilities.shopStock.splice(index, 1);
        App.save();
        Facilities.initShop();
        Menu.msg(`${purchased.name}を 購入しました！`);
    },

    // --- 3. カジノ ---
    initCasino: () => {
        if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('casino')) return;
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
