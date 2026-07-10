# Task 5: Per-Module ErrorBoundary Wrapping

## Summary
Added `ModuleErrorBoundary` component and wrapped each lazy-loaded module in `page.tsx` with its own error boundary, so a single module crash no longer takes down the entire app.

## Files Modified
1. **src/components/shared/ErrorBoundary.tsx** — Added `ModuleErrorBoundary` class component and `ModuleErrorBoundaryProps` interface
2. **src/app/page.tsx** — Imported `ModuleErrorBoundary`, wrapped each of the 28 module cases in `renderSection()` with individual `ModuleErrorBoundary moduleName="..."` wrappers

## Key Decisions
- `ModuleErrorBoundary` is a separate class from `ErrorBoundary` — lighter UI, single Retry button (no "Reload Page"), compact card layout
- Top-level `ErrorBoundary` kept wrapping `<main>` + `<Suspense>` as safety net for layout-level crashes
- Each module gets a human-readable name for the error card (e.g., "AML & Sanctions Triage" instead of "aml-sanctions")
- No module component internals were modified — only the rendering wrappers in page.tsx

## Verification
- `bun run lint`: 0 errors, 1 pre-existing warning (TanStack Virtual in TrainingCertifications.tsx)
- Dev server: compiles cleanly
