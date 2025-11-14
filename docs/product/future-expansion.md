# Future Expansion Plan

This document outlines architectural considerations for scaling the platform beyond a single dealership.

## Multi-Dealership Tenancy

### Goals

- Support multiple dealerships sharing the same codebase.
- Allow HQ admins to switch between dealerships while keeping data isolated.
- Maintain per-dealership branding, inventory, and billing sequences.

### Proposed Approach

1. **Add `dealershipId`** to key collections (Bill, Quotation, BikeInventory, Branding, User).
2. **Tenant-aware middleware** reads dealership from JWT claims or subdomain and scopes queries automatically.
3. **Branding** becomes per-dealership with fallback defaults.
4. **Admin console** provides dealership switcher and aggregated reporting.

### Data Migration Notes

- Backfill existing documents with a default dealership ID (`tmr-main`).
- Create compound indexes `(dealershipId, billNumber)` to maintain uniqueness per tenant.
- Update frontend contexts to include active dealership and propagate to API requests.

## Branch-Level Inventory

- Extend BikeInventory with `branch` metadata.
- Analytics endpoints incorporate branch filters and aggregated KPIs.
- Provide branch-level permissions (`inventory` role only sees assigned branch).

## Integrations

- **Accounting**: nightly export of invoices to CSV/JSON for QuickBooks integration.
- **SMS notifications**: integrate Twilio or local SMS gateway for payment reminders.
- **Leasing partners**: API endpoints for external partners to query bill status with scoped API keys.

## Reliability Enhancements

- Introduce background workers (BullMQ) running in dedicated Railway service for heavy PDF rendering and email delivery.
- Store generated PDFs in object storage (Cloudflare R2) with signed URLs instead of in-memory streaming for large batches.
- Implement blue/green deployments for backend to reduce downtime during upgrades.

## Compliance & Security Roadmap

- Add Data Processing Agreement templates and configurable retention windows per dealership.
- Enforce MFA for admins and optionally for sales teams when accessing sensitive reports.
- Provide downloadable audit trails filtered by dealership and timeframe.

Tracking progress and prioritisation occurs in the [Roadmap](./roadmap.md). Update both documents when scope changes.
