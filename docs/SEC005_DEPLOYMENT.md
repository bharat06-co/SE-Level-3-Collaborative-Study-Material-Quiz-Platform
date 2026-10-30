# SEC-005 (#45): TLS 1.2+, HTTPS redirect, HSTS

This increment adds an **isolated HTTPS deployment profile and automated TC-SEC-05 acceptance**. It leaves the existing `compose.yaml`, its database volumes, the shared development services, the `compose.acceptance.yaml` NFR suite, and submitted Part-1 PDFs unchanged.

## How it works

- An nginx web container serves the actual compiled React UI on HTTPS (container port 443) and proxies `/api/` to the private Express API. Browser-to-web/API requests are HTTPS.
- Plain HTTP (container port 80) returns `308` to the same path on HTTPS. `SEC005_HTTPS_PORT` is included for local host-port mapping (for example `https://localhost:18443`).
- Nginx allows only TLS 1.2 and 1.3 and returns `Strict-Transport-Security: max-age=31536000` on HTTPS responses, including errors. No premature HSTS `preload` or `includeSubDomains` is set.
- The API and MongoDB publish **no host ports**. Database is on an internal Compose network. The nginx-to-API hop is unencrypted within the application Docker network: TLS terminates at nginx. This is not end-to-end mTLS or encryption of internal service-to-service traffic.
- Current auth refresh cookies are `Secure`, `HttpOnly` and `SameSite=Strict` in `auth.controller.js`, appropriate for HTTPS.
- Certificates and keys are **host-supplied**; none are committed, generated or baked into production images. The CI-only certificate is self-signed, short-lived and valid for localhost; it is not publicly trusted.

## Automated test (no need to install Docker locally)

1. Create a branch and add the five files in this kit, preserving paths.
2. Open a PR into `main` (write `Related to #45`, not `Closes #45`).
3. GitHub Actions `SEC-005 TLS and HTTPS acceptance` generates temporary localhost test certificate and JWT secret, starts an isolated Compose project (`se-sec005-${{ github.run_id }}`), tests actual nginx/UI/API/TLS and uploads the evidence.
4. `scripts/sec005/verify-tls.sh` checks HTTPS health with **certificate validation**, HTTPS React entrypoint, exact `308` redirect, HSTS on success/error, acceptance of TLS 1.2/1.3 and refusal of TLS 1.0/1.1.
5. Review workflow, evidence and CI. Never claim acceptance if GitHub Actions did not complete successfully. The workflow removes **only its uniquely named temporary project and volumes**.

## Optional standalone local/staging demo

Use Docker Desktop or Engine/Compose. Install `openssl` and `curl` only if you intend to perform the shell validation on your own machine. **Do not reuse any root `.env` secrets or attach this stack to your existing database.** Create a directory containing `fullchain.pem` (certificate plus chain) and `privkey.pem` (matching private key). For a local demo only, you can create a throwaway localhost self-signed certificate. Never distribute it as a trusted public certificate.

Bash example, from the repository root:

```bash
export SEC005_CERT_DIR="$(mktemp -d)"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -sha256 \
  -keyout "$SEC005_CERT_DIR/privkey.pem" -out "$SEC005_CERT_DIR/fullchain.pem" \
  -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
export SEC005_JWT_ACCESS_SECRET="$(openssl rand -hex 32)"
export SEC005_BIND_IP=127.0.0.1 SEC005_HTTP_PORT=18081 SEC005_HTTPS_PORT=18443
# Pick a UNIQUE project name to avoid touching other Compose deployments.
docker compose -f compose.sec005.yaml -p se-sec005-demo up -d --build --wait mongo api web
bash scripts/sec005/verify-tls.sh
# Test-only stack, intentionally disposable; this removes its own data.
docker compose -f compose.sec005.yaml -p se-sec005-demo down -v
```

For normal operations with data you want to retain, use `docker compose down` **without** `-v`.

## What a real public deployment additionally requires

- An agreed host, registered DNS name, and certificate from a publicly trusted CA (for that exact name). Configure external reachability with `SEC005_BIND_IP=0.0.0.0`, `SEC005_HTTP_PORT=80`, `SEC005_HTTPS_PORT=443`, and point `SEC005_CERT_DIR` to a protected server certificate directory. The configuration redirects to `https://hostname:443/...` (explicit 443 is valid).
- Review DNS, firewall rules, renewal and deployment secrets; ensure only ports 80/443 are public and neither MongoDB nor Node API is directly exposed. Keep private keys out of the repository and logs. Certificate renewal requires a controlled nginx reload/restart; this Compose profile does not configure Let's Encrypt or automatic renewal.
- Only if you actually deploy: verify TLS 1.2/1.3 refusal of 1.0/1.1, HSTS and redirect against the **real domain**, using a trusted certificate and independent client. Change CORS origins if cross-origin deployment is chosen; the default profile intentionally only allows localhost origins.
- Record the live deployment target and real-domain verification in issue #45 before asserting production compliance. This acceptance suite verifies a real isolated stack but **not** any public deployment or every internal hop.
- This TLS profile can be the basis for issue #34's 24-hour probe, but the 24-hour faculty-approved interval and 2,880 checks must be performed separately.

## Issue #45 acceptance checklist

- [ ] CI runs `SEC-005 TLS and HTTPS acceptance` with success and uploaded evidence.
- [ ] HTTPS serves UI and API, using a trusted **test CA/certificate chain** for local verification.
- [ ] HTTP redirects to HTTPS (308).
- [ ] TLS 1.0/1.1 refused; TLS 1.2+ accepted.
- [ ] HTTPS responses contain HSTS.
- [ ] For production-compliance claims, public deployment, valid CA certificate, DNS and real-domain verification are independently completed.

Note: HSTS is browser policy for future connections, not a replacement for redirect on initial HTTP requests. Self-signed CI cert is only for isolated test verification.
