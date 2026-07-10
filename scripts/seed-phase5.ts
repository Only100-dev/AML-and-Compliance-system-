/**
 * Phase 5 Seed Script — Sample data for Trackers, Scorecards, Gaps, KRI & Deadline Types
 * 
 * Run: bun run db:seed-phase5
 * 
 * This script populates:
 * 1. Regulations for all 6 GCC jurisdictions
 * 2. Audit Scorecard entries (9 themes × 6 regulators)
 * 3. Sample compliance gaps
 * 4. KRI metrics with threshold values
 * 5. Regulatory deadline types for all 6 countries
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Phase 5 data...');

  // ─── 1. Regulations for all 6 GCC jurisdictions ───────────────────────────
  const regulations = [
    // UAE (CBUAE)
    { title: 'FDL No. 10/2025 — Anti-Money Laundering', issuer: 'CBUAE', category: 'AML/CFT', description: 'Federal Decree-Law on AML/CFT, replacing Federal Law No. 20/2018', effectiveDate: new Date('2025-01-01'), complianceStatus: 'COMPLIANT', priority: 'urgent', jurisdiction: 'AE' },
    { title: 'CR 134/2025 — Consumer Protection', issuer: 'CBUAE', category: 'Products', description: 'Central Bank regulation on consumer protection in insurance', effectiveDate: new Date('2025-03-01'), complianceStatus: 'COMPLIANT', priority: 'high', jurisdiction: 'AE' },
    { title: 'Notice 3551/2021 — Data Governance', issuer: 'CBUAE', category: 'Data Privacy', description: 'Notice regarding data governance and retention requirements', effectiveDate: new Date('2021-06-01'), complianceStatus: 'COMPLIANT', priority: 'normal', jurisdiction: 'AE' },
    { title: 'Wage Protection System (WPS)', issuer: 'MOHRE', category: 'Operations', description: 'Wage Protection System compliance for employee salary payments', effectiveDate: new Date('2023-01-01'), complianceStatus: 'COMPLIANT', priority: 'high', jurisdiction: 'AE' },
    
    // KSA (SAMA)
    { title: 'SAMA AML/CFT Rules for Insurance', issuer: 'SAMA', category: 'AML/CFT', description: 'SAMA anti-money laundering rules for insurance companies', effectiveDate: new Date('2024-06-01'), complianceStatus: 'PARTIAL', priority: 'high', jurisdiction: 'SA' },
    { title: 'Nitaqat Program — Saudization Requirements', issuer: 'SAMA', category: 'Governance', description: 'Nitaqat program requirements for Saudi national employment quotas', effectiveDate: new Date('2024-01-01'), complianceStatus: 'PARTIAL', priority: 'urgent', jurisdiction: 'SA' },
    { title: 'GOSI Registration & Contributions', issuer: 'GOSI', category: 'Operations', description: 'General Organization for Social Insurance registration and monthly contributions', effectiveDate: new Date('2024-01-01'), complianceStatus: 'COMPLIANT', priority: 'high', jurisdiction: 'SA' },
    
    // Bahrain (CBB)
    { title: 'CBB AML Handbook Volume 3', issuer: 'CBB', category: 'AML/CFT', description: 'CBB AML handbook for financial institutions including insurance', effectiveDate: new Date('2024-01-01'), complianceStatus: 'COMPLIANT', priority: 'urgent', jurisdiction: 'BH' },
    { title: 'LMRA Bahrainisation Requirements', issuer: 'LMRA', category: 'Operations', description: 'Labour Market Regulatory Authority Bahrainisation quota requirements', effectiveDate: new Date('2024-06-01'), complianceStatus: 'PARTIAL', priority: 'high', jurisdiction: 'BH' },
    { title: 'SIO Registration & Contributions', issuer: 'SIO', category: 'Operations', description: 'Social Insurance Organization registration and contribution requirements', effectiveDate: new Date('2024-01-01'), complianceStatus: 'COMPLIANT', priority: 'normal', jurisdiction: 'BH' },
    
    // Qatar (QCB)
    { title: 'QCB AML/CFT Regulations for Insurance', issuer: 'QCB', category: 'AML/CFT', description: 'Qatar Central Bank AML/CFT regulations for insurance sector', effectiveDate: new Date('2024-01-01'), complianceStatus: 'PENDING', priority: 'high', jurisdiction: 'QA' },
    { title: 'Qatarisation Requirements', issuer: 'QCB', category: 'Governance', description: 'Qatar national employment quota requirements', effectiveDate: new Date('2024-01-01'), complianceStatus: 'NOT_STARTED', priority: 'normal', jurisdiction: 'QA' },
    
    // Oman (CBOA)
    { title: 'CBOA AML/CFT Directives', issuer: 'CBOA', category: 'AML/CFT', description: 'Central Bank of Oman AML/CFT directives for insurance companies', effectiveDate: new Date('2024-01-01'), complianceStatus: 'COMPLIANT', priority: 'high', jurisdiction: 'OM' },
    { title: 'Omanisation Requirements', issuer: 'CBOA', category: 'Governance', description: 'Oman national employment quota requirements for insurance sector', effectiveDate: new Date('2024-01-01'), complianceStatus: 'PARTIAL', priority: 'urgent', jurisdiction: 'OM' },
    
    // Kuwait (CBK)
    { title: 'CBK AML/CFT Instructions for Insurance', issuer: 'CBK', category: 'AML/CFT', description: 'Central Bank of Kuwait AML/CFT instructions for insurance companies', effectiveDate: new Date('2024-01-01'), complianceStatus: 'PENDING', priority: 'high', jurisdiction: 'KW' },
    { title: 'Kuwaitisation Requirements', issuer: 'CBK', category: 'Governance', description: 'Kuwait national employment quota requirements', effectiveDate: new Date('2024-01-01'), complianceStatus: 'NOT_STARTED', priority: 'normal', jurisdiction: 'KW' },
  ];

  for (const reg of regulations) {
    await prisma.regulation.upsert({
      where: { id: `seed-reg-${reg.issuer}-${reg.title.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}` },
      update: {},
      create: {
        id: `seed-reg-${reg.issuer}-${reg.title.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}`,
        ...reg,
        assignedTo: reg.jurisdiction === 'AE' ? 'Ahmed Al Mansouri' : 'Compliance Team',
        nextReviewDate: new Date('2025-12-31'),
      },
    });
  }
  console.log(`  ✅ Created ${regulations.length} regulations across 6 jurisdictions`);

  // ─── 2. Audit Scorecard entries (9 themes × 6 regulators) ────────────────
  const themes = [
    'employee-benefits', 'payroll-social-insurance', 'contracts-employment',
    'product-design', 'claims-handling', 'financial-crime',
    'governance-risk', 'data-protection', 'operational-resilience',
  ];
  const regulators = [
    { code: 'CBUAE', jurisdiction: 'AE' },
    { code: 'SAMA', jurisdiction: 'SA' },
    { code: 'CBB', jurisdiction: 'BH' },
    { code: 'QCB', jurisdiction: 'QA' },
    { code: 'CBOA', jurisdiction: 'OM' },
    { code: 'CBK', jurisdiction: 'KW' },
  ];

  // Sample gap ratings — realistic distribution
  const sampleRatings: Record<string, Record<string, number>> = {
    'financial-crime': { CBUAE: 0, SAMA: 1, CBB: 0, QCB: 2, CBOA: 1, CBK: 2 },
    'governance-risk': { CBUAE: 0, SAMA: 1, CBB: 1, QCB: 1, CBOA: 1, CBK: 1 },
    'employee-benefits': { CBUAE: 0, SAMA: 0, CBB: 0, QCB: 1, CBOA: 0, CBK: 1 },
    'payroll-social-insurance': { CBUAE: 0, SAMA: 1, CBB: 0, QCB: 1, CBOA: 0, CBK: 2 },
    'contracts-employment': { CBUAE: 0, SAMA: 0, CBB: 1, QCB: 1, CBOA: 0, CBK: 1 },
    'product-design': { CBUAE: 0, SAMA: 1, CBB: 0, QCB: 1, CBOA: 1, CBK: 1 },
    'claims-handling': { CBUAE: 1, SAMA: 1, CBB: 1, QCB: 2, CBOA: 1, CBK: 2 },
    'data-protection': { CBUAE: 1, SAMA: 2, CBB: 1, QCB: 2, CBOA: 2, CBK: 3 },
    'operational-resilience': { CBUAE: 0, SAMA: 1, CBB: 1, QCB: 2, CBOA: 1, CBK: 2 },
  };

  let scorecardCount = 0;
  for (const theme of themes) {
    for (const reg of regulators) {
      const rating = sampleRatings[theme]?.[reg.code] ?? 0;
      try {
        await prisma.auditScorecard.upsert({
          where: { jurisdictionId_theme_regulator: { jurisdictionId: reg.jurisdiction, theme, regulator: reg.code } },
          update: {},
          create: {
            jurisdictionId: reg.jurisdiction,
            theme,
            regulator: reg.code,
            gapRating: rating,
            evidence: rating > 0 ? JSON.stringify([{ type: 'assessment', note: `Gap rating ${rating} assigned during initial assessment`, date: new Date().toISOString() }]) : null,
            lastAssessedBy: 'System Seed',
            lastAssessedAt: new Date(),
          },
        });
        scorecardCount++;
      } catch (e) {
        // Skip if already exists
      }
    }
  }
  console.log(`  ✅ Created ${scorecardCount} scorecard entries (9 themes × 6 regulators)`);

  // ─── 3. Sample compliance gaps ────────────────────────────────────────────
  const gaps = [
    { jurisdictionId: 'BH', theme: 'financial-crime', title: 'SAR filing deadline not consistently met', description: 'Bahrain CBB requires SAR filing within 5 business days. Current average is 7 business days.', severity: 'Critical', detectedBy: 'audit', ownerName: 'Bahrain MLRO', ownerRole: 'mlro' },
    { jurisdictionId: 'QA', theme: 'data-protection', title: 'No formal data protection officer appointed', description: 'QCB requires a designated DPO for insurance companies. No DPO currently appointed for Qatar operations.', severity: 'Critical', detectedBy: 'regulatory_change', ownerName: 'Qatar Compliance Manager', ownerRole: 'compliance_manager' },
    { jurisdictionId: 'KW', theme: 'data-protection', title: 'No formal data protection officer appointed', description: 'CBK requires a designated DPO for insurance companies. No DPO currently appointed for Kuwait operations.', severity: 'High', detectedBy: 'system', ownerName: 'Kuwait Compliance Officer', ownerRole: 'compliance_officer' },
    { jurisdictionId: 'SA', theme: 'payroll-social-insurance', title: 'GOSI contribution calculations inconsistent', description: 'Monthly GOSI contributions showing variance with actual salary records. Reconciliation needed.', severity: 'Medium', detectedBy: 'audit', ownerName: 'KSA HR Compliance', ownerRole: 'compliance_officer' },
    { jurisdictionId: 'OM', theme: 'contracts-employment', title: 'Employment contracts not bilingual', description: 'Oman labor law requires Arabic + English contracts. Some contracts are English-only.', severity: 'Medium', detectedBy: 'user', ownerName: 'Oman HR Manager', ownerRole: 'compliance_officer' },
    { jurisdictionId: 'AE', theme: 'claims-handling', title: 'Claims SLA exceedance for motor portfolio', description: '15% of motor claims exceed CBUAE 15-day SLA for initial response.', severity: 'Medium', detectedBy: 'system', ownerName: 'UAE Claims Manager', ownerRole: 'compliance_officer' },
  ];

  for (const gap of gaps) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (gap.severity === 'Critical' ? 7 : gap.severity === 'High' ? 30 : 90));

    await prisma.gap.create({
      data: {
        ...gap,
        dueDate,
        status: 'Open',
        isSystemic: gap.title === 'No formal data protection officer appointed',
        relatedGapIds: gap.title === 'No formal data protection officer appointed' ? JSON.stringify([]) : null,
        escalationLevel: 0,
      },
    });
  }

  // Mark systemic gaps
  const dpGaps = await prisma.gap.findMany({
    where: { title: 'No formal data protection officer appointed' },
  });
  if (dpGaps.length >= 2) {
    const relatedIds = dpGaps.map(g => g.id);
    await Promise.all(dpGaps.map(g =>
      prisma.gap.update({
        where: { id: g.id },
        data: { isSystemic: true, relatedGapIds: JSON.stringify(relatedIds) },
      })
    ));
  }
  console.log(`  ✅ Created ${gaps.length} compliance gaps (including systemic DPO gap)`);

  // ─── 4. KRI metrics with values ──────────────────────────────────────────
  const kriMetrics = [
    { name: 'emiratisation_rate', value: 4.2, target: 4, trend: 'up', jurisdiction: 'AE', category: 'employment' },
    { name: 'sar_filing_timeliness', value: 95, target: 100, trend: 'stable', jurisdiction: 'AE', category: 'aml' },
    { name: 'training_completion_rate', value: 88, target: 100, trend: 'up', jurisdiction: 'AE', category: 'governance' },
    { name: 'nitaqat_tier', value: 2, target: 1, trend: 'stable', jurisdiction: 'SA', category: 'employment' },
    { name: 'sar_filing_timeliness', value: 92, target: 100, trend: 'up', jurisdiction: 'SA', category: 'aml' },
    { name: 'saudization_rate', value: 28, target: 30, trend: 'up', jurisdiction: 'SA', category: 'employment' },
    { name: 'bahrainisation_rate', value: 21, target: 20, trend: 'up', jurisdiction: 'BH', category: 'employment' },
    { name: 'sar_filing_timeliness', value: 78, target: 100, trend: 'down', jurisdiction: 'BH', category: 'aml' },
    { name: 'qatarization_rate', value: 12, target: 15, trend: 'stable', jurisdiction: 'QA', category: 'employment' },
    { name: 'sar_filing_timeliness', value: 85, target: 100, trend: 'up', jurisdiction: 'QA', category: 'aml' },
    { name: 'omanization_rate', value: 58, target: 60, trend: 'up', jurisdiction: 'OM', category: 'employment' },
    { name: 'sar_filing_timeliness', value: 91, target: 100, trend: 'stable', jurisdiction: 'OM', category: 'aml' },
    { name: 'kuwaitization_rate', value: 7, target: 10, trend: 'stable', jurisdiction: 'KW', category: 'employment' },
    { name: 'sar_filing_timeliness', value: 82, target: 100, trend: 'up', jurisdiction: 'KW', category: 'aml' },
    { name: 'sanctions_screening_rate', value: 99.8, target: 100, trend: 'stable', jurisdiction: 'AE', category: 'aml' },
    { name: 'sanctions_screening_rate', value: 99.5, target: 100, trend: 'stable', jurisdiction: 'SA', category: 'aml' },
    { name: 'false_positive_rate', value: 8.2, target: 5, trend: 'down', jurisdiction: 'AE', category: 'aml' },
    { name: 'false_positive_rate', value: 11.5, target: 5, trend: 'stable', jurisdiction: 'SA', category: 'aml' },
  ];

  for (const metric of kriMetrics) {
    await prisma.kRIMetric.upsert({
      where: { id: `seed-kri-${metric.jurisdiction}-${metric.name}` },
      update: { value: metric.value, trend: metric.trend },
      create: {
        id: `seed-kri-${metric.jurisdiction}-${metric.name}`,
        name: metric.name,
        value: metric.value,
        target: metric.target,
        trend: metric.trend,
        jurisdiction: metric.jurisdiction,
        category: metric.category,
      },
    });
  }
  console.log(`  ✅ Created ${kriMetrics.length} KRI metrics across 6 jurisdictions`);

  // ─── 5. Regulatory deadline types ────────────────────────────────────────
  const deadlineTypes = [
    { code: 'CBUAE_SAR_FILING', name: 'CBUAE SAR Filing Deadline', regulator: 'CBUAE', jurisdictionId: 'AE', deadlineDays: 30, deadlineUnit: 'calendar_days', category: 'SAR_FILING', description: 'SAR must be filed within 30 calendar days per FDL 10/2025' },
    { code: 'CBUAE_CTR_FILING', name: 'CBUAE CTR Filing Deadline', regulator: 'CBUAE', jurisdictionId: 'AE', deadlineDays: 14, deadlineUnit: 'calendar_days', category: 'SAR_FILING', description: 'CTR filing within 14 calendar days' },
    { code: 'CBUAE_QUARTERLY_RETURN', name: 'CBUAE Quarterly Return', regulator: 'CBUAE', jurisdictionId: 'AE', deadlineDays: 30, deadlineUnit: 'business_days', category: 'QUARTERLY_RETURN' },
    { code: 'SAMA_SAR_FILING', name: 'SAMA SAR Filing Deadline', regulator: 'SAMA', jurisdictionId: 'SA', deadlineDays: 15, deadlineUnit: 'business_days', category: 'SAR_FILING', description: 'SAR must be filed within 15 business days per SAMA AML Rules' },
    { code: 'SAMA_QUARTERLY_RETURN', name: 'SAMA Quarterly Return', regulator: 'SAMA', jurisdictionId: 'SA', deadlineDays: 30, deadlineUnit: 'business_days', category: 'QUARTERLY_RETURN' },
    { code: 'CBB_SAR_FILING', name: 'CBB SAR Filing Deadline', regulator: 'CBB', jurisdictionId: 'BH', deadlineDays: 5, deadlineUnit: 'business_days', category: 'SAR_FILING', description: 'SAR must be filed within 5 business days per CBB AML Handbook' },
    { code: 'CBB_QUARTERLY_RETURN', name: 'CBB Quarterly Return', regulator: 'CBB', jurisdictionId: 'BH', deadlineDays: 30, deadlineUnit: 'business_days', category: 'QUARTERLY_RETURN' },
    { code: 'QCB_SAR_FILING', name: 'QCB SAR Filing Deadline', regulator: 'QCB', jurisdictionId: 'QA', deadlineDays: 15, deadlineUnit: 'business_days', category: 'SAR_FILING', description: 'SAR filing within 15 business days per QCB regulations // Verify with SME' },
    { code: 'QCB_QUARTERLY_RETURN', name: 'QCB Quarterly Return', regulator: 'QCB', jurisdictionId: 'QA', deadlineDays: 30, deadlineUnit: 'business_days', category: 'QUARTERLY_RETURN' },
    { code: 'CBOA_SAR_FILING', name: 'CBOA SAR Filing Deadline', regulator: 'CBOA', jurisdictionId: 'OM', deadlineDays: 15, deadlineUnit: 'business_days', category: 'SAR_FILING', description: 'SAR filing within 15 business days per CBOA directives // Verify with SME' },
    { code: 'CBOA_QUARTERLY_RETURN', name: 'CBOA Quarterly Return', regulator: 'CBOA', jurisdictionId: 'OM', deadlineDays: 30, deadlineUnit: 'business_days', category: 'QUARTERLY_RETURN' },
    { code: 'CBK_SAR_FILING', name: 'CBK SAR Filing Deadline', regulator: 'CBK', jurisdictionId: 'KW', deadlineDays: 15, deadlineUnit: 'business_days', category: 'SAR_FILING', description: 'SAR filing within 15 business days per CBK instructions // Verify with SME' },
    { code: 'CBK_QUARTERLY_RETURN', name: 'CBK Quarterly Return', regulator: 'CBK', jurisdictionId: 'KW', deadlineDays: 30, deadlineUnit: 'business_days', category: 'QUARTERLY_RETURN' },
    // Capital adequacy
    { code: 'CBUAE_CAPITAL_ADEQUACY', name: 'CBUAE Capital Adequacy Return', regulator: 'CBUAE', jurisdictionId: 'AE', deadlineDays: 45, deadlineUnit: 'business_days', category: 'CAPITAL_ADEQUACY' },
    { code: 'SAMA_CAPITAL_ADEQUACY', name: 'SAMA Capital Adequacy Return', regulator: 'SAMA', jurisdictionId: 'SA', deadlineDays: 45, deadlineUnit: 'business_days', category: 'CAPITAL_ADEQUACY' },
  ];

  for (const dt of deadlineTypes) {
    await prisma.regulatoryDeadlineType.upsert({
      where: { code: dt.code },
      update: {},
      create: dt,
    });
  }
  console.log(`  ✅ Created ${deadlineTypes.length} regulatory deadline types`);

  console.log('\n🎉 Phase 5 seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
