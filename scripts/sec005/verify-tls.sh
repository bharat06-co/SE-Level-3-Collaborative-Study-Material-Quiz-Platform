#!/usr/bin/env bash
# TC-SEC-05: test actual nginx HTTPS proxy against disposable MongoDB/API/web.
# Requires bash, curl, openssl. Only probes localhost; no production credentials.
set -Eeuo pipefail
: "${SEC005_CERT_DIR:?Set certificate directory for CA verification}"
: "${SEC005_HTTPS_PORT:=18443}"
: "${SEC005_HTTP_PORT:=18081}"
results="${SEC005_RESULTS_DIR:-test-results/sec005}"
mkdir -p "$results"
log="$results/tls-verification.log"
exec > >(tee "$log") 2>&1

pass() { printf 'PASS: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
http="http://localhost:${SEC005_HTTP_PORT}"
https="https://localhost:${SEC005_HTTPS_PORT}"
ca="$SEC005_CERT_DIR/fullchain.pem"
test -s "$ca" || fail 'Certificate chain not present'

printf 'SEC-005 verification UTC: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
printf 'Host: localhost; HTTP port %s; HTTPS port %s\n' "$SEC005_HTTP_PORT" "$SEC005_HTTPS_PORT"

# curl verifies the generated localhost certificate. DO NOT use -k / --insecure.
headers="$results/https-headers.txt"
body="$results/health.json"
status="$(curl --silent --show-error --noproxy '*' --max-time 20 --cacert "$ca" \
   -D "$headers" -o "$body" -w '%{http_code}' "$https/api/v1/health")"
[[ "$status" == 200 ]] || fail "HTTPS /api/v1/health should be 200, got $status"
grep -q '"status":"ok"' "$body" || fail 'API health status not ok'
grep -q '"database":"connected"' "$body" || fail 'API database connection not ready'
pass 'Browser-to-nginx HTTPS serves real API over validated localhost certificate'

grep -Eiq '^strict-transport-security:[[:space:]]*max-age=31536000' "$headers" || fail 'HTTPS response missing HSTS max-age'
pass 'HSTS response header present over HTTPS'

error_headers="$results/https-error-headers.txt"
curl --silent --show-error --noproxy '*' --max-time 20 --cacert "$ca" -D "$error_headers" \
  -o /dev/null "$https/api/v1/this-route-does-not-exist" || fail 'Cannot probe error headers'
grep -Eiq '^strict-transport-security:' "$error_headers" || fail 'HSTS missing from HTTPS error response'
pass 'HSTS also set on HTTPS error responses'

redirect_headers="$results/http-redirect-headers.txt"
redirect_status="$(curl --silent --show-error --noproxy '*' --max-time 20 \
    -D "$redirect_headers" -o /dev/null -w '%{http_code}' "$http/api/v1/health")"
[[ "$redirect_status" == 308 ]] || fail "HTTP should return 308, got $redirect_status"
grep -Fqi "location: $https/api/v1/health" "$redirect_headers" || fail 'HTTP redirect does not point at intended HTTPS API URL'
pass 'HTTP /api redirect points to HTTPS with original path'

html="$results/https-homepage.html"
home_code="$(curl --silent --show-error --noproxy '*' --max-time 20 --cacert "$ca" \
  -o "$html" -w '%{http_code}' "$https/")"
[[ "$home_code" == 200 ]] || fail "HTTPS homepage not available (HTTP $home_code)"
grep -qi '<html' "$html" || fail 'HTTPS homepage lacks expected HTML'
pass 'Client SPA is served via HTTPS'

if ! curl --silent --show-error --noproxy '*' --max-time 20 --cacert "$ca" \
  --tlsv1.2 --tls-max 1.2 -o /dev/null "$https/api/v1/health"; then
  fail 'TLS 1.2 handshake failed'
fi
pass 'TLS 1.2 accepted'

if ! curl --silent --show-error --noproxy '*' --max-time 20 --cacert "$ca" \
  --tlsv1.3 --tls-max 1.3 -o /dev/null "$https/api/v1/health"; then
  fail 'TLS 1.3 handshake failed'
fi
pass 'TLS 1.3 accepted'

for version in tls1 tls1_1; do
  # Verify the handshake is rejected. Capture full output for reviewers.
  if openssl s_client -connect "127.0.0.1:${SEC005_HTTPS_PORT}" -servername localhost \
      -"$version" -brief </dev/null >"$results/${version}-handshake.txt" 2>&1; then
    fail "Legacy ${version} handshake unexpectedly succeeded"
  fi
  pass "Legacy ${version} handshake refused"
done

# Avoid putting private keys or browser credentials into the artifact.
printf 'SEC-005 PASS: HTTP redirect, HTTPS API/client, HSTS and TLS version policy verified.\n'
