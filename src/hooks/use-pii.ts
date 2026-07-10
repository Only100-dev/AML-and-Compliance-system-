'use client';

import { useState, useCallback } from 'react';
import * as pii from '@/lib/pii';

/**
 * Read initial PII masking preference from localStorage
 * Returns true (enabled) as default if no preference stored
 */
function getInitialMaskingState(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('icos-pii-masking');
  return stored === null ? true : stored === 'true';
}

/**
 * Hook to access PII masking functions with client-side feature flag check
 * Returns masking utilities that respect the ENABLE_PII_MASKING flag
 */
export function usePII() {
  const [enabled, setEnabled] = useState(getInitialMaskingState);

  const toggleMasking = useCallback((value: boolean) => {
    setEnabled(value);
    localStorage.setItem('icos-pii-masking', String(value));
  }, []);

  return {
    enabled,
    toggleMasking,
    maskName: pii.maskName,
    maskEmail: pii.maskEmail,
    maskPhone: pii.maskPhone,
    maskEmiratesId: pii.maskEmiratesId,
    maskPassport: pii.maskPassport,
    maskAmount: pii.maskAmount,
    maskTradeLicense: pii.maskTradeLicense,
    maskTRN: pii.maskTRN,
    maskGeneric: pii.maskGeneric,
    maskObject: pii.maskObject,
    sanitizeObject: pii.sanitizeObject,
  };
}
