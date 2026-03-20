"use strict";
/**
 * BRICK Cloud Functions
 *
 * - createCheckoutSession: Creates a Stripe Checkout session for credit purchase
 * - stripeWebhook: Handles Stripe webhook events (payment success → add credits)
 * - getPricingTiers: Returns current pricing tiers from Firestore
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.createCheckoutSession = exports.getPricingTiers = void 0;
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
admin.initializeApp();
const db = admin.firestore();
// Secrets (set via firebase functions:secrets:set)
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET");
const stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
// ─── Credit Tiers ────────────────────────────────────────────────────────────
const DEFAULT_TIERS = [
    { id: "tier_5", dollars: 5, credits: 50, label: "$5 → 50 credits" },
    { id: "tier_10", dollars: 10, credits: 100, label: "$10 → 100 credits" },
    { id: "tier_20", dollars: 20, credits: 220, label: "$20 → 220 credits (10% bonus)" },
];
async function getTiers() {
    var _a;
    try {
        const doc = await db.collection("config").doc("pricing").get();
        if (doc.exists && ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.tiers)) {
            return doc.data().tiers;
        }
    }
    catch (_b) {
        // Fall through to defaults
    }
    return DEFAULT_TIERS;
}
// ─── getPricingTiers ─────────────────────────────────────────────────────────
exports.getPricingTiers = (0, https_1.onCall)({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    }
    return getTiers();
});
// ─── createCheckoutSession ───────────────────────────────────────────────────
const DEFAULT_SUCCESS_URL = "https://brick.reagent-systems.com/payment-success";
const DEFAULT_CANCEL_URL = "https://brick.reagent-systems.com/payment-cancelled";
function isValidRedirectUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== "http:" && u.protocol !== "https:")
            return false;
        return u.hostname.length > 0;
    }
    catch (_a) {
        return false;
    }
}
exports.createCheckoutSession = (0, https_1.onCall)({ secrets: [stripeSecretKey], cors: true }, async (request) => {
    var _a, _b, _c;
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "Must be signed in to purchase credits");
        }
        const uid = request.auth.uid;
        const data = request.data;
        const tierId = data.tierId;
        if (!tierId) {
            throw new https_1.HttpsError("invalid-argument", "tierId is required");
        }
        const tiers = await getTiers();
        const tier = tiers.find((t) => t.id === tierId);
        if (!tier) {
            throw new https_1.HttpsError("not-found", `Tier '${tierId}' not found`);
        }
        const stripe = new stripe_1.default(stripeSecretKey.value());
        // Get or create Stripe customer
        const userRef = db.collection("users").doc(uid);
        const userDoc = await userRef.get();
        let stripeCustomerId = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.stripeCustomerId;
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: ((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.email) || request.auth.token.email || undefined,
                metadata: { firebaseUid: uid },
            });
            stripeCustomerId = customer.id;
            await userRef.set({ stripeCustomerId }, { merge: true });
        }
        const successUrl = (data.successUrl && isValidRedirectUrl(data.successUrl)) ? data.successUrl : DEFAULT_SUCCESS_URL;
        const cancelUrl = (data.cancelUrl && isValidRedirectUrl(data.cancelUrl)) ? data.cancelUrl : DEFAULT_CANCEL_URL;
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
            success_url: successUrl,
            cancel_url: cancelUrl,
        });
        return { sessionId: session.id, url: session.url };
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error("[createCheckoutSession]", err);
        throw new https_1.HttpsError("internal", (_c = err === null || err === void 0 ? void 0 : err.message) !== null && _c !== void 0 ? _c : "Payment setup failed");
    }
});
// ─── stripeWebhook ───────────────────────────────────────────────────────────
exports.stripeWebhook = (0, https_2.onRequest)({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
    var _a, _b;
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    const stripe = new stripe_1.default(stripeSecretKey.value());
    let event;
    try {
        const sig = req.headers["stripe-signature"];
        event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret.value());
    }
    catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const uid = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.firebaseUid;
        const credits = parseInt(((_b = session.metadata) === null || _b === void 0 ? void 0 : _b.credits) || "0", 10);
        if (!uid || credits <= 0) {
            console.error("Missing metadata in checkout session:", session.id);
            res.status(400).send("Missing metadata");
            return;
        }
        const userRef = db.collection("users").doc(uid);
        try {
            await db.runTransaction(async (transaction) => {
                var _a, _b;
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error(`User ${uid} not found`);
                }
                const currentCredits = (_b = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.credits) !== null && _b !== void 0 ? _b : 0;
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
        }
        catch (err) {
            console.error("Failed to add credits:", err);
            res.status(500).send("Failed to process payment");
            return;
        }
    }
    res.json({ received: true });
});
//# sourceMappingURL=index.js.map