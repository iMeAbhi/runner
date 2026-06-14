# ✈️ Voyage — Travel Log & Leave Optimizer PWA

An offline-first, installable Progressive Web App to track your travels and
squeeze the most holiday out of every company leave. The frontend is a fully
immersive **"Liquid Material"** SPA; the backend is **entirely serverless** —
a single Google Sheet you own, driven by a secure Google Apps Script endpoint.

> No accounts. No third-party servers. Your data lives in **your** browser and
> **your** Google Drive.

---

## ✨ Features

- **Timeline Feed** — vertical timeline of past / active / upcoming trips as
  interactive image-backed City Cards. Tap to open a full-screen deep dive with
  a Drive-linked photo gallery and a "Fun Insights" box. A nudge banner appears
  when it's been **> 90 days** since your last trip and deep-links into Google
  Flights with an optimized window pre-filled.
- **Leave Optimizer** — a sliding-window engine scans 52 weeks to find trip
  blocks that maximise consecutive days off for the **fewest** company leaves.
  Live leave balances + annual time-off %.
- **Insights Dashboard** — morphing time filters (1M → 1Y → custom range),
  volumetric counts (cities, countries, flights, trains, stays), longest trip,
  most-visited hub, and an **India coverage** wheel across all 36 states & UTs.
- **Settings** — secure backend handshake, corporate holiday paste (overrides
  the default calendar), leave allocation, 4 theme profiles, JSON/CSV export.
- **Offline-first** — every action writes to IndexedDB instantly; a background
  worker syncs to your Sheet when the network returns. Installable PWA.

## 🎨 Themes

| Theme | Vibe |
|-------|------|
| **AMOLED Dark** | Pitch black + neon glow |
| **Clean Light** | Frosted milk glass on warm pastel |
| **Material Mood** | Accent-driven dynamic palette (Aviation / Nomad / Sunset / Violet) |
| **Sky Dynamic** | Time-of-day fluid gradient (morning → night) |

---

## 🧱 Tech Stack

React 18 · Vite 5 · Tailwind CSS 3 · Framer Motion · Dexie (IndexedDB) ·
browser-image-compression · vite-plugin-pwa · Google Apps Script.

---

## 🚀 Getting Started (Frontend)

> Requires **Node.js 18+**. If `node` isn't installed, grab it from
> <https://nodejs.org> (LTS) or `winget install OpenJS.NodeJS.LTS`.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build
```

---

## 🔐 Backend Setup (Google Apps Script + Sheet)

1. **Create a Google Sheet** (any name). It will auto-create a `Trips` tab and a
   hidden `Config` tab on first run.
2. **Extensions → Apps Script.** Delete the stub and paste
   [`gas/Code.gs`](gas/Code.gs).
3. **Set your secret token** — *Project Settings → Script properties* →
   add `SECURE_TOKEN = <a-strong-random-key>`.
4. **Deploy → New deployment → Web app:**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone** (the token still gates every request)
5. Copy the **`/exec` URL**.
6. In the PWA, open **Settings** and fill in:
   - **Apps Script URL** → the `/exec` URL
   - **Secure Token** → the same token from step 3
   - **Home Location** → e.g. `Hyderabad`
   - Leave allocations & (optional) your corporate holiday list
7. Tap **Test connection** — you should see `Voyage backend connected ✓`.

### How media works
On upload, images are compressed client-side, named `YYYY-MM-DD_City_xxxxx.jpg`,
and POSTed to Apps Script. The script saves them under
`Drive/Travel_App_Media/<YYYY-MM-DD_City>/`, sets them to public-link view, and
writes the sharing URLs into the trip's row. Offline, photos preview from local
data URLs until sync runs.

### Security model
Apps Script web apps can't read custom request headers, so the shared secret is
sent in the request **body** (POST) / **query** (GET) and validated server-side
against your Script Property (or hidden `Config!B1`) before any Sheet/Drive
access. "Anyone" access only means "reachable without a Google login" — the
token is the real gate. **Use a long, random token.**

---

## 📁 Project Structure

```
src/
  App.jsx                  # shell + liquid tab transitions
  context/AppContext.jsx   # global state: settings, trips, theme, sync
  db/db.js                 # Dexie (IndexedDB) offline store + outbox
  api/client.js            # secure Apps Script client (token in payload)
  sync/useSync.js          # background sync worker
  lib/
    theme.js               # 4 themes, mood accents, sky-dynamic gradient
    leaveOptimizer.js      # sliding-window arbitrage engine
    holidays.js            # default + custom holiday parsing/override
    indiaStates.js         # 36 states/UTs + coverage calc
    insights.js            # analytics + per-city fun insights
    imageCompress.js       # client-side compression + naming index
    flights.js             # Google Flights deep links
  components/              # GlassCard, BottomNav, CityCard, modals, icons…
  tabs/                    # Timeline, Planner, Insights, Settings
gas/Code.gs               # Google Apps Script backend
```

---

## 📦 Data Export

Settings → **Export JSON** (full backup incl. settings) or **Export CSV**
(trips only). Everything stays on-device.

---

## 📝 License

Personal project — use freely.
