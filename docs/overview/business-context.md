# Business Context & Product Positioning

The TMR Trading Lanka Business Management System is an internal ERP tailored for a Sri Lankan motorcycle dealership group. It centralises the day-to-day operations that used to live in spreadsheets, paper notebooks, and ad-hoc messaging threads.

## Dealership Problems Solved

- **Sales fulfilment visibility** – Sales executives track cash, leasing, and advance-payment deals in one ledger, complete with balance reminders and PDF invoices.
- **Inventory control** – Warehouse teams receive chassis and motor numbers once a shipment lands, mark status changes (available, reserved, sold, damaged), and prevent double-selling.
- **Quotation turnaround** – Insurance and service desks create multi-line quotations with accident metadata, convert them into invoices, and share branded PDFs with partners.
- **Brand integrity** – Management pushes a single source of truth for dealer name, addresses, and brand colours that appear consistently across invoices, inventory reports, and the SPA shell.
- **Compliance posture** – Customer identities (NIC, address, phone) are encrypted at rest. Audit trails capture significant user actions to defend against disputes and support regulatory audits.

## Personas & Responsibilities

| Persona | Responsibilities | Platform Touchpoints |
| --- | --- | --- |
| **Dealer Principal** | Monitors daily sales, high-value inventory, and outstanding balances. | Dashboard, reports, inventory analytics. |
| **Sales Executive** | Creates bills, updates payment milestones, and issues customer PDFs. | Bill list, bill form, PDF preview/download. |
| **Inventory Coordinator** | Registers incoming bikes, links them to bills, resolves duplicates. | Inventory table, analytics, batch import. |
| **Insurance Liaison** | Produces quotations and invoices for claims, tracks conversion. | Quotation list, quotation editor, PDF export. |
| **Operations Admin** | Maintains user accounts, branding assets, and system settings. | Admin area, branding settings, user preferences. |

## Modules in Production Use

1. **Authentication & Access Control** – Email+password login with JWT access tokens and refresh tokens stored as HTTP-only cookies. Admins can bootstrap via a setup key controlled by operations.
2. **Billing** – End-to-end bill lifecycle, customer data encryption, PDF export, and RMV/advance-payment tracking.
3. **Inventory** – Bike model catalogue, single-unit inventory items with status tracking, analytics endpoints, and PDF reporting.
4. **Quotations & Invoices** – Multi-line quotations, conversion to invoices, linkage to existing bills, and PDF generation.
5. **Branding** – Single-document store that drives logos, colours, and address lines across documents and SPA chrome.
6. **User Preferences & Activity** – Personalised UI preferences and structured activity logs for major actions.
7. **GDPR Tools** – Self-service export (encrypted ZIP) and pseudonymising delete flow guarded by password re-entry.

## Current Operating Environment

- **Frontend** – React + Vite SPA hosted on Cloudflare Pages behind Zero Trust for preview environments.
- **Backend** – Node.js (Express + TypeScript) API on Railway with autoscaling containers and Redis-backed rate limiting.
- **Data Stores** – MongoDB Atlas (application data) and Redis Cloud (sessions, rate limits, verification tokens).
- **File Outputs** – PDFKit renders bills, quotations, and inventory reports; assets are consumed directly by clients.

## Business Metrics Tracked

- Bill counts and values by status.
- Inventory turnover by model, including availability vs. sold/held.
- Quotation pipeline state (draft/sent/accepted/converted).
- User activity heatmaps to see where process slowdowns occur.

## Alignment With Future Strategy

TMR Trading Lanka plans to open satellite showrooms. The current deployment already separates dealer branding from logic, making white-labelling and multi-tenant expansions feasible without rewriting the core modules. A dedicated multi-dealership rollout is captured in the [future expansion plan](../product/future-expansion.md).
