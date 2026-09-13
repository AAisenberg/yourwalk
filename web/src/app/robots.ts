import type { MetadataRoute } from "next";

/** Lean floor per docs/FRONT_DOOR.md § Metadata and sharing. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://yourwalk.au/sitemap.xml",
  };
}
