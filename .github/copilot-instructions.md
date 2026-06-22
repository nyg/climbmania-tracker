# Copilot Instructions — Climbmania Tracker

## Commands

```bash
pnpm install     # install dependencies
pnpm dev         # start dev server at http://localhost:3000
pnpm build       # production build
pnpm preview     # serve production build at http://localhost:4173

# Python scraper (run separately to refresh data)
pip install -r requirements.txt
python scrape.py                          # writes public/events.json
python scrape.py --output path/to/out.json --delay 0.5
```

No test runner or linter is configured.

## Architecture

A single-page React 19 + Vite app. Data is pre-scraped offline by a Python script and served as a static JSON file. The React app loads that JSON, then lets the user search for an athlete by name and visualises their tops and zones across all events.

There is **no live scraping** and **no Vite proxy** — the old CORS workaround has been removed entirely.

**Data pipeline:**
1. `scrape.py` — fetches the Climbmania group page to discover all past events, then scrapes each event's results page. Parses categories and athletes (rank, name, points, block tops/zones) and writes everything to `public/events.json`. Applies name normalisation via `public/name-merges.json`.
2. `public/events.json` — static snapshot served alongside the app. Shape: `{ scrapedAt, sourceUrl, events: [{ id, title, date, url, categories: [{ name, athletes: [{ rank, name, points, tops, zones, totalBlocks }] }] }] }`. `tops` and `zones` are arrays of 1-based block numbers.
3. `public/name-merges.json` — JSON array of name groups; first element is canonical. Used to deduplicate athletes who appear under slightly different spellings across events.

**React data flow:**
1. `App.jsx` — fetches `events.json` on mount, builds an autocomplete list of all athlete names, and runs `searchEvents()` (fuzzy token match or exact) on every query change. Computes summary stats (best tops/zones rate, best rank, best points) from results.
2. `EventCard.jsx` — renders a single event result card: event title, date, category, rank, score, a progress bar, block grid, and a diff badge comparing weighted score % vs. the previous result.
3. `components.jsx` — three pure display components: `BlockGrid` (coloured squares per block number), `ProgressBar`, `StatCard`.
4. `i18n.js` — initialises i18next with `LanguageDetector`; bundles translations for `en`, `fr`, `de`, `it` from `src/locales/`.

## Key Conventions

**All React styling is inline** — no CSS utility classes. `index.css` holds only the global reset, the font import (IBM Plex Mono), and the `.name-input::placeholder` rule.

**Theming via CSS custom properties.** `index.css` defines two full palettes — dark (default) and light — applied via `[data-theme="dark"]` / `[data-theme="light"]` on `<html>`. The toggle reads/writes `localStorage.theme` and defaults to the OS preference. Always use `var(--…)` tokens in new inline styles; never hardcode colours.

Key tokens:
- `--bg-page`, `--bg-card`, `--bg-card-2`, `--bg-dropdown`
- `--border`, `--border-dark`
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-faint`, `--text-ultra-faint`
- `--bg-block-empty`, `--text-block-empty`
- `--diff-pos-bg`, `--diff-neg-bg`, `--diff-neutral-bg`
- `--error-bg`, `--error-border`, `--error-text`

Fixed accent colours (same in both themes): indigo `#6366f1`, tops green `#16a34a` / `#22c55e`, zones amber `#d97706` / `#f59e0b`.

**Block data is arrays of 1-based block numbers** (`tops: [1, 3, 5]`, `zones: [2]`). `BlockGrid` iterates from 1 to `total` and checks `tops.includes(n)` / `zones.includes(n)`. If the scraper's parsing changes, update `parse_blocks()` in `scrape.py`.

**i18n:** all user-visible strings go through `t('key')`. Add keys to all four locale files (`src/locales/{en,fr,de,it}.json`) when adding new UI text.

**`vite.config.js`** sets `base: '/climbmania-tracker/'` for GitHub Pages deployment. Use `import.meta.env.BASE_URL` when constructing asset paths (e.g. the `events.json` fetch).
