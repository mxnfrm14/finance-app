import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Laisser passer les assets et la page de login
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/api/auth")
  if (isPublic) return

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })

  if (!token) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return Response.redirect(url)
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)",
  ],
}
