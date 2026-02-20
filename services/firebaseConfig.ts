/**
 * Firebase Configuration & Initialization
 *
 * Initializes Firebase App, Auth, Firestore, and AI Logic.
 * Replace the placeholder config with your Firebase project config
 * from the Firebase Console → Project Settings → General → Your apps.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// ─── Firebase Config ─────────────────────────────────────────────────────────
// These are client-side identifiers (safe to be public / committed to repo).
// Security is enforced by Firebase Security Rules and App Check, not by
// hiding these values.
const firebaseConfig = {
  apiKey: "AIzaSyB1YwnIORwNFiTDg5wF2xO0tVOvlG6MYDA",
  authDomain: "gen-lang-client-0512464630.firebaseapp.com",
  projectId: "gen-lang-client-0512464630",
  storageBucket: "gen-lang-client-0512464630.firebasestorage.app",
  messagingSenderId: "953043772323",
  appId: "1:953043772323:web:78c6c55199592af5c5b016",
  measurementId: "G-6WF9CSPVL8",
};

// ─── Initialization (singleton) ──────────────────────────────────────────────

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function ensureInitialized() {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
}

/**
 * Check if Firebase is configured (has a project ID).
 */
export function isFirebaseConfigured(): boolean {
  return !!firebaseConfig.projectId;
}

export function getFirebaseApp(): FirebaseApp {
  ensureInitialized();
  return app;
}

export function getFirebaseAuth(): Auth {
  ensureInitialized();
  return auth;
}

export function getFirebaseFirestore(): Firestore {
  ensureInitialized();
  return db;
}
