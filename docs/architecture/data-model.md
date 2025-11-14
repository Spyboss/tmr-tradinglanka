# Data Model & Textual ERD

The backend uses MongoDB with Mongoose schemas. Sensitive customer fields are AES-encrypted through a schema plugin. Below is the textual ERD covering primary collections and relationships.

## Collections Overview

```
User (users)
  _id (ObjectId)
  email (unique, indexed)
  password (bcrypt hash)
  role (user | admin | deleted)
  name / nic / address / phoneNumber
  refreshTokenHash
  loginAttempts / accountLocked
  timestamps

UserPreferences (userpreferences)
  _id (ObjectId)
  userId (ref User, unique)
  theme / language / timezone
  notifications { email, browser, billReminders, quotationUpdates, systemUpdates }
  dashboard { defaultView, itemsPerPage, showWelcomeMessage }
  privacy { profileVisibility, activityTracking, dataRetention }
  timestamps

UserActivity (useractivities)
  _id (ObjectId)
  userId (ref User)
  type (enum ActivityType)
  description
  metadata { resourceId, resourceType, oldValues, newValues, ipAddress, userAgent, location }
  timestamp (indexed)
  createdAt

BikeModel (bike_models)
  _id (ObjectId)
  name (text index)
  price
  is_ebicycle / is_tricycle / can_be_leased
  timestamps

BikeInventory (bike_inventory)
  _id (ObjectId)
  bikeModelId (ref BikeModel)
  motorNumber (unique)
  chassisNumber (unique)
  status (available | sold | reserved | damaged)
  dateAdded / dateSold
  billId (ref Bill, optional)
  notes
  addedBy (ref User)
  timestamps

Bill (bills)
  _id (ObjectId)
  billNumber (unique) / bill_number (legacy alias)
  billDate
  status (pending | completed | cancelled)
  customerName
  customerNIC (encrypted)
  customerAddress (encrypted)
  bikeModel (string snapshot)
  motorNumber / chassisNumber / vehicleType
  inventoryItemId (ref BikeInventory)
  billType (cash | leasing)
  rmvCharge
  downPayment
  isAdvancePayment / advanceAmount / balanceAmount / estimatedDeliveryDate
  isFirstTricycleSale
  totalAmount
  owner (ref User)
  timestamps

Quotation (quotations)
  _id (ObjectId)
  quotationNumber (unique)
  quotationDate
  type (quotation | invoice)
  status (draft | sent | accepted | rejected | converted)
  customerName
  customerNIC (encrypted)
  customerAddress (encrypted)
  customerPhone (encrypted)
  bikeRegNo
  referenceBillId (ref Bill)
  items[] { description, quantity, rate, amount }
  totalAmount
  remarks / validUntil
  accidentDate / claimNumber / insuranceCompany
  owner (ref User)
  timestamps

Branding (brandings)
  _id (ObjectId)
  dealerName
  logoUrl / primaryColor
  addressLine1 / addressLine2
  brandPartner / footerNote
  timestamps

EmailVerificationStatus (emailverificationstatuses)
  _id (ObjectId)
  userId (ref User)
  verified (boolean)
  verifiedAt
  method (string)
  timestamps
```

## Relationship Summary

- **User 1 — 1 UserPreferences**: enforced by unique index on `userId`.
- **User 1 — N UserActivity**: actions are timestamped for audit queries.
- **User 1 — N Bill**: `owner` ensures non-admins only see their data.
- **Bill 1 — 0..1 BikeInventory**: `inventoryItemId` links back to the physical bike if tracked.
- **BikeModel 1 — N BikeInventory**: inventory entries reference models for price/type metadata.
- **Bill 1 — 0..N Quotation**: `referenceBillId` allows quotations to clone customer details.
- **User 1 — N Quotation**: `owner` guards access similar to bills.
- **User 1 — 0..1 EmailVerificationStatus**: toggles verification enforcement.

## Indexing & Performance Notes

- `User.email`, `Bill.billNumber`, `Quotation.quotationNumber`, `BikeInventory.motorNumber`, and `BikeInventory.chassisNumber` are unique for fast lookups.
- Compound indexes on `UserActivity` (`userId`, `timestamp`) and `BikeInventory` (`bikeModelId`, `status`) support analytics queries.
- `Quotation` pre-save hooks recalculate item totals to guarantee consistency between stored data and PDF output.
- Encryption plugin decrypts marked fields automatically on `find`/`findOne`, so controllers can return plain values without manual handling.

## Data Retention & Purging

- Activity records can be truncated via `/api/user/activity` (respecting minimum retention). A TTL index is commented as a future switch.
- GDPR delete flow anonymises user records instead of dropping documents to preserve referential integrity on bills.

Refer to [Security Considerations](../operations/security.md) for key management and encryption notes.
