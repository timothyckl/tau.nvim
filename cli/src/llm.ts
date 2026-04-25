import { log } from "./log"

export interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LLMConfig {
  apiUrl: string
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
  topP?: number
}

const TIMEOUT_MS = Number(process.env.TAU_TIMEOUT_MS) || 60_000

async function fetchSSE(
  messages: Message[],
  config: LLMConfig
): Promise<{ response: Response; timer: ReturnType<typeof setTimeout> }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${config.apiUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        ...(config.temperature !== undefined && { temperature: config.temperature }),
        ...(config.maxTokens !== undefined && { max_tokens: config.maxTokens }),
        ...(config.topP !== undefined && { top_p: config.topP }),
      }),
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`LLM request timed out after ${TIMEOUT_MS}ms`)
    }
    throw err
  }

  if (!response.ok) {
    clearTimeout(timer)
    const body = await response.text()
    const truncated = body.length > 200 ? body.slice(0, 200) + "..." : body
    throw new Error(`LLM request failed (${response.status}): ${truncated}`)
  }

  if (!response.body) {
    clearTimeout(timer)
    throw new Error("No response body")
  }

  return { response, timer }
}

function parseSSELines(
  lines: string[],
  onContent: (s: string) => void
): boolean {
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("data:")) continue

    const data = trimmed.slice(5).trim()
    if (data === "[DONE]") return true

    try {
      const parsed = JSON.parse(data)
      const content = parsed?.choices?.[0]?.delta?.content
      if (typeof content === "string" && content.length > 0) {
        onContent(content)
      }
    } catch {
      log(`malformed SSE chunk: ${data}`)
    }
  }
  return false
}

/** Non-generator streaming — for CLI use. */
export async function streamDirect(
  messages: Message[],
  config: LLMConfig,
  write: (s: string) => void
): Promise<void> {
  const { response, timer } = await fetchSSE(messages, config)

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let lineBuffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        log("reader done=true")
        break
      }

      lineBuffer += decoder.decode(value, { stream: true })
      const lines = lineBuffer.split("\n")
      lineBuffer = lines.pop() ?? ""

      if (parseSSELines(lines, write)) {
        log("[DONE] detected, returning")
        return
      }
    }

    // Flush any remaining buffered lines
    if (lineBuffer.trim()) {
      parseSSELines(lineBuffer.split("\n"), write)
    }
    log("loop exited naturally")
  } finally {
    clearTimeout(timer)
    await reader.cancel()
  }
}

/** Generator streaming — for tests and programmatic use. */
export async function* stream(
  messages: Message[],
  config: LLMConfig
): AsyncGenerator<string> {
  const { response, timer } = await fetchSSE(messages, config)

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let lineBuffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      lineBuffer += decoder.decode(value, { stream: true })
      const lines = lineBuffer.split("\n")
      lineBuffer = lines.pop() ?? ""

      const collected: string[] = []
      if (parseSSELines(lines, (s) => collected.push(s))) {
        for (const s of collected) yield s
        return
      }
      for (const s of collected) yield s
    }

    // Flush any remaining buffered lines
    if (lineBuffer.trim()) {
      const collected: string[] = []
      parseSSELines(lineBuffer.split("\n"), (s) => collected.push(s))
      for (const s of collected) yield s
    }
  } finally {
    clearTimeout(timer)
    await reader.cancel()
  }
}
