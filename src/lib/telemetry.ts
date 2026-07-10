/**
 * Telemetry utility for error logging and observability.
 * In production, this would send to an APM service (DataDog, Sentry, etc.)
 * For now, logs to console in dev mode with structured context.
 */

export interface TelemetryEvent {
  timestamp: string;
  type: 'error' | 'warning' | 'info';
  module: string;
  action: string;
  message: string;
  context?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

class Telemetry {
  private events: TelemetryEvent[] = [];
  private maxEvents = 1000;

  logError(error: Error | unknown, context?: { module: string; action: string; [key: string]: unknown }) {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      type: 'error',
      module: context?.module || 'unknown',
      action: context?.action || 'unknown',
      message: error instanceof Error ? error.message : String(error),
      context: context ? Object.fromEntries(
        Object.entries(context).filter(([k]) => k !== 'module' && k !== 'action')
      ) : undefined,
    };
    this.addEvent(event);
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Telemetry] ERROR in ${event.module}.${event.action}:`, event.message, event.context);
    }
  }

  logWarning(message: string, context?: { module: string; action: string }) {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      type: 'warning',
      module: context?.module || 'unknown',
      action: context?.action || 'unknown',
      message,
    };
    this.addEvent(event);
  }

  logInfo(message: string, context?: { module: string; action: string }) {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      type: 'info',
      module: context?.module || 'unknown',
      action: context?.action || 'unknown',
      message,
    };
    this.addEvent(event);
  }

  getRecentEvents(count = 50): TelemetryEvent[] {
    return this.events.slice(-count);
  }

  getErrors(count = 50): TelemetryEvent[] {
    return this.events.filter(e => e.type === 'error').slice(-count);
  }

  private addEvent(event: TelemetryEvent) {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }
}

// Singleton instance
export const telemetry = new Telemetry();

// Convenience function matching the spec: logError(error, context)
export function logError(error: Error | unknown, context: { module: string; action: string; [key: string]: unknown }) {
  telemetry.logError(error, context);
}
