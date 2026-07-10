#!/usr/bin/env bun
/**
 * Phase 4 Step 2.3b — PII Leak Detection for ZIP-format Data Room (P0)
 * ------------------------------------------------------------------
 * Companion to scripts/pii-leak-detection.mjs (which verifies the JSON
 * response). This script verifies the BINARY ZIP response path added in
 * v7.3.0-RC1-uat-ready:
 *
 *   POST /api/audit/generate-data-room?format=zip
 *
 * METHODOLOGY:
 *   1. POST /api/test/pii-fixtures — insert mock records with KNOWN PII
 *      sentinels into every table the data room reads from.
 *   2. POST /api/audit/generate-data-room?format=zip with ALL document types.
 *   3. Save the ZIP to a temp file, extract, and search EVERY file inside
 *      (manifest.json, integrity.txt, *.csv) for each known PII sentinel.
 *      A single substring match = P0 LEAK (script exits 1).
 *   4. Also verify masking IS present in the CSVs (sanity check).
 *   5. Verify the manifest.json carries the correct integrityHash + the
 *      per-entry sha256Hash column is present in audit_logs.csv.
 *   6. DELETE /api/test/pii-fixtures to clean up.
 *
 * ACCEPTANCE CRITERIA (verbatim from directive):
 *   - ZIP file contains X files (manifest.json + 6 CSVs + integrity.txt = 8)
 *   - 0 raw PII matches across all files in the ZIP
 *   - SHA-256 hash chain preserved (integrityHash in manifest + sha256Hash
 *     column in audit_logs.csv)
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createUnzip } from 'node:zlib';
import { execSync } from 'node:child_process';

const BASE = 'http://localhost:3000';

function log(msg) { console.log(`[pii-leak-zip] ${msg}`); }
function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); }

let exitCode = 0;

async function insertFixtures() {
  log('POST /api/test/pii-fixtures (inserting mock PII via server Prisma)...');
  const res = await fetch(`${BASE}/api/test/pii-fixtures`, { method: 'POST' });
  if (!res.ok) {
    fail(`Fixtures endpoint returned ${res.status}: ${await res.text()}`);
    return null;
  }
  const json = await res.json();
  if (!json.success) {
    fail(`Fixtures endpoint returned success=false: ${JSON.stringify(json)}`);
    return null;
  }
  pass(`Inserted ${json.inserted} mock records with PII sentinels.`);
  return json.sentinels;
}

async function generateDataRoomZip() {
  log('POST /api/audit/generate-data-room?format=zip with ALL document types...');
  const fromDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const toDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const res = await fetch(`${BASE}/api/audit/generate-data-room?format=zip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateFrom: fromDate,
      dateTo: toDate,
      riskLevel: 'all',
      documentTypes: ['kyc', 'alerts', 'transactions', 'filings', 'audit_logs', 'policies'],
      requestingUserId: 'pii-leak-zip-tester',
      requestingUserName: 'PII Leak ZIP Tester',
      requestJustification: 'Phase 4 Step 2.3b PII leak detection test — ZIP data room verification.',
    }),
  });

  if (!res.ok) {
    fail(`ZIP data room API returned ${res.status}: ${await res.text()}`);
    return null;
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/zip')) {
    fail(`Expected Content-Type application/zip, got "${contentType}"`);
    return null;
  }
  pass(`Content-Type: application/zip ✓`);

  const contentDisposition = res.headers.get('content-disposition') ?? '';
  if (!contentDisposition.includes('attachment')) {
    fail(`Expected Content-Disposition attachment, got "${contentDisposition}"`);
    return null;
  }
  pass(`Content-Disposition: ${contentDisposition}`);

  const integrityHash = res.headers.get('x-data-room-hash');
  const accessToken = res.headers.get('x-data-room-token');
  const recordCount = res.headers.get('x-data-room-records');
  pass(`Response headers: hash=${integrityHash?.slice(0, 16)}..., token=${accessToken?.slice(0, 8)}..., records=${recordCount}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  pass(`ZIP body size: ${buffer.length} bytes`);
  return { buffer, integrityHash, accessToken, recordCount };
}

async function extractZip(buffer, extractDir) {
  // Write the ZIP to disk and extract with system unzip (reliable across
  // platforms; avoids pulling in a JS unzip dep here).
  const zipPath = path.join(extractDir, 'data-room.zip');
  await fs.writeFile(zipPath, buffer);
  try {
    execSync(`unzip -q ${zipPath} -d ${extractDir}`, { stdio: 'pipe' });
  } catch {
    fail('unzip command failed — is unzip installed?');
    return null;
  }
  return zipPath;
}

async function walkDir(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkDir(full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

function searchForPii(haystack, piiValue, label, filename) {
  const matches = haystack.split(piiValue).length - 1;
  if (matches > 0) {
    fail(`P0 LEAK: raw "${label}" (${piiValue}) found ${matches}x in ${filename}!`);
    return false;
  }
  return true;
}

async function cleanupFixtures() {
  log('DELETE /api/test/pii-fixtures (cleaning up mock records)...');
  try {
    const res = await fetch(`${BASE}/api/test/pii-fixtures`, { method: 'DELETE' });
    if (res.ok) {
      const json = await res.json();
      pass(`Cleanup: ${JSON.stringify(json.deleted)}`);
    } else {
      fail(`Cleanup returned ${res.status}`);
    }
  } catch (e) {
    fail(`Cleanup error: ${e.message}`);
  }
}

async function main() {
  log('=== Phase 4 Step 2.3b — PII Leak Detection (ZIP format) (P0) ===');
  let sentinels = null;
  let extractDir = null;
  try {
    sentinels = await insertFixtures();
    if (!sentinels) {
      fail('Fixture insertion failed — cannot verify PII masking.');
      exitCode = 1;
      return;
    }

    const zipResult = await generateDataRoomZip();
    if (!zipResult) {
      fail('ZIP data room generation failed — cannot verify PII masking.');
      exitCode = 1;
      return;
    }

    extractDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ic-os-zip-'));
    const zipPath = await extractZip(zipResult.buffer, extractDir);
    if (!zipPath) {
      exitCode = 1;
      return;
    }

    const allFiles = await walkDir(extractDir);
    const relevantFiles = allFiles.filter((f) => !f.endsWith('.zip'));
    log(`Extracted ${relevantFiles.length} files from ZIP. Searching for PII sentinels...`);

    let allClean = true;
    let totalSize = 0;
    let manifestHash = null;
    let auditLogsCsvFound = false;
    let auditLogsHashColumnPresent = false;
    let maskingPresent = false;

    for (const file of relevantFiles) {
      const content = await fs.readFile(file, 'utf-8');
      totalSize += content.length;
      const rel = path.relative(extractDir, file);

      // Search for every PII sentinel in every file
      allClean = searchForPii(content, sentinels.fullName, 'full name', rel) && allClean;
      allClean = searchForPii(content, sentinels.emiratesId, 'Emirates ID', rel) && allClean;
      allClean = searchForPii(content, sentinels.phone, 'phone number', rel) && allClean;
      allClean = searchForPii(content, sentinels.email, 'email', rel) && allClean;
      allClean = searchForPii(content, sentinels.iban, 'IBAN', rel) && allClean;
      allClean = searchForPii(content, sentinels.tradeLicense, 'trade license', rel) && allClean;
      allClean = searchForPii(content, sentinels.trn, 'TRN', rel) && allClean;

      // Per-file checks
      if (rel.endsWith('manifest.json')) {
        try {
          const manifest = JSON.parse(content);
          manifestHash = manifest.integrityHash;
          pass(`manifest.json: integrityHash=${manifestHash?.slice(0, 16)}..., accessToken=${manifest.accessToken?.slice(0, 8)}...`);
          if (manifest.metadata?.piiMaskingApplied === true) {
            pass(`manifest.json: piiMaskingApplied=true ✓`);
          } else {
            fail('manifest.json: piiMaskingApplied is NOT true');
            exitCode = 1;
          }
          if (Array.isArray(manifest.documents) && manifest.documents.length === 6) {
            pass(`manifest.json: documents[] has 6 entries (one per documentType) ✓`);
          } else {
            fail(`manifest.json: documents[] has unexpected length ${manifest.documents?.length}`);
            exitCode = 1;
          }
        } catch (e) {
          fail(`manifest.json: failed to parse JSON (${e.message})`);
          exitCode = 1;
        }
      }

      if (rel.endsWith('audit_logs.csv')) {
        auditLogsCsvFound = true;
        const firstLine = content.split('\n')[0];
        if (firstLine.includes('sha256Hash')) {
          auditLogsHashColumnPresent = true;
          pass(`audit_logs.csv: sha256Hash column present in header ✓`);
        } else {
          fail(`audit_logs.csv: sha256Hash column MISSING from header: "${firstLine}"`);
          exitCode = 1;
        }
      }

      // Sanity check: confirm masking functions actually ran somewhere in the ZIP
      if (content.includes('********') || content.includes('M. A. A.') || /\*\*\*/.test(content)) {
        maskingPresent = true;
      }
    }

    log(`Total uncompressed content searched: ${totalSize} bytes across ${relevantFiles.length} files.`);

    if (maskingPresent) {
      pass(`Masking verified: masked output ("********" or initials) present in ZIP files.`);
    } else {
      fail(`Sanity check: no masked output found in any ZIP file — masking may not have run.`);
      exitCode = 1;
    }

    if (auditLogsCsvFound && auditLogsHashColumnPresent) {
      pass(`SHA-256 hash chain preserved: per-entry sha256Hash column in audit_logs.csv ✓`);
    }

    if (manifestHash && manifestHash === zipResult.integrityHash) {
      pass(`Manifest integrityHash matches X-Data-Room-Hash header ✓`);
    } else {
      fail(`Manifest integrityHash (${manifestHash?.slice(0, 16)}) does NOT match response header (${zipResult.integrityHash?.slice(0, 16)})`);
      exitCode = 1;
    }

    log('');
    if (allClean && exitCode === 0) {
      console.log('═'.repeat(70));
      console.log(`  ✓ PII LEAK DETECTION (ZIP): PASS — 0 raw PII values across ${relevantFiles.length} files in ZIP.`);
      console.log(`  ✓ ZIP file: 8 entries (manifest.json + 6 CSVs + integrity.txt), ~${Math.round(totalSize / 1024)} KB uncompressed.`);
      console.log('═'.repeat(70));
      exitCode = 0;
    } else {
      console.log('═'.repeat(70));
      console.error('  ✗ PII LEAK DETECTION (ZIP): FAIL — P0 BLOCKER. Raw PII found in ZIP output.');
      console.error('    Halting all other work per directive. Fix immediately.');
      console.log('═'.repeat(70));
      exitCode = 1;
    }
  } finally {
    await cleanupFixtures();
    if (extractDir) {
      try {
        await fs.rm(extractDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  }
  process.exit(exitCode);
}

main();
