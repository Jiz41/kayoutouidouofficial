// ── 自在律A.L.L — スタイル注入 ────────────────────────────
(function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
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

  const { data, error } = await sb
    .from('discord_posts')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(50);

  if (error) {
    bdMain.innerHTML = `<div class="bd-empty">エラー: ${escHtml(error.message)}</div>`;
    return;
  }

  if (!data || !data.length) {
    bdMain.innerHTML = '<div class="bd-empty">予想データがありません</div>';
    return;
  }

  renderJizairiList(data);

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
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED')    console.log('[自在律] リアルタイム購読成功');
      if (status === 'CHANNEL_ERROR') console.error('[自在律] チャンネルエラー:', err);
    });
}

function renderJizairiList(data) {
  bdMain.innerHTML = `<div class="jizairi-list">${data.map(jizairiRowHtml).join('')}</div>`;
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
