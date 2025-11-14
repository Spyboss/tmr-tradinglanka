# Performance Notes

This guide summarises the current performance characteristics and tuning levers.

## Backend Throughput

- Typical bill creation completes within **<1.2s** (95th percentile) when MongoDB and Redis are co-located in the same region.
- Inventory analytics endpoints aggregate using MongoDB pipeline with indexes on `bikeModelId` and `status`. Expect ~200ms for datasets under 10k records.
- PDF generation leverages PDFKit; most requests finish in under 700ms. For large batch exports prefer asynchronous workers.

## Scaling Strategy

- Railway autoscaling adds containers when CPU >70% for 3 minutes. Ensure Redis plan supports expected concurrency.
- API containers are stateless. Session data (refresh tokens, verification tokens, rate limits) live in Redis, so additional instances require no warm-up.
- Enable Horizontal Pod Auto Scaling equivalent if migrating to Kubernetes; metrics already available via Prometheus.

## Frontend Performance

- Vite produces tree-shaken bundles with code splitting by route.
- Ant Design components are imported selectively to keep bundle size manageable.
- Cloudflare Pages caches static assets globally; busting occurs automatically on new deployments.

## Known Bottlenecks & Mitigations

| Scenario | Symptom | Mitigation |
| --- | --- | --- |
| Large PDF exports | Memory spikes in API container | Offload to worker process or increase memory limit temporarily. |
| Burst quotation imports | Rate limits triggered | Adjust `apiRateLimit` thresholds or stage imports in batches. |
| Slow dashboard charts | Inventory analytics > 10k records | Add materialised views or nightly summary collection. |
| High login traffic | Increased failed login alerts | Tune `security-monitor` thresholds or add Cloudflare WAF rules. |

## Benchmark Tips

- Use `npm run test` (backend) for regression safety, then run load tests via k6 or Artillery hitting `/api/bills` and `/api/inventory`.
- Monitor MongoDB metrics (op counters, cache hits). Consider upgrading to M20 when CPU >60% sustained.
- Redis command stats should show sub-millisecond latencies. Anything above 5ms indicates network issues or plan saturation.

## Future Optimisations

- Introduce job queue workers for heavy PDF workloads (BullMQ integration hooks already exist in services layer).
- Cache bike model lookups in Redis to reduce repeated reads on bill creation forms.
- Add dataloader/resolver caching in frontend for repeated dropdown data.
