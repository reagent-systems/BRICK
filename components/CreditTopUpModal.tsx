/**
 * Credit Top Up Modal
 *
 * Shows available credit tiers, lets the user pick one,
 * and redirects to Stripe Checkout for payment.
 */

import React, { useState, useEffect } from 'react';
import { X, Zap, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isFirebaseConfigured } from '../services/firebaseConfig';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '../services/firebaseConfig';

interface Tier {
  id: string;
  dollars: number;
  credits: number;
  label: string;
}

interface CreditTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
}

const DEFAULT_TIERS: Tier[] = [
  { id: 'tier_5', dollars: 5, credits: 50, label: '$5 → 50 credits' },
  { id: 'tier_10', dollars: 10, credits: 100, label: '$10 → 100 credits' },
  { id: 'tier_20', dollars: 20, credits: 220, label: '$20 → 220 credits (10% bonus)' },
];

const CreditTopUpModal: React.FC<CreditTopUpModalProps> = ({ isOpen, onClose, currentCredits }) => {
  const { user, isAuthenticated } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tiers from Cloud Functions
  useEffect(() => {
    if (!isOpen || !isFirebaseConfigured() || !isAuthenticated) return;

    const fetchTiers = async () => {
      try {
        const functions = getFunctions(getFirebaseApp());
        const getPricingTiers = httpsCallable(functions, 'getPricingTiers');
        const result = await getPricingTiers();
        if (Array.isArray(result.data)) {
          setTiers(result.data as Tier[]);
        }
      } catch {
        // Use default tiers if fetch fails
      }
    };
    fetchTiers();
  }, [isOpen, isAuthenticated]);

  const handlePurchase = async () => {
    if (!selectedTier || !isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const functions = getFunctions(getFirebaseApp());
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');

      const result = await createCheckoutSession({
        tierId: selectedTier,
        successUrl: window.location.origin,
        cancelUrl: window.location.origin,
      });

      const data = result.data as { url?: string; sessionId?: string };

      if (data.url) {
        // Redirect to Stripe Checkout
        window.open(data.url, '_blank');
        onClose();
      } else {
        setError('Failed to create checkout session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 font-mono">
      <div className="bg-df-black border border-df-border w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-df-border">
          <h2 className="text-xs font-bold text-df-white uppercase tracking-widest flex items-center gap-2">
            <Zap size={14} className="text-df-orange" /> TOP UP CREDITS
          </h2>
          <button onClick={onClose} className="text-df-gray hover:text-df-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Current balance */}
        <div className="p-4 border-b border-df-border bg-[#111]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-df-gray uppercase">Current Balance</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-df-white">{currentCredits}</span>
              <span className="text-[10px] font-bold text-df-orange">CR</span>
            </div>
          </div>
        </div>

        {/* Not authenticated */}
        {!isAuthenticated && (
          <div className="p-6 text-center">
            <p className="text-xs text-df-gray mb-4">
              Sign in to purchase credits. Go to Settings → Account.
            </p>
          </div>
        )}

        {/* Tier selection */}
        {isAuthenticated && (
          <div className="p-4 space-y-3">
            <p className="text-[10px] text-df-gray uppercase mb-3">Select a package</p>

            {tiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
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

            {error && (
              <div className="text-[9px] text-red-400 bg-red-900/20 border border-red-700/30 p-2">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {isAuthenticated && (
          <div className="p-4 border-t border-df-border">
            <button
              onClick={handlePurchase}
              disabled={!selectedTier || loading}
              className={`w-full py-3 text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2 ${
                selectedTier && !loading
                  ? 'bg-df-orange text-df-black hover:bg-white'
                  : 'bg-[#222] text-df-gray cursor-not-allowed'
              }`}
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Processing...</>
              ) : (
                <><ExternalLink size={14} /> Pay with Stripe</>
              )}
            </button>
            <p className="text-[8px] text-df-gray text-center mt-2">
              Secure payment via Stripe. Credits are added instantly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditTopUpModal;
