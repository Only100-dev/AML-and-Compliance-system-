import { authGuard } from '@/lib/auth-guard';

/**
 * Resolve the actor user ID from the inconsistent auth session shape used
 * across the IC-OS codebase (some sessions carry `user.id`, others carry
 * `user.userId`, and the dev-mode synthetic user uses `userId: 'dev-user'`).
 *
 * Falls back to the literal string `'unknown'` so audit logging never throws
 * on a missing user identifier.
 *
 * Introduced by P0-1c-batch-B for the Core Compliance audit logging rollout.
 */
export function resolveActorId(auth: Awaited<ReturnType<typeof authGuard>>): string {
  const user = auth.session?.user as Record<string, unknown> | undefined;
  return (user?.id as string | undefined) ??
    (user?.userId as string | undefined) ??
    'unknown';
}
