import type { Metadata } from "next";
import VersionFooter from "@/components/version-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "PostBack",
  description: "ShanghaiTech明信片互助站",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        {children}
        <VersionFooter />
      </body>
    </html>
  );
}
