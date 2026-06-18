/* ═══════════════════════════════════════════════════
   MENU FILTER
   ═══════════════════════════════════════════════════ */
function filterMenu(cat, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.menu-item').forEach(el => {
    el.classList.toggle('active', cat === 'all' || el.dataset.cat === cat);
  });
}

/* ═══════════════════════════════════════════════════
   FRUIT SLASH GAME — Fully Rewritten
   
   Fixes:
   • trySlice used `return` instead of `continue`, breaking slice detection
   • setTimeout splice used stale index references causing ghost objects
   • Now fruits split into two halves that fly apart when sliced
   • Knife cursor shown during gameplay
   • Particle/popup caps to prevent memory buildup and lag
   • Proper cleanup of animation frames and event listeners
   • Robust try...finally canvas state restoration to prevent visual bugs
   • Input/angle validation to prevent NaN matrix corruption
   ═══════════════════════════════════════════════════ */

// ── Fruit Type Definitions ──
const FT = [
  { n: 'mango',      pts: 20, body: '#FF9A00', hi: '#FFDD80', dk: '#CC5500', glow: '#FF9A00' },
  { n: 'orange',     pts: 10, body: '#FF7700', hi: '#FFD080', dk: '#CC4400', glow: '#FF7700' },
  { n: 'watermelon', pts: 10, body: '#FF3355', hi: '#FF99AA', dk: '#AA0033', outer: '#4CAF50', glow: '#FF3355' },
  { n: 'lemon',      pts: 15, body: '#FFE000', hi: '#FFFAAA', dk: '#CCAA00', glow: '#FFE000' },
  { n: 'grapes',     pts: 15, body: '#9B2FC8', hi: '#DD88FF', dk: '#5B0A88', glow: '#CC66FF' },
  { n: 'strawberry', pts: 20, body: '#FF1A44', hi: '#FF88AA', dk: '#99001A', glow: '#FF4466' },
  { n: 'apple',      pts: 10, body: '#DD1111', hi: '#FF8888', dk: '#880000', glow: '#FF2222' },
  { n: 'blueberry',  pts: 15, body: '#2244CC', hi: '#7799FF', dk: '#0A1A88', glow: '#4488FF' },
  { n: 'pineapple',  pts: 20, body: '#FFD700', hi: '#FFF0AA', dk: '#CC8800', glow: '#FFD700' },
  { n: 'kiwi',       pts: 15, body: '#5CB828', hi: '#AAEE66', dk: '#2A7000', glow: '#88DD44' },
];

// ── Performance caps ──
const MAX_PARTICLES = 120;
const MAX_POPUPS = 20;
const MAX_HALVES = 30;
const MAX_BLADE = 22;

// ── Game State ──
let C, X, raf2;
let gFruits = [], gParticles = [], gPopups = [], gBlade = [], gHalves = [];
let gScore = 0, gLives = 3, gRunning = false, gHighScore = 0;
let gFrame = 0, gNextSpawn = 90, gSlicing = false, gEventsOn = false;
let bgFruits = [];

/* ═══════════════════════════════════════════════════
   CANVAS DRAWING HELPERS
   ═══════════════════════════════════════════════════ */
function fillRad(ctx, x, y, r, c1, c2) {
  if (r <= 0 || isNaN(r) || !isFinite(r)) return;
  try {
    const g = ctx.createRadialGradient(x, y, r * .04, x + r * .3, y + r * .3, r);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
  } catch (err) {
    ctx.fillStyle = c2;
  }
}

function addShine(ctx, r, col) {
  if (r <= 0 || isNaN(r) || !isFinite(r)) return;
  try {
    const g = ctx.createRadialGradient(-r * .32, -r * .34, 0, -r * .2, -r * .2, r * .48);
    g.addColorStop(0, col + 'cc');
    g.addColorStop(1, col + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  } catch (err) {
    // Fail silently
  }
}

/* ═══════════════════════════════════════════════════
   DRAW A WHOLE FRUIT ON CANVAS
   ═══════════════════════════════════════════════════ */
function drawFruit(ctx, f, alpha) {
  if (!f || !f.type || isNaN(f.x) || isNaN(f.y) || isNaN(f.rot) || isNaN(f.r)) return;

  ctx.save();
  try {
    ctx.globalAlpha = alpha ?? 1;
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);

    const t = f.type, r = f.r;
    ctx.shadowColor = t.glow || '#fff';
    ctx.shadowBlur = 18;

    switch (t.n) {
      case 'watermelon': {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        fillRad(ctx, 0, 0, r, '#4CAF50', '#2D7A2D'); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, r * .82, 0, Math.PI * 2);
        fillRad(ctx, -r * .2, -r * .2, r * .9, t.hi, t.body); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#1A1A1A';
        [[0, -r * .35], [r * .28, r * .2], [-r * .28, r * .2], [r * .08, r * .48], [-r * .08, r * .48]].forEach(([sx, sy]) => {
          ctx.beginPath(); ctx.ellipse(sx, sy, r * .05, r * .1, 0.4, 0, Math.PI * 2); ctx.fill();
        });
        addShine(ctx, r * .82, t.hi);
        break;
      }
      case 'grapes': {
        const gpos = [[-r * .38, -r * .42], [r * .38, -r * .42], [0, -r * .5], [-.52 * r, .08 * r], [.52 * r, .08 * r],
                      [0, .12 * r], [-.3 * r, .52 * r], [.3 * r, .52 * r], [0, .58 * r], [-r * .6, -.14 * r], [r * .6, -.14 * r]];
        ctx.shadowBlur = 12;
        gpos.forEach(([gx, gy]) => {
          ctx.beginPath(); ctx.arc(gx, gy, r * .3, 0, Math.PI * 2);
          fillRad(ctx, gx - r * .1, gy - r * .1, r * .32, t.hi, t.body); ctx.fill();
          ctx.strokeStyle = t.dk; ctx.lineWidth = 0.8; ctx.stroke();
        });
        ctx.shadowBlur = 0; ctx.strokeStyle = '#6B3A10'; ctx.lineWidth = r * .1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, -r * .72); ctx.quadraticCurveTo(r * .18, -r, r * .12, -r * 1.1); ctx.stroke();
        break;
      }
      case 'strawberry': {
        ctx.beginPath();
        ctx.moveTo(0, r); ctx.bezierCurveTo(r * .92, r * .6, r * .92, -r * .18, r * .22, -r * .55);
        ctx.lineTo(0, -r * .45); ctx.bezierCurveTo(-r * .92, -r * .18, -r * .92, r * .6, 0, r);
        ctx.fillStyle = t.body; ctx.fill(); addShine(ctx, r * .7, t.hi);
        ctx.shadowBlur = 0; ctx.fillStyle = '#FFEE88';
        [[-r * .22, -r * .05], [r * .22, -r * .05], [0, r * .12], [-r * .18, r * .38], [r * .18, r * .38], [0, .58 * r]].forEach(([sx, sy]) => {
          ctx.beginPath(); ctx.arc(sx, sy, r * .06, 0, Math.PI * 2); ctx.fill();
        });
        ctx.fillStyle = '#22881A';
        for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate((i / 5) * Math.PI * 2); ctx.beginPath(); ctx.ellipse(0, -r * .78, r * .11, r * .3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        break;
      }
      case 'pineapple': {
        ctx.beginPath(); ctx.ellipse(0, r * .1, r * .55, r * .9, 0, 0, Math.PI * 2);
        fillRad(ctx, -r * .2, -r * .3, r * .95, t.hi, t.body); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = t.dk; ctx.lineWidth = 1.3;
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = prevAlpha * .5;
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * .15, -r * .8); ctx.lineTo(i * r * .15 + r * .05, r * .92); ctx.stroke(); }
        for (let j = -4; j <= 4; j++) { ctx.beginPath(); ctx.moveTo(-r * .55, j * r * .22); ctx.lineTo(r * .55, j * r * .22 + r * .04); ctx.stroke(); }
        ctx.globalAlpha = prevAlpha;
        ctx.fillStyle = '#1A6B00';
        [[-r * .28, -r * .88], [-r * .1, -r * 1.08], [r * .06, -r * 1.18], [r * .22, -r * 1.02], [r * .36, -r * .82]].forEach(([lx, ly], i) => {
          ctx.save(); ctx.translate(lx, ly); ctx.rotate((i - 2) * .22);
          ctx.beginPath(); ctx.ellipse(0, 0, r * .1, r * .34, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        });
        break;
      }
      case 'kiwi': {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = '#5D3A1A'; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, r * .88, 0, Math.PI * 2);
        fillRad(ctx, -r * .3, -r * .3, r * .9, t.hi, t.body); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, r * .2, 0, Math.PI * 2); ctx.fillStyle = '#E8F5C0'; ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#3A7010'; ctx.lineWidth = r * .04;
        for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(i / 12 * Math.PI * 2); ctx.beginPath(); ctx.moveTo(0, r * .2); ctx.lineTo(0, r * .82); ctx.stroke(); ctx.restore(); }
        addShine(ctx, r * .88, t.hi + '66');
        break;
      }
      default: {
        if (t.n === 'lemon') { ctx.beginPath(); ctx.ellipse(0, 0, r * .72, r, 0, 0, Math.PI * 2); }
        else { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); }
        fillRad(ctx, -r * .3, -r * .3, r, t.hi, t.body); ctx.fill();
        addShine(ctx, r, t.hi);
        if (t.n !== 'blueberry') {
          ctx.shadowBlur = 0; ctx.fillStyle = '#228B22';
          ctx.beginPath(); ctx.ellipse(r * .1, -r * .9, r * .13, r * .28, 0.35, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#5B3010'; ctx.lineWidth = r * .08; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, -r * .8); ctx.lineTo(r * .05, -r * 1.08); ctx.stroke();
        } else {
          ctx.fillStyle = '#6688EE';
          ctx.beginPath(); ctx.arc(0, -r * .7, r * .12, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  } finally {
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

/* ═══════════════════════════════════════════════════
   DRAW A FRUIT HALF (after slicing)
   side: -1 = left half, +1 = right half
   ═══════════════════════════════════════════════════ */
function drawFruitHalf(ctx, h) {
  if (!h || !h.type || isNaN(h.x) || isNaN(h.y) || isNaN(h.rot) || isNaN(h.r)) return;

  ctx.save();
  try {
    ctx.globalAlpha = Math.max(0, h.life / h.ml);
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);

    const t = h.type, r = h.r, side = h.side;

    // Clip to a half
    ctx.beginPath();
    if (side === -1) {
      ctx.rect(-r * 1.5, -r * 1.5, r * 1.5, r * 3);
    } else {
      ctx.rect(0, -r * 1.5, r * 1.5, r * 3);
    }
    ctx.clip();

    // Draw the fruit shape
    ctx.shadowColor = t.glow || '#fff';
    ctx.shadowBlur = 10;

    if (t.n === 'lemon') {
      ctx.beginPath(); ctx.ellipse(0, 0, r * .72, r, 0, 0, Math.PI * 2);
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    fillRad(ctx, -r * .3, -r * .3, r, t.hi, t.body);
    ctx.fill();
    ctx.shadowBlur = 0;
  } finally {
    ctx.restore();
  }

  // Draw the cut face (the flat inner side)
  ctx.save();
  try {
    ctx.globalAlpha = Math.max(0, h.life / h.ml) * 0.9;
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);

    const t = h.type, r = h.r, side = h.side;
    const fleshWidth = r * 0.15;
    const fleshX = side === -1 ? -fleshWidth / 2 : -fleshWidth / 2;
    ctx.fillStyle = t.hi;
    ctx.beginPath();
    ctx.ellipse(fleshX, 0, fleshWidth, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = t.body + '88';
    const dripY = r * 0.5 + (h.ml - h.life) * 0.4;
    ctx.beginPath();
    ctx.ellipse(side * r * 0.05, dripY, r * 0.08, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  } finally {
    ctx.restore();
  }
}

/* ═══════════════════════════════════════════════════
   DRAW BOMB
   ═══════════════════════════════════════════════════ */
function drawBombShape(ctx, f, t) {
  if (!f || isNaN(f.x) || isNaN(f.y) || isNaN(f.rot) || isNaN(f.r)) return;

  ctx.save();
  try {
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    const r = f.r;

    ctx.shadowColor = '#FF4400'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    fillRad(ctx, -r * .25, -r * .25, r, '#555', '#111'); ctx.fill();
    addShine(ctx, r, '#77777766');

    ctx.shadowBlur = 0; ctx.strokeStyle = '#8B5E0A'; ctx.lineWidth = r * .12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r * .28, -r * .68); ctx.quadraticCurveTo(r * .6, -r * 1.1, r * .18, -r * 1.32); ctx.stroke();

    const sp = (Math.sin(t * .015) * 0.5 + 0.5);
    ctx.beginPath(); ctx.arc(r * .18, -r * 1.32, r * (.09 + sp * .1), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,${160 + sp * 95 | 0},0,${.75 + sp * .2})`; ctx.fill();
    ctx.beginPath(); ctx.arc(r * .18, -r * 1.32, r * .055, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,200,.95)'; ctx.fill();

    // Skull symbol on bomb
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FF4444';
    ctx.font = `${r * 0.7}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💀', 0, r * 0.05);
  } finally {
    ctx.restore();
  }
}

/* ═══════════════════════════════════════════════════
   DRAW KNIFE ICON ON BLADE TIP
   ═══════════════════════════════════════════════════ */
function drawKnifeIcon(ctx, x, y, angle) {
  if (isNaN(x) || isNaN(y) || isNaN(angle)) return;

  ctx.save();
  try {
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI * 0.25);

    // Blade
    ctx.fillStyle = '#D0D0D0';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(4, -4);
    ctx.lineTo(4, 2);
    ctx.lineTo(-4, 2);
    ctx.lineTo(-4, -4);
    ctx.closePath();
    ctx.fill();

    // Blade edge highlight
    ctx.fillStyle = '#F8F8FF';
    ctx.beginPath();
    ctx.moveTo(-1, -16);
    ctx.lineTo(1, -16);
    ctx.lineTo(2, -4);
    ctx.lineTo(-2, -4);
    ctx.closePath();
    ctx.fill();

    // Handle
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#6B3A10';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-5, 2, 10, 12, 2);
    } else {
      ctx.rect(-5, 2, 10, 12);
    }
    ctx.fill();

    // Handle rivets
    ctx.fillStyle = '#C0A060';
    ctx.beginPath(); ctx.arc(0, 6, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 10, 1.5, 0, Math.PI * 2); ctx.fill();
  } finally {
    ctx.restore();
  }
}

/* ═══════════════════════════════════════════════════
   GAME OVERLAY CONTROLS
   ═══════════════════════════════════════════════════ */
function openGame() {
  const ov = document.getElementById('GO');
  ov.classList.add('on');
  document.body.style.overflow = 'hidden';
  C = document.getElementById('GC');
  X = C.getContext('2d');
  resizeG();
  showGScreen('start');
  cancelAnimationFrame(raf2);
  bgFruits = [];
  for (let i = 0; i < 8; i++) bgFruits.push(makeBGF(true));
  bgIdle();
}

function closeGame() {
  gRunning = false;
  cancelAnimationFrame(raf2);
  document.getElementById('GO').classList.remove('on');
  document.body.style.overflow = '';
  gFruits = []; gParticles = []; gPopups = []; gBlade = []; bgFruits = []; gHalves = [];
  C.classList.remove('knife-cursor');
}

function resizeG() {
  C.width = window.innerWidth;
  C.height = window.innerHeight;
}

function showGScreen(w) {
  document.getElementById('GSS').classList.toggle('off', w !== 'start');
  document.getElementById('GOS').classList.toggle('off', w !== 'over');
  if (w !== 'none') {
    C.classList.remove('knife-cursor');
  }
}

/* ═══════════════════════════════════════════════════
   IDLE BACKGROUND ANIMATION
   ═══════════════════════════════════════════════════ */
function makeBGF(rand) {
  const type = FT[Math.floor(Math.random() * FT.length)];
  return {
    type, x: Math.random() * C.width, y: rand ? (Math.random() * C.height) : -80,
    vx: (Math.random() - .5) * 1.1, vy: .55 + Math.random() * 1.1,
    r: 26 + Math.random() * 22, rot: Math.random() * Math.PI * 2, rv: (Math.random() - .5) * .022,
    sliced: false
  };
}

function bgIdle() {
  let bf = 0;
  (function loop() {
    if (gRunning) return;
    X.setTransform(1, 0, 0, 1, 0, 0); // Reset transform every frame
    X.clearRect(0, 0, C.width, C.height);
    drawBG();
    bf++;
    if (bf % 130 === 0 && bgFruits.length < 15) bgFruits.push(makeBGF(false));
    bgFruits = bgFruits.filter(f => {
      f.y += f.vy; f.x += f.vx; f.vy += .03; f.rot += f.rv;
      drawFruit(X, f, .22);
      return f.y < C.height + 100;
    });
    raf2 = requestAnimationFrame(loop);
  })();
}

/* ═══════════════════════════════════════════════════
   START GAME
   ═══════════════════════════════════════════════════ */
function startGame() {
  cancelAnimationFrame(raf2);
  gFruits = []; gParticles = []; gPopups = []; gBlade = []; gHalves = [];
  gScore = 0; gLives = 3; gFrame = 0; gNextSpawn = 90; gRunning = true;
  showGScreen('none');
  C.classList.add('knife-cursor');
  updateHUD();
  addGEvents();
  gameMainLoop();
}

/* ═══════════════════════════════════════════════════
   MAIN GAME LOOP
   ═══════════════════════════════════════════════════ */
function gameMainLoop() {
  if (!gRunning) return;
  X.setTransform(1, 0, 0, 1, 0, 0); // Reset transform every frame
  X.clearRect(0, 0, C.width, C.height);
  drawBG();
  gFrame++;

  // ── Spawn control ──
  if (gFrame >= gNextSpawn) {
    gFrame = 0;
    let count = 1;
    if (gScore > 300) count = Math.random() < .35 ? 2 : 1;
    if (gScore > 600) count = Math.random() < .4 ? 2 : 1;
    if (gScore > 850) count = Math.random() < .35 ? 3 : 2;
    for (let i = 0; i < count; i++) setTimeout(spawnF, i * 300 + Math.random() * 150);
    if (gScore > 200 && Math.random() < .18) setTimeout(spawnBomb, 250 + Math.random() * 300);
    if (gScore > 700 && Math.random() < .10) setTimeout(spawnBomb, 450 + Math.random() * 250);
    gNextSpawn = Math.max(50, 90 - Math.floor(gScore / 150) * 2);
  }

  const now = Date.now();

  // ── Draw & update active fruits ──
  gFruits = gFruits.filter(f => {
    f.x += f.vx; f.y += f.vy; f.vy += .10; f.rot += f.rv;
    if (!f.isBomb) drawFruit(X, f, 1);
    else drawBombShape(X, f, now);

    if (f.y > C.height + 110) {
      if (!f.sliced && !f.isBomb) {
        gLives--;
        updateHUD();
        addMissPop(f.x);
        if (gLives <= 0) { endGame(); }
      }
      return false;
    }
    return true;
  });

  // ── Draw & update fruit halves ──
  gHalves = gHalves.filter(h => {
    h.x += h.vx; h.y += h.vy; h.vy += .15; h.rot += h.rv; h.life--;
    drawFruitHalf(X, h);
    return h.life > 0 && h.y < C.height + 100;
  });

  // ── Particles (capped) ──
  gParticles = gParticles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += .10; p.life--;
    const a = Math.max(0, p.life / p.ml);
    X.save();
    try {
      X.globalAlpha = a;
      X.translate(p.x, p.y);
      X.rotate(p.rot += p.rv);
      const pg = X.createRadialGradient(0, 0, 0, 0, 0, p.r);
      pg.addColorStop(0, p.c1);
      pg.addColorStop(1, p.c2 + '00');
      X.fillStyle = pg;
      X.beginPath(); X.arc(0, 0, p.r, 0, Math.PI * 2); X.fill();
    } finally {
      X.restore();
    }
    return p.life > 0;
  });

  // ── Score popups ──
  gPopups = gPopups.filter(s => {
    s.y -= 1.6; s.life--;
    X.save();
    try {
      X.globalAlpha = Math.min(1, s.life / 18);
      X.font = `900 ${s.sz}px Nunito,sans-serif`;
      X.fillStyle = s.col;
      X.textAlign = 'center';
      X.shadowColor = s.col;
      X.shadowBlur = 12;
      X.fillText(s.txt, s.x, s.y);
    } finally {
      X.restore();
    }
    return s.life > 0;
  });

  // ── Blade trail with knife icon ──
  drawBlade();

  raf2 = requestAnimationFrame(gameMainLoop);
}

/* ═══════════════════════════════════════════════════
   BACKGROUND
   ═══════════════════════════════════════════════════ */
function drawBG() {
  const g = X.createLinearGradient(0, 0, C.width, C.height);
  g.addColorStop(0, '#0c0f1a');
  g.addColorStop(.5, '#141824');
  g.addColorStop(1, '#18101e');
  X.fillStyle = g;
  X.fillRect(0, 0, C.width, C.height);

  // Subtle grid
  X.strokeStyle = 'rgba(255,255,255,0.028)';
  X.lineWidth = 1;
  for (let x2 = 0; x2 < C.width; x2 += 90) { X.beginPath(); X.moveTo(x2, 0); X.lineTo(x2, C.height); X.stroke(); }
  for (let y2 = 0; y2 < C.height; y2 += 90) { X.beginPath(); X.moveTo(0, y2); X.lineTo(C.width, y2); X.stroke(); }

  // Corner glow
  const cg = X.createRadialGradient(0, 0, 0, 0, 0, C.width * .45);
  cg.addColorStop(0, 'rgba(120,60,200,0.07)');
  cg.addColorStop(1, 'transparent');
  X.fillStyle = cg;
  X.fillRect(0, 0, C.width, C.height);
}

/* ═══════════════════════════════════════════════════
   SPAWN FRUITS & BOMBS
   ═══════════════════════════════════════════════════ */
function spawnF() {
  if (!gRunning) return;
  const type = FT[Math.floor(Math.random() * FT.length)];
  const x = 80 + Math.random() * (C.width - 160);
  const vy = -(7.5 + Math.random() * 4);
  gFruits.push({
    type, x, y: C.height + 60, vx: (Math.random() - .5) * 2.4, vy,
    r: 32 + Math.random() * 14, rot: Math.random() * Math.PI * 2, rv: (Math.random() - .5) * .075,
    isBomb: false, sliced: false, id: Math.random()
  });
}

function spawnBomb() {
  if (!gRunning) return;
  const x = 100 + Math.random() * (C.width - 200);
  gFruits.push({
    type: null, x, y: C.height + 60, vx: (Math.random() - .5) * 1.8,
    vy: -(6.5 + Math.random() * 3), r: 30, rot: 0, rv: .038, isBomb: true, sliced: false, id: Math.random()
  });
}

/* ═══════════════════════════════════════════════════
   SLICE DETECTION — FIXED
   ═══════════════════════════════════════════════════ */
function trySlice(px, py) {
  if (!gRunning) return;
  if (isNaN(px) || isNaN(py)) return;

  for (let i = gFruits.length - 1; i >= 0; i--) {
    const f = gFruits[i];
    if (f.sliced) continue;

    const dx = px - f.x, dy = py - f.y;
    const hitRadius = f.r + 14;

    if (dx * dx + dy * dy < hitRadius * hitRadius) {
      if (f.isBomb) {
        f.sliced = true;
        spawnExpParts(px, py);
        gPopups.push({ x: px, y: py - 40, txt: '💣 BOOM!', col: '#FF4444', life: 55, sz: 26 });
        endGame();
        return;
      } else {
        f.sliced = true;
        const pts = f.type.pts;
        gScore += pts;
        updateHUD();

        spawnSliceParts(f.x, f.y, f.type);

        if (gPopups.length < MAX_POPUPS) {
          gPopups.push({ x: f.x, y: f.y - 35, txt: '+' + pts, col: '#FFD700', life: 42, sz: 24 });
        }

        if (gHalves.length < MAX_HALVES) {
          let sliceAngle = 0;
          if (gBlade.length >= 2) {
            const b1 = gBlade[gBlade.length - 2];
            const b2 = gBlade[gBlade.length - 1];
            if (b1 && b2 && !isNaN(b1.x) && !isNaN(b1.y) && !isNaN(b2.x) && !isNaN(b2.y)) {
              sliceAngle = Math.atan2(b2.y - b1.y, b2.x - b1.x);
            }
          }
          if (isNaN(sliceAngle)) sliceAngle = 0;

          // Left half
          gHalves.push({
            type: f.type, x: f.x, y: f.y, r: f.r,
            vx: f.vx - 3.5 * Math.cos(sliceAngle + Math.PI / 2),
            vy: f.vy - 2 - Math.abs(Math.sin(sliceAngle)) * 2,
            rot: f.rot, rv: -0.08 - Math.random() * 0.06,
            side: -1, life: 55, ml: 55
          });

          // Right half
          gHalves.push({
            type: f.type, x: f.x, y: f.y, r: f.r,
            vx: f.vx + 3.5 * Math.cos(sliceAngle + Math.PI / 2),
            vy: f.vy - 2 - Math.abs(Math.sin(sliceAngle)) * 2,
            rot: f.rot, rv: 0.08 + Math.random() * 0.06,
            side: 1, life: 55, ml: 55
          });
        }

        gFruits.splice(i, 1);
        spawnSlashLine(px, py);
      }
    }
  }
}

/* ═══════════════════════════════════════════════════
   SLASH LINE VISUAL
   ═══════════════════════════════════════════════════ */
function spawnSlashLine(x, y) {
  if (gBlade.length < 2) return;
  const b1 = gBlade[gBlade.length - 2];
  const b2 = gBlade[gBlade.length - 1];
  if (isNaN(b1.x) || isNaN(b1.y) || isNaN(b2.x) || isNaN(b2.y)) return;
  
  const angle = Math.atan2(b2.y - b1.y, b2.x - b1.x);

  for (let i = 0; i < 6; i++) {
    if (gParticles.length >= MAX_PARTICLES) break;
    const offset = (i - 3) * 6;
    gParticles.push({
      x: x + Math.cos(angle) * offset,
      y: y + Math.sin(angle) * offset,
      vx: (Math.random() - .5) * 1.5,
      vy: (Math.random() - .5) * 1.5 - 1,
      r: 3 + Math.random() * 4,
      rot: 0, rv: 0,
      c1: '#FFFFFF', c2: '#FFDDAA',
      life: 12, ml: 12
    });
  }
}

/* ═══════════════════════════════════════════════════
   PARTICLES
   ═══════════════════════════════════════════════════ */
function spawnSliceParts(x, y, type) {
  const count1 = Math.min(10, MAX_PARTICLES - gParticles.length);
  for (let i = 0; i < count1; i++) {
    const a = Math.random() * Math.PI * 2, s = 2.5 + Math.random() * 6;
    gParticles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2.5,
      r: 4 + Math.random() * 9, rot: Math.random() * Math.PI, rv: (Math.random() - .5) * .18,
      c1: type.hi, c2: type.body, life: 30 + Math.random() * 18, ml: 48
    });
  }
  const count2 = Math.min(5, MAX_PARTICLES - gParticles.length);
  for (let i = 0; i < count2; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.5;
    gParticles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - .5,
      r: 2 + Math.random() * 4, rot: 0, rv: 0,
      c1: type.body, c2: type.dk || '#333', life: 18, ml: 18
    });
  }
}

function spawnExpParts(x, y) {
  const cols = [['#FF8800', '#FF4400'], ['#FFD700', '#FF8800'], ['#FF6644', '#AA1100'], ['#FFFFFF', '#FFCC00']];
  const count = Math.min(18, MAX_PARTICLES - gParticles.length);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 9;
    const [c1, c2] = cols[Math.floor(Math.random() * cols.length)];
    gParticles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3.5,
      r: 5 + Math.random() * 12, rot: 0, rv: (Math.random() - .5) * .22, c1, c2, life: 45, ml: 45
    });
  }
}

function addMissPop(x) {
  if (gPopups.length < MAX_POPUPS) {
    gPopups.push({ x: x || C.width / 2, y: C.height - 80, txt: '✕ Missed!', col: '#FF6666', life: 48, sz: 21 });
  }
}

/* ═══════════════════════════════════════════════════
   BLADE TRAIL WITH KNIFE ICON
   ═══════════════════════════════════════════════════ */
function drawBlade() {
  if (gBlade.length < 2) return;

  for (let i = 1; i < gBlade.length; i++) {
    const t = i / gBlade.length;
    const p1 = gBlade[i - 1];
    const p2 = gBlade[i];
    if (isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) continue;

    X.save();
    try {
      X.beginPath();
      X.moveTo(p1.x, p1.y);
      X.lineTo(p2.x, p2.y);
      X.strokeStyle = `rgba(255,255,255,${t * .92})`;
      X.lineWidth = t * 9;
      X.lineCap = 'round';
      X.shadowColor = 'rgba(200,230,255,.85)';
      X.shadowBlur = 14;
      X.stroke();
    } finally {
      X.restore();
    }
  }

  if (gBlade.length >= 2) {
    const tip = gBlade[gBlade.length - 1];
    const prev = gBlade[gBlade.length - 2];
    if (tip && prev && !isNaN(tip.x) && !isNaN(tip.y) && !isNaN(prev.x) && !isNaN(prev.y)) {
      const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);

      X.save();
      try {
        X.beginPath();
        X.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
        X.fillStyle = 'rgba(255,255,255,.95)';
        X.shadowColor = '#fff';
        X.shadowBlur = 16;
        X.fill();
      } finally {
        X.restore();
      }

      drawKnifeIcon(X, tip.x, tip.y, angle);
    }
  }

  if (gBlade.length > 3) {
    gBlade.shift();
  }
}

/* ═══════════════════════════════════════════════════
   INPUT EVENTS — Bound once, never duplicated
   ═══════════════════════════════════════════════════ */
function addGEvents() {
  if (gEventsOn) return;
  gEventsOn = true;

  C.addEventListener('mousedown', onMouseDown);
  C.addEventListener('mouseup', onMouseUp);
  C.addEventListener('mouseleave', onMouseUp);
  C.addEventListener('mousemove', onMouseMove);
  C.addEventListener('touchstart', onTouchStart, { passive: false });
  C.addEventListener('touchend', onTouchEnd, { passive: false });
  C.addEventListener('touchmove', onTouchMove, { passive: false });
}

function onMouseDown() { gSlicing = true; }
function onMouseUp() { gSlicing = false; gBlade = []; }

function onMouseMove(e) {
  if (!gSlicing) return;
  const rc = C.getBoundingClientRect();
  if (rc.width === 0 || rc.height === 0) return;
  const mx = (e.clientX - rc.left) * (C.width / rc.width);
  const my = (e.clientY - rc.top) * (C.height / rc.height);
  if (isNaN(mx) || isNaN(my) || !isFinite(mx) || !isFinite(my)) return;
  gBlade.push({ x: mx, y: my });
  if (gBlade.length > MAX_BLADE) gBlade.shift();
  trySlice(mx, my);
}

function onTouchStart(e) { e.preventDefault(); gSlicing = true; }
function onTouchEnd(e) { e.preventDefault(); gSlicing = false; gBlade = []; }

function onTouchMove(e) {
  e.preventDefault();
  const rc = C.getBoundingClientRect(), t = e.touches[0];
  if (!t || rc.width === 0 || rc.height === 0) return;
  const mx = (t.clientX - rc.left) * (C.width / rc.width);
  const my = (t.clientY - rc.top) * (C.height / rc.height);
  if (isNaN(mx) || isNaN(my) || !isFinite(mx) || !isFinite(my)) return;
  gBlade.push({ x: mx, y: my });
  if (gBlade.length > MAX_BLADE) gBlade.shift();
  trySlice(mx, my);
}

/* ═══════════════════════════════════════════════════
   HUD UPDATE
   ═══════════════════════════════════════════════════ */
function updateHUD() {
  document.getElementById('GSCORE').textContent = gScore;
  const pct = Math.min(100, (gScore / 1000) * 100);
  document.getElementById('GPFILL').style.width = pct + '%';
  const h = ['💀', '❤️', '❤️❤️', '❤️❤️❤️'];
  document.getElementById('GLIVES').textContent = h[Math.max(0, Math.min(3, gLives))];
}

/* ═══════════════════════════════════════════════════
   END GAME
   ═══════════════════════════════════════════════════ */
function endGame() {
  gRunning = false;
  cancelAnimationFrame(raf2);
  C.classList.remove('knife-cursor');

  if (gScore > gHighScore) gHighScore = gScore;

  setTimeout(() => {
    const won = gScore >= 1000;
    document.getElementById('GOEMOJI').textContent = won ? '🎉 🧃 🎉' : '💥 😢 💥';
    document.getElementById('GOTITLE').textContent = won ? 'You Won a Free Juice!' : 'Game Over!';
    document.getElementById('GOSCORE').textContent = gScore + ' pts';
    document.getElementById('FJMSG').style.display = won ? 'block' : 'none';
    document.getElementById('GOMSG').textContent = won
      ? 'Show this screen at our store to claim your FREE juice! 🏪'
      : `Best: ${gHighScore} pts • Need ${Math.max(0, 1000 - gScore)} more pts for a free juice!`;
    showGScreen('over');
  }, 700);
}

/* ═══════════════════════════════════════════════════
   WINDOW RESIZE HANDLER
   ═══════════════════════════════════════════════════ */
window.addEventListener('resize', () => {
  if (document.getElementById('GO').classList.contains('on')) resizeG();
  resizeHeroCanvas();
});

/* ═══════════════════════════════════════════════════
   WHATSAPP ORDERING SYSTEM
   ═══════════════════════════════════════════════════ */
function orderItem(name, price) {
  const phone = "919894325988";
  const text = encodeURIComponent(`Hello Sky Pazhamudhir Nilayam, I would like to pre-order "${name}" (${price}) from the menu! 🏪`);
  window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
}

/* ═══════════════════════════════════════════════════
   HERO CANVAS FALLING FRUITS ANIMATION
   ═══════════════════════════════════════════════════ */
let hc, hctx, heroFruits = [];

function initHeroBG() {
  hc = document.getElementById('hero-bg-canvas');
  if (!hc) return;
  hctx = hc.getContext('2d');
  resizeHeroCanvas();

  // Pre-populate some fruits across the height so it doesn't start empty
  for (let i = 0; i < 10; i++) {
    const f = spawnHeroFruit();
    f.y = Math.random() * hc.height;
    heroFruits.push(f);
  }

  animateHeroBG();
}

function resizeHeroCanvas() {
  if (!hc) return;
  const rect = document.querySelector('.hero').getBoundingClientRect();
  hc.width = rect.width;
  hc.height = rect.height;
}

function spawnHeroFruit() {
  const type = FT[Math.floor(Math.random() * FT.length)];
  return {
    type,
    x: Math.random() * hc.width,
    y: -60,
    vx: (Math.random() - .5) * 0.4,
    vy: 0.6 + Math.random() * 1.1,
    r: 22 + Math.random() * 18,
    rot: Math.random() * Math.PI * 2,
    rv: (Math.random() - .5) * .012
  };
}

function animateHeroBG() {
  if (!hc) return;
  hctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
  hctx.clearRect(0, 0, hc.width, hc.height);

  // Spawning controls
  if (Math.random() < 0.015 && heroFruits.length < 20) {
    heroFruits.push(spawnHeroFruit());
  }

  heroFruits = heroFruits.filter(f => {
    f.y += f.vy;
    f.x += f.vx;
    f.rot += f.rv;
    drawFruit(hctx, f, 0.75); // Draw with rich, colorful opacity
    return f.y < hc.height + 60 && f.x > -60 && f.x < hc.width + 60;
  });

  requestAnimationFrame(animateHeroBG);
}

// Start background fruit animation on load
initHeroBG();

