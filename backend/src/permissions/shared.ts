/**
 * Frontend-safe barrel: everything here must stay dependency-free beyond
 * @casl/ability so the BROWSER can import the exact same source of truth
 * the backend enforces (frontend/src/permissions/index.ts aliases this file).
 * Backend-only code (@casl/mongoose, mongoose types) lives in query.ts and
 * is re-exported by index.ts, NOT here.
 */
export * from './actions.js';
export * from './subjects.js';
export * from './types.js';
export * from './rules.js';
export * from './check.js';
