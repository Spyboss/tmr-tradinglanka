# Backend API – TMR Trading Lanka

TypeScript Express API powering the TMR Trading Lanka dealership ERP.

## Highlights

- **Authentication** – JWT access tokens, Redis-backed refresh tokens, optional email verification enforcement.
- **Business Modules** – Bills, inventory, quotations/invoices, bike models, branding, user preferences/activity, GDPR tooling.
- **Security** – AES encryption plugin for PII, rate limiting, origin enforcement, and security monitoring hooks.
- **Docs** – Full API contract in [`../docs/architecture/api-reference.md`](../docs/architecture/api-reference.md).

## Project Structure

```
backend/
├── src/
│   ├── auth/              # Auth controllers, middleware, rate limits
│   ├── controllers/       # Business logic per module
│   ├── routes/            # Express routers mounted in server.ts
│   ├── models/            # Mongoose schemas (with encryption plugin)
│   ├── middleware/        # Error handling, security, activity logging
│   ├── services/          # PDF generation, mailer, utilities
│   ├── config/            # MongoDB & Redis setup
│   └── utils/             # Logger, encryption, security monitor
├── templates/             # PDF assets
├── Dockerfile             # Railway deployment image
└── tsconfig.json
```

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

- API listens on `http://localhost:8080` by default.
- MongoDB/Redis connection strings and secrets go in `.env`. See [`../docs/setup/environment.md`](../docs/setup/environment.md).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run development server with hot reload (`tsx`). |
| `npm run build` | Compile TypeScript and copy templates to `dist/`. |
| `npm start` | Start compiled server with `dotenv/config`. |
| `npm run lint` | ESLint across `src/`. |
| `npm run test` | Vitest suite (unit/integration). |
| `npm run build:prod` | Production build with dependency sanity checks. |

## Environment Checklist

- `MONGODB_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`, `REDIS_URL` must be set before production deployment.
- `ADMIN_SETUP_KEY` required to create first admin via `/api/auth/create-admin`.
- Optional email verification (`EMAIL_VERIFICATION_ENABLED`, `EMAIL_PROVIDER`, etc.) is fail-open until configured.

## Request Lifecycle

1. `server.ts` loads `.env`, validates required keys, connects to MongoDB & Redis.
2. Security middleware applies Helmet, sanitisation, rate limits, and request logging.
3. Routes under `/api/*` authenticate via `authenticate`; admin-only routes use `requireAdmin`.
4. Controllers interact with Mongoose models. Encryption plugin decrypts flagged fields before response serialisation.
5. Errors funnel through `errorHandler`, returning consistent JSON payloads with HTTP status codes.

## Testing & Quality

```bash
npm run lint
npm run test
```

Vitest covers critical controllers and utilities. Extend coverage as modules evolve.

## Deployment Notes

- Railway executes `npm install` + `npm run build` then `npm start`.
- Health check endpoint: `GET /api/health`.
- Metrics endpoint: `GET /api/health/metrics` (protect before exposing externally).
- Static templates copied into Docker image for PDF generation.

For operational guidance see [`../docs/setup/deployment.md`](../docs/setup/deployment.md) and [`../docs/operations/security.md`](../docs/operations/security.md).
