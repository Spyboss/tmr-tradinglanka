import { ForbiddenError } from '@casl/ability';
import type { Action } from './actions.js';
import type { Subject } from './subjects.js';
import type { AppAbility } from './types.js';

/**
 * Instance-level checks (is THIS bill editable by THIS user?).
 *
 * CASL v7 API note: can(action, subject, field?) — conditions are NOT a
 * positional argument anymore. Instead v7 matches a rule's conditions
 * AGAINST THE SUBJECT ITSELF, so for attribute-level checks we pass the
 * (normalized) resource with its subject type stamped on it
 * (__caslSubjectType__, CASL's documented ForcedSubject form).
 *
 * mongoose ObjectIds are stringified first because rule conditions hold
 * plain strings (ObjectId !== 'u1' under strict equality).
 */

function isObjectIdLike(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toHexString?: unknown }).toHexString === 'function'
  );
}

/** Shallow-normalize a resource: toObject() if mongoose doc, ObjectIds -> strings. */
export function asPlainResource(resource: unknown): unknown {
  if (resource === null || typeof resource !== 'object') return resource;

  const maybeDoc = resource as { toObject?: () => unknown };
  const source =
    typeof maybeDoc.toObject === 'function' ? maybeDoc.toObject() : resource;

  if (Array.isArray(source)) return source.map(asPlainResource);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    out[key] = isObjectIdLike(value) ? String(value) : value;
  }
  return out;
}

/** Type-level (no resource) or attribute-level (with resource) check. */
export function can(
  ability: AppAbility,
  action: Action,
  subject: Subject,
  resource?: unknown
): boolean {
  if (resource === undefined) return ability.can(action, subject);

  const plain = asPlainResource(resource);
  if (plain === null || typeof plain !== 'object') {
    return ability.can(action, subject);
  }

  return ability.can(action, {
    ...(plain as Record<string, unknown>),
    __caslSubjectType__: subject,
  } as never);
}

/**
 * Same as can() but throws CASL's ForbiddenError with statusCode 403
 * (the existing errorHandler.ts maps it via `err.statusCode || 500`).
 * Use inside services BEFORE any mutation or single-document read.
 */
export function assertCan(
  ability: AppAbility,
  action: Action,
  subject: Subject,
  resource?: unknown
): void {
  if (can(ability, action, subject, resource)) return;
  const error = ForbiddenError.from(ability);
  error.action = action;
  error.subject = subject;
  (error as unknown as { statusCode: number }).statusCode = 403;
  throw error;
}
