# 📝 Changelog

All notable changes to the TMR Trading Lanka Business Management System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [x.x.x] - 2025-11-11 - 🏷️ Brand & Package Rename

### Changed
- Backend package name renamed from `gunawardhana-motors-api` to `tmr-tradinglanka-api`.
- Updated UI and documentation branding from "Gunawardhana Motors" to "TMR Trading Lanka" (Navbar default, Inventory Report, README files, docs).
- Updated backend Dockerfile embedded PDF header brand line to "TMR TRADING LANKA (PVT) LTD, EMBILIPITIYA".
- Frontend package name renamed from `gunawardhana-motors-frontend` to `tmr-tradinglanka-frontend`.
- Railway deployment config: set `ALLOW_NO_ORIGIN=true` in `backend/railway.toml` to ensure platform health probes succeed without `Origin` headers.

### Notes
- No production routes removed and no database schema changes.
- No new dependencies introduced.
- Fully compatible with existing MongoDB data and configurations.

## [2.0.7] - 2025-11-10 - 🚀 Production Readiness & Deployment Checklist

### Added
- Documented production environment configuration for Railway (backend) and Cloudflare Pages (frontend).
- Clarified required env keys and safe defaults across both apps:
  - Backend: `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`, `REDIS_URL`, `CORS_ORIGINS`.
  - Frontend: `VITE_API_URL`, `VITE_APP_NAME`, `VITE_APP_DESCRIPTION`.
- Captured operational steps for admin bootstrap using `POST /api/auth/create-admin` gated by `ADMIN_SETUP_KEY` (no code change).

### Changed
- Updated docs to reflect cross-origin cookie policy (SameSite=None; Secure) and CORS allowlist behavior already present in code.
- Ensured example `.env` files contain placeholders only; no real secrets are tracked.

### Notes
- No schema changes, route removals, or new dependencies.
- Compatible with existing MongoDB data; environment-only configuration drives behavior.
- This entry documents production readiness and deployment steps performed prior to push.

## [x.x.x] - 2025-11-11 - 🎨 Branding Integration (UI) & Bill Preview Endpoints

### Added
- Bill preview endpoints (additive, authenticated):
  - `GET /api/bills/preview` — returns a sample bill PDF.
  - `GET /api/bills/preview/pdf?formData={...}` — generates PDF from query-provided bill data.
  - `POST /api/bills/preview` — generates PDF from JSON body bill data.
 - Frontend Profile page: new "Branding" tab with logo URL preview and bill PDF preview button; integrates `GET /api/branding` and `PUT /api/branding`.

### Changed
- Frontend Navbar title now reads `dealerName` from `GET /api/branding` for dynamic branding; falls back gracefully to "TMR Trading Lanka" if unavailable or unauthenticated.
- Quotation PDF header now uses branding (dealerName, brandPartner, address lines, primaryColor) instead of hardcoded text.
- Inventory PDF header and signature/footer now use branding (dealerName, address lines, primaryColor) and remove hardcoded contact line.

### Notes
- No production routes removed; only additive preview endpoints.
- No database schema changes.
- Compatible with existing MongoDB data and defaults.
 - Developer ergonomics: Fixed TypeScript typings for `PDFKit.PDFDocument.image` to accept `Buffer | Uint8Array | string`, unblocking use of remote logo buffers in bill headers.
- Railway healthcheck: if CORS blocks requests without an `Origin` header, set `ALLOW_NO_ORIGIN=true` in Railway environment (or leave it unset) so `/api/health` passes. This preserves stricter CORS for browser requests while allowing platform health probes.
 - Email (Resend): set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and ensure `EMAIL_FROM` is either `email@example.com` or `Name <email@example.com>` (no backticks, quotes, or trailing commas). Use an address on a domain verified in Resend. For quick testing only, `onboarding@resend.dev` works; do not use it in production.

## [x.x.x] - 2025-11-10 - ✉️ Email Verification Integration (non-breaking)

### Added
- Optional email verification flow behind feature flag (no enforcement).
- Registration now triggers a verification email when enabled (fail-open).
- New endpoints under `/api/auth/verify`:
  - `POST /api/auth/verify/request` – issues a verification email if enabled.
  - `POST /api/auth/verify/confirm` – confirms verification if enabled.
  - `GET /api/auth/verify/status` – authenticated status query for the current user.
- Redis-backed verification token service with salted SHA-256 keys.
- `EmailVerificationStatus` model to track verification without altering `User` schema.
- Verification rate limiter (soft enforcement) for request/confirm endpoints.
- Mailer provider switch: `resend` primary, `console` fallback in development.

### Configuration
- `EMAIL_VERIFICATION_ENABLED` (default `false`) to gate entire feature.
- `VERIFICATION_TOKEN_TTL_MINUTES` (default `30`).
- `PUBLIC_BASE_URL` used to construct verification links.
- `EMAIL_PROVIDER` (`resend` or `console`), `EMAIL_FROM`, `RESEND_API_KEY`.

### Notes
- No changes to existing login/refresh/logout/admin behavior.
- Verification is optional and does not restrict users.

## [x.x.x] - 2025-11-10 - 🚦 Email Verification Enforcement (flag-gated)

### Added
- Enforcement middleware `enforceVerification` (flag-gated) returning friendly `403` for non-verified users on private routes.
- Admin bypass: `UserRole.ADMIN` is always exempt.
- Legacy bypass: accounts created before `EMAIL_VERIFICATION_ENFORCE_CUTOFF_ISO` are exempt (no schema change).

### Configuration
- `EMAIL_VERIFICATION_ENFORCE` (default `false`) — enables friendly `403` enforcement.
- `EMAIL_VERIFICATION_ENFORCE_CUTOFF_ISO` — ISO 8601 date; users created before this are treated as legacy and bypass enforcement.

### Routing
- Applied to private auth routes: `/api/auth/me`, `/api/auth/profile`, `/api/auth/password`.
- Applied to user routes under `/api/user/*` after authentication.
- Not applied to `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, or `/api/auth/verify/*`.

### Notes
- Non-breaking when flag is `false` (default). Login/refresh/admin remain unchanged.
- Fail-open on errors; enforcement never blocks due to internal failures or provider outages.

## [x.x.x] - 2025-11-10 - 🔐 **Crypto correctness with compatibility window**

### Changed
- Replaced all insecure RNG/hash fallbacks in auth with `node:crypto`.
- Token IDs and random values use `crypto.randomBytes(32).toString('hex')`.
- Refresh token hashing uses `crypto.createHash('sha256').update(JWT_SECRET + value).digest('hex')`.
- Added `LEGACY_REFRESH_ACCEPT=true` (default) to accept legacy refresh-token keys in Redis during verification.
- On successful legacy refresh, the server rotates to a new refresh token (salted SHA-256 key) and revokes the old one.

### Notes
- No schema changes or route signature changes.
- No new dependencies; runtime behavior remains stable (cookie options unchanged).
- Sessions created pre-patch continue to refresh; on first refresh they migrate seamlessly to the new format.
- Redis will show the old key revoked and the new key present with the correct TTL.

## [x.x.x] - 2025-11-10 - 🧹 **TypeScript & Lint Hygiene**

### Changed
- Normalized logger call signatures to single-argument strings to satisfy TypeScript.
- Cleaned up WebCrypto usage in `backend/src/server.ts` to use `node:crypto` `webcrypto`.
- Fixed minor TypeScript typing in controllers and services (`Partial<IUserPreferences>`, PDFKit options).

### Notes
- No logic changes, routes, or data flow modifications.
- No new dependencies; runtime behavior remains unchanged.

## [x.x.x] - 2025-11-10 - 🛡️ **Cross-Origin Cookie Policy & CSRF Checks (safe fallback)**

### Changed
- Cookies: In production, `refreshToken` is set with `SameSite=None; Secure; HttpOnly; Path=/` to support cross-origin auth from Cloudflare Pages.
- CSRF: Added Origin/Referer validation for `/api/auth/refresh` and `/api/auth/logout` in production. Requests without a matching `Origin` or `Referer` return `403 Forbidden` and are logged via `logger.warn`.
- CORS: Introduced `ALLOW_NO_ORIGIN` to control whether requests without an `Origin` header are permitted. When `false`, such requests are blocked; when unset or `true`, legacy behavior is preserved.
- Allowlist reuse: Expose resolved `allowedOrigins` via `app.locals` for use in controllers.

### Notes
- No schema changes or API signature changes.
- No new dependencies; existing behavior is preserved if `CORS_ORIGINS`/`ALLOW_NO_ORIGIN` are unset.
- Safe fallback: If `CORS_ORIGINS` is not provided, the previous hardcoded allowlist remains in effect.

## [2.0.2] - 2025-11-09 - 🔧 **Env-Driven CORS & .env Consolidation**

### Changed
- Backend server now reads allowed CORS origins from `CORS_ORIGINS` (comma-separated). If unset, it falls back to the previous hard-coded origins for safety.
- Consolidated `backend/.env.example`:
  - Added optional `MONGODB_DB_NAME` to match runtime configuration.
  - Clarified CORS comments to indicate env-driven behavior with fallback.
  - Corrected `ENCRYPTION_KEY` guidance to “at least 32 characters”.
  - Removed duplicate, unused JWT section to prevent confusion.

### Notes
- No changes to authentication logic, token flow, or database schemas.
- Existing MongoDB data remains compatible.
- Production configs remain valid; if `CORS_ORIGINS` is already set, behavior is unchanged.

## [2.0.3] - 2025-11-10 - 🧰 **Dev Startup Fix**

### Changed
- Updated dev script to preload environment variables via `dotenv` using Node’s `--import tsx` and `--watch` for hot reload.
  - `backend/package.json`: `"dev": "node --watch -r dotenv/config --import tsx src/server.ts"`
- Added minimal `backend/.env` with `ENCRYPTION_KEY` to satisfy the encryption service at startup.

### Notes
- No changes to authentication logic, token flow, or schemas.
- This fix targets local development only; production start already preloads dotenv.

## [2.0.4] - 2025-11-10 - 🔧 **Frontend Dev Proxy Fix**

### Changed
- Configured Vite dev proxy to forward `/api` requests to the backend on `http://localhost:8080` to prevent `404` errors from the frontend when calling auth routes.
  - `frontend/vite.config.ts`: `server.proxy['/api'].target = 'http://localhost:8080'`
  - `frontend/vite.config.js`: added equivalent proxy configuration to ensure consistent behavior regardless of config file resolution.

### Notes
- Resolves `POST http://localhost:5173/api/auth/login 404 (Not Found)` during local development.
- No changes to API routes or backend logic; this is a dev-only routing fix.

## [2.0.5] - 2025-11-10 - 🧹 **Vite Config Consolidation**

### Changed
- Standardized frontend config to TypeScript and removed duplicate JavaScript config.
  - Deleted `frontend/vite.config.js`.
  - Ensured `frontend/vite.config.ts` explicitly sets `server.port: 5173` and proxies `/api` to `http://localhost:8080`.

### Notes
- No runtime behavior change beyond dev server resolution; build and proxy settings remain as previously configured in the TypeScript config.
- Keeps project conventions consistent and prevents config drift.

## [2.0.6] - 2025-11-10 - 🧩 **TypeScript Config Compatibility**

### Changed
- Resolved IDE TypeScript diagnostic in `vite.config.ts` by explicitly typing the plugin list.
  - `frontend/vite.config.ts`: cast `plugins` to `PluginOption[]` to avoid cross-workspace Vite type mismatches.

### Notes
- Runtime behavior unchanged; fix targets TypeScript type resolution in monorepo workspaces.
    - Consider running `npm dedupe` at the repo root to reduce duplicate packages.

## [x.x.x] - 2025-11-10 - 🔒 **Env validation + remove hardcoded URI (no behavior change)**

### Changed
- Removed hardcoded MongoDB Atlas URI fallback from `backend/src/config/database.ts`. The backend now requires `MONGODB_URI` to be provided via environment.
- Added startup environment validation in `backend/src/server.ts` for:
  - `NODE_ENV` presence
  - `MONGODB_URI` presence
  - `JWT_SECRET` length (>= 32 chars)
  - `ENCRYPTION_KEY` length (>= 32 chars)
  - `REDIS_URL` presence (required in production, optional in development)
- Updated `backend/.env.example` with clarifying comments for each key.
- Updated `backend/README.md` with an environment variables table and Quick Start recap.

### Notes
- No changes to routes, auth logic, schemas, or token behavior.
- Production is safe: if Railway already has envs set, runtime behavior is unchanged.
- Rollback: revert this commit; do not reintroduce any hardcoded Atlas URI fallback.

## [2.0.1] - 2025-11-09 - 🔧 **Env & Docs Cleanup**

### Changed
- Removed unused `JWT_REFRESH_SECRET` and `ALLOW_ORIGIN` from `backend/.env.production` to reflect current refresh token implementation (opaque tokens stored in Redis).
- Clarified `ENCRYPTION_KEY` requirement to be "at least 32 characters" to match encryption utility validation.
- Updated `backend/README.md` environment variables to remove `JWT_REFRESH_SECRET`, add `REDIS_URL`, and document the refresh token mechanism.

### Notes
- No runtime code changes were made; authentication behavior remains the same.
- Existing data in MongoDB is unaffected.

## [2.0.0] - 2024-01-XX - 🚀 **Major System Evolution**

### 🌟 **System Transformation**
- **BREAKING**: Evolved from simple bill generator to comprehensive business management system
- **BREAKING**: Rebranded from "TMR Bill Generator" to "Gunawardhana Motors Business Management System"
- **NEW**: Complete system architecture overhaul with enterprise-grade features

### ✨ **New Features**

#### 🏢 **Business Management**
- **Quotation System**: Complete quotation management with insurance claims support
- **Advanced Inventory**: Real-time stock tracking with analytics and batch operations
- **User Management**: Role-based access control with comprehensive user profiles
- **Activity Tracking**: Complete audit trails for all user actions
- **Professional Reporting**: LaTeX-quality PDF reports with business intelligence

#### 🔐 **Security & Compliance**
- **Field-level Encryption**: Sensitive data protection using MongoDB encryption
- **GDPR Compliance**: Complete data protection framework with user rights
- **JWT Authentication**: Secure token-based auth with refresh token rotation
- **Rate Limiting**: API abuse prevention with configurable limits
- **Security Monitoring**: Real-time threat detection and logging

## [2.0.7] - 2025-11-10 - 🎯 **Frontend Email Verification UI & Interceptors**

### Added
- Public route `/verify` with Confirm and Request modes.
- `VerificationBadge` component that queries `GET /api/auth/verify/status` and indicates verified/unverified state.
- Typed verification service (`frontend/src/services/verification.ts`) exposing `requestVerification`, `confirmVerification`, and `getVerificationStatus` matching backend payloads.
- Friendly 403 handler in `frontend/src/config/apiClient.js`: detects `403` with `error.code = 'EMAIL_NOT_VERIFIED'` and dispatches a global `email-verification-required` event with `verifyUrl`.

### Changed
- `frontend/src/App.jsx`: registers a global listener for `email-verification-required` to show a toast and navigate to `/verify`; adds `/verify` as a public route.

### Notes
- Non-breaking UI change; existing login/refresh/logout flows remain unchanged.
- Backend enforcement remains gated by `EMAIL_VERIFICATION_ENFORCE` and respects legacy/admin bypass.
- Frontend expects friendly 403 payload shape `{ error: { code, message, verifyUrl } }` and status payload `{ report: { isVerified } }`.

#### 🎨 **User Experience**
- **Dark/Light Themes**: Consistent theming across all components
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Real-time Updates**: Live data synchronization across all modules
- **Accessibility**: WCAG compliant interface design
- **Modern UI**: Complete redesign with Ant Design components

#### 📊 **Advanced Analytics**
- **Business Intelligence**: KPI dashboards and performance metrics
- **Inventory Analytics**: Stock insights with actionable recommendations
- **Financial Reporting**: Revenue tracking and payment analysis
- **Custom Reports**: Flexible reporting system with PDF generation

### 🛠️ **Technical Improvements**

#### Backend Enhancements
- **TypeScript Migration**: Complete codebase conversion to TypeScript
- **API Restructure**: RESTful API design with comprehensive endpoints
- **Database Optimization**: MongoDB with optimized schemas and indexing
- **Error Handling**: Comprehensive error management with structured responses
- **Logging System**: Winston-based structured logging with multiple levels

#### Frontend Modernization
- **React 18**: Upgraded to latest React with modern hooks and patterns
- **Vite Build System**: Fast development and optimized production builds
- **TailwindCSS**: Utility-first styling with custom design system
- **State Management**: Context API for global state management
- **Component Library**: Reusable component system with consistent styling

#### Infrastructure
- **Cloudflare Pages**: Frontend deployment with global CDN
- **Railway Backend**: Scalable backend hosting with automatic deployments
- **MongoDB Atlas**: Cloud database with global clusters and encryption
- **Docker Support**: Containerized development and deployment

## [2.0.8] - 2025-11-10 - 🧩 **Verification UI Wiring & Styling Consistency**

### Added
- Integrated `VerificationBadge` into the Navbar header (desktop) and user dropdown (desktop/mobile) for immediate visibility of verification status.
- Added a dedicated "Verification" tab on the Profile page with:
  - Status badge sourced from `GET /api/auth/verify/status`.
  - Clear CTA linking to the public `/verify` page.

### Changed
- Unified `/verify` page layout and form styling to match `/login` and `/register` (containers, inputs, buttons, message components).
- Added toast notifications to `/login` and `/register` for validation, success, and error feedback, aligning with the `/verify` page’s `react-hot-toast` usage.

### Notes
- No backend logic changes; respects existing feature flags and enforcement rules.
- Public/private route gating left intact via `ProtectedRoute` and friendly `403` interception.

### 🔄 **Migration & Compatibility**
- **Data Migration**: Automatic migration scripts for existing data
- **API Versioning**: Backward compatibility for existing integrations
- **Configuration**: Environment-based configuration management

### 📚 **Documentation**
- **Complete Rewrite**: Professional documentation with comprehensive guides
- **API Reference**: Detailed API documentation with examples
- **Development Guide**: Setup and contribution guidelines
- **Business Workflows**: User manuals and process documentation

### 🐛 **Bug Fixes**
- Fixed inventory synchronization issues
- Resolved PDF generation memory leaks
- Corrected authentication token handling
- Fixed responsive design issues on mobile devices
- Resolved dark mode inconsistencies

### 🔧 **Maintenance**
- Updated all dependencies to latest stable versions
- Improved build processes and deployment pipelines
- Enhanced error monitoring and alerting
- Optimized database queries and performance

---

## [1.0.0] - 2023-XX-XX - 🎯 **Initial Release**

### ✨ **Core Features**
- Basic bill generation for motorcycle sales
- Simple inventory tracking
- PDF invoice generation
- Customer data management
- Payment type support (cash/leasing)

### 🛠️ **Technical Foundation**
- Node.js backend with Express
- React frontend with basic styling
- MongoDB database
- Basic authentication system

### 📋 **Business Logic**
- RMV/CPZ charge calculations
- Vehicle type handling (motorcycles, e-bicycles, tricycles)
- Basic bill status management
- Simple customer records

---

## 🚀 **Future Roadmap**

### Version 2.1.0 - **Enhanced Analytics**
- Advanced business intelligence dashboards
- Predictive inventory analytics
- Customer behavior insights
- Financial forecasting tools

### Version 2.2.0 - **Mobile Application**
- Native mobile app for iOS and Android
- Offline capability for field operations
- Push notifications for important updates
- Mobile-optimized workflows

### Version 2.3.0 - **Integration Platform**
- Third-party accounting software integration
- Bank payment gateway integration
- Government system integrations
- API marketplace for extensions

---

## 📞 **Support & Migration**

For assistance with upgrades or migration:
- **Developer**: [Uminda Herath](https://github.com/Spyboss)
- **Email**: contact@uhadev.com
- **Documentation**: [System Docs](./docs/README.md)
## [2.0.7] - 2025-11-10 - 🔐 **Environment Secrets Cleanup**
- Scrubbed real credentials from `backend/.env.production`, replacing with safe placeholders and clear instructions.
- Strengthened `.gitignore` in root and backend to ignore `.env` and `.env.*` globally, while keeping example files tracked.
- Updated `backend/.env.example` with guidance and generic domains; noted dev proxy behavior for CORS.
- Updated `frontend/.env.example` to recommend using `VITE_API_URL=/api` for dev with Vite proxy and set local direct URL to `http://localhost:8080/api`.
- Non-destructive: no production routes or database schema changes.
## [x.x.x] - 2025-11-10 - ✉️ Email Verification Scaffolding (feature-gated)

### Added
- New optional endpoints under `/api/auth/verify`:
  - `POST /api/auth/verify/request` – issues a verification email if enabled.
  - `POST /api/auth/verify/confirm` – confirms verification if enabled.
- Redis-backed verification token service with salted SHA-256 keys (`verify:<hash>`).
- Non-invasive `EmailVerificationStatus` model to track verification without altering `User` schema.
- Dedicated verification rate limiter (soft enforcement) to avoid blocking legitimate users.
- Mailer service with provider switch: `resend` via dynamic import or `console` fallback.

### Configuration
- Feature flag: `EMAIL_VERIFICATION_ENABLED=false` by default (no-op behavior).
- `VERIFICATION_TOKEN_TTL_MINUTES=30` default TTL.
- `EMAIL_PROVIDER` (`resend` or `console`), `EMAIL_FROM`, `RESEND_API_KEY`.
- `PUBLIC_BASE_URL` used to construct verification links.

### Notes
- No changes to existing auth behavior, cookies, or admin flows.
- Legacy users and sessions remain fully functional; verification disabled by default.
- Safe to roll back by removing routes and files introduced in this patch.
## [x.x.x] - 2025-11-11 - 🔄 **Rename bill-gen defaults to tmr (non-breaking)**

### Changed
- Default MongoDB database name fallbacks from `bill-gen` to `tmr`:
  - `backend/src/config/database.ts` (runtime default)
  - `backend/src/scripts/*` (createAdmin, listUsers, addTricycleModel) local defaults
  - `backend/Dockerfile` sample `.env` and inline helper code
- Security and auth identifiers updated to match TMR branding:
  - `backend/src/auth/jwt.strategy.ts` issuer `tmr-api` and audience `tmr-client`
  - `backend/src/utils/security-monitor.ts` alert `source: 'tmr-api'`
- Frontend environment example branding:
  - `frontend/.env.example`: `VITE_APP_NAME=TMR`, `VITE_APP_DESCRIPTION=TMR Billing System`
- Documentation wording updated from “bill-gen application” to “tmr application” where applicable.

### Notes
- No production routes were removed or renamed.
- No database schema changes; compatible with existing MongoDB data.
- External domains like `bill-gen-production.up.railway.app` remain unchanged to avoid breaking environments.
## [x.x.x] - 2025-11-11 - 🔧 Brand cleanup: remove remaining bill-gen references

Scope: Safe, non-breaking branding updates; no production routes or database schemas changed.

- Updated fallback CORS origin to `https://tmr-production.up.railway.app` in:
  - `backend/src/server.ts` (`defaultAllowedOrigins`)
  - `backend/src/auth/auth.controller.ts` (`defaultAllowedOrigins`)
  - `backend/railway.toml` (`CORS_ORIGINS` env)
- Replaced Cloudflare Pages domain `bill-gen-saas.pages.dev` with `tmr-tradinglanka.pages.dev` in `backend/Dockerfile` (CORS header and sample `.env`).
- Removed `billgen.com` placeholders:
- `backend/src/routes/gdprRoutes.ts`: secure viewer URL updated to `tmr-tradinglanka.pages.dev/secure-viewer` and contact email set to `privacy@gunawardanamotors.lk`; pseudonymized deletion email set to non-deliverable `deleted.tmr.invalid`.
  - `backend/.env.example`: `ADMIN_EMAIL` set to `admin@gunawardanamotors.lk`.
- Documentation updates:
  - `README.md`, `frontend/README.md`, `docs/api/README.md`: production API URL updated to `https://tmr-production.up.railway.app`.

Notes:
- Existing data in MongoDB remains compatible; no schema changes.
- Did not modify any production routes or add new dependencies.
- Left historical references in previous changelog entries intact for auditability.
