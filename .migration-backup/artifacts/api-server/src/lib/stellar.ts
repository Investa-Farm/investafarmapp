import * as StellarSdk from "@stellar/stellar-sdk";
import crypto from "crypto";
import { db, stellarAccountsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const ENCRYPTION_KEY = process.env["SESSION_SECRET"] ?? "investa-farm-secret-key-32-chars!";
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(encryptedData: string): string {
  const [ivHex, tagHex, dataHex] = encryptedData.split(":");
  const iv = Buffer.from(ivHex!, "hex");
  const tag = Buffer.from(tagHex!, "hex");
  const data = Buffer.from(dataHex!, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

export function generateAccountNumber(userId: number): string {
  const part1 = String(1000 + Math.floor(Math.random() * 9000));
  const part2 = String(1000 + (userId * 137 + 4721) % 9000);
  return `IFV-${part1}-${part2}`;
}

export async function getOrCreateStellarAccount(userId: number) {
  const existing = await db.select().from(stellarAccountsTable).where(eq(stellarAccountsTable.userId, userId)).limit(1);
  if (existing[0]) return existing[0];

  const keypair = StellarSdk.Keypair.random();
  const accountNumber = generateAccountNumber(userId);
  const encryptedSecret = encryptSecret(keypair.secret());

  const [account] = await db.insert(stellarAccountsTable).values({
    userId,
    accountNumber,
    publicKey: keypair.publicKey(),
    encryptedSecret,
  }).returning();

  await db.update(usersTable).set({ accountNumber } as any).where(eq(usersTable.id, userId)).catch(() => {});

  return account!;
}

export async function getInvestorPublicKey(userId: number): Promise<string | null> {
  const account = await db.select().from(stellarAccountsTable).where(eq(stellarAccountsTable.userId, userId)).limit(1);
  return account[0]?.publicKey ?? null;
}

export const ISSUER_PUBLIC_KEY = process.env["STELLAR_ISSUER_PUBLIC_KEY"] ?? "";
export const ISSUER_SECRET_KEY = process.env["STELLAR_ISSUER_SECRET_KEY"] ?? "";
export const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

export function getIssuerKeypair(): StellarSdk.Keypair | null {
  if (!ISSUER_SECRET_KEY) return null;
  try {
    return StellarSdk.Keypair.fromSecret(ISSUER_SECRET_KEY);
  } catch {
    return null;
  }
}

export async function fundUserAccount(userPublicKey: string): Promise<boolean> {
  const issuer = getIssuerKeypair();
  if (!issuer) return false;
  try {
    const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
    const issuerAccount = await server.loadAccount(issuer.publicKey());
    const tx = new StellarSdk.TransactionBuilder(issuerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(StellarSdk.Operation.createAccount({
        destination: userPublicKey,
        startingBalance: "1",
      }))
      .setTimeout(30)
      .build();
    tx.sign(issuer);
    await server.submitTransaction(tx);
    return true;
  } catch {
    return false;
  }
}
