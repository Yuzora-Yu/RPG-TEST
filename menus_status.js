/* MenuStatus extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   2.: プレイ状況画面 / 冒険の記録
   --------------------------------------------------------------------------
   この画面だけ独自フォント・太字指定が残ると、他メニューと見た目がズレる。
   ヘッダーは .header-bar の共通CSSに任せ、数値表示も monospace にしない。
   Codex等で修正する場合も、ここだけ font-family や header の bold を再追加しないこと。
   ========================================================================== */

const MenuStatus = {
    activeTab: 'record',

    createDOM: () => {
        if(document.getElementById('sub-screen-status')) return;
        const div = document.createElement('div');
        div.id = 'sub-screen-status';
        div.className = 'sub-screen';
        div.style.display = 'none';
        div.style.flexDirection = 'column';
        div.style.background = '#101010';
		div.innerHTML = `
			<div class="header-bar">
				<span>⚔️ 冒険の記録</span>
				<button class="btn" onclick="Menu.closeSubScreen('status')">もどる</button>
			</div>

            <div style="display:flex; margin:10px 12px 0; border-radius:6px; overflow:hidden; border:1px solid #444; background:#222; flex-shrink:0;">
                <button id="status-tab-record" style="flex:1; min-width:0; padding:10px 4px; border:none; font-weight:bold; font-size:11px; font-family:inherit;" onclick="MenuStatus.setTab('record')">記録</button>
                <button id="status-tab-quests" style="flex:1; min-width:0; padding:10px 4px; border:none; font-weight:bold; font-size:11px; font-family:inherit;" onclick="MenuStatus.setTab('quests')">クエスト</button>
                <button id="status-tab-guild" style="flex:1; min-width:0; padding:10px 4px; border:none; font-weight:bold; font-size:11px; font-family:inherit;" onclick="MenuStatus.setTab('guild')">ギルド</button>
            </div>

			<div
				id="status-content"
				class="scroll-area"
				style="
					flex:1 1 auto;
					min-height:0;
					padding:15px;
					background:linear-gradient(180deg, #101010 0%, #1a1a1a 100%);
					overflow-y:auto;
					font-family:inherit;
				"
			></div>

			<div class="sub-screen-bottom-panel">
				<button class="btn sub-screen-back-btn" onclick="Menu.closeSubScreen('status')">もどる</button>
			</div>
		`;
        document.getElementById('game-container').appendChild(div);
    },

    init: () => {
        MenuStatus.createDOM();
        MenuStatus.render();
    },

    setTab: (tab) => {
        MenuStatus.activeTab = tab || 'record';
        MenuStatus.render();
    },

    render: () => {
        const content = document.getElementById('status-content');
        if(!content) return;

        const tabRecord = document.getElementById('status-tab-record');
        const tabQuests = document.getElementById('status-tab-quests');
        const tabGuild = document.getElementById('status-tab-guild');
        const styleTab = (button, active) => {
            if (!button) return;
            button.style.background = active ? '#ffd700' : '#111';
            button.style.color = active ? '#000' : '#777';
        };
        styleTab(tabRecord, MenuStatus.activeTab === 'record');
        styleTab(tabQuests, MenuStatus.activeTab === 'quests');
        styleTab(tabGuild, MenuStatus.activeTab === 'guild');

        if (MenuStatus.activeTab === 'quests') {
            MenuStatus.renderQuests(content);
            return;
        }
        if (MenuStatus.activeTab === 'guild') {
            MenuStatus.renderGuild(content);
            return;
        }
        
        const stats = App.data.stats || {};
        const dungeon = App.data.dungeon || { maxFloor: 0, tryCount: 0 };
        const progress = App.data.progress || {};
        const flags = progress.flags || {};
        const storyProgress = `${progress.storyStep || 0}-${progress.subStep || 0}`;
        const normalQuestClears = App.getNormalQuestCompletionCount?.() || Number(stats.totalQuestCompletions || 0);
        const guildQuestClears = App.getGuildQuestCompletionCount?.() || Number(stats.totalGuildQuestCompletions || 0);
        const guildRank = String(progress.guild?.rank || 'G');
        const randomMaxFloor = Number(dungeon.maxFloor || 0);
        
        // モンスター図鑑の計算
        const bookCount = App.data.book ? App.data.book.monsters.length : 0;
        const totalMonsters = (typeof DB !== 'undefined' && DB.MONSTERS) ? DB.MONSTERS.length : 0;
        const bookRate = totalMonsters > 0 ? Math.floor((bookCount / totalMonsters) * 100) : 0;
        
        // 最高ダメージデータの取得
        const maxDmg = stats.maxDamage || { 
		  val: 0, 
		  actor: '未記録', 
		  actorLv: null,
		  skill: '-', 
		  time: null 
		};

		// ★追加：表示用文字列をここで生成
		const dmgLvStr   = (maxDmg.actorLv != null) ? `Lv.${maxDmg.actorLv}` : 'Lv.-';
		const dmgTimeStr = maxDmg.time 
		  ? new Date(maxDmg.time).toLocaleString('ja-JP') 
		  : '-';

        const row = (label, val, color='#fff', fontSize='14px') => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #333; align-items:center; font-family:inherit;">
                <span style="color:#aaa; font-size:11px; font-family:inherit;">${label}</span>
                <span style="color:${color}; font-weight:bold; font-size:${fontSize}; font-family:inherit;">${val}</span>
            </div>`;

        content.innerHTML = `
            <div style="background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:8px; padding:12px; margin-bottom:15px; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                <div style="font-size:10px; color:#ffd700; margin-bottom:8px; display:flex; align-items:center; gap:5px;">
                    <span style="background:#ffd700; width:3px; height:12px; display:inline-block;"></span> 冒険の足跡
                </div>
                ${row('ストーリー進行度', storyProgress, '#fff', '16px')}
                ${row('深淵世界の踏破', flags.abyssAzelgaragDefeated ? '達成' : '攻略中', '#d7b8ff', '16px')}
                ${row('ランダム深淵 最高到達', `${randomMaxFloor} 階`, '#ffd700', '16px')}
                ${row('深淵挑戦回数（合計）', `${dungeon.tryCount || 0} 回`)}
                ${row('ランダム深淵の挑戦', `${dungeon.randomTryCount || 0} 回`)}
                ${row('冒険者ランク', `${guildRank}ランク`, '#ffd56b')}
                ${row('通常クエストクリア', `${normalQuestClears} 件`, '#9fd8ff')}
                ${row('ギルド依頼クリア', `${guildQuestClears} 件`, '#8cff9d')}
                ${row('モンスター図鑑進捗', `${bookCount} / ${totalMonsters} 種 (${bookRate}%)`, '#44ff44')}
                ${row('全滅回数', `${stats.wipeoutCount || 0} 回`, '#ff4444')}
            </div>

            <div style="background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:8px; padding:12px; margin-bottom:15px;">
                <div style="font-size:10px; color:#44ff44; margin-bottom:8px; display:flex; align-items:center; gap:5px;">
                    <span style="background:#44ff44; width:3px; height:12px; display:inline-block;"></span> 資産の記録
                </div>
                ${row('累計獲得Gold', `${(stats.totalGoldEarned || 0).toLocaleString()} gold`)}
                ${row('累計獲得GEM',  `${(stats.totalGemsEarned || 0).toLocaleString()} GEM`)}
                ${row('累計獲得メダル', `${(stats.totalMedals || 0).toLocaleString()} 枚`)}
            </div>

            <div style="background:rgba(255,255,255,0.05); border:1px solid #6b78aa; border-radius:8px; padding:12px; margin-bottom:15px;">
                <div style="font-size:10px; color:#9cb7ff; margin-bottom:8px; display:flex; align-items:center; gap:5px;"><span style="background:#9cb7ff; width:3px; height:12px; display:inline-block;"></span> 生産の記録</div>
                ${row('錬金回数', `${Number(stats.totalAlchemyCrafts || 0).toLocaleString()} 回`)}
                ${row('錬成アイテム数', `${Number(stats.totalAlchemyItemsCrafted || 0).toLocaleString()} 個`)}
                ${row('鍛冶回数', `${Number(stats.totalBlacksmithActions || 0).toLocaleString()} 回`)}
                ${row('装備合成', `${Number(stats.blacksmithSynthesisCount || 0).toLocaleString()} 回`)}
                ${row('精錬 成功 / 挑戦', `${Number(stats.blacksmithRefineSuccesses || 0).toLocaleString()} / ${Number(stats.blacksmithRefineAttempts || 0).toLocaleString()}`)}
                ${row('強化 成功 / 挑戦', `${Number(stats.blacksmithEnhanceSuccesses || 0).toLocaleString()} / ${Number(stats.blacksmithEnhanceAttempts || 0).toLocaleString()}`)}
                ${row('戦闘勝利数', `${Number(stats.totalBattles || 0).toLocaleString()} 回`)}
                ${row('宝箱開封数', `${Number(stats.totalChestsOpened || 0).toLocaleString()} 個`)}
            </div>

            <div style="background:rgba(255,255,255,0.05); border:1px solid #f44; border-radius:8px; padding:12px; margin-bottom:15px;">
                <div style="font-size:10px; color:#ff4444; margin-bottom:8px; display:flex; align-items:center; gap:5px;">
                    <span style="background:#ff4444; width:3px; height:12px; display:inline-block;"></span> 戦闘の極み
                </div>
                <div style="padding:5px 0;">
					<div style="display:flex; align-items:stretch; gap:12px;">

					  <!-- 左：詳細情報 -->
					  <div style="flex:1; min-width:0;">
						<div style="font-size:12px; color:#fff; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
						  ${maxDmg.actor} <span style="font-size:10px; color:#aaa; font-weight:normal;">(${dmgLvStr})</span>
						</div>

						<div style="font-size:10px; color:#888; margin-top:4px;">
						  使用技: ${maxDmg.skill}
						</div>

						<div style="font-size:9px; color:#666; margin-top:2px;">
						  記録日時: ${dmgTimeStr}
						</div>
					  </div>

					  <!-- 右：ダメージ数値 -->
					  <div style="
						flex:0 0 auto;
						min-width:90px;
						display:flex;
						align-items:center;
						justify-content:flex-end;
						font-size:22px;
						color:#ffd700;
						font-weight:bold;
						font-family:inherit;
						text-align:right;
					  ">
						${(maxDmg.val || 0).toLocaleString()}
					  </div>
					</div>
				</div>
			</div>
		`;
    },

    renderQuests: (content) => {
        const defs = (typeof App !== 'undefined' && App.getQuestDefinitions) ? App.getQuestDefinitions() : {};
        const questIds = Object.keys(defs || {}).filter(id => {
            const state = App.getQuestState ? App.getQuestState(id).state : 'available';
            return state === 'accepted' || state === 'completed';
        });
        const stateLabel = { accepted: '進行中', completed: '完了' };
        const stateColor = { accepted: '#ffd700', completed: '#44ff44' };
        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));

        const rows = questIds.map(id => {
            const quest = defs[id];
            const questState = App.getQuestState ? App.getQuestState(id) : { state: 'accepted' };
            const state = questState.state || 'accepted';
            const isReportable = App.isQuestObjectiveComplete && App.isQuestObjectiveComplete(id);
            const label = isReportable && state === 'accepted' ? '報告可' : (stateLabel[state] || state);
            const color = isReportable && state === 'accepted' ? '#44ff44' : (stateColor[state] || '#aaa');
            const kind = App.getQuestKindLabel ? App.getQuestKindLabel(quest.kind) : (quest.kind || '依頼');
            const icon = state === 'completed' ? '✓' : (isReportable ? '!' : '…');
            const iconBg = state === 'completed' ? '#2d5b35' : (isReportable ? '#455f27' : '#5d451b');

            return `
                <button
                    class="list-item"
                    style="width:100%; text-align:left; display:flex; align-items:center; gap:8px; padding:9px 10px; margin-bottom:5px; border-radius:4px; border:1px solid #3d3425; background:rgba(255,255,255,0.045); color:#eee; cursor:pointer;"
                    onclick="MenuStatus.openQuestDetail('${escapeHtml(id)}')"
                >
                    <span style="flex:0 0 auto; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; border-radius:3px; background:${iconBg}; color:#fff4c8; font-size:11px; font-weight:bold;">${icon}</span>
                    <span style="flex:1; min-width:0;">
                        <span style="display:block; font-size:13px; color:#fff; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(quest.name)}</span>
                        <span style="display:block; font-size:10px; color:#aaa; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(quest.area || '-')} / ${escapeHtml(kind)}</span>
                    </span>
                    <span style="flex:0 0 auto; color:${color}; font-size:11px; font-weight:bold;">${label}</span>
                </button>`;
        }).join('');

        const acceptedCount = questIds.filter(id => App.getQuestState(id).state === 'accepted').length;
        const completedCount = questIds.filter(id => App.getQuestState(id).state === 'completed').length;

        content.innerHTML = `
            <div style="display:flex; gap:8px; margin-bottom:10px;">
                <div style="flex:1; background:rgba(255,255,255,0.055); border:1px solid #444; border-radius:6px; padding:8px;">
                    <div style="font-size:10px; color:#aaa;">進行中</div>
                    <div style="font-size:18px; color:#ffd700; font-weight:bold;">${acceptedCount}</div>
                </div>
                <div style="flex:1; background:rgba(255,255,255,0.055); border:1px solid #444; border-radius:6px; padding:8px;">
                    <div style="font-size:10px; color:#aaa;">完了</div>
                    <div style="font-size:18px; color:#44ff44; font-weight:bold;">${completedCount}</div>
                </div>
            </div>
            <div style="border:1px solid #3d3425; border-radius:7px; padding:8px; background:rgba(0,0,0,0.18);">
                ${rows || '<div style="color:#888; font-size:12px; padding:12px;">受注中のクエストはありません。</div>'}
            </div>
            <div style="font-size:10px; color:#777; margin-top:8px;">クエスト名を選ぶと詳細を確認できます。</div>
        `;
    },

    renderGuild: (content) => {
        if (typeof Guild === 'undefined') {
            content.innerHTML = '<div style="color:#888; padding:16px;">冒険者ギルドの記録はまだ利用できません。</div>';
            return;
        }
        const state = Guild.ensureState();
        const progress = Guild.currentExpProgress();
        const defs = Guild.getDefinitions();
        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
        const rankStart = Number(Guild.expThresholds?.[state.rank] || 0);
        const rankSpan = progress.next ? Math.max(1, progress.required - rankStart) : 1;
        const rankEarned = progress.next ? Math.max(0, state.exp - rankStart) : rankSpan;
        const rate = Math.max(0, Math.min(100, Math.floor(rankEarned / rankSpan * 100)));
        const acceptedIds = Object.keys(state.questStates || {}).filter(id => state.questStates[id]?.state === 'accepted' && defs[id]);
        const completedTotal = Math.max(0, Number(state.generatedCompletionTotal || 0)) + Object.values(state.completionCounts || {}).reduce((sum, count) => sum + Math.max(0, Number(count || 0)), 0);
        const canGuildTravel = typeof App.canTravelToGuildReception === 'function' && App.canTravelToGuildReception();
        const rows = acceptedIds.map(id => {
            const def = defs[id];
            const ready = Guild.isObjectiveComplete(id);
            const travelAreaKey = App.resolveQuestTravelAreaKey?.(def) || '';
            return `<div style="padding:9px 10px; margin-bottom:6px; border:1px solid ${ready ? '#5f8d52' : '#4b4435'}; border-radius:5px; background:rgba(255,255,255,.045);">
                <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;"><strong style="font-size:12px; color:#fff; display:flex; align-items:center; min-width:0;">${Guild.rarityBadgeHtml?.(def) || ''}<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(def.name)}</span></strong><span style="font-size:10px; color:${ready ? '#8cff9d' : '#ffd56b'};">${ready ? '報告可能' : '進行中'}</span></div>
                <div style="font-size:10px; color:#aaa; margin-top:5px; white-space:pre-wrap;">${escapeHtml(Guild.targetSummary(id))}</div>
                ${travelAreaKey ? `<button class="btn" style="width:100%; margin-top:7px; padding:6px; border-color:#5c96b5; color:#dff4ff; background:#183445;" onclick="MenuStatus.travelToGuildQuest('${escapeHtml(id)}')">対象エリア入口へ移動</button>` : ''}
            </div>`;
        }).join('');

        content.innerHTML = `
            <div style="border:1px solid #78623a; border-radius:8px; padding:14px; background:linear-gradient(180deg, rgba(99,72,28,.32), rgba(0,0,0,.18)); margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div><div style="font-size:10px; color:#cdbb91;">冒険者ランク</div><div style="font-size:42px; line-height:1; color:#ffd56b; font-weight:bold;">${escapeHtml(state.rank)}</div></div>
                    <div style="text-align:right; font-size:11px; color:#bbb;">累計達成 ${completedTotal} 件<br><span style="color:#9fd8ff;">${state.points.toLocaleString()} GP</span></div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:13px; font-size:10px; color:#aaa;"><span>ギルド経験値 ${state.exp.toLocaleString()}</span><span>${progress.next ? `次の${progress.next}まで ${progress.remaining.toLocaleString()}` : '最高ランク'}</span></div>
                <div style="height:10px; margin-top:5px; border:1px solid #6a5a3a; background:#15120d; border-radius:5px; overflow:hidden;"><div style="height:100%; width:${rate}%; background:linear-gradient(90deg,#b78a2d,#ffe080);"></div></div>
                <div style="font-size:9px; color:#777; text-align:right; margin-top:3px;">${progress.next ? `${rankEarned.toLocaleString()} / ${rankSpan.toLocaleString()}` : 'RANK MAX'}</div>
            </div>
            <div style="font-size:10px; color:#ffd56b; margin:0 0 7px 2px;">受注中のギルド依頼 (${acceptedIds.length}/5)</div>
            <div style="border:1px solid #3d3425; border-radius:7px; padding:8px; background:rgba(0,0,0,.18);">${rows || '<div style="color:#888; font-size:12px; padding:12px;">受注中のギルド依頼はありません。</div>'}</div>
            <button class="menu-btn" ${canGuildTravel ? '' : 'disabled'} style="width:100%; min-height:42px; margin-top:10px; border-color:${canGuildTravel ? '#8bbcff' : '#444'}; color:${canGuildTravel ? '#dcecff' : '#666'}; background:${canGuildTravel ? '#183445' : '#171717'};" onclick="MenuStatus.travelToGuildReception()">ギルドへ移動</button>
            <div style="font-size:10px; color:#777; margin-top:8px;">依頼は魔道通信またはライザーク要塞1階の掲示板から受注でき、達成報告はギルド受付で行います。</div>
        `;
    },

    openQuestDetail: async (questId) => {
        if (!App.showQuestModal) return;
        const quest = App.getQuestDefinition ? App.getQuestDefinition(questId) : null;
        const state = App.getQuestState ? App.getQuestState(questId).state : 'available';
        const travelAreaKey = state === 'accepted' ? App.resolveQuestTravelAreaKey?.(quest) : null;
        await App.showQuestModal(questId, {
            statusLabel: state === 'completed'
                ? 'クリア'
                : (App.isQuestObjectiveComplete?.(questId) ? '報告できます' : '受注中'),
            bodyText: state === 'completed'
                ? (quest?.completeText || quest?.objective || '')
                : (quest?.progressText || quest?.objective || ''),
            travelAreaKey,
            travelLabel: quest?.area || quest?.name || ''
        });
    },

    travelToGuildReception: () => {
        if (typeof App.requestGuildReceptionTravel !== 'function') {
            Menu.msg('ギルド受付への移動機能を利用できません。');
            return false;
        }
        return App.requestGuildReceptionTravel();
    },

    travelToGuildQuest: (questId) => {
        if (typeof Guild === 'undefined') return false;
        const def = Guild.getDefinitions?.()[Guild.resolveQuestId?.(questId) || questId];
        const areaKey = App.resolveQuestTravelAreaKey?.(def);
        if (!areaKey) {
            Menu.msg('この依頼には移動先が設定されていません。');
            return false;
        }
        return App.requestSkyPrismTravelTo?.(areaKey, def?.area || def?.name || areaKey) || false;
    }
};

if (typeof window !== 'undefined') window.MenuStatus = MenuStatus;
