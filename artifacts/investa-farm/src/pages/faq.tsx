import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, HelpCircle, ChevronDown, ChevronUp, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredUser } from "@/lib/auth";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

const FAQS = [
  {
    category: "Returns & Earnings",
    items: [
      {
        q: "How do I earn returns on my investment?",
        a: "When you buy farm shares, you earn returns when the farmer exits (sells produce). You can choose a Mid-Season exit for +10% in 30–60 days, or a Full Season exit for up to +28% at harvest (~6 months).",
      },
      {
        q: "What is the minimum investment?",
        a: "The minimum investment is KES 5,000 (approximately 50 shares at KES 100/share). There is no maximum limit. You can diversify across multiple farms from a single account.",
      },
      {
        q: "Can I sell my shares to other investors?",
        a: "Yes! The Secondary Market allows you to sell your shares to other investors before the season ends. Prices fluctuate based on market demand. Access it from the Market tab.",
      },
    ],
  },
  {
    category: "Safety & Risk",
    items: [
      {
        q: "Is my investment guaranteed?",
        a: "Agricultural investments carry inherent risks including crop failure, weather events, and price fluctuations. Investa Farm mitigates risk through farm diversification, weather insurance partnerships, and KYC-verified farmers. Returns shown are projections based on historical performance.",
      },
      {
        q: "What happens if a farm fails?",
        a: "Investa Farm maintains a Farmer Protection Fund equivalent to 5% of all active investments. In the event of a total crop failure, investors receive partial compensation. Partial failures are covered proportionally by crop insurance.",
      },
      {
        q: "How are farmers verified?",
        a: "All farmers go through a 3-step verification: group registration (with at least 5 members), KYC document review (National ID + land documents), and a field visit by our agronomist team. Only verified farms are listed on the exchange.",
      },
    ],
  },
  {
    category: "KYC & Identity",
    items: [
      {
        q: "What is KYC and why do I need it?",
        a: "KYC (Know Your Customer) is identity verification required by Kenyan financial law. You'll need to upload a National ID and proof of address. Once verified, you can buy shares, request exits, and receive payouts.",
      },
      {
        q: "What documents are required for KYC?",
        a: "For individuals: National ID (front & back) and a utility bill or bank statement as proof of address. For businesses: Certificate of Incorporation, KRA PIN, and director IDs. Documents are reviewed within 1–3 business days.",
      },
    ],
  },
  {
    category: "Withdrawals & Wallet",
    items: [
      {
        q: "How do I withdraw my money?",
        a: "Request an exit from your Portfolio page. Choose Mid-Season (30–60 days) or Full Season (~6 months). Once approved, funds are sent to your M-Pesa or bank account within 5 business days.",
      },
      {
        q: "How does the Investa Wallet work?",
        a: "Your Investa Wallet is an internal KES balance that you can top up via M-Pesa and use to buy shares instantly without re-entering payment details. Withdraw your balance to M-Pesa or bank at any time.",
      },
      {
        q: "Are there withdrawal fees?",
        a: "Investa Farm charges a 1.5% withdrawal fee on returns (not principal). M-Pesa standard transaction fees apply on the receiving end. There is no fee for depositing into your wallet.",
      },
    ],
  },
  {
    category: "For Farmers",
    items: [
      {
        q: "How does funding work for farmers?",
        a: "After KYC verification and group registration (minimum 5 members), your farm is listed on the primary market. Investors buy shares which fund your operations. Repay from harvest proceeds and retain 55% of revenue.",
      },
      {
        q: "What crops are supported?",
        a: "Currently we support maize, wheat, avocado, tea, coffee, tomatoes, potatoes, beans, dairy cattle, and more. Contact our team if your crop type isn't listed — we expand regularly.",
      },
    ],
  },
  {
    category: "Support",
    items: [
      {
        q: "How do I contact support?",
        a: "Email us at support@investafarm.co.ke or call +254 700 000 000 (Mon–Fri, 8am–6pm). You can also use the in-app chat by tapping 'Help & Support' in your Profile.",
      },
      {
        q: "Is my data secure?",
        a: "Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We are compliant with Kenya's Data Protection Act 2019. We never share your personal data with third parties without your consent.",
      },
    ],
  },
];

export default function FaqPage() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const backPath = user?.role === "farmer" ? "/farmer/profile" : "/profile";

  const filtered = search.trim().length > 1
    ? FAQS.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          item.q.toLowerCase().includes(search.toLowerCase()) ||
          item.a.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(cat => cat.items.length > 0)
    : FAQS;

  return (
    <div className="min-h-dvh w-full max-w-[430px] mx-auto bg-background pb-10">
      {/* Header */}
      <div className="hero-header pt-12 pb-6 px-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLocation(backPath)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex-1">
            <p className="text-white/70 text-xs">Help Centre</p>
            <h1 className="text-white text-xl font-bold">FAQs</h1>
          </div>
          <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto opacity-60" style={{ filter: "brightness(0) invert(1)" }} />
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions…"
            className="w-full bg-white/15 border border-white/20 rounded-2xl pl-10 pr-4 py-2.5 text-white placeholder:text-white/50 text-sm focus:outline-none focus:bg-white/20"
          />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <HelpCircle size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold">No results found</p>
            <p className="text-muted-foreground text-sm mt-1">Try different search terms</p>
          </div>
        )}

        {filtered.map(cat => (
          <div key={cat.category}>
            <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2 px-1">{cat.category}</p>
            <div className="space-y-2">
              {cat.items.map((item, i) => {
                const key = `${cat.category}-${i}`;
                const isOpen = openItem === key;
                return (
                  <div key={key} className="bg-card border border-border rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpenItem(isOpen ? null : key)}
                      className="w-full flex items-center justify-between p-4 text-left"
                    >
                      <p className={`text-sm font-medium leading-snug pr-3 ${isOpen ? "text-primary" : "text-foreground"}`}>
                        {item.q}
                      </p>
                      {isOpen
                        ? <ChevronUp size={16} className="text-primary flex-shrink-0" />
                        : <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
                      }
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-0">
                            <div className="w-full h-px bg-border mb-3" />
                            <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Contact card */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 mt-4">
          <p className="text-green-800 font-semibold text-sm mb-1">Still have questions?</p>
          <p className="text-green-600 text-xs mb-3">Our support team is here to help you.</p>
          <div className="space-y-1.5 text-xs text-green-700">
            <p>📧 support@investafarm.co.ke</p>
            <p>📞 +254 700 000 000</p>
            <p>🕐 Mon–Fri, 8am–6pm EAT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
