# Security Audit Report — 2025-11-11

This report summarizes the security audit and targeted hardening changes applied to the backend service. The work adheres to guardrails: no production routes removed, no database schema modifications, no new dependencies, and full compatibility with existing MongoDB data.

## Scope
- Rate limiting enforcement and behavior in production
- `multipart/form-data` detection to avoid corrupting file uploads
- PDF logo fetching safety (SSRF and resource exhaustion mitigations)
- Review of security headers and CSP configuration
- Repository secret exposure scan (working tree and spot-checks)

## Changes Applied

### 1) Enforce 429 for rate limit violations in production
- Files:
  - `backend/src/auth/rate-limit.middleware.ts`
  - `backend/src/auth/verify-rate-limit.middleware.ts`
- Behavior:
  - In production (`NODE_ENV=production`), return `429 Too Many Requests` when `apiLimiter`, `loginLimiter`, `registrationLimiter`, or `verifyLimiter` thresholds are exceeded.
  - In non-production environments, continue soft enforcement (log and proceed) to preserve developer ergonomics.
- Rationale:
  - Prevents DoS amplification and brute-force attempts by strictly enforcing per-IP/email limits in production while keeping dev DX smooth.

### 2) Improve `multipart/form-data` detection
- File: `backend/src/middleware/security-middleware.ts`
- Behavior:
  - Body sanitization is skipped when `Content-Type` is `multipart/form-data`, even when a `boundary=` parameter is present.
- Rationale:
  - Prevents accidental mutation of file-upload payloads by sanitizers that are intended for JSON/form-encoded bodies.
  - Currently the project does not implement a server-side upload pipeline (e.g., Multer); branding uses `logoUrl` as a remote URL. This change future-proofs the middleware for any uploads added later without introducing dependencies.

### 3) Harden remote logo fetching in PDF generation
- File: `backend/src/services/pdfService.ts`
- Behavior:
  - `loadLogoBuffer(url)` now enforces:
    - Only 2xx responses are accepted
    - `content-type` must be `image/*`
    - Max size cap: 1 MB
    - Request timeout: 5 seconds
- Rationale:
  - Mitigates SSRF and resource exhaustion risks when fetching a remote logo via `logoUrl`. Prevents oversized or non-image responses from degrading PDF generation or server performance.

## Reviews and Findings

### Security headers & CSP
- Helmet with CSP is configured in `backend/src/server.ts` with granular directives for `defaultSrc`, `scriptSrc`, `styleSrc`, `imgSrc`, `connectSrc`, `fontSrc`, `objectSrc`, `mediaSrc`, and `frameSrc`.
- Additional headers include XSS filter, HSTS, and a strict `referrerPolicy`.
- Recommendation (no change made): consider adding `base-uri 'none'`, `form-action 'self'`, and `frame-ancestors 'none'` to further reduce attack surface if compatible with current UI flows.

### Upload/file handling
- No server-side upload endpoints (Multer/Busboy) are present; branding expects a `logoUrl`.
- Middleware now correctly skips sanitization for `multipart/form-data` should uploads be added later.

### Secret exposure scan
- Working tree search: no committed secrets found. Docs contain `mongodb+srv://` examples only in README and setup guides with placeholders.
- Commit history spot-checks attempted but limited by environment output. Recommendation: add automated scanning via `gitleaks` or native GitHub secret scanning and enforce pre-commit hooks in CI.

### DoS and privilege escalation
- DoS risk reduced via enforced rate limits in production for general API, login, registration, and verification flows.
- Existing JWT auth middleware provides `requireAdmin` and ownership checks; no changes required. Recommendation: ensure high-sensitivity routes consistently apply these middlewares.

## Compatibility & Guardrails
- No production routes removed; all changes are middleware behavior or helper safeguards.
- No database schema changes; MongoDB compatibility preserved.
- No new dependencies introduced.

## Verification
- Rate limiters: in production environment, exceeding thresholds now returns `429`.
- PDF generation: remote logo fetches that are non-images, exceed 1MB, or take longer than 5s are ignored gracefully; PDFs render without the logo.
- Middleware: `multipart/form-data` requests bypass body sanitization as intended.

## Next Steps (Recommendations)
- Add automated secret scanning to CI (e.g., `gitleaks`), and enable GitHub secret scanning at the repository level.
- Expand CSP with `frame-ancestors 'none'` and `form-action 'self'` if frontends and embedded contexts allow.
- Consider adding a global request timeout and size limits for JSON bodies to further reduce DoS avenues.