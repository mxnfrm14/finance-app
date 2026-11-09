"use client"

import Link from "next/link"
import { ArrowUpRight, BriefcaseBusiness, ChartNoAxesCombined, Sparkles } from "lucide-react"
import { BrandMark } from "@/components/brand-mark"
import { useLanguage } from "@/lib/i18n/context"

export function AuthShell({
  children,
  title,
  subtitle
}: {
  children: React.ReactNode
  title: string
  subtitle: string
}) {
  const { language } = useLanguage()
  const fr = language === "fr"

  return (
    <main className="grid min-h-dvh bg-card lg:grid-cols-[1fr_1fr]">
      <section className="relative m-3 hidden flex-col overflow-hidden rounded-[28px] border border-primary/10 bg-[#f1f0ff] p-10 lg:flex xl:p-14">
        <Link href="/" className="relative z-10 flex w-fit items-center gap-3">
          <BrandMark />
          <span className="text-xl font-semibold tracking-[-0.06em]">
            bourse<span className="text-primary">.</span>
          </span>
        </Link>
        <div className="relative z-10 my-auto max-w-lg py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            {fr
              ? "Une nouvelle perspective sur vos investissements"
              : "A new perspective on your investments"}
          </span>
          <h2 className="mt-7 text-[clamp(2.5rem,4.3vw,4.5rem)] leading-[1.08] font-semibold tracking-[-0.065em]">
            {fr ? (
              <>
                Un portefeuille.
                <br />
                <span className="text-primary">Une vision claire.</span>
              </>
            ) : (
              <>
                One portfolio.
                <br />
                <span className="text-primary">A clear picture.</span>
              </>
            )}
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-[#68647d]">
            {fr
              ? "Tous vos investissements au même endroit. Suivez vos performances et prenez du recul, simplement."
              : "All your investments in one place. Track performance and see the bigger picture, effortlessly."}
          </p>
          <div
            aria-hidden="true"
            className="relative mt-10 rounded-2xl border border-white bg-white/80 p-6 shadow-[0_12px_50px_rgb(74_65_160/0.045)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                {fr ? "Vos investissements" : "Your investments"}
              </span>
              <ArrowUpRight className="size-4 text-primary" />
            </div>
            <div className="mt-6 flex items-center gap-7">
              <div className="relative size-24 shrink-0 rounded-full border-[12px] border-primary/10">
                <div className="absolute -inset-3 rotate-[-35deg] rounded-full border-[12px] border-transparent border-t-primary border-r-primary border-b-[#a5a1fb]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <BriefcaseBusiness className="size-6 text-primary" strokeWidth={1.5} />
                </div>
              </div>
              <div className="flex-1 space-y-3.5">
                {["PEA", "CTO", fr ? "Assurance vie" : "Life insurance"].map((label, index) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span
                      className="size-2 rounded-full bg-primary"
                      style={{ opacity: 1 - index * 0.25 }}
                    />
                    <span className="w-24 text-[11px] text-muted-foreground">{label}</span>
                    <span className="h-1.5 flex-1 rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-[11px] text-[#68647d]">
            <span className="flex items-center gap-1.5">
              <ChartNoAxesCombined className="size-3.5" />
              {fr ? "Suivi des performances" : "Performance tracking"}
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              {fr ? "Assistant IA personnel" : "Personal AI assistant"}
            </span>
          </div>
        </div>
        <p className="relative z-10 text-[11px] text-[#68647d]">
          {fr
            ? "L’essentiel pour suivre vos investissements."
            : "Everything you need to follow your investments."}
        </p>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -bottom-56 size-[650px] rounded-full border border-primary/[0.06]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -bottom-36 size-[450px] rounded-full border border-primary/[0.06]"
        />
      </section>
      <section className="flex min-w-0 flex-col px-6 py-8 sm:px-12">
        <Link href="/" aria-label="Bourse" className="flex w-fit items-center gap-2.5 lg:invisible">
          <BrandMark className="size-9" />
          <span className="text-lg font-semibold tracking-tight">
            bourse<span className="text-primary">.</span>
          </span>
        </Link>
        <div className="mx-auto my-auto w-full max-w-[360px] py-12">
          <div className="mb-8">
            <span className="mb-6 inline-flex size-11 items-center justify-center rounded-2xl border bg-background">
              <BriefcaseBusiness className="size-5 text-primary" strokeWidth={1.5} />
            </span>
            <h1 className="text-[28px] font-semibold tracking-[-0.045em]">{title}</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
        <p className="text-center text-[10px] text-muted-foreground">
          Bourse ·{" "}
          {fr ? "Votre espace d’investissement personnel" : "Your personal investment workspace"}
        </p>
      </section>
    </main>
  )
}
