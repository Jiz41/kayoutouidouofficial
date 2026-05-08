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
        <p>華耀東夷堂公式サイト、華耀大衛星へようこそ。</p>
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

// ── リンクページ ─────────────────────────────────────────────
const LINKS_DATA = [
  {
    title:   '華耀天輪 真自在律 / Kayou Tenrin Shinjizairitsu',
    desc:    'ここに流れてくる予想の、素の姿です。\nレースを選び、ボタンを押し、結果を見る。\n自動化される前の、人の手が入った自在律がここにあります。\nやりたいレースがあるなら、こちらへどうぞ。',
    url:     'https://huggingface.co/spaces/Jiz41/Jiz41r1t5u',
    label:   'Hugging Face で開く',
  },
  {
    title:   '号外真自在律 成績一覧＆熱度分布図',
    desc:    '真自在律（マニュアル版）の予想成績を集計・可視化したデータページです。的中率・回収率・令種別精度・開催場別成績など、蓄積されたデータを多角的に確認することで、真自在律の強みと傾向を把握できます。',
    url:     'https://jiz41-jiz41r1t5u.static.hf.space/gg_snjzirt.html',
    label:   'データを見る',
  },
  {
    title:   '華耀東夷堂 X',
    desc:    '速報・お知らせ・たまに独り言。\nこのサイトが静かな夜でも、Xは騒がしくしています。\n何かあればまずXを見てください。たぶん何か言っています。',
    url:     'https://x.com/kayoutouidou01',
    label:   'X で開く',
  },
  {
    title:   '華耀東夷堂 note',
    desc:    '自在律はなぜこう動くのか。華耀東夷堂はどこへ向かうのか。\n長い話はnoteに書いています。\n読み物として、暇な時にでも。',
    url:     'https://note.com/kytnrnsnjzitr',
    label:   'note で読む',
  },
];

function showColumn() {
  view = 'column';
  currentBoard  = null;
  currentThread = null;
  unsubscribe();
  clearPendingImages();

  bdInputBar.style.display   = 'none';
  bdFullBanner.style.display = 'none';
  bdBackBtn.style.display    = 'inline-block';
  bdTitle.textContent        = '📐 設計ノート';

  renderBoardsNav();

  bdMain.innerHTML = `
<div class="column-wrap">

  <div class="home-section">
    <h2 class="column-h2">真・自在律 設計ノート</h2>
  </div>

  <div class="home-divider"></div>

  <div class="home-section">
    <h3 class="column-h3">1｜「自在」という名の杖</h3>
    <p>競輪予想の世界には情報が多いです。ヤジ、噂、予想紙、SNSの声。その誰もがレース前には結果を知らない。それが競輪です。それでも人は確信を持って語り、数字を示します。<br>そういう言葉に四方から囲まれながら、自分の軸を<br>持って勝負の場に立ち続けることは、思いのほか難しいです。</p>
    <p>「自在」という言葉を、私は競輪用語としてだけでなく、<strong>「自らがそこに在る形」</strong>として解釈しています。周囲に流されず、自分自身の判断で車券と向き合える状態。それが競輪という世界において、最も価値ある境地だと考えています。</p>
    <p>真・自在律は、「答え」を提供するツールではありません。不誠実な期待感を示し、依存を促すような在り方を、私は良しとしません。このツールが差し出すのは、客観的な法則とデータに基づいて構造化された<strong>「判断の材料」</strong>です。</p>
    <p>使う人間が自分の頭で考え、自分の足で立つための補助線。杖、と呼んでいます。</p>
    <p>最終的にこの杖が要らなくなったとき——自分だけの予想スタイルを確立し、ツールなしで堂々と勝負に臨めるようになったとき——このツールは最高の役目を終えます。</p>
    <p>そのためにコードを書いています。</p>
  </div>

  <div class="home-divider"></div>
  <div class="home-section"><p class="column-italic">思想の話をしました。では実際に何をやっているのか。2026年5月3日、西武園4Rを例に追いかけてみます。</p></div>
  <div class="home-divider"></div>

  <div class="home-section">
    <h3 class="column-h3">2｜レースデータが買い目になるまで</h3>
    <p><strong>2026年5月3日 西武園4R Aチャレンジ 南4.5m</strong></p>
    <p style="margin-bottom:8px; color:#9aa0b0; font-size:0.85em;">計算の流れを動画でも解説しています。</p>
    <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; margin-bottom:24px;">
      <iframe
        src="https://www.youtube.com/embed/H-4jRPPhWmg"
        style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"
        allowfullscreen>
      </iframe>
    </div>
    <table class="column-table">
      <thead><tr><th>車番</th><th>選手名</th><th>府県</th><th>スタイル</th><th>印</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>石井　毅</td><td>神奈川</td><td>追</td><td>◎</td></tr>
        <tr><td>2</td><td>薮　謙治</td><td>京都</td><td>追</td><td>〇</td></tr>
        <tr><td>3</td><td>武田　和也</td><td>奈良</td><td>両</td><td>△</td></tr>
        <tr><td>4</td><td>南　大輔</td><td>京都</td><td>追</td><td>無</td></tr>
        <tr><td>5</td><td>吉松　賢二</td><td>群馬</td><td>両</td><td>✕</td></tr>
        <tr><td>6</td><td>長崎　達也</td><td>神奈川</td><td>両</td><td>無</td></tr>
        <tr><td>7</td><td>千澤　大輔</td><td>青森</td><td>追</td><td>無</td></tr>
      </tbody>
    </table>
    <p>ライン構成：<code class="column-code">3-2-4 / 5-1-6 / 7（単騎）</code></p>
    <p>結果：<strong>2-3-1（薮→武田→石井）差し 🎯的中</strong></p>
    <p>ボタンを押してから買い目が出るまで、10のステップがあります。このレースを例に、数値がどう変換されていくかを順番に見ていきます。</p>

    <div class="home-divider"></div>

    <p class="column-step-label">STEP 1｜レース情報の取得</p>
    <p>Render.com上のAPIから出走情報を取得します。7選手のスコア、スタイル、印、直近成績、バンクデータが揃います。</p>
    <pre class="column-pre"><code>バンク: 西武園
直線: 47.6m / カント: 29.45度 / alpha: 0.88 / beta: 0.68
先行バイアス: 1.05 / 捲りバイアス: 1.00 / 差しバイアス: 0.98</code></pre>

    <p class="column-step-label">STEP 2｜気象データの取得</p>
    <p>open-meteoから風速・風向を取得します。このレースは南4.5m。認証不要の公開APIです。APIキーは存在しません。</p>
    <pre class="column-pre"><code>wind: { speed: 4.5, direction: "南" }</code></pre>

    <p class="column-step-label">STEP 3｜係数の構築</p>
    <p>7選手それぞれに係数を積み上げます。ライン係数c_lは「先頭=ベースライン」「番手が恩恵を受ける」相対補正設計です。先頭にボーナスがかかるのではなく、後ろにつく選手がラインの恩恵を数値として受け取ります。</p>
    <pre class="column-pre"><code>武田（3）: score=71.42 / △ / 両 / 直近241 / c_l=1.0  （先頭・ベースライン）
薮　（2）: score=73.88 / 〇 / 追 / 直近324 / c_l=1.04 （番手・ライン恩恵）
南　（4）: score=70.88 / 無 / 追 / 直近736 / c_l=1.024（3番手・ライン恩恵）

吉松（5）: score=70.59 / ✕ / 両 / 直近153 / c_l=1.0  （先頭・ベースライン）
石井（1）: score=74.0  / ◎ / 追 / 直近522 / c_l=1.04 （番手・ライン恩恵）
長崎（6）: score=69.5  / 無 / 両 / 直近637 / c_l=1.0  （3番手・恩恵なし）

千澤（7）: score=66.04 / 無 / 追 / 直近725 / c_l=1.0  （単騎）</code></pre>
    <p>番手係数の計算式：</p>
    <pre class="column-pre"><code>// COOP_WEIGHT=0.8
// 番手:   1.0 + 0.8 × 0.05 = 1.04
// 3番手:  1.0 + 0.8 × 0.03 = 1.024
p.c_l = 1.0 + coop * 0.05</code></pre>

    <p class="column-step-label">STEP 4｜風速補正の計算</p>
    <p>南4.5mをバンクのbeta値0.68で補正し、実効風速を得ます。</p>
    <pre class="column-pre"><code>v = 4.5 × 0.68 = 3.06</code></pre>
    <p>v=3.06は第2区間の式が適用されます。</p>
    <pre class="column-pre"><code>kp = 0.15 + Math.pow(3.06 - 3.0, 1.8) × 0.085 = 0.1503</code></pre>
    <p>直線長補正を乗せます。</p>
    <pre class="column-pre"><code>kp × (47.6 / 50) = 0.1503 × 0.952 = 0.1431</code></pre>
    <p>南風は西武園では追い風方向。先行選手のpositionShield=1.00として最終補正値を算出します。</p>
    <pre class="column-pre"><code>finalAdj = 1.0 + (1.0 × 0.1431 × 0.88 × 1.00) = 1.0259</code></pre>
    <p>スナップショットの記録値<code class="column-code">finalAdj: 1.0252</code>とほぼ一致します。この値が全選手のfinal_scoreに乗算されます。</p>

    <p class="column-step-label">STEP 5｜シミュレーション</p>
    <p>晴天令・荒天令の2種類を実行します。先行有利・捲り有利・差し有利の3シナリオを加重平均して最終スコアを算出します。</p>
    <p>晴天令：</p>
    <pre class="column-pre"><code>石井（1）: 242.38  ← 首位
薮　（2）: 236.99
武田（3）: 227.18
吉松（5）: 216.52
南　（4）: 187.51
長崎（6）: 176.53
千澤（7）: 168.34</code></pre>
    <p>荒天令ではAチャレンジの揺らぎ幅0.40が加味され、スコア分布が変化します。</p>
    <pre class="column-pre"><code>石井（1）: 243.35
薮　（2）: 242.82  ← 晴天との差が縮まる
武田（3）: 227.18
吉松（5）: 216.52</code></pre>

    <p class="column-step-label">STEP 6｜買い目の生成</p>
    <p>晴天令上位から三連単・三連複、荒天令では特異点5番（吉松）を軸に波乱の目を生成します。</p>
    <pre class="column-pre"><code>晴天令: 1-2-3 / 1-3-2 / 2-1-3 / 2-3-1 / 1=2=3
荒天令: 1=2=5 / 1=3=5 / 1-5 / 5-1 / 3-1</code></pre>

    <p class="column-step-label">STEP 7｜赤口呑縁</p>
    <p>同じbasePlayers配列を使って1465回のモンテカルロシミュレーションを実行します。Aチャレンジの揺らぎ幅0.40が1465通りの並行世界でそれぞれ乗算され、確率的な観点から買い目を補完します。</p>

    <p class="column-step-label">STEP 8｜ログ送信</p>
    <p>予想結果と係数スナップショットをGASに送信して記録します。このデータが後のハズレ解析に使われます。</p>

    <p><strong>結果：2-3-1（薮→武田→石井）差し 🎯的中</strong></p>
    <p>晴天令三連単「2-3-1」が的中しました。</p>
  </div>

  <div class="home-divider"></div>
  <div class="home-section"><p class="column-italic">全体の流れを追いました。ここから各計算の詳細に入ります。まず風から。</p></div>
  <div class="home-divider"></div>

  <div class="home-section">
    <h3 class="column-h3">3｜天候・荒天ロジック</h3>
    <p><strong>風は、数字で読めます。</strong></p>
    <p>先ほど見たように、南4.5mという入力は実効風速3.06に変換され、最終的に1.0252という補正値としてスコアに乗りました。この変換過程を詳しく見ます。</p>
    <p>風速は3段階の累乗加速で係数化されます。弱風のうちは影響が小さく、強くなるほど指数的に効いてくる設計です。</p>
    <pre class="column-pre"><code>if (v &lt;= 3.0) kp = v * 0.05;
else if (v &lt;= 7.0) kp = 0.15 + Math.pow(v-3.0, 1.8) * 0.085;
else               kp = 0.51 + Math.pow(v-7.0, 3.0) * 0.3;</code></pre>
    <p>風は選手全員に均等にかかるわけではありません。ライン内の位置によって遮蔽効果が変わります。前を走る選手が風を受けている間、後ろは守られています。</p>
    <pre class="column-pre"><code>// 位置シールド（ライン内の遮蔽効果）
先行:1.00 / 番手:0.65 / 3番手以降:0.50</code></pre>
    <p>斜め風は2方向のベクトルを√2/2で補間して計算します。「北東の風」という入力をそのまま数値に変換できます。最終補正値はスコアに直接乗算されます。</p>
    <pre class="column-pre"><code>finalAdj = 1.0 + (vector * kp * alpha * positionShield)</code></pre>
    <p>荒天令では、レース中の突発的な風の変化も再現されます。</p>
    <pre class="column-pre"><code>const rand = Math.random();
if (rand &lt; 0.33) {        // 追い風：逃/自/両 ×1.15、他 ×0.95
} else if (rand &lt; 0.66) { // 向かい風：追/両 ×1.15、他 ×0.90
}                         // 0.66以上：横風（影響なし）</code></pre>
    <p>グレードによって揺らぎの幅も変わります。S級は安定、チャレンジは混沌。</p>
    <pre class="column-pre"><code>const flutterMap = {
  's-kyu':  { min: 0.90, range: 0.20 },
  'a-kyu':  { min: 0.85, range: 0.30 },
  'girls':  { min: 0.85, range: 0.30 },
  'a-chal': { min: 0.80, range: 0.40 },
};
p.final_score *= (flutter.min + Math.random() * flutter.range);</code></pre>
    <p>Aチャレンジは揺らぎ幅0.40——最も混沌とした設計です。このレースで荒天令のスコア分布が晴天令と接近したのは、この揺らぎが原因のひとつです。</p>
  </div>

  <div class="home-divider"></div>
  <div class="home-section"><p class="column-italic">風の補正がスコアに乗ります。そのスコアがどう計算されているか。</p></div>
  <div class="home-divider"></div>

  <div class="home-section">
    <h3 class="column-h3">4｜選手スコアと1465回の審判</h3>
    <p><strong>スコアは、一行の式で決まります。</strong></p>
    <p>石井毅（1番車、score=74.0）を例に、final_scoreの計算を追います。</p>
    <pre class="column-pre"><code>p.final_score =
  p.score * p.c_score_adj * p.c_wmark * p.c_recent
  * p.c_s1 * p.c_b1 * p.c_l * p.c_e;
p.final_score *= (p.physicalPenalty    || 1.0);
p.final_score /= (p.cantoMakuriPenalty || 1.0);
p.final_score *= (p.warpBoost          || 1.0);
p.final_score *= res.adj; // 風速補正</code></pre>
    <p>石井の各係数を当てはめます。</p>
    <pre class="column-pre"><code>74.0 × 1.0（c_score_adj）
     × 1.0（c_wmark: ◎）
     × 1.0（c_recent: 直近522）
     × 1.0（c_s1）× 1.0（c_b1）
     × 1.04（c_l: 5-1-6ライン番手）
     × 1.0（c_e）
     × 1.0（physicalPenalty）
     × 1.0252（finalAdj: 風速補正）
= 74.0 × 1.04 × 1.0252
≒ 78.9</code></pre>
    <p>これが3シナリオの加重平均を経て、晴天令スコア242.38に集約されます。</p>
    <p>競り（SERI）が発生した場合、勝者は実質10%減、敗者は25%減です。「競りで負けた選手はほぼ死ぬ」という実戦経験則をそのまま数値にしました。</p>
    <pre class="column-pre"><code>// 勝者(IN)：15%減+5%ボーナスで実質10%減
// 敗者(OUT)：25%減（「ほぼ死ぬ」状態）
const SERI_FATIGUE_PENALTY_IN  = 0.15;
const SERI_FATIGUE_PENALTY_OUT = 0.25;
const SERI_WIN_BONUS           = 0.05;</code></pre>
    <p>このレースでは競りは発生しませんでした。イン突き（ワープ）が成立した場合は×1.35のブーストがかかります。</p>
    <pre class="column-pre"><code>// 約35%のアドバンテージは実戦上の「イン突きはそういうもの」に準拠
p.warpBoost = 1.35;</code></pre>
    <p>スコアが出揃ったあと、赤口呑縁が起動します。</p>
    <p>1465回——ドクター・ストレンジが観測した並行世界数へのオマージュです。Marvel作品の中で彼は1400万605通りの未来を観測し、勝利への唯一の道を探しました。競輪における「唯一の正解」を探す儀術として、この数字を選びました。</p>
    <pre class="column-pre"><code>// 1465：ドクター・ストレンジが観測した並行世界数へのオマージュ
const TOTAL_ITERATIONS = 1465;</code></pre>
    <p>Aチャレンジの揺らぎ幅は最大0.40。1465通りの並行世界でそれぞれスコアが揺れ、着順が積み上がります。その集計が最終的な確率分布になります。マジックナンバーに見えるかもしれませんが、すべてに根拠があります。</p>
  </div>

  <div class="home-divider"></div>
  <div class="home-section"><p class="column-italic">計算の話はここまでです。このコードがどう外の世界と繋がっているかを。</p></div>
  <div class="home-divider"></div>

  <div class="home-section">
    <h3 class="column-h3">5｜秘匿情報の扱い</h3>
    <p><strong>隠すべきものは、隠しています。</strong></p>
    <p>このツールが外部APIを呼び出す箇所は2つあります。</p>
    <p>天気データの取得にはopen-meteoを使用しています。認証不要の公開APIです。APIキーは存在しないので、ハードコードもありません。</p>
    <pre class="column-pre"><code>const url = \`https://api.open-meteo.com/v1/forecast
  ?latitude=\${lat}&amp;longitude=\${lon}
  &amp;current=wind_speed_10m,wind_direction_10m
  &amp;timezone=Asia/Tokyo\`;
// APIキー不要の公開API。秘匿情報なし。</code></pre>
    <p>予想結果のログ送信にはGASのWebhookエンドポイントを使用しています。このツールはブラウザJSのため構造上環境変数が使えません。URLが漏洩しても余分なログが書き込まれる程度であり、GAS側のpayload検証で不正リクエストを弾いています。</p>
    <pre class="column-pre"><code>const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycby.../exec";
// 係数スナップショット・予想結果をPOST送信</code></pre>
    <p>APIキーやトークンの類は、このコードベースには存在しません。公開できるコードと、そうでないものの区別。それがオープンに開発することの最低限の作法だと考えています。</p>
  </div>

  <div class="home-divider"></div>
  <div class="home-section"><p class="column-italic">コードの話はここまでです。最後に、これからのことを少しだけ。</p></div>
  <div class="home-divider"></div>

  <div class="home-section">
    <h3 class="column-h3">6｜もっと当たるように、もっと自由に</h3>
    <p>真・自在律は、今もまだ製作途中です。<br>サグラダ・ファミリアの様に多分とても長い期間をかけて完成するとおもいます。</p>
    <p>2025年11月に作り始めました。自分の予想があまりに当たらない悲しみが出発点です。当初は「当てなければ死」という気持ちで作っていました。今は違います。負けに不思議の負けなし——ハズレにこそ価値があると思っています。ハズレを積み上げることが、正解への最短経路だと。</p>
    <p>現在の成績はこうです。</p>
    <pre class="column-pre"><code>晴天令三連単（4点）: 的中率13.6% / 回収率75.2%
晴天令三連複（1点）: 的中率18.6% / 回収率95.7%
荒天令三連複（2点）: 的中率20.0% / 回収率100.3%
荒天令二車単（3点）: 的中率17.3% / 回収率93.0%</code></pre>
    <p>荒天令三連複が唯一回収率100%を超えています。晴天令三連単はまだ悔しい数字です。もっと当てられるはずだという確信があります。根拠はデータではなく、予感です。ただその予感は、長く競輪と向き合ってきた末に生まれたものです。</p>
    <p>風、バンク、ライン——おおよそは数式に落とし込みました。残るのはカオスの部分です。落車、作戦の読み違い、ライン崩壊、選手のメンタル、番手の裏切り——列挙してもきりがありません。AIでも導けないものを数字にしたい。今はまだわかりません。でも、いつかやります。</p>
    <p>このコラムで公開したロジックは、正直に言えば心臓の開示に近いものです。どうか受け取って、あなたの血肉にしてください。そしてあなたなりの自在を掴んで、いつかこの杖が要らなくなるくらい自分の足で立ってほしいです。</p>
    <p>大言壮語を噛ましました。自ら逃げられない状況を作りました。</p>
    <p>もしうまくいかなかったら、よしよししてください。</p>
  </div>

  <div class="home-divider"></div>

  <div class="home-section">
    <p class="column-italic">実際に動かしてみる → <a class="home-link" href="https://huggingface.co/spaces/Jiz41/Jiz41r1t5u" target="_blank" rel="noopener noreferrer">華耀天輪 真自在律</a></p>
  </div>

  <div class="home-footer">
    <div class="home-footer-name">真・自在律 設計ノート</div>
  </div>

</div>
  `;
}

function showLinks() {
  view = 'links';
  currentBoard  = null;
  currentThread = null;
  unsubscribe();
  clearPendingImages();

  bdInputBar.style.display   = 'none';
  bdFullBanner.style.display = 'none';
  bdBackBtn.style.display    = 'inline-block';
  bdTitle.textContent        = '🔗 リンク';

  renderBoardsNav();

  bdMain.innerHTML = `<div class="links-list">
    ${LINKS_DATA.map(link => `
      <div class="links-item">
        <div class="links-title">${escHtml(link.title)}</div>
        <div class="links-desc">${escHtml(link.desc).replace(/\n/g, '<br>')}</div>
        <a class="links-btn" href="${escHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escHtml(link.label)} →</a>
      </div>
    `).join('<div class="links-sep"></div>')}
  </div>`;
}
