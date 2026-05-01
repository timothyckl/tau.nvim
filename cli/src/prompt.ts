export interface PromptOpts {
  filename?: string
  filetype?: string
  selectionEmpty?: boolean
  hasContextFiles?: boolean
}

export function buildSystemPrompt(opts: PromptOpts): string {
  const fileLine = opts.filename
    ? `File: ${opts.filename}${opts.filetype ? ` (${opts.filetype})` : ""}`
    : opts.filetype
    ? `Language: ${opts.filetype}`
    : ""

  const intro = opts.selectionEmpty
    ? "You are a code editing assistant. The selected region is empty — generate new code to insert at that position."
    : "You are a code editing assistant. You will be given a code selection and an instruction."

  const outputRule = opts.selectionEmpty
    ? "Return ONLY the new code to insert. Your output will be placed directly at the empty region in the file."
    : "Return ONLY the replacement code for the selected region. Your output will directly replace the selected code in the file."

  const firstBullet = opts.selectionEmpty
    ? "Output ONLY the code to insert — nothing before it, nothing after it"
    : "Output ONLY the replacement for [Selected code] — nothing before it, nothing after it"

  const contextFilesRule = opts.hasContextFiles
    ? "- Reference [Context files] for broader project context when relevant to the instruction"
    : ""

  return [
    intro,
    outputRule,
    "CRITICAL RULES:",
    `- ${firstBullet}`,
    "- Do NOT repeat code from [Context above] or [Context below]",
    contextFilesRule,
    "- No markdown fences (no ```)",
    "- No explanation or commentary",
    "- Preserve indentation and style",
    fileLine,
  ]
    .filter(Boolean)
    .join("\n")
}
