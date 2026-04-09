import { describe, test, expect } from "bun:test"
import { stream } from "../src/llm"

function sseChunks(tokens: string[]): string {
  return (
    tokens
      .map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}`)
      .join("\n") +
    "\ndata: [DONE]\n"
  )
}

async function collectStream(
  tokens: string[],
  splitAt?: number // split the SSE payload at this byte offset to simulate chunk boundaries
): Promise<string> {
  const payload = sseChunks(tokens)

  const server = Bun.serve({
    port: 0,
    fetch() {
      if (splitAt !== undefined) {
        // Stream in two chunks split at splitAt to test boundary handling
        const encoder = new TextEncoder()
        const bytes = encoder.encode(payload)
        const part1 = bytes.slice(0, splitAt)
        const part2 = bytes.slice(splitAt)
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(part1)
            controller.enqueue(part2)
            controller.close()
          },
        })
        return new Response(body, {
          headers: { "Content-Type": "text/event-stream" },
        })
      }
      return new Response(payload, {
        headers: { "Content-Type": "text/event-stream" },
      })
    },
  })

  const url = `http://localhost:${server.port}`
  let result = ""
  try {
    for await (const token of stream(
      [{ role: "user", content: "test" }],
      { apiUrl: url, apiKey: "test", model: "test-model" }
    )) {
      result += token
    }
  } finally {
    server.stop()
  }
  return result
}

describe("stream", () => {
  test("collects tokens from SSE response", async () => {
    const result = await collectStream(["async ", "def ", "foo():"])
    expect(result).toBe("async def foo():")
  })

  test("handles chunk boundary mid-event", async () => {
    // Split the SSE payload mid-way through the first event line
    const result = await collectStream(["hello ", "world"], 20)
    expect(result).toBe("hello world")
  })

  test("handles single-token response", async () => {
    const result = await collectStream(["done"])
    expect(result).toBe("done")
  })

  test("throws on non-200 response", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response("internal error", { status: 500 })
      },
    })

    const url = `http://localhost:${server.port}`
    let threw = false
    try {
      for await (const _ of stream(
        [{ role: "user", content: "test" }],
        { apiUrl: url, apiKey: "test", model: "test-model" }
      )) {
        // should not reach here
      }
    } catch (err) {
      threw = true
      expect(String(err)).toContain("500")
    } finally {
      server.stop()
    }
    expect(threw).toBe(true)
  })
})
