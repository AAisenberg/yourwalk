import type { Metadata } from "next";

import { CouncilDashboard } from "@/components/dashboard/CouncilDashboard";

/**
 * Council insights D1 (docs/DASHBOARD.md). Local and preview only until the
 * access method (DB-1) is chosen; src/proxy.ts keeps it off the public hosts.
 */
export const metadata: Metadata = {
  title: "YourWalk Council insights · City of Casey",
  description: "Day and Night walking conditions on Casey footpaths, for Council staff.",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <CouncilDashboard />;
}
