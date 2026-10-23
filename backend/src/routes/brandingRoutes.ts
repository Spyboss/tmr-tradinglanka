import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../auth/auth.middleware.js';
import Branding from '../models/Branding.js';
import { can, resolveAbility } from '../permissions/index.js';

const router = express.Router();

// Get branding config
// Non-admins get their personal branding if it exists, otherwise the system default.
// Admins always see the system default (where userId is null).
// `manage` on Branding is an UNCONDITIONED (admin) capability; the user
// rule is conditioned to { userId: self } — so the type-level check is
// exactly the old role check, sourced from the permissions matrix.
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ability = await resolveAbility(req);
    const managesSystemBranding = can(ability, 'manage', 'all');

    let branding;

    if (managesSystemBranding) {
      // Admins only see/manage the system-wide branding
      branding = await Branding.findOne({ userId: null });
    } else {
      // Regular users: check for personal branding first
      branding = await Branding.findOne({ userId: req.user?.id });
      // Fallback to system-wide branding if no personal branding exists
      if (!branding) {
        branding = await Branding.findOne({ userId: null });
      }
    }

    // If still no branding (e.g., initial setup), create a system default
    if (!branding) {
      branding = await Branding.create({ userId: null });
    }

    res.status(200).json(branding);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update branding config
// Non-admins update their personal branding (isolated by userId).
// Admins update the system-wide branding (where userId is null).
router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ability = await resolveAbility(req);
    const targetsSystem = can(ability, 'manage', 'all');
    const targetUserId = targetsSystem ? null : req.user?.id;

    // explicit gate from the same rules: system row = admin capability,
    // personal row = own { userId } condition
    if (!can(ability, 'manage', 'Branding', { userId: targetUserId ?? req.user?.id })) {
      res.status(403).json({ error: 'You do not have permission to update branding' });
      return;
    }

    const update = {
      dealerName: req.body.dealerName,
      logoUrl: req.body.logoUrl,
      primaryColor: req.body.primaryColor,
      addressLine1: req.body.addressLine1,
      addressLine2: req.body.addressLine2,
      brandPartner: req.body.brandPartner,
      footerNote: req.body.footerNote,
      // If admin, we target userId: null. If user, we target userId: req.user.id.
      userId: targetUserId
    };

    const filter = { userId: targetUserId };

    let branding = await Branding.findOneAndUpdate(
      filter,
      update,
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json(branding);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
