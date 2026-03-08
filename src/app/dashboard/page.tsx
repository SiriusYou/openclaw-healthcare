import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {session.user.name}
        </h2>
        <p className="text-muted-foreground">
          Here&apos;s your health overview for today.
        </p>
      </div>

      <DashboardStats />

      <HeartRateChart />

      <WeightChart />

      <BloodPressureChart />

      <HealthChat
        healthData={{
          steps: "8,432",
          heartRate: "72 bpm",
          sleep: "7h 24m",
          weight: "68.5 kg",
        }}
      />
    </div>
  )
}
