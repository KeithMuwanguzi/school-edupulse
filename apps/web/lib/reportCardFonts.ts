import { Source_Sans_3, Source_Serif_4 } from "next/font/google";

export const reportSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-report-serif",
  display: "swap",
});

export const reportSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-report-sans",
  display: "swap",
});

export const reportCardFontClassName = `${reportSerif.variable} ${reportSans.variable} report-card-font-scope`;
