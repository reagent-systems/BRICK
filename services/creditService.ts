/**
 * Credit Service
 *
 * Manages user credits: real-time subscription, deduction, purchase.
 * Credits are stored in Firestore at users/{uid}/credits.
 */

import {
  doc,
  onSnapshot,
  runTransaction,
  collection,
  addDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from './firebaseConfig';

// ─── Real-time Credit Subscription ──────────────────────────────────────────

/**
 * Subscribe to a user's credit balance in real-time.
 * Returns an unsubscribe function.
 */
export function subscribeToCredits(uid: string, callback: (credits: number) => void): Unsubscribe {
  if (!isFirebaseConfigured()) {
    callback(0);
    return () => {};
  }

  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', uid);

  return onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data().credits ?? 0);
    } else {
      callback(0);
    }
  }, (error) => {
    console.error('[Credits] Subscription error:', error);
    callback(0);
  });
}

// ─── Credit Check & Deduction ────────────────────────────────────────────────

/**
 * Check if a user has enough credits.
 */
export async function hasEnoughCredits(uid: string, amount: number = 1): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', uid);

  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(userRef);
  if (!snap.exists()) return false;

  return (snap.data().credits ?? 0) >= amount;
}

/**
 * Deduct credits from a user's balance atomically.
 * Returns true if successful, false if insufficient credits.
 */
export async function deductCredits(
  uid: string,
  amount: number = 1,
  description: string = 'Draft generation'
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', uid);

  try {
    const success = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) return false;

      const currentCredits = userDoc.data().credits ?? 0;
      const totalUsed = userDoc.data().totalCreditsUsed ?? 0;

      if (currentCredits < amount) return false;

      transaction.update(userRef, {
        credits: currentCredits - amount,
        totalCreditsUsed: totalUsed + amount,
      });

      return true;
    });

    if (success) {
      // Log the transaction (non-critical, don't block on it)
      const txRef = collection(db, 'users', uid, 'transactions');
      addDoc(txRef, {
        type: 'usage',
        amount: -amount,
        description,
        timestamp: serverTimestamp(),
      }).catch((err) => console.error('[Credits] Failed to log transaction:', err));
    }

    return success;
  } catch (error) {
    console.error('[Credits] Deduction error:', error);
    return false;
  }
}

/**
 * Add credits to a user's balance (called by Cloud Function webhook, or manually).
 */
export async function addCredits(
  uid: string,
  amount: number,
  description: string,
  stripeSessionId?: string
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', uid);

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) return;

      const currentCredits = userDoc.data().credits ?? 0;
      transaction.update(userRef, {
        credits: currentCredits + amount,
      });
    });

    // Log the transaction
    const txRef = collection(db, 'users', uid, 'transactions');
    await addDoc(txRef, {
      type: 'purchase',
      amount,
      description,
      timestamp: serverTimestamp(),
      ...(stripeSessionId && { stripeSessionId }),
    });

    return true;
  } catch (error) {
    console.error('[Credits] Add credits error:', error);
    return false;
  }
}
