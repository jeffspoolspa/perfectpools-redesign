// Input normalization helpers. Pure functions, no IO.

/**
 * Strip a phone number to last-10-digits. Returns undefined if fewer than 10
 * digits are present (treat as invalid). Matches existing edge-function behaviour.
 */
export function normalizePhone(input?: string | null): string | undefined {
  if (!input) return undefined;
  const digits = input.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : undefined;
}

/** Trim + collapse internal whitespace, return undefined if blank. */
export function cleanString(input?: string | null): string | undefined {
  if (input == null) return undefined;
  const trimmed = input.replace(/\s+/g, " ").trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/** Loose RFC-5322-ish email check; mirrors the existing edge function. */
export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

/** Truncate a zip to its 5-digit form. */
export function normalizeZip(input?: string | null): string | undefined {
  const cleaned = cleanString(input);
  if (!cleaned) return undefined;
  return cleaned.slice(0, 5);
}
