import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SleepPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sleep</h2>
        <p className="text-muted-foreground">
          Analyze your sleep patterns and quality.
        </p>
      </div>
    </div>
  )
}
