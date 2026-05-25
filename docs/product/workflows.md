# UX Workflows & Text-Based Diagrams

This guide explains how dealership staff move through the system. Each flow is optimised for low training overhead and predictable data capture.

## Bill Creation Flow

```
Sales Executive
    │
    │ 1. Navigate to Bills → "Create Bill"
    ▼
Bill Form (frontend/src/components/BillGeneratorUnified.jsx)
    │  - Select bike model (auto-fetch price)
    │  - Enter customer NIC/address/phone (encrypted on submit)
    │  - Choose payment type (cash/leasing/advance)
    │  - Phone required for advance payments; optional with format validation for others
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

## Bill Edit Flow (with Inventory Changes)

```
Sales Executive
    │
    │ 1. Navigate to existing bill → Edit
    ▼
Bill Edit Form (frontend/src/pages/BillEdit.jsx)
    │  - Modify any bill fields including customer phone
    │  - Change linked inventory item (optional)
    ▼
PUT /api/bills/:id (authenticate)
    │  - Runs in MongoDB transaction
    │  - If inventory changed: releases old item to available, claims new item
    │  - Records detailed audit with old/new values
    ▼
Bill updated, inventory statuses adjusted
    │
    │ Response includes: previousInventoryReleased, newInventoryClaimed
    ▼
Bill list refreshes with updated entry
```

## Advance to Final Sale Flow

```
Sales Executive
    │
    │ 1. Navigate to an advance bill → "Convert to Sale"
    ▼
POST /api/bills/:id/close-sale (authenticate)
    │  - Validates bill is advance payment type
    │  - Creates new completed bill with calculated amounts
    │  - Marks original advance bill as converted
    │  - Updates linked inventory to sold status
    ▼
Two bill records persisted
    │
    │ Original advance bill status = "converted"
    │ New final bill status = "completed"
    ▼
Both PDFs available for download
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
    │  - Customer phone auto-filled when selecting a bill reference
    ▼
Quotation stored with status=draft
    │
    │ 4. Send PDF to insurer via GET /api/quotations/:id/pdf
    ▼
Upon approval → "Convert to Invoice"
    │
POST /api/quotations/:id/convert-to-invoice
    │  - Clones record with type=invoice, status=sent
    │  - Sets remarks to payment term ("Payment should be made within 7 days of invoice date.")
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

## Warranty Claim Flow

```
Service/Workshop Staff
    │
    │ 1. Warranty Claims → "New Warranty Claim"
    ▼
Warranty Claim Form (frontend/src/pages/WarrantyClaim/WarrantyClaimForm.jsx)
    │  - Option A: "Find from Bill" → search modal populates
    │    customer/vehicle fields from existing bill (customer name, phone,
    │    chassis, motor, model, color from inventory notes, date of sale)
    │  - Option B: Manually enter all fields
    │  - Enter defect details, probable cause, action taken, suggestion
    │  - Add parts/items (up to 4 rows in PDF)
    │  - Scan or type battery serial numbers (QR-ready)
    │  - Fill office use section (comments, approved by, approval date,
    │    serial number, form number)
    ▼
POST /api/warranty-claims (authenticate → createWarrantyClaim)
    │  - Auto-generates warranty number (WAR-YYMMDD-XXX)
    │  - Optionally links to a source bill via billId
    ▼
WarrantyClaim document persisted
    │
    │ 4. Detail view shows all claim data
    ▼
PDF button → GET /api/warranty-claims/:id/pdf
    │  - Generates bilingual (EN/SI) PDF using NotoSansSinhala font
    │  - Layout: header with dealer branding, 5-row customer/vehicle grid,
    │    4-row defect grid, parts table, office use section, signature lines
    │  - Includes UHADEV attribution footer
    ▼
PDF delivered with filename TMR_Warranty_<warrantyNumber>.pdf

## Warranty Claim Edit Flow

```
Service/Workshop Staff
    │
    │ 1. Navigate to an existing claim → "Edit" button
    ▼
Warranty Claim Form (frontend/src/pages/WarrantyClaim/WarrantyClaimForm.jsx)
    │  - Pre-filled with all existing claim data (loads via GET /:id)
    │  - "Find from Bill" button hidden in edit mode
    │  - Modify any fields: customer/vehicle data, defect details,
    │    parts/items, battery serial numbers, office use section
    │  - Status can be updated via dropdown (pending/completed/cancelled)
    ▼
PUT /api/warranty-claims/:id (authenticate → updateWarrantyClaim)
    │  - Only the owner or admin can update
    │  - Non-admins cannot reassign owner
    ▼
Claim updated, navigated to detail view
```

## Warranty Claim Status Change Flow

```
Service/Workshop Staff or Admin
    │
    │ 1. Navigate to claim detail view
    ▼
Warranty Claim View (frontend/src/pages/WarrantyClaim/WarrantyClaimView.jsx)
    │  - Status dropdown in action bar (pending / completed / cancelled)
    │  - "Set Pending" button appears when status is not pending
    ▼
PUT /api/warranty-claims/:id  { status: "completed" }
    │  - Same update endpoint, ownership enforced
    ▼
View refreshes with updated status tag
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
