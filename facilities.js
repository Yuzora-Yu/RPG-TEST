/* facilities.js (完全版: 宿屋・メダル・カジノ統合) */

const Facilities = {
    // --- 宿屋 ---
    initInn: () => {
        const container = document.getElementById('inn-content');
        const cost = 50;
        container.innerHTML = `
            <div style="font-size:16px; margin-bottom:20px;">
                ようこそ、旅人よ。<br>
                1泊 ${cost} G です。<br>
                HPとMPが全回復します。
            </div>
            <div style="margin-bottom:20px; font-size:20px; color:#ffd700;">
                所持金: ${App.data.gold} G
            </div>
            <div style="display:flex; gap:20px; justify-content:center;">
                <button class="menu-btn" onclick="Facilities.stayInn(${cost})">泊まる</button>
                <button class="menu-btn" style="background:#555;" onclick="App.changeScene('field')">出る</button>
            </div>
        `;
    },

    stayInn: (cost) => {
        if(App.data.gold < cost) {
            Menu.msg("お金が足りないようだ。");
            return;
        }
        Menu.confirm("一泊しますか？", () => {
            App.data.gold -= cost;
            App.data.characters.forEach(c => {
                const stats = App.calcStats(c);
                c.currentHp = stats.maxHp;
                c.currentMp = stats.maxMp;
            });
            App.save();
            Facilities.initInn();
            Menu.msg("ぐっすり休んで体力が回復した！");
        });
    },

    // --- メダル王 ---
    initMedal: () => {
        const container = document.getElementById('medal-list');
        container.innerHTML = '';
        const currentMedals = App.data.items[99] || 0;
        document.getElementById('medal-count').innerText = currentMedals;

        DB.MEDAL_REWARDS.forEach(r => {
            const div = document.createElement('div');
            div.className = 'list-item';
            let note = r.type==='item' ? '道具' : '<span style="color:#ffd700; font-weight:bold;">装備(+3確定)</span>';

            div.innerHTML = `
                <div>
                    <div style="font-weight:bold">${r.name}</div>
                    <div style="font-size:10px; color:#aaa;">${note}</div>
                </div>
                <button class="btn" style="background:${currentMedals>=r.medals ? '#333' : '#222'}; color:${currentMedals>=r.medals ? '#fff' : '#555'}">
                    交換 ${r.medals}枚
                </button>
            `;
            
            div.querySelector('button').onclick = () => {
                if(currentMedals < r.medals) {
                    Menu.msg("メダルが足りません");
                    return;
                }
                Menu.confirm(`${r.name} を交換しますか？`, () => {
                    App.data.items[99] -= r.medals;
                    if(r.type === 'item') {
                        App.data.items[r.id] = (App.data.items[r.id] || 0) + r.count;
                        Menu.msg(`${r.name} を入手しました！`, () => Facilities.initMedal());
                    } else if(r.type === 'equip') {
                        const base = r.base;
                        const eq = {
                            id: Date.now() + Math.random().toString(),
                            rank: base.rank || 1, name: base.name, type: base.type, val: base.val * 2.5, 
                            data: JSON.parse(JSON.stringify(base.data)), opts: [], plus: 3
                        };
                        for(let i=0; i<3; i++) {
                            const tierRatio = Math.min(1, eq.rank / 100);
                            const rule = DB.OPT_RULES[Math.floor(Math.random() * DB.OPT_RULES.length)];
                            let rarity = 'N';
                            const rarRnd = Math.random() + (tierRatio * 0.3); 
                            if(rarRnd > 0.98 && rule.allowed.includes('EX')) rarity='EX';
                            else if(rarRnd > 0.90 && rule.allowed.includes('UR')) rarity='UR';
                            else if(rarRnd > 0.75 && rule.allowed.includes('SSR')) rarity='SSR';
                            else if(rarRnd > 0.55 && rule.allowed.includes('SR')) rarity='SR';
                            else if(rarRnd > 0.30 && rule.allowed.includes('R')) rarity='R';
                            else rarity = rule.allowed[0];
                            const min = rule.min[rarity]||1, max = rule.max[rarity]||10;
                            eq.opts.push({ key: rule.key, elm: rule.elm, label: rule.name, val: Math.floor(Math.random() * (max - min + 1)) + min, unit: rule.unit, rarity: rarity });
                        }
                        eq.name += '+3';
                        if(App.checkSynergy(eq)) eq.isSynergy = true;
                        App.data.inventory.push(eq);
                        Menu.msg(`${eq.name} を入手しました！`, () => Facilities.initMedal());
                    }
                    App.save();
                });
            };
            container.appendChild(div);
        });
    }
};

// --- カジノ機能 (GOLD消費 -> GEM獲得) ---
const Casino = {
    betGold: 0,
    currentGame: null,
    deck: [],
    hand: [],
    dealerHand: [],
    
    init: () => {
        document.getElementById('casino-gem').innerText = App.data.gems;
        document.getElementById('casino-area-title').style.display = 'flex';
        document.getElementById('casino-area-game').style.display = 'none';
        
        // 所持GOLD表示を追加
        let goldDisplay = document.getElementById('casino-gold-display');
        if(!goldDisplay) {
            goldDisplay = document.createElement('div');
            goldDisplay.id = 'casino-gold-display';
            goldDisplay.style.color = '#ffd700';
            goldDisplay.style.marginBottom = '20px';
            const titleArea = document.getElementById('casino-area-title');
            titleArea.insertBefore(goldDisplay, titleArea.firstChild);
        }
        goldDisplay.innerText = `所持金: ${App.data.gold} G`;
    },

    startGame: (gameType) => {
        // ベット額選択ダイアログ
        Menu.choice(
            "賭け金(GOLD)を選択してください\nレート: 100G = 1GEM換算",
            "10,000 G (100GEM級)", () => Casino.readyGame(gameType, 10000),
            "100,000 G (1000GEM級)", () => Casino.readyGame(gameType, 100000)
        );
    },

    readyGame: (gameType, bet) => {
        if(App.data.gold < bet) { Menu.msg("GOLDが足りません"); return; }
        
        App.data.gold -= bet;
        Casino.betGold = bet;
        Casino.currentGame = gameType;
        App.save();

        document.getElementById('casino-area-title').style.display = 'none';
        document.getElementById('casino-area-game').style.display = 'flex';
        
        if(gameType === 'poker') Casino.startPoker();
        if(gameType === 'bj') Casino.startBJ();
    },

    // --- 共通: トランプ機能 ---
    createDeck: () => {
        const suits = ['♠','♣','♥','♦'];
        const ranks = [1,2,3,4,5,6,7,8,9,10,11,12,13];
        const deck = [];
        suits.forEach(s => ranks.forEach(r => deck.push({suit:s, rank:r})));
        for(let i=deck.length-1; i>0; i--){
            const r = Math.floor(Math.random()*(i+1));
            [deck[i], deck[r]] = [deck[r], deck[i]];
        }
        return deck;
    },
    
    getCardStr: (c) => {
        const r = c.rank===1?'A':c.rank===11?'J':c.rank===12?'Q':c.rank===13?'K':c.rank;
        const color = (c.suit==='♥'||c.suit==='♦') ? '#f66' : '#fff';
        return `<span style="color:${color}; font-size:24px; background:#333; padding:5px; border-radius:4px; border:1px solid #888; width:40px; display:inline-block; text-align:center;">${c.suit}${r}</span>`;
    },

    // --- ポーカー ---
    startPoker: () => {
        Casino.deck = Casino.createDeck();
        Casino.hand = Casino.deck.splice(0, 5).map(c => ({...c, hold:false}));
        Casino.renderPoker(true);
    },

    renderPoker: (canDraw) => {
        const board = document.getElementById('casino-board');
        const actions = document.getElementById('casino-actions');
        const msg = document.getElementById('casino-msg');
        
        msg.innerHTML = `BET: <span style="color:#ffd700">${Casino.betGold} G</span><br>交換するカードをタップしてください`;
        
        let html = '<div style="display:flex; gap:5px; justify-content:center;">';
        Casino.hand.forEach((c, i) => {
            const style = c.hold ? 'border:2px solid #ffd700; transform:translateY(-10px);' : 'border:1px solid #444;';
            html += `<div onclick="Casino.toggleHold(${i})" style="cursor:pointer; transition:all 0.1s; ${style}">
                ${Casino.getCardStr(c)}
                <div style="font-size:10px; text-align:center; color:${c.hold?'#ffd700':'#555'}">${c.hold?'HOLD':'-'}</div>
            </div>`;
        });
        html += '</div>';
        board.innerHTML = html;

        if(canDraw) {
            actions.innerHTML = `<button class="btn" style="width:120px; height:50px; font-size:16px;" onclick="Casino.drawPoker()">交換 / 勝負</button>`;
        } else {
            actions.innerHTML = `<button class="btn" onclick="Casino.init()">戻る</button>`;
        }
    },

    toggleHold: (idx) => {
        if(document.querySelector('#casino-actions button').innerText === '戻る') return;
        Casino.hand[idx].hold = !Casino.hand[idx].hold;
        Casino.renderPoker(true);
    },

    drawPoker: () => {
        Casino.hand.forEach(c => {
            if(!c.hold) {
                const newCard = Casino.deck.pop();
                c.suit = newCard.suit;
                c.rank = newCard.rank;
            }
        });
        
        // 役判定
        const result = Casino.checkPokerHand(Casino.hand);
        const payout = Math.floor((Casino.betGold / 100) * result.rate); // 100G = 1GEM換算 * 倍率
        
        Casino.renderPoker(false);
        const msg = document.getElementById('casino-msg');
        if(result.rate > 0) {
            msg.innerHTML = `<span style="color:#f88; font-size:18px;">${result.name}!</span><br>配当: <span style="color:#4f4;">${payout} GEM</span>`;
            App.data.gems += payout;
            App.save();
        } else {
            msg.innerHTML = "残念...<br>配当なし";
        }
    },

    checkPokerHand: (hand) => {
        const ranks = hand.map(c=>c.rank).sort((a,b)=>a-b);
        const suits = hand.map(c=>c.suit);
        const isFlush = suits.every(s => s === suits[0]);
        let isStraight = true;
        
        // A, 10, J, Q, K のストレート対応 (1, 10, 11, 12, 13)
        if(ranks[0]===1 && ranks[1]===10 && ranks[2]===11 && ranks[3]===12 && ranks[4]===13) {
            isStraight = true;
        } else {
            for(let i=0; i<4; i++) { if(ranks[i+1] !== ranks[i]+1) isStraight = false; }
        }

        const counts = {};
        ranks.forEach(r => counts[r] = (counts[r]||0)+1);
        const countsVal = Object.values(counts).sort((a,b)=>b-a);

        const ODDS = CONST.POKER_ODDS || { ROYAL_FLUSH: 500, STRAIGHT_FLUSH: 100, FOUR_CARD: 30, FULL_HOUSE: 10, FLUSH: 8, STRAIGHT: 5, THREE_CARD: 3, TWO_PAIR: 2, JACKS_OR_BETTER: 1 };

        if(isFlush && isStraight && ranks[0]===1 && ranks[4]===13) return {name:'ロイヤルストレートフラッシュ', rate:ODDS.ROYAL_FLUSH};
        if(isFlush && isStraight) return {name:'ストレートフラッシュ', rate:ODDS.STRAIGHT_FLUSH};
        if(countsVal[0]===4) return {name:'フォーカード', rate:ODDS.FOUR_CARD};
        if(countsVal[0]===3 && countsVal[1]===2) return {name:'フルハウス', rate:ODDS.FULL_HOUSE};
        if(isFlush) return {name:'フラッシュ', rate:ODDS.FLUSH};
        if(isStraight) return {name:'ストレート', rate:ODDS.STRAIGHT};
        if(countsVal[0]===3) return {name:'スリーカード', rate:ODDS.THREE_CARD};
        if(countsVal[0]===2 && countsVal[1]===2) return {name:'ツーペア', rate:ODDS.TWO_PAIR};
        if(countsVal[0]===2) {
            // Jacks or Better判定 (1, 11, 12, 13のペア)
            const pairRank = parseInt(Object.keys(counts).find(key => counts[key] === 2));
            if(pairRank === 1 || pairRank >= 11) return {name:'ジャックスオアベター', rate:ODDS.JACKS_OR_BETTER};
        }
        return {name:'役なし', rate:0};
    },

    // --- ブラックジャック ---
    startBJ: () => {
        Casino.deck = Casino.createDeck();
        Casino.hand = [Casino.deck.pop(), Casino.deck.pop()]; // プレイヤー
        Casino.dealerHand = [Casino.deck.pop(), Casino.deck.pop()]; // ディーラー
        Casino.renderBJ(false);
    },

    getBJScore: (hand) => {
        let score = 0;
        let aces = 0;
        hand.forEach(c => {
            let val = c.rank > 10 ? 10 : c.rank;
            if(val === 1) { aces++; val = 11; }
            score += val;
        });
        while(score > 21 && aces > 0) { score -= 10; aces--; }
        return score;
    },

    renderBJ: (isFinish) => {
        const board = document.getElementById('casino-board');
        const actions = document.getElementById('casino-actions');
        const msg = document.getElementById('casino-msg');
        
        const pScore = Casino.getBJScore(Casino.hand);
        const dScore = Casino.getBJScore(Casino.dealerHand);
        
        let dHtml = '';
        if(isFinish) {
            dHtml = Casino.dealerHand.map(c => Casino.getCardStr(c)).join(' ');
            dHtml += `<br>Dealer: ${dScore}`;
        } else {
            dHtml = `${Casino.getCardStr(Casino.dealerHand[0])} <span style="font-size:24px; color:#888;">[?]</span>`;
            dHtml += `<br>Dealer: ?`;
        }

        let pHtml = Casino.hand.map(c => Casino.getCardStr(c)).join(' ');
        pHtml += `<br>You: ${pScore}`;

        board.innerHTML = `<div style="text-align:center;">${dHtml}</div><hr style="border-color:#444; width:100%; margin:10px 0;"><div style="text-align:center;">${pHtml}</div>`;

        if(isFinish) {
            actions.innerHTML = `<button class="btn" onclick="Casino.init()">戻る</button>`;
            return;
        }

        if(pScore >= 21) {
            Casino.finishBJ();
        } else {
            msg.innerHTML = `BET: <span style="color:#ffd700">${Casino.betGold} G</span><br>ヒット(もう1枚) か スタンド(勝負) か`;
            actions.innerHTML = `
                <button class="btn" style="width:100px; background:#004444;" onclick="Casino.hitBJ()">HIT</button>
                <button class="btn" style="width:100px; background:#550000;" onclick="Casino.finishBJ()">STAND</button>
            `;
        }
    },

    hitBJ: () => {
        Casino.hand.push(Casino.deck.pop());
        Casino.renderBJ(false);
    },

    finishBJ: () => {
        let pScore = Casino.getBJScore(Casino.hand);
        
        // バーストしてなければディーラーは17以上になるまで引く
        if (pScore <= 21) {
            while(Casino.getBJScore(Casino.dealerHand) < 17) {
                Casino.dealerHand.push(Casino.deck.pop());
            }
        }
        
        let dScore = Casino.getBJScore(Casino.dealerHand);
        Casino.renderBJ(true);

        const msg = document.getElementById('casino-msg');
        let win = false;
        let rate = 0;

        if (pScore > 21) {
            msg.innerHTML = "バースト！<br>あなたの負けです";
        } else if (dScore > 21) {
            msg.innerHTML = "ディーラーバースト！<br>あなたの勝ちです！";
            win = true; rate = 2.0;
        } else if (pScore > dScore) {
            if(pScore === 21 && Casino.hand.length === 2) {
                msg.innerHTML = "ブラックジャック！！<br>大勝利！";
                win = true; rate = 2.5;
            } else {
                msg.innerHTML = "あなたの勝ちです！";
                win = true; rate = 2.0;
            }
        } else if (pScore === dScore) {
            msg.innerHTML = "引き分け...<br>(GOLDは返却されません)";
        } else {
            msg.innerHTML = "あなたの負けです...";
        }

        if(win) {
            const payout = Math.floor((Casino.betGold / 100) * rate);
            msg.innerHTML += `<br>配当: <span style="color:#4f4;">${payout} GEM</span>`;
            App.data.gems += payout;
            App.save();
        }
    }
};
