/** Which roles may see a module in the sidebar and open its pages. */

import { PARENTS_PORTAL_MODULE, schoolHasParentsPortal } from "@/lib/parentPortal";

const MODULE_READ_ROLES: Partial<Record<string, readonly string[]>> = {
  finance: ["school_admin", "bursar"],
  hostel: ["school_admin", "deputy_head", "bursar"],
  hr_payroll: ["school_admin", "deputy_head", "teacher", "bursar"],
};

/** Parent logins only see feature modules when the school subscribed to Parent Portal. */
const PARENT_FEATURE_MODULES = new Set(["communication", "reportcards", "finance", "attendance"]);

export function roleCanAccessModule(role: string | undefined, moduleKey: string): boolean {
  if (!role) return false;
  if (role === "parent") {
    if (moduleKey === PARENTS_PORTAL_MODULE) return false;
    return PARENT_FEATURE_MODULES.has(moduleKey);
  }
  const allowed = MODULE_READ_ROLES[moduleKey];
  if (!allowed) return true;
  return allowed.includes(role);
}

export { schoolHasParentsPortal, PARENTS_PORTAL_MODULE };

export function roleHasAny(role: string | undefined, ...roles: string[]): boolean {
  if (!role) return false;
  return roles.includes(role);
}

export const FINANCE_ROLES = ["school_admin", "bursar"] as const;
export const HR_PAYROLL_ROLES = ["school_admin", "bursar"] as const;
export const HR_PAYROLL_ADMIN_ROLES = ["school_admin"] as const;
export const HR_STAFF_SELF_SERVICE_ROLES = ["school_admin", "deputy_head", "teacher", "bursar"] as const;
export const HOSTEL_READ_ROLES = ["school_admin", "deputy_head", "bursar"] as const;
export const HOSTEL_WRITE_ROLES = ["school_admin", "deputy_head"] as const;
