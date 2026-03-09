import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account and application preferences.
        </p>
      </div>
    </div>
  )
}
