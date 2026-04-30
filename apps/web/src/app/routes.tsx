import {
  BookOpen,
  BriefcaseBusiness,
  CheckSquare,
  ClipboardPlus,
  FolderKanban,
  Home,
  ListChecks,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "../i18n/dictionaries.js";

export type AppRouteId =
  | "myWork"
  | "newWork"
  | "allWork"
  | "projects"
  | "approvals"
  | "organization"
  | "glossary"
  | "settings";

export type AppRoute = {
  id: AppRouteId;
  href: string;
  icon: LucideIcon;
  label: (dictionary: Dictionary) => string;
};

export const appRoutes: readonly AppRoute[] = [
  { id: "myWork", href: "/my-work", icon: Home, label: (dictionary) => dictionary.nav.myWork },
  { id: "newWork", href: "/work/new", icon: ClipboardPlus, label: (dictionary) => dictionary.nav.newWork },
  { id: "allWork", href: "/work", icon: ListChecks, label: (dictionary) => dictionary.nav.allWork },
  { id: "projects", href: "/projects", icon: FolderKanban, label: (dictionary) => dictionary.nav.projects },
  { id: "approvals", href: "/approvals", icon: CheckSquare, label: (dictionary) => dictionary.nav.approvals },
  { id: "organization", href: "/organization", icon: Users, label: (dictionary) => dictionary.nav.organization },
  { id: "glossary", href: "/glossary", icon: BookOpen, label: (dictionary) => dictionary.nav.glossary },
  { id: "settings", href: "/settings", icon: Settings, label: (dictionary) => dictionary.nav.settings },
];

export const productIcon = BriefcaseBusiness;
