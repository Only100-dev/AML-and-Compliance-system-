import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { createAuditLog } from '@/lib/audit';
import { applyRateLimit } from '@/lib/rate-limit';

// ─── Zod Validation Schema ──────────────────────────────────────────────────

const AdverseMediaDecideSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  decision: z.enum(['CLEAR', 'FALSE_POSITIVE', 'POTENTIAL_MATCH', 'CONFIRMED_MATCH']),
  rationale: z.string().min(10, 'Rationale must be at least 10 characters for audit trail'),
});

type AdverseMediaDecideInput = z.infer<typeof AdverseMediaDecideSchema>;

// ─── PATCH: Record Classification Decision ──────────────────────────────────

export async function PATCH(request: NextRequest) {
  // ── Step 1: Auth Guard ──────────────────────────────────────────────────
  const auth = await authGuard({
    allowedRoles: ['admin', 'mlro', 'compliance_officer', 'compliance_manager'],
  });

  if (!auth.authorized) {
    return auth.error ?? NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }
  const rateLimitError = applyRateLimit(auth, request, 'WRITE');
  if (rateLimitError) return rateLimitError;

  const userId = (auth.session?.user as Record<string, unknown>)?.userId as string ?? 'unknown';
  const userName = (auth.session?.user as Record<string, unknown>)?.name as string ?? 'Unknown User';

  // ── Step 2: Validate Request Body ───────────────────────────────────────
  let parsed: AdverseMediaDecideInput;
  try {
    const body = await request.json();
    const result = AdverseMediaDecideSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: result.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 422 }
      );
    }

    parsed = result.data;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 422 }
    );
  }

  const { sessionId, decision, rationale } = parsed;

  // ── Step 3: Business Rule — CONFIRMED_MATCH requires longer rationale ───
  if (decision === 'CONFIRMED_MATCH' && rationale.length < 20) {
    return NextResponse.json(
      {
        success: false,
        error: 'CONFIRMED_MATCH decisions require a rationale of at least 20 characters for enhanced audit trail',
        details: [
          {
            field: 'rationale',
            message: `Rationale is ${rationale.length} characters but must be at least 20 for CONFIRMED_MATCH decisions`,
          },
        ],
      },
      { status: 422 }
    );
  }

  // ── Step 4: Verify Session Exists ───────────────────────────────────────
  let existingSession;
  try {
    existingSession = await db.adverseMediaSession.findUnique({
      where: { id: sessionId },
    });
  } catch (dbError) {
    console.error('[ADVERSE_MEDIA_DECIDE] Database lookup error:', dbError);
    return NextResponse.json(
      { success: false, error: 'Failed to lookup adverse media session' },
      { status: 500 }
    );
  }

  if (!existingSession) {
    return NextResponse.json(
      { success: false, error: 'Adverse media session not found' },
      { status: 404 }
    );
  }

  // ── Step 5: Update Session with Decision ────────────────────────────────
  let updatedSession;
  try {
    updatedSession = await db.adverseMediaSession.update({
      where: { id: sessionId },
      data: {
        decision,
        rationale,
      },
    });
  } catch (dbError) {
    console.error('[ADVERSE_MEDIA_DECIDE] Database update error:', dbError);
    return NextResponse.json(
      { success: false, error: 'Failed to update adverse media session with decision' },
      { status: 500 }
    );
  }

  // ── Step 6: Create Audit Log Entry ──────────────────────────────────────
  try {
    await createAuditLog({
      userId,
      action: 'ADVERSE_MEDIA_DECIDE',
      resourceType: 'AdverseMediaSession',
      resourceId: sessionId,
      details: `Classification decision "${decision}" recorded for session "${sessionId}" (subject: "${existingSession.subjectName}") by ${userName}. Rationale: "${rationale.substring(0, 100)}${rationale.length > 100 ? '...' : ''}"`,
      changes: {
        previousDecision: existingSession.decision || null,
        newDecision: decision,
        rationaleLength: rationale.length,
        subjectName: existingSession.subjectName,
        subjectType: existingSession.subjectType,
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });
  } catch (auditError) {
    // Audit log failure should not fail the request, but log it
    console.error('[ADVERSE_MEDIA_DECIDE] Audit log creation failed:', auditError);
  }

  // ── Step 7: Return Success Response ─────────────────────────────────────
  return NextResponse.json({
    success: true,
    data: {
      ...updatedSession,
      results: updatedSession.results ? JSON.parse(updatedSession.results) : [],
      searchConfig: updatedSession.searchConfig ? JSON.parse(updatedSession.searchConfig) : {},
    },
    message: 'Classification decision recorded',
  });
}
