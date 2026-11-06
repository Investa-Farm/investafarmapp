import { Router, type IRouter, type Request } from "express";
import { PrivyClient } from "@privy-io/node";
import { db, privyStellarWalletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";
import { PublicKey } from "@solana/web3.js";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();
const LinkWalletBody = z.object({
  address: z.string().min(1).max(128),
});

type PrivyWalletAccount = {
  type?: string;
  chain_type?: string;
  chainType?: string;
  address?: string;
};

let cachedPrivyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient | null {
  const appId = process.env["PRIVY_APP_ID"];
  const appSecret = process.env["PRIVY_APP_SECRET"];
  if (!appId || !appSecret) return null;
  if (!cachedPrivyClient) {
    cachedPrivyClient = new PrivyClient({ appId, appSecret });
  }
  return cachedPrivyClient;
}

function bearerToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.startsWith("Bearer ") ? value.slice(7).trim() || null : null;
}

type PrivyWalletVerification =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function verifyPrivyWalletOwnership(
  req: Request,
  chainType: "solana" | "stellar",
  address: string,
): Promise<PrivyWalletVerification> {
  const client = getPrivyClient();
  if (!client) {
    return { ok: false, status: 503, error: "Privy wallet verification is not configured on this server." };
  }

  const privyAccessToken = bearerToken(req.headers["x-privy-access-token"]);
  if (!privyAccessToken) {
    return { ok: false, status: 401, error: "Complete the Privy sign-in to verify wallet ownership." };
  }

  let verifiedUserId: string;
  try {
    const claims = await client.utils().auth().verifyAccessToken(privyAccessToken);
    verifiedUserId = claims.user_id;
  } catch {
    return { ok: false, status: 401, error: "The Privy session could not be verified. Sign in to Privy again." };
  }

  try {
    const privyUser = await client.users()._get(verifiedUserId);
    const linkedAccounts = (privyUser.linked_accounts ?? []) as PrivyWalletAccount[];
    const ownsAddress = linkedAccounts.some(
      (account) =>
        account.type === "wallet" &&
        (account.chain_type ?? account.chainType) === chainType &&
        account.address === address,
    );
    return ownsAddress
      ? { ok: true }
      : { ok: false, status: 403, error: `That ${chainType} address is not linked to the authenticated Privy account.` };
  } catch {
    return { ok: false, status: 502, error: "Privy could not confirm this wallet right now. Please try again." };
  }
}

router.post("/users/verify-solana-wallet", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to Investa Farm before linking a wallet." });
    return;
  }

  const parsed = LinkWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid Solana public address is required." });
    return;
  }

  try {
    new PublicKey(parsed.data.address);
  } catch {
    res.status(400).json({ error: "A valid Solana public address is required." });
    return;
  }

  const verification = await verifyPrivyWalletOwnership(req, "solana", parsed.data.address);
  if (!verification.ok) {
    res.status(verification.status).json({ error: verification.error });
    return;
  }

  res.json({ wallet: { address: parsed.data.address, chain: "solana" } });
});

router.get("/users/linked-stellar-wallet", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [wallet] = await db
    .select({
      address: privyStellarWalletsTable.address,
      linkedAt: privyStellarWalletsTable.createdAt,
    })
    .from(privyStellarWalletsTable)
    .where(eq(privyStellarWalletsTable.userId, user.id))
    .limit(1);

  res.json({ wallet: wallet ?? null });
});

router.post("/users/update-wallet", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to Investa Farm before linking a wallet." });
    return;
  }

  const parsed = LinkWalletBody.safeParse(req.body);
  if (!parsed.success || !StellarSdk.StrKey.isValidEd25519PublicKey(parsed.data.address)) {
    res.status(400).json({ error: "A valid Stellar public address is required." });
    return;
  }

  const client = getPrivyClient();
  if (!client) {
    res.status(503).json({ error: "Privy wallet verification is not configured on this server." });
    return;
  }

  const privyAccessToken = bearerToken(req.headers["x-privy-access-token"]);
  if (!privyAccessToken) {
    res.status(401).json({ error: "Complete the Privy sign-in to verify wallet ownership." });
    return;
  }

  let verifiedUserId: string;
  try {
    const claims = await client.utils().auth().verifyAccessToken(privyAccessToken);
    verifiedUserId = claims.user_id;
  } catch {
    res.status(401).json({ error: "The Privy session could not be verified. Sign in to Privy again." });
    return;
  }

  let linkedAccounts: PrivyWalletAccount[];
  try {
    const privyUser = await client.users()._get(verifiedUserId);
    linkedAccounts = (privyUser.linked_accounts ?? []) as PrivyWalletAccount[];
  } catch {
    res.status(502).json({ error: "Privy could not confirm this wallet right now. Please try again." });
    return;
  }

  const ownsStellarAddress = linkedAccounts.some(
    (account) =>
      account.type === "wallet" &&
      account.chain_type === "stellar" &&
      account.address === parsed.data.address,
  );
  if (!ownsStellarAddress) {
    res.status(403).json({ error: "That Stellar address is not linked to the authenticated Privy account." });
    return;
  }

  try {
    const [existingWallet] = await db
      .select({
        privyUserId: privyStellarWalletsTable.privyUserId,
        address: privyStellarWalletsTable.address,
      })
      .from(privyStellarWalletsTable)
      .where(eq(privyStellarWalletsTable.userId, user.id))
      .limit(1);

    if (
      existingWallet &&
      (existingWallet.privyUserId !== verifiedUserId || existingWallet.address !== parsed.data.address)
    ) {
      res.status(409).json({
        error:
          "A different Stellar wallet is already linked. Reconnect the original Privy account; the existing wallet was not changed.",
      });
      return;
    }

    const [insertedWallet] = await db
      .insert(privyStellarWalletsTable)
      .values({
        userId: user.id,
        privyUserId: verifiedUserId,
        address: parsed.data.address,
      })
      .onConflictDoNothing({
        target: privyStellarWalletsTable.userId,
      })
      .returning({
        address: privyStellarWalletsTable.address,
        linkedAt: privyStellarWalletsTable.createdAt,
      });

    if (insertedWallet) {
      res.json({ wallet: insertedWallet });
      return;
    }

    const [unchangedWallet] = await db
      .select({
        privyUserId: privyStellarWalletsTable.privyUserId,
        address: privyStellarWalletsTable.address,
        linkedAt: privyStellarWalletsTable.createdAt,
      })
      .from(privyStellarWalletsTable)
      .where(eq(privyStellarWalletsTable.userId, user.id))
      .limit(1);

    if (
      !unchangedWallet ||
      unchangedWallet.privyUserId !== verifiedUserId ||
      unchangedWallet.address !== parsed.data.address
    ) {
      res.status(409).json({
        error:
          "A different Stellar wallet is already linked. Reconnect the original Privy account; the existing wallet was not changed.",
      });
      return;
    }

    const { privyUserId: _privyUserId, ...wallet } = unchangedWallet;
    res.json({ wallet });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      res.status(409).json({ error: "This Privy wallet is already linked to another Investa Farm account." });
      return;
    }
    res.status(500).json({ error: "Failed to save the linked Stellar wallet." });
  }
});

export default router;
