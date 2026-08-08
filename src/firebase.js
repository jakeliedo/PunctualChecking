import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, deleteDoc,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- Room ID ----------
export const roomId = 'be015f059bde59eb';

// ---------- Firestore helpers ----------
function dataDoc(key) {
  return doc(db, 'rooms', roomId, 'data', key);
}
function metaDoc() {
  return doc(db, 'rooms', roomId, 'meta', 'index');
}

// Read: Firestore first, fall back to localStorage (handles offline & first migration)
export async function storageGet(key) {
  try {
    const snap = await getDoc(dataDoc(key));
    if (snap.exists()) {
      const value = snap.data().value;
      // Keep local cache in sync so exportBackup still works
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
      return value;
    }
  } catch {
    // Firestore unavailable (offline, misconfigured, etc.) — fall through
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Write: both localStorage (instant) AND Firestore (cloud backup)
export async function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  try {
    await setDoc(dataDoc(key), { value });
    if (key.startsWith('day:')) {
      await setDoc(metaDoc(), { dayKeys: arrayUnion(key) }, { merge: true });
    }
  } catch (e) {
    console.warn('Firestore write failed:', key, e?.message);
  }
}

// Delete: both localStorage AND Firestore
export async function storageDelete(key) {
  try { localStorage.removeItem(key); } catch {}
  try {
    await deleteDoc(dataDoc(key));
    if (key.startsWith('day:')) {
      await setDoc(metaDoc(), { dayKeys: arrayRemove(key) }, { merge: true });
    }
  } catch (e) {
    console.warn('Firestore delete failed:', key, e?.message);
  }
}

// List all saved day keys.
// Priority: Firestore meta/index → scan Firestore data collection → localStorage
export async function listDayKeys() {
  // 1. Try meta/index (fastest — maintained by storageSet/storageDelete)
  try {
    const snap = await getDoc(metaDoc());
    const cloudKeys = snap.data()?.dayKeys || [];
    if (cloudKeys.length > 0) return cloudKeys.sort().reverse();
  } catch {}

  // 2. Meta/index empty or missing — scan actual Firestore documents to rebuild it.
  //    This recovers from cases where data existed before meta/index was added,
  //    or when the index was lost/corrupted.
  try {
    const colSnap = await getDocs(collection(db, 'rooms', roomId, 'data'));
    const scannedKeys = colSnap.docs.map(d => d.id).filter(k => k.startsWith('day:'));
    if (scannedKeys.length > 0) {
      // Rebuild meta/index in background so next load is fast
      setDoc(metaDoc(), { dayKeys: scannedKeys }, { merge: true }).catch(() => {});
      return scannedKeys.sort().reverse();
    }
  } catch {}

  // 3. Final fallback: scan localStorage (offline / Firestore unreachable)
  const localKeys = Object.keys(localStorage).filter(k => k.startsWith('day:'));
  if (localKeys.length > 0) {
    setDoc(metaDoc(), { dayKeys: localKeys }, { merge: true }).catch(() => {});
  }
  return localKeys.sort().reverse();
}

// Write all entries from a backup object to both localStorage and Firestore
export async function restoreBackup(data) {
  const promises = [];
  const dayKeys = [];
  for (const [k, v] of Object.entries(data)) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
    promises.push(setDoc(dataDoc(k), { value: v }).catch(() => {}));
    if (k.startsWith('day:')) dayKeys.push(k);
  }
  if (dayKeys.length > 0) {
    promises.push(setDoc(metaDoc(), { dayKeys }, { merge: true }).catch(() => {}));
  }
  await Promise.all(promises);
}
