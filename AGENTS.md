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
./scraper/scrape.sh --if-new-results       # scrapes only if an event passed 18:00 or 21:00 Swiss time since scrapedAt

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

## Terminology

Athlete names, in code, docs and conversation:
- **bold name**: the bold line of an athlete on a Climbmania results page, what they typed as their name (meant to be "Surname, First name", often a nickname or another format). `name` in `events.json`.
- **small name**: the smaller line under the bold name, the first and last name from the athlete's profile. `fullName` in `events.json`, present only when filled in and different from the bold name.
- **listed name**: the name a result counts under before merges: the small name when it spells out the bold name, otherwise the bold name. `listedName` in `events.json`, present only when it is the small name.
- **canonical name**: the first name of a group in `name-merges.json`, under which the app shows the athlete.
- **alias**: any other name of a group in `name-merges.json`.

Avoid "main name" and "full name": they are ambiguous.

## Architecture

A single-page React 19 + Vite app. Data is pre-scraped offline by a Python script and served as a static JSON file. The React app loads that JSON, then lets the user search for an athlete by name and visualises their tops and zones across all events.

There is **no live scraping** and **no Vite proxy** — the old CORS workaround has been removed entirely.

**Data pipeline:**
1. `scraper/scrape.py` — fetches the Climbmania group page to discover all events with results, then scrapes each event's results page. An event has results from 18:00 Swiss time on its date, when athletes can no longer enter blocks; only the ranking of the finalists can still change, until the finals end (21:00). Parses categories and athletes (rank, bold name, small name, listed name, points, block tops/zones), skips athletes with 0 points and any category or event left without athletes, and writes everything to `public/events.json`. Names are kept as listed on Climbmania. It then prints names that look like unmerged duplicates.
2. `public/events.json` — static snapshot served alongside the app. Shape: `{ scrapedAt, sourceUrl, events: [{ id, title, date, url, categories: [{ name, athletes: [{ rank, name, fullName?, listedName?, points, tops, zones, totalBlocks }] }] }] }`. `name` is the bold name and `fullName` the small name. The scraper sets `listedName` to the small name when it spells out an empty, single-word or abbreviated bold name (`Lina` → `Lina Mosertal`, `Tom B` → `Tom Brunnerhof`, each bold-name word starting a different word of the small name, but not a first and last name it only adds a middle name to): `completes()` in `scraper/merge_names.py`. The app and the scripts read `listedName`, falling back to `name`, before applying merges, so a change to `completes()` only shows after the next scrape. `tops` and `zones` are arrays of 1-based block numbers.
3. `public/name-merges.json` — JSON array of name groups: the canonical name first, then its aliases. The app loads it with `events.json` and shows every name of a group as one athlete under the canonical name. Lookups use the exact spelling, so a new spelling of a merged athlete (other case, accents or punctuation) stays separate until `merge_names.py --review` adds it as an alias.
4. `scraper/merge_names.py` — holds the duplicate detection imported by `scrape.py`, and is also a CLI. It finds candidate duplicates: names with the same words in any order (single words like `AnnaMuster` are split at capitals), names whose results share a small name (or whose small name has the same words as another name), or names with a `difflib` similarity ≥ 0.93. `--review` asks about each group, which can also be split into several athletes (`1+3 2`): names of one athlete are added to `name-merges.json` (extending an existing group when they overlap), and each pair of names found to be different people goes to `public/name-distinct.json`, so they are never suggested in the same group again. `events.json` is never rewritten, so no re-scrape is needed.
5. `public/athlete-links.json` — object mapping an athlete name to their profiles on other sites, e.g. `{ "Jana Beispiel": { "ifsc": 1234 } }`. The app maps each name through `name-merges.json`, so any name of a merge group works.
6. `scraper/athlete_links.py` — searches the IFSC results API (`https://ifsc.results.info/api/v1/athletes?name=`, needs a browser `User-Agent` and a `Referer`) for every athlete with a result outside the youth categories (M8–M17). It keeps IFSC athletes whose first and last name have the same words as one of the athlete's bold or small names, and whose gender matches the categories. The API only returns its 10 best results, so a name of three or more words is searched with its words in the order they were written. Search results are cached for a day in `scraper/.ifsc-cache.json` (not committed), so reviewing after listing, or resuming a review, does not query IFSC again. `--review` asks about each match, showing the IFSC country and birthday: accepted ones go to `athlete-links.json`, rejected ones go to `public/ifsc-rejected.json` so they are not suggested again. Each decision is saved straight away.

**Automatic updates:** `.github/workflows/update-events.yml` runs every day at 18:07 and 21:07 Swiss time (the cron sets `timezone`, so daylight saving time is handled) and calls `./scraper/scrape.sh --if-new-results`. That fetches only the group page, and does a full scrape only when an event passed 18:00 (results) or 21:00 (final ranking) since `scrapedAt` in `events.json`: two scrapes per event, none on other days. Every scrape is committed as `chore: update events` and pushed straight to master with the `DEPLOY_KEY` secret, a write deploy key that is in the bypass list of the master ruleset. Unlike a `GITHUB_TOKEN` push, that push triggers `deploy.yml`. A failed run is retried by the next one, because `scrapedAt` only moves when a scrape lands. A manual run does the same check, unless its `force` input is ticked: it then always scrapes and commits, even when only `scrapedAt` changes. Name merges are not automated: new names stay separate until `merge_names.py --review`.

**React data flow:**
1. `App.jsx` — fetches `events.json`, `name-merges.json` and `athlete-links.json` on mount, shows the load error if any of them fails, and maps each result to its athlete's canonical name. The autocomplete shows one line per athlete with their other names ("a.k.a."); a query matches any of those names, ignoring case and accents. Results are always for one athlete picked from the autocomplete: Search picks the only athlete whose canonical name equals the query, or the only match, and otherwise opens the autocomplete. Computes summary stats (best tops/zones rate, best rank, best points) from results, and shows one line above them, below the legend, with the athlete's profile links (sites in `PROFILE_SITES`) and their other names, each with a dashed underline.
2. `EventCard.jsx` — renders a single event result card: event title, date, category, the listed name when it differs from the canonical name (the `listedAs_female` translation is used in women's categories), rank, score, a progress bar, block grid, and a diff badge comparing weighted score % vs. the previous result.
3. `components.jsx` — four pure display components: `BlockGrid` (coloured squares per block number), `ExternalLinkIcon`, `ProgressBar`, `StatCard`.
4. `i18n.js` — initialises i18next with `LanguageDetector`; bundles translations for `en`, `fr`, `de`, `it` from `src/locales/`.

**Analytics (GoatCounter via proxy):** EasyPrivacy blocks both `gc.zgo.at` and `goatcounter.com`, so neither is contacted from the browser. It also blocks every third-party `navigator.sendBeacon` request (`*$ping,third-party`), so hits are sent with `fetch` instead.
1. `public/count.js` — vendored, unmodified copy of GoatCounter's `count.v4.js`, served same-origin. To update it, re-download `https://gc.zgo.at/count.v4.js`.
2. `index.html` — an inline script, which must stay before the `count.js` tag, replaces `navigator.sendBeacon` with a `fetch` POST (`keepalive`, `no-cors`), which blockers see as `xmlhttprequest` rather than `ping`. The `data-goatcounter` attribute points `count.js` at the Worker's `/hit` endpoint. `App.jsx` sends search events through the same path via `window.goatcounter.count()`, with the raw query as the event path (`/search/<query>`).
3. `worker/src/index.js` — Cloudflare Worker. Accepts only `POST /hit` with `Origin` equal to `ALLOWED_ORIGIN`, maps `count.js` query params (`p`, `t`, `r`, `q`, `e`, `b`, `s`) to a hit, adds the visitor's real IP (`CF-Connecting-IP`), `User-Agent` and language, and forwards it to GoatCounter's `POST /api/v0/count` in the background. Replies 204 straight away.
4. `worker/wrangler.jsonc` — Worker name and the `ALLOWED_ORIGIN` / `GOATCOUNTER_URL` vars. Workers Logs are enabled, so failed forwards logged by the Worker can be searched in the Cloudflare dashboard after the fact. The API token is the `GOATCOUNTER_TOKEN` secret, never committed; for local runs put it in `worker/.dev.vars`.

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
