import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import User, { UserRole } from '../models/User.js';
import Bill from '../models/Bill.js';
import archiver from 'archiver';
import { AuthRequest } from '../auth/auth.middleware.js';
import { Response } from 'express';
import logger from '../utils/logger.js';
import { revokeTokens } from '../auth/jwt.strategy.js';
import crypto from 'crypto';
import { encryptWithPassword } from '../utils/export-encryption.js';

const router = Router();

/**
 * @route POST /api/gdpr/export
 * @desc Export all user data (GDPR compliance) with encryption
 * @access Private
 */
router.post('/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password confirmation is required for export' });
    }

    // Verify password before exporting sensitive data
    const userRecord = await User.findById(userId).select('+password');
    if (!userRecord) {
      return res.status(404).json({ message: 'User not found' });
    }
    const isPasswordValid = await userRecord.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Get user data excluding sensitive fields
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    delete user.password;
    delete user.refreshToken;

    // Get user's bills
    const bills = await Bill.find({ owner: userId }).lean();

    // Create a data object to export
    const exportData = {
      user,
      bills,
      exportDate: new Date(),
      exportRequestIP: req.ip
    };

    // Set up the ZIP file for download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=user-data-export-${Date.now()}.zip`);

    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    // Pipe the archive to the response
    archive.pipe(res);

    // Encrypt with the user's own password — key is never stored
    const exportDataString = JSON.stringify(exportData, null, 2);
    const { encrypted, salt, iv, authTag } = encryptWithPassword(exportDataString, password);

    // Ciphertext file
    archive.append(encrypted, { name: 'user-data.enc' });

    // Metadata needed for decryption (salt, IV, auth tag) — NOT the password
    const metadata = {
      algorithm: 'aes-256-gcm',
      kdf: 'pbkdf2',
      kdfIterations: 600000,
      kdfDigest: 'sha512',
      salt,
      iv,
      authTag
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    // Instructions — the user's login password is the decryption key
    const instructions = `# User Data Export (Encrypted)
Date of Export: ${new Date().toISOString()}

This export contains your personal data encrypted for security:
- Your account information
- Your bills and invoices

## How to Decrypt

This file was encrypted using your account password.
To decrypt, provide the following files to a decryption tool:
  - user-data.enc   (the encrypted data)
  - metadata.json   (encryption parameters: salt, IV, auth tag)

The decryption key is your TMR Trading Lanka account password.
No separate key file is needed — your password is the key.

## Security

- Your password was never stored alongside this export
- The encryption parameters (salt, IV) are safe to share
- Without your password, the data cannot be decrypted

This data is provided to comply with data portability requirements.
For questions, please contact privacy@gunawardanamotors.lk.
`;
    archive.append(instructions, { name: 'instructions.md' });

    // Log the export for audit purposes
    logger.info(`GDPR data export completed for user ${userId} from IP ${req.ip}`);

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    logger.error(`Error exporting user data: ${(error as Error).message}`);
    res.status(500).json({ message: 'Error exporting user data' });
  }
});

/**
 * @route POST /api/gdpr/delete
 * @desc Delete all user data (GDPR compliance)
 * @access Private
 */
router.post('/delete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Get user data for verification purposes
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Require password confirmation for account deletion
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password confirmation is required' });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    
    // Delete all bills created by the user
    await Bill.deleteMany({ owner: userId });
    
    // Mark user as deleted instead of actually deleting
    user.email = `deleted-${userId}@deleted.tmr.invalid`;
    user.name = 'Deleted User';
    user.role = UserRole.DELETED; // Set to deleted role
    user.refreshToken = undefined;
    
    // Revoke all tokens
    await revokeTokens(userId);
    
    // Pseudonymize personal data
    if (user.nic) user.nic = `DELETED-${crypto.randomBytes(8).toString('hex')}`;
    if (user.address) user.address = 'DELETED';
    if (user.phoneNumber) user.phoneNumber = 'DELETED';
    
    // Store account deletion time
    user.deletedAt = new Date();
    await user.save();
    
    // Clear authentication cookies
    res.clearCookie('refreshToken');
    
    // Log the deletion for audit purposes
    logger.info(`GDPR account deletion completed for user ${userId} from IP ${req.ip}`);
    
    // Send response
    res.status(200).json({ message: 'Account and all associated data have been deleted' });
  } catch (error) {
    logger.error(`Error deleting user data: ${(error as Error).message}`);
    res.status(500).json({ message: 'Error deleting user data' });
  }
});

export default router;