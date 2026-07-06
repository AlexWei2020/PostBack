import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PostBack · 明信片认领互助",
  description: "上传明信片、认领属于你的那一张，确认收到 —— GeekPie 明信片互助站",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
