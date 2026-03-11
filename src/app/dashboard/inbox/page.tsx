"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Task {
  readonly id: string
  readonly title: string
  readonly description: string | null
  readonly priority: string | null
  readonly status: string | null
  readonly agentKind: string | null
  readonly createdAt: string | null
  readonly updatedAt: string | null
}

function priorityColor(priority: string | null) {
  switch (priority) {
    case "urgent": return "destructive"
    case "high": return "default"
    case "medium": return "secondary"
    default: return "outline"
  }
}

function statusColor(status: string | null) {
  switch (status) {
    case "in_progress": case "assigned": return "default"
    case "awaiting_review": case "pr_ready": return "secondary"
    case "failed": return "destructive"
    case "merged": case "cleaned": return "outline"
    default: return "outline"
  }
}

export default function InboxPage() {
  const [tasks, setTasks] = useState<readonly Task[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const [creating, setCreating] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks")
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [fetchTasks])

  async function handleCreate(autoRun: boolean) {
    if (!title.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, priority, autoRun }),
      })
      if (res.ok) {
        setTitle("")
        setDescription("")
        setPriority("medium")
        setDialogOpen(false)
        await fetchTasks()
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleCancel(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    })
    await fetchTasks()
  }

  const activeTasks = tasks.filter((t) =>
    !["merged", "cleaned", "cancelled"].includes(t.status ?? "")
  )
  const completedTasks = tasks.filter((t) =>
    ["merged", "cleaned", "cancelled"].includes(t.status ?? "")
  )

  return (
    <div data-testid="inbox-root" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inbox</h2>
          <p className="text-muted-foreground">Task queue and creation.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-task-btn">New Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="What should the agent do?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Detailed instructions for the agent..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={creating || !title.trim()}
                  onClick={() => handleCreate(false)}
                >
                  Save Draft
                </Button>
                <Button
                  disabled={creating || !title.trim()}
                  onClick={() => handleCreate(true)}
                  data-testid="queue-and-run-btn"
                >
                  Queue &amp; Run
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading tasks...</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Active Tasks ({activeTasks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {activeTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active tasks.</p>
              ) : (
                <div className="space-y-2">
                  {activeTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <div className="flex gap-2">
                          <Badge variant={statusColor(task.status)}>{task.status}</Badge>
                          <Badge variant={priorityColor(task.priority)}>{task.priority}</Badge>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancel(task.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {completedTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Completed ({completedTasks.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {completedTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between rounded-md border p-3 opacity-60">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <Badge variant="outline">{task.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
