"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SchoolBadge } from "@/components/domain/school/SchoolBadge";
import { Icon } from "@/components/ui/Icon";
import { TopNavbar, type TopBarPill } from "@/components/layout/TopNavbar";
import { cn } from "@/lib/cn";
import { resolvePageMeta } from "@/lib/pageMeta";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  exact?: boolean;
  badge?: string;
  children?: NavItem[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface AppShellProps {
  brand: string;
  brandSubtitle?: string;
  brandLogoUrl?: string | null;
  homeHref?: string;
  navGroups: NavGroup[];
  userName: string;
  userRole: string;
  onLogout: () => void;
  topBarPills?: TopBarPill[];
  children: React.ReactNode;
}

const COLLAPSE_KEY = "sp.sidebar.collapsed";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/schools");
  }
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function itemOrChildActive(pathname: string, item: NavItem): boolean {
  if (item.children?.length) {
    return item.children.some((child) => isNavItemActive(pathname, child));
  }
  return isNavItemActive(pathname, item);
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] transition-all duration-150",
        active
          ? "bg-brand-600 text-white shadow-sm shadow-brand-700/25"
          : "bg-slate-100/80 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-700",
      )}
    >
      <Icon name={name} size={14} />
    </span>
  );
}

function NavBadge({ label }: { label: string }) {
  return (
    <span className="ml-auto shrink-0 rounded-full bg-gold-50 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-gold-700 ring-1 ring-gold-200/70">
      {label}
    </span>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  nested,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const active = isNavItemActive(pathname, item);

  if (nested) {
    return (
      <Link
        href={item.href}
        title={item.label}
        onClick={onNavigate}
        className={cn(
          "group relative flex items-center gap-2 rounded-md py-1 pl-3 pr-1.5 text-[11px] font-medium transition-all duration-150",
          active
            ? "bg-brand-50 text-brand-800"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full transition-colors",
            active ? "bg-brand-500" : "bg-transparent group-hover:bg-slate-300",
          )}
        />
        <span className="truncate">{item.label}</span>
        {item.badge && <NavBadge label={item.badge} />}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      title={item.label}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all duration-150",
        collapsed && "sm:justify-center sm:px-0",
        active
          ? "bg-brand-50 text-brand-900 ring-1 ring-brand-100"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      <NavIcon name={item.icon} active={active} />
      <span className={cn("truncate text-[11.5px] font-medium", collapsed && "sm:hidden")}>
        {item.label}
      </span>
      {item.badge && (
        <span className={cn("ml-auto", collapsed && "sm:hidden")}>
          <NavBadge label={item.badge} />
        </span>
      )}
    </Link>
  );
}

function NavExpandable({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const children = item.children ?? [];
  const branchActive = itemOrChildActive(pathname, item);
  const [open, setOpen] = useState(branchActive);
  const collapsedHref = children[0]?.href ?? item.href;

  useEffect(() => {
    if (branchActive) setOpen(true);
  }, [branchActive, pathname]);

  return (
    <>
      {/* Collapsed (desktop icon rail): behave as a link to the first child. */}
      <Link
        href={collapsedHref}
        title={item.label}
        onClick={onNavigate}
        className={cn(
          "group relative hidden items-center justify-center rounded-lg py-1.5",
          collapsed ? "sm:flex" : "sm:hidden",
          branchActive ? "bg-brand-50 ring-1 ring-brand-100" : "hover:bg-slate-50",
        )}
      >
        <NavIcon name={item.icon} active={branchActive} />
      </Link>

      {/* Expanded: accordion with children. */}
      <div className={cn(collapsed && "sm:hidden")}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            "group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-all duration-150",
            branchActive
              ? "bg-brand-50 text-brand-900 ring-1 ring-brand-100"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
          )}
        >
          <NavIcon name={item.icon} active={branchActive} />
          <span className="flex-1 truncate text-[11.5px] font-medium">{item.label}</span>
          <Icon
            name="chevron-down"
            size={12}
            className={cn(
              "shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-600",
              open && "rotate-180",
            )}
          />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-80",
          )}
        >
          <div className="overflow-hidden">
            <ul className="relative mt-0.5 space-y-px pl-3.5 before:absolute before:bottom-1 before:left-[9px] before:top-1 before:w-px before:bg-gradient-to-b before:from-slate-200 before:via-slate-100 before:to-transparent">
              {children.map((child) => (
                <li key={child.href} className="pl-2">
                  <NavLink
                    item={child}
                    pathname={pathname}
                    collapsed={false}
                    nested
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export function AppShell({
  brand,
  brandSubtitle = "SkulPulse",
  brandLogoUrl,
  homeHref = "/app",
  navGroups,
  userName,
  userRole,
  onLogout,
  topBarPills,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const pageMeta = resolvePageMeta(pathname, homeHref);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50">
      {/* Mobile backdrop */}
      <div
        aria-hidden
        onClick={closeMobile}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] transition-opacity duration-200 sm:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "app-sidebar fixed inset-y-0 left-0 z-50 flex h-full w-[16rem] flex-col transition-transform duration-300 ease-out sm:static sm:z-auto sm:translate-x-0 sm:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "sm:w-[4.25rem]" : "sm:w-[14.5rem]",
        )}
      >
        {/* Brand */}
        <div className="relative shrink-0 border-b border-slate-100 px-3 py-3">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-brand-50/80 to-transparent"
          />
          <div className={cn("relative flex items-center gap-2.5", collapsed && "sm:justify-center")}>
            <div className="relative shrink-0">
              <SchoolBadge name={brand} badgeUrl={brandLogoUrl} size="sm" />
            </div>
            <div className={cn("min-w-0 flex-1", collapsed && "sm:hidden")}>
              <p className="truncate font-display text-[13px] font-medium leading-tight tracking-tight text-slate-900">
                {brand}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                {brandSubtitle}
              </p>
            </div>
            {/* Mobile close */}
            <button
              type="button"
              onClick={closeMobile}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:hidden"
              aria-label="Close menu"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="app-sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2.5">
          {navGroups.map((group, gi) => (
            <div key={group.label ?? `group-${gi}`} className={cn(gi > 0 && "mt-2.5")}>
              {group.label && (
                <div
                  className={cn(
                    "mb-1 flex items-center gap-2 px-2",
                    collapsed && "sm:justify-center sm:px-0",
                  )}
                >
                  <p
                    className={cn(
                      "shrink-0 text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400",
                      collapsed && "sm:hidden",
                    )}
                  >
                    {group.label}
                  </p>
                  <div
                    className={cn(
                      "h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent",
                      collapsed ? "sm:w-5 sm:flex-none sm:from-slate-200 sm:to-slate-200" : "",
                    )}
                  />
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href + item.label}>
                    {item.children?.length ? (
                      <NavExpandable
                        item={item}
                        pathname={pathname}
                        collapsed={collapsed}
                        onNavigate={closeMobile}
                      />
                    ) : (
                      <NavLink
                        item={item}
                        pathname={pathname}
                        collapsed={collapsed}
                        onNavigate={closeMobile}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden shrink-0 px-2 sm:block">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700",
              collapsed && "justify-center px-0",
            )}
          >
            <Icon
              name="chevron-right"
              size={14}
              className={cn("shrink-0 transition-transform duration-200", !collapsed && "rotate-180")}
            />
            <span className={cn("text-[10.5px] font-medium", collapsed && "hidden")}>Collapse</span>
          </button>
        </div>

        {/* User */}
        <div className="shrink-0 p-2.5">
          <div
            className={cn(
              "rounded-[10px] border border-slate-200/80 bg-slate-50/80 p-2",
              collapsed && "sm:border-transparent sm:bg-transparent sm:p-0",
            )}
          >
            <div className={cn("flex items-center gap-2", collapsed && "sm:justify-center")}>
              <div className="relative shrink-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-white text-[9px] font-semibold text-slate-700 ring-1 ring-slate-200">
                  {initials(userName)}
                </div>
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white bg-brand-500"
                />
              </div>
              <div className={cn("min-w-0 flex-1", collapsed && "sm:hidden")}>
                <p className="truncate text-[11px] font-medium leading-tight text-slate-900">
                  {userName}
                </p>
                <p className="truncate text-[9px] capitalize leading-tight text-slate-500">
                  {userRole}
                </p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-slate-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600",
                  collapsed && "sm:hidden",
                )}
              >
                <Icon name="logout" size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
        <TopNavbar
          breadcrumbs={pageMeta.breadcrumbs}
          title={pageMeta.title}
          userName={userName}
          userRole={userRole}
          pills={topBarPills}
          onMenu={() => setMobileOpen(true)}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
