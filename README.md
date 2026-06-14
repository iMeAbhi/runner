# Travel Log & Leave Optimizer

An offline-first personal **Travel Tracker + Leave Optimizer** PWA.
Frontend: React + Vite + Tailwind + Framer Motion. Backend: a single Google
Sheet exposed through a Google Apps Script web app. No Node server, no CSS
preprocessors.

## Quick start

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run preview    # serve the built PWA
```

## Backend setup (one time)

1. Create a Google Sheet. Copy its ID from the URL.
2. **Extensions → Apps Script**, paste [`Code.gs`](Code.gs), set `SPREADSHEET_ID`
   (or leave blank to bind to the container sheet).
3. Run `setup()` once and approve the Drive + Sheets scopes. It creates the
   `Trips` and `Holidays` tabs with headers.
4. **Deploy → New deployment → Web app** — *Execute as: Me*, *Access: Anyone*.
   Copy the `/exec` URL.
5. Open the PWA → **Settings** → paste the URL into **Apps Script URL** and set
   your **Home location**. Tap **Test & sync now**.

## Sheet schema

| Tab | Columns |
|-----|---------|
| `Trips` | `ID, City, State_Country, Start_Date, End_Date, Transport_Mode, Accommodation, Drive_Folder_URL, Photo_URLs` |
| `Holidays` | `Date (YYYY-MM-DD), Holiday_Name` |

## How it works

- **Offline-first:** all data lives in **IndexedDB** (`src/db/idb.js`). Writes
  apply instantly; when offline they queue in an outbox and flush to the sheet
  when connectivity returns.
- **Media:** images are compressed on-device via an HTML5 Canvas redraw
  (`src/utils/imageCompress.js`) and streamed to Apps Script **one request per
  file** (sequential queue) to dodge execution timeouts. Apps Script files them
  into `Travel_App_Media/<date>_<City>/` on Drive, makes them link-viewable, and
  writes the URLs back to the row.
- **Leave optimizer** (`src/utils/leaveOptimizer.js`): slides an N-day window
  across the next 52 weeks and ranks start dates by *fewest company leaves*,
  stacking the trip onto weekends + public holidays. A custom holiday list
  pasted in Settings fully overrides the bundled default calendar.
- **Themes:** four profiles (AMOLED, Light, Material Mood, Contextual Sky) driven
  by CSS custom properties swapped at runtime in `src/context/AppContext.jsx`.
  Sky mode retints by local clock (morning/afternoon/evening/night).

## Project layout

```
src/
  api/api.js              Apps Script client (GET getAll, POST save/delete/upload)
  db/idb.js               IndexedDB wrapper (trips / meta / outbox)
  context/AppContext.jsx  global state, theme engine, sync, upload queue
  utils/                  dates, leaveOptimizer, insights, imageCompress
  data/                   default holidays, India states table
  components/             Background, BottomNav, CityCard, CityDetail, TripForm…
  components/tabs/        TimelineFeed, Planner, Analytics, Settings
Code.gs                   Google Apps Script backend
```
