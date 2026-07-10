/**
 * Regulatory Circular Extractor
 * Phase F: Regulatory Circular Ingestion Engine
 *
 * FDL 10/2025 Art. 15 (Internal Controls)
 * CBUAE Notice 3551/2021 S3.1 (Governance — regulatory change management)
 *
 * This module is the SINGLE ABSTRACTION POINT for converting raw circular
 * text into the structured `ExtractionResult` consumed by the commit
 * endpoint. For V1/UAT it ships a deterministic heuristic-based mock
 * implementation; the production OpenAI/Azure integration slot is
 * clearly marked below and is the only change required to switch over.
 *
 * Output schema is intentionally stable so the API layer, the Prisma
 * persistence layer, and any future UI preview pane can rely on it
 * without conditional logic.
 */

// ─── Public Types ────────────────────────────────────────────────────────────

export interface ExtractedObligation {
  /** The compliance action item text (e.g. "File quarterly MLR report"). */
  actionItem: string;
  /** Department responsible (Underwriting, Claims, Compliance, ...). */
  affectedDept: string;
  /** Number of days from effective date to comply, null if unspecified. */
  deadlineDays: number | null;
}

export type RiskImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ExtractionResult {
  circularNumber: string;
  title: string;
  issuingAuthority: string;
  /** ISO 8601 publication date or null. */
  publicationDate: string | null;
  /** ISO 8601 effective date or null. */
  effectiveDate: string | null;
  summary: string;
  riskImpactLevel: RiskImpactLevel;
  affectedDepartments: string[];
  keyObligations: ExtractedObligation[];
}

// ─── Internal Configuration ─────────────────────────────────────────────────

/** Canonical department keywords → normalised department name. */
const DEPARTMENT_KEYWORDS: Array<{ pattern: RegExp; dept: string }> = [
  { pattern: /\bunderwrit/i, dept: 'Underwriting' },
  { pattern: /\bclaims?\b/i, dept: 'Claims' },
  { pattern: /\bcompliance\b/i, dept: 'Compliance' },
  { pattern: /\bfinance|treasury|accounting\b/i, dept: 'Finance' },
  { pattern: /\bactuar(ial|y)\b/i, dept: 'Actuarial' },
  { pattern: /\binternal\s+audit\b/i, dept: 'Internal Audit' },
  { pattern: /\bboard\s+of\s+directors?\b|\bgovernance\b/i, dept: 'Board' },
  { pattern: /\bhuman\s+resources?\b|\bhr\b/i, dept: 'Human Resources' },
  { pattern: /\blegal\b/i, dept: 'Legal' },
  { pattern: /\brisk\s+management\b/i, dept: 'Risk Management' },
  { pattern: /\boperations?\b/i, dept: 'Operations' },
  { pattern: /\bIT\b|\binformation\s+technology\b|\bcyber/i, dept: 'IT' },
  { pattern: /\bdistribution|intermediar|broker\b/i, dept: 'Distribution' },
];

/**
 * Obligation trigger phrases (case-insensitive). Each sentence containing
 * any of these is treated as an obligation candidate.
 */
const OBLIGATION_TRIGGERS = [
  /\bshall\b/i,
  /\bmust\b/i,
  /\brequired\s+to\b/i,
  /\bis\s+required\b/i,
  /\bare\s+required\b/i,
  /\bmandatory\b/i,
  /\bensure\s+that\b/i,
  /\bnot\s+later\s+than\b/i,
  /\bwithin\s+\d+\s+(?:calendar\s+)?days?\b/i,
];

/** Critical-risk trigger words; default risk is MEDIUM. */
const CRITICAL_TRIGGERS = [
  /\bcritical\b/i,
  /\burgent\b/i,
  /\bimmediate(?:ly)?\b/i,
  /\bfatca\b/i,
  /\bsanctions?\b/i,
  /\bmoney\s+laundering\b/i,
  /\bterrorist\s+financ/i,
  /\bbeneficial\s+owner\b/i,
];
const HIGH_TRIGGERS = [
  /\bhigh\s+risk\b/i,
  /\benhanced\s+due\s+diligence\b/i,
  /\bpep\b/i,
  /\bsuspicious\s+(?:activity|transaction)\b/i,
];
const LOW_TRIGGERS = [/\binformational\b/i, /\bfor\s+awareness\b/i, /\bno\s+action\s+required\b/i];

const ISSUING_AUTHORITY_KEYWORDS: Array<{ pattern: RegExp; authority: string }> = [
  { pattern: /\bcbuae\b|central\s+bank\s+of\s+the\s+uae/i, authority: 'CBUAE' },
  { pattern: /\buae\s+fiu\b|financial\s+intelligence\s+unit/i, authority: 'UAE FIU' },
  { pattern: /\bfatf\b/i, authority: 'FATF' },
  { pattern: /\binsurance\s+board\b/i, authority: 'Insurance Board' },
  { pattern: /\besca\b|insurance\s+authority/i, authority: 'Insurance Authority' },
  { pattern: /\bministry\s+of\s+finance\b/i, authority: 'Ministry of Finance' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Split text into sentences without losing the trailing punctuation. */
function splitSentences(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Extract first ISO / DD MMM YYYY / DD-MM-YYYY style date found in text. */
function findDate(text: string, labelPattern?: RegExp): string | null {
  const searchArea = labelPattern
    ? (() => {
        const m = text.match(labelPattern);
        return m ? m[0] : '';
      })()
    : text;
  if (!searchArea) return null;

  // ISO YYYY-MM-DD
  const iso = searchArea.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = searchArea.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const d = new Date(`${dmy[3]}-${month}-${day}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  // DD MMM YYYY (e.g. 05 March 2025)
  const dmon = searchArea.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (dmon) {
    const d = new Date(`${dmon[2]} ${dmon[1]}, ${dmon[3]} 00:00:00 UTC`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/** Derive a deadline (in days) from an obligation sentence. */
function extractDeadlineDays(sentence: string): number | null {
  const m = sentence.match(/\bwithin\s+(\d+)\s+(?:calendar\s+)?days?\b/i);
  if (m) return Number(m[1]);
  const m2 = sentence.match(/\bnot\s+later\s+than\s+(\d+)\s+days?\b/i);
  if (m2) return Number(m2[1]);
  const m3 = sentence.match(/\b(\d+)\s+(?:business|working)\s+days?\b/i);
  if (m3) return Number(m3[1]);
  return null;
}

/** Detect the most likely department for an obligation sentence. */
function detectDepartment(sentence: string): string {
  for (const { pattern, dept } of DEPARTMENT_KEYWORDS) {
    if (pattern.test(sentence)) return dept;
  }
  return 'Compliance';
}

/** Compose a short summary from the first non-trivial paragraphs. */
function buildSummary(text: string, maxChars = 320): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 30);
  if (paragraphs.length === 0) {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > maxChars ? `${flat.slice(0, maxChars)}…` : flat;
  }
  const joined = paragraphs.join(' ');
  return joined.length > maxChars ? `${joined.slice(0, maxChars)}…` : joined;
}

// ─── Public Entry Point ─────────────────────────────────────────────────────

/**
 * Extract a structured `ExtractionResult` from raw circular text.
 *
 * V1/UAT behaviour: deterministic heuristic extraction (no LLM call).
 * The function is async so the OpenAI/Azure integration can be dropped
 * in without changing call-sites.
 */
export async function extractCircular(rawText: string): Promise<ExtractionResult> {
  const text = rawText ?? '';

  // 1. Circular number: "Circular No. CBUAE/.../..." or fallback "CBUAE/.../..."
  let circularNumber = 'UNKNOWN';
  const cn1 = text.match(/Circular\s+No\.?\s*[:\-]?\s*([A-Z]{2,}\/[A-Z0-9\-\/]+)/i);
  if (cn1) circularNumber = cn1[1].trim();
  else {
    const cn2 = text.match(/\b([A-Z]{3,}\/[A-Z0-9]{1,}\/\d{2,4}(?:\/\d+)?)\b/);
    if (cn2) circularNumber = cn2[1].trim();
  }

  // 2. Issuing authority
  let issuingAuthority = 'CBUAE';
  for (const { pattern, authority } of ISSUING_AUTHORITY_KEYWORDS) {
    if (pattern.test(text)) {
      issuingAuthority = authority;
      break;
    }
  }

  // 3. Title — first non-empty line that is NOT a circular-number line.
  let title = `${issuingAuthority} Circular ${circularNumber}`;
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (const line of lines) {
    if (/circular\s+no/i.test(line)) continue;
    if (line.length < 8) continue;
    title = line.length > 160 ? `${line.slice(0, 160)}…` : line;
    break;
  }

  // 4. Dates — publicationDate and effectiveDate
  const publicationDate = findDate(text, /date\s*(?:of\s+issue|issued|publication)?\s*[:\-]?\s*.{0,30}/i);
  const effectiveDate = findDate(text, /effective\s+date\s*[:\-]?\s*.{0,30}|comes\s+into\s+(?:force|effect)\s+on\s*.{0,30}/i);

  // 5. Affected departments — scan whole document.
  const affectedDepartments: string[] = [];
  for (const { pattern, dept } of DEPARTMENT_KEYWORDS) {
    if (pattern.test(text) && !affectedDepartments.includes(dept)) {
      affectedDepartments.push(dept);
    }
  }
  if (affectedDepartments.length === 0) affectedDepartments.push('Compliance');

  // 6. Key obligations — sentences matching trigger phrases.
  const sentences = splitSentences(text);
  const keyObligations: ExtractedObligation[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    if (sentence.length < 12) continue;
    if (!OBLIGATION_TRIGGERS.some((p) => p.test(sentence))) continue;
    const actionItem = sentence.length > 240 ? `${sentence.slice(0, 240)}…` : sentence;
    if (seen.has(actionItem)) continue;
    seen.add(actionItem);
    keyObligations.push({
      actionItem,
      affectedDept: detectDepartment(sentence),
      deadlineDays: extractDeadlineDays(sentence),
    });
    if (keyObligations.length >= 25) break; // safety cap
  }

  // 7. Risk impact level.
  let riskImpactLevel: RiskImpactLevel = 'MEDIUM';
  if (CRITICAL_TRIGGERS.some((p) => p.test(text))) riskImpactLevel = 'CRITICAL';
  else if (HIGH_TRIGGERS.some((p) => p.test(text))) riskImpactLevel = 'HIGH';
  else if (LOW_TRIGGERS.some((p) => p.test(text))) riskImpactLevel = 'LOW';

  // 8. Summary.
  const summary = buildSummary(text);

  return {
    circularNumber,
    title,
    issuingAuthority,
    publicationDate,
    effectiveDate,
    summary,
    riskImpactLevel,
    affectedDepartments,
    keyObligations,
  };
}

// ─── Production LLM Integration (disabled for V1/UAT) ───────────────────────
// When ready, replace the heuristic implementation above with:
//
//   import OpenAI from 'openai';
//
//   const CIRCULAR_EXTRACTION_PROMPT = `You are a regulatory-compliance extraction engine.
//   Read the supplied regulatory circular and return ONLY JSON matching the ExtractionResult
//   schema. Use null for unknown dates. Departments MUST be one of: ${DEPARTMENT_KEYWORDS
//     .map(k => k.dept).join(', ')}. riskImpactLevel MUST be one of LOW|MEDIUM|HIGH|CRITICAL.`;
//
//   export async function extractCircular(rawText: string): Promise<ExtractionResult> {
//     const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
//     const completion = await client.chat.completions.create({
//       model: 'gpt-4o',
//       response_format: { type: 'json_object' },
//       messages: [
//         { role: 'system', content: CIRCULAR_EXTRACTION_PROMPT },
//         { role: 'user', content: rawText },
//       ],
//     });
//     const parsed = JSON.parse(completion.choices[0].message.content!) as ExtractionResult;
//     return parsed;
//   }
//
// No callers (route.ts, types) require modification — the signature is identical.
// ────────────────────────────────────────────────────────────────────────────
