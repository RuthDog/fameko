import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fameko",
  description: "Hushållsekonomi på ett enklare sätt.",
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
