---
name: VAPID key security
description: Safe startup, local fallback, and logging rules for web-push VAPID keys.
---

- Production startup must fail when `VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY` is missing.
- Development may generate a local key pair and cache it in the gitignored `.vapid-keys.json` file.
- Never log VAPID public or private key values. Startup logs should only say whether a development pair was generated or loaded.
- Deleting the local cache and restarting regenerates the pair; avoid doing so casually because existing push subscriptions may no longer match.

**Why:** VAPID key material should not be exposed in workflow logs, and changing a key pair can invalidate existing push subscriptions.

**How to apply:** Keep production configuration explicit, keep development fallback local, and report only key-generation status in logs.
