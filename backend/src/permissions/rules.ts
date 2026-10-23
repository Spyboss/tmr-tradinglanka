import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import type { AppAbility, PermissionUser } from './types.js';

/**
 * THE permission matrix. Edit rules here and nowhere else.
 *
 * Model: ABAC — rules combine role (subject attribute) with resource
 * attributes (owner, addedBy, userId, status). Documents in Mongo carry the
 * attributes; rules.ts carries the policy; query.ts compiles rules into
 * Mongo filters at read time.
 *
 * Encodes docs/product/roles-permissions.md. The matrix contract test fails
 * if this file and the documented matrix drift apart.
 *
 * Field conventions (from the models):
 *   Bill/Quotation/WarrantyClaim -> owner
 *   BikeInventory                -> addedBy
 *   Branding                     -> userId (null = global/system-wide)
 *   UserActivity                 -> userId
 *   User                         -> _id
 *
 * Invariants:
 *   - no user  -> zero rules (deny by default)
 *   - admin    -> can('manage','all') so NEW subjects are admin-covered
 *                 automatically; non-admins must be granted explicitly
 *   - `cannot` beats `can` when it comes later (CASL rule ordering), used
 *     below to carve own-only exceptions out of the admin wildcard
 */
export function defineAbilitiesFor(
  user: PermissionUser | null | undefined
): AppAbility {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  if (!user?.id) {
    // anonymous: authenticate middleware owns this case; grant nothing
    return build() as AppAbility;
  }

  const uid = user.id;
  const isAdmin = user.role === 'admin';

  if (isAdmin) {
    can('manage', 'all');
    // carve-outs from the wildcard: purging activity is own-data-only for
    // EVERY role (retention minimum lives in the service layer)
    cannot('purge', 'UserActivity');
  }

  // --- every authenticated user ------------------------------------------
  can('read', 'Report'); // user rows are scoped inside reportService (aggregate exception)
  can('export', 'Gdpr'); // gdprRoutes always self-scopes to req.user.id
  can('delete', 'Gdpr'); // account deletion = self only, both roles
  can('read', 'UserActivity', { userId: uid });
  can('purge', 'UserActivity', { userId: uid });

  // --- regular-user grants (admins already covered by manage-all) --------
  if (!isAdmin) {
    // own profile / preferences / password
    can(['read', 'update'], 'User', { _id: uid });

    // bills: own records; delete limited to cancelled bills (the
    // pending/completed/converted state machine itself stays in billService)
    can('create', 'Bill');
    can(['read', 'update'], 'Bill', { owner: uid });
    can('delete', 'Bill', { owner: uid, status: 'cancelled' });

    // quotations: own records (convert-to-invoice is an update)
    can('create', 'Quotation');
    can(['read', 'update', 'delete'], 'Quotation', { owner: uid });

    // warranty claims: own records
    can('create', 'WarrantyClaim');
    can(['read', 'update', 'delete'], 'WarrantyClaim', { owner: uid });

    // inventory: create any entry, read/update own entries; delete = admin only
    can('create', 'Inventory');
    can(['read', 'update'], 'Inventory', { addedBy: uid });

    // branding: personal branding only (userId = self); global = admin
    can('manage', 'Branding', { userId: uid });

    // reference data: read-only
    can('read', 'BikeModel');
    can('read', 'FinanceCompany');
  }

  return build() as AppAbility;
}
