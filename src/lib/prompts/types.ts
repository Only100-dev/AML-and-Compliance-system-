/**
 * Prompt Factory — Type Definitions
 *
 * Action 2.1: Centralized, lazy-loaded, jurisdiction-aware system prompts.
 * These types define the contract between the factory and its consumers.
 */

import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';

/** The set of prompt modules supported by the factory. */
export type PromptModule =
  | 'general' | 'aml' | 'sanctions' | 'kyc' | 'sar_narrative'
  | 'compliance_review' | 'policy' | 'regulatory' | 'risk'
  | 'adverse_media' | 'audit' | 'reporting' | 'training'
  | 'labor' | 'legal' | 'vasp' | 'goAML';

/** Context variables injected into the prompt at runtime. */
export interface PromptContext {
  userRole?: string;
  userName?: string;
  sessionId?: string;
  jurisdiction: GCCJurisdictionCode;
  [key: string]: unknown;
}

/** The result of loading a system prompt via the factory. */
export interface SystemPromptResult {
  prompt: string;
  jurisdiction: GCCJurisdictionCode;
  module: PromptModule;
  version: string;
}

/** Function signature for a lazy-loaded prompt module. */
export type PromptLoader = () => Promise<string>;
