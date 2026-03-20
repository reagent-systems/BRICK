/**
 * Credit Gate
 *
 * Utility to check and deduct credits before paid API calls.
 * Determines whether an action costs credits based on the platform.
 *
 * Credit rules:
 *   COSTS CREDITS: X, Reddit, Discord API calls (post, fetch feedback, import)
 *   COSTS CREDITS: AI generation without own key (using Firebase AI)
 *   FREE: Email posting, MCP, Git, File Watcher, AI with own key
 */

import { getAuth } from 'firebase/auth';
import { isFirebaseConfigured, getFirebaseApp } from './firebaseConfig';
import { deductCredits, hasEnoughCredits } from './creditService';
import { ensureAuthenticated } from './authService';

type PaidPlatform = 'x' | 'reddit' | 'discord';

const PAID_PLATFORMS = new Set<string>(['x', 'reddit', 'discord']);

/**
 * Check if an action on a given platform costs credits.
 */
export function costsCreditForPlatform(platform: string): boolean {
  return PAID_PLATFORMS.has(platform);
}

/**
 * Gate a paid API action behind credits.
 * If the platform is paid, checks credits, deducts 1, and returns true.
 * If insufficient credits, returns false with an error message.
 * If the platform is free (email), returns true without deducting.
 *
 * Automatically creates an anonymous Firebase account if needed.
 */
export async function requireCredits(
  platform: string,
  description: string,
  amount: number = 1
): Promise<{ allowed: boolean; error?: string }> {
  // Free platforms don't need credits
  if (!PAID_PLATFORMS.has(platform)) {
    return { allowed: true };
  }

  // Firebase must be configured for credit tracking
  if (!isFirebaseConfigured()) {
    return {
      allowed: false,
      error: 'Credits require Firebase. Configure Firebase in settings or use a free platform (email).',
    };
  }

  try {
    // Ensure user is authenticated (anonymous or otherwise)
    const uid = await ensureAuthenticated();

    // Check balance
    const enough = await hasEnoughCredits(uid, amount);
    if (!enough) {
      // Dispatch event to auto-open the top-up modal
      window.dispatchEvent(new CustomEvent('brick:credits-needed', {
        detail: { reason: `You need credits to ${description.toLowerCase()}.` },
      }));
      return {
        allowed: false,
        error: 'Insufficient credits.',
      };
    }

    // Deduct
    const success = await deductCredits(uid, amount, description);
    if (!success) {
      return {
        allowed: false,
        error: 'Failed to deduct credits. Please try again.',
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('[CreditGate] Error:', error);
    return {
      allowed: false,
      error: error instanceof Error ? error.message : 'Credit check failed',
    };
  }
}

/**
 * Refund credits if an action fails after deduction.
 */
export async function refundCredits(amount: number = 1, description: string = 'Refund: action failed'): Promise<void> {
  if (!isFirebaseConfigured()) return;

  try {
    const auth = getAuth(getFirebaseApp());
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const { addCredits } = await import('./creditService');
    await addCredits(uid, amount, description);
  } catch (error) {
    console.error('[CreditGate] Refund failed:', error);
  }
}
