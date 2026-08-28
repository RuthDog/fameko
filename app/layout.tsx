import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fameko – Familjens ekonomi, tydligt framåt",
  description: "Planera hela årets ekonomi på ett lugnt, enkelt och modernt sätt.",
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
