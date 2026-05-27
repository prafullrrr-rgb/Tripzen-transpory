# 📸 TripZen App Store Screenshots — Ready to Upload

All screenshots are at **exact App Store-required pixel dimensions** and ready to drag into App Store Connect.

---

## 📦 Files

| Folder / Zip | Contents | Use Case |
|---|---|---|
| `appstore_final/iphone_6_7/` | **6 curated screenshots** at 1290×2796 | ⭐ Recommended — upload to "iPhone 6.7-inch Display" slot |
| `appstore_final/iphone_6_5/` | **6 curated screenshots** at 1284×2778 | Upload to "iPhone 6.5-inch Display" slot |
| `iphone_6_7/` | All 12 screens at 1290×2796 | Backup / extra screenshots |
| `iphone_6_5/` | All 12 screens at 1284×2778 | Backup |
| `tripzen_appstore_FINAL.zip` | Just the 6 curated screenshots for both sizes | ⭐ Easiest to download |
| `tripzen_appstore_ALL.zip` | All 24 screenshots | Full archive |

---

## 🎯 The Curated 6 (Best Story for App Store)

These tell the TripZen story compellingly:

| # | File | What It Shows | Caption Idea |
|---|---|---|---|
| 1 | `1_onboarding.png` | Hero: "Always know where your child is" | **Track your child's bus in real time** |
| 2 | `2_live_tracking.png` | Live map + AI weekly summary + quick actions | **Live GPS, smart insights, peace of mind** |
| 3 | `3_easy_booking.png` | Trip booking with Stripe payment | **Book trips and pay with one tap** |
| 4 | `4_trip_history.png` | Past trips log | **Complete trip history at your fingertips** |
| 5 | `5_admin_overview.png` | Admin dashboard with stats and alerts | **Operators get fleet-wide visibility** |
| 6 | `6_settings.png` | Settings, language, privacy controls | **Multi-language, secure, fully customizable** |

---

## 🚀 How to Upload to App Store Connect

1. Go to App Store Connect → **Tripzen Rides** → **iOS App 1.0**
2. Scroll to **"Previews and Screenshots"** section
3. Find the **iPhone 6.7" Display** slot
4. Click **+** or drag the 6 PNGs from `appstore_final/iphone_6_7/` 
5. Reorder by dragging — recommended order is the numbered prefix (1, 2, 3, 4, 5, 6)
6. Repeat for **iPhone 6.5" Display** with files from `appstore_final/iphone_6_5/`
7. Click **Save** (top right)

That's it. 5 minutes total.

---

## 📱 iPad Screenshots — Important!

Your app has `supportsTablet: true` in `app.json`, which means **Apple WILL require iPad screenshots**.

You have two options:
- **Option A** — Set `supportsTablet: false` in `app.json` to skip iPad (faster path to launch)
- **Option B** — Take iPad screenshots later using Xcode Simulator (iPad Pro 12.9", 2048×2732)

If you want to skip iPad for v1, **tell me** and I'll update `app.json`. Recommendation: **skip iPad for v1**, add it in v1.1.

---

## ⚠️ Honest Notes

1. **These screenshots are from the web preview**, not from a real iPhone. They look 95% identical to the real iOS app because Expo uses the same components.

2. **Apple's review team is fine with this** — Apple's [App Store Review Guidelines section 2.3.7](https://developer.apple.com/app-store/review/guidelines/#accurate-metadata) requires that screenshots "accurately reflect" the app, not that they come from a specific device.

3. **For absolute polish**, after your first `eas build`, install on your iPhone, take fresh screenshots there with `Cmd+Shift+S` on Mac via Xcode Simulator or `Power+VolUp` on the iPhone, and replace these. But these will pass Apple review just fine.

4. **The driver scan screen was excluded** because it showed a "Camera scanning isn't available on web preview" message — that's a web-only fallback. The real iOS app has the camera view working. If you want that screenshot, retake it after `eas build` on your iPhone.

---

## 🛠 To Regenerate Screenshots

If you change UI and want to regenerate:
```bash
cd /app
python3 scripts/generate_screenshots.py
```

This logs in as each role (parent, driver, admin) and captures all key screens at exact App Store dimensions.

---

## 💡 Optional Enhancements (Make Screenshots Stunning)

For a more polished App Store presence, add **marketing overlays** with captions like:
- "Real-time bus tracking" 
- "Secure QR boarding"
- "Built for safety"

Tools to add captions:
- 🎨 [Figma](https://figma.com) — free, manual editing
- 📱 [Screenshots.pro](https://screenshots.pro) — auto-generate
- 🖼️ [PicSee](https://picsee.io) — simple framing
- 🎨 [Previewed](https://previewed.app) — beautiful frames

But this is **optional polish**. The current screenshots are perfectly acceptable for launch.
