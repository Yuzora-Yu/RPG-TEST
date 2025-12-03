/* facilities.js */

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
            alert("お金が足りないようだ。");
            return;
        }
        App.data.gold -= cost;
        
        // 全回復
        App.data.characters.forEach(c => {
            const stats = App.calcStats(c);
            c.currentHp = stats.maxHp;
            c.currentMp = stats.maxMp;
        });
        
        App.save();
        Facilities.initInn(); // 表示更新
        alert("ぐっすり休んで体力が回復した！");
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
            div.innerHTML = `
                <div>
                    <div style="font-weight:bold">${r.name}</div>
                    <div style="font-size:10px; color:#aaa;">${r.type==='item'?'道具':'装備'}</div>
                </div>
                <button class="btn" style="background:${currentMedals>=r.medals ? '#333' : '#222'}; color:${currentMedals>=r.medals ? '#fff' : '#555'}">
                    交換 ${r.medals}枚
                </button>
            `;
            
            div.querySelector('button').onclick = () => {
                if(currentMedals < r.medals) {
                    alert("メダルが足りません");
                    return;
                }
                
                if(confirm(`${r.name} を交換しますか？`)) {
                    // メダル消費
                    App.data.items[99] -= r.medals;
                    
                    // アイテム付与
                    if(r.type === 'item') {
                        App.data.items[r.id] = (App.data.items[r.id] || 0) + r.count;
                    } else if(r.type === 'equip') {
                        // 特別装備生成
                        const eq = {
                            id: Date.now() + Math.random().toString(),
                            name: r.base.name, type: r.base.type, val: r.base.val,
                            data: JSON.parse(JSON.stringify(r.base.data)),
                            opts: []
                        };
                        App.data.inventory.push(eq);
                    }
                    
                    App.save();
                    Facilities.initMedal();
                    alert("交換しました！");
                }
            };
            container.appendChild(div);
        });
    }
};
