import { describe, test, expect } from "bun:test"
import {
  estimateTokens,
  getContextWindow,
  estimatePrompt,
  MODEL_CONTEXT_WINDOWS,
} from "../src/tokens"

describe("estimateTokens", () => {
  test("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0)
  })

  test("estimates short text", () => {
    // "hello world" = 11 chars → ceil(11/4) = 3
    expect(estimateTokens("hello world")).toBe(3)
  })

  test("estimates code block", () => {
    const code = "function foo(bar: string): number {\n  return bar.length\n}"
    // 57 chars → ceil(57/4) = 15
    expect(estimateTokens(code)).toBe(Math.ceil(code.length / 4))
  })
})

describe("getContextWindow", () => {
  test("returns known model context window", () => {
    expect(getContextWindow("gpt-4o")).toBe(128000)
    expect(getContextWindow("gpt-4")).toBe(8192)
    expect(getContextWindow("deepseek-chat")).toBe(65536)
  })

  test("returns default for unknown model", () => {
    expect(getContextWindow("some-unknown-model")).toBe(128000)
  })

  test("override takes precedence", () => {
    expect(getContextWindow("gpt-4o", 50000)).toBe(50000)
  })

  test("override takes precedence even for unknown models", () => {
    expect(getContextWindow("unknown", 4096)).toBe(4096)
  })
})

describe("estimatePrompt", () => {
  test("returns correct structure", () => {
    const result = estimatePrompt("system prompt", "user message", "gpt-4o")
    expect(result).toHaveProperty("estimated_tokens")
    expect(result).toHaveProperty("context_window")
    expect(result).toHaveProperty("fill_pct")
    expect(result.context_window).toBe(128000)
  })

  test("sums tokens from both messages plus overhead", () => {
    const sys = "a".repeat(40)   // 10 tokens
    const usr = "b".repeat(40)   // 10 tokens
    const result = estimatePrompt(sys, usr, "gpt-4o")
    // 10 + 10 + 8 overhead = 28
    expect(result.estimated_tokens).toBe(28)
  })

  test("computes fill percentage", () => {
    const result = estimatePrompt("a".repeat(400), "b".repeat(400), "gpt-4", 1000)
    // 100 + 100 + 8 = 208 tokens, context_window = 1000
    // fill_pct = 20.8
    expect(result.fill_pct).toBe(20.8)
  })

  test("includes warning when exceeding context window", () => {
    const result = estimatePrompt("a".repeat(400), "b".repeat(400), "gpt-4", 100)
    // 100 + 100 + 8 = 208 tokens, context_window = 100 → 208%
    expect(result.fill_pct).toBeGreaterThan(100)
    expect(result.warning).toBe("estimated prompt exceeds context window")
  })

  test("no warning when within context window", () => {
    const result = estimatePrompt("hello", "world", "gpt-4o")
    expect(result.warning).toBeUndefined()
  })

  test("respects context window override", () => {
    const result = estimatePrompt("hello", "world", "gpt-4o", 256000)
    expect(result.context_window).toBe(256000)
  })
})
