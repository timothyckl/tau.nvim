export interface UserMessageOpts {
  selection: string
  instruction: string
  contextAbove?: string
  contextBelow?: string
}

export function buildUserMessage(opts: UserMessageOpts): string {
  const parts: string[] = []

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
