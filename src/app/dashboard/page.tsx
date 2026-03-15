import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { tasks, runs } from "@/lib/db/schema"
import { eq, inArray, desc } from "drizzle-orm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { WorkerHealthWidget } from "@/components/worker-health-widget"

const ACTIVE_TASK_STATUSES = ["queued", "assigned", "in_progress", "awaiting_review", "pr_ready"] as const
const ACTIVE_RUN_STATUSES = ["pending", "claimed", "running"] as const

function statusColor(status: string) {
  switch (status) {
    case "running": return "default"
    case "succeeded": return "secondary"
    case "failed": return "destructive"
    case "pending": case "claimed": return "outline"
    default: return "outline"
  }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const activeTasks = await db.select().from(tasks)
    .where(inArray(tasks.status, ACTIVE_TASK_STATUSES))

  const activeRuns = await db.select().from(runs)
    .where(inArray(runs.status, ACTIVE_RUN_STATUSES))

  const recentRuns = await db.select().from(runs)
    .orderBy(desc(runs.createdAt))
    .limit(5)

  const failedTasks = await db.select().from(tasks)
    .where(eq(tasks.status, "failed"))

  return (
    <div data-testid="dashboard-root" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {session.user.name}
        </h2>
        <p className="text-muted-foreground">Agent Swarm overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <WorkerHealthWidget />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Running Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRuns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedTasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentRuns.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet. Create a task from the Inbox.</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Run {run.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      Attempt {run.attempt} &middot; {run.agentKind}
                    </p>
                  </div>
                  <Badge variant={statusColor(run.status ?? "pending")}>{run.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
