# Task 4 - Implement NextAuth + RBAC

## Agent: Main
## Status: COMPLETED

## Summary
Successfully implemented NextAuth authentication with RBAC support for the IC-OS v7.0 project.

## Files Created
1. `/home/z/my-project/src/app/api/auth/[...nextauth]/route.ts` - NextAuth API route with CredentialsProvider, JWT strategy, role/jurisdiction callbacks
2. `/home/z/my-project/src/components/auth/LoginForm.tsx` - Login form with demo account quick-fill
3. `/home/z/my-project/src/app/login/page.tsx` - Login page with server-side session redirect
4. `/home/z/my-project/src/components/auth/AuthProvider.tsx` - SessionProvider wrapper for client-side session
5. `/home/z/my-project/src/lib/auth-guard.ts` - API route protection helper with RBAC
6. `/home/z/my-project/prisma/seed-users.ts` - Demo user seeder (6 users)

## Files Modified
1. `/home/z/my-project/src/app/layout.tsx` - Added AuthProvider import and wrapped children
2. `/home/z/my-project/src/middleware.ts` - Added NextAuth token check, public routes, auth redirects (prod only)
3. `/home/z/my-project/src/lib/store.ts` - Added comment about session data overriding currentUser
4. `/home/z/my-project/worklog.md` - Appended task 4 work record

## Key Decisions
- Auth check in middleware is skipped in dev mode (NODE_ENV=development) to allow preview panel access
- Production mode redirects unauthenticated page requests to /login, returns 401 for API requests
- JWT session strategy with 8-hour max age
- Demo passwords are role-based (admin123, mlro123, cm123, co123, dh123, board123)
- All existing middleware logic (preview panel, CORS, security headers) preserved

## Verification
- `bun run lint` - No errors
- `curl http://localhost:3000/` - 200 OK
- `curl http://localhost:3000/login` - 200 OK
- `curl http://localhost:3000/api/auth/csrf` - Returns valid CSRF token
- 6 demo users seeded successfully in database
