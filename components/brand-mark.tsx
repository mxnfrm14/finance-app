import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_3px_8px_rgb(85_81_245/0.18)]",
        className
      )}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 17V12L9 7V17H4Z" fill="currentColor" opacity=".65" />
        <path d="M11 17V9L16 4V17H11Z" fill="currentColor" />
        <path
          d="M17 5H21V9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
