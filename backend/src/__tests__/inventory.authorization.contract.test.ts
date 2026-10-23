import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import BikeInventory from '../models/BikeInventory.js';
import BikeModel from '../models/BikeModel.js';
import User, { UserRole } from '../models/User.js';

/**
 * Contract test: inventory authorization lives in
 * services/inventory.service.ts (permissions source of truth). Locks the
 * two pre-existing IDOR holes this migration closed:
 *   GET  /api/inventory/:id  was open to every authenticated user
 *   PUT  /api/inventory/:id  had no ownership check at all
 */

vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: '6566f1f2a1b2c3d4e5f6a7b8' }))
}))

const USER_ID = '6566f1f2a1b2c3d4e5f6a7b8'
const OTHER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const AUTH = { Authorization: 'Bearer test' }

const asRole = (role: UserRole) =>
  vi.spyOn(User, 'findById').mockResolvedValue({ _id: USER_ID, role } as never)

/** Thenable query double (mongoose findById returns an awaitable Query). */
const queryOf = (result: unknown): never => {
  const query: Record<string, unknown> = {}
  query.populate = () => query
  query.sort = () => query
  query.skip = () => query
  query.limit = () => query
  query.then = (onFulfilled: never, onRejected: never) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return query as never
}

describe('inventory — service-layer authorization', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.NODE_ENV = 'test'
  })

  it('list: regular user gets an addedBy-scoped Mongo filter, admin none', async () => {
    asRole(UserRole.USER)
    const findSpy = vi.spyOn(BikeInventory, 'find').mockReturnValue(queryOf([]))
    vi.spyOn(BikeInventory, 'countDocuments').mockResolvedValue(0 as never)
    let res = await request(app).get('/api/inventory').set(AUTH)
    expect(res.status).toBe(200)
    expect(JSON.stringify((findSpy.mock.calls as unknown[][])[0][0])).toContain(USER_ID)

    vi.restoreAllMocks()
    asRole(UserRole.ADMIN)
    const adminFindSpy = vi.spyOn(BikeInventory, 'find').mockReturnValue(queryOf([]))
    vi.spyOn(BikeInventory, 'countDocuments').mockResolvedValue(0 as never)
    res = await request(app).get('/api/inventory').set(AUTH)
    expect(res.status).toBe(200)
    expect(JSON.stringify((adminFindSpy.mock.calls as unknown[][])[0][0])).not.toContain('addedBy')
  })

  it('read by id: stranger 403 (was open), owner 200, admin sees any', async () => {
    asRole(UserRole.USER)
    vi.spyOn(BikeInventory, 'findById').mockReturnValue(
      queryOf({ _id: 'b1a2c3d4e5f6a7b8c9d0e1f2', addedBy: OTHER_ID })
    )
    let res = await request(app).get('/api/inventory/b1a2c3d4e5f6a7b8c9d0e1f2').set(AUTH)
    expect(res.status).toBe(403)
    expect(res.body).toEqual({
      status: 'fail',
      message: 'You do not have permission to view this inventory item'
    })

    vi.spyOn(BikeInventory, 'findById').mockReturnValue(
      queryOf({ _id: 'b1a2c3d4e5f6a7b8c9d0e1f2', addedBy: USER_ID })
    )
    res = await request(app).get('/api/inventory/b1a2c3d4e5f6a7b8c9d0e1f2').set(AUTH)
    expect(res.status).toBe(200)

    vi.restoreAllMocks()
    asRole(UserRole.ADMIN)
    vi.spyOn(BikeInventory, 'findById').mockReturnValue(
      queryOf({ _id: 'b1a2c3d4e5f6a7b8c9d0e1f2', addedBy: OTHER_ID })
    )
    res = await request(app).get('/api/inventory/b1a2c3d4e5f6a7b8c9d0e1f2').set(AUTH)
    expect(res.status).toBe(200)
  })

  it('update: stranger 403 (was open), owner 200', async () => {
    asRole(UserRole.USER)
    vi.spyOn(BikeInventory, 'findById').mockReturnValue(
      queryOf({ _id: 'b1a2c3d4e5f6a7b8c9d0e1f2', addedBy: OTHER_ID, status: 'available' })
    )
    let res = await request(app)
      .put('/api/inventory/b1a2c3d4e5f6a7b8c9d0e1f2')
      .set(AUTH)
      .send({ status: 'reserved' })
    expect(res.status).toBe(403)
    expect(res.body).toEqual({
      status: 'fail',
      message: 'You do not have permission to update this inventory item'
    })

    vi.spyOn(BikeInventory, 'findById').mockReturnValue(
      queryOf({ _id: 'b1a2c3d4e5f6a7b8c9d0e1f2', addedBy: USER_ID, status: 'available' })
    )
    const updateSpy = vi
      .spyOn(BikeInventory, 'findByIdAndUpdate')
      .mockResolvedValue({ _id: 'b1a2c3d4e5f6a7b8c9d0e1f2', status: 'reserved' } as never)
    res = await request(app)
      .put('/api/inventory/b1a2c3d4e5f6a7b8c9d0e1f2')
      .set(AUTH)
      .send({ status: 'reserved', addedBy: OTHER_ID })
    expect(res.status).toBe(200)
    expect(updateSpy).toHaveBeenCalled()
    // addedBy reassignment is stripped even for the owner
    const payload = (updateSpy.mock.calls as unknown[][])[0][1] as Record<string, unknown>
    expect(payload.addedBy).toBeUndefined()
    expect(payload.status).toBe('reserved')
  })

  it('create: caller is forced as owner even if body claims otherwise', async () => {
    asRole(UserRole.USER)
    vi.spyOn(BikeModel, 'findById').mockResolvedValue({ _id: '7566f1f2a1b2c3d4e5f6a7b8', name: 'X' } as never)
    const createSpy = vi
      .spyOn(BikeInventory, 'create')
      .mockResolvedValue({ _id: 'inv9' } as never)
    vi.spyOn(BikeInventory, 'findById').mockReturnValue(
      queryOf({ _id: 'inv9', addedBy: USER_ID })
    )

    const res = await request(app)
      .post('/api/inventory')
      .set(AUTH)
      .send({ bikeModelId: '7566f1f2a1b2c3d4e5f6a7b8', motorNumber: 'M1', addedBy: OTHER_ID })
    expect(res.status).toBe(201)
    const doc = (createSpy.mock.calls as unknown[][])[0][0] as Record<string, unknown>
    expect(doc.addedBy).toBe(USER_ID)
  })
})
