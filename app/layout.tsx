import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Poll - 매일 하나씩 가벼운 설문조사",
  description: "매일 새로운 설문조사를 통해 의견을 나누세요!",
  keywords: "설문조사, poll, 투표, survey",
  authors: [{ name: "Poll Team" }],
  openGraph: {
    title: "Poll",
    description: "매일 하나씩 가벼운 설문조사",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
