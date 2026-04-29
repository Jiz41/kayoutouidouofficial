/**
 * flow.js — 起動フロー制御
 *
 * Scene 1: スプラッシュ（ロゴ + ローディングバー）
 * Scene 2: 利用規約（最下部スクロールで同意ボタン活性化）
 * Scene 3: 掲示板本体（同意後に表示、board.js の _boardInit() を呼ぶ）
 *
 * 編集ポイント:
 *   - スプラッシュ表示時間: SPLASH_DURATION (ms)
 *   - ローダー速度:         LOADER_DURATION (ms)
 */

(function initFlow() {
  const SPLASH_DURATION = 3500; // スプラッシュ表示時間(ms)
  const LOADER_DURATION = 3000; // ローダーアニメ時間(ms)

  const splash    = document.getElementById('scene-splash');
  const terms     = document.getElementById('scene-terms');
  const main      = document.getElementById('scene-main');
  const loaderBar = document.getElementById('loader-bar');
  const btnAgree  = document.getElementById('btn-agree');
  const linkKana  = document.getElementById('link-kana');
  const scrollEl  = document.getElementById('terms-scroll');
  const normalTxt = document.getElementById('terms-normal');
  const kanaTxt   = document.getElementById('terms-kana');

  let scrolled = false;
  let isKana   = false;

  // ── Scene 1: スプラッシュ ─────────────────────────────
  requestAnimationFrame(() => requestAnimationFrame(() => splash.classList.add('visible')));

  setTimeout(() => {
    loaderBar.style.transition = `width ${LOADER_DURATION}ms linear`;
    loaderBar.style.width = '100%';
  }, 300);

  setTimeout(() => {
    splash.classList.add('out');
    setTimeout(() => {
      splash.style.display = 'none';
      terms.classList.add('visible');
    }, 500);
  }, SPLASH_DURATION);

  // ── Scene 2: 利用規約 ─────────────────────────────────
  // 最下部スクロール検出 → 同意ボタン活性化
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
    kanaTxt.classList.toggle('active',   isKana);
    linkKana.textContent = isKana ? 'ふつうのことばはこちら' : 'むずかしいひとはこちら';
    scrollEl.scrollTop = 0;
    scrolled = false;
    btnAgree.classList.remove('active');
  });

  // 同意ボタン → Scene 3 へ遷移
  btnAgree.addEventListener('click', () => {
    if (!btnAgree.classList.contains('active')) return;
    terms.classList.add('out');
    main.classList.add('visible');
    setTimeout(() => {
      terms.style.display = 'none';
      // board.js の初期化を呼ぶ
      if (window._boardInit) window._boardInit();
    }, 600);
  });
})();
