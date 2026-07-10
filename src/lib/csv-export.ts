/**
 * CSV Export Utility
 * Generates CSV strings from data arrays with mandatory PII masking.
 * Uses standard browser Blob API for client-side download.
 *
 * Per CBUAE Notice 3551/2021: All exported data must have PII masked
 * unless the export is for a regulated filing (e.g., goAML XML).
 */

import { sanitizeObject, LIST_VIEW_PII_FIELDS } from '@/lib/pii';

export interface CSVExportOptions {
  filename: string;
  headers: string[];
  rows: Record<string, unknown>[];
  /** Map of field name → masking function. If not provided, auto-detection is used. */
  piiMaskMap?: Record<string, (value: unknown) => string>;
  /** Whether to apply automatic PII masking (default: true) */
  autoMaskPII?: boolean;
  /** Additional field names to mask beyond the auto-detected ones */
  extraPIIFields?: string[];
  /** Date format function */
  formatDate?: (date: unknown) => string;
}

/**
 * Convert data array to CSV string with mandatory PII masking
 */
export function generateCSV(options: CSVExportOptions): string {
  const { headers, rows, piiMaskMap, autoMaskPII = true, extraPIIFields, formatDate } = options;

  const defaultFormatDate = (d: unknown) => {
    if (!d) return '';
    try { return new Date(d as string).toISOString(); } catch { return String(d); }
  };
  const fmtDate = formatDate || defaultFormatDate;

  // Apply PII masking to all rows before generating CSV
  const maskedRows = autoMaskPII
    ? rows.map(row => {
        // First apply auto-sanitization
        let masked = sanitizeObject(row, [...LIST_VIEW_PII_FIELDS, ...(extraPIIFields || [])]);
        // Then apply explicit mask map if provided (overrides auto-detection)
        if (piiMaskMap) {
          const overrideMasked = { ...masked };
          for (const [field, masker] of Object.entries(piiMaskMap)) {
            if (overrideMasked[field] !== undefined) {
              overrideMasked[field] = masker(overrideMasked[field]);
            }
          }
          masked = overrideMasked;
        }
        return masked;
      })
    : rows.map(row => {
        // Even with autoMaskPII=false, apply explicit mask map if provided
        if (!piiMaskMap) return row;
        const masked = { ...row };
        for (const [field, masker] of Object.entries(piiMaskMap)) {
          if (masked[field] !== undefined) {
            masked[field] = masker(masked[field]);
          }
        }
        return masked;
      });

  // Build header row
  const headerRow = headers.map(escapeCSV).join(',');

  // Build data rows
  const dataRows = maskedRows.map(row => {
    return headers.map(header => {
      let value = row[header];

      // Format dates
      if (value instanceof Date || (typeof value === 'string' && header.toLowerCase().includes('date') && value)) {
        value = fmtDate(value);
      }

      return escapeCSV(value ?? '');
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Trigger CSV download in browser
 */
export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escape a CSV field value
 */
function escapeCSV(value: unknown): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate audit pack CSV with standard IC-OS formatting and PII masking
 */
export function generateAuditPackCSV(audits: Record<string, unknown>[]): string {
  return generateCSV({
    filename: 'audit-pack',
    headers: ['auditNumber', 'title', 'auditType', 'status', 'scheduledDate', 'completedDate', 'leadAuditor', 'riskLevel', 'remediationStatus', 'department'],
    rows: audits,
    extraPIIFields: ['leadAuditor'],
    formatDate: (d) => {
      if (!d) return '';
      try { return new Date(d as string).toLocaleDateString('en-AE'); } catch { return String(d); }
    },
  });
}

/**
 * Generate adverse media report CSV with PII masking
 */
export function generateAdverseMediaCSV(sessions: Record<string, unknown>[], maskName: (v: unknown) => string): string {
  return generateCSV({
    filename: 'adverse-media-report',
    headers: ['subjectName', 'subjectType', 'decision', 'rationale', 'createdAt'],
    rows: sessions,
    piiMaskMap: { subjectName: maskName },
  });
}
