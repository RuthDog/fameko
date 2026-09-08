import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Fameko",
  title: "Fameko – Hela hushållets ekonomi, äntligen begriplig",
  description:
    "Planera året, förstå sambanden och samla hushållets ekonomi i ett tydligt underlag för framtidens beslut.",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/icons/favicon-48.png",
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/manifest.webmanifest",
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
