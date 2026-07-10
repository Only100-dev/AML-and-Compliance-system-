/**
 * GCC Phase 4 — Directive 4.1: KYC Document Localization
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for jurisdiction-specific KYC document requirements.
 *
 * Each GCC country requires different primary identification documents for
 * individuals and corporates. This module defines the document fields that the
 * KYC Onboarding UI must render and the backend must validate.
 *
 * UAE (AE) is byte-identical to the legacy behavior (Emirates ID + Passport +
 * Visa/Residency). All other jurisdictions are purely additive.
 *
 * CRITICAL INVARIANT: A KSA onboarding MUST reject an "Emirates ID" upload.
 * The backend enforces this by validating the submitted `localDocuments` JSON
 * against the jurisdiction's `acceptedDocumentTypes` whitelist.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IndividualDocumentField {
  /** Machine key stored in `localDocuments` JSON (e.g. "nationalId"). */
  key: string;
  /** Human-readable label rendered in the UI (e.g. "National ID"). */
  label: string;
  /** Whether the field is mandatory for onboarding. */
  required: boolean;
  /** Placeholder text for the input. */
  placeholder: string;
  /** Short helper text shown under the field. */
  helperText?: string;
}

export interface CorporateDocumentField {
  key: string;
  label: string;
  required: boolean;
  placeholder: string;
  helperText?: string;
}

export interface JurisdictionKycConfig {
  /** Jurisdiction code (AE/SA/BH/QA/OM/KW). */
  code: string;
  /** Primary ID label shown in the hero/search placeholder. */
  primaryIdLabel: string;
  /** The search placeholder for the individual KYC table. */
  searchPlaceholder: string;
  /** Individual (natural person) document requirements. */
  individualDocuments: IndividualDocumentField[];
  /** Corporate (legal entity) document requirements. */
  corporateDocuments: CorporateDocumentField[];
  /** Default nationality preset for the Select dropdown. */
  defaultNationality: string;
  /** Nationality options for the Select dropdown. */
  nationalityOptions: string[];
}

// ─── Per-Jurisdiction Configurations ────────────────────────────────────────

const UAE_CONFIG: JurisdictionKycConfig = {
  code: 'AE',
  primaryIdLabel: 'Emirates ID',
  searchPlaceholder: 'Search by name, Emirates ID, passport...',
  // UAE legacy behavior: Emirates ID (optional), Passport (required), Visa/Residency (optional).
  // The existing IndividualKYCWizard.tsx renders these as the canonical fields.
  individualDocuments: [
    {
      key: 'emiratesId',
      label: 'Emirates ID',
      required: false,
      placeholder: '784-XXXX-XXXXXXX-X',
      helperText: '15-digit Emirates ID (UAE residents).',
    },
    {
      key: 'passportNo',
      label: 'Passport No',
      required: true,
      placeholder: 'A12345678',
      helperText: 'Passport number (required for all customers).',
    },
    {
      key: 'visaResidency',
      label: 'Visa / Residency Permit',
      required: false,
      placeholder: 'Visa file number',
      helperText: 'UAE residency visa (if applicable).',
    },
  ],
  corporateDocuments: [
    {
      key: 'tradeLicenseNo',
      label: 'Trade License No',
      required: true,
      placeholder: 'TL-XXXXX',
      helperText: 'UAE Department of Economic Development trade license.',
    },
    {
      key: 'trn',
      label: 'TRN (Tax Reg. Number)',
      required: false,
      placeholder: '100-XXXX-XXXX-XXX',
      helperText: 'UAE Federal Tax Authority TRN.',
    },
  ],
  defaultNationality: 'UAE',
  nationalityOptions: ['UAE', 'Saudi Arabia', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Egypt', 'India', 'Pakistan', 'UK', 'USA', 'Other'],
};

const KSA_CONFIG: JurisdictionKycConfig = {
  code: 'SA',
  primaryIdLabel: 'National ID / Iqama',
  searchPlaceholder: 'Search by name, National ID, Iqama...',
  individualDocuments: [
    {
      key: 'nationalId',
      label: 'National ID',
      required: false,
      placeholder: '1XXXXXXXXX',
      helperText: '10-digit Saudi National ID (citizens). Mutually exclusive with Iqama.',
    },
    {
      key: 'iqama',
      label: 'Iqama (Resident ID)',
      required: false,
      placeholder: '2XXXXXXXXX',
      helperText: '10-digit Iqama number (Saudi residents). Required if no National ID.',
    },
    {
      key: 'passportNo',
      label: 'Passport No',
      required: true,
      placeholder: 'A12345678',
      helperText: 'Passport number (required for all customers).',
    },
  ],
  corporateDocuments: [
    {
      key: 'commercialRegistration',
      label: 'Commercial Registration (CR)',
      required: true,
      placeholder: '1010XXXXXX',
      helperText: 'Saudi Ministry of Commerce CR number.',
    },
    {
      key: 'vatRegistration',
      label: 'VAT Registration No',
      required: false,
      placeholder: '3000XXXXXXXXXXX',
      helperText: 'Saudi Zakat, Tax and Customs Authority VAT number.',
    },
  ],
  defaultNationality: 'Saudi Arabia',
  nationalityOptions: ['Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Egypt', 'India', 'Pakistan', 'UK', 'USA', 'Other'],
};

const KUWAIT_CONFIG: JurisdictionKycConfig = {
  code: 'KW',
  primaryIdLabel: 'Civil ID',
  searchPlaceholder: 'Search by name, Civil ID, passport...',
  individualDocuments: [
    {
      key: 'civilId',
      label: 'Civil ID',
      required: false,
      placeholder: '2XXXXXXXX',
      helperText: '12-digit Kuwait Civil ID (PACI). Required for residents.',
    },
    {
      key: 'passportNo',
      label: 'Passport No',
      required: true,
      placeholder: 'A12345678',
      helperText: 'Passport number (required for all customers).',
    },
  ],
  corporateDocuments: [
    {
      key: 'commercialRegistration',
      label: 'Commercial Registration (CR)',
      required: true,
      placeholder: 'CR-XXXXX',
      helperText: 'Kuwait Ministry of Commerce & Industry CR.',
    },
    {
      key: 'civilId',
      label: 'Authorised Signatory Civil ID',
      required: false,
      placeholder: '2XXXXXXXX',
      helperText: 'Civil ID of the authorised signatory.',
    },
  ],
  defaultNationality: 'Kuwait',
  nationalityOptions: ['Kuwait', 'Saudi Arabia', 'UAE', 'Qatar', 'Bahrain', 'Oman', 'Egypt', 'India', 'Pakistan', 'UK', 'USA', 'Other'],
};

const BAHRAIN_CONFIG: JurisdictionKycConfig = {
  code: 'BH',
  primaryIdLabel: 'National ID / Passport',
  searchPlaceholder: 'Search by name, National ID, passport...',
  individualDocuments: [
    {
      key: 'nationalId',
      label: 'National ID (Bahraini)',
      required: false,
      placeholder: '9XXXXXXXX',
      helperText: '9-digit Bahrain CPR / National ID (citizens & residents).',
    },
    {
      key: 'passportNo',
      label: 'Passport No',
      required: true,
      placeholder: 'A12345678',
      helperText: 'Passport number (required for all customers).',
    },
  ],
  corporateDocuments: [
    {
      key: 'commercialRegistration',
      label: 'Commercial Registration (CR)',
      required: true,
      placeholder: 'CR-XXXXX',
      helperText: 'Bahrain Ministry of Industry & Commerce CR.',
    },
  ],
  defaultNationality: 'Bahrain',
  nationalityOptions: ['Bahrain', 'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Oman', 'Egypt', 'India', 'Pakistan', 'UK', 'USA', 'Other'],
};

const QATAR_CONFIG: JurisdictionKycConfig = {
  code: 'QA',
  primaryIdLabel: 'National ID / Passport',
  searchPlaceholder: 'Search by name, National ID, passport...',
  individualDocuments: [
    {
      key: 'nationalId',
      label: 'Qatari ID (QID)',
      required: false,
      placeholder: '2XXXXXXXXX',
      helperText: '11-digit Qatar ID (citizens & residents).',
    },
    {
      key: 'passportNo',
      label: 'Passport No',
      required: true,
      placeholder: 'A12345678',
      helperText: 'Passport number (required for all customers).',
    },
  ],
  corporateDocuments: [
    {
      key: 'commercialRegistration',
      label: 'Commercial Registration (CR)',
      required: true,
      placeholder: 'CR-XXXXX',
      helperText: 'Qatar Ministry of Commerce & Industry CR.',
    },
  ],
  defaultNationality: 'Qatar',
  nationalityOptions: ['Qatar', 'Saudi Arabia', 'UAE', 'Kuwait', 'Bahrain', 'Oman', 'Egypt', 'India', 'Pakistan', 'UK', 'USA', 'Other'],
};

const OMAN_CONFIG: JurisdictionKycConfig = {
  code: 'OM',
  primaryIdLabel: 'National ID / Passport',
  searchPlaceholder: 'Search by name, National ID, passport...',
  individualDocuments: [
    {
      key: 'nationalId',
      label: 'Omani ID',
      required: false,
      placeholder: '1XXXXXXXX',
      helperText: '8-digit Omani Resident Card (citizens & residents).',
    },
    {
      key: 'passportNo',
      label: 'Passport No',
      required: true,
      placeholder: 'A12345678',
      helperText: 'Passport number (required for all customers).',
    },
  ],
  corporateDocuments: [
    {
      key: 'commercialRegistration',
      label: 'Commercial Registration (CR)',
      required: true,
      placeholder: 'CR-XXXXX',
      helperText: 'Oman Ministry of Commerce & Industry CR.',
    },
  ],
  defaultNationality: 'Oman',
  nationalityOptions: ['Oman', 'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Egypt', 'India', 'Pakistan', 'UK', 'USA', 'Other'],
};

// ─── Registry ───────────────────────────────────────────────────────────────

const KYC_CONFIG_REGISTRY: Record<string, JurisdictionKycConfig> = {
  AE: UAE_CONFIG,
  SA: KSA_CONFIG,
  KW: KUWAIT_CONFIG,
  BH: BAHRAIN_CONFIG,
  QA: QATAR_CONFIG,
  OM: OMAN_CONFIG,
};

/**
 * Resolve the KYC document configuration for a given jurisdiction code.
 * Falls back to UAE (AE) for unknown codes — preserving legacy behavior.
 */
export function getKycConfig(jurisdictionCode: string | null | undefined): JurisdictionKycConfig {
  const code = (jurisdictionCode || 'AE').toUpperCase();
  return KYC_CONFIG_REGISTRY[code] ?? UAE_CONFIG;
}

/**
 * Returns the set of accepted document keys for a jurisdiction.
 * Used by the backend to reject cross-jurisdiction document uploads
 * (e.g. an Emirates ID submitted in a KSA onboarding context).
 */
export function getAcceptedDocumentKeys(jurisdictionCode: string | null | undefined): Set<string> {
  const config = getKycConfig(jurisdictionCode);
  const keys = new Set<string>();
  config.individualDocuments.forEach((d) => keys.add(d.key));
  config.corporateDocuments.forEach((d) => keys.add(d.key));
  // Universal keys accepted in all jurisdictions.
  keys.add('passportNo');
  return keys;
}

/**
 * Validate a `localDocuments` payload against the jurisdiction's requirements.
 * Returns an array of validation errors (empty array = valid).
 *
 * Rules:
 * 1. Reject any document key NOT in the jurisdiction's accepted set.
 * 2. Require at least one primary ID for individual onboarding (jurisdiction-specific).
 * 3. Require all `required: true` fields.
 */
export function validateLocalDocuments(
  jurisdictionCode: string | null | undefined,
  localDocuments: Record<string, string> | null | undefined,
  entityType: 'individual' | 'corporate',
): { valid: boolean; errors: string[] } {
  const config = getKycConfig(jurisdictionCode);
  const accepted = getAcceptedDocumentKeys(jurisdictionCode);
  const errors: string[] = [];

  const docs = localDocuments ?? {};

  // Rule 1: Reject unknown document keys (cross-jurisdiction leakage prevention).
  for (const key of Object.keys(docs)) {
    if (!accepted.has(key)) {
      errors.push(
        `Document type "${key}" is not accepted in the ${config.code} jurisdiction. ` +
          `This field belongs to a different country's KYC process — cross-jurisdiction uploads are rejected.`,
      );
    }
  }

  // Rule 2 & 3: Check required fields per entity type.
  const fields = entityType === 'individual' ? config.individualDocuments : config.corporateDocuments;
  for (const field of fields) {
    if (field.required && !docs[field.key]?.trim()) {
      errors.push(`Required document "${field.label}" (${field.key}) is missing for ${config.code} ${entityType} onboarding.`);
    }
  }

  // KSA individual: at least one of National ID OR Iqama must be present.
  if (config.code === 'SA' && entityType === 'individual') {
    const hasNationalId = !!docs['nationalId']?.trim();
    const hasIqama = !!docs['iqama']?.trim();
    if (!hasNationalId && !hasIqama) {
      errors.push('KSA individual onboarding requires either a National ID or an Iqama number.');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Sanctioned Label (for UI hero text) ────────────────────────────────────

/**
 * Returns the human-readable label for the primary ID document of a jurisdiction.
 * Used in the KYC wizard header and search placeholder.
 */
export function getPrimaryIdLabel(jurisdictionCode: string | null | undefined): string {
  return getKycConfig(jurisdictionCode).primaryIdLabel;
}
