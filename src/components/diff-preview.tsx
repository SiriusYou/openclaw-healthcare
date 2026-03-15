"use client"

import { useEffect, useState } from "react"

interface DiffData {
  readonly stat: string
  readonly diff: string
  readonly baseCommitSha: string
  readonly headCommitSha: string
}

export function DiffPreview({ runId }: { readonly runId: string }) {
  const [data, setData] = useState<DiffData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let mounted = true
    async function fetchDiff() {
      try {
        const res = await fetch(`/api/runs/${runId}/diff`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (mounted) setError((body as { error?: string }).error ?? "Failed to load diff")
          return
        }
        const result = (await res.json()) as DiffData
        if (mounted) setData(result)
      } catch {
        if (mounted) setError("Failed to load diff")
      }
    }
    fetchDiff()
    return () => { mounted = false }
  }, [runId])

  if (error) {
    return <p className="text-xs text-muted-foreground">{error}</p>
  }

  if (!data) {
    return <p className="text-xs text-muted-foreground">Loading diff...</p>
  }

  const statLines = data.stat.trim().split("\n")
  const hasChanges = statLines.length > 0 && statLines[0] !== ""

  return (
    <div className="mt-2 space-y-1">
      {hasChanges && (
        <div className="rounded bg-muted p-2 font-mono text-xs">
          {statLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
      {data.diff && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:underline"
        >
          {expanded ? "Hide full diff" : "Show full diff"}
        </button>
      )}
      {expanded && data.diff && (
        <pre className="max-h-96 overflow-auto rounded bg-muted p-2 font-mono text-xs">
          {data.diff}
        </pre>
      )}
    </div>
  )
}
