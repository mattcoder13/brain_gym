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
  const bMind = getBestScore('mindfulness');
  const bSpeed = getBestScore('speed');
  const bGng = getBestScore('gonogo');
  const bHrv = getBestScore('hrv');
  bests.innerHTML =
    '<div class="best-card"><div class="best-label">Mindfulness</div><div class="best-value">' + (bMind || 0) + '<span class="best-unit">pts</span></div></div>' +
    '<div class="best-card"><div class="best-label">Speed read</div><div class="best-value">' + (bSpeed || 0) + '<span class="best-unit">pts</span></div></div>' +
    '<div class="best-card"><div class="best-label">Go / No-Go</div><div class="best-value">' + (bGng || 0) + '<span class="best-unit">pts</span></div></div>' +
    '<div class="best-card"><div class="best-label">HRV Breathing</div><div class="best-value">' + (bHrv || 0) + '<span class="best-unit">pts</span></div></div>';
}

// (getBestMemoryLevel removed — replaced by getBestScore('hrv'))

// ═════════════════════════════════════════════════════════════
// SESSION FLOW
// ═════════════════════════════════════════════════════════════
const DRILLS = ['mindfulness', 'speed', 'gonogo', 'hrv'];
const DRILL_NAMES = {
  mindfulness: 'Mindfulness',
  speed: 'Speed read',
  gonogo: 'Go / No-Go',
  hrv: 'HRV Breathing'
};
const DRILL_DESCS = {
  mindfulness: 'Focus on the breath for 90 seconds. Each time your mind wanders, tap the screen to log it and return. Based on Mrazek et al. (2013) — proven to reduce mind-wandering and improve reading comprehension.',
  speed: 'A sentence flashes, then disappears. Answer a question about it. Based on UFOV speed-of-processing research — the most validated cognitive training paradigm.',
  gonogo: 'Tap when you see green. Don\'t tap on red. Speed matters, but accuracy matters more. Based on inhibitory control research — validated for decision-making under pressure.',
  hrv: 'Breathe at resonance frequency: 5 seconds in, 5 seconds out. Based on HRV biofeedback research (Lehrer 2020) — proven to improve performance under stress and calm the nervous system.'
};
const DRILL_RULES = {
  mindfulness: ['Watch the breath rise and fall', 'When your mind wanders — tap', 'Score = fewer interruptions over time'],
  speed: ['Read in the window shown', 'Answer after it disappears', 'Faster reads = more points'],
  gonogo: ['Green circle → TAP', 'Red circle → DO NOT TAP', 'React in under 500ms'],
  hrv: ['Inhale for 5 seconds as bar rises', 'Exhale for 5 seconds as bar falls', 'Stay in rhythm for all 10 cycles']
};

function startSession() {
  currentSession = {
    date: todayStr(),
    startedAt: Date.now(),
    drillIndex: 0,
    scores: { mindfulness: 0, speed: 0, gonogo: 0, hrv: 0 },
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
  if (drill === 'mindfulness') startMindfulnessDrill();
  else if (drill === 'speed') startSpeedDrill();
  else if (drill === 'gonogo') startGoNoGoDrill();
  else if (drill === 'hrv') startHRVDrill();
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
// DRILL 1: MINDFULNESS — based on Mrazek et al. 2013
// Tap when mind wanders; score = fewer interruptions
// ═════════════════════════════════════════════════════════════
let mindState = null;

function startMindfulnessDrill() {
  const stage = document.getElementById('drill-stage');
  const duration = 90; // seconds

  mindState = {
    startedAt: Date.now(),
    duration: duration * 1000,
    wanderCount: 0,
    running: true
  };

  stage.innerHTML =
    '<div class="mind-stage">' +
      '<div class="mind-breath-ring" id="mind-ring">' +
        '<div class="mind-breath-inner" id="mind-inner"></div>' +
        '<div class="mind-breath-label" id="mind-label">Breathe</div>' +
      '</div>' +
      '<div class="mind-instr">Focus on your breath.<br>Tap when your mind wanders.</div>' +
      '<button class="mind-wander-btn" id="mind-btn" onclick="logWander()">Mind wandered</button>' +
      '<div class="mind-count" id="mind-count">Interruptions: 0</div>' +
    '</div>';

  document.getElementById('drill-timer').textContent = duration + 's';

  // Animate the breathing ring — 4s in, 4s out
  const ring = document.getElementById('mind-ring');
  const label = document.getElementById('mind-label');
  let breathPhase = 'in';
  let breathTimer = null;

  const nextBreath = () => {
    if (!mindState || !mindState.running) return;
    if (breathPhase === 'in') {
      ring.classList.remove('exhale');
      ring.classList.add('inhale');
      label.textContent = 'Breathe in';
      breathPhase = 'out';
      breathTimer = setTimeout(nextBreath, 4000);
    } else {
      ring.classList.remove('inhale');
      ring.classList.add('exhale');
      label.textContent = 'Breathe out';
      breathPhase = 'in';
      breathTimer = setTimeout(nextBreath, 4000);
    }
  };
  nextBreath();
  mindState.breathTimer = breathTimer;

  // Countdown
  const tick = () => {
    if (!mindState || !mindState.running) return;
    const elapsed = Date.now() - mindState.startedAt;
    const remaining = Math.max(0, mindState.duration - elapsed);
    document.getElementById('drill-timer').textContent = Math.ceil(remaining / 1000) + 's';
    if (elapsed >= mindState.duration) {
      endMindfulness();
      return;
    }
    setTimeout(tick, 200);
  };
  setTimeout(tick, 200);
}

function logWander() {
  if (!mindState || !mindState.running) return;
  mindState.wanderCount++;
  document.getElementById('mind-count').textContent = 'Interruptions: ' + mindState.wanderCount;
  haptic(20);
  // Flash the button to confirm
  const btn = document.getElementById('mind-btn');
  if (btn) {
    btn.style.background = 'var(--accent)';
    btn.style.color = 'var(--bg)';
    setTimeout(() => {
      if (btn) { btn.style.background = ''; btn.style.color = ''; }
    }, 300);
  }
}

function endMindfulness() {
  if (!mindState) return;
  mindState.running = false;
  clearTimeout(mindState.breathTimer);
  const w = mindState.wanderCount;
  mindState = null;
  // Score: fewer wanders = higher score. 0 wanders = 200, 10+ = 20
  // Realistic range is 3–8 for beginners; improves to 0–2 with practice
  const score = Math.max(20, Math.round(200 - w * 18));
  finishDrill(score, { mindWanders: w });
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
  { text: "After the hike, they drank cold water and shared six granola bars.", q: "How many granola bars did they share?", opts: ["Four", "Five", "Six", "Seven"], correct: 2 },
  { text: "The surgeon operated for six hours before the patient was moved to recovery.", q: "How long did the surgery take?", opts: ["Four hours", "Five hours", "Six hours", "Eight hours"], correct: 2 },
  { text: "Lena found a silver coin dated 1847 buried beneath the old oak tree.", q: "What year was on the coin?", opts: ["1748", "1847", "1874", "1947"], correct: 1 },
  { text: "The museum opens at nine and closes at half past five on weekdays.", q: "When does the museum close on weekdays?", opts: ["Five o'clock", "Half past four", "Half past five", "Six o'clock"], correct: 2 },
  { text: "Daniel drove north for two hours then turned east toward the coast.", q: "Which direction did Daniel turn after two hours?", opts: ["North", "South", "East", "West"], correct: 2 },
  { text: "The package weighed three kilograms and was wrapped in brown paper.", q: "How much did the package weigh?", opts: ["One kilogram", "Two kilograms", "Three kilograms", "Five kilograms"], correct: 2 },
  { text: "Amara finished her thesis in March after eighteen months of research.", q: "How long did Amara research for?", opts: ["Six months", "Twelve months", "Eighteen months", "Two years"], correct: 2 },
  { text: "The chef added basil last, after the garlic and the olive oil.", q: "What did the chef add first?", opts: ["Basil", "Garlic", "Olive oil", "Salt"], correct: 1 },
  { text: "The hotel had forty-two rooms, a rooftop pool, and a small gym.", q: "What did the hotel have on the roof?", opts: ["A restaurant", "A bar", "A pool", "A gym"], correct: 2 },
  { text: "Victor's dog was missing for three days before being found near the river.", q: "Where was the dog found?", opts: ["In the park", "At a shelter", "Near the river", "At a neighbor's house"], correct: 2 },
  { text: "The concert started at eight and finished just before midnight.", q: "When did the concert finish?", opts: ["Ten o'clock", "Eleven o'clock", "Just before midnight", "After midnight"], correct: 2 },
  { text: "Sophie read eighty pages in one sitting before her eyes grew tired.", q: "How many pages did Sophie read?", opts: ["Forty", "Sixty", "Eighty", "One hundred"], correct: 2 },
  { text: "The red car was parked between a white van and a black motorcycle.", q: "What was on the right of the red car?", opts: ["A white van", "A black motorcycle", "A blue truck", "A yellow taxi"], correct: 1 },
  { text: "Theo left his umbrella on the train from Lyon to Paris.", q: "Where did Theo leave his umbrella?", opts: ["In a taxi", "At the station", "On the train", "At the office"], correct: 2 },
  { text: "The bakery sold out of croissants by half past seven every morning.", q: "At what time did croissants sell out?", opts: ["Seven o'clock", "Half past six", "Half past seven", "Eight o'clock"], correct: 2 },
  { text: "Clara inherited a small house, a vintage car, and a collection of stamps.", q: "What did Clara NOT inherit?", opts: ["A house", "A car", "A painting", "Stamps"], correct: 2 },
  { text: "The bridge was closed for repairs after a truck hit the central pillar.", q: "Why was the bridge closed?", opts: ["Flooding", "A fire", "A truck collision", "Scheduled maintenance"], correct: 2 },
  { text: "Paulo studied medicine for six years in Lisbon before moving to London.", q: "Where did Paulo study?", opts: ["Madrid", "Porto", "Lisbon", "London"], correct: 2 },
  { text: "The winter storm knocked out power to fourteen thousand homes overnight.", q: "How many homes lost power?", opts: ["Four thousand", "Ten thousand", "Fourteen thousand", "Forty thousand"], correct: 2 },
  { text: "Julia's cat knocked over a vase and a plant before knocking over the lamp.", q: "What did the cat knock over last?", opts: ["A vase", "A plant", "A lamp", "A picture frame"], correct: 2 },
  { text: "The temperature dropped to minus eight degrees on Thursday night.", q: "What temperature was it on Thursday night?", opts: ["Minus four", "Minus six", "Minus eight", "Minus twelve"], correct: 2 },
  { text: "The film ran for two hours and forty minutes with no intermission.", q: "How long was the film?", opts: ["Two hours", "Two hours twenty", "Two hours forty", "Three hours"], correct: 2 },
  { text: "Tom's new apartment is on the fifth floor of a building with nine floors.", q: "Which floor is Tom's apartment on?", opts: ["Third", "Fourth", "Fifth", "Ninth"], correct: 2 },
  { text: "The explorer found the cave entrance hidden behind a waterfall.", q: "Where was the cave entrance?", opts: ["Under a cliff", "Behind a waterfall", "Inside a forest", "Beneath a bridge"], correct: 1 },
  { text: "Rosa baked a cake for her mother's sixty-fifth birthday.", q: "How old was Rosa's mother turning?", opts: ["Fifty-five", "Sixty", "Sixty-five", "Seventy"], correct: 2 },
  { text: "The ferry departs at six in the morning and takes ninety minutes.", q: "How long does the ferry take?", opts: ["Forty-five minutes", "One hour", "Ninety minutes", "Two hours"], correct: 2 },
  { text: "Martin painted three rooms before running out of white paint.", q: "What color paint ran out?", opts: ["Blue", "Gray", "Beige", "White"], correct: 3 },
  { text: "The satellite orbits Earth every ninety-two minutes at low altitude.", q: "How often does the satellite orbit Earth?", opts: ["Every hour", "Every eighty minutes", "Every ninety-two minutes", "Every two hours"], correct: 2 },
  { text: "Grace ordered soup, then salad, and finished with a chocolate mousse.", q: "What did Grace eat last?", opts: ["Soup", "Salad", "Chocolate mousse", "Cheese"], correct: 2 },
  { text: "The witness saw a tall man in a green coat leave through the back door.", q: "What color was the man's coat?", opts: ["Black", "Blue", "Brown", "Green"], correct: 3 },
  { text: "The library has three floors, with the science section on the second.", q: "Where is the science section?", opts: ["Ground floor", "First floor", "Second floor", "Third floor"], correct: 2 },
  { text: "The children planted sunflowers along the south-facing garden wall.", q: "Which direction did the garden wall face?", opts: ["North", "East", "South", "West"], correct: 2 },
  { text: "Leo forgot his passport but remembered his boarding pass and wallet.", q: "What did Leo forget?", opts: ["His wallet", "His phone", "His passport", "His boarding pass"], correct: 2 },
  { text: "The new regulation takes effect on the first of March next year.", q: "When does the regulation take effect?", opts: ["First of January", "First of February", "First of March", "First of April"], correct: 2 },
  { text: "Ana swam thirty laps before breakfast every weekday morning.", q: "When did Ana swim?", opts: ["After dinner", "On weekends", "Before breakfast on weekdays", "At midday"], correct: 2 },
  { text: "The journalist interviewed four witnesses and a police officer.", q: "How many witnesses did the journalist interview?", opts: ["Two", "Three", "Four", "Five"], correct: 2 },
  { text: "The ship departed from Hamburg with a crew of twenty-three sailors.", q: "Where did the ship depart from?", opts: ["Amsterdam", "Copenhagen", "Hamburg", "Rotterdam"], correct: 2 },
  { text: "After the rain stopped, a double rainbow appeared over the valley.", q: "What appeared after the rain?", opts: ["A storm", "A fog", "A single rainbow", "A double rainbow"], correct: 3 },
  { text: "The professor assigned a five-page essay due on Friday at noon.", q: "When was the essay due?", opts: ["Thursday evening", "Friday at noon", "Friday at midnight", "Monday morning"], correct: 1 },
  { text: "Omar fixed the leaking pipe in the kitchen before the plumber arrived.", q: "Who fixed the pipe?", opts: ["The plumber", "A neighbor", "Omar", "A repairman"], correct: 2 },
  { text: "The café on the corner opens at seven and serves breakfast until eleven.", q: "Until when is breakfast served?", opts: ["Nine o'clock", "Ten o'clock", "Eleven o'clock", "Noon"], correct: 2 },
  { text: "The invoice listed three items: a desk, a chair, and a monitor stand.", q: "How many items were on the invoice?", opts: ["Two", "Three", "Four", "Five"], correct: 1 },
  { text: "Camille took a taxi to the airport and checked in two hours early.", q: "How early did Camille check in?", opts: ["One hour", "Two hours", "Three hours", "Ninety minutes"], correct: 1 },
  { text: "The tallest building in the city has eighty-seven floors and a helipad.", q: "How many floors does the tallest building have?", opts: ["Seventy-seven", "Eighty", "Eighty-seven", "Ninety"], correct: 2 },
  { text: "The boy counted fourteen red cars and nine blue cars from his window.", q: "How many blue cars did the boy count?", opts: ["Seven", "Nine", "Fourteen", "Twenty-three"], correct: 1 },
  { text: "The power went out at seven past nine and came back at a quarter to ten.", q: "When did the power come back?", opts: ["Half past nine", "A quarter to ten", "Ten o'clock", "Nine o'clock"], correct: 1 },
  { text: "Lucy sold her old bicycle for forty euros and bought a second-hand book.", q: "How much did Lucy sell her bicycle for?", opts: ["Twenty euros", "Thirty euros", "Forty euros", "Fifty euros"], correct: 2 },
  { text: "The archaeologist found pottery, coins, and a bronze dagger at the site.", q: "What metal was the dagger made of?", opts: ["Gold", "Silver", "Iron", "Bronze"], correct: 3 },
  { text: "The seminar room holds thirty people and is booked every Tuesday afternoon.", q: "When is the seminar room booked?", opts: ["Monday morning", "Tuesday afternoon", "Wednesday evening", "Thursday morning"], correct: 1 },
  { text: "Finn ran the first half of the race in twenty-two minutes exactly.", q: "How long did Finn take for the first half?", opts: ["Eighteen minutes", "Twenty minutes", "Twenty-two minutes", "Twenty-five minutes"], correct: 2 },
  { text: "The nurse gave the patient two tablets every eight hours for five days.", q: "How often were the tablets given?", opts: ["Every four hours", "Every six hours", "Every eight hours", "Every twelve hours"], correct: 2 },
  { text: "The sculpture was carved from a single block of white marble.", q: "What material was the sculpture made from?", opts: ["Granite", "Limestone", "White marble", "Sandstone"], correct: 2 },
  { text: "Ivan drove past three petrol stations before stopping at the fourth.", q: "How many petrol stations did Ivan pass?", opts: ["Two", "Three", "Four", "Five"], correct: 1 },
  { text: "The hawk circled the field twice before diving toward the long grass.", q: "How many times did the hawk circle?", opts: ["Once", "Twice", "Three times", "Four times"], correct: 1 },
  { text: "The meeting was moved from Thursday to the following Monday morning.", q: "When was the meeting rescheduled to?", opts: ["Wednesday", "Thursday", "Friday", "Monday morning"], correct: 3 },
  { text: "Hannah's dog weighs twelve kilograms and eats twice a day.", q: "How often does the dog eat?", opts: ["Once a day", "Twice a day", "Three times a day", "Every eight hours"], correct: 1 },
  { text: "The market runs every Saturday from dawn until two in the afternoon.", q: "Until what time does the market run?", opts: ["Noon", "One o'clock", "Two in the afternoon", "Three in the afternoon"], correct: 2 },
  { text: "The letter arrived six days after it was posted from a village in Wales.", q: "Where was the letter posted from?", opts: ["A town in Scotland", "A village in Ireland", "A village in Wales", "A city in England"], correct: 2 },
  { text: "Zara counted eight steps up to the front door of the old house.", q: "How many steps led to the door?", opts: ["Six", "Seven", "Eight", "Nine"], correct: 2 },
  { text: "The pilot announced the flight would be diverted to a different city.", q: "What did the pilot announce?", opts: ["A delay", "An emergency landing", "A diversion", "Early arrival"], correct: 2 },
  { text: "The technician replaced the battery and updated the software first.", q: "What did the technician do first?", opts: ["Updated the software", "Replaced the screen", "Replaced the battery", "Ran a diagnostic"], correct: 2 },
  { text: "The garden had roses along the left wall and lavender along the right.", q: "What grew along the left wall?", opts: ["Lavender", "Roses", "Jasmine", "Ivy"], correct: 1 },
  { text: "Nina won the spelling competition by correctly spelling 'phosphorescent'.", q: "What did Nina win?", opts: ["A reading contest", "A maths competition", "A spelling competition", "A debate"], correct: 2 },
  { text: "The volcano last erupted in 1963 and has been dormant ever since.", q: "When did the volcano last erupt?", opts: ["1936", "1953", "1963", "1973"], correct: 2 },
  { text: "Karl packed four shirts, two pairs of trousers, and one jacket.", q: "How many shirts did Karl pack?", opts: ["Two", "Three", "Four", "Five"], correct: 2 },
  { text: "The restaurant on the harbour has been family-owned for over sixty years.", q: "How long has the restaurant been family-owned?", opts: ["Over thirty years", "Over forty years", "Over fifty years", "Over sixty years"], correct: 3 },
  { text: "The crane lifted the steel beam to the fifteenth floor in one move.", q: "To which floor was the beam lifted?", opts: ["Tenth", "Twelfth", "Fifteenth", "Eighteenth"], correct: 2 },
  { text: "The detective found a monogrammed handkerchief under the chair.", q: "Where was the handkerchief found?", opts: ["In a drawer", "On the table", "Under the chair", "Behind the curtain"], correct: 2 },
  { text: "Isla finished her painting at midnight after working for nine hours.", q: "How long did Isla work on her painting?", opts: ["Six hours", "Seven hours", "Eight hours", "Nine hours"], correct: 3 },
  { text: "The two climbers reached the summit at sunrise on the third day.", q: "When did the climbers reach the summit?", opts: ["At noon", "At sunset", "At sunrise", "In the afternoon"], correct: 2 },
  { text: "The old mill was converted into five apartments in the early nineties.", q: "How many apartments was the mill converted into?", opts: ["Three", "Four", "Five", "Six"], correct: 2 },
  { text: "The goalkeeper saved three penalties in the final ten minutes.", q: "How many penalties did the goalkeeper save?", opts: ["Two", "Three", "Four", "Five"], correct: 1 },
  { text: "The bus broke down two stops before the central station.", q: "Where did the bus break down?", opts: ["At the central station", "One stop before the station", "Two stops before the station", "Three stops before the station"], correct: 2 },
  { text: "Ben spent three weeks in Tokyo and one week in Kyoto.", q: "How long did Ben spend in Kyoto?", opts: ["One week", "Two weeks", "Three weeks", "Four weeks"], correct: 0 },
  { text: "The scientist published her findings after seven years of research.", q: "How long did the research take?", opts: ["Three years", "Five years", "Seven years", "Ten years"], correct: 2 },
  { text: "The delivery arrived on Tuesday, a day earlier than expected.", q: "When was the delivery expected?", opts: ["Monday", "Tuesday", "Wednesday", "Thursday"], correct: 2 },
  { text: "Felix ordered a medium coffee with oat milk and no sugar.", q: "What milk did Felix use?", opts: ["Whole milk", "Skimmed milk", "Soy milk", "Oat milk"], correct: 3 },
  { text: "The old fortress had four towers, one at each corner of its walls.", q: "How many towers did the fortress have?", opts: ["Two", "Three", "Four", "Six"], correct: 2 },
  { text: "The journalist's article was printed on page three of the morning edition.", q: "On which page was the article printed?", opts: ["One", "Two", "Three", "Four"], correct: 2 },
  { text: "The river flooded after three consecutive days of heavy rainfall.", q: "After how many days of rain did the river flood?", opts: ["One", "Two", "Three", "Four"], correct: 2 },
  { text: "Amy arrived twenty minutes before the doors opened and joined a short queue.", q: "How early did Amy arrive?", opts: ["Ten minutes", "Fifteen minutes", "Twenty minutes", "Half an hour"], correct: 2 },
  { text: "The mechanic found a cracked belt and a loose bolt in the engine.", q: "What was cracked in the engine?", opts: ["A valve", "A pipe", "A belt", "A gasket"], correct: 2 },
  { text: "The conference had over eight hundred delegates from forty countries.", q: "How many countries were represented?", opts: ["Twenty", "Thirty", "Forty", "Fifty"], correct: 2 },
  { text: "Magda lost her phone on Friday but found it again on Sunday morning.", q: "When did Magda find her phone?", opts: ["Friday evening", "Saturday morning", "Sunday morning", "Monday"], correct: 2 },
  { text: "The cat slept on the windowsill for most of the rainy afternoon.", q: "Where did the cat sleep?", opts: ["On the sofa", "On the floor", "On the windowsill", "On the bed"], correct: 2 },
  { text: "The price of the ticket went up by fifteen percent in January.", q: "By how much did the price increase?", opts: ["Ten percent", "Twelve percent", "Fifteen percent", "Twenty percent"], correct: 2 },
  { text: "The surgeon trained for eleven years before her first solo operation.", q: "How long did the surgeon train?", opts: ["Seven years", "Nine years", "Eleven years", "Thirteen years"], correct: 2 },
  { text: "The village has one school, one post office, and two small shops.", q: "How many shops does the village have?", opts: ["One", "Two", "Three", "Four"], correct: 1 },
  { text: "The rope was thirty meters long and coiled in the back of the truck.", q: "How long was the rope?", opts: ["Ten meters", "Twenty meters", "Thirty meters", "Forty meters"], correct: 2 },
  { text: "Oliver left his keys in the car and had to call a locksmith.", q: "Why did Oliver call a locksmith?", opts: ["He lost his keys", "He left his keys in the car", "The lock was broken", "He forgot the code"], correct: 1 },
  { text: "The twins were born four minutes apart on a cold December morning.", q: "How far apart were the twins born?", opts: ["Two minutes", "Four minutes", "Six minutes", "Ten minutes"], correct: 1 },
  { text: "The documentary was filmed over two years in twelve different countries.", q: "How many countries was it filmed in?", opts: ["Eight", "Ten", "Twelve", "Fifteen"], correct: 2 },
  { text: "The architect designed a curved glass building with no visible columns.", q: "What was distinctive about the building's exterior?", opts: ["Its height", "Its brick walls", "Its curved glass and no visible columns", "Its golden roof"], correct: 2 },
  { text: "The train passed through a long tunnel before emerging beside a lake.", q: "What appeared after the tunnel?", opts: ["A station", "A forest", "A city", "A lake"], correct: 3 },
  { text: "Camila watered her plants every other day during the summer months.", q: "How often did Camila water her plants?", opts: ["Every day", "Every other day", "Twice a week", "Once a week"], correct: 1 },
  { text: "The storeroom contained fourteen boxes of files dating back to 1998.", q: "How far back did the files date?", opts: ["1988", "1993", "1998", "2003"], correct: 2 },
  { text: "The defendant was found not guilty after a trial lasting three weeks.", q: "How long did the trial last?", opts: ["One week", "Two weeks", "Three weeks", "Four weeks"], correct: 2 },
  { text: "The boy caught a fish, then released it back into the river.", q: "What did the boy do with the fish?", opts: ["Ate it", "Kept it", "Released it", "Sold it"], correct: 2 },
  { text: "The painting was sold at auction for two million euros.", q: "How much was the painting sold for?", opts: ["One million", "Two million", "Five million", "Ten million"], correct: 1 },
  { text: "Hugo's flight landed at gate seventeen, not the gate shown on the board.", q: "Where did Hugo's flight land?", opts: ["Gate seven", "Gate twelve", "Gate seventeen", "Gate twenty"], correct: 2 },
  { text: "The stadium holds sixty thousand spectators and was built in 2004.", q: "How many spectators does the stadium hold?", opts: ["Forty thousand", "Fifty thousand", "Sixty thousand", "Eighty thousand"], correct: 2 },
  { text: "The chemist mixed two solutions and observed a color change from blue to orange.", q: "What color did the solution turn?", opts: ["Green", "Red", "Yellow", "Orange"], correct: 3 },
  { text: "After three attempts, the lock finally opened with the second key.", q: "Which key opened the lock?", opts: ["The first", "The second", "The third", "None of them"], correct: 1 },
  { text: "The expedition team set up camp at two thousand meters above sea level.", q: "At what altitude did they camp?", opts: ["One thousand meters", "Fifteen hundred meters", "Two thousand meters", "Three thousand meters"], correct: 2 },
  { text: "Delia received a bouquet of white lilies on her graduation day.", q: "What flowers did Delia receive?", opts: ["Red roses", "Yellow tulips", "White lilies", "Pink peonies"], correct: 2 },
  { text: "The power station generates enough electricity for four hundred thousand homes.", q: "How many homes can the power station supply?", opts: ["Forty thousand", "One hundred thousand", "Two hundred thousand", "Four hundred thousand"], correct: 3 },
  { text: "The suspect left the building at ten past eleven according to CCTV footage.", q: "At what time did the suspect leave?", opts: ["Ten to eleven", "Ten past ten", "Ten past eleven", "Eleven thirty"], correct: 2 },
  { text: "The new policy requires all employees to submit reports by noon on Fridays.", q: "When must reports be submitted?", opts: ["Thursday midnight", "Friday morning", "Friday at noon", "Friday evening"], correct: 2 },
  { text: "The jar contained seventeen marbles, mostly red with three green ones.", q: "How many green marbles were there?", opts: ["Two", "Three", "Four", "Five"], correct: 1 },
  { text: "Maya found a note tucked inside the cover of the second-hand book.", q: "Where was the note found?", opts: ["Between two pages", "Under the book", "Inside the cover", "Behind a bookmark"], correct: 2 },
  { text: "The wind turbine broke down during the storm and was repaired in four days.", q: "How long did repairs take?", opts: ["Two days", "Three days", "Four days", "One week"], correct: 2 },
  { text: "The first candidate spoke for twelve minutes; the second spoke for eight.", q: "How long did the second candidate speak?", opts: ["Six minutes", "Eight minutes", "Ten minutes", "Twelve minutes"], correct: 1 },
  { text: "The rabbit disappeared into a hole beneath the third fence post.", q: "Where did the rabbit disappear?", opts: ["Under the first post", "Behind a bush", "Beneath the third post", "Through a gap in the wall"], correct: 2 },
  { text: "The exhibition runs from the fourth to the twenty-second of April.", q: "When does the exhibition end?", opts: ["The fifteenth of April", "The eighteenth of April", "The twenty-second of April", "The first of May"], correct: 2 },
  { text: "The chef's special dish contains saffron, which costs more than gold by weight.", q: "What spice does the dish contain?", opts: ["Cardamom", "Turmeric", "Saffron", "Cinnamon"], correct: 2 },
  { text: "The cyclist completed the course in two hours, eighteen minutes and forty seconds.", q: "How long did the cyclist take?", opts: ["Two hours eight minutes", "Two hours eighteen minutes", "Two hours thirty minutes", "Two hours forty minutes"], correct: 1 },
  { text: "The snowstorm buried the mountain road under two meters of snow.", q: "How deep was the snow on the road?", opts: ["Half a meter", "One meter", "Two meters", "Three meters"], correct: 2 },
  { text: "The pianist practiced for four hours, then rested for thirty minutes.", q: "How long did the pianist rest?", opts: ["Fifteen minutes", "Twenty minutes", "Thirty minutes", "One hour"], correct: 2 },
  { text: "The geologist estimated the rock formation was around four million years old.", q: "How old was the rock formation?", opts: ["Four hundred thousand years", "Four million years", "Forty million years", "Four billion years"], correct: 1 },
  { text: "Theo received three job offers in the same week and accepted the last one.", q: "Which job offer did Theo accept?", opts: ["The first", "The second", "The third", "None"], correct: 2 },
  { text: "The small boat had two oars, a life jacket, and a waterproof torch.", q: "What did the boat NOT have?", opts: ["Two oars", "A life jacket", "A torch", "A first-aid kit"], correct: 3 },
  { text: "The team won six matches in a row before losing to the second-place side.", q: "How many matches did the team win in a row?", opts: ["Four", "Five", "Six", "Seven"], correct: 2 },
  { text: "The nurse noted the patient's temperature was thirty-nine point two degrees.", q: "What was the patient's temperature?", opts: ["Thirty-seven point two", "Thirty-eight point five", "Thirty-nine point two", "Forty degrees"], correct: 2 },
  { text: "The canal runs for forty-five kilometers through four different towns.", q: "Through how many towns does the canal run?", opts: ["Two", "Three", "Four", "Five"], correct: 2 },
  { text: "Sofia found her glasses in the second drawer of her bedside table.", q: "Where were Sofia's glasses?", opts: ["On the table", "In the first drawer", "In the second drawer", "Under the bed"], correct: 2 },
  { text: "The author wrote the final chapter while staying in a small hotel in Prague.", q: "Where did the author write the final chapter?", opts: ["At home", "In a library", "In a hotel in Vienna", "In a hotel in Prague"], correct: 3 },
  { text: "The plane took off at eight and landed two hours and fifty minutes later.", q: "How long was the flight?", opts: ["Two hours", "Two hours thirty", "Two hours fifty", "Three hours"], correct: 2 },
  { text: "The witness described a woman with short grey hair carrying a red bag.", q: "What color was the bag?", opts: ["Blue", "Black", "Red", "Brown"], correct: 2 },
  { text: "The park closes one hour after sunset throughout the winter season.", q: "When does the park close in winter?", opts: ["At sunset", "One hour after sunset", "Two hours after sunset", "At midnight"], correct: 1 },
  { text: "The old photograph showed four children standing beside a tall stone wall.", q: "How many children were in the photograph?", opts: ["Three", "Four", "Five", "Six"], correct: 1 },
  { text: "The boat sailed east for six hours before anchoring near a small island.", q: "How long did the boat sail before anchoring?", opts: ["Four hours", "Five hours", "Six hours", "Eight hours"], correct: 2 },
  { text: "Paul replaced the broken window on the ground floor of the school.", q: "On which floor was the broken window?", opts: ["The basement", "The ground floor", "The first floor", "The second floor"], correct: 1 },
  { text: "The librarian found a handwritten note between pages forty and forty-one.", q: "Between which pages was the note found?", opts: ["Pages fourteen and fifteen", "Pages thirty and thirty-one", "Pages forty and forty-one", "Pages fifty and fifty-one"], correct: 2 },
  { text: "The cat knocked three glasses off the shelf before the owner intervened.", q: "How many glasses did the cat knock off?", opts: ["One", "Two", "Three", "Four"], correct: 2 },
  { text: "The new road will reduce the journey time from ninety to forty minutes.", q: "What will the new journey time be?", opts: ["Twenty minutes", "Thirty minutes", "Forty minutes", "Sixty minutes"], correct: 2 },
  { text: "The cave explorer used a rope, a headlamp, and a compass to navigate.", q: "What did the explorer use for light?", opts: ["A torch", "A lantern", "A headlamp", "A flare"], correct: 2 },
  { text: "The farmer harvested five hundred kilograms of potatoes in one morning.", q: "How many kilograms of potatoes were harvested?", opts: ["Fifty", "One hundred", "Two hundred", "Five hundred"], correct: 3 },
  { text: "The concert hall seats nine hundred people and has perfect acoustics.", q: "How many people does the concert hall seat?", opts: ["Six hundred", "Seven hundred", "Eight hundred", "Nine hundred"], correct: 3 },
  { text: "The police officer found the stolen wallet under a bench in the park.", q: "Where was the wallet found?", opts: ["In a bin", "Behind a tree", "Under a bench", "Near the fountain"], correct: 2 }
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
// DRILL 4: HRV BREATHING — resonance frequency 6 breaths/min
// Based on Lehrer et al. 2020 — 5s inhale / 5s exhale × 10 cycles
// ═════════════════════════════════════════════════════════════
let hrvState = null;

function startHRVDrill() {
  const stage = document.getElementById('drill-stage');
  const totalCycles = 10; // 10 × 10s = ~100s

  hrvState = {
    cycle: 0,
    totalCycles,
    phase: 'inhale', // 'inhale' | 'exhale'
    phaseStart: Date.now(),
    phaseDuration: 5000,
    inRhythm: 0, // cycles completed in rhythm
    offCount: 0,
    running: true,
    timer: null
  };

  stage.innerHTML =
    '<div class="hrv-stage">' +
      '<div class="hrv-label" id="hrv-label">Breathe in</div>' +
      '<div class="hrv-bar-wrap">' +
        '<div class="hrv-bar-track">' +
          '<div class="hrv-bar-fill" id="hrv-fill"></div>' +
        '</div>' +
      '</div>' +
      '<div class="hrv-phase-label" id="hrv-phase">5s in · 5s out</div>' +
      '<div class="hrv-cycles" id="hrv-cycles">Cycle 1 of ' + totalCycles + '</div>' +
      '<div class="hrv-rhythm" id="hrv-rhythm">&nbsp;</div>' +
    '</div>';

  document.getElementById('drill-timer').textContent = '—';
  runHRVPhase();
}

function runHRVPhase() {
  if (!hrvState || !hrvState.running) return;
  const { phase, cycle, totalCycles, phaseDuration } = hrvState;

  const label = document.getElementById('hrv-label');
  const fill = document.getElementById('hrv-fill');
  const cycleEl = document.getElementById('hrv-cycles');
  const timerEl = document.getElementById('drill-timer');

  if (label) label.textContent = phase === 'inhale' ? 'Breathe in' : 'Breathe out';
  if (cycleEl) cycleEl.textContent = 'Cycle ' + (cycle + 1) + ' of ' + totalCycles;

  // Animate bar
  if (fill) {
    fill.style.transition = 'none';
    fill.style.height = phase === 'inhale' ? '0%' : '100%';
    setTimeout(() => {
      if (!fill) return;
      fill.style.transition = 'height ' + (phaseDuration / 1000) + 's linear';
      fill.style.height = phase === 'inhale' ? '100%' : '0%';
    }, 30);
  }

  // Countdown within phase
  const phaseStart = Date.now();
  const phaseTick = () => {
    if (!hrvState || !hrvState.running) return;
    const elapsed = Date.now() - phaseStart;
    const remaining = Math.max(0, phaseDuration - elapsed);
    if (timerEl) timerEl.textContent = (remaining / 1000).toFixed(1) + 's';
    if (elapsed < phaseDuration) {
      setTimeout(phaseTick, 100);
    }
  };
  phaseTick();

  // Advance phase after duration
  hrvState.timer = setTimeout(() => {
    if (!hrvState || !hrvState.running) return;

    if (phase === 'inhale') {
      hrvState.phase = 'exhale';
      runHRVPhase();
    } else {
      // Completed one full cycle
      hrvState.cycle++;
      hrvState.inRhythm++;
      const rhythmEl = document.getElementById('hrv-rhythm');
      if (rhythmEl) {
        rhythmEl.textContent = '+ In rhythm';
        rhythmEl.style.color = 'var(--green)';
        setTimeout(() => { if (rhythmEl) rhythmEl.textContent = '\u00A0'; }, 800);
      }
      haptic(10);

      if (hrvState.cycle >= totalCycles) {
        endHRV();
        return;
      }
      hrvState.phase = 'inhale';
      runHRVPhase();
    }
  }, phaseDuration);
}

function endHRV() {
  if (!hrvState) return;
  clearTimeout(hrvState.timer);
  const inRhythm = hrvState.inRhythm;
  const total = hrvState.totalCycles;
  hrvState = null;
  // Score: cycles in rhythm × 20 (max 200 for 10/10)
  const score = Math.round((inRhythm / total) * 200);
  finishDrill(score, { hrvCycles: inRhythm, hrvTotal: total });
}

// ═════════════════════════════════════════════════════════════
// RESULTS SCREEN
// ═════════════════════════════════════════════════════════════
function showResults() {
  showScreen('results');
  const s = currentSession;
  const total = s.scores.mindfulness + s.scores.speed + s.scores.gonogo + s.scores.hrv;

  const prev = sessions.slice(0, -1).filter(x => x.completed).slice(-1)[0];

  const fmt = (drill, val) => {
    let label = DRILL_NAMES[drill];
    let extra = '';
    if (drill === 'mindfulness' && s.meta.mindWanders != null) extra = s.meta.mindWanders + ' mind-wanders';
    if (drill === 'speed' && s.meta.speedCorrect != null) extra = s.meta.speedCorrect + '/' + s.meta.speedTotal + ' correct';
    if (drill === 'gonogo' && s.meta.gngAvgRt != null) extra = s.meta.gngAvgRt + 'ms avg RT';
    if (drill === 'hrv' && s.meta.hrvCycles != null) extra = s.meta.hrvCycles + '/' + s.meta.hrvTotal + ' cycles in rhythm';

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
    fmt('mindfulness', s.scores.mindfulness) +
    fmt('speed', s.scores.speed) +
    fmt('gonogo', s.scores.gonogo) +
    fmt('hrv', s.scores.hrv) +
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
