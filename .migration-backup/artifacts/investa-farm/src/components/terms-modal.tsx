import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Shield } from "lucide-react";

interface TermsModalProps {
  open: "terms" | "privacy" | null;
  onClose: () => void;
}

const TERMS_CONTENT = [
  { heading: "1. Acceptance of Terms", body: "By creating an account on Investa Farm, you agree to these Terms of Service. If you do not agree, do not use our platform." },
  { heading: "2. Investment Risks", body: "Agricultural investments carry inherent risks including crop failure, weather events, and market price fluctuations. Returns stated are projections and not guaranteed. Past performance does not guarantee future results." },
  { heading: "3. Eligible Users", body: "You must be at least 18 years old and a legal resident of Kenya or an eligible jurisdiction to invest on our platform. KYC verification is required before trading." },
  { heading: "4. Platform Fees", body: "Investa Farm charges a 2% platform fee on successful investment exits. Farmers pay a 3% listing fee on funds raised. All fees are disclosed at the point of transaction." },
  { heading: "5. Funds & Payouts", body: "Investor funds are held in regulated escrow accounts. Payouts are processed within 5 business days of exit approval. Mid-season exits require a 30-day notice period." },
  { heading: "6. Prohibited Activities", body: "Users may not engage in money laundering, market manipulation, creating fake listings, or any fraudulent activity. Violations result in immediate account termination and potential legal action." },
  { heading: "7. Dispute Resolution", body: "Disputes shall be resolved through mediation governed by Kenyan law. For unresolved matters, the courts of Kenya shall have jurisdiction." },
  { heading: "8. Changes to Terms", body: "We may update these terms with 30 days notice. Continued use of the platform after changes constitutes acceptance." },
];

const PRIVACY_CONTENT = [
  { heading: "1. Data We Collect", body: "We collect: name, email, phone number, national ID number, farm location and size, financial transaction data, device identifiers, and usage analytics." },
  { heading: "2. How We Use Data", body: "Your data is used to verify your identity (KYC), process investments and payouts, match investors with farms, improve our platform, and comply with Kenya's Data Protection Act 2019." },
  { heading: "3. Data Sharing", body: "We share your data with: KYC verification partners, payment processors, regulatory bodies as required by law, and farm operators you invest in. We never sell your personal data." },
  { heading: "4. Data Security", body: "We use AES-256 encryption, secure cloud infrastructure, and regular security audits. Our team undergoes mandatory data protection training." },
  { heading: "5. Your Rights", body: "Under Kenya's Data Protection Act, you have the right to access, correct, or delete your personal data. Contact privacy@investafarm.co.ke to exercise these rights." },
  { heading: "6. Data Retention", body: "Account data is retained for 7 years after account closure as required by financial regulations. KYC documents are held for 5 years after the last transaction." },
  { heading: "7. Cookies", body: "We use cookies for session management and analytics. You may disable cookies in your browser settings, though this may affect platform functionality." },
  { heading: "8. Contact", body: "For privacy concerns: privacy@investafarm.co.ke | P.O. Box 12345-00100, Nairobi, Kenya | +254 700 000 000" },
];

export function TermsModal({ open, onClose }: TermsModalProps) {
  const isTerms = open === "terms";
  const content = isTerms ? TERMS_CONTENT : PRIVACY_CONTENT;
  const title = isTerms ? "Terms of Service" : "Privacy Policy";
  const Icon = isTerms ? FileText : Shield;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="w-full max-w-[430px] bg-white rounded-t-3xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon size={16} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-base">{title}</h2>
                  <p className="text-muted-foreground text-[10px]">Last updated: June 2026</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {content.map(({ heading, body }) => (
                <div key={heading}>
                  <h3 className="text-foreground font-semibold text-sm mb-1.5">{heading}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{body}</p>
                </div>
              ))}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <p className="text-primary text-xs font-medium">Questions?</p>
                <p className="text-muted-foreground text-xs mt-0.5">legal@investafarm.co.ke · +254 700 000 000</p>
              </div>
              <div className="h-4" />
            </div>

            <div className="px-5 pb-8 pt-3 border-t border-border flex-shrink-0">
              <button onClick={onClose}
                className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl active:scale-95 transition-transform">
                Got it, close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
