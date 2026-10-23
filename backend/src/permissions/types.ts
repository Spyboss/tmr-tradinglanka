import type { MongoAbility } from '@casl/ability';
import type { Action } from './actions.js';
import type { Subject } from './subjects.js';

/** The CASL ability tuple for this app: every check is (Action, Subject). */
export type AppAbility = MongoAbility<[Action, Subject]>;

/**
 * The minimum user shape the permission system needs.
 * Deliberately dependency-free (no mongoose) so the exact same rules run in
 * the browser. Backend services pass `{ id, role }` loaded from Mongo.
 */
export interface PermissionUser {
  id: string;
  role?: string;
}
