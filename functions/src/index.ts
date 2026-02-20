/**
 * BRICK Cloud Functions
 *
 * - createCheckoutSession: Creates a Stripe Checkout session for credit purchase
 * - stripeWebhook: Handles Stripe webhook events (payment success → add credits)
 * - getPricingTiers: Returns current pricing tiers from Firestore
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Stripe from "stripe";

admin.initializeApp();
const db = admin.firestore();

// Secrets (set via firebase functions:secrets:set)
const stripeSecretKey = defineSecret("STRIPE_SECRET");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// ─── Credit Tiers ────────────────────────────────────────────────────────────

const DEFAULT_TIERS = [
  { id: "tier_5", dollars: 5, credits: 50, label: "$5 → 50 credits" },
  { id: "tier_10", dollars: 10, credits: 100, label: "$10 → 100 credits" },
  { id: "tier_20", dollars: 20, credits: 220, label: "$20 → 220 credits (10% bonus)" },
];

async function getTiers() {
  try {
    const doc = await db.collection("config").doc("pricing").get();
    if (doc.exists && doc.data()?.tiers) {
      return doc.data()!.tiers;
    }
  } catch {
    // Fall through to defaults
  }
  return DEFAULT_TIERS;
}

// ─── getPricingTiers ─────────────────────────────────────────────────────────

export const getPricingTiers = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }
  return getTiers();
});

// ─── createCheckoutSession ───────────────────────────────────────────────────

export const createCheckoutSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to purchase credits");
    }

    const uid = request.auth.uid;
    const data = request.data as { tierId?: string; successUrl?: string; cancelUrl?: string };
    const tierId = data.tierId;

    if (!tierId) {
      throw new HttpsError("invalid-argument", "tierId is required");
    }

    const tiers = await getTiers();
    const tier = tiers.find((t: any) => t.id === tierId);
    if (!tier) {
      throw new HttpsError("not-found", `Tier '${tierId}' not found`);
    }

    const stripe = new Stripe(stripeSecretKey.value());

    // Get or create Stripe customer
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    let stripeCustomerId = userDoc.data()?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userDoc.data()?.email || request.auth.token.email || undefined,
        metadata: { firebaseUid: uid },
      });
      stripeCustomerId = customer.id;
      await userRef.update({ stripeCustomerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `BRICK Credits: ${tier.credits} CR`,
              description: tier.label,
            },
            unit_amount: tier.dollars * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        firebaseUid: uid,
        tierId: tier.id,
        credits: tier.credits.toString(),
      },
      success_url: data.successUrl || "https://brick.reagent-systems.com/payment-success",
      cancel_url: data.cancelUrl || "https://brick.reagent-systems.com/payment-cancelled",
    });

    return { sessionId: session.id, url: session.url };
  }
);

// ─── stripeWebhook ───────────────────────────────────────────────────────────

export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const stripe = new Stripe(stripeSecretKey.value());

    let event: Stripe.Event;
    try {
      const sig = req.headers["stripe-signature"] as string;
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.firebaseUid;
      const credits = parseInt(session.metadata?.credits || "0", 10);

      if (!uid || credits <= 0) {
        console.error("Missing metadata in checkout session:", session.id);
        res.status(400).send("Missing metadata");
        return;
      }

      const userRef = db.collection("users").doc(uid);
      try {
        await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) {
            throw new Error(`User ${uid} not found`);
          }
          const currentCredits = userDoc.data()?.credits ?? 0;
          transaction.update(userRef, { credits: currentCredits + credits });
        });

        await db.collection("users").doc(uid).collection("transactions").add({
          type: "purchase",
          amount: credits,
          cost: (session.amount_total || 0) / 100,
          description: `Purchased ${credits} credits`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          stripeSessionId: session.id,
        });

        console.log(`Added ${credits} credits to user ${uid} (session: ${session.id})`);
      } catch (err) {
        console.error("Failed to add credits:", err);
        res.status(500).send("Failed to process payment");
        return;
      }
    }

    res.json({ received: true });
  }
);
