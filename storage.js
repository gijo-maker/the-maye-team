const STORAGE_KEY = 'maye-team-data';
const PRE_CLOUD_BACKUP_KEY = 'maye-team-data-pre-cloud-backup';

window.MayeStorage = {
  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return MayeStateModel.defaultState();
      const saved = JSON.parse(raw);
      const state = { ...MayeStateModel.defaultState(), ...saved };
      state.progress = MayeStateModel.migrateProgress(state.progress);
      if (state.soundEnabled === undefined) state.soundEnabled = true;
      return state;
    } catch {
      return MayeStateModel.defaultState();
    }
  },

  saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  createPreCloudBackup() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      localStorage.setItem(PRE_CLOUD_BACKUP_KEY, raw);
      localStorage.setItem(`${PRE_CLOUD_BACKUP_KEY}-at`, new Date().toISOString());
    } catch {
      /* backup best-effort */
    }
  },

  persistState(state) {
    this.saveState(state);
    if (window.MayeFirebaseSync && window.MayeFirebaseSync.schedulePush) {
      window.MayeFirebaseSync.schedulePush(state);
    }
  },
};
