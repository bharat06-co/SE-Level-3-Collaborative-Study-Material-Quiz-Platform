# Bharat: add the shared foundation safely

This package supplies the common starter, not a finished application. No remote repository changes have been made. All three submitted PDFs are untouched and deliberately excluded from the archive.

**Use this revised Node 24 package instead of the earlier Node 20 ZIP. Do not combine the two starters. No feature issue has been completed by this runtime revision.**

## 1. Open the correct clone
In GitHub Desktop, select the existing `SE-Level-3-Collaborative-Study-Material-Quiz-Platform` repository. If it is not cloned, use File → Clone repository → URL and clone the existing repo. Do NOT create another repo or fork.

Switch to `main`, Fetch origin and Pull origin if offered. Preserve any existing local work; do not discard it. If new code has appeared since the PDF-only baseline, stop and integrate/review rather than overwriting it with this starter.

## 2. Create a branch BEFORE copying
Current Branch → New Branch → `chore/shared-foundation`.

## 3. Extract and copy
Extract `Team1_Shared_Foundation_Node24.zip` outside the clone. Open the extracted `Team1_Shared_Foundation` folder. Copy its CONTENTS into the root of your existing clone—the folder containing the three PDFs.

Root should now contain the original PDFs PLUS `package.json`, `package-lock.json`, `README.md`, `server`, `client`, `scripts`, `docs`, `.github`, `.gitignore`, `.dockerignore`, `.nvmrc`, `.node-version`, `eslint.config.mjs`, `compose.yaml` and the two Dockerfiles. Show hidden files if necessary so dotfiles are copied.

Do not copy the outer folder as a nested app. Do not upload the ZIP itself into the repo. Do not delete/rename/move/replace the PDFs. The archive contains no `.git` directory, credentials, node_modules or real `.env` file.

## 4. Run baseline checks
Use **Node 24 LTS (latest major-24 patch) and npm 11**. Node 20 in the original SAD is EOL; DEV-04 records your authorised upgrade. The submitted PDFs stay untouched. If you use nvm, `nvm install 24` then `nvm use 24`; otherwise install Node 24 LTS through an official installation method and reopen the terminal. Confirm `node --version` begins with v24 and `npm --version` begins with 11.

Open a terminal at the REPOSITORY ROOT:
```sh
node --version
npm ci
npm run check
```
These isolated tests do not require MongoDB. Expected current baseline: 28 server tests + 8 client tests pass, lint passes and frontend builds. A green local check does not prove remote Actions has run.

For actual running-app verification, follow README's local configuration/MongoDB instructions. Then `npm run dev`, open localhost:5173, and check the API/DB connected message. You can also run `npm run smoke` while the app is running.

Alternatively use Docker Compose as explained in README. That path is provided but has NOT been executed during preparation; test it on a Docker-enabled machine before claiming it works. It is local HTTP, NOT final HTTPS/TLS compliance.

Never commit `.env`, secrets, node_modules, coverage or dist. GitHub Desktop should show only intended source/config/docs additions, with NONE of the original PDF files changed.

## 5. Review, commit and push your branch
Read `docs/FOUNDATION_TEST_REPORT.md` and `docs/DEVIATIONS.md`. This is not a full security/quality acceptance pass: there are known moderate test-only dependency advisories; runtime-only audit has none. SonarQube, real business modules, auth, rate limits, TLS and acceptance suites remain future work.

GitHub Desktop → inspect Changes → commit:
`chore: add shared MERN foundation and CI`

Publish branch / Push origin. Do NOT push directly to main.

## 6. Open a PR into main
Create Pull Request. Confirm base=main and compare=chore/shared-foundation.
Title: `chore: add shared MERN foundation and CI`.
Use `docs/FOUNDATION_PR.md` and real local test results for the description.

Do not write `Closes #...` for whole FR/NFR/SEC issues just because a scaffold exists. This is supporting setup work. If you create a separate supporting setup issue, estimate/assign it honestly and record the scope addition.

Request Anisha or another teammate to review Bharat's PR. Confirm the actual GitHub Actions job passes. The owner cannot self-approve. Health payload/503 is explicitly recorded as your accepted working clarification, pending independent PR review; it is not claimed to be original SRS wording. The Node 24 runtime change is likewise recorded in DEV-04.

## 7. Merge only after review/checks
After required review and checks, Bharat merges. Configure branch protection/required checks separately if available; workflow files do not enforce that automatically.

Do not mark all feature issues Done. The starter intentionally implements no domain feature issue in full.

## 8. Tell everyone
“The shared foundation PR is merged. Switch to main, Fetch/Pull, follow README, verify the connected starter, then create a separate branch for your assigned issue. Do not scaffold a second app. Coordinate auth/model/API dependencies and merge small pieces daily.”

Each teammate gives their AI: universal handbook + full backlog reference + combined Part-1 PDF + original Part-2 brief + current pulled code + selected issue.

If a step fails, send the screenshot or redacted terminal error. Never send real passwords, tokens, .env content or credential-bearing database URIs.
