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
})
