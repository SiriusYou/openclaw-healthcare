import { Activity, Heart, Moon, Weight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { HealthStat } from "@/lib/health-data"

const iconMap: Record<HealthStat["icon"], LucideIcon> = {
  activity: Activity,
  heart: Heart,
  moon: Moon,
  weight: Weight,
}

interface DashboardStatsProps {
  readonly stats: readonly HealthStat[]
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = iconMap[stat.icon]
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <CardDescription>{stat.description}</CardDescription>
              <p className="mt-1 text-xs text-muted-foreground">
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
