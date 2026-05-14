import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { NavSidebar } from "@/components/nav-sidebar"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const userRole = (session.user as { role?: string }).role

  return (
    <div className="flex min-h-screen overflow-hidden">
      <NavSidebar userRole={userRole} />
      <main className="surface-panel flex-1 overflow-y-auto">
        <div className="mx-auto min-h-full max-w-[1600px]">
          {children}
        </div>
      </main>
    </div>
  )
}
