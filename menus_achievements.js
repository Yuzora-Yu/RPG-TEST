/* MenuAchievements extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   9. 実績 (MenuAchievements) - 表示専用
   ========================================================================== */
const MenuAchievements = {
    filter: 'ALL',
    categoryFilter: 'ALL',

    /*
     * 実績の達成判定・報酬付与は achievements.js の AchievementManager に統一。
     * ここは「画面表示」「ボタン操作」だけを担当する。
     * Codex等で実績タイプを増やす場合も、この menus.js に判定switchを戻さないこと。
     */
    init: () => {
        const screen = document.getElementById('sub-screen-achievements');
        if (screen) screen.style.display = 'flex';
        MenuAchievements.checkProgress();
        MenuAchievements.render();
    },

    _renderInternal: () => {
        const container = document.getElementById('sub-screen-achievements');
        if (!container) return;
        const scrollArea = container.querySelector('.scroll-area');
        if (scrollArea) scrollArea.scrollTop = 0;
    },

    escapeHtml: (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch])),

    formatNum: (n) => Number(n || 0).toLocaleString('ja-JP'),

    checkProgress: () => {
        if (typeof AchievementManager !== 'undefined' && AchievementManager.checkProgress) {
            return AchievementManager.checkProgress();
        }
        return 0;
    },

    processRewards: (rewards) => {
        if (typeof AchievementManager !== 'undefined' && AchievementManager.processRewards) {
            return AchievementManager.processRewards(rewards);
        }
        return '';
    },

    render: () => {
        const container = document.getElementById('sub-screen-achievements');
        if (!container) return;

        if (typeof AchievementManager === 'undefined') {
            container.innerHTML = `
                <div class="header-bar">
                    <span>🏆 実績</span>
                    <button class="btn" onclick="Menu.closeSubScreen('achievements')">もどる</button>
                </div>
                <div class="scroll-area" style="padding:16px; background:#111; color:#ccc;">
                    実績管理ロジックが読み込まれていません。achievements.js の読み込み順を確認してください。
                </div>
            `;
            return;
        }

        AchievementManager.checkProgress({ save: true });

        const data = (typeof ACHIEVEMENTS_DATA !== 'undefined') ? ACHIEVEMENTS_DATA : [];
        if (!App.data.achievements) App.data.achievements = {};

        const categories = ['ALL', ...Array.from(new Set(data.map(a => a.category || 'その他')))].filter(Boolean);

        let list = data.filter(a => {
            const state = AchievementManager.getState(a.id);
            if (MenuAchievements.filter === 'COMPLETED' && !state.completed) return false;
            if (MenuAchievements.filter === 'INCOMPLETE' && state.completed) return false;
            if (MenuAchievements.categoryFilter !== 'ALL' && (a.category || 'その他') !== MenuAchievements.categoryFilter) return false;
            return true;
        });

        list.sort((a, b) => {
            const sA = AchievementManager.getState(a.id);
            const sB = AchievementManager.getState(b.id);
            const score = (s) => (s.completed && !s.claimed) ? 0 : (!s.completed ? 1 : 2);
            const scoreDiff = score(sA) - score(sB);
            if (scoreDiff !== 0) return scoreDiff;
            return (a.id || 0) - (b.id || 0);
        });

        const completedCount = data.filter(a => AchievementManager.getState(a.id).completed).length;
        const claimedCount = data.filter(a => AchievementManager.getState(a.id).claimed).length;
        const unclaimedCount = data.filter(a => {
            const s = AchievementManager.getState(a.id);
            return s.completed && !s.claimed;
        }).length;
        const incompleteCount = Math.max(0, data.length - completedCount);
        const completedPercent = data.length ? Math.floor((completedCount / data.length) * 100) : 0;
        const filteredCount = list.length;

        const filterLabels = {
            ALL: '全て',
            INCOMPLETE: '未達成',
            COMPLETED: '達成済み'
        };

        const categoryOptions = categories.map(cat => `
            <option value="${MenuAchievements.escapeHtml(cat)}" ${MenuAchievements.categoryFilter === cat ? 'selected' : ''}>
                ${cat === 'ALL' ? 'カテゴリ全て' : MenuAchievements.escapeHtml(cat)}
            </option>
        `).join('');

        container.innerHTML = `
            <div class="header-bar">
                <span>🏆 実績</span>
                <button class="btn" onclick="Menu.closeSubScreen('achievements')">もどる</button>
            </div>

            <div style="background:linear-gradient(180deg,#202020,#131313); border-bottom:1px solid #333; padding:10px;">
                <div style="display:flex; gap:10px; align-items:stretch; margin-bottom:10px;">
                    <div style="width:92px; flex-shrink:0; border:1px solid #3f3f3f; border-radius:10px; background:#0f0f0f; padding:9px; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                        <div style="font-size:22px; color:#ffd35a; line-height:1;">${completedPercent}%</div>
                        <div style="font-size:10px; color:#999; margin-top:4px;">達成率</div>
                    </div>
                    <div style="flex:1; min-width:0; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                        <div style="background:#181818; border:1px solid #333; border-radius:8px; padding:7px;">
                            <div style="font-size:10px; color:#888;">達成</div>
                            <div style="font-size:14px; color:#fff;">${completedCount}/${data.length}</div>
                        </div>
                        <div style="background:${unclaimedCount > 0 ? '#281018' : '#181818'}; border:1px solid ${unclaimedCount > 0 ? '#8a1930' : '#333'}; border-radius:8px; padding:7px;">
                            <div style="font-size:10px; color:#888;">未受取</div>
                            <div style="font-size:14px; color:${unclaimedCount > 0 ? '#ff9aa8' : '#aaa'};">${unclaimedCount}</div>
                        </div>
                        <div style="background:#181818; border:1px solid #333; border-radius:8px; padding:7px;">
                            <div style="font-size:10px; color:#888;">未達成</div>
                            <div style="font-size:14px; color:#ccc;">${incompleteCount}</div>
                        </div>
                        <div style="background:#181818; border:1px solid #333; border-radius:8px; padding:7px;">
                            <div style="font-size:10px; color:#888;">表示中</div>
                            <div style="font-size:14px; color:#ccc;">${filteredCount}</div>
                        </div>
                    </div>
                </div>

                <div style="height:8px; background:#2a2a2a; border-radius:999px; overflow:hidden; margin-bottom:10px;">
                    <div style="height:100%; width:${completedPercent}%; background:linear-gradient(90deg,#8a6b18,#ffd35a);"></div>
                </div>

                <button class="btn" style="width:100%; padding:9px; background:${unclaimedCount > 0 ? '#8a1930' : '#333'}; border-color:${unclaimedCount > 0 ? '#d65a70' : '#555'};" onclick="MenuAchievements.claimAll()" ${unclaimedCount > 0 ? '' : 'disabled'}>
                    ${unclaimedCount > 0 ? `🎁 未受取 ${unclaimedCount} 件を一括受取` : '受け取れる報酬はありません'}
                </button>
            </div>

            <div style="padding:8px; background:#1b1b1b; border-bottom:1px solid #303030; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; gap:5px; background:#111; border:1px solid #333; border-radius:9px; padding:4px;">
                    ${['ALL', 'INCOMPLETE', 'COMPLETED'].map(f => `
                        <button class="btn" style="flex:1; font-size:11px; padding:7px 4px; border-color:${MenuAchievements.filter === f ? '#27b4b4' : '#333'}; background:${MenuAchievements.filter === f ? '#006666' : 'transparent'};"
                            onclick="MenuAchievements.filter='${f}'; MenuAchievements.render();">
                            ${filterLabels[f]}
                        </button>
                    `).join('')}
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <label style="font-size:11px; color:#999; flex-shrink:0;">カテゴリ</label>
                    <select style="flex:1; min-width:0; background:#111; color:#fff; border:1px solid #444; border-radius:7px; padding:7px; font-family:inherit; font-size:12px;"
                        onchange="MenuAchievements.categoryFilter=this.value; MenuAchievements.render();">
                        ${categoryOptions}
                    </select>
                </div>
            </div>

            <div class="scroll-area" style="padding:10px; background:#111;">
                ${list.map(a => {
                    const state = AchievementManager.getState(a.id);
                    const progress = AchievementManager.getProgress(a);
                    const canClaim = state.completed && !state.claimed;
                    const isClaimed = state.claimed;
                    const rewardText = AchievementManager.getRewardText(a.rewards || []);
                    const progressLabel = `${MenuAchievements.formatNum(Math.min(progress.value, progress.goal))}/${MenuAchievements.formatNum(progress.goal)}`;

                    return `
                        <div class="list-item" style="opacity:${isClaimed ? 0.55 : 1}; padding:12px; margin-bottom:8px; border-left:4px solid ${state.completed ? '#ffd700' : '#444'}; display:flex; align-items:center; gap:10px;">
                            <div style="flex:1; min-width:0;">
                                <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
                                    <div style="font-size:13px; font-weight:bold; color:${state.completed ? '#fff' : '#aaa'};">
                                        ${state.completed ? '✅ ' : ''}${MenuAchievements.escapeHtml(a.title)}
                                    </div>
                                    <div style="font-size:9px; color:#999; border:1px solid #444; border-radius:999px; padding:2px 6px; flex-shrink:0;">
                                        ${MenuAchievements.escapeHtml(a.category || 'その他')}
                                    </div>
                                </div>
                                <div style="font-size:10px; color:#777; margin-top:3px;">${MenuAchievements.escapeHtml(a.desc)}</div>
                                <div style="height:6px; background:#2a2a2a; border-radius:99px; overflow:hidden; margin-top:8px;">
                                    <div style="height:100%; width:${progress.percent}%; background:${state.completed ? '#d6b22e' : '#008888'};"></div>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:10px; color:#888; margin-top:3px;">
                                    <span>進捗: ${progressLabel}</span>
                                    <span>${progress.percent}%</span>
                                </div>
                                <div style="font-size:11px; color:#00cccc; margin-top:5px;">
                                    報酬: ${MenuAchievements.escapeHtml(rewardText)}
                                </div>
                            </div>
                            <button class="btn" style="width:82px; font-size:11px; background:${canClaim ? '#d00' : '#333'}; flex-shrink:0;"
                                onclick="MenuAchievements.claim(${a.id})" ${canClaim ? '' : 'disabled'}>
                                ${isClaimed ? '受取済' : (state.completed ? '受取' : '未達成')}
                            </button>
                        </div>
                    `;
                }).join('') || '<div style="color:#777; text-align:center; padding:20px;">該当する実績はありません。</div>'}
            </div>

            <div class="sub-screen-bottom-panel">
                <button class="btn sub-screen-back-btn" onclick="Menu.closeSubScreen('achievements')">もどる</button>
            </div>
        `;

        MenuAchievements._renderInternal();
    },

    claim: (id) => {
        if (typeof AchievementManager === 'undefined') return;
        const result = AchievementManager.claim(id);
        if (!result.ok) {
            Menu.msg(result.message || '受け取れません。');
            return;
        }

        App.updateHUD();
        if (typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();

        Menu.msg(`実績達成報酬を獲得しました！\n${result.rewardText}`);
        MenuAchievements.render();
    },

    claimAll: () => {
        if (typeof AchievementManager === 'undefined') return;
        const result = AchievementManager.claimAll();

        if (!result.ok) {
            Menu.msg("受け取れる報酬はありません。");
            return;
        }

        App.updateHUD();
        if (typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();

        Menu.msg(`${result.count}件の実績報酬を一括で受け取りました。`);
        MenuAchievements.render();
    }
};

if (typeof window !== 'undefined') window.MenuAchievements = MenuAchievements;
