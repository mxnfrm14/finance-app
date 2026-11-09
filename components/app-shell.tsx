"use client"

import { useState } from "react"
import Link from "next/link"
import Form from "next/form"
import { usePathname } from "next/navigation"
import { ChevronRight, Menu, Search, Settings2, ArrowUpRight, House } from "lucide-react"
import { NavSidebar } from "@/components/nav-sidebar"
import { useLanguage } from "@/lib/i18n/context"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AppShell({
  children,
  userRole,
  userName,
  userEmail
}: {
  children: React.ReactNode
  userRole?: string
  userName?: string | null
  userEmail?: string | null
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { t, language } = useLanguage()
  const fr = language === "fr"
  const route = pathname.split("/")[1] as keyof typeof t.nav
  const initials = (userName || userEmail || "B")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-primary px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {fr ? "Aller au contenu" : "Skip to content"}
      </a>
      <div className="hidden shrink-0 md:block">
        <NavSidebar
          userRole={userRole}
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b bg-card px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
              <DialogTrigger
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}
                aria-label={fr ? "Ouvrir la navigation" : "Open navigation"}
              >
                <Menu className="size-5" />
              </DialogTrigger>
              <DialogContent
                className="inset-y-0 left-0 h-dvh w-[280px] max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-0 p-0 sm:max-w-[280px]"
                aria-describedby={undefined}
              >
                <DialogTitle className="sr-only">Navigation</DialogTitle>
                <NavSidebar
                  userRole={userRole}
                  onNavigate={() => setMobileOpen(false)}
                  className="w-full border-0"
                />
              </DialogContent>
            </Dialog>
            <Link
              href="/dashboard"
              className="hidden text-muted-foreground transition-colors hover:text-primary sm:block"
              aria-label={t.nav.dashboard}
            >
              <House className="size-4" strokeWidth={1.6} />
            </Link>
            <ChevronRight className="hidden size-3 text-muted-foreground/60 sm:block" />
            <span className="truncate text-[13px] font-medium">
              {t.nav[route] ?? t.nav.dashboard}
            </span>
            {pathname.split("/")[2] && (
              <>
                <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground">
                  {decodeURIComponent(pathname.split("/")[2])}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2.5 sm:gap-4">
            <Form
              action="/market"
              role="search"
              className="hidden items-center gap-2 rounded-xl border bg-background/40 px-3.5 transition-colors focus-within:border-ring lg:flex"
            >
              <Search className="size-4 text-muted-foreground" strokeWidth={1.7} />
              <input
                aria-label={t.market.search}
                name="q"
                placeholder={fr ? "Rechercher un instrument…" : "Search an instrument…"}
                className="h-10 w-52 bg-transparent text-xs outline-none placeholder:text-muted-foreground focus-visible:outline-none"
              />
              <button
                type="submit"
                aria-label={fr ? "Rechercher" : "Search"}
                className="rounded p-1 text-muted-foreground hover:text-primary"
              >
                <ArrowUpRight className="size-3.5" />
              </button>
            </Form>
            <Link
              href="/market"
              aria-label={t.market.search}
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "lg:hidden")}
            >
              <Search className="size-4" />
            </Link>
            <Link
              href="/settings"
              aria-label={t.nav.settings}
              className={cn(
                buttonVariants({ variant: "outline", size: "icon" }),
                "hidden rounded-full sm:inline-flex"
              )}
            >
              <Settings2 className="size-4" strokeWidth={1.6} />
            </Link>
            <span className="hidden h-7 border-l sm:block" />
            <Link
              href="/settings"
              aria-label={`${t.nav.settings} — ${userName || userEmail || "Bourse"}`}
              className="flex items-center gap-2.5 rounded-lg"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </span>
              <span className="hidden max-w-32 xl:block">
                <span className="block truncate text-xs font-medium">
                  {userName || (fr ? "Mon compte" : "My account")}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {fr ? "Espace personnel" : "Personal account"}
                </span>
              </span>
            </Link>
          </div>
        </header>
        <div
          id="main-content"
          tabIndex={-1}
          className="app-content min-h-0 flex-1 overflow-y-auto outline-none"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
