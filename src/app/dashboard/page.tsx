import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getHealthData, deriveChatSummary } from "@/lib/health-data"
import { DashboardStats } from "@/components/dashboard-stats"
import { HealthChat } from "@/components/health-chat"
import { HeartRateChart } from "@/components/heart-rate-chart"
import { WeightChart } from "@/components/weight-chart"
import { BloodPressureChart } from "@/components/blood-pressure-chart"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const data = await getHealthData()

  return (
    <div data-testid="dashboard-root" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {session.user.name}
        </h2>
        <p className="text-muted-foreground">
          Here&apos;s your health overview for today.
        </p>
      </div>

      <DashboardStats stats={data.stats} />

      <HeartRateChart data={data.heartRate} />

      <WeightChart data={data.weight} />

      <BloodPressureChart data={data.bloodPressure} />

      <HealthChat healthData={deriveChatSummary(data)} />
    </div>
  )
}
