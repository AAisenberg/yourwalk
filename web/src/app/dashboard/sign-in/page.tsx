import type { Metadata } from "next";

import { DashboardSignIn } from "@/components/dashboard/DashboardSignIn";

export const metadata: Metadata = {
  title: "Sign in · YourWalk Council insights",
  robots: { index: false, follow: false },
};

export default function DashboardSignInPage() {
  return <DashboardSignIn />;
}
