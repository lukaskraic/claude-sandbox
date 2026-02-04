# Authentication Design

## Overview

Simple session-based authentication with local users. Designed to be extensible for Entra (Azure AD) in the future.

## Requirements

- Two users: `lukas.kraic`, `gabriel.tekel`
- Credentials stored in environment variable
- Sessions stored in SQLite (persist across server restarts)
- Session expires when browser closes (session cookie)
- All routes protected except `/health` and `/login`

## Configuration

```bash
AUTH_USERS=lukas.kraic:SandBox2026!,gabriel.tekel:SandBox2026!
```

## Database Schema

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_accessed INTEGER NOT NULL
);

CREATE INDEX idx_sessions_username ON sessions(username);
```

## Backend Changes

### 1. Auth Service (`packages/server/src/services/AuthService.ts`)

```typescript
class AuthService {
  // Parse AUTH_USERS env variable
  private users: Map<string, string>

  validateCredentials(username: string, password: string): boolean
  createSession(username: string): string  // Returns session ID
  getSession(sessionId: string): Session | null
  deleteSession(sessionId: string): void
  touchSession(sessionId: string): void  // Update last_accessed
  cleanupOldSessions(): void  // Remove sessions older than 7 days
}
```

### 2. Auth Router (`packages/server/src/trpc/routers/authRouter.ts`)

```typescript
auth.login({ username, password })
  // Validates credentials
  // Creates session in DB
  // Sets httpOnly cookie 'session_id'
  // Returns { success: true, username }

auth.logout()
  // Deletes session from DB
  // Clears cookie
  // Returns { success: true }

auth.me()
  // Returns current user from session or null
  // Does NOT throw if not authenticated
```

### 3. Auth Middleware

Applied to:
- All tRPC routes (except auth.login, auth.me)
- `/api/upload/*`
- `/proxy/*`
- `/ws` WebSocket upgrade

NOT applied to:
- `/health`
- `/login` (frontend route)
- Static files

### 4. Cookie Settings

```typescript
{
  name: 'session_id',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  // No maxAge = session cookie (expires when browser closes)
}
```

## Frontend Changes

### 1. Login View (`packages/web/src/views/LoginView.vue`)

- Username text field
- Password text field
- Login button
- Error message display
- Redirect to original URL after login

### 2. Auth Composable (`packages/web/src/composables/useAuth.ts`)

```typescript
const user = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function checkAuth(): Promise<void>
async function login(username: string, password: string): Promise<boolean>
async function logout(): Promise<void>
```

### 3. Router Guard (`packages/web/src/router/index.ts`)

```typescript
router.beforeEach(async (to) => {
  const auth = useAuth()

  // Wait for initial auth check
  if (auth.loading.value) {
    await auth.checkAuth()
  }

  // Already on login page
  if (to.path === '/login') {
    return auth.user.value ? '/projects' : true
  }

  // Not authenticated - redirect to login
  if (!auth.user.value) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})
```

### 4. App.vue Changes

- Show username in app bar when logged in
- Add logout button/menu

## Security Considerations

- Passwords compared using timing-safe comparison
- Session IDs generated with crypto.randomUUID()
- HttpOnly cookies prevent XSS token theft
- CSRF protection via SameSite cookie
- Rate limiting on login endpoint (future enhancement)

## Future Entra Integration

The architecture supports adding Entra:

1. Add `/auth/entra/login` - redirects to Azure AD
2. Add `/auth/entra/callback` - handles OAuth callback
3. Callback creates session same as local login
4. Frontend detects Entra mode and shows "Login with Microsoft" button
5. Local auth can remain as fallback

## Files to Create/Modify

**Create:**
- `packages/server/src/services/AuthService.ts`
- `packages/server/src/trpc/routers/authRouter.ts`
- `packages/server/src/middleware/auth.ts`
- `packages/web/src/views/LoginView.vue`
- `packages/web/src/composables/useAuth.ts`

**Modify:**
- `packages/server/src/db/schema.ts` - add sessions table
- `packages/server/src/index.ts` - add auth middleware, cookie parser
- `packages/server/src/trpc/router.ts` - add auth router
- `packages/server/src/trpc/context.ts` - add user to context
- `packages/server/src/ws/terminalHandler.ts` - verify session
- `packages/server/src/api/uploads.ts` - add auth check
- `packages/server/src/api/proxy.ts` - add auth check
- `packages/web/src/router/index.ts` - add guard, login route
- `packages/web/src/App.vue` - add logout, show username
