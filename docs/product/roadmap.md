# Roadmap

The roadmap keeps stakeholders aligned on upcoming work. Dates are indicative; adjust based on dealership priorities.

## Q1 2025

- **Role segmentation** – Introduce dedicated roles (`sales`, `inventory`, `service`) with page-level permissions.
- **Frontend test harness** – Add Playwright smoke tests for login, bill creation, and PDF download.
- **Automated dependency scanning** – Integrate npm audit or Snyk into CI to catch supply-chain risks.

## Q2 2025

- **Multi-branch inventory views** – Add branch attribute to inventory items and filter analytics by location.
- **Offline bill draft support** – Cache unsaved bill forms in browser storage for field workers.
- **Email templates** – Customise quotation and invoice email bodies using branding metadata.

## Q3 2025

- **Multi-dealership tenancy** – Separate data per dealership, introduce dealership switcher UI, and central admin oversight. (Design outline in [Future Expansion](./future-expansion.md)).
- **Payment reconciliation** – Track settlements, outstanding balances, and integrate with leasing partner exports.
- **Security hardening** – Optional MFA for admins, strict suspicious-IP blocking, and security alert webhooks to Slack.

## Nice-to-Have Backlog

- Native mobile wrapper for sales floor usage.
- Inventory barcode/QR scanning for faster lookup.
- Auto-sync with accounting packages (QuickBooks, Xero) through nightly export.

## Recently Delivered

- Branding management UI with PDF integration.
- Email verification feature flag with enforcement middleware.
- GDPR self-service export/delete endpoints.
