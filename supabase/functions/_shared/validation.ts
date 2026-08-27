/** Lightweight server-side input validation helpers (no external deps). */

export class ValidationError extends Error {}

export function requiredString(
  value: unknown,
  field: string,
  max = 200,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new ValidationError(`${field} is too long`);
  }
  return trimmed;
}

export function optionalString(
  value: unknown,
  field: string,
  max = 1000,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new ValidationError(`${field} is invalid`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ValidationError(`${field} is too long`);
  return trimmed;
}

const PHONE_RE = /^\+?[0-9\s()-]{7,20}$/;
export function optionalPhone(value: unknown, field: string): string | undefined {
  const s = optionalString(value, field, 20);
  if (s === undefined) return undefined;
  if (!PHONE_RE.test(s)) throw new ValidationError(`${field} format is invalid`);
  return s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function optionalEmail(value: unknown, field: string): string | undefined {
  const s = optionalString(value, field, 255);
  if (s === undefined) return undefined;
  if (!EMAIL_RE.test(s)) throw new ValidationError(`${field} format is invalid`);
  return s;
}

export function optionalNonNegativeNumber(
  value: unknown,
  field: string,
  max = 1_000_000_000_000,
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw new ValidationError(`${field} must be a valid positive number`);
  }
  return n;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function optionalUuid(value: unknown, field: string): string | undefined {
  const s = optionalString(value, field, 36);
  if (s === undefined) return undefined;
  if (!UUID_RE.test(s)) throw new ValidationError(`${field} must be a valid id`);
  return s;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
