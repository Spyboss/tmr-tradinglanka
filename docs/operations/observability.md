# Observability & Operations

This runbook covers monitoring, logging, and routine operational tasks.

## Health Checks

- **Endpoint**: `GET /api/health`
  - Returns MongoDB and Redis connectivity, build metadata, and environment name.
  - Railway health probes use this endpoint.
- **Metrics**: `GET /api/health/metrics`
  - Prometheus-compatible. Protect behind VPN or auth proxy before exposing publicly.

## Logging

- Logger: Winston (`backend/src/utils/logger.ts`).
- Default level: `info`. Use `LOG_LEVEL=debug` when diagnosing complex issues.
- Logs are structured JSON strings in production for easier ingestion by log drains.
- Sensitive information (passwords, tokens, encrypted values) never appears in logs.
- Attach Railway log drain to Better Stack or Grafana Loki for retention.

## Key Alerts

| Signal | Threshold | Response |
| --- | --- | --- |
| HTTP 5xx rate | >3% over 5 minutes | Inspect Railway logs, confirm MongoDB connectivity, check Redis status. |
| Queue depth (Redis) | >200 jobs | Scale worker concurrency, inspect BullMQ job status. |
| MongoDB primary change | n/a | Atlas alert email; ensure application reconnects (automatic). |
| Failed login spikes | security-monitor flagged | Investigate suspicious IPs, consider temporarily blocking via Cloudflare firewall. |

## Routine Checks

- Review Better Stack dashboards for bill creation latency and inventory analytics response time.
- Ensure MongoDB backups succeeded (Atlas console).
- Validate Redis memory usage does not exceed plan limits.
- Verify Cloudflare Pages build history for failed deployments.

## Incident Response Cheatsheet

1. **API returning 500**
   - Check Railway logs for stack traces.
   - Run `npm run test` locally to confirm no regression in core flows.
   - Confirm environment variables loaded (`/api/health` output includes env summary).
2. **Frontend cannot reach API**
   - Confirm `VITE_API_URL` or proxy rule is correct.
   - Inspect CORS errors—update `CORS_ORIGINS` if domain changed.
3. **PDF generation failing**
   - Look for errors from `pdfService`. Ensure fonts/templates exist under `backend/templates`.
   - Validate Redis is reachable (PDF jobs rely on caching for branding).
4. **Billing data mismatch**
   - Query MongoDB directly to verify values.
   - Review `UserActivity` for manual adjustments.

## Maintenance Windows

- Scale Railway to zero instances outside business hours if cost-sensitive; refresh tokens survive due to Redis persistence.
- Perform dependency updates quarterly and run smoke tests (bill create, inventory update, quotation PDF).
- Rotate `ADMIN_SETUP_KEY` after each use and keep value in secure vault.

## Disaster Playbook References

- [Deployment Runbook](../setup/deployment.md)
- [Security Considerations](./security.md)
- [Future Expansion](../product/future-expansion.md) for multi-site failover plans.
