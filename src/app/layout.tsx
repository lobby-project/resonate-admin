import type { Metadata } from "next";
import { JetBrains_Mono, Inter, VT323 } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// Inter:新版深色仪表盘皮肤用(目前仅 Dashboard 样板页)。其余页仍用 mono。
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// VT323:点阵字,复刻自 C 端 resonate。仅用于 Events 卡片无海报时的占位首字母。
const pixel = VT323({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Resonate Console",
  description: "Resonate ticketing console",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${mono.variable} ${inter.variable} ${pixel.variable}`}>
      <body>{children}</body>
    </html>
  );
}
