import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check } from "lucide-react";
import { useState } from "react";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  url?: string;
}

const SHARE_OPTIONS = [
  {
    label: "WhatsApp",
    icon: "💬",
    color: "bg-[#25D366]",
    getUrl: (text: string, url: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    label: "X / Twitter",
    icon: "𝕏",
    color: "bg-black",
    getUrl: (text: string, url: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    label: "Telegram",
    icon: "✈️",
    color: "bg-[#0088cc]",
    getUrl: (text: string, url: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    label: "LinkedIn",
    icon: "in",
    color: "bg-[#0A66C2]",
    getUrl: (_text: string, url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    label: "Email",
    icon: "✉️",
    color: "bg-gray-600",
    getUrl: (text: string, url: string) =>
      `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
  },
];

export function ShareModal({ open, onClose, title, text, url }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "https://investafarm.co.ke");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleShare = (opt: typeof SHARE_OPTIONS[0]) => {
    window.open(opt.getUrl(text, shareUrl), "_blank", "noopener");
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-foreground font-bold text-base">Share</p>
                <p className="text-muted-foreground text-xs mt-0.5 truncate max-w-[280px]">{title}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-3 mb-5">
              {SHARE_OPTIONS.map(opt => (
                <button key={opt.label} onClick={() => handleShare(opt)}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                  <div className={`w-12 h-12 rounded-2xl ${opt.color} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>
                    {opt.icon}
                  </div>
                  <span className="text-[9px] font-medium text-muted-foreground">{opt.label}</span>
                </button>
              ))}
            </div>

            <button onClick={handleCopy}
              className="w-full flex items-center gap-3 bg-muted rounded-2xl p-3.5 active:scale-98 transition-all">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-primary" />}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-foreground text-sm font-medium">{copied ? "Copied!" : "Copy Link"}</p>
                <p className="text-muted-foreground text-[10px] truncate">{shareUrl}</p>
              </div>
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
