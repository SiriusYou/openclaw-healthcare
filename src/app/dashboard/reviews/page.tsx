"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Task {
  readonly id: string
  readonly title: string
  readonly status: string | null
  readonly priority: string | null
}

interface Run {
  readonly id: string
  readonly taskId: string | null
  readonly status: string | null
  readonly attempt: number | null
}

export default function ReviewsPage() {
  const [tasks, setTasks] = useState<readonly Task[]>([])
  const [runs, setRuns] = useState<readonly Run[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, runsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/runs"),
      ])
      if (tasksRes.ok) setTasks(await tasksRes.json())
      if (runsRes.ok) setRuns(await runsRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  async function handleApprove(taskId: string) {
    await fetch(`/api/tasks/${taskId}/approve`, { method: "POST" })
    await fetchData()
  }

  async function handleReject(taskId: string) {
    const reason = window.prompt("Rejection reason (optional):")
    await fetch(`/api/tasks/${taskId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason ?? "" }),
    })
    await fetchData()
  }

  async function handleMerge(taskId: string) {
    await fetch(`/api/tasks/${taskId}/merge`, { method: "POST" })
    await fetchData()
  }

  const reviewTasks = tasks.filter((t) => t.status === "awaiting_review")
  const prReadyTasks = tasks.filter((t) => t.status === "pr_ready")

  function getLatestRun(taskId: string): Run | undefined {
    const taskRuns = runs.filter((r) => r.taskId === taskId)
    return taskRuns.reduce<Run | undefined>((best, r) =>
      !best || (r.attempt ?? 0) > (best.attempt ?? 0) ? r : best
    , undefined)
  }

  return (
    <div data-testid="reviews-root" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reviews</h2>
        <p className="text-muted-foreground">Approve or reject completed agent work.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading reviews...</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Awaiting Review ({reviewTasks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks awaiting review.</p>
              ) : (
                <div className="space-y-3">
                  {reviewTasks.map((task) => {
                    const latestRun = getLatestRun(task.id)
                    return (
                      <div key={task.id} className="flex items-center justify-between rounded-md border p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{task.title}</p>
                          {latestRun && (
                            <Link
                              href={`/dashboard/runs/${latestRun.id}`}
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              Run {latestRun.id.slice(0, 8)} (attempt {latestRun.attempt})
                            </Link>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApprove(task.id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReject(task.id)}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PR Ready ({prReadyTasks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {prReadyTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks ready for merge.</p>
              ) : (
                <div className="space-y-3">
                  {prReadyTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <Badge variant="secondary">pr_ready</Badge>
                      </div>
                      <Button size="sm" onClick={() => handleMerge(task.id)}>
                        Mark as Merged
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
