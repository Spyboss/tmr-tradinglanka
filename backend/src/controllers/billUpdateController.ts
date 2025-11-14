import { Request, Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import Bill from '../models/Bill.js'
import { AuthRequest } from '../auth/auth.middleware.js'
import { normalizeBillPayload } from '../utils/normalizeBillPayload.js'
import { applyVehicleTypeFlags, computeRMV, computeTotals } from '../services/billCalculations.js'

export const updateBill = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const bill = await Bill.findById(req.params.id)
    if (!bill) return res.status(404).json({ error: 'Bill not found' })
    const user = await req.app.locals.models?.User.findById(req.user?.id)
    const isAdmin = user?.role === 'admin'
    const isOwner = bill.owner && bill.owner.toString() === req.user?.id
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'You do not have permission to update this bill' })
    const normalized = normalizeBillPayload(req.body)
    const flags = await applyVehicleTypeFlags(normalized)
    const withRmv = computeRMV(flags)
    const computed = computeTotals(withRmv)
    const updated = await Bill.findByIdAndUpdate(req.params.id, computed, { new: true, runValidators: true })
    return res.status(200).json(updated)
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Update failed' })
  }
}
