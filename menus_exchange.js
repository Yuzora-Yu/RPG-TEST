/* MenuExchange extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
    8. 取引所 (MenuExchange) - デイリー報酬 & お知らせ
    ========================================================================== */
const MenuExchange = {
    currentPage: 0,
    itemsPerPage: 5,
    newsList: [], // スコープエラー回避のためオブジェクト内に保持

    init: () => {
        document.getElementById('sub-screen-exchange').style.display = 'flex';
        MenuExchange.currentPage = 0;
        MenuExchange.render();
    },

    // 日付チェック (YYYY-MM-DD 形式)
    getTodayStr: () => new Date().toLocaleDateString('sv-SE'), 

    claimDaily: (type) => {
        if (!App.data.flags) App.data.flags = {};
        const today = MenuExchange.getTodayStr();
        const flagKey = type === 'GEM' ? 'lastGemClaimDate' : 'lastGoldClaimDate';

        if (App.data.flags[flagKey] === today) {
            Menu.msg("本日は既に受け取っています。");
            return;
        }

        const amount = type === 'GEM' ? 1000 : 10000;
        const label = type === 'GEM' ? 'GEM' : 'GOLD';

        // 既存の Menu.confirm を使用
//        Menu.confirm(`${label}を ${amount.toLocaleString()} 獲得しますか？`, () => {
            // 「はい」の場合の処理
//            if (type === 'GEM') App.data.gems += amount;
//            else App.data.gold += amount;
            
//            App.data.flags[flagKey] = today;
//            App.save(); // main.js の既存 save (updateHUD呼び出しを含む) を実行
			
//            if (typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
//        
//            Menu.msg(`${label}を ${amount.toLocaleString()} 獲得しました！`);
//            MenuExchange.render();
//        });
		// 報酬獲得の最終処理
		const grantReward = () => {
			if (type === 'GEM') App.data.gems += amount;
			else App.data.gold += amount;
			
			App.data.flags[flagKey] = today;
			App.save();
			
			if (typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
			Menu.msg(`${label}を ${amount.toLocaleString()} 獲得しました！`);
			MenuExchange.render();
		};

		// 動画視聴の確認
		Menu.confirm(`動画広告を視聴して、デイリー報酬の ${amount.toLocaleString()} ${label} を受け取りますか？`, () => {
			// リワード広告の再生を実行
			AdManager.prepareRewardAd(grantReward);
		});
},
    
    render: () => {
        const container = document.getElementById('sub-screen-exchange');
        const today = MenuExchange.getTodayStr();
        const gemClaimed = App.data.flags?.lastGemClaimDate === today;
        const goldClaimed = App.data.flags?.lastGoldClaimDate === today;

        // ニュースをソートして保持し、onclickからの参照エラーを防ぐ
        MenuExchange._news = (typeof NEWS_DATA !== 'undefined') ? [...NEWS_DATA].sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
        
        const start = MenuExchange.currentPage * MenuExchange.itemsPerPage;
        const pagedNews = MenuExchange._news.slice(start, start + MenuExchange.itemsPerPage);

        container.innerHTML = `
            <div class="header-bar">
                <span>💎 取引所</span>
                <button class="btn" onclick="Menu.closeSubScreen('exchange')">もどる</button>
            </div>
            <div class="scroll-area" style="padding:15px; background:#111;">
                <div style="margin-bottom:20px;">
                    <div style="font-size:12px; color:#ffd700; margin-bottom:10px; border-left:3px solid #ffd700; padding-left:8px;">デイリー報酬</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <button class="btn" style="height:60px; background:${gemClaimed ? '#333' : '#404'};" onclick="MenuExchange.claimDaily('GEM')" ${gemClaimed ? 'disabled' : ''}>
                            <div style="font-size:10px;">毎日1000 GEM</div>
                            <div style="font-weight:bold;">${gemClaimed ? '取得済み' : 'GEMを受け取る'}</div>
                        </button>
                        <button class="btn" style="height:60px; background:${goldClaimed ? '#333' : '#440'};" onclick="MenuExchange.claimDaily('GOLD')" ${goldClaimed ? 'disabled' : ''}>
                            <div style="font-size:10px;">毎日10000 GOLD</div>
                            <div style="font-weight:bold;">${goldClaimed ? '取得済み' : 'GOLDを受け取る'}</div>
                        </button>
                    </div>
                </div>

                <div style="flex:1;">
                    <div style="font-size:12px; color:#aaa; margin-bottom:10px; border-left:3px solid #aaa; padding-left:8px;">最新の情報</div>
                    <div id="news-container">
                        ${pagedNews.map(n => `
                            <div class="list-item" style="padding:10px; margin-bottom:5px; flex-direction:column; align-items:flex-start;" 
                                onclick="MenuNewsDetail.open(${n.id}, MenuExchange._news)">
                                <div style="font-size:10px; color:#888;">${n.date}</div>
                                <div style="font-size:13px; font-weight:bold; color:#ddd;">${n.title}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="display:flex; justify-content:center; gap:20px; margin-top:10px;">
                        <button class="btn" style="padding:5px 15px;" ${MenuExchange.currentPage === 0 ? 'disabled' : ''} onclick="MenuExchange.changePage(-1)">前へ</button>
                        <span style="color:#666; line-height:30px;">${MenuExchange.currentPage + 1} / ${Math.ceil(MenuExchange._news.length / MenuExchange.itemsPerPage)}</span>
                        <button class="btn" style="padding:5px 15px;" ${start + MenuExchange.itemsPerPage >= MenuExchange._news.length ? 'disabled' : ''} onclick="MenuExchange.changePage(1)">次へ</button>
                    </div>
                </div>
            </div>

            <div class="sub-screen-bottom-panel">
                <button class="btn sub-screen-back-btn" onclick="Menu.closeSubScreen('exchange')">もどる</button>
            </div>
        `;
    },
	
    changePage: (dir) => {
        MenuExchange.currentPage += dir;
        MenuExchange.render();
    }
};

if (typeof window !== 'undefined') window.MenuExchange = MenuExchange;
