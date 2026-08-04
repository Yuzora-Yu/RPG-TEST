/* MenuNewsDetail extracted from menus.js. Keep runtime behavior aligned with Menu core. */
const MenuNewsDetail = {
    list: [],
    currentIndex: -1,

    escapeHtml: (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'),

    getHost: () => document.getElementById('game-container') || document.body,

    ensureModal: () => {
        let modal = document.getElementById('news-detail-modal');
        const host = MenuNewsDetail.getHost();
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'news-detail-modal';
            modal.className = 'news-detail-modal';
            modal.setAttribute('aria-hidden', 'false');
        }
        if (modal.parentNode !== host) host.appendChild(modal);
        return modal;
    },

    open: (id, list) => {
        MenuNewsDetail.list = Array.isArray(list) ? list.filter(Boolean) : [];
        if (!MenuNewsDetail.list.length) return;
        const requestedIndex = MenuNewsDetail.list.findIndex(item => item.id === id);
        MenuNewsDetail.currentIndex = requestedIndex >= 0 ? requestedIndex : 0;
        MenuNewsDetail.render();
    },

    move: (dir) => {
        const len = MenuNewsDetail.list.length;
        if (!len) return;
        MenuNewsDetail.currentIndex = (MenuNewsDetail.currentIndex + Number(dir || 0) + len) % len;
        MenuNewsDetail.render();
    },

    close: () => {
        document.getElementById('news-detail-modal')?.remove();
    },

    render: () => {
        const item = MenuNewsDetail.list[MenuNewsDetail.currentIndex];
        if (!item) return;

        const modal = MenuNewsDetail.ensureModal();
        const escape = MenuNewsDetail.escapeHtml;
        const navigationDisabled = MenuNewsDetail.list.length <= 1 ? 'disabled aria-disabled="true"' : '';

        modal.innerHTML = `
            <section class="news-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="news-detail-title">
                <header class="news-detail-header">
                    <div class="news-detail-heading">
                        <div class="news-detail-date">${escape(item.date)}</div>
                        <div id="news-detail-title" class="news-detail-title">${escape(item.title)}</div>
                    </div>
                    <button class="btn news-detail-header-close" type="button" onclick="MenuNewsDetail.close()" aria-label="お知らせ詳細を閉じる">×</button>
                </header>
                <div class="news-detail-body" tabindex="0">${escape(item.body)}</div>
                <footer class="news-detail-footer">
                    <div class="news-detail-navigation">
                        <button class="btn" type="button" ${navigationDisabled} onclick="MenuNewsDetail.move(-1)">◀ 前</button>
                        <button class="btn" type="button" ${navigationDisabled} onclick="MenuNewsDetail.move(1)">次 ▶</button>
                    </div>
                    <button class="btn news-detail-close" type="button" onclick="MenuNewsDetail.close()">閉じる</button>
                </footer>
            </section>
        `;

        modal.setAttribute('aria-hidden', 'false');
        const body = modal.querySelector?.('.news-detail-body');
        if (body && typeof body.scrollTop === 'number') body.scrollTop = 0;
    }
};

if (typeof window !== 'undefined') window.MenuNewsDetail = MenuNewsDetail;
