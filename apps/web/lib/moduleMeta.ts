// Display labels, categories, and sidebar order for module keys (§7.2).

export const MODULE_LABELS: Record<string, string> = {
  core: "Core",
  students: "Students",
  teachers: "Teachers & Staff",
  academics: "Academics",
  assessment: "Assessment",
  attendance: "Attendance",
  reportcards: "Report Cards",
  finance: "Finance & Fees",
  communication: "Communication",
  admissions: "Admissions",
  timetable: "Timetable",
  moes_reporting: "MoES Reporting",
  ai_analytics: "AI Analytics",
  library: "Library",
  transport: "Transport",
  hostel: "Boarding & Hostel",
  hr_payroll: "HR & Payroll",
  inventory: "Inventory",
};

export const MODULE_CATEGORY: Record<string, string> = {
  core: "base",
  students: "academic",
  teachers: "academic",
  academics: "academic",
  assessment: "academic",
  attendance: "academic",
  reportcards: "operations",
  finance: "operations",
  communication: "operations",
  admissions: "operations",
  timetable: "operations",
  moes_reporting: "operations",
  ai_analytics: "intelligence",
  library: "addon",
  transport: "addon",
  hostel: "addon",
  hr_payroll: "addon",
  inventory: "addon",
};

/** Catalog order — used for consistent sidebar and picker ordering. */
export const MODULE_CATALOG_ORDER: string[] = [
  "core",
  "students",
  "teachers",
  "academics",
  "assessment",
  "attendance",
  "reportcards",
  "finance",
  "communication",
  "admissions",
  "timetable",
  "moes_reporting",
  "ai_analytics",
  "library",
  "transport",
  "hostel",
  "hr_payroll",
  "inventory",
];

export const CATEGORY_ORDER = ["academic", "operations", "intelligence", "addon"] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  base: "Core",
  academic: "Academic",
  operations: "Operations",
  intelligence: "Intelligence",
  addon: "Add-ons",
};

export function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key;
}

export const MODULE_ICONS: Record<string, string> = {
  core: "home",
  students: "users",
  teachers: "user",
  academics: "book",
  assessment: "clipboard",
  attendance: "check",
  reportcards: "book",
  finance: "wallet",
  communication: "chat",
  admissions: "clipboard",
  timetable: "calendar",
  moes_reporting: "chart",
  ai_analytics: "sparkles",
  library: "book",
  transport: "truck",
  hostel: "bed",
  hr_payroll: "users",
  inventory: "box",
};

export function moduleIcon(key: string): string {
  return MODULE_ICONS[key] ?? "grid";
}

export function sortModulesByCatalog(keys: string[]): string[] {
  const order = new Map(MODULE_CATALOG_ORDER.map((k, i) => [k, i]));
  return [...keys].sort(
    (a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999),
  );
}
