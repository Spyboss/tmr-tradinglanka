import { ForbiddenError } from '@casl/ability';
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../auth/auth.middleware.js';
import type { Action } from './actions.js';
import type { Subject } from './subjects.js';
import { resolveAbility } from './resolve.js';

/**
 * Route-level authorization: drop-in replacement for requireAdmin, driven by
 * the single source of truth (permissions/rules.ts) instead of a hard-coded
 * role comparison.
 *
 *   router.post('/', authenticate, requirePermission('manage', 'BikeModel'), handler)
 *
 * Use for TYPE-level gates (does this role ever get this action?). Row-level
 * scoping belongs in the service layer (readableWhere / assertCan).
 * Responds 401 when unauthenticated, 403 (via errorHandler) when denied.
 */
export function requirePermission(action: Action, subject: Subject) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      const ability = await resolveAbility(req);
      if (!ability.can(action, subject)) {
        const error = ForbiddenError.from(ability);
        error.action = action;
        error.subject = subject;
        (error as unknown as { statusCode: number }).statusCode = 403;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
