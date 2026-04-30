import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell.js";
import { I18nProvider } from "../i18n/I18nProvider.js";
import { ThemeProvider } from "../theme/ThemeProvider.js";

function renderShell(locale: "ko" | "en", theme: "system" | "light" | "dark" = "light") {
  render(
    <I18nProvider initialLocale={locale}>
      <ThemeProvider initialTheme={theme}>
        <AppShell />
      </ThemeProvider>
    </I18nProvider>,
  );
}

describe("AppShell", () => {
  it("renders Korean navigation labels", () => {
    renderShell("ko");

    for (const label of ["내 업무", "업무 등록", "전사 업무", "프로젝트", "승인", "조직", "용어집", "설정"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("renders English navigation labels", () => {
    renderShell("en");

    for (const label of [
      "My Work",
      "New Work",
      "All Work",
      "Projects",
      "Approvals",
      "Organization",
      "Glossary",
      "Settings",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("changes navigation language immediately", async () => {
    const user = userEvent.setup();
    renderShell("ko");

    await user.selectOptions(screen.getByLabelText("언어"), "en");

    expect(screen.getByRole("link", { name: "My Work" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "내 업무" })).not.toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("searchbox", { name: "Search work, projects, people" })).toHaveAttribute(
      "placeholder",
      "Search work, projects, people",
    );
    expect(screen.getByRole("button", { name: "Quick Create" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "User menu" })).toBeInTheDocument();
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByLabelText("Theme")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "System" })).toBeInTheDocument();
  });

  it("marks the active navigation route", () => {
    window.history.pushState({}, "", "/projects");

    renderShell("en");

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My Work" })).not.toHaveAttribute("aria-current");
  });

  it("marks my work active on the root route", () => {
    window.history.pushState({}, "", "/");

    renderShell("en");

    expect(screen.getByRole("link", { name: "My Work" })).toHaveAttribute("aria-current", "page");
  });

  it("applies the selected theme to the document", async () => {
    const user = userEvent.setup();
    renderShell("en");

    await user.selectOptions(screen.getByLabelText("Theme"), "dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePreference).toBe("dark");
  });

  it("uses the system theme and reacts to operating system changes", () => {
    const listeners = new Set<EventListenerOrEventListenerObject>();
    let prefersDark = true;
    const media = {
      get matches() {
        return prefersDark;
      },
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
    const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue(media);

    renderShell("en", "system");

    expect(document.documentElement.dataset.themePreference).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("dark");

    prefersDark = false;
    for (const listener of listeners) {
      if (typeof listener === "function") {
        listener(new Event("change"));
      } else {
        listener.handleEvent(new Event("change"));
      }
    }

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
  });
});
