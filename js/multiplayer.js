// Firebase Realtime Database wrapper — the remote-persistence counterpart to
// state.js's local persistence. Owns all network calls for multiplayer;
// nothing else in js/ talks to Firebase directly. Like state.js, this module
// has no game rules of its own — it moves plain data in and out of Firebase
// and lets main.js/combat.js decide what it means.
//
// Multiplayer is entirely optional and fails soft: if js/firebase-config.js
// doesn't exist yet (gitignored — see firebase-config.example.js) or the
// Firebase SDK can't be reached, every exported function below becomes a
// no-op and the single-player game is unaffected. This is deliberate — a
// player who hasn't set up a Firebase project (or is offline) should never
// see an error because of this file.

const FIREBASE_SDK_VERSION = '10.13.2';

let enabled = false;
let uid = null;
let db = null;
let sdk = null; // { ref, set, get, push, child, remove }

export function isEnabled() {
  return enabled;
}

export function myUid() {
  return uid;
}

// Call once at boot. Resolves to { enabled, uid }. Never throws.
export async function initMultiplayer() {
  try {
    const cfgModule = await import('./firebase-config.js');
    const config = cfgModule && cfgModule.firebaseConfig;
    if (!config || !config.apiKey || String(config.apiKey).startsWith('YOUR_')) {
      console.info('[multiplayer] No Firebase config found — running single-player only.');
      return { enabled: false, uid: null };
    }

    const [{ initializeApp }, authMod, dbMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-database.js`),
    ]);

    const app = initializeApp(config);
    const auth = authMod.getAuth(app);
    db = dbMod.getDatabase(app);
    sdk = { ref: dbMod.ref, set: dbMod.set, get: dbMod.get, push: dbMod.push, child: dbMod.child, remove: dbMod.remove };

    uid = await new Promise((resolve, reject) => {
      const unsub = authMod.onAuthStateChanged(auth, (user) => {
        if (user) {
          unsub();
          resolve(user.uid);
        }
      });
      authMod.signInAnonymously(auth).catch((err) => {
        unsub();
        reject(err);
      });
    });

    enabled = true;
    return { enabled: true, uid };
  } catch (err) {
    console.warn('[multiplayer] Firebase unavailable — running single-player only.', err);
    enabled = false;
    return { enabled: false, uid: null };
  }
}

// Writes/overwrites this device's own player record. Only ever called with
// the local player's own data — the security rules only allow writing your
// own uid's node anyway.
export async function syncSelf(player) {
  if (!enabled) return;
  try {
    await sdk.set(sdk.ref(db, `players/${uid}`), {
      id: uid,
      name: player.name,
      avatar: player.avatar,
      element: player.element,
      level: player.level,
      hp: player.hp,
      maxHP: player.maxHP,
      mana: player.mana,
      maxMana: player.maxMana,
      power: player.power,
      defense: player.defense,
      senseRange: player.senseRange,
      position: player.position,
      lastSyncedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[multiplayer] syncSelf failed', err);
  }
}

// Returns every other known player as a wizard-shaped, read-only snapshot
// (isRemote: true, isNPC: false). Distance/sense-range filtering happens in
// main.js, same as it does for NPCs — this module doesn't know about game
// rules like sense range.
export async function fetchNearbyPlayers() {
  if (!enabled) return [];
  try {
    const snap = await sdk.get(sdk.ref(db, 'players'));
    const val = snap.val() || {};
    return Object.entries(val)
      .filter(([playerUid, p]) => playerUid !== uid && p && p.position)
      .map(([playerUid, p]) => ({ ...p, id: playerUid, isRemote: true, isNPC: false }));
  } catch (err) {
    console.warn('[multiplayer] fetchNearbyPlayers failed', err);
    return [];
  }
}

// Records a hit against another player's own pendingHits list. Fire-and-
// forget from the caller's point of view — combat resolution on the
// attacker's side doesn't wait on this.
export async function sendPendingHit(targetUid, hit) {
  if (!enabled) return;
  try {
    await sdk.push(sdk.ref(db, `pendingHits/${targetUid}`), hit);
  } catch (err) {
    console.warn('[multiplayer] sendPendingHit failed', err);
  }
}

// Returns and removes every pending hit against *this* device's own uid
// whose impactAt has already passed (i.e. is "due"). Hits not yet due are
// left in place for a later call — this is how a real-time travel timer
// keeps working across reloads/offline periods without any server code.
export async function fetchAndClearDueHits(now) {
  if (!enabled) return [];
  try {
    const listRef = sdk.ref(db, `pendingHits/${uid}`);
    const snap = await sdk.get(listRef);
    const val = snap.val() || {};
    const due = [];
    for (const [hitId, hit] of Object.entries(val)) {
      if ((hit.impactAt || 0) <= now) {
        due.push(hit);
        await sdk.remove(sdk.child(listRef, hitId));
      }
    }
    return due;
  } catch (err) {
    console.warn('[multiplayer] fetchAndClearDueHits failed', err);
    return [];
  }
}
