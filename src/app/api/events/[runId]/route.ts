import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { events } from "@/lib/db/schema"
import { eq, and, gt, asc } from "drizzle-orm"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const url = new URL(request.url)
  const afterParam = url.searchParams.get("after")
  const initialCursor = afterParam !== null ? parseInt(afterParam, 10) : 0

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      // Send initial events ordered by id ASC
      const initial = await db.select().from(events)
        .where(and(eq(events.runId, runId), gt(events.id, initialCursor)))
        .orderBy(asc(events.id))
        .limit(50)

      for (const row of initial) {
        send(JSON.stringify(row))
      }

      let running = true
      let lastId: number = initial.length > 0
        ? (initial[initial.length - 1]?.id ?? initialCursor)
        : initialCursor

      const interval = setInterval(async () => {
        if (!running) return

        try {
          const newEvents = await db.select().from(events)
            .where(and(eq(events.runId, runId), gt(events.id, lastId)))
            .orderBy(asc(events.id))
            .limit(20)

          for (const row of newEvents) {
            send(JSON.stringify(row))
            lastId = row.id
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
