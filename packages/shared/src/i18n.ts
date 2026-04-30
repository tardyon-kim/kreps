export const supportedLocales = ["ko", "en"] as const;

export type Locale = (typeof supportedLocales)[number];

export type LocaleResolutionInput = {
  userLocale?: string;
  organizationLocale?: string;
  defaultLocale?: string;
};

export function isSupportedLocale(locale: string | undefined): locale is Locale {
  return typeof locale === "string" && (supportedLocales as readonly string[]).includes(locale);
}

export function resolveLocale({
  userLocale,
  organizationLocale,
  defaultLocale = "ko",
}: LocaleResolutionInput): Locale {
  if (isSupportedLocale(userLocale)) return userLocale;
  if (isSupportedLocale(organizationLocale)) return organizationLocale;
  if (isSupportedLocale(defaultLocale)) return defaultLocale;
  return "ko";
}
