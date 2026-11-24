#!/usr/bin/env bash
# Runs every test: unit tests (Node's built-in runner) then end-to-end tests (Playwright in Chrome).
# Usage: tests/run.sh            all tests (admin site and the app)
#        tests/run.sh unit       admin unit tests only
#        tests/run.sh e2e [-k x] admin end-to-end tests only (extra arguments go to pytest)
#        tests/run.sh app [-k x] the app in app/: its unit tests, API tests and browser tests
set -u
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$0")"
python3 -I fixtures/make_fixtures.py >/dev/null || exit 1
status=0
mode="${1:-all}"
if [ "$mode" = "app" ]; then
  shift
  echo "== App unit tests (node --test) =="
  node --test --test-reporter=spec app/unit/*.test.js || status=1
  echo "== App API and browser tests (pytest, Playwright) =="
  python3 -m pytest -q -p no:cacheprovider app "$@" || status=1
  exit $status
fi
if [ "$mode" != "e2e" ]; then
  echo "== Unit tests (node --test) =="
  node --test --test-reporter=spec unit/*.test.js || status=1
fi
if [ "$mode" != "unit" ]; then
  [ "$mode" = "e2e" ] && shift
  echo "== End-to-end tests (Playwright, Chrome) =="
  python3 -m pytest -q -p no:cacheprovider e2e "$@" || status=1
fi
if [ "$mode" = "all" ]; then
  "$SELF" app || status=1
fi
exit $status
