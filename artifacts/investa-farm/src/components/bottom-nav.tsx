import { Link, useLocation } from "wouter";
import { BarChart2, Briefcase, Activity, User, Home, ShoppingCart, DollarSign, MoreHorizontal, Handshake, Package, Newspaper } from "lucide-react";

interface NavItem { label: string; path: string; icon: React.ElementType; }

const investorNav: NavItem[] = [
  { label: "Market",    path: "/market",    icon: BarChart2 },
  { label: "Portfolio", path: "/portfolio", icon: Briefcase },
  { label: "Activity",  path: "/activity",  icon: Activity  },
  { label: "Profile",   path: "/profile",   icon: User      },
];

const farmerNav: NavItem[] = [
  { label: "Home",     path: "/farmer",              icon: Home        },
  { label: "News",     path: "/farmer/news",         icon: Newspaper   },
  { label: "Market",   path: "/farmer/market",       icon: ShoppingCart },
  { label: "Earnings", path: "/farmer/operations",   icon: DollarSign  },
  { label: "More",     path: "/farmer/profile",      icon: MoreHorizontal },
];

const agribusinessNav: NavItem[] = [
  { label: "Dashboard", path: "/agribusiness",         icon: Home      },
  { label: "Orders",    path: "/agribusiness/orders",  icon: Package   },
  { label: "Network",   path: "/agribusiness/network", icon: Handshake },
  { label: "Profile",   path: "/agribusiness/profile", icon: User      },
];

export function BottomNav({ role }: { role: "farmer" | "investor" | "agribusiness" }) {
  const [location] = useLocation();
  const items = role === "farmer" ? farmerNav : role === "agribusiness" ? agribusinessNav : investorNav;

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-border z-50 px-2 pb-safe"
    >
      <div className="flex items-center justify-around py-2">
        {items.map(({ label, path, icon: Icon }) => {
          const isActive = location === path || (path !== "/farmer" && path !== "/agribusiness" && path !== "/" && location.startsWith(path));
          return (
            <Link key={path} href={path}>
              <button
                data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
                data-tour={label === "Portfolio" ? "nav-portfolio" : undefined}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all ${isActive ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon size={role === "farmer" ? 19 : 20} strokeWidth={isActive ? 2.5 : 1.8} />
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
