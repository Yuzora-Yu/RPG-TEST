/* facilities.js (完全版: +3確定 & 画面内ダイアログ化) */

const Facilities = {
    // --- 宿屋 ---
    initInn: () => {
        // UI構築
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
        
        // ★修正: 画面内ダイアログを使用
        Menu.confirm("一泊しますか？", () => {
            App.data.gold -= cost;
            
            // 全回復
            App.data.characters.forEach(c => {
                const stats = App.calcStats(c);
                c.currentHp = stats.maxHp;
                c.currentMp = stats.maxMp;
            });
            
            App.save();
            Facilities.initInn(); // 表示更新
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
            
            // 装備の場合は「+3確定」と表記
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
                
                // ★修正: 画面内ダイアログを使用
                Menu.confirm(`${r.name} を交換しますか？`, () => {
                    // メダル消費
                    App.data.items[99] -= r.medals;
                    
                    // アイテム付与
                    if(r.type === 'item') {
                        App.data.items[r.id] = (App.data.items[r.id] || 0) + r.count;
                        Menu.msg(`${r.name} を入手しました！`, () => {
                            Facilities.initMedal(); // ダイアログを閉じた後に更新
                        });
                    } else if(r.type === 'equip') {
                        // +3装備生成ロジック
                        const base = r.base;
                        const eq = {
                            id: Date.now() + Math.random().toString(),
                            rank: base.rank || 1, 
                            name: base.name, type: base.type, val: base.val * 2.5, 
                            data: JSON.parse(JSON.stringify(base.data)),
                            opts: [],
                            plus: 3 // +3確定
                        };

                        // オプションを3つ抽選
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

                            const min = rule.min[rarity]||1;
                            const max = rule.max[rarity]||10;
                            
                            eq.opts.push({
                                key: rule.key, elm: rule.elm, label: rule.name, 
                                val: Math.floor(Math.random() * (max - min + 1)) + min, 
                                unit: rule.unit, rarity: rarity
                            });
                        }
                        
                        eq.name += '+3';
                        if(App.checkSynergy(eq)) eq.isSynergy = true;

                        App.data.inventory.push(eq);
                        Menu.msg(`${eq.name} を入手しました！`, () => {
                            Facilities.initMedal();
                        });
                    }
                    
                    App.save();
                    // initMedalはメッセージコールバック内で呼ぶのでここでは不要
                });
            };
            container.appendChild(div);
        });
    }
};
