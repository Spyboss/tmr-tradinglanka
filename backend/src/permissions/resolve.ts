import type { Request } from 'express';
import User from '../models/User.js';
import { defineAbilitiesFor } from './rules.js';
import type { AppAbility } from './types.js';

const ABILITY = Symbol('tmr.ability');

interface AbilityRequest extends Request {
  [ABILITY]?: AppAbility;
}

/**
 * Build the caller's ability ONCE per request and cache it on the request
 * object. This replaces the repeated `User.findById` role loads that handlers
 * currently do (warrantyClaimController alone re-fetches the user 7x).
 *
 * - unauthenticated -> anonymous ability (zero rules, fail-closed)
 * - user not found  -> zero rules (soft-deleted accounts act as nobody)
 * - contract-test compatible: plain `User.findById(id)` (tests mock it
 *   without query chains); password is select:false in the schema.
 */
export async function resolveAbility(req: Request): Promise<AppAbility> {
  const cached = (req as AbilityRequest)[ABILITY];
  if (cached) return cached;

  const authReq = req as Request & {
    user?: { id?: string; role?: unknown };
  };
  const userId = authReq.user?.id;

  let ability: AppAbility = defineAbilitiesFor(null);
  if (userId) {
    const user = await User.findById(userId);
    if (user && authReq.user) {
      // keep legacy handlers working (they read req.user.role)
      authReq.user.role = user.role;
    }
    ability = defineAbilitiesFor(
      user ? { id: userId, role: String(user.role) } : null
    );
  }

  (req as AbilityRequest)[ABILITY] = ability;
  return ability;
}
