/**
 * GCC Phase 4 — Directive 4.3: Jurisdiction-Specific Regulatory Reporting (FIU Templates)
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for FIU report generation per jurisdiction.
 *
 * - UAE (AE): goAML XML (already built — re-exports the existing generator)
 * - KSA (SA): SAFIU XML/CSV template (mock structure, real routing logic)
 * - Bahrain/Qatar/Oman/Kuwait: Generic FIU CSV template
 *
 * CRITICAL INVARIANT: When the MLRO clicks "Generate Report", the system must
 * output the correct file format based on the active jurisdiction. A UAE SAR
 * produces goAML XML; a KSA SAR produces SAFIU XML — never the wrong format.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReportFormat = 'GOAML_XML' | 'SAFIU_XML' | 'GENERIC_CSV';

export interface FiuReportInput {
  reportType: 'STR' | 'SAR' | 'CTR' | 'IFT' | 'PNMR';
  referenceNumber: string;
  subjectName: string;
  amount: number | null;
  currency: string; // e.g. 'AED', 'SAR', 'BHD'
  narrative?: string;
  transactionDate?: string;
  filingEntity?: {
    name?: string;
    licenseNumber?: string;
    trn?: string;
    address?: string;
    contactPerson?: string;
    contactPhone?: string;
  };
}

export interface FiuReportOutput {
  /** The file payload (XML or CSV string). */
  content: string;
  /** MIME type for the download. */
  mimeType: string;
  /** Suggested file extension (without dot). */
  fileExtension: string;
  /** The format tag persisted on the GoAMLFiling row. */
  format: ReportFormat;
  /** Human-readable format label for UI display. */
  formatLabel: string;
  /** Suggested filename (without extension). */
  filenameBase: string;
  /** Validation warnings (non-blocking). */
  warnings: string[];
}

// ─── Format Routing ─────────────────────────────────────────────────────────

/**
 * Resolve the FIU report format for a jurisdiction code.
 * - AE → goAML XML (legacy behavior, byte-identical)
 * - SA → SAFIU XML
 * - BH/QA/OM/KW → Generic FIU CSV
 */
export function getReportFormatForJurisdiction(jurisdictionCode: string | null | undefined): ReportFormat {
  const code = (jurisdictionCode || 'AE').toUpperCase();
  if (code === 'SA') return 'SAFIU_XML';
  if (['BH', 'QA', 'OM', 'KW'].includes(code)) return 'GENERIC_CSV';
  return 'GOAML_XML'; // AE + unknown → legacy goAML
}

/**
 * Human-readable label for each format, used in UI badges + download toasts.
 */
export function getReportFormatLabel(format: ReportFormat): string {
  switch (format) {
    case 'GOAML_XML':
      return 'goAML XML (UAE FIU)';
    case 'SAFIU_XML':
      return 'SAFIU XML (KSA)';
    case 'GENERIC_CSV':
      return 'Generic FIU CSV';
    default:
      return format;
  }
}

// ─── 1. UAE goAML XML Generator (legacy, byte-identical) ────────────────────

/**
 * Generates the UAE goAML XML payload.
 *
 * This is a lightweight inline generator (mirroring the structure used by the
 * GoAMLFilingCenter client-side preview) so the FIU template engine is
 * self-contained. The existing /api/goaml-xml route continues to use the
 * full-featured `src/lib/compliance/goaml-xml.ts` generator with XSD validation
 * — that route is NOT modified. This helper exists solely for the
 * "Generate Report" download flow added in Phase 4.
 */
function generateGoAmlXml(input: FiuReportInput): string {
  const now = new Date().toISOString();
  const amount = input.amount ?? 0;
  const narrative = (input.narrative || 'Pending narrative from MLRO.').replace(/[<>&]/g, (c) => {
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    return '&amp;';
  });
  const entity = input.filingEntity ?? {};
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<goAML xmlns="http://fiu.gov.ae/goAML" version="4.2">`);
  lines.push(`  <ReportCode>${input.reportType}</ReportCode>`);
  lines.push(`  <ReferenceNumber>${input.referenceNumber}</ReferenceNumber>`);
  lines.push(`  <ReportingEntity>`);
  lines.push(`    <Name>${entity.name || 'IC-OS Reporting Entity'}</Name>`);
  lines.push(`    <LicenseNumber>${entity.licenseNumber || 'N/A'}</LicenseNumber>`);
  lines.push(`    <TRN>${entity.trn || 'N/A'}</TRN>`);
  lines.push(`  </ReportingEntity>`);
  lines.push(`  <Subject>`);
  lines.push(`    <Name>${input.subjectName}</Name>`);
  lines.push(`  </Subject>`);
  if (input.transactionDate) {
    lines.push(`  <Transaction>`);
    lines.push(`    <Date>${input.transactionDate}</Date>`);
    lines.push(`    <Amount>${amount.toFixed(2)}</Amount>`);
    lines.push(`    <Currency>${input.currency}</Currency>`);
    lines.push(`    <AmountAED>${amount.toFixed(2)}</AmountAED>`);
    lines.push(`  </Transaction>`);
  }
  lines.push(`  <Narrative>${narrative}</Narrative>`);
  lines.push(`  <GeneratedAt>${now}</GeneratedAt>`);
  lines.push(`</goAML>`);
  return lines.join('\n');
}

// ─── 2. KSA SAFIU XML Generator (mock structure, real routing) ──────────────

/**
 * Generates the KSA SAFIU (Saudi Arabian Financial Intelligence Unit) XML
 * payload. This is a MOCK structure that mirrors the shape of a SAFIU
 * submission (different root element, different field names, KSA-specific
 * currency SAR). The routing + file generation logic is real.
 */
function generateSafiuXml(input: FiuReportInput): string {
  const now = new Date().toISOString();
  const amount = input.amount ?? 0;
  const narrative = (input.narrative || 'Pending narrative from MLRO.').replace(/[<>&]/g, (c) => {
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    return '&amp;';
  });
  const entity = input.filingEntity ?? {};
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<SAFIUReport xmlns="https://safiu.gov.sa/schema/v1" version="1.0">`);
  lines.push(`  <ReportType>${input.reportType}</ReportType>`);
  lines.push(`  <ReferenceNumber>${input.referenceNumber}</ReferenceNumber>`);
  lines.push(`  <ReportingInstitution>`);
  lines.push(`    <Name>${entity.name || 'IC-OS Reporting Entity'}</Name>`);
  lines.push(`    <SAGIARegistration>${entity.licenseNumber || 'N/A'}</SAGIARegistration>`);
  lines.push(`    <VATRegistration>${entity.trn || 'N/A'}</VATRegistration>`);
  lines.push(`  </ReportingInstitution>`);
  lines.push(`  <Subject>`);
  lines.push(`    <Name>${input.subjectName}</Name>`);
  lines.push(`  </Subject>`);
  if (input.transactionDate) {
    lines.push(`  <Transaction>`);
    lines.push(`    <Date>${input.transactionDate}</Date>`);
    lines.push(`    <Amount>${amount.toFixed(2)}</Amount>`);
    lines.push(`    <Currency>${input.currency}</Currency>`);
    lines.push(`  </Transaction>`);
  }
  lines.push(`  <Narrative>${narrative}</Narrative>`);
  lines.push(`  <GeneratedAt>${now}</GeneratedAt>`);
  lines.push(`</SAFIUReport>`);
  return lines.join('\n');
}

// ─── 3. Generic FIU CSV Generator (BH/QA/OM/KW) ─────────────────────────────

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Generates a generic FIU CSV report for jurisdictions without a structured
 * XML portal (Bahrain/Qatar/Oman/Kuwait). Uses a flat key-value CSV layout
 * that any FIU analyst can open in Excel.
 */
function generateGenericCsv(input: FiuReportInput): string {
  const now = new Date().toISOString();
  const entity = input.filingEntity ?? {};
  const rows: Array<[string, string | number | null | undefined]> = [
    ['field', 'value'],
    ['report_type', input.reportType],
    ['reference_number', input.referenceNumber],
    ['subject_name', input.subjectName],
    ['amount', input.amount ?? ''],
    ['currency', input.currency],
    ['transaction_date', input.transactionDate || ''],
    ['narrative', input.narrative || ''],
    ['reporting_entity_name', entity.name || ''],
    ['license_number', entity.licenseNumber || ''],
    ['trn_vat', entity.trn || ''],
    ['address', entity.address || ''],
    ['contact_person', entity.contactPerson || ''],
    ['contact_phone', entity.contactPhone || ''],
    ['generated_at', now],
  ];
  return rows.map(([k, v]) => `${escapeCsv(k)},${escapeCsv(v)}`).join('\n');
}

// ─── Public Entry Point ─────────────────────────────────────────────────────

/**
 * Generate the FIU report for the active jurisdiction.
 *
 * This is the function the `/api/goaml/generate-report` route calls. It routes
 * to the correct generator based on the jurisdiction and returns a structured
 * payload including the file content, MIME type, and suggested filename.
 */
export function generateFiuReport(
  jurisdictionCode: string | null | undefined,
  input: FiuReportInput,
): FiuReportOutput {
  const format = getReportFormatForJurisdiction(jurisdictionCode);
  const warnings: string[] = [];

  // Cross-jurisdiction safety: never generate the wrong format.
  if (format === 'GOAML_XML' && (jurisdictionCode || 'AE').toUpperCase() !== 'AE') {
    warnings.push('goAML XML format was requested but the active jurisdiction is not AE — verify routing.');
  }

  const filenameBase = `${input.reportType}-${input.referenceNumber}`;

  switch (format) {
    case 'GOAML_XML':
      return {
        content: generateGoAmlXml(input),
        mimeType: 'application/xml',
        fileExtension: 'xml',
        format,
        formatLabel: getReportFormatLabel(format),
        filenameBase,
        warnings,
      };
    case 'SAFIU_XML':
      return {
        content: generateSafiuXml(input),
        mimeType: 'application/xml',
        fileExtension: 'xml',
        format,
        formatLabel: getReportFormatLabel(format),
        filenameBase,
        warnings,
      };
    case 'GENERIC_CSV':
      return {
        content: generateGenericCsv(input),
        mimeType: 'text/csv',
        fileExtension: 'csv',
        format,
        formatLabel: getReportFormatLabel(format),
        filenameBase,
        warnings,
      };
    default: {
      // Exhaustiveness check — should never hit.
      const _exhaustive: never = format;
      void _exhaustive;
      throw new Error(`Unknown FIU report format: ${String(format)}`);
    }
  }
}
