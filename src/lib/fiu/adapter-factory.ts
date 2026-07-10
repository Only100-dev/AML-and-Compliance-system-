/**
 * FIU Adapter Factory — Lazy-Loaded Multi-Jurisdictional Adapter Dispatch
 *
 * Implements the same lazy-loading pattern as Phase 3's LaborLawCompliance
 * jurisdiction switcher. Each country adapter is dynamically imported only
 * when needed, keeping the initial bundle size small.
 *
 * PRINCIPLE C: FORMAT ISOLATION — Each adapter is isolated; goAML XML
 * cannot leak into other countries' adapters.
 *
 * Usage:
 *   const adapter = await getFIUAdapter('BH');  // Returns CBBAdapter
 *   const deadline = adapter.calculateDeadline(detectionDate);
 *   const filing = await adapter.generateFiling(payload);
 *
 * Phase 4 (Action 4.1): Factory pattern for all 6 GCC FIU adapters.
 */

import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';
import type { FIUFileAdapter } from './types';

// ─── Adapter Lazy Loaders ─────────────────────────────────────────────────────

const adapterLoaders: Record<GCCJurisdictionCode, () => Promise<FIUFileAdapter>> = {
  AE: async () => {
    const { GoAMLAdapter } = await import('./adapters/goaml-adapter');
    return new GoAMLAdapter();
  },
  SA: async () => {
    const { SAMAAdapter } = await import('./adapters/sama-adapter');
    return new SAMAAdapter();
  },
  BH: async () => {
    const { CBBAdapter } = await import('./adapters/cbb-adapter');
    return new CBBAdapter();
  },
  QA: async () => {
    const { QCBAdapter } = await import('./adapters/qcb-adapter');
    return new QCBAdapter();
  },
  OM: async () => {
    const { CBOAAdapter } = await import('./adapters/cboa-adapter');
    return new CBOAAdapter();
  },
  KW: async () => {
    const { CBKAdapter } = await import('./adapters/cbk-adapter');
    return new CBKAdapter();
  },
};

// ─── Adapter Cache ─────────────────────────────────────────────────────────────

const adapterCache = new Map<GCCJurisdictionCode, FIUFileAdapter>();

/**
 * Get the FIU adapter for a jurisdiction.
 * Uses lazy loading — the adapter is only loaded when first requested.
 * Subsequent calls return the cached adapter instance.
 *
 * @param jurisdiction - GCC alpha-2 code (AE, SA, BH, QA, OM, KW)
 * @returns The jurisdiction-specific FIU adapter
 * @throws Error if the jurisdiction is not supported
 */
export async function getFIUAdapter(jurisdiction: GCCJurisdictionCode): Promise<FIUFileAdapter> {
  // Check cache first
  const cached = adapterCache.get(jurisdiction);
  if (cached) return cached;

  // Load the adapter
  const loader = adapterLoaders[jurisdiction];
  if (!loader) {
    throw new Error(`No FIU adapter found for jurisdiction: ${jurisdiction}`);
  }

  const adapter = await loader();
  adapterCache.set(jurisdiction, adapter);
  return adapter;
}

/**
 * Get the FIU adapter for a jurisdiction, resolving legacy UAE codes.
 * Legacy codes (CBUAE, DFSA, FSRA) are mapped to AE.
 *
 * @param jurisdictionCode - Any valid jurisdiction code (GCC or legacy UAE)
 * @returns The jurisdiction-specific FIU adapter
 */
export async function getFIUAdapterForCode(jurisdictionCode: string): Promise<FIUFileAdapter> {
  // Map legacy UAE codes to AE
  const gccCode = resolveToGCCCode(jurisdictionCode);
  return getFIUAdapter(gccCode);
}

/**
 * Resolve any jurisdiction code (including legacy UAE codes) to a GCC alpha-2 code.
 */
function resolveToGCCCode(code: string): GCCJurisdictionCode {
  switch (code) {
    case 'CBUAE':
    case 'DFSA':
    case 'FSRA':
      return 'AE';
    default:
      if (['AE', 'SA', 'BH', 'QA', 'OM', 'KW'].includes(code)) {
        return code as GCCJurisdictionCode;
      }
      throw new Error(`Unsupported jurisdiction code: ${code}`);
  }
}

/**
 * Pre-load all adapters (useful for startup health checks).
 */
export async function preloadAllAdapters(): Promise<void> {
  const jurisdictions: GCCJurisdictionCode[] = ['AE', 'SA', 'BH', 'QA', 'OM', 'KW'];
  await Promise.all(jurisdictions.map(j => getFIUAdapter(j)));
}

/**
 * Clear the adapter cache (useful for testing).
 */
export function clearAdapterCache(): void {
  adapterCache.clear();
}

/**
 * Get all supported jurisdiction codes.
 */
export function getSupportedJurisdictions(): GCCJurisdictionCode[] {
  return ['AE', 'SA', 'BH', 'QA', 'OM', 'KW'];
}
