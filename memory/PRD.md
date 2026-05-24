# TripZen - Product Requirements Document

## Vision
A modern, all-in-one child transport safety platform for the UK (and beyond) that gives parents peace of mind, makes drivers' jobs easier, and gives operators powerful management tools.

## MVP Scope (delivered)
Single Expo (React Native) mobile app with role-based access for Parent, Driver, and Admin.

### Roles & Apps

**Parent App**
- Live bus tracking on real map (react-native-maps)
- Real-time trip status (waiting / boarded / checked-out)
- In-app notification timeline (boarding, arrival, handover events)
- Children profiles with auto-generated QR codes
- Booking flow with Stripe (mocked) — monthly & single-trip plans
- Trip history & receipts
- Multi-language ready (i18n hooks in place; not yet localized)

**Driver App**
- Today's route view with timeline of stops & ETAs
- "Start Route" / "End Route" controls
- QR scanner (expo-camera) for student check-in / check-out
- Simulate Movement toggle for live tracking demo
- Manual code entry fallback (for web preview)

**Admin Dashboard (mobile)**
- Overview stats grid (routes, students, active buses, on-time %)
- Live map of all active buses
- Alerts feed (delays, missed checkouts, route deviations)
- Management menu (routes, students, drivers placeholders)

### Backend
FastAPI + MongoDB. Endpoints under `/api`:
- Auth: register, login, me (JWT)
- Students CRUD
- Routes CRUD
- Trips: start, location update, scan (board/checkout), end, active list
- Notifications: list, mark read
- Bookings: create, pay (mock Stripe)
- Admin: stats, alerts, users

### Tech Stack
- Frontend: Expo SDK 54, React Native 0.81, expo-router
- Maps: react-native-maps (native) + OpenStreetMap static tile fallback (web)
- QR: expo-camera (BarcodeScanner)
- Backend: FastAPI, Motor (async Mongo), bcrypt, PyJWT
- Theme: Custom StyleSheet system, Navy + Amber palette

## Out of Scope (Mocked / Future)
- **Real Stripe**: Mocked — real `@stripe/stripe-react-native` requires a development build (not Expo Go)
- **WhatsApp / Email / Push notifications**: in-app feed only for MVP
- **NFC badge scanning**: UI placeholder — requires physical device
- **Background GPS tracking**: simulated movement toggle for demo
- **Real-time WebSockets**: 5–10s polling used instead

## Smart Business Enhancement
Built-in **subscription model** (Monthly Plan £89.99 vs Single Trip £4.50) drives recurring revenue. Auto-charges the parent monthly via Stripe and gives operators predictable cashflow vs ad-hoc per-trip pricing. Admins see total revenue & subscriber count from one dashboard.
