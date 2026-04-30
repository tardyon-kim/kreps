import { Bell, Plus, Search, UserCircle } from "lucide-react";
import type { PropsWithChildren } from "react";
import { appRoutes, productIcon as ProductIcon } from "../app/routes.js";
import { toLocale, useI18n } from "../i18n/I18nProvider.js";
import { toTheme, useTheme } from "../theme/ThemeProvider.js";
import { Button } from "./primitives/Button.js";

export function AppShell({ children }: PropsWithChildren) {
  const { dictionary, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const activePath = typeof window === "undefined" ? "/my-work" : window.location.pathname;

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Primary">
        <a className="app-brand" href="/my-work" aria-label={dictionary.app.productName}>
          <span className="app-brand-mark">
            <ProductIcon size={20} aria-hidden="true" />
          </span>
          <span>
            <span className="app-brand-name">{dictionary.app.productName}</span>
            <span className="app-brand-subtitle">On-premise</span>
          </span>
        </a>

        <nav className="app-nav">
          {appRoutes.map((route) => {
            const Icon = route.icon;
            const label = route.label(dictionary);
            const isActive = activePath === route.href || (activePath === "/" && route.href === "/my-work");

            return (
              <a
                key={route.id}
                className="app-nav-link"
                href={route.href}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <label className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label={dictionary.app.searchPlaceholder}
              placeholder={dictionary.app.searchPlaceholder}
            />
          </label>

          <Button icon={<Plus size={17} aria-hidden="true" />}>{dictionary.app.quickCreate}</Button>

          <button className="icon-button" type="button" aria-label={dictionary.app.notifications}>
            <Bell size={18} aria-hidden="true" />
          </button>

          <button className="icon-button" type="button" aria-label={dictionary.app.userMenu}>
            <UserCircle size={18} aria-hidden="true" />
          </button>

          <label className="select-field language-field">
            <span className="sr-only">{dictionary.app.language}</span>
            <select
              className="select-control"
              aria-label={dictionary.app.language}
              value={locale}
              onChange={(event) => setLocale(toLocale(event.target.value))}
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="select-field theme-field">
            <span className="sr-only">{dictionary.app.theme}</span>
            <select
              className="select-control"
              aria-label={dictionary.app.theme}
              value={theme}
              onChange={(event) => setTheme(toTheme(event.target.value))}
            >
              <option value="system">{dictionary.theme.system}</option>
              <option value="light">{dictionary.theme.light}</option>
              <option value="dark">{dictionary.theme.dark}</option>
            </select>
          </label>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
