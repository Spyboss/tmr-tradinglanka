/**
 * Actions — the verbs of the permission system.
 *
 * - create/read/update/delete: standard CRUD
 * - manage: admin wildcard (implies every CRUD action on a subject)
 * - export/purge: domain-specific verbs (GDPR export, activity purge)
 */
export const Actions = [
  'create',
  'read',
  'update',
  'delete',
  'manage',
  'export',
  'purge',
] as const;

export type Action = (typeof Actions)[number];
