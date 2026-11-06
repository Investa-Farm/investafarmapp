---
name: Investa Farm wallet payment boundaries
description: Product rules for KES/stablecoin separation, Privy wallet links, and Stellar disbursement safety.
---

- KES and stablecoin balances are separate. Neither converts nor bridges into the other without an explicit user-initiated and confirmed transaction.
- Use established stablecoins on supported networks; do not mint Investa Farm proprietary tokens.
- Privy is the user wallet/key manager. Investa Farm may store a server-verified public address, but reconnecting must preserve the existing linked wallet rather than silently creating or replacing it.
- Stellar SDP payouts (such as yield batches) require human admin approval and confirmed prefunding before submission.
- Aurora persistent deposit addresses are for Solana mainnet; they are not proof of payment. Solana Devnet balances never become KES, Polygon USDC, or real farm shares.
- Do not issue crop-share tokens until an audited Solana issuance program and controlled mint workflow exist.

**Why:** The user selected these as financial-safety and account-recovery boundaries. Mainnet deposits, testnet assets, and investment ownership are separate states; conflating them or issuing unaudited shares could misdirect or misrepresent funds.

**How to apply:** Keep provider rails and balances explicit in APIs and UI. If the correct provider/network configuration is missing, disable the transfer and state that no balance moved instead of simulating completion. Do not show an investment as funded until settlement and share issuance are independently confirmed.
