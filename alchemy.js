/* alchemy.js - 水上都市リヴァリア錬金所：明示レシピデータと生成処理 */
(function () {
    'use strict';

    const R = (id, outputItemId, category, variants) => ({ id, outputItemId, outputCount: 1, category, variants });
    const V = (id, name, ingredients) => ({ id, name, ingredients: ingredients.map(([itemId, count]) => ({ itemId, count })) });

    // 各構成は2～5種類、各素材1～10個。出力ごとに複数の代替構成を明示している。
    const recipes = [
        R('star-sea-water', 1042, '回復', [
            V('water-spirit', '水精の調合', [[2052, 4], [2020, 3], [2027, 2]]),
            V('star-tear', '星涙の調合', [[2053, 2], [2012, 3], [2059, 1]])
        ]),
        R('divine-drop', 1043, '回復', [
            V('divine-water', '御神水の調合', [[2054, 5], [2022, 4], [2030, 3], [2061, 2]]),
            V('abyss-elixir', '深淵原液の調合', [[2055, 2], [2023, 2], [2062, 3]])
        ]),
        R('grand-elixir', 1045, '回復', [
            V('life-fur', '生命毛皮の調合', [[2053, 4], [2013, 3], [2044, 2]]),
            V('dragon-blood', '竜血の調合', [[2054, 2], [2020, 5], [2036, 2]])
        ]),
        R('world-dew', 6, '回復', [
            V('world-tree', '世界樹の調合', [[2055, 3], [2014, 4], [2022, 4], [2030, 2]]),
            V('origin-dew', '始原の調合', [[2054, 8], [2023, 2], [2063, 1]])
        ]),

        R('inferno-vessel', 1003, '攻撃', [
            V('flame-core', '炎核式', [[2020, 4], [2036, 3], [2050, 3]]),
            V('black-iron-flame', '黒鉄式', [[2004, 3], [2021, 2], [2052, 2]])
        ]),
        R('tidal-vessel', 1008, '攻撃', [
            V('water-dragon', '水竜式', [[2052, 4], [2020, 3], [2044, 2]]),
            V('spirit-tear', '精霊涙式', [[2051, 6], [2021, 2], [2037, 2]])
        ]),
        R('thunder-vessel', 1013, '攻撃', [
            V('thunder-crystal', '雷晶式', [[2020, 4], [2004, 3], [2035, 3]]),
            V('sky-metal', '天鋼式', [[2005, 2], [2021, 2], [2029, 2]])
        ]),
        R('storm-vessel', 1018, '攻撃', [
            V('spirit-feather', '霊羽式', [[2028, 5], [2020, 3], [2012, 2]]),
            V('pegasus-storm', '天馬式', [[2029, 3], [2021, 2], [2037, 2]])
        ]),
        R('holy-vessel', 1023, '攻撃', [
            V('holy-feather', '聖羽式', [[2030, 3], [2021, 3], [2053, 2]]),
            V('divine-relic', '神代式', [[2062, 2], [2022, 2], [2014, 2]])
        ]),
        R('abyss-vessel', 1028, '攻撃', [
            V('hell-claw', '獄爪式', [[2036, 5], [2052, 3], [2059, 3]]),
            V('chaos-hide', '混沌皮式', [[2046, 2], [2021, 3], [2061, 2]])
        ]),
        R('chaos-vessel', 1033, '攻撃', [
            V('chaos-core', '混沌核式', [[2023, 2], [2055, 3], [2062, 2]]),
            V('world-fragment', '世界片式', [[2061, 4], [2022, 3], [2006, 2]])
        ]),

        R('war-incense', 1051, '強化', [
            V('beast-force', '獣力香', [[2036, 4], [2052, 3], [2012, 2]]),
            V('god-claw', '神爪香', [[2038, 2], [2053, 2], [2021, 2]])
        ]),
        R('guard-incense', 1053, '強化', [
            V('dragon-guard', '竜鱗香', [[2044, 4], [2004, 3], [2051, 2]]),
            V('star-silver-guard', '星銀香', [[2005, 3], [2045, 2], [2053, 2]])
        ]),
        R('wisdom-incense', 1055, '強化', [
            V('crystal-wisdom', '晶智香', [[2020, 4], [2012, 3], [2051, 2]]),
            V('sage-fragment', '賢者香', [[2022, 2], [2013, 3], [2053, 2]])
        ]),
        R('ward-incense', 1057, '強化', [
            V('spirit-ward', '精霊障香', [[2051, 4], [2020, 3], [2028, 2]]),
            V('sacred-water-ward', '御水障香', [[2054, 2], [2022, 2], [2030, 2]])
        ]),
        R('rainbow-incense', 1059, '強化', [
            V('rainbow-crystal', '虹晶香', [[2021, 4], [2053, 3], [2060, 2]]),
            V('world-piece', '世界片香', [[2061, 3], [2022, 2], [2030, 2]])
        ]),

        R('weakness-curse', 1071, '弱体', [
            V('beast-blood-curse', '獣血呪香', [[2050, 5], [2036, 3], [2059, 2]]),
            V('black-hide-curse', '黒皮呪香', [[2047, 2], [2055, 2], [2061, 2]])
        ]),
        R('softening-curse', 1073, '弱体', [
            V('rust-curse', '錆蝕呪香', [[2003, 4], [2044, 3], [2049, 3]]),
            V('abyss-claw-curse', '深爪呪香', [[2039, 2], [2055, 2], [2061, 2]])
        ]),
        R('oblivion-curse', 1075, '弱体', [
            V('talisman-curse', '忘札呪香', [[2059, 4], [2020, 3], [2051, 2]]),
            V('time-sand-curse', '時砂呪香', [[2060, 3], [2022, 2], [2053, 2]])
        ]),
        R('spellbreak-curse', 1077, '弱体', [
            V('broken-crystal', '破晶呪香', [[2019, 4], [2004, 3], [2050, 2]]),
            V('god-iron-break', '神鉄呪香', [[2006, 2], [2022, 2], [2062, 2]])
        ]),
        R('colorless-curse', 1079, '弱体', [
            V('space-sand', '時空呪香', [[2060, 4], [2021, 3], [2053, 2]]),
            V('chaos-colorless', '混沌呪香', [[2023, 2], [2055, 2], [2062, 2]])
        ]),

        R('seed-life', 100, '育成', [
            V('life-root', '生命根式', [[2012, 3], [2052, 3], [2043, 2]]),
            V('star-life', '星命式', [[2053, 2], [2013, 2], [2045, 2]])
        ]),
        R('seed-mp', 101, '育成', [
            V('magic-root', '魔根式', [[2020, 3], [2052, 3], [2027, 2]]),
            V('rainbow-mind', '虹心式', [[2021, 2], [2053, 2], [2029, 2]])
        ]),
        R('seed-power', 102, '育成', [
            V('claw-power', '剛爪式', [[2036, 3], [2003, 3], [2051, 2]]),
            V('ancient-dragon', '古竜式', [[2037, 2], [2005, 2], [2053, 2]])
        ]),
        R('seed-magic', 103, '育成', [
            V('crystal-magic', '魔晶式', [[2020, 3], [2059, 2], [2051, 2]]),
            V('sage-magic', '賢者式', [[2022, 2], [2061, 2], [2053, 2]])
        ]),
        R('seed-speed', 104, '育成', [
            V('spirit-wing', '霊翼式', [[2028, 3], [2035, 2], [2051, 2]]),
            V('pegasus-wing', '天馬式', [[2029, 2], [2037, 2], [2053, 2]])
        ]),
        R('seed-guard', 105, '育成', [
            V('dragon-hide', '竜皮式', [[2044, 3], [2003, 3], [2011, 2]]),
            V('phantom-hide', '幻皮式', [[2045, 2], [2005, 2], [2013, 2]])
        ]),
        R('seed-skill', 106, '育成', [
            V('skill-crystal', '技晶式', [[2021, 3], [2060, 2], [2028, 2]]),
            V('divine-skill', '神技式', [[2022, 2], [2062, 2], [2030, 2]])
        ])
    ];

    const RANDOM_OUTPUT_TYPES = new Set(['HP回復', 'MP回復', '状態異常回復', '蘇生', '攻撃道具', '強化道具', '弱体道具', '育成']);
    const MATERIAL_RANK_VALUE = { G: 5, F: 15, E: 30, D: 45, C: 60, B: 80, A: 110, S: 150 };
    const GROWTH_ITEM_RANK = { 100: 80, 101: 80, 102: 80, 103: 80, 104: 80, 105: 80, 106: 100 };

    const Alchemy = {
        recipes,
        category: '回復',
        selectedRecipeId: recipes[0].id,
        selectedVariantIndex: 0,
        quantity: 1,
        randomSelection: {},

        item: (id) => (window.DB?.ITEMS || window.ITEMS_DATA || []).find(entry => Number(entry.id) === Number(id)),
        // App は main.js のトップレベルconstであり window のプロパティではない。
        // 遅延評価にして、main.js 読込後の実体を必ず参照する。
        owned: (id) => Math.max(0, Number((typeof App !== 'undefined' ? App.data?.items?.[id] : 0) || 0)),
        findRecipe: (id) => recipes.find(recipe => recipe.id === id) || null,
        getRecipe: (id = Alchemy.selectedRecipeId) => Alchemy.findRecipe(id) || recipes[0],
        getVariant: () => {
            const recipe = Alchemy.getRecipe();
            return recipe.variants[Math.max(0, Math.min(recipe.variants.length - 1, Alchemy.selectedVariantIndex))];
        },
        canCraft: (recipe, variant, quantity = 1) => {
            const batches = Math.max(1, Math.floor(Number(quantity) || 1));
            return !!recipe && !!variant && variant.ingredients.every(part => Alchemy.owned(part.itemId) >= part.count * batches);
        },

        getOwnedMaterials: () => (window.DB?.ITEMS || window.ITEMS_DATA || [])
            .filter(item => item?.materialType && Alchemy.owned(item.id) > 0)
            .sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0) || Number(a.id) - Number(b.id)),

        getCraftableEntries: () => recipes.map(recipe => {
            const variantIndex = recipe.variants.findIndex(variant => Alchemy.canCraft(recipe, variant, 1));
            return variantIndex >= 0 ? { recipe, variant: recipe.variants[variantIndex], variantIndex } : null;
        }).filter(Boolean),

        getRandomSelectionEntries: () => Object.entries(Alchemy.randomSelection)
            .map(([itemId, count]) => ({ item: Alchemy.item(itemId), itemId: Number(itemId), count: Math.floor(Number(count) || 0) }))
            .filter(entry => entry.item?.materialType && entry.count > 0),

        getMaterialValue: (item) => Math.max(1, Number(item?.rank || MATERIAL_RANK_VALUE[item?.materialRank] || 1)),

        getRandomQuality: (entries = Alchemy.getRandomSelectionEntries()) => {
            const totalCount = entries.reduce((sum, entry) => sum + entry.count, 0);
            const weightedValue = totalCount > 0
                ? entries.reduce((sum, entry) => sum + Alchemy.getMaterialValue(entry.item) * entry.count, 0) / totalCount
                : 0;
            const quantityBonus = Math.min(30, Math.max(0, totalCount - 2) * 2);
            const diversityBonus = Math.max(0, entries.length - 2) * 5;
            const maxRank = Math.max(1, Math.floor(weightedValue + quantityBonus + diversityBonus));
            const label = maxRank >= 110 ? '神秘級'
                : maxRank >= 80 ? '最上級'
                : maxRank >= 55 ? '上級'
                : maxRank >= 30 ? '中級'
                : maxRank >= 10 ? '初級'
                : '低級';
            return { totalCount, weightedValue, quantityBonus, diversityBonus, maxRank, label };
        },

        getRandomOutputRank: (item) => {
            const explicit = Number(item?.rank);
            if (Number.isFinite(explicit) && explicit > 0) return explicit;
            return Number(GROWTH_ITEM_RANK[Number(item?.id)] || 999);
        },

        getRandomOutputCandidates: (quality) => (window.DB?.ITEMS || window.ITEMS_DATA || [])
            .filter(item => RANDOM_OUTPUT_TYPES.has(item?.type))
            .filter(item => Number(item?.id) !== 107)
            .map(item => ({ item, rank: Alchemy.getRandomOutputRank(item) }))
            .filter(entry => entry.rank <= quality.maxRank)
            .sort((a, b) => a.rank - b.rank || Number(a.item.id) - Number(b.item.id)),

        validateRandomSelection: (entries = Alchemy.getRandomSelectionEntries()) => {
            if (entries.length < 2 || entries.length > 5) return { ok: false, message: '素材は2～5種類選んでください。' };
            for (const entry of entries) {
                if (entry.count < 1 || entry.count > 10) return { ok: false, message: '各素材は1～10個で指定してください。' };
                if (Alchemy.owned(entry.itemId) < entry.count) return { ok: false, message: `${entry.item.name}が不足しています。` };
            }
            const quality = Alchemy.getRandomQuality(entries);
            const candidates = Alchemy.getRandomOutputCandidates(quality);
            if (candidates.length === 0) return { ok: false, message: 'この組み合わせから生成できる品がありません。' };
            return { ok: true, quality, candidates };
        },

        chooseRandomOutput: (entries = Alchemy.getRandomSelectionEntries(), random = Math.random) => {
            const validation = Alchemy.validateRandomSelection(entries);
            if (!validation.ok) return null;
            const weighted = validation.candidates.map(entry => ({
                ...entry,
                weight: Math.max(1, Math.pow(entry.rank + 10, 1.6))
            }));
            const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
            let cursor = Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * totalWeight;
            for (const entry of weighted) {
                cursor -= entry.weight;
                if (cursor < 0) return { item: entry.item, quality: validation.quality };
            }
            return { item: weighted[weighted.length - 1].item, quality: validation.quality };
        },

        openFromField: () => {
            App.changeScene('alchemy');
        },

        init: () => {
            const commands = `
                <button class="menu-btn" style="background:#211a0d;border:1px solid #ffd86a;height:40px;color:#fff;" onclick="Alchemy.openRecipeList()">錬成品を選ぶ</button>
                <button class="menu-btn" style="background:#10251b;border:1px solid #73e6ad;height:40px;color:#fff;" onclick="Alchemy.openAvailableList()">作成可能一覧</button>
                <button class="menu-btn" style="background:#17172b;border:1px solid #9cb7ff;height:40px;color:#fff;" onclick="Alchemy.openRandomAlchemy()">ランダム錬成</button>`;
            Facilities.setupBaseLayout('alchemy-scene', '水上都市リヴァリア 錬金所', 'facility_bg_alchemy', commands, "App.changeScene('field')");
            const body = document.getElementById('alchemy-scene-msg-content');
            if (body) body.innerHTML = `<div style="color:#ffe69a;margin-bottom:8px;">「素材の組み合わせが違えば、同じ品にも別の道がある」</div><div id="alchemy-home-summary"></div>`;
            Alchemy.renderHome();
        },

        renderHome: () => {
            const el = document.getElementById('alchemy-home-summary');
            if (!el) return;
            const materialKinds = Object.keys(App.data?.items || {}).filter(id => Alchemy.item(id)?.materialType && Alchemy.owned(id) > 0).length;
            el.innerHTML = `所持している素材: <span style="color:#ffd700;font-weight:bold;">${materialKinds}種類</span><br><span style="color:#aaa;font-size:11px;">素材は生成直前に再確認されます。</span>`;
        },

        openRecipeList: () => {
            Alchemy.renderRecipeModal();
            const layer = document.getElementById('alchemy-scene-modal-layer');
            if (layer) layer.style.display = 'flex';
        },

        openAvailableList: () => {
            Alchemy.renderAvailableModal();
            const layer = document.getElementById('alchemy-scene-modal-layer');
            if (layer) layer.style.display = 'flex';
        },

        renderAvailableModal: () => {
            const title = document.getElementById('alchemy-scene-modal-title');
            const body = document.getElementById('alchemy-scene-modal-body');
            if (!title || !body) return;
            title.textContent = '手持ち素材で作成可能';
            const entries = Alchemy.getCraftableEntries();
            const esc = Facilities.escapeAttr;
            if (entries.length === 0) {
                body.innerHTML = `<div style="padding:24px 8px;text-align:center;color:#aaa;border:1px solid #555;">現在の手持ち素材で作成できる品はありません。</div>`;
                return;
            }
            body.innerHTML = `<div style="color:#aaa;font-size:11px;margin-bottom:8px;">作成可能な素材構成を1つずつ表示しています。</div>${entries.map(entry => {
                const output = Alchemy.item(entry.recipe.outputItemId);
                const ingredientText = entry.variant.ingredients.map(part => `${esc(Alchemy.item(part.itemId)?.name || `ID ${part.itemId}`)}×${part.count}`).join(' / ');
                return `<button onclick="Alchemy.chooseAvailableRecipe('${entry.recipe.id}',${entry.variantIndex})" style="width:100%;text-align:left;border:1px solid #587766;background:#0d1812;color:#fff;padding:9px;margin-bottom:6px;"><b style="color:#ffe08a;">${esc(output?.name || entry.recipe.id)}</b><span style="float:right;">Rank ${Number(output?.rank || 0)}</span><div style="clear:both;color:#9fd9ba;font-size:10px;margin-top:4px;">${ingredientText}</div></button>`;
            }).join('')}`;
        },

        chooseAvailableRecipe: (recipeId, variantIndex) => {
            Alchemy.selectedRecipeId = recipeId;
            Alchemy.selectedVariantIndex = Math.max(0, Number(variantIndex) || 0);
            Alchemy.quantity = 1;
            Alchemy.renderRecipeModal();
        },

        openRandomAlchemy: () => {
            const validIds = new Set(Alchemy.getOwnedMaterials().map(item => Number(item.id)));
            Object.keys(Alchemy.randomSelection).forEach(id => {
                if (!validIds.has(Number(id)) || Alchemy.owned(id) <= 0) delete Alchemy.randomSelection[id];
            });
            Alchemy.renderRandomModal();
            const layer = document.getElementById('alchemy-scene-modal-layer');
            if (layer) layer.style.display = 'flex';
        },

        toggleRandomMaterial: (itemId) => {
            const id = Number(itemId);
            if (Alchemy.randomSelection[id]) delete Alchemy.randomSelection[id];
            else if (Object.keys(Alchemy.randomSelection).length < 5 && Alchemy.owned(id) > 0) Alchemy.randomSelection[id] = 1;
            else if (Object.keys(Alchemy.randomSelection).length >= 5) Menu.msg('選べる素材は5種類までです。');
            Alchemy.renderRandomModal();
        },

        adjustRandomMaterial: (itemId, delta) => {
            const id = Number(itemId);
            if (!Alchemy.randomSelection[id]) return;
            Alchemy.randomSelection[id] = Math.max(1, Math.min(10, Alchemy.owned(id), Alchemy.randomSelection[id] + Number(delta || 0)));
            Alchemy.renderRandomModal();
        },

        clearRandomSelection: () => {
            Alchemy.randomSelection = {};
            Alchemy.renderRandomModal();
        },

        renderRandomModal: () => {
            const title = document.getElementById('alchemy-scene-modal-title');
            const body = document.getElementById('alchemy-scene-modal-body');
            if (!title || !body) return;
            title.textContent = 'ランダム錬成';
            const materials = Alchemy.getOwnedMaterials();
            const selected = Alchemy.getRandomSelectionEntries();
            const validation = Alchemy.validateRandomSelection(selected);
            const quality = Alchemy.getRandomQuality(selected);
            const esc = Facilities.escapeAttr;
            const materialButtons = materials.map(item => {
                const count = Number(Alchemy.randomSelection[item.id] || 0);
                const active = count > 0;
                return `<div style="border:1px solid ${active ? '#9cb7ff' : '#555'};background:${active ? '#151b36' : '#0b0b0b'};padding:6px;margin-bottom:5px;">
                    <button onclick="Alchemy.toggleRandomMaterial(${item.id})" style="width:100%;border:0;background:transparent;color:${active ? '#fff' : '#bbb'};text-align:left;padding:0;"><b>${esc(item.name)}</b><span style="float:right;color:#ffd86a;">${esc(item.materialRank || '')} / 所持${Alchemy.owned(item.id)}</span></button>
                    ${active ? `<div style="display:grid;grid-template-columns:34px 1fr 34px;gap:5px;align-items:center;margin-top:5px;"><button class="btn" onclick="Alchemy.adjustRandomMaterial(${item.id},-1)">－</button><div style="text-align:center;color:#9cb7ff;">${count}個</div><button class="btn" onclick="Alchemy.adjustRandomMaterial(${item.id},1)">＋</button></div>` : ''}
                </div>`;
            }).join('');
            body.innerHTML = `<div style="font-size:11px;color:#bbb;margin-bottom:7px;">異なる素材を2～5種類、各1～10個選択。素材ランク・総数・種類数で完成品の品質が変わります。</div>
                <div style="max-height:230px;overflow:auto;border:1px solid #444;padding:6px;">${materialButtons || '<div style="color:#aaa;text-align:center;padding:20px;">所持素材がありません。</div>'}</div>
                <div style="border:1px solid #6574a8;background:#0b1022;padding:8px;margin-top:8px;">
                    <div style="display:flex;justify-content:space-between;"><span>選択</span><b>${selected.length}種類 / ${quality.totalCount}個</b></div>
                    <div style="display:flex;justify-content:space-between;color:#9cb7ff;"><span>予測品質</span><b>${quality.label}</b></div>
                    <div style="font-size:10px;color:#888;margin-top:3px;">生成候補の上限 Rank ${quality.maxRank}</div>
                    <div style="display:grid;grid-template-columns:1fr 2fr;gap:6px;margin-top:8px;"><button class="btn" onclick="Alchemy.clearRandomSelection()">選択解除</button><button class="menu-btn" ${validation.ok ? '' : 'disabled'} onclick="Alchemy.confirmRandomCraft()" style="height:42px;background:${validation.ok ? '#25366d' : '#222'};border:2px solid ${validation.ok ? '#9cb7ff' : '#555'};color:${validation.ok ? '#fff' : '#777'};">${validation.ok ? 'ランダム錬成する' : esc(validation.message)}</button></div>
                </div>`;
        },

        confirmRandomCraft: () => {
            const validation = Alchemy.validateRandomSelection();
            if (!validation.ok) {
                Menu.msg(validation.message);
                Alchemy.renderRandomModal();
                return;
            }
            Menu.confirm(`${validation.quality.label}のランダム錬成を行いますか？\n投入した素材はすべて消費されます。`, () => Alchemy.randomCraftConfirmed());
        },

        randomCraftConfirmed: (random = Math.random) => {
            const entries = Alchemy.getRandomSelectionEntries();
            const validation = Alchemy.validateRandomSelection(entries);
            if (!validation.ok) {
                Menu.msg(validation.message);
                Alchemy.renderRandomModal();
                return false;
            }
            const result = Alchemy.chooseRandomOutput(entries, random);
            if (!result?.item) return false;
            entries.forEach(entry => {
                App.data.items[entry.itemId] = Alchemy.owned(entry.itemId) - entry.count;
                if (App.data.items[entry.itemId] <= 0) delete App.data.items[entry.itemId];
            });
            App.data.items[result.item.id] = Alchemy.owned(result.item.id) + 1;
            Alchemy.randomSelection = {};
            App.save();
            Alchemy.renderHome();
            Alchemy.renderRandomModal();
            Menu.msg(`${result.quality.label}錬成に成功！\n${result.item.name}を 1個 錬成した！`);
            return result.item;
        },

        setCategory: (category) => {
            Alchemy.category = category;
            const first = recipes.find(recipe => recipe.category === category);
            if (first) {
                Alchemy.selectedRecipeId = first.id;
                Alchemy.selectedVariantIndex = 0;
                Alchemy.quantity = 1;
            }
            Alchemy.renderRecipeModal();
        },

        selectRecipe: (id) => {
            Alchemy.selectedRecipeId = id;
            Alchemy.selectedVariantIndex = 0;
            Alchemy.quantity = 1;
            Alchemy.renderRecipeModal();
        },

        selectVariant: (index) => {
            Alchemy.selectedVariantIndex = Math.max(0, Number(index) || 0);
            Alchemy.quantity = 1;
            Alchemy.renderRecipeModal();
        },

        adjustQuantity: (delta) => {
            Alchemy.quantity = Math.max(1, Math.min(99, Alchemy.quantity + Number(delta || 0)));
            Alchemy.renderRecipeModal();
        },

        renderRecipeModal: () => {
            const title = document.getElementById('alchemy-scene-modal-title');
            const body = document.getElementById('alchemy-scene-modal-body');
            if (!title || !body) return;
            title.textContent = '錬金レシピ';
            const categories = ['回復', '攻撃', '強化', '弱体', '育成'];
            const currentRecipes = recipes.filter(recipe => recipe.category === Alchemy.category);
            const recipe = currentRecipes.find(entry => entry.id === Alchemy.selectedRecipeId) || currentRecipes[0];
            if (!recipe) return;
            Alchemy.selectedRecipeId = recipe.id;
            const variant = recipe.variants[Math.min(Alchemy.selectedVariantIndex, recipe.variants.length - 1)];
            const output = Alchemy.item(recipe.outputItemId);
            const esc = Facilities.escapeAttr;
            const tabs = categories.map(category => `<button onclick="Alchemy.setCategory('${category}')" style="border:1px solid #777;background:${category === Alchemy.category ? '#ffd700' : '#111'};color:${category === Alchemy.category ? '#111' : '#ddd'};padding:7px 4px;font-size:11px;">${category}</button>`).join('');
            const list = currentRecipes.map(entry => {
                const item = Alchemy.item(entry.outputItemId);
                const active = entry.id === recipe.id;
                const anyAvailable = entry.variants.some(v => Alchemy.canCraft(entry, v, 1));
                return `<button onclick="Alchemy.selectRecipe('${entry.id}')" style="width:100%;text-align:left;border:1px solid ${active ? '#ffd700' : '#555'};background:${active ? '#2b2508' : '#111'};color:${anyAvailable ? '#fff' : '#777'};padding:8px;margin-bottom:5px;"><b>${esc(item?.name || entry.id)}</b><span style="float:right;color:#ffd86a;">Rank ${Number(item?.rank || 0)}</span></button>`;
            }).join('');
            const variants = recipe.variants.map((entry, index) => `<button onclick="Alchemy.selectVariant(${index})" style="border:1px solid ${index === Alchemy.selectedVariantIndex ? '#7ff' : '#555'};background:${index === Alchemy.selectedVariantIndex ? '#12333a' : '#111'};color:#fff;padding:6px 8px;">${esc(entry.name)}</button>`).join('');
            const ingredientRows = variant.ingredients.map(part => {
                const item = Alchemy.item(part.itemId);
                const need = part.count * Alchemy.quantity;
                const owned = Alchemy.owned(part.itemId);
                return `<div style="display:flex;justify-content:space-between;border-bottom:1px dotted #555;padding:5px 0;color:${owned >= need ? '#fff' : '#ff7777'};"><span>${esc(item?.name || `ID ${part.itemId}`)}</span><span>${owned} / ${need}</span></div>`;
            }).join('');
            const available = Alchemy.canCraft(recipe, variant, Alchemy.quantity);
            body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-bottom:8px;">${tabs}</div><div style="max-height:150px;overflow:auto;margin-bottom:10px;">${list}</div><div style="border:1px solid #777;padding:9px;background:#080808;"><div style="font-size:15px;color:#ffd700;font-weight:bold;">${esc(output?.name || recipe.id)} × ${recipe.outputCount * Alchemy.quantity}</div><div style="font-size:10px;color:#aaa;margin-bottom:7px;">${esc(output?.desc || '')}</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px;">${variants}</div>${ingredientRows}<div style="display:grid;grid-template-columns:42px 1fr 42px;gap:6px;align-items:center;margin-top:9px;"><button class="btn" onclick="Alchemy.adjustQuantity(-1)">－</button><div style="text-align:center;color:#ffd700;">${Alchemy.quantity}回分</div><button class="btn" onclick="Alchemy.adjustQuantity(1)">＋</button></div><button class="menu-btn" ${available ? '' : 'disabled'} onclick="Alchemy.confirmCraft()" style="width:100%;height:42px;margin-top:9px;background:${available ? '#665000' : '#222'};border:2px solid ${available ? '#ffd700' : '#555'};color:${available ? '#fff' : '#777'};">${available ? '錬成する' : '素材が足りない'}</button></div>`;
        },

        confirmCraft: () => {
            const recipe = Alchemy.getRecipe();
            const variant = Alchemy.getVariant();
            const output = Alchemy.item(recipe.outputItemId);
            const count = recipe.outputCount * Alchemy.quantity;
            Menu.confirm(`${output?.name || '品物'}を ${count}個 錬成しますか？`, () => Alchemy.craftConfirmed(recipe.id, variant.id, Alchemy.quantity));
        },

        craftConfirmed: (recipeId, variantId, quantity = 1) => {
            const recipe = Alchemy.findRecipe(recipeId);
            const variant = recipe?.variants.find(entry => entry.id === variantId);
            const batches = Math.max(1, Math.floor(Number(quantity) || 1));
            if (!Alchemy.canCraft(recipe, variant, batches)) {
                Menu.msg('素材が足りません。');
                Alchemy.renderRecipeModal();
                return false;
            }
            variant.ingredients.forEach(part => {
                App.data.items[part.itemId] = Alchemy.owned(part.itemId) - part.count * batches;
                if (App.data.items[part.itemId] <= 0) delete App.data.items[part.itemId];
            });
            const made = recipe.outputCount * batches;
            App.data.items[recipe.outputItemId] = Alchemy.owned(recipe.outputItemId) + made;
            App.save();
            Alchemy.renderHome();
            Alchemy.renderRecipeModal();
            Menu.msg(`${Alchemy.item(recipe.outputItemId)?.name || '品物'}を ${made}個 錬成した！`);
            return true;
        }
    };

    window.ALCHEMY_RECIPES = recipes;
    window.Alchemy = Alchemy;
})();
