const STORAGE_KEY = 'maye-team-data';
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const CHILDREN = {
  saoirse: {
    name: 'Saoirse',
    emoji: '🌿',
    theme: 'green',
    tasks: [
      { id: 'reading', label: '📖 Reading 10 minutes', count: 3 },
      { id: 'timesTables', label: '🔢 Times tables 10 minutes', count: 2 },
      { id: 'shower', label: '🚿 Shower', count: 2 },
      { id: 'hairMask', label: '💆 Hair mask', count: 1 },
      { id: 'simplyActivity', label: '✨ Simply activity', count: 3 },
    ],
  },
  orla: {
    name: 'Orla',
    emoji: '🌸',
    theme: 'pink',
    tasks: [
      { id: 'reading', label: '📖 Reading 10 minutes', count: 3 },
      { id: 'numbers', label: '🔢 Numbers 10 minutes', count: 2 },
      { id: 'shower', label: '🚿 Shower', count: 2 },
      { id: 'hairMask', label: '💆 Hair mask', count: 1 },
      { id: 'simplyActivity', label: '✨ Simply activity', count: 3 },
    ],
  },
};

function getSundayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function defaultState() {
  const weekStart = getSundayOfWeek();
  return {
    pin: '1234',
    weekStart,
    streaks: { saoirse: 0, orla: 0 },
    celebrated: { saoirse: false, orla: false },
    progress: {
      saoirse: {},
      orla: {},
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const state = JSON.parse(raw);
    return { ...defaultState(), ...state };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let currentPin = '';
let currentScreen = 'home';
let parentUnlocked = false;

function getTotalTasks(childId) {
  return CHILDREN[childId].tasks.reduce((sum, t) => sum + t.count, 0);
}

function getCompletedCount(childId) {
  const progress = state.progress[childId] || {};
  return CHILDREN[childId].tasks.reduce((sum, t) => {
    const done = Math.min(progress[t.id] || 0, t.count);
    return sum + done;
  }, 0);
}

function getPercent(childId) {
  const total = getTotalTasks(childId);
  if (total === 0) return 0;
  return Math.round((getCompletedCount(childId) / total) * 100);
}

function isWeekComplete(childId) {
  return getPercent(childId) === 100;
}

function formatWeekDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function navigateTo(screen) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const target = document.getElementById(`screen-${screen}`);
  if (target) {
    target.classList.add('active');
    currentScreen = screen;
  }

  if (screen === 'parent') {
    parentUnlocked = false;
    currentPin = '';
    document.getElementById('pin-gate').classList.remove('hidden');
    document.getElementById('parent-dashboard').classList.add('hidden');
    updatePinDots();
    document.getElementById('pin-error').textContent = '';
  }

  renderAll();
}

function updateProgressRing(childId) {
  const percent = getPercent(childId);
  const ring = document.getElementById(`ring-${childId}`);
  if (ring) {
    const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
    ring.style.strokeDashoffset = offset;
  }
  const percentEl = document.getElementById(`percent-${childId}`);
  if (percentEl) percentEl.textContent = `${percent}%`;
}

function renderTasks(childId) {
  const container = document.getElementById(`tasks-${childId}`);
  if (!container) return;

  const progress = state.progress[childId] || {};
  container.innerHTML = '';

  CHILDREN[childId].tasks.forEach((task) => {
    const done = progress[task.id] || 0;
    const group = document.createElement('div');
    group.className = 'task-group';

    const label = document.createElement('div');
    label.className = 'task-label';
    label.textContent = task.label;
    group.appendChild(label);

    const dots = document.createElement('div');
    dots.className = 'task-dots';

    for (let i = 0; i < task.count; i++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'task-dot' + (i < done ? ' done' : '');
      dot.textContent = i < done ? '✓' : '';
      dot.setAttribute('aria-label', `${task.label} ${i + 1} of ${task.count}`);
      dot.addEventListener('click', () => toggleTask(childId, task.id, i, task.count));
      dots.appendChild(dot);
    }

    group.appendChild(dots);
    container.appendChild(group);
  });
}

function toggleTask(childId, taskId, index, max) {
  if (!state.progress[childId]) state.progress[childId] = {};
  const current = state.progress[childId][taskId] || 0;

  if (index < current) {
    state.progress[childId][taskId] = index;
  } else if (index === current && current < max) {
    state.progress[childId][taskId] = current + 1;
  }

  saveState(state);
  renderAll();

  if (isWeekComplete(childId) && !state.celebrated[childId]) {
    state.celebrated[childId] = true;
    saveState(state);
    showCelebration(childId);
  }
}

function showCelebration(childId) {
  const child = CHILDREN[childId];
  document.getElementById('celebration-text').textContent =
    `${child.name} completed all weekly tasks!`;
  document.getElementById('celebration').classList.remove('hidden');

  const colors = childId === 'saoirse'
    ? ['#58c47a', '#3da85e', '#fdcb6e', '#74b9ff']
    : ['#f78fb3', '#e06b96', '#fdcb6e', '#a29bfe'];

  const duration = 3000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors,
  });
}

function hideCelebration() {
  document.getElementById('celebration').classList.add('hidden');
}

function renderStreaks() {
  ['saoirse', 'orla'].forEach((id) => {
    const streak = state.streaks[id] || 0;
    const label = streak === 1 ? '1 week streak' : `${streak} week streak`;
    const els = [
      document.getElementById(`streak-${id}`),
      document.getElementById(`family-streak-${id}`),
    ];
    els.forEach((el) => {
      if (el) el.textContent = `🔥 ${label}`;
    });
  });
}

function renderHome() {
  ['saoirse', 'orla'].forEach((id) => {
    const el = document.getElementById(`home-progress-${id}`);
    if (el) el.textContent = `${getPercent(id)}%`;
  });
}

function renderFamily() {
  let combined = 0;
  ['saoirse', 'orla'].forEach((id) => {
    const percent = getPercent(id);
    combined += percent;

    const pctEl = document.getElementById(`family-percent-${id}`);
    const barEl = document.getElementById(`family-bar-${id}`);
    if (pctEl) pctEl.textContent = `${percent}%`;
    if (barEl) barEl.style.width = `${percent}%`;
  });

  const combinedEl = document.getElementById('family-combined');
  if (combinedEl) combinedEl.textContent = `${Math.round(combined / 2)}%`;
}

function renderParent() {
  const weekEl = document.getElementById('week-start-display');
  if (weekEl) weekEl.textContent = formatWeekDate(state.weekStart);

  ['saoirse', 'orla'].forEach((id) => {
    const el = document.getElementById(`parent-percent-${id}`);
    if (el) el.textContent = `${getPercent(id)}%`;
  });
}

function renderAll() {
  ['saoirse', 'orla'].forEach((id) => {
    renderTasks(id);
    updateProgressRing(id);
  });
  renderStreaks();
  renderHome();
  renderFamily();
  renderParent();
}

function weeklyReset() {
  ['saoirse', 'orla'].forEach((id) => {
    if (isWeekComplete(id)) {
      state.streaks[id] = (state.streaks[id] || 0) + 1;
    }
    state.progress[id] = {};
    state.celebrated[id] = false;
  });

  state.weekStart = getSundayOfWeek();
  saveState(state);
  renderAll();

  alert('Weekly reset complete! Streaks updated for completed weeks. 🎉');
}

function updatePinDots() {
  const dots = document.querySelectorAll('#pin-dots span');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < currentPin.length);
  });
}

function tryPin() {
  if (currentPin === state.pin) {
    parentUnlocked = true;
    document.getElementById('pin-gate').classList.add('hidden');
    document.getElementById('parent-dashboard').classList.remove('hidden');
    document.getElementById('pin-error').textContent = '';
    currentPin = '';
    updatePinDots();
    renderParent();
  } else {
    document.getElementById('pin-error').textContent = 'Wrong PIN. Try again!';
    currentPin = '';
    updatePinDots();
  }
}

function handlePinDigit(digit) {
  if (digit === 'clear') {
    currentPin = currentPin.slice(0, -1);
  } else if (digit === 'enter') {
    if (currentPin.length === 4) tryPin();
    return;
  } else if (currentPin.length < 4) {
    currentPin += digit;
  }
  updatePinDots();
  document.getElementById('pin-error').textContent = '';

  if (currentPin.length === 4) {
    setTimeout(tryPin, 200);
  }
}

function changePin() {
  const input = document.getElementById('new-pin');
  const newPin = input.value.trim();
  if (!/^\d{4}$/.test(newPin)) {
    alert('PIN must be exactly 4 digits.');
    return;
  }
  state.pin = newPin;
  saveState(state);
  input.value = '';
  alert('PIN updated successfully!');
}

function initNavigation() {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.nav);
    });
  });

  document.getElementById('btn-parent-link').addEventListener('click', () => {
    navigateTo('parent');
  });
}

function initPinPad() {
  document.getElementById('pin-pad').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-digit]');
    if (!btn) return;
    handlePinDigit(btn.dataset.digit);
  });
}

function initParent() {
  document.getElementById('btn-weekly-reset').addEventListener('click', () => {
    const saoirseComplete = isWeekComplete('saoirse');
    const orlaComplete = isWeekComplete('orla');
    let msg = 'Reset all weekly tasks for both children?';
    if (saoirseComplete || orlaComplete) {
      msg += '\n\nCompleted weeks will add to streaks:';
      if (saoirseComplete) msg += '\n✓ Saoirse';
      if (orlaComplete) msg += '\n✓ Orla';
    }
    if (confirm(msg)) weeklyReset();
  });

  document.getElementById('btn-change-pin').addEventListener('click', changePin);
}

function initCelebration() {
  document.getElementById('btn-celebration-close').addEventListener('click', hideCelebration);
}

function init() {
  initNavigation();
  initPinPad();
  initParent();
  initCelebration();
  renderAll();
}

init();
