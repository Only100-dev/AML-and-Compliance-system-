/**
 * IC-OS Labor/HR Calculator — Central Export Barrel
 *
 * This file re-exports all calculator functions and types for convenient
 * importing by UI components and API routes. Import from this barrel file
 * instead of individual calculator files:
 *
 *   import { calculateNitaqat, calculateGOSI } from '@/lib/calculators';
 *
 * Jurisdiction Coverage:
 * ┌────────────┬───────────────────────────┬──────────────────────┐
 * │ Country    │ Nationalization Calculator │ Social Insurance     │
 * ├────────────┼───────────────────────────┼──────────────────────┤
 * │ KSA (SA)   │ nitaqat                   │ gosi                 │
 * │ Bahrain(BH)│ bahrainisation            │ sio                  │
 * │ Qatar (QA) │ qatarization              │ grsia                │
 * │ Oman  (OM) │ omanization               │ pasi                 │
 * │ Kuwait(KW) │ kuwaitization             │ pifss                │
 * │ UAE   (AE) │ emiratisation             │ gpssa                │
 * └────────────┴───────────────────────────┴──────────────────────┘
 *
 * Additional Calculators:
 * - lmra-wps:  Bahrain Wage Protection System file generation & validation
 * - sehati:    Bahrain mandatory health insurance coverage tracking
 *
 * PRINCIPLE C: SHARED COMPONENTS, COUNTRY-SPECIFIC LOGIC
 */

// ─── Shared Types ─────────────────────────────────────────────────────────────
export type {
  NationalizationResult,
  ContributionResult,
  WPSResult,
  HealthCoverageResult,
  ZeroDecimalCurrency,
  ThreeDecimalCurrency,
  EmployeeRecord,
} from './types';

// ─── KSA Calculators ──────────────────────────────────────────────────────────
export { calculateNitaqat } from './nitaqat';
export type { NitaqatInput } from './nitaqat';

export { calculateGOSI } from './gosi';
export type { GOSIInput } from './gosi';

// ─── Bahrain Calculators ──────────────────────────────────────────────────────
export { calculateBahrainisation } from './bahrainisation';
export type { BahrainisationInput } from './bahrainisation';

export { calculateSIO } from './sio';
export type { SIOInput } from './sio';

export { calculateLMRAWPS } from './lmra-wps';
export type { LMRAWPSInput } from './lmra-wps';

export { calculateSehati } from './sehati';
export type { SehatiInput } from './sehati';

// ─── Qatar Calculators ────────────────────────────────────────────────────────
export { calculateQatarization } from './qatarization';
export type { QatarizationInput } from './qatarization';

export { calculateGRSIA } from './grsia';
export type { GRSIAInput } from './grsia';

// ─── Oman Calculators ─────────────────────────────────────────────────────────
export { calculateOmanization } from './omanization';
export type { OmanizationInput } from './omanization';

export { calculatePASI } from './pasi';
export type { PASIInput } from './pasi';

// ─── Kuwait Calculators ───────────────────────────────────────────────────────
export { calculateKuwaitization } from './kuwaitization';
export type { KuwaitizationInput } from './kuwaitization';

export { calculatePIFSS } from './pifss';
export type { PIFSSInput } from './pifss';

// ─── UAE Calculators ──────────────────────────────────────────────────────────
export { calculateGPSSA } from './gpssa';
export type { GPSSAInput } from './gpssa';

export { calculateEmiratisation } from './emiratisation';
export type { EmiratisationInput } from './emiratisation';
