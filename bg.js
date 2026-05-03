/**
 * bg.js — 背景演出（星フィールド + 夜景ビル群）
 * レターボックス領域（#bg-layer）にのみ描画。
 * コンテンツエリア（#stage）には一切干渉しない。
 *
 * 編集ポイント:
 *   - COLORS: 星の色パレット（白 / 琥珀）
 *   - BLDGS:  ビル定義 {x, w, h, c}
 *   - POLES:  電柱のX座標配列
 *   - nextCarDelay: 車の出現間隔（ms）
 */

// ── 星フィールド ──────────────────────────────────────────
(function initStarfield() {
  const canvas = document.getElementById('starfield-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, stars = [], flowStars = [], satellite = null;

  // 静止星の色: 白系 87.5% / 琥珀 12.5%
  const COLORS = [
    [220, 215, 200],
    [220, 215, 200],
    [220, 215, 200],
    [220, 215, 200],
    [220, 215, 200],
    [220, 215, 200],
    [200, 160,  96],
    [220, 215, 200],
  ];

  function resize() {
    W = canvas.width  = canvas.offsetWidth  || canvas.parentElement.clientWidth  || 430;
    H = canvas.height = canvas.offsetHeight || canvas.parentElement.clientHeight || 700;
    initStars();
    initFlowStars();
    initSatellite();
  }

  function initStars() {
    stars = [];
    const skyH = H * 0.72;
    const count = Math.floor((W * skyH) / 1600);
    for (let i = 0; i < count; i++) {
      const col = COLORS[Math.floor(Math.random() * COLORS.length)];
      const sz  = Math.random() < 0.15 ? 2 : 1;
      stars.push({
        x:     Math.floor(Math.random() * W),
        y:     Math.floor(Math.random() * skyH),
        sz, col,
        base:  Math.random() * 0.12 + 0.07,
        amp:   Math.random() * 0.06 + 0.02,
        speed: Math.random() * 0.00035 + 0.00008,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function initFlowStars() {
    flowStars = [];
    const count = 100 + Math.floor(Math.random() * 51); // 100〜150
    const skyH  = H * 0.72;
    for (let i = 0; i < count; i++) {
      flowStars.push({
        x:     Math.random() * W,
        y:     Math.random() * skyH,
        dx:    -(0.03 + Math.random() * 0.08), // -0.03〜-0.11 px/frame
        base:  Math.random() * 0.10 + 0.04,
        amp:   Math.random() * 0.05 + 0.02,
        speed: Math.random() * 0.00030 + 0.00006,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function initSatellite() {
    satellite = {
      x:     W * 0.85,
      y:     25,
      base:  0.25,
      amp:   0.22,
      speed: 0.00025,
      phase: 0,
    };
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    // 静止星
    for (const s of stars) {
      const alpha = s.base + Math.sin(t * s.speed + s.phase) * s.amp;
      const [r, g, b] = s.col;
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      ctx.fillRect(s.x, s.y, s.sz, s.sz);
    }

    // 流れ星（右→左ドリフト）
    for (const s of flowStars) {
      s.x += s.dx;
      if (s.x < -2) s.x = W + 1;
      const alpha = s.base + Math.sin(t * s.speed + s.phase) * s.amp;
      ctx.fillStyle = `rgba(220,215,200,${alpha.toFixed(3)})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }

    // 衛星（赤点・超スロー明滅）
    if (satellite) {
      const alpha = satellite.base + Math.sin(t * satellite.speed + satellite.phase) * satellite.amp;
      ctx.fillStyle = `rgba(210,55,45,${alpha.toFixed(3)})`;
      ctx.fillRect(satellite.x, satellite.y, 2, 2);
    }

    requestAnimationFrame(draw);
  }

  resize();
  requestAnimationFrame(draw);
  window.addEventListener('resize', resize);
})();


// ── 夜景ビル群 + 車 ──────────────────────────────────────
(function initCityscape() {
  const canvas   = document.getElementById('city-canvas');
  const ctx      = canvas.getContext('2d');
  const CH       = 240;   // canvasの高さ(px)
  const GROUND_Y = 206;   // 道路面のY座標
  const BASE_W   = 430;   // 基準幅（スマホ幅）

  // ビル定義: {x: 左端, w: 幅, h: 高さ, c: 塗り色}
  const BLDGS = [
    {x:0,   w:30,  h:148, c:'#161e2e'},
    {x:2,   w:18,  h:128, c:'#141c2b'},
    {x:34,  w:42,  h:175, c:'#16202f'},
    {x:78,  w:18,  h:108, c:'#131a28'},
    {x:98,  w:30,  h:152, c:'#17212f'},
    {x:130, w:14,  h:94,  c:'#141c2b'},
    {x:146, w:46,  h:184, c:'#16202f'},
    {x:194, w:20,  h:115, c:'#131a28'},
    {x:216, w:34,  h:150, c:'#17212f'},
    {x:252, w:16,  h:110, c:'#161e2e'},
    {x:270, w:40,  h:165, c:'#16202f'},
    {x:312, w:24,  h:128, c:'#141c2b'},
    {x:338, w:34,  h:156, c:'#17212f'},
    {x:374, w:20,  h:105, c:'#131a28'},
    {x:396, w:34,  h:142, c:'#16202f'},
  ];

  // 電柱のX座標（BASE_W基準）
  const POLES = [44, 130, 216, 308, 395];

  let W, scale, windows = [], cars = [];
  let lastT = 0, carTimer = 0;
  let nextCarDelay = 6000 + Math.random() * 10000; // 車の出現間隔(ms)

  // 疑似乱数（シード固定で窓配置を安定させる）
  function seededRng(seed) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 4294967295;
    };
  }

  function buildWindows() {
    windows = [];
    const rng = seededRng(42);
    for (const b of BLDGS) {
      const bx = b.x * scale, bw = b.w * scale;
      const by = GROUND_Y - b.h;
      const cols = Math.max(1, Math.floor(bw / 7));
      const rows = Math.floor(b.h / 14);
      const cw   = bw / cols;
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          if (rng() < 0.32) {
            windows.push({
              x:     bx + c * cw + cw * 0.2,
              y:     by + r * 14 + 4,
              w:     Math.max(2, cw * 0.55),
              h:     5,
              amber: rng() < 0.28,         // 琥珀色の窓
              phase: rng() * Math.PI * 2,
              blink: rng() < 0.04,         // ごくたまに点滅
            });
          }
        }
      }
    }
  }

  function resize() {
    W             = canvas.width = window.innerWidth;
    canvas.height = CH;
    scale         = W / BASE_W;
    buildWindows();
  }

  function spawnCar() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    cars.push({
      x:   dir === 1 ? -70 : W + 70,
      dir,
      spd: (Math.random() * 0.5 + 0.35) * dir,
    });
  }

  function drawScene(t) {
    ctx.clearRect(0, 0, W, CH);

    // ビル
    for (const b of BLDGS) {
      const bx = b.x * scale, bw = b.w * scale, by = GROUND_Y - b.h;
      ctx.fillStyle = b.c;
      ctx.fillRect(bx, by, bw, b.h + 34);
      if (b.h > 150) ctx.fillRect(bx + bw * 0.5 - 0.5, by - 14, 1, 15); // アンテナ
    }

    // 電柱
    for (const px of POLES) {
      const sx = px * scale;
      ctx.fillStyle = '#111826';
      ctx.fillRect(sx, GROUND_Y - 75, 2, 76 + 34);
      ctx.fillRect(sx - 8 * scale, GROUND_Y - 72, 18 * scale, 1.5);
    }

    // 道路
    ctx.fillStyle = '#0b1018';
    ctx.fillRect(0, GROUND_Y, W, CH - GROUND_Y);
    // センターライン（琥珀、極淡）
    ctx.fillStyle = 'rgba(200,160,96,0.045)';
    ctx.fillRect(0, GROUND_Y + Math.round((CH - GROUND_Y) * 0.45), W, 1);

    // 窓の明かり
    for (const win of windows) {
      const a = win.blink
        ? 0.55 + Math.sin(t * 0.00045 + win.phase) * 0.28
        : 0.38 + Math.sin(t * 0.000055 + win.phase) * 0.07;
      const [r, g, b_] = win.amber ? [195,148,78] : [195,188,148];
      ctx.fillStyle = `rgba(${r},${g},${b_},${a.toFixed(3)})`;
      ctx.fillRect(win.x, win.y, win.w, win.h);
    }
  }

  function drawCars(dt) {
    const roadY = GROUND_Y + 6;
    for (let i = cars.length - 1; i >= 0; i--) {
      const car = cars[i];
      car.x += car.spd * (dt / 16);
      if ((car.dir === 1 && car.x > W + 80) || (car.dir === -1 && car.x < -80)) {
        cars.splice(i, 1); continue;
      }
      const cx = car.x, cy = roadY;
      // 車体
      ctx.fillStyle = '#090d16';
      ctx.fillRect(cx - 18, cy - 6, 36, 8);
      ctx.fillRect(cx - 11, cy - 10, 22, 5);

      if (car.dir === 1) {
        // 右向き: ヘッドライト右側
        const g = ctx.createRadialGradient(cx + 20, cy - 2, 0, cx + 20, cy - 2, 22);
        g.addColorStop(0, 'rgba(255,248,205,0.42)');
        g.addColorStop(1, 'rgba(255,248,205,0)');
        ctx.fillStyle = g; ctx.fillRect(cx + 8, cy - 14, 36, 22);
        ctx.fillStyle = 'rgba(255,250,215,0.95)';
        ctx.fillRect(cx + 17, cy - 4, 3, 2); ctx.fillRect(cx + 17, cy - 1, 3, 2);
        ctx.fillStyle = 'rgba(170,35,18,0.75)';
        ctx.fillRect(cx - 21, cy - 4, 3, 2); ctx.fillRect(cx - 21, cy - 1, 3, 2);
      } else {
        // 左向き: ヘッドライト左側
        const g = ctx.createRadialGradient(cx - 20, cy - 2, 0, cx - 20, cy - 2, 22);
        g.addColorStop(0, 'rgba(255,248,205,0.42)');
        g.addColorStop(1, 'rgba(255,248,205,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - 44, cy - 14, 36, 22);
        ctx.fillStyle = 'rgba(255,250,215,0.95)';
        ctx.fillRect(cx - 20, cy - 4, 3, 2); ctx.fillRect(cx - 20, cy - 1, 3, 2);
        ctx.fillStyle = 'rgba(170,35,18,0.75)';
        ctx.fillRect(cx + 18, cy - 4, 3, 2); ctx.fillRect(cx + 18, cy - 1, 3, 2);
      }
    }
  }

  function loop(t) {
    const dt = Math.min(t - lastT, 50);
    lastT = t;
    carTimer += dt;
    drawScene(t);
    drawCars(dt);
    if (carTimer > nextCarDelay) {
      spawnCar();
      carTimer = 0;
      nextCarDelay = 5000 + Math.random() * 14000;
    }
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(t => { lastT = t; loop(t); });
})();
