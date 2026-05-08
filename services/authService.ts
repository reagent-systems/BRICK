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
  signInWithCredential,
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
import { isElectron } from '../utils/platform';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrickUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

const GOOGLE_OAUTH_STATE_KEY = 'google_oauth_state';

function parseCallbackParams(url: string): URLSearchParams {
  const urlObj = new URL(url);
  const combined = new URLSearchParams(urlObj.search);
  const hashParams = new URLSearchParams(urlObj.hash.startsWith('#') ? urlObj.hash.slice(1) : urlObj.hash);
  hashParams.forEach((value, key) => combined.set(key, value));
  return combined;
}

function getGoogleClientId(): string {
  return (
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    import.meta.env.VITE_FIREBASE_GOOGLE_CLIENT_ID ||
    ''
  );
}

function createRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export async function startGoogleSignInForElectron(): Promise<void> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Google OAuth client ID is missing. Set VITE_GOOGLE_CLIENT_ID.');
  }

  const state = createRandomString(40);
  localStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state);

  const bridgeBase = (import.meta.env.VITE_AUTH_BRIDGE_URL || 'https://brick.reagent-systems.com').replace(/\/+$/, '');
  const authUrl = new URL(`${bridgeBase}/auth/google`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('prompt', 'select_account');

  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.openExternal) {
    throw new Error('Electron shell integration is unavailable.');
  }

  await electronAPI.openExternal(authUrl.toString());
}

export async function handleGoogleOAuthCallback(url: string): Promise<BrickUser> {
  const params = parseCallbackParams(url);

  const error = params.get('error');
  if (error) {
    throw new Error(`Google OAuth error: ${error}`);
  }

  const state = params.get('state');
  const expectedState = localStorage.getItem(GOOGLE_OAUTH_STATE_KEY);
  localStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
  if (!state || !expectedState || state !== expectedState) {
    throw new Error('Google OAuth state mismatch.');
  }

  const idToken = params.get('id_token');
  const accessToken = params.get('access_token');
  if (!idToken && !accessToken) {
    throw new Error('Google OAuth callback missing token.');
  }

  const auth = getFirebaseAuth();
  const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
  const result = await signInWithCredential(auth, credential);
  await ensureUserDoc(result.user);
  return mapUser(result.user);
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
  if (isElectron()) {
    await startGoogleSignInForElectron();
    throw new Error('Google sign-in started in browser. Finish authentication there.');
  }

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
