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
| GET | `/api/bills/suggestions` | Authenticated | Search suggestions for customer names, bill numbers, and bike models. Query param `q` for search term. |
| GET | `/api/bills/:id` | Authenticated | Fetch a bill by ID. Ownership enforced. |
| POST | `/api/bills` | Authenticated | Create bill. Auto-generates bill number, encrypts NIC/address/phone, links inventory when provided. Phone required for advance payments, optional with format validation otherwise. |
| PUT | `/api/bills/:id` | Authenticated | Update bill fields including customerPhone. Handles inventory item changes transactionally - releases old inventory and claims new inventory when changed. Prevents owner reassignment. |
| DELETE | `/api/bills/:id` | Authenticated | Delete bill. Non-admins can only delete bills with `status: cancelled`. Runs in MongoDB transaction - releases linked inventory back to available status. Requires `res.locals.activityLogged = true` to prevent duplicate audit logging when route handles its own activity. |
| PATCH | `/api/bills/:id/status` | Authenticated | Update bill status. Handles inventory status changes - marks inventory as sold when completing, releases to available when cancelling. Ownership enforced. |
| POST | `/api/bills/:id/close-sale` | Authenticated | Convert an advance bill to a final sale. Creates a new completed bill with calculated amounts, marks original as converted, and updates linked inventory status to sold. Only for advance bills that haven't been converted yet. |
| GET | `/api/bills/:id/pdf` | Authenticated | Download branded PDF of bill. |
| GET | `/api/bills/:id/proforma` | Authenticated | Load bill-linked proforma payload (defaults + saved values). |
| PUT | `/api/bills/:id/proforma` | Authenticated | Save proforma details for a completed bill. |
| GET | `/api/bills/:id/proforma/pdf` | Authenticated | Download generated proforma invoice PDF for a completed bill. |
| GET | `/api/bills/preview` | Authenticated | Download sample PDF using mock data. |
| GET | `/api/bills/preview/pdf` | Authenticated | Render PDF using `formData` JSON query string payload. |
| POST | `/api/bills/preview` | Authenticated | Render PDF using request body bill payload. |

> Contract note
> Bill JSON uses camelCase keys (e.g., `bikeModel`, `bikePrice`, `billType`, `totalAmount`). Legacy snake_case keys are not accepted for updates.

**Bill Update Response**

When updating a bill that involves inventory changes, the response includes additional fields:

```json
{
  "previousInventoryReleased": true,
  "previousInventoryItemId": "...",
  "newInventoryClaimed": true,
  "newInventoryItemId": "..."
}
```

- `previousInventoryReleased`: Set to `true` if the previously linked inventory item was released back to available status.
- `newInventoryClaimed`: Set to `true` if a new inventory item was claimed (marked as sold for completed bills, or reserved for advance bills).
- Non-admins can only delete bills where `status === 'cancelled'`.

**Bill Payload Snippet**

```json
{
  "customerName": "Imesh Perera",
  "customerNIC": "123456789V",
  "customerAddress": "45 Lake Road, Embilipitiya",
  "customerPhone": "0771234567",
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

**Bill Preview Request Body**

`POST /api/bills/preview` accepts the same bill payload used when creating or updating a bill. Send JSON with camelCase keys matching the bill model fields (e.g., `customerName`, `customerNIC`, `bikeModel`, `billType`, `totalAmount`).

**Bill Preview Query Format**

`GET /api/bills/preview/pdf` expects a `formData` query string containing the JSON-encoded bill payload.

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
| GET | `/api/inventory/report/pdf` | Authenticated | Download inventory report PDF. Accepts `sortMode` query param (`date` or `model`). |
| GET | `/api/inventory/report/analytics` | Authenticated | Enhanced analytics for the inventory report dashboard. Returns monthly performance metrics, sales pace tracking, revenue series, sales by model per month, and 3-Month Stock Penalty Alerts including chassis numbers for aged stock. |

## Quotations & Invoices

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/quotations` | Authenticated | Paginated listing filtered by owner. Supports `status`, `type`, `search`. |
| GET | `/api/quotations/:id` | Authenticated | Fetch quotation. Ownership enforced. |
| POST | `/api/quotations` | Authenticated | Create quotation. Auto-populates customer info (name, NIC, address, phone) when `referenceBillId` provided. |
| PUT | `/api/quotations/:id` | Authenticated | Update quotation fields. |
| DELETE | `/api/quotations/:id` | Authenticated | Remove quotation. |
| GET | `/api/quotations/:id/pdf` | Authenticated | Download quotation/invoice PDF. |
| POST | `/api/quotations/:id/convert-to-invoice` | Authenticated | Clone quotation into an invoice record with payment term remark and mark original as converted. |
| GET | `/api/quotations/customers/suggestions` | Authenticated | Suggest customers from bills for auto-fill (includes name, NIC, address, phone). |

## Warranty Claims

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/warranty-claims` | Authenticated | Paginated list. Non-admins filtered by `owner`. Supports `status`, `search`, `page`, `limit`. |
| GET | `/api/warranty-claims/prefill` | Authenticated | Get prefill data from an existing bill. Query params: `billId` or `chassisNumber`. Returns customer/vehicle data and color from inventory notes. |
| GET | `/api/warranty-claims/search-bills` | Authenticated | Search bills for prefill. Query param `q` matches billNumber, customerName, chassisNumber, motorNumber. |
| GET | `/api/warranty-claims/:id` | Authenticated | Fetch a warranty claim by ID. Ownership enforced. |
| GET | `/api/warranty-claims/:id/pdf` | Authenticated | Download bilingual (EN/SI) warranty claim PDF with NotoSansSinhala font and dealer branding. |
| POST | `/api/warranty-claims` | Authenticated | Create a warranty claim. Auto-generates warranty number (`WAR-YYMMDD-XXX`). Ownership stamped from authenticated user. |
| PUT | `/api/warranty-claims/:id` | Authenticated | Update warranty claim fields. Prevents owner reassignment for non-admins. |
| DELETE | `/api/warranty-claims/:id` | Authenticated | Delete a warranty claim. Ownership enforced. |

**Prefill Response Snippet**

```json
{
  "prefill": {
    "customerName": "Imesh Perera",
    "customerPhone": "0771234567",
    "customerAddress": "45 Lake Road, Embilipitiya",
    "chassisNumber": "CHS987654",
    "motorNumber": "MTR123456",
    "bikeModel": "E-MOTORCYCLE X1",
    "color": "Red",
    "dateOfSale": "2025-01-15T00:00:00.000Z",
    "billId": "65f5..."
  }
}
```

**Warranty Claim Payload Snippet**

```json
{
  "customerName": "Imesh Perera",
  "customerPhone": "0771234567",
  "customerAddress": "45 Lake Road, Embilipitiya",
  "chassisNumber": "CHS987654",
  "motorNumber": "MTR123456",
  "bikeModel": "E-MOTORCYCLE X1",
  "color": "Red",
  "odometerReading": "1500",
  "dateOfSale": "2025-01-15T00:00:00.000Z",
  "dateOfComplaint": "2025-03-10T00:00:00.000Z",
  "dateOfRepair": "2025-03-12T00:00:00.000Z",
  "defectReported": "Battery not charging",
  "probableCause": "Faulty charger circuit",
  "actionTaken": "Replaced charger module",
  "suggestion": "Monitor battery health",
  "items": [
    { "item": "Charger", "partNumber": "CH-001", "description": "Battery charger module", "remark": "Replaced under warranty" }
  ],
  "officeComments": "Approved for replacement",
  "approvedBy": "Operations Manager",
  "approvalDate": "2025-03-12T00:00:00.000Z",
  "batterySerialNumbers": ["BSN001", "BSN002"],
  "billId": "65f5...",
  "status": "pending"
}
```

> The warranty number is auto-generated in the format `WAR-YYMMDD-XXX` (e.g., `WAR-250319-042`) using a pre-save Mongoose hook. The PDF is generated using PDFKit with NotoSansSinhala for Sinhala text, matching existing dealer branding and attribution.

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

## Finance Companies

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/finance-companies` | Authenticated | List all finance/leasing companies sorted alphabetically by name. Each entry includes `name`, `address`, and `contact`. |
| POST | `/api/finance-companies` | Admin | Create a finance company. Requires `name`, `address`, `contact`. Returns 409 if name already exists. |
| PUT | `/api/finance-companies/:id` | Admin | Update a finance company's `name`, `address`, `contact`. Validates required fields and unique name. |
| DELETE | `/api/finance-companies/:id` | Admin | Delete a finance company. Returns 404 if not found. |

Used by the proforma invoice form to populate a searchable dropdown with auto-fill of address and contact. Managed by admins via the finance company management page at `/admin/finance-companies`.

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
| GET | `/api/health/details` | Public (dev) / Authenticated (prod) | Detailed health with build info, environment, and system metrics. |
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
