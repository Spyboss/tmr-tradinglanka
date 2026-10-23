import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import User, { UserRole } from '../models/User.js';

/**
 * Contract test for requirePermission (route-level gates driven by the
 * permissions source of truth). Replaces the old requireAdmin middleware.
 */

vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: '6566f1f2a1b2c3d4e5f6a7b8' }))
}))

const asRole = (role: UserRole) =>
  vi.spyOn(User, 'findById').mockResolvedValue({
    _id: '6566f1f2a1b2c3d4e5f6a7b8',
    role
  } as never)

describe('requirePermission (admin gates)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.NODE_ENV = 'test'
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post('/api/bike-models').send({})
    expect(res.status).toBe(401)
  })

  it('rejects non-admin users with 403', async () => {
    asRole(UserRole.USER)
    const res = await request(app)
      .post('/api/bike-models')
      .set('Authorization', 'Bearer test')
      .send({})
    expect(res.status).toBe(403)
  })

  it('lets admins through the gate (not 403)', async () => {
    asRole(UserRole.ADMIN)
    const res = await request(app)
      .post('/api/bike-models')
      .set('Authorization', 'Bearer test')
      .send({})
    expect(res.status).not.toBe(403)
  })

  it('fails closed (403) when the user record is gone', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(null as never)
    const res = await request(app)
      .post('/api/bike-models')
      .set('Authorization', 'Bearer test')
      .send({})
    expect(res.status).toBe(403)
  })
})
