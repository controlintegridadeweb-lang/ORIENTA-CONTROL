import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/shared/ui/components/toaster";
import { ConfirmProvider } from "@/shared/ui/components/confirm-dialog";

export const metadata: Metadata = {
  title: "Plataforma Orienta V1",
  description: "Diagnóstico, recomendações, plano de ação e Resultado FAMI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full min-w-0 flex-col font-sans font-normal"
        suppressHydrationWarning
      >
        <ConfirmProvider>{children}</ConfirmProvider>
        <Toaster />
      </body>
    </html>
  );
}
