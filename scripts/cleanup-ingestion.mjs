import { db } from '../src/lib/db';

await db.departmentAcknowledgment.deleteMany({});
await db.extractedObligation.deleteMany({});
await db.regulatoryCircular.deleteMany({});
await db.ingestionLog.deleteMany({});
await db.ingestionSource.deleteMany({});
console.log('Ingestion tables wiped for clean E2E demo.');
await db.$disconnect();
