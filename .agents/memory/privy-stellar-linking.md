---
name: Privy Stellar wallet linking
description: Investa authentication remains primary; Privy provides a separately linked self-custody Stellar wallet.
---

**Rule:** Keep the existing Investa sign-in as the primary identity flow. Link a Privy Stellar wallet only for an already authenticated Investa user, and store its public address separately from the app's custodial wallet accounts. Never accept a client-submitted email or address as proof of ownership, and never store wallet private keys.

**Why:** The user selected “connect wallet after existing sign-in” and Stellar. This preserves the current login/session model while keeping self-custody wallet records distinct from existing financial account records.

**How to apply:** Any future wallet-linking or mutation route must verify both the Investa session and Privy's access token, then confirm the user's linked Stellar wallet server-side before changing the stored association.
