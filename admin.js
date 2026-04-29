// admin.js — 管理画面ロジック

const SUPABASE_URL = 'https://pqqrfzofzxiuzvxdrcai.supabase.co';
const SUPABASE_KEY = 'sb_publishable_t1AfJtM9h_gYkxg9QL3GXg_-CVV0jaT';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 定数 ─────────────────────────────────────────────────────
const ADMIN_ANON_ID = 'SYSTEM';
const PAGE_SIZE = 30;

// ── 状態 ─────────────────────────────────────────────────────
let currentUser = null;
let boardsCache = [];
let postPage   = 0;
let threadPage = 0;

// ── ユーティリティ ────────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function showMsg(el, msg, isError = false) {
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color = isError ? '#e06060' : '#50a878';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ── 認証 ─────────────────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const adminScreen = document.getElementById('admin-screen');
const loginError  = document.getElementById('login-error');
const loginBtn    = document.getElementById('login-btn');

document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') loginBtn.click();
});

loginBtn.addEventListener('click', async () => {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { showLoginError('メールとパスワードを入力してください'); return; }

  loginBtn.disabled = true;
  loginBtn.textContent = '認証中…';

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  loginBtn.disabled = false;
  loginBtn.textContent = 'ログイン';

  if (error) { showLoginError(error.message); return; }
  currentUser = data.user;
  enterAdmin();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
  adminScreen.style.display = 'none';
  loginScreen.style.display = 'flex';
  currentUser = null;
});

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.style.display = 'block';
}

function enterAdmin() {
  loginScreen.style.display = 'none';
  adminScreen.style.display = 'block';
  document.getElementById('admin-user-email').textContent = currentUser.email;
  initAdmin();
}

// セッション復元
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    enterAdmin();
  }
})();

// ── タブ切替 ─────────────────────────────────────────────────
document.querySelectorAll('.adm-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.adm-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.adm-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'stats') loadStats();
  });
});

// ── 初期化 ────────────────────────────────────────────────────
async function initAdmin() {
  await loadBoards();
  loadPosts();
  loadThreads();
  loadBans();
  loadReports();
}

// ── 板キャッシュ読み込み ─────────────────────────────────────
async function loadBoards() {
  const { data } = await sb.from('boards').select('*').order('sort_order').order('created_at');
  boardsCache = data || [];
  renderBoardsTable();
  populateBoardSelects();
}

function populateBoardSelects() {
  const opts = `<option value="">板: すべて</option>` +
    boardsCache.map(b => `<option value="${esc(b.id)}">${esc(b.emoji)} ${esc(b.name)}</option>`).join('');

  document.getElementById('post-filter-board').innerHTML   = opts;
  document.getElementById('thread-filter-board').innerHTML = opts;

  const newOpts = `<option value="">板を選択</option>` +
    boardsCache.map(b => `<option value="${esc(b.id)}">${esc(b.emoji)} ${esc(b.name)}</option>`).join('');
  document.getElementById('new-thread-board').innerHTML = newOpts;
}

// ── 投稿管理 ─────────────────────────────────────────────────
document.getElementById('post-search-btn').addEventListener('click', () => { postPage = 0; loadPosts(); });
document.getElementById('post-filter-board').addEventListener('change', () => {
  loadThreadsForFilter();
});

async function loadThreadsForFilter() {
  const boardId = document.getElementById('post-filter-board').value;
  const sel = document.getElementById('post-filter-thread');
  if (!boardId) { sel.innerHTML = '<option value="">スレッド: すべて</option>'; return; }
  const { data } = await sb.from('threads').select('id,title').eq('board_id', boardId).order('created_at', { ascending: false });
  sel.innerHTML = '<option value="">スレッド: すべて</option>' +
    (data || []).map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
}

async function loadPosts() {
  const wrap    = document.getElementById('posts-table-wrap');
  const boardId = document.getElementById('post-filter-board').value;
  const threadId = document.getElementById('post-filter-thread').value;
  const anonId  = document.getElementById('post-filter-id').value.trim();
  const keyword = document.getElementById('post-filter-keyword').value.trim();

  wrap.innerHTML = '<div class="adm-loading">読み込み中…</div>';

  let q = sb.from('posts').select('id,thread_id,post_number,anon_id,body,created_at', { count: 'exact' });

  if (threadId)        q = q.eq('thread_id', threadId);
  else if (boardId) {
    const { data: tids } = await sb.from('threads').select('id').eq('board_id', boardId);
    if (tids?.length) q = q.in('thread_id', tids.map(t => t.id));
  }
  if (anonId)  q = q.eq('anon_id', anonId.toUpperCase());
  if (keyword) q = q.ilike('body', `%${keyword}%`);

  q = q.order('created_at', { ascending: false }).range(postPage * PAGE_SIZE, (postPage + 1) * PAGE_SIZE - 1);

  const { data, error, count } = await q;
  if (error) { wrap.innerHTML = `<div class="adm-empty">エラー: ${esc(error.message)}</div>`; return; }
  if (!data?.length) { wrap.innerHTML = '<div class="adm-empty">投稿がありません</div>'; return; }

  wrap.innerHTML = `<div class="adm-table-wrap"><table>
    <thead><tr>
      <th>#</th><th>anon_id</th><th>本文</th><th>投稿日時</th><th>操作</th>
    </tr></thead>
    <tbody>
      ${data.map(p => `<tr>
        <td class="td-mono">${esc(p.post_number)}</td>
        <td class="td-mono">${esc(p.anon_id)}</td>
        <td class="td-body">${esc(p.body).substring(0, 120)}${p.body?.length > 120 ? '…' : ''}</td>
        <td class="td-mono">${fmtDate(p.created_at)}</td>
        <td><div class="td-actions">
          <button class="btn btn-danger" data-del-post="${esc(p.id)}">削除</button>
          <button class="btn btn-ghost" data-ban-id="${esc(p.anon_id)}" style="font-size:11px">BAN</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;

  wrap.querySelectorAll('[data-del-post]').forEach(btn => {
    btn.addEventListener('click', () => deletePost(btn.dataset.delPost));
  });
  wrap.querySelectorAll('[data-ban-id]').forEach(btn => {
    btn.addEventListener('click', () => quickBan(btn.dataset.banId));
  });

  renderPagination('posts-pagination', count, postPage, p => { postPage = p; loadPosts(); });
}

async function deletePost(id) {
  if (!confirm('この投稿を削除しますか？')) return;
  const { error } = await sb.from('posts').delete().eq('id', id);
  if (error) { alert('削除失敗: ' + error.message); return; }
  loadPosts();
}

// ── スレッド管理 ─────────────────────────────────────────────
document.getElementById('new-thread-btn').addEventListener('click', createThread);
document.getElementById('thread-search-btn').addEventListener('click', () => { threadPage = 0; loadThreads(); });

async function createThread() {
  const boardId = document.getElementById('new-thread-board').value;
  const title   = document.getElementById('new-thread-title').value.trim();
  const body    = document.getElementById('new-thread-body').value.trim();
  if (!boardId || !title || !body) { alert('板・タイトル・本文をすべて入力してください'); return; }

  const { error } = await sb.rpc('create_thread', {
    p_board_id: boardId, p_title: title, p_body: body, p_anon_id: ADMIN_ANON_ID
  });
  if (error) { alert('作成失敗: ' + error.message); return; }
  document.getElementById('new-thread-title').value = '';
  document.getElementById('new-thread-body').value  = '';
  loadThreads();
}

async function loadThreads() {
  const wrap    = document.getElementById('threads-table-wrap');
  const boardId = document.getElementById('thread-filter-board').value;
  const keyword = document.getElementById('thread-filter-keyword').value.trim();

  wrap.innerHTML = '<div class="adm-loading">読み込み中…</div>';

  let q = sb.from('threads').select('id,board_id,title,post_count,is_active,created_at', { count: 'exact' });
  if (boardId) q = q.eq('board_id', boardId);
  if (keyword) q = q.ilike('title', `%${keyword}%`);
  q = q.order('created_at', { ascending: false }).range(threadPage * PAGE_SIZE, (threadPage + 1) * PAGE_SIZE - 1);

  const { data, error, count } = await q;
  if (error) { wrap.innerHTML = `<div class="adm-empty">エラー: ${esc(error.message)}</div>`; return; }
  if (!data?.length) { wrap.innerHTML = '<div class="adm-empty">スレッドがありません</div>'; return; }

  const boardMap = Object.fromEntries(boardsCache.map(b => [b.id, b]));

  wrap.innerHTML = `<div class="adm-table-wrap"><table>
    <thead><tr>
      <th>板</th><th>タイトル</th><th>投稿数</th><th>状態</th><th>作成日時</th><th>操作</th>
    </tr></thead>
    <tbody>
      ${data.map(t => {
        const b = boardMap[t.board_id] || {};
        return `<tr>
          <td>${esc(b.emoji || '')} ${esc(b.name || '-')}</td>
          <td>${esc(t.title)}</td>
          <td class="td-mono">${t.post_count}</td>
          <td>${t.is_active
            ? '<span class="badge badge-active">進行中</span>'
            : '<span class="badge badge-closed">満スレ/締切</span>'}</td>
          <td class="td-mono">${fmtDate(t.created_at)}</td>
          <td><div class="td-actions">
            <button class="btn btn-ghost" data-edit-thread="${esc(t.id)}" data-title="${esc(t.title)}" style="font-size:11px">編集</button>
            ${t.is_active ? `<button class="btn btn-primary" data-close-thread="${esc(t.id)}" style="font-size:11px">締切</button>` : ''}
            <button class="btn btn-danger" data-del-thread="${esc(t.id)}" style="font-size:11px">削除</button>
          </div></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;

  wrap.querySelectorAll('[data-edit-thread]').forEach(btn => {
    btn.addEventListener('click', () => editThreadTitle(btn.dataset.editThread, btn.dataset.title));
  });
  wrap.querySelectorAll('[data-close-thread]').forEach(btn => {
    btn.addEventListener('click', () => closeThread(btn.dataset.closeThread));
  });
  wrap.querySelectorAll('[data-del-thread]').forEach(btn => {
    btn.addEventListener('click', () => deleteThread(btn.dataset.delThread));
  });

  renderPagination('threads-pagination', count, threadPage, p => { threadPage = p; loadThreads(); });
}

async function editThreadTitle(id, currentTitle) {
  const title = prompt('新しいタイトルを入力', currentTitle);
  if (!title || title === currentTitle) return;
  const { error } = await sb.from('threads').update({ title }).eq('id', id);
  if (error) { alert('編集失敗: ' + error.message); return; }
  loadThreads();
}

async function closeThread(id) {
  if (!confirm('このスレッドを強制締切にしますか？')) return;
  const { error } = await sb.from('threads').update({ is_active: false }).eq('id', id);
  if (error) { alert('締切失敗: ' + error.message); return; }
  loadThreads();
}

async function deleteThread(id) {
  if (!confirm('このスレッドと全投稿を削除しますか？この操作は取り消せません。')) return;
  const { error } = await sb.from('threads').delete().eq('id', id);
  if (error) { alert('削除失敗: ' + error.message); return; }
  loadThreads();
}

// ── 板管理 ───────────────────────────────────────────────────
document.getElementById('new-board-btn').addEventListener('click', createBoard);

async function createBoard() {
  const emoji = document.getElementById('new-board-emoji').value.trim() || '📋';
  const name  = document.getElementById('new-board-name').value.trim();
  const slug  = document.getElementById('new-board-slug').value.trim();
  if (!name || !slug) { alert('板名とスラッグを入力してください'); return; }
  if (!/^[a-z0-9_-]+$/.test(slug)) { alert('スラッグは英小文字・数字・ハイフン・アンダースコアのみ使用可能です'); return; }

  const maxOrder = boardsCache.reduce((m, b) => Math.max(m, b.sort_order || 0), 0);
  const { error } = await sb.from('boards').insert({ emoji, name, slug, sort_order: maxOrder + 1 });
  if (error) { alert('追加失敗: ' + error.message); return; }
  document.getElementById('new-board-emoji').value = '';
  document.getElementById('new-board-name').value  = '';
  document.getElementById('new-board-slug').value  = '';
  await loadBoards();
}

function renderBoardsTable() {
  const wrap = document.getElementById('boards-table-wrap');
  if (!boardsCache.length) { wrap.innerHTML = '<div class="adm-empty">板がありません</div>'; return; }

  wrap.innerHTML = `<div class="adm-table-wrap"><table>
    <thead><tr>
      <th>順</th><th>絵文字</th><th>板名</th><th>スラッグ</th><th>作成日時</th><th>操作</th>
    </tr></thead>
    <tbody>
      ${boardsCache.map((b, i) => `<tr>
        <td class="td-mono">${b.sort_order ?? i}</td>
        <td style="font-size:20px">${esc(b.emoji)}</td>
        <td>${esc(b.name)}</td>
        <td class="td-mono">${esc(b.slug)}</td>
        <td class="td-mono">${fmtDate(b.created_at)}</td>
        <td><div class="td-actions">
          <div class="order-btns">
            <button class="btn btn-ghost" data-order-up="${i}" style="padding:4px 8px" ${i===0?'disabled':''}>↑</button>
            <button class="btn btn-ghost" data-order-dn="${i}" style="padding:4px 8px" ${i===boardsCache.length-1?'disabled':''}>↓</button>
          </div>
          <button class="btn btn-ghost" data-edit-board="${esc(b.id)}" data-emoji="${esc(b.emoji)}" data-name="${esc(b.name)}" style="font-size:11px">編集</button>
          <button class="btn btn-danger" data-del-board="${esc(b.id)}" style="font-size:11px">削除</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;

  wrap.querySelectorAll('[data-order-up]').forEach(btn => {
    btn.addEventListener('click', () => moveBoardOrder(parseInt(btn.dataset.orderUp), -1));
  });
  wrap.querySelectorAll('[data-order-dn]').forEach(btn => {
    btn.addEventListener('click', () => moveBoardOrder(parseInt(btn.dataset.orderDn), 1));
  });
  wrap.querySelectorAll('[data-edit-board]').forEach(btn => {
    btn.addEventListener('click', () => editBoard(btn.dataset.editBoard, btn.dataset.emoji, btn.dataset.name));
  });
  wrap.querySelectorAll('[data-del-board]').forEach(btn => {
    btn.addEventListener('click', () => deleteBoard(btn.dataset.delBoard));
  });
}

async function moveBoardOrder(idx, dir) {
  const a = boardsCache[idx];
  const b = boardsCache[idx + dir];
  if (!a || !b) return;
  const [oa, ob] = [a.sort_order ?? idx, b.sort_order ?? (idx + dir)];
  await Promise.all([
    sb.from('boards').update({ sort_order: ob }).eq('id', a.id),
    sb.from('boards').update({ sort_order: oa }).eq('id', b.id),
  ]);
  await loadBoards();
}

async function editBoard(id, currentEmoji, currentName) {
  const emoji = prompt('絵文字を入力', currentEmoji);
  if (emoji === null) return;
  const name = prompt('板名を入力', currentName);
  if (!name || name === null) return;
  const { error } = await sb.from('boards').update({ emoji: emoji.trim() || currentEmoji, name: name.trim() }).eq('id', id);
  if (error) { alert('編集失敗: ' + error.message); return; }
  await loadBoards();
}

async function deleteBoard(id) {
  if (!confirm('この板とすべてのスレッド・投稿を削除しますか？この操作は取り消せません。')) return;
  const { error } = await sb.from('boards').delete().eq('id', id);
  if (error) { alert('削除失敗: ' + error.message); return; }
  await loadBoards();
}

// ── ユーザー管理 (ID BAN) ─────────────────────────────────────
document.getElementById('new-ban-btn').addEventListener('click', addBan);
document.getElementById('user-history-btn').addEventListener('click', loadUserHistory);

async function addBan() {
  const anonId = document.getElementById('new-ban-id').value.trim().toUpperCase();
  const reason = document.getElementById('new-ban-reason').value.trim();
  if (!anonId) { alert('anon_id を入力してください'); return; }

  const { error } = await sb.from('bans').insert({ anon_id: anonId, reason: reason || null });
  if (error) { alert('BAN失敗: ' + (error.code === '23505' ? 'すでにBANされています' : error.message)); return; }
  document.getElementById('new-ban-id').value     = '';
  document.getElementById('new-ban-reason').value = '';
  loadBans();
}

async function loadBans() {
  const wrap = document.getElementById('bans-table-wrap');
  const { data, error } = await sb.from('bans').select('*').order('created_at', { ascending: false });
  if (error) { wrap.innerHTML = `<div class="adm-empty">エラー: ${esc(error.message)}</div>`; return; }
  if (!data?.length) { wrap.innerHTML = '<div class="adm-empty">BANされているIDはありません</div>'; return; }

  wrap.innerHTML = `<div class="adm-table-wrap"><table>
    <thead><tr><th>anon_id</th><th>理由</th><th>BAN日時</th><th>操作</th></tr></thead>
    <tbody>
      ${data.map(ban => `<tr>
        <td class="td-mono">${esc(ban.anon_id)}</td>
        <td>${esc(ban.reason || '-')}</td>
        <td class="td-mono">${fmtDate(ban.created_at)}</td>
        <td><button class="btn btn-ghost" data-unban="${esc(ban.id)}" style="font-size:11px">BAN解除</button></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;

  wrap.querySelectorAll('[data-unban]').forEach(btn => {
    btn.addEventListener('click', () => removeBan(btn.dataset.unban));
  });
}

async function removeBan(id) {
  if (!confirm('このBANを解除しますか？')) return;
  const { error } = await sb.from('bans').delete().eq('id', id);
  if (error) { alert('解除失敗: ' + error.message); return; }
  loadBans();
}

async function loadUserHistory() {
  const anonId = document.getElementById('user-history-id').value.trim().toUpperCase();
  const wrap   = document.getElementById('user-history-wrap');
  if (!anonId) { alert('anon_id を入力してください'); return; }

  wrap.innerHTML = '<div class="adm-loading">読み込み中…</div>';
  const { data, error } = await sb
    .from('posts').select('id,thread_id,post_number,body,created_at')
    .eq('anon_id', anonId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) { wrap.innerHTML = `<div class="adm-empty">エラー: ${esc(error.message)}</div>`; return; }
  if (!data?.length) { wrap.innerHTML = `<div class="adm-empty">ID: ${esc(anonId)} の投稿はありません</div>`; return; }

  wrap.innerHTML = `<div class="adm-section-title" style="font-size:14px;margin-bottom:12px">
    ID: <span style="font-family:monospace;color:var(--accent)">${esc(anonId)}</span> の投稿履歴 (${data.length}件)
  </div>
  <div class="adm-table-wrap"><table>
    <thead><tr><th>#</th><th>本文</th><th>投稿日時</th><th>操作</th></tr></thead>
    <tbody>
      ${data.map(p => `<tr>
        <td class="td-mono">${esc(p.post_number)}</td>
        <td class="td-body">${esc(p.body).substring(0, 200)}</td>
        <td class="td-mono">${fmtDate(p.created_at)}</td>
        <td><button class="btn btn-danger" data-del-post="${esc(p.id)}" style="font-size:11px">削除</button></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;

  wrap.querySelectorAll('[data-del-post]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('削除しますか？')) return;
      await sb.from('posts').delete().eq('id', btn.dataset.delPost);
      loadUserHistory();
    });
  });
}

function quickBan(anonId) {
  document.querySelectorAll('.adm-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.adm-section').forEach(s => s.classList.remove('active'));
  document.querySelector('[data-tab="users"]').classList.add('active');
  document.getElementById('tab-users').classList.add('active');
  document.getElementById('new-ban-id').value = anonId;
  document.getElementById('new-ban-id').focus();
}

// ── 通報管理 ─────────────────────────────────────────────────
document.getElementById('report-search-btn').addEventListener('click', loadReports);

async function loadReports() {
  const wrap   = document.getElementById('reports-table-wrap');
  const status = document.getElementById('report-filter-status').value;

  wrap.innerHTML = '<div class="adm-loading">読み込み中…</div>';

  let q = sb.from('reports').select('id,post_id,reason,reporter_id,is_resolved,created_at').order('created_at', { ascending: false });
  if (status === 'pending')  q = q.eq('is_resolved', false);
  if (status === 'resolved') q = q.eq('is_resolved', true);

  const { data, error } = await q.limit(200);
  if (error) { wrap.innerHTML = `<div class="adm-empty">エラー: ${esc(error.message)}</div>`; return; }
  if (!data?.length) { wrap.innerHTML = '<div class="adm-empty">通報はありません</div>'; return; }

  wrap.innerHTML = `<div class="adm-table-wrap"><table>
    <thead><tr><th>通報日時</th><th>理由</th><th>通報者ID</th><th>状態</th><th>操作</th></tr></thead>
    <tbody>
      ${data.map(r => `<tr>
        <td class="td-mono">${fmtDate(r.created_at)}</td>
        <td>${esc(r.reason)}</td>
        <td class="td-mono">${esc(r.reporter_id || '-')}</td>
        <td>${r.is_resolved
          ? '<span class="badge badge-resolved">対応済み</span>'
          : '<span class="badge badge-pending">未対応</span>'}</td>
        <td><div class="td-actions">
          ${!r.is_resolved
            ? `<button class="btn btn-success" data-resolve="${esc(r.id)}" style="font-size:11px">対応済みに</button>`
            : `<button class="btn btn-ghost" data-unresolve="${esc(r.id)}" style="font-size:11px">未対応に戻す</button>`}
          <button class="btn btn-danger" data-del-report="${esc(r.id)}" style="font-size:11px">削除</button>
        </div></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;

  wrap.querySelectorAll('[data-resolve]').forEach(btn => {
    btn.addEventListener('click', () => setReportResolved(btn.dataset.resolve, true));
  });
  wrap.querySelectorAll('[data-unresolve]').forEach(btn => {
    btn.addEventListener('click', () => setReportResolved(btn.dataset.unresolve, false));
  });
  wrap.querySelectorAll('[data-del-report]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('この通報を削除しますか？')) return;
      await sb.from('reports').delete().eq('id', btn.dataset.delReport);
      loadReports();
    });
  });
}

async function setReportResolved(id, resolved) {
  const { error } = await sb.from('reports').update({ is_resolved: resolved }).eq('id', id);
  if (error) { alert('更新失敗: ' + error.message); return; }
  loadReports();
}

// ── 統計 ─────────────────────────────────────────────────────
async function loadStats() {
  const [boardsRes, threadsRes, postsRes, bansRes, reportsRes] = await Promise.all([
    sb.from('boards').select('*', { count: 'exact', head: true }),
    sb.from('threads').select('*', { count: 'exact', head: true }),
    sb.from('posts').select('*', { count: 'exact', head: true }),
    sb.from('bans').select('*', { count: 'exact', head: true }),
    sb.from('reports').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
  ]);
  document.getElementById('stat-boards').textContent  = boardsRes.count  ?? '-';
  document.getElementById('stat-threads').textContent = threadsRes.count ?? '-';
  document.getElementById('stat-posts').textContent   = postsRes.count   ?? '-';
  document.getElementById('stat-bans').textContent    = bansRes.count    ?? '-';
  document.getElementById('stat-reports').textContent = reportsRes.count ?? '-';
}

// ── ページネーション ──────────────────────────────────────────
function renderPagination(containerId, total, page, onChange) {
  const el    = document.getElementById(containerId);
  const pages = Math.ceil((total || 0) / PAGE_SIZE);
  if (pages <= 1) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <button class="btn btn-ghost" ${page === 0 ? 'disabled' : ''} data-pg="${page - 1}">← 前</button>
    <span>${page + 1} / ${pages} ページ（計 ${total} 件）</span>
    <button class="btn btn-ghost" ${page >= pages - 1 ? 'disabled' : ''} data-pg="${page + 1}">次 →</button>
  `;
  el.querySelectorAll('[data-pg]').forEach(btn => {
    btn.addEventListener('click', () => onChange(parseInt(btn.dataset.pg)));
  });
}
