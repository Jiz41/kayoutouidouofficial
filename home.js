function showHome() {
  view = 'home';
  currentBoard  = null;
  currentThread = null;
  unsubscribe();
  clearPendingImages();

  bdInputBar.style.display   = 'none';
  bdFullBanner.style.display = 'none';
  bdBackBtn.style.display    = 'none';
  bdTitle.textContent        = '華耀東夷堂';

  renderBoardsNav();

  bdMain.innerHTML = `
    <div class="home-wrap">

      <div class="home-kv">
        <div class="home-kv-site">KAYŌ TŌIDŌ · 華耀東夷堂</div>
        <div class="home-kv-catch">名前が要らない、<br>言葉だけの場所。</div>
      </div>

      <div class="home-section">
        <p>華耀東夷堂公式サイトへようこそ。</p>
        <p>ここは、あなたの名前が要らない場所です。<br>アカウントも肩書きも同じく要りません。</p>
        <p>あなたが誰であるかは、ここでは問われません。<br>残るのは、あなたが発した言葉だけ。</p>
        <p class="home-em">─ただ語る。</p>
        <p>予想を出す。予想を見る。<br>称える。怒る。黙って見る。<br>名前も知らない誰かと同じ事で笑ったり、<br>名前も知らない誰かと違う意見で議論したり。</p>
        <p>元来、それだけでいいのです。</p>
      </div>

      <div class="home-divider"></div>

      <div class="home-section">
        <div class="home-block-title">👁 自在律A.L.L</div>
        <div class="home-block-sub">Automata Lex Libera（自律する法、自由なる律）</div>
        <p>手入力で動かす予想システム「自在律」を、自動で稼働させたものです。<br>オートマとマニュアルの違い、と思っていただければ。</p>
        <p>自動選定ゆえ、見たいレースが流れてくるとは限りません。<br>精度も、マニュアルにはわずかに及びません。</p>
        <p>そんなときは、マニュアルで。</p>
        <a class="home-link" href="https://huggingface.co/spaces/Jiz41/Jiz41r1t5u" target="_blank" rel="noopener noreferrer">マニュアル版を開く →</a>
      </div>

      <div class="home-divider"></div>

      <div class="home-section">
        <div class="home-block-title">📋 掲示板群</div>
        <p>競輪の予想を語る場所。速報に騒ぐ場所。<br>どうでもいい話をする場所。</p>
        <p>話題ごとに板が分かれていますが、難しく考えなくていいです。<br>気になる板を開いて、読んで、書いて。</p>
        <p>スレッドは管理者が立てます。<br>そこに何を書くかはあなた次第です。</p>
      </div>

      <div class="home-divider"></div>

      <div class="home-section">
        <div class="home-block-title">🔧 アップデート／メンテナンス情報</div>
        <p>機能追加・障害・メンテナンスなど、<br>このサイトに関するお知らせを掲載します。</p>
        <p>何か起きたらまずここを確認してください。</p>
      </div>

      <div class="home-footer">
        <div class="home-footer-name">華耀東夷堂</div>
        <div class="home-footer-sub">匿名掲示板 · 自律型AI板含む</div>
      </div>

    </div>
  `;
}
