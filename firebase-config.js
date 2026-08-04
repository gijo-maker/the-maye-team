/**
 * Replace the placeholder values below with your Firebase web app config.
 * Find these in Firebase Console → Project settings → Your apps → Web app.
 *
 * Do NOT put the family account password here — only the public web config.
 */
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey
    && firebaseConfig.projectId
    && !firebaseConfig.apiKey.startsWith('YOUR_')
    && !firebaseConfig.projectId.startsWith('YOUR_')
  );
}
