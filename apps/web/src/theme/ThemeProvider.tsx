import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { type ThemePreference, isSupportedTheme } from "@kreps/shared";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export type ThemeProviderProps = PropsWithChildren<{
  initialTheme?: ThemePreference;
}>;

export function ThemeProvider({ children, initialTheme = "system" }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemePreference>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      root.dataset.themePreference = theme;
      root.dataset.theme = theme === "system" ? systemTheme() : theme;
    };

    applyTheme();

    if (theme !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener?.("change", applyTheme);

    return () => {
      media.removeEventListener?.("change", applyTheme);
    };
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}

export function toTheme(value: string): ThemePreference {
  return isSupportedTheme(value) ? value : "system";
}

function systemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
