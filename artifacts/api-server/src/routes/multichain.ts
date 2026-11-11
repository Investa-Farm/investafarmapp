import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
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
import { and, desc, eq, gt } from "drizzle-orm";
import {
  db,
  farmsTable,
  kycDocumentsTable,
  marketListingsTable,
  privySolanaWalletsTable,
  privyStellarWalletsTable,
  solanaInvestmentIntentsTable,
  usersTable,
} from "@workspace/db";
import {
  createHmac,
  createPublicKey,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  verify as verifySignature,
} from "node:crypto";
import { getCurrentUser } from "./auth";
import { financialRateLimit } from "../lib/security";
import { getLiveKesUsdcRate } from "../lib/circle";
import { calculateSolanaInvestmentQuote } from "../lib/solana-investment";
import {
  confirmSolanaInvestmentPayment,
  createSolanaMainnetConnection,
  getSolanaMainnetConfig,
  solanaTreasuryUsdcAta,
} from "../lib/solana-investment-settlement";

const router: IRouter = Router();
const cachedAuroraUsdcAssets = new Map<string, { assetId: string; expiresAt: number }>();
const USDC_DECIMALS = 6;

const AURORA_SOURCE_CHAINS = [
  "eth",
  "bera",
  "base",
  "gnosis",
  "arb",
  "bsc",
  "avax",
  "op",
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
  sourceChain: z.enum(AURORA_SOURCE_CHAINS),
  destinationChain: z.enum(["sol", "stellar"]),
});

const ActionBody = z.object({
  account: z.string().trim().min(32).max(44),
});

const ActionConfirmationBody = z.object({
  account: z.string().trim().min(32).max(44),
  signature: z.string().trim().min(80).max(90),
});

const WalletChallengeBody = z.object({
  walletAddress: z.string().trim().min(32).max(44),
});

const IntentStatusBody = z.object({
  sourceChain: z.enum(AURORA_SOURCE_CHAINS),
  destinationChain: z.enum(["sol", "stellar"]),
});

function parsePublicKey(value: string | undefined): PublicKey | null {
  if (!value) return null;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function walletChallengeMessage(userId: number, walletAddress: string, expiresAt: number, nonce: string): string {
  return [
    "Investa Farm · Solana wallet verification",
    `Investa user: ${userId}`,
    `Solana address: ${walletAddress}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    `Nonce: ${nonce}`,
    "Sign this message to verify wallet ownership. No transaction will be sent.",
  ].join("\n");
}

function issueWalletChallenge(userId: number, walletAddress: string) {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET is not configured.");

  const expiresAt = Date.now() + 5 * 60_000;
  const nonce = randomBytes(18).toString("hex");
  const payload = Buffer.from(JSON.stringify({
    userId,
    walletAddress,
    expiresAt,
    nonce,
  })).toString("base64url");
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");

  return {
    challenge: `${payload}.${mac}`,
    message: walletChallengeMessage(userId, walletAddress, expiresAt, nonce),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function verifyWalletChallenge(
  userId: number,
  walletAddress: string,
  challenge: string,
  signatureBase64: string,
): boolean {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) return false;

  try {
    const [payload, providedMac, extra] = challenge.split(".");
    if (!payload || !providedMac || extra) return false;

    const expectedMac = createHmac("sha256", secret).update(payload).digest();
    const suppliedMac = Buffer.from(providedMac, "base64url");
    if (suppliedMac.length !== expectedMac.length || !timingSafeEqual(suppliedMac, expectedMac)) return false;

    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
      walletAddress?: unknown;
      expiresAt?: unknown;
      nonce?: unknown;
    };
    const expiresAt = Number(body.expiresAt);
    if (
      body.userId !== userId ||
      body.walletAddress !== walletAddress ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      expiresAt > Date.now() + 5 * 60_000 + 5_000 ||
      typeof body.nonce !== "string"
    ) return false;

    const signature = Buffer.from(signatureBase64, "base64");
    if (signature.length !== 64) return false;
    const message = walletChallengeMessage(userId, walletAddress, expiresAt, body.nonce);
    const publicKeyDerPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const publicKey = createPublicKey({
      key: Buffer.concat([publicKeyDerPrefix, new PublicKey(walletAddress).toBuffer()]),
      format: "der",
      type: "spki",
    });
    return verifySignature(null, Buffer.from(message, "utf8"), publicKey, signature);
  } catch {
    return false;
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

router.get("/multichain/status", async (_req, res): Promise<void> => {
  const config = devnetConfig();
  const auroraMissingSettings = [
    ...(!process.env["AURORA_INTENTS_API_KEY"] ? ["AURORA_INTENTS_API_KEY"] : []),
    ...(!process.env["SESSION_SECRET"] ? ["SESSION_SECRET"] : []),
  ];
  let auroraProviderReady = false;
  let auroraStatusMessage = "Aurora Intents is not configured on this server.";
  if (auroraMissingSettings.length === 0) {
    try {
      await resolveAuroraUsdcAsset(process.env["AURORA_INTENTS_API_KEY"]!, "sol");
      auroraProviderReady = true;
      auroraStatusMessage = "Aurora is reachable and a Solana USDC destination is available.";
    } catch (error) {
      auroraStatusMessage = error instanceof Error
        ? error.message
        : "Aurora could not verify a Solana USDC destination.";
    }
  }
  res.json({
    auroraReady: auroraMissingSettings.length === 0 && auroraProviderReady,
    auroraProviderReady,
    auroraStatusMessage,
    auroraMissingSettings,
    solanaDevnet: {
      network: "devnet",
      transferConfigured: config.transferConfigured,
      cropShareMintConfigured: Boolean(config.shareMint),
      missingSettings: [
        ...(!config.usdcMint ? ["SOLANA_DEVNET_USDC_MINT"] : []),
        ...(!config.treasury ? ["SOLANA_DEVNET_TREASURY_ADDRESS"] : []),
      ],
      optionalMissingSettings: [
        ...(!config.shareMint ? ["SOLANA_FARM_SHARE_MINT"] : []),
      ],
    },
  });
});

async function resolveAuroraUsdcAsset(apiKey: string, destinationChain: "sol" | "stellar"): Promise<string> {
  const settingName = destinationChain === "sol"
    ? "AURORA_SOLANA_USDC_ASSET_ID"
    : "AURORA_STELLAR_USDC_ASSET_ID";
  const configuredAssetId = process.env[settingName]?.trim();
  if (configuredAssetId) return configuredAssetId;
  const cachedAsset = cachedAuroraUsdcAssets.get(destinationChain);
  if (cachedAsset && cachedAsset.expiresAt > Date.now()) {
    return cachedAsset.assetId;
  }

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
    const normalizedAsset = assetId.toLowerCase();
    const matchesChain = destinationChain === "sol"
      ? chain === "sol" || chain.includes("solana") || normalizedAsset.includes("sol-")
      : chain.includes("stellar") || chain === "xlm" || normalizedAsset.includes("stellar");
    return symbol === "USDC" && matchesChain && assetId ? [assetId] : [];
  });
  const unique = [...new Set(candidates)];
  if (unique.length !== 1) {
    throw new Error(
      unique.length === 0
        ? `Aurora does not currently list a ${destinationChain === "sol" ? "Solana" : "Stellar"} USDC destination for this key.`
        : `Aurora lists multiple ${destinationChain === "sol" ? "Solana" : "Stellar"} USDC destinations; configure ${settingName} to select one.`,
    );
  }
  cachedAuroraUsdcAssets.set(destinationChain, {
    assetId: unique[0]!,
    expiresAt: Date.now() + 60_000,
  });
  return unique[0]!;
}

router.post("/intent/challenge", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to Investa Farm before verifying a Solana wallet." });
    return;
  }
  const parsed = WalletChallengeBody.safeParse(req.body);
  if (!parsed.success || !parsePublicKey(parsed.data?.walletAddress)) {
    res.status(400).json({ error: "A valid Solana public address is required." });
    return;
  }
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(issueWalletChallenge(user.id, new PublicKey(parsed.data.walletAddress).toBase58()));
  } catch {
    res.status(503).json({ error: "Solana wallet verification is unavailable on this server." });
  }
});

router.post("/intent/verify-wallet", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to Investa Farm before verifying a Solana wallet." });
    return;
  }
  const parsed = WalletChallengeBody.extend({
    challenge: z.string().min(40).max(2048),
    signature: z.string().min(80).max(200),
  }).safeParse(req.body);
  const publicKey = parsed.success ? parsePublicKey(parsed.data.walletAddress) : null;
  if (!parsed.success || !publicKey) {
    res.status(400).json({ error: "A valid wallet and signed verification message are required." });
    return;
  }
  const walletAddress = publicKey.toBase58();
  if (!verifyWalletChallenge(user.id, walletAddress, parsed.data.challenge, parsed.data.signature)) {
    res.status(401).json({ error: "Wallet signature is invalid or expired. Request a new verification message." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({ wallet: { address: walletAddress, chain: "solana", verified: true } });
});

async function linkedPrivyAddress(userId: number, destinationChain: "sol" | "stellar"): Promise<string | null> {
  if (destinationChain === "sol") {
    const [wallet] = await db
      .select({ address: privySolanaWalletsTable.address })
      .from(privySolanaWalletsTable)
      .where(eq(privySolanaWalletsTable.userId, userId))
      .limit(1);
    return wallet?.address ?? null;
  }
  const [wallet] = await db
    .select({ address: privyStellarWalletsTable.address })
    .from(privyStellarWalletsTable)
    .where(eq(privyStellarWalletsTable.userId, userId))
    .limit(1);
  return wallet?.address ?? null;
}

async function createPersistentAuroraAddress(args: {
  apiKey: string;
  sessionSecret: string;
  userId: number;
  recipient: string;
  sourceChain: (typeof AURORA_SOURCE_CHAINS)[number];
  destinationChain: "sol" | "stellar";
}) {
  const destinationAsset = await resolveAuroraUsdcAsset(args.apiKey, args.destinationChain);
  const sender = createHmac("sha256", args.sessionSecret)
    .update(`aurora-persistent-deposit:${args.userId}:${args.sourceChain}:${args.destinationChain}`)
    .digest("hex");
  const endpoint = `https://intents-api.aurora.dev/api/persistent-deposit-address/${encodeURIComponent(args.apiKey)}`;
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: args.recipient,
      sender,
      depositChain: args.sourceChain,
      destinationChain: args.destinationChain,
      destinationAsset,
      recipientType: "DESTINATION_CHAIN",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const result: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    throw new Error(
      upstream.status === 403
        ? "Aurora rejected this API key for persistent deposit addresses. Check the key and its permissions."
        : upstream.status === 429
          ? "Aurora is rate limiting address creation. Wait and try again."
          : "Aurora could not create a deposit address. No funds moved.",
    );
  }
  const response = result as { depositAddress?: unknown; memo?: unknown; alreadyExists?: unknown } | null;
  if (!response || typeof response.depositAddress !== "string") {
    throw new Error("Aurora returned an incomplete deposit-address response. No funds moved.");
  }
  return {
    destinationAsset,
    depositAddress: response.depositAddress,
    memo: typeof response.memo === "string" ? response.memo : null,
    alreadyExists: response.alreadyExists === true,
  };
}

router.post("/intent/create", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to Investa Farm before creating a deposit address." });
    return;
  }

  const parsed = IntentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported source chain and Privy destination wallet." });
    return;
  }
  const recipient = await linkedPrivyAddress(user.id, parsed.data.destinationChain);
  if (!recipient) {
    res.status(409).json({
      error: `Set up your Privy ${parsed.data.destinationChain === "sol" ? "Solana" : "Stellar"} wallet first. No address was created and no funds moved.`,
      code: "PRIVY_WALLET_REQUIRED",
    });
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
    const deposit = await createPersistentAuroraAddress({
      apiKey,
      sessionSecret,
      userId: user.id,
      recipient,
      sourceChain: parsed.data.sourceChain,
      destinationChain: parsed.data.destinationChain,
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({
      destinationChain: parsed.data.destinationChain,
      destinationAsset: deposit.destinationAsset,
      depositAddress: deposit.depositAddress,
      memo: deposit.memo,
      alreadyExists: deposit.alreadyExists,
      sourceChain: parsed.data.sourceChain,
      message: `Persistent Aurora deposit address for your linked Privy ${parsed.data.destinationChain === "sol" ? "Solana" : "Stellar"} wallet. No funds have moved. Send only an Aurora-supported asset on the selected source network. This deposit does not credit your KES wallet or purchase farm shares.`,
    });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Aurora ")
      ? error.message
      : "Aurora Intents is unavailable. No deposit address was created and no funds moved.";
    res.status(502).json({ error: message });
  }
});

router.post("/intent/status", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to Investa Farm to check this deposit." });
    return;
  }
  const parsed = IntentStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose the source network and Privy destination used for this deposit." });
    return;
  }

  const walletAddress = await linkedPrivyAddress(user.id, parsed.data.destinationChain);
  if (!walletAddress) {
    res.status(409).json({ error: "The selected Privy destination wallet is not linked to this account." });
    return;
  }
  const apiKey = process.env["AURORA_INTENTS_API_KEY"];
  const sessionSecret = process.env["SESSION_SECRET"];
  if (!apiKey || !sessionSecret) {
    res.status(503).json({ error: "Aurora deposit tracking is not configured on this server." });
    return;
  }

  try {
    const deposit = await createPersistentAuroraAddress({
      apiKey,
      sessionSecret,
      userId: user.id,
      recipient: walletAddress,
      sourceChain: parsed.data.sourceChain,
      destinationChain: parsed.data.destinationChain,
    });
    const statusUrl = new URL(`https://intents-api.aurora.dev/api/transactions/${encodeURIComponent(apiKey)}`);
    statusUrl.searchParams.set("walletAddress", walletAddress);
    statusUrl.searchParams.set("numberOfTransactions", "100");

    const upstream = await fetch(statusUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    const payload: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      res.status(upstream.status === 429 ? 429 : 502).json({
        error: upstream.status === 429
          ? "Aurora is rate limiting status checks. Wait a moment and retry."
          : "Aurora could not return deposit status right now.",
      });
      return;
    }

    const rows: unknown[] = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: unknown[] }).data
        : [];
    const matching = rows
      .filter((row): row is Record<string, unknown> =>
        !!row &&
        typeof row === "object" &&
        (row as Record<string, unknown>).depositAddress === deposit.depositAddress,
      )
      .sort((a, b) => Number(b.createdAtTimestamp ?? 0) - Number(a.createdAtTimestamp ?? 0));
    const transaction = matching[0];

    res.setHeader("Cache-Control", "no-store");
    if (!transaction) {
      res.json({
        found: false,
        status: "PENDING_DEPOSIT",
        message: "Aurora has not detected a deposit at this address yet.",
      });
      return;
    }

    const stringArray = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string").slice(0, 10)
        : [];
    res.json({
      found: true,
      status: typeof transaction.status === "string" ? transaction.status : "UNKNOWN",
      amountIn: typeof transaction.amountInFormatted === "string" ? transaction.amountInFormatted : null,
      amountOut: typeof transaction.amountOutFormatted === "string" ? transaction.amountOutFormatted : null,
      createdAt: typeof transaction.createdAt === "string" ? transaction.createdAt : null,
      originChainTxHashes: stringArray(transaction.originChainTxHashes),
      destinationChainTxHashes: stringArray(transaction.destinationChainTxHashes),
      refundReason: typeof transaction.refundReason === "string" ? transaction.refundReason : null,
    });
  } catch {
    res.status(502).json({ error: "Aurora deposit status is temporarily unavailable." });
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
    ],
    optionalMissingSettings: [
      ...(!config.shareMint ? ["SOLANA_FARM_SHARE_MINT"] : []),
    ],
    note: "Devnet test tokens have no real-world value. Devnet activity never credits KES or stablecoin balances.",
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
router.options("/actions/invest/:projectId", (_req, res) => res.sendStatus(204));
router.options("/actions/invest/:projectId/confirm", (_req, res) => res.sendStatus(204));

async function listedFarmActionData(projectId: string) {
  const farmId = Number(projectId);
  if (!Number.isSafeInteger(farmId) || farmId <= 0) return null;
  const [farm] = await db
    .select()
    .from(farmsTable)
    .where(eq(farmsTable.id, farmId))
    .limit(1);
  if (!farm) return null;

  const [listing] = await db
    .select()
    .from(marketListingsTable)
    .where(and(
      eq(marketListingsTable.farmId, farmId),
      eq(marketListingsTable.isActive, 1),
      gt(marketListingsTable.sharesAvailable, 0),
    ))
    .orderBy(desc(marketListingsTable.createdAt))
    .limit(1);
  return listing ? { farm, listing } : null;
}

router.get("/actions/invest/:projectId", async (req, res): Promise<void> => {
  const origin = actionOrigin(req);
  if (!origin) {
    res.status(400).json({ error: "A valid application host is required for this action." });
    return;
  }
  try {
    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0] ?? ""
      : req.params.projectId ?? "";
    const data = await listedFarmActionData(projectId);
    if (!data) {
      res.status(404).json({ error: "This farm does not have an active market listing." });
      return;
    }
    const { farm, listing } = data;
    const icon = farm.imageUrl && /^https?:\/\//i.test(farm.imageUrl)
      ? farm.imageUrl
      : `${origin}/solana-action-icon.svg`;
    const appListingUrl = `${origin}/market/${farm.id}`;
    const config = getSolanaMainnetConfig();
    if (!config.configured) {
      const disabledMessage = "Solana USDC settlement is not configured. No payment can be made from this Blink.";
      res.setHeader("Cache-Control", "no-store");
      res.json({
        type: "action",
        icon,
        title: farm.name,
        description: `View the investable farm listing at ${appListingUrl}.`,
        label: "Solana investment unavailable",
        disabled: true,
        error: { message: disabledMessage },
      });
      return;
    }

    let kesPerUsdc: number;
    try {
      kesPerUsdc = await getLiveKesUsdcRate();
    } catch {
      const disabledMessage = "A current KES/USDC quote is unavailable. No payment can be made from this Blink.";
      res.setHeader("Cache-Control", "no-store");
      res.json({
        type: "action",
        icon,
        title: farm.name,
        description: `View the investable farm listing at ${appListingUrl}.`,
        label: "USDC quote unavailable",
        disabled: true,
        error: { message: disabledMessage },
      });
      return;
    }

    const requestedQuantity = typeof req.query.quantity === "string"
      ? Number(req.query.quantity)
      : null;
    const suggestedQuantities = requestedQuantity !== null
      ? [requestedQuantity]
      : [1, 5, 10].filter((quantity) => quantity <= listing.sharesAvailable);
    const actions = suggestedQuantities
      .filter((quantity) =>
        Number.isSafeInteger(quantity) &&
        quantity > 0 &&
        quantity <= listing.sharesAvailable,
      )
      .map((quantity) => {
        const feeRate = listing.listingType === "primary" ? 0.015 : 0.005;
        const quote = calculateSolanaInvestmentQuote(
          Number(listing.pricePerShare),
          quantity,
          feeRate,
          kesPerUsdc,
        );
        return {
          label: `Buy ${quantity} share${quantity === 1 ? "" : "s"}`,
          href: `${origin}/api/actions/invest/${farm.id}?quantity=${quantity}`,
          parameters: [],
          description: `${quote.amountUsdc} USDC including the platform fee`,
        };
      });

    if (actions.length === 0) {
      res.status(409).json({ error: { message: "No available share quantity can be purchased from this listing." } });
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=30");
    res.json({
      type: "action",
      icon,
      title: farm.name,
      description:
        `${farm.cropType} · ${farm.location} · ${listing.sharesAvailable.toLocaleString()} shares at KES ${Number(listing.pricePerShare).toLocaleString()} each. Solana USDC purchases use a live KES quote and do not use the KES wallet. Approved KYC and an Investa-linked Solana wallet are required. View listing: ${appListingUrl}.`,
      label: "Invest with Solana USDC",
      links: { actions },
    });
  } catch {
    res.status(500).json({ error: "Could not load the farm listing for this Solana Blink." });
  }
});

router.post("/actions/invest/:projectId", financialRateLimit, async (req, res): Promise<void> => {
  try {
    const origin = actionOrigin(req);
    if (!origin) {
      res.status(400).json({ error: { message: "A valid application host is required for this action." } });
      return;
    }

    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0] ?? ""
      : req.params.projectId ?? "";
    const data = await listedFarmActionData(projectId);
    if (!data) {
      res.status(404).json({ error: "This farm does not have an active market listing." });
      return;
    }
    const config = getSolanaMainnetConfig();
    if (!config.treasury) {
      res.status(503).json({ error: { message: "Solana USDC settlement is not configured. No transaction was created." } });
      return;
    }

    const parsedBody = ActionBody.safeParse(req.body);
    const owner = parsedBody.success ? parsePublicKey(parsedBody.data.account) : null;
    if (!owner) {
      res.status(400).json({ error: { message: "A valid Solana account is required." } });
      return;
    }

    const [linkedWallet] = await db
      .select({
        userId: privySolanaWalletsTable.userId,
        role: usersTable.role,
      })
      .from(privySolanaWalletsTable)
      .innerJoin(usersTable, eq(usersTable.id, privySolanaWalletsTable.userId))
      .where(eq(privySolanaWalletsTable.address, owner.toBase58()))
      .limit(1);
    if (!linkedWallet || linkedWallet.role !== "investor") {
      res.status(403).json({
        error: {
          message: "Link this Solana wallet to an Investa investor account before using Blink investments.",
        },
      });
      return;
    }

    const approvedDocs = await db
      .select({ docType: kycDocumentsTable.docType })
      .from(kycDocumentsTable)
      .where(and(
        eq(kycDocumentsTable.userId, linkedWallet.userId),
        eq(kycDocumentsTable.status, "approved"),
      ));
    const approvedTypes = new Set(approvedDocs.map((doc) => doc.docType));
    const investorRequiredDocs = ["national_id", "national_id_back", "selfie", "financial_statement"];
    if (!investorRequiredDocs.every((type) => approvedTypes.has(type as typeof approvedDocs[number]["docType"]))) {
      res.status(403).json({
        error: { message: "Complete and receive approval for investor KYC before investing through Solana." },
      });
      return;
    }

    const quantityValue = typeof req.query.quantity === "string" ? req.query.quantity : "";
    if (!/^[1-9]\d{0,3}$/.test(quantityValue)) {
      res.status(400).json({ error: { message: "Choose a valid share quantity from the Blink." } });
      return;
    }
    const quantity = Number(quantityValue);
    const { farm, listing } = data;
    if (quantity > listing.sharesAvailable) {
      res.status(409).json({ error: { message: "There are not enough shares left in this listing." } });
      return;
    }

    const kesPerUsdc = await getLiveKesUsdcRate();
    const feeRate = listing.listingType === "primary" ? 0.015 : 0.005;
    const quote = calculateSolanaInvestmentQuote(
      Number(listing.pricePerShare),
      quantity,
      feeRate,
      kesPerUsdc,
    );
    const connection = createSolanaMainnetConnection();
    const mint = config.mint;
    const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
    if (mintInfo.decimals !== 6) {
      res.status(503).json({ error: { message: "The configured mainnet USDC mint failed verification. No transaction was created." } });
      return;
    }

    const sourceAta = getAssociatedTokenAddressSync(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const destinationAta = solanaTreasuryUsdcAta(config.treasury, mint);
    let sourceBalance: bigint;
    try {
      const balance = await connection.getTokenAccountBalance(sourceAta, "confirmed");
      sourceBalance = BigInt(balance.value.amount);
    } catch {
      res.status(422).json({
        error: { message: "No mainnet USDC account was found for this wallet. Fund it with Solana USDC first; no transaction was created." },
      });
      return;
    }
    if (sourceBalance < quote.amountUsdcRaw) {
      res.status(422).json({
        error: { message: `This wallet needs ${quote.amountUsdc} USDC for this purchase. No transaction was created.` },
      });
      return;
    }

    const destinationExists = Boolean(await connection.getAccountInfo(destinationAta, "confirmed"));
    const solBalance = await connection.getBalance(owner, "confirmed");
    const requiredSol = destinationExists
      ? 10_000
      : await connection.getMinimumBalanceForRentExemption(165, "confirmed") + 10_000;
    if (solBalance < requiredSol) {
      res.status(422).json({
        error: { message: "This wallet needs a small SOL balance for network fees and the USDC token account. No transaction was created." },
      });
      return;
    }

    const intentId = randomUUID();
    const memo = `IFARM:${intentId}`;
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
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createTransferCheckedInstruction(
        sourceAta,
        mint,
        destinationAta,
        owner,
        quote.amountUsdcRaw,
        USDC_DECIMALS,
        [],
        TOKEN_PROGRAM_ID,
      ),
      new TransactionInstruction({
        programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
        data: Buffer.from(memo, "utf8"),
      }),
    );
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const reserved = await db.transaction(async (tx) => {
      const [currentListing] = await tx
        .select()
        .from(marketListingsTable)
        .where(eq(marketListingsTable.id, listing.id))
        .for("update")
        .limit(1);
      if (
        !currentListing ||
        currentListing.isActive !== 1 ||
        currentListing.sharesAvailable < quantity ||
        Number(currentListing.pricePerShare) !== Number(listing.pricePerShare) ||
        currentListing.listingType !== listing.listingType
      ) return false;

      const [currentFarm] = await tx
        .select()
        .from(farmsTable)
        .where(eq(farmsTable.id, farm.id))
        .for("update")
        .limit(1);
      if (
        currentListing.listingType === "primary" &&
        (!currentFarm || currentFarm.sharesAvailable < quantity)
      ) return false;

      await tx.update(marketListingsTable)
        .set({ sharesAvailable: currentListing.sharesAvailable - quantity })
        .where(eq(marketListingsTable.id, currentListing.id));
      if (currentListing.listingType === "primary" && currentFarm) {
        await tx.update(farmsTable)
          .set({ sharesAvailable: currentFarm.sharesAvailable - quantity })
          .where(eq(farmsTable.id, currentFarm.id));
      }

      await tx.insert(solanaInvestmentIntentsTable).values({
        id: intentId,
        investorId: linkedWallet.userId,
        farmId: farm.id,
        listingId: currentListing.id,
        walletAddress: owner.toBase58(),
        memo,
        quantity,
        exitType: "full_season",
        pricePerShareKes: String(currentListing.pricePerShare),
        principalKes: String(quote.principalKes),
        feeKes: String(quote.feeKes),
        totalKes: String(quote.totalKes),
        kesPerUsdc: String(kesPerUsdc),
        amountUsdc: quote.amountUsdc,
        amountUsdcRaw: quote.amountUsdcRaw.toString(),
        status: "pending",
        expiresAt: new Date(Date.now() + 10 * 60_000),
      });
      return true;
    });
    if (!reserved) {
      res.status(409).json({ error: { message: "The farm listing changed or sold out. Refresh it before trying again." } });
      return;
    }

    const appListingUrl = `${origin}/market/${farm.id}`;
    res.json({
      transaction: serialized.toString("base64"),
      message: `Buy ${quantity} ${farm.cropType} share${quantity === 1 ? "" : "s"} for ${quote.amountUsdc} USDC. Share value: KES ${quote.principalKes.toLocaleString("en-KE")}; fee: KES ${quote.feeKes.toLocaleString("en-KE")}; rate: 1 USDC = KES ${kesPerUsdc.toFixed(2)}. Your KES wallet is not used. Shares are credited only after on-chain verification.`,
      lastValidBlockHeight: latest.lastValidBlockHeight,
      links: {
        next: {
          type: "post",
          href: `${origin}/api/actions/invest/${farm.id}/confirm?intentId=${encodeURIComponent(intentId)}`,
        },
      },
      website: appListingUrl,
    });
  } catch (error) {
    console.error("[solana-investment] Could not create Blink transaction:", error instanceof Error ? error.message : "unknown error");
    res.status(502).json({
      error: { message: "Could not prepare a verified Solana USDC purchase. No payment transaction was returned." },
    });
  }
});

router.post("/actions/invest/:projectId/confirm", financialRateLimit, async (req, res): Promise<void> => {
  const origin = actionOrigin(req);
  if (!origin) {
    res.status(400).json({ error: { message: "A valid application host is required for this action." } });
    return;
  }
  const intentId = typeof req.query.intentId === "string" ? req.query.intentId : "";
  if (!z.string().uuid().safeParse(intentId).success) {
    res.status(400).json({ error: { message: "The investment confirmation reference is invalid." } });
    return;
  }
  const parsed = ActionConfirmationBody.safeParse(req.body);
  const account = parsed.success ? parsePublicKey(parsed.data.account) : null;
  if (!parsed.success || !account) {
    res.status(400).json({ error: { message: "A valid Solana account and transaction signature are required." } });
    return;
  }

  try {
    const result = await confirmSolanaInvestmentPayment(
      intentId,
      parsed.data.signature,
      account.toBase58(),
    );
    if (result.status === "settled" || result.status === "pending") {
      res.setHeader("Cache-Control", "no-store");
      res.json({
        type: "completed",
        title: result.status === "settled" ? "Investment confirmed" : "Payment is being verified",
        icon: `${origin}/solana-action-icon.svg`,
        description: result.message,
        label: result.status === "settled" ? "View your portfolio" : "Do not send again",
        website: `${origin}/portfolio`,
      });
      return;
    }
    const statusCode = result.status === "not_found" ? 404 : result.status === "expired" ? 410 : 400;
    res.status(statusCode).json({ error: { message: result.message } });
  } catch (error) {
    console.error("[solana-investment] Confirmation callback failed:", error instanceof Error ? error.message : "unknown error");
    res.status(503).json({
      error: { message: "Payment verification is temporarily unavailable. Do not resend; try the confirmation again." },
    });
  }
});

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
      message: `Devnet-only transfer of ${amount} test USDC. This does not mint crop shares or credit KES or stablecoin balances.`,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch {
    res.status(502).json({ error: "Solana Devnet could not build the transaction. No funds moved." });
  }
});

export default router;
