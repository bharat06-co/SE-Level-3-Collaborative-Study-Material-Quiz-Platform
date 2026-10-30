# NFR-003 / Issue #34 — 99% availability for a continuous 24-hour window

## Purpose and completion rule

This adds a **read-only external health monitor** for `TC-AVL-01`. The tool can be merged and its *measurement logic* checked before a real 24-hour run. A short GitHub Actions smoke test **does not** meet NFR-003. Do not close #34 based on the workflow check alone.

The issue requires:

- Agreement with course faculty on the evaluation start time.
- One request every **30 seconds for 24 hours**, exactly **2,880 scheduled probes**.
- At least **2,852 successful probes** (99% of 2,880 rounded up).
- Preserved timestamped probe results and summary.

The script calls the real `/api/v1/health` endpoint using a read-only GET. A probe succeeds only on HTTP 200 and the expected JSON (`status: ok`, `checks.process: up`, `checks.database: connected`). Redirects, TLS errors, timeouts, HTTP errors, and unhealthy JSON count as failures. There are **no retries** and no authentication or sensitive data is sent.

## Setup, safety and scope

Run the **24-hour monitor on a stable external machine or monitoring host**, preferably separate from the application host. Use Node.js **24**. The actual tested deployment must remain online for the full window; GitHub Actions does **not** run the 24-hour measurement because hosted jobs have execution limits and ephemeral networking.

Only an `https://.../api/v1/health` URL is allowed for the full run. Use a trusted certificate (never bypass verification with an insecure option). The test URL must contain no credentials, query or fragment. The deployment must be the one agreed with faculty, not a mock fixture. Monitor from the network vantage point agreed with faculty, and record the deployment URL/commit and host environment separately.

The script creates `probes.jsonl` and `summary.json` inside the selected output directory. `nfr-results/` is already Git-ignored in this repository. Do not commit uptime results, environment secrets, student data or private certificates to the public repository. Link sanitized evidence or artifacts separately.

## Run the actual 24-hour test **after faculty approval**

1. Confirm the final HTTPS app is running and its health endpoint returns HTTP 200 and connected DB JSON.
2. Agree an exact **UTC** evaluation start with faculty (example below is **illustrative only**).
3. From the repository root, on the dedicated monitoring host, start Node 24 **before** that time:

```powershell
node scripts/nfr003/monitor.cjs --url "https://YOUR-DEPLOYED-HOST/api/v1/health" --approval-ref "faculty-approval-reference" --start-at "2026-11-02T09:00:00Z" --output-dir "nfr-results/nfr003/faculty-2026-11-02"
```

Do not reuse the example date without checking. If started over five seconds after the agreed start, the tool refuses backdated measurement. Plan to start early. Keep the host process awake, powered and network-connected; disabling sleep may require coordination with the host administrator. Avoid rebooting the monitoring host during the window.

4. After the **full 24 hours**, examine `summary.json`. `status: PASS` means the complete 24-hour window was observed and at least 2,852 of 2,880 probes were healthy. If the process was interrupted, the number of probes is short, the clock window has not elapsed, or the success count is below threshold, `status: FAIL`. Missing/late scheduled slots count as failures (or cause an incomplete run).
5. Preserve both `probes.jsonl` and `summary.json`, with the SHA-256 digest embedded in the summary, plus the faculty approval reference, deployed commit SHA, host/network details, and actual start/end. Attach a link to the evidence from issue #34 and obtain acceptance before closing.

The end of the last sample is at 23h 59m 30s, and the process intentionally remains running until the entire 24h interval ends before finalizing PASS.

## Short self-test (NOT acceptance)

A GitHub Actions job runs:

```sh
node --test scripts/nfr003/monitor.test.cjs
```

It starts a tiny localhost HTTP fixture and checks healthy/unhealthy accounting, evidence output, and rejection of invalid acceptance setup. It takes seconds. A green check confirms the **monitor's implementation only**; it cannot replace the 24-hour test.

The monitor's `--smoke` mode is restricted to a localhost loopback health URL, short count/interval, and explicitly writes `SMOKE_PASS_NOT_ACCEPTANCE` rather than `PASS`.

## Limitations

The reading measures reachability and `/api/v1/health` (API + database) from one vantage point. It does not prove functionality of every frontend page, browser route, or internal service at all times. A green CI smoke test never justifies claiming 99% 24-hour availability. Any changes to the faculty-approved test window or environment should be documented in #34.
