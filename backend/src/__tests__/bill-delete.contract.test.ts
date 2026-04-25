import request from 'supertest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import app from '../server.js'
import Bill from '../models/Bill.js'
import BikeInventory from '../models/BikeInventory.js'
import UserActivity from '../models/UserActivity.js'
import User, { UserRole } from '../models/User.js'

vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: '6566f1f2a1b2c3d4e5f6a7b8' }))
}))

describe('DELETE /api/bills/:id', () => {
  const billId = '7566f1f2a1b2c3d4e5f6a7b8'
  const ownerId = '6566f1f2a1b2c3d4e5f6a7b8'
  const inventoryItemId = '8566f1f2a1b2c3d4e5f6a7b8'
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

  it('blocks non-admin users from deleting a non-cancelled bill', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: UserRole.USER } as any)
    mockBill({ _id: billId, owner: ownerId, status: 'completed' })
    const deleteSpy = vi.spyOn(Bill, 'findByIdAndDelete').mockResolvedValue({} as any)

    const res = await request(app)
      .delete(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Cancel this bill before deleting it')
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(session.abortTransaction).toHaveBeenCalled()
  })

  it('allows non-admin owners to delete a cancelled bill', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: UserRole.USER } as any)
    mockBill({ _id: billId, owner: ownerId, status: 'cancelled' })
    const deleteSpy = vi.spyOn(Bill, 'findByIdAndDelete').mockResolvedValue({} as any)

    const res = await request(app)
      .delete(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Bill deleted successfully')
    expect(deleteSpy).toHaveBeenCalledWith(billId, { session })
    expect(UserActivity.create).toHaveBeenCalledWith(expect.any(Array), { session })
    expect(session.commitTransaction).toHaveBeenCalled()
  })

  it('allows admins to delete a non-cancelled bill and releases linked inventory', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: UserRole.ADMIN } as any)
    mockBill({
      _id: billId,
      owner: 'other-user-id',
      status: 'completed',
      billNumber: 'BILL-001',
      bikeModel: 'X01',
      motorNumber: 'MTR123',
      chassisNumber: 'CHS123',
      inventoryItemId
    })
    const deleteSpy = vi.spyOn(Bill, 'findByIdAndDelete').mockResolvedValue({} as any)
    vi.spyOn(BikeInventory, 'findOneAndUpdate').mockResolvedValue({
      _id: inventoryItemId,
      status: 'available'
    } as any)

    const res = await request(app)
      .delete(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(200)
    expect(res.body.inventoryReleased).toBe(true)
    expect(BikeInventory.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: inventoryItemId, billId }),
      expect.objectContaining({ status: 'available', dateSold: null, billId: null }),
      { new: true, session }
    )
    expect(deleteSpy).toHaveBeenCalledWith(billId, { session })
    expect(UserActivity.create).toHaveBeenCalledWith(
      [expect.objectContaining({
        description: expect.stringContaining('released linked inventory item'),
        metadata: expect.objectContaining({
          newValues: expect.objectContaining({ inventoryReleased: true })
        })
      })],
      { session }
    )
    expect(session.commitTransaction).toHaveBeenCalled()
  })
})
