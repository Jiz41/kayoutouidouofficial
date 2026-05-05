// ── ニュース速報 ─────────────────────────────────────────

const NEWS_CATEGORIES = [
  { key: null,               label: 'すべて' },
  { key: '競輪',             label: '競輪' },
  { key: '競馬',             label: '競馬' },
  { key: '競艇',             label: '競艇' },
  { key: 'オート',           label: 'オート' },
  { key: 'パチンコ・スロット', label: 'パチ&スロ' },
  { key: 'ネタ・おもしろ',   label: 'ネタ' },
  { key: '一般ニュース',     label: '一般' },
  { key: 'AI・ガジェット',   label: 'AI/ガジェット' },
];

// カテゴリに対応したアクセントカラー（color列と対応）
const NEWS_COLOR_MAP = {
  '競輪':             '#4e8fff',
  '競馬':             '#f2a336',
  '競艇':             '#3db87a',
  'オート':           '#e85c5c',
  'パチンコ・スロット': '#9b6dcc',
  'ネタ・おもしろ':   '#ffe135',
  '一般ニュース':     '#909090',
  'AI・ガジェット':   '#35c4b5',
};

let newsCurrentCategory = null;

async function showNews(category = null) {
  view = 'news';
  newsCurrentCategory = category;
  currentBoard  = null;
  currentThread = null;
  unsubscribe();
  clearPendingImages();

  bdInputBar.style.display   = 'none';
  bdFullBanner.style.display = 'none';
  bdBackBtn.style.display    = 'inline-block';
  bdTitle.textContent        = '📰 ニュース速報';

  renderBoardsNav();
  bdMain.innerHTML = '<div class="bd-loading">読み込み中…</div>';
  await loadNews(category);
}

async function loadNews(category) {
  let query = sb
    .from('news_posts')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(100);

  if (category) query = query.eq('category', category);

  const { data, error } = await query;

  if (error) {
    bdMain.innerHTML = `<div class="bd-empty">エラー: ${escHtml(error.message)}</div>`;
    return;
  }

  renderNewsList(data || [], category);
}

function renderNewsList(data, activeCategory) {
  const filterHtml = `
    <div class="news-filter-bar">
      ${NEWS_CATEGORIES.map(c => `
        <button class="news-filter-btn${activeCategory === c.key ? ' active' : ''}"
                data-cat="${c.key === null ? '' : c.key}">
          ${escHtml(c.label)}
        </button>
      `).join('')}
    </div>
  `;

  const listHtml = data.length === 0
    ? '<div class="bd-empty">記事がありません</div>'
    : `<div class="news-list">${data.map(newsItemHtml).join('')}</div>`;

  bdMain.innerHTML = filterHtml + listHtml;

  bdMain.querySelectorAll('.news-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat || null;
      newsCurrentCategory = cat;
      bdMain.innerHTML = '<div class="bd-loading">読み込み中…</div>';
      loadNews(cat).then(() => {
        renderBoardsNav();
      });
    });
  });
}

function newsItemHtml(item) {
  const accent = (item.category && NEWS_COLOR_MAP[item.category]) || '#c8a060';
  const catLabel = item.category ? escHtml(item.category) : '';
  const time = item.published_at ? formatDate(item.published_at) : '';

  return `<a class="news-item" href="${escHtml(item.url || '#')}" target="_blank" rel="noopener noreferrer">
    <div class="news-item-accent" style="background:${accent}"></div>
    <div class="news-item-body">
      <div class="news-item-title">${escHtml(item.title || '')}</div>
      <div class="news-item-meta">
        ${catLabel ? `<span class="news-item-cat">${catLabel}</span>` : ''}
        <span class="news-item-time">${time}</span>
      </div>
    </div>
  </a>`;
}
