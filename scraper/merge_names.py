#!/usr/bin/env python3

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

SIMILARITY_THRESHOLD = 0.93

SAME_WORDS = "same words"
SAME_SMALL_NAME = "same small name"
SIMILAR_SPELLING = "similar spelling"


def name_key(name: str) -> str:
    n = unicodedata.normalize("NFD", name.lower().strip())
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    n = re.sub(r"[^a-z ]", " ", n)
    return re.sub(r"\s+", " ", n).strip()


def load_groups(path: Path) -> list[list[str]]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def save_groups(path: Path, groups: list[list[str]]) -> None:
    groups = sorted(groups, key=lambda g: g[0].casefold())
    path.write_text(json.dumps(groups, ensure_ascii=False, indent=2), encoding="utf-8")


def load_merge_map(path: Path = MERGES_PATH) -> dict[str, str]:
    merge_map: dict[str, str] = {}
    for canonical, *aliases in load_groups(path):
        for alias in aliases:
            merge_map[alias] = canonical
        merge_map[canonical] = canonical
    return merge_map


def athlete_name(result: dict, merge_map: dict[str, str]) -> str:
    name = result["name"]
    full_name = result.get("fullName")
    if full_name and completes(full_name, name):
        name = full_name
    return merge_map.get(name, name)


def _canonical_results(events: list[dict], merge_map: dict[str, str]) -> Iterator[tuple[str, str, str | None]]:
    for event in events:
        for category in event["categories"]:
            for athlete in category["athletes"]:
                yield athlete_name(athlete, merge_map), category["name"], athlete.get("fullName")


def match_key(name: str) -> str:
    if " " not in name.strip():
        name = re.sub(r"(?<=[a-zß-ÿ])(?=[A-ZÀ-Þ])", " ", name)
    return " ".join(sorted(name_key(name).split()))


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
    words = name.split(" ")
    return len(words) > 1 and all(w[:1].isupper() and re.sub(r"[-']", "", w).isalpha() for w in words)


def _similar_keys(keys: list[str]) -> list[tuple[str, str, float]]:
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
            if other <= key:
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
    merge_map = load_merge_map(merges_path)
    counts: Counter[str] = Counter()
    categories: dict[str, set[str]] = defaultdict(set)
    full_names: dict[str, set[str]] = defaultdict(set)
    names_by_full_name: dict[str, set[str]] = defaultdict(set)
    for name, category, full_name in _canonical_results(events, merge_map):
        counts[name] += 1
        categories[name].add(category)
        if full_name:
            full_names[name].add(full_name)
            names_by_full_name[match_key(full_name)].add(name)

    names_by_key: dict[str, list[str]] = defaultdict(list)
    for name in counts:
        names_by_key[match_key(name)].append(name)

    edges = [(a, b, SAME_WORDS, 1.0) for names in names_by_key.values() for a, b in combinations(names, 2)]
    for key_a, key_b, ratio in _similar_keys(list(names_by_key)):
        edges += [(a, b, SIMILAR_SPELLING, ratio) for a in names_by_key[key_a] for b in names_by_key[key_b]]
    for key, names in names_by_full_name.items():
        linked = sorted(names.union(names_by_key.get(key, [])))
        edges += [(a, b, SAME_SMALL_NAME, 1.0) for a, b in combinations(linked, 2)]

    parent = {name: name for name in counts}
    members = {name: {name} for name in counts}
    excluded: dict[str, set[str]] = {name: set() for name in counts}
    for group in load_groups(distinct_path):
        canonical_group = {merge_map.get(name, name) for name in group}
        for name in canonical_group:
            if name in excluded:
                excluded[name].update(canonical_group - {name})

    def root(name: str) -> str:
        while parent[name] != name:
            parent[name] = parent[parent[name]]
            name = parent[name]
        return name

    reasons: dict[str, dict[str, float]] = {}
    for a, b, reason, ratio in edges:
        ra, rb = root(a), root(b)
        if ra == rb or not excluded[ra].isdisjoint(members[rb]):
            continue
        parent[ra] = rb
        members[rb] |= members.pop(ra)
        excluded[rb] |= excluded.pop(ra)
        joined = reasons.pop(ra, {})
        for known, score in reasons.get(rb, {}).items():
            joined[known] = min(score, joined.get(known, 1.0))
        joined[reason] = min(ratio, joined.get(reason, 1.0))
        reasons[rb] = joined

    canonicals = {group[0] for group in load_groups(merges_path)}
    candidates = []
    for r, group in members.items():
        if len(group) < 2:
            continue
        names = sorted(group, key=lambda n: (n not in canonicals, -counts[n], not _is_tidy(n), n.casefold()))
        candidates.append(
            {
                "names": names,
                "counts": [counts[n] for n in names],
                "categories": [sorted(categories[n]) for n in names],
                "full_names": [sorted(full_names[n]) for n in names],
                "reasons": reasons[r],
            }
        )
    return sorted(candidates, key=lambda c: c["names"][0].casefold())


def describe_reasons(reasons: dict[str, float]) -> str:
    return ", ".join(reason if score == 1.0 else f"{reason} {score:.2f}" for reason, score in sorted(reasons.items()))


def print_candidates(candidates: list[dict], review_cmd: str) -> None:
    if not candidates:
        print("No new duplicate athlete names found.")
        return
    print(f"{len(candidates)} possible duplicate athlete names not in name-merges.json:")
    for candidate in candidates:
        names = " = ".join(f"{n} ({count}×)" for n, count in zip(candidate["names"], candidate["counts"]))
        print(f"  {names}  [{describe_reasons(candidate['reasons'])}]")
    print(f"Review them with: {review_cmd}")


def _merge_group(groups: list[list[str]], names: list[str], canonical: str) -> list[list[str]]:
    merged = [canonical]
    kept = []
    for group in groups:
        if any(n in names for n in group):
            merged += group
        else:
            kept.append(group)
    merged += names
    return kept + [list(dict.fromkeys(merged))]


def _parse_answer(answer: str, count: int) -> list[list[int]] | None:
    if answer == "y":
        return [list(range(count))]
    if answer == "n":
        return [[i] for i in range(count)]
    if not re.fullmatch(r"[0-9]+(\+[0-9]+)*(\s+[0-9]+(\+[0-9]+)*)*", answer):
        return None
    partition = [[int(n) - 1 for n in token.split("+")] for token in answer.split()]
    if len(partition) == 1 and len(partition[0]) == 1:
        keep = partition[0][0]
        partition = [[keep, *(i for i in range(count) if i != keep)]]
    indices = [i for part in partition for i in part]
    if len(set(indices)) < len(indices) or not all(0 <= i < count for i in indices):
        return None
    return partition


def _ask(count: int) -> list[list[int]] | str:
    split_hint = "/1+2 3" if count > 2 else ""
    while True:
        try:
            answer = input(f"  [y/1-{count}/n{split_hint}/s/q, default s] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            return "q"
        if answer in ("", "s", "q"):
            return answer or "s"
        if (partition := _parse_answer(answer, count)) is not None:
            return partition


def review(candidates: list[dict], merges_path: Path, distinct_path: Path) -> None:
    merges = load_groups(merges_path)
    distinct = load_groups(distinct_path)
    merged = rejected = 0

    print("For each group, answer:")
    print("  y       same athlete, keep name 1")
    print("  number  same athlete, keep that name")
    print("  n       different people, never suggest again")
    print("  1+3 2   names 1 and 3 are one athlete (keep name 1), name 2 is someone else, unlisted names are skipped")
    print("  s       skip for now (default)")
    print("  q       save and quit")

    for i, candidate in enumerate(candidates, start=1):
        names = candidate["names"]
        print(f"\n[{i}/{len(candidates)}] Same athlete? ({describe_reasons(candidate['reasons'])})")
        details = zip(names, candidate["counts"], candidate["categories"], candidate["full_names"])
        for n, (name, count, cats, small_names) in enumerate(details, start=1):
            shown = ", ".join(cats[:2]) + (", …" if len(cats) > 2 else "")
            small = f" · small name: {', '.join(small_names)}" if small_names else ""
            print(f"  {n}) {name}  — {count}× · {shown}{small}")

        decision = _ask(len(names))
        if decision == "q":
            break
        if decision == "s":
            continue

        athletes = [[names[i] for i in part] for part in decision]
        for athlete in athletes:
            if len(athlete) > 1:
                merges = _merge_group(merges, athlete, athlete[0])
                merged += 1
        pairs = [sorted((a, b), key=str.casefold) for x, y in combinations(athletes, 2) for a in x for b in y]
        if pairs:
            distinct += pairs
            rejected += 1

    if merged:
        save_groups(merges_path, merges)
    if rejected:
        save_groups(distinct_path, distinct)
    print(f"\nMerged {merged} group(s) into {merges_path.name}, marked {rejected} as different people.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Find athlete names in events.json that probably belong to one athlete.")
    parser.add_argument(
        "--events", default=str(EVENTS_PATH), help="Scraped events JSON file (default: public/events.json)"
    )
    parser.add_argument("--review", action="store_true", help="Decide on each candidate group interactively")
    args = parser.parse_args()

    events = json.loads(Path(args.events).read_text(encoding="utf-8"))["events"]
    candidates = find_candidates(events)

    if args.review and candidates:
        review(candidates, MERGES_PATH, DISTINCT_PATH)
    else:
        print_candidates(candidates, shlex.join(["./scraper/merge_names.py", *sys.argv[1:], "--review"]))


if __name__ == "__main__":
    main()
