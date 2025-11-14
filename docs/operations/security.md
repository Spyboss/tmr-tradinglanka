# Security Considerations

The platform handles personally identifiable information (PII) and financial records. This section documents the current security posture and expectations for operators.

## Authentication & Session Management

- **Access tokens**: Signed JWTs using `JWT_SECRET`. Issued on login, expire after 60 minutes.
- **Refresh tokens**: Random 32-byte values hashed with SHA-256 + `JWT_SECRET` salt and stored in Redis. Delivered via HTTP-only cookie (`SameSite=None; Secure` in production).
- **Token revocation**: `logout`, `password` change, and GDPR delete flows revoke existing refresh tokens.
- **Admin bootstrap**: `POST /api/auth/create-admin` requires `ADMIN_SETUP_KEY`. Disable endpoint after seeding by removing the key in production.
- **Email verification**: Optional feature gate. When enforced, `enforceVerification` middleware blocks user routes for unverified accounts while exempting admins and legacy users (before `EMAIL_VERIFICATION_ENFORCE_CUTOFF_ISO`).

## Authorisation

- **Roles**: `admin`, `user`, `deleted`. Admin routes require `requireAdmin` middleware.
- **Ownership controls**: Bills, quotations, and inventory queries filter by `owner` or `addedBy` for non-admins.
- **Branding updates**: Only admins can mutate dealer identity to prevent defacement.

## Data Protection

- **Encryption at application layer**: `encryption-plugin` automatically encrypts `customerNIC`, `customerAddress`, and other flagged fields before storage. AES key sourced from `ENCRYPTION_KEY`.
- **Transport security**: All environments expect HTTPS. Cloudflare Pages enforces TLS; Railway provides TLS termination by default.
- **GDPR tooling**: Export route returns AES-encrypted ZIPs with separate key note. Delete route pseudonymises the user, clears refresh tokens, and drops owned bills.

## Input Validation & Sanitisation

- `express-validator` ensures payload shapes for auth/profile endpoints.
- `sanitizeRequestParams` middleware strips `<script>` injections, `javascript:` URLs, and suspicious query fragments.
- `express-mongo-sanitize` removes `$` and `.` from payloads to avoid operator injection.
- Payload size limited to 100KB for JSON/URL-encoded bodies.

## Rate Limiting & Abuse Detection

- Login/register endpoints use `rate-limiter-flexible` to mitigate brute force attempts (`loginRateLimit`, `registrationRateLimit`).
- Verification endpoints have dedicated rate limits to protect against enumeration.
- `apiRateLimit` guard (configurable) throttles authenticated traffic bursts.
- `security-monitor` tracks failed logins and suspicious IPs, optionally forwarding to `SECURITY_ALERT_ENDPOINT` with `SECURITY_ALERT_API_KEY`.

## CORS & CSRF Controls

- CORS allowlist derived from `CORS_ORIGINS` with per-request validation.
- Requests without `Origin` header are blocked when `ALLOW_NO_ORIGIN=false`. Keep `true` for platform health checks if required.
- Refresh/logout endpoints validate `Origin`/`Referer` headers in production.

## Logging & Monitoring

- Structured logging via Winston (`logger.ts`). Log levels controlled by `LOG_LEVEL`.
- Sensitive fields (passwords, tokens) never logged. Encryption errors emit warnings but not raw values.
- Audit events recorded in `UserActivity` for key actions (bill create/update/delete, profile changes, etc.).

## Secrets Management

- Secrets live in environment variables only. `.env.example` files contain placeholders.
- Rotate `JWT_SECRET` and `ENCRYPTION_KEY` quarterly; coordinate rolling restarts to honour refresh tokens.
- Use dedicated Redis instances per environment to avoid cross-tenant token leakage.

## Hardening Backlog

- Enable strict IP blocking once production traffic patterns stabilise; currently suspicious IPs are logged but not blocked to avoid false positives.
- Implement optional multi-factor authentication for admin users (see [Roadmap](../product/roadmap.md)).
- Add automated dependency scanning (npm audit or Snyk) to CI pipeline.
