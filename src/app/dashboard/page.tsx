import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Activity, Heart, Moon, Weight } from "lucide-react"
import { HealthChat } from "@/components/health-chat"
import { HeartRateChart } from "@/components/heart-rate-chart"
import { WeightChart } from "@/components/weight-chart"

const healthCards = [
  {
    title: "Steps Today",
    value: "8,432",
    description: "Goal: 10,000",
    icon: Activity,
    trend: "+12% from yesterday",
  },
  {
    title: "Heart Rate",
    value: "72 bpm",
    description: "Resting average",
    icon: Heart,
    trend: "Normal range",
  },
  {
    title: "Sleep",
    value: "7h 24m",
    description: "Last night",
    icon: Moon,
    trend: "+30min from average",
  },
  {
    title: "Weight",
    value: "68.5 kg",
    description: "Updated today",
    icon: Weight,
    trend: "-0.3 kg this week",
  },
]

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {healthCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <CardDescription>{card.description}</CardDescription>
              <p className="mt-1 text-xs text-muted-foreground">
                {card.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <HeartRateChart />

      <WeightChart />

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
