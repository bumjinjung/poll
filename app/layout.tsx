import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
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
    title: "Poll - 매일 하나씩 가벼운 설문조사",
    description: "매일 새로운 설문조사를 통해 의견을 나누세요!",
    type: "website",
    locale: "ko_KR",
    siteName: "Poll",
  },
  twitter: {
    card: "summary_large_image",
    title: "Poll - 매일 하나씩 가벼운 설문조사",
    description: "매일 새로운 설문조사를 통해 의견을 나누세요!",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false as const,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <Script id="bootstrap-uservote" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var voted = false;
                // 1) 쿠키에 user id가 있으면 투표한 것으로 간주
                if (document.cookie.indexOf('poll_user_id=') !== -1) voted = true;

                // 2) 폴백: 최신 설문 로컬키
                if (!voted) {
                  try {
                    voted = localStorage.getItem('poll:voted:latest') === '1';
                  } catch (e) {}
                }

                // 3) 전역 힌트 + HTML data-attr
                window.__POLL_VOTED__ = !!voted;
                if (voted) document.documentElement.setAttribute('data-poll-voted','1');
              } catch (e) {}
            })();
          `}
        </Script>

        {/* 선택지 블록을 '투표자'에겐 첫 페인트부터 숨김 */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html[data-poll-voted="1"] .poll-choices-initial { display: none !important; }
            `,
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
