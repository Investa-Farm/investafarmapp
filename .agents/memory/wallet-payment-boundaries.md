---
name: Investa Farm wallet payment boundaries
description: Product rules for KES/stablecoin separation, Privy wallet links, and Stellar disbursement safety.
---

- KES and stablecoin balances are separate. Neither converts nor bridges into the other without an explicit user-initiated and confirmed transaction.
- Use established stablecoins on supported networks; do not mint Investa Farm proprietary tokens.
- Privy is the user wallet/key manager. Investa Farm may store a server-verified public address, but reconnecting must preserve the existing linked wallet rather than silently creating or replacing it.
- Stellar SDP payouts (such as yield batches) require human admin approval and confirmed prefunding before submission.

**Why:** The user selected these as financial-safety and account-recovery boundaries; silent conversion, wallet replacement, or unfunded automated payouts can lose access to or misdirect funds.

**How to apply:** Keep provider rails and balances explicit in APIs and UI. If the correct provider/network configuration is missing, disable the transfer and state that no balance moved instead of simulating completion.
