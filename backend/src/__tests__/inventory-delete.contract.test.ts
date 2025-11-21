import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import app from '../server.js'
import BikeInventory, { BikeStatus } from '../models/BikeInventory.js'
import User, { UserRole } from '../models/User.js'

vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: 'admin-user-id' }))
}))

describe('DELETE /api/inventory/:id', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Ensure admin role for requireAdmin
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: 'admin-user-id', role: UserRole.ADMIN } as any)
    // Default env
    process.env.NODE_ENV = 'test'
    process.env.INVENTORY_DELETE_ENABLED = 'true'
  })

  it('returns 400 for invalid ObjectId', async () => {
    const res = await request(app)
      .delete('/api/inventory/not-an-id')
      .set('Authorization', 'Bearer test')
    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found', async () => {
    vi.spyOn(BikeInventory, 'findById').mockResolvedValue(null as any)
    const res = await request(app)
      .delete('/api/inventory/64b3f2f0f0f0f0f0f0f0f0f0')
      .set('Authorization', 'Bearer test')
    expect(res.status).toBe(404)
  })

  it('allows soft-delete of sold item', async () => {
    const updateSpy = vi.spyOn(BikeInventory, 'findByIdAndUpdate').mockResolvedValue({} as any)
    vi.spyOn(BikeInventory, 'findById').mockResolvedValue({ _id: 'x', status: BikeStatus.SOLD } as any)
    const res = await request(app)
      .delete('/api/inventory/64b3f2f0f0f0f0f0f0f0f0f0')
      .set('Authorization', 'Bearer test')
      .send({ reason: 'Cleanup sold entry' })
    expect(res.status).toBe(200)
    expect(res.body.softDeleted).toBe(true)
    expect(updateSpy).toHaveBeenCalled()
  })

  it('soft-deletes available item and records reason', async () => {
    const updateSpy = vi.spyOn(BikeInventory, 'findByIdAndUpdate').mockResolvedValue({} as any)
    vi.spyOn(BikeInventory, 'findById').mockResolvedValue({ _id: 'x', status: BikeStatus.AVAILABLE } as any)
    const res = await request(app)
      .delete('/api/inventory/64b3f2f0f0f0f0f0f0f0f0f0')
      .set('Authorization', 'Bearer test')
      .send({ reason: 'Duplicate entry' })
    expect(res.status).toBe(200)
    expect(res.body.softDeleted).toBe(true)
    expect(updateSpy).toHaveBeenCalledWith(
      '64b3f2f0f0f0f0f0f0f0f0f0',
      expect.objectContaining({ isDeleted: true, deleteReason: 'Duplicate entry' }),
      expect.anything()
    )
  })

  it('enforces feature flag disabled', async () => {
    process.env.INVENTORY_DELETE_ENABLED = 'false'
    vi.spyOn(BikeInventory, 'findById').mockResolvedValue({ _id: 'x', status: BikeStatus.AVAILABLE } as any)
    const res = await request(app)
      .delete('/api/inventory/64b3f2f0f0f0f0f0f0f0f0f0')
      .set('Authorization', 'Bearer test')
    expect(res.status).toBe(403)
  })

  it('applies CSRF allowlist in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    const originalAllowedOrigins = app.locals.allowedOrigins
    try {
      process.env.NODE_ENV = 'production'
      // Allowed origin
      app.locals.allowedOrigins = ['http://allowed.example']
      vi.spyOn(BikeInventory, 'findById').mockResolvedValue({ _id: 'x', status: BikeStatus.AVAILABLE } as any)
      vi.spyOn(BikeInventory, 'findByIdAndUpdate').mockResolvedValue({} as any)
      let res = await request(app)
        .delete('/api/inventory/64b3f2f0f0f0f0f0f0f0f0f0')
        .set('Authorization', 'Bearer test')
        .set('Origin', 'http://not-allowed.example')
      expect(res.status).toBe(403)

      res = await request(app)
        .delete('/api/inventory/64b3f2f0f0f0f0f0f0f0f0f0')
        .set('Authorization', 'Bearer test')
        .set('Origin', 'http://allowed.example')
      expect(res.status).toBe(200)
    } finally {
      process.env.NODE_ENV = originalNodeEnv
      app.locals.allowedOrigins = originalAllowedOrigins
    }
  })
})
