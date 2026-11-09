import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
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
import {
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as verifySignature,
} from "node:crypto";
import { getCurrentUser } from "./auth";
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
  walletAddress: z.string().trim().min(32).max(44),
  sourceChain: z.enum(AURORA_SOURCE_CHAINS),
  challenge: z.string().min(40).max(2048),
  signature: z.string().min(80).max(200),
});

const ActionBody = z.object({
  account: z.string().trim().min(32).max(44),
});

const WalletChallengeBody = z.object({
  walletAddress: z.string().trim().min(32).max(44),
});

const IntentStatusBody = z.object({
  walletAddress: z.string().trim().min(32).max(44),
  depositAddress: z.string().trim().min(1).max(256),
  challenge: z.string().min(40).max(2048),
  signature: z.string().min(80).max(200),
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

router.get("/multichain/status", (_req, res) => {
  const config = devnetConfig();
  const auroraMissingSettings = [
    ...(!process.env["AURORA_INTENTS_API_KEY"] ? ["AURORA_INTENTS_API_KEY"] : []),
    ...(!process.env["SESSION_SECRET"] ? ["SESSION_SECRET"] : []),
  ];
  res.json({
    auroraReady: auroraMissingSettings.length === 0,
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

router.post("/intent/create", financialRateLimit, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to Investa Farm before creating a deposit address." });
    return;
  }

  const parsed = IntentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported source chain and provide a verified Solana wallet." });
    return;
  }

  const recipient = parsePublicKey(parsed.data.walletAddress);
  if (!recipient) {
    res.status(400).json({ error: "A valid Solana public address is required." });
    return;
  }
  const recipientAddress = recipient.toBase58();
  if (!verifyWalletChallenge(user.id, recipientAddress, parsed.data.challenge, parsed.data.signature)) {
    res.status(401).json({ error: "Wallet signature is invalid or expired. Verify the wallet and retry." });
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
        ? "Aurora rejected this API key for persistent deposit addresses. Check the key and its configured permissions."
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
      sourceChain: parsed.data.sourceChain,
      recipient: recipientAddress,
      message:
        "This is a persistent mainnet deposit address, not a quote. No funds have moved. Send only an Aurora-supported asset on the selected source chain. Aurora will deliver USDC to your verified Solana wallet.",
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
    res.status(400).json({ error: "A valid Solana wallet and Aurora deposit address are required." });
    return;
  }

  const wallet = parsePublicKey(parsed.data.walletAddress);
  if (!wallet) {
    res.status(400).json({ error: "A valid Solana wallet address is required." });
    return;
  }
  const walletAddress = wallet.toBase58();
  if (!verifyWalletChallenge(user.id, walletAddress, parsed.data.challenge, parsed.data.signature)) {
    res.status(401).json({ error: "Wallet signature is invalid or expired. Verify the wallet and retry." });
    return;
  }

  const apiKey = process.env["AURORA_INTENTS_API_KEY"];
  if (!apiKey) {
    res.status(503).json({ error: "Aurora deposit tracking is not configured on this server." });
    return;
  }

  try {
    const statusUrl = new URL(
      `https://intents-api.aurora.dev/api/transactions/${encodeURIComponent(apiKey)}`,
    );
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
        (row as Record<string, unknown>).depositAddress === parsed.data.depositAddress,
      )
      .sort((a, b) =>
        Number(b.createdAtTimestamp ?? 0) - Number(a.createdAtTimestamp ?? 0),
      );
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
