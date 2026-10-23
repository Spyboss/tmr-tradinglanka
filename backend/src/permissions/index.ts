/**
 * Backend barrel: shared rules + server-only wiring (Mongo query
 * compilation, per-request ability resolution, route middleware).
 * The frontend imports ./shared.js only.
 */
export * from './shared.js';
export * from './query.js';
export * from './resolve.js';
export * from './require-permission.js';
