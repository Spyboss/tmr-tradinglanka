# Deployment Runbook

This document covers production-grade deployment for the SPA and API.

## Overview

| Component | Platform | Trigger |
| --- | --- | --- |
| Frontend | Cloudflare Pages | GitHub Action on `main` build |
| Backend | Railway | GitHub Action on `main` build |
| Database | MongoDB Atlas | Managed cluster |
| Cache / Queue | Redis Cloud | Managed instance |

## Railway (Backend API)

1. **Create project** in Railway and link the GitHub repository to the `backend/` directory.
2. **Set build command**: `npm install && npm run build`.
3. **Set start command**: `npm start`.
4. **Configure environment variables** matching [Environment Configuration](./environment.md). Required secrets:
   - `NODE_ENV=production`
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
   - `JWT_SECRET`
   - `ENCRYPTION_KEY`
   - `REDIS_URL`
   - `CORS_ORIGINS=https://tmr-tradinglanka.pages.dev`
   - `ALLOW_NO_ORIGIN=true` (keeps Railway health check working)
5. **Health checks**: ensure Railway probes `GET /api/health`.
6. **Autoscaling**: enable auto-start and auto-stop. Each container is stateless; Redis covers refresh token revocation.
7. **Logs & Metrics**: connect Railway log drains to Better Stack or similar; `/api/health/metrics` can be scraped when secured.

### Manual Deploy

When CI is unavailable:

```bash
cd backend
npm install
npm run build
railway up
```

## Cloudflare Pages (Frontend)

1. Create a Pages project pointing to this repository.
2. **Build settings**:
   - Build command: `npm install && npm run build --prefix frontend`
   - Output directory: `frontend/dist`
   - Node version: `18`
3. Set environment variables:
   - `VITE_API_URL=https://tmr-production.up.railway.app` or `/api` if using Cloudflare proxy.
   - `VITE_APP_NAME=TMR Trading Lanka`
   - `VITE_APP_DESCRIPTION=Motorcycle dealership ERP`
4. Configure `_redirects` to proxy API calls when desired:
   ```
   /api/* https://tmr-production.up.railway.app/api/:splat 200
   /* /index.html 200
   ```
5. Protect preview deployments with Cloudflare Zero Trust (email/SSO) so staging data stays private.

## Database & Cache

- **MongoDB Atlas**: deploy an M10 replica set. Enable IP allowlist for Railway/Cloudflare egress IPs. Turn on automated backups.
- **Redis Cloud**: create a fixed-size instance. Enable TLS and set `REDIS_URL` to `rediss://` form in production.

## Domain & TLS

- Cloudflare Pages manages TLS for the SPA and custom domains.
- The backend remains on Railway-provided domain or custom domain with Railway's TLS certificates.

## Release Checklist

1. `npm run lint` and `npm run test` (backend) pass locally.
2. Update [CHANGELOG](../../CHANGELOG.md) with release notes.
3. Confirm `.env` secrets in Railway/Cloudflare.
4. Merge PR to `main` to trigger CI deployments.
5. Validate:
   - Login + refresh flow
   - Bill creation and PDF download
   - Inventory analytics endpoint
   - Quotation conversion to invoice
   - Branding update propagation
6. Tag release (optional) using `git tag vX.Y.Z && git push origin vX.Y.Z`.

## Disaster Recovery

- MongoDB Atlas automated backups: point-in-time restore available.
- Redis: enable daily snapshots if using persistent plan; otherwise treat as ephemeral.
- Store `.env` secrets in secure password manager to rebuild environments quickly.
- Runbooks for manual recovery live in `docs/operations/observability.md` (alert handling) and `docs/product/future-expansion.md` (multi-site readiness).
