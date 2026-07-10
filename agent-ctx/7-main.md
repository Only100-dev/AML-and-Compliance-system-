# Task 7 - Migrate from custom useApiFetch to TanStack React Query

## Summary
Successfully migrated the IC-OS project from custom `useApiFetch` hooks to TanStack React Query while maintaining full backward compatibility.

## Files Created
1. **`/src/components/providers/QueryProvider.tsx`** - Client component providing QueryClientProvider with QueryClient (staleTime: 60s, retry: 2, refetchOnWindowFocus: false)
2. **`/src/lib/query-hooks.ts`** - Complete React Query based API hooks module with 22 query hooks + mutation hook + queryKeys factory

## Files Modified
1. **`/src/app/layout.tsx`** - Added QueryProvider import and wrapped AuthProvider with QueryProvider
2. **`/src/lib/api-hooks.ts`** - Added @deprecated JSDoc notice (file still fully functional)
3. **`/home/z/my-project/worklog.md`** - Appended work record

## Key Design Decisions
- All new hooks return `{ data, loading, error, refetch }` to match the old API shape (mapping `isLoading` → `loading`, `error?.message` → `error`)
- `queryKeys` factory provides typed query keys for all data domains, enabling targeted cache invalidation
- `useApiMutation` supports `invalidateKeys` option for automatic cache invalidation after mutations
- `useAIChatMessages` uses `enabled: !!sessionId` to avoid fetching with empty sessionId
- Old `api-hooks.ts` remains fully functional with deprecation notice — zero breaking changes

## Verification
- `bun run lint` — no errors
- Dev server responding (HTTP 200 on /)
