import { Link, useLocation } from "wouter";
import { BarChart2, Briefcase, Activity, User, Home, Handshake, Package, ClipboardList, Users, ShoppingCart, ShoppingBag, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";

interface NavItem { label: string; path: string; icon: React.ElementType; badge?: boolean }

const investorNav: NavItem[] = [
  { label: "Market",    path: "/market",    icon: BarChart2 },
  { label: "Portfolio", path: "/portfolio", icon: Briefcase },
  { label: "Activity",  path: "/activity",  icon: Activity  },
  { label: "Profile",   path: "/profile",   icon: User      },
];

const farmerNav: NavItem[] = [
  { label: "Home",    path: "/farmer",            icon: Home         },
  { label: "Market",  path: "/farmer/market",     icon: ShoppingBag  },
  { label: "Wallet",  path: "/farmer/wallet",     icon: Wallet       },
  { label: "My Farm", path: "/farmer/operations", icon: ClipboardList },
  { label: "Profile", path: "/farmer/profile",    icon: User         },
];

const agribusinessNav: NavItem[] = [
  { label: "Dashboard", path: "/agribusiness",         icon: Home      },
  { label: "Orders",    path: "/agribusiness/orders",  icon: Package   },
  { label: "Network",   path: "/agribusiness/network", icon: Handshake },
  { label: "Profile",   path: "/agribusiness/profile", icon: User      },
];

const salesAgentNav: NavItem[] = [
  { label: "Home",    path: "/sales-agent/dashboard", icon: Home   },
  { label: "Network", path: "/agribusiness/network",  icon: Users  },
  { label: "Profile", path: "/agribusiness/profile",  icon: User   },
];

const offtakerNav: NavItem[] = [
  { label: "Home",   path: "/offtaker/dashboard",    icon: Home        },
  { label: "Orders", path: "/agribusiness/orders",   icon: ShoppingCart },
  { label: "Profile", path: "/agribusiness/profile", icon: User         },
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

export function BottomNav({ role }: { role: "farmer" | "investor" | "agribusiness" | "sales_agent" | "offtaker" }) {
  const [location] = useLocation();
  const unread = useUnreadCount();

  const items =
    role === "farmer"       ? farmerNav :
    role === "agribusiness" ? agribusinessNav :
    role === "sales_agent"  ? salesAgentNav :
    role === "offtaker"     ? offtakerNav :
    investorNav;

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-background border-t border-border z-50 px-1 pb-safe"
    >
      <div className="flex items-center justify-around py-1.5">
        {items.map(({ label, path, icon: Icon, badge }) => {
          const isHome = path === "/farmer" || path === "/sales-agent/dashboard" || path === "/offtaker/dashboard";
          const isActive = isHome
            ? location === path
            : location === path || (
                path !== "/agribusiness" && path !== "/" &&
                location.startsWith(path)
              );
          const showBadge = badge && unread > 0;
          return (
            <Link key={path} href={path}>
              <button
                aria-label={label}
                data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
                data-tour={
                  label === "Portfolio" ? "nav-portfolio" :
                  label === "Market" && role === "farmer" ? "nav-market" :
                  label === "Wallet" && role === "farmer" ? "nav-wallet" :
                  undefined
                }
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
