"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const heartRateData = [
  { time: "00:00", bpm: 62 },
  { time: "02:00", bpm: 58 },
  { time: "04:00", bpm: 55 },
  { time: "06:00", bpm: 60 },
  { time: "08:00", bpm: 78 },
  { time: "10:00", bpm: 85 },
  { time: "12:00", bpm: 90 },
  { time: "14:00", bpm: 82 },
  { time: "16:00", bpm: 88 },
  { time: "18:00", bpm: 76 },
  { time: "20:00", bpm: 70 },
  { time: "22:00", bpm: 65 },
]

export function HeartRateChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Heart Rate Trend</CardTitle>
        <CardDescription>24-hour heart rate monitoring (bpm)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={heartRateData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="time"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                domain={[50, 100]}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value: number) => `${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  color: "hsl(var(--card-foreground))",
                }}
                formatter={(value) => [`${value} bpm`, "Heart Rate"]}
              />
              <Line
                type="monotone"
                dataKey="bpm"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--destructive))", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
