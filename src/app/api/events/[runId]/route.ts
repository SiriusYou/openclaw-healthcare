import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { events } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      // Send initial events
      const initial = await db.select().from(events)
        .where(eq(events.runId, runId))
        .orderBy(desc(events.timestamp))
        .limit(50)

      for (const row of initial.reverse()) {
        send(JSON.stringify(row))
      }

      let running = true
      let lastTimestamp = initial.length > 0
        ? (initial[initial.length - 1]?.timestamp ?? new Date())
        : new Date(0)

      const interval = setInterval(async () => {
        if (!running) return

        try {
          const newEvents = await db.select().from(events)
            .where(eq(events.runId, runId))
            .orderBy(desc(events.timestamp))
            .limit(20)

          const filtered = newEvents.filter(
            (e) => e.timestamp && e.timestamp > lastTimestamp
          )

          for (const row of filtered.reverse()) {
            send(JSON.stringify(row))
            if (row.timestamp && row.timestamp > lastTimestamp) {
              lastTimestamp = row.timestamp
            }
          }
        } catch {
          running = false
          controller.close()
        }
      }, 2000)

      const heartbeat = setInterval(() => {
        if (!running) return
        controller.enqueue(encoder.encode(": heartbeat\n\n"))
      }, 15000)

      request.signal.addEventListener("abort", () => {
        running = false
        clearInterval(interval)
        clearInterval(heartbeat)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
