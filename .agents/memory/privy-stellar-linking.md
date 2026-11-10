---
name: Privy Stellar wallet linking
description: Investa authentication remains primary; Privy manages linked Solana and Stellar wallets while KES stays separate.
---

**Rule:** Keep the existing Investa sign-in as the primary identity flow. Privy manages the user's Solana and Stellar wallets; it is not the KES ledger or a payment processor. Keep these on-chain balances separate from the in-app KES wallet unless an explicit conversion and reconciliation flow is defined. Link wallets only for an authenticated Investa user, verify ownership server-side, store public addresses only, and never store private keys.

**Why:** The user clarified that Privy should manage both Solana and Stellar wallets, while KES remains separate. Keeping these balances distinct avoids treating an on-chain address as a cash ledger or crediting the same value twice.

**How to apply:** Any wallet-linking route must verify both the Investa session and Privy's access token, then confirm the user's wallet address server-side. Deposits must not silently convert to KES or complete a farm-share purchase; define currency, source, destination, reconciliation, and idempotency before adding those flows.
