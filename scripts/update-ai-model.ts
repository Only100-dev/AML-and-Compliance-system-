/**
 * One-off migration script: update AIEngineConfig.defaultModel to 'glm-5.2'.
 * Run: bun run scripts/update-ai-model.ts
 */
import { db } from '../src/lib/db';

async function main() {
  const configs = await db.aIEngineConfig.findMany();
  console.log(`Found ${configs.length} AIEngineConfig record(s)`);
  for (const c of configs) {
    console.log(`  id=${c.id} provider=${c.provider} defaultModel=${c.defaultModel} isActive=${c.isActive}`);
  }
  if (configs.length > 0) {
    const updated = await db.aIEngineConfig.updateMany({
      where: {},
      data: { defaultModel: 'glm-5.2', provider: 'z-ai' },
    });
    console.log(`Updated ${updated.count} record(s) to defaultModel='glm-5.2', provider='z-ai'`);
  } else {
    const created = await db.aIEngineConfig.create({
      data: {
        provider: 'z-ai',
        apiKey: null,
        defaultModel: 'glm-5.2',
        temperature: 0.3,
        maxTokens: 2048,
        topP: 0.9,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
        monthlyTokenQuota: 500000,
        isActive: true,
      },
    });
    console.log(`Created new AIEngineConfig record: id=${created.id} defaultModel=${created.defaultModel}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
