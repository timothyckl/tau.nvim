import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { buildUserMessage } from "../src/context"
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

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

  test("handles empty selection", () => {
    const result = buildUserMessage({
      selection: "",
      instruction: "add a constructor",
      contextAbove: "class Foo {",
      contextBelow: "}",
    })
    expect(result).toContain("[Selected code]")
    expect(result).toContain("[Instruction]")
    expect(result).toContain("add a constructor")
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

  describe("context files", () => {
    let tmpDir: string
    let tmpFile: string

    beforeAll(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "tau-test-"))
      tmpFile = join(tmpDir, "helper.ts")
      writeFileSync(tmpFile, "export function helper() { return 42 }")
    })

    afterAll(() => {
      try { unlinkSync(tmpFile) } catch {}
    })

    test("includes context files section with valid file", () => {
      const result = buildUserMessage({
        selection: "SEL",
        instruction: "INST",
        contextFiles: [tmpFile],
      })
      expect(result).toContain("[Context files]")
      expect(result).toContain(`--- ${tmpFile} ---`)
      expect(result).toContain("export function helper() { return 42 }")
    })

    test("omits context files section when empty", () => {
      const result = buildUserMessage({
        selection: "SEL",
        instruction: "INST",
        contextFiles: [],
      })
      expect(result).not.toContain("[Context files]")
    })

    test("omits context files section when undefined", () => {
      const result = buildUserMessage({
        selection: "SEL",
        instruction: "INST",
      })
      expect(result).not.toContain("[Context files]")
    })

    test("marks unreadable files", () => {
      const result = buildUserMessage({
        selection: "SEL",
        instruction: "INST",
        contextFiles: ["/nonexistent/path/file.ts"],
      })
      expect(result).toContain("[Context files]")
      expect(result).toContain("(unreadable)")
    })

    test("context files appear before context above", () => {
      const result = buildUserMessage({
        selection: "SEL",
        instruction: "INST",
        contextAbove: "ABOVE",
        contextBelow: "BELOW",
        contextFiles: [tmpFile],
      })
      const filesIdx = result.indexOf("[Context files]")
      const aboveIdx = result.indexOf("[Context above]")
      const selIdx = result.indexOf("[Selected code]")
      expect(filesIdx).toBeLessThan(aboveIdx)
      expect(aboveIdx).toBeLessThan(selIdx)
    })
  })
})
