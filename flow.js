/**
 * flow.js — 起動フロー制御
 *
 * Scene 1: スプラッシュ（毎回表示）
 * Scene 2: 利用規約（初回のみ。kayou_agreed が '1' なら Skip）
 * Scene 3: 掲示板本体（board.js の _boardInit() を呼ぶ）
 */

(function initFlow() {
  const SPLASH_DURATION = 3500;
  const LOADER_DURATION = 3000;
  const AGREED_KEY      = 'kayou_agreed';

  const splash    = document.getElementById('scene-splash');
  const terms     = document.getElementById('scene-terms');
  const main      = document.getElementById('scene-main');
  const loaderBar = document.getElementById('loader-bar');
  const btnAgree  = document.getElementById('btn-agree');
  const linkKana  = document.getElementById('link-kana');
  const scrollEl  = document.getElementById('terms-scroll');
  const normalTxt = document.getElementById('terms-normal');
  const kanaTxt   = document.getElementById('terms-kana');

  const alreadyAgreed = localStorage.getItem(AGREED_KEY) === '1';
  let scrolled = false;
  let isKana   = false;

  // ── Scene 1: スプラッシュ（毎回表示） ──────────────────────
  requestAnimationFrame(() => requestAnimationFrame(() => splash.classList.add('visible')));

  setTimeout(() => {
    loaderBar.style.transition = `width ${LOADER_DURATION}ms linear`;
    loaderBar.style.width = '100%';
  }, 300);

  setTimeout(() => {
    splash.classList.add('out');
    setTimeout(() => {
      splash.style.display = 'none';

      if (alreadyAgreed) {
        // 2回目以降: 利用規約をスキップして直接掲示板へ
        main.classList.add('visible');
        setTimeout(() => { if (window._boardInit) window._boardInit(); }, 100);
      } else {
        // 初回: 利用規約を表示
        terms.classList.add('visible');
      }
    }, 500);
  }, SPLASH_DURATION);

  // ── Scene 2: 利用規約（初回のみ） ──────────────────────────
  function checkScroll() {
    if (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 32) {
      if (!scrolled) {
        scrolled = true;
        btnAgree.classList.add('active');
      }
    }
  }
  scrollEl.addEventListener('scroll', checkScroll);

  // ひらがな版切替
  linkKana.addEventListener('click', () => {
    isKana = !isKana;
    normalTxt.classList.toggle('active', !isKana);
    kanaTxt.classList.toggle('active', isKana);
    linkKana.textContent = isKana ? 'ふつうのことばはこちら' : 'むずかしいひとはこちら';
    scrollEl.scrollTop = 0;
    scrolled = false;
    btnAgree.classList.remove('active');
  });

  // 同意ボタン → 同意フラグ保存 → Scene 3 へ遷移
  btnAgree.addEventListener('click', () => {
    if (!btnAgree.classList.contains('active')) return;
    localStorage.setItem(AGREED_KEY, '1');
    terms.classList.add('out');
    main.classList.add('visible');
    setTimeout(() => {
      terms.style.display = 'none';
      if (window._boardInit) window._boardInit();
    }, 600);
  });
})();
