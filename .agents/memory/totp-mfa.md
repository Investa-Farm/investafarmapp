---
name: TOTP MFA implementation
description: How TOTP 2FA is implemented; critical CJS import workaround for otplib+qrcode in the esbuild pipeline
---

## Rule
`otplib` and `qrcode` are CJS-only packages. In the esbuild pipeline (ESM output), neither `import { authenticator } from "otplib"` (no named export) nor `import otplibPkg from "otplib"` (no default export) works at runtime.

**The only working pattern** is:
1. Add both packages to the `external` array in `artifacts/api-server/build.mjs`
2. Use `createRequire` in the route file to load them:

```typescript
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
const authenticator = (_require("otplib") as any).authenticator as { ... };
const QRCode = _require("qrcode") as { toDataURL(url: string): Promise<string> };
```

**Why:** esbuild bundles to ESM. CJS packages without a `default` export crash at runtime when imported via ESM `import`. The `createRequire` pattern forces Node.js CJS loader at runtime, bypassing ESM resolution entirely.

**How to apply:** Any CJS package that esbuild fails to bundle with "No matching export" or "does not provide an export named 'default'" — add to externals + use createRequire.

## TOTP Flow

- DB columns: `totpSecret` (text, nullable), `totpEnabled` (boolean, default false) on `usersTable`
- Routes in `artifacts/api-server/src/routes/totp.ts`:
  - `POST /api/auth/totp/setup` — generates secret, saves to DB, returns QR data URL + manual code
  - `POST /api/auth/totp/enable` — verifies first code, sets totpEnabled=true
  - `POST /api/auth/totp/verify-login` — takes tempToken + code, returns full auth token
  - `DELETE /api/auth/totp/disable` — verifies code, clears secret + disables
  - `GET /api/auth/totp/status` — returns `{ totpEnabled }` for current user
- Login flow: after password success, if `totpEnabled` → respond `{ totpRequired: true, tempToken }` → frontend shows 6-digit TOTP step → calls verify-login → gets full token
- `signToken` and `verifyToken` and `getCurrentUser` are all exported from `auth.ts`
