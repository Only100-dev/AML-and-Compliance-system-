/**
 * IC-OS Scenario Knowledge Base Seeder
 *
 * Populates the ScenarioKnowledge table from /data/scenarios.json.
 * Uses upsert on `title` (unique) to guarantee idempotent runs.
 * Computes searchVector by concatenating key text fields for RAG retrieval.
 *
 * Usage: bun run db:seed-scenarios
 */

import { db } from '../src/lib/db';
import scenariosData from '../data/scenarios.json';

interface ScenarioInput {
  packNumber: number;
  category: string;
  title: string;
  scenarioText: string;
  complexity: string;
  systemWorkflow: string;
  regulatoryAnchor: string;
  tags: string[];
  riskLevel: string;
}

function computeSearchVector(s: ScenarioInput): string {
  return [
    s.title,
    s.scenarioText,
    s.complexity,
    s.systemWorkflow,
    s.regulatoryAnchor,
    s.tags.join(' '),
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const totalScenarios = scenariosData.length;
  console.log(`\n🌱 Seeding ScenarioKnowledge table...`);
  console.log(`   Found ${totalScenarios} scenarios in data/scenarios.json\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < totalScenarios; i++) {
    const s = scenariosData[i] as ScenarioInput;

    try {
      const searchVector = computeSearchVector(s);
      const tagsJson = JSON.stringify(s.tags);

      const result = await db.scenarioKnowledge.upsert({
        where: { title: s.title },
        update: {
          packNumber: s.packNumber,
          category: s.category,
          scenarioText: s.scenarioText,
          complexity: s.complexity,
          systemWorkflow: s.systemWorkflow,
          regulatoryAnchor: s.regulatoryAnchor,
          tags: tagsJson,
          riskLevel: s.riskLevel,
          searchVector,
          isActive: true,
        },
        create: {
          packNumber: s.packNumber,
          category: s.category,
          title: s.title,
          scenarioText: s.scenarioText,
          complexity: s.complexity,
          systemWorkflow: s.systemWorkflow,
          regulatoryAnchor: s.regulatoryAnchor,
          tags: tagsJson,
          riskLevel: s.riskLevel,
          searchVector,
          isActive: true,
        },
      });

      // Determine if it was created or updated by checking createdAt vs updatedAt
      // For upsert, we can't easily distinguish, so we just count operations
      created++;

      // Log progress every 20 scenarios
      if ((i + 1) % 20 === 0) {
        console.log(`   Progress: ${i + 1}/${totalScenarios} scenarios processed...`);
      }
    } catch (err) {
      errors++;
      console.error(`   ❌ Error processing scenario "${s.title}" (Pack ${s.packNumber}):`, err);
    }
  }

  // Final count from the database
  const totalCount = await db.scenarioKnowledge.count();

  console.log(`\n✅ Scenario seeding complete!`);
  console.log(`   Processed: ${totalScenarios}`);
  console.log(`   Upserted:  ${created}`);
  console.log(`   Errors:    ${errors}`);
  console.log(`   Total in DB: ${totalCount} scenario(s)\n`);

  if (errors > 0) {
    console.warn(`⚠️  ${errors} scenario(s) encountered errors. Review output above.\n`);
  }
}

main()
  .catch((err) => {
    console.error('❌ Fatal error seeding scenarios:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
