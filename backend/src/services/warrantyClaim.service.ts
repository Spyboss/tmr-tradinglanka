import mongoose from 'mongoose';
import WarrantyClaim from '../models/WarrantyClaim.js';
import Bill from '../models/Bill.js';
import BikeInventory from '../models/BikeInventory.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateWarrantyPDF } from './warrantyPdfService.js';
import { assertCan, can, readableWhere } from '../permissions/index.js';
import type { AppAbility } from '../permissions/index.js';

/**
 * Warranty claim service — the ONLY place that reads/writes warranty claims.
 * Every function takes the caller's ability (permissions single source of
 * truth) and enforces it:
 *   - list/search  -> readableWhere() compiles read rules to a Mongo filter
 *   - single ops   -> assertCan() on the loaded document (owner attributes)
 * Controllers stay thin: parse request -> call service -> respond.
 */

export interface ListClaimsInput {
  page?: unknown;
  limit?: unknown;
  status?: unknown;
  search?: unknown;
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listClaims(ability: AppAbility, input: ListClaimsInput) {
  const pageNum = parseInt(String(input.page ?? '1')) || 1;
  const limitNum = parseInt(String(input.limit ?? '20')) || 20;
  const skip = (pageNum - 1) * limitNum;

  const accessible = readableWhere(ability, 'WarrantyClaim');
  if (!accessible) {
    throw new AppError('You do not have permission to view warranty claims', 403);
  }

  const filters: Record<string, unknown>[] = [accessible];
  const extra: Record<string, unknown> = {};
  if (input.status) extra.status = input.status;
  if (input.search) {
    const regex = new RegExp(escapeRegex(String(input.search)), 'i');
    extra.$or = [
      { warrantyNumber: regex },
      { customerName: regex },
      { chassisNumber: regex },
      { motorNumber: regex }
    ];
  }
  if (Object.keys(extra).length > 0) filters.push(extra);
  const filter = { $and: filters };

  const claims = await WarrantyClaim.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);
  const total = await WarrantyClaim.countDocuments(filter);

  return {
    claims,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    total
  };
}

export async function getClaim(ability: AppAbility, id: string) {
  const claim = await WarrantyClaim.findById(id);
  if (!claim) throw new AppError('Warranty claim not found', 404);
  assertCan(ability, 'read', 'WarrantyClaim', claim);
  return claim;
}

export async function getClaimPdf(ability: AppAbility, id: string) {
  const claim = await getClaim(ability, id);
  const buffer = await generateWarrantyPDF(claim);
  return { buffer, warrantyNumber: claim.warrantyNumber };
}

export async function createClaim(
  ability: AppAbility,
  ownerId: string,
  data: Record<string, unknown>
) {
  assertCan(ability, 'create', 'WarrantyClaim');
  try {
    const claim = new WarrantyClaim({ ...data, owner: ownerId });
    return await claim.save();
  } catch (error) {
    throw mapClaimWriteError(error, 'create');
  }
}

export async function updateClaim(
  ability: AppAbility,
  id: string,
  data: Record<string, unknown>
) {
  const claim = await WarrantyClaim.findById(id);
  if (!claim) throw new AppError('Warranty claim not found', 404);
  assertCan(ability, 'update', 'WarrantyClaim', claim);

  const payload = { ...data };
  // owner reassignment is admin-only — detect that via the unconditioned
  // `manage`/`all` wildcard (type-level can() IGNORES conditions, so an
  // update check would be true for the conditioned owner rule too)
  if (payload.owner !== undefined && !can(ability, 'manage', 'all')) {
    delete payload.owner;
  }

  try {
    claim.set(payload as Record<string, never>);
    return await claim.save();
  } catch (error) {
    throw mapClaimWriteError(error, 'update');
  }
}

export async function deleteClaim(ability: AppAbility, id: string) {
  const claim = await WarrantyClaim.findById(id);
  if (!claim) throw new AppError('Warranty claim not found', 404);
  assertCan(ability, 'delete', 'WarrantyClaim', claim);
  await WarrantyClaim.findByIdAndDelete(id);
}

/** Structural view of the bill fields the claim form prefills. */
interface PrefillBill {
  _id: unknown;
  proforma?: { color?: string };
  inventoryItemId?: unknown;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  chassisNumber?: string;
  motorNumber?: string;
  bikeModel?: string;
  billDate?: unknown;
}

/** Bill lookup for the claim form (prefill) — bills are readability-scoped. */
export async function getPrefillData(
  ability: AppAbility,
  query: { billId?: unknown; chassisNumber?: unknown }
) {
  const accessibleBill = readableWhere(ability, 'Bill');
  if (!accessibleBill) {
    throw new AppError('You do not have permission to view bills', 403);
  }

  let bill: PrefillBill | null = null;
  if (query.billId && mongoose.Types.ObjectId.isValid(String(query.billId))) {
    bill = (await Bill.findOne({
      $and: [accessibleBill, { _id: String(query.billId) }]
    })) as unknown as PrefillBill | null;
  } else if (query.chassisNumber) {
    bill = (await Bill.findOne({
      $and: [accessibleBill, { chassisNumber: String(query.chassisNumber).trim() }]
    })) as unknown as PrefillBill | null;
  }

  if (!bill) return { prefill: null };

  let color = bill.proforma?.color || '';
  if (!color && bill.inventoryItemId) {
    const inventory = await BikeInventory.findById(bill.inventoryItemId);
    if (inventory?.notes) color = inventory.notes;
  }

  return {
    prefill: {
      customerName: bill.customerName || '',
      customerPhone: bill.customerPhone || '',
      customerAddress: bill.customerAddress || '',
      chassisNumber: bill.chassisNumber || '',
      motorNumber: bill.motorNumber || '',
      bikeModel: bill.bikeModel || '',
      color,
      dateOfSale: bill.billDate || null,
      billId: bill._id
    }
  };
}

/** Bill search for the claim form — same readability scoping as prefill. */
export async function searchBillsForClaim(ability: AppAbility, q: unknown) {
  const accessibleBill = readableWhere(ability, 'Bill');
  if (!accessibleBill) {
    throw new AppError('You do not have permission to view bills', 403);
  }

  const regex = new RegExp(escapeRegex(String(q ?? '')), 'i');
  return Bill.find({
    $and: [
      accessibleBill,
      {
        $or: [
          { billNumber: regex },
          { customerName: regex },
          { chassisNumber: regex },
          { motorNumber: regex }
        ]
      }
    ]
  })
    .select(
      'billNumber customerName customerPhone chassisNumber motorNumber bikeModel billDate'
    )
    .limit(10)
    .sort({ createdAt: -1 });
}

export async function checkFormNumberAvailable(
  number: unknown,
  excludeId?: unknown
) {
  if (!number || !String(number).trim()) return { available: true };

  const filter: Record<string, unknown> = { formNumber: String(number).trim() };
  if (excludeId && mongoose.Types.ObjectId.isValid(String(excludeId))) {
    filter._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
  }

  const existing = await WarrantyClaim.findOne(filter).select('_id');
  return { available: !existing };
}

export async function suggestNextFormNumber() {
  const result = await WarrantyClaim.findOne({ formNumber: { $ne: '' } })
    .sort({ formNumber: -1 })
    .select('formNumber');

  const maxNum = result ? parseInt(result.formNumber, 10) : 0;
  const nextNum = isNaN(maxNum) ? 1 : maxNum + 1;
  return { formNumber: String(nextNum).padStart(4, '0') };
}

/** Preserves the exact error contract of the old controller. */
function mapClaimWriteError(error: unknown, operation: 'create' | 'update'): AppError {
  const err = error as mongoose.Error & {
    code?: number;
    keyPattern?: Record<string, unknown>;
  };

  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    return new AppError(`Validation error: ${messages.join(', ')}`, 400);
  }

  if (err.code === 11000 && err.keyPattern?.formNumber) {
    return operation === 'create'
      ? new AppError(
          'Form number is already in use. Please check the physical warranty book and use the next available number.',
          409
        )
      : new AppError(
          'Form number is already in use by another claim. Please use a different number.',
          409
        );
  }

  return new AppError(
    `Failed to ${operation} warranty claim: ${(error as Error).message}`,
    500
  );
}
