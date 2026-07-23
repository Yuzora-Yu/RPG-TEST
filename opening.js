/* opening.js - PROLOGUE3後に再生する自動進行の紙芝居風オープニング。 */
const PRISMA_OPENING_PAGES = [
    { text: '五年前のあの日　王都では「大いなる祝福」の儀式が行われた。', effect: 'prism', focus: '50% 46%', startScale: 1.02, endScale: 1.12, startX: '0%', endX: '0%', startY: '2%', endY: '-1%' },
    { text: '六つの属性は一つに混じり　白く瞬いたあと　音もなく割れた。', effect: 'rupture', focus: '50% 43%', startScale: 1.1, endScale: 1.24, startX: '0%', endX: '0%', startY: '0%', endY: '-2%' },
    { text: '六色の破片は空へ散り、地は裂け　大陸は分割された。', effect: 'rupture', focus: '50% 58%', startScale: 1.18, endScale: 1.05, startX: '0%', endX: '0%', startY: '-2%', endY: '3%' },
    { text: '同じ夜　山奥の村がひとつ　底知れぬ闇に呑まれ　地図から消えた。', effect: 'abyss', focus: '72% 38%', startScale: 1.08, endScale: 1.18, startX: '-1%', endX: '1%', startY: '1%', endY: '-1%' },
    { text: '今もまた　地の底から　あの夜と同じ闇が忍びよっていた。', effect: 'abyss', focus: '50% 68%', startScale: 1.08, endScale: 1.18, startX: '0%', endX: '0%', startY: '-1%', endY: '2%' },
    { text: 'そして東では　炉の火までもが人の手を離れようとしている。', effect: 'embers', focus: '20% 52%', startScale: 1.12, endScale: 1.22, startX: '1%', endX: '-2%', startY: '0%', endY: '-1%' },
    { text: '国の儀式とは…世界に広がる異変とは……その答えを探すため　冒険者達は旅に出る。', effect: 'abyss', focus: '50% 50%', startScale: 1.04, endScale: 1.14, startX: '0%', endX: '-1%', startY: '0%', endY: '0%' },
    { logo: true, text: '', effect: 'prism', focus: '50% 48%', startScale: 1.12, endScale: 1.02, startX: '0%', endX: '0%', startY: '-1%', endY: '1%', duration: 5000 }
];

const PRISMA_OPENING_IMAGE = 'assets/generated/opening-prism-collapse.png';
const PRISMA_OPENING_LOGO = 'assets/background/PRISMA ABYSS.png';
PRISMA_OPENING_PAGES.forEach(page => { page.image = PRISMA_OPENING_IMAGE; });

const OpeningSequence = {
    active: false,
    pages: PRISMA_OPENING_PAGES,

    preload(pages) {
        const urls = [...new Set(pages.flatMap(page => [page.image, page.logo ? PRISMA_OPENING_LOGO : null, page.effect === 'rupture' ? 'assets/effect/fx_special_rupture.png' : null]).filter(Boolean))];
        return Promise.allSettled(urls.map(src => new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(src);
            img.onerror = () => resolve(src);
            img.src = src;
        })));
    },

    async play(options = {}) {
        if (this.active || typeof document === 'undefined') return;
        const pages = Array.isArray(options.pages) && options.pages.length ? options.pages : this.pages;
        if (!pages.length) return;
        this.active = true;

        const old = document.getElementById('prisma-opening');
        if (old) old.remove();

        const root = document.createElement('section');
        root.id = 'prisma-opening';
        root.className = 'prisma-opening is-entering';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'PRISMA ABYSS オープニング');
        root.innerHTML = `
            <img class="prisma-opening__image" alt="">
            <div class="prisma-opening__shade"></div>
            <div class="prisma-opening__particles"></div>
            <img class="prisma-opening__rupture" src="assets/effect/fx_special_rupture.png" alt="">
            <div class="prisma-opening__flash"></div>
            <div class="prisma-opening__entry-curtain"></div>
            <img class="prisma-opening__logo" src="assets/background/PRISMA ABYSS.png" alt="PRISMA ABYSS" hidden>
            <div class="prisma-opening__loading" hidden>記憶を辿っています…</div>
            <button class="prisma-opening__button prisma-opening__button--skip" type="button">SKIP</button>
            <article class="prisma-opening__panel" hidden>
                <h2 class="prisma-opening__title"></h2>
                <p class="prisma-opening__text"></p>
                <div class="prisma-opening__footer">
                    <span class="prisma-opening__counter"></span>
                </div>
            </article>`;
        document.body.appendChild(root);
        requestAnimationFrame(() => root.classList.add('is-visible'));

        const image = root.querySelector('.prisma-opening__image');
        const loading = root.querySelector('.prisma-opening__loading');
        const logo = root.querySelector('.prisma-opening__logo');
        const panel = root.querySelector('.prisma-opening__panel');
        const title = root.querySelector('.prisma-opening__title');
        const text = root.querySelector('.prisma-opening__text');
        const counter = root.querySelector('.prisma-opening__counter');
        const skip = root.querySelector('.prisma-opening__button--skip');

        await this.preload(pages);
        loading.hidden = true;
        await new Promise(resolve => setTimeout(resolve, 420));
        const entryCurtain = root.querySelector('.prisma-opening__entry-curtain');
        root.classList.remove('is-entering');
        if (entryCurtain) entryCurtain.classList.add('is-leaving');
        await new Promise(resolve => setTimeout(resolve, 520));
        if (entryCurtain) entryCurtain.remove();
        panel.hidden = false;

        let index = 0;
        let autoTimer = null;
        let transitionTimer = null;
        let transitioning = false;
        let closing = false;
        let resolvePlay;
        const done = new Promise(resolve => { resolvePlay = resolve; });

        const clearTimers = () => {
            if (autoTimer) clearTimeout(autoTimer);
            if (transitionTimer) clearTimeout(transitionTimer);
            autoTimer = null;
            transitionTimer = null;
        };

        const render = (pageIndex) => {
            clearTimers();
            transitioning = false;
            const page = pages[pageIndex];
            root.dataset.effect = page.effect || '';
            root.classList.toggle('is-title-page', !!page.logo);
            logo.hidden = !page.logo;
            title.textContent = page.title || '';
            title.hidden = !page.title;
            image.src = page.image || '';
            image.style.setProperty('--op-focus', page.focus || '50% 50%');
            image.style.setProperty('--op-start-scale', String(page.startScale || 1.08));
            image.style.setProperty('--op-end-scale', String(page.endScale || 1.18));
            image.style.setProperty('--op-start-x', page.startX || '0%');
            image.style.setProperty('--op-end-x', page.endX || '0%');
            image.style.setProperty('--op-start-y', page.startY || '0%');
            image.style.setProperty('--op-end-y', page.endY || '0%');
            image.style.animation = 'none';
            void image.offsetWidth;
            image.style.animation = '';

            text.textContent = page.text || '';
            panel.classList.remove('is-line-visible');
            requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('is-line-visible')));
            autoTimer = setTimeout(advance, Number(page.duration) || 4300);
        };

        const close = () => {
            if (closing) return;
            closing = true;
            clearTimers();
            panel.classList.remove('is-line-visible');
            root.classList.add('is-leaving');
            setTimeout(() => {
                root.remove();
                this.active = false;
                resolvePlay();
            }, 430);
        };

        const advance = () => {
            if (closing || transitioning) return;
            clearTimers();
            if (index >= pages.length - 1) {
                close();
                return;
            }
            transitioning = true;
            panel.classList.remove('is-line-visible');
            transitionTimer = setTimeout(() => {
                index += 1;
                render(index);
            }, 520);
        };

        skip.addEventListener('click', event => { event.stopPropagation(); close(); });
        root.addEventListener('click', event => {
            if (!event.target.closest('button')) advance();
        });
        const onKey = event => {
            if (!root.isConnected) {
                document.removeEventListener('keydown', onKey);
                return;
            }
            if (event.key === 'Escape') close();
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                advance();
            }
        };
        document.addEventListener('keydown', onKey);
        render(index);
        skip.focus();
        await done;
        document.removeEventListener('keydown', onKey);
    }
};

window.OpeningSequence = OpeningSequence;
window.PRISMA_OPENING_PAGES = PRISMA_OPENING_PAGES;
