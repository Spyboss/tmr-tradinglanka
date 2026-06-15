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

## Proforma Invoice Flow (with Finance Company Selection)

```
Sales Executive
    │
    │ 1. Navigate to a completed leasing bill → "Generate Proforma Invoice"
    ▼
Proforma Modal (frontend/src/pages/BillView.jsx)
    │  - Fetches existing proforma defaults (type, document number, issue date)
    │  - Finance Company field: searchable <Select> dropdown
    │    - Type "hnb" or "sarv" to filter; press Enter to select
    │    - Selecting a company auto-fills address and contact
    │  - Address/contact can still be edited manually after auto-fill
    │  - Enter unit price, down payment; amount to be leased auto-calculates
    ▼
PUT /api/bills/:id/proforma (authenticate)
    │  - Validates all required fields including finance company name, address, contact
    │  - Saves proforma sub-document on the bill
    ▼
GET /api/bills/:id/proforma/pdf (authenticate)
    │  - Generates branded PDF with dealer logo and finance company details
    │  - Renders finance company name, address, and contact in the signature area
    ▼
PDF downloaded as proforma-<billNumber>.pdf
```

The finance company master list is maintained in the `FinanceCompany` collection. The dropdown always reflects the current list sorted alphabetically.

## Finance Company Admin Management Flow

```
Operations Admin
    │
    │ 1. Dashboard → Settings card → "Finance Companies"
    ▼
Finance Company List (`/admin/finance-companies`)
    │  - Table with all companies sorted alphabetically by name
    │  - Columns: Name, Address, Contact, Actions
    │  - Actions: Edit (pencil icon) / Delete (trash icon with confirmation)
    │
    ├─── "Add Company" button
    │    ▼
    │    Modal form: Name, Address, Contact
    │    POST /api/finance-companies (admin-only)
    │    - Validates required fields
    │    - Returns 409 if company name already exists
    │    ▼
    │    Table refreshes with new entry
    │
    ├─── Edit icon → opens same modal pre-filled
    │    ▼
    │    PUT /api/finance-companies/:id (admin-only)
    │    - Updates name, address, contact
    │    - Duplicate name check on save
    │    ▼
    │    Table refreshes with updated values
    │
    └─── Delete icon → Popconfirm "Delete this finance company?"
         ▼
         DELETE /api/finance-companies/:id (admin-only)
         - Removes company from master list
         ▼
         Table refreshes without deleted entry
```

Changes are immediately reflected the next time any user opens a proforma invoice modal (the finance company dropdown fetches from `GET /api/finance-companies` on open).

## Finance Company Sales Report Flow

```
Dealer Principal / Sales Executive
    │
    │ 1. Dashboard → Reports card → "Finance Company Sales"
    ▼
Finance Company Sales Page (`/reports/finance-company-sales`)
    │  - Select a finance company from searchable dropdown (fetched from master list)
    │  - Optional: pick a date range to narrow the period
    │  - Optional: server-side search by bill number, customer, chassis, or motor
    │  - Click "Load Report"
    ▼
GET /api/reports/finance-company-sales (authenticate)
    │  - Queries bills with proforma.financeCompanyName matching selected company
    │  - Ownership-filtered: non-admins see only their own bills
    │  - Paginated results (50 per page, up to 200 max)
    │  - Server-side search across bill number, customer name, chassis, motor
    ▼
Results table displayed with columns:
    │  Bill No | Date | Customer | Chassis No | Motor No | Model | Amount | Proforma | Finance Co.
    │
    │  Summary bar shows:
    │  - Total Sales (count)
    │  - Total Amount (sum)
    │  - With Proforma (count of bills having a finance company assigned)
    │
    ├─── Client-side search input to filter within loaded results
    │    ▼
    │    Real-time filtering by any column without server round-trip
    │
    └─── "Download PDF" button
         ▼
GET /api/reports/finance-company-sales/pdf
         │  - Generates landscape A4 PDF with:
         │    - Dealer logo and name (top-left, falls back to centered text)
         │    - Report title: "Finance Company Sales Report — {company}"
         │    - Period subtitle if date range specified
         │    - Summary bar: Total Sales | Total Amount | With Proforma
         │    - Table with dynamic row heights (auto-expands for wrapped text)
         │    - Alternating row backgrounds for readability
         │    - Total row at bottom
         │    - Footer: "Software solution by UHADEV" with generation timestamp
         ▼
PDF downloaded as finance-company-sales-{company}.pdf
```

The report is useful for monthly reconciliation with leasing/finance partners, generating a single PDF with all sales attributed to a specific company for a given period.

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
    │  - Add parts/items (individual rows for item, part number, description, remark)
    │  - Add warranty parts: select type from dropdown (battery pack, motor,
    │    charger, controller, display, throttle, wiring, or "Other..." with
    │    custom label). Each part collects its own serial numbers via scan/type input
    │  - Fill office use section (comments, approved by, approval date,
    │    serial number, form number)
    │  - Form number input: real-time validation with debounced check
    │    against existing claims. Green checkmark = available, red warning = taken.
    │    Lightbulb button auto-fills the next sequential number from the book.
    ▼
POST /api/warranty-claims (authenticate → createWarrantyClaim)
    │  - Auto-generates warranty number (WAR-YYMMDD-XXX)
    │  - Returns 409 if formNumber is already taken (db-level partial unique index)
    │  - Pre-submit guard blocks duplicate form numbers client-side
    │  - Optionally links to a source bill via billId
    ▼
WarrantyClaim document persisted
    │
    │ 4. Detail view shows all claim data including form number in Office Use section
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
