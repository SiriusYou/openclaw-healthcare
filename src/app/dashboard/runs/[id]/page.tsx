"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface RunDetail {
  readonly id: string
  readonly taskId: string | null
  readonly agentKind: string | null
  readonly status: string | null
  readonly attempt: number | null
  readonly branch: string | null
  readonly exitCode: number | null
  readonly worktreePath: string | null
  readonly createdAt: string | null
  readonly startedAt: string | null
  readonly finishedAt: string | null
}

interface TaskDetail {
  readonly id: string
  readonly title: string
  readonly status: string | null
}

interface EventEntry {
  readonly id: string
  readonly type: string | null
  readonly payload: string | null
  readonly timestamp: string | null
}

function statusColor(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "running": return "default"
    case "succeeded": return "secondary"
    case "failed": case "orphaned": return "destructive"
    default: return "outline"
  }
}

export default function RunDetailPage() {
  const params = useParams<{ id: string }>()
  const runId = params.id

  const [run, setRun] = useState<RunDetail | null>(null)
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [events, setEvents] = useState<readonly EventEntry[]>([])
  const [loading, setLoading] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)

  const fetchRun = useCallback(async () => {
    const res = await fetch(`/api/runs?taskId=_all`)
    if (!res.ok) return
    const allRuns: readonly RunDetail[] = await res.json()
    const found = allRuns.find((r) => r.id === runId)
    if (found) {
      setRun(found)
      if (found.taskId) {
        const taskRes = await fetch(`/api/tasks?status=_all`)
        if (taskRes.ok) {
          const allTasks: readonly TaskDetail[] = await taskRes.json()
          const t = allTasks.find((t) => t.id === found.taskId)
          if (t) setTask(t)
        }
      }
    }
    setLoading(false)
  }, [runId])

  useEffect(() => {
    let mounted = true
    async function load() {
      if (mounted) await fetchRun()
    }
    load()
    const interval = setInterval(fetchRun, 5000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [fetchRun])

  // SSE event stream
  useEffect(() => {
    if (!runId) return

    const eventSource = new EventSource(`/api/events/${runId}`)
    eventSource.onmessage = (e) => {
      try {
        const event: EventEntry = JSON.parse(e.data)
        setEvents((prev) => [...prev, event])
      } catch {
        // ignore parse errors
      }
    }
    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => eventSource.close()
  }, [runId])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events])

  async function handleApprove() {
    if (!run?.taskId) return
    await fetch(`/api/tasks/${run.taskId}/approve`, { method: "POST" })
    await fetchRun()
  }

  async function handleReject() {
    if (!run?.taskId) return
    const reason = window.prompt("Rejection reason (optional):")
    await fetch(`/api/tasks/${run.taskId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason ?? "" }),
    })
    await fetchRun()
  }

  async function handleMerge() {
    if (!run?.taskId) return
    await fetch(`/api/tasks/${run.taskId}/merge`, { method: "POST" })
    await fetchRun()
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading run details...</p>
  }

  if (!run) {
    return <p className="text-sm text-muted-foreground">Run not found.</p>
  }

  const showApproveReject = run.status === "succeeded" && task?.status === "awaiting_review"
  const showMerge = task?.status === "pr_ready"

  return (
    <div data-testid="run-detail-root" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Run {run.id.slice(0, 8)}
        </h2>
        <p className="text-muted-foreground">
          {task?.title ?? `Task ${run.taskId?.slice(0, 8)}`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={statusColor(run.status)}>{run.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attempt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{run.attempt}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{run.agentKind}</div>
          </CardContent>
        </Card>
      </div>

      {run.branch && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Branch</CardTitle>
          </CardHeader>
          <CardContent>
            <code className="text-sm">{run.branch}</code>
          </CardContent>
        </Card>
      )}

      {(showApproveReject || showMerge) && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            {showApproveReject && (
              <>
                <Button onClick={handleApprove}>Approve</Button>
                <Button variant="destructive" onClick={handleReject}>Reject</Button>
              </>
            )}
            {showMerge && (
              <Button onClick={handleMerge}>Mark as Merged</Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Event Log ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto rounded-md bg-muted p-4 font-mono text-xs">
            {events.length === 0 ? (
              <p className="text-muted-foreground">Waiting for events...</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="border-b border-border py-1 last:border-0">
                  <span className="text-muted-foreground">
                    [{event.type}]
                  </span>{" "}
                  {event.payload}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
