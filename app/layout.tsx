import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fameko",
  description: "Beräknat saldo för kommande 12 månader.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
