/**
 * Replace the placeholder values below with your Firebase web app config.
 * Find these in Firebase Console → Project settings → Your apps → Web app.
 *
 * Do NOT put the family account password here — only the public web config.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBps2pIp20ZZKBsyv6fdwFuxdpnxXpE5LY',
  authDomain: 'the-maye-team.firebaseapp.com',
  projectId: 'the-maye-team',
  storageBucket: 'the-maye-team.firebasestorage.app',
  messagingSenderId: '817965795441',
  appId: '1:817965795441:web:cf0b183bdb431581e473d0',
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey
    && firebaseConfig.projectId
    && !firebaseConfig.apiKey.startsWith('YOUR_')
    && !firebaseConfig.projectId.startsWith('YOUR_')
  );
}
