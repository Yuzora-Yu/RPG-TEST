/* gacha.js (banner-ready platinum gacha + premium card演出) */
const Gacha = {
    queue: [],
    currentIndex: 0,
    isSkipped: false,
    pendingCount: 0,
    currentBannerId: 'platinum',
    pendingBannerId: 'platinum',
    isFlipping: false,
    isRevealed: false,
    tapGuardUntil: 0,
    revealTimer: null,

    cardAssets: {
        back: 'assets/gacha/back_card.png',
        front: 'assets/gacha/front_card.png'
    },

    /*
     * 期間限定ガチャを追加するときは、下の limitedBanners に同じ形の定義を足すだけでOK。
     * active: true かつ開催期間内の場合だけ、ガチャ選択画面に表示されます。
     *
     * 例:
     * {
     *   id: 'spring-2026',
     *   name: '春宵フェス',
     *   tag: '期間限定',
     *   active: true,
     *   startsAt: '2026-05-01T00:00:00+09:00',
     *   endsAt: '2026-05-31T23:59:59+09:00',
     *   desc: '限定仲間をピックアップ。',
     *   pickupIds: [501],
     *   pickupRate: 50,
     *   rates: { N:0, R:45, SR:35, SSR:14, UR:5, EX:1 }
     * }
     */
    baseBanners: [
        {
            id: 'platinum',
            name: 'プラチナガチャ',
            tag: '常設',
            active: true,
            costPerPull: 300,
            desc: '強力な仲間を召喚しよう。UR、EXは超強力！',
            rates: null,
            pool: (c) => c.id < 1000
        }
    ],
    limitedBanners: [],

    rarityMeta: {
        R:   { text: '#d8d8e8', main: '#d8d8e8', soft: 'rgba(216,216,232,0.24)', strong: 'rgba(216,216,232,0.72)', rgb: '216,216,232', className: 'rarity-r' },
        SR:  { text: '#ffd36a', main: '#ffd36a', soft: 'rgba(255,194,78,0.26)', strong: 'rgba(255,194,78,0.78)', rgb: '255,194,78', className: 'rarity-sr' },
        SSR: { text: '#ff8a3d', main: '#ff8a3d', soft: 'rgba(255,138,61,0.30)', strong: 'rgba(255,138,61,0.86)', rgb: '255,138,61', className: 'rarity-ssr' },
        UR:  { text: '#66f6ff', main: '#66f6ff', soft: 'rgba(102,246,255,0.32)', strong: 'rgba(102,246,255,0.92)', rgb: '102,246,255', className: 'rarity-ur' },
        EX:  { text: '#ffe66d', main: '#ffe66d', soft: 'rgba(255,45,90,0.34)', strong: 'rgba(255,230,109,0.95)', rgb: '255,230,109', className: 'rarity-ex' }
    },

    getStars: (r) => {
        const stars = { R: '★★', SR: '★★★', SSR: '★★★★', UR: '★★★★★', EX: '★★★★★★' };
        return stars[r] || '';
    },

    escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch])),

    cssVarsForRarity: (rarity) => {
        const meta = Gacha.rarityMeta[rarity] || Gacha.rarityMeta.R;
        return `--rarity-main:${meta.main}; --rarity-soft:${meta.soft}; --rarity-strong:${meta.strong}; --rarity-rgb:${meta.rgb}; --rarity-text:${meta.text};`;
    },

    getRarityClass: (rarity) => (Gacha.rarityMeta[rarity] || Gacha.rarityMeta.R).className,

    getAllBanners: () => [...Gacha.baseBanners, ...Gacha.limitedBanners],

    isBannerActive: (banner) => {
        if (!banner || banner.active === false) return false;
        const now = Date.now();
        if (banner.startsAt && now < new Date(banner.startsAt).getTime()) return false;
        if (banner.endsAt && now > new Date(banner.endsAt).getTime()) return false;
        return true;
    },

    getActiveBanners: () => Gacha.getAllBanners().filter(Gacha.isBannerActive),

    getBanner: (id = Gacha.currentBannerId) => {
        const banners = Gacha.getActiveBanners();
        return banners.find(b => b.id === id) || banners[0] || Gacha.baseBanners[0];
    },

    getRates: (banner = Gacha.getBanner()) => banner.rates || CONST.GACHA_RATES,

    getPoolForRarity: (rarity, banner = Gacha.getBanner()) => {
        let pool = DB.CHARACTERS.filter(c => c.rarity === rarity);
        if (banner.characterIds) pool = pool.filter(c => banner.characterIds.includes(c.id));
        if (banner.excludeIds) pool = pool.filter(c => !banner.excludeIds.includes(c.id));
        if (typeof banner.pool === 'function') pool = pool.filter(banner.pool);
        else pool = pool.filter(c => c.id < 1000);
        return pool;
    },

    getDisplayInfo: (char) => {
        const master = DB.CHARACTERS.find(m => m.id === char.id || m.id === char.charId);
        const owned = App.data.characters.find(c => c.charId === (char.id || char.charId));
        return {
            master,
            owned,
            displayName: (owned && owned.name) || (master ? master.name : char.name),
            displayImg: (owned && owned.img) || (master ? master.img : char.img || null),
            status: master || char
        };
    },

    countLabel: (count) => count === 1 ? '単発' : `${count}連`,

    init: () => {
        const gachaScreen = document.getElementById('sub-screen-gacha');
        if (gachaScreen) {
            // 重要：sub-screen は #game-container 内の絶対配置で管理する。
            // ここを fixed にすると、ガチャ画面だけでなくゲーム全体のレイアウトが崩れる。
            gachaScreen.style.backgroundColor = '#000';
            gachaScreen.style.backgroundImage = 'none';
            gachaScreen.style.position = 'absolute';
            gachaScreen.style.top = '0';
            gachaScreen.style.left = '0';
            gachaScreen.style.width = '100%';
            gachaScreen.style.height = '100%';
            gachaScreen.style.zIndex = '500';
        }

        const gemEl = document.getElementById('gacha-gem');
        if (gemEl) gemEl.innerText = App.data.gems;

        if (!Gacha.getActiveBanners().some(b => b.id === Gacha.currentBannerId)) {
            Gacha.currentBannerId = 'platinum';
        }
        Gacha.renderBannerList();
		Gacha.switchView('menu');
    },

	switchView: (view) => {
		const map = {
			menu: 'gacha-menu-view',
			detail: 'gacha-detail-view',
			confirm: 'gacha-confirm-view'
		};

		Object.entries(map).forEach(([key, id]) => {
			const el = document.getElementById(id);
			if (el) el.style.display = (view === key ? 'flex' : 'none');
		});

		Gacha.updateBottomButton(view);
	},

    renderBannerList: () => {
        const list = document.getElementById('gacha-banner-list');
        if (!list) return;

        const banners = Gacha.getActiveBanners();
        const platinum = banners.filter(b => b.id === 'platinum');
        const limited = banners.filter(b => b.id !== 'platinum');

        const renderButton = (banner) => `
            <button class="gacha-banner-card ${banner.id === 'platinum' ? 'is-platinum' : 'is-limited'}" onclick="Gacha.selectBanner('${Gacha.escapeHtml(banner.id)}')">
                <span class="gacha-banner-tag">${Gacha.escapeHtml(banner.tag || 'ガチャ')}</span>
                <span class="gacha-banner-name">${Gacha.escapeHtml(banner.name)}</span>
                <span class="gacha-banner-desc">${Gacha.escapeHtml(banner.desc || '')}</span>
            </button>`;

        let html = platinum.map(renderButton).join('');
        if (limited.length > 0) {
            html += `<div class="gacha-banner-section">開催中</div>`;
            html += limited.map(renderButton).join('');
        }
        list.innerHTML = html;
    },

    selectBanner: (id) => {
        Gacha.currentBannerId = id;
        Gacha.renderDetail();
        Gacha.switchView('detail');
    },

    renderDetail: () => {
        const banner = Gacha.getBanner();
        Gacha.currentBannerId = banner.id;

        const title = document.getElementById('gacha-detail-title');
        const desc = document.getElementById('gacha-detail-desc');
        const badge = document.getElementById('gacha-detail-badge');
        const single = document.getElementById('gacha-single-cost');
        const ten = document.getElementById('gacha-ten-cost');

        const cost = banner.costPerPull || 300;
        if (title) title.innerText = banner.name;
        if (desc) desc.innerText = banner.desc || '';
        if (badge) badge.innerText = banner.tag || '';
        if (single) single.innerText = `単発 (${cost} GEM)`;
        if (ten) ten.innerText = `10連 (${cost * 10} GEM)`;
    },

    showRates: (bannerId = Gacha.currentBannerId) => {
        const banner = Gacha.getBanner(bannerId);
        const modal = document.getElementById('modal-rates');
        const content = document.getElementById('rates-content');
        if (!modal || !content) return;

        modal.style.zIndex = 750;
        modal.style.display = 'flex';

        const rates = Gacha.getRates(banner);
        let html = `<h3>${Gacha.escapeHtml(banner.name)} 提供割合</h3>`;
        for (let r of CONST.RARITY.slice().reverse()) {
            if ((rates[r] || 0) > 0) {
                html += `<div>${r}: ${rates[r]}%</div>`;
            }
        }

        const pickups = (banner.pickupIds || [])
            .map(id => DB.CHARACTERS.find(c => c.id === id))
            .filter(Boolean);
        if (pickups.length > 0) {
            html += `<hr><h3>ピックアップ</h3>`;
            pickups.forEach(c => {
                html += `<div style="color:${Gacha.getRarityTextColor(c.rarity)};">[${c.rarity}] ${Gacha.escapeHtml(c.name)} (${Gacha.escapeHtml(c.job)})</div>`;
            });
        }

        html += `<hr><h3>排出対象一覧</h3>`;
        for (let r of CONST.RARITY.slice().reverse()) {
            if ((rates[r] || 0) <= 0) continue;
            const targets = Gacha.getPoolForRarity(r, banner);
            if (targets.length > 0) {
                html += `<div style="margin-top:10px; color:${Gacha.getRarityTextColor(r)}; font-weight:bold;">[${r}]</div>`;
                targets.forEach(c => {
                    const owned = App.data.characters.find(oc => oc.charId === c.id);
                    const displayName = (owned && owned.name) || c.name;
                    html += `<div>${Gacha.escapeHtml(displayName)} (${Gacha.escapeHtml(c.job)})</div>`;
                });
            }
        }
        content.innerHTML = html;
    },

    pull: (count) => {
        const banner = Gacha.getBanner();
        const cost = count * (banner.costPerPull || 300);
        if (App.data.gems < cost) { alert('GEMが足りません'); return; }

        Gacha.pendingCount = count;
        Gacha.pendingBannerId = banner.id;

        const msg = document.getElementById('gacha-confirm-msg');
        if (msg) {
            msg.innerHTML = `
                <div style="color:#ffd700; font-size:18px; margin-bottom:8px;">${Gacha.escapeHtml(banner.name)}</div>
                ${Gacha.countLabel(count)}ガチャ<br>
                消費GEM: <span style="color:#ffd700;">${cost}</span><br>
                よろしいですか？`;
        }
        Gacha.switchView('confirm');
    },

    cancelPull: () => {
        Gacha.switchView('detail');
        Gacha.pendingCount = 0;
    },

    executePull: () => {
        const count = Gacha.pendingCount;
        const banner = Gacha.getBanner(Gacha.pendingBannerId);
        const cost = count * (banner.costPerPull || 300);

        if (App.data.gems < cost) {
            alert('GEMが足りません');
            Gacha.switchView('detail');
            return;
        }

        const wo = document.getElementById('white-out-overlay');
        if (wo) {
            wo.style.transition = 'none';
            wo.style.display = 'block';
            wo.style.opacity = '1';
            wo.style.backgroundColor = '#fff';
            wo.style.zIndex = '9000';
            void wo.offsetWidth;
        }

        App.data.gems -= cost;
        const gemEl = document.getElementById('gacha-gem');
        if (gemEl) gemEl.innerText = App.data.gems;

        Gacha.queue = [];
        Gacha.currentBannerId = banner.id;
        let hasEX = false;
        let hasUR = false;

        for (let i = 0; i < count; i++) {
            const result = Gacha.lottery(banner);
            if (result.rarity === 'EX') { hasEX = true; hasUR = true; }
            if (result.rarity === 'UR') { hasUR = true; }

            const owned = App.data.characters.find(c => c.charId === result.id);
            if (owned) {
                if (typeof App.addLimitBreak === 'function') {
                    App.addLimitBreak(owned, 1, 'gacha');
                } else {
                    owned.limitBreak = Math.min(99, (owned.limitBreak || 0) + 1);
                }
                result.isNew = false;
                result.limitBreak = owned.limitBreak;
            } else {
                const newChar = {
                    uid: 'c' + Date.now() + i,
                    charId: result.id,
                    name: result.name,
                    job: result.job,
                    rarity: result.rarity,
                    hp: result.hp,
                    mp: result.mp,
                    atk: result.atk,
                    def: result.def,
                    spd: result.spd,
                    mag: result.mag,
                    mdef: result.mdef,
                    level: 1,
                    limitBreak: 0,
                    lbProgress: {
                        counters: { battleWins: 0 },
                        sources: { story: 0, battle: 0, dungeon: 0, quest: 0, boss: 0, prism: 0, random: 0, gacha: 0, trial: 0, legacy: 0 },
                        trials: { mid: false, final: false, midClearedAt: null, finalClearedAt: null }
                    },
                    equips: {},
                    traits: [],
                    disabledTraits: [],
                    sp: result.sp || 1,
                    weaponTypes: result.weaponTypes || [],
                    weaponType: result.weaponType || '素手'
                };

                if (typeof PassiveSkill !== 'undefined' && PassiveSkill.applyLevelUpTraits) {
                    PassiveSkill.applyLevelUpTraits(newChar);
                }

                App.data.characters.push(newChar);
                result.isNew = true;
                result.limitBreak = 0;
            }
            Gacha.queue.push(result);
        }

        App.save();
        Gacha.switchView('none');
        Gacha.playWhiteFlash(hasEX, hasUR, count);
    },

    lottery: (banner = Gacha.getBanner()) => {
        const rates = Gacha.getRates(banner);
        const r = Math.random() * 100;
        let current = 0;
        let selectedRarity = 'R';

        for (let rarity of CONST.RARITY) {
            const rate = rates[rarity] || 0;
            if (r < current + rate) { selectedRarity = rarity; break; }
            current += rate;
        }

        let pool = Gacha.getPoolForRarity(selectedRarity, banner);
        const pickups = pool.filter(c => (banner.pickupIds || []).includes(c.id));
        if (pickups.length > 0 && Math.random() * 100 < (banner.pickupRate ?? 50)) {
            pool = pickups;
        }

        if (pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            return JSON.parse(JSON.stringify(pick));
        }
        return JSON.parse(JSON.stringify(DB.CHARACTERS[0]));
    },

    playWhiteFlash: (hasEX, hasUR, count) => {
        const wo = document.getElementById('white-out-overlay');
        const flash = document.getElementById('flash-overlay');
        const gachaScreen = document.getElementById('sub-screen-gacha');
        const performanceArea = document.getElementById('gacha-performance');
        const stage = document.getElementById('gacha-stage');
        if (!wo || !performanceArea || !stage) return;

        // フィールド画面の透け防止：ガチャメニューは背面に残し、演出面を前面の不透明レイヤーにする。
        if (gachaScreen) {
            gachaScreen.style.display = 'flex';
            gachaScreen.style.backgroundColor = '#000';
            gachaScreen.style.zIndex = '500';
        }

        performanceArea.style.display = 'flex';
        performanceArea.style.zIndex = '800';
        performanceArea.style.pointerEvents = 'none';
        performanceArea.style.background = '#020208';
        performanceArea.classList.remove('gacha-revealed');
        performanceArea.classList.add('gacha-showcase');
        stage.innerHTML = '';

        wo.classList.remove('black-turn');
        wo.style.transition = 'none';
        wo.style.display = 'block';
        wo.style.zIndex = 9000;
        wo.style.opacity = 1;
        wo.style.backgroundColor = '#fff';
        void wo.offsetWidth;

        if (count >= 10 && hasUR && Math.random() < 0.1) {
            setTimeout(() => {
                if (flash) {
                    flash.style.display = 'block';
                    flash.className = 'flash-multiple';
                    setTimeout(() => { flash.style.display = 'none'; flash.className = ''; }, 800);
                }
            }, 300);
        }

        if (hasEX) {
            setTimeout(() => { wo.classList.add('black-turn'); }, 200);
        }

        setTimeout(() => {
            Gacha.currentIndex = 0;
            Gacha.isSkipped = false;
            Gacha.isFlipping = false;
            Gacha.isRevealed = false;
            Gacha.tapGuardUntil = Date.now() + 250;
            Gacha.drawNextCard();

            performanceArea.style.pointerEvents = 'auto';
            wo.style.transition = 'opacity 0.8s ease';
            wo.style.opacity = 0;
            setTimeout(() => {
                wo.style.display = 'none';
                wo.classList.remove('black-turn');
                wo.style.zIndex = 6000;
            }, 800);
        }, hasEX ? 1600 : 650);
    },

    buildPremiumFrontFace: (char, options = {}) => {
        const info = Gacha.getDisplayInfo(char);
        const rarity = char.rarity || 'R';
        const rarityClass = Gacha.getRarityClass(rarity);
        const vars = Gacha.cssVarsForRarity(rarity);
        const displayName = Gacha.escapeHtml(info.displayName);
        const displayJob = Gacha.escapeHtml(char.job || (info.master && info.master.job) || '');
        const limitBreak = Number(char.limitBreak || 0);
        const lbSuffix = (!char.isNew && limitBreak > 0)
            ? `<span class="gacha-lb-plus"> +${Gacha.escapeHtml(limitBreak)}</span>`
            : '';
        const img = info.displayImg
            ? `<img class="gacha-card-character" src="${info.displayImg}" alt="">`
            : `<div class="gacha-card-silhouette">?</div>`;
        const newBadge = char.isNew ? `<div class="gacha-new-stamp">NEW</div>` : '';

        return `
            <div class="card-face card-front premium-card-front ${rarityClass}" style="${vars}">
                <div class="gacha-card-backdrop"></div>
                <div class="gacha-card-rarity-aura"></div>
                <div class="gacha-character-window">
                    <div class="gacha-summon-circle"></div>
                    ${img}
                </div>
                <img class="gacha-card-template" src="${Gacha.cardAssets.front}" alt="">
                <div class="gacha-card-rarity">${Gacha.escapeHtml(rarity)}</div>
                <div class="gacha-card-stars">${Gacha.escapeHtml(Gacha.getStars(rarity))}</div>
                <div class="gacha-card-name"><span class="gacha-card-name-text">${displayName}</span>${lbSuffix}</div>
                <div class="gacha-card-job">${displayJob}</div>
                ${newBadge}
                <div class="gacha-card-foil"></div>
            </div>`;
    },

    buildPremiumCardHtml: (char) => {
        const rarity = char.rarity || 'R';
        const rarityClass = Gacha.getRarityClass(rarity);
        const vars = Gacha.cssVarsForRarity(rarity);
        return `
            <div class="card-face card-back premium-card-back ${rarityClass}" style="${vars}">
                <div class="gacha-back-aura"></div>
                <img class="gacha-card-template" src="${Gacha.cardAssets.back}" alt="">
                <div class="gacha-back-core"></div>
                <div class="gacha-back-shine"></div>
                <div class="gacha-back-hint">TOUCH</div>
            </div>
            ${Gacha.buildPremiumFrontFace(char)}`;
    },

    removePremiumCssFrame: (root) => {
        if (!root || !root.querySelectorAll) return;
        root.querySelectorAll('.gacha-card-scene.premium-card .card-face, .gacha-card-scene.premium-card .premium-card-front, .gacha-card-scene.premium-card .premium-card-back, .gacha-card-scene.premium-card .gacha-card-template').forEach(el => {
            el.style.setProperty('border', '0', 'important');
            el.style.setProperty('border-color', 'transparent', 'important');
            el.style.setProperty('outline', '0', 'important');
            el.style.setProperty('box-shadow', 'none', 'important');
        });
    },

    drawNextCard: () => {
        if (Gacha.isSkipped) return;
        if (Gacha.currentIndex >= Gacha.queue.length) { Gacha.finish(); return; }

        const char = Gacha.queue[Gacha.currentIndex];
        const performanceArea = document.getElementById('gacha-performance');
        const stage = document.getElementById('gacha-stage');
        const flash = document.getElementById('flash-overlay');
        if (!performanceArea || !stage) return;

        if (Gacha.revealTimer) {
            clearTimeout(Gacha.revealTimer);
            Gacha.revealTimer = null;
        }

        Gacha.isFlipping = false;
        Gacha.isRevealed = false;
        Gacha.tapGuardUntil = Date.now() + 220;

        stage.onclick = null;
        stage.innerHTML = `
            <div class="gacha-stage-bg"></div>
            <div class="gacha-stage-vortex"></div>
            <div class="gacha-stage-particles"></div>
            <div class="gacha-tap-guide">カードをタップ</div>`;

        performanceArea.style.display = 'flex';
        performanceArea.style.pointerEvents = 'auto';
        performanceArea.style.transition = 'none';
        performanceArea.style.background = '#020208';
        performanceArea.classList.remove('confirmed', 'gacha-showcase', 'gacha-revealed', 'gacha-rarity-r', 'gacha-rarity-sr', 'gacha-rarity-ssr', 'gacha-rarity-ur', 'gacha-rarity-ex');
        performanceArea.classList.add('gacha-showcase', `gacha-rarity-${String(char.rarity || 'r').toLowerCase()}`);
        setTimeout(() => { performanceArea.style.transition = 'background 0.8s ease-in-out'; }, 50);

        const card = document.createElement('div');
        card.className = `gacha-card-scene premium-card ${Gacha.getRarityClass(char.rarity)}`;
        card.classList.remove('flipped', 'revealed');
        card.innerHTML = Gacha.buildPremiumCardHtml(char);
        stage.appendChild(card);
        Gacha.removePremiumCssFrame(stage);

        const isURorEX = ['UR', 'EX'].includes(char.rarity);
        const isStealth = isURorEX && Math.random() < 0.12;

        const revealCard = () => {
            if (Gacha.isFlipping || Gacha.isRevealed) return;
            Gacha.isFlipping = true;
            Gacha.tapGuardUntil = Date.now() + 900;

            const guide = stage.querySelector('.gacha-tap-guide');
            if (guide) guide.textContent = '召喚中...';

            const shouldFlash = isURorEX && isStealth;
            if (flash && shouldFlash) {
                flash.style.display = 'block';
                flash.className = 'flash-multiple';
                setTimeout(() => { if (flash) { flash.style.display = 'none'; flash.className = ''; } }, 800);
            }

            const delay = shouldFlash ? 520 : 90;
            Gacha.revealTimer = setTimeout(() => {
                performanceArea.classList.add('gacha-revealed');
                // entrance animation の fill-mode が transform を握ったままだと
                // .flipped の rotateY が効かないため、反転直前に明示的に解除する。
                card.style.animation = 'none';
                card.classList.add('flipped', 'revealed');
                Gacha.revealTimer = setTimeout(() => {
                    Gacha.isFlipping = false;
                    Gacha.isRevealed = true;
                    Gacha.tapGuardUntil = Date.now() + 160;
                    const guideAfter = stage.querySelector('.gacha-tap-guide');
                    if (guideAfter) guideAfter.textContent = (Gacha.currentIndex < Gacha.queue.length - 1) ? 'タップで次へ' : 'タップで結果へ';
                }, 300);
            }, delay);
        };

        const goNext = () => {
            if (!Gacha.isRevealed || Gacha.isFlipping) return;
            Gacha.isRevealed = false;
            Gacha.tapGuardUntil = Date.now() + 220;
            Gacha.currentIndex++;
            Gacha.drawNextCard();
        };

        const handleStageTap = (e) => {
            if (e && e.target && e.target.closest && e.target.closest('#btn-gacha-skip')) return;
            // touchstart で preventDefault しない。
            // Chrome の cancelable=false 警告を避けつつ、スマホでは pointerdown で即反応させる。
            if (Date.now() < Gacha.tapGuardUntil) return;
            if (!Gacha.isRevealed) revealCard();
            else goNext();
        };

        // タップ反転は stage と card の両方で受ける。
        // addEventListener の touch 系ではなく onpointerdown/onclick に寄せることで、
        // cancelable=false 警告と「タップしても反転しない」取りこぼしを避ける。
        const safeTap = (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            handleStageTap(e);
        };
        stage.onclick = safeTap;
        card.onclick = safeTap;
        if (window.PointerEvent) {
            stage.onpointerdown = safeTap;
            card.onpointerdown = safeTap;
        }
    },

    skip: (e) => {
        if (e) e.stopPropagation();
        if (Gacha.revealTimer) { clearTimeout(Gacha.revealTimer); Gacha.revealTimer = null; }
        Gacha.isSkipped = true;
        Gacha.isFlipping = false;
        Gacha.isRevealed = false;
        Gacha.finish();
    },

    buildStatsPanel: (char) => {
        const { status } = Gacha.getDisplayInfo(char);
        return `
            <div class="gacha-single-stats">
                <div><span>HP</span><b>${status.hp || 0}</b></div>
                <div><span>MP</span><b>${status.mp || 0}</b></div>
                <div><span>攻撃</span><b>${status.atk || 0}</b></div>
                <div><span>守備</span><b>${status.def || 0}</b></div>
                <div><span>素早</span><b>${status.spd || 0}</b></div>
                <div><span>魔力</span><b>${status.mag || 0}</b></div>
            </div>`;
    },

    finish: () => {
        const performanceArea = document.getElementById('gacha-performance');
        const overlay = document.getElementById('gacha-result-overlay');
        const flash = document.getElementById('flash-overlay');
        if (!performanceArea || !overlay) return;

        if (flash) { flash.style.display = 'none'; flash.className = ''; }
        if (Gacha.revealTimer) { clearTimeout(Gacha.revealTimer); Gacha.revealTimer = null; }
        const stage = document.getElementById('gacha-stage');
        if (stage) stage.onclick = null;

        performanceArea.style.transition = 'none';
        performanceArea.classList.remove('confirmed', 'gacha-showcase', 'gacha-revealed', 'gacha-rarity-r', 'gacha-rarity-sr', 'gacha-rarity-ssr', 'gacha-rarity-ur', 'gacha-rarity-ex');
        performanceArea.style.background = '#000';
        performanceArea.style.display = 'none';
        overlay.style.zIndex = '900';
        overlay.style.display = 'flex';

        const list = document.getElementById('gacha-results-list');
        list.innerHTML = '';

        if (Gacha.queue.length === 1) {
            const c = Gacha.queue[0];
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.alignItems = 'center';
            list.style.justifyContent = 'center';
            list.style.width = '100%';
            list.style.gap = '14px';
            list.classList.add('single-result-mode');

            list.innerHTML = `
                <div class="gacha-single-result ${Gacha.getRarityClass(c.rarity)}" style="${Gacha.cssVarsForRarity(c.rarity)}">
                    <div class="gacha-card-scene premium-card premium-card-static ${Gacha.getRarityClass(c.rarity)}">
                        ${Gacha.buildPremiumFrontFace(c)}
                    </div>
                    ${Gacha.buildStatsPanel(c)}
                </div>`;
            Gacha.removePremiumCssFrame(list);
        } else {
            list.classList.remove('single-result-mode');
            list.style.display = 'grid';
            list.style.flexDirection = '';
            list.style.alignItems = '';
            list.style.justifyContent = '';
            list.style.gap = '10px 5px';
            list.style.width = '';

            Gacha.queue.forEach(c => {
                const { status, displayName, displayImg } = Gacha.getDisplayInfo(c);
                const thumbHtml = displayImg
                    ? `<img src="${displayImg}" style="width:100%; height:100%; object-fit:cover; border-radius:3px; background:transparent;">`
                    : '';

                const div = document.createElement('div');
                div.className = 'gacha-result-card';
                if (c.rarity === 'UR') div.classList.add('style-aurora');
                else if (c.rarity === 'EX') div.classList.add('style-majestic');
                if (c.rarity === 'SSR') div.classList.add('result-glow');
                div.style.overflow = 'visible';

                div.innerHTML = `
                    <div style="margin-top:5px; color:#ffd700; font-size:8px; margin-bottom:1px; font-weight:bold; text-shadow:1px 1px 0px #000;">${Gacha.getStars(c.rarity)}</div>
                    <div style="margin-top:2px; color:${Gacha.getRarityTextColor(c.rarity)}; font-weight:bold; text-shadow:1px 1px 0px #000; font-size:11px;">${c.rarity}</div>
                    <div class="thumb" style="background:transparent; border:1px solid rgba(255,255,255,0.1); border-radius:4px; margin:4px auto; width:40px; height:40px; overflow:hidden; display:flex; align-items:center; justify-content:center;">${thumbHtml}</div>
                    <div style="font-size:9px; overflow:hidden; white-space:nowrap; width:100%; font-weight:bold; color:#fff;">${Gacha.escapeHtml(displayName)}</div>
                    ${c.isNew ? '<span class="new-badge">NEW</span>' : `<span style="font-size:8px; color:#ffd978;">+${c.limitBreak || 1}</span>`}
                    <div style="margin-top:5px; font-size:8px; margin-top:2px; line-height:1.3; color:#eee;">
                        HP:${status.hp || 0}<br>MP:${status.mp || 0}<br>攻:${status.atk || 0}<br>防:${status.def || 0}<br>速:${status.spd || 0}<br>魔:${status.mag || 0}
                    </div>`;
                list.appendChild(div);
            });
        }

        const retry = document.getElementById('btn-gacha-retry');
        const gem = document.getElementById('result-gem-display');
        if (retry) retry.innerText = `${Gacha.countLabel(Gacha.pendingCount)}リトライ`;
        if (gem) gem.innerText = App.data.gems;
    },

    retryPull: () => {
        const resultOverlay = document.getElementById('gacha-result-overlay');
        if (resultOverlay) resultOverlay.style.display = 'none';
        Gacha.executePull();
    },

    closeResult: () => {
        const resultOverlay = document.getElementById('gacha-result-overlay');
        const subScreen = document.getElementById('sub-screen-gacha');
        if (resultOverlay) resultOverlay.style.display = 'none';
        if (subScreen) subScreen.style.display = 'flex';
        Gacha.init();

        const fieldGemDisp = document.getElementById('disp-gem');
        if (fieldGemDisp) fieldGemDisp.innerText = App.data.gems;
        if (typeof Menu !== 'undefined') Menu.renderPartyBar();
    },

    getRarityColor: (r) => {
        if (r === 'R') return '#444';
        if (r === 'SR') return '#664400';
        if (r === 'SSR') return '#800';
        if (r === 'UR') return '#404';
        if (r === 'EX') return '#000';
        return '#333';
    },

    getRarityTextColor: (r) => {
        const meta = Gacha.rarityMeta[r];
        return meta ? meta.text : '#fff';
    },
	
	updateBottomButton: (view) => {
		const panel = document.getElementById('gacha-bottom-panel');
		const btn = document.getElementById('gacha-bottom-back-btn');
		if (!panel || !btn) return;

		panel.style.display = (view === 'none') ? 'none' : 'flex';
		btn.innerText = 'もどる';

		if (view === 'detail') {
			btn.onclick = () => Gacha.switchView('menu');
		} else if (view === 'confirm') {
			btn.onclick = () => Gacha.cancelPull();
		} else {
			btn.onclick = () => Menu.closeSubScreen('gacha');
		}
	}
};
