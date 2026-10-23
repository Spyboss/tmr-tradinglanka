/**
 * Frontend view of the permission source of truth.
 *
 * This file does NOT hold rules — it aliases backend/src/permissions/shared.ts
 * so the browser evaluates the EXACT same matrix the API enforces.
 * (shared.ts is dependency-free by contract: only @casl/ability.)
 */
export * from '../../../backend/src/permissions/shared.js';
