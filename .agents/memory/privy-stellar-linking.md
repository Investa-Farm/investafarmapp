---
name: Privy Stellar wallet linking
description: Investa authentication remains primary; Privy provides a separately linked self-custody Stellar wallet.
---

**Rule:** Keep the existing Investa sign-in as the primary identity flow. Privy provides user wallets for supported on-chain assets; it is not the KES ledger or a payment processor. Keep the Privy wallet separate from the in-app KES wallet unless an explicit conversion and reconciliation flow is defined. The intended product roles are payment methods for funding, Bridge for stablecoin flows, and Stellar SDP for outbound disbursements. Link a Privy wallet only for an authenticated Investa user, store only its public address, and never accept a client-submitted address as proof of ownership or store private keys.

**Why:** The user clarified that Privy wallets hold on-chain assets, payment methods fund accounts, Bridge handles stablecoin flows, and Stellar SDP handles disbursements. Keeping these balances and services distinct avoids treating a wallet address as a cash ledger or double-crediting value.

**How to apply:** Any wallet-linking route must verify both the Investa session and Privy's access token, then confirm the user's linked Stellar wallet server-side. Before adding deposit or payout routes, define the currency, source, destination, conversion, reconciliation, and idempotency behavior.
