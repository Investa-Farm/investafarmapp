---
name: Wallet security boundary
description: Durable decisions for wallet PIN authorization and investor holding ownership checks.
---

Wallet PIN authorization is required server-side for every withdrawal method, while the client gate is only a convenience and must never be trusted as the security boundary.

**Why:** A client-only PIN check can be bypassed, allowing an attacker to call withdrawal endpoints directly.

Exit requests and secondary-market listings do not require the wallet PIN because they create requests/listings rather than directly moving wallet funds; they must still verify that the holding belongs to the signed-in investor.

**How to apply:** Keep the four-digit format and lockout behavior consistent across setup, verification, and withdrawal routes. Preserve investor ownership predicates on exit/listing mutations.