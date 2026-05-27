# 🍎 TripZen — iOS Build & Submit Guide

This is your **step-by-step guide** to build TripZen for iPhone/iPad and ship to the App Store.

---

## ⚙️ Configuration Summary

| Setting | Value |
|---|---|
| App Name | **TripZen** |
| Bundle ID | `com.tripzen.app` |
| Slug | `tripzen` |
| Version | `1.0.0` |
| Build Number | `1` (auto-increments in `production` profile) |
| Apple Pay Merchant | `merchant.com.tripzen` |
| Backend URL | `https://app-builder-demo-60.emergent.host` |

---

## 📋 Prerequisites Checklist

- [x] **Apple Developer Account** ($99/year) — you have this ✅
- [ ] **Expo account** — free, sign up at https://expo.dev
- [ ] **Node.js 18+** on your local machine
- [ ] **EAS CLI** installed (`npm install -g eas-cli`)
- [ ] **Bundle ID registered** in Apple Developer Portal (EAS can auto-register, see Step 4)

---

## 🚀 STEP-BY-STEP BUILD PROCESS

> All commands below should run on **your local machine** (not in this cloud environment). You don't need a Mac — EAS builds in the cloud.

### Step 1 — Clone & Install

```bash
# If you haven't pulled the latest code to your machine
git clone <your-repo>
cd <your-repo>/frontend
yarn install
# or: npm install
```

### Step 2 — Install EAS CLI

```bash
npm install -g eas-cli
eas --version   # confirm install
```

### Step 3 — Sign in to Expo

```bash
eas login
# Enter your Expo username + password
```

### Step 4 — Initialize EAS Project (first time only)

```bash
cd frontend
eas init
```
- This creates a project in your Expo dashboard
- It auto-fills `extra.eas.projectId` and `owner` in `app.json`
- ✅ **Commit the updated `app.json` to git**

### Step 5 — (First Build Only) Apple Credentials Setup

When you run your first iOS build, EAS will ask:

```
? Do you want to log in to your Apple account? › (Y/n)
```
**→ Answer `Y`**, then enter:
- Your Apple ID email
- Your Apple ID password
- 2FA code from your iPhone/Mac

EAS will **automatically**:
- Register `com.tripzen.app` as an App ID in your Apple Developer portal
- Generate iOS Distribution Certificate (`.p12`)
- Generate Provisioning Profile (`.mobileprovision`)
- Generate Push Notifications Key (APNs)
- Store everything securely in EAS so future builds reuse them

You **don't** need to manually create anything in Apple Developer Portal — EAS handles it. 🎉

---

## 🏗️ BUILD COMMANDS

### A) Development Build (recommended first build)

For testing **on your physical iPhone** with hot reload + native modules working:

```bash
eas build --profile development --platform ios
```

- Builds an `.ipa` you can install via QR code on your iPhone
- Includes Expo Dev Client (you can reload JS without rebuilding)
- Use this to test **Stripe, NFC, Push, Background GPS** on a real device
- Takes ~10–20 minutes the first time

**To install:** When the build finishes, EAS shows a QR code. Open Camera on iPhone → scan → tap "Install".

---

### B) Preview Build (internal testers, no App Store)

For sharing with QA / beta testers via Ad Hoc:

```bash
eas build --profile preview --platform ios
```

- Internal distribution via QR / link
- Up to ~100 registered devices
- No TestFlight needed

---

### C) Production Build (App Store / TestFlight)

```bash
eas build --profile production --platform ios
```

- Signed for App Store submission
- `buildNumber` auto-increments each build
- This is the `.ipa` you submit to App Store Connect

---

## 📤 SUBMIT TO APP STORE

### Step 6 — Update `eas.json` with your Apple info

Open `frontend/eas.json` and replace placeholders in the `submit.production.ios` section:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-apple-id@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABCDE12345"
    }
  }
}
```

**How to find these values:**
- **`appleId`** → Your Apple Developer login email
- **`appleTeamId`** → https://developer.apple.com/account → Membership → Team ID (10-char)
- **`ascAppId`** → Create the app first in [App Store Connect](https://appstoreconnect.apple.com/apps) → "+" → New App → fill bundle id `com.tripzen.app` → copy the numeric **Apple ID** shown on the App Information page

### Step 7 — Create the App Store Connect Listing

Go to https://appstoreconnect.apple.com → **My Apps** → **+** → **New App**:
- Platform: iOS
- Name: **TripZen**
- Primary Language: English
- Bundle ID: select `com.tripzen.app` (must already exist in Apple Developer Portal, EAS created it for you in Step 5)
- SKU: `tripzen-001` (any unique string)

Fill in:
- App description, keywords, support URL, privacy URL
- Screenshots (6.5" iPhone — 1284×2778, 6.7" iPhone — 1290×2796)
- App icon (1024×1024 PNG, no transparency)
- Privacy Policy URL ⚠️ **REQUIRED** (host on your website)
- Age rating questionnaire
- Pricing & Availability

### Step 8 — Submit the Build

```bash
eas submit --profile production --platform ios --latest
```

EAS uploads your `.ipa` to App Store Connect. Wait ~15 min for Apple processing, then in App Store Connect:
- Select the build under your version
- Click **Submit for Review**
- Apple review takes 24-48 hours typically

---

## 🧪 TestFlight (Beta Testing Before App Store)

Once a production build is uploaded:

1. Go to App Store Connect → your app → **TestFlight** tab
2. Add testers (internal = up to 100, external = up to 10,000 — external needs Apple review)
3. Testers install the **TestFlight** app on iPhone, then tap your invite link

---

## ⚠️ COMMON ISSUES & FIXES

### ❌ "Bundle identifier mismatch"
- Make sure `app.json` → `ios.bundleIdentifier` matches what EAS registered. Currently set to `com.tripzen.app`.

### ❌ "Provisioning profile doesn't include the device"
- Only happens with `preview` builds. Register your test iPhones in [Devices](https://developer.apple.com/account/resources/devices/list) and rebuild.

### ❌ "Missing Push Notification Entitlement"
- Run `eas credentials` → iOS → Push Notifications Key → Generate. Then rebuild.

### ❌ "App icon must not be transparent"
- Ensure `assets/images/icon.png` is 1024×1024 with no alpha channel.

### ❌ "Privacy manifest required"
- Apple now requires `PrivacyInfo.xcprivacy`. EAS auto-generates this for most expo modules. If Apple rejects, see https://docs.expo.dev/guides/apple-privacy/

### ❌ "Missing purpose strings" (ITMS-90683)
- All required `NSXxxUsageDescription` keys are already set in `app.json` for: Camera, Location, NFC, Photo Library, Microphone. ✅

---

## 🔑 STRIPE PRODUCTION KEYS (when ready)

When you're ready to take real payments, set the Stripe **publishable key** as an EAS secret:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_live_xxxxx
```

Then add to each profile in `eas.json`:
```json
"env": {
  "EXPO_PUBLIC_BACKEND_URL": "https://app-builder-demo-60.emergent.host",
  "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "$EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
}
```

And set the **secret key** on your backend (`/app/backend/.env`):
```
STRIPE_SECRET_KEY=sk_live_xxxxx
```

---

## ✅ QUICK COMMAND REFERENCE

| Task | Command |
|---|---|
| Login | `eas login` |
| Link project | `eas init` |
| Dev build (iOS) | `eas build -p ios --profile development` |
| Preview build | `eas build -p ios --profile preview` |
| Production build | `eas build -p ios --profile production` |
| Submit to App Store | `eas submit -p ios --latest` |
| View builds | `eas build:list` |
| View credentials | `eas credentials` |
| Run doctor | `npx expo-doctor` |

---

## 🎯 RECOMMENDED FIRST RUN

If you've never built before, do exactly this in order:

```bash
cd frontend
yarn install
npm install -g eas-cli
eas login
eas init                                         # link project
eas build --profile development --platform ios   # first build
```

When it completes (~15 min), scan the QR code with your iPhone Camera and tap install. You'll be testing **TripZen** on your iPhone with full native features working. 🚀

---

## 📞 Need Help?

- EAS Build docs: https://docs.expo.dev/build/introduction/
- App Store Connect: https://appstoreconnect.apple.com
- Apple Developer: https://developer.apple.com

Built with ❤️ for safe child transport.
