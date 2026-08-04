import { initFirebaseSync } from './firebase-sync.js';

window.MayeApp.startApp();

await initFirebaseSync({
  getState: () => window.MayeApp.getState(),
  setState: (newState) => window.MayeApp.applySyncState(newState),
});
