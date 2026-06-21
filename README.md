# Climbmania Tracker · Block Progress

A React app that visualises a bouldering athlete's tops and zones across
Climbmania events — event by event, with a block-level grid per result.

## How it works

- Event data is pre-scraped and bundled as `public/events.json`.
- The app loads that JSON, lets you search for an athlete by name, and
  shows their rank, points, tops, and zones for every event they entered.
- The interface is translated into EN / FR / DE / IT and picks the
  right language automatically from the browser locale.

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start the dev server
pnpm dev

# 3. Open http://localhost:3000, enter an athlete name and hit the Enter key
```

## Build for production

```bash
pnpm build
pnpm preview   # serves the built app at http://localhost:4173
```

## Project structure

```
climbmania-tracker/
├── index.html
├── vite.config.js          ← Vite config
├── pnpm-workspace.yaml     ← pnpm allowed build scripts
├── package.json
├── public/
│   └── events.json         ← pre-scraped event data
└── src/
    ├── main.jsx            ← React entry point
    ├── index.css           ← global styles + CSS variables
    ├── i18n.js             ← i18next setup with browser locale detection
    ├── locales/            ← translation files (en, fr, de, it)
    ├── App.jsx             ← search, state, layout
    ├── EventCard.jsx       ← per-event result card
    └── components.jsx      ← BlockGrid, ProgressBar, StatCard
```
