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
  signInAnonymously as firebaseSignInAnonymously,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
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

/**
 * Sign in anonymously. Creates a real Firebase UID without any credentials.
 * Used for frictionless credit purchases when user doesn't want a full account.
 */
export async function signInAnonymously(): Promise<BrickUser> {
  const auth = getFirebaseAuth();
  const result = await firebaseSignInAnonymously(auth);
  await ensureUserDoc(result.user);
  return mapUser(result.user);
}

/**
 * Ensure current user is authenticated (anonymous or otherwise).
 * If not signed in at all, creates an anonymous account silently.
 * Returns the user's UID.
 */
export async function ensureAuthenticated(): Promise<string> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  const result = await firebaseSignInAnonymously(auth);
  await ensureUserDoc(result.user);
  return result.user.uid;
}

/**
 * Check if current user is anonymous (not linked to email/Google).
 */
export function isAnonymousUser(): boolean {
  const auth = getFirebaseAuth();
  return auth.currentUser?.isAnonymous ?? false;
}

/**
 * Upgrade an anonymous account to a Google account.
 * Preserves the existing UID and all associated data (credits, transactions).
 */
export async function linkWithGoogle(): Promise<BrickUser> {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) throw new Error('No current user to link');

  const provider = new GoogleAuthProvider();
  const result = await linkWithPopup(auth.currentUser, provider);

  // Update the user doc with the new info
  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', result.user.uid);
  const { updateDoc } = await import('firebase/firestore');
  await updateDoc(userRef, {
    email: result.user.email,
    displayName: result.user.displayName || '',
  });

  return mapUser(result.user);
}

/**
 * Upgrade an anonymous account to an email/password account.
 */
export async function linkWithEmail(email: string, password: string): Promise<BrickUser> {
  const auth = getFirebaseAuth();
  if (!auth.currentUser) throw new Error('No current user to link');

  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(auth.currentUser, credential);

  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', result.user.uid);
  const { updateDoc } = await import('firebase/firestore');
  await updateDoc(userRef, {
    email: result.user.email,
  });

  return mapUser(result.user);
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
