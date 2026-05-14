import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db/client"
import { ShieldCheck } from "lucide-react"
import { AdminClient } from "@/components/admin/admin-client"

export default async function AdminPage() {
  const session = await auth()
  const userRole = (session?.user as { role?: string })?.role
  if (userRole !== "admin") redirect("/dashboard")

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, language: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Administration</h1>
          <p className="text-sm text-muted-foreground">Gestion des utilisateurs</p>
        </div>
      </div>
      <AdminClient initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))} />
    </div>
  )
}
