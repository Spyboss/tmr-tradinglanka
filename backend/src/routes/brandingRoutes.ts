import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../auth/auth.middleware.js';
import Branding from '../models/Branding.js';
import User, { UserRole } from '../models/User.js';

const router = express.Router();

// Get branding config
// Non-admins get their personal branding if it exists, otherwise the system default.
// Admins always see the system default (where userId is null).
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    const isAdmin = user?.role === UserRole.ADMIN;

    let branding;

    if (isAdmin) {
      // Admins only see/manage the system-wide branding
      branding = await Branding.findOne({ userId: null });
    } else {
      // Regular users: check for personal branding first
      branding = await Branding.findOne({ userId });
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
    const userId = req.user?.id;
    const user = await User.findById(userId);
    const isAdmin = user?.role === UserRole.ADMIN;

    const update = {
      dealerName: req.body.dealerName,
      logoUrl: req.body.logoUrl,
      primaryColor: req.body.primaryColor,
      addressLine1: req.body.addressLine1,
      addressLine2: req.body.addressLine2,
      brandPartner: req.body.brandPartner,
      footerNote: req.body.footerNote,
      // If admin, we target userId: null. If user, we target userId: req.user.id.
      userId: isAdmin ? null : userId
    };

    const filter = isAdmin ? { userId: null } : { userId };

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