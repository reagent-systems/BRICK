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
// TODO: Replace with your actual Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
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
