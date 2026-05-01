import { readFileSync } from "node:fs"

export interface UserMessageOpts {
  selection: string
  instruction: string
  contextAbove?: string
  contextBelow?: string
  contextFiles?: string[]
}

export function buildUserMessage(opts: UserMessageOpts): string {
  const parts: string[] = []

  if (opts.contextFiles && opts.contextFiles.length > 0) {
    parts.push("[Context files]")
    for (const filePath of opts.contextFiles) {
      try {
        const content = readFileSync(filePath, "utf-8")
        parts.push(`--- ${filePath} ---`, content)
      } catch {
        parts.push(`--- ${filePath} --- (unreadable)`)
      }
    }
  }

  if (opts.contextAbove) {
    parts.push("[Context above]", opts.contextAbove)
  }

  parts.push("[Selected code]", opts.selection)

  if (opts.contextBelow) {
    parts.push("[Context below]", opts.contextBelow)
  }

  parts.push("[Instruction]", opts.instruction)

  return parts.join("\n")
}
