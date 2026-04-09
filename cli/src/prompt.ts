export interface PromptOpts {
  filename?: string
  filetype?: string
}

export function buildSystemPrompt(opts: PromptOpts): string {
  const fileLine = opts.filename
    ? `File: ${opts.filename}${opts.filetype ? ` (${opts.filetype})` : ""}`
    : opts.filetype
    ? `Language: ${opts.filetype}`
    : ""

  return [
    "You are a code editing assistant. You will be given a code selection and an instruction.",
    "Return ONLY the replacement code for the selected region. Your output will directly replace the selected code in the file.",
    "CRITICAL RULES:",
    "- Output ONLY the replacement for [Selected code] — nothing before it, nothing after it",
    "- Do NOT repeat code from [Context above] or [Context below]",
    "- No markdown fences (no ```)",
    "- No explanation or commentary",
    "- Preserve indentation and style",
    fileLine,
  ]
    .filter(Boolean)
    .join("\n")
}
