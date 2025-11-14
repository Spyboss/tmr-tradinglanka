# Environment Configuration

The system uses two environment files:

- `backend/.env` – API, database, and security settings.
- `frontend/.env` – SPA build-time configuration.

Copy the provided `.env.example` files and adjust values per environment.

## Backend Variables

| Variable | Required | Default / Notes |
| --- | --- | --- |
| `NODE_ENV` | Yes | `development` locally, `production` in Railway. Drives rate limits and security middleware. |
| `PORT` | No | `8080`. Change when running behind another proxy. |
| `MONGODB_URI` | Yes | MongoDB connection string with credentials. Application exits if missing. |
| `MONGODB_DB_NAME` | No | `tmr`. Override when pointing to shared cluster. |
| `JWT_SECRET` | Yes | 32+ character secret for access tokens. |
| `ENCRYPTION_KEY` | Yes | 32+ character AES key for customer data. |
| `REDIS_URL` | Required in prod | Redis connection (e.g., `redis://user:pass@host:6379`). Dev falls back to in-memory mock. |
| `CORS_ORIGINS` | No | Comma-separated allowlist; defaults to Cloudflare Pages + Railway domains + localhost. |
| `ALLOW_NO_ORIGIN` | No | `true` to allow health checks without Origin header. Set `false` to harden. |
| `LEGACY_REFRESH_ACCEPT` | No | `true` by default. Set `false` to reject pre-hash refresh tokens after migration. |
| `LOG_LEVEL` | No | `info`. Options: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. |
| `PUBLIC_BASE_URL` | No | Used for verification links. Defaults to production Pages URL. |
| `EMAIL_PROVIDER` | No | `console` (default) or `resend`. |
| `EMAIL_FROM` | No | Sender identity. Default `TMR Trading Lanka <no-reply@gunawardanamotors.lk>`. |
| `RESEND_API_KEY` | Required when provider=`resend` | API key for Resend transactional email. |
| `EMAIL_VERIFICATION_ENABLED` | No | `false`. Enable to send verification emails. |
| `EMAIL_VERIFICATION_ENFORCE` | No | `false`. Gate to enforce verification for non-admins. |
| `EMAIL_VERIFICATION_ENFORCE_CUTOFF_ISO` | Required when enforce=`true` | ISO date; users created before this bypass enforcement. |
| `VERIFICATION_TOKEN_TTL_MINUTES` | No | `30`. Token expiration window. |
| `SECURITY_ALERT_ENDPOINT` | No | HTTPS endpoint for SIEM/webhook alerts. Leave unset to disable external calls. |
| `SECURITY_ALERT_API_KEY` | No | API key header for alert endpoint. |
| `COMPANY_BRAND` | No | Overrides PDF header text. Defaults to `TMR TRADING LANKA (Pvt) Ltd`. |
| `ADMIN_SETUP_KEY` | Recommended | Shared secret required to create first admin. |
| `ADMIN_EMAIL` | Optional | Used by bootstrap script to auto-create admin on startup if both email and password present. |
| `ADMIN_PASSWORD` | Optional | Paired with `ADMIN_EMAIL`. |
| `ADMIN_NAME` | Optional | Friendly name for auto-created admin. |

### Backend `.env.example`

```env
NODE_ENV=development
PORT=8080
MONGODB_URI=mongodb://localhost:27017/tmr
MONGODB_DB_NAME=tmr
JWT_SECRET=change-me-to-a-strong-32-char-secret
ENCRYPTION_KEY=change-me-to-another-strong-32-char-secret
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:5173
ALLOW_NO_ORIGIN=true
LEGACY_REFRESH_ACCEPT=true
LOG_LEVEL=info
PUBLIC_BASE_URL=http://localhost:5173
EMAIL_PROVIDER=console
EMAIL_FROM=TMR Trading Lanka <no-reply@example.com>
RESEND_API_KEY=
EMAIL_VERIFICATION_ENABLED=false
EMAIL_VERIFICATION_ENFORCE=false
EMAIL_VERIFICATION_ENFORCE_CUTOFF_ISO=
VERIFICATION_TOKEN_TTL_MINUTES=30
SECURITY_ALERT_ENDPOINT=
SECURITY_ALERT_API_KEY=
COMPANY_BRAND=TMR TRADING LANKA (Pvt) Ltd
ADMIN_SETUP_KEY=local-admin-setup-key
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=
```

## Frontend Variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Base URL for API calls. Use `/api` when Cloudflare proxy is configured. |
| `VITE_APP_NAME` | No | Display name in titles and headers. Defaults to `TMR Trading Lanka`. |
| `VITE_APP_DESCRIPTION` | No | Used for meta tags. |

### Frontend `.env.example`

```env
VITE_API_URL=http://localhost:8080
VITE_APP_NAME=TMR Trading Lanka
VITE_APP_DESCRIPTION=Motorcycle dealership ERP for sales, inventory, and quotations
```

## Secret Management Tips

- Store production secrets in Railway/Cloudflare dashboards, not in `.env` files.
- Rotate `JWT_SECRET` and `ENCRYPTION_KEY` quarterly; update all running instances simultaneously to avoid invalid tokens.
- Use environment-specific Redis instances to isolate rate limits and refresh tokens between staging and production.
