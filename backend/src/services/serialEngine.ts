import mongoose from 'mongoose';
import InvoiceSequence from '../models/InvoiceSequence.js';

/**
 * Invoice serial engine — Gazette 2481/22 Annexure I (effective 1 Oct 2026
 * per Gazette 2500/106) + Circular SEC/2026/E/03.
 *
 * Format: YYMMM_QQQQ_XXXXX
 *   YY   – last two digits of the calendar year of issue
 *   MMM  – first three characters of the month, uppercase (JAN..DEC)
 *   QQQQ – classification code (branches/departments/units/invoice types),
 *          1-15 alphanumeric characters (Circular SEC/2026/E/03 s.4.4)
 *   XXXXX– numeric-only sequence, normally continuous; may restart at the
 *          beginning of a month or year (gazette 4.1.a.iv)
 *
 * Hard rules: no spaces anywhere, total length <= 40 characters.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

const QQQQ_PATTERN = /^[A-Za-z0-9]{1,15}$/;
const SERIAL_PATTERN = /^(\d{2})([A-Z]{3})_([A-Za-z0-9]{1,15})_(\d+)$/;
export const MAX_SERIAL_LENGTH = 40;
export const SEQUENCE_PADDING = 5;

export interface SerialParts {
  yy: string;
  month: string;
  code: string;
  sequence: number;
}

export class SerialFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SerialFormatError';
  }
}

export function monthCode(date: Date): string {
  const idx = date.getMonth();
  if (idx < 0 || idx > 11) throw new SerialFormatError(`Invalid date for serial: ${date.toISOString()}`);
  return MONTHS[idx];
}

export function validateClassificationCode(code: string): boolean {
  return typeof code === 'string' && QQQQ_PATTERN.test(code);
}

/**
 * Build a serial deterministically. Pure — used by issueSerial and by tests.
 */
export function buildSerial(date: Date, code: string, sequence: number): string {
  if (!validateClassificationCode(code)) {
    throw new SerialFormatError(
      `Classification code must be 1-15 alphanumeric characters, got "${code}"`
    );
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new SerialFormatError(`Sequence must be a positive integer, got ${sequence}`);
  }
  const yy = String(date.getFullYear()).slice(-2);
  const serial = `${yy}${monthCode(date)}_${code}_${String(sequence).padStart(SEQUENCE_PADDING, '0')}`;
  if (serial.length > MAX_SERIAL_LENGTH) {
    throw new SerialFormatError(`Serial exceeds ${MAX_SERIAL_LENGTH} characters: ${serial}`);
  }
  if (/\s/.test(serial)) {
    throw new SerialFormatError(`Serial must not contain spaces: ${serial}`);
  }
  return serial;
}

/**
 * Full validation of an issued or imported serial against the gazette rules.
 * Returns the parsed parts, or throws SerialFormatError.
 */
export function parseSerial(serial: string): SerialParts {
  if (typeof serial !== 'string' || serial.length === 0) {
    throw new SerialFormatError('Serial is required');
  }
  if (/\s/.test(serial)) {
    throw new SerialFormatError('Serial must not contain spaces');
  }
  if (serial.length > MAX_SERIAL_LENGTH) {
    throw new SerialFormatError(`Serial exceeds ${MAX_SERIAL_LENGTH} characters`);
  }
  const m = SERIAL_PATTERN.exec(serial);
  if (!m) {
    throw new SerialFormatError(
      `Serial must match YYMMM_QQQQ_XXXXX (digits, 3-letter month, 1-15 alnum code, numeric sequence): ${serial}`
    );
  }
  const [, yy, month, code, seq] = m;
  if (!(MONTHS as readonly string[]).includes(month)) {
    throw new SerialFormatError(`Unknown month code "${month}"`);
  }
  const sequence = Number(seq);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new SerialFormatError(`Invalid sequence "${seq}"`);
  }
  if (String(sequence).length > SEQUENCE_PADDING + 6) {
    throw new SerialFormatError('Sequence is implausibly long');
  }
  return { yy, month, code, sequence };
}

export function isValidSerial(serial: string): boolean {
  try {
    parseSerial(serial);
    return true;
  } catch {
    return false;
  }
}

/**
 * Atomically claim the next sequence for (code, month-of-date) and return the
 * finished serial. The $inc upsert is race-free; one document per code+period.
 *
 * Sequence restarts at 1 at the beginning of each month, which Gazette
 * 2481/22 4.1.a.iv explicitly permits.
 */
export async function issueSerial(date: Date, code: string, session?: mongoose.ClientSession): Promise<string> {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new SerialFormatError('issueSerial requires a valid Date');
  }
  if (!validateClassificationCode(code)) {
    throw new SerialFormatError(
      `Classification code must be 1-15 alphanumeric characters, got "${code}"`
    );
  }
  const period = `${String(date.getFullYear()).slice(-2)}${monthCode(date)}`;
  const doc = await InvoiceSequence.findOneAndUpdate(
    { code, period },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) }
  );
  if (!doc) throw new SerialFormatError('Failed to allocate invoice sequence');
  return buildSerial(date, code, doc.seq);
}
