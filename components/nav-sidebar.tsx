"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Bot,
  TrendingUp,
  BarChart3,
  Bookmark,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/context"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface NavItem {
  href: string
  icon: React.ElementType
  labelKey: keyof ReturnType<typeof useLanguage>["t"]["nav"]
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",  icon: LayoutDashboard,  labelKey: "dashboard" },
  { href: "/portfolio",  icon: BriefcaseBusiness, labelKey: "portfolio" },
  { href: "/agent",      icon: Bot,               labelKey: "agent" },
  { href: "/market",     icon: TrendingUp,        labelKey: "market" },
  { href: "/analytics",  icon: BarChart3,         labelKey: "analytics" },
  { href: "/watchlist",  icon: Bookmark,          labelKey: "watchlist" },
  { href: "/settings",   icon: Settings,          labelKey: "settings" },
  { href: "/admin",      icon: ShieldCheck,       labelKey: "admin", adminOnly: true },
]

interface NavSidebarProps {
  userRole?: string
}

export function NavSidebar({ userRole }: NavSidebarProps) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || userRole === "admin"
  )

  // Update the main content margin when sidebar collapses
  useEffect(() => {
    const main = document.querySelector('main')
    if (main) {
      main.style.marginLeft = collapsed ? '4.25rem' : '15rem'
    }
  }, [collapsed])

  return (
    <aside
      className={cn(
        "surface-card fixed left-0 top-0 flex h-screen flex-col transition-all duration-200 z-50",
        collapsed ? "w-[4.25rem]" : "w-60"
      )}
    >
      <div className={cn(
        "flex items-center gap-3 border-b border-border/70 px-4 py-4",
        collapsed ? "justify-center px-2" : "justify-start"
      )}>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10">
          <TrendingUp className="h-5 w-5 shrink-0" />
        </div>
        {!collapsed && (
          <div>
            <span className="block text-sm font-semibold tracking-tight text-foreground">Bourse</span>
            <span className="block text-xs text-muted-foreground">Suivi & analyse</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href)
          const label = t.nav[item.labelKey]

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      className={cn(
                        "mx-auto flex h-10 w-10 items-center justify-center rounded-2xl transition-all",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    />
                  }
                >
                  <item.icon className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-2xl px-3 text-sm transition-all",
                active
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-2 border-t border-border/70 p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex h-10 w-full items-center rounded-2xl text-sm transition-all hover:bg-muted",
            collapsed ? "justify-center" : "gap-3 px-3 text-muted-foreground hover:text-foreground"
          )}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <><ChevronLeft className="h-4 w-4" /><span>Réduire</span></>
          }
        </button>

        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                />
              }
            >
              <LogOut className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="right">Déconnexion</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex h-10 w-full items-center gap-3 rounded-2xl px-3 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        )}
      </div>
    </aside>
  )
}
