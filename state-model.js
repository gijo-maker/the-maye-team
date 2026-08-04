function getSundayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

window.MayeStateModel = {
  defaultState() {
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
  },

  migrateProgress(progress) {
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
  },

  extractShared(state) {
    return {
      progress: state.progress || { saoirse: {}, orla: {} },
      streaks: state.streaks || { saoirse: 0, orla: 0 },
      celebrated: state.celebrated || { saoirse: false, orla: false },
      weekStart: state.weekStart,
    };
  },

  mergeSharedIntoState(localState, shared) {
    if (!shared) return localState;
    return {
      ...localState,
      progress: this.migrateProgress(shared.progress || localState.progress),
      streaks: shared.streaks || localState.streaks,
      celebrated: shared.celebrated || localState.celebrated,
      weekStart: shared.weekStart || localState.weekStart,
    };
  },

  hasMeaningfulSharedData(shared) {
    if (!shared) return false;

    const streaks = shared.streaks || {};
    if ((streaks.saoirse || 0) > 0 || (streaks.orla || 0) > 0) return true;

    const progress = shared.progress || {};
    for (const childId of ['saoirse', 'orla']) {
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