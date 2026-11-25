/**
 * Identifier redaction and detection: invariants S3 (redact before text leaves the device) and S7 (validate before storage).
 *
 * Replaces each identifier with a placeholder: [email], [link], [id], [phone], [name].
 * Text already inside a placeholder is never touched again, so redacting twice gives the same result.
 *
 * This catches structured identifiers and names the user listed. It does NOT understand meaning.
 * Rewording sensitive context ("my roommate Li Na…" → "a conflict with a housemate") is the agent's job,
 * and that output is checked again here.
 */
export type IdentifierKind = 'email' | 'link' | 'id_number' | 'phone' | 'name';

export interface RedactOptions {
  /** Names the user never wants shared. This list stays on the device; the server calls without it. */
  doNotShare?: readonly string[];
}

export interface RedactionResult {
  text: string;
  /** Kinds that were found and replaced, unique and sorted. */
  found: IdentifierKind[];
}

const PLACEHOLDER_SOURCE = String.raw`\[(?:email|link|id|phone|name)\]`;
const SPLIT_ON_PLACEHOLDER = new RegExp(`(${PLACEHOLDER_SOURCE})`);
const EXACT_PLACEHOLDER = new RegExp(`^${PLACEHOLDER_SOURCE}$`);

const PLACEHOLDER_OF: Record<IdentifierKind, string> = {
  email: '[email]',
  link: '[link]',
  id_number: '[id]',
  phone: '[phone]',
  name: '[name]',
};

interface Detector {
  kind: IdentifierKind;
  pattern: RegExp;
  /** Optional extra check on a match, e.g. a digit count. */
  accept?: (match: string) => boolean;
}

const digitCount = (s: string) => (s.match(/\d/g) ?? []).length;

// Order matters: specific shapes run before the broad phone pattern.
const DETECTORS: Detector[] = [
  { kind: 'email', pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi },
  { kind: 'link', pattern: /\bhttps?:\/\/\S+|\bwww\.\S+/gi },
  // Malaysian IC number, e.g. 040101-14-5678.
  { kind: 'id_number', pattern: /\b\d{6}-\d{2}-\d{4}\b/g },
  // Student or staff ID: letters followed by digits, e.g. CST2504000.
  { kind: 'id_number', pattern: /\b[a-z]{2,5}\d{6,10}\b/gi },
  // Phone numbers have 9–15 digits. Dates like 2026-11-25 (8 digits) are left alone.
  { kind: 'phone', pattern: /\+?\d[\d\s-]{6,}\d/g, accept: (m) => digitCount(m) >= 9 && digitCount(m) <= 15 },
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasLatin = (s: string) => /[a-z]/i.test(s);

function nameDetectors(names: readonly string[] = []): Detector[] {
  return names
    .map((n) => n.trim())
    .filter((n) => n.length >= 2)
    .map((n) => ({
      kind: 'name' as const,
      // Latin names match whole words only, so "Li" does not hit "like". CJK names match as substrings.
      pattern: hasLatin(n) ? new RegExp(`\\b${escapeRegExp(n)}\\b`, 'gi') : new RegExp(escapeRegExp(n), 'g'),
    }));
}

/** Applies one detector to every part of the text that is not already a placeholder. */
function applyOutsidePlaceholders(text: string, d: Detector, found: Set<IdentifierKind>): string {
  return text
    .split(SPLIT_ON_PLACEHOLDER)
    .map((part) => {
      if (EXACT_PLACEHOLDER.test(part)) return part;
      return part.replace(d.pattern, (match) => {
        if (d.accept && !d.accept(match)) return match;
        found.add(d.kind);
        return PLACEHOLDER_OF[d.kind];
      });
    })
    .join('');
}

export function redactIdentifiers(text: string, options: RedactOptions = {}): RedactionResult {
  const found = new Set<IdentifierKind>();
  let out = text;
  for (const d of [...nameDetectors(options.doNotShare), ...DETECTORS]) {
    out = applyOutsidePlaceholders(out, d, found);
  }
  return { text: out, found: [...found].sort() };
}

/** Which identifier kinds a text contains. The S7 validator rejects approved text when this is non-empty. */
export function findIdentifiers(text: string, options: RedactOptions = {}): IdentifierKind[] {
  return redactIdentifiers(text, options).found;
}
