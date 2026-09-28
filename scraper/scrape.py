#!/usr/bin/env python3
"""Scrape all Climbmania event results and write them to a JSON file."""

import argparse
import json
import re
import shlex
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from merge_names import EVENTS_PATH, find_candidates, print_candidates

GROUP_URL = "https://climbmania.ch/fr/groups/1"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}


RETRY_COUNT = 3
RETRY_DELAY = 2.0  # seconds between retries


def fetch(url: str, session: requests.Session) -> BeautifulSoup | None:
    for attempt in range(1, RETRY_COUNT + 2):  # 1 initial + RETRY_COUNT retries
        try:
            resp = session.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as exc:
            if attempt <= RETRY_COUNT:
                print(f"  ⟳ attempt {attempt} failed ({exc}), retrying in {RETRY_DELAY}s…", file=sys.stderr)
                time.sleep(RETRY_DELAY)
            else:
                print(f"  ✗ giving up after {RETRY_COUNT} retries: {exc}", file=sys.stderr)
    return None


def discover_events(soup: BeautifulSoup) -> list[dict]:
    """Return list of {id, title, date, url} from the group page."""
    events = []

    for anchor in soup.find_all("a", href=re.compile(r"/events/(\d+)/results")):
        href = anchor["href"]
        m = re.search(r"/events/(\d+)/results", href)
        if not m:
            continue

        event_id = int(m.group(1))
        url = href if href.startswith("http") else f"https://climbmania.ch{href}"

        # Walk up to the ibox-content container to find title and date
        container = anchor.find_parent(class_="ibox-content")
        title = ""
        date = ""
        if container:
            h1 = container.find("h1")
            if h1:
                title = h1.get_text(separator=" ", strip=True)

            h3 = container.find("h3")
            if h3:
                # Extract bold date text, e.g. "Saturday 9 May 2026"
                bolds = h3.find_all("b")
                if bolds:
                    date = bolds[0].get_text(strip=True)

        events.append({"id": event_id, "title": title, "date": date, "url": url})

    # Deduplicate by ID while preserving order
    seen = set()
    unique = []
    for ev in events:
        if ev["id"] not in seen:
            seen.add(ev["id"])
            unique.append(ev)

    return unique


def parse_category_name(header_row) -> str:
    """Extract a clean category name from the first row of a results table."""
    text = header_row.get_text(separator=" ", strip=True)
    # Collapse whitespace and non-breaking spaces
    text = re.sub(r"[\s\xa0]+", " ", text).strip()
    # Remove the isolated athlete-count number injected before the year range
    # e.g. "M9 Femmes 7 2018 - 2024" → "M9 Femmes 2018 - 2024"
    text = re.sub(r"\b\d{1,3}\b(?=\s+\d{4})", "", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def parse_blocks(block_cell) -> tuple[list[int], list[int], int]:
    """Return (tops, zones, total_blocks) from the block-grid cell."""
    if not block_cell:
        return [], [], 0

    tds = block_cell.find_all("td", recursive=True)
    tops: list[int] = []
    zones: list[int] = []
    block_num = 0

    for td in tds:
        classes = td.get("class", [])
        if "fixed-size" not in classes:
            continue
        block_num += 1
        if "top-ok" in classes:
            tops.append(block_num)
        elif "zone-ok" in classes:
            zones.append(block_num)

    return tops, zones, block_num


def parse_athlete_row(row) -> dict | None:
    """Parse a single athlete <tr> into a dict, or return None if not an athlete row."""
    cells = row.find_all("td", recursive=False)
    if len(cells) < 3:
        return None

    # Rank cell must look like a number (possibly prefixed with *)
    rank_text = cells[0].get_text(strip=True).lstrip("*").strip()
    try:
        rank = int(rank_text)
    except ValueError:
        rank = rank_text or None

    # Name cell
    name_cell = cells[1]
    name = _cell_text(name_cell.find("b") or name_cell)
    full_name = _cell_text(name_cell.find("small"))

    # Points cell
    points = 0
    if len(cells) > 2:
        try:
            points = int(cells[2].get_text(strip=True))
        except ValueError:
            pass

    # Block grid cell (4th column)
    tops, zones, total_blocks = parse_blocks(cells[3] if len(cells) > 3 else None)

    athlete = {
        "rank": rank,
        "name": name,
        "points": points,
        "tops": tops,
        "zones": zones,
        "totalBlocks": total_blocks,
    }
    if full_name and full_name != name:
        athlete["fullName"] = full_name
    return athlete


def _cell_text(tag) -> str:
    return " ".join(tag.get_text(" ").split()) if tag else ""


def parse_results_page(soup: BeautifulSoup) -> list[dict]:
    """Return a list of categories, each with a list of athlete dicts.

    The page has a single <table class="results-table"> whose rows are grouped
    into multiple <tbody> elements — one per competition category.  The first
    row of each tbody is the category header; subsequent rows are athletes.
    """
    categories: list[dict] = []

    results_table = soup.find("table", class_="results-table")
    if not results_table:
        return categories

    for tbody in results_table.find_all("tbody"):
        rows = tbody.find_all("tr", recursive=False)
        if not rows:
            continue

        category_name = parse_category_name(rows[0])
        athletes: list[dict] = []

        for row in rows[1:]:
            athlete = parse_athlete_row(row)
            if athlete and athlete["points"] > 0:
                athletes.append(athlete)

        if athletes:
            categories.append({"name": category_name, "athletes": athletes})

    return categories


def _parse_event_date(date_str: str) -> datetime | None:
    """Parse an event date string like 'Saturday 9 May 2026'. Returns None on failure."""
    try:
        return datetime.strptime(date_str.strip(), "%A %d %B %Y")
    except ValueError:
        return None


def scrape(output: str, delay: float, since: date | None) -> None:
    session = requests.Session()

    print(f"Fetching group page: {GROUP_URL}")
    group_soup = fetch(GROUP_URL, session)
    if not group_soup:
        print("Failed to fetch group page.", file=sys.stderr)
        sys.exit(1)

    today = datetime.now(timezone.utc).replace(tzinfo=None).date()
    all_events = discover_events(group_soup)
    events_meta = []
    for ev in all_events:
        parsed = _parse_event_date(ev["date"])
        if parsed is not None and parsed.date() > today:
            print(f"  ↷ Skipping future event {ev['id']} — {ev['title']} ({ev['date']})")
        else:
            events_meta.append(ev)

    total = len(events_meta)
    print(f"Found {total} past events.\n")

    previous: dict[int, dict] = {}
    if since and Path(output).exists():
        previous = {e["id"]: e for e in json.loads(Path(output).read_text(encoding="utf-8"))["events"]}

    events_out: list[dict] = []

    for i, meta in enumerate(events_meta, start=1):
        print(f"[{i}/{total}] Event {meta['id']} — {meta['title']}")

        parsed = _parse_event_date(meta["date"])
        if since and parsed is not None and parsed.date() < since:
            if meta["id"] in previous:
                events_out.append(previous[meta["id"]])
                print(f"  Kept from {output} (before {since}).")
            continue

        time.sleep(delay)

        results_soup = fetch(meta["url"], session)
        if not results_soup:
            print(f"  Skipping event {meta['id']} (fetch failed).")
            continue

        categories = parse_results_page(results_soup)
        if not categories:
            print(f"  Skipping event {meta['id']} (no scored athletes).")
            continue

        athlete_count = sum(len(c["athletes"]) for c in categories)
        print(f"  {len(categories)} categories, {athlete_count} athletes")

        events_out.append(
            {
                "id": meta["id"],
                "title": meta["title"],
                "date": meta["date"],
                "url": meta["url"],
                "categories": categories,
            }
        )

    payload = {
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "sourceUrl": GROUP_URL,
        "events": events_out,
    }

    with open(output, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\nWrote {len(events_out)} events to {output}\n")

    events_arg = [] if Path(output).resolve() == EVENTS_PATH else ["--events", output]
    print_candidates(find_candidates(events_out), shlex.join(["./scraper/merge_names.py", *events_arg, "--review"]))


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape Climbmania event results.")
    parser.add_argument(
        "--output", default=str(EVENTS_PATH), help="Output JSON file (default: public/events.json)"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.2,
        help="Seconds to wait between requests (default: 0.2)",
    )
    parser.add_argument(
        "--since",
        type=date.fromisoformat,
        help="Only scrape events on or after this date (YYYY-MM-DD); older events are kept from the existing output file",
    )
    args = parser.parse_args()
    scrape(args.output, args.delay, args.since)


if __name__ == "__main__":
    main()
