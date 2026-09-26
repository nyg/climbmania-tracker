#!/usr/bin/env bash
set -euo pipefail
dir="$(dirname "$0")"
[ -d "$dir/.venv" ] || python3 -m venv "$dir/.venv"
"$dir/.venv/bin/pip" install -q -r "$dir/requirements.txt"
exec "$dir/.venv/bin/python" "$dir/scrape.py" "$@"
