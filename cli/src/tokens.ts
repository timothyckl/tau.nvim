export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export interface TokenEstimate {
  estimated_tokens: number
  context_window?: number
  fill_pct?: number
  warning?: string
}

const MESSAGE_OVERHEAD_TOKENS = 8

export function estimatePrompt(
  systemPrompt: string,
  userMessage: string,
  contextWindow?: number,
): TokenEstimate {
  const estimated_tokens =
    estimateTokens(systemPrompt) + estimateTokens(userMessage) + MESSAGE_OVERHEAD_TOKENS

  const estimate: TokenEstimate = { estimated_tokens }

  if (contextWindow) {
    estimate.context_window = contextWindow
    estimate.fill_pct = Math.round((estimated_tokens / contextWindow) * 1000) / 10

    if (estimate.fill_pct > 100) {
      estimate.warning = "estimated prompt exceeds context window"
    }
  }

  return estimate
}
