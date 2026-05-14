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
        MenuSkillDetail.skillList = list.filter(s => s.id !== 1);
        MenuSkillDetail.currentIndex = MenuSkillDetail.skillList.findIndex(s => s.id === skillId);
        MenuSkillDetail.render();
    },

    move: (dir) => {
        const len = MenuSkillDetail.skillList.length;
        if (len <= 1) return;
        MenuSkillDetail.currentIndex = (MenuSkillDetail.currentIndex + dir + len) % len;
        MenuSkillDetail.render();
    },

    close: () => {
        const el = document.getElementById('skill-detail-modal');
        if (el) el.remove();
    },

    render: () => {
        const sk = MenuSkillDetail.skillList[MenuSkillDetail.currentIndex];
        if (!sk) return;

        let modal = document.getElementById('skill-detail-modal');
        if (!modal) {
            modal = document.createElement('div'); modal.id = 'skill-detail-modal';
            document.body.appendChild(modal);
        }

        modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:5000; display:flex; align-items:center; justify-content:center; font-family:sans-serif;`;

        const isAttack = ["物理", "魔法", "ブレス", "通常攻撃"].includes(sk.type);
        const isHeal = sk.type === "回復";
        const elmColors = { '火':'#f88', '水':'#88f', '雷':'#ff0', '風':'#8f8', '光':'#ffc', '闇':'#a8f', '混沌':'#d4d' };
        
        let typeTagsHtml = `<span style="background:#444; color:#eee; padding:2px 6px; border-radius:3px; margin-right:5px;">${sk.type}</span>`;
        if (sk.elm) {
            const color = elmColors[sk.elm] || '#555';
            typeTagsHtml += `<span style="background:${color}; color:#000; padding:2px 6px; border-radius:3px; font-weight:bold;">${sk.elm}</span>`;
        }

        let detailEffects = [];
        const nameMap = MenuSkillDetail.statNames;
        const flatResKeys = ["Poison", "ToxicPoison", "Shock", "Fear", "SpellSeal", "SkillSeal", "HealSeal", "InstantDeath", "Debuff", "Seal"];

        // 項目パース用共通関数
        const processItem = (key, val) => {
            if (key === "elmResUp") detailEffects.push(`${nameMap.elmResUp}${val}%アップ`);
            else if (key === "elmResDown") detailEffects.push(`${nameMap.elmResDown}${val}%ダウン`);
            else if (key.startsWith("resists_")) {
                const ail = key.replace("resists_", "");
                detailEffects.push(`${nameMap[ail] || ail}耐性${val}%`);
            }
            else if (flatResKeys.includes(key)) {
                detailEffects.push(`${nameMap[key] || key}耐性${val}%`);
            }
            else if (key.includes("Regen")) {
                detailEffects.push(`${nameMap[key] || key}自動回復${Math.round(val * 100)}%`);
            }
            else if (key === "PercentDamage") {
                detailEffects.push(`HP${Math.round(val * 100)}%ダメージ`);
            }
            else if (nameMap[key]) {
                if (val > 1) detailEffects.push(`${nameMap[key]}${val}倍`);
                else if (val < 1) detailEffects.push(`${nameMap[key]}${Math.round((1 - val) * 100)}%ダウン`);
            }
        };

        // 1. ルートのプロパティをスキャン (異常付与フラグの検知)
        for (let k in sk) {
            if (sk[k] === true) {
                if (k === "CureAilments") detailEffects.push(`<span style="color:#f8f;">状態異常治療</span>`);
                else if (k === "debuff_reset") detailEffects.push(`<span style="color:#8f8;">デバフ解除</span>`);
                else if (k === "revive") detailEffects.push(`<span style="color:#fff; text-shadow:0 0 5px #0ff;">蘇生</span>`);
                else if (k === "buff_reset") detailEffects.push(`<span style="color:#8ff;">相手バフ解除</span>`);
                else if (k === "IgnoreDefense") detailEffects.push(`<span style="color:#f88;">守備無視</span>`);
                else if (k === "drain") detailEffects.push(`<span style="color:#8f8;">HP吸収</span>`);
                else if (k === "fixed") detailEffects.push(`<span style="color:#ff8;">固定ダメージ</span>`);
                else if (nameMap[k]) detailEffects.push(`<span style="color:#fa0;">${nameMap[k]}付与</span>`);
            } else if (typeof sk[k] === 'number') {
                // elmResUp等がルートにある場合に対応
                if (["elmResUp", "elmResDown", "PercentDamage"].includes(k) || k.includes("Regen")) processItem(k, sk[k]);
            }
        }

        // 2. buff/debuff オブジェクト内の解析 (弓聖の守り星等の耐性・倍率対応)
        if (sk.buff) for (let k in sk.buff) processItem(k, sk.buff[k]);
        if (sk.debuff) for (let k in sk.debuff) processItem(k, sk.debuff[k]);

        let gridHtml = `
            <div>消費MP: <span style="color:#88f;">${sk.mp}</span></div>
            <div>ターゲット: <span style="color:#fff;">${sk.target}</span></div>
            <div>${isAttack ? '攻撃回数' : '回数'}: <span style="color:#ffd700;">${sk.count || 1}回</span></div>
        `;
        if (isAttack || isHeal) {
            gridHtml += `<div>威力倍率: <span style="color:#fff;">x${sk.rate || 0}</span></div>`;
            gridHtml += `<div>基礎値: <span style="color:#fff;">${sk.base || 0}</span></div>`;
        }
        if (sk.SuccessRate) gridHtml += `<div>命中率: <span style="color:#fff;">${sk.SuccessRate}%</span></div>`;
        if (sk.turn) gridHtml += `<div>効果時間: <span style="color:#8f8;">${sk.turn}ターン</span></div>`;
        if (sk.priority) gridHtml += `<div>優先度: <span style="color:#f88;">${sk.priority > 0 ? '+' : ''}${sk.priority}</span></div>`;

        modal.innerHTML = `
            <div style="width:310px; background:rgba(0,0,30,0.95); border:2px solid #ffd700; border-radius:12px; padding:20px; color:#eee; box-shadow:0 0 30px #000; position:relative;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; padding-bottom:10px; margin-bottom:12px;">
                    <span style="color:#ffd700; font-size:17px; font-weight:bold;">${sk.name}</span>
                    <div style="font-size:10px;">${typeTagsHtml}</div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px; background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:15px;">
                    ${gridHtml}
                </div>
                <div style="font-size:13px; line-height:1.6; margin-bottom:15px; color:#ddd; min-height:3.5em; border-left:3px solid #ffd700; padding-left:12px; font-style:italic;">
                    ${sk.desc || '（説明なし）'}
                </div>
                <div style="font-size:11px; color:#aaa; border-top:1px solid #333; padding-top:10px; margin-bottom:20px; display:flex; flex-wrap:wrap; gap:6px;">
                    ${detailEffects.length > 0 ? [...new Set(detailEffects)].map(e => `<span style="background:#222; padding:3px 6px; border-radius:4px; border:1px solid #444;">${e}</span>`).join('') : '<span style="color:#555;">追加効果なし</span>'}
                </div>
                <div style="display:flex; justify-content:space-between; gap:10px;">
                    <div style="display:flex; gap:8px;">
                        <button class="btn" style="padding:10px 20px; background:#222; border:1px solid #ffd700; color:#ffd700;" onclick="MenuSkillDetail.move(-1)">▲</button>
                        <button class="btn" style="padding:10px 20px; background:#222; border:1px solid #ffd700; color:#ffd700;" onclick="MenuSkillDetail.move(1)">▼</button>
                    </div>
                    <button class="btn" style="flex:1; background:#444; border:1px solid #666; font-weight:bold;" onclick="MenuSkillDetail.close()">閉じる</button>
                </div>
            </div>
        `;
    }

};

if (typeof window !== 'undefined') window.MenuSkillDetail = MenuSkillDetail;
