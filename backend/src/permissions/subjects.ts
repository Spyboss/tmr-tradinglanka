/**
 * Subjects — the nouns permissions act on.
 *
 * SINGLE SOURCE OF TRUTH: backend/src/permissions is the only place that
 * defines who can do what. To add a permission:
 *   1. add the subject here (if new)
 *   2. add its rules in rules.ts
 *   3. extend the matrix contract test (__tests__/permissions-matrix.contract.test.ts)
 * Everything else (routes, services, frontend UI) only ASKS this module.
 */
export const Subjects = [
  'Bill',
  'Quotation',
  'WarrantyClaim',
  'Inventory',
  'Branding',
  'BikeModel',
  'FinanceCompany',
  'UserActivity',
  'User',
  'Gdpr',
  'Report',
] as const;

export type Subject = (typeof Subjects)[number];
