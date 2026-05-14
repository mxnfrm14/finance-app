import type { NextAuthConfig } from "next-auth"

/**
 * Config NextAuth allégée — sans bcrypt ni Prisma.
 * Utilisée par proxy.ts (edge runtime) pour vérifier les JWT.
 * L'authentification complète (credentials + bcrypt) reste dans auth.ts.
 */
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isLoginPage = nextUrl.pathname.startsWith("/login")

      if (isLoginPage) {
        // Rediriger vers dashboard si déjà connecté
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl))
        return true
      }

      // Toutes les autres routes nécessitent une session
      return isLoggedIn
    },
  },
}
