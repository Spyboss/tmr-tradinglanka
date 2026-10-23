import mongoose from 'mongoose';
import BikeInventory, { BikeStatus } from '../models/BikeInventory.js';
import BikeModel from '../models/BikeModel.js';
import { AppError } from '../middleware/errorHandler.js';
import { can, readableWhere } from '../permissions/index.js';
import type { AppAbility } from '../permissions/index.js';

/**
 * Inventory service — CRUD + scoping for inventory. Authorization comes
 * from the permissions source of truth:
 *   - lists/scopes -> readableWhere() compiled to Mongo filters
 *   - single docs   -> can() on the loaded document (closes two pre-existing
 *                      IDOR holes: GET /:id and PUT /:id had no owner check)
 * Aggregation pipelines remain in the controller for now; their $match
 * stages are scoped through inventoryScope()/billScope() below.
 */

const MAX_SEARCH_LENGTH = 64;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** readableWhere, but with ids cast for aggregation $match stages. */
const toMatch = (where: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(where).map(([key, value]) => [
      key,
      typeof value === 'string' && mongoose.isValidObjectId(value)
        ? new mongoose.Types.ObjectId(value)
        : value
    ])
  );

export function inventoryScope(ability: AppAbility): Record<string, unknown> {
  const where = readableWhere(ability, 'Inventory');
  if (!where) {
    throw new AppError('You do not have permission to view inventory', 403);
  }
  return toMatch(where);
}

export function billScope(ability: AppAbility): Record<string, unknown> {
  const where = readableWhere(ability, 'Bill');
  if (!where) {
    throw new AppError('You do not have permission to view bills', 403);
  }
  return toMatch(where);
}

interface ListQuery {
  page?: unknown;
  limit?: unknown;
  status?: unknown;
  modelId?: unknown;
  search?: unknown;
  sort?: unknown;
  order?: unknown;
}

export async function listInventory(ability: AppAbility, query: ListQuery) {
  const pageNum = parseInt(String(query.page ?? '1')) || 1;
  const limitNum = parseInt(String(query.limit ?? '20')) || 20;
  const skip = (pageNum - 1) * limitNum;

  const accessible = readableWhere(ability, 'Inventory');
  if (!accessible) {
    throw new AppError('You do not have permission to view inventory', 403);
  }

  const filters: Record<string, unknown>[] = [
    { isDeleted: { $ne: true } },
    accessible
  ];

  if (query.status) filters.push({ status: query.status });
  if (query.modelId) filters.push({ bikeModelId: query.modelId });
  if (query.search) {
    const normalizedSearch = String(query.search).trim().slice(0, MAX_SEARCH_LENGTH);
    const safeSearchRegex = new RegExp(escapeRegExp(normalizedSearch), 'i');
    filters.push({
      $or: [
        { motorNumber: { $regex: safeSearchRegex } },
        { chassisNumber: { $regex: safeSearchRegex } }
      ]
    });
  }

  const filter = { $and: filters };
  const sortOptions: Record<string, 1 | -1> = {};
  sortOptions[String(query.sort ?? 'dateAdded')] = query.order === 'asc' ? 1 : -1;

  const total = await BikeInventory.countDocuments(filter);
  const items = await BikeInventory.find(filter)
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNum)
    .populate('bikeModelId', 'name price is_ebicycle is_tricycle')
    .populate('addedBy', 'name email');

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  };
}

const POPULATED_ITEM = (query: ReturnType<typeof BikeInventory.findById>) =>
  query
    .populate('bikeModelId', 'name price is_ebicycle is_tricycle')
    .populate('addedBy', 'name email');

export async function getInventoryItem(ability: AppAbility, id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid inventory ID', 400);
  }

  const item = await POPULATED_ITEM(BikeInventory.findById(id)).populate(
    'billId',
    'billNumber customerName'
  );
  if (!item) throw new AppError('Inventory item not found', 404);
  if (!can(ability, 'read', 'Inventory', item)) {
    throw new AppError('You do not have permission to view this inventory item', 403);
  }
  return item;
}

export async function createInventory(
  ability: AppAbility,
  userId: string,
  data: Record<string, any>
) {
  if (!can(ability, 'create', 'Inventory')) {
    throw new AppError('You do not have permission to add inventory', 403);
  }

  const inventoryData: Record<string, any> = { ...data, addedBy: userId };

  if (!mongoose.Types.ObjectId.isValid(inventoryData.bikeModelId)) {
    throw new AppError('Invalid bike model ID', 400);
  }
  const bikeModel = await BikeModel.findById(inventoryData.bikeModelId);
  if (!bikeModel) throw new AppError('Bike model not found', 404);

  try {
    const created = await BikeInventory.create(inventoryData);
    return await POPULATED_ITEM(BikeInventory.findById(created._id));
  } catch (error) {
    throw mapInventoryWriteError(error, 'Failed to add to inventory');
  }
}

export async function batchCreateInventory(
  ability: AppAbility,
  userId: string,
  items: unknown
) {
  if (!can(ability, 'create', 'Inventory')) {
    throw new AppError('You do not have permission to add inventory', 403);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('No inventory items provided', 400);
  }

  const itemsWithUser: Record<string, any>[] = items.map(
    (item: Record<string, unknown>) => ({
      ...item,
      addedBy: userId
    })
  );

  const modelIds = [...new Set(itemsWithUser.map((item) => item.bikeModelId))];
  for (const modelId of modelIds) {
    if (!mongoose.Types.ObjectId.isValid(String(modelId))) {
      throw new AppError(`Invalid bike model ID: ${modelId}`, 400);
    }
    const bikeModel = await BikeModel.findById(modelId);
    if (!bikeModel) throw new AppError(`Bike model not found: ${modelId}`, 404);
  }

  try {
    const result = await BikeInventory.insertMany(itemsWithUser, {
      ordered: false
    });
    return result;
  } catch (error) {
    const err = error as { code?: number; writeErrors?: Array<{ err: { op: { motorNumber?: string; chassisNumber?: string } } }> };
    if (err.code === 11000 && err.writeErrors) {
      const duplicates = err.writeErrors.map(
        (e) => `Motor: ${e.err.op.motorNumber}, Chassis: ${e.err.op.chassisNumber}`
      );
      throw new AppError(`Duplicate entries found: ${duplicates.join('; ')}`, 400);
    }
    throw error;
  }
}

export async function updateInventoryItem(
  ability: AppAbility,
  id: string,
  updateData: Record<string, any>
) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid inventory ID', 400);
  }

  const existing = await BikeInventory.findById(id);
  if (!existing) throw new AppError('Inventory item not found', 404);
  if (!can(ability, 'update', 'Inventory', existing)) {
    throw new AppError('You do not have permission to update this inventory item', 403);
  }

  const payload = { ...updateData };
  // never allow changing who added the entry
  delete payload.addedBy;

  if (payload.status === BikeStatus.SOLD && !payload.dateSold) {
    payload.dateSold = new Date();
  }
  if (payload.status && payload.status !== BikeStatus.SOLD) {
    payload.dateSold = null;
  }

  try {
    const updated = await BikeInventory.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    });
    if (!updated) throw new AppError('Inventory item not found', 404);
    return await POPULATED_ITEM(BikeInventory.findById(updated._id));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw mapInventoryWriteError(error, 'Failed to update inventory');
  }
}

export async function softDeleteInventoryItem(
  ability: AppAbility,
  id: string,
  actor: { deletedBy?: string; reason?: string | null }
) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid inventory ID', 400);
  }

  const item = await BikeInventory.findById(id);
  if (!item) throw new AppError('Inventory item not found', 404);
  if (!can(ability, 'delete', 'Inventory', item)) {
    throw new AppError('You do not have permission to delete this inventory item', 403);
  }

  await BikeInventory.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: actor.deletedBy
        ? new mongoose.Types.ObjectId(actor.deletedBy)
        : null,
      deleteReason: actor.reason ?? null
    },
    { new: true }
  );

  return { message: 'Inventory item deleted successfully', softDeleted: true };
}

function mapInventoryWriteError(error: unknown, fallback: string): AppError {
  if (error instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(error.errors).map((e) => e.message);
    return new AppError(`Validation error: ${messages.join(', ')}`, 400);
  }
  if ((error as { code?: number }).code === 11000) {
    return new AppError(
      'A bike with this motor number or chassis number already exists in inventory',
      400
    );
  }
  return new AppError(`${fallback}: ${(error as Error).message}`, 500);
}
