# Observability & Operations

This runbook covers monitoring, logging, and routine operational tasks.

## Health Checks

- **Endpoint**: `GET /api/health`
  - Liveness probe. Returns 200 and `{"status":"ok"}` while the process is accepting requests.
  - Railway health probes use this endpoint.
- **Details**: `GET /api/health/details`
  - Uptime, server and memory info, database state, and the resolved client IP (`trust proxy`, `x-forwarded-for`). Public: the route has no auth middleware, so treat the response as world-readable.

## Logging

- Logger: Winston (`backend/src/utils/logger.ts`).
- Default level: `info`. Use `LOG_LEVEL=debug` when diagnosing complex issues.
- Logs are plain text (`timestamp level: message`) and colorized in every environment, not structured JSON.
- Call sites avoid logging passwords, tokens, or encrypted values. The logger has no redaction layer, so this relies on the caller.
- Attach Railway log drain to Better Stack or Grafana Loki for retention.

## Key Alerts

| Signal | Threshold | Response |
| --- | --- | --- |
| HTTP 5xx rate | >3% over 5 minutes | Inspect Railway logs, confirm MongoDB connectivity, check Redis status. |
| MongoDB primary change | n/a | Atlas alert email; ensure application reconnects (automatic). |
| Failed login spikes | security-monitor flagged | Investigate suspicious IPs, consider temporarily blocking via Cloudflare firewall. |

## Routine Checks

- Review Railway log drains, and any dashboards built on them, for bill creation latency and inventory analytics response time.
- Ensure MongoDB backups succeeded (Atlas console).
- Validate Redis memory usage does not exceed plan limits.
- Verify Cloudflare Pages build history for failed deployments.

## Incident Response Cheatsheet

1. **API returning 500**
   - Check Railway logs for stack traces.
   - Run `npm run test` locally to confirm no regression in core flows.
   - Confirm environment variables loaded (`/api/health/details` returns environment, Node version, memory, and database state).
2. **Frontend cannot reach API**
   - Confirm `VITE_API_URL` or proxy rule is correct.
   - Inspect CORS errors—update `CORS_ORIGINS` if domain changed.
3. **PDF generation failing**
   - Look for errors from `pdfService`. Ensure fonts/templates exist under `backend/templates`.
   - Validate Redis is reachable. PDF rendering reads branding from MongoDB on every request; it does not use Redis or a queue.
4. **Billing data mismatch**
   - Query MongoDB directly to verify values.
   - Review `UserActivity` for manual adjustments.

## Maintenance Windows

- Enable Railway auto-stop outside business hours if cost-sensitive; refresh tokens survive as long as the Redis plan persists data.
- Perform dependency updates quarterly and run smoke tests (bill create, inventory update, quotation PDF).
- Rotate `ADMIN_SETUP_KEY` after each use and keep value in secure vault.

## Disaster Playbook References

- [Deployment Runbook](../setup/deployment.md)
- [Security Considerations](./security.md)
- [Future Expansion](../product/future-expansion.md) for multi-site failover plans.
