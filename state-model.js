const CHILD_IDS = ['saoirse', 'orla'];

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysFromMonday);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function emptyStreakRecord() {
  return { current: 0, longest: 0 };
}

function emptyChildStreakMaps() {
  return {
    saoirse: emptyStreakRecord(),
    orla: emptyStreakRecord(),
  };
}

function emptyTaskStreakMaps() {
  return { saoirse: {}, orla: {} };
}

function emptyWeekTasks() {
  return { saoirse: null, orla: null };
}

function readLegacyStreakCurrent(value) {
  if (typeof value === 'number' && !Number.isNaN(value)) return Math.max(0, value);
  if (value && typeof value === 'object' && typeof value.current === 'number') {
    return Math.max(0, value.current);
  }
  return 0;
}

window.MayeStateModel = {
  CHILD_IDS,

  getMondayOfWeek,

  defaultState() {
    return {
      pin: '1234',
      weekStart: getMondayOfWeek(),
      soundEnabled: true,
      streaks: { saoirse: 0, orla: 0 },
      streakMeta: emptyChildStreakMaps(),
      taskStreaks: emptyTaskStreakMaps(),
      weekTasks: emptyWeekTasks(),
      weeklySnapshots: [],
      celebrated: { saoirse: false, orla: false },
      progress: {
        saoirse: {},
        orla: {},
      },
    };
  },

  migrateProgress(progress) {
    const migrated = { ...(progress || {}) };
    CHILD_IDS.forEach((childId) => {
      if (!migrated[childId]) migrated[childId] = {};
      const p = { ...migrated[childId] };
      if (p.simplyActivity !== undefined && p.simplyTime === undefined) {
        p.simplyTime = p.simplyActivity;
        delete p.simplyActivity;
      }
      migrated[childId] = p;
    });
    return migrated;
  },

  syncLegacyStreaks(state) {
    const streaks = { ...(state.streaks || {}) };
    const streakMeta = { ...(state.streakMeta || emptyChildStreakMaps()) };

    CHILD_IDS.forEach((childId) => {
      const legacyValue = streaks[childId];
      const meta = { ...emptyStreakRecord(), ...(streakMeta[childId] || {}) };

      const currentFromLegacy = readLegacyStreakCurrent(legacyValue);
      const currentFromMeta = readLegacyStreakCurrent(meta);
      const current = Math.max(currentFromLegacy, currentFromMeta);

      streaks[childId] = current;
      streakMeta[childId] = {
        current,
        longest: Math.max(meta.longest || 0, current),
      };
    });

    state.streaks = streaks;
    state.streakMeta = streakMeta;
    return state;
  },

  migrateState(state) {
    const defaults = this.defaultState();
    const migrated = {
      ...defaults,
      ...state,
      streaks: { ...defaults.streaks, ...(state.streaks || {}) },
      streakMeta: { ...defaults.streakMeta, ...(state.streakMeta || {}) },
      taskStreaks: { ...defaults.taskStreaks, ...(state.taskStreaks || {}) },
      weekTasks: { ...defaults.weekTasks, ...(state.weekTasks || {}) },
      weeklySnapshots: Array.isArray(state.weeklySnapshots)
        ? state.weeklySnapshots
        : defaults.weeklySnapshots,
      celebrated: { ...defaults.celebrated, ...(state.celebrated || {}) },
      progress: this.migrateProgress(state.progress),
    };

    return this.syncLegacyStreaks(migrated);
  },

  extractShared(state) {
    const normalized = this.migrateState(state);
    return {
      progress: normalized.progress,
      streaks: normalized.streaks,
      streakMeta: normalized.streakMeta,
      taskStreaks: normalized.taskStreaks,
      weekTasks: normalized.weekTasks,
      weeklySnapshots: normalized.weeklySnapshots,
      celebrated: normalized.celebrated,
      weekStart: normalized.weekStart,
    };
  },

  mergeSharedIntoState(localState, shared) {
    if (!shared) return this.migrateState(localState);
    const merged = {
      ...localState,
      progress: shared.progress ?? localState.progress,
      streaks: shared.streaks ?? localState.streaks,
      streakMeta: shared.streakMeta ?? localState.streakMeta,
      taskStreaks: shared.taskStreaks ?? localState.taskStreaks,
      weekTasks: shared.weekTasks ?? localState.weekTasks,
      weeklySnapshots: shared.weeklySnapshots ?? localState.weeklySnapshots,
      celebrated: shared.celebrated ?? localState.celebrated,
      weekStart: shared.weekStart ?? localState.weekStart,
    };
    return this.migrateState(merged);
  },

  hasMeaningfulSharedData(shared) {
    if (!shared) return false;

    const streaks = shared.streaks || {};
    const streakMeta = shared.streakMeta || {};
    for (const childId of CHILD_IDS) {
      const current = readLegacyStreakCurrent(streaks[childId])
        || readLegacyStreakCurrent(streakMeta[childId]);
      if (current > 0) return true;
    }

    if (Array.isArray(shared.weeklySnapshots) && shared.weeklySnapshots.length > 0) {
      return true;
    }

    const progress = shared.progress || {};
    for (const childId of CHILD_IDS) {
      const childProgress = progress[childId] || {};
      for (const value of Object.values(childProgress)) {
        if (typeof value === 'number' && value > 0) return true;
      }
    }

    const celebrated = shared.celebrated || {};
    if (celebrated.saoirse || celebrated.orla) return true;

    return false;
  },
};

(function attachStateMigration() {
  if (!window.MayeStorage || window.MayeStorage.__mayeStateMigrationAttached) return;

  const originalLoadState = window.MayeStorage.loadState.bind(window.MayeStorage);
  window.MayeStorage.loadState = function loadStateWithMigration() {
    return MayeStateModel.migrateState(originalLoadState());
  };
  window.MayeStorage.__mayeStateMigrationAttached = true;
})();
