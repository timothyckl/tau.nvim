import { readFileSync } from "node:fs"

export interface UserMessageOpts {
  selection: string
  instruction: string
  filename?: string
  contextAbove?: string
  contextBelow?: string
  contextFiles?: string[]
}

export function buildUserMessage(opts: UserMessageOpts): string {
  const parts: string[] = []

  if (opts.contextFiles && opts.contextFiles.length > 0) {
    const fileBlocks: string[] = []
    for (const filePath of opts.contextFiles) {
      try {
        const content = readFileSync(filePath, "utf-8")
        fileBlocks.push(`--- ${filePath} ---\n${content}`)
      } catch {
        fileBlocks.push(`--- ${filePath} --- (unreadable)`)
      }
    }
    parts.push("[Context files]\n" + fileBlocks.join("\n\n"))
  }

  if (opts.contextAbove) {
    const header = opts.filename ? `--- ${opts.filename} ---\n[Context above]` : "[Context above]"
    parts.push(`${header}\n${opts.contextAbove}`)
  } else if (opts.filename) {
    parts.push(`--- ${opts.filename} ---`)
  }

  parts.push(`[Selected code]\n${opts.selection}`)

  if (opts.contextBelow) {
    parts.push(`[Context below]\n${opts.contextBelow}`)
  }

  parts.push(`[Instruction]\n${opts.instruction}`)

  return parts.join("\n\n")
}
