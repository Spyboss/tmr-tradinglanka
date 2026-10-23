import Quotation from '../models/Quotation.js';
import Bill from '../models/Bill.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateQuotationPDF } from './quotationPdfService.js';
import { can, readableWhere } from '../permissions/index.js';
import type { AppAbility } from '../permissions/index.js';

/**
 * Quotation service — the ONLY place reading/writing quotations.
 * Authorization comes from the permissions source of truth (can() /
 * readableWhere), while error strings/status codes preserve the historic
 * route contract ({ error: ... } envelopes the frontend already parses).
 */

const MAX_SEARCH_LENGTH = 64;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface ListQuery {
  page?: unknown;
  limit?: unknown;
  status?: unknown;
  search?: unknown;
  type?: unknown;
  bikeRegNo?: unknown;
}

export async function listQuotations(ability: AppAbility, query: ListQuery) {
  const pageNum = parseInt(String(query.page ?? '1')) || 1;
  const limitNum = parseInt(String(query.limit ?? '20')) || 20;
  const skip = (pageNum - 1) * limitNum;

  const accessible = readableWhere(ability, 'Quotation');
  if (!accessible) {
    throw new AppError('You do not have permission to view quotations', 403);
  }

  const filters: Record<string, unknown>[] = [accessible];
  const extra: Record<string, unknown> = {};

  if (query.status) extra.status = query.status;
  if (query.type) extra.type = query.type;

  if (query.search) {
    const normalizedSearch = String(query.search).trim().slice(0, MAX_SEARCH_LENGTH);
    const safeSearchRegex = new RegExp(escapeRegExp(normalizedSearch), 'i');
    extra.$or = [
      { quotationNumber: { $regex: safeSearchRegex } },
      { customerName: { $regex: safeSearchRegex } },
      { claimNumber: { $regex: safeSearchRegex } },
      { bikeRegNo: { $regex: safeSearchRegex } }
    ];
  }

  if (query.bikeRegNo) {
    const normalizedBikeReg = String(query.bikeRegNo).trim().toUpperCase();
    extra.bikeRegNo = {
      $regex: new RegExp(`^${escapeRegExp(normalizedBikeReg)}$`, 'i')
    };
  }

  if (Object.keys(extra).length > 0) filters.push(extra);
  const filter = { $and: filters };

  const quotations = await Quotation.find(filter)
    .populate('referenceBillId', 'billNumber customerName')
    .sort({ quotationDate: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Quotation.countDocuments(filter);

  return {
    quotations,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  };
}

const POPULATE_FULL = 'billNumber customerName customerNIC customerAddress';
const POPULATE_BASIC = 'billNumber customerName';

async function loadAccessibleQuotation(
  ability: AppAbility,
  id: string,
  options: { populate?: string; action: 'read' | 'update' | 'delete'; denied: string }
) {
  let query = Quotation.findById(id);
  if (options.populate) query = query.populate(options.populate);
  const quotation = await query;

  if (!quotation) throw new AppError('Quotation not found', 404);
  if (!can(ability, options.action, 'Quotation', quotation)) {
    throw new AppError(options.denied, 403);
  }
  return quotation;
}

export function getQuotation(ability: AppAbility, id: string) {
  return loadAccessibleQuotation(ability, id, {
    populate: POPULATE_FULL,
    action: 'read',
    denied: 'You do not have permission to view this quotation'
  });
}

export async function getQuotationPdf(ability: AppAbility, id: string) {
  const quotation = await loadAccessibleQuotation(ability, id, {
    populate: POPULATE_BASIC,
    action: 'read',
    denied: 'You do not have permission to view this quotation'
  });
  const buffer = await generateQuotationPDF(quotation);
  return { buffer, filename: `GM_${quotation.type}_${quotation.quotationNumber}.pdf` };
}

export async function createQuotation(
  ability: AppAbility,
  ownerId: string,
  body: Record<string, any>
) {
  if (!can(ability, 'create', 'Quotation')) {
    throw new AppError('You do not have permission to create quotations', 403);
  }

  const quotationData = { ...body };
  quotationData.owner = ownerId;

  // pull customer data from the referenced bill when provided
  if (quotationData.referenceBillId) {
    const referenceBill = await Bill.findById(quotationData.referenceBillId);
    if (referenceBill) {
      quotationData.customerName = quotationData.customerName || referenceBill.customerName;
      quotationData.customerNIC = quotationData.customerNIC || referenceBill.customerNIC;
      quotationData.customerAddress = quotationData.customerAddress || referenceBill.customerAddress;
      quotationData.customerPhone = quotationData.customerPhone || referenceBill.customerPhone;
    }
  }

  if (
    !quotationData.customerName ||
    !quotationData.customerAddress ||
    !quotationData.items ||
    !quotationData.items.length
  ) {
    const error = new AppError('Missing required fields', 400);
    (error as AppError & { details?: string }).details =
      'Customer name, address, and at least one item are required';
    throw error;
  }

  for (const item of quotationData.items) {
    if (!item.description || !item.quantity || !item.rate) {
      const error = new AppError('Invalid item data', 400);
      (error as AppError & { details?: string }).details =
        'Each item must have a description, quantity, and rate';
      throw error;
    }
  }

  const quotation = new Quotation(quotationData);
  await quotation.save();
  return quotation;
}

export async function updateQuotation(
  ability: AppAbility,
  id: string,
  body: Record<string, unknown>
) {
  const quotation = await loadAccessibleQuotation(ability, id, {
    action: 'update',
    denied: 'You do not have permission to update this quotation'
  });

  const payload = { ...body };
  // owner reassignment is a type-level admin capability (users hold only
  // conditioned update rules -> their owner override is stripped)
  if (payload.owner !== undefined && !can(ability, 'update', 'Quotation')) {
    delete payload.owner;
  }

  Object.assign(quotation, payload);
  await quotation.save();

  return Quotation.findById(quotation._id).populate(
    'referenceBillId',
    'billNumber customerName'
  );
}

export async function deleteQuotation(ability: AppAbility, id: string) {
  await loadAccessibleQuotation(ability, id, {
    action: 'delete',
    denied: 'You do not have permission to delete this quotation'
  });
  await Quotation.findByIdAndDelete(id);
}

export async function convertToInvoice(
  ability: AppAbility,
  ownerId: string,
  id: string
) {
  const quotation = await loadAccessibleQuotation(ability, id, {
    action: 'update',
    denied: 'You do not have permission to convert this quotation'
  });

  if (quotation.type === 'invoice') {
    throw new AppError('This is already an invoice', 400);
  }

  const invoiceData = {
    ...quotation.toObject(),
    _id: undefined,
    quotationNumber: undefined, // auto-generated with INV prefix
    type: 'invoice',
    status: 'sent',
    remarks: quotation.remarks
      ? `${quotation.remarks}\n\nPayment should be made within 7 days of invoice date.`
      : 'Payment should be made within 7 days of invoice date.',
    owner: ownerId
  };

  const invoice = new Quotation(invoiceData);
  await invoice.save();

  quotation.status = 'converted';
  await quotation.save();

  return invoice;
}

/** Customer suggestions from bills — bill readability scoped (admin: all). */
export async function suggestCustomers(ability: AppAbility, search: unknown) {
  const accessible = readableWhere(ability, 'Bill');
  if (!accessible) {
    throw new AppError('You do not have permission to view bills', 403);
  }

  const filters: Record<string, unknown>[] = [accessible];
  if (search) {
    const normalizedSearch = String(search).trim().slice(0, MAX_SEARCH_LENGTH);
    const safeSearchRegex = new RegExp(escapeRegExp(normalizedSearch), 'i');
    filters.push({
      $or: [
        { customerName: { $regex: safeSearchRegex } },
        { customerNIC: { $regex: safeSearchRegex } }
      ]
    });
  }

  return Bill.find({ $and: filters })
    .select('_id billNumber customerName customerNIC customerAddress customerPhone')
    .limit(10)
    .sort({ createdAt: -1 });
}
