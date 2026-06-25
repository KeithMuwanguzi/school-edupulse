/** Which roles may see a module in the sidebar and open its pages. */

const MODULE_READ_ROLES: Partial<Record<string, readonly string[]>> = {
  finance: ["school_admin", "bursar"],
  hostel: ["school_admin", "deputy_head", "bursar"],
};

export function roleCanAccessModule(role: string | undefined, moduleKey: string): boolean {
  if (!role) return false;
  const allowed = MODULE_READ_ROLES[moduleKey];
  if (!allowed) return true;
  return allowed.includes(role);
}

export function roleHasAny(role: string | undefined, ...roles: string[]): boolean {
  if (!role) return false;
  return roles.includes(role);
}

export const FINANCE_ROLES = ["school_admin", "bursar"] as const;
export const HOSTEL_READ_ROLES = ["school_admin", "deputy_head", "bursar"] as const;
export const HOSTEL_WRITE_ROLES = ["school_admin", "deputy_head"] as const;
