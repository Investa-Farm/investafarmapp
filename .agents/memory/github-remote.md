---
name: GitHub remote authentication
description: Use Replit's secure GitHub authentication path for shell pushes without exposing credentials.
---

**Rule:** Never put a GitHub token in chat, source control, shell history, or logs. Replit can rewrite `github.com` URLs to an internal host; if that path rejects a valid `GIT` secret, push to the public GitHub URL with the injected rewrite disabled and a temporary askpass helper. Use `GIT_URL` only as a secure fallback when no usable write credential is available.

**Why:** Replit's internal Git proxy may authenticate as the workspace account and return 403 even when the existing token can write to the target repository directly.

**How to apply:** Check integration and secret availability first. For direct shell pushes, set `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`, use the existing token only through temporary askpass, avoid credential-bearing URLs, and verify the result with `git ls-remote`. Never force-push unless the user explicitly requests it.
