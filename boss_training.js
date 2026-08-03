/* ========================================================================== 
   boss_training.js - レガシオン ストーリーボス訓練所
   ========================================================================== */

const BossTraining = {
    state: {
        trainingId: null,
        strengthFloor: 101,
        randomSelection: false
    },

    getMaster: () => Array.isArray(globalThis.ABYSS_REGION_CONTENT?.storyBossTrainingMaster)
        ? globalThis.ABYSS_REGION_CONTENT.storyBossTrainingMaster
        : [],

    getDifficulties: () => Array.isArray(globalThis.ABYSS_REGION_CONTENT?.storyBossTrainingDifficulties)
        ? globalThis.ABYSS_REGION_CONTENT.storyBossTrainingDifficulties
        : [],

    getMonsterMaster: id => {
        const api = globalThis.MonsterData || (typeof window !== 'undefined' ? window.MonsterData : null);
        return api?.getMonsterById?.(Number(id)) || DB?.MONSTERS?.find?.(monster => Number(monster.id) === Number(id)) || null;
    },

    escape: value => Facilities.escapeAttr(value ?? ''),

    isEntryUnlocked: entry => {
        if (!entry) return false;
        const flags = App.data?.progress?.flags || {};
        if (entry.unlockFlag && flags[entry.unlockFlag] === true) return true;
        const killCounts = App.data?.book?.killCounts || {};
        return (entry.monsterIds || []).every(id => Number(killCounts[id] || killCounts[String(id)] || 0) > 0);
    },

    getUnlockedEntries: () => BossTraining.getMaster().filter(BossTraining.isEntryUnlocked),

    getEntry: id => BossTraining.getMaster().find(entry => entry.id === id) || null,

    getDifficulty: floor => {
        const numeric = Math.max(101, Math.floor(Number(floor) || 101));
        return BossTraining.getDifficulties().find(entry => Number(entry.strengthFloor) === numeric)
            || BossTraining.getDifficulties()[0]
            || { id:'floor101', label:'初級', strengthFloor:101, description:'深淵101階相当' };
    },

    getEntryName: entry => (entry?.monsterIds || [])
        .map(id => BossTraining.getMonsterMaster(id)?.name || `Monster ${id}`)
        .join(' ＆ '),

    openFromField: () => App.changeScene('boss-training'),
    exitToField: () => App.changeScene('field'),

    init: () => {
        const commands = `
            <button class="menu-btn" style="background:#241931;border:1px solid #cba4ff;height:40px;color:#fff;" onclick="BossTraining.openOpponentList()">対戦相手を選ぶ</button>
            <button class="menu-btn" style="background:#2b1b15;border:1px solid #ffc483;height:40px;color:#fff;" onclick="BossTraining.selectRandomOpponent()">ランダム対戦</button>
            <button class="menu-btn" style="background:#17172b;border:1px solid #9cb7ff;height:40px;color:#fff;" onclick="BossTraining.showGuide()">訓練所の説明</button>`;
        Facilities.setupBaseLayout(
            'boss-training-scene',
            '混沌魔城レガシオン ストーリーボス訓練所',
            'facility_bg_inn',
            commands,
            'BossTraining.exitToField()'
        );
        BossTraining.renderHome();
    },

    renderHome: () => {
        const body = document.getElementById('boss-training-scene-msg-content');
        if (!body) return;
        const unlocked = BossTraining.getUnlockedEntries();
        const selected = BossTraining.getEntry(BossTraining.state.trainingId);
        const difficulty = BossTraining.getDifficulty(BossTraining.state.strengthFloor);
        body.innerHTML = `
            <div style="color:#d8b5ff;margin-bottom:8px;">撃破した物語の強敵を、深層の力で再現する訓練施設です。</div>
            <div style="border:1px solid #5d4d70;background:rgba(0,0,0,0.72);padding:10px;line-height:1.7;">
                解放済み: <b style="color:#fff;">${unlocked.length}体</b><br>
                選択中: <b style="color:#ffe08a;">${BossTraining.escape(selected ? BossTraining.getEntryName(selected) : '未選択')}</b><br>
                強化段階: <b style="color:#9cb7ff;">${BossTraining.escape(difficulty.label)}（${BossTraining.escape(difficulty.description)}）</b><br>
                <span style="font-size:11px;color:#aaa;">訓練戦では報酬・討伐記録・クエスト進行・仲間加入は発生しません。</span>
            </div>
            ${selected ? `<button class="menu-btn" onclick="BossTraining.openBattleReview()" style="width:100%;height:44px;margin-top:10px;background:#3b2452;border:2px solid #cba4ff;color:#fff;">この相手と訓練する</button>` : ''}`;
    },

    showGuide: () => {
        Facilities.showModal('boss-training-scene', '訓練所について', `
            <div style="font-size:12px;line-height:1.75;color:#ddd;">
                一度撃破したストーリーボスを、深淵101階以降と同じ規則で強化して再現します。<br><br>
                ・元の属性耐性・状態耐性を保ったまま追加強化<br>
                ・元の技を維持し、同系統の上位技を追加<br>
                ・元の役割に適した特性を強化・追加<br>
                ・本編の撃破記録、報酬、経験値、ゴールド、仲間加入は発生しない<br>
                ・勝敗にかかわらず、HP・MPは訓練開始前の状態へ戻る<br><br>
                「極限」は深淵301階相当です。十分に育成してから挑戦してください。
            </div>`);
    },

    openOpponentList: () => {
        const unlocked = BossTraining.getUnlockedEntries();
        if (!unlocked.length) return Menu.msg('訓練可能なストーリーボスがまだいません。');
        const categories = new Map();
        unlocked.forEach(entry => {
            const category = entry.category || 'その他';
            if (!categories.has(category)) categories.set(category, []);
            categories.get(category).push(entry);
        });
        const html = Array.from(categories.entries()).map(([category, entries]) => `
            <div style="color:#cba4ff;font-weight:bold;margin:8px 0 5px;">${BossTraining.escape(category)}</div>
            <div style="display:flex;flex-direction:column;gap:5px;">
                ${entries.map(entry => {
                    const selected = entry.id === BossTraining.state.trainingId;
                    const bases = entry.monsterIds.map(BossTraining.getMonsterMaster).filter(Boolean);
                    const rank = bases.length ? Math.max(...bases.map(base => Number(base.rank || 1))) : 1;
                    return `<button onclick="BossTraining.selectOpponent('${BossTraining.escape(entry.id)}')" style="display:flex;justify-content:space-between;gap:8px;width:100%;padding:9px;border:1px solid ${selected ? '#ffe08a' : '#555'};background:${selected ? '#3a3012' : '#111'};color:#fff;text-align:left;"><span>${BossTraining.escape(BossTraining.getEntryName(entry))}</span><span style="color:#999;font-size:10px;white-space:nowrap;">元Rank ${rank}</span></button>`;
                }).join('')}
            </div>`).join('');
        Facilities.showModal('boss-training-scene', '対戦相手を選ぶ', html, {
            modalMaxWidth:'680px', bodyMaxHeight:'70vh'
        });
    },

    selectOpponent: trainingId => {
        const entry = BossTraining.getEntry(trainingId);
        if (!entry || !BossTraining.isEntryUnlocked(entry)) return Menu.msg('この対戦相手はまだ解放されていません。');
        BossTraining.state.trainingId = entry.id;
        BossTraining.state.randomSelection = false;
        Facilities.closeModal('boss-training-scene');
        BossTraining.renderHome();
        BossTraining.openBattleReview();
    },

    selectRandomOpponent: () => {
        const unlocked = BossTraining.getUnlockedEntries();
        if (!unlocked.length) return Menu.msg('訓練可能なストーリーボスがまだいません。');
        const entry = unlocked[Math.floor(Math.random() * unlocked.length)];
        BossTraining.state.trainingId = entry.id;
        BossTraining.state.randomSelection = true;
        BossTraining.renderHome();
        BossTraining.openBattleReview();
    },

    setDifficulty: floor => {
        BossTraining.state.strengthFloor = BossTraining.getDifficulty(floor).strengthFloor;
        BossTraining.openBattleReview();
    },

    openBattleReview: () => {
        const entry = BossTraining.getEntry(BossTraining.state.trainingId);
        if (!entry || !BossTraining.isEntryUnlocked(entry)) return BossTraining.openOpponentList();
        const difficulty = BossTraining.getDifficulty(BossTraining.state.strengthFloor);
        const difficultyButtons = BossTraining.getDifficulties().map(option => {
            const active = Number(option.strengthFloor) === Number(difficulty.strengthFloor);
            return `<button onclick="BossTraining.setDifficulty(${Number(option.strengthFloor)})" style="padding:8px 4px;border:1px solid ${active ? '#9cb7ff' : '#555'};background:${active ? '#17254a' : '#111'};color:${active ? '#fff' : '#aaa'};"><b>${BossTraining.escape(option.label)}</b><br><span style="font-size:9px;">${BossTraining.escape(option.description)}</span></button>`;
        }).join('');
        const bosses = entry.monsterIds.map(id => BossTraining.getMonsterMaster(id)).filter(Boolean);
        const details = bosses.map(base => `<div style="border:1px solid #444;background:#0d0d0d;padding:8px;"><b style="color:#ffe08a;">${BossTraining.escape(base.name)}</b><div style="font-size:10px;color:#999;">元Rank ${Number(base.rank || 1)} / ${BossTraining.escape(base.race || '不明')}</div></div>`).join('');
        Facilities.showModal('boss-training-scene', '訓練内容の確認', `
            <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">${details}</div>
            <div style="font-size:11px;color:#aaa;margin-bottom:5px;">強化段階</div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-bottom:12px;">${difficultyButtons}</div>
            <div style="border:1px solid #604a75;background:#1b1025;padding:8px;font-size:11px;line-height:1.6;color:#ddd;">
                ${BossTraining.escape(difficulty.description)}として再現します。<br>
                報酬・討伐数・クエスト進行なし。戦闘後は開始前のHP・MPへ戻ります。
            </div>
            <button class="menu-btn" onclick="BossTraining.confirmStartBattle()" style="width:100%;height:46px;margin-top:10px;background:#4a245f;border:2px solid #d8b5ff;color:#fff;">訓練を開始する</button>
        `, { modalMaxWidth:'600px', bodyMaxHeight:'70vh' });
    },

    confirmStartBattle: () => {
        const entry = BossTraining.getEntry(BossTraining.state.trainingId);
        if (!entry || !BossTraining.isEntryUnlocked(entry)) return Menu.msg('対戦相手を確認できません。');
        const difficulty = BossTraining.getDifficulty(BossTraining.state.strengthFloor);
        Menu.confirm(`${BossTraining.getEntryName(entry)}を${difficulty.description}で再現します。\n訓練を開始しますか？`, () => {
            BossTraining.startBattle(entry, difficulty);
        });
    },

    createPartySnapshot: () => (App.data?.party || []).map(uid => {
        const character = App.getChar?.(uid);
        if (!character) return null;
        const stats = App.calcStats?.(character) || {};
        return {
            uid: character.uid,
            currentHp: Math.max(0, Number(character.currentHp ?? stats.maxHp ?? character.hp ?? 0)),
            currentMp: Math.max(0, Number(character.currentMp ?? stats.maxMp ?? character.mp ?? 0))
        };
    }).filter(Boolean),

    startBattle: (entry, difficulty) => {
        if (!entry || !difficulty) return false;
        const monsterIds = entry.monsterIds.map(Number).filter(id => BossTraining.getMonsterMaster(id));
        if (!monsterIds.length) return Menu.msg('訓練用のボスデータが見つかりません。');
        const context = {
            version: 1,
            trainingId: entry.id,
            opponentName: BossTraining.getEntryName(entry),
            monsterIds,
            strengthFloor: Number(difficulty.strengthFloor),
            difficultyId: difficulty.id,
            difficultyLabel: difficulty.label,
            partySnapshot: BossTraining.createPartySnapshot(),
            startedAt: Date.now()
        };
        App.data.battle = {
            active: false,
            isBossBattle: true,
            isSpecialBoss: false,
            isEstark: false,
            fixedBossId: null,
            suppressFixedBossDefeat: true,
            storyBossTraining: context
        };
        App.save();
        Facilities.closeModal('boss-training-scene');
        App.changeScene('battle');
        return true;
    }
};

if (typeof window !== 'undefined') window.BossTraining = BossTraining;
