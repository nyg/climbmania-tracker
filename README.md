# Climbmania Tracker · Block Progress

A local React app that scans Climbmania events #152→#183, finds an athlete
in each one, and shows which blocks they topped or zoned — event by event.

## How it works

- Vite's dev server proxies `/climbmania/*` → `https://www.climbmania.ch/*`  
  This sidesteps CORS: the request is made server-side, and the real HTML
  (including `top-ok` / `zone-ok` CSS classes) comes back intact.
- The app parses the HTML with `DOMParser`, finds the athlete's `<tr>`,
  and reads every block `<td>` for those CSS classes.
- No API key needed — everything runs locally.

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start the dev server
pnpm dev

# 3. Open http://localhost:3000, enter an athlete name and hit "SCAN ALL EVENTS"
```

That's it. No `.env` file needed.

## Build for production

```bash
pnpm build
pnpm preview   # serves the built app at http://localhost:4173
```

> Note: the proxy only works in dev mode (`pnpm dev`).  
> For a production build you'd need a small backend to relay requests.

## Project structure

```
climbmania-tracker/
├── index.html
├── vite.config.js      ← proxy config lives here
├── pnpm-workspace.yaml ← pnpm allowed build scripts
├── package.json
└── src/
    ├── main.jsx        ← React entry point
    ├── index.css       ← global styles
    ├── App.jsx         ← scan loop + layout
    ├── EventCard.jsx   ← per-event result card
    ├── components.jsx  ← BlockGrid, ProgressBar, StatCard
    └── fetcher.js      ← fetch + DOMParser logic
```
