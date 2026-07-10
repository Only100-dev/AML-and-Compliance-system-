/**
 * FIU Filing Module — Barrel Export
 * Phase 4: Multi-jurisdictional SAR/STR filing architecture
 */

export type {
  FilingStatus,
  FilingFormat,
  ReportType,
  CustomerType,
  SARPayload,
  FilingResult,
  FilingValidationResult,
  FilingValidationError,
  FIUFileAdapter,
  ManualFallbackDocument,
  DeadlineInfo,
} from './types';

export {
  getFIUAdapter,
  getFIUAdapterForCode,
  preloadAllAdapters,
  clearAdapterCache,
  getSupportedJurisdictions,
} from './adapter-factory';

export {
  calculateFilingDeadline,
  getFilingDeadlineInfo,
  isFilingDeadlineExceeded,
  getDeadlineDescription,
} from './deadline-calculator';

export {
  isGCCWeekend,
  addBusinessDaysGCC,
  businessDaysBetweenGCC,
  businessDaysElapsedGCC,
  businessDaysRemainingGCC,
  addCalendarDays,
  calendarDaysRemaining,
  isSLAExceededGCC,
} from './business-days-gcc';
