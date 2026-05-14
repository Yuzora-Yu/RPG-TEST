/* MenuNewsDetail extracted from menus.js. Keep runtime behavior aligned with Menu core. */
const MenuNewsDetail = {
    list: [],
    currentIndex: -1,

    open: (id, list) => {
        MenuNewsDetail.list = list;
        MenuNewsDetail.currentIndex = list.findIndex(n => n.id === id);
        MenuNewsDetail.render();
    },

    move: (dir) => {
        const len = MenuNewsDetail.list.length;
        MenuNewsDetail.currentIndex = (MenuNewsDetail.currentIndex + dir + len) % len;
        MenuNewsDetail.render();
    },

    render: () => {
        const item = MenuNewsDetail.list[MenuNewsDetail.currentIndex];
        if (!item) return;

        let modal = document.getElementById('news-detail-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'news-detail-modal';
            document.body.appendChild(modal);
        }
        modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; align-items:center; justify-content:center;`;
        
        modal.innerHTML = `
            <div style="width:310px; background:#111; border:2px solid #ffd700; border-radius:10px; padding:20px; color:#eee;">
                <div style="font-size:10px; color:#888; margin-bottom:5px;">${item.date}</div>
                <div style="font-size:16px; font-weight:bold; color:#ffd700; border-bottom:1px solid #444; padding-bottom:10px; margin-bottom:15px;">${item.title}</div>
                <div style="font-size:13px; line-height:1.6; min-height:150px; white-space:pre-wrap; color:#ccc;">${item.body}</div>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button class="btn" style="flex:1;" onclick="MenuNewsDetail.move(-1)">◀ 前</button>
                    <button class="btn" style="flex:1;" onclick="MenuNewsDetail.move(1)">次 ▶</button>
                </div>
                <button class="btn" style="width:100%; margin-top:10px; background:#444;" onclick="document.getElementById('news-detail-modal').remove()">閉じる</button>
            </div>
        `;
    }
};

if (typeof window !== 'undefined') window.MenuNewsDetail = MenuNewsDetail;
