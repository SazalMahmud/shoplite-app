# Tracing plan (not implemented in application code)

- Instrument catalog-api and order-worker with the OpenTelemetry Node SDK,
  exporting OTLP to `tempo.monitoring:4317`.
- Propagate trace context through the Redis queue: catalog-api puts
  `trace_id` (already in the message) plus `traceparent` into the job payload;
  order-worker restores it as the parent span.
- Logs already contain `trace_id`, so Loki derived fields link to Tempo.
- Status: configuration only. The SDK is not added to the services.
