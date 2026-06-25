import type { Metadata } from "next";
import { PlatformLoginScreen } from "@/components/auth/PlatformLoginScreen";

export const metadata: Metadata = {
  title: "Platform console — SkulPulse",
  robots: { index: false, follow: false },
};

export default function PlatformSignInPage() {
  return <PlatformLoginScreen />;
}
