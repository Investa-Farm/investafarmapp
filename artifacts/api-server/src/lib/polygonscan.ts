/**
 * PolygonScan tx confirmation tracker.
 * Polls PolygonScan's proxy API (module=proxy) for a transaction's block number
 * and compares it against the current chain tip to compute live confirmations.
 * Falls back to the public polygon-rpc.com JSON-RPC endpoint if PolygonScan
 * is unreachable or rate-limited (no API key required either way, though
 * POLYGONSCAN_API_KEY — if set — raises PolygonScan's rate limit).
 */

const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY ?? "";
const POLYGONSCAN_BASE = "https://api.polygonscan.com/api";

export const REQUIRED_CONFIRMATIONS = 6;

export type TxStatusResult =
  | { status: "not_found" }
  | { status: "pending" }
  | { status: "failed" }
  | { status: "confirming" | "confirmed"; confirmations: number; blockNumber: number; requiredConfirmations: number };

async function rpcCall(method: string, params: unknown[]): Promise<any> {
  const resp = await fetch("https://polygon-rpc.com/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(6000),
  });
  const data = await resp.json() as any;
  return data?.result;
}

async function getViaPolygonScan(txHash: string): Promise<{ blockNumber: number | null; latestBlock: number; failed: boolean } | null> {
  try {
    const keyParam = POLYGONSCAN_API_KEY ? `&apikey=${POLYGONSCAN_API_KEY}` : "";
    const [txResp, blockResp] = await Promise.all([
      fetch(`${POLYGONSCAN_BASE}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}${keyParam}`, { signal: AbortSignal.timeout(6000) }),
      fetch(`${POLYGONSCAN_BASE}?module=proxy&action=eth_blockNumber${keyParam}`, { signal: AbortSignal.timeout(6000) }),
    ]);
    const txData = await txResp.json() as any;
    const blockData = await blockResp.json() as any;
    const latestBlock = parseInt(blockData?.result ?? "0x0", 16);
    const tx = txData?.result;
    if (!tx) return { blockNumber: null, latestBlock, failed: false };
    const blockNumber = tx.blockNumber ? parseInt(tx.blockNumber, 16) : null;
    // Check receipt status once mined
    let failed = false;
    if (blockNumber !== null) {
      const receiptResp = await fetch(`${POLYGONSCAN_BASE}?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}${keyParam}`, { signal: AbortSignal.timeout(6000) });
      const receiptData = await receiptResp.json() as any;
      failed = receiptData?.result?.status === "0x0";
    }
    return { blockNumber, latestBlock, failed };
  } catch {
    return null;
  }
}

async function getViaRpc(txHash: string): Promise<{ blockNumber: number | null; latestBlock: number; failed: boolean } | null> {
  try {
    const [tx, latestBlockHex, receipt] = await Promise.all([
      rpcCall("eth_getTransactionByHash", [txHash]),
      rpcCall("eth_blockNumber", []),
      rpcCall("eth_getTransactionReceipt", [txHash]),
    ]);
    const latestBlock = parseInt(latestBlockHex ?? "0x0", 16);
    if (!tx) return { blockNumber: null, latestBlock, failed: false };
    const blockNumber = tx.blockNumber ? parseInt(tx.blockNumber, 16) : null;
    const failed = receipt ? receipt.status === "0x0" : false;
    return { blockNumber, latestBlock, failed };
  } catch {
    return null;
  }
}

/** Get live confirmation status for a Polygon tx hash, preferring PolygonScan, falling back to raw RPC. */
export async function getPolygonTxStatus(txHash: string): Promise<TxStatusResult> {
  if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
    return { status: "not_found" };
  }

  const result = (await getViaPolygonScan(txHash)) ?? (await getViaRpc(txHash));
  if (!result) return { status: "not_found" };

  if (result.blockNumber === null) return { status: "pending" };
  if (result.failed) return { status: "failed" };

  const confirmations = Math.max(0, result.latestBlock - result.blockNumber + 1);
  return {
    status: confirmations >= REQUIRED_CONFIRMATIONS ? "confirmed" : "confirming",
    confirmations,
    blockNumber: result.blockNumber,
    requiredConfirmations: REQUIRED_CONFIRMATIONS,
  };
}
