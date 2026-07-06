import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.resolve(__dirname, "../../data/platform-settings.json");

export interface PlatformSettings {
  withdrawalFeePct: number;
  withdrawalFeeCap: number;
  primaryPurchaseFeePct: number;
  secondaryTradeFeePct: number;
  minInvestmentKES: number;
  minSharePurchase: number;
  priceAlertThresholdPct: number;
}

const DEFAULTS: PlatformSettings = {
  withdrawalFeePct: 0.5,
  withdrawalFeeCap: 260,
  primaryPurchaseFeePct: 1.0,
  secondaryTradeFeePct: 1.5,
  minInvestmentKES: 500,
  minSharePurchase: 1,
  priceAlertThresholdPct: 5,
};

export function loadSettings(): PlatformSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULTS };
}

export function saveSettings(settings: PlatformSettings): void {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
}
