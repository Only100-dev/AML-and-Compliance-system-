/**
 * IC-OS v7.3.0-RC1 — UAT Data Seeding Script
 * Populates the database with synthetic data for testing the AI engine
 * (HAMI-GNN and TGN models).
 *
 * Uses EXISTING Prisma models only — no Entity or Transaction models.
 *
 * Seed Scenarios:
 *   1. Structuring Cluster   (HAMI-GNN fan-out pattern)
 *   2. Temporal Anomaly      (TGN policy laddering)
 *   3. Intelligence Graph     (IntelligenceItem + IntelligenceEntity)
 *   4. Audit Trail Proof      (WORM chain-sealed AuditLog entries)
 *
 * Usage:
 *   bun run prisma/seed-uat.ts
 */

import { db } from '@/lib/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simple SHA-256-like deterministic hash for audit chain (not crypto-grade, for UAT only) */
function fauxHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8) +
         ('00000000' + ((h * 0x12345678) >>> 0).toString(16)).slice(-8) +
         ('00000000' + ((h * 0x87654321) >>> 0).toString(16)).slice(-8) +
         ('00000000' + ((h * 0xabcdef01) >>> 0).toString(16)).slice(-8);
}

// Base date for temporal scenario (30 days ago)
const BASE_DATE = new Date('2025-01-15T00:00:00.000Z');

// ─── Scenario 1: Structuring Cluster (HAMI-GNN Fan-Out) ──────────────────────

async function seedStructuringCluster() {
  console.log('\n📡 Scenario 1: Structuring Cluster (HAMI-GNN Fan-Out Pattern)');

  // 1a. CorporateKYC — 1 broker network + 4 shell corporations
  const brokerA = await db.corporateKYC.upsert({
    where: { id: 'UAT-BROKER-A' },
    update: {},
    create: {
      id: 'UAT-BROKER-A',
      legalName: 'Al Rashid Brokerage Network LLC',
      tradeLicenseNo: 'CN-123456',
      trn: '100123456700003',
      legalForm: 'LLC',
      uboIdentified: true,
      uboDetails: JSON.stringify([
        { name: 'Ahmed Al Rashid', ownershipPct: 60, pep: false },
        { name: 'Saeed Al Maktoum', ownershipPct: 40, pep: true },
      ]),
      pepInManagement: true,
      riskScore: 78,
      riskRating: 'HIGH',
      status: 'APPROVED',
      jurisdiction: 'UAE',
    },
  });

  const shells = [];
  for (let i = 1; i <= 4; i++) {
    const shell = await db.corporateKYC.upsert({
      where: { id: `UAT-SHELL-${i}` },
      update: {},
      create: {
        id: `UAT-SHELL-${i}`,
        legalName: `Gulf Horizon Ventures ${i} LLC`,
        tradeLicenseNo: `CN-SHELL-${String(i).padStart(6, '0')}`,
        trn: `20012345670000${i}`,
        legalForm: 'Free Zone',
        uboIdentified: false,
        uboDetails: null,
        pepInManagement: false,
        riskScore: 85 + i,
        riskRating: 'HIGH',
        status: 'PENDING_MAKER_CHECKER',
        jurisdiction: 'UAE',
      },
    });
    shells.push(shell);
  }

  console.log(`   ✅ Created 1 broker + 4 shell CorporateKYC records`);

  // 1b. AMLAlerts — structuring just below 10K AED threshold
  const structuringAmounts = [9500, 9600, 9700, 9800];
  const alerts: Awaited<ReturnType<typeof db.aMLAlert.upsert>>[] = [];

  for (let i = 0; i < structuringAmounts.length; i++) {
    const amt = structuringAmounts[i];
    const alert = await db.aMLAlert.upsert({
      where: { caseId: `UAT-STRUCT-${String(i + 1).padStart(3, '0')}` },
      update: {},
      create: {
        id: `UAT-AML-STRUCT-${i + 1}`,
        caseId: `UAT-STRUCT-${String(i + 1).padStart(3, '0')}`,
        riskScore: 0.82 + i * 0.03,
        riskLevel: 'high',
        alertType: 'STRUCTURING',
        description: `Structuring transaction detected: AED ${amt.toLocaleString()} transfer from Shell-${i + 1} via BROKER-A — just below AED 10,000 reporting threshold`,
        aiFlags: JSON.stringify({
          model: 'HAMI-GNN',
          version: 'v2.3',
          clusterId: 'CLUSTER-BROKER-A-FANOUT',
          nodeRole: i === 0 ? 'hub' : 'spoke',
          connectedNodes: [`UAT-SHELL-${i + 1}`, 'UAT-BROKER-A'],
          graphMetric: {
            degreeCentrality: i === 0 ? 0.91 : 0.23,
            betweenness: i === 0 ? 0.78 : 0.12,
            communityDetection: 'cluster-7',
          },
          patternType: 'FAN_OUT_STRUCTURING',
          confidence: 0.85 + i * 0.02,
        }),
        status: 'new',
        assignedTo: 'UAT-USER-MLRO',
        createdBy: 'UAT-USER-MLRO',
        jurisdiction: 'UAE',
        amount: amt,
        policyNumber: `POL-STRUCT-${i + 1}`,
      },
    });
    alerts.push(alert);
  }

  console.log(`   ✅ Created 4 structuring AMLAlerts (amounts: ${structuringAmounts.join(', ')} AED)`);

  // 1c. SARCase linking to the first alert
  const triggerDate = new Date('2025-01-20T00:00:00.000Z');
  const filingDeadline = new Date(triggerDate);
  filingDeadline.setDate(filingDeadline.getDate() + 30);

  const sarCase = await db.sARCase.upsert({
    where: { caseNumber: 'UAT-SAR-STRUCT-001' },
    update: {},
    create: {
      id: 'UAT-SAR-STRUCT-001',
      caseNumber: 'UAT-SAR-STRUCT-001',
      alertId: alerts[0].id,
      filingDeadline,
      triggerDate,
      daysRemaining: 25,
      status: 'DRAFT',
      narrative: 'HAMI-GNN cluster analysis identified a fan-out structuring pattern orchestrated through Al Rashid Brokerage Network LLC, with 4 shell corporations conducting sub-threshold transfers (AED 9,500 – 9,800) within a 72-hour window. All entities share registered agent and Free Zone jurisdiction. UBO identification incomplete for shell entities.',
      tippingOffWarning: true,
      subjectName: 'Al Rashid Brokerage Network LLC',
      subjectType: 'ENTITY',
      jurisdiction: 'UAE',
      riskLevel: 'high',
      createdById: 'UAT-USER-MLRO',
    },
  });

  console.log(`   ✅ Created SARCase ${sarCase.caseNumber} linked to alert ${alerts[0].caseId}`);

  return { brokerA, shells, alerts, sarCase };
}

// ─── Scenario 2: Temporal Anomaly (TGN Policy Laddering) ─────────────────────

async function seedTemporalAnomaly() {
  console.log('\n⏱️  Scenario 2: Temporal Anomaly (TGN Policy Laddering)');

  // 2a. CorporateKYC for the subject (KSA jurisdiction)
  const customerX = await db.corporateKYC.upsert({
    where: { id: 'UAT-CUSTOMER-X' },
    update: {},
    create: {
      id: 'UAT-CUSTOMER-X',
      legalName: 'Al Faisal Trading Est.',
      tradeLicenseNo: 'KSA-TRD-987654',
      trn: '300987654300003',
      legalForm: 'LLC',
      uboIdentified: true,
      uboDetails: JSON.stringify([
        { name: 'Mohammed Al Faisal', ownershipPct: 100, pep: false },
      ]),
      pepInManagement: false,
      riskScore: 62,
      riskRating: 'MEDIUM',
      status: 'APPROVED',
      jurisdiction: 'KSA',
    },
  });

  console.log(`   ✅ Created CorporateKYC for Customer X (KSA)`);

  // 2b. 3 normal premium claims (1000 SAR each, 30 days apart)
  const normalClaims: Awaited<ReturnType<typeof db.claim.upsert>>[] = [];
  for (let i = 0; i < 3; i++) {
    const claimDate = new Date(BASE_DATE);
    claimDate.setDate(claimDate.getDate() + i * 30);

    const claim = await db.claim.upsert({
      where: { claimNumber: `UAT-CLM-NORM-${String(i + 1).padStart(3, '0')}` },
      update: {},
      create: {
        id: `UAT-CLM-NORM-${i + 1}`,
        claimNumber: `UAT-CLM-NORM-${String(i + 1).padStart(3, '0')}`,
        policyNumber: 'POL-KSA-2024-0042',
        claimType: 'PREMIUM',
        claimantName: 'Al Faisal Trading Est.',
        description: `Regular premium payment ${i + 1} of 3 — SAR 1,000 (30-day interval)`,
        amount: 1000,
        fraudScore: 0.1,
        status: 'approved',
        priority: 'normal',
        assignedAdjuster: 'UAT-ADJUSTER-1',
        siuFlagged: false,
        jurisdiction: 'KSA',
        createdAt: claimDate,
      },
    });
    normalClaims.push(claim);
  }

  console.log(`   ✅ Created 3 normal premium Claims (1,000 SAR each, 30-day intervals)`);

  // 2c. 1 anomalous high-value claim
  const anomalyDate = new Date(BASE_DATE);
  anomalyDate.setDate(anomalyDate.getDate() + 90); // right after the 3rd normal payment

  const anomalyClaim = await db.claim.upsert({
    where: { claimNumber: 'UAT-CLM-ANOM-001' },
    update: {},
    create: {
      id: 'UAT-CLM-ANOM-001',
      claimNumber: 'UAT-CLM-ANOM-001',
      policyNumber: 'POL-KSA-2024-0042',
      claimType: 'CLAIM',
      claimantName: 'Al Faisal Trading Est.',
      description: 'Sudden high-value claim filed immediately after 3-month premium ladder. TGN temporal anomaly detected — policy laddering pattern with 50x value jump.',
      amount: 50000,
      fraudScore: 0.92,
      status: 'under_investigation',
      priority: 'critical',
      assignedAdjuster: 'UAT-ADJUSTER-SIU',
      siuFlagged: true,
      jurisdiction: 'KSA',
      createdAt: anomalyDate,
    },
  });

  console.log(`   ✅ Created anomalous Claim (50,000 SAR, fraudScore=0.92, SIU flagged)`);

  // 2d. ComplianceAlert for the anomaly
  const alertDueDate = new Date(anomalyDate);
  alertDueDate.setDate(alertDueDate.getDate() + 7);

  const complianceAlert = await db.complianceAlert.upsert({
    where: { id: 'UAT-CALERT-ANOM-001' },
    update: {},
    create: {
      id: 'UAT-CALERT-ANOM-001',
      alertType: 'MLRO_ESCALATION',
      severity: 'critical',
      status: 'active',
      title: 'TGN Temporal Anomaly — Policy Laddering Escalation',
      description: 'TGN model detected policy laddering pattern for Al Faisal Trading Est. (POL-KSA-2024-0042). Three regular premium payments of SAR 1,000 followed by a SAR 50,000 claim — 50x value jump. Fraud score: 0.92. Escalated to MLRO for SAR filing consideration.',
      sourceModule: 'TGN_ENGINE',
      sourceEntityId: anomalyClaim.id,
      sourceEntityType: 'Claim',
      dueDate: alertDueDate,
      assignedToId: 'UAT-USER-MLRO',
      isImmutable: true,
      sha256Hash: fauxHash(`UAT-CALERT-ANOM-001:MLRO_ESCALATION:${anomalyDate.toISOString()}`),
    },
  });

  console.log(`   ✅ Created ComplianceAlert (MLRO_ESCALATION, severity=critical)`);

  return { customerX, normalClaims, anomalyClaim, complianceAlert };
}

// ─── Scenario 3: Intelligence Graph Data ──────────────────────────────────────

async function seedIntelligenceGraph() {
  console.log('\n🧠 Scenario 3: Intelligence Graph Data');

  // 3a. IntelligenceItem for the structuring cluster
  const structuringIntel = await db.intelligenceItem.upsert({
    where: { id: 'UAT-INTEL-STRUCT-001' },
    update: {},
    create: {
      id: 'UAT-INTEL-STRUCT-001',
      title: 'HAMI-GNN Cluster Detection: UAE Structuring Network',
      summary: 'HAMI-GNN graph neural network identified a fan-out structuring cluster centered on Al Rashid Brokerage Network LLC. Four shell corporations are conducting sub-threshold AED transfers (9,500–9,800) in coordinated windows. Community detection algorithm assigns cluster-7 with 0.91 hub centrality for the broker node.',
      sourceName: 'HAMI-GNN Engine',
      sourceUrl: null,
      category: 'ENFORCEMENT',
      riskScore: 88,
      riskLevel: 'HIGH',
      credibility: 'VERIFIED',
      jurisdictionId: 'AE',
      regulator: 'CBUAE',
      publishedDate: new Date('2025-01-18T00:00:00.000Z'),
      aiSummary: 'Graph analysis confirms coordinated structuring pattern. Hub-spoke topology with broker at center. Recommended: SAR filing and enhanced due diligence on all connected entities.',
      aiVerified: true,
      aiVerificationNotes: 'Cross-referenced with CBUAE regulatory database. Pattern matches known typology AO-003: Free Zone shell structuring.',
      sourceLineage: JSON.stringify([
        { step: 1, source: 'Transaction Monitoring System', timestamp: '2025-01-16T08:00:00Z' },
        { step: 2, source: 'HAMI-GNN Inference', timestamp: '2025-01-16T08:15:00Z' },
        { step: 3, source: 'Analyst Verification', timestamp: '2025-01-18T10:00:00Z' },
      ]),
      chainOfThought: JSON.stringify({
        reasoning: [
          'Identified 4 transactions below AED 10K threshold within 72h window',
          'Graph embedding shows high betweenness centrality for BROKER-A node',
          'Community detection groups all 5 entities in cluster-7',
          'UBO analysis reveals potential nominee structure',
        ],
        conclusion: 'Fan-out structuring with broker-as-hub topology',
        confidence: 0.89,
      }),
      tags: JSON.stringify(['structuring', 'hami-gnn', 'fan-out', 'UAE', 'free-zone', 'cluster-7']),
      status: 'UNDER_ANALYSIS',
      assignedToId: 'UAT-USER-MLRO',
      assignedToName: 'UAT MLRO Officer',
      dueDate: new Date('2025-02-01T00:00:00.000Z'),
    },
  });

  console.log(`   ✅ Created IntelligenceItem for structuring cluster`);

  // 3b. IntelligenceEntity records for the structuring cluster
  const structEntities = [
    {
      id: 'UAT-IE-BROKER-A',
      name: 'Al Rashid Brokerage Network LLC',
      type: 'ORGANIZATION',
      role: 'Hub / Coordinator',
      riskContribution: 91,
      metadata: JSON.stringify({ kycId: 'UAT-BROKER-A', tradeLicense: 'CN-123456', pepInManagement: true }),
    },
    ...[1, 2, 3, 4].map((i) => ({
      id: `UAT-IE-SHELL-${i}`,
      name: `Gulf Horizon Ventures ${i} LLC`,
      type: 'ORGANIZATION' as const,
      role: `Spoke / Shell-${i}`,
      riskContribution: 65 + i * 5,
      metadata: JSON.stringify({ kycId: `UAT-SHELL-${i}`, tradeLicense: `CN-SHELL-${String(i).padStart(6, '0')}`, uboIdentified: false }),
    })),
    {
      id: 'UAT-IE-UBO-RASHID',
      name: 'Ahmed Al Rashid',
      type: 'PERSON',
      role: 'UBO (60% ownership of Broker-A)',
      riskContribution: 88,
      metadata: JSON.stringify({ ownershipPct: 60, pep: false, nationality: 'UAE' }),
    },
    {
      id: 'UAT-IE-UBO-MAKTOUM',
      name: 'Saeed Al Maktoum',
      type: 'PERSON',
      role: 'UBO (40% ownership of Broker-A, PEP)',
      riskContribution: 95,
      metadata: JSON.stringify({ ownershipPct: 40, pep: true, nationality: 'UAE', pepCategory: 'domestic_political' }),
    },
  ];

  for (const entity of structEntities) {
    await db.intelligenceEntity.upsert({
      where: { id: entity.id },
      update: {},
      create: {
        id: entity.id,
        itemId: structuringIntel.id,
        name: entity.name,
        type: entity.type,
        role: entity.role,
        riskContribution: entity.riskContribution,
        metadata: entity.metadata,
      },
    });
  }

  console.log(`   ✅ Created ${structEntities.length} IntelligenceEntity records for structuring cluster`);

  // 3c. IntelligenceItem for the temporal anomaly
  const temporalIntel = await db.intelligenceItem.upsert({
    where: { id: 'UAT-INTEL-TEMPORAL-001' },
    update: {},
    create: {
      id: 'UAT-INTEL-TEMPORAL-001',
      title: 'TGN Temporal Anomaly: Policy Laddering in KSA',
      summary: 'TGN (Temporal Graph Network) model detected a policy laddering pattern for Al Faisal Trading Est. in KSA. Three regular premium payments of SAR 1,000 at 30-day intervals followed by a sudden SAR 50,000 claim — representing a 50x value anomaly. The temporal attention mechanism highlights this as a classic premium-then-claim fraud pattern.',
      sourceName: 'TGN Engine',
      sourceUrl: null,
      category: 'ADVISORY',
      riskScore: 92,
      riskLevel: 'CRITICAL',
      credibility: 'VERIFIED',
      jurisdictionId: 'SA',
      regulator: 'SAMA',
      publishedDate: new Date('2025-01-22T00:00:00.000Z'),
      aiSummary: 'Temporal graph analysis confirms policy laddering. The 3-month premium pattern establishes baseline, then the 50x claim deviation exceeds 4 standard deviations from expected behavior. Recommended: SIU investigation and potential SAR filing.',
      aiVerified: true,
      aiVerificationNotes: 'Temporal pattern matches SAMA Advisory SA-2024-012: Premium inflation schemes. Cross-referenced with claims history database.',
      sourceLineage: JSON.stringify([
        { step: 1, source: 'Claims Processing System', timestamp: '2025-01-15T00:00:00Z' },
        { step: 2, source: 'TGN Inference Engine', timestamp: '2025-01-16T00:05:00Z' },
        { step: 3, source: 'Fraud Scoring Service', timestamp: '2025-01-16T00:10:00Z' },
        { step: 4, source: 'SIU Analyst Review', timestamp: '2025-01-22T09:00:00Z' },
      ]),
      chainOfThought: JSON.stringify({
        reasoning: [
          'Identified 3 premium payments at regular 30-day intervals (SAR 1,000 each)',
          'Temporal attention weight spikes at t=90d when SAR 50,000 claim is filed',
          'Claim-to-premium ratio of 50:1 exceeds threshold (max expected: 5:1)',
          'Time delta between last premium and claim: 0 days (immediate filing)',
          'No prior claims history for this policyholder',
        ],
        conclusion: 'Policy laddering with immediate high-value claim after minimum premium period',
        confidence: 0.92,
      }),
      tags: JSON.stringify(['temporal-anomaly', 'tgn', 'policy-laddering', 'KSA', 'premium-claim-fraud', 'SAMA']),
      status: 'UNDER_ANALYSIS',
      assignedToId: 'UAT-USER-MLRO',
      assignedToName: 'UAT MLRO Officer',
      dueDate: new Date('2025-02-05T00:00:00.000Z'),
    },
  });

  console.log(`   ✅ Created IntelligenceItem for temporal anomaly`);

  // 3d. IntelligenceEntity records for the temporal anomaly
  const temporalEntities = [
    {
      id: 'UAT-IE-CUSTOMER-X',
      name: 'Al Faisal Trading Est.',
      type: 'ORGANIZATION',
      role: 'Policyholder / Claimant',
      riskContribution: 92,
      metadata: JSON.stringify({ kycId: 'UAT-CUSTOMER-X', policyNumber: 'POL-KSA-2024-0042', jurisdiction: 'KSA' }),
    },
    {
      id: 'UAT-IE-UBO-FAISAL',
      name: 'Mohammed Al Faisal',
      type: 'PERSON',
      role: 'UBO (100% ownership)',
      riskContribution: 85,
      metadata: JSON.stringify({ ownershipPct: 100, pep: false, nationality: 'SAU' }),
    },
    {
      id: 'UAT-IE-SAMA',
      name: 'SAMA',
      type: 'REGULATOR',
      role: 'Regulatory Authority',
      riskContribution: 0,
      metadata: JSON.stringify({ jurisdiction: 'KSA', supervisoryScope: 'insurance' }),
    },
  ];

  for (const entity of temporalEntities) {
    await db.intelligenceEntity.upsert({
      where: { id: entity.id },
      update: {},
      create: {
        id: entity.id,
        itemId: temporalIntel.id,
        name: entity.name,
        type: entity.type,
        role: entity.role,
        riskContribution: entity.riskContribution,
        metadata: entity.metadata,
      },
    });
  }

  console.log(`   ✅ Created ${temporalEntities.length} IntelligenceEntity records for temporal anomaly`);

  return { structuringIntel, temporalIntel };
}

// ─── Scenario 4: Audit Trail Proof ───────────────────────────────────────────

async function seedAuditTrail() {
  console.log('\n🔒 Scenario 4: Audit Trail Proof (WORM Chain-Sealed)');

  // First, ensure the UAT MLRO user exists (needed for userId FK)
  const mlroUser = await db.user.upsert({
    where: { id: 'UAT-USER-MLRO' },
    update: {},
    create: {
      id: 'UAT-USER-MLRO',
      email: 'mlro.uat@ic-os.local',
      name: 'UAT MLRO Officer',
      role: 'mlro',
      jurisdiction: 'UAE',
      isActive: true,
      passwordHash: '$2a$10$UATONLY.NOT.FOR.PRODUCTION.hash',
    },
  });

  console.log(`   ✅ Ensured UAT MLRO user exists (${mlroUser.email})`);

  // Audit chain entries — each links to the previous via prevHash
  const auditEntries = [
    {
      action: 'CREATE',
      resource: 'CorporateKYC',
      resourceId: 'UAT-BROKER-A',
      details: 'Created CorporateKYC record for Al Rashid Brokerage Network LLC — structuring cluster hub',
      aiConfidence: null,
      jurisdiction: 'UAE',
    },
    {
      action: 'AI_DETECTION',
      resource: 'AMLAlert',
      resourceId: 'UAT-AML-STRUCT-1',
      details: 'HAMI-GNN detected structuring pattern — fan-out cluster BROKER-A (community cluster-7, centrality 0.91)',
      aiConfidence: 0.89,
      jurisdiction: 'UAE',
    },
    {
      action: 'CREATE',
      resource: 'SARCase',
      resourceId: 'UAT-SAR-STRUCT-001',
      details: 'SAR case initiated for structuring cluster linked to BROKER-A and 4 shell corporations',
      aiConfidence: null,
      jurisdiction: 'UAE',
    },
    {
      action: 'CREATE',
      resource: 'CorporateKYC',
      resourceId: 'UAT-CUSTOMER-X',
      details: 'Created CorporateKYC record for Al Faisal Trading Est. — temporal anomaly subject',
      aiConfidence: null,
      jurisdiction: 'KSA',
    },
    {
      action: 'AI_DETECTION',
      resource: 'Claim',
      resourceId: 'UAT-CLM-ANOM-001',
      details: 'TGN detected temporal anomaly — policy laddering with 50x value jump after 3-month premium period (fraudScore=0.92)',
      aiConfidence: 0.92,
      jurisdiction: 'KSA',
    },
    {
      action: 'ESCALATION',
      resource: 'ComplianceAlert',
      resourceId: 'UAT-CALERT-ANOM-001',
      details: 'MLRO escalation triggered for TGN policy laddering anomaly — SAR filing consideration required within 7 days',
      aiConfidence: null,
      jurisdiction: 'KSA',
    },
    {
      action: 'AI_VERIFICATION',
      resource: 'IntelligenceItem',
      resourceId: 'UAT-INTEL-STRUCT-001',
      details: 'HAMI-GNN cluster analysis verified by AI engine. Cross-referenced with CBUAE regulatory database.',
      aiConfidence: 0.89,
      jurisdiction: 'UAE',
    },
    {
      action: 'AI_VERIFICATION',
      resource: 'IntelligenceItem',
      resourceId: 'UAT-INTEL-TEMPORAL-001',
      details: 'TGN temporal anomaly verified by AI engine. Pattern matches SAMA Advisory SA-2024-012.',
      aiConfidence: 0.92,
      jurisdiction: 'KSA',
    },
  ];

  let prevHash = 'GENESIS'; // Genesis hash for the first entry
  const createdLogs: Awaited<ReturnType<typeof db.auditLog.upsert>>[] = [];

  for (let i = 0; i < auditEntries.length; i++) {
    const entry = auditEntries[i];
    const chainIndex = 1001 + i; // Start from 1001 to avoid collision with production data
    const payload = `${prevHash}:${entry.action}:${entry.resource}:${entry.resourceId}:${chainIndex}:${entry.jurisdiction}`;
    const currentHash = fauxHash(payload);

    const log = await db.auditLog.upsert({
      where: { id: `UAT-AUDIT-${String(i + 1).padStart(4, '0')}` },
      update: {},
      create: {
        id: `UAT-AUDIT-${String(i + 1).padStart(4, '0')}`,
        userId: mlroUser.id,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details,
        aiConfidence: entry.aiConfidence,
        sha256Hash: currentHash,
        ipAddress: '10.0.0.1', // UAT internal
        jurisdiction: entry.jurisdiction,
        prevHash,
        currentHash,
        chainIndex,
        isSealed: true,
      },
    });

    createdLogs.push(log);
    prevHash = currentHash;
  }

  console.log(`   ✅ Created ${createdLogs.length} sealed AuditLog entries with chain integrity`);
  console.log(`   ✅ Chain: GENESIS → ${createdLogs.map((l) => l.currentHash?.slice(0, 8) + '…').join(' → ')}`);

  return { mlroUser, createdLogs };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding UAT Data for Graph & Temporal Triggers...');
  console.log('════════════════════════════════════════════════════════');

  // Ensure UAT MLRO user first (needed as FK for other records)
  await db.user.upsert({
    where: { id: 'UAT-USER-MLRO' },
    update: {},
    create: {
      id: 'UAT-USER-MLRO',
      email: 'mlro.uat@ic-os.local',
      name: 'UAT MLRO Officer',
      role: 'mlro',
      jurisdiction: 'UAE',
      isActive: true,
      passwordHash: '$2a$10$UATONLY.NOT.FOR.PRODUCTION.hash',
    },
  });

  // Also create SIU adjuster user
  await db.user.upsert({
    where: { id: 'UAT-ADJUSTER-SIU' },
    update: {},
    create: {
      id: 'UAT-ADJUSTER-SIU',
      email: 'siu.uat@ic-os.local',
      name: 'UAT SIU Adjuster',
      role: 'siu_investigator',
      jurisdiction: 'KSA',
      isActive: true,
      passwordHash: '$2a$10$UATONLY.NOT.FOR.PRODUCTION.hash',
    },
  });

  console.log('✅ UAT users ensured');

  const scenario1 = await seedStructuringCluster();
  const scenario2 = await seedTemporalAnomaly();
  const scenario3 = await seedIntelligenceGraph();
  const scenario4 = await seedAuditTrail();

  console.log('\n════════════════════════════════════════════════════════');
  console.log('🎉 UAT Data Seeding Complete!');
  console.log('');
  console.log('📊 Summary:');
  console.log('   Scenario 1 — Structuring Cluster (HAMI-GNN):');
  console.log('     • 5 CorporateKYC (1 broker + 4 shells)');
  console.log('     • 4 AMLAlerts (structuring, AED 9,500–9,800)');
  console.log('     • 1 SARCase (linked to first alert)');
  console.log('   Scenario 2 — Temporal Anomaly (TGN):');
  console.log('     • 1 CorporateKYC (KSA subject)');
  console.log('     • 3 normal Claims (SAR 1,000 each)');
  console.log('     • 1 anomalous Claim (SAR 50,000, fraudScore=0.92)');
  console.log('     • 1 ComplianceAlert (MLRO_ESCALATION, critical)');
  console.log('   Scenario 3 — Intelligence Graph:');
  console.log('     • 2 IntelligenceItem records');
  console.log('     • 10 IntelligenceEntity records (7 structuring + 3 temporal)');
  console.log('   Scenario 4 — Audit Trail:');
  console.log('     • 2 UAT Users (MLRO + SIU Adjuster)');
  console.log('     • 8 sealed AuditLog entries (WORM chain)');
  console.log('');
  console.log('🔑 Key IDs (UAT- prefix for easy identification):');
  console.log('   Broker:     UAT-BROKER-A');
  console.log('   Shells:     UAT-SHELL-1 … UAT-SHELL-4');
  console.log('   Customer X: UAT-CUSTOMER-X');
  console.log('   SAR Case:   UAT-SAR-STRUCT-001');
  console.log('   MLRO User:  UAT-USER-MLRO');
  console.log('════════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ UAT Seeding Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
