# 🏪 TripZen — App Store Launch Kit

Ready-to-copy content for your App Store Connect listing.

---

## 📝 APP STORE METADATA

### App Name (max 30 chars)
```
TripZen
```

### Subtitle (max 30 chars)
```
Safe Child Bus Transport
```

### Promotional Text (max 170 chars, can update anytime)
```
Track your child's school bus in real-time. Get instant boarding alerts, secure QR check-in, and peace of mind every single ride.
```

### Description (max 4000 chars)
```
TripZen is the all-in-one child transport safety platform trusted by parents, drivers, and schools.

REAL-TIME PEACE OF MIND
• Live GPS tracking — watch your child's bus on the map in real time
• Instant push alerts when your child boards and disembarks
• Estimated arrival times and route history
• Driver and vehicle info at your fingertips

SAFE BOARDING, EVERY TRIP
• Secure QR code badges for each student
• NFC tap-to-board for fast, contactless check-in
• Photo-verified attendance logs
• Multi-child support for families

FOR DRIVERS
• Easy route assignment and turn-by-turn navigation
• One-tap incident reporting with photos
• Background GPS that keeps tracking even when the phone is locked
• Direct in-app chat with parents and admins

FOR SCHOOLS & OPERATORS
• Centralized admin dashboard
• Fleet-wide live monitoring
• Incident management and audit logs
• Booking, billing, and Stripe payments built-in
• Multi-language support (English + more)

WHY TRIPZEN?
✓ End-to-end encrypted data
✓ COPPA & GDPR aware
✓ Built specifically for child transport — not a generic tracker
✓ Used by schools and bus operators across the region

Whether you're a parent waiting at the gate or a school running 50 buses, TripZen brings transparency, accountability, and safety to every trip.

Download today and never wonder where the bus is again.

---
SUPPORT
Questions? In-app chat connects you directly with our team.
Website: https://tripzen.app (replace with your URL)
Privacy: https://tripzen.app/privacy
```

### Keywords (max 100 chars, comma-separated, no spaces between)
```
school bus,child safety,gps tracker,parent app,student transport,bus tracking,qr boarding,nfc,school
```

### Support URL
```
https://tripzen.app/support
```

### Marketing URL (optional)
```
https://tripzen.app
```

### Privacy Policy URL ⚠️ REQUIRED
```
https://tripzen.app/privacy
```

### Category
- **Primary**: Education
- **Secondary**: Travel (or Family — but Family triggers stricter review)

### Age Rating Questionnaire Answers
- Unrestricted Web Access: **No**
- Gambling: **None**
- User-Generated Content: **Yes (chat with moderation)**
- Violence: **None**
- Sexual Content: **None**
- Profanity: **None**
- Horror/Fear Themes: **None**
- Medical Information: **None**
- Frequent/Intense Mature Themes: **None**

Result will be **4+ rating** ✅

---

## 🔐 PRIVACY NUTRITION LABEL (App Store)

When Apple asks "What data does your app collect?" select:

### Data Collected & Linked to User Identity
- **Name** → App Functionality
- **Email** → App Functionality, Account Management
- **Phone Number** → App Functionality
- **Physical Address** (pickup/drop) → App Functionality
- **Precise Location** → App Functionality (during trip)
- **Coarse Location** → App Functionality
- **Photos** → App Functionality (incident reports, profile)
- **User ID** → App Functionality
- **Device ID** → Analytics
- **Payment Info** → Purchases (handled by Stripe, not stored by us)
- **Customer Support** → Customer Support (chat)

### NOT Collected
- Browsing History
- Search History
- Health & Fitness
- Sensitive Info
- Contacts
- Audio Data

---

## 📜 PRIVACY POLICY TEMPLATE

Host this at `https://tripzen.app/privacy` (any static host: Vercel, Netlify, GitHub Pages, your domain). **Mandatory** for App Store approval.

```markdown
# TripZen Privacy Policy
_Last updated: [DATE]_

TripZen ("we", "our", "the App") provides child transport tracking services. This policy explains what data we collect, why, and how we protect it.

## 1. Data We Collect
- **Account info**: name, email, phone number, role (parent / driver / admin)
- **Student info**: name, grade, photo, school, pickup/dropoff address — provided by parent/school
- **Location data**: GPS location of buses during active routes (for live tracking)
- **Boarding logs**: timestamp + bus + student when QR/NFC scanned
- **Payment data**: handled by Stripe; we never store full card numbers
- **Chat & incident reports**: messages, photos, descriptions
- **Device data**: device model, OS version, push notification tokens

## 2. How We Use Data
- Provide real-time bus tracking to authorized parents
- Authenticate users and prevent unauthorized access
- Send push/SMS/email notifications about boarding events
- Process bookings and payments
- Investigate incidents and improve safety

## 3. Children's Data (COPPA)
We do not collect data directly from children under 13. All student information is provided by a parent, guardian, or authorized school administrator.

## 4. Data Sharing
- **Stripe** — payment processing
- **Twilio** — SMS notifications (if enabled)
- **Expo Push Service / Apple APNs / Google FCM** — push notifications
- **Your school / bus operator** — student records & ride history
- We do **not** sell data to third parties.

## 5. Data Retention
- Active accounts: kept while you use the app
- Trip & boarding logs: 12 months
- Payment records: 7 years (legal requirement)
- Deleted on account closure within 30 days, except where law requires retention

## 6. Your Rights (GDPR / CCPA)
- Access, correct, or delete your data — email privacy@tripzen.app
- Export your data in JSON
- Withdraw consent at any time
- Lodge a complaint with your data protection authority

## 7. Security
- TLS 1.2+ for all network traffic
- Passwords hashed with bcrypt
- JWT tokens with short expiry
- Encrypted storage on device (Expo SecureStore)

## 8. Contact
TripZen Privacy Team
privacy@tripzen.app
[Your company address]
```

---

## 🖼️ APP STORE SCREENSHOTS

You need screenshots in **at least these two sizes**:

| Device | Size | Required? |
|---|---|---|
| iPhone 6.7" (Pro Max) | 1290 × 2796 | ✅ Required |
| iPhone 6.5" (Plus) | 1284 × 2778 | ✅ Required |
| iPad 12.9" (if iPad supported) | 2048 × 2732 | ✅ Required (your app supports tablet) |

### Suggested 6 Screenshots (in order)

1. **Onboarding hero** — "Know where your child is, in real time" + map preview
2. **Live tracking map** — bus marker moving along route, student avatar at stop
3. **QR boarding** — driver scanning student badge, success checkmark
4. **Parent dashboard** — list of children, today's status, notifications
5. **Incident reporting** — clean form with photo attach
6. **Multi-language** — show settings screen with EN/FR/AR

### How to Capture
- Run `eas build --profile preview --platform ios`
- Install on a physical iPhone 14/15 Pro Max OR Xcode Simulator (1290×2796 frame)
- Use device screenshots (Power + Vol Up)
- Add text overlays using [Figma](https://figma.com) or [Screenshot Studio](https://screenshot.studio)
- Or use [Fastlane Snapshot](https://docs.fastlane.tools/actions/snapshot/) for automation

---

## ⚙️ STRIPE PRODUCTION SETUP

### Step 1 — Get Your Live Keys
1. Log in to https://dashboard.stripe.com
2. Toggle **"View test data"** OFF (top-right)
3. Go to **Developers → API keys**
4. Copy:
   - **Publishable key** (`pk_live_...`)
   - **Secret key** (`sk_live_...`)

### Step 2 — Add Apple Pay Merchant ID

⚠️ Required only if you want Apple Pay button in app.

1. https://developer.apple.com/account/resources/identifiers/list/merchant
2. Click **+** → Merchant ID → identifier: `merchant.com.tripzen` (matches `app.json`)
3. In Stripe Dashboard → **Settings → Payment methods → Apple Pay → Add new application**
4. Download the CSR from Stripe → upload to Apple → download .cer → upload back to Stripe

### Step 3 — Configure Keys in TripZen

**Frontend (EAS Secret — NEVER commit live keys)**:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_live_xxxxx
```

Then in `frontend/eas.json` for each profile:
```json
"env": {
  "EXPO_PUBLIC_BACKEND_URL": "https://app-builder-demo-60.emergent.host",
  "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "$EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
}
```

**Backend** (`/app/backend/.env`):
```
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # from Dashboard → Webhooks
```

### Step 4 — Configure Webhook
1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://app-builder-demo-60.emergent.host/api/trips/webhook`
3. Events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copy the signing secret → paste into backend `.env` as `STRIPE_WEBHOOK_SECRET`

---

## 🎯 LAUNCH CHECKLIST

Pre-build:
- [ ] Replace placeholder URLs in `eas.json` submit section (Apple ID, Team ID, ASC App ID)
- [ ] Privacy Policy hosted at a real URL
- [ ] Support URL is live
- [ ] App icon is final (1024×1024, no transparency for store, but Expo handles flatten)

App Store Connect setup:
- [ ] Create app listing with bundle ID `com.tripzen.app`
- [ ] Fill description, keywords, category
- [ ] Upload screenshots (6.5", 6.7", and 12.9" iPad)
- [ ] Complete age rating questionnaire
- [ ] Fill privacy nutrition labels
- [ ] Set pricing (Free or Paid)
- [ ] Select countries/regions

Build:
- [ ] `eas init` — links project
- [ ] `eas build --profile production --platform ios`
- [ ] `eas submit --profile production --platform ios --latest`

Post-submit:
- [ ] Build appears in TestFlight within ~15 min
- [ ] Test on physical device via TestFlight
- [ ] Submit for App Review from App Store Connect
- [ ] Apple review: 24-48 hours typically

---

## 🌐 NEED A WEBSITE / PRIVACY POLICY HOSTING?

Quickest free options to host your privacy policy + support page:
- **GitHub Pages**: push a markdown file → free `tripzen.github.io/privacy`
- **Vercel**: deploy a one-page Next.js site in 3 min
- **Notion**: publish a Notion page → use that URL directly

Need me to generate a simple HTML privacy/support site? Say the word.
