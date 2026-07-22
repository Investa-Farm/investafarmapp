import { useState, useEffect, useCallback } from "react";

const KEY = "investa_invest_list";

export interface InvestListItem {
  listingId: number;
  farmId: number;
  farmName: string;
  cropType: string;
  pricePerShare: number;
  sharesAvailable: number;
  imageUrl?: string;
  quantity: number;
}

function readItems(): InvestListItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as InvestListItem[]) : [];
  } catch {
    return [];
  }
}

function writeItems(items: InvestListItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("investa-invest-list-changed"));
  } catch { /* silent */ }
}

/**
 * Investor's "investment list" — like a shopping cart, but for farm shares.
 * Investors can add several farms with a quantity each, review them together,
 * then invest in all of them in one pass.
 */
export function useInvestList() {
  const [items, setItems] = useState<InvestListItem[]>(readItems);

  useEffect(() => {
    const handler = () => setItems(readItems());
    window.addEventListener("storage", handler);
    window.addEventListener("investa-invest-list-changed", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("investa-invest-list-changed", handler);
    };
  }, []);

  const add = useCallback((item: Omit<InvestListItem, "quantity">, quantity = 10) => {
    setItems(prev => {
      const existing = prev.find(i => i.listingId === item.listingId);
      const next = existing
        ? prev.map(i => i.listingId === item.listingId ? { ...i, quantity: i.quantity + quantity } : i)
        : [...prev, { ...item, quantity }];
      writeItems(next);
      return next;
    });
  }, []);

  const remove = useCallback((listingId: number) => {
    setItems(prev => {
      const next = prev.filter(i => i.listingId !== listingId);
      writeItems(next);
      return next;
    });
  }, []);

  const setQuantity = useCallback((listingId: number, quantity: number) => {
    setItems(prev => {
      const next = prev.map(i => i.listingId === listingId ? { ...i, quantity: Math.max(1, quantity) } : i);
      writeItems(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    writeItems([]);
    setItems([]);
  }, []);

  const isInList = useCallback((listingId: number) => items.some(i => i.listingId === listingId), [items]);

  const total = items.reduce((sum, i) => sum + i.pricePerShare * i.quantity, 0);

  return { items, add, remove, setQuantity, clear, isInList, total };
}
