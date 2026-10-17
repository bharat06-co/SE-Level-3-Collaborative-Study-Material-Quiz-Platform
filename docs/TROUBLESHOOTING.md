# First-run troubleshooting

## No package.json / wrong folder
Open the repository ROOT containing README, root package.json, client and server. The downloaded archive's inner starter contents must be copied into the existing clone, not left as a nested application folder. Keep all three original PDFs untouched. Use the owner upload guide.

## Node engine warning
Use Node 24 LTS (major 24, latest patch) and npm 11; inspect `node --version` and `npm --version`. DEV-04 records the owner-authorised upgrade from the original SAD's EOL Node 20. Do not downgrade to 20 or install unknown binaries from random links.

## npm ci fails
Check network/proxy/Node versions and real error text. The root lockfile is supplied. If dependencies were intentionally changed, run `npm install` at root, review package/lockfile changes and coordinate the PR. Do not delete the lockfile as a routine fix or run `npm audit fix --force` blindly.

## API startup fails
Confirm `server/.env` exists, MongoDB is running, the URI is correct privately and port 3000 is free. URI passwords are intentionally not printed in errors. Do not paste secrets into chat. You may supply a redacted message and environment field NAMES.

## Frontend shows unavailable
Check the API's `/api/v1/health`, then DB connection/startup. If the backend port differs, change the local client DEV_API_TARGET and restart Vite. Don't bypass authentication or change shared routes. A running frontend without API/DB is not healthy.

## CORS / cookie problems
Browser UI should use localhost:5173 in local mode or localhost:8080 in Docker mode. Exact CORS origins must match scheme, hostname and port, with no path or wildcard. Future auth PRs must explicitly verify cookie/refresh behavior. Don't disable CORS/security globally.

## Docker unavailable or not running
Start Docker Desktop/Engine and confirm Compose v2. `docker compose config` checks rendering, then `docker compose up --build` builds/runs. This environment could not execute Docker; read actual local build logs. Database image/startup may take time. `docker compose logs api` and `docker compose logs mongo` help, but redact any credentials before sharing. Do not use `down -v` unless you intentionally want to erase named data volumes.

## 404 on auth/material/quiz routes
Expected in the foundation. Those features are not implemented yet. Do not mark their issues complete or create fake success handlers.

## Tests pass but feature is missing
Foundation tests prove only the included scaffold. Add and run actual feature acceptance/security/integration tests in the corresponding PR. SonarQube, performance, compatibility, availability, durability and TLS acceptance remain separate work.

## GitHub Actions failing or not visible
The workflow only runs on GitHub after the branch/PR is pushed. Inspect its real job logs; local green checks do not certify that remote run. Required status-check protection is a separate owner configuration. Never lower security/test targets just to get a green badge.
