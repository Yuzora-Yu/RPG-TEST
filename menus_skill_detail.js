/* MenuSkillDetail extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/**
 * スキル詳細モーダル
 */
const MenuSkillDetail = {
    skillList: [],
    currentIndex: -1,
    statNames: {
        atk: '攻撃力', def: '守備力', spd: '素早さ', mag: '魔力',
        elmResUp: '全属性耐性', elmResDown: '全属性耐性',
        Poison: '毒', ToxicPoison: '猛毒', Shock: '感電', Fear: '怯え',
        SpellSeal: '呪文封印', SkillSeal: '特技封印', HealSeal: '回復封印',
        HPRegen: 'HP', MPRegen: 'MP', InstantDeath: '即死',
        Debuff: '弱体', Seal: '封印'
    },

    open: (skillId, list) => {
        MenuSkillDetail.skillList = (Array.isArray(list) ? list : []).filter(s => s && s.id !== 1);
        MenuSkillDetail.currentIndex = MenuSkillDetail.skillList.findIndex(s => s.id === skillId);
        if (MenuSkillDetail.currentIndex < 0 && MenuSkillDetail.skillList.length) MenuSkillDetail.currentIndex = 0;
        MenuSkillDetail.render();
    },

    move: (dir) => {
        const len = MenuSkillDetail.skillList.length;
        if (len <= 1) return;
        MenuSkillDetail.currentIndex = (MenuSkillDetail.currentIndex + Number(dir || 0) + len) % len;
        MenuSkillDetail.render();
    },

    close: () => {
        document.getElementById('skill-detail-modal')?.remove();
    },

    render: () => {
        const sk = MenuSkillDetail.skillList[MenuSkillDetail.currentIndex];
        if (!sk) return;

        const modal = (typeof Menu !== 'undefined' && typeof Menu.ensureModalOverlay === 'function')
            ? Menu.ensureModalOverlay('skill-detail-modal', 'skill-detail-modal')
            : document.getElementById('skill-detail-modal');
        if (!modal) return;

        const escape = (typeof Menu !== 'undefined' && typeof Menu.escapeHtml === 'function')
            ? Menu.escapeHtml
            : value => String(value ?? '');
        const isAttack = ['物理', '魔法', 'ブレス', '通常攻撃'].includes(sk.type);
        const isHeal = sk.type === '回復';
        const elmColors = { 火:'#f88', 水:'#88f', 雷:'#ff0', 風:'#8f8', 光:'#ffc', 闇:'#a8f', 混沌:'#d4d' };

        let typeTagsHtml = `<span class="game-modal-badge">${escape(sk.type || '不明')}</span>`;
        if (sk.elm) {
            const color = elmColors[sk.elm] || '#aaa';
            typeTagsHtml += `<span class="game-modal-badge" style="--badge-color:${color};">${escape(sk.elm)}</span>`;
        }

        const detailEffects = [];
        const nameMap = MenuSkillDetail.statNames;
        const flatResKeys = ['Poison', 'ToxicPoison', 'Shock', 'Fear', 'SpellSeal', 'SkillSeal', 'HealSeal', 'InstantDeath', 'Debuff', 'Seal'];
        const processItem = (key, val) => {
            if (key === 'elmResUp') detailEffects.push(`${nameMap.elmResUp}${val}%アップ`);
            else if (key === 'elmResDown') detailEffects.push(`${nameMap.elmResDown}${val}%ダウン`);
            else if (key.startsWith('resists_')) {
                const ail = key.replace('resists_', '');
                detailEffects.push(`${nameMap[ail] || ail}耐性${val}%`);
            } else if (flatResKeys.includes(key)) {
                detailEffects.push(`${nameMap[key] || key}耐性${val}%`);
            } else if (key.includes('Regen')) {
                detailEffects.push(`${nameMap[key] || key}自動回復${Math.round(val * 100)}%`);
            } else if (key === 'PercentDamage') {
                detailEffects.push(`HP${Math.round(val * 100)}%ダメージ`);
            } else if (nameMap[key]) {
                if (val > 1) detailEffects.push(`${nameMap[key]}${val}倍`);
                else if (val < 1) detailEffects.push(`${nameMap[key]}${Math.round((1 - val) * 100)}%ダウン`);
            }
        };

        for (const key in sk) {
            if (sk[key] === true) {
                const labels = {
                    CureAilments: '状態異常治療', debuff_reset: 'デバフ解除', revive: '蘇生',
                    buff_reset: '相手バフ解除', IgnoreDefense: '守備無視', drain: 'HP吸収', fixed: '固定ダメージ'
                };
                if (labels[key]) detailEffects.push(labels[key]);
                else if (nameMap[key]) detailEffects.push(`${nameMap[key]}付与`);
            } else if (typeof sk[key] === 'number') {
                if (['elmResUp', 'elmResDown', 'PercentDamage'].includes(key) || key.includes('Regen')) processItem(key, sk[key]);
            }
        }
        if (sk.buff) for (const key in sk.buff) processItem(key, sk.buff[key]);
        if (sk.debuff) for (const key in sk.debuff) processItem(key, sk.debuff[key]);

        const meta = [
            ['消費MP', sk.mp ?? 0],
            ['ターゲット', sk.target || '不明'],
            [isAttack ? '攻撃回数' : '回数', `${sk.count || 1}回`]
        ];
        if (isAttack || isHeal) {
            meta.push(['威力倍率', `x${sk.rate || 0}`]);
            meta.push(['基礎値', sk.base || 0]);
        }
        if (sk.SuccessRate) meta.push(['命中率', `${sk.SuccessRate}%`]);
        if (sk.turn) meta.push(['効果時間', `${sk.turn}ターン`]);
        if (sk.priority) meta.push(['優先度', `${sk.priority > 0 ? '+' : ''}${sk.priority}`]);

        const uniqueEffects = [...new Set(detailEffects)];
        modal.innerHTML = `
            <section class="game-modal-dialog game-modal-dialog--skill" role="dialog" aria-modal="true" aria-labelledby="skill-detail-title">
                <header class="game-modal-header">
                    <div class="game-modal-heading">
                        <div id="skill-detail-title" class="game-modal-title">${escape(sk.name)}</div>
                    </div>
                    <div class="game-modal-badges">${typeTagsHtml}</div>
                </header>
                <div class="game-modal-body" tabindex="0">
                    <div class="game-modal-meta-grid">
                        ${meta.map(([label, value]) => `<div><span>${escape(label)}</span><b>${escape(value)}</b></div>`).join('')}
                    </div>
                    <div class="game-modal-description game-modal-description--accent">${escape(sk.desc || '（説明なし）')}</div>
                    <div class="game-modal-tag-list">
                        ${uniqueEffects.length
                            ? uniqueEffects.map(effect => `<span>${escape(effect)}</span>`).join('')
                            : '<span class="is-muted">追加効果なし</span>'}
                    </div>
                </div>
                <footer class="game-modal-footer">
                    <div class="game-modal-nav">
                        <button class="btn" type="button" onclick="MenuSkillDetail.move(-1)" aria-label="前のスキル">▲</button>
                        <button class="btn" type="button" onclick="MenuSkillDetail.move(1)" aria-label="次のスキル">▼</button>
                    </div>
                    <button class="btn game-modal-close" type="button" onclick="MenuSkillDetail.close()">閉じる</button>
                </footer>
            </section>
        `;
        modal.querySelector('.game-modal-body')?.scrollTo?.(0, 0);
    }
};

if (typeof window !== 'undefined') window.MenuSkillDetail = MenuSkillDetail;
