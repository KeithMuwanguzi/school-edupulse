import { reportCardFontClassName } from "@/lib/reportCardFonts";

export default function ReportCardsModuleLayout({ children }: { children: React.ReactNode }) {
  return <div className={reportCardFontClassName}>{children}</div>;
}
