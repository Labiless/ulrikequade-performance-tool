import type { Metadata } from "next";
import localFont from "next/font/local";
import FullscreenButton from "./FullscreenButton";
import "./globals.css";

// Ulrike Quade Company brand fonts (same files as ulrikequade.nl)
const pano = localFont({
  src: "./fonts/Pano-Bold.woff2",
  weight: "700",
  variable: "--font-heading",
  display: "swap",
});

const colroy = localFont({
  src: [
    { path: "./fonts/Colroy.woff2", style: "normal", weight: "400" },
    { path: "./fonts/Colroy-Italic.woff2", style: "italic", weight: "400" },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Performance Tool · Ulrike Quade Company",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${pano.variable} ${colroy.variable}`}>
      <body>
        {children}
        <FullscreenButton />
      </body>
    </html>
  );
}
