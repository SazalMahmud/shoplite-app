# ShopLite (DevOps capstone)

Repositories: `shoplite-app` (this repo) and `shoplite-gitops`
(ArgoCD applications and `envs/dev|prod/values.yaml`).

## Run locally

    make up && make smoke

## Layout

- `services/`: web, catalog-api, order-worker (Node.js, Dockerfiles)
- `docker-compose.yml`, `Makefile`, `scripts/smoke-test.sh`
- `linux/`: sshd_config, systemd backup, firewall rules, evidence
- `terraform/`: modules network, compute, alb, ecr (+ bootstrap for S3/DynamoDB state)
- `helm/shoplite/`: chart with values-dev / values-prod
- `monitoring/`: alert rules, runbooks
- `.github/workflows/ci.yml`
- `docs/`: architecture.md, RCA.md, screenshots

## Status by task

| Task | Status |
|---|---|
| Q1 App | Done: API, 4 chaos flags, JSON logs, 6 tests. OpenTelemetry tracing not done |
| Q2 Docker | Done: images under 150 MB, non-root, smoke test passes |
| Q3 Linux | SSH hardening, ACL, systemd backup timer done. UFW rules prepared but not enabled on the lab host |
| Q4 Terraform | Modules and S3/DynamoDB remote state applied once. Ansible playbook not written |
| Q5 Helm | Probes, HPA, PDB, NetworkPolicy, PVC, ingress; verified on k3d |
| Q6 Observability | Prometheus stack, ServiceMonitors, 5 alerts, runbooks. Grafana dashboard JSON, Loki, Tempo not done |
| Q7 CI/CD | ci.yml written but not run (needs OIDC role and secrets). ArgoCD dev auto-sync + self-heal and prod manual sync demonstrated |
| Q8 Chaos | Exercise, RCA and Git-based recovery done |

## Known limitations

- The lab IAM user could not manage IAM roles, SSM sessions or Budgets, so
  the EC2 k3s cluster could not be administered and the Budget block was
  removed (a $20 budget was created in an earlier session).
- Secrets (`shoplite-db`) are created with kubectl and never committed.
- Remove billable resources after grading with `terraform destroy`.

## Ansible
`ansible/site.yml` applies the Q3 hardening (users, SSH, UFW, ACL) and
bootstraps k3s (server, agents, kubeconfig). It was syntax-checked but
not run against the EC2 nodes, because SSM access was unavailable with
the lab IAM user.

## Dashboard
`monitoring/dashboards/golden-signals.json` defines the Golden Signals panels
(latency p50/p95/p99, RPS, 5xx rate, CPU/memory, queue depth, worker replicas,
orders created vs processed). It was not imported or verified in Grafana.

## Logging and tracing (configuration only)
`monitoring/logging/` (Loki/Promtail values, Grafana datasource with a trace_id derived field)
and `monitoring/tracing/` (Tempo values, OpenTelemetry plan) are committed as configuration.
They were not deployed or verified, and the OpenTelemetry SDK is not in the services.
