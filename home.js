async function showHome() {
  view = 'home';
  currentBoard  = null;
  currentThread = null;
  unsubscribe();
  clearPendingImages();

  bdInputBar.style.display   = 'none';
  bdFullBanner.style.display = 'none';
  bdBackBtn.style.display    = 'none';
  bdTitle.textContent        = '華耀東夷堂';

  // 板データ未取得の場合のみSupabaseから取得
  if (!boards.length) {
    const [boardsRes, catsRes, actRes] = await Promise.all([
      sb.from('boards').select('*').order('sort_order').order('created_at'),
      sb.from('categories').select('*').order('sort_order'),
      sb.from('threads').select('board_id, created_at').order('created_at', { ascending: false }).limit(300),
    ]);
    if (!boardsRes.error) {
      boards     = boardsRes.data || [];
      categories = catsRes.data   || [];
      activityMap = {};
      for (const t of (actRes.data || [])) {
        if (!activityMap[t.board_id]) activityMap[t.board_id] = t.created_at;
      }
    }
  }

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
        <div class="home-block-title">👁 真自在律A.L.L</div>
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
        <div id="home-ann-list" class="home-ann-loading">読み込み中…</div>
      </div>

      <div class="home-footer">
        <div class="home-footer-name">華耀東夷堂</div>
        <div class="home-footer-sub">匿名掲示板 · 自律型AI板含む</div>
      </div>

    </div>
  `;

  loadHomeAnnouncements();
}

async function loadHomeAnnouncements() {
  const listEl = document.getElementById('home-ann-list');
  if (!listEl) return;

  const { data, error } = await sb
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    listEl.innerHTML = '<p style="color:#7a8090;font-size:13px">読み込みに失敗しました。</p>';
    return;
  }

  if (!data || !data.length) {
    listEl.innerHTML = '<p class="home-ann-empty">現在お知らせはありません。</p>';
    return;
  }

  listEl.className = 'home-ann-list';
  listEl.innerHTML = data.map(a => `
    <div class="home-ann-item">
      <div class="home-ann-meta">${formatDate(a.created_at)}</div>
      <div class="home-ann-title">${escHtml(a.title)}</div>
      <div class="home-ann-body">${escHtml(a.body).replace(/\n/g, '<br>')}</div>
    </div>
  `).join('');
}

// ── アプデ/メンテ情報 全件表示 ───────────────────────────────
async function showAnnouncements() {
  view = 'announcements';
  currentBoard  = null;
  currentThread = null;
  unsubscribe();
  clearPendingImages();

  bdInputBar.style.display   = 'none';
  bdFullBanner.style.display = 'none';
  bdBackBtn.style.display    = 'inline-block';
  bdTitle.textContent        = '🔧 アプデ/メンテ情報';

  renderBoardsNav();

  bdMain.innerHTML = '<div class="bd-loading">読み込み中…</div>';

  const { data, error } = await sb
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    bdMain.innerHTML = `<div class="bd-empty">エラー: ${escHtml(error.message)}</div>`;
    return;
  }

  if (!data || !data.length) {
    bdMain.innerHTML = '<div class="bd-empty">現在お知らせはありません。</div>';
    return;
  }

  bdMain.innerHTML = `<div class="ann-list">${data.map(annItemHtml).join('')}</div>`;
}

function annItemHtml(a) {
  return `<div class="ann-item">
    <div class="ann-item-hdr">
      <span class="ann-item-title">${escHtml(a.title)}</span>
      <span class="ann-item-date">${formatDate(a.created_at)}</span>
    </div>
    <div class="ann-item-body">${escHtml(a.body).replace(/\n/g, '<br>')}</div>
  </div>`;
}
