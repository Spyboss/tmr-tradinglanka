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

/**
 * Merge a readableWhere() result into a route/service's own filter object.
 *
 * accessibleBy() wraps conditioned rules as { $or: [ ... ] }. For the
 * common single-condition scope (owner/addedBy/userId) this flattens it so
 * it composes with the caller's top-level filters — in particular a search
 * `$or`, which would otherwise OVERWRITE a $or-shaped owner scope and
 * silently widen the query. Complex rule shapes go under `$and`, where they
 * always AND safely.
 *
 *   const filter: any = {};
 *   mergeReadableFilter(filter, readableWhere(ability, 'Bill') ?? {});
 *   if (search) filter.$or = [...];   // never clobbers the scope
 */
export function mergeReadableFilter(
  filter: Record<string, unknown>,
  readable: ReadableWhere | Record<string, unknown>
): void {
  const shape = readable as Record<string, unknown>;
  const keys = Object.keys(shape);
  if (keys.length === 0) return;

  const inner =
    keys.length === 1 && keys[0] === '$or' && Array.isArray(shape.$or)
      ? (shape.$or as Record<string, unknown>[])
      : null;
  if (
    inner &&
    inner.length === 1 &&
    !Object.keys(inner[0] ?? {}).some((key) => key.startsWith('$'))
  ) {
    Object.assign(filter, inner[0]);
    return;
  }

  filter.$and = [...((filter.$and as unknown[]) ?? []), shape];
}
