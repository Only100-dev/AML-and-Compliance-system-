import { db } from '../src/lib/db';

async function main() {
  const regs = await db.regulation.findMany();
  console.log(`Found ${regs.length} regulations to update`);
  
  const updates: Record<string, Record<string, unknown>> = {
    'Test Regulation': { type: 'Standard/Code', referenceNumber: 'CBUAE-GEN-2025-01', implementationConsiderations: 'Review existing policies and update as needed', internalNotes: 'Initial review pending' },
    'Motor Insurance Unified Policy': { type: 'Final Circular', referenceNumber: 'CBUAE-MOT-2025-02', implementationConsiderations: 'Policy templates updated and distributed to branches', internalNotes: 'All branches compliant' },
    'Data Protection Regulation': { type: 'Standard/Code', referenceNumber: 'CBUAE-DP-2025-03', implementationConsiderations: 'Encryption at rest partially implemented. Transit encryption complete.', internalNotes: 'Pending vendor selection for DLP solution' },
    'Health Insurance Regulations (DHA)': { type: 'Standard/Code', referenceNumber: 'DFSA-HLT-2025-04', implementationConsiderations: 'Major gaps in claims processing workflow. Need system upgrade.', internalNotes: 'Board escalation initiated' },
    'Solvency Framework for Insurance': { type: 'Standard/Code', referenceNumber: 'CBUAE-SOL-2025-05', implementationConsiderations: 'Capital adequacy ratios maintained above minimum thresholds', internalNotes: 'Quarterly reporting on track' },
    'Outsourcing Regulations': { type: 'Guidance Note', referenceNumber: 'CBUAE-OUT-2025-06', implementationConsiderations: 'Vendor assessment framework needs update', internalNotes: 'Awaiting vendor responses' },
    'Consumer Protection Regulation': { type: 'Final Circular', referenceNumber: 'CBUAE-CPR-2025-07', implementationConsiderations: 'Complaint handling process updated. Disclosure forms pending legal review.', internalNotes: 'Legal review expected by end of month' },
    'Corporate Governance Code': { type: 'Standard/Code', referenceNumber: 'CBUAE-CGC-2025-08', implementationConsiderations: 'Board charter and committee structures fully aligned', internalNotes: 'Annual board evaluation completed' },
    'FDL No. 20 of 2018 (AML/CFT)': { type: 'Standard/Code', referenceNumber: 'CBUAE-AML-2025-09', implementationConsiderations: 'AML framework aligned with FATF recommendations', internalNotes: 'Next audit scheduled Q3' },
  };
  
  for (const reg of regs) {
    const update = updates[reg.title];
    if (update) {
      await db.regulation.update({ where: { id: reg.id }, data: update });
      console.log(`Updated: ${reg.title}`);
    }
  }
  
  const existing = await db.regulation.findFirst({ where: { referenceNumber: 'CBUAE-AML-2025-D01' } });
  if (!existing) {
    await db.regulation.create({
      data: {
        title: 'AML/CFT Draft Consultation Paper',
        type: 'Draft Consultation Paper',
        referenceNumber: 'CBUAE-AML-2025-D01',
        issuer: 'CBUAE',
        category: 'AML/CFT',
        description: 'Proposed amendments to AML/CFT framework for insurance sector',
        publicationDate: new Date('2025-05-01'),
        effectiveDate: new Date('2025-10-01'),
        nextReviewDate: new Date('2025-09-01'),
        consultationDeadline: new Date('2025-06-30'),
        complianceStatus: 'PENDING',
        assignedTo: 'MLRO',
        priority: 'urgent',
        implementationConsiderations: 'Feedback must be submitted within 60-day window',
        consultationFeedbackStatus: 'Drafting',
        internalNotes: 'Working group formed for feedback preparation',
      },
    });
    console.log('Created: AML/CFT Draft Consultation Paper');
  }
  
  const finalCount = await db.regulation.count();
  console.log(`Total regulations: ${finalCount}`);
}

main().catch(console.error);
