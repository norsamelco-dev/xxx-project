# Authentication & Authorization

## Web admin (session-based)

### Login flow

1. `POST /api/auth/login` with `{ username, password }`
2. Server validates against `users` (SHA-256 password hash)
3. Session stored server-side; cookie `linda.sid` sent to browser
4. Subsequent requests include cookie (`credentials: 'include'`)

### Logout

`POST /api/auth/logout` destroys session.

### Session user payload

Typically includes: `userid`, `username`, `fullname`, `role`, `branchId`, `pageAccess` (or equivalent).

### Branch context

After auth, `requireBranchContext` attaches `req.branchId` from the logged-in user. Most mutating routes require a valid branch.

## POS (Bearer token)

### Login flow

1. `POST /api/auth/login` with header `X-POS-Client: mobile` (or similar)
2. Response: `{ user, token }`
3. Client stores token (AsyncStorage / localStorage)
4. Axios interceptor adds `Authorization: Bearer <token>`

### Terminal validation

POS login also validates:

- Machine name / serial against `terminals_a`
- Terminal `branch_id` matches user `branch_id`
- Terminal permit and OR range validity dates

## Password hashing

Legacy-compatible **SHA-256** hex digest of plain password, compared to `users.password`.

## Roles and page access

Users have a **role** and optional **page access** list controlling web admin menu items (Dashboard, Products, Users, Branches, Audit Logs, etc.).

POS users are typically cashiers with POS-only access; admins use the web app.

## Middleware chain (typical)

```
requireAuth → requireBranchContext → route handler
```

Some routes (health, login, static assets) skip auth.

## Audit logging

Authenticated actions may be recorded in `audit_logs` with user, branch, action, entity, and timestamp. See web **Audit Logs** page.

## Security checklist

| Item | Recommendation |
|------|----------------|
| HTTPS | Required in production for cookies and tokens |
| Session secret | Strong random value in production |
| CORS | Restrict to known admin and POS origins |
| Branch isolation | Never trust client-supplied `branch_id` without server validation |
