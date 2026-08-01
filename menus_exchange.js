/* MenuExchange extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ========================================================================== 
    8. お知らせ (MenuExchange) - デイリー報酬 / 更新情報 / チュートリアル
    ========================================================================== */
const MenuExchange = {
    activeTab: 'news',
    currentPage: 0,
    itemsPerPage: 5,
    newsList: [], // スコープエラー回避のためオブジェクト内に保持
    _tutorialLoadPromise: null,
    _tutorialLoadError: false,

    init: () => {
        MenuExchange.activeTab = 'news';
        const screen = document.getElementById('sub-screen-exchange');
        if (screen) screen.style.display = 'flex';
        MenuExchange.currentPage = 0;
        MenuExchange.render();
        // index.htmlを変更せずに新規モジュールを読み込む。
        // 読み込み後、チュートリアルタブを開いていれば一覧を更新する。
        MenuExchange.ensureTutorialModule()
            .then(() => {
                if (MenuExchange.activeTab === 'tutorials') MenuExchange.render();
            })
            .catch(() => {
                if (MenuExchange.activeTab === 'tutorials') MenuExchange.render();
            });
    },

    setTab: (tab) => {
        MenuExchange.activeTab = tab === 'tutorials' ? 'tutorials' : 'news';
        MenuExchange.currentPage = 0;
        MenuExchange.render();
        if (MenuExchange.activeTab === 'tutorials') {
            MenuExchange.ensureTutorialModule()
                .then(() => MenuExchange.render())
                .catch(() => MenuExchange.render());
        }
    },

    ensureTutorialModule: () => {
        if (typeof window !== 'undefined' && window.TutorialModal) {
            MenuExchange._tutorialLoadError = false;
            return Promise.resolve(window.TutorialModal);
        }
        if (MenuExchange._tutorialLoadPromise) return MenuExchange._tutorialLoadPromise;

        MenuExchange._tutorialLoadError = false;
        MenuExchange._tutorialLoadPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-prisma-tutorial-module="true"]');
            if (existing) {
                existing.addEventListener('load', () => {
                    if (window.TutorialModal) resolve(window.TutorialModal);
                    else reject(new Error('TutorialModal was not initialized.'));
                }, { once: true });
                existing.addEventListener('error', () => reject(new Error('tutorial.js load failed.')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = 'tutorial.js';
            script.async = true;
            script.dataset.prismaTutorialModule = 'true';
            script.addEventListener('load', () => {
                script.dataset.loaded = 'true';
                if (window.TutorialModal) resolve(window.TutorialModal);
                else reject(new Error('TutorialModal was not initialized.'));
            }, { once: true });
            script.addEventListener('error', () => {
                script.remove();
                reject(new Error('tutorial.js load failed.'));
            }, { once: true });
            document.head.appendChild(script);
        }).catch(error => {
            console.error('[MenuExchange] tutorial.js の読み込みに失敗しました。', error);
            MenuExchange._tutorialLoadError = true;
            MenuExchange._tutorialLoadPromise = null;
            const failedScript = document.querySelector('script[data-prisma-tutorial-module="true"]');
            if (failedScript && !window.TutorialModal) failedScript.remove();
            throw error;
        });
        return MenuExchange._tutorialLoadPromise;
    },

    retryTutorialLoad: () => {
        const oldScript = document.querySelector('script[data-prisma-tutorial-module="true"]');
        if (oldScript && !window.TutorialModal) oldScript.remove();
        MenuExchange._tutorialLoadPromise = null;
        MenuExchange._tutorialLoadError = false;
        MenuExchange.render();
        MenuExchange.ensureTutorialModule()
            .then(() => MenuExchange.render())
            .catch(() => MenuExchange.render());
    },

    openTutorial: (id) => {
        MenuExchange.ensureTutorialModule()
            .then(modal => {
                if (!modal || typeof modal.open !== 'function') throw new Error('TutorialModal.open is not available.');
                modal.open(id);
            })
            .catch(() => {
                if (typeof Menu !== 'undefined' && typeof Menu.msg === 'function') {
                    Menu.msg('チュートリアルを読み込めませんでした。');
                }
            });
    },

    // 日付チェック (YYYY-MM-DD 形式)
    getTodayStr: () => new Date().toLocaleDateString('sv-SE'),

    claimDaily: (type) => {
        if (!App.data.flags) App.data.flags = {};
        const today = MenuExchange.getTodayStr();
        const flagKey = type === 'GEM' ? 'lastGemClaimDate' : 'lastGoldClaimDate';
        if (App.data.flags[flagKey] === today) {
            Menu.msg('本日は既に受け取っています。');
            return;
        }

        const amount = type === 'GEM' ? 1000 : 10000;
        const label = type === 'GEM' ? 'GEM' : 'GOLD';
        const grantReward = () => {
            if (type === 'GEM') App.data.gems += amount;
            else App.data.gold += amount;

            App.data.flags[flagKey] = today;
            App.save();

            if (typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
            Menu.msg(`${label}を ${amount.toLocaleString()} 獲得しました！`);
            MenuExchange.render();
        };
        Menu.confirm(`動画広告を視聴して、デイリー報酬の ${amount.toLocaleString()} ${label} を受け取りますか？`, () => {
            AdManager.prepareRewardAd(grantReward);
        });
    },

    escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch])),

    render: () => {
        const container = document.getElementById('sub-screen-exchange');
        if (!container) return;

        const isNews = MenuExchange.activeTab === 'news';
        container.innerHTML = `
            <div class="header-bar">
                <span>📢 お知らせ</span>
                <button class="btn" onclick="Menu.closeSubScreen('exchange')">もどる</button>
            </div>
            <div style="display:flex; margin:10px 12px 0; border-radius:6px; overflow:hidden; border:1px solid #444; background:#222; flex-shrink:0;">
                <button
                    id="exchange-tab-news"
                    type="button"
                    style="flex:1; min-width:0; padding:10px 4px; border:none; font-weight:bold; font-size:11px; font-family:inherit; background:${isNews ? '#ffd700' : '#111'}; color:${isNews ? '#000' : '#777'};"
                    onclick="MenuExchange.setTab('news')"
                >お知らせ</button>
                <button
                    id="exchange-tab-tutorials"
                    type="button"
                    style="flex:1; min-width:0; padding:10px 4px; border:none; font-weight:bold; font-size:11px; font-family:inherit; background:${isNews ? '#111' : '#ffd700'}; color:${isNews ? '#777' : '#000'};"
                    onclick="MenuExchange.setTab('tutorials')"
                >チュートリアル</button>
            </div>
            <div id="exchange-tab-content" class="scroll-area" style="padding:15px; background:#111; flex:1 1 auto; min-height:0; overflow-y:auto;">
                ${isNews ? MenuExchange.renderNewsTab() : MenuExchange.renderTutorialTab()}
            </div>
            <div class="sub-screen-bottom-panel">
                <button class="btn sub-screen-back-btn" onclick="Menu.closeSubScreen('exchange')">もどる</button>
            </div>
        `;

        if (typeof Menu !== 'undefined' && typeof Menu.refreshKeyboardNavigation === 'function') {
            Menu.refreshKeyboardNavigation(container);
        }
    },

    renderNewsTab: () => {
        const today = MenuExchange.getTodayStr();
        const gemClaimed = App.data.flags?.lastGemClaimDate === today;
        const goldClaimed = App.data.flags?.lastGoldClaimDate === today;
        MenuExchange._news = (typeof NEWS_DATA !== 'undefined')
            ? [...NEWS_DATA].sort((a, b) => new Date(b.date) - new Date(a.date))
            : [];

        const start = MenuExchange.currentPage * MenuExchange.itemsPerPage;
        const pagedNews = MenuExchange._news.slice(start, start + MenuExchange.itemsPerPage);
        const totalPages = Math.max(1, Math.ceil(MenuExchange._news.length / MenuExchange.itemsPerPage));

        return `
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
            <div>
                <div style="font-size:12px; color:#aaa; margin-bottom:10px; border-left:3px solid #aaa; padding-left:8px;">最新の情報</div>
                <div id="news-container">
                    ${pagedNews.length ? pagedNews.map(n => `
                        <button
                            type="button"
                            class="list-item"
                            style="width:100%; padding:10px; margin-bottom:5px; flex-direction:column; align-items:flex-start; text-align:left; color:inherit;"
                            onclick="MenuNewsDetail.open(${Number(n.id)}, MenuExchange._news)"
                        >
                            <span style="font-size:10px; color:#888;">${MenuExchange.escapeHtml(n.date)}</span>
                            <span style="font-size:13px; font-weight:bold; color:#ddd;">${MenuExchange.escapeHtml(n.title)}</span>
                        </button>
                    `).join('') : '<div style="padding:18px; color:#777; font-size:12px; text-align:center;">現在、お知らせはありません。</div>'}
                </div>
                <div style="display:flex; justify-content:center; align-items:center; gap:20px; margin-top:10px;">
                    <button class="btn" style="padding:5px 15px;" ${MenuExchange.currentPage === 0 ? 'disabled' : ''} onclick="MenuExchange.changePage(-1)">前へ</button>
                    <span style="color:#666; line-height:30px;">${MenuExchange.currentPage + 1} / ${totalPages}</span>
                    <button class="btn" style="padding:5px 15px;" ${start + MenuExchange.itemsPerPage >= MenuExchange._news.length ? 'disabled' : ''} onclick="MenuExchange.changePage(1)">次へ</button>
                </div>
            </div>
        `;
    },

    renderTutorialTab: () => {
        if (!window.TutorialModal) {
            if (MenuExchange._tutorialLoadError) {
                return `
                    <div style="padding:24px 14px; text-align:center; border:1px solid #553b3b; border-radius:8px; background:#241717;">
                        <div style="font-size:14px; color:#ffb0b0; font-weight:bold;">チュートリアルを読み込めませんでした</div>
                        <div style="margin-top:8px; color:#998888; font-size:11px; line-height:1.6;">tutorial.js が同じ階層に配置されているか確認してください。</div>
                        <button class="btn" style="margin-top:14px; min-width:130px;" onclick="MenuExchange.retryTutorialLoad()">再読み込み</button>
                    </div>
                `;
            }
            return `
                <div style="padding:30px 12px; text-align:center; color:#aaa;">
                    <div style="font-size:13px;">チュートリアルを読み込んでいます…</div>
                </div>
            `;
        }

        const tutorials = typeof window.TutorialModal.getTutorials === 'function'
            ? window.TutorialModal.getTutorials()
            : [];

        return `

            <div style="font-size:12px; color:#ffd700; margin-bottom:10px; border-left:3px solid #ffd700; padding-left:8px;">チュートリアル一覧</div>
            <div id="tutorial-list">
                ${tutorials.length ? tutorials.map((tutorial, index) => `
                    <button
                        type="button"
                        class="list-item"
                        style="width:100%; min-height:62px; margin-bottom:7px; padding:10px 12px; display:flex; align-items:center; gap:11px; text-align:left; color:inherit; border:1px solid #3d3a2e; background:linear-gradient(90deg, rgba(255,215,0,0.07), rgba(255,255,255,0.035));"
                        onclick="MenuExchange.openTutorial('${MenuExchange.escapeHtml(tutorial.id)}')"
                    >
                        <span style="flex:0 0 34px; height:34px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; color:#201c0c; background:#d6be58; font-size:12px; font-weight:bold;">${String(index + 1).padStart(2, '0')}</span>
                        <span style="flex:1; min-width:0;">
                            <span style="display:block; color:#fff; font-size:14px; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${MenuExchange.escapeHtml(tutorial.title)}</span>
                            <span style="display:block; margin-top:4px; color:#999; font-size:10px; line-height:1.4;">${MenuExchange.escapeHtml(tutorial.description)}</span>
                        </span>
                        <span style="flex:0 0 auto; color:#d2bd68; font-size:10px;">${Number(tutorial.pageCount || 0)}ページ<br><span style="font-size:16px;">›</span></span>
                    </button>
                `).join('') : '<div style="padding:20px; color:#777; font-size:12px; text-align:center;">登録済みのチュートリアルはありません。</div>'}
            </div>
        `;
    },

    changePage: (dir) => {
        const totalPages = Math.max(1, Math.ceil((MenuExchange._news?.length || 0) / MenuExchange.itemsPerPage));
        MenuExchange.currentPage = Math.max(0, Math.min(totalPages - 1, MenuExchange.currentPage + Number(dir || 0)));
        MenuExchange.render();
    }
};

if (typeof window !== 'undefined') window.MenuExchange = MenuExchange;
