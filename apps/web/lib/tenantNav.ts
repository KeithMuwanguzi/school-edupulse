import type { NavGroup, NavItem } from "@/components/layout/AppShell";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MODULE_CATEGORY,
  moduleIcon,
  moduleLabel,
  sortModulesByCatalog,
} from "@/lib/moduleMeta";
import { roleCanAccessModule } from "@/lib/roleAccess";
import { buildParentNavGroups } from "@/lib/parentNav";

interface TenantNavUser {
  modules: string[];
  role: string;
}

export const STUDENT_SECTIONS = [
  { key: "roster", label: "Roster", href: "/app/m/students", icon: "list", exact: true },
  { key: "term", label: "Term check-in", href: "/app/m/students/term", icon: "clipboard", exact: false },
  { key: "discipline", label: "Discipline", href: "/app/m/students/discipline", icon: "shield", exact: false },
];

export const ADMISSIONS_SECTIONS = [
  { key: "pipeline", label: "Pipeline", href: "/app/m/admissions", icon: "clipboard", exact: true },
  { key: "new", label: "Add applicants", href: "/app/m/admissions/new?mode=multiple", icon: "plus", exact: false },
];

export const FINANCE_SECTIONS = [
  { key: "overview", label: "Accounts", href: "/app/m/finance", icon: "wallet", exact: true },
  { key: "structures", label: "Fee structures", href: "/app/m/finance/structures", icon: "list", exact: false },
];

export const HR_PAYROLL_SECTIONS = [
  { key: "overview", label: "Overview", href: "/app/m/hr_payroll", icon: "chart", exact: true },
  { key: "employees", label: "Employees", href: "/app/m/hr_payroll/employees", icon: "users", exact: false },
  { key: "leave", label: "Leave", href: "/app/m/hr_payroll/leave", icon: "calendar", exact: false },
  { key: "payroll", label: "Payroll", href: "/app/m/hr_payroll/payroll", icon: "wallet", exact: false },
  { key: "me", label: "My HR", href: "/app/m/hr_payroll/me", icon: "user", exact: false },
];

export const ASSESSMENT_SECTIONS = [
  { key: "marks", label: "Marks & CA", href: "/app/m/assessment", icon: "clipboard", exact: true },
  { key: "ple", label: "P7 PLE candidacy", href: "/app/m/assessment/ple", icon: "graduation", exact: false },
];

function moduleNavItem(key: string): NavItem {
  if (key === "students") {
    return {
      label: moduleLabel(key),
      href: "/app/m/students",
      icon: moduleIcon(key),
      children: STUDENT_SECTIONS.map((s) => ({
        label: s.label,
        href: s.href,
        icon: s.icon,
        exact: s.exact,
      })),
    };
  }
  if (key === "admissions") {
    return {
      label: moduleLabel(key),
      href: "/app/m/admissions",
      icon: moduleIcon(key),
      children: ADMISSIONS_SECTIONS.map((s) => ({
        label: s.label,
        href: s.href,
        icon: s.icon,
        exact: s.exact,
      })),
    };
  }
  if (key === "finance") {
    return {
      label: moduleLabel(key),
      href: "/app/m/finance",
      icon: moduleIcon(key),
      children: FINANCE_SECTIONS.map((s) => ({
        label: s.label,
        href: s.href,
        icon: s.icon,
        exact: s.exact,
      })),
    };
  }
  if (key === "hr_payroll") {
    return {
      label: moduleLabel(key),
      href: "/app/m/hr_payroll",
      icon: moduleIcon(key),
      children: HR_PAYROLL_SECTIONS.map((s) => ({
        label: s.label,
        href: s.href,
        icon: s.icon,
        exact: s.exact,
      })),
    };
  }
  if (key === "assessment") {
    return {
      label: moduleLabel(key),
      href: "/app/m/assessment",
      icon: moduleIcon(key),
      children: ASSESSMENT_SECTIONS.map((s) => ({
        label: s.label,
        href: s.href,
        icon: s.icon,
        exact: s.exact,
      })),
    };
  }
  return {
    label: moduleLabel(key),
    href: `/app/m/${key}`,
    icon: moduleIcon(key),
  };
}

/** Build grouped sidebar navigation from the user's subscribed modules (§7.2). */
export function buildTenantNavGroups(user: TenantNavUser): NavGroup[] {
  if (user.role === "parent") {
    return buildParentNavGroups(user);
  }

  const groups: NavGroup[] = [
    {
      items: [{ label: "Dashboard", href: "/app", icon: "home", exact: true }],
    },
  ];

  const subscribed = sortModulesByCatalog(
    user.modules.filter((m) => m !== "core" && roleCanAccessModule(user.role, m)),
  );

  for (const category of CATEGORY_ORDER) {
    const items = subscribed
      .filter((key) => MODULE_CATEGORY[key] === category)
      .map(moduleNavItem);

    if (items.length > 0) {
      groups.push({ label: CATEGORY_LABELS[category], items });
    }
  }

  if (user.role === "school_admin") {
    groups.push({
      label: "Administration",
      items: [
        {
          label: "Settings",
          href: "/app/settings/profile",
          icon: "settings",
          children: SETTINGS_SECTIONS.map((section) => ({
            label: section.label,
            href: section.href,
            icon: section.icon,
            badge: section.implemented ? undefined : "Soon",
          })),
        },
      ],
    });
  }

  return groups;
}

export interface SettingsSection {
  key: string;
  label: string;
  href: string;
  icon: string;
  description: string;
  implemented: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    key: "profile",
    label: "School profile",
    href: "/app/settings/profile",
    icon: "building2",
    description: "Name, motto, head teacher, and contact details.",
    implemented: true,
  },
  {
    key: "users",
    label: "User management",
    href: "/app/settings/users",
    icon: "users",
    description: "Portal accounts, roles, and access for staff.",
    implemented: true,
  },
  {
    key: "subjects",
    label: "Subjects",
    href: "/app/settings/subjects",
    icon: "book",
    description: "Subject catalogue and NCDC curriculum mapping.",
    implemented: true,
  },
  {
    key: "grading",
    label: "Grading",
    href: "/app/settings/grading",
    icon: "clipboard",
    description: "PLE grade ranges per subject and aggregate divisions.",
    implemented: true,
  },
  {
    key: "report-cards",
    label: "Report cards",
    href: "/app/settings/report-cards",
    icon: "book",
    description: "Layout template, sections, and document title for printed reports.",
    implemented: true,
  },
  {
    key: "academic-year",
    label: "Academic year",
    href: "/app/settings/academic-year",
    icon: "calendar",
    description: "Terms, holidays, and the active academic calendar.",
    implemented: true,
  },
  {
    key: "circulars",
    label: "Circulars",
    href: "/app/settings/circulars",
    icon: "chat",
    description: "Parent notices — fees, events, closures, and school updates.",
    implemented: true,
  },
  {
    key: "term-registration",
    label: "Term registration",
    href: "/app/settings/term-registration",
    icon: "clipboard",
    description: "Sections and requirements checked when learners return each term.",
    implemented: true,
  },
  {
    key: "modules",
    label: "Modules",
    href: "/app/settings/modules",
    icon: "grid",
    description: "Your school's active module subscriptions.",
    implemented: true,
  },
];
