# Climbmania Tracker

## Commands

```bash
pnpm install     # install dependencies
pnpm dev         # start dev server at http://localhost:3000
pnpm build       # production build
pnpm preview     # serve production build at http://localhost:4173

# Python scraper (run separately to refresh data)
./scraper/scrape.sh                        # creates scraper/.venv, installs deps, writes public/events.json
./scraper/scrape.sh --output path/to/out.json --delay 0.5
./scraper/scrape.sh --since 2026-01-01     # re-scrapes events from that date, keeps older ones from public/events.json

# Athlete name deduplication (stdlib only, no venv needed)
./scraper/merge_names.py                   # lists likely duplicate athlete names not yet in public/name-merges.json
./scraper/merge_names.py --review          # accept or reject each candidate interactively

# IFSC profile links (stdlib only, needs network)
./scraper/athlete_links.py                 # lists IFSC profiles matching athletes not yet in public/athlete-links.json
./scraper/athlete_links.py --review        # accept or reject each match interactively

# Analytics proxy (Cloudflare Worker, separate pnpm project)
pnpm --dir worker install
pnpm --dir worker run dev                  # run the Worker locally at http://localhost:8787
pnpm --dir worker run deploy               # deploy to Cloudflare (needs `wrangler login` once)
pnpm --dir worker run tail                 # stream production logs
pnpm --dir worker exec wrangler secret put GOATCOUNTER_TOKEN
```

No test runner or linter is configured.

## Architecture

A single-page React 19 + Vite app. Data is pre-scraped offline by a Python script and served as a static JSON file. The React app loads that JSON, then lets the user search for an athlete by name and visualises their tops and zones across all events.

There is **no live scraping** and **no Vite proxy** — the old CORS workaround has been removed entirely.

**Data pipeline:**
1. `scraper/scrape.py` — fetches the Climbmania group page to discover all past events, then scrapes each event's results page. Parses categories and athletes (rank, name, full name, points, block tops/zones), skips athletes with 0 points and any category or event left without athletes, and writes everything to `public/events.json`. Names are kept as listed on Climbmania. It then prints names that look like unmerged duplicates.
2. `public/events.json` — static snapshot served alongside the app. Shape: `{ scrapedAt, sourceUrl, events: [{ id, title, date, url, categories: [{ name, athletes: [{ rank, name, fullName?, points, tops, zones, totalBlocks }] }] }] }`. `name` is the bold name the athlete entered (meant to be "Surname, First name", but often a nickname or another format). `fullName` is the first and last name shown under it, present only when the athlete filled it in and it differs from `name`. `tops` and `zones` are arrays of 1-based block numbers.
3. `public/name-merges.json` — JSON array of name groups; first element is canonical. The app loads it with `events.json` and shows every name of a group as one athlete under the canonical name. Lookups ignore case, accents, punctuation and digits.
4. `scraper/merge_names.py` — holds the duplicate detection imported by `scrape.py`, and is also a CLI. It finds candidate duplicates: names with the same words in any order (single words like `BasileRoch` are split at capitals), names whose results share a `fullName` (or whose `fullName` has the same words as another name), or names with a `difflib` similarity ≥ 0.93. `--review` asks about each group: accepted ones are added to `name-merges.json` (extending an existing group when they overlap), rejected ones go to `public/name-distinct.json` so they are not suggested again. `events.json` is never rewritten, so no re-scrape is needed.
5. `public/athlete-links.json` — object mapping an athlete name to their profiles on other sites, e.g. `{ "Katherine Choong": { "ifsc": 3130 } }`. The app maps each name through `name-merges.json`, so any name of a merge group works.
6. `scraper/athlete_links.py` — searches the IFSC results API (`https://ifsc.results.info/api/v1/athletes?name=`, needs a browser `User-Agent` and a `Referer`) for every athlete with a result outside the youth categories (M8–M17). It keeps IFSC athletes whose first and last name have the same words as one of the athlete's names or full names, and whose gender matches the categories. `--review` asks about each match, showing the IFSC country and birthday: accepted ones go to `athlete-links.json`, rejected ones go to `public/ifsc-rejected.json` so they are not suggested again. Each decision is saved straight away.

**React data flow:**
1. `App.jsx` — fetches `events.json`, `name-merges.json` and `athlete-links.json` on mount and maps each result to its athlete's canonical name. The autocomplete shows one line per athlete with their other names ("a.k.a."); a query matches any of those names, ignoring case and accents. Computes summary stats (best tops/zones rate, best rank, best points) from results, and lists the athlete's profile links (sites in `PROFILE_SITES`) and merged names above them, below the legend.
2. `EventCard.jsx` — renders a single event result card: event title, date, category, the name the result was listed under when it differs from the canonical one (the `listedAs_female` translation is used in women's categories), rank, score, a progress bar, block grid, and a diff badge comparing weighted score % vs. the previous result.
3. `components.jsx` — four pure display components: `BlockGrid` (coloured squares per block number), `ExternalLinkIcon`, `ProgressBar`, `StatCard`.
4. `i18n.js` — initialises i18next with `LanguageDetector`; bundles translations for `en`, `fr`, `de`, `it` from `src/locales/`.

**Analytics (GoatCounter via proxy):** EasyPrivacy blocks both `gc.zgo.at` and `goatcounter.com`, so neither is contacted from the browser.
1. `public/count.js` — vendored, unmodified copy of GoatCounter's `count.v4.js`, served same-origin. To update it, re-download `https://gc.zgo.at/count.v4.js`.
2. `index.html` — the `data-goatcounter` attribute points `count.js` at the Worker's `/hit` endpoint. `App.jsx` sends search events through the same path via `window.goatcounter.count()`.
3. `worker/src/index.js` — Cloudflare Worker. Accepts only `POST /hit` with `Origin` equal to `ALLOWED_ORIGIN`, maps `count.js` query params (`p`, `t`, `r`, `q`, `e`, `b`, `s`) to a hit, adds the visitor's real IP (`CF-Connecting-IP`), `User-Agent` and language, and forwards it to GoatCounter's `POST /api/v0/count` in the background. Replies 204 straight away.
4. `worker/wrangler.jsonc` — Worker name and the `ALLOWED_ORIGIN` / `GOATCOUNTER_URL` vars. The API token is the `GOATCOUNTER_TOKEN` secret, never committed; for local runs put it in `worker/.dev.vars`.

Avoid names containing tracker keywords (`beacon`, `analytics`, `collect`, `goatcounter`, …) for the script file, Worker name, or endpoint path; generic blocklist rules match them.

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

**Block data is arrays of 1-based block numbers** (`tops: [1, 3, 5]`, `zones: [2]`). `BlockGrid` iterates from 1 to `total` and checks `tops.includes(n)` / `zones.includes(n)`. If the scraper's parsing changes, update `parse_blocks()` in `scraper/scrape.py`.

**i18n:** all user-visible strings go through `t('key')`. Add keys to all four locale files (`src/locales/{en,fr,de,it}.json`) when adding new UI text. No inclusive writing (`inscrit·e`, `iscritto/a`): when a string depends on the athlete's gender, use an i18next context (`key_female`) picked from the category name (`Femmes` / `Homme`), with the masculine form as the base key.

**`vite.config.js`** sets `base: '/climbmania-tracker/'` for GitHub Pages deployment. Use `import.meta.env.BASE_URL` when constructing asset paths (e.g. the `events.json` fetch).
