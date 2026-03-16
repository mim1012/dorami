# Auth Token Refresh & Profile Registration Bugs

**Last Updated:** 2026-03-14
**Status:** Documented for future reference

This document records bugs found and fixed in the token refresh flow and profile registration redirect loop. Check these first if token refresh fails or users are stuck in registration loops.

---

## Bug 1: nginx routing blocks Next.js Route Handler

**Symptom**
After profile registration, user is redirected back to `/profile/register` in a loop. Browser console shows `TOKEN_REFRESH_FAILED` with 401 status.

**Root Cause**
nginx `location /api/auth` prefix block was intercepting `/api/auth/refresh` requests and proxying them directly to the backend. The Next.js Route Handler at `client-app/src/app/api/auth/refresh/route.ts` was never reached.

**Why It Matters**
When nginx proxies directly to the backend, the backend's `Set-Cookie` headers are not reliably forwarded to the browser due to App Router + standalone output handling. The Next.js Route Handler was designed specifically to guarantee `Set-Cookie` reaches the client.

**Fix Applied**
Added an exact-match nginx location that routes `/api/auth/refresh` to the frontend BEFORE the prefix-match location for `/api/auth`:

```nginx
location = /api/auth/refresh {
  proxy_pass http://frontend;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/auth {
  proxy_pass http://backend;
  # ... other auth routes to backend
}
```

**File Changed**
`nginx/conf.d/production.conf`

**Key Insight**
nginx location matching priority: exact match (`=`) > prefix match (`~` or `/`). Place the exact match BEFORE the prefix block.

---

## Bug 2: Backend refresh endpoint doesn't rotate `refreshToken` cookie

**Symptom**
Token refresh works once, then fails with 401 on every subsequent refresh attempt.

**Root Cause**
The `POST /api/auth/refresh` endpoint only set the `accessToken` cookie in the response. The `authService.refreshToken()` method generates a new `refreshToken` and stores it in Redis, but the browser never received the updated cookie. On the next refresh, Redis holds the new token but the browser sends the old one → token mismatch → 401.

**Fix Applied**
Modified `auth.controller.ts` refresh endpoint to set both cookies:

```typescript
@Post('refresh')
async refresh(@Res() res: Response) {
  const loginResponse = await this.authService.refreshToken(userId);

  // Set BOTH cookies, not just accessToken
  res.cookie('accessToken', loginResponse.accessToken, this.getAccessTokenCookieOptions());
  res.cookie('refreshToken', loginResponse.refreshToken, this.getRefreshTokenCookieOptions());

  res.json({ success: true });
}
```

**File Changed**
`backend/src/modules/auth/auth.controller.ts` (refresh endpoint, around line 200)

**Key Insight**
Token rotation requires BOTH cookies to be updated. If you only update one, the next refresh attempt will fail with a mismatch error.

---

## Bug 3: Next.js Route Handler ignores `refreshToken` cookie

**Symptom**
Even if the backend sends both cookies, the browser never receives the updated `refreshToken`.

**Root Cause**
The `client-app/src/app/api/auth/refresh/route.ts` Route Handler extracted only the `accessToken` from the backend's `Set-Cookie` headers. The `refreshToken` header was ignored, so the browser never stored the updated token.

**Fix Applied**
Use `getSetCookie()` to extract all `Set-Cookie` headers as an array and set both tokens:

```typescript
// In client-app/src/app/api/auth/refresh/route.ts
const cookies = response.headers.getSetCookie(); // Returns string[]

for (const cookie of cookies) {
  if (cookie.includes('accessToken=')) {
    res.headers.append('Set-Cookie', cookie);
  }
  if (cookie.includes('refreshToken=')) {
    res.headers.append('Set-Cookie', cookie);
  }
}

return NextResponse.json({ success: true });
```

**File Changed**
`client-app/src/app/api/auth/refresh/route.ts`

**Key Insight**
`response.headers.get('Set-Cookie')` returns only the FIRST `Set-Cookie` header. Use `getSetCookie()` to get all of them as an array.

---

## Bug 4: `STAGING_LATEST_IMAGE_TAG` not updated during production deploy

**Symptom**
Production auto-deploy uses an old Docker image hash even though staging deployed a new one minutes before.

**Root Cause**
When a staging deploy triggers a production deployment simultaneously, the production deploy reads the `STAGING_LATEST_IMAGE_TAG` GitHub Actions variable BEFORE the staging deploy has finished updating it. This causes a race condition where production uses a stale image hash.

**How to Detect**
Run:

```bash
gh api "repos/mim1012/dorami/actions/variables/STAGING_LATEST_IMAGE_TAG"
```

Check the `updated_at` timestamp. If it's older than the most recent staging deploy, the variable is stale.

**Manual Fix**
If the variable is outdated, update it manually:

```bash
gh api --method PATCH "repos/mim1012/dorami/actions/variables/STAGING_LATEST_IMAGE_TAG" \
  -f name="STAGING_LATEST_IMAGE_TAG" \
  -f value="sha-<40-character-hex-hash>"
```

Then re-run the production deploy workflow.

**Files Involved**

- `.github/workflows/deploy-staging.yml` — updates the variable
- `.github/workflows/deploy-prod.yml` — reads the variable

**Key Insight**
GitHub Actions environment variables are eventually consistent. Always verify the `updated_at` timestamp matches your most recent deploy.

---

## Database Column Names for Profile Reset

If you need to reset a user's profile (e.g., for testing), use the correct column names:

| Prisma Field         | Database Column              | Type                    |
| -------------------- | ---------------------------- | ----------------------- |
| `shippingAddress`    | `"shippingAddress"` (quoted) | camelCase               |
| `profileCompletedAt` | `profile_completed_at`       | snake_case (via `@map`) |

**Reset SQL**

```sql
UPDATE users
SET "shippingAddress" = NULL,
    profile_completed_at = NULL,
    updated_at = NOW()
WHERE email = 'user@email.com';
```

---

## Diagnostic Checklist

When users report token refresh loops or profile registration redirects, verify in this order:

- [ ] **nginx routing**: Confirm `location = /api/auth/refresh` exists BEFORE `location /api/auth` in `nginx/conf.d/production.conf`
- [ ] **Backend refresh endpoint**: Verify both `accessToken` and `refreshToken` cookies are set in the response
- [ ] **Next.js Route Handler**: Check that `getSetCookie()` is used to extract ALL `Set-Cookie` headers, not just the first one
- [ ] **Redis state**: Verify the refreshToken stored in Redis matches the cookie in the browser
- [ ] **Image tag**: If deploying to production, verify `STAGING_LATEST_IMAGE_TAG` is up to date via GitHub API
- [ ] **Profile state**: If reset is needed, use the SQL command with correct column names

---

## References

- Frontend auth flow: `client-app/src/app/api/auth/refresh/route.ts`
- Backend auth logic: `backend/src/modules/auth/auth.controller.ts`, `backend/src/modules/auth/auth.service.ts`
- nginx config: `nginx/conf.d/production.conf`
- Deployment workflows: `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-prod.yml`
