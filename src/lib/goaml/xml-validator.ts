/**
 * goAML XML Pre-Submission Validator
 * Pre-UAT Polish Fix #4
 *
 * Validates goAML XML payloads against the UAE FIU expected schema structure
 * before the MLRO digitally signs and submits to the FIU portal.
 *
 * Regulatory Reference:
 *   - CBUAE Notice 3551/2021 S4.2 (goAML Reporting Requirements)
 *   - UAE FIU goAML Data Specification v3.0
 *   - FDL 10/2025 Art. 8 (Suspicious Transaction Reporting)
 *
 * Validation Approach:
 *   Since we cannot embed the full official UAE FIU XSD (proprietary/evolving),
 *   we implement a strict structural validation that checks:
 *     1. Well-formed XML (parseable)
 *     2. Required root element (<goAML> or <REPORT>)
 *     3. Required child elements per report type (STR/SAR/CTR/IFT/PNMR)
 *     4. Data format compliance (dates, amounts, entity references)
 *     5. UAE-specific field requirements (Emirates ID format, AED currency, etc.)
 *
 *   Invalid XML is flagged with specific errors BEFORE it reaches the MLRO's
 *   approval queue, preventing FIU portal rejection.
 */

import { z } from 'zod';

// ─── Validation Result Types ────────────────────────────────────────────────

export interface XMLValidationError {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  xpath?: string;
  regulatoryRef?: string;
}

export interface XMLValidationResult {
  isValid: boolean;
  errors: XMLValidationError[];
  warnings: XMLValidationError[];
  validatedAt: string;
  schemaVersion: string;
}

// ─── UAE-Specific Format Validators ─────────────────────────────────────────

/** UAE Emirates ID format: 784-YYYY-NNNNNNN-X */
const EMIRATES_ID_REGEX = /^784-\d{4}-\d{7}-\d{1}$/;

/** UAE Trade License format: NNNNNNN (typically 5-8 digits) */
const TRADE_LICENSE_REGEX = /^\d{5,8}$/;

/** ISO 4217 currency for UAE */
const VALID_CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR'];

/** Valid goAML report types */
const VALID_REPORT_TYPES = ['STR', 'SAR', 'CTR', 'IFT', 'PNMR'] as const;

/** Required elements per report type */
const REQUIRED_ELEMENTS_BY_TYPE: Record<string, string[]> = {
  STR: ['REPORT', 'SUBJECT', 'ACTIVITY', 'AMOUNT', 'CURRENCY', 'REASON'],
  SAR: ['REPORT', 'SUBJECT', 'ACTIVITY', 'AMOUNT', 'CURRENCY', 'REASON'],
  CTR: ['REPORT', 'FROM', 'TO', 'AMOUNT', 'CURRENCY', 'TRANSACTION_DATE'],
  IFT: ['REPORT', 'FROM_COUNTRY', 'TO_COUNTRY', 'AMOUNT', 'CURRENCY', 'TRANSACTION_DATE'],
  PNMR: ['REPORT', 'SUBJECT', 'ACTIVITY', 'AMOUNT', 'CURRENCY'],
};

/** Required attributes on root element */
const REQUIRED_ROOT_ATTRIBUTES = ['xmlns', 'version'];

// ─── Core Validation Functions ───────────────────────────────────────────────

/**
 * Check if XML is well-formed (parseable).
 */
function validateWellFormedXML(xmlPayload: string): XMLValidationError[] {
  const errors: XMLValidationError[] = [];

  // Check basic XML structure
  if (!xmlPayload || xmlPayload.trim().length === 0) {
    errors.push({
      code: 'XML_EMPTY',
      message: 'XML payload is empty. A valid goAML XML document is required.',
      severity: 'ERROR',
      regulatoryRef: 'CBUAE Notice 3551/2021 S4.2',
    });
    return errors;
  }

  // Check XML declaration
  if (!xmlPayload.includes('<?xml')) {
    errors.push({
      code: 'XML_MISSING_DECLARATION',
      message: 'Missing XML declaration. Expected: <?xml version="1.0" encoding="UTF-8"?>',
      severity: 'WARNING',
      regulatoryRef: 'UAE FIU goAML Data Specification v3.0',
    });
  }

  // Check for matching root tags
  const rootTagMatch = xmlPayload.match(/<(\w+)[\s>]/);
  if (!rootTagMatch) {
    errors.push({
      code: 'XML_NO_ROOT',
      message: 'No root element found. XML must have a single root element.',
      severity: 'ERROR',
    });
    return errors;
  }

  const rootTag = rootTagMatch[1];
  const closingTag = `</${rootTag}>`;
  if (!xmlPayload.includes(closingTag)) {
    errors.push({
      code: 'XML_UNCLOSED_ROOT',
      message: `Root element <${rootTag}> is not properly closed. Missing ${closingTag}`,
      severity: 'ERROR',
    });
  }

  // Check for common XML malformations
  const unclosedTags = xmlPayload.match(/<(\w+)[^/]>[^<]*$/m);
  if (unclosedTags && !xmlPayload.includes(`</${unclosedTags[1]}>`)) {
    errors.push({
      code: 'XML_UNCLOSED_TAG',
      message: `Potentially unclosed tag: <${unclosedTags[1]}>`,
      severity: 'WARNING',
      xpath: `/${unclosedTags[1]}`,
    });
  }

  // Check for duplicate attributes
  const attributePattern = /<[^>]+>/g;
  let tagMatch;
  while ((tagMatch = attributePattern.exec(xmlPayload)) !== null) {
    const tag = tagMatch[0];
    const attrMatches = tag.match(/(\w+)=["'][^"']*["']/g);
    if (attrMatches) {
      const attrNames = attrMatches.map(a => a.split('=')[0]);
      const duplicates = attrNames.filter((a, i) => attrNames.indexOf(a) !== i);
      if (duplicates.length > 0) {
        errors.push({
          code: 'XML_DUPLICATE_ATTR',
          message: `Duplicate attributes found in tag: ${duplicates.join(', ')}`,
          severity: 'ERROR',
        });
      }
    }
  }

  return errors;
}

/**
 * Validate root element structure against UAE FIU schema expectations.
 */
function validateRootElement(xmlPayload: string): XMLValidationError[] {
  const errors: XMLValidationError[] = [];

  // Check for valid root element name
  const hasGoAMLRoot = xmlPayload.includes('<goAML') || xmlPayload.includes('<REPORT');
  if (!hasGoAMLRoot) {
    errors.push({
      code: 'XML_INVALID_ROOT',
      message: 'Root element must be <goAML> or <REPORT> per UAE FIU goAML specification.',
      severity: 'ERROR',
      regulatoryRef: 'UAE FIU goAML Data Specification v3.0',
    });
  }

  // Check for required namespace/version attributes
  for (const attr of REQUIRED_ROOT_ATTRIBUTES) {
    if (!xmlPayload.includes(attr + '=')) {
      errors.push({
        code: 'XML_MISSING_ROOT_ATTR',
        message: `Root element missing required attribute: "${attr}". Expected xmlns and version per UAE FIU schema.`,
        severity: 'WARNING',
        regulatoryRef: 'UAE FIU goAML Data Specification v3.0',
      });
    }
  }

  return errors;
}

/**
 * Validate required elements for the specified report type.
 */
function validateRequiredElements(
  xmlPayload: string,
  reportType: string
): XMLValidationError[] {
  const errors: XMLValidationError[] = [];
  const requiredElements = REQUIRED_ELEMENTS_BY_TYPE[reportType.toUpperCase()];

  if (!requiredElements) {
    errors.push({
      code: 'XML_UNKNOWN_REPORT_TYPE',
      message: `Unknown report type "${reportType}". Valid types: ${VALID_REPORT_TYPES.join(', ')}`,
      severity: 'ERROR',
      regulatoryRef: 'CBUAE Notice 3551/2021 S4.2',
    });
    return errors;
  }

  for (const element of requiredElements) {
    // Check if element exists (opening tag)
    const elementPattern = new RegExp(`<${element}[\\s>/]`, 'i');
    if (!elementPattern.test(xmlPayload)) {
      errors.push({
        code: 'XML_MISSING_REQUIRED_ELEMENT',
        message: `Required element <${element}> is missing for report type ${reportType}. This will cause FIU portal rejection.`,
        severity: 'ERROR',
        xpath: `/${element}`,
        regulatoryRef: 'UAE FIU goAML Data Specification v3.0',
      });
    }
  }

  return errors;
}

/**
 * Validate UAE-specific data formats within the XML.
 */
function validateUAEDataFormats(xmlPayload: string): XMLValidationError[] {
  const errors: XMLValidationError[] = [];

  // Check for valid currency code
  const currencyMatch = xmlPayload.match(/<CURRENCY[^>]*>([^<]+)<\/CURRENCY>/i);
  if (currencyMatch) {
    const currency = currencyMatch[1].trim().toUpperCase();
    if (!VALID_CURRENCIES.includes(currency)) {
      errors.push({
        code: 'XML_INVALID_CURRENCY',
        message: `Currency "${currency}" is not in the accepted list: ${VALID_CURRENCIES.join(', ')}. UAE FIU requires ISO 4217 codes.`,
        severity: 'ERROR',
        xpath: '/CURRENCY',
        regulatoryRef: 'UAE FIU goAML Data Specification v3.0',
      });
    }
  }

  // Check for Emirates ID format (if present)
  const emiratesIdMatch = xmlPayload.match(/<EMIRATES_ID[^>]*>([^<]+)<\/EMIRATES_ID>/i) ||
    xmlPayload.match(/<NATIONAL_ID[^>]*>([^<]+)<\/NATIONAL_ID>/i);
  if (emiratesIdMatch) {
    const eid = emiratesIdMatch[1].trim();
    if (!EMIRATES_ID_REGEX.test(eid)) {
      errors.push({
        code: 'XML_INVALID_EMIRATES_ID',
        message: `Emirates ID "${eid}" does not match UAE format (784-YYYY-NNNNNNN-X). This will cause FIU portal rejection.`,
        severity: 'ERROR',
        xpath: '/EMIRATES_ID',
        regulatoryRef: 'UAE Federal Identity and Citizenship Authority',
      });
    }
  }

  // Check for valid date format (ISO 8601)
  const dateMatches = xmlPayload.match(/<(\w*_DATE|DATE)[^>]*>([^<]+)<\/\1>/gi) || [];
  for (const dateMatch of dateMatches) {
    const valueMatch = dateMatch.match(/>([^<]+)<\/\w+$/);
    if (valueMatch) {
      const dateValue = valueMatch[1].trim();
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
      if (!isoDateRegex.test(dateValue)) {
        errors.push({
          code: 'XML_INVALID_DATE_FORMAT',
          message: `Date value "${dateValue}" is not in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS). UAE FIU requires ISO 8601.`,
          severity: 'ERROR',
          regulatoryRef: 'UAE FIU goAML Data Specification v3.0',
        });
      }
    }
  }

  // Check for valid amount format (numeric)
  const amountMatches = xmlPayload.match(/<AMOUNT[^>]*>([^<]+)<\/AMOUNT>/gi) || [];
  for (const amtMatch of amountMatches) {
    const valueMatch = amtMatch.match(/>([^<]+)<\/AMOUNT$/i);
    if (valueMatch) {
      const amount = valueMatch[1].trim();
      if (isNaN(Number(amount)) || Number(amount) < 0) {
        errors.push({
          code: 'XML_INVALID_AMOUNT',
          message: `Amount "${amount}" is not a valid non-negative number. UAE FIU requires decimal amounts.`,
          severity: 'ERROR',
          xpath: '/AMOUNT',
          regulatoryRef: 'UAE FIU goAML Data Specification v3.0',
        });
      }
    }
  }

  return errors;
}

/**
 * Validate goAML entity reference integrity.
 */
function validateEntityReferences(xmlPayload: string): XMLValidationError[] {
  const errors: XMLValidationError[] = [];

  // Check for at least one SUBJECT element
  const hasSubject = /<SUBJECT[\s>/]/i.test(xmlPayload);
  if (!hasSubject) {
    errors.push({
      code: 'XML_NO_SUBJECT',
      message: 'No <SUBJECT> element found. Every goAML filing must have at least one subject (person or entity).',
      severity: 'ERROR',
      regulatoryRef: 'CBUAE Notice 3551/2021 S4.2',
    });
  }

  // Check for ACTIVITY description
  const hasActivity = /<ACTIVITY[\s>/]/i.test(xmlPayload) || /<REASON[\s>/]/i.test(xmlPayload);
  if (!hasActivity) {
    errors.push({
      code: 'XML_NO_ACTIVITY',
      message: 'No <ACTIVITY> or <REASON> element found. Every goAML filing must describe the suspicious activity.',
      severity: 'ERROR',
      regulatoryRef: 'FDL 10/2025 Art. 8; CBUAE Notice 3551/2021 S4.2',
    });
  }

  return errors;
}

// ─── Main Validation Function ───────────────────────────────────────────────

/**
 * Validate a goAML XML payload against UAE FIU structural requirements.
 *
 * This function performs a comprehensive structural validation to catch
 * formatting errors before the XML reaches the MLRO's approval queue.
 * It does NOT replace the official UAE FIU XSD validation (performed at
 * the FIU portal), but catches common errors that would result in
 * immediate rejection.
 *
 * @param xmlPayload - The goAML XML string to validate
 * @param reportType - The report type (STR, SAR, CTR, IFT, PNMR)
 * @returns XMLValidationResult with errors and warnings
 */
export function validateGoAMLXML(
  xmlPayload: string,
  reportType: string
): XMLValidationResult {
  const allErrors: XMLValidationError[] = [];
  const allWarnings: XMLValidationError[] = [];
  const validatedAt = new Date().toISOString();

  // Step 1: Well-formed XML check
  const wellFormedErrors = validateWellFormedXML(xmlPayload);
  for (const e of wellFormedErrors) {
    if (e.severity === 'ERROR') allErrors.push(e);
    else allWarnings.push(e);
  }

  // If XML is not well-formed, skip further structural checks
  if (allErrors.some(e => e.code.startsWith('XML_EMPTY') || e.code.startsWith('XML_NO_ROOT'))) {
    return {
      isValid: false,
      errors: allErrors,
      warnings: allWarnings,
      validatedAt,
      schemaVersion: 'UAE-FIU-goAML-v3.0',
    };
  }

  // Step 2: Root element validation
  const rootErrors = validateRootElement(xmlPayload);
  for (const e of rootErrors) {
    if (e.severity === 'ERROR') allErrors.push(e);
    else allWarnings.push(e);
  }

  // Step 3: Required elements for report type
  const elementErrors = validateRequiredElements(xmlPayload, reportType);
  for (const e of elementErrors) {
    if (e.severity === 'ERROR') allErrors.push(e);
    else allWarnings.push(e);
  }

  // Step 4: UAE-specific data format validation
  const formatErrors = validateUAEDataFormats(xmlPayload);
  for (const e of formatErrors) {
    if (e.severity === 'ERROR') allErrors.push(e);
    else allWarnings.push(e);
  }

  // Step 5: Entity reference integrity
  const entityErrors = validateEntityReferences(xmlPayload);
  for (const e of entityErrors) {
    if (e.severity === 'ERROR') allErrors.push(e);
    else allWarnings.push(e);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    validatedAt,
    schemaVersion: 'UAE-FIU-goAML-v3.0',
  };
}

/**
 * Zod schema for goAML XML validation request.
 */
export const goAMLValidationRequestSchema = z.object({
  xmlPayload: z.string().min(1, 'XML payload is required'),
  reportType: z.enum(['STR', 'SAR', 'CTR', 'IFT', 'PNMR'], {
    error: 'reportType must be one of: STR, SAR, CTR, IFT, PNMR',
  }),
});
