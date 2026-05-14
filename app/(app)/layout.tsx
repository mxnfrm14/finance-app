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
    <div className="min-h-screen">
      <NavSidebar userRole={userRole} />
      <main className="surface-panel ml-60 min-h-screen overflow-y-auto transition-all duration-200" data-sidebar-collapsed="false">
        <div className="mx-auto min-h-full max-w-[1600px]">
          {children}
        </div>
      </main>
    </div>
  )
}
