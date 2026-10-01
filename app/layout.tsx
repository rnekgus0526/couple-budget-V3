import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "태환 ❤️ 선영 커플 허브",
  description: "우리 둘만의 데이트 리스트와 추억 기록",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "커플 허브",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff7f8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
