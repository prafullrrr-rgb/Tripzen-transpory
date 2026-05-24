# TripZen — Native Build Guide (EAS)

The web preview is great for UI iteration, but a **native build** is required to test:
- Real Stripe PaymentSheet
- Push notifications delivery
- Background GPS tracking
- NFC tag scanning

## 1) Install EAS CLI

```bash
npm install -g eas-cli
eas login          # Expo account
```

## 2) Initialise the project once

From `/app/frontend`:

```bash
eas init           # creates the EAS project + sets app.json extra.eas.projectId
```

This also writes the project id needed by `expo-notifications` to register push tokens.

## 3) Set production secrets (optional, server side already supports mocked fallback)

```bash
# Stripe (real charges)
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_live_xxx

# Server-side env (set on your backend host, not EAS):
#   STRIPE_SECRET_KEY=sk_live_xxx
#   TWILIO_ACCOUNT_SID=ACxxxxx
#   TWILIO_AUTH_TOKEN=xxxxx
#   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

## 4) Build

```bash
# Internal preview build (APK + ipa) — easiest for QA
eas build --profile preview --platform all

# Development client build (lets you hot-reload code on a real device)
eas build --profile development --platform all

# Store-ready production build
eas build --profile production --platform all
```

EAS uploads a build artifact in ~10–15 minutes and gives you an install link / QR.

## 5) Install on device

- **Android**: scan the QR or download the `.apk`, install (allow "Install from unknown sources").
- **iOS**: open the EAS link on the device → Install (works for TestFlight or ad-hoc).

## 6) Validate native features (after install)

| Feature | How to test |
|---|---|
| Stripe PaymentSheet | Parent → Book Trip → Pay with Stripe → real sheet opens with cards (set `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` test key first). |
| Push notifications | Sign in as parent → on driver device scan a child → parent should receive a banner notification. |
| Background GPS | Driver → Start trip → toggle "Track in background" → background out of app → location updates keep flowing to backend (`/api/trips/.../location`) every 5–10s. |
| NFC scanning | Driver scan screen → tap "Scan NFC badge" → hold phone near NDEF tag containing TRIPZEN-XXXXXXXX → student boards. |

## 7) Submit to stores (when ready)

```bash
eas submit -p ios   --profile production
eas submit -p android --profile production
```

---

## Key files

- `/app/frontend/eas.json` — build profiles
- `/app/frontend/app.json` — permissions, plugin configs, infoPlist strings
- `/app/backend/.env` — server secrets (STRIPE_SECRET_KEY, TWILIO_*, EMERGENT_LLM_KEY)
