/* MenuItems extracted from menus.js. Keep runtime behavior aligned with Menu core. */
/* ==========================================================================
   3. 道具 (MenuItems) - 無限使用バグ修正版
   ========================================================================== */
const MenuItems = {
    selectedItem: null,
    activeTab: 'tools',

    getUseSeKey: (item) => {
        if (!item) return null;
        if (item.type === '乗り物' || item.type === '移動' || item.id === 110 || item.name === 'スカイプリズム') return 'ui_item_move';
        if ((Number(item.id) >= 100 && Number(item.id) <= 107) || String(item.type || '').includes('育成') || item.type === 'スキル書' || item.type === '特性書') return 'ui_item_growth';
        if (item.fieldGroup || item.effectKind === 'camp' || String(item.type || '').includes('回復') || String(item.type || '').includes('蘇生')) return 'ui_item_heal';
        return null;
    },

    playUseSe: (item) => {
        const key = MenuItems.getUseSeKey(item);
        if (key && typeof AudioManager !== 'undefined') AudioManager.playSe?.(key);
    },

    init: () => {
        document.getElementById('sub-screen-items').style.display = 'flex';
        MenuItems.activeTab = 'tools';
        MenuItems.changeScreen('list');
    },

    changeScreen: (mode) => {
        document.getElementById('item-screen-list').style.display = (mode==='list'?'flex':'none');
        document.getElementById('item-screen-target').style.display = (mode==='target'?'flex':'none');
        if(mode==='list') MenuItems.renderList();
    },

    setTab: (tab) => {
        const nextTab = ['tools', 'growth', 'materials', 'valuables'].includes(tab) ? tab : 'tools';
        if (MenuItems.activeTab === nextTab) return;
        MenuItems.activeTab = nextTab;
        MenuItems.renderList({ resetScroll: true });
    },

    isValuable: (def) => {
        return !!def && def.type === '貴重品';
    },

    isMaterial: (def) => {
        return !!def && def.type === '素材';
    },

    isGrowth: (def) => {
        if (!def) return false;
        const type = String(def.type || '');
        return type.includes('育成') || type === 'スキル書' || type === '特性書';
    },

    getOwnedItems: () => {
        const items = [];
        Object.keys(App.data.items || {}).forEach(id => {
            const def = DB.ITEMS.find(i => i.id == id);
            const count = Number(App.data.items[id] || 0);
            if(def && count > 0) items.push({ def, count });
        });
        return items;
    },

    getToolSortRank: (def) => {
        return window.PRISMA_ITEM_CATALOG?.getToolTypeSortRank
            ? window.PRISMA_ITEM_CATALOG.getToolTypeSortRank(def)
            : 99;
    },

    sortItemsForCurrentTab: (items) => {
        return items.slice().sort((a, b) => {
            if (MenuItems.activeTab === 'tools') {
                if (window.PRISMA_ITEM_CATALOG?.compareToolsByTypeAndId) {
                    return window.PRISMA_ITEM_CATALOG.compareToolsByTypeAndId(a.def, b.def);
                }
                const typeDiff = MenuItems.getToolSortRank(a.def) - MenuItems.getToolSortRank(b.def);
                if (typeDiff !== 0) return typeDiff;
            }
            const itemRankDiff = Number(a.def.rank || 9999) - Number(b.def.rank || 9999);
            if (itemRankDiff !== 0) return itemRankDiff;
            return String(a.def.name || '').localeCompare(String(b.def.name || ''), 'ja');
        });
    },

    renderTabs: () => {
        const tabHost = document.getElementById('item-tabs');
        if (!tabHost) return;
        tabHost.innerHTML = '';
        tabHost.className = 'item-tab-bar';
        tabHost.setAttribute('role', 'tablist');
        tabHost.setAttribute('aria-label', '道具カテゴリ');

        const tabs = [
            ['tools', '道具'],
            ['growth', '育成'],
            ['materials', '素材'],
            ['valuables', '貴重品']
        ];

        const list = document.getElementById('list-items');
        if (list) {
            list.setAttribute('role', 'tabpanel');
            list.setAttribute('aria-labelledby', `item-tab-${MenuItems.activeTab}`);
        }

        tabs.forEach(([key, label], index) => {
            const active = MenuItems.activeTab === key;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = `item-tab-${key}`;
            btn.className = `item-tab-btn${active ? ' active' : ''}`;
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.setAttribute('aria-controls', 'list-items');
            btn.tabIndex = active ? 0 : -1;
            btn.textContent = label;
            btn.onclick = () => MenuItems.setTab(key);
            btn.onkeydown = (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                let nextIndex = index;
                if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
                if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                MenuItems.setTab(tabs[nextIndex][0]);
                requestAnimationFrame(() => document.getElementById(`item-tab-${tabs[nextIndex][0]}`)?.focus());
            };
            tabHost.appendChild(btn);
        });
    },

    renderList: (options = {}) => {
        const list = document.getElementById('list-items');
        if (!list) return;
        list.innerHTML = '';
        if (options.resetScroll) list.scrollTop = 0;

        const allItems = MenuItems.getOwnedItems();
        const growth = allItems.filter(it => MenuItems.isGrowth(it.def));
        const materials = allItems.filter(it => MenuItems.isMaterial(it.def));
        const valuables = allItems.filter(it => MenuItems.isValuable(it.def));
        const tools = allItems.filter(it =>
            !MenuItems.isGrowth(it.def) &&
            !MenuItems.isMaterial(it.def) &&
            !MenuItems.isValuable(it.def)
        );

        MenuItems.renderTabs();

        const itemsByTab = { tools, growth, materials, valuables };
        const currentItems = MenuItems.sortItemsForCurrentTab(itemsByTab[MenuItems.activeTab] || tools);
        if (currentItems.length === 0) {
            const emptyLabels = {
                tools: '道具を持っていません',
                growth: '育成アイテムを持っていません',
                materials: '素材を持っていません',
                valuables: '貴重品を持っていません'
            };
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:24px 20px; text-align:center; color:#555;';
            empty.innerText = emptyLabels[MenuItems.activeTab] || emptyLabels.tools;
            list.appendChild(empty);
            return;
        }

        currentItems.forEach(it => {
            const div = document.createElement('div');
            div.className = 'list-item menu-pick-card';

            const fallbackPath = Menu.getItemIconPath ? Menu.getItemIconPath(it.def) : 'assets/ui/menu-icons/item-item.svg';
            div.innerHTML = `
                <div class="menu-pick-icon" data-icon-id="item-${it.def.id}"><img src="${fallbackPath}" alt=""></div>
                <div class="menu-pick-main">
                    <div class="menu-pick-title">${Menu.escapeHtml(it.def.name)}</div>
                    <div class="menu-pick-meta">${Menu.escapeHtml(MenuItems.isMaterial(it.def) ? `素材 / Rank ${it.def.materialRank || '-'}` : `${it.def.type || ''}${it.def.rank ? ` / Rank ${it.def.rank}` : ''}`)}</div>
                    <div class="menu-pick-desc">${Menu.escapeHtml(it.def.desc || '')}</div>
                </div>
                <div class="menu-pick-count">x${it.count}</div>
            `;
            div.onclick = () => MenuItems.handleItemClick(it.def);
            list.appendChild(div);
        });
    },

    handleItemClick: (item) => {
        if (!item) return;

        if (MenuItems.activeTab === 'valuables' || MenuItems.isValuable(item)) {
            Menu.msg("貴重品は使用できません。");
            return;
        }
        if (MenuItems.activeTab === 'materials' || MenuItems.isMaterial(item)) {
            Menu.msg("素材は今後の生成・加工に使用します。");
            return;
        }

        if (Number(item.id) === Number(window.PRISMA_DIVINE_ANVIL_ITEM_ID || 599998)) {
            MenuItems.selectedItem = item;
            MenuItems.openDivineAnvilEquipmentSelection(item);
        }
        // スキル書は通常仲間の専用2枠、仲間モンスターの合計8枠を専用UIで管理する。
        else if (item.type === 'スキル書' || Number(item.skillId) >= 100) {
            MenuItems.selectedItem = item;
            MenuItems.openSkillBookCharacterSelection(item);
        }
        // 特性書は、所持キャラクターと交換可能枠を専用UIで選択する。
        else if (item.type === '特性書' || Number(item.traitId) > 0) {
            if (item.traitBookImplemented === false) {
                Menu.msg('この特性書はマスター登録済みですが、交換機能はまだ準備中です。');
                return;
            }
            MenuItems.selectedItem = item;
            MenuItems.openTraitBookCharacterSelection(item);
        } else if(item.type === '乗り物') {
            MenuItems.selectedItem = item;
            MenuItems.useVehicleItem(item);
        } else if(item.type === '移動' || item.id === 110 || item.name === 'スカイプリズム') {
            MenuItems.selectedItem = item;
            MenuItems.useSkyPrismItem(item);
        } else if (item.fieldGroup || item.effectKind === 'camp') {
            MenuItems.selectedItem = item;
            MenuItems.useGroupItem(item);
        } else if(item.type && (item.type.includes('回復') || item.type.includes('蘇生') || item.type.includes('育成'))) {
            MenuItems.selectedItem = item;
            MenuItems.renderTargetList();
        } else if (window.ItemRuntime && window.ItemRuntime.isBattleUsable(item)) {
            Menu.msg("この道具は戦闘中のみ使用できます。");
        } else {
            Menu.msg("使用できないアイテムです。");
        }
    },

    getAllOwnedEquipmentEntries: () => {
        const entries = [];
        const seen = new Set();
        const add = (equip, owner = '') => {
            if (!equip || typeof equip !== 'object') return;
            const key = equip.id != null ? `id:${equip.id}` : equip;
            if (seen.has(key)) return;
            seen.add(key);
            entries.push({ equip, owner });
        };
        (App.data?.inventory || []).forEach(equip => add(equip, ''));
        (App.data?.characters || []).forEach(character => {
            Object.values(character?.equips || {}).forEach(equip => add(equip, character?.name || '装備中'));
        });
        return entries;
    },

    getDivineAnvilTargetMaster: equip => {
        const masters = Array.isArray(window.EQUIP_MASTER) ? window.EQUIP_MASTER : [];
        const current = typeof MenuBlacksmith !== 'undefined'
            ? MenuBlacksmith.findEquipmentMaster(equip)
            : null;
        if (!current) return { ok:false, reason:'対応する正式装備マスターを特定できません。' };
        if (current.specialEquip === true || current.noRandom === true || /^真・/.test(String(equip?.name || ''))) {
            return { ok:false, reason:'特殊装備・レプリカ・真装備は対象外です。' };
        }
        // 神鉄強化後もeid/masterEidは元装備の識別子として保持する。
        // そのため、2回目以降の強化段階は装備インスタンス側のRankを正本とする。
        const currentRank = Math.max(1, Number(current.rank) || 1, Number(equip?.rank) || 1);
        const desired = currentRank + Math.max(1, Number(window.PRISMA_BLACKSMITH_MASTER?.divineAnvilTargetRankDelta) || 10);
        const candidates = masters.filter(entry =>
            entry && entry.noRandom !== true && entry.specialEquip !== true
            && String(entry.type || '') === String(current.type || equip?.type || '')
            && String(entry.baseName || '') === String(current.baseName || equip?.baseName || '')
            && Number(entry.rank || 0) > currentRank
        ).sort((left, right) => {
            const leftDistance = Math.abs(Number(left.rank || 0) - desired);
            const rightDistance = Math.abs(Number(right.rank || 0) - desired);
            return leftDistance - rightDistance || Number(left.rank || 0) - Number(right.rank || 0) || Number(left.eid || 0) - Number(right.eid || 0);
        });
        if (!candidates.length) return { ok:false, reason:'同じ部位・武器種に上位の通常装備がなく、最高段階です。' };
        const references = masters.filter(entry =>
            entry && entry.noRandom !== true && entry.specialEquip !== true
            && String(entry.type || '') === String(current.type || equip?.type || '')
            && String(entry.baseName || '') === String(current.baseName || equip?.baseName || '')
        ).sort((left, right) => {
            const leftDistance = Math.abs(Number(left.rank || 0) - currentRank);
            const rightDistance = Math.abs(Number(right.rank || 0) - currentRank);
            return leftDistance - rightDistance || Number(right.rank || 0) - Number(left.rank || 0) || Number(left.eid || 0) - Number(right.eid || 0);
        });
        return { ok:true, current, currentRank, currentReference:references[0] || current, target:candidates[0], desiredRank:desired };
    },

    getDivineAnvilReferenceScale: (currentReference, targetReference, currentRank, targetRank, scalableKeys) => {
        const sumPositiveScalableStats = masterData => Object.entries(masterData || {}).reduce((total, [key, value]) => {
            if (!scalableKeys.has(key) || typeof value !== 'number' || value <= 0) return total;
            return total + value;
        }, 0);
        const currentTotal = sumPositiveScalableStats(currentReference?.data);
        const targetTotal = sumPositiveScalableStats(targetReference?.data);
        const rankScale = Math.max(1, Number(targetRank || 1) / Math.max(1, Number(currentRank || 1)));
        if (currentTotal > 0 && targetTotal > currentTotal) return targetTotal / currentTotal;
        return rankScale;
    },

    buildDivineAnvilNextData: (equip, transition) => {
        const scalable = new Set(window.PRISMA_BLACKSMITH_MASTER?.scalableStatKeys || ['atk','def','mag','mdef','spd','hp','mp']);
        const currentData = JSON.parse(JSON.stringify(equip?.data || {}));
        const currentReferenceData = transition.currentReference?.data || transition.current?.data || {};
        const targetReferenceData = transition.target?.data || {};
        const fallbackScale = MenuItems.getDivineAnvilReferenceScale(
            transition.currentReference || transition.current,
            transition.target,
            transition.currentRank,
            transition.target?.rank,
            scalable
        );
        Object.keys(currentData).forEach(key => {
            const currentValue = currentData[key];
            // 命中・会心・回避・属性補正・状態異常補正などは、その装備固有の性質として変化させない。
            // HP/MP/攻防速魔系でも、負の補正は装備の欠点として維持し、悪化させない。
            if (!scalable.has(key) || typeof currentValue !== 'number' || currentValue <= 0) return;
            const currentReferenceValue = Number(currentReferenceData?.[key]);
            const targetReferenceValue = Number(targetReferenceData?.[key]);
            const keyScale = Number.isFinite(currentReferenceValue) && currentReferenceValue > 0
                && Number.isFinite(targetReferenceValue) && targetReferenceValue > currentReferenceValue
                ? targetReferenceValue / currentReferenceValue
                : fallbackScale;
            const scale = Math.max(1, Number(keyScale) || 1);
            currentData[key] = Math.max(currentValue + 1, Math.round(currentValue * scale));
        });
        return currentData;
    },

    buildDivineAnvilPreview: equip => {
        const transition = MenuItems.getDivineAnvilTargetMaster(equip);
        if (!transition.ok) return transition;
        const plus = Math.max(0, Math.floor(Number(equip?.plus) || 0));
        const nextData = MenuItems.buildDivineAnvilNextData(equip, transition);
        return {
            ...transition,
            plus,
            nextData,
            newName:String(equip?.name || transition.current?.name || '装備'),
            nextVal:Math.floor(Number(transition.target.rank || 1) * 150 * (1 + plus * 0.5))
        };
    },

    openDivineAnvilEquipmentSelection: item => {
        if (Number(App.data?.items?.[item.id] || 0) <= 0) return Menu.msg('神鉄の鍛冶台を所持していません。');
        const eligible = MenuItems.getAllOwnedEquipmentEntries()
            .map(entry => ({ ...entry, preview:MenuItems.buildDivineAnvilPreview(entry.equip) }))
            .filter(entry => entry.preview.ok)
            .sort((left, right) => Menu.compareEquipmentByRank?.(left.equip, right.equip) || 0);
        if (!eligible.length) {
            return Menu.msg('変換可能な装備がありません。\n特殊装備・レプリカ・真装備・最高段階装備・対応先のない装備は対象外です。');
        }
        Menu.listChoice('神鉄の鍛冶台を使う装備を選んでください。', eligible.map(entry => ({
            label:`${entry.equip.name}　Rank ${Number(entry.equip.rank || 0)} → Rank ${Number(entry.preview.target.rank || 0)}${entry.owner ? `［${entry.owner}］` : ''}`,
            callback:() => MenuItems.confirmDivineAnvilUse(item, entry.equip)
        })));
    },

    confirmDivineAnvilUse: (item, equip) => {
        const preview = MenuItems.buildDivineAnvilPreview(equip);
        if (!preview.ok) return Menu.msg(preview.reason || 'この装備は変換できません。');
        const oldSummary = typeof MenuBlacksmith !== 'undefined' ? MenuBlacksmith.getBaseStatSummary(equip.data) : '';
        const newSummary = typeof MenuBlacksmith !== 'undefined' ? MenuBlacksmith.getBaseStatSummary(preview.nextData) : '';
        Menu.confirm(`【神鉄の鍛冶台】\n${equip.name}\nRank ${equip.rank} → Rank ${preview.target.rank}\n${oldSummary}\n　▼\n${newSummary}\n\n名称・固有特性・固有スキル・ランダムオプション・特性・＋値・ロック状態は変化しません。\n装備固有の基礎能力だけをRankに合わせて高めます。`, () => {
            const result = App.runAtomicSaveMutation(() => {
                if (Number(App.data?.items?.[item.id] || 0) <= 0) return { ok:false, reason:'item' };
                const live = MenuItems.buildDivineAnvilPreview(equip);
                if (!live.ok || Number(live.target.eid) !== Number(preview.target.eid)) return { ok:false, reason:'changed' };
                equip.rank = Number(live.target.rank);
                equip.data = live.nextData;
                equip.val = live.nextVal;
                App.data.items[item.id] -= 1;
                if (App.data.items[item.id] <= 0) delete App.data.items[item.id];
                App.refreshAllSynergies?.();
                App.incrementLifetimeStat?.('divineAnvilUses', 1, { save:false });
                return { name:equip.name, rank:equip.rank };
            });
            if (!result.ok) {
                MenuItems.selectedItem = null;
                return Menu.msg(result.saveFailed ? '保存に失敗したため、Rank強化とアイテム消費をすべて取り消しました。' : '装備またはアイテムの状態が変わったため中止しました。', () => MenuItems.changeScreen('list'));
            }
            MenuItems.playUseSe(item);
            Menu.msg(`${preview.newName}のRankが ${preview.target.rank} に上がりました。`, () => {
                MenuItems.selectedItem = null;
                MenuItems.changeScreen('list');
                Menu.renderPartyBar();
            });
        });
    },

    getSkillBookOwnedCharacters: () => {
        const characters = Array.isArray(App.data?.characters) ? App.data.characters.filter(Boolean) : [];
        return characters.slice().sort((left, right) => {
            const heroDiff = Number(!(left?.uid === 'p1' || left?.isHero || Number(left?.charId) === 301))
                - Number(!(right?.uid === 'p1' || right?.isHero || Number(right?.charId) === 301));
            if (heroDiff !== 0) return heroDiff;
            const monsterDiff = Number(App.isMonsterAlly?.(left)) - Number(App.isMonsterAlly?.(right));
            if (monsterDiff !== 0) return monsterDiff;
            return String(left?.name || '').localeCompare(String(right?.name || ''), 'ja');
        });
    },

    openSkillBookCharacterSelection: (item) => {
        const skill = App.getSkillBookSkill?.(item);
        if (!item || !skill) {
            Menu.msg('このスキル書は使用できません。');
            return;
        }
        if (Number(App.data?.items?.[item.id] || 0) <= 0) {
            Menu.msg('アイテムを持っていません。');
            return;
        }
        const choices = MenuItems.getSkillBookOwnedCharacters().map(character => {
            const isMonster = App.isMonsterAlly?.(character);
            const capacity = App.getSkillBookCapacity?.(character) || (isMonster ? 8 : 2);
            const tracked = App.getSkillBookReplacementIds?.(character) || [];
            const known = Array.isArray(character.skills) && character.skills.map(Number).includes(Number(skill.id));
            const typeLabel = isMonster ? '仲間モンスター' : '仲間';
            return {
                label: `${character.name || '名前なし'}［${typeLabel}／${Math.min(tracked.length, capacity)}/${capacity}枠］${known ? ' 習得済み' : ''}`,
                disabled: known,
                callback: () => {
                    if (tracked.length >= capacity) MenuItems.openSkillBookReplacementSelection(item, character);
                    else MenuItems.applySkillBook(item, character, null);
                }
            };
        });
        if (!choices.length) {
            Menu.msg('スキルを習得できる仲間がいません。');
            return;
        }
        Menu.listChoice(`${item.name}
習得する仲間を選んでください。`, choices);
    },

    openSkillBookReplacementSelection: (item, character) => {
        const skill = App.getSkillBookSkill?.(item);
        const replacementIds = App.getSkillBookReplacementIds?.(character) || [];
        if (!skill || !replacementIds.length) {
            MenuItems.applySkillBook(item, character, null);
            return;
        }
        const choices = replacementIds.map(id => {
            const current = DB.SKILLS.find(entry => Number(entry.id) === Number(id));
            return {
                label: `${current?.name || `スキル${id}`} を忘れる`,
                callback: () => MenuItems.applySkillBook(item, character, id)
            };
        });
        Menu.listChoice(`${character.name}のスキル枠は上限です。
「${skill.name}」と入れ替えるスキルを選んでください。`, choices);
    },

    applySkillBook: (item, character, replaceSkillId = null) => {
        const skill = App.getSkillBookSkill?.(item);
        if (!item || !character || !skill) {
            Menu.msg('スキル書の対象を確認できませんでした。');
            return;
        }
        const replacing = replaceSkillId != null ? DB.SKILLS.find(entry => Number(entry.id) === Number(replaceSkillId)) : null;
        const prompt = replacing
            ? `${character.name}の「${replacing.name || `スキル${replaceSkillId}`}」を忘れ、「${skill.name}」を覚えますか？
スキル書は1冊消費されます。`
            : `${character.name}に「${skill.name}」を覚えさせますか？
スキル書は1冊消費されます。`;
        Menu.confirm(prompt, () => {
            if (Number(App.data?.items?.[item.id] || 0) <= 0) {
                Menu.msg('アイテムを持っていません。');
                return;
            }
            const result = App.learnSkillFromBook?.(character, Number(skill.id), replaceSkillId, { save: false });
            if (!result?.ok) {
                if (result?.reason === 'needsReplacement') MenuItems.openSkillBookReplacementSelection(item, character);
                else Menu.msg(result?.message || 'スキルを習得できませんでした。');
                return;
            }
            App.data.items[item.id] -= 1;
            if (App.data.items[item.id] <= 0) delete App.data.items[item.id];
            App.save();
            MenuItems.playUseSe(item);
            Menu.msg(`${character.name}は「${skill.name}」を覚えた！`, () => {
                MenuItems.selectedItem = null;
                MenuItems.changeScreen('list');
                Menu.renderPartyBar();
            });
        });
    },

    getTraitBookOwnedCharacters: () => {
        const characters = Array.isArray(App.data?.characters) ? App.data.characters.filter(Boolean) : [];
        const passive = typeof PassiveSkill !== 'undefined' ? PassiveSkill : null;
        return characters.slice().sort((left, right) => {
            const heroDiff = Number(!(passive?.isHeroCharacter?.(left))) - Number(!(passive?.isHeroCharacter?.(right)));
            if (heroDiff !== 0) return heroDiff;
            const monsterDiff = Number(!!passive?.isMonsterAllyCharacter?.(left)) - Number(!!passive?.isMonsterAllyCharacter?.(right));
            if (monsterDiff !== 0) return monsterDiff;
            return String(left.name || '').localeCompare(String(right.name || ''), 'ja');
        });
    },

    getTraitBookEligibleSlots: (character, item) => {
        if (typeof PassiveSkill === 'undefined' || typeof PassiveSkill.getTraitBookReplaceableSlots !== 'function') return [];
        const traitId = Number(item?.traitId || 0);
        return PassiveSkill.getTraitBookReplaceableSlots(character).map(index => {
            const current = character.traits[index];
            const check = PassiveSkill.canReplaceTraitWithBook(character, index, traitId);
            return { index, current, check };
        });
    },

    openTraitBookCharacterSelection: (item) => {
        if (!item || item.type !== '特性書' || !Number(item.traitId)) {
            Menu.msg('この特性書は使用できません。');
            return;
        }
        if (!Number(App.data?.items?.[item.id] || 0)) {
            Menu.msg('アイテムを持っていません。');
            return;
        }
        if (typeof PassiveSkill === 'undefined' || !PassiveSkill.MASTER?.[Number(item.traitId)]) {
            Menu.msg('特性データを読み込めませんでした。');
            return;
        }
        const targetTraitName = PassiveSkill.MASTER[Number(item.traitId)].name;
        const characters = MenuItems.getTraitBookOwnedCharacters();
        const choices = characters.map(character => {
            const slots = MenuItems.getTraitBookEligibleSlots(character, item);
            const addCheck = PassiveSkill.canAddTraitWithBook?.(character, Number(item.traitId)) || { ok:false };
            const canReplace = slots.some(entry => entry.check.ok);
            const canUse = addCheck.ok || canReplace;
            const duplicate = Array.isArray(character.traits) && character.traits.some(trait => Number(trait?.id) === Number(item.traitId));
            const typeLabel = PassiveSkill.getTraitBookCharacterTypeLabel?.(character) || '仲間';
            const traitCount = Array.isArray(character.traits) ? character.traits.length : 0;
            let suffix = addCheck.ok ? `追加 ${traitCount}/7` : `${slots.length}交換枠`;
            if (duplicate) suffix = '同じ特性を所持';
            else if (!canUse) suffix = '使用不可';
            return {
                label: `${character.name || '名前なし'}［${typeLabel}／${suffix}］`,
                disabled: !canUse,
                callback: () => addCheck.ok
                    ? MenuItems.applyTraitBook(item, character, null)
                    : MenuItems.openTraitBookSlotSelection(item, character)
            };
        });
        if (!choices.length) {
            Menu.msg('特性を交換できる仲間がいません。');
            return;
        }
        Menu.listChoice(`${item.name}
変更先: ${targetTraitName}
交換するキャラクターを選んでください。`, choices);
    },

    openTraitBookSlotSelection: (item, character) => {
        if (!item || !character) return;
        const targetMaster = PassiveSkill.MASTER?.[Number(item.traitId)];
        const slots = MenuItems.getTraitBookEligibleSlots(character, item);
        if (!slots.length) {
            Menu.msg('交換可能な特性枠がありません。');
            return;
        }
        const choices = slots.map(entry => {
            const currentMaster = PassiveSkill.MASTER?.[Number(entry.current?.id)];
            const level = Math.max(1, Number(entry.current?.level || entry.current?.lv || 1));
            return {
                label: `${entry.index + 1}枠目：${currentMaster?.name || `特性${entry.current?.id}`} Lv${level}`,
                disabled: !entry.check.ok,
                callback: () => MenuItems.applyTraitBook(item, character, entry.index)
            };
        });
        Menu.listChoice(`${character.name || '対象'}の交換枠を選択
変更先: ${targetMaster?.name || '特性'}
※元の特性Lvを引き継ぎます。`, choices);
    },

    applyTraitBook: (item, character, slotIndex = null) => {
        const targetMaster = PassiveSkill.MASTER?.[Number(item?.traitId)];
        const isAdding = slotIndex == null;
        const current = isAdding ? null : character?.traits?.[Number(slotIndex)];
        const currentMaster = PassiveSkill.MASTER?.[Number(current?.id)];
        const level = isAdding ? 1 : Math.max(1, Number(current?.level || current?.lv || 1));
        if (!item || !character || !targetMaster || (!isAdding && !current)) {
            Menu.msg('特性書の対象を確認できませんでした。');
            return;
        }
        const prompt = isAdding
            ? `${character.name}に「${targetMaster.name}」Lv1を追加しますか？
特性書は1冊消費されます。`
            : `${character.name}の「${currentMaster?.name || '特性'}」Lv${level}を「${targetMaster.name}」Lv${level}へ交換しますか？
特性書は1冊消費されます。`;
        Menu.confirm(prompt, () => {
            if (!Number(App.data?.items?.[item.id] || 0)) {
                Menu.msg('アイテムを持っていません。');
                return;
            }
            const result = isAdding
                ? PassiveSkill.addTraitWithBook(character, Number(item.traitId))
                : PassiveSkill.replaceTraitWithBook(character, slotIndex, Number(item.traitId));
            if (!result.success) {
                Menu.msg(result.message || '特性書を使用できませんでした。');
                return;
            }
            App.data.items[item.id] -= 1;
            if (App.data.items[item.id] <= 0) delete App.data.items[item.id];
            App.save();
            MenuItems.playUseSe(item);
            Menu.msg(result.message, () => {
                MenuItems.selectedItem = null;
                MenuItems.changeScreen('list');
                Menu.renderPartyBar();
            });
        });
    },

    useGroupItem: (item) => {
        if (!item || !App.data.items?.[item.id]) {
            Menu.msg("アイテムを持っていません。");
            return;
        }
        if (!window.ItemRuntime || !window.ItemRuntime.isFieldUsable(item)) {
            Menu.msg("この道具は戦闘中のみ使用できます。");
            return;
        }
        Menu.confirm(`仲間全員に ${item.name} を使いますか？`, () => {
            const party = (App.data.party || []).map(uid => uid ? App.getChar(uid) : null).filter(Boolean);
            const result = window.ItemRuntime.applyFieldGroupItem({ App, item, party });
            if (!result.success) {
                Menu.msg(result.message || "今は使用する必要がありません。");
                return;
            }
            App.data.items[item.id] -= 1;
            if (App.data.items[item.id] <= 0) delete App.data.items[item.id];
            App.save();
            MenuItems.playUseSe(item);
            Menu.msg(result.message, () => {
                MenuItems.renderList();
                Menu.renderPartyBar();
            });
        });
    },

    useVehicleItem: (item) => {
        if (!item) return;
        if (!App.data.items[item.id] || App.data.items[item.id] <= 0) {
            Menu.msg("アイテムを持っていません。");
            MenuItems.changeScreen('list');
            return;
        }

        // 乗り物タイプは使用しても消費しない。
        if (item.id === 109 || item.name === '光の翼') {
            const used = (typeof App.useLightWing === 'function') ? App.useLightWing() : false;
            if (used) {
                MenuItems.playUseSe(item);
                if (typeof Menu !== 'undefined' && typeof Menu.closeAll === 'function') Menu.closeAll();
                if (typeof Field !== 'undefined' && typeof Field.render === 'function') Field.render();
            }
            return;
        }

        Menu.msg("この乗り物はまだ使用できません。");
    },

    useSkyPrismItem: (item) => {
        if (!item) return;
        if (!App.data.items[item.id] || App.data.items[item.id] <= 0) {
            Menu.msg("アイテムを持っていません。");
            MenuItems.changeScreen('list');
            return;
        }
        if (typeof App.getAllFixedMapDiscoveryEntries !== 'function') {
            Menu.msg("移動先リストを作成できませんでした。");
            return;
        }

        const entries = App.getAllFixedMapDiscoveryEntries();
        if (!entries.length) {
            Menu.msg("移動できる場所がありません。");
            return;
        }

        const discoveredCount = entries.filter(e => e.discovered).length;
        const choices = entries.map((entry) => {
            if (!entry.discovered) {
                return { label: '？？？', disabled: true, background: '#333' };
            }

            const dungeonNote = entry.kind === 'dungeon' ? ' [ダンジョン]' : '';
            const label = `${entry.name}${dungeonNote}`;
            return {
                label,
                callback: () => {
                    Menu.confirm(`${entry.name}へ移動しますか？
スカイプリズムを1個消費します。`, () => {
                        const result = (typeof App.useSkyPrismTo === 'function')
                            ? App.useSkyPrismTo(entry.areaKey)
                            : { ok: false, message: 'スカイプリズムを使用できませんでした。' };

                        if (result.ok) {
                            MenuItems.playUseSe(item);
                            if (typeof Menu !== 'undefined' && typeof Menu.closeAll === 'function') Menu.closeAll();
                            if (typeof Field !== 'undefined' && typeof Field.render === 'function') Field.render();
                            if (typeof Field !== 'undefined' && typeof Field.refreshCurrentAction === 'function') Field.refreshCurrentAction({ silent:true });
                            if (typeof Field !== 'undefined' && typeof Field.startIdleStep === 'function') Field.startIdleStep();
                            if (typeof Menu !== 'undefined' && typeof Menu.renderPartyBar === 'function') Menu.renderPartyBar();
                            // 成功時は App.useSkyPrismTo() 側の App.log のみ表示する。
                            // 追加の「〇〇へ移動した！」モーダルは出さない。
                        } else {
                            Menu.msg(result.message || '移動できません。');
                        }
                    });
                }
            };
        });

        Menu.listChoice(`スカイプリズム：移動先を選択
発見済み ${discoveredCount}/${entries.length}`, choices, {
            pageSize: 6,
            fixedLayout: true,
            loopPages: true
        });
    },

    renderTargetList: () => {
        MenuItems.changeScreen('target');
        const list = document.getElementById('list-item-targets');
        list.innerHTML = '';
        
        // アイテム情報の表示
        const item = MenuItems.selectedItem;
        const count = App.data.items[item.id] || 0;
        const header = document.createElement('div');
        header.style.cssText = 'padding:10px; background:#333; color:#ffd700; font-size:12px; text-align:center; border-bottom:1px solid #444;';
        header.innerHTML = `使用中: <b>${item.name}</b> (残り: ${count}個)`;
        list.appendChild(header);

        App.data.party.forEach(uid => {
            if(!uid) return;
            const c = App.getChar(uid);
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = App.createCharHTML(c);
            div.onclick = () => MenuItems.useItem(c);
            list.appendChild(div);
        });
    },
    useItem: (target) => {
        const item = MenuItems.selectedItem;
        // ★修正: 所持チェックの厳格化 (undefined または 0 以下なら中止)
        if(!item || !App.data.items[item.id] || App.data.items[item.id] <= 0) {
            Menu.msg("アイテムを持っていません。");
            MenuItems.changeScreen('list');
            return;
        }

        Menu.confirm(`${target.name} に ${item.name} を使いますか？`, () => {
            let success = false;
            let msg = "";
            const s = App.calcStats(target);
            const master = DB.CHARACTERS.find(c => c.id === target.charId) || target;

            // --- A. 通常の回復アイテム処理 ---
            if(item.type === 'HP回復') {
                if(target.currentHp >= s.maxHp) { Menu.msg("HPは満タンです"); return; }
                target.currentHp = Math.min(s.maxHp, (target.currentHp || 0) + item.val);
                success = true; msg = `${target.name}は回復した！`;
            } else if(item.type === 'MP回復') {
                if(target.currentMp >= s.maxMp) { Menu.msg("MPは満タンです"); return; }
                target.currentMp = Math.min(s.maxMp, (target.currentMp || 0) + item.val);
                success = true; msg = `${target.name}は回復した！`;
            } else if(item.type === '蘇生') {
                if(target.currentHp > 0) { Menu.msg("生き返っています"); return; }
                target.currentHp = Math.floor(s.maxHp * 1);
                success = true; msg = `${target.name}は生き返った！`;
            }

            // --- B. LB育成アイテム ---
            else if (item.effectKind === 'limitBreak' || Number(item.id) === 123) {
                if (typeof App.addLimitBreak !== 'function' || typeof App.getLimitBreakTrialCap !== 'function') {
                    Menu.msg("LB成長処理を利用できません。");
                    return;
                }
                App.backfillLimitBreakLegacy?.(target);
                App.applyLimitBreakCap?.(target);
                const currentLb = Math.max(0, Math.floor(Number(target.limitBreak) || 0));
                const maxLb = Math.max(1, Math.floor(Number(App.limitBreakConfig?.max) || 99));
                const trialCap = Math.max(0, Math.floor(Number(App.getLimitBreakTrialCap(target)) || 0));
                if (currentLb >= maxLb) {
                    Menu.msg("LBはすでに最大です。");
                    return;
                }
                if (currentLb >= trialCap) {
                    const gateName = trialCap < 50 ? "中間試練" : "最終試練";
                    Menu.msg(`${gateName}に合格するまで、これ以上LBを増やせません。`);
                    return;
                }
                const amount = Math.max(1, Math.floor(Number(item.limitBreakAmount) || 1));
                const result = App.addLimitBreak(target, amount, 'item');
                if (!result.changed) {
                    Menu.msg("今はLBを増やせません。");
                    return;
                }
                success = true;
                msg = `${target.name}のLBが ${result.before} から ${result.after} に上がった！`;
            }

            // --- C. 育成アイテム(100-107)の処理 ---
            else if (item.id >= 100 && item.id <= 107) {
                success = true;
                if (!target.permanentStatBonuses || typeof target.permanentStatBonuses !== 'object' || Array.isArray(target.permanentStatBonuses)) target.permanentStatBonuses = {};
                const addPermanentStat = (key, amount) => {
                    target[key] = (Number(target[key]) || 0) + amount;
                    target.permanentStatBonuses[key] = (Number(target.permanentStatBonuses[key]) || 0) + amount;
                };
                switch(item.id) {
                    case 100: addPermanentStat('hp', 3); msg = `${target.name}の最大HPが上がった！`; break;
                    case 101: addPermanentStat('mp', 2); msg = `${target.name}の最大MPが上がった！`; break;
                    case 102: addPermanentStat('atk', 1); msg = `${target.name}の攻撃力が上がった！`; break;
                    case 103: addPermanentStat('mag', 1); msg = `${target.name}の魔力が上がった！`; break;
                    case 104: addPermanentStat('spd', 1); msg = `${target.name}の素早さが上がった！`; break;
                    case 105: addPermanentStat('def', 1); msg = `${target.name}の防御力が上がった！`; break;
                    case 106: target.sp = (target.sp || 0) + 1; msg = `${target.name}のSPが 1 増えた！`; break;
                    case 107:
                        if (App.isMonsterAlly?.(target)) {
                            Menu.msg("仲間モンスターには転生の実を使用できません。");
                            success = false;
                        } else if (target.level < 100) {
                            Menu.msg("レベルが不足しており使用できません");
                            success = false;
                        } else {
                            target.level = 1;
                            target.exp = 0;
                            target.reincarnationCount = (target.reincarnationCount || 0) + 1;
                            msg = `${target.name}は 転生しレベル1に戻った！\n(転生回数: ${target.reincarnationCount}回目)`;
                        }
                        break;
                }
            }

            if(success) {
                App.data.items[item.id]--;
                const currentCount = App.data.items[item.id];
                
                if(currentCount <= 0) delete App.data.items[item.id];
                
                App.save();
                MenuItems.playUseSe(item);
                Menu.msg(msg, () => {
                    // ★修正: 使い切った(個数がなくなった)場合はリスト画面にもどる
                    if(!App.data.items[item.id] || App.data.items[item.id] <= 0) {
                        MenuItems.changeScreen('list');
                    } else {
                        MenuItems.renderTargetList();
                    }
                    Menu.renderPartyBar();
                });
            }
        });
    }
};

if (typeof window !== 'undefined') window.MenuItems = MenuItems;
