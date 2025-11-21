# Roles & Permissions Matrix

Two primary roles exist today: **Admin** and **User**. Deleted accounts are pseudonymised records used for GDPR compliance and cannot authenticate.

## Summary Matrix

| Capability | Admin | User |
| --- | --- | --- |
| Login & refresh tokens | ✅ | ✅ |
| View own profile/preferences | ✅ | ✅ |
| Update profile/password | ✅ | ✅ |
| Manage branding | ✅ | ❌ |
| Manage bike models | ✅ (CRUD) | ❌ |
| Manage bills | ✅ (all) | ✅ (own records only) |
| Generate bill PDFs | ✅ | ✅ (own records only) |
| Manage inventory | ✅ (full access) | ✅ (entries created by user) |
| Delete inventory entries | ✅ (soft-delete, audited; allowed for sold items) | ❌ |
| Inventory analytics | ✅ | ✅ (filtered) |
| Manage quotations/invoices | ✅ (all) | ✅ (own records only) |
| Convert quotation to invoice | ✅ (all) | ✅ (own records only) |
| View user activity logs | ✅ (own & aggregated dashboards) | ✅ (own activity only) |
| Purge user activity | ✅ (own) | ✅ (own, respecting retention minimum) |
| GDPR export/delete | ✅ (self) | ✅ (self) |
| Admin bootstrap endpoint | ✅ (with setup key) | ❌ |

## Access Enforcement Mechanics

- **Route-level middleware** handles authentication and role checks:
  - `authenticate` ensures valid access token.
  - `requireAdmin` restricts admin-only actions.
  - Ownership checks in bill/inventory/quotation routes verify `owner` or `addedBy` matches the requesting user.
- **Operational safeguards**:
  - Inventory deletes are controlled by `INVENTORY_DELETE_ENABLED` (feature flag).
  - CSRF enforcement in production via Origin/Referer allowlist.
- **Frontend guards** (`frontend/src/components/ProtectedRoute.jsx`) hide admin-only routes from non-admin users but rely on backend enforcement.

## Planned Enhancements

- Introduce `sales`, `inventory`, and `service` sub-roles with granular permissions (see [Future Expansion](./future-expansion.md)).
- Add read-only auditor role for finance reviews.
