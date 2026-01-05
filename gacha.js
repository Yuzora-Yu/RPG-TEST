/* gacha.js (完全版: 黒転演出 + 提供割合 + 激アツ演出 + フィールド映り込み完全防止版) */
const Gacha = {
    queue: [],
    currentIndex: 0,
    isSkipped: false,
    pendingCount: 0,
	
    // ★レアリティ別の星を返すヘルパー
    getStars: (r) => {
        const stars = { 'R': '★★', 'SR': '★★★', 'SSR': '★★★★', 'UR': '★★★★★', 'EX': '★★★★★★' };
        return stars[r] || '';
    },

    // --- 1. init (ガチャ開始時に、画面全体に「絶対に透けない壁」を作る) ---
    init: () => {
        const gachaScreen = document.getElementById('sub-screen-gacha');
        if (gachaScreen) {
            // 背景を完全に不透明な黒に固定し、いかなる場合もフィールドが透けないようにする
            gachaScreen.style.backgroundColor = '#000';
            gachaScreen.style.backgroundImage = 'none';
            gachaScreen.style.position = 'fixed';
            gachaScreen.style.top = '0';
            gachaScreen.style.left = '0';
            gachaScreen.style.width = '100%';
            gachaScreen.style.height = '100%';
            gachaScreen.style.zIndex = '500'; // フィールドより上のレイヤー
        }
        document.getElementById('gacha-gem').innerText = App.data.gems;
        Gacha.switchView('menu');
    },
	
    switchView: (view) => {
        document.getElementById('gacha-menu-view').style.display = (view==='menu'?'flex':'none');
        document.getElementById('gacha-confirm-view').style.display = (view==='confirm'?'flex':'none');
    },

    showRates: () => {
        const modal = document.getElementById('modal-rates');
        const content = document.getElementById('rates-content');
        modal.style.zIndex = 750;
        modal.style.display = 'flex';
        
        let html = `<h3>レアリティ別提供割合</h3>`;
        for(let r of CONST.RARITY.slice().reverse()) {
            if (CONST.GACHA_RATES[r] > 0) {
                html += `<div>${r}: ${CONST.GACHA_RATES[r]}%</div>`;
            }
        }
		
        html += `<hr><h3>排出対象一覧</h3>`;
        for(let r of CONST.RARITY.slice().reverse()) {
            if (CONST.GACHA_RATES[r] <= 0) continue;
            const targets = DB.CHARACTERS.filter(c => c.rarity === r);
            if(targets.length > 0) {
                let color = '#fff';
                if(r==='EX') color = '#ff0'; else if(r==='UR') color = '#f0f'; else if(r==='SSR') color = '#f44'; else if(r==='SR') color = 'gold';
                html += `<div style="margin-top:10px; color:${color}; font-weight:bold;">[${r}]</div>`;
                
                targets.forEach(c => {
                    const owned = App.data.characters.find(oc => oc.charId === c.id);
                    const displayName = (owned && owned.name) || c.name;
                    html += `<div>${displayName} (${c.job})</div>`;
                });
            }
        }
        content.innerHTML = html;
    },

    pull: (count) => {
        const cost = count * 300;
        if(App.data.gems < cost) { alert("GEMが足りません"); return; }
        Gacha.pendingCount = count;
        document.getElementById('gacha-confirm-msg').innerHTML = `${count}連ガチャ<br>消費GEM: <span style="color:#ffd700;">${cost}</span><br>よろしいですか？`;
        Gacha.switchView('confirm');
    },

    cancelPull: () => {
        Gacha.switchView('menu');
        Gacha.pendingCount = 0;
    },
	
    // --- 2. executePull (目隠しレイヤーを最前面に即座に展開) ---
    executePull: () => {
        const count = Gacha.pendingCount;
        const cost = count * 300;
        if(App.data.gems < cost) { 
            alert("GEMが足りません"); 
            Gacha.switchView('menu'); 
            return; 
        }

        // ★最重要：計算を始める前に、即座に白い遮断レイヤーを「最前面」で表示する
        const wo = document.getElementById('white-out-overlay');
        if (wo) {
            wo.style.transition = 'none'; // フェードを待たずに即座に表示
            wo.style.display = 'block';
            wo.style.opacity = '1';
            wo.style.backgroundColor = '#fff';
            wo.style.zIndex = '9000'; // 結果画面よりもさらに上に配置
            void wo.offsetWidth; // 描画を強制
        }

        // データの更新
        App.data.gems -= cost;
        document.getElementById('gacha-gem').innerText = App.data.gems;
        Gacha.queue = [];
        let hasEX = false;
        let hasUR = false;

        for(let i=0; i<count; i++) {
            const result = Gacha.lottery();
            if(result.rarity === 'EX') { hasEX = true; hasUR = true; }
            if(result.rarity === 'UR') { hasUR = true; }

            const owned = App.data.characters.find(c => c.charId === result.id);
            if(owned) {
                owned.limitBreak = Math.min(99, (owned.limitBreak||0) + 1);
                result.isNew = false;
                result.limitBreak = owned.limitBreak;
            } else {
                const newChar = { 
                    uid: 'c' + Date.now() + i, charId: result.id, name: result.name, job: result.job, 
                    rarity: result.rarity, hp: result.hp, mp: result.mp, atk: result.atk, def: result.def, 
                    spd: result.spd, mag: result.mag, level: 1, limitBreak: 0, equips: {}, sp: result.sp || 0, img: result.img || null
                };
                App.data.characters.push(newChar);
                result.isNew = true; result.limitBreak = 0;
            }
            Gacha.queue.push(result);
        }
        App.save();
        
        Gacha.switchView('none');

        // アニメーション進行へ
        Gacha.playWhiteFlash(hasEX, hasUR, count); 
    },
	
    lottery: () => {
        const r = Math.random() * 100;
        let current = 0;
        let selectedRarity = 'R';
        for(let rarity of CONST.RARITY) {
            let rate = CONST.GACHA_RATES[rarity];
            if(r < current + rate) { selectedRarity = rarity; break; }
            current += rate;
        }
        const pool = DB.CHARACTERS.filter(c => c.rarity === selectedRarity && c.id < 1000);
        
        if (pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            return JSON.parse(JSON.stringify(pick));
        } else {
            return JSON.parse(JSON.stringify(DB.CHARACTERS[0]));
        }
    },
    
    // --- playWhiteFlash ---
    playWhiteFlash: (hasEX, hasUR, count) => {
        const wo = document.getElementById('white-out-overlay');
        const flash = document.getElementById('flash-overlay');
        if(!wo) return;

        wo.classList.remove('black-turn');
        wo.style.display = 'block';
        wo.style.zIndex = 9000;
        wo.style.opacity = 1;

        if (count >= 10 && hasUR && Math.random() < 0.1) {
            setTimeout(() => {
                if (flash) {
                    flash.style.display = 'block';
                    flash.className = 'flash-multiple';
                    setTimeout(() => { flash.style.display = 'none'; flash.className = ''; }, 800);
                }
            }, 300);
        }

        if (hasEX) {
            setTimeout(() => { wo.classList.add('black-turn'); }, 200);
        }

        setTimeout(() => {
            document.getElementById('sub-screen-gacha').style.display = 'none';
            const stage = document.getElementById('gacha-performance');
            stage.style.display = 'flex';
            Gacha.currentIndex = 0;
            Gacha.isSkipped = false;
            Gacha.drawNextCard();
            
            // 徐々にフェードアウト
            wo.style.transition = 'opacity 0.8s ease';
            wo.style.opacity = 0;
            setTimeout(() => { 
                wo.style.display = 'none'; 
                wo.classList.remove('black-turn');
                wo.style.zIndex = 6000; // 元のzIndexに戻す
            }, 800);
        }, hasEX ? 2500 : 800);
    },
	
    // --- drawNextCard ---
    drawNextCard: () => {
        if (Gacha.isSkipped) return;
        if (Gacha.currentIndex >= Gacha.queue.length) { Gacha.finish(); return; }
        const char = Gacha.queue[Gacha.currentIndex];

        const performanceArea = document.getElementById('gacha-performance');
        const stage = document.getElementById('gacha-stage');
        const flash = document.getElementById('flash-overlay');
        stage.innerHTML = '';

        performanceArea.style.pointerEvents = 'auto'; 
        performanceArea.style.transition = 'none';
        performanceArea.classList.remove('confirmed');
        performanceArea.style.background = '#000';
        setTimeout(() => { performanceArea.style.transition = 'background 0.8s ease-in-out'; }, 50);

        const master = DB.CHARACTERS.find(m => m.id === char.id);
        const owned = App.data.characters.find(c => c.charId === char.id);
		
        const displayName = (owned && owned.name) || (master ? master.name : char.name);
        const displayImg = (owned && owned.img) || (master ? master.img : null);
        const imgTag = displayImg 
            ? `<img src="${displayImg}" style="width:130px; height:130px; object-fit:contain; margin-bottom:5px; border:none !important; background:transparent !important; pointer-events:none;">` 
            : `<div style="width:130px; height:130px; margin-bottom:5px; pointer-events:none;"></div>`;

        const card = document.createElement('div');
        card.className = 'gacha-card-scene';

        const isURorEX = ['UR', 'EX'].includes(char.rarity);
        const isStealth = isURorEX && Math.random() < 0.2;

        let backClass = 'rare-silver';
        let preGlowClass = "";
        
        if (!isStealth) {
            if (char.rarity === 'SSR') { backClass = 'rare-gold'; preGlowClass = "pre-glow-ssr"; }
            if (char.rarity === 'UR') { backClass = 'rare-rainbow'; preGlowClass = "pre-glow-ur"; }
            if (char.rarity === 'EX') { backClass = 'rare-rainbow'; preGlowClass = "pre-glow-ex"; }
        }

        let specialClass = "";
        if(char.rarity === 'UR') specialClass = "style-aurora";
        else if(char.rarity === 'EX') specialClass = "style-majestic";
        else if(char.rarity === 'SSR') specialClass = "style-gold";

        card.innerHTML = `
            <div class="card-face card-back ${backClass} ${preGlowClass}">
                <div class="card-inner-border"></div> <div style="font-size:40px; opacity:0.3;">?</div>
            </div>
            <div class="card-face card-front ${specialClass}" style="background:${specialClass ? '' : Gacha.getRarityColor(char.rarity)};">
                <div class="card-inner-border"></div> <div style="color:#ffd700; font-size:12px; margin-bottom:2px; font-weight:bold; text-shadow:1px 1px 2px #000;">${Gacha.getStars(char.rarity)}</div>
                <div style="font-size:18px; font-weight:bold; color:${Gacha.getRarityTextColor(char.rarity)}; margin-bottom:5px; text-shadow: 1px 1px 2px #000;">${char.rarity}</div>
                ${imgTag}
                <div style="font-size:16px; font-weight:bold; color:#fff; text-shadow:1px 1px 2px #000;">${displayName}</div>
                <div style="font-size:11px; color:#ccc; text-shadow: 1px 1px 1px #000;">${char.job}</div>
                ${char.isNew ? '<div class="new-badge">NEW!</div>' : '<div style="color:#fff; font-size:10px; background:rgba(0,0,0,0.5); padding:2px 8px; border-radius:10px; margin-top:5px;">限界突破!</div>'}
            </div>`;
        stage.appendChild(card);

        const doFlip = () => {
            if (isURorEX) { performanceArea.classList.add('confirmed'); }
            card.classList.add('flipped');
        };

        performanceArea.onclick = () => {
            if (card.classList.contains('flipped')) {
                Gacha.currentIndex++;
                Gacha.drawNextCard();
                return;
            }
            performanceArea.style.pointerEvents = 'none'; 
            const shouldFlash = isURorEX && isStealth;
            if (flash && shouldFlash) {
                flash.style.display = 'block'; flash.className = 'flash-multiple';
                setTimeout(() => { if(flash){ flash.style.display = 'none'; flash.className = ''; } }, 800);
            }
            let delay = shouldFlash ? 600 : 250;
            setTimeout(() => { doFlip(); performanceArea.style.pointerEvents = 'auto'; }, delay);
        };
    },

    skip: (e) => { 
        if(e) e.stopPropagation();
        Gacha.isSkipped = true; 
        Gacha.finish(); 
    },
	
    // --- finish (レイアウトを維持したまま一覧/単発分岐) ---
    finish: () => {
        const performanceArea = document.getElementById('gacha-performance');
        const overlay = document.getElementById('gacha-result-overlay');
        const flash = document.getElementById('flash-overlay');

        if(flash) { flash.style.display = 'none'; flash.className = ''; }
        
        performanceArea.style.transition = 'none';
        performanceArea.classList.remove('confirmed');
        performanceArea.style.background = '#000'; 
        performanceArea.style.display = 'none';
        overlay.style.display = 'flex';
        
        const list = document.getElementById('gacha-results-list');
        list.innerHTML = '';

        if (Gacha.queue.length === 1) {
            // 【単発ガチャ】特製カード表示
            const c = Gacha.queue[0];
            const master = DB.CHARACTERS.find(m => m.id === c.id);
            const owned = App.data.characters.find(oc => oc.charId === c.id);
            const displayName = (owned && owned.name) || (master ? master.name : c.name);
            const displayImg = (owned && owned.img) || (master ? master.img : null);
            const st = master || c;

            let specialClass = "";
            if(c.rarity === 'UR') specialClass = "style-aurora";
            else if(c.rarity === 'EX') specialClass = "style-majestic";
            else if(c.rarity === 'SSR') specialClass = "style-gold";

            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.alignItems = 'center';
            list.style.justifyContent = 'center';
            list.style.width = '100%';
            list.style.gap = '20px';

            list.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:15px; width:100%; user-select:none;">
                    <div style="width:220px; height:320px; position:relative; perspective: 1000px; flex-shrink:0;">
                        <div class="card-face card-front ${specialClass}" style="transform:none; width:100%; height:100%; position:relative; border-radius:15px; overflow:hidden; display:flex; flex-direction:column; align-items:center; border: 2px solid rgba(255,255,255,0.8); box-shadow: 0 15px 35px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,0.4); background: ${specialClass ? '' : Gacha.getRarityColor(c.rarity)};">
                            <div style="position:absolute; top:10px; left:10px; z-index:2; background:rgba(0,0,0,0.6); padding:2px 8px; border-radius:5px; border:1px solid rgba(255,215,0,0.5); font-weight:bold; font-size:18px; color:${Gacha.getRarityTextColor(c.rarity)}; text-shadow:0 0 5px #000;">${c.rarity}</div>
                            <div style="position:absolute; top:12px; right:10px; z-index:2; color:#ffd700; font-size:11px; text-shadow:1px 1px 2px #000;">${Gacha.getStars(c.rarity)}</div>
                            <div style="width:165px; height:165px; margin-top:40px; margin-bottom:10px; display:flex; align-items:center; justify-content:center; position:relative;">
                                <div style="position:absolute; width:140px; height:140px; background:radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%); border-radius:50%;"></div>
                                <img src="${displayImg || ''}" style="max-width:100%; max-height:100%; object-fit:contain; position:relative; z-index:1; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.8));">
                            </div>
                            <div style="width:90%; background:rgba(0,0,0,0.5); border-radius:8px; padding:8px 5px; border-top:1px solid rgba(255,255,255,0.2); backdrop-filter:blur(2px); margin-top:auto; margin-bottom:15px; text-align:center; position:relative;">
                                <div style="font-size:17px; font-weight:bold; color:#fff; letter-spacing:1px; text-shadow:1px 1px 2px #000; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:2px;">${displayName}</div>
                                <div style="font-size:11px; color:#ccc; letter-spacing:0.5px;">— ${c.job} —</div>
                                ${c.isNew ? '<div style="position:absolute; top:-12px; right:-10px; background:#f00; color:#fff; font-size:11px; padding:2px 8px; border-radius:4px; font-weight:bold; box-shadow:0 2px 4px #000; z-index:3; transform:rotate(10deg);">NEW!</div>' : ''}
                            </div>
                            <div style="position:absolute; inset:5px; border:1px solid rgba(255,255,255,0.1); border-radius:12px; pointer-events:none;"></div>
                        </div>
                    </div>
                    <div style="background:rgba(0,0,0,0.8); border:1px solid #444; border-radius:10px; padding:12px; width:220px; display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px; color:#eee; border-top:2px solid #ffd700; box-shadow:0 5px 15px rgba(0,0,0,0.5);">
                         <div style="display:flex; justify-content:space-between;"><span style="color:#aaa;">HP</span> <span>${st.hp}</span></div>
                         <div style="display:flex; justify-content:space-between;"><span style="color:#aaa;">MP</span> <span>${st.mp}</span></div>
                         <div style="display:flex; justify-content:space-between;"><span style="color:#aaa;">攻撃</span> <span>${st.atk}</span></div>
                         <div style="display:flex; justify-content:space-between;"><span style="color:#aaa;">守備</span> <span>${st.def}</span></div>
                         <div style="display:flex; justify-content:space-between;"><span style="color:#aaa;">素早</span> <span>${st.spd}</span></div>
                         <div style="display:flex; justify-content:space-between;"><span style="color:#aaa;">魔力</span> <span>${st.mag}</span></div>
                         ${!c.isNew ? `<div style="grid-column: span 2; text-align:center; color:#ffd700; font-size:11px; margin-top:5px; border-top:1px solid #333; padding-top:5px; font-weight:bold;">限界突破！ (LB.${c.limitBreak})</div>` : ''}
                    </div>
                </div>
            `;
        } else {
            // 【10連ガチャ】グリッド表示
            list.style.display = 'grid'; 
            list.style.flexDirection = '';
            list.style.alignItems = '';
            list.style.justifyContent = '';
            list.style.gap = '10px 5px'; 
            list.style.width = '';

            Gacha.queue.forEach(c => {
                const master = DB.CHARACTERS.find(m => m.id === c.id);
                const owned = App.data.characters.find(oc => oc.charId === c.id);
                const displayName = (owned && owned.name) || (master ? master.name : c.name);
                const displayImg = (owned && owned.img) || (master ? master.img : null);
                const st = master || c;
                
                const thumbHtml = displayImg 
                    ? `<img src="${displayImg}" style="width:100%; height:100%; object-fit:cover; border-radius:3px; background:transparent;">` 
                    : '';

                const div = document.createElement('div'); 
                div.className = 'gacha-result-card';
                if(c.rarity === 'UR') div.classList.add('style-aurora');
                else if(c.rarity === 'EX') div.classList.add('style-majestic');
                if(c.rarity === 'SSR') div.classList.add('result-glow');
                div.style.overflow = 'visible'; 
                
                div.innerHTML = `
                    <div style="margin-top:5px; color:#ffd700; font-size:8px; margin-bottom:1px; font-weight:bold; text-shadow:1px 1px 0px #000;">${Gacha.getStars(c.rarity)}</div>
                    <div style="margin-top:2px; color:${Gacha.getRarityTextColor(c.rarity)}; font-weight:bold; text-shadow:1px 1px 0px #000; font-size:11px;">${c.rarity}</div>
                    <div class="thumb" style="background:transparent; border:1px solid rgba(255,255,255,0.1); border-radius:4px; margin:4px auto; width:40px; height:40px; overflow:hidden; display:flex; align-items:center; justify-content:center;">${thumbHtml}</div>
                    <div style="font-size:9px; overflow:hidden; white-space:nowrap; width:100%; font-weight:bold; color:#fff;">${displayName}</div>
                    ${c.isNew ? '<span class="new-badge">NEW</span>' : '<span style="font-size:8px; color:#aaa;">限界突破</span>'}
                    <div style="margin-top:5px; font-size:8px; margin-top:2px; line-height:1.3; color:#eee;">
                        HP:${st.hp}<br>MP:${st.mp}<br>攻:${st.atk}<br>防:${st.def}<br>速:${st.spd}<br>魔:${st.mag}
                    </div>`;
                list.appendChild(div);
            });
        }

        document.getElementById('btn-gacha-retry').innerText = `${Gacha.pendingCount}連リトライ`;
        document.getElementById('result-gem-display').innerText = App.data.gems;
    },

    // --- 3. retryPull (遮断が完了した「後」に画面を切り替える) ---
    retryPull: () => { 
        // 1. まず白い壁を展開（executePull内で実施）
        Gacha.executePull(); 
        
        // 2. 壁が被さった状態で、背後の結果画面を消す
        // これにより、結果画面が消えた瞬間にフィールドが映り込む隙間を物理的に塞ぎます
        const resultOverlay = document.getElementById('gacha-result-overlay');
        if (resultOverlay) {
            resultOverlay.style.display = 'none'; 
        }
    },

    // --- 4. closeResult (終了処理とHUDの更新) ---
    closeResult: () => { 
        document.getElementById('gacha-result-overlay').style.display = 'none'; 
        document.getElementById('sub-screen-gacha').style.display = 'flex'; 
        Gacha.init(); // 再度背景を黒に保つ
        
        // フィールド画面(HUD)のGEM表示を強制同期
        const fieldGemDisp = document.getElementById('disp-gem');
        if (fieldGemDisp) {
            fieldGemDisp.innerText = App.data.gems;
        }

        if(typeof Menu !== 'undefined') Menu.renderPartyBar(); 
    },
	
    getRarityColor: (r) => { if(r==='R') return '#444'; if(r==='SR') return '#664400'; if(r==='SSR') return '#800'; if(r==='UR') return '#404'; if(r==='EX') return '#000'; return '#333'; },
    getRarityTextColor: (r) => { if(r==='R') return 'silver'; if(r==='SR') return 'gold'; if(r==='SSR') return '#ff4444'; if(r==='UR') return '#ff00ff'; if(r==='EX') return '#ffff00'; return '#fff'; }
};