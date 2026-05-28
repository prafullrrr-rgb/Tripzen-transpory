# 🚀 TripZen v1.1 Enhancement Plan

## ✅ Status
- iOS v1.0 submitted to App Store — awaiting Apple review
- v1.1 enhancements in progress (this doc tracks them)

---

## 📋 ALL 7 ENHANCEMENTS (Ordered by Priority)

### 🔥 PHASE 1 — Safety + Trust (Days 1-3)
- [ ] **#1 Emergency SOS** — Driver red button → alerts admin + parents of kids on bus
- [ ] **#2 Driver Verification Badge** — Parent sees driver photo, license, vehicle plate
- [ ] **#3 Photo on QR Scan** — Optional boarding photo, parent sees proof

### 🌟 PHASE 2 — Parent Convenience (Days 4-7)
- [ ] **#4 "Today" Home Card** — Glanceable status for parents
- [ ] **#5 Skip-a-Day** — Tap to mark child off + auto-refund
- [ ] **#6 Multi-child + Multi-parent** — Siblings & co-parents

### 🚦 PHASE 3 — Smart Alerts (Days 8-12)
- [ ] **#7 Bus Approaching Home Alert** — Geofence push 2 min before stop

### 📊 PHASE 4 — Admin Power (Days 13-16)
- [ ] **#8 Revenue + Cancellation Dashboard** — Earlier user request
- [ ] **#9 Broadcast Templates** — Snow day, strike, etc.
- [ ] **#10 Bulk CSV Student Upload + Badge Print PDF**

### 🛡 PHASE 5 — Polish (Days 17-21)
- [ ] **#11 Turn-by-turn Navigation** — Driver nav in-app
- [ ] **#12 Dark Mode**
- [ ] **#13 Biometric Login**
- [ ] **#14 Onboarding Tutorial**

---

## 🎯 NOW BUILDING — Phase 1

### Feature #1: Emergency SOS
**Backend** (`/app/backend/routes/emergency.py`):
- POST `/api/emergency/sos` (driver auth) — accepts: route_id, trip_id, lat, lng, reason
- Records `Emergency` record in DB
- Triggers fan-out: notifies all admins + parents whose kids are on the active trip
- WebSocket broadcast to admin dashboards

**Frontend** (`/app/frontend/app/driver/index.tsx`):
- Floating red SOS button (always visible during trip)
- Tap → confirm dialog → trigger
- Show "Help is on the way" with admin contact

**Admin** (`/app/frontend/app/admin/alerts.tsx`):
- New section for active emergencies (red banner at top)

### Feature #2: Driver Verification Badge
**Backend**:
- Extend user model: `license_number`, `vehicle_plate`, `years_driving`, `badge_photo` (base64)
- GET `/api/parent/driver-info/{trip_id}` returns full driver profile

**Frontend** (`/app/frontend/app/parent/index.tsx`):
- Tap on bus card → modal showing driver info
- "Verified by [School Name] ✓" badge

### Feature #3: Photo at QR Scan
**Backend**:
- Extend scan endpoint to accept optional `photo_base64`
- Store in boarding log

**Frontend**:
- Driver scan screen: toggle "Capture photo" + auto camera shot
- Parent history: thumbnail next to boarding event
