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
      { id: 'shower', label: '🚿 Shower or Bath', count: 2 },
      { id: 'hairMask', label: '💆 Hair mask', count: 1 },
      { id: 'simplyTime', label: '✨ Simply Time', count: 3 },
      { id: 'climbingFrame', label: '🧗 Climbing Frame 10 minutes', count: 2 },
    ],
  },
  orla: {
    name: 'Orla',
    emoji: '🌸',
    theme: 'pink',
    tasks: [
      { id: 'reading', label: '📖 Reading 10 minutes', count: 3 },
      { id: 'numbers', label: '🔢 Numbers 10 minutes', count: 2 },
      { id: 'shower', label: '🚿 Shower or Bath', count: 2 },
      { id: 'hairMask', label: '💆 Hair mask', count: 1 },
      { id: 'simplyTime', label: '✨ Simply Time', count: 3 },
      { id: 'climbingFrame', label: '🧗 Climbing Frame 10 minutes', count: 2 },
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
    soundEnabled: true,
    streaks: { saoirse: 0, orla: 0 },
    celebrated: { saoirse: false, orla: false },
    progress: {
      saoirse: {},
      orla: {},
    },
  };
}

function migrateProgress(progress) {
  const migrated = { ...progress };
  ['saoirse', 'orla'].forEach((childId) => {
    if (!migrated[childId]) migrated[childId] = {};
    const p = { ...migrated[childId] };
    if (p.simplyActivity !== undefined && p.simplyTime === undefined) {
      p.simplyTime = p.simplyActivity;
      delete p.simplyActivity;
    }
    migrated[childId] = p;
  });
  return migrated;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw);
    const state = { ...defaultState(), ...saved };
    state.progress = migrateProgress(state.progress);
    if (state.soundEnabled === undefined) state.soundEnabled = true;
    return state;
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let currentPin = '';
let parentUnlocked = false;
let audioCtx = null;
const displayedPercent = { saoirse: 0, orla: 0, combined: 0 };
const percentAnimations = {};

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

function playCompletionPing() {
  if (!state.soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;

    function chime(freq, start, duration, volume) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    }

    chime(740, now, 0.18, 0.045);
    chime(988, now + 0.1, 0.22, 0.035);
  } catch {
    /* audio unavailable */
  }
}

function animatePercent(key, target, onUpdate) {
  if (percentAnimations[key]) cancelAnimationFrame(percentAnimations[key]);

  const start = displayedPercent[key] ?? 0;
  if (start === target) {
    onUpdate(target);
    return;
  }

  const duration = 600;
  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(start + (target - start) * eased);
    displayedPercent[key] = current;
    onUpdate(current);
    if (t < 1) {
      percentAnimations[key] = requestAnimationFrame(frame);
    }
  }

  percentAnimations[key] = requestAnimationFrame(frame);
}

function bumpElement(el) {
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  el.addEventListener('animationend', () => el.classList.remove('bump'), { once: true });
}

function pulseProgressRing(childId) {
  const wrap = document.querySelector(`#screen-${childId} .progress-ring-wrap`);
  if (!wrap) return;
  wrap.classList.remove('pulse');
  void wrap.offsetWidth;
  wrap.classList.add('pulse');
  wrap.addEventListener('animationend', () => wrap.classList.remove('pulse'), { once: true });
}

function navigateTo(screen) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const target = document.getElementById(`screen-${screen}`);
  if (target) target.classList.add('active');

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

function updateProgressRing(childId, animate = true) {
  const percent = getPercent(childId);
  const ring = document.getElementById(`ring-${childId}`);
  const percentEl = document.getElementById(`percent-${childId}`);

  const applyRing = (value) => {
    if (ring) {
      const offset = RING_CIRCUMFERENCE - (value / 100) * RING_CIRCUMFERENCE;
      ring.style.strokeDashoffset = offset;
    }
    if (percentEl) percentEl.textContent = `${value}%`;
  };

  if (animate) {
    animatePercent(childId, percent, applyRing);
  } else {
    displayedPercent[childId] = percent;
    applyRing(percent);
  }
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
    group.dataset.taskId = task.id;

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
      dot.addEventListener('click', () => toggleTask(childId, task.id, i, task.count, dot, group));
      dots.appendChild(dot);
    }

    group.appendChild(dots);
    container.appendChild(group);
  });
}

function toggleTask(childId, taskId, index, max, dotEl, groupEl) {
  if (!state.progress[childId]) state.progress[childId] = {};
  const current = state.progress[childId][taskId] || 0;
  let completed = false;

  if (index < current) {
    state.progress[childId][taskId] = index;
  } else if (index === current && current < max) {
    state.progress[childId][taskId] = current + 1;
    completed = true;
  } else {
    return;
  }

  saveState(state);

  if (completed) {
    dotEl.classList.add('done', 'just-done');
    dotEl.textContent = '✓';
    dotEl.addEventListener('animationend', () => dotEl.classList.remove('just-done'), { once: true });

    groupEl.classList.add('celebrate');
    groupEl.addEventListener('animationend', () => groupEl.classList.remove('celebrate'), { once: true });

    playCompletionPing();
    pulseProgressRing(childId);
    bumpElement(document.getElementById(`percent-${childId}`));
  } else {
    renderTasks(childId);
  }

  updateProgressRing(childId);
  renderStreaks();
  renderHome();
  renderFamily();
  renderParent();

  if (completed && isWeekComplete(childId) && !state.celebrated[childId]) {
    state.celebrated[childId] = true;
    saveState(state);
    setTimeout(() => showCelebration(childId), 400);
  }
}

function showCelebration(childId) {
  const child = CHILDREN[childId];
  document.getElementById('celebration-title').textContent = 'Week Complete! 🎉';
  document.getElementById('celebration-text').textContent =
    `${child.name}, you completed your Maye Team Mission! ✨`;

  const content = document.querySelector('.celebration-content');
  content.classList.add('celebration-special');
  document.getElementById('celebration').classList.remove('hidden');

  pulseProgressRing(childId);
  bumpElement(document.getElementById(`percent-${childId}`));

  const colors = childId === 'saoirse'
    ? ['#58c47a', '#3da85e', '#fdcb6e']
    : ['#f78fb3', '#e06b96', '#fdcb6e'];

  const burst = (opts) => confetti({ ...opts, colors, disableForReducedMotion: true });

  burst({ particleCount: 40, spread: 50, origin: { x: 0.3, y: 0.55 }, startVelocity: 28, gravity: 0.9, ticks: 120 });
  burst({ particleCount: 40, spread: 50, origin: { x: 0.7, y: 0.55 }, startVelocity: 28, gravity: 0.9, ticks: 120 });

  setTimeout(() => {
    burst({ particleCount: 25, spread: 60, origin: { x: 0.5, y: 0.45 }, startVelocity: 22, gravity: 0.8, ticks: 100 });
  }, 250);
}

function hideCelebration() {
  document.getElementById('celebration').classList.add('hidden');
  document.querySelector('.celebration-content').classList.remove('celebration-special');
}

function renderStreaks() {
  ['saoirse', 'orla'].forEach((id) => {
    const streak = state.streaks[id] || 0;
    const label = streak === 1 ? '1 week streak' : `${streak} week streak`;
    [
      document.getElementById(`streak-${id}`),
      document.getElementById(`family-streak-${id}`),
    ].forEach((el) => {
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
  let combinedTarget = 0;
  ['saoirse', 'orla'].forEach((id) => {
    const percent = getPercent(id);
    combinedTarget += percent;

    const pctEl = document.getElementById(`family-percent-${id}`);
    const barEl = document.getElementById(`family-bar-${id}`);
    if (pctEl) pctEl.textContent = `${percent}%`;
    if (barEl) barEl.style.width = `${percent}%`;
  });

  const combined = Math.round(combinedTarget / 2);
  const combinedEl = document.getElementById('family-combined');
  animatePercent('combined', combined, (value) => {
    if (combinedEl) combinedEl.textContent = `${value}%`;
  });
}

function renderParent() {
  const weekEl = document.getElementById('week-start-display');
  if (weekEl) weekEl.textContent = formatWeekDate(state.weekStart);

  ['saoirse', 'orla'].forEach((id) => {
    const el = document.getElementById(`parent-percent-${id}`);
    if (el) el.textContent = `${getPercent(id)}%`;
  });

  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) soundToggle.checked = state.soundEnabled;
}

function renderAll() {
  ['saoirse', 'orla'].forEach((id) => {
    renderTasks(id);
    updateProgressRing(id, false);
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
  displayedPercent.saoirse = 0;
  displayedPercent.orla = 0;
  displayedPercent.combined = 0;
  renderAll();

  alert('Weekly reset complete! Streaks updated for completed weeks. 🎉');
}

function updatePinDots() {
  document.querySelectorAll('#pin-dots span').forEach((dot, i) => {
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
  if (currentPin.length === 4) setTimeout(tryPin, 200);
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

  document.getElementById('sound-toggle').addEventListener('change', (e) => {
    state.soundEnabled = e.target.checked;
    saveState(state);
  });
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
