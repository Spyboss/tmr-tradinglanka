# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Customer phone field (`customerPhone`) to bill creation form — always visible, required for advance payments, optional with format validation (`07XXXXXXXX`) for cash/leasing.
- Customer phone column in bill list table for at-a-glance contact data.
- Customer phone auto-prefill in quotation/invoice forms when selecting a bill customer reference.
- Customer phone included in customer suggestion API responses for quotation forms.
- Customer phone auto-populated from reference bill during quotation creation on the backend.
- Proforma invoice modal already prefills customer contact from bill's phone number.
- Comprehensive documentation updates for customer phone across data model, API reference, and workflows.
### Changed
- Quotation/invoice `remarks` default changed from the payment term to empty — the term "Payment should be made within 7 days of invoice date." is now set only when creating an invoice (either directly or via convert-to-invoice), keeping quotations free of time-pressure language.
- Standardized bill UI payloads to camelCase to match backend schema; removed snake_case fallbacks in frontend forms, generators, lists, and views.
- Added backend contract test for `PUT /api/bills/:id` to enforce camelCase update payloads.
- Bill delete now runs in MongoDB transaction and releases linked inventory back to available status.
- Non-admin users can only delete bills with `status: cancelled`.
- Bill update/delete now records detailed audit logs with old/new values, inventory changes, IP address, and user agent.

## [2.0.0] - 2024-11-01
### Added
- Bill management module with PDF exports and encrypted customer fields.
- Inventory management APIs with analytics, summary endpoints, and PDF reporting.
- Quotation and invoice module including conversion workflow and customer suggestions.
- Branding configuration service driving SPA chrome and document headers.
- User preferences, activity logging, and GDPR export/delete flows.
- Email verification feature flag with optional enforcement middleware.

### Changed
- Authentication flow now uses Redis-backed refresh tokens with secure cookie settings.
- Security middleware enforces CORS allowlist, request sanitisation, and rate limiting for sensitive routes.
- Frontend rebuilt with Vite, Ant Design, and Tailwind for faster builds and modern UX.

### Fixed
- Resolved duplicate bill number edge cases by validating uniqueness before persistence.
- Hardened PDF services to support dynamic branding assets and prevent missing-font errors.

