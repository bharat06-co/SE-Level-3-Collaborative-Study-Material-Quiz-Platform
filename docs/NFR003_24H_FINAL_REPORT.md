# NFR-003 / TC-AVL-01 | Part 3 final evaluation report

**Observed result: 100% sampled application availability. Recorded monitor verdict: FAIL because of the clock-anomaly safeguard.**

| Item | Recorded value |
|---|---|
| Run ID | nfr003-team-20261107-202610-d6d05b |
| Evaluation authority | TEAM_INITIATED |
| Faculty approval | NOT_OBTAINED, no reference |
| Faculty acceptance | PENDING |
| Issue #34 | Administratively closed, as reported by the project owner |
| Measurement target | https://web/api/v1/health, private Docker bridge |
| Scheduled window (UTC) | 7 November 2026 20:26:10.193 to 8 November 2026 20:26:10.193 |
| Scheduled window (IST, UTC+05:30) | 8 November 2026 01:56:10.193 to 9 November 2026 01:56:10.193 |

## Setup and method

The evaluation ran on a secondary Windows laptop (build 10.0.26300.0), with Docker Desktop 4.98.0 and Docker Engine 29.9.2 using the Linux x86_64 WSL 2 backend (kernel 6.18.54.1-microsoft-standard-WSL2). The engine reported four logical CPUs and approximately 3.68 GiB RAM. At launch the laptop was on AC, AC sleep and hibernation were disabled, and the lid was to remain open.

A detached Node.js 24 container probed the real Express application and MongoDB replica-set deployment through the nginx HTTPS gateway. The monitor used a dedicated local CA with certificate and hostname verification enabled. Each slot permitted one read-only GET, with no redirects, retries, credentials or request body. Success required HTTP 200 and the expected application, process and database health fields. Dispatch and response completion were recorded in both UTC and monotonic time. The five-second dispatch cutoff and absolute five-second response deadline were enforced independently.

The verifier checks schedule, outcomes, clock samples, Docker provenance and hashes. The source archive contains the exact monitor file extracted from the stopped container and the verifier used for this evidence. The runtime monitor digest matched the workspace file and the recorded source manifest. All 297 current files tracked by the run manifest matched its recorded digests. The base archive revision is 7c366c977a198c8db0112e9f13de234cd8dc9bd3. The monitor image manifest is sha256:919db5a91ab1b6c701cffa614083915f566f358f058582057c6e0650475fde19.

## Original criteria and actual measurements

The repository’s NFR-003 procedure calls for a continuous 24-hour window, 2,880 scheduled probes at 30-second intervals, at least 2,852 successes (99% rounded up), genuine HTTPS application and database health, and preserved timestamped evidence. It also calls for agreement with faculty on the start and test vantage point. This team-initiated run had no faculty approval. Administrative closure does not establish faculty acceptance.

| Criterion or measurement | Actual result |
|---|---|
| Scheduled and recorded probes | 2,880 / 2,880, with every scheduled slot present and ordered |
| Probe interval | 30 seconds on the monotonic schedule |
| Healthy and HTTP 200 | 2,880 / 2,880 |
| Probe failures, late slots, missed slots, missing probes | 0 in each category |
| Success threshold | 2,852 required, 2,880 observed |
| Sampled availability | **100.00%** |
| First and last observed probes (UTC) | 7 Nov 20:26:10.212 and 8 Nov 20:25:31.934 |
| Recorded end (UTC) | 8 Nov 20:26:10.197 |
| Elapsed UTC and monotonic time | 86,400.004 s and 86,408.276 s, respectively |
| Deadline checks | Both elapsed |
| Request latency | Median 11.84 ms, p95 17.76 ms, maximum 69.11 ms |
| Monitor exit | Exited with code 1, zero restarts, no OOM kill |
| Monitor result | **FAIL**, clock anomaly true and complete_window false |

## Clock safeguard and interpretation

The implementation flags wall-versus-monotonic drift or a step above 1,000 ms, or a monotonic clock-sampling gap above 10 seconds. Independent recalculation of 95,511 clock samples found the first crossing at 7 November 2026 23:15:40.225 UTC (8 November 04:45:40.225 IST), when wall time trailed the monotonic anchor by 1,000.461 ms. Maximum absolute divergence was 8,272.568 ms. The largest single step was 17.152 ms and the longest sampling gap was 1,277.948 ms. The journal shows accumulated divergence. It does not identify the underlying clock mechanism.

All sampled health requests succeeded and the numerical availability threshold was exceeded. Both clock deadlines elapsed. The additional clock-integrity safeguard nevertheless made the monitor mark the window invalid for PASS. The team therefore reports **100% sampled application availability and a recorded overall FAIL**. It does not claim faculty acceptance.

## Verification, evidence and limitations

The archived verifier was run against an independently extracted core export. It exited 0, verified 16 package members and independently reported FAIL, 2,880 healthy probes, both deadlines elapsed and a clock anomaly. Its actual stdout, stderr and exit code are included. An exit code of 0 means the package verified. It does not change the recorded result. The probe and clock journal digests independently matched the summary.

The evidence ZIP includes the original probe and clock journals, summary, run/environment/source manifests, launch intent and request, prepared container identity, launch and end-state records, the run checksum ledger, the verifier, monitor logs and privacy-filtered service logs. The original run files retained their SHA-256 digests. The final service snapshot was taken after the monitor exited and reports its recorded exit state. API and MongoDB were healthy in both snapshots. The retained gateway log contains 2,880 health requests. The retained database log contains 198,764 records reduced to timestamp, severity, component and event ID. Docker returned no API log lines in the selected window. The service log projection excludes client identifiers, payloads, headers, connection metadata and free-text application messages. The monitor log is retained in full. Docker retention bounds the available service logs.

The probe measures one same-host private endpoint and its dependency check at sampled instants. Results do not establish public or production reachability, availability between probes, or coverage of every application workflow. Checksums support integrity against a trusted copy. They do not authenticate the operator or replace faculty review.

The companion source ZIP contains the exact monitor and verification scripts, relevant launch and deployment definitions, tests and provenance records. The original GitHub repository and recorded measurements were left unchanged.
