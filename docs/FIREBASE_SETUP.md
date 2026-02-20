# Firebase setup checklist (brick-by-reagent)

Use this after creating or switching to the **brick-by-reagent** Firebase project.

---

## 1. Firestore

- **Create the database**  
  Firebase Console → **Firestore** → Create database (production mode; rules will lock down access).
- **Deploy rules** (from project root):
  ```bash
  firebase use brick-by-reagent
  firebase deploy --only firestore:rules
  ```
- **Optional:** Create a `config/pricing` document with a `tiers` array if you want to override the default credit tiers (same shape as in your Cloud Functions).

---

## 2. Authentication

- **Enable sign-in methods**  
  Firebase Console → **Authentication** → Sign-in method:
  - **Google** (for passkey / Google sign-in).
  - **Email/Password** if you use it.
  - **Anonymous** (for “pay without account” / credits without a full account).
- **Authorized domains**  
  Add every origin where the app runs (e.g. `localhost`, `reagent-systems.com`). For Electron, the custom scheme is handled by the app; no extra domain needed for `brick://`.

---

## 3. Cloud Functions (Stripe & credits)

- **Blaze plan**  
  Required for Cloud Functions (and for Firebase AI below).
- **Deploy functions:**
  ```bash
  firebase use brick-by-reagent
  cd functions && npm install && npm run build
  cd .. && firebase deploy --only functions
  ```
- **Secrets** (so Stripe works):
  ```bash
  firebase functions:secrets:set STRIPE_SECRET
  firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
  ```
  Use your Stripe **secret key** and the **webhook signing secret** from Stripe.
- **Stripe webhook**  
  In Stripe Dashboard → Developers → Webhooks:
  - Add endpoint: `https://us-central1-brick-by-reagent.cloudfunctions.net/stripeWebhook` (or your function URL after first deploy).
  - Events: `checkout.session.completed`.
  - Copy the **signing secret** and set it as `STRIPE_WEBHOOK_SECRET` above (then redeploy if you already deployed).

---

## 4. Firebase AI (Gemini) – for BRICK AI when user has no key

- **Enable**  
  Firebase Console → **Build** → **AI** (or your project’s AI / Gemini section) and enable Firebase AI / Gemini for the project.  
  If you use Google Cloud directly: enable **Generative Language API** (and optionally Vertex AI) for project **brick-by-reagent** and ensure the Blaze plan is active so the API can be used.

---

## 5. Quick verification

- **Auth:** Sign in with Google (and passkey) in the Electron app; confirm redirect back to the app works.
- **Credits:** Open “Top up credits”, pick a tier, complete Stripe Checkout; confirm balance updates and that the webhook runs in Stripe.
- **Firebase AI:** Sign in, don’t set a Gemini key, generate a draft and confirm it uses Firebase AI and that credits decrease.
