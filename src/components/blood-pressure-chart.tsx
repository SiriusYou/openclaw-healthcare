"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const bloodPressureData = [
  { date: "Mon", systolic: 118, diastolic: 78 },
  { date: "Tue", systolic: 122, diastolic: 82 },
  { date: "Wed", systolic: 115, diastolic: 76 },
  { date: "Thu", systolic: 128, diastolic: 85 },
  { date: "Fri", systolic: 120, diastolic: 80 },
  { date: "Sat", systolic: 125, diastolic: 83 },
  { date: "Sun", systolic: 119, diastolic: 79 },
]

export function formatBpTooltip(value: number | string, name: string): [string, string] {
  return [
    `${value} mmHg`,
    name === "systolic" ? "Systolic" : "Diastolic",
  ]
}

export function BloodPressureChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Blood Pressure Trend</CardTitle>
        <CardDescription>
          Weekly blood pressure tracking (mmHg)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bloodPressureData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                domain={[60, 150]}
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
                formatter={formatBpTooltip}
              />
              <ReferenceLine
                y={120}
                stroke="hsl(var(--destructive))"
                strokeDasharray="6 3"
                label={{
                  value: "Systolic 120",
                  position: "right",
                  fill: "hsl(var(--destructive))",
                  fontSize: 11,
                }}
              />
              <ReferenceLine
                y={80}
                stroke="hsl(var(--primary))"
                strokeDasharray="6 3"
                label={{
                  value: "Diastolic 80",
                  position: "right",
                  fill: "hsl(var(--primary))",
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="systolic"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--destructive))", r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="diastolic"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
