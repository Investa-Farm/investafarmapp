import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSolanaInvestmentQuote,
  isExpectedSolanaUsdcPayment,
} from "./solana-investment.js";

test("quotes KES shares in USDC including the platform fee", () => {
  const quote = calculateSolanaInvestmentQuote(100, 3, 0.015, 130);
  assert.equal(quote.principalKes, 300);
  assert.equal(quote.feeKes, 4.5);
  assert.equal(quote.totalKes, 304.5);
  assert.equal(quote.amountUsdc, "2.342308");
});

test("rejects invalid or non-positive quote inputs", () => {
  assert.throws(() => calculateSolanaInvestmentQuote(100, 0, 0.015, 130));
  assert.throws(() => calculateSolanaInvestmentQuote(100, 1, 0.015, 0));
});

test("accepts only a signed transfer with the expected mint, destination, amount, and memo", () => {
  const transaction = {
    meta: { err: null },
    transaction: {
      message: {
        accountKeys: [{ pubkey: { toBase58: () => "investor-wallet" }, signer: true }],
        instructions: [
          {
            program: "spl-token",
            parsed: {
              type: "transferChecked",
              info: {
                authority: "investor-wallet",
                destination: "treasury-ata",
                mint: "usdc-mint",
                tokenAmount: { amount: "2342308", decimals: 6 },
              },
            },
          },
          { program: "spl-memo", parsed: "IFARM:purchase-123" },
        ],
      },
    },
  };
  const expected = {
    walletAddress: "investor-wallet",
    destinationAta: "treasury-ata",
    mintAddress: "usdc-mint",
    amountRaw: "2342308",
    memo: "IFARM:purchase-123",
  };

  assert.equal(isExpectedSolanaUsdcPayment(transaction, expected), true);
  assert.equal(
    isExpectedSolanaUsdcPayment(transaction, { ...expected, amountRaw: "2342309" }),
    false,
  );
});

test("rejects failed or unsigned transactions", () => {
  const transaction = {
    meta: { err: { InstructionError: [0, "Custom"] } },
    transaction: {
      message: {
        accountKeys: [{ pubkey: { toBase58: () => "investor-wallet" }, signer: false }],
        instructions: [],
      },
    },
  };
  assert.equal(
    isExpectedSolanaUsdcPayment(transaction, {
      walletAddress: "investor-wallet",
      destinationAta: "treasury-ata",
      mintAddress: "usdc-mint",
      amountRaw: "1",
      memo: "IFARM:purchase-123",
    }),
    false,
  );
});
