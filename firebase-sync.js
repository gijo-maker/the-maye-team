import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  enableIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const PUSH_DEBOUNCE_MS = 400;
const LISTENER_SUPPRESS_MS = 2500;

let auth = null;
let db = null;
let callbacks = {};
let unsubscribeSnapshot = null;
let pushTimer = null;
let currentUser = null;
let listenerReady = false;
let applyingRemoteUpdate = false;
let suppressListenerUntil = 0;
let pendingPushState = null;

function setSyncStatus(text) {
  const el = document.getElementById('sync-status');
  if (el) el.textContent = text;
}

function showAuthPanel(show) {
  const panel = document.getElementById('auth-panel');
  if (panel) panel.classList.toggle('hidden', !show);
}

function familyDocRef(uid) {
  return doc(db, 'families', uid);
}

function sharedFromDocData(data) {
  if (!data) return null;
  return {
    progress: data.progress || { saoirse: {}, orla: {} },
    streaks: data.streaks || { saoirse: 0, orla: 0 },
    celebrated: data.celebrated || { saoirse: false, orla: false },
    weekStart: data.weekStart,
  };
}

async function enableOfflinePersistenceSafely() {
  try {
    await enableIndexedDbPersistence(db);
  } catch {
    /* persistence unavailable in this browser — app continues */
  }
}

async function fetchCloudShared(uid) {
  const snap = await getDoc(familyDocRef(uid));
  if (!snap.exists()) return null;
  return sharedFromDocData(snap.data());
}

async function writeCloudShared(uid, state) {
  const shared = MayeStateModel.extractShared(state);
  suppressListenerUntil = Date.now() + LISTENER_SUPPRESS_MS;
  await setDoc(familyDocRef(uid), {
    progress: shared.progress,
    streaks: shared.streaks,
    celebrated: shared.celebrated,
    weekStart: shared.weekStart,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function performInitialSync(uid) {
  setSyncStatus('Syncing…');

  const localState = callbacks.getState();
  const cloudShared = await fetchCloudShared(uid);
  const localShared = MayeStateModel.extractShared(localState);
  const cloudHasData = MayeStateModel.hasMeaningfulSharedData(cloudShared);
  const localHasData = MayeStateModel.hasMeaningfulSharedData(localShared);

  if (cloudHasData) {
    const merged = MayeStateModel.mergeSharedIntoState(localState, cloudShared);
    applyingRemoteUpdate = true;
    try {
      callbacks.setState(merged);
      MayeStorage.saveState(merged);
    } finally {
      applyingRemoteUpdate = false;
    }
  } else if (localHasData) {
    MayeStorage.createPreCloudBackup();
    await writeCloudShared(uid, localState);
  } else {
    await writeCloudShared(uid, localState);
  }

  setSyncStatus(navigator.onLine ? 'Saved' : 'Offline');
}

function startRealtimeListener(uid) {
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  listenerReady = false;

  unsubscribeSnapshot = onSnapshot(familyDocRef(uid), (snap) => {
    if (!listenerReady) {
      listenerReady = true;
      return;
    }
    if (Date.now() < suppressListenerUntil) return;
    if (applyingRemoteUpdate) return;

    const cloudShared = sharedFromDocData(snap.exists() ? snap.data() : null);
    if (!cloudShared) return;

    const localState = callbacks.getState();
    const merged = MayeStateModel.mergeSharedIntoState(localState, cloudShared);

    applyingRemoteUpdate = true;
    try {
      callbacks.setState(merged);
      MayeStorage.saveState(merged);
      setSyncStatus(navigator.onLine ? 'Saved' : 'Offline');
    } finally {
      applyingRemoteUpdate = false;
    }
  }, () => {
    setSyncStatus('Offline');
  });
}

async function pushNow(state) {
  console.log('[Maye Debug] pushNow called', {
    hasCurrentUser: !!currentUser,
    applyingRemoteUpdate
  });
  if (!currentUser || applyingRemoteUpdate) return;

  setSyncStatus('Syncing…');
  try {
    await writeCloudShared(currentUser.uid, state);
    setSyncStatus(navigator.onLine ? 'Saved' : 'Offline');
  } catch {
    setSyncStatus('Offline');
  }
}

function schedulePush(state) {
  console.log('[Maye Debug] schedulePush called', {
    hasCurrentUser: !!currentUser,
    applyingRemoteUpdate
  });
  if (!currentUser || applyingRemoteUpdate) return;

  pendingPushState = state;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const stateToPush = pendingPushState;
    pendingPushState = null;
    if (stateToPush) await pushNow(stateToPush);
  }, PUSH_DEBOUNCE_MS);
}

function wireAuthForm() {
  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const errorEl = document.getElementById('auth-error');
  const signInBtn = document.getElementById('auth-sign-in');
  const createBtn = document.getElementById('auth-create-account');

  if (!form || !emailInput || !passwordInput) return;

  async function handleAuth(action) {
    errorEl.textContent = '';
    setSyncStatus('Signing in…');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorEl.textContent = 'Please enter email and password.';
      setSyncStatus('Offline');
      return;
    }

    try {
      if (action === 'create') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      passwordInput.value = '';
    } catch (err) {
      errorEl.textContent = err.message || 'Sign in failed. Please try again.';
      setSyncStatus('Offline');
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAuth('signin');
  });

  signInBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleAuth('signin');
  });

  createBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleAuth('create');
  });
}

function wireConnectivityHandlers() {
  window.addEventListener('online', () => {
    if (currentUser) setSyncStatus('Saved');
  });
  window.addEventListener('offline', () => {
    setSyncStatus('Offline');
  });
}

async function handleSignedIn(user) {
  console.log('[Maye Debug] handleSignedIn', user.uid);
  currentUser = user;
  showAuthPanel(false);
  setSyncStatus('Syncing…');

  await performInitialSync(user.uid);
  startRealtimeListener(user.uid);
}

async function handleSignedOut() {
  console.log('[Maye Debug] handleSignedOut');
  currentUser = null;
  listenerReady = false;
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  showAuthPanel(true);
  setSyncStatus('Offline');
}

export async function initFirebaseSync(appCallbacks) {
  console.log('[Maye Debug] initFirebaseSync called');
  callbacks = appCallbacks;
  wireConnectivityHandlers();

  if (!isFirebaseConfigured()) {
    showAuthPanel(false);
    setSyncStatus('Saved');
    window.MayeFirebaseSync = { schedulePush() {} };
    return;
  }

  window.MayeFirebaseSync = { schedulePush };

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  await setPersistence(auth, browserLocalPersistence);
  await enableOfflinePersistenceSafely();
  wireAuthForm();

  setSyncStatus('Signing in…');

  console.log('[Maye Debug] registering auth state listener');
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      console.log('[Maye Debug] auth state:', user ? 'SIGNED IN' : 'SIGNED OUT');
      if (user) {
        await handleSignedIn(user);
      } else {
        await handleSignedOut();
      }
      resolve();
    });
  });
}
