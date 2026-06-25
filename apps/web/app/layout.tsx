import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "@/store/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// Warm, characterful display face — used sparingly for the wordmark and headings.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "SkulPulse Uganda",
  description: "Modular school administration for Ugandan primary schools.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-UG" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
