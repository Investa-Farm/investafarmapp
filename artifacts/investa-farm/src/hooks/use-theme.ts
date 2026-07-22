import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/auth";

const THEME_EVENT = "investa-theme-change";

/** Returns the localStorage key for the current account's theme preference. */
function getThemeKey(): string {
  const user = getStoredUser();
  return user ? `investa_theme_${user.id}` : "investa_theme_guest";
}

function readIsDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

// Applies the persisted theme to the DOM and returns the resulting isDark value.
// Used for cross-tab `storage` events, where the DOM class in *this* tab is
// stale — the source of truth is whatever the other tab just wrote to
// localStorage, not this tab's current `document.documentElement` class.
function applyStoredTheme(): boolean {
  const next = localStorage.getItem(getThemeKey()) === "dark";
  document.documentElement.classList.toggle("dark", next);
  return next;
}

/**
 * Shared dark-mode state, scoped to the currently logged-in account.
 * Each user's preference is saved under their own key so logging out
 * resets the theme and a different account gets its own setting.
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    // Same-tab toggle: the DOM class was already updated by toggleDark(), so
    // just re-read it.
    const syncSameTab = () => setIsDark(readIsDark());
    // Cross-tab change: another tab updated localStorage but never touched
    // this tab's DOM, so we must apply it here before reading it back.
    const syncOtherTab = () => setIsDark(applyStoredTheme());
    window.addEventListener(THEME_EVENT, syncSameTab);
    window.addEventListener("storage", syncOtherTab);
    return () => {
      window.removeEventListener(THEME_EVENT, syncSameTab);
      window.removeEventListener("storage", syncOtherTab);
    };
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(getThemeKey(), next ? "dark" : "light");
    setIsDark(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return { isDark, toggleDark };
}
