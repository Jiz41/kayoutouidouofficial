// ── 自在律A.L.L — スタイル注入 ────────────────────────────
(function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .jizairi-status-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: rgba(255,255,255,.03);
      border-bottom: 1px solid rgba(255,255,255,.08);
      flex-wrap: wrap;
    }
    .jizairi-badge {
      font-size: .75rem;
      font-weight: 600;
      padding: 2px 9px;
      border-radius: 20px;
      white-space: nowrap;
    }
    .jizairi-badge-on  { background: rgba(50,200,100,.18); color: #5de888; border: 1px solid rgba(50,200,100,.35); }
    .jizairi-badge-off { background: rgba(220,60,60,.15);  color: #f07070; border: 1px solid rgba(220,60,60,.30); }
    .jizairi-status-txt {
      font-size: .80rem;
      color: #9aa0b0;
      flex: 1;
      min-width: 0;
    }
    .jizairi-list { padding: 8px 0; }
    .jizairi-row {
      border-bottom: 1px solid rgba(255,255,255,.08);
      cursor: pointer;
    }
    .jizairi-row:hover { background: rgba(255,255,255,.04); }
    .jizairi-row-hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      gap: 8px;
    }
    .jizairi-title {
      font-size: .92rem;
      font-weight: 500;
      color: #e0c97f;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .jizairi-time {
      font-size: .75rem;
      color: #7a8090;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .jizairi-detail {
      display: none;
      padding: 0 16px 12px;
    }
    .jizairi-detail.open { display: block; }
    .jizairi-field { margin-bottom: 10px; }
    .jizairi-field-name {
      font-size: .78rem;
      color: #9aa0b0;
      margin-bottom: 3px;
    }
    .jizairi-field-value {
      font-size: .85rem;
      color: #c8cdd8;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.55;
    }
  `;
  document.head.appendChild(style);
})();

// ── ステータスバー用ヘルパー ──────────────────────────────
function jstHHMM(isoStr) {
  const d = new Date(isoStr);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const h = String(jst.getUTCHours()).padStart(2, '0');
  const m = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${h}時${m}分`;
}

function buildStatusBar(log) {
  if (!log) {
    return `<div class="jizairi-status-bar">
      <span class="jizairi-badge jizairi-badge-off">🔴 停止中</span>
      <span class="jizairi-status-txt">実行記録がありません</span>
    </div>`;
  }
  const age  = Date.now() - new Date(log.executed_at).getTime();
  const on   = age < 90 * 60 * 1000;
  const badge = on
    ? '<span class="jizairi-badge jizairi-badge-on">🟢 稼働中</span>'
    : '<span class="jizairi-badge jizairi-badge-off">🔴 停止中</span>';
  let txt;
  if (log.result === 'found' && log.venue && log.race_num) {
    txt = `最終更新：${escHtml(log.venue)} ${log.race_num}R`;
  } else {
    txt = `${jstHHMM(log.executed_at)} に選定実行・該当レースなし`;
  }
  return `<div class="jizairi-status-bar" id="jizairi-status-bar">
    ${badge}
    <span class="jizairi-status-txt">${txt}</span>
  </div>`;
}

function refreshStatusBar(log) {
  const bar = document.getElementById('jizairi-status-bar');
  if (!bar) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = buildStatusBar(log);
  const newBar = tmp.firstChild;
  bar.replaceWith(newBar);
}

// ── 自在律A.L.L メイン関数 ───────────────────────────────
async function showJizairitu() {
  view = 'jizairitu';
  currentBoard  = null;
  currentThread = null;
  unsubscribe();
  clearPendingImages();

  bdInputBar.style.display   = 'none';
  bdFullBanner.style.display = 'none';
  bdBackBtn.style.display    = 'inline-block';
  bdTitle.textContent        = '👁 自在律A.L.L';
  bdMain.innerHTML           = '<div class="bd-loading">読み込み中…</div>';

  const [postsRes, logRes] = await Promise.all([
    sb.from('discord_posts').select('*').order('timestamp', { ascending: false }).limit(50),
    sb.from('execution_logs').select('*').order('executed_at', { ascending: false }).limit(1),
  ]);

  if (postsRes.error) {
    bdMain.innerHTML = `<div class="bd-empty">エラー: ${escHtml(postsRes.error.message)}</div>`;
    return;
  }

  const latestLog = logRes.data && logRes.data.length ? logRes.data[0] : null;
  const statusHtml = buildStatusBar(latestLog);

  if (!postsRes.data || !postsRes.data.length) {
    bdMain.innerHTML = statusHtml + '<div class="bd-empty">予想データがありません</div>';
  } else {
    renderJizairiList(postsRes.data, statusHtml);
  }

  realtimeChannel = sb.channel('jizairitu_feed')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'discord_posts',
    }, payload => {
      const list = bdMain.querySelector('.jizairi-list');
      if (!list) return;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = jizairiRowHtml(payload.new);
      const newRow = wrapper.firstChild;
      newRow.querySelector('.jizairi-row').addEventListener('click', onJizairiRowClick);
      list.prepend(newRow);
      if (list.children.length > 50) list.lastChild.remove();
    })
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'execution_logs',
    }, payload => {
      refreshStatusBar(payload.new);
    })
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED')    console.log('[自在律] リアルタイム購読成功');
      if (status === 'CHANNEL_ERROR') console.error('[自在律] チャンネルエラー:', err);
    });
}

function renderJizairiList(data, statusHtml = '') {
  bdMain.innerHTML = statusHtml + `<div class="jizairi-list">${data.map(jizairiRowHtml).join('')}</div>`;
  bdMain.querySelectorAll('.jizairi-row').forEach(el => {
    el.addEventListener('click', onJizairiRowClick);
  });
}

function onJizairiRowClick() {
  const detail = this.querySelector('.jizairi-detail');
  if (detail) detail.classList.toggle('open');
}

function jizairiRowHtml(r) {
  const fields = Array.isArray(r.fields) ? r.fields : [];
  const detailHtml = fields.map(f => `
    <div class="jizairi-field">
      <div class="jizairi-field-name">${escHtml(f.name || '')}</div>
      <div class="jizairi-field-value">${escHtml(f.value || '')}</div>
    </div>
  `).join('');

  return `<div class="jizairi-row">
    <div class="jizairi-row-hdr">
      <span class="jizairi-title">${escHtml(r.title || '')}</span>
      <span class="jizairi-time">${formatDate(r.timestamp)}</span>
    </div>
    <div class="jizairi-detail">${detailHtml}</div>
  </div>`;
}
