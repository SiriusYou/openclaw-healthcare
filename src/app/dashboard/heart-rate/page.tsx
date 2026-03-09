import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getHealthData } from "@/lib/health-data"
import { HeartRateChart } from "@/components/heart-rate-chart"

export default async function HeartRatePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const data = await getHealthData()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Heart Rate</h2>
        <p className="text-muted-foreground">
          Monitor your heart rate trends over time.
        </p>
      </div>
      <HeartRateChart data={data.heartRate} />
    </div>
  )
}
