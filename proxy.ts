import { getToken } from "next-auth/jwt"
import { NextResponse, type NextRequest } from "next/server"

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/api/auth")
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? request.url
  const secureCookie = new URL(authUrl).protocol === "https:"
  const cookieName = `${secureCookie ? "__Secure-" : ""}authjs.session-token`
  const sessionCookies = request.cookies.getAll().filter(({ name }) =>
    name === cookieName || name.startsWith(`${cookieName}.`)
  )
  const token = sessionCookies.length > 0
    ? await getToken({
        req: { headers: { cookie: request.headers.get("cookie") ?? "" } },
        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
        cookieName,
        secureCookie,
      })
    : null

  if (!token && sessionCookies.length > 0) {
    // Server Components cannot persist Auth.js's expired-cookie response.
    // Clear stale or expired tokens before a layout calls auth() again.
    if (isPublic && request.method !== "GET" && request.method !== "HEAD") {
      for (const cookie of sessionCookies) request.cookies.delete(cookie.name)
      return NextResponse.next({ request: { headers: request.headers } })
    }

    const url = isPublic ? request.nextUrl.clone() : new URL("/login", request.url)
    if (!isPublic) url.searchParams.set("callbackUrl", pathname)
    const response = NextResponse.redirect(url)
    for (const cookie of sessionCookies) {
      response.cookies.set(cookie.name, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookie,
        path: "/",
        expires: new Date(0),
        maxAge: 0,
      })
    }
    return response
  }

  if (isPublic) return NextResponse.next()

  if (!token) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)",
  ],
}
