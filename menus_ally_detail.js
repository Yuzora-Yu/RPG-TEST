/* MenuAllyDetail extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   仲間詳細・アーカイブ画面 (完全版: 同期・ソート・固定レイアウト修正)
   ========================================================================== */
const MenuAllyDetail = {
    selectedChar: null,
    currentMainTab: 'archive', 
    currentArchive: 'base',

	init: (char) => {
		if (!char) return;

		MenuAllyDetail.selectedChar = char;
		MenuAllies.selectedChar = char;
		MenuAllies.selectedUid = char.uid;

		MenuAllyDetail.currentMainTab = 'archive';
		MenuAllyDetail.currentArchive = 'base';

		MenuAllies.showArchiveView();
		MenuAllyDetail.render();
	},
	
	render: () => {
		const c = MenuAllyDetail.selectedChar;
		if (!c) {
			MenuAllies.returnFromArchiveToDetail();
			return;
		}

		MenuAllies.selectedChar = c;
		MenuAllies.selectedUid = c.uid;
		MenuAllies.showArchiveView();

		const view = document.getElementById('allies-detail-view');
		const detailContent = MenuAllies.ensureDetailContent();
		if (!view || !detailContent) return;
        
        // メインタブ (固定エリア: flex-shrink: 0)
        const tabs = `
            <div style="display:flex; background:#222; margin-bottom:12px; border-radius:6px; overflow:hidden; border:1px solid #444; flex-shrink:0;">
                <button onclick="MenuAllyDetail.changeMainTab('archive')" style="flex:1; padding:10px; border:none; background:${MenuAllyDetail.currentMainTab==='archive'?'#ffd700':'#111'}; color:${MenuAllyDetail.currentMainTab==='archive'?'#000':'#666'}; font-weight:bold; font-size:12px;">アーカイブ</button>
                <button onclick="MenuAllyDetail.changeMainTab('progress')" style="flex:1; padding:10px; border:none; background:${MenuAllyDetail.currentMainTab==='progress'?'#ffd700':'#111'}; color:${MenuAllyDetail.currentMainTab==='progress'?'#000':'#666'}; font-weight:bold; font-size:12px;">成長の記録</button>
            </div>
        `;

		view.style.display = 'flex';
		view.style.flexDirection = 'column';

		detailContent.style.display = 'flex';
		detailContent.style.flexDirection = 'column';
		detailContent.style.minHeight = '0';

		detailContent.innerHTML = `
			<div style="padding:15px 15px 0 15px; background:#050505; flex-shrink:0;">
				${tabs}
			</div>
			<div id="ally-detail-body" class="scroll-area" style="padding:0 15px 15px 15px; background:#050505; flex:1; overflow-y:auto;">
				${MenuAllyDetail.currentMainTab === 'archive' ? MenuAllyDetail.renderArchive() : MenuAllyDetail.renderProgress()}
			</div>
		`;

        // ガチャカード側のCSS枠線除去処理を、仲間詳細の静的カードにも適用する。
        // 既存のガチャ演出/位置調整CSSはそのまま利用し、ここでは表示後の保険だけ行う。
        requestAnimationFrame(() => {
            if (typeof Gacha !== 'undefined' && typeof Gacha.removePremiumCssFrame === 'function') {
                Gacha.removePremiumCssFrame(detailContent);
            }
        });
    },

    renderArchive: () => {
        const c = MenuAllyDetail.selectedChar;
        const master = DB.CHARACTERS.find(m => m.id === c.charId) || {};
        const rarity = c.rarity || 'N';
        const stars = { 'N': 1, 'R': 2, 'SR': 3, 'SSR': 4, 'UR': 5, 'EX': 6 }[rarity] || 1;
        const imgUrl = c.img || master.img;

        let frontRareClass = "";
        if (rarity === "SSR") frontRareClass = "style-gold";
        else if (rarity === "UR") frontRareClass = "style-aurora";
        else if (rarity === "EX") frontRareClass = "style-majestic";

        // カードレイアウト：ガチャ演出と同じ premium-card-front を使用する。
        // 位置・サイズ・色・オーラは index.html 側の最新ガチャCSSをそのまま反映。
        const rarityClass = (typeof Gacha !== 'undefined' && typeof Gacha.getRarityClass === 'function')
            ? Gacha.getRarityClass(rarity)
            : `rarity-${String(rarity).toLowerCase()}`;
        const cardData = {
            ...master,
            ...c,
            id: c.charId || master.id,
            charId: c.charId || master.id,
            name: c.name || master.name,
            job: c.job || master.job || '',
            rarity,
            img: imgUrl || '',
            isNew: false,
            limitBreak: Number(c.limitBreak || 0)
        };

        let premiumFrontHtml = (typeof Gacha !== 'undefined' && typeof Gacha.buildPremiumFrontFace === 'function')
            ? Gacha.buildPremiumFrontFace(cardData)
            : `
                <div class="card-face card-front premium-card-front ${rarityClass}" style="transform:none;">
                    <div class="gacha-card-backdrop"></div>
                    <div class="gacha-card-rarity-aura"></div>
                    <div class="gacha-character-window">
                        ${imgUrl ? `<img class="gacha-card-character" src="${imgUrl}" alt="">` : '<div class="gacha-card-silhouette">?</div>'}
                    </div>
                    <img class="gacha-card-template" src="assets/gacha/front_card.png" alt="">
                    <div class="gacha-card-rarity">${rarity}</div>
                    <div class="gacha-card-stars">${'★'.repeat(stars)}</div>
                    <div class="gacha-card-name"><span class="gacha-card-name-text">${c.name || ''}</span>${Number(c.limitBreak || 0) > 0 ? `<span class="gacha-lb-plus"> +${c.limitBreak}</span>` : ''}</div>
                    <div class="gacha-card-job">${c.job || ''}</div>
                    <div class="gacha-card-foil"></div>
                </div>`;

        // MenuAllyDetail の静的カードでは、ガチャ演出用のキャラ登場アニメーションを止めて
        // 初期描画時点からキャラクター画像を表示する。
		premiumFrontHtml = premiumFrontHtml
			.replace(
				'class="gacha-card-character"',
				'class="gacha-card-character ally-detail-card-character" style="animation:none !important; -webkit-animation:none !important; opacity:1 !important;"'
			)
			.replace(
				'class="card-face card-front premium-card-front',
				'class="card-face card-front premium-card-front ally-detail-card-front'
			);


        const cardHtml = `
            <div style="display:flex; align-items:center; justify-content:center; gap:15px; margin-bottom:20px; user-select:none;">
                <div onclick="MenuAllyDetail.switchChar(-1)" style="color:#ffd700; font-size:28px; cursor:pointer; text-shadow:2px 2px 4px #000; padding:10px; transition:0.2s; filter:drop-shadow(0 0 5px rgba(255,215,0,0.3));">◀</div>

                <div class="gacha-card-scene premium-card premium-card-static ally-detail-premium-card ${rarityClass}" style="width:clamp(205px, min(66vw, 36svh), 265px) !important; height:auto !important; aspect-ratio:2/3 !important; flex-shrink:0; animation:none !important;">
                    ${premiumFrontHtml}
                </div>

                <div onclick="MenuAllyDetail.switchChar(1)" style="color:#ffd700; font-size:28px; cursor:pointer; text-shadow:2px 2px 4px #000; padding:10px; transition:0.2s; filter:drop-shadow(0 0 5px rgba(255,215,0,0.3));">▶</div>
            </div>
        `;

        const milestones = [
            { id: 'base',  label: '初期', cond: () => true },
            { id: 'lv50',  label: 'Lv50', cond: () => c.level >= 50 },
            { id: 'lb50',  label: '+50',  cond: () => c.limitBreak >= 50 },
            { id: 'lv100', label: 'Lv100',cond: () => c.level >= 100 },
            { id: 'lb99',  label: '+99',  cond: () => c.limitBreak >= 99 }
        ];

        const archiveBtns = milestones.map(m => {
            const unlocked = m.cond();
            const active = MenuAllyDetail.currentArchive === m.id;
            const style = active ? 'background:#ffd700; color:#000; font-weight:bold;' : 'background:#222; color:#555;';
            return `<div onclick="${unlocked ? `MenuAllyDetail.changeArchive('${m.id}')` : ''}" 
                         style="flex:1; text-align:center; font-size:10px; padding:6px 0; cursor:pointer; border-right:1px solid #000; ${style}">
                         ${unlocked ? m.label : '🔒'}
                    </div>`;
        }).join('');

        const archives = master.archives || {};
        const flavorText = milestones.find(m => m.id === MenuAllyDetail.currentArchive).cond() 
            ? (archives[MenuAllyDetail.currentArchive] || "記録がありません。")
            : `<div style="color:#444; text-align:center; padding:30px 10px; font-size:11px;">未解放の記録です<br><br>さらなる成長で紐解かれます</div>`;

        return `
            ${cardHtml}
            <div style="background:rgba(255,255,255,0.03); border:1px solid #444; border-radius:8px; overflow:hidden; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
                <div style="display:flex; border-bottom:1px solid #444;">${archiveBtns}</div>
                <div id="flavor-text-area" style="padding:15px; min-height:120px; font-size:13px; line-height:1.8; color:#bbb; white-space:pre-wrap;">${flavorText}</div>
            </div>
        `;
    },

    renderProgress: () => {
        const c = MenuAllyDetail.selectedChar;
        const master = DB.CHARACTERS.find(m => m.id === c.charId) || {};
        const jobData = window.JOB_SKILLS_DATA ? window.JOB_SKILLS_DATA[c.job] : null;
        if(!jobData) return `<div style="color:#666; text-align:center; padding:40px;">データが存在しません</div>`;

        let html = `<div style="font-size:11px; color:#aaa; margin-bottom:15px; text-align:center;">解放される可能性の断片</div>`;
        
        const allPossible = [];
        // 通常スキル (LV 1-100)
        Object.entries(jobData).forEach(([lv, skillId]) => {
            allPossible.push({ id: skillId, type: 'LV', req: parseInt(lv) });
        });
        // 限界突破スキル (+50, +99)
        if(master.lbSkills) {
            Object.entries(master.lbSkills).forEach(([lbReq, skillId]) => {
                allPossible.push({ id: skillId, type: 'LB', req: parseInt(lbReq) });
            });
        }

        // ★修正: LVスキル(1-100)を先に、その後ろにLBスキルを並べる
        allPossible.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'LV' ? -1 : 1;
            return a.req - b.req;
        });

        allPossible.forEach(entry => {
            const isLearned = entry.type === 'LV' ? c.level >= entry.req : c.limitBreak >= entry.req;
            const skill = DB.SKILLS.find(s => s.id === entry.id);
            const condText = entry.type === 'LV' ? `Lv.${entry.req}` : `突破+${entry.req}`;
            if(!skill) return;

            html += `
                <div style="background:rgba(255,255,255,0.02); border:1px solid #333; padding:12px; margin-bottom:8px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1; padding-right:10px;">
                        <div style="font-size:14px; font-weight:bold; color:${isLearned ? '#ffd700' : '#333'};">${isLearned ? skill.name : '？？？？？？'}</div>
                        <div style="font-size:10px; color:${isLearned ? '#888' : '#222'}; margin-top:2px;">${isLearned ? skill.desc : '未知の能力'}</div>
                    </div>
                    <div style="font-size:10px; font-weight:bold; color:${isLearned ? '#4f4' : '#ffd700'}; background:rgba(0,0,0,0.4); padding:4px 10px; border-radius:15px; border:1px solid ${isLearned?'#040':'#440'}; white-space:nowrap;">
                        ${isLearned ? '修得済' : condText}
                    </div>
                </div>`;
        });
        
        return html;
    },

    // キャラ切り替え：MenuAllies.selectedChar も同期して「もどる」時のズレを解消
    switchChar: (dir) => {
        const rarityVal = { N:1, R:2, SR:3, SSR:4, UR:5, EX:6 };
        const chars = [...App.data.characters].sort((a, b) => {
            const aInParty = App.data.party.includes(a.uid);
            const bInParty = App.data.party.includes(b.uid);
            if (aInParty !== bInParty) return bInParty - aInParty;
            if (a.uid === 'p1') return -1;
            if (b.uid === 'p1') return 1;
            const rA = rarityVal[a.rarity] || 0;
            const rB = rarityVal[b.rarity] || 0;
            if (rA !== rB) return rB - rA;
            if (b.level !== a.level) return b.level - a.level;
            return a.charId - b.charId;
        });
        let idx = chars.findIndex(ch => ch.uid === MenuAllyDetail.selectedChar.uid);
        let newIdx = (idx + dir + chars.length) % chars.length;
        
        const nextChar = chars[newIdx];
        MenuAllyDetail.selectedChar = nextChar;
        // ★重要: 基本画面のターゲットも同期させる
        MenuAllies.selectedChar = nextChar;
		MenuAllies.selectedUid = nextChar.uid; // ★追加：UIDを同期
        
        MenuAllyDetail.render();
    },

    changeMainTab: (tab) => {
        MenuAllyDetail.currentMainTab = tab;
        MenuAllyDetail.render();
    },

    // アーカイブのサブタブ切り替え：スクロール位置を保持
    changeArchive: (milestoneId) => {
        const body = document.getElementById('ally-detail-body');
        const scrollPos = body ? body.scrollTop : 0;
        
        MenuAllyDetail.currentArchive = milestoneId;
        MenuAllyDetail.render();
        
        // 再描画後にスクロールを戻す
        const newBody = document.getElementById('ally-detail-body');
        if (newBody) newBody.scrollTop = scrollPos;
    }
};

if (typeof window !== 'undefined') window.MenuAllyDetail = MenuAllyDetail;
