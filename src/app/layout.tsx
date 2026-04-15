import type { Metadata } from "next";

import { SessionProvider } from "@/components/SessionProvider";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artisan - AI Craftsman",
  description: "Artisan - 技艺精湛的 AI 工匠，具备文件操作、命令执行、网络搜索和技能系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-slate-50 h-screen w-screen overflow-hidden">
        <ToastProvider>
          <ConfirmProvider>
            <SessionProvider>
              {children}
            </SessionProvider>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
