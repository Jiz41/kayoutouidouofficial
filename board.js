/**
 * board.js — 掲示板ロジック（Supabase連携）
 *
 * 依存: supabase-js@2 (CDN)
 * 初期化: window._boardInit() を呼ぶと板一覧を表示
 */

// ── 接続情報 ─────────────────────────────────────────────
const SUPABASE_URL = 'https://pqqrfzofzxiuzvxdrcai.supabase.co';
const SUPABASE_KEY = 'sb_publishable_t1AfJtM9h_gYkxg9QL3GXg_-CVV0jaT';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 匿名ID ────────────────────────────────────────────────
let myAnonId = localStorage.getItem('kayou_anon_id');
if (!myAnonId) {
  myAnonId = Math.random().toString(36).slice(2, 10).toUpperCase();
  localStorage.setItem('kayou_anon_id', myAnonId);
}

// ── アプリ状態 ────────────────────────────────────────────
let view = 'boards';
let currentBoard  = null;
let currentThread = null;
let realtimeChannel = null;
let posts      = [];
let boards     = [];
let categories = [];
let activityMap   = {}; // boardId → 最新スレッドcreated_at
let pendingImages = []; // { file, objectUrl }

// ── DOM参照 ───────────────────────────────────────────────
const bdMain       = document.getElementById('bd-main');
const bdTitle      = document.getElementById('bd-header-title');
const bdBackBtn    = document.getElementById('bd-back-btn');
const bdInputBar   = document.getElementById('bd-input-bar');
const bdFullBanner = document.getElementById('bd-full-banner');
const bdSidebar    = document.getElementById('bd-sidebar');
const bdOverlay    = document.getElementById('bd-overlay');
const bdBoardsNav  = document.getElementById('bd-boards-nav');
const bdModal      = document.getElementById('bd-modal');
const bdPopup      = document.getElementById('bd-anchor-popup');
const bdTextarea   = document.getElementById('bd-textarea');
const bdSendBtn    = document.getElementById('bd-send-btn');
const bdLegalModal = document.getElementById('bd-legal-modal');
const bdAttachBtn  = document.getElementById('bd-attach-btn');
const bdFileInput  = document.getElementById('bd-file-input');
const bdImgPreview = document.getElementById('bd-img-preview');
const bdLightbox   = document.getElementById('bd-lightbox');

// ── サイドバー開閉 ────────────────────────────────────────
document.getElementById('bd-hamburger').addEventListener('click', () => {
  bdSidebar.classList.add('open');
  bdOverlay.classList.add('open');
});
bdOverlay.addEventListener('click', closeSidebar);

function closeSidebar() {
  bdSidebar.classList.remove('open');
  bdOverlay.classList.remove('open');
}

// ── カテゴリ折りたたみ状態 ───────────────────────────────
const CAT_COLLAPSE_KEY = 'kayou_cat_collapsed';
function getCollapseState() {
  try { return JSON.parse(localStorage.getItem(CAT_COLLAPSE_KEY) || '{}'); } catch { return {}; }
}
function saveCollapseState(state) {
  localStorage.setItem(CAT_COLLAPSE_KEY, JSON.stringify(state));
}

// ── 未読バッジ ────────────────────────────────────────────
function markBoardRead(boardId) {
  localStorage.setItem('lastRead_' + boardId, new Date().toISOString());
}
function hasUnread(boardId) {
  const lastRead = localStorage.getItem('lastRead_' + boardId);
  const activity = activityMap[boardId];
  return activity && (!lastRead || activity > lastRead);
}

// ── サイドバー板ナビ描画（Discord 2層構造） ──────────────
function renderBoardsNav() {
  const collapsed = getCollapseState();
  const SEP = '<div class="bd-nav-sep"></div>';

  // ── ① はじめに ──────────────────────────────────────────
  let html = `<button class="bd-board-btn${view === 'home' ? ' active' : ''}" id="bd-home-btn">
    <span class="bd-emoji">🏠</span><span class="bd-bname">はじめに</span>
  </button>`;

  // ── ② 区切り → 真自在律 ────────────────────────────────
  html += SEP;
  html += `<button class="bd-board-btn${view === 'jizairitu' ? ' active' : ''}" id="bd-jiz-btn">
    <span class="bd-emoji">👁</span><span class="bd-bname">真自在律A.L.L</span>
  </button>`;

  // ── ③ 区切り → ニュース速報 ────────────────────────────
  html += SEP;
  html += `<button class="bd-board-btn${view === 'news' ? ' active' : ''}" id="bd-news-btn">
    <span class="bd-emoji">📰</span><span class="bd-bname">ニュース速報</span>
  </button>`;

  // ── ④ 区切り → 掲示板ラベル → カテゴリ群 ──────────────
  html += SEP;
  html += `<div class="bd-nav-label">📋 掲示板</div>`;

  // カテゴリごとに板をグルーピング
  const catBoards = {};
  const uncategorized = [];
  for (const b of boards) {
    if (b.category_id) {
      if (!catBoards[b.category_id]) catBoards[b.category_id] = [];
      catBoards[b.category_id].push(b);
    } else {
      uncategorized.push(b);
    }
  }

  const boardBtnHtml = (b) => {
    const active = currentBoard?.id === b.id ? 'active' : '';
    const unread = hasUnread(b.id) ? '<span class="bd-unread">●</span>' : '';
    return `<button class="bd-board-btn ${active}" data-id="${b.id}">
      <span class="bd-emoji">${escHtml(b.emoji || '📋')}</span>
      <span class="bd-bname">${escHtml(b.name)}</span>
      ${unread}
    </button>`;
  };

  for (const cat of categories) {
    const bList = catBoards[cat.id] || [];
    const isCollapsed = !!collapsed[cat.id];
    html += `<div class="bd-category">
      <button class="bd-cat-hdr" data-cat-id="${cat.id}">
        <span class="bd-cat-arrow${isCollapsed ? ' collapsed' : ''}">▼</span>
        <span class="bd-cat-name">${escHtml(cat.name)}</span>
      </button>
      <div class="bd-cat-boards${isCollapsed ? ' hidden' : ''}">
        ${bList.map(boardBtnHtml).join('')}
      </div>
    </div>`;
  }

  if (uncategorized.length) {
    const isCollapsed = !!collapsed['__uncategorized__'];
    html += `<div class="bd-category">
      <button class="bd-cat-hdr" data-cat-id="__uncategorized__">
        <span class="bd-cat-arrow${isCollapsed ? ' collapsed' : ''}">▼</span>
        <span class="bd-cat-name">その他</span>
      </button>
      <div class="bd-cat-boards${isCollapsed ? ' hidden' : ''}">
        ${uncategorized.map(boardBtnHtml).join('')}
      </div>
    </div>`;
  }

  // ── ⑤ 区切り → アプデ/メンテ → 区切り → リンク ──────────
  html += SEP;
  html += `<button class="bd-board-btn${view === 'announcements' ? ' active' : ''}" id="bd-ann-btn">
    <span class="bd-emoji">🔧</span><span class="bd-bname">アプデ/メンテ情報</span>
  </button>`;
  html += SEP;
  html += `<button class="bd-board-btn${view === 'links' ? ' active' : ''}" id="bd-links-btn">
    <span class="bd-emoji">🔗</span><span class="bd-bname">リンク</span>
  </button>`;

  // ── DOM反映 ─────────────────────────────────────────────
  bdBoardsNav.innerHTML = html;

  document.getElementById('bd-home-btn')?.addEventListener('click',  () => { closeSidebar(); showHome(); });
  document.getElementById('bd-jiz-btn')?.addEventListener('click',   () => { closeSidebar(); showJizairitu(); });
  document.getElementById('bd-ann-btn')?.addEventListener('click',   () => { closeSidebar(); showAnnouncements(); });
  document.getElementById('bd-links-btn')?.addEventListener('click', () => { closeSidebar(); showLinks(); });
  document.getElementById('bd-news-btn')?.addEventListener('click',  () => { closeSidebar(); showNews(); });

  bdBoardsNav.querySelectorAll('.bd-cat-hdr').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.catId;
      const state = getCollapseState();
      state[catId] = !state[catId];
      saveCollapseState(state);
      renderBoardsNav();
    });
  });

  bdBoardsNav.querySelectorAll('.bd-board-btn[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const board = boards.find(b => String(b.id) === btn.dataset.id);
      if (board) { closeSidebar(); showThreads(board); }
    });
  });
}

// ── 板一覧 ────────────────────────────────────────────────
async function showBoards() {
  view = 'boards'; currentBoard = null; currentThread = null;
  unsubscribe();
  clearPendingImages();
  bdInputBar.style.display   = 'none';
  bdBackBtn.style.display    = 'none';
  bdFullBanner.style.display = 'none';
  bdTitle.textContent = '華耀東夷堂';
  bdMain.innerHTML = '<div class="bd-loading">読み込み中…</div>';

  const [boardsRes, catsRes, actRes] = await Promise.all([
    sb.from('boards').select('*').order('sort_order').order('created_at'),
    sb.from('categories').select('*').order('sort_order'),
    sb.from('threads').select('board_id, created_at').order('created_at', { ascending: false }).limit(300),
  ]);

  if (boardsRes.error) {
    bdMain.innerHTML = `<div class="bd-empty">エラー: ${escHtml(boardsRes.error.message)}</div>`;
    return;
  }

  boards     = boardsRes.data || [];
  categories = catsRes.data   || [];

  // 板ごとの最新スレッド日時マップを構築
  activityMap = {};
  for (const t of (actRes.data || [])) {
    if (!activityMap[t.board_id]) activityMap[t.board_id] = t.created_at;
  }

  renderBoardsNav();

  if (!boards.length) { bdMain.innerHTML = '<div class="bd-empty">板がありません</div>'; return; }

  bdMain.innerHTML = boards.map((b, i) => `
    <div class="bd-thread-item" data-bid="${b.id}">
      <div class="bd-thread-title">${escHtml(b.emoji || '📋')} ${escHtml(b.name)}</div>
    </div>
    ${i < boards.length - 1 ? '<div class="bd-thread-sep"></div>' : ''}
  `).join('');

  bdMain.querySelectorAll('.bd-thread-item[data-bid]').forEach(el => {
    el.addEventListener('click', () => {
      const board = boards.find(b => String(b.id) === el.dataset.bid);
      if (board) showThreads(board);
    });
  });
}

// ── スレッド一覧 ──────────────────────────────────────────
async function showThreads(board) {
  view = 'threads'; currentBoard = board; currentThread = null;
  unsubscribe();
  clearPendingImages();
  bdInputBar.style.display   = 'none';
  bdFullBanner.style.display = 'none';
  bdBackBtn.style.display    = 'inline-block';
  bdTitle.textContent        = `${board.emoji || ''} ${board.name}`;
  bdMain.innerHTML = '<div class="bd-loading">読み込み中…</div>';

  // 既読マーク & バッジ更新
  markBoardRead(board.id);
  renderBoardsNav();

  const { data, error } = await sb
    .from('threads')
    .select('*')
    .eq('board_id', board.id)
    .order('created_at', { ascending: false });

  if (error) { bdMain.innerHTML = `<div class="bd-empty">エラー: ${escHtml(error.message)}</div>`; return; }

  if (!data.length) {
    bdMain.innerHTML = '<div class="bd-empty">スレッドがありません</div>';
    return;
  }

  bdMain.innerHTML = data.map((t, i) => `
    <div class="bd-thread-item${!t.is_active ? ' full' : ''}" data-tid="${t.id}">
      <span class="bd-thread-count">${t.post_count}${!t.is_active ? ' 【満】' : ''}</span>
      <div class="bd-thread-title">${escHtml(t.title)}</div>
      <div class="bd-thread-meta">${formatDate(t.created_at)}</div>
    </div>
    ${i < data.length - 1 ? '<div class="bd-thread-sep"></div>' : ''}
  `).join('');

  bdMain.querySelectorAll('.bd-thread-item[data-tid]').forEach(el => {
    el.addEventListener('click', () => {
      const thread = data.find(t => String(t.id) === el.dataset.tid);
      if (thread) showPosts(thread);
    });
  });
}

// ── 投稿一覧 ──────────────────────────────────────────────
async function showPosts(thread) {
  view = 'posts'; currentThread = thread;
  unsubscribe();
  bdBackBtn.style.display = 'inline-block';
  bdTitle.textContent     = escHtml(thread.title);
  bdMain.innerHTML        = '<div class="bd-loading">読み込み中…</div>';
  posts = [];

  const { data, error } = await sb
    .from('posts')
    .select('*')
    .eq('thread_id', thread.id)
    .order('post_number');

  if (error) { bdMain.innerHTML = `<div class="bd-empty">エラー: ${escHtml(error.message)}</div>`; return; }

  posts = data || [];
  renderAllPosts();

  if (thread.is_active) {
    bdInputBar.style.display   = 'block';
    bdFullBanner.style.display = 'none';
    subscribeToThread(thread.id);
  } else {
    bdInputBar.style.display   = 'none';
    bdFullBanner.style.display = 'block';
  }

  setTimeout(() => { bdMain.scrollTop = bdMain.scrollHeight; }, 80);
}

function renderAllPosts() {
  if (!posts.length) { bdMain.innerHTML = '<div class="bd-empty">投稿がありません</div>'; return; }
  bdMain.innerHTML = posts.map((p, i) => renderPost(p, i)).join('');
  bdMain.querySelectorAll('.bd-post-num').forEach(el => {
    el.addEventListener('click', () => quotePost(Number(el.dataset.num)));
  });
}

function renderPost(p, i) {
  const isSystem = p.anon_id === 'SYSTEM';
  const isEmpty  = !p.body || !p.body.trim();
  const sep      = i > 0 ? '<div class="bd-thread-sep"></div>' : '';
  return `${sep}<div class="bd-post${isSystem ? ' system' : ''}" id="post-${p.post_number}">
    <div class="bd-post-hdr">
      <span class="bd-post-num" data-num="${p.post_number}">${p.post_number}</span>
      <span class="bd-post-id">Anon:${escHtml(p.anon_id)}</span>
      <span class="bd-post-time">${formatDate(p.created_at)}</span>
    </div>
    ${!isEmpty ? `<div class="bd-post-body">${processBody(p.body)}</div>` : ''}
  </div>`;
}

// ── リアルタイム購読 ──────────────────────────────────────
function subscribeToThread(threadId) {
  realtimeChannel = sb.channel('posts_' + threadId)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'posts',
      filter: 'thread_id=eq.' + threadId,
    }, payload => {
      const p = payload.new;
      if (posts.find(x => x.id === p.id)) return;
      posts.push(p);

      const sep = document.createElement('div');
      sep.className = 'bd-thread-sep';

      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderPost(p, 0);
      const postEl = wrapper.firstChild;
      bdMain.appendChild(sep);
      bdMain.appendChild(postEl);

      postEl.querySelectorAll('.bd-post-num').forEach(e => {
        e.addEventListener('click', () => quotePost(Number(e.dataset.num)));
      });

      currentThread.post_count = (currentThread.post_count || 0) + 1;
      if (currentThread.post_count >= 1000) {
        currentThread.is_active    = false;
        bdInputBar.style.display   = 'none';
        bdFullBanner.style.display = 'block';
      }
      bdMain.scrollTop = bdMain.scrollHeight;
    })
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED')    console.log('[RT] 購読成功:', threadId);
      if (status === 'CHANNEL_ERROR') console.error('[RT] チャンネルエラー:', err);
      if (status === 'TIMED_OUT')     console.warn('[RT] タイムアウト');
      if (status === 'CLOSED')        console.log('[RT] チャンネルクローズ');
    });
}

function unsubscribe() {
  if (realtimeChannel) { sb.removeChannel(realtimeChannel); realtimeChannel = null; }
}

// ── 投稿送信 ──────────────────────────────────────────────
document.getElementById('bd-form').addEventListener('submit', async e => {
  e.preventDefault();
  const text = bdTextarea.value.trim();
  if (!text && !pendingImages.length) return;
  if (!currentThread?.is_active) return;

  bdSendBtn.disabled   = true;
  bdAttachBtn.disabled = true;

  let body = text;
  try {
    if (pendingImages.length) {
      const urls = await uploadImages();
      body = urls.join('\n') + (text ? '\n' + text : '');
    }
  } catch (err) {
    alert('画像アップロード失敗: ' + err.message);
    bdSendBtn.disabled   = false;
    bdAttachBtn.disabled = false;
    return;
  }

  const { error } = await sb.rpc('insert_post', {
    p_thread_id: currentThread.id,
    p_body:      body,
    p_anon_id:   myAnonId,
  });
  bdSendBtn.disabled   = false;
  bdAttachBtn.disabled = false;

  if (!error) {
    bdTextarea.value = '';
    bdTextarea.style.height = 'auto';
    clearPendingImages();
  } else {
    alert('投稿失敗: ' + error.message);
  }
});

bdTextarea.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    document.getElementById('bd-form').dispatchEvent(new Event('submit'));
  }
});

bdTextarea.addEventListener('input', () => {
  bdTextarea.style.height = 'auto';
  bdTextarea.style.height = Math.min(bdTextarea.scrollHeight, 120) + 'px';
});

// ── スレッド作成モーダル（管理ページ用） ─────────────────
function openModal() {
  bdModal.classList.add('open');
  setTimeout(() => document.getElementById('bd-thread-title').focus(), 50);
}
function closeModal() {
  bdModal.classList.remove('open');
  document.getElementById('bd-thread-title').value = '';
  document.getElementById('bd-thread-body').value  = '';
}
document.getElementById('bd-modal-cancel').addEventListener('click', closeModal);
bdModal.addEventListener('click', e => { if (e.target === bdModal) closeModal(); });
document.getElementById('bd-modal-submit').addEventListener('click', async () => {
  const title = document.getElementById('bd-thread-title').value.trim();
  const body  = document.getElementById('bd-thread-body').value.trim();
  if (!title || !body) { alert('タイトルと本文を入力してください'); return; }

  const { error } = await sb.rpc('create_thread', {
    p_board_id: currentBoard.id,
    p_title:    title,
    p_body:     body,
    p_anon_id:  myAnonId,
  });
  if (error) { alert('スレッド作成失敗: ' + error.message); return; }
  closeModal();
  showThreads(currentBoard);
});

// ── 戻るボタン ────────────────────────────────────────────
bdBackBtn.addEventListener('click', () => {
  if (view === 'posts')              showThreads(currentBoard);
  else if (view === 'threads')       showHome();
  else if (view === 'jizairitu')     showHome();
  else if (view === 'announcements') showHome();
  else if (view === 'links')         showHome();
  else if (view === 'news')          showHome();
});

// ── 利用規約 / プライバシーポリシー モーダル ─────────────
const PRIVACY_HTML = `<h2>プライバシーポリシー</h2>
<p>本サイト（華耀東夷堂）は、以下の情報を収集・利用します。</p>
<h3>収集する情報</h3>
<ul>
  <li>・投稿内容（テキスト）</li>
  <li>・接続元IPアドレス（サーバーログ）</li>
  <li>・匿名ID（ブラウザのlocalStorageに保存、24時間でリセット）</li>
  <li>・Google Analyticsによるアクセス解析情報（Cookie使用）</li>
</ul>
<h3>利用目的</h3>
<ul>
  <li>・サービスの提供・運営</li>
  <li>・不正利用の防止・対処</li>
  <li>・サービス改善のための統計分析</li>
</ul>
<h3>第三者提供</h3>
<p>法令に基づく場合を除き、収集した情報を第三者に提供することはありません。</p>
<h3>Google Analytics</h3>
<p>アクセス解析のためにGoogle Analyticsを使用しています。収集データはGoogleのプライバシーポリシーに従って管理されます。</p>
<p class="footer-note">施行：2026年04月28日</p>`;

document.getElementById('btn-show-terms').addEventListener('click', () => {
  openLegalModal('利用規約', document.getElementById('terms-normal').innerHTML);
});
document.getElementById('btn-show-privacy').addEventListener('click', () => {
  openLegalModal('プライバシーポリシー', PRIVACY_HTML);
});

function openLegalModal(title, html) {
  document.getElementById('bd-legal-modal-title').textContent = title;
  document.getElementById('bd-legal-modal-body').innerHTML = html;
  bdLegalModal.classList.add('open');
  document.getElementById('bd-legal-modal-body').scrollTop = 0;
}
function closeLegalModal() {
  bdLegalModal.classList.remove('open');
}
document.getElementById('bd-legal-modal-close').addEventListener('click', closeLegalModal);
bdLegalModal.addEventListener('click', e => { if (e.target === bdLegalModal) closeLegalModal(); });

// ── >>アンカー引用 ────────────────────────────────────────
function quotePost(num) {
  const pos = bdTextarea.selectionStart || bdTextarea.value.length;
  const ins = '>>' + num + '\n';
  bdTextarea.value = bdTextarea.value.slice(0, pos) + ins + bdTextarea.value.slice(pos);
  bdTextarea.selectionStart = bdTextarea.selectionEnd = pos + ins.length;
  bdTextarea.focus();
}

function scrollToPost(num) {
  const el = document.getElementById('post-' + num);
  if (!el) return;
  el.classList.add('highlight');
  bdMain.scrollTop = el.offsetTop - 60;
  setTimeout(() => el.classList.remove('highlight'), 1500);
}

// アンカーホバーポップアップ
let popupTimer = null;
function showAnchorPopup(e, num) {
  const p = posts.find(x => x.post_number == num);
  if (!p) return;
  bdPopup.innerHTML = `<strong style="color:#c8a060">&gt;&gt;${num}</strong> Anon:${escHtml(p.anon_id)}<br>${processBody(p.body || '').substring(0, 280)}`;
  bdPopup.style.display = 'block';
  const rect      = e.target.getBoundingClientRect();
  const stageRect = document.getElementById('stage').getBoundingClientRect();
  let top = rect.bottom - stageRect.top + 6;
  if (top + 160 > stageRect.height) top = rect.top - stageRect.top - 170;
  bdPopup.style.top  = Math.max(4, top) + 'px';
  bdPopup.style.left = '14px';
  clearTimeout(popupTimer);
}
function hideAnchorPopup() {
  popupTimer = setTimeout(() => { bdPopup.style.display = 'none'; }, 250);
}
bdMain.addEventListener('scroll', hideAnchorPopup);

// ── 本文パース ────────────────────────────────────────────
function extractYouTubeId(url) {
  let m = url.match(/youtube\.com\/watch\?(?:[^&\s]*&)*v=([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}

function processBody(body) {
  let s = escHtml(body);
  s = s.replace(/&gt;&gt;(\d+)/g, (_, n) =>
    `<a class="anchor" href="#post-${n}" onmouseenter="showAnchorPopup(event,${n})" onmouseleave="hideAnchorPopup()" onclick="event.preventDefault();showAnchorPopup(event,${n})">&gt;&gt;${n}</a>`);
  s = s.replace(/(https?:\/\/[^\s<&]+)/g, raw => {
    const url = raw.replace(/&amp;/g, '&');
    if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) {
      return `<img src="${url}" class="inline-img" loading="lazy" data-lb="${url}">`;
    }
    const ytId = extractYouTubeId(url);
    if (ytId) {
      const thumb   = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
      const ytUrl   = `https://www.youtube.com/watch?v=${ytId}`;
      return `<a href="${ytUrl}" target="_blank" rel="noopener noreferrer">${raw}</a>` +
             `<a href="${ytUrl}" target="_blank" rel="noopener noreferrer" class="yt-thumb-wrap">` +
             `<img src="${thumb}" class="yt-thumb" loading="lazy" alt="YouTube"></a>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${raw}</a>`;
  });
  return s.replace(/\n/g, '<br>');
}

// ── 画像添付 ──────────────────────────────────────────────
const MAX_ATTACH  = 3;
const MAX_FILE_SZ = 5 * 1024 * 1024; // 5MB

function clearPendingImages() {
  pendingImages.forEach(p => URL.revokeObjectURL(p.objectUrl));
  pendingImages = [];
  renderImgPreview();
}

function renderImgPreview() {
  if (!pendingImages.length) {
    bdImgPreview.innerHTML    = '';
    bdImgPreview.style.display = 'none';
    return;
  }
  bdImgPreview.style.display = 'flex';
  bdImgPreview.innerHTML = pendingImages.map((img, i) =>
    `<div class="img-prev-item">
      <img src="${img.objectUrl}">
      <button type="button" class="img-prev-rm" data-i="${i}">✕</button>
    </div>`
  ).join('');
  bdImgPreview.querySelectorAll('.img-prev-rm').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.i);
      URL.revokeObjectURL(pendingImages[i].objectUrl);
      pendingImages.splice(i, 1);
      renderImgPreview();
    });
  });
}

async function compressImage(file, maxPx = 1200, quality = 0.75) {
  // GIFはアニメーション保持のため圧縮しない
  if (file.type === 'image/gif') return file;
  const bmp    = await createImageBitmap(file);
  const scale  = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale),
  });
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

async function uploadImages() {
  const urls = [];
  for (const { file } of pendingImages) {
    const blob = await compressImage(file);
    const ext  = blob.type === 'image/gif' ? 'gif' : 'jpg';
    const path = `${myAnonId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await sb.storage.from('post-images').upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from('post-images').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

bdAttachBtn.addEventListener('click', () => {
  if (pendingImages.length >= MAX_ATTACH) { alert(`画像は最大${MAX_ATTACH}枚までです`); return; }
  bdFileInput.click();
});

bdFileInput.addEventListener('change', () => {
  const files = Array.from(bdFileInput.files || []);
  for (const file of files) {
    if (pendingImages.length >= MAX_ATTACH) break;
    if (!file.type.startsWith('image/')) continue;
    if (file.size > MAX_FILE_SZ) { alert(`${file.name} は5MBを超えています`); continue; }
    pendingImages.push({ file, objectUrl: URL.createObjectURL(file) });
  }
  bdFileInput.value = '';
  renderImgPreview();
});

// ── ライトボックス（画像タップ拡大） ─────────────────────
bdMain.addEventListener('click', e => {
  const img = e.target.closest('[data-lb]');
  if (img) openLightbox(img.dataset.lb);
});

function openLightbox(url) {
  document.getElementById('bd-lightbox-img').src = url;
  bdLightbox.classList.add('open');
}
function closeLightbox() {
  bdLightbox.classList.remove('open');
  setTimeout(() => { document.getElementById('bd-lightbox-img').src = ''; }, 300);
}
bdLightbox.addEventListener('click', closeLightbox);
document.getElementById('bd-lightbox-close').addEventListener('click', e => {
  e.stopPropagation();
  closeLightbox();
});

// ── ユーティリティ ────────────────────────────────────────
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── エントリーポイント ────────────────────────────────────
window._boardInit = function() { showHome(); };
