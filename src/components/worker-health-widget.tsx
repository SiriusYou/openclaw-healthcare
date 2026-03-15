"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface WorkerHealth {
  ready: boolean
  pid?: string
  lastHeartbeat?: number
  ageSeconds?: number
  error?: string
}

const POLL_INTERVAL = 10_000

export function WorkerHealthWidget() {
  const [health, setHealth] = useState<WorkerHealth | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchHealth() {
      try {
        const res = await fetch("/api/worker/health")
        const data = (await res.json()) as WorkerHealth
        if (mounted) setHealth(data)
      } catch {
        if (mounted) setHealth({ ready: false, error: "Fetch failed" })
      }
    }

    fetchHealth()
    const id = setInterval(fetchHealth, POLL_INTERVAL)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const isOnline = health?.ready === true

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Worker
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span
            data-testid="worker-status-dot"
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isOnline ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-2xl font-bold">
            {health === null ? "..." : isOnline ? "Online" : "Offline"}
          </span>
        </div>
        {health?.pid && (
          <p className="mt-1 text-xs text-muted-foreground">
            PID {health.pid}
            {health.ageSeconds !== undefined && ` · ${health.ageSeconds}s ago`}
          </p>
        )}
        {health?.error && (
          <p className="mt-1 text-xs text-muted-foreground">{health.error}</p>
        )}
      </CardContent>
    </Card>
  )
}
