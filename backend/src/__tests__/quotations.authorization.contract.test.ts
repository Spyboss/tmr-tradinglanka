import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import Quotation from '../models/Quotation.js';
import User, { UserRole } from '../models/User.js';

/**
 * Contract test: quotation authorization lives in
 * services/quotation.service.ts (permissions source of truth), and the
 * historic { error: ... } response envelopes are preserved exactly.
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
  query.populate = () => query
  query.sort = () => query
  query.skip = () => query
  query.limit = () => query
  return query
}

/** Thenable query double (mongoose findById returns an awaitable Query). */
const queryOf = (result: unknown): never => {
  const query: Record<string, unknown> = {}
  query.populate = () => query
  query.then = (onFulfilled: never, onRejected: never) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return query as never
}

describe('quotations — service-layer authorization', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.NODE_ENV = 'test'
  })

  it('list: regular user gets an owner-scoped Mongo filter', async () => {
    asRole(UserRole.USER)
    const findSpy = vi.spyOn(Quotation, 'find').mockReturnValue(chainable() as never)
    vi.spyOn(Quotation, 'countDocuments').mockResolvedValue(0 as never)

    const res = await request(app).get('/api/quotations').set(AUTH)
    expect(res.status).toBe(200)
    expect(JSON.stringify((findSpy.mock.calls as unknown[][])[0][0])).toContain(USER_ID)
  })

  it('list: admin filter carries no owner restriction', async () => {
    asRole(UserRole.ADMIN)
    const findSpy = vi.spyOn(Quotation, 'find').mockReturnValue(chainable() as never)
    vi.spyOn(Quotation, 'countDocuments').mockResolvedValue(0 as never)

    const res = await request(app).get('/api/quotations').set(AUTH)
    expect(res.status).toBe(200)
    expect(JSON.stringify((findSpy.mock.calls as unknown[][])[0][0])).not.toContain('owner')
  })

  it('read: owner 200, stranger 403 with historic envelope', async () => {
    asRole(UserRole.USER)
    vi.spyOn(Quotation, 'findById').mockReturnValue({
      populate: () => Promise.resolve({ _id: 'q1', owner: USER_ID })
    } as never)
    let res = await request(app).get('/api/quotations/q1').set(AUTH)
    expect(res.status).toBe(200)

    vi.spyOn(Quotation, 'findById').mockReturnValue({
      populate: () => Promise.resolve({ _id: 'q1', owner: OTHER_ID })
    } as never)
    res = await request(app).get('/api/quotations/q1').set(AUTH)
    expect(res.status).toBe(403)
    expect(res.body).toEqual({
      error: 'You do not have permission to view this quotation'
    })
  })

  it('read: admin sees any quotation', async () => {
    asRole(UserRole.ADMIN)
    vi.spyOn(Quotation, 'findById').mockReturnValue({
      populate: () => Promise.resolve({ _id: 'q1', owner: OTHER_ID })
    } as never)

    const res = await request(app).get('/api/quotations/q1').set(AUTH)
    expect(res.status).toBe(200)
  })

  it('delete: stranger 403, owner 200', async () => {
    asRole(UserRole.USER)
    vi.spyOn(Quotation, 'findById').mockReturnValue(queryOf({ _id: 'q1', owner: OTHER_ID }))
    let res = await request(app).delete('/api/quotations/q1').set(AUTH)
    expect(res.status).toBe(403)
    expect(res.body).toEqual({
      error: 'You do not have permission to delete this quotation'
    })

    vi.spyOn(Quotation, 'findById').mockReturnValue(queryOf({ _id: 'q1', owner: USER_ID }))
    const deleteSpy = vi
      .spyOn(Quotation, 'findByIdAndDelete')
      .mockResolvedValue({} as never)
    res = await request(app).delete('/api/quotations/q1').set(AUTH)
    expect(res.status).toBe(200)
    expect(deleteSpy).toHaveBeenCalledWith('q1')
  })

  it('convert-to-invoice: stranger 403, own quotation 201', async () => {
    asRole(UserRole.USER)
    vi.spyOn(Quotation, 'findById').mockReturnValue(queryOf({ _id: 'q1', owner: OTHER_ID }))
    let res = await request(app)
      .post('/api/quotations/q1/convert-to-invoice')
      .set(AUTH)
    expect(res.status).toBe(403)

    const loaded = {
      _id: 'q1',
      type: 'quotation',
      status: 'draft',
      remarks: '',
      owner: USER_ID,
      toObject: () => ({ _id: 'q1', type: 'quotation', customerName: 'C', owner: USER_ID }),
      save: vi.fn().mockResolvedValue(undefined)
    }
    vi.spyOn(Quotation, 'findById').mockReturnValue(queryOf(loaded))
    vi.spyOn(Quotation.prototype, 'save').mockResolvedValue(loaded as never)

    res = await request(app).post('/api/quotations/q1/convert-to-invoice').set(AUTH)
    expect(res.status).toBe(201)
    expect(loaded.save).toHaveBeenCalled()
  })
})
