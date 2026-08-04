const STORAGE_KEY = 'maye-team-data';

window.MayeStorage = {
  loadState(defaultState, migrateProgress) {
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
  },

  saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
};
