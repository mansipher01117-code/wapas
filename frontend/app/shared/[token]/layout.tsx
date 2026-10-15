import type { Metadata } from "next";

// A shared report is private to whoever holds the link: keep it out of search results.
export const metadata: Metadata = {
  robots: "noindex",
};

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
