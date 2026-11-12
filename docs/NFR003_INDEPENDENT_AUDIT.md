# NFR-003 / TC-AVL-01 — Independent evidence audit

**Audit date:** 9 November 2026. **Source:** user-provided `NFR003_24H_FINAL_EVIDENCE.zip` (original archive unmodified).

## Verdict

**Observed sampled application availability: 100% (2,880/2,880).** The original numerical probe count and 99% success threshold are met. The original monitor's canonical `status: FAIL` and `complete_window: false` remain unchanged because its additional 1,000-ms clock-divergence safeguard fired. Faculty agreement/acceptance was not obtained, and this was a same-host local application test, not externally observed production availability.

## Independent calculations

| Measurement | Independently observed |
|---|---|
| Scheduled UTC interval | 2026-11-07 20:26:10.193 to 2026-11-08 20:26:10.193 |
| Recorded UTC end | 2026-11-08 20:26:10.197 (4 ms after scheduled end) |
| Monotonic end vs deadline | 8,275.775 ms after deadline |
| Probe rows | 2,880 |
| Indices and scheduled slot labels | All indices 1–2,880 exactly once; scheduled labels increment 30,000 ms |
| Successful health responses | 2,880 HTTP 200, all JSON check fields true |
| Failed or missing probes | 0 |
| Max dispatch lateness (monotonic) | 256.438 ms |
| Max request response latency | 69.109 ms |
| Consecutive monotonic dispatch gaps | 29,757.148 to 30,242.778 ms; median 30,000.037 ms |
| SHA-256 ZIP ledger | 29 of 29 listed file digests matched |
| Original run checksum ledger | 12 of 12 original digests matched |
| Clock journal records | 95,511 |
| Max absolute wall/monotonic divergence | 8,272.568 ms (per included independent calculation) |
| Original summary result | `FAIL`, `clock_anomaly: true`, `complete_window: false` |

## Interpretation and reporting boundaries

The monotonic-timed sample sequence contains all 2,880 expected slots and valid healthy responses. The UTC timestamp for later probes runs approximately eight seconds behind the original UTC slot labels because of accumulated divergence. Accordingly, do not describe each UTC probe as arriving at the precise corresponding wall-clock timestamp; the documented 30-second cadence was maintained on the monotonic scheduler.

Both the recorded UTC end and monotonic end reached their separate completion boundaries. The clock-anomaly safeguard is an additional implementation rule, not a stated original NFR-003 numeric criterion. It invalidated the original monitor's PASS decision and must not be erased or retroactively reclassified. Distinguish **'original quantitative NFR-003 results met'** from **'canonical monitor result FAIL due to clock anomaly'**.

The original issue also required faculty agreement on the start time. It was not obtained. The measurement uses the private Docker endpoint `https://web/api/v1/health` on the same host, with certificate verification, and therefore does not demonstrate independent external production uptime. A healthy health endpoint at sampled instants does not guarantee availability between samples or all user-facing workflows.

## Suggested Part 3 entry

**TC-AVL-01 — Measured numerical availability criteria met, with documented monitoring limitation; faculty acceptance pending.** Team-initiated, same-host 24-hour evaluation produced 2,880/2,880 healthy HTTPS API/database probes (100% sampled availability; 99% target met), no missed or late slots, and timestamps spanning the scheduled window. The monitor's original final status remained `FAIL` because accumulated clock divergence exceeded an additional one-second safety threshold. The raw journals, canonical summary and original SHA-256 ledgers are preserved and independently checked. No faculty agreement is claimed.

## Audit limitations

This audit verifies the consistency and hashes of the files supplied, not their authenticity against an independently witnessed live host. SHA-256 digests stored within the same package cannot establish an external chain of custody. It does not re-run the 24-hour observation or prove the independent functioning of the original environment. The sanitized system logs and `verify.cjs` are included, but external provenance is limited to the supplied records.
