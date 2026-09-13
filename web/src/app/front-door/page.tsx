import type { Metadata } from "next";

import { FrontDoorPage } from "@/components/front-door/FrontDoorPage";

/**
 * Public front door, served on yourwalk.au via host rewrite in src/proxy.ts
 * (docs/FRONT_DOOR.md, ADR-012, backlog X8). Holding phase: waitlist only.
 * No planner links.
 */

const DESCRIPTION =
  "YourWalk helps local residents find walking routes that fit what matters. " +
  "First pilot is in the City of Casey. Leave your email for updates.";

export const metadata: Metadata = {
  metadataBase: new URL("https://yourwalk.au"),
  title: "YourWalk: find your walk in Casey",
  description: DESCRIPTION,
  alternates: { canonical: "https://yourwalk.au" },
  openGraph: {
    title: "YourWalk: find your walk in Casey",
    description: DESCRIPTION,
    url: "https://yourwalk.au",
    siteName: "YourWalk",
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "YourWalk: find your walk in Casey",
    description: DESCRIPTION,
  },
};

export default function Page() {
  return <FrontDoorPage />;
}
