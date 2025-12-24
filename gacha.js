/* gacha.js (完全版: 黒転演出 + 提供割合 + 激アツ演出) */
const Gacha = {
    queue: [],
    currentIndex: 0,
    isSkipped: false,
    pendingCount: 0,
	
	// ★追加: レアリティ別の星を返すヘルパー
    getStars: (r) => {
        const stars = { 'R': '★', 'SR': '★★', 'SSR': '★★★', 'UR': '★★★★', 'EX': '★★★★★' };
        return stars[r] || '';
    },

    init: () => {
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
		
		// --- showRates 関数内の排出対象一覧ループ部分 ---
        html += `<hr><h3>排出対象一覧</h3>`;
        for(let r of CONST.RARITY.slice().reverse()) {
            if (CONST.GACHA_RATES[r] <= 0) continue;
            const targets = DB.CHARACTERS.filter(c => c.rarity === r);
            if(targets.length > 0) {
                let color = '#fff';
                if(r==='EX') color = '#ff0'; else if(r==='UR') color = '#f0f'; else if(r==='SSR') color = '#f44'; else if(r==='SR') color = 'gold';
                html += `<div style="margin-top:10px; color:${color}; font-weight:bold;">[${r}]</div>`;
                
                targets.forEach(c => {
                    // ★追加：セーブデータ（所有キャラクター）から名前を検索
                    const owned = App.data.characters.find(oc => oc.charId === c.id);
                    // 所有していればその名前を、なければデータベースのデフォルト名を使用
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
	
	// --- executePull (判定フラグの修正) ---
    executePull: () => {
        const count = Gacha.pendingCount;
        const cost = count * 300;
        if(App.data.gems < cost) { alert("GEMが足りません"); Gacha.switchView('menu'); return; }

        App.data.gems -= cost;
        document.getElementById('gacha-gem').innerText = App.data.gems;
        Gacha.queue = [];
        let hasEX = false;
        let hasUR = false; // ★追加：高レア告知用

        for(let i=0; i<count; i++) {
            const result = Gacha.lottery();
            
            // ★修正：UR または EX が出た場合に hasUR を true にする
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
        // ★修正：3つの引数を渡す
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
        const pool = DB.CHARACTERS.filter(c => c.rarity === selectedRarity);
        
        // ★修正: JSON.parse(JSON.stringify(...)) を使って
        // マスタデータの「参照」ではなく「完全なコピー」を返すようにする
        if (pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            return JSON.parse(JSON.stringify(pick));
        } else {
            return JSON.parse(JSON.stringify(DB.CHARACTERS[0]));
        }
    },
    
	// --- playWhiteFlash (引数の受け取りを修正) ---
    // ★修正：(hasEX, hasUR, count) を受け取るように変更
    playWhiteFlash: (hasEX, hasUR, count) => {
        const wo = document.getElementById('white-out-overlay');
        const flash = document.getElementById('flash-overlay');
        wo.classList.remove('black-turn');
        wo.style.display = 'block';
        wo.style.zIndex = 6000;
        void wo.offsetWidth; 
        wo.style.opacity = 1;

        // ②10連かつUR以上確定時、10%の確率で告知フラッシュ
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
            wo.style.opacity = 0;
            setTimeout(() => { wo.style.display = 'none'; wo.classList.remove('black-turn'); }, 800);
        }, hasEX ? 2500 : 800);
    },
	
	// --- drawNextCard 修正版 (昇格・フラッシュ・白銀背景) ---
    drawNextCard: () => {
        if (Gacha.isSkipped) return;
        if (Gacha.currentIndex >= Gacha.queue.length) { Gacha.finish(); return; }
        const char = Gacha.queue[Gacha.currentIndex];

        const performanceArea = document.getElementById('gacha-performance');
        const stage = document.getElementById('gacha-stage');
        const flash = document.getElementById('flash-overlay');
        stage.innerHTML = '';

        // 背景リセット
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

        // 昇格演出判定
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
        else if(char.rarity === 'SSR') specialClass = "style-gold"; // SSRを金に統一

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
            const shouldFlash = isURorEX && isStealth; // 昇格時のみフラッシュ

            if (flash && shouldFlash) {
                flash.style.display = 'block'; flash.className = 'flash-multiple';
                setTimeout(() => { if(flash){ flash.style.display = 'none'; flash.className = ''; } }, 800);
            }

            let delay = shouldFlash ? 600 : 250;
            setTimeout(() => { doFlip(); performanceArea.style.pointerEvents = 'auto'; }, delay);
        };
    },

    skip: (e) => { 
        if(e) e.stopPropagation(); // バブリングによるフラッシュ暴発を防止
        Gacha.isSkipped = true; 
        Gacha.finish(); 
    },
	
	// --- finish 修正版 (画像背景の透過) ---
    finish: () => {
        const performanceArea = document.getElementById('gacha-performance');
        const overlay = document.getElementById('gacha-result-overlay');
		
		const flash = document.getElementById('flash-overlay');

        // ★追加: 遷移時にフラッシュを完全に消去する
        if(flash) { 
            flash.style.display = 'none'; 
            flash.className = ''; 
            flash.style.opacity = '1'; 
        }
		
        performanceArea.style.transition = 'none';
        performanceArea.classList.remove('confirmed');
        performanceArea.style.background = '#000'; 
        overlay.style.display = 'flex';
        performanceArea.style.display = 'none';
		
        const list = document.getElementById('gacha-results-list');
        list.innerHTML = '';

        Gacha.queue.forEach(c => {
            const master = DB.CHARACTERS.find(m => m.id === c.id);
            const owned = App.data.characters.find(oc => oc.charId === c.id);
			
			// ★修正：名前もセーブデータ優先、なければマスタから取得
            const displayName = (owned && owned.name) || (master ? master.name : c.name);
            const displayImg = (owned && owned.img) || (master ? master.img : null);
            
            const thumbHtml = displayImg 
			? `<img src="${displayImg}" style="width:100%; height:100%; object-fit:cover; border-radius:3px; background:transparent;">` // 背景透過
			: '';

            const div = document.createElement('div'); 
            div.className = 'gacha-result-card';
            // ★修正: URとEXのみ特別な背景クラスを付与
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
                    HP:${c.hp}<br>MP:${c.mp}<br>攻:${c.atk}<br>防:${c.def}<br>速:${c.spd}<br>魔:${c.mag}
                </div>`;
            list.appendChild(div);
        });

        // 遷移時にフラッシュなどは呼び出さず、即座に表示を切り替え
        overlay.style.display = 'flex';
        document.getElementById('gacha-performance').style.display = 'none';
        
        document.getElementById('btn-gacha-retry').innerText = `${Gacha.pendingCount}連リトライ`;
        document.getElementById('result-gem-display').innerText = App.data.gems;
    },


    retryPull: () => { document.getElementById('gacha-result-overlay').style.display = 'none'; Gacha.executePull(); },
    closeResult: () => { document.getElementById('gacha-result-overlay').style.display = 'none'; document.getElementById('sub-screen-gacha').style.display = 'flex'; Gacha.init(); if(typeof Menu!=='undefined') Menu.renderPartyBar(); },
    getRarityColor: (r) => { if(r==='R') return '#444'; if(r==='SR') return '#664400'; if(r==='SSR') return '#800'; if(r==='UR') return '#404'; if(r==='EX') return '#000'; return '#333'; },
    getRarityTextColor: (r) => { if(r==='R') return 'silver'; if(r==='SR') return 'gold'; if(r==='SSR') return '#ff4444'; if(r==='UR') return '#ff00ff'; if(r==='EX') return '#ffff00'; return '#fff'; }
};
