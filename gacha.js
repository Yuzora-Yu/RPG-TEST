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

 
/* gacha.js - drawNextCard の大幅強化版 */

    drawNextCard: () => {
        if (Gacha.isSkipped) return;
        if (Gacha.currentIndex >= Gacha.queue.length) {
            Gacha.finish();
            return;
        }

        const char = Gacha.queue[Gacha.currentIndex];
        const stage = document.getElementById('gacha-stage');
        stage.innerHTML = '';

        // 演出レイヤーの取得とリセット
        const layer = document.getElementById('gacha-effect-layer');
        const effBg = document.getElementById('effect-bg');
        const effText = document.getElementById('effect-text');
        const effRay = document.getElementById('effect-ray');
        
        if(layer) {
            layer.style.display = 'none';
            effBg.className = ''; effText.className = ''; effRay.className = '';
            effText.innerHTML = '';
        }

        const card = document.createElement('div');
        card.className = 'gacha-card-scene';
        
        // --- 演出パターン決定ロジック ---
        // 高レア(UR/EX)の場合、カード背面をあえて「銀(R)」や「金(SR)」に偽装する（昇格演出用）
        let isFakeSilver = false;
        let playPromotion = false; // 昇格演出フラグ
        let playGodRay = false;    // 天撃演出フラグ
        let playCutIn = false;     // カットインフラグ

        if (['UR', 'EX'].includes(char.rarity)) {
            const rnd = Math.random();
            if (rnd < 0.33) {
                playPromotion = true; // 33%で昇格演出（銀→虹）
                isFakeSilver = true;
            } else if (rnd < 0.66) {
                playGodRay = true;    // 33%で天撃演出
            } else {
                playCutIn = true;     // 33%でカットイン
            }
        }

        // カード背面のクラス決定
        let backClass = 'rare-silver'; // デフォルト銀
        if (!isFakeSilver) {
            if(['SSR'].includes(char.rarity)) backClass = 'rare-gold';
            if(['UR','EX'].includes(char.rarity)) backClass = 'rare-rainbow';
        }

        // カード生成
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

        // --- タップ時の処理 ---
        card.onclick = () => {
            if(card.classList.contains('flipped')) {
                // 既に開いていれば次へ
                Gacha.currentIndex++;
                Gacha.drawNextCard();
                return;
            }

            // 操作ブロック
            card.style.pointerEvents = 'none';

            // --- 演出実行関数 ---
            const doFlip = () => {
                card.classList.add('flipped');
                card.style.pointerEvents = 'auto'; // 操作再開
                
                // 開いた瞬間のフラッシュ (高レアのみ)
                if(['SSR','UR','EX'].includes(char.rarity)) {
                    const flash = document.getElementById('flash-overlay');
                    flash.style.display = 'block';
                    flash.className = 'flash-anim'; // index.htmlにある既存クラス
                    setTimeout(()=> { flash.style.display='none'; flash.className=''; }, 300);
                }
            };

            // 1. 【昇格演出】（銀色がガタガタ震えて虹色に割れる）
            if (playPromotion) {
                card.classList.add('card-crack-anim'); // 激しく震える
                setTimeout(() => {
                    // 背面を虹色に差し替え
                    const back = card.querySelector('.card-back');
                    back.className = 'card-face card-back rare-rainbow';
                    
                    // 強烈なフラッシュ
                    const flash = document.getElementById('flash-overlay');
                    flash.style.display = 'block';
                    flash.className = 'flash-anim';
                    setTimeout(() => {
                        flash.style.display='none'; 
                        flash.className='';
                        card.classList.remove('card-crack-anim');
                        doFlip(); // めくる
                    }, 200);
                }, 500); // 0.5秒タメる
                return;
            }

            // 2. 【天撃演出】（画面暗転＆虹色の光）
            if (playGodRay) {
                layer.style.display = 'block';
                effBg.className = 'god-ray-bg';
                effRay.className = 'god-ray-beam';
                
                setTimeout(() => {
                    layer.style.display = 'none';
                    doFlip();
                }, 1500); // 1.5秒演出
                return;
            }

            // 3. 【カットイン演出】（文字がドーン！）
            if (playCutIn) {
                layer.style.display = 'block';
                effBg.className = 'god-ray-bg'; // 背景暗く
                effText.className = 'cut-in-text';
                effText.innerHTML = char.rarity === 'EX' ? "神 降 臨" : "激 熱 !!";
                
                setTimeout(() => {
                    layer.style.display = 'none';
                    doFlip();
                }, 800); // 0.8秒演出
                return;
            }

            // 通常オープン
            doFlip();
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
