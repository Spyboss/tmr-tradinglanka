import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  Subjects,
  asPlainResource,
  can,
  defineAbilitiesFor,
  readableWhere,
} from '../permissions/index.js';

/**
 * Contract test for the permission matrix (docs/product/roles-permissions.md).
 * If rules.ts changes behavior documented in the matrix, this fails.
 * Written against PLAIN resources (strings); ObjectId normalization is
 * covered separately at the bottom.
 */

const ADMIN = defineAbilitiesFor({ id: 'admin1', role: 'admin' });
const USER = defineAbilitiesFor({ id: 'u1', role: 'user' });
const ANON = defineAbilitiesFor(null);

const ownBill = { owner: 'u1', status: 'pending' };
const otherBill = { owner: 'u2', status: 'pending' };
const ownCancelledBill = { owner: 'u1', status: 'cancelled' };

describe('anonymous (no user)', () => {
  it('grants nothing on any subject', () => {
    for (const subject of Subjects) {
      expect(can(ANON, 'read', subject)).toBe(false);
    }
  });
});

describe('admin role', () => {
  it('manages every declared subject (manage-all covers new subjects too)', () => {
    for (const subject of Subjects) {
      expect(can(ADMIN, 'manage', subject)).toBe(true);
    }
  });

  it('cannot purge activity of others (own-only carve-out from wildcard)', () => {
    expect(can(ADMIN, 'purge', 'UserActivity', { userId: 'admin1' })).toBe(true);
    expect(can(ADMIN, 'purge', 'UserActivity', { userId: 'u2' })).toBe(false);
  });

  it('manages global branding (userId null)', () => {
    expect(can(ADMIN, 'manage', 'Branding', { userId: null })).toBe(true);
    expect(can(ADMIN, 'manage', 'Branding', { userId: 'u1' })).toBe(true);
  });

  it('deletes inventory entries and exports GDPR data', () => {
    expect(can(ADMIN, 'delete', 'Inventory')).toBe(true);
    expect(can(ADMIN, 'export', 'Gdpr')).toBe(true);
    expect(can(ADMIN, 'delete', 'Gdpr')).toBe(true);
  });
});

describe('user role — bills', () => {
  it('creates own bills, reads/updates only own', () => {
    expect(can(USER, 'create', 'Bill')).toBe(true);
    expect(can(USER, 'read', 'Bill', ownBill)).toBe(true);
    expect(can(USER, 'read', 'Bill', otherBill)).toBe(false);
    expect(can(USER, 'update', 'Bill', ownBill)).toBe(true);
    expect(can(USER, 'update', 'Bill', otherBill)).toBe(false);
  });

  it('deletes only own AND cancelled bills', () => {
    expect(can(USER, 'delete', 'Bill', ownCancelledBill)).toBe(true);
    expect(can(USER, 'delete', 'Bill', ownBill)).toBe(false);
    expect(can(USER, 'delete', 'Bill', { owner: 'u2', status: 'cancelled' })).toBe(
      false
    );
  });
});

describe('user role — quotations & warranty claims (own records only)', () => {
  it.each(['Quotation', 'WarrantyClaim'] as const)('%s', (subject) => {
    expect(can(USER, 'create', subject)).toBe(true);
    expect(can(USER, 'read', subject, { owner: 'u1' })).toBe(true);
    expect(can(USER, 'read', subject, { owner: 'u2' })).toBe(false);
    expect(can(USER, 'update', subject, { owner: 'u1' })).toBe(true);
    expect(can(USER, 'update', subject, { owner: 'u2' })).toBe(false);
    expect(can(USER, 'delete', subject, { owner: 'u1' })).toBe(true);
    expect(can(USER, 'delete', subject, { owner: 'u2' })).toBe(false);
  });
});

describe('user role — inventory (own entries; delete is admin-only)', () => {
  it('creates anything, reads/updates own entries only', () => {
    expect(can(USER, 'create', 'Inventory')).toBe(true);
    expect(can(USER, 'read', 'Inventory', { addedBy: 'u1' })).toBe(true);
    expect(can(USER, 'read', 'Inventory', { addedBy: 'u2' })).toBe(false);
    expect(can(USER, 'update', 'Inventory', { addedBy: 'u1' })).toBe(true);
    expect(can(USER, 'update', 'Inventory', { addedBy: 'u2' })).toBe(false);
  });

  it('cannot delete inventory at all', () => {
    expect(can(USER, 'delete', 'Inventory')).toBe(false);
    expect(can(USER, 'delete', 'Inventory', { addedBy: 'u1' })).toBe(false);
  });
});

describe('user role — branding (personal only)', () => {
  it('manages own branding, not the global one', () => {
    expect(can(USER, 'manage', 'Branding', { userId: 'u1' })).toBe(true);
    expect(can(USER, 'manage', 'Branding', { userId: null })).toBe(false);
  });
});

describe('user role — reference data & reports (read-only)', () => {
  it('reads bike models and finance companies, cannot mutate them', () => {
    expect(can(USER, 'read', 'BikeModel')).toBe(true);
    expect(can(USER, 'create', 'BikeModel')).toBe(false);
    expect(can(USER, 'update', 'BikeModel')).toBe(false);
    expect(can(USER, 'delete', 'BikeModel')).toBe(false);
    expect(can(USER, 'read', 'FinanceCompany')).toBe(true);
    expect(can(USER, 'create', 'FinanceCompany')).toBe(false);
    expect(can(USER, 'delete', 'FinanceCompany')).toBe(false);
  });

  it('reads reports (row scoping happens in reportService)', () => {
    expect(can(USER, 'read', 'Report')).toBe(true);
    expect(can(USER, 'create', 'Report')).toBe(false);
  });
});

describe('user role — self-service (own account, activity, GDPR)', () => {
  it('reads/updates own User doc only', () => {
    expect(can(USER, 'read', 'User', { _id: 'u1' })).toBe(true);
    expect(can(USER, 'read', 'User', { _id: 'u2' })).toBe(false);
    expect(can(USER, 'update', 'User', { _id: 'u1' })).toBe(true);
    expect(can(USER, 'update', 'User', { _id: 'u2' })).toBe(false);
    expect(can(USER, 'create', 'User')).toBe(false);
    expect(can(USER, 'delete', 'User', { _id: 'u2' })).toBe(false);
  });

  it('reads/purges own activity only', () => {
    expect(can(USER, 'read', 'UserActivity', { userId: 'u1' })).toBe(true);
    expect(can(USER, 'read', 'UserActivity', { userId: 'u2' })).toBe(false);
    expect(can(USER, 'purge', 'UserActivity', { userId: 'u1' })).toBe(true);
    expect(can(USER, 'purge', 'UserActivity', { userId: 'u2' })).toBe(false);
  });

  it('exports and deletes own GDPR data', () => {
    expect(can(USER, 'export', 'Gdpr')).toBe(true);
    expect(can(USER, 'delete', 'Gdpr')).toBe(true);
  });
});

describe('ObjectId normalization (mongoose interop)', () => {
  it('stringifies ObjectId attributes before matching rule conditions', () => {
    const id = new mongoose.Types.ObjectId();
    const ability = defineAbilitiesFor({ id: id.toString(), role: 'user' });

    expect(can(ability, 'read', 'Bill', { owner: id })).toBe(true);
    expect(can(ability, 'read', 'Bill', { owner: new mongoose.Types.ObjectId() })).toBe(
      false
    );
    expect(asPlainResource({ owner: id })).toEqual({ owner: id.toString() });
  });
});

describe('readableWhere (rules -> MongoDB filter)', () => {
  it('admin: unconditioned filter (no row restrictions)', () => {
    expect(readableWhere(ADMIN, 'Bill')).not.toBeNull();
  });

  it('user: filter restricted to own rows', () => {
    const where = readableWhere(USER, 'Bill');
    expect(where).not.toBeNull();
    expect(JSON.stringify(where)).toContain('u1');
  });

  it('anonymous: null (= no read permission at all)', () => {
    expect(readableWhere(ANON, 'Bill')).toBeNull();
  });
});
