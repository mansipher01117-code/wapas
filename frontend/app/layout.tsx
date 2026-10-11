import type { Metadata, Viewport } from "next";
import { InkFilters } from "@/components/Stamp";
import "@fontsource-variable/anybody/wdth.css";
import "@fontsource/hind/400.css";
import "@fontsource/hind/500.css";
import "@fontsource/hind/600.css";
import "@fontsource/hind/700.css";
import "@fontsource/caveat/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wapas: get your deposit back",
  description:
    "Record your room at move-in, get your landlord's sign-off on WhatsApp, and let AI show what was already broken at move-out.",
};

export const viewport: Viewport = {
  themeColor: "#dce8d3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <InkFilters />
        {children}
      </body>
    </html>
  );
}
