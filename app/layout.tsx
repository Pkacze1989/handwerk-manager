import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: { default: "Werkplan", template: "%s · Werkplan" },
  description: "All-in-One für den Handwerksalltag, vom Erstkontakt bis zur Abrechnung.",
  applicationName: "Werkplan",
};

export const viewport: Viewport = {
  themeColor: "#1e4638",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${sans.variable} ${serif.variable} bg-paper font-sans text-ink antialiased`}>{children}</body>
    </html>
  );
}
