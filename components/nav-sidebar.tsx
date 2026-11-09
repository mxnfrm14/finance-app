"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Sparkles,
  TrendingUp,
  ChartNoAxesCombined,
  Bookmark,
  Settings2,
  ShieldCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/context"
import { BrandMark } from "@/components/brand-mark"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { href: "/portfolio", icon: BriefcaseBusiness, labelKey: "portfolio" },
  { href: "/market", icon: TrendingUp, labelKey: "market" },
  { href: "/watchlist", icon: Bookmark, labelKey: "watchlist" },
  { href: "/analytics", icon: ChartNoAxesCombined, labelKey: "analytics" },
  { href: "/agent", icon: Sparkles, labelKey: "agent" }
] as const

interface NavSidebarProps {
  userRole?: string
  collapsed?: boolean
  onToggle?: () => void
  onNavigate?: () => void
  className?: string
}

export function NavSidebar({
  userRole,
  collapsed = false,
  onToggle,
  onNavigate,
  className
}: NavSidebarProps) {
  const pathname = usePathname()
  const { t, language } = useLanguage()
  const fr = language === "fr"

  function navLink(href: string, Icon: React.ElementType, label: string) {
    const active = pathname === href || pathname.startsWith(`${href}/`)
    const link = (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
        className={cn(
          "group flex min-h-11 items-center rounded-xl text-[13px] font-medium transition-colors",
          collapsed ? "justify-center px-0" : "gap-3 px-3.5",
          active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2 : 1.7} />
        {!collapsed && (
          <>
            <span className="flex-1">{label}</span>
            {active && <span className="size-1.5 rounded-full bg-primary" />}
          </>
        )}
      </Link>
    )
    return collapsed ? (
      <Tooltip key={href}>
        <TooltipTrigger render={link} />
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : (
      <div key={href}>{link}</div>
    )
  }

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
        collapsed ? "w-[84px]" : "w-[228px]",
        className
      )}
    >
      <Link
        href="/dashboard"
        onClick={onNavigate}
        aria-label="Bourse"
        className={cn(
          "flex h-[84px] shrink-0 items-center",
          collapsed ? "justify-center" : "gap-3 px-6"
        )}
      >
        <BrandMark />
        {!collapsed && (
          <span className="text-xl font-semibold tracking-[-0.06em] text-foreground">
            bourse<span className="text-primary">.</span>
          </span>
        )}
      </Link>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
        <p
          className={cn(
            "mb-3 mt-6 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
            collapsed ? "text-center" : "px-3.5"
          )}
        >
          {collapsed ? "—" : fr ? "Espace personnel" : "Workspace"}
        </p>
        <nav aria-label={fr ? "Navigation principale" : "Main navigation"} className="space-y-1.5">
          {NAV_ITEMS.map((item) => navLink(item.href, item.icon, t.nav[item.labelKey]))}
        </nav>
        {!collapsed && (
          <div className="mb-5 mt-auto pt-10">
            <div className="rounded-2xl border border-primary/10 bg-linear-to-br from-primary/5 to-primary/[0.025] p-4">
              <Sparkles className="mb-3 size-5 text-primary" />
              <p className="text-xs font-semibold text-foreground">
                {fr ? "Un autre regard sur vos actifs" : "A fresh look at your assets"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {fr
                  ? "Explorez votre portefeuille avec votre assistant IA."
                  : "Explore your portfolio with your AI assistant."}
              </p>
              <Link
                href="/agent"
                onClick={onNavigate}
                className="mt-4 flex items-center justify-between text-xs font-medium text-primary"
              >
                {fr ? "Ouvrir l’assistant" : "Open assistant"}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>
        )}
        <nav aria-label={fr ? "Compte" : "Account"} className="mt-auto space-y-1 border-t py-4">
          {navLink("/settings", Settings2, t.nav.settings)}
          {userRole === "admin" && navLink("/admin", ShieldCheck, t.nav.admin)}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label={t.auth.logout}
            title={collapsed ? t.auth.logout : undefined}
            className={cn(
              "flex min-h-11 w-full items-center rounded-xl text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-loss hover:text-loss",
              collapsed ? "justify-center" : "gap-3 px-3.5"
            )}
          >
            <LogOut className="size-[18px]" strokeWidth={1.7} />
            {!collapsed && t.auth.logout}
          </button>
        </nav>
      </div>
      {onToggle && (
        <div className="border-t p-4">
          <button
            onClick={onToggle}
            aria-label={
              fr
                ? collapsed
                  ? "Développer la navigation"
                  : "Réduire la navigation"
                : collapsed
                  ? "Expand navigation"
                  : "Collapse navigation"
            }
            aria-expanded={!collapsed}
            className={cn(
              "flex h-9 w-full items-center rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed ? "justify-center" : "gap-3 px-3.5"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" />
                <span>{fr ? "Réduire le menu" : "Collapse menu"}</span>
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  )
}
