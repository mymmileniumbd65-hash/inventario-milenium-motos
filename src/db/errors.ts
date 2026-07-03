// Postgres error code for a unique constraint / unique index violation.
// drizzle-orm wraps the raw pg error in a DrizzleQueryError, nesting the
// actual Postgres error (with its `code`) at `.cause` rather than top-level.
function pgCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  if ('code' in err && typeof (err as { code?: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  if ('cause' in err) return pgCode((err as { cause?: unknown }).cause);
  return undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return pgCode(err) === '23505';
}
