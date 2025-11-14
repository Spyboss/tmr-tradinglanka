# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Comprehensive documentation overhaul covering business context, architecture, setup, operations, and roadmap.
- Sample `.env.example` files for backend and frontend workspaces.

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

