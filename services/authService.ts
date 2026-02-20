/**
 * Firebase Auth Service
 *
 * Handles user sign-in, sign-up, sign-out, and auth state changes.
 * Wraps Firebase Auth with a clean API for the rest of the app.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseFirestore, isFirebaseConfigured } from './firebaseConfig';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrickUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// ─── Auth Methods ────────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string): Promise<BrickUser> {
  const auth = getFirebaseAuth();
  const result = await signInWithEmailAndPassword(auth, email, password);
  return mapUser(result.user);
}

export async function signUpWithEmail(email: string, password: string, displayName?: string): Promise<BrickUser> {
  const auth = getFirebaseAuth();
  const result = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName) {
    await updateProfile(result.user, { displayName });
  }

  // Create user doc in Firestore
  await ensureUserDoc(result.user);

  return mapUser(result.user);
}

export async function signInWithGoogle(): Promise<BrickUser> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  // Create user doc in Firestore (if first time)
  await ensureUserDoc(result.user);

  return mapUser(result.user);
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
}

export function getCurrentUser(): BrickUser | null {
  if (!isFirebaseConfigured()) return null;
  const auth = getFirebaseAuth();
  return auth.currentUser ? mapUser(auth.currentUser) : null;
}

export function onAuthStateChanged(callback: (user: BrickUser | null) => void): Unsubscribe {
  const auth = getFirebaseAuth();
  return firebaseOnAuthStateChanged(auth, (user) => {
    callback(user ? mapUser(user) : null);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapUser(user: User): BrickUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

/**
 * Ensure a Firestore user document exists for the given user.
 * Creates one with initial credits if it doesn't exist.
 */
async function ensureUserDoc(user: User): Promise<void> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || '',
      credits: 5, // Welcome bonus
      totalCreditsUsed: 0,
      createdAt: serverTimestamp(),
      stripeCustomerId: '',
    });
  }
}
