/**
 * IC-OS PII Masking Library
 * Core personally identifiable information (PII) masking functions
 * for compliance with CBUAE data protection and confidentiality requirements.
 *
 * Provides field-level masking for names, IDs, account numbers, and
 * other sensitive data elements per FDL 10/2025 Art. 12 and
 * CBUAE Notice 3551/2021.
 *
 * v7.2 — Enhanced with GCC-specific regex patterns, sanitizeObject()
 * recursive traversal, and role-based response masking.
 */

// ─── GCC-Specific Regex Patterns ──────────────────────────────────────────────

/** UAE Emirates ID: 784-YYYY-NNNNNNN-C (15 digits with dashes) */
const EMIRATES_ID_REGEX = /^784-\d{4}-\d{7}-\d$/;

/** GCC National ID patterns (Bahrain, Kuwait, Oman, Qatar, Saudi, UAE) */
const GCC_ID_REGEX = /^\d{7,10}$/;

/** IBAN (UAE and GCC): starts with AE or other GCC country code, up to 34 chars */
const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/;

/** UAE Phone: +971 or 971 followed by 9 digits, or 05X followed by 7 digits */
const UAE_PHONE_REGEX = /^(\+971|971|0)([23567])(\d{8})$/;

/** Email pattern */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Passport: alphanumeric, 6-12 chars */
const PASSPORT_REGEX = /^[A-Z0-9]{6,12}$/i;

// ─── Field Name → Masking Strategy Mapping ────────────────────────────────────

/**
 * Maps field name patterns to their appropriate masking function.
 * Used by sanitizeObject() for automatic field detection.
 */
const FIELD_MASK_MAP: Array<{ pattern: RegExp; masker: (value: string) => string }> = [
  // Emirates ID / National ID patterns
  { pattern: /emiratesid|emirates_id|nationalid|national_id/i, masker: maskEmiratesId },
  // Passport patterns
  { pattern: /passport|passportno|passport_no/i, masker: maskPassport },
  // IBAN / Bank Account patterns
  { pattern: /iban|bankaccount|bank_account|accountno|account_no|payoutbank/i, masker: maskIBAN },
  // Phone patterns
  { pattern: /phone|mobile|telephone|phonenumber|phone_number|contactnumber/i, masker: maskPhone },
  // Email patterns
  { pattern: /email|emailaddress|email_address/i, masker: maskEmail },
  // Name patterns
  { pattern: /legalname|legal_name|fullname|full_name|claimantname|claimant_name|subjectname|subject_name|assignedto|assigned_to|createdby|created_by|owner|username|user_name/i, masker: maskName },
  // Trade License patterns
  { pattern: /tradelicense|trade_license|tradelicenseno/i, masker: maskTradeLicense },
  // TRN patterns
  { pattern: /trn|taxregistration|tax_registration/i, masker: maskTRN },
  // Address patterns
  { pattern: /address|street|building/i, masker: maskAddress },
  // Amount patterns (mask for external/auditor, keep for internal)
  { pattern: /amount|balance|value/i, masker: (v: string) => maskAmount(Number(v)) },
  // UBO details — highly sensitive
  { pattern: /ubodetails|ubo_details|uboPercentage/i, masker: maskFull },
  // Wallet address patterns (VASP)
  { pattern: /walletaddress|wallet_address/i, masker: maskAccountNumber },
  // Aliases / AKA
  { pattern: /aliases|aka|knownas/i, masker: maskFull },
  // Identifiers (sanctions)
  { pattern: /identifiers/i, masker: maskFull },
];

// ─── Masking Utility Functions ──────────────────────────────────────────────────

/**
 * Mask a string value, showing only the first `visibleChars` characters
 * and replacing the rest with asterisks.
 *
 * Example: maskPartial("ABCD1234", 2) → "AB******"
 */
export function maskPartial(value: string, visibleChars: number = 2): string {
  if (!value || value.length === 0) return '***';
  if (value.length <= visibleChars) return value + '***';
  return value.slice(0, visibleChars) + '*'.repeat(Math.min(value.length - visibleChars, 8));
}

/**
 * Mask a name value, showing only initials.
 *
 * Example: maskName("Mohammed Ahmed Al-Rashid") → "M.A.A."
 */
export function maskName(name: string): string {
  if (!name || name.length === 0) return '***';
  const parts = name.split(/\s+/);
  return parts.map((p) => p.charAt(0).toUpperCase() + '.').join(' ');
}

/**
 * Mask an Emirates ID or GCC National ID with strict format compliance.
 * UAE format: 784-XXXX-XXXXXXX-X → 784-****-XXXX***-X
 * Generic GCC: Show only first 2 and last 2 digits.
 *
 * Examples:
 *   maskEmiratesId("784-1990-1234567-1") → "784-****-****567-1"
 *   maskEmiratesId("784199012345671")     → "784-****-****567-1"
 */
export function maskEmiratesId(id: string): string {
  if (!id || id.length === 0) return '***';

  // Try formatted UAE Emirates ID: 784-YYYY-NNNNNNN-C
  const formatted = id.replace(/[-\s]/g, '');
  if (/^784\d{12}$/.test(formatted)) {
    // 784 (3) + YYYY (4) + NNNNNNN (7) + C (1) = 15 digits
    return `${formatted.slice(0, 3)}-****-****${formatted.slice(10, 13)}-${formatted.slice(14)}`;
  }

  // Generic GCC ID — show first 2 and last 2
  if (formatted.length >= 6) {
    return formatted.slice(0, 2) + '*'.repeat(formatted.length - 4) + formatted.slice(-2);
  }

  return '***';
}

/**
 * Mask a passport number, showing only the last 3 characters.
 * GCC passports are alphanumeric (6-12 chars).
 *
 * Example: maskPassport("A12345678") → "******678"
 */
export function maskPassport(passport: string): string {
  if (!passport || passport.length === 0) return '***';
  if (passport.length <= 3) return '***';
  return '*'.repeat(passport.length - 3) + passport.slice(-3);
}

/**
 * Mask an IBAN or bank account number, showing only the last 4 digits.
 * UAE IBAN format: AEXX XXXX XXXX XXXX XXXX XXX (23 chars)
 *
 * Example: maskIBAN("AE070331234567890123456") → "*******************3456"
 */
export function maskIBAN(iban: string): string {
  if (!iban || iban.length === 0) return '***';
  if (iban.length <= 4) return '***';
  // Show country code + check digits + mask the rest, show last 4
  const countryCode = iban.slice(0, 2);
  const checkDigits = iban.slice(2, 4);
  return `${countryCode}${checkDigits}${'*'.repeat(iban.length - 8)}${iban.slice(-4)}`;
}

/**
 * Mask a phone number with GCC/UAE format awareness.
 * UAE: +971-XX-XXX-XXXX → +971-XX-***-XXXX (show country code + last 4)
 *
 * Example: maskPhone("+971501234567") → "+971-***-**4567"
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length === 0) return '***';
  if (phone.length <= 6) return '***';

  // UAE format: +971 or 971 prefix
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (/^\+?971/.test(cleaned)) {
    const prefix = cleaned.startsWith('+') ? '+971' : '971';
    const remaining = cleaned.slice(prefix.length);
    if (remaining.length >= 7) {
      return `${prefix}-***-**${remaining.slice(-4)}`;
    }
  }

  // Generic: show first 3 and last 2
  return phone.slice(0, 3) + '***' + phone.slice(-2);
}

/**
 * Mask an email address, showing only the first character and domain.
 *
 * Example: maskEmail("ahmed@company.ae") → "a***@company.ae"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  return local.charAt(0) + '***@' + domain;
}

/**
 * Mask a bank account number, showing only the last 4 digits.
 * Alias for maskIBAN for backward compatibility.
 *
 * Example: maskAccountNumber("AE070331234567890123456") → "AE07***************3456"
 */
export function maskAccountNumber(account: string): string {
  if (!account || account.length === 0) return '***';
  if (account.length <= 4) return '***';
  // If it looks like an IBAN, use IBAN masking
  if (IBAN_REGEX.test(account.replace(/\s/g, ''))) {
    return maskIBAN(account);
  }
  return '*'.repeat(account.length - 4) + account.slice(-4);
}

/**
 * Mask a trade license number, showing only the first 3 characters.
 *
 * Example: maskTradeLicense("CN-123456") → "CN-****"
 */
export function maskTradeLicense(license: string): string {
  return maskPartial(license, 3);
}

/**
 * Mask a TRN (Tax Registration number), showing only the first 3 digits.
 *
 * Example: maskTRN("100123456700003") → "100**********3"
 */
export function maskTRN(trn: string): string {
  if (!trn || trn.length === 0) return '***';
  if (trn.length <= 4) return '***';
  return trn.slice(0, 3) + '*'.repeat(trn.length - 4) + trn.slice(-1);
}

/**
 * Mask an amount value, replacing with a range indicator.
 *
 * Example: maskAmount(55000) → "AED **,***"
 */
export function maskAmount(amount: number): string {
  if (amount === 0) return 'AED 0';
  return 'AED **,***';
}

/**
 * Mask an address, showing only the city/emirate.
 *
 * Example: maskAddress("123 Sheikh Zayed Road, Dubai") → "***, Dubai"
 */
export function maskAddress(address: string): string {
  if (!address || address.length === 0) return '***';
  const parts = address.split(',');
  if (parts.length <= 1) return '***';
  return '***, ' + parts[parts.length - 1].trim();
}

/**
 * Full mask — replaces the entire value with asterisks.
 * Used for highly sensitive fields where even partial visibility is prohibited.
 */
export function maskFull(_value: string): string {
  return '********';
}

/**
 * No-op mask — returns the value unchanged.
 * Used for fields that are always visible.
 */
export function maskNone(value: string): string {
  return value;
}

// ─── Generic / Recursive Masking ──────────────────────────────────────────────

/**
 * Mask a generic string value — auto-detects the type using regex patterns.
 * Falls back to maskPartial for unrecognized values.
 */
export function maskGeneric(value: string): string {
  if (!value || value.length === 0) return '***';

  // Try pattern-based detection
  if (EMIRATES_ID_REGEX.test(value) || /^784\d{12}$/.test(value.replace(/[-\s]/g, ''))) {
    return maskEmiratesId(value);
  }
  if (IBAN_REGEX.test(value.replace(/\s/g, ''))) {
    return maskIBAN(value);
  }
  if (UAE_PHONE_REGEX.test(value.replace(/[\s\-()]/g, ''))) {
    return maskPhone(value);
  }
  if (EMAIL_REGEX.test(value)) {
    return maskEmail(value);
  }
  if (PASSPORT_REGEX.test(value)) {
    return maskPassport(value);
  }

  // Default: show first 2 chars
  return maskPartial(value);
}

// ─── sanitizeObject: Recursive PII Traversal ─────────────────────────────────

/**
 * Recursively traverse an object or array and apply PII masking to fields
 * that match known sensitive field name patterns.
 *
 * @param obj - The object or array to sanitize (can be any nested structure)
 * @param fieldsToMask - Optional explicit list of field names to mask.
 *                       If provided, ONLY these fields are masked.
 *                       If omitted, auto-detection via FIELD_MASK_MAP is used.
 * @param depth - Internal recursion depth guard (max 10 levels)
 * @returns A new object with PII fields masked (original is not mutated)
 *
 * @example
 * sanitizeObject({ legalName: "Mohammed Ahmed", emiratesId: "784-1990-1234567-1" })
 * // → { legalName: "M.A.", emiratesId: "784-****-****567-1" }
 *
 * @example
 * sanitizeObject({ name: "John", email: "john@co.ae" }, ["email"])
 * // → { name: "John", email: "j***@co.ae" }
 */
export function sanitizeObject<T>(
  obj: T,
  fieldsToMask?: string[],
  depth: number = 0
): T {
  // Depth guard to prevent infinite recursion on circular refs
  if (depth > 10) return obj;

  // Handle null/undefined
  if (obj == null) return obj;

  // Handle primitive types — no masking at leaf level
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  // Handle arrays — recursively sanitize each element
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, fieldsToMask, depth + 1)) as T;
  }

  // Handle Date objects — preserve them as ISO strings
  if (obj instanceof Date) {
    return obj.toISOString() as T;
  }

  // Handle objects — traverse each key
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value == null) {
        result[key] = value;
        continue;
      }

      const shouldMask = fieldsToMask
        ? fieldsToMask.some((f) => key.toLowerCase() === f.toLowerCase() || key.toLowerCase().includes(f.toLowerCase()))
        : FIELD_MASK_MAP.some(({ pattern }) => pattern.test(key));

      if (shouldMask && typeof value === 'string') {
        // Find the specific masker for this field name
        const masker = fieldsToMask
          ? maskGeneric // When explicit fields are specified, use generic auto-detection
          : (FIELD_MASK_MAP.find(({ pattern }) => pattern.test(key))?.masker ?? maskGeneric);
        result[key] = masker(value);
      } else if (shouldMask && typeof value === 'number') {
        // Numeric PII fields (amounts, scores)
        result[key] = maskAmount(value);
      } else if (value instanceof Date) {
        // Preserve Date objects as ISO strings
        result[key] = value.toISOString();
      } else if (typeof value === 'object') {
        // Recurse into nested objects/arrays
        result[key] = sanitizeObject(value, fieldsToMask, depth + 1);
      } else {
        // Non-PII, non-object — pass through
        result[key] = value;
      }
    }
    return result as T;
  }

  return obj;
}

// ─── maskObject: Convenience Wrapper ──────────────────────────────────────────

/**
 * Mask an object using the same logic as sanitizeObject but with
 * a simpler API — just pass the object and it auto-detects all PII fields.
 *
 * Alias for sanitizeObject(obj) with no explicit field list.
 */
export function maskObject<T>(obj: T): T {
  return sanitizeObject(obj);
}

// ─── Role-Based Response Masking ──────────────────────────────────────────────

/**
 * Roles that require aggressive PII masking in all responses.
 * These are typically external-facing or restricted-access roles.
 */
const MASKED_ROLES = new Set(['auditor', 'external', 'readonly', 'board']);

/**
 * Roles that need full PII access for investigation workflows.
 * These users see unmasked data in detail/edit views.
 */
const UNMASKED_ROLES = new Set(['admin', 'mlro', 'compliance_manager', 'compliance_officer']);

/**
 * Role-based PII masking for API responses.
 *
 * Strategy:
 * - auditor/external/readonly: Aggressively mask ALL PII fields
 * - compliance_officer/mlro/admin: Leave PII intact for investigation workflows
 * - Unknown roles: Apply masking by default (fail-safe)
 *
 * @param data - The response data to potentially mask
 * @param userRole - The role of the requesting user
 * @param isListView - Whether this is a list/table view (vs. detail/edit view).
 *                     In list views, even compliance roles get PII masked.
 * @returns The data, with PII masked if appropriate for the role
 */
export function maskResponsePII<T>(
  data: T,
  userRole: string,
  isListView: boolean = false
): T {
  // If user has a masked role, always apply aggressive masking
  if (MASKED_ROLES.has(userRole)) {
    return sanitizeObject(data);
  }

  // If this is a list/table view, mask PII for all roles
  // (detail/edit views remain unmasked for authorized roles)
  if (isListView) {
    return sanitizeObject(data);
  }

  // If user has an unmasked role and this is a detail view, leave intact
  if (UNMASKED_ROLES.has(userRole)) {
    return data;
  }

  // Unknown roles: fail-safe — apply masking
  return sanitizeObject(data);
}

/**
 * List of field names that should be masked in list/table views
 * even for authorized roles. This provides a "need-to-know" approach
 * for list/table views where full PII is unnecessary.
 */
export const LIST_VIEW_PII_FIELDS = [
  'emiratesId',
  'passportNo',
  'payoutBankAccount',
  'uboDetails',
  'walletAddress',
  'aliases',
  'identifiers',
  'trn',
  'email',
  'phone',
  'address',
];

/**
 * Mask PII in list/table view data for authorized roles.
 * Only masks the most sensitive fields (IDs, accounts, contacts),
 * keeping names and business data visible for operational efficiency.
 */
export function maskListPII<T>(data: T): T {
  return sanitizeObject(data, LIST_VIEW_PII_FIELDS);
}

// ─── Text-based PII Stripping ─────────────────────────────────────────────────

/**
 * Strip PII from plain text strings (e.g., AI chat responses).
 * Uses regex to find and replace known PII patterns inline.
 *
 * This is the last line of defense: if the LLM somehow includes
 * a real Emirates ID, passport number, or bank account in its
 * response, this function will mask it before the text reaches
 * the user.
 *
 * @param text - The text to sanitize
 * @returns Text with any detected PII patterns masked
 */
export function stripPIIFromText(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  // Mask Emirates IDs: 784-YYYY-NNNNNNN-C (with or without dashes)
  result = result.replace(
    /784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d/g,
    (match) => maskEmiratesId(match)
  );

  // Mask IBANs: AE + 2 check digits + up to 19 alphanumeric (with or without spaces)
  result = result.replace(
    /\bAE\d{2}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{0,7}\b/gi,
    (match) => maskIBAN(match.replace(/\s/g, ''))
  );

  // Mask UAE phone numbers: +971XXXXXXXXX or 05XXXXXXXX
  result = result.replace(
    /(?:\+?971|0)(?:5[024567]|2|3|4|6|7|9)\d{7}\b/g,
    (match) => maskPhone(match)
  );

  // Mask email addresses
  result = result.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    (match) => maskEmail(match)
  );

  // Mask passport-like numbers: capital letter + 7-8 digits
  result = result.replace(
    /\b[A-Z]\d{7,8}\b/g,
    (match) => maskPassport(match)
  );

  return result;
}
