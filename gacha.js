/* gacha.js */

const Gacha = {
    queue: [],
    currentIndex: 0,
    isSkipped: false,
    pendingCount: 0,

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
        
        // ★ここが重要：JSで強制的に優先度をガチャ画面(500)より高くする
        modal.style.zIndex = 750;
        modal.style.display = 'flex';
        
        let html = `<h3>レアリティ別提供割合</h3>`;
        
        // 確率表示（N:0% は表示しないように > 0 でフィルタ）
        for(let r of CONST.RARITY.slice().reverse()) {
            if (CONST.GACHA_RATES[r] > 0) {
                html += `<div>${r}: ${CONST.GACHA_RATES[r]}%</div>`;
            }
        }

        html += `<hr><h3>排出対象一覧</h3>`;
        
        // キャラ一覧表示
        for(let r of CONST.RARITY.slice().reverse()) {
            // 排出率0%のレアリティ（Nなど）はリストに出さない
            if (CONST.GACHA_RATES[r] <= 0) continue;

            const targets = DB.CHARACTERS.filter(c => c.rarity === r);
            if(targets.length > 0) {
                // 文字色設定
                let color = '#fff';
                if(r==='EX') color = '#ff0';
                else if(r==='UR') color = '#f0f';
                else if(r==='SSR') color = '#f44';
                else if(r==='SR') color = 'gold';

                html += `<div style="margin-top:10px; color:${color}; font-weight:bold;">[${r}]</div>`;
                targets.forEach(c => html += `<div>${c.name} (${c.job})</div>`);
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

    executePull: () => {
        const count = Gacha.pendingCount;
        const cost = count * 300;
        if(App.data.gems < cost) { alert("GEMが足りません"); Gacha.switchView('menu'); return; }

        App.data.gems -= cost;
        document.getElementById('gacha-gem').innerText = App.data.gems;
        
        Gacha.queue = [];
        let hasEX = false;

        for(let i=0; i<count; i++) {
            const result = Gacha.lottery();
            if(result.rarity === 'EX') hasEX = true;
            
            const owned = App.data.characters.find(c => c.charId === result.id);
            if(owned) {
                owned.limitBreak = Math.min(99, (owned.limitBreak||0) + 1);
                result.isNew = false;
                result.limitBreak = owned.limitBreak;
                result.hp = owned.hp; result.mp = owned.mp; result.atk = owned.atk;
                result.def = owned.def; result.spd = owned.spd; result.mag = owned.mag;
            } else {
                const newChar = {
                    uid: 'c' + Date.now() + i,
                    charId: result.id,
                    name: result.name, job: result.job, rarity: result.rarity,
                    hp: result.hp, mp: result.mp, atk: result.atk, def: result.def, spd: result.spd, mag: result.mag,
                    level: 1, limitBreak: 0, equips: {}
                };
                App.data.characters.push(newChar);
                result.isNew = true;
                result.limitBreak = 0;
            }
            Gacha.queue.push(result);
        }
        App.save();
        
        // 白転演出開始
        Gacha.playWhiteFlash(hasEX);
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
        return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : DB.CHARACTERS[0];
    },

    playWhiteFlash: (hasEX) => {
        const wo = document.getElementById('white-out-overlay');
        
        // EX確定時は途中で黒くなるクラスを付与
        if(hasEX) wo.classList.add('black-turn');
        else wo.classList.remove('black-turn');
        
        wo.style.display = 'block';
        void wo.offsetWidth; // リフロー
        wo.style.opacity = 1;

        setTimeout(() => {
            document.getElementById('sub-screen-gacha').style.display = 'none';
            document.getElementById('gacha-performance').style.display = 'flex';
            Gacha.currentIndex = 0;
            Gacha.isSkipped = false;
            
            Gacha.drawNextCard();
            
            wo.style.opacity = 0;
            setTimeout(() => {
                wo.style.display = 'none';
                wo.classList.remove('black-turn');
            }, 500);
        }, hasEX ? 1500 : 500); // EX時は少し溜める
    },

    drawNextCard: () => {
        if (Gacha.isSkipped) return;
        if (Gacha.currentIndex >= Gacha.queue.length) {
            Gacha.finish();
            return;
        }

        const char = Gacha.queue[Gacha.currentIndex];
        const stage = document.getElementById('gacha-stage');
        stage.innerHTML = '';

        const card = document.createElement('div');
        card.className = 'gacha-card-scene';
        
        // 裏面色: SRはRと同じ(silver)
        let backClass = 'rare-silver';
        if(['SSR'].includes(char.rarity)) backClass = 'rare-gold';
        if(['UR','EX'].includes(char.rarity)) backClass = 'rare-rainbow';
        
        // 昇格演出判定 (UR/EXはたまにSilverから昇格)
        let isPromotion = false;
        if(['UR','EX'].includes(char.rarity) && Math.random() < 0.3) {
            backClass = 'rare-silver';
            isPromotion = true;
        }

        card.innerHTML = `
            <div class="card-face card-back ${backClass}">
                <div style="font-size:40px;">?</div>
            </div>
            <div class="card-face card-front" style="background:${Gacha.getRarityColor(char.rarity)}">
                <div style="font-size:20px; font-weight:bold; color:${Gacha.getRarityTextColor(char.rarity)}">${char.rarity}</div>
                <div style="margin:10px 0; font-size:16px;">${char.name}</div>
                <div style="font-size:12px;">${char.job}</div>
                ${char.isNew ? '<div class="new-badge">NEW!</div>' : '<div style="color:#fff; font-size:10px;">限界突破!</div>'}
            </div>
        `;
        stage.appendChild(card);

        const triggerOpen = () => {
             card.classList.add('flipped');
             if(['UR'].includes(char.rarity)) {
                 // 通常の高レアは単発フラッシュ
                 const flash = document.getElementById('flash-overlay');
                 flash.style.display = 'block';
                 flash.className = 'flash-anim';
                 setTimeout(()=> { flash.style.display='none'; flash.className=''; }, 300);
             }
             Gacha.nextStep();
        };

        card.onclick = () => {
            if(card.classList.contains('flipped')) {
                // めくった後は次へ
                Gacha.currentIndex++;
                Gacha.drawNextCard();
                return;
            }

            // 昇格演出: 激しい揺れ＋フラッシュして裏面変化
            if(isPromotion) {
                // 画面揺れ
                document.getElementById('game-container').classList.add('heavy-shake-anim');
                setTimeout(() => document.getElementById('game-container').classList.remove('heavy-shake-anim'), 500);
                
                // フラッシュ
                const flash = document.getElementById('flash-overlay');
                flash.style.display = 'block';
                flash.className = 'flash-anim';
                
                // 色変化
                setTimeout(() => {
                    const back = card.querySelector('.card-back');
                    back.className = 'card-face card-back rare-rainbow';
                    flash.style.display = 'none'; 
                    flash.className = '';
                    
                    // 自動で開く
                    setTimeout(triggerOpen, 200);
                }, 200); // フラッシュのピークで色変え

                isPromotion = false;
                return; // ここで一旦処理終了、自動オープンへ
            }

            // EX演出: フリーズ -> 3連フラッシュ -> 開く
            if (char.rarity === 'EX') {
                card.style.pointerEvents = 'none'; // 操作不能
                
                // 暗転 (ノイズ)
                const fz = document.getElementById('freeze-overlay');
                fz.classList.add('noise');
                fz.style.display = 'block';
                
                setTimeout(() => {
                    fz.style.display = 'none';
                    fz.classList.remove('noise');
                    
                    // 3連フラッシュ
                    const flash = document.getElementById('flash-overlay');
                    flash.style.display = 'block';
                    flash.className = 'flash-triple-anim';

                    setTimeout(() => {
                        flash.style.display = 'none';
                        flash.className = '';
                        card.classList.add('flipped');
                        
                        // 次へ進むために操作可能に戻す
                        card.style.pointerEvents = 'auto';
                        Gacha.nextStep();
                    }, 500); // フラッシュ終了後
                }, 3000); // 3秒フリーズ
            } else {
                // 通常オープン
                triggerOpen();
            }
        };
    },

    nextStep: () => {
        // タップ待ちにするため、自動では進まない (タップで currentIndex++ して drawNextCard)
    },

    skip: () => {
        Gacha.isSkipped = true;
        Gacha.finish();
    },

    finish: () => {
        document.getElementById('gacha-performance').style.display = 'none';
        document.getElementById('freeze-overlay').style.display = 'none';
        
        const overlay = document.getElementById('gacha-result-overlay');
        const list = document.getElementById('gacha-results-list');
        list.innerHTML = '';
        
        Gacha.queue.forEach(c => {
            const div = document.createElement('div');
            div.className = 'gacha-result-card';
            if(['UR','EX'].includes(c.rarity)) div.classList.add('result-glow');
            
            div.innerHTML = `
                <div style="color:${Gacha.getRarityTextColor(c.rarity)}; font-weight:bold;">${c.rarity}</div>
                <div class="thumb"></div>
                <div style="font-size:9px; overflow:hidden; white-space:nowrap; width:100%;">${c.name}</div>
                ${c.isNew ? '<span class="new-badge">NEW</span>' : '<span style="font-size:8px; color:#aaa;">限界突破</span>'}
                <div style="font-size:8px; margin-top:2px; line-height:1.2;">
                    HP:${c.hp} MP:${c.mp}<br>
                    攻:${c.atk} 防:${c.def}<br>
                    速:${c.spd} 魔:${c.mag}
                </div>
            `;
            list.appendChild(div);
        });

        const retryBtn = document.getElementById('btn-gacha-retry');
        retryBtn.innerText = `${Gacha.pendingCount}連リトライ`;
        document.getElementById('result-gem-display').innerText = App.data.gems;
        
        overlay.style.display = 'flex';
    },
    
    retryPull: () => {
        document.getElementById('gacha-result-overlay').style.display = 'none';
        Gacha.executePull();
    },

    closeResult: () => {
        document.getElementById('gacha-result-overlay').style.display = 'none';
        document.getElementById('sub-screen-gacha').style.display = 'flex';
        Gacha.init(); // 表示更新
        if(typeof Menu!=='undefined') Menu.renderPartyBar();
    },

    getRarityColor: (r) => {
        if(r==='R') return '#444';
        if(r==='SR') return '#664400';
        if(r==='SSR') return '#800';
        if(r==='UR') return '#404';
        if(r==='EX') return '#000';
        return '#333';
    },
    getRarityTextColor: (r) => {
        if(r==='R') return 'silver';
        if(r==='SR') return 'gold';
        if(r==='SSR') return '#ff4444';
        if(r==='UR') return '#ff00ff';
        if(r==='EX') return '#ffff00';
        return '#fff';
    },
    getRarityBorder: (r) => {
        if(r==='R') return 'silver';
        if(r==='SR') return 'gold';
        if(r==='SSR') return '#ff4444';
        if(r==='UR') return '#ff00ff';
        if(r==='EX') return '#ffff00';
        return '#fff';
    }
};
