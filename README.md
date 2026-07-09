# 🌾 Farmers Connect — Standalone Offline APK

Android APK for **https://jembefrontend.onrender.com** — fully functional offline.

## How offline works

```
┌─────────────────────────────────────────────────────┐
│                   ANDROID APK                        │
│                                                       │
│  ┌──────────┐    ┌──────────┐    ┌────────────────┐ │
│  │ UI Views │───▶│DataLayer │───▶│  IndexedDB     │ │
│  │ (JS/CSS) │    │ data.js  │    │  (local SQLite)│ │
│  └──────────┘    └────┬─────┘    └────────────────┘ │
│                        │  background sync             │
│                   ┌────▼─────┐                        │
│                   │SyncEngine│                        │
│                   │ sync.js  │                        │
│                   └────┬─────┘                        │
└────────────────────────┼────────────────────────────-┘
                         │ when online
                    ┌────▼──────────────────┐
                    │  jembebackend.onrender │
                    │  .com  (Neon Postgres) │
                    └───────────────────────┘
```

**Read flow (instant, always works offline)**
1. View calls `data.getFeed()` (or any other data function)
2. DataLayer immediately returns data from IndexedDB
3. View renders with zero wait — even with no internet
4. In background, DataLayer fetches fresh data from backend
5. View updates automatically via `onRefresh` callback

**Write flow (optimistic, queued when offline)**
1. User creates a post / sends a message / places an order
2. DataLayer writes to IndexedDB immediately — UI updates now
3. If online → POST to backend, store canonical response in IndexedDB
4. If offline → queued in `sync_queue` table in IndexedDB
5. When connectivity returns → SyncEngine flushes the queue automatically

**Sync schedule**
- Login → immediate full pull from backend
- Every 90 seconds while online
- Instant pull when network comes back online
- Manual sync available in Settings

---

## Build the APK (local)

### Requirements
| Tool | Version | Link |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| JDK | 17+ | https://adoptium.net |
| Android Studio | Latest | https://developer.android.com/studio |

### One command
```bash
./build-apk.sh          # debug APK — install directly, no signing needed
./build-apk.sh release  # signed APK — for Google Play distribution
```
APK appears in `./output/farmers-connect-debug-TIMESTAMP.apk`

### Install on your phone
**Option A — USB cable (recommended):**
```bash
adb install output/farmers-connect-debug-*.apk
```

**Option B — File transfer:**
1. Copy the `.apk` file to your phone (WhatsApp, USB, email, Google Drive)
2. Open it from your phone's file manager
3. Allow "Install from unknown sources" if prompted
4. Done — icon appears on your home screen

---

## Build the APK (GitHub Actions — no Android Studio needed)

1. Push this folder to a GitHub repository
2. GitHub automatically runs `.github/workflows/build-apk.yml`
3. Go to **Actions tab → latest run → Artifacts**
4. Download `farmers-connect-apk.zip` → extract → install the `.apk`

No local Android setup needed at all.

---

## What's in the APK

| Feature | Offline | Online |
|---|---|---|
| Home feed (posts, likes, comments) | ✅ cached | ✅ live |
| Stories bar | ✅ cached | ✅ live |
| Marketplace search + listings | ✅ cached | ✅ live |
| Education (courses, brochures, templates) | ✅ cached | ✅ live |
| Direct messages + threads | ✅ cached, sends queued | ✅ realtime |
| Notifications | ✅ cached | ✅ realtime push |
| User profiles + follow | ✅ cached | ✅ live |
| Create post / story | ❌ upload needs internet | ✅ |
| Place order / enroll course | ✅ queued | ✅ instant |
| Settings + privacy | ❌ needs internet | ✅ |
| Camera (take / pick photo) | ✅ native API | ✅ |

---

## Architecture

```
fc-apk/
├── www/                           Web app bundled inside the APK
│   ├── index.html                 App shell
│   ├── manifest.json              PWA manifest
│   ├── sw.js                      Service worker (extra cache layer)
│   ├── css/styles.css             Dark theme, sidebar, offline banner
│   └── js/
│       ├── app.js                 Bootstrap: auth, sidebar, sync init
│       ├── services/
│       │   ├── localdb.js         IndexedDB schema + all local queries
│       │   ├── sync.js            Pull backend → IndexedDB, flush write queue
│       │   ├── data.js            All views import this — offline-first reads/writes
│       │   ├── api.js             Raw HTTP calls to jembebackend.onrender.com
│       │   ├── socket.js          WebSocket realtime (jembebackend.onrender.com/ws)
│       │   ├── native.js          Capacitor bridge: camera, push, back button
│       │   └── store.js / router.js
│       ├── components/
│       │   ├── Sidebar.js         Collapsible nav, sync dot, online/offline pip
│       │   ├── MediaPicker.js     Camera/gallery (native API in APK, <input> in browser)
│       │   └── StoriesBar.js      24h stories with camera capture
│       └── views/                 All use data.js, not api.js directly
│           ├── FeedView.js        Posts, likes, comments, stories
│           ├── MarketplaceView.js Search-first layout, offline listings
│           ├── EducationView.js   Courses / brochures / templates tabs
│           ├── MessagesView.js    Conversations + realtime thread
│           ├── NotificationsView.js Cached + live notifications
│           ├── ProfileView.js     Cached profile, follow, message
│           ├── SettingsView.js    Privacy + offline sync status card
│           └── AuthView.js        Login / register
├── android/                       Capacitor Android project
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml    Camera, storage, push permissions
│   │   └── java/io/farmersconnect/app/
│   │       ├── MainActivity.java  BridgeActivity entry point
│   │       └── FCMService.java    Firebase push when app is closed
│   └── app/build.gradle           applicationId, min/target SDK, signing
├── .github/workflows/build-apk.yml  CI build (no local Android Studio needed)
├── capacitor.config.json          Capacitor config (webDir: www)
├── package.json                   Capacitor 6 + plugins
└── build-apk.sh                   One-command local build
