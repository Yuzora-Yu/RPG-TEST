/* ========================================================================== 
   monster_nursery.js - レガシオン モンスター育成所
   ========================================================================== */

const MonsterNursery = {
    state: {
        primaryUid: null,
        materialUid: null,
        selectedSkillIds: [],
        selectedTraitIds: []
    },

    getPotId: () => Number(window.PRISMA_SYNTHESIS_POT_ITEM_ID || 599999),
    getPotCount: () => Math.max(0, Number(App.data?.items?.[MonsterNursery.getPotId()] || 0)),
    getMonsterAllies: () => (App.data?.characters || []).filter(character => App.isMonsterAlly?.(character)),
    escape: value => Facilities.escapeAttr(value ?? ''),

    getGrowthLabel: character => {
        const stored = character?.monsterAllyMeta?.growthTypeLabel;
        if (stored) return stored;
        const master = App.getMonsterMasterForAlly?.(character);
        return App.getMonsterAllyGrowthTypeMaster?.(master?.allyGrowthType)?.data?.label || 'バランス型A';
    },

    grantFirstVisitPot: () => {
        App.data.progress = App.data.progress || {};
        App.data.progress.flags = App.data.progress.flags || {};
        const flags = App.data.progress.flags;
        if (flags.monsterNurseryFirstVisitGiftReceived === true) return false;
        const potId = MonsterNursery.getPotId();
        App.data.items = App.data.items || {};
        App.data.items[potId] = Number(App.data.items[potId] || 0) + 1;
        flags.monsterNurseryFirstVisitGiftReceived = true;
        App.save();
        return true;
    },

    openFromField: () => {
        const granted = MonsterNursery.grantFirstVisitPot();
        App.changeScene('monster-nursery');
        if (granted) {
            setTimeout(() => {
                const message = '育成所の初回利用として、合成の壺を1個受け取った！';
                if (typeof Menu !== 'undefined' && typeof Menu.msg === 'function') Menu.msg(message);
                else App.log(message);
            }, 0);
        }
    },

    exitToField: () => App.changeScene('field'),

    init: () => {
        const commands = `
            <button class="menu-btn" style="background:#14251b;border:1px solid #76e6a7;height:40px;color:#fff;" onclick="MonsterNursery.openFusion()">モンスター合成</button>
            <button class="menu-btn" style="background:#17172b;border:1px solid #9cb7ff;height:40px;color:#fff;" onclick="MonsterNursery.showGuide()">説明を聞く</button>`;
        Facilities.setupBaseLayout(
            'monster-nursery-scene',
            '混沌魔城レガシオン モンスター育成所',
            'facility_bg_inn',
            commands,
            'MonsterNursery.exitToField()'
        );
        MonsterNursery.renderHome();
    },

    renderHome: () => {
        const body = document.getElementById('monster-nursery-scene-msg-content');
        if (!body) return;
        const allies = MonsterNursery.getMonsterAllies();
        body.innerHTML = `
            <div style="color:#b8f4d0;margin-bottom:8px;">「姿を残し、積み重ねた力を次の生へ渡す。それがここでの合成だ」</div>
            <div style="border:1px solid #52685b;background:rgba(0,0,0,0.72);padding:10px;line-height:1.7;">
                仲間モンスター: <b style="color:#fff;">${allies.length}体</b><br>
                合成の壺: <b style="color:#ffd86a;">${MonsterNursery.getPotCount()}個</b><br>
                <span style="font-size:11px;color:#aaa;">メインの姿・名前・成長型を維持し、素材の永続能力10%を加算します。</span>
            </div>`;
    },

    showGuide: () => {
        Facilities.showModal('monster-nursery-scene', 'モンスター合成について', `
            <div style="font-size:12px;line-height:1.75;color:#ddd;">
                <b style="color:#ffe08a;">メイン</b>と<b style="color:#9cb7ff;">素材</b>の仲間モンスターを1体ずつ選びます。<br><br>
                ・合成後はレベル1、経験値0<br>
                ・メインの名前、画像、成長型を維持<br>
                ・メインの永続能力＋素材の永続能力10%（切り捨て）<br>
                ・両者の装備はすべて外れて所持品へ戻る<br>
                ・スキルは重複をまとめ、最大8個<br>
                ・特性は重複時に高いLvを採用し、最大6個<br>
                ・合成回数は転生回数と同じく必要経験値と成長補正へ反映<br><br>
                素材にした仲間モンスターは消滅します。
            </div>`);
    },

    resetState: () => {
        MonsterNursery.state = { primaryUid:null, materialUid:null, selectedSkillIds:[], selectedTraitIds:[] };
    },

    openFusion: () => {
        const allies = MonsterNursery.getMonsterAllies();
        if (allies.length < 2) {
            Menu.msg('合成には仲間モンスターが2体必要です。');
            return;
        }
        MonsterNursery.resetState();
        MonsterNursery.renderCharacterSelection('primary');
    },

    renderCharacterSelection: mode => {
        const isPrimary = mode === 'primary';
        const excludedUid = isPrimary ? null : MonsterNursery.state.primaryUid;
        const allies = MonsterNursery.getMonsterAllies().filter(character => character.uid !== excludedUid);
        const title = isPrimary ? 'メインを選ぶ' : '素材を選ぶ';
        const rows = allies.map(character => MonsterNursery.renderCharacterRow(character, mode)).join('');
        Facilities.showModal('monster-nursery-scene', title, `
            <div style="font-size:11px;color:#aaa;margin-bottom:8px;">${isPrimary ? '姿・名前・成長型を残すモンスターを選択' : '能力10%とスキル・特性を引き継ぐ素材を選択'}</div>
            <div style="display:flex;flex-direction:column;gap:7px;">${rows}</div>`, {
                modalMaxWidth:'720px',
                bodyMaxHeight:'68vh'
            });
    },

    renderCharacterRow: (character, mode) => {
        const esc = MonsterNursery.escape;
        const stats = ['hp','mp','atk','def','mag','mdef','spd'].map(key => Number(character[key] || 0).toLocaleString()).join(' / ');
        const image = esc(character.img || character.image || '');
        const fusionCount = Math.max(0, Number(character.monsterFusionCount || 0));
        return `<button onclick="MonsterNursery.selectCharacter('${esc(character.uid)}','${mode}')" style="display:grid;grid-template-columns:54px minmax(0,1fr);gap:9px;align-items:center;width:100%;text-align:left;border:1px solid #566;background:#0b1110;color:#fff;padding:7px;">
            <div style="width:50px;height:50px;border:1px solid #667;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;">${image ? `<img src="${image}" alt="" style="max-width:100%;max-height:100%;image-rendering:pixelated;">` : ''}</div>
            <div style="min-width:0;">
                <div style="display:flex;justify-content:space-between;gap:8px;"><b style="color:#ffe08a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(character.name)}</b><span style="font-size:11px;color:#9cb7ff;">Lv${Number(character.level || 1)} / 合成${fusionCount}</span></div>
                <div style="font-size:11px;color:#b8f4d0;">${esc(MonsterNursery.getGrowthLabel(character))}</div>
                <div style="font-size:9px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">HP / MP / 攻 / 防 / 魔 / 魔防 / 速　${stats}</div>
            </div>
        </button>`;
    },

    selectCharacter: (uid, mode) => {
        if (mode === 'primary') {
            MonsterNursery.state.primaryUid = uid;
            MonsterNursery.renderCharacterSelection('material');
            return;
        }
        MonsterNursery.state.materialUid = uid;
        const preview = App.getMonsterFusionPreview(MonsterNursery.state.primaryUid, uid);
        if (!preview.ok) {
            Menu.msg(preview.message || '合成対象を確認できません。');
            return;
        }
        MonsterNursery.state.selectedSkillIds = preview.allSkills.slice(0, 8);
        MonsterNursery.state.selectedTraitIds = preview.allTraits.slice(0, 6).map(trait => Number(trait.id));
        MonsterNursery.renderFusionReview();
    },

    toggleSkill: skillId => {
        const id = Number(skillId);
        const selected = new Set(MonsterNursery.state.selectedSkillIds.map(Number));
        if (selected.has(id)) selected.delete(id);
        else if (selected.size < 8) selected.add(id);
        else return Menu.msg('選べるスキルは8個までです。');
        MonsterNursery.state.selectedSkillIds = Array.from(selected);
        MonsterNursery.renderFusionReview();
    },

    toggleTrait: traitId => {
        const id = Number(traitId);
        const selected = new Set(MonsterNursery.state.selectedTraitIds.map(Number));
        if (selected.has(id)) selected.delete(id);
        else if (selected.size < 6) selected.add(id);
        else return Menu.msg('選べる特性は6個までです。');
        MonsterNursery.state.selectedTraitIds = Array.from(selected);
        MonsterNursery.renderFusionReview();
    },

    renderFusionReview: () => {
        const preview = App.getMonsterFusionPreview(
            MonsterNursery.state.primaryUid,
            MonsterNursery.state.materialUid,
            MonsterNursery.state.selectedSkillIds,
            MonsterNursery.state.selectedTraitIds
        );
        if (!preview.ok) return Menu.msg(preview.message || '合成内容を確認できません。');
        const esc = MonsterNursery.escape;
        const statLabels = { hp:'HP', mp:'MP', atk:'攻撃', def:'防御', mag:'魔力', mdef:'魔防', spd:'速さ' };
        const statsHtml = Object.keys(statLabels).map(key => {
            const before = Number(preview.primary[key] || 0);
            const material = Math.floor(Number(preview.material[key] || 0) * 0.10);
            const after = Number(preview.stats[key] || 0);
            return `<div style="display:grid;grid-template-columns:46px 1fr 1fr 1fr;gap:4px;font-size:10px;padding:3px 0;border-bottom:1px solid #222;"><span>${statLabels[key]}</span><span style="text-align:right;">${before.toLocaleString()}</span><span style="text-align:right;color:#9cb7ff;">+${material.toLocaleString()}</span><b style="text-align:right;color:#ffe08a;">${after.toLocaleString()}</b></div>`;
        }).join('');
        const skillHtml = preview.allSkills.map(id => {
            const active = MonsterNursery.state.selectedSkillIds.map(Number).includes(Number(id));
            const skill = DB.SKILLS.find(entry => Number(entry.id) === Number(id));
            return `<button onclick="MonsterNursery.toggleSkill(${Number(id)})" style="border:1px solid ${active ? '#9cb7ff' : '#444'};background:${active ? '#17254a' : '#111'};color:${active ? '#fff' : '#888'};padding:5px;text-align:left;">${active ? '✓ ' : ''}${esc(skill?.name || `Skill ${id}`)}</button>`;
        }).join('');
        const traitHtml = preview.allTraits.map(trait => {
            const active = MonsterNursery.state.selectedTraitIds.map(Number).includes(Number(trait.id));
            const master = PassiveSkill.MASTER?.[Number(trait.id)];
            return `<button onclick="MonsterNursery.toggleTrait(${Number(trait.id)})" style="border:1px solid ${active ? '#76e6a7' : '#444'};background:${active ? '#123522' : '#111'};color:${active ? '#fff' : '#888'};padding:5px;text-align:left;">${active ? '✓ ' : ''}${esc(master?.name || `特性${trait.id}`)} Lv${Number(trait.level || 1)}</button>`;
        }).join('');
        const skillsValid = !preview.requiresSkillSelection || MonsterNursery.state.selectedSkillIds.length === 8;
        const traitsValid = !preview.requiresTraitSelection || MonsterNursery.state.selectedTraitIds.length === 6;
        const potValid = MonsterNursery.getPotCount() > 0;
        const canFuse = skillsValid && traitsValid && potValid;
        Facilities.showModal('monster-nursery-scene', '合成内容の確認', `
            <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-bottom:10px;">
                <div style="border:1px solid #ffe08a;padding:7px;background:#171300;"><div style="font-size:9px;color:#aaa;">メイン</div><b>${esc(preview.primary.name)}</b><div style="font-size:10px;color:#b8f4d0;">${esc(MonsterNursery.getGrowthLabel(preview.primary))}</div></div>
                <div style="font-size:20px;color:#fff;">＋</div>
                <div style="border:1px solid #9cb7ff;padding:7px;background:#0d1325;"><div style="font-size:9px;color:#aaa;">素材</div><b>${esc(preview.material.name)}</b><div style="font-size:10px;color:#aaa;">合成後に消滅</div></div>
            </div>
            <div style="border:1px solid #555;padding:7px;margin-bottom:9px;"><div style="display:grid;grid-template-columns:46px 1fr 1fr 1fr;gap:4px;font-size:9px;color:#888;"><span></span><span style="text-align:right;">現在</span><span style="text-align:right;">素材10%</span><span style="text-align:right;">合成後</span></div>${statsHtml}</div>
            <div style="margin-bottom:9px;"><div style="display:flex;justify-content:space-between;color:#9cb7ff;font-size:11px;margin-bottom:4px;"><b>スキル</b><span>${MonsterNursery.state.selectedSkillIds.length} / ${Math.min(8, preview.allSkills.length)}</span></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;">${skillHtml || '<span style="color:#888;">なし</span>'}</div></div>
            <div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;color:#76e6a7;font-size:11px;margin-bottom:4px;"><b>特性</b><span>${MonsterNursery.state.selectedTraitIds.length} / ${Math.min(6, preview.allTraits.length)}</span></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;">${traitHtml || '<span style="color:#888;">なし</span>'}</div></div>
            <div style="border-top:1px solid #555;padding-top:8px;font-size:11px;color:#ddd;">合成後 Lv1 / 合成回数 ${preview.nextFusionCount}<span style="float:right;color:#ffd86a;">合成の壺 ${MonsterNursery.getPotCount()}個</span></div>
            <button class="menu-btn" ${canFuse ? '' : 'disabled'} onclick="MonsterNursery.confirmFusion()" style="width:100%;height:44px;margin-top:9px;background:${canFuse ? '#235a39' : '#222'};border:2px solid ${canFuse ? '#76e6a7' : '#555'};color:${canFuse ? '#fff' : '#777'};">${potValid ? (canFuse ? 'この内容で合成する' : '選択数を確認してください') : '合成の壺がありません'}</button>
        `, { modalMaxWidth:'760px', bodyMaxHeight:'72vh' });
    },

    confirmFusion: () => {
        const primary = App.getChar(MonsterNursery.state.primaryUid);
        const material = App.getChar(MonsterNursery.state.materialUid);
        if (!primary || !material) return Menu.msg('合成対象を確認できません。');
        Menu.confirm(`${primary.name}をメインに、${material.name}を素材として合成します。\n素材モンスターは失われ、両者の装備はすべて外れます。\n実行しますか？`, () => {
            const result = App.fuseMonsterAllies(
                primary.uid,
                material.uid,
                MonsterNursery.state.selectedSkillIds,
                MonsterNursery.state.selectedTraitIds
            );
            if (!result.ok) {
                Menu.msg(result.message || '合成に失敗しました。');
                MonsterNursery.renderFusionReview();
                return;
            }
            Facilities.closeModal('monster-nursery-scene');
            MonsterNursery.resetState();
            MonsterNursery.renderHome();
            Menu.msg(`${result.message}\n外した装備 ${result.returnedEquipmentCount}個を所持品へ戻した。`);
        });
    }
};

if (typeof window !== 'undefined') window.MonsterNursery = MonsterNursery;
