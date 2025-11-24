import request from 'supertest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import app from '../server'
import Bill from '../models/Bill'
import User from '../models/User'

vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: 'test-user-id' }))
}))

describe('GET /api/bills filters & pagination', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('applies filters, ranges, and search tokens', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: '6566f1f2a1b2c3d4e5f6a7b8', role: 'admin' } as any)

    const captured: any[] = []
    const fakeBills = [
      { _id: 'a', customerName: 'Alice', billType: 'cash', totalAmount: 1000 },
      { _id: 'b', customerName: 'Bob', billType: 'leasing', totalAmount: 2000 }
    ]

    vi.spyOn(Bill, 'find').mockImplementation((filter: any) => {
      captured.push(filter)
      return {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(fakeBills)
      } as any
    })
    vi.spyOn(Bill, 'countDocuments').mockResolvedValue(42 as any)

    const res = await request(app)
      .get('/api/bills')
      .set('Authorization', 'Bearer test-token')
      .query({
        page: 2,
        limit: 10,
        status: 'completed',
        billType: 'cash',
        startDate: new Date('2024-01-01').toISOString(),
        endDate: new Date('2024-12-31').toISOString(),
        minAmount: 500,
        maxAmount: 5000,
        search: 'Alice 000000000V X01'
      })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('bills')
    expect(res.body).toHaveProperty('total', 42)
    expect(res.body).toHaveProperty('currentPage', 2)

    const filter = captured[0]
    expect(filter.status).toBe('completed')
    expect(filter.billType).toBe('cash')
    expect(filter.billDate.$gte).toBeInstanceOf(Date)
    expect(filter.billDate.$lte).toBeInstanceOf(Date)
    expect(filter.totalAmount.$gte).toBe(500)
    expect(filter.totalAmount.$lte).toBe(5000)
    expect(Array.isArray(filter.$or)).toBe(true)
  })

  it('scopes to owner for non-admin users', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: '6566f1f2a1b2c3d4e5f6a7b8', role: 'user' } as any)

    let capturedFilter: any = null
    vi.spyOn(Bill, 'find').mockImplementation((filter: any) => {
      capturedFilter = filter
      return {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      } as any
    })
    vi.spyOn(Bill, 'countDocuments').mockResolvedValue(0 as any)

    const res = await request(app)
      .get('/api/bills')
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(200)
    expect(capturedFilter && capturedFilter.owner).toBe('test-user-id')
  })
})

describe('GET /api/bills/suggestions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns customers, billNumbers, and models', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: '6566f1f2a1b2c3d4e5f6a7b8', role: 'admin' } as any)

    const pipelines: any[] = []
    vi.spyOn(Bill, 'aggregate').mockImplementation(async (pipeline: any) => {
      pipelines.push(pipeline)
      const match = pipeline[0]?.$match || {}
      if (match.customerName) return [{ _id: 'Alice' }, { _id: 'Bob' }]
      if (match.billNumber) return [{ _id: 'BILL-001' }]
      if (match.bikeModel) return [{ _id: 'X01' }, { _id: 'X02' }]
      return []
    })

    const res = await request(app)
      .get('/api/bills/suggestions')
      .set('Authorization', 'Bearer test-token')
      .query({ q: 'x' })

    expect(res.status).toBe(200)
    expect(res.body.customers).toContain('Alice')
    expect(res.body.billNumbers).toContain('BILL-001')
    expect(res.body.models).toContain('X01')
    expect(pipelines.length).toBe(3)
  })

  it('filters by owner for non-admin users', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: '6566f1f2a1b2c3d4e5f6a7b8', role: 'user' } as any)

    let ownerMatched = false
    vi.spyOn(Bill, 'aggregate').mockImplementation(async (pipeline: any) => {
      if (pipeline[0]?.$match?.owner === 'test-user-id') ownerMatched = true
      return [{ _id: 'Any' }]
    })

    const res = await request(app)
      .get('/api/bills/suggestions')
      .set('Authorization', 'Bearer test-token')
      .query({ q: 'a' })

    expect(res.status).toBe(200)
    expect(ownerMatched).toBe(true)
  })
})