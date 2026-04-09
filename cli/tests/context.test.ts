import { describe, test, expect } from "bun:test"
import { buildUserMessage } from "../src/context"

describe("buildUserMessage", () => {
  test("includes all sections when context provided", () => {
    const result = buildUserMessage({
      selection: "def foo():\n    pass",
      instruction: "add type hints",
      contextAbove: "class Foo:",
      contextBelow: "    bar = 1",
    })
    expect(result).toContain("[Context above]")
    expect(result).toContain("class Foo:")
    expect(result).toContain("[Selected code]")
    expect(result).toContain("def foo():")
    expect(result).toContain("[Context below]")
    expect(result).toContain("    bar = 1")
    expect(result).toContain("[Instruction]")
    expect(result).toContain("add type hints")
  })

  test("omits context above when not provided", () => {
    const result = buildUserMessage({
      selection: "def foo(): pass",
      instruction: "make async",
    })
    expect(result).not.toContain("[Context above]")
    expect(result).not.toContain("[Context below]")
    expect(result).toContain("[Selected code]")
    expect(result).toContain("[Instruction]")
  })

  test("sections appear in correct order", () => {
    const result = buildUserMessage({
      selection: "SEL",
      instruction: "INST",
      contextAbove: "ABOVE",
      contextBelow: "BELOW",
    })
    const aboveIdx = result.indexOf("ABOVE")
    const selIdx = result.indexOf("SEL")
    const belowIdx = result.indexOf("BELOW")
    const instIdx = result.indexOf("INST")
    expect(aboveIdx).toBeLessThan(selIdx)
    expect(selIdx).toBeLessThan(belowIdx)
    expect(belowIdx).toBeLessThan(instIdx)
  })
})
