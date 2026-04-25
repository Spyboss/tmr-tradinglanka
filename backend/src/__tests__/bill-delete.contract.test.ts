import request from 'supertest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import app from '../server.js'
import Bill from '../models/Bill.js'
import User, { UserRole } from '../models/User.js'

vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: '6566f1f2a1b2c3d4e5f6a7b8' }))
}))

describe('DELETE /api/bills/:id', () => {
  const billId = '7566f1f2a1b2c3d4e5f6a7b8'
  const ownerId = '6566f1f2a1b2c3d4e5f6a7b8'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('blocks non-admin users from deleting a non-cancelled bill', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: UserRole.USER } as any)
    vi.spyOn(Bill, 'findById').mockResolvedValue({ _id: billId, owner: ownerId, status: 'completed' } as any)
    const deleteSpy = vi.spyOn(Bill, 'findByIdAndDelete').mockResolvedValue({} as any)

    const res = await request(app)
      .delete(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Cancel this bill before deleting it')
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('allows non-admin owners to delete a cancelled bill', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: UserRole.USER } as any)
    vi.spyOn(Bill, 'findById').mockResolvedValue({ _id: billId, owner: ownerId, status: 'cancelled' } as any)
    const deleteSpy = vi.spyOn(Bill, 'findByIdAndDelete').mockResolvedValue({} as any)

    const res = await request(app)
      .delete(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Bill deleted successfully')
    expect(deleteSpy).toHaveBeenCalledWith(billId)
  })

  it('allows admins to delete a non-cancelled bill', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: ownerId, role: UserRole.ADMIN } as any)
    vi.spyOn(Bill, 'findById').mockResolvedValue({ _id: billId, owner: 'other-user-id', status: 'completed' } as any)
    const deleteSpy = vi.spyOn(Bill, 'findByIdAndDelete').mockResolvedValue({} as any)

    const res = await request(app)
      .delete(`/api/bills/${billId}`)
      .set('Authorization', 'Bearer test-token')

    expect(res.status).toBe(200)
    expect(deleteSpy).toHaveBeenCalledWith(billId)
  })
})
