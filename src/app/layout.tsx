import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Material audiovisual y comercial de los proyectos inmobiliarios, siempre actualizado.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e2092d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={GeistSans.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
