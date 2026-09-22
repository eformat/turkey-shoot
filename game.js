/* TURKEY SHOOT: Backyard Battle — vanilla JS, Canvas 2D, procedural everything. */
(() => {
'use strict';

// ============================================================
// Canvas & scaling (fixed logical 1280x720, letterboxed)
// ============================================================
const W = 1280, H = 720;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = Math.floor(W * scale) + 'px';
  canvas.style.height = Math.floor(H * scale) + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ============================================================
// Utils
// ============================================================
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
function prand(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

function roundRectPath(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function outlinedText(g, text, x, y, font, fill, stroke, lw, align) {
  g.font = font;
  g.textAlign = align || 'center';
  g.textBaseline = 'middle';
  if (stroke) {
    g.lineJoin = 'round';
    g.miterLimit = 2;
    g.strokeStyle = stroke;
    g.lineWidth = lw || 6;
    g.strokeText(text, x, y);
  }
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

// ============================================================
// Persistence (high score only, guarded)
// ============================================================
function loadHigh() {
  try { return parseInt(localStorage.getItem('turkey-shoot-high'), 10) || 0; } catch (e) { return 0; }
}
function saveHigh(v) {
  try { localStorage.setItem('turkey-shoot-high', String(v)); } catch (e) {}
}

// ============================================================
// Audio — Web Audio API, fully synthesised, never throws
// ============================================================
const Sound = (() => {
  let ctxA = null, master = null, noiseBuf = null, muted = false;
  function init() {
    if (ctxA) { resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctxA = new AC();
      master = ctxA.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctxA.destination);
      noiseBuf = ctxA.createBuffer(1, ctxA.sampleRate, ctxA.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      resume();
    } catch (e) { ctxA = null; }
  }
  function resume() {
    try {
      if (ctxA && ctxA.state === 'suspended') { const p = ctxA.resume(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) {}
  }
  const ok = () => !!ctxA;
  function setMuted(m) {
    muted = m;
    try { if (master) master.gain.value = m ? 0 : 0.55; } catch (e) {}
  }
  function noise(dur, filterType, freq, q, vol, when, slideTo) {
    if (!ok()) return;
    try {
      const t0 = ctxA.currentTime + (when || 0);
      const src = ctxA.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const f = ctxA.createBiquadFilter();
      f.type = filterType; f.frequency.value = freq;
      if (q) f.Q.value = q;
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
      const g = ctxA.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  function tone(type, f0, f1, dur, vol, when, opts) {
    if (!ok()) return;
    try {
      opts = opts || {};
      const t0 = ctxA.currentTime + (when || 0);
      const o = ctxA.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(1, f0), t0);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      if (opts.vibrato) {
        const lfo = ctxA.createOscillator();
        lfo.frequency.value = opts.vibratoRate || 6;
        const lg = ctxA.createGain();
        lg.gain.value = opts.vibrato;
        lfo.connect(lg); lg.connect(o.frequency);
        lfo.start(t0); lfo.stop(t0 + dur);
      }
      const g = ctxA.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  return {
    init, resume, setMuted,
    shot() { noise(0.09, 'bandpass', 900, 1.2, 0.5); tone('sine', 200, 60, 0.12, 0.4); },
    empty() { noise(0.03, 'highpass', 2500, 0, 0.22); },
    reload() {
      noise(0.05, 'bandpass', 1800, 2, 0.32, 0);
      tone('square', 140, 90, 0.06, 0.16, 0);
      noise(0.05, 'bandpass', 1300, 2, 0.32, 0.3);
      tone('square', 190, 110, 0.06, 0.16, 0.3);
    },
    squawk(base) { const f = (base || 700) * rand(0.8, 1.3); tone('sawtooth', f, f * 0.7, 0.22, 0.2, 0, { vibrato: 40, vibratoRate: 14 }); },
    squawkHit() { tone('sawtooth', 950, 330, 0.3, 0.3, 0, { vibrato: 60, vibratoRate: 18 }); noise(0.15, 'bandpass', 2000, 1, 0.18, 0); },
    cluck() { tone('square', 300, 180, 0.08, 0.12); },
    scream() { tone('sawtooth', 1300, 280, 0.9, 0.4, 0, { vibrato: 130, vibratoRate: 22 }); noise(0.7, 'bandpass', 1200, 0.8, 0.24); },
    dig() { noise(0.12, 'lowpass', 700, 0, 0.12); },
    pickup() { tone('triangle', 660, 660, 0.09, 0.25); tone('triangle', 990, 990, 0.16, 0.25, 0.09); },
    horn() { tone('sawtooth', 65, 78, 1.4, 0.3, 0, { vibrato: 6, vibratoRate: 5 }); tone('sawtooth', 98, 112, 1.2, 0.14, 0.1, { vibrato: 5, vibratoRate: 4 }); },
    gameover() {
      const notes = [220, 185, 155, 110];
      notes.forEach((n, i) => tone('sawtooth', n, n * 0.94, 0.42, 0.24, i * 0.35, { vibrato: 8, vibratoRate: 7 }));
    },
    kookaburra() {
      for (let i = 0; i < 6; i++) {
        const f = 850 + Math.sin(i * 1.1) * 320;
        tone('square', f * 1.25, f * 0.8, 0.09, 0.07, i * 0.12, { vibrato: 30, vibratoRate: 25 });
      }
    },
    splat() { tone('sine', 120, 40, 0.18, 0.4); noise(0.2, 'lowpass', 500, 0, 0.28); },
    thud() { tone('sine', 90, 40, 0.14, 0.3); },
  };
})();

// ============================================================
// Game state
// ============================================================
const SCR = { TITLE: 'title', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };
let screen = SCR.TITLE;
function setScreen(s) {
  screen = s;
  try { document.body.dataset.screen = s; } catch (e) {}
}

let score = 0, high = loadHigh(), startHigh = high, health = 100, prevHealth = 100;
const MAG = 6, RELOAD_TIME = 0.8;
let shells = MAG, reloading = false, reloadT = 0;
let comboCount = 0, comboT = 0;
let missStreak = 0;
let shake = 0, hitStop = 0, shotFlash = 0, meatFlash = 0;
let muted = false;
let time = 0;
let kookTimer = rand(14, 22);
let digBubbleCool = 0, lowGardenCool = 0, missBubbleCool = 0;
let newBest = false;

let turkeys = [], corpses = [], particles = [], popups = [], powerups = [];
let clods = [], splats = [], mounds = [];
let bazza = null;
let banner = null;   // {text, sub, timer, max, color}
let bubble = null;   // {text, timer, max}
let titleTurkey = { x: 260, y: 655, z: 0, zV: 0, face: 1, scale: 1, state: 'wander', walk: 0, time: 0, squash: 1, rot: 0, flash: 0, isBoss: false };
let gameOverQuip = '', finalWaveNum = 1;

const beds = [
  { x: 250, y: 596 },
  { x: 640, y: 634 },
  { x: 1030, y: 590 },
];

const mouse = { x: W / 2, y: H / 2 };

// ============================================================
// Aussie commentary
// ============================================================
const LINES = {
  waveStart: [
    'Here they come, the feathered mongrels!',
    "Strike a light, more of 'em!",
    "It's like central station out here.",
    'Lock up your lettuce, mate!',
    'The feathered invasion continues, mate.',
  ],
  boss: [
    "STREWTH! It's BIG BAZZA!",
    "He's a big bugga, eh!",
    "That's not a turkey... THIS is a turkey!",
  ],
  bossDown: [
    "HE'S DONE LIKE A DINNER!",
    "That's going in the smear sheet, mate!",
    'Somebody call the butcher — Bazza is beat!',
  ],
  miss: [
    'You hit like a dropped pie, mate.',
    "My nan shoots straighter — and she's been dead 20 years.",
    'The fence is in more danger than the turkeys.',
    'Were you even aiming, mate?',
  ],
  dig: [
    'Oi! Not the tomatoes!',
    'Me bloody petunias!',
    "Get off my lawn, ya feathered rat!",
    "He's digging up the whole joint!",
  ],
  lowGarden: [
    "The backyard's going to buggery, mate!",
    'The patch is cactus, mate!',
  ],
  waveBreak: [
    'Good on ya, mate!',
    "That's the lot of 'em!",
    'Beauty! Smoko break.',
    "They'll be back, ya know.",
  ],
  over: [
    'Your backyard is rooted.',
    'The turkeys won, mate. The turkeys... won.',
    "Dinner's cancelled, mate.",
  ],
};

function say(text, dur) {
  bubble = { text, timer: dur || 3, max: dur || 3 };
}
function showBanner(text, sub, color, dur) {
  banner = { text, sub: sub || '', timer: dur || 2.2, max: dur || 2.2, color: color || '#ffd23f' };
}

// ============================================================
// Background layers (drawn once to offscreen canvases)
// ============================================================
const LAYER_W = W + 80; // extra width for parallax shifting
function makeLayer(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  return c;
}

const skyLayer = makeLayer(LAYER_W, H, (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 470);
  grad.addColorStop(0, '#5aa7e0');
  grad.addColorStop(0.55, '#8ec9ee');
  grad.addColorStop(0.85, '#cfe9f4');
  grad.addColorStop(1, '#ffe3bd');
  g.fillStyle = grad;
  g.fillRect(0, 0, LAYER_W, 470);
  // sun with glow
  const sx = 1050, sy = 105;
  const glow = g.createRadialGradient(sx, sy, 10, sx, sy, 130);
  glow.addColorStop(0, 'rgba(255,240,190,0.9)');
  glow.addColorStop(1, 'rgba(255,240,190,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(sx, sy, 130, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff3c2';
  g.beginPath(); g.arc(sx, sy, 44, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#f7d97b'; g.lineWidth = 4;
  g.beginPath(); g.arc(sx, sy, 44, 0, Math.PI * 2); g.stroke();
  // far mountain range (atmospheric)
  g.fillStyle = 'rgba(120,140,175,0.55)';
  g.beginPath();
  g.moveTo(0, 452);
  const peaks1 = [ [60,390],[150,415],[240,360],[330,410],[430,375],[520,420],[610,385],[700,418],[800,370],[900,410],[1000,380],[1100,415],[1190,395],[1280,420],[1360,400] ];
  peaks1.forEach(p => g.lineTo(p[0], p[1]));
  g.lineTo(LAYER_W, 470); g.lineTo(0, 470); g.closePath(); g.fill();
  // near mountain range (escarpment)
  g.fillStyle = 'rgba(85,105,90,0.85)';
  g.beginPath();
  g.moveTo(0, 470);
  const peaks2 = [ [40,440],[130,452],[220,428],[320,450],[420,432],[500,452],[580,438],[660,454],[760,430],[860,448],[950,434],[1050,452],[1140,436],[1240,452],[1360,442] ];
  peaks2.forEach(p => g.lineTo(p[0], p[1]));
  g.lineTo(LAYER_W, 470); g.lineTo(0, 470); g.closePath(); g.fill();
});

function drawEucTree(g, x, baseY, scale) {
  g.save();
  g.translate(x, baseY);
  g.scale(scale, scale);
  // trunk
  g.fillStyle = '#c8b09a';
  g.strokeStyle = '#6e5643'; g.lineWidth = 3; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(-11, 0);
  g.quadraticCurveTo(-7, -55, -9, -95);
  g.lineTo(-1, -100);
  g.quadraticCurveTo(6, -55, 10, 0);
  g.closePath(); g.fill(); g.stroke();
  // bark patches
  g.fillStyle = '#8f7a66';
  g.beginPath(); g.ellipse(-3, -40, 3, 12, 0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(4, -70, 2.5, 9, -0.15, 0, Math.PI * 2); g.fill();
  // canopy blobs
  const blobs = [
    [0, -128, 42, '#5d9450'], [-34, -108, 30, '#6ba659'], [34, -110, 30, '#548c48'],
    [-14, -150, 26, '#6ba659'], [22, -146, 24, '#5d9450'], [0, -104, 36, '#4f7d44'],
  ];
  for (const b of blobs) {
    g.fillStyle = b[3];
    g.strokeStyle = 'rgba(30,55,28,0.75)'; g.lineWidth = 3;
    g.beginPath(); g.arc(b[0], b[1], b[2], 0, Math.PI * 2); g.fill(); g.stroke();
  }
  // leaf flecks
  g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 8; i++) {
    const a = i * 0.9;
    g.beginPath(); g.arc(Math.cos(a) * 30, -125 + Math.sin(a) * 22, 4, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

const treesLayer = makeLayer(LAYER_W, H, (g) => {
  // distant bush row along fence line
  g.fillStyle = 'rgba(70,110,60,0.5)';
  for (let i = 0; i < 22; i++) {
    const bx = i * 62 + 20;
    g.beginPath(); g.ellipse(bx, 336, 30, 14, 0, Math.PI, 0); g.fill();
  }
  drawEucTree(g, 150, 470, 1.15);
  drawEucTree(g, 400, 470, 0.7);
  drawEucTree(g, 950, 470, 0.85);
  drawEucTree(g, 1215, 470, 1.1);
});

const fenceLayer = makeLayer(LAYER_W, H, (g) => {
  const top = 330, bot = 478;
  // corrugated iron
  g.fillStyle = '#9aa2ab';
  g.fillRect(0, top, LAYER_W, bot - top);
  for (let x = 0; x < LAYER_W; x += 14) {
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(x + 2, top, 5, bot - top);
    g.fillStyle = 'rgba(20,25,35,0.16)';
    g.fillRect(x + 9, top, 3, bot - top);
  }
  // rails
  g.fillStyle = '#6f7680';
  g.fillRect(0, top, LAYER_W, 8);
  g.fillRect(0, bot - 10, LAYER_W, 10);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(0, top + 8, LAYER_W, 2);
  // posts
  for (let x = 60; x < LAYER_W; x += 210) {
    g.fillStyle = '#565e68';
    g.fillRect(x, top - 6, 16, bot - top + 6);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(x + 2, top - 6, 3, bot - top + 6);
    g.fillStyle = '#3c434c';
    g.fillRect(x, top - 6, 16, 4);
  }
  // rust streaks
  for (let i = 0; i < 14; i++) {
    const rx = prand(i * 3.3) * LAYER_W;
    const rw = 3 + prand(i * 7.7) * 6;
    const rh = 30 + prand(i * 5.1) * 80;
    const ry = top + 10 + prand(i * 9.9) * (bot - top - rh - 20);
    g.fillStyle = 'rgba(150,80,30,0.22)';
    g.beginPath();
    g.moveTo(rx, ry);
    g.quadraticCurveTo(rx + rw, ry + rh * 0.5, rx, ry + rh);
    g.lineTo(rx + rw, ry + rh * 0.9);
    g.quadraticCurveTo(rx + rw * 1.6, ry + rh * 0.4, rx + rw, ry);
    g.closePath(); g.fill();
  }
  // Beware of Turkeys sign
  g.save();
  g.translate(1015, 396);
  g.rotate(-0.03);
  g.fillStyle = '#e8d44d';
  g.strokeStyle = '#4a3a10'; g.lineWidth = 4; g.lineJoin = 'round';
  roundRectPath(g, -88, -34, 176, 68, 8);
  g.fill(); g.stroke();
  g.fillStyle = '#4a3a10';
  g.beginPath(); g.arc(-80, -26, 3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(80, -26, 3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(-80, 26, 3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(80, 26, 3, 0, Math.PI * 2); g.fill();
  g.font = 'bold 19px Verdana, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('BEWARE OF', 0, -16);
  g.fillText('TURKEYS', 0, 6);
  // little turkey silhouette
  g.fillStyle = '#4a3a10';
  g.beginPath(); g.ellipse(58, 18, 12, 8, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(68, 10, 4, 0, Math.PI * 2); g.fill();
  g.restore();
});

const groundLayer = makeLayer(LAYER_W, H, (g) => {
  const grad = g.createLinearGradient(0, 470, 0, H);
  grad.addColorStop(0, '#83bd60');
  grad.addColorStop(1, '#54903e');
  g.fillStyle = grad;
  g.fillRect(0, 468, LAYER_W, H - 468);
  // mowing stripes
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,40,0,0.05)';
    g.beginPath();
    g.moveTo(i * 88 - 20, 470);
    g.lineTo(i * 88 + 68, 470);
    g.lineTo(i * 88 + 8, H);
    g.lineTo(i * 88 - 80, H);
    g.closePath(); g.fill();
  }
  // grass tufts
  g.strokeStyle = 'rgba(35,80,25,0.5)'; g.lineWidth = 2; g.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const gx = prand(i * 1.7) * LAYER_W;
    const gy = 485 + prand(i * 2.9) * (H - 500);
    if (gy < 486) continue;
    for (let b = -1; b <= 1; b++) {
      g.beginPath();
      g.moveTo(gx, gy);
      g.quadraticCurveTo(gx + b * 3, gy - 6, gx + b * 6, gy - 9);
      g.stroke();
    }
  }
  // daisies
  for (let i = 0; i < 26; i++) {
    const dx = prand(i * 4.2) * LAYER_W;
    const dy = 500 + prand(i * 6.6) * (H - 520);
    if (dy < 502) continue;
    g.fillStyle = '#ffffff';
    for (let p = 0; p < 5; p++) {
      const a = p * Math.PI * 0.4;
      g.beginPath(); g.ellipse(dx + Math.cos(a) * 4, dy + Math.sin(a) * 4, 2.6, 1.6, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#f5c531';
    g.beginPath(); g.arc(dx, dy, 2, 0, Math.PI * 2); g.fill();
  }
});

// vignette overlay
const vignette = makeLayer(W, H, (g) => {
  const grad = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.85);
  grad.addColorStop(0, 'rgba(0,0,20,0)');
  grad.addColorStop(1, 'rgba(0,0,25,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
});

// ============================================================
// Clouds (dynamic, drift over sky)
// ============================================================
const clouds = [];
for (let i = 0; i < 6; i++) {
  clouds.push({ x: rand(0, W), y: rand(50, 240), s: rand(0.7, 1.5), v: rand(6, 16) });
}
function drawCloud(g, c) {
  g.save();
  g.translate(c.x, c.y);
  g.scale(c.s, c.s);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath();
  g.ellipse(-28, 6, 26, 15, 0, 0, Math.PI * 2);
  g.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2);
  g.ellipse(30, 7, 24, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(190,215,235,0.5)';
  g.beginPath(); g.ellipse(0, 14, 34, 7, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ============================================================
// Particles
// ============================================================
function addParticle(p) {
  if (particles.length > 420) return;
  p.max = p.life;
  p.rot = p.rot || 0;
  p.vr = p.vr || 0;
  particles.push(p);
}
function featherBurst(x, y, scale) {
  const n = 16;
  for (let i = 0; i < n; i++) {
    const red = i < 2, yellow = i === 2;
    addParticle({
      type: 'feather',
      x, y,
      vx: rand(-170, 170), vy: rand(-280, -30),
      life: rand(0.7, 1.4),
      size: rand(6, 11) * Math.min(scale, 1.6),
      color: red ? '#c94a38' : yellow ? '#f5c531' : (i % 2 ? '#23232e' : '#1b1b25'),
      vr: rand(-9, 9),
    });
  }
}
function dustBurst(x, y, n) {
  for (let i = 0; i < (n || 8); i++) {
    addParticle({
      type: 'dust',
      x: x + rand(-14, 14), y: y + rand(-6, 4),
      vx: rand(-70, 70), vy: rand(-60, -10),
      life: rand(0.4, 0.9),
      size: rand(6, 14),
      color: 'rgba(185,165,130,0.55)',
    });
  }
}
function mulchBurst(x, y) {
  for (let i = 0; i < 4; i++) {
    addParticle({
      type: 'mulch',
      x: x + rand(-8, 8), y: y - 10,
      vx: rand(-120, 120), vy: rand(-220, -120),
      life: rand(0.5, 0.9),
      size: rand(3, 6),
      color: i % 2 ? '#6b4a2a' : '#8a6238',
      vr: rand(-12, 12),
    });
  }
}
function sparkleAt(x, y) {
  addParticle({
    type: 'spark',
    x: x + rand(-20, 20), y: y - rand(6, 40),
    vx: rand(-10, 10), vy: rand(-40, -15),
    life: rand(0.4, 0.8),
    size: rand(3, 6),
    color: '#ffe680',
    vr: rand(-4, 4),
  });
}
function ringAt(x, y) {
  addParticle({ type: 'ring', x, y, vx: 0, vy: 0, life: 0.5, size: 10, color: 'rgba(255,120,80,0.8)', vr: 0 });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.type === 'feather') {
      p.vy += 210 * dt;
      p.vx *= (1 - 1.1 * dt);
      p.x += Math.sin(p.life * 18) * 26 * dt;
    } else if (p.type === 'mulch') {
      p.vy += 640 * dt;
    } else if (p.type === 'dust') {
      p.size += 14 * dt;
      p.vx *= (1 - 2 * dt);
      p.vy *= (1 - 2 * dt);
    } else if (p.type === 'ring') {
      p.size += 380 * dt;
    } else if (p.type === 'spark') {
      p.vy += 40 * dt;
    }
  }
}
function drawParticles(g) {
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    g.save();
    g.globalAlpha = a;
    g.translate(p.x, p.y);
    g.rotate(p.rot || 0);
    if (p.type === 'feather') {
      g.fillStyle = p.color;
      g.beginPath(); g.ellipse(0, 0, p.size, p.size * 0.38, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-p.size, 0); g.lineTo(p.size, 0); g.stroke();
    } else if (p.type === 'dust') {
      g.fillStyle = p.color;
      g.beginPath(); g.arc(0, 0, p.size, 0, Math.PI * 2); g.fill();
    } else if (p.type === 'mulch') {
      g.fillStyle = p.color;
      g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
    } else if (p.type === 'ring') {
      g.strokeStyle = p.color;
      g.lineWidth = 5 * a;
      g.beginPath(); g.arc(0, 0, p.size, 0, Math.PI * 2); g.stroke();
    } else if (p.type === 'spark') {
      g.fillStyle = p.color;
      g.beginPath();
      for (let s = 0; s < 4; s++) {
        const sa = s * Math.PI / 2;
        g.lineTo(Math.cos(sa) * p.size, Math.sin(sa) * p.size);
        g.lineTo(Math.cos(sa + Math.PI / 4) * p.size * 0.35, Math.sin(sa + Math.PI / 4) * p.size * 0.35);
      }
      g.closePath(); g.fill();
    }
    g.restore();
  }
}

// ============================================================
// Popups (floating score text)
// ============================================================
function popup(x, y, text, color, size) {
  popups.push({
    x: clamp(x, 60, W - 60), y,
    text, color: color || '#ffffff',
    life: 1.1, max: 1.1,
    size: size || 24,
  });
  if (popups.length > 24) popups.shift();
}
function updatePopups(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.life -= dt;
    p.y -= 55 * dt;
    if (p.life <= 0) popups.splice(i, 1);
  }
}
function drawPopups(g) {
  for (const p of popups) {
    const a = clamp(p.life / p.max, 0, 1);
    g.save();
    g.globalAlpha = a;
    const grow = 1 + (1 - a) * 0.15;
    g.translate(p.x, p.y);
    g.scale(grow, grow);
    outlinedText(g, p.text, 0, 0, `900 ${p.size}px "Arial Black", Verdana, sans-serif`, p.color, 'rgba(20,10,0,0.9)', 5);
    g.restore();
  }
}

// ============================================================
// Mounds (dirt decals)
// ============================================================
function updateMounds(dt) {
  for (let i = mounds.length - 1; i >= 0; i--) {
    mounds[i].life -= dt;
    if (mounds[i].life <= 0) mounds.splice(i, 1);
  }
}
function drawMounds(g) {
  for (const m of mounds) {
    const a = clamp(m.life / 3, 0, 1);
    g.save();
    g.globalAlpha = a * 0.9;
    g.fillStyle = '#7a5a35';
    g.strokeStyle = '#4a3418'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(m.x, m.y, m.r, m.r * 0.45, 0, Math.PI, 0); g.lineTo(m.x + m.r, m.y); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath(); g.ellipse(m.x - m.r * 0.3, m.y - m.r * 0.12, m.r * 0.25, m.r * 0.1, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}

// ============================================================
// Turkey rendering
// ============================================================
function drawShadow(g, x, y, rx, z) {
  const sh = clamp(1 - (z || 0) / 130, 0.4, 1);
  g.fillStyle = `rgba(20,40,15,${0.28 * sh})`;
  g.beginPath();
  g.ellipse(x, y + 3, rx * sh, rx * 0.3 * sh, 0, 0, Math.PI * 2);
  g.fill();
}

function drawTurkeyLeg(g, hx, hy, swing) {
  g.strokeStyle = '#8a6a52';
  g.lineWidth = 4.5; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(hx, hy);
  g.lineTo(hx + swing * 0.5, hy + 8);
  g.lineTo(hx + swing, 0);
  g.stroke();
  g.beginPath();
  g.moveTo(hx + swing, 0);
  g.lineTo(hx + swing + 6, 0);
  g.stroke();
}

function drawTurkey(g, t) {
  const s = t.scale || 1;
  const isBoss = !!t.isBoss;
  const walk = t.walk || 0;
  const digging = t.state === 'dig';
  const bob = digging ? Math.abs(Math.sin(t.time * 9)) * 6 : Math.sin(t.time * 2.2) * 2;
  const face = t.face || 1;
  const legA = Math.sin(walk * 8);
  const legB = Math.sin(walk * 8 + Math.PI);

  g.save();
  g.translate(t.x, t.y - (t.z || 0));
  g.scale(s * face, s * (t.squash || 1));
  if (t.rot) g.rotate(t.rot);
  if (t.state === 'dart' || t.state === 'flee') g.rotate(0.16);

  // legs (behind body)
  drawTurkeyLeg(g, -8, -12, legA * 8);
  drawTurkeyLeg(g, 6, -12, legB * 8);

  // tail fan
  g.save();
  g.translate(-24, -36);
  g.rotate(-0.25 + Math.sin(t.time * 3 + 1) * 0.06);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.24;
    g.save();
    g.rotate(a);
    g.fillStyle = i % 2 ? '#242430' : '#1a1a24';
    g.strokeStyle = '#0b0b12'; g.lineWidth = 3; g.lineJoin = 'round';
    roundRectPath(g, -5, -48, 10, 48, 5);
    g.fill(); g.stroke();
    g.restore();
  }
  g.restore();

  // body
  const bodyGrad = g.createLinearGradient(0, -52, 0, 0);
  bodyGrad.addColorStop(0, '#383846');
  bodyGrad.addColorStop(1, '#14141c');
  g.fillStyle = bodyGrad;
  g.strokeStyle = '#0a0a10'; g.lineWidth = 3.5; g.lineJoin = 'round';
  g.beginPath(); g.ellipse(0, -26, 30, 23, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  // sheen
  g.strokeStyle = 'rgba(115,170,140,0.4)'; g.lineWidth = 3.5;
  g.beginPath(); g.arc(0, -26, 23, -2.5, -1.1); g.stroke();
  // wing
  g.fillStyle = '#171720';
  g.beginPath(); g.ellipse(-3, -26, 15, 10, -0.25, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-14, -22); g.lineTo(6, -19); g.stroke();

  // neck + head (bald red, yellow wattle)
  const nty = -58 - bob;
  g.strokeStyle = '#7e2418'; g.lineWidth = 12; g.lineCap = 'round';
  g.beginPath(); g.moveTo(17, -30); g.quadraticCurveTo(30, -42, 30, nty + 6); g.stroke();
  g.strokeStyle = '#d95643'; g.lineWidth = 8;
  g.beginPath(); g.moveTo(17, -30); g.quadraticCurveTo(30, -42, 30, nty + 6); g.stroke();
  // wattle (jiggles)
  const wig = Math.sin(t.time * 6 + 2) * 2;
  g.fillStyle = '#f5c531';
  g.strokeStyle = '#b3860f'; g.lineWidth = 2.5;
  g.beginPath();
  g.ellipse(28, nty + 13 + wig * 0.4, 4.5, 7.5 + wig * 0.5, 0.1, 0, Math.PI * 2);
  g.fill(); g.stroke();
  // head
  g.fillStyle = '#d95643';
  g.strokeStyle = '#7e2418'; g.lineWidth = 2.5;
  g.beginPath(); g.arc(30, nty, 8.5, 0, Math.PI * 2); g.fill(); g.stroke();
  // head wrinkles
  g.strokeStyle = 'rgba(126,36,24,0.6)'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(30, nty + 3, 6.5, 0.5, 1.4); g.stroke();
  // beak
  g.fillStyle = '#d8c9a8';
  g.strokeStyle = '#6e6148'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(36, nty - 3); g.lineTo(46, nty); g.lineTo(36, nty + 3); g.closePath();
  g.fill(); g.stroke();
  // eye
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(32, nty - 2, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#101014';
  g.beginPath(); g.arc(33.2, nty - 2, 1.6, 0, Math.PI * 2); g.fill();
  // angry brow when digging / boss
  if (digging || isBoss) {
    g.strokeStyle = '#7e2418'; g.lineWidth = 2.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(27.5, nty - 7.5); g.lineTo(35.5, nty - 5); g.stroke();
  }

  // hit flash
  if (t.flash > 0) {
    g.globalAlpha = clamp(t.flash * 8, 0, 0.85);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(0, -30, 34, 34, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }
  g.restore();
}

// ============================================================
// Turkeys (logic)
// ============================================================
function speedScaleForWave(n) { return Math.min(2.2, 1 + 0.09 * (n - 1)); }

function spawnTurkey() {
  const ss = speedScaleForWave(wave.num);
  const fromMound = Math.random() < 0.35;
  let x, y;
  if (fromMound) {
    x = rand(150, W - 150);
    y = rand(520, 688);
    mounds.push({ x, y, r: 26, life: 22 });
    dustBurst(x, y, 12);
  } else {
    y = rand(505, 688);
    x = Math.random() < 0.5 ? -60 : W + 60;
  }
  turkeys.push({
    x, y, z: 0, zV: 0, face: x < 0 ? 1 : -1, scale: 1, state: 'wander',
    speed: rand(38, 62) * ss,
    target: pick(beds),
    walk: rand(0, 6), time: rand(0, 10),
    hopT: rand(1.5, 4), dartT: rand(2, 5),
    spawnAnim: fromMound ? 0.45 : 0.15,
    mulchT: 0, squawkT: rand(2, 7), cower: 0, squash: 1, flash: 0,
    hitR: 46, fleeT: 0, fleeX: 0, fleeY: 0, isBoss: false,
  });
}

function scareNear(x, y) {
  for (const t of turkeys) {
    if (t.spawnAnim > 0) continue;
    if (dist(t.x, t.y, x, y) < 180 && Math.random() < 0.55) {
      t.state = 'flee';
      t.fleeT = rand(0.8, 1.4);
      const a = Math.atan2(t.y - y, t.x - x) + rand(-0.4, 0.4);
      t.fleeX = t.x + Math.cos(a) * 320;
      t.fleeY = clamp(t.y + Math.sin(a) * 320, 502, 692);
    }
  }
}

function updateTurkeys(dt) {
  for (let i = turkeys.length - 1; i >= 0; i--) {
    const t = turkeys[i];
    t.time += dt;
    t.flash = Math.max(0, t.flash - dt);
    if (t.spawnAnim > 0) {
      t.spawnAnim -= dt;
      if (t.spawnAnim <= 0 && t.x <= -60) t.face = 1;
      continue;
    }
    // cower (Bazza scream)
    if (t.cower > 0) {
      t.cower -= dt;
      t.squash = lerp(t.squash, 0.72, 10 * dt);
    } else {
      t.squash = lerp(t.squash, 1, 8 * dt);
    }
    // hop
    if (t.z === 0 && t.zV === 0 && t.state !== 'dig' && t.cower <= 0) {
      t.hopT -= dt;
      if (t.hopT <= 0) {
        t.zV = t.state === 'dart' ? 200 : 185;
        t.hopT = rand(2.5, 5);
      }
    }
    if (t.z > 0 || t.zV > 0) {
      t.z += t.zV * dt;
      t.zV -= 600 * dt;
      if (t.z <= 0) { t.z = 0; t.zV = 0; dustBurst(t.x, t.y, 4); }
    }
    // occasional squawk
    t.squawkT -= dt;
    if (t.squawkT <= 0) {
      Sound.squawk(t.cower > 0 ? 500 : 700);
      t.squawkT = rand(4, 10);
    }

    let moving = 0;
    if (t.cower > 0) {
      // frozen in fear
    } else if (t.state === 'wander') {
      const dx = t.target.x - t.x, dy = t.target.y - t.y;
      const d = Math.hypot(dx, dy) || 1;
      const wig = Math.sin(t.time * 3) * 0.9;
      const px = -dy / d, py = dx / d;
      t.x += ((dx / d) + px * wig) * t.speed * dt;
      t.y += ((dy / d) + py * wig * 0.4) * t.speed * dt;
      moving = t.speed;
      t.face = dx >= 0 ? 1 : -1;
      t.dartT -= dt;
      if (t.dartT <= 0) {
        t.state = 'dart';
        t.dartT = rand(0.7, 1.4);
        t.zV = 200;
        if (t.z === 0) t.z = 0.01;
      }
      if (d < 95) {
        t.state = 'dig';
        if (digBubbleCool <= 0 && Math.random() < 0.6) {
          say(pick(LINES.dig));
          digBubbleCool = 7;
        }
      }
    } else if (t.state === 'dart') {
      const dx = t.target.x - t.x, dy = t.target.y - t.y;
      const d = Math.hypot(dx, dy) || 1;
      t.x += (dx / d) * t.speed * 3.1 * dt;
      t.y += (dy / d) * t.speed * 3.1 * dt;
      moving = t.speed * 3.1;
      t.face = dx >= 0 ? 1 : -1;
      t.dartT -= dt;
      if (Math.random() < 12 * dt) dustBurst(t.x - t.face * 20, t.y, 3);
      if (t.dartT <= 0) t.state = 'wander';
      if (d < 80) t.state = 'dig';
    } else if (t.state === 'dig') {
      t.mulchT -= dt;
      if (t.mulchT <= 0) {
        mulchBurst(t.x, t.y - 10);
        if (Math.random() < 0.4) Sound.dig();
        t.mulchT = rand(0.18, 0.32);
      }
      t.walk += dt * 1.2;
      if (Math.random() < 0.5 * dt) Sound.cluck();
      // occasionally re-target
      if (Math.random() < 0.08 * dt) { t.state = 'wander'; t.target = pick(beds); }
    } else if (t.state === 'flee') {
      const dx = t.fleeX - t.x, dy = t.fleeY - t.y;
      const d = Math.hypot(dx, dy) || 1;
      t.x += (dx / d) * t.speed * 2.7 * dt;
      t.y += (dy / d) * t.speed * 2.7 * dt;
      moving = t.speed * 2.7;
      t.face = dx >= 0 ? 1 : -1;
      t.fleeT -= dt;
      if (Math.random() < 14 * dt) dustBurst(t.x - t.face * 20, t.y, 3);
      if (t.fleeT <= 0) { t.state = 'wander'; t.target = pick(beds); }
    }

    t.walk += moving * dt * 0.09;
    t.x = clamp(t.x, -80, W + 80);
    t.y = clamp(t.y, 498, 694);
  }
}

// ============================================================
// Corpses (comedic tumble off-screen, no blood)
// ============================================================
function updateCorpses(dt) {
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i];
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.vy += 950 * dt;
    c.rot += c.vr * dt;
    c.time += dt;
    if (c.y > H + 140 || c.x < -220 || c.x > W + 220) corpses.splice(i, 1);
  }
}
function drawCorpses(g) {
  for (const c of corpses) {
    drawTurkey(g, { x: c.x, y: c.y, z: 0, face: c.face, scale: c.scale, state: 'dead', walk: 0, time: c.time, squash: 1, rot: c.rot, flash: 0, isBoss: c.isBoss });
  }
}

// ============================================================
// Big Bazza (boss)
// ============================================================
function spawnBazza() {
  bazza = {
    x: -150, y: 648, z: 0, zV: 0, face: 1, scale: 3, state: 'strut',
    hp: 10, maxHp: 10, speed: 52, walk: 0, time: 0,
    screamT: 4.5, clodT: 3.2, hitR: 105, flash: 0, cower: 0, squash: 1, isBoss: true,
  };
}

function updateBazza(dt) {
  if (!bazza) return;
  const b = bazza;
  b.time += dt;
  b.flash = Math.max(0, b.flash - dt);
  b.squash = lerp(b.squash, 1, 6 * dt);
  // strut
  if (b.x < 190) b.face = 1;
  if (b.x > W - 190) b.face = -1;
  b.x += b.face * b.speed * dt;
  b.walk += dt * 0.8;
  // scream
  b.screamT -= dt;
  if (b.screamT <= 0) {
    Sound.scream();
    shake = Math.min(shake + 15, 30);
    ringAt(b.x, b.y - 160);
    b.squash = 0.88;
    for (const t of turkeys) if (Math.random() < 0.7) t.cower = rand(0.5, 0.9);
    if (Math.random() < 0.5) say(pick(LINES.boss), 2);
    b.screamT = rand(5, 7.5);
  }
  // fling clod at camera
  b.clodT -= dt;
  if (b.clodT <= 0) {
    clods.push({
      x0: b.x + b.face * 40, y0: b.y - 160,
      tx: rand(W * 0.2, W * 0.8), ty: rand(H * 0.2, H * 0.6),
      t: 0, dur: rand(0.85, 1.1),
    });
    Sound.thud();
    b.clodT = rand(3, 4.6);
  }
}

function hitBazza() {
  const b = bazza;
  b.hp--;
  b.flash = 0.1;
  shake = Math.min(shake + 6, 26);
  hitStop = 0.03;
  featherBurst(b.x, b.y - 140, 1.6);
  Sound.squawk(420);
  comboT = 2; comboCount++;
  const mult = Math.min(comboCount, 5);
  const pts = 100 * mult;
  addScore(pts, b.x, b.y - 260, false, mult);
  missStreak = 0;
  if (b.hp <= 0) defeatBazza();
}

function defeatBazza() {
  const b = bazza;
  corpses.push({ x: b.x, y: b.y - 120, vx: rand(-60, 60), vy: -rand(260, 380), rot: 0, vr: rand(6, 10) * (Math.random() < 0.5 ? 1 : -1), scale: 3, face: b.face, time: 0, isBoss: true });
  featherBurst(b.x, b.y - 140, 2.6);
  featherBurst(b.x + 40, b.y - 180, 2.2);
  shake = Math.min(shake + 12, 30);
  hitStop = 0.05;
  addScore(500, b.x, b.y - 280, false, 1);
  popup(b.x, b.y - 230, 'BAZZA DOWN!', '#ffd23f', 30);
  powerups.push({ x: clamp(b.x, 120, W - 120), y: clamp(b.y, 540, 680), kind: 'tray', time: 0 });
  say(pick(LINES.bossDown), 3.2);
  showBanner('BIG BAZZA DEFEATED!', '+500 TURKEY TOLL', '#ffd23f', 2.4);
  Sound.squawk(300);
  bazza = null;
}

// ============================================================
// Clods & screen splats
// ============================================================
function updateClods(dt) {
  for (let i = clods.length - 1; i >= 0; i--) {
    const c = clods[i];
    c.t += dt;
    if (c.t >= c.dur) {
      const n = randi(2, 3);
      for (let s = 0; s < n; s++) {
        splats.push({
          x: c.tx + rand(-70, 70), y: c.ty + rand(-40, 40),
          r: rand(55, 115), life: 1.7, max: 1.7,
        });
      }
      Sound.splat();
      clods.splice(i, 1);
    }
  }
  for (let i = splats.length - 1; i >= 0; i--) {
    splats[i].life -= dt;
    if (splats[i].life <= 0) splats.splice(i, 1);
  }
}
function drawClods(g) {
  for (const c of clods) {
    const p = clamp(c.t / c.dur, 0, 1);
    const x = lerp(c.x0, c.tx, p);
    const y = lerp(c.y0, c.ty, p) - Math.sin(p * Math.PI) * 110;
    const s = 0.35 + p * 2.0;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.rotate(p * 7);
    g.fillStyle = '#6b4a2a';
    g.strokeStyle = '#3f2a12'; g.lineWidth = 4;
    g.beginPath();
    g.ellipse(0, 0, 22, 18, 0.3, 0, Math.PI * 2);
    g.ellipse(14, 6, 12, 10, -0.4, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.fillStyle = '#54381c';
    g.beginPath(); g.ellipse(-6, -6, 8, 6, 0.5, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}
function drawSplats(g) {
  for (const s of splats) {
    const a = clamp(s.life / 0.6, 0, 1) * 0.85;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = '#6b4423';
    g.strokeStyle = '#3f2410'; g.lineWidth = 5;
    g.beginPath();
    g.ellipse(s.x, s.y, s.r, s.r * 0.8, 0.3, 0, Math.PI * 2);
    g.ellipse(s.x + s.r * 0.7, s.y + s.r * 0.3, s.r * 0.45, s.r * 0.35, -0.4, 0, Math.PI * 2);
    g.ellipse(s.x - s.r * 0.6, s.y - s.r * 0.2, s.r * 0.4, s.r * 0.32, 0.8, 0, Math.PI * 2);
    g.fill(); g.stroke();
    // drips
    g.fillStyle = '#54381c';
    g.beginPath(); g.ellipse(s.x + s.r * 0.3, s.y + s.r * 0.8, s.r * 0.12, s.r * 0.3, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(s.x - s.r * 0.4, s.y + s.r * 0.7, s.r * 0.1, s.r * 0.24, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}

// ============================================================
// Power-ups
// ============================================================
function spawnPowerup(x, y) {
  const kind = pick(['snag', 'tray', 'gnome']);
  powerups.push({ x: clamp(x, 90, W - 90), y: clamp(y, 520, 685), kind, time: 0 });
}
function collectPowerup(pu) {
  Sound.pickup();
  if (pu.kind === 'snag') {
    shells = MAG + 6;
    reloading = false;
    popup(pu.x, pu.y - 40, 'SNAG! 12 SHELLS', '#f5c531', 24);
  } else if (pu.kind === 'tray') {
    addScore(500, pu.x, pu.y - 40, false, 1);
    popup(pu.x, pu.y - 80, 'MEAT TRAY!', '#ff8a8a', 30);
    meatFlash = 1.2;
  } else if (pu.kind === 'gnome') {
    health = Math.min(100, health + 15);
    popup(pu.x, pu.y - 40, 'GNOME! PATCH +15%', '#7fe05a', 24);
  }
}
function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pu = powerups[i];
    pu.time += dt;
    if (Math.random() < 2.5 * dt) sparkleAt(pu.x, pu.y - 16);
  }
}

function drawSnag(g, x, y) {
  g.save();
  g.translate(x, y);
  // bread
  g.fillStyle = '#e8b96a';
  g.strokeStyle = '#8a5f2a'; g.lineWidth = 3; g.lineJoin = 'round';
  roundRectPath(g, -26, -12, 52, 26, 10); g.fill(); g.stroke();
  g.fillStyle = '#f5d49a';
  roundRectPath(g, -20, -6, 40, 10, 5); g.fill();
  // sausage
  g.fillStyle = '#c05a3a';
  g.strokeStyle = '#6e2a14'; g.lineWidth = 2.5;
  roundRectPath(g, -30, -20, 60, 13, 6); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(110,42,20,0.6)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-14, -17); g.lineTo(-10, -11); g.stroke();
  g.restore();
}
function drawTray(g, x, y) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#f2f2f2';
  g.strokeStyle = '#9a9aa5'; g.lineWidth = 3; g.lineJoin = 'round';
  roundRectPath(g, -30, -14, 60, 26, 5); g.fill(); g.stroke();
  g.fillStyle = '#e88a94';
  g.strokeStyle = '#a54a55'; g.lineWidth = 2.5;
  roundRectPath(g, -22, -8, 44, 14, 5); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath(); g.moveTo(-18, -6); g.lineTo(2, -6); g.lineTo(-8, 4); g.closePath(); g.fill();
  g.restore();
}
function drawGnomeFigure(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  // body
  g.fillStyle = '#3a6ea8';
  g.strokeStyle = '#1e3a5c'; g.lineWidth = 2.5; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(-8, -20, 0, -20); g.quadraticCurveTo(8, -20, 9, 0); g.closePath();
  g.fill(); g.stroke();
  // beard
  g.fillStyle = '#f2f2f2';
  g.beginPath(); g.moveTo(-7, -18); g.quadraticCurveTo(0, -6, 7, -18); g.quadraticCurveTo(0, -22, -7, -18); g.closePath();
  g.fill(); g.stroke();
  // face
  g.fillStyle = '#e8b088';
  g.beginPath(); g.arc(0, -22, 6, 0, Math.PI * 2); g.fill(); g.stroke();
  // nose
  g.fillStyle = '#e09868';
  g.beginPath(); g.arc(0, -21, 2.6, 0, Math.PI * 2); g.fill();
  // hat
  g.fillStyle = '#d03a2a';
  g.strokeStyle = '#701a10'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(-8, -26); g.lineTo(0, -44); g.lineTo(8, -26); g.closePath();
  g.fill(); g.stroke();
  g.restore();
}
function drawPowerups(g) {
  for (const pu of powerups) {
    const pulse = 1 + Math.sin(pu.time * 4) * 0.08;
    drawShadow(g, pu.x, pu.y + 14, 24 * pulse, 0);
    // glow ring
    g.save();
    g.globalAlpha = 0.5 + Math.sin(pu.time * 4) * 0.2;
    g.strokeStyle = '#ffe680'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(pu.x, pu.y + 14, 30 * pulse, 9 * pulse, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
    g.save();
    g.translate(pu.x, pu.y - 10);
    g.scale(pulse, pulse);
    if (pu.kind === 'snag') drawSnag(g, 0, 0);
    else if (pu.kind === 'tray') drawTray(g, 0, 0);
    else drawGnomeFigure(g, 0, 10, 1.1);
    g.restore();
    const label = pu.kind === 'snag' ? 'SNAG' : pu.kind === 'tray' ? 'MEAT TRAY' : 'GNOME';
    outlinedText(g, label, pu.x, pu.y + 32, 'bold 13px Verdana, sans-serif', '#fff', 'rgba(20,10,0,0.9)', 3);
  }
}

// ============================================================
// Scoring / combo
// ============================================================
function addScore(pts, x, y, air, mult) {
  score += pts;
  if (score > high) { high = score; saveHigh(high); }
  let text = '+' + pts;
  if (air) text = 'AIR SHOT! +' + pts;
  popup(x, y, text, air ? '#ffe680' : '#ffffff', air ? 26 : 24);
  if (mult > 1) popup(x, y - 28, 'COMBO x' + mult, '#ff9f4a', 20);
}

function killTurkey(t) {
  const idx = turkeys.indexOf(t);
  if (idx >= 0) turkeys.splice(idx, 1);
  corpses.push({
    x: t.x, y: t.y - (t.z || 0),
    vx: (t.x >= mouse.x ? 1 : -1) * rand(130, 240),
    vy: -rand(300, 440),
    rot: 0, vr: rand(7, 13) * (t.x >= mouse.x ? 1 : -1),
    scale: t.scale, face: t.face, time: 0, isBoss: false,
  });
  featherBurst(t.x, t.y - (t.z || 0) - 30, 1);
  Sound.squawkHit();
  hitStop = 0.03;
  shake = Math.min(shake + 4, 26);
  comboT = 2; comboCount++;
  const mult = Math.min(comboCount, 5);
  const air = (t.z || 0) > 12;
  addScore((air ? 125 : 100) * mult, t.x, t.y - (t.z || 0) - 60, air, mult);
  missStreak = 0;
  if (Math.random() < 0.12 && powerups.length < 4) spawnPowerup(t.x, t.y);
}

// ============================================================
// Firing
// ============================================================
function startReload() {
  if (screen !== SCR.PLAYING) return;
  if (reloading || shells >= MAG) return;
  reloading = true;
  reloadT = RELOAD_TIME;
  Sound.reload();
}

function fire() {
  if (reloading) return;
  if (shells <= 0) {
    Sound.empty();
    popup(mouse.x, mouse.y - 34, 'PRESS R TO RELOAD!', '#ff9f4a', 17);
    return;
  }
  shells--;
  shotFlash = 0.07;
  shake = Math.min(shake + 5, 26);
  Sound.shot();
  // hit test turkeys
  let best = null, bestD = 1e9;
  for (const t of turkeys) {
    if (t.spawnAnim > 0.25) continue;
    const d = dist(mouse.x, mouse.y, t.x, t.y - (t.z || 0) * 0.6);
    if (d < t.hitR && d < bestD) { best = t; bestD = d; }
  }
  if (best) { killTurkey(best); return; }
  if (bazza) {
    const d = dist(mouse.x, mouse.y, bazza.x, bazza.y - 130);
    if (d < bazza.hitR) { hitBazza(); return; }
  }
  // miss
  missStreak++;
  scareNear(mouse.x, mouse.y);
  if (missStreak >= 3) {
    koalaCover = 5;
    if (missBubbleCool <= 0) {
      say(pick(LINES.miss));
      missBubbleCool = 8;
    }
  }
}

// ============================================================
// Wave manager
// ============================================================
const wave = { num: 0, toSpawn: 0, spawnT: 0, state: 'idle', breakT: 0, isBoss: false };

function spawnIntervalFor(n) {
  return clamp(3.2 - 0.18 * (n - 1), 0.85, 3.2);
}

function startWave(n) {
  wave.num = n;
  wave.isBoss = n % 5 === 0;
  wave.toSpawn = wave.isBoss ? Math.ceil((4 + 2 * n) / 3) : 4 + 2 * n;
  wave.spawnT = 1.4;
  wave.state = 'spawning';
  if (wave.isBoss) {
    spawnBazza();
    showBanner('WAVE ' + n, 'BIG BAZZA INCOMING!', '#ff6a5a', 2.6);
    say(pick(LINES.boss), 3);
    Sound.horn();
  } else {
    showBanner('WAVE ' + n, '', '#ffd23f', 2.2);
    say(pick(LINES.waveStart), 3);
    Sound.horn();
  }
}

function updateWave(dt) {
  if (wave.state === 'spawning') {
    wave.spawnT -= dt;
    if (wave.spawnT <= 0 && wave.toSpawn > 0) {
      spawnTurkey();
      wave.toSpawn--;
      wave.spawnT = spawnIntervalFor(wave.num) * rand(0.7, 1.3);
    }
    if (wave.toSpawn === 0 && turkeys.length === 0 && !bazza) {
      wave.state = 'break';
      wave.breakT = 2.5;
      health = Math.min(100, health + 10);
      showBanner('WAVE ' + wave.num + ' CLEAR', '+10% PATCH REPAIRS', '#7fe05a', 2.3);
      say(pick(LINES.waveBreak), 2.5);
      Sound.pickup();
    }
  } else if (wave.state === 'break') {
    wave.breakT -= dt;
    if (wave.breakT <= 0) startWave(wave.num + 1);
  }
}

// ============================================================
// Garden beds (degrade with health)
// ============================================================
function drawGardenBed(g, bed, idx) {
  const bw = 230, bh = 80;
  const hStage = health > 70 ? 0 : health > 35 ? 1 : 2;
  g.save();
  g.translate(bed.x, bed.y);
  // shadow
  g.fillStyle = 'rgba(20,40,15,0.25)';
  g.beginPath(); g.ellipse(0, bh / 2 + 4, bw / 2 + 8, 12, 0, 0, Math.PI * 2); g.fill();
  // wooden frame
  g.fillStyle = '#8a5a33';
  g.strokeStyle = '#4a2f14'; g.lineWidth = 4; g.lineJoin = 'round';
  roundRectPath(g, -bw / 2, -bh / 2, bw, bh, 8); g.fill(); g.stroke();
  // plank lines
  g.strokeStyle = 'rgba(60,38,16,0.5)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-bw / 2 + 4, -bh / 2 + 12); g.lineTo(bw / 2 - 4, -bh / 2 + 12); g.stroke();
  g.beginPath(); g.moveTo(-bw / 2 + 4, bh / 2 - 12); g.lineTo(bw / 2 - 4, bh / 2 - 12); g.stroke();
  // soil
  g.fillStyle = '#5c4128';
  roundRectPath(g, -bw / 2 + 8, -bh / 2 + 9, bw - 16, bh - 18, 5); g.fill();
  // dirt spread as health drops
  if (hStage >= 1) {
    g.fillStyle = 'rgba(70,50,26,0.85)';
    for (let i = 0; i < 3; i++) {
      const px = (prand(idx * 11 + i) - 0.5) * (bw - 60);
      g.beginPath(); g.ellipse(px, (prand(idx * 7 + i) - 0.5) * 30, 22, 10, 0.2, 0, Math.PI * 2); g.fill();
    }
  }
  // lettuce rows (front)
  const missing = hStage === 0 ? 0 : hStage === 1 ? 4 : 7;
  for (let i = 0; i < 8; i++) {
    if (i < missing) continue;
    const lx = -bw / 2 + 28 + (i % 4) * 52;
    const ly = bh / 2 - 24 - Math.floor(i / 4) * 18;
    const tilt = hStage >= 1 && i % 3 === 0 ? 0.4 : 0;
    g.save();
    g.translate(lx, ly);
    g.rotate(tilt * (i % 2 ? 1 : -1));
    g.fillStyle = '#6fc23c';
    g.strokeStyle = '#3f7d1e'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(40,90,15,0.7)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-6, -3); g.quadraticCurveTo(0, -8, 6, -3); g.stroke();
    g.restore();
  }
  // tomato stakes (back)
  for (let i = 0; i < 3; i++) {
    const sx = -bw / 2 + 42 + i * 66;
    const sy = -bh / 2 + 22;
    g.strokeStyle = '#a9825c'; g.lineWidth = 3.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx - 8, sy + 16); g.lineTo(sx - 8, sy - 12); g.stroke();
    g.beginPath(); g.moveTo(sx + 8, sy + 16); g.lineTo(sx + 8, sy - 12); g.stroke();
    g.beginPath(); g.moveTo(sx - 10, sy - 8); g.lineTo(sx + 10, sy - 8); g.stroke();
    if (hStage < 2 || i === 1) {
      g.fillStyle = '#e0392a';
      g.strokeStyle = '#8a1a10'; g.lineWidth = 2;
      g.beginPath(); g.arc(sx - 2, sy - 1, 6, 0, Math.PI * 2); g.fill(); g.stroke();
      if (hStage === 0) {
        g.beginPath(); g.arc(sx + 7, sy + 5, 5, 0, Math.PI * 2); g.fill(); g.stroke();
      }
    }
  }
  // mulch mounds when bad
  if (hStage >= 2) {
    g.fillStyle = '#7a5a35';
    g.strokeStyle = '#4a3418'; g.lineWidth = 2.5;
    for (let i = 0; i < 2; i++) {
      const mx = (prand(idx * 31 + i) - 0.5) * (bw - 80);
      g.beginPath(); g.ellipse(mx, -bh / 2 + 26, 18, 9, 0, Math.PI, 0); g.closePath();
      g.fill(); g.stroke();
    }
  }
  g.restore();
}

function drawGnome(g, x, y) {
  // decorative garden gnome next to middle bed
  drawShadow(g, x, y + 2, 16, 0);
  drawGnomeFigure(g, x, y, 1.6);
}

// ============================================================
// Hills Hoist (dynamic — towels sway)
// ============================================================
function drawHillsHoist(g) {
  const x = 830, baseY = 560, topY = 330;
  drawShadow(g, x, baseY + 4, 30, 0);
  // pole
  g.strokeStyle = '#7d8790'; g.lineWidth = 8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, baseY); g.lineTo(x, topY); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(x - 2, baseY - 4); g.lineTo(x - 2, topY + 4); g.stroke();
  // arms
  g.strokeStyle = '#6d7880'; g.lineWidth = 5;
  const armY = topY + 14;
  g.beginPath(); g.moveTo(x - 95, armY + 26); g.lineTo(x, armY); g.lineTo(x + 95, armY + 26); g.stroke();
  g.beginPath(); g.moveTo(x - 70, armY + 44); g.lineTo(x, armY + 6); g.lineTo(x + 70, armY + 44); g.stroke();
  // towels (sway)
  const towels = [
    { dx: -58, y: armY + 30, w: 34, h: 44, c: '#4aa8a0' },
    { dx: 8, y: armY + 10, w: 36, h: 50, c: '#e8e4da' },
    { dx: 62, y: armY + 28, w: 32, h: 40, c: '#d05a4a' },
  ];
  for (let i = 0; i < towels.length; i++) {
    const tw = towels[i];
    const sway = Math.sin(time * 1.6 + i * 1.3) * 4;
    g.save();
    g.translate(x + tw.dx + sway * 0.3, tw.y);
    g.rotate(sway * 0.015);
    g.fillStyle = tw.c;
    g.strokeStyle = 'rgba(30,30,40,0.55)'; g.lineWidth = 2.5; g.lineJoin = 'round';
    roundRectPath(g, -tw.w / 2, 0, tw.w, tw.h, 4); g.fill(); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(-tw.w / 2, 0, tw.w, 6);
    g.restore();
  }
}

// ============================================================
// Koala (covers eyes when you miss repeatedly)
// ============================================================
let koalaCover = 0;
function drawKoala(g) {
  const x = 185, y = 122;
  const covering = koalaCover > 0;
  g.save();
  g.translate(x, y + Math.sin(time * 1.2) * 2);
  if (covering) g.rotate(0.12);
  // ears
  g.fillStyle = '#8d959f';
  g.strokeStyle = '#4a5058'; g.lineWidth = 3; g.lineJoin = 'round';
  g.beginPath(); g.arc(-22, -20, 11, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.arc(22, -20, 11, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#c9b8b0';
  g.beginPath(); g.arc(-22, -20, 5.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(22, -20, 5.5, 0, Math.PI * 2); g.fill();
  // head
  g.fillStyle = '#9aa3ad';
  g.beginPath(); g.ellipse(0, 0, 21, 19, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  // nose
  g.fillStyle = '#2c2c34';
  g.beginPath(); g.ellipse(0, 3, 7, 10, 0, 0, Math.PI * 2); g.fill();
  // eyes / paws
  if (covering) {
    g.fillStyle = '#9aa3ad';
    g.strokeStyle = '#4a5058'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(-9, -4, 6.5, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(9, -4, 6.5, 0, Math.PI * 2); g.fill(); g.stroke();
  } else {
    const blink = (Math.sin(time * 0.7) > 0.97);
    g.fillStyle = '#fff';
    if (!blink) {
      g.beginPath(); g.arc(-9, -4, 3.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(9, -4, 3.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#101014';
      g.beginPath(); g.arc(-9, -4, 1.7, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(9, -4, 1.7, 0, Math.PI * 2); g.fill();
    } else {
      g.strokeStyle = '#4a5058'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-12, -4); g.lineTo(-6, -4); g.stroke();
      g.beginPath(); g.moveTo(6, -4); g.lineTo(12, -4); g.stroke();
    }
  }
  g.restore();
  if (covering) {
    outlinedText(g, "can't watch!", x + 6, y - 42, 'italic bold 14px Verdana, sans-serif', '#fff', 'rgba(20,10,0,0.9)', 3);
  }
}

// ============================================================
// HUD
// ============================================================
function drawShellIcon(g, x, y, filled) {
  g.save();
  g.translate(x, y);
  if (filled) {
    g.fillStyle = '#c8352a';
    roundRectPath(g, -6, -22, 12, 17, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(-3.5, -19, 2.5, 12);
    g.fillStyle = '#d8a03c';
    g.fillRect(-6, -5, 12, 7);
    g.strokeStyle = '#4a1a12'; g.lineWidth = 2;
    roundRectPath(g, -6, -22, 12, 22, 3); g.stroke();
  } else {
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 2;
    roundRectPath(g, -6, -22, 12, 22, 3); g.stroke();
  }
  g.restore();
}

function drawHUD(g) {
  // --- score panel (top-left)
  g.save();
  g.globalAlpha = 0.88;
  g.fillStyle = '#14202b';
  g.strokeStyle = '#3d5a45'; g.lineWidth = 3;
  roundRectPath(g, 20, 18, 250, 78, 12); g.fill(); g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = '#9fd08a';
  g.font = 'bold 15px Verdana, sans-serif';
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('TURKEY TOLL', 36, 40);
  outlinedText(g, String(score), 36, 68, '900 34px "Arial Black", Verdana, sans-serif', '#ffffff', 'rgba(0,0,0,0.8)', 5, 'left');

  // --- high score (top-right)
  g.globalAlpha = 0.88;
  g.fillStyle = '#14202b';
  g.strokeStyle = '#3d5a45'; g.lineWidth = 3;
  roundRectPath(g, W - 220, 18, 200, 56, 12); g.fill(); g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = '#9fd08a';
  g.font = 'bold 14px Verdana, sans-serif';
  g.fillText('BEST TOLL', W - 204, 38);
  outlinedText(g, String(high), W - 36, 54, '900 24px "Arial Black", Verdana, sans-serif', '#ffd23f', 'rgba(0,0,0,0.8)', 4, 'right');
  if (muted) {
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = 'bold 12px Verdana, sans-serif';
    g.fillText('MUTED (M)', W - 204, 62);
  }
  g.restore();

  // --- wave chip (top-centre)
  if (screen === SCR.PLAYING || screen === SCR.PAUSED) {
    const label = wave.isBoss ? 'WAVE ' + wave.num + ' — BIG BAZZA' : 'WAVE ' + wave.num;
    g.save();
    g.font = '900 20px "Arial Black", Verdana, sans-serif';
    const tw = g.measureText(label).width + 36;
    g.globalAlpha = 0.88;
    g.fillStyle = wave.isBoss ? '#5a1a14' : '#14202b';
    g.strokeStyle = wave.isBoss ? '#ff6a5a' : '#3d5a45'; g.lineWidth = 3;
    roundRectPath(g, W / 2 - tw / 2, 18, tw, 38, 10); g.fill(); g.stroke();
    g.globalAlpha = 1;
    outlinedText(g, label, W / 2, 38, '900 20px "Arial Black", Verdana, sans-serif', wave.isBoss ? '#ff8a7a' : '#ffd23f', 'rgba(0,0,0,0.8)', 4);
    g.restore();
  }

  // --- ammo (bottom-left)
  const nSlots = Math.max(MAG, Math.min(shells, MAG));
  for (let i = 0; i < MAG; i++) {
    drawShellIcon(g, 40 + i * 26, H - 30, i < shells);
  }
  if (shells > MAG) {
    outlinedText(g, '+' + (shells - MAG), 40 + MAG * 26 + 8, H - 40, '900 20px "Arial Black", Verdana, sans-serif', '#ffd23f', 'rgba(0,0,0,0.8)', 4, 'left');
  }
  if (reloading) {
    const p = 1 - reloadT / RELOAD_TIME;
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 5;
    g.beginPath(); g.arc(126, H - 38, 20, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#f5c531';
    g.beginPath(); g.arc(126, H - 38, 20, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke();
    outlinedText(g, 'PUMPING...', 126, H - 70, 'bold 12px Verdana, sans-serif', '#f5c531', 'rgba(0,0,0,0.8)', 3);
  }

  // --- garden health sign (bottom-right), tilts as health drops
  const sw = 218, shh = 68;
  const sx = W - sw - 26, sy = H - shh - 20;
  const tilt = (1 - health / 100) * 0.22;
  const wobble = health < prevHealth - 0.001 ? Math.sin(time * 30) * 0.05 : 0;
  g.save();
  g.translate(sx + sw / 2, sy + shh);
  g.rotate(tilt + wobble);
  g.translate(-sw / 2, -shh);
  const wood = g.createLinearGradient(0, 0, 0, shh);
  wood.addColorStop(0, '#8a5a33');
  wood.addColorStop(1, '#6e431f');
  g.fillStyle = wood;
  g.strokeStyle = '#3f2610'; g.lineWidth = 4; g.lineJoin = 'round';
  roundRectPath(g, 0, 0, sw, shh, 10); g.fill(); g.stroke();
  g.fillStyle = '#3f2610';
  g.beginPath(); g.arc(12, 12, 3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(sw - 12, 12, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f5e6c8';
  g.font = 'bold 15px Verdana, sans-serif';
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('THE PATCH', 14, 17);
  // bar
  const barX = 14, barY = 30, barW = sw - 28, barH = 24;
  g.fillStyle = '#2c1c10';
  roundRectPath(g, barX, barY, barW, barH, 5); g.fill();
  const hp = clamp(health, 0, 100) / 100;
  const hc = hp > 0.5 ? '#59c93c' : hp > 0.25 ? '#e8c53a' : '#d13b2a';
  if (hp > 0) {
    g.fillStyle = hc;
    roundRectPath(g, barX + 2, barY + 2, Math.max(6, (barW - 4) * hp), barH - 4, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(barX + 4, barY + 4, Math.max(2, (barW - 8) * hp), 4);
  }
  outlinedText(g, Math.ceil(health) + '%', barX + barW / 2, barY + barH / 2 + 1, '900 15px "Arial Black", Verdana, sans-serif', '#fff', 'rgba(0,0,0,0.7)', 3);
  g.restore();

  // --- Bazza health bar
  if (bazza) {
    const bw = 320, bh = 24;
    const bx = W / 2 - bw / 2, by = 66;
    g.save();
    g.fillStyle = 'rgba(20,10,10,0.85)';
    g.strokeStyle = '#ff6a5a'; g.lineWidth = 3;
    roundRectPath(g, bx, by, bw, bh, 8); g.fill(); g.stroke();
    const hp = bazza.hp / bazza.maxHp;
    if (hp > 0) {
      g.fillStyle = '#d13b2a';
      roundRectPath(g, bx + 3, by + 3, Math.max(6, (bw - 6) * hp), bh - 6, 5); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(bx + 6, by + 5, Math.max(2, (bw - 12) * hp), 4);
    }
    outlinedText(g, 'BIG BAZZA', W / 2, by + bh / 2 + 1, '900 15px "Arial Black", Verdana, sans-serif', '#fff', 'rgba(0,0,0,0.8)', 3);
    g.restore();
  }
}

function drawBanner(g) {
  if (!banner) return;
  const p = 1 - banner.timer / banner.max;
  const pop = 1 + Math.max(0, 0.18 - p) * 3;
  const a = clamp(banner.timer / 0.3, 0, 1);
  g.save();
  g.globalAlpha = a;
  g.translate(W / 2, 150);
  g.scale(pop, pop);
  outlinedText(g, banner.text, 0, 0, '900 58px "Arial Black", Verdana, sans-serif', banner.color, 'rgba(25,10,0,0.9)', 10);
  if (banner.sub) {
    outlinedText(g, banner.sub, 0, 46, '900 24px "Arial Black", Verdana, sans-serif', '#ffffff', 'rgba(25,10,0,0.9)', 6);
  }
  g.restore();
}

function drawBubble(g) {
  if (!bubble) return;
  const a = clamp(bubble.timer / 0.4, 0, 1);
  g.save();
  g.globalAlpha = a;
  g.font = 'bold 19px Verdana, sans-serif';
  const tw = Math.min(680, g.measureText(bubble.text).width + 44);
  const bx = W / 2 - tw / 2, by = H - 96;
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.strokeStyle = 'rgba(30,20,10,0.85)'; g.lineWidth = 3; g.lineJoin = 'round';
  roundRectPath(g, bx, by, tw, 42, 12); g.fill(); g.stroke();
  g.beginPath();
  g.moveTo(W / 2 - 12, by + 41);
  g.lineTo(W / 2 + 4, by + 41);
  g.lineTo(W / 2 - 1, by + 56);
  g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#2a1c10';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(bubble.text, W / 2, by + 22, tw - 30);
  g.restore();
}

function drawMeatFlash(g) {
  if (meatFlash <= 0) return;
  const a = clamp(meatFlash / 1.2, 0, 1);
  g.save();
  g.globalAlpha = a;
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, 0, W, H);
  const pop = 1 + (1 - a) * 0.5;
  g.translate(W / 2, H / 2 - 60);
  g.scale(pop, pop);
  g.rotate(Math.sin(time * 20) * 0.02);
  outlinedText(g, 'MEAT TRAY!', 0, 0, '900 72px "Arial Black", Verdana, sans-serif', '#ff8a8a', 'rgba(25,10,0,0.9)', 12);
  g.restore();
}

// ============================================================
// Crosshair & muzzle flash
// ============================================================
function drawCrosshair(g) {
  if (screen === SCR.PAUSED || screen === SCR.GAMEOVER) return;
  const x = mouse.x, y = mouse.y;
  const pop = shotFlash > 0 ? 1 + shotFlash * 4.5 : 1;
  g.save();
  g.translate(x, y);
  g.scale(pop, pop);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.stroke();
  g.beginPath();
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
    g.lineTo(Math.cos(a) * 21, Math.sin(a) * 21);
  }
  g.stroke();
  g.fillStyle = '#e23b2e';
  g.beginPath(); g.arc(0, 0, 3, 0, Math.PI * 2); g.fill();
  if (reloading) {
    const p = 1 - reloadT / RELOAD_TIME;
    g.strokeStyle = '#f5c531'; g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke();
  }
  g.restore();
  // muzzle flash
  if (shotFlash > 0) {
    const a = shotFlash / 0.07;
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    g.fillStyle = '#ffe680';
    g.beginPath();
    for (let s = 0; s < 6; s++) {
      const sa = s * Math.PI / 3 + time * 2;
      g.lineTo(Math.cos(sa) * 26, Math.sin(sa) * 26);
      g.lineTo(Math.cos(sa + Math.PI / 6) * 9, Math.sin(sa + Math.PI / 6) * 9);
    }
    g.closePath(); g.fill();
    g.fillStyle = '#fff8d0';
    g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}

// ============================================================
// Screens
// ============================================================
function drawTitle(g) {
  g.fillStyle = 'rgba(10,15,25,0.45)';
  g.fillRect(0, 0, W, H);
  // logo
  g.save();
  g.translate(W / 2, 190);
  g.rotate(-0.015);
  g.globalAlpha = 0.5;
  outlinedText(g, 'TURKEY SHOOT', 6, 8, '900 92px "Arial Black", Verdana, sans-serif', '#000', 'transparent', 0);
  g.globalAlpha = 1;
  const lg = g.createLinearGradient(0, -50, 0, 50);
  lg.addColorStop(0, '#ffd23f');
  lg.addColorStop(1, '#ff9f1c');
  outlinedText(g, 'TURKEY SHOOT', 0, 0, '900 92px "Arial Black", Verdana, sans-serif', lg, '#3a1d0a', 12);
  outlinedText(g, '— BACKYARD BATTLE —', 0, 66, '900 26px "Arial Black", Verdana, sans-serif', '#ffffff', 'rgba(25,10,0,0.9)', 6);
  g.restore();
  // tagline
  outlinedText(g, "G'day mate! The bloody bush turkeys are tearing up your backyard again.",
    W / 2, 310, 'bold 21px Verdana, sans-serif', '#ffe9c9', 'rgba(25,10,0,0.9)', 5);
  // controls hint
  outlinedText(g, 'MOUSE aim  ·  CLICK shoot  ·  R reload  ·  P pause  ·  M mute',
    W / 2, 356, 'bold 17px Verdana, sans-serif', '#cfe3d8', 'rgba(25,10,0,0.9)', 4);
  // best toll
  outlinedText(g, 'BEST TOLL: ' + high, W / 2, 402, '900 22px "Arial Black", Verdana, sans-serif', '#ffd23f', 'rgba(25,10,0,0.9)', 5);
  // click to start
  const pulse = 0.75 + Math.sin(time * 4) * 0.25;
  g.save();
  g.globalAlpha = pulse;
  outlinedText(g, 'CLICK TO START', W / 2, 470, '900 34px "Arial Black", Verdana, sans-serif', '#ffffff', '#3a1d0a', 8);
  g.restore();
}

function drawGameOver(g) {
  g.fillStyle = 'rgba(10,10,20,0.6)';
  g.fillRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, H / 2 - 40);
  // card
  g.fillStyle = 'rgba(20,16,28,0.9)';
  g.strokeStyle = '#5a2a20'; g.lineWidth = 4;
  roundRectPath(g, -370, -180, 740, 360, 20); g.fill(); g.stroke();
  outlinedText(g, 'YOUR BACKYARD', 0, -128, '900 52px "Arial Black", Verdana, sans-serif', '#ff6a5a', '#2a0d08', 10);
  outlinedText(g, 'IS ROOTED!', 0, -70, '900 52px "Arial Black", Verdana, sans-serif', '#ff6a5a', '#2a0d08', 10);
  outlinedText(g, 'FINAL TURKEY TOLL: ' + score, 0, -6, '900 30px "Arial Black", Verdana, sans-serif', '#ffffff', 'rgba(0,0,0,0.8)', 6);
  outlinedText(g, (newBest ? 'NEW BEST TOLL! ' : 'BEST TOLL: ') + high, 0, 38, '900 24px "Arial Black", Verdana, sans-serif', newBest ? '#7fe05a' : '#ffd23f', 'rgba(0,0,0,0.8)', 5);
  outlinedText(g, 'WAVE REACHED: ' + finalWaveNum, 0, 78, '900 22px "Arial Black", Verdana, sans-serif', '#cfe3d8', 'rgba(0,0,0,0.8)', 5);
  g.font = 'italic bold 19px Verdana, sans-serif';
  g.fillStyle = '#e8d8c0';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('"' + gameOverQuip + '"', 0, 118, 660);
  g.restore();
  const pulse = 0.75 + Math.sin(time * 4) * 0.25;
  g.save();
  g.globalAlpha = pulse;
  outlinedText(g, 'CLICK TO HAVE ANOTHER GO', W / 2, H / 2 + 158, '900 28px "Arial Black", Verdana, sans-serif', '#ffffff', '#3a1d0a', 7);
  g.restore();
}

function drawPaused(g) {
  g.fillStyle = 'rgba(10,10,20,0.55)';
  g.fillRect(0, 0, W, H);
  outlinedText(g, 'HAVING A NAP', W / 2, H / 2 - 40, '900 60px "Arial Black", Verdana, sans-serif', '#ffd23f', 'rgba(25,10,0,0.9)', 10);
  outlinedText(g, '(PAUSED)', W / 2, H / 2 + 14, '900 28px "Arial Black", Verdana, sans-serif', '#ffffff', 'rgba(25,10,0,0.9)', 6);
  const pulse = 0.7 + Math.sin(time * 4) * 0.3;
  g.save();
  g.globalAlpha = pulse;
  outlinedText(g, 'Click or press P to get back out there, mate.', W / 2, H / 2 + 70, 'bold 19px Verdana, sans-serif', '#e8d8c0', 'rgba(25,10,0,0.9)', 4);
  g.restore();
}

// ============================================================
// World render
// ============================================================
function drawWorld(g) {
  const par = (mouse.x - W / 2) / W;
  g.drawImage(skyLayer, -40 + par * -10, 0);
  for (const c of clouds) drawCloud(g, c);
  g.drawImage(treesLayer, -40 + par * -16, 0);
  drawKoala(g);
  g.drawImage(fenceLayer, -40 + par * -22, 0);
  g.drawImage(groundLayer, -40 + par * -26, 0);
  drawHillsHoist(g);
  drawMounds(g);
  for (let i = 0; i < beds.length; i++) drawGardenBed(g, beds[i], i);
  drawGnome(g, 772, 592);
  drawPowerups(g);
  // depth-sort turkeys + bazza by y
  const drawables = turkeys.slice();
  if (bazza) drawables.push(bazza);
  drawables.sort((a, b) => a.y - b.y);
  for (const t of drawables) {
    if (t.spawnAnim === undefined || t.spawnAnim <= 0) {
      drawShadow(g, t.x, t.y, 26 * (t.scale || 1), t.z);
    }
    g.save();
    if (t.spawnAnim > 0) {
      g.beginPath();
      g.rect(t.x - 100, 0, 200, t.y + 4);
      g.clip();
    }
    drawTurkey(g, t);
    g.restore();
  }
  drawCorpses(g);
  drawParticles(g);
  drawClods(g);
  drawPopups(g);
  drawSplats(g);
}

// ============================================================
// Game flow
// ============================================================
function startGame() {
  score = 0;
  health = 100;
  prevHealth = 100;
  shells = MAG;
  reloading = false;
  comboCount = 0;
  comboT = 0;
  missStreak = 0;
  turkeys = [];
  corpses = [];
  particles = [];
  popups = [];
  powerups = [];
  clods = [];
  splats = [];
  mounds = [];
  bazza = null;
  koalaCover = 0;
  meatFlash = 0;
  newBest = false;
  startHigh = high;
  banner = null;
  bubble = null;
  kookTimer = rand(14, 22);
  setScreen(SCR.PLAYING);
  startWave(1);
}

function doGameOver() {
  if (screen === SCR.GAMEOVER) return;
  finalWaveNum = wave.num;
  newBest = score > startHigh && score > 0;
  saveHigh(high);
  setScreen(SCR.GAMEOVER);
  gameOverQuip = pick(LINES.over);
  shake = Math.min(shake + 10, 26);
  Sound.gameover();
}

function togglePause() {
  if (screen === SCR.PLAYING) setScreen(SCR.PAUSED);
  else if (screen === SCR.PAUSED) setScreen(SCR.PLAYING);
}

// ============================================================
// Input
// ============================================================
function canvasPos(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left) * (W / r.width),
    y: (clientY - r.top) * (H / r.height),
  };
}

canvas.addEventListener('pointermove', (e) => {
  const p = canvasPos(e.clientX, e.clientY);
  mouse.x = p.x;
  mouse.y = p.y;
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  Sound.init();
  const p = canvasPos(e.clientX, e.clientY);
  mouse.x = p.x;
  mouse.y = p.y;
  if (screen === SCR.TITLE || screen === SCR.GAMEOVER) {
    startGame();
    return;
  }
  if (screen === SCR.PAUSED) {
    setScreen(SCR.PLAYING);
    return;
  }
  // playing: collect power-ups first, then shoot
  let collected = false;
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pu = powerups[i];
    if (dist(mouse.x, mouse.y, pu.x, pu.y - 10) < 55) {
      collectPowerup(pu);
      powerups.splice(i, 1);
      collected = true;
      break;
    }
  }
  fire();
  if (collected) { /* power-up click still fired a shot — all good */ }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  Sound.init();
  const k = (e.key || '').toLowerCase();
  if (k === 'p' || k === 'escape') {
    if (screen === SCR.PLAYING || screen === SCR.PAUSED) { togglePause(); e.preventDefault(); }
  } else if (k === 'm') {
    muted = !muted;
    Sound.setMuted(muted);
  } else if (k === 'r' || k === ' ') {
    if (screen === SCR.PLAYING) { startReload(); e.preventDefault(); }
  }
});

// ============================================================
// Update
// ============================================================
function update(dt) {
  time += dt;
  for (const c of clouds) {
    c.x -= c.v * dt;
    if (c.x < -120) c.x = W + 120;
  }
  shotFlash = Math.max(0, shotFlash - dt);
  meatFlash = Math.max(0, meatFlash - dt);
  shake = Math.max(0, shake - shake * 7 * dt - 2 * dt);
  if (banner) { banner.timer -= dt; if (banner.timer <= 0) banner = null; }
  if (bubble) { bubble.timer -= dt; if (bubble.timer <= 0) bubble = null; }
  updateParticles(dt);
  updatePopups(dt);
  updateCorpses(dt);
  updateMounds(dt);
  updateClods(dt);
  koalaCover = Math.max(0, koalaCover - dt);
  digBubbleCool = Math.max(0, digBubbleCool - dt);
  missBubbleCool = Math.max(0, missBubbleCool - dt);
  lowGardenCool = Math.max(0, lowGardenCool - dt);

  if (screen === SCR.PLAYING) {
    updateWave(dt);
    updateTurkeys(dt);
    updateBazza(dt);
    updatePowerups(dt);
    comboT -= dt;
    if (comboT <= 0) comboCount = 0;
    if (reloading) {
      reloadT -= dt;
      if (reloadT <= 0) { reloading = false; shells = MAG; }
    }
    // garden damage from diggers
    let diggers = 0;
    for (const t of turkeys) if (t.state === 'dig' && t.spawnAnim <= 0) diggers++;
    if (diggers > 0) {
      health -= 3 * diggers * dt;
      if (health < 25 && lowGardenCool <= 0) {
        say(pick(LINES.lowGarden));
        lowGardenCool = 10;
      }
      if (health <= 0) {
        health = 0;
        doGameOver();
      }
    }
    prevHealth = health;
    // ambient kookaburra
    kookTimer -= dt;
    if (kookTimer <= 0) {
      Sound.kookaburra();
      kookTimer = rand(16, 26);
    }
  } else if (screen === SCR.TITLE) {
    // strutting turkey across the title screen
    titleTurkey.time += dt;
    titleTurkey.x += 55 * dt;
    titleTurkey.walk += dt * 5;
    if (titleTurkey.x > W + 140) {
      titleTurkey.x = -140;
      titleTurkey.y = rand(630, 675);
    }
    titleTurkey.face = 1;
  }
}

// ============================================================
// Render
// ============================================================
function render() {
  const shx = (Math.random() * 2 - 1) * shake;
  const shy = (Math.random() * 2 - 1) * shake;
  ctx.save();
  ctx.translate(shx, shy);
  drawWorld(ctx);
  ctx.restore();

  // crosshair above world (before HUD, under overlays)
  if (screen !== SCR.PAUSED) {
    drawCrosshair(ctx);
  }

  drawHUD(ctx);
  drawBanner(ctx);
  drawBubble(ctx);
  drawMeatFlash(ctx);
  ctx.drawImage(vignette, 0, 0);

  if (screen === SCR.TITLE) drawTitle(ctx);
  else if (screen === SCR.PAUSED) drawPaused(ctx);
  else if (screen === SCR.GAMEOVER) drawGameOver(ctx);
}

// ============================================================
// Main loop (delta-time, hit-stop freeze)
// ============================================================
let last = performance.now();
function frame(now) {
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (hitStop > 0) {
    hitStop -= dt;
    dt = 0;
  }
  if (screen !== SCR.PAUSED) update(dt);
  else time += 0; // frozen
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ============================================================
// Test hooks
// ============================================================
window.__TURKEY_TEST__ = {
  getTurkeys: () => turkeys.map(t => ({ x: Math.round(t.x), y: Math.round(t.y), z: Math.round(t.z || 0), state: t.state })),
  getScore: () => score,
  getHealth: () => health,
  getAmmo: () => shells,
  getWave: () => wave.num,
  isReloading: () => reloading,
  hasBoss: () => !!bazza,
  screen: () => screen,
  startGame,
  reload: startReload,
  forceWave: (n) => { turkeys = []; if (bazza) { bazza = null; } startWave(Math.max(1, n | 0)); },
  spawnPowerupDebug: (kind) => { powerups.push({ x: W / 2, y: 600, kind: (kind === 'snag' || kind === 'gnome') ? kind : 'tray', time: 0 }); },
  damage: (n) => {
    health = Math.max(0, health - (n || 0));
    if (health <= 0) doGameOver();
  },
};

})();
