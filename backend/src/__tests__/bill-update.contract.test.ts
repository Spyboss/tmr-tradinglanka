import request from 'supertest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import app from '../server.js'
import Bill from '../models/Bill.js'
import BikeInventory, { BikeStatus } from '../models/BikeInventory.js'
import UserActivity from '../models/UserActivity.js'
import User from '../models/User.js'

// Mock JWT verification to bypass authentication
vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: '6566f1f2a1b2c3d4e5f6a7b8' }))
}))

describe('PUT /api/bills/:id (camelCase contract)', () => {
  const billId = '6566f1f2a1b2c3d4e5f6a7b8'
  const ownerId = '6566f1f2a1b2c3d4e5f6a7b8'
  const oldInventoryId = '7566f1f2a1b2c3d4e5f6a7b8'
  const newInventoryId = '8566f1f2a1b2c3d4e5f6a7b8'
  let session: any

  beforeEach(() => {
    vi.restoreAllMocks()
    session = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      abortTransaction: vi.fn(),
      endSession: vi.fn()
    }
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session)
    vi.spyOn(BikeInventory, 'findOneAndUpdate').mockResolvedValue(null as any)
    vi.spyOn(UserActivity, 'create').mockResolvedValue([] as any)
  })

  const mockBill = (bill: any) => {
    vi.spyOn(Bill, 'findById').mockReturnValue({
      session: vi.fn().mockResolvedValue(bill)
    } as any)
  }

  it('updates with camelCase JSON and returns changed fields', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: 'admin' } as any)

    const updatedDoc: any = {
      _id: billId,
      owner: ownerId,
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
      }),
      toObject: function() { return this }
    }
    mockBill(updatedDoc)

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
    expect(updatedDoc.save).toHaveBeenCalledWith({ session })
    expect(session.commitTransaction).toHaveBeenCalled()
  })

  it('swaps inventory items when updating with new inventoryItemId', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: 'admin' } as any)

    const billWithOldInventory: any = {
      _id: billId,
      owner: ownerId,
      bikeModel: 'X01',
      customerName: 'Alice',
      status: 'completed',
      inventoryItemId: oldInventoryId,
      set(key: string, value: unknown) {
        this[key] = value
      },
      save: vi.fn(async function() {
        return this
      }),
      toObject: function() { return this }
    }
    mockBill(billWithOldInventory)

    vi.spyOn(BikeInventory, 'findOneAndUpdate').mockImplementation((query: any) => {
      if (query._id === oldInventoryId) {
        return Promise.resolve({ _id: oldInventoryId, status: 'available' }) as any
      }
      if (query._id === newInventoryId) {
        return Promise.resolve({ _id: newInventoryId, status: 'sold' }) as any
      }
      return Promise.resolve(null) as any
    })

    const res = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')
      .send({
        inventoryItemId: newInventoryId,
        motorNumber: 'MTR456',
        chassisNumber: 'CHS456'
      })

    expect(res.status).toBe(200)
    expect(res.body.previousInventoryReleased).toBe(true)
    expect(res.body.newInventoryClaimed).toBe(true)
    expect(res.body.previousInventoryItemId).toBe(oldInventoryId)
    expect(res.body.newInventoryItemId).toBe(newInventoryId)
    expect(session.commitTransaction).toHaveBeenCalled()
    expect(UserActivity.create).toHaveBeenCalledWith(
      [expect.objectContaining({
        description: expect.stringContaining('swapped inventory items')
      })],
      { session }
    )
  })

  it('releases old inventory without claiming new when inventoryItemId is cleared', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: 'admin' } as any)

    const billWithOldInventory: any = {
      _id: billId,
      owner: ownerId,
      bikeModel: 'X01',
      customerName: 'Alice',
      status: 'completed',
      inventoryItemId: oldInventoryId,
      set(key: string, value: unknown) {
        this[key] = value
      },
      save: vi.fn(async function() {
        return this
      }),
      toObject: function() { return this }
    }
    mockBill(billWithOldInventory)

    vi.spyOn(BikeInventory, 'findOneAndUpdate').mockImplementation((query: any) => {
      if (query._id === oldInventoryId) {
        return Promise.resolve({ _id: oldInventoryId, status: 'available' }) as any
      }
      return Promise.resolve(null) as any
    })

    const res = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')
      .send({
        inventoryItemId: null,
        motorNumber: 'MTR999',
        chassisNumber: 'CHS999'
      })

    expect(res.status).toBe(200)
    expect(res.body.previousInventoryReleased).toBe(true)
    expect(res.body.newInventoryClaimed).toBe(false)
    expect(session.commitTransaction).toHaveBeenCalled()
  })

  it('rejects unavailable new inventory item', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: 'admin' } as any)

    const billWithOldInventory: any = {
      _id: billId,
      owner: ownerId,
      bikeModel: 'X01',
      inventoryItemId: oldInventoryId,
      set(key: string, value: unknown) {
        this[key] = value
      },
      save: vi.fn(),
      toObject: function() { return this }
    }
    mockBill(billWithOldInventory)

    vi.spyOn(BikeInventory, 'findOneAndUpdate').mockResolvedValue(null as any)

    const res = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ inventoryItemId: newInventoryId })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Selected inventory item is not available')
    expect(session.abortTransaction).toHaveBeenCalled()
  })

  it('snake_case keys do not update camelCase fields (contract safety)', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: 'admin' } as any)

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
      }),
      toObject: function() { return this }
    }
    mockBill(unchangedDoc)

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
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: 'admin' } as any)

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
      }),
      toObject: function() { return this }
    }
    mockBill(advanceBill)

    const res = await request(app)
      .put(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')
      .send({ customerPhone: ' 0771234567 ' })

    expect(res.status).toBe(200)
    expect(res.body.customerPhone).toBe('0771234567')
    expect(advanceBill.save).toHaveBeenCalledWith({ session })
  })
})
