console.log('[Maye Debug] bootstrap.js loaded');

import { initFirebaseSync } from './firebase-sync.js';

console.log('[Maye Debug] starting app');
window.MayeApp.startApp();

console.log('[Maye Debug] starting Firebase sync');
await initFirebaseSync({
  getState: () => window.MayeApp.getState(),
  setState: (newState) => window.MayeApp.applySyncState(newState),
});
