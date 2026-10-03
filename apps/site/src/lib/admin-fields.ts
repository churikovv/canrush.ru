export function normalizeAdminEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function validateAdminEmail(value: string): string | null {
  const email = normalizeAdminEmail(value);
  if (email.length < 3 || email.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return null;
  return email;
}

export function normalizeAdminSearch(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 80) : '';
}
