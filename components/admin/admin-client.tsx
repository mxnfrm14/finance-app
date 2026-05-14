"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Users, UserPlus, Loader2, Eye, EyeOff, KeyRound } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: string
  name: string
  email: string
  role: string
  language: string
  createdAt: string
}

// ─── Schémas ─────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  role: z.enum(["member", "admin"]),
})
type CreateUserValues = z.infer<typeof createUserSchema>

const resetPasswordSchema = z.object({
  password: z.string().min(8, "8 caractères minimum"),
})
type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

// ─── Dialog reset mot de passe ───────────────────────────────────────────────

function ResetPasswordDialog({
  user,
  open,
  onClose,
}: {
  user: User | null
  open: boolean
  onClose: () => void
}) {
  const [show, setShow] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
  })

  async function onSubmit(data: ResetPasswordValues) {
    if (!user) return
    const res = await fetch(`/api/users/${user.id}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      toast.error("Erreur lors de la réinitialisation")
      return
    }
    toast.success(`Mot de passe de ${user.name} mis à jour`)
    reset()
    setShow(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); setShow(false); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Réinitialiser le mot de passe
          </DialogTitle>
          <DialogDescription>
            Définir un nouveau mot de passe pour{" "}
            <span className="font-medium text-foreground">{user?.name}</span>{" "}
            ({user?.email})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-password">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="reset-password"
                type={show ? "text" : "password"}
                placeholder="8 caractères minimum"
                className="pr-10"
                autoFocus
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); setShow(false); onClose() }}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function AdminClient({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [showPassword, setShowPassword] = useState(false)
  const [resetTarget, setResetTarget] = useState<User | null>(null)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", role: "member" },
  })

  const role = watch("role")

  const onCreateUser = async (data: CreateUserValues) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.status === 409) { toast.error("Un compte avec cet email existe déjà."); return }
    if (!res.ok) { toast.error("Erreur lors de la création"); return }
    const newUser: User = await res.json()
    setUsers((prev) => [...prev, { ...newUser, language: "fr" }])
    reset()
    toast.success(`Compte créé pour ${newUser.name}`)
  }

  return (
    <>
      <ResetPasswordDialog
        user={resetTarget}
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
      />

      {/* ── Liste des utilisateurs ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Utilisateurs ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">Aucun utilisateur.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">Nom</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Rôle</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Créé le</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-medium">{user.name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-6 py-3 hidden sm:table-cell">
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setResetTarget(user)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Mot de passe
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Créer un compte ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Créer un compte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onCreateUser)} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-name">Nom complet</Label>
                <Input id="new-name" placeholder="Alice Dupont" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-email">Email</Label>
                <Input id="new-email" type="email" placeholder="alice@exemple.fr" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="8 caractères minimum"
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-role">Rôle</Label>
                <Select value={role} onValueChange={(v) => setValue("role", v as "member" | "admin")}>
                  <SelectTrigger id="new-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membre</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <Button type="submit" disabled={isSubmitting} className="self-start gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Créer le compte
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
