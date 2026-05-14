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
import { useState } from "react"
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

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-14 border-b border-sidebar-border px-3",
        collapsed ? "justify-center" : "gap-2 px-4"
      )}>
        <TrendingUp className="h-5 w-5 text-sidebar-primary shrink-0" />
        {!collapsed && (
          <span className="font-semibold text-sm text-sidebar-foreground tracking-tight">
            Bourse
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
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
                        "flex items-center justify-center h-9 w-9 mx-auto rounded-md transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
                "flex items-center gap-3 h-9 px-3 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2 space-y-0.5">
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center h-9 w-full rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
            collapsed ? "justify-center" : "gap-3 px-3"
          )}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <><ChevronLeft className="h-4 w-4" /><span>Réduire</span></>
          }
        </button>

        {/* Logout */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center justify-center h-9 w-9 mx-auto rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
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
            className="flex items-center gap-3 h-9 w-full px-3 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        )}
      </div>
    </aside>
  )
}
