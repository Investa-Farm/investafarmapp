import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, TrendingUp, Users, Briefcase, ChevronRight } from "lucide-react";

export type InvestorType = "individual" | "fund_manager";

interface InvestorTypeModalProps {
  open: boolean;
  onSelect: (type: InvestorType) => void;
}

export function InvestorTypeModal({ open, onSelect }: InvestorTypeModalProps) {
  const [selected, setSelected] = useState<InvestorType | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl px-5 pt-6 pb-10">

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-3">
                <BarChart3 size={24} className="text-primary" />
              </div>
              <h2 className="text-foreground font-bold text-lg">How do you invest?</h2>
              <p className="text-muted-foreground text-xs mt-1">This customises your dashboard experience</p>
            </div>

            <div className="space-y-3 mb-5">
              {[
                {
                  type: "individual" as InvestorType,
                  icon: TrendingUp,
                  title: "Individual Investor",
                  desc: "I invest my own money in farm shares",
                  features: ["Simple portfolio view", "Easy buy/sell", "Season returns tracking"],
                  color: "border-primary/30 bg-primary/5",
                  active: "border-primary bg-primary/5 ring-2 ring-primary/40",
                  iconColor: "text-primary",
                },
                {
                  type: "fund_manager" as InvestorType,
                  icon: Briefcase,
                  title: "Wealth / Fund Manager",
                  desc: "I manage investments on behalf of clients",
                  features: ["AUM summary dashboard", "Batch invest across farms", "Multi-farm spread analytics", "Client allocation view"],
                  color: "border-blue-200 bg-blue-50",
                  active: "border-blue-500 bg-blue-50 ring-2 ring-blue-400",
                  iconColor: "text-blue-600",
                },
              ].map(({ type, icon: Icon, title, desc, features, color, active, iconColor }) => (
                <button key={type} onClick={() => setSelected(type)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${selected === type ? active : color}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                      <Icon size={17} className={iconColor} />
                    </div>
                    <div>
                      <p className="text-foreground font-semibold text-sm">{title}</p>
                      <p className="text-muted-foreground text-[10px]">{desc}</p>
                    </div>
                    {selected === type && <div className="ml-auto w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"><span className="text-white text-[9px] font-bold">✓</span></div>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {features.map(f => (
                      <span key={f} className="text-[9px] font-medium bg-white border border-border px-2 py-0.5 rounded-full text-muted-foreground">{f}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <button disabled={!selected} onClick={() => selected && onSelect(selected)}
              className="w-full bg-gradient-to-r from-primary to-green-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-primary/20">
              Continue <ChevronRight size={16} />
            </button>

            <p className="text-center text-muted-foreground text-[10px] mt-3">You can change this in your Profile settings</p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
