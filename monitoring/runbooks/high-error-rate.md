# Runbook: high-error-rate

1. Open the Golden Signals dashboard in Grafana.
2. Check logs in Loki, then the trace in Tempo.
3. Roll back the last Git change via ArgoCD if needed.
