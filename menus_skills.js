/* MenuSkills extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
    6. スキル使用
    ========================================================================== */
const MenuSkills = {
    selectedCharUid: null,
    selectedSkill: null,

    init: () => {
        document.getElementById('sub-screen-skills').style.display = 'flex';
        MenuSkills.changeScreen('char');
    },

    changeScreen: (mode) => {
        document.getElementById('skill-screen-char').style.display = (mode === 'char' ? 'flex' : 'none');
        document.getElementById('skill-screen-skill').style.display = (mode === 'skill' ? 'flex' : 'none');
        document.getElementById('skill-screen-target').style.display = (mode === 'target' ? 'flex' : 'none');
        if (mode === 'char') MenuSkills.renderCharList();
    },

    renderCharList: () => {
        const list = document.getElementById('skill-char-list');
        list.innerHTML = '';
        App.data.party.forEach(uid => {
            if (!uid) return;
            const c = App.getChar(uid);
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = Menu.getCharacterCardHTML
                ? Menu.getCharacterCardHTML(c)
                : App.createCharHTML(c);
            div.onclick = () => {
                MenuSkills.selectedCharUid = uid;
                MenuSkills.renderSkillList();
            };
            list.appendChild(div);
        });
    },

    renderSkillList: () => {
        MenuSkills.changeScreen('skill');
        const list = document.getElementById('skill-list');
        list.innerHTML = '';
        const c = App.getChar(MenuSkills.selectedCharUid);
        const player = new Player(c);
        const skills = player.skills.filter(s => s.type.includes('回復') || s.type.includes('蘇生'));

        if (skills.length === 0) {
            list.innerHTML = '<div style="padding:10px; color:#888;">使用可能なスキルがありません</div>';
            return;
        }

        skills.forEach(sk => {
            const div = document.createElement('div');
            div.className = 'list-item menu-pick-card';
            const fallbackPath = Menu.getSkillIconPath ? Menu.getSkillIconPath(sk) : 'assets/ui/menu-icons/skill-skill.svg';
            div.innerHTML = `
                <div class="menu-pick-icon" data-icon-id="skill-${sk.id}"><img src="${fallbackPath}" alt=""></div>
                <div class="menu-pick-main">
                    <div class="menu-pick-title">${Menu.escapeHtml(sk.name)}</div>
                    <div class="menu-pick-meta">${Menu.escapeHtml(sk.type || '')}</div>
                    <div class="menu-pick-desc">${Menu.escapeHtml(sk.desc || '')}</div>
                </div>
                <div class="menu-pick-cost">MP:${sk.mp}</div>
            `;
            div.onclick = () => {
                if (c.currentMp < sk.mp) { Menu.msg("MPが足りません"); return; }
                MenuSkills.selectedSkill = sk;

                // ★全体スキルの場合はターゲット選択をスキップして直接実行へ
                if (sk.target === '全体') {
                    MenuSkills.useSkill(null);
                } else {
                    MenuSkills.renderTargetList();
                }
            };
            list.appendChild(div);
        });
    },

    renderTargetList: () => {
        MenuSkills.changeScreen('target');
        const list = document.getElementById('skill-target-list');
        list.innerHTML = '';
        App.data.party.forEach(uid => {
            if (!uid) return;
            const c = App.getChar(uid);
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = Menu.getCharacterCardHTML
                ? Menu.getCharacterCardHTML(c)
                : App.createCharHTML(c);
            div.onclick = () => MenuSkills.useSkill(c);
            list.appendChild(div);
        });
    },

    useSkill: (target) => {
        const actorData = App.getChar(MenuSkills.selectedCharUid);
        const sk = MenuSkills.selectedSkill;
        if (!actorData || !sk) return;

        const confirmMsg = (sk.target === '全体') ? `パーティ全体に ${sk.name} を使いますか？` : `${target.name} に ${sk.name} を使いますか？`;

        Menu.confirm(confirmMsg, () => {
            let targets = (sk.target === '全体') ? App.data.party.map(uid => App.getChar(uid)).filter(c => c) : [target];
            let effected = false;

            const actorStats = App.calcStats(actorData);
            const mag = actorStats.mag;
            
            // 成功率の取得 (バトルロジック準拠)
            const rawSuccessRate = sk.SuccessRate !== undefined ? sk.SuccessRate : 100;
            const successRate = (rawSuccessRate <= 1 && rawSuccessRate > 0) ? rawSuccessRate * 100 : rawSuccessRate;

            targets.forEach(t => {
                if (!t) return;
                const s = App.calcStats(t);
                const tMaxHp = s.maxHp;

                // ★成功判定 (バトルと同じ確率計算)
                if (Math.random() * 100 > successRate) return;

                if (sk.type.includes('回復')) {
                    // 生存者のみ回復
                    if (t.currentHp > 0 && t.currentHp < tMaxHp) {
                        let rec = 0;
                        if (sk.ratio) {
                            rec = Math.floor(tMaxHp * sk.ratio);
                        } else {
                            // ★修正：(魔力 * 倍率 + 基礎) * 乱数(0.85～1.15)
                            const baseVal = sk.fix ? (sk.base || 0) : (mag * (sk.rate || 1.0) + (sk.base || 0));
                            rec = Math.floor(baseVal * (0.85 + Math.random() * 0.3));
                        }
                        t.currentHp = Math.min(tMaxHp, (t.currentHp || 0) + rec);
                        effected = true;
                    }
                } else if (sk.type.includes('蘇生')) {
                    // 死者のみ蘇生
                    if (!t.currentHp || t.currentHp <= 0) {
                        // ★修正：蘇生HP量 (バトルと同じ)
                        const resRate = sk.rate !== undefined ? sk.rate : 0.5;
                        t.currentHp = Math.max(1, Math.floor(tMaxHp * resRate));
                        effected = true;
                    }
                }
            });

            if (effected) {
                actorData.currentMp -= sk.mp;
                App.save();
                Menu.msg(`${sk.name}を使用した！`, () => {
                    // 全体スキルの後はスキル一覧へ、単体はターゲット一覧を更新
                    if (sk.target === '全体') MenuSkills.renderSkillList();
                    else MenuSkills.renderTargetList();
                    Menu.renderPartyBar();
                });
            } else {
                Menu.msg("効果がありませんでした");
                if (sk.target === '全体') MenuSkills.renderSkillList();
            }
        });
    }
};

if (typeof window !== 'undefined') window.MenuSkills = MenuSkills;
