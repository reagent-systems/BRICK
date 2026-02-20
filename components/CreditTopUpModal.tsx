/**
 * Credit Top Up Modal
 *
 * Two modes:
 *   1. ONBOARDING (first time): Step-by-step walkthrough explaining credits
 *   2. QUICK BUY (returning): Straight to tier selection + pay
 *
 * Auto-triggered when a paid action fails due to insufficient credits,
 * or manually opened from the credits bar.
 */

import React, { useState, useEffect } from 'react';
import {
  X, Zap, ExternalLink, Loader2, ArrowRight,
  Coins, Shield, Globe, LinkIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isFirebaseConfigured } from '../services/firebaseConfig';
import { ensureAuthenticated, isAnonymousUser, linkWithGoogle } from '../services/authService';
import { subscribeToCredits } from '../services/creditService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Tier {
  id: string;
  dollars: number;
  credits: number;
  label: string;
}

interface CreditTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ONBOARDING_SEEN_KEY = 'brick_credit_onboarding_seen';

const DEFAULT_TIERS: Tier[] = [
  { id: 'tier_5', dollars: 5, credits: 50, label: '$5 \u2192 50 credits' },
  { id: 'tier_10', dollars: 10, credits: 100, label: '$10 \u2192 100 credits' },
  { id: 'tier_20', dollars: 20, credits: 220, label: '$20 \u2192 220 credits (10% bonus)' },
];

// ─── Component ───────────────────────────────────────────────────────────────

const CreditTopUpModal: React.FC<CreditTopUpModalProps> = ({ isOpen, onClose, reason }) => {
  const { user, isAuthenticated } = useAuth();
  const [credits, setCredits] = useState(0);

  // Determine if this is the first time
  const [hasSeenOnboarding] = useState(() => localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true');
  const [step, setStep] = useState(hasSeenOnboarding ? 4 : 1); // Skip to buy step if returning

  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  // Subscribe to credits (only when Firebase is configured and user exists)
  useEffect(() => {
    if (!isFirebaseConfigured() || !isAuthenticated || !user) return;
    return subscribeToCredits(user.uid, setCredits);
  }, [isAuthenticated, user]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(hasSeenOnboarding ? 4 : 1);
      setSelectedTier(null);
      setPurchaseError(null);
      setPurchaseSuccess(false);
    }
  }, [isOpen, hasSeenOnboarding]);

  const handleSkipOnboarding = () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    setStep(4);
  };

  const handleNextStep = () => {
    if (step < 4) {
      setStep(step + 1);
    }
    if (step === 3) {
      localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    }
  };

  const handlePurchase = async () => {
    if (!selectedTier) return;
    setPurchasing(true);
    setPurchaseError(null);

    try {
      if (isFirebaseConfigured()) {
        await ensureAuthenticated();
      }

      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { getFirebaseApp } = await import('../services/firebaseConfig');
      const functions = getFunctions(getFirebaseApp());
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');

      const result = await createCheckoutSession({
        tierId: selectedTier,
        successUrl: window.location.origin,
        cancelUrl: window.location.origin,
      });

      const data = result.data as { url?: string };
      if (data.url) {
        window.open(data.url, '_blank');
        setPurchaseSuccess(true);
        setStep(5);
      } else {
        setPurchaseError('Failed to create checkout session');
      }
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPurchasing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 font-mono">
      <div className="bg-df-black border border-df-border w-full max-w-md mx-4 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-df-border shrink-0">
          <h2 className="text-xs font-bold text-df-white uppercase tracking-widest flex items-center gap-2">
            <Coins size={14} className="text-df-orange" />
            {step <= 3 ? 'HOW CREDITS WORK' : step === 5 ? 'PAYMENT STARTED' : 'TOP UP CREDITS'}
          </h2>
          <button onClick={onClose} className="text-df-gray hover:text-df-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        {step <= 3 && (
          <div className="h-1 bg-df-border shrink-0">
            <div
              className="h-full bg-df-orange transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-6">

          {/* ── Step 1: Why credits? ── */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {reason && (
                <div className="bg-df-orange/10 border border-df-orange/30 p-3">
                  <p className="text-[10px] text-df-orange">{reason}</p>
                </div>
              )}
              <div className="text-center">
                <div className="w-16 h-16 bg-df-orange/10 border-2 border-df-orange flex items-center justify-center mx-auto mb-4">
                  <Coins size={32} className="text-df-orange" />
                </div>
                <h3 className="text-lg font-black text-df-white uppercase mb-2">Credits</h3>
                <p className="text-xs text-df-gray leading-relaxed">
                  BRICK uses credits to cover the cost of external APIs like X, Reddit, and Discord. Each action that hits a paid API costs 1 credit.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: What costs credits? ── */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-sm font-bold text-df-white uppercase">What costs credits</h3>
              <div className="space-y-2">
                {[
                  { label: 'Post to X / Reddit / Discord', cost: '1 CR' },
                  { label: 'Fetch feedback from X / Reddit / Discord', cost: '1 CR' },
                  { label: 'Import X post history', cost: '1 CR' },
                  { label: 'AI drafts without own Gemini key', cost: '1 CR' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center bg-[#111] border border-df-border p-3">
                    <span className="text-[10px] text-df-gray">{item.label}</span>
                    <span className="text-[10px] text-df-orange font-bold">{item.cost}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-df-border pt-3">
                <h4 className="text-[10px] text-green-500 font-bold uppercase mb-2">Always free</h4>
                <div className="text-[10px] text-df-gray space-y-1">
                  <div>AI drafts with your own Gemini key</div>
                  <div>Email posting</div>
                  <div>MCP server, Git watcher, File watcher</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: No account needed ── */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#111] border-2 border-df-border flex items-center justify-center mx-auto mb-4">
                  <Shield size={32} className="text-df-gray" />
                </div>
                <h3 className="text-sm font-bold text-df-white uppercase mb-2">No account required</h3>
                <p className="text-xs text-df-gray leading-relaxed mb-4">
                  You can buy credits without creating an account. Payment is handled securely through Stripe. Credits are stored on this device.
                </p>
                <div className="bg-[#111] border border-df-border border-dashed p-3">
                  <p className="text-[9px] text-df-gray">
                    <span className="text-df-orange font-bold">Optional:</span> Link a Google or email account later to sync credits across all your devices.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Tier Selection (Quick Buy) ── */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Balance */}
              <div className="flex items-center justify-between bg-[#111] border border-df-border p-3">
                <span className="text-[10px] text-df-gray uppercase">Balance</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-df-white">{credits}</span>
                  <span className="text-[10px] font-bold text-df-orange">CR</span>
                </div>
              </div>

              {reason && (
                <div className="bg-red-900/20 border border-red-700/30 p-3">
                  <p className="text-[10px] text-red-400">{reason}</p>
                </div>
              )}

              {/* Tiers */}
              <div className="space-y-2">
                {DEFAULT_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id === selectedTier ? null : tier.id)}
                    className={`w-full p-3 border text-left transition-all flex items-center justify-between ${
                      selectedTier === tier.id
                        ? 'border-df-orange bg-df-orange/10'
                        : 'border-df-border bg-[#111] hover:border-df-gray'
                    }`}
                  >
                    <div>
                      <div className="text-xs text-df-white font-bold">{tier.credits} Credits</div>
                      <div className="text-[9px] text-df-gray mt-0.5">{tier.label}</div>
                    </div>
                    <div className="text-sm font-black text-df-orange">${tier.dollars}</div>
                  </button>
                ))}
              </div>

              {purchaseError && (
                <div className="text-[9px] text-red-400 bg-red-900/20 border border-red-700/30 p-2">
                  {purchaseError}
                </div>
              )}
            </div>
          )}

          {/* ── Step 5: Success ── */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in duration-300 text-center py-4">
              <div className="w-16 h-16 bg-green-900/20 border-2 border-green-600 flex items-center justify-center mx-auto">
                <Zap size={32} className="text-green-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-df-white uppercase mb-2">Payment started</h3>
                <p className="text-xs text-df-gray leading-relaxed">
                  Complete your payment in the Stripe tab. Credits will be added automatically once payment is confirmed.
                </p>
              </div>

              {/* Link account hint */}
              {isAnonymousUser() && (
                <div className="bg-[#111] border border-df-border border-dashed p-3 text-left">
                  <p className="text-[9px] text-df-gray mb-2">
                    Want to use credits on other devices?
                  </p>
                  <button
                    onClick={async () => {
                      try { await linkWithGoogle(); } catch (e) { console.error(e); }
                    }}
                    className="text-[9px] text-df-orange hover:text-df-white uppercase font-bold flex items-center gap-1"
                  >
                    <LinkIcon size={10} /> Link Google Account
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-df-border shrink-0">
          {/* Onboarding steps (1-3): Next + Skip */}
          {step <= 3 && (
            <div className="flex">
              <button
                onClick={handleSkipOnboarding}
                className="w-1/3 py-4 text-df-gray hover:text-white border-r border-df-border text-[10px] font-bold uppercase"
              >
                Skip
              </button>
              <button
                onClick={handleNextStep}
                className="flex-grow py-4 bg-df-white text-black hover:bg-df-orange text-[10px] font-bold uppercase flex items-center justify-center gap-2"
              >
                {step === 3 ? 'GET CREDITS' : 'NEXT'} <ArrowRight size={12} />
              </button>
            </div>
          )}

          {/* Buy step (4): Pay button */}
          {step === 4 && (
            <div className="p-4">
              <button
                onClick={handlePurchase}
                disabled={!selectedTier || purchasing}
                className={`w-full py-3 text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-2 ${
                  selectedTier && !purchasing
                    ? 'bg-df-orange text-df-black hover:bg-white'
                    : 'bg-[#222] text-df-gray cursor-not-allowed'
                }`}
              >
                {purchasing ? (
                  <><Loader2 size={12} className="animate-spin" /> Processing...</>
                ) : (
                  <><ExternalLink size={12} /> Pay with Stripe</>
                )}
              </button>
              <p className="text-[8px] text-df-gray text-center mt-2">
                Secure payment via Stripe. No account required.
              </p>
            </div>
          )}

          {/* Success step (5): Done */}
          {step === 5 && (
            <div className="p-4">
              <button
                onClick={onClose}
                className="w-full py-3 bg-df-white text-black text-[10px] font-bold uppercase hover:bg-df-gray transition-colors"
              >
                DONE
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditTopUpModal;
