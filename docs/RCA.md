# Root Cause Analysis: HTTP 500 on POST /orders (dev)

## Summary
The fault-injection flag `chaos.errorRate` was set to "0.3" in
`shoplite-gitops/envs/dev/values.yaml` (commit `00eaf5c`, message
"dev: tweak config"). ArgoCD synced it into the `shoplite-config`
ConfigMap and catalog-api returned HTTP 500 for a large share of
POST /orders requests. The service was recovered through Git
(commit `20fe822`) and verified with a clean load test (30 x 201).

## Evidence (screenshots in docs/)
1. `chaos_proved.png`: `CHAOS_ERROR_RATE = 0.3`; at 19:06:35 UTC,
   30 requests gave 16 x 201 and 14 x 500.
2. `recovery.png`: `git revert HEAD` created `6fae6be Reapply
   "dev: tweak config"`; at 19:12:36 UTC, 30 requests gave
   22 x 201 and 8 x 500 (fault still present).
3. `docs-RCA.png`: gitops history (newest first): `6fae6be Reapply`,
   `7389592 Revert`, `00eaf5c dev: tweak config`; all 3 nodes Ready.
4. Final verification (terminal output): `CHAOS_ERROR_RATE = 0`,
   Mon Nov 16 01:45:20 UTC 2026, 30 x 201, 0 x 500.

## Timeline (UTC)
| Time | Event |
|---|---|
| 15 Nov, before 19:06 | `00eaf5c` sets errorRate "0.3"; ArgoCD refresh; catalog-api restarted |
| 15 Nov 19:06:35 | Load test: 16 x 201, 14 x 500 (about 47% errors) |
| 15 Nov, 19:06-19:11 | `7389592 Revert "dev: tweak config"` pushed |
| 15 Nov 19:11:19 | `git revert HEAD` reverted that revert, creating `6fae6be Reapply`; fault re-enabled |
| 15 Nov 19:12:36 | Load test: 22 x 201, 8 x 500 (about 27% errors); fault still present |
| later | Commit `20fe822` sets errorRate back to "0" |
| 16 Nov 01:45:20 | New cluster synced from Git; ConfigMap `CHAOS_ERROR_RATE=0`; load test: 30 x 201, 0 x 500. Fully recovered |

## Detection
The fault was detected from HTTP status counts of the load test
(POST /orders returned 500 while the service stayed up) and from the
application log message `chaos error injected`. The HighErrorRate
alert (5xx rate above 5% for 5 minutes) is defined in
`helm/shoplite/templates/alerts.yaml`, but Prometheus could not be
used through the lab proxy (see Limitations), so the alert was not
the first signal.

## Investigation (metrics, logs, config, Git)
1. Metrics/counts: non-zero 500 on POST /orders; other endpoints healthy.
2. Logs: catalog-api logged `chaos error injected` with a trace_id per failed request.
3. Config: `kubectl get cm shoplite-config` showed `CHAOS_ERROR_RATE` = 0.3.
4. Git: `git log` in shoplite-gitops pointed to commit `00eaf5c`.

## Root cause
`chaos.errorRate` was changed from "0" to "0.3" in Git. ArgoCD applied
it and the API injects HTTP 500 for that fraction of POST /orders requests.

## Recovery
- Attempt 1: `git revert HEAD` targeted the wrong commit (HEAD was
  already a revert), which re-applied the fault (8 x 500 afterwards).
- Attempt 2: `errorRate` set explicitly back to "0" (commit `20fe822`)
  and pushed; ArgoCD reconciled the state.
- Verification: 30 x 201 with `CHAOS_ERROR_RATE=0`.
- Recovery time: first detection (19:06:35) to the corrective commit
  was about not recorded (fill in from your own record), including
  the mistaken revert.

## Preventive measures
- Run `git log` and inspect the commit before `git revert HEAD`;
  reverting a revert re-applies the change.
- Add a CI/policy check that rejects non-zero chaos flags in
  `envs/prod/values.yaml` and require review for values changes.

## Limitations
- The Prometheus UI was not reachable through the Poridhi proxy, and
  Loki and Tempo were not deployed, so the investigation did not use
  the full Grafana/Loki/Tempo chain.
- Load was 30 requests per run, not 20 req/s for 15 minutes.
- I enabled the flag myself; no peer did it.
- The final healthy state was verified on a rebuilt cluster after the
  lab session was reset, from the same Git state.
