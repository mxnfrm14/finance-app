import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"
import { LanguageProvider } from "@/lib/i18n/context"
import type { Language } from "@/lib/i18n/translations"
import { TooltipProvider } from "@/components/ui/tooltip"
import { auth } from "@/auth"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Bourse — Suivi d'investissements",
  description: "Suivi de portfolio et analyse de marché par IA",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Récupérer la langue depuis la session — évite le hydration mismatch
  const session = await auth()
  const lang = ((session?.user as { language?: string })?.language ?? "fr") as Language

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LanguageProvider initialLanguage={lang}>
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <Toaster richColors position="top-right" />
        </LanguageProvider>
      </body>
    </html>
  )
}
