import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { type Locale, isSupportedLocale } from "@kreps/shared";
import { dictionaries } from "./dictionaries.js";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dictionary: (typeof dictionaries)[Locale];
};

const I18nContext = createContext<I18nContextValue | null>(null);

export type I18nProviderProps = PropsWithChildren<{
  initialLocale?: Locale;
}>;

export function I18nProvider({ children, initialLocale = "ko" }: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      dictionary: dictionaries[locale],
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}

export function toLocale(value: string): Locale {
  return isSupportedLocale(value) ? value : "ko";
}
