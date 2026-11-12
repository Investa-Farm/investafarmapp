---
name: Investa Farm wallet payment boundaries
description: Product rules for KES/stablecoin separation, Privy wallet links, and Stellar disbursement safety.
---

- KES and stablecoin balances are separate. Neither converts nor bridges into the other without an explicit user-initiated and confirmed transaction.
- The user wants farm shares to be investable through either the separate KES wallet or Solana USDC Blink, with social share links opening an investable listing.
- Use established stablecoins on supported networks; do not mint Investa Farm proprietary tokens.
- Privy-linked Solana and Stellar wallets receive Aurora deposits; mainnet investment Blinks require an Investa-linked Privy Solana wallet and approved investor KYC.
- Solana USDC investments are limited to primary listings until seller payouts can be settled. Confirmed purchases create KES-priced shares without changing the KES wallet.
- Stellar SDP payouts (such as yield batches) require human admin approval and confirmed prefunding before submission.
- Aurora persistent deposit addresses are for Solana mainnet; they are not proof of payment. Solana Devnet balances never become KES, Polygon USDC, or real farm shares.
- Do not issue crop-share tokens until an audited Solana issuance program and controlled mint workflow exist.

**Why:** Mainnet deposits, testnet assets, KES balances, and farm-share ownership are separate states. A secondary purchase cannot be marked complete while its seller has not received settlement.

**How to apply:** Keep provider rails and balances explicit in APIs and UI. If the correct provider/network configuration is missing, disable the transfer and state that no balance moved instead of simulating completion. Do not show an investment as funded until settlement and share issuance are independently confirmed; do not enable secondary USDC trades without seller settlement.
