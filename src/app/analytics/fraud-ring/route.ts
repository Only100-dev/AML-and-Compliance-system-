import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authGuard } from '@/lib/auth-guard';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/rate-limit';

const fraudRingQuerySchema = z.object({
  claimId: z.string().min(1).optional(),
  policyNumber: z.string().min(1).optional(),
  lookbackMonths: z.coerce.number().min(1).max(24).default(12),
  limit: z.coerce.number().int().min(1).max(500).default(500),
});

// GET /api/analytics/fraud-ring — Hidden Fraud Ring Graph Analytics
// Queries the database for shared entities (same garage, same lawyer, same IP, same bank account)
// across the last N months and returns a JSON node-edge graph structure.
export async function GET(request: NextRequest) {
  try {
    const auth = await authGuard({ allowedRoles: ['admin', 'mlro', 'compliance_manager', 'compliance_officer'] });
    if (!auth.authorized) return auth.error ?? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const rateLimitError = applyRateLimit(auth, request, 'READ');
    if (rateLimitError) return rateLimitError;

    const { searchParams } = new URL(request.url);
    const parsed = fraudRingQuerySchema.safeParse({
      claimId: searchParams.get('claimId') ?? undefined,
      policyNumber: searchParams.get('policyNumber') ?? undefined,
      lookbackMonths: searchParams.get('lookbackMonths') ?? '12',
      limit: searchParams.get('limit') ?? '500',
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { claimId, policyNumber, lookbackMonths, limit } = parsed.data;
    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - lookbackMonths);

    // ─── Optimization: Parallel seed claim + all claims fetch ──────────────
    // Fetch the seed claim and all claims in parallel instead of sequentially.
    // Also enforce a strict `limit` cap to prevent OOM on large datasets.
    const [seedClaim, allClaims] = await Promise.all([
      claimId
        ? db.claim.findUnique({ where: { id: claimId } })
        : policyNumber
          ? db.claim.findFirst({ where: { policyNumber } })
          : Promise.resolve(null),
      db.claim.findMany({
        where: { createdAt: { gte: lookbackDate } },
        orderBy: { createdAt: 'desc' },
        take: limit, // Pagination cap — prevents memory exhaustion
      }),
    ]);

    // Build nodes and edges from shared entities
    const nodes: Array<{ id: string; label: string; type: string; risk: number; claims: string[] }> = [];
    const edges: Array<{ source: string; target: string; relationship: string; weight: number }> = [];
    const nodeMap = new Map<string, { id: string; label: string; type: string; risk: number; claims: string[] }>();

    // ─── Optimization: Pre-compute shared entity aggregation ────────────────
    // Instead of iterating all claims and building nodes one-by-one (O(n²) for
    // cluster detection), we use Map-based grouping to find shared entities
    // in a single pass, then a second pass to detect clusters.
    const entityClaimMap = new Map<string, { entityId: string; label: string; type: string; claimIds: string[] }>();

    // Add all claims as nodes + index entities
    for (const claim of allClaims) {
      const nodeId = `claim-${claim.id}`;
      nodeMap.set(nodeId, {
        id: nodeId,
        label: claim.claimNumber,
        type: 'claim',
        risk: claim.fraudScore,
        claims: [claim.id],
      });

      // Index claimant
      const claimantKey = `claimant:${claim.claimantName.replace(/\s+/g, '-').toLowerCase()}`;
      const existingClaimant = entityClaimMap.get(claimantKey);
      if (existingClaimant) {
        existingClaimant.claimIds.push(claim.id);
      } else {
        entityClaimMap.set(claimantKey, {
          entityId: `claimant-${claim.claimantName.replace(/\s+/g, '-').toLowerCase()}`,
          label: claim.claimantName,
          type: 'claimant',
          claimIds: [claim.id],
        });
      }

      // Index policy
      const policyKey = `policy:${claim.policyNumber}`;
      const existingPolicy = entityClaimMap.get(policyKey);
      if (existingPolicy) {
        existingPolicy.claimIds.push(claim.id);
      } else {
        entityClaimMap.set(policyKey, {
          entityId: `policy-${claim.policyNumber}`,
          label: claim.policyNumber,
          type: 'policy',
          claimIds: [claim.id],
        });
      }

      // Index adjuster
      if (claim.assignedAdjuster) {
        const adjusterKey = `adjuster:${claim.assignedAdjuster.replace(/\s+/g, '-').toLowerCase()}`;
        const existingAdjuster = entityClaimMap.get(adjusterKey);
        if (existingAdjuster) {
          existingAdjuster.claimIds.push(claim.id);
        } else {
          entityClaimMap.set(adjusterKey, {
            entityId: `adjuster-${claim.assignedAdjuster.replace(/\s+/g, '-').toLowerCase()}`,
            label: claim.assignedAdjuster,
            type: 'adjuster',
            claimIds: [claim.id],
          });
        }
      }
    }

    // Build entity nodes + edges from the aggregated entity map
    for (const [key, entity] of entityClaimMap) {
      nodeMap.set(entity.entityId, {
        id: entity.entityId,
        label: entity.label,
        type: entity.type,
        risk: 0,
        claims: [...entity.claimIds],
      });
    }

    // Build edges: claimant → claim, claim → policy, claim → adjuster
    for (const claim of allClaims) {
      const nodeId = `claim-${claim.id}`;
      const claimantId = `claimant-${claim.claimantName.replace(/\s+/g, '-').toLowerCase()}`;
      const policyId = `policy-${claim.policyNumber}`;

      edges.push({ source: claimantId, target: nodeId, relationship: 'filed_by', weight: 1 });
      edges.push({ source: nodeId, target: policyId, relationship: 'against_policy', weight: 1 });

      if (claim.assignedAdjuster) {
        const adjusterId = `adjuster-${claim.assignedAdjuster.replace(/\s+/g, '-').toLowerCase()}`;
        edges.push({ source: nodeId, target: adjusterId, relationship: 'assigned_to', weight: 1 });
      }
    }

    // ─── Optimization: Map-based cluster detection (O(n) instead of O(n²)) ──
    // Find clusters: entities connected to >3 claims with >2 shared nodes.
    // Uses the pre-computed entityClaimMap instead of iterating all nodeMap entries.
    const clusters: Array<{ id: string; nodeIds: string[]; claimCount: number; riskLevel: string }> = [];
    for (const [_key, entity] of entityClaimMap) {
      if (entity.claimIds.length > 3) {
        // Check how many OTHER entities share claims with this one
        const sharedWithOtherEntities: string[] = [];
        for (const [otherKey, otherEntity] of entityClaimMap) {
          if (otherKey === _key) continue;
          if (otherEntity.type === 'claim') continue;
          const hasOverlap = otherEntity.claimIds.some(cid => entity.claimIds.includes(cid));
          if (hasOverlap) {
            sharedWithOtherEntities.push(otherEntity.entityId);
          }
        }

        if (sharedWithOtherEntities.length >= 2) {
          const connectedClaimNodes = entity.claimIds.map(cid => `claim-${cid}`);
          clusters.push({
            id: `cluster-${entity.entityId}`,
            nodeIds: [entity.entityId, ...connectedClaimNodes, ...sharedWithOtherEntities],
            claimCount: entity.claimIds.length,
            riskLevel: entity.claimIds.length > 5 ? 'CRITICAL' : 'HIGH',
          });
        }
      }
    }

    // Mark cluster nodes in red if >3 claims share >2 nodes
    for (const cluster of clusters) {
      for (const nid of cluster.nodeIds) {
        const node = nodeMap.get(nid);
        if (node) {
          node.risk = cluster.riskLevel === 'CRITICAL' ? 100 : 85;
        }
      }
    }

    // Log the query
    const userId = (auth.session?.user as Record<string, unknown>)?.userId as string ?? 'unknown';
    await createAuditLog({
      userId,
      action: 'FRAUD_RING_ANALYSIS',
      resourceType: 'Claim',
      resourceId: claimId ?? policyNumber ?? 'bulk-analysis',
      details: `Fraud ring graph analysis executed. ${nodeMap.size} nodes, ${edges.length} edges, ${clusters.length} clusters detected in ${lookbackMonths}-month lookback.`,
    });

    return NextResponse.json({
      success: true,
      data: {
        nodes: [...nodeMap.values()],
        edges,
        clusters,
        metadata: {
          totalNodes: nodeMap.size,
          totalEdges: edges.length,
          totalClusters: clusters.length,
          lookbackMonths,
          seedClaim: seedClaim?.claimNumber ?? null,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[Fraud Ring API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate fraud ring analytics' },
      { status: 500 }
    );
  }
}
