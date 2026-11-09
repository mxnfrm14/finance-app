import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { encode } from "next-auth/jwt"
import { NextRequest } from "next/server"
import proxy from "../proxy"

const secret = "session-regression-test-current-secret"
const cookieName = "authjs.session-token"
const originalEnv = {
  AUTH_URL: process.env.AUTH_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
}

beforeEach(() => {
  process.env.AUTH_URL = "http://localhost:3000"
  process.env.AUTH_SECRET = secret
  delete process.env.NEXTAUTH_SECRET
})

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

function token(options: { secret?: string; salt?: string; maxAge?: number } = {}) {
  return encode({
    secret: options.secret ?? secret,
    salt: options.salt ?? cookieName,
    maxAge: options.maxAge ?? 3600,
    token: { sub: "test-user", id: "test-user", role: "member" },
  })
}

test("login without a session renders without a redirect", async () => {
  const response = await proxy(new NextRequest("http://localhost:3000/login"))
  assert.equal(response?.headers.get("x-middleware-next"), "1")
  assert.equal(response?.headers.get("set-cookie"), null)
})

test("a session encrypted with the previous secret is cleared before login renders", async () => {
  const stale = await token({ secret: "previous-installation-secret" })
  const url = "http://localhost:3000/login?callbackUrl=%2Fdashboard"
  const response = await proxy(new NextRequest(url, {
    headers: { cookie: `${cookieName}=${stale}` },
  }))

  assert.equal(response?.status, 307)
  assert.equal(response?.headers.get("location"), url)
  assert.equal(response?.cookies.get(cookieName)?.maxAge, 0)
  assert.equal(response?.cookies.get(cookieName)?.httpOnly, true)
})

test("an invalid protected session redirects to login and clears its cookie", async () => {
  const response = await proxy(new NextRequest("http://localhost:3000/dashboard", {
    headers: { cookie: `${cookieName}=invalid-session` },
  }))

  assert.equal(response?.headers.get("location"), "http://localhost:3000/login?callbackUrl=%2Fdashboard")
  assert.equal(response?.cookies.get(cookieName)?.maxAge, 0)
})

test("expired sessions are cleared even when encrypted with the current secret", async () => {
  const expired = await token({ maxAge: -3600 })
  const response = await proxy(new NextRequest("http://localhost:3000/login", {
    headers: { cookie: `${cookieName}=${expired}` },
  }))

  assert.equal(response?.cookies.get(cookieName)?.maxAge, 0)
})

test("every chunk of an invalid session is cleared without clearing other cookies", async () => {
  const stale = await token({ secret: "old-secret" })
  const split = Math.floor(stale.length / 2)
  const response = await proxy(new NextRequest("http://localhost:3000/login", {
    headers: {
      cookie: `${cookieName}.0=${stale.slice(0, split)}; ${cookieName}.1=${stale.slice(split)}; language=en`,
    },
  }))

  assert.equal(response?.cookies.get(`${cookieName}.0`)?.maxAge, 0)
  assert.equal(response?.cookies.get(`${cookieName}.1`)?.maxAge, 0)
  assert.equal(response?.cookies.get("language"), undefined)
})

test("a valid HTTP session keeps access to protected routes", async () => {
  const valid = await token()
  const response = await proxy(new NextRequest("http://localhost:3000/dashboard", {
    headers: { cookie: `${cookieName}=${valid}` },
  }))

  assert.equal(response, undefined)
})

test("HTTPS sessions use the secure cookie name and matching encryption salt", async () => {
  process.env.AUTH_URL = "https://bourse.example"
  const secureName = `__Secure-${cookieName}`
  const valid = await token({ salt: secureName })
  const response = await proxy(new NextRequest("https://bourse.example/dashboard", {
    headers: { cookie: `${secureName}=${valid}` },
  }))

  assert.equal(response, undefined)
})

test("an invalid HTTPS session is cleared with secure cookie attributes", async () => {
  process.env.AUTH_URL = "https://bourse.example"
  const secureName = `__Secure-${cookieName}`
  const response = await proxy(new NextRequest("https://bourse.example/login", {
    headers: { cookie: `${secureName}=stale-session` },
  }))

  assert.equal(response?.cookies.get(secureName)?.secure, true)
  assert.equal(response?.cookies.get(secureName)?.maxAge, 0)
})

test("a login POST strips a stale session but preserves CSRF and the replacement cookie", async () => {
  const response = await proxy(new NextRequest("http://localhost:3000/api/auth/callback/credentials", {
    method: "POST",
    headers: { cookie: `${cookieName}=old-session; authjs.csrf-token=test-csrf; language=fr` },
  }))

  const forwardedCookies = response?.headers.get("x-middleware-request-cookie") ?? ""
  assert.ok(!forwardedCookies.includes(cookieName))
  assert.ok(forwardedCookies.includes("authjs.csrf-token=test-csrf"))
  assert.ok(forwardedCookies.includes("language=fr"))
  assert.equal(response?.headers.get("set-cookie"), null)
})

test("missing secret configuration is reported instead of silently accepting a session", async () => {
  delete process.env.AUTH_SECRET
  await assert.rejects(() => proxy(new NextRequest("http://localhost:3000/login", {
    headers: { cookie: `${cookieName}=some-session` },
  })), /secret/i)
})
