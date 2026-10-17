# Suggested foundation PR

## Title
`chore: add shared MERN foundation and CI`

## Linked work
Supporting foundation for the existing Sprint 1 requirements. Use **Related to** issue links if helpful; do not auto-close entire FR/NFR/SEC issues merely because baseline scaffolding exists.

## Changes
- Shared npm-workspace React/Express/Mongoose structure aligned with the SAD.
- Real health/DB readiness, central errors/request IDs, basic request safeguards.
- Jest/Supertest/React Testing Library baseline tests, lint and frontend build.
- GitHub Actions push/PR checks with coverage artifacts.
- Local-only Docker/nginx/Mongo scaffold and persistent volumes.
- README, contracts, troubleshooting and working deviation log.

## Tests and evidence
Copy actual results from `docs/FOUNDATION_TEST_REPORT.md`, then add your own laptop checks and the real GitHub Actions run link after upload. Clearly state Docker was not tested during generation and whether you subsequently tested it.

## Review requests
- Another teammate reviews Bharat's PR; he cannot self-approve.
- Confirm directory/contract conventions before all owners branch from main.
- Node 24 LTS/npm 11 upgrade is recorded in DEV-04; confirm all runtime configuration stays aligned.
- Independently review owner-accepted health diagnostic clarification DEV-03 and owner-authorised Node 24 upgrade DEV-04.
- Verify Docker on a real Docker-enabled machine before claiming that path works.
- Confirm SonarQube integration remains pending, with no completed NFR-005 claim.
- Submitted PDFs are unchanged; no secrets, `.env`, node_modules, uploads or generated coverage/build output are included.

## After merge
Everyone updates main, follows README, checks the connected starter, then creates a separate branch for an assigned feature issue. Do not create four new skeletons.
