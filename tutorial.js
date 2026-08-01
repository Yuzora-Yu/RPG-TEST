/* ========================================================================== 
   Prisma Abyss Tutorial Modal
   --------------------------------------------------------------------------
   - ゲーム進行側からは TutorialModal.open('tutorial-id') で呼び出せます。
   - 一覧やページ内容は TUTORIAL_DATA を編集してください。
   - 画像は assets/tutorial/0001.png のように管理する想定です。
   ========================================================================== */
(() => {
    'use strict';

    const TUTORIAL_DATA = [
        {
            id: 'adventure-basics',
            title: '冒険の基本',
            description: '目的地、マップ、メニューの基本操作',
            pages: [
                {
                    title: '冒険の始まり！',
                    image: 'assets/tutorial/0001.png',
                    imageAlt: 'フィールド画面とミニレーダーの説明',
                    body: 'さあ、いよいよ冒険の始まりだ！\n\n「ミニレーダー」の「目的地」を目指そう！'
                },
                {
                    title: 'マップを活用しよう',
                    image: 'assets/tutorial/0002.png',
                    imageAlt: 'ワールドマップの説明',
                    body: 'ミニレーダーで大体の方角をつかみ、詳細なマップで現在地や目的地を確認しよう。\n\n遺跡や洞窟の探索では特に便利だぞ！'
                },
                {
                    title: 'メニューで準備を整えよう！',
                    image: 'assets/tutorial/0003.png',
                    imageAlt: 'メニュー画面の説明',
                    body: 'メニューでは所持品や装備、仲間の状態、各種設定を確認できる。\n\n一度見たチュートリアルも「お知らせ ＞ チュートリアル」から見返せるぞ！'
                }
            ]
        },
        {
            id: 'battle-basics',
            title: '戦闘の基本',
            description: 'コマンド、対象選択、AUTOの使い方',
            pages: [
                {
                    title: 'コマンドを選ぼう',
                    image: 'assets/tutorial/0011.png',
                    imageAlt: '戦闘コマンドの説明',
                    body: '行動する仲間のコマンドを選び、攻撃や回復の対象を決めよう。\n\n迷った時は通常攻撃から試すのがおすすめだ。'
                },
                {
                    title: 'スキルを使いこなそう',
                    image: 'assets/tutorial/0012.png',
                    imageAlt: '戦闘スキルの説明',
                    body: 'スキルはMPを消費する代わりに、強力な攻撃や回復などの効果を発揮する。\n\n消費MPと対象範囲を確認して使おう。'
                },
                {
                    title: 'AUTOと作戦',
                    image: 'assets/tutorial/0013.png',
                    imageAlt: 'AUTO戦闘と作戦の説明',
                    body: 'AUTOを使うと、仲間が設定された作戦に従って行動する。\n\n周回する時は戦闘速度もあわせて調整しよう。'
                }
            ]
        },
        {
            id: 'dungeon-basics',
            title: 'ダンジョン探索',
            description: '階段、宝箱、鍵、脱出の基本',
            pages: [
                {
                    title: '階層を探索しよう',
                    image: 'assets/tutorial/0021.png',
                    imageAlt: 'ダンジョン探索の説明',
                    body: 'ダンジョンでは階段を見つけて次の階層へ進もう。\n\n移動中に魔物と遭遇することがあるため、残りHPにも注意しよう。'
                },
                {
                    title: '宝箱と鍵',
                    image: 'assets/tutorial/0022.png',
                    imageAlt: '宝箱と鍵の説明',
                    body: '宝箱や扉には鍵が必要な場合がある。\n\n同じ色の鍵を手に入れたら、対応する場所を探してみよう。'
                },
                {
                    title: '危険なら脱出しよう',
                    image: 'assets/tutorial/0023.png',
                    imageAlt: 'ダンジョン脱出の説明',
                    body: '探索を続けるのが危険な時は、メニューから脱出できる。\n\nボス戦など、脱出できない場面へ進む前には準備を整えよう。'
                }
            ]
        },
        {
            id: 'equipment-growth',
            title: '装備と育成',
            description: '装備変更、能力比較、スキル育成',
            pages: [
                {
                    title: '装備を変更しよう',
                    image: 'assets/tutorial/0031.png',
                    imageAlt: '装備変更画面の説明',
                    body: '新しい装備を手に入れたら、装備画面で現在の装備と比較しよう。\n\n能力値だけでなく、装備に付いた効果も重要だ。'
                },
                {
                    title: '仲間の役割を考えよう',
                    image: 'assets/tutorial/0032.png',
                    imageAlt: 'パーティ編成の説明',
                    body: '前衛・後衛や仲間の得意分野を考えて編成しよう。\n\n強敵に苦戦した時は、装備と作戦を見直すのも有効だ。'
                },
                {
                    title: 'スキルを育てよう',
                    image: 'assets/tutorial/0033.png',
                    imageAlt: 'スキル育成画面の説明',
                    body: '獲得したSPを使って、仲間の能力やスキルを育てられる。\n\n未使用のSPがたまっていないか定期的に確認しよう。'
                }
            ]
        }
    ];

    const TutorialModal = {
        tutorials: [],
        currentTutorialId: null,
        currentPageIndex: 0,
        lastFocusedElement: null,
        previousBodyOverflow: '',
        previousHtmlOverflow: '',
        keydownHandler: null,
        resizeHandler: null,
        viewportResizeHandler: null,

        init() {
            this.registerMany(TUTORIAL_DATA);
            this.ensureStyles();
            this.ensureDOM();
            return this;
        },

        register(tutorial) {
            if (!tutorial || typeof tutorial.id !== 'string' || !tutorial.id.trim()) {
                console.warn('[TutorialModal] id がないチュートリアルは登録できません。', tutorial);
                return false;
            }
            if (!Array.isArray(tutorial.pages) || tutorial.pages.length === 0) {
                console.warn(`[TutorialModal] ${tutorial.id} にページがありません。`);
                return false;
            }

            const normalized = {
                id: tutorial.id.trim(),
                title: String(tutorial.title || 'チュートリアル'),
                description: String(tutorial.description || ''),
                pages: tutorial.pages.map((page, index) => ({
                    title: String(page?.title || `${index + 1}ページ`),
                    image: String(page?.image || ''),
                    imageAlt: String(page?.imageAlt || page?.title || 'チュートリアル画像'),
                    body: String(page?.body || '')
                }))
            };

            const existingIndex = this.tutorials.findIndex(item => item.id === normalized.id);
            if (existingIndex >= 0) this.tutorials.splice(existingIndex, 1, normalized);
            else this.tutorials.push(normalized);
            return true;
        },

        registerMany(tutorials) {
            (Array.isArray(tutorials) ? tutorials : []).forEach(tutorial => this.register(tutorial));
            return this;
        },

        getTutorials() {
            return this.tutorials.map(tutorial => ({
                id: tutorial.id,
                title: tutorial.title,
                description: tutorial.description,
                pageCount: tutorial.pages.length
            }));
        },

        getTutorial(id) {
            return this.tutorials.find(tutorial => tutorial.id === id) || null;
        },

        open(id, startPage = 0) {
            const tutorial = this.getTutorial(id);
            if (!tutorial) {
                console.warn(`[TutorialModal] チュートリアルが見つかりません: ${id}`);
                if (typeof Menu !== 'undefined' && typeof Menu.msg === 'function') {
                    Menu.msg('チュートリアルを読み込めませんでした。');
                }
                return false;
            }

            this.ensureStyles();
            const root = this.ensureDOM();
            this.currentTutorialId = tutorial.id;
            this.currentPageIndex = this.clampPageIndex(startPage, tutorial.pages.length);
            this.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

            this.previousBodyOverflow = document.body.style.overflow;
            this.previousHtmlOverflow = document.documentElement.style.overflow;
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';

            root.hidden = false;
            root.setAttribute('aria-hidden', 'false');
            this.syncPanelWidth();
            this.installResizeControls();
            this.render();
            this.installKeyboardControls();

            const closeButton = document.getElementById('tutorial-modal-close-top');
            if (closeButton) window.requestAnimationFrame(() => closeButton.focus());
            return true;
        },

        close() {
            const root = document.getElementById('tutorial-modal-root');
            if (!root || root.hidden) return;

            root.hidden = true;
            root.setAttribute('aria-hidden', 'true');
            this.removeKeyboardControls();
            this.removeResizeControls();
            root.style.removeProperty('--tutorial-modal-panel-width');
            document.body.style.overflow = this.previousBodyOverflow;
            document.documentElement.style.overflow = this.previousHtmlOverflow;

            const focusTarget = this.lastFocusedElement;
            this.lastFocusedElement = null;
            if (focusTarget && document.contains(focusTarget) && typeof focusTarget.focus === 'function') {
                window.requestAnimationFrame(() => focusTarget.focus());
            }
        },

        move(direction) {
            const tutorial = this.getTutorial(this.currentTutorialId);
            if (!tutorial) return;
            const nextIndex = this.currentPageIndex + Number(direction || 0);
            if (nextIndex < 0 || nextIndex >= tutorial.pages.length) return;
            this.currentPageIndex = nextIndex;
            this.render();
        },

        goTo(pageIndex) {
            const tutorial = this.getTutorial(this.currentTutorialId);
            if (!tutorial) return;
            this.currentPageIndex = this.clampPageIndex(pageIndex, tutorial.pages.length);
            this.render();
        },

        clampPageIndex(pageIndex, pageCount) {
            const value = Number.isFinite(Number(pageIndex)) ? Math.floor(Number(pageIndex)) : 0;
            return Math.max(0, Math.min(Math.max(0, pageCount - 1), value));
        },

        ensureDOM() {
            let root = document.getElementById('tutorial-modal-root');
            if (root) return root;

            root = document.createElement('div');
            root.id = 'tutorial-modal-root';
            root.className = 'tutorial-modal';
            root.hidden = true;
            root.setAttribute('aria-hidden', 'true');
            root.innerHTML = `
                <section
                    class="tutorial-modal__panel"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tutorial-modal-page-title"
                    aria-describedby="tutorial-modal-description"
                >
                    <header class="tutorial-modal__header">
                        <div class="tutorial-modal__heading-wrap">
                            <div id="tutorial-modal-series-title" class="tutorial-modal__series-title"></div>
                            <h2 id="tutorial-modal-page-title" class="tutorial-modal__page-title"></h2>
                        </div>
                        <button
                            id="tutorial-modal-close-top"
                            class="tutorial-modal__icon-close"
                            type="button"
                            aria-label="チュートリアルを閉じる"
                        >×</button>
                    </header>

                    <div id="tutorial-modal-scroll" class="tutorial-modal__scroll">
                        <div class="tutorial-modal__image-frame">
                            <img id="tutorial-modal-image" class="tutorial-modal__image" alt="">
                            <div id="tutorial-modal-image-placeholder" class="tutorial-modal__image-placeholder" hidden>
                                <span class="tutorial-modal__image-placeholder-title">TUTORIAL IMAGE</span>
                                <span id="tutorial-modal-image-path" class="tutorial-modal__image-path"></span>
                            </div>
                        </div>
                        <div id="tutorial-modal-description" class="tutorial-modal__description"></div>
                    </div>

                    <footer class="tutorial-modal__footer">
                        <div class="tutorial-modal__navigation">
                            <button id="tutorial-modal-prev" class="tutorial-modal__nav-button" type="button">◀ 前へ</button>
                            <div class="tutorial-modal__progress-wrap">
                                <div id="tutorial-modal-dots" class="tutorial-modal__dots" aria-label="ページ選択"></div>
                                <div id="tutorial-modal-page-count" class="tutorial-modal__page-count"></div>
                            </div>
                            <button id="tutorial-modal-next" class="tutorial-modal__nav-button" type="button">次へ ▶</button>
                        </div>
                        <button id="tutorial-modal-close-bottom" class="tutorial-modal__close-bottom" type="button">閉じる</button>
                    </footer>
                </section>
            `;

            document.body.appendChild(root);
            document.getElementById('tutorial-modal-close-top')?.addEventListener('click', () => this.close());
            document.getElementById('tutorial-modal-close-bottom')?.addEventListener('click', () => this.close());
            document.getElementById('tutorial-modal-prev')?.addEventListener('click', () => this.move(-1));
            document.getElementById('tutorial-modal-next')?.addEventListener('click', () => this.move(1));
            return root;
        },

        render() {
            const tutorial = this.getTutorial(this.currentTutorialId);
            if (!tutorial) return;

            const page = tutorial.pages[this.currentPageIndex];
            const pageCount = tutorial.pages.length;
            const image = document.getElementById('tutorial-modal-image');
            const placeholder = document.getElementById('tutorial-modal-image-placeholder');
            const imagePath = document.getElementById('tutorial-modal-image-path');
            const scroll = document.getElementById('tutorial-modal-scroll');

            document.getElementById('tutorial-modal-series-title').textContent = tutorial.title;
            document.getElementById('tutorial-modal-page-title').textContent = page.title;
            document.getElementById('tutorial-modal-description').textContent = page.body;
            document.getElementById('tutorial-modal-page-count').textContent = `${this.currentPageIndex + 1} / ${pageCount}`;

            if (image && placeholder && imagePath) {
                image.onload = () => {
                    image.hidden = false;
                    placeholder.hidden = true;
                };
                image.onerror = () => {
                    image.hidden = true;
                    placeholder.hidden = false;
                    imagePath.textContent = page.image || '画像パス未設定';
                };
                image.alt = page.imageAlt;
                image.hidden = !page.image;
                placeholder.hidden = Boolean(page.image);
                imagePath.textContent = page.image || '画像パス未設定';

                if (page.image) {
                    image.src = '';
                    image.src = page.image;
                } else {
                    image.removeAttribute('src');
                    placeholder.hidden = false;
                }
            }

            const prev = document.getElementById('tutorial-modal-prev');
            const next = document.getElementById('tutorial-modal-next');
            if (prev) prev.disabled = this.currentPageIndex <= 0;
            if (next) next.disabled = this.currentPageIndex >= pageCount - 1;

            const dots = document.getElementById('tutorial-modal-dots');
            if (dots) {
                dots.replaceChildren();
                tutorial.pages.forEach((dotPage, index) => {
                    const dot = document.createElement('button');
                    dot.type = 'button';
                    dot.className = `tutorial-modal__dot${index === this.currentPageIndex ? ' is-active' : ''}`;
                    dot.setAttribute('aria-label', `${index + 1}ページ目: ${dotPage.title}`);
                    dot.setAttribute('aria-current', index === this.currentPageIndex ? 'page' : 'false');
                    dot.addEventListener('click', () => this.goTo(index));
                    dots.appendChild(dot);
                });
            }

            if (scroll) scroll.scrollTop = 0;
        },

        getParentSurface() {
            const focused = this.lastFocusedElement;
            if (focused && typeof focused.closest === 'function') {
                const focusedSurface = focused.closest('.sub-screen, .scene-layer, #menu-screen, #main-menu, #game-container');
                if (focusedSurface) return focusedSurface;
            }
            return document.getElementById('game-container')
                || document.querySelector('.game-container')
                || null;
        },

        syncPanelWidth() {
            const root = document.getElementById('tutorial-modal-root');
            if (!root) return;

            // スマホでは従来どおり、画面端から約10pxずつ空けた全幅表示にする。
            const isDesktop = typeof window.matchMedia === 'function'
                ? window.matchMedia('(min-width: 601px)').matches
                : window.innerWidth >= 601;
            if (!isDesktop) {
                root.style.removeProperty('--tutorial-modal-panel-width');
                return;
            }

            // PCではゲーム本体・現在の親メニュー幅を上限にし、その内側に左右10pxの余白を残す。
            const surface = this.getParentSurface();
            const surfaceWidth = surface?.getBoundingClientRect?.().width || 450;
            const viewportWidth = window.visualViewport?.width || window.innerWidth || surfaceWidth;
            const panelWidth = Math.max(240, Math.floor(Math.min(surfaceWidth, viewportWidth) - 20));
            root.style.setProperty('--tutorial-modal-panel-width', `${panelWidth}px`);
        },

        installResizeControls() {
            this.removeResizeControls();
            this.resizeHandler = () => this.syncPanelWidth();
            window.addEventListener('resize', this.resizeHandler, { passive: true });

            if (window.visualViewport) {
                this.viewportResizeHandler = () => this.syncPanelWidth();
                window.visualViewport.addEventListener('resize', this.viewportResizeHandler, { passive: true });
            }
        },

        removeResizeControls() {
            if (this.resizeHandler) {
                window.removeEventListener('resize', this.resizeHandler);
                this.resizeHandler = null;
            }
            if (this.viewportResizeHandler && window.visualViewport) {
                window.visualViewport.removeEventListener('resize', this.viewportResizeHandler);
                this.viewportResizeHandler = null;
            }
        },

        installKeyboardControls() {
            this.removeKeyboardControls();
            this.keydownHandler = event => {
                const root = document.getElementById('tutorial-modal-root');
                if (!root || root.hidden) return;

                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.close();
                    return;
                }
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    this.move(-1);
                    return;
                }
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    this.move(1);
                    return;
                }
                if (event.key !== 'Tab') return;

                const focusable = [...root.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
                    .filter(element => !element.hidden && element.getClientRects().length > 0);
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            };
            document.addEventListener('keydown', this.keydownHandler);
        },

        removeKeyboardControls() {
            if (!this.keydownHandler) return;
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        },

        ensureStyles() {
            if (document.getElementById('tutorial-modal-styles')) return;
            const style = document.createElement('style');
            style.id = 'tutorial-modal-styles';
            style.textContent = `
                .tutorial-modal,
                .tutorial-modal * {
                    box-sizing: border-box;
                }

                .tutorial-modal[hidden] {
                    display: none !important;
                }

                .tutorial-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 40000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding-top: max(10px, env(safe-area-inset-top));
                    padding-right: max(10px, env(safe-area-inset-right));
                    padding-bottom: max(10px, env(safe-area-inset-bottom));
                    padding-left: max(10px, env(safe-area-inset-left));
                    background: rgba(3, 5, 9, 0.88);
                    overscroll-behavior: contain;
                    touch-action: pan-y;
                }

                .tutorial-modal__panel {
                    width: min(100%, 560px);
                    height: 100%;
                    min-height: 0;
                    display: grid;
                    grid-template-rows: auto minmax(0, 1fr) auto;
                    overflow: hidden;
                    color: #282515;
                    background:
                        linear-gradient(rgba(249, 242, 197, 0.96), rgba(239, 229, 178, 0.98)),
                        repeating-linear-gradient(0deg, rgba(95, 75, 30, 0.025) 0 1px, transparent 1px 4px);
                    border: 2px solid #c6b574;
                    border-radius: 12px;
                    box-shadow:
                        0 0 0 2px rgba(37, 30, 12, 0.82),
                        0 18px 50px rgba(0, 0, 0, 0.72),
                        inset 0 0 28px rgba(98, 75, 24, 0.18);
                    font-family: inherit;
                }

                .tutorial-modal__header {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 68px;
                    padding: 10px 56px 9px 18px;
                    border-bottom: 1px solid rgba(104, 85, 38, 0.42);
                    background: rgba(255, 250, 218, 0.45);
                    flex-shrink: 0;
                }

                .tutorial-modal__heading-wrap {
                    min-width: 0;
                    text-align: center;
                }

                .tutorial-modal__series-title {
                    color: #81713d;
                    font-size: 10px;
                    line-height: 1.2;
                    letter-spacing: 0.08em;
                }

                .tutorial-modal__page-title {
                    margin: 4px 0 0;
                    color: #242113;
                    font-size: clamp(16px, 4.6vw, 21px);
                    line-height: 1.3;
                    font-weight: 800;
                    overflow-wrap: anywhere;
                }

                .tutorial-modal__icon-close {
                    position: absolute;
                    top: 11px;
                    right: 11px;
                    width: 38px;
                    height: 38px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    color: #332c16;
                    background: rgba(255, 251, 222, 0.72);
                    border: 1px solid #8e7d49;
                    border-radius: 50%;
                    font: 700 25px/1 inherit;
                    cursor: pointer;
                    -webkit-tap-highlight-color: transparent;
                }

                .tutorial-modal__scroll {
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    padding: clamp(10px, 2.8vw, 16px);
                    scrollbar-width: thin;
                    scrollbar-color: #a18c4e rgba(255, 255, 255, 0.18);
                }

                .tutorial-modal__image-frame {
                    position: relative;
                    width: 100%;
                    min-height: 220px;
                    flex: 1.65 1 0;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #16191b;
                    border: 2px solid #75673d;
                    border-radius: 5px;
                    box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.58);
                }

                .tutorial-modal__image {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: contain;
                    background: #111;
                }

                .tutorial-modal__image[hidden] {
                    display: none;
                }

                .tutorial-modal__image-placeholder {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 18px;
                    color: #d8cc98;
                    background:
                        linear-gradient(135deg, rgba(226, 198, 96, 0.08), transparent 45%),
                        repeating-linear-gradient(45deg, #1b2022 0 12px, #171b1d 12px 24px);
                    text-align: center;
                }

                .tutorial-modal__image-placeholder[hidden] {
                    display: none;
                }

                .tutorial-modal__image-placeholder-title {
                    font-size: 15px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                }

                .tutorial-modal__image-path {
                    max-width: 100%;
                    color: #9e9878;
                    font-size: 10px;
                    overflow-wrap: anywhere;
                }

                .tutorial-modal__description {
                    min-height: 110px;
                    flex: 1 1 0;
                    margin-top: 12px;
                    padding: clamp(15px, 4vw, 22px);
                    color: #292414;
                    background: rgba(215, 202, 138, 0.31);
                    border: 1px solid rgba(127, 104, 48, 0.24);
                    border-radius: 8px;
                    font-size: clamp(13px, 3.8vw, 16px);
                    line-height: 1.85;
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                }

                .tutorial-modal__footer {
                    padding: 10px 12px 12px;
                    background: rgba(255, 250, 218, 0.5);
                    border-top: 1px solid rgba(104, 85, 38, 0.42);
                    flex-shrink: 0;
                }

                .tutorial-modal__navigation {
                    display: grid;
                    grid-template-columns: minmax(82px, 1fr) minmax(86px, auto) minmax(82px, 1fr);
                    align-items: center;
                    gap: 8px;
                }

                .tutorial-modal__nav-button,
                .tutorial-modal__close-bottom {
                    min-height: 44px;
                    color: #fff8d1;
                    background: linear-gradient(#46412b, #28271f);
                    border: 1px solid #8f7d42;
                    border-radius: 7px;
                    font: 700 13px/1.2 inherit;
                    cursor: pointer;
                    box-shadow: inset 0 1px rgba(255, 255, 255, 0.14);
                    -webkit-tap-highlight-color: transparent;
                }

                .tutorial-modal__nav-button:disabled {
                    color: rgba(255, 248, 209, 0.35);
                    background: #77715d;
                    border-color: #8c856e;
                    cursor: default;
                    box-shadow: none;
                }

                .tutorial-modal__progress-wrap {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                }

                .tutorial-modal__dots {
                    max-width: 130px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    overflow-x: auto;
                    padding: 3px;
                    scrollbar-width: none;
                }

                .tutorial-modal__dots::-webkit-scrollbar {
                    display: none;
                }

                .tutorial-modal__dot {
                    width: 9px;
                    height: 9px;
                    flex: 0 0 9px;
                    padding: 0;
                    border: 0;
                    border-radius: 50%;
                    background: #a39a72;
                    cursor: pointer;
                }

                .tutorial-modal__dot.is-active {
                    width: 11px;
                    height: 11px;
                    flex-basis: 11px;
                    background: #52451e;
                    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.62);
                }

                .tutorial-modal__page-count {
                    color: #6b603c;
                    font-size: 10px;
                    line-height: 1;
                }

                .tutorial-modal__close-bottom {
                    width: 100%;
                    margin-top: 9px;
                    color: #2d2919;
                    background: rgba(255, 251, 222, 0.82);
                    border-color: #817344;
                }

                .tutorial-modal button:focus-visible {
                    outline: 3px solid #2a89ff;
                    outline-offset: 2px;
                }

                @media (min-width: 601px) {
                    .tutorial-modal__panel {
                        width: min(100%, var(--tutorial-modal-panel-width, 430px));
                    }
                }

                @media (hover: hover) {
                    .tutorial-modal__icon-close:hover,
                    .tutorial-modal__close-bottom:hover {
                        filter: brightness(1.08);
                    }
                    .tutorial-modal__nav-button:not(:disabled):hover {
                        filter: brightness(1.18);
                    }
                }

                @media (max-height: 580px) {
                    .tutorial-modal__header {
                        min-height: 56px;
                        padding-top: 7px;
                        padding-bottom: 7px;
                    }
                    .tutorial-modal__icon-close {
                        top: 8px;
                        width: 34px;
                        height: 34px;
                    }
                    .tutorial-modal__image-frame {
                        min-height: 150px;
                    }
                    .tutorial-modal__description {
                        min-height: 86px;
                        line-height: 1.65;
                    }
                    .tutorial-modal__nav-button,
                    .tutorial-modal__close-bottom {
                        min-height: 38px;
                    }
                }

                @media (prefers-reduced-motion: no-preference) {
                    .tutorial-modal:not([hidden]) .tutorial-modal__panel {
                        animation: tutorial-modal-enter 150ms ease-out;
                    }
                    @keyframes tutorial-modal-enter {
                        from { opacity: 0; transform: translateY(8px) scale(0.99); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                }
            `;
            document.head.appendChild(style);
        }
    };

    window.TUTORIAL_DATA = TUTORIAL_DATA;
    window.TutorialModal = TutorialModal.init();
})();
