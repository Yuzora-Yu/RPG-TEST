/* ==========================================================================
   鍛冶屋システム (新装備システム・改・真 完全対応版)
   ========================================================================== */

const MenuBlacksmith = {
    mode: null,   
    step: 'target', 
    filter: { category: 'ALL', option: 'ALL' },
    sortMode: 'NEWEST',
    
    state: {
        target: null, material: null, materials: [], targetOptIdx: -1, requiredCount: 0
    },

    // menu: 魔道通信から開いた導線 / facility: 炎の里の施設画面から開いた導線
    entryContext: 'menu',
    returnContext: 'main',

    playStartSeAndWait: async () => {
        if (typeof AudioManager === 'undefined') return false;
        if (typeof AudioManager.playSeAndWait === 'function') {
            return AudioManager.playSeAndWait('ui_blacksmith_start');
        }
        AudioManager.playSe?.('ui_blacksmith_start');
        return false;
    },

    getMaster: () => window.PRISMA_BLACKSMITH_MASTER || null,

    findEquipmentMaster: (equip) => {
        const masters = Array.isArray(window.EQUIP_MASTER) ? window.EQUIP_MASTER : [];
        const explicitId = Number(equip?.eid ?? equip?.masterEid ?? equip?.equipMasterId);
        if (Number.isFinite(explicitId)) {
            const explicit = masters.find(entry => Number(entry?.eid) === explicitId);
            if (explicit) return explicit;
        }
        const cleanName = String(equip?.name || '').replace(/^真・/, '').replace(/\+\d+$/, '');
        return masters.find(entry => String(entry?.name || '') === cleanName && String(entry?.type || '') === String(equip?.type || ''))
            || masters.find(entry => Number(entry?.rank) === Number(equip?.rank)
                && String(entry?.type || '') === String(equip?.type || '')
                && String(entry?.baseName || '') === String(equip?.baseName || ''))
            || null;
    },

    getMaterialUpgradeRecipe: (equip) => {
        const master = MenuBlacksmith.getMaster();
        const rank = Math.max(1, Math.floor(Number(equip?.rank) || 1));
        return master?.materialUpgradeRecipes?.find(record => record.part === equip?.type && rank >= record.minRank && rank <= record.maxRank) || null;
    },

    buildMaterialUpgradePreview: (equip) => {
        const currentPlus = Math.max(0, Math.floor(Number(equip?.plus) || 0));
        if (![1, 2].includes(currentPlus)) return { ok:false, reason:'plus' };
        const targetPlus = currentPlus + 1;
        const recipe = MenuBlacksmith.getMaterialUpgradeRecipe(equip);
        const requirements = recipe?.requirementsByTargetPlus?.[String(targetPlus)];
        if (!recipe || !Array.isArray(requirements) || requirements.length === 0) return { ok:false, reason:'recipe' };
        const plusMultipliers = MenuBlacksmith.getMaster()?.plusMultipliers || { 1:1.1, 2:1.3, 3:1.5 };
        const currentMult = Math.max(0.01, Number(plusMultipliers[currentPlus]) || 1);
        const targetMult = Math.max(currentMult, Number(plusMultipliers[targetPlus]) || currentMult);
        const ratio = targetMult / currentMult;
        const scalableKeys = new Set(MenuBlacksmith.getMaster()?.scalableStatKeys || ['atk','def','mag','mdef','spd','hp','mp']);
        const equipmentMaster = MenuBlacksmith.findEquipmentMaster(equip);
        const nextData = JSON.parse(JSON.stringify(equip?.data || {}));
        if (equipmentMaster?.data && typeof equipmentMaster.data === 'object') {
            scalableKeys.forEach(key => {
                if (typeof equipmentMaster.data[key] === 'number') nextData[key] = Math.floor(equipmentMaster.data[key] * targetMult);
            });
        } else {
            Object.keys(nextData).forEach(key => {
                if (scalableKeys.has(key) && typeof nextData[key] === 'number') nextData[key] = Math.floor(nextData[key] * ratio);
            });
        }
        const baseName = String(equip?.name || '装備').replace(/\+\d+$/, '');
        const formalRank = Math.max(1, Math.floor(Number(equipmentMaster?.rank ?? equip?.rank) || 1));
        return {
            ok:true, currentPlus, targetPlus, recipe, requirements, nextData,
            oldName:String(equip?.name || baseName), newName:`${baseName}+${targetPlus}`,
            nextVal:equipmentMaster
                ? Math.floor(formalRank * 150 * (1 + targetPlus * 0.5))
                : Math.floor((Number(equip?.val) || 0) * ratio)
        };
    },

    getRequirementStatus: requirements => (requirements || []).map(req => {
        const item = (DB.ITEMS || []).find(entry => Number(entry?.id) === Number(req.itemId));
        const owned = Math.max(0, Math.floor(Number(App.data?.items?.[req.itemId]) || 0));
        return { ...req, item, owned, enough:owned >= Number(req.count || 0) };
    }),

    getBaseStatSummary: data => {
        const labels = { atk:'攻', def:'防', mag:'魔', mdef:'魔防', spd:'速', hp:'HP', mp:'MP' };
        return Object.entries(labels).filter(([key]) => Number(data?.[key])).map(([key, label]) => `${label}${Number(data[key]) >= 0 ? '+' : ''}${data[key]}`).join(' ') || '変化なし';
    },

    init: (options = {}) => {
        const sub = document.getElementById('sub-screen-blacksmith');
        if(!sub) return;
        MenuBlacksmith.entryContext = options.source === 'facility' ? 'facility' : 'menu';
        MenuBlacksmith.returnContext = options.returnTo === 'crafting' ? 'crafting' : 'main';
        MenuBlacksmith.setFacilityTopExitVisible(MenuBlacksmith.entryContext !== 'facility');
        sub.style.display = 'flex';

        if (typeof Menu !== 'undefined') {
            Menu.installKeyboardNavigation?.();
            Menu.installBackGuard?.();
            Menu.ensureBackGuard?.();
        }
        
        if(!document.getElementById('smith-ctrls')) {
            const ctrlDiv = document.createElement('div');
            ctrlDiv.id = 'smith-ctrls';
            ctrlDiv.style.cssText = 'flex-shrink:0; background:#1a1a1a; border-bottom:1px solid #444; display:none;';
            const header = sub.querySelector('.header-bar');
            sub.insertBefore(ctrlDiv, header.nextSibling);
        }

        MenuBlacksmith.setupContainers(sub);
        MenuBlacksmith.resetState();
        if (options.mode) MenuBlacksmith.selectMode(options.mode);
        else MenuBlacksmith.changeScreen('main');
        Menu.refreshKeyboardNavigation?.(sub);
    },

    openFromField: () => {
        if (typeof App !== 'undefined' && typeof App.requireFeatureUnlocked === 'function' && !App.requireFeatureUnlocked('smith')) return;
        App.changeScene('blacksmith');
    },

    initFacility: () => {
        MenuBlacksmith.entryContext = 'facility';
        MenuBlacksmith.returnContext = 'main';
        MenuBlacksmith.setFacilityTopExitVisible(true);
        const commands = `
            <button class="menu-btn" style="background:#4a2d0c;border:1px solid #ffb347;height:40px;color:#fff;" onclick="MenuBlacksmith.openFacilityMode('materialUpgrade')">素材鍛造 ＋1～＋3</button>
            <button class="menu-btn" style="background:#2b160f;border:1px solid #ff8a55;height:40px;color:#fff;" onclick="MenuBlacksmith.openFacilityMode('synthesis')">装備合成 ＋3～＋4</button>
            <button class="menu-btn" style="background:#111a32;border:1px solid #87a8ff;height:40px;color:#fff;" onclick="MenuBlacksmith.openFacilityMode('refine')">オプション精錬</button>
            <button class="menu-btn" style="background:#102619;border:1px solid #79d99a;height:40px;color:#fff;" onclick="MenuBlacksmith.openFacilityMode('enhance')">オプション強化</button>`;
        Facilities.setupBaseLayout('blacksmith-scene', '炎の里イグニシア 鍛冶屋', 'facility_bg_blacksmith', commands, "App.changeScene('field')");
        MenuBlacksmith.renderFacilityHome();
    },

    renderFacilityHome: () => {
        const body = document.getElementById('blacksmith-scene-msg-content');
        if (!body) return;
        const smith = App.data.blacksmith || { level: 1, exp: 0 };
        const nextExp = Math.max(1, smith.level * 100);
        const progress = Math.max(0, Math.min(100, (Number(smith.exp || 0) / nextExp) * 100));
        body.innerHTML = `
            <div style="color:#ffc27a;margin-bottom:10px;">「聞こえるか。炉が、また飯を食い始めた。」</div>
            <div style="border:1px solid #6c4936;background:rgba(43,22,15,0.72);padding:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                    <div><span style="color:#aaa;font-size:11px;">鍛冶レベル</span><br><b style="color:#ffd86a;font-size:22px;">Lv.${smith.level}</b></div>
                    <button class="btn" style="height:34px;background:#24150f;border:1px solid #d28a54;color:#fff;" onclick="MenuBlacksmith.showLevelInfo()">上昇効果</button>
                </div>
                <div style="display:flex;justify-content:space-between;color:#bbb;font-size:10px;margin-top:10px;"><span>熟練度</span><span>${smith.exp} / ${nextExp} EXP</span></div>
                <div style="height:7px;background:#080808;border:1px solid #4b3428;margin-top:4px;overflow:hidden;"><div style="height:100%;width:${progress}%;background:linear-gradient(90deg,#b94d24,#ffd86a);"></div></div>
                <div style="color:#aaa;font-size:11px;margin-top:9px;">下のコマンドから鍛冶内容を選択してください。</div>
            </div>`;
    },

    openFacilityMode: (mode) => {
        MenuBlacksmith.init({ source: 'facility', mode });
    },

    setFacilityTopExitVisible: (visible) => {
        const button = document.getElementById('blacksmith-scene-top-exit-btn');
        if (button) button.style.display = visible ? '' : 'none';
    },

    exitWorkspace: () => {
        const sub = document.getElementById('sub-screen-blacksmith');
        if (MenuBlacksmith.entryContext === 'facility') {
            if (sub) sub.style.display = 'none';
            MenuBlacksmith.setFacilityTopExitVisible(true);
            MenuBlacksmith.resetState();
            MenuBlacksmith.renderFacilityHome();
            return;
        }
        if (MenuBlacksmith.returnContext === 'crafting' && typeof Menu !== 'undefined' && typeof Menu.openSubScreen === 'function') {
            if (sub) sub.style.display = 'none';
            MenuBlacksmith.resetState();
            Menu.openSubScreen('crafting');
            return;
        }
        if (typeof Menu !== 'undefined' && typeof Menu.closeSubScreen === 'function') {
            Menu.closeSubScreen('blacksmith');
        } else if (sub) {
            sub.style.display = 'none';
        }
    },

    exitToField: () => {
        MenuBlacksmith.setFacilityTopExitVisible(true);
        MenuBlacksmith.resetState();
        if (typeof App !== 'undefined' && typeof App.changeScene === 'function') {
            App.changeScene('field');
        } else {
            const sub = document.getElementById('sub-screen-blacksmith');
            if (sub) sub.style.display = 'none';
        }
    },

    setupContainers: (parent) => {
        const screens = ['main', 'select', 'option'];
        screens.forEach(id => {
            let el = document.getElementById(`smith-screen-${id}`);
            if(!el) {
                el = document.createElement('div');
                el.id = `smith-screen-${id}`;
                el.className = 'flex-col-container';
                el.style.cssText = 'display:none; flex:1; overflow:hidden; height:100%;';
                parent.appendChild(el);
            }
        });

	const selectScreen = document.getElementById('smith-screen-select');
	selectScreen.innerHTML = `
		<div id="smith-list" class="scroll-area" style="flex:1; min-height:0;"></div>

		<div id="smith-footer" style="padding:10px; background:rgba(0,0,0,0.4); border-top:1px solid #444; flex-shrink:0; min-height:40px;"></div>

		<div class="sub-screen-bottom-panel">
			<button class="btn sub-screen-back-btn" onclick="MenuBlacksmith.handleBottomBack()">もどる</button>
		</div>
	`;

	const optScreen = document.getElementById('smith-screen-option');
	optScreen.innerHTML = `
		<div id="smith-option-header" style="padding:10px; text-align:center; color:#ffd700; font-size:12px; background:rgba(255,215,0,0.1); border-bottom:1px solid #444; flex-shrink:0;"></div>

		<div id="smith-option-list" class="scroll-area" style="flex:1; min-height:0;"></div>

		<div class="sub-screen-bottom-panel">
			<button class="btn sub-screen-back-btn" onclick="MenuBlacksmith.handleBottomBack()">もどる</button>
		</div>
	`;
    },

    resetState: () => {
        MenuBlacksmith.mode = null;
        MenuBlacksmith.step = 'target';
        MenuBlacksmith.state = { target: null, material: null, materials: [], targetOptIdx: -1, requiredCount: 0 };
        MenuBlacksmith.filter = { category: 'ALL', option: 'ALL' };
        MenuBlacksmith.sortMode = 'NEWEST';
    },

    changeScreen: (screenId) => {
        if (screenId === 'main' && MenuBlacksmith.entryContext === 'facility') {
            MenuBlacksmith.exitWorkspace();
            return;
        }
        ['main', 'select', 'option'].forEach(id => {
            const el = document.getElementById(`smith-screen-${id}`);
            if(el) el.style.display = (id === screenId) ? 'flex' : 'none';
        });
        const ctrl = document.getElementById('smith-ctrls');
        if(ctrl) ctrl.style.display = (screenId === 'select') ? 'block' : 'none';
        if (screenId === 'main') {
            MenuBlacksmith.renderMain();
            MenuBlacksmith.updateTitle("⚒️ 鍛冶屋");
        }
        const sub = document.getElementById('sub-screen-blacksmith');
        if (sub) Menu.refreshKeyboardNavigation?.(sub);
    },
	
	handleBottomBack: () => {
		const mainScreen = document.getElementById('smith-screen-main');
		const selectScreen = document.getElementById('smith-screen-select');
		const optionScreen = document.getElementById('smith-screen-option');

		if (mainScreen && mainScreen.style.display === 'flex') {
			MenuBlacksmith.exitWorkspace();
			return;
		}

		if (optionScreen && optionScreen.style.display === 'flex') {
			MenuBlacksmith.goBackStep();
			return;
		}

		if (selectScreen && selectScreen.style.display === 'flex') {
			if (MenuBlacksmith.step === 'material') {
				MenuBlacksmith.goBackStep();
			} else {
				MenuBlacksmith.changeScreen('main');
			}
		}
	},

    goBackStep: () => {
        if (MenuBlacksmith.step === 'material') {
            MenuBlacksmith.step = 'target';
            MenuBlacksmith.changeScreen('select');
            MenuBlacksmith.renderTargetList();
        } else {
            MenuBlacksmith.changeScreen('main');
        }
    },

    updateTitle: (text) => {
        const titleEl = document.querySelector('#sub-screen-blacksmith .header-bar span');
        if(titleEl) titleEl.innerText = text;
    },

    renderMain: () => {
        const smith = App.data.blacksmith || { level:1, exp:0 };
        const nextExp = smith.level * 100;
        const progress = Math.min(100, (smith.exp / nextExp) * 100);
        const container = document.getElementById('smith-screen-main');

        container.innerHTML = `
            <div style="flex:1; overflow-y:auto; display:flex; flex-direction:column; justify-content:center; padding:20px 5px;">
                <div style="margin-bottom:20px; text-align:center;">
                    <div style="font-size:10px; color:#888; letter-spacing:2px; margin-bottom:2px;">MASTER BLACKSMITH</div>
                    <div style="display:flex; align-items:center; justify-content:center; gap:12px;">
                        <span style="font-size:26px; font-weight:bold; color:#ffd700; text-shadow:0 0 10px rgba(255,215,0,0.4);">Lv.${smith.level}</span>
                        <button class="btn" style="font-size:10px; padding:4px 12px; background:#333; border:1px solid #555; border-radius:15px; height:24px;" onclick="MenuBlacksmith.showLevelInfo()">上昇効果を確認</button>
                    </div>
                </div>
                <div style="margin: 0 auto 30px auto; width: 100%; max-width:280px; text-align:center;">
                    <div style="font-size:10px; color:#aaa; margin-bottom:5px; display:flex; justify-content:space-between; padding:0 2px;">
                        <span>熟練度 (NEXT: ${nextExp})</span><span>${smith.exp} EXP</span>
                    </div>
                    <div style="width:100%; height:6px; background:#000; border-radius:3px; overflow:hidden; border:1px solid #333;">
                        <div style="width:${progress}%; height:100%; background:linear-gradient(90deg, #ffd700, #ffaa00); box-shadow:0 0 5px #ffd700;"></div>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px; width: 100%; max-width:320px; margin:0 auto;">
                    ${MenuBlacksmith.renderMenuBtn('materialUpgrade', '素材鍛造 ＋1～＋3', '部位・Rank帯に対応する正式素材で装備本体を段階強化します', 'linear-gradient(135deg, #543510, #211000)', '#ffb347')}
                    ${MenuBlacksmith.renderMenuBtn('synthesis', '上位合成 ＋3→＋4', '＋3装備同士を合成し、新たな能力を継承します', 'linear-gradient(135deg, #411, #200)', '#f44')}
                    ${MenuBlacksmith.renderMenuBtn('refine', 'オプション精錬', 'オプションのレアリティを上昇させます (GEM消費)', 'linear-gradient(135deg, #114, #002)', '#44f')}
                    ${MenuBlacksmith.renderMenuBtn('enhance', 'オプション強化', 'オプションの数値を装備素材で上昇させます', 'linear-gradient(135deg, #131, #020)', '#4f4')}
                </div>
            </div>
			<div class="sub-screen-bottom-panel">
				<button class="btn sub-screen-back-btn" onclick="MenuBlacksmith.exitWorkspace()">もどる</button>
			</div>
        `;
    },

    renderMenuBtn: (mode, title, desc, bg, border) => `
        <button class="menu-btn" style="display:flex; flex-direction:column; align-items:flex-start; text-align:left; padding:10px 15px; height:auto; background:${bg}; border-left:4px solid ${border}; border-right:none; border-top:none; border-bottom:none;" onclick="MenuBlacksmith.selectMode('${mode}')">
            <div style="font-size:14px; font-weight:bold; color:#fff; margin-bottom:2px;">${title}</div>
            <div style="font-size:9px; color:rgba(255,255,255,0.5); line-height:1.2;">${desc}</div>
        </button>
    `,

    showLevelInfo: () => {
        const smith = App.data.blacksmith || { level:1, exp:0 };
        const lv = smith.level;
        const getP = (l) => {
            const r = l >= 10 ? 'EX' : (l >= 5 ? 'UR' : 'SSR');
            const s = Math.min(95, 50 + (l * 5));
            return { rarity: r, success: s, refine: Math.floor(s/2) };
        };
        const cur = getP(lv); const nxt = getP(lv + 1);
        const row = (label, curVal, nxtVal, color) => `<div style="background:rgba(0,0,0,0.3); border:1px solid #444; border-radius:4px; padding:5px 10px; display:flex; align-items:center; height:36px; margin-bottom:4px;"><div style="width:45px; font-size:10px; color:${color}; font-weight:bold; line-height:1;">${label}</div><div style="flex:1; display:flex; align-items:center; justify-content:center; gap:10px;"><span style="color:#fff; font-size:18px; font-weight:bold; width:40px; text-align:right;">${curVal}</span><span style="color:#ffd700; font-size:10px; opacity:0.8;">▶</span><span style="color:#fff; font-size:18px; font-weight:bold; width:40px; text-align:left;">${nxtVal}</span></div></div>`;

        let h = `<div style="text-align:left; color:#ddd; line-height:1.0; max-width:300px; margin:5px auto -5px auto; display:flex; flex-direction:column;">`;
        h += `<div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #ffd700; padding-bottom:3px; margin-bottom:8px;"><span style="color:#ffd700; font-weight:bold; font-size:14px;">鍛冶レベル特典</span><span style="color:#aaa; font-size:10px;">Lv.${lv} <span style="color:#ffd700; font-size:8px;">▶</span> Lv.${lv+1}</span></div>`;
        h += `<div style="display:flex; flex-direction:column;">${row('合成上限', cur.rarity, nxt.rarity, '#f88')}${row('精錬確率', cur.refine+'%', nxt.refine+'%', '#88f')}${row('強化確率', cur.success+'%', nxt.success+'%', '#8f8')}</div>`;
        h += `<div style="margin-top:8px; padding:6px; background:rgba(255,255,255,0.03); border:1px solid #333; border-radius:4px;"><div style="color:#ffd700; font-size:10px; font-weight:bold; margin-bottom:2px;">鍛冶ガイド</div><div style="color:#bbb; font-size:9px; line-height:1.2;">・合成：＋４進化時のレアリティ再抽選上限<br>・精錬：GEM消費でOP昇格(失敗時も消失なし)<br>・強化：素材消費でOP値上昇(Lvで成功率UP)</div></div>`;
        h += `</div>`;
        Menu.msg(h);
    },

    selectMode: (mode) => {
        MenuBlacksmith.mode = mode;
        MenuBlacksmith.step = 'target';
        MenuBlacksmith.changeScreen('select');
        MenuBlacksmith.renderFilterArea();
        MenuBlacksmith.renderTargetList();
    },

    renderFilterArea: () => {
        const ctrl = document.getElementById('smith-ctrls');
        const rules = DB.OPT_RULES;
        ctrl.innerHTML = `
            <div style="padding:6px; display:flex; gap:5px; overflow-x:auto; background:#111; border-bottom:1px solid #333;">
                ${['ALL', '武器', '盾', '頭', '体', '足'].map(c => {
                    const isActive = MenuBlacksmith.filter.category === c;
                    return `<button class="btn" style="padding:4px 10px; font-size:10px; flex-shrink:0; border-radius:12px; background:${isActive ? 'linear-gradient(#088, #044)' : '#333'}; border:${isActive ? '1px solid #0ff' : '1px solid #444'}; color:${isActive ? '#fff' : '#aaa'};" onclick="MenuBlacksmith.updateFilter('category', '${c}')">${c === 'ALL' ? '全て' : c}</button>`
                }).join('')}
            </div>
            <div style="padding:6px; background:#1a1a1a; display:flex; align-items:center; gap:8px;">
                <div style="flex:1; display:flex; align-items:center; gap:4px;"><span style="font-size:9px; color:#888;">効果:</span><select style="background:#222; color:#fff; font-size:10px; border:1px solid #444; flex:1; height:24px; border-radius:4px; touch-action:auto; user-select:auto; -webkit-user-select:auto; pointer-events:auto;" ${typeof Menu !== 'undefined' && Menu.selectTouchAttrs ? Menu.selectTouchAttrs() : ''} onchange="MenuBlacksmith.updateFilter('option', this.value)"><option value="ALL">全ての効果</option>${rules.map(opt => `<option value="${opt.key}${opt.elm ? '_' + opt.elm : ''}" ${MenuBlacksmith.filter.option === (opt.key + (opt.elm ? '_' + opt.elm : '')) ? 'selected' : ''}>${opt.name}</option>`).join('')}</select></div>
                <div style="flex:1; display:flex; align-items:center; gap:4px;"><span style="font-size:9px; color:#888;">並替:</span><select style="background:#222; color:#fff; font-size:10px; border:1px solid #444; flex:1; height:24px; border-radius:4px; touch-action:auto; user-select:auto; -webkit-user-select:auto; pointer-events:auto;" ${typeof Menu !== 'undefined' && Menu.selectTouchAttrs ? Menu.selectTouchAttrs() : ''} onchange="MenuBlacksmith.updateFilter('sortMode', this.value)"><option value="NEWEST" ${MenuBlacksmith.sortMode === 'NEWEST' ? 'selected' : ''}>取得順</option><option value="RANK" ${MenuBlacksmith.sortMode === 'RANK' ? 'selected' : ''}>Rank順</option></select></div>
            </div>
        `;
        if (typeof Menu !== 'undefined' && Menu.makeSelectTouchSafe) Menu.makeSelectTouchSafe(ctrl);
    },

    updateFilter: (key, val) => {
        if (key === 'sortMode') MenuBlacksmith.sortMode = val;
        else MenuBlacksmith.filter[key] = val;
        MenuBlacksmith.renderFilterArea();
        if (MenuBlacksmith.step === 'target') MenuBlacksmith.renderTargetList();
        else {
            if (MenuBlacksmith.mode === 'synthesis') MenuBlacksmith.renderMaterialList_Synthesis(false);
            if (MenuBlacksmith.mode === 'enhance') MenuBlacksmith.renderMaterialList_Enhance(false);
        }
    },

    applySortAndFilter: (list) => {
        const rOrder = { EX:6, UR:5, SSR:4, SR:3, R:2, N:1 };
        let filtered = list.filter(c => {
            const item = c.item || c; 
            if (MenuBlacksmith.filter.category !== 'ALL' && item.type !== MenuBlacksmith.filter.category) return false;
            if (MenuBlacksmith.filter.option !== 'ALL') {
                if (!item.opts) return false;
                const optKey = MenuBlacksmith.filter.option;
                if (!item.opts.some(o => (o.key + (o.elm ? '_' + o.elm : '')) === optKey)) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            const itemA = a.item || a;
            const itemB = b.item || b;
            if (MenuBlacksmith.sortMode === 'RANK') {
                return typeof Menu?.compareEquipmentByRank === 'function'
                    ? Menu.compareEquipmentByRank(itemA, itemB)
                    : ((itemB.rank || 0) - (itemA.rank || 0)) || ((rOrder[itemB.rarity]||0) - (rOrder[itemA.rarity]||0));
            }
            return (b._originalIdx ?? 0) - (a._originalIdx ?? 0);
        });
        return filtered;
    },

    renderTargetList: () => {
        const list = document.getElementById('smith-list');
        const footer = document.getElementById('smith-footer');
        MenuBlacksmith.step = 'target';
        let candidates = [];
        App.data.inventory.forEach((i, idx) => candidates.push({ item: i, owner: null, _originalIdx: idx }));
        App.data.characters.forEach(c => {
            CONST.PARTS.forEach(part => {
                const eq = c.equips ? c.equips[part] : null;
                if (eq) candidates.push({ item: eq, owner: c.name, _originalIdx: -1 });
            });
        });
        candidates = candidates.filter(c => {
            if (MenuBlacksmith.mode === 'materialUpgrade' && ![1, 2].includes(Math.floor(Number(c.item.plus) || 0))) return false;
            if (MenuBlacksmith.mode === 'synthesis' && c.item.plus !== 3) return false;
            if ((MenuBlacksmith.mode === 'refine' || MenuBlacksmith.mode === 'enhance') && (!c.item.opts || c.item.opts.length === 0)) return false;
            return true;
        });
        const sorted = MenuBlacksmith.applySortAndFilter(candidates);
        list.innerHTML = '';
        sorted.forEach(c => {
            const item = c.item;
            const div = document.createElement('div'); 
            div.className = 'list-item'; 
            div.style.cssText = 'flex-direction:column; align-items:flex-start; background:rgba(255,255,255,0.02); margin-bottom:4px; border:1px solid #333;';
            
            div.innerHTML = `
                <div style="border-bottom:1px solid #333;width:100%;padding-bottom:4px;margin-bottom:4px;">
                    ${Menu.getEquipmentNameLineHTML(item, { suffixHTML: `${item.locked ? ' 🔒' : ''}${c.owner ? ` <span style="color:#f88;font-size:10px;">[${c.owner}]</span>` : ''}` })}
                </div>
                ${Menu.getEquipDetailHTML(item, false)}
            `;
            div.onclick = () => {
                MenuBlacksmith.state.target = item;
                if (MenuBlacksmith.mode === 'materialUpgrade') MenuBlacksmith.renderMaterialUpgradeConfirm();
                else if (MenuBlacksmith.mode === 'synthesis') MenuBlacksmith.renderMaterialList_Synthesis(true);
                else if (MenuBlacksmith.mode === 'refine') MenuBlacksmith.renderOptionList_Refine();
                else MenuBlacksmith.renderOptionList_Enhance();
            };
            list.appendChild(div);
        });
        footer.innerHTML = `<div style="text-align:center; color:#ffd700; font-size:11px; font-weight:bold;">${MenuBlacksmith.mode === 'materialUpgrade' ? '＋1または＋2の対象装備を選んでください' : (MenuBlacksmith.mode === 'synthesis' ? 'ベースにする＋３装備を選んでください' : '対象の装備を選んでください')}</div>`;
    },

    renderMaterialUpgradeConfirm: () => {
        const target = MenuBlacksmith.state.target;
        const preview = MenuBlacksmith.buildMaterialUpgradePreview(target);
        if (!preview.ok) return Menu.msg('この装備に対応する素材鍛造レシピがありません。', () => MenuBlacksmith.renderTargetList());
        const requirements = MenuBlacksmith.getRequirementStatus(preview.requirements);
        const enough = requirements.every(entry => entry.enough);
        MenuBlacksmith.changeScreen('option');
        document.getElementById('smith-option-header').innerHTML = `素材鍛造: ${preview.oldName} → ${preview.newName}`;
        document.getElementById('smith-option-list').innerHTML = `
            <div style="padding:12px;display:flex;flex-direction:column;gap:10px;">
                <div style="border:1px solid #555;background:#171717;padding:10px;">
                    <div style="color:#aaa;font-size:10px;">強化前</div>${Menu.getEquipmentNameLineHTML(target)}
                    <div style="font-size:10px;color:#ccc;margin-top:4px;">${MenuBlacksmith.getBaseStatSummary(target.data)}</div>
                    <div style="text-align:center;color:#ffd700;margin:7px 0;">▼</div>
                    <div style="color:#aaa;font-size:10px;">強化後</div>${Menu.getEquipmentNameLineHTML({ ...target, name:preview.newName, plus:preview.targetPlus })}
                    <div style="font-size:10px;color:#fff;margin-top:4px;">${MenuBlacksmith.getBaseStatSummary(preview.nextData)}</div>
                </div>
                <div style="border:1px solid #5a4320;background:#21180c;padding:10px;">
                    <div style="color:#ffd86a;font-weight:bold;margin-bottom:5px;">必要素材（${preview.recipe.grade}帯）</div>
                    ${requirements.map(entry => `<div style="display:flex;justify-content:space-between;color:${entry.enough ? '#ddd' : '#f66'};font-size:11px;"><span>${entry.item?.name || `Item ${entry.itemId}`}</span><span>${entry.owned} / ${entry.count}</span></div>`).join('')}
                </div>
                <button class="btn" style="width:100%;background:${enough ? 'linear-gradient(#875318,#4c2c0d)' : '#333'};border:1px solid ${enough ? '#ffb347' : '#555'};" ${enough ? '' : 'disabled'} onclick="MenuBlacksmith.confirmMaterialUpgrade()">内容を確認して鍛造する</button>
            </div>`;
    },

    confirmMaterialUpgrade: () => {
        const target = MenuBlacksmith.state.target;
        const preview = MenuBlacksmith.buildMaterialUpgradePreview(target);
        if (!preview.ok) return Menu.msg('対象装備の状態が変わったため中止しました。');
        const requirements = MenuBlacksmith.getRequirementStatus(preview.requirements);
        if (!requirements.every(entry => entry.enough)) return Menu.msg('必要素材が不足しています。');
        Menu.confirm(`【素材鍛造】\n${preview.oldName} → ${preview.newName}\n装備UID・オプション・特性・ロック状態を維持して実行します。`, async () => {
            await MenuBlacksmith.playStartSeAndWait();
            const result = App.runAtomicSaveMutation(() => {
                const livePreview = MenuBlacksmith.buildMaterialUpgradePreview(target);
                const liveRequirements = MenuBlacksmith.getRequirementStatus(livePreview.requirements);
                if (!livePreview.ok || !liveRequirements.every(entry => entry.enough)) return { ok:false, reason:'changed' };
                liveRequirements.forEach(entry => {
                    const next = Math.max(0, Number(App.data.items?.[entry.itemId] || 0) - Number(entry.count || 0));
                    if (next > 0) App.data.items[entry.itemId] = next;
                    else delete App.data.items[entry.itemId];
                });
                target.plus = livePreview.targetPlus;
                target.name = livePreview.newName;
                target.data = livePreview.nextData;
                target.val = livePreview.nextVal;
                App.refreshAllSynergies?.();
                App.incrementLifetimeStat?.('totalBlacksmithActions', 1, { save:false });
                App.incrementLifetimeStat?.('blacksmithMaterialUpgradeCount', 1, { save:false });
                const levelUps = MenuBlacksmith.gainExp(30 * livePreview.targetPlus);
                return { name:target.name, levelUps };
            });
            if (!result.ok) {
                MenuBlacksmith.resetState();
                return Menu.msg(result.saveFailed ? '保存に失敗したため、装備と素材の変更をすべて取り消しました。' : '装備または素材の状態が変わったため中止しました。', () => MenuBlacksmith.init());
            }
            const levelText = MenuBlacksmith.formatLevelUpText(result.result?.levelUps);
            Menu.msg(`${preview.newName} が完成しました。${levelText}`, () => MenuBlacksmith.init());
        });
    },

    renderMaterialList_Synthesis: (resetFilter = true) => {
        const list = document.getElementById('smith-list');
        const footer = document.getElementById('smith-footer');
        MenuBlacksmith.step = 'material';
        if(resetFilter) { MenuBlacksmith.filter = { category: 'ALL', option: 'ALL' }; MenuBlacksmith.renderFilterArea(); }
        let materials = App.data.inventory.map((i, idx) => ({ ...i, _originalIdx: idx })).filter(i => !i.locked && i.id !== MenuBlacksmith.state.target.id && i.opts && i.opts.length > 0);
        const sorted = MenuBlacksmith.applySortAndFilter(materials);
        list.innerHTML = '';
        if (sorted.length === 0) list.innerHTML = '<div style="padding:40px; text-align:center; color:#888;">素材にできる装備がありません</div>';
        else {
            sorted.forEach(item => {
                const div = document.createElement('div'); div.className = 'list-item'; div.style.cssText = 'flex-direction:column; align-items:flex-start;';
                
                div.innerHTML = `
                    <div style="border-bottom:1px solid #333;width:100%;margin-bottom:4px;">${Menu.getEquipmentNameLineHTML(item)}</div>
                    ${Menu.getEquipDetailHTML(item, false)}
                `;
                div.onclick = () => { MenuBlacksmith.state.material = item; MenuBlacksmith.renderOptionList_Synthesis(); };
                list.appendChild(div);
            });
        }
        footer.innerHTML = '<div style="color:#f88; font-size:11px; text-align:center; font-weight:bold;">継承させたい能力を持つ「素材装備」を選択</div>';
    },

    renderOptionList_Synthesis: () => {
        MenuBlacksmith.changeScreen('option');
        const list = document.getElementById('smith-option-list');
        const header = document.getElementById('smith-option-header');
        header.innerText = "継承させるオプションを選択";
        list.innerHTML = '';

        const rarities = ['N', 'R', 'SR', 'SSR', 'UR', 'EX'];
        const smithLevel = App.data.blacksmith?.level || 1;

        // ★修正：現在のレベルで「最高」どこまで届くか
        let maxPossibleRarityIdx = 3; // Lv1-4: SSR(3)まで
        if (smithLevel >= 10) maxPossibleRarityIdx = 5; // Lv10-: EX(5)まで
        else if (smithLevel >= 5) maxPossibleRarityIdx = 4; // Lv5-9: UR(4)まで

        MenuBlacksmith.state.material.opts.forEach((opt, idx) => {
            const rule = DB.OPT_RULES.find(r => r.key === opt.key && (r.elm === opt.elm || !r.elm));
            let isLevelInsufficient = false;
            let minRequiredRarity = 'N';

            if (rule && rule.allowed) {
                // オプションが要求する最低ランクのインデックス
                const minAllowedIdx = Math.min(...rule.allowed.map(r => rarities.indexOf(r)));
                minRequiredRarity = rarities[minAllowedIdx];
                
                // ★修正：最高到達ランクが、要求最低ランクに届いていない場合のみロック
                if (maxPossibleRarityIdx < minAllowedIdx) isLevelInsufficient = true;
            }

            const div = document.createElement('div'); div.className = 'list-item';
            div.style.cssText = 'flex-direction:column; align-items:flex-start;';
            if (isLevelInsufficient) { div.style.opacity = '0.5'; div.style.background = '#222'; }

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <span style="color:${Menu.getRarityColor(opt.rarity)}; font-weight:bold;">${opt.label} +${opt.val} (${opt.rarity})</span>
                </div>
                ${isLevelInsufficient ? `<div style="color:#f44; font-size:10px; font-weight:bold; margin-top:2px;">⚠️ 熟練度不足 (最低:${minRequiredRarity}が必要)</div>` : ''}
            `;

            div.onclick = () => {
                if (isLevelInsufficient) {
                    Menu.msg(`鍛冶屋の熟練度が足りません。最低でも ${minRequiredRarity} ランクが確定するレベルが必要です。`);
                    return;
                }
                MenuBlacksmith.state.targetOptIdx = idx; 
                MenuBlacksmith.confirmSynthesis(); 
            };
            list.appendChild(div);
        });
    },

/* blacksmith.js */

    confirmSynthesis: () => {
        const target = MenuBlacksmith.state.target;
        const material = MenuBlacksmith.state.material;
        const selectedIndex = MenuBlacksmith.state.targetOptIdx;
        const lv = App.data.blacksmith.level;
        const rateObj = MenuBlacksmith.getRateObj(lv);
        const rarities = ['N', 'R', 'SR', 'SSR', 'UR', 'EX'];

        Menu.confirm(`【装備合成】＋４へ進化させ、新たな能力を継承します。`, async () => {
            await MenuBlacksmith.playStartSeAndWait();
            const result = App.runAtomicSaveMutation(() => {
                if (!target || Number(target.plus) !== 3 || !material) return { ok:false, reason:'changed' };
                const materialIndex = (App.data.inventory || []).findIndex(item => String(item?.id) === String(material.id));
                const liveMaterial = materialIndex >= 0 ? App.data.inventory[materialIndex] : null;
                const materialOpt = liveMaterial?.opts?.[selectedIndex];
                if (!materialOpt) return { ok:false, reason:'changed' };

                let random = Math.random() * 100;
                let current = 0;
                let newRarity = 'R';
                for (const [rarity, chance] of Object.entries(rateObj)) {
                    if (random < current + chance) { newRarity = rarity; break; }
                    current += chance;
                }

                const rule = DB.OPT_RULES.find(entry => entry.key === materialOpt.key && (entry.elm === materialOpt.elm || !entry.elm));
                const inheritedOption = JSON.parse(JSON.stringify(materialOpt));
                if (rule && rule.allowed) {
                    const allowedIndices = rule.allowed.map(rarity => rarities.indexOf(rarity));
                    const minIndex = Math.min(...allowedIndices);
                    const maxIndex = Math.max(...allowedIndices);
                    let resultIndex = rarities.indexOf(newRarity);
                    resultIndex = Math.min(4, maxIndex, Math.max(minIndex, resultIndex));
                    inheritedOption.rarity = rarities[resultIndex];
                    const min = rule.min[inheritedOption.rarity] || 0;
                    const max = rule.max[inheritedOption.rarity] || 0;
                    inheritedOption.val = Math.floor(Math.random() * (max - min + 1)) + min;
                }

                target.plus = 4;
                const oldRarityIndex = rarities.indexOf(target.rarity);
                const newRarityIndex = rarities.indexOf(newRarity);
                if (newRarityIndex > oldRarityIndex) target.rarity = newRarity;
                target.name = String(target.name || '装備').replace(/\+\d+$/, '') + '+4';
                if (!Array.isArray(target.opts)) target.opts = [];
                target.opts.push(inheritedOption);
                target.val = Math.floor((Number(target.val) || 0) * 1.5);
                App.data.inventory.splice(materialIndex, 1);

                App.refreshAllSynergies?.();
                App.incrementLifetimeStat?.('totalBlacksmithActions', 1, { save:false });
                App.incrementLifetimeStat?.('blacksmithSynthesisCount', 1, { save:false });
                const levelUps = MenuBlacksmith.gainExp(50);
                return { name:target.name, inheritedOption, levelUps };
            });

            if (!result.ok) {
                MenuBlacksmith.resetState();
                return Menu.msg(result.saveFailed
                    ? '保存に失敗したため、合成前の装備と素材へ戻しました。'
                    : '対象装備または素材の状態が変わったため中止しました。', () => MenuBlacksmith.init());
            }
            const outcome = result.result || {};
            const levelText = MenuBlacksmith.formatLevelUpText(outcome.levelUps);
            Menu.msg(`合成成功！
${outcome.name} が完成しました。
継承: ${outcome.inheritedOption?.label || '能力'} (${outcome.inheritedOption?.rarity || '-'})${levelText}`, () => MenuBlacksmith.init());
        });
    },

	
    renderOptionList_Refine: () => {
        MenuBlacksmith.changeScreen('option');
        const list = document.getElementById('smith-option-list');
        const header = document.getElementById('smith-option-header');
        
		const target = MenuBlacksmith.state.target;
		let targetTraits = '';
		if (target.traits && target.traits.length > 0) {
			targetTraits = `<div style="font-size:9px; color:#0ff; margin-top:2px;">` + 
				target.traits.map(t => {
					const m = (typeof PassiveSkill !== 'undefined') ? PassiveSkill.MASTER[t.id] : null;
					return m ? `★${m.name} Lv${t.level}` : '';
				}).join(' ') + `</div>`;
		}
		header.innerHTML = `
			<div style="margin-bottom:4px;">${MenuBlacksmith.mode === 'refine' ? '精錬' : '強化'}対象:</div>
            ${Menu.getEquipmentNameLineHTML(target)}
			${targetTraits}
			<div style="font-size:10px; color:#aaa; margin-top:4px;">${MenuBlacksmith.mode === 'refine' ? '昇格させるオプションを選択' : '強化したい能力を選択'}</div>
		`;
		
        list.innerHTML = '';
        MenuBlacksmith.state.target.opts.forEach((opt, idx) => {
            if (opt.rarity === 'EX') return;
            const rule = DB.OPT_RULES.find(r => r.key === opt.key && (r.elm === opt.elm || !r.elm));
            const isMax = rule ? (opt.val >= rule.max[opt.rarity]) : true;
            const nextR = MenuBlacksmith.getNextRarity(opt.rarity);
            const gemCost = MenuBlacksmith.getRefineGemCost(opt.rarity);
            const successRate = Math.max(5, Math.min(95, MenuBlacksmith.getRefineBaseRate(opt.rarity) + (App.data.blacksmith.level * 2)));
            const div = document.createElement('div'); div.className = 'list-item'; div.style.opacity = isMax ? '1' : '0.5';
            div.innerHTML = `<div style="flex:1;"><div style="font-weight:bold; color:${Menu.getRarityColor(opt.rarity)};">${opt.label} (${opt.rarity}: ${opt.val}${opt.unit==='%'?'%':''})</div><div style="font-size:10px; color:#aaa;">${isMax ? `昇格先: <span style="color:#fff;">${nextR}</span> (成功率:${successRate}%)` : `<span style="color:#f88;">数値を最大まで上げると精錬可能</span>`}</div></div><div style="font-size:11px; color:#0ff;">${gemCost} GEM</div>`;
            div.onclick = () => { if(!isMax) return Menu.msg("オプション値が上限に達していません。"); MenuBlacksmith.state.targetOptIdx = idx; MenuBlacksmith.confirmRefine(gemCost, successRate, nextR, rule); };
            list.appendChild(div);
        });
    },

    confirmRefine: (gem, rate, nextR, rule) => {
        if ((App.data.gems || 0) < gem) return Menu.msg('GEMが足りません');
        Menu.confirm(`【精錬】費用: ${gem} GEM / 成功率: ${rate}%
成功するとランクアップし数値が${nextR}の下限値へリセットされます。`, async () => {
            await MenuBlacksmith.playStartSeAndWait();
            const target = MenuBlacksmith.state.target;
            const optionIndex = MenuBlacksmith.state.targetOptIdx;
            const result = App.runAtomicSaveMutation(() => {
                if ((App.data.gems || 0) < gem) return { ok:false, reason:'gems' };
                const option = target?.opts?.[optionIndex];
                if (!option || option.rarity === 'EX') return { ok:false, reason:'changed' };
                App.data.gems -= gem;
                App.incrementLifetimeStat?.('totalBlacksmithActions', 1, { save:false });
                App.incrementLifetimeStat?.('blacksmithRefineAttempts', 1, { save:false });
                const success = Math.random() * 100 < rate;
                if (success) {
                    option.rarity = nextR;
                    option.val = rule ? rule.min[nextR] : option.val;
                    App.incrementLifetimeStat?.('blacksmithRefineSuccesses', 1, { save:false });
                }
                const levelUps = MenuBlacksmith.gainExp(success ? 60 : 15);
                return { success, levelUps };
            });
            if (!result.ok) {
                MenuBlacksmith.resetState();
                return Menu.msg(result.saveFailed
                    ? '保存に失敗したため、GEMと装備の変更を取り消しました。'
                    : (result.reason === 'gems' ? 'GEMが足りません。' : '対象装備の状態が変わったため中止しました。'), () => MenuBlacksmith.init());
            }
            const levelText = MenuBlacksmith.formatLevelUpText(result.result?.levelUps);
            Menu.msg(`${result.result?.success ? '精錬成功！' : '精錬失敗...'}${levelText}`, () => MenuBlacksmith.renderOptionList_Refine());
        });
    },

    renderOptionList_Enhance: () => {
        MenuBlacksmith.changeScreen('option');
        const list = document.getElementById('smith-option-list');
        const header = document.getElementById('smith-option-header');
        header.innerText = "強化したい能力を選択";
        list.innerHTML = '';
        MenuBlacksmith.state.target.opts.forEach((opt, idx) => {
            const rule = DB.OPT_RULES.find(r => r.key === opt.key && (r.elm === opt.elm || !r.elm));
            const maxVal = rule ? rule.max[opt.rarity] : 999;
            const isFull = opt.val >= maxVal;
            const cost = MenuBlacksmith.getEnhanceCost(opt.rarity);
            const div = document.createElement('div'); div.className = 'list-item'; div.style.opacity = isFull ? '0.5' : '1';
            div.innerHTML = `<div style="flex:1;"><div style="font-weight:bold; color:${Menu.getRarityColor(opt.rarity)};">${opt.label} +${opt.val}${opt.unit==='%'?'%':''}</div><div style="font-size:10px; color:#aaa;">${isFull ? '最大値です' : `素材: 同部位の未ロック装備 ${cost}個`}</div></div>`;
            div.onclick = () => { if(isFull) return Menu.msg("最大値です。精錬してください。"); MenuBlacksmith.state.targetOptIdx = idx; MenuBlacksmith.state.requiredCount = cost; MenuBlacksmith.renderMaterialList_Enhance(true); };
            list.appendChild(div);
        });
    },

    renderMaterialList_Enhance: (resetFilter = true) => {
        const list = document.getElementById('smith-list');
        const footer = document.getElementById('smith-footer');
        MenuBlacksmith.changeScreen('select');
        MenuBlacksmith.step = 'material';
        
        // ★追加：素材選択リストをリセット
        MenuBlacksmith.state.materials = []; 

        if(resetFilter) { 
            MenuBlacksmith.filter = { category: 'ALL', option: 'ALL' }; 
            MenuBlacksmith.renderFilterArea(); 
        }
        const req = MenuBlacksmith.state.requiredCount;
        let materials = App.data.inventory.map((i, idx) => ({ ...i, _originalIdx: idx })).filter(i => !i.locked && i.type === MenuBlacksmith.state.target.type && i.id !== MenuBlacksmith.state.target.id);
        const sorted = MenuBlacksmith.applySortAndFilter(materials);
        const updateFooter = () => {
            const cur = MenuBlacksmith.state.materials.length;
            footer.innerHTML = `<div style="text-align:center; font-size:12px; font-weight:bold; margin-bottom:5px;">選択素材: <span style="color:${cur===req?'#0ff':'#fff'}">${cur} / ${req}</span></div>${cur === req ? `<button class="btn" style="width:100%; background:linear-gradient(#088, #044); border:1px solid #0ff;" onclick="MenuBlacksmith.confirmEnhance()">強化実行</button>` : ''}`;
        };
        updateFooter();
        list.innerHTML = '';
        if (sorted.length < req) list.innerHTML = `<div style="padding:40px; text-align:center; color:#f44;">素材が不足しています</div>`; 
        else {
            sorted.forEach(item => {
                const div = document.createElement('div'); div.className = 'list-item'; div.style.cssText = 'flex-direction:column; align-items:flex-start;';
                const refresh = () => { div.style.background = MenuBlacksmith.state.materials.includes(item.id) ? 'rgba(0,255,255,0.1)' : 'transparent'; div.style.border = MenuBlacksmith.state.materials.includes(item.id) ? '1px solid #0ff' : '1px solid #333'; };
                refresh();

                div.innerHTML = `
                    ${Menu.getEquipmentNameLineHTML(item)}
                    ${Menu.getEquipDetailHTML(item, false)}
                `;
                div.onclick = () => { const idx = MenuBlacksmith.state.materials.indexOf(item.id); if(idx > -1) MenuBlacksmith.state.materials.splice(idx,1); else if(MenuBlacksmith.state.materials.length < req) MenuBlacksmith.state.materials.push(item.id); refresh(); updateFooter(); };
                list.appendChild(div);
            });
        }
    },

    confirmEnhance: () => {
        const target = MenuBlacksmith.state.target;
        const optionIndex = MenuBlacksmith.state.targetOptIdx;
        const selectedMaterialIds = [...MenuBlacksmith.state.materials];
        const option = target?.opts?.[optionIndex];
        const rule = DB.OPT_RULES.find(entry => entry.key === option?.key && (entry.elm === option?.elm || !entry.elm));
        const successRate = Math.min(95, 50 + (App.data.blacksmith.level * 5));
        const increment = rule ? Math.max(1, Math.floor((rule.max[option.rarity] - rule.min[option.rarity]) * 0.1)) : 1;

        Menu.confirm(`【能力強化】成功率: ${successRate}% / 成功すると数値が ${increment} 上昇します。`, async () => {
            await MenuBlacksmith.playStartSeAndWait();
            const result = App.runAtomicSaveMutation(() => {
                const liveOption = target?.opts?.[optionIndex];
                if (!liveOption || selectedMaterialIds.length !== Number(MenuBlacksmith.state.requiredCount || 0)) return { ok:false, reason:'changed' };
                const materialIndices = selectedMaterialIds.map(id => (App.data.inventory || []).findIndex(item => String(item?.id) === String(id)));
                if (materialIndices.some(index => index < 0) || new Set(materialIndices).size !== materialIndices.length) return { ok:false, reason:'changed' };
                materialIndices.sort((a, b) => b - a).forEach(index => App.data.inventory.splice(index, 1));
                App.incrementLifetimeStat?.('totalBlacksmithActions', 1, { save:false });
                App.incrementLifetimeStat?.('blacksmithEnhanceAttempts', 1, { save:false });
                const success = Math.random() * 100 < successRate;
                if (success) {
                    App.incrementLifetimeStat?.('blacksmithEnhanceSuccesses', 1, { save:false });
                    liveOption.val += increment;
                    if (rule && liveOption.val > rule.max[liveOption.rarity]) liveOption.val = rule.max[liveOption.rarity];
                }
                const levelUps = MenuBlacksmith.gainExp(success ? 25 : 5);
                return { success, levelUps };
            });
            MenuBlacksmith.state.materials = [];
            if (!result.ok) {
                MenuBlacksmith.resetState();
                return Menu.msg(result.saveFailed
                    ? '保存に失敗したため、装備と素材の変更をすべて取り消しました。'
                    : '対象装備または素材の状態が変わったため中止しました。', () => MenuBlacksmith.init());
            }
            const levelText = MenuBlacksmith.formatLevelUpText(result.result?.levelUps);
            Menu.msg(`${result.result?.success ? '強化成功！' : '強化失敗...'}${levelText}`, () => MenuBlacksmith.renderOptionList_Enhance());
        });
    },

    getNextRarity: (r) => { const o = ['N','R','SR','SSR','UR','EX']; return o[Math.min(o.indexOf(r)+1, 5)]; },
    getRefineGemCost: (r) => ({ N:100, R:200, SR:400, SSR:800, UR:1500 }[r] || 3000),
    getRefineBaseRate: (r) => ({ N:80, R:60, SR:40, SSR:20, UR:10 }[r] || 5),
    getEnhanceCost: (r) => ({ N:1, R:1, SR:2, SSR:2, UR:3, EX:4 }[r] || 1),
    getRateObj: (v) => v>=10 ? {SSR:30,UR:50,EX:20} : (v>=5 ? {SR:20,SSR:50,UR:30} : {R:30,SR:50,SSR:20}),
    gainExp: (value) => {
        if (!App.data.blacksmith) App.data.blacksmith = { level:1, exp:0 };
        const state = App.data.blacksmith;
        const levelUps = [];
        state.exp += Math.max(0, Math.floor(Number(value) || 0));
        while (state.exp >= state.level * 100) {
            state.exp -= state.level * 100;
            state.level++;
            levelUps.push(state.level);
        }
        return levelUps;
    },

    formatLevelUpText: levels => Array.isArray(levels) && levels.length
        ? `\n鍛冶レベルが ${levels[levels.length - 1]} に上がりました！`
        : ''
};