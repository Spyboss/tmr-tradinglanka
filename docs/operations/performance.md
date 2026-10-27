# Performance Notes

This guide summarises the current performance characteristics and tuning levers.

## Backend Throughput

- Bill creation is bounded by the MongoDB write and the Redis token write. Target under **1.2s** at the 95th percentile with MongoDB and Redis in the same region; no benchmark results are checked into this repo.
- Inventory analytics aggregate in MongoDB with indexes on `bikeModelId` and `status`. A few hundred milliseconds is the target for datasets under 10k records.
- PDF generation uses PDFKit and runs inline. Single-document requests usually finish in under a second; large batch exports should move to a worker.

## Scaling Strategy

- Railway adds containers when CPU stays high, if autoscaling is enabled on the service. Redis must support the extra concurrency.
- API containers are stateless. Session data (refresh tokens, verification tokens, rate limits) live in Redis, so additional instances require no warm-up.
- If this ever moves to Kubernetes, the stateless container model carries over unchanged. The API exposes no metrics endpoint, so scaling would key off container CPU and memory.

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

- Introduce a job queue for heavy PDF workloads. PDFs render inline in the request that asked for them, so a large export holds that request open until it finishes.
- Cache bike model lookups in Redis to reduce repeated reads on bill creation forms.
- Add dataloader/resolver caching in frontend for repeated dropdown data.
