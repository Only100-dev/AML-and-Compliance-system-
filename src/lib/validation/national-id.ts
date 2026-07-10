/**
 * IC-OS National ID Validator
 * Phase 6: Multi-jurisdiction GCC ID format validation
 *
 * Validates identity document formats for all 6 GCC countries + passport.
 * Every country has its own ID format and validation rules.
 * The schema must support all formats without losing validation integrity.
 * Never store invalid IDs.
 *
 * Principle B: Identity is jurisdiction-specific.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type NationalIdType =
  | 'EMIRATES_ID'
  | 'SAUDI_ID'
  | 'IQAMA'
  | 'BAHRAINI_CPR'
  | 'QATARI_ID'
  | 'OMANI_CIVIL_ID'
  | 'KUWAITI_CIVIL_ID'
  | 'PASSPORT'
  | 'RESIDENCE_PERMIT'
  | 'OTHER';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized: string;
}

// ─── National ID Type Metadata ────────────────────────────────────────────────

export interface NationalIdTypeMetadata {
  label: string;
  jurisdiction: string;
  placeholder: string;
  example: string;
  description: string;
}

/**
 * Human-readable metadata for each national ID type.
 * Used by frontend components to display jurisdiction-specific
 * placeholders, examples, and help text.
 */
export const NATIONAL_ID_TYPE_METADATA: Record<NationalIdType, NationalIdTypeMetadata> = {
  EMIRATES_ID: {
    label: 'Emirates ID',
    jurisdiction: 'CBUAE',
    placeholder: '784-YYYY-NNNNNNN-X',
    example: '784-1990-1234567-1',
    description: 'UAE identity card: 784-YYYY-7-digit sequence-check digit (15 digits total)',
  },
  SAUDI_ID: {
    label: 'Saudi National ID',
    jurisdiction: 'SAMA',
    placeholder: '10 digits (starts with 1 or 2)',
    example: '1234567890',
    description: 'Saudi Arabian national ID: 10 digits, first digit is 1 (citizen) or 2 (citizen)',
  },
  IQAMA: {
    label: 'Iqama (Residency ID)',
    jurisdiction: 'SAMA',
    placeholder: '10 digits',
    example: '2345678901',
    description: 'Saudi Arabian residency permit for expatriates: 10 digits',
  },
  BAHRAINI_CPR: {
    label: 'Bahraini CPR',
    jurisdiction: 'CBB',
    placeholder: '9 digits',
    example: '123456789',
    description: 'Bahrain Central Population Registration number: 9 digits',
  },
  QATARI_ID: {
    label: 'Qatar ID',
    jurisdiction: 'QCB',
    placeholder: '11 digits',
    example: '12345678901',
    description: 'Qatar identity card number: 11 digits',
  },
  OMANI_CIVIL_ID: {
    label: 'Omani Civil ID',
    jurisdiction: 'CBOA',
    placeholder: '8 digits',
    example: '12345678',
    description: 'Oman civil number: 8 digits',
  },
  KUWAITI_CIVIL_ID: {
    label: 'Kuwaiti Civil ID',
    jurisdiction: 'CBK',
    placeholder: '12 digits',
    example: '123456789012',
    description: 'Kuwait civil ID number: 12 digits',
  },
  PASSPORT: {
    label: 'Passport',
    jurisdiction: 'ALL',
    placeholder: 'Alphanumeric (6-20 chars)',
    example: 'A12345678',
    description: 'International passport number: alphanumeric, 6-20 characters',
  },
  RESIDENCE_PERMIT: {
    label: 'Residence Permit',
    jurisdiction: 'ALL',
    placeholder: 'As per issuing country',
    example: 'N/A',
    description: 'Generic residence permit — format varies by issuing country',
  },
  OTHER: {
    label: 'Other ID',
    jurisdiction: 'ALL',
    placeholder: 'As applicable',
    example: 'N/A',
    description: 'Fallback for any other identity document type',
  },
};

/**
 * Map jurisdiction code to available ID types for that jurisdiction.
 * Used by the frontend to filter the ID type dropdown based on
 * the selected jurisdiction.
 */
export const JURISDICTION_ID_TYPES: Record<string, NationalIdType[]> = {
  CBUAE: ['EMIRATES_ID', 'PASSPORT', 'RESIDENCE_PERMIT', 'OTHER'],
  SAMA: ['SAUDI_ID', 'IQAMA', 'PASSPORT', 'RESIDENCE_PERMIT', 'OTHER'],
  CBB: ['BAHRAINI_CPR', 'PASSPORT', 'RESIDENCE_PERMIT', 'OTHER'],
  QCB: ['QATARI_ID', 'PASSPORT', 'RESIDENCE_PERMIT', 'OTHER'],
  CBOA: ['OMANI_CIVIL_ID', 'PASSPORT', 'RESIDENCE_PERMIT', 'OTHER'],
  CBK: ['KUWAITI_CIVIL_ID', 'PASSPORT', 'RESIDENCE_PERMIT', 'OTHER'],
};

// ─── Validation Functions ──────────────────────────────────────────────────────

/**
 * Validate a national ID based on its type.
 *
 * Each GCC country has strict format rules:
 * - UAE Emirates ID: 784-YYYY-NNNNNNN-X (with or without dashes)
 * - Saudi National ID: 10 digits, starts with 1 or 2
 * - Iqama (KSA expat): 10 digits
 * - Bahraini CPR: 9 digits
 * - Qatari ID: 11 digits
 * - Omani Civil ID: 8 digits
 * - Kuwaiti Civil ID: 12 digits
 * - Passport: alphanumeric, 6-20 chars
 * - Residence Permit / Other: no strict validation
 *
 * @param id - The ID string to validate
 * @param type - The NationalIdType enum value
 * @returns ValidationResult with valid flag, errors, and normalized ID
 */
export function validateNationalId(id: string, type: NationalIdType): ValidationResult {
  if (!id || id.trim().length === 0) {
    return { valid: false, errors: ['ID is required'], normalized: '' };
  }

  const errors: string[] = [];
  const normalized = id.trim().replace(/-/g, '');

  switch (type) {
    case 'EMIRATES_ID': {
      // UAE Emirates ID: 784-YYYY-NNNNNNN-X
      // With dashes: 784-1990-1234567-1 (15 digits)
      // Without dashes: 784199012345671 (15 digits)
      const withDashes = /^784-\d{4}-\d{7}-\d$/.test(id.trim());
      const withoutDashes = /^784\d{12}$/.test(normalized);

      if (!withDashes && !withoutDashes) {
        errors.push(
          'Emirates ID must match format 784-YYYY-NNNNNNN-X (e.g., 784-1990-1234567-1) or 15 digits starting with 784'
        );
      }

      // Return with standard dashed format if valid
      if (withoutDashes && !withDashes) {
        return {
          valid: true,
          errors: [],
          normalized: `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7, 14)}-${normalized.slice(14)}`,
        };
      }

      return { valid: withDashes || withoutDashes, errors, normalized: id.trim() };
    }

    case 'SAUDI_ID': {
      // Saudi National ID: 10 digits, starts with 1 or 2
      if (!/^[12]\d{9}$/.test(normalized)) {
        errors.push('Saudi National ID must be 10 digits starting with 1 or 2');
      }
      return { valid: errors.length === 0, errors, normalized };
    }

    case 'IQAMA': {
      // Saudi Iqama: 10 digits
      if (!/^\d{10}$/.test(normalized)) {
        errors.push('Iqama must be exactly 10 digits');
      }
      return { valid: errors.length === 0, errors, normalized };
    }

    case 'BAHRAINI_CPR': {
      // Bahrain CPR: 9 digits
      if (!/^\d{9}$/.test(normalized)) {
        errors.push('Bahraini CPR must be exactly 9 digits');
      }
      return { valid: errors.length === 0, errors, normalized };
    }

    case 'QATARI_ID': {
      // Qatar ID: 11 digits
      if (!/^\d{11}$/.test(normalized)) {
        errors.push('Qatari ID must be exactly 11 digits');
      }
      return { valid: errors.length === 0, errors, normalized };
    }

    case 'OMANI_CIVIL_ID': {
      // Oman Civil ID: 8 digits
      if (!/^\d{8}$/.test(normalized)) {
        errors.push('Omani Civil ID must be exactly 8 digits');
      }
      return { valid: errors.length === 0, errors, normalized };
    }

    case 'KUWAITI_CIVIL_ID': {
      // Kuwait Civil ID: 12 digits
      if (!/^\d{12}$/.test(normalized)) {
        errors.push('Kuwaiti Civil ID must be exactly 12 digits');
      }
      return { valid: errors.length === 0, errors, normalized };
    }

    case 'PASSPORT': {
      // Passport: alphanumeric, 6-20 characters
      const upper = normalized.toUpperCase();
      if (!/^[A-Z0-9]{6,20}$/.test(upper)) {
        errors.push('Passport number must be 6-20 alphanumeric characters');
      }
      return { valid: errors.length === 0, errors, normalized: upper };
    }

    case 'RESIDENCE_PERMIT':
    case 'OTHER': {
      // Generic: accept any non-empty string (3+ chars for basic sanity)
      if (normalized.length < 3) {
        errors.push('ID must be at least 3 characters');
      }
      return { valid: errors.length === 0, errors, normalized };
    }

    default: {
      return { valid: true, errors: [], normalized };
    }
  }
}

/**
 * Auto-detect the National ID type based on the ID value and jurisdiction.
 * Used as a fallback when the user hasn't explicitly selected a type.
 *
 * Detection logic:
 * 1. Starts with 784 → EMIRATES_ID
 * 2. 10 digits starting with 1 or 2 → SAUDI_ID
 * 3. 10 digits (not starting with 1/2) → IQAMA
 * 4. 9 digits → BAHRAINI_CPR
 * 5. 11 digits → QATARI_ID
 * 6. 8 digits → OMANI_CIVIL_ID
 * 7. 12 digits → KUWAITI_CIVIL_ID
 * 8. Alphanumeric 6-20 chars → PASSPORT
 * 9. Fallback → OTHER
 */
export function detectNationalIdType(id: string, jurisdiction?: string): NationalIdType {
  if (!id) return 'OTHER';

  const normalized = id.trim().replace(/-/g, '');

  // UAE Emirates ID — always starts with 784
  if (/^784/.test(normalized) && /^\d{15}$/.test(normalized)) {
    return 'EMIRATES_ID';
  }

  // If jurisdiction is specified, use it to narrow down
  if (jurisdiction) {
    const jurTypes = JURISDICTION_ID_TYPES[jurisdiction];
    if (jurTypes && jurTypes.length > 0) {
      // Try each type for the jurisdiction
      for (const type of jurTypes) {
        const result = validateNationalId(id, type);
        if (result.valid && type !== 'PASSPORT' && type !== 'RESIDENCE_PERMIT' && type !== 'OTHER') {
          return type;
        }
      }
    }
  }

  // Generic detection without jurisdiction
  if (/^[12]\d{9}$/.test(normalized)) return 'SAUDI_ID';
  if (/^\d{10}$/.test(normalized)) return 'IQAMA';
  if (/^\d{9}$/.test(normalized)) return 'BAHRAINI_CPR';
  if (/^\d{11}$/.test(normalized)) return 'QATARI_ID';
  if (/^\d{8}$/.test(normalized)) return 'OMANI_CIVIL_ID';
  if (/^\d{12}$/.test(normalized)) return 'KUWAITI_CIVIL_ID';
  if (/^[A-Z0-9]{6,20}$/i.test(normalized)) return 'PASSPORT';

  return 'OTHER';
}

/**
 * Format a national ID for display based on its type.
 * Adds standard dashes/separators for known formats.
 */
export function formatNationalId(id: string, type: NationalIdType): string {
  if (!id) return '';
  const normalized = id.trim().replace(/-/g, '');

  switch (type) {
    case 'EMIRATES_ID': {
      if (normalized.length === 15) {
        return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7, 14)}-${normalized.slice(14)}`;
      }
      return id;
    }
    default:
      return id;
  }
}
