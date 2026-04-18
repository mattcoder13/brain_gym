/* ============================================================
   BRAIN GYM — app.js
   4 drills: focus lock, speed read, go/no-go, sequence memory
   ============================================================ */

// ── STATE ─────────────────────────────────────────────────
const KEY = 'braingym_v1';
const THEME_KEY = 'braingym_theme';

// sessions: [{ date, scores: {focus, speed, gonogo, memory}, completed }]
let sessions = [];
let currentSession = null; // { drillIndex, startedAt, scores }

// ── HELPERS ───────────────────────────────────────────────
function todayStr() { const d = new Date(); return dateStr(d); }
function dateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
function pad(n) { return String(n).padStart(2,'0'); }
function dayName(d) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]; }
function fullDayName(d) { return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]; }
function monthName(d) { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]; }

function haptic(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e) {} }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ sessions })); } catch(e) {}
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      sessions = p.sessions || [];
    }
  } catch(e) {}
}

// ── QUOTES ────────────────────────────────────────────────
const QUOTES = [
  "Attention is the rarest and purest form of generosity.",
  "The successful warrior is the average man, with laser-like focus.",
  "Where attention goes, energy flows.",
  "Concentrate all your thoughts upon the work at hand.",
  "The mind is everything. What you think you become.",
  "Small daily improvements are the key to staggering long-term results.",
  "Practice isn't the thing you do once you're good. It's the thing that makes you good.",
  "The only way to develop speed is to practice it.",
  "Mastery is the result of thousands of moments of deliberate practice.",
  "You don't rise to the level of your goals, you fall to the level of your training.",
  "Sharpen the saw.",
  "Repetition is the mother of skill.",
  "Slow is smooth, smooth is fast.",
  "Progress happens one rep at a time."
];
function pickQuote() {
  const d = new Date();
  const seed = d.getFullYear() * 1000 + d.getMonth() * 50 + d.getDate();
  return QUOTES[seed % QUOTES.length];
}

// ── THEME ─────────────────────────────────────────────────
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch(e) {}
  const meta = document.getElementById('theme-meta');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f4ee' : '#6b8cc4');
  const dBtn = document.getElementById('theme-dark');
  const lBtn = document.getElementById('theme-light');
  if (dBtn) dBtn.classList.toggle('active', theme === 'dark');
  if (lBtn) lBtn.classList.toggle('active', theme === 'light');
  haptic(8);
}
function initTheme() {
  const t = (function() {
    try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch(e) { return 'dark'; }
  })();
  setTheme(t);
}

// ── MENU ──────────────────────────────────────────────────
function toggleMenu() {
  document.getElementById('menu-panel').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('menu-panel').classList.remove('open');
}
document.addEventListener('click', (e) => {
  const panel = document.getElementById('menu-panel');
  const btn = document.getElementById('menu-btn');
  if (!panel.classList.contains('open')) return;
  if (!panel.contains(e.target) && !btn.contains(e.target)) closeMenu();
});

// ── IMPORT / EXPORT ───────────────────────────────────────
function exportData() {
  closeMenu();
  const data = { version: 1, exportedAt: new Date().toISOString(), sessions };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'brain-gym-backup-' + todayStr() + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded');
}

function importData(input) {
  closeMenu();
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.sessions)) { toast('Invalid backup'); return; }
      sessions = parsed.sessions;
      save(); renderHome();
      toast('Backup restored');
    } catch(e) { toast('Could not read file'); }
    input.value = '';
  };
  reader.onerror = () => { toast('Could not read'); input.value = ''; };
  reader.readAsText(file);
}

// ── TOAST ─────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}

// ── STATS COMPUTATION ─────────────────────────────────────
function getStreak() {
  if (!sessions.length) return 0;
  const done = new Set(sessions.filter(s => s.completed).map(s => s.date));
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  if (!done.has(todayStr())) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    if (done.has(dateStr(d))) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function getBestScore(drill) {
  const vals = sessions.filter(s => s.completed && s.scores && s.scores[drill] != null).map(s => s.scores[drill]);
  if (!vals.length) return null;
  // All drills: higher is better EXCEPT gonogo-rt (reaction time, lower is better)
  // We store composite scores where higher = better
  return Math.max(...vals);
}

function getLastSession() {
  return sessions.filter(s => s.completed).slice(-1)[0] || null;
}

function todayCompleted() {
  return sessions.some(s => s.date === todayStr() && s.completed);
}

// ── RENDER HOME ───────────────────────────────────────────
function renderDate() {
  const d = new Date();
  document.getElementById('date-line').textContent =
    fullDayName(d) + ', ' + monthName(d) + ' ' + d.getDate() + ' ' + d.getFullYear();
}

function renderQuote() {
  const el = document.getElementById('quote-line');
  if (el) el.textContent = '"' + pickQuote() + '"';
}

function renderHome() {
  renderDate();
  renderQuote();

  const completed = sessions.filter(s => s.completed);
  document.getElementById('stat-streak').textContent = getStreak();
  document.getElementById('stat-sessions').textContent = completed.length;
  document.getElementById('stat-today').textContent = todayCompleted() ? '✓' : '—';
  // Overall best = sum of all 4 drill scores from best session
  let best = 0;
  completed.forEach(s => {
    const sum = (s.scores.focus || 0) + (s.scores.speed || 0) + (s.scores.gonogo || 0) + (s.scores.memory || 0);
    if (sum > best) best = sum;
  });
  document.getElementById('stat-best').textContent = best || 0;

  // History chart — last 7 days
  const chart = document.getElementById('history-chart');
  const todayS = todayStr();
  let html = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
    const s = dateStr(d);
    const session = sessions.find(ss => ss.date === s && ss.completed);
    const sum = session ? (session.scores.focus || 0) + (session.scores.speed || 0) + (session.scores.gonogo || 0) + (session.scores.memory || 0) : 0;
    const maxSum = 400; // target max across drills
    const h = sum > 0 ? Math.max(6, Math.min(100, (sum / maxSum) * 100)) : 4;
    const cls = s === todayS && session ? 'today' : (session ? 'done' : '');
    html += '<div class="hist-col">'
          + '<div class="hist-bar ' + cls + '" style="height:' + h + '%"></div>'
          + '<div class="hist-label">' + dayName(d)[0] + '</div>'
          + '</div>';
  }
  chart.innerHTML = html;

  // Bests grid
  const bests = document.getElementById('bests-grid');
  const bFocus = getBestScore('focus');
  const bSpeed = getBestScore('speed');
  const bGng = getBestScore('gonogo');
  const bMem = getBestMemoryLevel();
  bests.innerHTML =
    '<div class="best-card"><div class="best-label">Focus</div><div class="best-value">' + (bFocus || 0) + '<span class="best-unit">pts</span></div></div>' +
    '<div class="best-card"><div class="best-label">Speed read</div><div class="best-value">' + (bSpeed || 0) + '<span class="best-unit">pts</span></div></div>' +
    '<div class="best-card"><div class="best-label">Go / No-Go</div><div class="best-value">' + (bGng || 0) + '<span class="best-unit">pts</span></div></div>' +
    '<div class="best-card"><div class="best-label">Sequence</div><div class="best-value">' + (bMem || 0) + '<span class="best-unit">digits</span></div></div>';
}

function getBestMemoryLevel() {
  // Memory score stores max level reached (e.g. 7 digits)
  let best = 0;
  sessions.forEach(s => {
    if (s.completed && s.meta && s.meta.memoryLevel) {
      if (s.meta.memoryLevel > best) best = s.meta.memoryLevel;
    }
  });
  return best;
}

// ═════════════════════════════════════════════════════════════
// SESSION FLOW
// ═════════════════════════════════════════════════════════════
const DRILLS = ['focus', 'speed', 'gonogo', 'memory'];
const DRILL_NAMES = {
  focus: 'Focus lock',
  speed: 'Speed read',
  gonogo: 'Go / No-Go',
  memory: 'Sequence'
};
const DRILL_DESCS = {
  focus: 'Keep your finger on the moving dot for 90 seconds. Don\'t let it escape. Don\'t drift off.',
  speed: 'A sentence flashes, then disappears. Answer a question about it. Gets faster.',
  gonogo: 'Tap when you see green. Don\'t tap on red. Speed matters, but accuracy matters more.',
  memory: 'Remember the digits, type them back. Each round adds one digit.'
};
const DRILL_RULES = {
  focus: ['Finger on dot at all times', 'Dot moves — follow it', 'Score = % time locked on'],
  speed: ['Read in the window shown', 'Answer after it disappears', 'Faster reads = more points'],
  gonogo: ['Green circle → TAP', 'Red circle → DO NOT TAP', 'React in under 500ms'],
  memory: ['Watch the digits appear', 'Type them in order', 'Wrong = session ends']
};

function startSession() {
  currentSession = {
    date: todayStr(),
    startedAt: Date.now(),
    drillIndex: 0,
    scores: { focus: 0, speed: 0, gonogo: 0, memory: 0 },
    meta: {}
  };
  showScreen('drill');
  loadDrill();
}

function loadDrill() {
  const drill = DRILLS[currentSession.drillIndex];
  document.getElementById('drill-progress').textContent = (currentSession.drillIndex + 1) + ' / 4';
  document.getElementById('drill-timer').textContent = '—';
  showDrillIntro(drill);
}

function showDrillIntro(drill) {
  const stage = document.getElementById('drill-stage');
  const rules = DRILL_RULES[drill].map(r => '<div class="drill-intro-rule">· ' + r + '</div>').join('');
  stage.innerHTML =
    '<div class="drill-intro">' +
      '<div class="drill-intro-title">' + DRILL_NAMES[drill] + '</div>' +
      '<div class="drill-intro-desc">' + DRILL_DESCS[drill] + '</div>' +
      rules +
      '<button class="drill-start-btn" id="start-drill-btn">Begin</button>' +
    '</div>';
  document.getElementById('start-drill-btn').onclick = () => runCountdown(drill);
}

function runCountdown(drill) {
  const stage = document.getElementById('drill-stage');
  let n = 3;
  const tick = () => {
    if (n <= 0) { startDrill(drill); return; }
    stage.innerHTML = '<div class="countdown">' + n + '</div>';
    haptic(15);
    n--;
    setTimeout(tick, 800);
  };
  tick();
}

function startDrill(drill) {
  if (drill === 'focus') startFocusDrill();
  else if (drill === 'speed') startSpeedDrill();
  else if (drill === 'gonogo') startGoNoGoDrill();
  else if (drill === 'memory') startMemoryDrill();
}

function finishDrill(score, meta) {
  const drill = DRILLS[currentSession.drillIndex];
  currentSession.scores[drill] = Math.round(score);
  if (meta) currentSession.meta = { ...currentSession.meta, ...meta };
  currentSession.drillIndex++;
  if (currentSession.drillIndex >= DRILLS.length) {
    // Done!
    currentSession.completed = true;
    sessions.push({
      date: currentSession.date,
      completed: true,
      scores: currentSession.scores,
      meta: currentSession.meta,
      ts: Date.now()
    });
    save();
    showResults();
  } else {
    loadDrill();
  }
}

function quitDrill() {
  if (!confirm('Quit this session? Progress will be lost.')) return;
  currentSession = null;
  goHome();
}

function goHome() {
  currentSession = null;
  showScreen('home');
  renderHome();
}

function showScreen(name) {
  document.getElementById('screen-home').style.display = name === 'home' ? 'block' : 'none';
  document.getElementById('screen-drill').style.display = name === 'drill' ? 'block' : 'none';
  document.getElementById('screen-results').style.display = name === 'results' ? 'block' : 'none';
  document.getElementById('header').style.display = name === 'home' ? 'block' : 'none';
}

// ═════════════════════════════════════════════════════════════
// DRILL 1: FOCUS LOCK
// ═════════════════════════════════════════════════════════════
let focusState = null;

function startFocusDrill() {
  const stage = document.getElementById('drill-stage');
  stage.innerHTML =
    '<div class="focus-canvas" id="focus-canvas">' +
      '<div class="focus-target" id="focus-target"></div>' +
    '</div>' +
    '<div class="focus-instr">Keep finger on the dot</div>' +
    '<div class="focus-score" id="focus-score">Lock: 0%</div>';

  const canvas = document.getElementById('focus-canvas');
  const target = document.getElementById('focus-target');
  const scoreEl = document.getElementById('focus-score');
  const timerEl = document.getElementById('drill-timer');

  const duration = 90; // seconds
  const rect = () => canvas.getBoundingClientRect();

  // Target position
  let tx = 0.5, ty = 0.5; // normalized
  let vx = 0.003, vy = 0.002; // velocity
  let holding = false;
  let lockedMs = 0;
  let totalMs = 0;
  let lastTs = null;
  let running = true;

  // Random direction changes
  const randomize = () => {
    const speed = 0.002 + Math.random() * 0.004;
    const angle = Math.random() * Math.PI * 2;
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
  };
  let redirTimer = setInterval(randomize, 2500 + Math.random() * 2000);

  const positionTarget = () => {
    const r = rect();
    target.style.left = (tx * r.width) + 'px';
    target.style.top = (ty * r.height) + 'px';
  };
  positionTarget();

  const onDown = (e) => {
    e.preventDefault();
    holding = true;
    target.classList.add('holding');
    target.classList.remove('lost');
  };
  const onUp = () => {
    holding = false;
    target.classList.remove('holding');
  };
  const onMove = (e) => {
    if (!holding) return;
    const touch = e.touches ? e.touches[0] : e;
    const r = rect();
    const px = (touch.clientX - r.left) / r.width;
    const py = (touch.clientY - r.top) / r.height;
    const dx = px - tx;
    const dy = py - ty;
    const dist = Math.sqrt(dx*dx + dy*dy);
    // If finger strays too far from target (more than ~8% of canvas), lose lock
    if (dist > 0.12) {
      holding = false;
      target.classList.remove('holding');
      target.classList.add('lost');
      haptic(30);
      setTimeout(() => target.classList.remove('lost'), 200);
    }
  };

  target.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onUp);
  canvas.addEventListener('touchcancel', onUp);
  target.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', onUp);

  const step = (ts) => {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(50, ts - lastTs);
    lastTs = ts;
    totalMs += dt;
    if (holding) lockedMs += dt;

    // Move target
    tx += vx * (dt / 16);
    ty += vy * (dt / 16);
    // Bounce off walls
    if (tx < 0.08) { tx = 0.08; vx = Math.abs(vx); }
    if (tx > 0.92) { tx = 0.92; vx = -Math.abs(vx); }
    if (ty < 0.08) { ty = 0.08; vy = Math.abs(vy); }
    if (ty > 0.92) { ty = 0.92; vy = -Math.abs(vy); }
    positionTarget();

    const pct = totalMs > 0 ? Math.round((lockedMs / totalMs) * 100) : 0;
    scoreEl.textContent = 'Lock: ' + pct + '%';

    const remaining = Math.max(0, duration - totalMs / 1000);
    timerEl.textContent = Math.ceil(remaining) + 's';

    if (totalMs >= duration * 1000) {
      running = false;
      clearInterval(redirTimer);
      // Score: lock percentage * 2 (200 max)
      const score = Math.round((lockedMs / totalMs) * 200);
      setTimeout(() => finishDrill(score, { focusLockPct: pct }), 500);
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);

  focusState = { running, redirTimer };
}

// ═════════════════════════════════════════════════════════════
// DRILL 2: SPEED READ
// ═════════════════════════════════════════════════════════════
const SPEED_ITEMS = [
  { text: "The old lighthouse had stood on the cliff for three centuries.", q: "How long had the lighthouse stood?", opts: ["One century", "Two centuries", "Three centuries", "Four centuries"], correct: 2 },
  { text: "Sarah bought seven red apples and four green pears at the market.", q: "How many green pears did Sarah buy?", opts: ["Three", "Four", "Seven", "Eleven"], correct: 1 },
  { text: "The train from Berlin arrived twelve minutes late on platform nine.", q: "Which platform did the train arrive at?", opts: ["Seven", "Nine", "Twelve", "Eleven"], correct: 1 },
  { text: "Marcus left the cafe at half past four wearing a navy blue jacket.", q: "What color was his jacket?", opts: ["Black", "Navy blue", "Gray", "Dark green"], correct: 1 },
  { text: "The library closes early on Tuesdays and stays open late on Thursdays.", q: "When does the library close early?", opts: ["Mondays", "Tuesdays", "Wednesdays", "Thursdays"], correct: 1 },
  { text: "Elena painted the door a soft yellow after repairing the broken hinges.", q: "What did Elena do first?", opts: ["Painted the door", "Bought new hinges", "Repaired the hinges", "Cleaned the door"], correct: 2 },
  { text: "The recipe called for two cups of flour and three tablespoons of honey.", q: "How much honey was needed?", opts: ["Two cups", "Three cups", "Two tablespoons", "Three tablespoons"], correct: 3 },
  { text: "Jake's flight was delayed by forty minutes because of heavy fog in Dublin.", q: "Why was the flight delayed?", opts: ["Mechanical issue", "Heavy rain", "Heavy fog", "A strike"], correct: 2 },
  { text: "The mountain cabin had a stone fireplace and two small wooden bedrooms.", q: "How many bedrooms did the cabin have?", opts: ["One", "Two", "Three", "Four"], correct: 1 },
  { text: "Nora ordered a cappuccino, a croissant, and a slice of lemon cake.", q: "What did Nora NOT order?", opts: ["Cappuccino", "Croissant", "Muffin", "Lemon cake"], correct: 2 },
  { text: "The old bookshop on Clover Street sold rare maps and antique globes.", q: "What street was the bookshop on?", opts: ["Maple", "Clover", "Oak", "Pine"], correct: 1 },
  { text: "After the hike, they drank cold water and shared six granola bars.", q: "How many granola bars did they share?", opts: ["Four", "Five", "Six", "Seven"], correct: 2 }
];

let speedState = null;

function startSpeedDrill() {
  // Shuffle 6 items
  const items = [...SPEED_ITEMS].sort(() => Math.random() - 0.5).slice(0, 6);
  speedState = {
    items,
    index: 0,
    correct: 0,
    totalTime: 0,
    // Display duration ramps down over rounds
    displayMs: 2800
  };
  runSpeedRound();
}

function runSpeedRound() {
  const s = speedState;
  if (s.index >= s.items.length) {
    // Score: 30 per correct + speed bonus (up to 20 per item based on remaining display time)
    const base = s.correct * 30;
    const score = Math.min(200, base);
    finishDrill(score, { speedCorrect: s.correct, speedTotal: s.items.length });
    return;
  }

  const item = s.items[s.index];
  const stage = document.getElementById('drill-stage');
  const timerEl = document.getElementById('drill-timer');

  // Display sentence
  stage.innerHTML =
    '<div class="speed-stage">' +
      '<div class="speed-progress-text">' + (s.index + 1) + ' of ' + s.items.length + '</div>' +
      '<div class="speed-text" id="speed-text">' + item.text + '</div>' +
    '</div>';

  timerEl.textContent = 'Read';
  const readStart = Date.now();

  setTimeout(() => {
    // Hide and ask question
    const elapsed = Date.now() - readStart;
    s.totalTime += elapsed;
    timerEl.textContent = 'Answer';

    const optsHtml = item.opts.map((o, i) =>
      '<button class="speed-opt" data-idx="' + i + '">' + o + '</button>'
    ).join('');

    stage.innerHTML =
      '<div class="speed-stage">' +
        '<div class="speed-progress-text">' + (s.index + 1) + ' of ' + s.items.length + '</div>' +
        '<div class="speed-question">' + item.q + '</div>' +
        '<div class="speed-options">' + optsHtml + '</div>' +
      '</div>';

    stage.querySelectorAll('.speed-opt').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const isCorrect = idx === item.correct;
        if (isCorrect) {
          s.correct++;
          btn.classList.add('correct');
          haptic(15);
        } else {
          btn.classList.add('wrong');
          // Also highlight the correct one
          stage.querySelectorAll('.speed-opt')[item.correct].classList.add('correct');
          haptic([30, 40, 30]);
        }
        stage.querySelectorAll('.speed-opt').forEach(b => b.onclick = null);
        setTimeout(() => {
          s.index++;
          s.displayMs = Math.max(1500, s.displayMs - 150); // get faster
          runSpeedRound();
        }, 900);
      };
    });
  }, s.displayMs);
}

// ═════════════════════════════════════════════════════════════
// DRILL 3: GO / NO-GO
// ═════════════════════════════════════════════════════════════
let gngState = null;

function startGoNoGoDrill() {
  gngState = {
    duration: 90000, // 90s
    startedAt: Date.now(),
    hits: 0,
    misses: 0,
    falseAlarms: 0,
    correctRejects: 0,
    rts: [], // reaction times for hits
    current: null,
    shownAt: 0,
    waiting: false,
    running: true,
    nextTimer: null,
    hideTimer: null
  };

  const stage = document.getElementById('drill-stage');
  stage.innerHTML =
    '<div class="gng-stage">' +
      '<div class="gng-zone" id="gng-zone"></div>' +
      '<div class="gng-feedback" id="gng-feedback">&nbsp;</div>' +
      '<div class="gng-score">' +
        '<div>Hits <span class="gng-score-val" id="gng-hits">0</span></div>' +
        '<div>Miss <span class="gng-score-val" id="gng-miss">0</span></div>' +
        '<div>FA <span class="gng-score-val" id="gng-fa">0</span></div>' +
      '</div>' +
    '</div>';

  const zone = document.getElementById('gng-zone');
  zone.addEventListener('click', gngTap);
  zone.addEventListener('touchstart', (e) => { e.preventDefault(); gngTap(); }, { passive: false });

  scheduleNextGng();
  updateGngTimer();
}

function updateGngTimer() {
  if (!gngState || !gngState.running) return;
  const elapsed = Date.now() - gngState.startedAt;
  const remaining = Math.max(0, gngState.duration - elapsed);
  document.getElementById('drill-timer').textContent = Math.ceil(remaining / 1000) + 's';
  if (elapsed >= gngState.duration) {
    endGng();
    return;
  }
  setTimeout(updateGngTimer, 100);
}

function scheduleNextGng() {
  if (!gngState.running) return;
  // Random interval between shapes: 800-1800ms
  const delay = 800 + Math.random() * 1000;
  gngState.nextTimer = setTimeout(showGngShape, delay);
}

function showGngShape() {
  if (!gngState.running) return;
  const isGo = Math.random() < 0.7; // 70% go, 30% nogo
  gngState.current = isGo ? 'go' : 'nogo';
  gngState.shownAt = Date.now();
  gngState.waiting = true;

  const zone = document.getElementById('gng-zone');
  zone.innerHTML = '<div class="gng-shape ' + gngState.current + '"></div>';

  // Auto-hide after 800ms
  gngState.hideTimer = setTimeout(() => {
    if (!gngState.waiting) return;
    // Timeout - counted as miss if go, correct reject if nogo
    if (gngState.current === 'go') {
      gngState.misses++;
      flashFeedback('Missed', 'miss');
    } else {
      gngState.correctRejects++;
      // silent correct reject
    }
    gngState.waiting = false;
    gngState.current = null;
    document.getElementById('gng-zone').innerHTML = '';
    updateGngScores();
    scheduleNextGng();
  }, 800);
}

function gngTap() {
  if (!gngState || !gngState.running) return;
  if (!gngState.waiting) {
    // Tap with nothing showing — count as false alarm
    gngState.falseAlarms++;
    flashFeedback('Too early', 'miss');
    haptic(25);
    updateGngScores();
    return;
  }
  clearTimeout(gngState.hideTimer);
  const rt = Date.now() - gngState.shownAt;
  if (gngState.current === 'go') {
    gngState.hits++;
    gngState.rts.push(rt);
    flashFeedback(rt + 'ms', 'hit');
    haptic(12);
  } else {
    gngState.falseAlarms++;
    flashFeedback('No-Go!', 'miss');
    haptic([25, 40, 25]);
  }
  gngState.waiting = false;
  gngState.current = null;
  document.getElementById('gng-zone').innerHTML = '';
  updateGngScores();
  scheduleNextGng();
}

function flashFeedback(text, cls) {
  const el = document.getElementById('gng-feedback');
  el.textContent = text;
  el.className = 'gng-feedback ' + cls;
  setTimeout(() => {
    if (el.textContent === text) { el.textContent = '\u00A0'; el.className = 'gng-feedback'; }
  }, 500);
}

function updateGngScores() {
  document.getElementById('gng-hits').textContent = gngState.hits;
  document.getElementById('gng-miss').textContent = gngState.misses;
  document.getElementById('gng-fa').textContent = gngState.falseAlarms;
}

function endGng() {
  gngState.running = false;
  clearTimeout(gngState.nextTimer);
  clearTimeout(gngState.hideTimer);
  const { hits, misses, falseAlarms, rts } = gngState;
  const avgRt = rts.length ? Math.round(rts.reduce((a,b)=>a+b,0) / rts.length) : 800;
  const totalTrials = hits + misses + falseAlarms;
  const accuracy = totalTrials ? hits / (hits + misses + falseAlarms) : 0;
  // Score formula: accuracy * 150 + speed bonus (max 50 if avg RT <= 300ms)
  const speedBonus = Math.max(0, Math.min(50, Math.round((600 - avgRt) / 6)));
  const score = Math.round(accuracy * 150 + speedBonus);
  setTimeout(() => finishDrill(score, { gngHits: hits, gngMisses: misses, gngFA: falseAlarms, gngAvgRt: avgRt }), 400);
}

// ═════════════════════════════════════════════════════════════
// DRILL 4: SEQUENCE MEMORY
// ═════════════════════════════════════════════════════════════
let memState = null;

function startMemoryDrill() {
  memState = {
    level: 3, // start with 3 digits
    maxReached: 0,
    totalDuration: 120000, // 2 min max
    startedAt: Date.now(),
    sequence: '',
    input: '',
    phase: 'show' // 'show' | 'input'
  };
  runMemoryRound();
  updateMemTimer();
}

function updateMemTimer() {
  if (!memState) return;
  const elapsed = Date.now() - memState.startedAt;
  const remaining = Math.max(0, memState.totalDuration - elapsed);
  document.getElementById('drill-timer').textContent = Math.ceil(remaining / 1000) + 's';
  if (elapsed >= memState.totalDuration) { endMemory(); return; }
  setTimeout(updateMemTimer, 200);
}

function runMemoryRound() {
  if (!memState) return;
  // Generate sequence
  let seq = '';
  for (let i = 0; i < memState.level; i++) seq += Math.floor(Math.random() * 10);
  memState.sequence = seq;
  memState.input = '';
  memState.phase = 'show';

  const stage = document.getElementById('drill-stage');
  stage.innerHTML =
    '<div class="seq-stage">' +
      '<div class="seq-level">Level ' + memState.level + ' — ' + memState.level + ' digits</div>' +
      '<div class="seq-prompt">Memorize</div>' +
      '<div class="seq-display" id="seq-display"></div>' +
    '</div>';

  // Show digits one by one
  const display = document.getElementById('seq-display');
  let i = 0;
  const interval = Math.max(400, 800 - memState.level * 30);
  const showNext = () => {
    if (!memState || memState.phase !== 'show') return;
    if (i >= seq.length) {
      display.textContent = '';
      setTimeout(() => showMemoryInput(), 300);
      return;
    }
    display.textContent = seq[i];
    haptic(8);
    i++;
    setTimeout(() => {
      if (!memState || memState.phase !== 'show') return;
      display.textContent = '';
      setTimeout(showNext, 150);
    }, interval);
  };
  setTimeout(showNext, 400);
}

function showMemoryInput() {
  if (!memState) return;
  memState.phase = 'input';
  const stage = document.getElementById('drill-stage');
  stage.innerHTML =
    '<div class="seq-stage">' +
      '<div class="seq-level">Level ' + memState.level + '</div>' +
      '<div class="seq-prompt">Type the sequence</div>' +
      '<div class="seq-input-display" id="seq-input"></div>' +
      '<div class="seq-keypad" id="seq-keypad">' +
        '<button class="seq-key" data-k="1">1</button>' +
        '<button class="seq-key" data-k="2">2</button>' +
        '<button class="seq-key" data-k="3">3</button>' +
        '<button class="seq-key" data-k="4">4</button>' +
        '<button class="seq-key" data-k="5">5</button>' +
        '<button class="seq-key" data-k="6">6</button>' +
        '<button class="seq-key" data-k="7">7</button>' +
        '<button class="seq-key" data-k="8">8</button>' +
        '<button class="seq-key" data-k="9">9</button>' +
        '<button class="seq-key enter" data-k="enter">Enter</button>' +
        '<button class="seq-key zero" data-k="0">0</button>' +
        '<button class="seq-key back" data-k="back">⌫</button>' +
      '</div>' +
    '</div>';

  document.querySelectorAll('.seq-key').forEach(btn => {
    btn.onclick = () => {
      const k = btn.getAttribute('data-k');
      handleMemKey(k);
    };
  });
}

function handleMemKey(k) {
  if (!memState || memState.phase !== 'input') return;
  if (k === 'back') {
    memState.input = memState.input.slice(0, -1);
  } else if (k === 'enter') {
    submitMemInput();
    return;
  } else {
    if (memState.input.length >= memState.sequence.length) return;
    memState.input += k;
    haptic(6);
    // Auto-submit when full
    if (memState.input.length === memState.sequence.length) {
      setTimeout(submitMemInput, 300);
    }
  }
  const el = document.getElementById('seq-input');
  if (el) el.textContent = memState.input || '\u00A0';
}

function submitMemInput() {
  if (!memState) return;
  const correct = memState.input === memState.sequence;
  memState.phase = 'done';
  if (correct) {
    memState.maxReached = memState.level;
    haptic(15);
    memState.level++;
    if (memState.level > 12) { endMemory(); return; }
    // quick confirmation
    const stage = document.getElementById('drill-stage');
    stage.innerHTML = '<div class="seq-stage"><div class="seq-level">Correct</div><div class="seq-display" style="color:var(--green)">✓</div><div class="seq-level">Next level: ' + memState.level + '</div></div>';
    setTimeout(runMemoryRound, 900);
  } else {
    haptic([30, 40, 30]);
    const stage = document.getElementById('drill-stage');
    stage.innerHTML = '<div class="seq-stage">' +
      '<div class="seq-level">Expected</div>' +
      '<div class="seq-display" style="font-size:44px;color:var(--accent)">' + memState.sequence + '</div>' +
      '<div class="seq-level" style="color:var(--red)">Your answer: ' + (memState.input || '—') + '</div>' +
    '</div>';
    setTimeout(endMemory, 1800);
  }
}

function endMemory() {
  if (!memState) return;
  const level = memState.maxReached;
  memState = null;
  // Score: (level - 2) * 25 — so level 3 = 25, level 7 = 125, level 10 = 200
  const score = Math.max(0, (level - 2) * 25);
  finishDrill(score, { memoryLevel: level });
}

// ═════════════════════════════════════════════════════════════
// RESULTS SCREEN
// ═════════════════════════════════════════════════════════════
function showResults() {
  showScreen('results');
  const s = currentSession;
  const total = s.scores.focus + s.scores.speed + s.scores.gonogo + s.scores.memory;

  // Find previous session for delta
  const prev = sessions.slice(0, -1).filter(x => x.completed).slice(-1)[0];

  const fmt = (drill, val) => {
    let label = DRILL_NAMES[drill];
    let extra = '';
    if (drill === 'focus' && s.meta.focusLockPct != null) extra = s.meta.focusLockPct + '% locked';
    if (drill === 'speed' && s.meta.speedCorrect != null) extra = s.meta.speedCorrect + '/' + s.meta.speedTotal + ' correct';
    if (drill === 'gonogo' && s.meta.gngAvgRt != null) extra = s.meta.gngAvgRt + 'ms avg';
    if (drill === 'memory' && s.meta.memoryLevel != null) extra = s.meta.memoryLevel + ' digits';

    let delta = '';
    if (prev && prev.scores[drill] != null) {
      const d = val - prev.scores[drill];
      const cls = d > 0 ? 'up' : (d < 0 ? 'down' : 'same');
      const sign = d > 0 ? '+' : '';
      delta = '<div class="result-delta ' + cls + '">' + sign + d + ' vs last session</div>';
    }

    return '<div class="result-card">' +
             '<div class="result-row">' +
               '<div><div class="result-name">' + label + '</div>' +
                    (extra ? '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + extra + '</div>' : '') +
               '</div>' +
               '<div class="result-value">' + val + '</div>' +
             '</div>' +
             delta +
           '</div>';
  };

  const body = document.getElementById('results-body');
  body.innerHTML =
    fmt('focus', s.scores.focus) +
    fmt('speed', s.scores.speed) +
    fmt('gonogo', s.scores.gonogo) +
    fmt('memory', s.scores.memory) +
    '<div class="result-card" style="background:var(--accent-dark);border-color:var(--accent-dim);margin-top:12px">' +
      '<div class="result-row">' +
        '<div class="result-name" style="color:var(--accent)">Total</div>' +
        '<div class="result-value">' + total + '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('results-sub').textContent = total + ' points · ' + (Math.round((Date.now() - s.startedAt) / 60000 * 10) / 10) + ' min';

  haptic([20, 40, 20, 40, 20]);
}

// ═════════════════════════════════════════════════════════════
// INIT
// ═════════════════════════════════════════════════════════════
initTheme();
load();
renderHome();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW failed:', e));
  });
}
