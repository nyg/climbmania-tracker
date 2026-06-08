# Copilot Instructions — Climbmania Tracker

## Commands

```bash
pnpm install     # install dependencies
pnpm dev         # start dev server at http://localhost:3000 (proxy active)
pnpm build       # production build
pnpm preview     # serve production build at http://localhost:4173
```

No test runner or linter is configured.

## Architecture

A single-page React 18 + Vite app that scrapes Climbmania event result pages and visualises a user-specified athlete's tops and zones across events #152–183. The athlete name is entered via a text field on the page before scanning.

**CORS workaround via Vite proxy** (`vite.config.js`):  
All fetches go to `/climbmania/<path>`, which Vite proxies server-side to `https://www.climbmania.ch/<path>`. This only works in dev mode (`npm run dev`). A production deployment would need a backend relay.

**Data flow:**
1. `App.jsx` — orchestrates the scan loop over `EVENT_IDS`, applies a 200 ms polite delay between requests, and updates state live as results arrive.
2. `fetcher.js` — `fetchEventPage(id)` fetches the HTML; `parseAthleteFromHTML(html, id, name)` uses `DOMParser` to find the `<tr>` containing the athlete name (case-insensitive) and reads each block `<td>` for the CSS classes `top-ok` (full top) and `zone-ok` (half-top). Returns `{ eventId, eventTitle, eventDate, rank, points, tops, zones, totalBlocks }`.
3. `EventCard.jsx` — renders a single event result, including a top-count diff badge vs. the previous event.
4. `components.jsx` — three pure display components: `BlockGrid` (coloured squares per block), `ProgressBar`, `StatCard`.

## Key Conventions

**All styling is inline** — there are no CSS utility classes or component-level stylesheets. Only `index.css` exists and it holds the global reset plus font import (IBM Plex Mono).

**Colour palette (dark theme):**
- Page background: `#0b0b14`
- Card backgrounds: `#0f0f1c` / `#13131f`
- Primary accent (indigo): `#6366f1`
- Tops (green): `#22c55e` / `#16a34a`
- Zones (amber): `#d97706` / `#f59e0b`
- Muted text: `#475569`, `#64748b`, `#94a3b8`

**Block status is derived from CSS classes on the scraped HTML**, not from JSON data. If Climbmania's markup changes, `parseAthleteFromHTML` in `fetcher.js` is the only place to update.

**`EVENT_IDS`** is defined in `fetcher.js` as `Array.from({ length: 50 }, (_, i) => 152 + i)`. The range comment says `152..183` but the array actually spans 152–201; adjust `length` when extending the tracked range.

**`.env.example`** contains `VITE_ANTHROPIC_API_KEY` but the key is not referenced anywhere in the current codebase.
