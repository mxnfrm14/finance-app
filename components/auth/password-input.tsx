"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"

export function PasswordInput(props: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false)
  const { language } = useLanguage()
  const label =
    language === "fr"
      ? visible
        ? "Masquer le mot de passe"
        : "Afficher le mot de passe"
      : visible
        ? "Hide password"
        : "Show password"
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className="auth-input pr-12" />
      <button
        type="button"
        aria-label={label}
        aria-pressed={visible}
        title={label}
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
