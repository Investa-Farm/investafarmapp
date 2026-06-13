import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, X } from "lucide-react";
import { ChevronRight } from "lucide-react";

const DEFAULT_STORAGE_KEY = "investa_notif_pref";

interface NotificationPromptProps {
  storageKey?: string;
}

export function NotificationPrompt({ storageKey = DEFAULT_STORAGE_KEY }: NotificationPromptProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const pref = localStorage.getItem(storageKey);
    if (pref) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const timer = setTimeout(() => setShow(true), 3500);
    return () => clearTimeout(timer);
  }, [storageKey]);

  const handleAllow = async () => {
    setShow(false);
    const perm = await Notification.requestPermission();
    localStorage.setItem(storageKey, perm);
    if (perm === "granted") {
      new Notification("Investa Farm", {
        body: "You'll now receive updates on your investments 🌾",
        icon: "/favicon.ico",
      });
    }
  };

  const handleDeny = () => {
    localStorage.setItem(storageKey, "dismissed");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 260 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[398px] z-[200]"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-border p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <Bell size={20} className="text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm">Stay updated on your investments</p>
                <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                  Get alerts for new farm listings, harvest payouts, and market price changes.
                </p>
              </div>
              <button onClick={handleDeny} className="text-muted-foreground flex-shrink-0 -mt-0.5">
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleDeny}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <BellOff size={13} /> Not now
              </button>
              <button
                onClick={handleAllow}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <Bell size={13} /> Allow notifications
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface NotificationStatusRowProps {
  className?: string;
}

export function NotificationStatusRow({ className = "" }: NotificationStatusRowProps) {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) {
      setPerm("unsupported" as any);
    } else {
      setPerm(Notification.permission);
    }
  }, []);

  const handleRequest = async () => {
    if (!("Notification" in window)) return;
    setRequesting(true);
    const p = await Notification.requestPermission();
    localStorage.setItem(DEFAULT_STORAGE_KEY, p);
    setPerm(p);
    setRequesting(false);
  };

  const label =
    perm === "granted"     ? "Enabled — you'll receive alerts" :
    perm === "denied"      ? "Blocked — change in browser settings" :
    perm === "unsupported" ? "Not supported on this device" :
                             "Tap Enable to get investment alerts";

  const color =
    perm === "granted" ? "text-green-600" :
    perm === "denied"  ? "text-red-500"   : "text-amber-500";

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Bell size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-foreground text-sm font-medium">Notifications</span>
        <p className={`text-[10px] mt-0.5 leading-snug ${color}`}>{label}</p>
      </div>
      {perm === "default" ? (
        <button
          onClick={handleRequest}
          disabled={requesting}
          className="text-[10px] bg-green-600 text-white font-semibold px-3 py-1.5 rounded-xl flex-shrink-0 active:scale-95 transition-transform"
        >
          {requesting ? "…" : "Enable"}
        </button>
      ) : (
        <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />
      )}
    </div>
  );
}
