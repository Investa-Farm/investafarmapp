export interface SolanaInvestmentQuote {
  principalKes: number;
  feeKes: number;
  totalKes: number;
  amountUsdcRaw: bigint;
  amountUsdc: string;
}

export function calculateSolanaInvestmentQuote(
  pricePerShareKes: number,
  quantity: number,
  feeRate: number,
  kesPerUsdc: number,
): SolanaInvestmentQuote {
  if (
    !Number.isFinite(pricePerShareKes) ||
    pricePerShareKes <= 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(feeRate) ||
    feeRate < 0 ||
    feeRate > 1 ||
    !Number.isFinite(kesPerUsdc) ||
    kesPerUsdc <= 0
  ) {
    throw new Error("Invalid Solana investment quote inputs.");
  }

  const cents = (amount: number) => Math.round(amount * 100) / 100;
  const principalKes = cents(pricePerShareKes * quantity);
  const feeKes = cents(principalKes * feeRate);
  const totalKes = cents(principalKes + feeKes);
  const totalKesCents = BigInt(Math.round(totalKes * 100));
  const kesPerUsdcMicros = BigInt(Math.round(kesPerUsdc * 1_000_000));
  const usdcNumerator = totalKesCents * 10_000_000_000n;
  const amountUsdcRaw = (usdcNumerator + kesPerUsdcMicros - 1n) / kesPerUsdcMicros;
  if (amountUsdcRaw <= 0n) throw new Error("The USDC payment amount is too small.");

  const usdcWhole = amountUsdcRaw / 1_000_000n;
  const usdcFraction = (amountUsdcRaw % 1_000_000n).toString().padStart(6, "0");
  return {
    principalKes,
    feeKes,
    totalKes,
    amountUsdcRaw,
    amountUsdc: `${usdcWhole}.${usdcFraction}`,
  };
}

interface ParsedPaymentInstruction {
  program?: string;
  parsed?: unknown;
}

interface ParsedPaymentTransaction {
  meta?: { err?: unknown } | null;
  transaction?: {
    message?: {
      accountKeys?: Array<{
        pubkey?: { toBase58?: () => string } | string;
        signer?: boolean;
      }>;
      instructions?: unknown[];
    };
  };
}

function publicKeyString(value: { toBase58?: () => string } | string | undefined): string {
  if (typeof value === "string") return value;
  return typeof value?.toBase58 === "function" ? value.toBase58() : "";
}

function parsedMemo(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["memo", "info", "value"]) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  return "";
}

export function isExpectedSolanaUsdcPayment(
  transaction: ParsedPaymentTransaction,
  expected: {
    walletAddress: string;
    destinationAta: string;
    mintAddress: string;
    amountRaw: string;
    memo: string;
  },
): boolean {
  if (transaction.meta?.err !== null) return false;
  const message = transaction.transaction?.message;
  if (!message) return false;

  const signedByInvestor = (message.accountKeys ?? []).some(
    (account) =>
      account.signer === true &&
      publicKeyString(account.pubkey) === expected.walletAddress,
  );
  if (!signedByInvestor) return false;

  let matchedTransfer = false;
  let matchedMemo = false;
  for (const rawInstruction of message.instructions ?? []) {
    if (!rawInstruction || typeof rawInstruction !== "object") continue;
    const instruction = rawInstruction as ParsedPaymentInstruction;
    if (instruction.program === "spl-memo" && parsedMemo(instruction.parsed) === expected.memo) {
      matchedMemo = true;
    }

    if (instruction.program !== "spl-token" || !instruction.parsed || typeof instruction.parsed !== "object") {
      continue;
    }
    const parsed = instruction.parsed as {
      type?: unknown;
      info?: Record<string, unknown>;
    };
    const info = parsed.info;
    const tokenAmount = info?.tokenAmount as Record<string, unknown> | undefined;
    if (
      parsed.type === "transferChecked" &&
      info?.authority === expected.walletAddress &&
      info?.destination === expected.destinationAta &&
      info?.mint === expected.mintAddress &&
      tokenAmount?.amount === expected.amountRaw &&
      tokenAmount?.decimals === 6
    ) {
      matchedTransfer = true;
    }
  }

  return matchedTransfer && matchedMemo;
}
