import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHmac } from "node:crypto";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  clusterApiUrl,
  type ParsedAccountData,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { z } from "zod";
import { getCurrentUser } from "./auth";
import { verifyPrivyWalletOwnership } from "./privy-wallet";
import { financialRateLimit } from "../lib/security";

const router: IRouter = Router();

const AURORA_SOURCE_CHAINS = [
  "eth",
  "bera",
  "base",
  "gnosis",
  "arb",
  "bsc",
  "avax",
  "op",
  "pol",
  "monad",
  "adi",
  "plasma",
  "scroll",
  "xlayer",
  "hood",
  "sui",
  "aptos",
  "xrp",
  "btc",
  "doge",
  "tron",
  "ton",
  "near",
  "sol",
  "zec",
  "ltc",
  "cardano",
  "stellar",
  "aleo",
  "bch",
  "dash",
  "starknet",
  "coca",
  "qtc",
  "evm",
] as const;

const IntentBody = z.object({
  userSolanaWallet: z.string().trim().min(32).max(44),
  sourceChain: z.enum(AURORA_SOURCE_CHAINS),
  sourceAsset: z.string().trim().min(1).max(40).default("USDC"),
  investmentAmount: z.number().int().min(10).max(500),
});

const ActionBody = z.object({
  account: z.string().trim().min(32).max(44),
});

function parsePublicKey(value: string | undefined): PublicKey | null {
  if (!value) return null;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function devnetConfig() {
  const usdcMint = parsePublicKey(process.env["SOLANA_DEVNET_USDC_MINT"]?.trim());
  const treasury = parsePublicKey(process.env["SOLANA_DEVNET_TREASURY_ADDRESS"]?.trim());
  const shareMint = parsePublicKey(process.env["SOLANA_FARM_SHARE_MINT"]?.trim());
  return {
    rpcUrl: process.env["SOLANA_DEVNET_RPC_URL"]?.trim() || clusterApiUrl("devnet"),
    usdcMint,
    treasury,
    shareMint,
    transferConfigured: Boolean(usdcMint && treasury),
  };
}

function connectionForDevnet() {
  return new Connection(
    process.env["SOLANA_DEVNET_RPC_URL"]?.trim() || clusterApiUrl("devnet"),
    "confirmed",
  );
}

function actionOrigin(req: Request): string | null {
  const configuredOrigin = process.env["PUBLIC_APP_URL"]?.trim();
  if (configuredOrigin) {
    try {
      const parsed = new URL(configuredOrigin);
      if (
        parsed.protocol === "https:" &&
        !parsed.username &&
        !parsed.password &&
        parsed.pathname === "/" &&
        !parsed.search &&
        !parsed.hash
      ) {
        return parsed.origin;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (process.env["NODE_ENV"] === "production") return "https://app.investafarm.com";

  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.get("host");
  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || req.protocol;

  if (!host || !/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) return null;
  if (protocol !== "http" && protocol !== "https") return null;
  return `${protocol}://${host}`;
}

function actionCors(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
  );
  next();
}

router.get("/multichain/status", (_req, res) => {
  const config = devnetConfig();
  res.json({
    auroraReady: Boolean(process.env["AURORA_INTENTS_API_KEY"] && process.env["PRIVY_APP_ID"] && process.env["PRIVY_APP_SECRET"]),
    solanaDevnet: {
      network: "devnet",
      transferConfigured: config.transferConfigured,
      cropShareMintConfigured: Boolean(config.shareMint),
      missingSettings: [
        ...(!config.usdcMint ? ["SOLANA_DEVNET_USDC_MINT"] : []),
        ...(!config.treasury ? ["SOLANA_DEVNET_TREASURY_ADDRESS"] : []),
        ...(!config.shareMint ? ["SOLANA_FARM_SHARE_MINT"] : []),
      ],
    },
  });
});

async function resolveAuroraSolanaUsdcAsset(apiKey: string): Promise<string> {
  const configuredAssetId = process.env["AURORA_SOLANA_USDC_ASSET_ID"]?.trim();
  if (configuredAssetId) return configuredAssetId;

  const response = await fetch(
    `https://intents-api.aurora.dev/api/tokens/${encodeURIComponent(apiKey)}`,
    { signal: AbortSignal.timeout(12_000) },
  );
  if (!response.ok) throw new Error("Aurora's supported-token list is unavailable.");

  const payload: unknown = await response.json().catch(() => null);
  let rows: unknown[] = [];
  if (Array.isArray(payload)) {
    rows = payload;
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.tokens)) rows = record.tokens;
    else if (Array.isArray(record.data)) rows = record.data;
    else if (record.data && typeof record.data === "object" && Array.isArray((record.data as Record<string, unknown>).tokens)) {
      rows = (record.data as Record<string, unknown>).tokens as unknown[];
    }
  }

  const candidates = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const token = row as Record<string, unknown>;
    const assetId = typeof token.assetId === "string" ? token.assetId : "";
    const symbol = typeof token.symbol === "string" ? token.symbol.toUpperCase() : "";
    const chain = String(token.blockchain ?? token.chain ?? token.network ?? "").toLowerCase();
    const isSolana = chain === "sol" || chain.includes("solana") || assetId.toLowerCase().includes("sol-");
    return symbol === "USDC" && isSolana && assetId ? [assetId] : [];
  });
  const unique = [...new Set(candidates)];
  if (unique.length !== 1) {
    throw new Error(
      unique.length === 0
        ? "Aurora does not currently list a Solana USDC destination for this key."
        : "Aurora lists multiple Solana USDC destinations; configure AURORA_SOLANA_USDC_ASSET_ID to select one.",
    );
  }
  return unique[0]!;
}

router.post("/intent/create", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to Investa Farm before creating a deposit address." });
    return;
  }

  const parsed = IntentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported source chain and an amount from $10 to $500." });
    return;
  }

  const recipient = parsePublicKey(parsed.data.userSolanaWallet);
  if (!recipient) {
    res.status(400).json({ error: "A valid Solana public address is required." });
    return;
  }
  const walletVerification = await verifyPrivyWalletOwnership(req, "solana", recipient.toBase58());
  if (!walletVerification.ok) {
    res.status(walletVerification.status).json({ error: walletVerification.error });
    return;
  }

  const apiKey = process.env["AURORA_INTENTS_API_KEY"];
  const sessionSecret = process.env["SESSION_SECRET"];
  if (!apiKey || !sessionSecret) {
    res.status(503).json({
      error: "Aurora Intents is not configured. No deposit address was created and no funds moved.",
    });
    return;
  }

  try {
    const destinationAsset = await resolveAuroraSolanaUsdcAsset(apiKey);
    const sender = createHmac("sha256", sessionSecret)
      .update(`aurora-persistent-deposit:${user.id}`)
      .digest("hex");
    const endpoint = `https://intents-api.aurora.dev/api/persistent-deposit-address/${encodeURIComponent(apiKey)}`;
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: recipient.toBase58(),
        sender,
        depositChain: parsed.data.sourceChain,
        destinationChain: "sol",
        destinationAsset,
        recipientType: "DESTINATION_CHAIN",
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const result: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const providerError = upstream.status === 403
        ? "Aurora has not approved this API key for persistent deposit addresses."
        : upstream.status === 429
          ? "Aurora is rate limiting address creation. Wait and try again."
          : "Aurora could not create a deposit address. No funds moved.";
      res.status(upstream.status === 403 ? 403 : 502).json({ error: providerError });
      return;
    }

    const response = result as { depositAddress?: unknown; memo?: unknown; alreadyExists?: unknown } | null;
    if (!response || typeof response.depositAddress !== "string") {
      res.status(502).json({ error: "Aurora returned an incomplete deposit-address response. No funds moved." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
      network: "solana-mainnet",
      destinationAsset,
      depositAddress: response.depositAddress,
      memo: typeof response.memo === "string" ? response.memo : null,
      alreadyExists: response.alreadyExists === true,
      targetAmountUsd: parsed.data.investmentAmount,
      sourceChain: parsed.data.sourceChain,
      sourceAssetHint: parsed.data.sourceAsset,
      amountIsNotQuoted: true,
      message:
        "This is a persistent mainnet deposit address, not a quote. The selected amount is only a target; fees and output are not locked. No funds have moved. Send only an asset supported by Aurora on the selected source chain.",
    });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Aurora ")
      ? error.message
      : "Aurora Intents is unavailable. No deposit address was created and no funds moved.";
    res.status(502).json({ error: message });
  }
});

function formatTokenAmount(rawAmount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = rawAmount / divisor;
  const remainder = rawAmount % divisor;
  if (remainder === 0n) return whole.toString();
  const fraction = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fraction}`;
}

async function readTokenBalance(connection: Connection, owner: PublicKey, mint: PublicKey) {
  const accounts = await connection.getParsedTokenAccountsByOwner(
    owner,
    { mint },
    "confirmed",
  );
  let rawAmount = 0n;
  let decimals = 0;
  for (const item of accounts.value) {
    const parsed = (item.account.data as ParsedAccountData).parsed as {
      info?: { tokenAmount?: { amount?: string; decimals?: number } };
    };
    const tokenAmount = parsed.info?.tokenAmount;
    if (!tokenAmount) continue;
    rawAmount += BigInt(tokenAmount.amount ?? "0");
    decimals = Number(tokenAmount.decimals ?? decimals);
  }
  return {
    mint: mint.toBase58(),
    rawAmount: rawAmount.toString(),
    decimals,
    amount: formatTokenAmount(rawAmount, decimals),
  };
}

router.get("/solana/devnet/status", (_req, res) => {
  const config = devnetConfig();
  res.json({
    network: "devnet",
    transferConfigured: config.transferConfigured,
    cropShareMintConfigured: Boolean(config.shareMint),
    missingSettings: [
      ...(!config.usdcMint ? ["SOLANA_DEVNET_USDC_MINT"] : []),
      ...(!config.treasury ? ["SOLANA_DEVNET_TREASURY_ADDRESS"] : []),
      ...(!config.shareMint ? ["SOLANA_FARM_SHARE_MINT"] : []),
    ],
    note: "Devnet test tokens have no real-world value. Devnet activity never credits KES or Polygon USDC balances.",
  });
});

router.get("/solana/devnet/balances", async (req, res): Promise<void> => {
  const ownerValue = typeof req.query.owner === "string" ? req.query.owner : "";
  const owner = parsePublicKey(ownerValue);
  if (!owner) {
    res.status(400).json({ error: "A valid Solana wallet address is required." });
    return;
  }

  const config = devnetConfig();
  try {
    const connection = connectionForDevnet();
    const [lamports, usdcBalance, cropShareBalance] = await Promise.all([
      connection.getBalance(owner, "confirmed"),
      config.usdcMint ? readTokenBalance(connection, owner, config.usdcMint) : Promise.resolve(null),
      config.shareMint ? readTokenBalance(connection, owner, config.shareMint) : Promise.resolve(null),
    ]);
    res.json({
      network: "devnet",
      owner: owner.toBase58(),
      nativeSol: (lamports / LAMPORTS_PER_SOL).toString(),
      usdcBalance,
      cropShareBalance,
      cropShareMintConfigured: Boolean(config.shareMint),
      note: "These are public on-chain Devnet balances only; they are not a real investment or KES wallet balance.",
    });
  } catch {
    res.status(502).json({ error: "Solana Devnet could not return balances. No balances were changed." });
  }
});

router.use("/actions/invest", actionCors);
router.options("/actions/invest", (_req, res) => res.sendStatus(204));

router.get("/actions/invest", (req, res): void => {
  const origin = actionOrigin(req);
  if (!origin) {
    res.status(400).json({ error: "A valid application host is required for this action." });
    return;
  }
  const configured = devnetConfig().transferConfigured;
  const actions = configured
    ? [10, 25, 50, 100, 250, 500].map((amount) => ({
        label: `Send $${amount} test USDC`,
        href: `${origin}/api/actions/invest?amount=${amount}`,
      }))
    : [];

  res.json({
    title: "Investa Farm Devnet Demo",
    icon: `${origin}/solana-action-icon.svg`,
    description:
      "Creates an unsigned Solana Devnet USDC transfer to a configured demo pool. It does not issue crop shares or credit a real investment.",
    label: configured ? "Devnet USDC demo" : "Devnet transfer not configured",
    links: { actions },
  });
});

router.post("/actions/invest", async (req, res): Promise<void> => {
  const config = devnetConfig();
  if (!config.transferConfigured || !config.usdcMint || !config.treasury) {
    res.status(503).json({
      error: "Devnet demo transfer is not configured. No transaction was created.",
    });
    return;
  }

  const amountValue = typeof req.query.amount === "string" ? req.query.amount : "";
  if (!/^(?:[1-9]\d{0,2})$/.test(amountValue)) {
    res.status(400).json({ error: "Choose a whole-dollar demo amount between $10 and $500." });
    return;
  }
  const amount = Number(amountValue);
  if (amount < 10 || amount > 500) {
    res.status(400).json({ error: "Choose a whole-dollar demo amount between $10 and $500." });
    return;
  }

  const parsedBody = ActionBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "A valid Solana account is required." });
    return;
  }
  const owner = parsePublicKey(parsedBody.data.account);
  if (!owner) {
    res.status(400).json({ error: "A valid Solana account is required." });
    return;
  }
  if (owner.equals(config.treasury)) {
    res.status(400).json({ error: "The demo pool cannot be the sending wallet." });
    return;
  }

  try {
    const connection = connectionForDevnet();
    const mintInfo = await getMint(connection, config.usdcMint, "confirmed", TOKEN_PROGRAM_ID);
    if (mintInfo.decimals !== 6) {
      res.status(409).json({ error: "The configured Devnet USDC mint must use six decimals. No transaction was created." });
      return;
    }

    const sourceAta = getAssociatedTokenAddressSync(
      config.usdcMint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const destinationAta = getAssociatedTokenAddressSync(
      config.usdcMint,
      config.treasury,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const requiredAmount = BigInt(amount) * 1_000_000n;

    let currentBalance: bigint;
    try {
      const result = await connection.getTokenAccountBalance(sourceAta, "confirmed");
      currentBalance = BigInt(result.value.amount);
    } catch {
      res.status(422).json({ error: "No Devnet USDC token account was found for this wallet. No transaction was created." });
      return;
    }
    if (currentBalance < requiredAmount) {
      res.status(422).json({ error: "The wallet does not have enough Devnet USDC for this demo transfer. No transaction was created." });
      return;
    }

    const latest = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction();
    transaction.feePayer = owner;
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        owner,
        destinationAta,
        config.treasury,
        config.usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createTransferCheckedInstruction(
        sourceAta,
        config.usdcMint,
        destinationAta,
        owner,
        requiredAmount,
        mintInfo.decimals,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    res.json({
      transaction: serialized.toString("base64"),
      message: `Devnet-only transfer of ${amount} test USDC. This does not mint crop shares or credit KES/Polygon USDC.`,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch {
    res.status(502).json({ error: "Solana Devnet could not build the transaction. No funds moved." });
  }
});

export default router;
