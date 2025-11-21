# API Reference

All endpoints are prefixed with `/api`. JSON responses follow a consistent shape with `error` or data payloads. Authentication uses Bearer access tokens with HTTP-only refresh cookies.

> **Auth requirements**
> - `Public` – no authentication.
> - `Authenticated` – requires valid access token.
> - `Admin` – authenticated and `User.role === 'admin'`.

## Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create a user account. Rate limited. |
| POST | `/api/auth/login` | Public | Issue access token + refresh cookie. Rate limited. |
| POST | `/api/auth/refresh` | Refresh cookie | Rotate access token using refresh cookie. |
| POST | `/api/auth/logout` | Refresh cookie | Revoke refresh token and clear cookie. |
| GET | `/api/auth/me` | Authenticated | Return current user profile. Verification enforced if enabled. |
| PUT | `/api/auth/profile` | Authenticated | Update name, address, phone. |
| PUT | `/api/auth/password` | Authenticated | Change password with current password check. |
| POST | `/api/auth/create-admin` | Public | Bootstraps an admin by presenting `ADMIN_SETUP_KEY`. |
| POST | `/api/auth/verify/request` | Public | Request verification email when feature flag enabled. |
| POST | `/api/auth/verify/confirm` | Public | Confirm verification token. |
| GET | `/api/auth/verify/status` | Authenticated | Return verification status payload. |

**Login Response Example**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "user": {
    "id": "65f5...",
    "email": "sales@tmr.lk",
    "role": "user",
    "name": "Sales Executive"
  }
}
```

## Bills

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/bills` | Authenticated | Paginated list. Non-admins filtered by `owner`. Supports `status`, `search`, `page`, `limit`. |
| GET | `/api/bills/:id` | Authenticated | Fetch a bill by ID. Ownership enforced. |
| POST | `/api/bills` | Authenticated | Create bill. Auto-generates bill number, encrypts NIC/address, links inventory when provided. |
| PUT | `/api/bills/:id` | Authenticated | Update bill fields. Prevents owner reassignment. |
| DELETE | `/api/bills/:id` | Authenticated | Delete bill. Admin bypass. |
| GET | `/api/bills/:id/pdf` | Authenticated | Download branded PDF of bill. |
| GET | `/api/bills/preview` | Authenticated | Download sample PDF using mock data. |
| POST | `/api/bills/preview` | Authenticated | Render PDF using request body bill payload. |

> Contract note
> Bill JSON uses camelCase keys (e.g., `bikeModel`, `bikePrice`, `billType`, `totalAmount`). Legacy snake_case keys are not accepted for updates.

**Bill Payload Snippet**

```json
{
  "customerName": "Imesh Perera",
  "customerNIC": "123456789V",
  "customerAddress": "45 Lake Road, Embilipitiya",
  "bikeModel": "E-MOTORCYCLE X1",
  "motorNumber": "MTR123456",
  "chassisNumber": "CHS987654",
  "billType": "cash",
  "rmvCharge": 13000,
  "totalAmount": 450000,
  "isAdvancePayment": true,
  "advanceAmount": 100000,
  "balanceAmount": 350000
}
```

## Inventory

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/inventory` | Authenticated | Paginated listing with filters (`status`, `modelId`, `search`, sorting). Non-admins see their own entries. |
| GET | `/api/inventory/:id` | Authenticated | Retrieve inventory record with populated model + user info. |
| POST | `/api/inventory` | Authenticated | Add a single bike. Validates bike model existence and uniqueness of motor/chassis numbers. |
| POST | `/api/inventory/batch` | Authenticated | Bulk insert array of bikes. |
| PUT | `/api/inventory/:id` | Authenticated | Update status, notes, model reference, etc. |
| DELETE | `/api/inventory/:id` | Admin | Soft-delete inventory entry (feature-flagged). Allowed for all statuses, including `sold`. CSRF-protected in production via Origin/Referer allowlist. Optional `{ reason }` body for audit. |
| GET | `/api/inventory/summary` | Authenticated | Aggregated counts by model and status. |
| GET | `/api/inventory/analytics` | Authenticated | Extended statistics for dashboards (turnover, stock ageing). |
| GET | `/api/inventory/available/:modelId` | Authenticated | Return available bikes for a model. |
| GET | `/api/inventory/report/pdf` | Authenticated | Download inventory report PDF. |

## Quotations & Invoices

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/quotations` | Authenticated | Paginated listing filtered by owner. Supports `status`, `type`, `search`. |
| GET | `/api/quotations/:id` | Authenticated | Fetch quotation. Ownership enforced. |
| POST | `/api/quotations` | Authenticated | Create quotation. Auto-populates customer info when `referenceBillId` provided. |
| PUT | `/api/quotations/:id` | Authenticated | Update quotation fields. |
| DELETE | `/api/quotations/:id` | Authenticated | Remove quotation. |
| GET | `/api/quotations/:id/pdf` | Authenticated | Download quotation/invoice PDF. |
| POST | `/api/quotations/:id/convert-to-invoice` | Authenticated | Clone quotation into an invoice record and mark original as converted. |
| GET | `/api/quotations/customers/suggestions` | Authenticated | Suggest customers from bills for auto-fill. |

## Bike Models & Branding

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/bike-models` | Public | List models with price and leasing flags. |
| GET | `/api/bike-models/:id` | Public | Fetch single model. |
| POST | `/api/bike-models` | Admin | Create model. |
| PUT | `/api/bike-models/:id` | Admin | Update model details. |
| DELETE | `/api/bike-models/:id` | Admin | Delete model. |
| GET | `/api/branding` | Authenticated | Retrieve dealer branding config (auto-creates default document). |
| PUT | `/api/branding` | Admin | Update branding (dealer name, addresses, colour, logo, footer). |

## User Preferences & Activity

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/user/preferences` | Authenticated | Fetch preference document or defaults. |
| PUT | `/api/user/preferences` | Authenticated | Update preference fields. Validates enums/ranges. |
| DELETE | `/api/user/preferences` | Authenticated | Reset preferences to defaults. |
| GET | `/api/user/activity` | Authenticated | Paginated activity feed with filters (`type`, `startDate`, `endDate`). |
| GET | `/api/user/activity/stats` | Authenticated | Aggregate stats for dashboards. |
| DELETE | `/api/user/activity` | Authenticated | Purge older activity beyond retention threshold. |

## GDPR & Compliance

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/gdpr/export` | Authenticated | Stream encrypted ZIP with user profile + bills. Includes separate key file. |
| POST | `/api/gdpr/delete` | Authenticated | Pseudonymise account after password confirmation, revoke tokens, delete bills. |

## Health & System Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Liveness probe returning MongoDB and Redis status. |
| GET | `/api/health/metrics` | Authenticated (optional) | Prometheus-style metrics when enabled. |

## Error Handling

Errors return structured payloads:

```json
{
  "message": "Invalid password",
  "details": "Password confirmation is required"
}
```

Validation middleware surfaces detailed reasons with 400 responses. Rate limiting returns `429` with `Retry-After` headers.

## Pagination Pattern

List endpoints respond with:

```json
{
  "items": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "pages": 5,
    "total": 84
  }
}
```

Bills and quotations use `bills`/`quotations` keys respectively to preserve backwards compatibility.

Refer to the frontend services in `frontend/src/services` for request examples and error handling patterns.
