import { createContext, useContext, useState, type ReactNode } from "react";

export type CurrencyCode = "USD" | "KES" | "NGN" | "EUR" | "GBP" | "ZAR";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  kesPerUnit: number;
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: "USD", symbol: "$",   name: "US Dollar",          flag: "🇺🇸", kesPerUnit: 129    },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling",    flag: "🇰🇪", kesPerUnit: 1      },
  { code: "NGN", symbol: "₦",  name: "Nigerian Naira",     flag: "🇳🇬", kesPerUnit: 0.082  },
  { code: "EUR", symbol: "€",  name: "Euro",               flag: "🇪🇺", kesPerUnit: 140    },
  { code: "GBP", symbol: "£",  name: "British Pound",      flag: "🇬🇧", kesPerUnit: 163    },
  { code: "ZAR", symbol: "R",  name: "South African Rand", flag: "🇿🇦", kesPerUnit: 6.9    },
];

interface CurrencyContextValue {
  currency: CurrencyConfig;
  setCurrency: (code: CurrencyCode) => void;
  formatAmount: (kesValue: number) => string;
  toDisplay: (kesValue: number) => number;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: CURRENCIES[0],
  setCurrency: () => {},
  formatAmount: (v) => `$${(v / 129).toFixed(2)}`,
  toDisplay: (v) => v / 129,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyConfig>(() => {
    const saved = localStorage.getItem("investa_currency");
    return CURRENCIES.find(c => c.code === saved) ?? CURRENCIES[0];
  });

  const setCurrency = (code: CurrencyCode) => {
    const cfg = CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];
    setCurrencyState(cfg);
    localStorage.setItem("investa_currency", code);
  };

  const toDisplay = (kesValue: number): number => kesValue / currency.kesPerUnit;

  const formatAmount = (kesValue: number): string => {
    const value = toDisplay(kesValue);
    if (currency.code === "KES") {
      return `KSh ${Math.round(value).toLocaleString("en-KE")}`;
    }
    if (currency.code === "NGN") {
      return `₦${Math.round(value).toLocaleString()}`;
    }
    if (currency.code === "ZAR") {
      return `R${Math.round(value).toLocaleString()}`;
    }
    if (value >= 1000) {
      return `${currency.symbol}${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    }
    return `${currency.symbol}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount, toDisplay }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
