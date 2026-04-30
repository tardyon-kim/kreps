import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  document.documentElement.lang = "ko";
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
  window.history.pushState({}, "", "/");
});
