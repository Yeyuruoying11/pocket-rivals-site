#!/usr/bin/env bash
# Test suite of the Pocket Rivals handheld simulator (device.html + device-*.js + mode-*.js)
# and the site's 3D pin map (index.html + pinmap-*.js).
# usage: tests/run.sh [quick|full]      (default: quick; works from any directory)
#   quick  the fixtures, the input / gate / wave / blurb / S21 heartbeat / per-pet trial tests and the World 1 solver checker
#   full   quick, then the racing track test, the end-to-end run, the World 1 play-through
#          and the 3D pin map on the site's hardware tab (index.html)
# Every browser test runs with the route.js preload, which answers the page requests from the
# repository folder: no server, no network.
set -e
cd "$(dirname "$0")/.."

MODE="${1:-quick}"
case "$MODE" in
  quick|full) ;;
  *) echo "usage: tests/run.sh [quick|full]" >&2; exit 2 ;;
esac

mkdir -p tests/out
if [ ! -x tests/out/solve_c ] || [ tests/adv/solve.c -nt tests/out/solve_c ]; then
  echo "== build solver"
  t0=$(date +%s)
  if cc -O2 -o tests/out/solve_c tests/adv/solve.c; then st=PASS; else st=FAIL; BUILD_FAILED=1; fi
  echo "-- build solver $st ($(( $(date +%s) - t0 )) s)"
fi

results=()
failed=${BUILD_FAILED:-0}
step() {
  local name="$1"; shift
  echo "== $name"
  local t0=$(date +%s)
  if "$@"; then results+=("PASS  $name"); else results+=("FAIL  $name"); failed=1; fi
  echo "-- $name: $(( $(date +%s) - t0 )) s"
}

step smoke    node -r ./tests/route.js tests/smoke.js
step input    node -r ./tests/route.js tests/input-test.js
step gate     node -r ./tests/route.js tests/gate-test.js
step wave     node -r ./tests/route.js tests/wave-test.js
step blurb    node -r ./tests/route.js tests/blurb-test.js
step s21-heartbeat node -r ./tests/route.js tests/s21-heartbeat-test.js
step pet-trials node -r ./tests/route.js tests/pet-trials-test.js
step check-w1 node tests/adv/check-w1.js

if [ "$MODE" = full ]; then
  step race      node -r ./tests/route.js tests/race-test.js
  step full-test node -r ./tests/route.js tests/full-test.js
  step make-cases node tests/adv/make-cases.js
  step harness   node -r ./tests/route.js tests/adv/harness.js --world 1 --kinds solve,solo,restart,boss,bossSolo,bot --bot-orders
  step pin3d     node -r ./tests/route.js tests/pin3d-test.js
fi

echo
echo "summary ($MODE)"
for r in "${results[@]}"; do echo "  $r"; done
[ -n "$BUILD_FAILED" ] && echo "  FAIL  build solver"
echo
[ "$failed" = 0 ] && echo "ALL PASS" || echo "FAILED"
exit "$failed"
