import { accessibleBy } from '@casl/mongoose';
import type { FilterQuery } from 'mongoose';
import type { Subject } from './subjects.js';
import type { AppAbility } from './types.js';

/**
 * Query-level ABAC: compile a subject's read rules into a MongoDB filter.
 * This is what keeps list endpoints fast and safe — Mongo returns ONLY the
 * rows the user may read; nothing is filtered in JS after the fact.
 *
 * @casl/mongoose v9: accessibleBy(ability, action).ofType(subject) returns
 * the filter; when the ability cannot read the subject AT ALL it returns a
 * never-match {$expr} sentinel — we surface that as `null` so services can
 * make an explicit 403-vs-empty decision.
 *
 * Usage in services:
 *   const where = readableWhere(ability, 'Bill');
 *   if (!where) throw forbidden;          // no read rules at all
 *   return Bill.find({ $and: [where, businessFilter] })...
 */
export type ReadableWhere = FilterQuery<Record<string, unknown>>;

export function readableWhere(
  ability: AppAbility,
  subject: Subject
): ReadableWhere | null {
  const where = accessibleBy(ability, 'read').ofType(subject) as
    | Record<string, unknown>
    | null
    | undefined;

  if (!where) return null;
  // @casl/mongoose signals "no access" with a {$expr: {$eq: [0, 1]}} sentinel
  if ('$expr' in where) return null;
  return where as ReadableWhere;
}
