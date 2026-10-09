// Template for the real config. Copy this file to js/firebase-config.js
// (that filename is gitignored — see .gitignore — so your real keys never
// get committed) and fill in the values from your own Firebase project:
//
//   Firebase console → (create/select a project) → Project settings →
//   General → "Your apps" → Add app → Web → copy the config object shown.
//
// Multiplayer also needs, in the same console:
//   - Authentication → Sign-in method → enable "Anonymous".
//   - Realtime Database → Create Database (any region) → start in locked
//     mode, then paste the contents of firebase-rules.json into the Rules
//     tab (see docs/ARCHITECTURE.md "Multiplayer" for what those rules do).
//
// If js/firebase-config.js does not exist, or apiKey below is left as the
// placeholder, the game runs single-player only (NPCs, no real-player
// markers) — this is a deliberate fallback, not an error state.
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY_HERE',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
