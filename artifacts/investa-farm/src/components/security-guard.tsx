import { useEffect, useState } from "react";
import { AlertTriangle, X, ShieldAlert } from "lucide-react";

const ALLOWED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "app.investafarm.com",
  "investa-farm.onrender.com",
];

function isOfficialHost(hostname: string): boolean {
  if (ALLOWED_HOSTS.includes(hostname)) return true;
  if (hostname.endsWith(".replit.dev")) return true;
  if (hostname.endsWith(".replit.app")) return true;
  if (hostname.endsWith(".repl.co")) return true;
  if (hostname.endsWith(".repl.run")) return true;
  return false;
}

export function SecurityGuard() {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;

    if (!isOfficialHost(hostname)) {
      setShowBanner(true);
      console.warn(
        "%c⚠️  INVESTA FARM — UNOFFICIAL SITE DETECTED",
        "color: #dc2626; font-size: 18px; font-weight: bold; background: #fee2e2; padding: 6px 12px; border-radius: 6px;",
      );
      console.warn(
        "%cYou are accessing this app from an unofficial domain.\nThis could be a phishing clone. Visit https://app.investafarm.com for the genuine platform.",
        "color: #991b1b; font-size: 13px;",
      );
    }

    console.log(
      "%c🛡️  SECURITY NOTICE — Investa Farm",
      "color: #16a34a; font-size: 18px; font-weight: bold; background: #f0fdf4; padding: 6px 12px; border-radius: 6px;",
    );
    console.log(
      "%cStop! This browser feature is for developers only.\nDo NOT paste any code here — doing so could expose your wallet and personal data to attackers.",
      "color: #15803d; font-size: 13px; font-weight: 500;",
    );
  }, []);

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-red-600 text-white shadow-2xl">
      <div className="max-w-[430px] mx-auto px-4 py-3 flex items-start gap-3">
        <ShieldAlert size={20} className="flex-shrink-0 mt-0.5 text-red-200" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Unofficial Site — Possible Phishing Clone</p>
          <p className="text-xs text-red-100 mt-1 leading-relaxed">
            You are NOT on the official Investa Farm platform. Never enter your password or PIN here.
            The real site is{" "}
            <a
              href="https://app.investafarm.com"
              className="underline font-semibold text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              app.investafarm.com
            </a>
            .
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss warning"
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center hover:bg-red-700 rounded-lg transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
