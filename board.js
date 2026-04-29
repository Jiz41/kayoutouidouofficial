/**
 * board.js — 掲示板ロジック（Supabase連携）
 *
 * 依存: supabase-js@2 (CDN)
 * 初期化: window._boardInit() を呼ぶと板一覧を表示
 *
 * 編集ポイント:
 *   - SUPABASE_URL / SUPABASE_KEY: 接続情報
 *   - renderPost():    投稿のHTML生成
 *   - processBody():   本文パース（アンカー・画像・URL）
 *   - formatDate():    日時フォーマット
 */

// ── 接続情報 ─────────────────────────────────────────────
const SUPABASE_URL = 'https://pqqrfzofzxiuzvxdrcai.supabase.co';
const SUPABASE_KEY = 'sb_publishable_t1AfJtM9h_gYkxg9QL3GXg_-CVV0jaT';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 匿名ID（24hリセットはサーバー側で管理） ──────────────
let myAnonId = localStorage.getItem('kayou_anon_id');
if (!myAnonId) {
  myAnonId = Math.random().toString(36).slice(2, 10).toUpperCase();
  localStorage.setItem('kayou_anon_id', myAnonId);
}

// ── アプリ状態 ────────────────────────────────────────────
let view = 'boards';   // 'boards' | 'threads' | 'posts'
let currentBoard  = null;
let currentThread = null;
let realtimeChannel = null;
let posts  = [];
let boards = [];

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

// サイドバー内 板ナビ再描画
function renderBoardsNav() {
  bdBoardsNav.innerHTML = boards.map(b => {
    const active = currentBoard && currentBoard.id === b.id ? 'active' : '';
    return `<button class="bd-board-btn ${active}" data-id="${b.id}">
      <span class="bd-emoji">${escHtml(b.emoji || '📋')}</span>
      <span class="bd-bname">${escHtml(b.name)}</span>
      <span class="bd-indicator"></span>
    </button>`;
  }).join('');

  bdBoardsNav.querySelectorAll('.bd-board-btn').forEach(btn => {
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
  bdInputBar.style.display = 'none';
  bdBackBtn.style.display  = 'none';
  bdFullBanner.style.display = 'none';
  bdTitle.textContent = '華耀東夷堂';
  bdMain.innerHTML = '<div class="bd-loading">読み込み中…</div>';

  const { data, error } = await sb.from('boards').select('*').order('created_at');
  if (error) { bdMain.innerHTML = `<div class="bd-empty">エラー: ${escHtml(error.message)}</div>`; return; }
  if (!data.length) { bdMain.innerHTML = '<div class="bd-empty">板がありません</div>'; return; }

  boards = data;
  renderBoardsNav();

  bdMain.innerHTML = data.map((b, i) => `
    <div class="bd-thread-item" data-bid="${b.id}">
      <div class="bd-thread-title">${escHtml(b.emoji || '📋')} ${escHtml(b.name)}</div>
    </div>
    ${i < data.length - 1 ? '<div class="bd-thread-sep"></div>' : ''}
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
  bdInputBar.style.display   = 'none';
  bdFullBanner.style.display = 'none';
  bdBackBtn.style.display    = 'inline-block';
  bdTitle.textContent        = `${board.emoji || ''} ${board.name}`;
  bdMain.innerHTML = '<div class="bd-loading">読み込み中…</div>';
  renderBoardsNav();

  const { data, error } = await sb
    .from('threads')
    .select('*')
    .eq('board_id', board.id)
    .order('created_at', { ascending: false });

  if (error) { bdMain.innerHTML = `<div class="bd-empty">エラー: ${escHtml(error.message)}</div>`; return; }

  // ※ スレッド作成ボタンは管理ページ専用のため、ここには表示しない
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

      // el.firstChild移動後にelが空になるバグを修正: postElで参照を保持
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderPost(p, 0); // i=0でseparator prefixを抑制（外側のsepで管理）
      const postEl = wrapper.firstChild;
      bdMain.appendChild(sep);
      bdMain.appendChild(postEl);

      postEl.querySelectorAll('.bd-post-num').forEach(e => {
        e.addEventListener('click', () => quotePost(Number(e.dataset.num)));
      });

      currentThread.post_count = (currentThread.post_count || 0) + 1;
      if (currentThread.post_count >= 1000) {
        currentThread.is_active  = false;
        bdInputBar.style.display = 'none';
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
  const body = bdTextarea.value.trim();
  if (!body || !currentThread?.is_active) return;

  bdSendBtn.disabled = true;
  const { error } = await sb.rpc('insert_post', {
    p_thread_id: currentThread.id,
    p_body:      body,
    p_anon_id:   myAnonId,
  });
  bdSendBtn.disabled = false;

  if (!error) {
    bdTextarea.value = '';
    bdTextarea.style.height = 'auto';
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

// ── スレッド作成モーダル（管理ページ用、一般画面からは非表示） ─
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
  if (view === 'posts')   showThreads(currentBoard);
  else if (view === 'threads') showBoards();
});

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
function processBody(body) {
  let s = escHtml(body);
  // >>N アンカー
  s = s.replace(/&gt;&gt;(\d+)/g, (_, n) =>
    `<a class="anchor" href="#post-${n}"
      onmouseenter="showAnchorPopup(event,${n})"
      onmouseleave="hideAnchorPopup()"
      onclick="event.preventDefault();scrollToPost(${n})">&gt;&gt;${n}</a>`);
  // pbs.twimg.com 画像を inline 表示
  s = s.replace(/(https?:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_\-?=&%.]+)/g, url => {
    const u = url.replace(/&amp;/g, '&');
    return `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" class="inline-img" loading="lazy"></a>`;
  });
  // その他 URL
  s = s.replace(/(https?:\/\/(?!pbs\.twimg\.com\/media\/)[^\s<&]+)/g, url =>
    `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  return s.replace(/\n/g, '<br>');
}

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

// ── エントリーポイント（flow.js から呼ばれる） ────────────
window._boardInit = function() { showBoards(); };
