# TripZen — App Store Review Notes (Resubmission v1.0.1)

Copy/paste the block below into:
**App Store Connect → My Apps → TripZen → 1.0.1 (build 2) → App Review Information → Notes**

---

## 📝 PASTE THIS INTO "NOTES" FIELD

Hello App Review Team,

Thank you for the detailed feedback on the previous build (1.0/4). We have addressed every point in this resubmission (version 1.0.1, build 2). Summary of changes:

### 1. Apple Pay / PassKit framework (Guideline 2.1)
This version DOES NOT include Apple Pay functionality. The PassKit framework reference in the previous build came from a Stripe SDK configuration option (`merchantIdentifier`) that has now been removed. Card payments are handled via the standard Stripe checkout sheet — there is no Apple Pay button anywhere in the app. The PassKit framework is no longer linked into the binary.

### 2. NFC functionality (Guideline 2.1)
This version DOES NOT include any NFC functionality. The `react-native-nfc-manager` library and `NFCReaderUsageDescription` Info.plist entry have been removed entirely. The binary no longer links the CoreNFC framework. NFC tag interaction may be reintroduced in a future release; if/when that happens, we will provide a demo video as required.

### 3. Account Deletion (Guideline 5.1.1(v))
We have added a prominent, in-app **Delete Account** action for every user role (Parent, Driver, Admin). The flow is identical for all three roles:

  1. Open the app and sign in (use any demo account below)
  2. Tap the **Account** tab (bottom-right of the tab bar)
  3. Scroll to the **Account & Privacy** section (just above the Sign Out button)
  4. Tap **Delete Account** (red, bordered button with trash icon)
  5. Tap **Delete Account** on the first confirmation alert
  6. Tap **Yes, delete forever** on the second confirmation alert
  7. The account and all associated personal data are permanently deleted on our backend (we hit `DELETE /api/account`); the user is signed out and returned to the login screen. A success alert confirms the deletion.

Deletion is permanent and not a deactivation. Children profiles, bookings, ratings, messages, notifications, device tokens, and notification preferences are all removed. (For Driver/Admin roles, route history and audit logs are retained but anonymised — driver_id / sender_id fields are set to null.)

### 4. Demo accounts (please use these for review)

  • Parent:  priya@tripzen.com  /  parent123
  • Driver:  driver@tripzen.com  /  driver123
  • Admin:   admin@tripzen.com   /  admin123

Each of these can be used to test the Delete Account flow. After deletion the account is gone — please use a fresh seeded run if you need to re-test (the demo accounts are auto-seeded on backend startup).

### 5. Other notes
  • Real-time GPS bus tracking and QR code scanning are the core features. The reviewer can open the Driver demo account → Scan tab → use the in-app manual code input (or the camera if testing on a physical device) to simulate a student check-in. The Parent demo account will then see the boarding event live on the Home tab.
  • The privacy policy is hosted at: https://<your-github-pages-url>/privacy.html
  • Support URL: https://<your-github-pages-url>/support.html

Please let us know if any further information is needed. Thank you!

— The TripZen Team

---

## ✅ Re-submission Checklist

Before tapping Submit:
- [ ] New EAS build uploaded (version 1.0.1, buildNumber 2)
- [ ] Above notes pasted into Review Information → Notes
- [ ] Demo account credentials added in Review Information → Sign-In Required → Username/Password (use the parent one as the primary login)
- [ ] Privacy Policy URL still active
- [ ] Support URL still active
- [ ] App Privacy questionnaire still reflects: no Apple Pay, no NFC reading
- [ ] "Reply" to the previous rejection message in Resolution Center pointing to this new build

## 🚀 Commands to rebuild

```bash
cd /app/frontend
eas build --platform ios --profile production
# When build completes:
eas submit --platform ios --latest
```
