"use client"

import { useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2 } from "lucide-react"
import { useLanguage } from "@/lib/i18n/context"
import { AuthShell } from "@/components/auth/auth-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const { t, language } = useLanguage()
  const fr = language === "fr"
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      const result = await signIn("credentials", { email, password, redirect: false })
      if (result?.error) {
        setError(t.auth.invalidCredentials)
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError(
        fr
          ? "Connexion impossible pour le moment. Veuillez réessayer."
          : "Unable to sign in right now. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={fr ? "Heureux de vous revoir" : "Welcome back"}
      subtitle={
        fr
          ? "Connectez-vous pour retrouver vos investissements."
          : "Sign in to pick up where you left off."
      }
    >
      <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-5">
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
            aria-describedby={error ? "login-error" : undefined}
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
            autoComplete="current-password"
            placeholder={fr ? "Votre mot de passe" : "Your password"}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        {error && (
          <p
            id="login-error"
            role="alert"
            className="rounded-xl bg-loss px-3 py-2.5 text-xs leading-relaxed text-loss"
          >
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="h-11 w-full justify-between px-4">
          {loading ? t.common.loading : t.auth.loginButton}
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
        </Button>
      </form>
      <p className="mt-7 text-center text-xs text-muted-foreground">
        {fr ? "Vous découvrez Bourse ?" : "New to Bourse?"}{" "}
        <Link
          href="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t.auth.register}
        </Link>
      </p>
    </AuthShell>
  )
}
