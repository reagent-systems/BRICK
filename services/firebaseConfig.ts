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
  apiKey: "AIzaSyD5uvWmEe-JUXByVkidmQLFsE1PH65h2To",
  authDomain: "brick-by-reagent.firebaseapp.com",
  projectId: "brick-by-reagent",
  storageBucket: "brick-by-reagent.firebasestorage.app",
  messagingSenderId: "145818200578",
  appId: "1:145818200578:web:0bd5fe13f0535bd7b2151b",
  measurementId: "G-MGXG07YBVG",
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
