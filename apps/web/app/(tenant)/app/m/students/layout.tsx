"use client";

import { usePathname } from "next/navigation";
import { StudentsModuleShell, studentsShellHidden } from "@/components/domain/students/StudentsModuleShell";

export default function StudentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (studentsShellHidden(pathname)) return <>{children}</>;
  return <StudentsModuleShell>{children}</StudentsModuleShell>;
}
