import { Link, useLocation } from "wouter";
import { BarChart2, Briefcase, Activity, User, Home, Handshake, Package, ClipboardList, ShoppingBasket, Bell, MoreHorizontal, X, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

interface NavItem { label: string; path: string; icon: React.ElementType; badge?: boolean }

const investorNav: NavItem[] = [
  { label: "Market",    path: "/market",    icon: BarChart2 },
  { label: "Portfolio", path: "/portfolio", icon: Briefcase },
  { label: "Activity",  path: "/activity",  icon: Activity  },
  { label: "Profile",   path: "/profile",   icon: User      },
];

const farmerMainNav: NavItem[] = [
  { label: "Home",  path: "/farmer",            icon: Home         },
  { label: "Track", path: "/farmer/operations", icon: ClipboardList },
];

const farmerMoreItems: NavItem[] = [
  { label: "Market",        path: "/farmer/market",        icon: ShoppingBasket },
  { label: "Alerts",        path: "/farmer/notifications", icon: Bell, badge: true },
  { label: "Profile",       path: "/farmer/profile",       icon: User },
  { label: "Crop Proposal", path: "/farmer/crop-proposal", icon: ClipboardList },
  { label: "KYC Docs",      path: "/farmer/kyc",           icon: Briefcase },
  { label: "Wallet",        path: "/farmer/wallet",        icon: MoreHorizontal },
];

const agribusinessNav: NavItem[] = [
  { label: "Dashboard", path: "/agribusiness",         icon: Home      },
  { label: "Orders",    path: "/agribusiness/orders",  icon: Package   },
  { label: "Network",   path: "/agribusiness/network", icon: Handshake },
  { label: "Profile",   path: "/agribusiness/profile", icon: User      },
];

function useUnreadCount() {
  const [count, setCount] = useState(0);
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const r = await fetch("/api/notifications?limit=30", { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return;
        const data = await r.json();
        const seenRaw = localStorage.getItem("investa_seen_notif_ids");
        const seen: Set<number> = seenRaw ? new Set(JSON.parse(seenRaw)) : new Set();
        const unread = (data as { id: number }[]).filter(n => !seen.has(n.id)).length;
        setCount(unread);
      } catch { /* silent */ }
    };
    load();
    const iv = setInterval(load, 45_000);
    return () => clearInterval(iv);
  }, [token]);

  return count;
}

function FarmerMoreSheet({ open, onClose, unread }: { open: boolean; onClose: () => void; unread: number }) {
  const [location] = useLocation();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-[430px] bg-background rounded-t-3xl shadow-2xl pb-8"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <p className="font-bold text-base">More</p>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={15} className="text-foreground" />
              </button>
            </div>
            <div className="px-4 space-y-1.5 pb-2">
              {farmerMoreItems.map(({ label, path, icon: Icon, badge }) => {
                const isActive = location.startsWith(path);
                const showBadge = badge && unread > 0;
                return (
                  <Link key={path} href={path}>
                    <button onClick={onClose}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-98 ${isActive ? "bg-primary/10 text-primary" : "bg-muted/40 text-foreground hover:bg-muted"}`}>
                      <div className="relative">
                        <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                        {showBadge && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-sm flex-1 text-left">{label}</span>
                      <ChevronRight size={15} className="text-muted-foreground" />
                    </button>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function BottomNav({ role }: { role: "farmer" | "investor" | "agribusiness" }) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const unread = useUnreadCount();

  if (role === "farmer") {
    const isMoreActive = farmerMoreItems.some(i => location.startsWith(i.path));
    return (
      <>
        <nav
          data-testid="bottom-nav"
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-border z-50 px-1 pb-safe"
        >
          <div className="flex items-center justify-around py-1.5">
            {farmerMainNav.map(({ label, path, icon: Icon }) => {
              const isActive = path === "/farmer" ? location === "/farmer" : location.startsWith(path);
              return (
                <Link key={path} href={path}>
                  <button
                    data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
                    className={`flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl transition-all ${isActive ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                    <span className={`text-[9px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
                  </button>
                </Link>
              );
            })}

            <button
              data-testid="nav-more"
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl transition-all ${isMoreActive ? "text-primary" : "text-muted-foreground"}`}
            >
              <div className="relative">
                <MoreHorizontal size={20} strokeWidth={isMoreActive ? 2.5 : 1.8} />
                {unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-medium ${isMoreActive ? "text-primary" : "text-muted-foreground"}`}>More</span>
            </button>
          </div>
        </nav>
        <FarmerMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} unread={unread} />
      </>
    );
  }

  const items = role === "agribusiness" ? agribusinessNav : investorNav;
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-border z-50 px-1 pb-safe"
    >
      <div className="flex items-center justify-around py-1.5">
        {items.map(({ label, path, icon: Icon, badge }) => {
          const isActive = location === path || (
            path !== "/farmer" && path !== "/agribusiness" && path !== "/" &&
            location.startsWith(path)
          );
          const showBadge = badge && unread > 0;
          return (
            <Link key={path} href={path}>
              <button
                data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
                data-tour={label === "Portfolio" ? "nav-portfolio" : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative ${isActive ? "text-primary" : "text-muted-foreground"}`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5 leading-none">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
