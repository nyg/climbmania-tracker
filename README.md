# Climbmania Tracker · Block Progress

A React app that visualises a bouldering athlete's tops and zones across
Climbmania events — event by event, with a block-level grid per result.

## How it works

- Event data is pre-scraped (`scraper/scrape.sh`) and bundled as `public/events.json`.
- The app loads that JSON, lets you search for an athlete by name, and
  shows their rank, points, tops, and zones for every event they entered.
- Hovering over a block, or tapping it, shows how many points its top and zone are worth.
- The interface is translated into French, German, Italian and English, and picks the
  right language automatically from the browser locale.

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start the dev server
pnpm dev

# 3. Open the URL printed by the dev server, enter an athlete name and hit the Enter key
```
