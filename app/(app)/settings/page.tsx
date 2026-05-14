import { auth } from "@/auth"
import { SettingsClient } from "@/components/settings/settings-client"

export default async function SettingsPage() {
  const session = await auth()
  return <SettingsClient userEmail={session?.user?.email ?? ""} />
}
