"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { ArrowRight, Loader2 } from "lucide-react"
import { AuthShell } from "@/components/auth/auth-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/context"

export default function RegisterPage() {
  const router = useRouter()
  const { language, t } = useLanguage()
  const fr = language === "fr"
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      })
      if (!response.ok) {
        const data = await response.json()
        setError(
          typeof data.error === "string"
            ? data.error
            : fr
              ? "Erreur lors de la création du compte."
              : "Unable to create your account."
        )
        return
      }
      const result = await signIn("credentials", { email, password, redirect: false })
      if (result?.error) {
        router.push("/login")
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError(
        fr
          ? "Connexion impossible pour le moment. Veuillez réessayer."
          : "Unable to connect right now. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={fr ? "Tout commence ici" : "It all starts here"}
      subtitle={
        fr
          ? "Créez votre compte et donnez une vue d’ensemble à vos investissements."
          : "Create your account and bring your investments into focus."
      }
    >
      <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="block text-xs font-medium">
            {fr ? "Nom complet" : "Full name"}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoComplete="name"
            className="auth-input"
            placeholder="Alice Dupont"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="block text-xs font-medium">
            {fr ? "Adresse e-mail" : "Email address"}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            className="auth-input"
            placeholder="vous@exemple.fr"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="block text-xs font-medium">
            {t.auth.password}
          </label>
          <PasswordInput
            id="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={fr ? "8 caractères minimum" : "At least 8 characters"}
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-[11px] text-muted-foreground">
            {fr ? "Utilisez au moins 8 caractères." : "Use at least 8 characters."}
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-loss px-3 py-2.5 text-xs leading-relaxed text-loss"
          >
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="mt-2 h-11 w-full justify-between px-4">
          {loading
            ? fr
              ? "Création en cours…"
              : "Creating account…"
            : fr
              ? "Créer mon compte"
              : "Create my account"}
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
        </Button>
      </form>
      <p className="mt-7 text-center text-xs text-muted-foreground">
        {fr ? "Déjà un compte ?" : "Already have an account?"}{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t.auth.loginButton}
        </Link>
      </p>
    </AuthShell>
  )
}
