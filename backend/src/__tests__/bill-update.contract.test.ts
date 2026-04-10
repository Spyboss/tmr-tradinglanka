import request from 'supertest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import app from '../server'
import Bill from '../models/Bill'
import User from '../models/User'

// Mock JWT verification to bypass authentication
vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: '6566f1f2a1b2c3d4e5f6a7b8' }))
}))

describe('PUT /api/bills/:id (camelCase contract)', () => {
  const billId = '6566f1f2a1b2c3d4e5f6a7b8'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('updates with camelCase JSON and returns changed fields', async () => {
    // Stub ownership check to allow update
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: '6566f1f2a1b2c3d4e5f6a7b8', role: 'admin' } as any)

    const updatedDoc: any = {
      _id: billId,
      owner: 'test-user-id',
      bikeModel: 'X01',
      bikePrice: 450000,
      billType: 'cash',
      isEbicycle: true,
      totalAmount: 450000,
      customerName: 'Alice',
      customerNIC: '000000000V',
      customerAddress: 'Main Street',
      motorNumber: 'MTR123',
      chassisNumber: 'CHS123',
      billDate: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      set(key: string, value: unknown) {
        this[key] = value
      },
      save: vi.fn(async function() {
        return this
      })
    }
    vi.spyOn(Bill, 'findById').mockResolvedValue(updatedDoc)

    const payload = {
      bikeModel: 'X01',
      bikePrice: 450000,
      billType: 'cash',
      isEbicycle: true,
      totalAmount: 450000,
      customerName: 'Alice',
      customerNIC: '000000000V',
      customerAddress: 'Main Street',
      motorNumber: 'MTR123',
      chassisNumber: 'CHS123'
    }

    const res = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      bikeModel: 'X01',
      bikePrice: 450000,
      billType: 'cash',
      isEbicycle: true,
      totalAmount: 450000
    })
    expect(updatedDoc.save).toHaveBeenCalled()
  })

  it('snake_case keys do not update camelCase fields (contract safety)', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: '6566f1f2a1b2c3d4e5f6a7b8', role: 'admin' } as any)

    const unchangedDoc: any = {
      _id: billId,
      owner: 'test-user-id',
      bikeModel: 'Old',
      bikePrice: 300000,
      billType: 'cash',
      isEbicycle: false,
      totalAmount: 313000,
      updatedAt: new Date().toISOString(),
      set(key: string, value: unknown) {
        this[key] = value
      },
      save: vi.fn(async function() {
        return this
      })
    }
    vi.spyOn(Bill, 'findById').mockResolvedValue(unchangedDoc)

    const snakePayload = {
      model_name: 'NewShouldBeIgnored',
      bike_price: 999999,
      bill_type: 'advance'
    }

    const res = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')
      .send(snakePayload)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      bikeModel: 'Old',
      bikePrice: 300000,
      billType: 'cash'
    })
  })

  it('updates advance bills with a plain phone number using document save', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: '6566f1f2a1b2c3d4e5f6a7b8', role: 'admin' } as any)

    const advanceBill: any = {
      _id: billId,
      owner: 'test-user-id',
      isAdvancePayment: true,
      customerPhone: '0712345678',
      set(key: string, value: unknown) {
        this[key] = value
      },
      save: vi.fn(async function() {
        return this
      })
    }

    vi.spyOn(Bill, 'findById').mockResolvedValue(advanceBill)

    const res = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ customerPhone: ' 0771234567 ' })

    expect(res.status).toBe(200)
    expect(res.body.customerPhone).toBe('0771234567')
    expect(advanceBill.save).toHaveBeenCalled()
  })
})
