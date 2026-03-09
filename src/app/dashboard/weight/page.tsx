import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getHealthData } from "@/lib/health-data"
import { WeightChart } from "@/components/weight-chart"

export default async function WeightPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const data = await getHealthData()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Weight</h2>
        <p className="text-muted-foreground">
          Track your weight trends over time.
        </p>
      </div>
      <WeightChart data={data.weight} />
    </div>
  )
}
