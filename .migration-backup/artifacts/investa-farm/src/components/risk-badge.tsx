import { AlertTriangle, Minus, ShieldCheck } from "lucide-react";

export type RiskLevel = "Low" | "Moderate" | "High";

const HIGH_RISK_CROPS = new Set(["coffee", "avocado", "tobacco", "horticulture"]);
const MOD_RISK_CROPS  = new Set(["tea", "wheat", "tomatoes", "potatoes", "onions"]);

export function getRiskLevel(cropType: string, changePercent: number): RiskLevel {
  const crop = cropType?.toLowerCase() ?? "";
  if (HIGH_RISK_CROPS.has(crop) || Math.abs(changePercent) > 5) return "High";
  if (MOD_RISK_CROPS.has(crop) || Math.abs(changePercent) > 2) return "Moderate";
  return "Low";
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  if (level === "High") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
        <AlertTriangle size={7} /> High Risk
      </span>
    );
  }
  if (level === "Moderate") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <Minus size={7} /> Moderate
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
      <ShieldCheck size={7} /> Low Risk
    </span>
  );
}
