'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * IC-OS Idle Timeout Hook
 * CBUAE-mandated 15-minute session timeout per CBUAE Notice 3551/2021 S3.1
 *
 * Features:
 *   - DEFAULT_IDLE_MS = 900000 (15 min)
 *   - DEFAULT_WARNING_MS = 720000 (12 min, 3 min before logout)
 *   - Tracks mouse/keyboard activity
 *   - Shows warning modal at 12 minutes
 *   - Forces hard logout at 15 minutes
 *   - Returns { showWarning, secondsRemaining, resetTimer, extendSession }
 */

const DEFAULT_IDLE_MS = 900000; // 15 minutes
const DEFAULT_WARNING_MS = 720000; // 12 minutes (3 min before logout)

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

interface UseIdleTimeoutOptions {
  /** Total idle timeout in ms before forced logout (default: 900000 = 15 min) */
  idleTimeoutMs?: number;
  /** Time in ms when warning modal appears (default: 720000 = 12 min) */
  warningTimeoutMs?: number;
  /** Callback when user is forcefully logged out */
  onLogout?: () => void;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

interface UseIdleTimeoutReturn {
  /** Whether the warning modal should be shown */
  showWarning: boolean;
  /** Seconds remaining until forced logout */
  secondsRemaining: number;
  /** Reset the idle timer (call on user activity) */
  resetTimer: () => void;
  /** Extend the session (dismiss warning and reset timer) */
  extendSession: () => void;
}

export function useIdleTimeout(options: UseIdleTimeoutOptions = {}): UseIdleTimeoutReturn {
  const {
    idleTimeoutMs = DEFAULT_IDLE_MS,
    warningTimeoutMs = DEFAULT_WARNING_MS,
    onLogout,
    enabled = true,
  } = options;

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.floor((idleTimeoutMs - warningTimeoutMs) / 1000)
  );

  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onLogoutRef = useRef(onLogout);

  // Keep onLogout ref in sync
  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();

    if (!enabled) return;

    // Warning timer: show modal at warningTimeoutMs
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsRemaining(Math.floor((idleTimeoutMs - warningTimeoutMs) / 1000));

      // Start countdown every second
      countdownRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningTimeoutMs);

    // Logout timer: force logout at idleTimeoutMs
    logoutTimerRef.current = setTimeout(() => {
      setShowWarning(false);
      clearTimers();
      if (onLogoutRef.current) {
        onLogoutRef.current();
      }
    }, idleTimeoutMs);
  }, [idleTimeoutMs, warningTimeoutMs, enabled, clearTimers]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setSecondsRemaining(Math.floor((idleTimeoutMs - warningTimeoutMs) / 1000));
    startTimers();
  }, [idleTimeoutMs, warningTimeoutMs, startTimers]);

  const extendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Listen for user activity
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      // Only reset if warning is not showing — if warning is showing, user must explicitly extend
      if (!showWarning) {
        resetTimer();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Start initial timers
    startTimers();

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      clearTimers();
    };
  }, [enabled, startTimers, clearTimers, showWarning, resetTimer]);

  // Re-start timers when showWarning changes to false (after extend)
  useEffect(() => {
    if (!showWarning && enabled) {
      startTimers();
    }
  }, [showWarning, enabled, startTimers]);

  return {
    showWarning,
    secondsRemaining,
    resetTimer,
    extendSession,
  };
}
