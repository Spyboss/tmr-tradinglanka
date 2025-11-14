# Architecture Overview

The platform is delivered as a TypeScript monorepo with a React SPA (`frontend/`) and an Express API (`backend/`). The two applications deploy independently but share a release cadence through GitHub Actions.

## High-Level Topology

```
┌──────────────────────────────────────────────────┐
│                 Cloudflare Pages                  │
│  React + Vite SPA • Auth cookie storage • CDN edge│
└──────────────▲───────────────────────────────────┘
               │ HTTPS (browser)
┌──────────────┴──────────────┐
│   Railway (Express API)     │◄────┐ BullMQ-style workers
│   Autoscaled containers     │     │ share Redis client
└──────────────▲──────────────┘     │
               │                    │
               │ HTTPS (private)    │
┌──────────────┴──────────────┐     │
│    MongoDB Atlas (M10)      │◄────┘  Redis Cloud (session + rate limit)
│  Encrypted customer fields  │
└──────────────────────────────┘
```

### Why This Design

- **Managed services** keep the operational footprint lean for a small dealership team. Railway handles container restarts and autoscaling; Cloudflare Pages provides TLS and caching without bespoke infra.
- **Stateless API containers** with Redis-backed tokens make horizontal scaling trivial and keep refresh-token revocation cheap.
- **MongoDB document model** matches the bill/quotation domain—each record captures a full business transaction without joins. Encryption plugins protect NIC and address data.
- **Single source of branding truth** (MongoDB collection) guarantees consistent dealer identity across all outputs.

## Module Breakdown

| Module | Location | Responsibilities |
| --- | --- | --- |
| Authentication | `backend/src/auth` | JWT issuance, refresh rotation, verification flags, rate limiting, admin bootstrap. |
| Billing | `backend/src/routes/billRoutes.ts` & controllers | CRUD operations, ownership enforcement, PDF generation, integration with inventory. |
| Inventory | `backend/src/routes/inventoryRoutes.ts` | Item lifecycle, analytics summaries, PDF exports, bike-model catalogue linkage. |
| Quotations | `backend/src/routes/quotationRoutes.ts` | Multi-line quotations, invoice conversion, PDF exports, bill customer reuse. |
| Branding | `backend/src/routes/brandingRoutes.ts` | Dealer identity configuration powering SPA header and PDF templates. |
| User Preferences | `backend/src/routes/userRoutes.ts` | Theme, language, notification settings per user, backed by `UserPreferences` model. |
| Activity Logging | `backend/src/middleware/activityLogger.middleware.ts` | Writes structured events into `UserActivity`. |
| GDPR Toolkit | `backend/src/routes/gdprRoutes.ts` | Encrypted export ZIPs, pseudonymised deletes, token revocation. |
| Frontend Shell | `frontend/src/App.jsx` | Authenticated routing, Ant Design layout, navigation. |
| Feature Pages | `frontend/src/pages` | Dashboard, bills, inventory, quotations, admin, verification. |
| API Client | `frontend/src/config/apiClient.js` | Axios instance with auth interceptors and error handling. |

## Request Lifecycle

1. **Browser session** authenticates via `/api/auth/login`. The backend sets an HTTP-only refresh cookie and returns an access token payload.
2. **SPA requests** include the Bearer token. `authenticate` middleware validates it, loads user context, and attaches `req.user`.
3. **Authorisation** checks (admin, ownership) run per route. Queries filter by `owner` for non-admins to guarantee data isolation.
4. **Controllers** apply validation, interact with Mongoose models, and trigger PDF services or Redis writes when needed.
5. **Responses** serialise Mongoose documents with encryption plugin auto-decrypting flagged fields.

## Deployment Flow

1. Pull requests run lint/tests (backend) and Vite build (frontend) through GitHub Actions.
2. Merges to `main` trigger two jobs:
   - **Frontend** – Build artefacts, publish to Cloudflare Pages using production environment variables.
   - **Backend** – Compile TypeScript, package Docker image, and release to Railway. Railway health checks `GET /api/health`.
3. Railway auto-rolls containers; Cloudflare Pages serves new assets via CDN once build completes.

## Further Reading

- [API Reference](./api-reference.md)
- [Data Model & ERD](./data-model.md)
- [Security Considerations](../operations/security.md)
