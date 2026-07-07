import { publicEncrypt, constants } from "crypto";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// FIX: The original code re-read the certificate from disk on every single
// call (e.g. every B2C payout, every balance query). This is unnecessary
// filesystem I/O on a hot path. The cert doesn't change at runtime, so we
// cache it after the first successful read.
// ---------------------------------------------------------------------------
let cachedPublicKey: string | null = null;

function loadPublicCert(): string {
  if (cachedPublicKey) return cachedPublicKey;

  const certPath = path.resolve(process.cwd(), "./certificates/mpesa_public_cert.cer");

  if (!fs.existsSync(certPath)) {
    // FIX: fail with a clear, actionable error instead of letting a cryptic
    // ENOENT bubble up from deep inside publicEncrypt.
    throw new Error(
      `M-Pesa public certificate not found at ${certPath}. Ensure the correct ` +
      `sandbox/production certificate from the Daraja portal is deployed.`
    );
  }

  cachedPublicKey = fs.readFileSync(certPath, "utf8");
  return cachedPublicKey;
}

export function generateSecurityCredential(password: string): string {
  if (!password) {
    throw new Error("MPESA_INITIATOR_PASSWORD is not set");
  }

  const publicKey = loadPublicCert();
  const buffer = Buffer.from(password);

  const encrypted = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_PADDING,
    },
    buffer
  );

  return encrypted.toString("base64");
}
