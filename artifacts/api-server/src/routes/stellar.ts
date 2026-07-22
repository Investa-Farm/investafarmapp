import { Router, type IRouter } from "express";
import { getOrCreateStellarAccount, ISSUER_PUBLIC_KEY } from "../lib/stellar";
import { getCurrentUser } from "./auth";

const router: IRouter = Router();

// Get (or create) investor Stellar account — returns only account number, never exposes the G... address
router.get("/stellar/account", async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const account = await getOrCreateStellarAccount(user.id);
    res.json({
      accountNumber: account.accountNumber,
      // We intentionally do NOT return publicKey or encryptedSecret
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Get platform info (public key only, for display)
router.get("/stellar/platform", async (_req, res): Promise<void> => {
  res.json({ issuerPublicKey: ISSUER_PUBLIC_KEY, network: "testnet" });
});

export default router;
