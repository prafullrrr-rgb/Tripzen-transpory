# TripZen — Native Build Guide (EAS)

✅ **Pre-flight status (verified by main agent):** All 18 expo-doctor checks pass.
- Icons fixed to 1024×1024
- App config schema validates
- Native dependencies de-duplicated
- NFC warning suppressed (untested-on-new-arch is acceptable)

The web preview is great for UI iteration, but a **native build** is required to test:
- Real Stripe PaymentSheet
- Push notifications delivery
- Background GPS tracking
- NFC tag scanning

## 1) Install EAS CLI on your machine (one-time)

```bash
npm install -g eas-cli
eas login          # use your Expo account
```

## 2) Clone this codebase locally (if you haven't)

This Emergent environment cannot run `eas build` itself — the build runs on Expo's servers and needs your interactive login. Pull the code locally:

```bash
git clone <your-emergent-repo>   # or download via Emergent UI
cd <repo>/frontend
yarn install
```

## 3) Link the project to your Expo account

```bash
eas init           # creates the EAS project, writes app.json extra.eas.projectId
```

This project id is what `expo-notifications` uses to mint push tokens for parents.

## 4) (Optional) Add live secrets

```bash
# Stripe (real charges) — get this from https://dashboard.stripe.com/apikeys
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_test_xxx

# Server-side env (configure on YOUR backend host, not EAS):
#   STRIPE_SECRET_KEY=sk_test_xxx
#   TWILIO_ACCOUNT_SID=ACxxxxx
#   TWILIO_AUTH_TOKEN=xxxxx
#   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Without these the app still works — Stripe falls back to mock pay, WhatsApp returns `mocked:true`.

## 5) 🚀 Build it

```bash
# Internal preview (.apk + .ipa) — easiest for QA on real devices
eas build --profile preview --platform all

# Development client (lets you hot-reload code on a real device)
eas build --profile development --platform all

# Store-ready production
eas build --profile production --platform all
```

⏱ EAS takes **10–15 minutes** per platform and emails you an install link + QR.

## 6) Install on device

- **Android**: scan the QR or download the `.apk`, install (allow "Install from unknown sources").
- **iOS**: open the EAS link → Install (TestFlight or ad-hoc).

## 7) Validate native features (after install)

| Feature | How to test |
|---|---|
| Stripe PaymentSheet | Parent → Book Trip → Pay with Stripe → real sheet opens with cards. |
| Push notifications | Parent logs in → in another device, driver scans a child → parent gets a banner. |
| Background GPS | Driver → Start trip → toggle "Track in background" → background out of app → GPS still streams. |
| NFC scanning | Driver scan screen → tap "Scan NFC badge" → tap NDEF tag with `TRIPZEN-XXXXXXXX` → student boards. |
| WebSocket live map | Parent home shows green LIVE chip while driver trip is active; bus marker moves in real-time. |
| Chat support | Parent/Driver Account → "Chat with Support" → message lands in admin's inbox. |

## 8) Submit to stores (when ready)

```bash
eas submit -p ios   --profile production
eas submit -p android --profile production
```

---

## Key files

- `/app/frontend/eas.json` — build profiles (development / preview / production)
- `/app/frontend/app.json` — permissions, plugin configs, infoPlist strings
- `/app/backend/.env` — server secrets (STRIPE_SECRET_KEY, TWILIO_*, EMERGENT_LLM_KEY)
