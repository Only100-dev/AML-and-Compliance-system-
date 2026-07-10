import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth-guard';
import { withAuditLog } from '@/lib/audit-worm';

export const runtime = 'nodejs';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

/**
 * Secure proxy gateway for the AI Inference Engine.
 *
 * Architecture:
 *   Browser → Next.js Proxy (RBAC + WORM Audit) → Python FastAPI Microservice
 *
 * This route does NOT expose the Python backend to the browser. The Next.js
 * backend enforces JWT/RBAC via authGuard and wraps every call in a WORM
 * audit log entry before forwarding to the Python backend.
 *
 * Per UAE PDPL Articles 22-23: The Python microservice runs in aws-me-central-1
 * (UAE sovereign cloud). This proxy ensures no raw PII reaches the AI engine
 * without first passing through the compliance gate.
 */
export const POST = withAuditLog(
  async (request: NextRequest) => {
    try {
      // 1. Enforce RBAC — only compliance-relevant roles may access AI inference
      const auth = await authGuard();
      if (!auth.authorized) {
        return auth.error ?? NextResponse.json({ error: 'UNAUTHORIZED_ACCESS' }, { status: 401 });
      }

      // Verify role is authorized for AI inference
      const allowedRoles = ['admin', 'mlro', 'compliance_manager', 'compliance_officer'];
      const userRole = (auth.session?.user as Record<string, unknown>)?.role as string;
      if (!userRole || !allowedRoles.includes(userRole)) {
        return NextResponse.json({ error: 'INSUFFICIENT_PRIVILEGES' }, { status: 403 });
      }

      // 2. Parse and validate the request body
      const body = await request.json();
      const action = body.action || 'predict'; // 'predict', 'explain', 'learn', 'query'
      const payload = { ...body, requestedBy: (auth.session?.user as Record<string, unknown>)?.id };
      delete payload.action; // Clean up before sending to Python

      // 3. Route to the appropriate Python backend endpoint
      const routeMap: Record<string, string> = {
        predict: '/ai/v1/predict',
        explain: '/ai/v1/explain',
        learn: '/ai/v1/learn',
        query: '/ai/v1/query',
      };
      const endpoint = routeMap[action] || '/ai/v1/predict';

      const res = await fetch(`${AI_ENGINE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        console.error(`[AI Proxy] Engine returned ${res.status}: ${errorText}`);
        return NextResponse.json(
          { error: 'AI_ENGINE_ERROR', status: res.status, details: errorText },
          { status: res.status }
        );
      }

      const result = await res.json();
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown proxy failure';
      console.error('[AI Proxy] Proxy failure:', message);
      return NextResponse.json(
        { error: 'PROXY_FAILURE', details: message },
        { status: 502 }
      );
    }
  },
  { entityType: 'AI_INFERENCE', actionPrefix: 'COGNITIVE' }
);
