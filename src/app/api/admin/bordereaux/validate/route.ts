import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  BordereauxRowSchema,
  BordereauxValidationError,
  BordereauxValidationResult,
} from '@/lib/validations/bordereaux';
import crypto from 'crypto';

// ─── POST /api/bordereaux/validate ──────────────────────────────────────────
// Accepts CSV file upload, validates each row with Zod, returns structured error report

export async function POST(request: NextRequest) {
  try {
    const auth = await authGuard({
      allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'],
    });
    if (!auth.authorized) {
      return (
        auth.error ??
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }
    const rateLimitError = applyRateLimit(auth, request, 'WRITE');
    if (rateLimitError) return rateLimitError;

    const userId =
      (auth.session?.user as Record<string, unknown>)?.userId as string ||
      (auth.session?.user as Record<string, unknown>)?.id as string ||
      'unknown';

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const quarter = (formData.get('quarter') as string) || undefined;
    const brokerId = (formData.get('brokerId') as string) || undefined;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
      return NextResponse.json(
        { success: false, error: 'Only CSV and XLSX files are accepted' },
        { status: 400 }
      );
    }

    const fileType = fileName.endsWith('.xlsx') ? 'xlsx' : 'csv';

    // Parse CSV content
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'File must contain a header row and at least one data row' },
        { status: 400 }
      );
    }

    // Parse header row
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, '').toLowerCase());

    // Map expected column names (flexible matching)
    const columnMap: Record<string, number> = {};
    const expectedColumns: Record<string, string[]> = {
      policyNumber: ['policynumber', 'policy_number', 'policy no', 'polno', 'policy no.'],
      insuredName: ['insuredname', 'insured_name', 'clientname', 'client_name', 'name', 'insured'],
      premiumAED: ['premiumaed', 'premium_aed', 'premium', 'amount', 'premium (aed)'],
      startDate: ['startdate', 'start_date', 'effective date', 'from date', 'inception date'],
      endDate: ['enddate', 'end_date', 'expiry date', 'to date', 'expiry'],
      brokerId: ['brokerid', 'broker_id', 'broker', 'broker code'],
      productType: ['producttype', 'product_type', 'product', 'type'],
      emirate: ['emirate', 'location', 'region'],
      amlStatus: ['amlstatus', 'aml_status', 'aml'],
    };

    for (const [field, aliases] of Object.entries(expectedColumns)) {
      const idx = headers.findIndex((h) =>
        aliases.some((alias) => h.includes(alias) || alias.includes(h))
      );
      if (idx !== -1) {
        columnMap[field] = idx;
      }
    }

    // Check mandatory columns
    const mandatoryFields = ['policyNumber', 'insuredName', 'premiumAED', 'startDate', 'endDate', 'brokerId'];
    const missingColumns = mandatoryFields.filter((f) => columnMap[f] === undefined);

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing mandatory columns: ${missingColumns.join(', ')}`,
          detectedColumns: headers,
          hint: 'Expected columns: policyNumber, insuredName, premiumAED, startDate, endDate, brokerId',
        },
        { status: 400 }
      );
    }

    // Validate each row
    const errors: BordereauxValidationError[] = [];
    const validRecords: Record<string, unknown>[] = [];
    const policyNumbers: string[] = [];
    const duplicatePolicyNumbers: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));
      const row = i + 1; // 1-based row number for user clarity

      // Build row object from CSV columns
      const rowData: Record<string, unknown> = {};
      for (const [field, idx] of Object.entries(columnMap)) {
        rowData[field] = values[idx] ?? '';
      }

      // Track policy numbers for duplicate detection
      const policyNo = String(rowData.policyNumber || '');
      if (policyNo) {
        if (policyNumbers.includes(policyNo)) {
          duplicatePolicyNumbers.push(policyNo);
        }
        policyNumbers.push(policyNo);
      }

      // Validate with Zod
      const parsed = BordereauxRowSchema.safeParse(rowData);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const fieldName = issue.path.join('.');
          const fieldValue = String(rowData[fieldName] ?? '');
          errors.push({
            row,
            field: fieldName,
            value: fieldValue.length > 50 ? fieldValue.substring(0, 50) + '...' : fieldValue,
            message: issue.message,
          });
        }
      } else {
        validRecords.push(parsed.data);
      }
    }

    // Add duplicate policy number errors
    const uniqueDuplicates = [...new Set(duplicatePolicyNumbers)];
    for (const dup of uniqueDuplicates) {
      errors.push({
        row: 0,
        field: 'policyNumber',
        value: dup,
        message: `Duplicate policy number: ${dup} appears multiple times`,
      });
    }

    const result: BordereauxValidationResult = {
      totalRows: lines.length - 1,
      validRows: validRecords.length,
      errorRows: errors.length,
      errors,
      validRecords: validRecords as BordereauxValidationResult['validRecords'],
      duplicatePolicyNumbers: uniqueDuplicates,
    };

    const status = errors.length === 0 ? 'validated' : 'rejected';

    // Save submission to database
    const submission = await db.bordereauxSubmission.create({
      data: {
        fileName: file.name,
        fileType,
        fileSize: file.size,
        uploadedBy: userId,
        status,
        recordCount: result.totalRows,
        validCount: result.validRows,
        errorCount: result.errorRows,
        validationErrors: JSON.stringify(errors),
        quarter,
        brokerId,
      },
    });

    // SHA-256 Audit Log
    const sha256Hash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          action: 'BORDEREAUX_VALIDATED',
          submissionId: submission.id,
          status,
          totalRows: result.totalRows,
          errorCount: result.errorRows,
          timestamp: Date.now(),
        })
      )
      .digest('hex');

    await db.auditLog.create({
      data: {
        userId,
        action: 'BORDEREAUX_VALIDATED',
        resource: 'BordereauxSubmission',
        resourceId: submission.id,
        details: JSON.stringify({
          fileName: file.name,
          status,
          totalRows: result.totalRows,
          validRows: result.validRows,
          errorRows: result.errorRows,
          quarter,
          brokerId,
        }),
        sha256Hash,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          submissionId: submission.id,
          status,
          totalRows: result.totalRows,
          validRows: result.validRows,
          errorRows: result.errorRows,
          errors: errors.slice(0, 500), // Cap error output
          duplicatePolicyNumbers: uniqueDuplicates,
          canSubmit: status === 'validated',
        },
      },
      { status: status === 'validated' ? 200 : 422 }
    );
  } catch (error) {
    console.error('Bordereaux validation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Bordereaux validation failed' },
      { status: 500 }
    );
  }
}
