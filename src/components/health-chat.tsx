"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getHealthResponse } from "@/lib/health-responses"
import type { HealthChatSummary } from "@/lib/health-data"

type Message = {
  readonly role: "user" | "assistant"
  readonly content: string
}

export function HealthChat({ healthData }: { readonly healthData: HealthChatSummary }) {
  const [messages, setMessages] = useState<readonly Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your health assistant. Ask me about your steps, sleep, heart rate, weight, or general wellness tips!",
    },
  ])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages])

  const streamResponse = useCallback((fullText: string) => {
    setIsStreaming(true)
    let index = 0

    const placeholder: Message = { role: "assistant", content: "" }
    setMessages((prev) => [...prev, placeholder])

    const interval = setInterval(() => {
      index++
      const partial = fullText.slice(0, index)

      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: partial },
      ])

      if (index >= fullText.length) {
        clearInterval(interval)
        setIsStreaming(false)
      }
    }, 15)
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    const userMessage: Message = { role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setInput("")

    const response = getHealthResponse(trimmed, healthData)
    setTimeout(() => streamResponse(response), 300)
  }, [input, isStreaming, healthData, streamResponse])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Health Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={scrollRef}
          className="flex h-80 flex-col gap-3 overflow-y-auto rounded-md border p-4"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.content}
                {isStreaming &&
                  i === messages.length - 1 &&
                  msg.role === "assistant" && (
                    <span className="ml-0.5 inline-block animate-pulse">
                      |
                    </span>
                  )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your health..."
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
