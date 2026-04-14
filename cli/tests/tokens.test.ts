import { describe, test, expect } from "bun:test"
import { estimateTokens, estimatePrompt } from "../src/tokens"

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
    expect(estimateTokens(code)).toBe(Math.ceil(code.length / 4))
  })
})

describe("estimatePrompt", () => {
  test("returns only estimated_tokens when no context window", () => {
    const result = estimatePrompt("system prompt", "user message")
    expect(result).toHaveProperty("estimated_tokens")
    expect(result.context_window).toBeUndefined()
    expect(result.fill_pct).toBeUndefined()
  })

  test("sums tokens from both messages plus overhead", () => {
    const sys = "a".repeat(40)   // 10 tokens
    const usr = "b".repeat(40)   // 10 tokens
    const result = estimatePrompt(sys, usr)
    // 10 + 10 + 8 overhead = 28
    expect(result.estimated_tokens).toBe(28)
  })

  test("computes fill percentage when context window provided", () => {
    const result = estimatePrompt("a".repeat(400), "b".repeat(400), 1000)
    // 100 + 100 + 8 = 208 tokens, context_window = 1000
    // fill_pct = 20.8
    expect(result.fill_pct).toBe(20.8)
    expect(result.context_window).toBe(1000)
  })

  test("includes warning when exceeding context window", () => {
    const result = estimatePrompt("a".repeat(400), "b".repeat(400), 100)
    // 100 + 100 + 8 = 208 tokens, context_window = 100 → 208%
    expect(result.fill_pct).toBeGreaterThan(100)
    expect(result.warning).toBe("estimated prompt exceeds context window")
  })

  test("no warning when within context window", () => {
    const result = estimatePrompt("hello", "world", 128000)
    expect(result.warning).toBeUndefined()
  })
})
