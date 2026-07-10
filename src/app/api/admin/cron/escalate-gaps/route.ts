import { NextRequest, NextResponse } from 'next/server';
import { escalateOverdueGaps } from '@/lib/gaps/auto-generation';
import { withAuditLog } from '@/lib/audit-worm';

/**
 * POST /api/cron/escalate-gaps — Escalate overdue gaps
 * Called by the daily cron job or manually by admin.
 * 
 * PRINCIPLE C: Overdue gaps auto-escalate.
 * 
 * Security: Requires CRON_SECRET bearer token for authentication.
 */
export const POST = withAuditLog(
  async (request: NextRequest) => {
  try {
    // CRON_SECRET bearer check (required by audit check)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid or missing CRON_SECRET' }, { status: 401 });
    }

    const result = await escalateOverdueGaps();

    return NextResponse.json({
      success: true,
      data: {
        escalated: result.escalated,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to escalate gaps:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to escalate gaps' },
      { status: 500 }
    );
  }
  },
  { entityType: 'GapEscalation' }
);
