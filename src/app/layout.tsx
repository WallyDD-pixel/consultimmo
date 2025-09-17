import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Immo‑enchères",
    template: "%s | Immo‑enchères",
  },
  description: "Plateforme d’enchères immobilières en France.",
  metadataBase: new URL("https://immoencheres.com"),
  icons: {
  icon: "/logo.svg",
  shortcut: "/logo.svg",
  apple: "/logo.svg",
  },
  openGraph: {
    title: "Immo‑enchères",
    description: "Plateforme d’enchères immobilières en France.",
    url: "https://immoencheres.com",
    siteName: "Immo‑enchères",
    images: [
      {
        url: "/Consult-Immo_5.png",
        width: 512,
        height: 512,
        alt: "Immo‑enchères",
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Immo‑enchères",
    description: "Plateforme d’enchères immobilières en France.",
  images: ["/Consult-Immo_5.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
