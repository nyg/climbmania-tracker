#!/usr/bin/env python3
"""Find athlete names in events.json that probably belong to the same athlete.

events.json keeps each name as listed on Climbmania; the app shows every name
of a merge group in name-merges.json as one athlete.  This script lists names
that are not merged yet: the same words in another order, case, punctuation or
accentuation, spellings a typo apart, or results whose athletes gave the same
first and last name.  With --review, each candidate group is shown for a
decision; accepted groups go to name-merges.json, and groups rejected as
different people go to name-distinct.json so they are not suggested again.

Only needs the standard library, so it runs without the scraper's venv.
"""

import argparse
import json
import re
import shlex
import sys
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Iterator
from difflib import SequenceMatcher
from itertools import combinations
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
EVENTS_PATH = _ROOT / "public" / "events.json"
MERGES_PATH = _ROOT / "public" / "name-merges.json"
DISTINCT_PATH = _ROOT / "public" / "name-distinct.json"

# Minimum difflib ratio for two differently spelled names to be suggested
SIMILARITY_THRESHOLD = 0.93

SAME_WORDS = "same words"
SAME_FULL_NAME = "same full name"
SIMILAR_SPELLING = "similar spelling"


# ---------------------------------------------------------------------------
# Merge groups
# ---------------------------------------------------------------------------


def name_key(name: str) -> str:
    """Return *name* lowercased, without diacritics, punctuation or extra spaces."""
    n = unicodedata.normalize("NFD", name.lower().strip())
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    return re.sub(r"\s+", " ", n).strip()


def load_groups(path: Path) -> list[list[str]]:
    """Return the name groups stored in *path*, or [] if it does not exist."""
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def save_groups(path: Path, groups: list[list[str]]) -> None:
    groups = sorted(groups, key=lambda g: g[0].casefold())
    path.write_text(json.dumps(groups, ensure_ascii=False, indent=2), encoding="utf-8")


def load_merge_map(path: Path = MERGES_PATH) -> dict[str, str]:
    """Return name key → canonical name.

    Each group in the merge file lists the canonical name first, then its
    aliases.  Keys come from name_key(), so lookups ignore case and diacritics.
    """
    merge_map: dict[str, str] = {}
    for canonical, *aliases in load_groups(path):
        for alias in aliases:
            merge_map[name_key(alias)] = canonical
        # Also map the canonical's own key so it round-trips cleanly
        merge_map[name_key(canonical)] = canonical
    return merge_map


def athlete_name(result: dict, merge_map: dict[str, str]) -> str:
    name = result["name"]
    full_name = result.get("fullName")
    if full_name and completes(full_name, name):
        name = full_name
    return merge_map.get(name_key(name), name)


def _canonical_results(events: list[dict], merge_map: dict[str, str]) -> Iterator[tuple[str, str, str | None]]:
    for event in events:
        for category in event["categories"]:
            for athlete in category["athletes"]:
                yield athlete_name(athlete, merge_map), category["name"], athlete.get("fullName")


# ---------------------------------------------------------------------------
# Candidate detection
# ---------------------------------------------------------------------------


def match_key(name: str) -> str:
    """Return the words of name_key(*name*) without digits, sorted, so word order and digits do not matter.

    A single word like "BasileRoch" is split at its inner capitals first.
    """
    if " " not in name.strip():
        name = re.sub(r"(?<=[a-zß-ÿ])(?=[A-ZÀ-Þ])", " ", name)
    return " ".join(sorted(re.sub(r"[0-9]", " ", name_key(name)).split()))


def completes(full_name: str, name: str) -> bool:
    words = match_key(name).split()
    full_words = match_key(full_name).split()
    single_word = len(name.replace(",", " ").split()) == 1
    abbreviated = any(word not in full_words for word in words)
    return (
        len(full_words) > 1
        and all(any(full_word.startswith(word) for full_word in full_words) for word in words)
        and (single_word or abbreviated)
    )


def _is_tidy(name: str) -> bool:
    """True for names like "Anaïs Bigler": capitalised words, single spaces, letters only."""
    words = name.split(" ")
    return len(words) > 1 and all(w[:1].isupper() and re.sub(r"[-']", "", w).isalpha() for w in words)


def _similar_keys(keys: list[str]) -> list[tuple[str, str, float]]:
    """Return (key, key, ratio) for pairs of distinct keys at least SIMILARITY_THRESHOLD alike.

    Only keys sharing a word are compared (a typo rarely hits every word of a
    name), except single-word keys, which are compared with everything.
    """
    by_word: dict[str, set[str]] = defaultdict(set)
    for key in keys:
        for word in key.split():
            by_word[word].add(key)
    single_words = {key for key in keys if " " not in key}

    pairs = []
    for key in keys:
        if " " in key:
            others = set().union(*(by_word[w] for w in key.split())) | single_words
        else:
            others = set(keys)
        matcher = SequenceMatcher(None, b=key, autojunk=False)
        for other in others:
            if other <= key:  # each pair once, and never a key with itself
                continue
            matcher.set_seq1(other)
            if (
                matcher.real_quick_ratio() >= SIMILARITY_THRESHOLD
                and matcher.quick_ratio() >= SIMILARITY_THRESHOLD
                and (ratio := matcher.ratio()) >= SIMILARITY_THRESHOLD
            ):
                pairs.append((key, other, ratio))
    return pairs


def find_candidates(
    events: list[dict],
    merges_path: Path = MERGES_PATH,
    distinct_path: Path = DISTINCT_PATH,
) -> list[dict]:
    """Return groups of names in *events* that probably belong to one athlete.

    Names already in a merge group count as its canonical name.  Each candidate
    is {"names": [...], "counts": [...], "reasons": {reason: score}}, where
    counts are the number of results per name.  The suggested canonical
    name comes first: the canonical of an existing merge group if the candidate
    extends one, else the most frequent name.  The reasons say what links the
    group: the same words, the same full name (the first and last name given
    next to the name), or a similar spelling; each score is the lowest
    similarity linking the group that way.
    Pairs listed together in name-distinct.json are never suggested.
    """
    counts: Counter[str] = Counter()
    names_by_full_name: dict[str, set[str]] = defaultdict(set)
    for name, _, full_name in _canonical_results(events, load_merge_map(merges_path)):
        counts[name] += 1
        if full_name:
            names_by_full_name[match_key(full_name)].add(name)

    distinct = {frozenset((a, b)) for group in load_groups(distinct_path) for a in group for b in group if a != b}

    names_by_key: dict[str, list[str]] = defaultdict(list)
    for name in counts:
        names_by_key[match_key(name)].append(name)

    edges = [(a, b, SAME_WORDS, 1.0) for names in names_by_key.values() for a, b in combinations(names, 2)]
    for key_a, key_b, ratio in _similar_keys(list(names_by_key)):
        edges += [(a, b, SIMILAR_SPELLING, ratio) for a in names_by_key[key_a] for b in names_by_key[key_b]]
    for key, names in names_by_full_name.items():
        linked = sorted(names.union(names_by_key.get(key, [])))
        edges += [(a, b, SAME_FULL_NAME, 1.0) for a, b in combinations(linked, 2)]

    # Union-find over the edges that are not known to link different people
    parent = {name: name for name in counts}

    def root(name: str) -> str:
        while parent[name] != name:
            parent[name] = parent[parent[name]]
            name = parent[name]
        return name

    reasons: dict[str, dict[str, float]] = {}
    for a, b, reason, ratio in edges:
        if frozenset((a, b)) in distinct:
            continue
        ra, rb = root(a), root(b)
        if ra == rb:
            continue
        parent[ra] = rb
        joined = reasons.pop(ra, {})
        for known, score in reasons.get(rb, {}).items():
            joined[known] = min(score, joined.get(known, 1.0))
        joined[reason] = min(ratio, joined.get(reason, 1.0))
        reasons[rb] = joined

    components: dict[str, list[str]] = defaultdict(list)
    for name in counts:
        components[root(name)].append(name)

    canonicals = {group[0] for group in load_groups(merges_path)}
    candidates = []
    for r, names in components.items():
        if len(names) < 2:
            continue
        names.sort(key=lambda n: (n not in canonicals, -counts[n], not _is_tidy(n), n.casefold()))
        candidates.append({"names": names, "counts": [counts[n] for n in names], "reasons": reasons[r]})
    return sorted(candidates, key=lambda c: c["names"][0].casefold())


def describe_reasons(reasons: dict[str, float]) -> str:
    return ", ".join(reason if score == 1.0 else f"{reason} {score:.2f}" for reason, score in sorted(reasons.items()))


def print_candidates(candidates: list[dict], review_cmd: str) -> None:
    """Print a one-line summary per candidate group."""
    if not candidates:
        print("No new duplicate athlete names found.")
        return
    print(f"{len(candidates)} possible duplicate athlete names not in name-merges.json:")
    for candidate in candidates:
        names = " = ".join(f"{n} ({count}×)" for n, count in zip(candidate["names"], candidate["counts"]))
        print(f"  {names}  [{describe_reasons(candidate['reasons'])}]")
    print(f"Review them with: {review_cmd}")


# ---------------------------------------------------------------------------
# Interactive review
# ---------------------------------------------------------------------------


def _merge_group(groups: list[list[str]], names: list[str], canonical: str) -> list[list[str]]:
    """Return *groups* with *names* merged under *canonical*, absorbing any group they overlap."""
    keys = {name_key(n) for n in names}
    merged = [canonical]
    kept = []
    for group in groups:
        if any(name_key(n) in keys for n in group):
            merged += group
        else:
            kept.append(group)
    merged += names
    return kept + [list(dict.fromkeys(merged))]


def review(candidates: list[dict], events: list[dict], merges_path: Path, distinct_path: Path) -> None:
    """Ask about each candidate group and save the decisions."""
    categories: dict[str, set[str]] = defaultdict(set)
    full_names: dict[str, set[str]] = defaultdict(set)
    for name, category, full_name in _canonical_results(events, load_merge_map(merges_path)):
        categories[name].add(category)
        if full_name:
            full_names[name].add(full_name)

    merges = load_groups(merges_path)
    distinct = load_groups(distinct_path)
    merged = rejected = 0

    print("For each group, answer:")
    print("  y       same athlete, keep name 1")
    print("  number  same athlete, keep that name")
    print("  n       different people, never suggest again")
    print("  s       skip for now (default)")
    print("  q       save and quit")

    for i, candidate in enumerate(candidates, start=1):
        names = candidate["names"]
        print(f"\n[{i}/{len(candidates)}] Same athlete? ({describe_reasons(candidate['reasons'])})")
        for n, (name, count) in enumerate(zip(names, candidate["counts"]), start=1):
            cats = sorted(categories[name])
            shown = ", ".join(cats[:2]) + (", …" if len(cats) > 2 else "")
            given = f" · full name: {', '.join(sorted(full_names[name]))}" if full_names[name] else ""
            print(f"  {n}) {name}  — {count}× · {shown}{given}")

        valid = {"y", "n", "s", "q", ""} | {str(n) for n in range(1, len(names) + 1)}
        answer = None
        while answer not in valid:
            try:
                answer = input(f"  [y/1-{len(names)}/n/s/q, default s] ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print()
                answer = "q"

        if answer == "q":
            break
        if answer == "n":
            distinct.append(sorted(names, key=str.casefold))
            rejected += 1
        elif answer == "y" or answer.isdigit():
            canonical = names[int(answer) - 1] if answer.isdigit() else names[0]
            merges = _merge_group(merges, names, canonical)
            merged += 1

    if merged:
        save_groups(merges_path, merges)
    if rejected:
        save_groups(distinct_path, distinct)
    print(f"\nMerged {merged} group(s) into {merges_path.name}, marked {rejected} as different people.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Find athlete names in events.json that probably belong to one athlete.")
    parser.add_argument(
        "--events", default=str(EVENTS_PATH), help="Scraped events JSON file (default: public/events.json)"
    )
    parser.add_argument("--review", action="store_true", help="Decide on each candidate group interactively")
    args = parser.parse_args()

    events = json.loads(Path(args.events).read_text(encoding="utf-8"))["events"]
    candidates = find_candidates(events)

    if not args.review:
        print_candidates(candidates, shlex.join(["./scraper/merge_names.py", *sys.argv[1:], "--review"]))
    elif not candidates:
        print("No new duplicate athlete names found.")
    else:
        review(candidates, events, MERGES_PATH, DISTINCT_PATH)


if __name__ == "__main__":
    main()
