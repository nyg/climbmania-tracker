#!/usr/bin/env python3

import argparse
import json
import re
import shlex
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from collections.abc import Iterator
from pathlib import Path

from merge_names import EVENTS_PATH, athlete_name, load_merge_map, match_key, name_key

_ROOT = Path(__file__).resolve().parent.parent
LINKS_PATH = _ROOT / "public" / "athlete-links.json"
REJECTED_PATH = _ROOT / "public" / "ifsc-rejected.json"

IFSC_SEARCH_URL = "https://ifsc.results.info/api/v1/athletes?name="
IFSC_PROFILE_URL = "https://ifsc.results.info/athlete/"
IFSC_HEADERS = {
    "Referer": "https://ifsc.results.info/",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}
RETRY_COUNT = 3
RETRY_DELAY = 2.0

GENDERS = {"Homme": "male", "Femmes": "female"}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: dict) -> None:
    ordered = dict(sorted(data.items(), key=lambda item: item[0].casefold()))
    path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2), encoding="utf-8")


def is_youth_category(category: str) -> bool:
    age = re.match(r"M(\d+)\b", category)
    return bool(age) and int(age[1]) < 18


def collect_adult_athletes(events: list[dict], merge_map: dict[str, str]) -> dict[str, dict]:
    athletes: dict[str, dict] = defaultdict(lambda: {"names": set(), "categories": set(), "results": 0})
    for event in events:
        for category in event["categories"]:
            for result in category["athletes"]:
                name = athlete_name(result, merge_map)
                athlete = athletes[name]
                athlete["names"].update(filter(None, [name, result["name"], result.get("fullName")]))
                athlete["categories"].add(category["name"])
                athlete["results"] += 1
    return {
        name: athlete
        for name, athlete in athletes.items()
        if not all(is_youth_category(category) for category in athlete["categories"])
    }


def search_ifsc(query: str) -> list[dict]:
    request = urllib.request.Request(IFSC_SEARCH_URL + urllib.parse.quote(query), headers=IFSC_HEADERS)
    for attempt in range(1, RETRY_COUNT + 2):
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            if attempt <= RETRY_COUNT:
                time.sleep(RETRY_DELAY)
            else:
                clear_progress()
                print(f"  ✗ IFSC search for {query!r} failed: {exc}", file=sys.stderr)
    return []


def ifsc_matches(athlete: dict, rejected_ids: set[int], delay: float) -> list[dict]:
    keys = {key for key in map(match_key, athlete["names"]) if " " in key}
    genders = {GENDERS[word] for category in athlete["categories"] for word in category.split() if word in GENDERS}
    matches: dict[int, dict] = {}
    for key in sorted(keys):
        for person in search_ifsc(key):
            if (
                match_key(f"{person['firstname']} {person['lastname']}") in keys
                and (not genders or not person.get("gender") or person["gender"] in genders)
                and person["id"] not in rejected_ids
            ):
                matches[person["id"]] = person
        time.sleep(delay)
    return list(matches.values())


def find_candidates(
    events: list[dict], links: dict, rejected: dict, delay: float
) -> Iterator[tuple[int, int, str, dict, list[dict]]]:
    merge_map = load_merge_map()

    def canonical(name: str) -> str:
        return merge_map.get(name_key(name), name)

    linked = {canonical(name) for name, sites in links.items() if "ifsc" in sites}
    rejected_ids: dict[str, set[int]] = defaultdict(set)
    for name, ids in rejected.items():
        rejected_ids[canonical(name)].update(ids)

    athletes = collect_adult_athletes(events, merge_map)
    todo = sorted((name for name in athletes if name not in linked), key=str.casefold)
    for i, name in enumerate(todo, start=1):
        show_progress(i, len(todo))
        matches = ifsc_matches(athletes[name], rejected_ids[name], delay)
        if matches:
            clear_progress()
            yield i, len(todo), name, athletes[name], matches
    clear_progress()


def show_progress(done: int, total: int) -> None:
    if sys.stderr.isatty():
        print(f"\r\033[K  searching IFSC… {done}/{total}", end="", file=sys.stderr, flush=True)


def clear_progress() -> None:
    if sys.stderr.isatty():
        print("\r\033[K", end="", file=sys.stderr, flush=True)


def describe_person(person: dict) -> str:
    details = [f"{person['firstname']} {person['lastname']}", person.get("ioc_code")]
    if person.get("birthday"):
        details.append(f"born {person['birthday']}")
    details.append(f"{IFSC_PROFILE_URL}{person['id']}")
    return " · ".join(filter(None, details))


def describe_athlete(name: str, athlete: dict) -> str:
    categories = sorted(athlete["categories"])
    shown = ", ".join(categories[:2]) + (", …" if len(categories) > 2 else "")
    return f"{name}  — {athlete['results']}× · {shown}"


def print_candidates(candidates: Iterator, review_cmd: str) -> None:
    found = 0
    for _, _, name, athlete, matches in candidates:
        found += 1
        print(describe_athlete(name, athlete))
        for person in matches:
            print(f"    = {describe_person(person)}")
    if not found:
        print("No new IFSC profiles found.")
        return
    print(f"{found} athlete(s) with a possible IFSC profile not in {LINKS_PATH.name}.")
    print(f"Review them with: {review_cmd}")


def review(candidates: Iterator, links: dict, rejected: dict) -> None:
    linked = rejected_count = 0

    print("For each athlete, answer:")
    print("  y       the IFSC profile is this athlete")
    print("  number  that IFSC profile is this athlete")
    print("  n       none of them is, never suggest them again")
    print("  s       skip for now (default)")
    print("  q       quit")

    for i, total, name, athlete, matches in candidates:
        print(f"\n[{i}/{total}] {describe_athlete(name, athlete)}")
        for n, person in enumerate(matches, start=1):
            print(f"  {n}) {describe_person(person)}")

        numbers = {str(n) for n in range(1, len(matches) + 1)}
        valid = {"n", "s", "q", ""} | numbers | ({"y"} if len(matches) == 1 else set())
        choices = "y" if len(matches) == 1 else f"1-{len(matches)}"
        answer = None
        while answer not in valid:
            try:
                answer = input(f"  [{choices}/n/s/q, default s] ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print()
                answer = "q"

        if answer == "q":
            break
        if answer == "n":
            rejected[name] = sorted(set(rejected.get(name, [])) | {person["id"] for person in matches})
            save_json(REJECTED_PATH, rejected)
            rejected_count += 1
        elif answer in numbers or answer == "y":
            person = matches[int(answer) - 1] if answer in numbers else matches[0]
            links[name] = {**links.get(name, {}), "ifsc": person["id"]}
            save_json(LINKS_PATH, links)
            linked += 1

    print(f"\nLinked {linked} athlete(s) in {LINKS_PATH.name}, rejected {rejected_count} in {REJECTED_PATH.name}.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Find IFSC profiles of athletes in events.json and link them in athlete-links.json."
    )
    parser.add_argument(
        "--events", default=str(EVENTS_PATH), help="Scraped events JSON file (default: public/events.json)"
    )
    parser.add_argument(
        "--delay", type=float, default=0.2, help="Seconds to wait between IFSC requests (default: 0.2)"
    )
    parser.add_argument("--review", action="store_true", help="Decide on each possible profile interactively")
    args = parser.parse_args()

    events = json.loads(Path(args.events).read_text(encoding="utf-8"))["events"]
    links = load_json(LINKS_PATH)
    rejected = load_json(REJECTED_PATH)
    candidates = find_candidates(events, links, rejected, args.delay)

    if args.review:
        review(candidates, links, rejected)
    else:
        print_candidates(candidates, shlex.join(["./scraper/athlete_links.py", *sys.argv[1:], "--review"]))


if __name__ == "__main__":
    main()
