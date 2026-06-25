import { moduleLabel } from "@/lib/moduleMeta";
import { SETTINGS_SECTIONS } from "@/lib/tenantNav";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageMeta {
  breadcrumbs: Breadcrumb[];
  title: string;
}

/** Derive navbar title + breadcrumbs from the current route. */
export function resolvePageMeta(pathname: string, homeHref = "/app"): PageMeta {
  if (pathname === homeHref || pathname === `${homeHref}/`) {
    const label = homeHref.startsWith("/admin") ? "Schools" : "Dashboard";
    return { breadcrumbs: [{ label }], title: label };
  }

  if (pathname.startsWith("/app/m/students")) {
    const parts = pathname.split("/");
    const seg = parts[4] ?? "";
    const isProfile = /^[0-9a-f-]{36}$/i.test(seg);
    const isRegDetail = seg === "registration" && Boolean(parts[5]);

    let label = "Roster";
    const crumbs: Breadcrumb[] = [
      { label: "Dashboard", href: "/app" },
      { label: "Students", href: "/app/m/students" },
    ];

    if (seg === "enroll" || seg === "onboarding") {
      label = "Enroll student";
      crumbs.push({ label });
    } else if (seg === "term") {
      label = "Term check-in";
      crumbs.push({ label });
    } else if (isRegDetail) {
      label = "Check-in detail";
      crumbs.push({ label: "Term check-in", href: "/app/m/students/term" }, { label: "Detail" });
    } else if (seg === "discipline") {
      label = "Discipline";
      crumbs.push({ label });
    } else if (isProfile) {
      label = "Profile";
      crumbs.push({ label });
    }

    return {
      breadcrumbs: crumbs,
      title: label === "Roster" ? "Students" : label,
    };
  }

  if (pathname.startsWith("/app/m/admissions")) {
    const seg = pathname.split("/")[4] ?? "";
    let label = "Pipeline";
    if (seg === "new") label = "New application";
    else if (seg === "enroll") label = "Enroll applicant";
    return {
      breadcrumbs: [
        { label: "Dashboard", href: "/app" },
        { label: "Admissions", href: "/app/m/admissions" },
        ...(seg === "enroll"
          ? [
              { label: "Pipeline", href: "/app/m/admissions" },
              { label: "Enroll" },
            ]
          : [{ label }]),
      ],
      title: label === "Pipeline" ? "Admissions" : label,
    };
  }

  if (pathname.startsWith("/app/m/finance")) {
    const seg = pathname.split("/")[4] ?? "";
    const label = seg === "structures" ? "Fee structures" : "Accounts";
    return {
      breadcrumbs: [
        { label: "Dashboard", href: "/app" },
        { label: "Finance", href: "/app/m/finance" },
        ...(seg === "structures" ? [{ label: "Fee structures" }] : [{ label: "Accounts" }]),
      ],
      title: label === "Accounts" ? "Finance" : label,
    };
  }

  if (pathname.startsWith("/app/m/")) {
    const moduleKey = pathname.split("/")[3] ?? "";
    const label = moduleLabel(moduleKey);
    return {
      breadcrumbs: [
        { label: "Dashboard", href: "/app" },
        { label },
      ],
      title: label,
    };
  }

  if (pathname.startsWith("/app/settings")) {
    const section =
      SETTINGS_SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`)) ??
      SETTINGS_SECTIONS[0];
    return {
      breadcrumbs: [
        { label: "Dashboard", href: "/app" },
        { label: "Settings", href: "/app/settings/profile" },
        { label: section.label },
      ],
      title: section.label,
    };
  }

  if (pathname === "/admin/logs") {
    return {
      breadcrumbs: [{ label: "Schools", href: "/admin" }, { label: "Logs" }],
      title: "Logs",
    };
  }

  if (pathname === "/admin/schools/new") {
    return {
      breadcrumbs: [{ label: "Schools", href: "/admin" }, { label: "Onboard school" }],
      title: "Onboard school",
    };
  }

  if (pathname.startsWith("/admin/schools/")) {
    return {
      breadcrumbs: [{ label: "Schools", href: "/admin" }, { label: "School details" }],
      title: "School details",
    };
  }

  if (pathname.startsWith("/admin")) {
    return { breadcrumbs: [{ label: "Schools" }], title: "Schools" };
  }

  return { breadcrumbs: [{ label: "SkulPulse" }], title: "SkulPulse" };
}
