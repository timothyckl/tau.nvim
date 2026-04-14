export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 16385,
  "claude-sonnet-4-20250514": 200000,
  "claude-3-5-sonnet-20241022": 200000,
  "claude-3-haiku-20240307": 200000,
  "deepseek-chat": 65536,
  "deepseek-coder": 65536,
}

const DEFAULT_CONTEXT_WINDOW = 128000

export function getContextWindow(model: string, override?: number): number {
  if (override !== undefined) return override
  return MODEL_CONTEXT_WINDOWS[model] ?? DEFAULT_CONTEXT_WINDOW
}

export interface TokenEstimate {
  estimated_tokens: number
  context_window: number
  fill_pct: number
  warning?: string
}

const MESSAGE_OVERHEAD_TOKENS = 8

export function estimatePrompt(
  systemPrompt: string,
  userMessage: string,
  model: string,
  contextWindowOverride?: number,
): TokenEstimate {
  const estimated_tokens =
    estimateTokens(systemPrompt) + estimateTokens(userMessage) + MESSAGE_OVERHEAD_TOKENS
  const context_window = getContextWindow(model, contextWindowOverride)
  const fill_pct = Math.round((estimated_tokens / context_window) * 1000) / 10

  const estimate: TokenEstimate = { estimated_tokens, context_window, fill_pct }

  if (fill_pct > 100) {
    estimate.warning = "estimated prompt exceeds context window"
  }

  return estimate
}
