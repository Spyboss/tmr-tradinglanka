import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../server';
import Branding from '../models/Branding';
import User from '../models/User';
import * as jwtStrategy from '../auth/jwt.strategy.js';
import { generatePDF } from '../services/pdfService';

// Mock JWT verification
vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(),
  createToken: vi.fn(),
  createRefreshToken: vi.fn(),
  revokeTokens: vi.fn(),
  verifyRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn()
}));

describe('Branding Isolation Security Tests', () => {
  const adminId = '6566f1f2a1b2c3d4e5f6a7b0';
  const userId1 = '6566f1f2a1b2c3d4e5f6a7b1';
  const userId2 = '6566f1f2a1b2c3d4e5f6a7b2';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/branding', () => {
    it('returns system default for admin', async () => {
      vi.mocked(jwtStrategy.verifyToken).mockResolvedValue({ sub: adminId });
      vi.spyOn(User, 'findById').mockResolvedValue({ _id: adminId, role: 'admin' } as any);
      
      const systemBranding = { dealerName: 'System Default', userId: null };
      vi.spyOn(Branding, 'findOne').mockImplementation((filter: any) => {
        if (filter.userId === null) return Promise.resolve(systemBranding as any);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .get('/api/branding')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.dealerName).toBe('System Default');
    });

    it('returns personal branding for regular user if it exists', async () => {
      vi.mocked(jwtStrategy.verifyToken).mockResolvedValue({ sub: userId1 });
      vi.spyOn(User, 'findById').mockResolvedValue({ _id: userId1, role: 'user' } as any);
      
      const userBranding = { dealerName: 'User 1 Store', userId: userId1 };
      vi.spyOn(Branding, 'findOne').mockImplementation((filter: any) => {
        if (filter.userId === userId1) return Promise.resolve(userBranding as any);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .get('/api/branding')
        .set('Authorization', 'Bearer user-token');

      expect(res.status).toBe(200);
      expect(res.body.dealerName).toBe('User 1 Store');
    });

    it('falls back to system default for regular user if personal branding missing', async () => {
      vi.mocked(jwtStrategy.verifyToken).mockResolvedValue({ sub: userId2 });
      vi.spyOn(User, 'findById').mockResolvedValue({ _id: userId2, role: 'user' } as any);
      
      const systemBranding = { dealerName: 'System Default', userId: null };
      vi.spyOn(Branding, 'findOne').mockImplementation((filter: any) => {
        if (filter.userId === null) return Promise.resolve(systemBranding as any);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .get('/api/branding')
        .set('Authorization', 'Bearer user-token');

      expect(res.status).toBe(200);
      expect(res.body.dealerName).toBe('System Default');
    });
  });

  describe('PUT /api/branding', () => {
    it('updates system-wide branding when admin', async () => {
      vi.mocked(jwtStrategy.verifyToken).mockResolvedValue({ sub: adminId });
      vi.spyOn(User, 'findById').mockResolvedValue({ _id: adminId, role: 'admin' } as any);
      
      const updatePayload = { dealerName: 'Updated System' };
      const findOneAndUpdateSpy = vi.spyOn(Branding, 'findOneAndUpdate').mockResolvedValue({
        dealerName: 'Updated System',
        userId: null
      } as any);

      const res = await request(app)
        .put('/api/branding')
        .set('Authorization', 'Bearer admin-token')
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { userId: null },
        expect.objectContaining({ dealerName: 'Updated System', userId: null }),
        expect.any(Object)
      );
    });

    it('updates personal branding when regular user', async () => {
      vi.mocked(jwtStrategy.verifyToken).mockResolvedValue({ sub: userId1 });
      vi.spyOn(User, 'findById').mockResolvedValue({ _id: userId1, role: 'user' } as any);
      
      const updatePayload = { dealerName: 'Updated User Store' };
      const findOneAndUpdateSpy = vi.spyOn(Branding, 'findOneAndUpdate').mockResolvedValue({
        dealerName: 'Updated User Store',
        userId: userId1
      } as any);

      const res = await request(app)
        .put('/api/branding')
        .set('Authorization', 'Bearer user-token')
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { userId: userId1 },
        expect.objectContaining({ dealerName: 'Updated User Store', userId: userId1 }),
        expect.any(Object)
      );
    });
  });

  describe('PDF Service Branding Isolation', () => {
    it('uses owner branding for PDF generation', async () => {
      const bill = { owner: userId1 };
      const userBranding = { dealerName: 'User 1 Store', userId: userId1 };
      
      const findOneSpy = vi.spyOn(Branding, 'findOne').mockImplementation((filter: any) => {
        if (filter.userId === userId1) return Promise.resolve(userBranding as any);
        return Promise.resolve(null);
      });

      await generatePDF(bill);

      // Verify that Branding.findOne was called with userId1
      expect(findOneSpy).toHaveBeenCalledWith({ userId: userId1 });
    });

    it('falls back to system branding if owner branding missing', async () => {
      const bill = { owner: userId2 };
      const systemBranding = { dealerName: 'System Default', userId: null };
      
      vi.spyOn(Branding, 'findOne').mockImplementation((filter: any) => {
        if (filter.userId === null) return Promise.resolve(systemBranding as any);
        return Promise.resolve(null);
      });

      await generatePDF(bill);

      // Verify fallback call
      expect(Branding.findOne).toHaveBeenCalledWith({ userId: userId2 });
      expect(Branding.findOne).toHaveBeenCalledWith({ userId: null });
    });
  });
});
