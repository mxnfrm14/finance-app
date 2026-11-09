import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userRole = (session.user as { role?: string }).role

  return (
    <AppShell userRole={userRole} userName={session.user.name} userEmail={session.user.email}>
      {children}
    </AppShell>
  )
}
