#!/usr/bin/env bash
# TC-PERF-01 on a Linux staging/demo host. Isolated Compose project only.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
command -v docker >/dev/null || { echo 'Docker/Compose required' >&2; exit 1; }
command -v openssl >/dev/null || { echo 'openssl required' >&2; exit 1; }
project="se-nfr-$(date -u +%s)-${RANDOM}"
compose='compose.acceptance.yaml'
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p nfr-results
export NFR_JWT_ACCESS_SECRET="$(openssl rand -hex 32)"
export NFR_RESULTS_DIR='./nfr-results'
function cleanup() {
  docker compose -f "$compose" -p "$project" down -v --remove-orphans || true
  unset NFR_JWT_ACCESS_SECRET NFR_RESULTS_DIR NFR_QUIZ_ID
}
trap cleanup EXIT
{
  echo "start_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "commit=$(git rev-parse HEAD)"
  echo "host=$(uname -a)"
  echo "cpu_count=$(nproc)"
  echo 'memory:'; free -m
  echo "docker=$(docker version --format '{{.Server.Version}}')"
  docker compose version
  echo 'Reference requirement: Linux VM 2 vCPU / 4 GB RAM, MongoDB 7, production-shaped Compose stack'
} > "nfr-results/${stamp}-environment.txt"
docker compose -f "$compose" -p "$project" up -d --build --wait mongo api web
docker compose -f "$compose" -p "$project" run --rm -T probe \
  node /verification/nfr007.cjs prepare | tee "nfr-results/${stamp}-durability-before.log"
docker compose -f "$compose" -p "$project" restart api
docker compose -f "$compose" -p "$project" run --rm -T probe \
  node /verification/nfr007.cjs verify | tee "nfr-results/${stamp}-durability-after.log"
quiz_id="$(grep -oE 'NFR_QUIZ_ID=[a-f0-9]{24}' "nfr-results/${stamp}-durability-after.log" | tail -1 | cut -d= -f2)"
test -n "$quiz_id"
export NFR_QUIZ_ID="$quiz_id"
docker compose -f "$compose" -p "$project" run --rm -T probe \
  node /verification/nfr001-seed.cjs | tee "nfr-results/${stamp}-seed.log"
docker compose -f "$compose" -p "$project" run --rm -T -e NFR_QUIZ_ID k6 \
  run --summary-export="/results/${stamp}-nfr001-stp-summary.json" /verification/nfr001-stp.js \
  | tee "nfr-results/${stamp}-nfr001-stp-k6.log"
echo "PASS mixed STP workload; see nfr-results/${stamp}-* (verify host specs before closing #32)."
