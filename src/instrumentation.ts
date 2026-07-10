/**
 * IC-OS Observability & Instrumentation
 *
 * This file provides runtime error monitoring and performance tracking.
 * In production, replace the mock logging service with Sentry, PostHog, or Vercel Analytics.
 */

interface ErrorEvent {
  message: string;
  stack?: string;
  timestamp: number;
  url?: string;
  userAgent?: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

// ─── Error Logging Service (Mock / Replace with Sentry) ──────────────────────

const errorBuffer: ErrorEvent[] = [];
const MAX_ERROR_BUFFER = 100;

function logError(error: Error | string, context?: Record<string, string>): void {
  const event: ErrorEvent = {
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error === 'string' ? undefined : error.stack,
    timestamp: Date.now(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  // Add context tags if provided
  if (context) {
    event.message = `${event.message} | ctx: ${JSON.stringify(context)}`;
  }

  errorBuffer.push(event);
  if (errorBuffer.length > MAX_ERROR_BUFFER) {
    errorBuffer.shift();
  }

  // In production, send to Sentry / monitoring service:
  // Sentry.captureException(error, { extra: context });
  if (process.env.NODE_ENV === 'development') {
    console.error('[IC-OS Instrumentation]', event.message, context ?? '');
  }
}

function getErrorLog(): ErrorEvent[] {
  return [...errorBuffer];
}

// ─── Performance Tracking ────────────────────────────────────────────────────

const metricsBuffer: PerformanceMetric[] = [];
const MAX_METRICS_BUFFER = 200;

function trackPerformance(name: string, value: number, tags?: Record<string, string>): void {
  const metric: PerformanceMetric = {
    name,
    value,
    timestamp: Date.now(),
    tags,
  };

  metricsBuffer.push(metric);
  if (metricsBuffer.length > MAX_METRICS_BUFFER) {
    metricsBuffer.shift();
  }

  // In production, send to Vercel Analytics / PostHog:
  // analytics.track(name, { value, ...tags });
}

function getPerformanceMetrics(): PerformanceMetric[] {
  return [...metricsBuffer];
}

// ─── Global Error Handler Setup ──────────────────────────────────────────────

function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    logError(event.error ?? event.message, {
      type: 'unhandled_error',
      filename: event.filename,
      lineno: String(event.lineno),
      colno: String(event.colno),
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logError(
      reason instanceof Error ? reason : new Error(String(reason)),
      { type: 'unhandled_promise_rejection' }
    );
  });

  // Track hydration mismatches
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args.join(' ');
    if (message.includes('Hydration') || message.includes('hydration')) {
      logError(new Error(`Hydration mismatch: ${message}`), {
        type: 'hydration_error',
      });
    }
    originalConsoleError.apply(console, args);
  };

  // Track Web Vitals
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          const lcp = entries[entries.length - 1];
          trackPerformance('LCP', lcp.startTime, { type: 'web_vital' });
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const clsValue = (entry as PerformanceEntry & { value: number }).value;
          trackPerformance('CLS', clsValue, { type: 'web_vital' });
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          trackPerformance('FID', entry.startTime, { type: 'web_vital' });
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch {
      // PerformanceObserver not supported or entry types not available
    }
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export { logError, getErrorLog, trackPerformance, getPerformanceMetrics, setupGlobalErrorHandlers };
