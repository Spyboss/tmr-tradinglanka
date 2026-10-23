import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import WarrantyClaim from '../models/WarrantyClaim.js';
import User, { UserRole } from '../models/User.js';

/**
 * Contract test: warranty claim authorization now lives in
 * services/warrantyClaim.service.ts (driven by permissions/rules.ts),
 * not in scattered controller role checks.
 */

vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: '6566f1f2a1b2c3d4e5f6a7b8' }))
}))

const USER_ID = '6566f1f2a1b2c3d4e5f6a7b8'
const OTHER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const AUTH = { Authorization: 'Bearer test' }

const asRole = (role: UserRole) =>
  vi.spyOn(User, 'findById').mockResolvedValue({ _id: USER_ID, role } as never)

const chainable = () => {
  const query: Record<string, unknown> = {}
  query.sort = () => query
  query.skip = () => query
  query.limit = () => query
  return query
}

describe('warranty claims — service-layer authorization', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.NODE_ENV = 'test'
  })

  it('list: regular user gets an owner-scoped Mongo filter', async () => {
    asRole(UserRole.USER)
    const findSpy = vi.spyOn(WarrantyClaim, 'find').mockReturnValue(chainable() as never)
    vi.spyOn(WarrantyClaim, 'countDocuments').mockResolvedValue(0 as never)

    const res = await request(app).get('/api/warranty-claims').set(AUTH)
    expect(res.status).toBe(200)
    expect(JSON.stringify((findSpy.mock.calls as unknown[][])[0][0])).toContain(USER_ID)
  })

  it('list: admin filter carries no owner restriction', async () => {
    asRole(UserRole.ADMIN)
    const findSpy = vi.spyOn(WarrantyClaim, 'find').mockReturnValue(chainable() as never)
    vi.spyOn(WarrantyClaim, 'countDocuments').mockResolvedValue(0 as never)

    const res = await request(app).get('/api/warranty-claims').set(AUTH)
    expect(res.status).toBe(200)
    expect(JSON.stringify((findSpy.mock.calls as unknown[][])[0][0])).not.toContain('owner')
  })

  it('read: owner can read own claim', async () => {
    asRole(UserRole.USER)
    vi.spyOn(WarrantyClaim, 'findById').mockResolvedValue({
      _id: 'c1',
      owner: USER_ID
    } as never)

    const res = await request(app).get('/api/warranty-claims/c1').set(AUTH)
    expect(res.status).toBe(200)
  })

  it("read: another user's claim is 403", async () => {
    asRole(UserRole.USER)
    vi.spyOn(WarrantyClaim, 'findById').mockResolvedValue({
      _id: 'c1',
      owner: OTHER_ID
    } as never)

    const res = await request(app).get('/api/warranty-claims/c1').set(AUTH)
    expect(res.status).toBe(403)
  })

  it('read: admin can read any claim', async () => {
    asRole(UserRole.ADMIN)
    vi.spyOn(WarrantyClaim, 'findById').mockResolvedValue({
      _id: 'c1',
      owner: OTHER_ID
    } as never)

    const res = await request(app).get('/api/warranty-claims/c1').set(AUTH)
    expect(res.status).toBe(200)
  })

  it('delete: stranger cannot delete, owner can', async () => {
    asRole(UserRole.USER)
    vi.spyOn(WarrantyClaim, 'findById').mockResolvedValue({
      _id: 'c1',
      owner: OTHER_ID
    } as never)
    let res = await request(app).delete('/api/warranty-claims/c1').set(AUTH)
    expect(res.status).toBe(403)

    vi.spyOn(WarrantyClaim, 'findById').mockResolvedValue({
      _id: 'c1',
      owner: USER_ID
    } as never)
    const deleteSpy = vi.spyOn(WarrantyClaim, 'findByIdAndDelete').mockResolvedValue({} as never)
    res = await request(app).delete('/api/warranty-claims/c1').set(AUTH)
    expect(res.status).toBe(200)
    expect(deleteSpy).toHaveBeenCalledWith('c1')
  })
})
