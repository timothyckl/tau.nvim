import { describe, test, expect } from "bun:test"
import { buildSystemPrompt } from "../src/prompt"

describe("buildSystemPrompt", () => {
  test("includes filename and filetype", () => {
    const result = buildSystemPrompt({ filename: "main.py", filetype: "python" })
    expect(result).toContain("File: main.py (python)")
  })

  test("includes filename without filetype", () => {
    const result = buildSystemPrompt({ filename: "main.py" })
    expect(result).toContain("File: main.py")
    expect(result).not.toContain("()")
  })

  test("includes filetype without filename", () => {
    const result = buildSystemPrompt({ filetype: "go" })
    expect(result).toContain("Language: go")
  })

  test("works with no opts", () => {
    const result = buildSystemPrompt({})
    expect(result).toContain("Return ONLY the replacement code")
    expect(result).not.toContain("File:")
    expect(result).not.toContain("Language:")
  })

  test("instructs no markdown fences", () => {
    const result = buildSystemPrompt({})
    expect(result).toContain("No markdown fences")
  })

  test("uses insert phrasing when selection is empty", () => {
    const result = buildSystemPrompt({ selectionEmpty: true })
    expect(result).toContain("empty")
    expect(result).not.toContain("replacement")
  })

  test("includes context files rule when hasContextFiles is true", () => {
    const result = buildSystemPrompt({ hasContextFiles: true })
    expect(result).toContain("[Context files]")
  })

  test("omits context files rule when hasContextFiles is false", () => {
    const result = buildSystemPrompt({ hasContextFiles: false })
    expect(result).not.toContain("[Context files]")
  })
})
