import type { Metadata, Viewport } from "next";
import { SwRegister } from "./sw-register";

export const metadata: Metadata = {
  title: "NRC Cockpit",
  description: "NoRepairCost owner cockpit — private.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Cockpit" },
  icons: { apple: "/apple-touch-icon.png", icon: "/icon-192.png" },
  // Legacy iOS standalone flag (Next emits only the modern mobile-web-app-capable).
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0B0D0C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0B0D0C" }}>
      {children}
      <SwRegister />
    </div>
  );
}
