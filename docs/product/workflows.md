# UX Workflows & Text-Based Diagrams

This guide explains how dealership staff move through the system. Each flow is optimised for low training overhead and predictable data capture.

## Bill Creation Flow

```
Sales Executive
    │
    │ 1. Navigate to Bills → "Create Bill"
    ▼
Bill Form (frontend/src/pages/BillForm.jsx)
    │  - Select bike model (auto-fetch price)
    │  - Enter customer NIC/address (encrypted on submit)
    │  - Choose payment type (cash/leasing/advance)
    ▼
POST /api/bills (authenticate → createBill controller)
    │  - Validates unique bill number
    │  - Encrypts sensitive fields
    │  - Links inventory item when provided
    ▼
MongoDB Bill document persisted
    │
    │ 4. Bill list refreshes with new entry
    ▼
PDF button → GET /api/bills/:id/pdf (download invoice)
```

## Inventory Intake Flow

```
Inventory Coordinator
    │
    │ 1. Inventory → "Add Bike" or Batch Upload
    ▼
Inventory Form (frontend/src/pages/Inventory/AddInventory.jsx)
    │  - Select bike model
    │  - Enter motor & chassis numbers
    │  - Set status (available/reserved)
    ▼
POST /api/inventory
    │  - Validates duplicates
    │  - Stamps addedBy (current user)
    │  - Creates initial status record
    ▼
BikeInventory document stored
    │
    │ 4. Analytics widget updates counts per model
    ▼
Optional: Link to bill when sale completes (update inventory item)
```

## Quotation to Invoice Flow

```
Insurance Liaison
    │
    │ 1. Quotation List → "New Quotation"
    ▼
Quotation Editor (frontend/src/pages/QuotationEdit.jsx)
    │  - Pre-fill customer using suggestion API
    │  - Add line items with quantity/rate
    │  - Capture claim metadata if needed
    ▼
POST /api/quotations
    │  - Auto-generates quotation number
    │  - Encrypts customer NIC/address/phone
    ▼
Quotation stored with status=draft
    │
    │ 4. Send PDF to insurer via GET /api/quotations/:id/pdf
    ▼
Upon approval → "Convert to Invoice"
    │
POST /api/quotations/:id/convert-to-invoice
    │  - Clones record with type=invoice, status=sent
    │  - Marks original quotation as converted
    ▼
Invoice ready for billing reconciliation
```

## Branding Update Flow

```
Operations Admin
    │
    │ 1. Admin → Branding Tab
    ▼
Branding Form (frontend/src/pages/Admin/Branding.jsx)
    │  - Dealer name, address lines, logo URL, primary colour
    ▼
PUT /api/branding (requireAdmin)
    │  - Upserts singleton document
    ▼
Branding document persisted
    │
    │ 4. Frontend context refreshes → header + PDFs adopt new branding
    ▼
No restart required (fetched on demand)
```

## Verification Reminder Flow (Flagged)

```
User logs in with unverified email
    │
GET /api/auth/me → enforceVerification middleware
    │
Response contains `requiresVerification: true`
    │
Frontend displays banner with "Resend Email" action
    │
POST /api/auth/verify/request (rate limited)
    │
Email sent via Resend or console logger
```

These flows provide a shared vocabulary during support calls and training sessions. For deeper business context see [Business Context](../overview/business-context.md).
