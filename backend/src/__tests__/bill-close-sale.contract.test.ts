import request from 'supertest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import app from '../server'
import Bill from '../models/Bill'
import BikeInventory from '../models/BikeInventory'
import User from '../models/User'

vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: '6566f1f2a1b2c3d4e5f6a7b8' }))
}))

describe('POST /api/bills/:id/close-sale', () => {
  const billId = '6566f1f2a1b2c3d4e5f6a7b8'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a final completed bill and converts the advance bill', async () => {
    const session = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      abortTransaction: vi.fn(),
      endSession: vi.fn()
    }

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as any)
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: billId, role: 'admin' } as any)

    const originalBill: any = {
      _id: billId,
      owner: 'test-user-id',
      customerName: 'Alice',
      customerNIC: '000000000V',
      customerAddress: 'Main Street',
      customerPhone: '0712345678',
      bikeModel: 'X01',
      bikePrice: 450000,
      motorNumber: 'MTR123',
      chassisNumber: 'CHS123',
      billType: 'cash',
      isEbicycle: false,
      isTricycle: false,
      rmvCharge: 13000,
      isAdvancePayment: true,
      advanceAmount: 100000,
      balanceAmount: 350000,
      inventoryItemId: '7656f1f2a1b2c3d4e5f6a7b8',
      status: 'pending',
      save: vi.fn(async function() {
        return this
      })
    }

    vi.spyOn(Bill, 'findById').mockReturnValue({
      session: vi.fn().mockResolvedValue(originalBill)
    } as any)

    const finalBillSave = vi.spyOn(Bill.prototype, 'save').mockImplementation(async function() {
      return this as any
    })

    const inventoryUpdate = vi.spyOn(BikeInventory, 'findByIdAndUpdate').mockResolvedValue({} as any)

    const res = await request(app)
      .post(`/api/bills/${billId}/close-sale`)
      .set('Authorization', 'Bearer test-token')
      .send({})

    expect(res.status).toBe(201)
    expect(res.body.message).toContain('Final sale bill created successfully')
    expect(res.body.finalBill).toMatchObject({
      status: 'completed',
      isAdvancePayment: false,
      totalAmount: 463000
    })
    expect(finalBillSave).toHaveBeenCalled()
    expect(originalBill.save).toHaveBeenCalled()
    expect(inventoryUpdate).toHaveBeenCalled()
    expect(session.commitTransaction).toHaveBeenCalled()
  })
})
