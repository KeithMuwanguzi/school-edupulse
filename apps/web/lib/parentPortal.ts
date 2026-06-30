/** Parent Portal module key and subscription helpers. */

export const PARENTS_PORTAL_MODULE = "parents_portal";

export const PARENTS_PORTAL_PRICE_UGX = 1_350_000;

export function schoolHasParentsPortal(modules: string[] | undefined): boolean {
  return modules?.includes(PARENTS_PORTAL_MODULE) ?? false;
}

/** Parent-facing feature slices — each also needs its own module where noted. */
export function parentHasFeature(
  modules: string[] | undefined,
  feature: "reportcards" | "finance" | "attendance" | "communication",
): boolean {
  if (!schoolHasParentsPortal(modules)) return false;
  return modules?.includes(feature) ?? false;
}

export const PARENT_PORTAL_UPSELL =
  "Subscribe to the Parent Portal module (UGX 1,350,000 per term) under Settings → Modules to create guardian logins and enable the parent portal.";
